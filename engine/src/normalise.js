'use strict';
// Real artwork does not arrive clean. This turns an export into something the
// engine can measure, and says plainly what it found. Anything it cannot fix
// safely it refuses to guess about.
const { optimize } = require('svgo');
const svgu = require('./svg');
const contrast = require('./contrast');
const paths = require('./paths');

const finding = (level, code, what, why, how) => ({ level, code, what, why, how });

// Illustrator writes a metadata block containing entities it never declares,
// such as &ns_sfw;. Strict parsers stop on those before reaching any artwork,
// so this runs before anything else looks at the file.
const STANDARD_ENTITY = /^&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);$/;
function preClean(source) {
  let out = source, removed = 0;
  const drop = (re) => { out = out.replace(re, (m) => { removed++; return ''; }); };
  drop(/<metadata[\s\S]*?<\/metadata>/gi);
  drop(/<!DOCTYPE[^>[]*\[[\s\S]*?\]\s*>/gi);
  drop(/<\?xpacket[\s\S]*?\?>/gi);
  out = out.replace(/&[a-zA-Z_][\w.-]*;/g, (m) => (STANDARD_ENTITY.test(m) ? m : (removed++, '')));
  return { source: out, removed };
}

function eachEl(doc, fn) {
  (function walk(n) {
    if (n.nodeType === 1) fn(n);
    for (let c = n.firstChild; c; c = c.nextSibling) walk(c);
  })(doc.documentElement);
}

// this had its own reader, which knew hex and rgb() and not hsl(), so an hsl
// fill was left in the artwork untouched, given no colour slot, and handed to
// the printed piece as the literal text rgb("hsl(207
const hex = (c) => contrast.toHex(c);
const rgb = (h) => contrast.rgb(h) || [0, 0, 0];
const distance = (a, b) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));

// ---------- look before touching ----------
function inspect(source) {
  const found = [];
  source = preClean(source).source;
  let doc;
  try { doc = svgu.parse(source); }
  catch (e) {
    found.push(finding('blocker', 'unparseable', 'This file is not valid SVG.',
      'Nothing can be measured or exported from it.',
      'Re-export from Illustrator with File > Export > Export As > SVG.'));
    return { found, doc: null };
  }

  const counts = { text: 0, image: 0, clip: 0, mask: 0, filter: 0, transform: 0, hidden: 0, zero: 0, gradient: 0, nonScaling: 0, translucent: 0 };
  eachEl(doc, (el) => {
    const tag = String(el.nodeName).toLowerCase();
    if (tag === 'text' || tag === 'tspan') counts.text++;
    if (tag === 'image') counts.image++;
    if (tag === 'clippath' || el.getAttribute('clip-path')) counts.clip++;
    if (tag === 'mask' || el.getAttribute('mask')) counts.mask++;
    if (tag === 'filter' || el.getAttribute('filter')) counts.filter++;
    if (tag === 'lineargradient' || tag === 'radialgradient') counts.gradient++;
    if (el.getAttribute('transform')) counts.transform++;
    if (el.getAttribute('vector-effect') === 'non-scaling-stroke') counts.nonScaling++;
    for (const a of ['opacity', 'fill-opacity', 'stroke-opacity']) {
      const v = parseFloat(el.getAttribute(a));
      if (Number.isFinite(v) && v > 0 && v < 1) { counts.translucent++; break; }
    }
    const style = el.getAttribute('style') || '';
    if (el.getAttribute('display') === 'none' || /display\s*:\s*none/.test(style)
        || el.getAttribute('opacity') === '0' || el.getAttribute('visibility') === 'hidden') counts.hidden++;
    for (const a of ['r', 'width', 'height']) {
      const v = parseFloat(el.getAttribute(a));
      if (Number.isFinite(v) && v === 0) { counts.zero++; break; }
    }
  });

  if (counts.text) found.push(finding('blocker', 'live-text',
    `${counts.text} piece${counts.text > 1 ? 's' : ''} of live text.`,
    'Live type renders in a different font on any machine without your typeface, so a client would get the wrong wordmark and never know.',
    'In Illustrator select the type and use Type > Create Outlines, then export again.'));

  if (counts.image) found.push(finding('blocker', 'raster',
    `${counts.image} embedded image${counts.image > 1 ? 's' : ''}.`,
    'Part of this mark is a photograph or a screenshot rather than vector, so it will blur the moment anyone scales it up.',
    'Redraw that part as vector, or supply the mark without it.'));

  try {
    const vb = svgu.viewBox(doc);
    // a box of no size, or of negative size, is accepted by a parser and is
    // not a size: every measurement taken against it comes out zero or
    // negative, and a negative narrowest stem was being reported as a fact
    if (!(vb.w > 0) || !(vb.h > 0)) {
      found.push(finding('blocker', 'empty-viewbox',
        `The viewBox is ${vb.w} by ${vb.h}.`,
        'A box with no width or height is not a size. Everything here is measured as a fraction of that box, so every number in the package would come out as zero or as a negative.',
        'Set a real viewBox on the artwork, usually the size of the artboard you drew it on.'));
    }
  } catch (_) {
    found.push(finding('blocker', 'no-viewbox', 'No viewBox and no width or height.',
      'Without one of those the artwork has no known size, so nothing can be scaled or measured against it.',
      'Re-export with "Responsive" ticked, or add a viewBox by hand.'));
  }

  if (counts.clip) found.push(finding('warning', 'clip-path',
    `${counts.clip} clipping mask${counts.clip > 1 ? 's' : ''}.`,
    'A clip hides artwork rather than removing it. The hidden part comes back if anyone opens the file and moves the clip.',
    'Use Object > Expand or Pathfinder to cut the shape for real.'));

  if (counts.mask) found.push(finding('warning', 'mask',
    `${counts.mask} mask${counts.mask > 1 ? 's' : ''}.`,
    'Masks are rasterised by some exporters and ignored by others, so the mark may not survive a round trip.',
    'Flatten the masked artwork before exporting.'));

  if (counts.filter) found.push(finding('warning', 'filter',
    `${counts.filter} filter effect${counts.filter > 1 ? 's' : ''}.`,
    'Filters are rasterised on export, which puts a blurry patch inside an otherwise sharp mark.',
    'Remove the effect. A brand mark should not carry a shadow or a glow.'));

  if (counts.gradient) found.push(finding('warning', 'gradient',
    `${counts.gradient} gradient${counts.gradient > 1 ? 's' : ''}.`,
    'Colourways repaint flat colours. A gradient cannot be swapped for a single brand colour, so those parts will not change between colourways.',
    'Use flat colour, or accept that this part stays the same in every colourway.'));

  if (counts.translucent) found.push(finding('warning', 'translucent',
    `${counts.translucent} shape${counts.translucent > 1 ? 's are' : ' is'} partly transparent.`,
    'A spot ink cannot be printed at 35 percent without a tint screen, and a mark with a see-through part changes colour depending on what is behind it. It also measures oddly here: the ink box counts it, and the minimum size cannot see it, so the size at which the mark stops working is calculated as if it were not there.',
    'Make it solid, or repaint it as a flat tint of the colour it is meant to look like.'));

  if (counts.nonScaling) found.push(finding('warning', 'non-scaling-stroke',
    `${counts.nonScaling} stroke${counts.nonScaling > 1 ? 's' : ''} set not to scale.`,
    'That stroke stays the same thickness at every size, so the mark gets heavier as it gets smaller.',
    'Turn off "Scale strokes and effects" handling for this artwork and let the stroke scale.'));

  return { found, doc, counts };
}

// ---------- clean ----------
const SVGO = {
  multipass: true,
  plugins: [
    'removeDoctype', 'removeXMLProcInst', 'removeComments', 'removeMetadata',
    { name: 'inlineStyles', params: { onlyMatchedOnce: false } }, 'convertStyleToAttrs',
    'removeEditorsNSData', 'removeEmptyAttrs', 'removeHiddenElems', 'removeEmptyText',
    'removeEmptyContainers', 'cleanupIds', 'removeUselessDefs', 'removeUnknownsAndDefaults',
    'removeNonInheritableGroupAttrs', 'cleanupNumericValues', 'convertColors',
    { name: 'convertShapeToPath', params: { convertArcs: true } },
    { name: 'convertPathData', params: { applyTransforms: true, applyTransformsStroked: true, floatPrecision: 3 } },
    'convertTransform', 'moveGroupAttrsToElems', 'collapseGroups', 'mergePaths', 'sortAttrs',
  ],
};

// ---------- colour ----------
const SNAP_DISTANCE = 18;   // close enough that it is a slip rather than a choice

function colourPass(doc, tokens) {
  const palette = Object.entries((tokens && tokens.colour) || {})
    .map(([name, t]) => ({ name, hex: hex(t.hex) })).filter((t) => t.hex);
  const snapped = [];
  const offPalette = new Set();
  const used = new Map();          // hex -> count

  svgu.eachPainted(doc, (el) => {
    for (const prop of ['fill', 'stroke']) {
      const raw = el.getAttribute(prop);
      if (!raw || raw === 'none' || raw.startsWith('url(')) continue;
      const h = hex(raw);
      if (!h) continue;
      let final = h;
      if (h !== raw) el.setAttribute(prop, h);   // hsl() and friends, written out
      if (palette.length) {
        const exact = palette.find((p) => p.hex === h);
        if (!exact) {
          const near = palette
            .map((p) => ({ p, d: distance(h, p.hex) }))
            .sort((a, b) => a.d - b.d)[0];
          if (near && near.d <= SNAP_DISTANCE) {
            final = near.p.hex;
            snapped.push({ from: h, to: near.p.hex, token: near.p.name, distance: Math.round(near.d) });
          } else {
            offPalette.add(h);
          }
        }
      }
      if (final !== raw) el.setAttribute(prop, final);
      used.set(final, (used.get(final) || 0) + 1);
    }
  });
  return { snapped, offPalette: [...offPalette], used };
}

// Give every distinct colour a slot, so colourways have something to target.
function assignSlots(doc, used, tokens) {
  const palette = Object.entries((tokens && tokens.colour) || {})
    .map(([name, t]) => ({ name, hex: hex(t.hex) })).filter((t) => t.hex);
  const order = [...used.entries()].sort((a, b) => b[1] - a[1]).map(([h]) => h);
  const slotFor = new Map();
  order.forEach((h, i) => {
    const token = palette.find((p) => p.hex === h);
    slotFor.set(h, order.length === 1 ? 'ink' : (token ? token.name : `colour-${i + 1}`));
  });

  let tagged = 0;
  svgu.eachPainted(doc, (el) => {
    if (el.getAttribute('data-slot')) return;
    for (const prop of ['fill', 'stroke']) {
      const h = hex(el.getAttribute(prop));
      if (h && slotFor.has(h)) { el.setAttribute('data-slot', slotFor.get(h)); tagged++; return; }
    }
  });
  return { slots: [...new Set(slotFor.values())], tagged };
}

// ---------- the whole pass ----------
// <use> is how every drawing tool writes a repeated element, and it is a
// reference rather than a drawing: the shape lives in defs and each use places
// a copy of it. Consumers that walk the tree looking for geometry therefore see
// the original once, at the coordinates it is defined at rather than placed at,
// wearing none of the paint the use carries. Both emitters here did exactly
// that — the printed piece drew one black bar where there should have been
// three brand-coloured ones, and the PDF drew one shape and never filled it.
// Rather than teach every consumer about references, resolve them here, once,
// so that everything downstream only ever sees plain geometry.
const USE_PAINT = ['fill', 'stroke', 'stroke-width', 'stroke-opacity', 'fill-opacity',
  'opacity', 'stroke-linecap', 'stroke-linejoin', 'data-slot'];

function expandUse(doc) {
  const byId = {};
  eachEl(doc, (el) => { const id = el.getAttribute('id'); if (id) byId[id] = el; });

  let done = 0, dropped = 0;
  for (let pass = 0; pass < 6; pass++) {         // a use may reference a use
    const uses = [];
    eachEl(doc, (el) => {
      if (String(el.nodeName).toLowerCase() === 'use') uses.push(el);
    });
    if (!uses.length) break;
    for (const u of uses) {
      if (!u.parentNode) continue;
      const href = (u.getAttribute('href') || u.getAttribute('xlink:href') || '').trim();
      const id = (/^#(.+)$/.exec(href) || [])[1];
      const ref = id ? byId[id] : null;
      // a reference to nothing draws nothing, which is what it did before
      if (!ref || ref === u || (ref.contains && ref.contains(u))) {
        u.parentNode.removeChild(u); dropped++; continue;
      }
      const clone = ref.cloneNode(true);
      clone.removeAttribute('id');
      for (const a of USE_PAINT) {
        const v = u.getAttribute(a);
        if (v != null && v !== '' && !clone.getAttribute(a)) clone.setAttribute(a, v);
      }
      const dx = Number(u.getAttribute('x') || 0), dy = Number(u.getAttribute('y') || 0);
      const move = dx || dy ? `translate(${dx} ${dy})` : '';
      const outer = [u.getAttribute('transform') || '', move].filter(Boolean).join(' ');
      if (outer) {
        const own = clone.getAttribute('transform');
        clone.setAttribute('transform', own ? `${outer} ${own}` : outer);
      }
      u.parentNode.replaceChild(clone, u);
      done++;
    }
  }
  return { placed: done, dropped };
}

// Where the geometry actually is.
//
// This pass looked at what kind of element each shape was, what colour it was
// painted, and which slot it belonged to. It never once looked at its
// coordinates. So a file that had been edited for years — a stray click, an old
// roundel dragged off the artboard instead of deleted, a handle pulled to
// 99999 — measured 140 by 120 where the artwork is 120 by 120, and reported a
// narrowest stem of 2 where the thinnest real part is 10, which would have put
// the smallest usable size five times too high. Nothing was said about any of
// it, because nothing was looking.
// Any shape crossing the edge of the box is being cut off by it. A fifth of
// the box was a guess at "a nudge", and it let a mark through whose ripples
// are sliced flat by the artboard — which is not a nudge, it is the mark not
// being the shape it was drawn as. Half a unit is the parser's rounding.
const OUTSIDE_TOLERANCE = 0.5;        // in units, not a fraction
const FATAL_REACH = 3;                // times the box: past this it cannot be anything but a slip

function shapeExtents(doc) {
  const out = [];
  svgu.eachPainted(doc, (el) => {
    const d = el.getAttribute('d');
    if (!d) return;
    let segs;
    try { segs = paths.parse(d); } catch (_) { return; }
    const t = el.getAttribute('transform');
    if (t) { try { segs = paths.transformSegs(segs, paths.parseTransform(t)); } catch (_) { /* as written */ } }
    // Per subpath, not per path. The cleaner merges paths that share a style,
    // so an old shape sitting right off the artboard gets folded in with a
    // real one and stops looking like it is outside anything.
    let cur = null;
    const close = () => { if (cur && cur.minX !== Infinity) out.push(cur); cur = null; };
    const open = () => { cur = { el, segs: [], minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }; };
    for (const sg of segs) {
      if (sg.op === 'move') { close(); open(); }
      if (!cur) open();
      cur.segs.push(sg);
      for (const pt of [sg.to, sg.c1, sg.c2]) {
        if (!pt || !Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) continue;
        cur.minX = Math.min(cur.minX, pt[0]); cur.maxX = Math.max(cur.maxX, pt[0]);
        cur.minY = Math.min(cur.minY, pt[1]); cur.maxY = Math.max(cur.maxY, pt[1]);
      }
    }
    close();
  });
  return out;
}

function placePass(doc) {
  let vb;
  try { vb = svgu.viewBox(doc); } catch (_) { return { removed: 0, strays: [] }; }
  if (!(vb.w > 0) || !(vb.h > 0)) return { removed: 0, strays: [], painted: 1 };
  const pad = OUTSIDE_TOLERANCE;
  let removed = 0;
  const strays = [];
  const keep = new Map();               // element -> the subpaths that stay
  const all = shapeExtents(doc);
  for (const s of all) if (!keep.has(s.el)) keep.set(s.el, []);
  for (const s of all) {
    // nothing of it is inside the box, so it draws nothing at all
    const gone = s.maxX < vb.x || s.minX > vb.x + vb.w || s.maxY < vb.y || s.minY > vb.y + vb.h;
    if (gone) { removed++; continue; }
    keep.get(s.el).push(...s.segs);
    const over = Math.max(vb.x - s.minX, s.minY && 0, vb.y - s.minY,
      s.maxX - (vb.x + vb.w), s.maxY - (vb.y + vb.h));
    if (over > pad) {
      const reach = Math.round(Math.max(s.maxX - (vb.x + vb.w), vb.x - s.minX,
        s.maxY - (vb.y + vb.h), vb.y - s.minY));
      // a shape running a little past the edge may be a bleed somebody meant.
      // One running several times the width of the box past it is not artwork,
      // and the hairline it draws across the drawing is what every measurement
      // then reports, so the package would carry numbers that are simply false.
      strays.push({ reach, fatal: reach > Math.max(vb.w, vb.h) * FATAL_REACH });
    }
  }
  let painted = 0;
  for (const [el, segs] of keep) {
    if (!segs.length) continue;
    const f = el.getAttribute('fill'), st = el.getAttribute('stroke');
    if (f !== 'none' || (st && st !== 'none')) painted++;
  }
  if (removed) {
    for (const [el, segs] of keep) {
      if (!segs.length) { if (el.parentNode) el.parentNode.removeChild(el); continue; }
      el.setAttribute('d', paths.toPathData(segs));
    }
  }
  return { removed, strays, painted };
}

// Rules that survive the inlining pass are rules that match nothing: the
// inliner has already moved every rule that had an element to move it to. A
// stylesheet is also the one thing in an SVG that nothing downstream here
// reads — the measuring, the recolouring and the PDF writer all work off
// attributes — and the PDF writer does not merely ignore it, it asks the
// browser to parse it and stops the whole build with "CSSStyleSheet is not
// defined" on a machine that has no browser in it. Illustrator leaves one
// behind whenever artwork that used a class has since been deleted.
function dropDeadStyles(doc) {
  const dead = [];
  eachEl(doc, (el) => {
    if (String(el.nodeName).toLowerCase() === 'style') dead.push(el);
  });
  let rules = 0;
  for (const el of dead) {
    rules += (el.textContent.match(/\{/g) || []).length;
    if (el.parentNode) el.parentNode.removeChild(el);
  }
  return { blocks: dead.length, rules };
}

function normalise(source, { tokens } = {}) {
  const { found, doc: pre, counts } = inspect(source);
  const findings = [...found];
  if (findings.some((f) => f.level === 'blocker')) return { ok: false, findings, svg: null, slots: [] };

  const before = source.length;
  const stripped = preClean(source);
  // resolve references into geometry before the cleaner runs, so the transform
  // each one carries gets flattened along with every other transform
  let placed = 0, dangling = 0, forClean = stripped.source;
  try {
    const pre = svgu.parse(forClean);
    const r = expandUse(pre);
    placed = r.placed; dangling = r.dropped;
    // a removal is a change too: counting only the copies meant a file whose
    // only reference pointed at nothing had its edit quietly thrown away
    if (placed || dangling) forClean = svgu.serialize(pre);
  } catch (_) { placed = 0; dangling = 0; }
  let cleaned;
  try { cleaned = optimize(forClean, SVGO).data; }
  catch (e) {
    findings.push(finding('blocker', 'clean-failed', 'This file could not be cleaned up.',
      `The tidy-up step stopped with: ${e.message}`, 'Re-export it and try again.'));
    return { ok: false, findings, svg: null, slots: [] };
  }

  const doc = svgu.parse(cleaned);
  const dead = dropDeadStyles(doc);
  const place = placePass(doc);
  const already = svgu.slotsUsed(doc);
  const colour = colourPass(doc, tokens);
  const assigned = already.length ? { slots: already, tagged: 0 } : assignSlots(doc, colour.used, tokens);

  if (stripped.removed) findings.push(finding('fixed', 'editor-metadata',
    `Removed ${stripped.removed} block${stripped.removed > 1 ? 's' : ''} of editor metadata.`,
    'Illustrator writes a metadata block that refers to entities it never declares, which stops a strict parser before it reaches any of your artwork. None of it draws anything.', null));

  if (placed) findings.push(finding('fixed', 'expanded-use',
    `Placed ${placed} referenced ${placed > 1 ? 'copies' : 'copy'} into the artwork.`,
    'A repeated element is written as a reference to one kept aside. That is fine in a browser and nothing else here reads it, so the copies were being drawn once, in the wrong place, in the wrong colour.', null));

  if (dangling) findings.push(finding('warning', 'dangling-use',
    `${dangling} reference${dangling > 1 ? 's point' : ' points'} at artwork that is not in the file.`,
    'Something was deleted and the copies of it were left behind. They drew nothing, so the mark is missing a part it was drawn with.',
    'Check the mark against the original, and put back whatever was removed.'));

  // nothing left that puts ink anywhere. This was a bare Error thrown out of the
  // measuring step later on — a refusal in the wrong voice, in the wrong place.
  if (!findings.some((f) => f.level === 'blocker') && place.painted === 0) {
    findings.push(finding('blocker', 'nothing-drawn', 'Nothing in this file is painted.',
      'Every shape is either set to no fill and no stroke, hidden, or lying outside the artboard, so the file renders empty. There is nothing to measure and nothing to hand anybody.',
      'Check the layer the artwork is on, and that it has not been left switched off or moved aside.'));
  }

  if (place.removed) findings.push(finding('fixed', 'off-artboard',
    `Removed ${place.removed} shape${place.removed > 1 ? 's' : ''} lying outside the artboard.`,
    'Artwork past the edge of the box draws nothing, so nobody has seen it for as long as it has been there — and it comes back the moment anyone widens the box. Usually an old version moved aside rather than deleted.', null));

  for (const st of place.strays) findings.push(finding(st.fatal ? 'blocker' : 'warning', 'stray-geometry',
    `A shape reaches ${st.reach} units past the edge of the artboard.`,
    st.fatal
      ? 'Nothing is drawn that far outside the box on purpose. It crosses the artwork as a sliver thinner than anything you drew, so it is what the smallest usable size would be worked out from, and the measured box is wider than the mark. Every number in the package would be wrong.'
      : 'It draws as a sliver across the artwork, which is thinner than anything you drew on purpose — so it is what sets the smallest usable size, and it widens the measured box. Usually a handle dragged by accident.',
    'Find the shape that runs off the edge and delete it, or pull its point back where it belongs.'));

  if (dead.blocks) findings.push(finding('fixed', 'dead-styles',
    `Removed ${dead.rules} style rule${dead.rules === 1 ? '' : 's'} that matched nothing.`,
    'Left over from artwork that has since been deleted. They drew nothing, and a stylesheet inside a mark stops the PDF writer outright.', null));

  if (counts.transform) findings.push(finding('fixed', 'transforms',
    `Flattened ${counts.transform} transform${counts.transform > 1 ? 's' : ''} into the artwork.`,
    'Nested transforms make a stroke measure thinner than it prints, which would have put the minimum size wrong.', null));

  if (counts.hidden || counts.zero) findings.push(finding('fixed', 'leftovers',
    `Removed ${counts.hidden + counts.zero} hidden or zero-size shape${counts.hidden + counts.zero > 1 ? 's' : ''}.`,
    'Leftovers from editing. They are invisible but they enlarge the file and can widen the measured bounds.', null));

  for (const s of colour.snapped) findings.push(finding('fixed', 'colour-snapped',
    `${s.from} was ${s.distance} step${s.distance === 1 ? '' : 's'} from ${s.token} ${s.to}. Snapped it.`,
    'Almost certainly a slip rather than a decision. Two nearly identical colours in one identity is the thing nobody spots until print.', null));

  if (colour.offPalette.length) findings.push(finding('warning', 'off-palette',
    `${colour.offPalette.length} colour${colour.offPalette.length > 1 ? 's are' : ' is'} not in the palette: ${colour.offPalette.join(', ')}.`,
    'These are too far from any brand colour to be a mistake, so they were left alone. Colourways will not change them.',
    'Add them to the palette, or repaint that artwork in a brand colour.'));

  if (assigned.tagged) findings.push(finding('fixed', 'slots',
    `Tagged ${assigned.tagged} shape${assigned.tagged > 1 ? 's' : ''} with ${assigned.slots.length} colour slot${assigned.slots.length > 1 ? 's' : ''}: ${assigned.slots.join(', ')}.`,
    'Colourways repaint by slot, so without this the artwork stays one colour whatever the rules say.', null));

  const after = cleaned.length;
  if (after < before * 0.92) findings.push(finding('fixed', 'size',
    `Cleaned out ${Math.round((1 - after / before) * 100)} percent of the file.`,
    'Editor metadata, comments and empty groups. None of it draws anything.', null));

  // ok was hardcoded true here, so any blocker found after the first pass —
  // everything that needs the file cleaned before it can be seen — was reported
  // and then ignored. A refusal nothing acts on is not a refusal.
  const stopped = findings.some((f) => f.level === 'blocker');
  return { ok: !stopped, findings, svg: stopped ? null : svgu.serialize(doc),
    slots: stopped ? [] : assigned.slots, bytes: { before, after } };
}

module.exports = { normalise, inspect, preClean, hex, distance, SNAP_DISTANCE };
