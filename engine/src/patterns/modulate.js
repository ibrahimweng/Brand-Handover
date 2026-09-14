/* An effect is a thing you do *to* a pattern, not a thing you put near it.

   The first version of this got it backwards. Nineteen effects, each painting
   under the pattern, over it, or around it — grounds and grain and fibres. A
   client asking for a noise effect on a wave pattern does not want noise drawn
   on top of the waves. They want the noise to *drive* the waves: dark makes
   the wave bigger, light makes it smaller, or the reverse, or the noise becomes
   a displacement, or a blur, or a gradient the colour steps through.

   So a layer is a **field** and a set of **channels** it drives, and this is
   where the driving happens.

   ------------------------------------------------------- why a surface, not a
                                                            generator argument

   The obvious place to put this is in each generator: hand it the field and let
   it decide what to do with it. That is thirty-two separate pieces of work,
   thirty-two chances to do it slightly differently, and a new generator that
   forgets is a generator whose effects silently do nothing.

   Instead this wraps the surface. A generator draws exactly as it always did
   and never learns that anything is happening: the calls pass through here on
   their way to the real surface, and what comes out the other side is bent,
   resized, turned, recoloured, softened or thinned by the field. Every channel
   works on every generator the day it is written, including the ones written
   afterwards.

   ------------------------------------------------------------ the seven things
                                                                 a field can do

     displace   push every point along the field's own gradient — the depth-map
                distortion, where the picture flows downhill
     size       scale each shape about its own centre — bigger where the field
                is dark, smaller where it is light, or the reverse
     turn       rotate each shape about its own centre
     weight     thicken and thin the stroke. A fill has no width, so this one
                reaches a generator that strokes and leaves one that fills alone
                — `size` is the channel that grows a filled shape
     tone       step the colour through the palette, or mix it toward the
                ground — the gradient overlay and the colorama
     blur       redraw a shape several times at small offsets, by how much the
                field says — soft here, sharp there
     thin       drop shapes where the field is quiet

   ------------------------------------------------------------ per *subpath*,
                                                                not per path

   The unit all of this acts on is the subpath — everything between one `moveTo`
   and the next. That is what makes one mechanism serve two very different
   generators: a lattice draws each motif as its own subpath, so `size` scales
   each motif; the grid painter draws ten thousand cells as subpaths of a single
   path, so `size` scales each *cell*. Acting per path would scale a lattice
   motif and do nothing at all to a grid.

   ------------------------------------------------------------------- the CTM

   This has to know where a point lands on the tile before it can ask the field
   about it, and a generator draws under its own translations and rotations. So
   the wrapper takes the transform over: it keeps the matrix stack itself,
   converts every coordinate to tile space, does the work there, and hands the
   inner surface absolute coordinates under no transform at all. Line widths are
   scaled by hand for the same reason, which is what `surface.js` already does
   when it writes SVG. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./surface'), require('./rand'), require('./tone'));
  else root.PatternModulate = factory(root.PatternSurface, root.PatternRand, root.PatternTone);
}(typeof self !== 'undefined' ? self : this, function (SURF, RAND, TONE) {
  'use strict';

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const IDENTITY = [1, 0, 0, 1, 0, 0];
  const mul = SURF.mul;
  const apply = SURF.apply;
  const lengthScale = SURF.lengthScale;

  // How far apart the two samples are when the gradient is measured. A
  // thousandth of the tile: close enough that it is the slope at the point
  // rather than the slope of the neighbourhood, far enough that a field built
  // from whole-number sines does not come back as floating-point noise.
  const STEP = 0.001;

  /* The channels, and the defaults that mean "off".

     Every one is centred on zero and signed, so a client does not need a
     separate polarity switch: `size` at +0.6 makes the shape bigger where the
     field is dark, and at −0.6 bigger where it is light. That is the same
     control doing the "or vice versa" rather than a second control that has to
     be found. */
  const CHANNELS = [
    ['displace', 'Displace', -1, 1, 0.01, 0],
    ['size', 'Size', -1, 1, 0.01, 0],
    ['turn', 'Turn', -1, 1, 0.01, 0],
    ['weight', 'Stroke weight', -1, 1, 0.01, 0],
    ['tone', 'Tone', -1, 1, 0.01, 0],
    ['blur', 'Blur', 0, 1, 0.01, 0],
    ['thin', 'Thin out', 0, 1, 0.01, 0],
  ];
  const NONE = {};
  for (const c of CHANNELS) NONE[c[0]] = c[5];
  const anyOn = (ch) => CHANNELS.some((c) => Math.abs(ch[c[0]] || 0) > 1e-6);

  /* A palette stepped by the field.

     Two things at once, because a designer means both by "gradient overlay".
     Toward zero the ink is mixed toward the ground, which is a wash; past that
     it steps to the next ink along, which is a colorama. The ground itself is
     never moved — recolouring the paper band by band is a set of coloured
     stripes with a pattern faintly visible through them, not an effect on the
     pattern. */
  function toned(hex, t, pal, amount) {
    if (!pal || !amount) return hex;
    const k = clamp(t, 0, 1);
    // The ground is the paper and is never moved. Recolouring the sheet band by
    // band is a set of coloured stripes with a pattern faintly visible through
    // them, not an effect on the pattern.
    if (String(hex).toUpperCase() === String(pal.ground).toUpperCase()) return hex;
    const a = Math.abs(amount);
    // Which way round: a positive amount acts on the dark end of the field, a
    // negative one on the light end. One control rather than a second polarity
    // switch that has to be found.
    const wash = amount > 0 ? 1 - k : k;
    const inks = pal.inks ? pal.inks.length : 1;
    let out = hex;
    if (inks > 1) out = TONE.mix(out, pal.ink(Math.floor(wash * inks * 0.999) % inks), a);
    return TONE.mix(out, pal.ground, wash * a * 0.5);
  }

  function surface(inner, W, H, field, channels, pal, seed) {
    const ch = Object.assign({}, NONE, channels || {});
    // Nothing switched on: hand back the real surface. A wrapper that copies
    // every call for no reason is a wrapper that changes the bytes of every
    // tile in the repository.
    if (!field || !anyOn(ch)) return inner;

    const at = (x, y) => clamp(field(x / W, y / H), 0, 1);
    const S = { width: W, height: H,
      fillStyle: '#000000', strokeStyle: '#000000',
      lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', globalAlpha: 1 };

    let ctm = IDENTITY.slice();
    const stack = [];
    // The path, in tile space, as a list of subpaths. Each subpath is a list of
    // ops whose coordinates are already absolute.
    let subs = [];
    let cur = null;
    let here = null;

    const open = (x, y) => { cur = { ops: [['M', x, y]], closed: false }; subs.push(cur); here = [x, y]; };
    const add = (op) => { if (!cur) open(op[op.length - 2], op[op.length - 1]); else cur.ops.push(op); here = [op[op.length - 2], op[op.length - 1]]; };

    S.save = () => { stack.push({ ctm: ctm.slice(), fillStyle: S.fillStyle, strokeStyle: S.strokeStyle,
      lineWidth: S.lineWidth, lineCap: S.lineCap, lineJoin: S.lineJoin, globalAlpha: S.globalAlpha }); inner.save(); };
    S.restore = () => {
      const s = stack.pop(); inner.restore();
      if (!s) return;
      ctm = s.ctm; S.fillStyle = s.fillStyle; S.strokeStyle = s.strokeStyle;
      S.lineWidth = s.lineWidth; S.lineCap = s.lineCap; S.lineJoin = s.lineJoin; S.globalAlpha = s.globalAlpha;
    };
    S.translate = (x, y) => { ctm = mul(ctm, [1, 0, 0, 1, x, y]); };
    S.scale = (x, y) => { ctm = mul(ctm, [x, 0, 0, y == null ? x : y, 0, 0]); };
    S.rotate = (rad) => { const c = Math.cos(rad), s = Math.sin(rad); ctm = mul(ctm, [c, s, -s, c, 0, 0]); };

    S.beginPath = () => { subs = []; cur = null; here = null; };
    S.moveTo = (x, y) => { const p = apply(ctm, x, y); open(p[0], p[1]); };
    S.lineTo = (x, y) => { const p = apply(ctm, x, y); add(['L', p[0], p[1]]); };
    S.quadraticCurveTo = (cx, cy, x, y) => {
      const c = apply(ctm, cx, cy), p = apply(ctm, x, y);
      add(['Q', c[0], c[1], p[0], p[1]]);
    };
    S.bezierCurveTo = (ax, ay, bx, by, x, y) => {
      const a = apply(ctm, ax, ay), b = apply(ctm, bx, by), p = apply(ctm, x, y);
      add(['C', a[0], a[1], b[0], b[1], p[0], p[1]]);
    };
    S.closePath = () => { if (cur) cur.closed = true; };
    S.arc = (cx, cy, r, a0, a1, ccw) => {
      // Walked into curves here rather than passed through, because everything
      // downstream works on points and an arc is the one call that does not
      // give any.
      const seg = SURF.arcSegments(cx, cy, r, a0, a1, !!ccw);
      const s0 = apply(ctm, seg.start[0], seg.start[1]);
      if (here) add(['L', s0[0], s0[1]]); else open(s0[0], s0[1]);
      for (const g of seg.segments) {
        const a = apply(ctm, g[0], g[1]), b = apply(ctm, g[2], g[3]), p = apply(ctm, g[4], g[5]);
        add(['C', a[0], a[1], b[0], b[1], p[0], p[1]]);
      }
    };
    S.rect = (x, y, w, h) => {
      S.moveTo(x, y); S.lineTo(x + w, y); S.lineTo(x + w, y + h); S.lineTo(x, y + h); S.closePath();
      cur = null; here = null;
    };
    S.fillRect = (x, y, w, h) => {
      // A full-bleed fill is the sheet, not a shape, and resizing or turning the
      // sheet leaves a corner of the tile empty. It goes straight through.
      if (x <= 0 && y <= 0 && w >= W - 1e-6 && h >= H - 1e-6) { inner.fillStyle = S.fillStyle; inner.fillRect(x, y, w, h); return; }
      const keep = subs, keepCur = cur, keepHere = here;
      S.beginPath(); S.rect(x, y, w, h); S.fill();
      subs = keep; cur = keepCur; here = keepHere;
    };

    // ------------------------------------------------------------- the work

    // Where a run of subpaths is, and how big. Measured off its own points
    // rather than off a bounding box of the whole path, which is the difference
    // between scaling a motif and scaling the sheet it is on.
    function middle(list) {
      let n = 0, sx = 0, sy = 0;
      for (const sub of list) {
        for (const o of sub.ops) {
          for (let i = 1; i < o.length; i += 2) { sx += o[i]; sy += o[i + 1]; n++; }
        }
      }
      return n ? [sx / n, sy / n] : [0, 0];
    }

    function boxOf(sub) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const o of sub.ops) {
        for (let i = 1; i < o.length; i += 2) {
          if (o[i] < x0) x0 = o[i]; if (o[i] > x1) x1 = o[i];
          if (o[i + 1] < y0) y0 = o[i + 1]; if (o[i + 1] > y1) y1 = o[i + 1];
        }
      }
      return [x0, y0, x1, y1];
    }

    /* Which subpaths belong to the same shape.

       The unit all of this acts on cannot be the subpath on its own. A ring is
       two subpaths — an outer boundary and an inner one — and the hole exists
       only because the fill rule sees both at once. Transformed separately and
       filled separately, the inner ring becomes a disc painted over the outer
       one, and every ring in the repository came out solid. That is what the
       first version of this did, and it is visible in one glance at any
       identity whose mark has a counter in it.

       Nor can it be the whole path: the grid painter draws ten thousand cells
       as subpaths of a single path, and treating those as one shape would scale
       the sheet rather than the cells.

       So it is the *overlapping run*: subpaths whose boxes overlap belong to one
       shape, and are moved together and filled together. A ring's two rings
       overlap; two grid cells that share an edge do not, which is why the test
       is a strict overlap rather than a touch. Bucketed into a coarse grid
       first, because the honest test is every pair against every other and a
       ten-thousand-cell tile would be a hundred million of them. */
    function groupsOf(list) {
      const n = list.length;
      if (n < 2) return [list];
      const box = list.map(boxOf);
      const owner = new Int32Array(n);
      for (let i = 0; i < n; i++) owner[i] = i;
      const find = (i) => { while (owner[i] !== i) { owner[i] = owner[owner[i]]; i = owner[i]; } return i; };
      const join = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) owner[rb] = ra; };
      // A coarse bucket grid over the tile. Only subpaths sharing a bucket are
      // ever compared, which is near-linear for the usual case of many small
      // shapes spread out.
      const B = 24;
      const buckets = new Map();
      const EPS = 1e-6;
      for (let i = 0; i < n; i++) {
        const b = box[i];
        const i0 = Math.max(0, Math.floor((b[0] / W) * B)), i1 = Math.min(B - 1, Math.floor((b[2] / W) * B));
        const j0 = Math.max(0, Math.floor((b[1] / H) * B)), j1 = Math.min(B - 1, Math.floor((b[3] / H) * B));
        for (let j = j0; j <= j1; j++) {
          for (let k = i0; k <= i1; k++) {
            const key = j * B + k;
            let list2 = buckets.get(key);
            if (!list2) { list2 = []; buckets.set(key, list2); }
            for (const o of list2) {
              const c = box[o];
              if (b[0] < c[2] - EPS && c[0] < b[2] - EPS && b[1] < c[3] - EPS && c[1] < b[3] - EPS) join(i, o);
            }
            list2.push(i);
          }
        }
      }
      const by = new Map();
      for (let i = 0; i < n; i++) {
        const r = find(i);
        let g = by.get(r);
        if (!g) { g = []; by.set(r, g); }
        g.push(list[i]);
      }
      return [...by.values()];
    }

    // The field's slope, for the displacement. Downhill, so the picture flows
    // toward where the field is dark — which is the direction a depth map reads
    // as "lower".
    function slope(x, y) {
      const e = STEP * Math.min(W, H);
      const gx = at(x + e, y) - at(x - e, y);
      const gy = at(x, y + e) - at(x, y - e);
      return [gx, gy];
    }

    // One shape — one or more subpaths — moved by the field.
    function bend(group) {
      const mid = middle(group);
      const t = at(mid[0], mid[1]);
      // Centred on a half, so a field at its middle leaves the shape alone and
      // the two ends of the slider pull opposite ways.
      const k = (0.5 - t) * 2;
      const grow = 1 + k * ch.size;
      const turn = k * ch.turn * Math.PI;
      const c = Math.cos(turn), s = Math.sin(turn);
      let dx = 0, dy = 0;
      if (ch.displace) {
        /* How far, from the field's value; which way, from its slope.

           The first version took both from the slope, and on a terraced field
           that is zero almost everywhere: `terrain` steps into six bands, the
           slope inside a band is nothing, and the channel moved 0.00% of the
           page. A stepped field is not a broken field — it is most of what a
           depth map is for — so the magnitude has to come from the value.

           The direction still comes from the slope where there is one, which is
           what makes the picture flow downhill on a smooth field. Where the
           field is flat there is no downhill, and it pushes along the diagonal
           instead: an arbitrary direction, but a predictable one, and the
           alternative is a control that does nothing on half the fields. */
        const reach = ch.displace * Math.min(W, H) * 0.35 * k;
        const g = slope(mid[0], mid[1]);
        const L = Math.hypot(g[0], g[1]);
        const ux = L > 1e-9 ? -g[0] / L : Math.SQRT1_2;
        const uy = L > 1e-9 ? -g[1] / L : Math.SQRT1_2;
        dx = ux * reach; dy = uy * reach;
      }
      const place = (x, y) => {
        const px = (x - mid[0]) * grow, py = (y - mid[1]) * grow;
        return [mid[0] + px * c - py * s + dx, mid[1] + px * s + py * c + dy];
      };
      const out = [];
      for (const sub of group) {
        const ops = [];
        for (const o of sub.ops) {
          const n = [o[0]];
          for (let i = 1; i < o.length; i += 2) { const q = place(o[i], o[i + 1]); n.push(q[0], q[1]); }
          ops.push(n);
        }
        out.push({ ops, closed: sub.closed });
      }
      return { subs: out, t, mid };
    }

    // Draw one shape into the real surface, at an offset. All of its subpaths
    // go into one path, so the fill rule still sees them together and a ring
    // still has its hole.
    function emit(shape, ox, oy) {
      inner.beginPath();
      for (const sub of shape.subs) {
        for (const o of sub.ops) {
          if (o[0] === 'M') inner.moveTo(o[1] + ox, o[2] + oy);
          else if (o[0] === 'L') inner.lineTo(o[1] + ox, o[2] + oy);
          else if (o[0] === 'Q') inner.quadraticCurveTo(o[1] + ox, o[2] + oy, o[3] + ox, o[4] + oy);
          else if (o[0] === 'C') inner.bezierCurveTo(o[1] + ox, o[2] + oy, o[3] + ox, o[4] + oy, o[5] + ox, o[6] + oy);
        }
        if (sub.closed) inner.closePath();
      }
    }

    let drawn = 0;
    function run(how, rule) {
      const width = S.lineWidth * lengthScale(ctm);
      inner.lineCap = S.lineCap; inner.lineJoin = S.lineJoin;
      for (const group of groupsOf(subs.filter((x) => x.ops.length))) {
        const sub = bend(group);
        // Thinned out where the field is quiet. Hashed off where the shape is,
        // so the same shape is dropped at every size and the tile still
        // repeats.
        if (ch.thin > 0) {
          const h = RAND.hash01(Math.round(sub.mid[0] * 37), Math.round(sub.mid[1] * 37), (seed || 1) * 173);
          if (h > 1 - ch.thin * (1 - sub.t)) continue;
        }
        const colour = toned(how === 'fill' ? S.fillStyle : S.strokeStyle, sub.t, pal, ch.tone);
        // Weight: the stroke thickens toward one end of the field. A fill has
        // no width, so the channel simply does not reach it.
        const w = width * (1 + (0.5 - sub.t) * 2 * ch.weight);
        // Blur: the same shape a few times at small offsets, the spread set by
        // the field. Not a gaussian, and it does not pretend to be — it is what
        // a soft edge can be when the answer has to stay a set of shapes.
        const spread = ch.blur * sub.t * Math.min(W, H) * 0.03;
        const copies = spread > 0.05 ? 5 : 1;
        for (let i = 0; i < copies; i++) {
          const a = (i / copies) * Math.PI * 2;
          const ox = copies > 1 ? Math.cos(a) * spread : 0;
          const oy = copies > 1 ? Math.sin(a) * spread : 0;
          emit(sub, ox, oy);
          inner.globalAlpha = S.globalAlpha * (copies > 1 ? 1 / copies : 1);
          if (how === 'fill') { inner.fillStyle = colour; inner.fill(rule); }
          else { inner.strokeStyle = colour; inner.lineWidth = Math.max(0.01, w); inner.stroke(); }
          inner.globalAlpha = S.globalAlpha;
          drawn++;
        }
      }
    }

    S.fill = (rule) => run('fill', rule);
    S.stroke = () => run('stroke');
    S.clip = () => {
      // A clip is a boundary rather than a mark: bending it would move the edge
      // of the region a generator asked for, which is not what any of these
      // channels mean. Passed straight through, under the transform this
      // wrapper has taken over.
      inner.beginPath();
      for (const sub of subs) {
        for (const o of sub.ops) {
          if (o[0] === 'M') inner.moveTo(o[1], o[2]);
          else if (o[0] === 'L') inner.lineTo(o[1], o[2]);
          else if (o[0] === 'Q') inner.quadraticCurveTo(o[1], o[2], o[3], o[4]);
          else if (o[0] === 'C') inner.bezierCurveTo(o[1], o[2], o[3], o[4], o[5], o[6]);
        }
        if (sub.closed) inner.closePath();
      }
      inner.clip();
    };
    S.drawn = () => drawn;
    return S;
  }

  return { surface, CHANNELS, NONE, anyOn, toned };
}));
