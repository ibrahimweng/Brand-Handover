/* A mirrored banner, built out of the mark.

   PLAYGRND's Totem quantises everything to a pixel unit, draws a coarse
   cellular border of clotted flecks, then composes only the LEFT HALF of the
   inner panel — recursively bisecting it until it has the asked-for number of
   regions, dealing each a motif from a bag of stripes, checks, bricks and
   rings — and reflects that half across the centre. A nested emblem core is
   stamped in the middle. The mirror is the whole character: it is what turns a
   set of rectangles into a totem.

   Its motifs are patterns. Here the bag includes the mark, and the core at the
   centre is the mark, so what the banner is built out of and what it is
   crowned with are both the client's own drawing. A mirrored banner is
   heraldic by nature, which is the one composition in this set where putting
   the mark dead centre is right rather than lazy.

   Quantising to a unit is kept exactly as the spec has it, and it is not a
   detail: every edge lands on the same lattice, so nothing anti-aliases and
   the whole banner reads as printed rather than rendered. */
//
// UMD: `paint` runs in the studio, which has no require.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../rand'), require('../motif'));
  } else root.PatternTotem = factory(root.PatternRand, root.PatternMotif);
}(typeof self !== 'undefined' ? self : this, function (RAND, MOTIF) {
  'use strict';

  const R3 = (v) => Math.round(v * 1000) / 1000;
  const MOTIFS = ['solid', 'check', 'hline', 'vline', 'diag', 'brick', 'dash', 'grid', 'rings', 'mark'];

  // The left half, split by repeatedly bisecting whichever rectangle is
  // largest. Bisecting the largest rather than a random one is what keeps the
  // regions in the same family of sizes instead of one filling the panel.
  function carve(x, y, w, h, want, u, seed) {
    const regions = [{ x, y, w, h }];
    let n = 0;
    while (regions.length < want && n < want * 4) {
      let at = 0;
      for (let i = 1; i < regions.length; i++) {
        if (regions[i].w * regions[i].h > regions[at].w * regions[at].h) at = i;
      }
      const r = regions[at];
      const f = 0.3 + RAND.hash01(n, 1, seed) * 0.4;
      const along = Math.abs(r.w - r.h) < u ? RAND.hash01(n, 2, seed) > 0.5 : r.w > r.h;
      if (along) {
        const cut = Math.max(u, Math.round((r.w * f) / u) * u);
        if (cut < u || r.w - cut < u) { n++; continue; }
        regions.splice(at, 1, { x: r.x, y: r.y, w: cut, h: r.h },
          { x: r.x + cut, y: r.y, w: r.w - cut, h: r.h });
      } else {
        const cut = Math.max(u, Math.round((r.h * f) / u) * u);
        if (cut < u || r.h - cut < u) { n++; continue; }
        regions.splice(at, 1, { x: r.x, y: r.y, w: r.w, h: cut },
          { x: r.x, y: r.y + cut, w: r.w, h: r.h - cut });
      }
      n++;
    }
    return regions;
  }

  function fillRegion(s, r, kind, u, fg, bg, motif) {
    s.fillStyle = bg;
    s.fillRect(R3(r.x), R3(r.y), R3(r.w), R3(r.h));
    s.fillStyle = fg;
    if (kind === 'solid') { s.fillRect(R3(r.x), R3(r.y), R3(r.w), R3(r.h)); return; }
    if (kind === 'mark') {
      const ops = motif && motif.fillOps && motif.fillOps.length ? motif.fillOps
        : (motif && motif.ops) || null;
      if (ops) {
        s.save();
        s.beginPath(); s.rect(R3(r.x), R3(r.y), R3(r.w), R3(r.h)); s.clip();
        MOTIF.draw(s, { ops, stroked: false }, R3(r.x + r.w / 2), R3(r.y + r.h / 2),
          R3(Math.min(r.w, r.h) * 0.42));
        s.restore();
        return;
      }
      kind = 'solid';
      s.fillRect(R3(r.x), R3(r.y), R3(r.w), R3(r.h));
      return;
    }
    const cols = Math.max(1, Math.round(r.w / u)), rows = Math.max(1, Math.round(r.h / u));
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        let on = false;
        if (kind === 'check') on = (i + j) % 2 === 0;
        else if (kind === 'hline') on = j % 2 === 0;
        else if (kind === 'vline') on = i % 2 === 0;
        else if (kind === 'diag') on = (i + j) % 3 === 0;
        else if (kind === 'brick') on = (j % 2 ? (i + 1) % 4 : i % 4) === 0 || j % 2 === 0;
        else if (kind === 'dash') on = i % 4 < 2 && j % 2 === 0;
        else if (kind === 'grid') on = i % 3 === 0 || j % 3 === 0;
        else if (kind === 'rings') {
          const d = Math.hypot(i - cols / 2, j - rows / 2);
          on = Math.round(d) % 3 === 0;
        }
        if (on) s.fillRect(R3(r.x + i * u), R3(r.y + j * u), R3(u), R3(u));
      }
    }
  }

  function paint(surface, W, H, p, pal) {
    const u = Math.max(1, Math.min(W, H) / Math.max(8, Math.round(p.grain)));
    const inks = pal.inks;
    const dark = inks[inks.length - 1].hex;
    pal.paper(surface, W, H, pal.ground);

    // The border: a coarse binary field clotted by two passes of majority vote,
    // so the flecks gather into shapes rather than staying salt and pepper.
    const bw = Math.round((W * p.border) / u) * u;
    if (bw > 0 && p.flecks > 0.001) {
      const cs = u * Math.max(1, Math.round(p.fleckSize));
      const cols = Math.ceil(W / cs), rows = Math.ceil(H / cs);
      let field = new Uint8Array(cols * rows);
      for (let i = 0; i < field.length; i++) {
        field[i] = RAND.hash01(i % cols, Math.floor(i / cols), (p.seed || 1) * 7) < p.flecks ? 1 : 0;
      }
      for (let pass = 0; pass < 2; pass++) {
        const next = new Uint8Array(cols * rows);
        for (let j = 0; j < rows; j++) {
          for (let i = 0; i < cols; i++) {
            let n = 0;
            for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
              if (!a && !b) continue;
              const x = i + a, y = j + b;
              if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
              n += field[y * cols + x];
            }
            next[j * cols + i] = n > 4 ? 1 : n < 4 ? 0 : field[j * cols + i];
          }
        }
        field = next;
      }
      surface.fillStyle = inks[Math.min(1, inks.length - 1)].hex;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          if (!field[j * cols + i]) continue;
          const x = i * cs, y = j * cs;
          if (x >= bw && x < W - bw && y >= bw && y < H - bw) continue;
          surface.fillRect(R3(x), R3(y), R3(cs), R3(cs));
        }
      }
    }

    // The panel, inset by a printed keyline.
    const px = bw, py = bw;
    const pw = W - bw * 2, ph = H - bw * 2;
    surface.fillStyle = dark;
    surface.fillRect(R3(px), R3(py), R3(pw), R3(ph));
    const rule = Math.round(p.rule) * u;
    const ix = px + rule, iy = py + rule, iw = pw - rule * 2, ih = ph - rule * 2;
    if (iw <= u || ih <= u) return;

    // Only the left half is composed; the right is its reflection.
    const half = Math.round((iw / 2) / u) * u;
    const regions = carve(ix, iy, half, ih, Math.max(1, Math.round(p.regions)), u, (p.seed || 1) * 11);
    const bag = MOTIFS.slice(0, Math.max(2, Math.round(2 + p.variety * (MOTIFS.length - 2))));
    const dealt = regions.map((r, i) => {
      const k = (p.seed || 1) * 17 + i;
      let kind = bag[Math.floor(RAND.hash01(i, 1, k) * bag.length) % bag.length];
      // `solid` gets one re-roll most of the time, so flat shapes stay a
      // minority and the banner keeps its texture.
      if (kind === 'solid' && RAND.hash01(i, 2, k) < 0.55) {
        kind = bag[Math.floor(RAND.hash01(i, 3, k) * bag.length) % bag.length];
      }
      const fg = inks[Math.floor(RAND.hash01(i, 4, k) * inks.length) % inks.length].hex;
      // `dark` twice in the background bag, so the panel shows through as depth.
      const backs = inks.map((x) => x.hex).concat([dark, dark]);
      const bg = backs[Math.floor(RAND.hash01(i, 5, k) * backs.length) % backs.length];
      const twin = RAND.hash01(i, 6, k) < p.mirror ? kind
        : bag[Math.floor(RAND.hash01(i, 7, k) * bag.length) % bag.length];
      return { r, kind, fg, bg, twin };
    });
    for (const d of dealt) fillRegion(surface, d.r, d.kind, u, d.fg, d.bg, p.motif);
    // The reflection, then the original repainted over it so a wide twin can
    // never overwrite the half that was actually composed.
    for (const d of dealt) {
      const m = { x: ix + iw - (d.r.x - ix) - d.r.w, y: d.r.y, w: d.r.w, h: d.r.h };
      fillRegion(surface, m, d.twin, u, d.fg, d.bg, p.motif);
    }
    for (const d of dealt) fillRegion(surface, d.r, d.kind, u, d.fg, d.bg, p.motif);

    // The core: nested rectangles with the mark inside.
    const core = Math.round((Math.min(iw, ih) * p.core) / u) * u;
    if (core > u * 2) {
      const cx = ix + iw / 2, cy = iy + ih / 2;
      for (let i = Math.round(p.rings); i >= 1; i--) {
        const s2 = core + i * u * 2;
        surface.fillStyle = i % 2 ? dark : inks[Math.floor(RAND.hash01(i, 9, (p.seed || 1) * 19) * inks.length) % inks.length].hex;
        surface.fillRect(R3(cx - s2 / 2), R3(cy - s2 / 2), R3(s2), R3(s2));
      }
      // The innermost square is always `dark` and the mark on it is always the
      // ink that reads furthest from the ground. Dealt a colour like every
      // other ring, the centre came out the same hex as the mark drawn on it,
      // so eight banners had an empty square where their logo should be —
      // visible only by looking, because nothing about it is an error.
      surface.fillStyle = dark;
      surface.fillRect(R3(cx - core / 2), R3(cy - core / 2), R3(core), R3(core));
      const ops = p.motif && p.motif.fillOps && p.motif.fillOps.length ? p.motif.fillOps
        : (p.motif && p.motif.ops) || null;
      surface.fillStyle = inks[0].hex === dark && inks.length > 1 ? inks[inks.length - 2].hex : inks[0].hex;
      if (ops) MOTIF.draw(surface, { ops, stroked: false }, R3(cx), R3(cy), R3(core * 0.38));
    }
  }

  const controls = [
    { group: 'border', key: 'border', label: 'Border width', type: 'range', min: 0, max: 0.4, step: 0.005 },
    { group: 'border', key: 'flecks', label: 'Flecks', type: 'range', min: 0, max: 0.7, step: 0.01 },
    { group: 'border', key: 'fleckSize', label: 'Fleck size', type: 'range', min: 1, max: 6, step: 1 },
    { group: 'border', key: 'rule', label: 'Keyline', type: 'range', min: 0, max: 10, step: 1 },
    { group: 'panel', key: 'regions', label: 'Regions', type: 'range', min: 1, max: 30, step: 1 },
    { group: 'panel', key: 'grain', label: 'Pixel unit', type: 'range', min: 16, max: 200, step: 1 },
    { group: 'panel', key: 'mirror', label: 'Mirror', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'panel', key: 'variety', label: 'Variety', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'core', key: 'core', label: 'Core size', type: 'range', min: 0, max: 0.6, step: 0.01,
      needs: { of: 'motif', key: 'silhouette', least: 1,
        without: 'No shape could be read out of this drawing, so the core has nothing to crown it with.' } },
    { group: 'core', key: 'rings', label: 'Rings', type: 'range', min: 0, max: 8, step: 1 },
    { group: 'core', key: 'seed', label: 'Seed', type: 'seed' },
  ];

  return { key: 'totem', kind: 'poster', vector: true, motif: true, tiles: false, ratio: 0.75,
    motifs: MOTIFS, controls, paint, carve };
}));
