/* Turning an edited document into a page anybody can open.
   This is the same file in Node and in the browser, so the Publish button in
   the editor and the publish command on the server produce identical bytes.
   Two publish paths would drift, and the whole point of editing real DOM was to
   have one. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./render'), require('./model'), require('../print'));
  else root.HandoverPublish = factory(root.HandoverRender, root.HandoverModel, root.HandoverPrint);
}(typeof self !== 'undefined' ? self : this, function (R, M, PR) {
  'use strict';
  const esc = R.esc;

  const fontLink = (type) => {
    const fams = Object.values((type && type.families) || {}).filter((f) => f.google)
      .map((f) => 'family=' + encodeURIComponent(f.family).replace(/%20/g, '+') + ':wght@' + (f.weights || [400]).join(';'));
    return fams.length ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fams.join('&')}&display=swap">` : '';
  };

  const CSS = () => `
:root{--shell:#15181A;--ink:#E9EBEC;--dim:#8A9198;--line:#2A2E31}
@media (prefers-color-scheme:light){:root{--shell:#E9E9E6;--ink:#15181A;--dim:#666C71;--line:#D2D3CF}}
*{box-sizing:border-box}
html,body{margin:0;background:var(--shell);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,sans-serif}
.hp-bar{position:fixed;top:0;left:0;right:0;height:42px;display:flex;align-items:center;gap:12px;
  padding:0 16px;background:color-mix(in srgb,var(--shell) 86%,transparent);backdrop-filter:blur(8px);
  border-bottom:1px solid var(--line);font-size:12px;z-index:10}
.hp-bar b{font-weight:600}.hp-bar span{color:var(--dim);font-family:ui-monospace,Menlo,monospace;font-size:11px}
.hp-bar .sp{flex:1}
.hp-bar button{background:none;border:1px solid var(--line);color:var(--ink);border-radius:4px;padding:5px 11px;cursor:pointer;font:inherit}
.hp-bar button:hover{background:color-mix(in srgb,var(--ink) 8%,transparent)}
.hp-doc{padding:70px 24px 60px;display:flex;flex-direction:column;align-items:center;gap:28px}
.hp-page{position:relative;overflow:hidden;box-shadow:0 4px 30px rgba(0,0,0,.28);flex:none;
  transform-origin:top center}
.hp-trim{position:absolute;overflow:hidden}
.hp-cap{font-family:ui-monospace,Menlo,monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);margin-top:-18px}
.hb-block{position:absolute}
@media print{
  html,body{background:#fff}
  .hp-bar,.hp-cap{display:none}
  .hp-doc{padding:0;gap:0;display:block}
  .hp-page{box-shadow:none;break-after:page;page-break-after:always;margin:0}
  .hp-page:last-child{break-after:auto;page-break-after:auto}

}
`;

  // block styles the published page needs, kept identical to the editor's
  const BLOCK_CSS = `
.hb-slot{width:100%;height:100%;border:1.5px dashed rgba(128,128,128,.45);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;color:rgba(128,128,128,.85)}
.hb-slot b{font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;font-weight:500}
.hb-slot span{font-family:ui-monospace,Menlo,monospace;font-size:10px;opacity:.75}
.hb-img{width:100%;height:100%;margin:0;display:flex;flex-direction:column;overflow:hidden}
.hb-img-f{flex:1;min-height:0;overflow:hidden;position:relative}
.hb-scrim{position:absolute;inset:0;pointer-events:none}
.hb-photo{width:100%;height:100%;display:flex;flex-direction:column;gap:9px;padding:12px;box-sizing:border-box}
.hb-photo .ramp{flex:1;min-height:34px;display:flex;position:relative;overflow:hidden}
.hb-photo .ramp i{flex:1}
.hb-photo .rows{font-family:ui-monospace,Menlo,monospace;font-size:10.5px;line-height:1.7}
.hb-photo .r{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid currentColor;opacity:.85}
.hb-photo .r span{opacity:.6;letter-spacing:.06em;text-transform:uppercase;font-size:9px}
.hb-photo .r em{font-style:normal}
.hb-img figcaption,figure.hb-img>figcaption{flex:none;padding-top:7px}
.hb-img img{background:rgba(128,128,128,.12)}
.hb-surface{width:100%;height:100%}
.hb-missing{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#3A2422;color:#E8695F;font-family:ui-monospace,Menlo,monospace;font-size:11px;text-align:center;padding:8px}
.hb-sizes{display:flex;gap:14px;align-items:flex-end;width:100%;height:100%}
.hb-sizes figure{margin:0;flex:1;min-width:0;text-align:center;display:flex;flex-direction:column;justify-content:flex-end}
.hb-sizes .cell{flex:1;min-height:0;display:flex;align-items:flex-end;justify-content:center}
.hb-sizes figcaption{font-family:ui-monospace,Menlo,monospace;font-size:9px;letter-spacing:.06em;text-transform:uppercase;opacity:.55;margin-top:6px}
.hb-chips{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;width:100%;height:100%}
.hb-chips .sw{height:56%;border:1px solid rgba(0,0,0,.08)}
.hb-chips b{display:block;font-size:13px;margin-top:7px}
.hb-chips span{display:block;font-family:ui-monospace,Menlo,monospace;font-size:9.5px;opacity:.6}
.hb-chips .pms{font-style:italic}
.hb-chips .guess{color:#8A6410;font-style:italic}
.hb-ctab{width:100%;height:100%;font-size:12px}
.hb-ctab .r{display:grid;grid-template-columns:40px 1fr 54px 96px;gap:10px;align-items:center;padding:5px 0;border-bottom:1px solid rgba(128,128,128,.22)}
.hb-ctab .cp{display:flex;align-items:center;justify-content:center;height:26px;font-weight:600;font-size:11px}
.hb-ctab em{font-family:ui-monospace,Menlo,monospace;font-style:normal;font-size:11px;text-align:right}
.hb-ctab i{font-family:ui-monospace,Menlo,monospace;font-style:normal;font-size:9px;letter-spacing:.05em;text-transform:uppercase;text-align:right}
.hb-ctab .ok{color:#1B7A4B}.hb-ctab .warn{color:#8A6410}.hb-ctab .bad{color:#C2352B}
.hb-faces{display:grid;gap:14px;width:100%;height:100%}
.hb-faces .fl{font-family:ui-monospace,Menlo,monospace;font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;opacity:.55;margin:0}
.hb-atab{width:100%;height:100%;font-family:ui-monospace,Menlo,monospace;font-size:11.5px}
.hb-atab .r{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(128,128,128,.22)}
.hb-atab .total{font-weight:600;border-bottom:none}
.hb-atab em{font-style:normal;opacity:.6}
`;

  // The closing script tag below is escaped on purpose. This file gets inlined
  // into the editor inside a <script> block, and an unescaped one would close
  // that block early and take the rest of the editor with it.

  // A page is laid out in pixels and printed at its real size. 794 px is only
  // A4 by accident of 96 dpi; a printer has to be told 210 mm, so the @page
  // rule carries the physical size and the screen carries the pixels.
  //
  // A document can mix sizes, so the size used by most pages becomes the plain
  // @page rule and every other one gets a named rule. That way a browser that
  // does not do named pages still prints the bulk of the document correctly.
  const keyOf = (s) => `${s.w}x${s.h}:${s.css}`;

  function sheets(doc) {
    const spec = M.printSpec(doc);
    const seen = new Map(), order = [];
    for (const p of doc.pages) {
      const s = M.pageSize(doc, p);
      const key = keyOf(s);
      if (!seen.has(key)) {
        seen.set(key, { sheet: s, box: PR.boxes(s, spec), key, n: 0, cls: 'hs' + order.length });
        order.push(key);
      }
      seen.get(key).n++;
    }
    const list = order.map((k) => seen.get(k));
    const main = list.slice().sort((a, b) => b.n - a.n)[0];
    return { list, main, spec, of: (p) => seen.get(keyOf(M.pageSize(doc, p))) };
  }

  // Screen shows the trim box, because a reader has no use for a bleed. Paper
  // shows the media box, with the artwork running past the trim and the marks
  // saying where to cut. One markup, two presentations, which is the same
  // arrangement that keeps the canvas and the published page from drifting.
  // Only written when a page actually bleeds, so a document that does not use
  // it publishes exactly the bytes it did before the feature existed.
  const BLEED_CSS = `
.hp-marks{position:absolute;left:0;top:0;display:none}
@media print{
  .hp-page.hp-b{overflow:visible}
  .hp-page.hp-b .hp-trim{overflow:visible}
  .hp-marks{display:block}
}`;

  function pageCss(sh) {
    const rules = [];
    for (const e of sh.list) {
      const b = e.box;
      rules.push(`.${e.cls}{width:${e.sheet.w}px;height:${e.sheet.h}px}`);
      rules.push(`.${e.cls} .hp-trim{left:0;top:0;width:${e.sheet.w}px;height:${e.sheet.h}px}`);
      if (!b.bleed) continue;
      rules.push(`@media print{.${e.cls}{width:${b.media.w}px;height:${b.media.h}px}`
        + `.${e.cls} .hp-trim{left:${b.offset}px;top:${b.offsetY}px}}`);
    }
    const printed = [`@page{size:${sh.main.box.css};margin:0}`];
    for (const e of sh.list) {
      if (e === sh.main) continue;
      printed.push(`@page ${e.cls}{size:${e.box.css};margin:0}`, `@media print{.${e.cls}{page:${e.cls}}}`);
    }
    const bleeds = sh.list.some((e) => e.box.bleed);
    return rules.join('\n') + '\n' + printed.join('\n') + (bleeds ? BLEED_CSS : '');
  }

  // The document holds layout only. Every measurement comes from the bundle at
  // publish time, which is why republishing after a change to the master gives
  // new numbers without anybody reopening the editor.
  function publish(doc, bundle, opts) {
    const o = opts || {};
    const sh = sheets(doc);
    const pages = doc.pages.map((p, i) => {
      const e = sh.of(p);
      return `<section class="hp-page ${e.cls}${e.box.bleed ? ' hp-b' : ''}" style="background:${bundle.roles.ground.hex}" aria-label="Page ${i + 1}, ${esc(p.name)}">`
        + `<div class="hp-trim">`
        + p.blocks.map((b) => R.positioned(b, bundle, e.sheet, e.box)).join('')
        + `</div>${PR.marks(e.box)}</section>`
        + (o.captions === false ? '' : `<p class="hp-cap">${String(i + 1).padStart(2, '0')} · ${esc(p.name)}${sh.list.length > 1 ? ' · ' + esc(e.sheet.name) : ''}</p>`);
    }).join('\n');

    return `<!doctype html><html lang="${esc(bundle.language || 'en')}" dir="${esc(bundle.direction || 'ltr')}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(bundle.brand)}${o.title ? ' · ' + esc(o.title) : ''}</title>
${fontLink(bundle.type)}
<style>${CSS()}${pageCss(sh)}${BLOCK_CSS}</style></head><body>
<div class="hp-bar">
  <b>${esc(bundle.brand)}</b><span>${esc(bundle.version)}</span>
  <span>${doc.pages.length} page${doc.pages.length === 1 ? '' : 's'}</span>
  <span class="sp"></span>
  <span>built ${esc(o.builtAt || (typeof process !== 'undefined' && process.env && process.env.SOURCE_DATE_EPOCH
    ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000) : new Date()).toISOString().slice(0, 10))}</span>
  <button onclick="print()">Print or save as PDF</button>
</div>
<main class="hp-doc">
${pages}
</main>
<script>
// scale each page down on a narrow screen rather than letting the page scroll sideways
// offsetWidth is the laid-out size and a transform does not change it, so this
// stays correct however many times it runs
(function(){function fit(){document.querySelectorAll('.hp-page').forEach(function(p){
var w=p.offsetWidth,h=p.offsetHeight,a=Math.min(1,(innerWidth-56)/w);
p.style.transform='scale('+a+')';p.style.marginBottom=(a<1?-(1-a)*h:0)+'px'})}
addEventListener('resize',fit);fit()})();
<\/script>
</body></html>`;
  }

  return { publish, CSS, BLOCK_CSS };
}));
