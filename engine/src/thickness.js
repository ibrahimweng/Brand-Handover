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

// The ink stops half a pixel outside the last pixel of it.
//
// The transform measures from one pixel's middle to another's, so a run of
// three pixels reads two deep and not one and a half. Every depth here is
// therefore half a pixel more than the drawing's, at both edges of a stroke
// and so once in a width. Left in, that half pixel is a stroke passing a rule
// it is exactly on — which is every stroke a floor is worked out from, because
// the floor is the size at which the thinnest stroke is exactly the minimum.
const EDGE = 0.5;

// How thin the rule may get, in pixels of the render, before the answer stops
// being about the drawing.
//
// Below about eight the readings jump: a ring stroked eleven units, asked
// whether it is under ten, came back 71% under at a rule of four pixels, 3% at
// six, 52% at eight and 0% from nine up. What moves is not the drawing but
// whether the core — the ink left after eroding — is wide enough to be a
// continuous thing on the grid rather than a dotted line, and the core is only
// as wide as the ink exceeds the rule. Twelve pixels of rule leaves a stroke
// that is a tenth over it more than a pixel of core to stand on. Every case
// worked out on paper is right from twelve up and stays right to thirty-two,
// so twelve it is, with the arithmetic shown in test/run.js.
const GRID = 12;

// The size asked about is never the size rendered.
//
// "Is this drawing's ink at least S pixels thick when it is W pixels wide" is a
// ratio, and the same ratio can be asked of any render by moving the rule. So
// the render is chosen to put the rule at GRID pixels, whatever size the
// question is about, and the drawing is drawn at that size rather than at the
// one under discussion — which would quantise: a 10 unit bar in a 120 unit box,
// drawn 60 px wide, should be 5 px of ink and comes out 6, because the edge
// pixels clear the threshold.
//
// Never finer than FINEST, because a whole logo rendered forty pixels wide is
// not a logo. Never coarser than COARSEST, because a render is quadratic and
// this has to finish. Past COARSEST the rule falls under GRID and the answer is
// that there was no answer — see `seen`.
const FINEST = 600;
const COARSEST = 2048;
const RENDER = 900;   // when a caller picks the size itself

const renderFor = (box, units) =>
  Math.min(COARSEST, Math.max(FINEST, Math.round(GRID * box / units)));

// A drawing, rendered once, ready to be asked about.
function drawing(svgString, viewBoxWidth, renderPx = RENDER) {
  return { img: inkAt(svgString, renderPx), box: viewBoxWidth, px: renderPx };
}

// What share of the ink is thinner than `thick` pixels, in this render.
//
// An opening with a disc of radius thick/2: the ink that survives being eroded
// by that radius and grown back is the ink that is at least that thick. The
// rest is thinner than the rule, wherever it is and whatever shape it is.
//
// `seen` is false when the rule was finer than the grid can hold. The share is
// still returned, because a caller may want to see what it was, but it is a
// fact about the pixels and not about the artwork and nothing may be decided
// on it.
function share(img, thick) {
  const { on, width, height } = img;
  let ink = 0;
  for (let i = 0; i < on.length; i++) ink += on[i];
  const seen = thick >= GRID;
  if (!ink) return { ink: 0, thin: 0, share: 0, seen, thick, width, height };
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
  for (let i = 0; i < on.length; i++) { if (on[i] && depth[i] - EDGE >= r) { core[i] = 1; cores++; } }
  if (!cores) return { ink, thin: ink, share: 1, seen, thick, width, height };
  const back = distanceTo(core, width, height);
  let thin = 0;
  for (let i = 0; i < on.length; i++) if (on[i] && back[i] - EDGE > r) thin++;
  return { ink, thin, share: thin / ink, seen, thick, width, height };
}

// What share of the ink is thinner than `thick` pixels, rendered this wide.
const thinShare = (svgString, widthPx, thick) => share(inkAt(svgString, widthPx), thick);

// What share of this drawing's ink is thinner than `units` of its own artwork.
const underUnits = (d, units) => share(d.img, units * (d.img.width / d.box));

// And the question a floor asks: drawn `widthPx` wide on a screen, what share
// of the ink is under the minimum stroke the project states?
const atWidth = (d, widthPx, minStrokePx) => underUnits(d, minStrokePx * d.box / widthPx);

// A rule that falls exactly on a stroke does not have one answer.
//
// The size a package states is worked out from its own thinnest stroke — it is
// the size at which that stroke is exactly the minimum — so at the stated size
// the rule lands exactly on the stroke it was taken from. Which side of it the
// stroke comes down on is then decided by the render: northline's mark read
// 1.8% of its ink under the rule drawn 600 px across and 38.3% drawn 900 px,
// and neither is a mistake. A rendered edge lands within half a pixel of where
// the artwork puts it, twice across a stroke, and the transform between them
// quantises again.
//
// So the rule is asked either side of itself instead of on it. `least` is what
// is under the kindest rule the measurement allows and `most` what is under
// the harshest; when they agree the drawing is nowhere near an edge, and when
// they do not it is sitting on the rule — which is a thing worth knowing about
// a floor, and not a failure to measure.
//
// The width comes from the grid, and it was chosen by measuring rather than by
// taste. Every drawing in the repository was read at three render sizes with
// the pair taken at half a pixel, one, one and a half, two and three:
//
//     half-width          0.5     1     1.5      2      3
//     same verdict at
//     all three renders    67    78      87     90     91   of 108
//     called on the rule   25    63      86     87     94
//
// No width ever called a drawing over the rule at one render and under it at
// another, so nothing here is chosen to avoid a contradiction. What a wider
// pair buys is agreement, and what it costs is that more drawings come back
// with no number. One and a half is where the agreement stops climbing
// steeply and before the pair swallows the whole repository.
const BLUR = 1.5;

function around(img, thick) {
  const kind = share(img, Math.max(0.5, thick - BLUR));
  const harsh = share(img, thick + BLUR);
  return { least: kind.share, most: harsh.share, ink: kind.ink, thick,
    seen: thick >= GRID, onRule: harsh.share - kind.share > 0.02 };
}

// The two entry points: what a drawing does under a rule of so many of its own
// box units, and what it does at a size on a screen. Both render at the size
// that can see the answer, and both come back as a pair.
// Asking one drawing several things means rendering it several times, because
// the render follows the question. Rendering it twice at the same size does
// not have to happen, and a floor check asks every drawing at least twice.
function looker(svgString, box) {
  const made = new Map();
  const draw = (px) => {
    if (!made.has(px)) made.set(px, drawing(svgString, box, px));
    return made.get(px);
  };
  const under = (units) => {
    const px = renderFor(box, units);
    // Asked about a rule the coarsest render allowed cannot hold: say so
    // without drawing anything. Rendering it would cost a second and return a
    // zero that means nothing.
    if (units * (px / box) < GRID) {
      return { least: null, most: null, ink: null, thick: units * (px / box), seen: false, onRule: false };
    }
    const d = draw(px);
    return around(d.img, units * (d.img.width / d.box));
  };
  // Whether a drawing holds at a size is only the harsh end of the pair — if
  // the strictest reading is inside the tolerance the kind one is too — so the
  // search does not pay for a half it would not look at.
  const harshestUnder = (units) => {
    const px = renderFor(box, units);
    if (units * (px / box) < GRID) return { share: null, seen: false };
    const d = draw(px);
    return { share: share(d.img, units * (d.img.width / d.box) + BLUR).share, seen: true };
  };
  return { draw, under, harshestUnder,
    at: (widthPx, minStrokePx) => under(minStrokePx * box / widthPx),
    holdsAt: (widthPx, minStrokePx) => harshestUnder(minStrokePx * box / widthPx) };
}

const under = (svgString, box, units) => looker(svgString, box).under(units);
const at = (svgString, box, widthPx, minStrokePx) => under(svgString, box, minStrokePx * box / widthPx);

// The largest size this can answer about at all: past it the rule is finer
// than the grid even at the coarsest render allowed.
const seesUpTo = (minStrokePx) => COARSEST * minStrokePx / GRID;

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
function curve(svgString, viewBoxWidth, minStrokePx, sizes) {
  const seen = {};
  return sizes.map((w) => {
    const px = renderFor(viewBoxWidth, minStrokePx * viewBoxWidth / w);
    if (!seen[px]) seen[px] = drawing(svgString, viewBoxWidth, px);
    const m = atWidth(seen[px], w, minStrokePx);
    return { at: w, share: m.share, ink: m.ink, seen: m.seen, renderPx: px };
  });
}

// The smallest of the sizes given at which no more than `tolerance` of the ink
// is under the rule, with the sample below it, so a reader can see how sharp
// the answer is rather than being handed a number to trust.
function smallestThatHolds(svgString, viewBoxWidth, minStrokePx, tolerance, sizes) {
  const rows = curve(svgString, viewBoxWidth, minStrokePx, sizes.slice().sort((a, b) => a - b));
  for (let i = 0; i < rows.length; i++) {
    if (!rows[i].seen) break;
    if (rows[i].share <= tolerance) {
      return { at: rows[i].at, share: rows[i].share, below: i ? rows[i - 1] : null, rows };
    }
  }
  return { at: null, share: null, below: null, rows };
}

// The smallest size on the list at which the drawing holds — asked of every
// size from the bottom until one does.
//
// The first version of this strode up the list and then narrowed, on the
// reasoning that the share only falls as a drawing grows: the ink gets thicker
// and the rule does not move. That was true when one render answered every
// question. It is not true now that the render follows the question, because
// each size is measured on a different grid and the grids do not agree to
// better than a pixel. Checked against asking every size, the search returned a
// different answer for **30 of the 142 drawings** here, and not always a larger
// one — it claimed 160 px for drawings that hold at no size on the list.
//
// So it asks. Starting from the smallest, which is where the answer usually is,
// and stopping at the first size that holds, which is what the phrase means.
function holdsFrom(svgString, viewBoxWidth, minStrokePx, tolerance, sizes, eye) {
  const all = sizes.slice().sort((a, b) => a - b);
  const list = all.filter((w) => w <= seesUpTo(minStrokePx));
  const look = eye || looker(svgString, viewBoxWidth);
  if (!list.length) return { at: null, share: null, seen: false, asked: 0 };
  let last = null;
  for (const w of list) {
    const r = look.holdsAt(w, minStrokePx);
    last = r.share;
    if (r.seen && r.share <= tolerance) return { at: w, share: r.share, seen: true };
  }
  // Nothing on the list holds. Whether that means the drawing never holds or
  // only that the looking stopped short is the difference between a finding and
  // a guess, so it is said.
  return { at: null, share: last, seen: list.length === all.length, asked: list[list.length - 1] };
}

// How sharply it falls: the largest jump in share between neighbouring sizes.
// A stem gives a cliff; a taper gives a slope.
function steepest(rows) {
  let worst = 0, where = null;
  for (let i = 1; i < rows.length; i++) {
    if (!rows[i].seen || !rows[i - 1].seen) continue;
    const d = rows[i - 1].share - rows[i].share;
    if (d > worst) { worst = d; where = [rows[i - 1].at, rows[i].at]; }
  }
  return { drop: worst, between: where };
}

module.exports = { thinShare, share, around, drawing, looker, underUnits, under, atWidth, at, curve,
  smallestThatHolds, holdsFrom, steepest, distanceTo, inkAt, seesUpTo, renderFor,
  RENDER, GRID, FINEST, COARSEST, EDGE, BLUR };
