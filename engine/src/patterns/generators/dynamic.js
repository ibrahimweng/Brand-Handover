/* The mark, as a system rather than a drawing.

   A dynamic identity is not a logo that moves. It is a logo defined as a rule
   with free variables, where the artefact the client owns is the *rule* and any
   particular drawing is one reading of it — the MIT Media Lab's three shapes
   and their permutations, Nordkyn's mark driven by the wind and the temperature
   at the cape, Casa da Música's forms taken from a photograph. What is
   distinctive about them as patterns is that the repeat is not a repeat: no two
   cells are the same, and the thing the eye picks up is the axis along which
   they differ.

   So the tile is a parameter space, laid out. Two variables, one running across
   and one running down, and every cell is the client's own mark read at that
   point. Across a row the first variable travels; down a column the second.
   That is a legible thing rather than a clever one — a viewer can see what the
   system's variables are by looking at the cloth, which is exactly what these
   identities are for.

   Six variables, and they are the six a mark can take without stopping being
   itself: how far it is turned, how large it is set, how heavily it is drawn,
   how far it is slanted, which ink it takes, and how much of its cell it is
   allowed to occupy before the cell crops it.

   Three ways of reading the space. `matrix` steps it — clean ranks and files,
   each cell one grid point, which is how a system is presented on the page it
   is announced on. `drift` runs it continuously, so the variables move across
   the field rather than between cells and the pattern reads as a gradient made
   of marks. `permute` deals grid points so that each row and each column
   carries every value exactly once — a Latin square — which is the arrangement
   that shows the whole space with no value favoured by position.

   In all three the traverse goes out and comes back rather than straight
   across, because a tile has to repeat and a variable that ends where it did
   not start puts a seam down every join. It costs nothing: a row that travels
   out and back shows the same range of the system as one that only travels
   out.

   The `range` control is the honest one. At zero every cell is the same mark
   and the pattern is a lattice, which is a true statement about a system whose
   variables are not varying. */
//
// UMD: `paint` runs in the studio, which has no require.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../motif'), require('../tone'));
  } else root.PatternDynamic = factory(root.PatternMotif, root.PatternTone);
}(typeof self !== 'undefined' ? self : this, function (MOTIF, TONE) {
  'use strict';

  const R3 = (v) => Math.round(v * 1000) / 1000;
  const TAU = Math.PI * 2;
  const WAYS = ['matrix', 'drift', 'permute'];
  const AXES = ['turn', 'size', 'weight', 'slant', 'ink', 'crop'];
  const mod = (n, p) => ((n % p) + p) % p;

  /* One reading of the system.

     `t` is where this cell sits on the axis, 0 to 1, already scaled by range.
     Everything is written as a departure from the mark as drawn, so range zero
     lands exactly on the artwork rather than near it. */
  function read(axis, t, range, out) {
    const d = (t - 0.5) * 2 * range;
    if (axis === 'turn') out.turn += d * 0.5;
    else if (axis === 'size') out.size *= 1 + d * 0.55;
    else if (axis === 'weight') out.weight *= 1 + d * 1.6;
    else if (axis === 'slant') out.slant += d * 0.7;
    else if (axis === 'ink') out.ink += t * range;
    else if (axis === 'crop') out.crop = Math.max(0, Math.min(1, out.crop - d * 0.8));
    return out;
  }

  /* Where a cell sits in the space.

     Out and back, not straight across. A tile has to repeat, and a variable
     that runs 0 to 1 from the first column to the last does not: column zero of
     the next tile sits against the last column of this one and the system jumps
     from its far end to its near one. Rendered 2x2 that reads as a hard band
     down every join, which is what the first draft did.

     So the traverse is a triangle — 0 at the left edge, 1 at the middle, 0
     again at the right — which closes exactly and costs nothing, because a row
     that shows the variable travelling out and coming back shows the same range
     of the system as one that only travels out.

     `permute` needs none of this. A Latin square built as `(i + j) mod cols` is
     already periodic in both axes: the column past the last carries what the
     first carries. That is a property of the arithmetic rather than a fix, and
     it is the reason the square is built by arithmetic rather than shuffled. */
  function traverse(k, n) {
    if (n <= 1) return 0.5;
    const x = k / n;
    return 1 - Math.abs(2 * x - 1);
  }

  function pointOf(i, j, cols, rows, way) {
    // Modulo the lattice before anything else, so a cell one tile over reads
    // the same point of the space as the cell it is a copy of. The triangle
    // closes at the edges on its own, but only exactly at them; this makes the
    // whole expression periodic, which is the property a test can state.
    const x = mod(i, Math.max(1, cols));
    const y = mod(j, Math.max(1, rows));
    if (way === 'permute') {
      const a = mod(x + y, cols);
      const b = mod(y + x * 2, rows);
      return [cols > 1 ? a / (cols - 1) : 0.5, rows > 1 ? b / (rows - 1) : 0.5];
    }
    // `drift` reads the traverse at the cell's centre and `matrix` at its edge:
    // the same journey, sampled half a cell apart, which is the difference
    // between a gradient and a set of ranks.
    const off = way === 'drift' ? 0.5 : 0;
    return [traverse(x + off, cols), traverse(y + off, rows)];
  }

  function lattice(W, H, p) {
    const cols = Math.max(1, Math.round(p.cells));
    const step = W / cols;
    const rows = Math.max(1, Math.round(H / step));
    return { cols, rows, stepX: W / cols, stepY: H / rows };
  }

  function paint(surface, W, H, p, pal) {
    const way = WAYS.indexOf(p.way) > -1 ? p.way : WAYS[0];
    const across = AXES.indexOf(p.across) > -1 ? p.across : AXES[0];
    const down = AXES.indexOf(p.down) > -1 ? p.down : AXES[1];
    const m = p.motif;
    const L = lattice(W, H, p);
    pal.paper(surface, W, H, pal.ground);
    const many = Math.max(1, Math.min(pal.inks.length, Math.round(p.colours)));

    /* The grid the system is presented on.

       Hairline, at the cell's own edge, and drawn under the marks. A dynamic
       identity is nearly always shown on one — it is how the system says "these
       are states, not a picture" — and it is the one piece of furniture here
       that is not the client's drawing. Off at zero for anyone who disagrees. */
    if (p.grid > 0) {
      surface.strokeStyle = TONE.mix(pal.ground, pal.ink(0), Math.min(1, p.grid));
      surface.lineWidth = Math.max(0.4, p.grid * Math.min(L.stepX, L.stepY) * 0.02);
      surface.beginPath();
      for (let i = 1; i < L.cols; i++) { surface.moveTo(R3(i * L.stepX), 0); surface.lineTo(R3(i * L.stepX), H); }
      for (let j = 1; j < L.rows; j++) { surface.moveTo(0, R3(j * L.stepY)); surface.lineTo(W, R3(j * L.stepY)); }
      surface.stroke();
    }

    if (!(m && m.ops && m.ops.length)) return;
    const half = Math.min(L.stepX, L.stepY) * 0.5;

    for (let j = 0; j < L.rows; j++) {
      for (let i = 0; i < L.cols; i++) {
        const [u, v] = pointOf(i, j, L.cols, L.rows, way);
        const st = { turn: 0, size: 1, weight: 1, slant: 0, ink: 0, crop: 1 };
        read(across, u, p.range, st);
        read(down, v, p.range, st);
        const r = half * p.scale * st.size;
        if (r < 0.4) continue;
        const cx = (i + 0.5) * L.stepX;
        const cy = (j + 0.5) * L.stepY;
        surface.save();
        /* Cropped by its own cell, not by the tile. This is the move that makes
           a state read as a state: a mark too large for its cell is cut by the
           cell's edge rather than overlapping its neighbour, which is what a
           system's own presentation grid does to it. */
        if (st.crop < 1) {
          const k = Math.max(0.05, st.crop);
          surface.beginPath();
          surface.rect(R3(cx - L.stepX * 0.5 * k), R3(cy - L.stepY * 0.5 * k),
            R3(L.stepX * k), R3(L.stepY * k));
          surface.clip();
        }
        surface.translate(R3(cx), R3(cy));
        if (st.turn) surface.rotate(st.turn * TAU);
        if (st.slant) surface.transform(1, 0, st.slant, 1, 0, 0);
        surface.fillStyle = surface.strokeStyle = pal.ink(mod(Math.round(p.ink + st.ink * many), many));
        if (MOTIF.path(surface, m, 0, 0, r)) {
          if (m.stroked) {
            surface.lineWidth = Math.max(r * 0.02,
              Math.max(r * 2 * 0.05, (m.weight || 0.06) * r * 2) * st.weight);
            surface.lineCap = 'round';
            surface.lineJoin = 'round';
            surface.stroke();
          } else surface.fill('nonzero');
        }
        surface.restore();
      }
    }
  }

  const controls = [
    { group: 'pattern', key: 'way', label: 'Reading', type: 'chips', options: WAYS },
    { group: 'pattern', key: 'cells', label: 'States across', type: 'range', min: 2, max: 16, step: 1 },
    { group: 'field', key: 'across', label: 'Varies across', type: 'chips', options: AXES },
    { group: 'field', key: 'down', label: 'Varies down', type: 'chips', options: AXES },
    { group: 'field', key: 'range', label: 'Travel', type: 'range', min: 0, max: 1, step: 0.01,
      needs: { of: 'motif', key: 'moves', least: 1,
        without: 'No shape could be read out of this drawing, so there are no states to read. '
          + 'The grid is still here.' } },
    { group: 'mark', key: 'scale', label: 'Mark size', type: 'range', min: 0.2, max: 1.3, step: 0.02 },
    { group: 'mark', key: 'colours', label: 'Inks', type: 'range', min: 1, max: 6, step: 1 },
    { group: 'mark', key: 'ink', label: 'First ink', type: 'range', min: 0, max: 5, step: 1 },
    { group: 'ground', key: 'grid', label: 'Presentation grid', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'pattern', key: 'seed', label: 'Seed', type: 'seed' },
  ];

  return { key: 'dynamic', kind: 'pattern', vector: true, motif: true, ratio: 1,
    controls, paint, lattice, pointOf, traverse, read, WAYS, AXES };
}));
