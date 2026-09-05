'use strict';
// The brand pattern. A rule block: the designer decides once that the pattern
// is a particular shape from the mark, repeated in offset rows, and after that
// the system cuts every tile, density and colourway from that one decision.
//
// Which shape is the decision, so the designer marks it in the master with
// data-pattern="source". Nothing here guesses.
const svgu = require('./svg');
const geo = require('./geometry');

function findSource(markSource) {
  const doc = svgu.parse(markSource);
  let hit = null;
  (function walk(n) {
    if (hit) return;
    if (n.nodeType === 1 && n.getAttribute && n.getAttribute('data-pattern') === 'source') { hit = n; return; }
    for (let c = n.firstChild; c; c = c.nextSibling) walk(c);
  }(doc.documentElement));
  return { doc, node: hit, viewBox: svgu.viewBox(doc) };
}

// Measure the marked shape on its own, so the tile is built from its real
// bounds rather than the whole mark's.
// a small stable hash, so a tile's id depends on the tile and nothing else
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h | 0;
}

function sourceGeometry(markSource) {
  const { node, viewBox } = findSource(markSource);
  if (!node) {
    return { ok: false, why: 'Nothing in the master is marked as the pattern source.',
      how: 'Add data-pattern="source" to the shape the pattern should be built from. It is a decision, so the engine will not pick one for you.' };
  }
  const alone = `<svg xmlns="${svgu.NS}" viewBox="${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}">`
    + svgu.serialize(node) + `</svg>`;
  return { ok: true, node, viewBox, box: geo.inkBox(alone), markup: svgu.serialize(node) };
}

// A tile that repeats seamlessly in both directions. Two rows, the second
// shifted by the phase, so the field reads as movement rather than as stripes.
function tile(markSource, rules, colour) {
  const g = sourceGeometry(markSource);
  if (!g.ok) return g;

  const T = rules.tile;
  const gap = T * rules.rowSpacing;
  const height = gap * 2;
  const shift = T * rules.phase;
  const scale = T / g.box.w;

  // place the shape with its own left edge at x, its middle on the row
  const place = (x, y) =>
    `<g transform="translate(${svgu.round(x - g.box.x * scale)} ${svgu.round(y - (g.box.y + g.box.h / 2) * scale)}) scale(${svgu.round(scale, 6)})">`
    // Strip every way of saying paint, not just fill and stroke: the source
    // shape's own stroke-width and stroke-linecap survived the first version,
    // so the tile came out with the attribute written twice — which is not
    // valid SVG, and no renderer would open the nine files it wrote. The
    // duplicate stroke-width also overrode the weight the pattern rules set.
    + g.markup.replace(/\s(?:fill|stroke)(?:-[a-z-]+)?="[^"]*"/g, '')
        .replace(/\sxmlns="[^"]*"/g, '')
        .replace(/<(\w+)/, `<$1 fill="none" stroke="${colour}" stroke-width="${svgu.round(rules.weight / scale, 3)}" stroke-linecap="${rules.cap}"`)
    + `</g>`;

  const body = [place(0, gap / 2), place(-shift, gap * 1.5), place(T - shift, gap * 1.5)].join('');
  return { ok: true, height: svgu.round(height), width: T,
    svg: `<svg xmlns="${svgu.NS}" viewBox="0 0 ${T} ${svgu.round(height)}" width="${T}" height="${svgu.round(height)}">${body}</svg>`,
    body };
}

// The same tile at every density, in every colourway the rules allow. A
// colourway that fails contrast on its ground is refused rather than drawn.
function everyTile(markSource, rules, colourways, contrastPairs) {
  const out = [], refused = [];
  for (const [density, factor] of Object.entries(rules.densities)) {
    const scaled = Object.assign({}, rules, { tile: svgu.round(rules.tile * factor), weight: svgu.round(rules.weight * factor, 2) });
    for (const cw of colourways) {
      const pair = contrastPairs && contrastPairs.find(
        (p) => (p.fgHex === cw.ink && p.bgHex === cw.on) || (p.fgHex === cw.on && p.bgHex === cw.ink));
      if (pair && pair.level === 'fail') {
        refused.push({ density, colourway: cw.name, ratio: pair.ratio,
          why: `${cw.name} measures ${pair.ratio}:1 against its ground, so the pattern would not be visible.` });
        continue;
      }
      const t = tile(markSource, scaled, cw.ink);
      if (!t.ok) return t;
      out.push({ density, colourway: cw.name, ink: cw.ink, on: cw.on, tile: t.svg, body: t.body, width: t.width, height: t.height });
    }
  }
  return { ok: true, tiles: out, refused };
}

// A patch of pattern for a document or the editor, using the tile as a fill.
function swatch(markSource, rules, ink, on, w, h, id) {
  const t = tile(markSource, rules, ink);
  if (!t.ok) return null;
  // a random id makes the same pattern a different file every time it is written
  const pid = 'pat-' + (id || ('t' + Math.abs(hash(String(rules.tile) + rules.weight + colour)).toString(36)));
  return `<svg xmlns="${svgu.NS}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:100%;display:block">`
    + `<defs><pattern id="${pid}" width="${t.width}" height="${t.height}" patternUnits="userSpaceOnUse">${t.body}</pattern></defs>`
    + `<rect width="${w}" height="${h}" fill="${on}"/><rect width="${w}" height="${h}" fill="url(#${pid})"/></svg>`;
}

module.exports = { findSource, sourceGeometry, tile, everyTile, swatch };
