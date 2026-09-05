'use strict';
/* A printed piece, laid out in the editor, written as Typst.

   This is the one place the plan was right about needing Typst. The logo assets
   are generated here and are already CMYK. The documents go through Chrome and
   are RGB, which is correct for what they are. What was left over is a piece
   laid out on the canvas that is going to a press: a poster, a cover, a card.

   The risk in writing a second emitter is that it drifts from the one on the
   canvas, and that risk is real. Two things hold it down. It handles a
   deliberately small set of blocks and refuses the rest by name, so there is
   nothing quietly half-drawn. And the mark is not re-drawn by hand but
   translated from the same path data the canvas uses, with the translation
   checked against the SVG renderer pixel by pixel — see src/paths.js and
   test/typst-check.mjs.

   Why translate at all: Typst places an SVG as vector but paints it in RGB, so
   an embedded mark would arrive on a CMYK page in a different colour space and
   the press would convert it however it liked. That is the exact thing the
   print path exists to prevent. */
const paths = require('./paths');
const cmykMod = require('./cmyk');
const PR = require('./print');
const svgu = require('./svg');

const PT = 0.75;                          // one CSS pixel, in points
const pt = (v) => `${Math.round(v * PT * 1e3) / 1e3}pt`;
// A Typst string, not a markup block. Markup would read *stars* as bold and
// _underscores_ as italic, so a line of copy would come out of the press
// styled differently from the same line on the canvas — which is the exact
// drift two emitters are supposed to be prevented from having.
const str = (s) => '"' + String(s == null ? '' : s)
  .replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '').replace(/\n/g, '\\n') + '"';
// identifiers and font names, which are quoted but never markup
const esc = (s) => String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

// What a printed piece is made of. Everything else is manual furniture and is
// refused rather than approximated.
const HANDLED = ['fill', 'rule', 'text', 'mark', 'lockup', 'slot', 'pattern'];

// ---------------------------------------------------------------- colour
// A colour arrives here as a role name, a colour name, or the raw hex the
// artwork was painted in. All three have to find the same ink, or a mark drawn
// in a declared colourway lands on the page in RGB.
function inkTable(bundle) {
  if (!bundle.__ink) {
    const list = cmykMod.table(bundle.colours || {});
    bundle.__ink = { byName: cmykMod.byName(list), byHex: {} };
    for (const c of list) bundle.__ink.byHex[c.hex.toUpperCase()] = c;
  }
  return bundle.__ink;
}

function inkOf(bundle, key) {
  const t = inkTable(bundle);
  if (/^#/.test(key)) return t.byHex[key.toUpperCase()] || null;
  const name = ((bundle.roles || {})[key] && bundle.roles[key].name) || key;
  return t.byName[name] || null;
}

// Declared ink where there is any, and the screen colour where there is not —
// which is then reported, because a press converting an RGB patch on a CMYK
// page is the uncontrolled conversion this whole path exists to avoid.
function colour(bundle, key, seen) {
  if (!key || key === 'none') return null;
  const ink = inkOf(bundle, key);
  if (ink && ink.declared) return `cmyk(${ink.values.map((v) => v + '%').join(', ')})`;
  const hex = /^#/.test(key) ? key
    : ((bundle.roles || {})[key] || {}).hex || ((bundle.colours || {})[key] || {}).hex || key;
  if (seen && /^#[0-9a-f]{6}$/i.test(hex)) seen.add(hex);
  return `rgb("${hex}")`;
}

const strokeHexOf = (el) => (el.match(/stroke="([^"]+)"/) || [])[1];
const fillHexOf = (el) => (el.match(/fill="([^"]+)"/) || [])[1];

// ------------------------------------------------------------------ artwork
// The mark, redrawn. Every shape in the artwork becomes one Typst curve, with
// the path data translated to move/line/cubic and the paint taken from the
// artwork itself, so a colourway is honoured exactly as it was on the canvas.
function artwork(svg, box, bundle, seen) {
  const doc = svgu.parse(svg);
  const vb = svgu.viewBox(doc);
  const k = Math.min(box.w / vb.w, box.h / vb.h);          // fitted, never distorted
  const offX = box.x + (box.w - vb.w * k) / 2;
  const offY = box.y + (box.h - vb.h * k) / 2;
  // the whole drawing, into the box it was given
  const place = paths.multiply([k, 0, 0, k, offX - vb.x * k, offY - vb.y * k], paths.IDENTITY);

  const out = [];
  const PAINT = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin'];

  // A lockup is a composition, so its parts sit inside transformed groups and
  // inherit their paint from them. Scraping the paths out on their own draws
  // them in the wrong place in the wrong colour, which is the same lesson the
  // icon check learned the hard way.
  (function walk(node, matrix, paint) {
    if (node.nodeType !== 1) return;
    const local = node.nodeName.replace(/^.*:/, '');
    const own = {};
    for (const a of PAINT) { const v = node.getAttribute(a); if (v != null && v !== '') own[a] = v.trim(); }
    const here = Object.assign({}, paint, own);
    const m = node.getAttribute('transform')
      ? paths.multiply(matrix, paths.parseTransform(node.getAttribute('transform')))
      : matrix;

    if (local === 'path') {
      const d = node.getAttribute('d');
      if (d) {
        const segs = paths.transformSegs(paths.parse(d), m);
        const scale = paths.scaleOf(m);
        const fill = here.fill, stroke = here.stroke;
        const w = Number(here['stroke-width'] || 1) * scale;
        const parts = segs.map((sg) =>
          sg.op === 'move' ? `curve.move((${pt(sg.to[0])}, ${pt(sg.to[1])}))`
            : sg.op === 'line' ? `curve.line((${pt(sg.to[0])}, ${pt(sg.to[1])}))`
              : sg.op === 'cubic' ? `curve.cubic((${pt(sg.c1[0])}, ${pt(sg.c1[1])}), (${pt(sg.c2[0])}, ${pt(sg.c2[1])}), (${pt(sg.to[0])}, ${pt(sg.to[1])}))`
                : 'curve.close()');
        // an unset fill paints black, exactly as it does in a browser
        const fillCss = fill === undefined ? colour(bundle, '#000000', seen)
          : fill === 'none' ? 'none' : colour(bundle, fill, seen);
        const strokeCss = stroke && stroke !== 'none'
          ? `${pt(w)} + ${colour(bundle, stroke, seen)}` : 'none';
        out.push(`#place(dx: 0pt, dy: 0pt, curve(\n  fill: ${fillCss},\n  stroke: ${strokeCss},\n`
          + `  ${parts.join(',\n  ')},\n))`);
      }
    }
    for (let c = node.firstChild; c; c = c.nextSibling) walk(c, m, here);
  }(doc.documentElement, place, {}));

  return out.join('\n');
}

// ------------------------------------------------------------------ blocks
function blockSource(b, geom, bundle, ctx) {
  const at = (body) => `#place(dx: ${pt(geom.x)}, dy: ${pt(geom.y)}, ${body})`;
  switch (b.type) {
    case 'fill': {
      const c = colour(bundle, b.props.colour, ctx.seen);
      return at(`rect(width: ${pt(geom.w)}, height: ${pt(geom.h)}, fill: ${c}, stroke: none)`);
    }
    case 'rule': {
      const c = colour(bundle, b.props.colour, ctx.seen);
      return at(`rect(width: ${pt(geom.w)}, height: ${pt(b.props.weight || 2)}, fill: ${c}, stroke: none)`);
    }
    case 'text': {
      const step = ((bundle.type || {}).scale || []).find((s) => s.name === b.props.style)
        || { size: 17, leading: 27, weight: 400, family: 'text' };
      const fam = ((bundle.type || {}).families || {})[step.family] || {};
      if (fam.family) ctx.fonts.add(fam.family);
      const c = colour(bundle, b.props.colour, ctx.seen);
      const align = { left: 'left', center: 'center', right: 'right' }[b.props.align] || 'left';
      return at(`box(width: ${pt(geom.w)}, height: ${pt(geom.h)}, align(${align} + top, [`
        + `#set par(leading: ${pt(step.leading - step.size)}); `
        + `#text(font: "${esc(fam.family || 'Libertinus Serif')}", size: ${pt(step.size)}, `
        + `weight: ${step.weight || 400}, fill: ${c}, `
        + `tracking: ${pt((step.tracking || 0) * step.size)}, ${str(b.props.text || '')})`
        + `]))`);
    }
    case 'mark':
    case 'lockup': {
      // The colourway a block asks for need not exist: nothing says a project
      // cuts one named after each colour role, and this quietly dropped a
      // lockup out of a printed piece until a second project turned up that
      // does not. Falling back beats a hole in the page.
      const want = ((bundle.roles || {})[b.props.colourway] || {}).name || b.props.colourway;
      const pool = b.type === 'mark' ? (bundle.marks || {}) : (bundle.variants || {});
      const key = b.type === 'mark' ? want : `${b.props.lockup || 'horizontal'}:${want}`;
      const svg = pool[key]
        || (b.type === 'lockup' && pool[Object.keys(pool).find((k) => k.startsWith(`${b.props.lockup || 'horizontal'}:`))])
        || Object.values(pool)[0];
      if (!svg) return null;
      const ground = colour(bundle, b.props.on, ctx.seen);
      const pad = b.type === 'mark' ? 14 : 16;
      const inner = { x: geom.x + pad, y: geom.y + pad, w: geom.w - pad * 2, h: geom.h - pad * 2 };
      return (ground ? at(`rect(width: ${pt(geom.w)}, height: ${pt(geom.h)}, fill: ${ground}, stroke: none)`) + '\n' : '')
        + artwork(svg, inner, bundle, ctx.seen);
    }
    case 'pattern': {
      const t = (bundle.patternTiles || {})[`${b.props.density || 'medium'}:${b.props.colourway || 'ground'}`];
      if (!t) return null;
      const ground = colour(bundle, b.props.on, ctx.seen);
      const tile = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t.width} ${t.height}">${t.body}</svg>`;
      const cols = Math.ceil(geom.w / t.width), rows = Math.ceil(geom.h / t.height);
      const out = [at(`rect(width: ${pt(geom.w)}, height: ${pt(geom.h)}, fill: ${ground}, stroke: none)`)];
      // laid out tile by tile, because Typst has no repeating fill and the
      // alternative is an SVG, which would arrive in the wrong colour space
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          out.push(artwork(tile, { x: geom.x + c * t.width, y: geom.y + r * t.height, w: t.width, h: t.height }, bundle, ctx.seen));
        }
      }
      return `#block(clip: true, width: ${pt(geom.w)}, height: ${pt(geom.h)})[]\n` + out.join('\n');
    }
    case 'slot': {
      const im = (bundle.images || {})[b.props.image];
      if (!im) return null;
      const name = `image-${b.props.image}.${im.src.includes('image/png') ? 'png' : im.src.includes('svg') ? 'svg' : 'jpg'}`;
      ctx.files[name] = Buffer.from(im.src.split(',')[1] || '', 'base64');
      ctx.rasterColour = true;
      const fit = b.props.fit === 'contain' ? 'contain' : 'cover';
      return at(`box(width: ${pt(geom.w)}, height: ${pt(geom.h)}, clip: true, `
        + `image("${name}", width: ${pt(geom.w)}, height: ${pt(geom.h)}, fit: "${fit}"))`);
    }
    default: return null;
  }
}

// ------------------------------------------------------------------- pages
function emit(doc, bundle, opts) {
  const o = opts || {};
  const M = require('./editor/model');
  const spec = M.printSpec(doc);
  const ctx = { files: {}, fonts: new Set(), seen: new Set(), rasterColour: false };
  const refused = [];
  const chunks = [];

  doc.pages.forEach((page, i) => {
    const sheet = M.pageSize(doc, page);
    const box = PR.boxes(sheet, spec);
    chunks.push(`${i ? '#pagebreak()\n' : ''}#set page(width: ${pt(box.media.w)}, height: ${pt(box.media.h)}, `
      + `margin: 0pt, fill: ${colour(bundle, 'ground', ctx.seen) || 'white'})`);

    for (const b of page.blocks) {
      if (HANDLED.indexOf(b.type) < 0) {
        refused.push({ page: i + 1, type: b.type, name: page.name });
        continue;
      }
      const bled = PR.bleedBox(b, sheet, box) || b;
      const geom = { x: bled.x + box.offset, y: bled.y + box.offsetY, w: bled.w, h: bled.h };
      const src = blockSource(b, geom, bundle, ctx);
      if (src) chunks.push(src);
      else refused.push({ page: i + 1, type: b.type, name: page.name, why: 'nothing to draw' });
    }
    if (box.marks) chunks.push(marksSource(box));
  });

  const head = `// ${bundle.brand} — generated by handover, do not edit\n`
    + `// Every colour with a declared build is written as ink. See src/cmyk.js.\n`
    + `#set text(fallback: true)\n`;
  return {
    source: head + chunks.join('\n') + '\n',
    files: ctx.files,
    fonts: [...ctx.fonts],
    refused,
    screenColours: [...ctx.seen],
    rasterColour: ctx.rasterColour,
  };
}

// the same marks print.js computes, drawn as Typst rules
function marksSource(box) {
  const w = box.weight, L = Math.min(box.markLen, Math.min(box.offset, box.offsetY) - box.bleed);
  if (L <= 0) return '';
  const t = box.trim, ox = box.offset, oy = box.offsetY, gap = box.bleed;
  const out = [];
  const line = (x, y, len, dir) => out.push(
    `#place(dx: ${pt(x)}, dy: ${pt(y)}, rect(width: ${dir === 'h' ? pt(len) : pt(w)}, `
    + `height: ${dir === 'h' ? pt(w) : pt(len)}, fill: cmyk(0%, 0%, 0%, 100%), stroke: none))`);
  for (const x of [ox, ox + t.w]) {
    line(x, oy - gap - L, L, 'v');
    line(x, oy + t.h + gap, L, 'v');
  }
  for (const y of [oy, oy + t.h]) {
    line(ox - gap - L, y, L, 'h');
    line(ox + t.w + gap, y, L, 'h');
  }
  return out.join('\n');
}

module.exports = { emit, artwork, colour, HANDLED, PT };
