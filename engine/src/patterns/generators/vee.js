/* The mark, counterchanged out of mirrored chevrons.

   PLAYGRND's Vee cuts the page into horizontal bands and runs a set of parallel
   bars through each of them, mirroring the angle at the page's midline so the
   bars meet in a chevron. Four inks, a duty cycle, and — in `cross` — two sets
   at opposite angles with their intersection filled in a fourth colour.

   Two things had to change for a tile.

   **The angle is a lattice direction, not a number of degrees.** Bars at 43°
   do not come back round at the edge of a square: the pattern would have a seam
   down it wherever the tile met itself. Here a direction is a whole-number pair
   — one across and two down, three across and one down — so the bar count per
   tile is a whole number by construction and the join is exact rather than
   close. The chips name the angle each pair works out to, because a designer
   thinks in degrees and not in lattice vectors.

   **The mark is the counterchange.** Optic does this on a poster: run the bars,
   then re-run them inside a silhouette under a different phase, so the shape
   appears as a pure figure-ground inversion with nothing drawn on its edge.
   The same trick tiles, and it is the reason this generator is here rather than
   being a second zigzag — the client's logo is not drawn on the stripes, it is
   made of them. */
//
// UMD: `paint` runs in the studio, which has no require.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../rand'), require('../motif'), require('../grid'));
  } else root.PatternVee = factory(root.PatternRand, root.PatternMotif, root.PatternGrid);
}(typeof self !== 'undefined' ? self : this, function (RAND, MOTIF, GRID) {
  'use strict';

  const EMPTY = GRID.EMPTY;

  const R3 = (v) => Math.round(v * 1000) / 1000;
  const frac = (v) => v - Math.floor(v);

  /* The directions a bar may run, as whole steps across and down.

     Every one of these makes the bar field exactly periodic on the tile: the
     stripe coordinate is `a·x/W + b·y/H` times a whole count, so moving one
     tile across adds exactly `a·count` to it and the phase is unchanged. The
     label is what the direction works out to on a square tile, which is the
     number a designer is actually choosing. */
  const RUNS = [
    { key: '45°', a: 1, b: 1 }, { key: '27°', a: 2, b: 1 }, { key: '63°', a: 1, b: 2 },
    { key: '18°', a: 3, b: 1 }, { key: '72°', a: 1, b: 3 }, { key: 'across', a: 0, b: 1 },
    { key: 'down', a: 1, b: 0 },
  ];
  const STRUCTURES = ['chevron', 'quad', 'diagonal', 'cross'];

  const runOf = (key) => RUNS[Math.max(0, RUNS.findIndex((r) => r.key === key))] || RUNS[0];

  // Is this point on a bar, for a direction and a phase?
  //
  // The count multiplies the *whole* direction, which is the line that makes
  // this tile: one step across the tile adds `a·count` to the coordinate, and a
  // whole number added to a fraction leaves the fraction alone. Leave the count
  // off — as the first version did — and the tile gets `a` bars and `b` bars,
  // which is one or three, which is a flag.
  const onBar = (x, y, W, H, r, count, weight, sx, phase) =>
    frac(((r.a * sx * x) / W + (r.b * y) / H) * count + phase) < weight ? 1 : 0;

  /* Which bars are lit at a point.

     `structure` decides how many sets there are and which way each leans.
     Everything is decided per point rather than drawn as geometry, because a
     counterchange has to ask "which side of the figure am I on" and a drawn bar
     cannot answer that. The cells are painted through the grid painter, which
     is what keeps ten thousand of them to one path per ink. */
  function field(W, H, p) {
    const r = runOf(p.run);
    const count = Math.max(1, Math.round(p.count));
    const bands = Math.max(1, Math.round(p.bands));
    const kind = STRUCTURES.indexOf(p.structure) > -1 ? p.structure : STRUCTURES[0];
    const weight = Math.max(0.05, Math.min(0.95, p.weight));
    return function at(x, y) {
      // Which band, and which way it leans. A chevron mirrors at every band
      // edge; a quad mirrors across the middle as well; a diagonal never does.
      const band = Math.floor((y / H) * bands);
      const half = x / W < 0.5 ? -1 : 1;
      const lean = kind === 'diagonal' ? 1
        : kind === 'quad' ? (band % 2 ? -1 : 1) * half
          : (band % 2 ? -1 : 1);
      const one = onBar(x, y, W, H, r, count, weight, lean, band * p.shift);
      if (kind !== 'cross') return one;
      // Two sets at opposite leans. Their intersection is the fourth ink, which
      // is what makes a cross read as woven rather than as two patterns
      // arguing.
      const two = onBar(x, y, W, H, r, count, weight, -lean, 0.5 - band * p.shift);
      return one && two ? 3 : one ? 1 : two ? 2 : 0;
    };
  }

  function paint(surface, W, H, p, pal) {
    const at = field(W, H, p);
    const base = pal.ground;
    const inks = [pal.ink(0), pal.ink(1), pal.ink(2)];
    pal.paper(surface, W, H, base);

    // The bars, as a cell grid rather than as rectangles at an angle. The cell
    // is a fraction of the bar's own period, so the edge of a bar lands on a
    // cell boundary and the field stays hard.
    // Eight cells per bar. Enough that a bar edge lands within an eighth of its
    // own width of where it belongs, and few enough that a tile is thirty
    // thousand cells rather than a hundred and eighty.
    const n = Math.max(24, Math.round(Math.max(1, p.count) * 8));
    const rows = Math.max(24, Math.round(n * (H / W)));
    const cw = W / n, ch = H / rows;
    // Where the mark is, and what happens to the bars there.
    //
    // A counterchange, not a stamp. Inside the figure the bar becomes the paper
    // and the paper becomes the bar, so nothing at all is drawn on the figure's
    // edge and the shape appears only because the bars either side of it
    // disagree. The first version phase-shifted the bars inside the figure
    // instead and the mark came out as a nibble at the edge of a chevron —
    // a shift is a shift, and an inversion is a shape.
    const reps = Math.max(1, Math.round(p.repeat));
    const cell = (i, j) => {
      const x = (i + 0.5) * cw, y = (j + 0.5) * ch;
      const v = at(x, y);
      const inMark = p.mark > 0
        && MOTIF.inside(p.motif, frac((x / W) * reps), frac((y / H) * reps), p.spread);
      if (!inMark) return v ? v : EMPTY;
      return v ? 0 : 1;
    };
    // Index 0 is the ground, so a lit bar inside the figure comes out as paper.
    const colours = [base, inks[0], inks[1], inks[2]];
    GRID.cells(surface, W, H, n, rows, cell, colours);
  }

  const controls = [
    { group: 'pattern', key: 'run', label: 'Angle', type: 'chips', options: RUNS.map((r) => r.key) },
    { group: 'pattern', key: 'structure', primary: true, label: 'Structure', type: 'chips', options: STRUCTURES },
    { group: 'pattern', key: 'count', primary: true, label: 'Bars', type: 'range', min: 2, max: 40, step: 1 },
    { group: 'pattern', key: 'weight', primary: true, label: 'Bar weight', type: 'range', min: 0.15, max: 0.85, step: 0.01 },
    { group: 'pattern', key: 'bands', label: 'Bands', type: 'range', min: 1, max: 8, step: 1 },
    { group: 'pattern', key: 'shift', label: 'Band offset', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'mark', key: 'mark', label: 'Counterchange the mark', type: 'range', min: 0, max: 1, step: 0.01,
      needs: { of: 'motif', key: 'masked', least: 1,
        without: 'No bitmap could be taken of this shape — it is finer than the grid that '
          + 'reads it. The bars run unbroken instead.' } },
    { group: 'mark', key: 'repeat', label: 'Marks across', type: 'range', min: 1, max: 6, step: 1 },
    { group: 'mark', key: 'spread', label: 'Mark size', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'mark', key: 'seed', label: 'Seed', type: 'seed' },
  ];

  return { key: 'vee', kind: 'pattern', vector: true, motif: true, ratio: 1,
    controls, paint, field, RUNS, STRUCTURES };
}));
