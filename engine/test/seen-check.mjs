/* Is the artwork the canvas opens with actually on the screen?

   Everything else about this is arithmetic, and arithmetic can be wrong about
   a browser: a mark can resolve to a colourway that reads on paper and still
   be painted over, clipped away, or drawn at nought by nought. So this opens
   the starter document in Chromium, takes one picture of it, and counts the
   pixels of each block that are the ink the mark is supposed to be drawn in.

   A block that resolves to an ink and then paints none of it is a block
   nobody can see, whatever the ratio said.

   Kept out of `npm test` because it needs a browser.

     node test/seen-check.mjs projects/hallward/project.json [more...]
     PW_PATH=/where/playwright/lives node test/seen-check.mjs projects/vesper/project.json
*/
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
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
const projectLoader = require('../src/project');
const { measure } = require('../src/variants');
const { bundle, starterDoc } = require('../src/editor/bundle');
const { publish } = require('../src/editor/publish');
const R = require('../src/editor/render');

const ART = ['mark', 'lockup', 'construction', 'clearSpace', 'minimumSize', 'motion'];
const files = process.argv.slice(2);
if (!files.length) { console.log('give it one or more project.json paths.'); process.exit(2); }

const launch = process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {};
const browser = await chromium.launch(launch);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seen-'));
let bad = 0, checked = 0;

for (const f of files) {
  const project = projectLoader.load(f);
  const bu = bundle(project, measure(project), []);
  const doc = starterDoc(bu);

  // what each block ought to be painting, worked out before the browser sees it
  const want = {};
  for (const page of doc.pages) for (const b of page.blocks) {
    if (!ART.includes(b.type)) continue;
    const on = b.props.on || 'ground';
    if (on === 'none') continue;
    const cw = R.cwName(bu, b.props.colourway || 'primary', on);
    const key = b.type === 'lockup' ? `${b.props.lockup}:${cw}` : cw;
    const art = b.type === 'lockup' ? bu.variants[key] : bu.marks[key];
    const ink = art && R.bestInk(bu, key, R.colour(bu, on));
    // a block whose artwork the project never cut is recorded, not skipped:
    // it is the loudest fault of the lot and the easiest to count as absent
    want[b.id] = art
      ? { type: b.type, cw, hex: ink ? ink.hex : '#000000', ratio: ink ? ink.ratio : 0 }
      : { type: b.type, cw: key, hex: '#000000', ratio: 0, uncut: true };
  }

  const file = path.join(dir, `${project.brand.replace(/\W+/g, '-')}.html`);
  fs.writeFileSync(file, publish(doc, bu, { title: project.brand }));
  // The motion block builds the mark over a second or two, so a picture taken
  // while it is still arriving shows nothing and says the block is blind. Ask
  // for the resting state, which the block already draws for a reader who has
  // said they do not want movement.
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 }, reducedMotion: 'reduce' });
  await page.goto(pathToFileURL(file).href);
  await page.waitForTimeout(300);

  // one picture, decoded by the browser that drew it, then read per block
  const shot = (await page.screenshot({ fullPage: true })).toString('base64');
  const seen = await page.evaluate(async ({ shot, want }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + shot;
    await img.decode();
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    cv.getContext('2d').drawImage(img, 0, 0);
    const dpr = img.naturalWidth / document.documentElement.scrollWidth;
    const out = {};
    for (const id of Object.keys(want)) {
      if (want[id].uncut) { out[id] = {}; continue; }
      const el = document.querySelector(`[data-id="${id}"]`);
      if (!el) { out[id] = { missing: true }; continue; }
      const r = el.getBoundingClientRect();
      const x = Math.round((r.left + window.scrollX) * dpr), y = Math.round((r.top + window.scrollY) * dpr);
      const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
      const d = cv.getContext('2d').getImageData(x, y, w, h).data;
      const target = want[id].hex.replace('#', '');
      const tr = parseInt(target.length === 3 ? target[0] + target[0] : target.slice(0, 2), 16);
      const tg = parseInt(target.length === 3 ? target[1] + target[1] : target.slice(2, 4), 16);
      const tb = parseInt(target.length === 3 ? target[2] + target[2] : target.slice(4, 6), 16);
      let hit = 0; const tones = new Set();
      for (let i = 0; i < d.length; i += 4) {
        tones.add((d[i] >> 3) + ',' + (d[i + 1] >> 3) + ',' + (d[i + 2] >> 3));
        // a tolerance of six per channel, because a rasteriser antialiases
        if (Math.abs(d[i] - tr) < 6 && Math.abs(d[i + 1] - tg) < 6 && Math.abs(d[i + 2] - tb) < 6) hit++;
      }
      out[id] = { hit, px: w * h, tones: tones.size, w, h };
    }
    return out;
  }, { shot, want });
  await page.close();

  console.log(`\n${project.brand}`);
  for (const [id, w] of Object.entries(want)) {
    const s = seen[id] || {};
    checked++;
    // A block is drawn if the ink it resolves to reads on the ground it is
    // drawn on, that ink is on the screen, and the block is not one flat
    // colour. Half a per cent of a block is a small mark; none of it is none.
    const share = s.px ? s.hit / s.px : 0;
    const ok = !w.uncut && !s.missing && w.ratio >= R.SEEN && s.hit > 0 && s.tones > 1;
    if (!ok) bad++;
    console.log(`${ok ? '  ok   ' : '  FAIL '} ${w.type.padEnd(13)} ${w.cw.padEnd(16)} `
      + (w.uncut ? 'the project never cut it'
        : `${w.hex} ${String(w.ratio).padStart(6)}:1  ${(share * 100).toFixed(1)}% of ${s.px || 0} px, ${s.tones || 0} tones`));
  }
}
await browser.close();
fs.rmSync(dir, { recursive: true, force: true });
console.log(`\n${checked} blocks, ${bad} that nobody can see`);
process.exit(bad ? 1 : 0);
