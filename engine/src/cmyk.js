/* The print colour path.

   The one rule here is that CMYK is a decision, not a conversion. Every naive
   hex-to-CMYK formula, including the one in contrast.js, is arithmetic on
   numbers that mean something else: sRGB describes light leaving a screen and
   CMYK describes ink sitting on a particular paper under a particular press.
   Nothing in a hex code knows which paper. So a brand's CMYK values come from
   the designer or their printer, the engine carries them, and where they have
   not been given the engine says so instead of inventing four numbers that
   will print a different colour to the one everybody signed off.

   What the machine can do is the arithmetic nobody enjoys: total ink coverage,
   rich black, and whether the file that goes to press is actually in the
   colour space it claims. Those are the parts that get a job rejected. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./contrast'));
  else root.HandoverCmyk = factory(root.HandoverContrast);
}(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  const round = (n) => Math.round(n);
  const sum = (v) => v.reduce((a, b) => a + b, 0);

  // Total area coverage. Ink laid over ink has to dry, and past the limit for
  // the stock it does not: the sheet offsets onto the next one in the stack and
  // the job is reprinted. The limits are the ones printers quote.
  const TAC = { coated: 300, uncoated: 260, newsprint: 240 };

  // Black is the one everybody gets wrong. 100 K alone is a thin, washed out
  // dark grey over any area larger than a word, because one pass of black ink
  // does not cover. Print work backs it up with the other three, and reserves
  // plain K for small text, where a rich black would go fuzzy if the plates
  // are a hair out of register.
  const RICH_BLACK_MIN = 240;

  const isBlackish = (c) => c[3] >= 85 && c[0] + c[1] + c[2] < 60;

  function parse(value) {
    if (!Array.isArray(value) || value.length !== 4) return null;
    const v = value.map(Number);
    if (v.some((n) => !isFinite(n) || n < 0 || n > 100)) return null;
    return v.map(round);
  }

  // Every colour in the palette, said plainly: what was given, what was worked
  // out, and which is which. Nothing downstream has to guess.
  function table(colours) {
    const out = [];
    for (const [name, c] of Object.entries(colours || {})) {
      const declared = parse(c.cmyk);
      const values = declared || C.cmyk(c.hex);
      out.push({
        name, hex: c.hex, values, declared: !!declared,
        pantone: c.pantone || null,
        coverage: sum(values),
        label: values.join('/'),
        // said this way in every document, because "C0 M0 Y0 K100" printed from
        // a screen value is a guess wearing a uniform
        source: declared ? 'given by the designer' : 'worked out from the screen colour, and not to be sent to a press',
      });
    }
    return out;
  }

  const byName = (t) => Object.fromEntries(t.map((c) => [c.name, c]));

  // ------------------------------------------------------------------ checks
  function check(table, opts) {
    const o = opts || {};
    const stock = o.stock || 'coated';
    const limit = TAC[stock] || TAC.coated;
    const found = [];

    const undeclared = table.filter((c) => !c.declared);
    if (undeclared.length) {
      found.push({ level: o.forPress ? 'blocker' : 'warning',
        what: `${undeclared.length} colour${undeclared.length === 1 ? ' has' : 's have'} no CMYK: ${undeclared.map((c) => c.name).join(', ')}.`,
        why: 'A hex code describes light leaving a screen. What it becomes in ink depends on the press and the paper, and no formula knows which paper. The numbers shown for these are a guess.',
        // Said without naming where the four numbers get typed, because that
        // is now two places: a project file and the app's palette. A how that
        // is only true on one of them is a how that is wrong on the other.
        how: 'Ask the printer for the build, or read it off a printed swatch book, and give it to the engine as four numbers. Until then anything that opens these files converts them itself.' });
    }

    for (const c of table) {
      if (!c.declared) continue;                 // a guess is not worth checking
      if (c.coverage > limit) {
        found.push({ level: 'blocker',
          what: `${c.name} lays down ${c.coverage}% ink, and ${stock} stock takes ${limit}%.`,
          why: 'Past the limit the ink does not dry. The sheet offsets onto the one above it in the stack and the job is reprinted at somebody\'s cost.',
          how: `Take ${c.coverage - limit}% out of the build, usually from cyan, or print it on a stock that takes more.` });
      }
      if (isBlackish(c.values) && c.coverage < RICH_BLACK_MIN) {
        found.push({ level: 'warning',
          what: `${c.name} is ${c.label}, which is a plain black.`,
          why: 'One pass of black ink does not cover. Over anything larger than a word it prints as a thin dark grey next to a rich black on the same sheet.',
          how: `Back it up to about ${RICH_BLACK_MIN}% total, for instance 60/40/40/100, and keep the plain build for small text.` });
      }
    }
    return found;
  }

  // What svg2pdf needs: the exact screen colour a shape is painted in, mapped
  // to the ink it should be printed in. Keyed on the rounded byte triple,
  // because that is what a renderer hands over.
  function inkMap(table) {
    const map = new Map();
    for (const c of table) {
      if (!c.declared) continue;                 // never print a guess as though it were a decision
      map.set(C.rgb(c.hex).join(','), c.values.map((v) => v / 100));
    }
    return map;
  }

  return { table, byName, check, inkMap, parse, TAC, RICH_BLACK_MIN, isBlackish };
}));
