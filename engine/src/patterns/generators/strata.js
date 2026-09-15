/* Panels of banded sky over a dithered horizon.

   From a reference: three horizontal panels stacked, each a gradient sky
   running from one ink to another, a dithered band where the two meet, and a
   silhouette along the bottom — hills, a treeline, a city. Small marks in the
   margins. A risograph print of a landscape, made of steps rather than of a
   smooth blend.

   Steps rather than a blend is the whole of it. A gradient in a brand pattern
   is a file that prints as a band of mud on anything but a screen, and it
   cannot be separated into two spot inks. Stepping it — a fixed number of flat
   bands, with an ordered dither along each boundary — gives the same reading at
   any size, prints in two inks, and is a decision a person can count.

   The dither is ordered rather than random. A random dither between two bands
   is noise that will not repeat across a tile edge and will not print twice the
   same; an ordered one is a fixed threshold matrix, so the same boundary always
   breaks up the same way and the tile comes round.

   The horizon comes from the mark where the mark can be read as a bitmap: its
   own silhouette becomes the skyline, so the thing on the horizon is the
   client's drawing rather than a hill somebody drew. Where it cannot, the
   skyline is built from the identity's own proportions instead. */
//
// UMD: `paint` runs in the studio, which has no require.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../rand'), require('../motif'), require('../tone'));
  } else root.PatternStrata = factory(root.PatternRand, root.PatternMotif, root.PatternTone);
}(typeof self !== 'undefined' ? self : this, function (RAND, MOTIF, TONE) {
  'use strict';

  const R3 = (v) => Math.round(v * 1000) / 1000;
  const SKIES = ['dawn', 'dusk', 'flat', 'inverted'];
  const mod = (n, p) => ((n % p) + p) % p;

  /* The ordered dither: a 4x4 Bayer matrix, as the threshold at a cell.

     Fixed rather than seeded, because an ordered dither is the same everywhere
     or it is not ordered — that is what makes the boundary between two bands
     print the same twice and come round at the tile's edge. */
  const BAYER = [
    [0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5],
  ];
  const threshold = (i, j) => (BAYER[mod(j, 4)][mod(i, 4)] + 0.5) / 16;

  /* The skyline, as a height in tile units at a given x.

     From the mark's bitmap where there is one: the column's tallest inked cell
     becomes the horizon at that point, so the client's own drawing is the
     thing on the skyline. Otherwise from the identity's proportions, as a sum
     of two waves whose periods divide the tile — so it repeats exactly. */
  function skyline(u, p, mask, cols) {
    if (mask && p.mark > 0) {
      const i = Math.min(cols - 1, Math.max(0, Math.floor(u * cols)));
      let top = 1;
      for (let j = 0; j < cols; j++) {
        if (MOTIF.inside(mask, (i + 0.5) / cols, (j + 0.5) / cols, p.spread)) { top = j / cols; break; }
      }
      return 1 - (1 - top) * p.mark;
    }
    const a = Math.sin(u * Math.PI * 2 * Math.max(1, Math.round(p.ridges)));
    const b = Math.sin(u * Math.PI * 2 * Math.max(1, Math.round(p.ridges) * 2) + 1.2);
    return 0.5 + (a * 0.62 + b * 0.38) * 0.5 * p.relief;
  }

  function paint(surface, W, H, p, pal) {
    const sky = SKIES.indexOf(p.sky) > -1 ? p.sky : SKIES[0];
    const ground = pal.ground;
    pal.paper(surface, W, H, ground);
    const panels = Math.max(1, Math.round(p.panels));
    const ph = H / panels;
    const gap = Math.min(ph * 0.4, ph * p.gap);
    const steps = Math.max(2, Math.round(p.steps));
    const cells = Math.max(8, Math.round(p.grain));
    const cw = W / cells;
    const m = p.motif;
    const mask = m && m.mask ? m : null;

    // Two inks and the ground make a sky. Which two is the identity's choice,
    // not this file's.
    const top = pal.ink(Math.max(0, Math.min(pal.inks.length - 1, Math.round(p.top))));
    const bottom = pal.inks.length > 1
      ? pal.ink(Math.max(0, Math.min(pal.inks.length - 1, Math.round(p.bottom))))
      : TONE.mix(pal.ink(0), ground, 0.55);
    const land = TONE.mix(pal.ink(0), ground, sky === 'inverted' ? 0.82 : 0.06);

    for (let pn = 0; pn < panels; pn++) {
      const y0 = pn * ph, y1 = y0 + ph - gap;
      const ch = Math.max(1, (y1 - y0) / Math.max(1, Math.round((y1 - y0) / cw)));
      const rows = Math.max(2, Math.round((y1 - y0) / ch));

      /* The sky, stepped and dithered. Drawn cell by cell rather than as bands,
         because the dither needs a cell to threshold — and collected per colour
         so the whole panel is two paths rather than ten thousand rectangles. */
      const byInk = new Map();
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cells; i++) {
          const v0 = j / Math.max(1, rows - 1);
          const v = sky === 'dusk' ? 1 - v0 : sky === 'flat' ? 0.5 : v0;
          // Which step this cell falls in, and how far through it
          const f = Math.max(0, Math.min(0.999, v)) * (steps - 1);
          const k = Math.floor(f);
          const frac = f - k;
          // The dither pushes a cell up a step when it beats the threshold,
          // which is what makes the boundary break up rather than cut.
          const up = frac > threshold(i, j) ? 1 : 0;
          const at = Math.min(steps - 1, k + up) / (steps - 1);
          const hex = TONE.mix(top, bottom, at);
          if (!byInk.has(hex)) byInk.set(hex, []);
          byInk.get(hex).push([i, j]);
        }
      }
      for (const [hex, list] of byInk) {
        surface.fillStyle = hex;
        surface.beginPath();
        for (const [i, j] of list) {
          surface.rect(R3(i * cw), R3(y0 + j * ch), R3(cw) + 0.3, R3(ch) + 0.3);
        }
        surface.fill();
      }

      /* The horizon: a silhouette across the bottom of the panel, drawn as a
         step per cell so it agrees with the dither's grain rather than cutting
         across it with a smooth curve. */
      if (p.relief > 0 || (mask && p.mark > 0)) {
        surface.fillStyle = land;
        surface.beginPath();
        surface.moveTo(0, R3(y1));
        for (let i = 0; i <= cells; i++) {
          const u = mod(i / cells, 1);
          const hgt = Math.max(0.02, Math.min(0.94, skyline(u, p, mask, cells)));
          const y = y0 + (y1 - y0) * hgt;
          surface.lineTo(R3(i * cw), R3(y));
          surface.lineTo(R3((i + 1) * cw), R3(y));
        }
        surface.lineTo(W, R3(y1));
        surface.closePath();
        surface.fill();
      }
    }
  }

  const controls = [
    { group: 'pattern', key: 'sky', primary: true, label: 'Sky', type: 'chips', options: SKIES },
    { group: 'pattern', key: 'panels', primary: true, label: 'Panels', type: 'range', min: 1, max: 5, step: 1 },
    { group: 'pattern', key: 'steps', primary: true, label: 'Steps in the sky', type: 'range', min: 2, max: 16, step: 1 },
    { group: 'pattern', key: 'grain', label: 'Grain', type: 'range', min: 8, max: 120, step: 1 },
    { group: 'pattern', key: 'gap', label: 'Between panels', type: 'range', min: 0, max: 0.3, step: 0.01 },
    { group: 'terrain', key: 'relief', label: 'Relief', type: 'range', min: 0, max: 1, step: 0.02 },
    { group: 'terrain', key: 'ridges', label: 'Ridges', type: 'range', min: 1, max: 8, step: 1 },
    { group: 'mark', key: 'mark', label: 'The mark on the skyline', type: 'range', min: 0, max: 1, step: 0.02,
      needs: { of: 'motif', key: 'masked', least: 1,
        without: 'This drawing could not be read as a bitmap, so the skyline is built from '
          + 'the identity’s proportions instead.' } },
    { group: 'mark', key: 'spread', label: 'Spread', type: 'range', min: 0, max: 1, step: 0.02 },
    { group: 'pattern', key: 'top', label: 'Ink at the top', type: 'range', min: 0, max: 5, step: 1 },
    { group: 'pattern', key: 'bottom', label: 'Ink at the horizon', type: 'range', min: 0, max: 5, step: 1 },
    { group: 'pattern', key: 'seed', label: 'Seed', type: 'seed' },
  ];

  return { key: 'strata', kind: 'pattern', vector: true, motif: true, ratio: 1,
    controls, paint, skyline, threshold, SKIES };
}));
