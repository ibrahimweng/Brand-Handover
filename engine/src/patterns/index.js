/* The pattern engine.

   A registry of generators and one way to ask any of them for a tile. Each
   generator is a paint function and a list of controls; nothing here knows what
   any of them draws.

   `derive` is where an identity becomes its own pattern. Every default comes
   off the artwork — see mark.js for the three measurements and why those three
   — so dropping a different logo in gives a different pattern rather than the
   same pattern in different colours, and the manual can print the arithmetic
   beside the result.

   `tile` is the one call the rest of the engine makes. It hands back the SVG,
   the parameters it used and the reasoning, so a package carries the recipe for
   its own artwork and a rebuild returns the same bytes. */
//
// UMD, and two of its five dependencies are asked for late on purpose.
// `mark.js` parses SVG and `seam.js` rasterises it, and both reach for packages
// that only exist in Node. The studio in the package runs in a browser, and it
// does not need either — the measurements arrive already taken, in brand.json.
// So they are required at the moment they are used, and this file loads either
// side.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./surface'), require('./palette'),
      require('./generators/weave'), require('./generators/zigzag'),
      (name) => require(`./${name}`));
  } else {
    root.PatternEngine = factory(root.PatternSurface, root.PatternPalette,
      root.PatternWeave, root.PatternZigzag, () => null);
  }
}(typeof self !== 'undefined' ? self : this, function (surface, palette, weave, zigzag, late) {
  'use strict';

  const GENERATORS = { weave, zigzag };
  const NAMES = Object.keys(GENERATORS);

  // Which generator suits a mark that measures like this.
  //
  // Not a preference: a mark of straight lines and a fine stem has a lot of
  // detail to answer, and an index grid can carry detail that a stripe cannot. A
  // mark that is round and heavy has almost nothing to say at the density a grid
  // works at, and reads better as a stripe. The rule is one line and it is
  // checkable, which is the most that should be claimed for it.
  function suits(m) {
    return m.curviness > 0.5 || m.fineness < 16 ? 'zigzag' : 'weave';
  }

  // The parameters this identity's own artwork asks for.
  //
  // One rule sets the scale of both generators, and it is the same rule the
  // minimum size is: **the pattern never draws anything finer than twice the
  // thinnest thing in the mark**. A mark is 36 of its own narrowest runs across;
  // a pattern of its is at most 18 of anything across. That way a pattern printed
  // beside the mark, at the size the mark's own floor allows, still holds — the
  // pattern cannot be the thing that fails first, which is what a client would
  // otherwise discover on a press.
  //
  // The first version of this said "about three stems wide" and it was a number
  // with no argument behind it. It also gave a mark of ten stems a tile with four
  // stripes in it.
  const FINEST = 2;
  const scaleFrom = (m) => Math.max(2, m.fineness / FINEST);
  // A tile with fewer than four stripes across is a flag, not a pattern; one with
  // more than thirty-three is a texture. Both are judgements about what the word
  // means rather than measurements, so they are named and kept apart from the
  // rule that is measured.
  const COARSEST_STRIPE = 0.25;
  const FINEST_STRIPE = 0.03;

  // Which of a generator's styles suits a mark that measures like this.
  //
  // Two axes, because two things were measured: how fine the drawing is and how
  // much of it is curved. Every style is reachable, which is the point — a rule
  // that sent nine identities in ten to the same style would be the fault this
  // engine exists to fix, in a new place.
  const WEAVE_STYLES = [
    //  angular        mixed         round
    ['basket', 'cross', 'diamond'],       // coarse
    ['plaid', 'steps', 'gingham'],        // medium
    ['bands', 'dither', 'dither'],        // fine
  ];
  const ZIGZAG_STYLES = [
    ['chevron', 'stairs', 'scales'],      // wider than tall
    ['teeth', 'ricrac', 'waves'],         // square or upright
  ];
  const bandOf = (v, edges) => { let i = 0; while (i < edges.length && v > edges[i]) i++; return i; };

  function derive(generator, m) {
    const curve = bandOf(m.curviness, [0.33, 0.66]);
    if (generator === 'weave') {
      // Rounded *down* to a multiple of four, never up: rounding up makes the
      // cells finer than the rule allows, and the rule is the whole argument.
      const cells = Math.max(8, Math.min(72, Math.floor(scaleFrom(m) / 4) * 4));
      return {
        cells,
        // A round mark gets a coarser motif, because a fine motif made of
        // rectangles fights a drawing made of arcs.
        chunk: Math.round((0.7 + m.curviness * 0.8) * 20) / 20,
        style: WEAVE_STYLES[bandOf(m.fineness, [20, 40])][curve],
        seed: 1,
      };
    }
    // Rounded *up* to the nearest two-hundredth: a stripe rounded down is finer
    // than the mark allows.
    //
    // And then capped, which is the one place the scale rule is overruled and it
    // is overruled out loud. A very heavy mark — spire is seven of its own runs
    // across — would be allowed a stripe of 27% of the tile, and a tile with
    // three and a half stripes in it is not a pattern, it is a flag. COARSEST is
    // the floor on how few stripes will do, and where it binds, `why` says the
    // cap decided rather than the mark.
    const wanted = Math.ceil((1 / scaleFrom(m)) * 200) / 200;
    const stripe = Math.max(FINEST_STRIPE, Math.min(COARSEST_STRIPE, wanted));
    return {
      stripe,
      depth: 0.9,
      length: Math.max(0.05, Math.min(0.4, Math.round(stripe * 1.6 * 100) / 100)),
      // Straight artwork gets corners, round artwork gets none.
      rounding: Math.round(m.curviness * 100) / 100,
      style: ZIGZAG_STYLES[m.aspect > 2 ? 0 : 1][curve],
    };
  }

  // Why it chose that, in the words a manual prints.
  function because(generator, m, params) {
    const round = `${Math.round(m.curviness * 100)}% of the drawing's outline is curved`;
    const fine = `the mark is ${m.fineness.toFixed(1)} of its own narrowest runs across, `
      + `so nothing here is drawn finer than ${(m.fineness / FINEST).toFixed(1)} of anything`;
    if (generator === 'weave') {
      return `${fine} — ${params.cells} cells. And ${round}, so the motif is ${params.style}.`;
    }
    const capped = params.stripe >= COARSEST_STRIPE && 1 / scaleFrom(m) > COARSEST_STRIPE;
    const scale = capped
      ? `the mark is heavy enough to allow a stripe of ${((1 / scaleFrom(m)) * 100).toFixed(0)}% of the tile, `
        + `which would leave under four of them, so it is held at ${(COARSEST_STRIPE * 100).toFixed(0)}%`
      : `${fine} — a stripe is ${(params.stripe * 100).toFixed(1)}% of the tile`;
    return `${scale}. And ${round}, so the corners are rounded ${Math.round(params.rounding * 100)}%.`;
  }

  // One tile, as SVG.
  function tile(opts) {
    const o = opts || {};
    const m = o.mark || late('mark').read(o.markSource, o.measured, o.rules);
    const generator = GENERATORS[o.generator] ? o.generator : suits(m);
    const g = GENERATORS[generator];
    const params = Object.assign(derive(generator, m), o.params || {});
    const pal = o.palette || palette.of(o.colours, o.colourway);
    const W = o.size || 100, H = o.size || 100;
    const s = surface.svg({ width: W, height: H, id: o.id || generator });
    g.paint(s, W, H, params, pal);
    return {
      generator, params, why: because(generator, m, params), mark: m,
      palette: { ground: pal.ground, inks: pal.inks.map((i) => i.hex) },
      tile: s.toSVG(),
      body: s.body(),
      // the same paint, for anything that wants to draw it rather than read it
      paint: (surf, w, h) => g.paint(surf, w, h, params, pal),
    };
  }

  // What a tile does when it is laid next to itself. Reported, not asserted:
  // `beyond` at or under 1 means there is nothing at the join the pattern does
  // not do elsewhere. See seam.js.
  const joins = (t, opts) => late('seam').check(t.paint, opts && opts.size ? opts.size : 100,
    opts && opts.size ? opts.size : 100, opts);
  // Measuring a mark needs an SVG parser, so it is Node's alone. The browser is
  // handed what this already worked out rather than working it out again.
  const read = (markSource, measured, rules) => late('mark').read(markSource, measured, rules);

  return { GENERATORS, NAMES, suits, derive, because, tile, joins, read,
    FINEST, COARSEST_STRIPE, FINEST_STRIPE, WEAVE_STYLES, ZIGZAG_STYLES };
}));
