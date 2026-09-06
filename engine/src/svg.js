'use strict';
// Minimal SVG document handling. The engine only ever needs to read a viewBox,
// recolour elements that carry a data-slot, and place documents inside a new one.
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');

const NS = 'http://www.w3.org/2000/svg';

function parse(str) {
  const doc = new DOMParser({ onError: () => {} }).parseFromString(str, 'image/svg+xml');
  if (!doc || !doc.documentElement) throw new Error('could not parse the SVG');
  return doc;
}

const serialize = (node) => new XMLSerializer().serializeToString(node);

function viewBox(doc) {
  const root = doc.documentElement || doc;
  const vb = root.getAttribute('viewBox');
  if (vb) {
    const n = vb.trim().split(/[\s,]+/).map(Number);
    if (n.length === 4 && n.every(Number.isFinite)) {
      return { x: n[0], y: n[1], w: n[2], h: n[3] };
    }
  }
  const w = parseFloat(root.getAttribute('width'));
  const h = parseFloat(root.getAttribute('height'));
  if (Number.isFinite(w) && Number.isFinite(h)) return { x: 0, y: 0, w, h };
  throw new Error('the SVG has no viewBox and no width/height, so it cannot be measured');
}

function walk(node, fn) {
  if (node.nodeType === 1) fn(node);
  for (let c = node.firstChild; c; c = c.nextSibling) walk(c, fn);
}

// Paint every element carrying data-slot with that slot's colour. A value of
// "none" is left alone, because it means the element deliberately has no paint.
// Elements that hold artwork without drawing it. A clipPath describes a shape
// whose job is to hide other shapes; a symbol is a stencil. Three separate
// walkers here each had their own idea of this, or none: the printed piece drew
// a clipping rectangle onto the page, and the colour pass snapped that same
// rectangle's white to a brand colour and gave it a brand colour slot.
const NEVER_DRAWN = ['defs', 'clippath', 'mask', 'symbol', 'marker', 'pattern',
  'metadata', 'title', 'desc', 'style'];

const drawn = (el) => NEVER_DRAWN.indexOf(String(el.nodeName).replace(/^.*:/, '').toLowerCase()) < 0;

// walk, but only through what actually reaches the page
function eachPainted(doc, fn) {
  (function step(n) {
    if (n.nodeType !== 1 || !drawn(n)) return;
    fn(n);
    for (let c = n.firstChild; c; c = c.nextSibling) step(c);
  }(doc.documentElement));
}

// "keep" leaves a slot painted as the master drew it. A gradient is the reason
// it exists: a colourway names one colour per slot, a gradient is not one
// colour, and writing the nearest hex silently threw the gradient away in every
// file the package contained — including the one colourway whose whole job was
// to carry it. It is spelled the same way `fill="none"` behaves: the artwork's
// own paint is a decision, and the engine does not overrule it.
const KEEP = 'keep';

function applyColourway(doc, slots) {
  const missing = new Set();
  const kept = new Set();
  walk(doc.documentElement, (el) => {
    const slot = el.getAttribute && el.getAttribute('data-slot');
    if (!slot) return;
    const colour = slots[slot];
    if (colour === undefined) { missing.add(slot); return; }
    if (colour === KEEP) { kept.add(slot); return; }
    // A shape with no fill attribute is not unfilled: SVG paints it black. The
    // cleaner removes fill="#000000" precisely because it is the default, so a
    // mark drawn in plain black arrived here with nothing to repaint and came
    // out black in every colourway, silently, with nothing reported. Black is
    // the commonest colour a logo is drawn in.
    const fill = el.getAttribute('fill');
    if (fill !== 'none') el.setAttribute('fill', colour);
    // a stroke is only repainted where there is one: adding one would redraw
    // the artwork rather than recolour it
    const stroke = el.getAttribute('stroke');
    if (stroke && stroke !== 'none') el.setAttribute('stroke', colour);
  });
  // whatever paint is left unreferenced after repainting is dead markup, and it
  // travelled into every SVG and every PDF in the package
  dropUnusedPaint(doc);
  return { missing: [...missing], kept: [...kept] };
}

// A <linearGradient>, <radialGradient> or <pattern> nothing points at any more.
// Nine files shipped carrying a gradient definition that no shape referenced,
// because repainting a slot rewrites the fill and leaves the defs alone.
function dropUnusedPaint(doc) {
  const used = new Set();
  walk(doc.documentElement, (el) => {
    if (!el.getAttribute) return;
    for (const a of ['fill', 'stroke', 'filter', 'mask', 'clip-path']) {
      const v = el.getAttribute(a);
      const m = v && /^url\(#([^)]+)\)$/.exec(v.trim());
      if (m) used.add(m[1]);
    }
    // a gradient can inherit its stops from another one
    const href = el.getAttribute('href') || el.getAttribute('xlink:href');
    if (href && href.startsWith('#')) used.add(href.slice(1));
  });
  const dead = [];
  walk(doc.documentElement, (el) => {
    const tag = el.nodeName && el.nodeName.toLowerCase();
    if (tag !== 'lineargradient' && tag !== 'radialgradient' && tag !== 'pattern') return;
    const id = el.getAttribute && el.getAttribute('id');
    if (id && !used.has(id)) dead.push(el);
  });
  for (const el of dead) if (el.parentNode) el.parentNode.removeChild(el);
  // and an empty <defs> left behind by the above
  const empties = [];
  walk(doc.documentElement, (el) => {
    if (el.nodeName && el.nodeName.toLowerCase() === 'defs'
      && !Array.from(el.childNodes || []).some((n) => n.nodeType === 1)) empties.push(el);
  });
  for (const el of empties) if (el.parentNode) el.parentNode.removeChild(el);
  return dead.length;
}

// Slots the artwork paints with a gradient rather than a flat colour. A
// colourway names one colour per slot, so these are the slots where naming one
// throws the gradient away, and the only slots "keep" is really for.
function gradientSlots(doc) {
  const grad = new Set();
  walk(doc.documentElement, (el) => {
    const tag = el.nodeName && el.nodeName.toLowerCase();
    if (tag !== 'lineargradient' && tag !== 'radialgradient') return;
    const id = el.getAttribute && el.getAttribute('id');
    if (id) grad.add(id);
  });
  const found = new Set();
  if (!grad.size) return [];
  walk(doc.documentElement, (el) => {
    const slot = el.getAttribute && el.getAttribute('data-slot');
    if (!slot) return;
    for (const a of ['fill', 'stroke']) {
      const v = el.getAttribute(a);
      const m = v && /^url\(#([^)]+)\)$/.exec(v.trim());
      if (m && grad.has(m[1])) found.add(slot);
    }
  });
  return [...found];
}

// The gradients the artwork actually paints with, read off the artwork: which
// slot each one fills, and the stops in order. The manual quotes these rather
// than a number somebody typed, the same as every other measurement here.
function gradients(doc) {
  const byId = new Map();
  walk(doc.documentElement, (el) => {
    const tag = el.nodeName && el.nodeName.toLowerCase();
    if (tag !== 'lineargradient' && tag !== 'radialgradient') return;
    const id = el.getAttribute && el.getAttribute('id');
    if (!id) return;
    const stops = [];
    for (const n of Array.from(el.childNodes || [])) {
      if (n.nodeType !== 1 || String(n.nodeName).toLowerCase() !== 'stop') continue;
      const style = n.getAttribute('style') || '';
      const inline = /stop-color\s*:\s*([^;]+)/.exec(style);
      stops.push({
        offset: n.getAttribute('offset') == null ? null : Number(n.getAttribute('offset')),
        hex: (n.getAttribute('stop-color') || (inline && inline[1]) || '').trim() || null,
      });
    }
    byId.set(id, { id, kind: tag === 'lineargradient' ? 'linear' : 'radial', stops, slots: [] });
  });
  if (!byId.size) return [];
  walk(doc.documentElement, (el) => {
    const slot = el.getAttribute && el.getAttribute('data-slot');
    if (!slot) return;
    for (const a of ['fill', 'stroke']) {
      const v = el.getAttribute(a);
      const m = v && /^url\(#([^)]+)\)$/.exec(v.trim());
      if (m && byId.has(m[1]) && byId.get(m[1]).slots.indexOf(slot) < 0) byId.get(m[1]).slots.push(slot);
    }
  });
  return [...byId.values()].filter((g) => g.slots.length);
}

// Every colour the artwork paints a slot with. A flat slot has one; a slot
// filled with a gradient has one per stop. This is what "keep" means, so the
// build, the manual and the deck all resolve it here rather than each keeping
// their own idea of what the master paints.
function paintBySlot(docs) {
  const out = new Map();
  const add = (slot, hex) => {
    if (!slot || !hex || hex === 'none') return;
    if (!out.has(slot)) out.set(slot, []);
    if (out.get(slot).indexOf(hex) < 0) out.get(slot).push(hex);
  };
  for (const doc of [].concat(docs)) {
    if (!doc) continue;
    for (const g of gradients(doc)) {
      for (const sl of g.slots) for (const st of g.stops) add(sl, st.hex);
    }
    eachPainted(doc, (el) => {
      if (!el.getAttribute) return;
      const sl = el.getAttribute('data-slot');
      for (const a of ['fill', 'stroke']) {
        const v = el.getAttribute(a);
        if (v && !/^url\(/.test(v.trim())) add(sl, v.trim());
      }
    });
  }
  return out;
}

function slotsUsed(doc) {
  const found = new Set();
  walk(doc.documentElement, (el) => {
    const s = el.getAttribute && el.getAttribute('data-slot');
    if (s) found.add(s);
  });
  return [...found];
}

// Every distinct stroke-width painted in the document, thinnest first. A mark
// drawn in one weight has one entry, and most do; a mark with a hierarchy of
// weights has several, and which of them a derived system inherits is then a
// question rather than a lookup.
function strokeWidths(doc) {
  const found = new Set();
  const tag = (el) => String(el.nodeName).replace(/^.*:/, '').toLowerCase();
  // stroke and stroke-width both inherit, and a mark that puts the colour on the
  // group and the widths on the paths — which is how anyone draws a mark in one
  // colour and two weights — had neither attribute on the same element as the
  // other. Both readings came back empty, so the engine said "measured off the
  // artwork" about a file that states its widths in so many words. Three of the
  // fixtures were drawn that way and none of them ever reported a stroke.
  const step = (el, stroke, width) => {
    if (el.nodeType !== 1 || !drawn(el)) return;      // a <defs> subtree paints nothing
    const s = el.getAttribute('stroke') || stroke;
    // an inherited stroke-width of 0 is a real answer and means "no stroke here":
    // reading only widths above zero let a group that switched its stroke off
    // fall back to SVG's default of 1, and every filled shape under it was then
    // reported as a 1 unit hairline that decided the whole minimum size.
    const own = parseFloat(el.getAttribute('stroke-width'));
    const w = Number.isFinite(own) && own >= 0 ? own : width;
    const container = tag(el) === 'g' || tag(el) === 'svg';
    if (s && s !== 'none' && w > 0 && !container) found.add(w);
    for (let c = el.firstChild; c; c = c.nextSibling) step(c, s, w);
  };
  step(doc.documentElement, null, 1);   // SVG's own default stroke-width is 1
  return [...found].sort((a, b) => a - b);
}

// Smallest stroke-width painted anywhere in the document. This is what decides
// the minimum size, because it is the first thing to disappear.
function thinnestStroke(doc) {
  const all = strokeWidths(doc);
  return all.length ? all[0] : null;
}

const innerXML = (doc) => {
  let out = '';
  for (let c = doc.documentElement.firstChild; c; c = c.nextSibling) out += serialize(c);
  return out;
};

// Place already-measured documents into one new SVG.
// Each part: { doc, box (ink box in its own user units), x, y, scale }
function compose(parts, width, height) {
  const body = parts.map((p) => {
    const tx = p.x - p.box.x * p.scale;
    const ty = p.y - p.box.y * p.scale;
    return `<g transform="translate(${round(tx)} ${round(ty)}) scale(${round(p.scale, 6)})">${innerXML(p.doc)}</g>`;
  }).join('');
  return `<svg xmlns="${NS}" viewBox="0 0 ${round(width)} ${round(height)}" width="${round(width)}" height="${round(height)}">${body}</svg>`;
}

const round = (n, dp = 3) => Number(n.toFixed(dp));

module.exports = { KEEP, dropUnusedPaint, gradientSlots, gradients, paintBySlot, parse, serialize, viewBox, applyColourway, slotsUsed, thinnestStroke,
  strokeWidths, innerXML, compose, round, NS, eachPainted, NEVER_DRAWN };
