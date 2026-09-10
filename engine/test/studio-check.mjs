/* Does the studio in the package actually work?

   pattern-studio.html is a claim that a client can keep making the pattern
   after the handover: open one file, offline, and get the same generators the
   build ran with the parameters the build chose. Every part of that is
   checkable and none of it is checkable by reading the source.

   So it is opened in a real browser and used: switch generator, move a slider,
   change colourway, keep one, reload, and see whether what comes back is what
   was kept. Along the way, three things that would make the claim false —
   anything fetched from a network, anything thrown, and a tile drawn on the
   screen that differs from the tile the build wrote to 07-pattern.

     node test/studio-check.mjs                       # builds one and drives it
     PW_PATH=/where/playwright/lives node test/studio-check.mjs
*/
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
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

const projectLoader = require('../src/project');
const { measure } = require('../src/variants');
const { build } = require('../src/build');

const name = process.argv[2] || 'kvist';
const project = projectLoader.load(path.join(import.meta.dirname, '..', 'projects', name, 'project.json'));
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-check-'));
await build(project, out);
const file = path.join(out, 'pattern-studio.html');
if (!fs.existsSync(file)) { console.log(`${name} built no pattern-studio.html.`); process.exit(2); }

const launch = process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {};
const browser = await chromium.launch(launch);
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [], outbound = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
page.on('request', (r) => { if (!/^(file|data|blob):/.test(r.url())) outbound.push(r.url()); });
await page.goto(pathToFileURL(file).href);
await page.waitForTimeout(700);

let bad = 0, asked = 0;
const check = (label, pass, detail) => {
  asked++;
  console.log(`  ${pass ? 'ok  ' : 'FAIL'}  ${label}${pass || !detail ? '' : `\n          ${detail}`}`);
  if (!pass) bad++;
};

console.log(`\n${project.brand}, in a browser\n`);

const first = await page.evaluate(() => ({
  gens: [...document.querySelectorAll('#gens .chip')].map((b) => b.textContent),
  on: [...document.querySelectorAll('#gens .chip.on')].map((b) => b.textContent)[0],
  ctls: document.querySelectorAll('#controls .ctl').length,
  ways: [...document.querySelectorAll('#ways .chip')].map((b) => b.textContent),
  shapes: document.querySelectorAll('#one svg rect, #one svg path').length,
  why: document.getElementById('why').textContent,
  holds: document.getElementById('holds').textContent,
  tile: document.getElementById('one').innerHTML,
}));

const NAMES = require('../src/patterns').NAMES;
check('it offers every generator the engine has', first.gens.join(',') === NAMES.join(','),
  `it offered ${first.gens.join(', ')} and the engine has ${NAMES.join(', ')}`);
check('it opens on the one the measurements chose',
  first.on === JSON.parse(fs.readFileSync(path.join(out, 'brand.json'), 'utf8')).system.patterns.chose,
  `it opened on ${first.on}`);
check('it offers every colourway the project declares',
  first.ways.length === project.rules.colourways.length,
  `${first.ways.length} against ${project.rules.colourways.length}`);
check('it drew a tile', first.shapes > 2, `${first.shapes} shapes`);
check('it says why that pattern, in words', first.why.length > 40, first.why);
check('it says the size the pattern holds from', /holds from|Holds from/i.test(first.holds), first.holds);

// The tile on screen is the tile in the folder. Two drawings of one pattern is
// the fault the surface contract exists to prevent, and this is where it would
// show up: the build drew through the recorder in Node, the studio through the
// same recorder in a browser.
const bj = JSON.parse(fs.readFileSync(path.join(out, 'brand.json'), 'utf8'));
const madeFirst = bj.system.patterns.made.find((m) => m.generator === first.on);
const onDisk = fs.readFileSync(path.join(out, madeFirst.file), 'utf8');
const shapesOnDisk = (onDisk.match(/<(rect|path)\b/g) || []).length;
check('the tile on screen is the tile in the folder', first.shapes === shapesOnDisk,
  `${first.shapes} shapes on screen against ${shapesOnDisk} in ${madeFirst.file}`);

// switching generator rebuilds the controls and draws something else
await page.click('#gens .chip:nth-child(2)');
await page.waitForTimeout(250);
const second = await page.evaluate(() => ({
  ctls: document.querySelectorAll('#controls .ctl').length,
  tile: document.getElementById('one').innerHTML,
  why: document.getElementById('why').textContent,
  code: document.getElementById('code').textContent,
}));
check('switching generator rebuilds its controls', second.ctls !== first.ctls || second.why !== first.why,
  `${first.ctls} controls before and ${second.ctls} after`);
check('and draws a different pattern', second.tile !== first.tile);
// It has to draw a pattern that generator *has*. Carrying the old parameters
// across leaves the new generator holding a style it does not own — weave's
// "plaid" handed to zigzag, which falls through to a straight stripe and looks
// deliberate. "Draws something different" passes that, so it is not enough.
const chosen = JSON.parse(second.code);
const gStyles = require('../src/patterns').GENERATORS[chosen.generator].styles;
check('and the parameters belong to the generator now showing',
  gStyles.indexOf(chosen.params.style) > -1,
  `${chosen.generator} was given the style "${chosen.params.style}", which is ${gStyles.join(', ')} short`);
const wanted = require('../src/patterns').GENERATORS[chosen.generator].controls
  .filter((c) => c.type !== 'seed').map((c) => c.key).sort();
const has = Object.keys(chosen.params).filter((k) => k !== 'seed').sort();
check('and every control that generator has, and no other',
  JSON.stringify(wanted) === JSON.stringify(has),
  `it holds ${has.join(', ')} where ${chosen.generator} wants ${wanted.join(', ')}`);

// a slider changes the drawing
await page.evaluate(() => {
  const r = document.querySelector('#controls input[type=range]');
  r.value = String(Number(r.min) + (Number(r.max) - Number(r.min)) * 0.75);
  r.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.waitForTimeout(250);
const moved = await page.evaluate(() => document.getElementById('one').innerHTML);
check('moving a control changes the tile', moved !== second.tile);

// a colourway changes the colours and nothing else
const before = await page.evaluate(() => document.getElementById('one').innerHTML);
if (first.ways.length > 1) {
  await page.click('#ways .chip:nth-child(2)');
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => document.getElementById('one').innerHTML);
  const shapesOf = (h) => (h.match(/<(rect|path)\b/g) || []).length;
  check('a colourway repaints the same shapes', after !== before && shapesOf(after) === shapesOf(before),
    `${shapesOf(before)} shapes before and ${shapesOf(after)} after`);
}

// keeping one survives a reload
await page.click('#keepit');
await page.waitForTimeout(200);
const keptTile = await page.evaluate(() => document.getElementById('one').innerHTML);
await page.reload();
await page.waitForTimeout(700);
const back = await page.evaluate(() => ({
  kept: document.querySelectorAll('#kept .keptone').length,
  tile: document.getElementById('one').innerHTML,
}));
check('a pattern kept survives closing the file', back.kept >= 1, `${back.kept} kept`);
check('and it reopens on what was being worked on', back.tile === keptTile);

// back to what the engine chose
await page.click('#revert');
await page.waitForTimeout(250);
const reverted = await page.evaluate(() => document.getElementById('code').textContent);
const asBuilt = bj.system.patterns.made.find((m) => m.generator === JSON.parse(reverted).generator);
check('"back to what the engine chose" returns the engine\'s parameters',
  JSON.stringify(JSON.parse(reverted).params) === JSON.stringify(asBuilt.params),
  `${JSON.parse(reverted).params && JSON.stringify(JSON.parse(reverted).params)} against ${JSON.stringify(asBuilt.params)}`);

check('it asked the network for nothing', outbound.length === 0, outbound.join(', '));
check('it threw nothing', errors.length === 0, errors.join('\n          '));

console.log(`\n  ${asked} things measured, ${bad} of them wrong\n`);
await browser.close();
fs.rmSync(out, { recursive: true, force: true });
process.exit(bad ? 1 : 0);
