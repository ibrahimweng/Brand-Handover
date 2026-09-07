/* Is a measurement on the page the measurement in the file?

   In a document that reads right to left it need not be. A browser lays out a
   run of Latin characters inside Hebrew prose by the bidirectional algorithm,
   and the neutral characters around it — a #, a ÷, a ·, the space between a
   number and its unit — go to whichever end the paragraph direction says. So
   #C8873A is drawn C8873A#. The RGB triple 18 59 58 is drawn 58 59 18, which
   is a different colour. The Pantone 1385 C is drawn C 1385, which is a
   different ink to send to a press. 122 × 50 px is drawn px 50 × 122, which is
   a different shape. The file is right in every one of those, every check the
   engine has passes, and the reader is shown something else.

   Nothing at build time can see this: it is not in the markup, it is in the
   layout. en and fr could never have found it — a Latin value in a Latin
   document is already the way round it should be.

   The engine's answer is that a value says it is its own run: U+2068 and
   U+2069 around it, characters rather than markup so that the hundred callers
   that set a measurement do not each have to know. This is the file that
   measures whether that worked, and it works by reading each character's
   position on the screen and comparing the order they are drawn in with the
   order they are written in.

   Kept out of `npm test` because it needs a browser.

     node test/rtl-check.mjs path/to/guidelines.html
     PW_PATH=/where/playwright/lives node test/rtl-check.mjs guidelines.html
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

const files = (process.argv.slice(2).length ? process.argv.slice(2) : ['guidelines.html'])
  .map((f) => path.resolve(f));
const launch = process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {};
const browser = await chromium.launch(launch);
const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });

let bad = 0;
for (const file of files) {
  await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
  await page.waitForTimeout(200);
  const dir = await page.evaluate(() => document.documentElement.getAttribute('dir') || 'ltr');
  const wrong = await page.evaluate(() => {
    const out = [];
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const s = n.textContent;
      if (!s.trim() || s.length > 60) continue;
      if (n.parentElement.closest('script,style,svg')) continue;
      // every maximal run with no right-to-left letter in it
      for (const m of s.matchAll(/[^֐-ࣿיִ-﻿⁦-⁩]*[0-9A-Za-z][^֐-ࣿיִ-﻿⁦-⁩]*/g)) {
        // Punctuation at a run's edge sits between the run and the text beside
        // it, and which side of that boundary it lands on is the algorithm
        // doing its job. What has to hold is the order inside the value.
        const lead = /^[^A-Za-z0-9#]*/.exec(m[0])[0].length;
        const run = m[0].slice(lead).replace(/[^A-Za-z0-9%)\]]+$/, '');
        if (!/[A-Za-z0-9]/.test(run) || run.length < 2) continue;
        const at = [];
        for (let i = 0; i < run.length; i++) {
          const r = document.createRange();
          r.setStart(n, m.index + lead + i); r.setEnd(n, m.index + lead + i + 1);
          const b = r.getBoundingClientRect();
          if (b.width === 0 && b.height === 0) { at.push(null); continue; }
          // the line first, then the position along it: a run that wraps is not
          // a run that was reordered
          at.push([Math.round(b.top / 4), b.left + b.width / 2]);
        }
        const seen = run.split('').map((c, i) => [at[i], c, i])
          .filter((x) => x[0] !== null && !/[\s‎‏⁦-⁩‪-‮]/.test(x[1]));
        if (seen.length < 2) continue;
        // two identical letters side by side measure to all but the same place,
        // so ties keep the order they are written in
        const drawn = seen.slice().sort((a, c) => (a[0][0] !== c[0][0] ? a[0][0] - c[0][0]
          : (Math.abs(a[0][1] - c[0][1]) < 1 ? a[2] - c[2] : a[0][1] - c[0][1])))
          .map((x) => x[1]).join('');
        const written = seen.map((x) => x[1]).join('');
        if (drawn !== written) out.push({ written, drawn, where: n.parentElement.tagName.toLowerCase() });
      }
    }
    return out;
  });
  const name = path.basename(file);
  if (!wrong.length) {
    console.log(`  ok    ${name.padEnd(20)} dir=${dir}, every value drawn the way it is written`);
  } else {
    bad += wrong.length;
    console.log(`  FAIL  ${name.padEnd(20)} dir=${dir}, ${wrong.length} drawn in an order the file does not say`);
    const seen = new Set();
    for (const w of wrong) {
      const k = `${w.where}|${w.written}`;
      if (seen.has(k)) continue;
      seen.add(k);
      console.log(`          <${w.where}> file "${w.written}"  reader sees "${w.drawn}"`);
    }
  }
}
await browser.close();
console.log(bad ? `\n${bad} values are not what the page says they are.` : '\nevery value on every page is drawn as written.');
process.exit(bad ? 1 : 0);
