'use strict';
// Rule blocks. The third kind, and the one that took building the specimen to
// notice: a designer makes one creative decision, the system stores it, and
// from then on it generates every instance without asking again.
//
// Where a rule can be measured off the mark, it is proposed from the mark and
// the project may override it. That keeps the decision with the designer and
// the arithmetic with the machine.
const svgu = require('./svg');

// ---------------------------------------------------------------- icons
// Icons inherit the mark's own proportions, so the set looks like it belongs to
// the same hand. Three numbers carry across.
function iconRules(measured, override) {
  const vb = measured.markViewBox, ink = measured.markInk;
  const stroke = measured.minimumSize.thinnestStroke;
  const margin = Math.max(0, (vb.w - ink.w) / 2);
  const proposed = {
    box: 24,
    marginFraction: round(margin / vb.w, 4),      // the mark's own margin, as a fraction
    strokeRatio: stroke ? round(stroke / vb.w, 4) : 0.075,
    curveRatio: 1.25,                             // overridden per project; see below
    cap: 'round', join: 'round', filled: false,
  };
  const r = Object.assign(proposed, override || {});
  r.live = round(r.box * (1 - r.marginFraction * 2), 2);
  r.stroke = round(r.box * r.strokeRatio, 2);
  r.curveRadius = round(r.box * r.curveRatio, 2);
  r.derivedFrom = { viewBox: vb.w, ink: ink.w, markStroke: stroke, markMargin: round(margin, 2) };
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
  return Object.assign({
    tile: 100, rowSpacing: 0.22, phase: 0.5, weight: 3, cap: 'round',
    densities: { fine: 0.45, medium: 1, coarse: 2.1 },
  }, override || {});
}

// ---------------------------------------------------------------- motion
function motionRules(override) {
  return Object.assign({
    easing: { out: [0, 0.55, 0.45, 1], through: [0.85, 0, 0.15, 1] },
    durations: { quick: 160, base: 280, considered: 480, slow: 900 },
    loop: false,
    build: [
      { part: 'outline', from: 0, to: 400, ease: 'out', how: 'draws from the top' },
      { part: 'fill', from: 300, to: 900, ease: 'through', how: 'rises to its line' },
    ],
  }, override || {});
}

const bezier = (e) => `cubic-bezier(${e.join(', ')})`;
const round = (n, dp = 2) => Number(n.toFixed(dp));

function resolve(project, measured) {
  const sys = project.system || {};
  return {
    icons: iconRules(measured, sys.icons),
    pattern: patternRules(sys.pattern),
    motion: motionRules(sys.motion),
  };
}

module.exports = { resolve, iconRules, checkIcon, pathPoints, patternRules, motionRules, bezier, round };
