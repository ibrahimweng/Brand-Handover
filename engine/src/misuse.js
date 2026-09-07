'use strict';
// The page that says what not to do.
//
// A misuse page is a set of pairs: a picture of the mark treated badly, and a
// sentence naming the treatment. The engine drew six pictures in a fixed order
// — stretched, rotated, recoloured, shadowed, on a busy ground, outlined — and
// captioned them with whatever sentences the project happened to list, in the
// order it happened to list them. Nothing joined a sentence to the picture
// above it except the index of an array.
//
// Measured across the thirty packages built before this module existed: 132
// misuse cells, of which **33 showed a picture that contradicts its own
// caption** and 18 more carried a caption about something the engine cannot
// draw at all, so the picture beside it was arbitrary. Ravelston's manual
// printed "Do not add a drop shadow to make it look engraved" over a mark with
// no shadow on it, and "Do not place it on a photograph without the reversed
// lockup" over an outlined one. Thirteen projects wrote "Do not crowd it" and
// got a mark on a striped green ground, because the engine has never had a way
// to draw crowding at all. Eight of the thirty had no misuse rules, and got a
// numbered heading, a "Drawn by the system" badge and an empty box.
//
// The only page in the manual whose whole job is to be unambiguous was the one
// page in it that could not be trusted. So a misuse rule is not a sentence any
// more. It names a treatment the engine can perform on this identity's own
// artwork, the engine draws that treatment and writes the sentence that goes
// with it, and the designer's reason — the part a machine cannot know — follows
// underneath in their own words.
//
// Two things fall out of that, and both are worth having. A project can only
// forbid what the engine can draw, so a rule about redrawing a part of the mark
// requires the artwork to name that part (see data-part, added in the
// twenty-eighth round). And a rule can now be checked against the rest of the
// identity: an ident whose mark turns cannot also have a manual page saying
// never rotate it, and until this module existed nothing would have noticed.
const svgu = require('./svg');

// What the engine can do to a drawing, and what it needs to be told to do it.
// Adding one here is the whole of adding a treatment: the caption comes from
// src/strings.js by the same key, and the picture from documents/blocks.js.
const TREATMENTS = {
  // proportion and placement
  stretch:   { needs: null,   draws: 'the mark scaled on one axis only' },
  rotate:    { needs: null,   draws: 'the mark turned off its baseline' },
  crowd:     { needs: null,   draws: 'the clear space rule with type and rules set inside it' },
  undersize: { needs: null,   draws: 'the mark below the floor measured for it' },
  // colour and finish
  recolour:  { needs: null,   draws: 'the mark in an ink that is not in the palette' },
  shadow:    { needs: null,   draws: 'the mark with a drop shadow under it' },
  outline:   { needs: null,   draws: 'the mark hollowed out and keylined' },
  busy:      { needs: null,   draws: 'the mark on a ground it has to compete with' },
  // the drawing itself
  redraw:    { needs: 'part', draws: 'the mark with one named part taken out of it' },
  retype:    { needs: null,   draws: 'the name set in a face that is not the identity’s' },
};

const NAMES = Object.keys(TREATMENTS);

const no = (code, what, why, how) => {
  const e = new Error(what);
  e.findings = [{ level: 'blocker', code, what, why, how }];
  throw e;
};

// Levenshtein, short and good enough to catch a typed treatment name.
function nearest(word, list) {
  let best = null, score = Infinity;
  for (const cand of list) {
    const a = String(word).toLowerCase(), bs = cand.toLowerCase();
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i].concat(new Array(bs.length).fill(0)));
    for (let j = 0; j <= bs.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= bs.length; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1,
          d[i - 1][j - 1] + (a[i - 1] === bs[j - 1] ? 0 : 1));
      }
    }
    if (d[a.length][bs.length] < score) { score = d[a.length][bs.length]; best = cand; }
  }
  return score <= 3 ? best : null;
}

const LIST = () => NAMES.join(', ');

// Read content.misuse. Every entry names a treatment; the sentence the reader
// sees is written from the treatment, and `why` is the designer's reason for it.
function load(project) {
  const raw = (project.content && project.content.misuse) || [];
  if (!Array.isArray(raw)) {
    no('misuse', 'content.misuse is not a list.',
      'The misuse page is a row of cells and this is what fills them.',
      'Write it as a list of rules: [{ "do": "stretch", "why": "..." }].');
  }
  const master = project.assets[(project.assets.mark ? 'mark' : 'wordmark')];
  const parts = master ? svgu.partsUsed(svgu.parse(master.source)) : [];
  const out = [];
  for (const entry of raw) {
    if (typeof entry === 'string') {
      no('misuse', `content.misuse holds the sentence "${entry.slice(0, 48)}${entry.length > 48 ? '…' : ''}"`
        + ' and nothing that says what the picture beside it should show.',
        'The engine drew a fixed sequence of treatments and captioned them in the order the sentences '
        + 'happened to be written, so the picture and the words under it agreed only by luck. Across the '
        + 'thirty packages built before this check existed, a quarter of the cells contradicted their own '
        + 'caption.',
        `Name the treatment and give the reason separately: { "do": "stretch", "why": ${JSON.stringify(entry)} }. `
        + `The treatments are ${LIST()}.`);
    }
    if (!entry || typeof entry !== 'object' || !entry.do) {
      no('misuse', 'a rule in content.misuse does not say what it forbids.',
        'A cell on the misuse page is a picture of one treatment. Without the treatment there is nothing to draw.',
        `Give it a "do": one of ${LIST()}.`);
    }
    const key = String(entry.do);
    if (!TREATMENTS[key]) {
      const guess = nearest(key, NAMES);
      no('misuse', `content.misuse forbids "${key}", which is not something the engine can draw.`,
        'Every cell on the misuse page is the identity’s own artwork with one thing done to it. A rule '
        + 'the engine cannot perform would be a caption over an untouched mark, which reads as though the '
        + 'mark in front of the reader is the wrong one.',
        (guess ? `Did you mean "${guess}"? ` : '') + `The treatments are ${LIST()}.`);
    }
    const t = TREATMENTS[key];
    if (t.needs === 'part') {
      if (!entry.part) {
        no('misuse', `the "${key}" rule does not say which part of the drawing it is about.`,
          `It draws ${t.draws}, and without a name there is no part to take out.`,
          parts.length
            ? `Add "part": one of ${parts.join(', ')} — the parts this artwork names.`
            : 'This artwork names no parts. Put data-part on the pieces of the master SVG first, then '
              + 'name one here. A rule about a part of a drawing needs the drawing to say what its parts are.');
      }
      if (parts.indexOf(entry.part) < 0) {
        no('misuse', `the "${key}" rule is about a part called "${entry.part}", and the artwork has no such part.`,
          'The picture is made by removing that part from the master file, so a name that matches nothing '
          + 'removes nothing and the cell shows a perfectly correct mark under a rule forbidding it.',
          parts.length ? `The parts this artwork names are ${parts.join(', ')}.`
            : 'This artwork names no parts at all. Put data-part on the pieces of the master SVG first.');
      }
    }
    out.push({ do: key, part: entry.part || null, why: entry.why || null });
  }
  const seen = out.map((r) => r.do);
  const twice = seen.find((k, i) => seen.indexOf(k) !== i);
  if (twice !== undefined) {
    no('misuse', `content.misuse forbids ${twice} twice.`,
      'Both cells would show the same picture, so the page asks the reader to work out what is different '
      + 'about two identical images. If there are two reasons, they are one rule with two reasons.',
      'Say it once, and put both reasons in the one "why".');
  }
  return out;
}

// A rule can be wrong about the identity it belongs to. The manual is the only
// place these two facts meet, and nothing has ever compared them.
function contradictions(list, project, measured) {
  const out = [];
  const has = (k) => list.some((r) => r.do === k);
  const motion = (project.system || {}).motion || {};
  const turns = (motion.build || []).filter((s) => s.how === 'turns');
  if (has('rotate') && turns.length) {
    out.push({ level: 'blocker', code: 'misuseIsUsage',
      what: `the manual says never rotate the ${measured.master === 'wordmark' ? 'logotype' : 'mark'}, `
        + `and the ident turns ${turns.map((s) => s.part).join(' and ')}.`,
      why: 'One of the two is wrong, and a reader who watches the ident and then reads the page cannot tell '
        + 'which. A rule the identity itself breaks is worse than no rule, because it teaches the reader '
        + 'that the rules on this page are decoration.',
      how: 'If the mark turns, drop the rotate rule and say in the ident section what the turn is for. If it '
        + 'does not, take the turn out of system.motion.build.' });
  }
  if (has('retype') && project.nameSetting) {
    out.push({ level: 'blocker', code: 'misuseIsUsage',
      what: 'the manual says the name is artwork and must not be retyped, and this identity sets its name '
        + `in the ${project.nameSetting.family} face rather than drawing it.`,
      why: 'Setting the name is exactly what "retype" means. The rule forbids the way the package itself '
        + 'makes the wordmark, so the first person to follow it will rebuild the identity wrongly.',
      how: 'Drop the retype rule. What this identity needs said instead is that the name is set at a stated '
        + 'size in a stated face, which section 1.1 already says.' });
  }
  return out;
}

module.exports = { TREATMENTS, NAMES, load, contradictions };
