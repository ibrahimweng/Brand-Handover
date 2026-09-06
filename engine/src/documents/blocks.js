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
function scaled(svg, width, css) {
  // a document should not fail to build because one variant is absent
  if (!svg) return `<div style="width:${css || `${width}px`};height:${Math.round(width / 3)}px"></div>`;
  return svg.replace(/<svg([^>]*)>/, (m, attrs) => {
    // height="auto" is not a length, so it is not an SVG attribute. The style
    // beside it was doing the work and the attribute was only ever an error in
    // the console — but a page that loses its styles would then have lost the
    // proportion too. The viewBox knows the ratio, so say the height outright.
    const vb = /viewBox="\s*([-\d.eE]+)[,\s]+([-\d.eE]+)[,\s]+([-\d.eE]+)[,\s]+([-\d.eE]+)/.exec(attrs);
    const h = vb && Number(vb[3]) > 0
      ? ` height="${svgu.round(width * (Number(vb[4]) / Number(vb[3])), 2)}"` : '';
    return `<svg${attrs.replace(/\s(width|height)="[^"]*"/g, '')} width="${width}"${h}`
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
  const capText = `fills ${ink.w} × ${ink.h} · ${ctx.measured.minimumSize.from === 'stem' ? 'narrowest stem' : 'stroke'} ${ctx.measured.minimumSize.thinnestStroke}`
    + (mod0 ? ` · ${mod0.unit} unit module, ${mod0.across} across` : '');
  // Both captions were written twice — once to work out how wide the canvas has
  // to be, and again, in full, inside the <text> that draws them. They agreed
  // for as long as nobody edited one of them. Adding the module to the lower one
  // sized the canvas for a caption it then did not draw.
  const boxText = mod0 ? `${vb.w} unit box · ${mod0.across} modules of ${mod0.unit}` : `${vb.w} unit box`;
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
  return `<svg viewBox="0 0 ${W} ${H + CAP}" class="dia" role="img" aria-label="The mark on its construction grid, showing the ${vb.w} unit box, the ${ink.w} by ${ink.h} area it actually fills, and the margin between them.">
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
  const paint = opts.ink || 'currentColor';
  const line = opts.line || 'currentColor';
  const ink = ctx.measured.markInk, x = ctx.measured.clearSpace;
  // Clear space is x on every side of the ink box, so the box it makes is the
  // shape of the ink box grown by 2x — not a square. Drawing it square was
  // right for a mark measuring 109 by 109 and quietly wrong for one measuring
  // 228 by 49, where the manual then showed a rule nobody could follow.
  const tw = ink.w + x * 2, th = ink.h + x * 2;
  const S = 260, CAP = 22, k = S / (Math.max(tw, th) * 1.12);
  const csCap = `x = ${x} units · ${ctx.project.rules.clearSpaceRatio} of the ${ctx.noun || 'mark'}'s height`;
  const W = svgu.round(roomFor(tw * k + (S - Math.max(tw, th) * k), csCap));
  const H = svgu.round(th * k + (S - Math.max(tw, th) * k));
  const ox = (W - tw * k) / 2, oy = (H - th * k) / 2;
  const PX = (v) => svgu.round(ox + v * k), PY = (v) => svgu.round(oy + v * k);
  return `<svg viewBox="0 0 ${W} ${H + CAP}" class="dia" role="img" aria-label="Clear space of ${x} units on every side, which is ${ctx.project.rules.clearSpaceRatio} of the ${ctx.noun || 'mark'}'s height.">
    <rect x="${PX(0)}" y="${PY(0)}" width="${svgu.round(tw * k)}" height="${svgu.round(th * k)}" fill="none" stroke="${line}" stroke-width="1" stroke-dasharray="4 3" opacity=".5"/>
    <g transform="translate(${PX(x)} ${PY(x)}) scale(${svgu.round(k, 6)}) translate(${-ink.x} ${-ink.y})">${svgu.innerXML(svgu.parse(inked(ctx, paint)))}</g>
    <g stroke="${ctx.accent.hex}" stroke-width="1.1">
      <path d="M${PX(0)} ${PY(th / 2)}H${PX(x)}"/><path d="M${PX(0)} ${PY(th / 2) - 5}v10"/><path d="M${PX(x)} ${PY(th / 2) - 5}v10"/>
    </g>
    <text x="${PX(x / 2)}" y="${PY(th / 2) - 9}" ${TXT} fill="${ctx.accent.hex}" text-anchor="middle">x</text>
    <text x="${W / 2}" y="${H + 14}" ${TXT} fill="${line}" text-anchor="middle">x = ${x} units · ${ctx.project.rules.clearSpaceRatio} of the ${ctx.noun || 'mark'}'s height</text>
  </svg>`;
}

function minimumSize(ctx) {
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
     <figcaption>${esc(s.caption)} · ${s.label}</figcaption></figure>`).join('') + `</div>
    <p class="note"><b>${geo.floorText(m, 'px')} on screen and ${geo.floorText(m, 'mm')} in print${ctx.noun === 'mark' ? ' for the mark alone' : ''}.</b> ${esc(m.basis)}, so holding the stroke at ${ctx.project.rules.minStrokePx} px and ${ctx.project.rules.minStrokeMm} mm puts the floor there. Move either rule and the floor moves with it.${m.squarish ? '' : ' Both figures are the width; the second is the height that goes with it.'}${big > 300 ? ` These three are in proportion to each other rather than at actual size: ${big} px is wider than this page.` : ''}</p>
    ${floorTable(ctx)}`;
}

// One figure was printed here for twenty-three identities, and it is the floor
// of the master — one of the four drawings in the package, and not the one the
// read me tells you to reach for. A lockup sets the name beside the mark at a
// fraction of its height: it is wider, and its finest part is finer, and both
// put the floor up. Every drawing states its own.
function floorTable(ctx) {
  const rows = ctx.project.rules.lockups.map((l) => {
    const f = ctx.floors[l];
    if (!f) return '';
    const over = f.screenPx > ctx.measured.minimumSize.screenPx * 1.05;
    return `<div class="ftr"><b>${esc(naming.folderFor(l))}</b><span>${esc(f.basis)}</span>`
      + `<em class="${over ? 'over' : ''}">${esc(geo.floorText(f, 'px'))}</em>`
      + `<em>${esc(geo.floorText(f, 'mm'))}</em></div>`;
  }).join('');
  const over = ctx.project.rules.lockups.filter((l) => ctx.floors[l]
    && ctx.floors[l].screenPx > ctx.measured.minimumSize.screenPx * 1.05);
  return `<div class="ftab">
    <div class="ftr head"><span>Folder</span><span>What disappears first</span><span>On screen</span><span>In print</span></div>
    ${rows}</div>
    <p class="note">A minimum size belongs to a drawing, and there are ${ctx.project.rules.lockups.length} of them in this package. Use the figure for the folder the file came out of, not the one above it${over.length ? `: ${over.length === 1 ? 'one of them does' : `${over.length} of them do`} not hold at ${esc(geo.floorText(ctx.measured.minimumSize, 'px'))} — a lockup sets the name beside the mark at a fraction of its height, so it is wider than the mark and its finest part is finer, and both put the floor up` : ''}.</p>`;
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
  const rungs = ctx.ladder;
  const bottom = rungs[rungs.length - 1];
  const cells = rungs.map((r) => {
    const band = r.to == null ? `${r.from} px and above` : `${r.from} to ${r.to} px`;
    const print = r.printTo == null ? `${r.printFrom} mm and above` : `${r.printFrom} to ${r.printTo} mm`;
    return `<figure><div class="stage tight rung">${r.svg ? scaled(r.svg, r.from, `${r.from}px`) : ''}</div>
      <figcaption class="said"><b>${esc(r.name)}</b> — ${esc(band)}, ${esc(print)}.
      ${r.parts != null ? `${r.parts} ${r.parts === 1 ? 'piece' : 'pieces'} of ink. ` : ''}${esc(r.note || '')}
      Shown here at ${r.from} px, the smallest it is used at.</figcaption></figure>`;
  }).join('');
  return `<div class="rungs">${cells}</div>
    <p class="note"><b>Read it downwards.</b> Use the drawing whose band the size falls in. The switch is not a
    preference and not a judgement made in the moment: each rung is used from the size at which it holds down to
    the size at which the next one takes over, and those numbers are what the drawings measure, not what anybody
    decided they should be.</p>
    <p class="note"><b>Below ${esc(String(bottom.from))} px there is nothing.</b> That is the identity's floor, and it
    is ${esc(String(rungs[0].from))} px for the drawing at the top of this ladder — the difference between the two is
    the whole reason the ladder exists. Every icon and favicon in this package is cut from
    <b>${esc(bottom.name)}</b>, because that is the drawing this identity uses at the sizes an icon lives at.</p>`;
}

// What it is made as.
//
// Every chapter before this one is about a screen or a page. A school's arms
// spend most of their life in thread, vinyl, stone and metal, and until the
// twenty-sixth round the only thing this manual had to say about any of that was
// a minimum size in millimetres of ink.
function fabrication(ctx) {
  const list = ctx.fabrication;
  if (!list || !list.length) return '';
  const rows = list.map((m) => {
    return `<div class="ftr"><b>${esc(m.process)} · ${m.at} mm</b>
      <span>${m.note ? `${esc(m.note[0].toUpperCase() + m.note.slice(1))}. ` : ''}${m.drawing
        ? `Cut from <b>${esc(m.drawing)}</b>, whose finest part measures ${m.thinnestMm} mm there. `
          + `${esc(m.what[0].toUpperCase() + m.what.slice(1))}, so nothing finer than ${m.feature} mm goes to this maker.`
          + `${m.needsOutlining ? ' The artwork is drawn in strokes and has to be outlined before it is sent.' : ''}`
        : `<b>Nothing in this identity can be made this way at this size.</b> ${esc(m.what[0].toUpperCase() + m.what.slice(1))}.`}</span>
      <em>${m.drawing ? `${m.thinnestMm} mm` : '—'}</em><em>${m.feature} mm</em></div>`;
  }).join('');
  return `<div class="ftab">
    <div class="ftr head"><span>Made as</span><span>Which drawing, and why</span><span>Finest part</span><span>Process holds</span></div>
    ${rows}</div>
    <p class="note"><b>Every one of these is arithmetic.</b> A process has a smallest feature it can hold; a
    drawing has a finest part; the size the thing is made at turns the second into millimetres. Where the full
    mark does not survive, the drawing sent is the most detailed one that does — which is what the ladder in
    1.5 is for. <code>13-fabrication</code> holds each of them at true size, in millimetres, ready to send.</p>
    <p class="note">The figures a process holds are working ones and they are in <code>brand.json</code>. A maker
    who knows their own machine knows better than this file: set <code>feature</code> on the entry and every
    number above moves with it.</p>`;
}

// The palette, as three other people see it.
//
// Every contrast table this engine has printed answers one question — can text
// be read on this ground — and it is a ratio of luminance. Whether two of these
// colours can be told from each other is a different question with a different
// answer, and no package had ever asked it. See src/vision.js.
function colourVision(ctx) {
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
    ${row('As you see it', (h) => h)}
    ${kinds.map((k) => row(k, (h) => V.simulate(h, k))).join('')}
  </div>`;

  const sets = Object.entries(ctx.project.sets || {}).map(([name, set]) => {
    const covered = set.apartBy && set.of.every((c) => set.apartBy[c]);
    return `<p class="note"><b>The ${esc(name)} set.</b> ${esc(set.why)} `
      + (covered
        ? `Nothing in it is told apart by colour alone: ${set.of.map((c) =>
          `<b>${esc(c)}</b> is ${esc(set.apartBy[c])}`).join(', ')}. That is the rule, and it is the rule `
          + 'because two of these colours are one colour to some readers.'
        : 'These are told apart by colour alone.')
      + '</p>';
  }).join('');

  const list = found.length
    ? `<p class="note"><b>${found.length === 1 ? 'One pair separates' : `${found.length} pairs separate`} for most readers and not for all.</b> `
      + found.map((f) => `${esc(f.pair.join(' and '))} are ${f.normal} apart to you and `
        + `${f.worst.distance} to ${esc(V.say(f.worst.kind))}, ${esc(V.howMany(f.worst.kind))}`).join('; ')
      + `. Every one of them passes the contrast table above, because that table measures luminance and this is hue.</p>`
    : `<p class="note"><b>Every pair in this palette that separates for you separates for all three.</b> `
      + `Nothing here is told apart by hue alone.</p>`;

  return strip + list + sets
    + `<p class="note">Distances are CIE ΔE*ab, where about ${floor} is the point at which two flat colours
    side by side stop being reliably different. The three rows are dichromacy — one cone type absent —
    simulated after Viénot, Brettel and Mollon (1999). The commoner condition is anomalous trichromacy,
    where the cone is present and shifted: those readers see a reduced version of the same thing, so every
    pair named here is at least harder for them and often exactly this.</p>`;
}

// Half of each of these is not ours, and almost nothing above applies to it.
function partnerLockups(ctx) {
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
      <figcaption class="said"><b>${esc(p.partner.name)}</b>, ${esc(p.colourway.name)} on ${esc(p.colourway.on)}.
      Smallest use <b>${p.floor.screenPx} px</b> / ${p.floor.printMm} mm, set by ${esc(p.floor.setBy)}.
      Their mark is placed at ${p.composed.scale} of the size they supplied it at, which makes the pair
      ${Math.round(p.composed.width)} units wide${times > 1.05 ? ` — ${times} times the narrowest pair here` : ''}.${missing.length ? ` They have supplied no ${esc(missing.join(' or '))} version, so there is no pair on ${esc(missing.join(' or '))}.` : ''}
      </figcaption></figure>`;
  }).join('');
  const owners = [...new Set(ctx.project.partners.map((p) => p.owner))];
  return `<div class="row2">${cards}</div>
    <p class="note">The ${ctx.pairs.length} above are drawn at a size each can be read at, not to one scale:
    ${svgu.round(Math.max(...ctx.pairs.map((x) => x.composed.width)) / narrowest, 1)} separates the widest of them
    from the narrowest, and at one factor the narrow ones cannot be read. The width of each is under it.</p>
    <p class="note"><b>The rule.</b> Their mark is set to the same ${esc(r.match || 'height')} as ours${r.matchRatio !== 1 ? ` at ${r.matchRatio} of it` : ''}, with ${ctx.pairs[0] ? ctx.pairs[0].composed.gap : ''} units either side of a ${ctx.pairs[0] && ctx.pairs[0].composed.ruleWidth ? `${ctx.pairs[0].composed.ruleWidth} unit dividing rule` : 'plain gap'}, measured off our own ink height. Our half is ${esc(r.with || 'the primary lockup')}.</p>
    <p class="note"><b>What may not be done to it.</b> ${esc(owners.join(', '))} own the artwork on the right of each pair. It is not recoloured into this palette, not redrawn, and not swapped for another of their versions when the one for a ground is missing — which version goes on which ground is theirs to decide. Where a pair is not shown above, it does not exist, and only they can supply it.</p>
    <p class="note"><b>The smallest use is neither brand's.</b> A pair is a third drawing, wider than ours and containing whatever is finest in theirs, so it has a floor of its own. Their manual states their mark alone and this one states ours; the figure under each pair above is the only place the two are measured together.</p>`;
}

function lockups(ctx) {
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
    <p class="note"><b>The name is not drawn.</b> It is set in
    <b>${esc(n.drawn.family)}</b> at weight ${n.drawn.weight}${n.transform === 'uppercase' ? ', in capitals' : ''},
    tracked ${svgu.round(Number(n.tracking) * 1000, 0)}/1000 of an em, at
    <b>${svgu.round(Number(n.heightRatio) * 100, 1)} per cent</b> of the mark's ink height —
    ${ctx.measured.markInk.h} units, so the name stands
    ${svgu.round(ctx.measured.markInk.h * Number(n.heightRatio), 2)}. Set it that way and it is
    right; the files in <code>04-wordmark</code> are that setting outlined at build time, so they
    need no font to render and will not go out of step with a sign.
    ${esc(fam.family || n.drawn.family)} is the ${esc(n.family)} face in the palette above:
    change it there and the name is redrawn with it.</p>`;
}

function misuse(ctx) {
  const list = (ctx.project.content && ctx.project.content.misuse) || [];
  const styles = ['transform:scaleX(1.5)', 'transform:rotate(16deg)', '', 'filter:drop-shadow(3px 4px 4px rgba(0,0,0,.45))', '', ''];

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
  // the busy cell paints its own stripes over the ground, so measure against
  // the darker of them rather than against what is behind it
  const BUSY = '#5E6B5B';
  const onBusy = contrast.ratio(best, BUSY) >= SEEN ? best
    : (inks.slice().sort((a, b) => contrast.ratio(b, BUSY) - contrast.ratio(a, BUSY))[0] || best);

  // Six captions and four treatments: the fifth cell has the busy ground and
  // the sixth had nothing at all, so one cell in every manual ever built showed
  // a perfectly correct mark under a caption saying not to do it.
  // the third cell is the mark in a colour that is plainly not the brand's,
  // and a wrong colour nobody can see makes no point at all: Meridian's fixed
  // magenta sits at 2.96 to 1 on its own dark ground
  const WRONG = ['#B0439A', '#E86FD0', '#7CE04B', '#F2C230'];
  const wrong = WRONG.slice().sort((a, b) =>
    contrast.ratio(b, s.ground.hex) - contrast.ratio(a, s.ground.hex))
    .find((h) => contrast.ratio(h, s.ground.hex) >= SEEN) || WRONG[0];

  const outline = `filter:drop-shadow(1px 0 0 ${best}) drop-shadow(-1px 0 0 ${best})`
    + ` drop-shadow(0 1px 0 ${best}) drop-shadow(0 -1px 0 ${best})`;

  // A misuse caption is a label in every fixture that has one — "do not stretch
  // it" — and a sentence in a manual anybody actually writes. The label style is
  // uppercase, letter-spaced and monospaced, which is right for three words and
  // unreadable at fifteen. Take the style from the length: if any one of them is
  // a sentence, all of them are set as sentences, so the row stays one thing.
  const SAID = 34;                       // about a label's worth of characters
  const asSentences = list.some((why) => String(why).length > SAID);
  return `<div class="row3">` + list.slice(0, 6).map((why, i) => {
    const busy = i === 4;
    // the third cell is deliberately the wrong colour, which is its whole point,
    // and the sixth is the mark hollowed out, which is what outlining it means
    const ink = i === 2 ? wrong : i === 5 ? s.ground.hex : busy ? onBusy : best;
    const style = i === 5 ? outline : styles[i];
    const ground = busy ? '' : `background:${s.ground.hex};`;
    return `<figure><div class="stage tight dont${busy ? ' busy' : ''}" style="${ground}"><span style="${style}">${scaled(inked(ctx, ink), 62)}</span></div>
     <figcaption${asSentences ? ' class="said"' : ''}>${esc(why)}</figcaption></figure>`;
  }).join('') + `</div>`;
}

// ---------------------------------------------------------------- colour
function palette(ctx) {
  // CMYK is either given or guessed, and a chip that shows both the same way
  // is how a guess ends up on a press. See src/cmyk.js.
  const ink = require('../cmyk').byName(require('../cmyk').table(ctx.colours));
  const guessed = Object.keys(ctx.colours).filter((n) => !ink[n].declared);
  return `<div class="chips">` + Object.entries(ctx.colours).map(([name, t]) => {
    const rgbv = contrast.rgb(t.hex).join(' '), k = ink[name];
    return `<div class="chip"><div class="sw" style="background:${t.hex}"></div>
      <b>${esc(name)}</b><span class="role">${esc(t.role || '')}</span>
      <dl><dt>HEX</dt><dd>${t.hex}</dd><dt>RGB</dt><dd>${rgbv}</dd>
      <dt>CMYK</dt><dd class="${k.declared ? 'typed' : 'guess'}">${k.values.join(' ')}${k.declared ? '' : ' ?'}</dd>
      ${t.pantone ? `<dt>PMS</dt><dd class="typed">${esc(t.pantone)}</dd>` : ''}</dl></div>`;
  }).join('') + `</div>`
    + `<p class="note">RGB is converted from the hex. <b>CMYK and Pantone are typed in by you</b>, because what a colour becomes in ink depends on the press and the paper, and no formula knows which paper.`
    + (guessed.length
      ? ` <b>${esc(guessed.join(', '))} ${guessed.length === 1 ? 'has' : 'have'} no build yet</b>, so the numbers shown for ${guessed.length === 1 ? 'it' : 'them'} are converted from the screen colour and marked with a question mark. Do not send ${guessed.length === 1 ? 'it' : 'them'} to a press.`
      : ` Every colour here has one.`)
    + `</p>`;
}

// A gradient in the master is part of the palette and belongs on the palette
// page, drawn rather than described — the manual said nothing about one at all,
// so a designer reading it could not tell which file carried the gradient, and
// the one-colour version looked like a mistake rather than a decision.
function gradientSpec(ctx) {
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
      <figcaption>${esc(g.slots.join(', '))} \u00b7 ${g.stops.length} stops \u00b7 ${esc(g.kind)}</figcaption></figure>
      <p class="note"><b>${g.stops.map((st) => esc(st.hex || '?')).join(' \u2192 ')}</b> at ${
        g.stops.map((st) => `${svgu.round((st.offset == null ? 0 : st.offset) * 100)}%`).join(', ')
      }, read off the artwork. ${keeps.length
        ? `Carried in <b>${esc(keeps.join(' and '))}</b>, and repainted flat in ${esc(flat.join(' and ')) || 'nothing else'}.`
        : `<b>No colourway keeps it</b>, so it is in the master and in none of the files.`} `
      + `A gradient cannot be printed as a spot ink, so the flat version is the one a one- or two-colour `
      + `job uses, and a PDF carrying the gradient has that part in DeviceRGB whatever the rest is in.</p>`;
  }).join('');
}

// ------------------------------------------------------------- the system
// The rule blocks reached the canvas, the deck's file count and brand.json, and
// neither of the two documents a client reads. Fathom's whole identity is its
// pattern and its manual never mentioned one; four projects declare a
// photography treatment and no manual described it. Each of these draws only
// where the project has that system, so nothing grows an empty section.

function patternSpec(ctx) {
  const gen = ctx.pattern;
  if (!gen || !gen.ok || !gen.tiles.length) return '';
  const r = ctx.system.pattern;
  const on = showOn(ctx);
  const pat = require('../pattern');
  const master = ctx.project.assets[ctx.measured.master || 'mark'] || ctx.project.assets.mark;
  const order = Object.keys(r.densities);
  const cells = order.map((density) => {
    const factor = r.densities[density];
    const scaled = Object.assign({}, r, { tile: svgu.round(r.tile * factor), weight: svgu.round(r.weight * factor, 2) });
    const sw = pat.swatch(master.source, scaled, on.colourway.slots[ctx.measured.slots[0]]
      || Object.values(on.colourway.slots)[0], on.ground.hex, 300, 190, `d-${density}`);
    return `<figure><div class="stage tight" style="padding:0;overflow:hidden">${sw || ''}</div>
      <figcaption>${esc(density)} · tile ${scaled.tile} · weight ${scaled.weight}</figcaption></figure>`;
  }).join('');
  const ways = [...new Set(gen.tiles.map((t) => t.colourway))];
  return `<div class="row3">${cells}</div>
    <p class="note">Cut from the shape marked <code>data-pattern="source"</code> in the master, at
    ${order.length} densities in ${ways.length} colourway${ways.length > 1 ? 's' : ''} —
    <b>${gen.tiles.length} tiles</b>, all in the package. The tile is ${r.tile} units at medium, rows are
    offset by ${r.phase} of a tile and spaced ${r.rowSpacing} of one apart. Change the shape in the master
    and every tile is cut again.</p>`;
}

function photographySpec(ctx) {
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
    </div><figcaption>a grey ramp, treated${scrim ? ', under the scrim' : ''}</figcaption></figure>`;
  const top = shots ? `<div class="row3">${shots}${ramps}</div>` : ramps;
  return `${top}
    <p class="note">${r.duotone
      ? `Every photograph is a duotone from <b>${esc(r.duotone.shadow)}</b> in the shadows to <b>${esc(r.duotone.highlight)}</b> in the highlights, at ${Math.round((r.duotone.amount == null ? 1 : r.duotone.amount) * 100)} per cent. `
      : 'Photographs run untreated. '}${scrim
      ? `A scrim of ${esc(String(r.scrim.colour))} at ${Math.round(r.scrim.opacity * 100)} per cent runs from the ${esc(r.scrim.direction)}, which is what type sits on. `
      : ''}Crops are ${(r.ratios || []).map(esc).join(', ')}. The editor measures the mark against the pixels actually under it and says which colourway reads there, so this is a rule you can check rather than one you have to remember.</p>`;
}

// Whether this project writes icons at all — a property of its rules, which is
// always there, rather than of a file list that may not have been passed.
const willWriteIcons = (ctx) => {
  const r = (ctx.project && ctx.project.rules) || {};
  return ((r.iconSizes || []).length + (r.faviconSizes || []).length) > 0;
};

function iconSpec(ctx) {
  const r = ctx.system.icons;
  if (!r) return '';
  // Where the identity has a separate drawing for small sizes, say so here.
  // The engine has been telling designers to draw one since the thirteenth
  // round; now that a project can carry it, the manual has to explain why the
  // icons are not the mark.
  const simplified = ctx.project.assets.icon ? `<p class="note">The icons are not the mark. `
    + `A crest or any drawing with fine parts closes up at icon sizes, so this identity has a `
    + `simplified drawing for them — fewer parts, heavier strokes, the same meaning. `
    + `It is what everything in <code>05-icons</code> is cut from.</p>` : '';
  const k = 200 / r.box, m = (r.box - r.live) / 2;
  const line = ctx.accent.hex;
  return `<figure><div class="stage tight">
      <svg viewBox="0 0 ${200 + 60} ${200 + 26}" class="dia" role="img" aria-label="The icon grid: a ${r.box} unit box with a ${r.live} unit live area and a ${r.stroke} unit stroke.">
        <rect x="30" y="6" width="200" height="200" fill="none" stroke="${line}" stroke-width=".9" opacity=".5"/>
        <rect x="${svgu.round(30 + m * k)}" y="${svgu.round(6 + m * k)}" width="${svgu.round(r.live * k)}" height="${svgu.round(r.live * k)}" fill="none" stroke="${line}" stroke-width="1" stroke-dasharray="4 3"/>
        <g stroke="currentColor" stroke-width="${svgu.round(r.stroke * k, 2)}" stroke-linecap="${esc(r.cap)}" stroke-linejoin="${esc(r.join)}" fill="none">
          <path d="M${svgu.round(30 + m * k)} ${svgu.round(6 + m * k)}L${svgu.round(30 + (r.box / 2) * k)} ${svgu.round(6 + (r.box - m) * k)}L${svgu.round(30 + (r.box - m) * k)} ${svgu.round(6 + m * k)}"/>
        </g>
        <text x="${(200 + 60) / 2}" y="${200 + 20}" ${TXT} fill="${line}" text-anchor="middle">${r.box} unit box · ${r.live} live · ${r.stroke} stroke</text>
      </svg></div><figcaption>the grid every icon is drawn on</figcaption></figure>
    <p class="note">Not decided: taken from the ${ctx.noun} itself. Its box is ${r.derivedFrom.viewBox} units and it
    fills ${r.derivedFrom.ink} of them, so the margin is ${r.derivedFrom.markMargin} — <b>${svgu.round(r.marginFraction * 100, 1)} per cent</b>,
    which is the same margin an icon keeps. Its narrowest part is ${r.derivedFrom.markStroke} units, which is
    <b>${svgu.round(r.strokeRatio * 100, 1)} per cent</b> of the box, so an icon's stroke is ${r.stroke} in a ${r.box} box.
    Ends are ${esc(r.cap)}, corners ${esc(r.join)}, and the set is ${r.filled ? 'filled' : 'drawn in outline'}.
    Redraw the ${ctx.noun} and these move with it. Run <code>check &lt;icon.svg&gt; --icon</code> to have one measured against them.</p>
    ${simplified}`;
}

function motionSpec(ctx) {
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
      <svg viewBox="0 0 100 118" class="dia" role="img" aria-label="${esc(label)}, a cubic bezier through ${e.join(', ')}.">
        <path d="M${P(0, 0)}L${P(1, 0)}M${P(0, 0)}L${P(0, 1)}" stroke="currentColor" stroke-width=".6" opacity=".3"/>
        <path d="M${P(0, 0)}C${P(x1, y1)} ${P(x2, y2)} ${P(1, 1)}" fill="none" stroke="${ctx.accent.hex}" stroke-width="2"/>
      </svg></div><figcaption>${esc(label)} · ${sys.bezier(e)}</figcaption></figure>`;
  };
  const durations = Object.entries(r.durations)
    .map(([n, ms]) => `<div style="display:flex;justify-content:space-between;gap:12px;padding:4px 0">`
      + `<span>${esc(n)}</span><b>${ms} ms</b></div>`).join('');
  return `<div class="row3">${Object.entries(r.easing).map(([n, e]) => curve(e, n)).join('')}
    <figure><div class="stage tight"><div style="width:100%;font-size:13px">${durations}</div></div>
    <figcaption>how long each thing takes</figcaption></figure></div>
    <p class="note">The mark builds in ${r.build.length} parts: ${r.build.map((s) =>
      `<b>${esc(s.part)}</b> ${esc(s.how)} from ${s.from} to ${s.to} ms on <i>${esc(s.ease)}</i>`).join(', ')}.
    It ${r.loop ? 'loops' : 'plays once and holds'}. Two curves and ${Object.keys(r.durations).length} durations
    are the whole of it; anything else on screen is one of these.</p>`;
}

function contrastTable(ctx) {
  const cls = { AAA: 'ok', AA: 'ok', 'AA-large': 'warn', fail: 'bad' };
  return `<div class="ctab"><div class="ctr head"><span>Sample</span><span>Pair</span><span>Ratio</span><span>Verdict</span></div>` +
    ctx.contrast.map((p) => `<div class="ctr">
      <div class="cp" style="background:${p.bgHex};color:${p.fgHex}">Aa</div>
      <span>${esc(p.fg)} on ${esc(p.bg)}</span><em>${p.ratio}:1</em>
      <i class="v-${cls[p.level]}">${esc(p.use)}</i></div>`).join('') + `</div>
    <p class="note">Every pair in the palette, checked against WCAG 2.2 and sorted worst last. Nothing here is softened, so the combinations that do not work are listed rather than left for somebody to discover.</p>`;
}

// ---------------------------------------------------------------- type
function typeSpecimen(ctx) {
  const t = ctx.project.tokens.type || {};
  return Object.entries(t.families || {}).map(([role, f]) =>
    `<div class="face"><div class="fn"><h4>${esc(f.family)}</h4><span>${esc(role)} · ${(f.weights || []).join(' ')}</span></div>
     <p class="alpha" style="font-family:'${esc(f.family)}',${esc(f.fallback || 'sans-serif')};font-weight:${(f.weights || [400])[0]}">ABCDEFGHIJKLM abcdefghijklm 0123456789</p>
     ${f.note ? `<p class="fnote">${esc(f.note)}</p>` : ''}</div>`).join('');
}

function typeScale(ctx) {
  const t = ctx.project.tokens.type || {};
  const fam = (r) => { const f = (t.families || {})[r] || {}; return `'${f.family}',${f.fallback || 'sans-serif'}`; };
  return `<div class="scale">` + (t.scale || []).map((s) =>
    `<div class="sr"><span style="font-family:${fam(s.family)};font-size:${s.size}px;line-height:${s.leading / s.size};font-weight:${s.weight};letter-spacing:${s.tracking || 0}em">${esc(s.sample)}</span>
     <em>${esc(s.name)} · ${s.size} / ${s.leading}</em></div>`).join('') + `</div>`;
}

// ---------------------------------------------------------------- assets
function assetIndex(ctx) {
  const groups = new Map();
  for (const f of ctx.files) {
    const dir = f.path.includes('/') ? f.path.split('/')[0] : '(root)';
    groups.set(dir, (groups.get(dir) || 0) + 1);
  }
  return `<div class="atab">` + [...groups.entries()].sort().map(([d, n]) =>
    `<div class="ar"><code>${esc(d)}${d === '(root)' ? '' : '/'}</code><em>${n}</em></div>`).join('') +
    `</div><p class="note"><b>${ctx.files.length} files.</b> Every one cut from the master at the moment the package was built, so no old variant can survive in a corner of the folder. The client keeps this whether or not anyone is still paying for the tool that made it.</p>`;
}

const brandJsonBlock = (ctx) => `<pre>${esc(JSON.stringify(ctx.brandJson, null, 2))}</pre>`;

// A manual for a second version is read by somebody who already built to the
// first one. What they need before anything else is not the specification —
// they have that — but the list of places where what they built is now wrong.
// It goes at the top, unnumbered, because it is not part of the specification:
// next version it will say something else, and the version after that it will
// be gone.
function changes(ctx) {
  const ch = ctx.changes;
  if (!ch || !ch.entries) return '';
  const breaking = ch.entries.filter((c) => c.kind === 'breaking');
  const news = ch.entries.filter((c) => c.kind === 'news');
  const row = (c) => `<div class="chg ${c.kind}"><b>${esc(c.what)}</b><span>${esc(c.why)}</span><em>${esc(c.how)}</em></div>`;
  if (!ch.entries.length) {
    return `<p class="note">This package is version <b>${esc(ctx.project.version)}</b> and the last one was `
      + `<b>${esc(ch.since)}</b>, and nothing measured here is different between them: same palette, same lockups, `
      + `same colourways, same floor, same clear space. Anyone holding the last package can keep it.</p>`;
  }
  const n = (k, one, many) => `${k} ${k === 1 ? one : many}`;
  return `<p class="note">Compared with <b>${esc(ch.since)}</b>: ${n(ch.entries.length, 'change', 'changes')}. `
    + (breaking.length
      ? `<b>${breaking.length} of ${ch.entries.length === breaking.length ? 'them' : 'those'} `
        + `${breaking.length === 1 ? 'retires' : 'retire'} something that already exists.</b> `
        + 'Nothing in the files anyone already holds changes on its own, so until somebody acts on this list both '
        + 'versions are in use at once and both look correct.'
      : 'None of them retires anything already made.')
    + `</p><div class="chgs">${breaking.map(row).join('')}${news.map(row).join('')}</div>`;
}

module.exports = { TXT, esc, changes, floorTable, partnerLockups, colourVision, ladderBlock, fabrication, inked, gradientSpec, inksOf, patternSpec, photographySpec, iconSpec, willWriteIcons, motionSpec, asColourway, onGround, showOn, readsOn, worstOn, SEEN, scaled, markSpecimen, lockupRow, construction, clearSpace,
  minimumSize, lockups, misuse, palette, contrastTable, typeSpecimen, typeScale, assetIndex, brandJsonBlock };
