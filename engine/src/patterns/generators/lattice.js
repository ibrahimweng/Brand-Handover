/* The identity's own shape, tiled — the pattern that is the logo.

   The other two generators draw a structure and let the mark set its numbers.
   `weave` puts the motif into the sparse pop cells of a cell grid and `zigzag`
   takes the mark's curve character into stripe geometry; in both, what a client
   sees first is the structure. Asked whether the pattern looked like their
   logo, the honest answer was no — the weave is most of the picture and the
   motif is a garnish scattered into it.

   This is the other answer. There is no structure: the pattern is the shape,
   repeated on a lattice, and nothing else is drawn. Isolate the most distinct
   part of the drawing, strip it to one colour, lay it out. A client looking at
   the sheet sees their mark.

   Everything the lattice does is measured off that shape rather than off the
   mark as a whole, because the shape is what is being tiled:

   **How much of its own box does it ink?** Spacing. A solid motif crowds at a
   gap an open one needs — skerry's disc and ancroft's chevron at the same
   spacing are a dense field of dots and an airy sheet of lines. `pattern.js`
   has measured this for every candidate since the mark-tiler was written and
   this reads its answer.

   **How complex is it?** Size. A shape of two moves reads at a sixth of the
   tile; one of twenty-four needs a quarter or it turns to grit.

   **Is it symmetric?** Whether mirroring alternate rows does anything. A shape
   that is its own mirror gains nothing from being flipped and the sheet just
   looks like it was not flipped, which is a control that lies.

   **Does it run one way?** Whether the rows drop. A directional shape laid on a
   plain grid lines its own strokes up into stripes across the whole sheet,
   which is the mark's grain becoming a pattern nobody drew.

   The effects on top — rounding, extrusion, glitch, jitter — all default to
   off. They are the client's to reach for, not the engine's to apply: a pattern
   that arrives already distressed is a decision made on somebody's behalf about
   their own logo. The defaults draw the shape as it was drawn. */
//
// UMD: `paint` runs in the studio, which has no require.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../rand'), require('../motif'));
  } else root.PatternLattice = factory(root.PatternRand, root.PatternMotif);
}(typeof self !== 'undefined' ? self : this, function (RAND, MOTIF) {
  'use strict';

  const R3 = (v) => Math.round(v * 1000) / 1000;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // Mixing two hexes, for the sides of an extrusion and for a quiet ground.
  // Local because it is three lines and reaching for a colour module would put
  // Node's colour science in a file the browser loads.
  function mix(a, b, t) {
    const A = parseInt(String(a).slice(1), 16), B = parseInt(String(b).slice(1), 16);
    const f = (sh) => Math.round(((A >> sh) & 255) * (1 - t) + ((B >> sh) & 255) * t);
    return `#${[16, 8, 0].map((sh) => f(sh).toString(16).padStart(2, '0')).join('')}`;
  }

  // ------------------------------------------------------------ the lattice

  // How many motifs fit across, and the step that makes them close.
  //
  // A lattice only tiles if the tile is a whole number of steps: a step chosen
  // for looks alone leaves a half-column at the edge, and every sheet made from
  // the tile carries a seam down it. So the wanted step is rounded to the
  // nearest count that divides the tile exactly, and the count is forced even
  // when the rows drop — a half-drop over an odd number of rows puts two
  // undropped rows against each other at the join.
  function steps(W, H, p, ratio) {
    const boxW = W * p.scale * Math.min(1, ratio || 1);
    const boxH = W * p.scale * Math.min(1, 1 / (ratio || 1));
    let cols = Math.max(1, Math.round(W / (boxW * (1 + p.gap))));
    let rows = Math.max(1, Math.round(H / (boxH * (1 + p.gap))));
    if (p.drop > 0.001 && rows % 2) rows += 1;
    return { cols, rows, stepX: W / cols, stepY: H / rows, boxW, boxH };
  }

  // ------------------------------------------------------------- the effects

  // Corner rounding, applied to the motif's own moves.
  //
  // Only where two straight runs meet: a curve is already round and a shape
  // drawn with curves is unchanged by this, which is why a mark that turns on
  // arcs looks the same at every setting and a mark drawn with corners is the
  // one that moves. That asymmetry is the drawing's, not a fault here.
  function round(ops, amount) {
    if (!(amount > 0)) return ops;
    const out = [];
    for (let i = 0; i < ops.length; i++) {
      const o = ops[i], prev = ops[i - 1], next = ops[i + 1];
      if (o[0] !== 'L' || !prev || !next || next[0] !== 'L') { out.push(o); continue; }
      const from = prev[0] === 'C' ? [prev[5], prev[6]] : [prev[1], prev[2]];
      const here = [o[1], o[2]], to = [next[1], next[2]];
      const a = [from[0] - here[0], from[1] - here[1]], b = [to[0] - here[0], to[1] - here[1]];
      const la = Math.hypot(a[0], a[1]), lb = Math.hypot(b[0], b[1]);
      if (la < 1e-6 || lb < 1e-6) { out.push(o); continue; }
      // Never more than a third of the shorter arm: past that the rounding eats
      // the next corner and the shape stops being the shape.
      const r = Math.min(la, lb) * clamp(amount, 0, 1) / 3;
      const p1 = [here[0] + (a[0] / la) * r, here[1] + (a[1] / la) * r];
      const p2 = [here[0] + (b[0] / lb) * r, here[1] + (b[1] / lb) * r];
      out.push(['L', p1[0], p1[1]]);
      out.push(['C', here[0], here[1], here[0], here[1], p2[0], p2[1]]);
    }
    return out;
  }

  // One motif, with whatever is being done to it.
  function one(s, m, cx, cy, r, p, pal, ink) {
    const depth = p.extrude * r * 0.9;
    if (depth > 0.001) {
      const a = (p.extrudeAngle || 45) * Math.PI / 180;
      const dx = Math.cos(a) * depth, dy = Math.sin(a) * depth;
      // Back to front, each step a little further from the face's colour, so
      // the side reads as a side rather than as a second motif behind the
      // first. Enough steps that the side is solid at the depths the slider
      // reaches and few enough that a tile stays a few kilobytes.
      const steps = Math.max(2, Math.round(depth / (r * 0.06)));
      for (let i = steps; i >= 1; i--) {
        const t = i / steps;
        s.fillStyle = s.strokeStyle = mix(ink, pal.ground, 0.55 * t);
        MOTIF.draw(s, m, cx + dx * t, cy + dy * t, r);
      }
    }
    s.fillStyle = s.strokeStyle = ink;
    MOTIF.draw(s, m, cx, cy, r);
  }

  // A motif cut into bands and shoved sideways.
  //
  // Clipped rather than re-pathed: the motif is a list of moves and slicing a
  // path geometrically would need a boolean library the studio cannot carry.
  // A clip is in the surface contract and does the same thing to the picture.
  function glitched(s, m, cx, cy, r, p, pal, ink, at) {
    const bands = 7;
    const h = (r * 2) / bands;
    for (let i = 0; i < bands; i++) {
      // Per band, and keyed on the band: one draw for the whole motif shoves
      // every band by the same amount, which is a motif moved sideways and not
      // a glitch at all.
      const shove = (at(i) * 2 - 1) * p.glitch * r * 0.8;
      s.save();
      s.beginPath();
      s.rect(cx - r * 1.6, cy - r + i * h, r * 3.2, h);
      s.clip();
      one(s, m, cx + shove, cy, r, p, pal, ink);
      s.restore();
    }
  }

  // ---------------------------------------------------------------- painting

  function paint(surface, W, H, p, pal) {
    const m = p.motif;
    const quiet = p.intensity === 'quiet';
    const ground = pal.ground;
    surface.fillStyle = ground;
    surface.fillRect(0, 0, W, H);
    if (!m || !m.ops || !m.ops.length) return;

    // The ink, and the one place Method A's guardrail lives.
    //
    // Quiet is tone-on-tone: the ground moved a little way toward the ink, not
    // the ink at low opacity. Opacity over a ground is the same colour and
    // costs an alpha channel every print house then asks about; a mixed hex is
    // a flat colour that separates.
    const full = pal.inks[0].hex;
    const ink = quiet ? mix(ground, full, 0.14) : full;

    const shape = Object.assign({}, m, { ops: round(m.ops, p.radius) });
    const { cols, rows, stepX, stepY, boxW, boxH } = steps(W, H, p, m.ratio);
    const r = Math.max(boxW, boxH) / 2;
    surface.save();
    surface.beginPath();
    surface.rect(0, 0, W, H);
    surface.clip();
    // One column and one row past each edge, so a motif straddling the join is
    // drawn on both sides of it rather than appearing out of nothing.
    for (let j = -1; j <= rows; j++) {
      for (let i = -1; i <= cols; i++) {
        const odd = ((j % 2) + 2) % 2 === 1;
        const cx = (i + 0.5) * stepX + (odd ? stepX * p.drop : 0);
        const cy = (j + 0.5) * stepY;
        // Seeded off the cell's own coordinates rather than drawn from a
        // running stream: the loop runs over a margin that changes with the
        // tile size, and a stream would hand the same cell different numbers
        // at different sizes — the tile would stop being reproducible.
        const j1 = RAND.hash01(i, j, (p.seed || 1) * 7 + 1);
        const j2 = RAND.hash01(i, j, (p.seed || 1) * 7 + 2);
        const j3 = RAND.hash01(i, j, (p.seed || 1) * 7 + 3);
        const ox = (j1 * 2 - 1) * p.jitter * stepX * 0.35;
        const oy = (j2 * 2 - 1) * p.jitter * stepY * 0.35;
        const scl = 1 + (j3 * 2 - 1) * p.jitter * 0.35;
        const mirror = (p.flip === 'rows' && odd) || (p.flip === 'columns' && ((i % 2) + 2) % 2 === 1)
          || (p.flip === 'both' && (odd !== (((i % 2) + 2) % 2 === 1)));
        surface.save();
        surface.translate(R3(cx + ox), R3(cy + oy));
        if (p.turn) surface.rotate((p.turn * Math.PI) / 180);
        if (mirror) surface.scale(-1, 1);
        if (p.glitch > 0.001) {
          glitched(surface, shape, 0, 0, R3(r * scl), p, pal, ink,
            (band) => RAND.hash01(i * 31 + band, j * 17 + band * 5, (p.seed || 1) * 13 + band));
        } else {
          one(surface, shape, 0, 0, R3(r * scl), p, pal, ink);
        }
        surface.restore();
      }
    }
    surface.restore();
  }

  const controls = [
    { group: 'lattice', key: 'scale', label: 'Motif size', type: 'range', min: 0.05, max: 0.45, step: 0.005 },
    { group: 'lattice', key: 'gap', label: 'Spacing', type: 'range', min: 0.02, max: 2.5, step: 0.02 },
    { group: 'lattice', key: 'drop', label: 'Row drop', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'lattice', key: 'turn', label: 'Rotation', type: 'range', min: 0, max: 180, step: 1 },
    { group: 'lattice', key: 'flip', label: 'Mirror', type: 'chips', options: ['none', 'rows', 'columns', 'both'],
      needs: { of: 'motif', key: 'mirrorable', least: 1,
        without: 'This shape is the wordmark. A word mirrored reads as a mistake, not a pattern.' } },
    // Rounding takes the joins where two straight runs meet, and a shape drawn
    // in curves has none of those — two thirds of the drawings here. So the
    // control says what it can reach rather than sitting there doing nothing:
    // `needs` is read by both studios, which disable it and print the sentence.
    { group: 'effect', key: 'radius', label: 'Corner radius', type: 'range', min: 0, max: 1, step: 0.01,
      needs: { of: 'motif', key: 'corners', least: 1,
        without: 'This shape is drawn in curves. It has no corners to round.' } },
    { group: 'effect', key: 'extrude', label: '3D extrusion', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'effect', key: 'extrudeAngle', label: 'Extrusion angle', type: 'range', min: 0, max: 360, step: 5 },
    { group: 'effect', key: 'glitch', label: 'Glitch', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'effect', key: 'jitter', label: 'Jitter', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'effect', key: 'intensity', label: 'Intensity', type: 'chips', options: ['bold', 'quiet'] },
    // Seeded, and in the effects group rather than the lattice one: the
    // lattice is rigid and the seed changes nothing in it. It is what jitter
    // and glitch draw their numbers from, so it belongs beside them — and
    // grouped last, because a heading that opens twice reads as a mistake.
    { group: 'effect', key: 'seed', label: 'Seed', type: 'seed' },
  ];

  // What the tile is made of, for the seam check and the manual.
  function plan(W, H, p, ratio) {
    const s = steps(W, H, p, ratio);
    return { cols: s.cols, rows: s.rows, motifs: s.cols * s.rows };
  }

  return { key: 'lattice', vector: true, motif: true, needsMotif: true,
    variants: ['bold', 'quiet'], controls, paint, plan, steps, round, mix };
}));
