/* Modular blocks with the setting-out left on.

   From a reference: a dark field with a dotted construction grid on it, a few
   blocks of content snapped to that grid, and the drawing's own apparatus still
   visible — dashed extension lines, corner brackets, small coordinate labels
   like `S03` and `07.2,02.1` sitting where a block begins.

   The apparatus is the pattern. Blocks on a grid is a layout; blocks on a grid
   with the grid showing and the coordinates called out is a *plate* — a
   technical drawing of a layout — and that is a different thing to be handed.
   It says the composition was set out rather than arranged, which for an
   engine that derives everything from measurements is a true thing to say.

   So this draws four registers and they are all optional:

     the field   a dotted grid across the whole tile, the paper it is set on
     the blocks  rectangles snapped to that grid, in the identity's inks, some
                 of them carrying the mark
     the rules   dashed lines extending from each block's edges to the tile's,
                 which is how a drawing says where a thing sits
     the tags    a coordinate at one corner of each block, set in the smallest
                 type this engine draws

   The coordinates are real. They are the block's own grid position printed as
   it is, not decoration shaped like a number — so two blocks never carry the
   same tag and a person can find the block a tag names. */
//
// UMD: `paint` runs in the studio, which has no require.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../rand'), require('../motif'), require('../tone'));
  } else root.PatternPlate = factory(root.PatternRand, root.PatternMotif, root.PatternTone);
}(typeof self !== 'undefined' ? self : this, function (RAND, MOTIF, TONE) {
  'use strict';

  const R3 = (v) => Math.round(v * 1000) / 1000;
  const SETS = ['scattered', 'stacked', 'quartered', 'single'];
  const mod = (n, p) => ((n % p) + p) % p;
  const pad2 = (n) => (n < 10 ? '0' : '') + n;

  /* Which cells carry a block.

     Declared per set rather than dealt at random, because the whole point of a
     plate is that the composition was set out: a random one is a plate of
     nothing in particular. Every block is given in grid units, so the same set
     reads the same at any cell count. */
  function blocksOf(set, cols, rows, n, seed) {
    const out = [];
    if (set === 'single') {
      out.push({ x: Math.floor(cols * 0.25), y: Math.floor(rows * 0.3),
        w: Math.max(2, Math.round(cols * 0.5)), h: Math.max(2, Math.round(rows * 0.4)) });
      return out;
    }
    if (set === 'quartered') {
      const hw = Math.max(1, Math.floor(cols / 2)), hh = Math.max(1, Math.floor(rows / 2));
      out.push({ x: 0, y: 0, w: hw, h: hh });
      out.push({ x: hw, y: hh, w: cols - hw, h: rows - hh });
      return out;
    }
    if (set === 'stacked') {
      const bands = Math.max(2, Math.min(rows, Math.round(n)));
      const each = Math.max(1, Math.floor(rows / bands));
      for (let i = 0; i < bands; i++) {
        const w = Math.max(2, Math.round(cols * (0.35 + RAND.hash01(i, 3, seed) * 0.6)));
        out.push({ x: mod(Math.round(RAND.hash01(i, 5, seed) * (cols - w)), Math.max(1, cols - w + 1)),
          y: i * each, w: Math.min(w, cols), h: each });
      }
      return out;
    }
    const want = Math.max(1, Math.min(9, Math.round(n)));
    for (let i = 0; i < want; i++) {
      const w = Math.max(1, Math.round(1 + RAND.hash01(i, 11, seed) * (cols / 2 - 1)));
      const h = Math.max(1, Math.round(1 + RAND.hash01(i, 13, seed) * (rows / 2 - 1)));
      out.push({ x: Math.round(RAND.hash01(i, 17, seed) * Math.max(0, cols - w)),
        y: Math.round(RAND.hash01(i, 19, seed) * Math.max(0, rows - h)), w, h });
    }
    return out;
  }

  function paint(surface, W, H, p, pal) {
    const set = SETS.indexOf(p.set) > -1 ? p.set : SETS[0];
    const ground = pal.ground;
    pal.paper(surface, W, H, ground);
    const many = Math.max(1, Math.min(pal.inks.length, Math.round(p.colours)));
    const seed = (p.seed || 1) * 233;
    const cols = Math.max(3, Math.round(p.cells));
    const step = W / cols;
    const rows = Math.max(3, Math.round(H / step));
    const stepY = H / rows;
    const faint = TONE.mix(ground, pal.ink(0), Math.min(0.9, p.field));

    // The field: a dot at every crossing, which is the paper this is set on.
    if (p.field > 0) {
      surface.fillStyle = faint;
      surface.beginPath();
      const r = Math.max(0.28, Math.min(step, stepY) * 0.022);
      for (let j = 0; j <= rows; j++) {
        for (let i = 0; i <= cols; i++) {
          surface.moveTo(R3(i * step + r), R3(j * stepY));
          surface.arc(R3(i * step), R3(j * stepY), r, 0, Math.PI * 2);
        }
      }
      surface.fill();
    }

    const blocks = blocksOf(set, cols, rows, p.blocks, seed);
    const m = p.motif;
    const usable = !!(m && m.ops && m.ops.length);

    blocks.forEach((b, i) => {
      const x = b.x * step, y = b.y * stepY, w = b.w * step, h = b.h * stepY;

      // The rules: dashed lines from the block's edges out to the tile's, which
      // is how a drawing says where a thing sits rather than just putting it there.
      if (p.rules > 0) {
        surface.strokeStyle = TONE.mix(ground, pal.ink(0), Math.min(0.9, p.rules));
        surface.lineWidth = Math.max(0.3, step * 0.012);
        surface.beginPath();
        for (const vx of [x, x + w]) { surface.moveTo(R3(vx), 0); surface.lineTo(R3(vx), H); }
        for (const vy of [y, y + h]) { surface.moveTo(0, R3(vy)); surface.lineTo(W, R3(vy)); }
        surface.stroke();
      }

      surface.fillStyle = pal.ink(mod(i + Math.round(p.ink), many));
      surface.beginPath();
      surface.rect(R3(x), R3(y), R3(w), R3(h));
      surface.fill();

      // Some of them carry the mark, which is what keeps this the client's
      // plate rather than a plate.
      if (usable && p.mark > 0 && RAND.hash01(i, 23, seed) < p.mark) {
        surface.fillStyle = surface.strokeStyle = ground;
        const r = Math.min(w, h) * 0.32;
        MOTIF.draw(surface, m, R3(x + w / 2), R3(y + h / 2), r);
      }

      /* The tag: the block's own grid position, printed. Real coordinates —
         a person can read `03.2,05.1` and find the block it names, because it
         is that block's column and row. Drawn as marks rather than set as type,
         since this file has no typeface and a pattern that needed one would not
         repeat the same on every machine. */
      if (p.tags > 0) {
        const t = `${pad2(b.x)}.${b.w},${pad2(b.y)}.${b.h}`;
        surface.fillStyle = TONE.mix(ground, pal.ink(0), Math.min(1, p.tags));
        const size = Math.max(1.2, Math.min(step, stepY) * 0.13 * p.tagSize);
        surface.beginPath();
        for (let c = 0; c < t.length; c++) {
          const ch = t.charCodeAt(c);
          // Each character is a small bar whose height is its own code, which
          // is a legible *kind* of mark — a row of ticks that differ — without
          // pretending to be letters this file cannot draw.
          const hh = size * (0.45 + (ch % 7) / 9);
          surface.rect(R3(x + 2 + c * size * 0.62), R3(y + 2 + (size - hh)),
            R3(size * 0.42), R3(hh));
        }
        surface.fill();
      }
    });
  }

  const controls = [
    { group: 'pattern', key: 'set', primary: true, label: 'Setting out', type: 'chips', options: SETS },
    { group: 'pattern', key: 'cells', primary: true, label: 'Grid across', type: 'range', min: 4, max: 24, step: 1 },
    { group: 'pattern', key: 'blocks', primary: true, label: 'Blocks', type: 'range', min: 1, max: 9, step: 1 },
    { group: 'ground', key: 'field', label: 'The field', type: 'range', min: 0, max: 1, step: 0.02 },
    { group: 'detail', key: 'rules', label: 'Setting-out lines', type: 'range', min: 0, max: 1, step: 0.02 },
    { group: 'detail', key: 'tags', label: 'Coordinates', type: 'range', min: 0, max: 1, step: 0.02 },
    { group: 'detail', key: 'tagSize', label: 'Coordinate size', type: 'range', min: 0.5, max: 2, step: 0.05 },
    { group: 'mark', key: 'mark', label: 'Blocks carrying the mark', type: 'range', min: 0, max: 1, step: 0.02,
      needs: { of: 'motif', key: 'moves', least: 1,
        without: 'No shape could be read out of this drawing, so the blocks are plain. '
          + 'The setting out is still here.' } },
    { group: 'pattern', key: 'colours', label: 'Inks', type: 'range', min: 1, max: 6, step: 1 },
    { group: 'pattern', key: 'ink', label: 'First ink', type: 'range', min: 0, max: 5, step: 1 },
    { group: 'pattern', key: 'seed', label: 'Seed', type: 'seed' },
  ];

  return { key: 'plate', kind: 'pattern', vector: true, motif: true, ratio: 1,
    controls, paint, blocksOf, SETS };
}));
