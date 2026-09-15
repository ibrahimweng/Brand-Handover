'use strict';
/* Which patterns this identity is handed as files, and which as recipes.

   The engine offers thirty-eight generators. It used to write all of them, in
   every colourway, into one folder: a hundred and ninety-two pattern files and
   sixty posters for a client who will use one pattern and keep two or three
   more in reserve. Thirty seconds of a ninety-second build, sixty of a hundred
   megabytes, and a folder whose length is the reason nobody opens it.

   Volume is not generosity. A hundred and ninety-two tiles is not a richer
   handover than eight; it is the same handover with the decision left out. The
   engine knows which patterns suit this mark — that is the whole of what it
   does — and a package that declines to say so is making the client re-derive
   it by scrolling.

   So: the chosen pattern in every colourway, a shortlist beside it, and a
   recipe for every generator in brand.json and the studio. Nothing became
   unreachable. See `recipe` in index.js for what a recipe is and what it costs.

   ## How the shortlist is ranked

   By the same measurements the reference match uses, against the same
   reference the match falls back to when a client brings no pattern of their
   own: **the logo**. match.js argues this at length at `logoField` — a mark has
   colours, a coverage, a direction and an edge hardness exactly as a pattern
   does, and the ones it has are the ones its identity already lives by. A
   pattern that measures like the mark is a pattern that belongs to the mark.

   `WEIGHTS.logo` is the weight set for that comparison and it is already
   written: period and ink share weigh nothing, because a mark has neither;
   hardness, direction and axiality weigh most, because a geometric mark of even
   strokes should not be handed a field of curved contours.

   This is a measurement, not a preference. Ranked across five identities the
   top six differ every time — carrock opens on terrazzo, warp and sprig,
   hallward on quilt, stipple and lattice, oriel on oddgrid, signage and warp —
   and the generator `suits` picks lands anywhere from second to outside the
   six, which is the point: `suits` answers one question off two measurements
   and this answers a different one off six.

   ## What it costs

   Nothing that was not already being spent. The ranking pass draws every
   generator once, in the primary colourway, and the tiles it draws are the
   tiles the shortlist writes — so the pass that decides and the pass that
   delivers are the same pass. What is saved is every *other* colourway of every
   generator that did not make the list. */

const MATCH = require('./match');
const measure = require('./measure');

// How many patterns a client is handed beside the one that was chosen.
//
// Six in the rail on the pattern screen, so six here: a client who saw six
// chips and then found five files, or twelve, would be owed an explanation the
// package does not give. One of the six is the chosen pattern itself.
const MOST = 6;
// And how many finished pages. A poster is a composition rather than a repeat,
// so it is not ranked against the others — a client picks one by looking. Three
// is enough to show what the family does without the folder becoming the
// problem it was.
const POSTERS = 3;
// And in how many colourways. The chosen pattern is written in all of them,
// because it is the one a client lays down and a brand with a dark scheme and a
// mono scheme needs its pattern in both. The shortlist is a menu, and six menus
// of six is how 07-pattern got to a hundred and ninety-two files: a client who
// takes one of them has it in every colourway by setting it in project.json, or
// by opening the studio.
const WAYS = 1;
// The width the comparison is made at. The match reads at 512 and this reads at
// 128, because this is a ranking rather than a fit: 128 separates the best six
// from the worst six identically and costs a sixteenth as much.
const LOOK = 128;

/* The mark, read as though it were a pattern. */
function logo(markSource, ground, px) {
  return measure.all(MATCH.logoField(markSource, px || LOOK, ground));
}

/* Score every drawn tile against that reading.

   `drawn` is `[{ name, tile }]` — tiles that have already been painted, because
   the caller wants to keep the ones that win. A tile that cannot be measured
   scores worst rather than throwing: a generator that fails to measure should
   fall off the shortlist, not take the build down. */
function rank(theirs, drawn, px) {
  const out = [];
  for (const d of drawn) {
    let score = null;
    let parts = null;
    try {
      const r = MATCH.distance(theirs, measure.all(MATCH.asField(d.tile, px || LOOK)),
        MATCH.WEIGHTS.logo);
      score = r.total;
      parts = r.parts;
    } catch (e) { score = null; }
    out.push({ generator: d.name, score, parts });
  }
  // Sorted by score, and by name where two tie, so the list is the same on
  // every machine. `null` — a tile that would not measure — sorts last.
  out.sort((a, b) => (a.score == null ? 1 : b.score == null ? -1
    : a.score - b.score) || (a.generator < b.generator ? -1 : 1));
  return out;
}

/* The shortlist itself: the chosen pattern first, then the nearest others.

   The chosen one leads whatever it measures. It is this identity's pattern —
   set by hand, matched to a reference the client brought, or picked by `suits`
   — and a package that ranked it fourth would be disagreeing with itself. */
function of(opts) {
  const o = opts || {};
  const ranked = o.ranked || [];
  const most = o.most == null ? MOST : o.most;
  const wrote = o.chose ? [o.chose] : [];
  for (const r of ranked) {
    if (wrote.length >= most) break;
    if (wrote.indexOf(r.generator) > -1) continue;
    if (r.score == null) continue;
    wrote.push(r.generator);
  }
  return wrote;
}

/* The sentence brand.json and the read me print, so a client reading either
   knows why these files and not the other thirty. */
function says(wrote, chose, ranked, every) {
  const others = wrote.filter((w) => w !== chose);
  const place = (g) => {
    const i = ranked.findIndex((r) => r.generator === g);
    return i < 0 ? '' : ` (${i + 1} of ${ranked.length})`;
  };
  return `${chose} is this identity's pattern and is written in every colourway. `
    + (others.length
      ? `Beside it are the ${others.length} that measure closest to the mark itself — `
        + `${others.map((g) => g + place(g)).join(', ')} — written in the first colourway. `
      : '')
    + `The other ${Math.max(0, every - wrote.length)} generators are here as parameters `
    + `rather than as files: every one of them is in the pattern studio and in this file, `
    + `and drawing one returns the same bytes a written tile would have. `
    + `Ranked by the six measurements the reference match uses, against the mark.`;
}

module.exports = { logo, rank, of, says, MOST, POSTERS, WAYS, LOOK };
