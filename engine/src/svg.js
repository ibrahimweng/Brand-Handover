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

function applyColourway(doc, slots) {
  const missing = new Set();
  walk(doc.documentElement, (el) => {
    const slot = el.getAttribute && el.getAttribute('data-slot');
    if (!slot) return;
    const colour = slots[slot];
    if (colour === undefined) { missing.add(slot); return; }
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
  return [...missing];
}

function slotsUsed(doc) {
  const found = new Set();
  walk(doc.documentElement, (el) => {
    const s = el.getAttribute && el.getAttribute('data-slot');
    if (s) found.add(s);
  });
  return [...found];
}

// Smallest stroke-width painted anywhere in the document. This is what decides
// the minimum size, because it is the first thing to disappear.
function thinnestStroke(doc) {
  let min = Infinity;
  walk(doc.documentElement, (el) => {
    if (!el.getAttribute) return;
    const stroke = el.getAttribute('stroke');
    if (!stroke || stroke === 'none') return;
    const w = parseFloat(el.getAttribute('stroke-width'));
    if (Number.isFinite(w) && w > 0 && w < min) min = w;
  });
  return Number.isFinite(min) ? min : null;
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

module.exports = { parse, serialize, viewBox, applyColourway, slotsUsed, thinnestStroke, innerXML, compose, round, NS, eachPainted, NEVER_DRAWN };
