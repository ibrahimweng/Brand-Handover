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
//
// The generators arrive by name rather than as arguments.
//
// They used to be positional, and at fifteen the factory signature was three
// lines of the same word twice — once in the require list, once in the
// parameter list — and adding one meant editing four places in this header
// without the language checking that they lined up. At thirty-two it would be
// unreadable. The browser keeps its globals, because that is what a page of
// script tags gives you; this only asks for them by the same name.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./surface'), require('./palette'), require('./layers'),
      (name) => require(`./generators/${name}`), (name) => require(`./${name}`));
  } else {
    root.PatternEngine = factory(root.PatternSurface, root.PatternPalette, root.PatternLayers,
      (name) => root[`Pattern${name.charAt(0).toUpperCase()}${name.slice(1)}`], () => null);
  }
}(typeof self !== 'undefined' ? self : this, function (surface, palette, layers, load, late) {
  'use strict';

  /* The catalogue, in the order a studio should offer it.

     Three families and one registry. A pattern is a square tile that repeats, a
     poster is a composition that does not, and a texture is a tile that repeats
     but is drawn as a surface rather than as a structure — grain, dots, static,
     tissue. The third one is a judgement about what a client is being handed,
     not a difference in how anything is built: a texture goes on a cover as a
     ground and a pattern goes on it as a pattern.

     Every one of them draws something the client can see their own artwork in.
     That is the whole brief and it is the only thing this list is ordered by:
     the ones where the mark *is* the picture first, the ones where the mark is
     the figure in it second, the ones where the mark is the field it is grown
     from last. */
  const CATALOGUE = [
    // patterns — the mark, tiled
    'lattice', 'monogram', 'tartan', 'stripe', 'weave', 'zigzag', 'oddgrid', 'quilt', 'warp', 'vee',
    'sampler', 'relief',
    'whorl', 'sprig', 'terrazzo', 'damask', 'ornament', 'dynamic',
    'junction', 'tracery', 'screen', 'plate', 'strata', 'signage',
    // textures — the mark, as a surface
    'stipple', 'atlas', 'mosh', 'pith',
    // posters — the mark, as a page
    'optic', 'modular', 'parcel', 'static', 'tokens', 'riso', 'totem', 'fete', 'kiosk', 'specimen',
  ];
  const GENERATORS = {};
  for (const name of CATALOGUE) {
    const g = load(name);
    if (g) GENERATORS[name] = g;
  }
  const NAMES = Object.keys(GENERATORS);

  /* Two families, one registry.

     A pattern is a square tile that repeats; a poster is a composition that
     does not. They want the same everything else — defaults measured off the
     artwork, controls in both studios, parameters in brand.json, one `paint`
     drawn by the canvas and the SVG writer alike — so they are one registry
     with a flag rather than two engines with two of everything.

     What the flag has to reach: `suits` must never answer a pattern question
     with a poster, the seam check must not ask a poster about a join it cannot
     have, and the build has to write each family where it belongs. Everything
     that reads `NAMES` without asking the kind is a place a poster will turn up
     where a pattern was meant. */
  const kindOf = (g) => (GENERATORS[g] && GENERATORS[g].kind) || 'pattern';
  // A texture tiles and is filed with the patterns; it is named apart because
  // the studio groups it apart and the manual calls it what it is.
  const TILING = (g) => kindOf(g) !== 'poster';
  const PATTERNS = NAMES.filter((g) => kindOf(g) === 'pattern');
  const TEXTURES = NAMES.filter((g) => kindOf(g) === 'texture');
  const POSTERS = NAMES.filter((g) => kindOf(g) === 'poster');
  // Width over height. A tile is square; a poster is whatever its own
  // composition wants, and the build cuts it at that proportion.
  const ratioOf = (g) => (GENERATORS[g] && GENERATORS[g].ratio) || 1;
  // Whether the thing repeats. Only a generator that says nothing is assumed
  // to tile, because every generator that existed before posters did.
  const tilesOf = (g) => (GENERATORS[g] ? GENERATORS[g].tiles !== false : true);

  /* What every control group is called, in one place.

     A group with no name prints its own key — "ground", "veins", "signal" —
     which reads as a variable somebody forgot to fill in. There were two copies
     of this map, one in each studio, and the second one was already a line
     behind the first: a generator added to the registry printed its headings in
     the package and its keys in the app, or the other way round.

     `pattern` is deliberately absent. Both studios already head that block with
     "Its controls" and a named heading there would open the same section twice. */
  const GROUPS = {
    lattice: 'The lattice', effect: 'Effects', poster: 'The page',
    ground: 'The ground', type: 'The type', treatment: 'Treatments', detail: 'Detail',
    cluster: 'Clusters', token: 'Tokens', border: 'The border', panel: 'The panel',
    core: 'The core', grid: 'The grid', blocks: 'The blocks',
    // the tiling tools
    mark: 'The mark', light: 'Light', tiles: 'The tiles', field: 'The field',
    stripes: 'The bands', warp: 'The warp', hand: 'The hand', dots: 'The dots',
    terrain: 'The terrain', cells: 'The cells', veins: 'Veins',
    signal: 'The signal', damage: 'Damage',
  };

  /* The generators the engine will *choose*, as opposed to the ones it offers.

     `suits` answers one question: which pattern does this mark's own
     measurements ask for, when nobody has said. It is the default a package
     opens on, and there are three answers to it.

     There are thirty-two generators. Twenty-nine of them are offered — built in
     every colourway, in both studios, with their parameters in brand.json — and
     none of them is ever the answer to that question. That is a decision and it
     is worth stating, because "a style nothing reaches is a style the package
     does not really have" is a rule this engine holds to elsewhere and this
     looks like a breach of it.

     It is not the same thing. A weave style nothing reaches appears nowhere at
     all: no file, no chip, no line in the manual. Every generator here appears
     in all three. What the client does not get is the engine *picking* a
     corrupted-signal texture or a botanical scatter as their brand's default
     pattern on the strength of a stroke-weight measurement. Two of those three
     answers were argued for at length (see `suits`); the third — `lattice`, the
     pattern that is the logo — is the one the brief asked for by name, and
     handing somebody a different one because their mark happens to be 19 stems
     across rather than 15 is not a measurement deciding, it is a lottery.

     So the set is declared rather than inferred, and the test asserts both
     halves: every member of it is reachable, and every generator outside it is
     still built and still offered. */
  const CHOSEN = NAMES.filter((g) => GENERATORS[g].chosen);

  // Which generator suits a mark that measures like this.
  function suits(m, route) {
    // A poster is not an answer to this question. It is asked for by name.
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
  /* The piecings, on the same three measurements everything else is chosen by.

     The first version keyed on whether the drawing turned at all and on the
     shape's symmetry, and it could only ever return one of the seven: the
     reachability sweep measures a mark on aspect, fineness and curviness alone,
     and neither of those two is one of them. A style the chooser cannot reach
     is a style the package does not really have — it is in the chip row, in the
     schema, and on nobody's sheet.

     Eighteen slots for seven piecings, every one of them reached. A cornered
     drawing gets a cornered block, a curved one a ringed block, and a wide one
     gets the piecings that run in bands rather than out from a centre. */
  const QUILT_STYLES = [
    [ //  angular       mixed         round          — a wide mark
      ['sawtooth', 'brick', 'cabin'],          // coarse
      ['bands', 'ninepatch', 'cabin'],         // medium
      ['bands', 'brick', 'diamond'],           // fine
    ],
    [ //  angular       mixed         round          — a square or upright mark
      ['star', 'diamond', 'cabin'],            // coarse
      ['sawtooth', 'ninepatch', 'star'],       // medium
      ['bands', 'diamond', 'cabin'],           // fine
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
    if (kindOf(generator) === 'poster') return posterFrom(generator, m, motif);
    if (PATTERN_FROM[generator]) return patternFrom(generator, m, motif);
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

  /* What a tiling composition asks of the artwork.

     The same discipline as `posterFrom` and `latticeFrom`, for the generators
     that repeat. Nothing here is a number describing "a pattern in general":
     every default comes off a measurement of the drawing, so a different logo
     gives a different tile rather than the same tile in different colours, and
     the manual can print the arithmetic beside the result.

     Two measurements do most of the work and they mean different things, so it
     is worth naming them once here rather than in twelve places:

       `m.fineness`  how many of its own narrowest runs the mark is across.
                     This sets **how finely anything is drawn** — the scale
                     rule, shared with weave and zigzag: a pattern never draws
                     anything finer than twice the thinnest thing in the mark.

       `mo.simple`   how much drawing the chosen shape takes. This sets **how
                     much room the shape needs to survive** — a bar reads at
                     fourteen cells and a ring with a counter in it needs
                     thirty. Getting these two the wrong way round is the
                     mistake `parcel` shipped and had to have taken back out. */
  const PATTERN_FROM = {};
  function patternFrom(generator, m, motif) {
    const mo = motif || {};
    const fine = m && m.fineness ? m.fineness : 24;
    const simple = typeof mo.simple === 'number' ? mo.simple : 0.4;
    const ink = typeof mo.ink === 'number' ? mo.ink : 0.4;
    const aspect = m && m.aspect ? m.aspect : 1;
    const curvy = m && m.turned ? m.curviness : 0.5;
    const sym = typeof mo.symmetry === 'number' ? mo.symmetry : 0.5;
    const grain = typeof mo.grain === 'number' ? mo.grain : 0.3;
    const masked = mo.masked === 1 ? 1 : 0;
    return PATTERN_FROM[generator]({ m, mo, fine, simple, ink, aspect, curvy, sym, grain, masked,
      // The scale rule, in the terms a grid generator wants it: how many cells
      // across the tile may be before something is drawn finer than the mark
      // allows. Every grid here is held between a floor and a ceiling of its
      // own, because a grid of eight is a chequerboard and one of two hundred
      // is grey.
      cells: (least, most) => Math.max(least, Math.min(most, Math.round(scaleFrom(m)))) });
  }

  PATTERN_FROM.oddgrid = (d) => ({
    // How many cells across, from the scale rule. A pixel composition wants
    // more cells than a block field does — the cell is the pixel, not the
    // module — so the ceiling sits where the cell is still visible on a cover.
    grid: d.cells(16, 88),
    // How many noise periods across the tile. A whole number, always: it is
    // what makes the field come back round at the edge.
    //
    // And high, which took a sweep to find. The first answer was two or three
    // periods "so the noise does not argue with the drawing", and at two the
    // noise blobs are the same size as the mark and the sheet is camouflage.
    // The mark only reads when the noise around it is *finer* than it is: at
    // fourteen periods the field is grain and the logo is the one large thing
    // on the page. Compared at 2, 8 and 14 across six identities; at 14 the
    // mark was findable in all six and at 2 in none.
    zoom: Math.max(6, Math.min(18, Math.round(10 + d.simple * 6))),
    // How much of the page the grain claims. Low, for the same reason: the
    // drawing needs an empty field to appear out of.
    fill: Math.round(Math.max(0.08, Math.min(0.22, 0.06 + d.ink * 0.3)) * 100) / 100,
    grain: 0.35, patchiness: 0.5,
    // Barely any. Blockiness pulls neighbouring cells to one sample, which
    // coarsens the grain back up to the size of the mark and undoes the above.
    blockiness: 0.15,
    blockSize: Math.max(2, Math.min(12, Math.round(d.cells(16, 88) / 10))),
    speckle: 0.08, spreadInk: 0,
    mark: d.masked ? 0.9 : 0,
    // How many times the drawing comes round. A simple shape survives being
    // small and can appear three times across; a complex one needs the room.
    repeat: d.simple > 0.6 ? 3 : d.simple > 0.35 ? 2 : 1,
    spread: Math.round(Math.max(0, Math.min(1, 0.5 - d.ink * 0.4)) * 100) / 100,
    cellMark: 'none', markAmount: 0, markSize: 0.52, seed: 1 });

  PATTERN_FROM.quilt = (d) => ({
    // Cells across, from the scale rule. A quilt is pieced from patches and a
    // patch has to be big enough to read as cloth rather than as a pixel.
    cells: d.cells(16, 64),
    // How many blocks across. A simple shape sits happily in a small block; a
    // complex one needs the whole tile to be legible as a medallion.
    blocks: d.simple > 0.6 ? 3 : d.simple > 0.35 ? 2 : 1,
    // Which piecing, off the same table the other two generators are chosen
    // from — aspect, then fineness, then curviness.
    style: QUILT_STYLES[d.m && d.m.aspect > 2 ? 0 : 1]
      [bandOf(d.m ? d.m.fineness : 24, [20, 40])]
      [bandOf(d.m ? d.m.curviness : 0.5, [0.33, 0.66])],
    // How many patches a piecing is cut into, from how fine the mark is.
    pieces: Math.max(2, Math.min(10, Math.round(d.fine / 6))),
    plain: 0.3, border: 0.7,
    mark: d.masked ? 0.92 : 0,
    spread: Math.round(Math.max(0, Math.min(1, 0.35 - d.ink * 0.3)) * 100) / 100,
    flip: d.mo.mirrorable === 0 ? 0 : 1, seed: 1 });

  PATTERN_FROM.vee = (d) => {
    // The direction the bars run, from the drawing's own grain.
    //
    // `character` measures the angle the shape's segments mostly point in.
    // A pattern of chevrons over a mark whose own strokes run the same way
    // reads as one gesture; over one that runs across them it reads as an
    // argument. So the bars are laid at the lattice direction nearest to the
    // drawing's own, and where the drawing has no grain worth the name the
    // default is the diagonal, which is what a chevron is.
    const angle = (d.grain >= 0.18 && typeof d.mo.angle === 'number') ? d.mo.angle : 45;
    const a = ((angle % 180) + 180) % 180;
    const run = a < 22 || a >= 158 ? 'across' : a < 40 ? '18°' : a < 55 ? '27°'
      : a < 72 ? '45°' : a < 100 ? '63°' : a < 125 ? '72°' : 'down';
    return {
      run,
      structure: d.sym >= SYMMETRIC ? 'chevron' : 'quad',
      // How many bars, from the scale rule — the same rule the stripe width in
      // zigzag comes off, counted rather than measured.
      // How many bars across the tile, from the scale rule.
      //
      // Twice through the band. The first version left the count out of the
      // stripe coordinate altogether and every tile came out with one or three
      // bars in it — a flag, and a figure counterchanged out of three bars is a
      // figure with two notches in it. The second ran the scale rule straight
      // in and gave forty, which at the size a cover prints is moiré with a
      // logo somewhere inside it. Eight to twenty-two is where a chevron reads
      // as chevrons and a counterchange still reads as a shape.
      count: Math.max(6, Math.min(16, Math.round(scaleFrom(d.m) / 4))),
      // A solid mark wants thin bars to counterchange out of; an open one needs
      // heavy bars or there is nothing for the figure to be made of.
      weight: Math.round(Math.max(0.25, Math.min(0.7, 0.7 - d.ink * 0.5)) * 100) / 100,
      // Two bands, not four. Four sets of mirrored bars over a mirrored
      // structure interfere, and the tile comes out as a moiré diamond with
      // the logo lost inside it. A chevron needs one mirror to be a chevron.
      bands: d.sym >= SYMMETRIC ? 2 : 3,
      shift: 0.5,
      mark: d.masked ? 1 : 0,
      repeat: d.simple > 0.6 ? 3 : d.simple > 0.35 ? 2 : 1,
      spread: Math.round(Math.max(0, Math.min(1, 0.45 - d.ink * 0.35)) * 100) / 100,
      seed: 1 };
  };

  PATTERN_FROM.warp = (d) => ({
    shape: d.mo.moves ? 'mark' : 'square',
    // How many copies across, from the scale rule in the lattice's terms: the
    // shape's own size decides, and the cap is where a bent copy is still a
    // shape rather than a smudge.
    // How many copies across. Far fewer than the scale rule alone would ask
    // for: a bent copy has to stay a shape, and at sixteen across a bent logo
    // is a smudge. Six is where the drawing is still the drawing.
    cells: Math.max(2, Math.min(8, Math.round(scaleFrom(d.m) / 8))),
    // And large in its cell. A warp is a thing done *to* a shape, so the shape
    // has to be most of what is on the page.
    size: Math.round(Math.max(0.7, Math.min(1.5, 0.8 + (1 - d.ink) * 0.6)) * 100) / 100,
    // The op-art half. A symmetric mark holds a full field; an asymmetric one
    // is busier and wants every other cell dropped.
    checker: d.sym >= SYMMETRIC ? 0 : 0.6,
    drop: 0, turn: 0,
    flip: d.mo.mirrorable === 0 ? 0 : 0,
    // Which bend, from how the drawing turns. A cornered mark takes a wave
    // without losing its corners; a curved one can take the swirl.
    kind: !d.m || !d.m.turned ? 'wave' : d.curvy >= 0.5 ? 'swirl' : 'wave',
    // Enough bend to be the tool, not so much that the logo stops being it.
    warp: 0.35,
    frequency: 2, invert: 0, seed: 1 });

  PATTERN_FROM.sampler = (d) => ({
    // Tiles across, from the scale rule — and capped far below where the rule
    // alone would take it. A modular tile carries a *shape*, and at thirty
    // across every one of the eight is three pixels of a thing: the sheet reads
    // as coloured noise. Sixteen is where an elbow is still an elbow.
    cols: d.cells(6, 16),
    // How many bands, from how much drawing there is. A simple mark can carry
    // more bands before the sheet reads as stripes.
    bands: Math.max(2, Math.min(10, Math.round(3 + d.simple * 6))),
    // One kind per band reads as a weave and three reads as noise, so a busy
    // drawing gets fewer kinds beside it.
    variety: Math.round(Math.max(0.15, Math.min(0.8, 0.2 + d.simple * 0.5)) * 100) / 100,
    // A shape that is its own mirror gains nothing from being turned, so it is
    // turned less and the sheet keeps its grain.
    rotation: d.sym >= SYMMETRIC ? 0.35 : 0.8,
    coverage: 0.9,
    balance: 0.5,
    mark: d.mo.moves ? 0.5 : 0,
    // A solid mark fills its cell at a smaller size than an open one.
    markSize: Math.round(Math.max(0.5, Math.min(1.2, 1.15 - d.ink * 0.6)) * 100) / 100,
    seed: 1 });

  PATTERN_FROM.whorl = (d) => ({
    // How many centres. From how much drawing there is, because each centre is
    // a place the drawing puts pressure on the field: a shape of two moves has
    // two or three such places and one of twenty has many.
    // Few. Each centre is a family of contours, and past about five the
    // families collide everywhere at once and the field reads as crumpled foil
    // rather than as a landscape with a shape in it.
    centres: Math.max(2, Math.min(5, Math.round(2 + (1 - d.simple) * 3))),
    // How tight the whorl draws. A cornered mark pulls harder — its contours
    // want to turn — and a curved one opens into broad bowls.
    pull: Math.round((d.m && d.m.turned ? 0.75 - d.curvy * 0.35 : 0.55) * 100) / 100,
    push: 0.35,
    // How many bands, from the scale rule — and held well under it for the
    // same reason the centres are. Thirty bands over four colliding families is
    // moiré; twelve is a contour map.
    count: Math.max(5, Math.min(14, Math.round(scaleFrom(d.m) / 5))),
    weight: 0.5,
    kind: !d.m || !d.m.turned ? 'ripple' : d.curvy >= 0.5 ? 'smooth' : 'turbulent',
    warp: 0.3, detail: 0.25,
    mark: d.masked ? 1 : 0,
    spread: Math.round(Math.max(0, Math.min(1, 0.4 - d.ink * 0.3)) * 100) / 100,
    seed: 1 });

  PATTERN_FROM.sprig = (d) => ({
    // How many motifs, from the scale rule in a scattered field's terms: the
    // count that puts them about as far apart as the mark is wide.
    count: Math.max(8, Math.min(48, Math.round(scaleFrom(d.m) / 2))),
    // And how large each one is, against the room that count leaves. Half is
    // motifs about as wide as the gaps between them; a busy drawing sits a
    // little under that so the sheet keeps some air in it.
    size: Math.round(Math.max(0.3, Math.min(0.75, 0.75 - d.ink * 0.5)) * 100) / 100,
    variation: 0.5,
    // Which family.
    //
    // `marks` where the drawing can be outlined, which is most of the
    // repository. The brief is a pattern a client can see their logo in, and
    // `garden` deals the mark two times in ten — at the rate below that is
    // about one motif in eight, which is a botanical with a logo hidden in it.
    // `marks` deals it three times in five. The botanical set is still there
    // underneath, which is the point: the mark is *among* leaves rather than
    // being the only thing on the page.
    family: d.mo.silhouette === 1 ? 'marks' : 'leaves',
    mark: d.mo.silhouette === 1 ? 0.8 : 0,
    // A shape that is its own mirror looks the same however it is turned, so
    // turning it is wasted; an asymmetric one gains from it.
    turn: d.sym >= SYMMETRIC ? 0.1 : 0.5,
    // How heavy the pen is, from how heavy the drawing is. A mark drawn in
    // hairlines gets a fine pen and one drawn in slabs gets a broad one.
    weight: Math.round(Math.max(0.12, Math.min(0.5, (d.mo.weight || 0.06) * 5)) * 100) / 100,
    roughness: 0.4, wobble: 0.3, detail: 0.55, seed: 1 });

  PATTERN_FROM.stipple = (d) => ({
    mode: 'contour', lattice: 'square', shape: 'circle',
    // How many dots across, from the scale rule. A halftone wants a fine grid —
    // the dot is the pixel — and the ceiling is where a dot is still a dot on a
    // cover rather than a smudge of tone.
    resolution: d.cells(24, 120),
    size: 0.62, variation: 0.7, cutout: 0.34, jitter: 0,
    edge: 0.85, scatter: 0.12,
    // How many periods of noise give the field its surface. Few, so the
    // drawing is the large thing and the noise is the tooth.
    scale: Math.max(2, Math.min(8, Math.round(3 + d.simple * 4))),
    warp: 0.8, detail: 4, contrast: 1.6,
    mark: d.masked ? 0.85 : 0,
    repeat: d.simple > 0.6 ? 2 : 1,
    spread: Math.round(Math.max(0, Math.min(1, 0.4 - d.ink * 0.3)) * 100) / 100,
    seed: 1 });

  PATTERN_FROM.atlas = (d) => ({
    scale: Math.max(2, Math.min(8, Math.round(3 + d.simple * 4))),
    warp: 0.31,
    // How many terraces, from how much drawing there is: a simple mark reads
    // over few broad bands and a complex one needs more before its own detail
    // is lost in one of them.
    terraces: Math.max(3, Math.min(8, Math.round(3 + (1 - d.simple) * 5))),
    contrast: 0.55,
    // The mark is the glyph where it can be outlined. It is the thing this tool
    // is here for; the drawn sets are the fallback and the alternative.
    set: d.mo.silhouette === 1 ? 'mark' : 'rules',
    // How many columns, from the scale rule — and held low, because a glyph
    // has to be big enough to be a glyph.
    columns: d.cells(20, 64),
    density: 0.62, variety: 0.5, weight: 0.5,
    mark: d.masked ? 0.8 : 0,
    repeat: 1,
    spread: Math.round(Math.max(0, Math.min(1, 0.45 - d.ink * 0.3)) * 100) / 100,
    seed: 1 });

  PATTERN_FROM.mosh = (d) => ({
    // How many bands of damage. Five failure modes in the deck, so six bands is
    // where a page shows every one of them and starts repeating.
    bands: 6,
    // The column width everything quantises to, from the scale rule.
    resolution: Math.max(40, Math.min(240, Math.round(d.cells(24, 120) * 2))),
    spread: 0.62,
    smear: 0.5,
    flashes: 0.3,
    mark: d.masked ? 1 : 0,
    repeat: d.simple > 0.6 ? 2 : 1,
    spreadMark: Math.round(Math.max(0, Math.min(1, 0.5 - d.ink * 0.35)) * 100) / 100,
    seed: 1 });

  PATTERN_FROM.pith = (d) => ({
    // How many cells across the tile is seeded at, from the scale rule. Tissue
    // wants cells you can see into — a hundred cells across is grain.
    cells: Math.max(4, Math.min(22, Math.round(scaleFrom(d.m) / 3))),
    size: 0.45,
    zoom: 2,
    resolution: Math.max(60, Math.min(200, Math.round(scaleFrom(d.m) * 3))),
    // A cornered drawing gets straighter walls, a curved one a wobble.
    wobble: Math.round((d.m && d.m.turned ? 0.25 + d.curvy * 0.5 : 0.4) * 100) / 100,
    width: 0.45, dither: 0.55, grain: 0.4,
    veins: 0.5, thickness: 0.45,
    mark: d.masked ? 0.85 : 0,
    repeat: 1,
    spread: Math.round(Math.max(0, Math.min(1, 0.45 - d.ink * 0.3)) * 100) / 100,
    seed: 1 });

  PATTERN_FROM.monogram = (d) => ({
    // Which armature. A drawing that is its own mirror sits square in a grid
    // without looking like it was set down carelessly; one that is not wants
    // the diagonal, which is where a monogram has always been.
    layout: d.sym >= SYMMETRIC ? 'ogee' : 'diagonal',
    /* How many cells. Not from the scale rule, which the first draft used and
       which had it exactly backwards: that rule grows with the drawing's
       fineness, so the most detailed marks were dealt the smallest cells and
       flooded — hallward inked 98% of its tile and read as a black wall.

       A monogram is read close, on a bag rather than a wall, and the count it
       wants is small and fairly flat. What it should key off is how much
       drawing there is to fit: a 450-move mark needs a bigger cell to stay
       legible, not a smaller one. So the count falls as the drawing grows, by
       halvings rather than by counts, because the difference between 2 moves
       and 20 matters and the difference between 200 and 220 does not. */
    cells: Math.max(5, Math.min(12,
      Math.round(11 - Math.log2(Math.max(1, d.mo.moves || 1)) * 1.1))),
    // A solid mark fills its cell at a smaller size than an open one.
    scale: Math.round(Math.max(0.5, Math.min(1.2, 1.15 - d.ink * 0.6)) * 100) / 100,
    turn: 0,
    chequer: 0,
    /* How many derived forms: all of them, whenever there is a drawing to
       derive from.

       The first draft scaled this by `simple` and that was a bug rather than a
       judgement. `simple` is not a 0-to-1 spread in practice — over the
       thirty-three fixtures it runs 0.08 to 0.64 — so `round(1 + simple * 3)`
       could never reach 4 and only four identities ever reached 3. Twenty-nine
       of thirty-three were dealt two forms, and two forms alternating on a
       diagonal is not a monogram, it is spots. That is exactly what the
       rendering showed.

       Four is also the right answer on its own terms. More than one motif is
       the whole construction — it is what separates a monogram from a lattice,
       which this engine already has — and the forms are all made out of the
       client's own drawing, so a fourth costs nothing in coherence. Anyone who
       wants fewer can pull the control down. */
    forms: d.mo.moves ? 4 : 1,
    // And how many inks they step through: as many as read on the ground,
    // capped where a monogram stops being a monogram and starts being a print.
    colours: 2, seed: 1 });

  PATTERN_FROM.tartan = (d) => {
    /* The sett, written from the drawing.

       A tartan's sett has always been a list of numbers somebody wrote down.
       These are the identity's own numbers: how much of its box the shape inks,
       how heavy its stroke is against its width, how wide it is against how
       tall, and how much of its turning happens on a curve. Four proportions,
       dealt round the sett in order — so two identities give two different
       cloths, and the manual can print the arithmetic beside the result. */
    const widths = [
      Math.max(0.15, Math.min(1, d.ink)),
      Math.max(0.15, Math.min(1, (d.mo.weight || 0.06) * 8)),
      Math.max(0.15, Math.min(1, Math.min(d.aspect, 1 / d.aspect))),
      Math.max(0.15, Math.min(1, d.curvy)),
    ];
    return {
      weave: 'tartan',
      // How many bands in the half-sett, from how much drawing there is: a
      // simple mark says little and gets a short sett.
      bands: Math.max(2, Math.min(7, Math.round(2 + (1 - d.simple) * 5))),
      // And how many threads a band is, from the scale rule.
      thread: Math.max(2, Math.min(18, Math.round(scaleFrom(d.m) / 3))),
      repeats: 1,
      colours: 3,
      widths,
      seed: 1 };
  };

  PATTERN_FROM.stripe = (d) => {
    /* Same four proportions as the tartan's sett, and deliberately so: a stripe
       and a plaid are the same written list, one of them crossed with itself.
       An identity that gets a recognisable tartan gets the stripe that tartan
       is woven from, which is what a house with both actually has. */
    const widths = [
      Math.max(0.15, Math.min(1, d.ink)),
      Math.max(0.15, Math.min(1, (d.mo.weight || 0.06) * 8)),
      Math.max(0.15, Math.min(1, Math.min(d.aspect, 1 / d.aspect))),
      Math.max(0.15, Math.min(1, d.curvy)),
    ];
    return {
      /* Which sett. A drawing that is its own mirror can carry the symmetrical
         setts; one that is not gets the signature stripe, whose whole point is
         that it does not mirror. */
      kind: d.sym >= SYMMETRIC ? 'sett' : 'signature',
      bands: Math.max(2, Math.min(9, Math.round(2 + (1 - d.simple) * 5))),
      thread: Math.max(2, Math.min(24, Math.round(scaleFrom(d.m) / 3))),
      repeats: 1,
      // Down the cloth for a tall mark, across for a wide one: the stripe runs
      // the way the drawing already runs.
      angle: d.aspect < 1 ? 90 : 0,
      slant: 0,
      density: 0.5,
      colours: 3,
      widths,
      // Carried only where there is a drawing to carry and the sett is wide
      // enough to hold it. Off by default even then — a stripe with a crest in
      // it is a decision, not a starting point.
      carry: 0,
      upright: false,
      seed: 1 };
  };

  PATTERN_FROM.terrazzo = (d) => ({
    // Whole chips where the drawing is simple enough to survive being thrown
    // small, a mixed grade otherwise — which is most identities, and is also
    // what a real floor is.
    cut: d.simple > 0.5 ? 'whole' : 'mixed',
    /* How many chips. The scale rule points the right way here — a fine
       drawing grades finer, and more chips of a smaller stone is exactly what a
       fine aggregate is — but taken straight it is far too steep: marlow was
       dealt 113 chips in a tile and the floor came out as dust. Most of the
       count is flat, with the drawing's fineness adding to it rather than
       setting it. */
    chips: Math.max(18, Math.min(110, Math.round(20 + scaleFrom(d.m) * 0.55))),
    size: Math.round(Math.max(0.6, Math.min(1, 1.05 - d.ink * 0.4)) * 100) / 100,
    // How even the throw is. A symmetrical drawing can take an even bed; an
    // asymmetric one wants the looser throw, where the irregularity of the
    // drawing and the irregularity of the scatter agree.
    spread: d.sym >= SYMMETRIC ? 0.8 : 0.5,
    // How far a chip may turn. A drawing with a right way up keeps more of one.
    turn: Math.round((d.m && d.m.turned ? 1 : 0.5) * 100) / 100,
    colours: 3,
    tint: 0.5,
    /* How solid a chip is cast. Two thirds by default: enough that an open
       stroked drawing reads as stone rather than as wire, short of the weight
       that would close the counters in a drawing that has them. */
    body: 0.9,
    seed: 1 });

  PATTERN_FROM.damask = (d) => ({
    /* Which way. A drawing open enough to read through an armature gets the
       trellis, which is the quietest of the three. A busy one gets the brocade,
       where the arch is filled and the figure is counterchanged out of it —
       that is the version that separates a dense figure from its own armature,
       and on the three busiest fixtures here it is the difference between a
       damask and a smudge. `sprigged` drops the armature entirely and stays on
       the control for anyone who wants it. */
    way: d.simple > 0.3 ? 'trellis' : 'brocade',
    /* How many arches. A damask is a wall pattern and reads across a room, so
       the count is low and flat — the same argument the monogram makes, one
       scale further out. Four to seven arches across a width is where every
       damask in every pattern book sits. */
    cells: Math.max(4, Math.min(8, Math.round(8 - Math.log2(Math.max(1, d.mo.moves || 1)) * 0.5))),
    // Wide enough that neighbouring arches meet. Below about 0.9 they stand
    // apart and the trellis stops being a trellis — it reads as a column of
    // teardrops, which is what the first draft drew.
    belly: Math.round((0.98 + d.curvy * 0.14) * 100) / 100,
    weight: Math.round(Math.max(0.012, Math.min(0.04, (d.mo.weight || 0.06) * 0.35)) * 1000) / 1000,
    // The figure fills a good half of its arch. Below that it rattles around
    // inside the armature and the pattern reads as a trellis with specks in it.
    scale: Math.round(Math.max(0.4, Math.min(0.82, 0.82 - d.ink * 0.34)) * 100) / 100,
    // How far apart the facing pair stand. A drawing that is already its own
    // mirror needs no gap — the reflection lands on itself — so it is closed
    // up; an asymmetric one is opened so the pair reads as a pair.
    gap: d.sym >= SYMMETRIC ? 0 : 0.24,
    /* Tone on tone, which is what damask is — but a quarter of the way to the
       ink was quiet past the point of being visible, and a pattern nobody can
       see is not a quiet pattern, it is a blank sheet. A third is where the
       figure resolves at arm's length and still disappears across a room,
       which is the effect the weave actually has. */
    contrast: 0.34,
    ink: 0,
    seed: 1 });

  PATTERN_FROM.ornament = (d) => ({
    // The full field by default. A band or a border is a decision about where
    // the ornament goes on a page, and a pattern tile has no page to decide
    // about; both stay on the control for the studio.
    setting: 'lace',
    // How many sorts across. A fleuron is small type — twelve point beside
    // twelve point text — so the count runs higher than a monogram's and lower
    // than a texture's.
    cells: Math.max(3, Math.min(16, Math.round(6 + scaleFrom(d.m) * 0.12))),
    lead: 1,
    rule: 0.5,
    scale: Math.round(Math.max(0.45, Math.min(1.05, 1.05 - d.ink * 0.5)) * 100) / 100,
    /* How many settings are in the case. Four — the quarter turns — whenever
       the drawing has a direction to turn; one where it is its own mirror in
       both axes, because turning a shape onto itself four times is four
       identical cells and a compositor would have reached for one sort. */
    ways: d.sym >= SYMMETRIC ? 2 : 4,
    body: 0.5,
    colours: 1,
    ink: 0,
    seed: 1 });

  PATTERN_FROM.dynamic = (d) => ({
    way: 'matrix',
    // Enough states that the axes read as axes. Below about five a row is a
    // handful of marks rather than a traverse of a variable, and the whole
    // point of the construction is lost.
    cells: Math.max(5, Math.min(12, Math.round(5 + scaleFrom(d.m) * 0.06))),
    /* Which two variables. Turning is the one every mark can take, so it runs
       across. Down is the axis the drawing itself suggests: a stroked mark has
       a weight to travel along and a filled one does not, so a filled mark
       travels in size instead. */
    across: 'turn',
    down: d.mo.stroked ? 'weight' : 'size',
    range: 0.6,
    scale: Math.round(Math.max(0.5, Math.min(0.92, 0.95 - d.ink * 0.4)) * 100) / 100,
    colours: 1,
    ink: 0,
    // A hairline, because the grid is the part that says these are states.
    grid: 0.14,
    seed: 1 });

  PATTERN_FROM.junction = (d) => ({
    // A drawing with a lean of its own gets the diagonal armature; a square one
    // gets the square grid, where the junction still pinches but the lattice
    // does not tilt under it.
    weave: d.curvy > 0.4 ? 'diagonal' : 'square',
    cells: Math.max(3, Math.min(12, Math.round(4 + scaleFrom(d.m) * 0.08))),
    // The bar against the cell, from how heavy the drawing's stroke runs
    // against its width. Capped at a third: past that the wells close and the
    // pattern is a sheet with dimples in it.
    bar: Math.round(Math.max(0.16, Math.min(0.36, (d.mo.weight || 0.06) * 3.6)) * 100) / 100,
    // And the fillet from how much of its turning happens on a curve, which is
    // the whole difference between a cast piece and a plaid.
    /* Short of round by default. Taken to its own maximum the well becomes a
       circle and the cloth becomes a dot screen, which is a pattern the
       catalogue already has three of. The control still reaches all the way for
       anyone who wants it. */
    fillet: Math.round(Math.max(0.15, Math.min(0.62, 0.18 + d.curvy * 0.42)) * 100) / 100,
    seam: 0, ink: 0, seed: 1 });

  PATTERN_FROM.tracery = (d) => ({
    // Four forms where the drawing is simple enough that four do not crowd it,
    // two where it is not. Every one of them is line only, so the cost of a
    // fourth is a crossing rather than a shape on top of another.
    forms: Math.max(1, Math.min(4, Math.round(1 + d.simple * 4))),
    cells: Math.max(2, Math.min(7, Math.round(2 + scaleFrom(d.m) * 0.04))),
    /* How far a form runs past its own cell. This is the control that decides
       whether it is tracery at all: at 1 the forms meet and it is a mosaic,
       past 1 they pass through each other and every crossing is a new figure.
       A curvy drawing takes more overlap because its crossings stay legible. */
    reach: Math.round((1.25 + d.curvy * 0.5) * 100) / 100,
    // The forms' own proportion, from the drawing's.
    lean: Math.round(Math.max(0.4, Math.min(1.5, 1 / Math.max(0.4, d.aspect))) * 100) / 100,
    drop: d.sym >= SYMMETRIC ? 0.5 : 0,
    turn: 0,
    // A hairline: the reference's whole character is one weight everywhere,
    // including at a crossing, and a heavy line closes the figures up.
    weight: Math.round(Math.max(0.006, Math.min(0.03, (d.mo.weight || 0.06) * 0.3)) * 1000) / 1000,
    ink: 0, seed: 1 });

  PATTERN_FROM.screen = (d) => ({
    run: 'columns',
    // How fine the screen runs, from the scale rule. This is the one place the
    // rule points straight: a fine drawing asks for a fine screen.
    pitch: Math.max(12, Math.min(140, Math.round(scaleFrom(d.m) * 0.7))),
    // How much the pitch changes across the sheet. Without this it is a stripe.
    depth: 0.45,
    bands: Math.max(1, Math.min(6, Math.round(2 + (1 - d.simple) * 3))),
    duty: Math.round(Math.max(0.2, Math.min(0.8, 0.3 + d.ink * 0.4)) * 100) / 100,
    blocks: Math.max(4, Math.min(30, Math.round(6 + scaleFrom(d.m) * 0.06))),
    fill: Math.round(Math.max(0.3, Math.min(1, 0.4 + d.ink * 0.5)) * 100) / 100,
    colours: 3,
    mark: d.masked ? 0.85 : 0,
    spread: 0.5,
    seed: 1 });

  PATTERN_FROM.plate = (d) => ({
    // A busy drawing gets a set-out composition with few blocks; a simple one
    // can carry a scattered plate without the two fighting.
    set: d.simple > 0.4 ? 'scattered' : 'quartered',
    cells: Math.max(5, Math.min(20, Math.round(6 + scaleFrom(d.m) * 0.05))),
    blocks: Math.max(2, Math.min(7, Math.round(2 + d.simple * 5))),
    field: 0.22,
    rules: 0.3,
    tags: 0.55,
    tagSize: 1,
    mark: d.mo.moves ? 0.5 : 0,
    colours: 3, ink: 0, seed: 1 });

  PATTERN_FROM.strata = (d) => ({
    sky: d.sym >= SYMMETRIC ? 'dawn' : 'dusk',
    panels: Math.max(1, Math.min(4, Math.round(1 + d.simple * 4))),
    // How many flat steps the sky is cut into. Few enough to count, which is
    // the point of stepping it rather than blending it.
    steps: Math.max(5, Math.min(14, Math.round(6 + (1 - d.simple) * 8))),
    // Fine enough that the dither reads as a dither rather than as tiles. The
    // first draft ran at a twelfth of this and came out as brickwork.
    /* Fine enough that the dither is a dither. At a tile of six hundred, a
       grain of seventy is eight-pixel cells and the ordered matrix reads as
       brickwork rather than as a graded sky. */
    grain: Math.max(130, Math.min(240, Math.round(130 + scaleFrom(d.m) * 0.4))),
    gap: 0.06,
    // A silhouette, not a wall. At 0.8 the mark's own bitmap filled most of the
    // panel and the sky it was supposed to stand against was a rim round it.
    relief: d.masked ? 0.24 : 0.42,
    ridges: Math.max(1, Math.min(6, Math.round(1 + d.curvy * 4))),
    mark: d.masked ? 0.34 : 0,
    spread: 0.5,
    top: 0,
    bottom: 1,
    seed: 1 });

  PATTERN_FROM.signage = (d) => ({
    layout: 'grid',
    // The pen for a set read beside text, the stamp for a mark that is already
    // heavy — a solid set under a solid logo is two weights arguing.
    way: d.ink > 0.55 ? 'pen' : 'stamp',
    cells: Math.max(3, Math.min(10, Math.round(4 + scaleFrom(d.m) * 0.03))),
    size: 0.66,
    drop: 0,
    lead: 1,
    count: 28,
    vary: 0.3,
    turn: 0,
    icons: 24,
    which: 0,
    // No project declares its trade yet, so the set opens on the twenty-four
    // every brand needs and a sector swaps its six in when one is named. That
    // is a control rather than a guess: deriving a distillery from the word
    // "spirit" in a positioning line is the engine inventing a fact.
    sector: '',
    colours: 1, ink: 0, seed: 1 });

  PATTERN_FROM.relief = (d) => ({
    way: 'raise',
    // How many cubes across, from the scale rule — and capped well below where
    // the rule would take a fine mark. hallward asks for 133 and kvist for 71,
    // and at either the sheet is grey: the cube is under a millimetre on a
    // cover and the drawing raised out of it is unfindable. Twenty-eight is
    // where a mark is still legible in the field across every identity here.
    cubes: d.cells(6, 28),
    // How large the repeat unit is — how often the mark comes round. Two marks
    // across the tile at a simple shape, one at a complex one, because a
    // complex shape needs more cubes under it before it is legible at all.
    unit: Math.max(4, Math.min(24, Math.round(d.cells(6, 28) / (d.simple > 0.55 ? 2 : 1)))),
    // How much the field argues with itself. A drawing that is its own mirror
    // sits in a regular field without looking like a mistake; an asymmetric one
    // wants the blocks interlocking around it.
    interlock: Math.round((d.sym >= SYMMETRIC ? 0.2 : 0.55) * 100) / 100,
    // How many cubes lie flat where the drawing says nothing. Enough that the
    // field is not a solid wall of blocks, never so many that the mark has no
    // field to rise out of.
    flats: 0.14,
    mark: d.masked ? 1 : 0,
    // A solid shape fills its unit at a smaller spread than an open one.
    spread: Math.round(Math.max(0, Math.min(1, 0.55 - d.ink * 0.5)) * 100) / 100,
    relief: 0.9,
    // A mark drawn in one heavy part can carry accents around it; a fine one is
    // lost among them.
    accent: Math.round(Math.max(0.06, Math.min(0.3, 0.3 - d.fine / 200)) * 100) / 100,
    seed: 1 });

  /* What a poster's composition asks of the artwork.

     Same discipline as everything else here: no number describes "a poster in
     general". `optic` counterchanges a figure out of a field of bars, and both
     of its numbers come off the drawing — how many bars from how fine the mark
     is, and how large the figure from how much of its own box the shape inks,
     because a dense silhouette needs less of the page than an open one to read
     as the figure. */
  function posterFrom(generator, m, motif) {
    const mo = motif || {};
    if (generator === 'optic') {
      const fine = m && m.fineness ? m.fineness : 24;
      // The same scale rule the patterns use, in this composition's terms: a
      // mark drawn in heavy strokes gets broad bars and a fine one gets narrow
      // bars, held inside the range a counterchange still reads at.
      const stripes = Math.max(6, Math.min(28, Math.round(fine / 2)));
      const ink = typeof mo.ink === 'number' ? mo.ink : 0.4;
      return {
        // The mark itself where it has an interior to counterchange; otherwise
        // a shape chosen from how the mark turns, so even the fallback is the
        // drawing's own character rather than a default somebody typed. A mark
        // that turns on curves gets a circle, one that turns at corners gets a
        // diamond, one that barely turns at all gets a peak.
        figure: mo.silhouette === 1 && mo.ops && mo.ops.length ? 'mark'
          : !m || !m.turned ? 'peak' : m.curviness >= 0.66 ? 'circle'
            : m.curviness >= 0.33 ? 'diamond' : 'square',
        stripes,
        weight: 0.5,
        // A solid silhouette holds the page at three quarters of it; an open
        // one — a ring, a bracket — needs most of the page before the bars
        // inside it read as a figure at all.
        size: Math.round(Math.max(0.55, Math.min(1, 1.05 - ink * 0.45)) * 100) / 100,
        levels: 2, seed: 1 };
    }
    if (generator === 'specimen') {
      const fine = m && m.fineness ? m.fineness : 24;
      const simple = typeof mo.simple === 'number' ? mo.simple : 0.4;
      return {
        // How many cells across, from how fine the mark is — the same scale
        // rule, and held where a block is still big enough to show a drawing.
        columns: Math.max(3, Math.min(9, Math.round(fine / 5) + 2)),
        fill: 0.62,
        // A simple shape spans more, because a page of small blocks needs some
        // large ones to hold it together and a simple mark survives being big.
        spanning: Math.round((0.3 + simple * 0.4) * 100) / 100,
        gutter: 0.04, rules: 0.14,
        // A third of the blocks are the identity's own drawings: its mark and
        // its logotype. Fewer and it is a palette sheet with a logo on it.
        identity: mo.silhouette === 1 && mo.ops && mo.ops.length ? 0.36 : 0,
        inkShare: 0.35, weight: 2, seed: 1 };
    }
    if (generator === 'kiosk') {
      const fine = m && m.fineness ? m.fineness : 24;
      const aspect = m && m.aspect ? m.aspect : 1;
      return {
        split: 0.62, sweep: Math.max(6, Math.min(24, Math.round(fine / 2))), shift: 0,
        stripes: Math.max(4, Math.min(16, Math.round(fine / 3))), blocks: 0.62,
        // How many across, from how fine the mark is drawn — the same scale
        // rule, in a grid of stamps rather than a grid of cells.
        columns: Math.max(4, Math.min(16, Math.round(fine / 3) + 2)),
        // A wide mark stamps larger before it crowds its neighbour; a tall one
        // has to sit smaller in the same cell.
        bigSize: Math.round(Math.max(0.5, Math.min(1.2, 0.55 + Math.min(aspect, 2) * 0.3)) * 100) / 100,
        large: 0.72, smallSize: 0.4, small: 0.5,
        // Half the stamps are the name and half the mark, where the identity
        // draws both. An identity with only a logotype gets only that.
        words: 0.5, seed: 1 };
    }
    if (generator === 'fete') {
      const simple = typeof mo.simple === 'number' ? mo.simple : 0.4;
      const ink = typeof mo.ink === 'number' ? mo.ink : 0.4;
      return {
        // How finely the colour fields are grown, from how much shape there is
        // to grow them from — the same argument as parcel's grid.
        patch: Math.max(16, Math.min(52, Math.round(16 + (1 - simple) * 32))),
        // How many bands the distance is cut into. A solid mark throws fewer,
        // broader bands before it runs out of page; an open one throws more.
        bands: Math.max(3, Math.min(8, Math.round(8 - ink * 5))),
        chunk: Math.round(Math.max(0.4, Math.min(0.9, 0.9 - ink * 0.4)) * 100) / 100,
        size: 0.62, line: 1, dots: 26, seed: 1 };
    }
    if (generator === 'totem') {
      const fine = m && m.fineness ? m.fineness : 24;
      const simple = typeof mo.simple === 'number' ? mo.simple : 0.4;
      const sym = typeof mo.symmetry === 'number' ? mo.symmetry : 0.5;
      return {
        border: 0.15, flecks: 0.36, fleckSize: 2, rule: 3,
        // How many regions the half-panel is cut into, from how much drawing
        // the mark takes: a simple shape wants a simple banner behind it.
        regions: Math.max(6, Math.min(22, Math.round(6 + (1 - simple) * 18))),
        // The pixel unit everything lands on, from how fine the mark is drawn.
        grain: Math.max(40, Math.min(180, Math.round(fine * 4))),
        // A shape that is already its own mirror gains nothing from its twin
        // being dealt a different motif, so it keeps them matched; an
        // asymmetric one is more interesting with the halves arguing a little.
        mirror: sym >= SYMMETRIC ? 1 : 0.72,
        variety: 0.7,
        core: mo.silhouette === 1 && mo.ops && mo.ops.length ? 0.22 : 0,
        rings: 3, seed: 1 };
    }
    if (generator === 'riso') {
      const ink = typeof mo.ink === 'number' ? mo.ink : 0.4;
      const curvy = m && m.turned ? m.curviness : 0.5;
      return {
        // Bands from how the mark turns. A cornered drawing sits well over a
        // few broad passes; a curved one can take more of them without the
        // page becoming a set of stripes arguing with it.
        bands: Math.max(2, Math.min(6, 2 + Math.round(curvy * 4))),
        // How far an edge is pushed off true. A heavy solid mark can take a
        // rough tear; a fine open one loses its shape in one.
        rough: Math.round(Math.max(0.4, Math.min(1.6, 1.7 - ink * 1.2)) * 100) / 100,
        // How much of the page the mark is torn out at.
        mark: mo.silhouette === 1 && mo.ops && mo.ops.length ? 0.72 : 0,
        scribbles: 0.7, seed: 1 };
    }
    if (generator === 'tokens') {
      const fine = m && m.fineness ? m.fineness : 24;
      const ink = typeof mo.ink === 'number' ? mo.ink : 0.4;
      const aspect = m && m.aspect ? m.aspect : 1;
      const grid = Math.max(8, Math.min(30, Math.round(fine / 2) + 4));
      return {
        grid,
        rect: Math.max(2, Math.min(8, Math.round(grid / 4))),
        rules: 0.6,
        // How many clusters, from how much of its own box the shape inks. A
        // solid token carries far more weight on a page than an open one, so a
        // solid mark gets fewer badges and an open one can afford more.
        count: Math.max(6, Math.min(40, Math.round(34 - ink * 26))),
        clustering: 0.7, alignment: 0.55, chain: 5, upright: 0.18,
        // How large they run, from the shape's own proportion: a shape close to
        // square fills its cell, and a long one has to sit smaller to fit.
        size: Math.round(Math.max(0.35, Math.min(0.8, Math.min(aspect, 1 / aspect) * 0.8)) * 100) / 100,
        variation: 0.45, hierarchy: 0.65,
        // The mark is a third of the tokens. Fewer and the sheet is dots with a
        // logo in it; more and it is a page of logos rather than a badge set.
        markShare: mo.silhouette === 1 && mo.ops && mo.ops.length ? 0.34 : 0,
        squares: 0.34, hollow: 0.18, outline: 1.5, seed: 1 };
    }
    if (generator === 'static') {
      const simple = typeof mo.simple === 'number' ? mo.simple : 0.4;
      const ink2 = typeof mo.ink === 'number' ? mo.ink : 0.4;
      return {
        regions: 3,
        // Same argument as parcel's grid: what decides whether a shape survives
        // being resolved to bits is how much shape there is.
        resolution: Math.max(40, Math.min(140, Math.round(40 + (1 - simple) * 86))),
        chunk: Math.round(Math.max(0.6, Math.min(1.3, 1.25 - ink2 * 0.5)) * 100) / 100,
        // Enough tearing to be the tool and not so much that the mark stops
        // being legible. Below a third it reads as a printing fault; above two
        // thirds the shape is gone and a client is looking at damage.
        glitch: 0.4,
        seed: 1 };
    }
    if (generator === 'parcel') {
      const ink = typeof mo.ink === 'number' ? mo.ink : 0.4;
      const simple = typeof mo.simple === 'number' ? mo.simple : 0.4;
      return {
        // The grid the mark is resolved onto, from how much drawing the shape
        // takes rather than from the mark's stroke weight.
        //
        // Weight was the first answer and it was the wrong measurement: it gave
        // most marks nine or ten cells, and a logo resolved onto ten cells is
        // not a low-resolution logo, it is four squares. carrock's ring came
        // out as four corner dots and halyard's ring closed into a solid
        // square. What decides whether a shape survives the grid is how much
        // shape there is — a bar reads at fourteen cells and a ring with a
        // counter in it needs nearer thirty.
        cells: Math.max(14, Math.min(36, Math.round(14 + (1 - simple) * 22))),
        // A solid shape fills the page at a smaller size than an open one.
        chunk: Math.round(Math.max(0.6, Math.min(1.3, 1.25 - ink * 0.5)) * 100) / 100,
        coverage: 0.5, grids: 4, weight: 1, seed: 1 };
    }
    if (generator === 'modular') {
      const fine = m && m.fineness ? m.fineness : 24;
      const simple = typeof mo.simple === 'number' ? mo.simple : 0.4;
      const aspect = m && m.aspect ? m.aspect : 1;
      const square = Math.min(aspect, 1 / aspect);
      return {
        // The same scale rule, in this composition's terms: a mark drawn in
        // heavy strokes gets a coarse grid and a fine one a dense grid, held
        // inside the range a modular poster still reads as modules.
        modules: Math.max(3, Math.min(10, Math.round(fine / 8) + 2)),
        // How finely a module subdivides, from how much drawing the mark takes.
        // A shape of two moves inside a twelve-unit module is a speck.
        unit: Math.max(2, Math.min(10, Math.round(3 + (1 - simple) * 6))),
        // A mark close to square sits well in a square module and the grid can
        // stay regular; a long one wants long modules to sit in, so it merges
        // more.
        merging: Math.round((0.75 - square * 0.45) * 100) / 100,
        empty: 30, solid: 18, blocks: 20, dots: 12, lines: 10,
        // The mark carries real weight rather than a token amount. This is the
        // treatment that makes the poster the identity's rather than a grid in
        // its colours, and it is the reason the tool is here at all.
        mark: mo.silhouette === 1 && mo.ops && mo.ops.length ? 26 : 0,
        fill: 0.5, dot: 0.62, rules: 0.22, weight: 1, seed: 1 };
    }
    return { seed: 1 };
  }

  /* Why each of the tiling tools chose what it chose, in the words a manual
     prints.

     One entry per generator, and every one of them names a *measurement* and
     what it decided. That is the contract this engine has with the person
     reading the manual: not "we picked 22 cells" but "the mark is 44 of its own
     narrowest runs across, so nothing is drawn finer than 22 of anything" —
     a claim they can check by looking at their own logo.

     `named` is the shape's name where the drawing had one, because a client
     recognises "the ring" and does not recognise "the motif". */
  const BECAUSE = {};
  const named = (params) => {
    const mo = params.motif || {};
    return mo.name ? `"${mo.name}"` : 'the shape read out of the drawing';
  };
  const inked = (params) => Math.round(((params.motif || {}).ink || 0) * 100);

  BECAUSE.monogram = (m, p, w) => `${w.fine} — ${p.cells} cells across on ${p.layout === 'diagonal'
    ? 'the diagonal, which is where a monogram has always been'
    : p.layout === 'ogee' ? 'an ogee armature, rows dropped by half into the pointed arch damask is built on'
      : p.layout === 'damier' ? 'a chequerboard' : 'a square grid'}. `
    + `${p.forms > 1 ? `${p.forms} forms are dealt so that a cell never touches its own kind — `
      + `${named(p)}, and ${p.forms > 1 ? 'the same shape ringed' : ''}`
      + `${p.forms > 2 ? ', framed in a diamond' : ''}${p.forms > 3 ? ', and four of it turned about a centre'
        : ''}. A monogram has more than one motif; one repeated is a lattice`
      : 'One form only: no shape could be read out of this drawing, or it is busy enough that '
        + 'deriving from it would crowd the cloth'}.`;

  BECAUSE.tartan = (m, p, w) => `a sett of ${p.bands} bands at ${p.thread} threads each, mirrored `
    + 'about both pivots so it reads the same in either direction, crossed on a two-and-two twill. '
    + `${p.weave === 'houndstooth' ? 'Houndstooth is that loom with the shortest sett there is — four '
      + 'threads of each colour — and the broken point is the twill rather than a drawn shape. '
      : ''}`
    + `The band widths are this identity's own proportions: ${Math.round((p.widths || [0])[0] * 100)}% `
    + 'of its box inked, its stroke against its width, its width against its height, and how much of '
    + 'its turning happens on a curve. A sett has always been a list of numbers somebody wrote down.';

  BECAUSE.stripe = (m, p, w) => `${w.fine} — ${p.kind === 'signature'
    ? `an unmirrored list of narrow bands run straight through, which is what makes a signature `
      + `stripe read as chosen rather than ruled: there is no repeat inside one cloth for the eye `
      + `to catch`
    : p.kind === 'web'
      ? `a plain ground with one tight symmetrical group of bands in it, the way a club ribbon or a `
        + `racing stripe is built`
      : p.kind === 'ombre'
        ? `a sett of ${p.bands} bands mirrored about both pivots, its colour walked between the inks `
          + `across the span rather than stepped`
        : `a sett of ${p.bands} bands at ${p.thread} threads each, mirrored about both pivots so it `
          + `reads the same from either selvedge`}, `
    + `running ${p.angle >= 45 ? 'down' : 'across'} the cloth${p.slant ? ' on a slant' : ''}. `
    + `The band widths are this identity's own proportions: ${Math.round((p.widths || [0])[0] * 100)}% `
    + 'of its box inked, its stroke against its width, its width against its height, and how much of '
    + 'its turning happens on a curve. '
    + `${p.carry > 0 ? `${named(p)} is woven into the widest band at the band's own width — a house `
      + `stripe carries its crest inside a stripe, not laid over one` : 'The mark is not carried; the '
      + 'sett is the pattern'}.`;

  BECAUSE.terrazzo = (m, p, w) => `${w.fine} — ${p.chips} chips of ${named(p)} graded in three `
    + 'sizes and laid coarsest first, so the fines land in the gaps the coarse chips leave rather '
    + 'than competing with them for the same room. That grading is what separates terrazzo from '
    + `confetti. ${p.cut === 'whole' ? 'The chips are thrown whole: this drawing is simple enough to '
      + 'read at chip size'
      : p.cut === 'shard' ? 'Every chip is broken along a chord, which is what happens to stone'
        : 'The coarse chips are whole and the fines are broken along a chord — legible where there '
          + 'is room to be legible, and honest about it where there is not'}. `
    + `The cement is the paper with ${Math.round(p.tint * 22)}% of the first ink in it; there is no `
    + 'grey here the palette did not ask for.';

  BECAUSE.damask = (m, p, w) => `${w.fine} — ${p.cells} ogee arches across, half-dropped so they `
    + 'interlock. The arch is a pointed one whose sides reverse their curve at the half height, '
    + 'which is what makes it a damask rather than a harlequin lozenge. '
    + `${p.way === 'brocade' ? 'Alternate arches are filled and the figure is counterchanged out of '
      + 'them' : p.way === 'sprigged' ? 'The armature is dropped and the half-drop and the mirror '
      + 'carry it, which is the plainest damask there is and the one that survives being printed '
      + 'small' : `${named(p)} sits inside the armature`}. `
    + `The figure is ${named(p)} and its own reflection, facing — bilateral symmetry about the `
    + 'arch\'s axis is what makes a damask motif formal rather than scattered. '
    + `And it is self-coloured at ${Math.round(p.contrast * 100)}% : damask is a weave, where the `
    + 'figure and the ground are one thread and only the direction of the weave separates them. Two '
    + 'inks would make a chintz.';

  BECAUSE.ornament = (m, p, w) => `${w.fine} — ${named(p)} cut as a printer's sort and set `
    + `${p.cells} to the measure in ${p.ways} of the eight ways a square sort can be set: `
    + `${p.ways > 4 ? 'the four quarter turns and their mirrors' : p.ways > 1
      ? 'quarter turns, no mirrors' : 'one way only'}. `
    + 'The setting is by position rather than by chance — a compositor works to a scheme, and a '
    + 'random one reads as a case of pied type — so a rosette falls at the centre of every block '
    + `of four. ${p.setting === 'band' ? `It is set as a course between two rules with ${p.lead} `
      + 'cells of leading above and below'
      : p.setting === 'border' ? 'It is set as a border inside a rule, with the corners at the turn '
        + 'and the middle left open'
        : p.setting === 'diaper' ? 'It is set on alternate cells, so the ground shows through in a '
          + 'lattice of its own' : 'It is set as a full field, which is the printers\'-flowers page'}.`;

  BECAUSE.dynamic = (m, p, w) => `${w.fine} — not a repeat. ${p.cells} states of ${named(p)} `
    + `across, with ${p.across} travelling along each row and ${p.down} down each column, so the `
    + 'cloth is the system\'s parameter space laid out rather than one drawing tiled. '
    + `${p.way === 'permute' ? 'The states are dealt as a Latin square, every value once in every '
      + 'row and once in every column, so no value is favoured by where it sits'
      : p.way === 'drift' ? 'The variables run continuously across the field rather than stepping '
        + 'between cells, so it reads as a gradient made of marks'
        : 'The states are stepped into ranks and files, which is how a system is presented on the '
          + 'page it is announced on'}. `
    + `Travel is ${Math.round(p.range * 100)}%: at nothing at all every cell is the mark as drawn `
    + 'and this is a lattice, which is the true picture of a system whose variables are not varying.';

  BECAUSE.junction = (m, p, w) => `${w.fine} — a ${p.weave} lattice of bars ${Math.round(p.bar * 100)}% `
    + 'of a cell wide, and the pattern is where they meet rather than the bars themselves. The wells '
    + 'between them are cut out of a solid sheet, so the pinch at each junction falls out of the '
    + `well's own corner rather than being drawn; at a fillet of ${Math.round(p.fillet * 100)}% that `
    + 'is a cast piece, and at nothing at all it is a plaid. The bar is this drawing\'s stroke against '
    + 'its width and the fillet is how much of its turning happens on a curve.';

  BECAUSE.tracery = (m, p, w) => `${w.fine} — ${p.forms} outlined forms on a ${p.cells}-cell lattice, `
    + `each reaching ${Math.round(p.reach * 100)}% of its own cell so they pass through one another. `
    + 'That overlap is the whole construction: forms that meet at their edges are a mosaic, and forms '
    + 'that cross make figures neither of them contains. Nothing is filled — a filled shape hides the '
    + 'lines behind it and the crossings stop happening — so it is one hairline everywhere, including '
    + 'where four lines meet.';

  BECAUSE.screen = (m, p, w) => `${w.fine} — a line screen of about ${p.pitch} rules ${p.run === 'rows'
    ? 'across' : 'down'} the tile, over a field of ${p.blocks} blocks. The screen is modulated: its `
    + `pitch travels ${Math.round(p.depth * 100)}% out and back over ${p.bands} passage`
    + `${p.bands === 1 ? '' : 's'}, so one flat colour reads light in one place and dense in another. `
    + 'A screen at one pitch is a stripe. '
    + `${p.mark > 0 ? `${named(p)} is in the block field as a region rather than as a drawing`
      : 'The blocks are dealt by the field, this drawing having no bitmap to read'}.`;

  BECAUSE.plate = (m, p, w) => `${w.fine} — ${p.blocks} blocks set out on a ${p.cells}-cell grid, with `
    + 'the setting-out left showing: the field they are snapped to, the lines that say where each one '
    + 'sits, and each block\'s own grid position printed at its corner. Those coordinates are real — '
    + 'a block tagged with a column and a row is at that column and that row — so two blocks never '
    + `carry the same tag. ${p.mark > 0 ? `About ${Math.round(p.mark * 100)}% of them carry ${named(p)}`
      : 'The blocks are plain'}.`;

  BECAUSE.strata = (m, p, w) => `${w.fine} — ${p.panels} panel${p.panels === 1 ? '' : 's'} of sky cut `
    + `into ${p.steps} flat steps, with an ordered dither along every boundary. Stepped rather than `
    + 'blended on purpose: a gradient prints as a band of mud and cannot be separated into two spot '
    + 'inks, and a stepped one reads the same at any size and is a decision somebody can count. The '
    + 'dither is a fixed threshold matrix rather than noise, so the same boundary breaks up the same '
    + `way twice and the tile comes round. ${p.mark > 0 ? `The skyline is ${named(p)}\u2019s own `
      + 'silhouette' : 'The skyline is built from this identity\u2019s proportions'}.`;

  BECAUSE.signage = (m, p, w) => `${w.fine} — the identity\u2019s own ${p.icons} icons, `
    + `${p.layout === 'scatter' ? 'thrown over the tile at mixed sizes with the wrapped distance between them'
      : p.layout === 'band' ? 'run in courses with plain leading between'
        : p.layout === 'single' ? 'one of them repeated on a lattice'
          : `set ${p.cells} to a rank`}, drawn ${p.way === 'stamp' ? 'as stamps knocked out of a tile '
            + 'whose corner is this mark\u2019s corner' : p.way === 'solid'
            ? 'at nearly twice the mark\u2019s weight, so they hold where a hairline would close up'
            : 'with the mark\u2019s own pen — same weight, same terminals'}. `
    + 'Every one of them is measured off the drawing rather than bought: change the logo and the whole '
    + `set redraws.${p.sector ? ` The last six are the ${p.sector} vocabulary.` : ''}`;

  BECAUSE.relief = (m, p, w) => `${w.fine} — a field ${p.cubes} cubes across, on a repeat unit `
    + `that brings ${named(p)} round every ${p.unit} of them. `
    + `${p.mark ? `Inside the drawing the cubes stand and outside it they lie flat, so the mark `
      + `is in relief rather than printed on the field` : 'The drawing could not be read as a '
      + 'bitmap, so the cubes are dealt at random'}; `
    + `${Math.round(p.flats * 100)}% of the ground stands anyway, to keep it from going blank.`;

  BECAUSE.oddgrid = (m, p, w) => `${w.fine} — ${p.grid} cells across, with the noise running at `
    + `${p.zoom} periods over the tile so the grain is finer than the drawing and the drawing is `
    + `the one large thing on the page. ${p.mark ? `${named(p)} pushes the fill threshold where it `
      + `has ink, ${p.repeat} time${p.repeat > 1 ? 's' : ''} across` : 'The drawing could not be '
      + 'read as a bitmap, so the field is noise alone'}.`;

  BECAUSE.quilt = (m, p, w) => `${w.fine} — ${p.cells} cells across, pieced into `
    + `${p.blocks}×${p.blocks} block${p.blocks > 1 ? 's' : ''}. ${w.round}, so the piecing is `
    + `${p.style}, cut into ${p.pieces} patches. `
    + `${p.mark ? `${named(p)} is the medallion, in the paper rather than in an ink, and `
      + `${p.flip ? 'mirrored with the rest of the block' : 'stamped upright — mirrored it would '
        + 'read backwards'}` : 'Nothing is the medallion: no bitmap could be taken of this drawing'}.`;

  BECAUSE.vee = (m, p, w) => `${w.fine} — ${p.count} bars at ${p.run}, over ${p.bands} bands `
    + `mirrored as a ${p.structure}. The angle is the drawing's own grain, laid on the nearest `
    + 'whole-step direction so the bars come back round at the tile edge exactly. '
    + `${p.mark ? `${named(p)} is counterchanged out of them — inside it the bar is the paper `
      + 'and the paper is the bar, so nothing at all is drawn on its edge'
      : 'The bars run unbroken: no bitmap could be taken of this drawing'}.`;

  BECAUSE.warp = (m, p, w) => `${named(p)} repeated ${p.cells} across at `
    + `${Math.round(p.size * 100)}% of its cell, and then bent: a ${p.kind} of `
    + `${p.frequency} whole periods at ${Math.round(p.warp * 100)}%. Whole periods, because a bend `
    + 'that does not come back round at the edge is a tile with a join in it — which is why the '
    + "keystone and the bulge this tool has elsewhere are not offered here.";

  BECAUSE.sampler = (m, p, w) => `${w.fine} — ${p.cols} tiles across in ${p.bands} bands, each `
    + `band dealing its own kinds and its own two inks. ${p.mark ? `${named(p)} is the ninth kind, `
      + `dealt at ${Math.round(p.mark * 100)}%` : 'The drawing could not be read as a shape, so the '
      + 'sampler is dealt from the eight geometric tiles'}. `
    + `Rotation is at ${Math.round(p.rotation * 100)}%, `
    + `${p.rotation < 0.5 ? 'held low because the shape is its own mirror and turning it changes little'
      : 'open because the shape is not its own mirror and turning it changes everything'}.`;

  BECAUSE.whorl = (m, p, w) => `${p.centres} centres and ${p.count} bands. `
    + `${p.mark ? `The centres are taken from where ${named(p)} has ink, spread apart so they land `
      + 'across the drawing rather than crowding one corner of it — so the contours pinch where '
      + 'the drawing is and open where it is not'
      : 'The centres are dealt at random: no bitmap could be taken of this drawing'}. `
    + `The field is warped ${Math.round(p.warp * 100)}% and measured with the chord distance on a `
    + 'torus, which is what lets a field of cones repeat at all.';

  BECAUSE.sprig = (m, p, w) => `${p.count} motifs placed by best candidate — twelve tries each, `
    + 'keeping the one furthest from everything already placed, measured round the edges of the '
    + `tile so the field is even across the join. ${p.mark ? `${Math.round(p.mark * 100)}% of them `
      + `are ${named(p)} itself, outlined the way a stroked mark is given a silhouette elsewhere `
      + 'in this engine, and drawn among the botanical set'
      : 'None of them is the mark: this drawing is strokes too fine to outline'}. `
    + `The pen is ${Math.round(p.weight * 100)}% weight, taken from how heavy the drawing is.`;

  BECAUSE.stipple = (m, p, w) => `${w.fine} — ${p.resolution} dots across, in ${p.mode} mode. `
    + `${p.mode === 'contour' ? 'A dot is kept where the field is steepest, so the dots gather '
      + 'along edges and read as contour lines'
      : 'A dot exists where the field beats the threshold and grows with how far above it sits, '
        + 'which is what a printed halftone does'}. `
    + `${p.mark ? `The field is ${named(p)} at ${Math.round(p.mark * 100)}%, with noise under it `
      + 'for a surface' : 'The field is noise alone: no bitmap could be taken of this drawing'}. `
    + "Both modes are normalised against the field's own range, so the threshold means the same "
    + 'thing whatever the drawing is.';

  BECAUSE.atlas = (m, p, w) => `${w.fine} — ${p.columns} columns of glyphs over ${p.terraces} `
    + `terraces, with the density rising band by band, which is the gradient that reads as `
    + `elevation. The glyphs are ${p.set === 'mark' ? `${named(p)} itself at glyph size`
      : `the ${p.set} set`} — drawn rather than set, because a tile that needed a font would look `
    + 'different on every machine that opened it. '
    + `${p.mark ? 'The high ground is where the drawing has ink.'
      : 'The terrain is noise: no bitmap could be taken of this drawing.'}`;

  BECAUSE.mosh = (m, p, w) => `${p.bands} bands of damage, dealt from a shuffled deck of the five `
    + 'failure modes so the page shows every one of them before it repeats any, all quantised to '
    + `${p.resolution} columns. ${p.mark ? `The signal under the damage is ${named(p)}: inside it `
      + 'the colour is drawn from the inks that read best on the ground and outside it from the '
      + 'ones that read least, which is what keeps the drawing legible through five kinds of '
      + 'corruption' : 'The signal is noise: no bitmap could be taken of this drawing'}.`;

  BECAUSE.pith = (m, p, w) => `${p.cells} cells across, ${p.resolution} samples. `
    + `${p.mark ? `The cells are seeded from ${named(p)} — dense and regular where the drawing has `
      + 'ink, loose and large where it has none — so the shape shows as a change of texture rather '
      + 'than as a change of colour' : 'The cells are seeded evenly: no bitmap could be taken of '
      + 'this drawing'}. `
    + `${w.round}, so the walls wobble ${Math.round(p.wobble * 100)}%. Every distance is measured `
    + 'on a torus, which is what makes a field of cells repeat.';

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
    if (generator === 'specimen') {
      const mo = params.motif || {};
      return `${fine} — a sheet ${params.columns} blocks across, `
        + `${Math.round(params.fill * 100)}% of them claimed and `
        + `${Math.round(params.spanning * 100)}% of those spanning more than one cell. `
        + `${params.identity ? `About ${Math.round(params.identity * 100)}% are this identity's own `
          + `drawings — ${mo.name ? `"${mo.name}"` : 'the mark'} and its logotype` : 'None of them '
          + 'is the mark: no shape could be read out of this drawing'}; the rest are rings, fans, `
        + 'arcs, loops and spikes cut from the palette.';
    }
    if (generator === 'kiosk') {
      const mo = params.motif || {};
      const w = params.word;
      return `${fine} — ${params.columns} columns of stamps over ${params.sweep} sweep bands and `
        + `${params.stripes} stripes. The stamps are `
        + `${w ? `this identity's own logotype and ${mo.name ? `"${mo.name}"` : 'its mark'}, `
          + 'half and half' : mo.name ? `"${mo.name}"` : 'the mark'} — set from the drawings the `
        + 'identity ships rather than from type, because the faces here are woff2 and a poster '
        + 'that re-set the name in one would be showing a client letters that are not theirs. '
        + 'A second, smaller pass sits on the grid intersections, which is what makes the page dense.';
    }
    if (generator === 'fete') {
      const mo = params.motif || {};
      return `${mo.name ? `"${mo.name}"` : 'The shape read out of the drawing'} inks `
        + `${Math.round((mo.ink || 0) * 100)}% of its own box, so the colour fields grow out of it `
        + `in ${params.bands} bands at ${params.patch} cells across. The same outline is drawn over `
        + `them as a line, with ${params.dots} dots — two in five of them beaded onto the line's own `
        + 'points rather than scattered.';
    }
    if (generator === 'totem') {
      const mo = params.motif || {};
      return `${fine} — everything lands on a unit of ${params.grain} across, so no edge is ever `
        + `between pixels. The left half is cut into ${params.regions} regions and mirrored; `
        + `${params.mirror >= 1 ? 'every twin keeps its motif, because the mark is its own mirror'
          : `${Math.round(params.mirror * 100)}% of twins keep their motif`}. `
        + `${params.core ? `${mo.name ? `"${mo.name}"` : 'The mark'} crowns the centre inside `
          + `${params.rings} rings` : 'Nothing crowns the centre: no shape could be read out of '
          + 'this drawing'}.`;
    }
    if (generator === 'riso') {
      const mo = params.motif || {};
      return `${round}, so the page is printed in ${params.bands} passes. `
        + `${params.mark ? `${mo.name ? `"${mo.name}"` : 'The mark'} is torn out over them at `
          + `${Math.round(params.mark * 100)}% of the short side` : 'Nothing is torn out: no shape '
          + 'could be read out of this drawing'}, at a tear of `
        + `${Math.round(params.rough * 100)}% — it inks ${Math.round((mo.ink || 0) * 100)}% of its `
        + 'own box, and a shape that solid holds its edge through a rough tear.';
    }
    if (generator === 'tokens') {
      const mo = params.motif || {};
      return `${fine} — a sheet ${params.grid} cells across, with ${params.count} clusters on it. `
        + `${params.markShare ? `${Math.round(params.markShare * 100)}% of the tokens are `
          + `${mo.name ? `"${mo.name}"` : 'the mark'}` : 'No token is the mark: no shape could be '
          + 'read out of this drawing'}, and the rest are circles and squares. They run at `
        + `${Math.round(params.size * 100)}% of a cell because the shape is `
        + `${(m.aspect || 1).toFixed(2)} as wide as it is tall; every cluster keeps a cell of `
        + 'clearance, so no two badges touch.';
    }
    if (generator === 'static') {
      const mo = params.motif || {};
      return `the page is resolved to ${params.resolution} bits across, which is what `
        + `${mo.name ? `"${mo.name}"` : 'the shape read out of the drawing'} needs to survive being `
        + `made of bits — ${mo.moves || 0} moves to draw. The top region is the mark and the rest `
        + `are the tool's own rules; then ${Math.round(params.glitch * 100)}% glitch shifts rows `
        + 'sideways, smears rows downward and punches rectangles out of all of it alike.';
    }
    if (generator === 'parcel') {
      const mo = params.motif || {};
      const grown = Math.round((params.coverage - 0.5) * 6);
      return `${fine} — the mark resolved onto a grid ${params.cells} cells across, `
        + `${mo.name ? `"${mo.name}"` : 'the shape read out of the drawing'} at `
        + `${Math.round(params.chunk * 100)}% of the page`
        + `${grown ? `, ${grown > 0 ? 'grown' : 'shrunk'} ${Math.abs(grown)} cells` : ''}. `
        + `${params.grids} survey clusters are laid over it, sharing borders so no line is `
        + 'stroked twice.';
    }
    if (generator === 'modular') {
      const mo = params.motif || {};
      const total = ['empty', 'solid', 'blocks', 'dots', 'lines', 'mark']
        .reduce((a, k) => a + (params[k] || 0), 0) || 1;
      const carries = params.mark
        ? `About ${Math.round((params.mark / total) * 100)}% of the modules are `
          + `${mo.name ? `"${mo.name}"` : 'the mark'}, knocked out of an ink panel`
        : 'No module carries the mark: no shape could be read out of this drawing';
      return `${fine} — a grid ${params.modules} modules across, each subdividing into `
        + `${params.unit}. ${carries}. The grid merges ${Math.round(params.merging * 100)}% of the `
        + `time, because the mark is ${(m.aspect || 1).toFixed(2)} as wide as it is tall.`;
    }
    if (generator === 'optic') {
      const mo = params.motif || {};
      const what = params.figure === 'mark' && mo.name ? `"${mo.name}"` : `a ${params.figure}`;
      return `${fine} — ${params.stripes} bars across the page. The figure is ${what}, `
        + `cut out of them at ${Math.round(params.size * 100)}% of the short side and filled with `
        + `the same bars moved, so nothing is drawn on its edge and it reads as the page inverting `
        + `rather than as a shape laid on top.`;
    }
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
    if (BECAUSE[generator]) return BECAUSE[generator](m, params, { fine, round });
    const heldWide = params.stripe >= COARSEST_STRIPE && 1 / scaleFrom(m) > COARSEST_STRIPE;
    const scale = heldWide
      ? `the mark is heavy enough to allow a stripe of ${((1 / scaleFrom(m)) * 100).toFixed(0)}% of the tile, `
        + `which would leave under four of them, so it is held at ${(COARSEST_STRIPE * 100).toFixed(0)}%`
      : `${fine} — a stripe is ${(params.stripe * 100).toFixed(1)}% of the tile`;
    return `${scale}. And ${round}, so the corners are rounded ${Math.round(params.rounding * 100)}%.`;
  }

  /* The reason, with the effect layers named.

     A tile with three layers switched on is not the tile the generator's own
     sentence describes, and a manual that printed only the generator's half
     would be describing something the client is not looking at. Named in the
     order they stack, because that is the order they act in. */
  function whyWith(why, params) {
    const on = layers.active(params);
    if (!on.length) return why;
    const names = on.map((k) => layers.LAYERS[k].label);
    const last = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
      : names[0];
    return `${why} Over that: ${last}, in that order — `
      + `${on.length === 1 ? 'an effect layer' : 'effect layers'} switched on in the studio and `
      + 'recorded in brand.json, so a rebuild returns this tile and not the plain one.';
  }

  // One tile, as SVG.
  /* Everything about a pattern except the picture.

     A tile is two things stuck together: the numbers this identity's artwork
     asks a generator for, and the several hundred kilobytes of SVG that comes
     out when those numbers are drawn. The second costs 33 ms and the first
     costs a seventh of a millisecond — measured across all thirty-eight, 1268
     ms against 5 — and for most of a package only the first is wanted.

     Which is what made the package five times bigger than it needed to be.
     Every generator was drawn in every colourway and written, so a client
     opening 07-pattern found a hundred and ninety-two files of which they
     would use one, and the thirty seconds that went into the other hundred and
     ninety-one went into a folder nobody reads to the end.

     So the recipe is separable from the picture, and the build writes pictures
     for the patterns this identity is actually being handed and recipes for
     the rest. A recipe is not a lesser thing: brand.json carries it, the studio
     draws from it, and a rebuild from it returns the same bytes the full sheet
     would have. Nothing became unreachable; it stopped being pre-rendered. */
  function recipe(opts) {
    const o = opts || {};
    const m = o.mark || late('mark').read(o.markSource, o.measured, o.rules);
    const generator = GENERATORS[o.generator] ? o.generator : suits(m);
    const g = GENERATORS[generator];
    const route = ROUTES.indexOf(o.route) > -1 ? o.route : ROUTE_DEFAULT;
    const carries = !!g.motif;
    if (g.needsMotif && !o.motif) {
      throw new Error(`${generator} draws nothing but the mark's own shape, and no shape `
        + 'could be read out of this drawing');
    }
    const params = Object.assign(derive(generator, m, route, o.motif),
      o.motif && carries ? { motif: o.motif } : {},
      o.word && g.word ? { word: o.word } : {}, o.params || {});
    const pal = o.palette || palette.of(o.colours, o.colourway);
    return {
      generator, params, route, mark: m, kind: kindOf(generator),
      tiles: tilesOf(generator),
      motif: !!(o.motif && carries && (route === 'motif' || o.params && o.params.motif)),
      why: whyWith(because(generator, m, params), params),
      vector: !!g.vector, pal,
      palette: { ground: pal.ground, inks: pal.inks.map((i) => i.hex) },
      effects: layers.active(params),
    };
  }

  function tile(opts) {
    const o = opts || {};
    // The recipe first, and then the picture.
    //
    // These were two functions that assembled the parameters the same way and
    // could stop doing so. brand.json keeps recipes for the patterns a package
    // does not draw and tells a client that drawing one returns the same bytes
    // a drawn one would have — a claim that two independent copies of this
    // arithmetic would quietly break rather than fail. So there is one copy,
    // and a tile is a recipe that has been painted.
    const r = recipe(o);
    const { generator, params, pal } = r;
    const g = GENERATORS[generator];
    // A tile is square; a poster is cut at its own proportion. `paint` has
    // always taken width and height separately, so this is the only line that
    // had to learn the difference.
    const W = o.size || 100;
    const H = Math.round((W / ratioOf(generator)) * 1000) / 1000;
    const s = surface.svg({ width: W, height: H, id: o.id || generator });
    // The generator, inside whatever effects are switched on. With none on this
    // is one call and the tile is byte for byte what it always was — which is
    // what keeps every package in this repository unchanged until somebody asks
    // for an effect.
    layers.paint(s, W, H, params, pal, (surf, palette2) => g.paint(surf, W, H, params, palette2 || pal));
    return Object.assign({}, r, {
      width: W, height: H,
      tile: s.toSVG(),
      body: s.body(),
      // the same paint, for anything that wants to draw it rather than read it —
      // the seam check included, so a tile is checked with its effects on.
      paint: (surf, w, h) => layers.paint(surf, w, h, params, pal,
        (s2, p2) => g.paint(s2, w, h, params, p2 || pal)),
    });
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

  return { GENERATORS, NAMES, ROUTES, ROUTE_DEFAULT, suits, derive, because, tile, recipe, joins, read,
    LAYERS: layers,
    latticeFrom, posterFrom, patternFrom, kindOf, GROUPS, CHOSEN, ratioOf, tilesOf, TILING, CATALOGUE,
    PATTERNS, TEXTURES, POSTERS,
    FINEST, COARSEST_STRIPE, FINEST_STRIPE, COARSEST_GRID, LEAST_WEAVE,
    MOTIF_SMALLEST, MOTIF_LARGEST, SYMMETRIC,
    WEAVE_STYLES, ZIGZAG_STYLES, QUILT_STYLES };
}));
