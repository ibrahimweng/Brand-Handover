'use strict';
// How a typeface reaches a document, decided once.
//
// For sixteen rounds every fixture declared `google: true`, so the only path
// that had ever run was a link to a font somebody else hosts. An identity built
// on a licensed face — which is most of them — reached no document at all: the
// family was named in the CSS, no @font-face was ever written, and every page
// fell through to its fallback while the manual's specimen carried the licensed
// name above type set in Georgia. A specimen showing the wrong face is worse
// than no specimen, because it is offered as proof.
//
// Four documents used to answer this question in two places and now answer it
// here, so the manual, the deck, the published page and the canvas cannot
// disagree about what the identity is set in.

// A font shipped with the project, inlined. The documents are meant to survive
// being emailed, so a relative href to a font file would break the moment one
// was moved — which is the same reason images are inlined.
function faces(fonts) {
  const out = [];
  for (const fam of fonts || []) {
    for (const f of fam.files) {
      out.push(`@font-face{font-family:'${fam.family.replace(/'/g, '')}';`
        + `font-style:${f.style};font-weight:${f.weight};font-display:swap;`
        + `src:url(${f.src}) format('${f.format}')}`);
    }
  }
  return out.join('\n');
}

// A face the engine holds, inlined the same way as one the project ships.
//
// This used to be a <link> to fonts.googleapis.com. Three things were wrong with
// it and only one of them is about privacy: the document did not work without a
// network, so a manual opened on a plane was set in Georgia; the package was not
// self contained, which is the one promise the whole engine is built on; and the
// build was not reproducible, because the bytes came from somebody else's server
// and could change. The faces are vendored now. See src/typefaces.js.
function ours(type, text, listOnly) {
  const got = require('./typefaces').embed(type, text);
  if (!listOnly) return got.css;
  const out = [];
  for (const u of got.used) if (out.indexOf(u.family) < 0) out.push(u.family);
  return out;
}

// Everything the head of a document needs to set the identity in its own face.
// `text` is the document's own words, so only the character subsets it actually
// contains are carried: an English manual takes four faces and a French one
// eight, because French needs Latin Extended and English does not.
// Every family this document will actually have, as a list a stack can end
// with.
//
// A document sets its own furniture in a stack of names — Schibsted Grotesk,
// Helvetica Neue, Helvetica, Arial, sans-serif — and not one of them is a face
// the package carries. So the words on it are drawn by whatever the reader
// happens to own: measured through Chromium, 1.8 per cent of the glyphs on
// Meridian's manual came out of a file in its own package. For an English
// document that is a neutral system stack behaving as designed. For a Japanese
// or a Hebrew one it is a promise the package cannot keep — none of those four
// names holds a single CJK or Hebrew glyph, so the whole document depends on
// the reader owning a font, in a package whose one promise is that it opens
// with no network at all. Yamabiko came out at 1.0 per cent.
//
// The faces were in the package the whole time. Ending each stack with them
// costs no bytes and overrides nothing the reader has: it is only reached for a
// character every name before it lacks. That takes Yamabiko to 94.4 per cent.
//
// Undefined where there are no faces, so `var(--pkg, sans-serif)` falls to the
// generic each stack chooses for itself rather than putting a sans in a
// monospace stack.
function stack(type, fonts, text) {
  const names = [];
  for (const f of fonts || []) if (f.family && names.indexOf(f.family) < 0) names.push(f.family);
  for (const f of ours(type, text, true)) if (names.indexOf(f) < 0) names.push(f);
  return names;
}

// Everything the head of a document needs to set the identity in its own face.
function head(type, fonts, text) {
  const css = [ours(type, text), faces(fonts)].filter(Boolean).join('\n');
  if (!css) return '';
  const names = stack(type, fonts, text);
  const pkg = names.length
    ? `\n:root{--pkg:${names.map((n) => `'${String(n).replace(/'/g, '')}'`).join(',')}}`
    : '';
  return `<style>\n${css}${pkg}\n</style>`;
}

// Which families are named but cannot arrive. A face that is neither one of ours
// nor shipped with the project will be asked for by name and silently replaced
// by the fallback, and the document will go on saying it is the face.
function unreachable(type, fonts) {
  return require('./typefaces').missing(type, fonts);
}

// Which characters a document sets that the faces it ships cannot draw.
//
// `unreachable` asks whether a family can arrive at all. This asks the question
// after it has: a font can arrive and still have nothing to draw with. Yamabiko
// ships IPAGothic subsetted to the characters its own content sets — 210 of
// them, 59 KB instead of several megabytes, which is the right thing to do and
// the reason the package opens with no network at all. But a subset is subset
// to what somebody knew about when they cut it, and a document sets more than
// the project's own words: it sets the engine's, and the engine's words change.
//
// One character was already wrong. 立ち会いは一枚ずつ行います。 is in the
// project file and 行 is not in the font, so that character in that sentence has
// been drawn by whatever the reader happened to have installed since the round
// the font arrived. Nothing said so, because a missing glyph is not an error: a
// browser silently falls through to the next family and the page goes on
// claiming to be set in the face.
//
// Only characters outside ASCII are asked about. The faces the engine holds
// cover Latin, so a document is never left without those; what a project ships
// is what carries everything else.
const COVER = new Map();
function covers(file) {
  if (COVER.has(file.path)) return COVER.get(file.path);
  let set = null;
  try {
    const bytes = require('fs').readFileSync(file.path);
    const font = require('opentype.js').parse(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    const map = font.tables.cmap && font.tables.cmap.glyphIndexMap;
    if (map) set = new Set(Object.keys(map).map(Number));
  } catch (_) { set = null; }   // a font this cannot read is one it cannot judge
  COVER.set(file.path, set);
  return set;
}

function cannotDraw(fonts, text) {
  const sets = [];
  for (const fam of fonts || []) for (const f of fam.files || []) {
    if (!f.path) continue;
    const c = covers(f);
    if (c) sets.push(c);
  }
  if (!sets.length) return [];
  const out = [];
  const seen = new Set();
  for (const ch of String(text)) {
    const c = ch.codePointAt(0);
    if (c < 0x80 || seen.has(c)) continue;
    seen.add(c);
    if (!sets.some((s) => s.has(c))) out.push(ch);
  }
  return out;
}

module.exports = { faces, ours, head, stack, unreachable, cannotDraw };
