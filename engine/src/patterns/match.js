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
const WEIGHTS = {
  pattern: { scale: 1.6, coverage: 1.3, orientation: 1, hardness: 0.8, regularity: 0.6 },
  logo: { scale: 0, coverage: 0.3, orientation: 1, hardness: 1.5, regularity: 0 },
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
      if (from[key] === v) continue;
      out.push(Object.assign({}, from, { [key]: v }));
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
  // Which other generators measure the same as the winner.
  //
  // This is not hedging, it is what twenty runs say. Handing each generator its
  // own output back and asking which one drew it, over two identities at two
  // resolutions: weave and zigzag come back right every time, by margins of
  // 0.026 to 0.465. The three field generators come back right seven times in
  // ten, by margins of 0.004 to 0.021 — which is to say they are one family
  // under these six measurements, and which of them wins is inside the noise.
  //
  // The pattern is a good match either way; that is what a small margin means.
  // So the engine says so, the studio can offer the others as chips, and the
  // manual names them. TIE sits in the gap between the largest tied margin
  // (0.021) and the smallest decisive one (0.026) — a narrow gap, said to be
  // narrow rather than rounded to something comfortable.
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
    table: won ? columns(theirs, won.mine, o.against === 'logo' ? WEIGHTS.logo : null) : null,
    verdict: Object.assign(verdict(won ? won.score : null),
      alsoFits.length ? {
        tied: alsoFits.map((a) => a.generator),
        also: `${alsoFits.map((a) => a.generator).join(' and ')} `
          + `${alsoFits.length === 1 ? 'measures' : 'measure'} the same as this one, so `
          + `${alsoFits.length === 1 ? 'either' : 'any of them'} would match; this was closest `
          + `by ${(alsoFits[0].score - won.score).toFixed(3)}`,
      } : {}),
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
function columns(theirs, mine, weights) {
  const pc = (v) => `${Math.round(v * 100)}%`;
  const ruler = theirs.size.width;
  const ourPeriod = mine.scale.across > 0 ? Math.round(ruler / mine.scale.across) : null;
  const rows = [
    ['Repeats every', theirs.scale.found ? `${theirs.scale.period} px` : 'no repeat',
      mine.scale.found && ourPeriod ? `${ourPeriod} px` : 'no repeat'],
    ['Repeats across', theirs.scale.found ? `${theirs.scale.across}` : '—',
      mine.scale.found ? `${mine.scale.across}` : '—'],
    ['Ink', pc(theirs.coverage), pc(mine.coverage)],
    ['Runs at', theirs.orientation.kind === 'even' ? 'no direction' : `${theirs.orientation.angle}°`,
      mine.orientation.kind === 'even' ? 'no direction' : `${mine.orientation.angle}°`],
    ['Edges over', `${theirs.hardness.width} px`, `${mine.hardness.width} px`],
    ['Repeat or tendency', theirs.scale.regularity >= 0.5 ? 'a repeat' : 'a tendency',
      mine.scale.regularity >= 0.5 ? 'a repeat' : 'a tendency'],
  ];
  // Against a logo, the rows that were not scored are marked, so nobody reads a
  // row the engine was not trying to match as one it tried and missed.
  if (weights) {
    const of = { 'Repeats every': 'scale', 'Repeats across': 'scale', Ink: 'coverage',
      'Runs at': 'orientation', 'Edges over': 'hardness', 'Repeat or tendency': 'regularity' };
    for (const r of rows) if (!weights[of[r[0]]]) r.push('not matched');
  }
  return {
    head: ['', 'Yours', 'Ours'], rows, ruler,
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

module.exports = { fit, distance, columns, verdict, asField, logoField, WEIGHTS, TIE, opening, candidates, KNOBS, LOOK };
