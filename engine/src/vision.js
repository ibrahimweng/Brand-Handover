'use strict';
// What the palette looks like to somebody who does not see it the way you do.
//
// Every package this engine has built states its accessibility in one measure:
// the WCAG contrast ratio, which is a ratio of *luminance*. It is the right
// measure for text on a ground and it is blind to the thing colour is mostly
// used for. Two colours can sit at a perfectly comfortable ratio against a page
// and be the same colour as each other to one reader in twelve — because the
// only thing separating them is hue, and hue is exactly what a colour vision
// deficiency takes away. Twenty-three identities, and nothing here had ever
// asked the question. Ten of their palettes contain a pair that a normal eye
// reads as plainly different and a deuteranope reads as one colour.
//
// The simulation is Viénot, Brettel & Mollon (1999): project the colour onto the
// plane of the two cone types that remain. It models *dichromacy*, the complete
// form — one cone type absent. That is the rarer case. The commoner one is
// anomalous trichromacy, where the cone is present and shifted, and those
// readers see a reduced version of the same collapse: everything reported here
// is at least a difficulty for them and often the same failure. Red-green
// deficiency of some kind is carried by about one man in twelve and one woman in
// two hundred; the blue-yellow kind is far rarer, about one person in ten
// thousand, and is included because it costs nothing to ask.
const contrast = require('./contrast');

// The projection is done in LMS — cone response — not in RGB. The coefficients
// below are the paper's, and they are coefficients on cone responses; applied
// directly to linear RGB, as they are in most of the versions circulating on the
// web, they do not preserve the achromatic axis. The first thing this module
// drew was Deben's near white paper rendered as cyan for a protanope, which is
// not a subtle error: a dichromat sees white as white, grey as grey and black as
// black, and any simulation that does not is wrong everywhere, not only on the
// greys. RGB → LMS, project, LMS → RGB.
const RGB_LMS = [
  [17.8824, 43.5161, 4.11935],
  [3.45565, 27.1554, 3.86714],
  [0.0299566, 0.184309, 1.46709],
];
const LMS_RGB = [
  [0.080944, -0.130504, 0.116721],
  [-0.010248, 0.054019, -0.113614],
  [-0.000365, -0.004122, 0.693513],
];

// Each projects the missing cone's response onto the two that remain.
const KINDS = {
  protanopia: ([, m, s]) => [2.02344 * m - 2.52581 * s, m, s],
  deuteranopia: ([l, , s]) => [l, 0.494207 * l + 1.24827 * s, s],
  // Viénot's simplification is derived for the red and green cones; for the
  // blue one this is the usual working approximation rather than the paper's
  // own projection. Good enough to say "these two collapse", not to sample from.
  tritanopia: ([l, m]) => [l, m, -0.395913 * l + 0.801109 * m],
};

const dot = (M, v) => M.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);

const NAMES = {
  protanopia: 'a protanope, who has no red cone',
  deuteranopia: 'a deuteranope, who has no green cone',
  tritanopia: 'a tritanope, who has no blue cone',
};

// how common each is, so a finding can be weighed rather than just counted
const SHARE = {
  protanopia: 'about 1 man in 100',
  deuteranopia: 'about 1 man in 16, and the commonest of the three',
  tritanopia: 'about 1 person in 10,000',
};

const lin = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const gam = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055);
const clamp255 = (x) => Math.round(Math.min(1, Math.max(0, x)) * 255);
const hex2 = (n) => n.toString(16).padStart(2, '0');

function simulate(colour, kind) {
  const rgb = contrast.rgb(colour);
  if (!rgb || !KINDS[kind]) return null;
  const v = rgb.map((c) => lin(c / 255));
  const out = dot(LMS_RGB, KINDS[kind](dot(RGB_LMS, v)));
  return `#${out.map((x) => hex2(clamp255(gam(x)))).join('')}`.toUpperCase();
}

// CIE L*a*b*, D65. Lab is used rather than RGB distance because a difference in
// RGB is not a difference anybody can see: #000000 to #010101 is one step and
// invisible, #00FF00 to #00FE00 is one step and invisible, and two colours 40
// apart in RGB may be obvious or identical depending where they sit.
function lab(colour) {
  const rgb = contrast.rgb(colour);
  if (!rgb) return null;
  const [R, G, B] = rgb.map((c) => lin(c / 255));
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
  const y = f(R * 0.2126 + G * 0.7152 + B * 0.0722);
  const z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

// ΔE*ab (CIE 1976). One unit is roughly one just noticeable difference under
// laboratory conditions; two flat colours in a document, at a glance, across a
// room, on a sign in the rain, need a great deal more than one.
function distance(a, b) {
  const p = lab(a), q = lab(b);
  if (!p || !q) return null;
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

const round1 = (n) => Number(n.toFixed(1));

// How far apart two colours are, to everybody.
function apart(a, b) {
  const out = { normal: round1(distance(a, b) || 0), seen: {} };
  for (const kind of Object.keys(KINDS)) {
    out.seen[kind] = { hex: [simulate(a, kind), simulate(b, kind)],
      distance: round1(distance(simulate(a, kind), simulate(b, kind)) || 0) };
  }
  const worst = Object.entries(out.seen).sort((x, y) => x[1].distance - y[1].distance)[0];
  out.worst = { kind: worst[0], distance: worst[1].distance };
  return out;
}

// Every pair in a palette that separates for most people and stops separating
// for somebody. A pair that is close to begin with is not a finding: nobody was
// ever going to tell #F6F4EF from #F7F5F2, and saying so is noise.
function collapses(colours, floor) {
  const names = Object.keys(colours);
  const found = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = colours[names[i]].hex, b = colours[names[j]].hex;
      const got = apart(a, b);
      if (got.normal < floor) continue;
      if (got.worst.distance >= floor) continue;
      found.push(Object.assign({ pair: [names[i], names[j]], hex: [a, b] }, got));
    }
  }
  return found.sort((x, y) => x.worst.distance - y.worst.distance);
}

const say = (k) => NAMES[k] || k;
const howMany = (k) => SHARE[k] || '';

module.exports = { simulate, lab, distance, apart, collapses, KINDS, NAMES, SHARE, say, howMany, round1 };
