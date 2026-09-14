/* The mark, pieced into a quilt block.

   PLAYGRND's Quilt fills an index grid from small integer expressions on
   coordinates measured from the centre of the frame, so every composition comes
   out mirror-symmetric about both axes and the motifs sit inside their borders.
   Four inks with fixed roles: a base, two that do the piecing, and a pop.

   A quilt block is made the way it is for a reason that suits this brief
   exactly. It is built from one quarter and mirrored, because that is how
   somebody piecing cloth works — cut four of a shape, turn them to face each
   other, and the block has a centre. So the block has a **medallion**, and a
   medallion is a place to put a logo. The mark goes there, in the pop ink, on
   the one grid the rest of the block is already measured from.

   The mark is the one thing not mirrored. A quilt block is four-fold symmetric
   and a word is not: mirrored, marlow's block reads "Marlow" against "wolraM"
   twice over. `mirrorable` already carries that answer for every identity here,
   and where it says no the mark is stamped once, upright, in each block.

   Everything tiles by construction: the tile is a whole number of blocks
   across, each block is dealt from its own coordinates, and no expression here
   reaches outside its own block. */
//
// UMD: `paint` runs in the studio, which has no require.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../rand'), require('../motif'), require('../grid'));
  } else root.PatternQuilt = factory(root.PatternRand, root.PatternMotif, root.PatternGrid);
}(typeof self !== 'undefined' ? self : this, function (RAND, MOTIF, GRID) {
  'use strict';

  const EMPTY = GRID.EMPTY;
  // The piecings. Every one of them is an expression on the mirrored
  // coordinates and nothing else — no noise, no randomness inside a block —
  // because a quilt is pieced and a pieced thing has an arithmetic to it.
  const PIECINGS = ['bands', 'diamond', 'star', 'ninepatch', 'cabin', 'sawtooth', 'brick'];

  // How the block is pieced, at a point measured from its own centre.
  //
  // `mx` and `my` run 0 at the centre to 1 at the edge; `bx` and `by` are the
  // unmirrored 0..1. Returns which of the two working inks the patch takes.
  function piece(kind, mx, my, bx, by, n) {
    const ring = Math.max(mx, my);
    switch (kind) {
      case 'bands': return Math.floor(my * n) % 2;
      case 'diamond': return Math.floor((mx + my) * n * 0.7) % 2;
      case 'star': return (mx + my > 0.95 ? 1 : 0) ^ (ring > 0.62 ? 1 : 0);
      case 'ninepatch': return (Math.floor(bx * 3) + Math.floor(by * 3)) % 2;
      case 'cabin': return Math.floor(ring * n) % 2;
      case 'sawtooth': return (Math.floor(mx * n) + Math.floor(my * n)) % 2;
      default: return (Math.floor(by * n) + (Math.floor(by * n) % 2 ? Math.floor(bx * n + 0.5) : Math.floor(bx * n))) % 2;
    }
  }

  function decide(W, H, p) {
    const blocks = Math.max(1, Math.round(p.blocks));
    // A whole number of cells per block, so a block's arithmetic is the same
    // block wherever it lands on the tile.
    const per = Math.max(6, Math.round(p.cells / blocks));
    const cols = per * blocks;
    const rows = Math.max(1, Math.round((H / W) * blocks)) * per;
    const kind = PIECINGS.indexOf(p.style) > -1 ? p.style : PIECINGS[0];
    const n = Math.max(1, Math.round(p.pieces));
    const seed = (p.seed || 1) * 23;
    return { cols, rows, per, blocks, at(i, j) {
      const bi = Math.floor(i / per), bj = Math.floor(j / per);
      const bx = (i % per + 0.5) / per, by = (j % per + 0.5) / per;
      const mx = Math.abs(bx - 0.5) * 2, my = Math.abs(by - 0.5) * 2;
      // The mark, in the pop ink, at the block's centre. Mirrored with the rest
      // of the block where the shape is its own mirror, stamped upright where
      // it is a word.
      if (p.mark > 0) {
        const u = p.flip ? 0.5 + (bx < 0.5 ? -mx : mx) * 0.5 : bx;
        const v = p.flip ? 0.5 + (by < 0.5 ? -my : my) * 0.5 : by;
        if (MOTIF.inside(p.motif, u, v, p.spread)
          && RAND.hash01(i, j, seed + 3) < p.mark) return 3;
      }
      // A block that leaves its ground open. Dealt per block, not per cell, so
      // it is the block that is plain rather than the cells that are missing.
      const plain = RAND.hash01(bi, bj, seed + 1) < p.plain;
      if (plain && ring(mx, my) > p.border) return 0;
      return 1 + piece(kind, mx, my, bx, by, n);
    } };
  }
  const ring = (mx, my) => Math.max(mx, my);

  function paint(surface, W, H, p, pal) {
    const g = decide(W, H, p);
    // Four roles: a plain ink, two that do the piecing, and the paper for the
    // medallion.
    //
    // The pop used to be a fourth ink, and on an identity with three it wrapped
    // round to the first one — so the medallion came out the same colour as the
    // patches beside it and the mark was invisible on a third of the
    // repository. The paper always contrasts with whatever is pieced on it,
    // because that is what paper is for.
    const roles = [pal.ink(0), pal.ink(1), pal.ink(2), pal.ground];
    pal.paper(surface, W, H, pal.ground);
    GRID.cells(surface, W, H, g.cols, g.rows, g.at, roles);
  }

  const controls = [
    { group: 'pattern', key: 'cells', primary: true, label: 'Cells across', type: 'range', min: 12, max: 96, step: 2 },
    { group: 'pattern', key: 'blocks', label: 'Blocks across', type: 'range', min: 1, max: 6, step: 1 },
    { group: 'pattern', key: 'style', primary: true, label: 'Piecing', type: 'chips', options: PIECINGS },
    { group: 'pattern', key: 'pieces', label: 'Patches', type: 'range', min: 1, max: 12, step: 1 },
    { group: 'pattern', key: 'plain', label: 'Plain blocks', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'pattern', key: 'border', label: 'Border', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'mark', key: 'mark', primary: true, label: 'Mark in the block', type: 'range', min: 0, max: 1, step: 0.01,
      needs: { of: 'motif', key: 'masked', least: 1,
        without: 'No bitmap could be taken of this shape — it is finer than the grid that '
          + 'reads it. The blocks are pieced without a medallion.' } },
    { group: 'mark', key: 'spread', label: 'Mark size', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'mark', key: 'flip', label: 'Mirror the mark', type: 'chips', options: [0, 1],
      needs: { of: 'motif', key: 'mirrorable', least: 1,
        without: 'This shape is the wordmark. Mirrored into a block it reads one way '
          + 'and then backwards, which is a quilt somebody pays to unpick.' } },
    { group: 'mark', key: 'seed', label: 'Seed', type: 'seed' },
  ];

  const plan = (W, H, p) => { const g = decide(W, H, p);
    return { cols: g.cols, rows: g.rows, blocks: g.blocks, per: g.per }; };

  // The piecings, declared. A generator that writes a `style` into its
  // parameters and does not say what the list is leaves the studio with a
  // chip row it cannot draw and the manual naming a style nobody can find.
  return { key: 'quilt', kind: 'pattern', vector: true, motif: true, ratio: 1,
    styles: PIECINGS, controls, paint, plan, decide, PIECINGS };
}));
