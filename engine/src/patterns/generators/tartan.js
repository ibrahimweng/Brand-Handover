/* The mark's own proportions, woven into a sett.

   A tartan is not stripes crossing stripes, and getting that wrong is what
   makes most attempts at one look like a picnic blanket. It is a **sett**: a
   sequence of coloured bands with a written-down count, mirrored about two
   pivots so the sequence reads the same in both directions, run identically in
   the warp and the weft, and crossed on a **twill** — two over, two under,
   stepping one thread each row. The twill is why a tartan has that diagonal
   grain in it, and why where two colours cross you see more of one than the
   other rather than a flat blend.

   Three consequences the construction forces, all of them visible:

   **Where a colour crosses itself** you get a solid block of it. Those blocks
   are the squares a tartan reads as.

   **Where two colours cross** the twill shows about two thirds of the thread
   that is on top, so the square is a tweed of the two rather than a mix — and
   it is a *different* tweed above and below the diagonal, which is what makes a
   tartan look woven rather than printed.

   **The pivots** mean the sett is a palindrome. Miss them and the pattern still
   repeats, but it repeats the way wallpaper does, and the eye finds the join.

   What makes it this identity's: the sett is written from the drawing. How many
   bands, from how much shape there is to say; how wide each one, from the
   proportions inside the mark — the ratio of its ink to its box, of its stroke
   to its width, of its width to its height. A tartan's sett has always been a
   list of numbers somebody wrote down, and these are the identity's own
   numbers.

   Houndstooth is the same loom with a different sett, and it is here rather
   than in its own file because it is exactly that: a four-and-four check on a
   two-and-two twill, which is the smallest sett that produces the broken
   pointed shape. Sharing the weave is the point — get the twill right once. */
//
// UMD: `paint` runs in the studio, which has no require.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../rand'), require('../grid'), require('../tone'));
  } else root.PatternTartan = factory(root.PatternRand, root.PatternGrid, root.PatternTone);
}(typeof self !== 'undefined' ? self : this, function (RAND, GRID, TONE) {
  'use strict';

  const WEAVES = ['tartan', 'houndstooth', 'madras', 'tattersall'];

  /* The sett: a list of [ink, threads] written from the drawing.

     Mirrored about both ends, which is what makes it a sett rather than a
     stripe sequence. The count comes back as the full mirrored run, because
     everything downstream indexes into it and a half-sett that has to be
     unfolded at every lookup is a half-sett somebody will unfold wrongly.  */
  function settOf(p) {
    const n = Math.max(2, Math.round(p.bands));
    const seed = (p.seed || 1) * 71;
    const half = [];
    for (let i = 0; i < n; i++) {
      // The widths are the identity's own proportions, dealt round in order, so
      // the sett is written from the drawing rather than rolled. `widths` comes
      // off the mark in index.js.
      const w = (p.widths && p.widths.length) ? p.widths[i % p.widths.length]
        : 0.3 + RAND.hash01(i, 0, seed + 1) * 0.7;
      half.push([i, Math.max(1, Math.round(w * p.thread))]);
    }
    // Pivot at both ends: the first and last band are not repeated, which is
    // what a weaver means by a pivot and what keeps the count odd about them.
    const out = half.slice();
    for (let i = half.length - 2; i >= 1; i--) out.push(half[i]);
    return out;
  }

  // The thread at a position: which band of the sett it falls in.
  function threads(sett) {
    const out = [];
    for (const [ink, n] of sett) for (let i = 0; i < n; i++) out.push(ink);
    return out;
  }

  /* The weave.

     `over(i, j)` is true when the warp thread is on top at this crossing. A
     two-and-two twill steps one thread per row, which is `(i - j) mod 4 < 2`;
     the plain weave a tattersall wants is `(i + j) mod 2`; madras is a twill
     with the step reversed every few rows, which is what gives it its
     irregularity without going random. */
  function weaveOf(kind) {
    if (kind === 'tattersall') return (i, j) => ((i + j) % 2) === 0;
    if (kind === 'madras') return (i, j) => ((i - j + (Math.floor(j / 8) % 2 ? 2 : 0)) % 4 + 4) % 4 < 2;
    return (i, j) => (((i - j) % 4) + 4) % 4 < 2;
  }

  function paint(surface, W, H, p, pal) {
    const kind = WEAVES.indexOf(p.weave) > -1 ? p.weave : WEAVES[0];
    const over = weaveOf(kind);
    // Houndstooth is a sett, not a separate tool: four dark threads and four
    // light ones, on the same twill. Everything that makes the shape is the
    // weave.
    const sett = kind === 'houndstooth'
      ? [[0, Math.max(2, Math.round(p.thread))], [1, Math.max(2, Math.round(p.thread))]]
      : settOf(p);
    const warp = threads(sett);
    const n = warp.length;
    const cols = Math.max(8, Math.round(p.repeats) * n);
    const rows = Math.max(8, Math.round(cols * (H / W) / n) * n);
    // Two tones per ink: the thread itself, and the thread seen through the
    // other one. A crossing of two colours shows about two thirds of whichever
    // is on top, which is what makes a tartan look woven rather than printed.
    const inks = [];
    const pairs = [];
    const many = Math.max(2, Math.min(pal.inks.length + 1, Math.round(p.colours)));
    for (let i = 0; i < many; i++) inks.push(i === 0 ? pal.ground : pal.ink(i - 1));
    for (let a = 0; a < many; a++) {
      for (let b = 0; b < many; b++) pairs.push(a === b ? inks[a] : TONE.mix(inks[a], inks[b], 0.34));
    }
    const at = (i, j) => {
      const a = warp[i % n] % many;
      const b = warp[j % n] % many;
      // The thread on top decides, and the one under it tints — so the square
      // above the diagonal and the square below it are different tweeds of the
      // same two colours.
      return over(i, j) ? a * many + b : b * many + a;
    };
    pal.paper(surface, W, H, pal.ground);
    GRID.cells(surface, W, H, cols, rows, at, pairs);
  }

  const controls = [
    { group: 'pattern', key: 'weave', primary: true, label: 'Weave', type: 'chips', options: WEAVES },
    { group: 'pattern', key: 'bands', label: 'Bands in the sett', type: 'range', min: 2, max: 9, step: 1 },
    { group: 'pattern', key: 'thread', primary: true, label: 'Threads per band', type: 'range', min: 2, max: 24, step: 1 },
    { group: 'pattern', key: 'repeats', label: 'Setts across', type: 'range', min: 1, max: 4, step: 1 },
    { group: 'pattern', key: 'colours', primary: true, label: 'Colours', type: 'range', min: 2, max: 6, step: 1 },
    { group: 'pattern', key: 'seed', label: 'Seed', type: 'seed' },
  ];

  return { key: 'tartan', kind: 'pattern', matchable: true, vector: true, motif: false, ratio: 1,
    controls, paint, settOf, threads, weaveOf, WEAVES };
}));
