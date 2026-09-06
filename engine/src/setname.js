'use strict';
// A name that is set rather than drawn.
//
// Twenty identities and every one of them had a wordmark — a drawing of the
// name, artwork, fixed. The thirteenth round found the engine refusing the most
// common kind of identity, a logotype with no symbol. This is the mirror, and
// it is at least as common: Nike, Apple, Shell, Target, the Olympic rings. A
// mark that stands alone, and a name that is simply set in the brand's face
// when it is needed.
//
// For those the lockup is not two pieces of artwork. It is the mark, and the
// name set at a stated size and distance, which is a rule rather than a file —
// and the single most important thing the manual has to say. There was nowhere
// in a project to say it, so the engine could take the mark and had nothing to
// tell anybody about the name.
//
// This outlines the name from the face the project ships, at the size and
// tracking the rule states, and hands back a wordmark. Everything downstream —
// the lockups, the package, the documents — then works exactly as it does for
// an identity that drew one, because by then it has one.

const DEFAULTS = {
  family: 'display',        // which of tokens.type.families sets it
  weight: 700,
  // The drawn height of the name as a fraction of the mark's ink height, which
  // is how a designer states it: "the name is set at two thirds the mark". It
  // is the ink height rather than the cap height, because ink is what the
  // engine measures — identical for the uppercase most of these are set in, and
  // taller by the descenders when they are not. Saying "capHeight" would have
  // been the friendlier word and the wrong one.
  //
  // It is the same quantity as rules.wordmarkHeightRatio, and it replaces it
  // where the name is set. Two names for one number is how a project states a
  // size and gets the default — which is the fifteenth round's defect, and it
  // came back the moment a second way to say it existed.
  heightRatio: 0.62,
  tracking: 0.02,           // ems
  transform: 'none',        // none | uppercase
};

// The rule as it will be used, with everything it did not say filled in and
// nothing that was said overruled.
function resolve(project) {
  const raw = (project.system || {}).nameSetting;
  if (!raw) return null;
  const r = Object.assign({}, DEFAULTS, raw);
  r.declared = true;
  if (raw.capHeight !== undefined && raw.heightRatio === undefined) r.heightRatio = raw.capHeight;
  r.text = raw.text || project.brand;
  return r;
}

// Which font file to set it in: the family the rule names, at the weight it
// asks for, or the nearest weight that was shipped.
function faceFor(project, rule) {
  const fam = (project.fonts || []).find((f) => f.role === rule.family);
  if (!fam || !fam.files.length) return null;
  const exact = fam.files.find((f) => Number(f.weight) === Number(rule.weight));
  if (exact) return { family: fam, file: exact };
  const near = fam.files.slice().sort((a, b) =>
    Math.abs(a.weight - rule.weight) - Math.abs(b.weight - rule.weight))[0];
  return { family: fam, file: near };
}

// Why it cannot be done, in the language everything else uses, or null.
function refuse(project, rule) {
  const families = Object.keys(((project.tokens || {}).type || {}).families || {});
  if (!families.includes(rule.family)) {
    return { what: `The name is set in "${rule.family}", and there is no such typeface in this project.`,
      why: 'The rule names a family from tokens.type.families and that is not one of them.',
      how: `Use one of ${families.join(', ') || 'the families you declare'}, or add it.` };
  }
  if (!faceFor(project, rule)) {
    return { what: `The name is set in "${rule.family}", and no font file was shipped for it.`,
      why: 'A name that is set has to be outlined from the real face, or the logo is a request for a'
        + ' font that the reader may not have. The engine will not guess at letterforms.',
      how: `Add "files" to tokens.type.families.${rule.family} with the webfont you are licensed to`
        + ' ship, the same way an identity ships the face it is set in.' };
  }
  if (!String(rule.text || '').trim()) {
    return { what: 'The name to set is empty.', why: 'There is nothing to outline.',
      how: 'Give the project a brand name, or set system.nameSetting.text.' };
  }
  return null;
}

// The wordmark, drawn. Outlined from the shipped face so no font is needed to
// render it — which is the whole reason a wordmark is artwork in the first
// place, and stays true when the engine is the one drawing it.
function wordmark(project, rule, opentype, ink) {
  const picked = faceFor(project, rule);
  const buf = Buffer.from(picked.file.src.split(',')[1], 'base64');
  const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const text = rule.transform === 'uppercase' ? String(rule.text).toUpperCase() : String(rule.text);
  const SIZE = 1000;                       // outline large, then state the box
  let x = 0; const paths = [];
  for (const ch of text) {
    const g = font.charToGlyph(ch);
    paths.push(g.getPath(x, 0, SIZE));
    x += (g.advanceWidth / font.unitsPerEm) * SIZE * (1 + Number(rule.tracking || 0));
  }
  const box = paths.reduce((a, p) => {
    const t = p.getBoundingBox();
    return { x1: Math.min(a.x1, t.x1), y1: Math.min(a.y1, t.y1),
      x2: Math.max(a.x2, t.x2), y2: Math.max(a.y2, t.y2) };
  }, { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity });
  if (!isFinite(box.x1)) return null;      // nothing in the string draws
  const r = (n) => Math.round(n * 100) / 100;
  const w = r(box.x2 - box.x1), h = r(box.y2 - box.y1);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n`
    + `<!-- Set, not drawn: ${text} in ${picked.family.family} ${picked.file.weight}, tracking `
    + `${rule.tracking}. Outlined at build time from the face this project ships, so the file needs `
    + `no font to render. Change the rule and this is redrawn; do not edit it by hand. -->\n`
    + `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">\n`
    + `  <g data-slot="ink" fill="${ink || '#111111'}" transform="translate(${r(-box.x1)} ${r(-box.y1)})">\n    `
    + paths.map((p) => `<path d="${p.toPathData(2)}"/>`).join('\n    ')
    + `\n  </g>\n</svg>\n`;
  return { svg, width: w, height: h, text, family: picked.family.family, weight: picked.file.weight };
}

module.exports = { DEFAULTS, resolve, faceFor, refuse, wordmark };
