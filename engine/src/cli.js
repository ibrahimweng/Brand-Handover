#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const projectLoader = require('./project');
const { build } = require('./build');
const { measure } = require('./variants');

const USAGE = `
handover — derives a whole logo package from one master mark

  handover build <project.json> [-o out]   write the package
  handover measure <project.json>          print what the master measures, write nothing
  handover check <artwork.svg>             report what is wrong with an export

Every number in the output is read off the artwork. None of it is typed in.
`;

function main(argv) {
  const [cmd, file] = argv;
  if (!cmd || cmd === '-h' || cmd === '--help') { console.log(USAGE.trim()); return 0; }
  if (!file) { console.error('Which project file? Pass a path to project.json.'); return 1; }

  // check runs on a bare SVG, before there is a project at all
  if (cmd === 'check') {
    const { normalise } = require('./normalise');
    const { format } = require('./report');
    let tokens = {};
    const ti = argv.indexOf('--tokens');
    if (ti > -1 && argv[ti + 1]) {
      try { tokens = (JSON.parse(fs.readFileSync(argv[ti + 1], 'utf8')).tokens) || {}; }
      catch (e) { console.error(`could not read tokens from ${argv[ti + 1]}: ${e.message}`); return 1; }
    }
    let src;
    try { src = fs.readFileSync(file, 'utf8'); }
    catch (e) { console.error(`could not read ${file}: ${e.message}`); return 1; }
    const r = normalise(src, { tokens });
    console.log(format(r.findings, { name: path.basename(file) }));
    return r.ok ? 0 : 1;
  }

  let project;
  try {
    project = projectLoader.load(file);
  } catch (e) {
    if (e.findings) {
      const { format } = require('./report');
      console.error(format(e.findings, { name: `${e.asset}.svg` }));
    } else {
      console.error(e.message);
    }
    return 1;
  }
  if (project.report) {
    const { format } = require('./report');
    for (const [asset, findings] of Object.entries(project.report)) {
      if (findings.length) console.log(format(findings, { name: `${asset} artwork` }));
    }
  }

  if (cmd === 'measure') {
    const m = measure(project);
    console.log(`${project.brand} ${project.version}`);
    console.log(`  ink box       ${m.markInk.w} × ${m.markInk.h} (at ${m.markInk.x}, ${m.markInk.y})`);
    console.log(`  clear space   ${m.clearSpace} units on every side`);
    console.log(`  thinnest stroke ${m.minimumSize.thinnestStroke}`);
    console.log(`  smallest use  ${m.minimumSize.screenPx} px on screen, ${m.minimumSize.printMm} mm in print`);
    console.log(`                ${m.minimumSize.basis}`);
    console.log(`  colour slots  ${m.slots.join(', ') || 'none found'}`);
    return 0;
  }

  if (cmd !== 'build') { console.error(`No command called "${cmd}".`); console.log(USAGE.trim()); return 1; }

  const oi = argv.indexOf('-o');
  const outDir = path.resolve(oi > -1 && argv[oi + 1] ? argv[oi + 1] : 'out');
  fs.rmSync(outDir, { recursive: true, force: true });

  const started = Date.now();
  let result;
  try { result = build(project, outDir, { log: (m) => console.log(`  ${m}`) }); }
  catch (e) { console.error(e.message); return 1; }

  const bytes = result.written.reduce((n, f) => n + f.bytes, 0);
  console.log(`  wrote ${result.written.length} files (${(bytes / 1024).toFixed(0)} KB) to ${path.relative(process.cwd(), outDir)} in ${Date.now() - started} ms`);
  for (const w of result.warnings) console.log(`  warning: ${w}`);
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { main };
