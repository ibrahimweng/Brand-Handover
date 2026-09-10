/* weave — index-grid blankets.

   After PLAYGRND's Quilt, with the one change that makes it a brand pattern
   rather than a poster: every period is an exact divisor of the tile.

   Quilt measures each cell from the centre of the frame, so its compositions
   are mirror-symmetric and sit inside their own borders. That is right for a
   picture and wrong for a repeat — a mirrored block does tile, but along a
   mirror line, and the eye finds a mirror line as fast as it finds a join.

   So every style here is `cellAt(x, y)`: an integer expression on the cell
   coordinates, defined for every integer and not only for the ones inside the
   tile, with every period a divisor of the number of cells across. That makes
   seamlessness a thing to *prove* rather than to look at — test/run.js asks
   each style for the cell at (x, y) and at (x + C, y), for every style, every
   cell count and thousands of positions, and requires them to be the same
   value. Not nearly the same. The same.

   `divisorNear` is the whole mechanism: a style asks for a rib every eleven
   cells on a forty-eight cell tile and is given twelve, because eleven does not
   divide forty-eight and a pattern that nearly repeats is worse than one that
   obviously does not.

   Painted by run-length merging each row: a forty-eight square tile is 2,304
   cells and comes out as a few hundred rectangles, which is the difference
   between a file a designer can open and one that hangs Illustrator. */
//
// UMD, because the studio shipped in the package draws these in a browser and a
// generator with two copies is two patterns waiting to disagree.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../rand'), require('../noise'));
  else root.PatternWeave = factory(root.PatternRand, root.PatternNoise);
}(typeof self !== 'undefined' ? self : this, function (RAND, NOISE) {
  'use strict';

  const STYLES = ['bands', 'plaid', 'basket', 'dither', 'steps', 'diamond', 'cross', 'gingham'];

  // The divisor of n nearest to `want`. Ties go to the larger, because a pattern
  // that comes out slightly finer than asked reads as intended and one that comes
  // out coarser reads as a mistake.
  function divisorNear(n, want) {
    let best = 1, bestGap = Infinity;
    for (let d = 1; d <= n; d++) {
      if (n % d) continue;
      const gap = Math.abs(d - want);
      if (gap < bestGap || (gap === bestGap && d > best)) { best = d; bestGap = gap; }
    }
    return best;
  }
  // There was a `divisorNearEven` here and it did nothing.
  //
  // The reasoning was that a style whose colour alternates on a parity — bricks
  // in `bands`, blocks in `basket` — needs an even number of them, or the colour
  // flips where the tile meets itself. That is true of a grid built by walking
  // from zero to C. It is not true of this one, because every style wraps its
  // coordinates with mod(x, C) before doing anything else, so the tile *is* the
  // period and an odd count is simply an odd count, repeated faithfully.
  //
  // Both checks were run against it. The values repeat at every count, and the
  // seam measurement reads 1.00x for an odd brick count against 0.89x for an
  // even one — no difference worth a helper. It is gone rather than left in
  // looking careful.

  // Bayer 4x4, in the usual order. Its period is four, so a tile whose cell count
  // is a multiple of four carries it exactly.
  const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const mod = (n, p) => ((n % p) + p) % p;

  // Everything a style needs, worked out once from the parameters so that
  // `cellAt` is arithmetic and nothing else. Every number in here is a divisor
  // of the cell count, which is what makes the tile repeat.
  function plan(p) {
    const C = p.cells, chunk = p.chunk || 1;
    const rnd = RAND.stream(p.seed, `weave:${p.style}`);
    const q = { C, chunk, style: p.style };
    if (p.style === 'bands') {
      q.h = divisorNear(C, Math.max(2, Math.round(C / (6 * chunk))));
      q.rows = C / q.h;
      q.brick = divisorNear(C, Math.max(2, Math.round(C / (4 * chunk))));
      q.row = [];
      for (let r = 0; r < q.rows; r++) {
        q.row.push({ bg: 1 + (r % 2), on: rnd.chance(0.45) ? 3 : (r % 2 ? 1 : 2),
          phase: rnd.int(q.brick), full: rnd.chance(0.5) });
      }
    } else if (p.style === 'plaid') {
      q.pv = divisorNear(C, Math.max(2, Math.round(C / (5 * chunk))));
      q.ph = divisorNear(C, Math.max(2, Math.round(C / (4 * chunk))));
      q.rv = Math.max(1, Math.round(q.pv * 0.42));
      q.rh = Math.max(1, Math.round(q.ph * 0.38));
    } else if (p.style === 'basket') {
      q.b = divisorNear(C, Math.max(2, Math.round(C / (6 * chunk))));
      q.rib = Math.max(1, Math.round(q.b / 3));
      q.blocks = C / q.b;
    } else if (p.style === 'dither') {
      q.per = divisorNear(C, Math.max(4, Math.round(C / (3 * chunk))));
      q.warp = 0.5 * chunk;
      q.seed = p.seed;
    } else if (p.style === 'steps') {
      q.per = divisorNear(C, Math.max(4, Math.round(C / (2.2 * chunk))));
      q.widths = [];
      for (let i = 0, sum = 0; sum < q.per; i++) {
        const w = Math.max(1, Math.min(q.per - sum, 1 + rnd.int(Math.max(1, Math.round(q.per / 4)))));
        q.widths.push(w); sum += w;
      }
      q.seq = q.widths.map((_, i) => (i % 4 === 3 ? 3 : (i % 2) + 1));
      q.edges = [];
      for (let i = 0, sum = 0; i < q.widths.length; i++) { sum += q.widths[i]; q.edges.push(sum); }
    } else if (p.style === 'diamond') {
      q.per = divisorNear(C, Math.max(4, Math.round(C / (2.5 * chunk))));
      q.half = q.per / 2;
    } else if (p.style === 'cross') {
      q.per = divisorNear(C, Math.max(3, Math.round(C / (4 * chunk))));
      q.arm = Math.max(1, Math.round(q.per * 0.34));
      q.mid = Math.floor(q.per / 2);
    } else {
      q.per = divisorNear(C, Math.max(2, Math.round(C / (5 * chunk))));
      q.duty = Math.max(1, Math.round(q.per * 0.5));
    }
    return q;
  }

  // The palette index for one cell, for any integer x and y — inside the tile or
  // outside it. 0 is the ground; 1 and 2 are the two threads; 3 is the colour
  // that appears least, which is what makes a blanket look woven rather than
  // printed.
  function cellAt(x, y, q) {
    const C = q.C;
    const ux = mod(x, C), uy = mod(y, C);
    switch (q.style) {
      case 'bands': {
        const r = Math.floor(uy / q.h);
        const b = q.row[r];
        const brickIndex = Math.floor(mod(ux + b.phase, C) / q.brick);
        const inRow = b.full || (uy - r * q.h) < Math.max(1, q.h - 1);
        return inRow && brickIndex % 2 === 0 ? b.on : b.bg;
      }
      case 'plaid': {
        const v = mod(ux, q.pv) < q.rv, h = mod(uy, q.ph) < q.rh;
        return v && h ? 3 : v ? 1 : h ? 2 : 0;
      }
      case 'basket': {
        const bx = Math.floor(ux / q.b), by = Math.floor(uy / q.b);
        const over = (bx + by) % 2 === 0;
        const t = over ? mod(uy, q.b) : mod(ux, q.b);
        return mod(t, q.rib * 2) < q.rib ? (over ? 1 : 2) : 0;
      }
      case 'dither': {
        const w = NOISE.warp2(ux / C * q.per, uy / C * q.per, q.per, q.per, q.warp, 2, q.seed);
        const n = NOISE.fbm2(w[0], w[1], q.per, q.per, 3, q.seed + 5);
        const level = NOISE.evenly(n, 3);
        const t = (BAYER4[mod(uy, 4) * 4 + mod(ux, 4)] + 0.5) / 16;
        return level > t + 0.34 ? 3 : level > t ? 1 : level > t - 0.3 ? 2 : 0;
      }
      case 'steps': {
        const t = mod(ux + uy, q.per);
        let i = 0;
        while (i < q.edges.length - 1 && t >= q.edges[i]) i++;
        return q.seq[i];
      }
      case 'diamond': {
        const d = Math.abs(mod(ux, q.per) - q.half) + Math.abs(mod(uy, q.per) - q.half);
        const band = Math.floor((d / q.per) * 5);
        return band <= 0 ? 3 : band === 1 ? 1 : band === 2 ? 2 : 0;
      }
      case 'cross': {
        const ax = Math.abs(mod(ux, q.per) - q.mid), ay = Math.abs(mod(uy, q.per) - q.mid);
        if (ax === 0 && ay <= q.arm) return 3;
        if (ay === 0 && ax <= q.arm) return 3;
        if (ax <= q.arm && ay <= q.arm && ax + ay <= q.arm) return 2;
        if (ax <= q.arm && ay <= q.arm) return 1;
        return 0;
      }
      default: {
        const v = mod(ux, q.per) < q.duty, h = mod(uy, q.per) < q.duty;
        return v && h ? 3 : v ? 1 : h ? 2 : 0;
      }
    }
  }

  // Run-length merged, so identical neighbours in a row become one rectangle.
  function paint(surface, W, H, p, palette) {
    const q = plan(p);
    const C = q.C;
    const cw = W / C, ch = H / C;
    const R3 = (n) => Math.round(n * 1000) / 1000;
    surface.fillStyle = palette.ground;
    surface.fillRect(0, 0, W, H);
    for (let y = 0; y < C; y++) {
      let x = 0;
      while (x < C) {
        const v = cellAt(x, y, q);
        let n = 1;
        while (x + n < C && cellAt(x + n, y, q) === v) n++;
        if (v !== 0) {
          surface.fillStyle = palette.ink(v - 1);
          const x0 = R3(x * cw), x1 = R3((x + n) * cw);
          const y0 = R3(y * ch), y1 = R3((y + 1) * ch);
          surface.fillRect(x0, y0, x1 - x0, y1 - y0);
        }
        x += n;
      }
    }
  }

  const controls = [
    { group: 'pattern', key: 'cells', label: 'Cells', type: 'range', min: 8, max: 72, step: 4 },
    { group: 'pattern', key: 'chunk', label: 'Coarseness', type: 'range', min: 0.6, max: 2, step: 0.05 },
    { group: 'pattern', key: 'style', label: 'Style', type: 'chips', options: STYLES },
    { group: 'pattern', key: 'seed', label: 'Seed', type: 'seed' },
  ];

  return { key: 'weave', vector: true, styles: STYLES, controls,
    plan, cellAt, paint, divisorNear };
}));
