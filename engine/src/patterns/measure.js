/* Six measurements of a pattern, taken off its pixels.

   The point of this file is to make "our pattern looks like yours" a claim
   somebody can check. Not a trace — a trace of a client's pattern is their
   pattern, redrawn, and it cannot be re-coloured, re-scaled or regenerated,
   which is the whole reason this engine exists. Instead: measure theirs,
   measure ours, print both columns, and let the numbers be the argument.

     palette      which colours, and how much of the picture each one covers
     scale        the dominant period — how often it comes round
     orientation  which way it runs, and how strongly it runs that way
     coverage     how much of the picture is ink rather than ground
     regularity   whether that period is a repeat or a tendency
     hardness     whether an edge happens in one pixel or over twenty

   Every one of them is proved in test/run.js against a picture whose answer is
   known because the picture was built to have it: stripes of a stated period,
   a field at a stated angle, a ground with a stated share of ink on it. A
   measurement nobody has checked against a known answer is a number, not a
   measurement.

   Everything here reads an RGBA field — the shape raster.js makes and resvg
   hands back — so a client's PNG, a client's SVG and a tile this engine drew
   are all measured by the same code, which is the only way the two columns
   mean anything. */
'use strict';

// Measuring at full size is slow and measures the same thing: a pattern's
// period and direction do not change when you look at it smaller. So the long
// side comes down to this, by box-sampling rather than by dropping pixels —
// dropping pixels aliases, and aliasing is exactly what the scale measurement
// would then report.
const WORK = 256;
// Lags below this are the thickness of a stroke rather than the period of a
// pattern, and every picture correlates with itself a few pixels over.
const LEAST_LAG = 4;

// ---------------------------------------------------------------- the field

// A field is { width, height, data } with data RGBA, eight bits, top-left
// origin. Alpha is composited onto white, because a pattern with a hole in it
// is a pattern on whatever it is printed on, and that is paper until told
// otherwise.
function luminance(f) {
  const n = f.width * f.height;
  const L = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = f.data[i * 4 + 3] / 255;
    const r = f.data[i * 4] * a + 255 * (1 - a);
    const g = f.data[i * 4 + 1] * a + 255 * (1 - a);
    const b = f.data[i * 4 + 2] * a + 255 * (1 - a);
    L[i] = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }
  return L;
}

// Box-sample down to at most WORK on the long side. Every output pixel is the
// mean of the input pixels it covers, so a period of 40 in a 1024-wide image
// becomes a period of 10 in a 256-wide one rather than becoming noise.
function shrink(f, to) {
  const target = to || WORK;
  const long = Math.max(f.width, f.height);
  if (long <= target) return f;
  const k = target / long;
  const W = Math.max(1, Math.round(f.width * k)), H = Math.max(1, Math.round(f.height * k));
  const out = { width: W, height: H, data: new Uint8Array(W * H * 4) };
  for (let y = 0; y < H; y++) {
    const y0 = Math.floor(y * f.height / H), y1 = Math.max(y0 + 1, Math.floor((y + 1) * f.height / H));
    for (let x = 0; x < W; x++) {
      const x0 = Math.floor(x * f.width / W), x1 = Math.max(x0 + 1, Math.floor((x + 1) * f.width / W));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * f.width + xx) * 4;
          r += f.data[i]; g += f.data[i + 1]; b += f.data[i + 2]; a += f.data[i + 3]; n++;
        }
      }
      const o = (y * W + x) * 4;
      out.data[o] = Math.round(r / n); out.data[o + 1] = Math.round(g / n);
      out.data[o + 2] = Math.round(b / n); out.data[o + 3] = Math.round(a / n);
    }
  }
  return out;
}

// Which pixels to count colours over.
//
// Every one of them, up to this many. Sampling on a rectangular lattice is the
// obvious thing and it is a trap: a step of 2 over a pattern whose period is 2
// lands on one phase and only one. Red dots on white, one pixel in four,
// sampled every second pixel, came back **100% red and 0% white**, and the ink
// share of a ten-column pattern came back at exactly double. The lattice and
// the pattern were in step, which is the one thing a pattern can be relied on
// to do.
//
// Past the cap the picture is walked in flat index order with a stride coprime
// to the pixel count, which visits every pixel eventually and cannot stay in
// step with any period, because a period that divided the stride would have to
// divide a number the stride shares no factor with.
const EVERY = 4e6;
function eachPixel(f, fn) {
  const n = f.width * f.height;
  if (n <= EVERY) { for (let i = 0; i < n; i++) fn(i); return n; }
  let step = Math.floor(n / EVERY) | 1;
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  while (gcd(step, n) !== 1) step += 2;
  let i = 0;
  for (let k = 0; k < EVERY; k++) { fn(i); i = (i + step) % n; }
  return EVERY;
}

// The middle of the picture, at most `to` on a side. Used where sharpness is
// the thing being measured and resampling would blunt it.
function crop(f, to) {
  if (f.width <= to && f.height <= to) return f;
  const W = Math.min(f.width, to), H = Math.min(f.height, to);
  const x0 = Math.floor((f.width - W) / 2), y0 = Math.floor((f.height - H) / 2);
  const out = { width: W, height: H, data: new Uint8Array(W * H * 4) };
  for (let y = 0; y < H; y++) {
    const from = ((y0 + y) * f.width + x0) * 4;
    out.data.set(f.data.subarray(from, from + W * 4), y * W * 4);
  }
  return out;
}

// ------------------------------------------------------------------ palette

// k-means in Lab, from a fixed start, so the same picture gives the same
// palette every time it is asked. Lab because a difference in RGB is not a
// difference anybody can see, which vision.js says at more length.
//
// The start is not random and it is not the first k pixels: it is k colours
// spread along the picture's own lightness range, which is a start that does
// not depend on where a pixel happens to sit.
// Note what this does NOT do: it does not box-sample. Averaging neighbouring
// pixels invents colours that are not in the picture — a red dot pattern on
// white, sampled down by half, is 89% pink and 0% red, which is what the first
// version of this reported. Where a picture is too large to walk every pixel,
// pixels are *skipped*, never blended. Skipping loses some colours; blending
// replaces them with ones the designer never chose.
function palette(field, want) {
  const f = field;
  const k = Math.max(1, Math.min(8, want || 5));
  const V = require('../vision');
  // Every distinct colour, with how many pixels wear it. A pattern is usually
  // a handful of flat colours, so this collapses a quarter of a million pixels
  // to a few hundred rows and the clustering runs on the rows.
  const seen = new Map();
  const n = eachPixel(f, (i) => {
    const a = f.data[i * 4 + 3] / 255;
    const r = Math.round(f.data[i * 4] * a + 255 * (1 - a));
    const g = Math.round(f.data[i * 4 + 1] * a + 255 * (1 - a));
    const b = Math.round(f.data[i * 4 + 2] * a + 255 * (1 - a));
    const key = (r << 16) | (g << 8) | b;
    seen.set(key, (seen.get(key) || 0) + 1);
  });
  const rows = [...seen.entries()].map(([key, count]) => {
    const r = (key >> 16) & 255, g = (key >> 8) & 255, b = key & 255;
    const hex = `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
    return { hex, rgb: [r, g, b], count, lab: V.lab(hex) };
  }).sort((a, b) => b.count - a.count);
  if (!rows.length) return [];
  if (rows.length <= k) {
    return rows.map((r) => ({ hex: r.hex, rgb: r.rgb, lab: r.lab, share: r.count / n }))
      .sort((a, b) => b.share - a.share);
  }

  const Ls = rows.map((r) => r.lab[0]);
  const lo = Math.min(...Ls), hi = Math.max(...Ls);
  let centres = [];
  for (let i = 0; i < k; i++) {
    const at = lo + ((hi - lo) * (k === 1 ? 0.5 : i / (k - 1)));
    // the row nearest that lightness, so a centre starts on a colour that
    // exists rather than on one nobody used
    let best = rows[0], bd = Infinity;
    for (const r of rows) { const d = Math.abs(r.lab[0] - at); if (d < bd) { bd = d; best = r; } }
    centres.push(best.lab.slice());
  }

  let owner = new Int32Array(rows.length).fill(-1);
  for (let pass = 0; pass < 40; pass++) {
    let moved = 0;
    for (let i = 0; i < rows.length; i++) {
      let bi = 0, bd = Infinity;
      for (let c = 0; c < centres.length; c++) {
        const d = (rows[i].lab[0] - centres[c][0]) ** 2 + (rows[i].lab[1] - centres[c][1]) ** 2
          + (rows[i].lab[2] - centres[c][2]) ** 2;
        if (d < bd) { bd = d; bi = c; }
      }
      if (owner[i] !== bi) { owner[i] = bi; moved++; }
    }
    const sum = centres.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < rows.length; i++) {
      const s = sum[owner[i]], w = rows[i].count;
      s[0] += rows[i].lab[0] * w; s[1] += rows[i].lab[1] * w; s[2] += rows[i].lab[2] * w; s[3] += w;
    }
    centres = centres.map((c, i) => (sum[i][3] ? [sum[i][0] / sum[i][3], sum[i][1] / sum[i][3], sum[i][2] / sum[i][3]] : c));
    if (!moved) break;
  }

  // Each cluster is reported by the colour in it that most pixels actually
  // wear, not by the cluster's mean: a mean of two inks is a third ink that is
  // not in the picture, and a client asked to accept it would be right not to.
  const out = [];
  for (let c = 0; c < centres.length; c++) {
    let count = 0, best = null;
    for (let i = 0; i < rows.length; i++) {
      if (owner[i] !== c) continue;
      count += rows[i].count;
      if (!best || rows[i].count > best.count) best = rows[i];
    }
    if (best) out.push({ hex: best.hex, rgb: best.rgb, lab: best.lab, share: count / n });
  }
  return out.sort((a, b) => b.share - a.share);
}

// ----------------------------------------------------------------- coverage

// The ground is the colour most of the picture is; everything else is ink.
// That is a definition rather than a discovery, and it is the one a designer
// would give: a cream page with a burgundy pattern on it is 12% ink whichever
// of the two you happen to call the colour.
function coverage(field, pal) {
  const p = pal || palette(field, 5);   // palette() strides; it never blends
  if (!p.length) return 0;
  return Math.max(0, Math.min(1, 1 - p[0].share));
}

// ------------------------------------------------------------------- scale

// How often does the picture come round? Correlate it with itself, shifted.
//
// Separably, along each axis, because a pattern can have a period across and
// none down and the two failures look nothing alike. At each lag the answer is
// Pearson's correlation over the overlap, so it is 1 for a perfect repeat, 0
// for no relationship and -1 for the half-period of a stripe.
function correlate(L, W, H, axis, maxLag) {
  const out = new Float64Array(maxLag + 1);
  for (let d = 1; d <= maxLag; d++) {
    let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, n = 0;
    if (axis === 'x') {
      for (let y = 0; y < H; y++) {
        for (let x = 0; x + d < W; x++) {
          const a = L[y * W + x], b = L[y * W + x + d];
          sa += a; sb += b; saa += a * a; sbb += b * b; sab += a * b; n++;
        }
      }
    } else {
      for (let y = 0; y + d < H; y++) {
        for (let x = 0; x < W; x++) {
          const a = L[y * W + x], b = L[(y + d) * W + x];
          sa += a; sb += b; saa += a * a; sbb += b * b; sab += a * b; n++;
        }
      }
    }
    if (!n) { out[d] = 0; continue; }
    const va = saa / n - (sa / n) ** 2, vb = sbb / n - (sb / n) ** 2;
    const cov = sab / n - (sa / n) * (sb / n);
    out[d] = va > 1e-12 && vb > 1e-12 ? cov / Math.sqrt(va * vb) : 0;
  }
  return out;
}

// The first lag that is a local maximum and stands above the run of the
// series. "Highest value" is the wrong rule: a pattern of period 20 correlates
// just as well at 40 and 60, and reporting 60 because floating point put it a
// thousandth higher would be a period nobody sees.
function firstPeak(c, least) {
  const start = Math.max(least, LEAST_LAG);
  let mean = 0, n = 0;
  for (let d = start; d < c.length; d++) { mean += c[d]; n++; }
  mean = n ? mean / n : 0;
  let sd = 0;
  for (let d = start; d < c.length; d++) sd += (c[d] - mean) ** 2;
  sd = n ? Math.sqrt(sd / n) : 0;
  const bar = mean + Math.max(0.15, sd);
  for (let d = start + 1; d < c.length - 1; d++) {
    if (c[d] > bar && c[d] >= c[d - 1] && c[d] >= c[d + 1]) {
      return { lag: d, height: c[d], floor: mean, spread: sd };
    }
  }
  // no peak: the strongest lag, reported as one nobody should believe
  let bi = start, bv = -Infinity;
  for (let d = start; d < c.length; d++) if (c[d] > bv) { bv = c[d]; bi = d; }
  return { lag: bi, height: bv, floor: mean, spread: sd, none: true };
}

function scale(field) {
  const f = shrink(field);
  const L = luminance(f);
  const maxX = Math.max(LEAST_LAG + 2, Math.floor(f.width / 2));
  const maxY = Math.max(LEAST_LAG + 2, Math.floor(f.height / 2));
  const cx = correlate(L, f.width, f.height, 'x', maxX);
  const cy = correlate(L, f.width, f.height, 'y', maxY);
  const px = firstPeak(cx, LEAST_LAG), py = firstPeak(cy, LEAST_LAG);
  // Which axis carries the period. Height alone is the wrong test, and it was
  // the first version: vertical stripes are *perfectly* correlated at every
  // vertical lag, because shifting a column of one colour down changes nothing.
  // That reads as height 1.00 at lag 4 and wins against the real period of 40
  // on the other axis. A flat series has no peak in it, which `firstPeak`
  // already says with `none`; so an axis that found a peak beats one that did
  // not, and only then does height decide.
  const takeX = px.none === py.none ? px.height >= py.height : !px.none;
  const strong = takeX ? px : py;
  const axis = takeX ? 'x' : 'y';
  const k = Math.max(field.width, field.height) / Math.max(f.width, f.height);
  // How many repeats fit across the picture, measured along the axis the
  // period was found on — which is the picture's own span, not the shrunken
  // one, and not the other axis.
  const span = axis === 'x' ? f.width : f.height;
  return {
    // in the original picture's pixels, and as repeats across it — the second
    // is what maps onto a generator's cell count and the first is what a client
    // recognises
    period: Math.round(strong.lag * k),
    across: Math.round((span / strong.lag) * 10) / 10,
    axis,
    // How much of a repeat it is: 0 is a tendency, 1 is a tile.
    //
    // Zero when no peak was found, and that is not tidying. A picture whose
    // correlation slides smoothly down from 1 — a cloud field, a wash — has a
    // high value at short lags and a low mean across all of them, so the
    // difference is large while there is no repeat anywhere in it. The table
    // printed "no repeat" and "a repeat" in two rows about the same picture.
    regularity: strong.none ? 0
      : Math.max(0, Math.min(1, Math.round((strong.height - strong.floor) * 100) / 100)),
    found: !strong.none,
    both: {
      x: { period: Math.round(px.lag * k), height: Math.round(px.height * 100) / 100, found: !px.none },
      y: { period: Math.round(py.lag * k), height: Math.round(py.height * 100) / 100, found: !py.none },
    },
  };
}

// -------------------------------------------------------------- orientation

// Which way does it run? Sobel gradients, histogrammed by direction and
// weighted by how strong they are.
//
// An edge has no arrow on it — a line running north-east and one running
// south-west are the same line — so directions are taken modulo 180 and summed
// as doubled angles. That is not a trick: adding 10° and 170° as they are gives
// 90°, which is the one answer that is certainly wrong, and doubling them makes
// them 20° and 340°, which average to 0°, which is right.
function gradients(f) {
  const L = luminance(f), W = f.width, H = f.height;
  const gx = new Float64Array(W * H), gy = new Float64Array(W * H);
  const at = (x, y) => L[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      gx[i] = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1))
        - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      gy[i] = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1))
        - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
    }
  }
  return { gx, gy, W, H };
}

function orientation(field) {
  const f = shrink(field);
  const { gx, gy, W, H } = gradients(f);
  let sx = 0, sy = 0, total = 0;
  for (let i = 0; i < W * H; i++) {
    const m = Math.hypot(gx[i], gy[i]);
    if (m < 1e-9) continue;
    // the edge runs across the gradient, so the edge's angle is the gradient's
    // turned a quarter; doubled, that is the gradient's doubled angle turned a
    // half, which is a sign
    const a2 = 2 * Math.atan2(gy[i], gx[i]);
    sx += -m * Math.cos(a2); sy += -m * Math.sin(a2);
    total += m;
  }
  if (!total) return { angle: 0, strength: 0, kind: 'flat' };
  const strength = Math.hypot(sx, sy) / total;
  let angle = (Math.atan2(sy, sx) / 2) * 180 / Math.PI;
  angle = ((angle % 180) + 180) % 180;
  // and rounding must not be able to produce 180, which is 0 said the long way
  angle = Math.round(angle * 10) / 10;
  if (angle >= 180) angle -= 180;
  return {
    // Degrees, in the picture's own frame: x to the right and **y downwards**,
    // because that is where a pixel at (0,0) is. 0 is a line running left to
    // right, 90 one running top to bottom, 135 one running from the top-right
    // corner to the bottom-left. Stating this is not pedantry: y-up and y-down
    // disagree about which diagonal is 45, and both look right in isolation.
    angle,
    // 0 means every direction equally — a field. 1 means one direction only —
    // a stripe. The bands between them are named in test/run.js against
    // pictures built to sit in each.
    strength: Math.round(strength * 100) / 100,
    kind: strength < 0.15 ? 'even' : strength < 0.45 ? 'leaning' : 'lined',
  };
}

// ----------------------------------------------------------------- hardness

// Does an edge happen in one pixel or over twenty?
//
// The first version asked what share of the picture's change was carried by
// its steepest tenth, and it was wrong in a way worth recording: it measured
// *how many* edges there are, not how sharp they are. Stripes of period 40 and
// stripes of period 200, cut equally hard, came out at 0.56 and 0.93, because
// the finer pattern spends more than a tenth of its pixels on edges and the
// top tenth can then only hold half of them.
//
// Sharpness is a local shape, so it is measured locally. A ramp that rises
// evenly over k pixels has a constant first derivative and a second derivative
// of nearly zero; a step has a first derivative at one pixel and a second
// derivative just as large. So the ratio of curvature to slope says how wide a
// transition is, and says it the same whether there are two edges or two
// hundred:
//
//     mean |Laplacian| / mean |gradient|  ~  1/k, for a transition k px wide
//
// The constant is not assumed, it is measured: ramps built one, two, four,
// eight and twenty pixels wide come out at 1.0, 2.0, 3.9, 7.8 and 14.2, so the
// number is the width in pixels and a step edge is 1. It is reported as 1/k as
// well, so 1 is a knife edge, 0.25 is a transition over four pixels and a
// gradient across the whole picture is near zero.
//
// And it does not move with how many edges there are, which the first version
// did: hard stripes of period 20, 40, 100 and 200 all measure 1.0.
function hardness(field) {
  // NOT shrunk. Box-sampling a picture turns every step edge into a ramp two
  // pixels wide, which is the exact thing this measures: a vector pattern with
  // knife edges read 2.2 px and "mixed" for no reason but the sampling. Where
  // the picture is too large to walk, a middle crop is taken — a crop keeps
  // every edge exactly as sharp as it was, and a resample cannot.
  const f = crop(field, 2048);
  const L = luminance(f), W = f.width, H = f.height;
  const { gx, gy } = gradients(f);
  const at = (x, y) => L[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))];
  let slope = 0, curve = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      // the Sobel gradients are eight times the per-pixel slope
      slope += Math.hypot(gx[i], gy[i]) / 8;
      curve += Math.abs(at(x - 1, y) + at(x + 1, y) + at(x, y - 1) + at(x, y + 1) - 4 * at(x, y)) / 2;
    }
  }
  if (slope < 1e-9) return { value: 0, kind: 'flat', width: null };
  const ratio = curve / slope;            // about 1/k, calibrated above
  const width = Math.max(1, 1 / Math.max(ratio, 1e-9));
  const value = Math.round(Math.min(1, 1 / width) * 100) / 100;
  return {
    value,
    // how many pixels a transition takes, which is the thing the number means
    width: Math.round(width * 10) / 10,
    // The two boundaries sit in gaps in the measurements above — 1.00, 0.50,
    // 0.25, 0.13, 0.07 — rather than at round numbers chosen first.
    kind: value > 0.6 ? 'hard' : value > 0.19 ? 'mixed' : 'soft',
  };
}

// ------------------------------------------------------ weight and axiality

// Two more, and they exist for one reason: the first six did not tell the field
// generators apart. Handing each its own output back and asking which drew it,
// the two hard-edged generators came back right every time by margins of 0.026
// to 0.465, and the three field ones came back right seven times in ten by
// margins of 0.004 to 0.021. They occupied the same place in that
// six-dimensional space while looking nothing like each other, which says the
// space was missing an axis, not that the search was weak.
//
// What a person sees that the six do not measure:
//
//   thread   thin strokes, long and connected
//   field    blocky cells, square, lined up with the page
//
// So: how thick the ink is, and how much of it lies along the two axes. One of
// the three was a contour field and has since been removed; both measurements
// earn their place without it, and the eight generators-and-styles they now
// separate are told apart by wider margins than the three ever were.

// The mean thickness of the inked parts, in pixels.
//
// Area over half the boundary. A long run of ink w wide and L long has area Lw
// and a boundary of about 2L, so 2·area/boundary is w — the width, whatever the
// shape is doing elsewhere. A stroke comes out thin and a block comes out as
// wide as the block, which is the distinction the six were missing.
function weight(field, pal) {
  const f = shrink(field);
  const p = pal || palette(f, 5);
  if (!p.length) return { px: 0, share: 0 };
  const V = require('../vision');
  const ground = p[0].lab;
  const W = f.width, H = f.height;
  const ink = new Uint8Array(W * H);
  let area = 0;
  for (let i = 0; i < W * H; i++) {
    const a = f.data[i * 4 + 3] / 255;
    const hex = `#${[0, 1, 2].map((k) => Math.round(f.data[i * 4 + k] * a + 255 * (1 - a))
      .toString(16).padStart(2, '0')).join('')}`;
    const lab = V.lab(hex);
    // Ink is what is not the ground, by the same rule `coverage` uses — and
    // "not the ground" has to mean visibly not, or antialiasing is ink.
    const d = Math.hypot(lab[0] - ground[0], lab[1] - ground[1], lab[2] - ground[2]);
    if (d > 12) { ink[i] = 1; area++; }
  }
  if (!area) return { px: 0, share: 0 };
  let edge = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!ink[i]) continue;
      if (x === 0 || x === W - 1 || y === 0 || y === H - 1
        || !ink[i - 1] || !ink[i + 1] || !ink[i - W] || !ink[i + W]) edge++;
    }
  }
  const px = edge ? (2 * area) / edge : 0;
  return {
    px: Math.round(px * 10) / 10,
    // as a share of the picture, so it can be compared between sizes
    share: Math.round((px / Math.max(W, H)) * 1000) / 1000,
  };
}

// How much of the picture's change lies along the two axes.
//
// A grid of square cells puts nearly all of it there; a field of contours
// spreads it everywhere. Measured as the concentration of edge energy at
// four times the angle — four, because the two axes are a quarter turn apart
// and a quarter turn has to come back to the same place for this to be one
// number rather than two.
function axiality(field) {
  const f = shrink(field);
  const { gx, gy, W, H } = gradients(f);
  let sx = 0, sy = 0, total = 0;
  for (let i = 0; i < W * H; i++) {
    const m = Math.hypot(gx[i], gy[i]);
    if (m < 1e-9) continue;
    const a4 = 4 * Math.atan2(gy[i], gx[i]);
    sx += m * Math.cos(a4); sy += m * Math.sin(a4);
    total += m;
  }
  if (!total) return { value: 0, kind: 'none' };
  // 1 is everything on the axes (or everything at 45°, which the sign tells
  // apart); 0 is every direction equally.
  const r = Math.hypot(sx, sy) / total;
  const on = Math.cos(Math.atan2(sy, sx)) >= 0;
  return {
    value: Math.round(r * 100) / 100,
    // which pair of directions it is lined up with, where it is lined up at all
    kind: r < 0.15 ? 'every way' : on ? 'square to the page' : 'diagonal',
  };
}

// --------------------------------------------------------------------- all

// The six, taken once, off one field. The palette is computed once and handed
// to coverage rather than computed twice, because two answers to one question
// is how two of them come to disagree.
function all(field, opts) {
  const o = opts || {};
  // Each measurement gets the picture in the form it needs, and the forms are
  // not interchangeable: colours must not be blended, sharpness must not be
  // resampled, and period and direction are the only two that a careful
  // box-sample leaves alone.
  const pal = palette(field, o.colours || 5);
  return {
    palette: pal,
    coverage: Math.round(coverage(field, pal) * 100) / 100,
    scale: scale(field),
    orientation: orientation(field),
    hardness: hardness(field),
    weight: weight(field, pal),
    axiality: axiality(field),
    size: { width: field.width, height: field.height },
  };
}

module.exports = { all, palette, coverage, scale, orientation, hardness, weight, axiality,
  luminance, shrink, crop, eachPixel, WORK, LEAST_LAG, EVERY };
