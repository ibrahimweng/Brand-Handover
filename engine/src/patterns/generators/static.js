/* A glitch poster, and the thing being glitched is the mark.

   PLAYGRND's Static resolves the page to a one-bit bitmap, splits it into
   horizontal regions each filled by its own rule — moire, bars, noise, blocks,
   zigzag — and then runs a glitch pass over the bits: rows shifted sideways,
   rows smeared downward, rectangles punched out. The bitmap is drawn as
   ink-on-ground rectangles, so the whole page is axis-aligned and hard-edged.

   The region rules are the half a brand cannot use — a strip of hashed noise is
   a strip of hashed noise in anybody's colours — so `mark` is a region type
   here and the derived weighting makes it the one most pages open on. The mark
   resolves out of the silhouette bitmap that `motif-read` carries, at whatever
   resolution the drawing's own detail asks for, and then the glitch pass tears
   it exactly as it tears everything else.

   That is the tool doing what it does to the identity rather than beside it: a
   logo shifted, smeared and dropped out, still legible, which is the whole
   point of a glitch poster and is not something any amount of noise would have
   given a client.

   The glitch derives to something rather than to nothing, which is the one
   place this engine's "every effect starts at zero" rule is deliberately not
   followed. An effect starts at zero because the default should show the mark
   as drawn. Here the tearing is not an effect over the top of the poster — it
   is the poster, and a Static with no glitch in it is a bitmap. */
//
// UMD: `paint` runs in the studio, which has no require.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../rand'), require('../motif'));
  } else root.PatternStatic = factory(root.PatternRand, root.PatternMotif);
}(typeof self !== 'undefined' ? self : this, function (RAND, MOTIF) {
  'use strict';

  const R3 = (v) => Math.round(v * 1000) / 1000;
  const KINDS = ['mark', 'bars', 'zigzag', 'moire', 'blocks', 'noise'];

  // One region's rule, resolved per cell, returning a bit.
  function cell(kind, i, j, cols, rows, p, s) {
    const u = i / cols, v = j / rows;
    if (kind === 'mark') {
      const k = p.chunk;
      return MOTIF.at((p.motif || {}).mask, (u - 0.5) / k + 0.5, (v - 0.5) / k + 0.5);
    }
    if (kind === 'bars') {
      const seg = Math.floor(u * (4 + s.d * 14));
      return RAND.hash01(seg, Math.floor(j / (1 + Math.floor(s.e * 3))), s.k) < 0.55 ? 1 : 0;
    }
    if (kind === 'zigzag') {
      const per = 3 + Math.floor(s.d * 9);
      return ((i + Math.floor(j * (0.4 + s.e * 1.6))) % per) < per * (0.3 + s.f * 0.4) ? 1 : 0;
    }
    if (kind === 'moire') {
      const cx = (s.d - 0.5) * 2, cy = (s.e - 0.5) * 2;
      const dist = Math.hypot(u - cx, v - cy);
      return Math.sin(dist * (14 + s.f * 50) + s.g * 6.28) > 0 ? 1 : 0;
    }
    if (kind === 'blocks') {
      const a = RAND.hash01(Math.floor(i / (2 + Math.floor(s.d * 5))), Math.floor(j / (2 + Math.floor(s.d * 5))), s.k);
      const b = RAND.hash01(Math.floor(i / (5 + Math.floor(s.e * 9))), Math.floor(j / (5 + Math.floor(s.e * 9))), s.k + 1);
      return (a > 0.5) !== (b > 0.5) ? 1 : 0;
    }
    return RAND.hash01(i, j, s.k) < 0.3 + v * 0.4 ? 1 : 0;
  }

  function bitmap(p, cols, rows) {
    const bits = new Uint8Array(cols * rows);
    const n = Math.max(1, Math.round(p.regions));
    // Uneven strips, so the composition is not a stack of equal bands.
    const cuts = [0];
    for (let i = 1; i < n; i++) cuts.push(Math.round(rows * (i / n + (RAND.hash01(i, 0, (p.seed || 1) * 3) - 0.5) * 0.3)));
    cuts.push(rows);
    cuts.sort((a, b) => a - b);
    for (let r = 0; r < n; r++) {
      const from = cuts[r], to = cuts[r + 1];
      if (to <= from) continue;
      const pickAt = RAND.hash01(r * 7 + 1, 3, (p.seed || 1) * 5);
      // The mark is what the page opens on, and the other rules fill the rest.
      const kind = r === 0 && (p.motif || {}).mask ? 'mark'
        : KINDS[1 + (Math.floor(pickAt * (KINDS.length - 1)) % (KINDS.length - 1))];
      const s = { d: RAND.hash01(r, 1, (p.seed || 1) * 7), e: RAND.hash01(r, 2, (p.seed || 1) * 7),
        f: RAND.hash01(r, 3, (p.seed || 1) * 7), g: RAND.hash01(r, 4, (p.seed || 1) * 7),
        k: (p.seed || 1) * 11 + r };
      for (let j = from; j < to; j++) {
        for (let i = 0; i < cols; i++) {
          bits[j * cols + i] = cell(kind, i, kind === 'mark' ? j : j - from,
            cols, kind === 'mark' ? rows : to - from, p, s);
        }
      }
    }
    return bits;
  }

  // Rows shifted sideways, rows smeared downward, rectangles punched out.
  function tear(bits, cols, rows, p) {
    const g = p.glitch;
    if (g <= 0.001) return bits;
    const out = bits.slice();
    const shifts = Math.round(0.3 * rows * g);
    for (let n = 0; n < shifts; n++) {
      const j = Math.floor(RAND.hash01(n, 1, (p.seed || 1) * 17) * rows);
      const by = 1 + Math.floor(RAND.hash01(n, 2, (p.seed || 1) * 17) * 7);
      const row = out.slice(j * cols, (j + 1) * cols);
      for (let i = 0; i < cols; i++) out[j * cols + i] = row[(i + by) % cols];
    }
    const smears = Math.round(0.08 * rows * g);
    for (let n = 0; n < smears; n++) {
      const j = 1 + Math.floor(RAND.hash01(n, 3, (p.seed || 1) * 19) * (rows - 2));
      const deep = 1 + Math.floor(RAND.hash01(n, 4, (p.seed || 1) * 19) * 3);
      for (let d = 0; d < deep && j + d < rows; d++) {
        for (let i = 0; i < cols; i++) out[(j + d) * cols + i] = out[(j - 1) * cols + i];
      }
    }
    const drops = Math.round(6 * g);
    for (let n = 0; n < drops; n++) {
      const r = (k) => RAND.hash01(n * 5 + k, 7, (p.seed || 1) * 23 + k);
      const x = Math.floor(r(1) * cols), y = Math.floor(r(2) * rows);
      const w = 2 + Math.floor(r(3) * cols * 0.3), h = 1 + Math.floor(r(4) * rows * 0.08);
      const to = r(5) > 0.5 ? 1 : 0;
      for (let j = y; j < Math.min(rows, y + h); j++) {
        for (let i = x; i < Math.min(cols, x + w); i++) out[j * cols + i] = to;
      }
    }
    return out;
  }

  function paint(surface, W, H, p, pal) {
    pal.paper(surface, W, H, pal.ground);
    const cols = Math.max(24, Math.round(p.resolution));
    const rows = Math.max(24, Math.round((cols * H) / W));
    const bits = tear(bitmap(p, cols, rows), cols, rows, p);
    const cw = W / cols, ch = H / rows;
    surface.fillStyle = pal.inks[0].hex;
    for (let j = 0; j < rows; j++) {
      let run = -1;
      for (let i = 0; i <= cols; i++) {
        const lit = i < cols && bits[j * cols + i];
        if (lit && run < 0) run = i;
        else if (!lit && run >= 0) {
          surface.fillRect(R3(run * cw), R3(j * ch), R3((i - run) * cw), R3(ch + 0.5));
          run = -1;
        }
      }
    }
  }

  const controls = [
    { group: 'poster', key: 'regions', primary: true, label: 'Regions', type: 'range', min: 1, max: 5, step: 1 },
    { group: 'poster', key: 'resolution', label: 'Resolution', type: 'range', min: 32, max: 160, step: 4 },
    { group: 'poster', key: 'chunk', primary: true, label: 'Mark size', type: 'range', min: 0.4, max: 1.6, step: 0.02,
      needs: { of: 'motif', key: 'silhouette', least: 1,
        without: 'No shape could be read out of this drawing, so no region can be the mark.' } },
    { group: 'poster', key: 'glitch', primary: true, label: 'Glitch', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'poster', key: 'seed', label: 'Seed', type: 'seed' },
  ];

  return { key: 'static', kind: 'poster', vector: true, motif: true, tiles: false, ratio: 1,
    kinds: KINDS, controls, paint, bitmap, tear, cell };
}));
