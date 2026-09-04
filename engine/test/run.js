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
    + 2                                                     // brand.json and README.txt
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

drain().then(() => {
  for (const d of [out, out2]) fs.rmSync(d, { recursive: true, force: true });
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
});
