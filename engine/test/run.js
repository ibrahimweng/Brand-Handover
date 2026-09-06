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
test('the separator in the pattern is the project\'s, and is kept', () => {
  // regression, found by running a second project through: the whole assembled
  // name was slugged at the end, so every separator became a hyphen and a
  // studio's own convention was quietly overruled
  assert.strictEqual(
    naming.fileName('{brand}_{colourway}_{lockup}', { brand: 'Halyard', colourway: 'Full', lockup: 'Horizontal' }),
    'halyard_full_horizontal');
  assert.strictEqual(
    naming.fileName('{brand}.{lockup}', { brand: 'Halyard', lockup: 'Mark' }), 'halyard.mark');
  // and a part with a space in it is still made safe
  assert.strictEqual(
    naming.fileName('{brand}_{colourway}', { brand: 'Halyard', colourway: 'Bone White' }), 'halyard_bone-white');
});
test('a naming pattern asking for something undefined fails loudly', () => {
  assert.throws(() => naming.fileName('{brand}-{missing}', { brand: 'x' }), /does not define/);
});

console.log('\nthe whole package');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-'));
let result;
before(async () => { result = await build(project, out); });
// A rule block is set once and generates every instance, so its file count is
// arithmetic too: one tile per density per colourway, less any the contrast
// check refused.
function patternTiles() {
  const dens = Object.keys(require('../src/system').patternRules((project.system || {}).pattern).densities).length;
  const refused = result.warnings.filter((w) => /^pattern .+ was not written/.test(w)).length;
  return dens * project.rules.colourways.length - refused;
}
test('the file count is exactly what the rules ask for', () => {
  const r = project.rules;
  const perVariant = ['svg', 'pdf', 'ai'].filter((f) => r.formats.includes(f)).length
    + (r.formats.includes('png') ? r.pngWidths.length : 0);
  const expected =
      r.lockups.length * r.colourways.length * perVariant   // every lockup in every colourway
    + (r.iconSizes || []).length                            // app and touch icons
    + (r.faviconSizes || []).length + ((r.faviconSizes || []).length ? 1 : 0)  // favicons plus the .ico
    + Object.keys(r.social || {}).length                    // social crops
    + patternTiles()                                        // the pattern, at every density, in every colourway
    + 4                                                     // brand.json, README.txt, LICENCE.txt and usage.json
    + (r.documents === false ? 0 : 5)                       // manual, deck, editor, document.json, published.html
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

// ----------------------------------------------------------------- editor
const EM = require('../src/editor/model');
const ER = require('../src/editor/render');
const { bundle, starterDoc } = require('../src/editor/bundle');
const { editorHtml } = require('../src/editor/emit');
const bu = bundle(project, m, [{ path: '01-horizontal/a.svg', bytes: 1 }, { path: 'brand.json', bytes: 2 }]);
const bundleOf = (p, mm) => bundle(p, mm, []);

console.log('\nthe document model');
test('every block type has a size and a default', () => {
  for (const t of EM.KINDS) {
    assert.ok(EM.SIZES[t], `${t} has no default size`);
    assert.ok(EM.DEFAULTS[t], `${t} has no default props`);
  }
});
test('a block is either plain or derived, never both', () => {
  const overlap = EM.PLAIN.filter((t) => EM.DERIVED.includes(t));
  assert.deepStrictEqual(overlap, []);
  assert.strictEqual(EM.kindOf('text'), 'plain');
  assert.strictEqual(EM.kindOf('contrast'), 'derived');
});
test('an unknown block type is refused', () => {
  assert.throws(() => EM.makeBlock('pen'), /there is no block called/);
});
test('moving snaps to the grid, and alt-dragging (grid 0) does not', () => {
  const h = EM.history(EM.emptyDoc());
  const pid = h.get().pages[0].id;
  let id; h.apply((d) => { id = EM.ops.addBlock(d, pid, 'text', { x: 0, y: 0 }); });
  h.apply((d) => EM.ops.moveBlocks(d, pid, [id], 7, 11, 8));
  assert.deepStrictEqual([h.get().pages[0].blocks[0].x, h.get().pages[0].blocks[0].y], [8, 8]);
  h.apply((d) => EM.ops.moveBlocks(d, pid, [id], 3, 3, 0));
  assert.deepStrictEqual([h.get().pages[0].blocks[0].x, h.get().pages[0].blocks[0].y], [11, 11]);
});
test('undo and redo walk the whole history', () => {
  const h = EM.history(EM.emptyDoc());
  const pid = h.get().pages[0].id;
  for (const t of ['text', 'rule', 'mark']) h.apply((d) => EM.ops.addBlock(d, pid, t));
  assert.strictEqual(h.get().pages[0].blocks.length, 3);
  h.undo(); h.undo();
  assert.strictEqual(h.get().pages[0].blocks.length, 1);
  h.redo();
  assert.strictEqual(h.get().pages[0].blocks.length, 2);
  assert.ok(h.canUndo() && h.canRedo());
});
test('a new change clears the redo branch', () => {
  const h = EM.history(EM.emptyDoc());
  const pid = h.get().pages[0].id;
  h.apply((d) => EM.ops.addBlock(d, pid, 'text'));
  h.undo();
  h.apply((d) => EM.ops.addBlock(d, pid, 'rule'));
  assert.strictEqual(h.canRedo(), false, 'redo should not survive a new edit');
});
test('a resize never collapses a block to nothing', () => {
  const h = EM.history(EM.emptyDoc());
  const pid = h.get().pages[0].id;
  let id; h.apply((d) => { id = EM.ops.addBlock(d, pid, 'fill'); });
  h.apply((d) => EM.ops.resizeBlock(d, pid, id, { x: 0, y: 0, w: -50, h: -50 }, 8));
  const b = h.get().pages[0].blocks[0];
  assert.ok(b.w >= 8 && b.h >= 8, 'a block collapsed to zero');
});
test('the last page cannot be deleted', () => {
  const d = EM.emptyDoc();
  assert.throws(() => EM.ops.removePage(d, d.pages[0].id), /at least one page/);
});

console.log('\nthe renderer');
test('every block type renders without a DOM', () => {
  for (const t of EM.KINDS) {
    const html = ER.block(EM.makeBlock(t), bu);
    assert.ok(html && !html.includes('hb-missing'), `${t} did not render`);
  }
});
test('derived blocks show the measured numbers', () => {
  assert.ok(ER.block(EM.makeBlock('construction'), bu).includes(String(m.markInk.w)));
  assert.ok(ER.block(EM.makeBlock('clearSpace'), bu).includes(String(m.clearSpace)));
  assert.ok(ER.block(EM.makeBlock('minimumSize'), bu).includes(String(m.minimumSize.screenPx)));
});
test('a block draws in the colour it is told to', () => {
  const b = EM.makeBlock('mark', { props: { colourway: 'tide', on: 'ground' } });
  assert.ok(ER.block(b, bu).includes('#1E7A8C'), 'the tide colourway was ignored');
});
test('colour names, role names and raw hex all resolve', () => {
  assert.strictEqual(ER.colour(bu, 'primary'), '#0A2A33');
  assert.strictEqual(ER.colour(bu, 'beacon'), '#F2A007');
  assert.strictEqual(ER.colour(bu, '#ABCDEF'), '#ABCDEF');
});
test('text is escaped rather than injected', () => {
  const b = EM.makeBlock('text', { props: { text: '<img src=x onerror=alert(1)>' } });
  const html = ER.block(b, bu);
  assert.ok(!html.includes('<img'), 'markup in a text block was not escaped');
  assert.ok(html.includes('&lt;img'));
});

console.log('\nrule blocks: the icon rules');
const sys = require('../src/system');
const iconGood = fs.readFileSync(path.join(__dirname, 'fixtures', 'icon-good.svg'), 'utf8');
const iconBad = fs.readFileSync(path.join(__dirname, 'fixtures', 'icon-bad.svg'), 'utf8');
const R = sys.iconRules(m);

test('the icon rules are measured off the mark, not typed in', () => {
  // viewBox 120, ink 109, so the mark's own margin is 5.5 either side
  assert.strictEqual(R.derivedFrom.markMargin, 5.5);
  assert.strictEqual(R.stroke, 1.8);      // 24 x (9 / 120)
  assert.strictEqual(R.live, 21.8);       // 24 x (1 - 2 x 5.5/120)
});
test('a project override replaces the decision and the arithmetic follows it', () => {
  const r = sys.iconRules(m, { box: 32, strokeRatio: 0.05 });
  assert.strictEqual(r.box, 32);
  assert.strictEqual(r.stroke, 1.6);
  assert.notStrictEqual(r.live, R.live, 'the live area did not follow the new box');
});

test('an arc\'s radii are not mistaken for points', () => {
  const pts = sys.pathPoints('M3 9.5 A30 30 0 0 1 21 9.5');
  assert.strictEqual(pts.length, 2, 'the arc parameters were read as coordinates');
  assert.deepStrictEqual(pts[1], [21, 9.5]);
  assert.ok(!pts.some(([x]) => x === 30), 'a radius of 30 was read as a point 30 across');
});
test('relative commands accumulate from where the pen is', () => {
  assert.deepStrictEqual(sys.pathPoints('M2 2 l4 0 l0 4').map((q) => q.join(',')), ['2,2', '6,2', '6,6']);
  // close returns the pen to the start of the subpath, so what follows is
  // measured from there and not from the last corner
  assert.deepStrictEqual(sys.pathPoints('M2 2 l4 0 l0 4 z l1 1').pop(), [3, 3]);
});
test('a shorthand move continues as a line', () => {
  assert.strictEqual(sys.pathPoints('M1 1 2 2 3 3').length, 3);
});

test('an icon drawn to the rules passes clean', () => {
  assert.deepStrictEqual(sys.checkIcon(iconGood, R), []);
});
test('a stroke that is not the set stroke is a blocker', () => {
  const f = sys.checkIcon(iconBad, R);
  const b = f.filter((x) => x.level === 'blocker');
  assert.strictEqual(b.length, 1);
  assert.ok(b[0].what.includes('3'), 'the wrong weight was not named');
  assert.ok(b[0].what.includes('1.8'), 'the right weight was not named');
});
test('caps, corners and fills are warnings, because they are still exportable', () => {
  const w = sys.checkIcon(iconBad, R).filter((x) => x.level === 'warning').map((x) => x.what).join(' ');
  assert.ok(/butt/.test(w), 'the wrong cap was not reported');
  assert.ok(/miter/.test(w), 'the wrong corner was not reported');
  assert.ok(/filled/.test(w), 'a filled shape in an outline set was not reported');
});
test('paint set on a group is still the icon\'s paint', () => {
  // regression: a drawing tool hangs stroke on the <svg> or a <g> and lets the
  // shapes inherit it. Reading only the shape found no strokes at all, so an
  // icon with the wrong weight passed silently, which is worse than no check.
  const inherited = fs.readFileSync(path.join(__dirname, 'fixtures', 'icon-inherited.svg'), 'utf8');
  const f = sys.checkIcon(inherited, R);
  assert.ok(f.some((x) => x.level === 'blocker' && x.what.includes('3')), 'an inherited stroke-width was not seen');
  assert.ok(f.some((x) => /butt/.test(x.what)), 'an inherited cap, set in a style attribute, was not seen');
  assert.ok(!f.some((x) => /filled/.test(x.what)), 'an inherited fill="none" was read as a fill');
});
test('a title or a group is not counted as a drawn shape', () => {
  const empty = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><title>x</title><g></g></svg>';
  assert.ok(sys.checkIcon(empty, R).some((x) => x.what.includes('empty')), 'an icon with nothing drawn in it passed');
});
test('the wrong grid stops the check, because nothing after it means anything', () => {
  const f = sys.checkIcon(iconGood.replace('0 0 24 24', '0 0 32 32'), R);
  assert.strictEqual(f.length, 1);
  assert.strictEqual(f[0].level, 'blocker');
  assert.ok(f[0].what.includes('24'), 'the check did not say what the grid is');
});
test('every finding says what, why and how, in words a designer uses', () => {
  for (const f of sys.checkIcon(iconBad, R)) {
    assert.ok(f.what && f.why && f.how, 'a finding was missing one of its three parts');
    assert.ok(!/viewBox|stroke-width=|nodeName/.test(f.what), `"${f.what}" is written in code, not English`);
  }
});

console.log('\nrule blocks: the pattern');
const pat = require('../src/pattern');
const PR = sys.patternRules();

test('a master with nothing marked is refused, not guessed at', () => {
  const g = pat.sourceGeometry(project.assets.mark.source.replace(/\sdata-pattern="source"/, ''));
  assert.strictEqual(g.ok, false);
  assert.ok(/data-pattern="source"/.test(g.how), 'the refusal did not say how to fix it');
});
test('the tile is cut from the marked shape alone, not the whole mark', () => {
  const g = pat.sourceGeometry(project.assets.mark.source);
  assert.ok(g.ok, g.why);
  assert.ok(g.box.w < m.markInk.w, 'the tile was measured off the whole mark');
});
test('the tile repeats seamlessly: the second row is offset by half a tile', () => {
  const t = pat.tile(project.assets.mark.source, PR, '#0A2A33');
  assert.strictEqual(t.width, PR.tile);
  assert.strictEqual(t.height, Number((PR.tile * PR.rowSpacing * 2).toFixed(2)));
  // three placements: one on the first row, and two on the second so the
  // half-drop still covers the tile where it wraps
  assert.strictEqual((t.body.match(/<g transform=/g) || []).length, 3);
  const xs = [...t.body.matchAll(/translate\((-?[\d.]+)/g)].map((x) => Number(x[1]));
  assert.ok(Math.abs((xs[2] - xs[1]) - PR.tile) < 0.01, 'the wrap copy is not exactly one tile across');
});
test('the tile carries the pattern weight, not the mark\'s own', () => {
  const t = pat.tile(project.assets.mark.source, PR, '#0A2A33');
  assert.ok(t.body.includes('stroke="#0A2A33"'));
  assert.ok(!/stroke-width="9"/.test(t.body), 'the tile kept the mark\'s stroke');
});
test('every density and colourway is cut once', () => {
  assert.strictEqual(Object.keys(bu.patternTiles).length, 9);   // 3 densities x 3 colourways that pass
  assert.ok(bu.patternTiles['coarse:primary'], 'a density and colourway pair is missing');
});
test('a colourway that fails contrast is refused with its ratio, not drawn faintly', () => {
  const r = bu.patternRefused;
  assert.ok(r.length, 'nothing was refused, and accent on ground cannot be seen');
  assert.ok(r.every((x) => x.colourway === 'accent'));
  assert.strictEqual(r[0].ratio, 1.83);
  assert.ok(!bu.patternTiles['medium:accent'], 'a refused pair was cut anyway');
});
test('a denser setting really is denser', () => {
  assert.ok(bu.patternTiles['fine:primary'].width < bu.patternTiles['coarse:primary'].width);
});

test('the rules reach brand.json, so a developer reads the same numbers', () => {
  const bj = JSON.parse(fs.readFileSync(path.join(out, 'brand.json'), 'utf8'));
  assert.strictEqual(bj.system.icons.stroke, R.stroke);
  assert.strictEqual(bj.system.icons.live, R.live);
  assert.ok(bj.system.pattern.source, 'brand.json does not say where the pattern comes from');
  assert.strictEqual(bj.system.motion.durations.considered, 480);
});
test('a tile is written for every density in every colourway', () => {
  const tiles = result.written.filter((f) => f.path.startsWith('07-pattern/'));
  assert.strictEqual(tiles.length, patternTiles());
  assert.ok(tiles.every((f) => /pattern-(fine|medium|coarse)-[a-z]+\.svg$/.test(f.path)),
    'a tile is named something other than its density and colourway');
});

console.log('\nrule blocks: on the page');
test('the model knows a third kind', () => {
  assert.deepStrictEqual(EM.RULE, ['pattern', 'iconGrid', 'motion', 'photography']);
  assert.strictEqual(EM.kindOf('pattern'), 'rule');
  assert.strictEqual(EM.kindOf('lockup'), 'derived');
  assert.strictEqual(EM.kindOf('text'), 'plain');
});
test('a pattern block reaches for the tile by role name', () => {
  // regression: the colourway was mapped through the colour name first, which
  // turned "primary" into "Deep" and missed every tile
  const b = EM.makeBlock('pattern', { props: { density: 'coarse', colourway: 'primary', on: 'ground' } });
  const html = ER.block(b, bu);
  assert.ok(html.includes('<pattern '), 'no tile was found for a pair that exists');
  assert.ok(html.includes(bu.roles.primary.hex), 'the tile was drawn in the wrong ink');
});
test('a refused pair says so on the page instead of drawing nothing', () => {
  const thin = Object.assign({}, bu, { patternTiles: {} });
  assert.ok(ER.block(EM.makeBlock('pattern'), thin).includes('refused'));
});
test('a master with no pattern source says what to mark', () => {
  const none = Object.assign({}, bu, { system: Object.assign({}, bu.system, { pattern: { available: false, how: 'Mark a shape.' } }) });
  assert.ok(ER.block(EM.makeBlock('pattern'), none).includes('Mark a shape.'));
});
test('the motion block moves the outline and the fill separately', () => {
  const html = ER.block(EM.makeBlock('motion'), bu);
  assert.ok(/class="hb-out"/.test(html) && /class="hb-fill"/.test(html), 'the artwork was animated in one piece');
  assert.ok(/clip-path="url\(#/.test(html), 'the fill rises without a clip, so it slides past the mark');
  assert.ok(html.includes('prefers-reduced-motion'), 'the animation ignores a reader who asked for less of it');
});
test('two rule blocks on a page do not collide', () => {
  const a = ER.block(EM.makeBlock('motion'), bu), b = ER.block(EM.makeBlock('motion'), bu);
  const idOf = (h) => (h.match(/@keyframes (\S+?)-rise/) || [])[1];
  assert.ok(idOf(a) && idOf(b) && idOf(a) !== idOf(b), 'both blocks named their keyframes the same thing');
});
test('a rule block states its rule, and stops when told to', () => {
  const on = ER.block(EM.makeBlock('iconGrid'), bu);
  assert.ok(on.includes('24 box') && on.includes('1.8'), 'the icon grid did not state its rule');
  assert.ok(!ER.block(EM.makeBlock('iconGrid', { props: { caption: false } }), bu).includes('24 box'));

  // "400ms" is in the keyframes whatever happens, so look for the phrase
  assert.ok(ER.block(EM.makeBlock('motion'), bu).includes('400ms out'), 'the motion block did not state its timing');
  assert.ok(!ER.block(EM.makeBlock('motion', { props: { caption: false } }), bu).includes('400ms out'));

  assert.ok(!ER.block(EM.makeBlock('pattern'), bu).includes('half drop'), 'a pattern field stated a rule it was not asked for');
  assert.ok(ER.block(EM.makeBlock('pattern', { props: { caption: true } }), bu).includes('half drop'));
});
test('a stated rule breaks between phrases, not inside one', () => {
  const html = ER.block(EM.makeBlock('motion'), bu);
  assert.ok(html.includes('400ms out'), 'a phrase can wrap mid-way and read as nonsense');
});
test('the rules survive the round trip to a published page', () => {
  const d = EM.emptyDoc('Meridian');
  d.pages[0].blocks.push(EM.makeBlock('pattern', { props: { density: 'coarse', colourway: 'primary', on: 'ground', caption: true } }));
  d.pages[0].blocks.push(EM.makeBlock('iconGrid'));
  const html = require('../src/editor/publish').publish(d, bu, { title: 'Rules' });
  assert.ok(html.includes('<pattern '), 'the pattern did not survive publishing');
  assert.ok(html.includes('24 box'), 'the icon rule did not survive publishing');
});

console.log('\nthe editor');
test('the starter document opens on something worth looking at', () => {
  const d = starterDoc(bu);
  assert.ok(d.pages.length >= 3, 'a beginner should not meet a blank page');
  assert.ok(d.pages.every((p) => p.blocks.length > 0), 'every starter page should have content');
});
test('the editor is self contained, with no fetch at load', () => {
  const html = editorHtml(project, m, []);
  assert.ok(html.includes('HANDOVER_BUNDLE'), 'the bundle is not inlined');
  assert.ok(html.includes('HandoverModel'), 'the model is not inlined');
  assert.ok(html.includes('HandoverRender'), 'the renderer is not inlined');
  const remote = (html.match(/<script[^>]+src=/g) || []);
  assert.deepStrictEqual(remote, [], 'the editor pulls a script from somewhere');
});
test('every block type can be inserted, and is called something a designer says', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'editor', 'app.js'), 'utf8');
  const groups = app.slice(app.indexOf('const INSERT'), app.indexOf('function drawInsert'));
  for (const t of EM.KINDS) {
    assert.ok(groups.includes(`'${t}'`), `${t} can be rendered but never added`);
    assert.ok(new RegExp(`\\b${t}: '`).test(app), `${t} has no name, so it shows in the interface as its type`);
  }
});
test('the editor and the exported document use the same renderer', () => {
  const path2 = require.resolve('../src/editor/render');
  const html = editorHtml(project, m, []);
  assert.ok(html.includes(fs.readFileSync(path2, 'utf8').slice(200, 400)),
    'the editor inlines a different renderer than the one on disk');
});

console.log('\nrule blocks: the photography treatment');
const PH = require('../src/photography');
const PHR = sys.resolve(project, m).photography;

test('the project file reaches the engine at all', () => {
  // regression: the loader returned brand, tokens, assets and rules, and quietly
  // dropped system and content. Every rule override in every project file was
  // read as absent and the defaults won, and nothing complained, because a
  // default is a perfectly good answer until somebody wants a different one.
  assert.ok(project.system, 'the loader dropped the system block');
  assert.ok(project.content, 'the loader dropped the content block');
  assert.strictEqual(sys.iconRules(m, { box: 32 }).box, 32);
  assert.strictEqual(sys.resolve({ system: { icons: { box: 32 } } }, m).icons.box, 32,
    'an override in the project file did not reach the rules');
});
test('nothing guesses a treatment', () => {
  const none = PH.rules();
  assert.strictEqual(none.declared, false);
  assert.strictEqual(none.duotone, null);
  assert.ok(none.ratios.length, 'the crop ratios still have a sensible default');
  assert.strictEqual(PH.rules({ scrim: { opacity: 0.3 } }).declared, true);
});
test('the duotone runs between exactly the two colours it was given', () => {
  const black = PH.treatPixel(PHR, bu, { r: 0, g: 0, b: 0 });
  const white = PH.treatPixel(PHR, bu, { r: 1, g: 1, b: 1 });
  const near = (px, hex) => {
    const [r, g, b] = require('../src/contrast').unit(hex);
    return Math.max(Math.abs(px.r - r), Math.abs(px.g - g), Math.abs(px.b - b)) < 0.04;
  };
  assert.ok(near(black, bu.roles[PHR.duotone.shadow].hex), 'black did not land on the shadow colour');
  assert.ok(near(white, bu.roles[PHR.duotone.highlight].hex), 'white did not land on the highlight colour');
});
test('an amount below one leaves some of the photograph showing', () => {
  const red = { r: 0.86, g: 0.24, b: 0.16 };
  const full = PH.treatPixel(PH.rules({ duotone: { shadow: 'primary', highlight: 'ground', amount: 1 } }), bu, red);
  const part = PH.treatPixel(PH.rules({ duotone: { shadow: 'primary', highlight: 'ground', amount: 0.5 } }), bu, red);
  assert.ok(part.r > full.r, 'a half-strength duotone kept none of the red');
  assert.ok(part.r < red.r, 'a half-strength duotone did nothing at all');
});
test('a scrim is the strength it says it is', () => {
  // regression: a flat scrim was painted as a bare hex, so a 42% scrim rendered
  // solid while every number the editor reported assumed 42%
  const flat = PH.scrimStyle(PH.rules({ scrim: { colour: 'primary', opacity: 0.42, direction: 'flat' } }), bu);
  assert.ok(/rgba\(10,42,51,0\.42\)/.test(flat.background), `a flat scrim painted ${flat.background}`);
  const grad = PH.scrimStyle(PHR, bu);
  assert.ok(grad.background.includes('rgba(10,42,51,0.42) 0%'), 'the gradient does not start at its stated opacity');
  assert.ok(grad.background.includes('rgba(10,42,51,0) 78%'), 'the gradient does not fade to nothing');
});
test('the gradient can be read back exactly where it is painted', () => {
  const g = PH.scrimStyle(PHR, bu);
  assert.strictEqual(Number(PH.alphaAt(g, 0).toFixed(3)), 0.42);
  assert.strictEqual(PH.alphaAt(g, 0.78), 0);
  assert.strictEqual(PH.alphaAt(g, 1), 0);
  assert.ok(PH.alphaAt(g, 0.2) < 0.42 && PH.alphaAt(g, 0.2) > 0.2, 'the middle of the ramp is wrong');
  assert.strictEqual(PH.alphaAt(PH.scrimStyle(PH.rules({ scrim: { opacity: 0.3, direction: 'flat' } }), bu), 0.9), 0.3,
    'a flat scrim is not flat');
});
test('a scrim from the bottom is strongest at the bottom', () => {
  const at = (y) => ({ x: 0.5, y });
  assert.strictEqual(PH.gradientT('bottom', at(1)), 0);      // the bottom is the strong end
  assert.strictEqual(PH.gradientT('bottom', at(0)), 1);
  assert.strictEqual(PH.gradientT('top', at(0)), 0);
  assert.strictEqual(PH.gradientT('left', { x: 0, y: 0.5 }), 0);
  assert.strictEqual(PH.gradientT('right', { x: 1, y: 0.5 }), 0);
});
test('a pixel is measured through the treatment, not as it arrived', () => {
  const C2 = require('../src/contrast');
  const px = { r: 0.86, g: 0.90, b: 0.95 };                  // a bright sky
  const raw = C2.luminanceOf(px.r, px.g, px.b);
  const treated = PH.luminanceAfter(PHR, bu, px, null, { x: 0.5, y: 0.5 });
  assert.notStrictEqual(Number(treated.toFixed(4)), Number(raw.toFixed(4)),
    'the treatment made no difference to what gets measured');
  // in the scrim at the bottom it is darker than halfway up
  const low = PH.luminanceAfter(PHR, bu, px, null, { x: 0.5, y: 0.98 });
  assert.ok(low < treated, 'the scrim did not darken the bottom of the picture');
});

test('the scrim strength a picture needs is worked out, not guessed', () => {
  const ink = bu.roles.ground.hex;                            // a light mark
  const bright = [];
  for (let i = 0; i < 12; i++) bright.push({ r: 0.93, g: 0.95, b: 0.97, at: { x: 0.5, y: 0.9 } });
  const need = PH.scrimNeeded(ink, bright, bu.roles.primary.hex, 'bottom');
  assert.ok(need.needed > 0 && need.needed <= 1, `no workable scrim was found: ${JSON.stringify(need)}`);
  assert.ok(need.ratio >= PH.NONTEXT, 'the scrim it suggested does not actually clear the bar');
});
test('a scrim in the mark\'s own colour is refused with a reason', () => {
  const dark = [{ r: 0.05, g: 0.09, b: 0.11, at: { x: 0.5, y: 0.9 } }];
  const need = PH.scrimNeeded(bu.roles.primary.hex, dark, bu.roles.primary.hex, 'flat');
  assert.strictEqual(need.needed, null);
  assert.ok(/cannot separate/.test(need.why), `no reason was given: ${need.why}`);
});
test('a scrim already strong enough asks for nothing', () => {
  const dark = [{ r: 0.04, g: 0.06, b: 0.08, at: { x: 0.5, y: 0.5 } }];
  const need = PH.scrimNeeded(bu.roles.ground.hex, dark, bu.roles.primary.hex, 'flat');
  assert.strictEqual(need.needed, 0);
  assert.ok(need.ratio >= PH.NONTEXT);
});

test('a crop that drifts off the allowed ratios is named, with the box that fixes it', () => {
  assert.deepStrictEqual(PH.checkCrop(PHR, { w: 720, h: 480 }), [], '3:2 was reported as wrong');
  assert.deepStrictEqual(PH.checkCrop(PHR, { w: 480, h: 720 }), [], 'a portrait 3:2 was reported as wrong');
  assert.deepStrictEqual(PH.checkCrop(PHR, { w: 1280, h: 720 }), [], '16:9 was reported as wrong');
  const f = PH.checkCrop(PHR, { w: 700, h: 500 }, 'beach.jpg');
  assert.strictEqual(f.length, 1);
  assert.ok(f[0].what.includes('1.4 to 1'));
  assert.ok(/3:2/.test(f[0].how) && /750 by 500/.test(f[0].how), `the fix is not spelled out: ${f[0].how}`);
});
test('the recipe reads as a sentence', () => {
  const d = PH.describe(PHR, bu);
  assert.ok(/duotone primary → ground at 82%/.test(d), d);
  assert.ok(/42% primary scrim from the bottom/.test(d), d);
});

console.log('\nphotography on the page');
test('a treated image carries its own filter and its own scrim', () => {
  const st = IM.store();
  const id = st.add(PNG_A, { w: 1600, h: 1000, name: 'beach.jpg' });
  const draw = (props) => ER.block(EM.makeBlock('slot', { props: Object.assign({ image: id }, props) }),
    Object.assign({}, bu, { images: st.all() }));
  const on = draw();
  assert.ok(/<filter id="ph/.test(on), 'no filter travelled with the image');
  assert.ok(/feComponentTransfer/.test(on), 'the duotone is not in the filter');
  assert.ok(/class="hb-scrim"/.test(on), 'the scrim is missing');
  assert.ok(/filter:url\(#ph/.test(on), 'the image does not use the filter');

  const off = draw({ treatment: false });
  assert.ok(!/<filter/.test(off) && !/hb-scrim/.test(off), 'opting out left the treatment on');
});
test('a project with no treatment declared leaves photographs alone', () => {
  const st = IM.store();
  const id = st.add(PNG_A, { w: 1600, h: 1000 });
  const plain = Object.assign({}, bu, { images: st.all(),
    system: Object.assign({}, bu.system, { photography: PH.rules() }) });
  const html = ER.block(EM.makeBlock('slot', { props: { image: id } }), plain);
  assert.ok(!/<filter/.test(html) && !/hb-scrim/.test(html), 'an undeclared treatment was applied anyway');
  assert.ok(/<img /.test(html), 'the photograph vanished with it');
});
test('the treatment is a rule, so the stored photograph is never touched', () => {
  const st = IM.store();
  const id = st.add(PNG_A, { w: 1600, h: 1000 });
  const before = st.get(id).src;
  ER.block(EM.makeBlock('slot', { props: { image: id } }), Object.assign({}, bu, { images: st.all() }));
  assert.strictEqual(st.get(id).src, before, 'drawing the treatment rewrote the file');
});
test('the recipe block states the rule, and says what to do when there is none', () => {
  const html = ER.block(EM.makeBlock('photography'), bu);
  assert.ok(html.includes('Duotone') && html.includes('primary → ground'), 'the duotone is not stated');
  assert.ok(html.includes('42% primary'), 'the scrim is not stated');
  assert.ok(html.includes('3:2'), 'the crops are not stated');
  assert.ok(!html.includes('hb-missing'));

  const plain = Object.assign({}, bu, { system: Object.assign({}, bu.system, { photography: PH.rules() }) });
  const empty = ER.block(EM.makeBlock('photography'), plain);
  assert.ok(empty.includes('system.photography'), 'it does not say where the treatment is set');
});
test('photography is the fourth rule block', () => {
  assert.strictEqual(EM.kindOf('photography'), 'rule');
  assert.ok(EM.RULE.includes('photography'));
});
test('the treatment reaches brand.json', () => {
  const bj = JSON.parse(fs.readFileSync(path.join(out, 'brand.json'), 'utf8'));
  assert.ok(bj.system.photography, 'a developer cannot read the treatment');
  assert.strictEqual(bj.system.photography.duotone.amount, 0.82);
  assert.deepStrictEqual(bj.system.photography.ratios, ['3:2', '16:9', '1:1', '4:5']);
});

console.log('\npage sizes');
test('a print size is laid out in pixels and printed in its own units', () => {
  const a4 = EM.sheet('a4');
  assert.strictEqual(a4.w, 794);            // 210 mm at 96 dpi
  assert.strictEqual(a4.h, 1123);
  assert.strictEqual(a4.css, '210mm 297mm', '794 px is only A4 by accident; a printer needs the millimetres');
  const slide = EM.sheet('slide-16x9');
  assert.strictEqual(slide.css, '1280px 720px');
  assert.strictEqual(EM.sheet('letter').css, '8.5in 11in');
});
test('an unknown size falls back rather than throwing, and a custom one passes through', () => {
  assert.strictEqual(EM.sheet('nonsense').size, 'slide-16x9');
  const c = EM.sheet('custom', { w: 100, h: 50, unit: 'mm' });
  assert.strictEqual(c.size, 'custom');
  assert.strictEqual(c.w, EM.toPx(100, 'mm'));
  assert.strictEqual(c.css, '100mm 50mm');
});
test('a document written before sizes had names keeps the size it was laid out at', () => {
  // it carries pixels and nothing else, so it must not snap to a preset
  assert.strictEqual(EM.pageSize({ page: { w: 1600, h: 900 } }, null).size, 'custom');
  assert.strictEqual(EM.pageSize({ page: { w: 1600, h: 900 } }, null).w, 1600);
  // and one that happens to be a size we now have a name for gets that name,
  // which is how an old A4 document starts printing in millimetres
  assert.strictEqual(EM.pageSize({ page: { w: 1280, h: 720 } }, null).size, 'slide-16x9');
  assert.strictEqual(EM.pageSize({ page: { w: 794, h: 1123 } }, null).css, '210mm 297mm');
});
test('a page takes the document size unless it says otherwise', () => {
  const d = EM.emptyDoc('T');
  assert.strictEqual(EM.pageSize(d, d.pages[0]).size, 'slide-16x9');
  EM.ops.addPage(d, 'Insert');
  EM.ops.setPageSize(d, d.pages[1].id, 'a4');
  assert.strictEqual(EM.pageSize(d, d.pages[0]).size, 'slide-16x9');
  assert.strictEqual(EM.pageSize(d, d.pages[1]).size, 'a4');
  assert.strictEqual(d.page.size, 'slide-16x9', 'one page changed the whole document');
});

test('resizing scales the layout instead of throwing it away', () => {
  const d = EM.emptyDoc('T'), p = d.pages[0];
  p.blocks.push(EM.makeBlock('fill', { x: 0, y: 0, w: 1280, h: 720 }));       // full bleed
  p.blocks.push(EM.makeBlock('text', { x: 120, y: 180, w: 620, h: 200 }));    // free
  p.blocks.push(EM.makeBlock('rule', { x: 1180, y: 100, w: 100, h: 2 }));     // on the right edge
  p.blocks.push(EM.makeBlock('text', { x: 60, y: 660, w: 400, h: 60 }));      // on the bottom edge
  EM.ops.setPageSize(d, null, 'a4');
  const [bleed, free, right, bottom] = p.blocks;
  assert.deepStrictEqual([bleed.x, bleed.y, bleed.w, bleed.h], [0, 0, 794, 1123],
    'a full-bleed block stopped being full bleed');
  assert.strictEqual(right.x + right.w, 794, 'a block on the right edge came away from it');
  assert.strictEqual(bottom.y + bottom.h, 1123, 'a block on the bottom edge came away from it');
  assert.ok(free.x > 0 && free.x + free.w < 794, 'a free block was not brought inside the page');
});
test('nothing is stretched: both directions scale by the same factor', () => {
  const d = EM.emptyDoc('T'), p = d.pages[0];
  p.blocks.push(EM.makeBlock('mark', { x: 300, y: 200, w: 300, h: 300 }));
  EM.ops.setPageSize(d, null, 'a4');
  const b = p.blocks[0];
  assert.strictEqual(b.w, b.h, 'a square block came out a rectangle');
});
test('keeping positions really keeps them', () => {
  const d = EM.emptyDoc('T'), p = d.pages[0];
  p.blocks.push(EM.makeBlock('text', { x: 120, y: 180, w: 620, h: 200 }));
  EM.ops.setPageSize(d, null, 'a4', null, 'keep');
  assert.deepStrictEqual([p.blocks[0].x, p.blocks[0].y], [120, 180]);
  assert.strictEqual(d.page.size, 'a4');
});
test('setting the document size clears the overrides it replaces', () => {
  const d = EM.emptyDoc('T');
  EM.ops.addPage(d, 'Two');
  EM.ops.setPageSize(d, d.pages[1].id, 'square');
  assert.ok(d.pages[1].page, 'the override was not recorded');
  EM.ops.setPageSize(d, null, 'a4');
  assert.ok(!d.pages[1].page, 'a page kept an override the document had overruled');
  assert.strictEqual(EM.pageSize(d, d.pages[1]).size, 'a4');
});
test('a new block is centred on its own page and never wider than it', () => {
  const d = EM.emptyDoc('T');
  EM.ops.addPage(d, 'Tall');
  EM.ops.setPageSize(d, d.pages[1].id, 'a5');
  const a5 = EM.sheet('a5');
  const id = EM.ops.addBlock(d, d.pages[1].id, 'palette');   // 900 wide by default, A5 is 559
  const b = d.pages[1].blocks.find((x) => x.id === id);
  assert.ok(b.w <= a5.w, 'a block opened wider than the page it was put on');
  assert.strictEqual(b.x, Math.round((a5.w - b.w) / 2));
});
test('a correction folded into an action is not a second thing to undo', () => {
  const H = EM.history(EM.emptyDoc('T'));
  H.apply((d) => { d.grid = 4; });
  H.amend((d) => { d.grid = 16; });
  assert.strictEqual(H.get().grid, 16);
  H.undo();
  assert.strictEqual(H.get().grid, 8, 'the amendment became an undo step of its own');
});

test('one size gives one plain @page, in the units a printer wants', () => {
  const d = EM.emptyDoc('Meridian');
  EM.ops.setPageSize(d, null, 'a4');
  const html = publish(d, bu, { builtAt: 'fixed' });
  const rules = html.match(/@page[^{]*\{[^}]*}/g) || [];
  assert.strictEqual(rules.length, 1, 'a single-size document emitted more than one page rule');
  assert.ok(rules[0].includes('210mm 297mm'), `the print size is not in millimetres: ${rules[0]}`);
  assert.ok(html.includes('width:794px;height:1123px'), 'the screen size is missing');
});
test('a document that mixes sizes prints each page at its own', () => {
  const d = EM.emptyDoc('Meridian');
  EM.ops.addPage(d, 'Insert'); EM.ops.addPage(d, 'Also');
  EM.ops.setPageSize(d, d.pages[1].id, 'a4');
  const html = publish(d, bu, { builtAt: 'fixed' });
  const rules = html.match(/@page[^{]*\{[^}]*}/g) || [];
  // the size most pages use is the plain rule, so a browser without named
  // pages still prints the bulk of the document correctly
  assert.ok(rules[0].includes('1280px 720px'), `the commonest size is not the plain rule: ${rules[0]}`);
  assert.ok(rules.some((r) => /^@page hs\d\{/.test(r) && r.includes('210mm 297mm')),
    'the odd page out has no rule of its own');
  assert.strictEqual((html.match(/class="hp-page hs\d"/g) || []).length, 3);
  assert.ok(html.includes('A4 portrait'), 'a mixed document does not say which page is which size');
});

console.log('\nprint colour');
const K = require('../src/cmyk');
const zlib = require('zlib');

// the colour operators a PDF actually contains, out of its compressed streams
function pdfColourOps(buf) {
  const s = buf.toString('latin1'), out = [];
  const re = /stream\r?\n/g;
  let m;
  while ((m = re.exec(s))) {
    const start = m.index + m[0].length, end = s.indexOf('endstream', start);
    if (end < 0) continue;
    const raw = Buffer.from(s.slice(start, end), 'latin1');
    let text;
    try { text = zlib.inflateSync(raw).toString('latin1'); } catch (e) { text = raw.toString('latin1'); }
    for (const q of text.matchAll(/[\d.]+ [\d.]+ [\d.]+ [\d.]+ [kK]|[\d.]+ [\d.]+ [\d.]+ (?:rg|RG)/g)) out.push(q[0]);
  }
  return out;
}

test('a declared build is carried, and an undeclared one is marked as a guess', () => {
  const t = K.table({ a: { hex: '#0A2A33', cmyk: [88, 58, 45, 72] }, b: { hex: '#1E7A8C' } });
  const [a, b] = t;
  assert.strictEqual(a.declared, true);
  assert.deepStrictEqual(a.values, [88, 58, 45, 72]);
  assert.strictEqual(a.coverage, 263);
  assert.strictEqual(b.declared, false);
  assert.ok(/not to be sent to a press/.test(b.source), b.source);
});
test('a build that is not four numbers between nought and a hundred is not a build', () => {
  assert.strictEqual(K.parse([88, 58, 45]), null);
  assert.strictEqual(K.parse([88, 58, 45, 120]), null);
  assert.strictEqual(K.parse('88 58 45 72'), null);
  assert.strictEqual(K.parse(undefined), null);
  assert.deepStrictEqual(K.parse([88.4, 58, 45, 72]), [88, 58, 45, 72]);
});
test('too much ink is a blocker, with the number to take out', () => {
  const t = K.table({ heavy: { hex: '#101010', cmyk: [80, 70, 70, 95] } });
  const f = K.check(t, { stock: 'coated' });
  const blocker = f.find((x) => x.level === 'blocker');
  assert.ok(blocker, 'a 315 percent build was allowed onto coated stock');
  assert.ok(blocker.what.includes('315%') && blocker.what.includes('300%'), blocker.what);
  assert.ok(blocker.how.includes('15%'), 'it does not say how much to take out');
  // and the same build is fine on a stock that takes more, which nothing does
  assert.strictEqual(K.check(t, { stock: 'newsprint' }).filter((x) => x.level === 'blocker').length, 1);
});
test('a plain black is worth a word, because it prints as grey', () => {
  const f = K.check(K.table({ ink: { hex: '#000000', cmyk: [0, 0, 0, 100] } }), {});
  assert.strictEqual(f.length, 1);
  assert.strictEqual(f[0].level, 'warning');
  assert.ok(/plain black/.test(f[0].what));
  assert.ok(/60\/40\/40\/100/.test(f[0].how), 'no rich black is suggested');
  // a rich black passes
  assert.deepStrictEqual(K.check(K.table({ ink: { hex: '#000000', cmyk: [60, 40, 40, 100] } }), {}), []);
});
test('a missing build is a blocker for press and a warning otherwise', () => {
  const t = K.table({ a: { hex: '#1E7A8C' } });
  assert.strictEqual(K.check(t, { forPress: true })[0].level, 'blocker');
  assert.strictEqual(K.check(t, {})[0].level, 'warning');
  assert.ok(/no formula knows which paper/.test(K.check(t, {})[0].why));
});
test('a guess is never checked, because there is nothing to check', () => {
  // 79/13/0/45 for tide is what the naive formula gives; it must not be
  // reported as a rich-black or coverage problem as though somebody chose it
  const t = K.table({ black: { hex: '#000000' } });
  const f = K.check(t, {});
  assert.strictEqual(f.length, 1, 'a guessed build was audited as though it were a decision');
  assert.ok(/no CMYK/.test(f[0].what));
});

test('the ink map holds declared colours only', () => {
  const map = K.inkMap(K.table({ a: { hex: '#0A2A33', cmyk: [88, 58, 45, 72] }, b: { hex: '#1E7A8C' } }));
  assert.strictEqual(map.size, 1);
  assert.deepStrictEqual(map.get('10,42,51'), [0.88, 0.58, 0.45, 0.72]);
  assert.strictEqual(map.get('30,122,140'), undefined, 'a guess was put in the map');
});
test('a colour is recognised however the setter was called', () => {
  const { triple } = require('../src/pdf');
  assert.strictEqual(triple([10, 42, 51]), '10,42,51');
  assert.strictEqual(triple(['#0A2A33']), '10,42,51');
  assert.strictEqual(triple(['0a2a33']), '10,42,51');
  assert.strictEqual(triple([10.4, 42.2, 50.8]), '10,42,51');
  assert.strictEqual(triple([0.88, 0.58, 0.45, 0.72]), null, 'a CMYK call was read as RGB');
  assert.strictEqual(triple(['rebeccapurple']), null);
});

test('the PDFs in the package are in ink, not in screen light', async () => {
  const pdf = fs.readFileSync(path.join(out, '01-horizontal', 'meridian-horizontal-deep.pdf'));
  const ops = pdfColourOps(pdf);
  assert.ok(ops.length, 'no colour operators at all');
  assert.ok(ops.every((o) => /[kK]$/.test(o)), `a screen colour reached the print file: ${ops.join(', ')}`);
  assert.ok(ops.some((o) => o.startsWith('0.88 0.58 0.45 0.72')), `the declared build is not what was written: ${ops.join(', ')}`);
});
test('an undeclared colour stays RGB rather than being invented', async () => {
  const { toPdf } = require('../src/pdf');
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#1E7A8C"/></svg>';
  const ink = K.inkMap(K.table({ tide: { hex: '#1E7A8C' } }));
  const ops = pdfColourOps(await toPdf(svg, { ink }));
  assert.ok(ops.every((o) => /(rg|RG)$/.test(o)), `a guess was written as ink: ${ops.join(', ')}`);
});
test('the .ai file is the same bytes as the CMYK pdf', () => {
  const a = fs.readFileSync(path.join(out, '03-mark', 'meridian-mark-deep.pdf'));
  const b = fs.readFileSync(path.join(out, '03-mark', 'meridian-mark-deep.ai'));
  assert.ok(a.equals(b));
  assert.ok(pdfColourOps(a).every((o) => /[kK]$/.test(o)), 'the .ai is not in ink either');
});
test('brand.json says which numbers were given and which were worked out', () => {
  const bj = JSON.parse(fs.readFileSync(path.join(out, 'brand.json'), 'utf8'));
  assert.strictEqual(bj.print.stock, 'coated');
  assert.strictEqual(bj.print.totalInkLimit, 300);
  assert.strictEqual(bj.print.pdfColourSpace, 'DeviceCMYK');
  const deep = bj.print.colour.find((c) => c.name === 'deep');
  assert.strictEqual(deep.declared, true);
  assert.deepStrictEqual(deep.cmyk, [88, 58, 45, 72]);
  assert.strictEqual(deep.coverage, 263);
  assert.ok(bj.print.colour.every((c) => c.source), 'a colour does not say where its build came from');
});
test('the manual will not present a guess as a fact', () => {
  const html = fs.readFileSync(path.join(out, 'guidelines.html'), 'utf8');
  assert.ok(/CMYK and Pantone are typed in by you/.test(html), 'the manual still claims CMYK is converted');
  assert.ok(/Every colour here has one/.test(html), 'Meridian declares every build, so it should say so');
  // and with one missing it says which
  const docs = require('../src/documents');
  const thin = Object.assign({}, project, { tokens: Object.assign({}, project.tokens,
    { colour: Object.assign({}, project.tokens.colour,
      { tide: { hex: '#1E7A8C', role: 'secondary' } }) }) });
  const ctx = docs.context(thin, m, [], {});
  assert.ok(/tide.*no build yet/s.test(docs.guidelines(ctx)), 'a missing build is not called out by name');
});

console.log('\na second identity');
// Everything below came out of running the engine on a project that is not
// Meridian. With one project, every assumption that project happens to satisfy
// looks like a fact, and eight of them were.
const HAL = projectLoader.load(path.join(__dirname, '..', 'projects', 'halyard', 'project.json'));
const halM = measure(HAL);

test('a mark with no strokes still has a minimum size', () => {
  // most real marks are filled outlines, and an outlined wordmark has no
  // strokes at all. Without this the headline measurement was simply absent.
  assert.strictEqual(svgu.thinnestStroke(svgu.parse(HAL.assets.mark.source)), null,
    'this fixture is meant to have no strokes');
  assert.strictEqual(halM.minimumSize.from, 'stem');
  assert.ok(halM.minimumSize.screenPx > 0 && halM.minimumSize.printMm > 0,
    `filled artwork got ${JSON.stringify(halM.minimumSize)}`);
  assert.ok(/narrowest stem/.test(halM.minimumSize.basis));
});
test('the stem measurement returns a known stroke width exactly', () => {
  // the one case where the truth is known: Meridian's stroke is 9
  assert.strictEqual(m.minimumSize.from, 'stroke');
  const asIfFilled = geo.thinnestFeature(project.assets.mark.source, m.markViewBox);
  assert.strictEqual(asIfFilled, 9, `measuring a 9 wide stroke gave ${asIfFilled}`);
  // and a plain bar of a known width
  const bar = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">'
    + '<rect x="20" y="56.5" width="80" height="7" fill="#000"/></svg>';
  assert.strictEqual(geo.thinnestFeature(bar, { x: 0, y: 0, w: 120, h: 120 }), 7);
});
test('a sharp corner is not mistaken for a thin stem', () => {
  // the chevron in Halyard's mark comes to a point at both ends. Scanning for
  // the narrowest ink anywhere reads those points, not the bar across the
  // shape, and puts the minimum size far too high — 4.8 where the answer is
  // 12. A stem has ink either side of it; a tip is where the shape runs out.
  const box = { x: 0, y: 0, w: 120, h: 120 };
  const wrap = (d) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">${d}</svg>`;
  const chevron = '<path fill="#000" d="M14 100 L34 66 L86 66 L106 100'
    + ' L92 108 L74 78 L46 78 L28 108 Z"/>';
  assert.strictEqual(geo.thinnestFeature(wrap(chevron), box), 12);
  // a ring is 16 thick all the way round, and its four extremes are not stems
  const ring = '<path fill="#000" fill-rule="evenodd" d="M60 12A46 46 0 1 0 60 104'
    + 'A46 46 0 1 0 60 12ZM60 28A30 30 0 1 1 60 88A30 30 0 1 1 60 28Z"/>';
  assert.strictEqual(geo.thinnestFeature(wrap(ring), box), 16);
  // the two together are still 12, because the narrowest of the two is
  assert.strictEqual(geo.thinnestFeature(wrap(ring + chevron), box), 12);
  // a shape that never narrows still answers with a width rather than nothing
  const disc = '<circle cx="60" cy="60" r="46" fill="#000"/>';
  assert.ok(geo.thinnestFeature(wrap(disc), box) > 40, 'a solid disc reported a thin stem');
  assert.strictEqual(geo.thinnestFeature(wrap('<g></g>'), box), null);
});
test('a mark with two inks keeps both in the manual', () => {
  // the specimen painted every slot one colour, which is right for a diagram
  // and wrong for "this is the mark". Meridian has one slot, so nobody noticed.
  assert.deepStrictEqual(halM.slots, ['ink', 'mark']);
  const docs = require('../src/documents');
  const ctx = docs.context(HAL, halM, [], {});
  const specimen = require('../src/documents/blocks').markSpecimen(ctx);
  assert.ok(specimen.includes('#C6442E'), 'the second ink was flattened out of the specimen');
  assert.ok(specimen.includes('#101820'), 'the first ink is missing too');
  // and the diagram is still a silhouette, which is what a diagram wants
  const dia = require('../src/documents/blocks').construction(ctx);
  // the accent is the diagram's own annotation ink — the ink box and its
  // caption — so look at the artwork group alone, which is the part that
  // would go two-coloured if the diagram ever drew the mark as it is used
  const art = /<g transform="translate[^>]*>([\s\S]*)<\/g>\s*<text/.exec(dia);
  assert.ok(art, 'the construction drawing has no artwork group');
  const inks = new Set((art[1].match(/#[0-9A-Fa-f]{3,6}/g) || []));
  assert.strictEqual(inks.size, 0, `the construction drawing gained colour: ${[...inks].join(', ')}`);
});
test('a scaled variant carries a height a browser will accept', () => {
  // height="auto" is not a length. The style beside it hid that, so the only
  // sign was a console error per drawing — and a page stripped of its styles
  // would have lost the proportion with it.
  const docs = require('../src/documents');
  const b = require('../src/documents/blocks');
  const ctx = docs.context(HAL, halM, [], {});
  const svg = b.scaled(b.asColourway(ctx, ctx.primaryColourway), 240);
  assert.ok(!/height="auto"/.test(svg), 'height="auto" is back on the svg element');
  const h = /<svg[^>]*\sheight="([^"]+)"/.exec(svg);
  assert.ok(h && Number.isFinite(Number(h[1])), `height is ${h && h[1]}`);
  const vb = /viewBox="\s*[-\d.]+[,\s]+[-\d.]+[,\s]+([-\d.]+)[,\s]+([-\d.]+)/.exec(svg);
  assert.ok(Math.abs(Number(h[1]) - 240 * (Number(vb[2]) / Number(vb[1]))) < 0.02,
    'the height does not keep the artwork in proportion');
  // and the absent variant still yields a placeholder rather than throwing
  assert.ok(b.scaled(null, 240).includes('240px'));
});
test('a diagram takes its ink from the page, not from a brand role', () => {
  const docs = require('../src/documents');
  const dia = require('../src/documents/blocks').construction(docs.context(HAL, halM, [], {}));
  assert.ok(dia.includes('currentColor'), 'the diagram is painted in a brand colour that may not read on the page');
});
test('a document survives a project whose ground is not one of its colourways', () => {
  const docs = require('../src/documents');
  const ctx = docs.context(HAL, halM, [], {});
  assert.ok(!(HAL.rules.colourways || []).some((c) => c.name === ctx.ground.name),
    'this fixture is meant to have no colourway named after its ground');
  assert.ok(ctx.variantFor('horizontal', ctx.ground.name), 'no fallback for a colourway that is not cut');
  assert.doesNotThrow(() => docs.guidelines(ctx));
  assert.doesNotThrow(() => require('../src/documents/deck').deck(ctx));
});
test('the renderer falls back to a colourway that reads where it is going', () => {
  const hb = bundleOf(HAL, halM);
  assert.ok(!hb.colourways.includes('pitch'), 'this fixture has no colourway named after its ground role');
  // a block asking for the ground colourway on a primary field gets one cut
  // for that field, rather than the first in the list
  const html = ER.block(EM.makeBlock('mark', { props: { colourway: 'ground', on: 'primary' } }), hb);
  assert.ok(html.includes('#101820'), `it should pick the colourway cut for bone: ${html.slice(0, 160)}`);
});
test('a mark with nothing stroked animates in one piece rather than not at all', () => {
  const hb = bundleOf(HAL, halM);
  const html = ER.block(EM.makeBlock('motion'), hb);
  assert.ok(/class="hb-out"/.test(html), 'nothing was put in the part that is animated');
  assert.ok(/no outline to draw first/.test(html), 'it should say why it is one piece');
  // Meridian is stroked, so it still splits
  assert.ok(/class="hb-fill"/.test(ER.block(EM.makeBlock('motion'), bu)));
});
test('a printed piece keeps a lockup whose colourway is not cut', () => {
  const hb = bundleOf(HAL, halM);
  const d = EM.emptyDoc('Halyard');
  d.pages[0].blocks.push(EM.makeBlock('lockup', { props: { lockup: 'horizontal', colourway: 'ground', on: 'primary' } }));
  const r = require('../src/typst').emit(d, hb, {});
  assert.deepStrictEqual(r.refused, [], 'the lockup was dropped out of the printed piece');
  assert.ok(/curve\.move/.test(r.source));
});
test('the whole package builds for a project unlike the first one', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-hal-'));
  const r = await build(HAL, dir);
  assert.ok(r.written.length > 40, `only ${r.written.length} files`);
  const bj = JSON.parse(fs.readFileSync(path.join(dir, 'brand.json'), 'utf8'));
  assert.strictEqual(bj.logo.minSize.from, 'stem');
  assert.ok(bj.logo.minSize.screenPx > 0);
  // the things this project is deliberately wrong about are all reported
  const w = r.warnings.join(' ');
  assert.ok(/no CMYK: rope/.test(w), 'the undeclared build was not reported');
  assert.ok(/282% ink/.test(w), 'the ink limit was not reported');
  assert.ok(/plain black/.test(w), 'the plain black was not reported');
  assert.ok(/no pattern was written/.test(w), 'the missing pattern source was not reported');
  fs.rmSync(dir, { recursive: true, force: true });
});

console.log('\nlicences');
const LIC = require('../src/licence');
const KEYS = LIC.keypair();
const issue = (over) => LIC.sign(Object.assign({ holder: 'Weng Studio', plan: 'solo',
  issued: '2026-01-01', expires: '2027-01-01', seats: 1 }, over), KEYS.privateKey);

test('a licence that has not been touched checks out', () => {
  const r = LIC.verify(issue(), KEYS.publicKey, new Date('2026-06-01'));
  assert.strictEqual(r.state, 'good');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.licence.holder, 'Weng Studio');
  assert.strictEqual(LIC.planOf(r).name, 'Solo');
});
test('a licence edited to a better plan is caught, and says which of the two moved', () => {
  const upgraded = Object.assign({}, issue(), { plan: 'studio' });
  const r = LIC.verify(upgraded, KEYS.publicKey, new Date('2026-06-01'));
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.state, 'altered');
  assert.ok(/edited since it was issued/.test(r.why));
  assert.strictEqual(LIC.planOf(r).name, 'Trial', 'an altered licence should fall back, not be believed');
});
test('every field is covered by the signature, not just the plan', () => {
  for (const [k, v] of Object.entries({ holder: 'Somebody Else', expires: '2099-01-01', seats: 500, email: 'x@y' })) {
    const changed = Object.assign({}, issue(), { [k]: v });
    assert.strictEqual(LIC.verify(changed, KEYS.publicKey, new Date('2026-06-01')).state, 'altered',
      `${k} can be edited without breaking the signature`);
  }
});
test('a licence signed by somebody else is not a licence', () => {
  const other = LIC.keypair();
  assert.strictEqual(LIC.verify(issue(), other.publicKey, new Date('2026-06-01')).state, 'altered');
});
test('running out is a different conversation from being forged', () => {
  const r = LIC.verify(issue(), KEYS.publicKey, new Date('2027-06-01'));
  assert.strictEqual(r.state, 'expired');
  assert.ok(/ran out on 2027-01-01/.test(r.why));
  // and a licence with no end date does not run out
  assert.strictEqual(LIC.verify(issue({ expires: '' }), KEYS.publicKey, new Date('2099-01-01')).state, 'good');
});
test('missing, unsigned and unreadable are told apart', () => {
  assert.strictEqual(LIC.verify(null, KEYS.publicKey).state, 'missing');
  assert.strictEqual(LIC.verify({ plan: 'studio' }, KEYS.publicKey).state, 'unsigned');
  assert.strictEqual(LIC.verify(issue(), 'not a key').state, 'unreadable');
});

test('a plan limit is a finding, in the same voice as everything else', () => {
  const r = LIC.verify(issue({ plan: 'trial' }), KEYS.publicKey, new Date('2026-06-01'));
  const f = LIC.check(r, project, {});
  const ways = f.find((x) => /colourways/.test(x.what));
  assert.ok(ways, 'five colourways passed on Trial');
  assert.strictEqual(ways.level, 'blocker');
  assert.ok(ways.what.includes('5') && ways.what.includes('2'), ways.what);
  assert.ok(ways.why && ways.how, 'a limit needs a why and a how like any other finding');
  assert.ok(/move to a plan/i.test(ways.how));
});
test('a feature the plan does not carry is refused by name', () => {
  const r = LIC.verify(issue({ plan: 'trial' }), KEYS.publicKey, new Date('2026-06-01'));
  const f = LIC.check(r, { rules: { colourways: [], lockups: [] } }, { print: true });
  assert.strictEqual(f.length, 1);
  assert.ok(/does not include the print path/.test(f[0].what), f[0].what);
  // and Solo carries it
  assert.deepStrictEqual(LIC.check(LIC.verify(issue(), KEYS.publicKey, new Date('2026-06-01')),
    { rules: { colourways: [], lockups: [] } }, { print: true, mockups: true, publish: true }), []);
});
test('an unlimited plan is unlimited', () => {
  const r = LIC.verify(issue({ plan: 'studio' }), KEYS.publicKey, new Date('2026-06-01'));
  assert.deepStrictEqual(LIC.check(r, project, { print: true, mockups: true, publish: true }), []);
  assert.strictEqual(LIC.PLANS.studio.colourways, Infinity);
});
test('a broken licence explains itself before the limits do', () => {
  const r = LIC.verify(Object.assign({}, issue(), { plan: 'studio' }), KEYS.publicKey, new Date('2026-06-01'));
  const f = LIC.check(r, project, {});
  assert.ok(/edited since it was issued/.test(f[0].what), 'the tampering should be the first thing said');
  assert.ok(/Trial limits/.test(f[0].why));
});

test('with no vendor key nothing is limited, which is the point', () => {
  const cfg = LIC.config({}, fs, path);
  assert.strictEqual(cfg.enforcing, false);
  assert.strictEqual(cfg.publicKey, null);
  const withKey = LIC.config({ HANDOVER_LICENCE_KEY: KEYS.publicKey }, fs, path);
  assert.strictEqual(withKey.enforcing, true);
});
test('a usage record counts what was made rather than guessing', () => {
  const r = LIC.verify(issue(), KEYS.publicKey, new Date('2026-06-01'));
  const u = LIC.usage(r, project, { written: [{ bytes: 100 }, { bytes: 50 }] });
  assert.strictEqual(u.files, 2);
  assert.strictEqual(u.bytes, 150);
  assert.strictEqual(u.holder, 'Weng Studio');
  assert.strictEqual(u.plan, 'solo');
  assert.strictEqual(u.colourways, project.rules.colourways.length);
  // and with nothing enforcing it says so rather than claiming a plan
  assert.strictEqual(LIC.usage(null, project, {}).plan, 'not enforced');
  assert.strictEqual(LIC.usage(LIC.verify(null, KEYS.publicKey), project, {}).plan, 'licence missing');
});
test('the fingerprint is short, stable, and changes when the licence does', () => {
  const a = issue(), b2 = issue({ holder: 'Someone Else' });
  assert.strictEqual(LIC.fingerprint(a), LIC.fingerprint(a));
  assert.strictEqual(LIC.fingerprint(a).length, 12);
  assert.notStrictEqual(LIC.fingerprint(a), LIC.fingerprint(b2));
  assert.strictEqual(LIC.fingerprint({}), null);
});

test('the client owns the package outright, and the package says so', () => {
  const txt = fs.readFileSync(path.join(out, 'LICENCE.txt'), 'utf8');
  assert.ok(/Every file in this package is yours/.test(txt));
  assert.ok(/It is not inherited by you, and it does not expire/.test(txt),
    'the whole argument against the tools this replaces is the inherited subscription');
  assert.ok(/Typefaces are licensed separately/.test(txt), 'it should not give away what is not ours');
  assert.ok(/Pantone/.test(txt));
});
test('the package carries a usage record to invoice from', () => {
  const u = JSON.parse(fs.readFileSync(path.join(out, 'usage.json'), 'utf8'));
  assert.strictEqual(u.brand, 'Meridian');
  assert.strictEqual(u.colourways, project.rules.colourways.length);
  assert.ok(u.files > 100 && u.bytes > 0);
  assert.ok(u.at, 'an invoice line needs a date');
});
test('brand.json says which licence the package was built under, or that none was', () => {
  const bj = JSON.parse(fs.readFileSync(path.join(out, 'brand.json'), 'utf8'));
  assert.ok('builtUnder' in bj.generated, 'a package should say what it was built under');
  assert.strictEqual(bj.generated.builtUnder, null, 'nothing is enforcing in the test run, so it should say so');
});

console.log('\nmockups');
const SU = require('../src/surface');

test('the mapping puts the corners exactly where they were asked for', () => {
  const quad = [[100, 60], [400, 20], [430, 300], [80, 260]];
  const H = SU.homography(quad);
  const corners = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => SU.project(H, u, v));
  corners.forEach((got, i) => {
    assert.ok(Math.abs(got[0] - quad[i][0]) < 1e-6 && Math.abs(got[1] - quad[i][1]) < 1e-6,
      `corner ${i} landed at ${got}, not ${quad[i]}`);
  });
});
test('a rectangle maps to itself without inventing a perspective', () => {
  const H = SU.homography([[0, 0], [200, 0], [200, 100], [0, 100]]);
  assert.strictEqual(Math.abs(H[6]), 0, 'a flat quad should have no projective term');
  assert.strictEqual(Math.abs(H[7]), 0);
  assert.deepStrictEqual(SU.project(H, 0.5, 0.5), [100, 50]);
});
test('the middle of the artwork lands inside the surface', () => {
  const quad = [[100, 60], [400, 20], [430, 300], [80, 260]];
  const [x, y] = SU.project(SU.homography(quad), 0.5, 0.5);
  assert.ok(x > 100 && x < 430 && y > 20 && y < 300, `the centre came out at ${x}, ${y}`);
});
test('a quad that folds over itself is refused, not drawn', () => {
  assert.strictEqual(SU.convex([[0, 0], [1, 0], [1, 1], [0, 1]]), true);
  assert.strictEqual(SU.convex([[0, 0], [1, 1], [1, 0], [0, 1]]), false, 'a bow tie passed as a surface');
  const f = SU.check([[0, 0], [1, 1], [1, 0], [0, 1]], { w: 400, h: 300 }, {});
  assert.strictEqual(f[0].level, 'blocker');
  assert.ok(/fold over/.test(f[0].what));
  assert.strictEqual(f.length, 1, 'nothing else is worth saying about a torn mapping');
});
test('a surface too small to show anything is worth a word', () => {
  const f = SU.check([[0.5, 0.5], [0.52, 0.5], [0.52, 0.52], [0.5, 0.52]], { w: 400, h: 300 }, {});
  assert.ok(f.some((x) => /smaller than twenty pixels/.test(x.what)), JSON.stringify(f));
});
test('a mark placed on a stated real size is checked against its own floor', () => {
  const quad = [[0.1, 0.3], [0.9, 0.3], [0.9, 0.7], [0.1, 0.7]];
  // a business card 85 mm across, with the mark filling most of it
  const ok = SU.check(quad, { w: 800, h: 500 }, { surfaceWidthMm: 85, minimumPrintMm: 9, artworkFraction: 0.7 });
  assert.deepStrictEqual(ok.filter((x) => /floor/.test(x.what)), []);
  // and a pen barrel, where it does not fit
  const tiny = SU.check(quad, { w: 800, h: 500 }, { surfaceWidthMm: 8, minimumPrintMm: 9, artworkFraction: 0.7 });
  const f = tiny.find((x) => /floor/.test(x.what));
  assert.ok(f, 'the mark was allowed below its floor on a real object');
  assert.ok(f.what.includes('9 mm'));
});

test('the blends are exactly what CSS does', () => {
  assert.strictEqual(SU.BLENDS.multiply(0.5, 0.5), 0.25);
  assert.strictEqual(SU.BLENDS.screen(0.5, 0.5), 0.75);
  assert.strictEqual(SU.BLENDS.normal(0.5, 0.9), 0.5);
  // opacity leaves the surface showing through
  const half = SU.blended('normal', { r: 0, g: 0, b: 0 }, { r: 1, g: 1, b: 1 }, 0.5);
  assert.strictEqual(half.r, 0.5);
});
test('multiply cannot lighten, and the check knows it', () => {
  const C2 = require('../src/contrast');
  const u = (hex) => { const [r, g, b] = C2.unit(hex); return { r, g, b }; };
  const card = [u('#F4F2EA'), u('#E6E3D8'), u('#CFCBBE')];
  const ways = Object.entries(bu.roles).map(([name, r]) => ({ name, hex: r.hex }));

  const light = SU.advise(C2, { ink: u('#EFEDE4'), inkName: 'ground', patches: card,
    mode: 'multiply', opacity: 1, colourways: ways });
  assert.strictEqual(light.ok, false, 'chalk multiplied onto a chalk card was passed');
  assert.ok(light.ratio < 1.5);
  assert.ok(/Multiply can only darken/.test(light.finding.why), light.finding.why);
  assert.ok(/primary/.test(light.finding.how), light.finding.how);

  const dark = SU.advise(C2, { ink: u('#0A2A33'), inkName: 'primary', patches: card,
    mode: 'multiply', opacity: 1, colourways: ways });
  assert.strictEqual(dark.ok, true, `deep ink on a light card should read: ${dark.ratio}`);
  assert.ok(dark.ratio > 8);
});
test('screen cannot darken, and says so', () => {
  const C2 = require('../src/contrast');
  const u = (hex) => { const [r, g, b] = C2.unit(hex); return { r, g, b }; };
  const dark = [u('#12181B'), u('#0E1417')];
  const a = SU.advise(C2, { ink: u('#0A2A33'), inkName: 'primary', patches: dark,
    mode: 'screen', opacity: 1, colourways: Object.entries(bu.roles).map(([name, r]) => ({ name, hex: r.hex })) });
  assert.strictEqual(a.ok, false);
  assert.ok(/Screen can only lighten/.test(a.finding.why));
  assert.ok(/ground|chalk/i.test(a.finding.how), a.finding.how);
});
test('when nothing in the palette reads, it says that rather than guessing', () => {
  const C2 = require('../src/contrast');
  const mid = [{ r: 0.42, g: 0.44, b: 0.43 }];
  const a = SU.advise(C2, { ink: { r: 0.42, g: 0.44, b: 0.43 }, inkName: 'x', patches: mid,
    mode: 'normal', opacity: 1, colourways: [{ name: 'same', hex: '#6B7069' }] });
  assert.strictEqual(a.ok, false);
  assert.ok(/Nothing in the palette/.test(a.finding.how), a.finding.how);
});

console.log('\na mockup on the page');
test('a mockup with no photograph asks for one', () => {
  const html = ER.block(EM.makeBlock('surface'), bu);
  assert.ok(/drop a photograph here/.test(html));
});
test('the artwork is mapped into the surface, not pasted flat on it', () => {
  const st = IM.store();
  const id = st.add(PNG_A, { w: 1400, h: 1000, name: 'card.jpg' });
  const b = EM.makeBlock('surface', { w: 600, h: 400, props: { image: id } });
  const html = ER.block(b, Object.assign({}, bu, { images: st.all() }));
  assert.ok(/matrix3d\(/.test(html), 'there is no perspective mapping');
  assert.ok(/mix-blend-mode:multiply/.test(html), 'the photograph\'s shading is not coming through');
  assert.ok(/<img draggable="false"/.test(html), 'the photograph is draggable');
  // the corners of the mapped artwork sit on the quad
  const m = html.match(/matrix3d\(([^)]+)\)/)[1].split(',').map(Number);
  assert.ok(m.every((n) => isFinite(n)), 'the transform has a number that is not a number in it');
});
test('a photograph in a mockup is not draggable, or the drag is swallowed', () => {
  // regression: a browser starts its own image drag as soon as the pointer
  // moves over a picture, and every event after that goes to the drag rather
  // than to the corner you were moving
  const st = IM.store();
  const id = st.add(PNG_A, { w: 800, h: 600 });
  for (const t of ['slot', 'surface']) {
    const html = ER.block(EM.makeBlock(t, { props: { image: id } }), Object.assign({}, bu, { images: st.all() }));
    assert.ok(/<img draggable="false"/.test(html), `${t} emits a draggable photograph`);
  }
});
test('a mockup can carry the mark, a lockup or the pattern', () => {
  const st = IM.store();
  const id = st.add(PNG_A, { w: 800, h: 600 });
  const bun = Object.assign({}, bu, { images: st.all() });
  for (const art of ['lockup', 'mark', 'pattern']) {
    const html = ER.block(EM.makeBlock('surface', { props: { image: id, art } }), bun);
    assert.ok(/<svg/.test(html), `${art} put nothing on the surface`);
  }
});
test('a mockup keeps its photograph when the document is saved', () => {
  const st = IM.store();
  const id = st.add(PNG_A, { w: 800, h: 600 });
  const d = EM.emptyDoc('Meridian');
  d.pages[0].blocks.push(EM.makeBlock('surface', { props: { image: id } }));
  assert.deepStrictEqual([...IM.used(d)], [id], 'a mockup photograph would be pruned away');
  st.prune(d);
  assert.strictEqual(st.count(), 1);
});
test('the corners are fractions, so the mapping survives a resize', () => {
  const b = EM.makeBlock('surface');
  assert.strictEqual(b.props.quad.length, 4);
  for (const [u, v] of b.props.quad) {
    assert.ok(u >= 0 && u <= 1 && v >= 0 && v <= 1, `a corner is outside the block: ${u}, ${v}`);
  }
  assert.strictEqual(EM.kindOf('surface'), 'plain');
});

console.log('\npath translation');
const PA = require('../src/paths');
const at = (segs, i) => segs[i];

test('every kind of command comes out as move, line or cubic', () => {
  const segs = PA.parse('M10 10 H50 V50 L10 50 Z');
  assert.deepStrictEqual(segs.map((s) => s.op), ['move', 'line', 'line', 'line', 'close']);
  assert.deepStrictEqual(at(segs, 1).to, [50, 10]);
  assert.deepStrictEqual(at(segs, 2).to, [50, 50]);
});
test('relative commands accumulate and close resets the pen', () => {
  const segs = PA.parse('m10 10 l20 0 l0 20 z l5 5');
  assert.deepStrictEqual(segs.map((s) => s.op), ['move', 'line', 'line', 'close', 'line']);
  assert.deepStrictEqual(segs[2].to, [30, 30]);
  assert.deepStrictEqual(segs[4].to, [15, 15], 'the pen did not go back to the start of the subpath');
});
test('a move followed by loose numbers continues as a line', () => {
  assert.deepStrictEqual(PA.parse('M0 0 10 0 10 10').map((s) => s.op), ['move', 'line', 'line']);
});
test('a quadratic becomes exactly the same curve as a cubic', () => {
  // both evaluated at the midpoint, where any error would show
  const p0 = [0, 0], q = [10, 0], p1 = [10, 10];
  const [c1, c2, to] = PA.quadToCubic(p0, q, p1);
  const quad = (t) => [0, 1].map((i) =>
    (1 - t) * (1 - t) * p0[i] + 2 * (1 - t) * t * q[i] + t * t * p1[i]);
  const cubic = (t) => [0, 1].map((i) =>
    Math.pow(1 - t, 3) * p0[i] + 3 * Math.pow(1 - t, 2) * t * c1[i]
    + 3 * (1 - t) * t * t * c2[i] + t * t * t * to[i]);
  for (const t of [0.25, 0.5, 0.75]) {
    const a = quad(t), b = cubic(t);
    assert.ok(Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9, `they part company at t=${t}`);
  }
});
test('a shorthand curve reflects the last control point', () => {
  const segs = PA.parse('M0 0 C5 0 10 5 10 10 S20 20 20 10');
  assert.deepStrictEqual(segs[2].c1, [10, 15], 'the reflection is wrong');
  // and with no cubic before it, the control point is the current point
  assert.deepStrictEqual(PA.parse('M5 5 S20 20 20 10')[1].c1, [5, 5]);
});
test('an arc is cut into quarter turns and lands where it should', () => {
  // a half circle of radius 50, from the top of the mark's ring
  const cubics = PA.arcToCubics([60, 10], 50, 50, 0, 1, 0, [60, 110]);
  assert.strictEqual(cubics.length, 2, 'a half turn should be two pieces');
  const end = cubics[cubics.length - 1][2];
  assert.ok(Math.abs(end[0] - 60) < 0.01 && Math.abs(end[1] - 110) < 0.01, `it ended at ${end}`);
  // and every control point stays within the circle's bounding box, give or take
  for (const [c1, c2] of cubics) {
    for (const p of [c1, c2]) {
      assert.ok(p[0] > 5 && p[0] < 115 && p[1] > 5 && p[1] < 115, `a control point escaped: ${p}`);
    }
  }
});
test('radii too small for the endpoints are scaled up rather than refused', () => {
  const c = PA.arcToCubics([0, 0], 1, 1, 0, 0, 1, [100, 0]);
  assert.ok(c.length >= 1);
  const end = c[c.length - 1][2];
  assert.ok(Math.abs(end[0] - 100) < 0.01, 'the arc did not reach its endpoint');
});
test('an arc that goes nowhere draws nothing surprising', () => {
  assert.deepStrictEqual(PA.arcToCubics([5, 5], 10, 10, 0, 0, 1, [5, 5]), [[[5, 5], [5, 5], [5, 5]]]);
  assert.deepStrictEqual(PA.arcToCubics([0, 0], 0, 10, 0, 0, 1, [9, 9]), [[[9, 9], [9, 9], [9, 9]]]);
});

test('a group transform is composed, not ignored', () => {
  // regression: a lockup keeps its parts in transformed groups, and paths
  // scraped out without them drew on top of each other
  const m = PA.parseTransform('translate(-5.5 -5.5) scale(1)');
  assert.deepStrictEqual(PA.applyTo(m, [60, 10]), [54.5, 4.5]);
  const both = PA.multiply(PA.parseTransform('translate(100 0)'), PA.parseTransform('scale(2)'));
  assert.deepStrictEqual(PA.applyTo(both, [10, 10]), [120, 20], 'the order of composition is wrong');
});
test('every transform the artwork can carry is understood', () => {
  assert.deepStrictEqual(PA.applyTo(PA.parseTransform('matrix(2 0 0 2 5 5)'), [1, 1]), [7, 7]);
  const r = PA.applyTo(PA.parseTransform('rotate(90)'), [1, 0]);
  assert.ok(Math.abs(r[0]) < 1e-9 && Math.abs(r[1] - 1) < 1e-9, `rotate(90) gave ${r}`);
  const rc = PA.applyTo(PA.parseTransform('rotate(180 5 5)'), [0, 0]);
  assert.ok(Math.abs(rc[0] - 10) < 1e-9 && Math.abs(rc[1] - 10) < 1e-9, `rotate about a centre gave ${rc}`);
  assert.strictEqual(PA.scaleOf(PA.parseTransform('scale(3)')), 3);
});
test('a translated shape keeps its shape', () => {
  const segs = PA.parse('M0 0 C5 0 10 5 10 10');
  const moved = PA.transformSegs(segs, PA.parseTransform('translate(10 20)'));
  assert.deepStrictEqual(moved[1].c1, [15, 20]);
  assert.deepStrictEqual(moved[1].to, [20, 30]);
  assert.strictEqual(PA.transformSegs([{ op: 'close' }], PA.parseTransform('scale(2)'))[0].op, 'close');
});
test('the smaller vocabulary says the same drawing', () => {
  const d = 'M60 10a50 50 0 1 0 0 100 50 50 0 1 0 0-100z';
  const again = PA.toPathData(PA.parse(d));
  assert.ok(/^M60 10C/.test(again), again.slice(0, 20));
  assert.ok(again.endsWith('Z'));
  // and it survives a second pass unchanged, which a lossy translation would not
  assert.strictEqual(PA.toPathData(PA.parse(again)), again);
});

console.log('\na printed piece');
const TY = require('../src/typst');

function piece(build) {
  const d = EM.emptyDoc('Meridian');
  EM.ops.setPageSize(d, null, 'a4');
  build(d, d.pages[0], EM.sheet('a4'));
  return TY.emit(d, bu, {});
}

test('a printed piece is not a manual, and says what it left out', () => {
  const r = piece((d, p, sh) => {
    p.blocks.push(EM.makeBlock('fill', { x: 0, y: 0, w: sh.w, h: sh.h }, sh));
    p.blocks.push(EM.makeBlock('contrast', {}, sh));
    p.blocks.push(EM.makeBlock('minimumSize', {}, sh));
  });
  assert.deepStrictEqual(r.refused.map((x) => x.type).sort(), ['contrast', 'minimumSize']);
  assert.ok(!/contrast/.test(r.source), 'a refused block was half drawn anyway');
});
test('a declared colour is written as ink, and nothing else is', () => {
  const r = piece((d, p, sh) => {
    p.blocks.push(EM.makeBlock('fill', { x: 0, y: 0, w: sh.w, h: sh.h, props: { colour: 'primary' } }, sh));
  });
  assert.ok(r.source.includes('cmyk(88%, 58%, 45%, 72%)'), 'the declared build did not reach the page');
  assert.ok(!/rgb\(/.test(r.source), 'a screen colour reached a printed piece');
  assert.deepStrictEqual(r.screenColours, []);
});
test('a colour with no build is written as screen colour and reported', () => {
  const thin = Object.assign({}, bu, { colours: Object.assign({}, bu.colours,
    { deep: Object.assign({}, bu.colours.deep, { cmyk: null }) }) });
  delete thin.__ink;
  const d = EM.emptyDoc('Meridian');
  EM.ops.setPageSize(d, null, 'a4');
  d.pages[0].blocks.push(EM.makeBlock('fill', { props: { colour: 'primary' } }, EM.sheet('a4')));
  const r = TY.emit(d, thin, {});
  assert.ok(/rgb\("#0A2A33"\)/.test(r.source), 'it should fall back rather than invent a build');
  assert.deepStrictEqual(r.screenColours, ['#0A2A33'], 'the fallback was not reported');
});
test('the mark is redrawn as curves, not embedded', () => {
  const r = piece((d, p, sh) => {
    p.blocks.push(EM.makeBlock('lockup', { x: 70, y: 300, w: 654, h: 180,
      props: { lockup: 'horizontal', colourway: 'ground', on: 'none' } }, sh));
  });
  assert.ok(/curve\.move/.test(r.source) && /curve\.cubic/.test(r.source), 'no curves were emitted');
  assert.ok(!/image\(/.test(r.source), 'the artwork was embedded, which would arrive in RGB');
  // both parts of the lockup, each in the colourway's ink
  assert.ok((r.source.match(/#place\(dx: 0pt, dy: 0pt, curve\(/g) || []).length >= 2, 'only one shape was drawn');
  assert.ok(r.source.includes('cmyk(3%, 3%, 8%, 0%)'), 'the chalk colourway was not written as ink');
});
test('copy is a string, so markup in it stays what it says', () => {
  // regression: a markup block reads *stars* as bold and _underscores_ as
  // italic, so a line would print styled differently from the canvas
  const r = piece((d, p, sh) => {
    p.blocks.push(EM.makeBlock('text', { x: 40, y: 40, w: 600, h: 100,
      props: { text: 'Rates from *2019*, "up" 12%\nand _rising_', style: 'Body', colour: 'primary' } }, sh));
  });
  assert.ok(r.source.includes('"Rates from *2019*, \\"up\\" 12%\\nand _rising_"'),
    `the copy was not emitted verbatim:\n${r.source.split('\n').find((l) => /Rates/.test(l))}`);
  assert.ok(!/\[Rates/.test(r.source), 'the copy went into a markup block');
});
test('the page is the media box, and the blocks are offset into it', () => {
  const plain = piece((d, p, sh) => p.blocks.push(EM.makeBlock('fill', { x: 0, y: 0, w: 100, h: 100 }, sh)));
  assert.ok(plain.source.includes('width: 595.5pt, height: 842.25pt'), 'an A4 page is not 595.5 by 842.25 pt');

  const d = EM.emptyDoc('Meridian');
  EM.ops.setPageSize(d, null, 'a4');
  EM.ops.setBleed(d, 3);
  d.pages[0].blocks.push(EM.makeBlock('fill', { x: 100, y: 100, w: 100, h: 100 }, EM.sheet('a4')));
  const bled = TY.emit(d, bu, {});
  assert.ok(/width: 640.5pt, height: 886.5pt/.test(bled.source), 'the page did not grow for the bleed and marks');
  // 100 px in, plus the 30 and 29.5 px the media box adds on each side
  assert.ok(/dx: 97.5pt, dy: 97.125pt/.test(bled.source), 'the block was not offset into the media box');
});
test('a block against an edge bleeds in print too', () => {
  const d = EM.emptyDoc('Meridian');
  EM.ops.setPageSize(d, null, 'a4');
  EM.ops.setBleed(d, 3);
  const sh = EM.sheet('a4');
  d.pages[0].blocks.push(EM.makeBlock('fill', { x: 0, y: 0, w: sh.w, h: sh.h }, sh));
  const r = TY.emit(d, bu, {});
  assert.ok(/width: 612.51pt/.test(r.source), 'the full-bleed field was not painted past the trim');
});
test('crop marks are drawn in the piece as well', () => {
  const d = EM.emptyDoc('Meridian');
  EM.ops.setPageSize(d, null, 'a4');
  EM.ops.setBleed(d, 3);
  const r = TY.emit(d, bu, {});
  assert.strictEqual((r.source.match(/cmyk\(0%, 0%, 0%, 100%\)/g) || []).length, 8, 'there should be eight marks');
});
test('the fonts a piece needs are named', () => {
  const r = piece((d, p, sh) => {
    p.blocks.push(EM.makeBlock('text', { props: { style: 'H1', text: 'x' } }, sh));
    p.blocks.push(EM.makeBlock('text', { props: { style: 'Body', text: 'y' } }, sh));
  });
  assert.deepStrictEqual(r.fonts.sort(), ['Archivo', 'Literata']);
});

console.log('\nbleed, trim and crop marks');
const PRN = require('../src/print');
const pxOfCss = (css) => css.split(' ').map((v) => {
  const n = parseFloat(v);
  return v.endsWith('mm') ? n * 96 / 25.4 : v.endsWith('in') ? n * 96 : n;
});

test('no bleed changes nothing at all', () => {
  const a4 = EM.sheet('a4');
  const b = PRN.boxes(a4, {});
  assert.deepStrictEqual(b.media, { w: a4.w, h: a4.h });
  assert.strictEqual(b.offset, 0);
  assert.strictEqual(b.marks, false);
  assert.strictEqual(b.css, a4.css);
  assert.strictEqual(PRN.marks(b), '');
  assert.strictEqual(PRN.bleedBox({ type: 'fill', x: 0, y: 0, w: a4.w, h: a4.h }, a4, b), null);
  assert.deepStrictEqual(PRN.check({ blocks: [{ id: 'x', type: 'fill', x: 3, y: 0, w: 10, h: 10 }] }, a4, b), []);
});
test('the sheet grows by the bleed plus room for the marks', () => {
  const a4 = EM.sheet('a4');
  const b = PRN.boxes(a4, { bleed: 3 });
  assert.strictEqual(b.css, '226mm 313mm', `210 + 2 x (3 + 5) should be 226: got ${b.css}`);
  assert.deepStrictEqual(b.bleedBox, { w: 816.68, h: 1145.68 });
  assert.strictEqual(b.trim.w, 794);
  assert.ok(b.offset > 0 && b.offsetY > 0);
});
test('the page element always fits inside the paper it is printed on', () => {
  // regression: the pixel media box and the physical @page were rounded
  // separately, so an A4 page came out a third of a pixel too tall and every
  // sheet spilled onto a second one
  for (const key of Object.keys(EM.SHEETS)) {
    const s = EM.sheet(key), b = PRN.boxes(s, { bleed: 3 });
    const [w, h] = pxOfCss(b.css);
    assert.ok(b.media.w <= w + 0.01, `${key} is ${b.media.w} px wide on paper ${w} px wide`);
    assert.ok(b.media.h <= h + 0.01, `${key} is ${b.media.h} px tall on paper ${h} px tall`);
    assert.ok(w - b.media.w < 2 && h - b.media.h < 2, `${key} wastes more than a pixel of paper`);
  }
});
test('a bleed in millimetres works on a page measured in inches or pixels', () => {
  // regression: millimetres were added to inches, so US Letter came out three
  // times the size it should have been
  const letter = EM.sheet('letter'), b = PRN.boxes(letter, { bleed: 3 });
  assert.strictEqual(b.css, '9.13in 11.63in', `8.5 + 2 x (8/25.4) should be 9.13: got ${b.css}`);
  assert.ok(b.media.w < letter.w * 1.2, 'the media box is wildly bigger than the page');
  const slide = EM.sheet('slide-16x9'), c = PRN.boxes(slide, { bleed: 3 });
  const [w] = pxOfCss(c.css);
  assert.ok(Math.abs(c.media.w - w) < 2, `the pixel page and its @page disagree: ${c.media.w} vs ${w}`);
});

test('a block against an edge is painted out past the trim, and one that is not is left alone', () => {
  const a4 = EM.sheet('a4'), b = PRN.boxes(a4, { bleed: 3 });
  const at = (t, x, y, w, h) => PRN.bleedBox({ type: t, x, y, w, h }, a4, b);
  const full = at('fill', 0, 0, a4.w, a4.h);
  assert.deepStrictEqual([full.x, full.y], [-b.bleed, -b.bleed]);
  assert.strictEqual(Math.round(full.w), Math.round(a4.w + b.bleed * 2));
  const leftOnly = at('slot', 0, 100, 200, 200);
  assert.strictEqual(leftOnly.x, -b.bleed);
  assert.strictEqual(leftOnly.h, 200, 'a block bled off an edge it was nowhere near');
  assert.strictEqual(at('fill', 50, 100, 200, 200), null, 'a floating block was stretched');
});
test('words never bleed, because widening their box would move them', () => {
  const a4 = EM.sheet('a4'), b = PRN.boxes(a4, { bleed: 3 });
  for (const t of ['text', 'rule', 'lockup', 'mark', 'palette']) {
    assert.strictEqual(PRN.bleedBox({ type: t, x: 0, y: 0, w: a4.w, h: a4.h }, a4, b), null,
      `${t} was painted into the bleed`);
  }
  for (const t of PRN.BLEEDS) {
    assert.ok(PRN.bleedBox({ type: t, x: 0, y: 0, w: a4.w, h: a4.h }, a4, b), `${t} did not bleed`);
  }
});

test('the marks are eight lines, at the trim corners, on the paper', () => {
  const a4 = EM.sheet('a4'), b = PRN.boxes(a4, { bleed: 3 });
  const svg = PRN.marks(b);
  const d = svg.match(/d="([^"]+)"/)[1];
  assert.strictEqual(d.split('M').length - 1, 8, 'there should be two marks at each of four corners');
  const nums = [...d.matchAll(/-?[\d.]+/g)].map(Number);
  assert.ok(Math.min(...nums) >= -0.01, 'a mark runs off the top or left of the sheet');
  assert.ok(Math.max(...nums) <= Math.max(b.media.w, b.media.h) + 0.01, 'a mark runs off the bottom or right');
  // and the gap between the mark and the page is the bleed, so a mark never
  // crosses artwork
  assert.ok(d.includes(`M${b.offset} 0V`), `the top-left vertical is not at the trim edge: ${d.slice(0, 40)}`);
});
test('marks are not drawn when there is no room for them', () => {
  const a4 = EM.sheet('a4');
  assert.strictEqual(PRN.marks(PRN.boxes(a4, { bleed: 3, marks: false })), '');
  assert.strictEqual(PRN.boxes(a4, { bleed: 3, marks: false }).css, '216mm 303mm',
    'turning the marks off should still leave the bleed');
});

test('a block that stops just short of the edge is the mistake worth catching', () => {
  const a4 = EM.sheet('a4'), b = PRN.boxes(a4, { bleed: 3 });
  const pg = { blocks: [{ id: 'a', type: 'fill', x: 3, y: 0, w: a4.w - 6, h: a4.h }] };
  const f = PRN.check(pg, a4, b, () => 'The colour field');
  assert.strictEqual(f.length, 1);
  assert.ok(/3 px from the left and 3 px from the right/.test(f[0].what), f[0].what);
  assert.ok(/white line/.test(f[0].why));
  // and a block properly on the edge says nothing
  assert.deepStrictEqual(PRN.check({ blocks: [{ id: 'a', type: 'fill', x: 0, y: 0, w: a4.w, h: a4.h }] }, a4, b), []);
});
test('type inside the trim margin is reported, in millimetres', () => {
  const a4 = EM.sheet('a4'), b = PRN.boxes(a4, { bleed: 3 });
  const f = PRN.check({ blocks: [{ id: 't', type: 'text', x: 4, y: 400, w: 300, h: 60 }] }, a4, b, () => 'Text');
  assert.strictEqual(f.length, 1);
  assert.ok(/within 3 mm of the left edge/.test(f[0].what), f[0].what);
  assert.ok(/guillotine/.test(f[0].why));
  assert.deepStrictEqual(
    PRN.check({ blocks: [{ id: 't', type: 'text', x: 60, y: 400, w: 300, h: 60 }] }, a4, b), [],
    'type well inside the page was reported anyway');
});

test('the bleed belongs to the document and survives a change of size', () => {
  const d = EM.emptyDoc('T');
  EM.ops.setPageSize(d, null, 'a4');
  EM.ops.setBleed(d, 3);
  assert.deepStrictEqual(EM.printSpec(d), { bleed: 3, marks: true });
  EM.ops.setPageSize(d, null, 'a5');
  assert.strictEqual(EM.printSpec(d).bleed, 3, 'resizing the document threw the print spec away');
  EM.ops.setBleed(d, 0);
  assert.strictEqual(EM.printSpec(d).bleed, 0);
  assert.ok(!('bleed' in d.page), 'turning bleed off left it in the document');
});

test('publishing keeps the trim on screen and the media box on paper', () => {
  const d = EM.emptyDoc('Meridian');
  d.pages[0].blocks.push(EM.makeBlock('fill', { x: 0, y: 0, w: 1280, h: 720 }));
  EM.ops.setPageSize(d, null, 'a4');
  EM.ops.setBleed(d, 3);
  const html = publish(d, bu, { builtAt: 'fixed' });
  assert.ok(html.includes('.hs0{width:794px;height:1123px}'), 'the screen page is not the trim size');
  assert.ok(/@media print\{\.hs0\{width:854px;height:1182px}/.test(html), 'the printed page is not the media box');
  assert.ok(html.includes('@page{size:226mm 313mm;margin:0}'), 'the paper is not the media size');
  assert.ok(html.includes('class="hp-marks"'), 'no crop marks');
  assert.ok(html.includes('hb-block bleeds'), 'nothing was painted into the bleed');
  assert.ok(html.includes('<div class="hp-trim">'), 'there is no trim box to offset');
});
test('a document with no bleed publishes exactly as it did before', () => {
  const d = EM.emptyDoc('Meridian');
  d.pages[0].blocks.push(EM.makeBlock('fill', { x: 0, y: 0, w: 1280, h: 720 }));
  const html = publish(d, bu, { builtAt: 'fixed' });
  assert.ok(!html.includes('hp-marks'), 'the bleed stylesheet was written for a document that asked for none');
  assert.ok(!html.includes('bleeds'), 'a block was painted past a trim that does not exist');
  assert.ok(html.includes('@page{size:1280px 720px;margin:0}'));
  assert.ok(!/@media print\{\.hs0\{width:/.test(html), 'a print size was written for a page that needs none');
});

console.log('\nimage slots');
const IM = require('../src/editor/images');
// a 4x4 red PNG and a 2x2 one, enough to be real data URIs without a fixture
const PNG_A = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAFElEQVR4nGP8z8DAwMDAwMBEHAEAJgUCAWy2CBcAAAAASUVORK5CYII=';
const PNG_B = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR4nGP8//8/AzJgYkAD5AsAAJ4EAxwJZDIAAAAASUVORK5CYII=';

test('an image is keyed by its content, so the same one twice is stored once', () => {
  const st = IM.store();
  const a = st.add(PNG_A, { w: 4, h: 4 });
  const b = st.add(PNG_A, { w: 4, h: 4 });
  assert.strictEqual(a, b);
  assert.strictEqual(st.count(), 1);
  assert.notStrictEqual(st.add(PNG_B, { w: 2, h: 2 }), a);
  assert.strictEqual(st.count(), 2);
});
test('anything that is not an image is refused', () => {
  const st = IM.store();
  assert.throws(() => st.add('data:text/html,<b>hi</b>'), /not an image/);
  assert.throws(() => st.add('/photos/beach.jpg'), /not an image/);
});
test('the document holds an id and never the bytes', () => {
  const st = IM.store();
  const id = st.add(PNG_A, { w: 4, h: 4, name: 'beach.jpg' });
  const d = EM.emptyDoc('Meridian');
  d.pages[0].blocks.push(EM.makeBlock('slot', { props: { image: id } }));
  const json = JSON.stringify(d);
  assert.ok(!/data:image/.test(json), 'a photograph got into the document, which undo clones sixty deep');
  assert.ok(json.includes(id));
  assert.deepStrictEqual([...IM.used(d)], [id]);
});
test('only the images a document uses travel with it', () => {
  const st = IM.store();
  const kept = st.add(PNG_A, { w: 4, h: 4 }), dropped = st.add(PNG_B, { w: 2, h: 2 });
  const d = EM.emptyDoc('Meridian');
  d.pages[0].blocks.push(EM.makeBlock('slot', { props: { image: kept } }));
  const out = IM.forDoc(d, st.all());
  assert.deepStrictEqual(Object.keys(out), [kept]);
  st.prune(d);
  assert.strictEqual(st.count(), 1);
  assert.ok(!st.has(dropped), 'an image nothing points at stayed in the store forever');
});
test('an image too small for its box is a warning, with both numbers', () => {
  const f = IM.check({ w: 600, h: 400 }, { w: 420, h: 280 }, 'beach.jpg');
  assert.strictEqual(f.length, 1);
  assert.strictEqual(f[0].level, 'warning');
  assert.ok(f[0].what.includes('600 by 400') && f[0].what.includes('840 by 560'),
    'the finding does not say what it has and what it wants');
  assert.deepStrictEqual(IM.check({ w: 1600, h: 1000 }, { w: 420, h: 280 }), []);
  assert.deepStrictEqual(IM.check({ vector: true, w: 0, h: 0 }, { w: 999, h: 999 }), [],
    'vector art was measured for resolution it does not have');
});

console.log('\na mark on a photograph');
test('cover fills the box and crops, contain fits inside it', () => {
  const im = { w: 1600, h: 1000 }, box = { w: 420, h: 280 };
  const cover = IM.sourceRect(im, box, { fit: 'cover', focusX: 50, focusY: 50 });
  assert.strictEqual(Math.round(cover.scale * 10000), 2800);      // 280/1000, the larger
  assert.ok(cover.drawnW > box.w, 'cover did not overflow the box');
  const contain = IM.sourceRect(im, box, { fit: 'contain' });
  assert.strictEqual(Math.round(contain.scale * 10000), 2625);    // 420/1600, the smaller
  assert.ok(contain.drawnH < box.h);
});
test('the focal point decides which part of the picture is kept', () => {
  const im = { w: 1600, h: 1000 }, box = { w: 420, h: 280 };
  const left = IM.sourceRect(im, box, { fit: 'cover', focusX: 0, focusY: 50 });
  const right = IM.sourceRect(im, box, { fit: 'cover', focusX: 100, focusY: 50 });
  assert.strictEqual(left.toSource({ x: 0, y: 0, w: 1, h: 1 }).x, 0, 'focus left did not start at the left edge');
  assert.ok(right.toSource({ x: 0, y: 0, w: 1, h: 1 }).x > 90, 'focus right kept the left of the picture');
});
test('a rectangle on the page maps back to a rectangle in the photograph', () => {
  const geo = IM.sourceRect({ w: 1600, h: 1000 }, { w: 400, h: 250 }, { fit: 'cover', focusX: 50, focusY: 50 });
  const whole = geo.toSource({ x: 0, y: 0, w: 400, h: 250 });
  assert.strictEqual(Math.round(whole.w), 1600);
  assert.strictEqual(Math.round(whole.h), 1000);
});
test('two blocks that do not touch have nothing to say to each other', () => {
  assert.strictEqual(IM.overlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 50, y: 50, w: 10, h: 10 }), null);
  assert.deepStrictEqual(IM.overlap({ x: 100, y: 100, w: 400, h: 300 }, { x: 300, y: 200, w: 200, h: 200 }),
    { x: 200, y: 100, w: 200, h: 200 });
});
test('the worst patch decides, not the average', () => {
  // a picture that is dark almost everywhere and blown out in one corner
  const dark = { luminance: 0.02 }, blown = { luminance: 0.95 };
  const patches = [dark, dark, dark, dark, dark, dark, dark, blown];
  const v = IM.overlayVerdict('#0A2A33', patches, {});
  assert.ok(!v.passes, 'a mark that vanishes in one corner was passed on the average');
  assert.ok(v.mean > v.ratio, 'the average was reported instead of the worst part');
  assert.ok(v.finding.what.includes(String(v.ratio)));
  assert.ok(/lightest part/.test(v.finding.what));
});
test('a mark that holds everywhere raises nothing', () => {
  const v = IM.overlayVerdict('#0A2A33', [{ luminance: 0.8 }, { luminance: 0.9 }], {});
  assert.ok(v.passes);
  assert.ok(!v.finding);
  assert.ok(v.ratio >= IM.NONTEXT);
});
test('when the mark fails, the colourway that would work is named', () => {
  const patches = [{ luminance: 0.02 }, { luminance: 0.05 }];
  const ways = Object.entries(bu.roles).map(([name, r]) => ({ name, hex: r.hex }));
  const better = IM.bestColourway(ways, patches);
  assert.ok(better, 'nothing was suggested for a mark on a dark picture');
  assert.ok(better.ratio >= IM.NONTEXT);
  assert.strictEqual(better.hex, bu.roles[better.name].hex);
  // and nothing is suggested when nothing would work
  assert.strictEqual(IM.bestColourway([{ name: 'x', hex: '#808080' }], [{ luminance: 0.21 }]), null);
});

console.log('\ndrawing an image slot');
const withImage = (props) => {
  const st = IM.store();
  const id = st.add(PNG_A, { w: 1600, h: 1000, name: 'beach.jpg' });
  const b = EM.makeBlock('slot', { props: Object.assign({ image: id }, props) });
  return { html: ER.block(b, Object.assign({}, bu, { images: st.all() })), id, b };
};
test('an empty slot asks for a file, and a filled one shows it', () => {
  assert.ok(ER.block(EM.makeBlock('slot'), bu).includes('drop an image here'));
  assert.ok(/<img[^>]+src="data:image\/png/.test(withImage().html));
});
test('fit and the focal point reach the markup', () => {
  assert.ok(withImage({ fit: 'contain' }).html.includes('object-fit:contain'));
  const h = withImage({ fit: 'cover', focusX: 20, focusY: 80 }).html;
  assert.ok(h.includes('object-fit:cover') && h.includes('object-position:20% 80%'));
});
test('a caption makes it a figure, and is set in the brand\'s own caption style', () => {
  const h = withImage({ caption: 'Coastal light' }).html;
  assert.ok(h.includes('<figure') && h.includes('<figcaption'));
  assert.ok(h.includes('Coastal light'));
  assert.ok(!withImage().html.includes('<figcaption'), 'an uncaptioned image drew an empty caption');
});
test('a caption is escaped rather than injected', () => {
  const h = withImage({ caption: '<img src=x onerror=alert(1)>' }).html;
  assert.ok(!/onerror=alert/.test(h.replace(/&lt;[^&]*/g, '')), 'markup in a caption was not escaped');
  assert.ok(h.includes('&lt;img'));
});
test('a block laid on a photograph can have no ground of its own', () => {
  assert.strictEqual(ER.colour(bu, 'none'), 'transparent');
  const h = ER.block(EM.makeBlock('mark', { props: { colourway: 'primary', on: 'none' } }), bu);
  assert.ok(h.includes('background:transparent'), 'a mark over a picture still painted a rectangle behind itself');
});

console.log('\npublishing');
const { publish } = require('../src/editor/publish');
const pubDoc = starterDoc(bu);
test('a published page holds every page of the document', () => {
  const html = publish(pubDoc, bu, {});
  const count = (html.match(/class="hp-page /g) || []).length;
  assert.strictEqual(count, pubDoc.pages.length);
});
test('the document stores layout, never a measurement', () => {
  const json = JSON.stringify(pubDoc);
  for (const n of [String(m.markInk.w), String(m.clearSpace), String(m.minimumSize.screenPx)]) {
    assert.ok(!json.includes(`:${n},`) && !json.includes(`:${n}}`),
      `the document has ${n} baked into it, so it would go stale`);
  }
});
test('the same document republished after a change to the master says the new numbers', async () => {
  const before = publish(pubDoc, bu, { builtAt: 'fixed' });
  const thickSrc = project.assets.mark.source.replace('stroke-width="9"', 'stroke-width="14"');
  const altered = Object.assign({}, project, {
    assets: Object.assign({}, project.assets, { mark: Object.assign({}, project.assets.mark, { source: thickSrc }) }),
  });
  const m2 = measure(altered);
  const after = publish(pubDoc, bundle(altered, m2, []), { builtAt: 'fixed' });
  assert.notStrictEqual(m2.minimumSize.screenPx, m.minimumSize.screenPx, 'the master did not actually change');
  assert.ok(before.includes(`${m.minimumSize.screenPx} px · the floor`), 'the first publish is wrong');
  assert.ok(after.includes(`${m2.minimumSize.screenPx} px · the floor`), 'the republish did not pick up the change');
  assert.ok(!after.includes(`${m.minimumSize.screenPx} px · the floor`), 'the old figure survived the republish');
});
test('a moved block stays moved when the master changes', async () => {
  const moved = EM.clone(pubDoc);
  moved.pages[1].blocks[1].x = 40;
  const thickSrc = project.assets.mark.source.replace('stroke-width="9"', 'stroke-width="14"');
  const altered = Object.assign({}, project, {
    assets: Object.assign({}, project.assets, { mark: Object.assign({}, project.assets.mark, { source: thickSrc }) }),
  });
  const after = publish(moved, bundle(altered, measure(altered), []), {});
  assert.ok(after.includes('left:40px'), 'the layout moved when only the artwork should have');
});
test('the published page closes its own script tag', () => {
  const html = publish(pubDoc, bu, {});
  assert.ok(!html.includes('<\\/script>'), 'the escape leaked into the output');
  const opens = (html.match(/<script/g) || []).length, closes = (html.match(/<\/script>/g) || []).length;
  assert.strictEqual(opens, closes, 'unbalanced script tags');
});
test('a photograph reaches the published page, and only the ones in use', () => {
  const st = IM.store();
  const used = st.add(PNG_A, { w: 1600, h: 1000, name: 'beach.jpg' });
  const orphan = st.add(PNG_B, { w: 2, h: 2 });
  const d = EM.emptyDoc('Meridian');
  d.pages[0].blocks.push(EM.makeBlock('slot', { props: { image: used, caption: 'Coastal light' } }));
  const html = publish(d, Object.assign({}, bu, { images: IM.forDoc(d, st.all()) }), { builtAt: 'fixed' });
  assert.ok(html.includes(PNG_A), 'the photograph did not reach the page');
  assert.ok(!html.includes(PNG_B), `an image nothing points at was carried into the page anyway`);
  assert.ok(html.includes('Coastal light'));
});
test('a saved document carries its images beside itself, never inside a block', () => {
  const st = IM.store();
  const id = st.add(PNG_A, { w: 1600, h: 1000, name: 'beach.jpg' });
  const d = EM.emptyDoc('Meridian');
  d.pages[0].blocks.push(EM.makeBlock('slot', { props: { image: id } }));
  // exactly the shape the Save button writes and the publish command reads
  const file = Object.assign({}, d, { images: IM.forDoc(d, st.all()) });
  const reopened = JSON.parse(JSON.stringify(file));
  const images = reopened.images; delete reopened.images;
  assert.ok(!/data:image/.test(JSON.stringify(reopened.pages)), 'bytes were stored in a block');
  const html = publish(reopened, Object.assign({}, bu, { images }), { builtAt: 'fixed' });
  assert.ok(/<img[^>]+src="data:image\/png/.test(html), 'the round trip lost the photograph');
});
test('the publish command takes a document with photographs in it', () => {
  const cp = require('child_process');
  const st = IM.store();
  const id = st.add(PNG_A, { w: 1600, h: 1000, name: 'beach.jpg' });
  const d = EM.emptyDoc('Meridian');
  d.pages[0].blocks.push(EM.makeBlock('slot', { props: { image: id, caption: 'Coastal light' } }));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-img-'));
  const docPath = path.join(dir, 'document.json'), out = path.join(dir, 'page.html');
  fs.writeFileSync(docPath, JSON.stringify(Object.assign({}, d, { images: IM.forDoc(d, st.all()) })));
  const r = cp.spawnSync(process.execPath,
    [path.join(__dirname, '..', 'src', 'cli.js'), 'publish', PROJECT, docPath, '-o', out],
    { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr || 'publish exited non-zero');
  assert.ok(/1 image came with the document/.test(r.stdout), 'the command did not notice the photograph');
  const html = fs.readFileSync(out, 'utf8');
  assert.ok(html.includes(PNG_A), 'the published page has no photograph in it');
  assert.ok(html.includes('Coastal light'));
  fs.rmSync(dir, { recursive: true, force: true });
});
test('the editor loads contrast before the images that need it', () => {
  const html = editorHtml(project, m, []);
  const at = (needle) => html.indexOf(needle);
  assert.ok(at('HandoverContrast') > -1, 'contrast is not inlined, so nothing can measure a photograph');
  assert.ok(at('root.HandoverContrast = factory') < at('root.HandoverImages = factory'),
    'images loads before contrast, so HandoverContrast is undefined when it is read');
  assert.ok(at('root.HandoverImages = factory') < at('root.HandoverRender = factory'),
    'the renderer loads before the image store');
});
test('inlining publish into the editor does not close the editor script early', () => {
  // Only a closing tag ends a script block, so that is the one to count. An
  // opening tag inside an inlined string is harmless; a closing one truncates
  // the editor and takes everything after it.
  for (const f of ['model', 'render', 'publish', 'app']) {
    const src = fs.readFileSync(require.resolve(`../src/editor/${f}`), 'utf8');
    assert.ok(!/[^\\]<\/script>/.test(src),
      `${f}.js has a raw closing script tag, which would truncate the editor when inlined`);
  }
  const html = editorHtml(project, m, []);
  assert.ok(html.includes('HandoverPublish'), 'publish is not in the editor');
  // model, render, publish, the bundle, then the app
  const blocks = (fs.readFileSync(require.resolve('../src/editor/emit'), 'utf8').match(/<script>/g) || []).length;
  assert.strictEqual((html.match(/<\/script>/g) || []).length, blocks,
    'the editor does not close exactly the script blocks it opens');
  // the app is inlined last, so if anything truncated it this would be missing
  assert.ok(html.includes('window.__handover'), 'the editor was cut short before the app loaded');
});
test('text is escaped on the published page too', () => {
  const d = EM.clone(pubDoc);
  d.pages[0].blocks[2].props.text = '<script>alert(1)<\/script>';
  assert.ok(!publish(d, bu, {}).includes('<script>alert(1)'), 'a text block injected markup into the published page');
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
test('a rule set once still follows the master, because it was derived from it', async () => {
  const thick = project.assets.mark.source.replace('stroke-width="9"', 'stroke-width="14"');
  const altered = Object.assign({}, project, {
    assets: Object.assign({}, project.assets, { mark: Object.assign({}, project.assets.mark, { source: thick }) }),
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover4-'));
  const r2 = await build(altered, dir);
  const bj = JSON.parse(fs.readFileSync(path.join(dir, 'brand.json'), 'utf8'));
  // 24 x (14 / 120) = 2.8, where the 9 wide master gave 1.8
  assert.strictEqual(bj.system.icons.stroke, 2.8, 'the icon stroke ignored the thicker mark');
  assert.notStrictEqual(bj.system.icons.live, 21.8, 'the live area ignored the thicker mark');
  // and the icon that passed against the old rule is now a blocker, which is
  // the point: the check moves with the mark rather than with a memory of it
  const f = sys.checkIcon(iconGood, bj.system.icons);
  assert.ok(f.some((x) => x.level === 'blocker'), 'an icon drawn to the old stroke still passes');
  assert.strictEqual(r2.written.filter((x) => x.path.startsWith('07-pattern/')).length, patternTiles());
  fs.rmSync(dir, { recursive: true, force: true });
});

console.log('\na third identity');
// Meridian is a stroke in a square box. Halyard is fills in a square box. Both
// are called something spellable in ASCII and both cut a colourway per role.
// Kvist & Sonn is the third: fills and a stroke together, a box 252 by 90 with
// its origin at minus six, an o with a stroke through it in the name, and no
// mark lockup at all. Six more things were wrong.
const KV = projectLoader.load(path.join(__dirname, '..', 'projects', 'kvist', 'project.json'));
const kvM = measure(KV);

test('the floor is set by the thinnest thing, stroke or fill', () => {
  // trusting the stroke whenever there was one meant the fills were never
  // measured. Kvist has three 7 unit boards under a 12 unit strap: the engine
  // said 12, put the floor at 63 px, and at 63 px the boards are 1.75 px wide.
  assert.strictEqual(svgu.thinnestStroke(svgu.parse(KV.assets.mark.source)), 12,
    'this fixture is meant to carry a 12 unit stroke');
  assert.strictEqual(kvM.minimumSize.from, 'stem', 'the stroke won again');
  assert.ok(Math.abs(kvM.minimumSize.thinnestStroke - 7) < 0.15,
    `the boards are 7 units and it measured ${kvM.minimumSize.thinnestStroke}`);
  assert.ok(kvM.minimumSize.screenPx > 100 && kvM.minimumSize.screenPx < 116,
    `the floor came out ${kvM.minimumSize.screenPx} px, and 7 units of 252 needs about 108`);
  assert.ok(/thinner than the 12 stroke/.test(kvM.minimumSize.basis), kvM.minimumSize.basis);
  // and a mark that really is stroke-limited still says so
  assert.strictEqual(m.minimumSize.from, 'stroke');
  assert.strictEqual(m.minimumSize.thinnestStroke, 9);
});

test('a run of ink measures the same however large it was rendered', () => {
  // counting whole pixels made the answer depend on the render scale: the same
  // 7 unit bar read 7 in a 120 unit box and 6.72 in a 252 unit one. Coverage
  // does not care how many pixels it was spread over.
  const bar = (box) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box} ${box}">`
    + `<rect x="0" y="${box / 2}" width="${box}" height="7" fill="#000"/></svg>`;
  for (const box of [120, 252, 480]) {
    const got = geo.thinnestFeature(bar(box), { x: 0, y: 0, w: box, h: box });
    assert.ok(Math.abs(got - 7) < 0.15, `a 7 unit bar in a ${box} box measured ${got}`);
  }
});

test('a style rule that matches nothing is removed, and said so', () => {
  // it draws nothing, and it stops the PDF writer dead with "CSSStyleSheet is
  // not defined" because that writer asks a browser to parse it.
  const norm = require('../src/normalise');
  const withDead = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">'
    + '<style type="text/css">.st0{fill:#3E2B1F;}.st1{fill:none;}</style>'
    + '<rect data-slot="ink" x="0" y="0" width="100" height="7" fill="#3E2B1F"/></svg>';
  const r = norm.normalise(withDead, { tokens: KV.tokens });
  assert.ok(r.ok && !/<style/.test(r.svg), 'the stylesheet survived');
  const said = r.findings.find((f) => f.code === 'dead-styles');
  assert.ok(said && /2 style rules/.test(said.what), JSON.stringify(said));
  // a rule the artwork actually uses is still inlined onto it, not thrown away
  const used = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">'
    + '<style type="text/css">.st0{fill:#3E2B1F;}</style>'
    + '<rect class="st0" data-slot="ink" x="0" y="0" width="100" height="7"/></svg>';
  const r2 = norm.normalise(used, { tokens: KV.tokens });
  assert.ok(/fill="#3E2B1F"/.test(r2.svg), 'the class was dropped instead of inlined');
  assert.ok(!r2.findings.some((f) => f.code === 'dead-styles'), 'a live rule was called dead');
});

test('a brand name that is not ASCII still names its files', () => {
  const naming = require('../src/naming');
  assert.strictEqual(naming.slug('Kvist & Sønn'), 'kvist-and-sonn');
  assert.strictEqual(naming.slug('Blåbær AS'), 'blabaer-as');
  assert.strictEqual(naming.slug('Müller & Söhne'), 'muller-and-sohne');
  assert.strictEqual(naming.slug('Łódź Studio'), 'lodz-studio');
  assert.strictEqual(naming.slug('Grüße'), 'grusse');
  assert.strictEqual(naming.fileName('{brand}_{lockup}', { brand: 'Kvist & Sønn', lockup: 'stacked' }),
    'kvist-and-sonn_stacked');
  // and a name with no latin in it asks rather than writing a file called "-"
  assert.throws(() => naming.fileName('{brand}', { brand: '東京' }), /latinName/);
});

test('every emitter escapes the brand name', () => {
  // two of the four did. A brand name is allowed to contain an ampersand.
  const docs = require('../src/documents');
  const emit = require('../src/editor/emit');
  const { deck } = require('../src/documents/deck');
  const pages = [docs.guidelines(docs.context(KV, kvM, [], {})),
    deck(docs.context(KV, kvM, [], {})),
    emit.editorHtml(KV, kvM, [])];
  for (const html of pages) {
    const title = (/<title>([\s\S]*?)<\/title>/.exec(html) || [])[1] || '';
    assert.ok(/Kvist &amp; S/.test(title), `a title reads ${JSON.stringify(title)}`);
    assert.ok(!/Kvist & S/.test(title), `a title has a bare ampersand: ${JSON.stringify(title)}`);
  }
});

test('the clear space box is the shape the rule makes it', () => {
  // it was drawn square, which is right only when the ink box is. Kvist's ink
  // is 228 by 49, so the manual was showing a rule nobody could have followed.
  const docs = require('../src/documents');
  const b = require('../src/documents/blocks');
  for (const [proj, meas] of [[project, m], [HAL, halM], [KV, kvM]]) {
    const ctx = docs.context(proj, meas, [], {});
    const svg = b.clearSpace(ctx);
    const r = /<rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.]+)" height="([\d.]+)"[^>]*stroke-dasharray/.exec(svg);
    assert.ok(r, `no clear space box drawn for ${proj.brand}`);
    const ink = meas.markInk, x = meas.clearSpace;
    const want = (ink.w + 2 * x) / (ink.h + 2 * x);
    const got = Number(r[3]) / Number(r[4]);
    assert.ok(Math.abs(got - want) / want < 0.02,
      `${proj.brand}: drew ${got.toFixed(3)} where the rule makes ${want.toFixed(3)}`);
  }
});

test('a diagram is the shape of what is drawn on it', () => {
  // a 252 by 90 mark sat in a strip with its caption 261 px below it
  const docs = require('../src/documents');
  const b = require('../src/documents/blocks');
  const box = (svg) => (/viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg) || []).slice(1).map(Number);
  const sq = box(b.construction(docs.context(project, m, [], {})));
  const wide = box(b.construction(docs.context(KV, kvM, [], {})));
  assert.ok(Math.abs(sq[0] / sq[1] - 260 / 286) < 0.01, `a square mark moved: ${sq}`);
  assert.ok(wide[1] < sq[1] * 0.75, `a 2.8:1 mark still got a ${wide[1]} tall canvas`);
});

test('an icon paints every slot, whatever the slots are called', () => {
  // repainting a slot literally named "ink" did nothing at all to a mark whose
  // slots are board and strap, so every icon and social crop came out bare.
  const exp = require('../src/export');
  const icon = exp.iconSquare(KV.assets.mark.source,
    { size: 180, background: '#3E2B1F', ink: '#EFE9DD' });
  assert.deepStrictEqual(kvM.slots, ['board', 'strap']);
  assert.ok(!icon.includes('#B4632A'), 'the strap kept its master colour in the icon');
  assert.ok(icon.split('#EFE9DD').length - 1 >= 2, 'not every slot took the icon ink');
  const og = exp.banner(KV.assets.mark.source,
    { width: 1200, height: 630, background: '#3E2B1F', ink: '#EFE9DD' });
  assert.ok(!og.includes('#B4632A'), 'the social crop kept a master colour');
});

test('a project with no mark lockup builds anyway', () => {
  assert.ok(!KV.rules.lockups.includes('mark'), 'this fixture is meant to have no mark lockup');
  assert.deepStrictEqual(KV.rules.lockups, ['horizontal', 'stacked', 'wordmark']);
  assert.strictEqual(KV.rules.colourways.length, 2);
  const docs = require('../src/documents');
  const html = docs.guidelines(docs.context(KV, kvM, [], {}));
  assert.ok(html.length > 5000 && !/hb-missing/.test(html), 'the manual came out short or holed');
});

console.log('\na fourth identity');
// Three projects agreeing is still three projects. All of them have five
// colours filling all five roles, two type families, a system block, and a
// mark drawn in a few hundred units. Hallward Press is a monochrome seal: an
// ink and a paper and nothing else, one colourway, one typeface, no system
// block at all, twenty-three paths, and a 2048 unit box.
const HW = projectLoader.load(path.join(__dirname, '..', 'projects', 'hallward', 'project.json'));
const hwM = measure(HW);

test('a measurement does not cost more because the units are bigger', () => {
  // a viewBox is a unit system, not a resolution. Rendering six pixels to the
  // unit made a 2048 box render 12288 square — 151 million pixels and six
  // seconds — every time an ink box was wanted, and the build took 45 seconds.
  const t = Date.now();
  const box = geo.inkBox(HW.assets.mark.source);
  const ms = Date.now() - t;
  assert.ok(ms < 1500, `one ink box of a 2048 unit mark took ${ms} ms`);
  assert.ok(Math.abs(box.w - 1966) < 2 && Math.abs(box.h - 1993) < 2, JSON.stringify(box));
  // and the bound is on area, so a wide flat wordmark is not penalised for it
  const wm = geo.inkBox(project.assets.wordmark.source);
  assert.ok(Math.abs(wm.w - 653.47) < 0.01 && Math.abs(wm.x - 9.18) < 0.01,
    `the wordmark ink box moved to ${JSON.stringify(wm)}`);
});

test('the stem scan looks closer when the thing it found is tiny', () => {
  // Hallward's inner ring is 8 units in a 2048 unit box, which is 2.3 pixels
  // at a fixed 600 wide render. It measured 7.7. A fixed render width assumes
  // the artwork's units are of a familiar size and nothing says they are.
  assert.strictEqual(hwM.minimumSize.from, 'stem');
  assert.ok(Math.abs(hwM.minimumSize.thinnestStroke - 8) < 0.2,
    `the 8 unit ring measured ${hwM.minimumSize.thinnestStroke}`);
  // the three that were already right are still right, and still cheap
  assert.strictEqual(m.minimumSize.thinnestStroke, 9);
  assert.strictEqual(halM.minimumSize.thinnestStroke, 12);
  assert.ok(Math.abs(kvM.minimumSize.thinnestStroke - 7) < 0.15);
});

test('the mark is never shown on a ground it cannot be seen on', () => {
  // the specimen put the mark on the colour in the primary role, which is a
  // colour to present on in an identity that has a palette and is the mark's
  // own ink in one built from an ink and a paper. Hallward's headline specimen
  // was a plain black rectangle at 1.00 to 1.
  const docs = require('../src/documents');
  const b = require('../src/documents/blocks');
  const contrast = require('../src/contrast');
  for (const [proj, meas] of [[project, m], [HAL, halM], [KV, kvM], [HW, hwM]]) {
    const ctx = docs.context(proj, meas, [], {});
    const s = b.showOn(ctx);
    assert.ok(s.worst >= b.SEEN,
      `${proj.brand} shows its mark at ${s.worst.toFixed(2)}:1 on ${s.ground.name}`);
    // and the specimen really does use that pair
    const html = b.markSpecimen(ctx);
    assert.ok(html.includes(`background:${s.ground.hex}`), `${proj.brand}: specimen ground`);
    const inks = Object.values(s.colourway.slots);
    assert.ok(inks.some((h) => html.toUpperCase().includes(h.toUpperCase())),
      `${proj.brand}: the specimen is not painted in the colourway that reads`);
    assert.ok(inks.every((h) => contrast.ratio(h, s.ground.hex) >= b.SEEN),
      `${proj.brand}: an ink in the shown colourway does not read on its ground`);
  }
});

test('a deck slide that cannot show the mark puts it on a plate', () => {
  // every slide is painted in the primary role. Four of Hallward's were black
  // rectangles; and the lockup slides asked for a colourway named after the
  // ground role, which is a colourway name in Meridian alone, by coincidence,
  // so Halyard had been drawing bone on bone since the day it was added.
  const docs = require('../src/documents');
  const b = require('../src/documents/blocks');
  const { deck } = require('../src/documents/deck');
  for (const [proj, meas] of [[project, m], [HAL, halM], [KV, kvM], [HW, hwM]]) {
    const ctx = docs.context(proj, meas, [], {});
    const slide = ctx.primary.hex;
    const named = (proj.rules.colourways || []).find((c) => c.name === ctx.ground.name);
    const way = named && b.worstOn(named, slide) >= b.SEEN ? named
      : (b.readsOn(ctx, slide) || {}).worst >= b.SEEN ? b.readsOn(ctx, slide).colourway
        : b.showOn(ctx).colourway;
    const html = deck(ctx);
    if (b.worstOn(way, slide) >= b.SEEN) {
      // it reads on the slide itself, so no plate is wanted
      assert.ok(!html.includes(`background:${b.showOn(ctx).ground.hex};padding:2.6cqw`),
        `${proj.brand} plated a mark that could already be seen`);
    } else {
      assert.ok(html.includes(`background:${b.showOn(ctx).ground.hex};padding:2.6cqw`),
        `${proj.brand} left the mark invisible on the slide`);
    }
  }
  // the choice the deck was already making is kept wherever it works: pushing
  // for maximum contrast would move Meridian off its own off-white onto white
  const ctxM = docs.context(project, m, [], {});
  const best = b.readsOn(ctxM, ctxM.primary.hex);
  assert.strictEqual(best.colourway.name, 'white', 'this fixture is meant to have a whiter option');
  assert.ok(deck(ctxM).includes('#EFEDE4'), 'Meridian was moved off chalk');
});

test('a part transparent shape is called out rather than measured three ways', () => {
  // the ink box counts it, the stem scan cannot see it at all, and a printer
  // cannot lay down 35 percent of a spot ink without a tint screen
  const norm = require('../src/normalise');
  const w = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">${body}</svg>`;
  const r = norm.normalise(w('<rect data-slot="ink" x="10" y="10" width="100" height="40" fill="#14110E"/>'
    + '<rect data-slot="ink" x="10" y="60" width="100" height="40" fill="#14110E" fill-opacity="0.35"/>'), { tokens: HW.tokens });
  const said = r.findings.find((f) => f.code === 'translucent');
  assert.ok(said && said.level === 'warning', JSON.stringify(r.findings.map((f) => f.code)));
  // a solid mark is not accused of it, and opacity="0" is still a leftover
  const clean = norm.normalise(w('<rect data-slot="ink" x="10" y="10" width="100" height="40" fill="#14110E"/>'), { tokens: HW.tokens });
  assert.ok(!clean.findings.some((f) => f.code === 'translucent'));
  // the real mark carries one, so the project says so
  assert.ok(HW.assets.mark.source.includes('fill-opacity'), 'this fixture is meant to carry one');
});

test('an identity of two colours and one colourway still builds', () => {
  assert.strictEqual(Object.keys(HW.tokens.colour).length, 2);
  assert.strictEqual(HW.rules.colourways.length, 1);
  assert.strictEqual(Object.keys(HW.tokens.type.families).length, 1);
  assert.ok(!HW.system || !HW.system.photography, 'this fixture is meant to have no system block');
  const docs = require('../src/documents');
  const ctx = docs.context(HW, hwM, [], {});
  // the roles that are absent fall back rather than throwing
  assert.strictEqual(ctx.accent.hex, ctx.primary.hex);
  const html = docs.guidelines(ctx);
  assert.ok(html.length > 5000, 'the manual came out short');
  assert.ok(!/hb-missing/.test(html), 'the manual has an unexplained hole in it');
  // and a block that needs the system block it does not have refuses in words
  const photo = ER.block({ id: 'p', type: 'photography', props: {} }, bundleOf(HW, hwM));
  assert.ok(/No photography treatment yet/.test(photo),
    `a missing system block rendered as ${photo.slice(0, 80)}`);
});

console.log('\na fifth identity');
// Hallward was built by taking everything optional away. Northline is the
// opposite: twelve colours, eight colourways, four typefaces, four lockups,
// four PNG widths, four social crops, a colourway that leaves a slot out, and
// a mark drawn the way a drawing tool actually writes a repeated element —
// once, in defs, placed with <use>.
const NL = projectLoader.load(path.join(__dirname, '..', 'projects', 'northline', 'project.json'));
const nlM = measure(NL);

test('a referenced copy is placed, not drawn once where it is defined', () => {
  // <use> is a reference. Both emitters walked the tree looking for geometry,
  // found the original sitting in defs, and drew it once, at the coordinates
  // it is defined at rather than placed at, in black rather than in the colour
  // the <use> carries. Resolving it here means nothing downstream has to know.
  const norm = require('../src/normalise');
  const plain = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">'
    + '<path data-slot="ink" fill="#0A2A33" d="M20 20h80v10H20z"/>'
    + '<path data-slot="ink" fill="#0A2A33" d="M20 50h80v10H20z"/>'
    + '<path data-slot="ink" fill="#0A2A33" d="M20 80h80v10H20z"/></svg>';
  const viaUse = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 120 120">'
    + '<defs><path id="bar" d="M0 0h80v10H0z"/></defs>'
    + '<use xlink:href="#bar" data-slot="ink" x="20" y="20" fill="#0A2A33"/>'
    + '<use xlink:href="#bar" data-slot="ink" x="20" y="50" fill="#0A2A33"/>'
    + '<use xlink:href="#bar" data-slot="ink" x="20" y="80" fill="#0A2A33"/></svg>';
  const a = norm.normalise(plain, { tokens: NL.tokens });
  const b = norm.normalise(viaUse, { tokens: NL.tokens });
  assert.ok(!/<use|<defs/.test(b.svg), `a reference survived: ${b.svg.slice(0, 160)}`);
  assert.ok(b.findings.some((f) => f.code === 'expanded-use'), 'nothing was said about it');
  // the two masters describe the same drawing, so they must measure the same
  const box = { x: 0, y: 0, w: 120, h: 120 };
  assert.deepStrictEqual(geo.inkBox(b.svg), geo.inkBox(a.svg));
  // and print the same
  const typst = require('../src/typst');
  const ta = typst.artwork(a.svg, box, { colours: {} }, new Set());
  const tb = typst.artwork(b.svg, box, { colours: {} }, new Set());
  assert.strictEqual(tb.replace(/\s+/g, ' ').trim(), ta.replace(/\s+/g, ' ').trim(),
    'the same drawing printed differently depending on how it was written');
  // the cleaner merges three identical bars into one path of three subpaths,
  // so the copies show up as subpaths rather than as separate placements
  assert.strictEqual((tb.match(/curve\.move/g) || []).length, 3, 'not every copy was placed');
  // a reference to nothing draws nothing rather than throwing
  const dangling = norm.normalise('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">'
    + '<path data-slot="ink" fill="#0A2A33" d="M20 20h80v10H20z"/><use href="#gone" x="0" y="0"/></svg>',
  { tokens: NL.tokens });
  assert.ok(dangling.ok && !/<use/.test(dangling.svg));
  // the fixture nests one inside another, which has to resolve too
  assert.deepStrictEqual(nlM.slots, ['route', 'ticks']);
  assert.ok(!/<use|<defs/.test(NL.assets.mark.source), 'the fixture kept a reference');
});

test('nothing inside defs is ever drawn', () => {
  // a clipPath lives in defs and describes a shape that must not appear.
  // Kvist's printed piece has been carrying a solid rectangle the size of its
  // own artboard, because defs was being walked like an ordinary group.
  const typst = require('../src/typst');
  const svgu2 = require('../src/svg');
  for (const proj of [project, HAL, KV, HW, NL]) {
    const src = proj.assets.mark.source;
    let drawable = 0;
    (function walk(n, hidden) {
      for (let c = n.firstChild; c; c = c.nextSibling) {
        if (c.nodeType !== 1) continue;
        const t = String(c.nodeName).toLowerCase();
        const h = hidden || ['defs', 'clippath', 'mask', 'symbol', 'marker', 'pattern'].indexOf(t) > -1;
        if (t === 'path' && !h) drawable++;
        walk(c, h);
      }
    }(svgu2.parse(src).documentElement, false));
    const out = typst.artwork(src, { x: 0, y: 0, w: 100, h: 100 }, { colours: {} }, new Set());
    // one #place per path; curve.move counts subpaths, and an evenodd ring has two
    assert.strictEqual((out.match(/#place\(/g) || []).length, drawable,
      `${proj.brand}: printed ${(out.match(/#place\(/g) || []).length} shapes where ${drawable} are drawable`);
  }
});

test('every misuse cell shows the mark, and shows it misused', () => {
  // the cells were painted in the colour in the primary role on a stage whose
  // colour belongs to the page and flips with the reader's light or dark
  // setting, so no fixed ink could read on both. Five of Halyard's six have
  // been blank since the day it was added, at 1.01 to 1.
  const docs = require('../src/documents');
  const b = require('../src/documents/blocks');
  const contrast = require('../src/contrast');
  for (const [proj, meas] of [[project, m], [HAL, halM], [KV, kvM], [HW, hwM], [NL, nlM]]) {
    const ctx = docs.context(proj, meas, [], {});
    const html = b.misuse(ctx);
    const cells = html.split('<figure>').slice(1);
    assert.strictEqual(cells.length, 6, `${proj.brand} drew ${cells.length} cells`);
    const ground = b.showOn(ctx).ground.hex;
    cells.forEach((cell, i) => {
      const fill = (/fill="(#[0-9A-Fa-f]{6})"/.exec(cell) || [])[1];
      assert.ok(fill, `${proj.brand} cell ${i} paints nothing`);
      if (i === 4) return;                       // the busy cell has its own ground
      if (i === 5) {                             // hollowed out, outlined in the ink
        assert.strictEqual(fill.toUpperCase(), ground.toUpperCase(),
          `${proj.brand} cell 5 is not hollow`);
        assert.ok(/drop-shadow/.test(cell), `${proj.brand} cell 5 has no outline`);
        return;
      }
      assert.ok(contrast.ratio(fill, ground) >= b.SEEN,
        `${proj.brand} cell ${i}: ${fill} on ${ground} is ${contrast.ratio(fill, ground).toFixed(2)}:1`);
    });
    // no cell may show a correct mark under a caption saying not to. A cell is
    // treated if it is deformed or filtered, sits on the busy ground, or is
    // painted in something other than the ink the mark is properly drawn in.
    const proper = (/fill="(#[0-9A-Fa-f]{6})"/.exec(cells[0]) || [])[1].toUpperCase();
    cells.forEach((cell, i) => {
      const style = (/<span style="([^"]*)"/.exec(cell) || [])[1] || '';
      const fill = ((/fill="(#[0-9A-Fa-f]{6})"/.exec(cell) || [])[1] || '').toUpperCase();
      const treated = style.trim() !== '' || /class="[^"]*\bbusy\b/.test(cell) || fill !== proper;
      assert.ok(treated,
        `${proj.brand} cell ${i} shows a correct mark under a caption saying not to`);
    });
  }
});

test('a colourway that leaves a slot out is reported once, with what it did', () => {
  const outline = NL.rules.colourways.find((c) => c.name === 'outline');
  assert.ok(outline && !outline.slots.ticks, 'this fixture is meant to omit a slot');
  const { buildVariant } = require('../src/variants');
  const v = buildVariant({ markSrc: NL.assets.mark.source,
    wordmarkSrc: NL.assets.wordmark.source, lockup: 'mark',
    colourway: outline, rules: NL.rules, measured: nlM });
  assert.deepStrictEqual(v.missing, ['ticks']);
  // the slot keeps whatever the master painted it, which is why the file looks
  // like it does, and that is the part the warning has to say
  assert.ok(v.svg.includes('#D8442F'), 'the master colour did not survive');
});

test('excess does not break anything that density touches', () => {
  assert.strictEqual(Object.keys(NL.tokens.colour).length, 12);
  assert.strictEqual(NL.rules.colourways.length, 8);
  assert.strictEqual(Object.keys(NL.tokens.type.families).length, 4);
  const docs = require('../src/documents');
  const ctx = docs.context(NL, nlM, [], {});
  const html = docs.guidelines(ctx);
  assert.ok(!/hb-missing/.test(html), 'a hole in the manual');
  // every colour reaches the palette, roles and line colours alike
  for (const name of Object.keys(NL.tokens.colour)) {
    assert.ok(html.includes(NL.tokens.colour[name].hex), `${name} is missing from the manual`);
  }
  // four families means four font requests and no more
  const link = (/<link rel="stylesheet" href="(https:\/\/fonts[^"]*)"/.exec(html) || [])[1] || '';
  for (const f of ['Archivo', 'Literata', 'Spline+Sans+Mono', 'Archivo+Narrow']) {
    assert.ok(link.includes(f) || html.includes(f.replace(/\+/g, ' ')), `${f} is not asked for`);
  }
});

console.log('\na sixth identity');
// The first five differ in what the identity is. Perigee differs in what the
// file is: a mark exported the way a web tool writes one — hsl() and a named
// colour and a three digit hex, no data-slot anywhere, a clipPath wrapper, and
// a body drawn in plain black. The dialect, not the design.
const PG = projectLoader.load(path.join(__dirname, '..', 'projects', 'perigee', 'project.json'));
const pgM = measure(PG);

test('a mark drawn in black still changes colour', () => {
  // SVGO removes fill="#000000" because black is what an unset fill paints, and
  // applyColourway only ever repainted attributes that were already there. So a
  // mark in plain black came out black in every colourway, silently, with
  // nothing reported — and black is the commonest colour a logo is drawn in.
  const norm = require('../src/normalise');
  const one = (f) => {
    const r = norm.normalise('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
      + `<path data-slot="ink" d="M8 8h48v20H8z" fill="${f}"/></svg>`, { tokens: PG.tokens });
    const doc = svgu.parse(r.svg);
    svgu.applyColourway(doc, { ink: '#EFEDE4' });
    return (/<path[^>]*fill="([^"]*)"/.exec(svgu.serialize(doc)) || [])[1];
  };
  for (const f of ['black', '#000', '#000000', 'rgb(0,0,0)', '#0A2A33']) {
    assert.strictEqual(one(f), '#EFEDE4', `a mark painted ${f} did not take the colourway`);
  }
  // but a shape the designer set to none is left alone, not filled in
  const r = norm.normalise('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
    + '<path data-slot="ink" d="M8 32h48" fill="none" stroke="#0A2A33" stroke-width="4"/></svg>',
  { tokens: PG.tokens });
  const doc = svgu.parse(r.svg);
  svgu.applyColourway(doc, { ink: '#EFEDE4' });
  const out = svgu.serialize(doc);
  assert.ok(/fill="none"/.test(out), 'a stroked outline was filled in');
  assert.ok(/stroke="#EFEDE4"/.test(out), 'the stroke was not recoloured');
});

test('a colour is read however it is written, or said to be unreadable', () => {
  // three modules each had their own six digit hex reader, so a palette given
  // in rgb() or hsl() produced NaN — and NaN compares false against every
  // threshold, so brand.json told the client that every pair in their identity
  // was "Never for text" and the whole pattern set was refused for NaN:1.
  const c = require('../src/contrast');
  assert.strictEqual(c.toHex('#0A2A33'), '#0A2A33');
  assert.strictEqual(c.toHex('#123'), '#112233');
  assert.strictEqual(c.toHex('rgb(10, 42, 51)'), '#0A2A33');
  assert.strictEqual(c.toHex('black'), '#000000');
  assert.strictEqual(c.toHex('#0A2A33FF'), '#0A2A33');
  assert.strictEqual(c.toHex('hsl(207, 68%, 24%)'), '#144167');
  assert.strictEqual(c.toHex('nonsense'), null);
  // every notation gives the same ratio as its hex
  const want = c.ratio('#0A2A33', '#FFFFFF');
  for (const v of ['rgb(10, 42, 51)', '#0A2A33FF']) assert.strictEqual(c.ratio(v, '#FFFFFF'), want);
  // and an unreadable colour is null, never NaN, and is not called a failure
  assert.strictEqual(c.ratio('nonsense', '#FFF'), null);
  assert.strictEqual(c.verdict(null).level, 'unknown');
  assert.ok(!/never/i.test(c.verdict(null).use), 'an unmeasured pair was reported as failing');
  assert.strictEqual(c.verdict(21).level, 'AAA');
});

test('a palette written in any notation reaches the documents as hex', () => {
  // the project file may say #123 or rgb() or hsl(); everything downstream
  // reads hex, so it is canonicalised once at the door
  assert.strictEqual(PG.tokens.colour.deep.hex, '#112233');
  assert.strictEqual(PG.tokens.colour.paper.hex, '#F7F6F3');
  assert.strictEqual(PG.tokens.colour.orbit.hex, '#144167');
  assert.strictEqual(PG.rules.iconBg, '#112233');
  assert.strictEqual(PG.rules.colourways[0].slots.orbit, '#F7F6F3');   // written rgb()
  assert.strictEqual(PG.rules.colourways[1].slots.orbit, '#112233');   // written #123
  // so no measurement anywhere comes back unknown
  const docs = require('../src/documents');
  const ctx = docs.context(PG, pgM, [], {});
  const pairs = require('../src/contrast').matrix(PG.tokens.colour);
  assert.ok(pairs.length > 0 && pairs.every((p) => typeof p.ratio === 'number'),
    `${pairs.filter((p) => p.ratio == null).length} pairs could not be measured`);
  assert.ok(!/NaN/.test(docs.guidelines(ctx)), 'NaN reached the manual');
  // and a colour the reader genuinely cannot parse is refused at load, by name,
  // rather than travelling silently into every measurement downstream
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-colour-'));
  const bad = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'projects', 'perigee', 'project.json'), 'utf8'));
  bad.tokens.colour.deep.hex = 'sort of navy';
  fs.writeFileSync(path.join(dir, 'project.json'), JSON.stringify(bad));
  for (const f of ['mark.svg', 'wordmark.svg']) {
    fs.copyFileSync(path.join(__dirname, '..', 'projects', 'perigee', f), path.join(dir, f));
  }
  assert.throws(() => projectLoader.load(path.join(dir, 'project.json')),
    /the colour "deep" is "sort of navy", which is not a colour this can read/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('nothing inside defs is coloured, slotted or drawn', () => {
  // the same rule the printed piece needed, in the two other places that walk
  // the tree: a clipping rectangle's white was snapped to a brand colour and
  // given a brand colour slot, so the project gained a phantom slot for a
  // shape that never reaches the page.
  const norm = require('../src/normalise');
  const src = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
    + '<g clip-path="url(#c)"><path d="M8 8h20v10H8z" fill="#FF6633"/></g>'
    + '<defs><clipPath id="c"><rect width="64" height="64" fill="#F7F6F3"/></clipPath></defs></svg>';
  const r = norm.normalise(src, { tokens: PG.tokens });
  assert.strictEqual(r.slots.length, 1, `slots were ${JSON.stringify(r.slots)}`);
  const doc = svgu.parse(r.svg);
  let inDefs = 0;
  (function walk(n, hidden) {
    for (let c = n.firstChild; c; c = c.nextSibling) {
      if (c.nodeType !== 1) continue;
      const t = String(c.nodeName).toLowerCase();
      const h = hidden || svgu.NEVER_DRAWN.indexOf(t) > -1;
      if (h && c.getAttribute('data-slot')) inDefs++;
      walk(c, h);
    }
  }(doc.documentElement, false));
  assert.strictEqual(inDefs, 0, 'a shape that never draws was given a colour slot');
  // and the real fixture, which is a Figma export with a clipPath in it
  assert.deepStrictEqual(pgM.slots, ['orbit', 'void', 'flare', 'ink']);
});

test('a wordmark slot is named in the warning too, not just the mark', () => {
  // the message that says what a missing slot kept only ever looked at the
  // mark, so a wordmark slot was reported as keeping "its master colour"
  const painted = {};
  for (const asset of [PG.assets.mark, PG.assets.wordmark]) {
    svgu.eachPainted(svgu.parse(asset.source), (el) => {
      const sl = el.getAttribute('data-slot');
      const f = el.getAttribute('fill') || el.getAttribute('stroke');
      if (sl && f && f !== 'none' && !painted[sl]) painted[sl] = f;
    });
  }
  assert.ok(painted.ink, 'the wordmark slot has no colour to report');
  assert.ok(painted.orbit && painted.flare, JSON.stringify(painted));
});

console.log('\na seventh identity');
// Six identities, all named in letters a filename can carry, all written in a
// language the documents already assumed. Ma'ayan is named מעיין, its words are
// Hebrew, and it reads right to left.
const MY = projectLoader.load(path.join(__dirname, '..', 'projects', 'maayan', 'project.json'));
const myM = measure(MY);

test('a brand not named in a-z can be built at all', () => {
  // the namer told the designer to "give the project a latinName", which
  // nothing anywhere read. An identity named in Hebrew, Greek, Cyrillic or
  // Arabic could not be packaged, and was told to do something that would not
  // have helped. The escape hatch is real now, and it is checked at load
  // rather than three quarters of the way through writing a package.
  assert.strictEqual(MY.brand, 'מעיין');
  assert.strictEqual(MY.latinName, 'Maayan');
  const naming = require('../src/naming');
  assert.strictEqual(naming.fileName(MY.rules.naming,
    { brand: MY.latinName, lockup: 'mark', colourway: 'full' }), 'maayan-mark-full');
  // and a project that has neither is refused, by name, when it is loaded
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-latin-'));
  const bad = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'projects', 'maayan', 'project.json'), 'utf8'));
  delete bad.latinName;
  fs.writeFileSync(path.join(dir, 'project.json'), JSON.stringify(bad));
  for (const f of ['mark.svg', 'wordmark.svg']) {
    fs.copyFileSync(path.join(__dirname, '..', 'projects', 'maayan', f), path.join(dir, f));
  }
  assert.throws(() => projectLoader.load(path.join(dir, 'project.json')), /latinName/);
  fs.rmSync(dir, { recursive: true, force: true });
  // a brand that is already latin needs nothing and keeps its own name
  assert.strictEqual(project.latinName, project.brand);
});

test('a document says what language it is in and which way it reads', () => {
  // every one of the four declared itself English and laid itself out left to
  // right, whatever was in it: a Hebrew manual told a screen reader to say
  // Hebrew in an English voice.
  assert.strictEqual(MY.language, 'he');
  assert.strictEqual(MY.direction, 'rtl');       // derived, not stated
  const docs = require('../src/documents');
  const { deck } = require('../src/documents/deck');
  const emit = require('../src/editor/emit');
  const ctx = docs.context(MY, myM, [], {});
  for (const html of [docs.guidelines(ctx), deck(ctx), emit.editorHtml(MY, myM, [])]) {
    const tag = (/<html[^>]*>/.exec(html) || [])[0];
    assert.ok(/lang="he"/.test(tag) && /dir="rtl"/.test(tag), `a document says ${tag}`);
  }
  // and the six that were already right are still right
  for (const p of [project, HAL, KV, HW, NL, PG]) {
    assert.strictEqual(p.language, 'en');
    assert.strictEqual(p.direction, 'ltr');
    const tag = (/<html[^>]*>/.exec(docs.guidelines(docs.context(p, measure(p), [], {}))) || [])[0];
    assert.ok(/lang="en"/.test(tag) && /dir="ltr"/.test(tag), `${p.brand} says ${tag}`);
  }
});

test('a colourway that cannot be seen on its own ground is reported', () => {
  // a colourway names the ground it is cut for, and whether its inks can be
  // seen there is arithmetic. Nothing was asking: the documents quietly showed
  // a different colourway and every file for the unreadable one shipped.
  const contrast = require('../src/contrast');
  const worstOnGround = (p) => (p.rules.colourways || []).map((cw) => {
    const g = cw.on && p.tokens.colour[cw.on];
    if (!g) return null;
    const inks = Object.values(cw.slots || {});
    if (!inks.length) return null;
    return { name: cw.name, worst: Math.min(...inks.map((h) => contrast.ratio(h, g.hex))) };
  }).filter(Boolean);
  // the six that are meant to be clean are clean
  for (const p of [project, HAL, KV, HW, NL, PG]) {
    for (const c of worstOnGround(p)) {
      assert.ok(c.worst >= 3, `${p.brand}: colourway ${c.name} is ${c.worst.toFixed(2)}:1 on its ground`);
    }
  }
  // and the one that carries the fault on purpose is caught
  const bad = worstOnGround(MY).filter((c) => c.worst < 3);
  assert.strictEqual(bad.length, 1, JSON.stringify(worstOnGround(MY)));
  assert.strictEqual(bad[0].name, 'full');
});

test('non-latin words survive into every document', () => {
  const docs = require('../src/documents');
  const { deck } = require('../src/documents/deck');
  const ctx = docs.context(MY, myM, [], {});
  const heb = /[֐-׿]/;
  for (const [what, html] of [['the manual', docs.guidelines(ctx)], ['the deck', deck(ctx)]]) {
    assert.ok(heb.test(html), `${what} lost the Hebrew`);
    for (const caption of MY.content.misuse) {
      assert.ok(html.includes(caption), `${what} is missing "${caption}"`);
    }
  }
  // the files are named in roman letters, and nothing in them is
  assert.ok(/^[a-z0-9._-]+$/.test(require('../src/naming')
    .fileName(MY.rules.naming, { brand: MY.latinName, lockup: 'stacked', colourway: 'reverse' })));
});

console.log('\nan eighth identity');
// The first seven are all plausible: unfamiliar to the engine, but drawn on
// purpose and drawn correctly. Thornbury Mills is a file that has been edited
// by three people since 1998 — a stray click, an old roundel dragged off the
// artboard instead of deleted, a rim that bleeds past the edge, absurd
// precision, groups nested four deep. Damaged rather than merely unexpected.
const TH = projectLoader.load(path.join(__dirname, '..', 'projects', 'thornbury', 'project.json'));
const thM = measure(TH);

test('the normaliser looks at where the geometry is, not just what it is', () => {
  // it read element types, colours and slots, and never once read a
  // coordinate. So a shape sitting off the artboard was invisible and unmentioned.
  const norm = require('../src/normalise');
  const w = (b) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${b}</svg>`;
  const good = '<path data-slot="ink" d="M10 40h80v20H10z" fill="#0A2A33"/>';
  const off = norm.normalise(w(good + '<path data-slot="ink" d="M300 300h50v50h-50z" fill="#0A2A33"/>'),
    { tokens: project.tokens });
  assert.ok(off.findings.some((f) => f.code === 'off-artboard'), 'nothing was said about it');
  assert.ok(!/300/.test(off.svg), 'the off-artboard shape is still in the file');
  // the ink box is unchanged by its removal, because it never drew anything
  assert.deepStrictEqual(geo.inkBox(off.svg), geo.inkBox(w(good)));
  // and a healthy mark is not accused of anything
  for (const p of [project, HAL, KV, HW, NL, PG, MY]) {
    const r = norm.normalise(p.assets.mark.source, { tokens: p.tokens });
    assert.ok(!r.findings.some((f) => f.code === 'off-artboard' || f.code === 'stray-geometry'),
      `${p.brand} was accused of geometry it does not have`);
  }
});

test('a dragged handle is refused rather than measured', () => {
  // one point pulled to 99999 draws a sliver across the artwork thinner than
  // anything drawn on purpose, so it becomes the narrowest stem and sets the
  // smallest usable size — Thornbury measured a stem of 2 where the thinnest
  // real part is 10, which would have put the floor five times too high.
  const norm = require('../src/normalise');
  const src = fs.readFileSync(path.join(__dirname, 'fixtures', 'dragged-handle.svg'), 'utf8');
  const r = norm.normalise(src, { tokens: TH.tokens });
  assert.strictEqual(r.ok, false, 'a file with a 99999 unit drag in it was accepted');
  assert.strictEqual(r.svg, null);
  const stray = r.findings.find((f) => f.code === 'stray-geometry');
  assert.ok(stray && stray.level === 'blocker', JSON.stringify(r.findings.map((f) => f.code)));
  assert.ok(/99839/.test(stray.what), stray.what);
  // a modest bleed past the edge is a warning, not a refusal
  const bleed = norm.normalise('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">'
    + '<path data-slot="ink" d="M20 20h120v120H20z" fill="#2F3A2C"/>'
    + '<path data-slot="ink" d="M-14 152h188v14h-188z" fill="#2F3A2C"/></svg>', { tokens: TH.tokens });
  assert.ok(bleed.ok, 'a bleed was refused');
  const w2 = bleed.findings.find((f) => f.code === 'stray-geometry');
  assert.ok(w2 && w2.level === 'warning', JSON.stringify(bleed.findings.map((f) => f.code)));
  // the shipped fixture keeps that bleed, and builds
  assert.ok(TH.assets.mark.source.length > 0);
  assert.deepStrictEqual(thM.markInk, { x: 0, y: 20, w: 160, h: 140 });
});

test('a box with no size, and a file with nothing in it, are refused in words', () => {
  // both were accepted: a zero viewBox gave every measurement as zero, a
  // negative one gave a negative narrowest stem, and an unpainted file threw a
  // bare Error out of the measuring step much later on.
  const norm = require('../src/normalise');
  const good = '<path data-slot="ink" d="M10 40h80v20H10z" fill="#0A2A33"/>';
  const blocked = (src) => {
    const r = norm.normalise(src, { tokens: project.tokens });
    assert.strictEqual(r.ok, false, `accepted: ${src.slice(0, 60)}`);
    return r.findings.filter((f) => f.level === 'blocker').map((f) => f.code);
  };
  assert.ok(blocked(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 0 0">${good}</svg>`)
    .includes('empty-viewbox'));
  assert.ok(blocked(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 -100 -100">${good}</svg>`)
    .includes('empty-viewbox'));
  assert.ok(blocked('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
    + '<path d="M10 40h80v20H10z" fill="none"/></svg>').includes('nothing-drawn'));
  assert.ok(blocked('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
    + '<path d="M300 300h50v50h-50z" fill="#0A2A33"/></svg>').includes('nothing-drawn'));
  // and every real fixture still loads
  for (const p of [project, HAL, KV, HW, NL, PG, MY, TH]) assert.ok(p.assets.mark.source);
});

test('a blocker found after the first pass still blocks', () => {
  // ok was hardcoded true at the end of the function, so every refusal that
  // needs the file cleaned before it can be seen was reported and then ignored.
  const norm = require('../src/normalise');
  const r = norm.normalise(fs.readFileSync(path.join(__dirname, 'fixtures', 'dragged-handle.svg'), 'utf8'),
    { tokens: TH.tokens });
  assert.ok(r.findings.some((f) => f.level === 'blocker'));
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.svg, null);
  assert.deepStrictEqual(r.slots, []);
});

test('change the master and every number follows it, in all eight', () => {
  // the claim the whole thing rests on, and it had only ever been checked on
  // Meridian. Halve the artwork inside the same box: the ink box and the clear
  // space halve with it, and the stem halves, so the smallest usable size —
  // which is the box divided by the stem — doubles.
  const norm = require('../src/normalise');
  for (const p of [project, HAL, KV, HW, NL, PG, MY, TH]) {
    // artwork that runs off its artboard is clipped by it, so shrinking it
    // brings more of it back into view and the relation is not a straight one.
    // Thornbury bleeds on purpose and is the one project this cannot hold for.
    const bleeds = norm.normalise(p.assets.mark.source, { tokens: p.tokens })
      .findings.some((f) => f.code === 'stray-geometry');
    if (bleeds) { assert.strictEqual(p.brand, 'Thornbury Mills'); continue; }
    const vb = svgu.viewBox(svgu.parse(p.assets.mark.source));
    const inner = /<svg[^>]*>([\s\S]*)<\/svg>/.exec(p.assets.mark.source)[1];
    const half = p.assets.mark.source.replace(inner,
      `<g transform="translate(${vb.x} ${vb.y}) scale(0.5) translate(${-vb.x} ${-vb.y})">${inner}</g>`);
    const shrunk = measure(Object.assign({}, p, {
      assets: Object.assign({}, p.assets, { mark: Object.assign({}, p.assets.mark, { source: half }) }),
    }));
    const was = measure(p);
    const near = (a, b, why) => assert.ok(Math.abs(a - b) / Math.max(b, 1e-9) < 0.05,
      `${p.brand}: ${why} — got ${a}, expected about ${b}`);
    near(shrunk.markInk.w, was.markInk.w / 2, 'the ink box did not halve');
    near(shrunk.markInk.h, was.markInk.h / 2, 'the ink box did not halve');
    near(shrunk.clearSpace, was.clearSpace / 2, 'the clear space did not follow the ink');
    near(shrunk.minimumSize.thinnestStroke, was.minimumSize.thinnestStroke / 2,
      'the narrowest part did not halve');
    near(shrunk.minimumSize.screenPx, was.minimumSize.screenPx * 2,
      'the smallest usable size did not double');
  }
});

console.log('\na ninth identity');
// Eight rounds spent checking the artwork. Cusp is a project whose *file* is
// the thin part: one lockup, one colourway, two colours, no content section,
// clear space set to a multiple rather than a fraction, and a colourway cut
// for a ground that is not in the palette.
const CU = projectLoader.load(path.join(__dirname, '..', 'projects', 'cusp', 'project.json'));
const cuM = measure(CU);

const tmpProject = (mut, from = 'meridian') => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-rules-'));
  const src = path.join(__dirname, '..', 'projects', from);
  for (const f of fs.readdirSync(src)) if (f.endsWith('.svg')) fs.copyFileSync(path.join(src, f), path.join(dir, f));
  const p = JSON.parse(fs.readFileSync(path.join(src, 'project.json'), 'utf8'));
  mut(p);
  fs.writeFileSync(path.join(dir, 'project.json'), JSON.stringify(p));
  return dir;
};

test('a rule that cannot be true is refused, like a mark that cannot be drawn', () => {
  // the engine checked the artwork exhaustively and took its own numbers
  // entirely on faith: minStrokePx of -3 gave a smallest usable size of -40 px,
  // and a clearSpaceRatio of -0.5 gave negative clear space, both reported as
  // measurements.
  const refuses = (mut, pattern) => {
    const dir = tmpProject(mut);
    assert.throws(() => projectLoader.load(path.join(dir, 'project.json')), pattern);
    fs.rmSync(dir, { recursive: true, force: true });
  };
  refuses((p) => { p.rules.minStrokePx = 0; }, /minStrokePx is 0/);
  refuses((p) => { p.rules.minStrokePx = -3; }, /minStrokePx is -3/);
  refuses((p) => { p.rules.minStrokeMm = 0; }, /minStrokeMm/);
  refuses((p) => { p.rules.clearSpaceRatio = -0.5; }, /clearSpaceRatio is -0.5/);
  refuses((p) => { p.rules.wordmarkHeightRatio = 0; }, /wordmarkHeightRatio is 0/);
  refuses((p) => { p.rules.lockupGapRatio = -1; }, /on top of the mark/);
  refuses((p) => { p.rules.pngWidths = [0]; }, /not a width/);
  // and every real project still loads
  for (const p of ['meridian', 'halyard', 'kvist', 'hallward', 'northline', 'perigee', 'maayan', 'thornbury', 'cusp']) {
    assert.ok(projectLoader.load(path.join(__dirname, '..', 'projects', p, 'project.json')).brand);
  }
});

test('a naming pattern that cannot tell the files apart is refused', () => {
  // five colourways of a lockup all written to one filename: the client gets
  // one file where the manual promises five, and nothing says so.
  const dir = tmpProject((p) => { p.rules.naming = '{brand}-{lockup}'; });
  assert.throws(() => projectLoader.load(path.join(dir, 'project.json')), /does not tell the files apart/);
  fs.rmSync(dir, { recursive: true, force: true });
  const dupe = tmpProject((p) => { p.rules.colourways[1].name = p.rules.colourways[0].name; });
  assert.throws(() => projectLoader.load(path.join(dupe, 'project.json')), /both called/);
  fs.rmSync(dupe, { recursive: true, force: true });
  // one lockup and one colourway need neither in the pattern, and Cusp has both
  assert.strictEqual(CU.rules.naming, '{brand}');
  assert.strictEqual(CU.rules.lockups.length, 1);
  assert.strictEqual(CU.rules.colourways.length, 1);
});

test('a ground is a palette colour or a plain one, and anything else is said', () => {
  // Meridian cuts colourways for "white" and "black", which are paper and ink
  // rather than brand colours, and is entitled to. Cusp names "bone", which is
  // neither, and nothing could work out whether its mark could be seen on it.
  const contrast = require('../src/contrast');
  assert.ok(project.rules.colourways.some((c) => c.on === 'white'));
  assert.strictEqual(contrast.toHex('white'), '#FFFFFF');
  assert.strictEqual(CU.rules.colourways[0].on, 'bone');
  assert.strictEqual(contrast.toHex('bone'), null);
  assert.ok(!CU.tokens.colour.bone);
  // and the specimen still finds a ground the mark can be seen on
  const docs = require('../src/documents');
  const b = require('../src/documents/blocks');
  const s = b.showOn(docs.context(CU, cuM, [], {}));
  assert.ok(s.worst >= b.SEEN, `Cusp shows its mark at ${s.worst.toFixed(2)}:1 on ${s.ground.name}`);
  assert.strictEqual(s.ground.name, 'shell');
});

test('clear space set as a multiple rather than a fraction is questioned', () => {
  // 2.5 makes the mark a thirty-sixth of the space it reserves
  assert.strictEqual(CU.rules.clearSpaceRatio, 2.5);
  assert.ok(cuM.clearSpace > cuM.markInk.h * 2, 'this fixture is meant to reserve too much');
  for (const p of [project, HAL, KV, HW, NL, PG, MY, TH]) {
    assert.ok(p.rules.clearSpaceRatio <= 2, `${p.brand} reserves ${p.rules.clearSpaceRatio} times the mark`);
  }
});

test('a project with no content section still makes both documents', () => {
  assert.ok(!CU.content || !CU.content.misuse, 'this fixture is meant to have no content');
  const docs = require('../src/documents');
  const { deck } = require('../src/documents/deck');
  const ctx = docs.context(CU, cuM, [], {});
  const manual = docs.guidelines(ctx);
  assert.ok(manual.length > 4000 && !/hb-missing/.test(manual), 'the manual came out short or holed');
  assert.ok(deck(ctx).length > 4000);
  assert.ok(/undefined|NaN|\[object/.test(manual) === false, 'something leaked into the manual');
});

console.log('\na tenth identity');
// Nine projects, and not one of them ever produced a pattern: every build said
// "no pattern was written". A whole module — the tile, the densities, the
// contrast refusals — had never run end to end, because no fixture had ever
// marked a shape as the pattern source. Fathom's graphic language is the
// pattern, so it does.
const FA = projectLoader.load(path.join(__dirname, '..', 'projects', 'fathom', 'project.json'));
const faM = measure(FA);

test('a pattern is actually cut, and the files can be opened', () => {
  // the tile stripped fill and stroke off the source shape and then wrote its
  // own — but not stroke-width or stroke-linecap, so a source that carried
  // either produced the attribute twice. That is not valid SVG: all nine tiles
  // went into the package and no renderer would open one of them.
  const pattern = require('../src/pattern');
  const system = require('../src/system');
  assert.ok(/data-pattern="source"/.test(FA.assets.mark.source), 'the fixture marks no pattern source');
  const rules = system.resolve(FA, faM).pattern;
  const t = pattern.tile(FA.assets.mark.source, rules, '#0F3A46');
  assert.ok(t.ok, t.why);
  assert.strictEqual((t.svg.match(/stroke-linecap=/g) || []).length, 3, t.svg.slice(0, 200));
  assert.strictEqual((t.svg.match(/stroke-width=/g) || []).length, 3);
  geo.inkBox(t.svg);                       // throws if the renderer cannot read it
  // and every density in every colourway comes out readable
  const ways = FA.rules.colourways.map((c) => ({ name: c.name, ink: Object.values(c.slots)[0],
    on: (FA.tokens.colour[c.on] || {}).hex || '#FFFFFF' }));
  const gen = pattern.everyTile(FA.assets.mark.source, rules, ways, null);
  assert.ok(gen.ok, gen.why);
  assert.strictEqual(gen.tiles.length, 9, `${gen.tiles.length} tiles`);
  for (const tl of gen.tiles) geo.inkBox(tl.tile);
});

test('the engine does not write an SVG it cannot read back', () => {
  // nothing had ever tried, which is why nine unopenable files shipped without
  // a murmur. Every project in the repo is built and every SVG in it re-read.
  const { Resvg } = require('@resvg/resvg-js');
  const dup = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">'
    + '<path d="M0 0h10" stroke="#000" stroke-linecap="round" stroke-linecap="round"/></svg>';
  assert.throws(() => new Resvg(dup, { fitTo: { mode: 'width', value: 10 } }),
    /already defined/, 'the renderer no longer rejects a duplicated attribute');
  // and geo.inkBox, which is what the writer uses as its reader, rejects it too
  // (the XML parser gets there first, and words it differently)
  assert.throws(() => geo.inkBox(dup), /redefined|already defined/);
  // every SVG every project writes is re-read at the moment it is written; a
  // build that produced an unreadable one would say so in its warnings
  assert.ok(!/cannot read back/.test(fs.readFileSync(path.join(out, 'README.txt'), 'utf8')));
});

test('a project with a pattern still measures like any other', () => {
  assert.deepStrictEqual(faM.slots, ['ink', 'tide']);
  assert.deepStrictEqual(faM.markInk, { x: 11, y: 23, w: 98, h: 80 });
  assert.strictEqual(faM.minimumSize.thinnestStroke, 10);
  assert.strictEqual(faM.clearSpace, 24);
});

console.log('\nbuilding the same thing twice');
test('two builds of an unchanged master are the same package', () => {
  // they were not, and it defeated the one thing this project asks you to do.
  // 45 of Meridian's 138 files changed on every run: the block ids in the
  // starter document were a counter plus the clock, the PDFs carried a
  // creation date and a fresh random file identifier, usage.json carried the
  // moment it was written, and the zip carried the mtime of every entry — so
  // you could not build twice and diff to see what a change to the master did.
  const runs = [];
  const was = process.env.SOURCE_DATE_EPOCH;
  process.env.SOURCE_DATE_EPOCH = '1700000000';
  try {
    for (let i = 0; i < 2; i++) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-repeat-'));
      runs.push(dir);
      const emit = require('../src/editor/emit');
      const docs = require('../src/documents');
      // the parts that were carrying a clock or a random number
      fs.writeFileSync(path.join(dir, 'editor.html'), emit.editorHtml(project, m, []));
      fs.writeFileSync(path.join(dir, 'guidelines.html'), docs.guidelines(docs.context(project, m, [], {})));
      fs.writeFileSync(path.join(dir, 'doc.json'),
        JSON.stringify(require('../src/editor/bundle').starterDoc(bundleOf(project, m))));
    }
    for (const f of ['editor.html', 'guidelines.html', 'doc.json']) {
      assert.ok(fs.readFileSync(path.join(runs[0], f)).equals(fs.readFileSync(path.join(runs[1], f))),
        `${f} came out different the second time`);
    }
  } finally {
    if (was === undefined) delete process.env.SOURCE_DATE_EPOCH; else process.env.SOURCE_DATE_EPOCH = was;
    for (const d of runs) fs.rmSync(d, { recursive: true, force: true });
  }
});

test('block ids are stable, and still unique after a reload', () => {
  // the clock in the id was doing real work: the counter restarts at zero every
  // session, so a document loaded from disk and added to would hand out b1
  // twice. Counting on from what the document already holds does the same job.
  const first = EM.resetIds() === undefined && require('../src/editor/bundle').starterDoc(bu);
  const second = require('../src/editor/bundle').starterDoc(bu);
  assert.deepStrictEqual(first.pages.map((p) => p.blocks.map((b) => b.id)),
    second.pages.map((p) => p.blocks.map((b) => b.id)), 'the same document twice, different ids');
  // now reload it and add: the new id must not already be in use
  EM.seedIds(first);
  const existing = new Set();
  for (const p of first.pages) { existing.add(p.id); for (const b of p.blocks) existing.add(b.id); }
  const fresh = EM.makeBlock('text', { x: 0, y: 0 }, first.pages[0]);
  assert.ok(!existing.has(fresh.id), `a reload handed out ${fresh.id}, which is already in the document`);
});

console.log('\nsettings the engine ignores');
test('a setting nothing reads is reported, with the nearest real one', () => {
  // a key the engine does not read is a rule the designer set and the engine
  // ignored: the manual quietly shows the default and there is no way to tell
  // from the outside that anything was dropped.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-typo-'));
  const src = path.join(__dirname, '..', 'projects', 'meridian');
  for (const f of fs.readdirSync(src)) if (f.endsWith('.svg')) fs.copyFileSync(path.join(src, f), path.join(dir, f));
  const p = JSON.parse(fs.readFileSync(path.join(src, 'project.json'), 'utf8'));
  p.rules.clearspaceRatio = 0.9;          // wrong case
  p.rules.sausages = true;                // nothing like it
  fs.writeFileSync(path.join(dir, 'project.json'), JSON.stringify(p));
  const loaded = projectLoader.load(path.join(dir, 'project.json'));
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-typo-out-'));
  return require('../src/build').build(loaded, outDir, { log: () => {} }).then((r) => {
    const said = r.warnings.filter((w) => /nothing reads it/.test(w));
    assert.strictEqual(said.length, 2, JSON.stringify(said));
    assert.ok(said.some((w) => /clearspaceRatio.*Did you mean rules\.clearSpaceRatio/.test(w)), said[0]);
    assert.ok(said.some((w) => /sausages/.test(w) && !/Did you mean/.test(w)), said[1]);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(outDir, { recursive: true, force: true });
  });
});

test('the icon rules can be set, spelled either way', () => {
  // the engine reads system.icons; a designer writing it beside system.pattern
  // and system.photography writes system.icon, and got nothing, silently
  const system = require('../src/system');
  const base = system.resolve(project, m).icons;
  assert.strictEqual(base.box, 24);
  for (const key of ['icons', 'icon']) {
    const over = system.resolve(Object.assign({}, project, { system: { [key]: { box: 32 } } }), m).icons;
    assert.strictEqual(over.box, 32, `system.${key} was ignored`);
    // and the rest is still derived from the mark, not replaced by the override
    assert.strictEqual(over.derivedFrom.markStroke, base.derivedFrom.markStroke);
  }
});

test('every project in the repo sets only things that are read', () => {
  // the check is worth nothing if the fixtures themselves trip it
  const names = fs.readdirSync(path.join(__dirname, '..', 'projects'))
    .filter((d) => fs.existsSync(path.join(__dirname, '..', 'projects', d, 'project.json')));
  assert.ok(names.length >= 10, `${names.length} projects`);
  // The engine's own audit, not a copy of it. Reading the engine's key list was
  // the twenty-first round's fix; this test still kept its own copy of which
  // object each section names, so adding tokens as a third section sent it
  // looking in project.system and it failed on a project that was right —
  // the same defect one level down. One implementation, called twice.
  const { unreadKeys } = require('../src/build');
  for (const n of names) {
    const p = projectLoader.load(path.join(__dirname, '..', 'projects', n, 'project.json'));
    assert.deepStrictEqual(unreadKeys(p), [], `${n} sets something nothing reads`);
  }
});
test('the audit that finds unread keys can still find one', () => {
  const { unreadKeys } = require('../src/build');
  const p = projectLoader.load(PROJECT);
  const bent = Object.assign({}, p, { tokens: Object.assign({}, p.tokens, { spacing: { base: 8 } }),
    rules: Object.assign({}, p.rules, { clearspaceRatio: 0.3 }) });
  const said = unreadKeys(bent);
  assert.ok(said.some((w) => /tokens\.spacing is set, and nothing reads it/.test(w)), said.join('\n'));
  assert.ok(said.some((w) => /Did you mean rules\.clearSpaceRatio/.test(w)), said.join('\n'));
});

console.log('\nan eleventh identity');
// Ten marks, and not one of them taller than it is wide by more than a fifth.
// Kvist tested wide; nothing had ever tested tall. Spire is an emblem 4.7 times
// taller than it is across, with six colour slots where every other project has
// one to three.
const SP = projectLoader.load(path.join(__dirname, '..', 'projects', 'spire', 'project.json'));
const spM = measure(SP);

test('the smallest usable size says which way round it is', () => {
  // it is a width — the box divided by the stem across it — and no document
  // ever said so. For a mark 4.7 times taller than wide, "13 px" means 13
  // across and 42 down, and anyone setting the height to 13 gets a mark 3 px
  // wide with a 0.9 px stem in it.
  assert.ok(!spM.minimumSize.squarish, 'this fixture is meant not to be square');
  assert.strictEqual(spM.minimumSize.screenPx, 13);
  assert.strictEqual(spM.minimumSize.screenPxHigh, 42);
  assert.strictEqual(geo.floorText(spM.minimumSize, 'px'), '13 × 42 px');
  // the arithmetic behind it: at that width the narrowest part is the rule
  const atFloor = spM.minimumSize.thinnestStroke * spM.minimumSize.screenPx / spM.markViewBox.w;
  assert.ok(Math.abs(atFloor - SP.rules.minStrokePx) < 0.5,
    `at the floor the narrowest part is ${atFloor.toFixed(2)} px, and the rule says ${SP.rules.minStrokePx}`);
  // a square mark still reads as one number, exactly as it did
  assert.ok(m.minimumSize.squarish);
  assert.strictEqual(geo.floorText(m.minimumSize, 'px'), '32 px');
  // and the wide one has been ambiguous the same way since it was added
  assert.ok(!kvM.minimumSize.squarish);
  assert.strictEqual(geo.floorText(kvM.minimumSize, 'px'), '110 × 40 px');
  // brand.json carries both, and says which is which
  const bj = JSON.parse(fs.readFileSync(path.join(out, 'brand.json'), 'utf8'));
  assert.ok(bj.logo.minSize.screenPxHigh > 0);
  assert.ok(/widths/.test(bj.logo.minSize.note), bj.logo.minSize.note);
});

test('a diagram is at least as wide as the words written under it', () => {
  // the canvas follows the shape of the artwork, which is right, and was only
  // ever checked on a wide mark. For a tall one the canvas is 123 units across
  // while its caption needs 173, and the caption was cut off mid-word.
  const docs = require('../src/documents');
  const b = require('../src/documents/blocks');
  const box = (svg) => (/viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg) || []).slice(1).map(Number);
  const widest = (svg) => Math.max(...[...svg.matchAll(/>([^<]*)<\/text>/g)]
    .map((t) => t[1].replace(/&[a-z]+;/g, 'x').length * 4.9));
  for (const [proj, meas] of [[project, m], [KV, kvM], [SP, spM], [HW, hwM]]) {
    const ctx = docs.context(proj, meas, [], {});
    for (const draw of [b.construction(ctx), b.clearSpace(ctx)]) {
      const [w] = box(draw);
      assert.ok(w >= widest(draw), `${proj.brand}: a ${w} wide drawing carries a ${Math.round(widest(draw))} wide caption`);
    }
  }
});

test('a mark of six colour slots is cut in every one of them', () => {
  // every project so far had one slot to three
  assert.strictEqual(spM.slots.length, 6);
  assert.deepStrictEqual(spM.slots, ['finial', 'spire', 'belfry', 'louvre', 'shaft', 'base']);
  for (const cw of SP.rules.colourways) {
    assert.deepStrictEqual(Object.keys(cw.slots).sort(), spM.slots.slice().sort(),
      `colourway ${cw.name} does not name every slot`);
  }
  const { buildVariant } = require('../src/variants');
  const v = buildVariant({ markSrc: SP.assets.mark.source, wordmarkSrc: SP.assets.wordmark.source,
    lockup: 'mark', colourway: SP.rules.colourways[1], rules: SP.rules, measured: spM });
  assert.deepStrictEqual(v.missing, []);
  for (const hex of new Set(Object.values(SP.rules.colourways[1].slots))) {
    assert.ok(v.svg.includes(hex), `${hex} did not reach the artwork`);
  }
});

test('a tall mark composes a lockup that is not absurd', () => {
  // the wordmark is scaled against the mark's HEIGHT, so a very tall mark could
  // have blown the horizontal lockup out sideways
  const { buildVariant } = require('../src/variants');
  const h = buildVariant({ markSrc: SP.assets.mark.source, wordmarkSrc: SP.assets.wordmark.source,
    lockup: 'horizontal', colourway: SP.rules.colourways[0], rules: SP.rules, measured: spM });
  const ratio = h.box.w / h.box.h;
  assert.ok(ratio > 0.5 && ratio < 6, `the horizontal lockup came out ${h.box.w} by ${h.box.h}`);
  assert.ok(spM.markInk.h / spM.markInk.w > 4, 'this fixture is meant to be tall');
});

test('one specimen, drawn by two renderers, says the same thing', () => {
  // the height went into the manual's copy of the size specimen and not into
  // the canvas's, so the same mark read "110 × 40 px" in the book and "110 px"
  // on the page the book published. The steps are worked out once now.
  const b = require('../src/documents/blocks');
  const docs = require('../src/documents');
  for (const [proj, meas] of [[project, m], [KV, kvM], [SP, spM], [HW, hwM]]) {
    const steps = meas.minimumSize.steps;
    assert.strictEqual(steps.length, 3, `${proj.brand}: three steps`);
    // the middle step is the floor, and it must be worded exactly as the prose is
    assert.strictEqual(steps[1].px, meas.minimumSize.screenPx);
    assert.strictEqual(steps[1].caption, geo.floorText(meas.minimumSize, 'px'),
      `${proj.brand}: the caption under the picture disagrees with the sentence beside it`);
    const manual = b.minimumSize(docs.context(proj, meas, [], {}));
    const canvas = ER.block(EM.makeBlock('minimumSize'), bundleOf(proj, meas));
    for (const st of steps) {
      assert.ok(manual.includes(st.caption), `${proj.brand}: the manual does not say ${st.caption}`);
      assert.ok(canvas.includes(st.caption), `${proj.brand}: the canvas does not say ${st.caption}`);
    }
  }
});

test('three sizes are drawn at three sizes, whatever the floor is', () => {
  // Hallward's floor is 766 px, so its specimen asked for 1532, 766 and 460 px
  // in a column 282 wide. The manual capped each one on its own, which drew the
  // same picture three times under three different numbers; the canvas capped
  // none of them and ran a 1532 px mark off a 1400 px page.
  const b = require('../src/documents/blocks');
  const docs = require('../src/documents');
  const widths = (html) => [...html.matchAll(/width:min\((\d+(?:\.\d+)?)px,(\d+(?:\.\d+)?)%\)/g)]
    .map((x) => [Number(x[1]), Number(x[2])]);
  for (const [proj, meas] of [[project, m], [KV, kvM], [SP, spM], [HW, hwM]]) {
    const steps = meas.minimumSize.steps;
    for (const html of [b.minimumSize(docs.context(proj, meas, [], {})),
      ER.block(EM.makeBlock('minimumSize'), bundleOf(proj, meas))]) {
      const w = widths(html);
      assert.strictEqual(w.length, 3, `${proj.brand}: expected three capped previews`);
      // the true size is offered first, so a page with room draws it life-size
      assert.deepStrictEqual(w.map((x) => x[0]), steps.map((x) => x.px));
      // and where there is not room, the percentages hold the same proportion
      assert.strictEqual(w[0][1], 100);
      for (let i = 1; i < 3; i++) {
        const want = (steps[i].px / steps[0].px) * 100;
        assert.ok(Math.abs(w[i][1] - want) < 0.02,
          `${proj.brand}: step ${i} shrinks to ${w[i][1]}% where proportion wants ${want.toFixed(2)}%`);
      }
    }
  }
});

test('an app icon written under the project\'s own stroke rule is named', async () => {
  // The engine refuses an icon you hand it whose stroke lands under
  // rules.minStrokePx, and wrote its own at sizes far under the same rule
  // without a word.
  const exp = require('../src/export');
  const at = (meas, size) => (meas.minimumSize.thinnestStroke * size * exp.ICON_SAFE_AREA)
    / Math.max(meas.markInk.w, meas.markInk.h);

  // Hallward is the case: nothing it writes clears its own 3 px rule, its
  // largest icon included, and it needs a 1095 px square before it holds
  const hw = exp.iconFloor(hwM, HW.rules);
  assert.strictEqual(hw.clears.length, 0);
  assert.strictEqual(hw.smallest, 1095);
  assert.deepStrictEqual(hw.thinIcons.map((i) => i.name), ['icon-1024.png', 'icon-180.png']);
  // and the number is the one iconSquare draws with, not a second copy of it
  assert.ok(Math.abs(hw.thinIcons[1].at - at(hwM, 180)) < 0.005);

  // A favicon under the rule is not a fault of the artwork — no mark of any
  // weight clears 3 px at 16 — so it is recorded and not warned about.
  for (const [proj, meas] of [[project, m], [KV, kvM], [SP, spM], [HW, hwM]]) {
    const f = exp.iconFloor(meas, proj.rules);
    assert.ok(f.thinFavicons.some((i) => /favicon-(16|32)/.test(i.name)),
      `${proj.brand}: a 16 or 32 px favicon of any mark is under the rule`);
    // the crossover agrees with the per-size measurement on both sides of it
    assert.ok(at(meas, f.smallest) >= proj.rules.minStrokePx);
    assert.ok(at(meas, f.smallest - 1) < proj.rules.minStrokePx);
    for (const i of f.thinIcons.concat(f.thinFavicons)) assert.ok(i.size < f.smallest);
    for (const name of f.clears) {
      assert.ok(Number(/-(\d+)\.png$/.exec(name)[1]) >= f.smallest, `${name} is said to clear`);
    }
  }

  // only the project whose app icons fail is warned, so the warning stays a
  // signal rather than a line every package carries
  assert.strictEqual(exp.iconFloor(m, project.rules).thinIcons.length, 0);
  assert.strictEqual(exp.iconFloor(spM, SP.rules).thinIcons.length, 0);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-hwicon-'));
  const built = await build(HW, dir);
  fs.rmSync(dir, { recursive: true, force: true });
  const w = built.warnings.find((x) => /app icons? (was|were) written/.test(x));
  assert.ok(w, 'Hallward built without a word about the icons it drew below its own rule');
  assert.ok(/icon-180\.png at 0\.49 px/.test(w), w);
  assert.ok(/needs 1095 px square/.test(w), w);
  assert.ok(/check <icon\.svg> --icon/.test(w), 'the warning does not say what to do instead');
  // brand.json carries the same numbers for every project, warned or not
  const bj = JSON.parse(fs.readFileSync(path.join(out, 'brand.json'), 'utf8'));
  assert.strictEqual(bj.logo.icons.smallestSquarePx, exp.iconFloor(m, project.rules).smallest);
  assert.ok(bj.logo.icons.clears.includes('icon-512.png'));
  assert.deepStrictEqual(bj.logo.icons.under.map((u) => u.file), ['favicon-16.png', 'favicon-32.png']);
});

// Eleven identities, and every mark in all twenty-two files was flat colour:
// no gradient, no mask, no filter, no image. Vesper is a gradient identity,
// which is the commonest thing in the repo's blind spot and the one that breaks
// the idea a colourway rests on — that a slot is one colour.
const VE = projectLoader.load(path.join(__dirname, '..', 'projects', 'vesper', 'project.json'));
const veM = measure(VE);
let veBuilt = null;
before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-vesper-'));
  veBuilt = await build(VE, dir);
  veBuilt.dir = dir;
});

test('a colourway can keep the paint the master drew, and only then', () => {
  // applyColourway rewrote the fill of every slot it was given a colour for,
  // gradient or not, so the gradient was thrown away in all three colourways
  // including the one whose whole job was to carry it.
  assert.deepStrictEqual(svgu.gradientSlots(svgu.parse(VE.assets.mark.source)), ['ring']);
  const carries = VE.rules.colourways.filter((c) => c.slots.ring === svgu.KEEP).map((c) => c.name);
  assert.deepStrictEqual(carries, ['dusk'], 'one colourway is meant to carry the gradient');

  for (const cw of VE.rules.colourways) {
    for (const lockup of VE.rules.lockups) {
      const v = buildVariant({ markSrc: VE.assets.mark.source, wordmarkSrc: VE.assets.wordmark.source,
        lockup, colourway: cw, rules: VE.rules, measured: veM });
      const keeps = cw.slots.ring === svgu.KEEP;
      assert.strictEqual(/url\(#/.test(v.svg), keeps,
        `${cw.name}/${lockup}: the gradient ${keeps ? 'should be' : 'should not be'} referenced`);
      // and a definition nothing points at is not shipped
      assert.strictEqual(/<linearGradient/.test(v.svg), keeps,
        `${cw.name}/${lockup}: a gradient definition nothing references travelled into the file`);
      assert.deepStrictEqual(v.kept, keeps ? ['ring'] : []);
    }
  }
});

test('a gradient no colourway keeps is reported, not quietly dropped', async () => {
  const flat = JSON.parse(JSON.stringify(require(path.join(__dirname, '..', 'projects', 'vesper', 'project.json'))));
  flat.rules.colourways[0].slots.ring = '#B8336A';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-vesper-flat-'));
  const src = path.join(dir, 'project.json');
  for (const f of ['mark.svg', 'wordmark.svg']) {
    fs.copyFileSync(path.join(__dirname, '..', 'projects', 'vesper', f), path.join(dir, f));
  }
  fs.writeFileSync(src, JSON.stringify(flat));
  const r = await build(projectLoader.load(src), path.join(dir, 'out'));
  const w = r.warnings.find((x) => /paints? .*with a gradient/.test(x));
  assert.ok(w, 'the gradient went nowhere and the build said nothing');
  assert.ok(/in none of the files/.test(w), w);
  assert.ok(/Write "keep"/.test(w), 'the warning does not say what to write instead');
  // and nothing it wrote carries the gradient, which is what the warning claims
  const svgs = [];
  (function look(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) look(path.join(d, e.name));
      else if (e.name.endsWith('.svg')) svgs.push(path.join(d, e.name));
    }
  }(path.join(dir, 'out')));
  assert.ok(svgs.length);
  for (const f of svgs) {
    assert.ok(!/linearGradient/.test(fs.readFileSync(f, 'utf8')), `${path.basename(f)} still carries it`);
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a PDF carrying a gradient is not called DeviceCMYK', () => {
  // jsPDF writes a gradient as a shading dictionary and hardcodes its colour
  // space to DeviceRGB, and there is no hook to say otherwise — so the package
  // claimed the ink build it had not used for the one shape that is the mark.
  const bj = JSON.parse(fs.readFileSync(path.join(veBuilt.dir, 'brand.json'), 'utf8'));
  assert.deepStrictEqual(bj.print.gradientFiles.slice().sort(),
    ['vesper-horizontal-dusk.pdf', 'vesper-mark-dusk.pdf', 'vesper-stacked-dusk.pdf']);
  assert.ok(/DeviceCMYK, except the gradient in 3 files/.test(bj.print.pdfColourSpace), bj.print.pdfColourSpace);
  const w = veBuilt.warnings.find((x) => /carry a gradient/.test(x));
  assert.ok(w && /DeviceRGB/.test(w) && /flat version/.test(w), w);

  // measured in the bytes: the gradient file mixes spaces, the flat one does not
  const spaces = (f) => {
    const s = fs.readFileSync(path.join(veBuilt.dir, '03-mark', f)).toString('latin1');
    return { rgb: /\/ColorSpace\s*\/DeviceRGB/.test(s) };
  };
  assert.strictEqual(spaces('vesper-mark-dusk.pdf').rgb, true);
  assert.strictEqual(spaces('vesper-mark-flat.pdf').rgb, false);
  // a project with no gradient still says what it always said
  const mj = JSON.parse(fs.readFileSync(path.join(out, 'brand.json'), 'utf8'));
  assert.strictEqual(mj.print.pdfColourSpace, 'DeviceCMYK');
  assert.deepStrictEqual(mj.print.gradientFiles, []);
});

test('a gradient is measured against its ground by its worst stop', () => {
  // "keep" is not a colour, contrast.ratio returns null for it, and
  // Math.min(11.86, null, 2.8) is 0 — so a colourway carrying a gradient scored
  // zero against every ground and was never chosen for anything. The build's
  // own readability check had the opposite bug: it dropped the null, so the
  // pale end of the gradient was the one part of the mark never checked.
  const b = require('../src/documents/blocks');
  const docs = require('../src/documents');
  const ctx = docs.context(VE, veM, [], {});
  const dusk = VE.rules.colourways.find((c) => c.name === 'dusk');
  const stops = svgu.gradients(svgu.parse(VE.assets.mark.source))[0].stops.map((s) => s.hex);
  assert.deepStrictEqual(stops, ['#C2620E', '#B8336A', '#2E2A63']);
  // every stop is in what the colourway paints, and nothing else appeared
  const inks = b.inksOf(ctx, dusk);
  for (const st of stops) assert.ok(inks.includes(st), `${st} is not counted as paint`);
  const chalk = VE.tokens.colour.chalk.hex;
  const want = Math.min(...inks.map((h) => contrast.ratio(h, chalk)));
  assert.ok(want > 3 && want < 4, `the worst stop measures ${want} on chalk`);
  assert.strictEqual(b.worstOn(dusk, chalk, ctx), want);
  // without the fix this was exactly 0, which is neither true nor a near miss
  assert.notStrictEqual(b.worstOn(dusk, chalk, ctx), 0);

  // and a stop that cannot be seen is named, with the colour that fails
  const bad = JSON.parse(JSON.stringify(require(path.join(__dirname, '..', 'projects', 'vesper', 'project.json'))));
  const doc = svgu.parse(VE.assets.mark.source);
  assert.ok(svgu.paintBySlot([doc]).get('ring').length === 3);
});

test('the manual leads with the colourway the designer put first', () => {
  // it used to lead with whichever colourway had the most contrast, which only
  // agrees with the designer when the primary role happens to be a ground.
  // Six of the twelve projects opened on a colourway their designer did not put
  // first, five of them while the first read perfectly well.
  const b = require('../src/documents/blocks');
  const docs = require('../src/documents');
  const all = [[project, m], [HAL, measure(HAL)], [KV, kvM], [HW, hwM], [SP, spM], [VE, veM]];
  for (const [proj, meas] of all) {
    const ctx = docs.context(proj, meas, [], {});
    const shown = b.showOn(ctx);
    const first = proj.rules.colourways[0];
    const firstWorst = b.worstOn(first, (proj.tokens.colour[first.on] || {}).hex
      || contrast.toHex(first.on) || '#FFFFFF', ctx);
    if (firstWorst >= b.SEEN) {
      assert.strictEqual(shown.colourway.name, first.name,
        `${proj.brand}: opens on ${shown.colourway.name} while ${first.name} reads at ${firstWorst}`);
    } else {
      // only when the first genuinely cannot be seen does it go looking
      assert.ok(shown.worst >= firstWorst, `${proj.brand}: swapped to something no better`);
    }
  }
  // Vesper opens on the gradient, which is the whole identity
  const s = b.showOn(docs.context(VE, veM, [], {}));
  assert.strictEqual(s.colourway.name, 'dusk');
  assert.ok(b.asColourway(docs.context(VE, veM, [], {}), s.colourway).includes('url(#'));
});

test('the manual shows a gradient where there is one, and says nothing where there is not', () => {
  const b = require('../src/documents/blocks');
  const docs = require('../src/documents');
  const spec = b.gradientSpec(docs.context(VE, veM, [], {}));
  assert.ok(spec, 'a gradient identity gets no gradient page');
  for (const hex of ['#C2620E', '#B8336A', '#2E2A63']) assert.ok(spec.includes(hex), hex);
  assert.ok(/read off the artwork/.test(spec));
  assert.ok(/dusk/.test(spec) && /flat and reverse/.test(spec), 'it does not say which files carry it');
  assert.ok(/spot ink/.test(spec) && /DeviceRGB/.test(spec), 'it does not say what that costs in print');
  // the section exists in the built manual, numbered in sequence
  const html = fs.readFileSync(path.join(veBuilt.dir, 'guidelines.html'), 'utf8');
  assert.ok(/2\.2<\/i>|2\.2/.test(html) && html.includes('The gradient'));
  assert.ok(html.includes('Contrast and accessibility'));
  // and no other project grows an empty one
  for (const [proj, meas] of [[project, m], [KV, kvM], [SP, spM], [HW, hwM]]) {
    assert.strictEqual(b.gradientSpec(docs.context(proj, meas, [], {})), '',
      `${proj.brand} has no gradient and should have no gradient section`);
  }
  assert.ok(!fs.readFileSync(path.join(out, 'guidelines.html'), 'utf8').includes('The gradient'));
});

test('a gradient is said in Typst, not handed to it as a colour', () => {
  // colour() answers rgb("...") for whatever it is given, so a fill of
  // url(#a) came out as rgb("url(#a)") — which Typst refuses outright. Nothing
  // caught it because the only source this repo ever asked Typst to compile was
  // Meridian's page, and the per-project check compares SVG against SVG.
  const typst = require('../src/typst');
  const v = buildVariant({ markSrc: VE.assets.mark.source, wordmarkSrc: VE.assets.wordmark.source,
    lockup: 'mark', colourway: VE.rules.colourways[0], rules: VE.rules, measured: veM });
  const bu = bundleOf(VE, veM);
  const seen = new Set(); seen.unsayable = new Set();
  const src = typst.artwork(v.svg, { x: 0, y: 0, w: 160, h: 160 }, bu, seen);
  assert.ok(!/rgb\("url\(/.test(src), 'a paint server was handed to Typst as a colour string');
  assert.ok(/gradient\.linear\(/.test(src), 'the gradient did not survive into the printed piece');
  assert.strictEqual(seen.unsayable.size, 0);
  // the stops are the declared ink builds, in order, at the offsets the artwork sets
  const stops = /gradient\.linear\(([^]*?), angle:/.exec(src)[1];
  // the offset is the number closing each stop tuple, not the percentages
  // inside the ink build beside it
  assert.deepStrictEqual([...stops.matchAll(/\), ([\d.]+)%\)/g)].map((x) => x[1]), ['0', '52', '100']);
  assert.strictEqual((stops.match(/cmyk\(/g) || []).length, 3, 'a declared build was not used');
  // and an angle, taken from the axis rather than assumed
  const deg = Number(/angle: ([-\d.]+)deg/.exec(src)[1]);
  assert.ok(deg > 45 && deg < 56, `the axis came out at ${deg} degrees`);

  // a flat colourway is unchanged: no gradient, no shading, nothing new
  const flat = buildVariant({ markSrc: VE.assets.mark.source, wordmarkSrc: VE.assets.wordmark.source,
    lockup: 'mark', colourway: VE.rules.colourways[1], rules: VE.rules, measured: veM });
  const flatSrc = typst.artwork(flat.svg, { x: 0, y: 0, w: 160, h: 160 }, bu, new Set());
  assert.ok(!/gradient\./.test(flatSrc));
  // as is every project that never had one
  for (const [proj, meas] of [[project, m], [KV, kvM], [SP, spM]]) {
    const w = buildVariant({ markSrc: proj.assets.mark.source,
      wordmarkSrc: proj.assets.wordmark && proj.assets.wordmark.source,
      lockup: 'mark', colourway: proj.rules.colourways[0], rules: proj.rules, measured: meas });
    const t = typst.artwork(w.svg, { x: 0, y: 0, w: 160, h: 160 }, bundleOf(proj, meas), new Set());
    assert.ok(!/gradient\./.test(t), `${proj.brand} grew a gradient it does not have`);
    assert.ok(!/rgb\("url\(/.test(t), proj.brand);
  }
});

test('"keep" is a word the project file may use, and a typo still is not', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-keep-'));
  for (const f of ['mark.svg', 'wordmark.svg']) {
    fs.copyFileSync(path.join(__dirname, '..', 'projects', 'vesper', f), path.join(dir, f));
  }
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'projects', 'vesper', 'project.json'), 'utf8'));
  const write = (mut) => {
    const d = JSON.parse(JSON.stringify(raw)); mut(d);
    const f = path.join(dir, 'p.json'); fs.writeFileSync(f, JSON.stringify(d)); return f;
  };
  // spelled any way a person would write it
  for (const spelling of ['keep', 'Keep', ' KEEP ']) {
    const p = projectLoader.load(write((d) => { d.rules.colourways[0].slots.ring = spelling; }));
    assert.strictEqual(p.rules.colourways[0].slots.ring, svgu.KEEP, spelling);
  }
  // and anything else that is not a colour is still refused, now naming it
  assert.throws(() => projectLoader.load(write((d) => { d.rules.colourways[0].slots.ring = 'kepe'; })),
    (e) => /is "kepe"/.test(e.message) && /Write "keep"/.test(e.message), 'the refusal does not mention keep');
  fs.rmSync(dir, { recursive: true, force: true });
});

// Twelve identities, and every one of them had both a mark and a wordmark.
// A logotype and nothing else — Google, FedEx, Braun, most of publishing — is
// the commonest kind of identity there is, and the engine refused it outright.
const MW = projectLoader.load(path.join(__dirname, '..', 'projects', 'marlow', 'project.json'));
const mwM = measure(MW);

test('an identity may be a logotype and nothing else', () => {
  assert.deepStrictEqual(Object.keys(MW.assets), ['wordmark']);
  assert.strictEqual(MW.master, 'wordmark');
  assert.strictEqual(mwM.master, 'wordmark');
  // every measurement comes off the logotype, because there is nothing else
  assert.strictEqual(projectLoader.masterOf(MW).path, MW.assets.wordmark.path);
  assert.deepStrictEqual(mwM.markInk, geo.inkBox(MW.assets.wordmark.source));
  assert.ok(mwM.minimumSize.screenPx > 0 && mwM.clearSpace > 0);
  // and a project with both is measured off the mark, exactly as before
  for (const [proj, meas] of [[project, m], [KV, kvM], [VE, veM]]) {
    assert.strictEqual(meas.master, 'mark');
    assert.deepStrictEqual(meas.markInk, geo.inkBox(proj.assets.mark.source));
  }
});

test('a lockup that needs an asset the project has not got is refused by name', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-lock-'));
  fs.copyFileSync(path.join(__dirname, '..', 'projects', 'marlow', 'wordmark.svg'), path.join(dir, 'wordmark.svg'));
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'projects', 'marlow', 'project.json'), 'utf8'));
  const write = (mut) => {
    const d = JSON.parse(JSON.stringify(raw)); mut(d);
    const f = path.join(dir, 'p.json'); fs.writeFileSync(f, JSON.stringify(d)); return f;
  };
  for (const lockup of ['horizontal', 'stacked', 'mark']) {
    assert.throws(() => projectLoader.load(write((d) => { d.rules.lockups = [lockup]; })),
      (e) => new RegExp(`the ${lockup} lockup`).test(e.message) && /assets\.mark/.test(e.message)
        && /the lockups available are wordmark/.test(e.message),
      `${lockup} was not refused in words`);
  }
  // and an identity with neither asset says what to set, rather than naming one field
  assert.throws(() => projectLoader.load(write((d) => { d.assets = {}; })),
    (e) => /where the master artwork is/.test(e.message)
      && /assets\.mark for a symbol/.test(e.message) && /assets\.wordmark for a logotype/.test(e.message));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('the construction drawing puts the artwork where it says it is', () => {
  // the artwork was placed at the top left of the canvas and then drawn in its
  // own coordinates, so a viewBox that does not start at 0 0 put it somewhere
  // else entirely. Nine units out for Kvist since it arrived; for a logotype,
  // whose box starts 94 units above the baseline, the whole drawing landed
  // outside its own grid.
  const b = require('../src/documents/blocks');
  const docs = require('../src/documents');
  const all = [[project, m], [KV, kvM], [HW, hwM], [SP, spM], [VE, veM], [TH, measure(TH)], [MW, mwM]];
  for (const [proj, meas] of all) {
    const dia = b.construction(docs.context(proj, meas, [], {}), { ink: '#000000', line: '#000000' });
    const head = /<svg viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(dia);
    const defs = /(<defs>[^]*?<\/defs>)/.exec(dia)[1];
    const i = dia.indexOf('<g clip-path'), j = dia.indexOf('<text', i);
    const art = dia.slice(i, dia.lastIndexOf('</g>', j) + 4);
    const painted = geo.inkBox(`<svg xmlns="${svgu.NS}" viewBox="0 0 ${head[1]} ${head[2]}">${defs}${art}</svg>`);
    const dash = /<rect x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"[^>]*dasharray/.exec(dia)
      .slice(1).map(Number);
    for (const [i2, got] of [painted.x, painted.y, painted.w, painted.h].entries()) {
      assert.ok(Math.abs(got - dash[i2]) < 1,
        `${proj.brand}: the ink box is drawn at ${dash.join(',')} and the artwork paints at `
        + `${[painted.x, painted.y, painted.w, painted.h].join(',')}`);
    }
  }
});

test('the construction drawing shows what the package contains, and no more', () => {
  // everything the engine writes is clipped to the artboard, because that is
  // what a viewBox does. This drawing was not, so Thornbury's bar reaching 14
  // units past its box — left in on purpose — was drawn here complete, through
  // the very rectangle labelled as the box.
  const b = require('../src/documents/blocks');
  const docs = require('../src/documents');
  const dia = b.construction(docs.context(TH, measure(TH), [], {}), { ink: '#000000', line: '#000000' });
  assert.ok(/clip-path="url\(#/.test(dia), 'the drawing does not clip to the artboard');
  const vb = measure(TH).markViewBox;
  const clip = /<clipPath id="[^"]+"><rect x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"/.exec(dia);
  assert.ok(clip, 'no clip rectangle');
  const box = /<rect x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)" fill="none"/.exec(dia);
  // the clip is the box outline, exactly: the drawing cannot show more than the
  // rectangle it labels as the artboard
  assert.deepStrictEqual(clip.slice(1, 5), box.slice(1, 5));
  assert.ok(vb.w > 0);
});

test('the smallest size specimen is drawn where it can be seen', () => {
  // it painted a brand colourway onto a stage the colour of the page, and the
  // page flips with the reader's light or dark setting. Eight of the thirteen
  // projects drew this block at under 1.1 to 1 in light mode: three blank
  // rectangles where the diagram that says how small the mark may go should be.
  const b = require('../src/documents/blocks');
  const docs = require('../src/documents');
  const all = [[project, m], [HAL, measure(HAL)], [KV, kvM], [HW, hwM], [NL, measure(NL)],
    [TH, measure(TH)], [SP, spM], [VE, veM], [MW, mwM]];
  for (const [proj, meas] of all) {
    const ctx = docs.context(proj, meas, [], {});
    const html = b.minimumSize(ctx);
    const grounds = [...html.matchAll(/class="stage tight" style="background:(#[0-9A-Fa-f]{6})"/g)].map((x) => x[1]);
    assert.strictEqual(grounds.length, 3, `${proj.brand}: the specimen has no ground of its own`);
    assert.strictEqual(new Set(grounds).size, 1, `${proj.brand}: three grounds for one specimen`);
    const shown = b.showOn(ctx);
    assert.strictEqual(grounds[0], shown.ground.hex);
    assert.ok(b.worstOn(shown.colourway, grounds[0], ctx) >= b.SEEN,
      `${proj.brand}: the specimen is drawn at ${b.worstOn(shown.colourway, grounds[0], ctx)} to 1`);
  }
});

test('the read me lists the folders the package has, not four fixed ones', async () => {
  // eleven of the thirteen projects do not ask for all four lockups, and every
  // one of their read mes named folders that are not in the package
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-readme-'));
  const r = await build(MW, dir);
  const txt = fs.readFileSync(path.join(dir, 'README.txt'), 'utf8');
  const listed = [...txt.matchAll(/^ {2}(\d\d-[a-z]+)/gm)].map((x) => x[1]);
  const onDisk = fs.readdirSync(dir).filter((f) => /^\d\d-/.test(f) && !/icons|social/.test(f));
  assert.deepStrictEqual(listed, ['04-wordmark']);
  assert.deepStrictEqual(listed.slice().sort(), onDisk.slice().sort());
  // and it says what a logotype is, rather than calling it a fallback for a
  // symbol the identity has not got
  assert.ok(/the logotype, which is the whole identity/.test(txt), txt.split('\n').slice(6, 12).join('\n'));
  fs.rmSync(dir, { recursive: true, force: true });

  // a project with all four still lists all four, in order
  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-readme2-'));
  const r2 = await build(project, dir2);
  const t2 = fs.readFileSync(path.join(dir2, 'README.txt'), 'utf8');
  assert.deepStrictEqual([...t2.matchAll(/^ {2}(\d\d-[a-z]+)/gm)].map((x) => x[1]),
    ['01-horizontal', '02-stacked', '03-mark', '04-wordmark']);
  assert.ok(/below the minimum size, where the mark stops reading/.test(t2));
  assert.ok(r.written.length && r2.written.length);
  fs.rmSync(dir2, { recursive: true, force: true });
});

test('an icon is square, and artwork that is not is told so', () => {
  // the icon check measured stroke weight and never asked whether the artwork
  // is the right shape for a square. Kvist and Spire fill under a tenth of
  // every icon in their packages and nothing said a word.
  const exp = require('../src/export');
  const wide = [[KV, kvM], [SP, spM], [MW, mwM]];
  for (const [proj, meas] of wide) {
    const f = exp.iconFloor(meas, proj.rules);
    assert.ok(f.aspect > 2 && !f.squarish, `${proj.brand}: aspect ${f.aspect}`);
    assert.ok(f.coverage < 15, `${proj.brand}: fills ${f.coverage}% of an icon`);
  }
  for (const [proj, meas] of [[project, m], [VE, veM], [HW, hwM]]) {
    const f = exp.iconFloor(meas, proj.rules);
    assert.ok(f.squarish && f.coverage > 40, `${proj.brand}: fills ${f.coverage}%`);
  }
  // the arithmetic: a square mark fills safeArea squared, and a long one loses
  // the ratio of its sides on top of that
  const f = exp.iconFloor(mwM, MW.rules);
  const want = exp.ICON_SAFE_AREA * exp.ICON_SAFE_AREA * (1 / f.aspect) * 100;
  assert.ok(Math.abs(f.coverage - want) < 0.2, `${f.coverage} against ${want.toFixed(1)}`);
});

test('a wide mark is told to draw a device, not to thicken its strokes', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-dev-'));
  const r = await build(MW, dir);
  const w = r.warnings.find((x) => /icon/.test(x) && /device for square places/.test(x));
  assert.ok(w, 'a logotype was told to draw heavier strokes');
  assert.ok(/3\.84 times longer than it is deep/.test(w), w);
  assert.ok(/fills 12\.1% of the square/.test(w), w);
  assert.ok(!/heavier strokes/.test(w), 'it still says to thicken a word');
  const bj = JSON.parse(fs.readFileSync(path.join(dir, 'brand.json'), 'utf8'));
  assert.strictEqual(bj.logo.icons.aspect, 3.84);
  assert.strictEqual(bj.logo.icons.fillsPercent, 12.1);
  fs.rmSync(dir, { recursive: true, force: true });

  // a square mark keeps the advice it always had, and gains no warning
  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-dev2-'));
  const r2 = await build(HW, dir2);
  const w2 = r2.warnings.find((x) => /app icons? (was|were) written/.test(x));
  assert.ok(w2 && /heavier strokes/.test(w2), w2);
  assert.ok(!r2.warnings.some((x) => /device for square places/.test(x)));
  fs.rmSync(dir2, { recursive: true, force: true });
});

test('a manual for a logotype does not keep talking about a mark', () => {
  const docs = require('../src/documents');
  assert.strictEqual(docs.context(MW, mwM, [], {}).noun, 'logotype');
  assert.strictEqual(docs.context(project, m, [], {}).noun, 'mark');
  const html = docs.guidelines(docs.context(MW, mwM, [], {}));
  assert.ok(/<h2>The logotype<\/h2>/.test(html));
  assert.ok(!/The primary mark/.test(html));
  assert.ok(/of the logotype's height/.test(html));
  // and one that has a mark is untouched
  const mer = docs.guidelines(docs.context(project, m, [], {}));
  assert.ok(/<h2>The mark<\/h2>/.test(mer) && /The primary mark/.test(mer));
  assert.ok(/of the mark's height/.test(mer));
});

test('both renderers draw the same diagram', () => {
  // the manual and the canvas each draw construction and clear space, and three
  // fixes made in the manual's copy were never made in the canvas's: the
  // artwork's origin, the clip to the artboard, and a clear space box drawn
  // square around artwork that is not. Pin the geometry of the two together so
  // the next fix cannot land in only one of them.
  const b = require('../src/documents/blocks');
  const docs = require('../src/documents');
  const ER2 = require('../src/editor/render');
  const num = (re, s2) => { const x = re.exec(s2); return x ? x.slice(1).map(Number) : null; };
  const all = [[project, m], [KV, kvM], [HW, hwM], [SP, spM], [VE, veM], [MW, mwM], [TH, measure(TH)]];
  for (const [proj, meas] of all) {
    const ctx = docs.context(proj, meas, [], {});
    const bu = bundleOf(proj, meas);
    const cwName = proj.rules.colourways[0].name;
    const doc1 = b.construction(ctx, { ink: '#000000', line: '#000000' });
    const can1 = ER2.construction(bu, cwName, '#000000');
    // both clip to the artboard
    assert.ok(/clip-path="url\(#/.test(doc1) && /clip-path="url\(#/.test(can1), `${proj.brand}: clip`);
    // and both subtract the artwork's own origin, or neither needs to
    const off = (h) => (/scale\([\d.]+\) translate\((-?[\d.]+) (-?[\d.]+)\)/.exec(h) || [0, 0, 0]).slice(1).map(Number);
    assert.deepStrictEqual(off(doc1), off(can1), `${proj.brand}: the two place the artwork differently`);
    const vb = meas.markViewBox;
    assert.deepStrictEqual(off(doc1).map(Number), [-vb.x || 0, -vb.y || 0], `${proj.brand}: origin`);

    // clear space: both draw a box the shape of the ink box grown by 2x
    const doc2 = b.clearSpace(ctx, { ink: '#000000', line: '#000000' });
    const can2 = ER2.clearSpace(bu, cwName, '#000000');
    const shapeOf = (h) => {
      const r = num(/<rect x="[-\d.]+" y="[-\d.]+" width="([\d.]+)" height="([\d.]+)"[^>]*dasharray/, h);
      return +(r[0] / r[1]).toFixed(3);
    };
    const want = +(((meas.markInk.w + meas.clearSpace * 2) / (meas.markInk.h + meas.clearSpace * 2))).toFixed(3);
    for (const [name, h] of [['manual', doc2], ['canvas', can2]]) {
      assert.ok(Math.abs(shapeOf(h) - want) < 0.01,
        `${proj.brand}: the ${name} draws clear space at ${shapeOf(h)} where the ink box wants ${want}`);
    }
  }
});

// Thirteen identities, and every one of them was a mark with a stub of text:
// the longest string in the whole content of twelve of the thirteen was 27
// characters. A real identity job is mostly writing, and the documents that
// carry that writing had never been given any.
const BW = projectLoader.load(path.join(__dirname, '..', 'projects', 'beaumont', 'project.json'));
const bwM = measure(BW);

test('the words a project writes are the length words are', () => {
  const c = BW.content;
  assert.ok(c.positioning.length > 300 && c.introduction.length > 250);
  for (const k of ['markRationale', 'colourRationale', 'typeRationale', 'constructionNotes']) {
    assert.ok(c[k].length > 250, `${k} is ${c[k].length} characters`);
  }
  for (const why of c.misuse) assert.ok(why.length > 100, why);
  assert.ok(BW.brand.length > 28, 'and the name is a long one');
});

test('a text block that cannot hold its words says so', () => {
  // the canvas had overflow:hidden, so it swallowed whatever did not fit; Typst
  // has no such rule, so the same block printed through the caption underneath
  // it. One document, two renderers, two different wrong answers, no report.
  const step = { size: 34, leading: 41 };
  const long = BW.content.positioning;
  const tight = EM.textFits(long, step, 700, 120);
  assert.ok(tight.over > 0 && tight.lines > 3, JSON.stringify(tight));
  assert.strictEqual(tight.has, 120);
  assert.strictEqual(tight.needs, tight.lines * 41);
  // room enough is not reported
  assert.strictEqual(EM.textFits(long, step, 700, tight.needs).over, 0);
  assert.strictEqual(EM.textFits('The mark', step, 700, 60).over, 0);

  // and it is found in a whole document, with the page and the words to find it
  const doc = EM.emptyDoc('x');
  doc.pages[0].blocks.push(EM.makeBlock('text', { x: 0, y: 0, w: 700, h: 120,
    props: { text: long, style: 'H1' } }));
  doc.pages[0].blocks.push(EM.makeBlock('text', { x: 0, y: 200, w: 700, h: 400,
    props: { text: long, style: 'Body' } }));
  const over = EM.overfullText(doc, BW.tokens.type);
  assert.strictEqual(over.length, 1, 'the block with room was reported too');
  assert.strictEqual(over[0].page, 1);
  assert.strictEqual(over[0].style, 'H1');
  assert.ok(over[0].text.startsWith('Beaumont & Whitcombe have sold'));
  assert.ok(over[0].over > 100);
});

test('the estimate never says a passage is shorter than it is', () => {
  // it is fitted against measurements taken from a real browser, under one
  // rule: over-count rather than under-count, because a check that misses an
  // overflow is worse than one that mentions a near miss.
  const step = { size: 16, leading: 27 };
  // a line of exactly one word cannot be fewer than one line
  assert.strictEqual(EM.textLines('', step, 300), 1);
  assert.strictEqual(EM.textLines('one', step, 300), 1);
  // a word longer than the measure takes one line and spills, as both renderers do
  assert.strictEqual(EM.textLines('supercalifragilistic', step, 20), 1);
  // more words never take fewer lines
  const words = BW.content.positioning.split(' ');
  let last = 0;
  for (let n = 1; n <= words.length; n += 7) {
    const got = EM.textLines(words.slice(0, n).join(' '), step, 320);
    assert.ok(got >= last, `${n} words took ${got} lines after ${last}`);
    last = got;
  }
  // a narrower measure never takes fewer lines than a wider one
  let prev = Infinity;
  for (const w of [200, 300, 420, 560, 700, 900]) {
    const got = EM.textLines(BW.content.positioning, step, w);
    assert.ok(got <= prev, `${w} wide took ${got} lines, wider than the last`);
    prev = got;
  }
});

test('neither renderer hides text that does not fit', () => {
  const bu = bundleOf(BW, bwM);
  const b = EM.makeBlock('text', { x: 0, y: 0, w: 700, h: 120,
    props: { text: BW.content.positioning, style: 'H1', align: 'left', colour: 'primary' } });
  const html = ER.block(b, bu);
  assert.ok(!/overflow:\s*hidden/.test(html), 'the canvas still swallows what does not fit');
  assert.ok(html.includes(ER.esc(BW.content.positioning).slice(0, 40)), 'the canvas lost the words');
  // and Typst holds the same words
  const typst = require('../src/typst');
  const src = typst.emit({ page: EM.PAGE, pages: [{ name: 'p', blocks: [b] }] }, bu, {}).source;
  assert.ok(src.includes('Beaumont & Whitcombe have sold'), 'the printed piece lost the words');
});

test('the cover the engine writes holds the words the project wrote', async () => {
  // the block was 700 by 120 at H1 whatever was put in it, so three lines of a
  // real positioning statement showed and the rest ran through the caption
  const { bundle, starterDoc } = require('../src/editor/bundle');
  for (const [proj, meas] of [[BW, bwM], [project, m], [KV, kvM], [MW, mwM]]) {
    const doc = starterDoc(bundle(proj, meas, []));
    assert.deepStrictEqual(EM.overfullText(doc, proj.tokens.type), [],
      `${proj.brand}: the cover the engine wrote does not hold its own words`);
    // the caption still sits below the statement, not on top of it
    const [lede, cap] = doc.pages[0].blocks.filter((b) => b.type === 'text');
    assert.ok(cap.y >= lede.y + lede.h, `${proj.brand}: the caption overlaps the statement`);
  }
  // a statement too long to be a headline is set in a step that can carry it
  const bwDoc = starterDoc(bundle(BW, bwM, []));
  assert.strictEqual(bwDoc.pages[0].blocks.filter((b) => b.type === 'text')[0].props.style, 'H2');
  const merDoc = starterDoc(bundle(project, m, []));
  assert.strictEqual(merDoc.pages[0].blocks.filter((b) => b.type === 'text')[0].props.style, 'H1');

  // the build says nothing about a cover that fits, and would say so if it did not
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-bw-'));
  const r = await build(BW, dir);
  assert.ok(!r.warnings.some((w) => /runs past the bottom/.test(w)), r.warnings.join('\n'));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a title slide holds its own title', () => {
  // h1 is 7cqw on a 15ch measure and a slide is 56.25cqw tall, so about three
  // lines of headline fit. Every fixture's positioning was one word until one
  // arrived with a sentence: 330 characters ran 657px past the bottom of the
  // slide and it opened in the middle of a word.
  const { deck } = require('../src/documents/deck');
  const docs = require('../src/documents');
  const HEAD_CH = 15, BUDGET = 44;
  const used = [];
  for (const [proj, meas] of [[BW, bwM], [project, m], [KV, kvM], [SP, spM], [MW, mwM]]) {
    const html = deck(docs.context(proj, meas, [], {}));
    const title = html.slice(html.indexOf('<section class="slide'), html.indexOf('<section', html.indexOf('<section class="slide') + 10));
    const h1 = /<h1[^>]*>([^<]*)<\/h1>/.exec(title);
    assert.ok(h1, `${proj.brand}: no headline`);
    const size = Number((/font-size:([\d.]+)cqw/.exec(title) || [0, 7])[1]);
    const plain = (t) => t.replace(/&amp;/g, '&').replace(/&#39;|&quot;/g, "'");
    const lines = EM.textLines(plain(h1[1]), { size: 1, leading: 1 }, HEAD_CH * EM.CHAR_EM);
    const lede = /<p class="lede"[^>]*>([^<]*)<\/p>/.exec(title);
    const ledeSize = lede ? Number((/class="lede" style="font-size:([\d.]+)cqw/.exec(title) || [0, 2.2])[1]) : 0;
    const ledeLines = lede ? EM.textLines(plain(lede[1]), { size: 1, leading: 1 }, 44 * EM.CHAR_EM) : 0;
    // how much of the slide the two ask for. The guarantee that it fits is the
    // browser measuring the built deck; what is checked here is that the
    // engine steps down as the words grow rather than setting everything at 7.
    const cqw = lines * size * 1.02 + (lede ? 2.2 + ledeLines * ledeSize * 1.5 : 0);
    assert.ok(cqw <= BUDGET + 0.5, `${proj.brand}: the title slide asks for ${cqw.toFixed(1)}cqw of ${BUDGET}`);
    used.push({ brand: proj.brand, cqw, size, lines, ledeSize });
  }
  const long = used.find((u) => u.brand === BW.brand), short = used.find((u) => u.brand === SP.brand);
  // every title fits the budget, and the one carrying a three line name and a
  // paragraph under it got there by stepping down rather than by luck
  assert.ok(long.ledeSize < 2.2, `the statement is still set at ${long.ledeSize}cqw`);
  assert.strictEqual(short.ledeSize, 0, 'a one word title grew a statement');
  assert.strictEqual(short.size, 7, 'a one word title was shrunk for no reason');
  assert.ok(long.cqw > short.cqw, 'the long title asks no more of the slide than the short one');
  // a statement that is a paragraph is not used as a headline
  const bwTitle = deck(docs.context(BW, bwM, [], {}));
  assert.ok(/<h1[^>]*>Beaumont &amp; Whitcombe Rare Books<\/h1>/.test(bwTitle),
    'the statement was used as the headline');
  assert.ok(/<p class="lede" style="font-size:[\d.]+cqw">Beaumont &amp; Whitcombe have sold/.test(bwTitle),
    'the statement is not set underneath at a size that fits');
  // and one that is a phrase still is
  const merTitle = deck(docs.context(project, m, [], {}));
  assert.ok(/<h1>Power from the predictable sea\.<\/h1>/.test(merTitle), 'the short one lost its headline');
});

test('a caption that is a sentence is not set as a label', () => {
  const b = require('../src/documents/blocks');
  const docs = require('../src/documents');
  const said = (proj, meas) => /<figcaption class="said">/.test(b.misuse(docs.context(proj, meas, [], {})));
  assert.ok(said(BW, bwM), 'sentences are still set in spaced uppercase monospace');
  assert.ok(said(project, m), 'Meridian writes sentences too, and always has');
  for (const [proj, meas] of [[KV, kvM], [SP, spM], [VE, veM]]) {
    assert.ok(!said(proj, meas), `${proj.brand}: three word labels lost their label style`);
  }
  // the style exists to be used
  const chrome = fs.readFileSync(path.join(__dirname, '..', 'src', 'documents', 'chrome.js'), 'utf8');
  assert.ok(/figcaption\.said\{[^}]*text-transform:none/.test(chrome));
});

test('the printed piece and the canvas pick the same colourway', () => {
  // typst had its own answer to a block asking for a colourway the project does
  // not cut — take the first variant of that lockup — while the canvas takes one
  // cut for the ground the block is going onto. So the same cover drew the mark
  // in paper on screen and in ink on an ink field in print.
  const typst = require('../src/typst');
  for (const [proj, meas] of [[BW, bwM], [project, m], [KV, kvM], [HAL, measure(HAL)], [MW, mwM]]) {
    const bu = bundleOf(proj, meas);
    const lockup = proj.rules.lockups[0];
    for (const on of ['primary', 'ground', 'accent']) {
      for (const want of ['ground', 'primary', 'accent']) {
        const canvas = ER.cwName(bu, want, on);
        const b = EM.makeBlock('lockup', { x: 0, y: 0, w: 400, h: 120,
          props: { lockup, colourway: want, on } });
        const src = typst.emit({ page: EM.PAGE, pages: [{ name: 'p', blocks: [b] }] }, bu, {}).source;
        const chosen = bu.variants[`${lockup}:${canvas}`];
        assert.ok(chosen, `${proj.brand}: no ${lockup} variant for ${canvas}`);
        // the ink the canvas would use appears in what typst wrote
        const inks = [...chosen.matchAll(/#[0-9A-Fa-f]{6}/g)].map((x) => x[0].toUpperCase());
        const cm = require('../src/cmyk');
        const table = cm.byName(cm.table(proj.tokens.colour));
        const asInk = (hex) => {
          const t = Object.values(table).find((c) => c.hex.toUpperCase() === hex);
          return t && t.declared ? `cmyk(${t.values.map((v) => v + '%').join(', ')})` : `rgb("${hex}")`;
        };
        for (const hex of new Set(inks)) {
          assert.ok(src.includes(asInk(hex)) || src.includes(hex),
            `${proj.brand} ${want} on ${on}: the canvas draws ${hex} and the printed piece does not`);
        }
      }
    }
  }
});

// Fourteen identities, and not one had ever set system.icons or system.motion:
// the two rule blocks whose overrides nothing had exercised. The rule blocks
// also reached the canvas and brand.json and neither of the two documents a
// client reads — Fathom's whole identity is its pattern and its manual never
// mentioned one.
const YW = projectLoader.load(path.join(__dirname, '..', 'projects', 'yarrow', 'project.json'));
const ywM = measure(YW);

test('a project sets all four systems, and none had set two of them', () => {
  assert.deepStrictEqual(Object.keys(YW.system).sort(), ['icons', 'motion', 'pattern', 'photography']);
  // and it overrides part of each, which is the shape a designer writes
  assert.deepStrictEqual(Object.keys(YW.system.motion), ['durations', 'loop']);
  assert.deepStrictEqual(Object.keys(YW.system.pattern), ['tile', 'densities']);
});

test('overriding part of a rule keeps the rest of it', () => {
  // Object.assign replaced whatever it was given, so system.motion with one
  // duration in it deleted the other three, and one density deleted the other
  // two — with them six of the nine tiles the package writes.
  const sys = require('../src/system');
  const full = sys.motionRules(undefined);
  const one = sys.motionRules({ durations: { base: 420 } });
  assert.deepStrictEqual(Object.keys(one.durations), Object.keys(full.durations));
  assert.strictEqual(one.durations.base, 420);
  assert.strictEqual(one.durations.slow, full.durations.slow);
  // an array is a whole answer, not a set of parts, so it replaces
  const e = sys.motionRules({ easing: { out: [0, 0, 1, 1] } });
  assert.deepStrictEqual(e.easing.out, [0, 0, 1, 1]);
  assert.deepStrictEqual(e.easing.through, full.easing.through);
  assert.strictEqual(sys.motionRules({ build: [{ part: 'x', from: 0, to: 1, ease: 'out', how: 'y' }] }).build.length, 1);
  // the pattern is the one where losing a key costs files
  const d = sys.patternRules({ densities: { medium: 1.2 } });
  assert.deepStrictEqual(Object.keys(d.densities).sort(), ['coarse', 'fine', 'medium']);
  assert.strictEqual(d.densities.medium, 1.2);
});

test('the pattern this project sets is cut at every density', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-yw-'));
  const r = await build(YW, dir);
  const tiles = r.written.map((f) => f.path).filter((f) => /^07-pattern\//.test(f));
  assert.strictEqual(tiles.length, 9, `${tiles.length} tiles, where three densities in three colourways is nine`);
  for (const d of ['fine', 'medium', 'coarse']) {
    assert.ok(tiles.some((f) => f.includes(`-${d}-`)), `nothing was cut at ${d}`);
  }
  const bj = JSON.parse(fs.readFileSync(path.join(dir, 'brand.json'), 'utf8'));
  assert.strictEqual(bj.system.pattern.tile, 120, 'the tile size it set was lost');
  assert.deepStrictEqual(Object.keys(bj.system.motion.durations).sort(),
    ['base', 'considered', 'quick', 'slow']);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a size the project states is the size it gets', () => {
  // three of the icon rules are ratios and three are the sizes those come out
  // at, and the sizes were computed after the merge — so a project writing
  // `stroke: 2`, which is the number a designer thinks in, had it accepted,
  // stored, and then overwritten by the derived one.
  const sys = require('../src/system');
  const plain = sys.iconRules(ywM, undefined);
  const set = sys.iconRules(ywM, { stroke: 2 });
  assert.notStrictEqual(plain.stroke, 2, 'the fixture must ask for a stroke it would not have got');
  assert.strictEqual(set.stroke, 2);
  assert.strictEqual(set.strokeRatio, Number((2 / set.box).toFixed(4)));
  // and the ratio still wins where the ratio is what was written
  assert.strictEqual(sys.iconRules(ywM, { strokeRatio: 0.1 }).stroke, Number((0.1 * 24).toFixed(2)));
  // the same for the other two pairs
  assert.strictEqual(sys.iconRules(ywM, { live: 20 }).live, 20);
  assert.strictEqual(sys.iconRules(ywM, { curveRadius: 6 }).curveRadius, 6);
  // what the built package says
  assert.strictEqual(require('../src/system').resolve(YW, ywM).icons.stroke, 2);
});

test('the manual says what the system is', () => {
  // the rule blocks were in brand.json and on the canvas and in neither
  // document. Fathom's identity is its pattern; its manual never mentioned one.
  const b = require('../src/documents/blocks');
  const docs = require('../src/documents');
  const ctx = docs.context(YW, ywM, [], {});
  const html = docs.guidelines(ctx);
  assert.ok(/<h2>The system<\/h2>/.test(html), 'no system chapter');
  for (const t of ['The pattern', 'Photography', 'The icon grid', 'Motion']) {
    assert.ok(html.includes(t), `${t} is not in the manual`);
  }
  // and the numbers in it are the resolved ones, not typed
  assert.ok(html.includes(`${ctx.system.icons.stroke} stroke`), 'the icon grid does not quote its stroke');
  assert.ok(html.includes(`${ctx.pattern.tiles.length} tiles`), 'the pattern section does not count its tiles');
  for (const [n, ms] of Object.entries(ctx.system.motion.durations)) {
    assert.ok(html.includes(`${ms} ms`), `${n} is missing from the motion section`);
  }

  // a project with a pattern and nothing else gets one section, not four
  const fa = docs.context(FA, measure(FA), [], {});
  assert.ok(b.patternSpec(fa) && !b.photographySpec(fa) && !b.motionSpec(fa));
  assert.ok(/<h2>The system<\/h2>/.test(docs.guidelines(fa)));
  assert.ok(docs.guidelines(fa).includes('The pattern'));
  assert.ok(!docs.guidelines(fa).includes('>Motion<'), 'a project that never mentioned motion got a motion section');

  // and the chapter after it is renumbered rather than colliding
  assert.ok(/<i>5\.1<\/i>What is in the package/.test(html), 'the assets chapter did not move');
  const cu = docs.context(CU, measure(CU), [], {});
  assert.ok(/<i>4\.1<\/i>The icon grid/.test(docs.guidelines(cu)));
});

test('the deck shows the system it counts among its files', () => {
  const { deck } = require('../src/documents/deck');
  const docs = require('../src/documents');
  const html = deck(docs.context(YW, ywM, [], {}));
  assert.ok(/chname">The system</.test(html), 'the deck has no system chapter');
  for (const t of ['9 tiles, one decision', 'Photography', 'Motion']) {
    assert.ok(html.includes(t), `${t} is not in the deck`);
  }
  // renumbered around it
  assert.ok(html.includes('04 · The system') && html.includes('05 · Assets'));
  // a project with no system at all keeps the four chapters it had
  const cu = deck(docs.context(CU, measure(CU), [], {}));
  assert.ok(!/chname">The system</.test(cu));
  assert.ok(cu.includes('04 · Assets'));
});

// Fifteen identities and not one of them had a photograph in it. Images could
// only reach the engine by somebody dropping one into the editor, so no package
// had ever contained the pictures the identity is built on, the manual's
// photography page had a grey ramp and nothing else, and the whole raster path
// — the treatment, the print file, the mockup — had never run from a project.
const SM = projectLoader.load(path.join(__dirname, '..', 'projects', 'saltmarsh', 'project.json'));
const smM = measure(SM);

test('a project can ship the photographs the identity is built on', () => {
  assert.strictEqual(SM.photography.length, 2);
  const [a, b] = SM.photography;
  assert.strictEqual(a.mime, 'image/png');
  assert.strictEqual(b.mime, 'image/jpeg');
  // the size is read from each file's own header, so a picture too small for
  // the page it is on can be said to be too small
  assert.ok(a.w === 1600 && a.h === 1000, `${a.w} by ${a.h}`);
  assert.ok(b.w === 1600 && b.h === 1000, `${b.w} by ${b.h}`);
  for (const ph of SM.photography) {
    assert.ok(/^data:image\/(png|jpeg);base64,/.test(ph.src));
    assert.ok(ph.caption, 'a photograph the project ships says what it is');
  }
  // and every other project has none, which is what it had before
  for (const p of [project, KV, YW, MW]) assert.deepStrictEqual(p.photography, []);
});

test('a file that is not a photograph is refused where a photograph goes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-ph-'));
  for (const f of ['mark.svg', 'wordmark.svg']) {
    fs.copyFileSync(path.join(__dirname, '..', 'projects', 'saltmarsh', f), path.join(dir, f));
  }
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'projects', 'saltmarsh', 'project.json'), 'utf8'));
  const write = (mut) => {
    const d = JSON.parse(JSON.stringify(raw)); mut(d);
    const f = path.join(dir, 'p.json'); fs.writeFileSync(f, JSON.stringify(d)); return f;
  };
  assert.throws(() => projectLoader.load(write((d) => { d.assets.photography = ['mark.svg']; })),
    (e) => /not a photograph/.test(e.message) && /assets\.mark/.test(e.message),
    'artwork was accepted as photography');
  assert.throws(() => projectLoader.load(write((d) => { d.assets.photography = ['nope.jpg']; })),
    (e) => /that file is not there/.test(e.message));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('the package contains the photographs, as given and as the rules treat them', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-sm-'));
  const r = await build(SM, dir);
  const shots = r.written.map((f) => f.path).filter((f) => /^08-photography\//.test(f));
  assert.deepStrictEqual(shots.slice().sort(), [
    '08-photography/light-on-water-treated.png',
    '08-photography/light-on-water.jpg',
    '08-photography/marsh-at-dusk-treated.png',
    '08-photography/marsh-at-dusk.png',
  ]);
  // the file as given is the file that was given, byte for byte
  const given = fs.readFileSync(path.join(dir, '08-photography', 'marsh-at-dusk.png'));
  assert.deepStrictEqual(given,
    fs.readFileSync(path.join(__dirname, '..', 'projects', 'saltmarsh', 'photography', 'marsh-at-dusk.png')));
  // and the treated one is a different picture, in the brand's own colours
  const treated = fs.readFileSync(path.join(dir, '08-photography', 'marsh-at-dusk-treated.png'));
  assert.notDeepStrictEqual(treated, given);
  assert.ok(treated.length > 1000);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a photograph is named for what it is, not for what its bytes happen to say', () => {
  // the printed piece named its image files by asking whether the whole data
  // URI contained "svg" — which searches the base64 as well as the header. Both
  // of the photographs here contain those three letters in their payload, so a
  // JPEG went out as image-....svg and Typst refused the file outright: the
  // printed piece did not compile at all.
  const IMG = require('../src/editor/images');
  const jpg = SM.photography.find((p) => p.mime === 'image/jpeg');
  assert.ok(jpg.src.split(',')[1].includes('svg'), 'this fixture must contain the trap');
  assert.strictEqual(IMG.extensionOf(jpg.src), 'jpg');
  assert.strictEqual(IMG.mimeOf(jpg.src), 'image/jpeg');
  assert.strictEqual(IMG.isVector(jpg.src), false);
  // and the kinds it does know
  assert.strictEqual(IMG.extensionOf('data:image/png;base64,AA'), 'png');
  assert.strictEqual(IMG.extensionOf('data:image/svg+xml;base64,AA'), 'svg');
  assert.strictEqual(IMG.isVector('data:image/svg+xml;base64,AA'), true);
  assert.strictEqual(IMG.extensionOf('not a uri'), 'bin');
  // vector is a property of the file rather than a claim the caller makes
  const store = IMG.store();
  const id = store.add('data:image/svg+xml;base64,AA');
  assert.strictEqual(store.get(id).vector, true);
});

test('the printed piece carries the photograph, and the treatment with it', () => {
  // the photograph went to press exactly as it was dropped in: no duotone, no
  // scrim, while the page it publishes had both. The treatment is baked into
  // the pixels now, with the same treatPixel the browser check measures.
  const typst = require('../src/typst');
  const bu = bundleOf(SM, smM);
  const id = Object.keys(bu.images)[0];
  assert.ok(id, 'the bundle carries the photographs the project ships');
  const b = EM.makeBlock('slot', { x: 0, y: 0, w: 600, h: 340, props: { image: id, fit: 'cover', treatment: true } });
  const out = typst.emit({ page: EM.PAGE, pages: [{ name: 'p', blocks: [b] }] }, bu, {});
  const names = Object.keys(out.files);
  assert.strictEqual(names.length, 1);
  assert.ok(/-treated\.png$/.test(names[0]), `written as ${names[0]}`);
  assert.ok(out.source.includes(names[0]));
  assert.ok(out.rasterColour, 'a photograph on a page is raster colour and should say so');
  // a project with no treatment sends the file as it arrived, in its own format
  const plain = bundleOf(project, m);
  plain.images = { x: { src: SM.photography[1].src, w: 1600, h: 1000 } };
  const b2 = EM.makeBlock('slot', { x: 0, y: 0, w: 600, h: 340, props: { image: 'x', treatment: false } });
  const noTreat = typst.emit({ page: EM.PAGE, pages: [{ name: 'p', blocks: [b2] }] },
    Object.assign({}, plain, { system: { photography: { declared: false } } }), {});
  assert.deepStrictEqual(Object.keys(noTreat.files), ['image-x.jpg']);
});

test('the manual shows the photographs rather than describing them', () => {
  const b = require('../src/documents/blocks');
  const docs = require('../src/documents');
  const html = b.photographySpec(docs.context(SM, smM, [], {}));
  assert.ok(html, 'a project that ships photographs gets no photography page');
  for (const ph of SM.photography) {
    assert.ok(html.includes(ph.src.slice(0, 60)), `${ph.file} is not on the page`);
    assert.ok(html.includes(ph.caption), 'the caption the project wrote is not used');
  }
  // the treatment is a filter definition and a reference to it, not a filter
  // definition dropped into a style attribute
  assert.ok(/<filter id="phman"/.test(html));
  assert.ok(/filter:url\(#phman\)/.test(html));
  assert.ok(!/style="[^"]*<svg/.test(html), 'the filter markup was inlined into an attribute');
  // a project that declares a treatment and ships no photograph still shows the
  // ramp, which is what it had
  const mer = b.photographySpec(docs.context(project, m, [], {}));
  assert.ok(mer && !/<img/.test(mer));
});

test('the cover the engine writes uses a photograph where there is one', async () => {
  const { bundle, starterDoc } = require('../src/editor/bundle');
  const doc = starterDoc(bundle(SM, smM, []));
  const cover = doc.pages[0].blocks;
  assert.strictEqual(cover[0].type, 'slot', 'the cover is still a flat fill');
  assert.ok(cover[0].props.image, 'the slot has no photograph in it');
  assert.strictEqual(cover[1].props.on, 'none', 'the mark sits on its own rectangle over the photograph');
  // and a project with no photograph keeps the fill it had
  const mer = starterDoc(bundle(project, m, []));
  assert.strictEqual(mer.pages[0].blocks[0].type, 'fill');
  assert.strictEqual(mer.pages[0].blocks[1].props.on, 'primary');

  // the document that is written carries the picture, or it opens with an empty
  // slot on somebody else's machine
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-cov-'));
  await build(SM, dir);
  const saved = JSON.parse(fs.readFileSync(path.join(dir, 'document.json'), 'utf8'));
  assert.strictEqual(Object.keys(saved.images || {}).length, 1);
  assert.ok(saved.images[cover[0].props.image], 'the document carries a different picture than it uses');
  fs.rmSync(dir, { recursive: true, force: true });
});

// ---- the site the repository deploys ----

test('every identity in the repo is named in the README, and named once', () => {
  // The site's front page takes both the list of identities and the line under
  // each name out of engine/README.md, and takes its order from there too. That
  // only holds while the README knows about every project directory. A round
  // that adds a fixture and forgets the line would put a card on the deployed
  // page reading "no line for this one", which is the kind of absence that has
  // no symptom until somebody looks.
  const md = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');
  const named = [...md.matchAll(/^[ \t]*projects\/([a-z0-9-]+)\/[ \t]+([^\n]+?)[ \t]*$/gm)].map((m) => m[1]);
  const dir = path.join(__dirname, '..', 'projects');
  const onDisk = fs.readdirSync(dir).filter((n) => fs.existsSync(path.join(dir, n, 'project.json'))).sort();

  const missing = onDisk.filter((n) => !named.includes(n));
  assert.deepStrictEqual(missing, [], `not named in engine/README.md: ${missing.join(', ')}`);
  const ghosts = named.filter((n) => !onDisk.includes(n));
  assert.deepStrictEqual(ghosts, [], `named in engine/README.md but not in projects/: ${ghosts.join(', ')}`);
  const dupes = named.filter((n, i) => named.indexOf(n) !== i);
  assert.deepStrictEqual(dupes, [], `named twice, so the order is ambiguous: ${dupes.join(', ')}`);
});

// ---- the app: the engine with a front door ----

const APP = require('../src/app/handlers');
const markSrc = () => fs.readFileSync(path.join(__dirname, '..', 'projects', 'meridian', 'mark.svg'), 'utf8');
const wordSrc = () => fs.readFileSync(path.join(__dirname, '..', 'projects', 'meridian', 'wordmark.svg'), 'utf8');

test('a package can be built from artwork nobody wrote a project file for', async () => {
  // The whole engine was reachable only by hand-writing a project file. This is
  // the same path — stage a real project, load it, build it — so what the app
  // makes is what the command line makes, and there is no second loader to
  // disagree with the first.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-appt-'));
  const r = await APP.make({
    brand: 'Front Door', mark: markSrc(), wordmark: wordSrc(),
    colours: [{ name: 'ink', hex: '#0A2A33', role: 'primary' }, { name: 'paper', hex: '#FFFFFF', role: 'ground' }],
    lockups: ['horizontal', 'stacked', 'mark', 'wordmark'], slots: ['ink'],
  }, dir);
  assert.ok(r.files > 20, `only ${r.files} files came out`);
  assert.deepStrictEqual(r.documents, ['guidelines.html', 'deck.html', 'published.html', 'editor.html']);
  for (const f of r.documents) assert.ok(fs.existsSync(path.join(dir, f)), `${f} was promised and not written`);
  assert.ok(fs.existsSync(path.join(dir, r.zip)), 'the zip was promised and not written');
  // the numbers it reports are the ones the engine measured, not a second guess
  const brand = JSON.parse(fs.readFileSync(path.join(dir, 'brand.json'), 'utf8'));
  assert.strictEqual(r.measured.clearSpace, brand.logo.clearSpaceUnits);
  assert.strictEqual(r.measured.floorPx, `${brand.logo.minSize.screenPx} px`);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a lone logotype is built as a logotype, not as a mark called one', async () => {
  // Collapsing a wordmark into assets.mark because that field was always set
  // put a logotype in 03-mark and had the manual call it the mark — the exact
  // confusion the thirteenth round existed to remove, reintroduced by the app.
  const wm = wordSrc();
  const seen = APP.inspect({ brand: 'Logotype', wordmark: wm });
  assert.strictEqual(seen.master, 'wordmark');
  assert.deepStrictEqual(seen.lockups, ['wordmark'], 'a lockup was offered that cannot be built');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-appt-'));
  await APP.make({ brand: 'Logotype', wordmark: wm,
    colours: [{ name: 'ink', hex: '#222222', role: 'primary' }, { name: 'paper', hex: '#FFFFFF', role: 'ground' }],
    lockups: ['wordmark'] }, dir);
  // 05-icons comes too, now that the sizes have a default: a logotype identity
  // still needs a favicon, and it is cut from the logotype for want of anything
  // else. What it must NOT do is call the logotype a mark.
  const folders = fs.readdirSync(dir).filter((f) => /^\d\d-/.test(f));
  assert.deepStrictEqual(folders, ['04-wordmark', '05-icons'], `it wrote ${folders.join(', ')}`);
  fs.rmSync(dir, { recursive: true, force: true });

  // and a symbol on its own is still a symbol
  assert.strictEqual(APP.inspect({ brand: 'Symbol', mark: markSrc() }).master, 'mark');
});

test('the app refuses what is not artwork, in the language everything else uses', () => {
  const refused = (input) => {
    try { APP.inspect(input); return null; }
    catch (e) { return e.finding || null; }
  };
  const cases = [
    ['a raster file', { mark: '\x89PNG\r\n\x1a\n and then some bytes' }],
    ['nothing at all', { }],
    ['an empty string', { mark: '   ' }],
  ];
  for (const [name, input] of cases) {
    const f = refused(input);
    assert.ok(f, `${name} was accepted`);
    assert.strictEqual(f.level, 'blocker');
    // what, why and how — a refusal that only says what is a refusal that helps nobody
    for (const k of ['what', 'why', 'how']) assert.ok(f[k] && f[k].length > 10, `${name} has no ${k}`);
    assert.ok(!/undefined|\[object|the the /.test(f.what + f.how), `${name} reads badly: ${f.how}`);
  }
  // artwork the normaliser refuses comes back as its own findings, not as a crash
  const live = APP.inspect({ mark: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60">'
    + '<text x="10" y="40" font-size="30">Acme</text></svg>' });
  assert.strictEqual(live.ok, false);
  assert.ok(live.findings.some((f) => /outline|text/i.test(f.what + f.how)), 'it did not mention the live text');
});

test('the palette starts from the colours already in the artwork', () => {
  const found = APP.paletteFrom('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">'
    + '<rect width="4" height="4" fill="#0A2A33"/><rect width="4" height="4" fill="#0A2A33"/>'
    + '<circle r="2" style="fill:rgb(30,122,140)"/><path d="M0 0h1" stroke="#F2A007" fill="none"/>'
    + '<rect width="1" height="1" fill="none"/></svg>');
  // commonest first, written however the tool wrote it, and "none" is not a colour
  assert.deepStrictEqual(found, ['#0A2A33', '#1E7A8C', '#F2A007']);
  assert.deepStrictEqual(APP.paletteFrom('not svg at all'), []);
});

test('four numbers from a printer reach the package, and anything else does not', () => {
  const of = (cmyk) => APP.projectJson({ brand: 'x', mark: 'x', lockups: ['mark'],
    colours: [{ name: 'ink', hex: '#0A2A33', role: 'primary', cmyk }] }).tokens.colour.ink.cmyk;
  assert.deepStrictEqual(of([88, 58, 45, 72]), [88, 58, 45, 72]);
  assert.deepStrictEqual(of(['88', '58', '45', '72']), [88, 58, 45, 72], 'numbers typed into a form arrive as strings');
  // a guess is worse than nothing here: the whole print path exists to stop one
  for (const bad of [undefined, null, [1, 2, 3], [1, 2, 3, 4, 5], [0, 0, 0, 101], ['a', 0, 0, 0], 'blue']) {
    assert.strictEqual(of(bad), undefined, `${JSON.stringify(bad)} was carried through as an ink build`);
  }
});

// ---- the same app, hosted ----
// A serverless function has no filesystem it can share with the next request,
// so the hosted build cannot serve a package file by file the way the local
// server does. It sends the zip instead and the browser opens the documents out
// of it. These check the contract that difference rests on.

const fn = (name) => require(path.join(__dirname, '..', '..', 'api', `${name}.js`));
function callFn(name, body) {
  const req = { method: 'POST', body };
  let code = 0, sent = null;
  const res = { setHeader() {}, status(c) { code = c; return res; }, json(o) { sent = o; return res; } };
  return Promise.resolve(fn(name)(req, res)).then(() => ({ code, body: sent }));
}

test('the hosted functions answer with what the local handlers answer', async () => {
  const mark = markSrc();
  const seen = await callFn('inspect', { brand: 'Hosted', mark });
  assert.strictEqual(seen.code, 200);
  assert.deepStrictEqual(seen.body.measured, APP.inspect({ brand: 'Hosted', mark }).measured);

  // and a refusal is a refusal there too, in the same shape
  const no = await callFn('inspect', { mark: 'this is not an svg' });
  assert.strictEqual(no.code, 400);
  assert.strictEqual(no.body.ok, false);
  for (const k of ['what', 'why', 'how']) assert.ok(no.body.findings[0][k], `a hosted refusal has no ${k}`);

  const wrong = await new Promise((resolve) => {
    let code = 0, sent = null;
    const res = { setHeader() {}, status(c) { code = c; return res; }, json(o) { sent = o; resolve({ code, body: sent }); return res; } };
    fn('inspect')({ method: 'GET' }, res);
  });
  assert.strictEqual(wrong.code, 405);
});

test('the hosted build sends the package back whole', async () => {
  const r = await callFn('build', {
    brand: 'Hosted', mark: markSrc(),
    colours: [{ name: 'ink', hex: '#0A2A33', role: 'primary' }, { name: 'paper', hex: '#FFFFFF', role: 'ground' }],
    lockups: ['mark'], slots: ['ink'],
  });
  assert.strictEqual(r.code, 200, JSON.stringify(r.body && r.body.findings));

  // The payload is not called `zip`: the handler already uses that name for the
  // file, Object.assign put the name over the bytes, and a 412 KB answer
  // arrived as 562 bytes with nothing in it to say so. Two different things
  // under one key is the defect, and this is the check that it is gone.
  assert.strictEqual(typeof r.body.zipBase64, 'string');
  assert.ok(r.body.zipBase64.length > 1000, 'the package came back as a name rather than as bytes');
  const bytes = Buffer.from(r.body.zipBase64, 'base64');
  assert.strictEqual(bytes.length, r.body.zipBytes, 'it reported a size it did not send');
  assert.strictEqual(bytes.slice(0, 2).toString('latin1'), 'PK', 'that is not a zip');
  assert.ok(/\.zip$/.test(r.body.zipName));

  // every document the answer promises has to be inside the zip, because that
  // is the only place the browser can get it from
  const central = bytes.toString('latin1');
  for (const f of r.body.documents) assert.ok(central.indexOf(f) > -1, `${f} was promised and is not in the zip`);

  // and a response has a ceiling, so the size that decides it is measured
  assert.ok(r.body.zipBytes < 4 * 1024 * 1024, `a plain identity came to ${r.body.zipBytes} bytes`);
});

test('every file the engine reads at run time is one the deploy is told to carry', () => {
  // A hosted deploy uploads what its tracer can see, and a tracer sees
  // `require`. The editor is assembled by reading nine files as text and
  // inlining them, and app.js is required by nothing — so it was traced by
  // nothing, was not uploaded, and the first hosted build died on
  // ENOENT /var/task/engine/src/editor/app.js. The other eight survived only
  // because each happens to be required somewhere else, which is luck rather
  // than a rule.
  const emit = fs.readFileSync(path.join(__dirname, '..', 'src', 'editor', 'emit.js'), 'utf8');
  const reads = [...emit.matchAll(/\bread\('([^']+)'\)/g)].map((m) => m[1]);
  assert.ok(reads.length >= 9, `only ${reads.length} inlined files found — has emit.js changed shape?`);

  const src = path.join(__dirname, '..', 'src');
  for (const rel of reads) {
    const file = path.join(src, 'editor', rel);
    assert.ok(fs.existsSync(file), `emit.js reads ${rel} and it is not there`);
    // and it has to sit under what vercel.json includes, or the deploy loses it
    assert.ok(!path.relative(src, file).startsWith('..'),
      `${rel} is outside engine/src, which is the directory the deploy is told to carry`);
  }

  const vercel = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'vercel.json'), 'utf8'));
  const carried = ((vercel.functions || {})['api/*.js'] || {}).includeFiles;
  assert.strictEqual(carried, 'engine/src/**',
    'vercel.json no longer carries engine/src, so the files above would not reach a function');
});

// ---- the typeface the identity is set in ----

const WB = projectLoader.load(path.join(__dirname, '..', 'projects', 'winterbourne', 'project.json'));
const wbM = measure(WB);

test('a typeface the project ships reaches every document', async () => {
  // Sixteen rounds of fixtures and every family was google: true, so the only
  // path that had ever run was a link to a font somebody else hosts. A brand on
  // a licensed face reached no document at all: the family was named in the CSS,
  // no @font-face was ever written, and every page fell through to its fallback
  // while the manual's specimen carried the licensed name above type set in
  // Georgia. A specimen showing the wrong face is worse than no specimen.
  assert.ok(WB.fonts.length >= 2, 'the fixture stopped shipping its typeface');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-type-'));
  await build(WB, dir);
  for (const f of ['guidelines.html', 'deck.html', 'published.html', 'editor.html']) {
    const html = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.ok(/@font-face/.test(html), `${f} names the typeface and never loads it`);
    assert.ok(html.indexOf('Liberation Serif') > -1, `${f} does not mention the display face`);
    // the bytes, not a link to somebody else's server
    assert.ok(/src:url\(data:font\//.test(html), `${f} has an @font-face with nothing in it`);
  }
  // and the files themselves travel, with the terms that govern them
  assert.ok(fs.existsSync(path.join(dir, '09-type', 'LICENCE.txt')), 'the fonts shipped with no licence');
  const lic = fs.readFileSync(path.join(dir, '09-type', 'LICENCE.txt'), 'utf8');
  assert.ok(lic.indexOf('Open Font Licence') > -1, 'the licence text did not travel');
  assert.strictEqual(fs.readdirSync(path.join(dir, '09-type')).filter((n) => /\.(ttf|otf|woff2?)$/.test(n)).length, 3);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a typeface named and unreachable is said so, not silently replaced', async () => {
  const TF = require('../src/typeface');
  // neither hosted nor shipped: the commonest way to write a licensed face
  const named = { families: { display: { family: 'Founders Grotesk', fallback: 'Helvetica,sans-serif' } } };
  assert.deepStrictEqual(TF.unreachable(named, []).map((u) => u.family), ['Founders Grotesk']);
  assert.deepStrictEqual(TF.unreachable({ families: { d: { family: 'Archivo', google: true } } }, []), []);
  assert.deepStrictEqual(TF.unreachable(named, [{ role: 'display', family: 'Founders Grotesk', files: [] }]), []);

  // and the build says it out loud, naming what the reader will get instead
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-unreach-'));
  const thin = Object.assign({}, WB, { fonts: [] });
  const r = await build(thin, dir);
  const said = r.warnings.filter((w) => /typeface/.test(w));
  assert.strictEqual(said.length, 2, `expected both families flagged, got ${said.length}`);
  assert.ok(/Georgia/.test(said.join(' ')), 'it did not say what the reader would actually see');
  assert.ok(/specimen/.test(said.join(' ')), 'it did not mention the page that is meant to prove the face');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a type scale written the way a designer would write it is refused, not crashed', () => {
  // `{ base: 16, ratio: 1.25 }` is how anybody would describe a type scale cold.
  // It reached the document layer and came back as
  // "(t.scale || []).map is not a function". A crash is not a refusal.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-scale-'));
  fs.copyFileSync(path.join(__dirname, '..', 'projects', 'winterbourne', 'mark.svg'), path.join(dir, 'mark.svg'));
  const write = (type) => {
    fs.writeFileSync(path.join(dir, 'project.json'), JSON.stringify({ brand: 'S',
      assets: { mark: 'mark.svg' }, tokens: { type },
      rules: { lockups: ['mark'], colourways: [{ name: 'a', on: 'g', slots: { ink: '#000' } }] } }));
    try { projectLoader.load(path.join(dir, 'project.json')); return null; } catch (e) { return e.message; }
  };
  const bad = [
    [{ scale: { base: 16, ratio: 1.25 } }, /scale is not a list/],
    [{ families: { display: { google: true } } }, /has no "family" name/],
    [{ scale: [{ name: 'H1', size: 0 }] }, /not a size/],
    [{ families: { text: { family: 'X' } }, scale: [{ name: 'H1', size: 20, family: 'display' }] }, /families has text/],
  ];
  for (const [type, want] of bad) {
    const msg = write(type);
    assert.ok(msg, `${JSON.stringify(type)} was accepted`);
    assert.ok(want.test(msg), `wrong refusal for ${JSON.stringify(type)}: ${msg}`);
    assert.ok(!/is not a function|undefined/.test(msg), `that is a crash, not a refusal: ${msg}`);
  }
  // and the shape every fixture uses still loads
  assert.strictEqual(write({ families: { display: { family: 'X', google: true } },
    scale: [{ name: 'H1', family: 'display', size: 38, leading: 42 }] }), null);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a document does not fetch a typeface the identity never chose', async () => {
  // Every deck asked Google for Spline Sans Mono and the manual for Schibsted
  // Grotesk, because the documents' own furniture named them. For an identity
  // whose face is licensed, that was the only webfont the deck loaded: a font
  // from nobody's identity, while the identity's own was absent.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-stray-'));
  await build(WB, dir);
  for (const f of ['guidelines.html', 'deck.html', 'published.html', 'editor.html']) {
    const html = fs.readFileSync(path.join(dir, f), 'utf8');
    const links = html.match(/fonts\.googleapis\.com[^"']*/g) || [];
    assert.deepStrictEqual(links, [], `${f} still fetches ${links.join(', ')}`);
  }
  fs.rmSync(dir, { recursive: true, force: true });

  // a project that does use google fonts still gets its link
  const g = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-goog-'));
  await build(project, g);
  assert.ok(/fonts\.googleapis\.com/.test(fs.readFileSync(path.join(g, 'guidelines.html'), 'utf8')),
    'a google face stopped being fetched');
  fs.rmSync(g, { recursive: true, force: true });
});

// ---- icons: what gets written, and what it is cut from ----

const RV = projectLoader.load(path.join(__dirname, '..', 'projects', 'ravelston', 'project.json'));

test('a package writes icons without being asked to name the sizes', async () => {
  // Every "what gets written" rule has a default — formats, pngWidths, naming,
  // clearSpaceRatio — and these two did not. `rules.iconSizes || []` skipped
  // silently, so two of seventeen projects shipped no icons at all while
  // brand.json carried the whole icon specification and the manual kept its
  // chapter on the grid.
  assert.ok(Array.isArray(projectLoader.DEFAULTS.iconSizes) && projectLoader.DEFAULTS.iconSizes.length,
    'iconSizes has no default again');
  assert.ok(Array.isArray(projectLoader.DEFAULTS.faviconSizes) && projectLoader.DEFAULTS.faviconSizes.length,
    'faviconSizes has no default again');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-icons-'));
  await build(RV, dir);
  const written = fs.readdirSync(path.join(dir, '05-icons'));
  assert.ok(written.some((f) => /^icon-/.test(f)), 'no app icon');
  assert.ok(written.some((f) => /^favicon-/.test(f)), 'no favicon');
  assert.ok(written.indexOf('favicon.ico') > -1, 'no .ico');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a package does not document icons it does not contain', async () => {
  // The other half: turning the sizes off has to take the chapter with it, and
  // say so. A section describing what the reader has not been given is worse
  // than no section.
  const off = Object.assign({}, RV, { rules: Object.assign({}, RV.rules, { iconSizes: [], faviconSizes: [] }) });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-noicons-'));
  const r = await build(off, dir);
  assert.ok(!fs.existsSync(path.join(dir, '05-icons')), 'it wrote icons after all');
  const html = fs.readFileSync(path.join(dir, 'guidelines.html'), 'utf8');
  assert.ok(html.indexOf('The icon grid') < 0, 'the manual still specifies a grid for icons that are absent');
  assert.ok(r.warnings.some((w) => /no icons were written/.test(w)), 'it went quiet about it');
  fs.rmSync(dir, { recursive: true, force: true });

  // and with the sizes on, the chapter is back
  const on = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-icons2-'));
  await build(RV, on);
  assert.ok(fs.readFileSync(path.join(on, 'guidelines.html'), 'utf8').indexOf('The icon grid') > -1);
  fs.rmSync(on, { recursive: true, force: true });
});

test('the simplified icon the engine asks for is the one the icons are cut from', async () => {
  // Since the thirteenth round the engine has said "draw a simplified icon mark
  // — fewer parts, heavier strokes". assets.icon was loaded, normalised and
  // then ignored: the file the advice asked for was checked by `check --icon`
  // and used by nothing.
  assert.ok(RV.assets.icon, 'the fixture stopped shipping a simplified icon');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-iconart-'));
  await build(RV, dir);
  const written = fs.readFileSync(path.join(dir, '05-icons', 'icon-180.png'));
  const from = (src) => geo.renderPng(require('../src/export')
    .iconSquare(src, { size: 180, background: RV.rules.iconBg || '#000000',
      ink: RV.rules.iconInk || '#FFFFFF', radius: 0.22 }), 180);
  assert.ok(from(RV.assets.icon.source).equals(written), 'the icons are not cut from assets.icon');
  assert.ok(!from(RV.assets.mark.source).equals(written), 'the icons are still cut from the mark');

  // the crest on its own would be refused at that size; the simplified one is not
  const crestOnly = Object.assign({}, RV, { assets: { mark: RV.assets.mark, wordmark: RV.assets.wordmark } });
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-crest-'));
  const r = await build(crestOnly, bare);
  assert.ok(r.warnings.some((w) => /icon.*smudge|smudge/.test(w)),
    'a 46 path crest at 180 px went out with nothing said');
  assert.ok(r.warnings.some((w) => /assets\.icon/.test(w)),
    'the advice does not name the field that takes the answer');
  fs.rmSync(bare, { recursive: true, force: true });

  // and the package says which drawing they came from, in all three places
  assert.ok(fs.readFileSync(path.join(dir, 'README.txt'), 'utf8').indexOf('icon.svg') > -1, 'the read me does not say');
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(dir, 'brand.json'), 'utf8')).generated.iconsFrom, 'icon.svg');
  assert.ok(fs.readFileSync(path.join(dir, 'guidelines.html'), 'utf8').indexOf('The icons are not the mark') > -1,
    'the manual does not explain why the icons differ');
  fs.rmSync(dir, { recursive: true, force: true });
});

// ---- counting lines in a script that has no spaces ----

const YB = projectLoader.load(path.join(__dirname, '..', 'projects', 'yamabiko', 'project.json'));

test('the line counter never says a passage is shorter than it is', () => {
  // The rule the fourteenth round set, checked against every measurement taken
  // from a real browser rather than against itself. Over-counting costs a
  // designer a warning they did not need; under-counting is text printed over
  // whatever is below it, which is the failure this check exists to prevent.
  const m = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'line-measurements.json'), 'utf8'));
  assert.ok(m.rows.length >= 800, 'the measurements have gone missing');
  const M = require('../src/editor/model');
  const under = [];
  let exact = 0;
  for (const r of m.rows) {
    const said = M.textLines(r.text, { size: r.size }, r.width);
    if (said < r.lines) under.push({ ...r, said, text: r.text.slice(0, 40) });
    if (said === r.lines) exact++;
  }
  assert.deepStrictEqual(under, [], `${under.length} passages counted short, worst ${JSON.stringify(under[0])}`);
  // and it should still be worth having: a counter that answers "a hundred" to
  // everything never under-counts either
  assert.ok(exact / m.rows.length > 0.55, `only ${Math.round(100 * exact / m.rows.length)}% exactly right`);
});

test('a script without spaces is counted by the line, not by the paragraph', () => {
  const M = require('../src/editor/model');
  // `para.split(/\s+/)` gave back the whole paragraph as one unbreakable word,
  // so the counter answered "one line" to any amount of Japanese.
  const ja = YB.content.introduction;
  assert.ok(ja.length > 80 && !/\s/.test(ja), 'the fixture stopped being a spaceless paragraph');
  const step = { size: 17, leading: 30 };
  assert.ok(M.textLines(ja, step, 520) >= 3, 'a hundred characters still fit on one line');
  // it scales with the width, which "one line" never did
  const narrow = M.textLines(ja, step, 240), wide = M.textLines(ja, step, 640);
  assert.ok(narrow > wide, `${narrow} lines at 240px against ${wide} at 640px`);

  // a full-width character is an em, not the 0.55 fitted for latin
  assert.strictEqual(M.WIDE_EM, 1);
  assert.ok(M.isWide('山') && M.isWide('ぁ') && M.isWide('。') && M.isWide('Ａ'));
  assert.ok(!M.isWide('a') && !M.isWide('&') && !M.isWide(' '));

  // and a comma may not open a line, so it travels with the character before it
  assert.strictEqual(M.textLines('あ、'.repeat(10), { size: 20 }, 200),
    M.textLines('あ'.repeat(20), { size: 20 }, 200) + 0, 'kinsoku is not being applied');
});

test('mixed Japanese and latin is measured as both', () => {
  const M = require('../src/editor/model');
  // Japanese is written with latin in it — years, formats, product names — and
  // the two have different widths in the same line.
  const step = { size: 17 };
  const mixed = '母屋は1923年に建てられた蚕室です。RIAA特性で再生します。';
  const lines = M.textLines(mixed, step, 300);
  assert.ok(lines >= 2, `${lines} line for a passage that cannot fit one`);
  // the latin part is narrower than the same number of full-width characters
  assert.ok(M.textLines('RIAARIAA', step, 300) < M.textLines('母屋母屋母屋母屋', step, 300) + 1);
});

test("a character's width is measured off the face, not averaged", () => {
  const M = require('../src/editor/model');
  const step = { size: 20 };
  // 'W' is 1.09 em in these faces and 'i' is 0.33: an average cannot tell them
  // apart, and a line of one holds three times as many as a line of the other.
  const wides = M.textLines('W '.repeat(40), step, 400);
  const narrows = M.textLines('i '.repeat(40), step, 400);
  assert.ok(wides > narrows, `40 W took ${wides} lines and 40 i took ${narrows}`);
  // the fallback is still there for anything unmeasured
  assert.strictEqual(M.CHAR_EM, 0.55);
});

// ---- the pages the designer laid out ----

const LM = projectLoader.load(path.join(__dirname, '..', 'projects', 'lammas', 'project.json'));

test('a project can ship the pages the designer laid out', async () => {
  // The canvas exists so somebody can lay out the pieces an identity is
  // delivered as, and there was nowhere in a project to keep them: every
  // package's document.json was the cover the engine generates, so a designer's
  // own pages were not part of the source and did not survive a rebuild. The
  // fourth time this shape has appeared — the photographs, the typeface, the
  // icon, and now the layouts.
  assert.strictEqual(LM.documents.length, 3);
  assert.deepStrictEqual(LM.documents.map((d) => d.name), ['Poster', 'Programme', 'Ticket']);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-docs-'));
  const r = await build(LM, dir);
  for (const slug of ['poster', 'programme', 'ticket']) {
    for (const ext of ['html', 'json']) {
      assert.ok(fs.existsSync(path.join(dir, '10-documents', `${slug}.${ext}`)), `${slug}.${ext} is not in the package`);
    }
  }
  // the pieces are pages, not a promise of pages
  const poster = fs.readFileSync(path.join(dir, '10-documents', 'poster.html'), 'utf8');
  assert.ok(poster.indexOf('LAMMAS') > -1 && /hb-block/.test(poster));
  assert.ok(r.notes.some((n) => /10-documents/.test(n)), 'the package does not mention them');
  assert.ok(JSON.parse(fs.readFileSync(path.join(dir, 'brand.json'), 'utf8')).documents.length === 3);

  // and between them they use the five block types nothing had ever generated
  const used = new Set(LM.documents.flatMap((d) => d.doc.pages.flatMap((pg) => pg.blocks.map((b) => b.type))));
  for (const t of ['rule', 'surface', 'mark', 'typeSpecimen', 'assetIndex']) {
    assert.ok(used.has(t), `${t} is still generated by nothing`);
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a document a project ships is refused when it is not one', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-baddoc-'));
  fs.copyFileSync(path.join(__dirname, '..', 'projects', 'lammas', 'mark.svg'), path.join(dir, 'mark.svg'));
  const write = (doc, extra) => {
    if (doc !== null) fs.writeFileSync(path.join(dir, 'doc.json'), typeof doc === 'string' ? doc : JSON.stringify(doc));
    fs.writeFileSync(path.join(dir, 'project.json'), JSON.stringify({ brand: 'D',
      assets: Object.assign({ mark: 'mark.svg', documents: [{ file: 'doc.json' }] }, extra),
      rules: { lockups: ['mark'], colourways: [{ name: 'a', on: 'g', slots: { ink: '#000' } }] } }));
    try { projectLoader.load(path.join(dir, 'project.json')); return null; } catch (e) { return e.message; }
  };
  const cases = [
    ['{not json', /not readable JSON/],
    [{ version: 1 }, /has a "pages" list|not a document/],
    [{ pages: [{ id: 'p1' }] }, /no "blocks" list/],
    [{ pages: [{ id: 'p1', blocks: [{ type: 'sausage' }] }] }, /no such block/],
    [{ page: { size: 'billboard' }, pages: [{ id: 'p1', blocks: [] }] }, /not a size this knows/],
  ];
  for (const [doc, want] of cases) {
    const msg = write(doc);
    assert.ok(msg, `${JSON.stringify(doc).slice(0, 40)} was accepted`);
    assert.ok(want.test(msg), `wrong refusal: ${msg}`);
    assert.ok(!/is not a function|undefined|instance of Array/.test(msg), `that is a crash, not a refusal: ${msg}`);
  }
  // a document that is one loads
  assert.strictEqual(write({ page: { size: 'a5' }, pages: [{ id: 'p1', name: 'P', blocks: [] }] }), null);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a block keeps the size it was given when nothing says what page it is on', () => {
  const M = require('../src/editor/model');
  // `on || PAGE` clamped against the default slide, so a caller that did not
  // pass a page had its sizes quietly cut to 1280 x 720: a poster's full-bleed
  // fill came out 720 tall of 1920 and everything below it was set in the
  // ground colour on the ground.
  const free = M.makeBlock('fill', { x: 0, y: 0, w: 1080, h: 1920 });
  assert.strictEqual(free.h, 1920, 'a block was cut to a page it was never told about');
  assert.strictEqual(free.w, 1080);
  // told which page, it still clamps
  const told = M.makeBlock('fill', { x: 0, y: 0, w: 9999, h: 9999 }, { w: 1280, h: 720 });
  assert.deepStrictEqual([told.w, told.h], [1280, 720]);
  // and the poster in the repo is whole
  const poster = LM.documents.find((d) => d.name === 'Poster').doc;
  const fill = poster.pages[0].blocks.find((b) => b.type === 'fill');
  assert.strictEqual(fill.h, poster.page.h, 'the fixture stopped covering its page');
});

test('the editor does not print its own instructions on a published page', async () => {
  const M = require('../src/editor/model');
  const R = require('../src/editor/render');
  const P = require('../src/editor/publish');
  const { bundle } = require('../src/editor/bundle');
  const bu = bundle(LM, measure(LM), []);
  M.resetIds();
  const doc = M.emptyDoc('Lammas');
  doc.pages[0].blocks = [M.makeBlock('surface', { x: 0, y: 0, w: 560, h: 380 }),
    M.makeBlock('slot', { x: 0, y: 400, w: 420, h: 280 })];
  const html = P.publish(doc, bu, { title: 'Empty' });
  // a ticket that tells the person holding it to drop a photograph on it is the
  // editor leaking out of the door
  assert.ok(!/drop a photograph here/.test(html), 'the mockup published its own placeholder');
  assert.ok(!/drop an image here/.test(html), 'the image slot published its own placeholder');
  // and the canvas still offers both, because it is a place to work
  assert.ok(/drop a photograph here/.test(R.block(doc.pages[0].blocks[0], bu)));
  assert.ok(/drop an image here/.test(R.block(doc.pages[0].blocks[1], bu)));
});

test('a page that indexes the package indexes all of it', async () => {
  // The bundle was built from what had been written so far — everything except
  // the documents, the licence and the zip — so an asset index a designer laid
  // out reported 45 files in a package of 57 and did not name the folder its
  // own page was in.
  for (const project of [LM, projectLoader.load(PROJECT)]) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-index-'));
    await build(project, dir);
    const onDisk = [];
    (function walk(d, rel) {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const r = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) walk(path.join(d, e.name), r); else onDisk.push(r);
      }
    }(dir, ''));
    const html = fs.readFileSync(path.join(dir, 'editor.html'), 'utf8');
    const i = html.indexOf('window.HANDOVER_BUNDLE='), j = html.indexOf('window.HANDOVER_DOC=');
    const bu = JSON.parse(html.slice(i + 'window.HANDOVER_BUNDLE='.length, j).trim().replace(/;$/, ''));
    const listed = new Set(bu.files.map((f) => f.path));
    assert.deepStrictEqual(onDisk.filter((f) => !listed.has(f)), [],
      `${project.brand}: the package has files the index does not list`);
    assert.deepStrictEqual(bu.files.map((f) => f.path).filter((f) => onDisk.indexOf(f) < 0), [],
      `${project.brand}: the index lists files the package does not have`);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---- a name that is set rather than drawn ----

const SK = projectLoader.load(path.join(__dirname, '..', 'projects', 'skerry', 'project.json'));

test('a mark that stands alone can have a name that is set, not drawn', async () => {
  // Twenty identities, every one with a wordmark — a drawing of the name. The
  // mirror of the thirteenth round's logotype is at least as common: a symbol
  // that stands alone with the name simply set in the brand's face. For those
  // the lockup is not two files, it is a rule, and there was nowhere to put it.
  assert.ok(!fs.existsSync(path.join(__dirname, '..', 'projects', 'skerry', 'wordmark.svg')),
    'the fixture started shipping a drawn wordmark');
  assert.ok(SK.nameSetting && SK.nameSetting.declared);
  assert.ok(SK.assets.wordmark && SK.assets.wordmark.generated, 'no wordmark was drawn from the rule');

  // outlined, so the file needs no font to render — the whole reason a wordmark
  // is artwork, and it stays true when the engine is the one drawing it
  assert.ok(/<path/.test(SK.assets.wordmark.source));
  assert.ok(!/<text|font-family/.test(SK.assets.wordmark.source), 'it left live text in the artwork');
  assert.strictEqual(SK.nameSetting.drawn.text, 'SKERRY');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-set-'));
  await build(SK, dir);
  for (const f of ['01-horizontal', '02-stacked', '03-mark', '04-wordmark']) {
    assert.ok(fs.existsSync(path.join(dir, f)), `${f} was not written`);
  }
  // the manual says the rule, because for this kind of identity it is the rule
  const html = fs.readFileSync(path.join(dir, 'guidelines.html'), 'utf8');
  assert.ok(html.indexOf('The name is not drawn') > -1, 'the manual does not say the name is set');
  assert.ok(html.indexOf('58 per cent') > -1, 'the manual does not quote the size it is set at');
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(dir, 'brand.json'), 'utf8'))
    .system.nameSetting.heightRatio, 0.58);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('the name is stated once, not twice', () => {
  // rules.wordmarkHeightRatio and the rule's heightRatio are the same
  // measurement. Two ways to say one number is how the fifteenth round's defect
  // came back: a project states a size and silently gets the default.
  assert.strictEqual(SK.rules.wordmarkHeightRatio, SK.nameSetting.heightRatio);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-two-'));
  fs.copyFileSync(path.join(__dirname, '..', 'projects', 'skerry', 'mark.svg'), path.join(dir, 'mark.svg'));
  fs.mkdirSync(path.join(dir, 'fonts'));
  for (const f of fs.readdirSync(path.join(__dirname, '..', 'projects', 'skerry', 'fonts'))) {
    fs.copyFileSync(path.join(__dirname, '..', 'projects', 'skerry', 'fonts', f), path.join(dir, 'fonts', f));
  }
  const base = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'projects', 'skerry', 'project.json'), 'utf8'));
  const write = (mut) => {
    const p = JSON.parse(JSON.stringify(base));
    mut(p);
    fs.writeFileSync(path.join(dir, 'project.json'), JSON.stringify(p));
    try { return projectLoader.load(path.join(dir, 'project.json')) && null; } catch (e) { return e.message; }
  };
  // stated twice and differently: refused rather than picked
  const clash = write((p) => { p.rules.wordmarkHeightRatio = 0.34; });
  assert.ok(clash && /same measurement/.test(clash), `it picked one: ${clash}`);
  // stated twice and agreeing: fine
  assert.strictEqual(write((p) => { p.rules.wordmarkHeightRatio = 0.58; }), null);
  // and a drawing and a rule for the same name is refused too
  const both = write((p) => { p.assets.wordmark = 'mark.svg'; });
  assert.ok(both && /Pick one/.test(both), `it accepted two answers for the name: ${both}`);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a name cannot be set in a face the project does not ship', () => {
  const SN = require('../src/setname');
  const tokens = { type: { families: { display: { family: 'Founders Grotesk' }, text: { family: 'X' } } } };
  const rule = SN.resolve({ system: { nameSetting: { family: 'display' } }, brand: 'A', tokens });
  // named but never shipped: the engine will not guess at letterforms
  const no = SN.refuse({ tokens, fonts: [], brand: 'A' }, rule);
  assert.ok(no && /no font file was shipped/.test(no.what));
  for (const k of ['what', 'why', 'how']) assert.ok(no[k] && no[k].length > 10, `the refusal has no ${k}`);
  // a family that is not in the project at all
  const bad = SN.resolve({ system: { nameSetting: { family: 'sausage' } }, brand: 'A', tokens });
  assert.ok(/no such typeface/.test(SN.refuse({ tokens, fonts: [], brand: 'A' }, bad).what));
  // and the one that does ship is accepted
  assert.strictEqual(SN.refuse({ tokens: SK.tokens, fonts: SK.fonts, brand: 'Skerry' }, SK.nameSetting), null);
});

test('a symbol that is the whole identity is not described as a fallback', async () => {
  // The mirror of the thirteenth round: the mark was still "for anywhere the
  // name is already present", which is backwards when there is no name.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-sym-'));
  const only = Object.assign({}, projectLoader.load(PROJECT));
  only.assets = { mark: only.assets.mark };
  only.rules = Object.assign({}, only.rules, { lockups: ['mark'] });
  only.nameSetting = null;
  await build(only, dir);
  const readme = fs.readFileSync(path.join(dir, 'README.txt'), 'utf8');
  assert.ok(readme.indexOf('the whole of it') > -1, `the read me still calls it a fallback:\n${readme}`);
  assert.ok(readme.indexOf('anywhere the name is already present') < 0);
  fs.rmSync(dir, { recursive: true, force: true });

  // and a mark beside a name still reads the old way, because there it is true
  const two = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-two2-'));
  await build(projectLoader.load(PROJECT), two);
  assert.ok(fs.readFileSync(path.join(two, 'README.txt'), 'utf8')
    .indexOf('anywhere the name is already present') > -1);
  fs.rmSync(two, { recursive: true, force: true });
});


// ---------------------------------------------------------------------------
console.log('\nreading a stroke that is written where SVG writes it');
test('stroke and stroke-width on different elements are still one stroke', () => {
  // The colour on the group and the widths on the paths is how anybody draws a
  // mark in one colour and two weights. Both readings wanted the two attributes
  // on the same element, so both came back empty and the engine reported
  // "measured off the artwork" about a file that states its widths.
  const doc = svgu.parse('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">'
    + '<g stroke="#000" fill="none"><path stroke-width="9" d="M10 10H110"/>'
    + '<path stroke-width="4.5" d="M10 30H110"/></g></svg>');
  assert.deepStrictEqual(svgu.strokeWidths(doc), [4.5, 9]);
  assert.strictEqual(svgu.thinnestStroke(doc), 4.5);
});
test('a declared stroke-width of 0 means no stroke, not the default of 1', () => {
  // Ravelston switches the group's stroke off and turns it back on per path.
  // Reading only widths above zero fell through to SVG's default of 1, and
  // every filled shape under the group was then a 1 unit hairline: the floor
  // came out at 576 px on a mark whose finest real stroke is 4.
  const doc = svgu.parse('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">'
    + '<g fill="#000" stroke="#000" stroke-width="0"><path d="M10 10h100v100H10Z"/>'
    + '<path fill="none" stroke-width="6" d="M10 200H230"/></g></svg>');
  assert.deepStrictEqual(svgu.strokeWidths(doc), [6]);
});
test('the split-stroke fixtures now report a stroke instead of a stem', () => {
  for (const name of ['ravelston', 'yamabiko', 'tarnbrook']) {
    const pr = projectLoader.load(path.join(__dirname, '..', 'projects', name, 'project.json'));
    const min = measure(pr).minimumSize;
    assert.strictEqual(min.from, 'stroke', `${name} still measures its floor off the render`);
  }
});
test('the corrected floor is the one where the finest stroke clears the rule', () => {
  // Measured, not asserted: Ravelston's 4 unit circle at the floor it used to
  // publish paints under the 2.4 px this project sets as the thinnest a stroke
  // may go, and at the corrected floor it clears it.
  const decode = require('fast-png').decode;
  const one = (w) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 280" width="${w}" `
    + `height="${Math.round(w * 280 / 240)}"><path fill="none" stroke="#000" stroke-width="4" `
    + `d="M71 196a15 15 0 1 0 30 0 15 15 0 1 0-30 0Z"/></svg>`;
  const inkAt = (w) => {
    const png = decode(geo.renderPng(one(w), w));
    const ch = png.channels, y = Math.round((196 / 280) * png.height);
    const a = (x) => png.data[(y * w + x) * ch + (ch === 4 ? 3 : 0)] / 255;
    let x = 0; while (x < w && a(x) === 0) x++;
    let ink = 0; while (x < w && a(x) > 0) { ink += a(x); x++; }
    return ink;
  };
  assert.ok(inkAt(116) < 2.4, `the old floor painted ${inkAt(116).toFixed(2)} px, which was inside the rule`);
  assert.ok(inkAt(144) >= 2.4, `the new floor paints ${inkAt(144).toFixed(2)} px, which is under the rule`);
});

// ---------------------------------------------------------------------------
console.log('\nthe icon grid, when the mark has more than one weight');
test('icons take the weight the mark carries its shape in, not its finest detail', () => {
  const sys = require('../src/system');
  const tb = projectLoader.load(path.join(__dirname, '..', 'projects', 'tarnbrook', 'project.json'));
  const r = sys.resolve(tb, measure(tb)).icons;
  assert.deepStrictEqual(r.derivedFrom.markWeights, [4.5, 9]);
  assert.strictEqual(r.derivedFrom.markStroke, 9, 'the icon grid took the hairline');
  assert.strictEqual(r.stroke, 1.8);
});
test('a mark with one weight says nothing about the choice', () => {
  const sys = require('../src/system');
  assert.strictEqual(sys.resolve(project, m).icons.derivedFrom.markWeights, undefined);
});
test('the icon grid is derived from what icons are cut from', () => {
  // Ravelston ships a simplified drawing for its icons — 13 units on a 120 box.
  // The files and the floor came off it and the grid did not, so the manual
  // specified 0.6 on a 24 box for a set whose only drawing is at 2.6.
  const sys = require('../src/system');
  const rv = projectLoader.load(path.join(__dirname, '..', 'projects', 'ravelston', 'project.json'));
  const r = sys.resolve(rv, measure(rv)).icons;
  assert.strictEqual(r.derivedFrom.viewBox, 120, 'the grid still comes off the 240 master');
  assert.strictEqual(r.derivedFrom.markStroke, 13);
  assert.strictEqual(r.stroke, 2.6);
  // and an identity with no icon drawing still derives from its master
  assert.strictEqual(sys.resolve(project, m).icons.derivedFrom.viewBox, 120);
});
test('a project that states the icon stroke keeps it', () => {
  const sys = require('../src/system');
  const stated = Object.assign({}, project, { system: { icons: { stroke: 2 } } });
  assert.strictEqual(sys.resolve(stated, m).icons.stroke, 2);
});

// ---------------------------------------------------------------------------
console.log('\nreading the last version');
const PREV = require('../src/previous');
const TB = path.join(__dirname, '..', 'projects', 'tarnbrook', 'project.json');

test('versions sort so the engine can tell which package came first', () => {
  const v = (x) => PREV.parseVersion(x);
  assert.strictEqual(PREV.compareVersions(v('1.4.0'), v('2.0.0')), -1);
  assert.strictEqual(PREV.compareVersions(v('1.10.0'), v('1.9.0')), 1);
  assert.strictEqual(PREV.compareVersions(v('2.0.0'), v('2.0.0')), 0);
  assert.strictEqual(PREV.compareVersions(v('2.0.0-rc1'), v('2.0.0')), -1);
  assert.strictEqual(PREV.parseVersion('spring release'), null);
});

const refusal = (previous, over) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-prev-'));
  const raw = JSON.parse(fs.readFileSync(TB, 'utf8'));
  for (const f of ['mark.svg', 'wordmark.svg']) {
    fs.copyFileSync(path.join(path.dirname(TB), f), path.join(dir, f));
  }
  if (previous !== null) {
    fs.writeFileSync(path.join(dir, 'last.json'), typeof previous === 'string' ? previous : JSON.stringify(previous));
    raw.previous = 'last.json';
  }
  Object.assign(raw, over || {});
  fs.writeFileSync(path.join(dir, 'project.json'), JSON.stringify(raw));
  try { projectLoader.load(path.join(dir, 'project.json')); return null; }
  catch (e) { return e; }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
};
const wellFormed = (e) => {
  assert.ok(e, 'the engine accepted it');
  assert.ok(e.findings && e.findings.length === 1, 'a crash is not a refusal');
  for (const k of ['what', 'why', 'how']) {
    assert.ok(e.findings[0][k] && e.findings[0][k].length > 20, `the refusal has no ${k}`);
  }
  return e.findings[0];
};
const LAST = JSON.parse(fs.readFileSync(path.join(path.dirname(TB), 'previous', 'brand.json'), 'utf8'));

test('a previous that is not there is refused, not crashed through', () => {
  const raw = JSON.parse(fs.readFileSync(TB, 'utf8'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-prev0-'));
  for (const f of ['mark.svg', 'wordmark.svg']) fs.copyFileSync(path.join(path.dirname(TB), f), path.join(dir, f));
  raw.previous = 'previous/gone.json';
  fs.writeFileSync(path.join(dir, 'project.json'), JSON.stringify(raw));
  let err = null;
  try { projectLoader.load(path.join(dir, 'project.json')); } catch (e) { err = e; }
  fs.rmSync(dir, { recursive: true, force: true });
  assert.ok(err && /is not there/.test(err.message), 'a missing previous package built anyway');
});
test('a previous that is not JSON is refused in words', () => {
  assert.ok(/not readable as JSON/.test(wellFormed(refusal('{ not json')).what));
});
test('a JSON file that is not a brand.json is refused', () => {
  assert.ok(/not a brand\.json/.test(wellFormed(refusal({ hello: 'world' })).what));
});
test('the previous package for a different brand is refused', () => {
  const other = Object.assign({}, LAST, { brand: 'Meridian' });
  assert.ok(/is the package for Meridian/.test(wellFormed(refusal(other)).what));
});
test('two packages under one version number is refused', () => {
  // What a version number is for. Anybody holding a file cannot tell which of
  // the two builds it came out of, and both packages look correct.
  const same = Object.assign({}, LAST, { version: '2.0.0' });
  assert.ok(/both version 2\.0\.0/.test(wellFormed(refusal(same)).what));
});
test('a previous package later than this build is refused', () => {
  const later = Object.assign({}, LAST, { version: '3.1.0' });
  const f = wellFormed(refusal(later));
  assert.ok(/later than this project/.test(f.what), f.what);
  assert.ok(/reported backwards/.test(f.why));
});

console.log('\nwhat the comparison finds');
const tbProject = projectLoader.load(TB);
let tbOut, tbChanges, tbBrand;
before(async () => {
  tbOut = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-tb-'));
  await build(tbProject, tbOut);
  tbBrand = JSON.parse(fs.readFileSync(path.join(tbOut, 'brand.json'), 'utf8'));
  tbChanges = PREV.compare(tbProject.previous.data, tbBrand);
});
const found = (code) => tbChanges.filter((c) => c.code === code);

test('every change says what, why and how, like every other finding', () => {
  assert.ok(tbChanges.length >= 9, `only ${tbChanges.length} changes found`);
  for (const c of tbChanges) {
    for (const k of ['what', 'why', 'how']) assert.ok(c[k] && c[k].length > 20, `${c.code} has no ${k}`);
    assert.ok(['breaking', 'news'].indexOf(c.kind) > -1, `${c.code} has no kind`);
  }
});
test('a floor that has risen is the change that retires existing artwork', () => {
  const f = found('minSize')[0];
  assert.ok(f && f.kind === 'breaking');
  assert.ok(/32 px \/ 9 mm to 64 px \/ 18 mm/.test(f.what), f.what);
  assert.ok(/between 32 px and 64 px/.test(f.why), 'the band is stated backwards');
});
test('a colour that has moved names the value to search for', () => {
  const moved = found('colourMoved').map((c) => c.what).join(' ');
  assert.ok(/beck has moved from #5C8A80 to #4E7A72/.test(moved), moved);
  assert.ok(/gorse has moved from #D9A227 to #CE971F/.test(moved), moved);
});
test('a colour that is only added is not a warning', () => {
  const f = found('colourAdded')[0];
  assert.ok(f && f.kind === 'news' && /stone/.test(f.what));
});
test('a withdrawn lockup names the folder that is missing', () => {
  const f = found('lockupsWithdrawn')[0];
  assert.ok(f && /"stacked"/.test(f.what) && /02-stacked/.test(f.why), f && f.why);
});
test('a withdrawn colourway is reported even though the old files still work', () => {
  const f = found('colourwaysWithdrawn')[0];
  assert.ok(f && /"beck"/.test(f.what));
  assert.ok(/keep working and keep their names/.test(f.why));
});
test('a contrast pair that stops passing is a change, not just a number', () => {
  const f = found('contrast')[0];
  assert.ok(f && f.kind === 'breaking', 'a fallen verdict was not treated as breaking');
  assert.ok(/fell on gorse/.test(f.what) && /Pass AA/.test(f.what) && /Large text only/.test(f.what), f.what);
});
test('two identical packages under different versions report nothing but say so', () => {
  const same = PREV.compare(tbBrand, Object.assign({}, tbBrand, { version: '2.0.1' }));
  assert.strictEqual(same.length, 0);
  const flat = PREV.changesText(tbBrand, tbBrand, same).replace(/\s+/g, ' ');
  assert.ok(/nothing this file can measure is different/.test(flat), flat);
});
test('the package carries the list the client has to act on', () => {
  const txt = fs.readFileSync(path.join(tbOut, 'CHANGES.txt'), 'utf8');
  assert.ok(/what changed since 1\.4\.0/.test(txt), txt.slice(0, 200));
  assert.ok(/Retires something the client already has/.test(txt));
  assert.ok(/New in this version/.test(txt));
  // the file is wrapped to 76 columns, so every sentence is read flat
  const flat = txt.replace(/\s+/g, ' ');
  for (const c of tbChanges) {
    for (const k of ['what', 'why', 'how']) {
      assert.ok(flat.indexOf(c[k].replace(/\s+/g, ' ')) > -1, `${c.code}'s ${k} is not in CHANGES.txt`);
    }
  }
});
test('brand.json says which package it was compared against', () => {
  assert.strictEqual(tbBrand.changes.since, '1.4.0');
  assert.strictEqual(tbBrand.changes.entries.length, tbChanges.length);
});
test('brand.json counts the package it describes, all of it', () => {
  // It counted what had been written when it was written, which is everything
  // except the read me, the documents, the licence and the zip: Tarnbrook said
  // 34 files in a package of 43, and every package ever built was wrong the
  // same way. The one file whose job is to be read by software.
  const onDisk = (dir) => fs.readdirSync(dir, { recursive: true })
    .filter((f) => fs.statSync(path.join(dir, f)).isFile()).length;
  assert.strictEqual(tbBrand.generated.files, onDisk(tbOut));
  const first = JSON.parse(fs.readFileSync(path.join(out, 'brand.json'), 'utf8'));
  assert.strictEqual(first.generated.files, onDisk(out), 'a package with no previous miscounts too');
});
test('a file written twice is listed once', () => {
  // Skerry ships one face for two roles, so the same ttf was written twice and
  // counted twice, and every count taken off the list was one too many.
  const sk = projectLoader.load(path.join(__dirname, '..', 'projects', 'skerry', 'project.json'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-dupe-'));
  return build(sk, dir).then((r) => {
    const dupes = r.written.map((w) => w.path).filter((f, i, a) => a.indexOf(f) !== i);
    fs.rmSync(dir, { recursive: true, force: true });
    assert.deepStrictEqual(dupes, [], 'the same path is in the written list twice');
  });
});
test('the manual leads with what changed, and only where there is a previous', () => {
  const html = fs.readFileSync(path.join(tbOut, 'guidelines.html'), 'utf8');
  assert.ok(html.indexOf('What changed since 1.4.0') > -1, 'the manual has no changes chapter');
  const rows = (html.match(/class="chg breaking"/g) || []).length;
  assert.strictEqual(rows, tbChanges.filter((c) => c.kind === 'breaking').length);
  assert.ok(html.indexOf('What changed since') < html.indexOf('Minimum size'), 'it is not read first');
  const plain = fs.readFileSync(path.join(out, 'guidelines.html'), 'utf8');
  assert.ok(plain.indexOf('What changed since') < 0, 'a first version has a changes chapter');
});
test('the read me names what reads brand.json, in both cases', () => {
  assert.ok(/CHANGES\.txt is that list/.test(fs.readFileSync(path.join(tbOut, 'README.txt'), 'utf8')));
  assert.ok(/The next version of this identity is built against it/
    .test(fs.readFileSync(path.join(out, 'README.txt'), 'utf8')));
});


// ---------------------------------------------------------------------------
console.log('\nassets the loader does not know');
const KILN = path.join(__dirname, '..', 'projects', 'kilnsey', 'project.json');
const withAssets = (over) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-as-'));
  const raw = JSON.parse(fs.readFileSync(KILN, 'utf8'));
  for (const f of ['mark.svg', 'wordmark.svg']) fs.copyFileSync(path.join(path.dirname(KILN), f), path.join(dir, f));
  fs.mkdirSync(path.join(dir, 'partners'));
  for (const f of fs.readdirSync(path.join(path.dirname(KILN), 'partners'))) {
    fs.copyFileSync(path.join(path.dirname(KILN), 'partners', f), path.join(dir, 'partners', f));
  }
  raw.assets = Object.assign({}, raw.assets, over);
  fs.writeFileSync(path.join(dir, 'project.json'), JSON.stringify(raw));
  try { projectLoader.load(path.join(dir, 'project.json')); return null; }
  catch (e) { return e; }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
};
test('a list handed in where one file belongs is a sentence, not a type error', () => {
  // photography in the sixteenth round, documents in the twenty-second and
  // partners in the twenty-third all reached path.join as an array and produced
  // "the path argument must be of type string". The skip list grew by one every
  // time, one crash per kind, always after the fact.
  const e = withAssets({ mark: ['a.svg', 'b.svg'] });
  assert.ok(e && /assets\.mark is a list, and the symbol is one file/.test(e.message), e && e.message);
  assert.ok(!/must be of type string/.test(e.message), 'still a Node type error');
});
test('an asset kind nobody has thought of is refused by name', () => {
  const e = withAssets({ signage: ['x.svg'] });
  assert.ok(e && /assets\.signage is not something the engine knows how to load/.test(e.message), e && e.message);
});
test('a list kind handed in as one file is refused the other way round', () => {
  const e = withAssets({ partners: 'partners/ingleby.svg' });
  assert.ok(e && /assets\.partners is string, and the partners whose marks stand beside yours is a list/
    .test(e.message), e && e.message);
});

// ---------------------------------------------------------------------------
console.log('\na floor for every lockup, not just for the master');
test('a lockup does not hold at the floor measured off the master', () => {
  const V = require('../src/variants');
  const f = V.floors(project, m);
  assert.ok(f.horizontal.screenPx > m.minimumSize.screenPx * 2,
    `the horizontal lockup reports ${f.horizontal.screenPx} against the master's ${m.minimumSize.screenPx}`);
  assert.strictEqual(f.mark.screenPx, m.minimumSize.screenPx, 'the mark disagrees with itself');
});
test('the master figure puts a lockup well under the rule it states', () => {
  // Measured on the composed drawing, not asserted: at the one figure every
  // package has printed, Meridian's horizontal lockup lays down a fifth of the
  // ink its own rule requires.
  const V = require('../src/variants');
  const v = buildVariant({ markSrc: project.assets.mark.source, wordmarkSrc: project.assets.wordmark.source,
    lockup: 'horizontal', colourway: project.rules.colourways[0], rules: project.rules, measured: m });
  const box = svgu.viewBox(svgu.parse(v.svg));
  const thin = geo.minimumSize(v.svg, project.rules).thinnestStroke;
  const atMaster = thin * (m.minimumSize.screenPx / box.w);
  assert.ok(atMaster < project.rules.minStrokePx / 2,
    `it paints ${atMaster.toFixed(2)} px, and the rule is ${project.rules.minStrokePx}`);
  const atOwn = thin * (V.floors(project, m).horizontal.screenPx / box.w);
  assert.ok(atOwn >= project.rules.minStrokePx,
    `at its own floor it paints ${atOwn.toFixed(2)} px, still under ${project.rules.minStrokePx}`);
});

// ---------------------------------------------------------------------------
console.log('\nartwork that is not yours');
const PT = require('../src/partners');
const kiln = projectLoader.load(KILN);
const kilnM = measure(kiln);
let kilnOut, kilnBrand;
before(async () => {
  kilnOut = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-kiln-'));
  await build(kiln, kilnOut);
  kilnBrand = JSON.parse(fs.readFileSync(path.join(kilnOut, 'brand.json'), 'utf8'));
});
const partnerRefusal = (over) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-pt-'));
  const raw = JSON.parse(fs.readFileSync(KILN, 'utf8'));
  for (const f of ['mark.svg', 'wordmark.svg']) fs.copyFileSync(path.join(path.dirname(KILN), f), path.join(dir, f));
  fs.mkdirSync(path.join(dir, 'partners'));
  for (const f of fs.readdirSync(path.join(path.dirname(KILN), 'partners'))) {
    fs.copyFileSync(path.join(path.dirname(KILN), 'partners', f), path.join(dir, 'partners', f));
  }
  raw.assets.partners = [over];
  fs.writeFileSync(path.join(dir, 'project.json'), JSON.stringify(raw));
  try { projectLoader.load(path.join(dir, 'project.json')); return null; }
  catch (e) { return e; }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
};
const wellSaid = (e) => {
  assert.ok(e, 'the engine accepted it');
  assert.ok(e.findings && e.findings.length === 1, 'a crash is not a refusal');
  for (const k of ['what', 'why', 'how']) assert.ok(e.findings[0][k] && e.findings[0][k].length > 20, `no ${k}`);
  return e.findings[0];
};
test('a partner with no artwork is refused rather than drawn from a description', () => {
  const f = wellSaid(partnerRefusal({ name: 'Someone', files: {} }));
  assert.ok(/no artwork is given for them/.test(f.what), f.what);
  assert.ok(/will not draw somebody else's logo/.test(f.why));
});
test('a partner file that is not there is refused, and not substituted', () => {
  const f = wellSaid(partnerRefusal({ name: 'Someone', files: { crag: 'partners/nope.svg' } }));
  assert.ok(/that file is not there/.test(f.what), f.what);
  assert.ok(/will not substitute one of\s+their other versions/.test(f.why.replace(/\s+/g, ' ')) ||
    /not substitute one of their other versions/.test(f.why), f.why);
});
test('a version keyed to a colourway we do not cut is refused', () => {
  const f = wellSaid(partnerRefusal({ name: 'Someone', files: { navy: 'partners/ingleby.svg' } }));
  assert.ok(/does not cut one/.test(f.what), f.what);
});
test('a partner with no name is refused', () => {
  assert.ok(/has no name/.test(wellSaid(partnerRefusal({ files: { crag: 'partners/ingleby.svg' } })).what));
});
test('their mark is scaled off ours and keeps its own colour', () => {
  const prule = PT.rules(kiln);
  const partner = kiln.partners.find((p) => p.name === 'Ingleby Sailing Club');
  const host = buildVariant({ markSrc: kiln.assets.mark.source, wordmarkSrc: kiln.assets.wordmark.source,
    lockup: prule.with, colourway: kiln.rules.colourways[0], rules: kiln.rules, measured: kilnM });
  const c = PT.lockup({ hostSvg: host.svg, hostInk: host.box, partner, way: 'crag', rule: prule, ink: '#2B3A2E' });
  // matched on ink height, to within a rounding of the scale
  assert.ok(Math.abs(c.partnerBox.h - host.box.h) < 0.5, `${c.partnerBox.h} against ${host.box.h}`);
  // and their blue is still their blue
  assert.ok(c.svg.indexOf('#0B4F8A') > -1, 'their artwork was recoloured into our palette');
});
test('a data-slot in their file is not painted from our colourway', () => {
  // Barrowden's file marks its ink, which in our own artwork means "paint this
  // from the colourway". In theirs it means nothing we are entitled to act on.
  const prule = PT.rules(kiln);
  const partner = kiln.partners.find((p) => p.name === 'Barrowden Museum');
  assert.ok(partner.versions.crag.slots.length, 'the fixture no longer carries a slot to ignore');
  const host = buildVariant({ markSrc: kiln.assets.mark.source, wordmarkSrc: kiln.assets.wordmark.source,
    lockup: prule.with, colourway: kiln.rules.colourways[1], rules: kiln.rules, measured: kilnM });
  const c = PT.lockup({ hostSvg: host.svg, hostInk: host.box, partner, way: 'crag', rule: prule, ink: '#F4F2EC' });
  assert.ok(c.svg.indexOf('#1F3352') > -1, 'their navy was painted over with our reverse ink');
});
test('the floor of a pair is neither brand\'s own', () => {
  const V = require('../src/variants');
  const ours = V.floors(kiln, kilnM)[PT.rules(kiln).with].screenPx;
  const rows = kilnBrand.logo.partners.flatMap((p) => p.lockups.map((l) => [p.name, l]));
  const fine = rows.find(([n]) => n === 'Ravensworth Hospice')[1];
  assert.strictEqual(fine.minSize.setBy, 'their mark', 'a 2 unit line did not set the floor');
  assert.ok(fine.minSize.screenPx > ours * 2, `${fine.minSize.screenPx} against our ${ours}`);
  // and every pair states all three candidates, so the number can be checked
  for (const [, l] of rows) {
    assert.ok(l.minSize.parts.length >= 2, 'a pair reports one candidate for its floor');
    assert.strictEqual(l.minSize.screenPx, Math.max(...l.minSize.parts.map((x) => x.screenPx)));
  }
});
test('the dividing rule is not the thinnest thing in the pair', () => {
  // At 0.4 of the thinnest thing we draw, the divider was finer than both marks
  // and set the floor of every pair in the first identity to have any.
  for (const p of kilnBrand.logo.partners) {
    for (const l of p.lockups) assert.notStrictEqual(l.minSize.setBy, 'the rule between them');
  }
});
test('a pair that cannot be made is a fact about ownership, not a fault', () => {
  const ing = kilnBrand.logo.partners.find((p) => p.name === 'Ingleby Sailing Club');
  assert.deepStrictEqual(ing.missing, ['mono']);
  assert.strictEqual(ing.lockups.length, 2);
  const files = fs.readdirSync(path.join(kilnOut, '11-partners'));
  assert.ok(!files.some((f) => /mono/.test(f)), 'a mono pair was invented');
  assert.ok(files.some((f) => /ingleby-sailing-club-reverse\.svg$/.test(f)));
});
test('the package says a floor per folder and a floor per pair', () => {
  const readme = fs.readFileSync(path.join(kilnOut, 'README.txt'), 'utf8');
  for (const l of kiln.rules.lockups) assert.ok(readme.indexOf(naming.folderFor(l)) > -1);
  assert.ok(/A pair with a partner holds at neither brand's figure/.test(readme));
  for (const l of kiln.rules.lockups) {
    assert.ok(kilnBrand.logo.minSizes[l], `brand.json has no floor for ${l}`);
  }
  const html = fs.readFileSync(path.join(kilnOut, 'guidelines.html'), 'utf8');
  assert.ok(html.indexOf('Partner lockups') > -1);
  assert.ok(html.indexOf('What disappears first') > -1, 'the manual has no floor table');
  // an identity with no partners gets no partner section and no empty heading
  assert.ok(fs.readFileSync(path.join(out, 'guidelines.html'), 'utf8').indexOf('Partner lockups') < 0);
  assert.ok(fs.readFileSync(path.join(out, 'README.txt'), 'utf8').indexOf('neither brand') < 0);
});
test('a previous package written before lockup floors existed reports none', () => {
  // Tarnbrook's previous/brand.json came out of the twenty-second round and has
  // no minSizes in it. Reading a field that is not there must say nothing, not
  // claim every lockup moved.
  const P2 = require('../src/previous');
  const old = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'projects', 'tarnbrook',
    'previous', 'brand.json'), 'utf8'));
  const found = P2.compare(old, kilnBrand).filter((c) => c.code === 'lockupMinSize');
  assert.deepStrictEqual(found, []);
});


// ---------------------------------------------------------------------------
console.log('\nthe palette, to somebody who does not see it the way you do');
const VIS = require('../src/vision');
const DEBEN = path.join(__dirname, '..', 'projects', 'deben', 'project.json');

test('a dichromat sees white as white, grey as grey and black as black', () => {
  // The first version of this module projected in linear RGB using coefficients
  // that are defined on cone responses. It rendered Deben's near white paper as
  // cyan for a protanope, which is not a subtle error: a simulation that moves
  // the achromatic axis is wrong everywhere, not only on the greys.
  for (const grey of ['#FFFFFF', '#CCCCCC', '#808080', '#333333', '#000000']) {
    for (const kind of Object.keys(VIS.KINDS)) {
      const seen = VIS.simulate(grey, kind);
      assert.ok(VIS.distance(grey, seen) < 0.5, `${grey} moved to ${seen} for a ${kind}`);
    }
  }
});
test('a hue that is present is not invented or destroyed', () => {
  // sanity in the other direction: a deuteranope still separates blue from
  // yellow, which is the axis they have
  assert.ok(VIS.apart('#1F4E5F', '#E0A02A').seen.deuteranopia.distance > 40);
  // and loses the one they do not
  assert.ok(VIS.apart('#557B2E', '#A8442F').seen.deuteranopia.distance < 5);
});
test('a pair that was always the same colour is not a finding', () => {
  const near = { a: { hex: '#F6F4EF' }, b: { hex: '#F7F5F2' } };
  assert.deepStrictEqual(VIS.collapses(near, 12), []);
});
test('the palettes in this repo are asked the question', () => {
  // twelve of the twenty-four carry a pair that separates for most readers and
  // not for all, and every one of those pairs passes its contrast checks
  let carrying = 0;
  for (const name of fs.readdirSync(path.join(__dirname, '..', 'projects'))) {
    const pr = projectLoader.load(path.join(__dirname, '..', 'projects', name, 'project.json'));
    if (VIS.collapses(pr.tokens.colour, 12).length) carrying++;
  }
  assert.ok(carrying >= 8, `only ${carrying} palettes carry a collapsing pair; the check may have stopped working`);
});

console.log('\na set is a promise that these can be told apart');
const debenRaw = () => JSON.parse(fs.readFileSync(DEBEN, 'utf8'));
const buildDeben = async (mut) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-cv-'));
  const raw = debenRaw();
  mut(raw);
  for (const f of ['mark.svg', 'wordmark.svg']) {
    fs.copyFileSync(path.join(path.dirname(DEBEN), f), path.join(dir, f));
  }
  fs.writeFileSync(path.join(dir, 'project.json'), JSON.stringify(raw));
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-cvo-'));
  try {
    const pr = projectLoader.load(path.join(dir, 'project.json'));
    const r = await build(pr, out);
    return { ok: true, result: r, out };
  } catch (e) { return { ok: false, error: e, out }; }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
};

test('a set told apart by colour alone, whose colours collapse, is refused', async () => {
  const got = await buildDeben((raw) => { delete raw.tokens.sets.states.apartBy; });
  fs.rmSync(got.out, { recursive: true, force: true });
  assert.ok(!got.ok, 'it built a flood warning palette whose green and red are one colour');
  const f = got.error.findings && got.error.findings[0];
  assert.ok(f && f.level === 'blocker', 'a crash is not a refusal');
  for (const k of ['what', 'why', 'how']) assert.ok(f[k] && f[k].length > 20, `no ${k}`);
  assert.ok(/clear and act/.test(f.what), f.what);
  assert.ok(/Luminance is what WCAG measures and hue is what is missing/.test(f.why));
  assert.ok(/apartBy/.test(f.how));
});
test('the same set with a second channel builds, and says so', async () => {
  const got = await buildDeben(() => {});
  assert.ok(got.ok, got.error && got.error.message);
  const said = (got.result.notes || []).join(' ');
  assert.ok(/nothing in the set is told apart by colour alone/.test(said), said.slice(0, 200));
  const brand = JSON.parse(fs.readFileSync(path.join(got.out, 'brand.json'), 'utf8'));
  assert.strictEqual(brand.colourVision.sets[0].toldApartByColourAlone, false);
  assert.strictEqual(brand.colourVision.collapses[0].pair.join('/'), 'clear/act');
  const html = fs.readFileSync(path.join(got.out, 'guidelines.html'), 'utf8');
  assert.ok(html.indexOf('Colour vision') > -1, 'the manual does not show the palette simulated');
  assert.ok(/deuteranopia/.test(html));
  assert.ok(/A pair with a partner|Telling colours/.test(fs.readFileSync(path.join(got.out, 'README.txt'), 'utf8')));
  fs.rmSync(got.out, { recursive: true, force: true });
});
test('a second channel that only covers half the set is refused', async () => {
  const got = await buildDeben((raw) => { delete raw.tokens.sets.states.apartBy.act; });
  fs.rmSync(got.out, { recursive: true, force: true });
  assert.ok(!got.ok);
  assert.ok(/apartBy covers some of the set and not act/.test(got.error.message), got.error.message);
});
test('two members given the same second channel is refused', async () => {
  const got = await buildDeben((raw) => { raw.tokens.sets.states.apartBy.act = 'an open ring, and the word Clear'; });
  fs.rmSync(got.out, { recursive: true, force: true });
  assert.ok(!got.ok);
  assert.ok(/to more than one colour in the set/.test(got.error.message), got.error.message);
});
test('a set naming a colour that is not in the palette is refused', async () => {
  const got = await buildDeben((raw) => { raw.tokens.sets.states.of.push('teal'); });
  fs.rmSync(got.out, { recursive: true, force: true });
  assert.ok(!got.ok);
  assert.ok(/is not a colour in this palette/.test(got.error.message), got.error.message);
});
test('a set that does not say why is refused', async () => {
  const got = await buildDeben((raw) => { delete raw.tokens.sets.states.why; });
  fs.rmSync(got.out, { recursive: true, force: true });
  assert.ok(!got.ok);
  assert.ok(/does not say why these are read together/.test(got.error.message), got.error.message);
});
test('a token branch nothing reads is caught, the way rules and system are', async () => {
  const got = await buildDeben((raw) => { raw.tokens.spacing = { base: 8 }; });
  assert.ok(got.ok);
  assert.ok((got.result.warnings || []).some((w) => /tokens\.spacing is set, and nothing reads it/.test(w)));
  fs.rmSync(got.out, { recursive: true, force: true });
});
test('a gradient between two colours somebody cannot separate is a flat fill', async () => {
  // Vesper's whole identity is its gradient, and one length of it does not
  // travel for a tritanope.
  const vp = projectLoader.load(path.join(__dirname, '..', 'projects', 'vesper', 'project.json'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-grad-'));
  const r = await build(vp, dir);
  fs.rmSync(dir, { recursive: true, force: true });
  const said = r.warnings.filter((w) => /that length of the gradient is a flat fill/i.test(w));
  assert.strictEqual(said.length, 1, `expected one gradient finding, got ${said.length}`);
  assert.ok(/#B8336A|#C2620E/.test(said[0]), said[0]);
});
test('a refusal raised while building reaches the designer, not just its first line', async () => {
  // The loader has reported findings in the designer's language since the
  // beginning. Nothing had ever thrown findings from inside build, so the
  // build's own catch printed one line of an Error and lost the why with it.
  const { main } = require('../src/cli');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-cli-'));
  const raw = debenRaw();
  delete raw.tokens.sets.states.apartBy;
  for (const f of ['mark.svg', 'wordmark.svg']) {
    fs.copyFileSync(path.join(path.dirname(DEBEN), f), path.join(dir, f));
  }
  fs.writeFileSync(path.join(dir, 'project.json'), JSON.stringify(raw));
  const said = [];
  const realErr = console.error, realLog = console.log;
  console.error = (...a) => said.push(a.join(' '));
  console.log = () => {};
  let code;
  try { code = await main(['build', path.join(dir, 'project.json'), '-o', path.join(dir, 'out')]); }
  finally { console.error = realErr; console.log = realLog; fs.rmSync(dir, { recursive: true, force: true }); }
  assert.strictEqual(code, 1);
  const text = said.join('\n');
  assert.ok(/Must fix before this can be used/.test(text), text.slice(0, 300));
  assert.ok(/Luminance is what WCAG measures/.test(text), 'the why was lost');
  assert.ok(/apartBy/.test(text), 'the how was lost');
});


// ---------------------------------------------------------------------------
console.log('\na floor is a switch point, not a wall');
const LAD = require('../src/ladder');
const ORIEL = path.join(__dirname, '..', 'projects', 'oriel', 'project.json');
const oriel = projectLoader.load(ORIEL);
const orielM = measure(oriel);
const orielFloors = require('../src/variants').floors(oriel, orielM);
let orielOut, orielBrand;
before(async () => {
  orielOut = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-oriel-'));
  await build(oriel, orielOut);
  orielBrand = JSON.parse(fs.readFileSync(path.join(orielOut, 'brand.json'), 'utf8'));
});

test('the rungs are ordered by what they measure, and the bands meet', () => {
  const list = LAD.rungs(oriel, orielM, orielFloors);
  const bands = LAD.bands(list);
  assert.strictEqual(list.length, 5);
  for (let i = 1; i < bands.length; i++) {
    assert.ok(bands[i].from < bands[i - 1].from, `${bands[i].name} does not hold smaller than ${bands[i - 1].name}`);
    assert.strictEqual(bands[i].to, bands[i - 1].from - 1, `there is a gap above ${bands[i].name}`);
  }
  assert.strictEqual(bands[0].to, null, 'the top rung has a ceiling');
});
test('the identity holds far below the drawing at the top of it', () => {
  const bands = LAD.bands(LAD.rungs(oriel, orielM, orielFloors));
  const bottom = bands[bands.length - 1].from;
  assert.ok(bottom * 4 < bands[0].from, `${bottom} px against ${bands[0].from} px is not much of a ladder`);
  assert.strictEqual(bottom, orielBrand.logo.ladder[orielBrand.logo.ladder.length - 1].fromPx);
});
test('every rung is drawn in every colourway, and none is invented', () => {
  const files = fs.readdirSync(path.join(orielOut, '12-ladder')).filter((f) => f.endsWith('.svg'));
  const tiers = oriel.tiers.map((t) => t.name);
  assert.strictEqual(files.length, tiers.length * oriel.rules.colourways.length);
  for (const t of tiers) {
    for (const cw of oriel.rules.colourways) {
      assert.ok(files.indexOf(`oriel-${t}-${cw.name}.svg`) > -1, `no ${t} in ${cw.name}`);
    }
  }
  // and a tier is painted from the colourway, not left as it was drawn
  const rev = fs.readFileSync(path.join(orielOut, '12-ladder', 'oriel-compact-reverse.svg'), 'utf8');
  assert.ok(rev.indexOf('#F4F2ED') > -1 && rev.indexOf('#1B2B4B') < 0, rev.slice(0, 200));
});
test('icons are cut from the drawing the identity uses at icon sizes', () => {
  assert.strictEqual(orielBrand.generated.iconsFrom, 'mark-monogram.svg');
  // the point of the ladder, in one number: every size asked for now clears
  assert.deepStrictEqual(orielBrand.logo.icons.under, []);
  assert.ok(orielBrand.logo.icons.smallestSquarePx <= 16,
    `the monogram needs ${orielBrand.logo.icons.smallestSquarePx} px and a favicon is 16`);
});

const ladderAttempt = async (mut) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-lad-'));
  const raw = JSON.parse(fs.readFileSync(ORIEL, 'utf8'));
  for (const f of fs.readdirSync(path.dirname(ORIEL))) {
    if (f.endsWith('.svg')) fs.copyFileSync(path.join(path.dirname(ORIEL), f), path.join(dir, f));
  }
  mut(raw, dir);
  fs.writeFileSync(path.join(dir, 'project.json'), JSON.stringify(raw));
  try {
    const pr = projectLoader.load(path.join(dir, 'project.json'));
    const r = await build(pr, path.join(dir, 'out'));
    return { ok: true, warnings: r.warnings || [] };
  } catch (e) { return { ok: false, error: e }; }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
};
const refused = (got, re) => {
  assert.ok(!got.ok, 'it built');
  const f = got.error.findings && got.error.findings[0];
  assert.ok(f && f.level === 'blocker', `a crash is not a refusal: ${got.error.message}`);
  for (const k of ['what', 'why', 'how']) assert.ok(f[k] && f[k].length > 20, `no ${k}`);
  assert.ok(re.test(f.what), f.what);
};

test('a rung that does not hold smaller than the one above it is refused', async () => {
  refused(await ladderAttempt((raw) => {
    raw.rules.ladder = ['horizontal', 'mark', 'compact', 'standard', 'monogram'];
  }), /does not hold any smaller/);
});
test('a rung named in the ladder that is neither lockup nor tier is refused', async () => {
  refused(await ladderAttempt((raw) => { raw.rules.ladder = ['horizontal', 'trapdoor']; }),
    /has no lockup and no tier called that/);
});
test('a ladder of one rung is refused', async () => {
  refused(await ladderAttempt((raw) => { raw.rules.ladder = ['mark']; }), /fewer than two rungs/);
});
test('a tier whose file is missing is refused', async () => {
  refused(await ladderAttempt((raw) => { raw.assets.tiers[1].file = 'nope.svg'; }), /that file is not there/);
});
test('a rung with more in it than the one above is a warning, not a silence', async () => {
  const got = await ladderAttempt((raw, dir) => {
    let bars = '';
    for (let i = 0; i < 12; i++) bars += `<path d="M${30 + i * 15} 60 V180"/>`;
    fs.writeFileSync(path.join(dir, 'mark-compact.svg'),
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><g data-slot="ink" fill="none" `
      + `stroke="#1B2B4B" stroke-width="20">${bars}</g></svg>`);
    raw.rules.ladder = ['mark', 'compact'];
  });
  assert.ok(got.ok, got.error && got.error.message);
  assert.ok(got.warnings.some((w) => /has more in it: 12 pieces of ink against 7/.test(w)), got.warnings.join('\n'));
});
test('the check for a rung with more in it can actually fire', () => {
  // Its first version let a heavier stroke stand as a reason to say nothing.
  // A floor is the box divided by the thinnest thing in it, so a rung that
  // holds smaller always has relatively heavier lines — the escape was every
  // case, and the check could never fire at all.
  const list = LAD.rungs(oriel, orielM, orielFloors);
  const fake = list.slice(0, 2).map((r, i) => Object.assign({}, r, { parts: i === 0 ? 3 : 9 }));
  assert.ok(LAD.check(fake, oriel).some((f) => f.code === 'ladderDetail'));
});
test('a tier of a different shape from the mark is a warning', async () => {
  const got = await ladderAttempt((raw, dir) => {
    fs.writeFileSync(path.join(dir, 'mark-compact.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><g data-slot="ink" fill="none" '
      + 'stroke="#1B2B4B" stroke-width="20"><path d="M20 100 H220"/></g></svg>');
    raw.rules.ladder = ['mark', 'compact'];
  });
  assert.ok(got.ok);
  assert.ok(got.warnings.some((w) => /tall for its width and the mark is/.test(w)), got.warnings.join('\n'));
});
test('a ladder that steps down through lockups is not called a shape change', () => {
  // A horizontal lockup is 0.43 tall for its width and the mark under it is 1.1,
  // and that step is the point of the step. Comparing each rung with whatever is
  // above it flagged every well-made ladder in the repository.
  assert.deepStrictEqual(
    LAD.check(LAD.rungs(oriel, orielM, orielFloors), oriel).filter((f) => f.code === 'ladderShape'), []);
});
test('a tier that does not carry the master\'s slots is a warning', async () => {
  const got = await ladderAttempt((raw, dir) => {
    fs.writeFileSync(path.join(dir, 'mark-compact.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><g fill="none" stroke="#1B2B4B" '
      + 'stroke-width="20"><path d="M45 45 H195 V165 H45 Z"/><path d="M45 165 L120 210 L195 165"/></g></svg>');
    raw.rules.ladder = ['mark', 'compact'];
  });
  assert.ok(got.ok);
  assert.ok(got.warnings.some((w) => /ink is missing from it/.test(w)), got.warnings.join('\n'));
});
test('the package says which drawing at which size', () => {
  const readme = fs.readFileSync(path.join(orielOut, 'README.txt'), 'utf8');
  assert.ok(/the mark steps down through simpler drawings/.test(readme));
  for (const b of orielBrand.logo.ladder) assert.ok(readme.indexOf(b.rung) > -1, `${b.rung} not in the read me`);
  const html = fs.readFileSync(path.join(orielOut, 'guidelines.html'), 'utf8');
  assert.ok(html.indexOf('The mark at every size') > -1, 'the manual has no ladder chapter');
  // an identity without one gets no empty chapter
  assert.ok(fs.readFileSync(path.join(out, 'guidelines.html'), 'utf8').indexOf('The mark at every size') < 0);
});

console.log('\nthe module a mark says it was built on');
test('every point in every Oriel drawing is on the module it declares', () => {
  const S = require('../src/system');
  const grid = S.resolve(oriel, orielM).grid;
  assert.strictEqual(grid.unit, 15);
  assert.strictEqual(grid.across, 16);
  for (const [name, src] of [['mark', oriel.assets.mark.source]].concat(oriel.tiers.map((t) => [t.name, t.source]))) {
    const got = S.offGrid(src, grid.unit);
    assert.ok(got.total > 4, `${name} has ${got.total} points`);
    assert.deepStrictEqual(got.off, [], `${name} is off its own module`);
  }
});
test('a point moved off the module is found and named', async () => {
  const got = await ladderAttempt((raw, dir) => {
    fs.writeFileSync(path.join(dir, 'mark.svg'),
      fs.readFileSync(path.join(path.dirname(ORIEL), 'mark.svg'), 'utf8').replace('M45 90 H195', 'M45 88 H195'));
  });
  assert.ok(got.ok);
  const said = got.warnings.filter((w) => /unit module/.test(w));
  assert.strictEqual(said.length, 1, got.warnings.join('\n'));
  assert.ok(/45,88 is 2 out/.test(said[0]), said[0]);
});
test('the construction diagram draws the module, and says so once', () => {
  const html = fs.readFileSync(path.join(orielOut, 'guidelines.html'), 'utf8');
  assert.ok(html.indexOf('16 modules of 15') > -1, 'the diagram does not name the module');
  assert.ok(html.indexOf('15 unit module, 16 across') > -1, 'the caption does not name the module');
  // an identity that declares none keeps the plain caption and claims nothing
  const plain = fs.readFileSync(path.join(out, 'guidelines.html'), 'utf8');
  assert.ok(plain.indexOf('unit box') > -1 && plain.indexOf('modules of') < 0);
});
test('the pattern is cut from the master, not from whatever icons come from', () => {
  // `mark` in the build meant the icon artwork and the pattern source at once.
  // It stopped being one thing the moment a ladder could say which drawing is
  // used at icon sizes, and Fathom's whole identity is its pattern.
  assert.strictEqual(orielBrand.generated.iconsFrom, 'mark-monogram.svg');
  assert.ok(fs.readdirSync(orielOut).indexOf('07-pattern') > -1, 'no pattern was written');
  const tile = fs.readFileSync(path.join(orielOut, '07-pattern',
    fs.readdirSync(path.join(orielOut, '07-pattern'))[0]), 'utf8');
  assert.ok(tile.length > 200);
});

drain().then(() => {

  for (const d of [out, out2, tbOut, kilnOut, orielOut]) if (d) fs.rmSync(d, { recursive: true, force: true });
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
});
