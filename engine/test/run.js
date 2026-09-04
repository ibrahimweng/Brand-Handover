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
test('the editor and the exported document use the same renderer', () => {
  const path2 = require.resolve('../src/editor/render');
  const html = editorHtml(project, m, []);
  assert.ok(html.includes(fs.readFileSync(path2, 'utf8').slice(200, 400)),
    'the editor inlines a different renderer than the one on disk');
});

console.log('\npublishing');
const { publish } = require('../src/editor/publish');
const pubDoc = starterDoc(bu);
test('a published page holds every page of the document', () => {
  const html = publish(pubDoc, bu, {});
  const count = (html.match(/class="hp-page"/g) || []).length;
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

drain().then(() => {
  for (const d of [out, out2]) fs.rmSync(d, { recursive: true, force: true });
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
});
