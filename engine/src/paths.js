/* SVG path data, reduced to the three things every drawing system agrees on:
   move, line, cubic.

   This exists because Typst places an SVG as vector but paints it in RGB, and
   an RGB mark sitting on a CMYK page is a mixed-space file that the press
   converts however it likes — which is the uncontrolled conversion the whole
   print path was built to prevent. So for a printed piece the mark is not
   embedded, it is redrawn as Typst curves in declared ink.

   Redrawing means translating. Arcs and quadratics have no equivalent in
   Typst's curve, so they are converted here rather than approximated later,
   and the result is checked against the SVG renderer pixel by pixel. */
'use strict';

const round = (n) => Math.round(n * 1e4) / 1e4;

// ---------------------------------------------------------------- tokenising
const NUM = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi;
const ARGS = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };

function tokens(d) {
  const out = [];
  const re = /([astvzqmhlc])|(-?\d*\.?\d+(?:e[-+]?\d+)?)/gi;
  let m;
  while ((m = re.exec(String(d)))) out.push(m[1] ? m[1] : Number(m[2]));
  return out;
}

// ------------------------------------------------------------------- curves
// A quadratic is a cubic whose controls sit two thirds of the way to the
// single control point. Exact, not an approximation.
function quadToCubic(p0, q, p1) {
  return [
    [p0[0] + (2 / 3) * (q[0] - p0[0]), p0[1] + (2 / 3) * (q[1] - p0[1])],
    [p1[0] + (2 / 3) * (q[0] - p1[0]), p1[1] + (2 / 3) * (q[1] - p1[1])],
    p1,
  ];
}

// An arc is not a cubic and never will be, so it is cut into pieces of at most
// a quarter turn and each piece approximated. The error of that approximation
// is about one part in ten thousand of the radius, which is smaller than the
// rounding already applied to the numbers.
function arcToCubics(p0, rx, ry, rot, large, sweep, p1) {
  let [x1, y1] = p0, [x2, y2] = p1;
  rx = Math.abs(rx); ry = Math.abs(ry);
  if (!rx || !ry || (x1 === x2 && y1 === y2)) return [[[x2, y2], [x2, y2], [x2, y2]]];

  const phi = (rot * Math.PI) / 180;
  const cosP = Math.cos(phi), sinP = Math.sin(phi);
  // the arc in a frame where the ellipse is a circle
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cosP * dx + sinP * dy, y1p = -sinP * dx + cosP * dy;

  // radii too small for the endpoints are scaled up, as the spec requires
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) { const s = Math.sqrt(lam); rx *= s; ry *= s; }

  const sign = large === sweep ? -1 : 1;
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const co = sign * Math.sqrt(Math.max(0, num / den));
  const cxp = (co * rx * y1p) / ry, cyp = (-co * ry * x1p) / rx;
  const cx = cosP * cxp - sinP * cyp + (x1 + x2) / 2;
  const cy = sinP * cxp + cosP * cyp + (y1 + y2) / 2;

  const angle = (ux, uy, vx, vy) => {
    const dot = ux * vx + uy * vy;
    const len = Math.sqrt(ux * ux + uy * uy) * Math.sqrt(vx * vx + vy * vy);
    let a = Math.acos(Math.min(1, Math.max(-1, dot / len)));
    if (ux * vy - uy * vx < 0) a = -a;
    return a;
  };
  const start = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let sweepAngle = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && sweepAngle > 0) sweepAngle -= 2 * Math.PI;
  if (sweep && sweepAngle < 0) sweepAngle += 2 * Math.PI;

  const pieces = Math.max(1, Math.ceil(Math.abs(sweepAngle) / (Math.PI / 2)));
  const step = sweepAngle / pieces;
  const k = (4 / 3) * Math.tan(step / 4);
  const at = (a) => {
    const ca = Math.cos(a), sa = Math.sin(a);
    return [cx + rx * cosP * ca - ry * sinP * sa, cy + rx * sinP * ca + ry * cosP * sa];
  };
  const slope = (a) => {
    const ca = Math.cos(a), sa = Math.sin(a);
    return [-rx * cosP * sa - ry * sinP * ca, -rx * sinP * sa + ry * cosP * ca];
  };

  const out = [];
  for (let i = 0; i < pieces; i++) {
    const a0 = start + i * step, a1 = a0 + step;
    const p = at(a0), q = at(a1), d0 = slope(a0), d1 = slope(a1);
    out.push([[p[0] + k * d0[0], p[1] + k * d0[1]], [q[0] - k * d1[0], q[1] - k * d1[1]], q]);
  }
  return out;
}

// ---------------------------------------------------------------- the parser
// Every command, absolute, reduced to move / line / cubic / close.
function parse(d) {
  const t = tokens(d);
  const out = [];
  let i = 0, cmd = null, cx = 0, cy = 0, sx = 0, sy = 0;
  let lastC = null, lastQ = null;       // for the shorthand curves
  const num = () => t[i++];

  while (i < t.length) {
    if (typeof t[i] === 'string') { cmd = t[i++]; }
    else if (cmd === 'M') cmd = 'L';
    else if (cmd === 'm') cmd = 'l';
    if (!cmd) break;
    const low = cmd.toLowerCase(), rel = cmd === low, n = ARGS[low];
    if (n === undefined) break;
    if (low !== 'z' && t.length - i < n) break;
    const rx0 = rel ? cx : 0, ry0 = rel ? cy : 0;

    if (low === 'z') {
      out.push({ op: 'close' });
      cx = sx; cy = sy; lastC = lastQ = null;
      continue;
    }
    if (low === 'm') {
      const x = num() + rx0, y = num() + ry0;
      out.push({ op: 'move', to: [x, y] });
      cx = sx = x; cy = sy = y; lastC = lastQ = null;
    } else if (low === 'l') {
      const x = num() + rx0, y = num() + ry0;
      out.push({ op: 'line', to: [x, y] }); cx = x; cy = y; lastC = lastQ = null;
    } else if (low === 'h') {
      const x = num() + rx0;
      out.push({ op: 'line', to: [x, cy] }); cx = x; lastC = lastQ = null;
    } else if (low === 'v') {
      const y = num() + ry0;
      out.push({ op: 'line', to: [cx, y] }); cy = y; lastC = lastQ = null;
    } else if (low === 'c' || low === 's') {
      let c1;
      if (low === 'c') c1 = [num() + rx0, num() + ry0];
      // the reflection of the last control point, or the current point when
      // the previous command was not a cubic
      else c1 = lastC ? [2 * cx - lastC[0], 2 * cy - lastC[1]] : [cx, cy];
      const c2 = [num() + rx0, num() + ry0], p = [num() + rx0, num() + ry0];
      out.push({ op: 'cubic', c1, c2, to: p });
      lastC = c2; lastQ = null; cx = p[0]; cy = p[1];
    } else if (low === 'q' || low === 't') {
      let q;
      if (low === 'q') q = [num() + rx0, num() + ry0];
      else q = lastQ ? [2 * cx - lastQ[0], 2 * cy - lastQ[1]] : [cx, cy];
      const p = [num() + rx0, num() + ry0];
      const [c1, c2, to] = quadToCubic([cx, cy], q, p);
      out.push({ op: 'cubic', c1, c2, to });
      lastQ = q; lastC = c2; cx = to[0]; cy = to[1];
    } else if (low === 'a') {
      const rx = num(), ry = num(), rot = num(), large = num(), sweep = num();
      const p = [num() + rx0, num() + ry0];
      for (const [c1, c2, to] of arcToCubics([cx, cy], rx, ry, rot, large, sweep, p)) {
        out.push({ op: 'cubic', c1, c2, to });
      }
      lastC = lastQ = null; cx = p[0]; cy = p[1];
    }
  }
  return out;
}

// Back to path data, which is how the translation is checked: the same drawing,
// said in the smaller vocabulary, rendered and compared.
function toPathData(segs) {
  const p = (v) => `${round(v[0])} ${round(v[1])}`;
  return segs.map((s) =>
    s.op === 'move' ? `M${p(s.to)}`
      : s.op === 'line' ? `L${p(s.to)}`
        : s.op === 'cubic' ? `C${p(s.c1)} ${p(s.c2)} ${p(s.to)}`
          : 'Z').join('');
}

// ------------------------------------------------------------- transforms
// A lockup is a composition, so its parts arrive inside transformed groups. A
// path scraped out without its group's transform draws in the wrong place, on
// top of the thing it was meant to sit beside.
const IDENTITY = [1, 0, 0, 1, 0, 0];

const multiply = (m, n) => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];

const applyTo = (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];

// How much a transform scales a length. Used for stroke width, which is one
// number and therefore only meaningful when the scale is uniform; the average
// of the two axes is what every renderer uses for the non-uniform case.
const scaleOf = (m) => (Math.hypot(m[0], m[1]) + Math.hypot(m[2], m[3])) / 2;

function parseTransform(str) {
  let m = IDENTITY;
  for (const t of String(str || '').matchAll(/(\w+)\s*\(([^)]*)\)/g)) {
    const a = (t[2].match(NUM) || []).map(Number);
    switch (t[1]) {
      case 'translate': m = multiply(m, [1, 0, 0, 1, a[0] || 0, a[1] || 0]); break;
      case 'scale': m = multiply(m, [a[0] === undefined ? 1 : a[0], 0, 0, a[1] === undefined ? (a[0] === undefined ? 1 : a[0]) : a[1], 0, 0]); break;
      case 'matrix': if (a.length === 6) m = multiply(m, a); break;
      case 'rotate': {
        const r = ((a[0] || 0) * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
        if (a.length >= 3) {
          m = multiply(m, [1, 0, 0, 1, a[1], a[2]]);
          m = multiply(m, [c, s, -s, c, 0, 0]);
          m = multiply(m, [1, 0, 0, 1, -a[1], -a[2]]);
        } else m = multiply(m, [c, s, -s, c, 0, 0]);
        break;
      }
      case 'skewX': m = multiply(m, [1, 0, Math.tan(((a[0] || 0) * Math.PI) / 180), 1, 0, 0]); break;
      case 'skewY': m = multiply(m, [1, Math.tan(((a[0] || 0) * Math.PI) / 180), 0, 1, 0, 0]); break;
      default: break;
    }
  }
  return m;
}

const transformSegs = (segs, m) => segs.map((s) => {
  if (s.op === 'close') return s;
  const out = { op: s.op, to: applyTo(m, s.to) };
  if (s.op === 'cubic') { out.c1 = applyTo(m, s.c1); out.c2 = applyTo(m, s.c2); }
  return out;
});

module.exports = { parse, toPathData, quadToCubic, arcToCubics, tokens, round,
  IDENTITY, multiply, applyTo, scaleOf, parseTransform, transformSegs };
