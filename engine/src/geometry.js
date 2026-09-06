'use strict';
// Everything here is measured off the artwork rather than typed in by hand.
// That is the whole point: a number a designer typed can be wrong, and a number
// read off the master cannot.
const { Resvg } = require('@resvg/resvg-js');
const svgu = require('./svg');

// The bounding box of everything that actually puts ink on the page, in the
// document's own user units. Measured by rendering and reading the alpha
// channel, so strokes, round caps and overlaps are all accounted for.
// A viewBox is a unit system, not a resolution: 120 and 2048 can describe the
// same drawing. Rendering at six pixels per unit therefore made the cost of a
// measurement depend on a number the designer picked arbitrarily — a 2048 unit
// box rendered 12288 square, which is 151 million pixels and six seconds, every
// time an ink box was wanted. What the measurement needs is enough pixels to
// find an edge, and that is a resolution, so cap it as one.
// The cost is area, not width, so bound the area: a wordmark 657 units wide and
// 77 tall is cheap at six pixels a unit and a 2048 square seal is not.
const INK_MAX_AREA = 6e6;

function inkBox(svgString, scale = 6) {
  const doc = svgu.parse(svgString);
  const vb = svgu.viewBox(doc);
  const natural = Math.max(1, Math.round(vb.w * scale));
  const area = natural * Math.max(1, Math.round(vb.h * scale));
  const wide = area > INK_MAX_AREA
    ? Math.max(1, Math.round(natural * Math.sqrt(INK_MAX_AREA / area))) : natural;
  const r = new Resvg(svgString, {
    fitTo: { mode: 'width', value: wide },
    background: 'rgba(0,0,0,0)',
  });
  const img = r.render();
  const { width: W, height: H } = img;
  const px = img.pixels;

  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < H; y++) {
    const row = y * W * 4;
    for (let x = 0; x < W; x++) {
      if (px[row + x * 4 + 3] > 8) {          // alpha above a nudge of noise
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error('the artwork renders empty, so it cannot be measured');

  const sx = vb.w / W, sy = vb.h / H;
  return {
    x: svgu.round(vb.x + minX * sx),
    y: svgu.round(vb.y + minY * sy),
    w: svgu.round((maxX - minX + 1) * sx),
    h: svgu.round((maxY - minY + 1) * sy),
  };
}

// Clear space is a fraction of the mark's own ink height, so it scales with the
// artwork instead of being a number somebody has to remember.
const clearSpace = (box, ratio) => svgu.round(box.h * ratio);

// The stroke is the first thing to fail as a mark gets smaller. Below these
// sizes it thins past what a screen or a press can hold.
// The narrowest place in filled artwork.
//
// A declared stroke width is a fact and is used when there is one. Most real
// marks do not have one: an outlined wordmark has no strokes at all, and
// neither does any logo drawn as filled shapes. Without this the minimum size —
// the whole point of the measurement — is simply absent for the commonest kind
// of artwork, which is what a first run on somebody else's logo turned up.
//
// So it is measured. Every row and every column of a render is scanned for
// unbroken runs of ink, and the fifth percentile of those runs is the stem.
// Not the minimum: a mitred corner and the tip of a curve taper to nothing, and
// they are not what a reader loses first. The fifth percentile is stable across
// resolutions and, on artwork whose stroke width is known, returns it exactly.
const STEM_DISCARD = 2;         // runs to step over before believing the smallest
const STEM_RENDER_PX = 600;
const STEM_MIN_SAMPLES = 14;    // pixels across the thinnest thing before the answer is trusted
const STEM_MAX_PX = 2600;

// Scan the rendered artwork line by line and collect every unbroken run of
// ink, keeping where each run sits so neighbouring lines can be compared.
function inkRuns(pixels, width, height) {
  const alpha = (x, y) => pixels[(y * width + x) * 4 + 3] / 255;
  // The threshold puts the edge at half coverage, which is the true edge, but
  // it then rounds the run to whole pixels. That is invisible on a 120 unit
  // box rendered 600 wide and it is not on a 252 unit one, where a 7 unit bar
  // measured 6.72. The partly covered pixel at each end carries the remainder,
  // so add it back and the measurement stops depending on the render scale.
  const sweep = (outer, inner, at) => {
    const lines = [];
    for (let a = 0; a < outer; a++) {
      const line = [];
      let n = 0;
      const close = (end) => {
        const start = end - n;
        // coverage, not a pixel count: a boundary pixel that is 80% inked is
        // 0.8 of a unit of width, and counting it as a whole one is the error
        // that made the answer depend on how large the artwork was rendered
        let len = 0;
        for (let b = start - 1; b <= end; b++) {
          if (b >= 0 && b < inner) len += at(a, b);
        }
        line.push({ start, len });
      };
      for (let b = 0; b < inner; b++) {
        if (at(a, b) > 0.5) n++;
        else { if (n) close(b); n = 0; }
      }
      if (n) close(inner);
      lines.push(line);
    }
    return lines;
  };
  return [sweep(height, width, (y, x) => alpha(x, y)),
    sweep(width, height, (x, y) => alpha(x, y))];
}

// A stem is a place where the artwork is locally at its narrowest and stays
// narrow either side of that line. A tip is not: it is where the shape runs
// out. Taking a low percentile of every run confuses the two, and a mark with
// a sharp corner in it then reports a stem far thinner than anything you could
// point at — a chevron measured 4.8 where the bar across it is 12. So keep
// only runs that are a local minimum with ink on both neighbouring lines, and
// take the percentile of those.
function stems(lines) {
  const found = [];
  for (let i = 1; i < lines.length - 1; i++) {
    for (const run of lines[i]) {
      const widest = (line) => {
        let w = 0;
        for (const o of line) {
          if (o.start < run.start + run.len && o.start + o.len > run.start) w = Math.max(w, o.len);
        }
        return w;
      };
      const before = widest(lines[i - 1]), after = widest(lines[i + 1]);
      if (!before || !after) continue;                  // a tip, not a stem
      if (run.len <= before && run.len <= after) found.push(run.len);
    }
  }
  return found;
}

function scanAt(svgString, viewBox, wide) {
  const r = new Resvg(svgString, { fitTo: { mode: 'width', value: wide },
    background: 'rgba(0,0,0,0)' }).render();
  const { pixels, width, height } = r;
  const scans = inkRuns(pixels, width, height);
  let runs = stems(scans[0]).concat(stems(scans[1]));
  if (!runs.length) {
    // nothing narrows anywhere — a solid blob, or a shape one line thick.
    // Fall back to the plain runs so the answer is a width, not a null.
    runs = scans[0].concat(scans[1]).flat().map((o) => o.len);
  }
  if (!runs.length) return null;
  runs.sort((a, b) => a - b);
  // Near the smallest, not a percentile of the sample.
  //
  // A percentile is a defence against anti-aliasing: one or two runs come back
  // a pixel narrower than the shape really is, and taking the minimum would
  // believe them. But a percentile is a share of the *sample*, and the sample
  // is dominated by however much outline the shape happens to have. Ancroft's
  // monogram is a solid shield with a chevron cut out of it: the metal beside
  // the cut is 36 units wide and shows up on eleven scanlines, out of two
  // hundred and twenty. The fifth percentile stepped straight past it and
  // reported 84 — not the narrowest part, but the width of a fairly narrow one.
  //
  // Discarding a fixed handful does the job the percentile was for and does
  // not scale with the outline. The answer is stable from the second smallest
  // to the ninth on every drawing in the repository, which is what says this is
  // not noise being chased.
  const px = runs[Math.min(runs.length - 1, STEM_DISCARD)];
  return { units: svgu.round(px * (viewBox.w / width), 2), px };
}

function thinnestFeature(svgString, viewBox) {
  const first = scanAt(svgString, viewBox, STEM_RENDER_PX);
  if (!first) return null;
  // A feature two pixels across is mostly quantisation, whatever arithmetic is
  // done to it: a seal drawn in a 2048 unit box has hairlines that land on
  // about two pixels at this size, and its 8 unit ring measured 7.7. Rendering
  // to a fixed width assumes the artwork's units are of a familiar size, and
  // nothing says they are. Look again, large enough to see.
  if (first.px >= STEM_MIN_SAMPLES) return first.units;
  const want = Math.min(STEM_MAX_PX,
    Math.ceil(STEM_RENDER_PX * (STEM_MIN_SAMPLES / Math.max(first.px, 0.5))));
  if (want <= STEM_RENDER_PX) return first.units;
  const again = scanAt(svgString, viewBox, want);
  return again ? again.units : first.units;
}

// How to say a floor out loud. It is a width; for a mark that is not roughly
// square, saying only the width invites somebody to set the height to it.
function floorText(ms, unit) {
  if (!ms || ms.screenPx == null) return 'not measured';
  const w = unit === 'mm' ? ms.printMm : ms.screenPx;
  const h = unit === 'mm' ? ms.printMmHigh : ms.screenPxHigh;
  return ms.squarish ? `${w} ${unit}` : `${w} × ${h} ${unit}`;
}

function minimumSize(svgString, rules) {
  const doc = svgu.parse(svgString);
  const vb = svgu.viewBox(doc);
  // What disappears first decides the floor, and it can be either a stroke or
  // a filled stem. Trusting the stroke whenever there was one meant a mark
  // that is mostly fills never had its fills measured: three 7 unit boards
  // under a 12 unit strap reported 12, and the floor came out at 63 px where
  // the boards render 1.75 px wide. Measure both and believe the thinner.
  const stroke = svgu.thinnestStroke(doc);
  const feature = thinnestFeature(svgString, vb);
  const measured = stroke == null ? feature
    : feature == null ? stroke : Math.min(stroke, feature);
  if (!measured) {
    return { screenPx: null, printMm: null, thinnestStroke: null,
      note: 'nothing is painted, so nothing limits the size' };
  }
  const ratio = vb.w / measured;               // how many stem widths wide the box is
  // a stroke measured off the render agrees with its own declared width, so
  // only call it a stem when the render found something the stroke did not
  const how = stroke != null && measured === stroke ? 'stroke' : 'stem';
  // The floor is a WIDTH — it always was, because the box is divided by the
  // stem across it — and no document ever said so. While every mark was roughly
  // square that made no difference. It makes a great deal to a mark 4.7 times
  // taller than it is wide: "13 px" means 13 across and 42 down, and anyone
  // setting the height to 13 gets a mark 3 px wide with a 0.9 px stem in it.
  const tall = vb.h / vb.w;
  const wide = Math.ceil(ratio * rules.minStrokePx);
  const squarish = Math.abs(Math.log(tall)) < Math.log(1.3);
  // The specimen that shows the floor is drawn twice — once by the manual and
  // once on the canvas — and the height went into only one of them, so the same
  // mark was captioned "220 x 80 px" in the book and "220 px" on the page it
  // published. Work the three steps out here, once, and let both read them.
  // ceil, the same way screenPxHigh rounds, or the floor reads 110 x 40 in the
  // prose and 110 x 39 under the picture beside it
  const say = (w) => (squarish ? `${w} px` : `${w} \u00d7 ${Math.ceil(w * tall)} px`);
  const steps = [[wide * 2, 'comfortable'], [wide, 'the floor'], [Math.round(wide * 0.6), 'below the floor']]
    .map(([w, label]) => ({ px: w, high: Math.ceil(w * tall), label, caption: say(w) }));
  return {
    thinnestStroke: measured,
    from: how,
    screenPx: wide,
    screenPxHigh: Math.ceil(wide * tall),
    printMm: svgu.round(ratio * rules.minStrokeMm, 1),
    printMmHigh: svgu.round(ratio * rules.minStrokeMm * tall, 1),
    squarish,
    steps,
    basis: how === 'stroke'
      ? `box ${vb.w} ÷ stroke ${measured} = ${svgu.round(ratio, 2)} stroke widths across`
      : `box ${vb.w} ÷ narrowest stem ${measured} = ${svgu.round(ratio, 2)} stems across, measured off the artwork`
        + (stroke != null ? `, which is thinner than the ${stroke} stroke` : ''),
  };
}

function renderPng(svgString, widthPx) {
  return new Resvg(svgString, {
    fitTo: { mode: 'width', value: widthPx },
    background: 'rgba(0,0,0,0)',
  }).render().asPng();
}

module.exports = { inkBox, clearSpace, minimumSize, thinnestFeature, renderPng, floorText };
