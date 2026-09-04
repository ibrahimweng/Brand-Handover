/* Bleed, trim and crop marks.

   A printed page is three boxes, and confusing them is how a job comes back
   with a white line down one side.

     trim    the finished page. 210 by 297 for A4, and what a designer lays out
             on. Every block's x and y are in this space.
     bleed   trim plus a margin on all four sides, usually 3 mm. Anything meant
             to reach the edge has to be painted out to here, because a guillotine
             cutting a stack of paper is accurate to about a millimetre.
     media   the sheet that actually goes through the press: bleed plus room for
             the marks that tell the finisher where to cut.

   The awkward part is that a designer draws to trim and the printer needs
   bleed, so somebody has to paint outside the page. Asking for that by hand
   means a block at x: -9 with a width of page + 18, which breaks the grid,
   breaks the reflow, and gets forgotten on the one page that matters. So the
   rule is the same one the resize already uses: a block that touches an edge
   is meant to run off it, and the system paints it out to the bleed.

   Only the blocks that can bleed do. A photograph or a colour field running off
   the page is what bleed is for; a line of type doing it is a mistake, and
   quietly widening its box would move centred text. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HandoverPrint = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PX_PER_MM = 96 / 25.4;
  const mm = (v) => v * PX_PER_MM;
  const round = (n) => Math.round(n * 100) / 100;

  // What may run off the page. A block whose content is words may not, because
  // widening its box moves the words.
  const BLEEDS = ['fill', 'slot', 'pattern'];
  const EDGE = 1;                       // within a pixel of an edge counts as on it

  // Marks sit outside the bleed, and the gap between the mark and the trim is
  // the bleed itself, so a mark never crosses artwork.
  const MARK_LENGTH_MM = 5;
  const MARK_WEIGHT_PT = 0.25;

  // Everything a page needs to be printed, in pixels, from one number in
  // millimetres. Nothing here is typed in twice.
  //
  // The pixel media box is derived from the physical one rather than worked out
  // alongside it, because two roundings of the same number do not agree and a
  // page element a third of a pixel taller than its @page spills onto a second
  // sheet. Floored, so it can only ever be smaller than the paper.
  function boxes(sheet, spec) {
    const s = spec || {};
    const bleedMm = Math.max(0, Number(s.bleed) || 0);
    const marks = bleedMm > 0 && s.marks !== false;
    const padMm = bleedMm + (marks ? MARK_LENGTH_MM : 0);
    const css = cssSize(sheet, padMm);
    // the pad is quoted in millimetres and the sheet may be in inches or in
    // pixels, so it is converted once and both boxes are built from that
    const pad = inSheetUnits(sheet, padMm);
    const media = bleedMm
      ? { w: Math.floor(pxOf(sheet, sheet.printW + pad * 2)), h: Math.floor(pxOf(sheet, sheet.printH + pad * 2)) }
      : { w: sheet.w, h: sheet.h };
    // whatever the rounding did, trim sits in the middle of the media box
    const offset = round((media.w - sheet.w) / 2);
    const bleed = bleedMm ? round(mm(bleedMm)) : 0;
    return {
      bleedMm, bleed, marks, markLen: marks ? round(mm(MARK_LENGTH_MM)) : 0,
      weight: round(MARK_WEIGHT_PT * 96 / 72),
      trim: { w: sheet.w, h: sheet.h },
      bleedBox: { w: round(sheet.w + bleed * 2), h: round(sheet.h + bleed * 2) },
      media,
      offset, offsetY: round((media.h - sheet.h) / 2),
      css,
    };
  }

  // the sheet's own unit, back to pixels, the same way the size itself was made
  const pxOf = (sheet, v) => v * (sheet.unit === 'mm' ? PX_PER_MM : sheet.unit === 'in' ? 96 : 1);
  const inSheetUnits = (sheet, valueMm) =>
    sheet.unit === 'mm' ? valueMm : sheet.unit === 'in' ? valueMm / 25.4 : mm(valueMm);

  // The media box in the sheet's own units, so a printer is told millimetres
  // rather than a pixel count that happens to be the right size at 96 dpi.
  function cssSize(sheet, padMm) {
    if (!padMm) return sheet.css;
    const p = inSheetUnits(sheet, padMm);
    return `${round(sheet.printW + p * 2)}${sheet.unit} ${round(sheet.printH + p * 2)}${sheet.unit}`;
  }

  // A block, in the geometry it should be painted at. Trim space unless it is
  // against an edge and allowed to run off, in which case it is painted out to
  // the bleed on that side only.
  function bleedBox(block, sheet, box) {
    if (!box.bleed || BLEEDS.indexOf(block.type) < 0) return null;
    const b = box.bleed;
    const left = block.x <= EDGE, top = block.y <= EDGE;
    const right = Math.abs(block.x + block.w - sheet.w) <= EDGE;
    const bottom = Math.abs(block.y + block.h - sheet.h) <= EDGE;
    if (!left && !right && !top && !bottom) return null;
    return {
      x: left ? block.x - b : block.x,
      y: top ? block.y - b : block.y,
      w: block.w + (left ? b : 0) + (right ? b : 0),
      h: block.h + (top ? b : 0) + (bottom ? b : 0),
    };
  }

  // Four corners, two lines each, outside the bleed and pointing at the trim.
  function marks(box) {
    if (!box.marks) return '';
    const { media, offset: ox, offsetY: oy, weight } = box;
    const t = box.trim;
    const gap = box.bleed;                      // the mark stops where the bleed starts
    // the media box is floored to fit its paper, which can leave a fraction
    // less room than the nominal mark length, so the mark is trimmed to the
    // room it has rather than drawn off the edge of the sheet
    const L = round(Math.min(box.markLen, Math.min(ox, oy) - gap));
    if (L <= 0) return '';
    const seg = [];
    const H = (x1, x2, y) => seg.push(`M${round(x1)} ${round(y)}H${round(x2)}`);
    const V = (y1, y2, x) => seg.push(`M${round(x)} ${round(y1)}V${round(y2)}`);
    for (const x of [ox, ox + t.w]) {
      V(oy - gap - L, oy - gap, x);             // above the page
      V(oy + t.h + gap, oy + t.h + gap + L, x); // below it
    }
    for (const y of [oy, oy + t.h]) {
      H(ox - gap - L, ox - gap, y);             // left of the page
      H(ox + t.w + gap, ox + t.w + gap + L, y); // right of it
    }
    return `<svg class="hp-marks" width="${media.w}" height="${media.h}" viewBox="0 0 ${media.w} ${media.h}"`
      + ` aria-hidden="true" focusable="false">`
      + `<path d="${seg.join('')}" stroke="#000000" stroke-width="${weight}" fill="none"/></svg>`;
  }

  // ------------------------------------------------------------------ checks
  // The two mistakes bleed exists to prevent, and neither is visible on screen.
  const NEAR = 12;                      // a block this close to an edge meant to touch it

  function check(page, sheet, box, nameOf) {
    const found = [];
    if (!box.bleed) return found;
    const name = nameOf || ((b) => b.type);

    for (const b of page.blocks) {
      if (BLEEDS.indexOf(b.type) < 0) continue;
      // a gap of a few pixels reads as nothing on screen and as a white line
      // once the page has been cut
      const gaps = [];
      if (b.x > EDGE && b.x <= NEAR) gaps.push(`${Math.round(b.x)} px from the left`);
      if (b.y > EDGE && b.y <= NEAR) gaps.push(`${Math.round(b.y)} px from the top`);
      const rightGap = sheet.w - (b.x + b.w), bottomGap = sheet.h - (b.y + b.h);
      if (rightGap > EDGE && rightGap <= NEAR) gaps.push(`${Math.round(rightGap)} px from the right`);
      if (bottomGap > EDGE && bottomGap <= NEAR) gaps.push(`${Math.round(bottomGap)} px from the bottom`);
      if (!gaps.length) continue;
      found.push({ level: 'warning', block: b.id,
        what: `${name(b)} stops ${gaps.join(' and ')} of the page edge.`,
        why: 'On screen that is nothing. After trimming it is a white line down the side, and it cannot be fixed at that point.',
        how: 'Put it exactly on the edge and it will be painted out into the bleed for you.' });
    }

    // Type sitting in the bleed gets cut off. The safe margin is the bleed
    // again, which is the convention and is what the guillotine tolerance is.
    const safe = box.bleed;
    for (const b of page.blocks) {
      if (BLEEDS.indexOf(b.type) >= 0) continue;
      const out = [];
      if (b.x < safe) out.push('left');
      if (b.y < safe) out.push('top');
      if (b.x + b.w > sheet.w - safe) out.push('right');
      if (b.y + b.h > sheet.h - safe) out.push('bottom');
      if (!out.length) continue;
      found.push({ level: 'warning', block: b.id,
        what: `${name(b)} comes within ${box.bleedMm} mm of the ${out.join(' and ')} edge.`,
        why: `A guillotine cutting a stack of paper is accurate to about that, so anything inside the ${box.bleedMm} mm margin can be cut into.`,
        how: `Keep it ${Math.ceil(box.bleed)} px or more from the edge.` });
    }
    return found;
  }

  return { boxes, bleedBox, marks, check, cssSize, BLEEDS, PX_PER_MM, MARK_LENGTH_MM };
}));
