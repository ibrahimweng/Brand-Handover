/* What the artwork says a pattern should look like.

   Every default in this engine is measured off the mark rather than typed. The
   old pattern module had `tile: 100, weight: 3` — numbers that describe no
   particular drawing, and which gave every identity in the repository the same
   pattern at the same weight. A generator here asks this module instead, and
   the manual can print the measurement beside the pattern so a designer can
   check the reasoning rather than take it.

   Three things are measured, and each one answers a question a generator
   actually has.

   **How fine is it?** The box divided by the narrowest run of ink in the
   drawing: how many stems across the mark is. Kvist's wordmark is 252 units
   wide with a 6.93 stem, so it is 36 stems across, and a pattern of 36 cells is
   as fine as the mark is. A mark drawn with a heavy stroke gets a coarse
   pattern and a fine one gets a fine pattern, which is the whole of it.

   **How round is it?** The share of the drawing's path commands that are
   curves. A mark built from straight lines gets a pattern with corners; one
   built from arcs gets a pattern with none. It is a crude measure of a real
   thing, and it is a measure rather than a preference.

   **How wide is it?** The ink box's proportion, which decides whether a tile is
   square or runs one way. */
'use strict';
const svgu = require('../svg');

// Path commands, counted by kind. Curves are C S Q T A; lines are L H V and the
// straight closes. M is neither — it starts a run rather than drawing one.
function curviness(markup) {
  let curves = 0, lines = 0;
  const ds = String(markup).match(/\sd="([^"]*)"/g) || [];
  for (const d of ds) {
    for (const c of d.replace(/\sd="|"/g, '')) {
      if ('CSQTAcsqta'.indexOf(c) >= 0) curves++;
      else if ('LHVlhv'.indexOf(c) >= 0) lines++;
    }
  }
  // Shapes that are curves by their tag rather than by a command, and shapes
  // that are corners by their tag. A drawing made of <circle> has no path data
  // at all and is entirely round.
  const round = (String(markup).match(/<(circle|ellipse)\b/g) || []).length;
  const square = (String(markup).match(/<(rect|polygon|polyline|line)\b/g) || []).length;
  curves += round * 4; lines += square * 4;
  const total = curves + lines;
  return total ? curves / total : 0.5;
}

// Everything a generator wants to know, in one object.
function read(markSource, measured, rules) {
  const doc = svgu.parse(markSource);
  const box = svgu.viewBox(doc);
  const ms = (measured && measured.minimumSize) || {};
  const stem = ms.thinnestStroke || (rules && rules.minStrokePx) || 1;
  const ink = (measured && measured.markInk) || { w: box.w, h: box.h };
  return {
    // how many of the mark's own narrowest runs fit across it
    fineness: stem > 0 ? box.w / stem : 24,
    // 0 is all corners, 1 is all curves
    curviness: curviness(markSource),
    // wider than tall, or taller than wide
    aspect: ink.h > 0 ? ink.w / ink.h : 1,
    stem,
    box: box.w,
    from: stem === ms.thinnestStroke ? 'the narrowest run of ink in the drawing'
      : 'the project\'s minimum stroke, because nothing in the drawing was measurable',
  };
}

module.exports = { read, curviness };
