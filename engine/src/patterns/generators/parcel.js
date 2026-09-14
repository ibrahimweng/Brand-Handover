/* A pixel parcel poster, and the pixels are the mark.

   PLAYGRND's Parcel lays a coarse grid over the page, switches cells on from a
   noise field, merges them into run-length blocks, and strokes a few ragged
   rectangular "survey" clusters over the top. It is a handsome thing and the
   noise is the half that carries nothing: a field of blocks in a brand's
   colours is a field of blocks.

   So the field is the mark. `motif-read` carries the silhouette as a small
   bitmap and this asks it, cell by cell, whether the ink is there — the logo
   at poster scale, resolved to whatever grid the drawing's own weight asks
   for. Coverage grows or shrinks it a cell at a time rather than fading it,
   which keeps every edge on the grid and every block square.

   The survey clusters stay, because they are the half that makes it a poster
   rather than a large low-resolution logo: a few hairline rectangles laid over
   the blocks, sharing borders so every line is stroked exactly once. */
//
// UMD: `paint` runs in the studio, which has no require.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../rand'), require('../motif'));
  } else root.PatternParcel = factory(root.PatternRand, root.PatternMotif);
}(typeof self !== 'undefined' ? self : this, function (RAND, MOTIF) {
  'use strict';

  const R3 = (v) => Math.round(v * 1000) / 1000;

  // The grid of cells the mark switches on.
  //
  // Coverage is a morphology rather than a threshold: at 0.5 the cell is the
  // mark as drawn, above it a cell also comes on when enough of its neighbours
  // are ink, below it a cell goes off unless enough are. Fading a mask with a
  // threshold thins a logo into lace; growing and shrinking it keeps the shape.
  function field(p, cols, rows) {
    const m = p.motif;
    const on = new Uint8Array(cols * rows);
    if (!m || !m.mask) return on;
    const k = p.chunk;
    const at = (i, j) => {
      const u = ((i + 0.5) / cols - 0.5) / k + 0.5;
      const v = ((j + 0.5) / rows - 0.5) / k + 0.5;
      return MOTIF.at(m.mask, u, v);
    };
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) on[j * cols + i] = at(i, j);
    const grow = Math.round((p.coverage - 0.5) * 6);
    if (!grow) return on;
    let cur = on;
    for (let pass = 0; pass < Math.abs(grow); pass++) {
      const next = new Uint8Array(cols * rows);
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          let n = 0;
          for (let dj = -1; dj <= 1; dj++) {
            for (let di = -1; di <= 1; di++) {
              if (!di && !dj) continue;
              const x = i + di, y = j + dj;
              if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
              n += cur[y * cols + x];
            }
          }
          const self = cur[j * cols + i];
          next[j * cols + i] = grow > 0 ? (self || n >= 3 ? 1 : 0) : (self && n >= 3 ? 1 : 0);
        }
      }
      cur = next;
    }
    return cur;
  }

  function paint(surface, W, H, p, pal) {
    const base = pal.ground;
    const ink = pal.inks[0].hex;
    const rule = pal.inks[Math.min(1, pal.inks.length - 1)].hex;
    pal.paper(surface, W, H, base);

    const cols = Math.max(8, Math.round(p.cells));
    const rows = Math.max(8, Math.round((cols * H) / W));
    const cw = W / cols, ch = H / rows;
    const on = field(p, cols, rows);

    // Horizontal runs merged into single rectangles, which is what keeps a
    // poster of four hundred cells a few kilobytes of SVG rather than four
    // hundred rects.
    surface.fillStyle = ink;
    for (let j = 0; j < rows; j++) {
      let run = -1;
      for (let i = 0; i <= cols; i++) {
        const lit = i < cols && on[j * cols + i];
        if (lit && run < 0) run = i;
        else if (!lit && run >= 0) {
          surface.fillRect(R3(run * cw), R3(j * ch), R3((i - run) * cw), R3(ch));
          run = -1;
        }
      }
    }

    // The survey clusters: ragged rectangles of cells, their shared borders
    // cancelled so each line is stroked once.
    if (p.grids > 0) {
      surface.strokeStyle = rule;
      surface.lineWidth = Math.max(0.5, p.weight);
      for (let g = 0; g < Math.round(p.grids); g++) {
        const r = (k) => RAND.hash01(g * 17 + k, g * 29 + 3, (p.seed || 1) * 11 + k);
        const gw = 2 + Math.floor(r(1) * 6), gh = 2 + Math.floor(r(2) * 5);
        const gx = Math.floor(r(3) * Math.max(1, cols - gw));
        const gy = Math.floor(r(4) * Math.max(1, rows - gh));
        const keep = (i, j) => RAND.hash01(gx + i + 7, gy + j + 11, (p.seed || 1) * 13 + g) < 0.78;
        for (let j = 0; j < gh; j++) {
          for (let i = 0; i < gw; i++) {
            if (!keep(i, j)) continue;
            const x = (gx + i) * cw, y = (gy + j) * ch;
            // Only the borders this cell does not share with a kept neighbour,
            // so an interior edge is never stroked twice and never doubles in
            // weight.
            surface.beginPath();
            if (!keep(i, j - 1)) { surface.moveTo(R3(x), R3(y)); surface.lineTo(R3(x + cw), R3(y)); }
            if (!keep(i, j + 1)) { surface.moveTo(R3(x), R3(y + ch)); surface.lineTo(R3(x + cw), R3(y + ch)); }
            if (!keep(i - 1, j)) { surface.moveTo(R3(x), R3(y)); surface.lineTo(R3(x), R3(y + ch)); }
            if (!keep(i + 1, j)) { surface.moveTo(R3(x + cw), R3(y)); surface.lineTo(R3(x + cw), R3(y + ch)); }
            surface.stroke();
          }
        }
      }
    }
  }

  const controls = [
    { group: 'poster', key: 'cells', primary: true, label: 'Cells across', type: 'range', min: 8, max: 44, step: 1,
      needs: { of: 'motif', key: 'silhouette', least: 1,
        without: 'No shape could be read out of this drawing, so the field has nothing to be made of.' } },
    { group: 'poster', key: 'chunk', label: 'Mark size', type: 'range', min: 0.4, max: 1.6, step: 0.02 },
    { group: 'poster', key: 'coverage', primary: true, label: 'Grow or shrink', type: 'range', min: 0.2, max: 0.8, step: 0.01 },
    { group: 'poster', key: 'grids', label: 'Survey clusters', type: 'range', min: 0, max: 8, step: 1 },
    { group: 'poster', key: 'weight', primary: true, label: 'Line weight', type: 'range', min: 0.5, max: 3, step: 0.5 },
    { group: 'poster', key: 'seed', label: 'Seed', type: 'seed' },
  ];

  return { key: 'parcel', kind: 'poster', vector: true, motif: true, tiles: false, ratio: 1,
    controls, paint, field };
}));
