/* A typographic fly-poster, set in the identity's own name.

   PLAYGRND's Kiosk builds five layers: concentric discs around a centre held
   deliberately off the page, so they arrive as big arcs crossing the sheet
   rather than as a bullseye; a half of vertical stripes painted straight over
   them; a column of blocks and halftone panels down one edge; one dark panel
   dropped over the composition; and a dense grid of stamped glyphs.

   The glyphs are the half a brand cannot use, and they are also the half that
   makes it read as a fly-poster. So they are the identity's own name and its
   own mark, stamped alternately across the grid at two sizes — the large pass
   on the cell centres, the small pass on the grid intersections. It is that
   second pass packed into the gaps that makes the page read as dense, and it
   is the same in the spec.

   The name is the logotype drawing rather than type set at run time. The
   engine ships its faces as woff2, which cannot be outlined without a
   decompressor — and it does not need to be: every identity here already draws
   its own name, and using that drawing is the same argument that makes the
   mark the motif. A poster that set the name in a face and hoped it matched
   would be showing a client something that is not their logotype. */
//
// UMD: `paint` runs in the studio, which has no require.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../rand'), require('../motif'));
  } else root.PatternKiosk = factory(root.PatternRand, root.PatternMotif);
}(typeof self !== 'undefined' ? self : this, function (RAND, MOTIF) {
  'use strict';

  const R3 = (v) => Math.round(v * 1000) / 1000;

  function paint(surface, W, H, p, pal) {
    const inks = pal.inks;
    const paper = pal.ground;
    const dark = inks[inks.length - 1].hex;
    const bands = inks.slice(0, Math.max(1, inks.length - 1));
    pal.paper(surface, W, H, paper);

    // 1. The sweep. The centre is held off the page to the upper left, so the
    //    rings arrive as arcs crossing the sheet instead of a target.
    const cx = W * (-0.22 + RAND.hash01(1, 1, (p.seed || 1) * 3) * 0.3);
    const cy = H * (-0.06 + RAND.hash01(2, 1, (p.seed || 1) * 3) * 0.36);
    const reach = Math.hypot(Math.max(W - cx, cx), Math.max(H - cy, cy));
    const rings = Math.max(1, Math.round(p.sweep));
    for (let i = rings; i >= 1; i--) {
      surface.fillStyle = bands[(i + Math.round(p.shift)) % bands.length].hex;
      surface.beginPath();
      surface.arc(R3(cx), R3(cy), R3((reach * i) / rings), 0, Math.PI * 2);
      surface.fill();
    }

    // 2. The stripe half, painted straight over the sweep rather than clipped,
    //    so the SVG writer and the canvas produce the same picture.
    const from = W * p.split;
    const n = Math.max(1, Math.round(p.stripes));
    let x = from;
    for (let i = 0; i < n && x < W; i++) {
      const w = ((W - from) / n) * (0.45 + RAND.hash01(i, 3, (p.seed || 1) * 5) * 1);
      surface.fillStyle = bands[(i * 3 + 1) % bands.length].hex;
      surface.fillRect(R3(x), 0, R3(Math.min(w, W - x)), H);
      x += w;
    }

    // 3. Blocks down the right edge: solid, or a paper panel of halftone dots.
    const bw = W * 0.115;
    const bh = H / 8;
    for (let i = 0; i < 8; i++) {
      if (RAND.hash01(i, 4, (p.seed || 1) * 7) > p.blocks) continue;
      const by = i * bh;
      if (i % 2) {
        surface.fillStyle = dark;
        surface.fillRect(R3(W - bw), R3(by), R3(bw), R3(bh));
      } else {
        surface.fillStyle = paper;
        surface.fillRect(R3(W - bw), R3(by), R3(bw), R3(bh));
        surface.fillStyle = dark;
        const across = 6, pitch = bw / across;
        for (let b = 0; b * pitch < bh; b++) {
          for (let a = 0; a < across; a++) {
            surface.beginPath();
            surface.arc(R3(W - bw + (a + 0.5) * pitch), R3(by + (b + 0.5) * pitch),
              R3(pitch * 0.23), 0, Math.PI * 2);
            surface.fill();
          }
        }
      }
    }

    // 4. One dark panel dropped over the composition, lower middle.
    const pw = W * (0.26 + RAND.hash01(5, 1, (p.seed || 1) * 11) * 0.26);
    const ph = H * (0.14 + RAND.hash01(6, 1, (p.seed || 1) * 11) * 0.11);
    surface.fillStyle = dark;
    surface.fillRect(R3(W * 0.18), R3(H * 0.58), R3(pw), R3(ph));

    // 5. The type: the identity's own name and its own mark, stamped over
    //    everything in two passes — the large one on cell centres, the small
    //    one on the grid intersections. The second pass is what makes the page
    //    read as dense rather than as a grid of logos.
    const word = p.word && p.word.ops && p.word.ops.length ? p.word : null;
    const mark = p.motif && p.motif.ops && p.motif.ops.length ? p.motif : null;
    if (!word && !mark) return;
    const cols = Math.max(3, Math.round(p.columns));
    const cw = W / cols;
    const rows = Math.max(1, Math.round(H / cw));
    const rh = H / rows;
    const stamp = (shape, x, y, r, k) => {
      if (!shape) return;
      surface.fillStyle = RAND.hash01(k, 9, (p.seed || 1) * 13) < 0.28 ? dark : inks[0].hex;
      const ops = shape.fillOps && shape.fillOps.length ? shape.fillOps : shape.ops;
      // A wide shape is normalised into the same unit box as a square one, so
      // drawn at the same radius it comes out as tall as a square shape and a
      // ninth as thick. kvist's logotype is nine times wider than it is tall:
      // stamped by height it was a scratch, and eight posters read as noise
      // rather than as type. Grown by its own proportion, capped so it cannot
      // run past its neighbour.
      const wide = Math.min(3, Math.max(1, shape.ratio || 1));
      MOTIF.draw(surface, { ops, stroked: false }, R3(x), R3(y), R3(r * wide));
    };
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const k = j * cols + i;
        if (RAND.hash01(i, j, (p.seed || 1) * 17) < p.large) {
          const useWord = word && RAND.hash01(i, j, (p.seed || 1) * 19) < p.words;
          stamp(useWord ? word : mark, (i + 0.5) * cw, (j + 0.5) * rh, (rh * p.bigSize) / 2, k);
        }
      }
    }
    for (let j = 0; j <= rows; j++) {
      for (let i = 0; i <= cols; i++) {
        const k = 9000 + j * (cols + 1) + i;
        if (RAND.hash01(i + 3, j + 5, (p.seed || 1) * 23) >= p.small) continue;
        const useWord = word && RAND.hash01(i + 7, j + 11, (p.seed || 1) * 29) < p.words;
        stamp(useWord ? word : mark, i * cw, j * rh, (rh * p.smallSize) / 2, k);
      }
    }
  }

  const controls = [
    { group: 'ground', key: 'split', label: 'Split', type: 'range', min: 0.15, max: 0.95, step: 0.01 },
    { group: 'ground', key: 'sweep', label: 'Sweep bands', type: 'range', min: 2, max: 40, step: 1 },
    { group: 'ground', key: 'shift', label: 'Band shift', type: 'range', min: 0, max: 8, step: 1 },
    { group: 'ground', key: 'stripes', label: 'Stripes', type: 'range', min: 2, max: 24, step: 1 },
    { group: 'ground', key: 'blocks', label: 'Blocks', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'type', key: 'columns', label: 'Columns', type: 'range', min: 3, max: 30, step: 1 },
    { group: 'type', key: 'bigSize', label: 'Large size', type: 'range', min: 0.3, max: 1.6, step: 0.01 },
    { group: 'type', key: 'large', label: 'How many large', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'type', key: 'smallSize', label: 'Small size', type: 'range', min: 0.1, max: 0.9, step: 0.01 },
    { group: 'type', key: 'small', label: 'How many small', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'type', key: 'words', label: 'Name against mark', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'type', key: 'seed', label: 'Seed', type: 'seed' },
  ];

  return { key: 'kiosk', kind: 'poster', vector: true, motif: true, word: true,
    tiles: false, ratio: 0.8, controls, paint };
}));
