'use strict';
const fs = require('fs');
const path = require('path');
const svgu = require('./svg');
const geo = require('./geometry');
const naming = require('./naming');
const { buildVariant, measure } = require('./variants');

function build(project, outDir, { log = () => {} } = {}) {
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
    }
  }

  const brandJson = {
    brand: project.brand,
    version: project.version,
    colour: project.tokens.colour || {},
    logo: {
      clearSpace: `${rules.clearSpaceRatio} * inkHeight`,
      clearSpaceUnits: measured.clearSpace,
      minSize: { screenPx: measured.minimumSize.screenPx, printMm: measured.minimumSize.printMm },
      lockups: rules.lockups,
      colourways: rules.colourways.map((c) => c.name),
    },
    generated: { measuredFrom: path.basename(project.assets.mark.path), files: written.length },
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

  return { measured, written, warnings };
}

module.exports = { build };
