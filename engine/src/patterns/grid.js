/* A grid of coloured cells, painted as one path per colour.

   Five generators here resolve the artwork onto a grid and paint the result:
   pixel compositions, quilt blocks, halftone cells, corrupted scan lines,
   terraced type. They all had the same two problems and this solves both once.

   **Hairlines.** Two rectangles that abut are anti-aliased independently, and
   where they are the same colour the shared edge composites to about three
   quarters of it — the top one lays down α of the colour and the bottom one
   lays (1−α) of it over what is left, which is not the same as laying down all
   of it. A solid patch forty cells wide came out ruled with a pale line between
   every row, visible at preview size, and no amount of rounding fixes it
   because the gap is not a gap. Every cell of one colour in a *single path* is
   rasterised in one pass, so the interior edges contribute full coverage and
   they disappear.

   **Size.** A hundred-cell tile is ten thousand rectangles. Run-length merging
   along each row and then collecting the runs into one path per colour takes
   that to one element per ink — which is also what a designer expects to find
   when they open the file: one shape to select and recolour.

   `get(i, j)` returns a colour index, or EMPTY for a cell the ground shows
   through. Indices are painted in ascending order, so a generator that wants
   one ink over another orders its palette rather than its loops. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PatternGrid = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const R3 = (v) => Math.round(v * 1000) / 1000;
  const EMPTY = -1;

  function cells(surface, W, H, cols, rows, get, colours) {
    const cw = W / cols, ch = H / rows;
    for (let k = 0; k < colours.length; k++) {
      let any = false;
      surface.beginPath();
      for (let j = 0; j < rows; j++) {
        let i = 0;
        while (i < cols) {
          const idx = get(i, j);
          let run = 1;
          while (i + run < cols && get(i + run, j) === idx) run++;
          if (idx === k) {
            // The rounded *next* edge, never the rounded start plus a rounded
            // width: the second one leaves a thousandth of a unit between some
            // pairs of rows, and a path whose subpaths do not quite meet is a
            // path with a crack in it.
            const x0 = R3(i * cw), x1 = R3((i + run) * cw);
            const y0 = R3(j * ch), y1 = R3((j + 1) * ch);
            surface.rect(x0, y0, x1 - x0, y1 - y0);
            any = true;
          }
          i += run;
        }
      }
      if (any) { surface.fillStyle = colours[k]; surface.fill(); }
    }
  }

  return { cells, EMPTY, R3 };
}));
