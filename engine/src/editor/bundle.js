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

// `generated` is the pattern engine's recipe — which generator, with what
// parameters, in which colourway. It is passed in rather than worked out here,
// because a project that brought a pattern of its own had its parameters chosen
// by a *match* against that picture, and re-deriving them from the mark would
// quietly hand the canvas a different pattern from the one in 07-pattern and in
// the manual. The build knows the answer; this takes it.
function bundle(project, measured, files = [], generated = null) {
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
  const marks = {}, markInner = {}, variants = {}, inks = {};

  // The colours a piece of artwork actually puts on the page, in the order the
  // artwork paints them. Measured through svgu.eachPainted, which is the one
  // walker in this engine that knows a clipPath's white rectangle is a shape
  // for hiding things and not a colour: perigee's mark carries one, and reading
  // the file as text made its diagrams look like they were drawn in white.
  const inksIn = (svg) => {
    const out = [];
    svgu.eachPainted(svgu.parse(svg), (el) => {
      if (!el.getAttribute) return;
      for (const a of ['fill', 'stroke']) {
        const hex = contrast.toHex(el.getAttribute(a));
        if (hex && out.indexOf(hex) < 0) out.push(hex);
      }
    });
    return out;
  };

  // The mark in the two parts it builds in: what is stroked settles first, what
  // is filled rises into it. Split here, on the parsed document, because the
  // canvas split it with a regex over the artwork's own text — a tag, then
  // everything up to the first closing tag — and that comes apart on anything
  // nested. Kvist's logotype sits in a <g> after a <defs>, so the regex closed
  // the <defs> at the clipPath and the whole mark ended up inside it: a block
  // that drew nothing at all, in every package this repository has published.
  //
  // Whole subtrees move together, so a group keeps the paint it sets for its
  // children, and what is never drawn is kept out of both halves and emitted
  // once — a clipPath the artwork points at has to stay reachable.
  const buildOf = (svg) => {
    const doc = svgu.parse(svg);
    const out = { defs: '', outline: '', filled: '' };
    for (let c = doc.documentElement.firstChild; c; c = c.nextSibling) {
      if (c.nodeType !== 1) continue;
      const xml = svgu.serialize(c);
      const tag = String(c.nodeName).replace(/^.*:/, '').toLowerCase();
      if (svgu.NEVER_DRAWN.indexOf(tag) > -1) { out.defs += xml; continue; }
      let stroked = false, painted = false;
      svgu.eachPainted({ documentElement: c }, (el) => {
        if (!el.getAttribute) return;
        const st = el.getAttribute('stroke'), fi = el.getAttribute('fill');
        if (st && st !== 'none') stroked = true;
        if (fi && fi !== 'none') painted = true;
      });
      out[stroked || !painted ? 'outline' : 'filled'] += xml;
    }
    return out;
  };
  const motionParts = {};
  for (const cw of project.rules.colourways) {
    const doc = svgu.parse(masterSrc);
    svgu.applyColourway(doc, cw.slots);
    marks[cw.name] = svgu.serialize(doc);
    markInner[cw.name] = svgu.innerXML(doc);
    inks[cw.name] = inksIn(marks[cw.name]);
    motionParts[cw.name] = buildOf(marks[cw.name]);
    for (const l of project.rules.lockups) {
      variants[`${l}:${cw.name}`] = buildVariant({
        markSrc: project.assets.mark && project.assets.mark.source,
        wordmarkSrc: project.assets.wordmark && project.assets.wordmark.source,
        lockup: l, colourway: cw, rules: project.rules, measured,
      }).svg;
      inks[`${l}:${cw.name}`] = inksIn(variants[`${l}:${cw.name}`]);
    }
  }
  // roles double as colourway names in block props, so map them across
  for (const key of Object.keys(roles)) {
    const n = roles[key].name;
    if (marks[n]) {
      marks[key] = marks[n]; markInner[key] = markInner[n];
      inks[key] = inks[n]; motionParts[key] = motionParts[n];
    }
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

  // Everything the canvas needs to draw a generated pattern and to keep
  // drawing it after somebody has retouched it: the mark's measurements, the
  // colours, and what was chosen. Under 6 KB, the same recipe the studio
  // travels with — a pattern is arithmetic and a palette.
  const PEMIT = require('../patterns/emit');
  let genRecipe = null;
  try {
    genRecipe = PEMIT.bundle(project, measured,
      (generated && generated.made) || [], generated && generated.chose,
      rules.pattern && rules.pattern.tile);
  } catch (e) { genRecipe = null; }

  return {
    brand: project.brand, version: project.version,
    generated: genRecipe,
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
    // what a document has to put in its head to be set in this identity's own
    // typeface — worked out once, here, rather than four times downstream
    fonts: (project.fonts || []).map((f) => ({ role: f.role, family: f.family, licence: f.licence,
      files: f.files.map((x) => ({ file: x.file, weight: x.weight, style: x.style, bytes: x.bytes })) })),
    fontHead: require('../typeface').head(project.tokens.type, project.fonts),
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
    // and what each of them paints, so the half of this that runs in a browser
    // can ask whether a piece of artwork can be seen on a ground without
    // parsing it again, or worse, reading it as text
    inks, motionParts,
    contrast: contrast.matrix(cols),
    files: files.map((f) => ({ path: f.path, bytes: f.bytes })),
    content: project.content || {},
    // What language the canvas is written in, so the document it opens on is
    // written in it too. The starter document is content rather than chrome and
    // was eleven English literals; a Hebrew project got a canvas whose own words
    // were Hebrew and whose first document was not, and `published.html` came
    // out 97 per cent Latin under lang="he".
    language: project.language || 'en', direction: project.direction || null,
    // and the words themselves, because the half of the canvas that runs in a
    // browser cannot read a dictionary that lives in the engine
    words: require('../strings').resolve(project, 'canvas').words(),
  };
}

// A first document that is worth opening, rather than a blank page. Every
// beginner meets the editor with something already on it.
//
// What it opens with has to be read off the project rather than written here.
// This asked for a horizontal lockup, a cover in the primary colour and three
// diagrams on the ground colour, and none of those three is something a project
// has to have: Marlow cuts only a wordmark, Hallward's primary role IS its ink,
// and Cusp's ground role is a near-black its one colourway is drawn in. So the
// canvas opened on a black cover for Hallward, three empty boxes for Cusp, and
// a wordmark on Marlow where a horizontal lockup had been asked for, because
// that is what the fallback reached first. Ask what the project cuts, and put
// the artwork where it reads.
function starterDoc(bu) {
  const M = require('./model');
  const R = require('./render');
  const L = require('../strings').resolve({ language: bu.language, direction: bu.direction }, 'canvas');

  // A ground the artwork can actually be seen on. The wanted one wins wherever
  // it works, because it is what the identity is for; the rest of the palette
  // is only consulted when nothing can be seen on it at all.
  const groundFor = (want, art) => {
    const reads = (name) => {
      const hex = R.colour(bu, name);
      let best = 0;
      for (const key of art) { const r = R.readsAt(bu, key, hex); if (r != null && r > best) best = r; }
      return best;
    };
    if (reads(want) >= R.SEEN) return want;
    const better = Object.keys(bu.colours).map((n) => ({ n, r: reads(n) }))
      .sort((a, b) => b.r - a.r)[0];
    return better && better.r >= R.SEEN ? better.n : want;
  };
  const cuts = bu.lockups || [];
  const lockup = cuts.indexOf('horizontal') > -1 ? 'horizontal' : (cuts[0] || 'horizontal');
  const cwKeys = bu.colourways || [];
  const lockupArt = cwKeys.map((n) => `${lockup}:${n}`).filter((k) => bu.variants[k]);
  const coverOn = groundFor('primary', lockupArt);
  const diagramOn = groundFor('ground', cwKeys);
  const motionOn = groundFor('primary', cwKeys);
  // ids start again for each document, so building the same project twice in
  // one run gives the same document rather than a second range of numbers
  M.resetIds();
  const doc = M.emptyDoc(bu.brand, L.t('sldCover'));
  const P = doc.page;
  const cover = doc.pages[0];
  const add = (type, at) => { const b = M.makeBlock(type, at); cover.blocks.push(b); return b; };

  // A cover with a photograph on it where the project ships one, because that
  // is what the identity looks like and the engine now has the picture.
  const shot = Object.entries(bu.images || {}).find(([, im]) => im.fromProject);
  if (shot) {
    add('slot', { x: 0, y: 0, w: P.w, h: P.h,
      props: { image: shot[0], fit: 'cover', treatment: true, label: L.t('sldCover'), caption: shot[1].caption || '' } });
  } else {
    add('fill', { x: 0, y: 0, w: P.w, h: P.h, props: { colour: coverOn } });
  }
  add('lockup', { x: 120, y: 180, w: 620, h: 200, props: { lockup, colourway: 'ground', on: shot ? 'none' : coverOn } });
  // The cover carries whatever the project wrote as its positioning, and that
  // is a sentence in a real project rather than the one word every fixture had.
  // A block 120 tall at H1 held three lines of it and the rest ran through the
  // caption underneath. Give the block the height its own words need, and set a
  // long statement in a step a reader can take at that length.
  const lede = bu.content.positioning || L.t('manualTitle', { brand: bu.brand });
  const step = (st) => (((bu.type || {}).scale) || []).find((x) => x.name === st) || { size: 17, leading: 27 };
  const ledeStyle = M.textLines(lede, step('H1'), 700) > 3 ? 'H2' : 'H1';
  const ledeH = Math.max(120, M.textFits(lede, step(ledeStyle), 700, 0).needs);
  // The words on the cover were set in the ground role, because the cover was
  // painted in the primary one. The round that taught the cover to choose its
  // own ground left this behind, so Hallward — whose readable cover is its
  // paper — got its own name set in paper on paper, at 36 px. The cover is
  // chosen; so is what is written on it.
  const coverInk = shot ? 'ground' : R.wordsOn(bu, R.colour(bu, coverOn));
  add('text', { x: 124, y: 420, w: 700, h: ledeH,
    props: { text: lede, style: ledeStyle, align: 'left', colour: coverInk } });
  add('text', { x: 124, y: 420 + ledeH + 20, w: 520, h: 40,
    props: { text: `${bu.brand} ${bu.version} · ${L.t('deckBuilt')}`, style: 'Caption', align: 'left', colour: coverInk } });

  const p2 = M.makePage(L.t('chMark'));
  doc.pages.push(p2);
  const add2 = (type, at) => p2.blocks.push(M.makeBlock(type, at));
  add2('text', { x: 80, y: 64, w: 600, h: 60, props: { text: L.t('chMark'), style: 'H1', colour: 'primary' } });
  add2('construction', { x: 80, y: 150, w: 380, h: 420, props: { colourway: 'primary', on: diagramOn, line: 'neutral' } });
  add2('clearSpace', { x: 500, y: 150, w: 380, h: 420, props: { colourway: 'primary', on: diagramOn, line: 'neutral' } });
  add2('minimumSize', { x: 920, y: 150, w: 280, h: 260, props: { colourway: 'primary', on: diagramOn } });

  const p3 = M.makePage(L.t('chColour'));
  doc.pages.push(p3);
  p3.blocks.push(M.makeBlock('text', { x: 80, y: 64, w: 600, h: 60, props: { text: L.t('chColour'), style: 'H1', colour: 'primary' } }));
  p3.blocks.push(M.makeBlock('palette', { x: 80, y: 150, w: 1120, h: 250 }));
  p3.blocks.push(M.makeBlock('contrast', { x: 80, y: 430, w: 1120, h: 240, props: { limit: 5 } }));

  // the third kind of block, so a beginner meets all three on the way in
  const p4 = M.makePage(L.t('chSystem'));
  doc.pages.push(p4);
  p4.blocks.push(M.makeBlock('text', { x: 80, y: 56, w: 700, h: 56, props: { text: L.t('cnvSetOnce'), style: 'H1', colour: 'primary' } }));
  p4.blocks.push(M.makeBlock('pattern', { x: 80, y: 136, w: 440, h: 232, props: { density: 'medium', colourway: 'ground', on: 'primary' } }));
  p4.blocks.push(M.makeBlock('pattern', { x: 544, y: 136, w: 288, h: 232, props: { density: 'fine', colourway: 'primary', on: 'ground', caption: true } }));
  p4.blocks.push(M.makeBlock('photography', { x: 856, y: 136, w: 344, h: 232, props: { on: 'ground' } }));
  p4.blocks.push(M.makeBlock('iconGrid', { x: 80, y: 400, w: 280, h: 264, props: { colourway: 'primary', on: 'ground', line: 'neutral' } }));
  p4.blocks.push(M.makeBlock('motion', { x: 384, y: 400, w: 232, h: 264, props: { colourway: 'ground', on: motionOn } }));
  p4.blocks.push(M.makeBlock('text', { x: 648, y: 408, w: 552, h: 200,
    props: { text: L.t('cnvFourBlocks'), style: 'Body', colour: 'primary' } }));
  return doc;
}

module.exports = { bundle, starterDoc };
