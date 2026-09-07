/* Is the canvas usable by somebody who is not holding a mouse?

   The manual, the deck and the published page are documents, and src/access.js
   measures them at build time from their own stylesheet. The canvas is an
   application, and three of the questions it has to answer cannot be asked of a
   file: whether every control can be reached and worked from the keyboard,
   whether you can see which one you are on, and what colour a rule actually
   lands on once it is inside a pane inside a page. All three need a browser,
   because all three are about the ancestor chain and the focus ring, and a
   stylesheet has neither.

   The twenty-ninth round deferred this and every ACCESSIBILITY.txt since has
   carried a sentence saying the canvas was not in it. This is the file that
   sentence was waiting for.

   Kept out of `npm test` because it needs a browser.

     node test/canvas-check.mjs path/to/editor.html
     PW_PATH=/where/playwright/lives node test/canvas-check.mjs editor.html
*/
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
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
const A = require('../src/access');

const file = path.resolve(process.argv[2] || 'editor.html');
const launch = process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {};
const browser = await chromium.launch(launch);
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [], outbound = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
page.on('request', (r) => { if (!/^(file|data|blob):/.test(r.url())) outbound.push(r.url()); });
await page.goto(pathToFileURL(file).href);
await page.waitForTimeout(400);

let bad = 0;
const check = (label, pass, detail) => {
  if (!pass) bad++;
  console.log(`${pass ? '  ok   ' : '  FAIL '} ${label.padEnd(38)} ${detail}`);
};

// ---------------------------------------------------------------- the keyboard
console.log('\nwhat the keyboard reaches');

const stops = [];
await page.keyboard.press('Tab');
const seen = new Set();
for (let i = 0; i < 120; i++) {
  const w = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    const r = el.getBoundingClientRect();
    return { tag: el.tagName.toLowerCase(), id: el.id || '',
      cls: String(el.className || '').split(' ')[0] || '',
      name: (el.getAttribute('aria-label') || el.getAttribute('title')
        || (el.labels && el.labels[0] && el.labels[0].textContent) || el.textContent || '')
        .replace(/\s+/g, ' ').trim(),
      x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  });
  if (!w) break;
  const key = `${w.tag}#${w.id}.${w.cls}@${w.x},${w.y}`;
  if (seen.has(key)) break;
  seen.add(key);
  stops.push(w);
  await page.keyboard.press('Tab');
}
check('every control is reachable by tab', stops.length > 20, `${stops.length} stops`);
const unnamed = stops.filter((s) => !s.name);
check('every stop says what it is', unnamed.length === 0,
  unnamed.length ? unnamed.map((s) => s.tag + (s.id ? '#' + s.id : '.' + s.cls)).join(', ') : `${stops.length} named`);

// A focus ring you cannot see is not a focus ring. Shoot each control focused
// and blurred and compare the pixels — nothing else tells you whether the
// browser's own default happens to land on this application's own colours.
let ringless = [];
for (const [i, s] of stops.entries()) {
  if (s.w < 1 || s.h < 1) continue;
  await page.evaluate((n) => {
    const all = [...document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')]
      .filter((e) => !e.disabled && e.tabIndex >= 0 && e.offsetParent !== null);
    if (all[n]) all[n].focus();
  }, i);
  const clip = { x: Math.max(0, s.x - 4), y: Math.max(0, s.y - 4), width: s.w + 8, height: s.h + 8 };
  const on = await page.screenshot({ clip });
  await page.evaluate(() => document.activeElement.blur());
  const off = await page.screenshot({ clip });
  if (Buffer.compare(on, off) === 0) ringless.push(s.tag + (s.id ? '#' + s.id : '.' + s.cls));
}
check('you can see which one you are on', ringless.length === 0,
  ringless.length ? ringless.join(', ') : 'every stop changes when it takes focus');

// ------------------------------------------------------------ the application
console.log('\nwhat the keyboard can do');

const boxes = () => page.evaluate(() => [...document.querySelectorAll('#sheet .hb-block')]
  .map((b) => ({ id: b.dataset.id, x: Math.round(parseFloat(b.style.left)), y: Math.round(parseFloat(b.style.top)),
    w: Math.round(parseFloat(b.style.width)), h: Math.round(parseFloat(b.style.height)),
    label: b.getAttribute('aria-label') })));
const selected = () => page.evaluate(() => document.querySelectorAll('#overlay .sel').length);
const focusBlock = (n) => page.evaluate((i) => {
  const b = document.querySelectorAll('#sheet .hb-block')[i]; if (b) b.focus();
}, n);

const onSheet = await page.evaluate(() =>
  [...document.querySelectorAll('#sheet .hb-block')].filter((b) => b.tabIndex >= 0).length);
const total = await page.evaluate(() => document.querySelectorAll('#sheet .hb-block').length);
check('a block can be reached at all', onSheet === total && total > 0, `${onSheet} of ${total} blocks`);

await focusBlock(1);
check('focus is the selection', await selected() === 1, `${await selected()} selected`);

const b0 = (await boxes())[1];
await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowDown');
const b1 = (await boxes())[1];
check('arrows move a block', b1.x !== b0.x && b1.y !== b0.y, `${b0.x},${b0.y} → ${b1.x},${b1.y}`);

await page.keyboard.down('Shift'); await page.keyboard.press('ArrowRight'); await page.keyboard.up('Shift');
const b2 = (await boxes())[1];
check('shift moves it further', (b2.x - b1.x) > (b1.x - b0.x), `${b2.x - b1.x} px against ${b1.x - b0.x}`);

await page.keyboard.down('Control'); await page.keyboard.press('ArrowRight'); await page.keyboard.up('Control');
const b3 = (await boxes())[1];
check('the modifier resizes it', b3.w !== b2.w, `${b2.w} → ${b3.w} wide`);

await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
check('two blocks can be selected', await selected() === 2, `${await selected()} selected`);
await page.keyboard.press('Escape');
check('escape lets go', await selected() === 0, `${await selected()} selected`);

await focusBlock(1);
const n0 = (await boxes()).length;
await page.keyboard.down('Control'); await page.keyboard.press('d'); await page.keyboard.up('Control');
const n1 = (await boxes()).length;
check('it can be duplicated', n1 === n0 + 1, `${n0} → ${n1} blocks`);
await page.keyboard.press('Delete');
check('it can be deleted', (await boxes()).length === n0, `${n1} → ${(await boxes()).length} blocks`);

await focusBlock(0);
const lab = (await boxes())[0].label;
// What a block answers to, asked without assuming the language it answers in.
// The first version was /^[A-Z].*\d.*selected$/, which is a sentence in English
// and fails on a canvas written in anything else — Hebrew has no capitals and
// its word for selected is not "selected". The page carries its own words, so
// ask it: a name, the four numbers, and the marker it puts on a selected block.
const words = await page.evaluate(() => (window.HANDOVER_BUNDLE || {}).words || {});
const plain = (x) => String(x || '').replace(/[\u2066-\u2069]/g, '');
const said = plain(lab);
const marker = plain(words.cvBlockSelected || ', selected');
check('a block says what it is',
  /\p{L}/u.test(said) && (said.match(/\d+/g) || []).length >= 4 && said.endsWith(marker),
  lab || '(nothing)');

// -------------------------------------------------------------- the contrast
console.log('\nwhat the type is set on');

// The ground a rule lands on is its nearest ancestor that paints one, which is
// a fact about the tree rather than about the stylesheet. Read both off the
// page and measure what is actually there.
const painted = await page.evaluate(() => {
  const out = [];
  const bgOf = (el) => {
    for (let n = el; n; n = n.parentElement) {
      const c = getComputedStyle(n).backgroundColor;
      if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c;
    }
    return getComputedStyle(document.body).backgroundColor;
  };
  for (const el of document.querySelectorAll('.app *')) {
    if (el.closest('#sheet')) continue;                 // the document being edited
    const text = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).length;
    if (!text) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el);
    out.push({ what: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className ? '.' + String(el.className).split(' ')[0] : ''),
      fg: cs.color, bg: bgOf(el), px: parseFloat(cs.fontSize), weight: cs.fontWeight });
  }
  return out;
});
const rgb = (s) => { const m = /(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(s); return m ? `#${[1, 2, 3].map((i) => Number(m[i]).toString(16).padStart(2, '0')).join('')}` : null; };
const C = require('../src/contrast');
const fails = [];
for (const p of painted) {
  const fg = rgb(p.fg), bg = rgb(p.bg);
  if (!fg || !bg) continue;
  const r = C.ratio(fg, bg);
  const need = A.needs(p.px, p.weight);
  if (r != null && r < need) fails.push(`${p.what} ${p.px}px ${fg} on ${bg} ${r}:1 needs ${need}`);
}
check('the application meets its own standard', fails.length === 0,
  fails.length ? fails.slice(0, 4).join(' | ') : `${painted.length} pieces of text measured on the ground each is actually on`);

// ------------------------------------------------------------------ the rest
console.log('\nthe rest');
const live = await page.evaluate(() => ({
  status: !!document.querySelector('[role="status"],[aria-live]'),
  main: !!document.querySelector('main'),
  h1: document.querySelectorAll('h1').length,
  current: !!document.querySelector('[aria-current]'),
}));
check('a landmark to work in', live.main, live.main ? '<main>' : 'none');
check('one first level heading', live.h1 === 1, `${live.h1}`);
check('a region that announces', live.status, live.status ? 'role=status' : 'none');
check('the page you are on says so', live.current, live.current ? 'aria-current' : 'none');
check('nothing is fetched', outbound.length === 0, outbound.join(', ') || 'no request left the page');
check('nothing errors', errors.length === 0, errors.join(' | ') || 'no console error');

console.log(bad
  ? `\n${bad} thing${bad > 1 ? 's' : ''} the canvas does not answer for.`
  : '\nEverything above passed.');
await browser.close();
process.exit(bad ? 1 : 0);
