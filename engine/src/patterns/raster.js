/* The other kind of pattern.

   Five of the six generators draw shapes and come out as vector. One does not:
   a posterised noise field is a decision taken per pixel, and the honest vector
   form of it is a hundred thousand little polygons that no designer wants and
   no printer thanks you for. It ships as raster, at a size the package states,
   and the manual says so in those words.

   That is a fact a client needs rather than a thing to hide, so this module
   makes the fact easy to state: a field knows its own size in pixels and in
   millimetres at the resolution it was written for, and `printedAt` says how
   large it may be printed before a pixel becomes visible.

   Determinism is the same requirement as everywhere else. fast-png with fixed
   options gives the same bytes for the same field on every run, which
   test/run.js checks rather than assumes. */
'use strict';
const { encode } = require('fast-png');

// A field is RGBA, eight bits, top-left origin — the same layout resvg hands
// back, so a field and a rendered vector tile can be measured by the same code.
function field(w, h) {
  const W = Math.max(1, Math.round(w)), H = Math.max(1, Math.round(h));
  const data = new Uint8Array(W * H * 4);
  return {
    width: W, height: H, data,
    set(x, y, r, g, b, a) {
      const i = ((y | 0) * W + (x | 0)) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a == null ? 255 : a;
    },
    fill(r, g, b, a) {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a == null ? 255 : a;
      }
    },
  };
}

const png = (f) => Buffer.from(encode({ width: f.width, height: f.height, data: f.data, channels: 4, depth: 8 }));

// The largest a field may be printed before its pixels are addressable by eye.
// 300 dots to the inch is the number every printer quotes; a millimetre is
// 300/25.4 of them.
const DPI = 300;
const printedAt = (f, dpi) => ({
  mm: +(f.width / ((dpi || DPI) / 25.4)).toFixed(1),
  mmHigh: +(f.height / ((dpi || DPI) / 25.4)).toFixed(1),
  dpi: dpi || DPI,
});

module.exports = { field, png, printedAt, DPI };
