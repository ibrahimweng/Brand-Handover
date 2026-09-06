'use strict';
// Artwork that is not yours.
//
// Twenty-two identities and every asset in every package belonged to the brand
// it described. The mark, the logotype, the icon, the photographs, the typeface:
// all of it the client's, all of it the engine's to clean, recolour, rescale and
// cut into a hundred files. The whole method rests on that — one master, and
// everything else derived from it.
//
// A partner lockup breaks it. Half the artwork belongs to somebody else. You may
// not recolour it into your palette, you may not redraw it to fix its faults,
// and you cannot make the version you are missing: only they can. What you can
// do is measure it, and measuring is where the surprises are, because the rules
// that govern a pair of marks are not either brand's rules. They are new ones,
// and every number in them comes off both files at once.
const svgu = require('./svg');
const geo = require('./geometry');
const contrast = require('./contrast');

const DEFAULTS = {
  with: null,          // which of our lockups stands beside them; the first, by default
  match: 'height',     // how theirs is sized against ours
  matchRatio: 1,       // and at what fraction of it
  gapRatio: 0.9,       // the space either side of the rule, as a fraction of our ink height
  rule: true,          // a dividing rule between the two marks
  // Its width, as a fraction of the thinnest thing we already draw. One, not a
  // hairline: a divider finer than everything around it is the first thing to
  // disappear, so it — rather than either mark — decides how small the pair may
  // go. At 0.4 it set the floor of every pair in the first identity to have any.
  ruleRatio: 1,
};

const ARRANGEMENTS = ['height', 'width'];

const no = (code, what, why, how) => {
  const e = new Error(what);
  e.findings = [{ level: 'blocker', code, what, why, how }];
  throw e;
};

// ------------------------------------------------------------------ loading

// A partner is a name, an owner and one file per colourway of ours they have
// agreed to stand in. The colourway keys are ours because that is the question
// being asked: on which of our grounds may this mark appear, and in which of
// their versions. They answer it once, and the answer is a file.
function load(fs, path, dir, raw, project) {
  const list = [];
  for (const entry of raw || []) {
    if (!entry || typeof entry !== 'object' || !entry.name) {
      no('partners', 'a partner in assets.partners has no name.',
        'The name goes in the file names, in the manual and in brand.json, and there is nothing to put there.',
        'Give every partner a "name", spelled the way they spell it.');
    }
    const files = entry.files || {};
    const ways = Object.keys(files);
    if (!ways.length) {
      no('partners', `${entry.name} is listed as a partner and no artwork is given for them.`,
        'A partner lockup is half their artwork. Without a file there is nothing to set beside the mark, '
        + 'and the engine will not draw somebody else\'s logo from a description of it.',
        `Add "files" to ${entry.name}, keyed by the colourway of ours their version is for: `
        + '{ "crag": "partners/them.svg" }.');
    }
    const cut = (project.rules.colourways || []).map((c) => c.name);
    const versions = {};
    for (const [way, rel] of Object.entries(files)) {
      if (cut.indexOf(way) < 0) {
        no('partners', `${entry.name} supplies a version for a colourway called "${way}", and this identity does not cut one.`,
          'The key says which of our grounds their artwork is for, so a name we do not use names no ground at all, '
          + `and the file would never be placed. We cut ${cut.join(', ')}.`,
          `Rename the key to one of ours, or add the colourway to rules.colourways.`);
      }
      const p = path.resolve(dir, rel);
      if (!fs.existsSync(p)) {
        no('partners', `${entry.name}'s artwork for "${way}" is listed as ${rel}, and that file is not there.`,
          'A partner lockup cannot be composed from a missing half, and the engine will not substitute one of '
          + 'their other versions: which version goes on which ground is their decision, not ours.',
          `Put the file they supplied at ${rel}, or take the "${way}" entry out until they send it.`);
      }
      const source = fs.readFileSync(p, 'utf8');
      let ink;
      try { ink = geo.inkBox(source); }
      catch (e) {
        no('partners', `${entry.name}'s ${rel} cannot be read as artwork: ${e.message}`,
          'It has to be measured before it can be placed, and nothing in it renders.',
          'Ask them for an SVG export rather than a file saved from a viewer.');
      }
      versions[way] = { file: rel, path: p, source, ink,
        viewBox: svgu.viewBox(svgu.parse(source)),
        minimumSize: geo.minimumSize(source, project.rules),
        slots: svgu.slotsUsed(svgu.parse(source)),
        inks: inksOf(source) };
    }
    list.push({ name: entry.name, owner: entry.owner || entry.name, since: entry.since || null,
      approved: entry.approved || null, versions, colourways: ways });
  }
  return list;
}

// Which colours a file paints, so the engine can ask whether they read on the
// ground we are about to put them on. Their colours, so only ever a question.
function inksOf(source) {
  const found = new Set();
  const doc = svgu.parse(source);
  svgu.eachPainted(doc, (el) => {
    if (!el.getAttribute) return;
    for (const a of ['fill', 'stroke']) {
      const v = el.getAttribute(a);
      if (v && /^#[0-9a-f]{3,8}$/i.test(v.trim())) found.add(v.trim().toUpperCase());
    }
  });
  return [...found];
}

function rules(project) {
  const given = (project.rules && project.rules.partners) || {};
  const r = Object.assign({}, DEFAULTS, given);
  if (ARRANGEMENTS.indexOf(r.match) < 0) {
    no('partners', `rules.partners.match is "${r.match}", and the engine does not know how to size a partner that way.`,
      'Two marks are matched on one measurement or the other, and which one changes the whole pair.',
      `Use "height", which sets their ink to the same height as ours, or "width".`);
  }
  r.with = r.with || (project.rules.lockups || [])[0] || 'horizontal';
  if ((project.rules.lockups || []).indexOf(r.with) < 0) {
    no('partners', `partner lockups are built around "${r.with}", and this identity does not cut that lockup.`,
      'The half that is ours has to be one of the lockups in the package, or the pair contains a file that '
      + 'exists nowhere else and nothing else in the manual describes.',
      `Set rules.partners.with to one of ${(project.rules.lockups || []).join(', ')}.`);
  }
  return r;
}

// ---------------------------------------------------------------- composing

// Ours, theirs, and the rule between them. Nothing here is placed by eye: their
// mark is scaled off the measured ink of ours, the gap is a fraction of it, and
// the dividing rule is a fraction of the thinnest thing we draw — so a pair
// stays a pair at any size, and every partner in the set agrees with every other.
function lockup({ hostSvg, hostInk, partner, way, rule, ink }) {
  const v = partner.versions[way];
  const scale = rule.match === 'height'
    ? (hostInk.h * rule.matchRatio) / v.ink.h
    : (hostInk.w * rule.matchRatio) / v.ink.w;
  const pw = v.ink.w * scale, ph = v.ink.h * scale;
  const gap = hostInk.h * rule.gapRatio;
  // the thinnest thing we draw, so the rule is derived rather than typed
  const hostThin = geo.minimumSize(hostSvg, { minStrokePx: 1, minStrokeMm: 1 }).thinnestStroke || hostInk.h * 0.08;
  const ruleW = rule.rule ? svgu.round(hostThin * rule.ruleRatio, 3) : 0;
  const height = Math.max(hostInk.h, ph);
  const width = hostInk.w + gap + ruleW + gap + pw;
  const parts = [
    { doc: svgu.parse(hostSvg), box: hostInk, x: 0, y: (height - hostInk.h) / 2, scale: 1 },
    { doc: svgu.parse(v.source), box: v.ink, x: hostInk.w + gap + ruleW + gap, y: (height - ph) / 2, scale },
  ];
  let svg = svgu.compose(parts, width, height);
  if (ruleW) {
    const x = svgu.round(hostInk.w + gap + ruleW / 2, 3);
    const bar = `<line x1="${x}" y1="0" x2="${x}" y2="${svgu.round(height, 3)}" `
      + `stroke="${ink}" stroke-width="${ruleW}" stroke-linecap="butt"/>`;
    svg = svg.replace('</svg>', `${bar}</svg>`);
  }
  return { svg, scale: svgu.round(scale, 4), width: svgu.round(width, 3), height: svgu.round(height, 3),
    gap: svgu.round(gap, 3), ruleWidth: ruleW, partnerBox: { w: svgu.round(pw, 3), h: svgu.round(ph, 3) } };
}

// The smallest the pair may go, which is not either brand's own figure.
//
// A minimum size is a width divided by the thinnest thing inside it, and a
// partner lockup has three candidates: what we draw, what they draw at the
// scale we set it, and the rule we put between them. The largest of the three
// floors wins, and it is very often theirs — a mark that holds at 29 px beside
// one that holds at 144 does not make a pair that holds at 29. Nobody can work
// this out from either package alone: their manual states their floor for their
// mark alone, and ours states ours.
function floor(composed, host, partner, way, project) {
  const r = project.rules;
  const v = partner.versions[way];
  const parts = [];
  const add = (label, thin) => { if (thin > 0) parts.push({ label, thin }); };
  add('our half', geo.minimumSize(host, { minStrokePx: 1, minStrokeMm: 1 }).thinnestStroke);
  add('their mark', (v.minimumSize.thinnestStroke || 0) * composed.scale);
  if (composed.ruleWidth) add('the rule between them', composed.ruleWidth);
  const worst = parts.slice().sort((a, b) => a.thin - b.thin)[0];
  const px = Math.ceil((composed.width / worst.thin) * r.minStrokePx);
  return {
    screenPx: px,
    printMm: svgu.round((composed.width / worst.thin) * r.minStrokeMm, 1),
    setBy: worst.label,
    thinnest: svgu.round(worst.thin, 3),
    parts: parts.map((p) => ({ label: p.label, thinnest: svgu.round(p.thin, 3),
      screenPx: Math.ceil((composed.width / p.thin) * r.minStrokePx) })),
  };
}

module.exports = { load, rules, lockup, floor, inksOf, DEFAULTS, contrastOf: contrast };
