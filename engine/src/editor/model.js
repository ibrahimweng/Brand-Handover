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

const PLAIN = ['text', 'rule', 'fill', 'slot'];
const DERIVED = ['mark', 'lockup', 'construction', 'clearSpace', 'minimumSize', 'palette', 'contrast', 'typeSpecimen', 'assetIndex'];
// Rule blocks are the third kind. One decision, made once, generating every
// instance after that. You place one and choose which instance to show; you
// never redraw it and you never restate the rule.
const RULE = ['pattern', 'iconGrid', 'motion'];
const KINDS = [...PLAIN, ...DERIVED, ...RULE];
const kindOf = (type) => (RULE.includes(type) ? 'rule' : DERIVED.includes(type) ? 'derived' : 'plain');

const PAGE = { w: 1280, h: 720 };
const GRID = 8;

let seq = 0;
const id = (p) => `${p}${(++seq).toString(36)}${Date.now().toString(36).slice(-3)}`;

const DEFAULTS = {
  text: { text: 'Double click to edit', style: 'body', align: 'left', colour: 'primary' },
  rule: { colour: 'primary', weight: 2 },
  fill: { colour: 'ground' },
  slot: { label: 'Image', ratio: '3:2' },
  mark: { colourway: 'primary', on: 'ground' },
  lockup: { lockup: 'horizontal', colourway: 'primary', on: 'ground' },
  construction: {}, clearSpace: {}, minimumSize: {},
  palette: {}, contrast: { limit: 6 }, typeSpecimen: {}, assetIndex: {},
  pattern: { density: 'medium', colourway: 'ground', on: 'primary', caption: false },
  iconGrid: { colourway: 'primary', on: 'ground', line: 'neutral', caption: true },
  motion: { colourway: 'ground', on: 'primary', caption: true },
};
const SIZES = {
  text: { w: 520, h: 120 }, rule: { w: 520, h: 2 }, fill: { w: 400, h: 260 },
  slot: { w: 420, h: 280 }, mark: { w: 300, h: 300 }, lockup: { w: 520, h: 200 },
  construction: { w: 380, h: 400 }, clearSpace: { w: 380, h: 400 }, minimumSize: { w: 640, h: 240 },
  palette: { w: 900, h: 260 }, contrast: { w: 820, h: 300 }, typeSpecimen: { w: 820, h: 300 },
  assetIndex: { w: 560, h: 320 },
  pattern: { w: 620, h: 280 }, iconGrid: { w: 560, h: 420 }, motion: { w: 360, h: 360 },
};

function makeBlock(type, at = {}) {
  if (!KINDS.includes(type)) throw new Error(`there is no block called "${type}"`);
  const s = SIZES[type];
  return {
    id: id('b'), type,
    x: at.x !== undefined ? at.x : Math.round((PAGE.w - s.w) / 2),
    y: at.y !== undefined ? at.y : Math.round((PAGE.h - s.h) / 2),
    w: at.w || s.w, h: at.h || s.h,
    props: Object.assign({}, DEFAULTS[type], at.props),
  };
}

const makePage = (name = 'Page') => ({ id: id('p'), name, blocks: [] });

const emptyDoc = (brand = 'Brand') => ({
  version: 1, brand,
  page: { w: PAGE.w, h: PAGE.h }, grid: GRID,
  pages: [makePage('Cover')],
});

// ---------------------------------------------------------------- operations
// Every change goes through here, so undo has one thing to record and the
// editor never mutates the document behind its own back.
const clone = (d) => JSON.parse(JSON.stringify(d));
const findPage = (doc, pageId) => doc.pages.find((p) => p.id === pageId);
const snap = (v, g) => (g ? Math.round(v / g) * g : Math.round(v));

const ops = {
  addBlock(doc, pageId, type, at) {
    const p = findPage(doc, pageId);
    if (!p) throw new Error('that page is not in this document');
    const b = makeBlock(type, at);
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
  addPage(doc, name) { const p = makePage(name || `Page ${doc.pages.length + 1}`); doc.pages.push(p); return p.id; },
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
    undo() { if (!past.length) return false; future.unshift(present); present = past.pop(); return true; },
    redo() { if (!future.length) return false; past.push(present); present = future.shift(); return true; },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    reset(doc) { past = []; future = []; present = clone(doc); },
  };
}

return { PLAIN, DERIVED, RULE, KINDS, kindOf, DEFAULTS, SIZES, PAGE, GRID,
  makeBlock, makePage, emptyDoc, ops, history, clone, snap, findPage };
}));
