'use strict';
// Derived blocks. Each one reads the project and draws itself, so none of them
// can go stale. Where a block needs a judgement rather than a measurement it
// takes the words from the project's content, and says so.
const svgu = require('../svg');
const geo = require('../geometry');
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
  const capText = `fills ${ink.w} × ${ink.h} · ${ctx.measured.minimumSize.from === 'stem' ? 'narrowest stem' : 'stroke'} ${ctx.measured.minimumSize.thinnestStroke}`;
  const W = svgu.round(roomFor(pad * 2 + vb.w * k, capText, `${vb.w} unit box`));
  const H = svgu.round(pad * 2 + vb.h * k);
  const X = (v) => svgu.round(pad + (v - vb.x) * k), Y = (v) => svgu.round(pad + (v - vb.y) * k);
  const grid = [];
  for (let i = 0; i <= 6; i++) {
    const gx = X(vb.x + (vb.w / 6) * i), gy = Y(vb.y + (vb.h / 6) * i);
    grid.push(`<path d="M${gx} ${Y(vb.y)}V${Y(vb.y + vb.h)}"/><path d="M${X(vb.x)} ${gy}H${X(vb.x + vb.w)}"/>`);
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
    <text x="${W / 2}" y="16" ${TXT} fill="${line}" text-anchor="middle">${vb.w} unit box</text>
    <text x="${W / 2}" y="${H + 16}" ${TXT} fill="${ctx.accent.hex}" text-anchor="middle">fills ${ink.w} × ${ink.h} · ${ctx.measured.minimumSize.from === 'stem' ? 'narrowest stem' : 'stroke'} ${ctx.measured.minimumSize.thinnestStroke}</text>
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
    <p class="note"><b>${geo.floorText(m, 'px')} on screen and ${geo.floorText(m, 'mm')} in print.</b> ${esc(m.basis)}, so holding the stroke at ${ctx.project.rules.minStrokePx} px and ${ctx.project.rules.minStrokeMm} mm puts the floor there. Move either rule and the floor moves with it.${m.squarish ? '' : ' Both figures are the width; the second is the height that goes with it.'}${big > 300 ? ` These three are in proportion to each other rather than at actual size: ${big} px is wider than this page.` : ''}</p>`;
}

function lockups(ctx) {
  return `<div class="row2">` + ctx.project.rules.lockups.map((l) => {
    const v = ctx.variantFor(l, ctx.primaryColourway.name);
    return `<figure><div class="stage">${scaled(v, 190)}</div><figcaption>${esc(l)}</figcaption></figure>`;
  }).join('') + `</div>`;
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

module.exports = { TXT, esc, inked, gradientSpec, inksOf, asColourway, onGround, showOn, readsOn, worstOn, SEEN, scaled, markSpecimen, lockupRow, construction, clearSpace,
  minimumSize, lockups, misuse, palette, contrastTable, typeSpecimen, typeScale, assetIndex, brandJsonBlock };
