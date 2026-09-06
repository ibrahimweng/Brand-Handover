'use strict';
const fs = require('fs');
const path = require('path');
const { normalise } = require('./normalise');
const contrast = require('./contrast');
const naming = require('./naming');
const svgu = require('./svg');

// The pixel size, read from the file's own header. A photograph placed at a size
// the engine does not know is a photograph the engine cannot say is too small
// for the page it is on.
function pixelSize(buf, mime) {
  if (mime === 'image/png') {
    if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  if (mime === 'image/jpeg') {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xFF) { i += 1; continue; }
      const m = buf[i + 1];
      if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
        return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
    return null;
  }
  if (mime === 'image/webp') {
    // the plain VP8X header carries the canvas size, which is all this needs
    if (buf.length < 30 || buf.toString('latin1', 8, 12) !== 'WEBP') return null;
    if (buf.toString('latin1', 12, 16) === 'VP8X') {
      return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
    }
    return null;
  }
  return null;
}

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
  // An identity does not have to have a symbol. Google, FedEx, Braun and most
  // of the publishing world are a logotype and nothing else, and every one of
  // the twelve projects here happened to have both — so the engine refused the
  // commonest kind of identity there is, naming a missing field rather than the
  // problem, with nothing to do about it. Either asset may be the master.
  if (!raw.assets || (!raw.assets.mark && !raw.assets.wordmark)) {
    problems.push('the project does not say where the master artwork is. Set assets.mark for a '
      + 'symbol, assets.wordmark for a logotype, or both.');
  }
  if (!raw.rules || !Array.isArray(raw.rules.colourways) || !raw.rules.colourways.length) {
    problems.push('the project defines no colourways (rules.colourways)');
  }
  if (!raw.rules || !Array.isArray(raw.rules.lockups) || !raw.rules.lockups.length) {
    problems.push('the project defines no lockups (rules.lockups)');
  }
  // Eight rounds of checking the artwork, and the engine took its own numbers
  // entirely on faith. minStrokePx of -3 gave a smallest usable size of -40 px;
  // a clearSpaceRatio of -0.5 gave negative clear space; and a naming pattern
  // with no {colourway} in it wrote all five colourways of a lockup to the same
  // filename, so the client got one file where the manual promised five, with
  // nothing said. A rule that cannot be true is as much a defect as a mark that
  // cannot be drawn, and it was the half nobody was reading.
  const r = raw.rules || {};
  const positive = {
    minStrokePx: 'the smallest a stroke may be on screen',
    minStrokeMm: 'the smallest a stroke may be in print',
    clearSpaceRatio: 'clear space, as a fraction of the mark',
    wordmarkHeightRatio: 'how tall the wordmark sits beside the mark',
  };
  for (const [key, what] of Object.entries(positive)) {
    if (r[key] === undefined) continue;
    if (!(Number(r[key]) > 0)) {
      problems.push(`rules.${key} is ${JSON.stringify(r[key])} — ${what} has to be more than nothing.`
        + ' Every number derived from it comes out as zero or as a negative.');
    }
  }
  if (r.lockupGapRatio !== undefined && !(Number(r.lockupGapRatio) >= 0)) {
    problems.push(`rules.lockupGapRatio is ${JSON.stringify(r.lockupGapRatio)}, which would sit the`
      + ' wordmark on top of the mark rather than beside it.');
  }
  for (const w of r.pngWidths || []) {
    if (!(Number(w) > 0)) problems.push(`rules.pngWidths contains ${JSON.stringify(w)}, which is not a width.`);
  }
  const names = (r.colourways || []).map((c) => c && c.name);
  const dupe = names.find((n, i) => names.indexOf(n) !== i);
  if (dupe !== undefined) {
    problems.push(`two colourways are both called "${dupe}". Their files would be written over`
      + ' each other, and the second one would be the only one that survived.');
  }
  // whether the pattern can actually tell the files apart
  if (typeof r.naming === 'string' && Array.isArray(r.lockups) && Array.isArray(r.colourways)) {
    const want = [];
    if (r.lockups.length > 1 && !/\{lockup\}/.test(r.naming)) want.push('{lockup}');
    if (r.colourways.length > 1 && !/\{colourway\}/.test(r.naming)) want.push('{colourway}');
    if (want.length) {
      problems.push(`rules.naming is "${r.naming}", which does not tell the files apart:`
        + ` ${r.lockups.length} lockups in ${r.colourways.length} colourways would all be written`
        + ` to the same handful of names. Put ${want.join(' and ')} in the pattern.`);
    }
  }

  // Eight rounds of checking the artwork and the rules, and `tokens.type` was
  // never looked at once. A scale written as `{ base: 16, ratio: 1.25 }` — which
  // is how a designer would write a type scale if you asked them cold — got as
  // far as the document layer and came back as
  // `(t.scale || []).map is not a function`. A crash is not a refusal.
  const type = (raw.tokens || {}).type;
  if (type !== undefined) {
    if (typeof type !== 'object' || Array.isArray(type)) {
      problems.push('tokens.type is not an object. It holds "families" and "scale".');
    } else {
      const fams = type.families;
      if (fams !== undefined && (typeof fams !== 'object' || Array.isArray(fams))) {
        problems.push('tokens.type.families is not an object. It maps a role — display, text, mono —'
          + ' to a typeface, like "display": { "family": "Archivo", "google": true }.');
      } else {
        for (const [role, f] of Object.entries(fams || {})) {
          if (!f || typeof f !== 'object') {
            problems.push(`tokens.type.families.${role} is not an object.`); continue;
          }
          if (!f.family || typeof f.family !== 'string') {
            problems.push(`the ${role} typeface has no "family" name, so every document would ask`
              + ' the browser for nothing and quietly set whatever it had.');
          }
          if (f.weights !== undefined && !Array.isArray(f.weights)) {
            problems.push(`tokens.type.families.${role}.weights is not a list of numbers.`);
          }
        }
      }
      if (type.scale !== undefined) {
        if (!Array.isArray(type.scale)) {
          problems.push('tokens.type.scale is not a list. It is the type scale in order —'
            + ' [{ "name": "H1", "family": "display", "size": 38, "leading": 42, "weight": 600 }, ...] —'
            + ' because a document sets named steps, not a base and a ratio.');
        } else {
          for (const [i, step] of type.scale.entries()) {
            const at = `tokens.type.scale[${i}]`;
            if (!step || typeof step !== 'object') { problems.push(`${at} is not an object.`); continue; }
            if (!step.name) problems.push(`${at} has no "name", so nothing can ask for it by name.`);
            if (!(Number(step.size) > 0)) {
              problems.push(`${at} ("${step.name || '?'}") has a size of ${JSON.stringify(step.size)},`
                + ' which is not a size anything can be set at.');
            }
            if (step.family && fams && !fams[step.family]) {
              problems.push(`${at} ("${step.name || '?'}") is set in "${step.family}", and`
                + ` tokens.type.families has ${Object.keys(fams).join(', ') || 'nothing'} in it.`);
            }
          }
        }
      }
    }
  }

  if (problems.length) throw new Error('This project file is not usable yet:\n  - ' + problems.join('\n  - '));

  // A designer may write a colour however their tool writes it. Everything
  // downstream — contrast, ink builds, the printed piece, the canvas — read
  // six-digit hex and produced NaN for anything else, and a NaN ratio compares
  // false against every threshold, so brand.json told the client that every
  // pair in their palette was "Never for text". Canonicalise once, here.
  const canon = (v, where, also = '') => {
    const hex = contrast.toHex(v);
    if (hex === null) {
      throw new Error(`${where} is "${v}", which is not a colour this can read.`
        + ' Use a hex value like #1B3A6B, or rgb(), or hsl().' + also);
    }
    return hex;
  };
  for (const [name, c] of Object.entries(raw.tokens && raw.tokens.colour ? raw.tokens.colour : {})) {
    c.hex = canon(c.hex, `the colour "${name}"`);
  }
  for (const cw of (raw.rules && raw.rules.colourways) || []) {
    for (const slot of Object.keys(cw.slots || {})) {
      // "keep" is not a colour and is not meant to be: it says leave this slot
      // painted as the master drew it, which is the only way to carry a
      // gradient through a colourway.
      if (String(cw.slots[slot]).trim().toLowerCase() === svgu.KEEP) {
        cw.slots[slot] = svgu.KEEP;
        continue;
      }
      cw.slots[slot] = canon(cw.slots[slot], `colourway "${cw.name}" slot "${slot}"`,
        ' Write "keep" to leave the slot painted as the master drew it.');
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
  // Photographs a project ships. Every fixture until now had none, because the
  // only way a photograph could reach the engine was somebody dropping one into
  // the editor by hand — so a brand package could not contain the art directed
  // pictures the identity is built on, and the manual's photography page had
  // nothing to show but a grey ramp.
  const photography = [];
  for (const [key, rel] of Object.entries(raw.assets)) {
    if (key === 'photography') continue;
    const p = path.join(dir, rel);
    if (!fs.existsSync(p)) throw new Error(`the project points at ${rel} for the ${key}, and that file is not there`);
    assets[key] = { path: p, source: fs.readFileSync(p, 'utf8') };
  }
  const PHOTO = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
  for (const entry of raw.assets.photography || []) {
    const rel = typeof entry === 'string' ? entry : entry.file;
    const p = path.join(dir, rel);
    if (!fs.existsSync(p)) throw new Error(`the project lists ${rel} under assets.photography, and that file is not there`);
    const mime = PHOTO[path.extname(p).toLowerCase()];
    if (!mime) {
      throw new Error(`assets.photography lists ${rel}, which is not a photograph. `
        + `Use ${Object.keys(PHOTO).join(', ')}. Artwork goes in assets.mark or assets.wordmark.`);
    }
    const bytes = fs.readFileSync(p);
    const size = pixelSize(bytes, mime);
    if (!size) throw new Error(`${rel} could not be read as a ${mime.split('/')[1]}, so its size is unknown`);
    photography.push({ file: rel, path: p, mime, bytes: bytes.length,
      w: size.w, h: size.h, src: `data:${mime};base64,${bytes.toString('base64')}`,
      caption: (typeof entry === 'object' && entry.caption) || '' });
  }
  // ---- the typeface the identity is actually set in ----
  // Every fixture for sixteen rounds declared google: true, so the only path
  // that had ever run was a link to a font somebody else hosts. A brand built
  // on a licensed face — which is most of them — reached no document at all:
  // the family was named in the CSS, no @font-face was ever written, and the
  // page fell through to the fallback while the manual's specimen page carried
  // the licensed name above type set in Georgia. A specimen that shows the
  // wrong face is worse than no specimen, because it is offered as proof.
  const FONT = { '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf' };
  const FORMAT = { '.woff2': 'woff2', '.woff': 'woff', '.ttf': 'truetype', '.otf': 'opentype' };
  const fonts = [];
  for (const [role, fam] of Object.entries(((raw.tokens || {}).type || {}).families || {})) {
    const carried = [];
    for (const entry of fam.files || []) {
      const rel = typeof entry === 'string' ? entry : entry.file;
      const fp = path.join(dir, rel);
      if (!fs.existsSync(fp)) {
        throw new Error(`the ${role} typeface lists ${rel}, and that file is not there.`);
      }
      const ext = path.extname(fp).toLowerCase();
      if (!FONT[ext]) {
        throw new Error(`the ${role} typeface lists ${rel}, which is not a font file. `
          + `Use ${Object.keys(FONT).join(', ')}. A .pfb or a .dfont cannot be shown in a browser.`);
      }
      const bytes = fs.readFileSync(fp);
      carried.push({
        file: rel, path: fp, mime: FONT[ext], format: FORMAT[ext], bytes: bytes.length,
        weight: (typeof entry === 'object' && entry.weight) || 400,
        style: (typeof entry === 'object' && entry.style) || 'normal',
        src: `data:${FONT[ext]};base64,${bytes.toString('base64')}`,
      });
    }
    if (carried.length) fonts.push({ role, family: fam.family, licence: fam.licence || '', files: carried });
  }

  const needs = { horizontal: ['mark', 'wordmark'], stacked: ['mark', 'wordmark'], mark: ['mark'], wordmark: ['wordmark'] };
  for (const l of rules.lockups) {
    const want = (needs[l] || []).filter((a) => !assets[a]);
    if (!want.length) continue;
    throw new Error(`this project asks for the ${l} lockup, which needs `
      + `${want.map((a) => `assets.${a}`).join(' and ')}, and ${want.length > 1 ? 'they are' : 'it is'} not set. `
      + `With ${Object.keys(assets).map((a) => `assets.${a}`).join(' and ')} the lockups available are `
      + `${Object.keys(needs).filter((k) => needs[k].every((a) => assets[a])).join(', ') || 'none'}.`);
  }

  // Which asset every measurement is taken from. With both, it is the mark, as
  // it always was; with only a logotype, it is the logotype. Sixteen places in
  // the engine reached for assets.mark meaning "the master", which is the same
  // thing right up until a project has no symbol.
  const master = assets.mark ? 'mark' : 'wordmark';

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
  return { brand: raw.brand, latinName, language, direction, version: raw.version || '0.0.0', dir, tokens, assets, photography, fonts, rules, master,
    system: raw.system || {}, content: raw.content || {}, report };
}

// The artwork every measurement is taken from.
const masterOf = (project) => project.assets[project.master || (project.assets.mark ? 'mark' : 'wordmark')];

module.exports = { masterOf, load, DEFAULTS };
