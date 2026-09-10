/* zigzag — interlocking stripes with a rounded tooth.

   After PLAYGRND's Zig. Everything is built in the tile's own box as closed
   polygons of corner points, every corner rounded by a radius from one control,
   and only alternate stripes painted — so the unpainted ones are the ground and
   the two colours interlock exactly rather than being drawn over each other.
   Two colours per tile and no more, which is what makes it a pattern a brand
   can use on a bag and a business card and have it be the same pattern.

   A stripe is a pair of neighbouring *boundary chains*. A chain is a function
   of one coordinate: `chain(i, t)` gives the position of the i-th boundary at
   distance t along it. Six styles are six chains.

   The seam rule is the same as everywhere here, and for a chain it has a
   sharper form than for a grid: the chain must satisfy

       chain(i, t + P) = chain(i, t)        along its own run
       chain(i + n, t) = chain(i, t) + W    across the tile

   for a whole number of teeth P dividing the run and a whole number of stripes
   n across. Both are arithmetic, and test/run.js checks them as arithmetic —
   at thousands of positions, to floating-point equality — rather than looking
   at the result and deciding it seems fine.

   The count of stripes has to be even as well as whole. Only alternate stripes
   are painted, so an odd count paints two neighbours the same colour where the
   tile meets itself, and the pattern reads as having a fault down one line. */
'use strict';

const STYLES = ['teeth', 'chevron', 'stairs', 'ricrac', 'waves', 'scales'];

// The nearest even whole number of somethings that fits a span. Even, because
// the stripes alternate; at least two, because one stripe is not a pattern.
const evenCount = (span, want) => {
  const n = Math.max(2, Math.round(span / Math.max(1e-6, want)));
  return n % 2 ? n + 1 : n;
};

// Round every corner of a closed polygon by `r`, or by as much of `r` as the
// two edges meeting there can spare. A corner between two short edges rounds
// less than one between two long ones, which is what stops a small tooth
// turning into a circle while its neighbour is still square.
function rounded(surface, pts, r) {
  const n = pts.length;
  if (n < 3 || r <= 0) {
    surface.beginPath();
    surface.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < n; i++) surface.lineTo(pts[i][0], pts[i][1]);
    surface.closePath();
    return;
  }
  const at = (i) => pts[((i % n) + n) % n];
  const seg = (a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1e-9;
    return { dx: dx / len, dy: dy / len, len };
  };
  surface.beginPath();
  let started = false;
  for (let i = 0; i < n; i++) {
    const prev = at(i - 1), here = at(i), next = at(i + 1);
    const a = seg(here, prev), b = seg(here, next);
    const cut = Math.min(r, a.len / 2, b.len / 2);
    const p0 = [here[0] + a.dx * cut, here[1] + a.dy * cut];
    const p1 = [here[0] + b.dx * cut, here[1] + b.dy * cut];
    if (!started) { surface.moveTo(p0[0], p0[1]); started = true; } else surface.lineTo(p0[0], p0[1]);
    if (cut > 1e-9) surface.quadraticCurveTo(here[0], here[1], p1[0], p1[1]);
    else surface.lineTo(p1[0], p1[1]);
  }
  surface.closePath();
}

// A closed curve through a list of samples, each sample the control point and
// each midpoint on the curve. The smooth styles need this and must not be sent
// through `rounded` — rounding a curve that is already sampled every eighth of
// a period, at a radius the size of the sample spacing, turns a wave into a
// row of lozenges. It did, for two styles, and they both looked deliberate.
function smoothed(surface, pts) {
  const n = pts.length;
  const at = (i) => pts[((i % n) + n) % n];
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  surface.beginPath();
  let m = mid(at(0), at(1));
  surface.moveTo(m[0], m[1]);
  for (let i = 1; i <= n; i++) {
    const c = at(i), nx = mid(at(i), at(i + 1));
    surface.quadraticCurveTo(c[0], c[1], nx[0], nx[1]);
  }
  surface.closePath();
}

// Everything the chain needs, worked out once. Every count here is a whole
// even number, which is what makes the tile close.
function plan(p) {
  const W = 1000, H = 1000;                 // the chain works in its own box
  const q = { style: p.style, W, H, rounding: p.rounding == null ? 0.8 : p.rounding };
  q.stripes = evenCount(W, W * (p.stripe || 0.1));
  q.bw = W / q.stripes;                     // one stripe, exactly
  q.teeth = evenCount(H, H * (p.length || 0.16));
  q.tp = H / q.teeth;                       // one tooth along the run, exactly
  q.depth = q.bw * (p.depth == null ? 0.9 : p.depth);
  q.smooth = p.style === 'waves' || p.style === 'scales';
  return q;
}

// Where boundary `i` sits at distance `t` along its run.
//
// Six styles, six shapes, and they have to be six shapes. The first draft had
// `teeth` as a triangle wave and `stairs` as a square one sampled twice per
// tooth, which the straight lines between samples turned into the same
// trapezoid — two rows of a rounding sweep that were the same picture.
function chain(i, t, q) {
  const base = i * q.bw;
  const d = q.depth * 0.5;
  const phase = t / q.tp;
  const k = Math.floor(phase);
  const f = phase - k;
  switch (q.style) {
    case 'teeth':
    case 'chevron':
      // a symmetric V: out and straight back, one whole tooth per period
      return base + (f < 0.5 ? (f * 4 - 1) : (3 - f * 4)) * d;
    case 'stairs':
      // a castellation: hold, step, hold. The flats are what make it a stair
      // rather than a zigzag, and they only exist because the points below put
      // two samples on each of them.
      return base + (f < 0.5 ? -1 : 1) * d;
    case 'ricrac':
      // a sawtooth: a long rise and a short fall, which is the one shape in
      // this set that is not symmetric about its own middle
      return base + (f < 0.75 ? (f / 0.75) * 2 - 1 : (1 - (f - 0.75) / 0.25) * 2 - 1) * d;
    case 'waves':
      // both boundaries of a stripe move together, so the stripe keeps its
      // width and the pattern is a wavy band
      return base + Math.sin(phase * Math.PI * 2) * d;
    case 'scales':
      // neighbouring boundaries move against each other, so a stripe swells
      // and pinches — which is the scallop
      return base + Math.sin((phase + (i % 2 ? 0.5 : 0)) * Math.PI * 2) * d;
    default:
      return base;
  }
}

// The points of one boundary, one whole tooth past each end of the tile.
//
// A stripe is a closed polygon: the boundary down one side, the next boundary
// back up the other, and a straight edge across each end joining them. Those
// two end edges are a fault. They meet the chain at a corner, the corner is
// rounded like every other corner, and the rounding makes a notch that exists
// nowhere else in the run. At the tile boundary two of those notches meet and
// the join is visible — ricrac read eleven standard deviations of it while its
// chain arithmetic was exactly periodic the whole time.
//
// Running past the ends puts both end edges outside the tile, where the clip
// removes them. Inside the tile there is nothing but chain.
function chainPoints(i, q) {
  const out = [];
  // Where the samples go is what makes each style its own shape. A stair needs
  // a sample either side of every step or its flats become ramps; a wave needs
  // enough of them to be a wave.
  const offsets = q.smooth ? [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875]
    : q.style === 'stairs' ? [0, 0.4999, 0.5001]
      : q.style === 'ricrac' ? [0, 0.75]
        : [0, 0.5];
  const over = 1;                            // one whole tooth past each end
  for (let k = -over; k < q.teeth + over; k++) {
    for (const o of offsets) out.push([chain(i, (k + o) * q.tp, q), (k + o) * q.tp]);
  }
  out.push([chain(i, (q.teeth + over) * q.tp, q), (q.teeth + over) * q.tp]);
  return out;
}

function paint(surface, W, H, p, palette) {
  const q = plan(p);
  const two = palette.pair();
  const across = q.style === 'chevron' || q.style === 'ricrac';
  surface.save();
  surface.beginPath(); surface.rect(0, 0, W, H); surface.clip();
  surface.fillStyle = two[0];
  surface.fillRect(0, 0, W, H);
  surface.translate(0, 0);
  surface.scale(W / q.W, H / q.H);
  if (across) { surface.translate(q.W, 0); surface.rotate(Math.PI / 2); }
  // The radius is a share of the smaller of the two things a corner sits
  // between, so a tooth that is short in one direction cannot be rounded away
  // in the other.
  const r = q.rounding * Math.min(q.bw, q.tp) * 0.5;
  surface.fillStyle = two[1];
  // One extra stripe either side, because a chain leans by up to half a tooth
  // and the leaning part of the first stripe belongs to the tile even when its
  // base does not.
  for (let i = -1; i <= q.stripes; i += 2) {
    const a = chainPoints(i, q), b = chainPoints(i + 1, q);
    const pts = a.concat(b.slice().reverse());
    if (q.smooth) smoothed(surface, pts); else rounded(surface, pts, r);
    surface.fill();
  }
  surface.restore();
}

const controls = [
  { group: 'pattern', key: 'stripe', label: 'Stripe width', type: 'range', min: 0.03, max: 0.25, step: 0.005 },
  { group: 'pattern', key: 'depth', label: 'Tooth depth', type: 'range', min: 0.2, max: 1.4, step: 0.02 },
  { group: 'pattern', key: 'length', label: 'Tooth length', type: 'range', min: 0.05, max: 0.4, step: 0.01 },
  { group: 'pattern', key: 'rounding', label: 'Rounding', type: 'range', min: 0, max: 1, step: 0.01 },
  { group: 'pattern', key: 'style', label: 'Style', type: 'chips', options: STYLES },
];

module.exports = { key: 'zigzag', vector: true, styles: STYLES, controls,
  plan, chain, chainPoints, paint, rounded, smoothed, evenCount };
