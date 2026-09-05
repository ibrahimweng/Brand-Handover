'use strict';
// Everything the editor needs, measured once here so the browser never has to.
// The expensive work (rendering to read ink bounds, walking the artwork) has
// already happened by the time this leaves Node.
const svgu = require('../svg');
const contrast = require('../contrast');
const { buildVariant } = require('../variants');
const system = require('../system');
const pattern = require('../pattern');
const IMG = require('./images');

function bundle(project, measured, files = []) {
  const cols = project.tokens.colour || {};
  const colours = {};
  for (const [name, c] of Object.entries(cols)) {
    // a declared build if there is one, and a flag saying which it is
    const declared = require('../cmyk').parse(c.cmyk);
    colours[name] = Object.assign({}, c, { rgb: contrast.rgb(c.hex),
      cmyk: declared || contrast.cmyk(c.hex), cmykDeclared: !!declared });
  }
  const byRole = (role, fallback) => {
    const hit = Object.entries(cols).find(([, c]) => c.role === role);
    return hit ? { name: hit[0], hex: hit[1].hex } : fallback;
  };
  const primary = byRole('primary', { name: Object.keys(cols)[0] || 'ink', hex: '#111111' });
  const roles = {
    primary,
    ground: byRole('ground', { name: 'ground', hex: '#FFFFFF' }),
    accent: byRole('accent', primary),
    secondary: byRole('secondary', primary),
    neutral: byRole('neutral', primary),
  };

  // "the mark" on the canvas is the master artwork, which for a logotype
  // identity is the logotype: there is no symbol to fall back to
  const masterSrc = require('../project').masterOf(project).source;
  const marks = {}, markInner = {}, variants = {};
  for (const cw of project.rules.colourways) {
    const doc = svgu.parse(masterSrc);
    svgu.applyColourway(doc, cw.slots);
    marks[cw.name] = svgu.serialize(doc);
    markInner[cw.name] = svgu.innerXML(doc);
    for (const l of project.rules.lockups) {
      variants[`${l}:${cw.name}`] = buildVariant({
        markSrc: project.assets.mark && project.assets.mark.source,
        wordmarkSrc: project.assets.wordmark && project.assets.wordmark.source,
        lockup: l, colourway: cw, rules: project.rules, measured,
      }).svg;
    }
  }
  // roles double as colourway names in block props, so map them across
  for (const key of Object.keys(roles)) {
    const n = roles[key].name;
    if (marks[n]) { marks[key] = marks[n]; markInner[key] = markInner[n]; }
  }

  // ---- rule blocks: resolved once here, then every instance is generated ----
  const rules = system.resolve(project, measured);
  const pairs = contrast.matrix(cols);
  const patternTiles = {};
  const patternRefused = [];
  const src = masterSrc;
  const ways = [];
  for (const key of ['ground', 'primary', 'secondary', 'accent']) {
    if (!roles[key]) continue;
    const on = key === 'ground' ? roles.primary.hex : roles.ground.hex;
    ways.push({ name: key, ink: roles[key].hex, on });
  }
  const gen = pattern.everyTile(src, rules.pattern, ways, pairs);
  if (gen.ok) {
    for (const t of gen.tiles) patternTiles[`${t.density}:${t.colourway}`] = t;
    patternRefused.push(...gen.refused);
  }

  return {
    brand: project.brand, version: project.version,
    language: project.language || 'en', direction: project.direction || 'ltr',
    system: {
      icons: rules.icons,
      pattern: Object.assign({}, rules.pattern, { available: gen.ok, why: gen.ok ? null : gen.why, how: gen.ok ? null : gen.how }),
      motion: rules.motion,
      photography: rules.photography,
    },
    patternTiles, patternRefused,
    // Photographs, keyed by content: the ones the project ships, ready to drop
    // into a slot, plus whatever somebody adds later, which travels with the
    // saved document. Empty until an identity arrived that shipped any — before
    // that the only way a photograph could reach the canvas was somebody
    // uploading it by hand, every time, into every document.
    images: Object.fromEntries((project.photography || []).map((ph) => [
      IMG.idOf(ph.src),
      { src: ph.src, w: ph.w, h: ph.h, name: ph.file, caption: ph.caption, vector: false, fromProject: true },
    ])),
    colours, roles,
    type: project.tokens.type || {},
    measured: {
      markInk: measured.markInk, markViewBox: measured.markViewBox,
      clearSpace: measured.clearSpace, minimumSize: measured.minimumSize, slots: measured.slots,
    },
    clearSpaceRatio: project.rules.clearSpaceRatio,
    lockups: project.rules.lockups,
    colourways: project.rules.colourways.map((c) => c.name),
    // which ground each colourway was cut for, so a block asking for one the
    // project does not cut can fall back to one that reads where it is going
    colourwayOn: Object.fromEntries(project.rules.colourways.map((c) => [c.name, c.on || null])),
    marks, markInner, variants,
    contrast: contrast.matrix(cols),
    files: files.map((f) => ({ path: f.path, bytes: f.bytes })),
    content: project.content || {},
  };
}

// A first document that is worth opening, rather than a blank page. Every
// beginner meets the editor with something already on it.
function starterDoc(bu) {
  const M = require('./model');
  // ids start again for each document, so building the same project twice in
  // one run gives the same document rather than a second range of numbers
  M.resetIds();
  const doc = M.emptyDoc(bu.brand);
  const P = doc.page;
  const cover = doc.pages[0];
  const add = (type, at) => { const b = M.makeBlock(type, at); cover.blocks.push(b); return b; };

  // A cover with a photograph on it where the project ships one, because that
  // is what the identity looks like and the engine now has the picture.
  const shot = Object.entries(bu.images || {}).find(([, im]) => im.fromProject);
  if (shot) {
    add('slot', { x: 0, y: 0, w: P.w, h: P.h,
      props: { image: shot[0], fit: 'cover', treatment: true, label: 'Cover', caption: shot[1].caption || '' } });
  } else {
    add('fill', { x: 0, y: 0, w: P.w, h: P.h, props: { colour: 'primary' } });
  }
  add('lockup', { x: 120, y: 180, w: 620, h: 200, props: { lockup: 'horizontal', colourway: 'ground', on: shot ? 'none' : 'primary' } });
  // The cover carries whatever the project wrote as its positioning, and that
  // is a sentence in a real project rather than the one word every fixture had.
  // A block 120 tall at H1 held three lines of it and the rest ran through the
  // caption underneath. Give the block the height its own words need, and set a
  // long statement in a step a reader can take at that length.
  const lede = bu.content.positioning || `${bu.brand} brand guidelines`;
  const step = (st) => (((bu.type || {}).scale) || []).find((x) => x.name === st) || { size: 17, leading: 27 };
  const ledeStyle = M.textLines(lede, step('H1'), 700) > 3 ? 'H2' : 'H1';
  const ledeH = Math.max(120, M.textFits(lede, step(ledeStyle), 700, 0).needs);
  add('text', { x: 124, y: 420, w: 700, h: ledeH,
    props: { text: lede, style: ledeStyle, align: 'left', colour: 'ground' } });
  add('text', { x: 124, y: 420 + ledeH + 20, w: 520, h: 40,
    props: { text: `${bu.brand} ${bu.version} · built from one master file`, style: 'Caption', align: 'left', colour: 'ground' } });

  const p2 = M.makePage('The mark');
  doc.pages.push(p2);
  const add2 = (type, at) => p2.blocks.push(M.makeBlock(type, at));
  add2('text', { x: 80, y: 64, w: 600, h: 60, props: { text: 'The mark', style: 'H1', colour: 'primary' } });
  add2('construction', { x: 80, y: 150, w: 380, h: 420, props: { colourway: 'primary', on: 'ground', line: 'neutral' } });
  add2('clearSpace', { x: 500, y: 150, w: 380, h: 420, props: { colourway: 'primary', on: 'ground', line: 'neutral' } });
  add2('minimumSize', { x: 920, y: 150, w: 280, h: 260, props: { colourway: 'primary' } });

  const p3 = M.makePage('Colour');
  doc.pages.push(p3);
  p3.blocks.push(M.makeBlock('text', { x: 80, y: 64, w: 600, h: 60, props: { text: 'Colour', style: 'H1', colour: 'primary' } }));
  p3.blocks.push(M.makeBlock('palette', { x: 80, y: 150, w: 1120, h: 250 }));
  p3.blocks.push(M.makeBlock('contrast', { x: 80, y: 430, w: 1120, h: 240, props: { limit: 5 } }));

  // the third kind of block, so a beginner meets all three on the way in
  const p4 = M.makePage('The system');
  doc.pages.push(p4);
  p4.blocks.push(M.makeBlock('text', { x: 80, y: 56, w: 700, h: 56, props: { text: 'Set once, generated after that', style: 'H1', colour: 'primary' } }));
  p4.blocks.push(M.makeBlock('pattern', { x: 80, y: 136, w: 440, h: 232, props: { density: 'medium', colourway: 'ground', on: 'primary' } }));
  p4.blocks.push(M.makeBlock('pattern', { x: 544, y: 136, w: 288, h: 232, props: { density: 'fine', colourway: 'primary', on: 'ground', caption: true } }));
  p4.blocks.push(M.makeBlock('photography', { x: 856, y: 136, w: 344, h: 232, props: { on: 'ground' } }));
  p4.blocks.push(M.makeBlock('iconGrid', { x: 80, y: 400, w: 280, h: 264, props: { colourway: 'primary', on: 'ground', line: 'neutral' } }));
  p4.blocks.push(M.makeBlock('motion', { x: 384, y: 400, w: 232, h: 264, props: { colourway: 'ground', on: 'primary' } }));
  p4.blocks.push(M.makeBlock('text', { x: 648, y: 408, w: 552, h: 200,
    props: { text: 'These four come from one decision each. Change the rule in the project and every instance follows. Nothing here is redrawn by hand.', style: 'Body', colour: 'primary' } }));
  return doc;
}

module.exports = { bundle, starterDoc };
