/* Reading the identity's own shape out of its artwork.

   Node's half of `motif.js`: it needs an XML parser and a path parser, neither
   of which belongs in a file the studio loads. It runs once, at build time, and
   what comes out is the list of moves `motif.draw` replays.

   Which shape? The same one the mark-tiler already picks. `pattern.js` reads
   every shape in the drawing and ranks them by how well each carries a repeat —
   how compact it is, how simple, how much of its own box it inks — and that
   ranking was built for exactly this question. Asking it twice, two different
   ways, would give a client two different answers about their own logo. */
'use strict';
const svg = require('../svg');
const paths = require('../paths');
const pat = require('../pattern');

const outline = require('./outline');
const { movesOf } = outline;

// Segments to the flat op list `motif.draw` replays, normalised into a unit box
// centred on the origin.
//
// Centred on the *ink*, not on the artboard. A mark drawn in the corner of a
// 1000-unit canvas — which is most marks that come out of Illustrator — would
// otherwise be placed by its empty space, and every cell of the pattern would
// have the motif hanging off one side.
function normalise(segs) {
  const b = paths.bboxOf(segs);
  if (!b) return { ops: [], ratio: 0 };
  const w = b.w, h = b.h;
  const k = 1 / Math.max(w, h, 1e-9);
  const cx = b.x + w / 2, cy = b.y + h / 2;
  const X = (v) => +((v - cx) * k).toFixed(5);
  const Y = (v) => +((v - cy) * k).toFixed(5);
  const ops = [];
  for (const s of segs) {
    if (s.op === 'move') ops.push(['M', X(s.to[0]), Y(s.to[1])]);
    else if (s.op === 'line') ops.push(['L', X(s.to[0]), Y(s.to[1])]);
    else if (s.op === 'cubic') ops.push(['C', X(s.c1[0]), Y(s.c1[1]), X(s.c2[0]), Y(s.c2[1]), X(s.to[0]), Y(s.to[1])]);
    else if (s.op === 'close') ops.push(['Z']);
  }
  return { ops, ratio: +(w / Math.max(h, 1e-9)).toFixed(3) };
}

// ------------------------------------------------ what the shape is like

/* Two questions a lattice has and nothing else asked.

   `mark.js` measures the drawing as a whole; `pattern.js` scores every
   candidate for how well it carries a repeat. Neither answers whether the
   *chosen shape* is its own mirror, or whether it runs one way — and a lattice
   needs both: mirroring a symmetric shape is a control that does nothing, and
   laying a directional shape on a plain grid runs its strokes into stripes
   across the whole sheet.

   Both are measured off the normalised moves, so they describe the thing that
   is actually tiled rather than the artwork it was cut from. */

// The outline as points. Curves are walked, not sampled at their ends: a
// circle is four cubics and its four endpoints are a diamond.
function pointsOf(ops, per) {
  const N = per || 12, out = [];
  let cur = null, start = null;
  const line = (to) => {
    for (let i = 1; i <= N; i++) {
      out.push([cur[0] + (to[0] - cur[0]) * (i / N), cur[1] + (to[1] - cur[1]) * (i / N)]);
    }
    cur = to;
  };
  for (const o of ops) {
    if (o[0] === 'M') { cur = [o[1], o[2]]; start = cur; out.push(cur); }
    else if (o[0] === 'L') line([o[1], o[2]]);
    else if (o[0] === 'C') {
      const a = cur, b = [o[1], o[2]], c = [o[3], o[4]], d = [o[5], o[6]];
      for (let i = 1; i <= N; i++) {
        const t = i / N, u = 1 - t;
        out.push([u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
          u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]]);
      }
      cur = d;
    } else if (o[0] === 'Z' && start) line(start);
  }
  return out;
}

// An occupancy grid, so symmetry is a picture compared with its mirror rather
// than a point set matched point to point. Two drawings of the same shape with
// different numbers of nodes compare equal, which is the point.
const GRID = 24;
function cellsOf(pts) {
  const g = new Uint8Array(GRID * GRID);
  for (const [x, y] of pts) {
    const i = Math.min(GRID - 1, Math.max(0, Math.floor((x + 0.5) * GRID)));
    const j = Math.min(GRID - 1, Math.max(0, Math.floor((y + 0.5) * GRID)));
    g[j * GRID + i] = 1;
  }
  return g;
}
function overlap(a, b) {
  let both = 0, either = 0;
  for (let i = 0; i < a.length; i++) { if (a[i] && b[i]) both++; if (a[i] || b[i]) either++; }
  return either ? both / either : 1;
}
function flipX(g) {
  const o = new Uint8Array(g.length);
  for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) o[j * GRID + i] = g[j * GRID + (GRID - 1 - i)];
  return o;
}

// Which way the outline runs, and how much it agrees with itself about it.
// The angle is doubled before it is summed, so a line at 10 degrees and one at
// 190 reinforce rather than cancel: a direction, not a heading.
function grainOf(pts) {
  let sx = 0, sy = 0, total = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1];
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) continue;
    const a2 = 2 * Math.atan2(dy, dx);
    sx += len * Math.cos(a2); sy += len * Math.sin(a2); total += len;
  }
  if (!total) return { grain: 0, angle: 0 };
  let ang = (Math.atan2(sy, sx) / 2) * 180 / Math.PI;
  if (ang < 0) ang += 180;
  if (ang >= 180) ang -= 180;
  return { grain: +(Math.hypot(sx, sy) / total).toFixed(3), angle: +ang.toFixed(1) };
}

// How many joins a corner rounding could take: two straight runs meeting.
//
// A curve is already round, so a shape drawn in curves has none — and
// twenty-one of the thirty-three drawings in this repository are drawn that
// way. Counted and carried rather than discovered by a client moving a slider
// that does nothing, which is the kind of control this engine exists not to
// ship.
function cornersIn(ops) {
  let n = 0;
  for (let i = 0; i < ops.length; i++) {
    const o = ops[i], prev = ops[i - 1], next = ops[i + 1];
    if (o[0] === 'L' && prev && next && next[0] === 'L') n++;
  }
  return n;
}

function character(ops) {
  const corners = cornersIn(ops);
  const pts = pointsOf(ops);
  if (pts.length < 2) return { symmetry: 1, grain: 0, angle: 0, corners };
  const g = cellsOf(pts);
  return Object.assign({ symmetry: +overlap(g, flipX(g)).toFixed(3), corners }, grainOf(pts));
}

// The motif this identity's artwork offers, and the others it could have.
//
// `which` names one of the ranked candidates by key; without it the ranking
// decides, which is the same shape the mark-tiler would have used.
function read(markSource, rules, measured, which, opts) {
  // `spec` picks the shape *and* works out the weight it is drawn at, both from
  // the same reading of the artwork. Calling `rank` here and computing a weight
  // separately would be a second opinion about one drawing, and two opinions is
  // how a package comes to show a client two different logos.
  const sp = rules && measured ? pat.spec(markSource, rules, measured) : null;
  const ranked = pat.rank(markSource);
  if (!ranked.length) return { ok: false, why: 'there is nothing in the drawing to repeat' };
  const chosen = (which && ranked.find((c) => c.key === which))
    || (sp && sp.ok && sp.motif) || ranked[0];
  const segs = movesOf(chosen.markup);
  if (!segs.length) return { ok: false, why: `"${chosen.name}" draws nothing this can repeat` };
  const { ops, ratio } = normalise(segs);
  const MOST = require('./motif').MOST;
  if (ops.length > MOST) {
    return { ok: false,
      why: `"${chosen.name}" is ${ops.length} moves and the most a motif may carry is ${MOST}. `
        + 'A motif is redrawn in every cell of every tile, so a shape this detailed would put '
        + 'megabytes in the package and thousands of curves in each cell. Simplify the shape, or '
        + 'pick a simpler part of the drawing — the alternatives are listed beside this one.' };
  }
  return Object.assign({ ok: true, ops, ratio, key: chosen.key, name: chosen.name, nameKey: chosen.nameKey,
    // How much of its own box the shape inks, and how many moves it takes to
    // draw — `pattern.js` measured both to rank the candidates, and the lattice
    // spaces and sizes by them. Read, not recomputed: two readings of one
    // drawing is how a package comes to state two different facts about it.
    // Whether mirroring this shape would reverse lettering.
    //
    // marlow's only asset is a wordmark, and the shape that ranks best out of
    // it is 79% of the drawing — which is the word. Mirrored on alternate rows
    // the sheet reads "Marlow" and "wolraM", and that is not a pattern, it is
    // a mistake somebody pays to reprint. An ornament cut out of a wordmark is
    // a different thing and mirrors happily; the share is what tells them
    // apart, and 0.4 is comfortably clear of every ornament here.
    mirrorable: (opts && opts.lettering && (chosen.share || 0) > 0.4) ? 0 : 1,
    ink: typeof chosen.ink === 'number' ? chosen.ink : 0.3,
    simple: typeof chosen.simple === 'number' ? chosen.simple : 0.4,
    // Filled or stroked, and at what weight — the drawing's answer, carried so
    // the generator never has to ask.
    stroked: !!chosen.stroked,
    weight: sp && sp.strokeRatio ? +sp.strokeRatio.toFixed(4) : 0.06,
    moves: ops.length, why: chosen.why,
    alternatives: ranked.filter((c) => c !== chosen).map((c) => ({ key: c.key, name: c.name, score: c.score })) },
  character(ops));
}

module.exports = { read, movesOf, normalise, character, cornersIn, segsOf: outline.segsOf };
