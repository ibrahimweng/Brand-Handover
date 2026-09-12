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
      require('./generators/lattice'),
      (name) => require(`./${name}`));
  } else {
    root.PatternEngine = factory(root.PatternSurface, root.PatternPalette,
      root.PatternWeave, root.PatternZigzag, root.PatternLattice, () => null);
  }
}(typeof self !== 'undefined' ? self : this, function (surface, palette, weave, zigzag, lattice, late) {
  'use strict';

  const GENERATORS = { lattice, weave, zigzag };
  const NAMES = Object.keys(GENERATORS);

  // Which generator suits a mark that measures like this.
  function suits(m, route) {
    // Two generators, and one axis between them.
    //
    // There were five. `terrace` made contour bands, `field` pixel
    // compositions, `thread` line fields, and all three are gone for the same
    // reason: each sampled a noise field, so each made a *texture* — something
    // that carries nothing of the identity that made it beyond three numbers.
    // What is left are the two that draw shapes: a cell grid and interlocking
    // stripes, both of which a client can see the reasoning in.
    //
    // Which makes this rule shorter than it has ever been. A mark with enough
    // detail to fill a grid gets a grid; one drawn in few heavy parts gets
    // stripes, because a grid of eight cells is a chequerboard and not a
    // pattern. The old rule keyed on curviness too and sent a curved mark to a
    // line field; there is no line field now, and `zigzag` answers curviness
    // with its own rounding rather than by being a different generator.
    //
    // On the motif route there is one answer, and for a while it was the wrong
    // one. `weave` draws the motif into the sparse pop cells of a cell grid: the
    // grid is most of the picture and the mark is a garnish scattered into it,
    // so a client asking for a pattern made of their logo got a check with
    // their logo hidden in it. `lattice` draws the shape and nothing else.
    //
    // `zigzag` is interlocking stripes and has no cell to put a shape in;
    // handing it one would produce a tile identical to the inspired route under
    // a name saying it is made of the client's logo. Both are still built and
    // still in the studio — a client who wants a weave or stripes can have
    // them, having been told what they give up.
    if (route === 'motif') return 'lattice';
    return m.fineness < 16 ? 'zigzag' : 'weave';
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
  // And the same argument at the other end, for the grids. A tile of more than
  // this many cells across is a texture rather than a pattern: at any size
  // anybody prints it, the cells are under a pixel and it reads as static.
  //
  // It binds on exactly the two identities the floor work found have hairlines
  // carrying almost none of their ink — pagrin at 167 of its own narrowest runs
  // across, hallward at 267. The pattern engine inherits that problem from the
  // same measurement, and the cap is what stops it becoming a tile nobody can
  // see. Where it binds, `why` says the cap decided and not the mark, because
  // the alternative is a client wondering why their pattern is grey.
  const COARSEST_GRID = 72;
  // What share of the tile one motif may be. Method A's band, kept because the
  // argument for it holds: under a sixth and the shape competes with the logo
  // it was cut from at the size a cover prints it; over a quarter and the sheet
  // is a row of logos rather than a pattern.
  const MOTIF_SMALLEST = 0.15;
  const MOTIF_LARGEST = 0.25;
  // Where a shape stops being its own mirror.
  //
  // Measured across this repository: sixteen shapes at or under 0.621, and
  // seventeen at or over 0.743, with nothing between. A 0.122 gap, and the bar
  // sits in the middle of it.
  //
  // It is not the *widest* gap in the measurement — that is 0.153, down at
  // 0.223 — and the wider one is in the wrong place. A shape scoring 0.30
  // matches its own mirror over less than a third of its outline, and a bar
  // below that would call it symmetric and stop flipping it. The question here
  // is whether mirroring alternate rows does anything a client can see, and
  // that divides where these two clusters divide.
  const SYMMETRIC = 0.68;
  // And a floor at the other end, for the same kind of reason. A blanket of
  // six cells is a flag and a field of eight is a chequerboard; below these
  // there is no pattern left to be a pattern. Where the floor binds, the mark
  // would have allowed something coarser still, and `why` says so.
  const LEAST_WEAVE = 8;

  // Which of a generator's styles suits a mark that measures like this.
  //
  // Two axes, because two things were measured: how fine the drawing is and how
  // much of it is curved. Every style is reachable, which is the point — a rule
  // that sent nine identities in ten to the same style would be the fault this
  // engine exists to fix, in a new place.
  // Weave has fourteen styles and two axes give nine slots, so the third one
  // the mark is measured on — how wide it is against how tall — is used here
  // as it already is for zigzag. Eighteen slots, fourteen styles, every one of
  // them reached: `dither` used to fill two cells of the grid because there
  // was nothing else to put there, and a style nothing reaches is a style the
  // package does not really have.
  const WEAVE_STYLES = [
    [ //  angular      mixed        round          — a wide mark
      ['tabs', 'basket', 'rings'],        // coarse
      ['steps', 'zigzag', 'waves'],       // medium
      ['bands', 'dither', 'gingham'],     // fine
    ],
    [ //  angular      mixed        round          — a square or upright mark
      ['cross', 'diamond', 'burst'],      // coarse
      ['plaid', 'zigzag', 'star'],        // medium
      ['bands', 'dither', 'gingham'],     // fine
    ],
  ];
  const ZIGZAG_STYLES = [
    ['chevron', 'stairs', 'scales'],      // wider than tall
    ['teeth', 'ricrac', 'waves'],         // square or upright
  ];
  const bandOf = (v, edges) => { let i = 0; while (i < edges.length && v > edges[i]) i++; return i; };

  // What the three routes mean.
  //
  //   literal    the pattern is the mark's own shapes, repeated. `pattern.js`
  //              does this and has since the first round; nothing here is
  //              involved.
  //   motif      a generated structure whose cells hold the mark's own shape.
  //              The default, because it is the only one of the three that is
  //              both made of the identity and not simply a repeat of it.
  //   inspired   generated from what the mark measures — how fine it is, how
  //              much of it curves, how wide against tall — and drawn in new
  //              geometry. The furthest from the logo, and the most room to
  //              make something that stands on its own.
  //
  // Only the last two reach this file, and they differ in one thing: whether
  // the cells carry the mark. Everything else a generator does is the same.
  const ROUTES = ['literal', 'motif', 'inspired'];
  const ROUTE_DEFAULT = 'motif';

  function derive(generator, m, route, motif) {
    // First, and before anything is read off the mark: the lattice tiles the
    // shape cut out of the drawing and takes every number from that shape. It
    // is the one generator here with no opinion about the mark as a whole.
    if (generator === 'lattice') return latticeFrom(motif);
    const curve = bandOf(m.curviness, [0.33, 0.66]);
    const scale = scaleFrom(m);
    const wantsMotif = (route || ROUTE_DEFAULT) === 'motif';
    if (generator === 'weave') {
      const cells = Math.max(LEAST_WEAVE, Math.min(COARSEST_GRID, Math.floor(scale / 4) * 4));
      return { cells,
        chunk: Math.round((0.7 + m.curviness * 0.8) * 20) / 20,
        style: WEAVE_STYLES[m.aspect > 2 ? 0 : 1][bandOf(m.fineness, [20, 40])][curve],
        seed: 1 };
    }
    // Rounded *up* to the nearest two-hundredth: a stripe rounded down is finer
    // than the mark allows.
    //
    // And then capped, which is the one place the scale rule is overruled and
    // it is overruled out loud. A very heavy mark would be allowed a stripe of
    // 27% of the tile, and a tile with three and a half stripes in it is not a
    // pattern, it is a flag.
    const wanted = Math.ceil((1 / scale) * 200) / 200;
    const stripe = Math.max(FINEST_STRIPE, Math.min(COARSEST_STRIPE, wanted));
    // How deep the tooth cuts, from how broadly the mark turns.
    //
    // This was the number 0.9, for every identity in the repository. Stripe
    // came off the scale rule and rounding off curviness, and depth — which is
    // most of what a zigzag looks like — came off nothing at all.
    //
    // A mark that turns inside a couple of its own stems is making tight,
    // worked gestures and wants a tooth that cuts; one that turns over six or
    // more is making broad ones and wants a tooth that leans. Six stems is
    // where this repository's drawings stop getting rounder: carrock turns at
    // 4.2 and reads as circles, winterbourne at 8.9 and reads as a single
    // sweep, and past that the difference is no longer visible in a stripe.
    const sweep = Math.max(0, Math.min(1, m.turn / 6));
    return {
      stripe,
      depth: Math.round((1.15 - sweep * 0.55) * 100) / 100,
      length: Math.max(0.05, Math.min(0.4, Math.round(stripe * 1.6 * 100) / 100)),
      rounding: Math.round(m.curviness * 100) / 100,
      style: ZIGZAG_STYLES[m.aspect > 2 ? 0 : 1][curve],
    };
  }

  // Why it chose that, in the words a manual prints.
  // What the chosen shape asks of the lattice it is laid on.
  //
  // Everything here is measured off the *motif*, not off the mark, because the
  // motif is what is tiled. A mark can be an intricate crest and the shape cut
  // out of it a single bar; spacing the bar by the crest's numbers would be
  // measuring one thing to draw another.
  //
  // A motif that could not be read falls back to numbers in the middle of each
  // range rather than refusing: the generator is still offered in the studio,
  // where a client can point it at a different shape.
  function latticeFrom(mo) {
    const o = mo || {};
    const ink = typeof o.ink === 'number' ? o.ink : 0.3;
    const simple = typeof o.simple === 'number' ? o.simple : 0.4;
    const symmetry = typeof o.symmetry === 'number' ? o.symmetry : 0.5;
    const grain = typeof o.grain === 'number' ? o.grain : 0.3;
    return {
      // Size, from how much drawing it takes. Method A puts a motif between a
      // sixth and a quarter of the sheet and the band is worth keeping: below
      // it the shape competes with the logo it came from, above it the sheet is
      // a row of logos. Where in the band comes from complexity — a shape of
      // two moves reads at the bottom of it, one of twenty-four needs the top
      // or it turns to grit.
      scale: Math.round((MOTIF_SMALLEST + (1 - simple) * (MOTIF_LARGEST - MOTIF_SMALLEST)) * 1000) / 1000,
      // Spacing, from how much of its own box the shape inks. A disc inking
      // four fifths of its box and a chevron inking a fifth are a dense field
      // and an airy sheet at the same gap; this is the number that tells them
      // apart, and `pattern.js` already measured it.
      gap: Math.round((0.2 + ink * 1.2) * 100) / 100,
      // Whether the rows drop, from whether the shape runs one way.
      //
      // Three positions rather than a continuous slide: a grid, a third-drop
      // and a half-drop are what this layout has ever been, and a drop of 13%
      // reads as a grid somebody got wrong. The upper bar sits in a real gap —
      // nothing in this repository measures between 0.50 and 0.60. The lower
      // one does not: the shapes run 0.17, 0.21 continuously through there, and
      // it is placed rather than found. Getting it wrong costs a third-drop
      // where a grid would do, which is a look and not a fault.
      drop: grain >= 0.55 ? 0.5 : grain >= 0.18 ? 0.33 : 0,
      // Mirroring, from whether the shape is its own mirror. A symmetric shape
      // flipped is the same shape, so the control would do nothing and the
      // sheet would look as though it had been forgotten. The bar sits in the
      // widest gap in the measurement: 0.48 to 0.81, with nothing between.
      // ...and never where mirroring would reverse lettering, whatever the
      // symmetry says. A word is not symmetric, so this rule would otherwise
      // flip every wordmark in the repository.
      flip: (o.mirrorable === 0 || symmetry >= SYMMETRIC) ? 'none' : 'rows',
      // The mark is drawn at the angle its designer drew it at, and a lattice
      // is not the place to overrule that. A control, not a derivation.
      turn: 0,
      // Every effect off. A pattern that arrives already rounded, extruded or
      // glitched is a decision made on somebody's behalf about their own logo;
      // these are the client's to reach for, in the studio, over the top of a
      // pattern that first shows them the shape as it was drawn.
      radius: 0, extrude: 0, extrudeAngle: 45, glitch: 0, jitter: 0,
      intensity: 'bold', seed: 1 };
  }

  function because(generator, m, params) {
    // What this says changed with what it measures. It used to say "X% of the
    // drawing's outline is curved", off a count of path command letters; it is
    // the share of the drawing's *turning* that happens on a curve, which is
    // both what is measured and the thing a client can check by looking.
    const round = m.turned
      ? `${Math.round(m.curviness * 100)}% of the drawing's turning happens on a curve rather than at a corner`
      : 'nothing in the drawing turns — its strokes never meet — so it is read as cornered';
    const fine = `the mark is ${m.fineness.toFixed(1)} of its own narrowest runs across, `
      + `so nothing here is drawn finer than ${(m.fineness / FINEST).toFixed(1)} of anything`;
    // Where a cap decided instead of the mark, it says so. A mark with a
    // hairline in it asks for a grid nobody could see, and a client should be
    // told that rather than left wondering why their pattern is grey.
    const capped = (limit) => Math.floor(scaleFrom(m) / 4) * 4 > limit;
    const floored = (limit) => Math.floor(scaleFrom(m) / 4) * 4 < limit;
    if (generator === 'lattice') {
      const mo = params.motif || {};
      const shape = mo.name ? `"${mo.name}"` : 'the shape cut out of the drawing';
      const laid = params.drop >= 0.5 ? 'the rows half-drop'
        : params.drop > 0 ? 'the rows third-drop' : 'the rows line up';
      return `${shape} inks ${Math.round((mo.ink || 0) * 100)}% of its own box, `
        + `so it is spaced ${Math.round(params.gap * 100)}% of its width apart, and takes `
        + `${mo.moves || 0} moves to draw, so it is ${Math.round(params.scale * 100)}% of the tile. `
        + `It ${(mo.grain || 0) >= 0.18 ? 'runs one way' : 'runs no particular way'}, so ${laid}; `
        + `and it is ${(mo.symmetry || 0) >= SYMMETRIC ? 'its own mirror, so nothing is flipped'
          : 'not its own mirror, so alternate rows are'}.`;
    }
    if (generator === 'weave') {
      if (floored(LEAST_WEAVE)) {
        return `the mark is heavy enough to allow a blanket of ${Math.floor(scaleFrom(m) / 4) * 4} cells, `
          + `which is a flag rather than a pattern, so it is held at ${params.cells}. `
          + `And ${round}, so the motif is ${params.style}.`;
      }
      if (capped(COARSEST_GRID)) {
        return `the mark is ${m.fineness.toFixed(0)} of its own narrowest runs across, which would `
          + `ask for a grid of ${Math.floor(scaleFrom(m) / 4) * 4} — finer than anything anybody `
          + `prints. It is held at ${params.cells} cells. And ${round}, so the motif is ${params.style}.`;
      }
      return `${fine} — ${params.cells} cells. And ${round}, so the motif is ${params.style}.`;
    }
    const heldWide = params.stripe >= COARSEST_STRIPE && 1 / scaleFrom(m) > COARSEST_STRIPE;
    const scale = heldWide
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
    const route = ROUTES.indexOf(o.route) > -1 ? o.route : ROUTE_DEFAULT;
    // The motif travels with the parameters, because that is what it is: the
    // shape this pattern is made of, recorded in brand.json beside the numbers
    // so the studio and a rebuild a year later both draw the same thing.
    const carries = !!g.motif;
    // A generator that is nothing but the motif cannot be built without one.
    //
    // `paint` fills the ground and returns, which is a blank sheet written into
    // the package under a name saying it is made of the client's logo. The
    // build catches this and turns it into a warning naming the generator,
    // which is what a designer needs to see; a blank SVG is what they would
    // otherwise find months later.
    if (g.needsMotif && !o.motif) {
      throw new Error(`${generator} draws nothing but the mark's own shape, and no shape `
        + 'could be read out of this drawing');
    }
    const params = Object.assign(derive(generator, m, route, o.motif),
      o.motif && carries ? { motif: o.motif } : {}, o.params || {});
    const pal = o.palette || palette.of(o.colours, o.colourway);
    const W = o.size || 100, H = o.size || 100;
    const s = surface.svg({ width: W, height: H, id: o.id || generator });
    g.paint(s, W, H, params, pal);
    return {
      generator, params, route, mark: m,
      // Whether this tile is actually made of the identity's shape, rather than
      // whether it was asked to be.
      motif: !!(o.motif && carries && (route === 'motif' || o.params && o.params.motif)),
      why: because(generator, m, params),
    vector: !!g.vector, pal,
      palette: { ground: pal.ground, inks: pal.inks.map((i) => i.hex) },
      tile: s.toSVG(),
      body: s.body(),
      // the same paint, for anything that wants to draw it rather than read it
      paint: (surf, w, h) => g.paint(surf, w, h, params, pal),
    };
  }

  // There was a `sheet` here, and a raster generator for it to serve.
  //
  // `terrace` decided per pixel and shipped a PNG at a size the package stated,
  // with `printedAt` saying what that size was worth in millimetres. All of it
  // is gone with the generator. Every pattern this engine makes is vector now,
  // which is one fewer thing for a client to be told about their own artwork:
  // no file has a size beyond which it stops being sharp.
  //
  // `raster.js` stays — eight other modules measure through it — and if a
  // raster generator is ever wanted again, this is what it needs back.

  // What a tile does when it is laid next to itself. Reported, not asserted:
  // `beyond` at or under 1 means there is nothing at the join the pattern does
  // not do elsewhere. See seam.js.
  const joins = (t, opts) => late('seam').check(t.paint, opts && opts.size ? opts.size : 100,
    opts && opts.size ? opts.size : 100, opts);
  // Measuring a mark needs an SVG parser, so it is Node's alone. The browser is
  // handed what this already worked out rather than working it out again.
  const read = (markSource, measured, rules) => late('mark').read(markSource, measured, rules);

  return { GENERATORS, NAMES, ROUTES, ROUTE_DEFAULT, suits, derive, because, tile, joins, read,
    latticeFrom, FINEST, COARSEST_STRIPE, FINEST_STRIPE, COARSEST_GRID, LEAST_WEAVE,
    MOTIF_SMALLEST, MOTIF_LARGEST, SYMMETRIC,
    WEAVE_STYLES, ZIGZAG_STYLES };
}));
