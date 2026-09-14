/* A festival patch poster, and the patch is the mark.

   PLAYGRND's Fete stacks three layers: soft-edged colour continents from a
   low-resolution noise field upscaled with smoothing, one freehand doodle
   drawn over them in a heavy round-capped line, and a scatter of dots, 40% of
   which snap onto the doodle's own vertices so the line reads as beaded rather
   than decorated.

   Two changes, both the same change. The continents come from the mark's own
   silhouette rather than from noise — the shape read at a coarse resolution
   and grown outward in bands, so the colour fields are the logo's weather
   rather than a texture. And the doodle is the mark's outline, drawn as a
   line: the shape the poster is about, traced rather than filled.

   The dots stay as they are, and they still snap to the line's vertices.
   That is the detail that makes the thing read as a patch you could sew on. */
//
// UMD: `paint` runs in the studio, which has no require.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../rand'), require('../motif'));
  } else root.PatternFete = factory(root.PatternRand, root.PatternMotif);
}(typeof self !== 'undefined' ? self : this, function (RAND, MOTIF) {
  'use strict';

  const R3 = (v) => Math.round(v * 1000) / 1000;

  // How far a cell is from the mark's ink, in cells, up to a limit. Bands of
  // equal distance become the colour continents — the logo's weather.
  function distance(mask, cols, rows, chunk, most) {
    const at = (i, j) => {
      const u = ((i + 0.5) / cols - 0.5) / chunk + 0.5;
      const v = ((j + 0.5) / rows - 0.5) / chunk + 0.5;
      return MOTIF.at(mask, u, v);
    };
    const d = new Int16Array(cols * rows).fill(-1);
    let front = [];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        if (at(i, j)) { d[j * cols + i] = 0; front.push([i, j]); }
      }
    }
    if (!front.length) return null;
    for (let step = 1; step <= most && front.length; step++) {
      const next = [];
      for (const [x, y] of front) {
        for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + a, ny = y + b;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          if (d[ny * cols + nx] !== -1) continue;
          d[ny * cols + nx] = step;
          next.push([nx, ny]);
        }
      }
      front = next;
    }
    return d;
  }

  function paint(surface, W, H, p, pal) {
    pal.paper(surface, W, H, pal.ground);
    const inks = pal.inks;
    const cols = Math.max(12, Math.round(p.patch));
    const rows = Math.max(12, Math.round((cols * H) / W));
    const most = Math.max(2, Math.round(p.bands));
    const d = distance((p.motif || {}).mask, cols, rows, p.chunk, most);
    const cw = W / cols, ch = H / rows;

    if (d) {
      // Run-length merged per row, so a field of six hundred cells is a few
      // dozen rectangles rather than six hundred.
      for (let j = 0; j < rows; j++) {
        let run = -1, cur = -2;
        for (let i = 0; i <= cols; i++) {
          const v = i < cols ? d[j * cols + i] : -2;
          const band = v === -1 ? most + 1 : v;
          if (band !== cur) {
            if (run >= 0 && cur >= 0) {
              surface.fillStyle = inks[Math.min(inks.length - 1, cur)].hex;
              surface.fillRect(R3(run * cw), R3(j * ch), R3((i - run) * cw), R3(ch + 0.4));
            }
            run = i; cur = band;
          }
        }
      }
    }

    // The mark as a line over the top, and the dots beaded along it.
    const src = (p.motif || {}).ops;
    if (src && src.length && p.line > 0.001) {
      const r = Math.min(W, H) * 0.5 * p.size;
      surface.strokeStyle = inks[inks.length - 1].hex;
      surface.lineWidth = Math.max(1, Math.min(W, H) * 0.009 * p.line);
      surface.lineCap = 'round';
      surface.lineJoin = 'round';
      MOTIF.path(surface, { ops: src }, W / 2, H / 2, r);
      surface.stroke();
      // Dots: some snapped onto the outline's own points, the rest scattered.
      const dots = Math.round(p.dots);
      const on = src.filter((o) => o[0] === 'M' || o[0] === 'L' || o[0] === 'C');
      surface.fillStyle = inks[0].hex;
      for (let n = 0; n < dots; n++) {
        const pick = RAND.hash01(n, 1, (p.seed || 1) * 13);
        let x, y;
        if (pick < 0.4 && on.length) {
          const o = on[Math.floor(RAND.hash01(n, 2, (p.seed || 1) * 13) * on.length) % on.length];
          const k = o[0] === 'C' ? 5 : 1;
          x = W / 2 + o[k] * r * 2; y = H / 2 + o[k + 1] * r * 2;
        } else {
          x = RAND.hash01(n, 3, (p.seed || 1) * 17) * W;
          y = RAND.hash01(n, 4, (p.seed || 1) * 17) * H;
        }
        const rr = Math.min(W, H) * (0.006 + RAND.hash01(n, 5, (p.seed || 1) * 19) * 0.014);
        surface.beginPath();
        surface.arc(R3(x), R3(y), R3(rr), 0, Math.PI * 2);
        surface.fill();
      }
    }
  }

  const controls = [
    { group: 'poster', key: 'patch', primary: true, label: 'Patch detail', type: 'range', min: 12, max: 60, step: 1,
      needs: { of: 'motif', key: 'silhouette', least: 1,
        without: 'No shape could be read out of this drawing, so the colour fields have nothing to grow from.' } },
    { group: 'poster', key: 'bands', primary: true, label: 'Colour bands', type: 'range', min: 2, max: 10, step: 1 },
    { group: 'poster', key: 'chunk', label: 'Mark size', type: 'range', min: 0.3, max: 1.2, step: 0.02 },
    { group: 'poster', key: 'size', primary: true, label: 'Line size', type: 'range', min: 0.3, max: 1, step: 0.01 },
    { group: 'poster', key: 'line', label: 'Line weight', type: 'range', min: 0, max: 3, step: 0.05 },
    { group: 'poster', key: 'dots', label: 'Dots', type: 'range', min: 0, max: 80, step: 1 },
    { group: 'poster', key: 'seed', label: 'Seed', type: 'seed' },
  ];

  return { key: 'fete', kind: 'poster', vector: true, motif: true, tiles: false, ratio: 1,
    controls, paint, distance };
}));
