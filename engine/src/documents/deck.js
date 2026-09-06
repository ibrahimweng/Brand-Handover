'use strict';
// The deck. Not the manual reflowed: it holds one idea a slide, keeps the
// argument and drops the reference detail, and it carries slide types the
// manual has no use for at all. It also runs in the brand's own colours,
// because a presentation is brand expression where a manual is reference.
const b = require('./blocks');
const M = require('../editor/model');

const CSS = (t) => `
:root{--deep:${t.primary};--ink2:${t.secondary};--accent:${t.accent};--ground:${t.ground};
--f:${t.display};--ft:${t.text};--fm:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
--shell:#141618;--si:#EDEEEA;--sd:#7C838A;--sr:#2A2E31}
:root[data-theme=light]{--shell:#E8E8E4;--si:#14171A;--sd:#6B7278;--sr:#CFD0CB}
@media (prefers-color-scheme:light){:root:not([data-theme=dark]){--shell:#E8E8E4;--si:#14171A;--sd:#6B7278;--sr:#CFD0CB}}
*{box-sizing:border-box}body{background:var(--shell);color:var(--si);font-family:var(--f);margin:0;-webkit-font-smoothing:antialiased}
.wrap{min-height:100vh;display:flex;flex-direction:column;gap:14px;padding:16px clamp(14px,3vw,28px) 20px;align-items:center;justify-content:center}
.topbar,.ctrl{width:min(100%,calc((100vh - 132px)*16/9))}
.topbar{display:flex;justify-content:space-between;gap:16px;font-family:var(--fm);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--sd)}
.topbar b{color:var(--si);font-weight:500}
main.stage{display:block}
.stage{width:min(100%,calc((100vh - 132px)*16/9));aspect-ratio:16/9;position:relative;overflow:hidden;container-type:size;background:var(--deep);box-shadow:0 2px 26px rgba(0,0,0,.28)}
.slide svg{max-width:100%;height:auto}
.slide{position:absolute;inset:0;display:none;padding:5.6cqw 6.6cqw;flex-direction:column;justify-content:center;color:var(--ground);background:var(--deep)}
.slide.on{display:flex}.slide.light{background:var(--ground);color:var(--deep)}
.slide.div{background:color-mix(in srgb,var(--deep) 88%,#000)}
h1{font-weight:700;font-size:7cqw;line-height:1;letter-spacing:-.035em;margin:0;max-width:15ch}
h2{font-weight:700;font-size:4.8cqw;line-height:1.05;letter-spacing:-.028em;margin:0;max-width:21ch}
p{margin:0}
.eye{font-family:var(--fm);font-size:1.45cqw;letter-spacing:.16em;text-transform:uppercase;opacity:.6;margin-bottom:2.2cqw}
.lede{font-family:var(--ft);font-size:2.2cqw;line-height:1.5;margin-top:2.2cqw;max-width:44ch;opacity:.88}
.sm{font-family:var(--ft);font-size:1.7cqw;line-height:1.5;opacity:.76;max-width:56ch;margin-top:2cqw}
.sm b,.lede b{font-weight:600;opacity:1}
.cap{font-family:var(--fm);font-size:1.25cqw;letter-spacing:.1em;text-transform:uppercase;opacity:.5;margin-top:1.2cqw}
.num{position:absolute;right:2.8cqw;bottom:2.2cqw;font-family:var(--fm);font-size:1.25cqw;opacity:.35;letter-spacing:.1em}
.bdg{display:inline-flex;align-items:center;gap:.7cqw;font-family:var(--fm);font-size:1.3cqw;letter-spacing:.13em;text-transform:uppercase;opacity:.7}
.bdg::before{content:"";width:1cqw;height:1cqw;border:.15cqw solid currentColor;background:currentColor}
.bdg.once::before{background:linear-gradient(90deg,currentColor 0 50%,transparent 50% 100%)}
.bdg.yours::before{background:none}
.chno{font-family:var(--fm);font-size:1.5cqw;letter-spacing:.2em;color:var(--accent);margin-bottom:1.6cqw}
.chname{font-size:6.8cqw;letter-spacing:-.035em}
.sub{list-style:none;padding:0;margin:3cqw 0 0;display:flex;gap:3cqw;flex-wrap:wrap;font-family:var(--ft);font-size:1.75cqw;opacity:.6}
.two{display:grid;grid-template-columns:1fr 1fr;gap:4.4cqw;align-items:center}
.two.wide{grid-template-columns:1.05fr 1fr}
.four{display:grid;grid-template-columns:repeat(4,1fr);gap:1.8cqw}
.six{display:grid;grid-template-columns:repeat(3,1fr);gap:1.6cqw}
.cell{text-align:center}.cell svg{margin:0 auto}
.cell .cap{margin-top:1cqw}
.hero{display:flex;align-items:center;justify-content:center}
.chips{display:grid;grid-template-columns:repeat(5,1fr);gap:1.6cqw;margin-top:3cqw}
.chip .sw{height:9cqw}
.chip b{display:block;font-weight:600;font-size:1.9cqw;margin-top:1cqw}
.chip span{display:block;font-family:var(--fm);font-size:1.15cqw;opacity:.6;margin-top:.3cqw}
.ct{border-top:.1cqw solid currentColor;margin-top:2.4cqw}
.ctr{display:grid;grid-template-columns:8cqw 1fr 7cqw 13cqw;gap:1.8cqw;align-items:center;padding:.9cqw 0;border-bottom:.1cqw solid rgba(128,128,128,.35)}
.cp{display:flex;align-items:center;justify-content:center;height:3.2cqw;font-weight:600;font-size:1.4cqw}
.ctr span{font-family:var(--ft);font-size:1.65cqw;opacity:.8}
.ctr em{font-family:var(--fm);font-style:normal;font-size:1.35cqw;text-align:right}
.ctr i{font-family:var(--fm);font-style:normal;font-size:1.1cqw;letter-spacing:.06em;text-transform:uppercase;text-align:right}
.v-ok{color:#4FBF87}.v-warn{color:#E2B04A}.v-bad{color:#E8695F}
.light .v-ok{color:#1B7A4B}.light .v-warn{color:#8A6410}.light .v-bad{color:#C2352B}
.alpha{font-size:2.6cqw;line-height:1.2;margin-top:1cqw}
.tally{display:grid;grid-template-columns:repeat(4,1fr);gap:2.4cqw;margin-top:3.2cqw}
.tc b{display:block;font-weight:700;font-size:5.4cqw;line-height:1;letter-spacing:-.04em}
.tc span{display:block;font-family:var(--ft);font-size:1.5cqw;opacity:.7;margin-top:.8cqw}
.tc.hi b{color:var(--accent)}
.ctrl{display:flex;align-items:center;gap:12px}
.btn{font-family:var(--fm);font-size:11px;letter-spacing:.09em;text-transform:uppercase;background:none;border:1px solid var(--sr);color:var(--si);padding:9px 14px;cursor:pointer}
.btn:hover:not(:disabled){background:rgba(128,128,128,.13)}.btn:disabled{opacity:.35;cursor:default}
.btn:focus-visible,.dot:focus-visible{outline:2px solid var(--ink2);outline-offset:2px}
.dots{display:flex;gap:3px;flex:1;flex-wrap:wrap}
.dot{height:3px;background:var(--sr);border:none;padding:0;cursor:pointer;flex:1;min-width:6px}.dot.on{background:var(--ink2)}
.hint{font-family:var(--fm);font-size:10px;color:var(--sd);letter-spacing:.08em;white-space:nowrap}
@media (max-width:640px){.hint{display:none}.two{grid-template-columns:1fr;gap:2.4cqw}.tally,.chips{grid-template-columns:repeat(2,1fr)}}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;

function deck(ctx) {
  const p = ctx.project, c = ctx.content, m = ctx.measured;
  const S = [], T = [];
  const add = (title, body, cls = '') => {
    const n = S.length + 1;
    S.push(`<section class="slide ${cls}" aria-label="Slide ${n}, ${b.esc(title)}">${body}<span class="num">${String(n).padStart(2, '0')}</span></section>`);
    T.push(title);
  };
  const div = (no, name, subs) => add(`${no} · ${name}`,
    `<p class="chno">${no}</p><h2 class="chname">${b.esc(name)}</h2><ul class="sub">${subs.map((s) => `<li>${b.esc(s)}</li>`).join('')}</ul>`, 'div');

  // Every slide is painted in the primary role, which is a colour to present
  // on in an identity that has one and is the mark's own ink in an identity
  // built from an ink and a paper. Four slides of Hallward's deck were black
  // rectangles. Where the slide itself reads, nothing changes; where it does
  // not, the mark goes on a plate of a ground it was actually cut for.
  //
  // Keep the colourway the deck was already asking for wherever it reads —
  // maximising contrast instead would quietly move an identity off its own
  // off-white and onto pure white, which is not an improvement, it is a
  // different decision taken by a machine.
  const slideHex = ctx.primary.hex;
  const named = (p.rules.colourways || []).find((c) => c.name === ctx.ground.name);
  const onSlide = b.readsOn(ctx, slideHex);
  const show = b.showOn(ctx);
  const markWay = named && b.worstOn(named, slideHex, ctx) >= b.SEEN ? named
    : onSlide && onSlide.worst >= b.SEEN ? onSlide.colourway
      : show.colourway;
  const plate = (inner) => (b.worstOn(markWay, slideHex, ctx) >= b.SEEN ? inner
    : `<span style="background:${show.ground.hex};padding:2.6cqw;display:inline-flex;align-items:center">${inner}</span>`);

  // The title slide set the positioning statement as its headline. h1 is 7cqw
  // on a 15ch measure, and a slide is 56.25cqw tall with the mark and the
  // caption on it too, so about three lines of headline fit — roughly 45
  // characters. Every fixture's positioning was one word, so nothing had ever
  // handed it a sentence: 330 characters ran 657px past the bottom of the
  // slide, and the slide opened in the middle of the word "Street".
  //
  // A statement longer than the headline holds is not a headline. Set the name
  // as the headline and the statement underneath, at reading size, where it is
  // meant to be read anyway.
  // A statement longer than the headline holds is not a headline: set the name
  // as the headline and the statement underneath, at reading size.
  //
  // Then the name itself has to fit. h1 measures 15ch and the lede 44ch, both
  // set in `ch`, so how many lines each takes does not change with the type
  // size — only how tall those lines are. A slide is 56.25cqw; the mark, the
  // caption and the margins take about 26 of that, so the two together have
  // about 30 to live in. Step both down until they do. "Beaumont & Whitcombe
  // Rare Books" is three lines of headline where "Meridian" is one.
  const HEAD_CH = 15, LEDE_CH = 44, BUDGET = 44, GAP = 2.2;
  const linesIn = (t, ch) => M.textLines(t, { size: 1, leading: 1 }, ch * M.CHAR_EM);
  const stated = c.positioning || '';
  const headline = linesIn(stated, HEAD_CH) <= 3 ? (stated || p.brand) : p.brand;
  const lede = headline === stated ? '' : stated;
  const L1 = linesIn(headline, HEAD_CH), L2 = lede ? linesIn(lede, LEDE_CH) : 0;
  let h1Size = 7, ledeSize = 2.2;
  for (const s1 of [7, 5.6, 4.4, 3.4]) {
    for (const s2 of [2.2, 1.9, 1.6]) {
      h1Size = s1; ledeSize = s2;
      if (L1 * s1 * 1.02 + (L2 ? GAP + L2 * s2 * 1.5 : 0) <= BUDGET) break;
    }
    if (L1 * h1Size * 1.02 + (L2 ? GAP + L2 * ledeSize * 1.5 : 0) <= BUDGET) break;
  }
  add('Title', `<div class="hero" style="justify-content:flex-start;margin-bottom:3.4cqw">${plate(b.scaled(ctx.variantFor('horizontal', markWay.name), 360))}</div>
    <h1${h1Size === 7 ? '' : ` style="font-size:${h1Size}cqw"`}>${b.esc(headline)}</h1>${lede ? `\n    <p class="lede"${ledeSize === 2.2 ? '' : ` style="font-size:${ledeSize}cqw"`}>${b.esc(lede)}</p>` : ''}
    <p class="cap" style="margin-top:3.4cqw">${b.esc(p.brand)} ${b.esc(p.version)} · built from one master file</p>`);

  div('01', 'The mark', ['Construction', 'Clear space', 'Minimum size', 'The lockups', 'Misuse']);
  add('The mark', `<div class="hero">${plate(b.scaled(b.asColourway(ctx, markWay), 260))}</div>
    <p class="cap" style="text-align:center;margin-top:4cqw">${b.esc(p.brand)} · primary mark</p>`);
  add('Construction', `<div class="two wide"><div><span class="bdg">The system</span>
    <h2 style="margin-top:2cqw">Measured, not decided</h2>
    <p class="lede">The box is ${m.markViewBox.w} units and the artwork fills ${m.markInk.w} of them. The ${m.minimumSize.from === 'stem' ? 'narrowest stem' : 'thinnest stroke'} is ${m.minimumSize.thinnestStroke}.</p>
    <p class="sm">${b.esc(c.constructionNotes || 'Every number here was read off the artwork when this deck was built.')}</p></div>
    <div>${b.construction(ctx, { ink: ctx.ground.hex, line: ctx.ground.hex })}</div></div>`);
  add('Clear space', `<div class="two"><div><span class="bdg">The system</span>
    <h2 style="margin-top:2cqw">Keep x clear</h2>
    <p class="lede">x is ${m.clearSpace} units, which is ${p.rules.clearSpaceRatio} of the mark's own height. Nothing enters that space, including type and the trim of the page.</p></div>
    <div>${b.clearSpace(ctx, { ink: ctx.ground.hex, line: ctx.ground.hex })}</div></div>`);
  add('Minimum size', `<span class="bdg">The system</span><h2 style="margin-top:2cqw">${require('../geometry').floorText(m.minimumSize, 'px')}, and ${require('../geometry').floorText(m.minimumSize, 'mm')}</h2>
    <p class="lede">The stroke is what fails first. ${b.esc(m.minimumSize.basis)}, so holding it at ${p.rules.minStrokePx} px puts the floor there.</p>
    <div class="four" style="margin-top:3.4cqw">${[2, 1.4, 1, 0.6].map((f) => {
      const px = Math.round(m.minimumSize.screenPx * f);
      return `<div class="cell">${plate(b.scaled(b.asColourway(ctx, markWay), px))}<p class="cap">${px} px${f === 1 ? ' · floor' : f < 1 ? ' · too small' : ''}</p></div>`;
    }).join('')}</div>
    <p class="sm">That is the ${ctx.noun} alone. A lockup is a different drawing and disappears at a different size — the next slide has each of them, and the manual has the table.</p>`);
  const G = require('../geometry');
  add('The lockups', `<span class="bdg">The system</span><h2 style="margin-top:2cqw">${p.rules.lockups.length} arrangements, ${p.rules.colourways.length} colourways</h2>
    <div class="four" style="margin-top:3.4cqw">${p.rules.lockups.map((l) =>
      `<div class="cell">${plate(b.scaled(ctx.variantFor(l, markWay.name), 190))}<p class="cap">${b.esc(l)}`
      + `${ctx.floors[l] ? ` · ${b.esc(G.floorText(ctx.floors[l], 'px'))}` : ''}</p></div>`).join('')}</div>
    <p class="sm">All ${p.rules.lockups.length * p.rules.colourways.length} cut from one master, so none of them can fall out of step with the others. The figure under each is the smallest it may be used at, which is its own and not the ${ctx.noun}'s.</p>`);
  if (ctx.pairs.length) {
    // The one slide in this deck whose artwork is half somebody else's.
    add('Partner lockups', `<span class="bdg">Set once by you</span><h2 style="margin-top:2cqw">${ctx.project.partners.length} partners, ${ctx.pairs.length} pairs</h2>
      <div class="four" style="margin-top:3.4cqw">${ctx.pairs.slice(0, 4).map((pr) =>
        `<div class="cell" style="background:${(ctx.colours[pr.colourway.on] || {}).hex || '#FFF'}">`
        + `${b.scaled(pr.composed.svg, 300, '100%')}<p class="cap">${b.esc(pr.partner.name)} · ${pr.floor.screenPx} px</p></div>`).join('')}</div>
      <p class="sm">Half of each is not ours: not recoloured, not redrawn, and not made at all where they have not supplied a version. A pair is a third drawing, so its smallest use is neither brand's own figure.</p>`);
  }
  const dontStyles = ['transform:scaleX(1.5)', 'transform:rotate(16deg)', '', 'filter:drop-shadow(3px 4px 4px rgba(0,0,0,.5))', '', ''];
  add('Misuse', `<span class="bdg">The system</span><h2 style="margin-top:2cqw">Six ways it breaks</h2>
    <div class="six" style="margin-top:2.6cqw">${(c.misuse || []).slice(0, 6).map((w, i) =>
      `<div class="cell"><span style="display:inline-block;${dontStyles[i]}">${b.scaled(b.inked(ctx, i === 2 ? '#B0439A' : ctx.ground.hex), 54)}</span><p class="cap">${b.esc(w)}</p></div>`).join('')}</div>`);

  div('02', 'Colour', ['The palette', 'Contrast']);
  add('The palette', `<span class="bdg">The system</span><h2 style="margin-top:2cqw">${Object.keys(ctx.colours).length} colours</h2>
    <div class="chips">${Object.entries(ctx.colours).map(([n, t]) =>
      `<div class="chip"><div class="sw" style="background:${t.hex}"></div><b>${b.esc(n)}</b><span>${t.hex}</span><span>${b.esc(t.role || '')}</span></div>`).join('')}</div>
    <p class="sm">${b.esc(c.colourRationale || '')}</p>`, 'light');
  const cls = { AAA: 'ok', AA: 'ok', 'AA-large': 'warn', fail: 'bad' };
  add('Contrast', `<span class="bdg">The system</span><h2 style="margin-top:2cqw">Checked, not assumed</h2>
    <div class="ct">${ctx.contrast.slice(0, 6).map((x) =>
      `<div class="ctr"><div class="cp" style="background:${x.bgHex};color:${x.fgHex}">Aa</div>
       <span>${b.esc(x.fg)} on ${b.esc(x.bg)}</span><em>${x.ratio}:1</em><i class="v-${cls[x.level]}">${b.esc(x.use)}</i></div>`).join('')}</div>
    <p class="sm">Nothing is softened, so the pairs that do not work are listed rather than left for somebody to discover.</p>`, 'light');

  div('03', 'Typography', ['The typefaces', 'The scale']);
  const fams = Object.entries((p.tokens.type || {}).families || {});
  add('The typefaces', `<span class="bdg">The system</span><h2 style="margin-top:2cqw">${fams.length} faces, ${fams.length} jobs</h2>
    ${fams.map(([role, f]) => `<div style="margin-top:2.6cqw"><p class="cap" style="margin:0">${b.esc(f.family)} · ${b.esc(role)}</p>
      <p class="alpha" style="font-family:'${b.esc(f.family)}',${b.esc(f.fallback || 'sans-serif')};font-weight:${(f.weights || [400])[0]}">ABCDEFGHIJKLM abcdefghijklm 0123456789</p></div>`).join('')}
    <p class="sm">${b.esc(c.typeRationale || '')}</p>`, 'light');
  add('The scale', `<span class="bdg">The system</span><h2 style="margin-top:2cqw">${((p.tokens.type || {}).scale || []).length} steps</h2>
    <div style="margin-top:2.4cqw">${((p.tokens.type || {}).scale || []).slice(0, 4).map((s) => {
      const f = ((p.tokens.type || {}).families || {})[s.family] || {};
      return `<p style="font-family:'${b.esc(f.family)}',${b.esc(f.fallback || 'sans-serif')};font-weight:${s.weight};font-size:${Math.min(s.size / 12, 4.4)}cqw;line-height:1.15;margin-top:1.4cqw">${b.esc(s.sample)}</p>`;
    }).join('')}</div>
    <p class="sm">Every size, weight and line height is read from the token file, so this deck and the running website cannot drift apart.</p>`, 'light');

  // The rule blocks — the pattern, the treatment, the icon grid, the motion —
  // were in brand.json and on the canvas and in neither document. A deck that
  // counts the pattern tiles among its files and never shows one is describing
  // somebody else's identity.
  const svgu = require('../svg');
  const master = p.assets[m.master || (p.assets.mark ? 'mark' : 'wordmark')];
  const sysSlides = [];
  if (ctx.pattern && ctx.pattern.ok && ctx.pattern.tiles.length) sysSlides.push(['The pattern', () => {
    const r = ctx.system.pattern;
    const on = b.showOn(ctx);
    const ink = Object.values(on.colourway.slots)[0];
    const pat = require('../pattern');
    const cells = Object.entries(r.densities).map(([d, f]) => {
      const scaled = Object.assign({}, r, { tile: svgu.round(r.tile * f), weight: svgu.round(r.weight * f, 2) });
      return `<div style="flex:1;aspect-ratio:1;overflow:hidden">${pat.swatch(master.source, scaled, ink, on.ground.hex, 300, 300, `k-${d}`) || ''}</div>`;
    }).join('');
    return `<span class="bdg">Set once</span><h2 style="margin-top:2cqw">${ctx.pattern.tiles.length} tiles, one decision</h2>
      <div style="display:flex;gap:1.6cqw;margin-top:2.4cqw">${cells}</div>
      <p class="sm">Cut from the shape marked <b>data-pattern="source"</b> in the master, at ${Object.keys(r.densities).length} densities in ${[...new Set(ctx.pattern.tiles.map((t) => t.colourway))].length} colourways. Redraw that shape and all ${ctx.pattern.tiles.length} are cut again.</p>`;
  }]);
  if (ctx.system.photography.declared) sysSlides.push(['Photography', () => {
    const r = ctx.system.photography;
    const PH = require('../photography');
    const ramp = [];
    for (let i = 0; i < 11; i++) {
      const v = i / 10;
      const t = PH.treatPixel(r, { colours: ctx.colours, roles: ctx.roles }, { r: v, g: v, b: v });
      ramp.push(`<i style="flex:1;background:rgb(${Math.round(t.r * 255)},${Math.round(t.g * 255)},${Math.round(t.b * 255)})"></i>`);
    }
    return `<span class="bdg">Set once</span><h2 style="margin-top:2cqw">${r.duotone ? 'One duotone' : 'One treatment'}, every photograph</h2>
      <div style="display:flex;height:12cqw;margin-top:2.4cqw">${ramp.join('')}</div>
      <p class="sm">${r.duotone ? `From <b>${b.esc(r.duotone.shadow)}</b> to <b>${b.esc(r.duotone.highlight)}</b>. ` : ''}${r.scrim ? `A scrim from the ${b.esc(r.scrim.direction)} at ${Math.round(r.scrim.opacity * 100)} per cent. ` : ''}The editor measures the mark against the pixels under it, so this is checked rather than remembered.</p>`;
  }]);
  if ((p.system || {}).motion) sysSlides.push(['Motion', () => {
    const r = ctx.system.motion;
    const sys = require('../system');
    return `<span class="bdg">Set once</span><h2 style="margin-top:2cqw">Two curves, ${Object.keys(r.durations).length} durations</h2>
      <p class="lede">${Object.entries(r.durations).map(([n, ms]) => `${b.esc(n)} ${ms} ms`).join(' · ')}</p>
      <p class="sm">${Object.entries(r.easing).map(([n, e]) => `<b>${b.esc(n)}</b> ${sys.bezier(e)}`).join(' &nbsp; ')}<br>${r.build.length ? `The mark builds in ${r.build.length} parts and ${r.loop ? 'loops' : 'plays once'}.` : 'How the mark itself builds is not set.'}</p>`;
  }]);
  if (sysSlides.length) {
    div('04', 'The system', sysSlides.map(([name]) => name));
    for (const [name, body] of sysSlides) add(name, body(), 'light');
  }

  div(sysSlides.length ? '05' : '04', 'Assets', ['The package', 'The machine readable file']);
  add('The package', `<div class="two wide"><div><span class="bdg">The system</span>
    <h2 style="margin-top:2cqw">${ctx.files.length} files</h2>
    <p class="lede">Every one cut from the master at the moment the package was built, so no old variant can survive in a corner of the folder.</p>
    <p class="sm"><b>The client keeps this whether or not anyone is still paying for the tool that made it.</b></p></div>
    <div>${(() => { const g = new Map(); for (const f of ctx.files) { const d = f.path.includes('/') ? f.path.split('/')[0] : '(root)'; g.set(d, (g.get(d) || 0) + 1); }
      return [...g.entries()].sort().map(([d, n]) => `<div class="ctr" style="grid-template-columns:1fr auto"><span style="font-family:var(--fm);font-size:1.4cqw">${b.esc(d)}</span><em>${n}</em></div>`).join(''); })()}</div></div>`);

  add('Close', `<h2 style="font-size:4.4cqw;max-width:25ch">Change the mark and every one of these is right again.</h2>
    <h2 style="font-size:4.4cqw;max-width:25ch;color:var(--accent);margin-top:1.4cqw">Nothing here holds a copy of it.</h2>
    <p class="sm" style="margin-top:3.4cqw">This deck and the manual read the same project. They are different documents, not one document in two shapes.</p>`);

  const t = {
    primary: ctx.primary.hex, secondary: (Object.values(ctx.colours).find((x) => x.role === 'secondary') || ctx.primary).hex,
    accent: ctx.accent.hex, ground: ctx.ground.hex,
    display: `'${((p.tokens.type || {}).families || {}).display?.family || 'Helvetica'}',Helvetica,Arial,sans-serif`,
    text: `'${((p.tokens.type || {}).families || {}).text?.family || 'Georgia'}',Georgia,serif`,
  };
  const { fontLink } = require('./chrome');
  return `<!doctype html><html lang="${b.esc(p.language || 'en')}" dir="${b.esc(p.direction || 'ltr')}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${b.esc(p.brand)} Brand Deck</title>
${fontLink(p.tokens.type, p.fonts)}
<style>${CSS(t)}</style></head><body>
<div class="wrap">
  <div class="topbar"><span>${b.esc(p.brand)} · brand deck</span><span><b id="ttl"></b></span></div>
  <main class="stage" id="stage" role="region" aria-roledescription="carousel" aria-label="${b.esc(p.brand)} brand deck">${S.join('')}</main>
  <div class="ctrl"><button class="btn" id="prev" type="button">← Prev</button>
  <div class="dots" id="dots" role="tablist" aria-label="Slides"></div>
  <button class="btn" id="next" type="button">Next →</button><span class="hint">Arrow keys</span></div>
</div>
<script>
(function(){var s=[].slice.call(document.querySelectorAll('.slide')),t=${JSON.stringify(T)},i=0,
d=document.getElementById('dots'),p=document.getElementById('prev'),n=document.getElementById('next'),h=document.getElementById('ttl');
s.forEach(function(_,k){var x=document.createElement('button');x.className='dot'+(k?'':' on');x.type='button';x.setAttribute('role','tab');
x.setAttribute('aria-label','Slide '+(k+1)+', '+t[k]);x.addEventListener('click',function(){go(k)});d.appendChild(x)});
var e=[].slice.call(d.children);
function go(k){i=Math.max(0,Math.min(s.length-1,k));s.forEach(function(a,j){a.classList.toggle('on',j===i)});
e.forEach(function(a,j){a.classList.toggle('on',j===i);a.setAttribute('aria-selected',j===i)});
p.disabled=!i;n.disabled=i===s.length-1;h.textContent=(i+1)+' / '+s.length+'  ·  '+t[i]}
p.addEventListener('click',function(){go(i-1)});n.addEventListener('click',function(){go(i+1)});
document.addEventListener('keydown',function(v){if(v.key==='ArrowRight'||v.key==='PageDown'){go(i+1);v.preventDefault()}
if(v.key==='ArrowLeft'||v.key==='PageUp'){go(i-1);v.preventDefault()}if(v.key==='Home'){go(0);v.preventDefault()}
if(v.key==='End'){go(s.length-1);v.preventDefault()}});go(0)})();
</script></body></html>`;
}

module.exports = { deck };
