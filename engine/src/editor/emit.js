'use strict';
// Assembles one self-contained editor. No server, no build step: open the file
// and it works, because the bundle and every script are inlined.
const fs = require('fs');
const path = require('path');
const { bundle, starterDoc } = require('./bundle');

const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');

// A brand name is project text, and it is allowed to contain an ampersand.
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// One answer for four documents: src/typeface.js, worked out in bundle.js and
// carried here, so the bytes of a shipped typeface sit in this file once.
const fontLink = (bu) => bu.fontHead || '';

const CSS = `
:root{--bg:#141618;--pane:#1B1E20;--line:#2A2E31;--ink:#ECEEF0;--dim:#9199A0;--sel:#3B82F6;--danger:#E8695F;
--ui:ui-sans-serif,system-ui,-apple-system,"Segoe UI",var(--pkg,sans-serif),sans-serif;--mono:ui-monospace,"SF Mono",Menlo,var(--pkg,monospace),monospace}
*{box-sizing:border-box}
html,body{height:100%}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--ui);font-size:13px;overflow:hidden}
button,input,select,textarea{font:inherit;color:inherit}
/* Every control here had a focus ring only because Chromium draws one by
   default. A default is not a decision: it is the browser's colour against a
   dark application, and it changes between browsers. Say it. */
:focus-visible{outline:2px solid var(--sel);outline-offset:2px}
.hb-block:focus-visible{outline:2px solid var(--sel);outline-offset:-2px}
/* A name a screen reader reads and the page does not show. */
.sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;
  clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0}
.app{display:grid;grid-template-columns:210px 1fr 250px;grid-template-rows:44px 1fr;height:100vh}
.bar{grid-column:1/-1;display:flex;align-items:center;gap:8px;padding:0 12px;border-bottom:1px solid var(--line);background:var(--pane)}
.bar .brand{font-weight:600;letter-spacing:-.01em;font-size:13px;margin:0}.bar .ver{font-family:var(--mono);font-size:11px;color:var(--dim)}
.bar .sp{flex:1}
.bar button,.tool{background:none;border:1px solid var(--line);color:var(--ink);padding:5px 10px;border-radius:4px;cursor:pointer}
.bar button:hover:not(:disabled),.tool:hover{background:#24282B}
.bar button:disabled{opacity:.35;cursor:default}
.bar select{background:var(--bg);border:1px solid var(--line);border-radius:4px;padding:5px 6px}
.rail,.side{background:var(--pane);overflow-y:auto;padding:12px}
/* An application that runs the other way is not the same application
   mirrored: a block's x and y are the design and stay where they are put,
   and the furniture around them is reading order and turns over. So the
   panes, the notes and the page buttons take logical properties and the
   sheet keeps physical ones. */
.rail{border-inline-end:1px solid var(--line)}.side{border-inline-start:1px solid var(--line)}
.app h2{margin:0 0 8px;font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:var(--dim);font-weight:500}
.pg{display:flex;align-items:center;gap:8px;width:100%;background:none;border:1px solid transparent;border-radius:5px;padding:7px 8px;cursor:pointer;text-align:start;margin-bottom:2px}
.pg:hover{background:#24282B}.pg.on{background:#24282B;border-color:var(--line)}
.pg i{font-family:var(--mono);font-size:10px;color:var(--dim);font-style:normal}
.pg span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pg em{font-family:var(--mono);font-size:10px;color:var(--dim);font-style:normal}
.pgbtns{display:flex;gap:6px;margin:8px 0 18px}
.pgbtns button{flex:1;background:none;border:1px solid var(--line);border-radius:4px;padding:5px;cursor:pointer;color:var(--dim)}
.pgbtns button:hover{background:#24282B;color:var(--ink)}
.gl{margin:14px 0 6px;font-size:10px;letter-spacing:.11em;text-transform:uppercase;color:var(--dim)}
.gi{display:flex;flex-wrap:wrap;gap:5px}
.ins{background:none;border:1px solid var(--line);border-radius:4px;padding:5px 8px;cursor:pointer;font-size:11.5px;color:var(--dim)}
.ins:hover{background:#24282B;color:var(--ink);border-color:#3A4045}
#canvas{position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;background:
  repeating-conic-gradient(#191C1E 0% 25%,#1D2123 0% 50%) 50%/22px 22px}
#stage{position:relative;transform-origin:center center;box-shadow:0 6px 40px rgba(0,0,0,.5);overflow:hidden}
#sheet{position:absolute;overflow:hidden}
#overlay{position:absolute;pointer-events:none}
/* where the guillotine goes. Drawn over the artwork, under the selection. */
#trimline{position:absolute;display:none;pointer-events:none;outline:1px dashed rgba(226,200,106,.85);outline-offset:0}
.sel{position:absolute;outline:1.5px solid var(--sel);outline-offset:0}
.sel .tag{position:absolute;top:-19px;left:0;background:var(--sel);color:var(--bg);font-family:var(--mono);font-size:10px;padding:1px 5px;border-radius:3px 3px 0 0;white-space:nowrap}
.h{position:absolute;width:9px;height:9px;background:#fff;border:1.5px solid var(--sel);border-radius:2px;pointer-events:auto}
.h-nw{left:-5px;top:-5px;cursor:nwse-resize}.h-n{left:calc(50% - 4px);top:-5px;cursor:ns-resize}
.h-ne{right:-5px;top:-5px;cursor:nesw-resize}.h-e{right:-5px;top:calc(50% - 4px);cursor:ew-resize}
.h-se{right:-5px;bottom:-5px;cursor:nwse-resize}.h-s{left:calc(50% - 4px);bottom:-5px;cursor:ns-resize}
.h-sw{left:-5px;bottom:-5px;cursor:nesw-resize}.h-w{left:-5px;top:calc(50% - 4px);cursor:ew-resize}
.marq{position:absolute;border:1px solid var(--sel);background:rgba(59,130,246,.12)}
.hb-block{cursor:default}
.hb-text.editing{outline:1.5px dashed var(--sel);outline-offset:3px}
.ph{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:10px}
.ph h3{margin:0;font-size:14px;font-weight:600}
.kind{font-family:var(--mono);font-size:9px;letter-spacing:.08em;text-transform:uppercase;padding:2px 6px;border-radius:3px}
.kind.d{background:#1E3A2E;color:#7EE0A8}.kind.p{background:#2A2E31;color:var(--dim)}
.kind.r{background:#33301C;color:#E2C86A}
.hint{font-size:12px;line-height:1.5;color:var(--dim);margin:0 0 12px}
.grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}
.grid4 input{width:100%;background:var(--bg);border:1px solid var(--line);border-radius:4px;padding:5px 6px;font-family:var(--mono);font-size:11px}
.labels{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin:3px 0 14px}
.labels span{font-family:var(--mono);font-size:9px;color:var(--dim);text-align:center}
.f{display:block;margin-bottom:10px}
.f>span{display:block;font-size:10px;letter-spacing:.09em;text-transform:uppercase;color:var(--dim);margin-bottom:4px}
.f:has(input[type=checkbox]){display:flex;align-items:center;gap:8px;cursor:pointer}
.f:has(input[type=checkbox])>span{margin:0;order:2}
.f input[type=checkbox]{width:auto;margin:0;accent-color:#E2C86A}
.f input,.f select,.f textarea{width:100%;background:var(--bg);border:1px solid var(--line);border-radius:4px;padding:6px 7px;font-size:12px}
.f textarea{resize:vertical;font-family:var(--ui);line-height:1.45}
.ord{display:flex;gap:4px;margin:14px 0 10px}
.ord button{flex:1;background:none;border:1px solid var(--line);border-radius:4px;padding:5px;cursor:pointer;color:var(--dim);font-size:11px}
.ord button:hover{background:#24282B;color:var(--ink)}
.danger{width:100%;background:none;border:1px solid #4A2A28;color:var(--danger);border-radius:4px;padding:7px;cursor:pointer}
.danger:hover{background:#2A1D1C}
#zoom{font-family:var(--mono);font-size:11px;color:var(--dim);min-width:42px;text-align:end;direction:ltr}
.bar select{background:var(--bg);border:1px solid var(--line);color:var(--ink);border-radius:4px;padding:3px 5px;font:inherit;font-size:11px}
.pgsize{margin:10px 0 18px}
.pgsize select{width:100%;background:var(--bg);border:1px solid var(--line);color:var(--ink);border-radius:4px;padding:5px 6px;font-size:12px}
.pg u{display:block;font-family:var(--mono);font-size:9px;color:var(--dim);text-decoration:none;margin-top:1px}
#sheetname{position:absolute;left:50%;transform:translateX(-50%);bottom:6px;font-family:var(--mono);font-size:10px;
  letter-spacing:.08em;color:var(--dim);pointer-events:none}
.keys{margin-top:18px;padding-top:14px;border-top:1px solid var(--line);font-family:var(--mono);font-size:10px;line-height:1.9;color:var(--dim)}
.keys b{color:var(--ink);font-weight:400}
#notes{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);display:flex;flex-direction:column;gap:6px;z-index:20;pointer-events:none;max-width:640px}
.note{pointer-events:auto;background:var(--pane);border:1px solid var(--line);border-inline-start:2px solid var(--sel);border-radius:5px;
  padding:9px 12px;padding-inline-end:30px;font-size:12px;line-height:1.5;position:relative;box-shadow:0 6px 22px rgba(0,0,0,.4)}
.note.warn{border-inline-start-color:#E2C86A}
.nx{position:absolute;top:5px;inset-inline-end:6px;background:none;border:none;color:var(--dim);cursor:pointer;font-size:15px;line-height:1;padding:2px 4px}
.imeta{font-family:var(--mono);font-size:10.5px}
.hint.bad{color:#E2C86A;border-inline-start:2px solid #E2C86A;padding-inline-start:9px}
.trimwarn{position:absolute;transform:translate(4px,4px);background:#E2C86A;color:#231F09;font-family:var(--mono);
  font-size:9px;letter-spacing:.05em;padding:1px 5px;border-radius:3px;pointer-events:auto;cursor:help}
.quad{position:absolute;inset:0;pointer-events:none}
.quadline{position:absolute;left:0;top:0}
.qh{position:absolute;width:13px;height:13px;margin:-7px 0 0 -7px;border-radius:50%;
  background:var(--sel);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5);cursor:grab;pointer-events:auto}
.qh:active{cursor:grabbing}
.ghost{width:100%;background:none;border:1px solid var(--line);color:var(--dim);border-radius:4px;padding:6px;cursor:pointer;margin-top:4px;font:inherit}
.ghost:hover{color:var(--ink)}
.ovwarn{position:absolute;transform:translateY(4px);background:#E2C86A;color:#231F09;font-family:var(--mono);
  font-size:9px;letter-spacing:.05em;padding:2px 6px;border-radius:3px;white-space:nowrap;pointer-events:auto;cursor:help}
.f input[type=range]{padding:0;height:20px;accent-color:var(--sel);background:none;border:none}
/* blocks */
.hb-slot{width:100%;height:100%;border:1.5px dashed rgba(128,128,128,.45);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;color:rgba(128,128,128,.85)}
.hb-slot b{font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;font-weight:500}
.hb-slot span{font-family:var(--mono);font-size:10px;opacity:.75}
.hb-block[data-type=slot].drop .hb-slot{border-color:var(--sel);border-style:solid;color:var(--sel)}
.hb-img{width:100%;height:100%;margin:0;display:flex;flex-direction:column;overflow:hidden}
.hb-img-f{flex:1;min-height:0;overflow:hidden;position:relative}
.hb-scrim{position:absolute;inset:0;pointer-events:none}
.hb-photo{width:100%;height:100%;display:flex;flex-direction:column;gap:9px;padding:12px;box-sizing:border-box}
.hb-photo .ramp{flex:1;min-height:34px;display:flex;position:relative;overflow:hidden}
.hb-photo .ramp i{flex:1}
.hb-photo .rows{font-family:var(--mono);font-size:10.5px;line-height:1.7}
.hb-photo .r{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid currentColor;opacity:.85}
.hb-photo .r span{opacity:.6;letter-spacing:.06em;text-transform:uppercase;font-size:9px}
.hb-photo .r em{font-style:normal}
.hb-img figcaption,figure.hb-img>figcaption{flex:none;padding-top:7px}
.hb-img img{background:rgba(128,128,128,.12)}
.hb-surface{width:100%;height:100%}
.hb-missing{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#3A2422;color:#E8695F;font-family:var(--mono);font-size:11px;text-align:center;padding:8px}
.hb-sizes{display:flex;gap:14px;align-items:flex-end;width:100%;height:100%}
.hb-sizes figure{margin:0;flex:1;min-width:0;text-align:center;display:flex;flex-direction:column;justify-content:flex-end}
.hb-sizes .cell{flex:1;min-height:0;display:flex;align-items:flex-end;justify-content:center}
.hb-sizes figcaption{font-family:var(--mono);font-size:9px;letter-spacing:.06em;text-transform:uppercase;opacity:.55;margin-top:6px}
.hb-chips{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;width:100%;height:100%}
.hb-chips .sw{height:56%;border:1px solid rgba(0,0,0,.08)}
.hb-chips b{display:block;font-size:13px;margin-top:7px}
.hb-chips span{display:block;font-family:var(--mono);font-size:9.5px;opacity:.6;direction:ltr}
/* A measured value is a left-to-right run wherever the page reads. The same
   rule the two documents got when Hebrew arrived: a browser laying out #C8873A
   inside right-to-left prose draws C8873A#, and 18 59 58 draws 58 59 18, which
   is a different colour. These blocks are drawn by src/editor/render.js and are
   the same on the canvas and on the page it publishes. */
.hb-atab .r code,.hb-atab .r em{direction:ltr}
.hb-chips .pms{font-style:italic}
.hb-chips .guess{font-style:italic}
.hb-ctab{width:100%;height:100%;font-size:12px}
.hb-ctab .r{display:grid;grid-template-columns:40px 1fr 54px 96px;gap:10px;align-items:center;padding:5px 0;border-bottom:1px solid rgba(128,128,128,.22)}
.hb-ctab .cp{display:flex;align-items:center;justify-content:center;height:26px;font-weight:600;font-size:11px}
.hb-ctab em{font-family:var(--mono);font-style:normal;font-size:11px;text-align:end;direction:ltr}
.hb-ctab i{font-family:var(--mono);font-style:normal;font-size:9px;letter-spacing:.05em;text-transform:uppercase;text-align:end}
/* the verdict and the guess marker take their colour from the page they are
   drawn on, which is the identity's ground rather than this document's. Set by
   the renderer, per block. See editor/render.js. */
.hb-faces{display:grid;gap:14px;width:100%;height:100%}
.hb-faces .fl{font-family:var(--mono);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;opacity:.55;margin:0}
.hb-atab{width:100%;height:100%;font-family:var(--mono);font-size:11.5px}
.hb-atab .r{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(128,128,128,.22)}
.hb-atab .total{font-weight:600;border-bottom:none}
.hb-atab em{font-style:normal;opacity:.6}
`;

function editorHtml(project, measured, files) {
  const bu = bundle(project, measured, files);
  const doc = starterDoc(bu);
  // The canvas is an application, and its chrome is the engine's own words. It
  // carries the language it is written in, like the documents beside it — and
  // that is asked of the canvas rather than of the project, because its words
  // are literals here and in app.js rather than strings in the dictionary. A
  // French project got a canvas declaring lang="fr" over Undo, Pages and Add a
  // block, which is the fault the two rounds before this one spent themselves
  // removing, in the one page nobody had audited. See src/strings.js.
  const L = require('../strings').resolve(project, 'canvas');
  // and the brand's own name carries the brand's, which is what makes both true
  const say = (k, v) => L.t(k, v);
  const own = (text) => (L.speaksBrand ? esc(text)
    : `<span lang="${esc(L.brandLang)}"${L.brandDir && L.brandDir !== L.dir
      ? ` dir="${esc(L.brandDir)}"` : ''}>${esc(text)}</span>`);
  return `<!doctype html><html lang="${esc(L.lang)}" dir="${esc(L.dir)}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(bu.brand)} · editor</title>
${fontLink(bu)}
<style>${CSS}</style></head><body>
<div class="app">
  <header class="bar">
    <h1 class="brand">${own(bu.brand)}</h1><span class="ver">${esc(bu.version)}</span>
    <button id="undo" title="${esc(say('cvUndoTitle'))}">${esc(say('cvUndo'))}</button>
    <button id="redo" title="${esc(say('cvRedoTitle'))}">${esc(say('cvRedo'))}</button>
    <span class="sp"></span>
    <label class="ver">${esc(say('cvSize'))} <select id="sheet-size"></select></label>
    <label class="ver">${esc(say('cvBleed'))} <select id="bleed"><option value="0">${esc(say('cvNone'))}</option><option value="3">3 mm</option><option value="5">5 mm</option></select></label>
    <label class="ver">${esc(say('cvGrid'))} <select id="grid"><option>4</option><option selected>8</option><option>16</option><option value="0">${esc(say('cvOff'))}</option></select></label>
    <span id="zoom"><span class="sr">${esc(say('cvZoom'))} </span>100%</span>
    <button id="open">${esc(say('cvOpen'))}</button>
    <button id="save">${esc(say('cvSaveJson'))}</button>
    <button id="publish">${esc(say('cvPublish'))}</button>
    <button id="reset">${esc(say('cvReset'))}</button>
  </header>
  <aside class="rail" aria-label="${esc(say('cvRail'))}">
    <h2 id="pages-h">${esc(say('cvPages'))}</h2><div id="pages" role="list" aria-labelledby="pages-h"></div>
    <div class="pgbtns"><button id="addpage">${esc(say('cvAddPage'))}</button><button id="delpage">${esc(say('cvDeletePage'))}</button></div>
    <label class="f pgsize"><span>${esc(say('cvThisPage'))}</span><select id="page-size"></select></label>
    <h2 id="insert-h">${esc(say('cvAddBlock'))}</h2><div id="insert" aria-labelledby="insert-h"></div>
    <div class="keys">
      <b>tab</b> ${esc(say('cvKeyNext'))} · <b>shift tab</b> ${esc(say('cvKeyBack'))}<br>
      <b>enter</b> ${esc(say('cvKeyAdd'))}<br>
      <b>drag</b> ${esc(say('cvKeyMove'))} · <b>alt</b> ${esc(say('cvKeyFree'))}<br>
      <b>shift click</b> ${esc(say('cvKeyMulti'))}<br>
      <b>double click</b> ${esc(say('cvKeyOr'))} <b>F2</b> ${esc(say('cvKeyEdit'))}<br>
      <b>arrows</b> ${esc(say('cvKeyNudge'))} · <b>shift</b> ×4<br>
      <b>cmd arrows</b> ${esc(say('cvKeyResize'))}<br>
      <b>cmd Z</b> ${esc(say('cvKeyUndo'))} · <b>cmd D</b> ${esc(say('cvKeyDuplicate'))}<br>
      <b>delete</b> ${esc(say('cvKeyRemove'))} · <b>esc</b> ${esc(say('cvKeyDeselect'))}<br>
      <b>drop a file</b> ${esc(say('cvKeySlot'))}
    </div>
  </aside>
  <main id="canvas" aria-label="${esc(say('cvSheet'))}"><div id="stage"><div id="sheet" role="group"></div><div id="trimline"></div><div id="overlay"></div></div><div id="notes" role="status" aria-live="polite"></div><span id="sheetname"></span></main>
  <aside class="side" aria-label="${esc(say('cvProperties'))}"><h2 id="props-h">${esc(say('cvProperties'))}</h2><div id="panel" aria-labelledby="props-h"></div></aside>
</div>
<input type="file" id="file" accept="application/json" hidden>
<input type="file" id="imgfile" accept="image/*" hidden>
<script>${read('../contrast.js')}</script>
<script>${read('../photography.js')}</script>
<script>${read('../print.js')}</script>
<script>${read('../surface.js')}</script>
<script>${read('model.js')}</script>
<script>${read('images.js')}</script>
<script>${read('render.js')}</script>
<script>${read('publish.js')}</script>
<script>window.HANDOVER_BUNDLE=${JSON.stringify(bu)};window.HANDOVER_DOC=${JSON.stringify(doc)};
window.HANDOVER_IMAGES=${JSON.stringify(bu.images || {})};</script>
<script>${read('app.js')}</script>
</body></html>`;
}

module.exports = { editorHtml, CSS };
