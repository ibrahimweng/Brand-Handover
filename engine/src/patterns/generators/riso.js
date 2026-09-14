/* A torn-paper duotone print, and the thing torn out is the mark.

   PLAYGRND's Riso splits the page into bands, fills each with torn-edged
   rectangles, ribbons or scratchy dashes in two inks chosen far enough apart in
   luminance to read, drops one big torn circle over the lot, and finishes with
   a few hand-drawn scribbles. The torn edge is the whole character of it: every
   polygon's sides are walked in segments and pushed off true by a hashed
   wobble, so nothing has a printed edge.

   Its big shape is a circle. Here it is the client's mark, torn the same way
   everything else is — the silhouette walked and pushed off true, so the logo
   arrives looking cut out of paper rather than placed on top of it. That is
   the one change, and it is the difference between a riso print in somebody's
   colours and a riso print of their identity.

   The bands stay, because they are what makes it a print: overlapping passes
   of flat ink, each slightly out of register with the last. */
//
// UMD: `paint` runs in the studio, which has no require.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../rand'), require('../motif'));
  } else root.PatternRiso = factory(root.PatternRand, root.PatternMotif);
}(typeof self !== 'undefined' ? self : this, function (RAND, MOTIF) {
  'use strict';

  const R3 = (v) => Math.round(v * 1000) / 1000;
  const KINDS = ['blocks', 'streaks', 'static'];

  // A rectangle with torn edges: every side walked in segments, each vertex
  // pushed off true by a hashed amount. Five segments a side is where an edge
  // stops reading as a straight line and starts reading as a tear.
  function tornRect(s, x, y, w, h, rough, key) {
    const SEG = 5;
    const off = (i) => (RAND.hash01(i, key, key * 7 + 3) - 0.5) * rough * Math.min(w, h) * 0.22;
    s.beginPath();
    let n = 0;
    const edge = (x0, y0, x1, y1) => {
      for (let i = 0; i < SEG; i++) {
        const t = i / SEG;
        const px = x0 + (x1 - x0) * t, py = y0 + (y1 - y0) * t;
        const dx = y1 - y0, dy = x0 - x1;
        const len = Math.hypot(dx, dy) || 1;
        const o = off(n++);
        const ax = px + (dx / len) * o, ay = py + (dy / len) * o;
        if (n === 1) s.moveTo(R3(ax), R3(ay)); else s.lineTo(R3(ax), R3(ay));
      }
    };
    edge(x, y, x + w, y); edge(x + w, y, x + w, y + h);
    edge(x + w, y + h, x, y + h); edge(x, y + h, x, y);
    s.closePath();
    s.fill();
  }

  // The mark, torn: the silhouette's own points pushed off true.
  function tornMark(s, motif, cx, cy, r, rough, key) {
    const src = motif && motif.fillOps && motif.fillOps.length ? motif.fillOps
      : (motif && motif.ops) || null;
    if (!src || !src.length) return false;
    const size = r * 2;
    let n = 0;
    const jog = () => (RAND.hash01(n++, key, key * 11 + 5) - 0.5) * rough * size * 0.045;
    const X = (v) => cx + v * size + jog();
    const Y = (v) => cy + v * size + jog();
    s.beginPath();
    for (const o of src) {
      if (o[0] === 'M') s.moveTo(R3(X(o[1])), R3(Y(o[2])));
      else if (o[0] === 'L') s.lineTo(R3(X(o[1])), R3(Y(o[2])));
      else if (o[0] === 'C') s.bezierCurveTo(R3(X(o[1])), R3(Y(o[2])), R3(X(o[3])), R3(Y(o[4])), R3(X(o[5])), R3(Y(o[6])));
      else if (o[0] === 'Z') s.closePath();
    }
    s.fill('nonzero');
    return true;
  }

  // Two inks that actually read against each other. Walking the palette until
  // the luminances differ is what stops a band coming out as one flat colour
  // with an invisible pattern printed on it.
  function pair(inks, ground, k) {
    const lum = (hex) => {
      const n = parseInt(String(hex).slice(1), 16);
      const f = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
      return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
    };
    const all = [ground].concat(inks.map((i) => i.hex));
    const back = all[Math.floor(RAND.hash01(k, 1, k * 3) * all.length) % all.length];
    for (let i = 0; i < all.length; i++) {
      const front = all[(Math.floor(RAND.hash01(k, 2, k * 5) * all.length) + i) % all.length];
      if (Math.abs(lum(front) - lum(back)) > 0.09) return [back, front];
    }
    return [back, all[0] === back ? all[all.length - 1] : all[0]];
  }

  function paint(surface, W, H, p, pal) {
    pal.paper(surface, W, H, pal.ground);
    const bands = Math.max(1, Math.round(p.bands));
    // Uneven heights, never slivers.
    const weights = [];
    let total = 0;
    for (let i = 0; i < bands; i++) {
      const w = 0.6 + RAND.hash01(i, 1, (p.seed || 1) * 3) * 1.2;
      weights.push(w); total += w;
    }
    let y = 0;
    for (let b = 0; b < bands; b++) {
      const h = (weights[b] / total) * H;
      const k = (p.seed || 1) * 13 + b;
      const [back, front] = pair(pal.inks, pal.ground, k);
      const kind = KINDS[Math.floor(RAND.hash01(b, 3, k) * KINDS.length) % KINDS.length];
      surface.save();
      surface.beginPath();
      surface.rect(0, R3(y), W, R3(h));
      surface.clip();
      surface.fillStyle = back;
      surface.fillRect(0, R3(y), W, R3(h));
      surface.fillStyle = front;
      if (kind === 'blocks') {
        const cols = 5 + Math.floor(RAND.hash01(b, 4, k) * 3);
        const cw = W / cols;
        for (let i = 0; i < cols; i++) {
          if (RAND.hash01(i, b + 5, k) < 0.18) continue;
          const pad = cw * 0.1;
          tornRect(surface, i * cw + pad, y + h * 0.12, cw - pad * 2, h * 0.76, p.rough, k + i * 17);
        }
      } else if (kind === 'streaks') {
        const n = 7 + Math.floor(RAND.hash01(b, 6, k) * 3);
        const cw = W / n;
        for (let i = 0; i < n; i++) {
          if (RAND.hash01(i, b + 7, k) < 0.16) continue;
          const w = cw * (0.35 + RAND.hash01(i, b + 8, k) * 0.45);
          tornRect(surface, i * cw + (cw - w) / 2, y, w, h, p.rough, k + i * 23);
        }
      } else {
        const rows = Math.max(2, Math.round(h / (Math.min(W, H) * 0.035)));
        for (let j = 0; j < rows; j++) {
          const dashes = 2 + Math.floor(RAND.hash01(j, b + 9, k) * 6);
          for (let d = 0; d < dashes; d++) {
            const x = RAND.hash01(d, j + b * 31, k) * W * 0.9;
            const w = W * (0.03 + RAND.hash01(d, j + 41, k) * 0.09);
            tornRect(surface, x, y + (j + 0.2) * (h / rows), w, (h / rows) * 0.55, p.rough, k + j * 7 + d);
          }
        }
      }
      surface.restore();
      y += h;
    }

    // The mark, torn out and laid over the passes.
    if (p.mark > 0.001) {
      const [, front] = pair(pal.inks, pal.ground, (p.seed || 1) * 97);
      surface.fillStyle = front;
      tornMark(surface, p.motif, W / 2, H / 2, Math.min(W, H) * 0.5 * p.mark, p.rough, (p.seed || 1) * 31);
    }

    // A few hand-drawn lines: a random walk that reflects off the edges, then
    // smoothed, which is what makes it read as a pen rather than as a path.
    const scribbles = Math.round(p.scribbles * 3);
    if (scribbles > 0) {
      surface.strokeStyle = pal.inks[pal.inks.length - 1].hex;
      surface.lineWidth = Math.max(1, Math.min(W, H) * 0.004);
      surface.lineCap = 'round';
      for (let s2 = 0; s2 < scribbles; s2++) {
        const pts = [];
        let x = RAND.hash01(s2, 1, (p.seed || 1) * 41) * W;
        let y2 = RAND.hash01(s2, 2, (p.seed || 1) * 41) * H;
        let a = RAND.hash01(s2, 3, (p.seed || 1) * 41) * Math.PI * 2;
        const step = Math.min(W, H) * 0.022;
        for (let i = 0; i < 70; i++) {
          a += (RAND.hash01(s2 * 71 + i, 4, (p.seed || 1) * 43) - 0.5) * 1.4;
          x += Math.cos(a) * step; y2 += Math.sin(a) * step;
          if (x < 0 || x > W) { a = Math.PI - a; x = Math.min(W, Math.max(0, x)); }
          if (y2 < 0 || y2 > H) { a = -a; y2 = Math.min(H, Math.max(0, y2)); }
          pts.push([x, y2]);
        }
        surface.beginPath();
        surface.moveTo(R3(pts[0][0]), R3(pts[0][1]));
        for (let i = 1; i < pts.length - 1; i++) {
          const mx = (pts[i - 1][0] + pts[i][0] * 2 + pts[i + 1][0]) / 4;
          const my = (pts[i - 1][1] + pts[i][1] * 2 + pts[i + 1][1]) / 4;
          surface.lineTo(R3(mx), R3(my));
        }
        surface.stroke();
      }
    }
  }

  const controls = [
    { group: 'poster', key: 'bands', label: 'Bands', type: 'range', min: 1, max: 8, step: 1 },
    { group: 'poster', key: 'rough', label: 'Tear', type: 'range', min: 0, max: 2, step: 0.02 },
    { group: 'poster', key: 'mark', label: 'The mark', type: 'range', min: 0, max: 1, step: 0.01,
      needs: { of: 'motif', key: 'silhouette', least: 1,
        without: 'No shape could be read out of this drawing, so there is nothing to tear out.' } },
    { group: 'poster', key: 'scribbles', label: 'Scribbles', type: 'range', min: 0, max: 2, step: 0.05 },
    { group: 'poster', key: 'seed', label: 'Seed', type: 'seed' },
  ];

  return { key: 'riso', kind: 'poster', vector: true, motif: true, tiles: false, ratio: 1,
    kinds: KINDS, controls, paint, tornRect, tornMark, pair };
}));
