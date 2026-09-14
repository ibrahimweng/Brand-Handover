/* The mark, grown into cell tissue.

   PLAYGRND's Pith builds a field of soft cells — a Voronoi relaxed by a wobble
   — bands the distance inside each cell into rings, dithers the band edges so
   they break up like a printed tint, and runs veins along the boundaries. It
   looks like something under a microscope, which is the point: it is the one
   texture in the set that reads as grown rather than as made.

   The seeds are the drawing. Where the mark has ink the cells are dealt dense
   and small; where it has none they are sparse and large. So the tissue is
   coarse-grained around the logo and fine-grained inside it, and the shape
   shows as a change of texture rather than as a change of colour — which is the
   one way a logo can be in a pattern without being printed on it.

   Toroidal distance throughout, so the tile has no join: a cell whose seed sits
   near the left edge owns territory on the right, which is what a seamless
   Voronoi means and what makes this repeat at all. */
//
// UMD: `paint` runs in the studio, which has no require.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../rand'), require('../noise'), require('../motif'), require('../grid'));
  } else root.PatternPith = factory(root.PatternRand, root.PatternNoise, root.PatternMotif, root.PatternGrid);
}(typeof self !== 'undefined' ? self : this, function (RAND, NOISE, MOTIF, GRID) {
  'use strict';

  const frac = (v) => v - Math.floor(v);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // The 4×4 ordered matrix. A dither this shallow is what a printed tint does
  // at the edge of a band, and a random one is what a photocopier does.
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  /* Where the cells are seeded.

     Dealt on a jittered grid rather than at random: a random scatter leaves
     holes the size of three cells and clumps of six, and tissue does neither.
     The jitter is what stops it reading as a grid, and the mark decides how
     much of it there is — dense and regular where there is ink, loose and large
     where there is not. */
  function seeds(p) {
    const n = Math.max(1, Math.round(p.cells));
    const seed = (p.seed || 1) * 107;
    const reps = Math.max(1, Math.round(p.repeat));
    const out = [];
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n, v = (j + 0.5) / n;
        const on = p.mark > 0 ? MOTIF.inside(p.motif, frac(u * reps), frac(v * reps), p.spread) : 0;
        // Outside the drawing, some seeds are simply not dealt — that is what
        // makes those cells larger, rather than a second size parameter.
        if (!on && RAND.hash01(i, j, seed + 1) < p.mark * 0.55) continue;
        const jx = (RAND.hash01(i, j, seed + 2) - 0.5) * (on ? 0.5 : 1.1) / n;
        const jy = (RAND.hash01(i, j, seed + 3) - 0.5) * (on ? 0.5 : 1.1) / n;
        out.push([frac(u + jx), frac(v + jy), on]);
      }
    }
    return out.length ? out : [[0.5, 0.5, 0]];
  }

  // Squared distance on a torus. The straight one gives a tile with a join.
  const d2 = (ax, ay, bx, by) => {
    const dx = Math.abs(ax - bx), dy = Math.abs(ay - by);
    const x = Math.min(dx, 1 - dx), y = Math.min(dy, 1 - dy);
    return x * x + y * y;
  };

  function paint(surface, W, H, p, pal) {
    const S = seeds(p);
    const cols = Math.max(24, Math.round(p.resolution));
    const rows = Math.max(24, Math.round(cols * (H / W)));
    const seed = (p.seed || 1) * 107;
    const P = Math.max(1, Math.round(p.zoom));
    // Ink 0 is the vein, the rest are the bands. The ground is the paper the
    // tissue sits on.
    const vein = pal.inks[0].hex;
    const band = pal.inks.length > 1 ? pal.inks.slice(1) : pal.inks;
    const colours = [vein].concat(band.map((k) => k.hex));

    pal.paper(surface, W, H, pal.ground);

    const at = (i, j) => {
      let u = (i + 0.5) / cols, v = (j + 0.5) / rows;
      // The wobble. Periodic noise, so the cell walls bend without the tile
      // losing its join.
      if (p.wobble > 0) {
        u += (NOISE.noise2(u * P * 3, v * P * 3, P * 3, P * 3, seed + 4) - 0.5) * p.wobble * 0.12;
        v += (NOISE.noise2(u * P * 3 + 5, v * P * 3 + 5, P * 3, P * 3, seed + 5) - 0.5) * p.wobble * 0.12;
        u = frac(u); v = frac(v);
      }
      // Nearest and second nearest. Their difference is the distance to the
      // wall, which is what a vein is drawn on.
      let best = 4, next = 4, who = 0;
      for (let k = 0; k < S.length; k++) {
        const d = d2(u, v, S[k][0], S[k][1]);
        if (d < best) { next = best; best = d; who = k; } else if (d < next) next = d;
      }
      const wall = Math.sqrt(next) - Math.sqrt(best);
      if (p.veins > 0 && wall < p.thickness * 0.02 * p.veins * 3) return 0;
      // Distance from the seed, banded, with the band edge dithered.
      const r = Math.sqrt(best) * Math.max(1, Math.round(p.cells)) / (0.25 + p.size);
      const bands = Math.max(1, band.length);
      const t = r / (0.2 + p.width);
      const dith = (BAYER[(j & 3) * 4 + (i & 3)] / 16 - 0.5) * p.dither * 0.8;
      const k = Math.floor(t + dith);
      // Grain: a flat chance of a cell taking the wrong band, which is what
      // gives the print its tooth.
      const g = RAND.hash01(i, j, seed + 6) < p.grain * 0.25 ? 1 : 0;
      return 1 + (((k + g) % bands) + bands) % bands;
    };
    GRID.cells(surface, W, H, cols, rows, at, colours);
  }

  const controls = [
    { group: 'field', key: 'cells', primary: true, label: 'Cells', type: 'range', min: 1, max: 40, step: 1 },
    { group: 'field', key: 'size', primary: true, label: 'Size', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'field', key: 'zoom', label: 'Wobble scale', type: 'range', min: 1, max: 8, step: 1 },
    { group: 'field', key: 'resolution', label: 'Resolution', type: 'range', min: 40, max: 260, step: 2 },
    { group: 'cells', key: 'wobble', label: 'Wobble', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'cells', key: 'width', label: 'Band width', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'cells', key: 'dither', label: 'Dither', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'cells', key: 'grain', label: 'Grain', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'veins', key: 'veins', primary: true, label: 'Veins', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'veins', key: 'thickness', label: 'Thickness', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'mark', key: 'mark', label: 'Seeded by the mark', type: 'range', min: 0, max: 1, step: 0.01,
      needs: { of: 'motif', key: 'masked', least: 1,
        without: 'No bitmap could be taken of this shape — it is finer than the grid that '
          + 'reads it. The cells are seeded evenly instead.' } },
    { group: 'mark', key: 'repeat', label: 'Marks across', type: 'range', min: 1, max: 6, step: 1 },
    { group: 'mark', key: 'spread', label: 'Mark size', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'mark', key: 'seed', label: 'Seed', type: 'seed' },
  ];

  return { key: 'pith', kind: 'texture', vector: true, motif: true, ratio: 1,
    controls, paint, seeds };
}));
