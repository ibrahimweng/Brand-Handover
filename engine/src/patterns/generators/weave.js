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
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../rand'), require('../noise'), require('../motif'));
  else root.PatternWeave = factory(root.PatternRand, root.PatternNoise, root.PatternMotif);
}(typeof self !== 'undefined' ? self : this, function (RAND, NOISE, MOTIF) {
  'use strict';

  const STYLES = ['bands', 'plaid', 'basket', 'dither', 'steps', 'diamond', 'cross',
    'gingham', 'tabs', 'zigzag', 'rings', 'star', 'waves', 'burst'];

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
  // The divisor of n nearest `want` that leaves a count divisible by k.
  //
  // `tabs` offsets every other row by half a tab, so its row count has to be a
  // whole number of pairs or the offset — and the colour with it — changes
  // where the tile meets itself. Values still repeat (every style wraps to C
  // first), so the equality check sees nothing; what shows is a line down the
  // join, which the seam measurement read at z = 5.3 against 4 for the bar.
  //
  // The cell count is a multiple of four at every setting the control offers,
  // so a qualifying divisor always exists; the fallback is there because a
  // parameter set by hand need not obey the control.
  function divisorNearCycle(n, want, k) {
    let best = 0, bestGap = Infinity;
    for (let d = 1; d <= n; d++) {
      if (n % d || (n / d) % k) continue;
      const gap = Math.abs(d - want);
      if (gap < bestGap || (gap === bestGap && d > best)) { best = d; bestGap = gap; }
    }
    return best || divisorNear(n, want);
  }

  // A colour for each band, closing on itself whatever the count.
  //
  // Three versions of this, and the middle one is the interesting failure.
  //
  // First the four inks were cycled with `mod(band, 4)`, which needs the band
  // count to be a multiple of four or the colour changes where the tile meets
  // itself. Constraining the count to a multiple of four fixed the join and
  // broke the pattern: on a 44-cell tile the only divisors that qualify are 1
  // and 11, so the style was a hairline or four stripes, and four stripes is
  // not a chevron.
  //
  // Then the count was freed and the sequence seeded — `n` entries, so
  // `seq[band]` is defined for every band in the tile and the question of
  // closing never arises. It measured *worse*: 1.74 against the bar of 1.2,
  // where the fixed cycle had read 0.85. Not because it failed to repeat — in
  // cells the join changes exactly as many as the worst ordinary boundary, 20
  // of 36 — but because a random sequence makes every boundary a different
  // pair of inks, so one of them is the loudest in the tile, and a one-in-
  // twelve chance says that is the one at the join. A regular cycle makes all
  // the boundaries alike and there is nothing for the eye to find: the same
  // tile with `0,1,2,3` repeated reads 0.28.
  //
  // So: a regular cycle whose *length* bends to the count rather than the
  // count to the length, and the seed spends itself on which inks the cycle
  // uses and in what order. Four bands of pattern, not four stripes, and no
  // pair of neighbours louder than the rest.
  // `n` is even by construction — see `divisorNearCycle` at the call — so the
  // cycle is never length one and never leaves two bands of the same ink
  // touching across the wrap. A 13-band tile did exactly that and read 2.17.
  function bandInks(n, rnd) {
    const k = n % 4 === 0 ? 4 : n % 3 === 0 ? 3 : 2;
    const pool = [0, 1, 2, 3];
    for (let i = 3; i > 0; i--) { const j = rnd.int(i + 1); const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    const cycle = pool.slice(0, k);
    const seq = [];
    for (let i = 0; i < n; i++) seq.push(cycle[i % cycle.length]);
    return seq;
  }

  // The divisor of n nearest `want`, never smaller than `least` — unless n has
  // no divisor that large, in which case the largest there is.
  function divisorAtLeast(n, want, least) {
    let best = 0, bestGap = Infinity;
    for (let d = 1; d <= n; d++) {
      if (n % d || d < least) continue;
      const gap = Math.abs(d - want);
      if (gap < bestGap || (gap === bestGap && d > best)) { best = d; bestGap = gap; }
    }
    return best || divisorNear(n, want);
  }

  // There was a `divisorNearEven` here. It was removed on the reasoning that
  // every style wraps its coordinates with mod(x, C) before doing anything
  // else, so the tile *is* the period and an odd count is simply an odd count,
  // repeated faithfully. That reasoning is correct about *values* and wrong
  // about the picture, and the measurement that backed it was taken at one
  // cell count.
  //
  // `bands` alternates bricks on `brickIndex % 2` and `basket` alternates its
  // over-and-under on `(bx + by) % 2`. At 36 cells both happen to come out
  // even, which is why removing the constraint measured clean. At 20 cells
  // `bands` gets five bricks to the row and at 28 `basket` gets seven blocks,
  // and the parity flips where the tile meets itself: the seam reads 1.47 and
  // 1.43 against a bar of 1.2, and the values still repeat exactly, so the
  // equality check has nothing to say about it.
  //
  // So it is back, as `divisorNearCycle(C, want, 2)`, and the sweep that
  // caught it runs over every cell count the control offers rather than one.

  // Bayer 4x4, in the usual order. Its period is four, so a tile whose cell count
  // is a multiple of four carries it exactly.
  const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const mod = (n, p) => ((n % p) + p) % p;

  // A triangle wave on an integer period, rounded to whole cells. Rounding a
  // periodic function leaves it periodic, which is the only property the seam
  // cares about — so `zigzag` and `waves` can bend a row boundary without
  // giving up the exact repeat.
  const tri = (t, per, amp) => {
    const h = per / 2, u = mod(t, per);
    return Math.round((u < h ? u / h : (per - u) / h) * amp);
  };

  // Everything a style needs, worked out once from the parameters so that
  // `cellAt` is arithmetic and nothing else. Every number in here is a divisor
  // of the cell count, which is what makes the tile repeat.
  function plan(p) {
    const C = p.cells, chunk = p.chunk || 1;
    const rnd = RAND.stream(p.seed, `weave:${p.style}`);
    const q = { C, span: C, chunk, style: p.style };
    if (p.style === 'bands') {
      q.h = divisorNear(C, Math.max(2, Math.round(C / (6 * chunk))));
      q.rows = C / q.h;
      q.brick = divisorNearCycle(C, Math.max(2, Math.round(C / (4 * chunk))), 2);
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
      q.b = divisorNearCycle(C, Math.max(2, Math.round(C / (6 * chunk))), 2);
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
    } else if (p.style === 'tabs') {
      q.th = divisorNearCycle(C, Math.max(2, Math.round(C / (7 * chunk))), 2);
      q.per = divisorNear(C, Math.max(3, Math.round(C / (6 * chunk))));
      q.tw = Math.max(1, Math.round(q.per * 0.62));
      q.half = Math.floor(q.per / 2);
      q.foot = Math.max(1, Math.round(q.th / 3));
    } else if (p.style === 'zigzag') {
      q.per = divisorNear(C, Math.max(4, Math.round(C / (3 * chunk))));
      q.amp = Math.max(1, Math.round(q.per * 0.5));
      q.w = divisorNearCycle(C, Math.max(2, Math.min(Math.round(C / (8 * chunk)), Math.floor(C / 4))), 2);
      q.seq = bandInks(C / q.w, rnd);
    } else if (p.style === 'rings') {
      // Eight is a floor and it has to be enforced as one. A block with fewer
      // cells than that has room for two rings, and two rings cannot carry
      // four colours: rings dropped to an orange-and-green chequer at the
      // coarse end. Asking `divisorNear` for the divisor nearest eight is not
      // the same thing — on a 52-cell tile the divisors are 1, 2, 4, 13, 26,
      // 52, and the nearest to eight is four. So the floor is applied to the
      // candidates, not to the wish.
      q.b = divisorAtLeast(C, Math.max(8, Math.round(C / (4 * chunk))), 8);
      q.mid = (q.b - 1) / 2;
      // and enough rings to show the whole cycle, which is what the block size
      // buys. Four rings at three cells each need a block of twelve.
      q.rw = Math.max(1, Math.min(Math.round(q.b / 8), Math.floor(q.mid / 3)));
    } else if (p.style === 'star') {
      q.b = divisorNear(C, Math.max(5, Math.round(C / (4 * chunk))));
      q.mid = (q.b - 1) / 2;
      q.arm = Math.max(1, Math.round(q.b * 0.46));
      q.core = Math.max(1, Math.round(q.b * 0.17));
    } else if (p.style === 'waves') {
      q.per = divisorNear(C, Math.max(4, Math.round(C / (2.5 * chunk))));
      q.h = divisorNearCycle(C, Math.max(2, Math.min(Math.round(C / (9 * chunk)), Math.floor(C / 4))), 2);
      q.amp = Math.max(1, Math.round(q.h * 1.1));
      q.seq = bandInks(C / q.h, rnd);
    } else if (p.style === 'burst') {
      q.b = divisorNear(C, Math.max(6, Math.round(C / (3 * chunk))));
      q.mid = (q.b - 1) / 2;
      q.rays = 8;
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
        const b = q.row[mod(r, q.row.length)];
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
        const w = NOISE.warp2(ux / q.span * q.per, uy / q.span * q.per, q.per, q.per, q.warp, 2, q.seed);
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
      case 'tabs': {
        // Rows of tabs, every other row shifted by half a tab, the way a tabbed
        // edging is set out. The space between tabs is ground showing through,
        // and the last third of each row is the tab's foot in the fourth ink.
        const r = Math.floor(uy / q.th);
        const t = mod(ux + (mod(r, 2) ? q.half : 0), q.per);
        if (t >= q.tw) return 0;
        return mod(uy, q.th) >= q.th - q.foot ? 3 : (mod(r, 2) ? 2 : 1);
      }
      case 'zigzag': {
        // A chevron: the row boundary is a triangle wave, so the bands bend
        // instead of running straight. Four bands to a cycle, so no two
        // touching bands share an ink.
        return q.seq[mod(Math.floor(mod(uy + tri(ux, q.per, q.amp), C) / q.w), q.seq.length)];
      }
      case 'rings': {
        // Concentric square rings around each block's middle — Chebyshev
        // distance, bucketed. Square rather than round because the grid is
        // square and a circle drawn on it is a staircase pretending otherwise.
        const dx = Math.abs(mod(ux, q.b) - q.mid), dy = Math.abs(mod(uy, q.b) - q.mid);
        const n = mod(Math.floor(Math.max(dx, dy) / q.rw), 4);
        return n === 0 ? 3 : n === 1 ? 1 : n === 2 ? 0 : 2;
      }
      case 'star': {
        // Eight points: a square arm crossed with a diagonal one, which is what
        // an eight-point quilt star is when you write it down.
        const dx = Math.abs(mod(ux, q.b) - q.mid), dy = Math.abs(mod(uy, q.b) - q.mid);
        const cheb = Math.max(dx, dy), manh = dx + dy;
        if (cheb <= q.core) return 3;
        if (Math.min(dx, dy) * 2 <= q.core && cheb <= q.arm) return 1;
        if (manh <= q.arm) return 2;
        return 0;
      }
      case 'waves': {
        // Sine-bounded rows, the sine rounded to whole cells so the boundary
        // lands on the grid and the tile still repeats exactly.
        const s = Math.round(Math.sin(mod(ux, q.per) / q.per * Math.PI * 2) * q.amp);
        return q.seq[mod(Math.floor(mod(uy + s, C) / q.h), q.seq.length)];
      }
      case 'burst': {
        // Rays from each block's middle. The sector is an angle bucket, so it
        // is constant along a ray, and the ray count divides the block, so the
        // block edge closes on itself.
        const dx = mod(ux, q.b) - q.mid, dy = mod(uy, q.b) - q.mid;
        const sector = mod(Math.floor((Math.atan2(dy, dx) / (Math.PI * 2) + 0.5) * q.rays), q.rays);
        const r = Math.max(Math.abs(dx), Math.abs(dy));
        if (r <= q.b * 0.12) return 3;
        return mod(sector, 2) === 0 ? 1 : (r > q.b * 0.32 ? 2 : 0);
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
    const motif = p.motif || null;
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
    // The identity's own shape, on the cells that carry the fourth ink.
    //
    // Not on a hash of its own and not on every cell. `weave` already decides
    // which cells are the pop colour — the one that appears least, which is
    // what makes a blanket look woven rather than printed — and those are
    // exactly the cells a motif belongs on: sparse, spread by the style's own
    // arithmetic, and already a deliberate accent rather than a texture.
    //
    // Except that three styles have no pop cells at all. `basket` is two
    // threads on a ground, `zigzag` and `waves` run a two-ink cycle when the
    // band count is not a multiple of four — measured at 0.0% for all three —
    // so a motif placed this way would never be drawn while the tile went on
    // saying it was made of the client's mark. A pattern that quietly is not
    // what it claims is worse than one that is plainly something else, so
    // below a floor the placement falls back to a hash and the mark appears
    // either way.
    if (motif && MOTIF) {
      let pop = 0;
      for (let y = 0; y < C; y++) for (let x = 0; x < C; x++) if (cellAt(x, y, q) === 3) pop++;
      const onPop = pop / (C * C) >= 0.04;
      const r = Math.min(cw, ch) * 0.44;
      for (let y = 0; y < C; y++) {
        for (let x = 0; x < C; x++) {
          const here = onPop ? cellAt(x, y, q) === 3
            : RAND.hash01(x, y, q.seed + 911) < 0.09;
          if (!here) continue;
          // On ink in the ground's colour and on ground in the ink's, so the
          // mark reads either way rather than vanishing on half the tile.
          surface.fillStyle = cellAt(x, y, q) === 0 ? palette.ink(0) : palette.ground;
          MOTIF.draw(surface, motif, R3((x + 0.5) * cw), R3((y + 0.5) * ch), R3(r));
        }
      }
    }
  }

  const controls = [
    { group: 'pattern', key: 'cells', label: 'Cells', type: 'range', min: 8, max: 72, step: 4 },
    { group: 'pattern', key: 'chunk', label: 'Coarseness', type: 'range', min: 0.6, max: 2, step: 0.05 },
    { group: 'pattern', key: 'style', label: 'Style', type: 'chips', options: STYLES },
    { group: 'pattern', key: 'seed', label: 'Seed', type: 'seed' },
  ];

  return { key: 'weave', vector: true, motif: true, styles: STYLES, controls,
    plan, cellAt, paint, divisorNear };
}));
