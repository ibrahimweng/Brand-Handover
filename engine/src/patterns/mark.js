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

   **How round is it?** The share of the drawing's *turning* that happens on a
   curve rather than at a corner. A mark built from straight lines gets a
   pattern with corners; one built from arcs gets a pattern with none.

   This used to count path command letters, and the file said so: "a crude
   measure of a real thing". It was cruder than that. A <circle> scored four
   curves whatever its radius; a rounded rectangle scored four curves and four
   lines whether its corners were a hair or a half-stem; and yamabiko, which is
   a drawing of mountain chevrons with no curve anywhere in it, scored 0.50 and
   got half a pattern's worth of rounding it had never asked for. Winterbourne,
   an arc over four straight bars, scored 0.20 — and the bars are separate
   strokes that meet nothing, so every turn in that drawing is on the arc.

   Now it is measured off the geometry: every place the outline changes
   direction, how far it turns there, and whether it turns on a curve or at a
   point. Yamabiko reads 0.00 and winterbourne 1.00, which is what anyone
   looking at them would say.

   **At what radius does it turn?** The radius most of that turning happens at,
   in units of the mark's own narrowest run of ink. A mark that turns inside its
   own stem is making tight, worked gestures; one that turns over eight stems is
   making broad ones. Nothing measured this before, and `zigzag` wanted it: its
   tooth depth was the number 0.9, the same for every identity in the
   repository.

   **How wide is it?** The ink box's proportion, which decides whether a tile is
   square or runs one way. */
'use strict';
const svgu = require('../svg');
const outline = require('./outline');

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
  // How the outline turns, which is two of the four numbers below.
  const how = outline.character(outline.movesOf(markSource), stem);
  return {
    // how many of the mark's own narrowest runs fit across it
    fineness: stem > 0 ? box.w / stem : 24,
    // 0 is all corners, 1 is all curves — of the *turning*, not of the commands
    curviness: Math.round(how.round * 1000) / 1000,
    // the radius most of that turning happens at, in stems
    turn: Math.round(how.turn * 100) / 100,
    // and whether the drawing had any turning to measure. Three straight bars
    // that never meet say nothing about corners, and a drawing that says
    // nothing gets corners rather than the benefit of the doubt.
    turned: how.found,
    // wider than tall, or taller than wide
    aspect: ink.h > 0 ? ink.w / ink.h : 1,
    stem,
    box: box.w,
    from: stem === ms.thinnestStroke ? 'the narrowest run of ink in the drawing'
      : 'the project\'s minimum stroke, because nothing in the drawing was measurable',
  };
}

module.exports = { read, curviness };
// `curviness` is still exported: it is what the old measure did, kept so the
// test that compares the two can show why the new one replaced it.
