/* Does the treatment we compute match the treatment a browser paints?

   The photography rules are drawn with an SVG filter and a CSS gradient, and
   they are also computed in JavaScript so the editor can say whether the mark
   on top can be read before anyone looks. Those are two implementations of the
   same thing, and the second one is only worth having if it agrees with the
   first. So this renders through the real filter, reads the pixels back, and
   compares them with what src/photography.js said they would be.

   Kept out of `npm test` because it needs a browser.

     node test/treatment-check.mjs
     PW_PATH=/where/playwright/lives PW_CHROMIUM=/path/to/chrome node test/treatment-check.mjs
*/
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const PH = require('../src/photography');

let chromium;
try {
  const paths = [import.meta.dirname, process.cwd()].concat(process.env.PW_PATH ? [process.env.PW_PATH] : []);
  ({ chromium } = require(require.resolve('playwright', { paths })));
} catch {
  console.log('playwright is not installed, so nothing was rendered.'
    + ' Install it, or point PW_PATH at a node_modules that has it.');
  process.exit(0);
}

const bundle = { roles: { primary: { hex: '#0A2A33' }, ground: { hex: '#EFEDE4' }, accent: { hex: '#F2A007' } } };
const SWATCHES = [[255, 255, 255], [0, 0, 0], [128, 128, 128], [220, 60, 40], [40, 120, 200], [240, 235, 120]];
const CELL = 40;

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const page = await browser.newPage();
let failed = 0;

// read the middle pixel of each cell out of a screenshot, decoded in the page
const cells = async (shot, n) => page.evaluate(async ({ b64, n, cell }) => {
  const img = new Image();
  await new Promise((r) => { img.onload = r; img.src = 'data:image/png;base64,' + b64; });
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  c.getContext('2d').drawImage(img, 0, 0);
  const g = c.getContext('2d'), out = [];
  const k = img.width / (n * cell);
  for (let i = 0; i < n; i++) {
    const d = g.getImageData(Math.round((i + 0.5) * cell * k), Math.round(img.height / 2), 1, 1).data;
    out.push([d[0], d[1], d[2]]);
  }
  return out;
}, { b64: shot.toString('base64'), n, cell: CELL });

const report = (name, rows) => {
  const worst = Math.max(...rows.map((r) => r.off));
  const ok = worst <= 2;                    // rounding, not a difference in model
  if (!ok) failed++;
  console.log(`  ${ok ? 'ok   ' : 'FAIL '} ${name}  (worst channel off by ${worst})`);
  if (!ok) for (const r of rows) console.log(`        ${r.what}  browser ${r.browser}  computed ${r.computed}`);
};

// ---------------------------------------------------------------- the duotone
for (const c of [
  { name: 'duotone, full', rules: PH.rules({ duotone: { shadow: 'primary', highlight: 'ground' } }) },
  { name: 'duotone at 60%', rules: PH.rules({ duotone: { shadow: 'primary', highlight: 'ground', amount: 0.6 } }) },
  { name: 'duotone into the accent', rules: PH.rules({ duotone: { shadow: 'primary', highlight: 'accent' } }) },
]) {
  await page.setContent(`${PH.filter(c.rules, bundle, 'duo')}
    <canvas id="src" width="${SWATCHES.length}" height="1" hidden></canvas>
    <img id="out" style="filter:url(#duo);image-rendering:pixelated;display:block;
      width:${SWATCHES.length * CELL}px;height:${CELL}px">`);
  await page.evaluate(async (sw) => {
    const g = document.getElementById('src').getContext('2d');
    sw.forEach((s, i) => { g.fillStyle = `rgb(${s.join(',')})`; g.fillRect(i, 0, 1, 1); });
    const img = document.getElementById('out');
    await new Promise((r) => { img.onload = r; img.src = document.getElementById('src').toDataURL(); });
  }, SWATCHES);
  await page.waitForTimeout(120);
  const got = await cells(await page.locator('#out').screenshot(), SWATCHES.length);
  report(c.name, SWATCHES.map((s, i) => {
    const t = PH.treatPixel(c.rules, bundle, { r: s[0] / 255, g: s[1] / 255, b: s[2] / 255 });
    const w = [t.r, t.g, t.b].map((v) => Math.round(v * 255));
    return { what: `rgb(${s})`, browser: String(got[i]), computed: String(w),
      off: Math.max(...w.map((v, k) => Math.abs(v - got[i][k]))) };
  }));
}

// ----------------------------------------------------------------- the scrim
// The gradient is written by scrimStyle and read back by alphaAt. If those two
// drift, every number the editor reports about a mark on a photograph is wrong.
for (const dir of ['bottom', 'top', 'flat']) {
  const rules = PH.rules({ scrim: { colour: 'primary', opacity: 0.42, direction: dir } });
  const s = PH.scrimStyle(rules, bundle, undefined);
  const steps = 9;
  await page.setContent(`<div id="out" style="position:relative;width:${CELL}px;height:${steps * CELL}px;background:#FFFFFF">
    <div style="position:absolute;inset:0;background:${s.background}"></div></div>`);
  await page.waitForTimeout(120);
  const shot = await page.locator('#out').screenshot();
  const got = await page.evaluate(async ({ b64, steps, cell }) => {
    const img = new Image();
    await new Promise((r) => { img.onload = r; img.src = 'data:image/png;base64,' + b64; });
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const k = img.height / (steps * cell), out = [];
    for (let i = 0; i < steps; i++) {
      const d = g.getImageData(Math.round(img.width / 2), Math.round((i + 0.5) * cell * k), 1, 1).data;
      out.push([d[0], d[1], d[2]]);
    }
    return out;
  }, { b64: shot.toString('base64'), steps, cell: CELL });

  report(`scrim from the ${dir}`, got.map((px, i) => {
    const y = (i + 0.5) / steps;
    const a = PH.alphaAt(s, PH.gradientT(dir, { x: 0.5, y }));
    const w = PH.over({ r: 1, g: 1, b: 1 }, s.hex, a);
    const c = [w.r, w.g, w.b].map((v) => Math.round(v * 255));
    return { what: `y ${y.toFixed(2)} (alpha ${a.toFixed(3)})`, browser: String(px), computed: String(c),
      off: Math.max(...c.map((v, k) => Math.abs(v - px[k]))) };
  }));
}

await browser.close();
console.log(failed ? `\n${failed} failed\n` : '\nwhat we compute is what the browser paints\n');
process.exit(failed ? 1 : 0);
