/* Nineteen fields, and seven things a field can do to a pattern.

   These are the tools PLAYGRND files under *Backgrounds*, and the first version
   here took that name literally: each one painted under the pattern, over it,
   or around it — grounds and grain and fibres. That was wrong, and the way it
   was wrong is worth writing down, because it is the same mistake this engine
   keeps making in new clothes.

   A client asking for a noise effect on a wave pattern does not want noise
   drawn on top of the waves. They want the noise to **drive** the waves: dark
   makes the wave bigger, light makes it smaller — or the reverse — or the noise
   becomes a displacement the picture flows along, or a blur that is soft in one
   place and sharp in another, or a gradient the colour steps through. The
   effect is a thing you do *to* the pattern. Painting beside it is not an
   effect, it is a second pattern.

   So a layer is a **field** and nothing else: a scalar over the tile, with its
   own shape and its own controls. What it *does* is the seven channels in
   `modulate.js`, and every one of them works on every generator the day it is
   written, because the driving happens in a surface wrapper rather than in
   thirty-two separate generators.

   ------------------------------------------------------------------ the stack

   Any number on at once. Each one wraps the surface with its own field and its
   own channels, in catalogue order, so a coarse field can displace the picture
   and a fine one recolour it and the two do not have to know about each other.

   -------------------------------------------------------- off by default, and
                                                             clipped to the tile

   Every channel starts at zero. A pattern that arrives already distorted is a
   decision made on somebody's behalf about their own logo — the same argument
   that keeps the lattice's own effects off.

   And the tile is clipped to its own bounds before any of it. That is
   load-bearing rather than tidy: a tile is used clipped — a `<pattern>` fill, a
   texture in a layout, a bitmap copied across — so anything painted outside is
   thrown away, and a generator that leans on a neighbour's overhang has a join.
   Measured: without the clip, seventeen of sixty generator-and-identity pairs
   drew a tile that differed from the same tile with its eight neighbours around
   it. With it, all sixty are identical. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./rand'), require('./noise'), require('./motif'),
      require('./modulate'));
  } else {
    root.PatternLayers = factory(root.PatternRand, root.PatternNoise, root.PatternMotif,
      root.PatternModulate);
  }
}(typeof self !== 'undefined' ? self : this, function (RAND, NOISE, MOTIF, MOD) {
  'use strict';

  const TAU = Math.PI * 2;
  const frac = (v) => v - Math.floor(v);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* Everything here comes back round at the tile edge.

     The noise is periodic value noise on an integer lattice; distances are the
     chord distance on a torus, `sin²(π dx) + sin²(π dy)`, which is smooth
     everywhere and behaves like a distance near a point; ramps run on
     whole-step lattice directions; every sine has a whole-number frequency. A
     field that did not would put a seam through every sheet made from the tile
     — and an effect that breaks the tiling of the pattern under it is worse
     than no effect. */
  const torus = (dx, dy) => {
    const a = Math.sin(Math.PI * dx), b = Math.sin(Math.PI * dy);
    return a * a + b * b;
  };
  // The directions a band or a ramp may run: whole steps across and down, so
  // moving one tile adds a whole number to the coordinate and the phase is
  // unchanged. Anything else is a seam.
  const RUN = [[0, 1], [1, 0], [1, 1], [1, -1], [2, 1], [1, 2]];
  const runOf = (i) => RUN[clamp(Math.round(i || 0), 0, RUN.length - 1)];

  /* Where a field's centres go.

     From the drawing where the layer asks for it — its inked cells, thinned by
     best-candidate sampling so the chosen few spread across the shape rather
     than crowding one corner — and from a hash otherwise. Shared, so two layers
     pointed at the same drawing agree about where it is. */
  function centres(p, motif, seed) {
    const want = Math.max(1, Math.round(p.centres || 3));
    const pool = [];
    if (p.fromMark > 0 && motif && motif.mask) {
      const n = motif.mask.n || 48;
      for (let j = 0; j < n; j += 2) {
        for (let i = 0; i < n; i += 2) {
          if (MOTIF.inside(motif, (i + 0.5) / n, (j + 0.5) / n, p.markSize || 0)) {
            pool.push([(i + 0.5) / n, (j + 0.5) / n]);
          }
        }
      }
    }
    const out = [];
    for (let k = 0; k < want; k++) {
      let best = null, bestD = -1;
      for (let t = 0; t < 10; t++) {
        const h1 = RAND.hash01(k, t, seed + 11), h2 = RAND.hash01(k, t, seed + 12);
        const c = pool.length ? pool[Math.floor(h1 * pool.length) % pool.length] : [h1, h2];
        let d = 4;
        for (const o of out) d = Math.min(d, torus(c[0] - o[0], c[1] - o[1]));
        if (d > bestD) { bestD = d; best = c; }
      }
      out.push([best[0], best[1], 0.45 + RAND.hash01(k, 99, seed + 13) * 0.9]);
    }
    return out;
  }

  // Periodic fBm, warped, which is the base most of these are built on.
  function fbm(u, v, p, seed, oct) {
    const P = Math.max(1, Math.round(p.scale || 3));
    const q = NOISE.warp2(u * P, v * P, P, P, p.warp || 0, 2, seed + 1);
    return NOISE.evenly(NOISE.fbm2(q[0], q[1], P, P, oct || 4, seed + 2), oct || 4);
  }

  /* The drawing, mixed in.

     Every field can be told to take its shape from the mark instead of from its
     own arithmetic, which is what turns any of these into a depth map of the
     client's own logo. At one the field *is* the mark; between, the mark is one
     term in it. */
  function withMark(t, u, v, p, motif) {
    if (!(p.fromMark > 0) || !motif) return t;
    const reps = Math.max(1, Math.round(p.repeat || 1));
    const on = MOTIF.inside(motif, frac(u * reps), frac(v * reps), p.markSize || 0);
    return t * (1 - p.fromMark) + on * p.fromMark;
  }

  // ------------------------------------------------------------- the nineteen

  const L = {};
  // Shape controls every field that has centres or a mark term shares.
  const MARKED = (n) => ([
    ['fromMark', 'From the mark', 'range', 0, 1, 0.01, 0],
    ['markSize', 'Mark size', 'range', 0, 1, 0.01, 0.3],
    ['repeat', 'Marks across', 'range', 1, 4, 1, 1],
  ]);
  const NOISY = [
    ['scale', 'Scale', 'range', 1, 12, 1, 3],
    ['warp', 'Warp', 'range', 0, 1.6, 0.01, 0.4],
  ];

  // 02 — layered contours. The plain depth map, and the one most people mean.
  L.terrain = { label: 'Terrain', suggests: 'size',
    controls: NOISY.concat([['bands', 'Terraces', 'range', 1, 14, 1, 6]], MARKED()),
    field: (p, m, seed) => (u, v) => {
      const t = fbm(u, v, p, seed, 4);
      const n = Math.max(1, Math.round(p.bands));
      // Terraced, so the channel it drives steps rather than slides — which is
      // what makes a depth map read as contours rather than as a smudge.
      return withMark(n > 1 ? Math.floor(t * n) / (n - 1 || 1) : t, u, v, p, m);
    } };

  // 21 — faceted planes. The same field, quantised to a triangle lattice.
  L.delta = { label: 'Delta', suggests: 'turn',
    controls: NOISY.concat([['cells', 'Facets across', 'range', 2, 40, 1, 10]], MARKED()),
    field: (p, m, seed) => (u, v) => {
      const n = Math.max(2, Math.round(p.cells));
      const i = Math.floor(u * n), j = Math.floor(v * n);
      const fu = u * n - i, fv = v * n - j;
      // Two triangles to a square, each flat: the field is constant inside a
      // facet, so whatever it drives lands in facets too.
      const half = fu + fv > 1 ? 0.5 : 0;
      return withMark(fbm((i + 0.33 + half) / n, (j + 0.33 + half) / n, p, seed, 3), u, v, p, m);
    } };

  // 34 — cell walls. High at a wall, low at a cell's middle.
  L.culture = { label: 'Culture', suggests: 'displace',
    controls: [['centres', 'Cells', 'range', 2, 60, 1, 16],
      ['scale', 'Wall width', 'range', 1, 12, 1, 4]].concat(MARKED()),
    field: (p, m, seed) => { const cs = centres(p, m, seed); return (u, v) => {
      let best = 4, next = 4;
      for (const c of cs) { const d = torus(u - c[0], v - c[1]); if (d < best) { next = best; best = d; } else if (d < next) next = d; }
      return withMark(clamp(1 - (Math.sqrt(next) - Math.sqrt(best)) * Math.max(1, p.scale) * 2, 0, 1), u, v, p, m);
    }; } };

  // 30 — concentric rings.
  L.sonar = { label: 'Sonar', suggests: 'size',
    controls: [['centres', 'Centres', 'range', 1, 10, 1, 3],
      ['scale', 'Rings', 'range', 1, 40, 1, 10]].concat(MARKED()),
    field: (p, m, seed) => { const cs = centres(p, m, seed); return (u, v) => {
      let d = 4;
      for (const c of cs) d = Math.min(d, torus(u - c[0], v - c[1]));
      return withMark(frac(Math.sqrt(d) * Math.max(1, p.scale)), u, v, p, m);
    }; } };

  // 18 — a ramp across the tile, on a whole-step direction.
  L.rise = { label: 'Rise', suggests: 'size',
    controls: [['angle', 'Direction', 'chips', 0, 5, 1, 0],
      ['bands', 'Steps', 'range', 1, 40, 1, 1],
      ['curve', 'Curve', 'range', -1, 1, 0.01, 0]].concat(MARKED()),
    field: (p, m, seed) => { const d = runOf(p.angle); return (u, v) => {
      const t = NOISE.skew(frac(u * d[0] + v * d[1]), p.curve || 0);
      const n = Math.max(1, Math.round(p.bands));
      return withMark(n > 1 ? Math.floor(t * n) / (n - 1 || 1) : t, u, v, p, m);
    }; } };

  // 22 — soft bands. A raised cosine rather than a hard edge.
  L.mist = { label: 'Mist', suggests: 'blur',
    controls: [['angle', 'Direction', 'chips', 0, 5, 1, 0],
      ['bands', 'Bands', 'range', 1, 40, 1, 6],
      ['softness', 'Softness', 'range', 0, 1, 0.01, 0.8]].concat(MARKED()),
    field: (p, m, seed) => { const d = runOf(p.angle); return (u, v) => {
      const n = Math.max(1, Math.round(p.bands));
      const x = frac((u * d[0] + v * d[1]) * n);
      const soft = (1 - Math.cos(x * TAU)) / 2;
      return withMark(soft * p.softness + (x < 0.5 ? 0 : 1) * (1 - p.softness), u, v, p, m);
    }; } };

  // 29 — recursive rectangles. A blocky field, flat inside each pane.
  L.pane = { label: 'Pane', suggests: 'tone',
    controls: [['cuts', 'Cuts', 'range', 1, 8, 1, 4]].concat(MARKED()),
    field: (p, m, seed) => (u, v) => {
      // Walked rather than dealt: the same split decisions every time, so the
      // field is a function of the point and nothing has to be stored.
      let x0 = 0, y0 = 0, x1 = 1, y1 = 1;
      const cuts = Math.max(1, Math.round(p.cuts));
      for (let d = 0; d < cuts; d++) {
        const h = RAND.hash01(Math.round(x0 * 997), Math.round(y0 * 997), seed + d);
        const at = 0.3 + h * 0.4;
        if ((x1 - x0) >= (y1 - y0)) { const mx = x0 + (x1 - x0) * at; if (u < mx) x1 = mx; else x0 = mx; }
        else { const my = y0 + (y1 - y0) * at; if (v < my) y1 = my; else y0 = my; }
      }
      return withMark(RAND.hash01(Math.round(x0 * 9973), Math.round(y0 * 9973), seed + 40), u, v, p, m);
    } };

  // 06 — soft wells. Smooth, round, and the gentlest field here.
  L.aura = { label: 'Aura', suggests: 'size',
    controls: [['centres', 'Centres', 'range', 1, 12, 1, 3],
      // `reach`, not `size`: a layer's own controls and the seven channels share
      // one object, so a shape control named after a channel silently sets it —
      // and `aura` came out switched on the moment it was looked at.
      ['reach', 'Reach', 'range', 0.05, 1.2, 0.01, 0.5]].concat(MARKED()),
    field: (p, m, seed) => { const cs = centres(p, m, seed); return (u, v) => {
      let f = 0;
      for (const c of cs) f = Math.max(f, 1 - clamp(Math.sqrt(torus(u - c[0], v - c[1])) / Math.max(0.01, p.reach), 0, 1));
      return withMark(f * f, u, v, p, m);
    }; } };

  // 31 — a hard well. The same family as aura with the falloff squared the
  // other way, so it is nearly all edge — which is what a blur wants.
  L.bloom = { label: 'Bloom', suggests: 'blur',
    controls: [['centres', 'Centres', 'range', 1, 12, 1, 4],
      ['reach', 'Reach', 'range', 0.05, 1.2, 0.01, 0.35]].concat(MARKED()),
    field: (p, m, seed) => { const cs = centres(p, m, seed); return (u, v) => {
      let f = 0;
      for (const c of cs) f = Math.max(f, 1 - clamp(Math.sqrt(torus(u - c[0], v - c[1])) / Math.max(0.01, p.reach), 0, 1));
      return withMark(Math.sqrt(f), u, v, p, m);
    }; } };

  // 38 — slices. A stepped field with a hashed jump per slice: the glitch.
  L.splice = { label: 'Splice', suggests: 'displace',
    controls: [['bands', 'Slices', 'range', 2, 24, 1, 7],
      ['down', 'Slice downward', 'chips', 0, 1, 1, 0],
      ['jump', 'Jaggedness', 'range', 0, 1, 0.01, 0.8]].concat(MARKED()),
    field: (p, m, seed) => (u, v) => {
      const n = Math.max(2, Math.round(p.bands));
      const k = Math.floor((p.down ? u : v) * n);
      const h = RAND.hash01(k, 0, seed + 21);
      return withMark(h * p.jump + (k / n) * (1 - p.jump), u, v, p, m);
    } };

  // 19 — hard bands. Flat inside each, which is what a colorama steps through.
  L.prism = { label: 'Prism', suggests: 'tone',
    controls: [['bands', 'Bands', 'range', 2, 12, 1, 4],
      ['angle', 'Direction', 'chips', 0, 5, 1, 0]].concat(MARKED()),
    field: (p, m, seed) => { const d = runOf(p.angle); return (u, v) => {
      const n = Math.max(2, Math.round(p.bands));
      return withMark(Math.floor(frac(u * d[0] + v * d[1]) * n) / (n - 1), u, v, p, m);
    }; } };

  // 33 — edges. The slope of a noise field rather than its height, so it is
  // high exactly where the field turns: the emboss, and the scorch line.
  L.carve = { label: 'Carve', suggests: 'displace',
    controls: NOISY.concat([['sharp', 'Sharpness', 'range', 0.2, 6, 0.1, 2]], MARKED()),
    field: (p, m, seed) => (u, v) => {
      const e = 0.004;
      const gx = fbm(u + e, v, p, seed, 3) - fbm(u - e, v, p, seed, 3);
      const gy = fbm(u, v + e, p, seed, 3) - fbm(u, v - e, p, seed, 3);
      return withMark(clamp(Math.hypot(gx, gy) * 12 * p.sharp, 0, 1), u, v, p, m);
    } };

  // 32 — the same idea, ridged: high along a whole ridge rather than at a step.
  L.sear = { label: 'Sear', suggests: 'weight',
    controls: NOISY.concat([['sharp', 'Sharpness', 'range', 0.2, 6, 0.1, 2]], MARKED()),
    field: (p, m, seed) => (u, v) => {
      const t = fbm(u, v, p, seed, 4);
      const r = 1 - Math.abs(2 * t - 1);
      return withMark(clamp(Math.pow(r, Math.max(0.2, p.sharp)), 0, 1), u, v, p, m);
    } };

  /* The five directional and grain fields.

     These were painters — fibres, threads, flecks, scan lines — and as fields
     they are what those pictures were made of: how fine the grain is, which way
     it runs, and how broken. A comb, in other words, and what a comb does to a
     pattern is exactly one of the seven channels. */
  const GRAINY = (scale, oct) => ([
    ['scale', 'Fineness', 'range', 1, 40, 1, scale],
    ['warp', 'Warp', 'range', 0, 1.6, 0.01, 0.2],
    ['along', 'Direction', 'chips', 0, 5, 1, 0],
    ['stretch', 'Stretch', 'range', 1, 20, 1, 6],
  ]);
  const combed = (oct) => (p, m, seed) => { const d = runOf(p.along); return (u, v) => {
    // Stretched along one whole-step direction, which is what turns a blob
    // field into a combed one without breaking the period.
    const s = Math.max(1, Math.round(p.stretch));
    const a = (u * d[0] + v * d[1]) / s + (u * -d[1] + v * d[0]);
    return withMark(fbm(a, (u * -d[1] + v * d[0]) * 1.0, p, seed, oct), u, v, p, m);
  }; };

  // 03 — a fine comb.
  L.filament = { label: 'Filament', suggests: 'displace',
    controls: GRAINY(12).concat(MARKED()), field: combed(2) };
  // 36 — a coarse one.
  L.strand = { label: 'Strand', suggests: 'displace',
    controls: GRAINY(4).concat(MARKED()), field: combed(3) };
  // 35 — short and angular.
  L.husk = { label: 'Husk', suggests: 'turn',
    controls: GRAINY(20).concat(MARKED()), field: combed(1) };

  // 41 — branching. A ridged field crossed with its own stretch, which reads
  // as fronds rather than as stripes.
  L.frond = { label: 'Frond', suggests: 'turn',
    controls: GRAINY(8).concat([['sharp', 'Sharpness', 'range', 0.2, 6, 0.1, 2]], MARKED()),
    field: (p, m, seed) => { const d = runOf(p.along); return (u, v) => {
      const s = Math.max(1, Math.round(p.stretch));
      const a = (u * d[0] + v * d[1]) / s + (u * -d[1] + v * d[0]);
      const t = fbm(a, (u * -d[1] + v * d[0]), p, seed, 3);
      const r = 1 - Math.abs(2 * t - 1);
      return withMark(clamp(Math.pow(r, Math.max(0.2, p.sharp)), 0, 1), u, v, p, m);
    }; } };

  // 37 — speckle. The finest field here, and the one that reads as tooth.
  L.chaff = { label: 'Chaff', suggests: 'thin',
    controls: [['scale', 'Fineness', 'range', 4, 120, 2, 40],
      ['bias', 'Bias', 'range', -1, 1, 0.01, 0]].concat(MARKED()),
    field: (p, m, seed) => (u, v) => {
      const P = Math.max(1, Math.round(p.scale));
      const t = NOISE.noise2(u * P, v * P, P, P, seed + 31);
      return withMark(NOISE.skew(t, p.bias || 0), u, v, p, m);
    } };

  // 43 — scan lines, broken along their own run.
  L.hiss = { label: 'Hiss', suggests: 'displace',
    controls: [['lines', 'Lines', 'range', 4, 200, 2, 60],
      ['down', 'Run down', 'chips', 0, 1, 1, 0],
      ['broken', 'Broken', 'range', 0, 1, 0.01, 0.6]].concat(MARKED()),
    field: (p, m, seed) => (u, v) => {
      const n = Math.max(2, Math.round(p.lines));
      const line = Math.floor((p.down ? u : v) * n);
      const along = p.down ? v : u;
      const seg = Math.floor(along * n * 0.4);
      const on = RAND.hash01(line, seg, seed + 35) > p.broken ? 1 : 0;
      return withMark(on * RAND.hash01(line, 0, seed + 36), u, v, p, m);
    } };

  /* The catalogue, in the order they stack.

     Coarse fields first, fine ones last, so a layer that moves the whole
     picture runs before one that only roughens its edges. A client can turn on
     any combination; what they cannot do is reorder them, because a fine comb
     applied before a coarse displacement is the same picture with more steps in
     it. */
  const ORDER = ['terrain', 'delta', 'culture', 'sonar', 'rise', 'mist', 'pane', 'aura',
    'bloom', 'splice', 'prism', 'carve', 'sear',
    'filament', 'strand', 'husk', 'frond', 'chaff', 'hiss'];
  const NAMES = ORDER.filter((k) => L[k]);

  // The seven channels come first in the rail, because they are what the layer
  // *does*; its own shape controls come after, because they are what it is.
  function controlsOf(key) {
    const l = L[key];
    if (!l) return [];
    const rows = MOD.CHANNELS.map((c) => [c[0], c[1], 'range', c[2], c[3], c[4], c[5]])
      .concat(l.controls);
    return rows.map((c) => ({
      group: `fx:${key}`, key: c[0], label: c[1], type: c[2],
      min: c[3], max: c[4], step: c[5],
      options: c[2] === 'chips' ? (c[0] === 'angle' || c[0] === 'along' ? [0, 1, 2, 3, 4, 5] : [0, 1]) : undefined,
    }));
  }

  function defaultsOf(key) {
    const out = {};
    for (const c of controlsOf(key)) out[c.key] = c.__d;
    const l = L[key];
    for (const c of MOD.CHANNELS) out[c[0]] = c[5];
    for (const c of (l || {}).controls || []) out[c[0]] = c[6];
    return out;
  }

  // What a layer is set to when somebody switches it on. Its own suggestion,
  // at something you can see: a toggle that turns a thing on and leaves the
  // page identical is a toggle that looks broken.
  function wakeOf(key) {
    const out = defaultsOf(key);
    const ch = (L[key] || {}).suggests || 'size';
    out[ch] = ch === 'blur' || ch === 'thin' ? 0.5 : 0.55;
    return out;
  }

  const all = () => { const out = {}; for (const k of NAMES) out[k] = defaultsOf(k); return out; };
  const live = (p) => MOD.anyOn(p);
  const active = (params) => {
    const fx = (params || {}).effects || {};
    return NAMES.filter((k) => fx[k] && live(fx[k]));
  };

  /* Painting.

     One surface wrapper per active layer, then the generator, which never
     learns that any of it happened. The tile is clipped to its own bounds
     first — see the head of this file for why that is load-bearing.

     `drawBase(surface, palette)` is the generator. It is handed the wrapped
     surface and the palette it would have had. */
  function paint(surface, W, H, params, pal, drawBase) {
    // The identity's own gradients, told to the surface that will write them.
    // Here rather than at each of the five places that make a surface, so a
    // seam sheet, a poster, the studio and the front door cannot disagree with
    // the tile the package wrote.
    if (pal && pal.gradients && typeof surface.useGradients === 'function') {
      surface.useGradients(pal.gradients);
    }
    surface.save();
    surface.beginPath();
    surface.rect(0, 0, W, H);
    surface.clip();
    try {
      const fx = (params || {}).effects || {};
      const on = NAMES.filter((k) => fx[k] && live(fx[k]));
      const motif = (params || {}).motif || null;
      const seed = ((params || {}).seed || 1) * 149;
      let target = surface;
      // Wrapped outermost-last: the generator draws into the *first* wrapper in
      // catalogue order, which hands on to the next, and the last hands the
      // real surface absolute coordinates.
      for (let i = on.length - 1; i >= 0; i--) {
        const key = on[i];
        const p = Object.assign(defaultsOf(key), fx[key]);
        target = MOD.surface(target, W, H, L[key].field(p, motif, seed + i * 17), p, pal, seed + i);
      }
      drawBase(target, pal);
    } finally { surface.restore(); }
  }

  /* The field on its own, as a picture.

     A field is invisible until something is driven by it, which makes the
     controls hard to learn: a client turns Scale up and sees a pattern change
     in a way they cannot connect to anything. So a studio can ask for the field
     itself, drawn as a grey step wedge over the tile. It is a preview, not a
     layer — nothing in a package is ever drawn this way. */
  function show(surface, W, H, key, p, steps) {
    const l = L[key];
    if (!l) return;
    const f = l.field(Object.assign(defaultsOf(key), p), (p || {}).motif || null, (((p || {}).seed) || 1) * 149);
    const n = Math.max(2, Math.round(steps || 24));
    const res = 180;
    const rows = Math.round(res * (H / W));
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < res; i++) {
        const t = clamp(f((i + 0.5) / res, (j + 0.5) / rows), 0, 1);
        const g = Math.round((Math.floor(t * n) / (n - 1)) * 255);
        surface.fillStyle = `#${g.toString(16).padStart(2, '0').repeat(3)}`;
        surface.fillRect((i * W) / res, (j * H) / rows, W / res + 0.5, H / rows + 0.5);
      }
    }
  }

  return { LAYERS: L, NAMES, ORDER, CHANNELS: MOD.CHANNELS,
    controlsOf, defaultsOf, wakeOf, live, all, paint, active, show, centres, torus };
}));
