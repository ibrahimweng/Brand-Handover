'use strict';
// The brand pattern.
//
// This module used to refuse to work unless the master SVG carried
// data-pattern="source" on one shape — "it is a decision, so the engine will
// not pick one for you". That reads as principled and is not: no file coming
// out of Illustrator or Figma has that attribute, so for every real user the
// pattern chapter did not exist. Nine of the thirty-one fixtures in this
// repository have it, and they have it because it was typed in by hand. The
// other twenty-two shipped a warning instead of a pattern.
//
// Refusing to guess is right when a guess would be a claim about the identity
// that nobody could check. It is wrong when the engine can measure the answer,
// show its working, and let the designer pick something else. That is what this
// does now: it reads every shape in the drawing, ranks them by how well they
// carry a repeat, builds the pattern from the best one, says which it chose and
// why, and offers all the others.
//
// Two more things were wrong with the old one and both were invisible until a
// real logo arrived. The tile size and stroke weight came from fixed defaults —
// tile: 100, weight: 3 — numbers that describe no particular artwork. And every
// tile was drawn fill="none" stroke=…, so a filled mark tiled as nothing at all.
// Every number here is measured off the drawing, and a filled shape tiles as a
// filled shape.
const svgu = require('./svg');
const geo = require('./geometry');

const R = (n, p = 3) => svgu.round(n, p);

// a small stable hash, so a tile's id depends on the tile and nothing else
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h | 0;
}

// ------------------------------------------------------------------ the motif

// Every shape in the drawing that could carry a repeat, with the whole mark as
// one of them. A group that names itself — data-part, from the twenty-eighth
// round — is offered as a whole rather than broken into its children, because a
// part the artwork has named is a part the designer thinks of as a thing.
// A motif is drawn many times over. Anything in it that is defined once and
// referred to by name — a clip path, a mask, a filter, a gradient, a class in a
// <style> block — is duplicated with it, and duplicate ids are not a style
// problem: resvg panics on some of them and takes the process with it. Kvist's
// master is a real Illustrator export and carries all of it.
//
// So a motif is reduced to the shapes it draws with. This is measurement as
// well as safety: a clip path left in the markup measures an area the drawing
// does not ink.
const NOT_DRAWN = ['defs', 'style', 'metadata', 'clipPath', 'mask', 'filter', 'title', 'desc',
  'linearGradient', 'radialGradient', 'pattern', 'symbol', 'marker'];
function onlyShapes(markup) {
  let out = markup;
  for (const tag of NOT_DRAWN) {
    out = out.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, 'gi'), '')
      .replace(new RegExp(`<${tag}\\b[^>]*/>`, 'gi'), '');
  }
  // An element that draws nothing has no business in a motif, and two separate
  // things go wrong when one is left in. Kvist's master carries
  // <rect width="228" height="49" opacity="0"/> — the invisible bounding box
  // Illustrator leaves behind — and it made the motif measure the whole
  // artboard instead of the mark, so the pattern was built at the wrong size.
  // It also made resvg panic outright when the tile was clipped: not an
  // exception, an abort from Rust that takes the build with it.
  out = out.replace(/<[a-zA-Z][\w:-]*\b[^>]*\s(?:opacity|fill-opacity)="0(?:\.0+)?"[^>]*\/>/g, '')
    .replace(/<[a-zA-Z][\w:-]*\b[^>]*\s(?:display="none"|visibility="hidden")[^>]*\/>/g, '');
  return out
    .replace(/\s(?:id|class)="[^"]*"/g, '')
    .replace(/\s(?:clip-path|mask|filter|style)="[^"]*"/g, '')
    // A stroke that refuses to scale, inside a tile that is nothing but scaling.
    // resvg inverts the transform to honour it, and on a motif normalised from a
    // 228 unit box it inverts to nothing: Option::unwrap() on a None, from Rust,
    // which aborts the process. Kvist is a real Illustrator export and carries it.
    .replace(/\svector-effect="[^"]*"/g, '')
    .replace(/<!--[\s\S]*?-->/g, '');
}

function candidates(markSource) {
  const doc = svgu.parse(markSource);
  const vb = svgu.viewBox(doc);
  const out = [];
  const seen = new Set();
  const add = (key, name, node, why, say) => {
    // The whole mark is the <svg> element itself, and an <svg> nested inside a
    // transformed <g> establishes its own viewport: the transform stops
    // meaning what it says, and resvg does not render it, it panics from Rust
    // and takes the process with it. A group of its children is the same
    // drawing and behaves like a shape.
    const isRoot = node === doc.documentElement
      || String(node.nodeName).replace(/^.*:/, '').toLowerCase() === 'svg';
    const inner = () => { let o = ''; for (let c = node.firstChild; c; c = c.nextSibling) o += svgu.serialize(c); return o; };
    const markup = onlyShapes((isRoot ? `<g>${inner()}</g>` : svgu.serialize(node))
      .replace(/\sxmlns(?::\w+)?="[^"]*"/g, ''));
    if (!/<(path|circle|rect|ellipse|polygon|polyline|line)\b/.test(markup)) return;
    if (seen.has(markup)) return;
    seen.add(markup);
    out.push(Object.assign({ key, name, markup, why }, say || null));
  };

  // An explicit decision still beats a measurement. Where the master says which
  // shape the pattern is built from, that is the answer and the ranking is only
  // there to offer alternatives.
  (function walkMarked(n) {
    if (n.nodeType !== 1) return;
    if (n.getAttribute && n.getAttribute('data-pattern') === 'source') {
      add('source', 'the shape marked in the master', n, 'the master marks it with data-pattern="source"',
        { nameKey: 'motifSource' });
    }
    for (let c = n.firstChild; c; c = c.nextSibling) walkMarked(c);
  }(doc.documentElement));

  add('mark', 'the whole mark', doc.documentElement, 'the whole drawing, repeated',
    { nameKey: 'motifMark' });

  (function walkParts(n) {
    if (n.nodeType !== 1) return;
    const part = n.getAttribute && n.getAttribute('data-part');
    if (part) {
      add(`part:${part}`, `the ${part}`, n, `the drawing names it: data-part="${part}"`,
        { nameKey: 'motifPart', nameVars: { part } });
      return;
    }
    for (let c = n.firstChild; c; c = c.nextSibling) walkParts(c);
  }(doc.documentElement));

  // Named for what they are. "One shape from the drawing" is what six of these
  // were called, which tells a reader choosing between them nothing at all.
  const FRIENDLY = { path: 'shape', circle: 'circle', rect: 'rectangle', ellipse: 'ellipse',
    polygon: 'polygon', polyline: 'line', line: 'line' };
  // the same six words as keys, because "the second circle in the drawing" is a
  // sentence the engine wrote and a French deck has to be able to say it too
  const SHAPE_KEY = { path: 'shapePath', circle: 'shapeCircle', rect: 'shapeRect',
    ellipse: 'shapeEllipse', polygon: 'shapePolygon', polyline: 'shapeLine', line: 'shapeLine' };
  const shapes = [];
  svgu.eachPainted(doc, (el) => {
    if (!el.getAttribute) return;
    const tag = String(el.nodeName).replace(/^.*:/, '').toLowerCase();
    if (!FRIENDLY[tag]) return;
    if (shapes.length > 12) return;
    shapes.push({ el, tag });
  });
  const ORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth',
    'ninth', 'tenth', 'eleventh', 'twelfth'];
  const tally = {};
  for (const sh of shapes) tally[sh.tag] = (tally[sh.tag] || 0) + 1;
  const seenTag = {};
  shapes.forEach((sh, i) => {
    const word = FRIENDLY[sh.tag];
    seenTag[sh.tag] = (seenTag[sh.tag] || 0) + 1;
    const one = tally[sh.tag] === 1;
    const name = one ? `the ${word} in the drawing`
      : `the ${ORD[seenTag[sh.tag] - 1] || `${seenTag[sh.tag]}th`} ${word} in the drawing`;
    add(`shape:${i + 1}`, name, sh.el, `a single ${word} out of the drawing`,
      { nameKey: one ? 'motifShape' : 'motifShapeNth',
        nameVars: Object.assign({ shapeKey: SHAPE_KEY[sh.tag] },
          one ? null : { ordKey: `ord${seenTag[sh.tag]}` }) });
  });

  return { doc, viewBox: vb, list: out };
}

// Whether a shape is drawn as a stroke, asked of the markup that will be
// emitted rather than of the outermost tag. Meridian's ring carries no stroke
// of its own — the group around it does — so asking the element alone said
// "filled", and the ring tiled as a disc.
function strokedIn(markup) {
  const stroked = /stroke="(?!none)[^"]*"/.test(markup) || /stroke-width="(?!0")/.test(markup);
  const filled = /fill="(?!none)[^"]*"/.test(markup);
  if (stroked) return true;
  if (filled) return false;
  // nothing says either: a shape with no closed area reads as a line
  return !/<(circle|rect|ellipse|polygon)\b/.test(markup) && !/[Zz]\s*"/.test(markup);
}

// What proportion of its own bounding box a shape actually inks, measured by
// drawing it. Nothing about the markup answers this: a filled square and a
// hairline ring of the same size have the same box and the same tag.
// Rendered into a SQUARE viewBox around the shape, never into the shape's own
// box. A shape with no height — a rule, a baseline, a hairline — gives a box of
// zero, and resvg does not throw on one, it panics: `called Option::unwrap() on
// a None value`, which aborts the process from Rust and cannot be caught here.
// A build that dies is worse than any wrong answer, so the degenerate case is
// kept out rather than handled.
function coverage(alone, box, vb) {
  const side = Math.max(box.w, box.h);
  if (!(side > 0) || !isFinite(side)) return 0;
  const N = 44;
  try {
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    const square = `<svg xmlns="${svgu.NS}" viewBox="${R(cx - side / 2, 3)} ${R(cy - side / 2, 3)} `
      + `${R(side, 3)} ${R(side, 3)}">`
      + alone.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '') + '</svg>';
    const png = geo.renderPng(square, N);
    const { decode } = require('fast-png');
    const img = decode(png);
    const d = img.data, ch = img.channels || 4;
    let on = 0;
    for (let i = 0; i < d.length; i += ch) if (d[i + ch - 1] > 24) on += 1;
    // inked pixels as a share of the shape's own box, not of the square
    const boxPixels = N * N * ((box.w * box.h) / (side * side));
    return boxPixels > 0 ? Math.min(1, on / boxPixels) : 0;
  } catch (e) { return 0.3; }
}

// Ranking renders every candidate to measure how much of its box it inks, and
// everything downstream asks for the ranking again: three densities times four
// colourways times nine constructions is the same answer computed a hundred
// times. One drawing, one answer.
const RANKED = new Map();

// How well a shape carries a repeat, measured rather than felt.
//
// compact  a long shape tiles as a stripe; a squarish one tiles as a field
// simple   a motif is read at a tenth of the size the mark is, so detail is noise
// weight   too small and the field is empty, too big and it is a wall
function rank(markSource) {
  const key = `${markSource.length}:${hash(markSource)}`;
  if (RANKED.has(key)) return RANKED.get(key);
  const out = measureRank(markSource);
  RANKED.set(key, out);
  return out;
}

function measureRank(markSource) {
  const { viewBox, list } = candidates(markSource);
  const whole = geo.inkBox(markSource);
  const wholeArea = Math.max(1, whole.w * whole.h);
  const scored = [];
  for (const c of list) {
    const alone = `<svg xmlns="${svgu.NS}" viewBox="${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}">${c.markup}</svg>`;
    let box;
    try { box = geo.inkBox(alone); } catch (e) { continue; }
    if (!box || !(box.w > 0) || !(box.h > 0)) continue;
    const compact = Math.min(box.w, box.h) / Math.max(box.w, box.h);
    // How much of its own box the shape actually inks. Hallward's best-scoring
    // shape was a hairline ring: close to square, simple, a good share of the
    // drawing, and 3 per cent ink. Tiled, it was an empty page. Measured on the
    // shape rather than reasoned about from its markup.
    const ink = coverage(alone, box, viewBox);
    const segments = (c.markup.match(/[MmLlHhVvCcSsQqTtAaZz]/g) || []).length
      + (c.markup.match(/<(circle|rect|ellipse|polygon|polyline|line)\b/g) || []).length * 2;
    const simple = 1 / (1 + segments / 14);
    const share = (box.w * box.h) / wholeArea;
    // a bump: best around a fifth to two thirds of the mark's own box
    const weight = share <= 0 ? 0 : Math.exp(-Math.pow((Math.log(share) - Math.log(0.35)) / 1.1, 2));
    // a shape that inks between a tenth and half of its box reads as a motif;
    // below that it is a wash and above it is a block
    const solid = Math.exp(-Math.pow((Math.log(Math.max(ink, 0.005)) - Math.log(0.3)) / 1.15, 2));
    const score = c.key === 'source' ? 10
      : 0.3 * compact + 0.2 * simple + 0.2 * weight + 0.3 * solid;
    scored.push(Object.assign({}, c, { box, compact: R(compact, 2), simple: R(simple, 2),
      ink: R(ink, 3), solid: R(solid, 2),
      share: R(share, 3), score: R(score, 4), viewBox,
      stroked: strokedIn(c.markup) }));
  }
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

// The coverage render is the expensive part, so it is worth saying what it
// costs: about ten small rasters per drawing, once.
rank.clear = () => RANKED.clear();

// Why this one, in a sentence a designer can disagree with.
// Why this shape and not another, as the facts that decided it. The sentence
// below says the same thing in English, which brand.json and the command line
// keep reading; whyText() says it in whatever the document is written in.
function whyFacts(m, all) {
  if (m.key === 'source') return { marked: true };
  const bits = [];
  if (m.compact > 0.8) bits.push('whySquare');
  else if (m.compact > 0.55) bits.push('whySquarish');
  if (m.simple > 0.6) bits.push('whySimple');
  if (m.share > 0.12 && m.share < 0.75) bits.push('whySubstantial');
  return { marked: false, bits, all: all.length, others: all.length - 1 };
}

function whyText(f, L) {
  if (!f) return '';
  if (f.marked) return L.t('whyMarked');
  const bits = f.bits.map((k) => L.t(k));
  return `${bits.join(', ')}${bits.length ? '. ' : ''}`
    + L.t('whyRanked', { n: f.all, shapes: L.t(f.all === 1 ? 'patShape' : 'patShapes') })
    + `${f.others > 0 ? L.t('whyOthers') : ''}.`;
}

function because(m, all) {
  return whyText(whyFacts(m, all), require('./strings').resolve({}));
}

// ---------------------------------------------------------- the constructions
//
// Nine ways to make a field out of one shape. Each returns the tile it needs and
// where the shape goes inside it, in tile units. Placement is wrapped and
// clipped afterwards, so every one of them is seamless by construction rather
// than by being drawn carefully.
const CONSTRUCTIONS = {
  grid: { draws: 'a straight repeat, every instance the same way up', drawsKey: 'drawsGrid',
    build: (C) => ({ W: C, H: C, at: [{ x: C / 2, y: C / 2 }] }) },

  halfDrop: { draws: 'rows offset by half a cell, the way a textile repeats', drawsKey: 'drawsHalfDrop',
    build: (C) => ({ W: C, H: C * 2, at: [{ x: C / 2, y: C / 2 }, { x: 0, y: C * 1.5 }] }) },

  brick: { draws: 'columns offset by half a cell, the way brickwork courses', drawsKey: 'drawsBrick',
    build: (C) => ({ W: C * 2, H: C, at: [{ x: C / 2, y: C / 2 }, { x: C * 1.5, y: 0 }] }) },

  rotary: { draws: 'a block of four, each one turned a quarter more than the last', drawsKey: 'drawsRotary',
    build: (C) => ({ W: C * 2, H: C * 2, at: [
      { x: C * 0.5, y: C * 0.5, rot: 0 }, { x: C * 1.5, y: C * 0.5, rot: 90 },
      { x: C * 1.5, y: C * 1.5, rot: 180 }, { x: C * 0.5, y: C * 1.5, rot: 270 }] }) },

  mirror: { draws: 'a block of four, reflected across both axes', drawsKey: 'drawsMirror',
    build: (C) => ({ W: C * 2, H: C * 2, at: [
      { x: C * 0.5, y: C * 0.5 }, { x: C * 1.5, y: C * 0.5, fx: true },
      { x: C * 0.5, y: C * 1.5, fy: true }, { x: C * 1.5, y: C * 1.5, fx: true, fy: true }] }) },

  scale: { draws: 'the same shape at four sizes, the way the size ladder steps down', drawsKey: 'drawsScale',
    build: (C) => ({ W: C * 2, H: C * 2, at: [
      { x: C * 0.52, y: C * 0.52, s: 1 }, { x: C * 1.56, y: C * 0.46, s: 0.5 },
      { x: C * 1.48, y: C * 1.52, s: 0.78 }, { x: C * 0.44, y: C * 1.58, s: 0.34 }] }) },

  scatter: { draws: 'placed at intervals that do not line up, and never twice in the same place', drawsKey: 'drawsScatter',
    build: (C) => {
      // deterministic: the same identity gets the same field every time it builds
      let seed = 20260906;
      const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
      const W = C * 3, H = C * 3, at = [];
      for (let tries = 0; tries < 900 && at.length < 12; tries++) {
        const x = rnd() * W, y = rnd() * H, s = 0.55 + rnd() * 0.5;
        const near = at.some((p) => Math.hypot(
          Math.min(Math.abs(p.x - x), W - Math.abs(p.x - x)),
          Math.min(Math.abs(p.y - y), H - Math.abs(p.y - y))) < C * 0.74);
        if (!near) at.push({ x, y, s, rot: Math.round(rnd() * 8) * 45 });
      }
      return { W, H, at };
    } },

  // The two that are not a repeat of the shape at all, but of the line the
  // shape is drawn with. Most identities that use a pattern well use one of
  // these, because a mark repeated small enough to be a texture stops being
  // the mark and a line system never claims to be.
  lines: { draws: 'rules at the weight the mark is drawn in, at the pitch of its own module', drawsKey: 'drawsLines',
    build: (C) => ({ W: C, H: C, at: [], rules: true }) },

  arcs: { draws: 'quarter turns at the mark’s own weight, meeting across every edge', drawsKey: 'drawsArcs',
    build: (C) => ({ W: C, H: C, at: [], arcs: true }) },
};

const NAMES = Object.keys(CONSTRUCTIONS);

// -------------------------------------------------------------------- drawing

// The motif normalised: centred on the origin, longest side one unit.
function normalised(m) {
  const k = 1 / Math.max(m.box.w, m.box.h);
  const cx = m.box.x + m.box.w / 2, cy = m.box.y + m.box.h / 2;
  // The scale is folded into the caller's so there is never an intermediate of
  // four thousandths sitting in the transform list.
  return { k, centre: `translate(${R(-cx, 4)} ${R(-cy, 4)})` };
}

// Paint the motif the way the drawing paints it. A stroked shape tiles as a
// stroke at the pattern's weight; a filled shape tiles as a fill. Forcing every
// motif to fill="none" is why a filled mark used to tile as an empty page.
function painted(m, colour, strokeInUnits, render) {
  const how = render === 'auto' || !render ? (m.stroked ? 'stroke' : 'fill') : render;
  const body = m.markup
    .replace(/\s(?:fill|stroke)(?:-[a-z-]+)?="[^"]*"/g, '')
    .replace(/\sxmlns(?::\w+)?="[^"]*"/g, '')
    // Belt and braces: a nested viewport anywhere in a motif is a crash. Only
    // the svg tag's own attributes go — width and height on a <rect> are the
    // rect, and stripping those everywhere emptied the tile.
    .replace(/<svg\b[^>]*>/g, '<g>').replace(/<\/svg>/g, '</g>');
  const paint = how === 'stroke'
    ? `fill="none" stroke="${colour}" stroke-width="${R(strokeInUnits, 4)}" stroke-linecap="round" stroke-linejoin="round"`
    : `fill="${colour}" stroke="none"`;
  return body.replace(/<(\w+)/, `<$1 ${paint}`);
}

// Every instance that touches the tile, including the copies of it that belong
// to the neighbouring tiles. This is what makes the field seamless whatever the
// construction did — including scatter, which cannot be made seamless by being
// careful.
function wrapped(at, W, H, reach) {
  const out = [];
  for (const p of at) {
    const r = reach * (p.s || 1) * 0.75;
    const xs = [0], ys = [0];
    if (p.x - r < 0) xs.push(W);
    if (p.x + r > W) xs.push(-W);
    if (p.y - r < 0) ys.push(H);
    if (p.y + r > H) ys.push(-H);
    for (const dx of xs) for (const dy of ys) out.push(Object.assign({}, p, { x: p.x + dx, y: p.y + dy }));
  }
  return out;
}

// ---------------------------------------------------------------- the numbers

// What the pattern is made of, measured off the drawing.
//
// The cell size is a decision — how large the field reads is a judgement about
// the piece it is going on, not a fact about the mark — and it is the only one
// here. Everything inside the cell is a proportion taken from the artwork: the
// line weight is the same fraction of the motif that the mark's stroke is of
// the mark, and the air around it is the clear space rule the identity already
// states. tile: 100 and weight: 3 said nothing about any particular drawing.
function spec(markSource, rules, measured) {
  const all = rank(markSource);
  if (!all.length) {
    return { ok: false,
      why: 'nothing in this drawing can carry a repeat: every shape in it measured as empty.',
      how: 'Check the master opens and draws. If the mark is a single hairline, a pattern built from it '
        + 'would be a grey wash rather than a field.' };
  }
  const wanted = rules.motif && all.find((m) => m.key === rules.motif);
  const motif = wanted || all[0];
  // Which construction, where the project has not said. A long shape repeated
  // reads as noise — Marlow's wordmark tiled as six lines of small print — and
  // a line system says the same thing without pretending to be the mark. A
  // squarish shape drops; a very simple one can take a straight grid.
  const auto = motif.compact < 0.4 ? 'lines'
    : motif.compact > 0.85 && motif.simple > 0.5 ? 'halfDrop'
      : motif.compact > 0.6 ? 'halfDrop' : 'brick';
  const construction = CONSTRUCTIONS[rules.construction] ? rules.construction : auto;

  // Air: the identity states how much room the mark wants around it, so the
  // field uses the same judgement rather than a number nobody chose. Held
  // between a half and four fifths of the cell, because a clear space rule of
  // 2.5 is about a mark on a page and would make a field of almost nothing.
  const csr = Number(rules.clearSpaceRatio || (measured && measured.clearSpaceRatio) || 0.25);
  const fill = Math.min(0.8, Math.max(0.45, 1 / (1 + 2 * csr)));

  // Weight: the stroke the mark is drawn in, as a fraction of the mark itself,
  // so the pattern is drawn in the same hand at any size.
  const doc = svgu.parse(markSource);
  const vb = svgu.viewBox(doc);
  const widths = svgu.strokeWidths(doc);
  const carrying = widths.length ? widths[Math.min(widths.length - 1, Math.floor(widths.length / 2))] : 0;
  const longSide = Math.max(vb.w, vb.h) || 1;
  const strokeRatio = carrying > 0 ? carrying / longSide : 0.08;

  return { ok: true, motif, all, construction, fill, strokeRatio,
    render: rules.render || 'auto',
    cell: Number(rules.tile) > 0 ? Number(rules.tile) : 100,
    why: because(motif, all), whyFacts: whyFacts(motif, all) };
}

// -------------------------------------------------------------------- the tile

// A tile that repeats seamlessly in both directions, whatever the construction
// did. Every instance is emitted again for each edge it crosses, and the tile
// is clipped to itself, so seamlessness is a property of this function rather
// than of nine separate pieces of careful drawing.
function tile(markSource, rules, colour, measured) {
  const sp = spec(markSource, rules, measured);
  if (!sp.ok) return sp;
  const C = sp.cell;
  const made = CONSTRUCTIONS[sp.construction].build(C);
  const { W, H } = made;
  const size = C * sp.fill;
  const strokeOnTile = size * sp.strokeRatio;
  const norm = normalised(sp.motif);

  let body = '';
  if (made.rules) {
    // rules across the tile, at the mark's own weight, four to a cell
    // as many rules as the mark is stroke-widths deep, held between three and
    // nine, so a fine drawing gets a fine system and a heavy one a heavy system
    const n = Math.max(3, Math.min(9, Math.round(1 / Math.max(sp.strokeRatio, 0.02) / 4)));
    const pitch = H / n;
    body = Array.from({ length: n }, (_, i) => {
      const y = R(pitch * (i + 0.5));
      return `<path d="M0 ${y} H ${R(W)}" fill="none" stroke="${colour}" stroke-width="${R(strokeOnTile)}" stroke-linecap="square"/>`;
    }).join('');
  } else if (made.arcs) {
    // A quarter turn centred on each corner, radius half the tile, so every arc
    // meets the one in the tile next to it at the middle of the shared edge and
    // the field reads as continuous circles. The first version drew four hooks
    // facing the same way that met nothing: it built, and a browser showed it
    // did not tile.
    // The same count the line system uses, so a finely drawn mark gets a fine
    // field and a heavy one a heavy field. With one scallop per tile this was
    // the same picture for every identity in the repository, which is a stock
    // pattern wearing a brand's colour.
    const n = Math.max(1, Math.min(4, Math.round(1 / Math.max(sp.strokeRatio, 0.02) / 10)));
    const step = W / n, r = step / 2;
    const arc = (x1, y1, x2, y2, sweep) =>
      `<path d="M ${R(x1)} ${R(y1)} A ${R(r)} ${R(r)} 0 0 ${sweep} ${R(x2)} ${R(y2)}" fill="none" `
      + `stroke="${colour}" stroke-width="${R(strokeOnTile)}" stroke-linecap="butt"/>`;
    const bits = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const cx = i * step, cy = j * step;
        bits.push(arc(cx + r, cy, cx, cy + r, 0));
        bits.push(arc(cx + step - r, cy, cx + step, cy + r, 1));
        bits.push(arc(cx, cy + step - r, cx + r, cy + step, 1));
        bits.push(arc(cx + step - r, cy + step, cx + step, cy + step - r, 0));
      }
    }
    body = bits.join('');
  } else {
    const reach = size * 1.45;                       // worst case with rotation
    body = wrapped(made.at, W, H, reach).map((p) => {
      const s = p.s || 1;
      const flip = `${p.fx ? -1 : 1} ${p.fy ? -1 : 1}`;
      const k = size * s * norm.k;              // one scale, not two
      const stroke = strokeOnTile * s / k;
      return `<g transform="translate(${R(p.x)} ${R(p.y)})`
        + `${p.rot ? ` rotate(${R(p.rot)})` : ''}`
        + ` scale(${R(k, 8)})`
        + `${(p.fx || p.fy) ? ` scale(${flip})` : ''} ${norm.centre}">`
        + painted(sp.motif, colour, stroke, sp.render) + `</g>`;
    }).join('');
  }

  const cid = `clip-${sp.construction}-${Math.abs(hash(`${W}|${H}|${sp.motif.key}`)).toString(36)}`;
  const clipped = `<defs><clipPath id="${cid}"><rect width="${R(W)}" height="${R(H)}"/></clipPath></defs>`
    + `<g clip-path="url(#${cid})">${body}</g>`;
  return { ok: true, width: R(W), height: R(H), body: clipped, raw: body,
    motif: sp.motif.key, motifName: sp.motif.name, construction: sp.construction, why: sp.why, spec: sp,
    svg: `<svg xmlns="${svgu.NS}" viewBox="0 0 ${R(W)} ${R(H)}" width="${R(W)}" height="${R(H)}">${clipped}</svg>` };
}

// The same tile at every density, in every colourway the rules allow. A
// colourway that fails contrast on its ground is refused rather than drawn.
function everyTile(markSource, rules, colourways, contrastPairs, measured) {
  const out = [], refused = [];
  const base = spec(markSource, rules, measured);
  if (!base.ok) return base;
  for (const [density, factor] of Object.entries(rules.densities)) {
    const scaled = Object.assign({}, rules, { tile: R(base.cell * factor) });
    for (const cw of colourways) {
      const pair = contrastPairs && contrastPairs.find(
        (p) => (p.fgHex === cw.ink && p.bgHex === cw.on) || (p.fgHex === cw.on && p.bgHex === cw.ink));
      if (pair && pair.level === 'fail') {
        refused.push({ density, colourway: cw.name, ratio: pair.ratio,
          why: `${cw.name} measures ${pair.ratio}:1 against its ground, so the pattern would not be visible.` });
        continue;
      }
      const t = tile(markSource, scaled, cw.ink, measured);
      if (!t.ok) return t;
      out.push({ density, colourway: cw.name, ink: cw.ink, on: cw.on, tile: t.svg, body: t.body,
        width: t.width, height: t.height });
    }
  }
  return { ok: true, tiles: out, refused, motif: base.motif.key, motifName: base.motif.name,
    construction: base.construction, why: base.why, choices: base.all.map((m) => m.key) };
}

// A patch of pattern for a document or the editor, using the tile as a fill.
function swatch(markSource, rules, ink, on, w, h, id, measured) {
  const t = tile(markSource, rules, ink, measured);
  if (!t.ok) return null;
  // `colour` was not in scope here, so this threw for any caller that did not
  // pass an id — which is to say it was one argument away from being noticed.
  const pid = 'pat-' + (id || ('t' + Math.abs(hash(`${rules.tile}|${ink}|${t.construction}|${t.motif}`)).toString(36)));
  return `<svg xmlns="${svgu.NS}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true" style="width:100%;height:100%;display:block">`
    + `<defs><pattern id="${pid}" width="${t.width}" height="${t.height}" patternUnits="userSpaceOnUse">${t.body}</pattern></defs>`
    + `<rect width="${w}" height="${h}" fill="${on}"/><rect width="${w}" height="${h}" fill="url(#${pid})"/></svg>`;
}

// Every pattern this identity could have, drawn from its own artwork, so the
// choice is made by looking rather than by reading a list of words. This is
// what the picker in the app is built on.
function options(markSource, rules, ink, on, size, measured) {
  const base = spec(markSource, rules, measured);
  if (!base.ok) return [];
  const out = [];
  for (const m of base.all) {
    for (const c of NAMES) {
      const r = Object.assign({}, rules, { motif: m.key, construction: c });
      const sw = swatch(markSource, r, ink, on, size || 240, size || 240,
        `o-${m.key.replace(/[^a-z0-9]/gi, '')}-${c}`, measured);
      if (sw) out.push({ motif: m.key, motifName: m.name, construction: c,
        draws: CONSTRUCTIONS[c].draws, svg: sw, chosen: m.key === base.motif.key && c === base.construction });
    }
  }
  return out;
}

// The motif's name and the construction's description are prose the engine
// wrote off the artwork, not labels it was handed, so a document written in
// another language has to be able to say them. Each carries the English — which
// brand.json and the command line keep reading — and the keys that rebuild it.
function motifName(motif, L) {
  if (!L || !motif || !motif.nameKey) return (motif && motif.name) || '';
  const v = Object.assign({}, motif.nameVars);
  if (v.shapeKey) { v.shape = L.t(v.shapeKey); delete v.shapeKey; }
  if (v.ordKey) { v.ord = L.t(v.ordKey); delete v.ordKey; }
  return L.t(motif.nameKey, v);
}

function drawsText(construction, L) {
  const c = CONSTRUCTIONS[construction];
  if (!c) return '';
  return L && c.drawsKey ? L.t(c.drawsKey) : c.draws;
}

module.exports = { candidates, rank, because, whyFacts, whyText, CONSTRUCTIONS, NAMES, normalised, painted, wrapped,
  motifName, drawsText,
  spec, tile, everyTile, swatch, options, R,
  // kept so the twenty-two callers and tests written against the old shape do
  // not have to know the engine stopped refusing
  sourceGeometry: (src) => { const r = rank(src); return r.length
    ? { ok: true, box: r[0].box, markup: r[0].markup, viewBox: r[0].viewBox }
    : { ok: false, why: 'nothing in this drawing can carry a repeat.', how: 'Check the master draws.' }; } };
