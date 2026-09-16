/* The mark, set as a printer's ornament.

   A fleuron is a single piece of type — a leaf, a flower, a scroll — and the
   thing printers did with them for four hundred years was not repeat one. They
   set the same sort in different *orientations*, and the ornament is what
   happens at the joins: four units turned about a point make a rosette, four
   mirrored make a lozenge, and a whole page of them makes a lace that no single
   piece of the type contains.

   So this deals orientations rather than shapes. One drawing, up to eight ways
   of setting it — the four quarter-turns and their mirrors, which together are
   the symmetry group of the square and therefore the whole of what a compositor
   could physically do with a square sort. The orientation is a function of the
   cell's position, not of a hash, because a compositor setting a border is
   working to a scheme and a random one reads as a case of pied type.

   Four settings, and they are the four a specimen book shows:

   `lace` is the full field — every cell set, orientations cycling, which is the
   printers'-flowers page.

   `band` is a course of ornament between two rules, with plain leading above
   and below it. This is the one that actually gets used: a masthead rule, a
   chapter opening, the head of a letterhead.

   `border` frames the tile — a course round all four edges with the corners set
   at the turn, and the middle left open for something else to sit in.

   `diaper` sets the ornament on alternate cells only, so the ground shows
   between them in a lattice of its own. The lightest of the four and the one
   that survives being enlarged.

   The rules are set at the type's own weight, and the leading is measured in
   cells rather than in a made-up unit, so the whole thing scales as one piece
   the way a page of metal does. */
//
// UMD: `paint` runs in the studio, which has no require.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../motif'), require('../tone'));
  } else root.PatternOrnament = factory(root.PatternMotif, root.PatternTone);
}(typeof self !== 'undefined' ? self : this, function (MOTIF, TONE) {
  'use strict';

  const R3 = (v) => Math.round(v * 1000) / 1000;
  const SETTINGS = ['lace', 'band', 'border', 'diaper'];
  /* The symmetry group of the square, as [quarter turns, mirrored]. In the
     order a compositor would reach for them: the four turns first, because a
     turn needs no second sort, then the four mirrors, which in metal needed a
     second cutting and so were the expensive half of the case. */
  const SETS = [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1]];

  const mod = (n, p) => ((n % p) + p) % p;

  /* Which way a cell is set.

     By position, in a scheme: the column advances the turn and the row advances
     it by two, so a 2x2 block holds four different settings and the rosette
     appears at every block's centre. With mirrors in play the row also flips,
     which is what turns the rosettes into facing pairs — the move that makes a
     border's two long sides look like each other rather than like a rotation.

     Taken modulo the lattice, so the scheme closes with the tile rather than
     running off the end of it. */
  function settingOf(i, j, ways, L) {
    const n = Math.max(1, Math.min(SETS.length, Math.round(ways)));
    // Modulo the lattice first, so the scheme comes round with the tile. Index
    // the raw position and the setting at column `cols` is not the setting at
    // column 0 unless the count divides, which puts a break down the join.
    const x = L ? mod(i, L.cols) : i;
    const y = L ? mod(j, L.rows) : j;
    return SETS[mod(x + y * 2, n)];
  }

  function unit(s, m, cx, cy, r, set, body) {
    s.save();
    s.translate(R3(cx), R3(cy));
    if (set[1]) s.scale(-1, 1);
    if (set[0]) s.rotate((set[0] * Math.PI) / 2);
    if (MOTIF.path(s, m, 0, 0, r)) {
      if (m.stroked) {
        s.lineWidth = Math.max((m.weight || 0.06) * r * 2, body * 0.12 * r * 2);
        s.lineCap = 'round';
        s.lineJoin = 'round';
        s.strokeStyle = s.fillStyle;
        s.stroke();
      } else s.fill('nonzero');
    }
    s.restore();
  }

  // Whole cells across and down, because an ornament that does not divide the
  // measure is an ornament with a broken sort at the end of the line.
  function lattice(W, H, p) {
    const cols = Math.max(1, Math.round(p.cells));
    const step = W / cols;
    const rows = Math.max(1, Math.round(H / step));
    return { cols, rows, stepX: W / cols, stepY: H / rows };
  }

  function paint(surface, W, H, p, pal) {
    const setting = SETTINGS.indexOf(p.setting) > -1 ? p.setting : SETTINGS[0];
    const m = p.motif;
    const L = lattice(W, H, p);
    const ink = pal.ink(Math.max(0, Math.min(pal.inks.length - 1, Math.round(p.ink))));
    pal.paper(surface, W, H, pal.ground);
    const usable = !!(m && m.ops && m.ops.length);
    const r = Math.min(L.stepX, L.stepY) * 0.5 * p.scale;
    const lead = Math.max(0, Math.min(Math.floor((L.rows - 1) / 2), Math.round(p.lead)));

    /* Which cells carry a sort. Stated as a test rather than as four loops,
       because the four settings differ only in where the type goes and writing
       them as four loops is how the corner of a border ends up set twice. */
    const carries = (i, j) => {
      if (setting === 'lace') return true;
      if (setting === 'diaper') return !mod(i + j, 2);
      if (setting === 'band') return j >= lead && j < L.rows - lead;
      return i < 1 || i >= L.cols - 1 || j < 1 || j >= L.rows - 1;
    };

    /* The rules.

       A band is a course between two rules and a border is a course inside one,
       and in both cases the rule is what makes it read as set matter rather
       than as a pattern that happens to stop. Drawn at the type's own weight,
       which is the whole reason the two look like one piece. */
    if (p.rule > 0 && (setting === 'band' || setting === 'border')) {
      const w = Math.max(0.4, p.rule * Math.min(L.stepX, L.stepY) * 0.14);
      surface.strokeStyle = ink;
      surface.lineWidth = w;
      surface.beginPath();
      if (setting === 'band') {
        for (const y of [lead * L.stepY, (L.rows - lead) * L.stepY]) {
          surface.moveTo(0, R3(y)); surface.lineTo(W, R3(y));
        }
      } else {
        const a = L.stepX, b = L.stepY;
        surface.moveTo(R3(a), R3(b)); surface.lineTo(R3(W - a), R3(b));
        surface.lineTo(R3(W - a), R3(H - b)); surface.lineTo(R3(a), R3(H - b));
        surface.closePath();
      }
      surface.stroke();
    }

    if (!usable || r < 1) return;
    for (let j = 0; j < L.rows; j++) {
      for (let i = 0; i < L.cols; i++) {
        if (!carries(i, j)) continue;
        // The inks alternate with the setting, so a two-colour case reads as a
        // two-colour case rather than as one colour with a stripe in it.
        const set = settingOf(i, j, p.ways, L);
        const many = Math.max(1, Math.min(pal.inks.length, Math.round(p.colours)));
        surface.fillStyle = surface.strokeStyle = pal.ink(mod(Math.round(p.ink) + i + j, many));
        unit(surface, m, (i + 0.5) * L.stepX, (j + 0.5) * L.stepY, r, set, p.body);
      }
    }
  }

  const controls = [
    { group: 'pattern', key: 'setting', primary: true, label: 'Setting', type: 'chips', options: SETTINGS },
    { group: 'pattern', key: 'cells', primary: true, label: 'Sorts across', type: 'range', min: 2, max: 24, step: 1 },
    { group: 'pattern', key: 'lead', label: 'Leading', type: 'range', min: 0, max: 8, step: 1 },
    { group: 'pattern', key: 'rule', label: 'Rule', type: 'range', min: 0, max: 1, step: 0.02 },
    { group: 'mark', key: 'scale', primary: true, label: 'Sort size', type: 'range', min: 0.2, max: 1.2, step: 0.02,
      needs: { of: 'motif', key: 'moves', least: 1,
        without: 'No shape could be read out of this drawing, so there is no sort to set. '
          + 'The rules are still here.' } },
    { group: 'mark', key: 'ways', label: 'Settings in the case', type: 'range', min: 1, max: 8, step: 1 },
    { group: 'mark', key: 'body', label: 'Type weight', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'pattern', key: 'colours', label: 'Colours', type: 'range', min: 1, max: 4, step: 1 },
    { group: 'pattern', key: 'ink', label: 'Ink', type: 'range', min: 0, max: 5, step: 1 },
    { group: 'pattern', key: 'seed', label: 'Seed', type: 'seed' },
  ];

  return { key: 'ornament', kind: 'pattern', vector: true, motif: true, needsMotif: true, ratio: 1,
    controls, paint, lattice, settingOf, unit, SETTINGS, SETS };
}));
