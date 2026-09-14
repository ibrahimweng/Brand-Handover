/* The mark, tiled and then bent.

   PLAYGRND's Warp generates op-art geometry undistorted — a checker of squares,
   or bands of dashes at an angle — and then bends every polygon through a
   displacement field, subdividing each edge first so the distortion reads as a
   curve rather than as a shear. Duotone, with a chance of the two swapping.

   The lattice already draws the client's shape repeated on a grid. This is that
   grid, bent: the same motif, at the same measured size and spacing, with every
   point of every copy pushed through the same field. Nothing else in this
   engine does that, and it is the one tool here that answers "what if the
   pattern moved" without the answer being a different pattern.

   Every warp is built from whole-number frequencies, so the displacement is
   itself periodic on the tile and the tile still meets itself exactly. That
   rules out two of PLAYGRND's three — `taper` is a keystone and `bulge` is
   radial about the frame centre, and neither comes back round — so the three
   here are all sums of sines: a wave across, a swirl about the tile's own
   centres, and a ripple that runs on the diagonal. A seamless bent pattern is
   worth more than a bent pattern with a join in it.

   The motif's control points are bent along with its on-curve points. That is
   an approximation — the true image of a bezier under a nonlinear map is not a
   bezier — and it is the right one here: the error is second-order in the
   displacement, and at the amplitudes a designer actually reaches for it is
   under a thousandth of the tile. Subdividing every curve first would cost a
   generator that is already drawing a few hundred copies of a drawing. */
//
// UMD: `paint` runs in the studio, which has no require.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../rand'), require('../motif'), require('../tone'));
  } else root.PatternWarp = factory(root.PatternRand, root.PatternMotif, root.PatternTone);
}(typeof self !== 'undefined' ? self : this, function (RAND, MOTIF, TONE) {
  'use strict';

  const R3 = (v) => Math.round(v * 1000) / 1000;
  const TAU = Math.PI * 2;
  const KINDS = ['wave', 'swirl', 'ripple'];
  const SHAPES = ['mark', 'square', 'dot', 'bar'];

  /* Where a point goes.

     `f` is a whole number of periods across the tile — that is what keeps this
     seamless — and `amp` is a share of the tile's short side. */
  function bend(x, y, W, H, p) {
    if (!(p.warp > 0)) return [x, y];
    const f = Math.max(1, Math.round(p.frequency));
    const amp = p.warp * Math.min(W, H) * 0.12;
    const u = (x / W) * TAU * f, v = (y / H) * TAU * f;
    if (p.kind === 'swirl') {
      /* A curl field, not a rotation.

         The first version turned the plane about the tile's centre by an angle
         that was itself a periodic field, on the reasoning that a periodic
         angle gives a periodic turn. It does not. A rotation about a *point*
         moves (x, y) and (x + W, y) by different amounts however the angle is
         chosen, because they are different distances from the point — so the
         tile seamed, and the new seam test read it at 2.4 where 1 is the bar.

         This is the displacement that does swirl and does repeat: the
         perpendicular gradient of a periodic potential. Take ψ = sin u · cos v,
         move by (−∂ψ/∂y, ∂ψ/∂x), and the field turns everywhere without
         compressing anything — it is divergence-free, which is what makes a
         swirl look like a swirl rather than like a squeeze — and every term in
         it is a whole-number sine, which is what makes it come back round. */
      const a = p.warp * Math.min(W, H) * 0.16;
      return [x + Math.sin(u) * Math.sin(v) * a, y + Math.cos(u) * Math.cos(v) * a];
    }
    if (p.kind === 'ripple') {
      const d = Math.sin(u + v) + Math.sin(u - v) * 0.6;
      return [x + d * amp * 0.7, y + d * amp * 0.7];
    }
    return [x + Math.sin(v) * amp, y + Math.sin(u) * amp];
  }

  // The motif's own moves, bent. Every coordinate in every op goes through the
  // same field, control points included.
  function bentOps(ops, cx, cy, r, W, H, p, turn, mirror) {
    const c = Math.cos(turn), s = Math.sin(turn);
    // `r` is a half-width and the motif's own coordinates run about one unit
    // across, so the scale is `r * 2` — the same arithmetic `motif.path` does.
    // Using `r` drew every copy at half the size its cell had been measured
    // for, which looked like a spacing bug and was a scale one.
    const sz = r * 2;
    const place = (x, y) => {
      const mx = mirror ? -x : x;
      const px = cx + (mx * c - y * s) * sz, py = cy + (mx * s + y * c) * sz;
      return bend(px, py, W, H, p);
    };
    const out = [];
    for (const o of ops) {
      const n = [o[0]];
      for (let i = 1; i < o.length; i += 2) {
        const q = place(o[i], o[i + 1]);
        n.push(q[0], q[1]);
      }
      out.push(n);
    }
    return out;
  }

  // Draw a list of already-placed moves. The motif module draws in its own
  // coordinates; these are in the tile's, so they go straight onto the path.
  function stroke(s, ops) {
    s.beginPath();
    for (const o of ops) {
      if (o[0] === 'M') s.moveTo(R3(o[1]), R3(o[2]));
      else if (o[0] === 'L') s.lineTo(R3(o[1]), R3(o[2]));
      else if (o[0] === 'C') s.bezierCurveTo(R3(o[1]), R3(o[2]), R3(o[3]), R3(o[4]), R3(o[5]), R3(o[6]));
      else if (o[0] === 'Q') s.quadraticCurveTo(R3(o[1]), R3(o[2]), R3(o[3]), R3(o[4]));
      else if (o[0] === 'Z') s.closePath();
    }
  }

  // A fallback cell, for a shape that could not be read. Built from the same
  // four points so it bends the same way.
  function plain(kind, cx, cy, r) {
    if (kind === 'dot') {
      const k = 0.5523;
      return [['M', 0, -1], ['C', k, -1, 1, -k, 1, 0], ['C', 1, k, k, 1, 0, 1],
        ['C', -k, 1, -1, k, -1, 0], ['C', -1, -k, -k, -1, 0, -1], ['Z']];
    }
    if (kind === 'bar') return [['M', -1, -0.34], ['L', 1, -0.34], ['L', 1, 0.34], ['L', -1, 0.34], ['Z']];
    return [['M', -1, -1], ['L', 1, -1], ['L', 1, 1], ['L', -1, 1], ['Z']];
  }

  function paint(surface, W, H, p, pal) {
    const ground = pal.ground;
    const ink = pal.inks[0].hex;
    // Duotone, and the two may swap. A pattern engine that only ever put the
    // dark one on the light one gives every identity the same tile in
    // different colours.
    const back = p.invert ? ink : ground;
    const front = p.invert ? ground : ink;
    pal.paper(surface, W, H, back);

    const m = p.motif;
    const usable = p.shape === 'mark' && m && m.ops && m.ops.length;
    const ops = usable ? m.ops : plain(p.shape === 'mark' ? 'square' : p.shape);
    const ratio = usable && m.ratio > 0 ? m.ratio : 1;
    /* An even number of cells, both ways.

       Three of this generator's controls key on parity — the checker on
       `i + j`, the column drop on `i`, the row mirror on `j` — and a parity
       that flips at the wrap is a seam. At an odd column count the cell at
       `i = 0` and the cell at `i = cols` are the same cell of the pattern and
       opposite cells of the checker, so every vertical join shows a doubled
       column. The pixel check read it at 1.7% of the tile; `beyond` read 0.79
       and called it clean, which is what pixel identity is for. */
    const cols = Math.max(2, Math.round(p.cells / 2) * 2);
    const rows = Math.max(2, Math.round((cols * (H / W)) / 2) * 2);
    const stepX = W / cols, stepY = H / rows;
    const boxW = stepX * p.size * Math.min(1, ratio);
    const boxH = stepY * p.size * Math.min(1, 1 / ratio);
    const r = Math.max(boxW, boxH) / 2;
    const seed = (p.seed || 1) * 41;

    surface.fillStyle = front;
    surface.strokeStyle = front;
    // One row and one column past each edge: a bent copy reaches further than
    // an unbent one, and a copy that straddles the join has to be drawn on
    // both sides of it.
    for (let j = -2; j <= rows + 1; j++) {
      for (let i = -2; i <= cols + 1; i++) {
        // The checker. At full `checker` only one square in two is drawn, which
        // is the op-art field; at zero every cell is.
        if (p.checker > 0 && ((i + j) % 2 + 2) % 2 === 1
          && RAND.hash01(i, j, seed + 1) < p.checker) continue;
        const cx = (i + 0.5) * stepX;
        const cy = (j + 0.5) * stepY + (((i % 2) + 2) % 2 ? stepY * p.drop : 0);
        const turn = (p.turn * Math.PI) / 180;
        const bentOne = bentOps(ops, cx, cy, r, W, H, p, turn,
          p.flip && ((j % 2) + 2) % 2 === 1);
        stroke(surface, bentOne);
        if (usable && m.stroked) {
          // The same floor `motif.draw` applies, and for the same reason: five
          // of the twenty-one stroked marks here draw at under seven per cent
          // of their own box, and below that a stroke is a hairline beside the
          // cell it sits in and the pattern shows the client nothing.
          const sz = r * 2;
          surface.lineWidth = Math.max(sz * 0.07, (m.weight || 0.06) * sz);
          surface.lineCap = 'round'; surface.lineJoin = 'round';
          surface.stroke();
        } else surface.fill('nonzero');
      }
    }
  }

  const controls = [
    { group: 'pattern', key: 'shape', label: 'Cell', type: 'chips', options: SHAPES,
      needs: { of: 'motif', key: 'moves', least: 1,
        without: 'No shape could be read out of this drawing, so the cells are plain.' } },
    { group: 'pattern', key: 'cells', primary: true, label: 'Cells across', type: 'range', min: 2, max: 24, step: 1 },
    { group: 'pattern', key: 'size', primary: true, label: 'Cell size', type: 'range', min: 0.2, max: 1.6, step: 0.02 },
    { group: 'pattern', key: 'checker', label: 'Checker', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'pattern', key: 'drop', label: 'Column drop', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'pattern', key: 'turn', label: 'Rotation', type: 'range', min: 0, max: 180, step: 1 },
    { group: 'pattern', key: 'flip', label: 'Mirror rows', type: 'chips', options: [0, 1],
      needs: { of: 'motif', key: 'mirrorable', least: 1,
        without: 'This shape is the wordmark. A word mirrored reads as a mistake.' } },
    { group: 'warp', key: 'kind', primary: true, label: 'Warp', type: 'chips', options: KINDS },
    { group: 'warp', key: 'warp', label: 'Amount', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'warp', key: 'frequency', label: 'Periods', type: 'range', min: 1, max: 6, step: 1 },
    { group: 'warp', key: 'invert', label: 'Invert', type: 'chips', options: [0, 1] },
    { group: 'warp', key: 'seed', label: 'Seed', type: 'seed' },
  ];

  return { key: 'warp', kind: 'pattern', vector: true, motif: true, needsMotif: false, ratio: 1,
    controls, paint, bend, KINDS, SHAPES };
}));
