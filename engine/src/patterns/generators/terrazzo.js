/* The mark, as aggregate.

   Terrazzo is chips of stone thrown into wet cement and ground flat, and the
   thing that makes it look like terrazzo rather than like confetti is the
   *grading*: a real floor has a few large chips, more middling ones, and a
   great many fines, and the small ones sit in the gaps the large ones leave.
   Throw one size and you get spots. Throw a continuous range and you get mush.
   A graded mix is what reads as stone.

   So the placement is graded and ordered by size. The largest chips are laid
   first with as much room between them as the tile allows, then the next grade
   is laid into what is left, then the fines. That is both how a floor is poured
   and the only way to get a scatter that looks deliberate: the small chips have
   somewhere to go, because the big ones were placed before them rather than
   competing with them.

   Three ways to cut a chip, and all three are the client's own drawing:

   `whole` throws the mark in at chip size, turned. This is the literal reading
   and the one most houses use.

   `shard` cuts the drawing along a chord and keeps one side, which is what
   actually happens to a piece of stone — a chip is a broken thing, and a floor
   of unbroken logos reads as a logo floor rather than as a material.

   `mixed` grades between them: the large chips whole, so the mark is legible
   somewhere on the surface, and the small ones broken, because at four
   millimetres nothing is legible anyway and pretending otherwise is what makes
   a brand terrazzo look cheap.

   The cement takes a tint and the fines take the inks, and both are the
   identity's own colours — there is no grey in here that the palette did not
   ask for. */
//
// UMD: `paint` runs in the studio, which has no require.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../rand'), require('../motif'), require('../tone'));
  } else root.PatternTerrazzo = factory(root.PatternRand, root.PatternMotif, root.PatternTone);
}(typeof self !== 'undefined' ? self : this, function (RAND, MOTIF, TONE) {
  'use strict';

  const R3 = (v) => Math.round(v * 1000) / 1000;
  const TAU = Math.PI * 2;
  const CUTS = ['mixed', 'whole', 'shard'];
  // The grades, coarsest first, as a share of the coarse chip's size and a
  // share of the count. A floor is mostly fines by number and mostly coarse by
  // area, which is what these two lists say.
  const GRADES = [[1, 0.16], [0.62, 0.28], [0.36, 0.56]];

  /* Where the chips go: best candidate, with the distance measured round the
     tile so a chip near an edge is not offered the space its wrapped twin is
     already standing in.

     Laid in grade order and against everything already down, which is the whole
     point — a fine placed against the coarse it has to fit between lands in the
     gap, and a fine placed against nothing lands anywhere. */
  function places(p, W, H) {
    const total = Math.max(1, Math.round(p.chips));
    const seed = (p.seed || 1) * 131;
    const out = [];
    const d2 = (ax, ay, bx, by) => {
      const dx = Math.abs(ax - bx), dy = Math.abs(ay - by);
      const x = Math.min(dx, 1 - dx), y = Math.min(dy, 1 - dy);
      return x * x + y * y;
    };
    const spread = Math.max(0, Math.min(1, p.spread));
    // How many tries per chip. More tries means more even; at `spread` zero it
    // is one try, which is a true random throw and looks like one.
    const tries = Math.max(1, Math.round(1 + spread * 15));
    for (let g = 0; g < GRADES.length; g++) {
      const [size, share] = GRADES[g];
      const n = g === GRADES.length - 1
        ? Math.max(0, total - out.length)
        : Math.max(1, Math.round(total * share));
      for (let k = 0; k < n; k++) {
        let bx = 0, by = 0, bestD = -1;
        for (let t = 0; t < tries; t++) {
          const cx = RAND.hash01(out.length, t, seed + 1);
          const cy = RAND.hash01(out.length, t, seed + 2);
          let d = 4;
          for (const o of out) d = Math.min(d, d2(cx, cy, o.x, o.y));
          if (d > bestD) { bestD = d; bx = cx; by = cy; }
        }
        out.push({ x: bx, y: by, grade: g, size,
          turn: RAND.hash01(out.length, 7, seed + 3),
          ink: RAND.hash01(out.length, 11, seed + 4),
          jig: RAND.hash01(out.length, 13, seed + 5) });
      }
    }
    return out;
  }

  /* One chip.

     Cast with body. This is the one place terrazzo departs from the artwork on
     purpose, and it has to: an open stroked drawing inks very little of its own
     box — oriel inks nine per cent of its, yamabiko twelve — and a chip cast at
     that weight is a hairline squiggle. Four of the thirty-three fixtures came
     out covering three per cent of the bed, which is not a sparse floor, it is
     an empty one.

     A chip is a piece of stone and a piece of stone is solid, so a stroked
     drawing is cast at a weight the chip decides rather than the weight the
     drawing was drawn at. `body` is that weight as a share of the chip's width,
     floored at the drawing's own so a slab logo is never thinned. At 1 the
     stroke is a little over half the chip's width, which is solid stone; the
     drawing's counters are what stops it closing up entirely. The same
     argument the mark-tiler makes for its seven per cent floor, at the scale
     this pattern needs: a mark redrawn heavier is still that mark, and a mark
     nobody can see is not.

     The break is a clip rather than an even-odd cut, because a clip works on a
     stroked path as well as a filled one, and because the flat face a clip
     leaves is what a break actually looks like. */
  function chip(s, m, r, broken, turn, body) {
    s.save();
    if (broken) {
      const a = turn * TAU;
      const ox = Math.cos(a) * r * 0.22;
      const oy = Math.sin(a) * r * 0.22;
      const ux = -Math.sin(a) * r * 4;
      const uy = Math.cos(a) * r * 4;
      const nx = -Math.cos(a) * r * 4;
      const ny = -Math.sin(a) * r * 4;
      s.beginPath();
      s.moveTo(R3(ox + ux), R3(oy + uy));
      s.lineTo(R3(ox - ux), R3(oy - uy));
      s.lineTo(R3(ox - ux + nx), R3(oy - uy + ny));
      s.lineTo(R3(ox + ux + nx), R3(oy + uy + ny));
      s.closePath();
      s.clip();
    }
    if (MOTIF.path(s, m, 0, 0, r)) {
      if (m.stroked) {
        const w = r * 2;
        s.lineWidth = Math.max((m.weight || 0.06) * w, body * 0.55 * w);
        s.lineCap = 'round';
        s.lineJoin = 'round';
        s.strokeStyle = s.fillStyle;
        s.stroke();
      } else s.fill('nonzero');
    }
    s.restore();
  }

  function paint(surface, W, H, p, pal) {
    const cut = CUTS.indexOf(p.cut) > -1 ? p.cut : CUTS[0];
    const m = p.motif;
    // The cement. Tinted toward the first ink, because a terrazzo ground is
    // never quite the paper — it is the paper with stone dust in it.
    const cement = p.tint > 0 ? TONE.mix(pal.ground, pal.ink(0), p.tint * 0.22) : pal.ground;
    pal.paper(surface, W, H, cement);
    if (!(m && m.ops && m.ops.length)) return;

    const pts = places(p, W, H);
    // The coarse chip's radius, from how many chips there are rather than from
    // the tile: doubling the count halves the chip, which is what keeps the
    // coverage steady while the grain changes. That is the control a floor
    // actually has.
    const spacing = Math.sqrt((W * H) / Math.max(1, Math.round(p.chips)));
    const coarse = spacing * (0.10 + p.size * 0.45);
    const many = Math.max(1, Math.min(pal.inks.length, Math.round(p.colours)));

    /* Nine passes so a chip that hangs over an edge comes back on the other
       side whole. Drawn at the neighbouring tiles' offsets rather than clipped
       at the boundary: a clip would cut the chip off at the tile's edge and the
       repeat would show a line of half-chips down every join. */
    for (const q of pts) {
      const r = coarse * q.size * (0.78 + q.jig * 0.44);
      const broken = cut === 'shard' || (cut === 'mixed' && q.grade > 0);
      surface.fillStyle = surface.strokeStyle = pal.ink(Math.floor(q.ink * many) % many);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const cx = q.x * W + dx * W;
          const cy = q.y * H + dy * H;
          // Only the passes that can actually land on the tile.
          if (cx < -r || cx > W + r || cy < -r || cy > H + r) continue;
          surface.save();
          surface.translate(R3(cx), R3(cy));
          surface.rotate(q.turn * TAU * p.turn);
          chip(surface, m, r, broken, q.jig, p.body);
          surface.restore();
        }
      }
    }
  }

  const controls = [
    { group: 'pattern', key: 'cut', primary: true, label: 'Cut', type: 'chips', options: CUTS },
    { group: 'pattern', key: 'chips', primary: true, label: 'Chips', type: 'range', min: 8, max: 260, step: 1 },
    { group: 'pattern', key: 'size', primary: true, label: 'Chip size', type: 'range', min: 0.05, max: 1, step: 0.01 },
    { group: 'pattern', key: 'spread', label: 'Evenness', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'pattern', key: 'turn', label: 'Tumble', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'pattern', key: 'body', label: 'Chip body', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'pattern', key: 'colours', label: 'Colours', type: 'range', min: 1, max: 6, step: 1 },
    { group: 'ground', key: 'tint', label: 'Cement', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'pattern', key: 'seed', label: 'Seed', type: 'seed' },
  ];

  return { key: 'terrazzo', kind: 'pattern', vector: true, motif: true, ratio: 1,
    controls, paint, places, chip, CUTS, GRADES };
}));
