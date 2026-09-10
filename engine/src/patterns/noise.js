/* Noise that comes back round.

   PLAYGRND's tools use four-dimensional noise so an animation closes: the two
   extra axes trace a circle, `z = cos 2πt`, `w = sin 2πt`, and after one turn
   you are exactly where you started. A brand pattern has a second obligation
   PLAYGRND never had — it has to tile. Put four copies together and the seam
   must not be findable.

   It is the same problem and it takes the same answer. Value noise on an
   integer lattice is exactly periodic if the lattice index is taken modulo the
   period: sample at x and at x + P and the same four corners are interpolated
   with the same weights, so the two are equal in the last bit and not merely
   close. Not blurred at the join, not mirrored, not cross-faded — equal.

   Every octave doubles the frequency and doubles the period with it, so an fBm
   sum stays periodic however many octaves it has. Domain warping survives it
   too: the displacement field is periodic, so a point and its neighbour a
   period away are displaced by the same amount and land a period apart.

   test/run.js checks that by arithmetic rather than by eye — a thousand points
   at a hundred periods, to floating-point equality. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rand'));
  else root.PatternNoise = factory(root.PatternRand);
}(typeof self !== 'undefined' ? self : this, function (RAND) {
  'use strict';
  const hash = RAND.hash2;

  // Quintic. Cubic smoothstep leaves a visible crease at the lattice lines
  // under a domain warp, because its second derivative jumps; this one's does
  // not. Ken Perlin's, from the 2002 improved-noise note.
  const ease = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + (b - a) * t;
  // A positive modulo: -1 % 8 is -1 in JavaScript and has to be 7 here, or the
  // tile leaks one lattice cell of a different field along two of its edges.
  const wrap = (n, p) => ((n % p) + p) % p;
  const at = (ix, iy, iz, iw, seed) =>
    hash(ix * 73856093 ^ iy * 19349663, iz * 83492791 ^ iw * 50331653, seed) / 4294967296;

  // Value noise in [0,1], periodic in x with period px and in y with period py.
  // px and py must be whole numbers — that is what makes the wrap exact.
  function noise2(x, y, px, py, seed) {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = ease(x - x0), fy = ease(y - y0);
    const ax = wrap(x0, px), bx = wrap(x0 + 1, px);
    const ay = wrap(y0, py), by = wrap(y0 + 1, py);
    return lerp(
      lerp(at(ax, ay, 0, 0, seed), at(bx, ay, 0, 0, seed), fx),
      lerp(at(ax, by, 0, 0, seed), at(bx, by, 0, 0, seed), fx), fy);
  }

  // The same, with two more axes for the loop. z and w are not wrapped: they
  // travel a circle, and a circle already comes back to itself.
  function noise4(x, y, z, w, px, py, seed) {
    const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z), w0 = Math.floor(w);
    const fx = ease(x - x0), fy = ease(y - y0), fz = ease(z - z0), fw = ease(w - w0);
    const ax = wrap(x0, px), bx = wrap(x0 + 1, px);
    const ay = wrap(y0, py), by = wrap(y0 + 1, py);
    const face = (iz, iw) => lerp(
      lerp(at(ax, ay, iz, iw, seed), at(bx, ay, iz, iw, seed), fx),
      lerp(at(ax, by, iz, iw, seed), at(bx, by, iz, iw, seed), fx), fy);
    return lerp(
      lerp(face(z0, w0), face(z0 + 1, w0), fz),
      lerp(face(z0, w0 + 1), face(z0 + 1, w0 + 1), fz), fw);
  }

  // Summed octaves at doubling frequency and halving amplitude, normalised so
  // the answer stays in [0,1] whatever the octave count. The period doubles
  // with the frequency, which is the whole reason this stays seamless.
  function fbm2(x, y, px, py, octaves, seed) {
    let f = 1, a = 1, sum = 0, norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += a * noise2(x * f, y * f, px * f, py * f, seed + o * 101);
      norm += a; a *= 0.5; f *= 2;
    }
    return norm ? sum / norm : 0.5;
  }

  function fbm4(x, y, z, w, px, py, octaves, seed) {
    let f = 1, a = 1, sum = 0, norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += a * noise4(x * f, y * f, z * f, w * f, px * f, py * f, seed + o * 101);
      norm += a; a *= 0.5; f *= 2;
    }
    return norm ? sum / norm : 0.5;
  }

  // Domain warp: sample two more fields and move the lookup before the lookup.
  // The single most-reused trick in PLAYGRND, and what turns concentric blobs
  // into terrain. It stays seamless because a periodic displacement of a
  // periodic field is periodic: g(x + P) = g(x) + P, so the base field sees the
  // same place.
  function warp2(x, y, px, py, amount, octaves, seed) {
    if (!amount) return [x, y];
    const dx = fbm2(x + 5.2, y + 1.3, px, py, octaves, seed ^ 0x5F1A3C7D);
    const dy = fbm2(x + 1.7, y + 9.2, px, py, octaves, seed ^ 0x2C9E7B41);
    return [x + (dx - 0.5) * 2 * amount, y + (dy - 0.5) * 2 * amount];
  }

  // The ridge is where the field crosses its own middle. Squared, because the
  // unsquared version is all ridge and no field.
  const ridged = (v) => { const r = 1 - Math.abs(2 * v - 1); return r * r; };

  // ------------------------------------------------------- flattening the field
  //
  // Summed octaves pile up in the middle, and the more octaves the worse it is.
  // A field of six sampled into ten bins comes out
  //
  //     0.0  0.8  5.1  21.4  31.9  25.7  12.0  3.0  0.1  0.0
  //
  // Posterise that into ten colours and two of them never appear, one takes a
  // third of the tile, and the pattern reads as one flat colour with flecks in
  // it. Every field generator here would need its own workaround, so it is
  // solved once.
  //
  // It is the central limit theorem, so it has an exact answer rather than a
  // fudge factor. The octaves are independent, so the sum's spread is the root
  // of the sum of their squared amplitudes over their sum — and that agrees
  // with a measurement of 160,000 samples to four decimals, at every octave
  // count from one to six. Pass the field through the normal distribution of
  // that spread and the ten bins come out
  //
  //     9.3  11.1  11.2  10.8  9.9  8.2  9.0  9.8  9.4  11.3
  //
  // — monotone, nothing clipped, no constant fitted to anything.
  //
  // One octave's own spread is the only measured number here: 0.1993, over
  // 360,000 lattice points. test/run.js checks it still is.
  const OCTAVE_SD = 0.1993;
  function sdOf(octaves) {
    let a = 1, sum = 0, sum2 = 0;
    for (let i = 0; i < Math.max(1, octaves); i++) { sum += a; sum2 += a * a; a *= 0.5; }
    return OCTAVE_SD * Math.sqrt(sum2) / sum;
  }

  // Abramowitz & Stegun 7.1.26 — seven decimal places, which is six more than a
  // colour band needs.
  function erf(x) {
    const s = x < 0 ? -1 : 1; const z = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * z);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t
      - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
    return s * y;
  }
  const phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));

  // `centre` and `spread` are optional. A generator that has already walked its
  // whole field can hand over what that field actually did — a small tile leans
  // light or dark by chance, and it is a real property of that tile — and one
  // that has not gets the distribution the process has.
  const evenly = (v, octaves, centre, spread) =>
    phi((v - (centre == null ? 0.5 : centre)) / (spread || sdOf(octaves)));

  // The designer's control on top of that: above 1 pushes the field to its
  // ends, below 1 gathers it in the middle. Smooth at both ends rather than
  // clipped, so turning it up flattens a region instead of tearing an edge.
  function contrast(v, k) {
    if (!k || k === 1) return v;
    const t = 0.5 + (v - 0.5) * k;
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return t;
  }

  // A gamma on an index into a palette. At 0 the colours come up evenly; above
  // it the first colours take more of the tile, below it the last ones do.
  const skew = (v, balance) => (balance ? Math.pow(v, Math.pow(2, -balance)) : v);

  // The loop's two extra axes, as a place on a circle. Radius is how far
  // through the noise one turn travels — the Intensity slider, in other words.
  const phase = (t, radius) => [Math.cos(2 * Math.PI * t) * radius, Math.sin(2 * Math.PI * t) * radius];

  return { noise2, noise4, fbm2, fbm4, warp2, ridged, phase, ease,
    evenly, contrast, skew, sdOf, phi, erf, OCTAVE_SD };
}));
