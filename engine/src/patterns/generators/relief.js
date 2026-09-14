/* The mark, standing out of a field of blocks.

   PLAYGRND's Relief draws a rhombille tiling — every cube is a hexagon cut into
   three rhombi meeting at its centre, on a triangular lattice where alternate
   rows are offset by half a cube. Turn a cube as a whole and its three tones
   turn with it; turn its neighbours differently and the plain tumbling-block
   field breaks into interlocking hooks. That is the whole tool, and it is one
   of the oldest patterns there is.

   What it is here: an isometric field is a *height* field, and a height field
   can be told where to rise. The mark's own bitmap decides. A cube whose centre
   falls inside the drawing stands as a cube; one that falls outside lies flat
   as a hexagon at the mid tone. So the logo comes up out of the blanket in
   relief, made of nothing but the blanket, and at a distance the sheet reads as
   a pattern rather than as a logo on a background.

   That is also the closest thing in this engine to what a designer means by a
   depth map, and it is worth saying where the line is. The relief here is
   drawn, not filtered: nothing is displaced, blurred or lit after the fact,
   because a tile that needed a pixel filter would be a tile that could not be
   an SVG. The three tones of a face are the lighting, and `tone.faces` swings
   the hue as far as it swings the lightness so the shaded face reads as the
   same paint in shadow rather than as dirt.

   Seamless by construction. One repeat unit of cubes is dealt once and the
   whole tile is indexed into it modulo the unit, so there is no join to check:
   the cube at the right edge and the cube at the left edge are the same cube.
   The unit is forced to an even number of rows, because the half-row offset
   flips parity at an odd wrap and that is a seam you can see from across a
   room. */
//
// UMD: `paint` runs in the studio, which has no require.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../rand'), require('../motif'), require('../tone'));
  } else root.PatternRelief = factory(root.PatternRand, root.PatternMotif, root.PatternTone);
}(typeof self !== 'undefined' ? self : this, function (RAND, MOTIF, TONE) {
  'use strict';

  const R3 = (v) => Math.round(v * 1000) / 1000;
  const mod = (n, p) => ((n % p) + p) % p;
  // A regular hexagon is √3 wide for every 1 it is tall from centre to vertex,
  // and its rows step 1.5 of that. So a repeat unit of P columns is square when
  // it is this many rows deep.
  const SQUARE = Math.sqrt(3) / 1.5;

  /* How the lattice lands on the tile.

     The requested cube count is a wish, not a measurement: the tile has to hold
     a whole number of repeat units in both directions or the pattern has a seam
     down it. So the count is rounded to the nearest whole number of units and
     the cube is stretched the couple of percent that makes it land exactly. */
  function lattice(W, H, p) {
    const P = Math.max(2, Math.round(p.unit));
    // Even, always: an odd row count wraps the half-row offset onto itself.
    const Q = Math.max(2, Math.round((P * SQUARE) / 2) * 2);
    const across = Math.max(1, Math.round(p.cubes / P));
    const cols = P * across;
    const down = Math.max(1, Math.round((H / W) * (cols / SQUARE) / Q));
    const rows = Q * down;
    return { P, Q, cols, rows, a: W / (cols * 2), b: H / (rows * 1.5) };
  }

  // One cube's three faces, back to front. The centre is shared by all three,
  // so they meet exactly and no ground shows through the middle.
  function cube(s, cx, cy, a, b, tones, rot) {
    const T = [0, -b], TR = [a, -b / 2], BR = [a, b / 2];
    const B = [0, b], BL = [-a, b / 2], TL = [-a, -b / 2];
    const faces = [[TL, T, TR], [TL, BL, B], [TR, BR, B]];
    for (let f = 0; f < 3; f++) {
      const q = faces[f];
      s.fillStyle = tones[(f + rot) % 3];
      s.beginPath();
      s.moveTo(R3(cx), R3(cy));
      for (const v of q) s.lineTo(R3(cx + v[0]), R3(cy + v[1]));
      s.closePath();
      s.fill();
    }
  }

  /* Three ways the drawing can enter a field of blocks.

     Built all three and put them side by side, because the first one looked
     obvious on paper and was wrong on the page.

       raise   cubes inside the drawing stand; outside it they lie flat, bar
               the few `flats` leaves standing to break the ground up. The mark
               comes up out of the blanket as relief, made of the blanket. This
               is the one that reads: put beside the other two across six
               identities it was the only one where every mark could be found,
               and the field is still unmistakably a field of blocks.

       ink     every cube stands and tumbles alike; the drawing decides which
               paint. Legible on an open mark, and on a dense one the accents
               fill the page and the drawing is lost in them.

       turn    every cube stands. Cubes inside the drawing are all turned the
               same way; cubes outside tumble. On paper this is the cleverest of
               the three — the logo as a patch of agreement in a field of
               disagreement. On the page it is nearly invisible, which is what
               building all three and looking at them was for.

     The first version of `raise` had the ground at the mid tone, which is the
     ground's own colour, so the field came out as a blank wall with a textured
     logo on it: the exact fault this engine exists to fix, in a new place. A
     flat cube takes the lit tone instead and reads as one facet catching the
     light. And an accent only ever lands on a cube that stands — on a flat one
     it is a coloured hexagon on a plain ground, and a page of those is
     sprinkles. */
  const WAYS = ['raise', 'ink', 'turn'];

  function paint(surface, W, H, p, pal) {
    const L = lattice(W, H, p);
    const way = WAYS.indexOf(p.way) > -1 ? p.way : WAYS[0];
    const lead = pal.inks[0].hex;
    // The accents are every other ink the identity has. An identity with one
    // ink gets a field in one paint, which is a field and not a fault.
    const accents = pal.inks.length > 1 ? pal.inks.slice(1).map((i) => i.hex) : [lead];
    const leadFaces = TONE.faces(lead, p.relief);
    const accentFaces = accents.map((h) => TONE.faces(h, p.relief));
    const turns = 1 + Math.round(p.interlock * 2);
    const seed = (p.seed || 1) * 31;

    // The ground is the mid tone of the lead, so a cube that lands on the tile
    // edge has nothing behind it to disagree with.
    pal.paper(surface, W, H, leadFaces[1]);

    // The unit is dealt once. Every cube on the tile reads its own cell out of
    // it, so two cubes a unit apart are identical and the tile has no join.
    const deal = [];
    for (let j = 0; j < L.Q; j++) {
      for (let i = 0; i < L.P; i++) {
        const h1 = RAND.hash01(i, j, seed + 1);
        const h2 = RAND.hash01(i, j, seed + 2);
        const h3 = RAND.hash01(i, j, seed + 3);
        // Where this cube sits inside the unit, with the half-row offset
        // carried, so the mark is sampled where the cube actually is.
        const ux = mod(i + (j & 1 ? 0.5 : 0), L.P) / L.P;
        const uy = mod(j, L.Q) / L.Q;
        // How strongly the drawing speaks here. Under `mark` the cell is dealt
        // as though the drawing said nothing, so the slider fades the logo out
        // of the field rather than switching it off.
        const on = (p.mark > 0 && MOTIF.inside(p.motif, ux, uy, p.spread)) ? (h1 < p.mark) : false;
        const tumble = Math.floor(h2 * turns) % 3;
        // A flat cube is a plain hexagon of one facet. It is what gives the
        // field air — and under `raise` it is the ground the mark stands out
        // of, so there `flats` means the opposite way round: how many cubes
        // stand where the drawing said nothing. At `mark` zero that leaves a
        // light field with a scattering of blocks in it, which is a look and
        // not an empty tile.
        const solid = way === 'raise' ? (!on && h3 >= p.flats) : h3 < p.flats;
        deal.push({ solid,
          // Inside the mark, under `turn`, every cube agrees.
          rot: way === 'turn' && on ? 0 : tumble,
          // And under `ink`, the mark is the lead and the field the accents.
          //
          // Everywhere else an accent lands only on a cube that *stands*. On a
          // flat one it is a coloured hexagon sitting on a plain ground, and a
          // page of those reads as sprinkles rather than as a block field —
          // which is exactly how the first version of this looked.
          ink: way === 'ink'
            ? (on ? -1 : Math.floor(h3 * 997) % accents.length)
            : (!solid && !on && h3 < p.accent ? Math.floor(h2 * 997) % accents.length : -1) });
      }
    }

    for (let j = -1; j <= L.rows; j++) {
      for (let i = -1; i <= L.cols; i++) {
        const c = deal[mod(j, L.Q) * L.P + mod(i, L.P)];
        const cx = (i + (mod(j, 2) ? 0.5 : 0)) * L.a * 2 + L.a;
        const cy = j * L.b * 1.5 + L.b;
        const tones = c.ink >= 0 ? accentFaces[c.ink] : leadFaces;
        // A flat cube takes the *lit* tone rather than the mid one. At the mid
        // tone it is the same colour as the ground and the field comes out as
        // a wall with holes in it; at the lit tone it reads as one facet of a
        // block that happens to face the light, which is what it is.
        if (c.solid) cube(surface, cx, cy, L.a, L.b, [tones[0], tones[0], tones[0]], 0);
        else cube(surface, cx, cy, L.a, L.b, tones, c.rot);
      }
    }
  }

  const controls = [
    { group: 'blocks', key: 'way', primary: true, label: 'The mark is', type: 'chips', options: WAYS },
    { group: 'blocks', key: 'cubes', primary: true, label: 'Cubes across', type: 'range', min: 4, max: 40, step: 1 },
    { group: 'blocks', key: 'unit', label: 'Repeat', type: 'range', min: 2, max: 24, step: 1 },
    { group: 'blocks', key: 'interlock', label: 'Interlock', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'blocks', key: 'flats', label: 'Flats', type: 'range', min: 0, max: 1, step: 0.01 },
    // The one that makes it this identity's. At zero the mask is ignored and
    // the field is the plain tumbling block; at one the drawing decides every
    // cube. It says what it needs, because a mark too thin to raster has no
    // bitmap and this control would otherwise sit there doing nothing.
    { group: 'blocks', key: 'mark', primary: true, label: 'Mark in relief', type: 'range', min: 0, max: 1, step: 0.01,
      needs: { of: 'motif', key: 'masked', least: 1,
        without: 'No bitmap could be taken of this shape — it is finer than the grid '
          + 'that reads it. The blocks are dealt at random instead.' } },
    { group: 'blocks', key: 'spread', label: 'Mark size', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'light', key: 'relief', label: 'Relief', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'light', key: 'accent', label: 'Accent cubes', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'light', key: 'seed', label: 'Seed', type: 'seed' },
  ];

  // What the tile is made of, for the manual.
  const plan = (W, H, p) => {
    const L = lattice(W, H, p);
    return { cols: L.cols, rows: L.rows, unit: `${L.P}×${L.Q}`, cubes: L.cols * L.rows };
  };

  return { key: 'relief', kind: 'pattern', vector: true, motif: true, ratio: 1,
    controls, paint, plan, lattice, WAYS };
}));
