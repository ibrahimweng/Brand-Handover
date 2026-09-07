'use strict';
// How the documents are laid out.
//
// Every manual and deck this engine has written has looked the same: one
// stylesheet, one set of proportions, one idea about how a page should be
// arranged. That is defensible for a tool that measures things and indefensible
// for one that presents them — a brand book is a piece of design, and a client
// choosing between a quiet editorial system and a loud one is choosing
// something real about how their identity is introduced.
//
// A direction is not a theme. Swapping colours is a theme. These change the
// modular scale the type is built on, the measure, the page width, how much air
// a specimen stands in, whether a section number sits above its title or beside
// it, how heavy the rules are, and whether the brand's own display face sets the
// headings or the document stays in a neutral one. They are four ways of making
// the same book.
//
// The whole of a direction is tokens plus a short override block, applied by a
// data-dir attribute on the root. No markup branches on the direction: four
// copies of a hundred and thirty lines of CSS would be four things to keep in
// step, and they would not stay in step.

const DIRECTIONS = {
  // ------------------------------------------------------------------ quiet
  quiet: {
    name: 'Quiet',
    note: 'Editorial. Wide margins, a perfect fourth between sizes, hairline rules and a lot of air. '
      + 'The mark is small and the page is calm. Right for an identity that does not need to raise its voice.',
    brandType: false,
    vars: {
      '--page-max': '980px', '--page-pad': '46px', '--measure': '64ch',
      '--h1': 'clamp(34px,5vw,58px)', '--h2': 'clamp(24px,3.2vw,34px)', '--h3': '18px',
      '--body': '16.5px', '--lead': '1.68', '--track': '-.022em',
      '--chapter-gap': '96px', '--sec-gap': '54px',
      '--rule-heavy': '1px', '--rule-hair': '1px',
      '--stage-pad': '54px 34px', '--stage-bg': 'transparent', '--stage-border': '1px solid var(--rule)',
      '--label-case': 'uppercase', '--label-track': '.14em',
    },
    css: `
[data-dir=quiet] .mast{padding:110px 0 52px;border-bottom:none}
[data-dir=quiet] .mast .eyebrow{margin-bottom:44px}
[data-dir=quiet] .mast h1{font-weight:500;max-width:13ch}
[data-dir=quiet] .chapter{border-top:none;padding-top:0}
[data-dir=quiet] .chapter>.chno{font-size:11px;letter-spacing:.22em}
[data-dir=quiet] .chapter>h2{margin-top:10px;font-weight:500;max-width:18ch}
/* the editorial move: the heading sits in a column of its own and the work
   runs beside it, so the page reads as one measure with a margin rather than
   as a stack of full width blocks */
[data-dir=quiet] .sec{display:grid;grid-template-columns:190px minmax(0,1fr);gap:0 42px;align-items:start}
[data-dir=quiet] .sech{grid-column:1;display:block;border:none;padding:0;margin:0;position:sticky;top:26px}
[data-dir=quiet] .sech h3{font-weight:500;line-height:1.25}
[data-dir=quiet] .sech h3 i{display:block;margin:0 0 8px;font-size:10.5px;letter-spacing:.22em;color:var(--ink-3)}
[data-dir=quiet] .sech .badge{margin-top:14px;font-size:9px}
[data-dir=quiet] .sec>*:not(.sech){grid-column:2}
[data-dir=quiet] .stage{min-height:280px}
[data-dir=quiet] .note{margin-top:18px}
@media (max-width:840px){
  [data-dir=quiet] .sec{display:block}
  [data-dir=quiet] .sech{position:static;margin-bottom:18px}
}`,
  },

  // -------------------------------------------------------------- technical
  technical: {
    name: 'Technical',
    note: 'A manual rather than a book. A minor third between sizes, a visible grid, every specimen in a '
      + 'bordered stage with its measurement under it, section numbers in a rail down the left. '
      + 'Right for an identity with a lot of rules that have to be found quickly.',
    brandType: false,
    vars: {
      '--page-max': '1120px', '--page-pad': '28px', '--measure': '72ch',
      '--h1': 'clamp(28px,4vw,42px)', '--h2': 'clamp(20px,2.6vw,26px)', '--h3': '15px',
      '--body': '15px', '--lead': '1.55', '--track': '-.01em',
      '--chapter-gap': '58px', '--sec-gap': '34px',
      '--rule-heavy': '3px', '--rule-hair': '1px',
      '--stage-pad': '26px 18px', '--stage-bg': 'var(--sunk)', '--stage-border': '1px solid var(--rule-2)',
      '--label-case': 'uppercase', '--label-track': '.1em',
    },
    css: `
[data-dir=technical] .mast{padding:34px 0 20px}
[data-dir=technical] .mast h1{font-weight:600;max-width:22ch}
[data-dir=technical] .chapter{border-top-color:var(--ink);padding-top:14px}
[data-dir=technical] .chapter>.chno{font-size:11px}
/* everything numbered lives in one rail down the left, so a reader looking for
   1.4 runs a finger down a column instead of reading headings */
[data-dir=technical] .sec{display:grid;grid-template-columns:76px minmax(0,1fr);gap:0 18px;align-items:start}
[data-dir=technical] .sech{grid-column:1/-1;display:grid;grid-template-columns:76px minmax(0,1fr) auto;
  gap:0 18px;align-items:baseline;border-top:1px solid var(--ink);border-bottom:none;
  padding:8px 0 10px;margin-bottom:14px}
[data-dir=technical] .sech h3{grid-column:2;font-weight:600}
[data-dir=technical] .sech h3 i{position:absolute;transform:translateX(-94px);margin:0;font-size:11px}
[data-dir=technical] .sech .badge{grid-column:3}
[data-dir=technical] .sec>*:not(.sech){grid-column:2}
[data-dir=technical] .stage{min-height:150px}
[data-dir=technical] h1,[data-dir=technical] h2,[data-dir=technical] h3{font-weight:600}
[data-dir=technical] .note{font-size:14px}
[data-dir=technical] figcaption{font-size:10px}
@media (max-width:760px){
  [data-dir=technical] .sec,[data-dir=technical] .sech{display:block}
  [data-dir=technical] .sech h3 i{position:static;transform:none;margin-right:10px}
}`,
  },

  // ------------------------------------------------------------------- warm
  warm: {
    name: 'Warm',
    note: 'Space instead of rules. Larger type, generous leading, specimens on soft panels of the brand’s '
      + 'own ground, headings set in the identity’s display face. Right for an identity that wants to be '
      + 'approachable before it is precise.',
    brandType: true,
    vars: {
      '--page-max': '1000px', '--page-pad': '36px', '--measure': '58ch',
      '--h1': 'clamp(36px,5.6vw,62px)', '--h2': 'clamp(26px,3.6vw,38px)', '--h3': '19px',
      '--body': '17px', '--lead': '1.72', '--track': '-.018em',
      '--chapter-gap': '86px', '--sec-gap': '48px',
      '--rule-heavy': '0px', '--rule-hair': '0px',
      '--stage-pad': '46px 30px', '--stage-bg': 'var(--sunk)', '--stage-border': 'none',
      '--label-case': 'none', '--label-track': '.01em',
    },
    css: `
[data-dir=warm] .page{max-width:840px}
[data-dir=warm] .mast{border-bottom:none;padding:92px 0 26px;text-align:center}
[data-dir=warm] .mast h1{margin:0 auto;max-width:14ch;font-weight:600}
[data-dir=warm] .mast .sub{margin:20px auto 0;text-align:center}
[data-dir=warm] .chapter{border-top:none;text-align:center}
[data-dir=warm] .chapter>.chno{font-family:var(--ui);font-size:13px;letter-spacing:.04em;color:var(--ink-3)}
[data-dir=warm] .chapter>h2{margin-top:8px}
[data-dir=warm] .sec{text-align:left}
[data-dir=warm] .sech{border-bottom:none;padding-bottom:0;margin-bottom:20px;justify-content:center;
  flex-direction:column;align-items:center;text-align:center;gap:9px}
[data-dir=warm] .sech h3{font-weight:600;font-size:19px}
[data-dir=warm] .sech h3 i{color:var(--ink-3);margin-right:9px}
[data-dir=warm] .note{margin-left:auto;margin-right:auto}
[data-dir=warm] .stage{border-radius:20px;min-height:260px}
[data-dir=warm] .chip .sw{border-radius:14px}
[data-dir=warm] figcaption{font-family:var(--ui);font-size:12.5px;text-align:center}`,
  },

  // ------------------------------------------------------------------- bold
  bold: {
    name: 'Bold',
    note: 'The name at the top of its voice. A wide scale, tight tracking, heavy rules and a chapter number '
      + 'set large enough to be part of the layout. Headings in the identity’s own display face. '
      + 'Right for an identity that is meant to be noticed.',
    brandType: true,
    vars: {
      '--page-max': '1100px', '--page-pad': '32px', '--measure': '60ch',
      '--h1': 'clamp(44px,8.5vw,104px)', '--h2': 'clamp(30px,5vw,56px)', '--h3': '20px',
      '--body': '16.5px', '--lead': '1.58', '--track': '-.045em',
      '--chapter-gap': '104px', '--sec-gap': '46px',
      '--rule-heavy': '5px', '--rule-hair': '1px',
      '--stage-pad': '44px 28px', '--stage-bg': 'var(--sunk)', '--stage-border': 'none',
      '--label-case': 'uppercase', '--label-track': '.16em',
    },
    css: `
[data-dir=bold] .mast{padding:56px 0 34px;border-bottom:none}
[data-dir=bold] .mast h1{line-height:.9;max-width:11ch;font-weight:800}
/* a chapter opens as a band across the page rather than as a rule above a
   heading: the one move that makes this read as a different book rather than
   as the same book with heavier lines */
[data-dir=bold] .chapter{border-top:none;padding:0;margin-top:var(--chapter-gap)}
[data-dir=bold] .chapter>.chno{background:var(--ink);color:var(--on-ink-2)}
[data-dir=bold] .chapter>h2{background:var(--ink);color:var(--on-ink)}
[data-dir=bold] .chapter>.chno,[data-dir=bold] .chapter>h2{
  margin-left:calc(-1 * var(--page-pad));margin-right:calc(-1 * var(--page-pad));
  padding-left:var(--page-pad);padding-right:var(--page-pad)}
/* opacity on the element dims its background too, which split the band into a
   grey block above a black one; and a colour the audit cannot parse is a colour
   it does not check, so this is a token rather than a colour-mix */
[data-dir=bold] .chapter>.chno{padding-top:26px;font-size:12px;letter-spacing:.2em}
/* the base rule gives h2 a top margin, and inside a band that margin is a
   white line straight through the middle of it */
[data-dir=bold] .chapter>h2{margin-top:0;padding-bottom:30px;padding-top:6px;font-weight:800;line-height:.96;max-width:none}
[data-dir=bold] .sec{margin-top:var(--sec-gap)}
[data-dir=bold] .sech{border-bottom:2px solid var(--ink);padding-bottom:8px}
[data-dir=bold] .sech h3{font-weight:700;text-transform:uppercase;letter-spacing:.06em;font-size:13px}
[data-dir=bold] .sech h3 i{letter-spacing:.06em}
[data-dir=bold] .stage{min-height:300px}
[data-dir=bold] .note{font-weight:400}`,
  },
};

const NAMES = Object.keys(DIRECTIONS);
const DEFAULT = 'quiet';

// What a project asked for, or the one the engine would pick. A direction the
// engine does not have is said rather than silently swapped, because a document
// laid out in something other than what was asked for is the same class of
// untruth as a page declaring a language it is not written in.
function resolve(project) {
  const want = project && project.style ? String(project.style) : null;
  if (want && DIRECTIONS[want]) return Object.assign({ key: want }, DIRECTIONS[want]);
  return Object.assign({ key: DEFAULT, asked: want || null }, DIRECTIONS[DEFAULT]);
}

// The tokens as a block of CSS, for whichever direction.
function vars(key) {
  const d = DIRECTIONS[key] || DIRECTIONS[DEFAULT];
  return `:root{${Object.entries(d.vars).map(([k, v]) => `${k}:${v}`).join(';')}}`;
}

// Every direction's overrides, always present, keyed off data-dir. One
// stylesheet: a document carries the four and uses one, which costs about a
// kilobyte and means the picker can switch between them without rebuilding.
const all = () => NAMES.map((k) => DIRECTIONS[k].css).join('\n');

module.exports = { DIRECTIONS, NAMES, DEFAULT, resolve, vars, all };
