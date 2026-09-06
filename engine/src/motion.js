'use strict';
// Making the mark move.
//
// Every package this engine has built states how the identity animates: two
// easing curves, four durations, and a build sequence naming the parts and when
// each of them arrives. Twenty-seven identities shipped that, the manual printed
// it — "the mark builds in 2 parts: outline draws from the top, fill rises to
// its line" — and two things were true of all of them. No artwork named a part
// called outline, or fill, or anything else. And no package contained a single
// file that moves.
//
// So the client was handed a specification for an animation, in prose, about
// parts that do not exist, with nothing to play. It is the same shape as the
// twenty-second round's brand.json: a promise nothing collects on, kept in
// perfectly good order for twenty-seven rounds because nobody asked it for
// anything.
//
// The contract is the one the colour system already uses. data-slot says what a
// part is painted from. data-part says what it is when the mark builds, and the
// sequence may only name parts the artwork has.
const svgu = require('./svg');

// What a part can be asked to do, and what that costs it.
const HOWS = {
  draws: { needsStroke: true,
    why: 'a stroke can be given a dash the length of itself and then have the dash moved off the end, '
      + 'which is how a line draws. A fill has no length to dash' },
  rises: { needsStroke: false, why: 'it moves up into place and fades in' },
  fades: { needsStroke: false, why: 'it fades in where it already is' },
  turns: { needsStroke: false, why: 'it rotates into place about the middle of the drawing' },
};

const no = (code, what, why, how) => {
  const e = new Error(what);
  e.findings = [{ level: 'blocker', code, what, why, how }];
  throw e;
};

// -------------------------------------------------------------- the checking

// The sequence, against the artwork it claims to move.
function check(rules, source) {
  const doc = svgu.parse(source);
  const have = svgu.partsUsed(doc);
  const build = rules.build || [];
  const findings = [];
  const named = build.map((b) => b.part);

  const missing = named.filter((p) => have.indexOf(p) < 0);
  if (missing.length) {
    no('motion', `the build sequence moves ${missing.map((m) => `"${m}"`).join(' and ')}, and the artwork has `
      + `${have.length ? `no part of that name — it names ${have.map((h) => `"${h}"`).join(', ')}` : 'no named parts at all'}.`,
      'The manual prints this sequence as the specification for how the identity animates, and the package '
      + 'writes a file that plays it. Neither can act on the name of something that is not in the drawing, so '
      + 'what got shipped was a paragraph about parts nobody could find.',
      have.length
        ? `Use ${have.map((h) => `"${h}"`).join(', ')}, which is what the artwork names.`
        : 'Mark the parts in the master with data-part — data-slot says what a part is painted from, '
          + 'data-part says what it is when the mark builds — and name those.');
  }
  for (const b of build) {
    const spec = HOWS[b.how];
    if (!spec) {
      no('motion', `the build sequence asks "${b.part}" to ${b.how ? `"${b.how}"` : 'do nothing in particular'}, `
        + 'which is not something the engine knows how to make a shape do.',
        'Every one of these is a different piece of CSS, and one that has none is a step in the sequence that '
        + 'plays as a gap.',
        `Use one of ${Object.keys(HOWS).join(', ')}.`);
    }
    if (!(Number(b.to) > Number(b.from)) || !(Number(b.from) >= 0)) {
      no('motion', `"${b.part}" is timed from ${b.from} to ${b.to} ms.`,
        'A step that ends before it begins has no duration, so it either never plays or snaps into place, and '
        + 'the timeline the manual prints is wrong about the whole sequence after it.',
        'Give it a "from" of zero or more and a "to" after it.');
    }
    if (spec.needsStroke && svgu.partIsStroked(doc, b.part) === false) {
      findings.push({ level: 'warning', code: 'motionHow',
        what: `"${b.part}" is asked to draw itself, and it is a fill rather than a stroke.`,
        why: `To draw, ${spec.why}. It is written as a fade instead, which is the nearest thing that works, `
          + 'so the sequence plays and one step of it is not the step that was specified.',
        how: `Either draw ${b.part} as a stroke in the master, or ask it to rise or fade, which is what a `
          + 'filled shape can do.' });
    }
  }
  const still = have.filter((p) => named.indexOf(p) < 0);
  if (still.length) {
    findings.push({ level: 'warning', code: 'motionStill',
      what: `the artwork names ${still.map((s) => `"${s}"`).join(', ')} and the build sequence never `
        + `${still.length === 1 ? 'moves it' : 'moves them'}.`,
      why: 'A named part that no step touches is on screen from the first frame, before anything else arrives, '
        + 'which reads as the animation having already started when the viewer got there.',
      how: `Give ${still.join(', ')} a step, or take the data-part off ${still.length === 1 ? 'it' : 'them'} `
        + 'so the drawing does not claim something that never happens.' });
  }
  return { findings, parts: have, ordered: build.slice().sort((a, b2) => a.from - b2.from) };
}

// ------------------------------------------------------------------ emitting

const cubic = (e) => `cubic-bezier(${e.join(', ')})`;

// One file that plays the sequence, and holds the finished mark when it stops.
//
// Self contained: the CSS is inside the SVG, the artwork is the master's own,
// and nothing is fetched. A reader who has asked their machine for less movement
// gets the finished mark and no animation at all, which is not a degraded
// version of this file — it is the mark.
function animate(source, rules, { id = 'b' } = {}) {
  const doc = svgu.parse(source);
  const total = Math.max(...(rules.build || []).map((b) => Number(b.to)), 0);
  const css = [];
  for (const b of rules.build || []) {
    const spec = HOWS[b.how] || HOWS.fades;
    const how = spec.needsStroke && svgu.partIsStroked(doc, b.part) === false ? 'fades' : b.how;
    const ease = cubic((rules.easing || {})[b.ease] || [0, 0.55, 0.45, 1]);
    const dur = Number(b.to) - Number(b.from);
    const sel = `#${id} [data-part="${b.part}"]`;
    const key = `${id}-${b.part}`;
    if (how === 'draws') {
      css.push(`${sel}{stroke-dasharray:var(--len);stroke-dashoffset:var(--len);`
        + `animation:${key} ${dur}ms ${ease} ${b.from}ms forwards}`);
      css.push(`@keyframes ${key}{to{stroke-dashoffset:0}}`);
    } else if (how === 'rises') {
      css.push(`${sel}{opacity:0;transform:translateY(6%);transform-origin:50% 50%;`
        + `animation:${key} ${dur}ms ${ease} ${b.from}ms forwards}`);
      css.push(`@keyframes ${key}{to{opacity:1;transform:translateY(0)}}`);
    } else if (how === 'turns') {
      css.push(`${sel}{opacity:0;transform:rotate(-12deg);transform-origin:50% 50%;`
        + `animation:${key} ${dur}ms ${ease} ${b.from}ms forwards}`);
      css.push(`@keyframes ${key}{to{opacity:1;transform:rotate(0)}}`);
    } else {
      css.push(`${sel}{opacity:0;animation:${key} ${dur}ms ${ease} ${b.from}ms forwards}`);
      css.push(`@keyframes ${key}{to{opacity:1}}`);
    }
  }
  // A stroke has to know its own length before it can be dashed by it, and the
  // length is the one thing here that cannot be worked out from the path data
  // without a renderer. pathLength lets the file state it as 1, so the dash is
  // in units of the whole line whatever shape it is.
  let body = svgu.innerXML(doc)
    .replace(/<path /g, '<path pathLength="1" ')
    .replace(/style="--len:[^"]*"/g, '');
  css.unshift(`#${id} [data-part]{--len:1}`);
  const vb = svgu.viewBox(doc);
  const reduce = `@media (prefers-reduced-motion:reduce){#${id} [data-part]{animation:none!important;`
    + `opacity:1!important;transform:none!important;stroke-dashoffset:0!important}}`;
  return {
    svg: `<?xml version="1.0" encoding="UTF-8"?>\n`
      + `<!-- ${total} ms. Plays once and holds. The parts are the ones the master names.\n`
      + `     A reader who has asked for less movement gets the finished mark and no animation. -->\n`
      + `<svg xmlns="http://www.w3.org/2000/svg" id="${id}" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" `
      + `width="${vb.w}" height="${vb.h}" role="img" aria-label="The mark, building in `
      + `${(rules.build || []).length} parts.">\n<style>\n${css.join('\n')}\n${reduce}\n</style>\n`
      + `${body}\n</svg>\n`,
    totalMs: total,
  };
}

module.exports = { HOWS, check, animate, cubic };
