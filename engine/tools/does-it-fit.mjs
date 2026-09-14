/* Does the app fit the screen it is on?

   Walks the whole flow at a viewport and reports, per step, whether the page
   scrolls and whether the work area inside it does. "Fits" is
   scrollHeight <= clientHeight, measured rather than judged, because a screen
   that looks fine on the machine it was built on is a screen nobody measured.

   The page must never scroll — the header and the bar are the app's frame. The
   work area may, and on a phone it has to.

     node engine/tools/does-it-fit.mjs 1440 900 [shot-dir]

   Needs the app running (node src/app/server.js) and playwright installed. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const B = process.env.APP || 'http://127.0.0.1:3000';
const W = Number(process.argv[2] || 1440), H = Number(process.argv[3] || 900);
const shotDir = process.argv[4] || null;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: W, height: H },
  isMobile: W < 700, hasTouch: W < 700 });
const errs = [];
p.on('pageerror', e => errs.push(String(e).slice(0, 120)));
const NAMES = ['artwork', 'questions', 'layout', 'pattern', 'words', 'package'];
const out = [];
const snap = async (i) => {
  const m = await p.evaluate(() => {
    const b = document.querySelector('.panel.on .pbd');
    const inner = [...document.querySelectorAll('.panel.on [data-scroll], .panel.on .prail')]
      .map(n => Math.max(0, n.scrollHeight - n.clientHeight));
    return {
      page: Math.round(document.documentElement.scrollHeight),
      view: innerHeight,
      work: b ? Math.round(b.clientHeight) : null,
      workOver: b ? Math.max(0, Math.round(b.scrollHeight - b.clientHeight)) : null,
      inner: inner.filter(v => v > 0),
      wide: Math.round(document.documentElement.scrollWidth) > innerWidth + 1,
    };
  });
  out.push({ step: NAMES[i], ...m, over: m.page - m.view });
  if (shotDir) await p.screenshot({ path: `${shotDir}/${W}-${i}-${NAMES[i]}.png`, fullPage: true });
};
await p.goto(B, { waitUntil: 'load' });
await p.waitForTimeout(400);
await snap(0);
const dir = (process.env.FIXTURE || 'projects/meridian');
await p.setInputFiles('#file', [dir + '/mark.svg', dir + '/wordmark.svg']);
await p.waitForSelector('#seen .art', { timeout: 60000 });
await p.waitForTimeout(500);
out[0] = null; await snap(0);
out.splice(0, 1);
await p.click('#go'); await p.waitForTimeout(600);
await p.evaluate(() => { const n = document.querySelector('#qs input[type=text], #qs input:not([type])');
  if (n) { n.value = 'Meridian'; n.dispatchEvent(new Event('input', { bubbles: true })); } });
await p.waitForTimeout(400); await snap(1);
await p.click('#go'); await p.waitForTimeout(600);
await p.evaluate(() => { const c = document.querySelector('#p-style .pick .m, #p-style .card, #p-style label'); if (c) c.click(); });
await p.waitForTimeout(400); await snap(2);
await p.click('#go');
await p.waitForSelector('#pgens .pchip', { timeout: 90000 });
await p.waitForTimeout(1500); await snap(3);
await p.click('#go'); await p.waitForTimeout(800); await snap(4);
console.log(`viewport ${W}x${H}`);
for (const r of out) {
  console.log(' ', r.step.padEnd(10),
    'page', String(r.over > 0 ? '+' + r.over : 'fits').padStart(6),
    '| work area', String(r.work).padStart(4) + 'px',
    r.workOver > 0 ? 'SCROLLS +' + r.workOver : 'fits',
    r.inner && r.inner.length ? ' inner:' + r.inner.join(',') : '',
    r.wide ? ' SIDEWAYS' : '');
}
if (errs.length) console.log('  errors:', errs.slice(0, 2));
await b.close();
