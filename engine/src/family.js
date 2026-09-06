'use strict';
// A brand with brands inside it.
//
// Twenty-six identities, and every one of them is one thing. Real institutions
// are not: a group has museums in it, a university has faculties, a network has
// lines, and the hardest question any of them asks is the one this engine had no
// way to answer — what is a sub-brand allowed to be, and what does it inherit?
//
// The engine's own rule generalises straight up a level. One master, and
// everything derived from it: a sub-brand is the parent's mark and a stated
// difference, and the difference is a name, a colour and nothing else unless the
// project says otherwise. The lockup that results is composed here rather than
// drawn, so a sub-brand cannot drift.
//
// What it turns up is a number nobody has: an endorsed lockup carries a line of
// type — "Part of Harbourne" — set at a fraction of the mark's height, and that
// line is the finest thing in the drawing by a long way. The floor of the lockup
// is therefore set by the words and not by the mark, and it is several times the
// mark's own. Every group brand in the world has this and none of them measures
// it, because the mark is what gets checked.
const svgu = require('./svg');
const geo = require('./geometry');

const DEFAULTS = {
  nameRatio: 0.42,        // the sub-brand's name, as a fraction of the mark's ink height
  endorsementRatio: 0.16, // the line that says whose it is
  gapRatio: 0.34,         // between the mark and the words
  leadRatio: 0.2,         // between the name and the endorsement line
  endorsement: 'Part of {brand}',
  readableAtPx: 5,        // the cap height below which a line of type is a smudge
};

const no = (code, what, why, how) => {
  const e = new Error(what);
  e.findings = [{ level: 'blocker', code, what, why, how }];
  throw e;
};

function rules(project) {
  const r = Object.assign({}, DEFAULTS, (project.rules && project.rules.family) || {});
  for (const k of ['nameRatio', 'endorsementRatio', 'gapRatio', 'leadRatio']) {
    if (!(Number(r[k]) > 0)) {
      no('family', `rules.family.${k} is ${JSON.stringify(r[k])}, and every measurement in a sub-brand `
        + 'lockup is a fraction of the mark.',
        'Set it to nothing and the part it sizes comes out at nothing, which is a lockup with a piece missing '
        + 'and no complaint about it.',
        `Give ${k} a number above zero, or leave it out and take the default.`);
    }
  }
  return r;
}

function load(raw, project) {
  const out = [];
  const palette = project.tokens.colour || {};
  for (const entry of raw || []) {
    if (!entry || !entry.name) {
      no('family', 'a sub-brand in tokens.family has no name.',
        'The name is the whole of the difference between a sub-brand and its parent, and it is what the '
        + 'lockup sets.',
        'Give every one a "name": { "name": "Maritime", "colour": "tide" }.');
    }
    if (!entry.colour || !palette[entry.colour]) {
      no('family', `the ${entry.name} sub-brand is set in "${entry.colour || 'nothing'}", `
        + 'which is not a colour in this palette.',
        'A sub-brand that brings its own colour is a separate identity wearing the parent\'s mark. The '
        + 'palette is what holds a family together, so the colour comes out of it.',
        `Use one of ${Object.keys(palette).join(', ')}, or add the colour to tokens.colour first.`);
    }
    out.push({ name: entry.name, colour: entry.colour, hex: palette[entry.colour].hex,
      note: entry.note || null });
  }
  const names = out.map((s) => s.name);
  const dupe = names.find((n, i) => names.indexOf(n) !== i);
  if (dupe !== undefined) {
    no('family', `two sub-brands are both called "${dupe}".`,
      'Their files would be written over each other and the second would be the only one that survived.',
      'Give them different names.');
  }
  return out;
}

// ---------------------------------------------------------------- composing

// The mark, the sub-brand's name, and the line that says whose it is. Nothing is
// placed by eye: every distance is a fraction of the mark's measured ink.
function lockup({ markSvg, markInk, nameSvg, nameBox, endSvg, endBox, rule, ink }) {
  const nameScale = (markInk.h * rule.nameRatio) / nameBox.h;
  const endScale = endSvg ? (markInk.h * rule.endorsementRatio) / endBox.h : 0;
  const nw = nameBox.w * nameScale, nh = nameBox.h * nameScale;
  const ew = endSvg ? endBox.w * endScale : 0, eh = endSvg ? endBox.h * endScale : 0;
  const gap = markInk.h * rule.gapRatio;
  const lead = endSvg ? markInk.h * rule.leadRatio : 0;
  const stack = nh + lead + eh;
  const height = Math.max(markInk.h, stack);
  const width = markInk.w + gap + Math.max(nw, ew);
  const x = markInk.w + gap;
  const top = (height - stack) / 2;
  const parts = [
    { doc: svgu.parse(markSvg), box: markInk, x: 0, y: (height - markInk.h) / 2, scale: 1 },
    { doc: svgu.parse(nameSvg), box: nameBox, x, y: top, scale: nameScale },
  ];
  if (endSvg) parts.push({ doc: svgu.parse(endSvg), box: endBox, x, y: top + nh + lead, scale: endScale });
  return {
    svg: svgu.compose(parts, width, height),
    width: svgu.round(width, 3), height: svgu.round(height, 3),
    nameScale: svgu.round(nameScale, 4),
    // the height of the endorsement line in the composed drawing's own units,
    // which is what decides whether it can be read at any given size
    endorsementUnits: endSvg ? svgu.round(eh, 3) : null,
  };
}

// What the words measure once the lockup is at its own floor. The floor is
// worked out the way every other floor here is — the box divided by the finest
// thing in it — and in an endorsed lockup the finest thing is a letter.
function readability(composed, rules, floorPx) {
  if (composed.endorsementUnits == null) return null;
  const at = (composed.endorsementUnits / composed.width) * floorPx;
  return { capPx: Number(at.toFixed(2)), floorPx,
    readable: at >= (rules.readableAtPx || DEFAULTS.readableAtPx),
    needsPx: Math.ceil((composed.width / composed.endorsementUnits) * (rules.readableAtPx || DEFAULTS.readableAtPx)) };
}

module.exports = { DEFAULTS, rules, load, lockup, readability };
