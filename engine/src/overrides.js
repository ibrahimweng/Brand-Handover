'use strict';
// The edits a person makes by hand, on top of everything the engine derived.
//
// This engine's whole architecture is that nothing is typed twice: every value
// in every document is measured off the master or worked out from the project,
// so changing the master changes all of it. Editing a document by hand is the
// one thing that breaks that, and it is also the thing anybody actually needs —
// no engine writes a sentence about a mark as well as the person who drew it.
//
// So an edit is not a change to a document. It is a **replacement for one
// derived value**, stored against a key, and re-applied every time the
// documents are built. Change the logo and everything you did not touch is
// derived again; what you touched stays.
//
// The whole of the design is in what the key is. A key of "the third paragraph
// in section 2" is the misuse page's mistake again — two things joined by
// position, right until anything moves. A key names the value: `content/
// markRationale`, `misuse/redraw/why`, `pattern/construction`. Sections can be
// added, removed and renumbered under it and the edit still lands on the thing
// it was about.
//
// And an override records what it replaced. If the derived value has moved
// since — the mark was redrawn, so the measured floor is different, so the
// sentence about it is out of date — the engine can say so instead of quietly
// keeping a stale edit on top of a changed identity. An override is not an
// escape from the engine's answer; it is an answer that has to keep facing it.

const KINDS = {
  text: 'a line of prose',
  choice: 'one of a fixed set',
};

// Which values a person may replace, and what kind each is. Nothing outside
// this list can be overridden: an engine that lets a document be edited
// anywhere is a document the engine no longer knows anything about.
const ALLOWED = [
  { key: 'brand', kind: 'text', what: 'the name on the cover' },
  { key: 'content/positioning', kind: 'text', what: 'the line under the title' },
  { key: 'content/introduction', kind: 'text', what: 'the paragraph after it' },
  { key: 'content/markRationale', kind: 'text', what: 'why the mark is what it is' },
  { key: 'content/constructionNotes', kind: 'text', what: 'how the mark is set out' },
  { key: 'content/colourRationale', kind: 'text', what: 'why these colours' },
  { key: 'content/typeRationale', kind: 'text', what: 'why these typefaces' },
  { key: 'style', kind: 'choice', what: 'the layout the book is built in' },
  { key: 'pattern/motif', kind: 'choice', what: 'the shape the pattern is built from' },
  { key: 'pattern/construction', kind: 'choice', what: 'how the pattern repeats' },
];

// and the ones whose key carries a name in it
const PATTERNS = [
  { re: /^misuse\/[a-z]+\/why$/, kind: 'text', what: 'the reason under a misuse rule' },
  { re: /^colour\/[A-Za-z0-9#]+\/name$/, kind: 'text', what: 'what a colour is called' },
  { re: /^section\/[\d.]+\/title$/, kind: 'text', what: 'the title of a section' },
];

function known(key) {
  const flat = ALLOWED.find((a) => a.key === key);
  if (flat) return flat;
  const p = PATTERNS.find((x) => x.re.test(key));
  return p ? { key, kind: p.kind, what: p.what } : null;
}

const no = (code, what, why, how) => {
  const e = new Error(what);
  e.findings = [{ level: 'blocker', code, what, why, how }];
  throw e;
};

// Read what the project carries. An override the engine cannot place is refused
// rather than ignored: an edit that silently does nothing is worse than one that
// is turned away, because the person who made it goes on believing it took.
function load(project) {
  const raw = (project && project.overrides) || [];
  if (!Array.isArray(raw)) {
    no('overrides', 'overrides is not a list.',
      'It is the edits made by hand, each one replacing a value the engine worked out.',
      'Write it as [{ "at": "content/markRationale", "now": "…", "was": "…" }].');
  }
  const out = [];
  const seen = new Set();
  for (const o of raw) {
    if (!o || typeof o !== 'object' || !o.at) {
      no('overrides', 'an override does not say what it replaces.',
        'Every edit is a replacement for one value the engine derived, and the key is how it finds it again '
        + 'after the identity changes.',
        'Give it an "at": one of ' + ALLOWED.map((a) => a.key).slice(0, 4).join(', ') + ', and so on.');
    }
    const k = known(String(o.at));
    if (!k) {
      no('overrides', `nothing in the documents is called "${o.at}", so that edit has nowhere to land.`,
        'An override replaces a named value. A key that matches nothing would be carried in the project '
        + 'file for ever, doing nothing, while whoever made the edit believed it had taken.',
        `The values that can be replaced are ${ALLOWED.map((a) => a.key).join(', ')}, plus `
        + 'misuse/<rule>/why, colour/<name>/name and section/<number>/title.');
    }
    if (seen.has(o.at)) {
      no('overrides', `"${o.at}" is overridden twice.`,
        'Two replacements for one value: only one of them can win, and which one is an accident of order.',
        'Keep the one you meant.');
    }
    seen.add(o.at);
    out.push({ at: String(o.at), now: o.now, was: o.was === undefined ? null : o.was, kind: k.kind, what: k.what });
  }
  return out;
}

// The value a document should use, and whether it is the engine's or a person's.
function value(list, key, derived) {
  const hit = (list || []).find((o) => o.at === key);
  if (!hit) return { value: derived, edited: false };
  return { value: hit.now, edited: true, was: hit.was, derived };
}

// What has moved underneath an edit.
//
// An override carries what it replaced. When the engine derives that value again
// and gets something different, the edit is sitting on top of a changed
// identity: the mark was redrawn and the sentence about its construction now
// describes the old one. That is not an error — the person may well still mean
// it — but it is the one thing nobody can see by looking at the document, so it
// is said every time.
function stale(list, derivedFor) {
  const out = [];
  for (const o of list || []) {
    if (o.was == null) continue;
    const now = derivedFor(o.at);
    if (now === undefined || now === null) continue;
    if (String(now) === String(o.was)) continue;
    out.push({ at: o.at, what: o.what, was: o.was, becomes: now, kept: o.now });
  }
  return out;
}

// What the package writes beside the artwork, so the edits travel with it. There
// is no account and no database: the thing that comes back is the thing that
// went out, and this is the half of it that is not the drawing.
function file(list, project) {
  return JSON.stringify({
    brand: project.brand,
    version: project.version,
    note: 'These are the values that were changed by hand. Everything not listed here is derived from the '
      + 'master artwork every time the package is built. Put this file back beside the artwork and the '
      + 'edits come back with it; delete a line and that value goes back to what the engine works out.',
    overrides: (list || []).map((o) => ({ at: o.at, what: o.what, was: o.was, now: o.now })),
  }, null, 2);
}

module.exports = { ALLOWED, PATTERNS, KINDS, known, load, value, stale, file };
