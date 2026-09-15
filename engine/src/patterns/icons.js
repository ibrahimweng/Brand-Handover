/* A set of icons, cut off the client's own mark.

   An icon set that does not belong to the identity is a set somebody bought.
   What makes these theirs is that every measurement they are drawn with comes
   off the drawing: the pen is the mark's own stroke ratio, the corner is how
   much of the mark's turning happens on a curve, the terminals are the mark's
   terminals, and the optical size is the mark's own. Change the logo and the
   whole set redraws, which is the same promise the patterns make.

   Three ways to spend those measurements, and all three ship rather than one,
   because they are three different jobs:

   `pen` strokes the glyph at the mark's own weight with the mark's own cap and
   join. The set reads as drawn by whoever drew the logo. This is the one for a
   user interface and for anything set beside text.

   `solid` strokes the same construction at nearly twice the weight. Heavier,
   and it holds at sizes where a hairline closes up — a stitched badge, a small
   favicon, a screen at arm's length.

   `stamp` fills a tile whose corner is the mark's corner and knocks the glyph
   out of it. A set of stamps rather than a set of lines: it survives being put
   on a photograph, which neither of the other two do.

   The glyphs are declared as instructions on a 24 grid rather than as finished
   paths, so one construction serves all three ways. A path drawn three times is
   three drawings that will drift.

   The vocabulary is twenty-four, and it is the twenty-four every brand needs
   before it needs anything particular. A sector swaps the last six for its own
   — a distillery gets a cask where a general set has a link — which is the one
   place an identity's trade shows in its icons rather than in its words. */
//
// UMD: this draws in the studio, which has no require.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PatternIcons = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const U = 24;                       // the grid every glyph is drawn on
  const TAU = Math.PI * 2;
  const WAYS = ['pen', 'solid', 'stamp'];

  /* What the mark lends.

     `weight` is the drawing's own stroke as a share of its box. It is only a
     real measurement when motif-read was given the rules *and* the
     measurements — without both it reports a flat 0.06 for every identity, and
     a set drawn from that is not measured off anything. The caller passes what
     it has; this floors it where a pen stops being visible at 16 px and caps it
     where an icon closes up. */
  function hand(mark, motif) {
    const m = motif || {};
    const curvy = mark && mark.turned ? mark.curviness : 0.5;
    const w = Math.max(0.055, Math.min(0.145, (m.weight || 0.06) * 1.35));
    return {
      w: w * U,
      r: Math.max(0, Math.min(U * 0.24, curvy * U * 0.22)),
      cap: curvy > 0.55 ? 'round' : 'butt',
      join: curvy > 0.55 ? 'round' : 'miter',
      ink: typeof m.ink === 'number' ? m.ink : 0.4,
      unit: U,
    };
  }

  /* The twenty-four.

     Declared as a function that lays a path down, not as a path: `pen` strokes
     it, `solid` strokes it heavier, `stamp` knocks it out of a tile, and all
     three are drawing the same construction rather than three copies of it. */
  const CORE = {
    search: (s) => { s.arc(10, 10, 6.5, 0, TAU); s.moveTo(14.8, 14.8); s.lineTo(20.5, 20.5); },
    arrow: (s) => { s.moveTo(3, 12); s.lineTo(20.5, 12); s.moveTo(14, 5.5); s.lineTo(20.5, 12); s.lineTo(14, 18.5); },
    download: (s) => { s.moveTo(12, 3); s.lineTo(12, 15.5); s.moveTo(6.5, 10); s.lineTo(12, 15.5); s.lineTo(17.5, 10);
      s.moveTo(4, 20.5); s.lineTo(20, 20.5); },
    upload: (s) => { s.moveTo(12, 16); s.lineTo(12, 3.5); s.moveTo(6.5, 9); s.lineTo(12, 3.5); s.lineTo(17.5, 9);
      s.moveTo(4, 20.5); s.lineTo(20, 20.5); },
    mail: (s) => { s.moveTo(3, 6); s.lineTo(21, 6); s.lineTo(21, 18); s.lineTo(3, 18); s.closePath();
      s.moveTo(3, 6); s.lineTo(12, 13); s.lineTo(21, 6); },
    phone: (s) => { s.moveTo(7.6, 2.6); s.lineTo(10.4, 7.4); s.lineTo(8, 10);
      s.bezierCurveTo(9.4, 13.4, 10.6, 14.6, 14, 16); s.lineTo(16.6, 13.6); s.lineTo(21.4, 16.4);
      s.lineTo(19, 21.4); s.bezierCurveTo(10, 21.4, 2.6, 14, 2.6, 5); s.closePath(); },
    place: (s) => { s.moveTo(12, 21.4); s.bezierCurveTo(5, 13.6, 4, 11, 4, 9);
      s.bezierCurveTo(4, 4.6, 7.6, 2, 12, 2); s.bezierCurveTo(16.4, 2, 20, 4.6, 20, 9);
      s.bezierCurveTo(20, 11, 19, 13.6, 12, 21.4); s.closePath();
      s.moveTo(14.8, 9); s.arc(12, 9, 2.8, 0, TAU); },
    calendar: (s) => { s.moveTo(3, 5); s.lineTo(21, 5); s.lineTo(21, 21); s.lineTo(3, 21); s.closePath();
      s.moveTo(3, 10); s.lineTo(21, 10); s.moveTo(8, 2.4); s.lineTo(8, 7.2); s.moveTo(16, 2.4); s.lineTo(16, 7.2); },
    clock: (s) => { s.arc(12, 12, 9.2, 0, TAU); s.moveTo(12, 6.2); s.lineTo(12, 12); s.lineTo(16.6, 14.8); },
    person: (s) => { s.moveTo(16.2, 8); s.arc(12, 8, 4.2, 0, TAU);
      s.moveTo(3.6, 21.2); s.bezierCurveTo(3.6, 16, 7.4, 13.6, 12, 13.6);
      s.bezierCurveTo(16.6, 13.6, 20.4, 16, 20.4, 21.2); },
    group: (s) => { s.moveTo(12.4, 8.6); s.arc(9, 8.6, 3.4, 0, TAU);
      s.moveTo(1.8, 20.6); s.bezierCurveTo(1.8, 16.4, 5, 14.4, 9, 14.4);
      s.bezierCurveTo(13, 14.4, 16.2, 16.4, 16.2, 20.6);
      s.moveTo(16.4, 5.6); s.bezierCurveTo(19.2, 5.6, 21, 7.2, 21, 9.4);
      s.bezierCurveTo(21, 11.4, 19.4, 12.8, 17.4, 13);
      s.moveTo(18.2, 15.4); s.bezierCurveTo(20.6, 16.2, 22.2, 17.8, 22.2, 20.6); },
    lock: (s) => { s.moveTo(4.6, 10); s.lineTo(19.4, 10); s.lineTo(19.4, 21.2); s.lineTo(4.6, 21.2); s.closePath();
      s.moveTo(7.6, 10); s.lineTo(7.6, 7); s.bezierCurveTo(7.6, 3.6, 9.6, 2, 12, 2);
      s.bezierCurveTo(14.4, 2, 16.4, 3.6, 16.4, 7); s.lineTo(16.4, 10); },
    star: (s) => { for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU - Math.PI / 2; const rr = i % 2 ? 4.2 : 9.6;
      const x = 12 + Math.cos(a) * rr, y = 12 + Math.sin(a) * rr;
      if (i) s.lineTo(x, y); else s.moveTo(x, y); } s.closePath(); },
    heart: (s) => { s.moveTo(12, 21); s.bezierCurveTo(3, 14.6, 2, 11.4, 2, 8.6);
      s.bezierCurveTo(2, 5.2, 4.6, 3, 7.6, 3); s.bezierCurveTo(9.8, 3, 11.2, 4.2, 12, 5.6);
      s.bezierCurveTo(12.8, 4.2, 14.2, 3, 16.4, 3); s.bezierCurveTo(19.4, 3, 22, 5.2, 22, 8.6);
      s.bezierCurveTo(22, 11.4, 21, 14.6, 12, 21); s.closePath(); },
    cart: (s) => { s.moveTo(2.4, 4); s.lineTo(5.6, 4); s.lineTo(8.4, 15.4); s.lineTo(19.4, 15.4);
      s.lineTo(21.6, 7.2); s.lineTo(6.4, 7.2);
      s.moveTo(11.2, 19.6); s.arc(9.6, 19.6, 1.6, 0, TAU);
      s.moveTo(20, 19.6); s.arc(18.4, 19.6, 1.6, 0, TAU); },
    tag: (s) => { s.moveTo(11.4, 2.4); s.lineTo(21.6, 12.6); s.lineTo(12.6, 21.6); s.lineTo(2.4, 11.4);
      s.lineTo(2.4, 2.4); s.closePath(); s.moveTo(8, 6.6); s.arc(6.6, 6.6, 1.4, 0, TAU); },
    play: (s) => { s.moveTo(6.4, 3.2); s.lineTo(20.4, 12); s.lineTo(6.4, 20.8); s.closePath(); },
    share: (s) => { s.moveTo(20.6, 5.4); s.arc(18, 5.4, 2.6, 0, TAU);
      s.moveTo(8.6, 12); s.arc(6, 12, 2.6, 0, TAU);
      s.moveTo(20.6, 18.6); s.arc(18, 18.6, 2.6, 0, TAU);
      s.moveTo(8.3, 10.8); s.lineTo(15.7, 6.6); s.moveTo(8.3, 13.2); s.lineTo(15.7, 17.4); },
    filter: (s) => { s.moveTo(2.4, 4.4); s.lineTo(21.6, 4.4); s.lineTo(14.2, 12.8);
      s.lineTo(14.2, 20.4); s.lineTo(9.8, 17.6); s.lineTo(9.8, 12.8); s.closePath(); },
    plus: (s) => { s.moveTo(12, 3.4); s.lineTo(12, 20.6); s.moveTo(3.4, 12); s.lineTo(20.6, 12); },
    check: (s) => { s.moveTo(3.6, 12.6); s.lineTo(9.6, 18.6); s.lineTo(20.4, 5.4); },
    info: (s) => { s.arc(12, 12, 9.4, 0, TAU); s.moveTo(12, 10.6); s.lineTo(12, 17.4);
      s.moveTo(12.05, 6.8); s.lineTo(11.95, 6.8); },
    warning: (s) => { s.moveTo(12, 2.6); s.lineTo(22.4, 20.8); s.lineTo(1.6, 20.8); s.closePath();
      s.moveTo(12, 9.4); s.lineTo(12, 15); s.moveTo(12.05, 18); s.lineTo(11.95, 18); },
    link: (s) => { s.moveTo(10.2, 14.4); s.bezierCurveTo(7.8, 12, 7.8, 9, 10.2, 6.6);
      s.lineTo(13.2, 3.6); s.bezierCurveTo(15.6, 1.2, 19.2, 1.2, 21.2, 3.6);
      s.bezierCurveTo(23.2, 6, 23.2, 9, 21.2, 11.4); s.lineTo(19.2, 13.4);
      s.moveTo(13.8, 9.6); s.bezierCurveTo(16.2, 12, 16.2, 15, 13.8, 17.4);
      s.lineTo(10.8, 20.4); s.bezierCurveTo(8.4, 22.8, 4.8, 22.8, 2.8, 20.4);
      s.bezierCurveTo(0.8, 18, 0.8, 15, 2.8, 12.6); s.lineTo(4.8, 10.6); },
  };
  const CORE_ORDER = Object.keys(CORE);

  /* A trade's own six.

     They replace the last six of the core — link, warning, info, check, plus,
     filter — which are the six a brand is least likely to want on a tote bag
     and most likely to want in a user interface. A set with a sector keeps both
     if the count is raised past twenty-four. */
  const SECTORS = {
    drink: {
      bottle: (s) => { s.moveTo(9.6, 2.4); s.lineTo(14.4, 2.4); s.lineTo(14.4, 7);
        s.bezierCurveTo(17.6, 8.8, 18.4, 11, 18.4, 14); s.lineTo(18.4, 21.4); s.lineTo(5.6, 21.4);
        s.lineTo(5.6, 14); s.bezierCurveTo(5.6, 11, 6.4, 8.8, 9.6, 7); s.closePath();
        s.moveTo(5.6, 14.6); s.lineTo(18.4, 14.6); },
      glass: (s) => { s.moveTo(6.4, 2.6); s.lineTo(17.6, 2.6); s.lineTo(14, 12); s.lineTo(14, 19);
        s.lineTo(17.4, 19); s.moveTo(14, 19); s.lineTo(6.6, 19); s.moveTo(10, 19); s.lineTo(10, 12);
        s.lineTo(6.4, 2.6); },
      cask: (s) => { s.moveTo(4.4, 6); s.bezierCurveTo(9, 4, 15, 4, 19.6, 6);
        s.bezierCurveTo(21.4, 10, 21.4, 14, 19.6, 18);
        s.bezierCurveTo(15, 20, 9, 20, 4.4, 18); s.bezierCurveTo(2.6, 14, 2.6, 10, 4.4, 6); s.closePath();
        s.moveTo(3.2, 9.4); s.lineTo(20.8, 9.4); s.moveTo(3.2, 14.6); s.lineTo(20.8, 14.6); },
      grain: (s) => { s.moveTo(12, 21.6); s.lineTo(12, 5);
        for (let i = 0; i < 4; i++) { const y = 5 + i * 3.6;
          s.moveTo(12, y + 3.2); s.bezierCurveTo(7.4, y + 3, 6, y + 1.4, 6.4, y - 1.2);
          s.bezierCurveTo(9.6, y - 1, 11.6, y + 0.6, 12, y + 3.2);
          s.moveTo(12, y + 3.2); s.bezierCurveTo(16.6, y + 3, 18, y + 1.4, 17.6, y - 1.2);
          s.bezierCurveTo(14.4, y - 1, 12.4, y + 0.6, 12, y + 3.2); } },
      leaf: (s) => { s.moveTo(3.4, 20.6); s.bezierCurveTo(3.4, 9, 10, 3.4, 20.6, 3.4);
        s.bezierCurveTo(20.6, 15, 14, 20.6, 3.4, 20.6); s.closePath();
        s.moveTo(4.6, 19.4); s.lineTo(16, 8); },
      flame: (s) => { s.moveTo(12, 2.4); s.bezierCurveTo(16.4, 7.6, 19.4, 10.6, 19.4, 14.6);
        s.bezierCurveTo(19.4, 18.6, 16, 21.6, 12, 21.6); s.bezierCurveTo(8, 21.6, 4.6, 18.6, 4.6, 14.6);
        s.bezierCurveTo(4.6, 10.6, 7.6, 7.6, 12, 2.4); s.closePath();
        s.moveTo(12, 11.6); s.bezierCurveTo(14.4, 14.4, 15.4, 15.6, 15.4, 17);
        s.bezierCurveTo(15.4, 19, 13.9, 20.2, 12, 20.2); s.bezierCurveTo(10.1, 20.2, 8.6, 19, 8.6, 17);
        s.bezierCurveTo(8.6, 15.6, 9.6, 14.4, 12, 11.6); },
    },
    sea: {
      anchor: (s) => { s.moveTo(14, 4.4); s.arc(12, 4.4, 2, 0, TAU); s.moveTo(12, 6.4); s.lineTo(12, 21.4);
        s.moveTo(6.6, 9.4); s.lineTo(17.4, 9.4);
        s.moveTo(3.4, 13.6); s.bezierCurveTo(3.4, 18.6, 7.4, 21.4, 12, 21.4);
        s.bezierCurveTo(16.6, 21.4, 20.6, 18.6, 20.6, 13.6); },
      wave: (s) => { for (let i = 0; i < 3; i++) { const y = 7 + i * 5;
        s.moveTo(2.4, y); s.bezierCurveTo(5.6, y - 3.2, 8.8, y + 3.2, 12, y);
        s.bezierCurveTo(15.2, y - 3.2, 18.4, y + 3.2, 21.6, y); } },
      sail: (s) => { s.moveTo(12, 2.4); s.lineTo(12, 17); s.moveTo(12, 16.6); s.lineTo(3, 16.6);
        s.bezierCurveTo(5.4, 10.6, 8.4, 6.4, 12, 2.4); s.closePath();
        s.moveTo(13.6, 16.6); s.lineTo(21, 16.6); s.bezierCurveTo(19, 11.6, 16.8, 9, 13.6, 6.6);
        s.closePath(); s.moveTo(2, 20.6); s.lineTo(22, 20.6); },
      net: (s) => { for (let i = 0; i <= 4; i++) { const t = 2.4 + i * 4.8;
        s.moveTo(t, 2.4); s.lineTo(t, 21.6); s.moveTo(2.4, t); s.lineTo(21.6, t); } },
      shell: (s) => { s.moveTo(12, 21.4); s.bezierCurveTo(4, 21.4, 2.4, 14, 2.4, 9.4);
        s.bezierCurveTo(2.4, 5, 6.6, 2.6, 12, 2.6); s.bezierCurveTo(17.4, 2.6, 21.6, 5, 21.6, 9.4);
        s.bezierCurveTo(21.6, 14, 20, 21.4, 12, 21.4); s.closePath();
        s.moveTo(12, 2.6); s.lineTo(12, 21.4);
        s.moveTo(7.4, 3.6); s.lineTo(9, 20.6); s.moveTo(16.6, 3.6); s.lineTo(15, 20.6); },
      buoy: (s) => { s.moveTo(12, 2.4); s.lineTo(12, 7); s.moveTo(6.6, 7); s.lineTo(17.4, 7);
        s.bezierCurveTo(18.6, 12, 18.6, 16.6, 17.4, 21.4); s.lineTo(6.6, 21.4);
        s.bezierCurveTo(5.4, 16.6, 5.4, 12, 6.6, 7); s.closePath();
        s.moveTo(5.8, 13); s.lineTo(18.2, 13); },
    },
    land: {
      tree: (s) => { s.moveTo(12, 21.6); s.lineTo(12, 13); s.moveTo(12, 14.6); s.lineTo(6.6, 9.4);
        s.moveTo(12, 12); s.lineTo(17.4, 6.8);
        s.moveTo(12, 2.4); s.bezierCurveTo(16.6, 2.4, 19.6, 5.6, 19.6, 9.4);
        s.bezierCurveTo(19.6, 13.2, 16.6, 16, 12, 16); s.bezierCurveTo(7.4, 16, 4.4, 13.2, 4.4, 9.4);
        s.bezierCurveTo(4.4, 5.6, 7.4, 2.4, 12, 2.4); s.closePath(); },
      hill: (s) => { s.moveTo(1.6, 19.4); s.lineTo(8.4, 8.6); s.lineTo(13, 15.4);
        s.lineTo(16.4, 10.6); s.lineTo(22.4, 19.4); s.closePath();
        s.moveTo(6.4, 11.8); s.lineTo(10.4, 11.8); },
      field: (s) => { s.moveTo(1.6, 16.6); s.lineTo(12, 9.4); s.lineTo(22.4, 16.6);
        s.lineTo(12, 21.6); s.closePath();
        s.moveTo(6.4, 13.4); s.lineTo(16.6, 19); s.moveTo(11.2, 10.2); s.lineTo(21, 16);
        s.moveTo(12, 9.4); s.lineTo(12, 2.4); },
      seed: (s) => { s.moveTo(12, 21.6); s.bezierCurveTo(6.4, 21.6, 3.4, 17.4, 3.4, 12.4);
        s.bezierCurveTo(3.4, 6.4, 7.4, 2.4, 12, 2.4); s.bezierCurveTo(16.6, 2.4, 20.6, 6.4, 20.6, 12.4);
        s.bezierCurveTo(20.6, 17.4, 17.6, 21.6, 12, 21.6); s.closePath();
        s.moveTo(12, 6.6); s.lineTo(12, 18); },
      gate: (s) => { s.moveTo(3.4, 5); s.lineTo(3.4, 21); s.moveTo(20.6, 5); s.lineTo(20.6, 21);
        s.moveTo(3.4, 8.6); s.lineTo(20.6, 8.6); s.moveTo(3.4, 17.4); s.lineTo(20.6, 17.4);
        s.moveTo(3.4, 17.4); s.lineTo(20.6, 8.6); s.moveTo(3.4, 8.6); s.lineTo(20.6, 17.4); },
      path: (s) => { s.moveTo(7, 21.6); s.bezierCurveTo(7, 15, 17, 15, 17, 9);
        s.bezierCurveTo(17, 4.6, 12.4, 2.4, 8, 2.4);
        s.moveTo(3.4, 21.6); s.bezierCurveTo(3.4, 13.4, 13.4, 13.4, 13.4, 9); },
    },
    make: {
      needle: (s) => { s.moveTo(3.4, 20.6); s.lineTo(17.4, 6.6); s.moveTo(14.6, 3.8);
        s.arc(17.4, 4.6, 2.9, 0, TAU); s.moveTo(19.4, 8.6); s.lineTo(15.4, 4.6); },
      spool: (s) => { s.moveTo(6.6, 2.6); s.lineTo(17.4, 2.6); s.moveTo(6.6, 21.4); s.lineTo(17.4, 21.4);
        s.moveTo(8.6, 2.6); s.lineTo(8.6, 21.4); s.moveTo(15.4, 2.6); s.lineTo(15.4, 21.4);
        s.moveTo(8.6, 7.6); s.lineTo(15.4, 7.6); s.moveTo(8.6, 12); s.lineTo(15.4, 12);
        s.moveTo(8.6, 16.4); s.lineTo(15.4, 16.4); },
      hammer: (s) => { s.moveTo(3.4, 20.6); s.lineTo(13, 11);
        s.moveTo(10.6, 8.6); s.lineTo(15.4, 3.8); s.lineTo(21, 9.4); s.lineTo(16.2, 14.2); s.closePath(); },
      kiln: (s) => { s.moveTo(4.4, 21.4); s.lineTo(4.4, 10); s.bezierCurveTo(4.4, 5, 7.8, 2.6, 12, 2.6);
        s.bezierCurveTo(16.2, 2.6, 19.6, 5, 19.6, 10); s.lineTo(19.6, 21.4); s.closePath();
        s.moveTo(9.4, 21.4); s.lineTo(9.4, 15); s.lineTo(14.6, 15); s.lineTo(14.6, 21.4); },
      loom: (s) => { for (let i = 0; i < 4; i++) { const x = 4.4 + i * 5.1;
        s.moveTo(x, 2.6); s.lineTo(x, 21.4); }
        for (let j = 0; j < 4; j++) { const y = 4.6 + j * 5.1;
        s.moveTo(2.6, y); s.lineTo(21.4, y); } },
      stamp: (s) => { s.moveTo(7, 2.6); s.lineTo(17, 2.6); s.lineTo(15.4, 11); s.lineTo(8.6, 11); s.closePath();
        s.moveTo(4.4, 14); s.lineTo(19.6, 14); s.lineTo(19.6, 17); s.lineTo(4.4, 17); s.closePath();
        s.moveTo(3.4, 21.4); s.lineTo(20.6, 21.4); },
    },
  };
  const SECTOR_NAMES = Object.keys(SECTORS);

  /* The set an identity gets.

     Twenty-four by default, and a sector swaps its six in at the end. Named
     rather than positional, so the manual can print what each one is and a
     package can be diffed against the last one. */
  function setOf(sector, count) {
    const want = Math.max(4, Math.min(30, Math.round(count || 24)));
    const trade = SECTORS[sector] ? Object.keys(SECTORS[sector]) : [];
    const core = CORE_ORDER.slice();
    if (trade.length) core.splice(Math.max(0, core.length - trade.length), trade.length);
    const all = core.concat(trade);
    return all.slice(0, want);
  }

  function glyphOf(key) {
    if (CORE[key]) return CORE[key];
    for (const s of SECTOR_NAMES) if (SECTORS[s][key]) return SECTORS[s][key];
    return null;
  }

  /* One icon, at (cx, cy), `size` across, in one of the three ways.

     The caller sets the inks; this never chooses a colour. `ground` is only
     read by `stamp`, which needs something to knock the glyph out in. */
  function draw(s, key, way, h, cx, cy, size, ground) {
    const g = glyphOf(key);
    if (!g) return false;
    const k = size / U;
    const how = WAYS.indexOf(way) > -1 ? way : WAYS[0];
    s.save();
    s.translate(cx - size / 2, cy - size / 2);
    s.scale(k, k);
    if (how === 'stamp') {
      const r = Math.max(0.8, h.r);
      s.beginPath();
      s.moveTo(r, 0); s.lineTo(U - r, 0); s.arc(U - r, r, r, -Math.PI / 2, 0);
      s.lineTo(U, U - r); s.arc(U - r, U - r, r, 0, Math.PI / 2);
      s.lineTo(r, U); s.arc(r, U - r, r, Math.PI / 2, Math.PI);
      s.lineTo(0, r); s.arc(r, r, r, Math.PI, Math.PI * 1.5);
      s.closePath();
      s.fill();
      // The glyph, smaller inside its tile and drawn in the ground, so the
      // stamp reads as one object rather than a glyph with a box round it.
      s.save();
      s.translate(U / 2, U / 2); s.scale(0.66, 0.66); s.translate(-U / 2, -U / 2);
      s.strokeStyle = ground;
      s.lineWidth = h.w * 1.3; s.lineCap = h.cap; s.lineJoin = h.join;
      s.beginPath(); g(s); s.stroke();
      s.restore();
      s.restore();
      return true;
    }
    s.lineWidth = how === 'solid' ? h.w * 1.85 : h.w;
    s.lineCap = how === 'solid' ? 'round' : h.cap;
    s.lineJoin = how === 'solid' ? 'round' : h.join;
    s.beginPath(); g(s); s.stroke();
    s.restore();
    return true;
  }

  return { U, WAYS, CORE, SECTORS, SECTOR_NAMES, CORE_ORDER, hand, setOf, glyphOf, draw };
}));
