/* Colour arithmetic a generator is allowed to do to its own palette.

   `palette.js` decides which colour is the ground and which is the first ink;
   that is a decision about the identity and it is made once. This is the other
   half — what a generator may do to a colour it has already been given, when
   the composition needs two of something and the palette has one.

   It exists because three generators wrote their own `mix` and a fourth was
   about to. Worse, `relief` needs more than a mix: an isometric block has three
   faces from one paint, and darkening alone turns an orange into brown. A brown
   face reads as dirt rather than as the same paint in shadow, so the ramp has to
   swing the hue about as much as it swings the lightness. That is colour
   science and it belongs in one file, not in a generator.

   Everything here is hex in, hex out, and none of it reaches for Node — the
   studio loads this in a browser and draws the same tiles the build wrote. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PatternTone = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hex2 = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');

  function rgb(hex) {
    const h = String(hex || '#000000').replace('#', '');
    const s = h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h;
    const n = parseInt(s.slice(0, 6), 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const hex = (r, g, b) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;

  // Two colours, t of the way from a to b.
  function mix(a, b, t) {
    const A = rgb(a), B = rgb(b), k = clamp(t, 0, 1);
    return hex(A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k);
  }

  // Rec. 709 relative luminance, on the raw channels rather than linearised.
  // `contrast.js` does the linearised one and is the thing that decides whether
  // a colour is legible; this one only ever decides which of two inks is the
  // darker, and for that ordering the two agree.
  const lum = (h) => { const c = rgb(h); return (c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722) / 255; };

  function toHSL(h) {
    const c = rgb(h).map((v) => v / 255);
    const mx = Math.max(c[0], c[1], c[2]), mn = Math.min(c[0], c[1], c[2]);
    const l = (mx + mn) / 2;
    if (mx === mn) return [0, 0, l];
    const d = mx - mn;
    const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    let hu;
    if (mx === c[0]) hu = ((c[1] - c[2]) / d + (c[1] < c[2] ? 6 : 0));
    else if (mx === c[1]) hu = (c[2] - c[0]) / d + 2;
    else hu = (c[0] - c[1]) / d + 4;
    return [hu * 60, s, l];
  }

  function fromHSL(h, s, l) {
    const hu = ((h % 360) + 360) % 360, sa = clamp(s, 0, 1), li = clamp(l, 0, 1);
    if (sa === 0) return hex(li * 255, li * 255, li * 255);
    const q = li < 0.5 ? li * (1 + sa) : li + sa - li * sa;
    const p = 2 * li - q;
    const ch = (t) => {
      let v = t; if (v < 0) v += 1; if (v > 1) v -= 1;
      if (v < 1 / 6) return p + (q - p) * 6 * v;
      if (v < 1 / 2) return q;
      if (v < 2 / 3) return p + (q - p) * (2 / 3 - v) * 6;
      return p;
    };
    return hex(ch(hu / 360 + 1 / 3) * 255, ch(hu / 360) * 255, ch(hu / 360 - 1 / 3) * 255);
  }

  /* Three faces of one block, from one paint.

     The lightness is clamped into the middle of the range first: a face ramp
     built from a colour that is already nearly black has nowhere to go down
     and comes out as three blacks, and one built from nearly white comes out
     as three whites. Then the ramp swings the hue about as far as it swings the
     lightness — warmer into the light, cooler into the shade — which is what
     stops the dark face reading as dirt.

     `spread` is the Relief control. At zero the three faces are one flat
     colour and the field reads as hexagons; at one they are as far apart as
     this will take them. */
  function faces(paint, spread) {
    const c = toHSL(paint);
    const l = clamp(c[2], 0.38, 0.62);
    const k = clamp(spread == null ? 0.9 : spread, 0, 1);
    const step = (dl, dh, ds) => fromHSL(c[0] + dh * k, clamp(c[1] + ds * k, 0, 1), l + dl * k);
    // top, left, right — lit, mid, shaded.
    return [step(0.16, 22, 0.06), step(0, 0, 0), step(-0.16, -22, 0.02)];
  }

  return { mix, lum, rgb, hex, toHSL, fromHSL, faces };
}));
