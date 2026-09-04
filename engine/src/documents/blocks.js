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

// paint a copy of the master in one colour and hand back the markup
function inked(ctx, hex, which = 'mark') {
  const doc = svgu.parse(ctx.project.assets[which].source);
  svgu.applyColourway(doc, Object.fromEntries(ctx.measured.slots.map((s) => [s, hex])));
  return svgu.serialize(doc);
}

function scaled(svg, width) {
  return svg.replace(/<svg([^>]*)>/, (m, attrs) =>
    `<svg${attrs.replace(/\s(width|height)="[^"]*"/g, '')} width="${width}" height="auto" style="width:${width}px;height:auto;display:block">`);
}

// ---------------------------------------------------------------- the mark
const markSpecimen = (ctx) => {
  const on = ctx.primary.hex, ink = ctx.ground.hex;
  return `<div class="stage" style="background:${on}">${scaled(inked(ctx, ink), 150)}</div>`;
};

const lockupRow = (ctx, hex, bg) =>
  `<div class="stage" style="background:${bg}">${scaled(inked(ctx, hex), 120)}</div>`;

// The generic construction drawing: the box the artwork sits in, what it
// actually fills, the margin between the two, and the stroke that sets the
// floor. The reasoning behind those choices is the designer's, and it comes
// from the project content.
function construction(ctx, opts = {}) {
  const paint = opts.ink || ctx.primary.hex;
  const line = opts.line || 'currentColor';
  const vb = ctx.measured.markViewBox, ink = ctx.measured.markInk;
  const S = 260, pad = 30, k = (S - pad * 2) / Math.max(vb.w, vb.h);
  const X = (v) => svgu.round(pad + (v - vb.x) * k), Y = (v) => svgu.round(pad + (v - vb.y) * k);
  const grid = [];
  for (let i = 0; i <= 6; i++) {
    const gx = X(vb.x + (vb.w / 6) * i), gy = Y(vb.y + (vb.h / 6) * i);
    grid.push(`<path d="M${gx} ${Y(vb.y)}V${Y(vb.y + vb.h)}"/><path d="M${X(vb.x)} ${gy}H${X(vb.x + vb.w)}"/>`);
  }
  return `<svg viewBox="0 0 ${S} ${S + 26}" class="dia" role="img" aria-label="The mark on its construction grid, showing the ${vb.w} unit box, the ${ink.w} by ${ink.h} area it actually fills, and the margin between them.">
    <g stroke="${line}" stroke-width=".5" opacity=".22">${grid.join('')}</g>
    <rect x="${X(vb.x)}" y="${Y(vb.y)}" width="${svgu.round(vb.w * k)}" height="${svgu.round(vb.h * k)}" fill="none" stroke="${line}" stroke-width=".9" opacity=".55"/>
    <rect x="${X(ink.x)}" y="${Y(ink.y)}" width="${svgu.round(ink.w * k)}" height="${svgu.round(ink.h * k)}" fill="none" stroke="${ctx.accent.hex}" stroke-width="1" stroke-dasharray="4 3"/>
    <g transform="translate(${X(vb.x)} ${Y(vb.y)}) scale(${svgu.round(k, 6)})">${svgu.innerXML(svgu.parse(inked(ctx, paint)))}</g>
    <text x="${S / 2}" y="16" ${TXT} fill="${line}" text-anchor="middle">${vb.w} unit box</text>
    <text x="${S / 2}" y="${S + 16}" ${TXT} fill="${ctx.accent.hex}" text-anchor="middle">fills ${ink.w} × ${ink.h} · stroke ${ctx.measured.minimumSize.thinnestStroke}</text>
  </svg>`;
}

function clearSpace(ctx, opts = {}) {
  const paint = opts.ink || ctx.primary.hex;
  const line = opts.line || 'currentColor';
  const ink = ctx.measured.markInk, x = ctx.measured.clearSpace;
  const total = ink.w + x * 2, S = 260, k = S / (total * 1.12), o = (S - total * k) / 2;
  const P = (v) => svgu.round(o + v * k);
  return `<svg viewBox="0 0 ${S} ${S + 22}" class="dia" role="img" aria-label="Clear space of ${x} units on every side, which is ${ctx.project.rules.clearSpaceRatio} of the mark's height.">
    <rect x="${P(0)}" y="${P(0)}" width="${svgu.round(total * k)}" height="${svgu.round(total * k)}" fill="none" stroke="${line}" stroke-width="1" stroke-dasharray="4 3" opacity=".5"/>
    <g transform="translate(${P(x)} ${P(x)}) scale(${svgu.round(k, 6)}) translate(${-ink.x} ${-ink.y})">${svgu.innerXML(svgu.parse(inked(ctx, paint)))}</g>
    <g stroke="${ctx.accent.hex}" stroke-width="1.1">
      <path d="M${P(0)} ${P(total / 2)}H${P(x)}"/><path d="M${P(0)} ${P(total / 2) - 5}v10"/><path d="M${P(x)} ${P(total / 2) - 5}v10"/>
    </g>
    <text x="${P(x / 2)}" y="${P(total / 2) - 9}" ${TXT} fill="${ctx.accent.hex}" text-anchor="middle">x</text>
    <text x="${S / 2}" y="${S + 14}" ${TXT} fill="${line}" text-anchor="middle">x = ${x} units · ${ctx.project.rules.clearSpaceRatio} of the mark's height</text>
  </svg>`;
}

function minimumSize(ctx) {
  const m = ctx.measured.minimumSize;
  const sizes = [m.screenPx * 2, m.screenPx, Math.round(m.screenPx * 0.6)];
  const label = ['comfortable', 'the floor', 'below the floor'];
  return `<div class="row3">` + sizes.map((s, i) =>
    `<figure><div class="stage tight">${scaled(inked(ctx, ctx.primary.hex), s)}</div>
     <figcaption>${s} px · ${label[i]}</figcaption></figure>`).join('') + `</div>
    <p class="note"><b>${m.screenPx} px on screen and ${m.printMm} mm in print.</b> ${esc(m.basis)}, so holding the stroke at ${ctx.project.rules.minStrokePx} px and ${ctx.project.rules.minStrokeMm} mm puts the floor there. Move either rule and the floor moves with it.</p>`;
}

function lockups(ctx) {
  return `<div class="row2">` + ctx.project.rules.lockups.map((l) => {
    const v = ctx.variants[`${l}:${ctx.primaryColourway.name}`];
    return `<figure><div class="stage">${scaled(v, 190)}</div><figcaption>${esc(l)}</figcaption></figure>`;
  }).join('') + `</div>`;
}

function misuse(ctx) {
  const list = (ctx.project.content && ctx.project.content.misuse) || [];
  const styles = ['transform:scaleX(1.5)', 'transform:rotate(16deg)', '', 'filter:drop-shadow(3px 4px 4px rgba(0,0,0,.45))', '', ''];
  const inks = [ctx.primary.hex, ctx.primary.hex, '#B0439A', ctx.primary.hex, ctx.primary.hex, ctx.primary.hex];
  return `<div class="row3">` + list.slice(0, 6).map((why, i) =>
    `<figure><div class="stage tight dont${i === 4 ? ' busy' : ''}"><span style="${styles[i]}">${scaled(inked(ctx, inks[i]), 62)}</span></div>
     <figcaption>${esc(why)}</figcaption></figure>`).join('') + `</div>`;
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

module.exports = { TXT, esc, inked, scaled, markSpecimen, lockupRow, construction, clearSpace,
  minimumSize, lockups, misuse, palette, contrastTable, typeSpecimen, typeScale, assetIndex, brandJsonBlock };
