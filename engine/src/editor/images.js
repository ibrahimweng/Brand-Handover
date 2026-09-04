/* The images a document uses.

   They live beside the document rather than inside it, and that is the whole
   design. Undo is a stack of whole documents cloned sixty deep, and the editor
   writes the document to localStorage on every nudge. A photograph inlined into
   a block would be cloned sixty times and rewritten on every arrow key, which
   is how an editor that felt instant starts taking a second to move a box.

   So a block holds an id. The bytes live here, keyed by content, and nothing
   that happens on the canvas touches them.

   The same file runs in Node and in the browser, so the Publish button and the
   publish command agree about what an image is. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../contrast'));
  else root.HandoverImages = factory(root.HandoverContrast);
}(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  // Keyed by content, so the same photograph dropped on four slides is stored
  // once. Not a cryptographic hash and does not need to be: a document holds a
  // handful of images, and the only thing riding on it is deduplication.
  function idOf(dataUri) {
    let h = 2166136261;
    for (let i = 0; i < dataUri.length; i++) {
      h ^= dataUri.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return 'i' + h.toString(36) + dataUri.length.toString(36);
  }

  const SLOTS = ['slot'];
  const isImage = (s) => typeof s === 'string' && /^data:image\//.test(s);

  function store(initial) {
    const map = Object.assign({}, initial || {});
    return {
      add(src, meta) {
        if (!isImage(src)) throw new Error('that is not an image');
        const id = idOf(src);
        if (!map[id]) map[id] = Object.assign({ src }, meta || {});
        return id;
      },
      get: (id) => map[id] || null,
      has: (id) => !!map[id],
      all: () => Object.assign({}, map),
      count: () => Object.keys(map).length,
      // roughly what the store costs, which is what fills a localStorage quota
      bytes: () => Object.values(map).reduce((n, im) => n + Math.round(im.src.length * 0.75), 0),
      // an image nothing points at any more is dropped, so deleting a block
      // deletes its photograph rather than leaving it in the saved file forever
      prune(doc) {
        const keep = used(doc);
        for (const id of Object.keys(map)) if (!keep.has(id)) delete map[id];
        return map;
      },
      reset(next) {
        for (const k of Object.keys(map)) delete map[k];
        Object.assign(map, next || {});
      },
    };
  }

  function used(doc) {
    const out = new Set();
    for (const p of (doc && doc.pages) || []) {
      for (const b of p.blocks || []) {
        if (SLOTS.includes(b.type) && b.props && b.props.image) out.add(b.props.image);
      }
    }
    return out;
  }

  // Only the images a document actually uses, which is what gets published and
  // what gets saved.
  function forDoc(doc, all) {
    const out = {};
    for (const id of used(doc)) if (all[id]) out[id] = all[id];
    return out;
  }

  // ------------------------------------------------------------------ checks
  // An image is too small when the box it sits in asks for more pixels than it
  // has. Two on a page is the working standard: it covers a retina screen and
  // a presentation PDF, and it is a number a designer can hold in their head.
  const DENSITY = 2;

  function check(image, box, label) {
    const found = [];
    if (!image) return found;
    const name = label || 'This image';
    if (image.vector) return found;        // resolution independent, nothing to check

    const needW = Math.ceil(box.w * DENSITY), needH = Math.ceil(box.h * DENSITY);
    const short = image.w < needW || image.h < needH;
    if (short) {
      found.push({ level: 'warning',
        what: `${name} is ${image.w} by ${image.h} in a box that wants ${needW} by ${needH}.`,
        why: 'It will look soft on a good screen and softer in print, which is the kind of thing nobody notices until the deck is on a wall.',
        how: `Use a version at least ${needW} px wide, or make the box smaller.` });
    }
    // A photograph stretched to a shape it was never cropped for is the other
    // half of the same problem, and cover hides it by cropping instead.
    return found;
  }

  // ------------------------------------------------- what is under the mark
  // Where a point in the block lands in the photograph, given object-fit and
  // the focal point. Exactly the maths the browser does, written out, because
  // the interesting question is which pixels are underneath the mark and the
  // browser will not answer it.
  function sourceRect(image, box, props) {
    const p = props || {};
    const contain = p.fit === 'contain';
    const sx = box.w / image.w, sy = box.h / image.h;
    const scale = contain ? Math.min(sx, sy) : Math.max(sx, sy);
    const drawnW = image.w * scale, drawnH = image.h * scale;
    // cover pulls the overflow towards the focal point; contain centres the gap
    const fx = (Number(p.focusX) || 0) / 100, fy = (Number(p.focusY) || 0) / 100;
    const offX = contain ? (box.w - drawnW) / 2 : (box.w - drawnW) * fx;
    const offY = contain ? (box.h - drawnH) / 2 : (box.h - drawnH) * fy;
    return { scale, offX, offY, drawnW, drawnH,
      // a rectangle in block space, back to a rectangle in the photograph
      toSource(r) {
        return { x: (r.x - offX) / scale, y: (r.y - offY) / scale,
          w: r.w / scale, h: r.h / scale };
      } };
  }

  // The overlap of two blocks, in the coordinates of the lower one. Nothing
  // to say when they do not overlap.
  function overlap(under, over) {
    const x = Math.max(under.x, over.x), y = Math.max(under.y, over.y);
    const r = Math.min(under.x + under.w, over.x + over.w);
    const b = Math.min(under.y + under.h, over.y + over.h);
    if (r <= x || b <= y) return null;
    return { x: x - under.x, y: y - under.y, w: r - x, h: b - y };
  }

  // A mark on a photograph. Nobody misreads a photographic brief; they put the
  // mark on a bright sky and it disappears, and that is arithmetic on the
  // pixels underneath it rather than a matter of taste.
  //
  // The mean is not the number that matters. A mark over a sky that is bright
  // in one corner fails in that corner while the average looks fine, so the
  // worst patch is what gets reported.
  const NONTEXT = 3;                 // WCAG 2.2 for a shape rather than words

  function overlayVerdict(inkHex, patches, opts) {
    const o = opts || {};
    const ink = C.luminance(inkHex);
    let worst = Infinity, worstAt = null;
    for (const p of patches) {
      const r = C.ratioOfLuminance(ink, p.luminance);
      if (r < worst) { worst = r; worstAt = p; }
    }
    if (!isFinite(worst)) return null;
    const mean = patches.reduce((n, p) => n + p.luminance, 0) / patches.length;
    const out = { ratio: worst, mean: C.ratioOfLuminance(ink, mean), passes: worst >= NONTEXT, at: worstAt };
    if (out.passes) return out;
    out.finding = { level: 'warning',
      what: `The ${o.what || 'mark'} measures ${worst}:1 against the lightest part of the photograph under it.`,
      why: `A mark on a picture needs ${NONTEXT}:1 to hold its shape, and this one disappears where the picture is brightest.`,
      how: o.instead
        ? `Use the ${o.instead.name} colourway here, which measures ${o.instead.ratio}:1, or move the mark to a quieter part of the picture.`
        : 'Move the mark to a quieter part of the picture, or put a scrim behind it.' };
    return out;
  }

  // Of the colourways available, the one that reads best on these pixels.
  function bestColourway(ways, patches) {
    let best = null;
    for (const w of ways) {
      const ink = C.luminance(w.hex);
      let worst = Infinity;
      for (const p of patches) worst = Math.min(worst, C.ratioOfLuminance(ink, p.luminance));
      if (!best || worst > best.ratio) best = { name: w.name, hex: w.hex, ratio: worst };
    }
    return best && best.ratio >= NONTEXT ? best : null;
  }

  return { idOf, store, used, forDoc, check, isImage, DENSITY,
    sourceRect, overlap, overlayVerdict, bestColourway, NONTEXT };
}));
