/* The mark, corrupted.

   PLAYGRND's Mosh divides the page into bands of uneven height and deals each
   one a failure mode from a shuffled deck — confetti, mosaic, smear, scan,
   chevron — so a page shows every failure once before it repeats any. The whole
   look rests on two observations about real corrupted data: a broken signal
   *holds a value for a few samples* rather than changing every one, and a dead
   patch is what lets the colour read, so a flat share of every draw falls to
   the darkest ink.

   What is being corrupted here is the client's logo. That is the adaptation and
   it is the obvious one: this tool needs a signal to damage, the identity has
   exactly one signal, and a logo that survives being torn is a logo. The mark's
   bitmap decides the underlying value, each band's failure mode decides what
   happens to it, and at low damage the sheet is a coarse pixel logo while at
   high damage it is the wreckage of one.

   The bands run on a wrapping row for the same reason `sampler`'s do: a band
   edge pinned to the top of the tile is a line across every sheet made from it.
   Everything else is quantised to a column width, which is what makes the
   damage read as data rather than as brushwork. */
//
// UMD: `paint` runs in the studio, which has no require.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../rand'), require('../motif'), require('../grid'));
  } else root.PatternMosh = factory(root.PatternRand, root.PatternMotif, root.PatternGrid);
}(typeof self !== 'undefined' ? self : this, function (RAND, MOTIF, GRID) {
  'use strict';

  const mod = (n, p) => ((n % p) + p) % p;
  const frac = (v) => v - Math.floor(v);
  const KINDS = ['confetti', 'mosaic', 'smear', 'scan', 'chevron'];

  /* The deck, shuffled — not five independent rolls.

     Rolled independently, a six-band page shows the same failure three times
     about as often as it shows four different ones, and the tool stops looking
     like a catalogue of failures. Fisher-Yates on a seeded stream, dealt in
     order, so every failure appears once before any repeats. */
  function deck(n, seed) {
    const d = KINDS.slice();
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(RAND.hash01(i, 0, seed) * (i + 1)) % (i + 1);
      const t = d[i]; d[i] = d[j]; d[j] = t;
    }
    const out = [];
    for (let i = 0; i < n; i++) out.push(d[i % d.length]);
    return out;
  }

  function bandsOf(rows, p) {
    const n = Math.max(1, Math.round(p.bands));
    const seed = (p.seed || 1) * 101;
    const kinds = deck(n, seed + 1);
    const raw = [];
    let total = 0;
    for (let b = 0; b < n; b++) { const h = 0.4 + RAND.hash01(b, 0, seed + 2) * 1.6; raw.push(h); total += h; }
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
      out.push({ from: at, h, kind: kinds[b], bias: Math.floor(RAND.hash01(b, 3, seed + 3) * 997) });
      at += h;
    }
    return { list: out, start: Math.floor(RAND.hash01(0, 0, seed + 4) * rows), span: at || rows };
  }

  function paint(surface, W, H, p, pal) {
    const cols = Math.max(12, Math.round(p.resolution / 2) * 2);
    const rows = Math.max(12, Math.round(cols * (H / W)));
    const B = bandsOf(rows, p);
    const seed = (p.seed || 1) * 101;
    const reps = Math.max(1, Math.round(p.repeat));
    // The palette, in the roles the tool needs: the darkest is the dead patch,
    // the lightest is the flash, and the rest is the working set.
    const sorted = pal.inks.slice().sort((a, b) => a.against - b.against);
    const dark = sorted[sorted.length - 1].hex;
    const flash = sorted[0].hex;
    const spread = Math.max(1, Math.round(pal.inks.length * (0.25 + p.spread * 0.75)));
    const colours = [dark, flash].concat(pal.inks.slice(0, spread).map((k) => k.hex));

    pal.paper(surface, W, H, pal.ground);

    // The signal under the damage.
    const signal = (i, j) => (p.mark > 0
      && MOTIF.inside(p.motif, frac(((i + 0.5) / cols) * reps), frac(((j + 0.5) / rows) * reps), p.spreadMark)
      ? 1 : 0);

    const at = (i, j) => {
      const t = mod(j - B.start, B.span);
      let band = B.list[0];
      for (const b of B.list) if (t >= b.from && t < b.from + b.h) { band = b; break; }
      const k = band.kind;
      let ci = i, cj = j;
      // The failure modes, as a displacement of *where the signal is read* plus
      // a rule about what colour comes back. Reading somewhere else is what
      // damage does; painting over is what a brush does.
      if (k === 'smear') {
        // A dropped frame, dragged sideways: a value held for a long run.
        const run = Math.max(2, Math.round((6 + p.smear * 46)
          * (0.25 + RAND.hash01(0, j, seed + 5) * 1.5)));
        ci = Math.floor(i / run) * run;
      } else if (k === 'confetti') {
        // Short runs, with a rare very long one — real corrupted data holds a
        // value for a few samples and occasionally for hundreds.
        const h = RAND.hash01(Math.floor(i / 6), j, seed + 6);
        const run = h < 0.1 ? Math.max(8, Math.round(h * 2650)) : 2 + Math.floor(h * 5);
        ci = Math.floor(i / run) * run;
      } else if (k === 'mosaic') {
        const step = 4 + Math.floor(RAND.hash01(0, Math.floor(j / 4), seed + 7) * 6);
        ci = Math.floor(i / step) * step; cj = Math.floor(j / step) * step;
      } else if (k === 'scan') {
        ci = 0;
      } else if (k === 'chevron') {
        // The column index offset by a triangle wave of the row, and the colour
        // follows the *shifted column alone*. Biasing by the row as well
        // re-deals every line and turns the zigzag back into noise.
        const period = 3 + Math.floor(RAND.hash01(0, band.from, seed + 8) * 12);
        const amp = 2 + Math.floor(RAND.hash01(1, band.from, seed + 9) * 7);
        const tri = Math.abs(((j % period) / period) * 2 - 1);
        ci = i + Math.round(tri * amp);
      }
      const on = signal(mod(ci, cols), mod(cj, rows));
      const h = RAND.hash01(mod(ci, cols), k === 'chevron' ? 0 : mod(cj, rows), seed + 10 + band.bias);
      // A flat share of every draw is dead, and far more of it outside the
      // signal than inside. Without any of it the page is a wall of colour and
      // none of it reads; without the *difference*, the logo is one more band
      // of noise and the tool is a texture with a brand's palette.
      if (h < (on ? 0.05 : 0.34)) return 0;
      if (k === 'smear' && h > 1 - p.flashes * 0.35) return 1;
      if (k === 'scan' && h > 1 - p.flashes * 0.2) return 1;
      // And the two halves of the working set are kept apart: the signal is
      // drawn from the inks that read best on the ground, the damage around it
      // from the ones that read least. Biasing a single set was too soft a
      // signal to survive five failure modes on top of it.
      const n = colours.length - 2;
      const half = Math.max(1, Math.ceil(n / 2));
      const pick = on ? Math.floor(h * half)
        : half + Math.floor(h * Math.max(1, n - half));
      return 2 + Math.min(n - 1, Math.max(0, pick));
    };
    GRID.cells(surface, W, H, cols, rows, at, colours);
  }

  const controls = [
    { group: 'signal', key: 'bands', label: 'Bands', type: 'range', min: 1, max: 14, step: 1 },
    { group: 'signal', key: 'resolution', label: 'Resolution', type: 'range', min: 24, max: 300, step: 2 },
    { group: 'signal', key: 'spread', label: 'Colour spread', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'damage', key: 'smear', label: 'Smear', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'damage', key: 'flashes', label: 'Flashes', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'mark', key: 'mark', label: 'The signal is the mark', type: 'range', min: 0, max: 1, step: 0.01,
      needs: { of: 'motif', key: 'masked', least: 1,
        without: 'No bitmap could be taken of this shape — it is finer than the grid that '
          + 'reads it. The signal is noise, and the damage is done to that.' } },
    { group: 'mark', key: 'repeat', label: 'Marks across', type: 'range', min: 1, max: 6, step: 1 },
    { group: 'mark', key: 'spreadMark', label: 'Mark size', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'mark', key: 'seed', label: 'Seed', type: 'seed' },
  ];

  return { key: 'mosh', kind: 'texture', vector: true, motif: true, ratio: 1,
    controls, paint, deck, bandsOf, KINDS };
}));
