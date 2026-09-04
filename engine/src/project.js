'use strict';
const fs = require('fs');
const path = require('path');

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
  return { brand: raw.brand, version: raw.version || '0.0.0', dir, tokens: raw.tokens || {}, assets, rules };
}

module.exports = { load, DEFAULTS };
