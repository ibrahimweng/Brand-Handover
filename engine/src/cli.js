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
  handover edit <project.json> [-o f]      write a self contained canvas editor
  handover publish <project.json> <doc.json> [-o f]
                                           publish an edited document as a page

Both documents and every file come out of the same project, so a change to the
master shows up in all of them at once.

Every number in the output is read off the artwork. None of it is typed in.
`;

async function main(argv) {
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

  if (cmd === 'edit') {
    const { editorHtml } = require('./editor/emit');
    const { measure } = require('./variants');
    const oi2 = argv.indexOf('-o');
    const target = path.resolve(oi2 > -1 && argv[oi2 + 1] ? argv[oi2 + 1] : 'editor.html');
    const html = editorHtml(project, measure(project), []);
    fs.writeFileSync(target, html);
    console.log(`  wrote ${path.relative(process.cwd(), target)} (${(html.length / 1024).toFixed(0)} KB)`);
    console.log('  open it in a browser. No server and no build step: everything is inlined.');
    return 0;
  }

  if (cmd === 'publish') {
    const { measure } = require('./variants');
    const { bundle, starterDoc } = require('./editor/bundle');
    const { publish } = require('./editor/publish');
    const docPath = argv[2] && !argv[2].startsWith('-') ? argv[2] : null;
    const bu = bundle(project, measure(project), []);
    let document;
    if (docPath) {
      try { document = JSON.parse(fs.readFileSync(docPath, 'utf8')); }
      catch (e) { console.error(`could not read the document at ${docPath}: ${e.message}`); return 1; }
      if (!document.pages || !document.pages.length) { console.error('that document has no pages in it'); return 1; }
    } else {
      document = starterDoc(bu);
      console.log('  no document given, so publishing the one this project generates');
    }
    const oi3 = argv.indexOf('-o');
    const target = path.resolve(oi3 > -1 && argv[oi3 + 1] ? argv[oi3 + 1] : 'published.html');
    const html = publish(document, bu, { title: 'Guidelines' });
    fs.writeFileSync(target, html);
    console.log(`  published ${document.pages.length} page${document.pages.length === 1 ? '' : 's'} to ${path.relative(process.cwd(), target)} (${(html.length / 1024).toFixed(0)} KB)`);
    console.log(`  every measurement in it was read off the master just now, not stored in the document`);
    return 0;
  }

  if (cmd !== 'build') { console.error(`No command called "${cmd}".`); console.log(USAGE.trim()); return 1; }

  const oi = argv.indexOf('-o');
  const outDir = path.resolve(oi > -1 && argv[oi + 1] ? argv[oi + 1] : 'out');
  fs.rmSync(outDir, { recursive: true, force: true });

  const started = Date.now();
  let result;
  try { result = await build(project, outDir, { log: (m) => console.log(`  ${m}`) }); }
  catch (e) { console.error(e.message); return 1; }

  const bytes = result.written.reduce((n, f) => n + f.bytes, 0);
  console.log(`  wrote ${result.written.length} files (${(bytes / 1024).toFixed(0)} KB) to ${path.relative(process.cwd(), outDir)} in ${Date.now() - started} ms`);
  for (const w of result.warnings) console.log(`  warning: ${w}`);
  return 0;
}

if (require.main === module) main(process.argv.slice(2)).then((c) => process.exit(c));
module.exports = { main };
