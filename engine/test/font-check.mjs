/* Can the face a page is set in draw the words on it?

   A font can arrive and still have nothing to draw with. Yamabiko ships
   IPAGothic subsetted to 210 characters, which is why the package opens with no
   network at all instead of carrying several megabytes — and a subset is subset
   to what somebody knew about when it was cut. A missing glyph is not an error:
   the browser falls through to the next family, draws the character in whatever
   the reader happens to have, and the page goes on saying it is set in the face.

   The build asks this of the words it knows go in the identity's own face — the
   brand's, the project's prose, the samples in its type scale. Which characters
   land in which face on a finished page is a fact about the page, and only a
   browser has it: the family that wins is the first one in the stack that has
   the character, so the question is what each element ASKS for, character by
   character, against what that face actually holds.

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
const opentype = require(require.resolve('opentype.js', { paths: [import.meta.dirname, process.cwd(), path.join(import.meta.dirname, '..', '..')] }));

const dir = path.resolve(process.argv[2] || '.');
// every font the package ships, indexed by what it can draw
const fonts = [];
const unread = [];
const files = fs.readdirSync(path.join(dir, '09-type')).filter((x) => /\.(ttf|otf|woff2?)$/i.test(x));
for (const f of files) {
  const file = path.join(dir, '09-type', f);
  try {
    const bytes = fs.readFileSync(file);
    const font = opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    const map = font.tables.cmap && font.tables.cmap.glyphIndexMap;
    if (map) fonts.push({ file: f, covers: new Set(Object.keys(map).map(Number)) });
    else unread.push(f);
  } catch (e) { unread.push(f); void e; }
}
// A check that cannot read a font must not report that as a pass. woff2 is
// Brotli-compressed and opentype.js does not decompress it, so a package whose
// faces are all woff2 is one this cannot judge — and saying "no font files"
// when there are twelve of them is worse than saying nothing.
if (!fonts.length) {
  console.log(files.length
    ? `this package ships ${files.length} font file${files.length === 1 ? '' : 's'} and none of them `
      + `could be read here (${[...new Set(files.map((f) => path.extname(f)))].join(', ')}). `
      + `woff2 is Brotli compressed and opentype.js does not decompress it, so nothing was measured.`
    : 'this package ships no font files, so there is nothing to check.');
  process.exit(0);
}
if (unread.length) {
  console.log(`  note  ${unread.length} font file${unread.length === 1 ? '' : 's'} could not be read here `
    + `and ${unread.length === 1 ? 'was' : 'were'} not measured: ${unread.join(', ')}`);
}

const launch = process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {};
const browser = await chromium.launch(launch);
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });

let bad = 0;
for (const name of ['guidelines.html', 'deck.html', 'published.html', 'editor.html']) {
  const file = path.join(dir, name);
  if (!fs.existsSync(file)) continue;
  await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  // what each element asks to be set in, and what it sets
  const asked = await page.evaluate(() => {
    const out = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const s = n.textContent;
      if (!s.trim() || n.parentElement.closest('script,style,svg')) continue;
      const fam = getComputedStyle(n.parentElement).fontFamily.split(',')[0].trim().replace(/^['"]|['"]$/g, '');
      out.push([fam, s]);
    }
    return out;
  });
  // the faces this package declares are the ones it ships; anything else is a
  // system stack the engine names on purpose and is not the identity's face
  const declared = new Set((await page.evaluate(() =>
    [...document.fonts].map((f) => f.family.replace(/^['"]|['"]$/g, '')))));
  const missing = new Map();
  for (const [fam, text] of asked) {
    if (!declared.has(fam)) continue;
    for (const ch of text) {
      const c = ch.codePointAt(0);
      if (c < 0x80 || /\s/.test(ch)) continue;
      if (fonts.some((f) => f.covers.has(c))) continue;
      if (!missing.has(ch)) missing.set(ch, text.trim().slice(0, 40));
    }
  }
  if (!missing.size) {
    console.log(`  ok    ${name.padEnd(20)} every character is in a face this package ships`);
  } else {
    bad += missing.size;
    console.log(`  FAIL  ${name.padEnd(20)} ${missing.size} character${missing.size === 1 ? '' : 's'} no shipped face can draw`);
    for (const [ch, near] of [...missing].slice(0, 12)) {
      console.log(`          ${ch}  U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}  in "${near}"`);
    }
  }
}
await browser.close();
console.log(bad ? `\n${bad} characters are drawn by whatever the reader happens to have.`
  : '\nevery character on every page is drawn by a face this package ships.');
process.exit(bad ? 1 : 0);
