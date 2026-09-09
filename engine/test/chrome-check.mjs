/* Every run of text in a shipped document, measured against the colour that is
   actually behind it.

   src/access.js reads the stylesheet, which is how the check runs at build time
   with nothing installed. Reading a stylesheet means inferring two things a
   browser does not have to infer: what size an element ends up at when it
   inherits one, and which ancestor paints the ground under it. The deck sizes
   its slides in container units against a stage painted in the brand's primary,
   so both inferences are wrong there — which is why src/access.js measures each
   document's own tokens and leaves the identity's to the documents that are
   about the identity.

   This is the other half: the browser's own answer, for every element that has
   text in it, on all four documents. It is what found the deck's top bar at
   3.97 to 1 and the published page's captions at 4.37, in packages whose own
   statement said everything on every page had passed.

   Kept out of `npm test` because it needs a browser.

     node test/chrome-check.mjs out/guidelines.html out/deck.html
     PW_PATH=/where/playwright/lives node test/chrome-check.mjs out/deck.html
*/
import { createRequire } from 'node:module';
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
const CO = require('../src/contrast');
const A = require('../src/access');

const files = process.argv.slice(2);
if (!files.length) { console.log('give it one or more built documents.'); process.exit(2); }

const launch = process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {};
const browser = await chromium.launch(launch);
let bad = 0, runs = 0;

// Both themes, because a document ships two and a reader only ever sees one.
for (const scheme of ['light', 'dark']) {
  console.log(`\n${scheme}`);
  for (const f of files) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, colorScheme: scheme });
    await page.goto(pathToFileURL(path.resolve(f)).href);
    await page.waitForTimeout(400);
    const found = await page.evaluate(() => {
      const out = [];
      const rgb = (s) => {
        const m = /rgba?\(([^)]+)\)/.exec(s);
        if (!m) return null;
        const n = m[1].split(',').map(parseFloat);
        return n[3] === 0 ? null : n.slice(0, 3);
      };
      // The colour actually behind an element — the thing a stylesheet cannot
      // tell you. Walking up the ancestors is not enough: a canvas block sits
      // on a fill block that is its sibling, absolutely positioned under it,
      // and walking past that found the page and called a cover 1 to 1. Ask
      // the browser what is stacked under the point instead.
      const behind = (el) => {
        const r = el.getBoundingClientRect();
        const x = Math.min(window.innerWidth - 1, Math.max(0, r.left + Math.min(r.width / 2, 40)));
        const y = Math.min(window.innerHeight - 1, Math.max(0, r.top + r.height / 2));
        const stack = (r.top < window.innerHeight && r.bottom > 0)
          ? document.elementsFromPoint(x, y) : [];
        for (const n of stack.length ? stack : []) {
          if (n === el) continue;
          const c = rgb(getComputedStyle(n).backgroundColor);
          if (c) return c;
        }
        let n = el;
        while (n && n !== document.documentElement) {
          const c = rgb(getComputedStyle(n).backgroundColor);
          if (c) return c;
          n = n.parentElement;
        }
        return rgb(getComputedStyle(document.body).backgroundColor) || [255, 255, 255];
      };
      for (const el of document.querySelectorAll('*')) {
        const txt = [...el.childNodes].filter((n) => n.nodeType === 3)
          .map((n) => n.textContent.trim()).join(' ').trim();
        if (!txt) continue;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || parseFloat(cs.opacity) < 1) continue;
        // SVG text paints with `fill`, and inherits a `color` it never uses.
        // Reading `color` for it called four labels in the construction diagram
        // 1.02 to 1 when they are drawn in the diagram's own line colour.
        const svg = el.ownerSVGElement || el.tagName.toLowerCase() === 'svg';
        const fg = rgb(svg && cs.fill && cs.fill !== 'none' ? cs.fill : cs.color);
        if (!fg) continue;
        // Words over a photograph are not a pair of flat colours, and the rule
        // that governs them is the identity's scrim — measured where that is
        // decided, in src/photography.js, not here against a placeholder tint.
        const r2 = el.getBoundingClientRect();
        const overPicture = (r2.top < window.innerHeight && r2.bottom > 0
          ? document.elementsFromPoint(
            Math.min(window.innerWidth - 1, Math.max(0, r2.left + Math.min(r2.width / 2, 40))),
            Math.min(window.innerHeight - 1, Math.max(0, r2.top + r2.height / 2)))
          : []).some((n) => n.tagName === 'IMG' || /hb-surface|hb-slot/.test(String(n.className || '')));
        if (overPicture) continue;
        out.push({ tag: el.tagName.toLowerCase(), cls: String(el.className || '').slice(0, 30),
          px: parseFloat(cs.fontSize), weight: cs.fontWeight, fg, bg: behind(el), text: txt.slice(0, 40) });
      }
      return out;
    });
    await page.close();

    const hex = (n) => '#' + n.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
    const under = [];
    for (const r of found) {
      const ratio = CO.ratio(hex(r.fg), hex(r.bg));
      if (ratio == null) continue;
      runs++;
      const need = A.needs(r.px, r.weight);
      // The contrast table shows failing pairs on purpose: that is the point of
      // printing one. A swatch that demonstrates a failure is not a failure.
      if (/\bcp\b|\bsw\b/.test(r.cls)) continue;
      if (ratio < need) under.push({ ...r, ratio, need, fgHex: hex(r.fg), bgHex: hex(r.bg) });
    }
    bad += under.length;
    console.log(`  ${path.basename(f).padEnd(18)} ${String(found.length).padStart(4)} runs, ${under.length} under the standard`);
    const seen = new Set();
    for (const u of under.sort((a, c) => a.ratio - c.ratio)) {
      const k = `${u.tag}.${u.cls}|${u.fgHex}|${u.bgHex}`;
      if (seen.has(k)) continue;
      seen.add(k);
      console.log(`    ${String(u.ratio).padStart(5)}:1 needs ${u.need}  ${u.px}px ${u.weight}  `
        + `${u.fgHex} on ${u.bgHex}  ${u.tag}.${u.cls}  "${u.text}"`);
    }
  }
}
await browser.close();
console.log(`\n${runs} runs of text measured, ${bad} under the standard`);
process.exit(bad ? 1 : 0);
