'use strict';
const svgu = require('./svg');
const geo = require('./geometry');

// Build one lockup in one colourway. Nothing here is placed by eye: the
// wordmark is scaled off the mark's measured ink height and the gap is a
// fraction of it, so every lockup in the set agrees with every other.
function buildVariant({ markSrc, wordmarkSrc, lockup, colourway, rules, measured }) {
  const paint = (src) => {
    const doc = svgu.parse(src);
    const { missing, kept } = svgu.applyColourway(doc, colourway.slots);
    return { doc, missing, kept };
  };

  if (lockup === 'mark') {
    const { doc, missing, kept } = paint(markSrc);
    return { svg: svgu.serialize(doc), missing, kept, box: measured.markInk };
  }
  if (lockup === 'wordmark') {
    const { doc, missing, kept } = paint(wordmarkSrc);
    return { svg: svgu.serialize(doc), missing, kept, box: measured.wordInk };
  }

  const m = paint(markSrc), w = paint(wordmarkSrc);
  const missing = [...new Set([...m.missing, ...w.missing])];
  const kept = [...new Set([...m.kept, ...w.kept])];
  const mi = measured.markInk, wi = measured.wordInk;

  // the wordmark is sized against the mark, never the other way round
  const wordScale = (mi.h * rules.wordmarkHeightRatio) / wi.h;
  const wW = wi.w * wordScale, wH = wi.h * wordScale;
  const gap = mi.h * rules.lockupGapRatio;

  let width, height, parts;
  if (lockup === 'horizontal') {
    width = mi.w + gap + wW;
    height = Math.max(mi.h, wH);
    parts = [
      { doc: m.doc, box: mi, x: 0, y: (height - mi.h) / 2, scale: 1 },
      { doc: w.doc, box: wi, x: mi.w + gap, y: (height - wH) / 2, scale: wordScale },
    ];
  } else if (lockup === 'stacked') {
    width = Math.max(mi.w, wW);
    height = mi.h + gap + wH;
    parts = [
      { doc: m.doc, box: mi, x: (width - mi.w) / 2, y: 0, scale: 1 },
      { doc: w.doc, box: wi, x: (width - wW) / 2, y: mi.h + gap, scale: wordScale },
    ];
  } else {
    throw new Error(`this project asks for a lockup called "${lockup}", which the engine does not know how to build`);
  }
  return { svg: svgu.compose(parts, width, height), missing, kept, box: { x: 0, y: 0, w: svgu.round(width), h: svgu.round(height) } };
}

// Measure the master once. Every variant is derived from these numbers.
function measure(project) {
  const markSrc = project.assets.mark.source;
  const markInk = geo.inkBox(markSrc);
  const out = {
    markInk,
    markViewBox: svgu.viewBox(svgu.parse(markSrc)),
    clearSpace: geo.clearSpace(markInk, project.rules.clearSpaceRatio),
    minimumSize: geo.minimumSize(markSrc, project.rules),
    slots: svgu.slotsUsed(svgu.parse(markSrc)),
  };
  if (project.assets.wordmark) {
    out.wordInk = geo.inkBox(project.assets.wordmark.source);
    out.slots = [...new Set([...out.slots, ...svgu.slotsUsed(svgu.parse(project.assets.wordmark.source))])];
  }
  return out;
}

module.exports = { buildVariant, measure };
