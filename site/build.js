'use strict';
// The site is the packages. Every identity in engine/projects is built here at
// deploy time and served whole — the manual, the deck, the published cover, the
// canvas and the zip — so what is on the web is what the engine writes, not a
// screenshot of what it wrote once.
//
// Nothing generated is committed. The repository holds sixteen master files and
// sixteen project files; this script turns them into the site.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const ENGINE = path.join(ROOT, 'engine');
const OUT = path.join(__dirname, 'out');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// What each identity is for, read out of engine/README.md rather than typed
// again here. The list of fixtures and the axis each one tests is maintained in
// one place; a second copy would be wrong within a round. The order there is
// the order the rounds happened in, which is the order to read them in, so the
// page takes that too rather than falling back on the alphabet.
function axes() {
  const md = fs.readFileSync(path.join(ENGINE, 'README.md'), 'utf8');
  const out = new Map();
  for (const m of md.matchAll(/^[ \t]*projects\/([a-z0-9-]+)\/[ \t]+([^\n]+?)[ \t]*$/gm)) out.set(m[1], m[2]);
  return out;
}

// Every project directory, in the README's order. One that is not named there
// still gets built and still gets a card — an identity missing from the page
// would be worse than one with no line under its name.
function projects(ax) {
  const dir = path.join(ENGINE, 'projects');
  const all = fs.readdirSync(dir).filter((n) => fs.existsSync(path.join(dir, n, 'project.json')));
  const order = [...ax.keys()].filter((n) => all.includes(n));
  return order.concat(all.filter((n) => !order.includes(n)).sort());
}

function buildOne(name) {
  const outDir = path.join(OUT, name);
  execFileSync(process.execPath, ['src/cli.js', 'build', `projects/${name}/project.json`, '-o', outDir],
    { cwd: ENGINE, stdio: 'inherit' });
  const files = [];
  (function walk(d, rel) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(d, e.name), rel ? `${rel}/${e.name}` : e.name);
      else files.push({ path: rel ? `${rel}/${e.name}` : e.name, bytes: fs.statSync(path.join(d, e.name)).size });
    }
  }(outDir, ''));
  const brand = JSON.parse(fs.readFileSync(path.join(outDir, 'brand.json'), 'utf8'));
  return { name, files, brand, zip: (files.find((f) => f.path.endsWith('.zip')) || {}).path || null };
}

// A card per identity: what it is, what it was built to break, and the four
// things you can open. Sizes are measured off the files, not stated.
function card(r, axis) {
  const kb = (n) => (n >= 1024 * 1000 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);
  const total = r.files.reduce((n, f) => n + f.bytes, 0);
  const links = [
    ['guidelines.html', 'Manual'],
    ['deck.html', 'Deck'],
    ['published.html', 'Cover'],
    ['editor.html', 'Canvas'],
  ].filter(([f]) => r.files.some((x) => x.path === f))
    .map(([f, label]) => `<a href="${r.name}/${f}">${label}</a>`);
  if (r.zip) links.push(`<a href="${r.name}/${esc(r.zip)}">Package <span class="sz">${kb(r.files.find((f) => f.path === r.zip).bytes)}</span></a>`);
  return `<article class="id">
      <h2>${esc(r.brand.brand || r.name)}</h2>
      <p class="axis">${esc(axis || 'no line for this one in engine/README.md')}</p>
      <nav>${links.join('')}</nav>
      <p class="count">${r.files.length} files · ${kb(total)} · from one master file</p>
    </article>`;
}

function index(rows, ax) {
  const files = rows.reduce((n, r) => n + r.files.length, 0);
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Brand Handover — sixteen identities, generated</title>
<meta name="description" content="One master SVG per identity, and everything else derived from it: the manual, the deck, the canvas and the package.">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=Literata:wght@400;500&display=swap">
<style>
:root{--ink:#16191c;--dim:#5b666e;--line:#e2e6e9;--bg:#fbfbf9;--link:#1E5F8C}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
  font:400 16px/1.6 Literata,Georgia,"Times New Roman",serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:74ch;margin:0 auto;padding:8vmin 24px 14vmin}
h1{font:700 clamp(28px,5vw,44px)/1.15 Archivo,system-ui,sans-serif;letter-spacing:-.02em;margin:0 0 .5em}
.lede{font-size:clamp(17px,2.2vw,20px);color:var(--dim);margin:0 0 1.4em;max-width:56ch}
.meta{font:500 13px/1.5 Archivo,system-ui,sans-serif;color:var(--dim);
  border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:14px 0;margin:0 0 3em}
h2{font:600 20px/1.25 Archivo,system-ui,sans-serif;margin:0 0 .25em}
.id{border-top:1px solid var(--line);padding:26px 0}
.id:first-of-type{border-top:0}
.axis{margin:0 0 .9em;color:var(--dim)}
nav{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 .7em}
nav a{font:500 13px/1 Archivo,system-ui,sans-serif;text-decoration:none;color:var(--link);
  border:1px solid var(--line);border-radius:3px;padding:8px 12px;background:#fff;
  display:inline-flex;align-items:center;gap:6px}
nav a:hover{border-color:var(--link)}
.sz{color:var(--dim);font-weight:400}
.count{margin:0;font:400 13px/1.4 Archivo,system-ui,sans-serif;color:var(--dim)}
footer{border-top:1px solid var(--line);margin-top:3em;padding-top:1.6em;color:var(--dim);font-size:14px}
footer a{color:var(--link)}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.9em}
@media (prefers-color-scheme:dark){
  :root{--ink:#e8eaec;--dim:#96a1a9;--line:#2a3036;--bg:#111417;--link:#7fc2ea}
  nav a{background:#171b1f}
}
</style></head><body><div class="wrap">
<h1>Sixteen identities, and none of this was drawn</h1>
<p class="lede">Each one starts as a single master SVG and a project file. Everything below —
every lockup in every colourway, the icons, the brand manual, the deck, the canvas you can
edit in the browser, and the zip a client is handed — was derived from those two files when
this page was deployed.</p>
<p class="meta">${rows.length} identities · ${files} generated files · built ${new Date().toISOString().slice(0, 10)}</p>
${rows.map((r) => card(r, ax.get(r.name))).join('\n')}
<footer>
<p><b>Canvas</b> is the editor: drag blocks, drop a photograph on an image slot, undo with
⌘Z. Blocks come in three kinds — yours, drawn by the system, and set once in the project
file — and the system-drawn ones refuse edits that would make them lie.</p>
<p>Thicken a stroke in any <code>mark.svg</code>, redeploy, and the clear space, the minimum
size, the icon grid and every diagram in the manual and the deck move with it, while a block
somebody nudged stays where they put it.</p>
<p><a href="https://github.com/ibrahimweng/Brand-Handover">Source on GitHub</a></p>
</footer>
</div></body></html>
`;
}

function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const ax = axes();
  const rows = [];
  for (const name of projects(ax)) {
    process.stdout.write(`\n— ${name}\n`);
    rows.push(buildOne(name));
  }
  fs.writeFileSync(path.join(OUT, 'index.html'), index(rows, ax));
  const files = rows.reduce((n, r) => n + r.files.length, 0);
  console.log(`\nsite: ${rows.length} identities, ${files} files, into ${path.relative(ROOT, OUT)}`);
}

main();
