'use strict';
// Both documents read the same project and the same measurements. They are not
// one document in two shapes: the manual carries every value and edge case, and
// the deck holds one idea a slide. Only the layouts differ.
const b = require('./blocks');
const { shell } = require('./chrome');
const contrast = require('../contrast');
const { buildVariant } = require('../variants');

// Everything either document needs, gathered once.
function context(project, measured, files, brandJson) {
  const colours = project.tokens.colour || {};
  const byRole = (r) => Object.entries(colours).find(([, c]) => c.role === r);
  const pick = (r, fb) => { const e = byRole(r); return e ? { name: e[0], ...e[1] } : fb; };
  const primary = pick('primary', { name: 'ink', hex: '#111111' });
  const ground = pick('ground', { name: 'paper', hex: '#FFFFFF' });
  const accent = pick('accent', primary);
  const primaryColourway = project.rules.colourways.find((c) => c.name === primary.name) || project.rules.colourways[0];

  const variants = {};
  for (const l of project.rules.lockups) {
    for (const cw of project.rules.colourways) {
      variants[`${l}:${cw.name}`] = buildVariant({
        markSrc: project.assets.mark && project.assets.mark.source,
        wordmarkSrc: project.assets.wordmark && project.assets.wordmark.source,
        lockup: l, colourway: cw, rules: project.rules, measured,
      }).svg;
    }
  }
  // A document asks for a lockup in a colourway, and the colourway it wants may
  // not be one the project cuts: nothing says the ground colour has to be among
  // them. Falling back beats a document that will not build at all, and it beats
  // a document with a hole in it.
  const variantFor = (lockup, prefer) => variants[`${lockup}:${prefer}`]
    || variants[`${lockup}:${primaryColourway.name}`]
    || variants[Object.keys(variants).find((k) => k.startsWith(`${lockup}:`))]
    || variants[Object.keys(variants)[0]]
    || null;

  // What to call the thing. An identity with no symbol has a logotype, and a
  // manual for one that keeps saying "the mark" is describing something that
  // is not in the package.
  const noun = measured.master === 'wordmark' && !project.assets.mark ? 'logotype' : 'mark';

  // The rule blocks — the pattern, the photography treatment, the icon grid and
  // the motion — reached the canvas and brand.json and neither of the two
  // documents a client actually reads. Fathom's whole identity is its pattern
  // and its manual never mentioned one. Resolve them here so the manual and the
  // deck can say what they are.
  const system = require('../system').resolve(project, measured);
  // the photography rules name their colours the way a block does — by role or
  // by palette name — so the blocks that draw them need the same lookup the
  // canvas has
  const roles = {};
  for (const r of ['primary', 'ground', 'accent', 'secondary', 'neutral']) {
    const e = byRole(r);
    if (e) roles[r] = { name: e[0], ...e[1] };
  }
  const master = project.assets[measured.master || (project.assets.mark ? 'mark' : 'wordmark')];
  const ways = project.rules.colourways.map((cw) => ({
    name: cw.name, ink: Object.values(cw.slots)[0],
    on: (cw.on && (colours[cw.on] || {}).hex) || '#FFFFFF',
  }));
  const pattern = require('../pattern').everyTile(master.source, system.pattern, ways, null);
  const hasSystem = !!(pattern && pattern.ok && pattern.tiles.length) || !!system.photography.declared
    || !!system.icons || !!(project.system || {}).motion;
  // What moved since the last version, for the reader who has already built to
  // it. Worked out from the same two files the package compares — the previous
  // brand.json and this one — so the manual and CHANGES.txt cannot disagree.
  // A floor per lockup and a floor per pair, worked out from the same modules
  // the build uses, so the manual and the package cannot disagree about how
  // small anything may go.
  const floors = require('../variants').floors(project, measured);
  // Which drawing at which size, and what each of them looks like in the
  // colourway this document is set in. Worked out from the same module the
  // build uses, so the manual and the package cannot disagree.
  let ladder = null;
  if ((project.rules.ladder || []).length) {
    const LAD = require('../ladder');
    const list = LAD.rungs(project, measured, floors);
    const bands = LAD.bands(list);
    ladder = list.map((r, i) => Object.assign({}, bands[i], {
      parts: r.parts, note: r.note || null,
      svg: r.kind === 'tier'
        ? (() => { const d = require('../svg').parse(r.source);
          require('../svg').applyColourway(d, primaryColourway.slots); return require('../svg').serialize(d); })()
        : variants[`${r.name}:${primaryColourway.name}`] || null,
    }));
  }
  const pairs = [];
  if ((project.partners || []).length) {
    const PT = require('../partners');
    const prule = PT.rules(project);
    for (const partner of project.partners) {
      for (const cw of project.rules.colourways) {
        if (!partner.versions[cw.name]) continue;
        const host = buildVariant({
          markSrc: project.assets.mark && project.assets.mark.source,
          wordmarkSrc: project.assets.wordmark && project.assets.wordmark.source,
          lockup: prule.with, colourway: cw, rules: project.rules, measured,
        });
        const composed = PT.lockup({ hostSvg: host.svg, hostInk: host.box, partner, way: cw.name,
          rule: prule, ink: Object.values(cw.slots)[0] || '#000000' });
        pairs.push({ partner, colourway: cw, composed,
          floor: PT.floor(composed, host.svg, partner, cw.name, project) });
      }
    }
    var partnerRule = prule;
  }

  // What it is made as, if it is made as anything.
  const fabrication = (() => {
    const FAB = require('../fabrication');
    const list = FAB.rules(project);
    if (!list.length) return null;
    const drawings = [{ name: measured.master, source: master.source,
      viewBox: measured.markViewBox, minimumSize: measured.minimumSize }]
      .concat((project.tiers || []).map((t) => Object.assign({ name: t.name, source: t.source },
        require('../ladder').measureOne(t.source, project.rules))));
    const out = FAB.plan(project, drawings, list);
    out.masterName = measured.master;
    return out;
  })();

  // The brands inside the brand, composed the way the build composes them, from
  // the same module, so the manual and the package cannot disagree.
  const familyRule = require('../family').rules(project);
  // The language the document is written in, which is not the same question as
  // the language the brand is in. See src/strings.js.
  const L = require('../strings').resolve(project);
  // Which of the four layout systems this book is built in. See src/directions.js.
  const style = require('../directions').resolve(project);
  const family = (project.family || []).length ? (() => {
    const FAM = require('../family');
    const SN = require('../setname');
    const opentype = require('opentype.js');
    const cw = primaryColourway;
    const inkHex = Object.values(cw.slots)[0] || '#000000';
    const set = (text, hex, role) => SN.wordmark({ tokens: project.tokens, fonts: project.fonts },
      { text, family: role, weight: role === 'display' ? 700 : 400, tracking: role === 'display' ? 0.01 : 0.06 },
      opentype, hex);
    const markDoc = require('../svg').parse(master.source);
    require('../svg').applyColourway(markDoc, cw.slots);
    const markSvg = require('../svg').serialize(markDoc);
    return project.family.map((sub) => {
      const name = set(sub.name, sub.hex, 'display');
      const end = set(familyRule.endorsement.replace('{brand}', project.brand), inkHex, 'text');
      const geoL = require('../geometry');
      const rows = ['endorsed', 'plain'].reduce((acc, kind) => {
        const c = FAM.lockup({ markSvg, markInk: measured.markInk,
          nameSvg: name.svg, nameBox: geoL.inkBox(name.svg),
          endSvg: kind === 'endorsed' ? end.svg : null,
          endBox: kind === 'endorsed' ? geoL.inkBox(end.svg) : null, rule: familyRule, ink: inkHex });
        acc[kind] = { svg: c.svg, floor: geoL.minimumSize(c.svg, project.rules) };
        return acc;
      }, {});
      return { sub, rows: [rows] };
    });
  })() : null;

  // What the misuse page forbids, as treatments the engine can perform on this
  // identity's own artwork rather than as sentences nothing is drawn from.
  // See src/misuse.js.
  const misuse = require('../misuse').load(project);

  const changes = project.previous && brandJson
    ? { since: project.previous.version.text,
        entries: require('../previous').compare(project.previous.data, brandJson) }
    : null;
  return { project, sets: project.sets || null, measured, colours, roles, primary, ground, accent, primaryColourway, noun, system, pattern, hasSystem, changes, floors, pairs, ladder, fabrication, familyRule, family, L, style, misuse,
    partnerRule: typeof partnerRule === 'undefined' ? null : partnerRule,
    variants, variantFor, files, brandJson, contrast: contrast.matrix(colours),
    content: project.content || {} };
}

const badges = (L) => ({
  system: `<span class="badge">${b.esc(L.t('badgeSystem'))}</span>`,
  once: `<span class="badge once">${b.esc(L.t('badgeOnce'))}</span>`,
  yours: `<span class="badge yours">${b.esc(L.t('badgeYours'))}</span>`,
});
const BADGE = badges(require('../strings').resolve({}));

const sec = (n, title, who, body, L) =>
  `<div class="sec"><div class="sech"><h3><i>${n}</i>${b.esc(title)}</h3>`
  + `${(L ? badges(L) : BADGE)[who]}</div>${body}</div>`;
const chapter = (n, title, body) =>
  `<section class="chapter"><p class="chno">${n}</p><h2>${b.esc(title)}</h2>${body}</section>`;
const words = (t, ctx) => (t ? `<p class="note">${ctx ? b.own(ctx, t) : b.esc(t)}</p>` : '');

// ------------------------------------------------------------------ manual
function guidelines(ctx) {
  const c = ctx.content, p = ctx.project;
  const T = (k, v) => ctx.L.t(k, v);
  const S = (n, title, who, body) => sec(n, title, who, body, ctx.L);
  const body = `
  <header class="mast">
    <p class="eyebrow">${b.esc(ctx.L.t('eyebrow'))}</p>
    <h1>${ctx.L.t('manualTitle', { brand: '\u0000' }).split('\u0000').map(b.esc).join(b.own(ctx, p.brand))}</h1>
    <p class="sub">${b.own(ctx, `${c.positioning || ''} ${c.introduction || ''}`.trim())}</p>
  </header>

  ${ctx.changes ? chapter('00', T('chChanges', { version: ctx.changes.since }),
      S('0.1', T('secReadFirst'), 'system', b.changes(ctx))) : ''}

  ${chapter('01', T(ctx.noun === 'mark' ? 'chMark' : 'chLogotype'),
      S('1.1', T(ctx.noun === 'mark' ? 'secPrimaryMark' : 'secPrimaryLogotype'), 'system', b.markSpecimen(ctx) + words(c.markRationale, ctx)) +
      S('1.2', T('secConstruction'), 'system', b.construction(ctx) + words(c.constructionNotes, ctx)) +
      S('1.3', T('secClearSpace'), 'system', b.clearSpace(ctx)) +
      S('1.4', T('secMinimumSize'), 'system', b.minimumSize(ctx)) +
      // A floor says how small one drawing goes. Where an identity has said what
      // happens below it, that is the next thing the reader needs and it goes
      // straight after the number it answers.
      (ctx.ladder ? S('1.5', T('secEverySize'), 'once', b.ladderBlock(ctx)) : '') +
      (() => { let n = ctx.ladder ? 6 : 5;
        return S(`1.${n++}`, T('secLockups'), 'system', b.lockups(ctx))
          + (ctx.pairs.length ? S(`1.${n++}`, T('secPartners'), 'once', b.partnerLockups(ctx)) : '')
          // Eight of the thirty manuals printed this heading, its badge and an
          // empty box, because the section did not ask whether it had anything
          // in it. A section describing what the reader has not been given is
          // worse than no section — the same rule the icon grid learned.
          + (ctx.misuse.length ? S(`1.${n}`, T('secMisuse'), 'once', b.misuse(ctx)) : ''); })())}

  ${chapter('02', T('chColour'),
      S('2.1', T('secPalette'), 'system', b.palette(ctx) + words(c.colourRationale, ctx)) +
      // only where the artwork has one, so ten projects without a gradient get
      // no empty section and the numbering does not shift under them
      (b.gradientSpec(ctx) ? S('2.2', T('secGradient'), 'system', b.gradientSpec(ctx)) : '') +
      sec(b.gradientSpec(ctx) ? '2.3' : '2.2', T('secContrast'), 'system', b.contrastTable(ctx)) +
      // A ratio of luminance answers whether text can be read on a ground, and
      // nothing in twenty-three packages asked whether two of these colours can
      // be told from each other.
      sec(b.gradientSpec(ctx) ? '2.4' : '2.3', T('secColourVision'), 'system', b.colourVision(ctx)))}

  ${chapter('03', T('chType'),
      S('3.1', T('secTypefaces'), 'system', b.typeSpecimen(ctx) + words(c.typeRationale, ctx)) +
      S('3.2', T('secScale'), 'system', b.typeScale(ctx)))}

  ${(() => {
    // One chapter for the rule blocks, numbered around whichever of them this
    // project has. A section only where there is something to show.
    const parts = [
      [T('secPattern'), b.patternSpec(ctx)],
      [T('secPhotography'), b.photographySpec(ctx)],
      // Only where there will be icons. Two projects shipped a chapter
      // specifying the icon grid — box, stroke, curve radius, the lot — into a
      // package with no icons in it, because the sizes to write were the one
      // "what gets written" rule with no default. A section describing what
      // the reader has not been given is worse than no section.
      //
      // Asked of the rules, not of the file list handed in: gating a chapter on
      // a parameter a caller can forget to pass is how a document loses a
      // chapter silently, which is the thing being fixed.
      [T('secIconGrid'), b.willWriteIcons(ctx) && b.iconSpec(ctx)],
      [T('secMotion'), b.motionSpec(ctx)],
      // The sequence, playing, on the page that specifies it.
      [T('secIdent'), b.motionBuild(ctx)],
    ].filter(([, body]) => body);
    if (!parts.length) return '';
    return chapter('04', T('chSystem'),
      parts.map(([title, body], i) => S(`4.${i + 1}`, title, 'once', body)).join(''));
  })()}

  ${(() => {
    // The chapters after 03 depend on what the identity has, so their numbers
    // are counted rather than written down in four places.
    const madeAs = !!(ctx.fabrication && ctx.fabrication.length);
    let n = ctx.hasSystem ? 5 : 4;
    const kin = ctx.family && ctx.family.length ? chapter(`0${n}`, T('chFamily'),
      S(`${n++}.1`, T('secSubBrands'), 'once', b.familyBlock(ctx))) : '';
    const making = madeAs ? chapter(`0${n}`, T('chMaking'),
      S(`${n++}.1`, T('secMadeAs'), 'once', b.fabrication(ctx))) : '';
    return `${kin}${making}

  ${chapter(`0${n}`, T('chAssets'),
      S(`${n}.1`, T('secInPackage'), 'system', b.assetIndex(ctx)) +
      S(`${n}.2`, T('secMachineFile'), 'system',
        `<p class="note">${b.esc(T('machineNote'))}</p>` + b.brandJsonBlock(ctx)))}`;
  })()}

  <footer>
    ${b.esc(ctx.L.t('footerMeasured', { master: require('path').basename(require('../project').masterOf(p).path) }))}<br>
    ${b.esc(ctx.L.t('footerContrast'))}<br>
    ${ctx.L.t('footerFiles', { brand: '\u0000', version: b.esc(p.version), n: ctx.files.length })
      .split('\u0000').map(b.esc).join(b.own(ctx, p.brand))}
  </footer>`;
  // The document's language is the language it is written in, not the language
  // of the brand it is about. Maayan's manual was 988 English words under
  // lang="he" dir="rtl", so the whole of it was laid out right to left.
  return shell({ title: ctx.L.t('manualTitle', { brand: p.brand }), type: p.tokens.type,
    fonts: p.fonts, body, language: ctx.L.lang, direction: ctx.L.dir, style: ctx.style.key });
}

module.exports = { context, guidelines, sec, chapter, BADGE, words };
