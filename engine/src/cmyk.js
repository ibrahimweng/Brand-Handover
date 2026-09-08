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

  // -------------------------------------------------- the third description
  //
  // A colour can be written down a third time, as a spot ink. Nothing here
  // knows what colour any Pantone reference is, and nothing here should: the
  // library is theirs, and licence.js already says this package grants no
  // rights to it. These are questions about the reference, not the colour.
  //
  // They are still worth asking, because a spot reference is the one line in
  // the manual a print buyer works from directly. northline shipped seven
  // colours whose reference was the string "line", and the manual printed it:
  //
  //     north      88/17/86/3      194%  given   line
  //
  // The shapes a reference comes in. Solid coated and uncoated are the same
  // numbers in two books, and the finish letter is which book — 185 C and
  // 185 U are different inks that are meant to look the same on their own
  // paper, so a number with no letter names neither of them.
  const SPOT_FINISH = /\b(C|U|CP|UP|CVC|CVU|XGC|M|TCX|TPG|TPM|TN)$/;
  const SPOT_PMS = /^\d{2,4}$/;
  // the six figure Fashion, Home + Interiors form, which is a different book
  const SPOT_FHI = /^\d{2}-\d{4}$/;
  const SPOT_NAMED = new RegExp('^(black|cool ?gr[ae]y|warm ?gr[ae]y|warm red|reflex blue|rhodamine red'
    + '|rubine red|purple|violet|blue|green|yellow|orange|red|process (blue|cyan|magenta|yellow|black))\\b', 'i');

  function spot(raw) {
    const v = String(raw == null ? '' : raw).trim();
    if (!v) return { kind: 'none' };
    const m = SPOT_FINISH.exec(v);
    const finish = m ? m[1] : null;
    const body = (m ? v.slice(0, m.index) : v).trim();
    const book = SPOT_FHI.test(body) ? 'fhi'
      : (SPOT_PMS.test(body) || SPOT_NAMED.test(body)) ? 'pms' : null;
    return { kind: book ? 'ref' : 'unknown', book, finish, body, raw: v };
  }

  // Which book the paper asks for. Coated and uncoated are not two finishes of
  // one ink; they are two inks, chosen so that each matches the chip on its own
  // stock. Naming the coated chip for a job printed uncoated is naming a colour
  // nobody will see.
  const WANTS = { coated: 'C', uncoated: 'U', newsprint: 'U' };

  // Which of these is actually printed as ink. A colourway names a colour per
  // slot and is cut *for* a ground, so the ground is paper and the slots are
  // ink. The difference decides whether a reference from a book of material
  // chips is a note about the stock or a colour nobody can mix.
  function inked(table, colourways) {
    const slots = new Set();
    for (const w of colourways || []) {
      for (const v of Object.values((w && w.slots) || {})) {
        if (typeof v === 'string' && v.charAt(0) === '#') slots.add(v.trim().toUpperCase());
      }
    }
    return new Set(table.filter((c) => slots.has(String(c.hex).trim().toUpperCase())).map((c) => c.name));
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

    // the spot reference, which is asked about even where there is no build:
    // it is a different decision and a job can be all spot and no process
    const asInk = o.colourways ? inked(table, o.colourways) : null;
    for (const c of table) {
      if (!c.pantone) continue;
      const sp = spot(c.pantone);
      if (sp.kind === 'unknown') {
        found.push({ level: o.forPress ? 'blocker' : 'warning', code: 'spotShape',
          what: `${c.name} names "${sp.raw}" as its spot ink, and that is not a reference anybody can match.`,
          why: 'The spot line is the one thing in the manual a print buyer works from without translating '
            + 'it first. Whatever is written there is what gets read down a telephone to an ink supplier, '
            + 'so a reference that is not one is not caught by anybody downstream — it is simply mixed wrong.',
          how: `Give the reference from the swatch book, with the book it came from: "185 C" or "185 U". `
            + `If ${c.name} is not a spot colour, take the field out and it will print from its build.` });
        continue;
      }
      // A book of chips for cloth, plastic and paint is not a book of printing
      // inks. Fifteen identities here give their near-white a six figure code
      // like 11-0601, which is the Fashion, Home + Interiors form — and
      // fourteen of the fifteen then print that colour, as the ink of a
      // reversed colourway. A press cannot mix from that book. Recording that
      // the stock matches an FHI chip is a fair thing to write down, which is
      // why this is asked only of a colour that is actually put on paper.
      if (sp.book === 'fhi' && asInk && asInk.has(c.name)) {
        found.push({ level: o.forPress ? 'blocker' : 'warning', code: 'spotBook',
          what: `${c.name} names ${sp.raw}, which is a Fashion, Home + Interiors chip, and ${c.name} is `
            + 'printed as an ink.',
          why: 'That book numbers cloth, paint and plastic, not printing ink. There is no formula behind '
            + `${sp.body} that a press can mix, so the one line a print buyer works from names something `
            + 'their supplier does not stock. It reads like a Pantone reference and is not one.',
          how: `Give the printing ink reference for ${c.name}, from the solid book for the stock this is `
            + 'printed on. If it is only ever the paper and never an ink, take it out of the colourways '
            + 'instead, and the chip can stay as a note about the stock.' });
      }
      if (sp.book === 'pms' && !sp.finish) {
        found.push({ level: o.forPress ? 'blocker' : 'warning', code: 'spotFinish',
          what: `${c.name} names Pantone ${sp.body} without saying which book it is from.`,
          why: 'Solid coated and solid uncoated carry the same numbers and are not the same ink. They are '
            + 'mixed differently so that each matches its own chip on its own paper, so a number on its own '
            + 'names two different colours and the printer picks.',
          how: `Write ${sp.body} C for coated or ${sp.body} U for uncoated.` });
      } else if (sp.book === 'pms' && sp.finish && WANTS[stock] && (sp.finish === 'C' || sp.finish === 'U')
        && sp.finish !== WANTS[stock]) {
        found.push({ level: 'warning', code: 'spotStock',
          what: `${c.name} is ${sp.raw} and this project prints on ${stock} stock.`,
          why: `Coated and uncoated are two inks, not one ink on two papers: each is mixed to match its own `
            + `chip on its own stock. ${sp.raw} laid on ${stock} paper is not the colour of the ${sp.finish} `
            + 'chip anybody signs off against, and the difference is large enough to argue about.',
          how: `Name ${sp.body} ${WANTS[stock]} for the stock this is printed on, or give both and say which `
            + 'is which, the way a manual that covers two kinds of job has to.' });
      }
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

  return { table, byName, check, inkMap, parse, tone, spot, inked, TAC, RICH_BLACK_MIN, TONE_LIMIT, isBlackish };
}));
