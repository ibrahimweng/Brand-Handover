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

  // ------------------------------------------------- the two descriptions
  //
  // Every brand colour is written down twice: a hex and a build. Nothing here
  // ever asked whether the two were the same colour, which is the one question
  // a file carrying both descriptions of the same thing has to answer.
  //
  // They are not meant to be identical. Ink has a smaller gamut than a screen,
  // so a vivid colour comes back duller, and that difference is the whole
  // reason a build is a decision rather than a conversion. But the loss is in
  // chroma. Lightness is the axis ink keeps: every printing condition runs from
  // paper white to solid black, so a build can always be as light or as dark as
  // the colour it is standing in for. A build that differs from its hex in
  // chroma is a colour the press cannot reach. A build that differs in
  // lightness is a different colour.
  //
  // Measured on the 148 declared builds in this repository: of the 108 that the
  // plain model reproduces without losing chroma, lightness differs by a median
  // of 2.3 and a ninety-ninth percentile of 14.6 — and then one sits at 50.8.
  // That one is halyard's fog, a mid grey declared 0/0/0/100, which would have
  // printed the brand's neutral as solid black beside its actual black. Every
  // threshold from 15 to 30 catches that one and nothing else, so 20 is a gap
  // in the data rather than a number fitted to the case it was found by.
  //
  // The plain inverse below is not a press simulation and is not offered as
  // one. It is only ever asked a relative question, and whatever it gets wrong
  // it gets wrong for both descriptions at once.
  const TONE_LIMIT = 20;
  const chan = (v) => { const u = v / 255; return u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4); };
  function lab(rgb) {
    const [R, G, B] = rgb.map(chan);
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const X = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047);
    const Y = f(0.2126 * R + 0.7152 * G + 0.0722 * B);
    const Z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
    return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
  }
  // the plain inverse: what the four numbers would be if ink were ideal
  const unInk = ([c, m, y, k]) => [c, m, y].map((n) => 255 * (1 - n / 100) * (1 - k / 100));

  // How far a declared build sits from the colour it says it is, split into the
  // part ink is allowed to lose and the part it is not.
  function tone(hex, values) {
    const rgb = C.rgb(hex);
    if (!rgb) return null;
    const a = lab(rgb), b = lab(unInk(values));
    return { lightness: Math.abs(a[0] - b[0]), chroma: Math.hypot(a[1] - b[1], a[2] - b[2]) };
  }

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
      const t = tone(c.hex, c.values);
      if (t && t.lightness > TONE_LIMIT && t.lightness > t.chroma) {
        found.push({ level: o.forPress ? 'blocker' : 'warning', code: 'cmykTone',
          what: `${c.name} is ${c.hex} and its build is ${c.label}, which is a different tone.`,
          why: 'A build is the same colour in ink. Ink cannot reach every hue, so a vivid colour comes '
            + 'back duller and that is expected — but every press runs from paper white to solid black, '
            + 'so lightness is the one thing a build never has to lose. This one is '
            + `${Math.round(t.lightness)} apart in lightness and only ${Math.round(t.chroma)} in colour, `
            + 'which no gamut explains. Printed, this is not the colour the palette says it is.',
          how: `Check the four numbers against ${c.hex}. If they are what the printer gave, the hex is `
            + 'the one that is wrong, and everything on screen has been the wrong colour instead.' });
      }
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

  return { table, byName, check, inkMap, parse, tone, TAC, RICH_BLACK_MIN, TONE_LIMIT, isBlackish };
}));
