'use strict';
// A small runner, so the engine has no test-framework dependency.
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const projectLoader = require('../src/project');
const svgu = require('../src/svg');
const geo = require('../src/geometry');
const naming = require('../src/naming');
const { measure, buildVariant } = require('../src/variants');
const { build } = require('../src/build');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ok    ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}

const PROJECT = path.join(__dirname, '..', 'projects', 'meridian', 'project.json');
const project = projectLoader.load(PROJECT);
const m = measure(project);

console.log('\nmeasuring the master');
test('the ink box is the ring plus its stroke, not the viewBox', () => {
  // circle r=50 with a 9 wide stroke paints out to 54.5 from centre, so 109 across
  assert.strictEqual(m.markInk.w, 109);
  assert.strictEqual(m.markInk.h, 109);
});
test('the thinnest painted stroke is found', () => assert.strictEqual(m.minimumSize.thinnestStroke, 9));
test('the minimum size is derived from that stroke', () => {
  assert.strictEqual(m.minimumSize.screenPx, 32);   // 120/9 * 2.4
  assert.strictEqual(m.minimumSize.printMm, 9);     // 120/9 * 0.675
});
test('minimum size moves when the rule moves', () => {
  const loose = geo.minimumSize(project.assets.mark.source, { minStrokePx: 1.2, minStrokeMm: 0.675 });
  assert.strictEqual(loose.screenPx, 16, 'halving the stroke floor should halve the minimum size');
});
test('clear space is a fraction of measured ink height', () => {
  assert.strictEqual(m.clearSpace, svgu.round(m.markInk.h * project.rules.clearSpaceRatio));
});
test('the colour slots in the artwork are found', () => assert.deepStrictEqual(m.slots, ['ink']));

console.log('\nbuilding variants');
const variantOf = (lockup, cw) => buildVariant({
  markSrc: project.assets.mark.source,
  wordmarkSrc: project.assets.wordmark.source,
  lockup, colourway: project.rules.colourways.find((c) => c.name === cw),
  rules: project.rules, measured: m,
});
test('a colourway actually repaints the artwork', () => {
  const deep = variantOf('mark', 'deep').svg, tide = variantOf('mark', 'tide').svg;
  assert.ok(deep.includes('#0A2A33'), 'deep variant should carry the deep hex');
  assert.ok(tide.includes('#1E7A8C'), 'tide variant should carry the tide hex');
  assert.ok(!tide.includes('#0A2A33'), 'tide variant should not still carry the deep hex');
});
test('fill="none" survives recolouring', () => {
  assert.ok(variantOf('mark', 'tide').svg.includes('fill="none"'), 'the ring must stay unfilled');
});
test('the horizontal lockup is wider than it is tall', () => {
  const b = variantOf('horizontal', 'deep').box;
  assert.ok(b.w > b.h * 1.5, `expected a wide lockup, got ${b.w} x ${b.h}`);
});
test('the stacked lockup is taller than the mark alone', () => {
  assert.ok(variantOf('stacked', 'deep').box.h > m.markInk.h);
});
test('the wordmark is scaled off the mark, not left at its own size', () => {
  const h = variantOf('horizontal', 'deep');
  assert.ok(h.box.h <= m.markInk.h + 0.01, 'a horizontal lockup should be no taller than the mark');
});
test('a colourway missing a slot is reported rather than silently skipped', () => {
  const v = buildVariant({
    markSrc: project.assets.mark.source, wordmarkSrc: project.assets.wordmark.source,
    lockup: 'mark', colourway: { name: 'broken', slots: {} }, rules: project.rules, measured: m,
  });
  assert.deepStrictEqual(v.missing, ['ink']);
});
test('an unknown lockup fails loudly', () => {
  assert.throws(() => variantOf('diagonal', 'deep'), /does not know how to build/);
});

console.log('\nnaming');
test('file names carry no spaces or capitals', () => {
  const n = naming.fileName('{brand}-{lockup}-{colourway}', { brand: 'Meridian Energy', lockup: 'Horizontal', colourway: 'Deep' });
  assert.strictEqual(n, 'meridian-energy-horizontal-deep');
});
test('a naming pattern asking for something undefined fails loudly', () => {
  assert.throws(() => naming.fileName('{brand}-{missing}', { brand: 'x' }), /does not define/);
});

console.log('\nthe whole package');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-'));
const result = build(project, out);
test('the file count is exactly what the rules ask for', () => {
  const perVariant = 1 + project.rules.pngWidths.length;
  const expected = project.rules.lockups.length * project.rules.colourways.length * perVariant + 2; // + brand.json + README
  assert.strictEqual(result.written.length, expected, `expected ${expected} files`);
});
test('no warnings for a complete project', () => assert.deepStrictEqual(result.warnings, []));
test('every written file has content', () => {
  const empty = result.written.filter((f) => f.bytes === 0);
  assert.deepStrictEqual(empty, [], 'some files were written empty');
});
test('brand.json carries the measured numbers, not the typed ones', () => {
  const bj = JSON.parse(fs.readFileSync(path.join(out, 'brand.json'), 'utf8'));
  assert.strictEqual(bj.logo.minSize.screenPx, 32);
  assert.strictEqual(bj.logo.clearSpaceUnits, m.clearSpace);
});
test('a rendered PNG actually contains the colourway', () => {
  const png = fs.readFileSync(path.join(out, '03-mark', 'meridian-mark-tide-512.png'));
  assert.ok(png.length > 1000, 'the PNG looks empty');
  const { Resvg } = require('@resvg/resvg-js');
  const img = new Resvg(variantOf('mark', 'tide').svg, { fitTo: { mode: 'width', value: 64 } }).render();
  let found = false;
  for (let i = 0; i < img.pixels.length; i += 4) {
    if (img.pixels[i + 3] > 200 && img.pixels[i] === 0x1e && img.pixels[i + 1] === 0x7a && img.pixels[i + 2] === 0x8c) { found = true; break; }
  }
  assert.ok(found, 'no Tide-coloured pixel found in the rendered mark');
});
fs.rmSync(out, { recursive: true, force: true });

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
