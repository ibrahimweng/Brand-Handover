'use strict';
// The typefaces the engine has, and where they came from.
//
// A `google: true` family used to become a <link> to fonts.googleapis.com. Three
// things were wrong with that and only one of them is about privacy. The
// document did not work without a network — open a manual on a plane and the
// identity is set in Georgia. The package was not self contained, so the one
// promise the whole engine is built on ("the client keeps this whether or not
// anyone is still paying for the tool that made it") was not true of the type.
// And a build was not reproducible, because the bytes came from somebody else's
// server and could change.
//
// So the faces are vendored. `fonts/` holds the woff2 files and a manifest of
// which weight and which unicode subset each one covers; they are inlined into
// every document as data URIs and written into 09-type for the client's own use.
// Nothing is fetched at render time and nothing is fetched at build time.
//
// A family the engine does not have and the project does not ship is refused by
// name rather than linked to and hoped for.
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'fonts');
let CATALOGUE = null;

function catalogue() {
  if (CATALOGUE) return CATALOGUE;
  let man = {};
  try { man = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8')); }
  catch (e) { man = {}; }
  CATALOGUE = man;
  return CATALOGUE;
}

const NAMES = () => Object.keys(catalogue());
const has = (family) => !!catalogue()[String(family)];

// Every subset of a family the engine holds, at the weights asked for.
function filesFor(family, weights) {
  const fam = catalogue()[String(family)];
  if (!fam) return [];
  const want = new Set((weights && weights.length ? weights : [400]).map(Number));
  // A weight that was not vendored falls to the nearest one that was, rather
  // than to nothing: a missing 600 should be a slightly wrong weight, not a
  // heading in Helvetica.
  const have = [...new Set(fam.faces.map((f) => f.weight))].sort((a, b) => a - b);
  const nearest = (w) => have.reduce((best, h) =>
    (Math.abs(h - w) < Math.abs(best - w) ? h : best), have[0]);
  const use = new Set([...want].map((w) => (have.indexOf(w) > -1 ? w : nearest(w))));
  return fam.faces.filter((f) => use.has(f.weight));
}

// The bytes, as a data URI. Read once per file per build.
const CACHE = new Map();
function dataUri(file) {
  if (CACHE.has(file)) return CACHE.get(file);
  const buf = fs.readFileSync(path.join(DIR, file));
  const uri = `data:font/woff2;base64,${buf.toString('base64')}`;
  CACHE.set(file, uri);
  return uri;
}

// Which subsets a document actually needs.
//
// Embedding every subset of every weight puts about half a megabyte of Latin
// Extended into a document written entirely in English. The unicode-range in an
// @font-face stops a browser DOWNLOADING a subset it does not need, and a data
// URI is already downloaded, so the range saves nothing here — the filtering has
// to happen before the bytes go in. Which characters a document contains is a
// fact about the document, so it is measured rather than assumed.
function rangeCovers(range, text) {
  if (!range) return true;
  for (const part of range.split(',')) {
    const p = part.trim().replace(/^U\+/i, '');
    const [a, b] = p.split('-');
    const lo = parseInt(a, 16);
    const hi = b ? parseInt(b, 16) : lo;
    if (!isFinite(lo)) continue;
    for (const ch of text) {
      const c = ch.codePointAt(0);
      if (c >= lo && c <= hi) return true;
    }
  }
  return false;
}

// Everything a document needs to set the identity in its own face, inlined.
function embed(type, text) {
  const fams = Object.values((type && type.families) || {}).filter((f) => f.family);
  const seen = new Set();
  const blocks = [];
  const used = [];
  for (const f of fams) {
    if (!has(f.family)) continue;
    for (const face of filesFor(f.family, f.weights)) {
      const key = `${f.family}|${face.weight}|${face.subset}`;
      if (seen.has(key)) continue;
      seen.add(key);
      // latin is always carried: it is what the document's own words are in
      if (face.subset !== 'latin' && text != null && !rangeCovers(face.unicodeRange, text)) continue;
      blocks.push(`@font-face{font-family:'${String(f.family).replace(/'/g, '')}';font-style:normal;`
        + `font-weight:${face.weight};font-display:swap;`
        + `src:url(${dataUri(face.file)}) format('woff2')`
        + `${face.unicodeRange ? `;unicode-range:${face.unicodeRange}` : ''}}`);
      used.push(Object.assign({ family: f.family }, face));
    }
  }
  return { css: blocks.join('\n'), used };
}

// A family that is named, is not one of ours, and is not shipped with the
// project. It will be asked for by name and quietly replaced by the fallback.
function missing(type, fonts) {
  const shipped = new Set((fonts || []).map((f) => f.role));
  const out = [];
  for (const [role, f] of Object.entries((type && type.families) || {})) {
    if (has(f.family) || shipped.has(role)) continue;
    out.push({ role, family: f.family, fallback: f.fallback || '' });
  }
  return out;
}

module.exports = { catalogue, NAMES, has, filesFor, dataUri, embed, missing, rangeCovers, DIR };
