/* Is the seam findable?

   Every generator here claims its tile repeats. The claim is cheap to make and
   the failure is expensive: a pattern goes on a wall, a bag, an endpaper, and
   the join shows up at a size nobody checked. "It looks seamless" is not a
   measurement, and neither is reading the code that was supposed to make it so.

   So: lay the tile out as the artwork will actually use it — an SVG <pattern>
   filling a larger rectangle, which is what a designer drops on an artboard —
   render it, and ask a question about the columns of pixels. Between any two
   neighbouring columns there is some amount of change. Over a whole rendering
   that gives a distribution: most columns differ from their neighbour by about
   so much, with a spread. The columns that fall on a tile boundary are three
   of those columns. If the tile repeats, they are unremarkable members of the
   distribution. If it does not, they are the largest values in it.

   The answer is a z-score — how many standard deviations the seam column sits
   above the ordinary column — and it is reported for the vertical seams and
   the horizontal ones separately, because a tile can be periodic in one axis
   and not the other and the two failures look nothing alike.

   Below about 3 the seam is not findable by this measure. It is set at 4 in
   test/run.js, with the arithmetic there and a deliberately broken tile beside
   the real one to show the check can tell them apart. */
'use strict';
const { Resvg } = require('@resvg/resvg-js');
const surface = require('./surface');

// The tile, laid out.
//
// The first version of this used an SVG <pattern> filling a rectangle, on the
// reasoning that it is what a designer drops on an artboard and so what the
// tile will really be put through. It measured the wrong thing. A renderer
// draws <pattern> by rasterising the tile once into its own small bitmap and
// repeating that, and the bitmap's edges are antialiased against nothing, so
// every repeat boundary carries a hairline of partial coverage that belongs to
// the renderer and not to the artwork. Stripes with a period of ten on a
// hundred-unit tile — seamless by arithmetic, with nothing to find — read 2.88
// that way, which is most of the way to the bar.
//
// So the tile is drawn nine times into one surface at nine offsets, and the
// whole thing is rasterised once. No tile bitmap, no repeat boundary, nothing
// between the measurement and the drawing. The same solid stripes read 0.00.
//
// `paint(surface, W, H)` draws one tile at the origin. It is called nine times.
function layout(paint, W, H, across, down, id) {
  const s = surface.svg({ width: W * across, height: H * down, id: id || 'seam' });
  for (let j = 0; j < down; j++) {
    for (let i = 0; i < across; i++) {
      s.save();
      s.translate(i * W, j * H);
      paint(s, W, H);
      s.restore();
    }
  }
  return s.toSVG();
}

// Ink as four channels, so a seam that only shows in one of them still shows.
function pixels(svgString, widthPx) {
  const r = new Resvg(svgString, { fitTo: { mode: 'width', value: Math.max(2, Math.round(widthPx)) },
    background: 'rgba(255,255,255,255)' }).render();
  return { w: r.width, h: r.height, px: r.pixels };
}

// How much one column differs from the column to its left, summed down the
// image and over the channels. Mean per pixel, so the number does not depend
// on how tall the rendering is.
function columnChange(img) {
  const { w, h, px } = img;
  const out = new Float64Array(w);
  for (let x = 1; x < w; x++) {
    let s = 0;
    for (let y = 0; y < h; y++) {
      const a = (y * w + x) * 4, b = (y * w + x - 1) * 4;
      s += Math.abs(px[a] - px[b]) + Math.abs(px[a + 1] - px[b + 1])
        + Math.abs(px[a + 2] - px[b + 2]) + Math.abs(px[a + 3] - px[b + 3]);
    }
    out[x] = s / h;
  }
  return out;
}

function rowChange(img) {
  const { w, h, px } = img;
  const out = new Float64Array(h);
  for (let y = 1; y < h; y++) {
    let s = 0;
    for (let x = 0; x < w; x++) {
      const a = (y * w + x) * 4, b = ((y - 1) * w + x) * 4;
      s += Math.abs(px[a] - px[b]) + Math.abs(px[a + 1] - px[b + 1])
        + Math.abs(px[a + 2] - px[b + 2]) + Math.abs(px[a + 3] - px[b + 3]);
    }
    out[y] = s / w;
  }
  return out;
}

// Where the seam sits, measured over a band rather than a single column.
//
// Comparing one column against every other column does not work, and it took a
// striped tile to show it. The change between neighbouring columns is bimodal:
// almost every column is flat and a few are the edge of a shape. A seam that
// happens to land on an edge is then indistinguishable from an edge, and an
// edge that happens to land on the seam scores three standard deviations while
// being nothing at all — stripes with a period of ten on a hundred-unit tile,
// seamless by arithmetic, read 2.88.
//
// It also misses the other kind of seam entirely. Stripes with a period of
// thirteen on a hundred-unit tile leave a gap of nine at the join instead of
// thirteen. Every transition there is an ordinary dark-to-light edge; what is
// wrong is the rhythm, and no single column knows about rhythm.
//
// So the change is smoothed over a band a fraction of the tile wide before
// anything is compared. A band holds several periods of whatever the pattern
// is doing, so a band that crosses the join is compared against bands that do
// not, and both kinds of fault show up as the same number: too much change in
// that neighbourhood, or too little.
function smooth(values, halfWidth) {
  const n = values.length, out = new Float64Array(n);
  let sum = 0, count = 0;
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      for (let k = -halfWidth; k <= halfWidth; k++) { const j = i + k; if (j >= 1 && j < n) { sum += values[j]; count++; } }
    } else {
      const add = i + halfWidth, drop = i - halfWidth - 1;
      if (add >= 1 && add < n) { sum += values[add]; count++; }
      if (drop >= 1 && drop < n) { sum -= values[drop]; count--; }
    }
    out[i] = count ? sum / count : 0;
  }
  return out;
}

// The seam's band against every other band. The bands that overlap a seam are
// left out of the distribution they are compared against — including them
// would let a bad seam raise the bar it has to clear, which is how a check ends
// up unable to fail. The absolute difference is used, so a join that is too
// quiet is caught as well as one that is too busy: a tile whose edges both fade
// to the ground repeats without a visible join and without the pattern, and
// that is a fault of a different kind.
function zAt(values, marks, halfWidth) {
  const band = smooth(values, halfWidth);
  const isMark = new Set();
  for (const m of marks) for (let d = -halfWidth * 2; d <= halfWidth * 2; d++) isMark.add(m + d);
  // The ends of the image are left out too. A band there is averaged over
  // fewer columns than a band in the middle, so it is noisier for a reason
  // that has nothing to do with the tile, and it was setting the bar the seam
  // had to clear.
  const edge = halfWidth + 2;
  const usable = (i) => i >= edge && i < band.length - edge && !isMark.has(i);
  let n = 0, sum = 0, sum2 = 0;
  for (let i = 1; i < band.length; i++) {
    if (!usable(i)) continue;
    n++; sum += band[i]; sum2 += band[i] * band[i];
  }
  if (n < 8) return { z: 0, worst: 0, mean: 0, sd: 0 };
  const mean = sum / n;
  const sd = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
  let worst = 0, at = null, signed = 0;
  for (const m of marks) {
    for (let d = -2; d <= 2; d++) {
      const v = band[m + d];
      if (v == null) continue;
      const off = Math.abs(v - mean);
      if (off > worst) { worst = off; signed = v - mean; at = m + d; }
    }
  }
  // How far from the mean the most unusual band that is *not* a seam gets.
  //
  // A z on its own is not enough, because a pattern with real large-scale
  // structure in it has bands that differ from each other by a lot, honestly,
  // and the seam has to be judged against those rather than against a mean. A
  // seam that is no further out than the furthest ordinary band is not a seam;
  // it is one more band. `beyond` is the number that says so, and it needs no
  // threshold: at or below 1 there is nothing at the join the pattern does not
  // do elsewhere.
  let mostInterior = 0;
  for (let i = 1; i < band.length; i++) {
    if (!usable(i)) continue;
    const off = Math.abs(band[i] - mean);
    if (off > mostInterior) mostInterior = off;
  }
  return { z: sd > 1e-9 ? worst / sd : (worst > 1e-6 ? Infinity : 0),
    beyond: mostInterior > 1e-9 ? worst / mostInterior : (worst > 1e-6 ? Infinity : 0),
    worst, mean, sd, at, signed, mostInterior };
}

// The measurement. `paint(surface, W, H)` draws one tile at the origin; W and H
// are the tile's own size in its own units.
function check(paint, W, H, opts) {
  const o = opts || {};
  const across = o.across || 3, down = o.down || 3;
  const tilePx = o.tilePx || 180;
  const img = pixels(layout(paint, W, H, across, down, o.id), tilePx * across);
  const cw = img.w / across, ch = img.h / down;
  const vMarks = [], hMarks = [];
  for (let i = 1; i < across; i++) vMarks.push(Math.round(i * cw));
  for (let i = 1; i < down; i++) hMarks.push(Math.round(i * ch));
  // A band wide enough to hold several periods of whatever the pattern does,
  // and narrow enough that a fault at the join is not diluted by the interior.
  // An eighth of the tile: at 180 pixels a tile that is 22 pixels either side.
  const half = Math.max(4, Math.round((o.band || 0.125) * tilePx));
  const v = zAt(columnChange(img), vMarks, half);
  const h = zAt(rowChange(img), hMarks, half);
  return { across: v, down: h, z: Math.max(v.z, h.z),
    beyond: Math.max(v.beyond, h.beyond), width: img.w, height: img.h };
}

module.exports = { check, layout, pixels, columnChange, rowChange, zAt, smooth };
