/* The mark, counterchanged through a field of bars — a poster, not a tile.

   PLAYGRND's Optic paints an even field of stripes, then clips a figure out of
   the middle and re-runs the stripes inside it under a different move: a phase
   flip, or the same bars turned ninety or forty-five degrees. Nothing is drawn
   on the figure's edge, so it reads as a pure figure-ground inversion rather
   than as a shape sitting on top of a background.

   Its figure is a diamond, a circle, a peak or a square. Here it is the
   client's own mark. That is the whole reason this one is first: a
   counterchange needs a silhouette and a logo *is* a silhouette, so the tool
   and the brief meet with nothing bent to make them fit. A client looking at
   the sheet sees their mark, in their colours, made of nothing but stripes.

   This is a poster and it says so. It does not tile, it has its own proportion,
   and the seam check does not apply to it — a poster has no join because it has
   no neighbour. Everything else about it is a generator like any other: derived
   defaults off the artwork, controls in both studios, parameters in brand.json,
   and the same `paint` drawn by the canvas and the SVG writer alike. */
//
// UMD: `paint` runs in the studio, which has no require.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../rand'), require('../motif'));
  } else root.PatternOptic = factory(root.PatternRand, root.PatternMotif);
}(typeof self !== 'undefined' ? self : this, function (RAND, MOTIF) {
  'use strict';

  const R3 = (v) => Math.round(v * 1000) / 1000;
  const FIGURES = ['mark', 'diamond', 'circle', 'peak', 'square'];

  // The bars, at one of four moves.
  //
  // Snapped to whole units so an edge never lands mid-pixel: the whole look is
  // hard vertical edges, and a bar that anti-aliases at one size and not at
  // another is a poster that changes when it is printed.
  function bars(s, W, H, p, ink, move, phase) {
    const P = Math.max(2, Math.min(W, H) / p.stripes);
    const w = Math.max(1, Math.round(P * p.weight));
    const turn = move === 1 ? 90 : move === 2 ? 45 : move === 3 ? -45 : 0;
    const shift = move === 0 && phase ? P / 2 : 0;
    s.save();
    if (turn) {
      s.translate(W / 2, H / 2);
      s.rotate((turn * Math.PI) / 180);
      s.translate(-W / 2, -H / 2);
    }
    s.fillStyle = ink;
    // Far enough past every edge that a turned field still covers the corners:
    // a rotated run that stops at the frame leaves two blank triangles, which
    // is the one way this composition can go visibly wrong.
    const reach = Math.hypot(W, H);
    const from = Math.round((W / 2 - reach / 2 + shift) / P) * P;
    for (let x = from; x < W / 2 + reach / 2; x += P) {
      s.fillRect(R3(x), R3(H / 2 - reach / 2), w, R3(reach));
    }
    s.restore();
  }

  // The shape to cut the figure out of, and whether there is one.
  //
  // A clip is a path's *interior*, and a mark drawn in strokes has none — its
  // path is a centreline. Clipped to it, carrock's three concentric arcs come
  // out a solid disc and ancroft's open chevron comes out a sliver: both look
  // like the engine has lost the drawing. Twenty-one of the thirty-three marks
  // here are drawn that way.
  //
  // `thicken` offsets the centreline into the region the ink covers, and
  // `motif-read` carries the result as `fillOps`. So a stroked mark has a
  // silhouette after all, and this reaches for it. A drawing too detailed to
  // carry one says so, and the control above explains it rather than quietly
  // handing back the blob.
  const region = (m) => (m && m.fillOps && m.fillOps.length ? { ops: m.fillOps } : m);
  const usable = (m) => !!(m && ((m.fillOps && m.fillOps.length) || (!m.stroked && m.ops && m.ops.length)));

  // The silhouette the bars are re-run inside.
  function figure(s, W, H, p, r, motif) {
    const cx = W / 2, cy = H / 2;
    const kind = p.figure === 'mark' && !usable(motif) ? 'circle' : p.figure;
    if (kind === 'mark') return MOTIF.path(s, region(motif), cx, cy, r);
    s.beginPath();
    if (kind === 'circle') {
      s.arc(cx, cy, r, 0, Math.PI * 2);
    } else if (kind === 'diamond') {
      s.moveTo(cx, cy - r); s.lineTo(cx + r, cy); s.lineTo(cx, cy + r); s.lineTo(cx - r, cy);
    } else if (kind === 'peak') {
      s.moveTo(cx, cy - r); s.lineTo(cx + r, cy + r * 0.72); s.lineTo(cx - r, cy + r * 0.72);
    } else {
      s.moveTo(cx - r, cy - r); s.lineTo(cx + r, cy - r); s.lineTo(cx + r, cy + r); s.lineTo(cx - r, cy + r);
    }
    s.closePath();
    return true;
  }

  function paint(surface, W, H, p, pal) {
    const base = pal.ground;
    const ink = pal.inks[0].hex;
    pal.paper(surface, W, H, base);
    bars(surface, W, H, p, ink, 0, false);

    // Nested figures, largest first, each re-running the bars under its own
    // move — and never the same move twice running, or the inner figure is
    // invisible and the control that set it appears to do nothing.
    const RELATIVE = [1, 0.55, 0.22];
    const POOL = [0, 0, 1, 2, 3];
    const rnd = RAND.stream(p.seed || 1, 'optic');
    const half = (Math.min(W, H) / 2) * p.size;
    let last = -1;
    for (let i = 0; i < Math.min(3, p.levels); i++) {
      let move = POOL[Math.floor(rnd() * POOL.length) % POOL.length];
      if (move === last) move = POOL[(POOL.indexOf(move) + 2) % POOL.length];
      last = move;
      surface.save();
      if (!figure(surface, W, H, p, half * RELATIVE[i], p.motif)) { surface.restore(); continue; }
      surface.clip();
      surface.fillStyle = base;
      surface.fillRect(0, 0, W, H);
      bars(surface, W, H, p, ink, move, true);
      surface.restore();
    }
  }

  const controls = [
    { group: 'poster', key: 'figure', primary: true, label: 'Figure', type: 'chips', options: FIGURES,
      needs: { of: 'motif', key: 'silhouette', least: 1,
        without: 'This mark is drawn in strokes, and a stroke has no interior to '
          + 'counterchange. The figure is a shape taken from how the mark turns instead.' } },
    { group: 'poster', key: 'stripes', primary: true, label: 'Stripes', type: 'range', min: 6, max: 28, step: 1 },
    { group: 'poster', key: 'weight', label: 'Bar weight', type: 'range', min: 0.3, max: 0.7, step: 0.01 },
    { group: 'poster', key: 'size', primary: true, label: 'Figure size', type: 'range', min: 0.4, max: 1, step: 0.01 },
    { group: 'poster', key: 'levels', label: 'Nested figures', type: 'range', min: 1, max: 3, step: 1 },
    { group: 'poster', key: 'seed', label: 'Seed', type: 'seed' },
  ];

  return { key: 'optic', kind: 'poster', vector: true, motif: true, tiles: false, ratio: 1,
    figures: FIGURES, controls, paint, bars, figure, usable };
}));
