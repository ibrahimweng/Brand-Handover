/* terrace — posterised contour bands.

   After PLAYGRND's Terrain, and the one generator here that is not vector.

   A field is warped, contrast-stretched, dithered and quantised into bands, and
   that is a decision taken per pixel. The honest vector form of it is a hundred
   thousand little polygons that no designer wants to open and no printer thanks
   you for, and the dishonest one is a coarse approximation that quietly stops
   being the picture the studio showed. So it ships as raster, at a size the
   package states, and the manual says which patterns are which in those words.
   A client needs to know that this one has a size beyond which it stops being
   sharp; hiding it would be the fault, not stating it.

   Everything else is the same discipline. The field is periodic by the same
   arithmetic as everywhere else — one lattice, whole periods across the tile —
   so the tile repeats, and the dither is a hash of the wrapped cell rather than
   of the pixel, so it repeats too. A dither that did not was the first version,
   and it put a visible line of different grain down every join.

   `render` is its own contract because it *is* a different thing: it returns
   pixels rather than drawing shapes. `paint` exists as well, at the lattice
   rather than the pixel, so the studio can show it through the same surface as
   everything else and so a tile can go on a page — but the file the package
   carries is the raster, and `vector: false` says so. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../rand'), require('../noise'));
  else root.PatternTerrace = factory(root.PatternRand, root.PatternNoise);
}(typeof self !== 'undefined' ? self : this, function (RAND, NOISE) {
  'use strict';

  const STYLES = ['ridge', 'strata', 'basin', 'drift', 'wash'];
  const STYLE = {
    ridge: { warp: 1.4, octaves: 5, ridged: true, contrast: 1.5 },
    strata: { warp: 0.35, octaves: 4, ridged: false, contrast: 2.1 },
    basin: { warp: 1.1, octaves: 5, ridged: false, contrast: 1.7 },
    drift: { warp: 2.2, octaves: 6, ridged: false, contrast: 1.3 },
    // A wash. The one look here with no contour in it.
    //
    // Softness is not a slider position, it is a look, and that is why it is a
    // style. Getting a wide, soft transition needs a slow field *and* few bands
    // *and* no grain, all three at once: soften a fast six-band dithered field
    // and the edge stays about a pixel while the ink share moves, so the
    // matcher — which moves one knob at a time — correctly refused every
    // intermediate step and reported that the engine could not draw one. As a
    // style it is a single move, tried the way every other look is tried.
    // These numbers are swept, not guessed, and they were swept twice.
    //
    // Contrast is the lever and it runs the opposite way to intuition: it
    // decides where in the field the band boundaries fall and how fast the
    // field is moving when it crosses them. A first guess of 0.7 made the look
    // *harder* than the one it replaced.
    //
    // Then a contact sheet showed two things no measurement being taken would
    // have caught, and both would have shipped.
    //
    // At contrast 1.68 with three bands the field is pushed so far towards its
    // ends that on 3 seeds in 16 it never crosses a boundary and the tile is
    // one flat colour. Five bands at 0.84 fixed that — and the picture was
    // still a **faint stain on cream**, 2.2 px and "mixed" by the numbers and
    // an empty page to look at. "Not flat" is not the same as "a pattern", and
    // a coverage bar of 5% is not a bar at all.
    //
    // Swept again with presence as a constraint — no seed flat, no seed under
    // a quarter ink — and exactly one setting survives: six bands at half the
    // contrast. Worst ink across ten seeds 44%, narrowest edge 2 px, 3.5 px on
    // average.
    wash: { warp: 2.4, octaves: 2, ridged: false, contrast: 0.5,
      bands: 6, dither: 0, soften: 1, scale: 1 },
  };
  const mod = (n, p) => ((n % p) + p) % p;

  // What a style brings with it, beyond how the field is built.
  //
  // Most looks here are a way of shaping the field and nothing more. `wash` is
  // not: it only exists as a *combination* — a slow field, few bands, no grain,
  // full softening — and any one of those on its own is not a wash. So the
  // style carries them, and whoever selects a style applies them.
  //
  // `plan` already falls back to a style's setting for a key nobody set, so
  // `soften` would arrive on its own. What it cannot do is win against a value
  // that *is* set — and `derive()` sets bands, dither and scale for every
  // identity, so exactly those three lost every time. Bands is the one that
  // decides whether a wash is a wash, so choosing `wash` gave a field measuring
  // 1.1 px, as hard as the look it was meant to replace, and the engine went on
  // reporting that it could not draw a soft edge while holding the style that
  // does. Which keys lose is worth being exact about: the first version of this
  // note said a style's settings never reached `plan` at all, and that is not
  // what was happening.
  const OWNS = ['bands', 'dither', 'soften', 'scale', 'contrast', 'warp'];
  function defaultsFor(style) {
    const st = STYLE[style];
    if (!st) return {};
    const out = {};
    // warp and contrast are multipliers at the control, so selecting a style
    // resets them to 1 rather than to the style's own absolute value.
    for (const k of OWNS) {
      if (k === 'warp' || k === 'contrast') { out[k] = 1; continue; }
      if (st[k] != null) out[k] = st[k];
    }
    return out;
  }

  // How many octaves a lattice can carry.
  //
  // Each octave doubles the frequency, so the finest one lays down
  // `period × 2^(octaves-1)` cycles across the tile. Sample that on a grid of
  // `grid` cells and you need at least two samples per cycle or the field is
  // not being drawn, it is being aliased — and aliased noise looks exactly like
  // noise, which is why the first version of this shipped as speckle and read
  // as deliberate. A five-octave field on a twenty-four cell lattice was
  // sampling forty-eight cycles at half a sample each.
  //
  // Nyquist, in other words, and it is arithmetic rather than a taste. What it
  // costs is that a coarse grain gets a simpler field, which is the truth about
  // a coarse grain.
  function octavesFor(period, grid) {
    let n = 1;
    while (period * Math.pow(2, n) * 2 <= grid) n++;
    return Math.max(1, n);
  }

  function plan(p) {
    const st = STYLE[p.style] || STYLE.ridge;
    // A style may carry defaults for the controls too, so a look that only
    // exists as a *combination* can be one choice rather than four. Anything
    // the caller sets still wins: choosing `wash` and then moving Bands moves
    // Bands.
    const pick = (key, fallback) => (p[key] == null ? (st[key] == null ? fallback : st[key]) : p[key]);
    const period = Math.max(1, Math.round(pick('scale', 3)));
    const grid = Math.max(8, Math.round(p.grid == null ? 96 : p.grid));
    return {
      style: p.style, seed: p.seed || 1,
      // Whole cycles across the tile. Anything else does not meet itself.
      period,
      warp: st.warp * (p.warp == null ? 1 : p.warp),
      octaves: Math.min(st.octaves, octavesFor(period, grid)), ridged: st.ridged,
      contrast: st.contrast * (p.contrast == null ? 1 : p.contrast),
      bands: Math.max(2, Math.round(pick('bands', 6))),
      dither: pick('dither', 0.3),
      spread: p.spread || 0,
      // How much of a band the change from one to the next is spread over.
      //
      // 0 is a contour line and it is what every generator here did: all five
      // quantise — to a cell, a stripe, a stroke or a band — so the softest
      // edge the engine could draw measured 0.91 where a knife edge is 1.00,
      // and a client whose pattern is an airbrushed gradient could be told only
      // that we do not draw one. Softness is native to *this* generator: a
      // contour map with the contours blurred is a relief map, not a smudged
      // contour map. At 1 each band ramps into the next across its whole width.
      soften: Math.max(0, Math.min(1, pick('soften', 0))),
      // How coarse the field is sampled. Terrain calls this Blockiness; here it
      // is also what `paint` draws its rectangles at, and what decides how many
      // octaves the field is allowed.
      grid,
    };
  }

  // The band this point falls in, 0 to bands-1. u and v are in [0,1) across the
  // tile; the dither cell is passed in so it can be hashed on the wrapped
  // lattice rather than on the pixel — a hash of the pixel does not repeat, and
  // that put a line of different grain down every join.
  function bandAt(u, v, q, cellX, cellY) {
    const P = q.period;
    const w = NOISE.warp2(u * P, v * P, P, P, q.warp, 3, q.seed + 7);
    let n = NOISE.fbm2(w[0], w[1], P, P, q.octaves, q.seed);
    if (q.ridged) n = NOISE.ridged(n);
    else n = NOISE.evenly(n, q.octaves);
    n = NOISE.contrast(n, q.contrast);
    if (q.dither) n += (RAND.hash01(cellX, cellY, q.seed + 313) - 0.5) * q.dither * (1 / q.bands);
    n = NOISE.skew(Math.max(0, Math.min(0.99999, n)), q.spread);
    return Math.max(0, Math.min(q.bands - 1, Math.floor(n * q.bands)));
  }

  // The same field, before it is cut into bands. `bandAt` is this floored, and
  // it stays exactly as it was: the periodicity check reads it, and a check
  // that measured a softened value would be measuring the softening.
  function bandFloat(u, v, q, cellX, cellY) {
    const P = q.period;
    const w = NOISE.warp2(u * P, v * P, P, P, q.warp, 3, q.seed + 7);
    let n = NOISE.fbm2(w[0], w[1], P, P, q.octaves, q.seed);
    if (q.ridged) n = NOISE.ridged(n);
    else n = NOISE.evenly(n, q.octaves);
    n = NOISE.contrast(n, q.contrast);
    if (q.dither) n += (RAND.hash01(cellX, cellY, q.seed + 313) - 0.5) * q.dither * (1 / q.bands);
    n = NOISE.skew(Math.max(0, Math.min(0.99999, n)), q.spread);
    return Math.max(0, Math.min(q.bands - 1e-6, n * q.bands));
  }

  // Which two band colours a point sits between, and how far. With soften at 0
  // the mix is always 0 and this is the hard band it always was — so the one
  // code path serves both and they cannot drift.
  function blend(t, q) {
    const i = Math.floor(t), f = t - i;
    if (q.soften <= 0) return { lo: i, hi: i, mix: 0 };
    const from = 1 - q.soften;
    if (f <= from) return { lo: i, hi: i, mix: 0 };
    const x = (f - from) / q.soften;
    // smoothstep, so the ramp leaves and arrives flat and the eye reads it as
    // a gradient rather than as a wedge with two creases in it
    return { lo: i, hi: Math.min(q.bands - 1, i + 1), mix: x * x * (3 - 2 * x) };
  }

  // Pixels. The file the package carries.
  function render(width, height, p, palette) {
    const q = plan(p);
    const W = Math.max(1, Math.round(width)), H = Math.max(1, Math.round(height));
    const data = new Uint8Array(W * H * 4);
    // The band colours: the ground and every ink, so the whole palette is the
    // picture rather than ink on a sheet. That is Terrain's own choice and it
    // is the right one — a contour map has no background.
    const hexes = [palette.ground].concat(palette.inks.map((i) => i.hex));
    const rgb = [];
    for (let i = 0; i < q.bands; i++) {
      const hex = hexes[i % hexes.length];
      rgb.push([parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]);
    }
    // The dither lattice is fixed to the tile, not to the render, so a 600 px
    // export and a 2400 px one carry the same grain in the same places.
    const cells = q.grid;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const u = x / W, v = y / H;
        const cx = mod(Math.floor(u * cells), cells), cy = mod(Math.floor(v * cells), cells);
        const { lo, hi, mix } = blend(bandFloat(u, v, q, cx, cy), q);
        const a = rgb[lo], b2 = rgb[hi];
        const i = (y * W + x) * 4;
        // Mixed in sRGB rather than in light. Mixing two inks in linear light
        // is right for light and wrong for ink: it lightens the middle of every
        // transition, and a printer mixing the same two inks does not.
        data[i] = Math.round(a[0] + (b2[0] - a[0]) * mix);
        data[i + 1] = Math.round(a[1] + (b2[1] - a[1]) * mix);
        data[i + 2] = Math.round(a[2] + (b2[2] - a[2]) * mix);
        data[i + 3] = 255;
      }
    }
    return { width: W, height: H, data };
  }

  // The same field at the lattice rather than the pixel, drawn through the
  // ordinary surface so the studio and a page can show it. Run-length merged,
  // like every other grid here.
  function paint(surface, W, H, p, palette) {
    const q = plan(p);
    const C = q.grid;
    const cw = W / C, ch = H / C;
    const R3 = (n) => Math.round(n * 1000) / 1000;
    const hexes = [palette.ground].concat(palette.inks.map((i) => i.hex));
    const rgbOf = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const hex2 = (c) => `#${c.map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')}`;
    // The same colour rule as `render`, at the lattice rather than the pixel.
    // Two rules would be two pictures, and this one is the stand-in shown on a
    // page while the other is the file the package ships.
    const at = (x, y) => {
      const { lo, hi, mix } = blend(bandFloat((x + 0.5) / C, (y + 0.5) / C, q, mod(x, C), mod(y, C)), q);
      if (!mix) return hexes[lo % hexes.length];
      const a = rgbOf(hexes[lo % hexes.length]), b = rgbOf(hexes[hi % hexes.length]);
      return hex2([0, 1, 2].map((k) => a[k] + (b[k] - a[k]) * mix));
    };
    for (let y = 0; y < C; y++) {
      let x = 0;
      while (x < C) {
        const v = at(x, y);
        let n = 1;
        while (x + n < C && at(x + n, y) === v) n++;
        surface.fillStyle = v;
        const x0 = R3(x * cw), x1 = R3((x + n) * cw), y0 = R3(y * ch), y1 = R3((y + 1) * ch);
        surface.fillRect(x0, y0, x1 - x0, y1 - y0);
        x += n;
      }
    }
  }

  const controls = [
    { group: 'pattern', key: 'style', label: 'Ground', type: 'chips', options: STYLES },
    { group: 'pattern', key: 'scale', label: 'Field scale', type: 'range', min: 1, max: 8, step: 1 },
    { group: 'pattern', key: 'warp', label: 'Warp', type: 'range', min: 0, max: 2.5, step: 0.05 },
    { group: 'pattern', key: 'contrast', label: 'Contrast', type: 'range', min: 0.4, max: 2, step: 0.05 },
    { group: 'pattern', key: 'bands', label: 'Bands', type: 'range', min: 2, max: 9, step: 1 },
    { group: 'pattern', key: 'dither', label: 'Dither', type: 'range', min: 0, max: 1.2, step: 0.02 },
    { group: 'pattern', key: 'grid', label: 'Grain', type: 'range', min: 24, max: 240, step: 8 },
    { group: 'pattern', key: 'spread', label: 'Band spread', type: 'range', min: -1.2, max: 1.2, step: 0.05 },
    { group: 'pattern', key: 'soften', label: 'Softness', type: 'range', min: 0, max: 1, step: 0.05 },
    { group: 'pattern', key: 'seed', label: 'Seed', type: 'seed' },
  ];

  // What the picture is worth in pixels, and at what resolution to say so.
  //
  // A contour ground puts down a hard edge, and where that edge lands is a
  // continuous function of the field, so more pixels place it more precisely
  // and the file is worth the whole page. A wash has no edge to place. It is
  // smooth, and a smooth picture returned to the page is the picture again.
  //
  // Measured, not guessed. Written at 768 px and blown back up to 2400, a wash
  // differs from the 2400 px render by 1.34 levels in 255 — half a percent, in
  // a gradient. A contour ground at the same size differs by 4.32, which is
  // why this only applies to the soft one. Below 768 it climbs: 576 reads 1.98
  // and 384 reads 3.25.
  //
  // The stated print size does not change, because it should not: 768 px at 96
  // dots to the inch is the same 203 mm as 2400 at 300, and 300 is the number
  // you need when there is an edge to keep. There is no edge here. What does
  // change is the file — two 2400 px washes are 9.7 MB, which is more than a
  // hosted function can answer with; two at 768 are 1.4.
  const SOFT_PX = 768, SOFT_DPI = 96;
  function sheetFor(p, want) {
    return plan(p).soften > 0
      ? { pixels: Math.min(want, SOFT_PX), dpi: SOFT_DPI }
      : { pixels: want, dpi: null };
  }

  return { key: 'terrace', vector: false, styles: STYLES, controls, bandFloat, blend, defaultsFor, sheetFor,
    plan, bandAt, render, paint, octavesFor, STYLE };
}));
