'use strict';
// One page per layout direction, drawn with the identity that is being made.
//
// A picker that describes four layouts in words is a picker nobody can use: the
// difference between an editorial system and a manual system is not a sentence,
// it is a page. This renders the same masthead, chapter opener, section headings
// and specimen stage that the real manual renders, through the same stylesheet,
// so what is chosen by looking is what gets built.
//
// It is deliberately not the whole manual. Four complete books is four measuring
// passes and about a second of work each, for a screen where somebody is
// glancing between four thumbnails.
const { shell, escText } = require('./chrome');
const D = require('../directions');

const esc = escText;

function previewPage({ brand, positioning, markSvg, colours, style }) {
  const cols = (colours || []).slice(0, 5);
  const ground = (cols.find((c) => c.role === 'ground') || {}).hex || '#FFFFFF';
  const ink = (cols.find((c) => c.role === 'primary') || cols[0] || {}).hex || '#111111';
  const chip = (c) => `<div class="chip"><div class="sw" style="background:${esc(c.hex)}"></div>`
    + `<b>${esc(c.name || '')}</b><span class="role">${esc(c.role || '')}</span></div>`;

  const body = `
  <header class="mast">
    <p class="eyebrow">Brand manual · generated from one master file</p>
    <h1>${esc(brand || 'Untitled')} brand manual</h1>
    ${positioning ? `<p class="sub">${esc(positioning)}</p>` : ''}
  </header>
  <section class="chapter"><p class="chno">01</p><h2>The mark</h2>
    <div class="sec"><div class="sech"><h3><i>1.1</i>The primary mark</h3>
      <span class="badge">Drawn by the system</span></div>
      <div class="stage" style="background:${esc(ground)}">${markSvg || ''}</div>
      <p class="note">Every measurement on this page is read off the master file at the moment the
      package is built. Nothing here was typed in twice.</p></div>
    <div class="sec"><div class="sech"><h3><i>1.2</i>Clear space</h3>
      <span class="badge">Drawn by the system</span></div>
      <p class="note">A measured rule, stated as a fraction of the mark's own height, so it holds at
      any size the mark is used at.</p></div>
  </section>
  <section class="chapter"><p class="chno">02</p><h2>Colour</h2>
    <div class="sec"><div class="sech"><h3><i>2.1</i>The palette</h3>
      <span class="badge">Drawn by the system</span></div>
      <div class="chips">${cols.map(chip).join('')}</div>
      <p class="note" style="color:${esc(ink)}">Contrast is measured against every ground the identity
      sets text on, and the pairs that do not work are listed rather than left to be discovered.</p></div>
  </section>`;

  return shell({ title: `${brand || 'Untitled'} · ${D.DIRECTIONS[style] ? D.DIRECTIONS[style].name : ''}`,
    type: null, fonts: null, body, style });
}

// The four, so a browser can show them side by side.
function previews(opts) {
  return D.NAMES.map((key) => ({
    key, name: D.DIRECTIONS[key].name, note: D.DIRECTIONS[key].note,
    html: previewPage(Object.assign({}, opts, { style: key })),
  }));
}

module.exports = { previewPage, previews };
