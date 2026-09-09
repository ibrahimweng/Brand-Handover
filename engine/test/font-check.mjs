/* Can the face a page is set in draw the words on it?

   A font can arrive and still have nothing to draw with. Yamabiko ships
   IPAGothic subsetted to the characters its own content sets, which is why the
   package opens with no network at all instead of carrying several megabytes —
   and a subset is subset to what somebody knew about when it was cut. A missing
   glyph is not an error: the browser falls through to the next family, draws the
   character in whatever the reader happens to have, and the page goes on saying
   it is set in the face.

   Which characters land in which face on a finished page is a fact about the
   page, and only a browser has it. This asked Node instead. It read every font
   in 09-type with opentype.js, and opentype.js does not decompress woff2, which
   is what every package ships — so it stopped at "nothing was measured" and had
   never once run. It was honest about that, and it was still an instrument that
   measured nothing.

   Chromium knows, and says so: CSS.getPlatformFontsForNode reports the platform
   font that supplied each element's glyphs, how many, and whether it came from
   an @font-face — which is the same as asking whether it came out of the
   package. That is the question, answered by the thing that has the answer.

   Kept out of `npm test` because it needs a browser.

     node test/font-check.mjs path/to/package
     PW_PATH=/where/playwright/lives node test/font-check.mjs out/
*/
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
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

// A page is allowed to be drawn by the reader's own fonts where it asks for
// them on purpose: the documents set their furniture in a neutral system stack,
// and Helvetica drawing an English caption is that stack working as intended.
// What is not allowed is a page with nothing in its own package to fall back
// on, which is every page whose language those names cannot write.
const FLOOR = Number(process.env.FONT_FLOOR || 50);

const dirs = process.argv.slice(2);
if (!dirs.length) { console.log('give it one or more built packages.'); process.exit(2); }

const launch = process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {};
const browser = await chromium.launch(launch);
let bad = 0, seen = 0;

for (const dir of dirs) {
  const id = path.basename(path.resolve(dir));
  for (const name of ['guidelines.html', 'deck.html', 'published.html', 'editor.html']) {
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) continue;
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
    // Only an element with text of its own can be asked about, and it has to be
    // findable from the protocol side, so each one is marked before asking.
    const shipped = await page.evaluate(async () => {
      await document.fonts.ready;
      let i = 0;
      for (const el of document.querySelectorAll('*')) {
        if ([...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) el.setAttribute('data-fc', String(i++));
      }
      return [...new Set([...document.fonts].map((f) => f.family.replace(/^['"]|['"]$/g, '')))];
    });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
    const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '[data-fc]' });
    let own = 0, theirs = 0;
    const by = new Map();
    for (const nodeId of nodeIds) {
      let fonts;
      try { ({ fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId })); } catch { continue; }
      for (const f of fonts || []) {
        if (f.isCustomFont) { own += f.glyphCount; continue; }
        theirs += f.glyphCount;
        if (!by.has(f.familyName)) by.set(f.familyName, { n: 0, eg: null, nodeId });
        by.get(f.familyName).n += f.glyphCount;
      }
    }
    for (const [, v] of by) {
      try {
        const { object } = await cdp.send('DOM.resolveNode', { nodeId: v.nodeId });
        const { result } = await cdp.send('Runtime.callFunctionOn', {
          objectId: object.objectId,
          functionDeclaration: `function () {
            const t = [...this.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
            return JSON.stringify({ fam: getComputedStyle(this).fontFamily, t: t.slice(0, 34) });
          }`,
          returnByValue: true,
        });
        v.eg = JSON.parse(result.value);
      } catch { /* an element that has gone is one this cannot quote */ }
    }
    await page.close();
    const all = own + theirs;
    if (!all) continue;
    seen++;
    const share = (own / all) * 100;
    const ok = share >= FLOOR;
    if (!ok) bad++;
    console.log(`${ok ? '  ok   ' : '  FAIL '} ${id.padEnd(14)} ${name.padEnd(17)} `
      + `${share.toFixed(1)}% of ${all} glyphs from a file the package ships`
      + `${shipped.length ? `  [${shipped.join(', ')}]` : '  [ships no face]'}`);
    if (!ok) {
      for (const [k, v] of [...by].sort((a, b) => b[1].n - a[1].n).slice(0, 3)) {
        console.log(`          ${String(v.n).padStart(6)}  ${k.padEnd(20)}`
          + (v.eg ? `  asked ${v.eg.fam.slice(0, 40)}  "${v.eg.t}"` : ''));
      }
    }
  }
}
await browser.close();
console.log(bad
  ? `\n${bad} of ${seen} documents are drawn mostly by whatever the reader happens to have.`
  : `\nevery one of the ${seen} documents draws most of its words out of its own package.`);
process.exit(bad ? 1 : 0);
