#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const projectLoader = require('./project');
const naming = require('./naming');
const { build } = require('./build');
const { measure } = require('./variants');

const USAGE = `
handover — derives a whole logo package from one master mark

  handover serve [--port 3000]             the app: drop your artwork in a browser
  handover build <project.json> [-o out]   write the package
  handover measure <project.json>          print what the master measures, write nothing
  handover check <artwork.svg>             report what is wrong with an export
  handover check <icon.svg> --icon <project.json>
                                           check an icon against the grid rule
  handover check <project.json> --print [--stock coated|uncoated|newsprint]
                                           check the palette before it goes to a press
  handover edit <project.json> [-o f]      write a self contained canvas editor
  handover publish <project.json> <doc.json> [-o f]
                                           publish an edited document as a page
  handover print <project.json> [doc.json] [-o dir] [--fonts dir]
                                           a printed piece, in ink, through Typst
  handover licence [licence.json]          what your plan covers, and whether it checks out
  handover licence --keypair [dir]         make an issuing keypair
  handover licence --issue --key k --holder "Name" --plan solo [--expires YYYY-MM-DD]

Both documents and every file come out of the same project, so a change to the
master shows up in all of them at once.

Every number in the output is read off the artwork. None of it is typed in.
`;

// The licence this run is operating under, and what it permits. One place, so
// build, print and publish cannot disagree about it.
function entitlement(argv, project, want) {
  const L = require('./licence');
  const cfg = L.config(process.env, fs, path);
  const li = argv.indexOf('--licence');
  const got = L.load(fs, path, {
    file: li > -1 ? argv[li + 1] : null,
    env: process.env.HANDOVER_LICENCE,
    dir: project && project.dir,
  });
  // with no vendor key there is nothing to verify against and nothing is limited
  if (!cfg.enforcing) return { enforcing: false, result: null, findings: [], licence: got.licence };
  const result = L.verify(got.licence, cfg.publicKey);
  return { enforcing: true, result, licence: got.licence,
    findings: L.check(result, project, want) };
}

// the first typst on PATH, without shelling out to a shell
function which(name) {
  for (const dir of String(process.env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    const p = path.join(dir, name);
    try { fs.accessSync(p, fs.constants.X_OK); return p; } catch (_) { /* keep looking */ }
  }
  return null;
}

async function main(argv) {
  const [cmd, file] = argv;
  if (!cmd || cmd === '-h' || cmd === '--help') { console.log(USAGE.trim()); return 0; }
  // licence is the one command that is about the engine rather than a project
  const NO_PROJECT = ['licence', 'license', 'serve'];
  if (!file && NO_PROJECT.indexOf(cmd) < 0) {
    console.error('Which project file? Pass a path to project.json.'); return 1;
  }

  // ---- the app: the engine with a front door, on this machine only ----
  if (cmd === 'serve') {
    const i = argv.indexOf('--port');
    const { serve } = require('./app/server');
    try { await serve({ port: Number(i > -1 ? argv[i + 1] : 0) || 3000 }); }
    catch (e) {
      console.error(`  could not start: ${e.message}`);
      if (e.code === 'EADDRINUSE') console.error('  Something else is on that port. Try: handover serve --port 3100');
      return 1;
    }
    return new Promise(() => {});          // it runs until it is stopped
  }

  // ---- licences: what a plan permits, and proving which plan you have ----
  if (cmd === 'licence' || cmd === 'license') {
    const L = require('./licence');
    if (argv.includes('--keypair')) {
      const kp = L.keypair();
      const dir = path.resolve(argv[argv.indexOf('--keypair') + 1] || '.');
      fs.writeFileSync(path.join(dir, 'handover-licence.key'), kp.privateKey, { mode: 0o600 });
      fs.writeFileSync(path.join(dir, 'handover-licence.pub'), kp.publicKey);
      console.log(`  wrote handover-licence.key and .pub to ${path.relative(process.cwd(), dir) || '.'}`);
      console.log('  Keep the .key off every machine but the one that issues licences.');
      console.log('  Put the .pub on the engines: HANDOVER_LICENCE_KEY=/path/to/handover-licence.pub');
      return 0;
    }
    if (argv.includes('--issue')) {
      const need = (flag) => { const i = argv.indexOf(flag); return i > -1 ? argv[i + 1] : null; };
      const keyPath = need('--key');
      if (!keyPath) { console.error('which key signs it? pass --key handover-licence.key'); return 1; }
      const licence = L.sign({
        holder: need('--holder') || '', email: need('--email') || '',
        plan: need('--plan') || 'solo', seats: Number(need('--seats') || 1),
        issued: new Date().toISOString().slice(0, 10),
        expires: need('--expires') || '',
      }, fs.readFileSync(keyPath, 'utf8'));
      const out = need('-o') || 'licence.json';
      fs.writeFileSync(out, JSON.stringify(licence, null, 2));
      console.log(`  issued ${licence.plan} to ${licence.holder || '(nobody named)'}`
        + `${licence.expires ? `, until ${licence.expires}` : ', with no end date'}`);
      console.log(`  ${path.relative(process.cwd(), out)}  fingerprint ${L.fingerprint(licence)}`);
      return 0;
    }

    const cfg = L.config(process.env, fs, path);
    const got = L.load(fs, path, { file: argv[1] && !argv[1].startsWith('-') ? argv[1] : null,
      env: process.env.HANDOVER_LICENCE, dir: process.cwd() });
    if (!cfg.enforcing) {
      console.log('  No vendor key is set, so nothing is limited.');
      console.log('  This engine runs everything. Set HANDOVER_LICENCE_KEY to a public key');
      console.log('  and the plan limits below start applying.\n');
    }
    if (!got.licence) {
      console.log(`  No licence found${cfg.enforcing ? ', so this engine is on Trial' : ''}.`);
    } else {
      const r = cfg.publicKey ? L.verify(got.licence, cfg.publicKey) : null;
      console.log(`  ${got.from}`);
      console.log(`  ${got.licence.holder || '(nobody named)'}  ${got.licence.plan}`
        + `${got.licence.expires ? `  until ${got.licence.expires}` : '  no end date'}`
        + `  fingerprint ${L.fingerprint(got.licence)}`);
      if (r) console.log(`  ${r.ok ? 'Good.' : r.why}`);
      else console.log('  Not checked: no vendor key set, so the signature means nothing here.');
    }
    console.log('\n  The plans');
    for (const [key, p] of Object.entries(L.PLANS)) {
      const n = (v) => (v === Infinity ? 'any' : String(v));
      console.log(`    ${key.padEnd(8)} ${n(p.projects).padStart(3)} projects, `
        + `${n(p.colourways).padStart(3)} colourways, ${n(p.lockups).padStart(3)} lockups`
        + `  ${['print', 'mockups', 'publish'].filter((f) => p[f]).join(', ') || 'documents only'}`);
    }
    return 0;
  }

  // everything that has to be true before a file goes to a press
  if (cmd === 'check' && argv.includes('--print')) {
    let proj;
    try { proj = projectLoader.load(file); }
    catch (e) { console.error(e.message); return 1; }
    const cmyk = require('./cmyk');
    const { format } = require('./report');
    const si = argv.indexOf('--stock');
    const stock = (si > -1 && argv[si + 1]) || proj.rules.stock || 'coated';
    if (!cmyk.TAC[stock]) {
      console.error(`no ink limit known for "${stock}". Try ${Object.keys(cmyk.TAC).join(', ')}.`);
      return 1;
    }
    const table = cmyk.table(proj.tokens.colour || {});
    console.log(`  ${stock} stock, which takes ${cmyk.TAC[stock]} percent ink\n`);
    for (const c of table) {
      console.log(`  ${c.name.padEnd(10)} ${c.label.padEnd(16)} ${(c.coverage + '%').padEnd(6)}`
        + `${c.declared ? 'given' : 'worked out, do not send this'}${c.pantone ? '   ' + c.pantone : ''}`);
    }
    console.log('');
    const found = cmyk.check(table, { stock, forPress: true });
    console.log(format(found, { name: `${proj.brand} for print` }));
    return found.some((f) => f.level === 'blocker') ? 1 : 0;
  }

  // an icon is checked against the rule the project already holds
  if (cmd === 'check' && argv.includes('--icon')) {
    const ii = argv.indexOf('--icon');
    const projPath = argv[ii + 1];
    if (!projPath) { console.error('which project holds the icon rule? pass --icon <project.json>'); return 1; }
    let proj;
    try { proj = projectLoader.load(projPath); }
    catch (e) { console.error(e.message); return 1; }
    const system = require('./system');
    const { format } = require('./report');
    const { measure } = require('./variants');
    const r = system.iconRules(measure(proj), (proj.system || {}).icons);
    let src;
    try { src = fs.readFileSync(file, 'utf8'); }
    catch (e) { console.error(`could not read ${file}: ${e.message}`); return 1; }
    const found = system.checkIcon(src, r);
    console.log(`  the rule: ${r.box} unit box, ${r.live} live, ${r.stroke} stroke, ${r.cap} ends, curve radius ${r.curveRadius}`);
    console.log(`  taken from the mark: viewBox ${r.derivedFrom.viewBox}, margin ${r.derivedFrom.markMargin}, stroke ${r.derivedFrom.markStroke}\n`);
    console.log(format(found, { name: path.basename(file) }));
    return found.some((f) => f.level === 'blocker') ? 1 : 0;
  }

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
    console.log(`  ${m.minimumSize.from === 'stem' ? 'narrowest stem  ' : 'thinnest stroke'} ${m.minimumSize.thinnestStroke}`);
    console.log(`  smallest use  ${require('./geometry').floorText(m.minimumSize, 'px')} on screen, ${require('./geometry').floorText(m.minimumSize, 'mm')} in print`);
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
    const gate = entitlement(argv, project, { publish: true });
    if (gate.findings.some((f) => f.level === 'blocker')) {
      const { format } = require('./report');
      console.log(format(gate.findings, { name: `${project.brand} on ${require('./licence').planOf(gate.result).name}` }));
      return 1;
    }
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
      // a saved document carries the images it uses; the document itself stays
      // layout only, so they are lifted onto the bundle rather than left in it
      if (document.images) {
        bu.images = document.images;
        delete document.images;
        const n = Object.keys(bu.images).length;
        console.log(`  ${n} image${n === 1 ? '' : 's'} came with the document`);
      }
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

  // a printed piece, as Typst source and, if a typst binary is about, as a PDF
  if (cmd === 'print') {
    const gate = entitlement(argv, project, { print: true });
    if (gate.findings.some((f) => f.level === 'blocker')) {
      const { format } = require('./report');
      console.log(format(gate.findings, { name: `${project.brand} on ${require('./licence').planOf(gate.result).name}` }));
      return 1;
    }
    const { measure } = require('./variants');
    const { bundle, starterDoc } = require('./editor/bundle');
    const typst = require('./typst');
    const bu = bundle(project, measure(project), []);
    const docPath = argv[2] && !argv[2].startsWith('-') ? argv[2] : null;
    let document;
    if (docPath) {
      try { document = JSON.parse(fs.readFileSync(docPath, 'utf8')); }
      catch (e) { console.error(`could not read the document at ${docPath}: ${e.message}`); return 1; }
      if (!document.pages || !document.pages.length) { console.error('that document has no pages in it'); return 1; }
      if (document.images) { bu.images = document.images; delete document.images; }
    } else {
      document = starterDoc(bu);
      console.log('  no document given, so using the one this project generates');
    }

    const oi = argv.indexOf('-o');
    const dir = path.resolve(oi > -1 && argv[oi + 1] ? argv[oi + 1] : 'print');
    fs.mkdirSync(dir, { recursive: true });
    const out = typst.emit(document, bu, {});
    // the printed piece is a file too, and a brand not named in a-z was
    // writing itself to "-.typ"
    const stem = naming.slug(project.latinName || project.brand) || 'piece';
    fs.writeFileSync(path.join(dir, `${stem}.typ`), out.source);
    for (const [name, bytes] of Object.entries(out.files)) fs.writeFileSync(path.join(dir, name), bytes);

    console.log(`  wrote ${stem}.typ${Object.keys(out.files).length ? ` and ${Object.keys(out.files).length} image file(s)` : ''} to ${path.relative(process.cwd(), dir)}`);
    // A project that ships its typeface has already answered this. The print
    // path used to name the families and ask the designer to go and find the
    // files that were sitting in the project all along.
    const shipped = new Set();
    if ((project.fonts || []).length) {
      const fdir = path.join(dir, 'fonts');
      fs.mkdirSync(fdir, { recursive: true });
      for (const fam of project.fonts) {
        shipped.add(fam.family);
        for (const f of fam.files) {
          fs.writeFileSync(path.join(fdir, path.basename(f.file)), Buffer.from(f.src.split(',')[1], 'base64'));
        }
      }
      console.log(`  wrote the identity's ${shipped.size === 1 ? 'typeface' : 'typefaces'} to fonts/, so Typst sets the piece in ${[...shipped].join(' and ')}`);
    }
    const missing = out.fonts.filter((f) => !shipped.has(f));
    if (missing.length) {
      console.log(`  needs the fonts: ${missing.join(', ')}. Pass --fonts <dir> so Typst can find them,`
        + ' or list the files under the family in the project so they travel with it.');
    }
    if (out.screenColours.length) {
      console.log(`  ${out.screenColours.length} colour(s) had no declared build and are written as screen colour: ${out.screenColours.join(', ')}`);
      console.log(`  run "handover check ${path.basename(file)} --print" before sending this anywhere.`);
    }
    // the same question the build asks of the document it generates, asked of
    // the one you are actually printing
    const over = require('./editor/model').overfullText(document, project.tokens.type);
    for (const t of over) {
      console.log(`  page ${t.page} ("${t.pageName}"): the ${t.style} text needs about ${t.lines} lines, `
        + `${t.needs} against the ${t.has} its block has, so "${t.text}…" prints over what is below it. `
        + `Make the block ${t.over} taller, or set it in a smaller step.`);
    }
    if ((out.unsayablePaint || []).length) {
      console.log(`  ${out.unsayablePaint.length} paint server could not be said in Typst and was drawn in `
        + `black: ${out.unsayablePaint.join(', ')}. A linear gradient translates; a radial one and a `
        + `pattern fill do not. Flatten those parts, or use the flat colourway for the printed piece.`);
    }
    if (out.rasterColour) console.log('  a photograph is placed as given; a press converts those itself, which is normal.');
    if (out.refused.length) {
      const by = {};
      for (const r of out.refused) by[r.type] = (by[r.type] || 0) + 1;
      console.log(`  left out, because a printed piece is not a manual: `
        + Object.entries(by).map(([t, n]) => `${n} ${t}`).join(', '));
    }

    const fi = argv.indexOf('--fonts');
    // the project's own fonts, unless somebody named a directory of their own
    const fontPath = fi > -1 ? argv[fi + 1] : (shipped.size ? path.join(dir, 'fonts') : null);
    const ti = argv.indexOf('--typst');
    const bin = ti > -1 ? argv[ti + 1] : which('typst');
    if (!bin) {
      console.log('\n  No typst binary found, so nothing was compiled. Install Typst and run:');
      console.log(`    typst compile ${fontPath ? `--font-path ${fontPath} ` : ''}${path.relative(process.cwd(), path.join(dir, stem + '.typ'))}`);
      return 0;
    }
    const args = ['compile'];
    if (fontPath) args.push('--font-path', fontPath);
    args.push(path.join(dir, `${stem}.typ`), path.join(dir, `${stem}.pdf`));
    const r = require('child_process').spawnSync(bin, args, { encoding: 'utf8' });
    const warnings = (r.stderr || '').match(/unknown font family: (\S+)/g) || [];
    if (warnings.length) {
      console.log(`  Typst could not find ${[...new Set(warnings.map((w) => w.split(': ')[1]))].join(', ')}`
        + ' and substituted. List the files under the family in the project so they travel with it,'
        + ' or pass --fonts <dir> with the real files before printing.');
    }
    if (r.status !== 0) { console.error((r.stderr || 'typst failed').trim()); return 1; }
    const bytes = fs.statSync(path.join(dir, `${stem}.pdf`)).size;
    console.log(`  compiled ${stem}.pdf (${(bytes / 1024).toFixed(0)} KB), every declared colour in ink`);
    return 0;
  }

  if (cmd !== 'build') { console.error(`No command called "${cmd}".`); console.log(USAGE.trim()); return 1; }

  const oi = argv.indexOf('-o');
  const outDir = path.resolve(oi > -1 && argv[oi + 1] ? argv[oi + 1] : 'out');
  fs.rmSync(outDir, { recursive: true, force: true });

  // a build asks for nothing beyond the plan's own numbers: a trial should be
  // able to make a package, just a smaller one. The print path and publishing
  // ask for themselves, where they are used.
  const ent = entitlement(argv, project, {});
  if (ent.findings.length) {
    const { format } = require('./report');
    console.log(format(ent.findings, { name: `${project.brand} on ${require('./licence').planOf(ent.result).name}` }));
    if (ent.findings.some((f) => f.level === 'blocker')) return 1;
  }

  const started = Date.now();
  let result;
  try { result = await build(project, outDir, { log: (m) => console.log(`  ${m}`), licence: ent.result }); }
  catch (e) { console.error(e.message); return 1; }

  const bytes = result.written.reduce((n, f) => n + f.bytes, 0);
  console.log(`  wrote ${result.written.length} files (${(bytes / 1024).toFixed(0)} KB) to ${path.relative(process.cwd(), outDir)} in ${Date.now() - started} ms`);
  for (const n of result.notes || []) console.log(`  note: ${n}`);
  for (const w of result.warnings) console.log(`  warning: ${w}`);
  return 0;
}

if (require.main === module) main(process.argv.slice(2)).then((c) => process.exit(c));
module.exports = { main };
