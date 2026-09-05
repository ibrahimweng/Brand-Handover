/* Does the printed piece match what the canvas showed?

   There are now two emitters. The canvas edits real DOM and publishes HTML,
   which is the whole architecture. The Typst path exists because a piece going
   to a press has to be in ink, and Typst paints an embedded SVG in RGB, so the
   mark is redrawn from its own path data instead of embedded.

   Two implementations of one drawing is exactly the drift this project has
   spent its whole length designing against, so it gets a check rather than an
   assurance. Three things are compared here:

     1. the path translation, against the SVG renderer, shape for shape
     2. the printed page, against the published page, area by area
     3. the colour space of the result, which is the reason any of it exists

   Kept out of `npm test` because it needs a browser and a typst binary.

     node test/typst-check.mjs
     PW_PATH=/node_modules PW_CHROMIUM=/chrome TYPST=/typst FONTS=/fonts \
       node test/typst-check.mjs
*/
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const paths = require('../src/paths');
const typst = require('../src/typst');
const M = require('../src/editor/model');
const { publish } = require('../src/editor/publish');
const projectLoader = require('../src/project');
const { measure, buildVariant } = require('../src/variants');
const { bundle } = require('../src/editor/bundle');
const { Resvg } = require('@resvg/resvg-js');

// The page comparison needs a browser and a typst binary, so it runs on one
// project; the path translation needs neither, so it runs on all of them. A
// check pinned to one fixture tests that fixture: Kvist's printed piece carried
// a clipping rectangle for two rounds behind a check that only knew Meridian.
const PROJECTS = fs.readdirSync(path.join(import.meta.dirname, '..', 'projects'))
  .filter((d) => fs.existsSync(path.join(import.meta.dirname, '..', 'projects', d, 'project.json')))
  .sort();
const load = (name) => projectLoader.load(path.join(import.meta.dirname, '..', 'projects', name, 'project.json'));
const project = load(process.env.PROJECT || 'meridian');
const bu = bundle(project, measure(project), []);
let failed = 0;
const report = (ok, name, detail) => {
  if (!ok) failed++;
  console.log(`  ${ok ? 'ok   ' : 'FAIL '} ${name}${detail ? `\n        ${detail}` : ''}`);
};

// ---------------------------------------------- 1. the path translation
// Every path in the artwork, said in move/line/cubic, rendered beside the
// original. A pixel that is solid in one and empty in the other is a shape
// error; everything else is the edge of a curve being antialiased.
console.log('\nthe path translation');
const everyAsset = [];
for (const name of PROJECTS) {
  const p = load(name);
  for (const which of ['mark', 'wordmark']) {
    if (p.assets[which]) everyAsset.push([`${name} ${which}`, p.assets[which].source]);
  }
}
for (const [name, src] of everyAsset) {
  const ds = [...src.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]);
  let redrawn = src;
  for (const d of ds) redrawn = redrawn.replace(` d="${d}"`, ` d="${paths.toPathData(paths.parse(d))}"`);
  let structural = 0, differing = 0, worst = 0, total = 0;
  for (const w of [400, 1600]) {
    const a = new Resvg(src, { fitTo: { mode: 'width', value: w } }).render().pixels;
    const b = new Resvg(redrawn, { fitTo: { mode: 'width', value: w } }).render().pixels;
    total += a.length / 4;
    for (let i = 0; i < a.length; i += 4) {
      let d = 0;
      for (let c = 0; c < 4; c++) d = Math.max(d, Math.abs(a[i + c] - b[i + c]));
      if (!d) continue;
      differing++; worst = Math.max(worst, d);
      if ((a[i + 3] > 250 && b[i + 3] < 5) || (b[i + 3] > 250 && a[i + 3] < 5)) structural++;
    }
  }
  report(structural === 0, `${name} redraws to the same shape`,
    `${ds.length} path(s), ${differing} of ${total} pixels differ at an edge, worst ${worst}, ${structural} structural`);
}

// ---------------------------------------------- 2. every mark, through Typst
// The check above compares an SVG against an SVG: it exercises the path parser
// and never goes near Typst. So the only source this repo had ever asked Typst
// to compile was Meridian's page, and a mark whose ring is a gradient produced
// `fill: rgb("url(#a)")` — which Typst refuses outright — with nothing to
// notice it. Compile every mark, in every colourway, and look at the result.
const bin = process.env.TYPST || which('typst');
const fonts = process.env.FONTS || null;
let chromium = null;
try {
  const p = [import.meta.dirname, process.cwd()].concat(process.env.PW_PATH ? [process.env.PW_PATH] : []);
  ({ chromium } = require(require.resolve('playwright', { paths: p })));
} catch { /* reported below */ }

function which(name) {
  for (const dir of String(process.env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    try { fs.accessSync(path.join(dir, name), fs.constants.X_OK); return path.join(dir, name); } catch (_) { /* next */ }
  }
  return null;
}

if (bin) {
  console.log('\nevery mark, compiled');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-marks-'));
  for (const name of PROJECTS) {
    const p = load(name);
    const meas = measure(p);
    const b = bundle(p, meas, []);
    let worstNote = '';
    let ok = true;
    for (const cw of p.rules.colourways) {
      const v = buildVariant({ markSrc: p.assets.mark.source,
        wordmarkSrc: p.assets.wordmark && p.assets.wordmark.source,
        lockup: 'mark', colourway: cw, rules: p.rules, measured: meas });
      const seen = new Set(); seen.unsayable = new Set();
      const body = typst.artwork(v.svg, { x: 0, y: 0, w: 160, h: 160 }, b, seen);
      const src = `#set page(width: 160pt, height: 160pt, margin: 0pt, fill: white)\n${body}\n`;
      const f = path.join(dir, `${name}-${cw.name}.typ`);
      fs.writeFileSync(f, src);
      const args = ['compile'];
      if (fonts) args.push('--font-path', fonts);
      args.push('--format', 'png', '--ppi', '72', f, path.join(dir, `${name}-${cw.name}.png`));
      const r = spawnSync(bin, args, { encoding: 'utf8' });
      if (r.status !== 0) {
        ok = false;
        worstNote = `${cw.name}: ${(r.stderr || '').trim().split('\n').find((l) => /error/.test(l)) || 'did not compile'}`;
        break;
      }
      if (seen.unsayable.size) {
        // it compiles, and the shape goes out black: worse than not compiling,
        // because nothing stops it reaching a press
        ok = false;
        worstNote = `${cw.name}: ${[...seen.unsayable].join(', ')} could not be said, so it was drawn in black`;
        break;
      }
    }
    report(ok, `${name} compiles in every colourway`,
      worstNote || `${p.rules.colourways.length} colourway(s), nothing left unsaid`);
  }
  fs.rmSync(dir, { recursive: true, force: true });
} else {
  console.log('\nevery mark, compiled\n  skipped: no typst binary (set TYPST)');
}

if (!bin || !chromium) {
  console.log(`\nthe printed page against the published page\n  skipped: `
    + `${!bin ? 'no typst binary (set TYPST) ' : ''}${!chromium ? 'no playwright (set PW_PATH)' : ''}`);
} else {
  console.log('\nthe printed page against the published page');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-typst-'));

  // a piece made of the things a printed piece is made of, and no bleed, so
  // the two pages are the same rectangle
  const doc = M.emptyDoc('Meridian');
  M.ops.setPageSize(doc, null, 'a4');
  const sheet = M.sheet('a4'), pg = doc.pages[0];
  pg.blocks.push(M.makeBlock('fill', { x: 0, y: 0, w: sheet.w, h: sheet.h, props: { colour: 'primary' } }, sheet));
  pg.blocks.push(M.makeBlock('lockup', { x: 70, y: 300, w: 654, h: 180,
    props: { lockup: 'horizontal', colourway: 'ground', on: 'none' } }, sheet));
  pg.blocks.push(M.makeBlock('fill', { x: 70, y: 560, w: 300, h: 8, props: { colour: 'accent' } }, sheet));
  pg.blocks.push(M.makeBlock('mark', { x: 560, y: 800, w: 164, h: 164,
    props: { colourway: 'accent', on: 'none' } }, sheet));

  const out = typst.emit(doc, bu, {});
  fs.writeFileSync(path.join(dir, 'p.typ'), out.source);
  const args = ['compile'];
  if (fonts) args.push('--font-path', fonts);
  args.push('--format', 'png', '--ppi', '72', path.join(dir, 'p.typ'), path.join(dir, 'typst.png'));
  const r = spawnSync(bin, args, { encoding: 'utf8' });
  if (r.status !== 0) {
    report(false, 'typst compiled the piece', (r.stderr || '').trim().split('\n')[0]);
  } else {
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    const page = await browser.newPage({ viewport: { width: 900, height: 1300 } });
    fs.writeFileSync(path.join(dir, 'p.html'), publish(doc, bu, { captions: false, builtAt: 'fixed' }));
    await page.goto('file://' + path.join(dir, 'p.html'));
    await page.waitForTimeout(500);
    await page.locator('.hp-page').first().screenshot({ path: path.join(dir, 'html.png') });

    // Both rasterised the same size and compared cell by cell.
    //
    // Not on absolute brightness: a declared CMYK build and the hex it sits
    // beside are different colours on purpose, so a page filled with one is
    // expected to preview a few values off. Each cell is compared against its
    // own image's mean instead, which cancels that offset and leaves what is
    // actually being asked — is the same thing in the same place.
    const cells = await page.evaluate(async ({ a, b }) => {
      const load = async (b64) => {
        const im = new Image();
        await new Promise((res) => { im.onload = res; im.src = 'data:image/png;base64,' + b64; });
        const c = document.createElement('canvas');
        c.width = 240; c.height = Math.round(240 * im.height / im.width);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        return c.getContext('2d').getImageData(0, 0, c.width, c.height);
      };
      const A = await load(a), B = await load(b);
      if (A.width !== B.width || Math.abs(A.height - B.height) > 2) return { mismatch: [A.width, A.height, B.width, B.height] };
      const G = 24;
      const cw = Math.floor(A.width / G), ch = Math.floor(Math.min(A.height, B.height) / G);
      const cellsOf = (img) => {
        const v = [];
        for (let gy = 0; gy < G; gy++) {
          for (let gx = 0; gx < G; gx++) {
            let s = 0, n = 0;
            for (let y = gy * ch; y < (gy + 1) * ch; y++) {
              for (let x = gx * cw; x < (gx + 1) * cw; x++) {
                const i = (y * img.width + x) * 4;
                s += (img.data[i] + img.data[i + 1] + img.data[i + 2]) / 3;
                n++;
              }
            }
            v.push(s / n);
          }
        }
        return v;
      };
      const a2 = cellsOf(A), b2 = cellsOf(B);
      const mean = (v) => v.reduce((x, y) => x + y, 0) / v.length;
      const ma = mean(a2), mb = mean(b2);
      return { diffs: a2.map((v, i) => Math.abs((v - ma) - (b2[i] - mb))), offset: Math.abs(ma - mb) };
    }, { a: fs.readFileSync(path.join(dir, 'html.png')).toString('base64'),
      b: fs.readFileSync(path.join(dir, 'typst.png')).toString('base64') });
    await browser.close();

    if (cells.mismatch) {
      report(false, 'the two pages are the same shape', `html ${cells.mismatch.slice(0, 2)}, typst ${cells.mismatch.slice(2)}`);
    } else {
      const mean = cells.diffs.reduce((a, b) => a + b, 0) / cells.diffs.length;
      const worst = Math.max(...cells.diffs);
      report(mean < 3 && worst < 40, 'the printed page matches the published page',
        `${cells.diffs.length} areas, mean ${mean.toFixed(2)} of 255, worst ${worst.toFixed(1)}`
        + `  (the whole page previews ${cells.offset.toFixed(1)} off, which is the ink build`
        + ` differing from the screen colour, as it should)`);
    }
  }

  // ------------------------------------------- 3. the colour space
  const pdfArgs = ['compile'];
  if (fonts) pdfArgs.push('--font-path', fonts);
  pdfArgs.push(path.join(dir, 'p.typ'), path.join(dir, 'p.pdf'));
  spawnSync(bin, pdfArgs, { encoding: 'utf8' });
  if (fs.existsSync(path.join(dir, 'p.pdf'))) {
    const zlib = await import('node:zlib');
    const s = fs.readFileSync(path.join(dir, 'p.pdf')).toString('latin1');
    const ops = [];
    const re = /stream\r?\n/g;
    let m;
    while ((m = re.exec(s))) {
      const start = m.index + m[0].length, end = s.indexOf('endstream', start);
      if (end < 0) continue;
      let text;
      try { text = zlib.inflateSync(Buffer.from(s.slice(start, end), 'latin1')).toString('latin1'); } catch { continue; }
      for (const q of text.matchAll(/[\d.]+ [\d.]+ [\d.]+ [\d.]+ [kK]|[\d.]+ [\d.]+ [\d.]+ (?:rg|RG|scn|SCN)/g)) ops.push(q[0]);
    }
    const rgb = [...new Set(ops.filter((o) => /(rg|RG|scn|SCN)$/.test(o)))];
    report(ops.length > 0 && rgb.length === 0, 'the printed piece is entirely in ink',
      `${[...new Set(ops)].length} distinct colours, ${rgb.length} of them screen colours${rgb.length ? ': ' + rgb.join(', ') : ''}`);
  }
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log(failed ? `\n${failed} failed\n` : '\nthe piece on paper is the piece on the canvas\n');
process.exit(failed ? 1 : 0);
