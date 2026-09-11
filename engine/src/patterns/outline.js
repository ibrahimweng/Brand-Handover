/* The drawing's outline, as segments — and what its turning says.

   Two callers wanted the same walk over an SVG and neither wanted the other's
   dependencies. `motif-read.js` needs the segments to hand a generator the
   mark's own shape; `mark.js` needs them to measure how the drawing turns. The
   walk lives here so there is one of it.

   Everything is reduced to move, line and cubic through `paths.js`, which is
   the same reduction the print path already makes and the only three things
   every drawing system agrees on.

   The measurement is the second half. `curviness` used to count path command
   letters: a <circle> scored four curves whatever its radius, a rounded
   rectangle scored four curves and four lines whether its corners were a hair
   or a half-stem, and yamabiko — a drawing of mountain chevrons with no curve
   anywhere in it — scored 0.50. What a stripe generator needs is not a count of
   letters. It is a *radius*, and whether the drawing turns on a curve or at a
   corner. Both are in the geometry and neither is in the command letters. */
'use strict';
const svg = require('../svg');
const paths = require('../paths');

// A primitive as the cubics it is. Everything a drawing can contain that is not
// a path, written as one — so the generator has a single case to draw.
//
// The circle is four cubics at the usual 0.5522847 of the radius, which is the
// approximation every drawing program uses and is within a thousandth of the
// true arc. An exact circle is not available: a cubic cannot be one.
const K = 0.5522847498307933;
function segsOf(el) {
  const t = String(el.tagName || '').toLowerCase();
  const n = (a, d) => { const v = parseFloat(el.getAttribute(a)); return Number.isFinite(v) ? v : (d || 0); };
  if (t === 'path') return paths.parse(el.getAttribute('d') || '');
  if (t === 'rect') {
    const x = n('x'), y = n('y'), w = n('width'), h = n('height');
    if (!(w > 0 && h > 0)) return [];
    return [{ op: 'move', to: [x, y] }, { op: 'line', to: [x + w, y] },
      { op: 'line', to: [x + w, y + h] }, { op: 'line', to: [x, y + h] }, { op: 'close' }];
  }
  if (t === 'circle' || t === 'ellipse') {
    const cx = n('cx'), cy = n('cy');
    const rx = t === 'circle' ? n('r') : n('rx'), ry = t === 'circle' ? n('r') : n('ry');
    if (!(rx > 0 && ry > 0)) return [];
    const ox = rx * K, oy = ry * K;
    return [
      { op: 'move', to: [cx + rx, cy] },
      { op: 'cubic', c1: [cx + rx, cy + oy], c2: [cx + ox, cy + ry], to: [cx, cy + ry] },
      { op: 'cubic', c1: [cx - ox, cy + ry], c2: [cx - rx, cy + oy], to: [cx - rx, cy] },
      { op: 'cubic', c1: [cx - rx, cy - oy], c2: [cx - ox, cy - ry], to: [cx, cy - ry] },
      { op: 'cubic', c1: [cx + ox, cy - ry], c2: [cx + rx, cy - oy], to: [cx + rx, cy] },
      { op: 'close' }];
  }
  if (t === 'polygon' || t === 'polyline' || t === 'line') {
    const pts = t === 'line'
      ? [[n('x1'), n('y1')], [n('x2'), n('y2')]]
      : (el.getAttribute('points') || '').trim().split(/[\s,]+/).map(Number)
        .reduce((a, v, i) => (i % 2 ? (a[a.length - 1].push(v), a) : (a.push([v]), a)), [])
        .filter((p) => p.length === 2 && p.every(Number.isFinite));
    if (pts.length < 2) return [];
    const out = [{ op: 'move', to: pts[0] }];
    for (let i = 1; i < pts.length; i++) out.push({ op: 'line', to: pts[i] });
    if (t === 'polygon') out.push({ op: 'close' });
    return out;
  }
  return [];
}

// The transform an element sits under, multiplied down from the root. An
// element's own transform is applied last, which is the order SVG uses and the
// order getting it wrong puts a mark in the next county.
function ctmOf(el) {
  const chain = [];
  for (let n = el; n && n.nodeType === 1; n = n.parentNode) chain.unshift(n.getAttribute('transform') || '');
  let m = paths.IDENTITY;
  for (const t of chain) if (t) m = paths.multiply(m, paths.parseTransform(t));
  return m;
}

// A shape's markup, as moves in its own coordinates.
//
// Handed a fragment — one shape lifted out of a drawing — or a whole document.
// `motif-read` passes the first and `mark.js` the second, and wrapping a whole
// document in another <svg> puts its xml declaration in the middle of the new
// one, which is a parse error rather than a warning. The earlier version only
// ever saw fragments and sources the project loader had already stripped, so it
// worked for every fixture and would have failed on the first raw file.
function movesOf(markup) {
  const text = String(markup).replace(/^\uFEFF/, '').trim();
  // Whether it is a document is whether it has an <svg> root, not whether the
  // prolog matches a shape I guessed at: the first version tried to match an
  // optional xml declaration and doctype, and yamabiko puts a comment between
  // the two. A fragment lifted out of a drawing is a shape or a group and has
  // no <svg> in it at all.
  const whole = /<svg[\s>]/i.test(text);
  const doc = svg.parse(whole ? text : `<svg xmlns="http://www.w3.org/2000/svg">${text}</svg>`);
  const all = [];
  svg.eachPainted(doc, (el) => {
    const segs = segsOf(el);
    if (!segs.length) return;
    all.push(...paths.transformSegs(segs, ctmOf(el)));
  });
  return all;
}

// Every turn in the outline, as { radius, turn } — radius 0 for a hard corner,
// `turn` the angle swept there in radians.
//
// A cubic's radius is its arc length over its total turning, both by sampling:
// a curve that travels 30 units while turning a quarter circle has a radius of
// about 19. A junction between two segments contributes the angle between them
// at radius zero. Together they are every place the drawing changes direction
// and how sharply it does it.
const SUB = 24;
const cubicAt = (p0, c1, c2, p3, t) => {
  const u = 1 - t;
  return [u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p3[1]];
};
const ang = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
const wrap = (a) => { let v = a; while (v > Math.PI) v -= 2 * Math.PI; while (v < -Math.PI) v += 2 * Math.PI; return v; };

function turns(segs) {
  const out = [];
  let cur = null, first = null, lastDir = null;
  const corner = (dir) => {
    if (lastDir !== null) {
      const t = Math.abs(wrap(dir - lastDir));
      if (t > 1e-4) out.push({ radius: 0, turn: t });
    }
    lastDir = dir;
  };
  for (const s of segs) {
    if (s.op === 'move') { cur = s.to; first = s.to; lastDir = null; continue; }
    if (s.op === 'close') { cur = first; continue; }
    if (s.op === 'line') {
      if (!cur) { cur = s.to; continue; }
      corner(ang(cur, s.to)); cur = s.to; continue;
    }
    if (s.op === 'cubic' && cur) {
      let len = 0, turn = 0, prev = cur, prevDir = null, entry = null;
      for (let i = 1; i <= SUB; i++) {
        const p = cubicAt(cur, s.c1, s.c2, s.to, i / SUB);
        const d = ang(prev, p);
        len += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
        if (prevDir !== null) turn += Math.abs(wrap(d - prevDir)); else entry = d;
        prevDir = d; prev = p;
      }
      if (entry !== null) corner(entry);
      if (turn > 1e-4 && len > 0) out.push({ radius: len / turn, turn });
      lastDir = prevDir; cur = s.to;
    }
  }
  return out;
}

// How this drawing turns: on a curve or at a corner, and at what radius.
//
//   round   the share of its turning done on a curve rather than at a corner
//   turn    the radius most of that turning happens at, in stems
//
// The radius is a *median* weighted by turning, not a mean. pagrin turns 91% of
// its total at hard corners and averaged 31.7 stems, because the remaining 9%
// happens on two enormous sweeps and a mean is whatever its outliers say.
//
// A drawing whose strokes never meet has no turning to measure at all — deben
// is three straight bars that do not touch. The answer there is not "no hard
// corners were found, so it must be round": it is that the drawing says nothing
// about its corners, and a drawing that says nothing gets corners.
function character(segs, stem) {
  const t = turns(segs);
  const total = t.reduce((a, x) => a + x.turn, 0);
  if (!total) return { round: 0, turn: 0, found: false };
  const sorted = t.slice().sort((a, b) => a.radius - b.radius);
  let run = 0, med = 0;
  for (const x of sorted) { run += x.turn; if (run >= total / 2) { med = x.radius; break; } }
  const hard = t.filter((x) => x.radius < stem * 0.08).reduce((a, x) => a + x.turn, 0);
  return { round: 1 - hard / total, turn: stem > 0 ? med / stem : 0, found: true };
}

module.exports = { segsOf, ctmOf, movesOf, turns, character };
