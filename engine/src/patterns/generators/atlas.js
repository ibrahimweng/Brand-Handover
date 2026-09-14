/* The mark, as a terrain map drawn in small marks.

   PLAYGRND's Atlas builds a character grid, samples a height field per cell,
   terraces it into bands, gives each band a background ink and a slice of a
   glyph set, and gates whether a glyph prints at all on a density that rises
   with the band — which is the gradient that makes the sheet read as elevation
   rather than as a page of type.

   It sets real text, and this cannot. The surface contract here is paths and
   rectangles: a generator draws through the same calls whether it is painting a
   canvas or writing an SVG, and adding `text` to it would mean a tile whose
   appearance depends on what fonts the machine opening it happens to have. A
   brand package cannot ship that. So the glyphs are drawn — five small sets of
   geometric marks, each a path in its own cell — and one of the sets is the
   client's own drawing at glyph size.

   That last one is the whole reason this tool is here. A terrain map made of
   repetitions of a logo is a strange and quite beautiful object, and it is
   legible as both things at once: a texture close up, elevation at arm's
   length, and the identity's own mark if you look at any single cell.

   The height field is the drawing too, blended with periodic noise, so the high
   ground is where the mark has ink. */
//
// UMD: `paint` runs in the studio, which has no require.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../rand'), require('../noise'), require('../motif'), require('../grid'));
  } else root.PatternAtlas = factory(root.PatternRand, root.PatternNoise, root.PatternMotif, root.PatternGrid);
}(typeof self !== 'undefined' ? self : this, function (RAND, NOISE, MOTIF, GRID) {
  'use strict';

  const R3 = (v) => Math.round(v * 1000) / 1000;
  const frac = (v) => v - Math.floor(v);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* The glyph sets, drawn rather than set.

     Each entry is a list of strokes in a unit cell centred on the origin: a
     list of points, and whether it closes. Ordered light to heavy inside each
     set, because the band index picks a slice of the set and the sheet has to
     get denser as it rises. */
  const SETS = {
    rules: [[[-0.4, 0], [0.4, 0]], [[0, -0.4], [0, 0.4]], [[-0.35, 0.35], [0.35, -0.35]],
      [[-0.35, -0.35], [0.35, 0.35]], [[-0.4, 0], [0.4, 0]], [[-0.3, -0.3], [0.3, -0.3], [0.3, 0.3]],
      [[-0.4, -0.4], [-0.4, 0.4], [0.4, 0.4], [0.4, -0.4]]],
    ticks: [[[-0.18, 0], [0.18, 0]], [[-0.25, -0.25], [0.25, 0.25]],
      [[-0.25, 0.25], [0.25, -0.25]], [[-0.3, 0], [0.3, 0], [0, -0.3], [0, 0.3]],
      [[-0.34, -0.34], [0.34, 0.34], [0, 0], [-0.34, 0.34], [0.34, -0.34]]],
    specks: [[[-0.04, 0], [0.04, 0]], [[-0.09, 0], [0.09, 0]], [[-0.15, 0], [0.15, 0]],
      [[-0.22, 0], [0.22, 0]], [[-0.3, 0], [0.3, 0]]],
    blocks: [[[-0.15, -0.15], [0.15, -0.15], [0.15, 0.15], [-0.15, 0.15]],
      [[-0.26, -0.26], [0.26, -0.26], [0.26, 0.26], [-0.26, 0.26]],
      [[-0.36, -0.36], [0.36, -0.36], [0.36, 0.36], [-0.36, 0.36]],
      [[-0.46, -0.46], [0.46, -0.46], [0.46, 0.46], [-0.46, 0.46]]],
  };
  const NAMES = ['mark', 'rules', 'ticks', 'specks', 'blocks'];

  function glyph(s, strokes, cx, cy, k, weight) {
    for (const run of strokes) {
      if (run.length === 2) {
        // A two-point run is a line, and a line has no area to fill. Drawn as a
        // thin quadrilateral so it comes out in the same path as everything
        // else and the whole band is one element.
        const a = run[0], b = run[1];
        const dx = b[0] - a[0], dy = b[1] - a[1];
        const L = Math.hypot(dx, dy) || 1;
        const nx = (-dy / L) * weight, ny = (dx / L) * weight;
        s.moveTo(R3(cx + (a[0] + nx) * k), R3(cy + (a[1] + ny) * k));
        s.lineTo(R3(cx + (b[0] + nx) * k), R3(cy + (b[1] + ny) * k));
        s.lineTo(R3(cx + (b[0] - nx) * k), R3(cy + (b[1] - ny) * k));
        s.lineTo(R3(cx + (a[0] - nx) * k), R3(cy + (a[1] - ny) * k));
        s.closePath();
        continue;
      }
      s.moveTo(R3(cx + run[0][0] * k), R3(cy + run[0][1] * k));
      for (let i = 1; i < run.length; i++) s.lineTo(R3(cx + run[i][0] * k), R3(cy + run[i][1] * k));
      s.closePath();
    }
  }

  function heightOf(p) {
    const P = Math.max(1, Math.round(p.scale));
    const reps = Math.max(1, Math.round(p.repeat));
    const seed = (p.seed || 1) * 113;
    return function at(u, v) {
      const q = NOISE.warp2(u * P, v * P, P, P, p.warp, 3, seed + 1);
      const n = NOISE.evenly(NOISE.fbm2(q[0], q[1], P, P, 4, seed + 2), 4);
      const on = p.mark > 0 ? MOTIF.inside(p.motif, frac(u * reps), frac(v * reps), p.spread) : 0;
      const t = on * p.mark + n * (1 - p.mark * 0.6);
      return clamp((t - 0.5) * (0.7 + p.contrast * 1.6) + 0.5, 0, 0.999);
    };
  }

  function paint(surface, W, H, p, pal) {
    const at = heightOf(p);
    const cols = Math.max(8, Math.round(p.columns));
    // The cell is taller than it is wide, the way a monospace cell is, so the
    // glyphs stay square-ish at any frame proportion.
    const rows = Math.max(4, Math.round(cols * (H / W) * 0.6));
    const cw = W / cols, ch = H / rows;
    const terraces = Math.max(2, Math.round(p.terraces));
    const seed = (p.seed || 1) * 113;
    const set = NAMES.indexOf(p.set) > -1 ? p.set : NAMES[0];
    const full = p.motif && ((p.motif.fillOps && p.motif.fillOps.length
      ? p.motif.fillOps : (!p.motif.stroked && p.motif.ops))) || null;
    const markOps = full ? simplify(full, GLYPH_TOLERANCE) : null;
    const strokes = SETS[set] || null;

    // The bands, as the ground under the glyphs.
    const bandAt = (i, j) => Math.min(terraces - 1,
      Math.floor(at((i + 0.5) / cols, (j + 0.5) / rows) * terraces));
    pal.paper(surface, W, H, pal.ground);
    GRID.cells(surface, W, H, cols, rows, bandAt,
      Array.from({ length: terraces }, (_, b) => pal.ink(b)));

    /* The glyph colour, chosen per band rather than fixed.

       Whichever of the palette's lightest and darkest inks is further in
       luminance from that band's own background. Fixed, a glyph set vanishes
       over half the terraces, and a terrain map you can only read the top half
       of is not a map. */
    const lum = pal.inks.map((k) => k.against);
    const lightest = pal.inks[lum.indexOf(Math.min.apply(null, lum))];
    const darkest = pal.inks[lum.indexOf(Math.max.apply(null, lum))];

    for (let b = 0; b < terraces; b++) {
      const ground = pal.ink(b);
      const pick = Math.abs(pal.reads(lightest.hex) - pal.reads(ground))
        > Math.abs(pal.reads(darkest.hex) - pal.reads(ground)) ? lightest : darkest;
      surface.beginPath();
      let any = false;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          if (bandAt(i, j) !== b) continue;
          // Higher terraces are denser. That gradient is the elevation.
          const gate = p.density * (0.35 + 0.9 * (b + 1) / terraces);
          if (RAND.hash01(i, j, seed + 3) > gate) continue;
          const cx = (i + 0.5) * cw, cy = (j + 0.5) * ch;
          const k = Math.min(cw, ch) * 0.98;
          if (set === 'mark' && markOps) {
            surface.save();
            surface.translate(R3(cx), R3(cy));
            addOps(surface, markOps, k);
            surface.restore();
          } else if (strokes) {
            // Each band owns a slice of the set, widened by Variety from one
            // glyph per terrace up to the whole of it.
            const from = Math.floor((b / terraces) * strokes.length);
            const span = Math.max(1, Math.round(1 + p.variety * (strokes.length - 1)));
            const pickG = strokes[(from + Math.floor(RAND.hash01(i, j, seed + 4) * span)) % strokes.length];
            glyph(surface, pickG, cx, cy, k, 0.055 + p.weight * 0.09);
          }
          any = true;
        }
      }
      if (any) { surface.fillStyle = pick.hex; surface.fill('nonzero'); }
    }
  }

  /* The mark, cut down to glyph size.

     A stroked logo's silhouette is an offset outline, and an outline of a
     detailed drawing runs to hundreds of moves. Stamped into six hundred cells
     it is six hundred times that: carrock's atlas came out at 660 KB a
     colourway, two and a half megabytes of one tile in a package, for detail
     that lands inside a tenth of a millimetre on a printed page.

     So the glyph is flattened. Curves become their endpoints — at a glyph six
     units across on a six-hundred-unit tile there is no curve left to see — and
     points closer together than the tolerance are dropped. The tolerance is in
     the motif's own coordinates, where the whole drawing is about one unit
     across, so 0.04 is a twenty-fifth of the glyph: under a printer's dot at
     any size a tile is used, and an order of magnitude fewer moves.

     Measured on this repository: the twenty-one drawings that carry an outline
     average 258 moves in it and 56 after this, and the largest goes from 669 to
     94. */
  const GLYPH_TOLERANCE = 0.04;
  function simplify(ops, tol) {
    const out = [];
    let last = null;
    for (const o of ops) {
      if (o[0] === 'Z') { out.push(['Z']); last = null; continue; }
      const x = o[o.length - 2], y = o[o.length - 1];
      if (o[0] === 'M') { out.push(['M', x, y]); last = [x, y]; continue; }
      if (last && Math.abs(x - last[0]) < tol && Math.abs(y - last[1]) < tol) continue;
      out.push(['L', x, y]);
      last = [x, y];
    }
    return out;
  }

  // The mark's own moves, appended to an open path. Not `motif.path`, which
  // begins one — see sprig.js for what that costs.
  function addOps(s, ops, sz) {
    for (const o of ops) {
      if (o[0] === 'M') s.moveTo(R3(o[1] * sz), R3(o[2] * sz));
      else if (o[0] === 'L') s.lineTo(R3(o[1] * sz), R3(o[2] * sz));
      else if (o[0] === 'C') {
        s.bezierCurveTo(R3(o[1] * sz), R3(o[2] * sz), R3(o[3] * sz), R3(o[4] * sz),
          R3(o[5] * sz), R3(o[6] * sz));
      } else if (o[0] === 'Q') s.quadraticCurveTo(R3(o[1] * sz), R3(o[2] * sz), R3(o[3] * sz), R3(o[4] * sz));
      else if (o[0] === 'Z') s.closePath();
    }
  }

  const controls = [
    { group: 'terrain', key: 'scale', label: 'Scale', type: 'range', min: 1, max: 12, step: 1 },
    { group: 'terrain', key: 'warp', label: 'Warp', type: 'range', min: 0, max: 1.6, step: 0.01 },
    { group: 'terrain', key: 'terraces', label: 'Terraces', type: 'range', min: 2, max: 10, step: 1 },
    { group: 'terrain', key: 'contrast', label: 'Contrast', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'type', key: 'set', label: 'Glyphs', type: 'chips', options: NAMES,
      needs: { of: 'motif', key: 'silhouette', least: 1,
        without: 'This mark is drawn in strokes too fine to outline, so it cannot be a glyph. '
          + 'The drawn sets are still here.' } },
    { group: 'type', key: 'columns', label: 'Columns', type: 'range', min: 16, max: 160, step: 1 },
    { group: 'type', key: 'density', label: 'Density', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'type', key: 'variety', label: 'Variety', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'type', key: 'weight', label: 'Weight', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'mark', key: 'mark', label: 'The mark is the terrain', type: 'range', min: 0, max: 1, step: 0.01,
      needs: { of: 'motif', key: 'masked', least: 1,
        without: 'No bitmap could be taken of this shape — it is finer than the grid that '
          + 'reads it. The terrain is noise alone.' } },
    { group: 'mark', key: 'repeat', label: 'Marks across', type: 'range', min: 1, max: 6, step: 1 },
    { group: 'mark', key: 'spread', label: 'Mark size', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'mark', key: 'seed', label: 'Seed', type: 'seed' },
  ];

  return { key: 'atlas', kind: 'texture', vector: true, motif: true, ratio: 1,
    controls, paint, heightOf, simplify, GLYPH_TOLERANCE, SETS, NAMES };
}));
