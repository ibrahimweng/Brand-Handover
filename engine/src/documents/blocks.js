'use strict';
// Derived blocks. Each one reads the project and draws itself, so none of them
// can go stale. Where a block needs a judgement rather than a measurement it
// takes the words from the project's content, and says so.
const svgu = require('../svg');
const geo = require('../geometry');
const naming = require('../naming');
const contrast = require('../contrast');

// Diagrams style their own text. A derived block that needs the host page's
// stylesheet is not a block, it is a fragment that only works in one document.
const TXT = 'font-family="ui-monospace, Menlo, monospace" font-size="8"';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// The four verbs a part of the mark can arrive with, which src/motion.js names
// and this file has to say out loud. See HOWS there.
const HOW_KEY = { draws: 'howDraws', rises: 'howRises', fades: 'howFades', turns: 'howTurns' };

// The three dichromacies src/vision.js simulates, as they are said out loud.
// the job a colour holds, which is printed under every chip in the palette
const ROLE_KEY = { primary: 'rolePrimary', secondary: 'roleSecondary', accent: 'roleAccent',
  ground: 'roleGround', neutral: 'roleNeutral', support: 'roleSupport', alert: 'roleAlert' };

const EDGE_KEY = { top: 'edgeTop', bottom: 'edgeBottom', left: 'edgeLeft',
  right: 'edgeRight', flat: 'edgeFlat' };
// "a and b" is two words and a conjunction, and the conjunction is a word
const joinAnd = (list, L) => (list.length < 2 ? (list[0] || '')
  : L.t('gradAnd', { a: list.slice(0, -1).join(', '), b: list[list.length - 1] }));

const VIS_KEY = { protanopia: 'visProtanopia', deuteranopia: 'visDeuteranopia', tritanopia: 'visTritanopia' };
const SAY_KEY = { protanopia: 'sayProtanopia', deuteranopia: 'sayDeuteranopia', tritanopia: 'sayTritanopia' };
const SHARE_KEY = { protanopia: 'shareProtanopia', deuteranopia: 'shareDeuteranopia', tritanopia: 'shareTritanopia' };

// The language a block is being drawn into. Every sentence in this file used to
// be an English literal, so the question never came up; now that they come from
// the dictionary it has to be asked of the document rather than of the project,
// and the deck is not the manual. See src/strings.js.
const lang = (ctx, use) => use || ctx.L || require('../strings').resolve({});
// What the drawing is called, in that language.
const nounIn = (ctx, L) => L.t(ctx.noun === 'logotype' ? 'nounLogotype' : 'nounMark');

// Which asset a block means when it says "the mark". With both, the symbol; for
// a logotype identity there is no symbol, and the master is the logotype.
const artOf = (ctx, which) =>
  ctx.project.assets[which || ctx.measured.master || (ctx.project.assets.mark ? 'mark' : 'wordmark')];

// A silhouette: every slot in one colour. Right for the diagrams, where the
// point is the geometry and a second ink would only be noise.
function inked(ctx, hex, which) {
  const doc = svgu.parse(artOf(ctx, which).source);
  svgu.applyColourway(doc, Object.fromEntries(ctx.measured.slots.map((s) => [s, hex])));
  return svgu.serialize(doc);
}

// `css` overrides the width the browser lays the mark out at, while the width
// and height attributes stay at the true size for a reader with no styles.
// A specimen is either something a reader needs described or decoration of the
// caption beside it, and every one of them was neither: seventeen of the twenty
// drawings on a manual page had no accessible name and were not hidden, so a
// screen reader announced them as unlabelled graphics or skipped them, depending
// which one it was. Say which. `label` names it; no label means the caption next
// to it is the name and the drawing itself is decoration of it.
function scaled(svg, width, css, label) {
  // a document should not fail to build because one variant is absent
  if (!svg) return `<div style="width:${css || `${width}px`};height:${Math.round(width / 3)}px" aria-hidden="true"></div>`;
  return svg.replace(/<svg([^>]*)>/, (m, attrs) => {
    // height="auto" is not a length, so it is not an SVG attribute. The style
    // beside it was doing the work and the attribute was only ever an error in
    // the console — but a page that loses its styles would then have lost the
    // proportion too. The viewBox knows the ratio, so say the height outright.
    const vb = /viewBox="\s*([-\d.eE]+)[,\s]+([-\d.eE]+)[,\s]+([-\d.eE]+)[,\s]+([-\d.eE]+)/.exec(attrs);
    const h = vb && Number(vb[3]) > 0
      ? ` height="${svgu.round(width * (Number(vb[4]) / Number(vb[3])), 2)}"` : '';
    const named = label ? ` role="img" aria-label="${esc(label)}"` : ' aria-hidden="true"';
    return `<svg${attrs.replace(/\s(width|height)="[^"]*"/g, '')
      .replace(/\s(role|aria-label|aria-hidden)="[^"]*"/g, '')} width="${width}"${h}${named}`
      + ` style="width:${css || `${width}px`};height:auto;display:block">`;
  });
}

// The mark as it is actually used: every slot in the ink its colourway gives
// it. A mark with two inks in it is not the same mark drawn in one, and
// flattening it was invisible until a project arrived that had two — which is
// what one project's worth of testing buys you.
function asColourway(ctx, colourway, which) {
  const cw = colourway || ctx.primaryColourway;
  const doc = svgu.parse(artOf(ctx, which).source);
  svgu.applyColourway(doc, cw.slots);
  return svgu.serialize(doc);
}

// the colourway meant to sit on a given ground, by the project's own account
const onGround = (ctx, groundName) =>
  (ctx.project.rules.colourways || []).find((c) => c.on === groundName) || ctx.primaryColourway;

// How well one colourway reads on a ground: its worst ink against it.
// What a colourway actually paints, with "keep" resolved to the colours the
// master paints that slot with: a gradient's stops, or its flat fill.
//
// Left unresolved, "keep" is not a colour, contrast.ratio returns null, and
// Math.min(11.86, null, 2.8) is 0 — so every colourway carrying a gradient
// scored zero against every ground, and the manual, the deck and the misuse
// grid would each have quietly picked a different colourway to show. The worst
// stop is the honest reading: it is the part of the mark that disappears first,
// which is the same question the photography module asks of a mark on a
// picture.
const masterPaint = new WeakMap();
function paintOf(ctx) {
  if (!masterPaint.has(ctx)) {
    masterPaint.set(ctx, svgu.paintBySlot([ctx.project.assets.mark, ctx.project.assets.wordmark]
      .filter(Boolean).map((a) => svgu.parse(a.source))));
  }
  return masterPaint.get(ctx);
}

function inksOf(ctx, cw) {
  const paint = ctx ? paintOf(ctx) : new Map();
  const out = [];
  for (const [slot, v] of Object.entries((cw && cw.slots) || {})) {
    if (v === svgu.KEEP) out.push(...(paint.get(slot) || []).map((h) => contrast.toHex(h)).filter(Boolean));
    else out.push(v);
  }
  return out.filter(Boolean);
}

function worstOn(cw, groundHex, ctx) {
  const inks = inksOf(ctx, cw);
  if (!inks.length) return 0;
  const ratios = inks.map((h) => contrast.ratio(h, groundHex)).filter((r) => r != null);
  return ratios.length ? Math.min(...ratios) : 0;
}

// The colourway that reads best on a given ground, and how well, which is
// arithmetic rather than an opinion.
function readsOn(ctx, groundHex) {
  let best = null;
  for (const cw of ctx.project.rules.colourways || []) {
    const worst = worstOn(cw, groundHex, ctx);
    if (!Object.keys(cw.slots || {}).length) continue;
    if (!best || worst > best.worst) best = { colourway: cw, worst };
  }
  return best;
}

// A ground to present the mark on, and the colourway cut for it.
//
// Presenting on the colour in the primary role assumes the palette holds a
// colour to put the mark on that is not the mark's own ink. An identity built
// from an ink and a paper does not: for Hallward the primary role IS the ink,
// so the manual's headline specimen and four slides of the deck came out as
// plain black rectangles, at 1.00 to 1, with nothing said about it.
const SEEN = 3;                       // a mark needs about this much to read

function showOn(ctx) {
  const hexOf = (n) => (ctx.colours[n] || {}).hex;
  const seen = [];
  for (const cw of ctx.project.rules.colourways || []) {
    if (!Object.keys(cw.slots || {}).length) continue;
    // a colourway may name a ground that is not in the palette at all, and
    // falling back to "the ground role" then showed Cusp's only colourway on
    // its own ink at 1.00 to 1. If the named ground cannot be resolved, try
    // the colours that do exist and take one the mark can be seen on.
    const name = cw.on || ctx.ground.name;
    let hex = hexOf(name) || contrast.toHex(name);
    let usedName = name;
    if (!hex) {
      const options = Object.entries(ctx.colours)
        .map(([n, c]) => ({ n, hex: c.hex, worst: worstOn(cw, c.hex, ctx) }))
        .filter((o) => Number.isFinite(o.worst) && o.worst > 0)
        .sort((a, b) => b.worst - a.worst)[0];
      hex = options ? options.hex : ctx.ground.hex;
      usedName = options ? options.n : ctx.ground.name;
    }
    seen.push({ ground: { name: usedName, hex }, colourway: cw, worst: worstOn(cw, hex, ctx) });
  }
  if (!seen.length) return { ground: ctx.primary, colourway: ctx.primaryColourway, worst: 0 };
  // The first colourway a project lists is its primary one, and the manual
  // should lead with it. This used to keep whichever choice landed on the
  // colour holding the "primary" role and otherwise take the highest contrast
  // it could find — which only agrees with the designer when the primary role
  // happens to be a ground. Six of the twelve projects here led with a
  // colourway their designer did not put first, five of them while the first
  // read perfectly well: Halyard's manual opened in reverse, Perigee's in
  // reverse, Vesper's in flat white rather than in the gradient that is the
  // identity. Take the designer's order, and go looking only when the mark
  // cannot actually be seen.
  const inOrder = (ctx.project.rules.colourways || [])
    .map((cw) => seen.find((s) => s.colourway === cw)).filter(Boolean);
  const first = inOrder.find((s) => s.worst >= SEEN);
  if (first) return first;
  return seen.slice().sort((a, b) => b.worst - a.worst)[0];
}

// ---------------------------------------------------------------- the mark
const markSpecimen = (ctx) => {
  const s = showOn(ctx);
  return `<div class="stage" style="background:${s.ground.hex}">`
    + `${scaled(asColourway(ctx, s.colourway), 150)}</div>`;
};

const lockupRow = (ctx, colourwayName, bg) =>
  `<div class="stage" style="background:${bg}">`
  + `${scaled(asColourway(ctx, (ctx.project.rules.colourways || []).find((c) => c.name === colourwayName)), 120)}</div>`;

// The generic construction drawing: the box the artwork sits in, what it
// actually fills, the margin between the two, and the stroke that sets the
// floor. The reasoning behind those choices is the designer's, and it comes
// from the project content.
// The captions are set in the diagram's own units, in a monospace face at 8, so
// their width is predictable: about six tenths of the size per character. The
// canvas follows the shape of the artwork, which is right — and for a mark
// nearly five times taller than it is wide that canvas is 123 units across
// while its caption needs 173, so the caption was being cut off mid-word. A
// drawing has to be at least as wide as the thing written under it.
const CAP_CHAR = 4.9;
const roomFor = (w, ...captions) =>
  Math.max(w, ...captions.map((c) => String(c).length * CAP_CHAR + 12));

function construction(ctx, opts = {}) {
  const L = lang(ctx, opts.L);
  // currentColor, not a brand role: the role called "primary" is the light one
  // in some identities, and a diagram drawn in it disappears on a light page.
  // The deck passes its own ink, because a slide is not this page.
  const paint = opts.ink || 'currentColor';
  const line = opts.line || 'currentColor';
  const vb = ctx.measured.markViewBox, ink = ctx.measured.markInk;
  // The drawing area is square only because the first two marks were. A mark
  // 252 wide and 90 tall then sat in a strip across the top with its own
  // caption 261 px below it and nothing in between. Fit to the longer side as
  // before, but let the canvas take the shape of what is drawn on it.
  const S = 260, pad = 30, CAP = 26, k = (S - pad * 2) / Math.max(vb.w, vb.h);
  const mod0 = (ctx.system && ctx.system.grid) || null;
  const capText = L.t('capFills', { w: ink.w, h: ink.h,
    feature: L.t(ctx.measured.minimumSize.from === 'stem' ? 'capStem' : 'capStroke'),
    thin: ctx.measured.minimumSize.thinnestStroke })
    + (mod0 ? L.t('capModule', { unit: mod0.unit, across: mod0.across }) : '');
  // Both captions were written twice — once to work out how wide the canvas has
  // to be, and again, in full, inside the <text> that draws them. They agreed
  // for as long as nobody edited one of them. Adding the module to the lower one
  // sized the canvas for a caption it then did not draw.
  const boxText = mod0 ? L.t('capBoxModule', { w: vb.w, across: mod0.across, unit: mod0.unit })
    : L.t('capBox', { w: vb.w });
  const W = svgu.round(roomFor(pad * 2 + vb.w * k, capText, boxText));
  const H = svgu.round(pad * 2 + vb.h * k);
  const X = (v) => svgu.round(pad + (v - vb.x) * k), Y = (v) => svgu.round(pad + (v - vb.y) * k);
  // Six divisions of the box, since the beginning, over artwork built on a
  // module of whatever it was actually built on — a decoration of a diagram
  // under a caption that says the mark was constructed on this grid. Where a
  // project states its module, this draws that, and the build checks that every
  // point in the artwork is on it. Where none is stated it stays six, and the
  // caption says so rather than claiming a construction nobody declared.
  const mod = (ctx.system && ctx.system.grid) || null;
  const divX = mod ? Math.max(1, Math.round(vb.w / mod.unit)) : 6;
  const divY = mod ? Math.max(1, Math.round(vb.h / mod.unit)) : 6;
  const grid = [];
  for (let i = 0; i <= divX; i++) {
    const gx = X(vb.x + (vb.w / divX) * i);
    grid.push(`<path d="M${gx} ${Y(vb.y)}V${Y(vb.y + vb.h)}"/>`);
  }
  for (let i = 0; i <= divY; i++) {
    const gy = Y(vb.y + (vb.h / divY) * i);
    grid.push(`<path d="M${X(vb.x)} ${gy}H${X(vb.x + vb.w)}"/>`);
  }
  // Two things this drawing used to get wrong, both invisible until a master
  // arrived whose viewBox does not begin at 0 0.
  //
  // The artwork is drawn in its own coordinates, and the group placed the top
  // left of the viewBox at the top left of the canvas and then let the artwork
  // fall wherever its own numbers put it — nine units out for Kvist since the
  // round it arrived, and for a logotype, whose box starts 94 units above the
  // baseline, the whole drawing landed outside its own grid. The clear space
  // diagram beside this one has always subtracted the origin; this one never
  // did.
  //
  // Everything the engine delivers is clipped to the artboard, because that is
  // what a viewBox does. This drawing was not, so a mark with anything outside
  // its box — Thornbury has a bar reaching 14 units past it, left in on purpose
  // — was drawn here complete, sticking out through the very rectangle labelled
  // as the box, under a caption saying what it fills. The manual showed a shape
  // that is in no file in the package.
  const clip = `c${Math.abs(Math.round(vb.x * 7 + vb.y * 13 + vb.w * 3 + vb.h))}`;
  return `<svg viewBox="0 0 ${W} ${H + CAP}" class="dia" role="img" aria-label="${esc(
    L.t('diaConstruction', { box: vb.w, w: ink.w, h: ink.h }))}">
    <defs><clipPath id="${clip}"><rect x="${X(vb.x)}" y="${Y(vb.y)}" width="${svgu.round(vb.w * k)}" height="${svgu.round(vb.h * k)}"/></clipPath></defs>
    <g stroke="${line}" stroke-width=".5" opacity=".22">${grid.join('')}</g>
    <rect x="${X(vb.x)}" y="${Y(vb.y)}" width="${svgu.round(vb.w * k)}" height="${svgu.round(vb.h * k)}" fill="none" stroke="${line}" stroke-width=".9" opacity=".55"/>
    <rect x="${X(ink.x)}" y="${Y(ink.y)}" width="${svgu.round(ink.w * k)}" height="${svgu.round(ink.h * k)}" fill="none" stroke="${ctx.accent.hex}" stroke-width="1" stroke-dasharray="4 3"/>
    <g clip-path="url(#${clip})"><g transform="translate(${X(vb.x)} ${Y(vb.y)}) scale(${svgu.round(k, 6)})${vb.x || vb.y ? ` translate(${-vb.x} ${-vb.y})` : ''}">${svgu.innerXML(svgu.parse(inked(ctx, paint)))}</g></g>
    <text x="${W / 2}" y="16" ${TXT} fill="${line}" text-anchor="middle">${esc(boxText)}</text>
    <text x="${W / 2}" y="${H + 16}" ${TXT} fill="${ctx.accent.hex}" text-anchor="middle">${esc(capText)}</text>
  </svg>`;
}

function clearSpace(ctx, opts = {}) {
  const L = lang(ctx, opts.L);
  const paint = opts.ink || 'currentColor';
  const line = opts.line || 'currentColor';
  const ink = ctx.measured.markInk, x = ctx.measured.clearSpace;
  // Clear space is x on every side of the ink box, so the box it makes is the
  // shape of the ink box grown by 2x — not a square. Drawing it square was
  // right for a mark measuring 109 by 109 and quietly wrong for one measuring
  // 228 by 49, where the manual then showed a rule nobody could follow.
  const tw = ink.w + x * 2, th = ink.h + x * 2;
  const S = 260, CAP = 22, k = S / (Math.max(tw, th) * 1.12);
  const csCap = L.t('capClear', { x, ratio: ctx.project.rules.clearSpaceRatio, noun: nounIn(ctx, L) });
  const W = svgu.round(roomFor(tw * k + (S - Math.max(tw, th) * k), csCap));
  const H = svgu.round(th * k + (S - Math.max(tw, th) * k));
  const ox = (W - tw * k) / 2, oy = (H - th * k) / 2;
  const PX = (v) => svgu.round(ox + v * k), PY = (v) => svgu.round(oy + v * k);
  return `<svg viewBox="0 0 ${W} ${H + CAP}" class="dia" role="img" aria-label="${esc(L.t('diaClearSpace',
    { x, ratio: ctx.project.rules.clearSpaceRatio, noun: nounIn(ctx, L) }))}">
    <rect x="${PX(0)}" y="${PY(0)}" width="${svgu.round(tw * k)}" height="${svgu.round(th * k)}" fill="none" stroke="${line}" stroke-width="1" stroke-dasharray="4 3" opacity=".5"/>
    <g transform="translate(${PX(x)} ${PY(x)}) scale(${svgu.round(k, 6)}) translate(${-ink.x} ${-ink.y})">${svgu.innerXML(svgu.parse(inked(ctx, paint)))}</g>
    <g stroke="${ctx.accent.hex}" stroke-width="1.1">
      <path d="M${PX(0)} ${PY(th / 2)}H${PX(x)}"/><path d="M${PX(0)} ${PY(th / 2) - 5}v10"/><path d="M${PX(x)} ${PY(th / 2) - 5}v10"/>
    </g>
    <text x="${PX(x / 2)}" y="${PY(th / 2) - 9}" ${TXT} fill="${ctx.accent.hex}" text-anchor="middle">x</text>
    <text x="${W / 2}" y="${H + 14}" ${TXT} fill="${line}" text-anchor="middle">${esc(csCap)}</text>
  </svg>`;
}

function minimumSize(ctx) {
  const L = lang(ctx);
  const m = ctx.measured.minimumSize;
  const steps = m.steps || [];
  // The specimen was painted in the colourway cut for the brand's ground and
  // then stood on a stage the colour of the page — and the page flips with the
  // reader's light or dark setting, so no fixed ink reads on both. Eight of the
  // thirteen projects here drew this block at under 1.1 to 1 in light mode:
  // three blank rectangles where the one diagram that says how small the mark
  // may go should be. The misuse grid was fixed this way rounds ago; this block
  // was left with the same fault.
  const on = showOn(ctx);
  const art = asColourway(ctx, on.colourway);
  // Draw each step at its true size where the column has room, and at its share
  // of the column where it has not, so the three are either all life-size or all
  // shrunk by one factor. `svg{max-width:100%}` capped them one at a time, which
  // drew Hallward's 1532, 766 and 460 as three copies of the same picture under
  // three different numbers.
  const big = steps.length ? steps[0].px : 1;
  const room = (w) => `min(${w}px,${svgu.round((w / big) * 100, 2)}%)`;
  return `<div class="row3">` + steps.map((s) =>
    `<figure><div class="stage tight" style="background:${on.ground.hex}">${scaled(art, s.px, room(s.px))}</div>
     <figcaption>${esc(L.iso(s.caption))} · ${esc(L.t(s.labelKey || 'stepFloor'))}</figcaption></figure>`).join('') + `</div>
    <p class="note"><b>${esc(L.t('minLead', { px: geo.floorText(m, 'px', L), mm: geo.floorText(m, 'mm', L),
      alone: ctx.noun === 'mark' ? L.t('minAlone') : '' }))}</b> ${esc(L.t('minBody', {
      basis: geo.basisText(m.basisFacts, L), px: ctx.project.rules.minStrokePx, mm: ctx.project.rules.minStrokeMm }))
    }${m.squarish ? '' : esc(L.t('minBothWidth'))}${big > 300 ? esc(L.t('minProportion', { px: big })) : ''}</p>
    ${floorTable(ctx)}`;
}

// One figure was printed here for twenty-three identities, and it is the floor
// of the master — one of the four drawings in the package, and not the one the
// read me tells you to reach for. A lockup sets the name beside the mark at a
// fraction of its height: it is wider, and its finest part is finer, and both
// put the floor up. Every drawing states its own.
function floorTable(ctx) {
  const L = lang(ctx);
  const rows = ctx.project.rules.lockups.map((l) => {
    const f = ctx.floors[l];
    if (!f) return '';
    const over = f.screenPx > ctx.measured.minimumSize.screenPx * 1.05;
    return `<div class="ftr"><b>${esc(naming.folderFor(l))}</b><span>${esc(geo.basisText(f.basisFacts, L))}</span>`
      + `<em class="${over ? 'over' : ''}">${esc(geo.floorText(f, 'px', L))}</em>`
      + `<em>${esc(geo.floorText(f, 'mm', L))}</em></div>`;
  }).join('');
  const over = ctx.project.rules.lockups.filter((l) => ctx.floors[l]
    && ctx.floors[l].screenPx > ctx.measured.minimumSize.screenPx * 1.05);
  return `<div class="ftab">
    <div class="ftr head"><span>${esc(L.t('thFolder'))}</span><span>${esc(L.t('thDisappears'))}</span>`
    + `<span>${esc(L.t('thOnScreen'))}</span><span>${esc(L.t('thInPrint'))}</span></div>
    ${rows}</div>
    <p class="note">${esc(L.t('floorNote', { n: ctx.project.rules.lockups.length,
      over: over.length ? L.t('floorOver', {
        which: over.length === 1 ? L.t('floorOverOne') : L.t('floorOverMany', { n: over.length }),
        px: geo.floorText(ctx.measured.minimumSize, 'px', L) }) : '' }))}</p>`;
}

// The brand's own words, in the brand's own language.
//
// A manual is written in one language and is about a brand that may be in
// another. The document carries the language it is written in; the brand's name,
// its positioning, its rationale and the samples in its type scale carry the
// brand's — which is what makes both claims true, and what stops an English
// paragraph being laid out right to left because the brand is Hebrew.
function own(ctx, text, use) {
  if (text == null || text === '') return '';
  // `use` is the language of the document being written, where that is not the
  // manual's: the deck is made of English literals, so a French project has a
  // French manual and an English deck and each marks the brand's words against
  // its own. See src/strings.js.
  const L = use || ctx.L;
  if (!L || L.speaksBrand) return esc(text);
  return `<span lang="${esc(L.brandLang)}"${L.brandDir && L.brandDir !== L.dir
    ? ` dir="${esc(L.brandDir)}"` : ''}>${esc(text)}</span>`;
}

// Which drawing at which size.
//
// Every manual this engine has written printed a minimum size and stopped
// there, which answers "how small may this go" and leaves the question that
// follows it — "and below that?" — to the reader, in a layout somebody else
// built, at a size nobody chose. A ladder answers it: each rung is drawn here at
// the smallest size it is used at, so the page is the specimen and the
// specification at once.
function ladderBlock(ctx) {
  const L = lang(ctx);
  const rungs = ctx.ladder;
  const bottom = rungs[rungs.length - 1];
  const cells = rungs.map((r) => {
    const band = r.to == null ? L.t('bandAbove', { from: r.from }) : L.t('bandRange', { from: r.from, to: r.to });
    const print = r.printTo == null ? L.t('printAbove', { from: r.printFrom })
      : L.t('printRange', { from: r.printFrom, to: r.printTo });
    return `<figure><div class="stage tight rung">${r.svg ? scaled(r.svg, r.from, `${r.from}px`) : ''}</div>
      <figcaption class="said"><b>${esc(r.name)}</b> — ${esc(band)}, ${esc(print)}.
      ${r.parts != null ? `${esc(L.t(r.parts === 1 ? 'ladderPiece' : 'ladderPieces', { n: r.parts }))} ` : ''}${esc(r.note || '')}
      ${esc(L.t('ladderShown', { px: r.from }))}</figcaption></figure>`;
  }).join('');
  return `<div class="rungs">${cells}</div>
    <p class="note"><b>${esc(L.t('ladderReadLead'))}</b> ${esc(L.t('ladderRead'))}</p>
    <p class="note"><b>${esc(L.t('ladderBelowLead', { px: bottom.from }))}</b> ${esc(L.t('ladderBelowA', { px: rungs[0].from }))}
    <b>${esc(bottom.name)}</b>${esc(L.t('ladderBelowB'))}</p>`;
}

// The mark arriving.
//
// A specification for an animation, printed as prose, is the one thing in a
// brand manual nobody can check by reading it. This is the animation, playing,
// on the page that specifies it — and beneath it the timeline it is playing, so
// the two cannot disagree.
function motionBuild(ctx) {
  const L = lang(ctx);
  const r = ctx.system.motion;
  if (!r || !(r.build || []).length) return '';
  const MO = require('../motion');
  const a = MO.animate(asColourway(ctx, showOn(ctx).colourway), r, { id: 'mo-spec' });
  const total = a.totalMs;
  const lane = r.build.slice().sort((x, y) => x.from - y.from).map((b) => {
    const left = svgu.round((b.from / total) * 100, 2);
    const wide = svgu.round(((b.to - b.from) / total) * 100, 2);
    return `<div class="mrow"><b>${esc(b.part)}</b><span class="mtrack">`
      + `<i style="left:${left}%;width:${wide}%;background:${ctx.accent.hex}"></i></span>`
      + `<em>${b.from}–${b.to} ms</em></div>`;
  }).join('');
  return `<div class="row2"><figure><div class="stage tight" style="background:${showOn(ctx).ground.hex}">`
    + `${scaled(a.svg, 260)}</div><figcaption class="said">${esc(L.t('identPlaying', { ms: total }))}</figcaption></figure>
    <figure><div class="stage tight" style="align-items:stretch"><div style="width:100%">${lane}</div></div>
    <figcaption class="said">${esc(L.t('identParts'))} <code dir="ltr">data-part</code>${esc(L.t('identPartsB'))}</figcaption></figure></div>
    <p class="note"><b>${r.build.map((b) => `${esc(b.part)} ${esc(L.t(HOW_KEY[b.how] || 'howDraws'))}`).join(', ')}.</b>
    ${esc(L.t('identHow'))}</p>
    <p class="note"><b>${esc(L.t('identReducedLead'))}</b>
    ${esc(L.t('identReducedA'))} <code dir="ltr">15-motion</code> ${esc(L.t('identReducedB'))}</p>`;
}

// The brands inside the brand.
function familyBlock(ctx) {
  const L = lang(ctx);
  const list = ctx.family;
  if (!list || !list.length) return '';
  const cards = list.map((f) => {
    const r = f.rows[0];
    return `<figure><div class="stage tight" style="background:${esc(ctx.ground.hex)}">
      ${scaled(r.endorsed.svg, 420, '100%')}</div>
      <figcaption class="said"><b>${esc(f.sub.name)}</b>${f.sub.note ? `, ${esc(f.sub.note)}` : ''}.
      ${esc(L.t('kinSetIn'))} <b>${esc(f.sub.colour)}</b>. ${esc(L.t('kinEndorsed'))} <b>${r.endorsed.floor.screenPx} px</b>;
      ${esc(L.t('kinWithout', { px: r.plain.floor.screenPx }))}</figcaption></figure>`;
  }).join('');
  return `<div class="row2">${cards}</div>
    <p class="note"><b>${esc(L.t('kinRuleLead'))}</b> ${esc(L.t('kinRule', {
      name: ctx.familyRule.nameRatio, endorsement: ctx.familyRule.endorsementRatio,
      gap: ctx.familyRule.gapRatio }))}</p>
    <p class="note"><b>${esc(L.t('kinFinestLead'))}</b> ${esc(L.t('kinFinest', {
      px: ctx.measured.minimumSize.screenPx }))}</p>`;
}

// What it is made as.
//
// Every chapter before this one is about a screen or a page. A school's arms
// spend most of their life in thread, vinyl, stone and metal, and until the
// twenty-sixth round the only thing this manual had to say about any of that was
// a minimum size in millimetres of ink.
function fabrication(ctx) {
  const L = lang(ctx);
  const list = ctx.fabrication;
  if (!list || !list.length) return '';
  const rows = list.map((m) => {
    const what = m.whatKey ? L.t(m.whatKey) : m.what;
    return `<div class="ftr"><b>${esc(m.nameKey ? L.t(m.nameKey) : m.process)} · ${m.at} mm</b>
      <span>${m.note ? `${esc(m.note[0].toUpperCase() + m.note.slice(1))}. ` : ''}${m.drawing
        ? `${esc(L.t('fabCutFrom'))} <b>${esc(m.drawing)}</b>${esc(L.t('fabCutFromB', { mm: m.thinnestMm }))} `
          + `${esc(what[0].toUpperCase() + what.slice(1))}${esc(L.t('fabHolds', { mm: m.feature }))}`
          + `${m.needsOutlining ? esc(L.t('fabOutline')) : ''}`
        : `<b>${esc(L.t('fabNone'))}</b> ${esc(what[0].toUpperCase() + what.slice(1))}.`}</span>
      <em>${m.drawing ? `${m.thinnestMm} mm` : '—'}</em><em>${m.feature} mm</em></div>`;
  }).join('');
  return `<div class="ftab">
    <div class="ftr head"><span>${esc(L.t('thMadeAs'))}</span><span>${esc(L.t('thWhichDrawing'))}</span>`
    + `<span>${esc(L.t('thFinest'))}</span><span>${esc(L.t('thProcessHolds'))}</span></div>
    ${rows}</div>
    <p class="note"><b>${esc(L.t('fabArithmeticLead'))}</b> ${esc(L.t('fabArithmetic'))}
    <code dir="ltr">13-fabrication</code> ${esc(L.t('fabFolder'))}</p>
    <p class="note">${esc(L.t('fabWorkingA'))} <code dir="ltr">brand.json</code>${esc(L.t('fabWorkingB'))}
    <code dir="ltr">feature</code> ${esc(L.t('fabWorkingC'))}</p>`;
}

// The palette, as three other people see it.
//
// Every contrast table this engine has printed answers one question — can text
// be read on this ground — and it is a ratio of luminance. Whether two of these
// colours can be told from each other is a different question with a different
// answer, and no package had ever asked it. See src/vision.js.
function colourVision(ctx) {
  const L = lang(ctx);
  const V = require('../vision');
  const floor = Number(ctx.project.rules.minColourSeparation) > 0
    ? Number(ctx.project.rules.minColourSeparation) : 12;
  const names = Object.keys(ctx.colours);
  const found = V.collapses(ctx.colours, floor);
  const kinds = Object.keys(V.KINDS);
  const swatch = (hex) => `<span class="cvsw" style="background:${hex}"></span>`;
  const row = (label, how) => `<div class="cvr"><b>${esc(label)}</b><div class="cvs">`
    + names.map((n) => `${swatch(how(ctx.colours[n].hex))}`).join('') + `</div></div>`;
  const strip = `<div class="cvtab">
    <div class="cvr head"><b></b><div class="cvs">${names.map((n) =>
      `<span class="cvn">${esc(n)}</span>`).join('')}</div></div>
    ${row(L.t('cvAsYouSee'), (h) => h)}
    ${kinds.map((k) => row(L.t(VIS_KEY[k] || k), (h) => V.simulate(h, k))).join('')}
  </div>`;

  const sets = Object.entries(ctx.project.sets || {}).map(([name, set]) => {
    const covered = set.apartBy && set.of.every((c) => set.apartBy[c]);
    return `<p class="note"><b>${esc(L.t('cvSetLead', { name }))}</b> ${esc(set.why)} `
      + (covered
        ? `${esc(L.t('cvCoveredA'))} ${set.of.map((c) =>
          `<b>${esc(c)}</b> ${esc(L.t('cvIs'))} ${esc(set.apartBy[c])}`).join(', ')}${esc(L.t('cvCoveredB'))}`
        : esc(L.t('cvNotCovered')))
      + '</p>';
  }).join('');

  const list = found.length
    ? `<p class="note"><b>${esc(L.t('cvSomeLead', { which: found.length === 1 ? L.t('cvOnePair')
      : L.t('cvManyPairs', { n: found.length }) }))}</b> `
      + found.map((f) => esc(L.t('cvPair', {
        pair: L.t('cvPairNames', { a: f.pair[0], b: f.pair[1] }), normal: f.normal,
        worst: f.worst.distance, kind: L.t(SAY_KEY[f.worst.kind] || 'sayProtanopia'),
        share: L.t(SHARE_KEY[f.worst.kind] || 'shareProtanopia') }))).join('; ')
      + `${esc(L.t('cvPairTail'))}</p>`
    : `<p class="note"><b>${esc(L.t('cvAllLead'))}</b> `
      + `${esc(L.t('cvAll'))}</p>`;

  return strip + list + sets
    + `<p class="note">${esc(L.t('cvMethod', { floor }))}</p>`;
}

// Half of each of these is not ours, and almost nothing above applies to it.
function partnerLockups(ctx) {
  const L = lang(ctx);
  const r = ctx.partnerRule || {};
  // These are not to one scale and cannot be: a logotype partner makes a pair
  // two and a half times wider than a roundel one, and at a single factor the
  // narrow ones are a smear. The minimum size block shrinks its three by one
  // factor because they are the same drawing three times; these are four
  // different drawings, so each is shown at a size it can be read at and the
  // proportion is stated instead of drawn. Every specimen in this manual sits
  // over its own measurements; this one does too.
  const narrowest = Math.min(...ctx.pairs.map((p) => p.composed.width));
  const cards = ctx.pairs.map((p) => {
    const ground = (ctx.colours[p.colourway.on] || {}).hex || '#FFFFFF';
    const missing = ctx.project.rules.colourways.map((c) => c.name).filter((c) => !p.partner.versions[c]);
    const times = svgu.round(p.composed.width / narrowest, 1);
    return `<figure><div class="stage tight" style="background:${ground}">`
      + `${scaled(p.composed.svg, 400, '100%')}</div>
      <figcaption class="said"><b>${esc(p.partner.name)}</b>, ${esc(L.t('ptOn', {
        way: p.colourway.name, ground: p.colourway.on }))}
      ${esc(L.t('ptSmallestA'))} <b>${p.floor.screenPx} px</b> ${esc(L.t('ptSmallestB', {
        mm: p.floor.printMm, by: p.floor.setByKey ? L.t(p.floor.setByKey) : p.floor.setBy }))}
      ${esc(L.t('ptPlaced', { scale: p.composed.scale, w: Math.round(p.composed.width) }))
      }${times > 1.05 ? esc(L.t('ptTimes', { n: times })) : ''}.${missing.length
        ? esc(L.t('ptMissing', { which: missing.length === 1 ? missing[0]
          : L.t('ptOr', { a: missing.slice(0, -1).join(', '), b: missing[missing.length - 1] }) })) : ''}
      </figcaption></figure>`;
  }).join('');
  const owners = [...new Set(ctx.project.partners.map((p) => p.owner))];
  return `<div class="row2">${cards}</div>
    <p class="note">${esc(L.t('ptScaleNote', { n: ctx.pairs.length,
      ratio: svgu.round(Math.max(...ctx.pairs.map((x) => x.composed.width)) / narrowest, 1) }))}</p>
    <p class="note"><b>${esc(L.t('ptRuleLead'))}</b> ${esc(L.t('ptRule', {
      match: r.match || L.t('ptMatchHeight'),
      at: r.matchRatio !== 1 ? L.t('ptRuleAt', { n: r.matchRatio }) : '',
      gap: ctx.pairs[0] ? ctx.pairs[0].composed.gap : '',
      divider: ctx.pairs[0] && ctx.pairs[0].composed.ruleWidth
        ? L.t('ptDividerRule', { n: ctx.pairs[0].composed.ruleWidth }) : L.t('ptDividerPlain'),
      with: r.with || L.t('ptWithPrimary') }))}</p>
    <p class="note"><b>${esc(L.t('ptNotLead'))}</b> ${esc(L.t('ptNot', { owners: owners.join(', ') }))}</p>
    <p class="note"><b>${esc(L.t('ptFloorLead'))}</b> ${esc(L.t('ptFloor'))}</p>`;
}

function lockups(ctx) {
  const L = lang(ctx);
  const grid = `<div class="row2">` + ctx.project.rules.lockups.map((l) => {
    const v = ctx.variantFor(l, ctx.primaryColourway.name);
    return `<figure><div class="stage">${scaled(v, 190)}</div><figcaption>${esc(l)}</figcaption></figure>`;
  }).join('') + `</div>`;
  // Where the name is set rather than drawn, that rule *is* the lockup, and it
  // is the most important thing this page has to say. Nothing said it, because
  // until now every identity handed the engine a drawing of its name.
  const n = ctx.project.nameSetting;
  if (!n) return grid;
  const fam = ((ctx.project.tokens.type || {}).families || {})[n.family] || {};
  return `${grid}
    <p class="note"><b>${esc(L.t('nameLead'))}</b> ${esc(L.t('nameSetInA'))}
    <b>${esc(n.drawn.family)}</b> ${esc(L.t('nameSetInB', { w: n.drawn.weight,
      caps: n.transform === 'uppercase' ? L.t('nameCaps') : '',
      track: svgu.round(Number(n.tracking) * 1000, 0) }))}
    <b>${esc(L.t('namePerCent', { n: svgu.round(Number(n.heightRatio) * 100, 1) }))}</b> ${esc(L.t('nameSetInC', {
      h: ctx.measured.markInk.h,
      stands: svgu.round(ctx.measured.markInk.h * Number(n.heightRatio), 2) }))}
    <code dir="ltr">04-wordmark</code> ${esc(L.t('nameSetInD', {
      family: fam.family || n.drawn.family, role: n.family }))}</p>`;
}

// One rule, one picture, and the same fact in both.
//
// This grid used to be six fixed treatments captioned with whatever sentences
// the project listed, matched by array position and nothing else. Across the
// thirty packages built before that changed, 33 cells showed a picture that
// contradicted its own caption. A rule now names the treatment; the engine
// performs it on this identity's own artwork and writes the sentence from the
// treatment it performed. The designer's reason follows in their own words,
// which is the half a machine cannot supply. See src/misuse.js.
function misuseCells(ctx, W, use) {
  const list = ctx.misuse || [];
  if (!list.length) return [];
  // The language of the document these cells are being drawn into, which is not
  // always the manual's. Reading ctx.L put five French captions on Verdon's
  // deck under lang="en": both documents share this list, and only one of them
  // had ever been asked what language it was in. See src/strings.js.
  const L = use || ctx.L;

  // These cells were painted in the colour in the primary role, on a stage
  // whose colour is the page's rather than the brand's — and the page's flips
  // with the reader's light or dark setting, so no fixed ink can read on both.
  // Five of Halyard's six cells have been blank since the day it was added,
  // and Northline's the same: near-white artwork on a near-white stage at
  // 1.01 to 1. Give the cells a ground of the brand's own and an ink that
  // reads on it, the way the specimen does.
  const s = showOn(ctx);
  const inks = Object.values(s.colourway.slots);
  const best = inks.slice().sort((a, b) =>
    contrast.ratio(b, s.ground.hex) - contrast.ratio(a, s.ground.hex))[0] || ctx.primary.hex;
  // The busy cell paints its own stripes, so the ink has to be measured against
  // the darker of them rather than against what is behind it — and a fixed pair
  // of stripes is a coin toss over whether the mark can be seen at all. Meridian
  // lost it: its best ink sat at 2.68 to 1 on the green this used to be, which
  // is a cell showing nothing under a caption about contrast. Offer a light pair
  // and a dark one and take the combination that reads, all of it from the
  // brand's own colours plus the two grounds.
  const PAIRS = [['#7E8C7A', '#5E6B5B'], ['#3A463C', '#26302A']];
  const inkPool = [...new Set(inks.concat([ctx.ground.hex, ctx.primary.hex]))];
  const busy = PAIRS.map(([light, dark]) => {
    const ink = inkPool.slice().sort((a, b) =>
      Math.min(contrast.ratio(b, light), contrast.ratio(b, dark))
      - Math.min(contrast.ratio(a, light), contrast.ratio(a, dark)))[0];
    return { light, dark, ink,
      worst: Math.min(contrast.ratio(ink, light), contrast.ratio(ink, dark)) };
  }).sort((a, b) => b.worst - a.worst)[0];
  const STRIPES = `background:repeating-linear-gradient(52deg,${busy.light} 0 12px,${busy.dark} 12px 24px);`;
  const onBusy = busy.ink;
  // a wrong colour nobody can see makes no point at all: Meridian's fixed
  // magenta sits at 2.96 to 1 on its own dark ground
  const WRONG = ['#B0439A', '#E86FD0', '#7CE04B', '#F2C230'];
  const wrong = WRONG.slice().sort((a, b) =>
    contrast.ratio(b, s.ground.hex) - contrast.ratio(a, s.ground.hex))
    .find((h) => contrast.ratio(h, s.ground.hex) >= SEEN) || WRONG[0];
  const outline = `filter:drop-shadow(1px 0 0 ${best}) drop-shadow(-1px 0 0 ${best})`
    + ` drop-shadow(0 1px 0 ${best}) drop-shadow(0 -1px 0 ${best})`;

  // A cell is what was done, what to say about it, and how the stage it stands
  // on has to change to show it. Both documents draw from this one list, so the
  // deck and the manual cannot disagree about what a rule forbids.
  const stage = (inner, ground) => ({ inner, ground: ground || `background:${s.ground.hex};` });
  // inline-block because a transform does not apply to an inline box, and the
  // deck's cells are not the flex container the manual's stages are
  const treated = (style, ink, ground) =>
    stage(`<span style="display:inline-block;${style}">${scaled(inked(ctx, ink), W)}</span>`, ground);

  const cell = (r) => {
    switch (r.do) {
      case 'stretch':
        return { says: L.t('sayStretch'), body: treated('transform:scaleX(1.5)', best) };
      case 'rotate':
        return { says: L.t('sayRotate'), body: treated('transform:rotate(16deg)', best) };
      case 'recolour':
        return { says: L.t('sayRecolour'), body: treated('', wrong) };
      case 'shadow':
        return { says: L.t('sayShadow'),
          body: treated('filter:drop-shadow(3px 4px 4px rgba(0,0,0,.45))', best) };
      case 'outline':
        return { says: L.t('sayOutline'), body: treated(outline, s.ground.hex) };
      case 'busy':
        return { says: L.t('sayBusy'), body: treated('', onBusy, STRIPES) };
      case 'crowd':
        return { says: L.t('sayCrowd', { x: ctx.measured.clearSpace }),
          body: stage(crowded(ctx, best, L)) };
      case 'undersize':
        // the floor is a width, and for a mark far from square the height that
        // goes with it is the half somebody sets by mistake
        return { says: L.t('sayUndersize', { px: geo.floorText(ctx.measured.minimumSize, 'px', L) }),
          body: stage(undersized(ctx, best, L)) };
      case 'redraw':
        return { says: L.t('sayRedraw', { part: r.part }),
          body: stage(scaled(withoutPart(ctx, r.part, best), W)) };
      case 'retype':
        return { says: L.t('sayRetype'), body: stage(retyped(ctx, best)) };
      default:
        return null;
    }
  };

  return list.map((r) => {
    const c = cell(r);
    return c && Object.assign({ says: c.says, why: r.why || null, rule: r.do }, c.body);
  }).filter(Boolean);
}

// Eight of the thirty manuals carried a numbered heading, a "drawn by the
// system" badge and an empty box, because a project with no misuse rules still
// got the section. No rules, no section — see documents/index.js.
function misuse(ctx) {
  return `<div class="row3">` + misuseCells(ctx, 62).map((c) =>
    // The sentence is the engine's, because it is a statement about the picture
    // beside it. The reason is the project's, and it is the brand's own words,
    // so it carries the brand's language where that is not the document's.
    (() => {
      // the rule is the engine's and cannot be edited: it is a statement about
      // the picture beside it. The reason is the designer's, and is theirs to
      // change. See src/overrides.js.
      const key = `misuse/${c.rule}/why`;
      const v = require('../overrides').value(ctx.ov, key, c.why);
      // The key goes on the reason alone. Put it on the whole caption and
      // editing the reason replaces the rule with it: the engine's sentence is
      // a statement about the picture and is not anybody's to rewrite.
      const why = v.value || (ctx.editing ? '' : null);
      return `<figure><div class="stage tight dont" style="${c.ground}">${c.inner}</div>
     <figcaption class="said"><b>${esc(c.says)}</b>`
        + (why === null ? ''
          : `<span data-edit="${esc(key)}"${v.edited ? ' data-edited="1"' : ''}`
            + `${v.value ? '' : ' data-empty="1"'}>${v.value ? own(ctx, v.value) : ''}</span>`)
        + `</figcaption></figure>`;
    })()).join('')
    + `</div>`;
}

// The rule with something inside it. Thirteen projects wrote "do not crowd it"
// and got a mark on a striped ground, because crowding was the one thing on
// this page the engine could not draw. The box is the clear space rule the
// manual states two sections earlier, drawn from the same two numbers.
function crowded(ctx, ink, use) {
  const L = lang(ctx, use);
  const box = ctx.measured.markInk, x = ctx.measured.clearSpace;
  const tw = box.w + x * 2, th = box.h + x * 2;
  const W = 150, k = W / tw, H = svgu.round(th * k, 2);
  const PAD = 12, VW = W + PAD * 2, VH = H + PAD * 2;
  const bite = svgu.round(x * k * 0.85, 2);       // how far in the intruders come
  const R = (v) => svgu.round(v, 2);
  return `<svg viewBox="0 0 ${VW} ${R(VH)}" class="dia" role="img" aria-label="${esc(
    L.t('diaCrowd', { x, noun: nounIn(ctx, L) }))}"
    style="width:100%;max-width:${VW}px;height:auto;display:block">
    <g fill="${ink}" opacity=".72">
      <rect x="${R(PAD + W - bite)}" y="${PAD}" width="${R(bite + PAD)}" height="${R(H * 0.62)}"/>
      <rect x="${PAD}" y="${R(PAD + H - bite)}" width="${R(W * 0.78)}" height="${R(bite * 0.42)}"/>
      <rect x="${PAD}" y="${R(PAD + H - bite + bite * 0.72)}" width="${R(W * 0.52)}" height="${R(bite * 0.42)}"/>
    </g>
    <g transform="translate(${R(PAD + x * k)} ${R(PAD + x * k)}) scale(${svgu.round(k, 6)}) translate(${-box.x} ${-box.y})">${svgu.innerXML(svgu.parse(inked(ctx, ink)))}</g>
    <rect x="${PAD}" y="${PAD}" width="${W}" height="${H}" fill="none" stroke="${ink}"
      stroke-width="1" stroke-dasharray="4 3" opacity=".55"/>
  </svg>`;
}

// Below the floor, against the floor. Both numbers are measured, and the third
// step of the minimum size block is already the one that says "below".
function undersized(ctx, ink, use) {
  const L = lang(ctx, use);
  const m = ctx.measured.minimumSize;
  const steps = m.steps || [];
  const floorPx = (steps[1] && steps[1].px) || m.screenPx || 1;
  const belowPx = (steps[2] && steps[2].px) || Math.round(floorPx * 0.6);
  const vb = ctx.measured.markViewBox || svgu.viewBox(svgu.parse(artOf(ctx).source));
  const W = 108, H = svgu.round(W * (vb.h / vb.w), 2);
  const small = svgu.round(W * (belowPx / floorPx), 2), sh = svgu.round(H * (belowPx / floorPx), 2);
  const R = (v) => svgu.round(v, 2);
  return `<svg viewBox="0 0 ${W} ${H}" class="dia" role="img" aria-label="${esc(
    L.t('diaUndersize', { noun: nounIn(ctx, L), small: belowPx, floor: floorPx }))}"
    style="width:100%;max-width:${W}px;height:auto;display:block">
    <rect x="0.5" y="0.5" width="${R(W - 1)}" height="${R(H - 1)}" fill="none" stroke="${ink}"
      stroke-width="1" stroke-dasharray="4 3" opacity=".55"/>
    <g transform="translate(${R((W - small) / 2)} ${R((H - sh) / 2)}) scale(${svgu.round(small / vb.w, 6)}) translate(${-vb.x} ${-vb.y})">${svgu.innerXML(svgu.parse(inked(ctx, ink)))}</g>
  </svg>`;
}

// The mark with one of its own named parts taken out of it. Only an artwork
// that says what its parts are can have this rule written about it, which is
// the point: you can forbid redrawing a thing the file has named, and nothing
// else. See data-part in src/svg.js.
function withoutPart(ctx, part, ink) {
  const doc = svgu.parse(artOf(ctx).source);
  const drop = [];
  (function walk(el) {
    if (!el || el.nodeType !== 1) return;
    if (el.getAttribute && el.getAttribute('data-part') === part) { drop.push(el); return; }
    for (let c = el.firstChild; c; c = c.nextSibling) walk(c);
  })(doc.documentElement);
  for (const el of drop) if (el.parentNode) el.parentNode.removeChild(el);
  svgu.applyColourway(doc, Object.fromEntries(ctx.measured.slots.map((k) => [k, ink])));
  return svgu.serialize(doc);
}

// The name as somebody types it when the artwork is not to hand: in whatever
// face the machine already had. Marked as the brand's own words, because it is
// the brand's name in a document that may not be in the brand's language.
function retyped(ctx, ink) {
  return `<div style="font-family:system-ui,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;`
    + `font-size:21px;line-height:1.1;font-weight:600;color:${ink};text-align:center">`
    + `${own(ctx, ctx.project.brand)}</div>`;
}


// ---------------------------------------------------------------- colour
function palette(ctx) {
  const L = lang(ctx);
  // CMYK is either given or guessed, and a chip that shows both the same way
  // is how a guess ends up on a press. See src/cmyk.js.
  const ink = require('../cmyk').byName(require('../cmyk').table(ctx.colours));
  const guessed = Object.keys(ctx.colours).filter((n) => !ink[n].declared);
  return `<div class="chips">` + Object.entries(ctx.colours).map(([name, t]) => {
    const rgbv = contrast.rgb(t.hex).join(' '), k = ink[name];
    return `<div class="chip"><div class="sw" style="background:${t.hex}"></div>
      <b>${esc(name)}</b><span class="role">${esc(t.role && ROLE_KEY[t.role] ? L.t(ROLE_KEY[t.role]) : (t.role || ''))}</span>
      <dl><dt>HEX</dt><dd>${t.hex}</dd><dt>RGB</dt><dd>${rgbv}</dd>
      <dt>CMYK</dt><dd class="${k.declared ? 'typed' : 'guess'}">${k.values.join(' ')}${k.declared ? '' : ' ?'}</dd>
      ${t.pantone ? `<dt>PMS</dt><dd class="typed">${esc(t.pantone)}</dd>` : ''}</dl></div>`;
  }).join('') + `</div>`
    + `<p class="note">${esc(L.t('palNoteA'))} <b>${esc(L.t('palTypedLead'))}</b>${esc(L.t('palNoteB'))}`
    + (guessed.length
      ? ` <b>${esc(L.t('palGuessLead', { names: guessed.join(', '),
        has: L.t(guessed.length === 1 ? 'palHas' : 'palHave') }))}</b>${esc(L.t('palGuess', {
        it: L.t(guessed.length === 1 ? 'palIt' : 'palThem') }))}`
      : ` ${esc(L.t('palEveryOne'))}`)
    + `</p>`;
}

// A gradient in the master is part of the palette and belongs on the palette
// page, drawn rather than described — the manual said nothing about one at all,
// so a designer reading it could not tell which file carried the gradient, and
// the one-colour version looked like a mistake rather than a decision.
function gradientSpec(ctx) {
  const L = lang(ctx);
  const gs = [ctx.project.assets.mark, ctx.project.assets.wordmark].filter(Boolean)
    .flatMap((a) => svgu.gradients(svgu.parse(a.source)));
  if (!gs.length) return '';
  const ways = ctx.project.rules.colourways;
  return gs.map((g) => {
    const keeps = ways.filter((c) => g.slots.some((sl) => c.slots[sl] === svgu.KEEP)).map((c) => c.name);
    const flat = ways.filter((c) => !keeps.includes(c.name)).map((c) => c.name);
    const bar = g.stops.map((st) =>
      `${st.hex} ${svgu.round((st.offset == null ? 0 : st.offset) * 100)}%`).join(', ');
    return `<figure><div class="stage tight" style="padding:0">
      <div style="width:100%;height:104px;background:linear-gradient(120deg,${bar})"></div></div>
      <figcaption>${esc(L.t('gradCap', { slots: g.slots.join(', '), n: g.stops.length, kind: g.kind }))}</figcaption></figure>
      <p class="note"><b>${g.stops.map((st) => esc(st.hex || '?')).join(' \u2192 ')}</b> ${esc(L.t('gradAt', {
        offsets: g.stops.map((st) => `${svgu.round((st.offset == null ? 0 : st.offset) * 100)}%`).join(', ') }))} ${keeps.length
        ? `${esc(L.t('gradCarriedA'))} <b>${esc(joinAnd(keeps, L))}</b>${esc(L.t('gradCarriedB', {
          flat: joinAnd(flat, L) || L.t('gradNothingElse') }))}`
        : `<b>${esc(L.t('gradNoneLead'))}</b>${esc(L.t('gradNone'))}`} `
      + `${esc(L.t('gradSpot'))}</p>`;
  }).join('');
}

// ------------------------------------------------------------- the system
// The rule blocks reached the canvas, the deck's file count and brand.json, and
// neither of the two documents a client reads. Fathom's whole identity is its
// pattern and its manual never mentioned one; four projects declare a
// photography treatment and no manual described it. Each of these draws only
// where the project has that system, so nothing grows an empty section.

function patternSpec(ctx) {
  const L = lang(ctx);
  const gen = ctx.pattern;
  if (!gen || !gen.ok || !gen.tiles.length) return '';
  const r = ctx.system.pattern;
  const on = showOn(ctx);
  const pat = require('../pattern');
  const master = ctx.project.assets[ctx.measured.master || 'mark'] || ctx.project.assets.mark;
  const ink = on.colourway.slots[ctx.measured.slots[0]] || Object.values(on.colourway.slots)[0];
  const sp = pat.spec(master.source, r, ctx.measured);
  const order = Object.keys(r.densities);

  // The shape the field is made of, drawn on its own at the size a reader can
  // see it, because the first question anybody asks of a pattern is what it is
  // made of and no manual this engine wrote had ever answered it.
  const motifSvg = (() => {
    const b = sp.motif.box, vb = sp.motif.viewBox;
    return `<svg xmlns="${svgu.NS}" viewBox="${svgu.round(b.x - b.w * 0.08, 2)} ${svgu.round(b.y - b.h * 0.08, 2)} `
      + `${svgu.round(b.w * 1.16, 2)} ${svgu.round(b.h * 1.16, 2)}" role="img" `
      + `aria-label="${esc(L.t('patMotifLabel', { name: pat.motifName(sp.motif, L) }))}" `
      + `style="width:100%;max-width:120px;height:auto;display:block">`
      + pat.painted(sp.motif, ink, (sp.motif.stroked ? Math.max(b.w, b.h) * sp.strokeRatio : 0), sp.render)
      + `</svg>`;
  })();

  const cells = order.map((density) => {
    const scaled = Object.assign({}, r, { tile: svgu.round(sp.cell * r.densities[density]) });
    const sw = pat.swatch(master.source, scaled, ink, on.ground.hex, 300, 190, `d-${density}`, ctx.measured);
    return `<figure><div class="stage tight" style="padding:0;overflow:hidden">${sw || ''}</div>
      <figcaption>${esc(L.t('patCell', { density, n: scaled.tile }))}</figcaption></figure>`;
  }).join('');

  const ways = [...new Set(gen.tiles.map((t) => t.colourway))];
  const how = pat.CONSTRUCTIONS[sp.construction];
  const chosen = !r.motif && !r.construction;
  // .two is the deck's class; the manual lays out on .row2, and this block
  // spent its first build as one column because of it
  return `<div class="row2" style="align-items:start;margin-bottom:16px">
      <div><div class="stage tight" style="background:${on.ground.hex}">${motifSvg}</div>
        <p class="note" style="margin-top:8px"><b>${esc(pat.motifName(sp.motif, L))}</b> — ${esc(pat.whyText(sp.whyFacts, L))}</p></div>
      <div><p class="note" style="margin-top:0"><b>${esc(sp.construction)}</b>: ${esc(pat.drawsText(sp.construction, L))}.
        ${esc(L.t('patWeight', { noun: nounIn(ctx, L) }))}${chosen ? esc(L.t('patChosen', { n: sp.all.length,
          shapes: L.t(sp.all.length === 1 ? 'patShape' : 'patShapes'), m: pat.NAMES.length })) : ''}</p></div>
    </div>
    <div class="row3">${cells}</div>
    <p class="note">${esc(L.t('patDensities', { d: order.length, c: ways.length,
      colourways: L.t(ways.length > 1 ? 'patColourways' : 'patColourway') }))}
    <b>${esc(L.t('patTiles', { n: gen.tiles.length }))}</b>${esc(L.t('patAllIn', {
      noun: nounIn(ctx, L), n: gen.tiles.length }))}</p>`;
}

function photographySpec(ctx) {
  const L = lang(ctx);
  const r = ctx.system.photography;
  if (!r || !r.declared) return '';
  const PH = require('../photography');
  const steps = 11;
  const ramp = [];
  for (let i = 0; i < steps; i++) {
    const v = i / (steps - 1);
    const t = PH.treatPixel(r, { colours: ctx.colours, roles: ctx.roles }, { r: v, g: v, b: v });
    ramp.push(`<i style="flex:1;background:rgb(${Math.round(t.r * 255)},${Math.round(t.g * 255)},${Math.round(t.b * 255)})"></i>`);
  }
  const scrim = PH.scrimStyle(r, { colours: ctx.colours, roles: ctx.roles }, undefined);
  // A photograph the project ships, run through its own rules, where there is
  // one. Until a project could ship a photograph this page had a grey ramp and
  // nothing else — a treatment specimen with nothing treated in it.
  // filter() hands back the <filter> definition, not a CSS value: emit it once
  // and point at it, exactly as the canvas does.
  const bun = { colours: ctx.colours, roles: ctx.roles };
  const fid = 'phman';
  const defs = r.duotone ? PH.filter(r, bun, fid) : '';
  const shots = (ctx.project.photography || []).slice(0, 2).map((ph, i) => `<figure>
      <div class="stage tight" style="padding:0;position:relative;overflow:hidden">
        ${i === 0 ? defs : ''}<img src="${ph.src}" alt="${esc(ph.caption || ph.file)}" style="width:100%;height:190px;object-fit:cover;display:block${r.duotone ? `;filter:url(#${fid})` : ''}">
        ${scrim ? `<div style="position:absolute;inset:0;background:${scrim.background}"></div>` : ''}
      </div><figcaption class="said">${esc(ph.caption || ph.file)}</figcaption></figure>`).join('');
  const ramps = `<figure><div class="stage tight" style="padding:0;position:relative">
      <div style="display:flex;width:100%;height:${shots ? 190 : 120}px">${ramp.join('')}</div>
      ${scrim ? `<div style="position:absolute;inset:0;background:${scrim.background}"></div>` : ''}
    </div><figcaption>${esc(L.t('phRamp'))}${scrim ? esc(L.t('phUnderScrim')) : ''}</figcaption></figure>`;
  const top = shots ? `<div class="row3">${shots}${ramps}</div>` : ramps;
  return `${top}
    <p class="note">${r.duotone
      ? `${esc(L.t('phDuoA'))} <b>${esc(r.duotone.shadow)}</b> ${esc(L.t('phDuoB'))} <b>${esc(r.duotone.highlight)}</b> ${esc(L.t('phDuoC', { pct: Math.round((r.duotone.amount == null ? 1 : r.duotone.amount) * 100) }))} `
      : `${esc(L.t('phUntreated'))} `}${scrim
      ? `${esc(L.t('phScrim', { colour: String(r.scrim.colour), pct: Math.round(r.scrim.opacity * 100),
        dir: L.t(EDGE_KEY[r.scrim.direction] || 'edgeBottom') }))} `
      : ''}${esc(L.t('phCrops', { ratios: (r.ratios || []).join(', ') }))} ${esc(L.t('phEditor'))}</p>`;
}

// Whether this project writes icons at all — a property of its rules, which is
// always there, rather than of a file list that may not have been passed.
const willWriteIcons = (ctx) => {
  const r = (ctx.project && ctx.project.rules) || {};
  return ((r.iconSizes || []).length + (r.faviconSizes || []).length) > 0;
};

function iconSpec(ctx) {
  const L = lang(ctx);
  const r = ctx.system.icons;
  if (!r) return '';
  // Where the identity has a separate drawing for small sizes, say so here.
  // The engine has been telling designers to draw one since the thirteenth
  // round; now that a project can carry it, the manual has to explain why the
  // icons are not the mark.
  const simplified = ctx.project.assets.icon
    ? `<p class="note">${esc(L.t('iconSimplifiedA'))} <code dir="ltr">05-icons</code> ${esc(L.t('iconSimplifiedB'))}</p>` : '';
  const k = 200 / r.box, m = (r.box - r.live) / 2;
  const line = ctx.accent.hex;
  return `<figure><div class="stage tight">
      <svg viewBox="0 0 ${200 + 60} ${200 + 26}" class="dia" role="img" aria-label="${esc(L.t('diaIconGrid',
        { box: r.box, live: r.live, stroke: r.stroke }))}">
        <rect x="30" y="6" width="200" height="200" fill="none" stroke="${line}" stroke-width=".9" opacity=".5"/>
        <rect x="${svgu.round(30 + m * k)}" y="${svgu.round(6 + m * k)}" width="${svgu.round(r.live * k)}" height="${svgu.round(r.live * k)}" fill="none" stroke="${line}" stroke-width="1" stroke-dasharray="4 3"/>
        <g stroke="currentColor" stroke-width="${svgu.round(r.stroke * k, 2)}" stroke-linecap="${esc(r.cap)}" stroke-linejoin="${esc(r.join)}" fill="none">
          <path d="M${svgu.round(30 + m * k)} ${svgu.round(6 + m * k)}L${svgu.round(30 + (r.box / 2) * k)} ${svgu.round(6 + (r.box - m) * k)}L${svgu.round(30 + (r.box - m) * k)} ${svgu.round(6 + m * k)}"/>
        </g>
        <text x="${(200 + 60) / 2}" y="${200 + 20}" ${TXT} fill="${line}" text-anchor="middle">${esc(L.t('capIconGrid',
          { box: r.box, live: r.live, stroke: r.stroke }))}</text>
      </svg></div><figcaption>${esc(L.t('iconFigure'))}</figcaption></figure>
    <p class="note">${esc(L.t('iconA', { noun: nounIn(ctx, L), vb: r.derivedFrom.viewBox,
      ink: r.derivedFrom.ink, margin: r.derivedFrom.markMargin }))} <b>${esc(L.t('namePerCent',
      { n: svgu.round(r.marginFraction * 100, 1) }))}</b>${esc(L.t('iconB', { stroke: r.derivedFrom.markStroke }))}
    <b>${esc(L.t('namePerCent', { n: svgu.round(r.strokeRatio * 100, 1) }))}</b> ${esc(L.t('iconC', {
      s: r.stroke, b: r.box, cap: r.cap, join: r.join,
      fill: L.t(r.filled ? 'iconFilled' : 'iconOutline'), noun: nounIn(ctx, L) }))}
    <code dir="ltr">check &lt;icon.svg&gt; --icon</code> ${esc(L.t('iconD'))}</p>
    ${simplified}`;
}

function motionSpec(ctx) {
  const L = lang(ctx);
  const r = ctx.system.motion;
  // Every project has motion rules because they have defaults, and nothing in
  // the package is motion. Say them where the project asked for them; a
  // bookbinder that never mentioned movement does not get a chapter about it.
  if (!r || !(ctx.project.system || {}).motion) return '';
  const sys = require('../system');
  const curve = (e, label) => {
    const [x1, y1, x2, y2] = e;
    const P = (x, y) => `${svgu.round(10 + x * 80, 2)} ${svgu.round(90 - y * 80, 2)}`;
    return `<figure><div class="stage tight">
      <svg viewBox="0 0 100 118" class="dia" role="img" aria-label="${esc(L.t('diaCurve',
        { label, points: e.join(', ') }))}">
        <path d="M${P(0, 0)}L${P(1, 0)}M${P(0, 0)}L${P(0, 1)}" stroke="currentColor" stroke-width=".6" opacity=".3"/>
        <path d="M${P(0, 0)}C${P(x1, y1)} ${P(x2, y2)} ${P(1, 1)}" fill="none" stroke="${ctx.accent.hex}" stroke-width="2"/>
      </svg></div><figcaption>${esc(label)} · ${sys.bezier(e)}</figcaption></figure>`;
  };
  const durations = Object.entries(r.durations)
    .map(([n, ms]) => `<div style="display:flex;justify-content:space-between;gap:12px;padding:4px 0">`
      + `<span>${esc(n)}</span><b>${ms} ms</b></div>`).join('');
  return `<div class="row3">${Object.entries(r.easing).map(([n, e]) => curve(e, n)).join('')}
    <figure><div class="stage tight"><div style="width:100%;font-size:13px">${durations}</div></div>
    <figcaption>${esc(L.t('motDurations'))}</figcaption></figure></div>
    ${r.build.length ? `<p class="note">${esc(L.t('motBuildsA', { n: r.build.length }))} ${r.build.map((s) =>
      `<b>${esc(s.part)}</b> ${esc(L.t(HOW_KEY[s.how] || 'howDraws'))} ${esc(L.t('motStepFrom',
        { from: s.from, to: s.to }))} <i>${esc(s.ease)}</i>`).join(', ')}${esc(L.t('motBuildsB',
      { loop: L.t(r.loop ? 'motLoops' : 'motPlaysOnce') }))}
    <code dir="ltr">15-motion</code> ${esc(L.t('motBuildsC'))}</p>`
    : `<p class="note">${esc(L.t('motNoBuildA'))} <code dir="ltr">data-part</code> ${esc(L.t('motNoBuildB'))}
    <code dir="ltr">system.motion.build</code>${esc(L.t('motNoBuildC'))}</p>`}
    <p class="note">${esc(L.t('motWhole', { n: Object.keys(r.durations).length }))}</p>`;
}

function contrastTable(ctx) {
  const L = lang(ctx);
  const cls = { AAA: 'ok', AA: 'ok', 'AA-large': 'warn', fail: 'bad' };
  return `<div class="ctab"><div class="ctr head"><span>${esc(L.t('thSample'))}</span>`
    + `<span>${esc(L.t('thPair'))}</span><span>${esc(L.t('thRatio'))}</span><span>${esc(L.t('thVerdict'))}</span></div>` +
    ctx.contrast.map((p) => `<div class="ctr">
      <div class="cp" style="background:${p.bgHex};color:${p.fgHex}">Aa</div>
      <span>${esc(L.t('deckOn', { fg: p.fg, bg: p.bg }))}</span><em>${p.ratio}:1</em>
      <i class="v-${cls[p.level]}">${esc(p.useKey ? L.t(p.useKey) : p.use)}</i></div>`).join('') + `</div>
    <p class="note">${esc(L.t('ctNote'))}</p>`;
}

// ---------------------------------------------------------------- type
function typeSpecimen(ctx) {
  const t = ctx.project.tokens.type || {};
  return Object.entries(t.families || {}).map(([role, f]) =>
    `<div class="face"><div class="fn"><h4>${esc(f.family)}</h4><span>${esc(role)} · ${(f.weights || []).join(' ')}</span></div>
     <p class="alpha" style="font-family:'${esc(f.family)}',${esc(f.fallback || 'sans-serif')};font-weight:${(f.weights || [400])[0]}">${esc(lang(ctx).t('alphabet'))}</p>
     ${f.note ? `<p class="fnote">${esc(f.note)}</p>` : ''}</div>`).join('');
}

function typeScale(ctx) {
  const t = ctx.project.tokens.type || {};
  const fam = (r) => { const f = (t.families || {})[r] || {}; return `'${f.family}',${f.fallback || 'sans-serif'}`; };
  return `<div class="scale">` + (t.scale || []).map((s) =>
    `<div class="sr"><span style="font-family:${fam(s.family)};font-size:${s.size}px;line-height:${s.leading / s.size};font-weight:${s.weight};letter-spacing:${s.tracking || 0}em">${esc(s.sample)}</span>
     <em>${esc(s.name)} · ${s.size} / ${s.leading}</em></div>`).join('') + `</div>`;
}

// An identifier is not prose in the document's language and it is not written
// in the document's direction either. `05-icons/` under dir="rtl" comes out as
// `/05-icons`, and `check <icon.svg> --icon` comes out with its flag first:
// the browser is right, a path is a neutral-terminated run of Latin and Hebrew
// reading order puts the punctuation at the other end. Nothing in en or fr
// could show this — a Latin identifier in a Latin page is already the way
// round it should be.
// ---------------------------------------------------------------- assets
function assetIndex(ctx) {
  const L = lang(ctx);
  const groups = new Map();
  for (const f of ctx.files) {
    const dir = f.path.includes('/') ? f.path.split('/')[0] : L.t('deckRoot');
    groups.set(dir, (groups.get(dir) || 0) + 1);
  }
  return `<div class="atab">` + [...groups.entries()].sort().map(([d, n]) =>
    `<div class="ar"><code dir="ltr">${esc(d)}${d === L.t('deckRoot') ? '' : '/'}</code><em>${n}</em></div>`).join('') +
    `</div><p class="note"><b>${esc(L.t('asFilesLead', { n: ctx.files.length }))}</b> ${esc(L.t('asFiles'))}</p>`;
}

// brand.json is read as English whatever the brand's language is — that is the
// decision this table was built on, and it is the right one for a file a
// developer reads. The manual prints it whole, so a Hebrew page was carrying
// several thousand English characters that claimed to be Hebrew: 55 per cent
// of the manual, enough that the engine refused to build it and was right to.
// It says what it is now, which a speech synthesiser can act on and which
// stops the braces and the indentation being laid out from the other side.
// and the brand's own words inside it carry the brand's, because the file holds
// its name and the sentences the project wrote. Marking the block and not what
// is in it had a screen reader saying מעיין in an English voice.
const brandJsonBlock = (ctx) => {
  const L = lang(ctx);
  return `<pre lang="en" dir="ltr">`
    + require('../access').markScript(esc(JSON.stringify(ctx.brandJson, null, 2)), L.brandLang, L.brandDir)
    + `</pre>`;
};

// A manual for a second version is read by somebody who already built to the
// first one. What they need before anything else is not the specification —
// they have that — but the list of places where what they built is now wrong.
// It goes at the top, unnumbered, because it is not part of the specification:
// next version it will say something else, and the version after that it will
// be gone.
function changes(ctx) {
  const L = lang(ctx);
  const ch = ctx.changes;
  if (!ch || !ch.entries) return '';
  const breaking = ch.entries.filter((c) => c.kind === 'breaking');
  const news = ch.entries.filter((c) => c.kind === 'news');
  // the same three sentences the CHANGES.txt beside this file carries, said in
  // whatever language this document is written in. See src/previous.js.
  const PV = require('../previous');
  const row = (c) => `<div class="chg ${c.kind}"><b>${esc(PV.say(c, 'what', L))}</b>`
    + `<span>${esc(PV.say(c, 'why', L))}</span><em>${esc(PV.say(c, 'how', L))}</em></div>`;
  if (!ch.entries.length) {
    return `<p class="note">${esc(L.t('cngSameA'))} <b>${esc(ctx.project.version)}</b> ${esc(L.t('cngSameB'))} `
      + `<b>${esc(ch.since)}</b>${esc(L.t('cngSameC'))}</p>`;
  }
  return `<p class="note">${esc(L.t('cngComparedA'))} <b>${esc(ch.since)}</b>${esc(L.t('cngComparedB', {
    n: ch.entries.length, changes: L.t(ch.entries.length === 1 ? 'cngOne' : 'cngMany') }))} `
    + (breaking.length
      ? `<b>${esc(L.t('cngBreaking', { n: breaking.length,
        those: L.t(ch.entries.length === breaking.length ? 'cngThem' : 'cngThose'),
        retires: L.t(breaking.length === 1 ? 'cngRetires' : 'cngRetire') }))}</b> `
        + esc(L.t('cngBreakingNote'))
      : esc(L.t('cngNoneRetires')))
    + `</p><div class="chgs">${breaking.map(row).join('')}${news.map(row).join('')}</div>`;
}

module.exports = { TXT, esc, own, changes, floorTable, partnerLockups, colourVision, ladderBlock, fabrication, familyBlock, motionBuild, inked, gradientSpec, inksOf, patternSpec, photographySpec, iconSpec, willWriteIcons, motionSpec, asColourway, onGround, showOn, readsOn, worstOn, SEEN, scaled, misuseCells, markSpecimen, lockupRow, construction, clearSpace,
  minimumSize, lockups, misuse, palette, contrastTable, typeSpecimen, typeScale, assetIndex, brandJsonBlock };
