/* The identity's own shape, reduced to the moves a surface understands.

   Every generator here draws through `surface`, which is one API served by a
   canvas and an SVG writer alike — that is the whole reason a pattern's PNG and
   its SVG cannot drift apart. So the mark cannot be handed to a generator as
   markup. It has to arrive as the same moves any other shape is made of.

   Which is also why the parsing happens here, in Node, once, and not in the
   generator. `mark.js` measures the drawing and hands over six numbers; this
   reads the drawing and hands over a list of moves. The studio in the browser
   replays them with no parser of its own, and `brand.json` carries them, so a
   client who reopens the package a year later gets the same motif without the
   original SVG being anywhere near it.

   Everything is reduced to move, line and cubic, which is what `paths.js`
   already does for the print path and what every drawing system agrees on. A
   rect becomes four lines, a circle four cubics. There is no branch in the
   generator for what kind of shape the client happened to draw.

   The shape is normalised into a unit box centred on the origin, so a generator
   asks for it at a radius and gets it at that radius whatever size the original
   artwork was. */
//
// UMD, because `draw` runs in the studio and the studio has no require.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PatternMotif = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // How many moves a motif may carry.
  //
  // Not an arbitrary cap: these travel in brand.json and are replayed for every
  // cell of every tile, so a mark traced from a photograph would put megabytes
  // in the file and thousands of curves in each of a few hundred cells. Six
  // hundred is more than any drawn mark in this repository needs — the largest
  // is 96 — and a shape over it is refused with a reason rather than silently
  // simplified, because a simplified logo is not the logo.
  const MOST = 600;

  // ------------------------------------------------------------------ drawing

  // Replay a motif at a centre and a radius. `r` is the half-width of the box
  // it is drawn into, so a motif fills the same square a `square` glyph would.
  //
  // Filled or stroked is the shape's own answer, not a setting. A ring, a
  // bracket, an open arc — the drawing is the *line*, and filling its path
  // turns it into a blob: carrock's three concentric arcs came out as a solid
  // circle and deben's bracket came out as nothing at all, because an open path
  // with no enclosed area fills to nothing. `pattern.js` has answered this
  // question since the mark-tiler was written, and this reads its answer rather
  // than forming a second one.
  // The shape as a path on the surface, and nothing painted.
  //
  // Split out of `draw` because a poster wants the mark as a *clip* — the
  // counterchange figure is the client's own logo, and what makes it read as a
  // figure rather than a sticker is that nothing is drawn on its edge. A
  // generator that had to call `draw` to get the path would get a fill it did
  // not ask for.
  function path(surface, m, cx, cy, r) {
    if (!m || !m.ops || !m.ops.length) return false;
    const s = r * 2;
    const X = (v) => cx + v * s;
    const Y = (v) => cy + v * s;
    surface.beginPath();
    for (const o of m.ops) {
      if (o[0] === 'M') surface.moveTo(X(o[1]), Y(o[2]));
      else if (o[0] === 'L') surface.lineTo(X(o[1]), Y(o[2]));
      else if (o[0] === 'C') surface.bezierCurveTo(X(o[1]), Y(o[2]), X(o[3]), Y(o[4]), X(o[5]), Y(o[6]));
      else if (o[0] === 'Z') surface.closePath();
    }
    return true;
  }

  function draw(surface, m, cx, cy, r) {
    if (!path(surface, m, cx, cy, r)) return;
    const s = r * 2;
    if (m.stroked) {
      // The weight is a share of the tile, which is how the mark-tiler states
      // it, so a motif drawn small is drawn thin — the same hand at any size.
      //
      // With a floor, and the floor is a departure from the artwork made on
      // purpose. `ancroft` draws its mark at 3.3% of its own box; in a cell of
      // a sixteen-cell tile that box is 16.5 units across, so the stroke is
      // 0.55 — a hairline beside cells six per cent of the tile wide, and
      // invisible. The route then promises a pattern made of the client's mark
      // and shows them nothing, which is worse than not offering it.
      //
      // Seven per cent is where a stroke stops disappearing against a cell, and
      // it binds on five of the twenty-one stroked marks here and changes
      // nothing for the rest. A mark redrawn slightly heavier is still that
      // mark; a mark nobody can see is not.
      surface.lineWidth = Math.max(s * 0.07, (m.weight || 0.06) * s);
      surface.lineCap = 'round';
      surface.lineJoin = 'round';
      surface.strokeStyle = surface.fillStyle;
      surface.stroke();
      return;
    }
    // Non-zero, not even-odd. A mark with a counter — the hole in a letter, the
    // middle of a ring — is drawn as two subpaths in the same direction as
    // often as in opposite ones, and even-odd turns the first kind inside out.
    // Non-zero keeps a shape drawn either way looking like itself.
    surface.fill('nonzero');
  }

  // The box the motif's coordinates occupy, for a caller that wants to place it
  // rather than centre it. Centred on the origin, and about one unit across: a
  // curve's control points can sit outside the curve, so this is a little wider
  // than the drawn shape and never narrower.
  function box(m) {
    if (!m || !m.ops || !m.ops.length) return { w: 0, h: 0 };
    let lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
    for (const o of m.ops) {
      for (let i = 1; i < o.length; i += 2) {
        lo[0] = Math.min(lo[0], o[i]); hi[0] = Math.max(hi[0], o[i]);
        lo[1] = Math.min(lo[1], o[i + 1]); hi[1] = Math.max(hi[1], o[i + 1]);
      }
    }
    return { w: hi[0] - lo[0], h: hi[1] - lo[1] };
  }

  /* Is the mark here?

     `u` and `v` are 0..1 across the shape's own box. The bitmap is packed a bit
     per cell and base64'd, so this unpacks once and caches on the mask object
     rather than decoding a string per cell — a poster asks this a few thousand
     times per page.

     Out of range reads as empty, so a generator can ask about a coordinate
     outside the mark without a bounds check of its own. */
  function at(mask, u, v) {
    if (!mask || !mask.bits) return 0;
    if (u < 0 || u >= 1 || v < 0 || v >= 1) return 0;
    let bytes = mask._bytes;
    if (!bytes) {
      const raw = typeof atob === 'function'
        ? atob(mask.bits)
        : Buffer.from(mask.bits, 'base64').toString('binary');
      bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      try { Object.defineProperty(mask, '_bytes', { value: bytes, enumerable: false }); }
      catch (ignored) { mask._bytes = bytes; }
    }
    const n = mask.n || 48;
    const i = Math.min(n - 1, Math.floor(u * n));
    const j = Math.min(n - 1, Math.floor(v * n));
    const k = j * n + i;
    return (bytes[k >> 3] >> (k & 7)) & 1;
  }

  /* Is the mark here, in a square somebody else is drawing in?

     `at` asks the bitmap in the shape's own coordinates, and a shape is rarely
     square: a 3:1 logotype asked at (0.5, 0.5) of a square cell is being asked
     about the middle of a box three times too tall. Every generator that wants
     the mark as a field wants it fitted into their square, not stretched to
     fill it — a stretched logo is the one thing a client will notice before
     anything else on the sheet.

     So this letterboxes. The shape keeps its proportion, sits centred, and the
     margins read as empty. `spread` opens the shape out toward the edges of
     the square before sampling, which is how a generator asks for "the mark,
     but bigger in this cell" without redrawing it. */
  function inside(m, u, v, spread) {
    if (!m || !m.mask) return 0;
    const r = m.ratio > 0 ? m.ratio : 1;
    const k = spread > 0 ? 1 / (1 + spread) : 1;
    // Whichever way round the shape is, the long side spans the square.
    const sx = r >= 1 ? 1 : r;
    const sy = r >= 1 ? 1 / r : 1;
    const x = 0.5 + ((u - 0.5) / (sx * k));
    const y = 0.5 + ((v - 0.5) / (sy * k));
    return at(m.mask, x, y);
  }

  return { draw, path, box, at, inside, MOST };
}));
