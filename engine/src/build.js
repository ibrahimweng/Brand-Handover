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
  // Nine pattern tiles went into a package with the same attribute written
  // twice, which is not valid SVG and which no renderer would open — and
  // nothing noticed, because nothing ever tried to read back what it wrote.
  // Every SVG this writes, it now reads.
  const unreadable = [];
  // Two builds of an unchanged master were not byte-identical: the PDFs carry a
  // creation date, the zip carries the mtime of every entry, and the documents
  // carry the moment they were made. The artwork was the same every time — but
  // 45 of Meridian's 138 files changed on every run, which makes the one thing
  // this project asks you to do impossible: change the master, rebuild, and
  // diff the two packages to see what moved. SOURCE_DATE_EPOCH is the usual
  // way to ask for a build that can be compared, so it is honoured here.
  const pinned = process.env.SOURCE_DATE_EPOCH;
  const clock = pinned ? new Date(Number(pinned) * 1000) : new Date();

  const write = (rel, data) => {
    const p = path.join(outDir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    if (rel.endsWith('.svg')) {
      try { geo.inkBox(String(data)); }
      catch (e) {
        // an empty drawing is a thing this legitimately writes; a file the
        // renderer cannot parse at all is not
        if (!/renders empty/.test(e.message)) unreadable.push(`${rel}: ${e.message}`);
      }
    }
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
  // A colourway names the ground it is cut for. Whether its inks can actually
  // be seen on that ground is arithmetic, and the contrast module has been here
  // since the first week — but nothing was asking it about colourways. The
  // documents quietly showed a different one instead, and every file for the
  // unreadable one was written anyway. Three of the seven projects in this repo
  // had one, including two written while looking straight at the problem.
  for (const cw of rules.colourways) {
    // a ground is a palette colour, or a plain one: "white" and "black" mean
    // paper and ink, and an identity is entitled to cut a colourway for them
    // without calling them brand colours
    const named = cw.on && project.tokens.colour[cw.on];
    const plain = !named && cw.on && contrast.toHex(cw.on);
    const ground = named || (plain ? { hex: plain } : null);
    if (cw.on && !ground) {
      // it names a ground that is not in the palette, so nothing could check it
      warnings.push(`colourway "${cw.name}" is cut for "${cw.on}", and there is no colour called `
        + `"${cw.on}" in the palette. Nothing can work out whether the mark can be seen on it. `
        + `Name one of ${Object.keys(project.tokens.colour).join(', ')}, or add "${cw.on}" to the palette.`);
    }
    if (!ground) continue;
    const inks = Object.entries(cw.slots || {});
    if (!inks.length) continue;
    const worst = inks
      .map(([slot, hex]) => ({ slot, hex, r: contrast.ratio(hex, ground.hex) }))
      .filter((x) => x.r != null)
      .sort((a, b) => a.r - b.r)[0];
    if (worst && worst.r < 3) {
      warnings.push(`colourway "${cw.name}" is cut for ${cw.on}, and its ${worst.slot} `
        + `measures ${worst.r}:1 against it. Below about 3:1 the mark stops being a shape `
        + `anyone can make out. Darken or lighten ${worst.slot}, or cut this colourway for `
        + `a different ground.`);
    }
  }

  // clear space is a fraction of the mark's own height, and a fraction much
  // larger than the mark stops being clear space and becomes a rule nobody can
  // follow: at 2.5 the mark occupies a thirty-sixth of its own exclusion zone.
  if (rules.clearSpaceRatio > 2) {
    warnings.push(`clear space is ${rules.clearSpaceRatio} times the mark's own height on every `
      + `side, so the mark takes up about a ${Math.round((1 + 2 * rules.clearSpaceRatio) ** 2)}th `
      + `of the space it reserves. That is ${measured.clearSpace} units around a mark `
      + `${measured.markInk.w} by ${measured.markInk.h}. Check rules.clearSpaceRatio is the number `
      + `you meant — it is a fraction of the mark, not a multiple of it.`);
  }

  // A key the engine does not read is a setting the designer wrote and the
  // engine ignored. system.icon does nothing, because the engine reads
  // system.icons; clearspaceRatio does nothing, because it is clearSpaceRatio.
  // In both cases the manual quietly shows the default and there is no way to
  // tell from the outside that anything was dropped. Only rules and system are
  // checked: content is the designer's own prose and none of the engine's
  // business what else they keep in it.
  const READS = {
    rules: ['clearSpaceRatio', 'minStrokePx', 'minStrokeMm', 'lockupGapRatio', 'wordmarkHeightRatio',
      'naming', 'lockups', 'formats', 'pngWidths', 'stock', 'colourways', 'iconInk', 'iconBg',
      'iconSizes', 'faviconSizes', 'social'],
    system: ['icons', 'icon', 'pattern', 'motion', 'photography'],
  };
  const nearest = (key, options) => {
    const dist = (a, b) => {
      const m2 = [[]];
      for (let i = 0; i <= a.length; i++) m2[i] = [i];
      for (let j = 0; j <= b.length; j++) m2[0][j] = j;
      for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
          m2[i][j] = a[i - 1] === b[j - 1] ? m2[i - 1][j - 1]
            : 1 + Math.min(m2[i - 1][j], m2[i][j - 1], m2[i - 1][j - 1]);
        }
      }
      return m2[a.length][b.length];
    };
    const hit = options.map((o) => ({ o, d: dist(key.toLowerCase(), o.toLowerCase()) }))
      .sort((a, b) => a.d - b.d)[0];
    return hit && hit.d <= Math.max(2, Math.round(key.length / 3)) ? hit.o : null;
  };
  for (const [where, allowed] of Object.entries(READS)) {
    const obj = where === 'rules' ? project.rules : (project.system || {});
    for (const key of Object.keys(obj || {})) {
      if (allowed.indexOf(key) > -1) continue;
      const guess = nearest(key, allowed);
      warnings.push(`${where}.${key} is set, and nothing reads it`
        + (guess ? `. Did you mean ${where}.${guess}?` : '.')
        + ' Whatever you meant it to change is still on its default.');
    }
  }

  const saidMissing = new Set();
  // what the master itself paints each slot, so a slot nobody recoloured can be
  // reported as the colour it actually came out
  const masterInks = {};
  for (const asset of [project.assets.mark, project.assets.wordmark]) {
    if (!asset || !asset.source) continue;          // the wordmark has slots too
    svgu.eachPainted(svgu.parse(asset.source), (el) => {
      const sl = el.getAttribute('data-slot');
      const f = el.getAttribute('fill') || el.getAttribute('stroke');
      if (sl && f && f !== 'none' && !masterInks[sl]) masterInks[sl] = f;
    });
  }
  for (const lockup of rules.lockups) {
    for (const colourway of rules.colourways) {
      const v = buildVariant({
        markSrc: project.assets.mark.source,
        wordmarkSrc: project.assets.wordmark && project.assets.wordmark.source,
        lockup, colourway, rules, measured,
      });
      if (v.missing.length) {
        // once per colourway, not once per lockup — and say what happened to
        // the slot, because "does not give a colour" does not explain why the
        // file that was written anyway is the colour it is
        const key = `${colourway.name}:${v.missing.join(',')}`;
        if (!saidMissing.has(key)) {
          saidMissing.add(key);
          const kept = v.missing.map((sl) => `${sl} (${(masterInks[sl] || 'its master colour')})`).join(', ');
          warnings.push(`colourway "${colourway.name}" gives no colour for ${v.missing.join(', ')}, `
            + `so every file in it keeps what the master was painted: ${kept}. `
            + `Add the slot to the colourway, or remove it from the artwork.`);
        }
      }
      const base = naming.fileName(rules.naming, { brand: project.latinName, lockup, colourway: colourway.name });
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
    })), pinned ? clock : undefined);
    for (const u of unreadable) {
      warnings.push(`this wrote a file it cannot read back: ${u}. That is a defect in the engine,`
        + ' not in your artwork — please report it with the project that produced it.');
    }
    const zipName = `${naming.slug(project.latinName)}-brand-package.zip`;
    fs.writeFileSync(path.join(outDir, zipName), buf);
    written.push({ path: zipName, bytes: buf.length });
  }

  return { measured, written, warnings, contrast: pairs };
}

module.exports = { build };
