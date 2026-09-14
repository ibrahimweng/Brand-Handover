/* The mark, drawn by hand and scattered like a botanical.

   PLAYGRND's Sprig places motifs by best-candidate sampling, builds each one
   from noisy closed rings, and strokes every path by *building an explicit
   outline polygon* — offsetting left and right by a half-width modulated with
   circular noise, tapering at the ends of an open path. That last part is what
   makes the line read as a pen with pressure in it rather than as a uniform
   stroke, and it is the reason the tool looks drawn.

   This engine already has that machinery for a different reason. `thicken.js`
   was written to give a stroked logo a silhouette — two thirds of the drawings
   here are centrelines with no interior, and nothing could mask with them — and
   what it does is offset a centreline into the region the ink covers. It is the
   same operation. So the mark arrives already outlined, as `fillOps`, and this
   scatters it among the leaves.

   A botanical repeat made of a client's own mark is a strange object and it is
   the right one: it is the pattern a studio would draw by hand if you asked
   them for "something in the spirit of the logo, loose", and it is the furthest
   this engine goes from the logo while still being made of it.

   Seamless the way every scattered pattern has to be: the whole field is drawn
   nine times at the tile's own offsets, so anything crossing an edge reappears
   on the opposite one. The distance used to spread the motifs is the wrapped
   one, or the sampling would crowd them away from the edges and the sheet would
   have a grid in it nobody drew. */
//
// UMD: `paint` runs in the studio, which has no require.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../rand'), require('../noise'), require('../motif'));
  } else root.PatternSprig = factory(root.PatternRand, root.PatternNoise, root.PatternMotif);
}(typeof self !== 'undefined' ? self : this, function (RAND, NOISE, MOTIF) {
  'use strict';

  const R3 = (v) => Math.round(v * 1000) / 1000;
  const TAU = Math.PI * 2;
  const FAMILIES = {
    garden: ['bloom', 'leaf', 'leaf', 'petal', 'daisy', 'dot', 'stem', 'mark', 'leaf', 'mark'],
    blooms: ['bloom', 'bloom', 'petal', 'daisy', 'dot', 'mark'],
    leaves: ['leaf', 'leaf', 'leaf', 'stem', 'petal', 'mark'],
    marks: ['mark', 'mark', 'mark', 'dot', 'leaf'],
  };
  const NAMES = Object.keys(FAMILIES);

  // A closed ring with a wobble in it. The noise is sampled around a circle, so
  // the ring meets itself: a ring built from noise on the angle alone has a
  // step in it where the angle wraps, and every motif comes out with a nick.
  function ring(n, rx, ry, pointy, wobble, seed) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const w = NOISE.noise2(Math.cos(a) * 2 + 8, Math.sin(a) * 2 + 8, 64, 64, seed);
      let k = 1 + (w - 0.5) * 0.5 * wobble;
      if (pointy) k *= Math.pow(Math.abs(Math.sin(a)), 0.6) * 0.85 + 0.15;
      pts.push([Math.cos(a) * rx * k, Math.sin(a) * ry * k]);
    }
    return pts;
  }

  /* A polyline, given a width, as a closed outline polygon.

     The same idea `thicken.js` uses on a logo, in the small: walk the line,
     offset each point along the normal by a half-width that the noise moves,
     and come back down the other side. An open path tapers at both ends, which
     is what a pen does when it is lifted.

     Kept here rather than reaching for `thicken` because that module parses and
     joins a whole drawing's worth of runs and this needs eight points offset —
     and because `thicken` is Node's alone, and this draws in the studio too. */
  function inked(pts, half, rough, closed, seed) {
    const n = pts.length;
    if (n < 2) return [];
    const left = [], right = [];
    for (let i = 0; i < n; i++) {
      const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n];
      const px = (closed || (i > 0 && i < n - 1)) ? c[0] - a[0] : (i === 0 ? c[0] - b[0] : b[0] - a[0]);
      const py = (closed || (i > 0 && i < n - 1)) ? c[1] - a[1] : (i === 0 ? c[1] - b[1] : b[1] - a[1]);
      const L = Math.hypot(px, py) || 1;
      const nx = -py / L, ny = px / L;
      const w = NOISE.noise2(Math.cos((i / n) * TAU) * 3 + 4, Math.sin((i / n) * TAU) * 3 + 4, 64, 64, seed);
      let h = half * (1 + (w - 0.5) * 1.24 * rough);
      // A pen lifts. Without the taper an open stroke ends in a flat bar, which
      // is the one thing that reads as machinery rather than as a hand.
      if (!closed) h *= Math.sin((i / (n - 1)) * Math.PI) * 0.85 + 0.15;
      // And a pen cannot be wider than the shape it is drawing round.
      //
      // A pointed ring closes to almost nothing at its two tips. Offset both
      // sides of that by a fixed half-width and the two sides cross, the
      // outline folds through itself, and a leaf comes out as a figure of
      // eight — a whole sheet of them, which is what the first version drew.
      // Two fifths of the distance from the centre is where the offsets still
      // clear each other at the tip.
      if (closed) h = Math.min(h, Math.hypot(b[0], b[1]) * 0.4);
      left.push([b[0] + nx * h, b[1] + ny * h]);
      right.push([b[0] - nx * h, b[1] - ny * h]);
    }
    /* A closed line comes back as *two* rings, an open one as a single loop.

       This is the same distinction `thicken.js` makes and for the same reason.
       Going up one side of a closed ring and back down the other gives one
       polygon that jumps across the stroke at the seam: filled, it is a lumpy
       blob with a notch in it, and a sheet of them reads as a chain rather than
       as leaves. Two rings wound against each other leave the hole a ring is
       supposed to have. */
    if (closed) return [left, right.reverse()];
    return [left.concat(right.reverse())];
  }

  /* The mark's own moves, appended to the path that is already open.

     `motif.path` would be the obvious call and it is the wrong one: it begins a
     path. Every motif here goes into one path per pass so the whole field is
     one fill, and a `beginPath` in the middle of that throws away everything
     placed before it. The symptom was a tile with two motifs on it where the
     count said forty-eight — the two that happened to come after the last mark
     — which reads as a placement bug and is a path-state one. */
  function addOps(s, ops, sz) {
    for (const o of ops) {
      if (o[0] === 'M') s.moveTo(R3(o[1] * sz), R3(o[2] * sz));
      else if (o[0] === 'L') s.lineTo(R3(o[1] * sz), R3(o[2] * sz));
      else if (o[0] === 'C') {
        s.bezierCurveTo(R3(o[1] * sz), R3(o[2] * sz), R3(o[3] * sz), R3(o[4] * sz),
          R3(o[5] * sz), R3(o[6] * sz));
      } else if (o[0] === 'Q') s.quadraticCurveTo(R3(o[1] * sz), R3(o[2] * sz), R3(o[3] * sz), R3(o[4] * sz));
      else if (o[0] === 'Z') s.closePath();
    }
  }

  function poly(s, rings) {
    for (const pts of (rings && rings[0] && rings[0][0] != null && !Array.isArray(rings[0][0])
      ? [rings] : rings)) {
      if (!pts || !pts.length) continue;
      s.moveTo(R3(pts[0][0]), R3(pts[0][1]));
      for (let i = 1; i < pts.length; i++) s.lineTo(R3(pts[i][0]), R3(pts[i][1]));
      s.closePath();
    }
  }

  // One motif, added to the open path at (x, y).
  function motifAt(s, kind, x, y, r, p, hx, hy) {
    // Hashed off where the motif was *placed*, not off where it is being drawn:
    // the drawing happens under a rotation, at the origin, so every motif would
    // otherwise be dealt the same numbers and the sheet would be one shape.
    const rnd = (k) => RAND.hash01(Math.round((hx || 0) * 97), Math.round((hy || 0) * 97),
      (p.seed || 1) * 71 + k);
    const wob = p.wobble, rough = p.roughness;
    const half = r * (0.05 + p.weight * 0.14);
    const seed = Math.floor(rnd(1) * 100000);
    // Accepts either one ring of points or a list of them, and shifts whichever
    // it is into place.
    const put = (v) => {
      const rings = Array.isArray(v[0][0]) ? v : [v];
      poly(s, rings.map((pts) => pts.map((q) => [x + q[0], y + q[1]])));
    };
    if (kind === 'dot') { put(ring(14, r * 0.22, r * 0.22, false, wob * 0.4, seed)); return; }
    if (kind === 'stem') {
      const pts = [];
      let px = 0, py = r;
      for (let i = 0; i < 15; i++) {
        px += (rnd(10 + i) - 0.5) * r * 0.28; py -= (r * 2) / 15;
        pts.push([px, py]);
      }
      put(inked(pts, half, rough, false, seed)); return;
    }
    if (kind === 'petal') { put(inked(ring(24, r * 0.3, r, true, wob, seed), half, rough, true, seed)); return; }
    if (kind === 'leaf') {
      put(inked(ring(26, r * 0.45, r, true, wob, seed), half, rough, true, seed));
      const rib = [];
      for (let i = 0; i < 9; i++) rib.push([(rnd(30 + i) - 0.5) * r * 0.12, -r + (i / 8) * r * 2]);
      put(inked(rib, half * 0.6, rough, false, seed + 1));
      return;
    }
    if (kind === 'daisy') {
      const petals = 5 + Math.floor(rnd(2) * 4);
      for (let i = 0; i < petals; i++) {
        const a = (i / petals) * TAU;
        const c = Math.cos(a), sn = Math.sin(a);
        const pts = ring(18, r * 0.22, r * 0.62, true, wob, seed + i)
          .map((q) => [q[0] * c - (q[1] - r * 0.5) * sn, q[0] * sn + (q[1] - r * 0.5) * c]);
        put(inked(pts, half * 0.7, rough, true, seed + i));
      }
      put(ring(14, r * 0.2, r * 0.2, false, wob * 0.3, seed + 40));
      return;
    }
    // bloom
    put(inked(ring(28, r * 0.85, r, false, wob, seed), half, rough, true, seed));
    if (rnd(3) < p.detail) put(ring(14, r * 0.26, r * 0.26, false, wob * 0.3, seed + 2));
  }

  // Where the motifs go. Best candidate, with the wrapped distance.
  function places(p) {
    const n = Math.max(1, Math.round(p.count));
    const seed = (p.seed || 1) * 79;
    const out = [];
    const d2 = (a, b) => {
      const dx = Math.abs(a[0] - b[0]), dy = Math.abs(a[1] - b[1]);
      const x = Math.min(dx, 1 - dx), y = Math.min(dy, 1 - dy);
      return x * x + y * y;
    };
    for (let k = 0; k < n; k++) {
      let best = null, bestD = -1;
      for (let t = 0; t < 12; t++) {
        const c = [RAND.hash01(k, t, seed + 1), RAND.hash01(k, t, seed + 2)];
        let d = 4;
        for (const o of out) d = Math.min(d, d2(c, o));
        if (d > bestD) { bestD = d; best = c; }
      }
      out.push(best);
    }
    return out;
  }

  function paint(surface, W, H, p, pal) {
    const paper = pal.ground;
    const line = pal.inks[0].hex;
    pal.paper(surface, W, H, paper);

    const family = FAMILIES[p.family] ? p.family : NAMES[0];
    const pool = FAMILIES[family];
    const pts = places(p);
    const seed = (p.seed || 1) * 79;
    const m = p.motif;
    // The mark, already outlined. `fillOps` is the region the ink covers; the
    // centreline would fill as the blob the strokes travel around.
    const markOps = m && ((m.fillOps && m.fillOps.length ? m.fillOps : (!m.stroked && m.ops))) || null;
    /* How big a motif is, measured against how much room it has.

       This used to be a share of the tile — and a share of the tile means
       nothing on its own, because forty motifs at a twentieth of the tile is a
       closed field and eight of them is an empty one. The first version put
       ninety motifs at half a per cent of the tile each on the finest marks
       here and the sheet came out blank.

       So it is the spacing the count implies: at `size` a half the motifs are
       about as wide as the gap between them, which is what a scattered
       botanical looks like. */
    const spacing = Math.sqrt((W * H) / Math.max(1, Math.round(p.count)));
    const base = spacing * (0.4 + p.size * 1.4);

    surface.fillStyle = line;
    surface.strokeStyle = line;
    // Nine passes, one per neighbouring tile, so a motif over an edge comes
    // back on the other side. Drawn rather than clipped: a clip would cut the
    // outline and the pen stroke would end square.
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        surface.beginPath();
        let any = false;
        for (let k = 0; k < pts.length; k++) {
          const u = RAND.hash01(k, 5, seed + 3);
          let kind = pool[Math.floor(RAND.hash01(k, 6, seed + 4) * pool.length) % pool.length];
          if (kind === 'mark' && !(markOps && p.mark > 0 && RAND.hash01(k, 7, seed + 5) < p.mark)) {
            // Not always a leaf. Falling back to one kind turns the whole sheet
            // into that kind wherever the mark is turned down, which is a
            // botanical of one plant.
            const rest = pool.filter((q) => q !== 'mark');
            kind = rest[Math.floor(RAND.hash01(k, 11, seed + 7) * rest.length) % rest.length] || 'leaf';
          }
          const r = base * Math.max(0.18, 1 + (u * u * 2.2 - 0.45) * p.variation) * 0.5;
          const x = (pts[k][0] + ox) * W, y = (pts[k][1] + oy) * H;
          // Nothing more than a motif's reach outside the tile can land on it.
          if (x < -r * 2 || x > W + r * 2 || y < -r * 2 || y > H + r * 2) continue;
          any = true;
          // Everything turns, not only the mark. A field of upright leaves is
          // a wallpaper sample book; a field of leaves at every angle is a
          // drawing.
          const turn = (RAND.hash01(k, 8, seed + 6) - 0.5) * p.turn * TAU;
          surface.save();
          surface.translate(R3(x), R3(y));
          if (turn) surface.rotate(turn);
          if (kind === 'mark') addOps(surface, markOps, r * 2);
          // Hashed off *which* motif this is, not off where it landed. The
          // first version keyed the per-motif numbers on the drawn coordinates,
          // which include the tile offset — so a motif crossing an edge was
          // dealt one shape on this side of the join and a different shape on
          // the other. 1.4% of the tile, and invisible to the z-score.
          else motifAt(surface, kind, 0, 0, r, p, k, k * 7 + 3);
          surface.restore();
        }
        if (any) surface.fill('nonzero');
      }
    }
  }

  const controls = [
    { group: 'pattern', key: 'count', label: 'Count', type: 'range', min: 2, max: 120, step: 1 },
    { group: 'pattern', key: 'size', label: 'Size', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'pattern', key: 'variation', label: 'Variation', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'pattern', key: 'family', label: 'Motifs', type: 'chips', options: NAMES },
    { group: 'mark', key: 'mark', label: 'How many are the mark', type: 'range', min: 0, max: 1, step: 0.01,
      needs: { of: 'motif', key: 'silhouette', least: 1,
        without: 'This mark is drawn in strokes too fine to outline, and a scattered motif has '
          + 'to be a filled shape. The sheet is drawn from the botanical motifs alone.' } },
    { group: 'mark', key: 'turn', label: 'Mark rotation', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'hand', key: 'weight', label: 'Weight', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'hand', key: 'roughness', label: 'Roughness', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'hand', key: 'wobble', label: 'Wobble', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'hand', key: 'detail', label: 'Detail', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'hand', key: 'seed', label: 'Seed', type: 'seed' },
  ];

  return { key: 'sprig', kind: 'pattern', vector: true, motif: true, ratio: 1,
    controls, paint, ring, inked, places, addOps, FAMILIES };
}));
