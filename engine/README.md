# The engine

Phase 0 of the plan. Takes one master SVG, a token file and a rules file, and
writes the whole logo package. There is no interface, on purpose. This is the
part everything else is built on, so it had to work before anything was drawn
around it.

## Run it

    cd engine
    npm install
    npm test                                            # 20 checks
    node src/cli.js measure projects/meridian/project.json
    node src/cli.js build   projects/meridian/project.json -o out

The Meridian example writes 62 files in about two seconds.

## What it measures

Nothing in the output is a number somebody typed. The engine reads it off the
artwork.

    ink box       109 × 109 (at 5.5, 5.5)
    clear space   27.25 units on every side
    thinnest stroke 9
    smallest use  32 px on screen, 9 mm in print
                  box 120 ÷ stroke 9 = 13.33 stroke widths across

**The ink box** is found by rendering the mark and reading the alpha channel, so
strokes, round caps and overlaps are all counted. The Meridian ring is r=50 with
a stroke of 9, so it paints out to 54.5 from the centre and measures 109 across.
Its viewBox says 120. Using the viewBox would have been wrong by ten percent.

**The minimum size** comes from the thinnest painted stroke, because that is the
first thing to disappear as a mark shrinks. The box is 13.33 stroke widths
across, so holding the stroke at 2.4 px puts the floor at 32 px, and holding it
at 0.675 mm puts the print floor at 9 mm. Move either rule and the floor moves
with it, which the tests check.

**Clear space** is a fraction of the measured ink height rather than of a radius,
because not every mark has a radius. For Meridian that is 27.25 units against
the 25 quoted in the specimen, since the specimen used r ÷ 2 and the engine uses
0.25 × ink height. The engine's number is the one that generalises. If you want
the specimen's exactly, set `clearSpaceRatio` to 0.2294.

## How a project is put together

    projects/meridian/
      project.json      tokens and rules
      mark.svg          the master
      wordmark.svg      outlined, so no font is needed at render time

Artwork marks its recolourable parts with `data-slot`:

    <circle data-slot="ink" ... stroke="#0A2A33" stroke-width="9"/>

A colourway then says what each slot becomes. `fill="none"` is never overwritten,
because it means the element deliberately has no paint. If a colourway forgets a
slot, the build says so rather than quietly producing a black shape.

Lockups are composed, not drawn. The wordmark is scaled so its ink height is
`wordmarkHeightRatio` of the mark's, and the gap is `lockupGapRatio` of the
mark's height. Every lockup therefore agrees with every other one by
construction.

## What it does not do yet

- **Normalising real Illustrator exports.** The masters here are clean. Open
  paths, clipping masks, embedded rasters and nested transforms are the risk the
  plan flags, and they are not handled. This is the next piece of work.
- **PDF and EPS.** `svg2pdf` goes in next for true vector output.
- **Transforms when measuring strokes.** A scaling transform on a stroked element
  would make `thinnestStroke` read low.
- **Icons, patterns and motion.** Those are later phases.

## Layout

    src/project.js    load and check a project file, with readable errors
    src/svg.js        viewBox, recolour by slot, compose documents
    src/geometry.js   ink box, clear space, minimum size, PNG rendering
    src/variants.js   measure the master once, then build each lockup
    src/naming.js     one naming rule for the whole package
    src/build.js      write the package, brand.json and the read me
    src/cli.js        the two commands
