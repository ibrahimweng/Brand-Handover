/* The shape a stroke covers, as a shape that can be filled.

   A path is a centreline. Everything in this engine that wants the *region* a
   drawing occupies — a clip, a mask, a counterchange figure, a knockout — needs
   the ink, and filling a centreline gives the area the line travels around
   instead. carrock is three concentric arcs and fills to a solid disc; ancroft
   is an open chevron and fills to a sliver. Twenty-one of the thirty-three
   drawings in this repository are drawn in strokes, so that is two thirds of
   the identities for which "put the logo in it" quietly did something else.

   This offsets the centreline by half the stroke on both sides and closes the
   two sides into one filled region, which is what a renderer does to draw a
   stroke in the first place.

   Round caps and round joins, because those are what `motif.js` strokes with
   (`lineCap` and `lineJoin` are both set there) and the outline has to be the
   shape that is actually drawn rather than a reasonable shape of its own. Round
   is also the only join that needs no special case: a mitre has to be limited
   when the turn is sharp, and a bevel has to decide which side is outer. An arc
   around the corner is correct at every angle.

   Closed runs come back as two rings — the outer offset forward, the inner
   offset backward — so the winding leaves the hole a ring is supposed to have.
   Open runs come back as one ring: up one side, round the end, back the other,
   round the start. */
'use strict';

/* How finely a curve is walked, and how finely a join is turned.

   Measured rather than chosen. The test fills the outline, strokes the original
   and compares the pixels; across the twenty-one stroked drawings here:

       8 / 0.50    worst 0.923   median 0.980   largest 333 ops
      12 / 0.30    worst 0.950   median 0.992   largest 501 ops
      16 / 0.22    worst 0.980   median 0.998   largest 669 ops

   The last of those costs twice the ops of the first and is still small enough
   to sit in brand.json without anybody noticing — 669 ops is a few kilobytes —
   so there was no reason to take the cheaper, looser one. Past it the returns
   flatten and the counts do not. */
const PER_CURVE = 16;
const PER_TURN = 0.22;                // radians per step around a join or a cap
const MOST = 3000;

const dedupe = (pts) => {
  const out = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-7) out.push(p);
  }
  return out;
};

// The ops as runs of points, each flagged with whether it closed.
function runs(ops) {
  const all = [];
  let cur = null, start = null, closed = false;
  const end = () => {
    if (cur && cur.length > 1) all.push({ pts: dedupe(cur), closed });
    cur = null; closed = false;
  };
  for (const o of ops) {
    if (o[0] === 'M') { end(); cur = [[o[1], o[2]]]; start = [o[1], o[2]]; }
    else if (!cur) continue;
    else if (o[0] === 'L') cur.push([o[1], o[2]]);
    else if (o[0] === 'C') {
      const a = cur[cur.length - 1], b = [o[1], o[2]], c = [o[3], o[4]], d = [o[5], o[6]];
      for (let i = 1; i <= PER_CURVE; i++) {
        const t = i / PER_CURVE, u = 1 - t;
        cur.push([u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
          u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]]);
      }
    } else if (o[0] === 'Z' && start) { cur.push([start[0], start[1]]); closed = true; end(); }
  }
  end();
  return all;
}

// An arc of points around a centre, from one angle to another, the short way.
function turn(cx, cy, r, a0, a1, out) {
  let d = a1 - a0;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  const steps = Math.max(1, Math.ceil(Math.abs(d) / PER_TURN));
  for (let i = 1; i <= steps; i++) {
    const a = a0 + (d * i) / steps;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
}

// One side of a run, offset by h, with a round join at every corner.
//
// `h` signed: positive walks the left side, negative the right. Walking the
// points backwards with the same sign gives the other side, which is how the
// two halves of an open run are produced without a second code path.
function side(pts, h, out) {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) continue;
    const nx = (-dy / len) * h, ny = (dx / len) * h;
    out.push([a[0] + nx, a[1] + ny]);
    out.push([b[0] + nx, b[1] + ny]);
    // and round the corner into the next segment
    const c = pts[i + 2];
    if (c) {
      const ex = c[0] - b[0], ey = c[1] - b[1];
      const el = Math.hypot(ex, ey);
      if (el > 1e-9) {
        turn(b[0], b[1], Math.abs(h),
          Math.atan2(ny, nx), Math.atan2((ex / el) * h, (-ey / el) * h), out);
      }
    }
  }
}

const ring = (pts) => {
  const ops = [['M', pts[0][0], pts[0][1]]];
  for (let i = 1; i < pts.length; i++) ops.push(['L', pts[i][0], pts[i][1]]);
  ops.push(['Z']);
  return ops;
};

/* The filled outline of `ops` stroked at `width`, in the same units.

   Returns null rather than something approximate when the drawing is too
   detailed to carry: a shape of thousands of points is a megabyte in
   brand.json and a clip no renderer enjoys, and the caller has a fallback that
   says so out loud. */
function outline(ops, width) {
  const h = width / 2;
  if (!(h > 0) || !ops || !ops.length) return null;
  const out = [];
  for (const run of runs(ops)) {
    const pts = run.pts;
    if (pts.length < 2) {
      // A run that goes nowhere is a dot, and a round cap makes it a disc. Left
      // out, a drawing made of dots comes back empty.
      if (pts.length === 1) {
        const dot = [];
        turn(pts[0][0], pts[0][1], h, 0, Math.PI, dot);
        turn(pts[0][0], pts[0][1], h, Math.PI, Math.PI * 2, dot);
        if (dot.length > 2) out.push(...ring(dot));
      }
      continue;
    }
    if (run.closed) {
      // Two rings, wound opposite ways, so the hole stays a hole.
      const outer = []; side(pts, h, outer);
      const inner = []; side(pts.slice().reverse(), h, inner);
      if (outer.length > 2) out.push(...ring(outer));
      if (inner.length > 2) out.push(...ring(inner));
    } else {
      const loop = [];
      side(pts, h, loop);
      const last = pts[pts.length - 1], prev = pts[pts.length - 2];
      const a = Math.atan2(last[1] - prev[1], last[0] - prev[0]);
      turn(last[0], last[1], h, a + Math.PI / 2, a - Math.PI / 2, loop);
      side(pts.slice().reverse(), h, loop);
      const first = pts[0], second = pts[1];
      const b = Math.atan2(first[1] - second[1], first[0] - second[0]);
      turn(first[0], first[1], h, b + Math.PI / 2, b - Math.PI / 2, loop);
      if (loop.length > 2) out.push(...ring(loop));
    }
    if (out.length > MOST) return null;
  }
  return out.length ? out.map((o) => (o[0] === 'Z' ? o
    : [o[0], +o[1].toFixed(5), +o[2].toFixed(5)])) : null;
}

module.exports = { outline, runs, MOST, PER_CURVE };
