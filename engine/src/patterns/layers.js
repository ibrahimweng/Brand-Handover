/* Effects, layered.

   The nineteen tools PLAYGRND files under Backgrounds are here, and they are
   not generators. That was the decision: a background is a thing you put
   *behind* or *over* something else, and nineteen more entries in the pattern
   list would have been nineteen more tiles a client has to choose between
   rather than nineteen more things they can do to the one they chose.

   So each of them is a layer. Any number can be on at once, they stack in a
   fixed order, every parameter each of them has is a control, and the whole
   stack is recorded in brand.json beside the generator's own numbers so a
   rebuild returns the same tile. Turning three of them on over a lattice gives
   a tile that is still that lattice and could not have been got any other way.

   ------------------------------------------------------------------ the stack

   A layer sits at one of three places, and that is the only ordering there is:

     under   painted before the generator. Grounds — contours, bands, panes,
             cells, washes. The generator draws on top of them.

     wrap    re-invokes everything below it. This is the one that makes the
             hard effects possible: a glitch that slices what is under it, a
             blur that redraws it at falling opacity, a colorama that redraws it
             band by band with the palette turned. Nothing is filtered — the
             picture below is a function, so it is simply *called again*, which
             is the only way an effect can come out as an SVG rather than as a
             bitmap with a filter attached.

     over    painted on top. Grain, fibres, flecks, threads, scorch.

   ------------------------------------------------------------- the depth map

   A layer that measures something about the page exposes it as `field(u, v)`,
   and the stack passes the last one down to everything after it. So a contour
   layer under a fibre layer makes the fibres lie along the contours; a cell
   layer under a scorch layer burns the cell walls. That is what a depth map is
   for, and it is why these are a stack and not a set of checkboxes.

   --------------------------------------------------------------- off by default

   Every layer starts at zero. A pattern that arrives already blurred, glitched
   and scorched is a decision made on somebody's behalf about their own logo —
   the same argument that keeps the lattice's own effects off — and it is also
   what keeps the package the size it is: a `wrap` layer emits the picture below
   it once per band, so a glitch over a busy tile is a file several times the
   size. In the studio that is a preview; written into a package it is a
   megabyte, and a client should be the one who decides that. */
//
// UMD: the stack runs in the studio, which has no require.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./rand'), require('./noise'), require('./motif'),
      require('./tone'), require('./grid'));
  } else {
    root.PatternLayers = factory(root.PatternRand, root.PatternNoise, root.PatternMotif,
      root.PatternTone, root.PatternGrid);
  }
}(typeof self !== 'undefined' ? self : this, function (RAND, NOISE, MOTIF, TONE, GRID) {
  'use strict';

  const R3 = (v) => Math.round(v * 1000) / 1000;
  const TAU = Math.PI * 2;
  const frac = (v) => v - Math.floor(v);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* A scalar field over the tile, periodic in both directions.

     Eight of the nineteen layers want one and they want different ones, so it
     is a parameter rather than nineteen copies of the same noise call. Every
     kind here comes back round at the tile edge: the noise is periodic value
     noise, the rings are measured with the chord distance on a torus, and the
     ramps are whole-number sines. A field that did not would put a seam through
     every layer that read it. */
  function fieldOf(kind, p, motif, seed) {
    const P = Math.max(1, Math.round(p.scale || 3));
    const oct = Math.max(1, Math.min(6, Math.round(p.detail == null ? 4 : p.detail)));
    const reps = Math.max(1, Math.round(p.repeat || 1));
    const cs = centres(p, motif, seed);
    return function at(u, v) {
      const on = (p.fromMark > 0 && motif)
        ? MOTIF.inside(motif, frac(u * reps), frac(v * reps), p.markSize || 0) : 0;
      let t;
      if (kind === 'rings') {
        let d = 4;
        for (const c of cs) d = Math.min(d, torus(u - c[0], v - c[1]));
        t = frac(Math.sqrt(d) * P);
      } else if (kind === 'wells') {
        let f = 0;
        for (const c of cs) f += c[2] * Math.sqrt(torus(u - c[0], v - c[1]) + 0.04);
        t = frac(f * P + 0.5);
      } else if (kind === 'cells') {
        let best = 4, next = 4;
        for (const c of cs) {
          const d = torus(u - c[0], v - c[1]);
          if (d < best) { next = best; best = d; } else if (d < next) next = d;
        }
        t = clamp((Math.sqrt(next) - Math.sqrt(best)) * P * 2, 0, 1);
      } else if (kind === 'ramp') {
        // A ramp across the tile at a whole-step direction, never at a number
        // of degrees. `frac(u·cos θ + v·sin θ)` is periodic only when cos θ is
        // a whole number, so a ramp at 37° puts a seam down every sheet made
        // from the tile — the same reason `vee` runs its bars on lattice
        // directions rather than on an angle.
        const d = RUN[Math.max(0, Math.min(RUN.length - 1, Math.round(p.angle || 0)))];
        t = frac(u * d[0] + v * d[1]);
      } else {
        const q = NOISE.warp2(u * P, v * P, P, P, p.warp || 0, 2, seed + 1);
        t = NOISE.evenly(NOISE.fbm2(q[0], q[1], P, P, oct, seed + 2), oct);
      }
      const blend = p.fromMark || 0;
      return clamp(t * (1 - blend) + on * blend, 0, 1);
    };
  }

  /* The directions a band or a ramp may run.

     Whole steps across and down, so a band coordinate gains a whole number when
     the sample moves one tile and the phase is unchanged. Anything else is a
     seam. The labels are what the pair works out to on a square tile, which is
     the thing a designer is choosing. */
  const RUN = [[0, 1], [1, 0], [1, 1], [1, -1], [2, 1], [1, 2]];
  const RUN_NAMES = ['down', 'across', '45\u00B0', '-45\u00B0', '27\u00B0', '63\u00B0'];

  // Chord distance on a torus, squared. See whorl.js — the straight distance
  // does not come back round, and a layer measured with it has a join in it.
  const torus = (dx, dy) => {
    const a = Math.sin(Math.PI * dx), b = Math.sin(Math.PI * dy);
    return a * a + b * b;
  };

  /* Where a layer's centres go.

     From the drawing where there is one and the layer asks for it, spread apart
     by best candidate so they land across the shape rather than in one corner
     of it; from a hash otherwise. Every layer that has centres shares this, so
     two layers pointed at the same drawing agree about where it is. */
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

  /* A palette that says the sheet is already laid.

     `palette.paper` reads this, so a generator handed one draws everything
     except its own full-bleed ground. Nothing else about the palette changes,
     which is what lets a generator go on using the ground colour as an *ink* —
     a counterchange figure, a quilt medallion, a punched glyph. */
  const paperDown = (pal) => Object.assign(
    Object.create(Object.getPrototypeOf(pal)), pal, { painted: true });

  // A layer's own inks: a slice of the palette, so two layers on at once are not
  // both drawn in the identity's loudest colour.
  const inkOf = (pal, p, i) => pal.ink(Math.round(p.ink || 0) + i);

  /* ------------------------------------------------------------------ grounds

     Painted before the generator, so the pattern is drawn on top of them. Each
     of them measures something and each of them says what — a contour layer
     exposes its height, a cell layer exposes its distance to a wall — and the
     stack hands the last one down to everything after it. */

  const L = {};

  // 02. Terrain — layered contour landscapes.
  L.terrain = {
    label: 'Terrain', at: 'under', kind: 'noise',
    controls: [
      ['bands', 'Terraces', 'range', 2, 14, 1, 6],
      ['scale', 'Scale', 'range', 1, 12, 1, 3],
      ['warp', 'Warp', 'range', 0, 1.6, 0.01, 0.4],
      ['detail', 'Detail', 'range', 1, 6, 1, 4],
      ['ink', 'First ink', 'range', 0, 6, 1, 0],
      ['fromMark', 'From the mark', 'range', 0, 1, 0.01, 0],
      ['markSize', 'Mark size', 'range', 0, 1, 0.01, 0.3],
      ['repeat', 'Marks across', 'range', 1, 4, 1, 1],
    ],
    field: (p, m, seed) => fieldOf('noise', p, m, seed),
    paint(s, W, H, p, pal, ctx) {
      const at = ctx.field;
      const n = Math.max(2, Math.round(p.bands));
      const res = 220;
      const rows = Math.round(res * (H / W));
      const tones = [];
      for (let b = 0; b < n; b++) {
        // A landscape reads as a landscape because the bands are a *ramp*, not
        // a set of colours. Mixed toward the ground rather than taken from the
        // palette in order: five terraces in five brand colours is a map of
        // nothing.
        tones.push(TONE.mix(pal.ground, inkOf(pal, p, 0), 0.12 + (b / (n - 1 || 1)) * 0.88 * p.amount));
      }
      GRID.cells(s, W, H, res, rows,
        (i, j) => Math.min(n - 1, Math.floor(at((i + 0.5) / res, (j + 0.5) / rows) * n)), tones);
    },
  };

  // 21. Delta — triangulated planes.
  L.delta = {
    label: 'Delta', at: 'under', kind: 'noise',
    controls: [
      ['cells', 'Triangles across', 'range', 2, 40, 1, 10],
      ['scale', 'Scale', 'range', 1, 12, 1, 3],
      ['warp', 'Warp', 'range', 0, 1.6, 0.01, 0.3],
      ['spread', 'Tone spread', 'range', 0, 1, 0.01, 0.7],
      ['ink', 'First ink', 'range', 0, 6, 1, 0],
      ['fromMark', 'From the mark', 'range', 0, 1, 0.01, 0],
      ['markSize', 'Mark size', 'range', 0, 1, 0.01, 0.3],
      ['repeat', 'Marks across', 'range', 1, 4, 1, 1],
    ],
    field: (p, m, seed) => fieldOf('noise', p, m, seed),
    paint(s, W, H, p, pal, ctx) {
      const at = ctx.field;
      const n = Math.max(2, Math.round(p.cells));
      const rows = Math.max(2, Math.round(n * (H / W)));
      const cw = W / n, ch = H / rows;
      const ink = inkOf(pal, p, 0);
      // Each square is two triangles, and each triangle is flat-shaded by the
      // field at its own centroid. Flat shading is the point: it is what turns
      // a smooth field into facets.
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < n; i++) {
          for (let t = 0; t < 2; t++) {
            const pts = t === 0
              ? [[i, j], [i + 1, j], [i, j + 1]]
              : [[i + 1, j], [i + 1, j + 1], [i, j + 1]];
            const cu = (pts[0][0] + pts[1][0] + pts[2][0]) / 3 / n;
            const cv = (pts[0][1] + pts[1][1] + pts[2][1]) / 3 / rows;
            s.fillStyle = TONE.mix(pal.ground, ink, (0.1 + at(cu, cv) * 0.9) * p.spread * p.amount);
            s.beginPath();
            s.moveTo(R3(pts[0][0] * cw), R3(pts[0][1] * ch));
            s.lineTo(R3(pts[1][0] * cw), R3(pts[1][1] * ch));
            s.lineTo(R3(pts[2][0] * cw), R3(pts[2][1] * ch));
            s.closePath();
            s.fill();
          }
        }
      }
    },
  };

  // 30. Sonar — concentric rings.
  L.sonar = {
    label: 'Sonar', at: 'under', kind: 'rings',
    controls: [
      ['centres', 'Centres', 'range', 1, 10, 1, 3],
      ['scale', 'Rings', 'range', 1, 40, 1, 10],
      ['weight', 'Ring weight', 'range', 0.05, 0.95, 0.01, 0.5],
      ['ink', 'First ink', 'range', 0, 6, 1, 0],
      ['fromMark', 'Centres from the mark', 'range', 0, 1, 0.01, 0],
      ['markSize', 'Mark size', 'range', 0, 1, 0.01, 0.3],
      ['repeat', 'Marks across', 'range', 1, 4, 1, 1],
    ],
    field: (p, m, seed) => fieldOf('rings', p, m, seed),
    paint(s, W, H, p, pal, ctx) {
      const at = ctx.field;
      const res = 260;
      const rows = Math.round(res * (H / W));
      const on = TONE.mix(pal.ground, inkOf(pal, p, 0), p.amount);
      GRID.cells(s, W, H, res, rows,
        (i, j) => (at((i + 0.5) / res, (j + 0.5) / rows) < p.weight ? 0 : GRID.EMPTY), [on]);
    },
  };

  // 34. Culture — cell blobs.
  L.culture = {
    label: 'Culture', at: 'under', kind: 'cells',
    controls: [
      ['centres', 'Cells', 'range', 2, 60, 1, 16],
      ['scale', 'Wall width', 'range', 1, 12, 1, 4],
      ['ink', 'First ink', 'range', 0, 6, 1, 0],
      ['bands', 'Tones', 'range', 1, 6, 1, 3],
      ['fromMark', 'Seeded by the mark', 'range', 0, 1, 0.01, 0],
      ['markSize', 'Mark size', 'range', 0, 1, 0.01, 0.3],
      ['repeat', 'Marks across', 'range', 1, 4, 1, 1],
    ],
    field: (p, m, seed) => fieldOf('cells', p, m, seed),
    paint(s, W, H, p, pal, ctx) {
      const at = ctx.field;
      const res = 220;
      const rows = Math.round(res * (H / W));
      const n = Math.max(1, Math.round(p.bands));
      const tones = [];
      for (let b = 0; b < n; b++) {
        tones.push(TONE.mix(pal.ground, inkOf(pal, p, 0), (0.15 + (b / n) * 0.85) * p.amount));
      }
      GRID.cells(s, W, H, res, rows,
        (i, j) => Math.min(n - 1, Math.floor(at((i + 0.5) / res, (j + 0.5) / rows) * n)), tones);
    },
  };

  // 06. Aura — soft washes.
  //
  // The nearest thing to a blur that can be an SVG: concentric rings at falling
  // opacity, drawn from the outside in. It is a stepped gradient and it is not
  // pretending otherwise — `steps` is a control, and at sixteen the steps are
  // under a printer's dot at any size a tile is used.
  L.aura = {
    label: 'Aura', at: 'under', kind: 'wells',
    controls: [
      ['centres', 'Centres', 'range', 1, 12, 1, 3],
      ['size', 'Size', 'range', 0.05, 1.2, 0.01, 0.5],
      ['steps', 'Steps', 'range', 2, 24, 1, 12],
      ['ink', 'First ink', 'range', 0, 6, 1, 0],
      ['fromMark', 'Centres from the mark', 'range', 0, 1, 0.01, 0],
      ['markSize', 'Mark size', 'range', 0, 1, 0.01, 0.3],
      ['repeat', 'Marks across', 'range', 1, 4, 1, 1],
    ],
    paint(s, W, H, p, pal, ctx) {
      const cs = centres(p, ctx.motif, ctx.seed);
      const steps = Math.max(2, Math.round(p.steps));
      const ink = inkOf(pal, p, 0);
      const r = p.size * Math.min(W, H);
      for (let k = steps; k >= 1; k--) {
        const t = k / steps;
        s.fillStyle = TONE.mix(pal.ground, ink, (1 - t) * (1 - t) * p.amount);
        for (const c of cs) {
          // Nine copies, so a wash whose centre sits near an edge comes back on
          // the other side and the tile still meets itself.
          for (let oy = -1; oy <= 1; oy++) {
            for (let ox = -1; ox <= 1; ox++) {
              s.beginPath();
              s.arc((c[0] + ox) * W, (c[1] + oy) * H, r * t, 0, TAU);
              s.fill();
            }
          }
        }
      }
    },
  };

  // 22. Mist — soft bands.
  L.mist = {
    label: 'Mist', at: 'under', kind: 'ramp',
    controls: [
      ['bands', 'Bands', 'range', 2, 40, 1, 12],
      ['angle', 'Direction', 'chips', 0, 5, 1, 0],
      ['softness', 'Softness', 'range', 0, 1, 0.01, 0.6],
      ['ink', 'First ink', 'range', 0, 6, 1, 0],
    ],
    field: (p, m, seed) => fieldOf('ramp', p, m, seed),
    paint(s, W, H, p, pal, ctx) {
      const at = ctx.field;
      const n = Math.max(2, Math.round(p.bands));
      const ink = inkOf(pal, p, 0);
      const res = 200;
      const rows = Math.round(res * (H / W));
      // A raised cosine rather than a hard edge: at softness one the bands read
      // as mist and at zero as stripes, and the same arithmetic gives both.
      const tones = [];
      for (let b = 0; b < n; b++) {
        const t = (1 - Math.cos(((b + 0.5) / n) * TAU)) / 2;
        tones.push(TONE.mix(pal.ground, ink,
          (t * p.softness + (1 - p.softness) * (b % 2)) * p.amount * 0.8));
      }
      GRID.cells(s, W, H, res, rows,
        (i, j) => Math.min(n - 1, Math.floor(at((i + 0.5) / res, (j + 0.5) / rows) * n)), tones);
    },
  };

  // 18. Rise — a stepped ramp.
  L.rise = {
    label: 'Rise', at: 'under', kind: 'ramp',
    controls: [
      ['bands', 'Steps', 'range', 2, 40, 1, 10],
      ['angle', 'Direction', 'chips', 0, 5, 1, 0],
      ['curve', 'Curve', 'range', -1, 1, 0.01, 0],
      ['ink', 'First ink', 'range', 0, 6, 1, 0],
    ],
    field: (p, m, seed) => fieldOf('ramp', p, m, seed),
    paint(s, W, H, p, pal, ctx) {
      const at = ctx.field;
      const n = Math.max(2, Math.round(p.bands));
      const ink = inkOf(pal, p, 0);
      const res = 200;
      const rows = Math.round(res * (H / W));
      const tones = [];
      for (let b = 0; b < n; b++) {
        tones.push(TONE.mix(pal.ground, ink, NOISE.skew((b + 0.5) / n, p.curve) * p.amount));
      }
      GRID.cells(s, W, H, res, rows,
        (i, j) => Math.min(n - 1, Math.floor(at((i + 0.5) / res, (j + 0.5) / rows) * n)), tones);
    },
  };

  // 29. Pane — rectangular panes.
  L.pane = {
    label: 'Pane', at: 'under', kind: 'noise',
    controls: [
      ['cuts', 'Cuts', 'range', 1, 8, 1, 4],
      ['gutter', 'Gutter', 'range', 0, 0.2, 0.005, 0.02],
      ['fill', 'Filled', 'range', 0, 1, 0.01, 0.6],
      ['ink', 'First ink', 'range', 0, 6, 1, 0],
    ],
    paint(s, W, H, p, pal, ctx) {
      // Split recursively, always on a whole fraction of the tile, so every
      // edge of every pane lands where the tile repeats and the join is exact.
      const cuts = Math.max(1, Math.round(p.cuts));
      const g = p.gutter;
      const put = (x0, y0, x1, y1, d) => {
        const h1 = RAND.hash01(Math.round(x0 * 997), Math.round(y0 * 997), ctx.seed + d);
        if (d < cuts && (x1 - x0) > 0.12 && (y1 - y0) > 0.12) {
          const at2 = 0.3 + h1 * 0.4;
          if ((x1 - x0) >= (y1 - y0)) {
            const m = x0 + (x1 - x0) * at2;
            put(x0, y0, m, y1, d + 1); put(m, y0, x1, y1, d + 1);
          } else {
            const m = y0 + (y1 - y0) * at2;
            put(x0, y0, x1, m, d + 1); put(x0, m, x1, y1, d + 1);
          }
          return;
        }
        const h2 = RAND.hash01(Math.round(x1 * 997), Math.round(y1 * 997), ctx.seed + 40);
        if (h2 > p.fill) return;
        s.fillStyle = TONE.mix(pal.ground, inkOf(pal, p, Math.floor(h1 * 3)),
          (0.2 + h2 * 0.8) * p.amount);
        s.fillRect(R3((x0 + g) * W), R3((y0 + g) * H), R3((x1 - x0 - g * 2) * W), R3((y1 - y0 - g * 2) * H));
      };
      put(0, 0, 1, 1, 0);
    },
  };

  /* --------------------------------------------------------------- the wraps

     These four re-invoke everything under them. `inner(surface)` draws the
     whole stack below — the grounds and the generator — so a wrap can slice it,
     shove it, redraw it at falling opacity or run it again with the palette
     turned. Nothing is filtered: the picture is a function and it is simply
     called again, which is why the result is still an SVG made of shapes rather
     than a bitmap with a filter attached.

     They cost what they redraw. A wrap with eight bands emits the picture below
     it eight times, so the controls that set band counts are capped where a
     tile stays a file somebody can open, and every one of these is off until
     somebody turns it on. */

  // 38. Splice — the glitch.
  L.splice = {
    label: 'Splice', at: 'wrap',
    controls: [
      ['bands', 'Slices', 'range', 2, 14, 1, 7],
      ['shove', 'Shove', 'range', 0, 1, 0.01, 0.3],
      ['down', 'Slice downward', 'chips', 0, 1, 1, 0],
      ['skip', 'Dropped slices', 'range', 0, 0.6, 0.01, 0],
    ],
    wrap(inner, s, W, H, p, pal, ctx) {
      const n = Math.max(2, Math.round(p.bands));
      /* Slices run across or down, never at an angle.

         A band clipped at 37° does not come back round at the tile edge, so a
         sheet made from the tile has the slice boundaries stepping through it —
         which is a glitch nobody asked for on top of the one they did. Across
         and down both divide the tile exactly. */
      const down = !!p.down;
      for (let k = 0; k < n; k++) {
        const h = RAND.hash01(k, 0, ctx.seed + 21);
        if (h < p.skip) continue;
        const shove = (RAND.hash01(k, 1, ctx.seed + 22) * 2 - 1) * p.shove * p.amount
          * (down ? H : W) * 0.25;
        s.save();
        s.beginPath();
        if (down) s.rect(R3((k / n) * W), 0, R3(W / n) + 0.5, H);
        else s.rect(0, R3((k / n) * H), W, R3(H / n) + 0.5);
        s.clip();
        s.translate(down ? 0 : R3(shove), down ? R3(shove) : 0);
        inner(s);
        // And again a tile to the side, so the shove does not leave the slice
        // empty where it moved off the edge — but only when the shove is big
        // enough to have left one. A wrap emits the whole picture below it
        // every time it is called, so an unnecessary second pass is the size of
        // the tile again, per slice: over a dense generator that was the
        // difference between a one-megabyte tile and a three-megabyte one.
        if (Math.abs(shove) > 0.5) {
          const back = shove > 0 ? -1 : 1;
          s.translate(down ? 0 : R3(back * W), down ? R3(back * H) : 0);
          inner(s);
        }
        s.restore();
      }
    },
  };

  // 31. Bloom — the blur.
  //
  // Stacked offset copies at falling opacity, not a gaussian, and it does not
  // pretend to be one: `steps` is a control and the offsets are a ring, so at
  // eight steps and a small radius it is a soft halo and at three and a large
  // one it is a triple exposure. Both are useful and both are honest.
  L.bloom = {
    label: 'Bloom', at: 'wrap',
    controls: [
      ['steps', 'Steps', 'range', 2, 10, 1, 6],
      ['radius', 'Radius', 'range', 0, 0.1, 0.001, 0.03],
      ['keep', 'Keep the original', 'chips', 0, 1, 1, 1],
    ],
    // Every copy is drawn *without* its own ground. A generator opens by
    // filling the tile, so six copies at falling opacity came out as six
    // opaque grounds each covering the one before it and the halo was
    // invisible — an effect that costs six times the file and draws nothing.
    // `needsPaper` is how it asks the stack to lay the sheet first.
    needsPaper: true,
    wrap(inner, s, W, H, p, pal, ctx) {
      const n = Math.max(2, Math.round(p.steps));
      const r = p.radius * Math.min(W, H) * p.amount;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU;
        s.save();
        s.globalAlpha = (1 / n) * 0.9;
        s.translate(R3(Math.cos(a) * r), R3(Math.sin(a) * r));
        inner(s, null, true);
        s.restore();
      }
      if (p.keep) inner(s, null, true);
    },
  };

  // 19. Prism — the colorama.
  //
  // The picture below, run again inside each band of a field with the palette
  // turned by one. That is what a colorama is: not a hue rotation applied to
  // pixels, which this could not do, but the same drawing dealt a different set
  // of inks in each region. On a pattern made of a client's own colours it
  // stays inside their palette, which is the version of the effect a brand can
  // actually use.
  L.prism = {
    label: 'Prism', at: 'wrap',
    controls: [
      ['bands', 'Bands', 'range', 2, 8, 1, 4],
      ['down', 'Bands run down', 'chips', 0, 1, 1, 0],
      ['turn', 'Palette turn', 'range', 1, 6, 1, 1],
    ],
    wrap(inner, s, W, H, p, pal, ctx) {
      const n = Math.max(2, Math.round(p.bands));
      // Across or down, for the same reason splice is: an angled band does not
      // divide the tile, and a colorama whose bands step at every join is a
      // fault rather than an effect.
      const down = !!p.down;
      for (let k = 0; k < n; k++) {
        s.save();
        s.beginPath();
        if (down) s.rect(R3((k / n) * W), 0, R3(W / n) + 0.5, H);
        else s.rect(0, R3((k / n) * H), W, R3(H / n) + 0.5);
        s.clip();
        inner(s, k === 0 ? null : turned(pal, k * Math.round(p.turn)));
        s.restore();
      }
    },
  };

  // 33. Carve — the emboss.
  //
  // The picture below drawn three times: once up and left in a light tint, once
  // down and right in a dark one, then the original over both. The two offsets
  // are the lit and shaded edges of a chisel cut, and because they are the
  // *same drawing* they follow every edge in it exactly, which is what a real
  // bevel does and a drop shadow does not.
  L.carve = {
    label: 'Carve', at: 'wrap',
    controls: [
      ['depth', 'Depth', 'range', 0, 0.06, 0.001, 0.022],
      ['angle', 'Light', 'range', 0, 1, 0.01, 0.625],
      ['relief', 'Relief', 'range', 0, 1, 0.01, 0.6],
    ],
    // Same as `bloom`: the two offset copies and the face are all drawn
    // without their own ground, or each one covers the last and the bevel is a
    // plain tile that cost three times the file.
    needsPaper: true,
    wrap(inner, s, W, H, p, pal, ctx) {
      const d = p.depth * Math.min(W, H) * p.amount;
      const a = p.angle * TAU;
      const dx = Math.cos(a) * d, dy = Math.sin(a) * d;
      s.save();
      s.globalAlpha = p.relief;
      s.translate(R3(-dx), R3(-dy));
      inner(s, tinted(pal, '#FFFFFF', 0.55), true);
      s.restore();
      s.save();
      s.globalAlpha = p.relief;
      s.translate(R3(dx), R3(dy));
      inner(s, tinted(pal, '#000000', 0.45), true);
      s.restore();
      inner(s, null, true);
    },
  };

  /* A palette with its inks turned by k, keeping the ground where it is.

     The ground is the paper. Turning it too would recolour the page rather than
     the drawing on it, and a colorama that changes the paper band by band is a
     set of coloured stripes with a pattern faintly visible through them. */
  function turned(pal, k) {
    const inks = pal.inks.slice();
    const n = inks.length;
    const out = inks.map((_, i) => inks[(i + k) % n]);
    return Object.assign({}, pal, { inks: out,
      ink: (i) => out[((i % n) + n) % n].hex,
      named: (i) => out[((i % n) + n) % n] });
  }

  // And one with every ink pulled toward a colour, for the two sides of a
  // chisel cut.
  function tinted(pal, toward, t) {
    const out = pal.inks.map((k) => ({ name: k.name, hex: TONE.mix(k.hex, toward, t),
      role: k.role, against: k.against }));
    const n = out.length;
    return Object.assign({}, pal, { ground: TONE.mix(pal.ground, toward, t), inks: out,
      ink: (i) => out[((i % n) + n) % n].hex,
      named: (i) => out[((i % n) + n) % n] });
  }

  /* -------------------------------------------------------------- the overlays

     Painted last, on top of everything. Grain, fibres, threads, flecks, scorch —
     the things that make a flat tile look like it was printed on something.

     Six of the seven read the field the stack handed them, which is the whole
     argument for a stack rather than a set of switches: fibres over a contour
     layer lie along the contours, and scorch over a cell layer burns the walls.
     Turn the ground layer off and they fall back to their own noise, which is a
     different and duller picture. */

  // 37. Chaff — scattered flecks.
  L.chaff = {
    label: 'Chaff', at: 'over',
    controls: [
      ['count', 'Flecks', 'range', 10, 4000, 10, 900],
      ['size', 'Size', 'range', 0.0005, 0.02, 0.0005, 0.004],
      ['spread', 'Size spread', 'range', 0, 1, 0.01, 0.6],
      ['follow', 'Follow the field', 'range', 0, 1, 0.01, 0],
      ['ink', 'Ink', 'range', 0, 6, 1, 0],
    ],
    paint(s, W, H, p, pal, ctx) {
      const n = Math.max(1, Math.round(p.count));
      const base = p.size * Math.min(W, H);
      s.fillStyle = inkOf(pal, p, 0);
      s.globalAlpha = p.amount;
      s.beginPath();
      for (let k = 0; k < n; k++) {
        const u = RAND.hash01(k, 0, ctx.seed + 31), v = RAND.hash01(k, 1, ctx.seed + 32);
        // Where the field is dark the flecks gather, if they are told to follow
        // it — which is what turns a flat speckle into dirt that settles.
        if (p.follow > 0 && ctx.field
          && RAND.hash01(k, 2, ctx.seed + 33) > (1 - p.follow) + ctx.field(u, v) * p.follow) continue;
        const r = base * (1 - p.spread + p.spread * RAND.hash01(k, 3, ctx.seed + 34) * 2);
        s.rect(R3(u * W - r), R3(v * H - r), R3(r * 2), R3(r * 2));
      }
      s.fill();
      s.globalAlpha = 1;
    },
  };

  // 43. Hiss — broken scan lines.
  L.hiss = {
    label: 'Hiss', at: 'over',
    controls: [
      ['lines', 'Lines', 'range', 10, 600, 2, 160],
      ['weight', 'Weight', 'range', 0.0005, 0.01, 0.0005, 0.002],
      ['broken', 'Broken', 'range', 0, 1, 0.01, 0.6],
      ['down', 'Run down', 'chips', 0, 1, 1, 0],
      ['ink', 'Ink', 'range', 0, 6, 1, 0],
    ],
    paint(s, W, H, p, pal, ctx) {
      const n = Math.max(2, Math.round(p.lines));
      const w = p.weight * Math.min(W, H);
      // Across or down. A scan line is a scan line; at an angle it is a hatch,
      // and a hatch at an angle that does not divide the tile has a join in it.
      const down = !!p.down;
      const along = down ? H : W;
      s.fillStyle = inkOf(pal, p, 0);
      s.globalAlpha = p.amount;
      s.beginPath();
      for (let k = 0; k < n; k++) {
        const off = (k / n) * (down ? W : H);
        // A broken line is a run of segments rather than a dash pattern: the
        // gaps are hashed per segment, or every line breaks in the same places
        // and the field reads as a grid.
        let x = 0;
        while (x < along) {
          const seg = along * (0.01 + RAND.hash01(k, Math.round(x), ctx.seed + 35) * 0.12);
          const cut = Math.min(seg, along - x);
          if (RAND.hash01(k, Math.round(x) + 7, ctx.seed + 36) > p.broken) {
            if (down) s.rect(R3(off), R3(x), R3(w), R3(cut));
            else s.rect(R3(x), R3(off), R3(cut), R3(w));
          }
          x += seg;
        }
      }
      s.fill();
      s.globalAlpha = 1;
    },
  };

  /* The three fibre layers.

     One painter, three sets of numbers. A fibre is a short run that steps along
     the field's gradient; a strand is a long one; a husk is a short one that
     does not follow anything and lies at its own angle. Writing that three
     times would be three places for the same bug. */
  function fibres(s, W, H, p, pal, ctx, spec) {
    const n = Math.max(1, Math.round(p.count));
    const len = p.length * Math.min(W, H);
    const w = p.weight * Math.min(W, H);
    const steps = Math.max(2, Math.round(spec.steps));
    s.fillStyle = inkOf(pal, p, 0);
    s.globalAlpha = p.amount;
    s.beginPath();
    for (let k = 0; k < n; k++) {
      let u = RAND.hash01(k, 0, ctx.seed + 41), v = RAND.hash01(k, 1, ctx.seed + 42);
      // The angle it sets off at: the field's own gradient where there is one
      // and it is asked for, its own hash otherwise.
      let a = RAND.hash01(k, 2, ctx.seed + 43) * TAU;
      for (let t = 0; t < steps; t++) {
        if (p.follow > 0 && ctx.field) {
          const e = 0.004;
          const gx = ctx.field(frac(u + e), v) - ctx.field(frac(u - e), v);
          const gy = ctx.field(u, frac(v + e)) - ctx.field(u, frac(v - e));
          if (gx || gy) {
            // Along the contour, not up the slope: a fibre that ran uphill
            // would pile every one of them into the same few places.
            const want = Math.atan2(gx, -gy);
            a = a + (Math.atan2(Math.sin(want - a), Math.cos(want - a))) * p.follow;
          }
        }
        a += (RAND.hash01(k, 10 + t, ctx.seed + 44) - 0.5) * p.wander;
        const nu = u + (Math.cos(a) * len) / steps / W;
        const nv = v + (Math.sin(a) * len) / steps / H;
        /* Every image of the segment that touches the tile, not the segment
           alone.

           The first version walked in wrapped coordinates and simply dropped
           any segment that crossed an edge, which leaves a fibre stopping dead
           at the join — a gap right where the tile has to be seamless. Walking
           unwrapped and drawing the segment at each of the nine tile offsets it
           could land on costs nothing (only the one or two that overlap emit
           anything) and the fibre runs straight through the join. */
        const dx = (nu - u) * W, dy = (nv - v) * H;
        const Ln = Math.hypot(dx, dy) || 1;
        const nx = (-dy / Ln) * w, ny = (dx / Ln) * w;
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const x0 = (frac(u) + ox) * W, y0 = (frac(v) + oy) * H;
            const x1 = x0 + dx, y1 = y0 + dy;
            if (Math.max(x0, x1) < -w || Math.min(x0, x1) > W + w) continue;
            if (Math.max(y0, y1) < -w || Math.min(y0, y1) > H + w) continue;
            s.moveTo(R3(x0 + nx), R3(y0 + ny));
            s.lineTo(R3(x1 + nx), R3(y1 + ny));
            s.lineTo(R3(x1 - nx), R3(y1 - ny));
            s.lineTo(R3(x0 - nx), R3(y0 - ny));
            s.closePath();
          }
        }
        u = nu; v = nv;
      }
    }
    s.fill();
    s.globalAlpha = 1;
  }

  const FIBRE_CONTROLS = (count, len, weight, follow, wander) => ([
    ['count', 'Count', 'range', 4, 3000, 4, count],
    ['length', 'Length', 'range', 0.005, 1.2, 0.005, len],
    ['weight', 'Weight', 'range', 0.0004, 0.02, 0.0002, weight],
    ['follow', 'Follow the field', 'range', 0, 1, 0.01, follow],
    ['wander', 'Wander', 'range', 0, 2, 0.01, wander],
    ['ink', 'Ink', 'range', 0, 6, 1, 0],
  ]);

  // 03. Filament — a field of fine lines.
  L.filament = { label: 'Filament', at: 'over',
    controls: FIBRE_CONTROLS(350, 0.12, 0.0012, 0.8, 0.2),
    paint: (s, W, H, p, pal, ctx) => fibres(s, W, H, p, pal, ctx, { steps: 10 }) };

  // 36. Strand — long threads.
  L.strand = { label: 'Strand', at: 'over',
    controls: FIBRE_CONTROLS(60, 0.65, 0.003, 0.9, 0.12),
    paint: (s, W, H, p, pal, ctx) => fibres(s, W, H, p, pal, ctx, { steps: 40 }) };

  // 35. Husk — short fibres.
  L.husk = { label: 'Husk', at: 'over',
    controls: FIBRE_CONTROLS(700, 0.03, 0.0016, 0, 0.9),
    paint: (s, W, H, p, pal, ctx) => fibres(s, W, H, p, pal, ctx, { steps: 3 }) };

  // 41. Frond — branching runs.
  L.frond = {
    label: 'Frond', at: 'over',
    controls: [
      ['count', 'Fronds', 'range', 2, 200, 1, 30],
      ['length', 'Length', 'range', 0.02, 0.6, 0.005, 0.16],
      ['weight', 'Weight', 'range', 0.0004, 0.012, 0.0002, 0.002],
      ['ribs', 'Ribs', 'range', 2, 20, 1, 9],
      ['spread', 'Rib spread', 'range', 0, 1, 0.01, 0.5],
      ['follow', 'Follow the field', 'range', 0, 1, 0.01, 0.6],
      ['ink', 'Ink', 'range', 0, 6, 1, 0],
    ],
    paint(s, W, H, p, pal, ctx) {
      const n = Math.max(1, Math.round(p.count));
      const len = p.length * Math.min(W, H);
      const w = p.weight * Math.min(W, H);
      const ribs = Math.max(2, Math.round(p.ribs));
      s.fillStyle = inkOf(pal, p, 0);
      s.globalAlpha = p.amount;
      s.beginPath();
      const bar = (x0, y0, x1, y1, half) => {
        const dx = x1 - x0, dy = y1 - y0;
        const Ln = Math.hypot(dx, dy) || 1;
        const nx = (-dy / Ln) * half, ny = (dx / Ln) * half;
        s.moveTo(R3(x0 + nx), R3(y0 + ny)); s.lineTo(R3(x1 + nx), R3(y1 + ny));
        s.lineTo(R3(x1 - nx), R3(y1 - ny)); s.lineTo(R3(x0 - nx), R3(y0 - ny)); s.closePath();
      };
      for (let k = 0; k < n; k++) {
        const u = RAND.hash01(k, 0, ctx.seed + 51), v = RAND.hash01(k, 1, ctx.seed + 52);
        let a = RAND.hash01(k, 2, ctx.seed + 53) * TAU;
        if (p.follow > 0 && ctx.field) {
          const e = 0.004;
          const gx = ctx.field(frac(u + e), v) - ctx.field(frac(u - e), v);
          const gy = ctx.field(u, frac(v + e)) - ctx.field(u, frac(v - e));
          if (gx || gy) a = Math.atan2(gx, -gy) * p.follow + a * (1 - p.follow);
        }
        const x0 = u * W, y0 = v * H;
        const x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len;
        bar(x0, y0, x1, y1, w);
        // The ribs, shortening toward the tip, which is what makes it a frond
        // rather than a comb.
        for (let r = 1; r < ribs; r++) {
          const t = r / ribs;
          const bx = x0 + (x1 - x0) * t, by = y0 + (y1 - y0) * t;
          const rl = len * p.spread * 0.45 * (1 - t);
          for (const side of [1, -1]) {
            const ra = a + side * (0.5 + 0.5 * (1 - t));
            bar(bx, by, bx + Math.cos(ra) * rl, by + Math.sin(ra) * rl, w * 0.7);
          }
        }
      }
      s.fill();
      s.globalAlpha = 1;
    },
  };

  // 32. Sear — scorch along the field's edges.
  L.sear = {
    label: 'Sear', at: 'over',
    controls: [
      ['count', 'Grain', 'range', 100, 6000, 50, 900],
      ['size', 'Size', 'range', 0.001, 0.03, 0.0005, 0.006],
      ['edge', 'Edge pull', 'range', 0, 1, 0.01, 0.85],
      ['burn', 'Burn', 'range', 0, 1, 0.01, 0.7],
      ['ink', 'Ink', 'range', 0, 6, 1, 0],
    ],
    paint(s, W, H, p, pal, ctx) {
      const n = Math.max(1, Math.round(p.count));
      const base = p.size * Math.min(W, H);
      // Scorch is dark. Not the palette's darkest ink but the ink mixed toward
      // black: a burn is the same material with the light gone out of it.
      s.fillStyle = TONE.mix(inkOf(pal, p, 0), '#000000', p.burn);
      s.globalAlpha = p.amount;
      s.beginPath();
      for (let k = 0; k < n; k++) {
        const u = RAND.hash01(k, 0, ctx.seed + 61), v = RAND.hash01(k, 1, ctx.seed + 62);
        let keep = 1;
        if (ctx.field && p.edge > 0) {
          const e = 0.006;
          const gx = ctx.field(frac(u + e), v) - ctx.field(frac(u - e), v);
          const gy = ctx.field(u, frac(v + e)) - ctx.field(u, frac(v - e));
          keep = (1 - p.edge) + Math.min(1, Math.hypot(gx, gy) * 8) * p.edge;
        }
        if (RAND.hash01(k, 2, ctx.seed + 63) > keep) continue;
        const r = base * (0.4 + RAND.hash01(k, 3, ctx.seed + 64) * 1.2);
        s.moveTo(R3(u * W + r), R3(v * H));
        s.arc(u * W, v * H, r, 0, TAU);
        s.closePath();
      }
      s.fill();
      s.globalAlpha = 1;
    },
  };

  /* ------------------------------------------------------------- the catalogue

     Order is the stack. Grounds first in the order they read best under one
     another, then the wraps innermost-first, then the overlays. A layer cannot
     be moved: what it does depends on what is under it, and a studio that let
     somebody put a blur under a ground would be offering a control that does
     nothing. What a client *can* do is turn any of them on, in any combination,
     and set every number each one has. */
  const ORDER = [
    // grounds
    'terrain', 'delta', 'culture', 'sonar', 'rise', 'mist', 'pane', 'aura',
    // wraps, innermost first
    'carve', 'bloom', 'splice', 'prism',
    // overlays
    'filament', 'strand', 'husk', 'frond', 'sear', 'chaff', 'hiss',
  ];
  const NAMES = ORDER.filter((k) => L[k]);

  // Every layer has an Amount, and it is always first. It is the one control a
  // client reaches for before any of the others, and a layer at zero amount is
  // off however its own numbers are set.
  const AMOUNT = ['amount', 'Amount', 'range', 0, 1, 0.01, 0];

  /* A note about what these cost.

     A layer emits shapes, and some of them emit a great many: a fibre field is
     one quadrilateral per step per fibre, and a wrap emits the whole picture
     below it once per band. Measured over a lattice at 480 units, with every
     layer at full amount and its own defaults, the heaviest four came out at
     380, 430, 270 and 235 KB — for one tile, in one colourway, of a package
     that writes four. So the counts here start at about half what looks best on
     screen, which is still more than enough on paper, and every one of them is
     a control a client can turn up when they know what they are asking for. */

  function controlsOf(key) {
    const l = L[key];
    if (!l) return [];
    return [AMOUNT].concat(l.controls).map((c) => ({
      group: `fx:${key}`, key: c[0], label: c[1], type: c[2],
      min: c[3], max: c[4], step: c[5],
      options: c[2] === 'chips' ? [0, 1] : undefined,
    }));
  }

  // What a layer starts at. Every number is the last entry of its own control
  // row, so a control and its default cannot drift apart.
  function defaultsOf(key) {
    const out = {};
    for (const c of [AMOUNT].concat((L[key] || {}).controls || [])) out[c[0]] = c[6];
    return out;
  }

  const all = () => { const out = {}; for (const k of NAMES) out[k] = defaultsOf(k); return out; };

  /* Painting the stack.

     `drawBase` is the generator. Everything here is arranged around one fact:
     a wrap layer needs to draw what is under it, so what is under it has to be
     a function rather than something already on the page. So the stack is built
     inside out — the generator, then each wrap around the last, then the
     grounds under and the overlays over.

     `palette` is threaded through because `prism` and `carve` re-run the
     picture with a different one. A generator is handed a palette and never
     asks where it came from, which is what makes that possible at all. */
  function paint(surface, W, H, params, pal, drawBase) {
    /* Everything is clipped to the tile it is drawing.

       A tile is used clipped to its own bounds — an SVG `<pattern>` fill, a
       texture in a layout, a bitmap copied across — so anything a generator
       paints outside them is thrown away. Several of them paint a ring of
       copies past every edge so that a shape straddling the join is drawn on
       both sides of it, which is right; what is not right is *relying* on the
       neighbour's copy to complete this tile, because under a clip there is no
       neighbour.

       Measured before this went in: nineteen of sixty generator-and-identity
       pairs drew a tile that differed from the same tile with its eight
       neighbours around it — warp by 9% of the page, sprig by 6%, sampler by
       2%. Not one of them was a mismatch in the artwork; every one was a
       neighbour's overhang landing on top of this tile's own drawing. Clipped,
       the two are the same picture by construction, and what each generator
       draws for itself is all there is.

       One place rather than twenty-five. `lattice` clipped itself and the other
       twenty-four did not, which is exactly the kind of thing that is true of
       the first generator somebody writes and of none of the rest. */
    surface.save();
    surface.beginPath();
    surface.rect(0, 0, W, H);
    surface.clip();
    try { stack(surface, W, H, params, pal, drawBase); } finally { surface.restore(); }
  }

  function stack(surface, W, H, params, pal, drawBase) {
    const fx = params.effects || {};
    const motif = params.motif || null;
    const seed = (params.seed || 1) * 149;
    const on = NAMES.filter((k) => fx[k] && fx[k].amount > 0);
    if (!on.length) { drawBase(surface, pal); return; }

    // The field the overlays read, and the last ground to define one wins.
    // Handed down rather than recomputed, so two layers pointed at the same
    // ground agree about where its edges are.
    let field = null;
    const ctx = { motif, seed, get field() { return field; } };

    /* The base, and the third argument that says who lays the paper.

       `inner(surface, palette, painted)` — a wrap that redraws the picture
       several times over itself has to be able to say "not the ground this
       time", because a generator opens by filling the whole tile and an opaque
       fill covers the copy before it. `bloom` and `carve` both did exactly
       that: six and three copies of the picture in the file, and a tile that
       looked untouched. */
    let inner = (s, palette, painted) => drawBase(s, painted ? paperDown(palette || pal) : (palette || pal));
    for (const key of on) {
      if (L[key].at !== 'wrap') continue;
      const l = L[key], p = Object.assign(defaultsOf(key), fx[key]);
      const below = inner;
      inner = (s, palette, painted) => l.wrap(
        (s2, pal2, hide) => below(s2 || s, pal2 || palette, hide || painted),
        s, W, H, p, palette || pal, ctx);
    }

    let ground = false;
    // A wrap that draws its copies without a ground needs one laid under them.
    const wantsPaper = on.some((k) => L[k].needsPaper);
    if (wantsPaper) {
      surface.fillStyle = pal.ground;
      surface.fillRect(0, 0, W, H);
      ground = true;
    }
    for (const key of on) {
      if (L[key].at !== 'under') continue;
      const l = L[key], p = Object.assign(defaultsOf(key), fx[key]);
      if (l.field) field = l.field(p, motif, seed);
      // The paper first. A ground layer paints over it, so it has to be under
      // it rather than under the generator.
      if (!ground) { surface.fillStyle = pal.ground; surface.fillRect(0, 0, W, H); ground = true; }
      l.paint(surface, W, H, p, pal, ctx);
    }
    /* And the generator is told the paper is already down.

       Every generator opens by filling the tile with its own ground, which is
       right until a ground layer is on: an opaque fill over the top made all
       eight of them invisible while still costing their own weight in the file.
       `palette.paper` reads this and does nothing; nothing else about the
       palette changes, so a generator that uses the ground colour as an *ink* —
       a counterchange figure, a quilt medallion, a punched glyph — still gets
       it. */
    inner(surface, pal, ground);
    for (const key of on) {
      if (L[key].at !== 'over') continue;
      const l = L[key], p = Object.assign(defaultsOf(key), fx[key]);
      if (l.field) field = l.field(p, motif, seed);
      l.paint(surface, W, H, p, pal, ctx);
    }
  }

  // What is on, for the manual and for the studio's status line.
  const active = (params) => {
    const fx = (params || {}).effects || {};
    return NAMES.filter((k) => fx[k] && fx[k].amount > 0);
  };

  return { LAYERS: L, NAMES, ORDER, controlsOf, defaultsOf, all, paint, active,
    fieldOf, centres, torus, turned, tinted };
}));
