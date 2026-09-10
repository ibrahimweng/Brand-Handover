/* One drawing function, three places to draw it.

   PLAYGRND's whole architecture is one line: `paint(ctx, W, H, frame)` draws a
   complete picture and is pure with respect to its state and its seed, and the
   screen preview, the export at any size and the vector recorder all call that
   same function. The raster and the vector cannot drift, because there is only
   one of them.

   This is that, with the surfaces this product needs. A generator is written
   against the small subset of the 2-D canvas API below and never asks which
   surface it has.

     canvas(ctx)   a real 2-D context — the studio's preview and its PNG export
     svg(opts)     records the same calls as SVG elements — the build, in Node

   The SVG surface bakes the current transform into the coordinates it emits
   instead of writing `transform` attributes. A pattern tile is a file somebody
   opens in Illustrator and recolours; nested transforms are the reason that is
   usually miserable. Flat coordinates cost nothing to compute and the tile
   comes out as a list of shapes at the places they appear.

   What a generator may use, and nothing else:

     save restore · translate rotate scale · beginPath moveTo lineTo
     quadraticCurveTo bezierCurveTo arc closePath · fill stroke clip · fillRect
     fillStyle strokeStyle lineWidth lineCap lineJoin globalAlpha

   Anything a generator needs beyond that gets added here, to both surfaces, or
   it is not in the contract. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PatternSurface = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Three decimals is the resolution the rest of this engine rounds to
  // (src/svg.js), and it is well under a printer's addressable dot at any size
  // a pattern is used. Trailing zeros are dropped because a tile has thousands
  // of numbers in it and they are all file size.
  const R = (n) => {
    if (!isFinite(n)) return '0';
    const v = Math.round(n * 1000) / 1000;
    return Object.is(v, -0) ? '0' : String(v);
  };
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // ---------------------------------------------------------------- transform
  // [a b c d e f], the same six numbers SVG and canvas both use:
  //   x' = a·x + c·y + e      y' = b·x + d·y + f
  const IDENTITY = [1, 0, 0, 1, 0, 0];
  // m then n, with n applied first — so translate() then rotate() rotates about
  // the translated origin, which is what a canvas does.
  const mul = (m, n) => [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  // How much the transform scales a length. A stroke is one width in user space
  // and this surface has already baked the transform into the coordinates, so
  // the width has to be scaled by hand. Under a non-uniform scale there is no
  // one answer; the square root of the determinant is the one that preserves
  // the area of the stroked band, which is what the eye reads as weight.
  const lengthScale = (m) => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;
  const axisAligned = (m) => Math.abs(m[1]) < 1e-9 && Math.abs(m[2]) < 1e-9;

  // ------------------------------------------------------------- arc to bezier
  // A circular arc in ninety-degree pieces. k is the standard constant for a
  // quarter turn; at ninety degrees the error is about one part in ten
  // thousand of the radius, which at any size this prints is nothing.
  function arcSegments(cx, cy, r, a0, a1, ccw) {
    let sweep = a1 - a0;
    if (ccw) { while (sweep > 0) sweep -= 2 * Math.PI; if (sweep < -2 * Math.PI) sweep = -2 * Math.PI; }
    else { while (sweep < 0) sweep += 2 * Math.PI; if (sweep > 2 * Math.PI) sweep = 2 * Math.PI; }
    const n = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2)));
    const step = sweep / n;
    const k = (4 / 3) * Math.tan(step / 4);
    const out = [];
    let a = a0;
    for (let i = 0; i < n; i++) {
      const b = a + step;
      const c0 = Math.cos(a), s0 = Math.sin(a), c1 = Math.cos(b), s1 = Math.sin(b);
      out.push([
        cx + r * (c0 - k * s0), cy + r * (s0 + k * c0),
        cx + r * (c1 + k * s1), cy + r * (s1 - k * c1),
        cx + r * c1, cy + r * s1]);
      a = b;
    }
    return { segments: out, start: [cx + r * Math.cos(a0), cy + r * Math.sin(a0)] };
  }

  // ------------------------------------------------------------- the recorder
  function svg(opts) {
    const o = opts || {};
    const W = o.width == null ? 100 : o.width;
    const H = o.height == null ? 100 : o.height;
    const prefix = o.id ? String(o.id) : 'p';
    const out = [];          // emitted elements, in order
    const open = [];         // currently open <g> wrappers, innermost last
    let ctm = IDENTITY.slice();
    let path = [];           // the current path, already transformed
    let start = null;        // subpath start, for closePath
    let here = null;         // current point
    let clipId = 0;
    const stack = [];

    const S = {
      width: W, height: H,
      fillStyle: '#000000', strokeStyle: '#000000',
      lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', globalAlpha: 1,
    };

    const push = (markup) => out.push(markup);
    const alpha = (attr) => (S.globalAlpha >= 1 ? '' : ` ${attr}="${R(S.globalAlpha)}"`);

    S.save = () => {
      stack.push({ ctm: ctm.slice(), open: open.length,
        fillStyle: S.fillStyle, strokeStyle: S.strokeStyle, lineWidth: S.lineWidth,
        lineCap: S.lineCap, lineJoin: S.lineJoin, globalAlpha: S.globalAlpha });
    };
    S.restore = () => {
      const s = stack.pop();
      if (!s) return;
      while (open.length > s.open) { push('</g>'); open.pop(); }
      ctm = s.ctm; S.fillStyle = s.fillStyle; S.strokeStyle = s.strokeStyle;
      S.lineWidth = s.lineWidth; S.lineCap = s.lineCap; S.lineJoin = s.lineJoin;
      S.globalAlpha = s.globalAlpha;
    };
    S.translate = (x, y) => { ctm = mul(ctm, [1, 0, 0, 1, x, y]); };
    S.scale = (x, y) => { ctm = mul(ctm, [x, 0, 0, y == null ? x : y, 0, 0]); };
    S.rotate = (rad) => {
      const c = Math.cos(rad), s = Math.sin(rad);
      ctm = mul(ctm, [c, s, -s, c, 0, 0]);
    };

    S.beginPath = () => { path = []; start = null; here = null; };
    S.moveTo = (x, y) => { const p = apply(ctm, x, y); path.push(`M${R(p[0])} ${R(p[1])}`); start = p; here = p; };
    S.lineTo = (x, y) => {
      const p = apply(ctm, x, y);
      if (!here) { S.moveTo(x, y); return; }
      path.push(`L${R(p[0])} ${R(p[1])}`); here = p;
    };
    S.quadraticCurveTo = (cx, cy, x, y) => {
      const c = apply(ctm, cx, cy), p = apply(ctm, x, y);
      if (!here) S.moveTo(cx, cy);
      path.push(`Q${R(c[0])} ${R(c[1])} ${R(p[0])} ${R(p[1])}`); here = p;
    };
    S.bezierCurveTo = (c1x, c1y, c2x, c2y, x, y) => {
      const a = apply(ctm, c1x, c1y), b = apply(ctm, c2x, c2y), p = apply(ctm, x, y);
      if (!here) S.moveTo(c1x, c1y);
      path.push(`C${R(a[0])} ${R(a[1])} ${R(b[0])} ${R(b[1])} ${R(p[0])} ${R(p[1])}`); here = p;
    };
    S.closePath = () => { if (path.length) { path.push('Z'); here = start; } };
    S.arc = (cx, cy, r, a0, a1, ccw) => {
      const a = arcSegments(cx, cy, r, a0, a1, !!ccw);
      const s = apply(ctm, a.start[0], a.start[1]);
      // A canvas joins to an arc's start with a straight line when a path is
      // already open, and moves there when it is not. Same here, or a ring
      // drawn as two arcs comes out as two separate strokes.
      if (here) path.push(`L${R(s[0])} ${R(s[1])}`); else path.push(`M${R(s[0])} ${R(s[1])}`);
      if (!start) start = s;
      for (const g of a.segments) {
        const p1 = apply(ctm, g[0], g[1]), p2 = apply(ctm, g[2], g[3]), p3 = apply(ctm, g[4], g[5]);
        path.push(`C${R(p1[0])} ${R(p1[1])} ${R(p2[0])} ${R(p2[1])} ${R(p3[0])} ${R(p3[1])}`);
        here = p3;
      }
    };
    S.rect = (x, y, w, h) => {
      S.moveTo(x, y); S.lineTo(x + w, y); S.lineTo(x + w, y + h); S.lineTo(x, y + h); S.closePath();
      here = null; start = null;
    };

    const d = () => path.join('');
    S.fill = (rule) => {
      if (!path.length) return;
      const fr = rule === 'evenodd' ? ' fill-rule="evenodd"' : '';
      push(`<path d="${d()}" fill="${esc(S.fillStyle)}"${fr}${alpha('fill-opacity')}/>`);
    };
    S.stroke = () => {
      if (!path.length) return;
      const w = S.lineWidth * lengthScale(ctm);
      const cap = S.lineCap === 'butt' ? '' : ` stroke-linecap="${esc(S.lineCap)}"`;
      const join = S.lineJoin === 'miter' ? '' : ` stroke-linejoin="${esc(S.lineJoin)}"`;
      push(`<path d="${d()}" fill="none" stroke="${esc(S.strokeStyle)}" stroke-width="${R(w)}"${cap}${join}${alpha('stroke-opacity')}/>`);
    };
    S.clip = () => {
      if (!path.length) return;
      const id = `${prefix}c${++clipId}`;
      push(`<clipPath id="${id}"><path d="${d()}"/></clipPath><g clip-path="url(#${id})">`);
      open.push(id);
    };

    // The one call that is not a path, because it is the one a grid generator
    // makes ten thousand times. Under an axis-aligned transform it stays a
    // <rect>, which is half the bytes of the equivalent path and the thing a
    // designer expects to find when they open the file.
    S.fillRect = (x, y, w, h) => {
      if (!(w > 0) || !(h > 0)) return;
      if (axisAligned(ctm)) {
        const p = apply(ctm, x, y), q = apply(ctm, x + w, y + h);
        const x0 = Math.min(p[0], q[0]), y0 = Math.min(p[1], q[1]);
        push(`<rect x="${R(x0)}" y="${R(y0)}" width="${R(Math.abs(q[0] - p[0]))}" height="${R(Math.abs(q[1] - p[1]))}" fill="${esc(S.fillStyle)}"${alpha('fill-opacity')}/>`);
        return;
      }
      const c = [apply(ctm, x, y), apply(ctm, x + w, y), apply(ctm, x + w, y + h), apply(ctm, x, y + h)];
      push(`<path d="M${R(c[0][0])} ${R(c[0][1])}L${R(c[1][0])} ${R(c[1][1])}L${R(c[2][0])} ${R(c[2][1])}L${R(c[3][0])} ${R(c[3][1])}Z" fill="${esc(S.fillStyle)}"${alpha('fill-opacity')}/>`);
    };

    // The finished tile. Anything a generator opened and forgot to close is
    // closed here rather than emitting a broken document.
    S.body = () => {
      const tail = [];
      for (let i = open.length - 1; i >= 0; i--) tail.push('</g>');
      return out.join('') + tail.join('');
    };
    S.toSVG = (attrs) => {
      const extra = attrs ? ' ' + attrs : '';
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${R(W)}" height="${R(H)}"`
        + ` viewBox="0 0 ${R(W)} ${R(H)}"${extra}>${S.body()}</svg>`;
    };
    return S;
  }

  // ---------------------------------------------------------------- the canvas
  // A real 2-D context already is this API. The wrapper exists so a generator
  // can be handed one object either way, so `width`/`height` read the same on
  // both, and so a call outside the contract fails here rather than working in
  // the studio and vanishing from the tile.
  const CONTRACT = ['save', 'restore', 'translate', 'rotate', 'scale', 'beginPath', 'moveTo',
    'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'arc', 'closePath', 'rect', 'fill', 'stroke',
    'clip', 'fillRect'];
  const STYLES = ['fillStyle', 'strokeStyle', 'lineWidth', 'lineCap', 'lineJoin', 'globalAlpha'];

  function canvas(ctx, width, height) {
    const S = { width: width == null ? ctx.canvas.width : width,
      height: height == null ? ctx.canvas.height : height, ctx };
    for (const m of CONTRACT) S[m] = ctx[m].bind(ctx);
    for (const p of STYLES) {
      Object.defineProperty(S, p, {
        get: () => ctx[p], set: (v) => { ctx[p] = v; }, enumerable: true });
    }
    return S;
  }

  return { svg, canvas, CONTRACT, STYLES, mul, apply, lengthScale, arcSegments, round: R };
}));
