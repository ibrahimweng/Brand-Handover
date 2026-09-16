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
  /* The faintest an ink may be against the ground it is printed on.

     Not a readability standard. contrast.js puts 3:1 under "shapes" and that is
     the right bar for a thing somebody has to make out — an icon, a rule, a
     line of large type. A pattern is not that, and this engine ships tone-on-
     tone on purpose: the quiet lattice is a flat near-tone of the brand colour
     precisely so it can sit under a paragraph without fighting it.

     1.5:1 is a different claim. Below it two colours are the same *tone*, and a
     pattern drawn in one on the other has a shape that nobody can see in any
     light — not a soft pattern, an absent one. oriel's chalk colourway drew its
     weave at 1.02:1, which is the same luminance twice, and the tile was a flat
     rectangle written into the package under the name of a pattern.

     Measured before it was chosen: of the 108 identity-and-colourway pairs
     here, 18 carried an ink under 1.8:1 and 6 were under 1.5. Every generator
     inherited all of them — 684 of 4,104 tiles — because they all take this one
     palette, which is why the floor is here and not in thirty-eight places. */
  const FAINTEST = 1.5;

  function inksOn(colours, ground, faintest) {
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
    const floor = typeof faintest === 'number' ? faintest : FAINTEST;
    const keep = out.filter((i) => !(i.against < floor));
    // Never all of them. A palette whose every colour sits at the ground's own
    // tone is a real thing — a mono colourway of a two-tone identity — and the
    // answer there is the best one it has, not a blank sheet. The generator
    // still draws; the build still says what it dropped.
    return { inks: keep.length ? keep : out.slice(0, 1),
      dropped: keep.length ? out.filter((i) => i.against < floor) : out.slice(1) };
  }

  // What a generator is handed. `ink(i)` never runs out — it wraps — because a
  // generator asking for its fifth thread on a three-colour identity should draw
  // something rather than nothing, and a pattern that repeats its palette is a
  // pattern, not a fault.
  /* An ink the master paints with a gradient, in a colourway that keeps it.

     A colourway slot set to `keep` means "do not recolour this one" — it is the
     way a project says the artwork's own paint stands. Where that paint is a
     gradient, keeping it has to mean keeping the gradient, and until now it
     meant keeping the one flat hex the colour table lists beside it. On pagrin
     that is the whole point of the identity: the mark runs #FF5715 to #FFBADC
     to #2409FF at 137 degrees, and every pattern in the colourway named after
     it came out flat #0E0E0E.

     Never the ground. A gradient is written per shape so the tile still
     repeats; the sheet is one fill across the whole tile and a gradient on it
     would be a hard edge down every join. */
  function gradientInks(colours, colourway, ground, gradients) {
    const slots = (colourway && colourway.slots) || {};
    const out = {};
    for (const g of gradients || []) {
      const stops = (g && g.stops || []).filter((st) => st && st.hex);
      if (stops.length < 2) continue;
      for (const slot of g.slots || []) {
        if (slots[slot] !== 'keep') continue;
        const hex = hexOf((colours || {})[slot]);
        if (!hex) continue;
        const up = String(hex).toUpperCase();
        if (up === String(ground).toUpperCase()) continue;
        out[up] = { kind: g.kind || 'linear',
          // the direction the master runs it, where the master said
          angle: g.turn == null ? 0.125 : g.turn,
          stops: stops.map((st, i) => [st.offset == null
            ? (stops.length < 2 ? 0 : i / (stops.length - 1)) : st.offset, st.hex]) };
      }
    }
    return Object.keys(out).length ? out : null;
  }

  function of(colours, colourway, gradients) {
    const ground = groundOf(colours || {}, colourway);
    const read = inksOn(colours || {}, ground);
    const inks = read.inks;
    const list = inks.length ? inks : [{ name: 'ink', hex: contrast.luminance(ground) > 0.5 ? '#111111' : '#EFEFEF', against: 1 }];
    return {
      ground,
      inks: list,
      // hex -> the gradient the master paints that ink with, or null
      gradients: gradientInks(colours || {}, colourway, ground, gradients),
      // What this ground cost, so the build can say it rather than a client
      // finding a brand colour quietly missing from one colourway's patterns.
      dropped: read.dropped,
      count: list.length,
      ink: (i) => list[((i % list.length) + list.length) % list.length].hex,
      named: (i) => list[((i % list.length) + list.length) % list.length],
      // the two that are furthest apart, for a duotone generator
      pair: () => [ground, list[0].hex],
      // how well the ink a generator picked reads on the ground it picked
      reads: (hex) => contrast.ratio(hex, ground),
      /* The sheet, laid down — or not.

         Every generator starts by filling the whole tile with its ground, and
         that is right until somebody switches on a ground layer: eight of the
         nineteen effects paint the paper, and an opaque fill over the top of
         them made every one of them invisible while still costing its own
         weight in the file. The layer stack hands the generator a palette that
         says the paper is already down, and this is where that is read — once,
         rather than in thirty-three copies of the same two lines.

         It reads `this` rather than a captured flag so that a palette copied
         for an effect — `prism` turns the inks, `carve` tints them — carries
         the answer with it. */
      paper(surface, W, H, hex) {
        if (this.painted) return;
        surface.fillStyle = hex == null ? this.ground : hex;
        surface.fillRect(0, 0, W, H);
      },
    };
  }

  return { of, groundOf, inksOn, gradientInks, FAINTEST };
}));
