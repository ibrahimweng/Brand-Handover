'use strict';
/* How much of a drawing is too thin to survive, at a given size.

   The floor a package states — the smallest size the artwork holds at — is
   worked out in src/geometry.js by dividing the box by the narrowest run of
   ink in it. That is one number about one place, and on a shape that comes to a
   point it is a measurement of the pixel grid rather than of the drawing: a
   plain triangle came out of it needing 3600 px on screen and 1012 mm in print.

   This asks the question the floor is *for*, and asks it of the whole drawing:
   rendered this big, how much of the ink is thinner than a press or a screen
   can hold? It is a share, not a place, so a tip that tapers to nothing costs
   almost nothing and a hairline running the width of the mark costs everything.

   The operation is a morphological opening with a disc: erode the ink by half
   the minimum, dilate it back, and whatever did not come back was thinner than
   the disc. Both steps are exact Euclidean distance transforms, so the answer
   is a real distance and not a count of grid steps.

   Nothing here decides anything. It reports what a drawing does at a size, and
   src/geometry.js still states the floor. See test/floor-check.mjs. */
const { Resvg } = require('@resvg/resvg-js');

// Felzenszwalb & Huttenlocher, squared Euclidean distance transform, exact and
// linear. `f` is the cost per cell: 0 where the feature is, INF where it is not.
const INF = 1e20;
function edt1d(f, n, d, v, z) {
  let k = 0;
  v[0] = 0; z[0] = -INF; z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q; z[k] = s; z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}

// distance from every cell to the nearest cell where `is` is true, in pixels
function distanceTo(is, w, h) {
  const n = Math.max(w, h);
  const f = new Float64Array(n), d = new Float64Array(n);
  const v = new Int32Array(n + 1), z = new Float64Array(n + 2);
  const grid = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) grid[i] = is[i] ? 0 : INF;
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x];
    edt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grid[y * w + x];
    edt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) grid[y * w + x] = Math.sqrt(d[x]);
  }
  return grid;
}

// The ink of a drawing, rendered this many pixels wide.
function inkAt(svgString, widthPx) {
  const r = new Resvg(svgString, { fitTo: { mode: 'width', value: Math.max(1, Math.round(widthPx)) },
    background: 'rgba(0,0,0,0)' }).render();
  const { width, height, pixels } = r;
  const on = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < on.length; i++, p += 4) on[i] = pixels[p + 3] > 127 ? 1 : 0;
  return { on, width, height };
}

// What share of the ink is thinner than `thick` pixels, in this render.
//
// An opening with a disc of radius thick/2: the ink that survives being eroded
// by that radius and grown back is the ink that is at least that thick. The
// rest is thinner than the rule, wherever it is and whatever shape it is.
function thinShare(svgString, widthPx, thick) {
  return share(inkAt(svgString, widthPx), thick);
}

function share(img, thick) {
  const { on, width, height } = img;
  let ink = 0;
  for (let i = 0; i < on.length; i++) ink += on[i];
  if (!ink) return { ink: 0, thin: 0, share: 0, width, height };
  const r = thick / 2;
  // How deep the ink is at every pixel is a fact about the drawing and not
  // about the rule, so it is worked out once however many sizes are asked
  // about. Only the growing back depends on the rule.
  if (!img.depth) {
    const outside = new Uint8Array(on.length);
    for (let i = 0; i < on.length; i++) outside[i] = on[i] ? 0 : 1;
    img.depth = distanceTo(outside, width, height);
    img.ink = ink;
  }
  const depth = img.depth;
  const core = new Uint8Array(on.length);
  let cores = 0;
  for (let i = 0; i < on.length; i++) { if (on[i] && depth[i] >= r) { core[i] = 1; cores++; } }
  if (!cores) return { ink, thin: ink, share: 1, width, height };
  const back = distanceTo(core, width, height);
  let thin = 0;
  for (let i = 0; i < on.length; i++) if (on[i] && back[i] > r) thin++;
  return { ink, thin, share: thin / ink, width, height };
}

// The size under test is never the size rendered.
//
// A drawing rendered at the size being asked about quantises: a 10 unit bar in
// a 120 unit box, drawn 60 px wide, should be 5 px of ink and comes out 6,
// because the edge pixels clear the threshold. Ask a question about a 5 px
// stroke that way and the answer is about a 6 px one.
//
// The question does not need it. "Is this drawing's ink at least S pixels thick
// when it is W pixels wide" is a ratio, and the same ratio can be measured in
// one large render by asking for S x R / W pixels there. So the artwork is
// rendered once, large, and it is the rule that moves.
const RENDER = 900;

// A drawing, rendered once, ready to be asked about at any size.
function drawing(svgString, viewBoxWidth, renderPx = RENDER) {
  return { img: inkAt(svgString, renderPx), box: viewBoxWidth, px: renderPx };
}

// What share of this drawing's ink is thinner than `units` of its own artwork.
const underUnits = (d, units) => share(d.img, units * (d.img.width / d.box));

// And the same question the floor asks: drawn `widthPx` wide on a screen, what
// share of the ink is under the rule the project states?
const atWidth = (d, widthPx, minStrokePx) => underUnits(d, minStrokePx * d.box / widthPx);

// The same question asked across a range of sizes: the curve, not a number.
//
// A drawing with a stem in it falls off a cliff. Above the size at which its
// stem clears the rule almost none of the ink is under it; below, almost all of
// it is, because the stem is most of what the drawing is made of. A drawing
// that only tapers has no cliff: the share creeps up as the tip gets smaller
// and never arrives anywhere.
//
//     a ring stroked 9 units      0%    0%   99%  100%
//     a solid triangle          0.1%  0.8%  4.4% 16.8%
//
// That difference is a property of the drawing and it is what a floor is
// really asking about, so the curve is the answer and any single number read
// off it is a summary of one.
function curve(svgString, viewBoxWidth, minStrokePx, sizes, renderPx = RENDER) {
  const d = drawing(svgString, viewBoxWidth, renderPx);
  return sizes.map((w) => {
    const m = atWidth(d, w, minStrokePx);
    return { at: w, share: m.share, ink: m.ink };
  });
}

// The smallest of the sizes given at which no more than `tolerance` of the ink
// is under the rule, with the sample below it, so a reader can see how sharp
// the answer is rather than being handed a number to trust.
function smallestThatHolds(svgString, viewBoxWidth, minStrokePx, tolerance, sizes, renderPx = RENDER) {
  const rows = curve(svgString, viewBoxWidth, minStrokePx, sizes.slice().sort((a, b) => a - b), renderPx);
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].share <= tolerance) {
      return { at: rows[i].at, share: rows[i].share, below: i ? rows[i - 1] : null, rows };
    }
  }
  return { at: null, share: rows.length ? rows[rows.length - 1].share : 1, below: null, rows };
}

// The same answer as smallestThatHolds, without drawing the whole curve.
//
// The share only falls as the drawing grows — the ink gets thicker and the rule
// does not move — so the sizes are sorted and the answer can be looked for
// rather than computed everywhere. Seven measurements instead of twenty-six,
// which is the difference between a check somebody runs and one they do not.
function holdsFrom(svgString, viewBoxWidth, minStrokePx, tolerance, sizes, renderPx = RENDER) {
  const list = sizes.slice().sort((a, b) => a - b);
  const d = drawing(svgString, viewBoxWidth, renderPx);
  const at = (i) => atWidth(d, list[i], minStrokePx).share;
  if (!list.length) return { at: null, share: 1, drawing: d };
  if (at(list.length - 1) > tolerance) return { at: null, share: at(list.length - 1), drawing: d };
  let lo = 0, hi = list.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (at(mid) <= tolerance) hi = mid; else lo = mid + 1;
  }
  return { at: list[lo], share: at(lo), drawing: d };
}

// How sharply it falls: the largest jump in share between neighbouring sizes.
// A stem gives a cliff; a taper gives a slope.
function steepest(rows) {
  let worst = 0, where = null;
  for (let i = 1; i < rows.length; i++) {
    const d = rows[i - 1].share - rows[i].share;
    if (d > worst) { worst = d; where = [rows[i - 1].at, rows[i].at]; }
  }
  return { drop: worst, between: where };
}

module.exports = { thinShare, share, drawing, underUnits, atWidth,
  curve, smallestThatHolds, holdsFrom, steepest, distanceTo, inkAt, RENDER };
