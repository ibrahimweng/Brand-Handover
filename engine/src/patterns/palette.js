/* The colours a pattern is allowed to use, and which is which.

   A generator asks for "the ground" and "three threads", not for #B4632A. That
   is not indirection for its own sake: the same generator has to draw the same
   pattern in every colourway a project declares, and the tile that comes out
   solid and the one that comes out reverse are the same arithmetic with the
   palette swapped.

   Roles come from the project's own colour table where it states them, and
   from measurement where it does not. `ground` is the sheet the pattern is
   printed on; the inks are everything else, ordered by how far each one is from
   that ground, so the first ink a generator reaches for is always the one that
   reads best on it. A generator that wants two colours gets the two that
   contrast most; one that wants seven gets seven and the last of them is the
   quietest.

   The ordering is a contrast ratio, not a hue preference. A palette that put
   its accent first because somebody typed it first would give every identity
   the same pattern in a different colour. */
//
// UMD, because the studio in the package runs this in a browser and a second
// copy of the role arithmetic would be a second thing to disagree with the
// tiles the build already wrote.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../contrast'));
  else root.PatternPalette = factory(root.HandoverContrast);
}(typeof self !== 'undefined' ? self : this, function (contrast) {
  'use strict';

  const hexOf = (v) => (typeof v === 'string' ? v : (v && v.hex) || null);

  // The sheet. A colourway names what it sits on; a project's colour table names
  // a ground; failing both, the lightest colour there is, because paper is
  // usually the lightest thing in a brand.
  function groundOf(colours, colourway) {
    if (colourway && colourway.on && colours[colourway.on]) return hexOf(colours[colourway.on]);
    for (const [, c] of Object.entries(colours)) if (c && c.role === 'ground') return hexOf(c);
    let best = null, bestL = -1;
    for (const [, c] of Object.entries(colours)) {
      const l = contrast.luminance(hexOf(c));
      if (l > bestL) { bestL = l; best = hexOf(c); }
    }
    return best || '#FFFFFF';
  }

  // Everything that is not the sheet, furthest from it first.
  //
  // Two colours that read the same against the ground are still two colours, so
  // nothing is dropped for being close to another ink — only for being the
  // ground itself, which would draw the pattern in the paper.
  function inksOn(colours, ground) {
    const seen = new Set([String(ground).toUpperCase()]);
    const out = [];
    for (const [name, c] of Object.entries(colours)) {
      const hex = hexOf(c);
      if (!hex) continue;
      const key = hex.toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ name, hex, role: c && c.role, against: contrast.ratio(hex, ground) });
    }
    out.sort((a, b) => b.against - a.against);
    return out;
  }

  // What a generator is handed. `ink(i)` never runs out — it wraps — because a
  // generator asking for its fifth thread on a three-colour identity should draw
  // something rather than nothing, and a pattern that repeats its palette is a
  // pattern, not a fault.
  function of(colours, colourway) {
    const ground = groundOf(colours || {}, colourway);
    const inks = inksOn(colours || {}, ground);
    const list = inks.length ? inks : [{ name: 'ink', hex: contrast.luminance(ground) > 0.5 ? '#111111' : '#EFEFEF', against: 1 }];
    return {
      ground,
      inks: list,
      count: list.length,
      ink: (i) => list[((i % list.length) + list.length) % list.length].hex,
      named: (i) => list[((i % list.length) + list.length) % list.length],
      // the two that are furthest apart, for a duotone generator
      pair: () => [ground, list[0].hex],
      // how well the ink a generator picked reads on the ground it picked
      reads: (hex) => contrast.ratio(hex, ground),
    };
  }

  return { of, groundOf, inksOn };
}));
