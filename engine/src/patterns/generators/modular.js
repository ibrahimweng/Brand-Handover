/* A modular grid poster, with the mark as one of the things a module can be.

   PLAYGRND's Modular walks a grid of modules, greedily merging some into
   larger blocks, and fills each with one of six treatments: empty, solid, a
   gradient, a field of blocks, a dot matrix, a line grid. It is a composition
   rather than a repeat — a poster — and it is the most obviously *designed* of
   the tools, which is why a brand can use it and why it needed one change.

   The change is a seventh treatment: the mark. A module can be the client's own
   silhouette, knocked out of an ink panel. Without it this is a handsome grid
   in somebody's colours and nothing more; with it the composition is built out
   of the identity, which is what every tool here has to be.

   Everything else is measured. How many modules across comes off how fine the
   mark is — the same scale rule the patterns use, in this composition's terms.
   How finely a module subdivides comes off how much drawing the mark takes.
   How much the grid merges comes off how square the mark is, because a mark
   that is close to square reads well in a square module and a long one wants
   the grid to make long modules for it to sit in. */
//
// UMD: `paint` runs in the studio, which has no require.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../rand'), require('../motif'));
  } else root.PatternModular = factory(root.PatternRand, root.PatternMotif);
}(typeof self !== 'undefined' ? self : this, function (RAND, MOTIF) {
  'use strict';

  const R3 = (v) => Math.round(v * 1000) / 1000;
  const TREATMENTS = ['empty', 'solid', 'blocks', 'dots', 'lines', 'mark'];

  // Which treatment a module gets, by roulette over the weights.
  function pick(weights, r) {
    let total = 0;
    for (const k of TREATMENTS) total += Math.max(0, weights[k] || 0);
    if (total <= 0) return 'solid';
    let at = r * total;
    for (const k of TREATMENTS) {
      at -= Math.max(0, weights[k] || 0);
      if (at <= 0) return k;
    }
    return 'solid';
  }

  // The module grid, with merges taken greedily in reading order.
  function plan(p) {
    const cols = Math.max(2, Math.round(p.modules));
    const rows = cols;
    const taken = new Uint8Array(cols * rows);
    const out = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (taken[y * cols + x]) continue;
        const r = RAND.hash01(x, y, (p.seed || 1) * 3 + 1);
        let w = 1, h = 1;
        const fits = (ww, hh) => {
          if (x + ww > cols || y + hh > rows) return false;
          for (let j = 0; j < hh; j++) for (let i = 0; i < ww; i++) if (taken[(y + j) * cols + x + i]) return false;
          return true;
        };
        if (r < p.merging * 0.32 && fits(2, 2)) { w = 2; h = 2; }
        else if (r < p.merging * 0.66 && fits(2, 1)) { w = 2; }
        else if (r < p.merging && fits(1, 2)) { h = 2; }
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) taken[(y + j) * cols + x + i] = 1;
        out.push({ x, y, w, h });
      }
    }
    return { cols, rows, modules: out };
  }

  function paint(surface, W, H, p, pal) {
    const ground = pal.ground;
    const inks = pal.inks;
    pal.paper(surface, W, H, ground);
    const { cols, rows, modules } = plan(p);
    const cw = W / cols, ch = H / rows;
    const unit = Math.max(2, Math.round(p.unit));

    for (const m of modules) {
      const x = m.x * cw, y = m.y * ch, w = m.w * cw, h = m.h * ch;
      const r1 = RAND.hash01(m.x * 7 + 1, m.y * 11 + 3, (p.seed || 1) * 5 + 2);
      const r2 = RAND.hash01(m.x * 13 + 5, m.y * 17 + 7, (p.seed || 1) * 5 + 3);
      const treatment = pick(p, r1);
      const ink = inks[Math.floor(r2 * inks.length) % inks.length].hex;
      const other = inks[(Math.floor(r2 * inks.length) + 1) % inks.length].hex;
      // Some modules sit straight on the page and some on a panel of their own.
      // Without this every treatment reads against the same ground and the
      // composition flattens into a chart.
      const onPanel = RAND.hash01(m.x + 31, m.y + 37, (p.seed || 1) * 5 + 4) > 0.45;
      if (treatment !== 'empty' && onPanel) {
        surface.fillStyle = other;
        surface.fillRect(R3(x), R3(y), R3(w), R3(h));
      }
      const sw = w / (m.w * unit), sh = h / (m.h * unit);
      surface.fillStyle = ink;
      surface.strokeStyle = ink;
      if (treatment === 'solid') {
        surface.fillRect(R3(x), R3(y), R3(w), R3(h));
      } else if (treatment === 'blocks') {
        for (let j = 0; j < m.h * unit; j++) {
          let run = -1;
          for (let i = 0; i <= m.w * unit; i++) {
            const on = i < m.w * unit
              && RAND.hash01(m.x * unit + i, m.y * unit + j, (p.seed || 1) * 9 + 1) < p.fill;
            if (on && run < 0) run = i;
            else if (!on && run >= 0) {
              surface.fillRect(R3(x + run * sw), R3(y + j * sh), R3((i - run) * sw), R3(sh));
              run = -1;
            }
          }
        }
      } else if (treatment === 'dots') {
        const rr = (Math.min(sw, sh) / 2) * p.dot;
        for (let j = 0; j < m.h * unit; j++) {
          for (let i = 0; i < m.w * unit; i++) {
            if (RAND.hash01(m.x * unit + i + 3, m.y * unit + j + 5, (p.seed || 1) * 9 + 2) > p.fill) continue;
            surface.beginPath();
            surface.arc(R3(x + (i + 0.5) * sw), R3(y + (j + 0.5) * sh), R3(rr), 0, Math.PI * 2);
            surface.fill();
          }
        }
      } else if (treatment === 'lines') {
        surface.lineWidth = Math.max(0.5, p.weight);
        for (let i = 1; i < m.w * unit; i++) {
          surface.beginPath();
          surface.moveTo(R3(x + i * sw), R3(y));
          surface.lineTo(R3(x + i * sw), R3(y + h));
          surface.stroke();
        }
        for (let j = 1; j < m.h * unit; j++) {
          surface.beginPath();
          surface.moveTo(R3(x), R3(y + j * sh));
          surface.lineTo(R3(x + w), R3(y + j * sh));
          surface.stroke();
        }
      } else if (treatment === 'mark') {
        // The client's own silhouette, knocked out of a panel rather than drawn
        // on one: a logo sitting on a coloured square is a sticker, and a logo
        // the panel is missing is a composition.
        const shape = p.motif && p.motif.fillOps && p.motif.fillOps.length
          ? { ops: p.motif.fillOps } : p.motif;
        if (shape && shape.ops && shape.ops.length) {
          surface.fillStyle = ink;
          surface.fillRect(R3(x), R3(y), R3(w), R3(h));
          surface.save();
          surface.beginPath();
          surface.rect(R3(x), R3(y), R3(w), R3(h));
          surface.clip();
          surface.fillStyle = onPanel ? other : ground;
          MOTIF.draw(surface, { ops: shape.ops, stroked: false },
            R3(x + w / 2), R3(y + h / 2), R3(Math.min(w, h) * 0.36));
          surface.restore();
        } else {
          surface.fillRect(R3(x), R3(y), R3(w), R3(h));
        }
      }
    }

    // The hairline grid over the whole page, which is what makes it read as a
    // system rather than as a collage.
    if (p.rules > 0.001) {
      surface.strokeStyle = inks[inks.length - 1].hex;
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
    { group: 'poster', key: 'modules', label: 'Modules across', type: 'range', min: 2, max: 12, step: 1 },
    { group: 'poster', key: 'unit', label: 'Units per module', type: 'range', min: 2, max: 12, step: 1 },
    { group: 'poster', key: 'merging', label: 'Merging', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'treatment', key: 'empty', label: 'Empty', type: 'range', min: 0, max: 100, step: 1 },
    { group: 'treatment', key: 'solid', label: 'Solid', type: 'range', min: 0, max: 100, step: 1 },
    { group: 'treatment', key: 'blocks', label: 'Blocks', type: 'range', min: 0, max: 100, step: 1 },
    { group: 'treatment', key: 'dots', label: 'Dot matrix', type: 'range', min: 0, max: 100, step: 1 },
    { group: 'treatment', key: 'lines', label: 'Line grid', type: 'range', min: 0, max: 100, step: 1 },
    { group: 'treatment', key: 'mark', label: 'The mark', type: 'range', min: 0, max: 100, step: 1,
      needs: { of: 'motif', key: 'silhouette', least: 1,
        without: 'No shape could be read out of this drawing, so a module has nothing to knock out.' } },
    { group: 'detail', key: 'fill', label: 'Block fill', type: 'range', min: 0.1, max: 0.9, step: 0.01 },
    { group: 'detail', key: 'dot', label: 'Dot size', type: 'range', min: 0.2, max: 1, step: 0.01 },
    { group: 'detail', key: 'rules', label: 'Grid lines', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'detail', key: 'weight', label: 'Line weight', type: 'range', min: 0.5, max: 4, step: 0.5 },
    { group: 'detail', key: 'seed', label: 'Seed', type: 'seed' },
  ];

  return { key: 'modular', kind: 'poster', vector: true, motif: true, tiles: false, ratio: 1,
    treatments: TREATMENTS, controls, paint, plan, pick };
}));
