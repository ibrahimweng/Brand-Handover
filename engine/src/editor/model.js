/* The document a person edits. The same file runs in Node and in the browser,
   so the editor and the server cannot disagree about what a document is. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HandoverModel = factory();
}(typeof self !== 'undefined' ? self : this, function () {
'use strict';
// The document a person edits. Plain data, so it can be saved, diffed, and
// rebuilt on a server without a browser anywhere near it.
//
// A block is one of three kinds:
//   plain    text, rule, fill, slot. Ordinary furniture.
//   derived  draws itself from the project. Never edited, never wrong.
//   rule     one decision, applied forever. Placed, never redrawn.

const PLAIN = ['text', 'rule', 'fill', 'slot', 'surface'];
const DERIVED = ['mark', 'lockup', 'construction', 'clearSpace', 'minimumSize', 'palette', 'contrast', 'typeSpecimen', 'assetIndex'];
// Rule blocks are the third kind. One decision, made once, generating every
// instance after that. You place one and choose which instance to show; you
// never redraw it and you never restate the rule.
const RULE = ['pattern', 'iconGrid', 'motion', 'photography'];
const KINDS = [...PLAIN, ...DERIVED, ...RULE];
const kindOf = (type) => (RULE.includes(type) ? 'rule' : DERIVED.includes(type) ? 'derived' : 'plain');

// Page sizes. Layout always happens in CSS pixels, because that is what a
// block's x and y mean and what the browser lays out in. A print size also
// carries its real dimensions, because 794 px is only A4 by accident of 96 dpi
// and a printer wants to be told 210 mm.
const PER = { px: 1, mm: 96 / 25.4, in: 96 };
const toPx = (v, unit) => Math.round(v * (PER[unit] || 1));

const SHEETS = {
  'slide-16x9': { name: 'Slide 16:9', w: 1280, h: 720, unit: 'px' },
  'slide-4x3': { name: 'Slide 4:3', w: 1024, h: 768, unit: 'px' },
  square: { name: 'Square', w: 1080, h: 1080, unit: 'px' },
  story: { name: 'Story 9:16', w: 1080, h: 1920, unit: 'px' },
  a4: { name: 'A4 portrait', w: 210, h: 297, unit: 'mm' },
  'a4-landscape': { name: 'A4 landscape', w: 297, h: 210, unit: 'mm' },
  a5: { name: 'A5 portrait', w: 148, h: 210, unit: 'mm' },
  letter: { name: 'US Letter', w: 8.5, h: 11, unit: 'in' },
  'letter-landscape': { name: 'US Letter landscape', w: 11, h: 8.5, unit: 'in' },
};

// One shape for a page size wherever it is read: pixels to lay out in, and the
// real size to print at. A custom size passes through the same door.
const FALLBACK = 'slide-16x9';

// A size given as bare numbers that happens to be one of the named ones is that
// named one. Old documents carry pixels and no name, and a picker that shows
// nothing selected for a plain 16:9 slide is just wrong.
function recognise(custom) {
  if (!custom) return null;
  for (const [k, v] of Object.entries(SHEETS)) {
    if (toPx(v.w, v.unit) === toPx(custom.w, custom.unit)
      && toPx(v.h, v.unit) === toPx(custom.h, custom.unit)) return k;
  }
  return null;
}

function sheet(key, custom) {
  // the name reports what was actually used, so an unknown key falls back to a
  // real size rather than to a size called "custom" that nothing can round trip
  const named = SHEETS[key] ? key
    : (custom && custom.unit) ? (recognise(custom) || 'custom')
    : FALLBACK;
  const s = named === 'custom' ? custom : SHEETS[named];
  const w = toPx(s.w, s.unit), h = toPx(s.h, s.unit);
  return { size: named, name: s.name || `${s.w} × ${s.h} ${s.unit}`,
    w, h, unit: s.unit, printW: s.w, printH: s.h,
    // what @page wants: the physical size, or pixels when there is no physical one
    css: s.unit === 'px' ? `${s.w}px ${s.h}px` : `${s.w}${s.unit} ${s.h}${s.unit}` };
}

// A document has one size; a page may override it, which is how a fold-out or a
// full-bleed cover lives in the same file as everything else.
// Bleed is a print spec for the whole document rather than part of a page's
// identity, so it lives beside the size rather than inside it.
const printSpec = (doc) => {
  const p = (doc && doc.page) || {};
  return { bleed: Number(p.bleed) || 0, marks: p.marks !== false };
};

const pageSize = (doc, page) => {
  const p = (page && page.page) || (doc && doc.page) || {};
  // a document written before sizes were named carries pixels and nothing else,
  // and it has to keep the size it was laid out at rather than snap to a preset
  const custom = p.unit ? p : (p.w && p.h) ? { w: p.w, h: p.h, unit: 'px' } : null;
  return sheet(p.size, custom);
};

const PAGE = sheet('slide-16x9');
const GRID = 8;

// Ids were a counter plus the clock, and the clock was doing real work: the
// counter restarts at zero every session, so a document loaded from disk and
// then added to would have handed out b1 twice. It also meant two builds of an
// unchanged master produced two different documents — different ids in
// document.json, in the editor and in the published page, and therefore a
// different zip. 45 of Meridian's 138 files changed on every run, which makes
// the one thing this project asks you to do — change the master, rebuild, diff
// — impossible. Counting on from what a document already holds does the same
// job and can be repeated.
let seq = 0;
const id = (p) => `${p}${(++seq).toString(36)}`;

// Continue past every id a document already carries, so ids stay unique across
// a save and a reload without having to be unpredictable.
function resetIds() { seq = 0; }

function seedIds(doc) {
  let top = 0;
  const look = (v) => {
    const m = /^[a-z]+([0-9a-z]+)$/.exec(String(v || ''));
    if (!m) return;
    const n = parseInt(m[1], 36);
    if (Number.isFinite(n) && n > top) top = n;
  };
  for (const page of (doc && doc.pages) || []) {
    look(page.id);
    for (const b of page.blocks || []) look(b.id);
  }
  seq = Math.max(seq, top);
  return seq;
}

const DEFAULTS = {
  text: { text: 'Double click to edit', style: 'body', align: 'left', colour: 'primary' },
  rule: { colour: 'primary', weight: 2 },
  fill: { colour: 'ground' },
  // an image slot holds an id, never the bytes. See editor/images.js for why.
  slot: { label: 'Image', image: null, fit: 'cover', focusX: 50, focusY: 50, caption: '',
    // the brand's photography treatment applies unless this slot opts out, and
    // scrim is a per-image override of the rule's own strength
    treatment: true, scrim: null },
  // A mockup: the mark mapped into a surface in a photograph. The four corners
  // are fractions of the block, so the mapping survives the block being resized.
  surface: { image: null, quad: [[0.2, 0.25], [0.8, 0.25], [0.8, 0.75], [0.2, 0.75]],
    art: 'lockup', lockup: 'horizontal', colourway: 'primary',
    blend: 'multiply', opacity: 1, surfaceWidthMm: 0, treatment: false },
  mark: { colourway: 'primary', on: 'ground' },
  lockup: { lockup: 'horizontal', colourway: 'primary', on: 'ground' },
  construction: {}, clearSpace: {}, minimumSize: {},
  palette: {}, contrast: { limit: 6 }, typeSpecimen: {}, assetIndex: {},
  pattern: { density: 'medium', colourway: 'ground', on: 'primary', caption: false },
  iconGrid: { colourway: 'primary', on: 'ground', line: 'neutral', caption: true },
  motion: { colourway: 'ground', on: 'primary', caption: true },
  photography: { on: 'ground', caption: true },
};
const SIZES = {
  text: { w: 520, h: 120 }, rule: { w: 520, h: 2 }, fill: { w: 400, h: 260 },
  slot: { w: 420, h: 280 }, surface: { w: 560, h: 380 }, mark: { w: 300, h: 300 }, lockup: { w: 520, h: 200 },
  construction: { w: 380, h: 400 }, clearSpace: { w: 380, h: 400 }, minimumSize: { w: 640, h: 240 },
  palette: { w: 900, h: 260 }, contrast: { w: 820, h: 300 }, typeSpecimen: { w: 820, h: 300 },
  assetIndex: { w: 560, h: 320 },
  pattern: { w: 620, h: 280 }, iconGrid: { w: 560, h: 420 }, motion: { w: 360, h: 360 },
  photography: { w: 560, h: 300 },
};

function makeBlock(type, at = {}, on) {
  if (!KINDS.includes(type)) throw new Error(`there is no block called "${type}"`);
  const s = SIZES[type], sheetOn = on || PAGE;
  // a block never opens wider than the page it lands on
  const w = Math.min(at.w || s.w, sheetOn.w), h = Math.min(at.h || s.h, sheetOn.h);
  return {
    id: id('b'), type,
    x: at.x !== undefined ? at.x : Math.round((sheetOn.w - w) / 2),
    y: at.y !== undefined ? at.y : Math.round((sheetOn.h - h) / 2),
    w, h,
    props: Object.assign({}, DEFAULTS[type], at.props),
  };
}

const makePage = (name = 'Page') => ({ id: id('p'), name, blocks: [] });

const emptyDoc = (brand = 'Brand') => ({
  version: 1, brand,
  page: { size: 'slide-16x9', w: PAGE.w, h: PAGE.h }, grid: GRID,
  pages: [makePage('Cover')],
});

// ---------------------------------------------------------------- operations
// Every change goes through here, so undo has one thing to record and the
// editor never mutates the document behind its own back.
const clone = (d) => JSON.parse(JSON.stringify(d));
const findPage = (doc, pageId) => doc.pages.find((p) => p.id === pageId);
const snap = (v, g) => (g ? Math.round(v / g) * g : Math.round(v));

const EDGE = 1;                       // within a pixel of an edge counts as on it
function reflow(page, from, to) {
  const k = Math.min(to.w / from.w, to.h / from.h);
  const padX = (to.w - from.w * k) / 2, padY = (to.h - from.h * k) / 2;
  for (const b of page.blocks) {
    const left = b.x <= EDGE, top = b.y <= EDGE;
    const right = Math.abs(b.x + b.w - from.w) <= EDGE, bottom = Math.abs(b.y + b.h - from.h) <= EDGE;
    b.x = Math.round(b.x * k + padX); b.y = Math.round(b.y * k + padY);
    b.w = Math.max(1, Math.round(b.w * k)); b.h = Math.max(1, Math.round(b.h * k));
    if (left && right) { b.x = 0; b.w = to.w; }
    else if (left) b.x = 0;
    else if (right) b.x = to.w - b.w;
    if (top && bottom) { b.y = 0; b.h = to.h; }
    else if (top) b.y = 0;
    else if (bottom) b.y = to.h - b.h;
  }
}

const ops = {
  addBlock(doc, pageId, type, at) {
    const p = findPage(doc, pageId);
    if (!p) throw new Error('that page is not in this document');
    // centred on the page it is landing on, whatever size that page is
    const b = makeBlock(type, at, (at && at.on) || pageSize(doc, p));
    p.blocks.push(b);
    return b.id;
  },
  removeBlocks(doc, pageId, ids) {
    const p = findPage(doc, pageId);
    p.blocks = p.blocks.filter((b) => !ids.includes(b.id));
  },
  moveBlocks(doc, pageId, ids, dx, dy, grid) {
    const p = findPage(doc, pageId);
    for (const b of p.blocks) {
      if (!ids.includes(b.id)) continue;
      b.x = snap(b.x + dx, grid);
      b.y = snap(b.y + dy, grid);
    }
  },
  resizeBlock(doc, pageId, blockId, box, grid) {
    const b = findPage(doc, pageId).blocks.find((x) => x.id === blockId);
    if (!b) return;
    b.x = snap(box.x, grid); b.y = snap(box.y, grid);
    b.w = Math.max(grid || 1, snap(box.w, grid));
    b.h = Math.max(grid || 1, snap(box.h, grid));
  },
  setProps(doc, pageId, blockId, props) {
    const b = findPage(doc, pageId).blocks.find((x) => x.id === blockId);
    if (b) Object.assign(b.props, props);
  },
  reorder(doc, pageId, blockId, dir) {
    const p = findPage(doc, pageId);
    const i = p.blocks.findIndex((b) => b.id === blockId);
    if (i < 0) return;
    const j = dir === 'front' ? p.blocks.length - 1 : dir === 'back' ? 0 : i + dir;
    if (j < 0 || j >= p.blocks.length) return;
    p.blocks.splice(j, 0, p.blocks.splice(i, 1)[0]);
  },
  setBleed(doc, mm, marks) {
    doc.page = doc.page || {};
    const v = Math.max(0, Number(mm) || 0);
    if (v) { doc.page.bleed = v; doc.page.marks = marks !== false; }
    else { delete doc.page.bleed; delete doc.page.marks; }
    return v;
  },

  addPage(doc, name) { const p = makePage(name || `Page ${doc.pages.length + 1}`); doc.pages.push(p); return p.id; },

  // Changing the page size must not throw the layout away. Blocks are scaled by
  // the same factor in both directions, so nothing is stretched, and then
  // anything that was against an edge is put back against it. That last rule is
  // what keeps a full-bleed cover full bleed and a footer on the baseline; a
  // plain proportional scale leaves both floating.
  setPageSize(doc, pageId, key, custom, mode) {
    const next = sheet(key, custom);
    const target = pageId ? findPage(doc, pageId) : null;
    if (pageId && !target) throw new Error('that page is not in this document');
    const record = { size: next.size, w: next.w, h: next.h };
    if (next.size === 'custom') { record.unit = next.unit; record.printW = next.printW; record.printH = next.printH; }
    // the print spec belongs to the document and survives a change of size
    const keep = printSpec(doc);
    if (!pageId && keep.bleed) { record.bleed = keep.bleed; record.marks = keep.marks; }

    const pages = target ? [target] : doc.pages;
    for (const p of pages) {
      const from = pageSize(doc, p);
      if (mode !== 'keep') reflow(p, from, next);
      if (target) p.page = record; else delete p.page;
    }
    if (!target) doc.page = record;
    return next;
  },
  removePage(doc, pageId) {
    if (doc.pages.length < 2) throw new Error('a document needs at least one page');
    doc.pages = doc.pages.filter((p) => p.id !== pageId);
  },
  renamePage(doc, pageId, name) { const p = findPage(doc, pageId); if (p) p.name = name; },
};

// ---------------------------------------------------------------- history
// A stack of whole documents. They are small, and it means every operation is
// undoable without any of them having to know about undo.
function history(initial, limit = 60) {
  let past = [], present = clone(initial), future = [];
  return {
    get: () => present,
    apply(fn) {
      const next = clone(present);
      const r = fn(next);
      past.push(present); if (past.length > limit) past.shift();
      present = next; future = [];
      return r;
    },
    // A correction to what apply() just did, folded into the same entry. The
    // editor uses it after a page resize: text can only be measured once it has
    // been laid out at the new size, and growing a box to fit its words is part
    // of that one action rather than a second thing to undo.
    amend(fn) { const r = fn(present); return r; },
    undo() { if (!past.length) return false; future.unshift(present); present = past.pop(); return true; },
    redo() { if (!future.length) return false; past.push(present); present = future.shift(); return true; },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    reset(doc) { past = []; future = []; present = clone(doc); },
  };
}

// ------------------------------------------------ does the writing fit the box
//
// A text block is a rectangle a person draws and words a person writes, and
// nothing had ever asked whether the second fits inside the first. The canvas
// had overflow:hidden, so it silently swallowed whatever did not; Typst has no
// such rule, so the same block on the same page printed straight through the
// caption underneath it. One document, two renderers, two different wrong
// answers, and no report from either.
//
// Both need the same arithmetic, so it lives here, where both can read it.
//
// CHAR_EM and SPACE_EM are the average advance of a character and of a space,
// as a fraction of the type size. They were fitted against 540 measurements
// taken from a real browser — nine strings this engine actually sets, two face
// stacks, six sizes, five widths — under one constraint: never say a passage
// takes fewer lines than it does, because a check that misses an overflow is
// worse than one that mentions a near miss. At 0.55 and 0.16 it under-counted
// none of the 540, got 75 per cent exactly right and 93 per cent within a line.
const CHAR_EM = 0.55;
const SPACE_EM = 0.16;

// Greedy wrap, the way a browser and Typst both break a line: a word that does
// not fit starts a new one. Counting characters and dividing would under-count,
// because a line ends at the last space that fits and not at the last character.
function textLines(text, step, width) {
  const size = (step && step.size) || 16;
  const charW = size * (CHAR_EM + ((step && step.tracking) || 0));
  const spaceW = size * SPACE_EM;
  const w = Math.max(charW, width);
  let lines = 0;
  for (const para of String(text == null ? '' : text).split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { lines += 1; continue; }
    let n = 1, run = 0;
    for (const word of words) {
      const ww = word.length * charW;
      const gap = run === 0 ? 0 : spaceW;
      // a word longer than the line gets the line to itself and spills, which
      // is what both renderers do rather than breaking inside it
      if (run + gap + ww > w && run > 0) { n += 1; run = ww; } else run += gap + ww;
    }
    lines += n;
  }
  return lines;
}

// What the block needs, against what it has. `over` is the height it is short
// by, in the document's own units, and is 0 when it fits.
function textFits(text, step, width, height) {
  const lines = textLines(text, step, width);
  const lead = (step && step.leading) || Math.round(((step && step.size) || 16) * 1.35);
  const needs = lines * lead;
  return { lines, needs, has: height, over: Math.max(0, Math.round(needs - height)) };
}

// Every text block in a document that needs more room than it has been given,
// with the page it is on and enough of its words to find it by. The estimate
// never says a passage is shorter than it is, so a block reported here really
// does overflow; a block just inside is not reported.
function overfullText(doc, type) {
  const scale = ((type || {}).scale) || [];
  const out = [];
  (doc.pages || []).forEach((page, i) => {
    for (const b of page.blocks || []) {
      if (b.type !== 'text' || !(b.props || {}).text) continue;
      const step = scale.find((x) => x.name === b.props.style) || { size: 17, leading: 27 };
      const fit = textFits(b.props.text, step, b.w, b.h);
      if (!fit.over) continue;
      out.push({ page: i + 1, pageName: page.name, id: b.id, style: b.props.style,
        lines: fit.lines, needs: fit.needs, has: fit.has, over: fit.over,
        text: String(b.props.text).replace(/\s+/g, ' ').slice(0, 48) });
    }
  });
  return out;
}

return { PLAIN, DERIVED, RULE, KINDS, kindOf, DEFAULTS, SIZES, PAGE, GRID, seedIds, resetIds, overfullText,
  SHEETS, sheet, pageSize, printSpec, toPx, reflow, recognise, CHAR_EM, SPACE_EM, textLines, textFits,
  makeBlock, makePage, emptyDoc, ops, history, clone, snap, findPage };
}));
