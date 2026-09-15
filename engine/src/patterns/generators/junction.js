/* A lattice of bars that meet, and the meeting is the pattern.

   From a reference: a diagonal grid of thick rounded bars whose crossings are
   not crossings at all. Where four bars come together the corners are filleted
   into a soft pinch, so the junction reads as a cast piece rather than as two
   lines laid over each other — the ground between them becomes a rounded
   lozenge, and that lozenge is what the eye actually sees.

   That is worth saying plainly because it is the whole construction and it is
   the thing a naive version gets wrong. Drawing two sets of crossing strokes
   gives a plaid: hard corners, square wells, and a pattern about lines. Filling
   the *wells* instead — rounded rectangles of ground on a diagonal lattice,
   with the bar width left between them — gives the cast piece, because the
   fillet falls out of the well's own corner radius rather than being drawn.

   So the ground is painted, the bar colour is laid over the whole tile, and the
   wells are cut back out of it. One path, even-odd, no seams to line up.

   What the mark lends: the bar width comes from its stroke against its width,
   the fillet from how much of its turning happens on a curve, and the lattice
   angle from whether the drawing has a lean of its own. */
//
// UMD: `paint` runs in the studio, which has no require.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../tone'));
  } else root.PatternJunction = factory(root.PatternTone);
}(typeof self !== 'undefined' ? self : this, function (TONE) {
  'use strict';

  const R3 = (v) => Math.round(v * 1000) / 1000;
  const mod = (n, q) => ((n % q) + q) % q;
  const WEAVES = ['diagonal', 'square', 'brick', 'herring'];

  /* A rounded rectangle, as a subpath, optionally turned.

     Turned matters: the reference's bars run at forty-five degrees, and an
     offset square grid is not that — it is a brick bond, which is a different
     pattern and the one the first version drew. A rotated well leaves diagonal
     bars between its neighbours, and the pinch at each junction falls out of
     four rotated corners meeting.

     The corner arcs stay circular under rotation, so this rotates the corner
     *centres* and offsets the arc angles rather than transforming the surface —
     which keeps the whole lattice one path, and one path is what lets the wells
     be cut out of a solid sheet in a single even-odd fill. */
  function well(s, cx, cy, w, h, r0, rot) {
    const r = Math.max(0, Math.min(r0, Math.min(w, h) / 2));
    const a = rot || 0;
    const ca = Math.cos(a), sa = Math.sin(a);
    const at = (x, y) => [R3(cx + x * ca - y * sa), R3(cy + x * sa + y * ca)];
    const hw = w / 2, hh = h / 2;
    // corner centres, anticlockwise from the top-left, in the well's own frame
    const C = [[-hw + r, -hh + r], [hw - r, -hh + r], [hw - r, hh - r], [-hw + r, hh - r]];
    const start = [Math.PI, -Math.PI / 2, 0, Math.PI / 2];
    // Start where the first arc starts, not at the corner it rounds off: a
    // moveTo anywhere else draws a chord across the corner, which shows as a
    // nick in the top-left of every well.
    const P0 = at(-hw, -hh + r);
    s.moveTo(P0[0], P0[1]);
    for (let k = 0; k < 4; k++) {
      const c = at(C[k][0], C[k][1]);
      if (r) s.arc(c[0], c[1], r, start[k] + a, start[k] + a + Math.PI / 2);
      else { const q = at(C[k][0], C[k][1]); s.lineTo(q[0], q[1]); }
    }
    s.closePath();
  }

  function paint(surface, W, H, p, pal) {
    const weave = WEAVES.indexOf(p.weave) > -1 ? p.weave : WEAVES[0];
    const ground = pal.ground;
    const bar = pal.ink(Math.max(0, Math.min(pal.inks.length - 1, Math.round(p.ink))));
    pal.paper(surface, W, H, ground);

    const cols = Math.max(1, Math.round(p.cells));
    const step = W / cols;
    const rows = Math.max(1, Math.round(H / step));
    const stepY = H / rows;
    // The bar, as a share of the cell. Above about a third the wells close and
    // the pattern is a solid sheet with dimples in it.
    const barW = Math.max(0.5, Math.min(step, step * p.bar));
    const barH = Math.max(0.5, Math.min(stepY, stepY * p.bar));
    /* Capped short of a full round. A rounded square whose radius reaches half
       its side is a circle, and a lattice of circles is a dot screen — which is
       what the first version drew for every curvy identity. Six tenths leaves a
       flat run on each side, so the well stays a well and the junction between
       four of them still pinches. */
    const r = Math.max(0, (Math.min(step - barW, stepY - barH) / 2) * p.fillet * 0.6);

    /* The whole tile in the bar colour, then the wells cut out of it.

       Drawn this way round the fillet is the well's corner and the junction's
       pinch is what is left between four of them — which is the reference's
       actual geometry. Stroking two sets of crossing bars gives a plaid with
       square wells, which is a different pattern. */
    surface.fillStyle = bar;
    surface.beginPath();
    surface.rect(0, 0, W, H);
    /* The wells, cut back out. One extra ring of cells each way so a well that
       straddles an edge is cut on both sides of it. */
    const turn = weave === 'diagonal' ? Math.PI / 4 : weave === 'herring' ? Math.PI / 6 : 0;
    for (let j = -1; j <= rows; j++) {
      for (let i = -1; i <= cols; i++) {
        // `diagonal` turns every well a quarter and drops alternate rows by a
        // half, which together are what leave bars running at forty-five
        // degrees between them. `brick` keeps the drop and loses the turn, so
        // the two read as cast and as laid.
        const off = (weave === 'diagonal' || weave === 'brick') && mod(j, 2) ? step * 0.5 : 0;
        const cx = (i + 0.5) * step + off;
        const cy = (j + 0.5) * stepY;
        // A turned well needs to be smaller to leave the same bar between its
        // neighbours, because its diagonal is what faces them.
        const shrink = turn ? Math.SQRT1_2 : 1;
        const w = (step - barW) * shrink, hh = (stepY - barH) * shrink;
        if (w <= 0 || hh <= 0) continue;
        well(surface, cx, cy, w, hh, weave === 'brick' ? r * 0.25 : r, turn);
      }
    }
    surface.fill('evenodd');

    /* A second lattice, finer and in a second ink, for the reference's own
       double reading: the bars carry a thin line down their middle where the
       identity has an ink to spend on it. */
    if (p.seam > 0 && pal.inks.length > 1) {
      surface.strokeStyle = TONE.mix(bar, ground, Math.min(0.9, p.seam));
      surface.lineWidth = Math.max(0.4, barW * 0.16);
      surface.beginPath();
      for (let i = -1; i <= cols; i++) {
        const x = i * step + step * 0.5;
        surface.moveTo(R3(x), 0); surface.lineTo(R3(x), H);
      }
      surface.stroke();
    }
  }

  const controls = [
    { group: 'pattern', key: 'weave', primary: true, label: 'Armature', type: 'chips', options: WEAVES },
    { group: 'pattern', key: 'cells', primary: true, label: 'Cells across', type: 'range', min: 2, max: 16, step: 1 },
    { group: 'pattern', key: 'bar', primary: true, label: 'Bar width', type: 'range', min: 0.06, max: 0.6, step: 0.01 },
    { group: 'pattern', key: 'fillet', label: 'Fillet', type: 'range', min: 0, max: 1, step: 0.02 },
    { group: 'pattern', key: 'seam', label: 'Seam line', type: 'range', min: 0, max: 1, step: 0.02 },
    { group: 'pattern', key: 'ink', label: 'Ink', type: 'range', min: 0, max: 5, step: 1 },
    { group: 'pattern', key: 'seed', label: 'Seed', type: 'seed' },
  ];

  return { key: 'junction', kind: 'pattern', vector: true, motif: false, ratio: 1,
    controls, paint, well, WEAVES };
}));
