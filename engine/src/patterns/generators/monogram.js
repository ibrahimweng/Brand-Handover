/* The mark, made into a monogram.

   This is the oldest identity pattern there is and the most recognised: Georges
   Vuitton drew one in 1896 to stop counterfeiting, Gucci's interlocking initials
   followed in the thirties, and everything since is a variation on the same
   construction. It is worth stating what that construction actually is, because
   it is not "a logo repeated".

   A monogram has **more than one motif**. Louis Vuitton's has four — the
   interlocked letters, a four-petal flower, the same flower inside a circle,
   and the same flower inside a diamond — and they alternate on a lattice so
   that no two neighbours are the same. That is what stops it reading as
   wallpaper and starts it reading as a house's own cloth. One motif repeated is
   a lattice, which this engine already has.

   So the derived forms are the whole tool. An identity here ships one drawing;
   this makes a family out of it — the mark alone, the mark in a ring, the mark
   in a diamond, and a rosette of four of it turned about a centre — and deals
   them so that a cell never touches its own kind. Every one of them is the
   client's own artwork; none of them is a shape somebody typed.

   Four layouts, and they are the four this pattern has ever had. `diagonal`
   puts the lattice on the diagonal, which is the monogram proper. `ogee` drops
   alternate rows by half and stretches them into the pointed-arch armature that
   damask and trellis papers are built on. `damier` is the checkerboard — the
   other half of the Vuitton canvas, and the one that needs no motif at all to
   work. `grid` is the plain square, for an identity whose mark is busy enough
   that anything else fights it. */
//
// UMD: `paint` runs in the studio, which has no require.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../rand'), require('../motif'), require('../tone'));
  } else root.PatternMonogram = factory(root.PatternRand, root.PatternMotif, root.PatternTone);
}(typeof self !== 'undefined' ? self : this, function (RAND, MOTIF, TONE) {
  'use strict';

  const R3 = (v) => Math.round(v * 1000) / 1000;
  const TAU = Math.PI * 2;
  const mod = (n, p) => ((n % p) + p) % p;
  const LAYOUTS = ['diagonal', 'ogee', 'damier', 'grid'];
  // The derived forms, in the order they are dealt. `mark` first because it is
  // the one a client recognises; the rest are made out of it.
  const FORMS = ['mark', 'ringed', 'framed', 'rosette'];

  /* One cell's motif, drawn at the origin.

     Everything here is the mark and a frame around it, or the mark turned about
     a centre. The frames are drawn at the drawing's own stroke weight where it
     has one, so a hairline logo gets a hairline ring and a slab logo gets a slab
     one — the frame belongs to the drawing rather than being laid over it. */
  function form(s, kind, m, r, weight, ink, ground) {
    const line = Math.max(r * 0.035, r * weight * 1.1);
    if (kind === 'rosette') {
      // Four of the mark, turned about the centre. The oldest ornament there
      // is, and the one that makes a single asymmetric drawing read as a
      // symmetric motif without mirroring it — which matters, because a
      // mirrored wordmark reads backwards.
      for (let i = 0; i < 4; i++) {
        s.save();
        s.rotate((i / 4) * TAU);
        MOTIF.draw(s, m, 0, -r * 0.42, r * 0.46);
        s.restore();
      }
      return;
    }
    if (kind === 'ringed' || kind === 'framed') {
      s.fillStyle = s.strokeStyle = ink;
      s.beginPath();
      if (kind === 'ringed') {
        s.arc(0, 0, r, 0, TAU);
        s.arc(0, 0, r - line, 0, TAU, true);
      } else {
        s.moveTo(0, -r); s.lineTo(r, 0); s.lineTo(0, r); s.lineTo(-r, 0); s.closePath();
        const q = r - line * 1.4;
        s.moveTo(0, -q); s.lineTo(-q, 0); s.lineTo(0, q); s.lineTo(q, 0); s.closePath();
      }
      s.fill('evenodd');
      MOTIF.draw(s, m, 0, 0, r * 0.52);
      return;
    }
    MOTIF.draw(s, m, 0, 0, r);
  }

  /* Which derived form a cell is dealt.

     Two things have to be true at once and the first draft only managed one.

     The form is a function of the cell's *position* rather than of a hash,
     which is what a monogram is: a hash puts two of a kind side by side about a
     quarter of the time and the cloth stops reading as pieced.

     And the dealing has to come round with the lattice. The first draft indexed
     the raw `i` and `j`, so the form at column `cols` was not the form at
     column 0 unless the count happened to divide — and it mostly did not.
     Rendered 2x2 that is a vertical break down the middle of the cloth with a
     different arrangement either side of it, which is what carrock, oriel and
     kvist did. Taking the position modulo the lattice first makes it periodic
     by construction, for any count of cells and any count of forms.

     What that costs is one pair: where the form count does not divide the cell
     count, the cell at the last column and the cell at the first may be dealt
     the same kind, so at the join two of a kind can meet. Inside the tile the
     scheme still holds everywhere. One coincidence at a seam is a much smaller
     fault than a seam. */
  function dealt(i, j, L, layout, forms) {
    const d = layout === 'diagonal' ? 2 : 1;
    return mod(Math.floor(mod(i, L.cols) / d) + mod(j, L.rows) * 2, forms);
  }

  /* The lattice.

     Whole numbers of cells across and down, because a monogram that does not
     divide the cloth is a monogram with a seam down it. The ogee forces an even
     row count for the same reason a half-drop always does: over an odd number
     of rows the drop meets itself and two undropped rows sit against each
     other at the join. */
  function lattice(W, H, p) {
    let cols = Math.max(1, Math.round(p.cells));
    let rows = Math.max(1, Math.round(cols * (H / W)));
    if (p.layout !== 'grid' && rows % 2) rows += 1;
    if (p.layout === 'diagonal' && cols % 2) cols += 1;
    return { cols, rows, stepX: W / cols, stepY: H / rows };
  }

  function paint(surface, W, H, p, pal) {
    const m = p.motif;
    const ground = pal.ground;
    const inks = [pal.ink(0), pal.ink(1), pal.ink(2)];
    pal.paper(surface, W, H, ground);
    const L = lattice(W, H, p);
    const layout = LAYOUTS.indexOf(p.layout) > -1 ? p.layout : LAYOUTS[0];
    const seed = (p.seed || 1) * 59;
    const weight = (m && m.weight) || 0.06;
    const usable = !!(m && m.ops && m.ops.length);
    // Which derived forms are in play. Below the count the deal falls back to
    // the mark alone, which is a lattice — and says so rather than drawing an
    // empty cell.
    const forms = FORMS.slice(0, Math.max(1, Math.round(p.forms)));

    // The chequer under everything, for damier and for any layout that wants a
    // ground that alternates.
    if (p.chequer > 0) {
      surface.fillStyle = TONE.mix(ground, inks[0], p.chequer);
      surface.beginPath();
      for (let j = 0; j < L.rows; j++) {
        for (let i = 0; i < L.cols; i++) {
          if ((i + j) % 2) continue;
          surface.rect(R3(i * L.stepX), R3(j * L.stepY), R3(L.stepX) + 0.35, R3(L.stepY) + 0.35);
        }
      }
      surface.fill();
    }
    if (!usable || layout === 'damier') return;

    const r = Math.min(L.stepX, L.stepY) * 0.5 * p.scale;
    for (let j = -1; j <= L.rows; j++) {
      for (let i = -1; i <= L.cols; i++) {
        // The diagonal skips every other cell, which is what puts the lattice
        // on the diagonal rather than rotating the drawing.
        if (layout === 'diagonal' && mod(i + j, 2)) continue;
        const k = dealt(i, j, L, layout, forms.length);
        const kind = forms[k];
        const drop = layout === 'ogee' && mod(j, 2) ? L.stepX * 0.5 : 0;
        const cx = (i + 0.5) * L.stepX + drop;
        const cy = (j + 0.5) * L.stepY;
        surface.save();
        surface.translate(R3(cx), R3(cy));
        if (p.turn) surface.rotate((p.turn * Math.PI) / 180);
        // The ink steps with the form, so the four derived shapes are four
        // colours as well as four drawings where the identity has the inks for
        // it.
        const ink = inks[mod(k, Math.max(1, Math.min(inks.length, Math.round(p.colours))))];
        surface.fillStyle = surface.strokeStyle = ink;
        form(surface, kind, m, r * (kind === 'mark' ? 0.86 : 1), weight, ink, ground);
        surface.restore();
      }
    }
  }

  const controls = [
    { group: 'pattern', key: 'layout', primary: true, label: 'Layout', type: 'chips', options: LAYOUTS },
    { group: 'pattern', key: 'cells', primary: true, label: 'Cells across', type: 'range', min: 2, max: 24, step: 1 },
    { group: 'pattern', key: 'scale', primary: true, label: 'Motif size', type: 'range', min: 0.3, max: 1.4, step: 0.02 },
    { group: 'pattern', key: 'turn', label: 'Rotation', type: 'range', min: 0, max: 180, step: 1 },
    { group: 'pattern', key: 'chequer', label: 'Chequer', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'mark', key: 'forms', label: 'Derived forms', type: 'range', min: 1, max: 4, step: 1,
      needs: { of: 'motif', key: 'moves', least: 1,
        without: 'No shape could be read out of this drawing, so there is nothing to '
          + 'derive a monogram from. The chequer is still here.' } },
    { group: 'mark', key: 'colours', label: 'Inks', type: 'range', min: 1, max: 3, step: 1 },
    { group: 'mark', key: 'seed', label: 'Seed', type: 'seed' },
  ];

  return { key: 'monogram', kind: 'pattern', vector: true, motif: true, needsMotif: true, ratio: 1,
    controls, paint, lattice, form, dealt, LAYOUTS, FORMS };
}));
