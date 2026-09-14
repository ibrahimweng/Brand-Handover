/* The mark, in halftone.

   PLAYGRND's Stipple lays dots on a lattice and sizes each one by a scalar
   field: in **lattice** mode a dot exists where the field beats a threshold and
   grows with how far above it sits — a tonal ramp, the way a printed halftone
   works; in **contour** mode a dot is kept with a probability that follows the
   field's *gradient*, so the dots gather along the steepest edges and read as
   contour lines with loose scatter filling the flats.

   The field is the drawing. A logo is a region of ink on a page, which is
   exactly what a halftone field is, so nothing has to be bent to fit: in
   lattice mode the dots fill the mark and thin out around it, and in contour
   mode they crowd its outline and leave both the inside and the outside airy.
   Contour is the default because it is the one that could not be got any other
   way — an outline made of dots is not a shape with a border, it is a shape
   the page has noticed.

   Both modes are normalised against the field's own range, so the threshold
   means the same thing whatever the drawing is. Without that a solid mark and
   an open one need different numbers to look the same, and the control stops
   being a control. */
//
// UMD: `paint` runs in the studio, which has no require.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../rand'), require('../noise'), require('../motif'));
  } else root.PatternStipple = factory(root.PatternRand, root.PatternNoise, root.PatternMotif);
}(typeof self !== 'undefined' ? self : this, function (RAND, NOISE, MOTIF) {
  'use strict';

  const R3 = (v) => Math.round(v * 1000) / 1000;
  const frac = (v) => v - Math.floor(v);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const MODES = ['contour', 'lattice'];
  const LATTICES = ['square', 'hex'];
  const SHAPES = ['circle', 'square', 'diamond'];

  /* The field, at a point in the unit square.

     Two terms and a control between them: the drawing, and a periodic noise
     field to give it a surface. Both are periodic, so the tile is. */
  function fieldOf(p) {
    const reps = Math.max(1, Math.round(p.repeat));
    const P = Math.max(1, Math.round(p.scale));
    const oct = Math.max(1, Math.min(6, Math.round(p.detail)));
    const seed = (p.seed || 1) * 83;
    return function at(u, v) {
      const q = NOISE.warp2(u * P, v * P, P, P, p.warp, 2, seed + 1);
      const n = NOISE.evenly(NOISE.fbm2(q[0], q[1], P, P, oct, seed + 2), oct);
      const on = p.mark > 0 ? MOTIF.inside(p.motif, frac(u * reps), frac(v * reps), p.spread) : 0;
      const t = on * p.mark + n * (1 - p.mark * 0.65);
      return clamp((t - 0.5) * p.contrast + 0.5, 0, 1);
    };
  }

  function dot(s, kind, cx, cy, r) {
    if (r <= 0) return;
    if (kind === 'square') { s.rect(R3(cx - r), R3(cy - r), R3(r * 2), R3(r * 2)); return; }
    if (kind === 'diamond') {
      s.moveTo(R3(cx), R3(cy - r)); s.lineTo(R3(cx + r), R3(cy));
      s.lineTo(R3(cx), R3(cy + r)); s.lineTo(R3(cx - r), R3(cy)); s.closePath(); return;
    }
    s.moveTo(R3(cx + r), R3(cy));
    s.arc(cx, cy, r, 0, Math.PI * 2);
    s.closePath();
  }

  function paint(surface, W, H, p, pal) {
    const at = fieldOf(p);
    const mode = MODES.indexOf(p.mode) > -1 ? p.mode : MODES[0];
    const hex = p.lattice === 'hex';
    const shape = SHAPES.indexOf(p.shape) > -1 ? p.shape : SHAPES[0];
    const cols = Math.max(6, Math.round(p.resolution));
    // A hex lattice is a row shorter for the same cell height, and the rows
    // have to divide the tile exactly or the offset flips at the join.
    const rows = Math.max(6, Math.round(cols * (H / W) * (hex ? 1.1547 : 1) / 2) * 2);
    const cw = W / cols, ch = H / rows;
    const seed = (p.seed || 1) * 89;
    const inks = pal.inks;

    pal.paper(surface, W, H, pal.ground);

    // The field's own range, measured on the grid it is about to be sampled on.
    // Normalising against this is what makes Cutout mean the same thing on a
    // solid mark and on an open one.
    let lo = 1, hi = 0;
    const F = new Float32Array(cols * rows);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const u = (i + (hex && (j & 1) ? 0.5 : 0) + 0.5) / cols, v = (j + 0.5) / rows;
        const f = at(u, v);
        F[j * cols + i] = f;
        if (f < lo) lo = f; if (f > hi) hi = f;
      }
    }
    const span = hi - lo || 1;
    const norm = (i, j) => (F[((j % rows) + rows) % rows * cols + (((i % cols) + cols) % cols)] - lo) / span;

    // One path per ink, so the tile is a handful of elements and a designer can
    // recolour a whole tone at once. The ink is chosen by binning the field,
    // which is what makes the palette read as a ramp rather than as confetti.
    for (let k = 0; k < inks.length; k++) {
      surface.beginPath();
      let any = false;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const f = norm(i, j);
          let keep, size;
          if (mode === 'lattice') {
            if (f <= p.cutout) continue;
            keep = true;
            size = (f - p.cutout) / (1 - p.cutout || 1);
          } else {
            // Central differences, wrapped — the gradient at the tile edge is
            // the gradient across the join, which is what keeps the contour
            // running through it.
            const gx = norm(i + 1, j) - norm(i - 1, j);
            const gy = norm(i, j + 1) - norm(i, j - 1);
            const g = Math.min(1, Math.hypot(gx, gy) * 3);
            keep = RAND.hash01(i, j, seed + 1) < p.scatter + p.edge * g;
            size = clamp(g * 1.4, 0.12, 1);
          }
          if (!keep) continue;
          const bin = Math.min(inks.length - 1, Math.floor(f * inks.length));
          if (bin !== k) continue;
          const jx = (RAND.hash01(i, j, seed + 2) - 0.5) * p.jitter * cw;
          const jy = (RAND.hash01(i, j, seed + 3) - 0.5) * p.jitter * ch;
          const cx = (i + (hex && (j & 1) ? 0.5 : 0) + 0.5) * cw + jx;
          const cy = (j + 0.5) * ch + jy;
          const r = Math.min(cw, ch) * 0.5 * p.size * (1 - p.variation + p.variation * size);
          dot(surface, shape, cx, cy, r);
          any = true;
        }
      }
      if (any) { surface.fillStyle = inks[k].hex; surface.fill(); }
    }
  }

  const controls = [
    { group: 'dots', key: 'mode', label: 'Mode', type: 'chips', options: MODES },
    { group: 'dots', key: 'lattice', label: 'Lattice', type: 'chips', options: LATTICES },
    { group: 'dots', key: 'shape', label: 'Shape', type: 'chips', options: SHAPES },
    { group: 'dots', key: 'resolution', label: 'Resolution', type: 'range', min: 12, max: 160, step: 1 },
    { group: 'dots', key: 'size', label: 'Dot size', type: 'range', min: 0.05, max: 1.4, step: 0.01 },
    { group: 'dots', key: 'variation', label: 'Size variation', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'dots', key: 'cutout', label: 'Cutout', type: 'range', min: 0, max: 0.95, step: 0.01 },
    { group: 'dots', key: 'jitter', label: 'Jitter', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'dots', key: 'edge', label: 'Edge pull', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'dots', key: 'scatter', label: 'Loose scatter', type: 'range', min: 0, max: 0.6, step: 0.01 },
    { group: 'field', key: 'scale', label: 'Field scale', type: 'range', min: 1, max: 12, step: 1 },
    { group: 'field', key: 'warp', label: 'Warp', type: 'range', min: 0, max: 3, step: 0.02 },
    { group: 'field', key: 'detail', label: 'Detail', type: 'range', min: 1, max: 6, step: 1 },
    { group: 'field', key: 'contrast', label: 'Contrast', type: 'range', min: 0.4, max: 4, step: 0.05 },
    { group: 'mark', key: 'mark', label: 'The mark in the field', type: 'range', min: 0, max: 1, step: 0.01,
      needs: { of: 'motif', key: 'masked', least: 1,
        without: 'No bitmap could be taken of this shape — it is finer than the grid that '
          + 'reads it. The field is noise alone.' } },
    { group: 'mark', key: 'repeat', label: 'Marks across', type: 'range', min: 1, max: 6, step: 1 },
    { group: 'mark', key: 'spread', label: 'Mark size', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'mark', key: 'seed', label: 'Seed', type: 'seed' },
  ];

  return { key: 'stipple', kind: 'texture', vector: true, motif: true, ratio: 1,
    controls, paint, fieldOf, MODES, LATTICES, SHAPES };
}));
