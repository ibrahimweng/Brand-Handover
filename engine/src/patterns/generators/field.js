/* field — pixel compositions.

   After PLAYGRND's Oddgrid, which is the tool that most looks like a brand
   pattern already: a grid of cells, each one filled or left as ground, coloured
   from a slow noise field, gathered into patches by a second one, and speckled
   by a third. Blocky, hard-edged, and it recolours by editing one attribute.

   The seam rule is weave's, one layer deeper. weave's styles are arithmetic on
   the cell index and wrap because the index wraps; this one samples a
   continuous field, so the field itself has to be periodic — which is what
   noise.js was built for. Every sample here is taken with a period that divides
   the cell count, and test/run.js checks the resulting cell at (x, y) against
   the cell at (x + C, y) rather than looking at a render.

   Three fields, because one is a texture and three is a composition:

     colour     two octaves, slow — which ink a region leans towards
     coverage   three octaves — whether a cell is inked at all
     detail     two octaves, fast — the grain inside a region

   And a fourth thing that is not a field: blocks. Cell coordinates are pulled
   towards the middle of a block before the fields are sampled, so a run of
   cells shares one answer and the composition gathers into patches instead of
   dissolving into noise. It is one lerp and it is most of what the pattern
   looks like. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../rand'), require('../noise'));
  else root.PatternField = factory(root.PatternRand, root.PatternNoise);
}(typeof self !== 'undefined' ? self : this, function (RAND, NOISE) {
  'use strict';

  const LOOKS = ['patchwork', 'bloom', 'quilt', 'scatter', 'drift'];
  const MARKS = ['none', 'dot', 'ring', 'square', 'wedge'];
  const mod = (n, p) => ((n % p) + p) % p;

  // The divisor of n nearest to `want` — the same mechanism weave uses, and for
  // the same reason: a field whose period does not divide the tile is a field
  // with a seam in it.
  function divisorNear(n, want) {
    let best = 1, gap = Infinity;
    for (let d = 1; d <= n; d++) {
      if (n % d) continue;
      const g = Math.abs(d - want);
      if (g < gap || (g === gap && d > best)) { best = d; gap = g; }
    }
    return best;
  }

  // Each look is a set of the controls at once, the way a designer picks a
  // direction rather than eight numbers.
  const LOOK = {
    patchwork: { zoom: 10, fill: 0.55, grain: 0.35, patchiness: 0.5, blockiness: 0.4, block: 6, speckle: 0.08 },
    bloom: { zoom: 5, fill: 0.62, grain: 0.7, patchiness: 0.2, blockiness: 0.1, block: 4, speckle: 0.03 },
    quilt: { zoom: 16, fill: 0.5, grain: 0.15, patchiness: 0.9, blockiness: 0.85, block: 8, speckle: 0.05 },
    scatter: { zoom: 22, fill: 0.34, grain: 1.0, patchiness: 0.35, blockiness: 0, block: 3, speckle: 0.28 },
    drift: { zoom: 7, fill: 0.6, grain: 0.5, patchiness: 1.2, blockiness: 0.55, block: 10, speckle: 0.02 },
  };

  function plan(p) {
    const C = p.cells;
    const q = {
      C, seed: p.seed || 1,
      fill: p.fill, grain: p.grain, patchiness: p.patchiness,
      blockiness: p.blockiness, speckle: p.speckle, spread: p.spread || 0,
      mark: p.mark || 'none', markAmount: p.markAmount == null ? 0 : p.markAmount,
      markSize: p.markSize == null ? 0.52 : p.markSize,
    };
    // The three periods, each a divisor of the cell count and each a different
    // size, so the three fields do not line up and beat.
    q.pColour = divisorNear(C, Math.max(2, Math.round(C / p.zoom)));
    q.pCover = divisorNear(C, Math.max(2, Math.round(C / (p.zoom * 0.62))));
    q.pDetail = divisorNear(C, Math.max(4, Math.round(C / (p.zoom * 0.22))));
    q.block = Math.max(1, divisorNear(C, Math.round(p.block)));
    return q;
  }

  // The palette index for one cell, or -1 for the ground. Defined for every
  // integer, inside the tile and out, which is what makes the repeat provable.
  function cellAt(x, y, q, inks) {
    const C = q.C;
    let ux = mod(x, C), uy = mod(y, C);
    // Pulled towards the middle of its block, so a run of cells shares one
    // answer. The lerp is done on the wrapped coordinate and the block grid
    // divides the tile, so this stays periodic.
    const bx = Math.floor(ux / q.block) * q.block + (q.block - 1) / 2;
    const by = Math.floor(uy / q.block) * q.block + (q.block - 1) / 2;
    const sx = ux + (bx - ux) * q.blockiness;
    const sy = uy + (by - uy) * q.blockiness;

    // What this block is like: its own tone, its own bias towards ink, its own
    // amount of grain. Patchiness is how much any of that is allowed to differ.
    const bi = Math.floor(ux / q.block), bj = Math.floor(uy / q.block);
    const blocks = C / q.block;
    const h = (k) => RAND.hash01(mod(bi, blocks), mod(bj, blocks), q.seed + k);
    const bias = (h(1) - 0.5) * 0.34 * q.patchiness;
    const tone = (h(2) - 0.5) * 0.5 * q.patchiness;
    const grainOf = 1 + (h(3) - 0.5) * q.patchiness;

    const cover = NOISE.fbm2(sx / C * q.pCover, sy / C * q.pCover, q.pCover, q.pCover, 3, q.seed + 11);
    const detail = NOISE.fbm2(sx / C * q.pDetail, sy / C * q.pDetail, q.pDetail, q.pDetail, 2, q.seed + 23);
    const level = NOISE.evenly(cover, 3) + (detail - 0.5) * q.grain * grainOf;
    if (level >= q.fill + bias) return -1;

    const base = NOISE.evenly(
      NOISE.fbm2(sx / C * q.pColour, sy / C * q.pColour, q.pColour, q.pColour, 2, q.seed), 2) + tone;
    let i = Math.floor(NOISE.skew(Math.max(0, Math.min(0.9999, base)), q.spread) * inks);
    if (q.speckle > 0 && RAND.hash01(ux, uy, q.seed + 97) < q.speckle) {
      i = Math.floor(RAND.hash01(uy, ux, q.seed + 131) * inks);
    }
    return Math.max(0, Math.min(inks - 1, i));
  }

  // A glyph in the middle of a cell. The one place this draws anything that is
  // not a rectangle, and it is what stops a field of squares reading as a
  // spreadsheet.
  function glyph(s, kind, cx, cy, r) {
    if (kind === 'dot') { s.beginPath(); s.arc(cx, cy, r, 0, Math.PI * 2); s.fill(); return; }
    if (kind === 'ring') {
      s.lineWidth = r * 0.62; s.strokeStyle = s.fillStyle;
      s.beginPath(); s.arc(cx, cy, r * 0.72, 0, Math.PI * 2); s.stroke(); return;
    }
    if (kind === 'square') { s.fillRect(cx - r, cy - r, r * 2, r * 2); return; }
    // wedge
    s.beginPath(); s.moveTo(cx - r, cy - r); s.lineTo(cx + r, cy - r); s.lineTo(cx - r, cy + r);
    s.closePath(); s.fill();
  }

  function paint(surface, W, H, p, palette) {
    const q = plan(p);
    const C = q.C, inks = palette.count;
    const cw = W / C, ch = H / C;
    const R3 = (n) => Math.round(n * 1000) / 1000;
    surface.fillStyle = palette.ground;
    surface.fillRect(0, 0, W, H);
    // Run-length merged along each row, which is what turns a hundred thousand
    // cells into a few thousand rectangles.
    for (let y = 0; y < C; y++) {
      let x = 0;
      while (x < C) {
        const v = cellAt(x, y, q, inks);
        let n = 1;
        while (x + n < C && cellAt(x + n, y, q, inks) === v) n++;
        if (v >= 0) {
          surface.fillStyle = palette.ink(v);
          const x0 = R3(x * cw), x1 = R3((x + n) * cw), y0 = R3(y * ch), y1 = R3((y + 1) * ch);
          surface.fillRect(x0, y0, x1 - x0, y1 - y0);
        }
        x += n;
      }
    }
    if (q.mark !== 'none' && q.markAmount > 0) {
      const r = Math.min(cw, ch) * 0.5 * q.markSize;
      for (let y = 0; y < C; y++) {
        for (let x = 0; x < C; x++) {
          if (RAND.hash01(x, y, q.seed + 401) >= q.markAmount) continue;
          const v = cellAt(x, y, q, inks);
          // a mark sits on ink in the ground's colour, and on ground in the
          // ink's — so it reads either way rather than disappearing on half
          // the tile
          surface.fillStyle = v >= 0 ? palette.ground : palette.ink(0);
          glyph(surface, q.mark, R3((x + 0.5) * cw), R3((y + 0.5) * ch), R3(r));
        }
      }
    }
  }

  const controls = [
    { group: 'pattern', key: 'cells', label: 'Grid', type: 'range', min: 12, max: 108, step: 4 },
    { group: 'pattern', key: 'zoom', label: 'Zoom', type: 'range', min: 2, max: 40, step: 0.5 },
    { group: 'pattern', key: 'fill', label: 'Fill', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'pattern', key: 'grain', label: 'Grain', type: 'range', min: 0, max: 1.4, step: 0.01 },
    { group: 'pattern', key: 'patchiness', label: 'Patchiness', type: 'range', min: 0, max: 1.6, step: 0.01 },
    { group: 'pattern', key: 'blockiness', label: 'Blockiness', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'pattern', key: 'block', label: 'Block size', type: 'range', min: 2, max: 16, step: 1 },
    { group: 'pattern', key: 'speckle', label: 'Speckle', type: 'range', min: 0, max: 0.6, step: 0.01 },
    { group: 'pattern', key: 'spread', label: 'Colour spread', type: 'range', min: -1.2, max: 1.2, step: 0.05 },
    { group: 'detail', key: 'mark', label: 'Cell mark', type: 'chips', options: MARKS },
    { group: 'detail', key: 'markAmount', label: 'How many', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'detail', key: 'markSize', label: 'How large', type: 'range', min: 0.15, max: 1, step: 0.01 },
    { group: 'pattern', key: 'seed', label: 'Seed', type: 'seed' },
  ];

  return { key: 'field', vector: true, styles: LOOKS, looks: LOOK, marks: MARKS,
    controls, plan, cellAt, paint, divisorNear };
}));
