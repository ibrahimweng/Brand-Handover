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

  const changes = project.previous && brandJson
    ? { since: project.previous.version.text,
        entries: require('../previous').compare(project.previous.data, brandJson) }
    : null;
  return { project, sets: project.sets || null, measured, colours, roles, primary, ground, accent, primaryColourway, noun, system, pattern, hasSystem, changes, floors, pairs,
    partnerRule: typeof partnerRule === 'undefined' ? null : partnerRule,
    variants, variantFor, files, brandJson, contrast: contrast.matrix(colours),
    content: project.content || {} };
}

const BADGE = { system: '<span class="badge">Drawn by the system</span>',
                once: '<span class="badge once">Set once by you</span>',
                yours: '<span class="badge yours">Yours</span>' };

const sec = (n, title, who, body) =>
  `<div class="sec"><div class="sech"><h3><i>${n}</i>${b.esc(title)}</h3>${BADGE[who]}</div>${body}</div>`;
const chapter = (n, title, body) =>
  `<section class="chapter"><p class="chno">${n}</p><h2>${b.esc(title)}</h2>${body}</section>`;
const words = (t) => (t ? `<p class="note">${b.esc(t)}</p>` : '');

// ------------------------------------------------------------------ manual
function guidelines(ctx) {
  const c = ctx.content, p = ctx.project;
  const body = `
  <header class="mast">
    <p class="eyebrow">Brand manual · generated from one master file</p>
    <h1>${b.esc(p.brand)} brand manual</h1>
    <p class="sub">${b.esc(c.positioning || '')} ${b.esc(c.introduction || '')}</p>
  </header>

  ${ctx.changes ? chapter('00', `What changed since ${ctx.changes.since}`,
      sec('0.1', 'Read this first', 'system', b.changes(ctx))) : ''}

  ${chapter('01', ctx.noun === 'mark' ? 'The mark' : 'The logotype',
      sec('1.1', ctx.noun === 'mark' ? 'The primary mark' : 'The logotype', 'system', b.markSpecimen(ctx) + words(c.markRationale)) +
      sec('1.2', 'Construction', 'system', b.construction(ctx) + words(c.constructionNotes)) +
      sec('1.3', 'Clear space', 'system', b.clearSpace(ctx)) +
      sec('1.4', 'Minimum size', 'system', b.minimumSize(ctx)) +
      sec('1.5', 'The lockup system', 'system', b.lockups(ctx)) +
      (ctx.pairs.length ? sec('1.6', 'Partner lockups', 'once', b.partnerLockups(ctx)) : '') +
      sec(ctx.pairs.length ? '1.7' : '1.6', 'Misuse', 'system', b.misuse(ctx)))}

  ${chapter('02', 'Colour',
      sec('2.1', 'The palette', 'system', b.palette(ctx) + words(c.colourRationale)) +
      // only where the artwork has one, so ten projects without a gradient get
      // no empty section and the numbering does not shift under them
      (b.gradientSpec(ctx) ? sec('2.2', 'The gradient', 'system', b.gradientSpec(ctx)) : '') +
      sec(b.gradientSpec(ctx) ? '2.3' : '2.2', 'Contrast and accessibility', 'system', b.contrastTable(ctx)) +
      // A ratio of luminance answers whether text can be read on a ground, and
      // nothing in twenty-three packages asked whether two of these colours can
      // be told from each other.
      sec(b.gradientSpec(ctx) ? '2.4' : '2.3', 'Colour vision', 'system', b.colourVision(ctx)))}

  ${chapter('03', 'Typography',
      sec('3.1', 'The typefaces', 'system', b.typeSpecimen(ctx) + words(c.typeRationale)) +
      sec('3.2', 'The scale', 'system', b.typeScale(ctx)))}

  ${(() => {
    // One chapter for the rule blocks, numbered around whichever of them this
    // project has. A section only where there is something to show.
    const parts = [
      ['The pattern', b.patternSpec(ctx)],
      ['Photography', b.photographySpec(ctx)],
      // Only where there will be icons. Two projects shipped a chapter
      // specifying the icon grid — box, stroke, curve radius, the lot — into a
      // package with no icons in it, because the sizes to write were the one
      // "what gets written" rule with no default. A section describing what
      // the reader has not been given is worse than no section.
      //
      // Asked of the rules, not of the file list handed in: gating a chapter on
      // a parameter a caller can forget to pass is how a document loses a
      // chapter silently, which is the thing being fixed.
      ['The icon grid', b.willWriteIcons(ctx) && b.iconSpec(ctx)],
      ['Motion', b.motionSpec(ctx)],
    ].filter(([, body]) => body);
    if (!parts.length) return '';
    return chapter('04', 'The system',
      parts.map(([title, body], i) => sec(`4.${i + 1}`, title, 'once', body)).join(''));
  })()}

  ${chapter(ctx.hasSystem ? '05' : '04', 'Assets',
      sec(ctx.hasSystem ? '5.1' : '4.1', 'What is in the package', 'system', b.assetIndex(ctx)) +
      sec(ctx.hasSystem ? '5.2' : '4.2', 'The machine readable file', 'system',
        `<p class="note">Shipped beside this page so the client's own tools can read the brand instead of guessing at it.</p>` + b.brandJsonBlock(ctx)))}

  <footer>
    Every measurement on this page was read off ${b.esc(require('path').basename(require('../project').masterOf(p).path))} when the package was built. None of it was typed in.<br>
    Contrast ratios follow WCAG 2.2. CMYK is converted from hex and should be soft proofed against an ICC profile before print.<br>
    ${b.esc(p.brand)} ${b.esc(p.version)} · ${ctx.files.length} files in the package.
  </footer>`;
  return shell({ title: `${p.brand} Brand Manual`, type: p.tokens.type, fonts: p.fonts, body,
    language: p.language, direction: p.direction });
}

module.exports = { context, guidelines, sec, chapter, BADGE, words };
