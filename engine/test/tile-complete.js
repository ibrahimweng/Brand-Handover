/* Is a tile complete on its own? Asked in a child process, on purpose.

   A tile is used clipped to its own bounds — a `<pattern>` fill, a texture in a
   layout, a bitmap copied across — so the property is: what the generator draws
   inside the tile, on its own, is what is there when all eight neighbours are
   drawn around it. A generator that leans on a neighbour's overhang has a join,
   because under a clip there is no neighbour.

   Two renders per tile, both on a canvas three tiles square, so the only
   difference between them is whether the neighbours are drawn. Rendering the
   lone tile on a lone-tile canvas is a different measurement: the rasteriser
   rounds coordinates differently at a different canvas size, and that read as a
   five per cent difference on a tile that is pixel-perfect — every one of the
   nine positions in a 3x3 differed from the lone render by exactly the same
   amount, which is the signature of the instrument and not of the artwork.

   Why a child process. `@resvg/resvg-js` holds its parsed tree and its pixmap
   in native memory; V8 does not count that, so it feels no pressure, so it does
   not collect, so nothing is freed. A hundred and thirty of these renders took
   the suite to a five gigabyte peak and the kernel killed it — and cutting the
   canvas to a third of the area barely moved the number, because the cost is
   the parsed tree rather than the pixels. Run in chunks in a child that exits,
   the memory goes back to the operating system and the suite's own peak is
   untouched.

   usage: node tile-complete.js '<json job list>'
   a job is { identity, generator, effects? } and the answer is the share of
   channels that differ, which for a tile that carries itself is exactly zero. */
'use strict';
const fs = require('fs');
const path = require('path');
const PENG = require('../src/patterns');
const PPAL = require('../src/patterns/palette');
const PSEAM = require('../src/patterns/seam');
const PSURF = require('../src/patterns/surface');
const PMOTIFREAD = require('../src/patterns/motif-read');
const projectLoader = require('../src/project');
const measure = require('../src/vision').measure || null;

const PX = 140;

// One tile, painted at the centre of a canvas the size of the nine.
function lone(paint, W, H) {
  const s = PSURF.svg({ width: W * 3, height: H * 3, id: 'L' });
  s.save(); s.translate(W, H); paint(s, W, H); s.restore();
  return s.toSVG();
}

function incomplete(paint) {
  const one = PSEAM.pixels(lone(paint, 100, 100), PX * 3);
  const nine = PSEAM.pixels(PSEAM.layout(paint, 100, 100, 3, 3, 'nine'), PX * 3);
  let diff = 0, total = 0;
  for (let y = PX; y < PX * 2; y++) {
    for (let x = PX; x < PX * 2; x++) {
      const i = (y * one.w + x) * 4;
      for (let c = 0; c < 3; c++) { total++; if (Math.abs(one.px[i + c] - nine.px[i + c]) > 8) diff++; }
    }
  }
  return (diff / total) * 100;
}

const cache = {};
function identity(name) {
  if (cache[name]) return cache[name];
  const pr = projectLoader.load(path.join(__dirname, '..', 'projects', name, 'project.json'));
  const src = pr.assets.mark ? pr.assets.mark.source : (pr.assets.wordmark || {}).source;
  const motif = PMOTIFREAD.read(src, pr.rules, undefined, undefined,
    { lettering: projectLoader.masterNameOf(pr) === 'wordmark' });
  cache[name] = { src, motif: motif.ok ? motif : null, pal: PPAL.of(pr.tokens.colour) };
  return cache[name];
}

const jobs = JSON.parse(process.argv[2] || '[]');
const out = [];
for (const job of jobs) {
  const r = identity(job.identity);
  const opts = { markSource: r.src, generator: job.generator, route: 'motif',
    motif: r.motif, palette: r.pal, size: 100, id: `tc-${job.generator}-${job.identity}` };
  if (job.effects) {
    opts.params = Object.assign(PENG.tile(opts).params, { effects: job.effects });
  }
  const t = PENG.tile(opts);
  /* A tile painted *without* the clip, for the control.

     `layers.paint` clips every tile to its own bounds, which is the line that
     makes all of this read zero. Calling the generator directly is exactly what
     the engine did before that line, so a generator that paints past its own
     edges — and several do, on purpose, so that a shape straddling the join is
     drawn on both sides of it — reads the difference. Without this the test is
     a row of zeroes that proves only that the instrument is switched off. */
  const paint = job.broken
    ? (s2, w, h) => PENG.GENERATORS[job.generator].paint(s2, w, h, t.params, t.pal)
    : t.paint;
  if (job.against) {
    /* How much of the *picture* an effect changes, not how many bytes.

       An effect that draws six copies of the tile into the file and leaves the
       page looking identical passes a byte comparison and fails the only test
       that matters. `bloom` and `carve` both did: a generator opens by filling
       the whole tile, so each copy covered the one before it. */
    const plain = PENG.tile(Object.assign({}, opts, { params: undefined, effects: undefined }));
    const a = PSEAM.pixels(PSEAM.layout(plain.paint, 100, 100, 1, 1, 'a'), PX);
    const b = PSEAM.pixels(PSEAM.layout(paint, 100, 100, 1, 1, 'b'), PX);
    let n = 0, total = 0;
    for (let i = 0; i < PX * PX * 4; i++) {
      if (i % 4 === 3) continue;
      total++;
      if (Math.abs(a.px[i] - b.px[i]) > 8) n++;
    }
    out.push({ key: job.key || job.generator, moved: (n / total) * 100 });
    continue;
  }
  out.push({ key: job.key || `${job.generator}/${job.identity}`, off: incomplete(paint) });
}
process.stdout.write(JSON.stringify(out));
