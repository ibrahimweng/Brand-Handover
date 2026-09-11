/* Matching a pattern the client already has.

   Not a trace. A trace of a client's pattern *is* their pattern, redrawn: it
   cannot be recoloured for a second colourway, cannot be re-scaled for a bag
   after being drawn for a letterhead, and cannot be regenerated at all. It is a
   picture of a decision rather than the decision, which is the exact thing this
   engine exists not to hand over.

   So: measure theirs, generate ours, measure ours **with the same six
   measurements**, and print both columns. The claim is then one anybody can
   check — "yours repeats every 42 px, ours every 44; yours is 61% ink, ours
   59%" — which is the only kind of claim this engine is allowed to make.

   The search is deterministic and it is small. Every generator says which
   knobs matching may turn and what values it may try; the starting point comes
   from inverting what inverts directly (a period is a cell count, an ink share
   is a fill); and every candidate is scored by rendering it and measuring the
   render. Nothing here scores a parameter set by reasoning about what it ought
   to look like.

   With no reference pattern, the same six measurements run on the logo
   instead. One input swapped and nothing else changes — which is the point of
   the six being measurements of a picture rather than of a pattern. */
'use strict';

const measure = require('./measure');

// A tile is rendered at this many pixels for measuring. Large enough that a
// period of a few dozen cells is several pixels wide — measure a 36-cell
// pattern at 256 px and each cell is seven pixels, which is enough to have a
// period and not enough to have an edge.
const LOOK = 512;
// Two generators whose scores differ by less than this measure the same, on the
// evidence in the comment at `alsoFits` in fit() below.
const TIE = 0.025;

// Which knobs matching is allowed to turn, and what it may set them to.
//
// Not every control: a matcher given the whole rig finds some corner that
// scores well and looks nothing like a brand pattern, and the client is handed
// parameters no one would have chosen. These are the ones that answer the
// measurements — how big, how much ink, how sharp, which way — and the rest
// keep the values the mark chose.
const KNOBS = {
  weave: {
    cells: [8, 12, 16, 24, 32, 48, 64, 72],
    style: null,                      // every style it has
    chunk: [0.7, 1, 1.4, 2],
  },
  zigzag: {
    stripe: [0.03, 0.05, 0.08, 0.12, 0.18, 0.25],
    style: null,
    length: [0.08, 0.15, 0.25, 0.4],
  },
  field: {
    cells: [12, 16, 24, 36, 48, 72, 108],
    style: null,
    fill: [0.3, 0.45, 0.6, 0.75],
  },
  thread: {
    grain: ['open', 'close'],
    style: null,
    density: [0.5, 1, 1.6],
    weight: [2, 5, 9, 14],
  },
  terrace: {
    scale: [1, 2, 3, 5, 8],
    style: null,
    bands: [3, 5, 8, 12],
    // Softness, and the two things that fight it. Dither is grain, and grain is
    // a jump at every lattice cell: at 0.3 it pulls a fully softened field from
    // 3.4 px back to 1.1, which is right and is also why matching a soft
    // reference has to be allowed to turn it down. Without these two in reach
    // the search cannot get to softness at all, and the engine would go on
    // saying it does not draw one while holding the control that does.
    // Softness and grain move **together**, as one knob with four settings.
    //
    // They have to. The search is coordinate descent — one knob at a time — and
    // softening alone while dither stays at 0.3 buys almost nothing, because
    // grain is a jump at every lattice cell and it holds the measured edge at
    // about a pixel whatever the bands do. Turning dither down alone buys
    // nothing either, because the bands are still cut with a knife. Each move
    // is worthless and the pair is worth a great deal, so a search that can
    // only take one at a time never takes either: it reported `soften:
    // undefined` on a reference built to need it and said the engine could not
    // draw one, while holding the control that does.
    edge: [
      { soften: 0, dither: 0.3 },       // contours, grained — what it always did
      { soften: 0.5, dither: 0.15 },
      { soften: 1, dither: 0.05 },
      { soften: 1, dither: 0 },         // a wash
    ],
  },
};

// Render any tile — vector or raster — to a field, so the six measurements
// read it exactly as they read the client's own picture. This is the join that
// makes the two columns comparable, and it is the one place where a difference
// between the two would be invisible and fatal.
function asField(t, px) {
  const w = px || LOOK;
  const PT = require('./index');
  const g = PT.GENERATORS[t.generator];
  if (g && g.vector === false && g.render) {
    return g.render(w, w, t.params, t.pal);
  }
  const img = require('./seam').pixels(t.tile, w);
  return { width: img.w, height: img.h, data: img.px };
}

// How far apart are two readings? Every term is scaled so that "one" means
// about as wrong as the others' "one", and the weights say which of them a
// designer would notice first.
//
// Scale is a ratio, not a difference: 40 px against 44 is a good match and 4 px
// against 8 is a bad one, though both differ by the same amount on one of the
// two readings and by four on the other.
function distance(theirs, mine, weights) {
  const parts = {};
  const a = Math.max(0.5, theirs.scale.across), b = Math.max(0.5, mine.scale.across);
  parts.scale = Math.abs(Math.log(b / a)) / Math.log(2);          // 1 = an octave out
  parts.coverage = Math.abs(theirs.coverage - mine.coverage) / 0.5;
  parts.hardness = Math.abs(theirs.hardness.value - mine.hardness.value);
  parts.regularity = Math.abs(theirs.scale.regularity - mine.scale.regularity);
  // Direction is a vector, not an angle, and taking it as an angle got this
  // wrong twice over. Weighting the angle by the *weaker* of the two leans —
  // so two even fields have nothing to disagree about — also means a picture
  // that leans hard and one that does not lean at all score as agreeing, which
  // is the plainest mismatch there is. And an angle on its own says a field
  // with no direction is 90° away from one with none, because 0 and 90 are
  // numbers whatever they are attached to.
  //
  // As a vector at twice the angle — twice, because a line has no arrow on it —
  // both fall out: two even fields are two short vectors near the origin, a
  // strong lean against no lean is a whole vector's length apart, and two
  // strong leans differ by how far apart they point.
  const vec = (o) => [o.strength * Math.cos(2 * o.angle * Math.PI / 180),
    o.strength * Math.sin(2 * o.angle * Math.PI / 180)];
  const [ax, ay] = vec(theirs.orientation), [bx, by] = vec(mine.orientation);
  parts.orientation = Math.hypot(ax - bx, ay - by) / 2;
  // How thick the ink is, as a ratio — thickness is multiplicative the way
  // scale is, and 4 px against 8 is the same distance as 20 against 40.
  const tw = Math.max(1, (theirs.weight || {}).px || 1), mw = Math.max(1, (mine.weight || {}).px || 1);
  parts.weight = Math.abs(Math.log(mw / tw)) / Math.log(3);
  parts.axiality = Math.abs(((theirs.axiality || {}).value || 0) - ((mine.axiality || {}).value || 0));
  const W = weights || WEIGHTS.pattern;
  let total = 0, weight = 0;
  for (const k of Object.keys(W)) {
    if (!W[k]) continue;
    total += W[k] * parts[k]; weight += W[k];
  }
  return { total: weight ? total / weight : 0, parts };
}

// What a match is scored on, and it is not the same question twice.
//
// **Against a pattern** all six transfer, because both pictures are patterns:
// if theirs repeats every 40 px and ours every 90, that is the match failing.
//
// **Against a logo** they do not, and pretending otherwise measures the wrong
// thing confidently. A mark has no period — it is one drawing, not a repeat —
// so the autocorrelation of a logo reports the width of a stroke or nothing at
// all. And its ink share is the share *inside its own box*, which is not the
// share a pattern made from it should carry: kvist's mark is 6% ink, and a
// pattern at 6% ink is a nearly empty page. Matching those two rows drove
// every sparse mark to the same answer and scored it 0.4 — correctly, since it
// was answering a question nobody asked.
//
// What does carry from a mark to its pattern is how its edges behave and
// whether it leans; the rest of the argument is `derive()`'s, which reads the
// mark's fineness and curviness and has been the route from mark to pattern
// since Round B. This is a refinement of that, not a replacement for it.
//
// `weight` and `axiality` were added after the first six were measured and found
// not to separate `field`, `thread` and `terrace` at all. Thickness tells a
// stroke from a block — thread measures 3.3 to 9.1 px across eight identities
// and field 17.5 to 68.1, with nothing in between — and axiality tells a grid
// from a contour: field 0.77 to 0.96, terrace 0.02 to 0.12. Neither is a
// refinement of the six; they are the axis the six were missing.
const WEIGHTS = {
  pattern: { scale: 1.6, coverage: 1.3, orientation: 1, weight: 1.2, axiality: 1,
    hardness: 0.8, regularity: 0.6 },
  // A mark has a thickness and a squareness as much as a pattern does, and both
  // carry: a geometric mark of even strokes should not be handed a field of
  // curved contours. Its period and its ink share still do not.
  logo: { scale: 0, coverage: 0.3, orientation: 1, weight: 0.8, axiality: 1,
    hardness: 1.5, regularity: 0 },
};

// Every parameter set the search will try for one generator: the starting
// point, then one knob moved at a time from it. Not the whole product of the
// knobs — that is thousands of renders for an answer that is no better — and
// not one pass either: the whole thing runs `rounds` times, each round
// starting from the best set the last one found. Coordinate descent, which is
// deterministic, and which stops when a round finds nothing better.
function candidates(gen, from, knobs) {
  const out = [];
  for (const key of Object.keys(knobs)) {
    let values = knobs[key];
    if (values === null && key === 'style') values = gen.styles;
    if (!values) continue;
    for (const v of values) {
      // A value may be a whole set of parameters rather than one, for knobs
      // that are only worth anything together — see `edge` above. Coordinate
      // descent cannot climb out of a pair where each half alone is worthless,
      // so the pair is declared as one move.
      if (v && typeof v === 'object') {
        if (Object.keys(v).every((k) => from[k] === v[k])) continue;
        out.push(Object.assign({}, from, v));
        continue;
      }
      if (from[key] === v) continue;
      // Choosing a style brings that style's own settings with it, where it
      // declares any. A look that only exists as a combination is not reachable
      // by changing its name and keeping the last one's numbers.
      const brings = key === 'style' && gen.defaultsFor ? gen.defaultsFor(v) : null;
      out.push(Object.assign({}, from, brings || {}, { [key]: v }));
    }
  }
  return out;
}

// What inverts directly, before any search. A period is a cell count; an ink
// share is a fill. Starting the search here rather than at the mark's own
// parameters is worth about a third of the final score, and it costs nothing.
function opening(name, base, theirs) {
  const p = Object.assign({}, base);
  const across = theirs.scale.found ? theirs.scale.across : null;
  const near = (want, list) => list.reduce((b, v) => (Math.abs(v - want) < Math.abs(b - want) ? v : b), list[0]);
  if (across) {
    if (name === 'weave' || name === 'field') p.cells = near(Math.round(across), KNOBS[name].cells);
    if (name === 'zigzag') p.stripe = near(1 / (across * 2), KNOBS.zigzag.stripe);
    if (name === 'terrace') p.scale = near(Math.max(1, Math.round(across / 8)), KNOBS.terrace.scale);
    if (name === 'thread') p.grain = across > 5 ? 'close' : 'open';
  }
  if (name === 'field' && theirs.coverage != null) {
    p.fill = near(theirs.coverage, KNOBS.field.fill);
  }
  return p;
}

// Measure one candidate by drawing it. `make` builds a tile from a parameter
// set — the caller supplies it, so this file never has to know how a tile is
// put together or where the colours come from.
function readBack(make, name, params, px) {
  const t = make(name, params);
  return { tile: t, read: measure.all(asField(t, px)) };
}

/* Match a reference against every generator.

   `reference` is a field — a client's PNG decoded, their SVG rasterised, or
   their logo drawn. `make(generator, params)` returns a tile. Everything else
   is optional and has a default that says what it is.

   Returns the winner, every generator's score, and the two columns. */
function fit(reference, make, opts) {
  const o = opts || {};
  const px = o.px || LOOK;
  const rounds = o.rounds == null ? 3 : o.rounds;
  const PT = require('./index');
  const only = o.generators || PT.NAMES;
  const theirs = o.measured || measure.all(reference);
  // 'pattern' when the reference is a pattern the client has, 'logo' when it is
  // their mark and there is no pattern to go on. The two score different rows.
  const W = WEIGHTS[o.against === 'logo' ? 'logo' : 'pattern'];

  const tried = [];
  let seen = 0;
  for (const name of only) {
    const gen = PT.GENERATORS[name];
    const knobs = KNOBS[name];
    if (!gen || !knobs) continue;
    const base = make(name, null).params;
    let best = null;
    let at = o.against === 'logo' ? Object.assign({}, base) : opening(name, base, theirs);
    let cur = readBack(make, name, at, px); seen++;
    best = { params: at, read: cur.read, tile: cur.tile, d: distance(theirs, cur.read, W) };
    for (let r = 0; r < rounds; r++) {
      let moved = false;
      for (const cand of candidates(gen, best.params, knobs)) {
        const got = readBack(make, name, cand, px); seen++;
        const d = distance(theirs, got.read, W);
        if (d.total < best.d.total - 1e-9) {
          best = { params: cand, read: got.read, tile: got.tile, d };
          moved = true;
        }
      }
      if (!moved) break;
    }
    tried.push({ generator: name, params: best.params, mine: best.read, tile: best.tile,
      score: Math.round(best.d.total * 1000) / 1000, parts: best.d.parts });
  }
  tried.sort((a, b) => a.score - b.score);
  const won = tried[0] || null;
  // Rows no generator could reach.
  //
  // Every one of the five draws with a knife edge — the softest any of them
  // measures is 0.91, where a step is 1.00 — because all five quantise: weave
  // and field to a cell, zigzag to a stripe, thread to a stroke, terrace to a
  // band. So a reference with edges over four pixels loses that row against
  // every generator, every time, and a score on its own makes a wall look like
  // a near miss.
  //
  // A client whose pattern is an airbrushed gradient should be told this engine
  // does not draw one, in a sentence, beside the row it is about — rather than
  // handed a hard-edged pattern and a number. Taken from what the search
  // actually measured, so it cannot claim a limit the generators do not have.
  const beyond = [];
  if (won && tried.length) {
    const nearest = (pick) => tried.reduce((b, t) => {
      const d = Math.abs(pick(theirs) - pick(t.mine));
      return d < b.d ? { d, at: pick(t.mine), generator: t.generator } : b;
    }, { d: Infinity, at: null, generator: null });
    const px = (v) => Math.round((1 / Math.max(v, 1e-9)) * 10) / 10;
    const h = nearest((r) => r.hardness.value);
    if (h.d > 0.35) {
      beyond.push({ key: 'edgesOver', says: `none of the ${tried.length} generators draws an `
        + `edge that soft — they all quantise, to a cell, a stripe, a stroke or a band. Yours `
        + `softens over ${theirs.hardness.width} px; the softest this engine draws is ${px(h.at)} px.` });
    }
    const c = nearest((r) => r.coverage);
    if (c.d > 0.2) {
      beyond.push({ key: 'ink', says: `none of the ${tried.length} generators carries that much `
        + `ink or that little: yours is ${Math.round(theirs.coverage * 100)}% and the nearest `
        + `this engine reaches is ${Math.round(c.at * 100)}%.` });
    }
  }
  // Which other generators measure the same as the winner.
  //
  // This used to be load-bearing. On six measurements the three field
  // generators were one family — right seven times in ten by margins of 0.004
  // to 0.021 — and reporting the ties was the only honest thing to do, because
  // which of them won was inside the noise.
  //
  // With thickness and axiality added the same twenty runs come back **right
  // twenty times out of twenty**, by margins of 0.031 to 0.158 for those three
  // and 0.093 to 0.376 for the other two. The ties are gone, which is the
  // answer to the problem rather than a way of living with it.
  //
  // It stays, because it is still true that two generators can measure the same
  // on a client's picture even if they no longer do on each other's, and
  // because the pattern is a good match either way when they do. TIE sits below
  // the smallest margin now measured (0.031).
  const alsoFits = won ? tried.slice(1).filter((t) => t.score - won.score <= TIE)
    .map((t) => ({ generator: t.generator, score: t.score, params: t.params })) : [];
  return {
    theirs,
    generator: won ? won.generator : null,
    params: won ? won.params : null,
    mine: won ? won.mine : null,
    tile: won ? won.tile : null,
    score: won ? won.score : null,
    against: o.against === 'logo' ? 'logo' : 'pattern',
    scored: Object.keys(W).filter((k) => W[k] > 0),
    ranked: tried.map((t) => ({ generator: t.generator, score: t.score, parts: t.parts })),
    rendered: seen,
    // Named, not buried: a client shown one answer should be shown the ones
    // that measure the same as it.
    alsoFits,
    // What no generator could reach, named row by row.
    beyond,
    table: won ? columns(theirs, won.mine, o.against === 'logo' ? WEIGHTS.logo : null,
      beyond, won.parts) : null,
    verdict: Object.assign(verdict(won ? won.score : null),
      alsoFits.length ? {
        tied: alsoFits.map((a) => a.generator),
        also: `${alsoFits.map((a) => a.generator).join(' and ')} `
          + `${alsoFits.length === 1 ? 'measures' : 'measure'} the same as this one, so `
          + `${alsoFits.length === 1 ? 'either' : 'any of them'} would match; this was closest `
          + `by ${(alsoFits[0].score - won.score).toFixed(3)}`,
      } : {},
      beyond.length ? { beyond: beyond.map((b) => b.says) } : {}),
  };
}

// The two columns. Every row is a number off a picture, and both numbers come
// off their picture the same way — which is the whole claim.
//
// Both columns are in **one ruler**. A period is in pixels, and pixels are not
// a property of a pattern: their picture is 512 px wide and the tile drawn to
// compare with it was rendered at 256, so the same pattern read 64 px and 32 px
// and the row said the match was half the size it was. Ours is restated at the
// width of theirs — which is what "the same size" means when one of the two is
// a vector that has no size at all.
function columns(theirs, mine, weights, outOfReach, parts) {
  const pc = (v) => `${Math.round(v * 100)}%`;
  const ruler = theirs.size.width;
  const ourPeriod = mine.scale.across > 0 ? Math.round(ruler / mine.scale.across) : null;
  // Each row carries a key and, where the answer is a word rather than a
  // number, a token — never the English. A measurement is a number; how it is
  // said belongs to a language, and this table is printed in four of them. The
  // English in `label` is for brand.json and the read me, which are English.
  const mm = (v, u) => ({ n: v, unit: u });
  const sq = (a) => ({ 'every way': 'everyWay', 'square to the page': 'squareToPage',
    diagonal: 'onTheDiagonal', none: 'none' }[(a || {}).kind] || 'none');
  const rows = [
    { key: 'repeatEvery', label: 'Repeats every',
      theirs: theirs.scale.found ? mm(theirs.scale.period, 'px') : { say: 'noRepeat' },
      ours: mine.scale.found && ourPeriod ? mm(ourPeriod, 'px') : { say: 'noRepeat' } },
    { key: 'repeatAcross', label: 'Repeats across',
      theirs: theirs.scale.found ? mm(theirs.scale.across, '') : { say: 'none' },
      ours: mine.scale.found ? mm(mine.scale.across, '') : { say: 'none' } },
    { key: 'ink', label: 'Ink',
      theirs: mm(Math.round(theirs.coverage * 100), '%'), ours: mm(Math.round(mine.coverage * 100), '%') },
    { key: 'runsAt', label: 'Runs at',
      theirs: theirs.orientation.kind === 'even' ? { say: 'noDirection' } : mm(theirs.orientation.angle, '°'),
      ours: mine.orientation.kind === 'even' ? { say: 'noDirection' } : mm(mine.orientation.angle, '°') },
    { key: 'edgesOver', label: 'Edges over',
      theirs: mm(theirs.hardness.width, 'px'), ours: mm(mine.hardness.width, 'px') },
    { key: 'repeatKind', label: 'Repeat or tendency',
      theirs: { say: theirs.scale.regularity >= 0.5 ? 'aRepeat' : 'aTendency' },
      ours: { say: mine.scale.regularity >= 0.5 ? 'aRepeat' : 'aTendency' } },
    { key: 'inkThickness', label: 'Ink is',
      theirs: mm((theirs.weight || {}).px || 0, 'px'), ours: mm((mine.weight || {}).px || 0, 'px') },
    { key: 'squareness', label: 'Lined up',
      theirs: { say: sq(theirs.axiality) }, ours: { say: sq(mine.axiality) } },
  ];
  // Which measurement each row is about. Declared here, above every use of it:
  // it was moved below the first one and `const` does not hoist, so every logo
  // match died on "Cannot access 'OF' before initialization" — a whole feature
  // broken by a tidy-up, and caught only because there is a test that matches a
  // logo.
  const OF = { repeatEvery: 'scale', repeatAcross: 'scale', ink: 'coverage',
    runsAt: 'orientation', edgesOver: 'hardness', repeatKind: 'regularity',
    inkThickness: 'weight', squareness: 'axiality' };

  // Against a logo, the rows that were not scored are marked, so nobody reads a
  // row the engine was not trying to match as one it tried and missed.
  if (weights) {
    for (const r of rows) if (!weights[OF[r.key]]) r.note = 'notMatched';
  }
  // Three states, not two, and the difference matters to whoever reads it.
  //
  // A row can be one this engine cannot reach at all; one this match missed
  // though something in the engine could have hit it; or one that landed. They
  // were collapsed into two, and the moment a soft look was added the salvage
  // table went from saying "beyond what this engine draws" to saying nothing —
  // printing 4.4 px beside 1 px with no mark on it, which reads as a match.
  // What is true there is that the engine *can* be that soft but not while also
  // repeating every 96 px, and "missed" is the word for that.
  if (parts) {
    for (const r of rows) {
      if (r.note) continue;
      const part = parts[OF[r.key]];
      if (part != null && part > 0.35) r.note = 'missed';
    }
  }
  if (outOfReach) {
    for (const b of outOfReach) {
      const row = rows.find((r) => r.key === b.key);
      if (row) row.note = 'beyond';
    }
  }
  return {
    rows, ruler,
    // Colour is not matched and saying so is the honest thing: the pattern is
    // drawn in the identity's own inks, because a brand pattern in somebody
    // else's colours is somebody else's pattern.
    colour: { theirs: theirs.palette.slice(0, 6).map((c) => c.hex),
      ours: mine.palette.slice(0, 6).map((c) => c.hex),
      note: 'colour comes from the identity, not from the reference' },
  };
}

// Is it a match, or is it the closest this engine can get? The bands are named
// so nobody has to read a score, and the wording is what the manual prints.
//
// The numbers come from the run in test/run.js that hands each generator its
// own output back: a pattern matched against itself scores 0.000 to 0.009, and
// the next generator along scores 0.02 to 0.37. So "close" is well under that
// gap, and anything past 0.35 is being called what it is.
function verdict(score) {
  if (score == null) return { kind: 'none', says: 'nothing was matched' };
  if (score <= 0.05) return { kind: 'close', says: 'the two measure the same, row for row' };
  if (score <= 0.15) return { kind: 'near', says: 'close on every measurement that matters' };
  if (score <= 0.35) return { kind: 'family', says: 'the same kind of pattern, not the same pattern' };
  return { kind: 'far', says: 'this is the closest of the five, and it is not close' };
}

// A client's own pattern, whichever way it arrived, as a field the six
// measurements read exactly as they read one of ours. PNG is decoded; SVG is
// rasterised. Both come out as RGBA at the same size, because a comparison
// between two pictures measured different ways is not a comparison.
function referenceField(asset, px) {
  const w = px || LOOK;
  if (!asset) return null;
  if (asset.mime === 'image/png' || (asset.bytes && !asset.source)) {
    const { decode } = require('fast-png');
    const img = decode(asset.bytes);
    // fast-png gives whatever the file holds — 8 or 16 bits, grey, grey+alpha,
    // RGB, RGBA, or a palette index. All of it becomes RGBA eight-bit here, in
    // one place, rather than at each measurement.
    return toRGBA(img);
  }
  const src = asset.source || String(asset);
  const img = require('./seam').pixels(src, w);
  return { width: img.w, height: img.h, data: img.px };
}

function toRGBA(img) {
  const { width, height, depth, channels, data, palette } = img;
  const out = new Uint8Array(width * height * 4);
  const max = depth === 16 ? 65535 : 255;
  const to8 = (v) => Math.round((v / max) * 255);
  for (let i = 0; i < width * height; i++) {
    let r, g, b, a = 255;
    if (palette && palette.length) {
      const c = palette[data[i]] || [0, 0, 0];
      r = c[0]; g = c[1]; b = c[2];
    } else if (channels === 1) { r = g = b = to8(data[i]); }
    else if (channels === 2) { r = g = b = to8(data[i * 2]); a = to8(data[i * 2 + 1]); }
    else if (channels === 3) { r = to8(data[i * 3]); g = to8(data[i * 3 + 1]); b = to8(data[i * 3 + 2]); }
    else { r = to8(data[i * 4]); g = to8(data[i * 4 + 1]); b = to8(data[i * 4 + 2]); a = to8(data[i * 4 + 3]); }
    out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b; out[i * 4 + 3] = a;
  }
  return { width, height, data: out };
}

// With no reference pattern, the logo is the reference. One input swapped and
// nothing else changes, which is the whole reason the six are measurements of
// a picture rather than of a pattern: a mark has colours, a coverage, a
// direction and an edge hardness exactly as a pattern does, and the ones it has
// are the ones its identity already lives by.
//
// It is rasterised on the identity's own ground rather than on white, because
// a mark measured on paper it will never be printed on is measured wrong: a
// dark mark on a dark ground is 40% ink and on white it is 8%.
function logoField(markSource, px, ground) {
  const w = px || LOOK;
  const bg = ground || '#ffffff';
  // The mark, laid on a square of its ground, so coverage means what it says.
  const box = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${w}" height="${w}">`
    + `<rect x="0" y="0" width="100" height="100" fill="${bg}"/>`
    + `<g transform="translate(10 10) scale(0.8)">`
    + `<svg viewBox="${viewBoxOf(markSource)}" width="100" height="100">${inner(markSource)}</svg>`
    + `</g></svg>`;
  const img = require('./seam').pixels(box, w);
  return { width: img.w, height: img.h, data: img.px };
}
const viewBoxOf = (svg) => {
  const m = /viewBox\s*=\s*"([^"]+)"/.exec(String(svg));
  return m ? m[1] : '0 0 100 100';
};
const inner = (svg) => String(svg).replace(/^[\s\S]*?<svg[^>]*>/i, '').replace(/<\/svg>\s*$/i, '');

module.exports = { fit, distance, columns, verdict, asField, logoField, referenceField, toRGBA, WEIGHTS, TIE, opening, candidates, KNOBS, LOOK };
