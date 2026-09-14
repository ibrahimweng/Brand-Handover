/* Where is a person going to press?

     node engine/tools/where-they-press.mjs 1440 900 [shot-dir]

   Needs the app running (node src/app/server.js) and playwright installed.
   With a shot directory it also writes a heat overlay per screen.


   No users yet, so this is a prediction rather than a recording — but a
   prediction made of things that can be measured rather than guessed:

     rank    where it falls in reading order within its own region. The first
             thing in a region is pressed far more than the fourth.
     size    how big the target is. Fitts: a big near thing is cheap.
     weight  how much it stands out — filled against outlined, accent against
             grey, a heading against a label.
     role    what it is. The one primary action of a screen takes most of the
             presses on that screen; a disclosure takes some; a slider in a
             fold takes very few.

   The score is a share of attention within a screen, so the columns add to
   100% and two screens can be compared. What it is for is finding the thing
   that is high-ranked and hard to reach, or low-ranked and shouting. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const fs = require('fs');
const W = Number(process.argv[2] || 1440), H = Number(process.argv[3] || 900);
const OUT = process.argv[4] || null;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: W, height: H } });
await p.goto('http://127.0.0.1:3000', { waitUntil: 'load' });
await p.waitForTimeout(400);
const dir = (process.env.FIXTURE || 'projects/meridian');
await p.setInputFiles('#file', [dir + '/mark.svg', dir + '/wordmark.svg']);
await p.waitForSelector('#seen .art', { timeout: 60000 });

const SCORE = `(() => {
  const vis = (n) => { const r = n.getBoundingClientRect();
    return r.width > 2 && r.height > 2 && getComputedStyle(n).visibility !== 'hidden'; };
  const panel = document.querySelector('.panel.on');
  /* Everything a person can actually press, not everything that happens to be
     a <button>. The layout step's four choices are role=radio divs with a
     tabindex, and the first version of this script reported that screen as
     having two targets on it — which was the script being wrong, not the
     screen. */
  const SEL = 'button,select,a[href],summary,label.opt,'
    + 'input:not([type=hidden]),[role=button],[role=radio],[tabindex]:not([tabindex="-1"])';
  let nodes = [...panel.querySelectorAll(SEL)]
    .filter(vis).filter(n => !n.disabled)
    .concat([...document.querySelectorAll('.bar button')].filter(vis));
  // A label wrapping a checkbox is one target, not two.
  nodes = nodes.filter(n => !(n.tagName === 'INPUT' && n.closest('label.opt')));
  // one entry per target, with what can be read off it
  const rows = nodes.map((n, i) => {
    const r = n.getBoundingClientRect();
    const cs = getComputedStyle(n);
    const filled = cs.backgroundColor !== 'rgba(0, 0, 0, 0)'
      && cs.backgroundColor !== getComputedStyle(document.body).backgroundColor;
    const primary = n.id === 'go';
    const fold = !!n.closest('.pfold');
    const disclosure = n.classList.contains('pmore') || n.tagName === 'SUMMARY';
    const area = r.width * r.height;
    const label = (n.getAttribute('aria-label') || n.textContent || n.value || n.type || '').trim().slice(0, 26);
    return { label, x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2),
      w: Math.round(r.width), h: Math.round(r.height), area, filled, primary, fold, disclosure,
      order: i, top: r.top };
  });
  // reading order: top to bottom, then left to right, in bands
  const sorted = rows.slice().sort((a, b2) => (Math.round(a.top / 60) - Math.round(b2.top / 60)) || (a.x - b2.x));
  sorted.forEach((r, i) => { r.rank = i; });
  const n = Math.max(1, sorted.length);
  for (const r of rows) {
    let s = 1;
    s *= 1 / Math.pow(1 + r.rank, 0.55);            // reading order, decaying
    s *= Math.pow(Math.min(r.area, 40000) / 900, 0.30); // size, with a ceiling
    if (r.filled) s *= 2.2;                          // a filled control shouts
    if (r.primary) s *= 9;                           // the one way forward
    if (r.disclosure) s *= 1.5;                      // a labelled press invites
    if (r.fold) s *= 0.25;                           // behind a press already
    r.raw = s;
  }
  const total = rows.reduce((t, r) => t + r.raw, 0) || 1;
  rows.forEach(r => { r.share = r.raw / total; });
  return rows.sort((a, b2) => b2.share - a.share);
})()`;

const step = async (name) => {
  const rows = await p.evaluate(SCORE);
  console.log('\\n' + name + '  — ' + rows.length + ' targets');
  for (const r of rows.slice(0, 8)) {
    const bar = '#'.repeat(Math.max(1, Math.round(r.share * 60)));
    console.log('  ' + (r.share * 100).toFixed(1).padStart(5) + '%  '
      + r.label.padEnd(26) + ' ' + String(r.w + 'x' + r.h).padStart(8)
      + (r.fold ? ' [folded]' : '') + (r.primary ? ' [primary]' : '') + '  ' + bar);
  }
  const tail = rows.slice(8).reduce((t, r) => t + r.share, 0);
  if (rows.length > 8) console.log('  ' + (tail * 100).toFixed(1).padStart(5) + '%  '
    + ('the other ' + (rows.length - 8)).padEnd(26));
  /* Anything smaller than 24 px in either direction, worst first. A target the
     prediction says people will press often and the ruler says is 13 px tall is
     the one thing this script is really for. */
  const small = rows.filter(r => Math.min(r.w, r.h) < 24)
    .sort((a, c) => c.share - a.share);
  if (small.length) {
    console.log('  -- under 24px: ' + small.length + ' of ' + rows.length);
    for (const r of small.slice(0, 4)) {
      console.log('     ' + (r.share * 100).toFixed(1).padStart(5) + '%  '
        + r.label.padEnd(26) + ' ' + (r.w + 'x' + r.h));
    }
  }
  if (OUT) {
    await p.evaluate((rs) => {
      const o = document.createElement('div');
      o.id = '__heat';
      o.style.cssText = 'position:fixed;inset:0;z-index:999;pointer-events:none';
      rs.forEach(r => {
        const d = document.createElement('div');
        const s = Math.max(28, Math.sqrt(r.share) * 320);
        d.style.cssText = 'position:absolute;left:' + (r.x - s / 2) + 'px;top:' + (r.y - s / 2)
          + 'px;width:' + s + 'px;height:' + s + 'px;border-radius:50%;'
          + 'background:radial-gradient(circle,rgba(255,64,0,' + Math.min(.75, r.share * 3.2)
          + ') 0%,rgba(255,64,0,0) 70%)';
        o.appendChild(d);
      });
      document.body.appendChild(o);
    }, rows);
    await p.screenshot({ path: `${OUT}/heat-${W}-${name}.png` });
    await p.evaluate(() => { const n = document.getElementById('__heat'); if (n) n.remove(); });
  }
  return rows;
};

await step('artwork');
await p.click('#go'); await p.waitForTimeout(700);
await p.evaluate(() => { const n = document.querySelector('#qs input[type=text]');
  if (n) { n.value = 'Meridian'; n.dispatchEvent(new Event('input', { bubbles: true })); } });
await p.waitForTimeout(300);
await step('questions');
await p.click('#go'); await p.waitForTimeout(700);
await p.evaluate(() => document.querySelector('#p-style .pick').click());
await p.waitForTimeout(300);
await step('layout');
await p.click('#go');
await p.waitForSelector('#pgens .pchip', { timeout: 90000 });
await p.waitForTimeout(1200);
await step('pattern');
await b.close();
