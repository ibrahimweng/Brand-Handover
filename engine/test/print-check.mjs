/* Does a page actually print at the size it claims?

   The CSS assertions in the suite check that the right @page rule is written.
   Only a real print settles whether the browser honours it, and named @page
   rules for a document that mixes sizes are exactly the sort of thing that
   works until it quietly does not. So this drives a browser, prints, and reads
   the MediaBox back out of the PDF.

   Kept out of `npm test` because it needs a browser, which the engine does not
   otherwise depend on. Run it whenever the print path changes:

     node test/print-check.mjs                       # playwright from ./node_modules
     PW_PATH=/where/playwright/lives node test/print-check.mjs
     PW_CHROMIUM=/path/to/chrome    node test/print-check.mjs
*/
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const M = require('../src/editor/model');
const { publish } = require('../src/editor/publish');
const projectLoader = require('../src/project');
const { measure } = require('../src/variants');
const { bundle, starterDoc } = require('../src/editor/bundle');

// ESM imports do not look at NODE_PATH, so resolve it the way a person would
let chromium;
try {
  const paths = [import.meta.dirname, process.cwd()].concat(process.env.PW_PATH ? [process.env.PW_PATH] : []);
  ({ chromium } = require(createRequire(import.meta.url).resolve('playwright', { paths })));
} catch {
  console.log('playwright is not installed, so nothing was printed.'
    + ' Install it, or point PW_PATH at a node_modules that has it.');
  process.exit(0);
}

const project = projectLoader.load(path.join(import.meta.dirname, '..', 'projects', 'meridian', 'project.json'));
const bu = bundle(project, measure(project), []);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-print-'));

const mm = (pt) => Number((pt / 72 * 25.4).toFixed(1));
const boxes = (file) =>
  [...fs.readFileSync(file, 'latin1').matchAll(/MediaBox\s*\[\s*[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)/g)]
    .map((m) => ({ w: mm(+m[1]), h: mm(+m[2]) }));

// what each named size should measure once it is on paper, in millimetres,
// including the bleed and the room the marks need
const PR = require('../src/print');
const expected = (key, bleedMm) => {
  const s = M.sheet(key);
  const f = { mm: 1, in: 25.4, px: 25.4 / 96 }[s.unit];
  const pad = bleedMm ? (bleedMm + PR.MARK_LENGTH_MM) : 0;
  return { w: Number((s.printW * f + pad * 2).toFixed(1)), h: Number((s.printH * f + pad * 2).toFixed(1)) };
};

const cases = [
  { name: 'every page A4', build: (d) => M.ops.setPageSize(d, null, 'a4'), want: (d) => d.pages.map(() => expected('a4')) },
  { name: 'every page a slide', build: () => {}, want: (d) => d.pages.map(() => expected('slide-16x9')) },
  { name: 'a document that mixes three sizes',
    build: (d) => { M.ops.setPageSize(d, d.pages[1].id, 'a4'); M.ops.setPageSize(d, d.pages[2].id, 'square'); },
    want: (d) => d.pages.map((p, i) => expected(i === 1 ? 'a4' : i === 2 ? 'square' : 'slide-16x9')) },
  // the sheet has to grow by the bleed and the marks, and each page still has
  // to be one page: a media box a fraction taller than its @page spills
  { name: 'A4 with 3 mm bleed and crop marks',
    build: (d) => { M.ops.setPageSize(d, null, 'a4'); M.ops.setBleed(d, 3); },
    want: (d) => d.pages.map(() => expected('a4', 3)) },
  { name: 'US Letter with 5 mm bleed',
    build: (d) => { M.ops.setPageSize(d, null, 'letter'); M.ops.setBleed(d, 5); },
    want: (d) => d.pages.map(() => expected('letter', 5)) },
  { name: 'bleed on a document that mixes sizes',
    build: (d) => { M.ops.setPageSize(d, null, 'a4'); M.ops.setPageSize(d, d.pages[2].id, 'square'); M.ops.setBleed(d, 3); },
    want: (d) => d.pages.map((p, i) => expected(i === 2 ? 'square' : 'a4', 3)) },
];

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const page = await browser.newPage();
let failed = 0;

for (const c of cases) {
  const doc = starterDoc(bu);
  c.build(doc);
  const html = path.join(dir, 'p.html'), pdf = path.join(dir, 'p.pdf');
  fs.writeFileSync(html, publish(doc, bu, { title: 'print check', builtAt: 'fixed' }));
  await page.goto('file://' + html);
  await page.waitForTimeout(400);
  await page.pdf({ path: pdf, preferCSSPageSize: true, printBackground: true });

  const got = boxes(pdf), want = c.want(doc);
  const near = (a, b) => Math.abs(a - b) <= 0.3;          // the printer rounds to points
  let ok = got.length === want.length && got.every((g, i) => near(g.w, want[i].w) && near(g.h, want[i].h));
  // and when there is bleed, the marks have to have been drawn
  const wantsMarks = M.printSpec(doc).bleed > 0;
  const marksDrawn = await page.locator('svg.hp-marks').count();
  const marksOk = wantsMarks ? marksDrawn === doc.pages.length : marksDrawn === 0;
  if (!marksOk) ok = false;
  const show = (l) => l.map((x) => `${x.w}×${x.h}`).join('  ');
  console.log(`  ${ok ? 'ok   ' : 'FAIL '} ${c.name}\n        ${show(got)}`
    + (wantsMarks ? `  ·  ${marksDrawn} sets of marks` : '')
    + (ok ? '' : `\n        wanted ${show(want)}${marksOk ? '' : `, and ${wantsMarks ? doc.pages.length : 0} sets of marks`}`));
  if (!ok) failed++;
}

await browser.close();
fs.rmSync(dir, { recursive: true, force: true });
console.log(failed ? `\n${failed} failed\n` : '\nprinted at the right size every time\n');
process.exit(failed ? 1 : 0);
