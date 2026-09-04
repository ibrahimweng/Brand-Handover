'use strict';
// Everything here is measured off the artwork rather than typed in by hand.
// That is the whole point: a number a designer typed can be wrong, and a number
// read off the master cannot.
const { Resvg } = require('@resvg/resvg-js');
const svgu = require('./svg');

// The bounding box of everything that actually puts ink on the page, in the
// document's own user units. Measured by rendering and reading the alpha
// channel, so strokes, round caps and overlaps are all accounted for.
function inkBox(svgString, scale = 6) {
  const doc = svgu.parse(svgString);
  const vb = svgu.viewBox(doc);
  const r = new Resvg(svgString, {
    fitTo: { mode: 'width', value: Math.max(1, Math.round(vb.w * scale)) },
    background: 'rgba(0,0,0,0)',
  });
  const img = r.render();
  const { width: W, height: H } = img;
  const px = img.pixels;

  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < H; y++) {
    const row = y * W * 4;
    for (let x = 0; x < W; x++) {
      if (px[row + x * 4 + 3] > 8) {          // alpha above a nudge of noise
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error('the artwork renders empty, so it cannot be measured');

  const sx = vb.w / W, sy = vb.h / H;
  return {
    x: svgu.round(vb.x + minX * sx),
    y: svgu.round(vb.y + minY * sy),
    w: svgu.round((maxX - minX + 1) * sx),
    h: svgu.round((maxY - minY + 1) * sy),
  };
}

// Clear space is a fraction of the mark's own ink height, so it scales with the
// artwork instead of being a number somebody has to remember.
const clearSpace = (box, ratio) => svgu.round(box.h * ratio);

// The stroke is the first thing to fail as a mark gets smaller. Below these
// sizes it thins past what a screen or a press can hold.
function minimumSize(svgString, rules) {
  const doc = svgu.parse(svgString);
  const vb = svgu.viewBox(doc);
  const stroke = svgu.thinnestStroke(doc);
  if (!stroke) return { screenPx: null, printMm: null, thinnestStroke: null, note: 'no painted stroke, so nothing limits the size' };
  const ratio = vb.w / stroke;                 // how many stroke widths wide the box is
  return {
    thinnestStroke: stroke,
    screenPx: Math.ceil(ratio * rules.minStrokePx),
    printMm: svgu.round(ratio * rules.minStrokeMm, 1),
    basis: `box ${vb.w} ÷ stroke ${stroke} = ${svgu.round(ratio, 2)} stroke widths across`,
  };
}

function renderPng(svgString, widthPx) {
  return new Resvg(svgString, {
    fitTo: { mode: 'width', value: widthPx },
    background: 'rgba(0,0,0,0)',
  }).render().asPng();
}

module.exports = { inkBox, clearSpace, minimumSize, renderPng };
