/* A line screen whose pitch is driven by a field.

   From a reference after Jacqueline Casey: vertical rules over blocks of
   colour, where the rules change their pitch and their thickness column by
   column, so the same flat colour reads light in one place and dense in
   another. A halftone made of lines rather than of dots, and the thing being
   screened is a coarse colour field rather than a photograph.

   What makes it this rather than a stripe: the screen is *modulated*. A stripe
   has one pitch. Here the pitch is a function of where you are, so the sheet
   has passages — a fine hard-edged band beside an open one — and the passages
   are what the eye reads, not the individual rules.

   What makes it this rather than a texture: the field under the screen is
   blocks, not noise. Rectangles snapped to a coarse grid, in the identity's own
   inks, the way a low-resolution bitmap is blocks. Noise under a line screen is
   a moiré; blocks under a line screen is a composition.

   The mark decides the block field: its bitmap, where it has one, sets which
   cells are inked and which are ground, so the logo is in the sheet as a
   *region* rather than as a drawing. Where it has none the blocks fall to the
   seeded field and the sheet is still the identity's colours at the identity's
   grain.

   The screen is drawn as one path per ink rather than one per rule: a thousand
   hairlines as a thousand elements is a file nobody can open. */
//
// UMD: `paint` runs in the studio, which has no require.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../rand'), require('../motif'), require('../tone'));
  } else root.PatternScreen = factory(root.PatternRand, root.PatternMotif, root.PatternTone);
}(typeof self !== 'undefined' ? self : this, function (RAND, MOTIF, TONE) {
  'use strict';

  const R3 = (v) => Math.round(v * 1000) / 1000;
  const RUNS = ['columns', 'rows', 'both'];
  const mod = (n, p) => ((n % p) + p) % p;

  /* The pitch at a point, as a multiple of the base pitch.

     A triangle over the tile rather than a ramp, because the screen has to come
     round: a pitch that runs fine-to-coarse left to right meets its own coarse
     end at the join. Out and back closes exactly and shows the same range. */
  function drive(u, bands, depth) {
    const n = Math.max(1, Math.round(bands));
    const x = mod(u * n, 1);
    const tri = 1 - Math.abs(2 * x - 1);
    return 1 + (tri - 0.5) * 2 * depth;
  }

  function paint(surface, W, H, p, pal) {
    const run = RUNS.indexOf(p.run) > -1 ? p.run : RUNS[0];
    const ground = pal.ground;
    pal.paper(surface, W, H, ground);
    const many = Math.max(1, Math.min(pal.inks.length, Math.round(p.colours)));
    const seed = (p.seed || 1) * 211;

    /* The block field under the screen. Coarse on purpose: this is the thing
       the screen is screening, and a fine one would compete with the rules
       rather than sit under them. */
    const bx = Math.max(2, Math.round(p.blocks));
    const by = Math.max(2, Math.round(bx * (H / W)));
    const m = p.motif;
    const mask = m && m.mask ? m : null;
    const byInk = new Map();
    for (let j = 0; j < by; j++) {
      for (let i = 0; i < bx; i++) {
        let k;
        if (mask && p.mark > 0) {
          // Inside the drawing takes the first ink, outside takes the rest.
          const inside = MOTIF.inside(mask, (i + 0.5) / bx, (j + 0.5) / by, p.spread);
          k = inside ? 0 : 1 + Math.floor(RAND.hash01(i, j, seed) * Math.max(1, many - 1));
        } else {
          k = Math.floor(RAND.hash01(i, j, seed) * many);
        }
        k = mod(k, many);
        // A share of the cells stay as ground, which is what gives the field
        // its air — a fully inked block field is a colour chart.
        if (RAND.hash01(i, j, seed + 7) > p.fill) k = -1;
        if (!byInk.has(k)) byInk.set(k, []);
        byInk.get(k).push([i, j]);
      }
    }
    const cw = W / bx, ch = H / by;
    for (const [k, cells] of byInk) {
      if (k < 0) continue;
      surface.fillStyle = pal.ink(k);
      surface.beginPath();
      // +0.35 so two neighbouring blocks of one colour do not anti-alias a
      // hairline of ground between them.
      for (const [i, j] of cells) surface.rect(R3(i * cw), R3(j * ch), R3(cw) + 0.35, R3(ch) + 0.35);
      surface.fill();
    }

    /* The screen itself: rules in the ground colour, laid over everything, at a
       pitch that changes across the sheet. Drawn in the ground rather than in
       an ink, because a screen lightens what is under it — that is what a
       screen is. */
    const base = Math.max(1.2, W / Math.max(4, Math.round(p.pitch)));
    surface.fillStyle = ground;
    surface.beginPath();
    if (run === 'columns' || run === 'both') {
      let x = 0;
      // Walked rather than indexed, because the pitch changes as it goes and a
      // loop over `i * pitch` would be a different pattern.
      while (x < W) {
        const f = drive(x / W, p.bands, p.depth);
        const step = base * f;
        const gap = step * Math.max(0.05, Math.min(0.95, p.duty));
        surface.rect(R3(x), 0, R3(Math.min(gap, W - x)), H);
        x += step;
      }
    }
    if (run === 'rows' || run === 'both') {
      let y = 0;
      while (y < H) {
        const f = drive(y / H, p.bands, p.depth);
        const step = base * f;
        const gap = step * Math.max(0.05, Math.min(0.95, p.duty));
        surface.rect(0, R3(y), W, R3(Math.min(gap, H - y)));
        y += step;
      }
    }
    surface.fill();
  }

  const controls = [
    { group: 'pattern', key: 'run', primary: true, label: 'Screen runs', type: 'chips', options: RUNS },
    { group: 'pattern', key: 'pitch', primary: true, label: 'Rules across', type: 'range', min: 8, max: 160, step: 1 },
    { group: 'pattern', key: 'depth', primary: true, label: 'Pitch change', type: 'range', min: 0, max: 0.9, step: 0.02 },
    { group: 'pattern', key: 'bands', label: 'Passages', type: 'range', min: 1, max: 8, step: 1 },
    { group: 'pattern', key: 'duty', label: 'Rule against gap', type: 'range', min: 0.1, max: 0.9, step: 0.02 },
    { group: 'ground', key: 'blocks', label: 'Blocks across', type: 'range', min: 3, max: 40, step: 1 },
    { group: 'ground', key: 'fill', label: 'Blocks inked', type: 'range', min: 0.1, max: 1, step: 0.02 },
    { group: 'ground', key: 'colours', label: 'Inks', type: 'range', min: 1, max: 6, step: 1 },
    { group: 'mark', key: 'mark', label: 'The mark in the field', type: 'range', min: 0, max: 1, step: 0.02,
      needs: { of: 'motif', key: 'masked', least: 1,
        without: 'This drawing could not be read as a bitmap, so the blocks are dealt by '
          + 'the field instead. Everything else here still holds.' } },
    { group: 'mark', key: 'spread', label: 'Spread', type: 'range', min: 0, max: 1, step: 0.02 },
    { group: 'pattern', key: 'seed', label: 'Seed', type: 'seed' },
  ];

  return { key: 'screen', kind: 'pattern', vector: true, motif: true, ratio: 1,
    controls, paint, drive, RUNS };
}));
