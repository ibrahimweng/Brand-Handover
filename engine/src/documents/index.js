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
        markSrc: project.assets.mark.source,
        wordmarkSrc: project.assets.wordmark && project.assets.wordmark.source,
        lockup: l, colourway: cw, rules: project.rules, measured,
      }).svg;
    }
  }
  return { project, measured, colours, primary, ground, accent, primaryColourway,
    variants, files, brandJson, contrast: contrast.matrix(colours),
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

  ${chapter('01', 'The mark',
      sec('1.1', 'The primary mark', 'system', b.markSpecimen(ctx) + words(c.markRationale)) +
      sec('1.2', 'Construction', 'system', b.construction(ctx) + words(c.constructionNotes)) +
      sec('1.3', 'Clear space', 'system', b.clearSpace(ctx)) +
      sec('1.4', 'Minimum size', 'system', b.minimumSize(ctx)) +
      sec('1.5', 'The lockup system', 'system', b.lockups(ctx)) +
      sec('1.6', 'Misuse', 'system', b.misuse(ctx)))}

  ${chapter('02', 'Colour',
      sec('2.1', 'The palette', 'system', b.palette(ctx) + words(c.colourRationale)) +
      sec('2.2', 'Contrast and accessibility', 'system', b.contrastTable(ctx)))}

  ${chapter('03', 'Typography',
      sec('3.1', 'The typefaces', 'system', b.typeSpecimen(ctx) + words(c.typeRationale)) +
      sec('3.2', 'The scale', 'system', b.typeScale(ctx)))}

  ${chapter('04', 'Assets',
      sec('4.1', 'What is in the package', 'system', b.assetIndex(ctx)) +
      sec('4.2', 'The machine readable file', 'system',
        `<p class="note">Shipped beside this page so the client's own tools can read the brand instead of guessing at it.</p>` + b.brandJsonBlock(ctx)))}

  <footer>
    Every measurement on this page was read off ${b.esc(require('path').basename(p.assets.mark.path))} when the package was built. None of it was typed in.<br>
    Contrast ratios follow WCAG 2.2. CMYK is converted from hex and should be soft proofed against an ICC profile before print.<br>
    ${b.esc(p.brand)} ${b.esc(p.version)} · ${ctx.files.length} files in the package.
  </footer>`;
  return shell({ title: `${p.brand} Brand Manual`, type: p.tokens.type, body });
}

module.exports = { context, guidelines, sec, chapter, BADGE, words };
