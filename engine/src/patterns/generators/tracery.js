/* Outlined solids, overlapping, drawn in one line.

   From a reference: a half-drop repeat of geometric forms — a stadium turned on
   its side, a cube drawn in isometric outline — in a hairline on a flat ground,
   overlapping so that the outlines cross and the crossings make shapes neither
   form contains. Line only. No fill anywhere.

   Two things make it work and both are easy to miss.

   The first is that the forms *overlap* rather than tile. A repeat of shapes
   that meet at their edges is a mosaic; a repeat of shapes that pass through
   each other is tracery, and every intersection is a new figure. The lattice is
   therefore tighter than the forms are wide, which is the opposite of how a
   motif lattice is set.

   The second is that the line is one weight everywhere, including where four
   lines cross. That means no shape may be filled — a filled shape hides the
   lines behind it and the crossings stop happening. Everything here is stroked
   and nothing is filled, which is also why it survives being printed at any
   size on anything.

   The forms are built from the client's own proportions rather than drawn: how
   wide against how tall, how much of the turning is on a curve, how heavy the
   stroke runs. A curvy mark gets stadiums and arcs; a cornered one gets cubes
   and folded plates. */
//
// UMD: `paint` runs in the studio, which has no require.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else root.PatternTracery = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const R3 = (v) => Math.round(v * 1000) / 1000;
  const TAU = Math.PI * 2;
  const FORMS = ['stadium', 'cube', 'plate', 'arch'];
  const mod = (n, p) => ((n % p) + p) % p;

  /* One form, centred on the origin, `r` to a side. Every one is a path only —
     the caller strokes it once for all of them, so the weight cannot drift
     between forms. */
  function form(s, kind, r, lean) {
    const a = r, b = r * lean;
    if (kind === 'stadium') {
      // A rectangle with two half-round ends, laid on its side.
      const h = b * 0.62;
      s.moveTo(R3(-a + h), R3(-h)); s.lineTo(R3(a - h), R3(-h));
      s.arc(R3(a - h), 0, h, -Math.PI / 2, Math.PI / 2);
      s.lineTo(R3(-a + h), R3(h));
      s.arc(R3(-a + h), 0, h, Math.PI / 2, Math.PI * 1.5);
      s.closePath();
      return;
    }
    if (kind === 'cube') {
      // An isometric box: the front face, and two edges running back. Drawn as
      // an outline rather than three filled faces for the reason above.
      const d = a * 0.46;
      s.moveTo(R3(-a), R3(-b)); s.lineTo(R3(a - d), R3(-b));
      s.lineTo(R3(a - d), R3(b)); s.lineTo(R3(-a), R3(b)); s.closePath();
      s.moveTo(R3(-a), R3(-b)); s.lineTo(R3(-a + d), R3(-b - d));
      s.lineTo(R3(a), R3(-b - d)); s.lineTo(R3(a), R3(b - d));
      s.lineTo(R3(a - d), R3(b));
      s.moveTo(R3(a - d), R3(-b)); s.lineTo(R3(a), R3(-b - d));
      return;
    }
    if (kind === 'plate') {
      // A square folded once: two rectangles sharing an edge, which is the
      // simplest figure that reads as having a front and a side.
      s.moveTo(R3(-a), R3(-b)); s.lineTo(R3(0), R3(-b)); s.lineTo(R3(0), R3(b));
      s.lineTo(R3(-a), R3(b)); s.closePath();
      s.moveTo(R3(0), R3(-b)); s.lineTo(R3(a), R3(-b * 0.55));
      s.lineTo(R3(a), R3(b * 1.45)); s.lineTo(R3(0), R3(b)); s.closePath();
      return;
    }
    // arch: a half-round on a pair of legs, the oldest outline there is
    s.moveTo(R3(-a), R3(b)); s.lineTo(R3(-a), R3(0));
    s.arc(0, 0, a, Math.PI, 0);
    s.lineTo(R3(a), R3(b));
    s.moveTo(R3(-a * 0.42), R3(b)); s.lineTo(R3(-a * 0.42), R3(-a * 0.2));
    s.arc(0, R3(-a * 0.2), a * 0.42, Math.PI, 0);
    s.lineTo(R3(a * 0.42), R3(b));
  }

  function paint(surface, W, H, p, pal) {
    const ground = pal.ground;
    const line = pal.ink(Math.max(0, Math.min(pal.inks.length - 1, Math.round(p.ink))));
    pal.paper(surface, W, H, ground);

    const cols = Math.max(1, Math.round(p.cells));
    const stepX = W / cols;
    let rows = Math.max(2, Math.round(cols * (H / W)));
    if (p.drop > 0 && rows % 2) rows += 1;     // a half-drop over an odd count meets itself
    const stepY = H / rows;
    // Wider than the cell, on purpose: the forms have to pass through each
    // other or this is a mosaic. At `reach` 1 a form is exactly its cell and
    // nothing crosses.
    const r = Math.min(stepX, stepY) * 0.5 * p.reach;
    const forms = FORMS.slice(0, Math.max(1, Math.min(FORMS.length, Math.round(p.forms))));

    surface.strokeStyle = line;
    surface.fillStyle = 'none';
    surface.lineWidth = Math.max(0.35, Math.min(stepX, stepY) * p.weight);
    surface.lineJoin = 'round';
    surface.lineCap = 'butt';
    surface.beginPath();
    for (let j = -1; j <= rows; j++) {
      for (let i = -1; i <= cols; i++) {
        // Dealt modulo the lattice so the arrangement comes round with the tile.
        const k = mod(mod(i, cols) + mod(j, rows) * 2, forms.length);
        const drop = mod(j, 2) ? stepX * p.drop : 0;
        const cx = (i + 0.5) * stepX + drop;
        const cy = (j + 0.5) * stepY;
        surface.save();
        surface.translate(R3(cx), R3(cy));
        if (p.turn) surface.rotate(mod(i + j, 2) ? p.turn * Math.PI : 0);
        form(surface, forms[k], r, Math.max(0.35, Math.min(1.6, p.lean)));
        surface.restore();
      }
    }
    surface.stroke();
  }

  const controls = [
    { group: 'pattern', key: 'forms', primary: true, label: 'Forms in play', type: 'range', min: 1, max: 4, step: 1 },
    { group: 'pattern', key: 'cells', primary: true, label: 'Cells across', type: 'range', min: 1, max: 10, step: 1 },
    { group: 'pattern', key: 'reach', primary: true, label: 'Overlap', type: 'range', min: 0.7, max: 2.4, step: 0.02 },
    { group: 'pattern', key: 'lean', label: 'Proportion', type: 'range', min: 0.35, max: 1.6, step: 0.02 },
    { group: 'pattern', key: 'drop', label: 'Row drop', type: 'range', min: 0, max: 1, step: 0.02 },
    { group: 'pattern', key: 'turn', label: 'Alternate turn', type: 'range', min: 0, max: 1, step: 0.02 },
    { group: 'pattern', key: 'weight', label: 'Line', type: 'range', min: 0.004, max: 0.08, step: 0.002 },
    { group: 'pattern', key: 'ink', label: 'Ink', type: 'range', min: 0, max: 5, step: 1 },
    { group: 'pattern', key: 'seed', label: 'Seed', type: 'seed' },
  ];

  return { key: 'tracery', kind: 'pattern', vector: true, motif: false, ratio: 1,
    controls, paint, form, FORMS };
}));
