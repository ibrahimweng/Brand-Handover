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
const queue = [];
function test(name, fn) { queue.push({ name, fn }); }
function before(fn) { queue.push({ setup: fn }); }
async function drain() {
  for (const item of queue) {
    if (item.setup) { await item.setup(); continue; }
    try { await item.fn(); console.log(`  ok    ${item.name}`); passed++; }
    catch (e) { console.log(`  FAIL  ${item.name}\n        ${e.message}`); failed++; }
  }
}

const PROJECT = path.join(__dirname, '..', 'projects', 'meridian', 'project.json');
const project = projectLoader.load(PROJECT);
const m = measure(project);

// headings print as the queue is built, so they stay in order with the results
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
let result;
before(async () => { result = await build(project, out); });
test('the file count is exactly what the rules ask for', () => {
  const r = project.rules;
  const perVariant = ['svg', 'pdf', 'ai'].filter((f) => r.formats.includes(f)).length
    + (r.formats.includes('png') ? r.pngWidths.length : 0);
  const expected =
      r.lockups.length * r.colourways.length * perVariant   // every lockup in every colourway
    + (r.iconSizes || []).length                            // app and touch icons
    + (r.faviconSizes || []).length + ((r.faviconSizes || []).length ? 1 : 0)  // favicons plus the .ico
    + Object.keys(r.social || {}).length                    // social crops
    + 2                                                     // brand.json and README.txt
    + (r.documents === false ? 0 : 2)                       // the manual and the deck
    + (r.zip === false ? 0 : 1);                            // the package itself
  assert.strictEqual(result.written.length, expected, `expected ${expected} files, got ${result.written.length}`);
});
test('the package holds a true vector PDF, and the .ai is the same bytes', () => {
  const pdf = fs.readFileSync(path.join(out, '03-mark', 'meridian-mark-deep.pdf'));
  const ai = fs.readFileSync(path.join(out, '03-mark', 'meridian-mark-deep.ai'));
  assert.strictEqual(pdf.slice(0, 5).toString(), '%PDF-', 'not a PDF');
  assert.ok(!/\/Subtype\s*\/Image/.test(pdf.toString('latin1')), 'the PDF was rasterised');
  assert.strictEqual(Buffer.compare(pdf, ai), 0, 'the .ai should be the same PDF bytes');
});
test('the favicon is a valid multi-size ico', () => {
  const ico = fs.readFileSync(path.join(out, '05-icons', 'favicon.ico'));
  assert.strictEqual(ico.readUInt16LE(0), 0, 'bad ico reserved field');
  assert.strictEqual(ico.readUInt16LE(2), 1, 'bad ico type');
  assert.strictEqual(ico.readUInt16LE(4), project.rules.faviconSizes.length, 'wrong number of images');
});
test('the zip contains the whole package', async () => {
  const JSZip = require('jszip');
  const name = fs.readdirSync(out).find((f) => f.endsWith('.zip'));
  const z = await JSZip.loadAsync(fs.readFileSync(path.join(out, name)));
  const inZip = Object.keys(z.files).filter((f) => !z.files[f].dir).length;
  assert.strictEqual(inZip, result.written.length - 1, 'the zip is missing files');
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

// ---------------------------------------------------------------- normaliser
const { normalise, preClean, hex, distance } = require('../src/normalise');
const { format } = require('../src/report');
const fx = (n) => fs.readFileSync(path.join(__dirname, 'fixtures', n), 'utf8');
const tokens = JSON.parse(fs.readFileSync(PROJECT, 'utf8')).tokens;

console.log('\nreading colour');
test('hex forms all normalise to one', () => {
  assert.strictEqual(hex('#0a2a33'), '#0A2A33');
  assert.strictEqual(hex('#abc'), '#AABBCC');
  assert.strictEqual(hex('rgb(10, 42, 51)'), '#0A2A33');
  assert.strictEqual(hex('none'), null);
});
test('near colours measure near, far colours measure far', () => {
  assert.ok(distance('#0A2A33', '#0B2A34') < 3);
  assert.ok(distance('#0A2A33', '#F2A007') > 200);
});

console.log('\nrefusing artwork that cannot work');
for (const [file, code, why] of [
  ['has-live-text.svg', 'live-text', 'live type would render in the wrong font'],
  ['has-raster.svg', 'raster', 'an embedded photo cannot be scaled'],
  ['no-viewbox.svg', 'no-viewbox', 'artwork with no size cannot be measured'],
]) {
  test(`${file} is refused because ${why}`, () => {
    const r = normalise(fx(file), { tokens });
    assert.strictEqual(r.ok, false);
    assert.ok(r.findings.some((f) => f.level === 'blocker' && f.code === code), `expected a ${code} blocker`);
    assert.strictEqual(r.svg, null, 'nothing should be produced from unusable artwork');
  });
}
test('every blocker tells the designer what to do about it', () => {
  for (const file of ['has-live-text.svg', 'has-raster.svg', 'no-viewbox.svg']) {
    for (const f of normalise(fx(file), { tokens }).findings.filter((x) => x.level === 'blocker')) {
      assert.ok(f.why && f.how, `${f.code} has no explanation or no remedy`);
    }
  }
});

console.log('\ncleaning a real export');
const dirty = normalise(fx('messy-illustrator.svg'), { tokens });
test('an Illustrator export with undeclared entities still parses', () => {
  assert.ok(preClean(fx('messy-illustrator.svg')).removed > 0, 'the metadata block should be stripped');
  assert.strictEqual(dirty.ok, true);
});
test('nested transforms are flattened and the stroke is rescaled with them', () => {
  // the fixture draws stroke-width 4.5 inside scale(2), so it must come out as 9
  assert.ok(!/transform=/.test(dirty.svg), 'no transform should survive');
  assert.strictEqual(svgu.thinnestStroke(svgu.parse(dirty.svg)), 9);
});
test('a colour one step off the palette is snapped to it', () => {
  assert.ok(dirty.svg.includes('#0A2A33'));
  assert.ok(!dirty.svg.includes('#0B2A34'), 'the near-miss colour should be gone');
  assert.ok(dirty.findings.some((f) => f.code === 'colour-snapped'));
});
test('colour slots are assigned so colourways have something to repaint', () => {
  assert.deepStrictEqual(dirty.slots, ['ink']);
  assert.ok(dirty.svg.includes('data-slot="ink"'));
});
test('hidden layers and zero-size leftovers are dropped', () => {
  assert.ok(!dirty.svg.includes('#FF00FF'), 'the hidden layer should not survive');
  assert.ok(dirty.findings.some((f) => f.code === 'leftovers'));
});
test('a dirty export measures exactly the same as the clean master', () => {
  const a = geo.inkBox(project.assets.mark.source), b = geo.inkBox(dirty.svg);
  assert.deepStrictEqual({ w: b.w, h: b.h }, { w: a.w, h: a.h });
  const rules = { minStrokePx: 2.4, minStrokeMm: 0.675 };
  assert.deepStrictEqual(
    geo.minimumSize(dirty.svg, rules).screenPx,
    geo.minimumSize(project.assets.mark.source, rules).screenPx);
});
test('normalising clean artwork does not change what it measures', () => {
  const again = normalise(project.assets.mark.source, { tokens });
  assert.strictEqual(again.ok, true);
  assert.deepStrictEqual(geo.inkBox(again.svg), geo.inkBox(project.assets.mark.source));
});

console.log('\nthe report');
test('a clean file says so instead of printing an empty list', () => {
  assert.match(format([], { name: 'x.svg' }), /is clean/);
});
test('blockers are listed before warnings, and the report says nothing was built', () => {
  const out = format(normalise(fx('has-live-text.svg'), { tokens }).findings, { name: 'x.svg' });
  assert.match(out, /Must fix before this can be used/);
  assert.match(out, /Nothing was built/);
});
test('the report wraps rather than running off the terminal', () => {
  const out = format(normalise(fx('messy-illustrator.svg'), { tokens }).findings, { name: 'x.svg', width: 76 });
  const tooLong = out.split('\n').filter((l) => l.length > 78);
  assert.deepStrictEqual(tooLong, [], 'some lines are too wide');
});

// ------------------------------------------------------- packager and documents
const contrast = require('../src/contrast');
const docs = require('../src/documents');
const { deck } = require('../src/documents/deck');

console.log('\ncontrast');
test('ratios match the published figures', () => {
  assert.strictEqual(contrast.ratio('#0A2A33', '#EFEDE4'), 12.86);
  assert.strictEqual(contrast.ratio('#1E7A8C', '#EFEDE4'), 4.24);
  assert.strictEqual(contrast.ratio('#F2A007', '#EFEDE4'), 1.83);
});
test('a failure is reported as a failure', () => {
  assert.strictEqual(contrast.verdict(contrast.ratio('#F2A007', '#EFEDE4')).level, 'fail');
  assert.strictEqual(contrast.verdict(contrast.ratio('#1E7A8C', '#EFEDE4')).level, 'AA-large');
});
test('cmyk converts and black stays black', () => {
  assert.deepStrictEqual(contrast.cmyk('#000000'), [0, 0, 0, 100]);
  assert.deepStrictEqual(contrast.cmyk('#FFFFFF'), [0, 0, 0, 0]);
});

console.log('\nthe package');
const out2 = fs.mkdtempSync(path.join(os.tmpdir(), 'handover2-'));
let full;
before(async () => { full = await build(project, out2); });

console.log('\ndocuments');
test('both documents are written', () => {
  assert.ok(fs.existsSync(path.join(out2, 'guidelines.html')));
  assert.ok(fs.existsSync(path.join(out2, 'deck.html')));
});
test('the documents carry the measured numbers, not typed ones', () => {
  const g = fs.readFileSync(path.join(out2, 'guidelines.html'), 'utf8');
  assert.ok(g.includes(String(m.minimumSize.screenPx)), 'the measured floor is missing');
  assert.ok(g.includes(String(m.clearSpace)), 'the measured clear space is missing');
  assert.ok(g.includes('12.86'), 'the computed contrast is missing');
});
test('the deck holds less text per section than the manual', () => {
  const g = fs.readFileSync(path.join(out2, 'guidelines.html'), 'utf8').replace(/<[^>]+>/g, ' ');
  const d = fs.readFileSync(path.join(out2, 'deck.html'), 'utf8').replace(/<[^>]+>/g, ' ');
  assert.ok(d.length < g.length, 'the deck should be the shorter document, not a reflow of the manual');
});
test('a diagram block styles its own text rather than borrowing the page stylesheet', () => {
  const blocks = require('../src/documents/blocks');
  const ctx = docs.context(project, m, [{ path: 'x.svg', bytes: 1 }], {});
  for (const svg of [blocks.construction(ctx), blocks.clearSpace(ctx)]) {
    const texts = svg.match(/<text[^>]*>/g) || [];
    assert.ok(texts.length, 'the diagram has no labels');
    for (const t of texts) assert.match(t, /font-size=/, 'a diagram label depends on the host stylesheet');
  }
});
test('a diagram draws in the ink colour it is given', () => {
  const blocks = require('../src/documents/blocks');
  const ctx = docs.context(project, m, [], {});
  assert.ok(blocks.clearSpace(ctx, { ink: '#FF0000' }).includes('#FF0000'),
    'the block ignored the ink colour, so it would vanish on a dark slide');
});

console.log('\nregenerating from a changed master');
test('thickening the stroke moves the floor everywhere at once', async () => {
  const thick = project.assets.mark.source.replace('stroke-width="9"', 'stroke-width="14"');
  const altered = Object.assign({}, project, {
    assets: Object.assign({}, project.assets, { mark: Object.assign({}, project.assets.mark, { source: thick }) }),
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover3-'));
  const r = await build(altered, dir);
  const bj = JSON.parse(fs.readFileSync(path.join(dir, 'brand.json'), 'utf8'));
  assert.notStrictEqual(bj.logo.minSize.screenPx, m.minimumSize.screenPx, 'the floor did not move');
  const g = fs.readFileSync(path.join(dir, 'guidelines.html'), 'utf8');
  assert.ok(g.includes(String(bj.logo.minSize.screenPx)), 'the manual still shows the old floor');
  const d = fs.readFileSync(path.join(dir, 'deck.html'), 'utf8');
  assert.ok(d.includes(String(bj.logo.minSize.screenPx)), 'the deck still shows the old floor');
  fs.rmSync(dir, { recursive: true, force: true });
});

drain().then(() => {
  for (const d of [out, out2]) fs.rmSync(d, { recursive: true, force: true });
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
});
