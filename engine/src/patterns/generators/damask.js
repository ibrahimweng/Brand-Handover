/* The mark, set in an ogee trellis.

   Damask is the pattern on the walls of every hotel that wants to look older
   than it is, and almost every version of it in software gets two things wrong.

   The first is the armature. A damask is built on an *ogee* — a pointed arch
   whose sides are S-curves, concave at the top and convex at the bottom — laid
   on a half-drop so the arches interlock. Not a diamond, not an oval: the S is
   the whole character of it, and a lozenge trellis reads as harlequin instead.

   The second is the colour. Damask is a weave, not a print. The figure and the
   ground are the same thread; what separates them is which way the weave runs,
   so the figure catches the light differently and the pattern is *self-
   coloured*. That is why a real damask reads as quiet at a distance and only
   resolves close up. Printing it in two inks makes a chintz. So this defaults
   to tone on tone — the figure is the ground shifted, and the `contrast`
   control is what takes it away from that, deliberately, rather than a colour
   choice it fell into.

   And the figure is mirrored. Bilateral symmetry about the arch's own axis is
   what makes a damask motif read as formal rather than as a scatter, and it is
   the one place this engine mirrors a client's drawing on purpose: the mirrored
   half is a reflection, so an asymmetric mark comes out as a facing pair, which
   is what a damask motif has always been.

   Three ways to use the armature. `trellis` draws it as a line with the figure
   inside. `brocade` fills alternate arches and counterchanges the figure out of
   them. `sprigged` drops the armature and keeps the half-drop and the mirror,
   which is the plainest damask there is and the one that survives being printed
   small. */
//
// UMD: `paint` runs in the studio, which has no require.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../motif'), require('../tone'));
  } else root.PatternDamask = factory(root.PatternMotif, root.PatternTone);
}(typeof self !== 'undefined' ? self : this, function (MOTIF, TONE) {
  'use strict';

  const R3 = (v) => Math.round(v * 1000) / 1000;
  const WAYS = ['trellis', 'brocade', 'sprigged'];

  /* One ogee, centred on the origin, w across and h tall.

     Four cubics. Up each side the curve leaves the bottom point bulging
     outward, reaches its widest at the half height, then turns back and runs
     into the top point — so the tangent reverses once per side, which is what
     makes it an ogee rather than an oval. The two halves are the same numbers
     mirrored, so the shape is symmetric about its axis by construction rather
     than by hoping. */
  function ogee(s, cx, cy, w, h, belly) {
    const a = w * 0.5 * belly;
    const b = h * 0.5;
    const X = (v) => R3(cx + v);
    const Y = (v) => R3(cy + v);
    // One closed subpath: up the left side, down the right, shut. Drawn as two
    // open halves it fills as two half-lenses instead of an arch, which is what
    // the first version did.
    s.moveTo(X(0), Y(b));
    s.bezierCurveTo(X(-a * 1.12), Y(b * 0.84), X(-a), Y(b * 0.34), X(-a), Y(0));
    s.bezierCurveTo(X(-a), Y(-b * 0.34), X(-a * 0.26), Y(-b * 0.56), X(0), Y(-b));
    s.bezierCurveTo(X(a * 0.26), Y(-b * 0.56), X(a), Y(-b * 0.34), X(a), Y(0));
    s.bezierCurveTo(X(a), Y(b * 0.34), X(a * 1.12), Y(b * 0.84), X(0), Y(b));
    s.closePath();
  }

  // The half-drop lattice. Whole numbers of arches across and down, and an even
  // row count — a half-drop over an odd number of rows meets itself at the join
  // and two undropped rows sit against each other.
  function lattice(W, H, p) {
    const cols = Math.max(1, Math.round(p.cells));
    // An ogee is taller than it is wide — about seven to five in every pattern
    // book there is — and the row count follows from that rather than from a
    // square cell. Floored at four: a half-drop needs two full drops in the
    // tile before the drop is visible as a drop rather than as two rows.
    let rows = Math.max(4, Math.round(cols * (H / W) / 1.4));
    if (rows % 2) rows += 1;
    return { cols, rows, stepX: W / cols, stepY: H / rows };
  }

  /* The figure: the drawing and its own reflection, facing.

     Drawn as one path so the pair fills as one shape — two separately filled
     halves that touch on the axis seam along it, and a hairline down the middle
     of every motif is the thing that gives a mirrored pattern away. */
  function facing(s, m, cx, cy, r, gap) {
    for (const side of [-1, 1]) {
      s.save();
      s.translate(R3(cx), R3(cy));
      s.scale(side, 1);
      s.translate(R3(r * gap), 0);
      MOTIF.path(s, m, 0, 0, r);
      s.restore();
    }
  }

  function paint(surface, W, H, p, pal) {
    const way = WAYS.indexOf(p.way) > -1 ? p.way : WAYS[0];
    const m = p.motif;
    const L = lattice(W, H, p);
    const ground = pal.ground;
    /* Tone on tone. The figure is the ground carried toward the ink by
       `contrast`, so at rest the two differ by a sheen rather than a colour and
       the pattern reads the way a woven one does. */
    const ink = pal.ink(Math.max(0, Math.min(pal.inks.length - 1, Math.round(p.ink))));
    const figure = TONE.mix(ground, ink, Math.max(0.04, p.contrast));
    const line = TONE.mix(ground, ink, Math.max(0.06, p.contrast * 0.8));
    pal.paper(surface, W, H, ground);

    const usable = !!(m && m.ops && m.ops.length);
    const r = Math.min(L.stepX, L.stepY) * 0.5 * p.scale;
    const weight = Math.max(0.004, p.weight) * Math.min(L.stepX, L.stepY);

    // Arches first, then figures, so a figure is never cut by the armature it
    // sits inside.
    if (way !== 'sprigged') {
      surface.fillStyle = way === 'brocade' ? figure : 'none';
      surface.strokeStyle = line;
      surface.lineWidth = weight;
      surface.lineJoin = 'round';
      surface.beginPath();
      for (let j = -1; j <= L.rows; j++) {
        for (let i = -1; i <= L.cols; i++) {
          // In brocade only half the arches are filled, which is what makes the
          // trellis read as cloth rather than as wire.
          if (way === 'brocade' && (((i + j) % 2) + 2) % 2) continue;
          const drop = (((j % 2) + 2) % 2) ? L.stepX * 0.5 : 0;
          ogee(surface, (i + 0.5) * L.stepX + drop, (j + 0.5) * L.stepY,
            L.stepX * 1.02, L.stepY * 1.04, p.belly);
        }
      }
      if (way === 'brocade') surface.fill('nonzero');
      else surface.stroke();
    }

    if (!usable || r < 1) return;
    for (let j = -1; j <= L.rows; j++) {
      for (let i = -1; i <= L.cols; i++) {
        const brocaded = way === 'brocade' && !((((i + j) % 2) + 2) % 2);
        const drop = (((j % 2) + 2) % 2) ? L.stepX * 0.5 : 0;
        const cx = (i + 0.5) * L.stepX + drop;
        const cy = (j + 0.5) * L.stepY;
        // Counterchanged out of a filled arch, figure on the ground otherwise.
        surface.fillStyle = surface.strokeStyle = brocaded ? ground : figure;
        surface.beginPath();
        facing(surface, m, cx, cy, r, p.gap);
        if (m.stroked) {
          surface.lineWidth = Math.max(r * 2 * 0.06, (m.weight || 0.06) * r * 2);
          surface.lineCap = 'round';
          surface.lineJoin = 'round';
          surface.stroke();
        } else surface.fill('nonzero');
      }
    }
  }

  const controls = [
    { group: 'pattern', key: 'way', primary: true, label: 'Way', type: 'chips', options: WAYS },
    { group: 'lattice', key: 'cells', primary: true, label: 'Arches across', type: 'range', min: 1, max: 12, step: 1 },
    { group: 'lattice', key: 'belly', label: 'Arch width', type: 'range', min: 0.4, max: 1.3, step: 0.02 },
    { group: 'lattice', key: 'weight', label: 'Armature', type: 'range', min: 0.004, max: 0.06, step: 0.002 },
    { group: 'mark', key: 'scale', primary: true, label: 'Figure size', type: 'range', min: 0.15, max: 0.9, step: 0.02,
      needs: { of: 'motif', key: 'moves', least: 1,
        without: 'No shape could be read out of this drawing, so there is no figure to face. '
          + 'The trellis is still here.' } },
    { group: 'mark', key: 'gap', label: 'Facing gap', type: 'range', min: -0.5, max: 0.6, step: 0.02 },
    { group: 'ground', key: 'contrast', label: 'Contrast', type: 'range', min: 0.04, max: 1, step: 0.01 },
    { group: 'ground', key: 'ink', label: 'Ink', type: 'range', min: 0, max: 5, step: 1 },
    { group: 'pattern', key: 'seed', label: 'Seed', type: 'seed' },
  ];

  return { key: 'damask', kind: 'pattern', vector: true, motif: true, ratio: 1,
    controls, paint, ogee, lattice, facing, WAYS };
}));
