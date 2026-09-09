'use strict';
// What the engine asks, and what it refuses to ask.
//
// A brand package has about forty decisions in it. Most of them are facts about
// the artwork — how thin the thinnest stroke is, how small the mark can go, what
// colours are in it, how many parts it has, what shape carries a repeat — and
// the engine measures every one of those already. Asking a designer to type in
// something the file can be asked is how a tool ends up with a fourteen step
// wizard that people abandon.
//
// So there are seven questions, and four of them are the engine showing its own
// answer and asking whether it is right. Everything else is measured.
//
//   1  what it is called                        cannot be measured
//   2  what language it is written in           shown, answered, changeable
//   3  what it does, in one line                cannot be measured
//   4  how it should be laid out                shown, four ways, with your logo
//   5  where it mostly lives                    cannot be measured, sets a lot
//   6  the colours                              measured, confirm the roles
//   7  what it must never do                    suggested from the drawing
//
// The seventh is the language, and it is the one this door could not ask at all.
// src/strings.js holds four dictionaries under a key-parity test and
// there is a fixture for each — verdon in French, maayan in Hebrew, yamabiko in
// Japanese — and every one of them was reachable only by writing a project file
// by hand. A Hebrew identity built here got an English manual laid out left to
// right, which is the thing project.js says was wrong in the first place: "A
// Hebrew manual told a screen reader to say Hebrew in an English voice."
//
// It is asked rather than guessed. The script a name is written in is a signal
// and not an answer: verdon is French with a Latin name, and a studio in Tel
// Aviv may well want the book in English.
//
// The four layout directions are in src/directions.js and the ten misuse
// treatments in src/misuse.js. This module's job is to turn seven answers into
// a project the rest of the engine already knows how to build.
const svgu = require('./svg');
const geo = require('./geometry');
const D = require('./directions');
const MIS = require('./misuse');
const PAT = require('./pattern');

const hexOf = (h) => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(h || '').trim());
  if (!m) return null;
  const v = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return `#${v.toUpperCase()}`;
};
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lum = (h) => { const [r, g, b] = rgb(h).map((c) =>
  (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const sat = (h) => { const c = rgb(h); return Math.max(...c) - Math.min(...c); };

// ------------------------------------------------------- what the file says

// Every colour the artwork is painted in, most-used first. Ordered by how much
// of the drawing each one covers rather than by where it appears in the file,
// because the ink a mark is mostly drawn in is the one a designer means when
// they say "the brand colour".
function palette(sources) {
  const tally = new Map();
  for (const src of sources.filter(Boolean)) {
    const doc = svgu.parse(src);
    svgu.eachPainted(doc, (el) => {
      if (!el.getAttribute) return;
      for (const attr of ['fill', 'stroke']) {
        const h = hexOf(el.getAttribute(attr));
        if (h) tally.set(h, (tally.get(h) || 0) + 1);
      }
    });
  }
  return [...tally.entries()].sort((a, b) => b[1] - a[1]).map(([hex]) => hex);
}

// A role for each colour, proposed rather than asked. The darkest is what the
// mark is drawn in, the lightest is what it stands on, and the one furthest
// from grey is the one that is doing something.
function roles(hexes) {
  const list = hexes.slice(0, 6);
  // Artwork that names no colour at all is still artwork. A fill of
  // currentColor is black wherever nothing says otherwise, and a shape filled
  // with a pattern or a gradient carries a slot a colourway can paint over —
  // both are drawings, and both handed back an empty palette. The front door
  // then asked a person to confirm nothing, showed them a preview and a whole
  // manual, and refused at the last screen with "No colours were chosen. Pick
  // at least one ink and one ground" — a sentence written for a caller that
  // forgot to send any, on a screen with nothing to pick. Ink on paper is what
  // a renderer would draw and what the person can change.
  if (!list.length) {
    return [{ hex: '#000000', role: 'primary', name: 'ink' },
      { hex: '#FFFFFF', role: 'ground', name: 'paper' }];
  }
  const byDark = list.slice().sort((a, b) => lum(a) - lum(b));
  const primary = byDark[0];
  const lightest = byDark[byDark.length - 1];
  const ground = lum(lightest) > 0.6 && lightest !== primary ? lightest : '#FFFFFF';
  const rest = list.filter((h) => h !== primary && h !== ground);
  const accent = rest.slice().sort((a, b) => sat(b) - sat(a))[0] || null;
  const named = [];
  named.push({ hex: primary, role: 'primary', name: 'ink' });
  named.push({ hex: ground, role: 'ground', name: 'paper' });
  if (accent) named.push({ hex: accent, role: 'accent', name: 'accent' });
  let n = 0;
  for (const h of rest) {
    if (h === accent) continue;
    named.push({ hex: h, role: n === 0 ? 'secondary' : 'neutral', name: `colour-${n + 2}` });
    n += 1;
  }
  return named;
}

// What the drawing is, before anybody is asked anything.
function read({ mark, wordmark }) {
  const master = mark || wordmark;
  if (!master) return { ok: false, why: 'no artwork was given.' };
  const doc = svgu.parse(master);
  const box = geo.inkBox(master);
  const parts = svgu.partsUsed(doc);
  const widths = svgu.strokeWidths(doc);
  const cols = palette([mark, wordmark]);

  // Every slot in the identity, not only the ones in the master. A colourway
  // repaints by slot and can only name the slots it was told about, so a slot
  // that lives in the logotype alone was never named — and the reverse lockup
  // painted the words in the colour of the ground they stand on. Five of the
  // thirty-two identities here draw one, and all five measured 1.00 to 1
  // against their own reverse ground.
  const docs = [mark, wordmark].filter(Boolean).map((src) => svgu.parse(src));
  const slots = [...new Set(docs.flatMap((d) => svgu.slotsUsed(d)))];

  // Whether a one-colour version of this would differ from the drawing: more
  // than one paint on its slots, or one that no colourway can name. Cutting a
  // "mono" for artwork that is already one flat colour writes the same file
  // under a second name — which counting slots rather than paints did, for
  // beaumont, whose four slots are all painted #1A1714.
  const kept = [...new Set(docs.flatMap((d) => svgu.gradientSlots(d)))];
  const paints = new Set();
  for (const d of docs) {
    svgu.eachPainted(d, (el) => {
      if (!el.getAttribute || !el.getAttribute('data-slot')) return;
      for (const attr of ['fill', 'stroke']) {
        const v = ((el.getAttribute(attr)) || '').trim();
        if (!v || v === 'none') continue;
        paints.add(/^url\(/.test(v) ? 'a paint server' : v.toUpperCase());
        return;
      }
    });
  }
  const pat = PAT.spec(master, { tile: 100 });
  return {
    ok: true,
    master: mark ? 'mark' : 'wordmark',
    hasBoth: !!(mark && wordmark),
    // What can be built from what was given: three of the four lockups need
    // both drawings. Said once, here, because it was said in four places — the
    // app handlers, this file, and the front door twice — and four copies of
    // one rule is three chances to offer a lockup that cannot be composed.
    lockups: mark && wordmark ? ['horizontal', 'stacked', 'mark', 'wordmark'] : [mark ? 'mark' : 'wordmark'],
    colours: roles(cols),
    foundColours: cols.length,
    parts,
    slots: slots.length ? slots : ['all'],
    kept,
    paints: paints.size,
    flatten: paints.size > 1 || kept.length > 0,
    strokes: widths,
    aspect: Number((box.w / box.h).toFixed(2)),
    floor: geo.minimumSize(master, { minStrokePx: 3, minStrokeMm: 0.8 }),
    pattern: pat.ok ? { motif: pat.motif.key, motifName: pat.motif.name,
      construction: pat.construction, why: pat.why } : null,
  };
}

// ------------------------------------------------------------ the questions

// Where an identity lives decides more of the package than anything else a
// person can tell the engine, and it is one question. Each answer switches on
// the formats, the sizes and the making that go with it.
const PLACES = {
  screen: { name: 'On screens', note: 'Apps, sites, social. SVG and PNG at the sizes a browser and an app store ask for.',
    formats: ['svg', 'png'], pngWidths: [512, 1024, 2048], faviconSizes: [16, 32, 180] },
  print: { name: 'In print', note: 'Stationery, publications, packaging artwork. Adds true vector PDF and .ai, and holds every colour to an ink limit.',
    formats: ['svg', 'png', 'pdf', 'ai'], pngWidths: [1024, 2048], stock: 'coated' },
  signage: { name: 'On buildings and vehicles', note: 'Signs, wayfinding, livery. Adds cut vinyl and engraving, checked against what each process can hold.',
    formats: ['svg', 'png', 'pdf'], pngWidths: [1024], fabrication: [
      { process: 'vinyl', at: 400, note: 'the vehicle door' }, { process: 'engraving', at: 90, note: 'the door plate' }] },
  worn: { name: 'On things people wear and carry', note: 'Badges, garments, merchandise. Adds embroidery and foil at the sizes they are actually made at.',
    formats: ['svg', 'png', 'pdf'], pngWidths: [1024], fabrication: [
      { process: 'embroidery', at: 70, note: 'the chest badge' }, { process: 'foil', at: 40, note: 'the spine' }] },
};

// Which script a language is written in, and therefore which faces can set it.
// A document carries the identity's words and the engine's, and the engine's
// are 38 characters of Hebrew or 596 of Japanese — so a language is only on
// offer if something in fonts/ covers it. Nothing there has a CJK subset, which
// is why Japanese is shown and not available: yamabiko sets it from a font its
// own project ships, and the front door has no project to ship one in.
const SCRIPTS = { en: 'latin', fr: 'latin-ext', he: 'hebrew', ja: 'cjk' };

function covering(script) {
  const cat = require('./typefaces').catalogue();
  return Object.entries(cat)
    .filter(([, v]) => (v.faces || []).some((f) => f.subset === script))
    .map(([name]) => name);
}

// The faces this door sets each script in, said once. The language decides the
// type or the manual comes out in tofu: Archivo and Literata cannot draw a word
// of the Hebrew chrome, and Heebo and Frank Ruhl Libre are what maayan is set
// in for that reason. Both pairs are held in fonts/, which the test checks
// rather than trusting the names here.
const FACES = {
  hebrew: {
    display: { family: 'Heebo', weights: [500, 700], fallback: "'Noto Sans Hebrew',Arial,sans-serif" },
    text: { family: 'Frank Ruhl Libre', weights: [400], fallback: "'Noto Serif Hebrew',Georgia,serif" },
  },
  latin: {
    display: { family: 'Archivo', weights: [600, 700], fallback: 'Helvetica,Arial,sans-serif' },
    text: { family: 'Literata', weights: [400], fallback: 'Georgia,serif' },
  },
};
const facesFor = (language) => FACES[SCRIPTS[language] === 'hebrew' ? 'hebrew' : 'latin'];

// Every language strings.js writes, and whether this engine can set it.
function languages() {
  const HAVE = require('./strings').HAVE;
  return Object.keys(HAVE).map((code) => {
    const script = SCRIPTS[code] || 'latin';
    return { code, name: HAVE[code].name, dir: HAVE[code].dir, script,
      faces: covering(script), sets: facesFor(code) };
  });
}

function questions(seen) {
  const parts = seen.parts || [];
  const langs = languages();
  return [
    { key: 'brand', kind: 'text', ask: 'What is it called?',
      why: 'It goes on the cover, in every file name and in the machine readable file. Nothing else can supply it.',
      placeholder: 'Carrock' },

    { key: 'language', kind: 'pick-one', ask: 'What language should the book be written in?',
      why: 'Every word the engine writes — the chapter titles, the rules under the pictures, the '
        + 'captions on every measurement — comes out in this, and it sets the direction the pages '
        + 'read in. Your own words stay as you type them.',
      suggested: 'en',
      options: langs.map((l) => ({ value: l.code, label: l.name,
        note: l.faces.length
          ? `${l.dir === 'rtl' ? 'Right to left. ' : ''}Set in ${l.sets.display.family} and ${l.sets.text.family}.`
          : 'This engine holds no typeface that can draw it, so a package in it has to ship one '
            + 'of its own from a project file.',
        available: l.faces.length > 0 })) },

    { key: 'positioning', kind: 'line', ask: 'What does it do, in one line?',
      why: 'One sentence under the title of the manual, and the opening slide of the deck. Write it the way you '
        + 'would say it out loud.',
      placeholder: 'Carrock keeps the sound of a place after the place has changed.' },

    { key: 'style', kind: 'pick-one', ask: 'How should the book look?',
      why: 'Four layout systems, each drawn with your own logo so the choice is made by looking. They are not '
        + 'colour schemes: they change the scale the type is built on, the measure, how much air a specimen '
        + 'stands in and how a chapter opens.',
      suggested: D.DEFAULT,
      options: D.NAMES.map((k) => ({ value: k, label: D.DIRECTIONS[k].name, note: D.DIRECTIONS[k].note })) },

    { key: 'places', kind: 'pick-many', ask: 'Where does it mostly live?',
      why: 'This is the question that decides most of the package: which formats are cut, at what sizes, and '
        + 'which making processes the artwork is checked against. Everything here is answered by measuring, '
        + 'once you have said where.',
      suggested: ['screen'],
      options: Object.entries(PLACES).map(([k, v]) => ({ value: k, label: v.name, note: v.note })) },

    { key: 'colours', kind: 'confirm-colours', ask: 'These are the colours in your artwork. Which does what?',
      why: seen.foundColours
        ? `Read off the file — ${seen.foundColours} in the drawing. The engine has proposed a role for each: `
          + 'the darkest is what the mark is drawn in, the lightest is what it stands on, and the one furthest '
          + 'from grey is the one doing the work. Change any of them.'
        : 'Nothing in this file names a colour — the artwork is drawn in whatever it is placed on, or filled '
          + 'with a pattern or a gradient rather than a flat colour. So these are ink on paper, which is what '
          + 'a browser would draw it as. Change them to the ones this identity actually uses.',
      suggested: seen.colours },

    { key: 'never', kind: 'pick-many', ask: 'What must never be done to it?',
      why: 'Each of these is drawn on the misuse page with your own artwork — the treatment performed, not '
        + 'described. Pick the ones that matter for this identity; the engine has ticked the ones that apply '
        + 'to most.',
      suggested: suggestMisuse(seen),
      options: MIS.NAMES.map((k) => ({ value: k, label: k, note: MIS.TREATMENTS[k].draws,
        needs: MIS.TREATMENTS[k].needs === 'part' ? parts : null,
        available: MIS.TREATMENTS[k].needs !== 'part' || parts.length > 0 })) },
  ];
}

// The rules that apply to almost any identity, plus the ones this drawing makes
// possible. Ticked, not decided: a suggestion a designer unticks is a better
// question than a blank list.
function suggestMisuse(seen) {
  const out = ['stretch', 'recolour', 'crowd'];
  if ((seen.parts || []).length) out.push('redraw');
  if (seen.master === 'wordmark' || seen.hasBoth) out.push('retype');
  if (seen.floor && seen.floor.screenPx >= 48) out.push('undersize');
  else out.push('busy');
  return out;
}

// ------------------------------------------------------------- the project

// Six answers and a drawing, in the shape the loader already reads. Nothing
// here invents a number: what is not answered is measured, and what is neither
// is left out so the engine's own default applies and says so.
function toProject(answers, seen) {
  const a = answers || {};
  const places = (a.places && a.places.length ? a.places : ['screen']).filter((p) => PLACES[p]);
  const formats = [...new Set(places.flatMap((p) => PLACES[p].formats))];
  const pngWidths = [...new Set(places.flatMap((p) => PLACES[p].pngWidths))].sort((x, y) => x - y);
  const fabrication = places.flatMap((p) => PLACES[p].fabrication || []);
  const stock = places.map((p) => PLACES[p].stock).find(Boolean);
  const favicons = places.map((p) => PLACES[p].faviconSizes).find(Boolean);
  const cols = (a.colours && a.colours.length ? a.colours : seen.colours) || [];

  const never = (a.never || suggestMisuse(seen))
    .filter((k) => MIS.TREATMENTS[k])
    .filter((k) => MIS.TREATMENTS[k].needs !== 'part' || (seen.parts || []).length)
    .map((k) => (MIS.TREATMENTS[k].needs === 'part' ? { do: k, part: seen.parts[0] } : { do: k }));

  // The shape of a project file is decided in one place. Six answers become
  // the options that place already takes, rather than a second opinion about
  // what a project looks like that would drift from the first.
  const base = require('./app/handlers').projectJson({
    brand: a.brand || 'Untitled',
    mark: seen.master === 'mark' || seen.hasBoth, wordmark: seen.master === 'wordmark' || seen.hasBoth,
    colours: cols.map((c) => ({ name: c.name, hex: c.hex, role: c.role })),
    language: a.language && require('./strings').HAVE[a.language] ? a.language : undefined,
    lockups: seen.lockups,
    slots: seen.slots,
    flatten: seen.flatten,
    content: { positioning: a.positioning || undefined, misuse: never },
  });

  // and then only what the six answers actually decide
  base.style = a.style && D.DIRECTIONS[a.style] ? a.style : undefined;
  base.rules.formats = formats;
  base.rules.pngWidths = pngWidths;
  if (favicons) base.rules.faviconSizes = favicons;
  if (stock) base.rules.stock = stock;
  if (fabrication.length) base.rules.fabrication = fabrication;
  return base;
}

module.exports = { read, questions, toProject, palette, roles, languages, facesFor, PLACES, suggestMisuse };
