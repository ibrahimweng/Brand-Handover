/* Randomness that is not random.

   Every number a generator uses comes from here, and the same seed gives the
   same picture on every machine, in every browser, at every size, forever. That
   is not a nicety: this repository builds thirty-two identities byte for byte
   identically, and a pattern that re-deals itself on a rebuild would be the
   first thing in a package nobody could diff.

   `Math.random()` is therefore banned in src/patterns/, and test/run.js checks
   for it rather than trusting anybody to remember.

   Sub-streams matter as much as the seed. A generator that draws one stream for
   everything re-deals the whole composition when a single slider moves, because
   every draw after the changed one shifts along by one. Ask for a named stream
   per subsystem — colours, coverage, placement — and moving the coverage slider
   leaves the colours exactly where they were. That is the difference between a
   control and a shuffle button. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PatternRand = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Mulberry32. Small, fast, and good enough for pictures: it passes gjrand's
  // small-crush and has a period of 2^32, which is a few billion more numbers
  // than any tile needs.
  function mulberry32(a) {
    let t = a >>> 0;
    return function () {
      t = (t + 0x6D2B79F5) >>> 0;
      let x = t;
      x = Math.imul(x ^ (x >>> 15), 1 | x);
      x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  // A named stream off one seed. The name is folded in with Knuth's constant so
  // "colour" and "colours" are as far apart as any two seeds are.
  function fold(seed, name) {
    let h = Math.imul(seed >>> 0, 2654435761) >>> 0;
    const s = String(name == null ? '' : name);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  // rnd() in [0,1); rnd.int(n) in 0..n-1; rnd.range(a,b); rnd.pick(list);
  // rnd.chance(p). Everything a generator asks for, so nobody writes
  // `Math.floor(rnd() * n)` slightly wrong in twelve places.
  function stream(seed, name) {
    const next = mulberry32(fold(seed, name));
    const r = () => next();
    r.int = (n) => Math.floor(next() * n);
    r.range = (a, b) => a + next() * (b - a);
    r.pick = (list) => list[Math.floor(next() * list.length)];
    r.chance = (p) => next() < p;
    // pow(random, k) — most values small, a few large. The distribution behind
    // "most strands are hairlines and a few are heavy".
    r.biased = (k) => Math.pow(next(), k);
    return r;
  }

  // A value in [0,1) for a position, with no state to advance. Two cells that
  // ask about themselves get the same answer whatever order they are drawn in,
  // which is what makes a per-cell decision independent of the walk over the
  // grid — and so what makes run-length merging safe.
  function hash2(x, y, k) {
    let h = Math.imul((x | 0) + 0x9E3779B9, 2246822519) >>> 0;
    h = (h ^ Math.imul((y | 0) + 0x85EBCA6B, 3266489917)) >>> 0;
    h = (h ^ Math.imul((k | 0) + 0xC2B2AE35, 2654435761)) >>> 0;
    h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0;
    h ^= h >>> 13; h = Math.imul(h, 3266489917) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
  }
  const hash01 = (x, y, k) => hash2(x, y, k) / 4294967296;

  return { mulberry32, fold, stream, hash2, hash01 };
}));
