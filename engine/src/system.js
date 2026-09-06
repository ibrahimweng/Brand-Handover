'use strict';
// Rule blocks. The third kind, and the one that took building the specimen to
// notice: a designer makes one creative decision, the system stores it, and
// from then on it generates every instance without asking again.
//
// Where a rule can be measured off the mark, it is proposed from the mark and
// the project may override it. That keeps the decision with the designer and
// the arithmetic with the machine.
const svgu = require('./svg');

// A project overrides part of a rule, not all of it. `Object.assign` replaces
// whatever it is given, so `system.motion: { durations: { base: 420 } }` — the
// natural thing to write — deleted quick, considered and slow, and
// `system.pattern: { densities: { medium: 1.2 } }` deleted fine and coarse and
// with them six of the nine tiles the package writes. Silently, in both cases.
//
// Merge one plain object into another, a level at a time. An array is a whole
// answer rather than a set of named parts — an easing curve, the build order,
// the crop ratios — so an array replaces.
function merge(base, over) {
  if (!over || typeof over !== 'object' || Array.isArray(over)) return over === undefined ? base : over;
  const out = Array.isArray(base) ? {} : Object.assign({}, base);
  for (const [k, v] of Object.entries(over)) {
    const b = out[k];
    out[k] = (b && typeof b === 'object' && !Array.isArray(b) && v && typeof v === 'object' && !Array.isArray(v))
      ? merge(b, v) : v;
  }
  return out;
}

// ---------------------------------------------------------------- icons
// Icons inherit the mark's own proportions, so the set looks like it belongs to
// the same hand. Three numbers carry across.
function iconRules(measured, override) {
  const vb = measured.markViewBox, ink = measured.markInk;
  // Which weight the icons inherit was never a decision, it was a convenience:
  // minimumSize had already worked out the thinnest stroke, so the icon grid
  // used that. For a mark drawn in one weight the two are the same number and
  // nothing was ever wrong. For a mark drawn in two — a heavy arch over a fine
  // brook — the thinnest is the hairline, and the whole icon set came out at
  // half the weight of the mark it is supposed to belong to: 0.9 on a 24 box,
  // which is 3.75% and disappears at 16 px. Icons are the mark's voice at small
  // size, so they take the weight that carries it, and the build says so.
  const weights = (measured.strokeWidths || []).filter((w) => w > 0);
  const stroke = weights.length ? weights[weights.length - 1] : measured.minimumSize.thinnestStroke;
  const margin = Math.max(0, (vb.w - ink.w) / 2);
  const proposed = {
    box: 24,
    marginFraction: round(margin / vb.w, 4),      // the mark's own margin, as a fraction
    strokeRatio: stroke ? round(stroke / vb.w, 4) : 0.075,
    curveRatio: 1.25,                             // overridden per project; see below
    cap: 'round', join: 'round', filled: false,
  };
  const r = merge(proposed, override || {});
  // Three of these are ratios and three are the sizes those ratios come out at.
  // They were computed after the merge, so a project writing the size it wanted
  // — `stroke: 2`, which is the number a designer thinks in — had it accepted,
  // stored, and then overwritten by the derived one. Take the size where it is
  // given and work the ratio back from it, which is the same rule the rest of
  // the engine follows: the number you can measure wins.
  const given = override || {};
  if (given.stroke != null && given.strokeRatio == null) r.strokeRatio = round(r.stroke / r.box, 4);
  if (given.live != null && given.marginFraction == null) r.marginFraction = round((1 - r.live / r.box) / 2, 4);
  if (given.curveRadius != null && given.curveRatio == null) r.curveRatio = round(r.curveRadius / r.box, 4);
  r.live = round(r.box * (1 - r.marginFraction * 2), 2);
  r.stroke = round(r.box * r.strokeRatio, 2);
  r.curveRadius = round(r.box * r.curveRatio, 2);
  r.derivedFrom = { viewBox: vb.w, ink: ink.w, markStroke: stroke, markMargin: round(margin, 2) };
  // the build reads this to tell the designer a choice was made on their behalf
  if (weights.length > 1) r.derivedFrom.markWeights = weights;
  return r;
}

// Walk a path and hand back only the points it actually draws through.
// Arc radii and flags share the number stream with coordinates, so a plain
// number scrape reads a radius of 30 as a point 30 units across and fails an
// icon that never leaves its box.
const ARGS = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
function pathPoints(d) {
  const tokens = String(d).match(/[a-df-zA-DF-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
  const out = [];
  let i = 0, cx = 0, cy = 0, sx = 0, sy = 0, cmd = null;
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[a-z]/i.test(tokens[i])) { cmd = tokens[i++]; }
    else if (cmd === 'M') cmd = 'L';
    else if (cmd === 'm') cmd = 'l';
    if (!cmd) break;
    const lower = cmd.toLowerCase(), rel = cmd === lower, n = ARGS[lower];
    if (n === undefined) break;
    if (lower === 'z') { cx = sx; cy = sy; continue; }
    if (tokens.length - i < n) break;
    let x = cx, y = cy;
    if (lower === 'h') { const v = num(); x = rel ? cx + v : v; }
    else if (lower === 'v') { const v = num(); y = rel ? cy + v : v; }
    else if (lower === 'a') {
      num(); num(); num(); num(); num();            // rx ry rotation and the two flags
      const px = num(), py = num();
      x = rel ? cx + px : px; y = rel ? cy + py : py;
    } else {
      let px = 0, py = 0;
      for (let k = 0; k < n; k += 2) {
        px = num(); py = num();
        out.push([rel ? cx + px : px, rel ? cy + py : py]);   // control points count too
      }
      x = rel ? cx + px : px; y = rel ? cy + py : py;
      out.pop();
    }
    out.push([x, y]);
    if (lower === 'm') { sx = x; sy = y; }
    cx = x; cy = y;
  }
  return out;
}

// What the rule refuses. Exporting an icon at eight sizes is easy; rejecting
// the ninth icon whose stroke is wrong is the part that keeps a set coherent,
// and by the twentieth icon a machine is the only thing still checking.
function checkIcon(source, rules) {
  const found = [];
  let doc;
  try { doc = svgu.parse(source); }
  catch (e) { return [{ level: 'blocker', what: 'This icon is not valid SVG.', why: 'Nothing can be checked or exported from it.', how: 'Re-export it.' }]; }

  const vb = svgu.viewBox(doc);
  if (Math.abs(vb.w - rules.box) > 0.01 || Math.abs(vb.h - rules.box) > 0.01) {
    found.push({ level: 'blocker',
      what: `This icon is ${vb.w} by ${vb.h}, and the grid is ${rules.box} by ${rules.box}.`,
      why: 'An icon on the wrong grid will not line up with the rest of the set at any size.',
      how: `Set the artboard to ${rules.box} by ${rules.box} and redraw to the guides.` });
    return found;
  }

  const strokes = [], caps = new Set(), joins = new Set();
  let filled = 0, outside = 0, elements = 0;
  const pad = round(rules.box * rules.marginFraction, 2);

  // Almost every exporter hangs stroke and fill on the <svg> or on a <g> and
  // lets the shapes inherit them. Reading only what is on the shape itself
  // finds nothing, and an icon with the wrong weight passes silently, which is
  // worse than not checking at all. So carry the values down the tree.
  const PAINT = ['stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'fill'];
  const SHAPES = ['path', 'circle', 'rect', 'ellipse', 'line', 'polyline', 'polygon'];

  function own(n) {
    const got = {};
    // a style attribute wins over the presentation attribute, as in a browser
    for (const a of PAINT) { const v = n.getAttribute(a); if (v != null && v !== '') got[a] = v.trim(); }
    for (const decl of String(n.getAttribute('style') || '').split(';')) {
      const i = decl.indexOf(':'); if (i < 0) continue;
      const k = decl.slice(0, i).trim();
      if (PAINT.includes(k)) got[k] = decl.slice(i + 1).trim();
    }
    return got;
  }

  (function walk(n, inherited) {
    if (n.nodeType !== 1) return;
    const paint = Object.assign({}, inherited, own(n));
    const local = n.nodeName.replace(/^.*:/, '');
    if (SHAPES.includes(local)) {
      elements++;
      const sw = parseFloat(paint['stroke-width']);
      if (paint.stroke && paint.stroke !== 'none') {
        strokes.push(Number.isFinite(sw) ? sw : 1);
        caps.add(paint['stroke-linecap'] || 'butt');
        joins.add(paint['stroke-linejoin'] || 'miter');
      }
      // an unset fill paints black, so only an explicit none is unfilled
      if (paint.fill !== 'none') filled++;
      // anything drawn hard against the edge has left the live area.
      // Only real coordinates count: an arc's radii and flags are not points,
      // and reading them as points fails a perfectly good icon.
      const pts = pathPoints(n.getAttribute('d') || '');
      for (const [px, py] of pts) {
        if (px < pad - 0.5 || px > rules.box - pad + 0.5 || py < pad - 0.5 || py > rules.box - pad + 0.5) { outside++; break; }
      }
    }
    for (let c = n.firstChild; c; c = c.nextSibling) walk(c, paint);
  }(doc.documentElement, {}));

  if (!elements) found.push({ level: 'blocker', what: 'This icon is empty.', why: 'There is nothing to export.', how: 'Draw something.' });

  const wrong = strokes.filter((w) => Math.abs(w - rules.stroke) > 0.01);
  if (wrong.length) found.push({ level: 'blocker',
    what: `${wrong.length} stroke${wrong.length > 1 ? 's are' : ' is'} ${[...new Set(wrong)].join(', ')} where the set uses ${rules.stroke}.`,
    why: 'A heavier or lighter stroke reads as a different icon set the moment it sits beside the others.',
    how: `Set every stroke to ${rules.stroke}.` });

  const badCap = [...caps].filter((c) => c !== rules.cap);
  if (badCap.length) found.push({ level: 'warning',
    what: `Stroke ends are ${badCap.join(', ')} where the set uses ${rules.cap}.`,
    why: 'Ends and corners are most of what makes a set look drawn by one person.',
    how: `Set stroke-linecap to ${rules.cap}.` });

  const badJoin = [...joins].filter((j) => j !== rules.join);
  if (badJoin.length) found.push({ level: 'warning',
    what: `Corners are ${badJoin.join(', ')} where the set uses ${rules.join}.`,
    why: 'A mitred corner spikes at small sizes where a round one holds.',
    how: `Set stroke-linejoin to ${rules.join}.` });

  if (!rules.filled && filled) found.push({ level: 'warning',
    what: `${filled} shape${filled > 1 ? 's are' : ' is'} filled, and this set is drawn in outline.`,
    why: 'A filled icon among outlined ones is the first thing an eye lands on, for the wrong reason.',
    how: 'Use fill="none" and a stroke.' });

  if (outside) found.push({ level: 'warning',
    what: `${outside} shape${outside > 1 ? 's reach' : ' reaches'} outside the ${rules.live} unit live area.`,
    why: `The ${pad} unit margin is what stops icons touching each other and the edge of a button.`,
    how: `Keep the drawing inside the middle ${rules.live} units.` });

  return found;
}

// ---------------------------------------------------------------- pattern
function patternRules(override) {
  return merge({
    tile: 100, rowSpacing: 0.22, phase: 0.5, weight: 3, cap: 'round',
    densities: { fine: 0.45, medium: 1, coarse: 2.1 },
  }, override || {});
}

// ---------------------------------------------------------------- motion
function motionRules(override) {
  return merge({
    easing: { out: [0, 0.55, 0.45, 1], through: [0.85, 0, 0.15, 1] },
    durations: { quick: 160, base: 280, considered: 480, slow: 900 },
    loop: false,
    build: [
      { part: 'outline', from: 0, to: 400, ease: 'out', how: 'draws from the top' },
      { part: 'fill', from: 300, to: 900, ease: 'through', how: 'rises to its line' },
    ],
  }, override || {});
}

// ---------------------------------------------------------------- the module
// A construction grid is the first thing a serious set of guidelines shows and
// the last thing anybody checks. The manual has drawn one since the beginning —
// six divisions of the box, chosen because six looks like a grid — over artwork
// built on a module of fifteen. It was a decoration of a diagram, and a
// decoration that says "this mark was built on this grid" is a claim.
//
// Where a project states its module, the diagram draws that one, and every
// point in the artwork is asked whether it is on it.
function gridRules(override, measured) {
  const vb = measured.markViewBox;
  if (!override || !(Number(override.unit) > 0)) return null;
  const unit = Number(override.unit);
  const box = Number(override.box) > 0 ? Number(override.box) : vb.w;
  return { unit, box, across: round(box / unit, 3), note: override.note || null,
    declared: true };
}

// The points a drawing passes through that are not on the module. Tolerance is
// a hundredth of a unit: a normaliser that flattens a transform leaves values
// like 44.999998, and that is the same point.
function offGrid(source, unit, tol = 0.01) {
  const doc = svgu.parse(source);
  const off = [];
  let total = 0;
  svgu.eachPainted(doc, (el) => {
    if (!el.getAttribute) return;
    const tag = String(el.nodeName).replace(/^.*:/, '').toLowerCase();
    if (tag !== 'path') return;
    for (const [x, y] of pathPoints(el.getAttribute('d') || '')) {
      total += 1;
      const dx = Math.abs(x / unit - Math.round(x / unit)) * unit;
      const dy = Math.abs(y / unit - Math.round(y / unit)) * unit;
      if (dx <= tol && dy <= tol) continue;
      off.push({ x: round(x, 3), y: round(y, 3),
        by: round(Math.max(dx, dy), 3) });
    }
  });
  return { total, off: off.sort((a, b) => b.by - a.by) };
}

const bezier = (e) => `cubic-bezier(${e.join(', ')})`;
const round = (n, dp = 2) => Number(n.toFixed(dp));

function resolve(project, measured) {
  const sys = project.system || {};
  // The grid describes the icons this package contains, and where an identity
  // ships a drawing for them those are cut from it, not from the master.
  const forIcons = require('./variants').measureIcon(project) || measured;
  return {
    // written beside system.pattern and system.photography, the natural
    // spelling is the singular, so both are accepted
    icons: iconRules(forIcons, sys.icons || sys.icon),
    pattern: patternRules(sys.pattern),
    motion: motionRules(sys.motion),
    photography: require('./photography').rules(sys.photography),
    grid: gridRules(sys.grid, measured),
  };
}

module.exports = { resolve, merge, iconRules, checkIcon, pathPoints, gridRules, offGrid, patternRules, motionRules, bezier, round };
