/* The mark, as the thing the stripes bend around.

   PLAYGRND's Whorl deals a handful of weighted centres over the frame, sums a
   soft-cored cone from each into a scalar field, warps the sample point before
   it evaluates, multiplies the field by a band count and paints the bands. High
   Pull draws the rings into a tight whorl; Push gives some centres a negative
   weight so positive and negative families collide and pinch the field between
   them. It is a contour map of a landscape nobody has to draw.

   Where the centres come from is the whole question, and here the answer is the
   drawing. The mark's bitmap is walked, the cells it inks are collected, and
   the centres are chosen from those — spread apart by best-candidate sampling
   so they land across the shape rather than crowding one corner of it. So the
   field pinches where the drawing has ink and opens where it does not, and the
   contours read as the mark's own shape at one remove: not an outline of it,
   the pressure it puts on the page.

   **Everything here is periodic by construction.** A cone measured with the
   ordinary distance is not: the field at the left edge and the field at the
   right edge disagree, and the tile has a join down it. The distance used is
   the chord distance on a torus — `sin²(π dx) + sin²(π dy)` — which is smooth
   everywhere, is a true distance near a centre, and comes back round at the
   edge exactly. The warp is sums of whole-number sines for the same reason.

   Painted as a cell grid rather than per pixel, and merged into one path per
   band, because this has to come out as an SVG a designer can recolour. The
   grid is fine enough that a band edge lands within a fraction of its own width
   of where the field puts it. */
//
// UMD: `paint` runs in the studio, which has no require.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../rand'), require('../motif'), require('../grid'));
  } else root.PatternWhorl = factory(root.PatternRand, root.PatternMotif, root.PatternGrid);
}(typeof self !== 'undefined' ? self : this, function (RAND, MOTIF, GRID) {
  'use strict';

  const TAU = Math.PI * 2;
  const KINDS = ['smooth', 'ripple', 'turbulent'];

  /* Where the centres go.

     From the drawing where there is one: its inked cells, thinned by
     best-candidate sampling so the chosen few are spread across the shape. From
     a hash where there is not, which keeps the generator usable on an identity
     whose mark is finer than the grid that reads it.

     Best-candidate is twelve tries per centre, keeping the furthest from
     everything already placed — measured with the same wrapped distance the
     field uses, so a centre near the left edge counts as close to one near the
     right and the tile does not end up with all its pinch points down one side. */
  function centres(p) {
    const want = Math.max(1, Math.round(p.centres));
    const seed = (p.seed || 1) * 67;
    const pool = [];
    const m = p.motif;
    if (p.mark > 0 && m && m.mask) {
      const n = m.mask.n || 48;
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          if (MOTIF.inside(m, (i + 0.5) / n, (j + 0.5) / n, p.spread)) {
            pool.push([(i + 0.5) / n, (j + 0.5) / n]);
          }
        }
      }
    }
    const out = [];
    for (let k = 0; k < want; k++) {
      let best = null, bestD = -1;
      for (let t = 0; t < 12; t++) {
        const h1 = RAND.hash01(k, t, seed + 1), h2 = RAND.hash01(k, t, seed + 2);
        const c = pool.length ? pool[Math.floor(h1 * pool.length) % pool.length] : [h1, h2];
        let d = 4;
        for (const o of out) d = Math.min(d, wrapped(c[0] - o[0], c[1] - o[1]));
        if (d > bestD) { bestD = d; best = c; }
      }
      // Weights: the first centre always pulls, and the rest pull or push,
      // because a field of all-positive cones is a set of bowls and it is the
      // collision of the two families that pinches the contours.
      const w = 0.45 + RAND.hash01(k, 99, seed + 3) * 0.9;
      const push = k > 0 && RAND.hash01(k, 98, seed + 4) < p.push;
      out.push([best[0], best[1], push ? -w : w]);
    }
    return out;
  }

  // Chord distance on a torus, squared. Zero at a centre, smooth everywhere,
  // and exactly periodic — which the ordinary distance is not, and which is the
  // difference between a tile and a tile with a seam down it.
  const wrapped = (dx, dy) => {
    const a = Math.sin(Math.PI * dx), b = Math.sin(Math.PI * dy);
    return a * a + b * b;
  };

  // The sample point, moved before it is read. Whole-number frequencies only.
  function displace(u, v, p) {
    if (!(p.warp > 0)) return [u, v];
    const f = Math.max(1, Math.round(1 + p.detail * 5));
    const a = p.warp * 0.42;
    if (p.kind === 'ripple') {
      return [u + Math.sin(TAU * v * f) * a, v + Math.sin(TAU * u * f) * a];
    }
    if (p.kind === 'turbulent') {
      const s1 = Math.sin(TAU * v * f) + Math.sin(TAU * v * f * 3) * 0.45;
      const s2 = Math.sin(TAU * u * f) + Math.sin(TAU * u * f * 3) * 0.45;
      return [u + s1 * a * 0.7, v + s2 * a * 0.7];
    }
    const s1 = Math.sin(TAU * (v * f + u * 0.5));
    const s2 = Math.sin(TAU * (u * f + v * 0.5));
    return [u + s1 * a, v + s2 * a];
  }

  function paint(surface, W, H, p, pal) {
    const cs = centres(p);
    const soft = 0.36 * (1 - p.pull);
    const count = Math.max(2, Math.round(p.count));
    const weight = 0.06 + p.weight * 0.88;
    // Ink 0 is the ground between bands; the rest cycle band by band.
    const band = pal.inks.length > 1 ? pal.inks.slice(1) : pal.inks;
    const ground = pal.inks[0].hex;
    const colours = [ground].concat(band.map((k) => k.hex));

    pal.paper(surface, W, H, pal.ground);

    const n = Math.max(48, Math.round(count * 14));
    const rows = Math.max(48, Math.round(n * (H / W)));
    const at = (i, j) => {
      const q = displace((i + 0.5) / n, (j + 0.5) / rows, p);
      let f = 0;
      for (const c of cs) f += c[2] * Math.sqrt(wrapped(q[0] - c[0], q[1] - c[1]) + soft * soft);
      const u = f * count;
      const k = Math.floor(u);
      return (u - k) < weight ? 1 + (((k % band.length) + band.length) % band.length) : 0;
    };
    GRID.cells(surface, W, H, n, rows, at, colours);
  }

  const controls = [
    { group: 'field', key: 'centres', label: 'Centres', type: 'range', min: 1, max: 14, step: 1 },
    { group: 'field', key: 'pull', primary: true, label: 'Pull', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'field', key: 'push', label: 'Push', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'stripes', key: 'count', primary: true, label: 'Bands', type: 'range', min: 2, max: 60, step: 1 },
    { group: 'stripes', key: 'weight', label: 'Band weight', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'warp', key: 'kind', primary: true, label: 'Warp', type: 'chips', options: KINDS },
    { group: 'warp', key: 'warp', label: 'Amount', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'warp', key: 'detail', label: 'Detail', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'mark', key: 'mark', label: 'Centres from the mark', type: 'range', min: 0, max: 1, step: 0.01,
      needs: { of: 'motif', key: 'masked', least: 1,
        without: 'No bitmap could be taken of this shape — it is finer than the grid that '
          + 'reads it. The centres are dealt at random instead.' } },
    { group: 'mark', key: 'spread', label: 'Mark size', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'mark', key: 'seed', label: 'Seed', type: 'seed' },
  ];

  return { key: 'whorl', kind: 'pattern', vector: true, motif: true, ratio: 1,
    controls, paint, centres, wrapped, KINDS };
}));
