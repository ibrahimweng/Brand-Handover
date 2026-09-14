/* A specimen poster: a grid of blocks, each one a way of drawing the identity.

   PLAYGRND's Specimen walks a cell grid in reading order, leaves some cells as
   bare page, and claims others as blocks — some spanning two or three cells —
   each drawing one of eight things: a flat panel, contour marble, advected
   tendrils, nested loops, rings, a fan of blades, hung arcs, scattered spikes.
   It is the one tool in the set whose subject is *variety*: a page that shows
   what a system can do.

   Which is exactly what a brand's specimen sheet is for, so two of the eight
   here are the mark and the logotype, and everything else is drawn in the
   identity's inks. A client looking at it sees their own drawings set out
   beside the shapes their palette makes — the page a designer would pin up.

   The spanning is kept as the spec has it, footprints listed twice for the
   small ones so they dominate, because a grid where every block is 3×3 is not
   a specimen sheet, it is a chequerboard. */
//
// UMD: `paint` runs in the studio, which has no require.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../rand'), require('../motif'));
  } else root.PatternSpecimen = factory(root.PatternRand, root.PatternMotif);
}(typeof self !== 'undefined' ? self : this, function (RAND, MOTIF) {
  'use strict';

  const R3 = (v) => Math.round(v * 1000) / 1000;
  const KINDS = ['mark', 'word', 'flat', 'loops', 'rings', 'fan', 'arcs', 'spikes'];
  // Listed twice for the small ones, so they dominate and the sheet keeps its
  // grain. Straight from the spec, and the reason is worth keeping.
  const SPANS = [[2, 1], [1, 2], [2, 2], [2, 1], [1, 2], [2, 2], [3, 1], [1, 3], [2, 3], [3, 2], [3, 3]];

  function block(s, kind, x, y, w, h, p, pal, k) {
    const inks = pal.inks;
    const ink = (i) => inks[((i % inks.length) + inks.length) % inks.length].hex;
    const r = (n) => RAND.hash01(k * 13 + n, k * 7 + 3, (p.seed || 1) * 19 + n);
    const pad = Math.min(w, h) * 0.08;
    const bx = x + pad, by = y + pad, bw = w - pad * 2, bh = h - pad * 2;
    const shape = kind === 'word' ? p.word : p.motif;
    if (kind === 'mark' || kind === 'word') {
      if (!shape || !shape.ops || !shape.ops.length) { kind = 'flat'; } else {
        s.fillStyle = ink(Math.floor(r(1) * inks.length));
        s.fillRect(R3(x), R3(y), R3(w), R3(h));
        s.fillStyle = r(2) < p.inkShare ? inks[inks.length - 1].hex : pal.ground;
        const ops = shape.fillOps && shape.fillOps.length ? shape.fillOps : shape.ops;
        const wide = Math.min(2.6, Math.max(1, shape.ratio || 1));
        s.save();
        s.beginPath(); s.rect(R3(x), R3(y), R3(w), R3(h)); s.clip();
        MOTIF.draw(s, { ops, stroked: false }, R3(x + w / 2), R3(y + h / 2),
          R3(Math.min(bw / wide, bh) * 0.46 * wide));
        s.restore();
        return;
      }
    }
    if (kind === 'flat') {
      s.fillStyle = ink(Math.floor(r(3) * inks.length));
      s.fillRect(R3(x), R3(y), R3(w), R3(h));
      return;
    }
    s.fillStyle = r(4) < p.inkShare ? inks[inks.length - 1].hex : pal.ground;
    s.fillRect(R3(x), R3(y), R3(w), R3(h));
    s.save();
    s.beginPath(); s.rect(R3(x), R3(y), R3(w), R3(h)); s.clip();
    s.lineWidth = Math.max(0.5, p.weight);
    const cx = bx + bw / 2, cy = by + bh / 2;
    if (kind === 'loops') {
      const n = 2 + Math.floor(r(5) * 7);
      for (let i = 0; i < n; i++) {
        s.strokeStyle = ink(Math.floor(r(6) * inks.length) + i);
        s.save();
        s.translate(R3(cx), R3(cy));
        s.rotate(r(7) * Math.PI);
        s.beginPath();
        s.arc(0, 0, R3((bw / 2) * (1 - i / (n + 1))), 0, Math.PI * 2);
        s.restore();
        s.stroke();
      }
    } else if (kind === 'rings') {
      const n = 3 + Math.floor(r(8) * 13);
      for (let i = 0; i < n; i++) {
        s.strokeStyle = ink(Math.floor(r(9) * inks.length) + i);
        s.beginPath();
        s.arc(R3(cx), R3(cy), R3((Math.min(bw, bh) / 2) * ((i + 1) / n)), 0, Math.PI * 2);
        s.stroke();
      }
    } else if (kind === 'fan') {
      const n = 3 + Math.floor(r(10) * 11);
      const px = bx + bw * r(11), py = by + bh * (0.7 + r(12) * 0.5);
      const from = -Math.PI * (0.75 + r(13) * 0.2);
      const span = Math.PI * (0.4 + r(14) * 0.5);
      for (let i = 0; i < n; i++) {
        const a0 = from + (span * i) / n, a1 = from + (span * (i + 0.72)) / n;
        const len = Math.hypot(bw, bh);
        s.fillStyle = ink(Math.floor(r(15) * inks.length) + i);
        s.beginPath();
        s.moveTo(R3(px), R3(py));
        s.lineTo(R3(px + Math.cos(a0) * len), R3(py + Math.sin(a0) * len));
        s.lineTo(R3(px + Math.cos(a1) * len), R3(py + Math.sin(a1) * len));
        s.closePath();
        s.fill();
      }
    } else if (kind === 'arcs') {
      const n = 3 + Math.floor(r(16) * 13);
      const py = by - bh * 0.3;
      for (let i = 0; i < n; i++) {
        s.strokeStyle = ink(Math.floor(r(17) * inks.length) + i);
        s.beginPath();
        s.arc(R3(cx), R3(py), R3(bh * (0.3 + (i + 1) * (1.1 / n))), 0.15 * Math.PI, 0.85 * Math.PI);
        s.stroke();
      }
    } else {
      const n = 3 + Math.floor(r(18) * 15);
      for (let i = 0; i < n; i++) {
        const px = bx + bw * RAND.hash01(i, k + 1, (p.seed || 1) * 23);
        const py = by + bh * RAND.hash01(i, k + 2, (p.seed || 1) * 23);
        const a = RAND.hash01(i, k + 3, (p.seed || 1) * 23) * Math.PI * 2;
        const len = Math.min(bw, bh) * (0.12 + RAND.hash01(i, k + 4, (p.seed || 1) * 23) * 0.5);
        const wide2 = len * 0.22;
        s.fillStyle = ink(i + Math.floor(r(19) * inks.length));
        s.beginPath();
        s.moveTo(R3(px + Math.cos(a) * len), R3(py + Math.sin(a) * len));
        s.lineTo(R3(px + Math.cos(a + 2.2) * wide2), R3(py + Math.sin(a + 2.2) * wide2));
        s.lineTo(R3(px + Math.cos(a - 2.2) * wide2), R3(py + Math.sin(a - 2.2) * wide2));
        s.closePath();
        s.fill();
      }
    }
    s.restore();
  }

  function paint(surface, W, H, p, pal) {
    pal.paper(surface, W, H, pal.ground);
    const cols = Math.max(2, Math.round(p.columns));
    const rows = Math.max(2, Math.round((cols * H) / W));
    const cw = W / cols, ch = H / rows;
    const taken = new Uint8Array(cols * rows);
    const bag = KINDS.filter((k) => (k !== 'mark' || (p.motif && p.motif.ops))
      && (k !== 'word' || (p.word && p.word.ops)));
    let k = 0;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (taken[y * cols + x]) continue;
        k++;
        if (RAND.hash01(x, y, (p.seed || 1) * 3) > p.fill) { taken[y * cols + x] = 1; continue; }
        let w = 1, h = 1;
        if (RAND.hash01(x, y, (p.seed || 1) * 5) < p.spanning) {
          for (let t = 0; t < SPANS.length; t++) {
            const [sw, sh] = SPANS[(t + Math.floor(RAND.hash01(x, y, (p.seed || 1) * 7) * SPANS.length)) % SPANS.length];
            if (x + sw > cols || y + sh > rows) continue;
            let ok = true;
            for (let j = 0; j < sh && ok; j++) for (let i = 0; i < sw; i++) if (taken[(y + j) * cols + x + i]) { ok = false; break; }
            if (ok) { w = sw; h = sh; break; }
          }
        }
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) taken[(y + j) * cols + x + i] = 1;
        // The mark and the logotype carry extra weight in the bag, because this
        // sheet is about the identity rather than about the palette.
        const roll = RAND.hash01(x + 3, y + 5, (p.seed || 1) * 11);
        const kind = roll < p.identity && bag.indexOf('mark') > -1
          ? (roll < p.identity / 2 && bag.indexOf('word') > -1 ? 'word' : 'mark')
          : bag[Math.floor(RAND.hash01(x + 7, y + 11, (p.seed || 1) * 13) * bag.length) % bag.length];
        const g = Math.min(cw, ch) * p.gutter;
        block(surface, kind, x * cw + g / 2, y * ch + g / 2, w * cw - g, h * ch - g, p, pal, k);
      }
    }
    // The rule grid over the page, which is what makes it a specimen sheet
    // rather than a collage.
    if (p.rules > 0.001) {
      surface.strokeStyle = pal.inks[pal.inks.length - 1].hex;
      surface.globalAlpha = p.rules;
      surface.lineWidth = 0.5;
      for (let i = 1; i < cols; i++) {
        surface.beginPath(); surface.moveTo(R3(i * cw), 0); surface.lineTo(R3(i * cw), H); surface.stroke();
      }
      for (let j = 1; j < rows; j++) {
        surface.beginPath(); surface.moveTo(0, R3(j * ch)); surface.lineTo(W, R3(j * ch)); surface.stroke();
      }
      surface.globalAlpha = 1;
    }
  }

  const controls = [
    { group: 'grid', key: 'columns', primary: true, label: 'Columns', type: 'range', min: 2, max: 16, step: 1 },
    { group: 'grid', key: 'fill', primary: true, label: 'Fill', type: 'range', min: 0.1, max: 1, step: 0.01 },
    { group: 'grid', key: 'spanning', label: 'Spanning', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'grid', key: 'gutter', label: 'Gutter', type: 'range', min: 0, max: 0.3, step: 0.005 },
    { group: 'grid', key: 'rules', label: 'Page rules', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'blocks', key: 'identity', label: 'The mark and the name', type: 'range', min: 0, max: 1, step: 0.01,
      needs: { of: 'motif', key: 'silhouette', least: 1,
        without: 'No shape could be read out of this drawing, so no block can be the mark.' } },
    { group: 'blocks', key: 'inkShare', label: 'Ink share', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'blocks', key: 'weight', primary: true, label: 'Line weight', type: 'range', min: 0.4, max: 10, step: 0.2 },
    { group: 'blocks', key: 'seed', label: 'Seed', type: 'seed' },
  ];

  return { key: 'specimen', kind: 'poster', vector: true, motif: true, word: true,
    tiles: false, ratio: 1, kinds: KINDS, controls, paint, block };
}));
