/* The photography treatment. The fourth rule block, and the one the plan kept
   filing under "photography" as though it were a matter of taste.

   Most of it is: the direction is the designer's forever, and nobody misreads
   a photographic brief. What people get wrong is the mechanical half, and the
   mechanical half is arithmetic.

   The treatment is done with an SVG filter and an overlay rather than by
   rewriting pixels, and that is the whole reason it is a rule rather than an
   edit. The stored photograph is never touched, so changing the recipe once
   changes every image in every document, and the same markup draws it in the
   editor, on a published page and in print. Baking it into the file would give
   you a picture of a decision instead of the decision.

   UMD, because the editor has to know what a treated pixel will look like
   before anyone can be told whether the mark on top of it can be read. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./contrast'));
  else root.HandoverPhotography = factory(root.HandoverContrast);
}(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const round = (n, dp) => Number(n.toFixed(dp === undefined ? 3 : dp));

  // The decision. A project sets it once; nothing here guesses a treatment,
  // because a duotone in the wrong two colours is worse than no duotone.
  function rules(override) {
    const r = Object.assign({
      duotone: null,          // { shadow: 'primary', highlight: 'ground', amount: 1 }
      scrim: null,            // { colour: 'primary', opacity: 0.28, direction: 'bottom' }
      ratios: ['3:2', '16:9', '1:1', '4:5'],
    }, override || {});
    if (r.duotone) r.duotone = Object.assign({ shadow: 'primary', highlight: 'ground', amount: 1 }, r.duotone);
    if (r.scrim) r.scrim = Object.assign({ colour: 'primary', opacity: 0.28, direction: 'bottom' }, r.scrim);
    r.declared = !!(r.duotone || r.scrim);
    return r;
  }

  const hexOf = (bundle, key) => {
    if (!key) return null;
    if (/^#/.test(key)) return key;
    const roles = (bundle && bundle.roles) || {}, cols = (bundle && bundle.colours) || {};
    return (roles[key] && roles[key].hex) || (cols[key] && cols[key].hex) || key;
  };

  // ------------------------------------------------------------------ drawing
  // A duotone is a greyscale ramped between two colours: saturate to nothing,
  // then map the single remaining value onto a line from the shadow colour to
  // the highlight colour. Held in sRGB on purpose, because that is the space a
  // designer picked the two colours in.
  function filter(rules, bundle, id) {
    if (!rules.duotone) return '';
    const lo = C.unit(hexOf(bundle, rules.duotone.shadow));
    const hi = C.unit(hexOf(bundle, rules.duotone.highlight));
    const a = clamp(rules.duotone.amount === undefined ? 1 : rules.duotone.amount, 0, 1);
    const table = (i) => `${round(lo[i], 4)} ${round(hi[i], 4)}`;
    return `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">`
      + `<filter id="${id}" color-interpolation-filters="sRGB">`
      + `<feColorMatrix type="saturate" values="0"/>`
      + `<feComponentTransfer>`
      + `<feFuncR type="table" tableValues="${table(0)}"/>`
      + `<feFuncG type="table" tableValues="${table(1)}"/>`
      + `<feFuncB type="table" tableValues="${table(2)}"/>`
      + `</feComponentTransfer>`
      // amount below 1 leaves some of the photograph showing through, which is
      // how a treatment reads as a grade rather than as a poster
      + (a < 1 ? `<feComposite in2="SourceGraphic" operator="arithmetic" k2="${round(a, 4)}" k3="${round(1 - a, 4)}"/>` : '')
      + `</filter></svg>`;
  }

  // The scrim is a wash of one brand colour, and it exists so words and the
  // mark can sit on a picture. A gradient by default, because a flat wash over
  // a whole photograph greys it out and a gradient only darkens where the
  // typography actually is.
  function scrimStyle(rules, bundle, override) {
    const s = override === undefined || override === null ? rules.scrim
      : (rules.scrim ? Object.assign({}, rules.scrim, { opacity: override })
        : { colour: 'primary', opacity: override, direction: 'bottom' });
    if (!s || !s.opacity) return null;
    const hex = hexOf(bundle, s.colour);
    const o = clamp(s.opacity, 0, 1);
    // rgba, not the bare hex: a flat scrim has to be the strength it says it is,
    // and the renderer paints `background` and nothing else
    if (s.direction === 'flat') return { background: rgba(hex, o), opacity: o, hex, direction: 'flat' };
    const to = { bottom: 'to top', top: 'to bottom', left: 'to right', right: 'to left' }[s.direction] || 'to top';
    // the stated opacity is what it reaches at the strong end, and nothing more:
    // a bare hex here would be a solid wash whatever the number said
    return { background: `linear-gradient(${to}, ${rgba(hex, o)} 0%, ${rgba(hex, o * STOP)} ${MID}%, ${rgba(hex, 0)} ${END}%)`,
      opacity: o, hex, direction: s.direction, gradient: true };
  }

  // The gradient written above, read back. t runs 0 at the strong end to 1 at
  // the weak one, and this has to track the stops exactly or the check is
  // measuring a scrim nobody can see.
  const STOP = 0.55, MID = 42, END = 78;
  function alphaAt(scrim, t) {
    if (!scrim) return 0;
    if (!scrim.gradient) return scrim.opacity;
    const pos = clamp(t, 0, 1) * 100;
    if (pos >= END) return 0;
    if (pos <= MID) return scrim.opacity * (1 + (STOP - 1) * (pos / MID));
    return scrim.opacity * STOP * (1 - (pos - MID) / (END - MID));
  }

  // Where a point on the page sits along that gradient.
  const gradientT = (direction, at) => {
    if (!at) return 0;                                   // no position given: the strong end
    const { x, y } = at;
    return direction === 'top' ? y : direction === 'left' ? x : direction === 'right' ? 1 - x : 1 - y;
  };

  const rgba = (hex, a) => {
    const [r, g, b] = C.rgb(hex);
    return `rgba(${r},${g},${b},${round(a, 3)})`;
  };

  // ------------------------------------------------------- what a pixel becomes
  // The editor has to answer "can the mark be read on this" before anything is
  // drawn, so the treatment has to be computable as well as drawable. These two
  // follow the filter above exactly; a test pins them to what a browser
  // actually renders.
  function treatPixel(rules, bundle, px) {
    let out = [px.r, px.g, px.b];
    if (rules.duotone) {
      const lo = C.unit(hexOf(bundle, rules.duotone.shadow));
      const hi = C.unit(hexOf(bundle, rules.duotone.highlight));
      const a = clamp(rules.duotone.amount === undefined ? 1 : rules.duotone.amount, 0, 1);
      const grey = C.greyOf(px.r, px.g, px.b);
      const duo = [0, 1, 2].map((i) => lo[i] + (hi[i] - lo[i]) * grey);
      out = [0, 1, 2].map((i) => duo[i] * a + out[i] * (1 - a));
    }
    return { r: clamp(out[0], 0, 1), g: clamp(out[1], 0, 1), b: clamp(out[2], 0, 1) };
  }

  // Source-over compositing, which is what the browser does with the overlay.
  function over(px, hex, alpha) {
    const [r, g, b] = C.unit(hex);
    const a = clamp(alpha, 0, 1);
    return { r: px.r * (1 - a) + r * a, g: px.g * (1 - a) + g * a, b: px.b * (1 - a) + b * a };
  }

  // What a patch of photograph measures once the rule has been applied to it.
  // `at` is where this pixel sits in its block, 0 to 1 in each direction. A
  // gradient scrim is strong at one end and gone at the other, so without it
  // the answer is a guess; with it the check is measuring what is on the page.
  function luminanceAfter(rules, bundle, px, scrimOpacity, at) {
    const t = treatPixel(rules, bundle, px);
    const s = scrimStyle(rules, bundle, scrimOpacity);
    const a = alphaAt(s, gradientT(s && s.direction, at));
    const f = a ? over(t, s.hex, a) : t;
    return C.luminanceOf(f.r, f.g, f.b);
  }

  // ------------------------------------------------------------ the useful bit
  // How much scrim it would take to make the mark readable here. This is the
  // number a designer actually wants and the one nobody works out by eye: they
  // drag an opacity slider until it looks about right, on their own screen.
  const NONTEXT = 3;
  // Patches are already treated; each carries where it sits so the gradient can
  // be evaluated at that point rather than averaged into a number that is true
  // nowhere on the page.
  function scrimNeeded(inkHex, patches, scrimHex, direction) {
    const ink = C.luminance(inkHex);
    const shape = { gradient: direction !== 'flat', direction: direction || 'bottom', hex: scrimHex };
    const worst = (o) => {
      let w = Infinity;
      for (const px of patches) {
        const a = alphaAt(Object.assign({ opacity: o }, shape), gradientT(shape.direction, px.at));
        const f = a ? over(px, scrimHex, a) : px;
        w = Math.min(w, C.ratioOfLuminance(ink, C.luminanceOf(f.r, f.g, f.b)));
      }
      return w;
    };
    if (worst(0) >= NONTEXT) return { needed: 0, ratio: round(worst(0), 2) };
    // the ratio is not monotonic in general: a scrim can pass the ink colour on
    // its way and make things worse before better. So walk it rather than
    // bisect, and take the first step that clears.
    for (let i = 1; i <= 20; i++) {
      const a = i / 20;
      const r = worst(a);
      if (r >= NONTEXT) return { needed: round(a, 2), ratio: round(r, 2) };
    }
    // A scrim works by moving the picture away from the ink. One in the ink's
    // own colour moves it towards, so no amount of it will ever help, and
    // saying that is more use than offering a slider that cannot get there.
    const same = C.ratio(scrimHex, inkHex) < 1.5;
    return { needed: null, ratio: round(worst(1), 2),
      why: same
        ? `A ${scrimHex === inkHex ? 'scrim in the same colour as the mark' : 'scrim this close to the mark colour'} cannot separate them, however strong it is.`
        : 'Even a solid scrim does not get there.' };
  }

  // ----------------------------------------------------------------- the crops
  // A ratio is a decision, so a box that is not one of them is worth saying.
  const parseRatio = (s) => {
    const m = String(s).split(/[:/x×]/).map(Number);
    return m.length === 2 && m[0] > 0 && m[1] > 0 ? m[0] / m[1] : null;
  };

  function checkCrop(rules, box, label) {
    const allowed = (rules.ratios || []).map((r) => ({ name: r, v: parseRatio(r) })).filter((r) => r.v);
    if (!allowed.length || !box.w || !box.h) return [];
    const have = box.w / box.h;
    let best = allowed[0], bestOff = Infinity;
    for (const r of allowed) {
      // compare in both orientations, since a portrait crop of 3:2 is still 3:2
      const off = Math.min(Math.abs(have - r.v), Math.abs(have - 1 / r.v));
      if (off < bestOff) { bestOff = off; best = r; }
    }
    if (bestOff <= 0.02) return [];
    const w = Math.round(box.h * best.v), h = Math.round(box.w / best.v);
    return [{ level: 'warning',
      what: `${label || 'This image'} is cropped ${round(have, 2)} to 1, and the brand crops to ${allowed.map((r) => r.name).join(', ')}.`,
      why: 'Crops that drift are the reason a set of photographs stops looking like a set, and it happens one box at a time.',
      how: `The nearest is ${best.name}. Make the box ${w} by ${box.h}, or ${box.w} by ${h}.` }];
  }

  function describe(rules, bundle) {
    const bits = [];
    if (rules.duotone) {
      bits.push(`duotone ${rules.duotone.shadow} → ${rules.duotone.highlight}`
        + (rules.duotone.amount < 1 ? ` at ${Math.round(rules.duotone.amount * 100)}%` : ''));
    }
    if (rules.scrim) bits.push(`${Math.round(rules.scrim.opacity * 100)}% ${rules.scrim.colour} scrim from the ${rules.scrim.direction}`);
    if (rules.ratios && rules.ratios.length) bits.push(rules.ratios.join(', '));
    return bits.join(' · ');
  }

  return { rules, filter, scrimStyle, treatPixel, over, luminanceAfter, scrimNeeded,
    alphaAt, gradientT, checkCrop, describe, hexOf, parseRatio, rgba, NONTEXT };
}));
