/* The mark, resolved onto a grid of pixels and let go a little.

   PLAYGRND's Oddgrid evaluates a cell grid against three noise fields — a
   coarse one for colour, a middling one for coverage, a fine one for grain —
   and fills a cell when the coverage beats a threshold. Cells are pulled toward
   the centre of a block before they are sampled, and each block carries its own
   tone and its own coverage bias, which is what makes the sheet read as
   patchwork rather than as static.

   Here the coverage field has a fourth term and it is the client's own logo.
   The mark's bitmap says where the drawing is; inside it the threshold is
   pushed until the cells fill, outside it the noise has the page to itself. So
   the logo arrives as a dense patch in a field of pixels — legible close up,
   and at arm's length a patterned sheet with a rhythm to it.

   Two things about that are deliberate. The mark is *blended* into the
   threshold rather than stamped over it, so the edge of the drawing is ragged
   in the same way the rest of the field is and the logo looks made of the same
   material. And `repeat` puts more than one of it across the tile, because a
   tile with one logo in it is a logo, not a pattern.

   Run-length merged on the way out. A row of forty identical cells is one
   `fillRect`, not forty — a tile at a hundred cells across is otherwise ten
   thousand rectangles, which is a megabyte of SVG for a picture a designer
   wanted to put behind a paragraph. */
//
// UMD: `paint` runs in the studio, which has no require.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../rand'), require('../noise'), require('../motif'), require('../grid'));
  } else root.PatternOddgrid = factory(root.PatternRand, root.PatternNoise, root.PatternMotif, root.PatternGrid);
}(typeof self !== 'undefined' ? self : this, function (RAND, NOISE, MOTIF, GRID) {
  'use strict';

  const R3 = (v) => Math.round(v * 1000) / 1000;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const frac = (v) => v - Math.floor(v);
  const MARKS = ['none', 'dot', 'ring', 'square', 'wedge', 'mark'];
  // Nothing — the cell shows the ground through.
  const EMPTY = GRID.EMPTY;

  /* The grid of colour indices, decided once and then painted.

     Deciding and painting are kept apart because the painter merges runs, and a
     merge has to compare a cell with the one before it. Interleaving the two
     means recomputing the previous cell, which at a hundred cells across is
     twenty thousand field samples instead of ten. */
  function decide(W, H, p) {
    const n = Math.max(4, Math.round(p.grid));
    const rows = Math.max(4, Math.round(n * (H / W)));
    // The noise period, in cells. A whole number, because that is the only way
    // a noise field comes back round at the tile edge.
    const P = Math.max(1, Math.round(p.zoom));
    const bs = Math.max(1, Math.round(p.blockSize));
    const seed = (p.seed || 1) * 17;
    const inks = Math.max(1, p.inks || 5);
    const reps = Math.max(1, Math.round(p.repeat));
    const out = new Int16Array(n * rows);
    const marked = new Uint8Array(n * rows);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < n; i++) {
        // Pulled toward the middle of its block before it is sampled. This is
        // the whole of Blockiness: at one, every cell in a block samples the
        // same place and the block comes out one flat colour.
        const bi = Math.floor(i / bs), bj = Math.floor(j / bs);
        const cx = i + (((bi + 0.5) * bs - 0.5) - i) * p.blockiness;
        const cy = j + (((bj + 0.5) * bs - 0.5) - j) * p.blockiness;
        const u = cx / n, v = cy / rows;
        // The block's own tone, coverage bias and grain multiplier. Hashed off
        // the block index and wrapped, so blocks either side of the tile edge
        // are the same block.
        const nb = Math.max(1, Math.round(n / bs));
        const bh = RAND.hash01(((bi % nb) + nb) % nb, ((bj % nb) + nb) % nb, seed + 5);
        const tone = NOISE.evenly(NOISE.fbm2(u * P, v * P, P, P, 2, seed + 1), 2);
        const cover = NOISE.evenly(NOISE.fbm2(u * P * 2 + 3.1, v * P * 2 + 7.7, P * 2, P * 2, 3, seed + 2), 3);
        const fine = NOISE.fbm2(u * P * 4 + 1.9, v * P * 4 + 4.3, P * 4, P * 4, 2, seed + 3);
        // Is the drawing here? Repeated across the tile, so the sheet is a
        // pattern rather than a logo with noise round it.
        const on = p.mark > 0
          ? MOTIF.inside(p.motif, frac(u * reps), frac(v * reps), p.spread) : 0;
        const bias = (bh - 0.5) * p.patchiness * 0.5;
        const level = clamp(p.fill + bias + (on ? p.mark : 0), 0, 1.6);
        const k = j * n + i;
        if (cover + (fine - 0.5) * p.grain * (0.5 + bh) >= level) { out[k] = EMPTY; continue; }
        let idx = Math.min(inks - 1, Math.floor(NOISE.skew(clamp(tone + (bh - 0.5) * p.patchiness * 0.3, 0, 0.999), p.spreadInk) * inks));
        if (p.speckle > 0) {
          const sp = RAND.hash01(i, j, seed + 7);
          if (sp < p.speckle) idx = Math.floor(RAND.hash01(i, j, seed + 8) * inks) % inks;
        }
        out[k] = idx;
        if (p.markAmount > 0 && RAND.hash01(i, j, seed + 9) < p.markAmount) marked[k] = 1;
      }
    }
    return { n, rows, cells: out, marked };
  }

  // One glyph in a cell, for the Detail group.
  function glyph(s, kind, cx, cy, r, motif) {
    if (kind === 'dot') { s.beginPath(); s.arc(cx, cy, r, 0, Math.PI * 2); s.fill(); return; }
    if (kind === 'ring') {
      s.beginPath(); s.arc(cx, cy, r, 0, Math.PI * 2);
      s.arc(cx, cy, r * 0.5, 0, Math.PI * 2, true); s.fill('evenodd'); return;
    }
    if (kind === 'square') { s.fillRect(R3(cx - r), R3(cy - r), R3(r * 2), R3(r * 2)); return; }
    if (kind === 'wedge') {
      s.beginPath(); s.moveTo(cx - r, cy + r); s.lineTo(cx + r, cy + r); s.lineTo(cx + r, cy - r);
      s.closePath(); s.fill(); return;
    }
    if (kind === 'mark' && motif && motif.ops && motif.ops.length) MOTIF.draw(s, motif, cx, cy, r);
  }

  function paint(surface, W, H, p, pal) {
    const inks = pal.inks.length;
    const g = decide(W, H, Object.assign({}, p, { inks }));
    const cw = W / g.n, ch = H / g.rows;
    pal.paper(surface, W, H, pal.ground);
    const kind = MARKS.indexOf(p.cellMark) > -1 ? p.cellMark : 'none';

    GRID.cells(surface, W, H, g.n, g.rows, (i, j) => {
      const idx = g.cells[j * g.n + i];
      return idx === EMPTY ? EMPTY : idx % inks;
    }, pal.inks.slice(0, inks).map((k) => k.hex));

    // The glyphs go on top, in the ground's colour, so a marked cell reads as a
    // hole punched in the ink rather than as a second thing drawn beside it.
    if (kind !== 'none' && p.markAmount > 0) {
      surface.fillStyle = pal.ground;
      surface.strokeStyle = pal.ground;
      for (let j = 0; j < g.rows; j++) {
        for (let i = 0; i < g.n; i++) {
          const k = j * g.n + i;
          if (!g.marked[k] || g.cells[k] === EMPTY) continue;
          glyph(surface, kind, R3((i + 0.5) * cw), R3((j + 0.5) * ch),
            R3(Math.min(cw, ch) * 0.5 * p.markSize), p.motif);
        }
      }
    }
  }

  const controls = [
    { group: 'pattern', key: 'grid', primary: true, label: 'Grid detail', type: 'range', min: 12, max: 120, step: 1 },
    { group: 'pattern', key: 'zoom', label: 'Field zoom', type: 'range', min: 1, max: 16, step: 1 },
    { group: 'pattern', key: 'fill', primary: true, label: 'Fill', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'pattern', key: 'grain', label: 'Grain', type: 'range', min: 0, max: 1.4, step: 0.01 },
    { group: 'pattern', key: 'patchiness', label: 'Patchiness', type: 'range', min: 0, max: 1.6, step: 0.01 },
    { group: 'pattern', key: 'blockiness', label: 'Blockiness', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'pattern', key: 'blockSize', label: 'Block size', type: 'range', min: 2, max: 16, step: 1 },
    { group: 'pattern', key: 'speckle', label: 'Speckle', type: 'range', min: 0, max: 0.6, step: 0.01 },
    { group: 'pattern', key: 'spreadInk', label: 'Colour spread', type: 'range', min: -1.2, max: 1.2, step: 0.05 },
    { group: 'mark', key: 'mark', primary: true, label: 'Mark in the field', type: 'range', min: 0, max: 1, step: 0.01,
      needs: { of: 'motif', key: 'masked', least: 1,
        without: 'No bitmap could be taken of this shape — it is finer than the grid that '
          + 'reads it. The field is dealt from noise alone.' } },
    { group: 'mark', key: 'repeat', label: 'Marks across', type: 'range', min: 1, max: 6, step: 1 },
    { group: 'mark', key: 'spread', label: 'Mark size', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'detail', key: 'cellMark', label: 'Cell marks', type: 'chips', options: MARKS },
    { group: 'detail', key: 'markAmount', label: 'Mark amount', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'detail', key: 'markSize', label: 'Mark size', type: 'range', min: 0.15, max: 1, step: 0.01 },
    { group: 'detail', key: 'seed', label: 'Seed', type: 'seed' },
  ];

  const plan = (W, H, p) => { const g = decide(W, H, Object.assign({}, p, { inks: 5 }));
    return { cols: g.n, rows: g.rows, cells: g.n * g.rows }; };

  return { key: 'oddgrid', kind: 'pattern', vector: true, motif: true, ratio: 1,
    controls, paint, plan, decide, MARKS };
}));
