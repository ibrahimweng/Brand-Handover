'use strict';
// The engine has always been a command line and a project file somebody wrote
// by hand. This is the same engine with a front door: artwork in, the audit
// shown rather than printed, a few decisions taken, and a package out.
//
// Nothing here reimplements anything. Both handlers write a real project into a
// temporary directory and go through project.load and build exactly as the CLI
// does, so what the app reports is what the command line reports. A second
// implementation of the loader would be a second set of rules to keep true.
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
  return {
    brand: opts.brand,
    latinName: opts.latinName || undefined,
    language: opts.language || undefined,
    version: opts.version || '1.0.0',
    assets: Object.assign(opts.mark ? { mark: 'mark.svg' } : {},
      opts.wordmark ? { wordmark: 'wordmark.svg' } : {}),
    tokens: {
      colour: colours,
      type: opts.type || { heading: 'Archivo', body: 'Literata' },
    },
    rules: {
      lockups: opts.lockups,
      colourways: [way(first.name, first.hex), way('reverse', ground.hex)],
      formats: ['svg', 'png'],
      pngWidths: [512, 1024],
      naming: '{brand}-{lockup}-{colourway}',
    },
    content: opts.content || {},
  };
}

// A project on disk, because that is what the loader reads. It is thrown away
// by the caller; nothing here is a store.
function stage(opts) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-app-'));
  if (opts.mark) fs.writeFileSync(path.join(dir, 'mark.svg'), opts.mark);
  if (opts.wordmark) fs.writeFileSync(path.join(dir, 'wordmark.svg'), opts.wordmark);
  const file = path.join(dir, 'project.json');
  fs.writeFileSync(file, JSON.stringify(projectJson(opts), null, 2));
  return { dir, file };
}

// What can be built from what was given. Three of the four lockups need both.
const lockupsFor = (mark, wordmark) => (mark && wordmark
  ? ['horizontal', 'stacked', 'mark', 'wordmark']
  : mark ? ['mark'] : ['wordmark']);

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

function bad(what, how) {
  const e = new Error(what);
  e.expected = true;
  e.finding = { level: 'blocker', code: 'input', what, why: 'The engine has nothing it can work from.', how };
  return e;
}

// ---- read the artwork, before anything is decided -------------------------
// The audit first, because it is the part a designer has never been shown: what
// their own export actually contains, what was cleaned out of it, and what the
// mark measures. Nothing is committed to at this point.
function inspect(input) {
  if (!input.mark && !input.wordmark) {
    throw bad('No artwork was given.',
      'Drop an SVG on the mark, the wordmark, or both. Either one on its own is a whole identity.');
  }
  const mark = input.mark ? asSvg(input.mark, 'the mark') : null;
  const wordmark = input.wordmark ? asSvg(input.wordmark, 'the wordmark') : null;
  const palette = [...new Set([...(mark ? paletteFrom(mark) : []), ...(wordmark ? paletteFrom(wordmark) : [])])];
  const ink = palette[0] || '#1B1B1B';

  // A palette the loader will accept, so the audit runs against a real project
  // rather than a sketch of one. The designer changes it on the next screen.
  const opts = {
    brand: input.brand || 'Untitled',
    latinName: naming.slug(input.brand || '') ? undefined : 'Untitled',
    mark, wordmark,
    colours: [{ name: 'primary', hex: ink, role: 'primary' }, { name: 'ground', hex: '#FFFFFF', role: 'ground' }],
    lockups: lockupsFor(mark, wordmark),
  };
  const { dir, file } = stage(opts);
  try {
    let project;
    try { project = projectLoader.load(file); }
    catch (e) {
      // the loader refuses artwork it cannot use, and says why in the same
      // language as everything else. Hand that straight through.
      if (e.findings) return { ok: false, asset: e.asset, findings: e.findings };
      throw e;
    }
    const m = measure(project);
    const geo = require('../geometry');

    // Every lockup the artwork can make, composed by the engine and handed to
    // the page with its colour slots still marked. The browser repaints those
    // slots as a swatch is touched, so a designer sees the actual lockup in the
    // actual colour without a round trip — and without a second implementation
    // of lockup geometry to disagree with the one that writes the package.
    const { buildVariant } = require('../variants');
    const neutral = { name: 'preview', slots: Object.fromEntries(
      (m.slots.length ? m.slots : ['all']).map((k) => [k, '#111111'])) };
    const lockups = {};
    for (const l of lockupsFor(mark, wordmark)) {
      try {
        const v = buildVariant({ markSrc: project.assets.mark && project.assets.mark.source,
          wordmarkSrc: project.assets.wordmark && project.assets.wordmark.source,
          lockup: l, colourway: neutral, rules: project.rules, measured: m });
        lockups[l] = v.svg;
      } catch (e) { /* a lockup that cannot be composed is simply not offered */ }
    }
    return {
      ok: true,
      findings: project.report,
      palette,
      slots: m.slots,
      master: m.master,
      hasWordmark: !!wordmark,
      measured: {
        ink: m.markInk, viewBox: m.markViewBox, clearSpace: m.clearSpace,
        thinnest: m.minimumSize.thinnestStroke,
        basis: m.minimumSize.basis,
        floorPx: geo.floorText(m.minimumSize, 'px'),
        floorMm: geo.floorText(m.minimumSize, 'mm'),
      },
      // the artwork as the engine will use it, for the preview
      clean: { mark: project.assets.mark && project.assets.mark.source,
        wordmark: project.assets.wordmark && project.assets.wordmark.source },
      lockups: lockupsFor(mark, wordmark),
      art: lockups,
    };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
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

  const opts = {
    brand: String(input.brand).trim(),
    latinName: input.latinName || undefined,
    language: input.language || undefined,
    mark, wordmark, colours, lockups,
    slots: input.slots && input.slots.length ? input.slots : undefined,
    type: input.type,
    content: input.content,
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

module.exports = { inspect, make, paletteFrom, projectJson, MAX_SVG };
