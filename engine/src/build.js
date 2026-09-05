'use strict';
const fs = require('fs');
const path = require('path');
const svgu = require('./svg');
const geo = require('./geometry');
const naming = require('./naming');
const { buildVariant, measure } = require('./variants');
const exp = require('./export');
const contrast = require('./contrast');

async function build(project, outDir, { log = () => {}, licence = null } = {}) {
  const measured = measure(project);
  log(`measured the master: ink ${measured.markInk.w} × ${measured.markInk.h}, ` +
      `clear space ${measured.clearSpace}, floor ${measured.minimumSize.screenPx} px / ${measured.minimumSize.printMm} mm`);

  const { rules } = project;
  const warnings = [];
  const written = [];
  const write = (rel, data) => {
    const p = path.join(outDir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, data);
    written.push({ path: rel, bytes: data.length });
  };

  // Print colour. Declared builds only: a hex code describes light leaving a
  // screen, and what it becomes in ink depends on a press and a paper that no
  // formula knows about.
  const cmyk = require('./cmyk');
  const lic0 = require('./licence');
  const inkTable = cmyk.table(project.tokens.colour || {});
  const ink = cmyk.inkMap(inkTable);
  const inkFindings = cmyk.check(inkTable, { stock: rules.stock, forPress: false });
  for (const f of inkFindings) warnings.push(`${f.what} ${f.how}`);
  for (const lockup of rules.lockups) {
    for (const colourway of rules.colourways) {
      const v = buildVariant({
        markSrc: project.assets.mark.source,
        wordmarkSrc: project.assets.wordmark && project.assets.wordmark.source,
        lockup, colourway, rules, measured,
      });
      if (v.missing.length) {
        warnings.push(`colourway "${colourway.name}" does not give a colour for slot(s): ${v.missing.join(', ')}`);
      }
      const base = naming.fileName(rules.naming, { brand: project.brand, lockup, colourway: colourway.name });
      const dir = naming.folderFor(lockup);

      if (rules.formats.includes('svg')) write(`${dir}/${base}.svg`, v.svg);
      if (rules.formats.includes('png')) {
        for (const w of rules.pngWidths) write(`${dir}/${base}-${w}.png`, geo.renderPng(v.svg, w));
      }
      if (rules.formats.includes('pdf') || rules.formats.includes('ai')) {
        // the file that actually goes to a press, so it goes in ink where the
        // project says what the ink is. See src/cmyk.js.
        const pdf = await exp.toPdf(v.svg, { ink });
        if (rules.formats.includes('pdf')) write(`${dir}/${base}.pdf`, pdf);
        // an .ai file is a PDF wrapper, so the same bytes open in Illustrator
        if (rules.formats.includes('ai')) write(`${dir}/${base}.ai`, pdf);
      }
    }
  }

  // ---- icons, favicons and social crops, all cut from the same master ----
  const mark = project.assets.mark.source;
  const iconInk = rules.iconInk || '#FFFFFF';
  const iconBg = rules.iconBg || '#000000';
  const favPngs = [];
  for (const size of rules.iconSizes || []) {
    const svg = exp.iconSquare(mark, { size, background: iconBg, ink: iconInk, radius: 0.22 });
    write(`05-icons/icon-${size}.png`, geo.renderPng(svg, size));
  }
  for (const size of rules.faviconSizes || []) {
    const svg = exp.iconSquare(mark, { size, background: iconBg, ink: iconInk });
    const png = geo.renderPng(svg, size);
    write(`05-icons/favicon-${size}.png`, png);
    favPngs.push({ size, data: png });
  }
  if (favPngs.length) write('05-icons/favicon.ico', exp.ico(favPngs));

  for (const [name, spec] of Object.entries(rules.social || {})) {
    const svg = spec.w === spec.h
      ? exp.iconSquare(mark, { size: spec.w, background: iconBg, ink: iconInk, radius: spec.round ? 0.5 : 0 })
      : exp.banner(mark, { width: spec.w, height: spec.h, background: iconBg, ink: iconInk });
    write(`06-social/${naming.slug(name)}-${spec.w}x${spec.h}.png`, geo.renderPng(svg, spec.w));
  }

  // ---- contrast is computed, never typed ----
  const pairs = contrast.matrix(project.tokens.colour || {});

  // ---- rule blocks: one decision each, every instance cut from it ----
  const system = require('./system');
  const pattern = require('./pattern');
  const sys = system.resolve(project, measured);
  const ways = [];
  for (const cw of rules.colourways) {
    const ink = Object.values(cw.slots)[0];
    ways.push({ name: cw.name, ink, on: cw.on && (project.tokens.colour[cw.on] || {}).hex || '#FFFFFF' });
  }
  const gen = pattern.everyTile(mark, sys.pattern, ways, pairs);
  if (gen.ok) {
    for (const t of gen.tiles) {
      write(`07-pattern/pattern-${naming.slug(t.density)}-${naming.slug(t.colourway)}.svg`, t.tile);
    }
    for (const r of gen.refused) warnings.push(`pattern ${r.density} in ${r.colourway} was not written. ${r.why}`);
  } else {
    warnings.push(`no pattern was written. ${gen.why} ${gen.how}`);
  }

  const brandJson = {
    brand: project.brand,
    version: project.version,
    colour: project.tokens.colour || {},
    print: {
      stock: rules.stock || 'coated',
      totalInkLimit: cmyk.TAC[rules.stock] || cmyk.TAC.coated,
      colour: inkTable.map((c) => ({ name: c.name, hex: c.hex, cmyk: c.values, coverage: c.coverage,
        pantone: c.pantone, declared: c.declared, source: c.source })),
      pdfColourSpace: inkTable.every((c) => c.declared) ? 'DeviceCMYK' : 'DeviceRGB for anything not declared',
    },
    logo: {
      clearSpace: `${rules.clearSpaceRatio} * inkHeight`,
      clearSpaceUnits: measured.clearSpace,
      minSize: { screenPx: measured.minimumSize.screenPx, printMm: measured.minimumSize.printMm,
        from: measured.minimumSize.from, width: measured.minimumSize.thinnestStroke,
        basis: measured.minimumSize.basis },
      lockups: rules.lockups,
      colourways: rules.colourways.map((c) => c.name),
    },
    contrast: pairs.map((p) => ({ pair: `${p.fg} on ${p.bg}`, ratio: p.ratio, verdict: p.use })),
    system: {
      icons: sys.icons,
      pattern: Object.assign({}, sys.pattern, { source: gen.ok ? 'the shape marked data-pattern in the master' : null }),
      motion: sys.motion,
      photography: sys.photography,
    },
    generated: { measuredFrom: path.basename(project.assets.mark.path), files: written.length + 1,
      builtUnder: licence && licence.ok ? { plan: licence.licence.plan, fingerprint: lic0.fingerprint(licence.licence) } : null },
  };
  write('brand.json', JSON.stringify(brandJson, null, 2));

  const readme = [
    `${project.brand} logo package`, '='.repeat(`${project.brand} logo package`.length), '',
    `Every file here was cut from ${path.basename(project.assets.mark.path)} at the moment this package`,
    'was built. Nothing was drawn or renamed by hand, so no old variant can be',
    'hiding in a folder.', '',
    'Which file to use',
    '-----------------',
    '  01-horizontal   the default. Use this unless the space is too narrow.',
    '  02-stacked      when the space is narrower than it is tall.',
    '  03-mark         avatars, app icons, and anywhere the name is already present.',
    '  04-wordmark     below the minimum size, where the mark stops reading.', '',
    'Rules that travel with it',
    '-------------------------',
    `  Clear space     ${measured.clearSpace} units on every side, which is ${rules.clearSpaceRatio} of the mark's height.`,
    `  Smallest use    ${measured.minimumSize.screenPx} px on screen, ${measured.minimumSize.printMm} mm in print.`,
    `                  ${measured.minimumSize.basis}.`,
    `  Colourways      ${rules.colourways.map((c) => c.name).join(', ')}.`, '',
    'brand.json holds all of the above in a form software can read.', '',
  ].join('\n');
  write('README.txt', readme);

  // ---- the two documents, both reading this same project ----
  if (rules.documents !== false) {
    const docs = require('./documents');
    const { deck } = require('./documents/deck');
    const ctx = docs.context(project, measured, written.slice(), brandJson);
    write('guidelines.html', docs.guidelines(ctx));
    write('deck.html', deck(ctx));
    const { editorHtml } = require('./editor/emit');
    const { bundle: mkBundle, starterDoc } = require('./editor/bundle');
    const { publish } = require('./editor/publish');
    const bu = mkBundle(project, measured, written.slice());
    const document = starterDoc(bu);
    write('editor.html', editorHtml(project, measured, written.slice()));
    write('document.json', JSON.stringify(document, null, 2));
    write('published.html', publish(document, bu, { title: 'Guidelines' }));
  }

  // ---- what the client owns, and what there is to bill for ----
  // The whole argument against the tools this replaces is that the client
  // inherits the designer's subscription. So the package says, in the package,
  // that they do not.
  const lic = require('./licence');
  write('LICENCE.txt', lic.clientLicence(project, licence));
  write('usage.json', JSON.stringify(lic.usage(licence, project, { written }), null, 2));

  // ---- one zip the client keeps, whoever is paying for what ----
  if (rules.zip !== false) {
    const buf = await exp.zip(written.map((f) => ({
      path: f.path,
      data: fs.readFileSync(path.join(outDir, f.path)),
    })));
    const zipName = `${naming.slug(project.brand)}-brand-package.zip`;
    fs.writeFileSync(path.join(outDir, zipName), buf);
    written.push({ path: zipName, bytes: buf.length });
  }

  return { measured, written, warnings, contrast: pairs };
}

module.exports = { build };
