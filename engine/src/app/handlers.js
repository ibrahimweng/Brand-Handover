'use strict';
// The engine has always been a command line and a project file somebody wrote
// by hand. This is the same engine with a front door: artwork in, the audit
// shown rather than printed, a few decisions taken, and a package out.
//
// Nothing here reimplements anything. Everything that builds writes a real
// project into a temporary directory and goes through project.load and build
// exactly as the CLI does, and the door that reads the artwork calls the same
// normaliser project.load calls, so what the app reports is what the command
// line reports. A second implementation of the loader, or of the audit, would
// be a second set of rules to keep true — and for a while the audit was exactly
// that: a route of its own that the front door had stopped calling, while the
// door read the upload with a second set of eyes that had no audit in them.
const fs = require('fs');
const os = require('os');
const path = require('path');
const svgu = require('../svg');
const contrast = require('../contrast');
const naming = require('../naming');
const projectLoader = require('../project');
const { build } = require('../build');
const { measure } = require('../variants');

const MAX_SVG = 4 * 1024 * 1024;         // an SVG larger than this is not artwork

// ---- what a designer's file is painted with -------------------------------
// A palette has to start somewhere, and the least surprising place is the
// colours already in the artwork, commonest first. Asking somebody to type
// hex values they have just handed us would be rude.
function paletteFrom(source) {
  let doc;
  try { doc = svgu.parse(source); } catch (e) { return []; }
  const seen = new Map();
  const note = (v) => {
    if (!v) return;
    const s = String(v).trim();
    if (!s || s === 'none' || /^url\(/i.test(s) || s === 'currentColor') return;
    const hex = contrast.toHex(s);
    if (hex) seen.set(hex, (seen.get(hex) || 0) + 1);
  };
  svgu.eachPainted(doc, (el) => {
    if (!el.getAttribute) return;
    note(el.getAttribute('fill'));
    note(el.getAttribute('stroke'));
    // a colour written into a style attribute is still a colour
    for (const m of String(el.getAttribute('style') || '').matchAll(/(?:fill|stroke)\s*:\s*([^;]+)/gi)) note(m[1]);
  });
  return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([hex]) => hex);
}

// ---- a project file, from what the app was told ---------------------------
// Everything the loader insists on, and nothing it does not. The defaults are
// the ones a designer would pick if asked, so the form can be short.
const ROLES = ['primary', 'ground', 'accent'];

function projectJson(opts) {
  const colours = {};
  for (const c of opts.colours) {
    // A hex is what the designer picked; a CMYK build is what a printer said.
    // Four numbers that are not four numbers are not carried, because the whole
    // print path exists to stop a colour being guessed at.
    const ink = Array.isArray(c.cmyk) && c.cmyk.length === 4
      && c.cmyk.every((n) => Number.isFinite(Number(n)) && Number(n) >= 0 && Number(n) <= 100)
      ? c.cmyk.map(Number) : undefined;
    colours[c.name] = { hex: c.hex, role: c.role || undefined, cmyk: ink };
  }
  const first = opts.colours[0] || { name: 'primary' };
  const ground = opts.colours.find((c) => c.role === 'ground') || opts.colours[1] || first;
  const slots = opts.slots && opts.slots.length ? opts.slots : ['all'];
  const way = (name, colour) => ({ name, on: name === 'reverse' ? first.name : ground.name,
    slots: Object.fromEntries(slots.map((s) => [s, colour])) });

  // The first colourway is the drawing. It used to be every slot painted the
  // primary, which is not a colourway of this identity but a flattening of it:
  // a mark drawn in two colours came out of the front door drawn in one, with
  // the second colour measured, shown, confirmed on the way past and then
  // painted over — eight of the thirty-two here — and a gradient came out flat
  // with the build's own warning saying exactly that and nobody reading it.
  // "keep" is this engine's word for "as the master drew it", and the master
  // is already painted.
  const ways = [way('full-colour', svgu.KEEP)];
  // A one-colour version is a real thing to need — one ink, an embroidery, a
  // stamp — and it is what the door used to cut by accident. It is cut on
  // purpose now, and only where there is something to flatten: for artwork
  // that is already one flat colour it would be the same file under a second
  // name. opts.flatten is measured off the drawing in intake.read.
  if (opts.flatten) ways.push(way('mono', first.hex));
  ways.push(way('reverse', ground.hex));
  return {
    brand: opts.brand,
    latinName: opts.latinName || undefined,
    language: opts.language || undefined,
    version: opts.version || '1.0.0',
    assets: Object.assign(opts.mark ? { mark: 'mark.svg' } : {},
      opts.wordmark ? { wordmark: 'wordmark.svg' } : {}),
    tokens: {
      colour: colours,
      // The engine's shape, not a second vocabulary for it. This was
      // { heading, body } — words nothing in the engine reads — so
      // tokens.type.families was undefined in every package the door has ever
      // built: no 09-type folder, no @font-face in any document, and three
      // specimen pages naming a face the package does not carry. Both checks
      // written for exactly that stayed quiet, because a family you never name
      // cannot be reported as unreachable.
      //
      // The language chooses the faces, because a document is written in the
      // engine's words as well as the identity's and Archivo cannot draw one
      // letter of the Hebrew ones. src/intake.js says which pair sets which
      // script, once, and the question that asks for the language names them.
      type: opts.type || { families: require('../intake').facesFor(opts.language) },
    },
    rules: {
      lockups: opts.lockups,
      colourways: ways,
      formats: ['svg', 'png'],
      pngWidths: [512, 1024],
      naming: '{brand}-{lockup}-{colourway}',
    },
    content: opts.content || {},
  };
}

// ---- the artwork the engine will use, and what it measures -----------------
// The audit first, always. Reading the upload instead is how the door came to
// hold a different opinion from the build about one file, and it was not in one
// place: ask read the upload, stage read the upload again to decide what the
// colourways would name, and preview read it a third time for a colour to draw
// in. Three readers of one drawing is three chances to disagree, and two of
// them were wrong — the artwork the loader normalises has slots that the raw
// file does not, so the colourways the door wrote named slots that were not
// there and every file for them came out identical.
//
// The palette matters here, and it is the second half of the same fault. A slot
// is named after the palette colour it is painted in, and falls back to
// colour-1, colour-2 when no colour matches — so the same drawing read without
// a palette and read with one comes back with different slot names. Perigee's
// were colour-1, colour-2, colour-3, ink without and colour-2, ink, accent
// with. Auditing was not enough: the audit has to be the one the loader will
// run, palette and all, or the colourways name slots that will not exist.
function readArtwork(mark, wordmark, colours) {
  const { normalise } = require('../normalise');
  const tokens = { colour: Object.fromEntries((colours || [])
    .filter((c) => c && c.name && c.hex).map((c) => [c.name, { hex: c.hex }])) };
  const findings = {};
  const clean = {};
  for (const [key, src] of [['mark', mark], ['wordmark', wordmark]]) {
    if (!src) continue;
    const n = normalise(src, { tokens });
    findings[key] = n.findings;
    if (!n.ok) return { ok: false, asset: key, findings: n.findings };
    clean[key] = n.svg;
  }
  const seen = require('../intake').read({ mark: clean.mark || null, wordmark: clean.wordmark || null });
  return { ok: true, clean, findings, seen };
}

// Refused the way the loader refuses it, because it is the loader's audit: the
// caller that would have hit this a moment later already knows this shape.
function refuse(read) {
  const e = new Error(`the ${read.asset} artwork cannot be used yet`);
  e.findings = read.findings;
  e.asset = read.asset;
  return e;
}

// A project on disk, because that is what the loader reads. It is thrown away
// by the caller; nothing here is a store.
function stage(opts) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-app-'));
  if (opts.mark) fs.writeFileSync(path.join(dir, 'mark.svg'), opts.mark);
  if (opts.wordmark) fs.writeFileSync(path.join(dir, 'wordmark.svg'), opts.wordmark);
  const file = path.join(dir, 'project.json');
  // Where the six answers came through, they decide the project: the layout,
  // the formats, the sizes, the stock, what it is made as and what must never
  // be done to it are all worked out in one place rather than in two that would
  // disagree. See src/intake.js.
  let json;
  const chosen = (opts.colours && opts.colours.length ? opts.colours
    : (opts.answers && opts.answers.colours)) || [];
  const read = readArtwork(opts.mark, opts.wordmark, chosen);
  if (!read.ok) throw refuse(read);
  if (opts.answers) {
    const intake = require('../intake');
    const seen = read.seen;
    // The language goes in with the answers rather than over the top of them:
    // toProject picks the faces from it, and setting it afterwards would leave a
    // Hebrew manual set in a face that cannot draw a letter of it.
    json = intake.toProject(Object.assign({}, opts.answers, {
      brand: opts.brand,
      language: opts.language || opts.answers.language,
      colours: (opts.colours && opts.colours.length ? opts.colours : opts.answers.colours),
    }), seen);
    if (opts.overrides && opts.overrides.length) json.overrides = opts.overrides;
    if (opts.latinName) json.latinName = opts.latinName;
    if (opts.type) json.tokens.type = opts.type;
  } else {
    // the slots and the paint are read off the artwork rather than taken from
    // the caller, for the same reason
    json = projectJson(Object.assign({}, opts,
      { slots: read.seen.slots, flatten: read.seen.flatten }));
  }
  fs.writeFileSync(file, JSON.stringify(json, null, 2));
  return { dir, file };
}

const asSvg = (v, what) => {
  if (typeof v !== 'string' || !v.trim()) throw bad(`${what} is missing.`, `Drop an SVG file on ${what}.`);
  if (v.length > MAX_SVG) {
    throw bad(`${what} is ${(v.length / 1048576).toFixed(1)} MB, which is not artwork.`,
      'A logo is a few kilobytes of paths. Something that big is usually an embedded photograph — export the vector on its own.');
  }
  if (!/<svg[\s>]/i.test(v)) {
    throw bad(`${what} is not an SVG.`,
      'Export from your drawing tool as SVG. A PNG or a JPEG cannot be measured or recoloured.');
  }
  return v;
};

// Every file in the package is named after the brand, and a name in kana or in
// Hebrew has no letters a file name can carry. The loader has always refused
// this — "Add latinName to the project" — which is the right sentence to a
// person holding a project file and no help at all to a person holding a
// browser: there is no file to add it to. It is asked for at the door now, and
// this is what a caller that skipped the door is told.
function needsLatin(brand, latinName) {
  if (naming.slug(latinName || '') || naming.slug(brand || '')) return null;
  const e = new Error(`The name "${String(brand).trim()}" has no letters a file name can carry.`);
  e.expected = true;
  e.finding = { level: 'blocker', code: 'latinName', what: e.message,
    why: 'Every file in the package is named after the brand, and a zip, a URL and somebody\u2019s '
      + 'Windows machine all need ASCII. There is nothing here to name them with.',
    how: 'Give the roman spelling the files should use \u2014 it names files only, and the '
      + 'documents keep the name you typed.' };
  return e;
}

// A language whose script nothing in fonts/ covers. strings.js writes Japanese
// and the engine holds no face with a CJK subset, so a package asked for in it
// would come out with 596 characters of chrome drawn by whatever the reader
// happened to have — tofu, under a manual claiming to be set in Archivo.
// yamabiko does it properly by shipping a subsetted IPAGothic of its own, which
// is a thing a project file can do and a front door cannot.
function cannotSet(language) {
  if (!language) return null;
  const intake = require('../intake');
  const l = intake.languages().find((x) => x.code === language);
  if (!l || l.faces.length) return null;
  const e = new Error(`This engine cannot set ${l.name}.`);
  e.expected = true;
  e.finding = { level: 'blocker', code: 'language', what: e.message,
    why: `A document carries the engine's words as well as yours, and there are 596 characters of `
      + `them in ${l.name}. No typeface this holds can draw one, so the manual would come out in `
      + 'boxes under a page claiming which face it was set in.',
    how: 'Pick a language this can set, or write a project file that ships a typeface for it — '
      + 'projects/yamabiko does exactly that, with the font subsetted to the characters it uses.' };
  return e;
}

function bad(what, how) {
  const e = new Error(what);
  e.expected = true;
  e.finding = { level: 'blocker', code: 'input', what, why: 'The engine has nothing it can work from.', how };
  return e;
}

// ---- build the package ----------------------------------------------------
// Into a directory the caller owns, so the server can serve the documents at
// real URLs rather than posting two megabytes of base64 back through JSON.
async function make(input, outDir) {
  if (!input.mark && !input.wordmark) {
    throw bad('No artwork was given.',
      'Drop an SVG on the mark, the wordmark, or both. Either one on its own is a whole identity.');
  }
  const mark = input.mark ? asSvg(input.mark, 'the mark') : null;
  const wordmark = input.wordmark ? asSvg(input.wordmark, 'the wordmark') : null;
  if (!input.brand || !String(input.brand).trim()) {
    throw bad('The identity has no name.', 'Type the brand name. It titles the manual, the deck and every file in the package.');
  }
  const colours = (input.colours || []).filter((c) => c && c.hex && c.name);
  if (!colours.length) throw bad('No colours were chosen.', 'Pick at least one ink and one ground.');
  for (const c of colours) {
    if (!contrast.toHex(c.hex)) {
      throw bad(`"${c.hex}" is not a colour this can read.`, 'Use a hex value like #1B3A6B, or rgb(), or hsl().');
    }
  }
  const lockups = (input.lockups || []).filter(Boolean);
  if (!lockups.length) throw bad('No lockups were chosen.', 'Pick at least one — the mark on its own is enough to start.');
  const noLatin = needsLatin(input.brand, input.latinName);
  if (noLatin) throw noLatin;
  const noFace = cannotSet(input.language || (input.answers || {}).language);
  if (noFace) throw noFace;

  const opts = {
    brand: String(input.brand).trim(),
    latinName: input.latinName || undefined,
    language: input.language || undefined,
    mark, wordmark, colours, lockups,
    slots: input.slots && input.slots.length ? input.slots : undefined,
    type: input.type,
    content: input.content,
    // the six answers, where the intake screen is what asked. Everything they
    // decide — the layout, the formats, the sizes, the stock, what it is made
    // as, what must never be done to it — is worked out in src/intake.js, so
    // this hands them over rather than having a second opinion about them.
    answers: input.answers || null,
    // the edits made by hand on the screen before this one
    overrides: input.overrides || null,
  };
  const { dir, file } = stage(opts);
  try {
    const project = projectLoader.load(file);
    const result = await build(project, outDir, {});
    const bytes = result.written.reduce((n, f) => n + f.bytes, 0);
    return {
      ok: true,
      brand: project.brand,
      files: result.written.length,
      bytes,
      warnings: result.warnings || [],
      notes: result.notes || [],
      zip: (result.written.find((f) => f.path.endsWith('.zip')) || {}).path || null,
      documents: ['guidelines.html', 'deck.html', 'published.html', 'editor.html']
        .filter((f) => result.written.some((w) => w.path === f)),
      measured: {
        floorPx: require('../geometry').floorText(result.measured.minimumSize, 'px'),
        floorMm: require('../geometry').floorText(result.measured.minimumSize, 'mm'),
        clearSpace: result.measured.clearSpace,
        ink: result.measured.markInk,
      },
    };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ----------------------------------------------------------------- the intake
//
// What the engine can tell from the artwork, and the few things it cannot. The
// screen that asks the questions gets both in one answer, so it never has to
// guess what the engine already knows. See src/intake.js.
//
// The audit runs here, at the door, because this is the only round trip a
// person makes before they start answering questions. It used to live behind
// its own route, which the front door stopped calling and nothing has called
// since; the door meanwhile read the upload with a second set of eyes that had
// no audit in them, so a file the engine would refuse was measured, described
// and accepted, and its answers reached the build before anybody was told.
function ask(input) {
  const mark = input.mark ? asSvg(input.mark, 'the mark') : null;
  const wordmark = input.wordmark ? asSvg(input.wordmark, 'the wordmark') : null;
  if (!mark && !wordmark) {
    throw bad('No artwork was given.',
      'Drop an SVG on the mark, the wordmark, or both. Either one on its own is a whole identity.');
  }

  // The audit, and then the measuring, off what the audit returns rather than
  // off the upload. They are not the same drawing: a transform that has not
  // been flattened measures a stroke thinner than it prints, a shape lying off
  // the artboard widens the box every size is worked out from, and a fill still
  // sitting in a stylesheet is a colour the palette cannot see. Nine of the
  // thirty-two identities named a different motif read the two ways, and three
  // counted their colours differently — one of them, drawn in a gradient,
  // counted none at all and was handed an empty palette to confirm.
  const read = readArtwork(mark, wordmark);
  if (!read.ok) {
    return { ok: false, asset: read.asset,
      what: `The ${read.asset} cannot be used as it is.`, findings: read.findings };
  }
  const { seen, clean, findings } = read;
  if (!seen.ok) throw bad('That artwork could not be read.', seen.why);
  return { ok: true, seen, questions: require('../intake').questions(seen), findings, clean };
}

// The four layout systems, each drawn with this identity, so the choice is made
// by looking rather than by reading four descriptions. See documents/preview.js.
function preview(input) {
  const mark = input.mark ? asSvg(input.mark, 'the mark') : null;
  const wordmark = input.wordmark ? asSvg(input.wordmark, 'the wordmark') : null;
  const art = mark || wordmark;
  if (!art) throw bad('No artwork was given.', 'Drop an SVG first.');
  const svgu = require('../svg');
  const read = input.colours && input.colours.length ? null : readArtwork(mark, wordmark);
  if (read && !read.ok) throw refuse(read);
  const colours = (input.colours && input.colours.length ? input.colours
    : read.seen.colours) || [];
  const ink = (colours.find((c) => c.role === 'primary') || colours[0] || {}).hex || '#111111';
  // painted in the identity's own ink, because a preview in black is a preview
  // of something else
  const doc = svgu.parse(art);
  const slots = svgu.slotsUsed(doc);
  svgu.applyColourway(doc, Object.fromEntries((slots.length ? slots : []).map((k) => [k, ink])));
  const painted = svgu.serialize(doc).replace(/<\?xml[^>]*\?>/g, '')
    .replace(/\s(?:width|height)="[^"]*"/g, '')
    + '';
  return { ok: true, previews: require('../documents/preview').previews({
    brand: input.brand || 'Untitled', positioning: input.positioning || '',
    markSvg: painted.replace(/<svg /, '<svg style="width:100%;max-width:210px;height:auto;display:block" '),
    colours,
  }) };
}

// The manual as it stands, with the edits applied, for the screen where a
// person edits it. Only the documents are made: a text edit does not need every
// PNG cut again, and a round trip that takes eight seconds is a round trip
// nobody makes twice.
function render(input) {
  const mark = input.mark ? asSvg(input.mark, 'the mark') : null;
  const wordmark = input.wordmark ? asSvg(input.wordmark, 'the wordmark') : null;
  if (!mark && !wordmark) throw bad('No artwork was given.', 'Drop an SVG first.');
  const answers = input.answers || {};
  const brand = input.brand || answers.brand || 'Untitled';
  const latinName = input.latinName || answers.latinName || undefined;
  const no = needsLatin(brand, latinName);
  if (no) throw no;
  const noFace = cannotSet(input.language || answers.language);
  if (noFace) throw noFace;
  const { dir, file } = stage({
    brand, latinName, language: input.language || answers.language || undefined,
    mark, wordmark,
    colours: (input.colours && input.colours.length ? input.colours : answers.colours) || [],
    lockups: input.lockups && input.lockups.length ? input.lockups : undefined,
    slots: input.slots, answers,
  });
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    raw.overrides = input.overrides || [];
    fs.writeFileSync(file, JSON.stringify(raw, null, 2));
    const project = projectLoader.load(file);
    const measured = measure(project);
    const docs = require('../documents');
    const ctx = docs.context(project, measured, [], {});
    ctx.editing = true;                    // show the values nobody has written yet
    return { ok: true, html: docs.guidelines(ctx) };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// Everything a person may replace, so the screen can list what it is offering
// rather than discovering it from the markup.
function editable() {
  const O = require('../overrides');
  return { ok: true, values: O.ALLOWED, keyed: O.PATTERNS.map((p) => ({ what: p.what, kind: p.kind })) };
}

module.exports = { ask, preview, render, editable, make, paletteFrom, projectJson, MAX_SVG };
