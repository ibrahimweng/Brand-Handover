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
const PH = require('./photography');
const exp = require('./export');

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

// A gradient, said in Typst. `colour()` above answers with rgb("...") whatever
// it is given, so a fill of url(#a) came out as rgb("url(#a)") — which Typst
// refuses outright: "color string contains non-hexadecimal letters". Nothing
// noticed, because the only page this path ever compiled was Meridian's and
// every mark in the repo was flat.
//
// Typst's answer is gradient.linear, and it runs the ramp across the element's
// own box along an angle. Two things follow, and both were got wrong.
//
// The box has to be the shape. Every curve here used to be placed at the page
// origin with the page coordinates written into it, so Typst sized the element
// from the corner of the paper to the far edge of the mark. The ramp was drawn
// across that, which made the mark's colour a function of where on the page it
// sat: the same mark, the same size, four corners of one page, came out four
// different colourways — 98.6 of 255 apart at the worst, against 0.00 for every
// flat mark in the repository. Each shape is placed at its own box now.
//
// And an angle is not an axis. SVG runs the ramp between two named points,
// which is not corner to corner: Vesper's runs (0.06,0.04) to (0.82,0.96) of
// the shape, and Pagrin's is in user space and runs well outside it. Typst has
// no way to say that, so the stops are moved instead — each one to where it
// falls across the box the ramp is drawn on — and the ends are the colour the
// artwork holds there, which is what `pad` means.
const HEX = (v) => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(v || '').trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const mix = (a, b, t) => '#' + a.map((v, i) =>
  Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('');

// The stops as SVG reads them: a missing offset is 0, and an offset never goes
// backwards — the renderer clamps it to the one before rather than reordering.
function stopsOf(g) {
  const out = [];
  let last = 0;
  for (const st of g.stops) {
    const raw = st.offset == null ? 0 : Number(st.offset);
    const o = Math.min(1, Math.max(last, isFinite(raw) ? raw : 0));
    last = o;
    out.push({ o, rgb: HEX(st.hex), hex: st.hex });
  }
  return out.every((s) => s.rgb) ? out : null;
}

// what the artwork paints at one point along its ramp, pad at both ends
function rampAt(stops, o) {
  if (o <= stops[0].o) return stops[0].hex;
  const last = stops[stops.length - 1];
  if (o >= last.o) return last.hex;
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1], b = stops[i];
    if (o > b.o) continue;
    return b.o === a.o ? b.hex : mix(a.rgb, b.rgb, (o - a.o) / (b.o - a.o));
  }
  return last.hex;
}

function gradientFill(g, bundle, seen, ctx) {
  if (!g || g.kind !== 'linear') return null;
  // a gradient with a transform of its own is refused, not approximated
  if (g.gradientTransform) return null;
  const stops = stopsOf(g);
  if (!stops || !stops.length) return null;
  const box = ctx && ctx.box;
  if (!box || !(box.w > 0) || !(box.h > 0)) return null;

  // where the ramp runs, in the coordinates the shape is drawn in
  const a = g.axis || {};
  const n = (raw, d, span) => {
    if (raw == null || raw === '') return d;
    const v = Number(String(raw).replace('%', ''));
    if (!isFinite(v)) return d;
    return String(raw).includes('%') ? (v / 100) * span : v;
  };
  let p1, p2;
  if (g.units === 'userSpaceOnUse') {
    const vb = ctx.vb || { w: 1, h: 1 };
    p1 = paths.applyTo(ctx.m, [n(a.x1, 0, vb.w), n(a.y1, 0, vb.h)]);
    p2 = paths.applyTo(ctx.m, [n(a.x2, vb.w, vb.w), n(a.y2, 0, vb.h)]);
  } else {
    const f = (raw, d) => n(raw, d, 1);
    p1 = [box.x + f(a.x1, 0) * box.w, box.y + f(a.y1, 0) * box.h];
    p2 = [box.x + f(a.x2, 1) * box.w, box.y + f(a.y2, 0) * box.h];
  }
  const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
  const len = Math.hypot(dx, dy);
  if (!(len > 0)) return null;               // a ramp with no length is one colour
  const ux = dx / len, uy = dy / len;

  // how far along that line the box reaches. Typst puts 0% at one end of this
  // and 100% at the other, so this is the window the artwork is seen through.
  const at = (x, y) => (x - p1[0]) * ux + (y - p1[1]) * uy;
  const ends = [at(box.x, box.y), at(box.x + box.w, box.y),
    at(box.x, box.y + box.h), at(box.x + box.w, box.y + box.h)];
  const lo = Math.min.apply(null, ends), hi = Math.max.apply(null, ends);
  if (!(hi - lo > 0)) return null;
  const place = (o) => ((o * len) - lo) / (hi - lo);
  const held = (p) => rampAt(stops, ((p * (hi - lo)) + lo) / len);

  const out = [[0, held(0)]];
  for (const st of stops) {
    const p = place(st.o);
    if (p > 0.0001 && p < 0.9999) out.push([p, st.hex]);
  }
  out.push([1, held(1)]);
  const said = out.map(([p, hex]) => `(${colour(bundle, hex, seen)}, ${svgu.round(p * 100, 3)}%)`);
  // the axis, as an angle: Typst measures clockwise from pointing right, and so
  // does atan2 on a y-down coordinate system, which SVG's is
  const deg = svgu.round((Math.atan2(uy, ux) * 180) / Math.PI, 3);
  return `gradient.linear(${said.join(', ')}, angle: ${deg}deg, relative: "self")`;
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
  // the gradients this artwork defines, with the axis each one runs along
  const grads = new Map();
  for (const g of svgu.gradients(doc)) grads.set(g.id, g);
  // the axis as it is written, not as a number: what "0.82" means depends on
  // gradientUnits, and reading it before knowing that is how a gradient in user
  // space came to be drawn as a fraction of a box
  (function axes(n) {
    if (n.nodeType === 1 && String(n.nodeName).toLowerCase() === 'lineargradient' && grads.has(n.getAttribute('id'))) {
      const g = grads.get(n.getAttribute('id'));
      g.axis = { x1: n.getAttribute('x1'), y1: n.getAttribute('y1'), x2: n.getAttribute('x2'), y2: n.getAttribute('y2') };
      g.units = n.getAttribute('gradientUnits') || 'objectBoundingBox';
      g.gradientTransform = n.getAttribute('gradientTransform') || null;
    }
    for (let c = n.firstChild; c; c = c.nextSibling) axes(c);
  }(doc.documentElement));
  const unsayable = new Set();

  // Things that hold artwork without drawing it. Walking into them paints the
  // shape of a clipping mask onto the page: Kvist's printed piece carried a
  // solid rectangle the size of its own artboard, because a clipPath lives in
  // defs and defs was being treated as an ordinary group.
  const HIDDEN = svgu.NEVER_DRAWN;

  // <use> is how every drawing tool writes a repeated element, and this walker
  // had never heard of one: it drew the original out of defs, once, at the
  // coordinates it is defined at rather than the ones it is placed at, in
  // black rather than in the colour the <use> carries.
  const byId = {};
  (function index(n) {
    if (n.nodeType === 1) {
      const id = n.getAttribute('id');
      if (id) byId[id] = n;
      for (let c = n.firstChild; c; c = c.nextSibling) index(c);
    }
  }(doc.documentElement));
  const target = (node) => {
    const href = node.getAttribute('href') || node.getAttribute('xlink:href') || '';
    const m = /^#(.+)$/.exec(href.trim());
    return m ? byId[m[1]] : null;
  };

  // A lockup is a composition, so its parts sit inside transformed groups and
  // inherit their paint from them. Scraping the paths out on their own draws
  // them in the wrong place in the wrong colour, which is the same lesson the
  // icon check learned the hard way.
  const seenUse = [];
  (function walk(node, matrix, paint) {
    if (node.nodeType !== 1) return;
    const local = node.nodeName.replace(/^.*:/, '');
    const own = {};
    for (const a of PAINT) { const v = node.getAttribute(a); if (v != null && v !== '') own[a] = v.trim(); }
    const here = Object.assign({}, paint, own);
    const m = node.getAttribute('transform')
      ? paths.multiply(matrix, paths.parseTransform(node.getAttribute('transform')))
      : matrix;

    if (HIDDEN.indexOf(local.toLowerCase()) > -1) return;

    if (local === 'use') {
      const ref = target(node);
      if (ref && seenUse.indexOf(ref) < 0) {          // a <use> of itself draws nothing
        const dx = Number(node.getAttribute('x') || 0), dy = Number(node.getAttribute('y') || 0);
        const at = dx || dy ? paths.multiply(m, [1, 0, 0, 1, dx, dy]) : m;
        seenUse.push(ref);
        walk(ref, at, here);
        seenUse.pop();
      }
      return;
    }

    if (local === 'path') {
      const d = node.getAttribute('d');
      if (d) {
        const segs = paths.transformSegs(paths.parse(d), m);
        const scale = paths.scaleOf(m);
        const fill = here.fill, stroke = here.stroke;
        const w = Number(here['stroke-width'] || 1) * scale;
        // Placed at its own box, with its own coordinates, rather than at the
        // page origin with the page's. Typst measures a gradient against the
        // element's box, and an element placed at 0,0 holding a shape that sits
        // at the bottom of an A4 page is an A4-sized element.
        const bx = paths.bboxOf(segs) || { x: 0, y: 0, w: 0, h: 0 };
        const rel = (p) => [p[0] - bx.x, p[1] - bx.y];
        const parts = segs.map((sg) =>
          sg.op === 'move' ? `curve.move((${pt(rel(sg.to)[0])}, ${pt(rel(sg.to)[1])}))`
            : sg.op === 'line' ? `curve.line((${pt(rel(sg.to)[0])}, ${pt(rel(sg.to)[1])}))`
              : sg.op === 'cubic' ? `curve.cubic((${pt(rel(sg.c1)[0])}, ${pt(rel(sg.c1)[1])}), (${pt(rel(sg.c2)[0])}, ${pt(rel(sg.c2)[1])}), (${pt(rel(sg.to)[0])}, ${pt(rel(sg.to)[1])}))`
                // Z is a straight line back to the start. Typst closes with a
                // curve unless told otherwise, which both draws a shape the
                // artwork does not have and grows the box a gradient is
                // measured against — a dome 100 tall closed smoothly measures
                // 150.
                : 'curve.close(mode: "straight")');
        // an unset fill paints black, exactly as it does in a browser
        const paint = (v) => {
          const ref = /^url\(#([^)]+)\)$/.exec(String(v).trim());
          if (!ref) return colour(bundle, v, seen);
          const g = gradientFill(grads.get(ref[1]), bundle, seen, { box: bx, m, vb });
          // a paint server this cannot say — a radial, a pattern, a gradient in
          // user space — is refused rather than written as a colour it is not
          if (!g) unsayable.add(ref[1]);
          return g || colour(bundle, '#000000', seen);
        };
        const fillCss = fill === undefined ? colour(bundle, '#000000', seen)
          : fill === 'none' ? 'none' : paint(fill);
        const strokeCss = stroke && stroke !== 'none'
          ? `${pt(w)} + ${paint(stroke)}` : 'none';
        out.push(`#place(dx: ${pt(bx.x)}, dy: ${pt(bx.y)}, curve(\n  fill: ${fillCss},\n  stroke: ${strokeCss},\n`
          + `  ${parts.join(',\n  ')},\n))`);
      }
    }
    for (let c = node.firstChild; c; c = c.nextSibling) walk(c, m, here);
  }(doc.documentElement, place, {}));

  // said out loud rather than left in the file: a paint server this cannot
  // translate is drawn in black, and a mark silently turning black on the one
  // deliverable that goes on a press is what this path exists to stop
  if (unsayable.size && seen && seen.unsayable) for (const id of unsayable) seen.unsayable.add(id);
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
      // cuts one named after each colour role. This had its own answer to that
      // — take the first variant of the lockup — while the canvas had a better
      // one, which is to take a colourway cut for the ground the block is going
      // onto. So the same page put the mark in paper on screen and in ink on an
      // ink field in print, where it cannot be seen at all and costs money to
      // find out. One resolution, read by both.
      const want = require('./editor/render').cwName(bundle, b.props.colourway, b.props.on);
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
      const IMG = require('./editor/images');
      // The photograph goes to press exactly as it was dropped in: no duotone,
      // no scrim. The screen applies both, so the same document showed a brand
      // photograph in the brand's own colours on the page it publishes and in
      // whatever the camera saw on the page it prints, with nothing said.
      //
      // The treatment is baked into the pixels here with treatPixel — the same
      // function the browser check is measured against — so the two cannot
      // disagree. The scrim is baked in with it: Typst will not put alpha on a
      // CMYK colour, which is the right refusal, because a translucent wash is
      // not something a press does with an ink.
      const rules = (bundle.system || {}).photography;
      const treat = rules && rules.declared && b.props.treatment !== false;
      const scrim = rules ? PH.scrimStyle(rules, bundle, b.props.scrim) : null;
      const treated = (treat || scrim) ? exp.treatPhoto(im, treat ? rules : null, bundle, scrim, geom) : null;
      const name = `image-${b.props.image}${treated ? '-treated' : ''}.${treated ? 'png' : IMG.extensionOf(im.src)}`;
      const fit = b.props.fit === 'contain' ? 'contain' : 'cover';
      ctx.files[name] = treated || Buffer.from(im.src.split(',')[1] || '', 'base64');
      ctx.rasterColour = true;
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
  // a paint server the translator cannot say, collected so `print` can report
  // it rather than a shape quietly going out black on the press deliverable
  ctx.seen.unsayable = new Set();
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
    unsayablePaint: [...ctx.seen.unsayable],
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
