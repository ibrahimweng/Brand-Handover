'use strict';
// The deck. Not the manual reflowed: it holds one idea a slide, keeps the
// argument and drops the reference detail, and it carries slide types the
// manual has no use for at all. It also runs in the brand's own colours,
// because a presentation is brand expression where a manual is reference.
const b = require('./blocks');
const M = require('../editor/model');

const CSS = (t) => `
:root{--deep:${t.primary};--ink2:${t.secondary};--accent:${t.accent};--ground:${t.ground};
--f:${t.display};--ft:${t.text};--fm:ui-monospace,SFMono-Regular,Menlo,Consolas,var(--pkg,monospace),monospace;
--shell:#141618;--si:#EDEEEA;--sd:#7C838A;--sr:#2A2E31}
/* --sd was #6B7278, which is 3.97 to 1 on this shell — and it paints the top
   bar at 11 px and the keyboard hint at 10, in a deck that carries a contrast
   table asking 4.5 of exactly that. It had never been measured: the check was
   handed the manual's stylesheet for all three documents. #61686D is 4.61. */
:root[data-theme=light]{--shell:#E8E8E4;--si:#14171A;--sd:#61686D;--sr:#CFD0CB}
@media (prefers-color-scheme:light){:root:not([data-theme=dark]){--shell:#E8E8E4;--si:#14171A;--sd:#61686D;--sr:#CFD0CB}}
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
/* A misuse cell stands on a ground of the brand's own, because half of these
   treatments are about colour and none of them can be judged against the
   slide. The caption stays outside it, on the slide, where it is legible. */
.dont{display:flex;align-items:center;justify-content:center;height:13cqw;padding:1.6cqw}
.dont svg{max-height:100%;width:auto;max-width:100%}
.cap.said{font-family:var(--ft);font-size:1.4cqw;letter-spacing:0;text-transform:none;opacity:.8;line-height:1.35}
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
  // The deck is in the language it is written in, like the manual beside it —
  // and that is asked of the deck rather than of the project, because the two
  // documents are not written from the same words. Every slide below used to be
  // an English literal, so a French project got a French manual and an English
  // deck; and the misuse cells, which both documents share, took the manual's
  // language, so five of Verdon's captions were French inside a document
  // declared English. Both come from the dictionary now. The brand's own words
  // carry the brand's language against whichever the document is written in.
  // See src/strings.js.
  const L = ctx.deckL = require('../strings').resolve(p, 'deck');
  // The slide counter is built in the browser, so the isolate the engine puts
  // round every other value cannot reach it: `1 / 19` was drawn `19 / 1`, which
  // says slide nineteen of one. Two characters, emitted into the script.
  const ISO = L.dir === 'rtl' ? ['\u2068', '\u2069'] : ['', ''];
  // An arrow is a direction, and it was a character in the markup. In a deck
  // that reads right to left the start of the deck is on the right, so "back"
  // points right and "forward" points left — and the arrow keys go the other
  // way with them: pressing the right arrow in a right-to-left carousel moves
  // towards the beginning, which is what every reader of one expects and what
  // WAI-ARIA says. Two glyphs and one sign, and neither en nor fr could ever
  // have shown that either was wrong.
  const rtl = L.dir === 'rtl';
  const BACK = rtl ? '\u2192' : '\u2190';
  const FWD = rtl ? '\u2190' : '\u2192';
  const STEP = rtl ? -1 : 1;
  const own = (t) => b.own(ctx, t, L);
  const say = (k, v) => L.t(k, v);
  const noun = say(ctx.noun === 'mark' ? 'nounMark' : 'nounLogotype');
  const ROLE_KEY = { primary: 'rolePrimary', secondary: 'roleSecondary', accent: 'roleAccent',
    ground: 'roleGround', neutral: 'roleNeutral', support: 'roleSupport', alert: 'roleAlert' };
  const SCRIM_KEY = { top: 'scrimTop', bottom: 'scrimBottom', left: 'scrimLeft',
    right: 'scrimRight', flat: 'scrimFlat' };

  const S = [], T = [], A = [];
  const add = (title, body, cls = '') => {
    const n = S.length + 1;
    const label = say('deckSlideOf', { n, title });
    S.push(`<section class="slide ${cls}" aria-label="${b.esc(label)}">${body}<span class="num">${String(n).padStart(2, '0')}</span></section>`);
    T.push(title); A.push(label);
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
  // A statement longer than the headline holds is not a headline: set the name
  // as the headline and the statement underneath, at reading size, where it is
  // meant to be read anyway.
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
  add(say('sldTitle'), `<div class="hero" style="justify-content:flex-start;margin-bottom:3.4cqw">${plate(b.scaled(ctx.variantFor('horizontal', markWay.name), 360))}</div>
    <h1${h1Size === 7 ? '' : ` style="font-size:${h1Size}cqw"`}>${own(headline)}</h1>${lede ? `\n    <p class="lede"${ledeSize === 2.2 ? '' : ` style="font-size:${ledeSize}cqw"`}>${own(lede)}</p>` : ''}
    <p class="cap" style="margin-top:3.4cqw">${own(p.brand)} ${b.esc(p.version)} · ${b.esc(say('deckBuilt'))}</p>`);

  // Worked out before the divider that lists the slides, because a project with
  // no misuse rules has no misuse slide and a divider promising one is a
  // contents page for a deck that does not exist.
  const dont = b.misuseCells(ctx, 54, L);
  div('01', say('chMark'), [say('secConstruction'), say('secClearSpace'), say('secMinimumSize'), say('sldLockups')]
    .concat(dont.length ? [say('secMisuse')] : []));
  add(say('chMark'), `<div class="hero">${plate(b.scaled(b.asColourway(ctx, markWay), 260))}</div>
    <p class="cap" style="text-align:center;margin-top:4cqw">${own(p.brand)} · ${b.esc(say('deckPrimary'))}</p>`);
  add(say('secConstruction'), `<div class="two wide"><div><span class="bdg">${b.esc(say('bdgSystem'))}</span>
    <h2 style="margin-top:2cqw">${b.esc(say('deckMeasured'))}</h2>
    <p class="lede">${b.esc(say('deckBox', { box: m.markViewBox.w, ink: m.markInk.w,
      feature: say(m.minimumSize.from === 'stem' ? 'deckStem' : 'deckStroke'),
      thin: m.minimumSize.thinnestStroke }))}</p>
    <p class="sm">${c.constructionNotes ? own(c.constructionNotes) : b.esc(say('deckNumbers'))}</p></div>
    <div>${b.construction(ctx, { ink: ctx.ground.hex, line: ctx.ground.hex })}</div></div>`);
  add(say('secClearSpace'), `<div class="two"><div><span class="bdg">${b.esc(say('bdgSystem'))}</span>
    <h2 style="margin-top:2cqw">${b.esc(say('deckKeepClear'))}</h2>
    <p class="lede">${b.esc(say('deckClear', { x: m.clearSpace, ratio: p.rules.clearSpaceRatio }))}</p></div>
    <div>${b.clearSpace(ctx, { ink: ctx.ground.hex, line: ctx.ground.hex })}</div></div>`);
  const G = require('../geometry');
  add(say('secMinimumSize'), `<span class="bdg">${b.esc(say('bdgSystem'))}</span><h2 style="margin-top:2cqw">${b.esc(say('deckFloorPair', {
      px: G.floorText(m.minimumSize, 'px', L), mm: G.floorText(m.minimumSize, 'mm', L) }))}</h2>
    <p class="lede">${b.esc(say('deckFails', { basis: G.basisText(m.minimumSize.basisFacts, L), px: p.rules.minStrokePx }))}</p>
    <div class="four" style="margin-top:3.4cqw">${[2, 1.4, 1, 0.6].map((f) => {
      const px = Math.round(m.minimumSize.screenPx * f);
      return `<div class="cell">${plate(b.scaled(b.asColourway(ctx, markWay), px))}<p class="cap">${px} px${f === 1 ? ` · ${b.esc(say('deckAtFloor'))}` : f < 1 ? ` · ${b.esc(say('deckTooSmall'))}` : ''}</p></div>`;
    }).join('')}</div>
    <p class="sm">${b.esc(say('deckAlone', { noun }))}</p>`);
  add(say('sldLockups'), `<span class="bdg">${b.esc(say('bdgSystem'))}</span><h2 style="margin-top:2cqw">${b.esc(say('deckArrangements', {
      n: p.rules.lockups.length, c: p.rules.colourways.length }))}</h2>
    <div class="four" style="margin-top:3.4cqw">${p.rules.lockups.map((l) =>
      `<div class="cell">${plate(b.scaled(ctx.variantFor(l, markWay.name), 190))}<p class="cap">${b.esc(l)}`
      + `${ctx.floors[l] ? ` · ${b.esc(G.floorText(ctx.floors[l], 'px', L))}` : ''}</p></div>`).join('')}</div>
    <p class="sm">${b.esc(say('deckLockupsNote', { n: p.rules.lockups.length * p.rules.colourways.length, noun }))}</p>`);
  if (ctx.pairs.length) {
    // The one slide in this deck whose artwork is half somebody else's.
    add(say('secPartners'), `<span class="bdg">${b.esc(say('badgeOnce'))}</span><h2 style="margin-top:2cqw">${b.esc(say('deckPairs', {
        n: ctx.project.partners.length, p: ctx.pairs.length }))}</h2>
      <div class="four" style="margin-top:3.4cqw">${ctx.pairs.slice(0, 4).map((pr) =>
        `<div class="cell" style="background:${(ctx.colours[pr.colourway.on] || {}).hex || '#FFF'}">`
        + `${b.scaled(pr.composed.svg, 300, '100%')}<p class="cap">${b.esc(pr.partner.name)} · ${pr.floor.screenPx} px</p></div>`).join('')}</div>
      <p class="sm">${b.esc(say('deckPairsNote'))}</p>`);
  }
  // The same treatments in a fixed order, captioned by the engine from what it
  // drew. Both documents draw this from one list, so the deck and the manual
  // cannot disagree about what a rule forbids — and the list is asked for this
  // document's language rather than the manual's. See src/misuse.js.
  if (dont.length) {
    add(say('secMisuse'), `<span class="bdg">${b.esc(say('badgeOnce'))}</span><h2 style="margin-top:2cqw">${b.esc(
      say(dont.length === 1 ? 'deckBreaksOne' : 'deckBreaksMany', { n: dont.length }))}</h2>
      <div class="six" style="margin-top:2.6cqw">${dont.map((d) =>
        `<div class="cell"><div class="dont" style="${d.ground}">${d.inner}</div>`
        + `<p class="cap said">${b.esc(d.says)}</p></div>`).join('')}</div>`);
  }

  div('02', say('chColour'), [say('secPalette'), say('sldContrast')]);
  add(say('secPalette'), `<span class="bdg">${b.esc(say('bdgSystem'))}</span><h2 style="margin-top:2cqw">${b.esc(say('deckColours', { n: Object.keys(ctx.colours).length }))}</h2>
    <div class="chips">${Object.entries(ctx.colours).map(([n, t]) =>
      `<div class="chip"><div class="sw" style="background:${t.hex}"></div><b>${b.esc(n)}</b><span>${t.hex}</span><span>${b.esc(t.role && ROLE_KEY[t.role] ? say(ROLE_KEY[t.role]) : (t.role || ''))}</span></div>`).join('')}</div>
    <p class="sm">${own(c.colourRationale)}</p>`, 'light');
  const cls = { AAA: 'ok', AA: 'ok', 'AA-large': 'warn', fail: 'bad' };
  add(say('sldContrast'), `<span class="bdg">${b.esc(say('bdgSystem'))}</span><h2 style="margin-top:2cqw">${b.esc(say('deckChecked'))}</h2>
    <div class="ct">${ctx.contrast.slice(0, 6).map((x) =>
      `<div class="ctr"><div class="cp" style="background:${x.bgHex};color:${x.fgHex}">Aa</div>
       <span>${b.esc(say('deckOn', { fg: x.fg, bg: x.bg }))}</span><em>${x.ratio}:1</em><i class="v-${cls[x.level]}">${b.esc(x.useKey ? say(x.useKey) : x.use)}</i></div>`).join('')}</div>
    <p class="sm">${b.esc(say('deckContrastNote'))}</p>`, 'light');

  // A scale is a decision, not a measurement. A project that states none — the
  // front door decides one for nobody — gets no scale slide and is not promised
  // one on the divider, the same way a deck with no misuse rules has no misuse
  // slide. It used to say "0 steps" over an empty box.
  const steps = ((p.tokens.type || {}).scale || []).length;
  div('03', say('chType'), [say('secTypefaces')].concat(steps ? [say('secScale')] : []));
  const fams = Object.entries((p.tokens.type || {}).families || {});
  add(say('secTypefaces'), `<span class="bdg">${b.esc(say('bdgSystem'))}</span><h2 style="margin-top:2cqw">${b.esc(say('deckFaces', { n: fams.length }))}</h2>
    ${fams.map(([role, f]) => `<div style="margin-top:2.6cqw"><p class="cap" style="margin:0">${b.esc(f.family)} · ${b.esc(role)}</p>
      <p class="alpha" style="font-family:'${b.esc(f.family)}',${b.esc(f.fallback || 'sans-serif')};font-weight:${(f.weights || [400])[0]}">${b.esc(say('alphabet'))}</p></div>`).join('')}
    <p class="sm">${own(c.typeRationale)}</p>`, 'light');
  if (steps) add(say('secScale'), `<span class="bdg">${b.esc(say('bdgSystem'))}</span><h2 style="margin-top:2cqw">${b.esc(say('deckSteps', { n: steps }))}</h2>
    <div style="margin-top:2.4cqw">${((p.tokens.type || {}).scale || []).slice(0, 4).map((s) => {
      const f = ((p.tokens.type || {}).families || {})[s.family] || {};
      return `<p style="font-family:'${b.esc(f.family)}',${b.esc(f.fallback || 'sans-serif')};font-weight:${s.weight};font-size:${Math.min(s.size / 12, 4.4)}cqw;line-height:1.15;margin-top:1.4cqw">${own(s.sample)}</p>`;
    }).join('')}</div>
    <p class="sm">${b.esc(say('deckScaleNote'))}</p>`, 'light');

  // The rule blocks — the pattern, the treatment, the icon grid, the motion —
  // were in brand.json and on the canvas and in neither document. A deck that
  // counts the pattern tiles among its files and never shows one is describing
  // somebody else's identity.
  const svgu = require('../svg');
  const master = p.assets[m.master || (p.assets.mark ? 'mark' : 'wordmark')];
  const sysSlides = [];
  if (ctx.pattern && ctx.pattern.ok && ctx.pattern.tiles.length) sysSlides.push([say('secPattern'), () => {
    const r = ctx.system.pattern;
    const on = b.showOn(ctx);
    const ink = b.inkOn(ctx, on.colourway);
    const pat = require('../pattern');
    const sp = pat.spec(master.source, r, ctx.measured);
    const cells = Object.entries(r.densities).map(([d, f]) => {
      const scaled = Object.assign({}, r, { tile: svgu.round(sp.cell * f) });
      return `<div style="flex:1;aspect-ratio:1;overflow:hidden">${pat.swatch(master.source, scaled, ink, on.ground.hex, 300, 300, `k-${d}`, ctx.measured) || ''}</div>`;
    }).join('');
    return `<span class="bdg">${b.esc(say('bdgOnce'))}</span><h2 style="margin-top:2cqw">${b.esc(say('deckTiles', { n: ctx.pattern.tiles.length }))}</h2>
      <div style="display:flex;gap:1.6cqw;margin-top:2.4cqw">${cells}</div>
      <p class="sm">${say('deckPatternNote', {
        motif: b.esc(pat.motifName(sp.motif, L)), draws: b.esc(pat.drawsText(sp.construction, L)),
        d: Object.keys(r.densities).length,
        c: [...new Set(ctx.pattern.tiles.map((t) => t.colourway))].length,
        noun: b.esc(noun), n: ctx.pattern.tiles.length })}</p>`;
  }]);
  if (ctx.system.photography.declared) sysSlides.push([say('secPhotography'), () => {
    const r = ctx.system.photography;
    const PH = require('../photography');
    const ramp = [];
    for (let i = 0; i < 11; i++) {
      const v = i / 10;
      const t = PH.treatPixel(r, { colours: ctx.colours, roles: ctx.roles }, { r: v, g: v, b: v });
      ramp.push(`<i style="flex:1;background:rgb(${Math.round(t.r * 255)},${Math.round(t.g * 255)},${Math.round(t.b * 255)})"></i>`);
    }
    // One sentence per thing that is set, in the order they are set, so a
    // language that puts them together differently can.
    const said = [];
    if (r.duotone) said.push(say('deckPhotoFrom', { a: b.esc(r.duotone.shadow), b: b.esc(r.duotone.highlight) }));
    if (r.scrim) {
      said.push(say('deckPhotoScrim', { dir: b.esc(say(SCRIM_KEY[r.scrim.direction] || 'scrimBottom')),
        pc: Math.round(r.scrim.opacity * 100) }));
    }
    said.push(b.esc(say('deckPhotoNote')));
    return `<span class="bdg">${b.esc(say('bdgOnce'))}</span><h2 style="margin-top:2cqw">${b.esc(say(r.duotone ? 'deckDuotone' : 'deckTreatment'))}</h2>
      <div style="display:flex;height:12cqw;margin-top:2.4cqw">${ramp.join('')}</div>
      <p class="sm">${said.join(' ')}</p>`;
  }]);
  if ((p.system || {}).motion) sysSlides.push([say('secMotion'), () => {
    const r = ctx.system.motion;
    const sys = require('../system');
    return `<span class="bdg">${b.esc(say('bdgOnce'))}</span><h2 style="margin-top:2cqw">${b.esc(say('deckCurves', { n: Object.keys(r.durations).length }))}</h2>
      <p class="lede">${Object.entries(r.durations).map(([n, ms]) => `${b.esc(n)} ${ms} ms`).join(' · ')}</p>
      <p class="sm">${Object.entries(r.easing).map(([n, e]) => `<b>${b.esc(n)}</b> ${sys.bezier(e)}`).join(' &nbsp; ')}<br>${r.build.length
        ? b.esc(say('deckBuilds', { n: r.build.length, how: say(r.loop ? 'deckLoops' : 'deckPlaysOnce') }))
        : b.esc(say('deckNoBuild'))}</p>`;
  }]);
  if (sysSlides.length) {
    div('04', say('chSystem'), sysSlides.map(([name]) => name));
    for (const [name, body] of sysSlides) add(name, body(), 'light');
  }

  div(sysSlides.length ? '05' : '04', say('chAssets'), [say('sldPackage'), say('secMachineFile')]);
  add(say('sldPackage'), `<div class="two wide"><div><span class="bdg">${b.esc(say('bdgSystem'))}</span>
    <h2 style="margin-top:2cqw">${b.esc(say('deckFiles', { n: ctx.files.length }))}</h2>
    <p class="lede">${b.esc(say('deckPackageLede'))}</p>
    <p class="sm"><b>${b.esc(say('deckPackageNote'))}</b></p></div>
    <div>${(() => { const g = new Map(); for (const f of ctx.files) { const d = f.path.includes('/') ? f.path.split('/')[0] : say('deckRoot'); g.set(d, (g.get(d) || 0) + 1); }
      return [...g.entries()].sort().map(([d, n]) => `<div class="ctr" style="grid-template-columns:1fr auto"><span style="font-family:var(--fm);font-size:1.4cqw">${b.esc(d)}</span><em>${n}</em></div>`).join(''); })()}</div></div>`);

  add(say('sldClose'), `<h2 style="font-size:4.4cqw;max-width:25ch">${b.esc(say('deckCloseA'))}</h2>
    <h2 style="font-size:4.4cqw;max-width:25ch;color:var(--accent);margin-top:1.4cqw">${b.esc(say('deckCloseB'))}</h2>
    <p class="sm" style="margin-top:3.4cqw">${b.esc(say('deckCloseNote'))}</p>`);

  const t = {
    primary: ctx.primary.hex, secondary: (Object.values(ctx.colours).find((x) => x.role === 'secondary') || ctx.primary).hex,
    accent: ctx.accent.hex, ground: ctx.ground.hex,
    display: `'${((p.tokens.type || {}).families || {}).display?.family || 'Helvetica'}',Helvetica,Arial,sans-serif`,
    text: `'${((p.tokens.type || {}).families || {}).text?.family || 'Georgia'}',Georgia,serif`,
  };
  const { fontLink } = require('./chrome');
  // The brand's name is the brand's own word and carries its own language where
  // that is not the deck's, so it goes into the strip around the dictionary's
  // sentence rather than through it.
  const strip = say('deckTitle', { brand: '\u0000' }).split('\u0000').map(b.esc).join(own(p.brand));
  return `<!doctype html><html lang="${b.esc(L.lang)}" dir="${b.esc(L.dir)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${b.esc(say('deckDocTitle', { brand: p.brand }))}</title>
${fontLink(p.tokens.type, p.fonts, S.join(''))}
<style>${CSS(t)}</style></head><body>
<div class="wrap">
  <div class="topbar"><span>${strip}</span><span><b id="ttl"></b></span></div>
  <main class="stage" id="stage" role="region" aria-roledescription="${b.esc(say('deckCarousel'))}" aria-label="${b.esc(say('deckDocTitle', { brand: p.brand }))}">${S.join('')}</main>
  <div class="ctrl"><button class="btn" id="prev" type="button">${BACK} ${b.esc(say('deckPrev'))}</button>
  <div class="dots" id="dots" role="tablist" aria-label="${b.esc(say('deckSlides'))}"></div>
  <button class="btn" id="next" type="button">${b.esc(say('deckNext'))} ${FWD}</button><span class="hint">${b.esc(say('deckKeys'))}</span></div>
</div>
<script>
(function(){var s=[].slice.call(document.querySelectorAll('.slide')),t=${JSON.stringify(T)},a=${JSON.stringify(A)},i=0,
d=document.getElementById('dots'),p=document.getElementById('prev'),n=document.getElementById('next'),h=document.getElementById('ttl');
s.forEach(function(_,k){var x=document.createElement('button');x.className='dot'+(k?'':' on');x.type='button';x.setAttribute('role','tab');
x.setAttribute('aria-label',a[k]);x.addEventListener('click',function(){go(k)});d.appendChild(x)});
var e=[].slice.call(d.children);
function go(k){i=Math.max(0,Math.min(s.length-1,k));s.forEach(function(a,j){a.classList.toggle('on',j===i)});
e.forEach(function(a,j){a.classList.toggle('on',j===i);a.setAttribute('aria-selected',j===i)});
p.disabled=!i;n.disabled=i===s.length-1;h.textContent=${JSON.stringify(ISO[0])}+(i+1)+' / '+s.length+${JSON.stringify(ISO[1])}+'  ·  '+t[i]}
p.addEventListener('click',function(){go(i-1)});n.addEventListener('click',function(){go(i+1)});
document.addEventListener('keydown',function(v){var w=${STEP};if(v.key==='ArrowRight'){go(i+w);v.preventDefault()}
if(v.key==='ArrowLeft'){go(i-w);v.preventDefault()}
if(v.key==='PageDown'){go(i+1);v.preventDefault()}if(v.key==='PageUp'){go(i-1);v.preventDefault()}if(v.key==='Home'){go(0);v.preventDefault()}
if(v.key==='End'){go(s.length-1);v.preventDefault()}});go(0)})();
</script></body></html>`;
}

module.exports = { deck };
