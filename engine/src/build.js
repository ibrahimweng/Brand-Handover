'use strict';
const fs = require('fs');
const path = require('path');
const svgu = require('./svg');
const geo = require('./geometry');
const naming = require('./naming');
const { buildVariant, measure } = require('./variants');
const exp = require('./export');
const contrast = require('./contrast');
const { masterOf } = require('./project');

async function build(project, outDir, { log = () => {}, licence = null } = {}) {
  const measured = measure(project);
  log(`measured the master: ink ${measured.markInk.w} × ${measured.markInk.h}, ` +
      `clear space ${measured.clearSpace}, floor ${geo.floorText(measured.minimumSize, 'px')} / ${geo.floorText(measured.minimumSize, 'mm')}`);

  const { rules } = project;
  const warnings = [];
  // Not everything worth saying is worth a warning. A gradient that reaches the
  // files it should is working as intended and still has to be described,
  // because which file carries it decides which one goes to a one-colour job.
  const notes = [];
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
  const slotPaint = svgu.paintBySlot([project.assets.mark, project.assets.wordmark]
    .filter((a) => a && a.source).map((a) => svgu.parse(a.source)));
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
    // A slot set to "keep" is not a colour, so it was skipped here and the part
    // of the mark most likely to disappear — the pale end of a gradient — was
    // the one part never checked. Resolve it to what the master actually paints
    // and measure every stop.
    const inks = [];
    for (const [slot, hex] of Object.entries(cw.slots || {})) {
      if (hex === svgu.KEEP) {
        for (const h of slotPaint.get(slot) || []) inks.push([slot, h, true]);
      } else inks.push([slot, hex, false]);
    }
    if (!inks.length) continue;
    const worst = inks
      .map(([slot, hex, fromArt]) => ({ slot, hex, fromArt, r: contrast.ratio(hex, ground.hex) }))
      .filter((x) => x.r != null)
      .sort((a, b) => a.r - b.r)[0];
    if (worst && worst.r < 3) {
      warnings.push(`colourway "${cw.name}" is cut for ${cw.on}, and its ${worst.slot} `
        + `${worst.fromArt ? `runs to ${worst.hex}, which ` : ''}`
        + `measures ${worst.r}:1 against it. Below about 3:1 the mark stops being a shape `
        + `anyone can make out. ${worst.fromArt
          ? `Move that end of the gradient, or cut this colourway for a different ground.`
          : `Darken or lighten ${worst.slot}, or cut this colourway for a different ground.`}`);
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
  const keptSlots = new Set();     // slots a colourway left painted as the master drew them
  const rgbShaded = [];            // PDFs carrying a gradient, which jsPDF writes as DeviceRGB
  const gradientSlots = new Set([
    ...(project.assets.mark ? svgu.gradientSlots(svgu.parse(project.assets.mark.source)) : []),
    ...(project.assets.wordmark ? svgu.gradientSlots(svgu.parse(project.assets.wordmark.source)) : []),
  ]);
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
        markSrc: project.assets.mark && project.assets.mark.source,
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
      // which colourways carry the artwork's own paint through, and which paint
      // over it. A gradient is the case that matters: it cannot be one flat
      // brand colour, so a colourway either keeps it or loses it, and the
      // package has to say which files are which.
      if (v.kept && v.kept.length) for (const sl of v.kept) keptSlots.add(sl);
      if (rules.formats.includes('pdf') || rules.formats.includes('ai')) {
        // the file that actually goes to a press, so it goes in ink where the
        // project says what the ink is. See src/cmyk.js.
        const pdf = await exp.toPdf(v.svg, { ink });
        if (pdf.rgbShadings) rgbShaded.push(`${base}.pdf`);
        if (rules.formats.includes('pdf')) write(`${dir}/${base}.pdf`, pdf);
        // an .ai file is a PDF wrapper, so the same bytes open in Illustrator
        if (rules.formats.includes('ai')) write(`${dir}/${base}.ai`, pdf);
      }
    }
  }

  // ---- icons, favicons and social crops, all cut from the same master ----
  // icons are cut from the master, which for a logotype identity is the
  // logotype: there is no symbol to cut
  const mark = masterOf(project).source;
  const iconInk = rules.iconInk || '#FFFFFF';
  const iconBg = rules.iconBg || '#000000';
  const favPngs = [];
  // An icon is the mark inside a square, inset to the safe area, so the mark is
  // drawn at size * safeArea and its thinnest part shrinks with it. The engine
  // refuses an icon you hand it whose stroke lands under rules.minStrokePx, and
  // wrote its own at sizes far under the same rule without a word.
  //
  // A favicon under the rule is not news — nothing survives at 16 px, which is
  // why a favicon is a simplified glyph — so the floor goes into brand.json for
  // every project and only an app icon under it is worth stopping over.
  // Hallward is the case: a 766 px floor against a 180 px icon paints at
  // 0.49 px, and it ships nothing that clears its own rule at all.
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
  const icons = exp.iconFloor(measured, rules) || { thinIcons: [], thinFavicons: [], clears: [] };
  if (icons.thinIcons.length) {
    const list = icons.thinIcons.map((t) => `${t.name} at ${t.at} px`).join(', ');
    warnings.push(`${icons.thinIcons.length} app icon`
      + `${icons.thinIcons.length > 1 ? 's were' : ' was'} written where the thinnest part of the mark `
      + `paints under the ${rules.minStrokePx} px this project sets as the thinnest a stroke may go: `
      + `${list}. They are in the package because the sizes were asked for, but the mark will read as `
      + `a smudge at them: this artwork needs ${icons.smallest} px square before it holds together`
      + `${icons.clears.length ? `, so only ${icons.clears.join(' and ')} come out of it clean` : `, and nothing asked for is that big`}. `
      + (icons.squarish
        ? `Draw a simplified icon mark — fewer parts, heavier strokes — and run `
          + `\`check <icon.svg> --icon\` against it, which measures the same thing and will say when it clears.`
        : `The shape is the reason: this artwork is ${icons.aspect} times longer than it is deep, and an `
          + `icon is square, so it is drawn to fit its longest side and fills ${icons.coverage}% of the `
          + `square where a square mark fills about 46%. No amount of thickening fixes that. Draw a `
          + `device for square places — a monogram, an initial, the part of the mark that stands alone — `
          + `and run \`check <icon.svg> --icon\` against it.`));
  } else if (!icons.squarish) {
    // it clears the stroke rule and still wastes seven eighths of the square:
    // Kvist has shipped that way since the round it arrived, and Spire since
    // the round after the one that made the artwork's shape visible at all
    warnings.push(`the icons are square and this artwork is ${icons.aspect} times longer than it is `
      + `deep, so it fills ${icons.coverage}% of an icon where a square mark fills about 46%. Every icon `
      + `and favicon in the package is mostly background. Draw a device for square places — a monogram, `
      + `an initial, the part of the mark that stands alone — and run \`check <icon.svg> --icon\` against it.`);
  }

  // ---- what became of the artwork's own paint ----
  // A gradient is the case this exists for. The normaliser says the master has
  // one; only the build knows whether any colourway kept it, and a gradient no
  // colourway keeps is in the master and in nothing else — nine files went out
  // flat, each carrying the definition of a gradient none of them referenced,
  // and every document in the package was silent about it.
  const paintedOver = [...gradientSlots].filter((sl) => !keptSlots.has(sl));
  if (gradientSlots.size && !keptSlots.size) {
    warnings.push(`the master paints ${gradientSlots.size === 1 ? 'a slot' : 'slots'} `
      + `(${[...gradientSlots].join(', ')}) with a gradient, and every colourway names a flat colour `
      + `for ${gradientSlots.size === 1 ? 'it' : 'them'}, so the gradient is in the master and in `
      + `none of the files this wrote. Write "keep" instead of a colour in the colourway that is `
      + `meant to carry it.`);
  } else if (keptSlots.size) {
    const keeping = rules.colourways.filter((c) =>
      Object.values(c.slots || {}).some((v) => v === svgu.KEEP)).map((c) => c.name);
    notes.push(`${[...keptSlots].join(', ')} ${keptSlots.size === 1 ? 'is' : 'are'} painted as the master `
      + `draws ${keptSlots.size === 1 ? 'it' : 'them'} in ${keeping.join(' and ')}, and repainted flat in `
      + `${rules.colourways.filter((c) => !keeping.includes(c.name)).map((c) => c.name).join(' and ') || 'no other colourway'}. `
      + `${paintedOver.length ? `Nothing keeps ${paintedOver.join(', ')}. ` : ''}`
      + `The flat version is the one a one-colour job uses.`);
  }
  if (rgbShaded.length) {
    warnings.push(`${rgbShaded.length} PDF${rgbShaded.length > 1 ? 's carry' : ' carries'} a gradient, `
      + `and a gradient is written as a shading in DeviceRGB whatever the rest of the file is in: `
      + `${rgbShaded.join(', ')}. Everything else in ${rgbShaded.length > 1 ? 'them' : 'it'} is in the ink `
      + `you declared. A gradient cannot be a spot ink in any case, so send the flat version to a `
      + `two-colour job, and tell a process printer that the gradient converts on their side.`);
  }

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
      // Measured from what was written, not from what the palette declares. A
      // gradient never goes through the colour setters — jsPDF writes it as a
      // shading dictionary whose colour space it hardcodes to DeviceRGB — so a
      // package with a gradient in it was calling itself DeviceCMYK while the
      // one shape that is the identity went to press in screen colour.
      pdfColourSpace: !inkTable.every((c) => c.declared)
        ? 'DeviceRGB for anything not declared'
        : rgbShaded.length
          ? `DeviceCMYK, except the gradient in ${rgbShaded.length} file${rgbShaded.length > 1 ? 's' : ''}, which is DeviceRGB`
          : 'DeviceCMYK',
      gradientFiles: rgbShaded.slice(),
    },
    logo: {
      clearSpace: `${rules.clearSpaceRatio} * inkHeight`,
      clearSpaceUnits: measured.clearSpace,
      // both dimensions, because these are widths and nothing said so
      minSize: { screenPx: measured.minimumSize.screenPx, printMm: measured.minimumSize.printMm,
        screenPxHigh: measured.minimumSize.screenPxHigh, printMmHigh: measured.minimumSize.printMmHigh,
        note: 'screenPx and printMm are widths; the High figures are the matching heights',
        squarish: measured.minimumSize.squarish,
        from: measured.minimumSize.from, width: measured.minimumSize.thinnestStroke,
        basis: measured.minimumSize.basis },
      lockups: rules.lockups,
      colourways: rules.colourways.map((c) => c.name),
      // the square an icon has to be before this mark holds together in it, and
      // which of the ones asked for do. A favicon under it is expected; an app
      // icon under it means the artwork is too fine for the size it was cut at.
      icons: icons.smallest == null ? null : {
        smallestSquarePx: icons.smallest,
        // an icon is square; how much of it this artwork's shape can use
        aspect: icons.aspect,
        fillsPercent: icons.coverage,
        clears: icons.clears,
        under: icons.thinIcons.concat(icons.thinFavicons)
          .map((i) => ({ file: i.name, paintsAtPx: i.at })),
        rule: `the thinnest part must paint at ${rules.minStrokePx} px or more`,
      },
    },
    contrast: pairs.map((p) => ({ pair: `${p.fg} on ${p.bg}`, ratio: p.ratio, verdict: p.use })),
    system: {
      icons: sys.icons,
      pattern: Object.assign({}, sys.pattern, { source: gen.ok ? 'the shape marked data-pattern in the master' : null }),
      motion: sys.motion,
      photography: sys.photography,
    },
    generated: { measuredFrom: path.basename(masterOf(project).path), files: written.length + 1,
      builtUnder: licence && licence.ok ? { plan: licence.licence.plan, fingerprint: lic0.fingerprint(licence.licence) } : null },
  };
  write('brand.json', JSON.stringify(brandJson, null, 2));

  // What each folder is for depends on what else the identity has. A wordmark
  // beside a symbol is the fallback below the mark's floor; a wordmark that is
  // the whole identity is the logo.
  const lockupLines = (lockups, assets) => {
    const alone = !assets.mark;
    const why = {
      horizontal: 'the default. Use this unless the space is too narrow.',
      stacked: 'when the space is narrower than it is tall.',
      mark: 'avatars, app icons, and anywhere the name is already present.',
      wordmark: alone
        ? 'the logotype, which is the whole identity. Everything else is cut from it.'
        : 'below the minimum size, where the mark stops reading.',
    };
    return lockups.filter((l) => why[l])
      .map((l) => `  ${naming.folderFor(l).padEnd(15)} ${why[l]}`);
  };

  const readme = [
    `${project.brand} logo package`, '='.repeat(`${project.brand} logo package`.length), '',
    `Every file here was cut from ${path.basename(masterOf(project).path)} at the moment this package`,
    'was built. Nothing was drawn or renamed by hand, so no old variant can be',
    'hiding in a folder.', '',
    'Which file to use',
    '-----------------',
    // Four hardcoded lines, in a package that writes the lockups the project
    // asks for. Eleven of the thirteen projects here do not ask for all four,
    // so eleven read mes named folders that are not in the package — Cusp's
    // named three of them. The read me now lists what was written, and says
    // what each one is for given what else is beside it.
    ...lockupLines(rules.lockups, project.assets), '',
    'Rules that travel with it',
    '-------------------------',
    `  Clear space     ${measured.clearSpace} units on every side, which is ${rules.clearSpaceRatio} of the mark's height.`,
    `  Smallest use    ${geo.floorText(measured.minimumSize, 'px')} on screen, ${geo.floorText(measured.minimumSize, 'mm')} in print.`,
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

  return { measured, written, warnings, notes, contrast: pairs };
}

module.exports = { build };
