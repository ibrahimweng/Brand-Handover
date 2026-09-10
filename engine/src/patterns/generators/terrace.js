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

  const STYLES = ['ridge', 'strata', 'basin', 'drift'];
  const STYLE = {
    ridge: { warp: 1.4, octaves: 5, ridged: true, contrast: 1.5 },
    strata: { warp: 0.35, octaves: 4, ridged: false, contrast: 2.1 },
    basin: { warp: 1.1, octaves: 5, ridged: false, contrast: 1.7 },
    drift: { warp: 2.2, octaves: 6, ridged: false, contrast: 1.3 },
  };
  const mod = (n, p) => ((n % p) + p) % p;

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
    const period = Math.max(1, Math.round(p.scale == null ? 3 : p.scale));
    const grid = Math.max(8, Math.round(p.grid == null ? 96 : p.grid));
    return {
      style: p.style, seed: p.seed || 1,
      // Whole cycles across the tile. Anything else does not meet itself.
      period,
      warp: st.warp * (p.warp == null ? 1 : p.warp),
      octaves: Math.min(st.octaves, octavesFor(period, grid)), ridged: st.ridged,
      contrast: st.contrast * (p.contrast == null ? 1 : p.contrast),
      bands: Math.max(2, Math.round(p.bands == null ? 6 : p.bands)),
      dither: p.dither == null ? 0.3 : p.dither,
      spread: p.spread || 0,
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
        const b = bandAt(u, v, q, mod(Math.floor(u * cells), cells), mod(Math.floor(v * cells), cells));
        const c = rgb[b];
        const i = (y * W + x) * 4;
        data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
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
    const at = (x, y) => bandAt((x + 0.5) / C, (y + 0.5) / C, q, mod(x, C), mod(y, C));
    for (let y = 0; y < C; y++) {
      let x = 0;
      while (x < C) {
        const v = at(x, y);
        let n = 1;
        while (x + n < C && at(x + n, y) === v) n++;
        surface.fillStyle = hexes[v % hexes.length];
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
    { group: 'pattern', key: 'seed', label: 'Seed', type: 'seed' },
  ];

  return { key: 'terrace', vector: false, styles: STYLES, controls,
    plan, bandAt, render, paint, octavesFor, STYLE };
}));
