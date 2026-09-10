/* What a drawing actually does at the size the package says it holds at.

   Every package states a smallest usable size — in the manual, in the read me
   once per folder, and in the warning about app icons. src/geometry.js works it
   out by dividing the box by the narrowest run of ink in the drawing, which is
   one number about one place. On a shape that comes to a point that is a
   measurement of the pixel grid rather than of the artwork: a plain triangle
   comes out of it needing 3600 px on screen and 1012 mm in print.

   This asks the question the floor is for, of the whole drawing: rendered this
   big, what share of the ink is thinner than the rule the project states? See
   src/thickness.js — it is an opening with a disc, so a tapering tip costs
   almost nothing and a hairline across the mark costs everything.

   A drawing with a stem in it falls off a cliff. A drawing that only tapers
   does not, and a floor read off its thinnest place is a number about nothing.

     node test/floor-check.mjs                  # every identity here
     node test/floor-check.mjs meridian kvist   # just these

   It reports. It does not decide: the floor is still stated by geometry.js.
*/
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const T = require('../src/thickness');
const projectLoader = require('../src/project');
const { measure, floors } = require('../src/variants');
const { buildVariant } = require('../src/variants');
const svgu = require('../src/svg');

const DIR = path.join(import.meta.dirname, '..', 'projects');
const only = process.argv.slice(2);
const names = fs.readdirSync(DIR)
  .filter((d) => fs.existsSync(path.join(DIR, d, 'project.json')))
  .filter((d) => !only.length || only.includes(d))
  .sort();
if (!names.length) { console.log('no projects to measure.'); process.exit(2); }

// The sizes worth asking about: every screen size anybody uses a logo at, and
// then some, spaced so that a cliff between two of them is a real cliff.
const SIZES = [8, 10, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128, 160, 192,
  256, 320, 384, 512, 640, 768, 1024, 1536, 2048, 3072, 4096];
// A drawing holds when almost none of its ink is under the rule. Not zero: a
// tip tapers to nothing at any size, and a corner is a tip.
const HOLDS = 0.02;

const pc = (x) => `${(x * 100).toFixed(x >= 0.1 ? 0 : 1)}%`;
const rows = [];

for (const name of names) {
  const p = projectLoader.load(path.join(DIR, name, 'project.json'));
  const m = measure(p);
  const fl = floors(p, m);
  const master = p.assets[p.master || (p.assets.mark ? 'mark' : 'wordmark')].source;
  const drawings = [['master', master, m.minimumSize]];
  for (const lockup of p.rules.lockups) {
    const v = buildVariant({ markSrc: p.assets.mark && p.assets.mark.source,
      wordmarkSrc: p.assets.wordmark && p.assets.wordmark.source,
      lockup, colourway: p.rules.colourways[0], rules: p.rules, measured: m });
    drawings.push([lockup, v.svg, fl[lockup]]);
  }
  for (const [what, svg, stated] of drawings) {
    if (!stated || stated.screenPx == null) continue;
    const box = svgu.viewBox(svgu.parse(svg)).w;
    let held;
    try { held = T.holdsFrom(svg, box, p.rules.minStrokePx, HOLDS, SIZES); }
    catch (e) { console.log(`  ERR  ${name}/${what}: ${e.message}`); continue; }
    // what the drawing does at the size the package prints, off the same render
    const atStated = T.atWidth(held.drawing, stated.screenPx, p.rules.minStrokePx).share;
    rows.push({ id: `${name}/${what}`, stated: stated.screenPx, stem: stated.thinnestStroke,
      from: stated.from, atStated, holds: held.at });
  }
}

console.log('\nwhat the drawing does at the size the package states');
console.log('  identity/drawing          states   its ink under the rule there    holds from');
for (const r of rows) {
  console.log(`  ${r.id.padEnd(24)} ${String(r.stated).padStart(6)} px ${pc(r.atStated).padStart(24)}`
    + ` ${String(r.holds == null ? 'never' : `${r.holds} px`).padStart(12)}`);
}

// A stated floor is short where the drawing does not hold there — nobody has
// found one of those yet — and generous where the drawing holds far below it.
// Generous is not free: it is the number the manual prints, the number the read
// me repeats per folder, and the number the icon warning is worked out from,
// so it is the difference between "your app icons will read" and "this artwork
// needs 3671 px square".
const short = rows.filter((r) => r.atStated > HOLDS);
const off = rows.filter((r) => r.holds != null && r.stated >= r.holds * 2)
  .sort((a, b) => (b.stated / b.holds) - (a.stated / a.holds));
console.log(`\n${rows.length} drawings measured, against the size each one's package states`);
console.log(`  ${short.length} state a size at which more than ${pc(HOLDS)} of their ink is under the rule`);
for (const r of short) {
  console.log(`      ${r.id.padEnd(24)} says ${String(r.stated).padStart(5)} px and `
    + `${pc(r.atStated)} of its ink is under the rule there`);
}
console.log(`  ${off.length} state a size at least twice the size they hold from`);
for (const r of off) {
  console.log(`      ${r.id.padEnd(24)} says ${String(r.stated).padStart(5)} px, holds from `
    + `${String(r.holds).padStart(4)} px — ${(r.stated / r.holds).toFixed(1)}x — `
    + `stem ${r.stem} off the ${r.from}`);
}
const ratios = rows.filter((r) => r.holds != null).map((r) => r.stated / r.holds).sort((a, b) => a - b);
if (ratios.length) {
  console.log(`\n  stated against measured: median ${ratios[Math.floor(ratios.length / 2)].toFixed(2)}x, `
    + `worst ${ratios[ratios.length - 1].toFixed(1)}x`);
}
console.log('');
