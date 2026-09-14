/* A badge set, and the badges are the mark.

   PLAYGRND's Tokens lays a ruled grid and scatters clusters of small geometric
   tokens across it — single cells, crosses, blocks, chains — each a circle or a
   square, hollow or solid, sized so a few sit larger than the rest. Clusters are
   placed with a cell of clearance so they never touch, and every outline is
   stroked before any fill is painted, which is what lets a chain of touching
   tokens read as one merged shape with no seam down the middle.

   Its tokens are circles and squares. Here a token can also be the client's own
   mark, and that is what turns a handsome grid of dots into a badge set for
   this identity — the sort of sheet a brand actually uses for app icons, pin
   badges, sticker sheets and spot marks.

   Every number is measured. How many columns from how fine the mark is. How
   many clusters from how much of its own box the shape inks, because a solid
   token at a given size carries far more weight on the page than an open one.
   How large the tokens run from the shape's own proportion. */
//
// UMD: `paint` runs in the studio, which has no require.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../rand'), require('../motif'));
  } else root.PatternTokens = factory(root.PatternRand, root.PatternMotif);
}(typeof self !== 'undefined' ? self : this, function (RAND, MOTIF) {
  'use strict';

  const R3 = (v) => Math.round(v * 1000) / 1000;
  const FOOTPRINTS = ['one', 'plus', 'block', 'run'];

  // Where every cluster sits, on an occupancy grid with a cell of clearance so
  // two clusters can never touch. Clearance is the whole reason the sheet reads
  // as separate badges rather than as a texture.
  function place(p, C) {
    const taken = new Uint8Array(C * C);
    const out = [];
    const free = (x, y) => {
      if (x < 0 || y < 0 || x >= C || y >= C) return false;
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          const a = x + i, b = y + j;
          if (a < 0 || b < 0 || a >= C || b >= C) continue;
          if (taken[b * C + a]) return false;
        }
      }
      return true;
    };
    const want = Math.max(1, Math.round(p.count));
    const tries = want * 140;
    for (let n = 0, made = 0; n < tries && made < want; n++) {
      const r = (k) => RAND.hash01(n * 13 + k, made * 7 + k, (p.seed || 1) * 17 + k);
      let x = Math.floor(r(1) * C), y = Math.floor(r(2) * C);
      // Alignment snaps a candidate onto one of a few committed guide lines, so
      // the scatter reads as a system rather than as confetti.
      if (p.alignment > 0.01) {
        const guides = Math.max(2, Math.round(8 - p.alignment * 6));
        if (r(3) < p.alignment) x = Math.round(x / (C / guides)) * Math.round(C / guides);
        if (r(4) < p.alignment) y = Math.round(y / (C / guides)) * Math.round(C / guides);
        x = Math.min(C - 1, Math.max(0, x)); y = Math.min(C - 1, Math.max(0, y));
      }
      // Clustering gathers tokens onto the high ground of a seeded field, so
      // they collect in drifts instead of spreading evenly.
      if (p.clustering > 0.01) {
        const f = RAND.hash01(Math.floor(x / 3), Math.floor(y / 3), (p.seed || 1) * 23);
        if (r(5) > Math.pow(f, 1 + p.clustering * 6)) continue;
      }
      const kind = FOOTPRINTS[Math.floor(r(6) * FOOTPRINTS.length) % FOOTPRINTS.length];
      const cells = [];
      if (kind === 'one') cells.push([x, y]);
      else if (kind === 'plus') {
        cells.push([x, y], [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]);
      } else if (kind === 'block') {
        const w = 2 + Math.floor(r(7) * 2), h = 2 + Math.floor(r(8) * 2);
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) cells.push([x + i, y + j]);
      } else {
        const len = 2 + Math.floor(r(9) * Math.max(1, p.chain - 1));
        const up = r(10) < p.upright;
        for (let i = 0; i < len; i++) cells.push(up ? [x, y + i] : [x + i, y]);
      }
      if (!cells.every(([a, b]) => free(a, b))) continue;
      for (const [a, b] of cells) taken[b * C + a] = 1;
      out.push({ cells, n: made });
      made++;
    }
    return out;
  }

  function token(s, shape, cx, cy, r, motif, hollow, weight) {
    if (shape === 'mark' && motif && motif.ops && motif.ops.length) {
      // The region the ink covers, not the centreline. A stroked mark filled
      // from its own path is the blob the strokes travel around — carrock's
      // ring comes out a disc — and a badge sheet of discs is not a badge
      // sheet of that logo.
      const ops = motif.fillOps && motif.fillOps.length ? motif.fillOps : motif.ops;
      MOTIF.draw(s, { ops, stroked: false }, cx, cy, r);
      return;
    }
    s.beginPath();
    if (shape === 'square') s.rect(cx - r, cy - r, r * 2, r * 2);
    else s.arc(cx, cy, r, 0, Math.PI * 2);
    if (hollow) { s.lineWidth = Math.max(0.6, weight); s.stroke(); } else s.fill();
  }

  function paint(surface, W, H, p, pal) {
    pal.paper(surface, W, H, pal.ground);
    const C = Math.max(4, Math.round(p.grid));
    const cell = Math.min(W, H) / C;
    const inks = pal.inks;

    // The rules behind everything, which is what makes it a system sheet.
    if (p.rules > 0.001) {
      surface.strokeStyle = inks[inks.length - 1].hex;
      surface.globalAlpha = p.rules;
      surface.lineWidth = 0.5;
      for (let j = 1; j < Math.ceil(H / cell); j++) {
        surface.beginPath(); surface.moveTo(0, R3(j * cell)); surface.lineTo(W, R3(j * cell)); surface.stroke();
      }
      const every = Math.max(1, Math.round(p.rect));
      for (let i = every; i < C; i += every) {
        surface.beginPath(); surface.moveTo(R3(i * cell), 0); surface.lineTo(R3(i * cell), H); surface.stroke();
      }
      surface.globalAlpha = 1;
    }

    const clusters = place(p, C);
    // Drawing order matters: every outline is stroked first and the fills go
    // over them, so a chain of touching tokens reads as one merged shape with
    // no seam down the middle of it.
    for (const pass of ['outline', 'fill']) {
      for (const c of clusters) {
        const r = (k) => RAND.hash01(c.n * 19 + k, 11 + k, (p.seed || 1) * 29 + k);
        const fill = inks[Math.floor(r(1) * inks.length) % inks.length].hex;
        const line = inks[(Math.floor(r(1) * inks.length) + 1) % inks.length].hex;
        const hollow = r(2) < p.hollow;
        const base = r(3) < p.markShare && (p.motif || {}).ops ? 'mark'
          : r(4) < p.squares ? 'square' : 'circle';
        // Hierarchy skews a few tokens large rather than varying everything a
        // little, which is what gives the sheet a reading order.
        const grow = 1 + p.hierarchy * 2.6 * Math.pow(r(5), 1 + p.hierarchy * 3.2);
        const vary = 1 - p.variation / 2 + p.variation * r(6);
        const rad = Math.min(cell * 0.48, (cell / 2) * p.size * vary * grow);
        for (const [x, y] of c.cells) {
          const shape = r(7) < 0.12 ? (base === 'circle' ? 'square' : 'circle') : base;
          const cx = (x + 0.5) * cell, cy = (y + 0.5) * cell;
          if (pass === 'outline') {
            if (rad <= 0) continue;
            surface.strokeStyle = line;
            surface.lineWidth = Math.max(0.8, p.outline);
            surface.beginPath();
            if (shape === 'square') surface.rect(R3(cx - rad), R3(cy - rad), R3(rad * 2), R3(rad * 2));
            else surface.arc(R3(cx), R3(cy), R3(rad + p.outline * 0.5), 0, Math.PI * 2);
            surface.stroke();
          } else {
            surface.fillStyle = fill;
            surface.strokeStyle = fill;
            token(surface, shape, R3(cx), R3(cy), R3(rad), p.motif, hollow, p.outline);
          }
        }
      }
    }
  }

  const controls = [
    { group: 'poster', key: 'grid', label: 'Grid', type: 'range', min: 6, max: 40, step: 1 },
    { group: 'poster', key: 'rect', label: 'Rule spacing', type: 'range', min: 1, max: 10, step: 1 },
    { group: 'poster', key: 'rules', label: 'Grid lines', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'cluster', key: 'count', label: 'Clusters', type: 'range', min: 1, max: 120, step: 1 },
    { group: 'cluster', key: 'clustering', label: 'Clustering', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'cluster', key: 'alignment', label: 'Alignment', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'cluster', key: 'chain', label: 'Chain length', type: 'range', min: 2, max: 12, step: 1 },
    { group: 'cluster', key: 'upright', label: 'Upright chains', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'token', key: 'size', label: 'Size', type: 'range', min: 0.1, max: 1, step: 0.01 },
    { group: 'token', key: 'variation', label: 'Size variation', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'token', key: 'hierarchy', label: 'Hierarchy', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'token', key: 'markShare', label: 'The mark', type: 'range', min: 0, max: 1, step: 0.01,
      needs: { of: 'motif', key: 'silhouette', least: 1,
        without: 'No shape could be read out of this drawing, so no token can be the mark.' } },
    { group: 'token', key: 'squares', label: 'Squares', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'token', key: 'hollow', label: 'Hollow', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'token', key: 'outline', label: 'Outline', type: 'range', min: 0, max: 8, step: 0.5 },
    { group: 'token', key: 'seed', label: 'Seed', type: 'seed' },
  ];

  return { key: 'tokens', kind: 'poster', vector: true, motif: true, tiles: false, ratio: 1,
    footprints: FOOTPRINTS, controls, paint, place };
}));
