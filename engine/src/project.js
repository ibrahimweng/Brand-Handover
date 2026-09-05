'use strict';
const fs = require('fs');
const path = require('path');
const { normalise } = require('./normalise');
const contrast = require('./contrast');
const naming = require('./naming');

const DEFAULTS = {
  clearSpaceRatio: 0.25,
  minStrokePx: 2.4,
  minStrokeMm: 0.675,
  lockupGapRatio: 0.36,
  wordmarkHeightRatio: 0.34,
  formats: ['svg', 'png'],
  pngWidths: [512, 1024],
  naming: '{brand}-{lockup}-{colourway}',
};

function load(file) {
  const dir = path.dirname(path.resolve(file));
  let raw;
  try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { throw new Error(`could not read the project file at ${file}: ${e.message}`); }

  const problems = [];
  if (!raw.brand) problems.push('the project has no "brand" name');
  if (!raw.assets || !raw.assets.mark) problems.push('the project does not say where the master mark is (assets.mark)');
  if (!raw.rules || !Array.isArray(raw.rules.colourways) || !raw.rules.colourways.length) {
    problems.push('the project defines no colourways (rules.colourways)');
  }
  if (!raw.rules || !Array.isArray(raw.rules.lockups) || !raw.rules.lockups.length) {
    problems.push('the project defines no lockups (rules.lockups)');
  }
  if (problems.length) throw new Error('This project file is not usable yet:\n  - ' + problems.join('\n  - '));

  // A designer may write a colour however their tool writes it. Everything
  // downstream — contrast, ink builds, the printed piece, the canvas — read
  // six-digit hex and produced NaN for anything else, and a NaN ratio compares
  // false against every threshold, so brand.json told the client that every
  // pair in their palette was "Never for text". Canonicalise once, here.
  const canon = (v, where) => {
    const hex = contrast.toHex(v);
    if (hex === null) {
      throw new Error(`${where} is "${v}", which is not a colour this can read.`
        + ' Use a hex value like #1B3A6B, or rgb(), or hsl().');
    }
    return hex;
  };
  for (const [name, c] of Object.entries(raw.tokens && raw.tokens.colour ? raw.tokens.colour : {})) {
    c.hex = canon(c.hex, `the colour "${name}"`);
  }
  for (const cw of (raw.rules && raw.rules.colourways) || []) {
    for (const slot of Object.keys(cw.slots || {})) {
      cw.slots[slot] = canon(cw.slots[slot], `colourway "${cw.name}" slot "${slot}"`);
    }
  }
  for (const key of ['iconInk', 'iconBg']) {
    if (raw.rules && raw.rules[key]) raw.rules[key] = canon(raw.rules[key], `rules.${key}`);
  }

  // A brand name does not have to be spellable in a-z. The namer already knew
  // that and told the designer to "give the project a latinName" — which
  // nothing read, so an identity named in Hebrew, Greek, Cyrillic, Arabic or
  // anything else could not be built at all, and was told to do something that
  // would not have helped. Romanising a name is the designer's decision, not
  // an algorithm's, so it is asked for and used, and asked for here rather
  // than three quarters of the way through writing a package.
  const latinName = raw.latinName || (naming.slug(raw.brand) ? raw.brand : null);
  if (!latinName) {
    throw new Error(`the brand name "${raw.brand}" has no letters a file name can carry.`
      + ' Add "latinName" to the project — the roman spelling the files should be named after,'
      + ' for example "latinName": "Maayan". It names files only; the documents keep the real name.');
  }

  // Every document declared itself English and laid itself out left to right,
  // whatever was in it. A Hebrew manual told a screen reader to say Hebrew in
  // an English voice. The chrome of these documents is written in English and
  // translating it is not done here — but the language of the identity's own
  // words, and the direction they read in, belong to the project.
  const RTL = ['he', 'iw', 'ar', 'fa', 'ur', 'yi', 'ps', 'dv', 'ckb', 'sd', 'ug'];
  const language = raw.language || 'en';
  const direction = raw.direction
    || (RTL.indexOf(String(language).toLowerCase().split('-')[0]) > -1 ? 'rtl' : 'ltr');

  const rules = Object.assign({}, DEFAULTS, raw.rules);
  const assets = {};
  for (const [key, rel] of Object.entries(raw.assets)) {
    const p = path.join(dir, rel);
    if (!fs.existsSync(p)) throw new Error(`the project points at ${rel} for the ${key}, and that file is not there`);
    assets[key] = { path: p, source: fs.readFileSync(p, 'utf8') };
  }
  if (rules.lockups.some((l) => l === 'horizontal' || l === 'stacked' || l === 'wordmark') && !assets.wordmark) {
    throw new Error('this project asks for a lockup that needs a wordmark, but assets.wordmark is not set');
  }

  // Every piece of artwork goes through the normaliser before anything measures
  // it, so a messy export is caught here rather than halfway through a build.
  const tokens = raw.tokens || {};
  const report = {};
  for (const [key, asset] of Object.entries(assets)) {
    const n = normalise(asset.source, { tokens });
    report[key] = n.findings;
    if (!n.ok) {
      const err = new Error(`the ${key} artwork cannot be used yet`);
      err.findings = n.findings;
      err.asset = key;
      throw err;
    }
    asset.source = n.svg;          // downstream only ever sees normalised artwork
    asset.slots = n.slots;
  }

  // system and content are carried through untouched. They were being dropped
  // here, which meant every rule override in a project file was read as absent
  // and the defaults quietly won. Nothing complained, because a default is a
  // perfectly good answer right up until somebody wanted a different one.
  return { brand: raw.brand, latinName, language, direction, version: raw.version || '0.0.0', dir, tokens, assets, rules,
    system: raw.system || {}, content: raw.content || {}, report };
}

module.exports = { load, DEFAULTS };
