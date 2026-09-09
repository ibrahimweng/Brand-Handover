'use strict';
// The engine's own documents.
//
// The twenty-fourth round taught this engine to ask whether the identity's
// colours can be told apart, and the manual has printed a WCAG contrast table
// since the first week. It measures the client's palette against the grounds the
// client will set text on, in a document whose own captions are set at ten and a
// half pixels in a grey that measures 3.18 to 1.
//
// Twenty-eight identities. Every caption, every column heading, every chapter
// number and the footer of every manual, deck and published page, in both
// themes, below the standard the page beside them applies. The engine checked
// the identity's accessibility and had never once checked its own.
//
// So this reads the stylesheet the documents actually ship — not a copy of its
// values — works out which token is used at which size, and measures every pair
// against the ground it sits on, in each theme. Then it reads the HTML for the
// things a document has to get right whatever it is about: one first level
// heading, no level skipped, a landmark to skip to, and an accessible name on
// everything that carries meaning.
const contrast = require('./contrast');

// WCAG 2.2 1.4.3: 4.5 to 1 for text, 3 to 1 for text that is large — 18.66 px,
// or 14 px when it is bold. The engine works in CSS pixels because that is what
// the stylesheet is written in.
const LARGE_PX = 18.66;
const LARGE_BOLD_PX = 14;
const isLarge = (px, weight) => px >= LARGE_PX || (px >= LARGE_BOLD_PX && Number(weight) >= 700);
const needs = (px, weight) => (isLarge(px, weight) ? 3 : 4.5);

// ------------------------------------------------------------- the stylesheet

// Every `--name: value` in a block.
const varsIn = (block) => Object.fromEntries(
  [...String(block).matchAll(/--([\w-]+)\s*:\s*([^;]+)/g)].map((m) => [m[1], m[2].trim()]));

// The token blocks a document ships: a base palette on :root, and whatever a
// theme redefines on top of it.
//
// This read one convention — light on :root, dark in a media query — because
// that is how the manual is written. The deck and the published page are
// written the other way round, dark on :root with the light palette in
// `prefers-color-scheme: light` and `[data-theme=light]`, so both came back
// with the dark palette twice and their light one was never measured at all.
// Read the blocks and let each say which theme it is for. `:not([data-theme=
// dark])` is a light selector and has to not look like a dark one.
const ROOT_BLOCK = /(@media[^{]*\{\s*)?(:root[^{,]*)\{([^}]*)\}/g;
const saysTheme = (media, sel, which) =>
  new RegExp(`prefers-color-scheme:\\s*${which}`).test(media)
  || new RegExp(`(?<!:not\\()\\[data-theme=["']?${which}`).test(sel);

function themes(css) {
  const base = {}, light = {}, dark = {};
  for (const m of String(css).matchAll(ROOT_BLOCK)) {
    const media = (m[1] || '').toLowerCase();
    const vars = varsIn(m[3]);
    if (!Object.keys(vars).length) continue;
    Object.assign(saysTheme(media, m[2], 'dark') ? dark
      : saysTheme(media, m[2], 'light') ? light : base, vars);
  }
  return { light: Object.assign({}, base, light), dark: Object.assign({}, base, dark) };
}

// A document's own tokens, as opposed to the identity's.
//
// The section this feeds is called "text in the documents' own type", and the
// deck sets a chapter number in the brand's accent on a slide painted in the
// brand's primary. That is the identity, measured elsewhere and to a different
// question; reading it here scored it against the shell it is nowhere near.
//
// Which is which is in the stylesheet rather than in a list kept by hand: the
// document's own tokens are the ones every block that declares the page ground
// declares. A theme block redefines the chrome and leaves the identity alone,
// because a reader's light or dark preference is not allowed to change what
// colour the brand is.
function ownTokens(css, ground) {
  const blocks = [];
  for (const m of String(css).matchAll(ROOT_BLOCK)) {
    const names = Object.keys(varsIn(m[3]));
    if (names.includes(ground)) blocks.push(names);
  }
  if (blocks.length < 2) return null;                 // one palette says nothing
  return new Set(blocks.reduce((a, b) => a.filter((n) => b.includes(n))));
}

// Which token each rule paints in, and how big. A rule that sets a colour and no
// size inherits one, so it is measured at the smallest size any of its ancestors
// could give it — which for a document body is the body size. Rules that set no
// colour are not text and are skipped.
function textRules(css, bodyPx = 14) {
  const out = [];
  for (const m of String(css).matchAll(/([^{}@]+)\{([^}]*)\}/g)) {
    const sel = m[1].trim(), body = m[2];
    if (!sel || sel.startsWith('@') || /^(:root|\*)$/.test(sel)) continue;
    const colour = /(?:^|;|\s)color\s*:\s*var\(--([\w-]+)\)/.exec(body);
    if (!colour) continue;
    const size = /font-size\s*:\s*(?:clamp\([^,]+,[^,]+,\s*)?([\d.]+)px/.exec(body);
    const weight = /font-weight\s*:\s*(\d+)/.exec(body);
    // An element that paints its own ground is measured against that ground and
    // not against the page. Without this, a reversed band — white on the ink,
    // which is a normal thing for a chapter opener to be — is scored as paper
    // on paper and reported as failing at 1 to 1. The same shape of mistake as
    // taking the page's ground to be --surface: the arithmetic was right and it
    // was pointed at the wrong thing.
    const own = /(?:^|;|\s)background(?:-color)?\s*:\s*var\(--([\w-]+)\)/.exec(body);
    out.push({ selector: sel, token: colour[1], own: own ? own[1] : null,
      px: size ? Number(size[1]) : bodyPx, stated: !!size,
      weight: weight ? Number(weight[1]) : 400 });
  }
  return out;
}

// The ground a rule's text sits on.
//
// Read off the stylesheet, not assumed. The first version of this took the
// page's ground to be --surface, because that is what a token called surface
// sounds like; the page paints --paper, which is a shade darker, and the
// difference is the whole answer — 4.47 against 4.59 for a figure that has to
// clear 4.5. A browser found it in one measurement and the arithmetic here had
// been agreeing with itself.
function pageGround(css) {
  // `body` is not always the whole selector. The published page writes
  // `html,body{...}`, so this found nothing there and fell through to a token
  // that page does not have — and with no ground, nothing on it was measured.
  const m = /(?:^|})\s*([^{}@]*\bbody\b[^{}@]*)\{[^}]*background\s*:\s*var\(--([\w-]+)\)/.exec(css);
  return m ? m[2] : 'surface';
}

function groundFor(sel, vars, ground) {
  if (/\.stage|\.chip .sw|\.cp\b/.test(sel)) return null;      // brand colour, not chrome
  if (/\.face|\.chip\b/.test(sel)) return vars.surface || vars[ground];
  return vars[ground] || vars.surface;
}

// -------------------------------------------------------------------- reading

function chromeContrast(css, { minTextRatio = null } = {}) {
  const t = themes(css);
  const rules = textRules(css);
  const ground = pageGround(css);
  const own = ownTokens(css, ground);
  const out = [];
  for (const [theme, vars] of Object.entries(t)) {
    for (const r of rules) {
      if (own && !own.has(r.token)) continue;         // the identity's colour, not the document's
      const fg = vars[r.token];
      const bg = (r.own && vars[r.own]) || groundFor(r.selector, vars, ground);
      if (!fg || !bg) continue;
      const ratio = contrast.ratio(fg, bg);
      if (ratio == null) continue;
      const want = minTextRatio || needs(r.px, r.weight);
      out.push({ theme, selector: r.selector, token: r.token, hex: fg, on: bg,
        px: r.px, stated: r.stated, weight: r.weight,
        ratio: Number(ratio.toFixed(2)), needs: want, passes: ratio >= want });
    }
  }
  return out;
}

// ------------------------------------------------------------------ structure

const TAGS = (html, tag) => [...String(html).matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'gi'))].map((m) => m[0]);

// Whether the document is written in the language it says it is.
//
// The twenty-ninth round checked that a language was declared and never asked
// whether it was true. Maayan's manual carried lang="he" dir="rtl" around 988
// English words and twenty-one Hebrew ones, so a speech synthesiser was told to
// read English in Hebrew — which is worse than saying nothing, because it is
// said with confidence. Counting scripts is a coarse test and it is the one that
// catches this: a page whose prose is almost entirely in a script its declared
// language does not use is not in that language.
const SCRIPTS = [
  { name: 'latin', re: /[A-Za-z\u00C0-\u024F]/g, langs: /^(en|fr|de|es|it|pt|nl|da|sv|no|fi|pl|cs|tr|cy|ga|gd|is|hu|ro|hr|sl|sk|lt|lv|et|vi|id|ms|sw|af|eu|ca|gl)$/ },
  { name: 'hebrew', re: /[\u0590-\u05FF]/g, langs: /^(he|yi)$/ },
  { name: 'arabic', re: /[\u0600-\u06FF]/g, langs: /^(ar|fa|ur)$/ },
  { name: 'cyrillic', re: /[\u0400-\u04FF]/g, langs: /^(ru|uk|bg|sr|mk|be|kk)$/ },
  { name: 'greek', re: /[\u0370-\u03FF]/g, langs: /^el$/ },
  { name: 'cjk', re: /[\u3040-\u30FF\u4E00-\u9FFF]/g, langs: /^(ja|zh|ko)$/ },
];

// A run of the brand's own script inside a block that is not in the brand's
// language.
//
// The thirty-sixth round marked the machine readable file `lang="en"`, because
// brand.json is English whatever the brand is and a page carrying several
// thousand English characters under lang="he" is a page a speech synthesiser
// reads wrong. That was right about the block and wrong about what is inside
// it: the file holds the brand's own name, and the misuse rules the project
// wrote, and its colour rationale. So a screen reader said מעיין in an English
// voice — the same fault the whole language mechanism exists to stop, one level
// further down, and invisible to every check that reads markup or pixels.
//
// The text handed in is already escaped. A script's characters are never part
// of an entity, so matching runs of them is safe.
function markScript(escaped, lang, dir) {
  const want = String(lang || '').toLowerCase().split(/[-_]/)[0];
  const sc = SCRIPTS.find((x) => x.langs.test(want));
  if (!sc || sc.name === 'latin') return escaped;
  const re = new RegExp(`(?:${sc.re.source})+(?:[\\s\u3001\u3002\u30fb.,!?:;'\u2019-]*(?:${sc.re.source})+)*`, 'g');
  return String(escaped).replace(re, (run) =>
    `<span lang="${want}"${dir && dir !== 'ltr' ? ` dir="${dir}"` : ''}>${run}</span>`);
}

// Text that carries no lang of its own, so the document's claim applies to it.
function unmarkedText(html) {
  let s = String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ');
  // Drop every element that names its own language, with its content — but not
  // <html>, whose declaration is the claim being tested rather than an exception
  // to it. Stripping that first left three characters of text and the check
  // returned "too little prose to judge" on every page in the repository.
  for (let i = 0; i < 8; i++) {
    const next = s.replace(/<(?!html\b|body\b)(\w+)[^>]*\slang="[^"]*"[^>]*>[\s\S]*?<\/\1>/gi, ' ');
    if (next === s) break;
    s = next;
  }
  return s.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ');
}

function language(html) {
  const decl = /<html[^>]*\slang="([^"]*)"/.exec(html);
  if (!decl) return null;
  const lang = decl[1].toLowerCase().split(/[-_]/)[0];
  const text = unmarkedText(html);
  const counts = SCRIPTS.map((sc) => ({ name: sc.name, langs: sc.langs,
    n: (text.match(sc.re) || []).length }));
  const total = counts.reduce((a, c) => a + c.n, 0);
  if (total < 200) return null;                    // too little prose to judge
  const top = counts.slice().sort((a, b) => b.n - a.n)[0];
  const mine = counts.find((c) => c.langs.test(lang));
  const share = mine ? mine.n / total : 0;
  return { lang, total, top: top.name, topShare: Number((top.n / total).toFixed(3)),
    ownShare: Number(share.toFixed(3)), ok: share >= 0.5 };
}

// What a browser lays out, which is not what the file contains. A page that
// inlines its own scripts carries markup inside them — the canvas ships
// render.js and publish.js as text, and those hold an <h1> and forty-nine
// <svg>. Counting those found a heading outline and forty-one unnamed drawings
// on a page that has neither.
const layout = (html) => String(html)
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');

// A run of one script inside an element that declares a language written in
// another.
//
// `language` asks whether the page is written in what it says, and it cannot
// see this: it strips every element that carries a lang of its own, which is
// exactly where this hides. The machine readable file is marked lang="en" —
// correctly, because brand.json is English whatever the brand is — and it holds
// the brand's own name, so a screen reader said מעיין as five Hebrew letter
// names in an English voice. A browser found it; this is so it cannot come back
// between browser runs.
function foreignScript(html) {
  const src = String(html);
  const out = [];
  // Every element that declares a language, not only the outermost ones. The
  // first version scanned with a global regex, so the <html lang> match ate the
  // whole document and the <pre lang> inside it — which is the case this exists
  // for — was never looked at.
  const open = /<(\w+)((?:"[^"]*"|'[^']*'|[^>"'])*?)\slang="([^"]+)"((?:"[^"]*"|'[^']*'|[^>"'])*)>/gi;
  for (const m of src.matchAll(open)) {
    const tag = m[1].toLowerCase();
    const want = m[3].toLowerCase().split(/[-_]/)[0];
    // the element's own content, found by counting its own kind
    let depth = 1, k = m.index + m[0].length;
    const step = new RegExp(`<(/?)${tag}\\b`, 'gi');
    step.lastIndex = k;
    let end = src.length, hit;
    while ((hit = step.exec(src))) {
      depth += hit[1] ? -1 : 1;
      if (depth === 0) { end = hit.index; break; }
    }
    let inner = src.slice(k, end);
    // anything inside that declares its own language is that language's
    // business, and is reached on its own pass through this loop
    for (let n = 0; n < 8; n++) {
      const next = inner.replace(/<(\w+)[^>]*\slang="[^"]*"[^>]*>[\s\S]*?<\/\1>/gi, ' ');
      if (next === inner) break;
      inner = next;
    }
    const text = inner.replace(/<[^>]+>/g, ' ');
    for (const sc of SCRIPTS) {
      if (sc.name === 'latin' || sc.langs.test(want)) continue;
      const found = text.match(new RegExp(`(?:${sc.re.source})+`, 'g'));
      if (!found) continue;
      const run = found.sort((a, b) => b.length - a.length)[0];
      if (run.length < 2) continue;
      out.push({ tag, lang: want, script: sc.name, run: run.slice(0, 24) });
      break;
    }
  }
  return out;
}

function structure(source) {
  const html = layout(source);
  const found = [];
  // `html` rather than `source`: layout() has taken the scripts and styles out,
  // and the canvas inlines its own source, comments and all — one of which
  // quotes Hebrew to explain why the cover page needed a name.
  for (const f of foreignScript(html)) {
    found.push({ code: 'langInside', level: 'warning',
      what: `"${f.run}" is ${f.script} and sits inside an element that says it is in ${f.lang}.`,
      why: 'A screen reader takes its voice from the nearest declaration, and a voice handed a script it '
        + 'does not read spells the letters out one at a time rather than reading words. '
        + 'The page-level check cannot see this: it drops every element that carries a language of its own, '
        + 'which is where this hides.',
      how: 'Mark the run with the language it is in, the way the brand\'s own words are marked everywhere else.' });
  }
  const levels = [...html.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
  const h1 = levels.filter((l) => l === 1).length;
  if (h1 !== 1) {
    found.push({ code: 'headingTop', level: h1 ? 'warning' : 'blocker',
      what: h1 === 0 ? 'the page has no first level heading.' : `the page has ${h1} first level headings.`,
      why: 'A screen reader reads the heading outline before the page. With none there is nothing to read; '
        + 'with several there is no way to tell which of them the page is about.',
      how: 'Give the page one <h1> and make every other heading a level below it.' });
  }
  let prev = 0, skipped = [];
  for (const l of levels) { if (prev && l > prev + 1) skipped.push(`${prev} to ${l}`); prev = l; }
  if (skipped.length) {
    found.push({ code: 'headingOrder', level: 'warning',
      what: `the heading outline skips a level: ${skipped.join(', ')}.`,
      why: 'The outline is how anybody who is not reading every word finds their way through the page, and a '
        + 'gap in it reads as a section that has gone missing.',
      how: 'Use the next level down, and let the stylesheet decide how big it looks.' });
  }
  if (!/<main\b/.test(html)) {
    found.push({ code: 'landmark', level: 'warning',
      what: 'the page has no <main>.',
      why: 'Skipping to the content is the first thing anybody navigating by landmarks does, and there is '
        + 'nothing here to skip to.',
      how: 'Wrap the body of the page in <main>.' });
  }
  const svgs = TAGS(html, 'svg');
  const anon = svgs.filter((s) => !/aria-label|aria-labelledby|aria-hidden/.test(s));
  if (anon.length) {
    found.push({ code: 'graphicName', level: 'warning',
      what: `${anon.length} of the ${svgs.length} drawings on this page have no accessible name and are not `
        + 'hidden from assistive technology.',
      why: 'Each is announced as an unlabelled graphic, or skipped, depending on the reader. A specimen of the '
        + 'mark in a colourway means something and should say what; a rule between two blocks means nothing '
        + 'and should say so.',
      how: 'Give every drawing that carries meaning an aria-label, and everything decorative aria-hidden="true".' });
  }
  const imgs = TAGS(html, 'img').filter((i) => !/\salt=/.test(i));
  if (imgs.length) {
    found.push({ code: 'imgAlt', level: 'warning',
      what: `${imgs.length} images have no alt attribute.`,
      why: 'An image with no alt is announced by its file name, which is never what the image is.',
      how: 'Give each one an alt, or alt="" where it is decorative.' });
  }
  const tabs = (html.match(/tabindex="[1-9]/g) || []).length;
  if (tabs) {
    found.push({ code: 'tabindex', level: 'warning',
      what: `${tabs} elements set a positive tabindex.`,
      why: 'A positive tabindex takes an element out of the document order and puts it in front of everything '
        + 'else, so the keyboard order stops matching the reading order for the whole page.',
      how: 'Use 0, or nothing at all, and order the markup the way it should be read.' });
  }
  const lg = language(html);
  if (lg && !lg.ok) {
    found.push({ code: 'langWrong', level: 'blocker',
      what: `the page says it is in ${lg.lang} and ${Math.round(lg.topShare * 100)} per cent of the text on it `
        + `that carries no language of its own is ${lg.top}.`,
      why: 'A speech synthesiser told the page is in one language and handed another reads it with that '
        + "language's sounds, which is worse than being told nothing at all — it is said with confidence. And "
        + 'a right to left document made of left to right prose is laid out backwards: headings against the '
        + 'wrong edge, section numbers after their titles.',
      how: 'A document is in the language it is written in. Set that on the page, and put the language of '
        + 'anything else — the brand\'s name, its own words, a sample of its type — on those elements.' });
  }
  if (!/<html[^>]*\slang=/.test(html)) {
    found.push({ code: 'lang', level: 'warning',
      what: 'the page does not say what language it is in.',
      why: 'A speech synthesiser reads the page in whatever language it guessed, and the guess is usually the '
        + "reader's own rather than the document's.",
      how: 'Set lang on the <html> element.' });
  }
  return found;
}

// ------------------------------------------------------------ the application
//
// The canvas was left out of every accessibility statement this engine has
// written, with a sentence saying so: "the canvas is an application rather than
// a document and is not in that file". That was true and it was also the reason
// nobody had looked. What it needs asked of it is not what a document needs —
// there is no reading order to check and no prose to measure — but there is a
// keyboard, a focus ring, a name on every control, and somewhere for the
// application to say what it has just done.
const CONTROLS = /<(button|select|textarea)\b[^>]*>[\s\S]*?<\/\1>|<(input|a)\b[^>]*>/gi;

// Does this control say what it is? Text inside it, a label pointing at it, an
// aria-label, or a title.
function named(tag, html) {
  if (/\saria-label(?:ledby)?="[^"]+"/i.test(tag)) return true;
  if (/\stitle="[^"]+"/i.test(tag)) return true;
  const inner = />([\s\S]*?)<\/(?:button|select|textarea|a)>/i.exec(tag);
  if (inner && inner[1].replace(/<[^>]+>/g, '').trim()) return true;
  const id = /\sid="([^"]+)"/i.exec(tag);
  if (id) {
    if (new RegExp(`<label[^>]*\\sfor="${id[1]}"`, 'i').test(html)) return true;
    // a label that wraps the control names it, and the words sit before it
    const wrap = new RegExp(`<label[^>]*>((?:(?!</?label)[\\s\\S])*?)<[^>]*\\sid="${id[1]}"`, 'i').exec(html);
    if (wrap && wrap[1].replace(/<[^>]+>/g, '').trim()) return true;
  }
  if (/type="(hidden|submit|button|reset)"/i.test(tag)) return true;
  return false;
}

function application(source, css = '') {
  const html = layout(source);
  const found = [];
  if (!/<main\b/.test(html)) {
    found.push({ code: 'appLandmark', level: 'warning',
      what: 'the application has no <main>.',
      why: 'The thing being worked on is the point of the page, and there is nothing to skip to it by.',
      how: 'Wrap the editing surface in <main>, and give the panels around it their own labels.' });
  }
  const h1 = (html.match(/<h1\b/g) || []).length;
  if (h1 !== 1) {
    found.push({ code: 'appHeading', level: 'warning',
      what: h1 ? `the application has ${h1} first level headings.` : 'the application has no first level heading.',
      why: 'An application still opens in a window with a name, and the name is the first thing read.',
      how: 'Give it one <h1>.' });
  }
  // Every control the markup ships. What the application adds while it runs is
  // measured in a browser instead — see test/canvas-check.mjs.
  const controls = (html.match(CONTROLS) || []).filter((c) => !/\shidden(?=[\s>])/i.test(c));
  const anon = controls.filter((c) => !named(c, html));
  if (anon.length) {
    found.push({ code: 'appControlName', level: 'warning',
      what: `${anon.length} of the ${controls.length} controls have no accessible name.`,
      why: 'A button with no name is announced as "button", which is every button on the page.',
      how: 'Give each one words inside it, a label, or an aria-label.' });
  }
  // A focus ring the browser happens to draw is not a decision: it is one
  // browser's colour against this application's own, and it changes.
  if (!/:focus(-visible)?\s*[,{]/.test(css)) {
    found.push({ code: 'appFocus', level: 'warning',
      what: 'the application does not say what focus looks like.',
      why: 'Every control here is reached by keyboard before it is used, and the only thing that says which '
        + 'one you are on is the ring around it. Left to the browser it is the browser\'s colour against '
        + 'this application\'s, and it differs between them.',
      how: 'Set :focus-visible in the stylesheet, in a colour measured against the ground it lands on.' });
  }
  if (!/aria-live=|role="(status|alert|log)"/.test(html)) {
    found.push({ code: 'appLive', level: 'warning',
      what: 'nothing on the page is a region that announces what changes.',
      why: 'An application answers without loading a page: it refuses, it warns, it says what it just did. '
        + 'None of that reaches a reader who is not watching the place it appears.',
      how: 'Give the place those messages appear role="status" and aria-live.' });
  }
  const tabs = (html.match(/tabindex="[1-9]/g) || []).length;
  if (tabs) {
    found.push({ code: 'appTabindex', level: 'warning',
      what: `${tabs} elements set a positive tabindex.`,
      why: 'The keyboard order stops matching the order things are laid out in.',
      how: 'Use 0, or nothing at all.' });
  }
  return found;
}

// ---------------------------------------------------------------- the report

// Every page carries its own stylesheet, and this measured one of them.
//
// `audit` took a single `css` and reported the result under "Pages:
// guidelines.html, deck.html, published.html" followed by "Everything above
// passed on every page in this package". It was the manual's. The deck and the
// published page ship their own — written the other way round, dark first —
// and neither had ever been measured, in any package this repository has
// published. Both fail: the deck's top bar and its keyboard hint at 3.97 to 1
// and the published page's bar and captions at 4.37, in the light theme, where
// 4.5 is the figure the same package prints a table about. Read each page's
// own <style>, and keep the passed-in sheet for a caller that has one.
const STYLE = /<style[^>]*>([\s\S]*?)<\/style>/g;
const styleOf = (html) => [...String(html).matchAll(STYLE)].map((m) => m[1]).join('\n');

function audit(pages, css, rules = {}, app = null) {
  const findings = [];
  const measured = [];
  for (const [name, html] of Object.entries(pages)) {
    const own = styleOf(html) || css;
    for (const m of chromeContrast(own, rules)) measured.push(Object.assign({ page: name }, m));
  }
  if (!measured.length) measured.push(...chromeContrast(css, rules));
  const failed = measured.filter((m) => !m.passes);
  if (failed.length) {
    const worst = failed.slice().sort((a, b) => a.ratio - b.ratio)[0];
    const sel = [...new Set(failed.map((f) => `${f.page ? `${f.page} ` : ''}${f.selector}`))];
    findings.push({ code: 'chromeContrast', level: 'warning',
      what: `${sel.length} of the things these documents set in their own type do not meet the standard they print `
        + `a table about: the worst is ${worst.selector}${worst.page ? ` in ${worst.page}` : ''} at ${worst.px} px, `
        + `${worst.ratio} to 1 against the page in ${worst.theme}, where ${worst.needs} is the figure.`,
      why: 'These are the captions, the column headings and the footer — the document\'s own voice rather than '
        + 'the brand\'s. Every manual this engine has written has printed a contrast table for the client\'s '
        + 'palette on a page whose own small print is below the line that table draws.',
      how: `Move the token that paints them: ${[...new Set(failed.map((f) => `--${f.token}`))].join(', ')}.` });
  }
  for (const [name, html] of Object.entries(pages)) {
    for (const f of structure(html)) findings.push(Object.assign({ page: name }, f));
  }
  // The canvas is an application, and until the thirty-fourth round every
  // statement this engine wrote said so and left it out. It is checked here for
  // the things a file can answer; the three that need a browser — whether the
  // keyboard reaches everything, whether you can see what it reached, and what
  // ground each rule actually lands on — are in test/canvas-check.mjs.
  const canvas = app ? structure(app.html).concat(application(app.html, app.css)) : null;
  if (canvas) for (const f of canvas) findings.push(Object.assign({ page: app.name || 'editor.html' }, f));
  return { findings, measured, pages: Object.keys(pages), app: app ? (app.name || 'editor.html') : null,
    canvas };
}

// What was checked, what it measured, and what it came to. Written into the
// package because a document that makes a claim about accessibility should be
// the one thing that has been measured rather than asserted.
function statement(result, { brand, standard = 'WCAG 2.2 AA' } = {}) {
  const L = [];
  const rule = (s) => { L.push(s); L.push('='.repeat(s.length)); };
  rule(`${brand} — the documents in this package${result.app ? ', and the canvas' : ''}`);
  L.push('');
  L.push(`Checked against ${standard}, by measurement, when the package was built.`);
  L.push(`Pages: ${result.pages.join(', ')}.`);
  if (result.app) L.push(`Application: ${result.app}.`);
  L.push('');
  L.push('Text in the documents\' own type');
  L.push('-------------------------------');
  // Per page, because each of them ships its own stylesheet. This printed one
  // table under a heading naming three documents, and the table was the
  // manual's: the deck and the published page had never been measured, and
  // both were below the line. A page named here is a page that was read.
  const byPage = new Map();
  for (const m of result.measured) {
    const page = m.page || (result.pages[0] || '');
    if (!byPage.has(page)) byPage.set(page, {});
    const worst = byPage.get(page);
    const k = `${m.token} in ${m.theme}`;
    if (!worst[k] || m.ratio < worst[k].ratio) worst[k] = m;
  }
  for (const [page, worst] of byPage) {
    if (byPage.size > 1) L.push(`  ${page}`);
    const pad = byPage.size > 1 ? '    ' : '  ';
    for (const k of Object.keys(worst).sort()) {
      const m = worst[k];
      L.push(`${pad}${k.padEnd(22)} ${String(m.hex).padEnd(9)} ${String(m.ratio).padStart(6)}:1 against ${m.on}`
        + `  needs ${m.needs}  ${m.passes ? 'passes' : 'FAILS'}   (${m.selector} at ${m.px} px)`);
    }
    if (byPage.size > 1) L.push('');
  }
  if (byPage.size <= 1) L.push('');
  L.push('  Rules and hairlines are not in this table. WCAG asks 3 to 1 of a graphical');
  L.push('  object that has to be seen to understand the content; the lines between');
  L.push('  rows here separate things that whitespace and reading order already');
  L.push('  separate, so they are decoration and are drawn as such deliberately.');
  L.push('');
  L.push('What else was checked');
  L.push('---------------------');
  for (const line of [
    'One first level heading per page, and no level skipped in the outline.',
    'A <main> landmark to skip to.',
    'An accessible name on every drawing that carries meaning, and aria-hidden',
    '  on every drawing that does not.',
    'An alt on every image.',
    'No positive tabindex, so the keyboard order is the reading order.',
    'A language on the document.',
  ]) L.push(`  ${line}`);
  if (result.app) {
    L.push('');
    L.push(`The canvas (${result.app})`);
    L.push('-'.repeat(`The canvas (${result.app})`.length));
    for (const line of [
      'An application rather than a document, so it is asked different things:',
      '  A <main> to work in, and one first level heading.',
      '  An accessible name on every control the page ships.',
      '  A stylesheet that says what focus looks like, rather than leaving it',
      '    to whichever browser opened the file.',
      '  A region that announces what the application has just done.',
      '  No positive tabindex.',
      '',
      'Three things about an application cannot be read off its files, because',
      'all three are about the live page: whether the keyboard reaches every',
      'control and can work it, whether you can see which one you are on, and',
      'what ground a rule lands on once it is inside a pane inside a page.',
      'test/canvas-check.mjs measures those in a browser — every tab stop shot',
      'focused and blurred, every block moved, resized, duplicated and deleted',
      'from the keyboard, and every piece of text measured against the nearest',
      'ancestor that actually paints a ground.',
    ]) L.push(`  ${line}`);
  }
  L.push('');
  const bad = result.findings.filter((f) => f.level !== 'fixed');
  if (!bad.length) {
    L.push('Everything above passed on every page in this package.');
  } else {
    L.push(`${bad.length} thing${bad.length > 1 ? 's' : ''} did not pass:`);
    L.push('');
    for (const f of bad) {
      L.push(`  ${f.page ? `${f.page}: ` : ''}${f.what}`);
      L.push(`    ${f.how}`);
    }
  }
  L.push('');
  L.push('This file was written by measuring the pages beside it, not by describing');
  L.push('them. Change a colour or a size in the documents and it changes with them.');
  L.push('');
  return L.join('\n');
}

module.exports = { audit, markScript, foreignScript, chromeContrast, structure, application, layout, pageGround, language, unmarkedText, themes, textRules, statement, needs, isLarge };
