/* The icon set, laid out as a pattern.

   An icon set is twenty-four drawings; a sign system is what you do with them.
   This is the second half: the presets that arrange the set into a cloth, so a
   client can see the icons as a repeat before they ever see them on a button.

   Four arrangements, and they are the four a sign shop actually uses:

   `grid` sets them in ranks and files, one per cell, in order. A key, a legend,
   a wall of pictograms. The plainest and the one that reads as a *set*.

   `scatter` deals them over the tile at mixed sizes with the wrapped distance
   between them, so no two of a kind sit together and the field reads as
   incidental rather than ruled.

   `band` runs them in courses with plain leading between, the way a strip of
   wayfinding runs along a wall.

   `single` repeats one icon on a lattice, which is what a house does when one
   of the twenty-four has become the second mark.

   Which icons appear is the set the identity was given — the twenty-four, or
   its trade's own six swapped in at the end. Nothing here invents a glyph.

   All three ways of drawing an icon are available as a control rather than a
   decision made here: a pen set makes a light cloth, a stamp set makes a dense
   one, and which of those a brand wants is not something a measurement knows. */
//
// UMD: `paint` runs in the studio, which has no require.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../rand'), require('../icons'), require('../tone'));
  } else root.PatternSignage = factory(root.PatternRand, root.PatternIcons, root.PatternTone);
}(typeof self !== 'undefined' ? self : this, function (RAND, ICONS, TONE) {
  'use strict';

  const R3 = (v) => Math.round(v * 1000) / 1000;
  const LAYOUTS = ['grid', 'scatter', 'band', 'single'];
  const mod = (n, p) => ((n % p) + p) % p;

  // Whole cells, because a legend that does not divide its board is a legend
  // with half an icon at the edge.
  function lattice(W, H, p) {
    const cols = Math.max(1, Math.round(p.cells));
    const step = W / cols;
    const rows = Math.max(1, Math.round(H / step));
    return { cols, rows, stepX: W / cols, stepY: H / rows };
  }

  /* Where the scattered ones go: best candidate with the wrapped distance, the
     same as the botanical scatter uses, so an icon near an edge is not offered
     the room its own wrapped twin is standing in. */
  function places(p) {
    const n = Math.max(1, Math.round(p.count));
    const seed = (p.seed || 1) * 167;
    const out = [];
    const d2 = (ax, ay, bx, by) => {
      const dx = Math.abs(ax - bx), dy = Math.abs(ay - by);
      const x = Math.min(dx, 1 - dx), y = Math.min(dy, 1 - dy);
      return x * x + y * y;
    };
    for (let k = 0; k < n; k++) {
      let bx = 0, by = 0, best = -1;
      for (let t = 0; t < 12; t++) {
        const cx = RAND.hash01(k, t, seed + 1);
        const cy = RAND.hash01(k, t, seed + 2);
        let d = 4;
        for (const o of out) d = Math.min(d, d2(cx, cy, o.x, o.y));
        if (d > best) { best = d; bx = cx; by = cy; }
      }
      out.push({ x: bx, y: by, jig: RAND.hash01(k, 5, seed + 3), turn: RAND.hash01(k, 7, seed + 4) });
    }
    return out;
  }

  function paint(surface, W, H, p, pal) {
    const layout = LAYOUTS.indexOf(p.layout) > -1 ? p.layout : LAYOUTS[0];
    const way = ICONS.WAYS.indexOf(p.way) > -1 ? p.way : ICONS.WAYS[0];
    const ground = pal.ground;
    pal.paper(surface, W, H, ground);
    const h = ICONS.hand(p.mark || null, p.motif || null);
    const set = ICONS.setOf(p.sector, p.icons);
    if (!set.length) return;
    const many = Math.max(1, Math.min(pal.inks.length, Math.round(p.colours)));
    const ink = (i) => pal.ink(mod(Math.round(p.ink) + i, many));

    if (layout === 'scatter') {
      const spacing = Math.sqrt((W * H) / Math.max(1, Math.round(p.count)));
      const base = spacing * (0.5 + p.size * 0.9);
      const pts = places(p);
      pts.forEach((q, k) => {
        const size = base * (1 - p.vary * 0.5 + q.jig * p.vary);
        const key = set[mod(k, set.length)];
        surface.fillStyle = surface.strokeStyle = ink(k);
        // Nine passes so an icon over an edge returns on the other side.
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const cx = q.x * W + dx * W, cy = q.y * H + dy * H;
            if (cx < -size || cx > W + size || cy < -size || cy > H + size) continue;
            surface.save();
            if (p.turn) { surface.translate(R3(cx), R3(cy)); surface.rotate((q.turn - 0.5) * p.turn * Math.PI);
              ICONS.draw(surface, key, way, h, 0, 0, size, ground); }
            else ICONS.draw(surface, key, way, h, R3(cx), R3(cy), size, ground);
            surface.restore();
          }
        }
      });
      return;
    }

    const L = lattice(W, H, p);
    const size = Math.min(L.stepX, L.stepY) * p.size;
    const lead = Math.max(0, Math.min(Math.floor(L.rows / 2), Math.round(p.lead)));
    for (let j = 0; j < L.rows; j++) {
      // A course of icons with plain leading between courses.
      if (layout === 'band' && lead && mod(j, lead + 1)) continue;
      for (let i = 0; i < L.cols; i++) {
        // Dealt by position, modulo the lattice, so the set comes round with
        // the tile rather than running off the end of it.
        const k = layout === 'single' ? Math.max(0, Math.min(set.length - 1, Math.round(p.which)))
          : mod(mod(i, L.cols) + mod(j, L.rows) * L.cols, set.length);
        surface.fillStyle = surface.strokeStyle = ink(layout === 'single' ? j + i : k);
        const drop = p.drop && mod(j, 2) ? L.stepX * p.drop : 0;
        const cx = mod((i + 0.5) * L.stepX + drop, W);
        ICONS.draw(surface, set[k], way, h, R3(cx), R3((j + 0.5) * L.stepY), size, ground);
        // and again where the drop pushed it over the edge
        if (drop) {
          const twin = cx > W - size ? cx - W : cx < size ? cx + W : null;
          if (twin != null) ICONS.draw(surface, set[k], way, h, R3(twin), R3((j + 0.5) * L.stepY), size, ground);
        }
      }
    }
  }

  const controls = [
    { group: 'pattern', key: 'layout', primary: true, label: 'Arrangement', type: 'chips', options: LAYOUTS },
    { group: 'pattern', key: 'way', primary: true, label: 'Drawn as', type: 'chips', options: ICONS.WAYS },
    { group: 'pattern', key: 'cells', primary: true, label: 'Icons across', type: 'range', min: 2, max: 14, step: 1 },
    { group: 'pattern', key: 'size', label: 'Icon size', type: 'range', min: 0.3, max: 1.1, step: 0.02 },
    { group: 'pattern', key: 'drop', label: 'Row drop', type: 'range', min: 0, max: 1, step: 0.02 },
    { group: 'pattern', key: 'lead', label: 'Leading', type: 'range', min: 0, max: 5, step: 1 },
    { group: 'pattern', key: 'count', label: 'Scattered count', type: 'range', min: 4, max: 90, step: 1 },
    { group: 'pattern', key: 'vary', label: 'Size spread', type: 'range', min: 0, max: 1, step: 0.02 },
    { group: 'pattern', key: 'turn', label: 'Tumble', type: 'range', min: 0, max: 1, step: 0.02 },
    { group: 'mark', key: 'icons', label: 'Icons in the set', type: 'range', min: 4, max: 30, step: 1 },
    { group: 'mark', key: 'which', label: 'Which one', type: 'range', min: 0, max: 29, step: 1 },
    { group: 'mark', key: 'sector', label: 'Trade', type: 'chips', options: [''].concat(ICONS.SECTOR_NAMES),
      labels: ['general'].concat(ICONS.SECTOR_NAMES) },
    { group: 'pattern', key: 'colours', label: 'Inks', type: 'range', min: 1, max: 5, step: 1 },
    { group: 'pattern', key: 'ink', label: 'First ink', type: 'range', min: 0, max: 5, step: 1 },
    { group: 'pattern', key: 'seed', label: 'Seed', type: 'seed' },
  ];

  return { key: 'signage', kind: 'pattern', vector: true, motif: true, ratio: 1,
    controls, paint, lattice, places, LAYOUTS };
}));
