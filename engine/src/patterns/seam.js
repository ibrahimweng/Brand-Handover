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

// The tile, laid out the way a designer lays it out.
function layout(tileBody, W, H, across, down, id) {
  const p = id || 'seamtile';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W * across}" height="${H * down}"`
    + ` viewBox="0 0 ${W * across} ${H * down}">`
    + `<defs><pattern id="${p}" width="${W}" height="${H}" patternUnits="userSpaceOnUse">${tileBody}</pattern></defs>`
    + `<rect width="${W * across}" height="${H * down}" fill="url(#${p})"/></svg>`;
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

// Where the seam sits in the distribution of ordinary neighbours.
//
// The seam lines themselves are left out of the distribution they are compared
// against — including them would let a bad seam raise the bar it has to clear,
// which is how a check ends up unable to fail.
function zAt(values, marks, skip) {
  const isMark = new Set();
  for (const m of marks) for (let d = -skip; d <= skip; d++) isMark.add(m + d);
  let n = 0, sum = 0, sum2 = 0;
  for (let i = 1; i < values.length; i++) {
    if (isMark.has(i)) continue;
    n++; sum += values[i]; sum2 += values[i] * values[i];
  }
  if (n < 8) return { z: 0, worst: 0, mean: 0, sd: 0 };
  const mean = sum / n;
  const sd = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
  let worst = 0, at = null;
  for (const m of marks) {
    // the largest change anywhere within a pixel or two of the boundary, since
    // the boundary may not land exactly on a pixel edge after scaling
    for (let d = -skip; d <= skip; d++) {
      const v = values[m + d];
      if (v == null) continue;
      if (v > worst) { worst = v; at = m + d; }
    }
  }
  return { z: sd > 1e-9 ? (worst - mean) / sd : (worst > mean + 1e-9 ? Infinity : 0),
    worst, mean, sd, at };
}

// The measurement. `tileBody` is what a surface's body() returns; W and H are
// the tile's own size in its own units.
function check(tileBody, W, H, opts) {
  const o = opts || {};
  const across = o.across || 3, down = o.down || 3;
  const tilePx = o.tilePx || 180;
  const img = pixels(layout(tileBody, W, H, across, down, o.id), tilePx * across);
  const cw = img.w / across, ch = img.h / down;
  const vMarks = [], hMarks = [];
  for (let i = 1; i < across; i++) vMarks.push(Math.round(i * cw));
  for (let i = 1; i < down; i++) hMarks.push(Math.round(i * ch));
  const skip = o.skip == null ? 2 : o.skip;
  const v = zAt(columnChange(img), vMarks, skip);
  const h = zAt(rowChange(img), hMarks, skip);
  return { across: v, down: h, z: Math.max(v.z, h.z), width: img.w, height: img.h };
}

module.exports = { check, layout, pixels, columnChange, rowChange, zAt };
