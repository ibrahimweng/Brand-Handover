/* thread — flowing line fields.

   After PLAYGRND's Filament. A direction field is two noise samples: one gives
   the heading, a second adds a rotation to it. Strands are dropped into that
   field in bundles and integrated forward — a few hundred small steps each,
   following whatever the field says at the point they have reached. Nothing
   about the picture is drawn; it is all consequence.

   This is the one generator whose seam is not solved by sampling a periodic
   field, and it is worth being clear about why. The field is periodic, so a
   strand leaving the right edge finds exactly the field it would have found on
   the left. But the *strand* is a line, and a line that runs off the tile is
   cut off, and the piece that was cut off does not appear anywhere. Half a
   thread ends at the edge and the join is a row of severed ends.

   **The path wraps.** A strand's position is taken modulo the tile at every
   step, so it leaves one side and continues from the other. One line of
   arithmetic, and it makes the strand a closed curve on a torus rather than a
   line in a box. Every point of every piece is then inside the tile, and the
   continuation of a piece that ran off the right edge is another piece that
   starts at the left — already drawn, already there.

   **And each piece overshoots its own ends.** That is the part that is easy to
   miss and it cost 2.9 times the tile's own worst band to find. A piece ends
   exactly where the strand crossed an edge, the ends are stroked with round
   caps, and a round cap centred a hair outside the clip still paints the half
   of itself that is inside — a bead of ink at the join that a continuous line
   would not have. Fifteen and a half per cent of all piece ends sit in the
   outer tenth of the tile, where an even scattering would put ten. So each
   piece is carried a stroke's width further along its own direction at both
   ends, which puts every cap fully outside the clip and changes nothing that
   is inside it.

   There was a third thing here and it did nothing: every piece was also drawn
   at the nine offsets of a three-by-three block, on the reasoning that a
   wrapped path needs to appear on both sides of the edge it crosses. It does —
   and it already does, as the other piece. Measured with the nine and with one,
   the join reads 2.91 and 2.90. Gone, rather than left in looking careful.

   And the field's own scale is not a free number, which took a sweep to find.
   The lattice a periodic field is built on has its nodes at whole fractions of
   the tile, so the tile's edge is always a lattice line — and when the field's
   largest feature happens to sit on that line, the tiled pattern shows a band
   down every join. Nothing is discontinuous; the tile repeats exactly, and the
   path length is conserved across every crossing. The feature is simply
   *there*, at the edge, in every copy.

   Measured over four styles and four identities, sixteen combinations at each
   scale, counting how often the join is the pattern's own most unusual band:

       cycles across the tile   1     2     3     4     5     6     7     8
       joins that stand out    3/16  4/16  0/16  1/16  8/16  5/16  0/16  3/16

   Three and seven are clean everywhere and five fails half the time. So the
   scale is not a slider here: it is the two values that measure clean, offered
   as what they look like. Offsetting the lattice was tried instead and reduced
   the count from eight to three of twenty-eight, which is better and is also
   a constant chosen because it scored well — this is the same finding without
   the fitting.

   test/run.js checks a strand's own wrapped points, and the seam measurement
   checks the drawing, because those are two different claims.
*/
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../rand'), require('../noise'));
  else root.PatternThread = factory(root.PatternRand, root.PatternNoise);
}(typeof self !== 'undefined' ? self : this, function (RAND, NOISE) {
  'use strict';

  const STYLES = ['flow', 'weft', 'curl', 'tangle'];
  const BOX = 1000;
  // The two field scales whose joins measure clean at every style and every
  // identity tried. See the note above for the sweep.
  const GRAINS = { open: 3, close: 7 };
  const mod = (n, p) => ((n % p) + p) % p;

  const STYLE = {
    flow: { turn: 0.9, curl: 0.25, bundles: 22, per: 9, spread: 0.05, lean: 0 },
    weft: { turn: 0.22, curl: 0.08, bundles: 34, per: 6, spread: 0.03, lean: 0 },
    curl: { turn: 1.9, curl: 0.75, bundles: 16, per: 12, spread: 0.07, lean: 0 },
    tangle: { turn: 1.4, curl: 0.5, bundles: 26, per: 10, spread: 0.09, lean: 0.5 },
  };

  function plan(p) {
    const st = STYLE[p.style] || STYLE.flow;
    // Whole cycles across the tile — a whole number is what makes the field
    // meet itself — and one of the two that measure clean.
    const period = GRAINS[p.grain] || GRAINS.open;
    return {
      style: p.style, seed: p.seed || 1, period,
      turn: st.turn, curl: st.curl * (p.curl == null ? 1 : p.curl / 0.45),
      lean: st.lean, octaves: 3,
      bundles: Math.max(1, Math.round(st.bundles * (p.density == null ? 1 : p.density))),
      per: Math.max(1, Math.round(st.per * (p.density == null ? 1 : p.density))),
      spread: st.spread * (p.spread == null ? 1 : p.spread / 0.05),
      steps: Math.max(20, Math.round(p.length == null ? 190 : p.length)),
      step: p.step == null ? 4.2 : p.step,
      weight: p.weight == null ? 5 : p.weight,
      hierarchy: p.hierarchy == null ? 0.55 : p.hierarchy,
    };
  }

  // Which way the field points here. Two samples: a heading, and a rotation
  // added to it. Both periodic, so the field meets itself at the tile edge.
  function angleAt(x, y, q) {
    const u = x / BOX * q.period, v = y / BOX * q.period;
    const base = NOISE.fbm2(u, v, q.period, q.period, q.octaves, q.seed);
    const twist = NOISE.fbm2(u + 4.7, v + 2.1, q.period, q.period, 2, q.seed + 57);
    return base * Math.PI * 2 * q.turn + (twist - 0.5) * Math.PI * 2 * q.curl;
  }

  // One strand, as a list of points already wrapped into the tile. The pieces
  // are split where the path leaves an edge, so each piece is a run that can be
  // drawn on its own.
  function strand(x0, y0, q, r, over) {
    const pieces = [];
    const reach = over || 0;
    let run = [];
    let x = x0, y = y0;
    const leanTo = r() * Math.PI * 2;
    for (let i = 0; i < q.steps; i++) {
      run.push([x, y]);
      let a = angleAt(x, y, q);
      if (q.lean) a += Math.sin(leanTo) * q.lean * 0.6;
      const ux = Math.cos(a), uy = Math.sin(a);
      const nx = x + ux * q.step;
      const ny = y + uy * q.step;
      const wx = mod(nx, BOX), wy = mod(ny, BOX);
      // A step that crossed an edge ends the run and starts another, because a
      // line drawn from one side to the other would cut straight across the
      // tile.
      //
      // But the crossing step itself still has to be drawn, twice — running
      // off one edge and arriving at the other. The first version simply
      // dropped it, leaving a one-step gap at every crossing, and since a
      // strand crosses only at an edge the gaps all landed on the join. It
      // measured 2.08 times its own worst ordinary band and looked, at a
      // glance, like a slightly sparse edge.
      //
      // So the run is closed with the point *past* the edge, where the clip
      // removes it, and the next run opens at that same point's twin on the
      // other side.
      if (Math.abs(wx - x) > BOX / 2 || Math.abs(wy - y) > BOX / 2) {
        // Carried a stroke's width past the edge, so the round cap that ends
        // this piece lands entirely outside the clip instead of leaving a bead
        // of ink at the join.
        run.push([nx + ux * reach, ny + uy * reach]);
        if (run.length > 1) pieces.push(run);
        run = [[wx - (nx - x) - ux * reach, wy - (ny - y) - uy * reach]];
      }
      x = wx; y = wy;
    }
    if (run.length > 1) pieces.push(run);
    return pieces;
  }

  // Where the bundles start. Rejection-sampled against a slow field so the
  // ropes gather into regions and leave the tile open, rather than covering it
  // evenly — which is the difference between a drawing and a hatch.
  function origins(q, r) {
    const out = [];
    for (let tries = 0; tries < q.bundles * 40 && out.length < q.bundles; tries++) {
      const x = r() * BOX, y = r() * BOX;
      const n = NOISE.fbm2(x / BOX * q.period, y / BOX * q.period, q.period, q.period, 2, q.seed + 5);
      if (r() < 0.25 + n * 0.9) out.push([x, y]);
    }
    while (out.length < q.bundles) out.push([r() * BOX, r() * BOX]);
    return out;
  }

  function paint(surface, W, H, p, palette) {
    const q = plan(p);
    const r = RAND.stream(q.seed, `thread:${q.style}`);
    surface.save();
    surface.beginPath(); surface.rect(0, 0, W, H); surface.clip();
    surface.fillStyle = palette.ground;
    surface.fillRect(0, 0, W, H);
    surface.scale(W / BOX, H / BOX);
    surface.lineCap = 'round';
    surface.lineJoin = 'round';
    for (const [ox, oy] of origins(q, r)) {
      for (let s = 0; s < q.per; s++) {
        const sx = mod(ox + (r() - 0.5) * q.spread * BOX * 2, BOX);
        const sy = mod(oy + (r() - 0.5) * q.spread * BOX * 2, BOX);
        // Most strands fine and a few heavy, which is what reads as drawn
        // rather than plotted.
        const w = q.weight * (0.35 + Math.pow(r(), 1 + q.hierarchy * 4) * 1.9);
        surface.strokeStyle = palette.ink(Math.floor(Math.pow(r(), 1.7) * palette.count));
        surface.lineWidth = w;
        // The overshoot is this strand's own width, because that is what has
        // to clear the clip.
        for (const piece of strand(sx, sy, q, r, w)) {
          surface.beginPath();
          surface.moveTo(piece[0][0], piece[0][1]);
          for (let i = 1; i < piece.length; i++) surface.lineTo(piece[i][0], piece[i][1]);
          surface.stroke();
        }
      }
    }
    surface.restore();
  }

  const controls = [
    { group: 'pattern', key: 'style', label: 'Flow', type: 'chips', options: STYLES },
    { group: 'pattern', key: 'grain', label: 'Field', type: 'chips', options: ['open', 'close'] },
    { group: 'pattern', key: 'curl', label: 'Curl', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'pattern', key: 'density', label: 'How many', type: 'range', min: 0.25, max: 2, step: 0.05 },
    { group: 'pattern', key: 'spread', label: 'Bundle spread', type: 'range', min: 0.005, max: 0.2, step: 0.005 },
    { group: 'line', key: 'length', label: 'Length', type: 'range', min: 40, max: 400, step: 10 },
    { group: 'line', key: 'step', label: 'Step', type: 'range', min: 1.5, max: 10, step: 0.2 },
    { group: 'line', key: 'weight', label: 'Weight', type: 'range', min: 1, max: 20, step: 0.5 },
    { group: 'line', key: 'hierarchy', label: 'Hierarchy', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'pattern', key: 'seed', label: 'Seed', type: 'seed' },
  ];

  return { key: 'thread', vector: true, styles: STYLES, controls, GRAINS,
    plan, angleAt, strand, origins, paint, BOX };
}));
