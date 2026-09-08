/* What a screen reader actually says.
 *
 * Every accessibility check this engine has runs on one of two things: the file
 * — src/access.js reads the markup at build time — or the rendered page, which
 * is test/canvas-check.mjs measuring focus rings and the ground a colour lands
 * on. A screen reader reads neither. It reads the accessibility tree, which the
 * browser computes from both and which is the same as neither: a name is
 * resolved through the whole labelling algorithm, a role is resolved from the
 * tag and the ARIA and what the element turned out to contain, and a good deal
 * of what is in the markup never reaches the tree at all.
 *
 * Every round since the twenty-ninth has ended with the same sentence: what
 * these pages say is measured, how they sound is not. This is the file that
 * sentence was waiting for. It reads the tree in document order, writes down
 * what would be spoken, and asks of it the things that make a page unusable by
 * ear rather than merely imperfect.
 *
 * It is not NVDA, JAWS, VoiceOver or Orca, and does not claim to be. It is the
 * layer all four of them read, plus a synthesiser for the half of the question
 * that is about sound. Where the two disagree a real reader is right.
 *
 * Kept out of `npm test` because it needs a browser.
 *
 *   node test/reader-check.mjs path/to/guidelines.html [more.html ...]
 *   PW_PATH=/where/playwright/lives node test/reader-check.mjs guidelines.html
 *   TRANSCRIPT=1 node test/reader-check.mjs guidelines.html   # and say it
 */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const require = createRequire(import.meta.url);

let chromium;
try {
  const paths = [import.meta.dirname, process.cwd()].concat(process.env.PW_PATH ? [process.env.PW_PATH] : []);
  ({ chromium } = require(require.resolve('playwright', { paths })));
} catch {
  console.log('playwright is not installed, so nothing was measured.'
    + ' Install it, or point PW_PATH at a node_modules that has it.');
  process.exit(0);
}

// Roles that are announced as themselves and are useless without a name: a
// reader hears "image" and has been told nothing.
const NEEDS_NAME = new Set(['image', 'button', 'link', 'heading', 'textbox', 'checkbox',
  'combobox', 'radio', 'slider', 'spinbutton', 'switch', 'tab', 'menuitem',
  'region', 'form', 'navigation', 'complementary', 'search', 'table']);

// `figure` is not in that list, and finding out why is half of what this file
// is for. A <figure> takes its name from its <figcaption> — that is what the
// HTML accessibility mapping says — and Chromium does not do it. Measured, of
// five ways of captioning a figure, only aria-labelledby produces a name; a
// plain figcaption produces none. The caption is still announced, as text
// inside the figure, so a reader hears it; what it is not is the figure's name.
// So the question worth asking is not whether the figure is named but whether
// anything inside it is said at all, which is what a reader needs and what a
// silent drawing in a silent frame would fail.

const launch = process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {};
const browser = await chromium.launch({ ...launch, args: ['--force-renderer-accessibility'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });

let bad = 0;
const check = (label, pass, detail) => {
  if (!pass) bad++;
  console.log(`${pass ? '  ok   ' : '  FAIL '} ${label.padEnd(40)} ${detail}`);
};

for (const file of process.argv.slice(2)) {
  const name = path.basename(file);
  console.log(`\n${name}`);
  await page.goto(pathToFileURL(path.resolve(file)).href, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Accessibility.enable');
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  const byId = new Map(nodes.map((n) => [n.nodeId, n]));

  // the tree in the order it is read
  const said = [];
  const walk = (id) => {
    const n = byId.get(id);
    if (!n) return;
    const role = n.role && n.role.value;
    if (!n.ignored && role && role !== 'InlineTextBox') {
      const prop = (k) => { const x = (n.properties || []).find((y) => y.name === k); return x && x.value.value; };
      said.push({ role, name: (n.name && n.name.value) || '', level: prop('level'),
        live: prop('live'), backend: n.backendDOMNodeId });
    }
    for (const c of n.childIds || []) walk(c);
  };
  walk(nodes[0].nodeId);

  // ---- a name where a name is the whole of what is announced
  const nameless = said.filter((s) => NEEDS_NAME.has(s.role) && !s.name.trim());
  check('everything announced says what it is', !nameless.length,
    nameless.length ? `${nameless.length} announced as a bare ${[...new Set(nameless.map((x) => x.role))].join(', ')}`
      : `${said.length} nodes, ${said.filter((s) => NEEDS_NAME.has(s.role)).length} of them named`);

  // ---- the heading outline, which is how a reader moves through a document
  const heads = said.filter((s) => s.role === 'heading').map((s) => Number(s.level) || 0);
  const jumps = [];
  for (let i = 1; i < heads.length; i++) if (heads[i] > heads[i - 1] + 1) jumps.push(`${heads[i - 1]}→${heads[i]}`);
  check('the heading outline has no gaps', !jumps.length && (!heads.length || heads[0] === 1),
    jumps.length ? `jumps at ${jumps.slice(0, 4).join(', ')}` : `${heads.length} headings, levels ${[...new Set(heads)].sort().join(' ')}`);

  // ---- the language every utterance is in, because a reader switches voice on it
  const langs = await page.evaluate(() => {
    const langOf = (n) => { let e = n.parentElement;
      while (e) { if (e.lang) return e.lang; e = e.parentElement; } return ''; };
    const SCRIPT = [[/[֐-׿]/, 'he'], [/[぀-ヿ一-鿿]/, 'ja'],
      [/[Ѐ-ӿ]/, 'ru'], [/[؀-ۿ]/, 'ar']];
    const out = { unmarked: 0, wrong: [], total: 0 };
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const t = n.textContent.trim();
      if (!t || n.parentElement.closest('script,style,svg')) continue;
      out.total += t.length;
      const l = langOf(n);
      if (!l) { out.unmarked += t.length; continue; }
      for (const [re, want] of SCRIPT) {
        if (re.test(t) && l.split('-')[0] !== want) {
          out.wrong.push(`${want} text under lang="${l}": "${t.slice(0, 30)}"`);
          break;
        }
      }
    }
    return out;
  });
  check('every utterance is in a stated language', !langs.unmarked && !langs.wrong.length,
    langs.wrong.length ? langs.wrong[0]
      : langs.unmarked ? `${langs.unmarked} characters carry no language`
        : `${langs.total} characters, all of them marked`);

  // ---- what a reader cannot get past
  //
  // A screen reader moves by heading, by landmark and by paragraph. A very long
  // run with no boundary in it is a wall: the only way through is to listen to
  // all of it. The manual prints the machine readable file whole, and that is
  // nine thousand characters of JSON read aloud one brace at a time.
  const walls = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('pre, code, table')) {
      const t = el.textContent.trim();
      if (t.length < 1200) continue;
      const label = el.getAttribute('aria-label') || '';
      const region = el.closest('[role="region"],section,aside,details');
      out.push({ tag: el.tagName.toLowerCase(), chars: t.length, label, skippable: !!region || el.tagName === 'DETAILS' });
    }
    return out;
  });
  const stuck = walls.filter((w) => !w.skippable);
  check('nothing is a wall a reader cannot walk past', !stuck.length,
    stuck.length ? `${stuck[0].chars} characters of <${stuck[0].tag}> with nothing to skip it by`
      : walls.length ? `${walls.length} long block${walls.length === 1 ? '' : 's'}, each inside something skippable` : 'no long blocks');

  // ---- a figure that says nothing at all
  const mute = await page.evaluate(() => {
    const out = [];
    for (const f of document.querySelectorAll('figure')) {
      const cap = f.querySelector('figcaption');
      const said2 = (cap && cap.textContent.trim())
        || [...f.querySelectorAll('[aria-label]:not([aria-hidden="true"]),img[alt]:not([alt=""])')].length;
      if (!said2) out.push(f.className || '(figure)');
    }
    return out;
  });
  check('every drawing says what it is', !mute.length,
    mute.length ? `${mute.length} figure${mute.length === 1 ? '' : 's'} with nothing announced inside`
      : `${await page.evaluate(() => document.querySelectorAll('figure').length)} figures, each with a caption or a named drawing`);

  // ---- a stylesheet is not a way of saying something
  //
  // text-transform reaches the accessibility tree: the eyebrow is written
  // "Brand manual · generated from one master file" and announced
  // "BRAND MANUAL · GENERATED FROM ONE MASTER FILE". With espeak-ng's default
  // settings that costs nothing — the phonemes are identical — but a reader who
  // has capital indication turned on hears one marker per word instead of one
  // per phrase. Measured rather than assumed, and reported rather than refused.
  const shouted = await page.evaluate(() => {
    let n = 0;
    for (const el of document.querySelectorAll('*')) {
      if (getComputedStyle(el).textTransform !== 'uppercase') continue;
      const t = el.textContent.trim();
      if (t && t.length < 200 && /[a-z]/.test(t)) n += t.split(/\s+/).length;
    }
    return n;
  });
  // Reported rather than failed, because the measurement did not support
  // failing it. espeak-ng gives identical phonemes for "Drawn by the system"
  // and "DRAWN BY THE SYSTEM"; only a reader who has turned capital indication
  // on hears the difference, and then it is one marker per word instead of one
  // per phrase. The only fix that keeps the written text in the tree is
  // font-variant-caps, and small capitals are a smaller, lighter thing than the
  // capitals this design sets. Known and said, rather than changed on a hunch.
  console.log(`  note   ${'a stylesheet capitalises what is said'.padEnd(40)} `
    + `${shouted} words, identical in phonemes unless capital indication is on`);

  // ---- and what it sounds like
  //
  // The other half of the question. Every round since the twenty-ninth has
  // argued that a page declaring the wrong language is worse than one declaring
  // none, because a synthesiser told the page is Hebrew and handed English
  // reads it with Hebrew sounds. Spoken, it is worse than that argument: it is
  // not read with the wrong sounds, it is spelled out. מעיין under lang="en"
  // comes out "hebrew mem, hebrew ayin, hebrew yod, hebrew yod, hebrew nun" —
  // five letter names where the page says one word.
  //
  // espeak-ng is not a screen reader and its Japanese voice has no kanji
  // dictionary, so it says "chinese letter" for 山 whichever language it is
  // told. Where it and a real reader disagree, the real reader is right.
  if (process.env.SPEAK) {
    const { execFileSync } = await import('node:child_process');
    let have = true;
    try { execFileSync('espeak-ng', ['--version'], { stdio: 'ignore' }); } catch { have = false; }
    if (!have) console.log('  note   espeak-ng is not installed, so nothing was spoken');
    else {
      const runs = await page.evaluate(() => {
        const langOf = (n) => { let e = n.parentElement;
          while (e) { if (e.lang) return e.lang; e = e.parentElement; } return ''; };
        const out = new Map();
        const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) {
          const t = n.textContent.trim();
          if (!t || t.length < 4 || n.parentElement.closest('script,style,svg')) continue;
          const l = (langOf(n) || 'en').split('-')[0];
          if (!out.has(l)) out.set(l, t.slice(0, 40));
        }
        return [...out.entries()];
      });
      const phon = (voice, text) => {
        try {
          return execFileSync('espeak-ng', ['-q', '-x', '-v', voice, text],
            { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).replace(/\s+/g, ' ').trim();
        } catch { return '(no voice)'; }
      };
      console.log('\n  what it sounds like:');
      for (const [l, text] of runs) {
        console.log(`    ${l}  "${text}"`);
        console.log(`        as ${l}: ${phon(l, text).slice(0, 76)}`);
        if (l !== 'en') console.log(`        as en: ${phon('en', text).slice(0, 76)}`);
      }
    }
  }

  if (process.env.TRANSCRIPT) {
    console.log('\n  what it says, in order:');
    for (const s of said.filter((x) => x.name).slice(0, Number(process.env.TRANSCRIPT) || 25)) {
      console.log(`    ${s.role}${s.level ? ` level ${s.level}` : ''}: ${s.name.slice(0, 84)}`);
    }
  }
}
await browser.close();
console.log(bad ? `\n${bad} thing${bad === 1 ? '' : 's'} a reader would meet.` : '\nEverything above passed.');
process.exit(bad ? 1 : 0);
