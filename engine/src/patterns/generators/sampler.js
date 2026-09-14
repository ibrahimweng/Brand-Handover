/* The mark, dealt into a sampler of modular tiles.

   PLAYGRND's Sampler lays a grid of square cells and deals each one a shape
   from a small vocabulary — a triangle, a diagonal, a bar, an elbow, a step, a
   half, a notch, an arrow — at a quarter-turn rotation, in one of two inks
   drawn per horizontal band. One kind per band reads as a weave; three or more
   reads as noise, so the number of kinds a band uses is the control that
   matters.

   The vocabulary here has a ninth shape and it is the client's own. That is the
   whole adaptation and it needs no bending: a modular tile set is a set of
   shapes that share a cell, and a logo is a shape that fits in a cell. Dealt at
   a rate the control sets, the mark turns up through the sheet as one of the
   pieces rather than as a thing printed over them — which is what a sampler is,
   a page of a workshop's own marks laid out to be looked at.

   Two things are load-bearing and both were learned the hard way elsewhere in
   this engine. The bands run on a **wrapping** row, so no band edge is pinned
   to the top of the tile and the tile still meets itself. And every cell is
   **scaled before it is rotated** — rotating first makes a quarter-turned tile
   overhang its neighbour on a non-square cell and leaves clipped slivers down
   the right-hand edge. */
//
// UMD: `paint` runs in the studio, which has no require.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../rand'), require('../motif'));
  } else root.PatternSampler = factory(root.PatternRand, root.PatternMotif);
}(typeof self !== 'undefined' ? self : this, function (RAND, MOTIF) {
  'use strict';

  const mod = (n, p) => ((n % p) + p) % p;
  const KINDS = ['tri', 'diag', 'bar', 'elbow', 'step', 'half', 'notch', 'arrow', 'mark'];

  /* One tile, drawn in a unit square centred on the origin.

     Every one of these is a filled path, and every one of them reads at a
     quarter turn — which is what makes the set modular. A shape that only works
     one way up is a shape that has to be dealt with a rule, and a rule is what
     turns a sampler back into a pattern. */
  function shape(s, kind) {
    const h = 0.5;
    s.beginPath();
    switch (kind) {
      case 'tri': s.moveTo(-h, -h); s.lineTo(h, -h); s.lineTo(-h, h); break;
      case 'diag': s.moveTo(-h, -h); s.lineTo(h, h); s.lineTo(h, h * 0.3); s.lineTo(-h, -h * 0.3); break;
      case 'bar': s.moveTo(-h, -h * 0.38); s.lineTo(h, -h * 0.38); s.lineTo(h, h * 0.38); s.lineTo(-h, h * 0.38); break;
      case 'elbow':
        s.moveTo(-h, -h); s.lineTo(-h * 0.3, -h); s.lineTo(-h * 0.3, h * 0.3);
        s.lineTo(h, h * 0.3); s.lineTo(h, h); s.lineTo(-h, h); break;
      case 'step':
        s.moveTo(-h, h); s.lineTo(-h, 0); s.lineTo(0, 0); s.lineTo(0, -h); s.lineTo(h, -h);
        s.lineTo(h, h); break;
      case 'half': s.moveTo(-h, 0); s.lineTo(h, 0); s.lineTo(h, h); s.lineTo(-h, h); break;
      case 'notch':
        s.moveTo(-h, -h); s.lineTo(h, -h); s.lineTo(h, h); s.lineTo(-h, h);
        s.moveTo(-h * 0.34, -h * 0.34); s.lineTo(-h * 0.34, h * 0.34);
        s.lineTo(h * 0.34, h * 0.34); s.lineTo(h * 0.34, -h * 0.34); break;
      case 'arrow': s.moveTo(0, -h); s.lineTo(h, h); s.lineTo(0, h * 0.28); s.lineTo(-h, h); break;
      default: return false;
    }
    s.closePath();
    // Even-odd, so `notch` comes out as a square with a hole rather than as a
    // square: its two rings are wound the same way.
    s.fill(kind === 'notch' ? 'evenodd' : 'nonzero');
    return true;
  }

  /* The bands, dealt once.

     A band's height is hashed, and the run starts at a hashed row and wraps —
     so a band that overruns the bottom of the tile comes back in at the top of
     the same tile, which is what makes the layout tile rather than the bands
     happening to line up. */
  function bandsOf(rows, p) {
    const n = Math.max(1, Math.round(p.bands));
    const seed = (p.seed || 1) * 53;
    const raw = [];
    let total = 0;
    for (let b = 0; b < n; b++) {
      const h = 0.55 + RAND.hash01(b, 0, seed + 1) * 0.95;
      raw.push(h); total += h;
    }
    const start = Math.floor(RAND.hash01(0, 0, seed + 2) * rows);
    const out = [];
    let at = 0;
    let run = 0;
    /* The band heights have to sum to the row count *exactly*.

       Rounding each band's share on its own leaves the run a row or two short
       of the tile, and the wrapping run then has a period that is not the
       tile's — so the bands step sideways at every vertical join. The seam test
       read it at 1.83 where 1 is the bar. Cumulative rounding gives whole
       heights that always add up: round the running edge rather than the
       height, and take the difference. */
    for (let b = 0; b < n; b++) {
      run += raw[b];
      const edge = b === n - 1 ? rows : Math.max(at + 1, Math.min(rows - (n - 1 - b),
        Math.round((run / total) * rows)));
      const h = Math.max(1, edge - at);
      const kinds = [];
      const many = 1 + Math.floor(RAND.hash01(b, 1, seed + 3) * (1 + p.variety * 2.2));
      for (let k = 0; k < many; k++) {
        kinds.push(Math.floor(RAND.hash01(b, 2 + k, seed + 4) * KINDS.length) % KINDS.length);
      }
      out.push({ from: at, h, kinds,
        inks: [Math.floor(RAND.hash01(b, 9, seed + 5) * 997),
          Math.floor(RAND.hash01(b, 10, seed + 6) * 997)] });
      at += h;
    }
    // `at` is now the row count by construction, but the fallback stays: a
    // band list of nothing would divide by zero here.
    return { list: out, start, span: at || rows };
  }

  function paint(surface, W, H, p, pal) {
    const cols = Math.max(3, Math.round(p.cols));
    const rows = Math.max(3, Math.round(cols * (H / W)));
    const cw = W / cols, ch = H / rows;
    const B = bandsOf(rows, p);
    const seed = (p.seed || 1) * 53;
    // The darkest ink is the page. Everything else is the working set, so a
    // tile can never be drawn in the colour it is printed on.
    const dark = pal.inks.reduce((a, b) => (a.against > b.against ? a : b));
    const work = pal.inks.filter((k) => k !== dark);
    const set = work.length ? work : pal.inks;
    pal.paper(surface, W, H, pal.ground);

    /* One ring of cells past every edge.

       A tile is drawn in its own cell and mostly stays there, but the mark is
       drawn at its own size — up to 1.4 cells across — and a stroked one is
       wider still. A cell in the left-hand column that overhangs was drawn once
       and cut off, so the tile seamed: the seam test read 1.43 where 1 is the
       bar. Drawn again one column over, the overhang appears on both sides of
       the join, which is what it does everywhere else on the sheet.

       The hash and the band are read at the *wrapped* index, so the extra ring
       is the same cell it is standing in for rather than a new deal. */
    for (let j = -1; j <= rows; j++) {
      const jw = mod(j, rows);
      // Which band this row is in, on the wrapping run.
      const t = mod(jw - B.start, B.span);
      let band = B.list[0];
      for (const b of B.list) if (t >= b.from && t < b.from + b.h) { band = b; break; }
      for (let i = -1; i <= cols; i++) {
        const iw = mod(i, cols);
        if (RAND.hash01(iw, jw, seed + 7) > p.coverage) continue;
        let kind = KINDS[band.kinds[Math.floor(RAND.hash01(iw, jw, seed + 8) * band.kinds.length)
          % band.kinds.length]];
        // The mark is one of nine kinds, but it is dealt at the rate the
        // control sets rather than at one in nine. Where the rate refuses it,
        // the cell falls back to the geometric tile next along — so turning the
        // rate down thins the marks out of the sheet instead of leaving holes.
        if (kind === 'mark' && !(RAND.hash01(iw, jw, seed + 11) < p.mark)) {
          kind = KINDS[Math.floor(RAND.hash01(iw, jw, seed + 12) * (KINDS.length - 1))
            % (KINDS.length - 1)];
        }
        const turn = Math.floor(RAND.hash01(iw, jw, seed + 9) * 4 * (0.25 + p.rotation * 0.75)) % 4;
        const which = RAND.hash01(iw, jw, seed + 10) < 0.5 + 0.3 * (p.balance - 0.5) ? 0 : 1;
        surface.fillStyle = set[band.inks[which] % set.length].hex;
        surface.strokeStyle = surface.fillStyle;
        surface.save();
        // Scale first, then rotate. The other order turns a quarter-turned tile
        // into a rectangle overhanging its neighbours on a non-square cell.
        surface.translate((i + 0.5) * cw, (j + 0.5) * ch);
        surface.scale(cw, ch);
        surface.rotate((turn * Math.PI) / 2);
        if (kind === 'mark') {
          if (p.motif && p.motif.ops && p.motif.ops.length) {
            MOTIF.draw(surface, p.motif, 0, 0, 0.5 * p.markSize);
          }
        } else shape(surface, kind);
        surface.restore();
      }
    }
  }

  const controls = [
    { group: 'grid', key: 'cols', label: 'Tiles across', type: 'range', min: 4, max: 48, step: 1 },
    { group: 'grid', key: 'bands', label: 'Bands', type: 'range', min: 1, max: 14, step: 1 },
    { group: 'tiles', key: 'variety', label: 'Shapes per band', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'tiles', key: 'rotation', label: 'Rotation', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'tiles', key: 'coverage', label: 'Coverage', type: 'range', min: 0.1, max: 1, step: 0.01 },
    { group: 'tiles', key: 'balance', label: 'Ink balance', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'mark', key: 'mark', label: 'Deal the mark', type: 'range', min: 0, max: 1, step: 0.01,
      needs: { of: 'motif', key: 'moves', least: 1,
        without: 'No shape could be read out of this drawing, so the sampler is dealt from '
          + 'the eight geometric tiles alone.' } },
    { group: 'mark', key: 'markSize', label: 'Mark size', type: 'range', min: 0.3, max: 1.4, step: 0.02 },
    { group: 'mark', key: 'seed', label: 'Seed', type: 'seed' },
  ];

  return { key: 'sampler', kind: 'pattern', vector: true, motif: true, ratio: 1,
    controls, paint, shape, bandsOf, KINDS };
}));
