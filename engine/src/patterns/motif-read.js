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
function movesOf(markup) {
  const doc = svg.parse(`<svg xmlns="http://www.w3.org/2000/svg">${markup}</svg>`);
  const all = [];
  svg.eachPainted(doc, (el) => {
    const segs = segsOf(el);
    if (!segs.length) return;
    all.push(...paths.transformSegs(segs, ctmOf(el)));
  });
  return all;
}

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

// The motif this identity's artwork offers, and the others it could have.
//
// `which` names one of the ranked candidates by key; without it the ranking
// decides, which is the same shape the mark-tiler would have used.
function read(markSource, rules, measured, which) {
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
  return { ok: true, ops, ratio, key: chosen.key, name: chosen.name, nameKey: chosen.nameKey,
    // Filled or stroked, and at what weight — the drawing's answer, carried so
    // the generator never has to ask.
    stroked: !!chosen.stroked,
    weight: sp && sp.strokeRatio ? +sp.strokeRatio.toFixed(4) : 0.06,
    moves: ops.length, why: chosen.why,
    alternatives: ranked.filter((c) => c !== chosen).map((c) => ({ key: c.key, name: c.name, score: c.score })) };
}

module.exports = { read, movesOf, normalise, segsOf };
