/* Does the vector file draw the same picture as the screen?

   src/patterns/surface.js claims a generator can be written once and drawn
   through either surface — a real 2-D canvas in the studio, a recorder that
   emits SVG in the build — and that the two cannot drift, because there is only
   one drawing function. That is a claim about two different renderers agreeing,
   and the only way to know is to run both and compare the pixels.

   So: one paint function using nothing outside the contract, drawn on a real
   canvas in Chromium and recorded to SVG in Node, both rasterised at the same
   size, and the difference measured. Not "it looks the same" — the share of
   pixels that differ, and by how much.

   A perfect match is not the bar and never could be: two rasterisers antialias
   edges differently, and a diagonal edge is a row of pixels they will disagree
   about by a few counts each. What must not happen is a shape in one and not
   the other, or a shape in a different place. That shows up as whole regions
   differing, which is what the numbers below separate out.

     PW_PATH=/where/playwright/lives node test/surface-check.mjs
     PW_PATH=... PW_CHROMIUM=/path/to/chrome node test/surface-check.mjs
*/
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

let chromium;
try {
  const paths = [import.meta.dirname, process.cwd()].concat(process.env.PW_PATH ? [process.env.PW_PATH] : []);
  ({ chromium } = require(require.resolve('playwright', { paths })));
} catch {
  console.log('playwright is not installed, so nothing was measured.'
    + ' Install it, or point PW_PATH at a node_modules that has it.');
  process.exit(0);
}
const SURF = require('../src/patterns/surface');
const NOISE = require('../src/patterns/noise');
const RAND = require('../src/patterns/rand');
const { Resvg } = require('@resvg/resvg-js');

const W = 240, H = 240, SCALE = 2;

// One drawing, using nothing outside the contract. Written as a string so the
// identical text runs in Node and in the browser — two copies would be two
// things to keep in step, which is the fault this whole module exists to
// prevent.
const PAINT = `function paint(s, W, H, NOISE, RAND) {
  const U = Math.sqrt(W * H);
  s.fillStyle = '#F1EDE4'; s.fillRect(0, 0, W, H);

  // Six panels, one per part of the contract, each a sixth of the picture.
  //
  // An earlier version of this drew everything at once, small, and mostly at
  // the identity transform. It passed with the stroke scaling removed, with the
  // arc join removed, and with the transforms composed the other way round —
  // three of the four things it was written to check. A fault in one shape is
  // nothing against a canvas that is otherwise right, and a fault in code the
  // drawing never reaches is nothing at all. So: panels, and every one of them
  // under a transform, because the transform is where the two surfaces do
  // different arithmetic. The recorder bakes the matrix into the coordinates it
  // writes; the canvas keeps it and applies it at raster time.
  const pw = W / 3, ph = H / 2;
  const panel = (i, fn) => {
    s.save();
    s.translate((i % 3) * pw, Math.floor(i / 3) * ph);
    s.beginPath(); s.rect(1, 1, pw - 2, ph - 2); s.clip();
    fn(pw, ph);
    s.restore();
  };

  // 1 — flat rectangles off the noise, which is what a grid generator makes
  panel(0, (w, h) => {
    const cells = 14, cw = w / cells, ch = h / cells;
    for (let gy = 0; gy < cells; gy++) {
      for (let gx = 0; gx < cells; gx++) {
        const v = NOISE.fbm2(gx / cells * 5, gy / cells * 5, 5, 5, 3, 12);
        if (v < 0.45) continue;
        s.fillStyle = v > 0.56 ? '#0E2A8C' : '#FF87C3';
        s.fillRect(gx * cw, gy * ch, cw, ch);
      }
    }
  });

  // 2 — rectangles under a turn. The recorder cannot emit a <rect> here and
  // writes the four transformed corners instead.
  panel(1, (w, h) => {
    s.save(); s.translate(w / 2, h / 2); s.rotate(-0.55);
    s.fillStyle = '#8E9A24';
    for (let i = 0; i < 7; i++) s.fillRect(-w * 0.36 + i * w * 0.1, -h * 0.3 + i * h * 0.06, w * 0.07, h * 0.5);
    s.restore();
  });

  // 3 — a stroke under a scale. The recorder has baked the matrix into the
  // coordinates, so it has to scale the width by hand; a canvas does not.
  panel(2, (w, h) => {
    s.save(); s.translate(w / 2, h / 2); s.scale(3, 3);
    s.strokeStyle = '#1B4FA0'; s.lineWidth = w * 0.03; s.lineJoin = 'round'; s.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      s.beginPath();
      s.moveTo(-w * 0.14, -h * 0.13 + i * h * 0.075);
      s.lineTo(0, -h * 0.07 + i * h * 0.075);
      s.lineTo(w * 0.14, -h * 0.13 + i * h * 0.075);
      s.stroke();
    }
    s.restore();
  });

  // 4 — arcs joined into a path that is already open, which is how every
  // rounded corner is drawn. An arc that jumps instead of joining leaves the
  // shape open and the fill floods somewhere else.
  panel(3, (w, h) => {
    s.save(); s.translate(w / 2, h / 2);
    s.fillStyle = '#E23B26';
    const r = h * 0.17, x = w * 0.22;
    s.beginPath();
    s.moveTo(-x, -r);
    s.lineTo(x, -r);
    s.arc(x, 0, r, -Math.PI / 2, Math.PI / 2);
    s.lineTo(-x, r);
    s.arc(-x, 0, r, Math.PI / 2, Math.PI * 1.5);
    s.closePath(); s.fill();
    s.strokeStyle = '#101010'; s.lineWidth = h * 0.014;
    s.beginPath();
    s.moveTo(-x, -r * 2.1);
    s.arc(0, -r * 2.1, x, Math.PI, 0);
    s.lineTo(x, -r * 2.1 + h * 0.06);
    s.stroke();
    s.restore();
  });

  // 5 — transforms inside transforms, where the order they compose in decides
  // where everything lands. Composed the other way round this panel is empty.
  panel(4, (w, h) => {
    s.save();
    s.translate(w / 2, h / 2); s.rotate(0.35);
    for (let i = 0; i < 5; i++) {
      s.save();
      s.rotate(i * 0.42); s.translate(w * 0.22, 0); s.rotate(-i * 0.3); s.scale(0.8, 1.4);
      s.fillStyle = ['#1B4FA0', '#FF5B1E', '#8E9A24', '#0E7C4A', '#F2C33C'][i];
      s.beginPath();
      s.moveTo(-w * 0.09, -h * 0.09); s.quadraticCurveTo(0, -h * 0.2, w * 0.09, -h * 0.09);
      s.bezierCurveTo(w * 0.06, h * 0.07, -w * 0.06, h * 0.07, -w * 0.09, -h * 0.09);
      s.closePath(); s.fill();
      s.restore();
    }
    s.restore();
  });

  // 6 — a clip that something is drawn through, under a turn of its own
  panel(5, (w, h) => {
    s.save();
    s.translate(w / 2, h / 2); s.rotate(0.3);
    s.beginPath(); s.arc(0, 0, h * 0.36, 0, Math.PI * 2); s.clip();
    s.fillStyle = '#0E7C4A'; s.fillRect(-w, -h, w * 2, h * 2);
    s.strokeStyle = '#F1EDE4'; s.lineWidth = h * 0.05; s.lineCap = 'butt';
    for (let i = -6; i < 7; i++) {
      s.beginPath(); s.moveTo(-w, i * h * 0.12); s.lineTo(w, i * h * 0.12 - h * 0.2); s.stroke();
    }
    s.restore();
  });
}`;

// ---------------------------------------------------------------- in Node, SVG
const rec = SURF.svg({ width: W, height: H, id: 'x' });
// eslint-disable-next-line no-new-func
const paint = new Function(`${PAINT}; return paint;`)();
paint(rec, W, H, NOISE, RAND);
const svgText = rec.toSVG();
const vector = new Resvg(svgText, { fitTo: { mode: 'width', value: W * SCALE },
  background: 'rgba(255,255,255,255)' }).render();

// ------------------------------------------------------- in Chromium, a canvas
const launch = process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {};
const browser = await chromium.launch(launch);
const page = await browser.newPage({ viewport: { width: W * SCALE + 40, height: H * SCALE + 40 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.setContent(`<!doctype html><meta charset="utf-8"><body style="margin:0">
<canvas id="c" width="${W * SCALE}" height="${H * SCALE}"></canvas>
<script>${require('node:fs').readFileSync(new URL('../src/patterns/rand.js', import.meta.url), 'utf8')}</script>
<script>${require('node:fs').readFileSync(new URL('../src/patterns/noise.js', import.meta.url), 'utf8')}</script>
<script>${require('node:fs').readFileSync(new URL('../src/patterns/surface.js', import.meta.url), 'utf8')}</script>
<script>
${PAINT}
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
ctx.scale(${SCALE}, ${SCALE});
const s = PatternSurface.canvas(ctx, ${W}, ${H});
paint(s, ${W}, ${H}, PatternNoise, PatternRand);
window.__ready = true;
</script></body>`);
await page.waitForFunction('window.__ready === true', null, { timeout: 8000 });
const shot = await page.locator('#c').screenshot({ type: 'png' });
await browser.close();
if (errors.length) { console.log('the browser threw:'); for (const e of errors) console.log('  ' + e); process.exit(2); }

const { decode } = require('fast-png');
const raster = decode(shot);

// ---------------------------------------------------------------- the compare
if (raster.width !== vector.width || raster.height !== vector.height) {
  console.log(`the two renderings are different sizes: canvas ${raster.width}x${raster.height}, vector ${vector.width}x${vector.height}`);
  process.exit(2);
}
const n = raster.width * raster.height;
const rd = raster.data, vd = vector.pixels;
const chan = raster.channels || 4;
let sum = 0, over8 = 0, over48 = 0, worst = 0;
for (let i = 0; i < n; i++) {
  const a = i * chan, b = i * 4;
  // both are drawn on opaque white, so compare the three colour channels
  const d = Math.max(Math.abs(rd[a] - vd[b]), Math.abs(rd[a + 1] - vd[b + 1]), Math.abs(rd[a + 2] - vd[b + 2]));
  sum += d;
  if (d > 8) over8++;
  if (d > 48) over48++;
  if (d > worst) worst = d;
}
const pc = (k) => `${((k / n) * 100).toFixed(2)}%`;
console.log(`\none paint function, two surfaces, ${raster.width}x${raster.height} pixels each\n`);
console.log(`  mean difference per pixel            ${(sum / n).toFixed(2)} of 255`);
console.log(`  pixels differing by more than 8      ${pc(over8)}`);
console.log(`  pixels differing by more than 48     ${pc(over48)}`);
console.log(`  worst single pixel                   ${worst}`);
console.log(`\n  ${n} pixels measured`);

// Where the bar sits, and why there.
//
// Two rasterisers disagree about the edge of a diagonal by a few counts each,
// which is unavoidable and harmless. A shape in one and not the other, or a
// shape in the wrong place, is neither. The two are separated by measuring
// each of them: with the recorder correct this reads a mean of 0.49 and 0.04%
// of pixels differing by more than 48, and with one piece of it reverted it
// reads
//
//     the stroke width no longer scaled by the matrix     6.70    3.27%
//     fillRect ignoring the matrix                       20.39    9.81%
//     an arc that jumps to its start instead of joining   2.86    1.29%
//     translate composed the other way round              3.09    1.56%
//     clip not opening a group                           38.81   19.25%
//
// so the bar goes in the gap between 0.49 and 2.86, and between 0.04% and
// 1.29%. It was set at 3.0 and 1.5% before those were measured, which let two
// of the five through.
const bad = [];
if (sum / n > 1.5) bad.push(`the mean difference is ${(sum / n).toFixed(2)}, against 0.49 when the two agree`);
if (over48 / n > 0.004) bad.push(`${pc(over48)} of pixels differ by more than 48, against 0.04% when they agree — something is drawn in one and not the other`);
if (over8 / n > 0.08) bad.push(`${pc(over8)} of pixels differ by more than 8 — that is more than antialiasing`);
if (bad.length) { console.log('\nthe two surfaces do not agree:'); for (const b of bad) console.log('  ' + b); process.exit(1); }
console.log('\nthe canvas and the recorder draw the same picture.\n');
