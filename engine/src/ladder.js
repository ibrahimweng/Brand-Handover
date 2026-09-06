'use strict';
// A minimum size is not a wall. It is a switch point.
//
// The twenty-third round gave every drawing in a package its own floor, which
// was right and only half the answer. A floor still meant *stop*: below it the
// engine had nothing to say, and the manual's advice at 20 px was the same as
// its advice at 2 px. That is not how a serious identity behaves. Below the size
// at which the full mark stops holding you do not stop using the mark — you move
// to a simpler drawing of it, and below that to a simpler one again, until what
// is left is a silhouette that survives at sixteen pixels. Each drawing serves a
// band, the bands meet, and the ladder runs from a building to a favicon without
// a gap in it.
//
// Everything here is measured. Which drawings are in the ladder is a decision
// and the project states it; the order they come in is not a decision, it is
// what the floors say, and a stated order that disagrees with the measurement is
// a refusal rather than a preference.
const svgu = require('./svg');
const geo = require('./geometry');

const no = (code, what, why, how) => {
  const e = new Error(what);
  e.findings = [{ level: 'blocker', code, what, why, how }];
  throw e;
};

// ------------------------------------------------------------------ loading

// The extra drawings: the ones that exist only to be smaller. A lockup is
// already in the package and already measured; a tier is artwork the identity
// supplies for a band the lockups cannot reach.
function load(fs, path, dir, raw, project) {
  const out = [];
  for (const entry of raw || []) {
    if (!entry || typeof entry !== 'object' || !entry.name || !entry.file) {
      no('tiers', 'a drawing in assets.tiers has no "name" or no "file".',
        'A tier is named in rules.ladder and written to a folder of its own, and there is nothing to call it.',
        'Give every tier a name and a file: { "name": "compact", "file": "mark-compact.svg" }.');
    }
    const p = path.resolve(dir, entry.file);
    if (!fs.existsSync(p)) {
      no('tiers', `the ${entry.name} tier is listed as ${entry.file}, and that file is not there.`,
        'A ladder with a rung missing has a band of sizes nothing serves, which is the one thing a ladder is for.',
        `Put the drawing at ${entry.file}, or take "${entry.name}" out of assets.tiers and out of rules.ladder.`);
    }
    out.push({ name: entry.name, file: entry.file, path: p, source: fs.readFileSync(p, 'utf8'),
      note: entry.note || null });
  }
  return out;
}

// ---------------------------------------------------------------- measuring

const measureOne = (source, rules) => ({
  ink: geo.inkBox(source),
  viewBox: svgu.viewBox(svgu.parse(source)),
  minimumSize: geo.minimumSize(source, rules),
  parts: svgu.inkParts(svgu.parse(source)),
  slots: svgu.slotsUsed(svgu.parse(source)),
});

// The rungs, in the order the project states them, each with what it measures.
// `svgOf` is handed in so a lockup rung can be composed in a colourway and a
// tier rung painted, without this module knowing how either is done.
function rungs(project, measured, floors) {
  const names = (project.rules.ladder || []);
  const byTier = new Map((project.tiers || []).map((t) => [t.name, t]));
  const out = [];
  for (const name of names) {
    if (byTier.has(name)) {
      const t = byTier.get(name);
      out.push(Object.assign({ name, kind: 'tier', source: t.source, file: t.file, note: t.note },
        measureOne(t.source, project.rules)));
    } else if (floors[name]) {
      const f = floors[name];
      out.push({ name, kind: 'lockup', minimumSize: f,
        ink: f.ink || null, viewBox: f.viewBox || null, parts: f.parts == null ? null : f.parts, slots: null });
    } else {
      no('ladder', `rules.ladder names "${name}", and this identity has no lockup and no tier called that.`,
        'The ladder is the order a client steps down through, so every rung has to be something they were given.',
        `Use one of the lockups (${(project.rules.lockups || []).join(', ')})`
        + `${(project.tiers || []).length ? ` or one of the tiers (${(project.tiers || []).map((t) => t.name).join(', ')})` : ''}.`);
    }
  }
  return out;
}

// Each rung is used from its own floor up to where the rung above it takes over.
// The top rung has no ceiling: there is no size too large for the full drawing.
function bands(list) {
  return list.map((r, i) => ({
    name: r.name, kind: r.kind,
    from: r.minimumSize.screenPx,
    to: i === 0 ? null : list[i - 1].minimumSize.screenPx - 1,
    printFrom: r.minimumSize.printMm,
    printTo: i === 0 ? null : list[i - 1].minimumSize.printMm,
  }));
}

// -------------------------------------------------------------- the checking

function check(list, project) {
  const findings = [];
  if (list.length < 2) {
    no('ladder', 'rules.ladder has fewer than two rungs.',
      'A ladder of one is a minimum size with a longer name. The point of it is the size at which one '
      + 'drawing hands over to another.',
      'Name at least two, largest first: the lockup or mark you use by default, and something simpler '
      + 'that holds below it.');
  }
  // The stated order against the measured one. Not a preference: a rung placed
  // above one that holds smaller means the client is told to switch *up* into a
  // drawing that has already stopped working.
  for (let i = 1; i < list.length; i++) {
    const above = list[i - 1], here = list[i];
    if (here.minimumSize.screenPx < above.minimumSize.screenPx) continue;
    no('ladder', `rules.ladder puts "${here.name}" below "${above.name}", and it does not hold any smaller: `
      + `${above.name} holds at ${above.minimumSize.screenPx} px and ${here.name} needs ${here.minimumSize.screenPx} px.`,
      'A ladder is read downwards — at this size, use this — so a rung that needs more room than the one '
      + 'above it sends the reader to a drawing that has already stopped working. The order is not a '
      + 'preference; it is what the two drawings measure.',
      here.kind === 'tier'
        ? `Redraw ${here.name} so it holds below ${above.minimumSize.screenPx} px: fewer parts, and a heavier `
          + 'stroke relative to its box. Both put the floor down.'
        : `Put "${here.name}" above "${above.name}" in rules.ladder, or take it out.`);
  }
  // Simpler, measured. A rung that is not simpler than the one above it is a
  // second drawing of the same complexity, and the switch buys nothing.
  for (let i = 1; i < list.length; i++) {
    const above = list[i - 1], here = list[i];
    if (here.parts == null || above.parts == null) continue;
    if (here.parts <= above.parts) continue;
    // Weight is not the escape it looks like. A floor is the box divided by the
    // thinnest thing in it, so a rung that holds smaller is a rung whose lines
    // are heavier relative to their box, always — the first version of this
    // check let that stand as a reason and could therefore never fire at all.
    // What is left to ask is the only thing weight does not already answer:
    // whether there is less in the drawing.
    findings.push({ level: 'warning', code: 'ladderDetail',
      what: `"${here.name}" is the rung below "${above.name}" and has more in it: `
        + `${here.parts} pieces of ink against ${above.parts}.`,
      why: 'Stepping down is meant to take something out. This rung holds at a smaller size because its '
        + 'lines are heavier, and it has more pieces than the drawing it replaces — so at the bottom of its '
        + 'own band those pieces close up on each other, which is the reason the rung above it stopped.',
      how: 'Take something out of it. Detail coming out and weight going up both put the floor down, and '
        + 'only one of them is happening here.' });
  }
  // The same identity, or a different one. Proportion is what a reader
  // recognises across a switch: a drawing that changes shape as well as detail
  // reads as a second logo rather than the same logo, smaller.
  //
  // Asked of the tiers against the mark they are drawings of, and not of the
  // ladder in sequence. A ladder is entitled to change shape where it drops the
  // name — a horizontal lockup is 0.43 tall for its width and the mark under it
  // is 1.1, and that step is the point of the step. Comparing each rung with
  // whatever happens to be above it flagged every well-made ladder in the
  // repository, which is a check that has learnt to cry wolf.
  const base = project.assets.mark ? geo.inkBox(project.assets.mark.source) : null;
  if (base) {
    const want = base.h / base.w;
    for (const r of list) {
      if (r.kind !== 'tier' || !r.ink) continue;
      const a = r.ink.h / r.ink.w;
      if (Math.abs(Math.log(a / want)) < Math.log(1.15)) continue;
      findings.push({ level: 'warning', code: 'ladderShape',
        what: `the ${r.name} tier is ${svgu.round(a, 2)} tall for its width and the mark is ${svgu.round(want, 2)}.`,
        why: 'A tier is the mark drawn with less in it, and a switch between tiers happens without warning in '
          + 'a layout somebody else built. One that is a different shape reflows whatever it sits in and reads '
          + 'as a second logo rather than the same one, simplified.',
        how: `Draw ${r.file} to the mark's proportion and let the detail be what changes.` });
    }
  }

  // Every rung has to take the colourways.
  const masterSlots = project.assets.mark ? svgu.slotsUsed(svgu.parse(project.assets.mark.source)) : [];
  for (const r of list) {
    if (r.kind !== 'tier' || !r.slots) continue;
    const missing = masterSlots.filter((sl) => r.slots.indexOf(sl) < 0);
    if (!missing.length) continue;
    findings.push({ level: 'warning', code: 'ladderSlots',
      what: `the ${r.name} tier paints ${r.slots.length ? r.slots.join(', ') : 'nothing'} where the master `
        + `paints ${masterSlots.join(', ')}: ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} missing from it.`,
      why: 'A colourway names a colour per slot. A rung that does not carry a slot keeps whatever it was drawn '
        + 'in, so at the size that rung takes over, the mark stops following the colourway and nothing in the '
        + 'package says why.',
      how: `Mark the same parts in ${r.file} with data-slot="${missing[0]}" as the master does.` });
  }
  return findings;
}

module.exports = { load, rungs, bands, check, measureOne };
