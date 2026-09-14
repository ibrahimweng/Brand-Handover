/* The mark, written out as a stripe sett.

   The stripe is the oldest brand pattern that is not a monogram and the one
   most houses actually own: Paul Smith's signature stripe, Gucci's web,
   Missoni's, a regimental tie, an awning. It is also the one most often got
   wrong, because a stripe is not "bands of colour repeated" — it is a *sett*,
   a written list of widths and colours that reads the same forwards and
   backwards, and the whole craft is in the list.

   So the list is the tool. Four ways of writing one:

   `sett` mirrors about both ends, the way a tartan's warp does, so the
   sequence has two pivots and reads the same from either selvedge. This is the
   regimental and the awning.

   `signature` does not mirror. It runs a long irregular list of narrow bands
   straight through — dozens of colours, no repeat the eye can hold — which is
   the Paul Smith construction and the reason that stripe reads as hand-chosen
   rather than ruled.

   `web` is the narrow banner: a plain ground with one tight group of bands
   running down it, symmetrical, occupying a fraction of the cloth. Gucci's
   green-red-green, a club ribbon, a racing stripe.

   `ombre` keeps the widths and walks the colour, so the sett shades from one
   ink to the next across its span and back.

   Where the widths come from matters more than any of it. They are the
   identity's own proportions — how much of its box the drawing inks, how heavy
   its stroke runs against its width, how wide it is against how tall, how much
   of its turning happens on a curve — dealt round the sett in order. Two
   identities give two different cloths and the manual can print the arithmetic
   next to the result.

   And the mark can ride in it. `carry` sets the drawing into the widest band at
   the band's own width, repeated down its length, which is how a house stripe
   usually carries a crest: not laid over the stripe but woven into one of its
   bands. */
//
// UMD: `paint` runs in the studio, which has no require.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../motif'), require('../tone'));
  } else root.PatternStripe = factory(root.PatternMotif, root.PatternTone);
}(typeof self !== 'undefined' ? self : this, function (MOTIF, TONE) {
  'use strict';

  const R3 = (v) => Math.round(v * 1000) / 1000;
  const SETTS = ['sett', 'signature', 'web', 'ombre'];

  /* The sett: a list of { width, ink } in thread units.

     Widths come in as four proportions of the drawing. A band is at least one
     thread — a zero-width band is not a band, it is a mistake somebody cannot
     see — and the arithmetic is rounded rather than floored so a narrow
     proportion stays narrow instead of collapsing to the floor with its
     neighbour. */
  function settOf(p) {
    const w = (p.widths && p.widths.length ? p.widths : [0.5, 0.3, 0.7, 0.4]);
    const bands = Math.max(2, Math.round(p.bands));
    const thread = Math.max(1, Math.round(p.thread));
    const half = [];
    for (let i = 0; i < bands; i++) {
      half.push({ width: Math.max(1, Math.round(w[i % w.length] * thread)), ink: i });
    }
    if (p.kind === 'signature') {
      /* No pivot. The list runs straight through and the widths are read at a
         finer grain than the mirrored setts use, because what makes this stripe
         read as chosen rather than ruled is that no two adjacent bands are the
         same width and the eye cannot find the repeat inside one cloth. */
      const long = [];
      for (let i = 0; i < bands * 3; i++) {
        const a = w[i % w.length];
        const b = w[(i * 3 + 1) % w.length];
        long.push({ width: Math.max(1, Math.round((a * 0.65 + b * 0.35) * thread * 0.7)), ink: i });
      }
      return long;
    }
    if (p.kind === 'web') {
      /* A plain ground with one tight symmetrical group in it. The ground band
         is the pivot at each end, so the group sits centred in the repeat
         however wide the ground is made. */
      const ground = Math.max(2, Math.round(thread * 4 * Math.max(0.2, 1 - p.density)));
      const group = half.slice(1);
      return [{ width: ground, ink: -1 }]
        .concat(group)
        .concat(group.slice(0, -1).reverse().map((b) => ({ width: b.width, ink: b.ink })));
    }
    // Mirrored about both ends, which is what a sett is: the first and last
    // bands are the pivots and are not doubled, or the cloth grows a fat band
    // at every join.
    return half.concat(half.slice(1, -1).reverse().map((b) => ({ width: b.width, ink: b.ink })));
  }

  // The sett laid end to end across the span, in thread units, with the
  // repeat count multiplied in. Returns absolute edges so a band is drawn as
  // one rect rather than accumulated — accumulated edges drift and the drift
  // shows as a hairline at the far selvedge.
  function edges(sett, span, repeats) {
    const unit = sett.reduce((a, b) => a + b.width, 0);
    const total = unit * Math.max(1, Math.round(repeats));
    const out = [];
    let at = 0;
    for (let r = 0; r < Math.max(1, Math.round(repeats)); r++) {
      for (const b of sett) {
        out.push({ a: (at / total) * span, b: ((at + b.width) / total) * span, ink: b.ink });
        at += b.width;
      }
    }
    return out;
  }

  /* The colours a band can be — and the ground is one of them.

     This is not a detail. An identity is allowed to ship a single ink, and
     several do; stepping `pal.ink(i)` over one ink paints every band the same
     colour and the cloth comes out a solid rectangle. hallward did exactly
     that. A two-colour stripe is ground and ink — that is what an awning is,
     and what a regimental tie mostly is — so the ground leads the list and the
     inks follow it. The count is capped at what the palette can actually
     supply, so asking for six colours from a two-colour identity gives two
     rather than four repeats of the same one. */
  function bandInks(pal, want) {
    const out = [pal.ground];
    for (let i = 0; i < pal.inks.length; i++) out.push(pal.ink(i));
    return out.slice(0, Math.max(2, Math.min(out.length, Math.round(want))));
  }

  /* The colour of a band.

     `-1` is the ground, which the `web` sett uses for its field. Everything
     else steps the list, and `ombre` walks between neighbours by where the band
     sits in the sett rather than stepping — the same list of widths, shaded
     rather than counted. */
  function inkOf(i, n, pal, p, list) {
    if (i < 0) return pal.ground;
    if (p.kind === 'ombre' && list.length > 1) {
      const t = n > 1 ? (i % n) / (n - 1) : 0;
      const f = t * (list.length - 1);
      const k = Math.min(list.length - 2, Math.floor(f));
      return TONE.mix(list[k], list[k + 1], f - k);
    }
    return list[((i % list.length) + list.length) % list.length];
  }

  function paint(surface, W, H, p, pal) {
    const kind = SETTS.indexOf(p.kind) > -1 ? p.kind : SETTS[0];
    const sett = settOf(Object.assign({}, p, { kind }));
    const list = bandInks(pal, p.colours);
    const down = p.angle >= 45 && p.angle < 135;
    // Along the long way of the cloth, so a tall tile gets tall stripes without
    // the caller having to think about it.
    const span = down ? H : W;
    const bands = edges(sett, span, p.repeats);
    pal.paper(surface, W, H, pal.ground);

    /* One path per colour rather than one per band.

       Two rects that share an edge are anti-aliased independently, and where
       both are painted the seam between them shows as a hairline of ground.
       Collecting the bands of one colour into a single path and filling it once
       puts the shared edge inside the path, where there is nothing to seam. */
    const byInk = new Map();
    for (const b of bands) {
      const hex = inkOf(b.ink, sett.length, pal, p, list);
      if (!byInk.has(hex)) byInk.set(hex, []);
      byInk.get(hex).push(b);
    }
    const skew = p.slant * (down ? W : H);
    for (const [hex, list] of byInk) {
      surface.fillStyle = hex;
      surface.beginPath();
      for (const b of list) {
        if (!skew) {
          if (down) surface.rect(0, R3(b.a), W, R3(b.b - b.a));
          else surface.rect(R3(b.a), 0, R3(b.b - b.a), H);
          continue;
        }
        /* A slanted stripe is a parallelogram, and it has to be drawn as one
           rather than rotated: rotating the whole field puts the tile's corners
           outside it. The offset is a whole number of spans at the far edge, so
           the band that leaves the right selvedge is the band that arrives at
           the left and the tile still repeats. */
        if (down) {
          surface.moveTo(0, R3(b.a)); surface.lineTo(W, R3(b.a - skew));
          surface.lineTo(W, R3(b.b - skew)); surface.lineTo(0, R3(b.b)); surface.closePath();
          for (const d of [-span, span]) {
            surface.moveTo(0, R3(b.a + d)); surface.lineTo(W, R3(b.a + d - skew));
            surface.lineTo(W, R3(b.b + d - skew)); surface.lineTo(0, R3(b.b + d)); surface.closePath();
          }
        } else {
          surface.moveTo(R3(b.a), 0); surface.lineTo(R3(b.a - skew), H);
          surface.lineTo(R3(b.b - skew), H); surface.lineTo(R3(b.b), 0); surface.closePath();
          for (const d of [-span, span]) {
            surface.moveTo(R3(b.a + d), 0); surface.lineTo(R3(b.a + d - skew), H);
            surface.lineTo(R3(b.b + d - skew), H); surface.lineTo(R3(b.b + d), 0); surface.closePath();
          }
        }
      }
      surface.fill();
    }

    /* The mark, woven into its band.

       Into the widest band, because that is the only one with room, and at a
       size the band decides rather than a size the control decides — a crest
       that overhangs its own stripe is a crest laid on top of a stripe, which
       is the thing this is not. */
    const m = p.motif;
    if (!(p.carry > 0 && m && m.ops && m.ops.length)) return;
    let widest = bands[0];
    for (const b of bands) if (b.b - b.a > widest.b - widest.a) widest = b;
    const thickness = widest.b - widest.a;
    const r = thickness * 0.5 * 0.72;
    if (r < 1) return;
    const along = down ? W : H;
    const step = Math.max(r * 2.4, along / Math.max(1, Math.round(p.carry * 8)));
    const count = Math.max(1, Math.round(along / step));
    const pitch = along / count;
    // Against the band, so the drawing reads whatever the band is inked.
    const under = inkOf(widest.ink, sett.length, pal, p, list);
    surface.fillStyle = surface.strokeStyle = TONE.lum(under) > 0.5 ? pal.ink(0) : pal.ground;
    for (const b of bands) {
      if (b.b - b.a < thickness - 0.5) continue;
      const mid = (b.a + b.b) / 2;
      for (let i = 0; i < count; i++) {
        const at = (i + 0.5) * pitch;
        const shift = skew ? -skew * (at / along) : 0;
        surface.save();
        if (down) surface.translate(R3(at), R3(mid + shift));
        else surface.translate(R3(mid + shift), R3(at));
        if (down && p.upright) surface.rotate(-Math.PI / 2);
        MOTIF.draw(surface, m, 0, 0, r);
        surface.restore();
      }
    }
  }

  const controls = [
    { group: 'pattern', key: 'kind', label: 'Sett', type: 'chips', options: SETTS },
    { group: 'stripes', key: 'bands', label: 'Bands in the sett', type: 'range', min: 2, max: 9, step: 1 },
    { group: 'stripes', key: 'thread', label: 'Threads per band', type: 'range', min: 2, max: 24, step: 1 },
    { group: 'stripes', key: 'repeats', label: 'Setts across', type: 'range', min: 1, max: 6, step: 1 },
    { group: 'stripes', key: 'density', label: 'Ground', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'stripes', key: 'angle', label: 'Run', type: 'chips', options: [0, 90],
      labels: ['across', 'down'] },
    { group: 'stripes', key: 'slant', label: 'Slant', type: 'range', min: -1, max: 1, step: 0.05 },
    { group: 'stripes', key: 'colours', label: 'Colours', type: 'range', min: 1, max: 6, step: 1 },
    { group: 'mark', key: 'carry', label: 'Carry the mark', type: 'range', min: 0, max: 1, step: 0.01,
      needs: { of: 'motif', key: 'moves', least: 1,
        without: 'No shape could be read out of this drawing, so there is nothing to '
          + 'weave into the band. The sett is still here.' } },
    { group: 'mark', key: 'upright', label: 'Turn it upright', type: 'toggle' },
    { group: 'pattern', key: 'seed', label: 'Seed', type: 'seed' },
  ];

  return { key: 'stripe', kind: 'pattern', vector: true, motif: true, ratio: 1,
    controls, paint, settOf, edges, bandInks, SETTS };
}));
