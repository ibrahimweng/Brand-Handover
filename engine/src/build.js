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

// Every key a project may set that something actually reads. The suite audits
// the fixtures against this, and kept its own copy of it — so a key added here
// was missing there, and the audit failed on a project that was correct. Two
// lists of one thing is the defect this engine keeps finding in other people's
// code; it was in the check itself.
const KEYS_READ = {
  rules: ['clearSpaceRatio', 'minStrokePx', 'minStrokeMm', 'lockupGapRatio', 'wordmarkHeightRatio',
    'naming', 'lockups', 'formats', 'pngWidths', 'stock', 'colourways', 'iconInk', 'iconBg',
    'iconSizes', 'faviconSizes', 'social', 'partners', 'documents', 'ladder'],
  system: ['icons', 'icon', 'pattern', 'motion', 'photography', 'nameSetting', 'grid'],
  // tokens was outside this audit entirely, so a whole branch of a project file
  // could be written, saved and shipped without anything reading it. The
  // twenty-fourth round added tokens.sets and the engine accepted it in
  // silence — the same silence the audit exists to break.
  tokens: ['colour', 'type', 'sets'],
};

// What the palette looks like to somebody who does not see it the way you do.
//
// Everything this engine has ever said about accessibility is a WCAG contrast
// ratio, which is a ratio of luminance. It is the right measure for text on a
// ground and it says nothing at all about whether two colours can be told from
// each other, because the thing that separates most pairs is hue and hue is
// what a colour vision deficiency takes away. See src/vision.js.
function visionFindings(project, rules, warnings, notes, carry) {
  const V = require('./vision');
  const colours = project.tokens.colour || {};
  const floor = Number(rules.minColourSeparation) > 0 ? Number(rules.minColourSeparation) : 12;
  const found = V.collapses(colours, floor);
  if (carry) {
    carry.separation = floor;
    carry.collapses = found.map((f) => ({ pair: f.pair, hex: f.hex, normal: f.normal,
      worst: f.worst, seen: Object.fromEntries(Object.entries(f.seen).map(([k, v]) => [k, v.distance])) }));
    carry.sets = Object.entries(project.sets || {}).map(([name, set]) => ({
      name, of: set.of, why: set.why, apartBy: set.apartBy || null,
      toldApartByColourAlone: !(set.apartBy && set.of.every((c) => set.apartBy[c])) }));
  }
  const byPair = new Map(found.map((f) => [f.pair.slice().sort().join('/'), f]));
  const blockers = [];

  // A set is a promise that these are read together and told apart. Break it
  // and the identity does not work — not for a minority of readers in some
  // situations, but for one man in sixteen every time the thing is used.
  for (const [name, set] of Object.entries(project.sets || {})) {
    const hits = [];
    for (let i = 0; i < set.of.length; i++) {
      for (let j = i + 1; j < set.of.length; j++) {
        const key = [set.of[i], set.of[j]].sort().join('/');
        if (byPair.has(key)) hits.push(byPair.get(key));
      }
    }
    if (!hits.length) continue;
    const covered = set.apartBy && set.of.every((c) => set.apartBy[c]);
    const list = hits.map((h) => `${h.pair.join(' and ')} (${h.hex.join(' and ')}) go from `
      + `${h.normal} apart to ${h.worst.distance} for ${V.say(h.worst.kind)}, ${V.howMany(h.worst.kind)}`).join('; ');
    if (covered) {
      notes.push(`in the "${name}" set, ${list}. That is carried by ${set.of.map((c) => `${c}, which is also `
        + `${set.apartBy[c]}`).join('; ')} — so nothing in the set is told apart by colour alone, and the `
        + 'collapse costs a reader nothing.');
    } else {
      blockers.push({ level: 'blocker', code: 'colourVision',
        what: `the "${name}" set is told apart by colour alone, and ${hits.length === 1 ? 'one of its pairs is' : `${hits.length} of its pairs are`} `
          + `the same colour to some readers: ${list}.`,
        why: `${set.why} None of that reaches a reader who cannot separate those two, and nothing else in `
          + 'the set distinguishes them: no shape, no symbol, no fill, no word. A contrast ratio does not '
          + 'catch this — every one of these colours passes against the ground it sits on. Luminance is what '
          + 'WCAG measures and hue is what is missing.',
        how: `Give every colour in the set a second channel and say what it is, in tokens.sets.${name}.apartBy `
          + '— { "clear": "an open ring", "prepare": "a half ring", "act": "a solid disc" }. Moving the two '
          + 'colours further apart is the other answer and a harder one: they have to stay apart for all '
          + 'three kinds at once and still be the colours the organisation is known by.' });
    }
  }

  // The rest of the palette is a note. Two colours that collapse are only a
  // fault if something depends on telling them apart, and most pairs in most
  // palettes never appear side by side. Say what is true and let the designer
  // decide which pairs matter — that is what tokens.sets is for.
  const loose = found.filter((f) => !Object.values(project.sets || {}).some((set) =>
    set.of.indexOf(f.pair[0]) > -1 && set.of.indexOf(f.pair[1]) > -1));
  if (loose.length) {
    notes.push(`${loose.length === 1 ? 'one pair in this palette separates' : `${loose.length} pairs in this palette separate`} `
      + `for most readers and not for all: ${loose.map((f) => `${f.pair.join('/')} ${f.normal} to `
        + `${f.worst.distance} for ${V.say(f.worst.kind)}`).join(', ')}. `
      + 'Every one of them passes its contrast checks, because contrast is luminance and this is hue. '
      + 'Nothing here says these pairs carry a meaning — if any of them does, name them in tokens.sets and '
      + 'the engine will hold them to it.');
  }

  // A gradient between two colours that somebody cannot separate is a flat fill
  // to that reader. Vesper's runs ember to flare to dusk, and to a protanope the
  // second half of it does not move.
  for (const asset of [project.assets.mark, project.assets.wordmark]) {
    if (!asset || !asset.source) continue;
    for (const g of svgu.gradients(svgu.parse(asset.source)) || []) {
      const id = g.id || g.kind;
      const stops = (g.stops || []).map((st) => st.hex).filter(Boolean);
      for (let i = 0; i + 1 < stops.length; i++) {
        const got = V.apart(stops[i], stops[i + 1]);
        if (got.normal < floor || got.worst.distance >= floor) continue;
        warnings.push(`the gradient "${id}" runs from ${stops[i]} to ${stops[i + 1]}, and to `
          + `${V.say(got.worst.kind)} — ${V.howMany(got.worst.kind)} — those two are the same colour `
          + `(${got.worst.distance} apart, where they are ${got.normal} apart to you). That length of the `
          + 'gradient is a flat fill to them: it does not travel, and whatever the movement was doing is not '
          + 'happening. Move one of the stops, or put a third between them that all three kinds can see.');
      }
    }
  }
  return blockers;
}

// What a pair says that neither half does. Every one of these is a number the
// partner's own manual does not contain and ours did not either, because until
// there were two marks in one file there was nothing to measure it on.
function partnerFindings(project, prule, made, measured, rules, floors) {
  const out = [];
  const cut = rules.colourways.map((c) => c.name);
  for (const partner of project.partners) {
    const missing = cut.filter((c) => !partner.versions[c]);
    if (missing.length) {
      out.push(`there is no ${partner.name} lockup in ${missing.join(' or ')}, because `
        + `${partner.owner} has not supplied a version of their mark for ${missing.length > 1 ? 'those grounds' : 'that ground'}. `
        + 'This is not a fault and there is nothing in this package that can fix it: recolouring somebody '
        + `else's mark to fit our palette is the one thing a partner lockup may never do. Ask ${partner.owner} `
        + `for their ${missing.join(' and ')} version, or say in the manual that the pair is not used there.`);
    }
    for (const [way, v] of Object.entries(partner.versions)) {
      if (v.slots.length) {
        out.push(`${partner.name}'s ${v.file} marks ${v.slots.length === 1 ? 'a part' : 'parts'} with `
          + `data-slot (${v.slots.join(', ')}), which in our own artwork means "paint this from the colourway". `
          + 'It is ignored here. Their file is placed exactly as they supplied it, because the version of '
          + 'their mark that goes on a given ground is their decision and not a colour we may compute.');
      }
      const ground = (project.tokens.colour[(rules.colourways.find((c) => c.name === way) || {}).on] || {}).hex;
      if (!ground) continue;
      // Asked of the whole mark, not of each colour in it. Ingleby's sail is
      // white and sits inside their blue disc, where white is exactly right;
      // testing every ink against our ground said their mark disappeared into
      // a page it reads on perfectly well. A mark has a silhouette as long as
      // one of its colours reads, and it is gone when none of them does.
      const best = v.inks.map((h) => contrast.ratio(h, ground)).sort((a, b) => b - a)[0] || 1;
      if (v.inks.length && best < 1.6) {
        out.push(`${partner.name}'s ${way} version paints ${v.inks.join(', ')}, and the closest of those to the `
          + `${(rules.colourways.find((c) => c.name === way) || {}).on} ground we would put it on is `
          + `${best.toFixed(2)} to 1. Nothing in their mark separates from our page, so the pair is our lockup `
          + 'beside a blank. They will have another version for exactly this ground; ask for it.');
      }
    }
  }
  // the floor of a pair, which is neither brand's own
  const ours = (floors[prule.with] || measured.minimumSize).screenPx;
  for (const m of made) {
    if (m.floor.screenPx <= ours * 1.05) continue;
    out.push(`the ${m.partner.name} pair in ${m.colourway} holds at ${m.floor.screenPx} px / `
      + `${m.floor.printMm} mm, where ${prule.with} on its own holds at ${ours} px. The floor of a pair is set `
      + `by whichever of the two disappears first, and here it is ${m.floor.setBy}: `
      + `${m.floor.parts.map((p) => `${p.label} ${p.screenPx} px`).join(', ')}. Neither manual contains this `
      + `number — theirs states their mark alone and ours states ours — so a pair placed at our own figure is `
      + `${(m.floor.screenPx / ours).toFixed(1)} times too small.`);
  }
  // and the optical question, which the engine cannot answer and can measure
  const byPartner = new Map();
  for (const m of made) if (!byPartner.has(m.partner.name)) byPartner.set(m.partner.name, m);
  for (const m of byPartner.values()) {
    const ratio = m.composed.partnerBox.w / (m.composed.width - m.composed.partnerBox.w);
    if (ratio > 1.6) {
      out.push(`matched on ${prule.match}, ${m.partner.name}'s mark is ${ratio.toFixed(1)} times the width of `
        + `everything else in the pair, so the lockup reads as their artwork with ours attached. Matching two `
        + `marks on one measurement is the convention and it is only ever a starting point; a logotype beside a `
        + `symbol is the case it fails on. Set rules.partners.matchRatio below 1 to bring them down, or `
        + `"match": "width" to size them across instead.`);
    }
  }
  return out;
}

// A key the engine does not read is a setting the designer wrote and the engine
// ignored. system.icon does nothing, because the engine reads system.icons;
// clearspaceRatio does nothing, because it is clearSpaceRatio. In both cases the
// manual quietly shows the default and there is no way to tell from the outside
// that anything was dropped. rules, system and tokens are checked: content is
// the designer's own prose and none of the engine's business.
//
// It lives out here, and is exported, because the suite audits every fixture in
// the repository the same way. It used to read the engine's key list — the
// twenty-first round's fix — and keep its own copy of which object each section
// names, which is the same defect one level down: adding tokens as a third
// section sent it looking in project.system, and it failed on a project that
// was right. One implementation, called twice.
const SECTION = {
  rules: (p) => p.rules,
  system: (p) => p.system || {},
  tokens: (p) => p.tokens || {},
};

function unreadKeys(project) {
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
  const out = [];
  for (const [where, allowed] of Object.entries(KEYS_READ)) {
    const obj = SECTION[where](project) || {};
    for (const key of Object.keys(obj)) {
      if (allowed.indexOf(key) > -1) continue;
      const guess = nearest(key, allowed);
      out.push(`${where}.${key} is set, and nothing reads it`
        + (guess ? `. Did you mean ${where}.${guess}?` : '.')
        + ' Whatever you meant it to change is still on its default.');
    }
  }
  return out;
}

async function build(project, outDir, { log = () => {}, licence = null } = {}) {
  const measured = measure(project);
  log(`measured the master: ink ${measured.markInk.w} × ${measured.markInk.h}, ` +
      `clear space ${measured.clearSpace}, floor ${geo.floorText(measured.minimumSize, 'px')} / ${geo.floorText(measured.minimumSize, 'mm')}`);

  const { rules } = project;
  // Derived once, here, because everything it needs is already in hand. It used
  // to be worked out three hundred lines further down, next to the first thing
  // that happened to want it, and reaching for it any earlier threw "cannot
  // access sys before initialization" — the fourth time in this file that a
  // derivation living beside its first reader rather than beside its inputs has
  // cost a build. Read the project, derive from it, then write: in that order.
  const system = require('./system');
  const sys = system.resolve(project, measured);
  // one floor per lockup, because a floor belongs to a drawing and there are
  // four of them in this package. See variants.floors.
  const floors = require('./variants').floors(project, measured);
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
    // One path, one entry. Skerry ships one file for two roles — the same face
    // is both the display and the text family — so 09-type/skerry-sans-regular
    // was written twice and counted twice, and every count taken off this list
    // said the package held one more file than it does. The list is what the
    // asset index, brand.json and the canvas all read; a name in it twice is a
    // package that cannot describe itself.
    const seen = written.findIndex((w) => w.path === rel);
    if (seen > -1) written[seen] = { path: rel, bytes: data.length };
    else written.push({ path: rel, bytes: data.length });
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

  for (const w of unreadKeys(project)) warnings.push(w);

  const saidMissing = new Set();
  const saidMissingTier = new Set();
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

  // Asked before anything is written, because it can stop the build.
  const vision = {};
  const visionBlockers = visionFindings(project, rules, warnings, notes, vision);
  if (visionBlockers.length) {
    const e = new Error(visionBlockers[0].what);
    e.findings = visionBlockers;
    throw e;
  }

  // The master's floor is the one every package has stated, and it is the floor
  // of one of the four drawings in it. Say which of the others need more.
  const overFloor = Object.entries(floors)
    .filter(([, f]) => f.screenPx > measured.minimumSize.screenPx * 1.05)
    .sort((a, b) => b[1].screenPx - a[1].screenPx);
  if (overFloor.length) {
    // A note, not a warning. It is true of every identity that has a logotype
    // beside its mark, there is nothing in the artwork to fix, and the package
    // now states each figure where it belongs. Warning about geometry on every
    // project in the repository is how a report stops being read.
    notes.push(`${overFloor.length === 1 ? 'one lockup does' : `${overFloor.length} of the lockups do`} not `
      + `hold at ${geo.floorText(measured.minimumSize, 'px')}, which is the floor for `
      + `${measured.master === 'wordmark' ? 'the logotype' : 'the mark'} alone: `
      + `${overFloor.map(([l, f]) => `${l} needs ${geo.floorText(f, 'px')}`).join(', ')}. `
      + `A lockup sets the name beside the mark at a fraction of its height, so it is wider than the mark and `
      + `its finest part is finer, and both put the floor up. Every folder carries its own figure now, and `
      + `brand.json has them all.`);
  }

  // ---- the ladder: which drawing at which size ----
  //
  // A floor answers "how small may this go". A ladder answers the question that
  // follows it, which is the one a client actually has: "and below that?" See
  // src/ladder.js.
  const LAD = require('./ladder');
  let ladder = null;
  if ((rules.ladder || []).length) {
    const list = LAD.rungs(project, measured, floors);
    for (const f of LAD.check(list, project)) {
      if (f.level === 'blocker') { const e = new Error(f.what); e.findings = [f]; throw e; }
      warnings.push(`${f.what} ${f.why} ${f.how}`);
    }
    ladder = { rungs: list, bands: LAD.bands(list) };
    for (const r of list) {
      if (r.kind !== 'tier') continue;
      for (const colourway of rules.colourways) {
        const doc = svgu.parse(r.source);
        const { missing } = svgu.applyColourway(doc, colourway.slots);
        if (missing.length && !saidMissingTier.has(`${r.name}:${colourway.name}`)) {
          saidMissingTier.add(`${r.name}:${colourway.name}`);
        }
        const svg = svgu.serialize(doc);
        const base = naming.fileName(rules.naming, { brand: project.latinName, lockup: r.name, colourway: colourway.name });
        if (rules.formats.includes('svg')) write(`12-ladder/${base}.svg`, svg);
        if (rules.formats.includes('png')) {
          for (const w of rules.pngWidths) write(`12-ladder/${base}-${w}.png`, geo.renderPng(svg, w));
        }
      }
    }
    // The bottom rung is the identity's real floor, and everything the package
    // said about "the smallest usable size" was about the top of the ladder.
    const bottom = list[list.length - 1];
    notes.push(`this identity steps down through ${list.length} drawings rather than stopping at one: `
      + `${ladder.bands.map((b) => `${b.name} ${b.to == null ? `${b.from} px and up` : `${b.from}–${b.to} px`}`).join(', ')}. `
      + `The mark alone holds at ${measured.minimumSize.screenPx} px and the identity holds at `
      + `${bottom.minimumSize.screenPx} px, because below ${measured.minimumSize.screenPx} px it is `
      + `${bottom.name === list[1].name ? 'a simpler drawing' : 'simpler drawings'} rather than a smaller one.`);
  }

  // ---- the pairs: our lockup, a rule, and somebody else's mark ----
  //
  // Everything above this line was cut from one master and is the client's to
  // do as they like with. A partner lockup is the first thing in this package
  // that is half somebody else's, and almost every rule the engine applies
  // elsewhere is wrong here: their artwork is not recoloured into a colourway,
  // not redrawn to fix its faults, and not substituted for one of their other
  // versions when the one asked for is missing. What is left is measuring, and
  // measuring is where the pair stops behaving like either of its halves.
  const partnerLockups = [];
  if ((project.partners || []).length) {
    const PT = require('./partners');
    const prule = PT.rules(project);
    for (const partner of project.partners) {
      for (const colourway of rules.colourways) {
        const v = partner.versions[colourway.name];
        if (!v) continue;                       // said once, below, with the reason
        const host = buildVariant({
          markSrc: project.assets.mark && project.assets.mark.source,
          wordmarkSrc: project.assets.wordmark && project.assets.wordmark.source,
          lockup: prule.with, colourway, rules, measured,
        });
        const composed = PT.lockup({ hostSvg: host.svg, hostInk: host.box, partner,
          way: colourway.name, rule: prule, ink: Object.values(colourway.slots)[0] || '#000000' });
        const fl = PT.floor(composed, host.svg, partner, colourway.name, project);
        const base = `${naming.slug(project.latinName)}-${naming.slug(partner.name)}-${naming.slug(colourway.name)}`;
        if (rules.formats.includes('svg')) write(`11-partners/${base}.svg`, composed.svg);
        if (rules.formats.includes('png')) {
          for (const w of rules.pngWidths) write(`11-partners/${base}-${w}.png`, geo.renderPng(composed.svg, w));
        }
        partnerLockups.push({ partner, colourway: colourway.name, ground: colourway.on,
          file: `11-partners/${base}.svg`, composed, floor: fl, svg: composed.svg });
      }
    }
    for (const w of partnerFindings(project, prule, partnerLockups, measured, rules, floors)) warnings.push(w);
  }

  // ---- icons, favicons and social crops, all cut from the same master ----
  // icons are cut from the master, which for a logotype identity is the
  // logotype: there is no symbol to cut
  // A detailed mark cannot be an icon, and the engine has been saying so since
  // the thirteenth round: "draw a simplified icon mark — fewer parts, heavier
  // strokes". A project could not carry the answer. assets.icon was loaded,
  // normalised and then ignored, so the file the advice asked for was checked
  // by `check --icon` and used by nothing. Icons are cut from it where there is
  // one, and from the master where there is not.
  // Icons are the mark at the smallest sizes anything uses it, so where an
  // identity has said which drawing it uses down there, that is the drawing
  // they are cut from. assets.icon is the same answer for an identity with one
  // alternative rather than a ladder of them, and it still wins where it is set.
  const bottomRung = ladder && ladder.rungs.length
    ? ladder.rungs[ladder.rungs.length - 1] : null;
  const iconArt = project.assets.icon
    || (bottomRung && bottomRung.kind === 'tier' ? { source: bottomRung.source, path: bottomRung.file } : null)
    || masterOf(project);
  const iconSource = iconArt.source;
  const iconFrom = path.basename(iconArt.path || masterOf(project).path);
  // and the floor is measured off whatever the icons are actually cut from
  const iconMeasured = iconArt === masterOf(project) ? measured
    : { markInk: geo.inkBox(iconSource), minimumSize: geo.minimumSize(iconSource, rules) };
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
    const svg = exp.iconSquare(iconSource, { size, background: iconBg, ink: iconInk, radius: 0.22 });
    write(`05-icons/icon-${size}.png`, geo.renderPng(svg, size));
  }
  for (const size of rules.faviconSizes || []) {
    const svg = exp.iconSquare(iconSource, { size, background: iconBg, ink: iconInk });
    const png = geo.renderPng(svg, size);
    write(`05-icons/favicon-${size}.png`, png);
    favPngs.push({ size, data: png });
  }
  if (favPngs.length) write('05-icons/favicon.ico', exp.ico(favPngs));
  // What the package documents and what it contains have to be the same list.
  // brand.json carried a full icon specification — box, stroke, curve radius —
  // for a package with no icons in it, and the manual kept its chapter on the
  // grid, because `rules.iconSizes || []` skipped silently when nothing named
  // the sizes. The rule has a default now; this is the check that the next
  // thing of this kind does not get to be silent either.
  if (!written.some((f) => /^05-icons\//.test(f.path))) {
    warnings.push('no icons were written, because rules.iconSizes and rules.faviconSizes are both empty. '
      + 'brand.json still carries the icon grid the mark derives, so anybody reading it will expect files '
      + 'that are not there. Set the sizes, or say plainly in the handover that icons are somebody else\'s job.');
  }
  // A construction grid is a claim, and this is the first time anything has
  // checked it. Every drawing the identity says is built on the module is asked
  // whether it is: the master, and every rung of the ladder.
  if (sys.grid) {
    const drawings = [[path.basename(masterOf(project).path), masterOf(project).source]]
      .concat((project.tiers || []).map((t) => [t.file, t.source]));
    for (const [name, src] of drawings) {
      const g = system.offGrid(src, sys.grid.unit);
      if (!g.off.length) continue;
      warnings.push(`${name} says it is built on a ${sys.grid.unit} unit module and `
        + `${g.off.length} of its ${g.total} points ${g.off.length === 1 ? 'is' : 'are'} not on it: `
        + `${g.off.slice(0, 4).map((o) => `${o.x},${o.y} is ${o.by} out`).join(', ')}`
        + `${g.off.length > 4 ? `, and ${g.off.length - 4} more` : ''}. `
        + 'The manual draws that module over the artwork and says the mark was built on it, which is a claim '
        + 'about every point in the drawing. Move them onto the module, or take system.grid out and the '
        + 'diagram goes back to showing the box rather than a grid nothing was built on.');
    }
  }

  // A mark drawn in one weight hands the icon grid that weight and there is
  // nothing to say. A mark drawn in several hands it one of them, and which one
  // is a decision the engine has just made on the designer's behalf.
  const mw = sys.icons.derivedFrom.markWeights;
  if (mw && !((project.system || {}).icons || (project.system || {}).icon || {}).stroke) {
    warnings.push(`the master is drawn in ${mw.length} weights (${mw.join(', ')}), and an icon grid has one. `
      + `The icons are cut at ${sys.icons.stroke} on a ${sys.icons.box} box, from the ${mw[mw.length - 1]} the `
      + `mark carries its shape in, not the ${mw[0]} of its finest detail — an icon set at the finer one comes `
      + `out at half the weight of the mark it belongs to. If the fine weight is the one you want the icons to `
      + `look like, set system.icons.stroke and the grid follows it.`);
  }
  const icons = exp.iconFloor(iconMeasured, rules) || { thinIcons: [], thinFavicons: [], clears: [] };
  if (icons.thinIcons.length) {
    const list = icons.thinIcons.map((t) => `${t.name} at ${t.at} px`).join(', ');
    warnings.push(`${icons.thinIcons.length} app icon`
      + `${icons.thinIcons.length > 1 ? 's were' : ' was'} written where the thinnest part of the mark `
      + `paints under the ${rules.minStrokePx} px this project sets as the thinnest a stroke may go: `
      + `${list}. They are in the package because the sizes were asked for, but the mark will read as `
      + `a smudge at them: this artwork needs ${icons.smallest} px square before it holds together`
      + `${icons.clears.length ? `, so only ${icons.clears.join(' and ')} come out of it clean` : `, and nothing asked for is that big`}. `
      + (icons.squarish
        ? `Draw a simplified icon mark — fewer parts, heavier strokes — run `
          + `\`check <icon.svg> --icon\` against it, which measures the same thing and will say when it `
          + `clears, and set it as assets.icon so the package is cut from it.`
        : `The shape is the reason: this artwork is ${icons.aspect} times longer than it is deep, and an `
          + `icon is square, so it is drawn to fit its longest side and fills ${icons.coverage}% of the `
          + `square where a square mark fills about 46%. No amount of thickening fixes that. Draw a `
          + `device for square places — a monogram, an initial, the part of the mark that stands alone — `
          + `run \`check <icon.svg> --icon\` against it, and set it as assets.icon.`));
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
      ? exp.iconSquare(iconSource, { size: spec.w, background: iconBg, ink: iconInk, radius: spec.round ? 0.5 : 0 })
      : exp.banner(iconSource, { width: spec.w, height: spec.h, background: iconBg, ink: iconInk });
    write(`06-social/${naming.slug(name)}-${spec.w}x${spec.h}.png`, geo.renderPng(svg, spec.w));
  }

  // ---- contrast is computed, never typed ----
  const pairs = contrast.matrix(project.tokens.colour || {});

  // ---- rule blocks: one decision each, every instance cut from it ----
  const pattern = require('./pattern');
  const rolesOf = (pr) => {
    const out = {};
    for (const [n, c] of Object.entries(pr.tokens.colour || {})) if (c.role) out[c.role] = { name: n, ...c };
    return out;
  };
  const ways = [];
  for (const cw of rules.colourways) {
    const ink = Object.values(cw.slots)[0];
    ways.push({ name: cw.name, ink, on: cw.on && (project.tokens.colour[cw.on] || {}).hex || '#FFFFFF' });
  }
  // ---- the photographs the project ships, as given and as the rules treat them ----
  // A brand package should contain the art directed pictures the identity is
  // built on. Until now the only way one could reach the engine was somebody
  // dropping it into the editor, so no package had ever contained one and the
  // manual's photography page had nothing to show but a grey ramp.
  const photoRules = sys.photography;
  for (const ph of project.photography || []) {
    const base = naming.slug(path.basename(ph.file).replace(/\.[a-z0-9]+$/i, ''));
    const ext = path.extname(ph.file).toLowerCase().replace('.', '');
    write(`08-photography/${base}.${ext}`, Buffer.from(ph.src.split(',')[1], 'base64'));
    if (photoRules && photoRules.declared) {
      const treated = exp.treatPhoto(ph, photoRules, { colours: project.tokens.colour, roles: rolesOf(project) });
      if (treated) write(`08-photography/${base}-treated.png`, treated);
    }
    if (ph.w < 1200) {
      warnings.push(`${ph.file} is ${ph.w} by ${ph.h}. A photograph placed across a page at `
        + `300 dpi wants about 2500 across, so this one can go about a third of the way. `
        + `It is in the package because you put it there; use it small, or supply a larger file.`);
    }
  }

  // ---- the typeface, where the identity ships one ----
  // A client who is handed webfonts needs the files and needs to be told what
  // they may do with them, because a licence is the half of a typeface that is
  // not in the file.
  const TF = require('./typeface');
  for (const fam of project.fonts || []) {
    for (const f of fam.files) {
      write(`09-type/${path.basename(f.file)}`, Buffer.from(f.src.split(',')[1], 'base64'));
      if (f.bytes > 400 * 1024) {
        warnings.push(`${path.basename(f.file)} is ${Math.round(f.bytes / 1024)} KB, and every document `
          + `carries it inline. Subset the face to the characters the brand actually sets, or the manual, `
          + `the deck and the canvas each grow by that much.`);
      }
    }
  }
  if ((project.fonts || []).length) {
    const terms = project.fonts.filter((f) => f.licence)
      .map((f) => `${f.family}\n  ${f.licence}`).join('\n\n');
    write('09-type/LICENCE.txt', `The typefaces in this folder\n`
      + `${'='.repeat(27)}\n\n`
      + `These files are part of the identity and are supplied with it. A typeface\n`
      + `is licensed, not owned, and the terms below travel with the files.\n\n`
      + (terms || 'No terms were stated in the project. Ask whoever supplied the typeface\n'
        + 'before putting it on a website or passing it on.') + '\n');
    notes.push(`the ${project.fonts.length === 1 ? 'typeface is' : 'typefaces are'} in 09-type, `
      + `with the licence terms beside them, and inlined in every document so nothing has to be installed to read one.`);
  }
  // A face named in the tokens that is neither hosted nor shipped will be asked
  // for by name and silently replaced by the fallback, while the manual's
  // specimen page goes on saying it is the face. Nothing said so for sixteen
  // rounds, because every fixture happened to use a font Google hosts.
  for (const miss of TF.unreachable(project.tokens.type, project.fonts)) {
    warnings.push(`the ${miss.role} typeface is "${miss.family}", and nothing can fetch it: it is not `
      + `marked "google": true and no files are listed for it. Every document will name it and set `
      + `${miss.fallback ? miss.fallback.split(',')[0] : 'whatever the reader happens to have'} instead, `
      + `including the specimen page that is meant to prove what it looks like. Add "files" to the family `
      + `with the webfont you are licensed to ship, or "google": true if it is served from there.`);
  }

  // the pattern is cut from the master, which is not the drawing icons come from:
  // `mark` here used to mean both, and started meaning the monogram the moment a
  // ladder could say which drawing is used at icon sizes. Fathom's whole identity
  // is its pattern; it would have been cut from the wrong file and nothing would
  // have said so.
  const gen = pattern.everyTile(masterOf(project).source, sys.pattern, ways, pairs);
  if (gen.ok) {
    for (const t of gen.tiles) {
      write(`07-pattern/pattern-${naming.slug(t.density)}-${naming.slug(t.colourway)}.svg`, t.tile);
    }
    for (const r of gen.refused) warnings.push(`pattern ${r.density} in ${r.colourway} was not written. ${r.why}`);
  } else {
    warnings.push(`no pattern was written. ${gen.why} ${gen.how}`);
  }

  // A page in the package that lists the package has to list all of it. The
  // bundle was built from what had been written so far, which is everything
  // except the documents themselves, the read me's companions and the zip —
  // so an asset index laid out by a designer reported 45 files in a package
  // of 57 and did not mention the folder its own page was in. Every name
  // still to come is known here; only the sizes are not, and nothing in the
  // index reads a size.
  //
  // It is worked out here rather than beside the bundle that first read it,
  // because brand.json needs it too: `written.length + 1` counted what had been
  // written when brand.json was written, so every package ever built has told
  // whoever read it that it holds eight or ten fewer files than it does —
  // Tarnbrook said 34 of 43 — and the one file whose job is to be read by
  // software was wrong about the size of the thing it describes.
  const pending = ['README.txt', 'brand.json'].concat(project.previous ? ['CHANGES.txt'] : [])
    .concat(rules.documents === false ? [] : ['guidelines.html', 'deck.html', 'editor.html', 'document.json',
      'published.html', 'usage.json', 'LICENCE.txt', `${naming.slug(project.latinName)}-brand-package.zip`]
      .concat((project.documents || []).flatMap((d) => {
        const slug = naming.slug(d.name) || naming.slug(path.basename(d.file, '.json')) || 'piece';
        return [`10-documents/${slug}.html`, `10-documents/${slug}.json`];
      })))
    .map((f) => ({ path: f, bytes: 0 }));
  // written so far plus what is still to come, with nothing counted twice —
  // asked at any point in the build and giving the same answer every time.
  const wholePackage = () => written.concat(pending.filter((f) => !written.some((w) => w.path === f.path)));

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
      // The floor above is the master's. This is every drawing in the package,
      // because a client places a lockup, not a master, and no two of them
      // disappear at the same size.
      minSizes: Object.fromEntries(Object.entries(floors).map(([l, f]) => [l, {
        screenPx: f.screenPx, printMm: f.printMm, screenPxHigh: f.screenPxHigh, printMmHigh: f.printMmHigh,
        squarish: f.squarish, from: f.from, width: f.thinnestStroke, basis: f.basis,
      }])),
      // Which drawing at which size. A floor says how small one drawing goes;
      // this says what happens below it, all the way down. See src/ladder.js.
      ladder: ladder ? ladder.bands.map((b, i) => ({
        rung: b.name, kind: b.kind, fromPx: b.from, toPx: b.to,
        fromMm: b.printFrom, toMm: b.printTo,
        parts: ladder.rungs[i].parts,
        file: ladder.rungs[i].kind === 'tier' ? `12-ladder/${naming.fileName(rules.naming,
          { brand: project.latinName, lockup: b.name, colourway: rules.colourways[0].name })}.svg`
          : `${naming.folderFor(b.name)}/`,
        note: ladder.rungs[i].note || null,
      })) : null,
      lockups: rules.lockups,
      colourways: rules.colourways.map((c) => c.name),
      // Half of each of these is not ours. See src/partners.js.
      partners: partnerLockups.length ? project.partners.map((pt) => ({
        name: pt.name, owner: pt.owner, since: pt.since, approved: pt.approved,
        colourways: pt.colourways,
        missing: rules.colourways.map((c) => c.name).filter((c) => !pt.versions[c]),
        lockups: partnerLockups.filter((m) => m.partner.name === pt.name).map((m) => ({
          colourway: m.colourway, file: m.file, scale: m.composed.scale,
          minSize: { screenPx: m.floor.screenPx, printMm: m.floor.printMm, setBy: m.floor.setBy,
            parts: m.floor.parts },
        })),
      })) : null,
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
    // Contrast above is luminance, and answers whether text can be read on a
    // ground. This answers a different question that nothing here had ever
    // asked: whether two of these colours can be told from each other. See
    // src/vision.js. Distances are CIE ΔE*ab; the simulation is Viénot 1999.
    colourVision: {
      separation: vision.separation,
      note: `two colours less than ${vision.separation} ΔE apart cannot be reliably told apart side by side`,
      collapses: vision.collapses,
      sets: vision.sets,
    },
    system: {
      // A name that is set rather than drawn is a rule, and rules go in here
      nameSetting: project.nameSetting ? {
        family: project.nameSetting.family, weight: project.nameSetting.weight,
        heightRatio: project.nameSetting.heightRatio, tracking: project.nameSetting.tracking,
        transform: project.nameSetting.transform, setIn: project.nameSetting.drawn.family,
        note: 'the name is set in this face at this size beside the mark, not drawn. '
          + '04-wordmark is that setting outlined, so it needs no font to render.',
      } : null,
      icons: sys.icons,
      pattern: Object.assign({}, sys.pattern, { source: gen.ok ? 'the shape marked data-pattern in the master' : null }),
      motion: sys.motion,
      photography: sys.photography,
    },
    documents: (project.documents || []).map((d) => ({ name: d.name, pages: d.pages,
      size: (d.doc.page && d.doc.page.size) || 'slide-16x9' })),
    generated: { measuredFrom: path.basename(masterOf(project).path), iconsFrom: iconFrom,
      files: wholePackage().length,
      builtUnder: licence && licence.ok ? { plan: licence.licence.plan, fingerprint: lic0.fingerprint(licence.licence) } : null },
  };
  // The first time this engine reads a brand.json rather than writing one. The
  // comparison runs here because it needs the finished article: every number in
  // it is derived, and the derived ones are exactly the ones that move without
  // anybody touching them.
  let changes = null;
  if (project.previous) {
    const PREV = require('./previous');
    changes = PREV.compare(project.previous.data, brandJson);
    brandJson.changes = { since: project.previous.version.text, from: project.previous.file,
      entries: changes.map((c) => ({ kind: c.kind, code: c.code, what: c.what })) };
    const breaking = changes.filter((c) => c.kind === 'breaking');
    if (breaking.length) {
      warnings.push(`${breaking.length} change${breaking.length > 1 ? 's' : ''} since `
        + `${project.previous.version.text} retire${breaking.length > 1 ? '' : 's'} something the client already has: `
        + `${breaking.map((c) => c.code).join(', ')}. Nothing in the files they hold changes on its own, so both `
        + 'versions are in use at once and both look correct. CHANGES.txt says what each one costs and what to do.');
    }
    if (!changes.length) {
      warnings.push(`this package is version ${project.version} and the last one was `
        + `${project.previous.version.text}, and nothing brand.json can measure is different between them. `
        + 'A version that moves on its own asks everyone holding the old package to replace it for no reason. '
        + 'Either leave the version where it was, or say in CHANGES.txt what moved that this file cannot see.');
    }
  }
  write('brand.json', JSON.stringify(brandJson, null, 2));
  if (project.previous) {
    write('CHANGES.txt', require('./previous').changesText(project.previous.data, brandJson, changes));
  }

  // What each folder is for depends on what else the identity has. A wordmark
  // beside a symbol is the fallback below the mark's floor; a wordmark that is
  // the whole identity is the logo.
  const lockupLines = (lockups, assets) => {
    const alone = !assets.mark;
    // The mirror of the logotype case the thirteenth round fixed: a symbol that
    // stands on its own was still described as the thing you reach for "where
    // the name is already present", which is exactly backwards when there is no
    // name to be present anywhere.
    const symbolOnly = !!assets.mark && !assets.wordmark;
    const set = !!project.nameSetting;
    const why = {
      horizontal: 'the default. Use this unless the space is too narrow.',
      stacked: 'when the space is narrower than it is tall.',
      mark: symbolOnly
        ? 'the identity. There is no drawn name: this is the whole of it.'
        : 'avatars, app icons, and anywhere the name is already present.',
      wordmark: alone
        ? 'the logotype, which is the whole identity. Everything else is cut from it.'
        : set
          ? 'the name on its own, set in the network face and outlined here so it needs no font.'
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
    // …except the icons, when the identity has a drawing of its own for them.
    // The line above was flatly untrue as soon as one did, and a client seeing
    // icons that do not match the mark deserves to be told it is deliberate.
    ...(project.assets.icon ? [
      `The icons are the exception: they are cut from ${iconFrom}, which is the`,
      'simplified drawing this identity uses where the full mark would close up.',
      'That is deliberate, and the manual shows both.', ''] : []),
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
    // One figure, for twenty-three packages, measured off the master and printed
    // two lines under "01-horizontal — the default, use this unless the space is
    // too narrow". A lockup is a different drawing from the mark and disappears
    // at a different size. One line each.
    '  Smallest use    every folder has its own, because every folder is a',
    '                  different drawing:',
    ...rules.lockups.map((l) => `                    ${naming.folderFor(l).padEnd(15)} `
      + `${geo.floorText(floors[l], 'px')} on screen, ${geo.floorText(floors[l], 'mm')} in print`),
    ...(partnerLockups.length ? [
      '                  A pair with a partner holds at neither brand\'s figure.',
      '                  11-partners and the manual state each one.'] : []),
    `  Colourways      ${rules.colourways.map((c) => c.name).join(', ')}.`,
    // Every read me has printed one smallest size and stopped. Where an
    // identity says what happens below it, that is the useful half.
    ...(ladder ? [
      '  At every size    the mark steps down through simpler drawings rather',
      '                  than stopping. Use the one whose band the size falls in:',
      ...ladder.bands.map((b) => `                    ${b.name.padEnd(13)} `
        + `${b.to == null ? `${b.from} px and above` : `${b.from}–${b.to} px`}`
        + `${b.to == null ? '' : `, ${b.printFrom}–${b.printTo} mm`}`),
      `                  Below ${ladder.bands[ladder.bands.length - 1].from} px there is nothing. 12-ladder holds the drawings`,
      '                  that are not lockups; icons are cut from the last of them.',
    ] : []),
    // A contrast ratio is luminance. Whether two of these can be told apart is
    // a different question, and no read me had ever carried the answer.
    ...(vision.collapses && vision.collapses.length ? [
      '  Telling colours',
      `  apart          ${vision.collapses.length === 1 ? 'one pair separates' : `${vision.collapses.length} pairs separate`} for most readers and not for all:`,
      ...vision.collapses.map((c) => `                    ${c.pair.join(' and ')} — ${c.normal} apart, `
        + `${c.worst.distance} to a ${c.worst.kind.replace(/pia$/, 'pe')}`),
      '                  The manual shows the palette as each of them sees it.',
    ] : []),
    ...(Object.keys(project.sets || {}).length ? [
      ...Object.entries(project.sets).map(([n, set]) => `  ${n.padEnd(15)} ${set.of.join(', ')} are read together. `
        + `${set.apartBy ? 'Each also carries a shape or a word; never colour alone.' : 'Told apart by colour alone.'}`),
    ] : []), '',
    'brand.json holds all of the above in a form software can read.',
    // Twenty-one packages made that promise and nothing ever collected on it.
    // It is worth saying who does, because it changes what the file is for:
    // not a convenience, an input.
    ...(project.previous ? [
      `This package was built against the brand.json inside version ${project.previous.version.text},`,
      'which is how the engine knows what moved. CHANGES.txt is that list. Read it',
      'before using anything here: it says which of the files you already hold are',
      'no longer part of the identity, and what that costs.',
    ] : [
      'Keep it. The next version of this identity is built against it, and it is',
      'the only thing that can say what moved between the two.',
    ]), '',
  ].join('\n');
  write('README.txt', readme);

  // ---- the two documents, both reading this same project ----
  if (rules.documents !== false) {
    const docs = require('./documents');
    const { deck } = require('./documents/deck');
    const ctx = docs.context(project, measured, written.slice(), brandJson);
    // the manual is written before the bundle exists, so it keeps the list it
    // had; only the pages a designer lays out claim to index the whole package
    write('guidelines.html', docs.guidelines(ctx));
    write('deck.html', deck(ctx));
    const { editorHtml } = require('./editor/emit');
    const { bundle: mkBundle, starterDoc } = require('./editor/bundle');
    const EM = require('./editor/model');
    const { publish } = require('./editor/publish');
    const bu = mkBundle(project, measured, wholePackage());
    const document = starterDoc(bu);
    write('editor.html', editorHtml(project, measured, wholePackage()));
    // a document carries the photographs it uses, or it opens with empty slots
    const IMG = require('./editor/images');
    const keep = IMG.used(document);
    const carried = {};
    for (const id of keep) if (bu.images[id]) carried[id] = bu.images[id];
    write('document.json', JSON.stringify(
      Object.keys(carried).length ? Object.assign({}, document, { images: carried }) : document, null, 2));
    write('published.html', publish(document, bu, { title: 'Guidelines' }));

    // ---- the pieces the designer laid out ----
    // A generated cover is what the engine can make without being told
    // anything. The pieces an identity is actually delivered as — a poster, a
    // programme, a ticket — are laid out by a person, and until now there was
    // nowhere in a project to keep them, so they did not survive a rebuild.
    for (const d of project.documents || []) {
      const slug = naming.slug(d.name) || naming.slug(path.basename(d.file, '.json')) || 'piece';
      write(`10-documents/${slug}.html`, publish(d.doc, bu, { title: d.name }));
      write(`10-documents/${slug}.json`, JSON.stringify(d.doc, null, 2));
      // the same question asked of the cover, asked of the pages somebody drew
      for (const t of EM.overfullText(d.doc, project.tokens.type)) {
        warnings.push(`in "${d.name}", page ${t.page} ("${t.pageName}"): the ${t.style} text needs about `
          + `${t.lines} lines — ${t.needs} units against the ${t.has} its block has — so "${t.text}…" `
          + `runs past the bottom of it. Make the block ${t.over} units taller, or set it smaller.`);
      }
    }
    if ((project.documents || []).length) {
      notes.push(`the ${project.documents.length} piece${project.documents.length > 1 ? 's' : ''} laid out for this `
        + `identity ${project.documents.length > 1 ? 'are' : 'is'} in 10-documents, as pages to read and as `
        + `documents to open on the canvas: ${project.documents.map((d) => d.name).join(', ')}.`);
    }
    // A block is a rectangle somebody drew and the words are somebody's
    // writing, and nothing had ever asked whether the second fits the first.
    // On screen the surplus was swallowed; in print it ran through whatever was
    // underneath. Say which block, on which page, and by how much.
    for (const t of EM.overfullText(document, project.tokens.type)) {
      warnings.push(`on page ${t.page} ("${t.pageName}") the ${t.style} text needs about `
        + `${t.lines} lines — ${t.needs} units of height against the ${t.has} its block has — so `
        + `"${t.text}…" runs past the bottom of it and over whatever is below. Make the block `
        + `${t.over} units taller, or set it in a smaller step.`);
    }
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

module.exports = { build, KEYS_READ, unreadKeys };
