/* Putting the mark on something.

   A mockup is the mark on a business card, a sign, a van door, a tote. The way
   it is done properly is not a picture of a card with a logo pasted flat on it,
   it is the artwork mapped into the surface the photograph actually shows, so
   it takes the photograph's perspective, its shadows and its creases.

   That mapping is a homography: the one projective transform that takes a
   rectangle to four arbitrary points. There is a closed form for it, and CSS
   can apply it directly with matrix3d, which means the same markup does it on
   the canvas and on a published page. No second renderer, and nothing baked
   into the photograph.

   The shading comes from the photograph rather than from anywhere else, by
   letting it through the artwork with a blend mode. Dark artwork on a light
   surface multiplies; light artwork on a dark surface screens. That is how the
   creases in a tote bag end up in the logo. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HandoverSurface = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const round = (n) => Math.round(n * 1e6) / 1e6;

  // The corners, in the order a person reads them: top left, top right,
  // bottom right, bottom left. Coordinates are fractions of the block, so a
  // quad survives the block being resized.
  const DEFAULT = [[0.2, 0.25], [0.8, 0.25], [0.8, 0.75], [0.2, 0.75]];

  // The unit square to the quad. Solved directly rather than by inverting an
  // 8x8: the projective terms fall out of two 2x2 systems and the rest is
  // subtraction, which is both faster and easier to check by hand.
  function homography(quad) {
    const [p0, p1, p2, p3] = quad;                 // tl, tr, br, bl
    const dx1 = p1[0] - p2[0], dx2 = p3[0] - p2[0];
    const dy1 = p1[1] - p2[1], dy2 = p3[1] - p2[1];
    const sx = p0[0] - p1[0] + p2[0] - p3[0];
    const sy = p0[1] - p1[1] + p2[1] - p3[1];

    let g, h;
    const den = dx1 * dy2 - dx2 * dy1;
    if (Math.abs(den) < 1e-12) { g = 0; h = 0; }   // an affine quad, no projection
    else { g = (sx * dy2 - dx2 * sy) / den; h = (dx1 * sy - sx * dy1) / den; }

    return [
      p1[0] - p0[0] + g * p1[0], p3[0] - p0[0] + h * p3[0], p0[0],
      p1[1] - p0[1] + g * p1[1], p3[1] - p0[1] + h * p3[1], p0[1],
      g, h, 1,
    ];
  }

  // Where a point in the artwork lands on the surface. u and v run 0 to 1.
  function project(H, u, v) {
    const w = H[6] * u + H[7] * v + H[8];
    return [(H[0] * u + H[1] * v + H[2]) / w, (H[3] * u + H[4] * v + H[5]) / w];
  }

  // CSS wants the transform column by column, in a 4x4 with the third row and
  // column left as identity because everything here is flat.
  function matrix3d(H, w, h) {
    // the artwork is drawn at its own size, so the unit square is scaled first
    const a = H[0] / w, b = H[3] / w, c = H[6] / w;
    const d = H[1] / h, e = H[4] / h, f = H[7] / h;
    return `matrix3d(${[a, b, 0, c, d, e, 0, f, 0, 0, 1, 0, H[2], H[5], 0, H[8]]
      .map((n) => round(n)).join(', ')})`;
  }

  // ------------------------------------------------------------------ shape
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

  // A quad that folds over itself has no single mapping, and the browser draws
  // something that looks like a mistake because it is one.
  function convex(quad) {
    let sign = 0;
    for (let i = 0; i < 4; i++) {
      const c = cross(quad[i], quad[(i + 1) % 4], quad[(i + 2) % 4]);
      if (Math.abs(c) < 1e-9) continue;
      const s = c > 0 ? 1 : -1;
      if (!sign) sign = s;
      else if (s !== sign) return false;
    }
    return true;
  }

  const area = (quad) => Math.abs(
    quad.reduce((a, p, i) => {
      const q = quad[(i + 1) % 4];
      return a + p[0] * q[1] - q[0] * p[1];
    }, 0) / 2);

  // ----------------------------------------------------------------- checks
  function check(quad, box, opts) {
    const o = opts || {};
    const found = [];
    const px = quad.map(([u, v]) => [u * box.w, v * box.h]);

    if (!convex(quad)) {
      found.push({ level: 'blocker',
        what: 'The four corners fold over each other.',
        why: 'There is no one way to map a rectangle onto a shape that crosses itself, so the artwork comes out torn.',
        how: 'Drag the corners so they run round the surface in order, without crossing.' });
      return found;
    }

    const a = area(px);
    if (a < 400) {
      found.push({ level: 'warning',
        what: 'The surface is smaller than twenty pixels square.',
        why: 'Below that the artwork is a smudge and the mockup shows nothing.',
        how: 'Drag the corners wider, or use a photograph where the surface is bigger.' });
    }

    // A mark placed at a stated real size can be checked against its own floor,
    // which is the number the engine already measured off the master.
    if (o.surfaceWidthMm && o.minimumPrintMm) {
      const widthPx = Math.hypot(px[1][0] - px[0][0], px[1][1] - px[0][1]);
      const mmPerPx = o.surfaceWidthMm / Math.max(1, widthPx);
      const artMm = widthPx * mmPerPx * (o.artworkFraction === undefined ? 1 : o.artworkFraction);
      if (artMm < o.minimumPrintMm) {
        found.push({ level: 'warning',
          what: `On a surface ${o.surfaceWidthMm} mm across, the mark lands ${Math.round(artMm)} mm wide, and its floor is ${o.minimumPrintMm} mm.`,
          why: 'Below the floor the thinnest stroke closes up, and it closes up on the real object rather than on the mockup.',
          how: `Make it at least ${o.minimumPrintMm} mm on this surface, or use the mark on its own rather than the full lockup.` });
      }
    }
    return found;
  }

  // The quad's own edges, for a clear-space check: how much room is left
  // between the artwork and the edge of the surface it sits on.
  function inset(quad, fraction) {
    const cx = quad.reduce((a, p) => a + p[0], 0) / 4;
    const cy = quad.reduce((a, p) => a + p[1], 0) / 4;
    const k = 1 - Math.max(0, Math.min(0.9, fraction));
    return quad.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
  }

  // ------------------------------------------------------------------ blend
  // Exactly what CSS does, so the check and the page agree. The point of these
  // is that each can only move a colour one way: multiply never makes anything
  // lighter, screen never makes anything darker. So light ink multiplied onto
  // a light surface cannot be seen, however much you squint at the slider.
  const BLENDS = {
    multiply: (a, b) => a * b,
    screen: (a, b) => 1 - (1 - a) * (1 - b),
    normal: (a) => a,
  };

  function blended(mode, ink, surface, opacity) {
    const f = BLENDS[mode] || BLENDS.normal;
    const o = opacity === undefined ? 1 : opacity;
    const mix = { r: f(ink.r, surface.r), g: f(ink.g, surface.g), b: f(ink.b, surface.b) };
    // opacity below one leaves the surface showing through
    return { r: mix.r * o + surface.r * (1 - o),
      g: mix.g * o + surface.g * (1 - o),
      b: mix.b * o + surface.b * (1 - o) };
  }

  // Can the mark be seen on this? Same bar as anywhere else: three to one for
  // a shape rather than for words.
  const NONTEXT = 3;
  function legible(C, ink, patches, mode, opacity) {
    let worst = Infinity;
    for (const px of patches) {
      const out = blended(mode, ink, px, opacity);
      const surface = C.luminanceOf(px.r, px.g, px.b);
      const drawn = C.luminanceOf(out.r, out.g, out.b);
      worst = Math.min(worst, C.ratioOfLuminance(surface, drawn));
    }
    return { ratio: Math.round(worst * 100) / 100, passes: worst >= NONTEXT };
  }

  // What would work here, said as the two things a designer can change.
  function advise(C, opts) {
    const { ink, inkName, patches, mode, opacity, colourways } = opts;
    const now = legible(C, ink, patches, mode, opacity);
    if (now.passes) return { ok: true, ratio: now.ratio };

    const tries = [];
    for (const m of ['multiply', 'screen', 'normal']) {
      if (m === mode) continue;
      const r = legible(C, ink, patches, m, opacity);
      if (r.passes) tries.push({ what: `blend it ${m}`, ratio: r.ratio, blend: m });
    }
    for (const cw of colourways || []) {
      if (cw.name === inkName) continue;
      const r = legible(C, C.unit(cw.hex).reduce((o, v, i) => (o['rgb'[i]] = v, o), {}), patches, mode, opacity);
      if (r.passes) tries.push({ what: `use the ${cw.name} colourway`, ratio: r.ratio, colourway: cw.name });
    }
    tries.sort((a, b) => b.ratio - a.ratio);
    const best = tries[0];
    return { ok: false, ratio: now.ratio, best,
      finding: { level: 'warning',
        what: `The artwork measures ${now.ratio}:1 against the surface, blended ${mode}.`,
        why: mode === 'multiply'
          ? 'Multiply can only darken, so light artwork on a light surface has nothing to darken and disappears.'
          : mode === 'screen'
            ? 'Screen can only lighten, so dark artwork on a dark surface has nothing to lighten and disappears.'
            : 'A mark on a mockup needs three to one to hold its shape, the same as anywhere else.',
        how: best
          ? `${best.what[0].toUpperCase() + best.what.slice(1)}, which measures ${best.ratio}:1.`
          : 'Nothing in the palette reads on this surface. Try a photograph with a lighter or darker surface.' } };
  }

  return { DEFAULT, homography, project, matrix3d, convex, area, check, inset, round,
    BLENDS, blended, legible, advise, NONTEXT };
}));
