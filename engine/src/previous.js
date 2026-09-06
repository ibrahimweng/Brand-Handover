'use strict';
// The reader.
//
// Every read me this engine has ever written ends with the same sentence:
// "brand.json holds all of the above in a form software can read." Twenty-one
// identities shipped that line, and in none of them did any software read one
// back. It was a promise with nothing on the other end of it.
//
// This is the other end. Point a project at the brand.json of its own last
// version and the engine reads it, compares it to the one it is about to
// write, and says what moved — because the expensive facts about a second
// version are not in the new package at all. They are in the difference.
// A floor that has risen retires artwork the client already has. A colour that
// has moved leaves stationery off palette. A colourway withdrawn does not
// delete the files anyone already downloaded. None of that is visible from
// either package alone, and both of them look correct.

const naming = require('./naming');

const CLASSES = {
  breaking: 'Retires something the client already has',
  news: 'New in this version',
  same: 'Unchanged',
};

// ------------------------------------------------------------------ loading

// Versions are compared, not just printed, so they have to parse. Anything
// dotted and numeric is accepted; a suffix ("2.0.0-rc1") sorts after the
// release it hangs off, which is the usual reading.
function parseVersion(v) {
  const m = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-+](.*))?$/.exec(String(v || '').trim());
  if (!m) return null;
  return { parts: [Number(m[1]), Number(m[2] || 0), Number(m[3] || 0)], tag: m[4] || '', text: String(v) };
}

function compareVersions(a, b) {
  for (let i = 0; i < 3; i++) { if (a.parts[i] !== b.parts[i]) return a.parts[i] < b.parts[i] ? -1 : 1; }
  if (a.tag === b.tag) return 0;
  // 2.0.0-rc1 is a run-up to 2.0.0, not something after it: a tagged version
  // sorts before the release it hangs off, and two tags sort against each other.
  if (!a.tag) return 1;
  if (!b.tag) return -1;
  return a.tag < b.tag ? -1 : 1;
}

const no = (code, what, why, how) => { const e = new Error(what); e.findings = [{ level: 'blocker', code, what, why, how }]; throw e; };

// A previous package is a real artefact from a real build, so it is read the
// way any other input is read: refuse in the designer's language, name the
// file, and say what would put it right.
function load(fs, path, dir, given, project) {
  const rel = typeof given === 'string' ? given : given.file;
  if (!rel) {
    return no('previous', 'this project has a "previous" but it does not say which file.',
      'Comparing versions needs the brand.json the last package wrote.',
      'Set "previous" to the path of that file, for example "previous": "previous/brand.json".');
  }
  const p = path.resolve(dir, rel);
  if (!fs.existsSync(p)) {
    return no('previous', `this project says the last version is at ${rel}, and that file is not there.`,
      'Without it there is nothing to compare against, and the changes that retire existing artwork stay invisible.',
      `Copy brand.json out of the package you shipped last time to ${rel}, or take "previous" out of the project.`);
  }
  let prev;
  try { prev = JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) {
    return no('previous', `${rel} is not readable as JSON: ${e.message}`,
      'It should be the brand.json a previous build wrote, copied out whole.',
      'Take it from the package itself rather than from an editor, and do not hand-edit it.');
  }
  if (!prev || typeof prev !== 'object' || !prev.brand || !prev.logo || !prev.colour) {
    return no('previous', `${rel} is a JSON file, but it is not a brand.json.`,
      'A brand.json has brand, version, colour and logo at the top of it. This one does not, '
      + 'so there is no palette or logo rule in it to compare against.',
      'Use the brand.json from the root of the last package, not the project file or a document.');
  }
  if (String(prev.brand) !== String(project.brand)) {
    return no('previous', `${rel} is the package for ${prev.brand}, and this project is ${project.brand}.`,
      'Two identities compared against each other report every colour as moved and every lockup as withdrawn, '
      + 'which is true and useless.',
      `Point "previous" at ${project.brand}'s own last brand.json.`);
  }
  const a = parseVersion(prev.version), b = parseVersion(project.version);
  if (!a) {
    return no('previous', `${rel} has version ${JSON.stringify(prev.version)}, which is not a version number.`,
      'Without a version there is no way to tell which of the two packages came first.',
      'Set a dotted number like 1.4.0 in the project that built it, and build it again.');
  }
  if (b && compareVersions(a, b) === 0) {
    return no('previous', `the last package and this one are both version ${b.text}.`,
      'Two different packages under one version number is the thing a version number exists to prevent: '
      + 'anybody holding a file cannot tell which of the two it came from.',
      `Move this project's version past ${a.text} before building.`);
  }
  if (b && compareVersions(a, b) > 0) {
    return no('previous', `the package at ${rel} is version ${a.text}, which is later than this project's ${b.text}.`,
      'That makes this build the older of the two, and every change below would be reported backwards.',
      'Either point "previous" at the earlier package, or move this project past ' + a.text + '.');
  }
  return { file: rel, path: p, data: prev, version: a };
}

// ---------------------------------------------------------------- comparing

const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o || {}, k);
const listOf = (v) => (Array.isArray(v) ? v.slice() : []);
const and = (xs) => (xs.length < 2 ? (xs[0] || '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const plural = (xs, one, many) => (xs.length === 1 ? one : many);

// Every entry: kind, level, and the three sentences the rest of the engine
// speaks in. `level` is the report's, `kind` is the client's.
const change = (kind, level, code, what, why, how) => ({ kind, level, code, what, why, how });

function compare(prev, next) {
  const out = [];
  const A = prev.logo || {}, B = next.logo || {};

  // ------ the floor. The most expensive line in the file, and the quietest.
  const fa = (A.minSize || {}).screenPx, fb = (B.minSize || {}).screenPx;
  const ma = (A.minSize || {}).printMm, mb = (B.minSize || {}).printMm;
  if (fa != null && fb != null && fa !== fb) {
    const up = fb > fa;
    out.push(change(up ? 'breaking' : 'news', up ? 'warning' : 'fixed', 'minSize',
      `the smallest usable size has gone ${up ? 'up' : 'down'}, from ${fa} px / ${ma} mm to ${fb} px / ${mb} mm.`,
      up ? `Anything already made between ${fa} px and ${fb} px was inside the rule when it was made and is outside it now: `
        + 'small print, favicons, embroidery, anything cut in vinyl. The artwork in those places has not changed, '
        + 'so nothing about them looks wrong until it is printed. '
        + `The new artwork has a finer part in it, and the floor is set by whatever disappears first.`
        : 'The new artwork has no part finer than the old one, so it survives further down. Nothing already made is affected.',
      up ? `List where the mark appears below ${fb} px or ${mb} mm and either enlarge it or use a lockup that holds at that size. `
        + '05-icons shows which sizes the new artwork clears.'
        : 'Nothing to do. The old floor still holds, so existing applications stay inside the rule.'));
  }

  // ------ and the same question of every lockup, because the twenty-third round
  // gave each of them a floor of its own. A pair that has risen retires exactly
  // what the master's rising retires, one folder at a time.
  const la = A.minSizes || {}, lb = B.minSizes || {};
  for (const l of Object.keys(lb)) {
    const x = la[l], y = lb[l];
    if (!x || !y || x.screenPx === y.screenPx) continue;
    const up = y.screenPx > x.screenPx;
    out.push(change(up ? 'breaking' : 'news', up ? 'warning' : 'fixed', 'lockupMinSize',
      `the ${l} lockup now holds at ${y.screenPx} px / ${y.printMm} mm, where it held at ${x.screenPx} px / ${x.printMm} mm.`,
      up ? `Every use of that one lockup below ${y.screenPx} px was inside the rule and is outside it now. `
        + 'The mark\'s own floor says nothing about this: a lockup is a different drawing.'
        : 'It survives further down than it did, so nothing already made in it is affected.',
      up ? `Check where ${l} is placed and raise it, or use a lockup that holds at the size you need.`
        : 'Nothing to do.'));
  }

  // ------ partners: artwork that is not ours, and a pair that stops existing
  const qa = new Map(((A.partners || [])).map((p) => [p.name, p]));
  const qb = new Map(((B.partners || [])).map((p) => [p.name, p]));
  for (const [name, after] of qb) {
    const before = qa.get(name);
    if (!before) {
      out.push(change('news', 'fixed', 'partnerAdded', `${name} is a new partner.`,
        'Nothing already made carries the pair, so it adds to the set without disturbing anything.',
        'The pairs they have supplied artwork for are in 11-partners.'));
      continue;
    }
    const gone = (before.colourways || []).filter((c) => (after.colourways || []).indexOf(c) < 0);
    if (gone.length) {
      out.push(change('breaking', 'warning', 'partnerVersionWithdrawn',
        `the ${name} pair is no longer made in ${gone.join(' or ')}.`,
        `${after.owner || name} has withdrawn the version of their mark that stood on that ground, or it was `
        + 'taken out of this project. Files already handed out still carry it and still look correct.',
        `Ask ${after.owner || name} whether the version is withdrawn or only missing, and say which pair replaces it.`));
    }
  }
  for (const [name, before] of qa) {
    if (qb.has(name)) continue;
    out.push(change('breaking', 'warning', 'partnerWithdrawn',
      `${name} is no longer a partner in this package.`,
      'Every pair made with them has gone with them, and nothing on the files anyone already holds says so. '
      + 'A partner lockup outlives the partnership unless somebody withdraws it.',
      `Say when the ${name} pair stops being used, and tell whoever is holding artwork of it.`));
  }

  // ------ clear space
  const ca = A.clearSpaceUnits, cb = B.clearSpaceUnits;
  if (ca != null && cb != null && Math.abs(ca - cb) > 0.001) {
    const up = cb > ca;
    out.push(change(up ? 'breaking' : 'news', up ? 'warning' : 'fixed', 'clearSpace',
      `clear space has gone from ${ca} to ${cb} units.`,
      up ? 'Every layout built to the old figure now reserves too little, and the mark sits closer to its neighbours '
        + 'than the rule allows. The number is a fraction of the mark, and the mark changed shape.'
        : 'Layouts built to the old figure reserve more than the rule now asks for, which is safe.',
      up ? 'Templates, ad slots and signage artwork that hard coded the old figure need it raised.'
        : 'Nothing to do.'));
  }

  // ------ the palette
  const pa = prev.colour || {}, pb = next.colour || {};
  for (const name of Object.keys(pb)) {
    if (!hasOwn(pa, name)) {
      out.push(change('news', 'fixed', 'colourAdded',
        `${name} is a new colour, ${pb[name].hex}.`,
        `Nothing already made uses it, so it adds to the palette without disturbing it.`,
        'It is in 07-colour and in the contrast table with every pair it makes.'));
      continue;
    }
    const before = pa[name], after = pb[name];
    if (String(before.hex).toUpperCase() !== String(after.hex).toUpperCase()) {
      out.push(change('breaking', 'warning', 'colourMoved',
        `${name} has moved from ${before.hex} to ${after.hex}.`,
        'Stock already printed, sites already built and files already handed out carry the old value. '
        + 'A colour that has moved a little is worse than one that has moved a lot, because the two sit side by side '
        + 'and read as a printing fault rather than as two versions.',
        `Search for ${before.hex} in code and templates and replace it. `
        + `For anything already printed, decide whether it is reprinted or allowed to run out.`));
    } else if (String(before.pantone || '') !== String(after.pantone || '')) {
      out.push(change('breaking', 'warning', 'pantoneMoved',
        `${name} keeps its screen value and changes Pantone, ${before.pantone || 'none'} to ${after.pantone || 'none'}.`,
        'Print buyers work from the Pantone, so a job already at a press is being matched to the old chip.',
        'Tell whoever holds the print specification. Nothing on screen changes.'));
    }
  }
  for (const name of Object.keys(pa)) {
    if (hasOwn(pb, name)) continue;
    out.push(change('breaking', 'warning', 'colourWithdrawn',
      `${name} (${pa[name].hex}) has been withdrawn from the palette.`,
      'Anything already made in it is now off palette, and nothing on those files says so. '
      + 'The colour does not stop existing because it left the token list.',
      `Decide what replaces ${pa[name].hex} where it is already in use, and say so to whoever holds those files.`));
  }

  // ------ lockups and colourways: named files that clients already hold
  for (const [key, label] of [['lockups', 'lockup'], ['colourways', 'colourway']]) {
    const before = listOf(A[key]), after = listOf(B[key]);
    // Lockup folders are numbered by which lockup they are, not by how many
    // there are, so a withdrawn one leaves its number empty rather than
    // shuffling every folder after it. Say which folder, so the sentence can
    // be checked against the package rather than believed.
    const where = (xs) => (key === 'lockups'
      ? `${and(xs.map(naming.folderFor))} ${plural(xs, 'is', 'are')}`
      : `no file in this package ends ${and(xs.map((x) => `-${x}`))}, and no colourway of that name is`);
    const gone = before.filter((x) => !after.includes(x));
    const added = after.filter((x) => !before.includes(x));
    if (gone.length) {
      out.push(change('breaking', 'warning', `${key}Withdrawn`,
        `${and(gone.map((g) => `"${g}"`))} ${plural(gone, `is a ${label} that has`, `are ${label}s that have`)} been withdrawn.`,
        `${where(gone)}${key === 'lockups' ? ' not in this package' : ''}. Files are named {brand}-{lockup}-{colourway}, so the ones already `
        + `downloaded keep working and keep their names, and nothing about them announces that they are no longer `
        + `part of the identity.`,
        `Say which ${label} replaces ${plural(gone, 'it', 'them')} and where. Anyone comparing the old package to this one `
        + `will otherwise read ${plural(gone, 'it', 'them')} as a file that failed to build.`));
    }
    if (added.length) {
      out.push(change('news', 'fixed', `${key}Added`,
        `${and(added.map((g) => `"${g}"`))} ${plural(added, `is a new ${label}`, `are new ${label}s`)}.`,
        `Nothing already made refers to ${plural(added, 'it', 'them')}, so ${plural(added, 'it adds', 'they add')} to the set without disturbing it.`,
        key === 'lockups' ? `${plural(added, 'It is', 'They are')} in ${and(added.map(naming.folderFor))}.`
          : `Every lockup is written in ${plural(added, 'it', 'them')} alongside the others.`));
    }
  }

  // ------ contrast. A pair that used to carry body text and no longer does is
  // an accessibility regression nobody introduced on purpose.
  const va = new Map((prev.contrast || []).map((c) => [c.pair, c]));
  const vb = new Map((next.contrast || []).map((c) => [c.pair, c]));
  const RANK = { 'Pass AAA': 3, 'Pass AA': 2, 'Large text only': 1, 'Never for text': 0 };
  const ALLOWS = { 'Pass AAA': 'any text at any size', 'Pass AA': 'body text and above',
    'Large text only': 'headings at 24 px and above, and shapes', 'Never for text': 'no text at all' };
  for (const [pair, after] of vb) {
    const before = va.get(pair);
    if (!before || before.verdict === after.verdict) continue;
    const fell = (RANK[after.verdict] ?? 0) < (RANK[before.verdict] ?? 0);
    out.push(change(fell ? 'breaking' : 'news', fell ? 'warning' : 'fixed', 'contrast',
      `${pair} ${fell ? 'no longer reaches' : 'now reaches'} what it did: ${before.ratio}:1 ${before.verdict} `
      + `is now ${after.ratio}:1 ${after.verdict}.`,
      fell ? `Text already set in this pair passed when it was set and does not now. The words did not change and the `
        + `layout did not change, so there is nothing on the page to look at — only the colour underneath moved.`
        : 'A pair that was restricted has more room than it had.',
      fell ? (RANK[after.verdict] > 0
        ? `This pair is now good for ${ALLOWS[after.verdict]}. Find where it carries anything smaller and change `
          + 'the size or one of the two colours.'
        : 'Take text out of this pair wherever it appears, or change one of the two colours.')
        : `The pair is now good for ${ALLOWS[after.verdict]}, where the last version allowed ${ALLOWS[before.verdict]}.`));
  }

  // ------ the icon grid, which is derived and therefore moves without being touched
  const ia = (prev.system || {}).icons || {}, ib = (next.system || {}).icons || {};
  if (ia.stroke != null && ib.stroke != null && ia.stroke !== ib.stroke) {
    out.push(change('breaking', 'warning', 'iconStroke',
      `icons are drawn at ${ib.stroke} on a ${ib.box} box, where the last version drew them at ${ia.stroke}.`,
      'The icon weight is taken off the master, so redrawing the master redraws the whole icon set without anyone '
      + 'asking for it. Icons already in a product were built to the old weight and now sit beside the new ones.',
      `Either redraw the existing icons at ${ib.stroke}, or set system.icons.stroke to ${ia.stroke} to hold the set where it was.`));
  }

  return out;
}

// ------------------------------------------------------------------ writing

const wrap = (text, width) => {
  const out = []; let line = '';
  for (const w of String(text).split(/\s+/)) {
    if (line && (line + ' ' + w).length > width) { out.push(line); line = w; } else line = line ? line + ' ' + w : w;
  }
  if (line) out.push(line);
  return out;
};

// CHANGES.txt is for the person who has the last package open in another
// window, so it leads with what they have to do, not with what is new.
function changesText(prev, next, changes, { width = 76 } = {}) {
  const L = [];
  const rule = (s) => { L.push(s); L.push('='.repeat(s.length)); };
  rule(`${next.brand} ${next.version} — what changed since ${prev.version}`);
  L.push('');
  const breaking = changes.filter((c) => c.kind === 'breaking');
  const news = changes.filter((c) => c.kind === 'news');
  if (!changes.length) {
    L.push(...wrap(`This package is version ${next.version} and the last one was ${prev.version}, and nothing this `
      + 'file can measure is different between them: same palette, same lockups, same colourways, same floor, '
      + 'same clear space. A version number that moves on its own tells anyone holding the old package to '
      + 'replace it for no reason.', width));
    L.push('');
    return L.join('\n') + '\n';
  }
  const n = (k, one, many) => `${k} ${k === 1 ? one : many}`;
  L.push(...wrap(breaking.length
    ? `${n(changes.length, 'change', 'changes')}, of which ${n(breaking.length, 'retires', 'retire')} `
      + 'something that already exists. Nothing in the old files changes on its own, so until somebody acts on the '
      + 'list below both versions are in use at once and both look correct.'
    : `${n(changes.length, 'change', 'changes')}, and none of them retires anything already made. `
      + 'Everything below adds to the identity.', width));
  L.push('');
  for (const [group, heading] of [[breaking, CLASSES.breaking], [news, CLASSES.news]]) {
    if (!group.length) continue;
    L.push(heading, '-'.repeat(heading.length), '');
    for (const c of group) {
      for (const line of wrap(c.what, width - 2)) L.push(`  ${line}`);
      for (const line of wrap(c.why, width - 4)) L.push(`    ${line}`);
      for (const line of wrap(`→ ${c.how}`, width - 4)) L.push(`    ${line}`);
      L.push('');
    }
  }
  L.push(...wrap('This file was written by comparing this package with the brand.json inside the last one. '
    + 'Keep this package\'s brand.json: it is what the next version will be compared against.', width));
  L.push('');
  return L.join('\n') + '\n';
}

module.exports = { load, compare, changesText, parseVersion, compareVersions, CLASSES };
