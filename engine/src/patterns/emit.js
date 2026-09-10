/* Assembling one self-contained pattern studio.

   Same discipline as src/editor/emit.js: no server, no build step, no network.
   Every module is inlined, the bundle is a literal, and the file opens from a
   USB stick in five years.

   What travels is the recipe rather than the pictures — the measurements taken
   off the mark, what the engine chose and why, the parameters of every tile it
   wrote, and the identity's colours. The generators are the same files the
   build ran, so the studio cannot draw a pattern the engine would not. */
'use strict';
const fs = require('fs');
const path = require('path');
const PE = require('./index');
const markRead = require('./mark');

const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const CSS = `
:root{--bg:#141618;--pane:#1B1E20;--line:#2A2E31;--ink:#ECEEF0;--dim:#9199A0;--sel:#3B82F6;--warn:#E8A33D;
--ui:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;--mono:ui-monospace,"SF Mono",Menlo,monospace}
*{box-sizing:border-box}
html,body{height:100%}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--ui);font-size:13px;overflow:hidden}
button,input,select{font:inherit;color:inherit}
:focus-visible{outline:2px solid var(--sel);outline-offset:2px}
.sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.app{display:grid;grid-template-columns:264px 1fr 300px;grid-template-rows:44px 1fr 132px;height:100%}
.bar{grid-column:1/-1;display:flex;align-items:center;gap:10px;padding:0 14px;background:var(--pane);border-bottom:1px solid var(--line)}
.bar h1{font-size:13px;margin:0;font-weight:600}
.ver{color:var(--dim);font-size:11px}
.sp{flex:1}
.rail,.side{background:var(--pane);overflow-y:auto;padding:14px}
.rail{border-right:1px solid var(--line)}
.side{border-left:1px solid var(--line)}
h2{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);margin:22px 0 8px;font-weight:600}
h2:first-child{margin-top:0}
h2+*{margin-bottom:6px}
.chips{display:flex;flex-wrap:wrap;gap:4px}
.chip{background:#23272A;border:1px solid var(--line);border-radius:3px;padding:4px 8px;font-size:11px;cursor:pointer}
.chip:hover{border-color:#3B4145}
.chip.on{background:var(--sel);border-color:var(--sel);color:#fff}
.ctl{margin-bottom:14px}
.ctl .k{display:flex;justify-content:space-between;font-size:11px;color:var(--dim);margin-bottom:5px}
.ctl .k .v{color:var(--ink);font-variant-numeric:tabular-nums}
.ctl input[type=range]{width:100%;accent-color:var(--sel)}
.seedrow{display:flex;gap:6px}
.seed{width:72px;background:#23272A;border:1px solid var(--line);border-radius:3px;padding:4px 6px}
.btn{flex:1;background:#23272A;border:1px solid var(--line);border-radius:3px;padding:4px 8px;cursor:pointer;font-size:11px}
.btn:hover{border-color:#3B4145}
.btn:disabled{opacity:.4;cursor:not-allowed}
#stage{position:relative;overflow:hidden;background:#0E1012}
#preview{position:absolute;inset:0}
#preview svg{width:100%;height:100%}
#one{width:100%;border:1px solid var(--line);border-radius:3px;overflow:hidden;background:#0E1012}
.note{font-size:11px;line-height:1.5;color:var(--dim);margin:10px 0 0}
#one+p{margin-top:12px}
.note.over{color:var(--warn)}
#why{font-size:11px;line-height:1.55;color:var(--ink);margin:0 0 4px}
#code{font-family:var(--mono);font-size:10px;line-height:1.5;white-space:pre;background:#0E1012;border:1px solid var(--line);
border-radius:3px;padding:8px;overflow:auto;max-height:160px;color:var(--dim);margin:0}
.row{display:flex;gap:6px;margin-top:8px}
.sw{display:inline-block;width:20px;height:20px;border-radius:3px;border:1px solid var(--line);margin-right:4px}
.bottom{grid-column:1/-1;background:var(--pane);border-top:1px solid var(--line);padding:10px 14px;overflow-x:auto;white-space:nowrap}
.keptcell{position:relative;display:inline-block;width:86px;height:86px;margin-right:8px;vertical-align:top}
.keptone{width:86px;height:86px;padding:0;border:1px solid var(--line);border-radius:3px;overflow:hidden;cursor:pointer;background:none}
.keptone:hover{border-color:var(--sel)}
.keptcell .x{position:absolute;top:-6px;right:-6px;width:18px;height:18px;line-height:1;border-radius:9px;border:1px solid var(--line);
background:#23272A;cursor:pointer;padding:0;font-size:12px}
.quiet{color:var(--dim);font-size:11px}
#said{color:var(--dim);font-size:11px;min-width:160px;text-align:right}
label.px{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--dim)}
.tiny{font-size:11px;color:var(--dim);margin:6px 0 0;line-height:1.5}
label.px input{width:72px;background:#23272A;border:1px solid var(--line);border-radius:3px;padding:4px 6px}
@media (max-width:1100px){.app{grid-template-columns:230px 1fr}.side{grid-column:1/-1;border-left:0;border-top:1px solid var(--line)}}
`;

// Everything the studio needs, and nothing it does not. No SVG source, no
// document, no fonts — a pattern is arithmetic and a palette.
function bundle(project, measured, made, chose, tile) {
  const naming = require('../naming');
  const mark = markRead.read(
    (project.assets[project.master || (project.assets.mark ? 'mark' : 'wordmark')] || {}).source,
    measured, project.rules);
  return {
    brand: project.brand,
    slug: naming.slug(project.brand),
    version: project.version || '',
    tile: tile || require('../system').patternRules((project.system || {}).pattern).tile,
    measured: mark,
    chose: chose || PE.suits(mark),
    minStrokePx: project.rules.minStrokePx,
    minStrokeMm: project.rules.minStrokeMm,
    colours: project.tokens.colour || {},
    colourways: (project.rules.colourways || []).map((c) => ({ name: c.name, on: c.on })),
    made: (made || []).map((m) => ({ generator: m.generator, colourway: m.colourway, params: m.params })),
  };
}

function studioHtml(project, measured, made, chose, tile) {
  const bu = bundle(project, measured, made, chose, tile);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(bu.brand)} · pattern studio</title>
<style>${CSS}</style></head><body>
<div class="app">
  <header class="bar">
    <h1>${esc(bu.brand)}</h1><span class="ver">pattern studio · ${esc(bu.version)}</span>
    <span class="sp"></span>
    <label class="px">Tiles across <input id="zoom" type="range" min="60" max="400" step="10" value="120"></label>
    <span id="said" role="status" aria-live="polite"></span>
  </header>

  <aside class="rail" aria-label="Controls">
    <h2 id="gens-h">Pattern</h2><div class="chips" id="gens" aria-labelledby="gens-h"></div>
    <h2 id="ctl-h">Its controls</h2><div id="controls" aria-labelledby="ctl-h"></div>
    <h2 id="ways-h">Colourway</h2><div class="chips" id="ways" aria-labelledby="ways-h"></div>
    <div id="swatches" aria-hidden="true"></div>
    <div class="row"><button class="btn" id="revert">Back to what the engine chose</button></div>
  </aside>

  <main id="stage" aria-label="The pattern, repeating"><div id="preview"></div></main>

  <aside class="side" aria-label="This tile">
    <h2 id="one-h">One tile</h2><div id="one" aria-labelledby="one-h"></div>
    <p id="why"></p>
    <p id="holds" class="note"></p>
    <p id="kind" class="note"></p>
    <h2>Take it away</h2>
    <div class="row"><button class="btn" id="svg">SVG</button><button class="btn" id="png">PNG</button></div>
    <div class="row"><label class="px">at <input id="px" type="number" value="2400" min="200" max="8000" step="100"> px</label></div>
    <div class="row"><button class="btn" id="keepit">Keep this one</button></div>
    <h2>Its parameters</h2>
    <pre id="code"></pre>
    <div class="row"><button class="btn" id="copy">Copy them</button></div>
    <p class="tiny">Paste this into project.json and every rebuild returns this pattern.</p>
  </aside>

  <footer class="bottom" aria-label="Kept patterns"><div id="kept"></div></footer>
</div>
<script>${read('../contrast.js')}</script>
<script>${read('rand.js')}</script>
<script>${read('noise.js')}</script>
<script>${read('surface.js')}</script>
<script>${read('palette.js')}</script>
<script>${read('generators/weave.js')}</script>
<script>${read('generators/zigzag.js')}</script>
<script>${read('generators/field.js')}</script>
<script>${read('generators/thread.js')}</script>
<script>${read('generators/terrace.js')}</script>
<script>${read('index.js')}</script>
<script>window.PATTERN_BUNDLE=${JSON.stringify(bu)};</script>
<script>${read('studio.js')}</script>
</body></html>`;
}

module.exports = { studioHtml, bundle, CSS };
