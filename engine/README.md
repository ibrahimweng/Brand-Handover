# The engine

Phase 0 of the plan. Takes one master SVG, a token file and a rules file, and
writes the whole logo package. There is no interface, on purpose. This is the
part everything else is built on, so it had to work before anything was drawn
around it.

## Run it

    cd engine
    npm install
    npm test                                            # 20 checks
    node src/cli.js check   test/fixtures/messy-illustrator.svg --tokens projects/meridian/project.json
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

## The normaliser

Real artwork does not arrive clean, and the plan calls this the thing that will
break more builds than everything else combined. Every asset goes through the
normaliser before anything measures it, so a bad export fails at the door rather
than halfway through a build.

`handover check artwork.svg` reports on a file without building anything, and
exits non-zero if the artwork cannot be used. Findings come in three kinds.

**Must fix.** The engine refuses to guess and builds nothing.

- Live text, because it renders in a different font on any machine without your
  typeface, so a client gets the wrong wordmark and never knows.
- An embedded photograph or screenshot, because it blurs the moment anyone
  scales it.
- No viewBox and no width or height, because nothing can be measured against it.

**Worth a look.** It builds, and it tells you what may bite later: clipping
masks, masks, filter effects, gradients that colourways cannot repaint,
non-scaling strokes, and colours too far from the palette to be a slip.

**Fixed for you.** Done silently and then reported, so nothing is a surprise.

- **Illustrator metadata is stripped first.** Illustrator writes a metadata block
  referring to entities it never declares, such as `&ns_sfw;`. A strict parser
  stops there before it reaches any artwork. This was not a theory; it broke the
  first realistic fixture written for the tests.
- **CSS classes are inlined.** Illustrator paints through `<style>` rules rather
  than attributes, and the colour work reads attributes.
- **Nested transforms are flattened into the path data, and stroke widths are
  rescaled with them.** This is the one that matters most. A stroke of 4.5 inside
  a `scale(2)` prints at 9. Measured unflattened it reads 4.5, which would have
  halved the minimum size and let the mark ship too small.
- **Near-miss colours are snapped.** `#0B2A34` is one step from Deep `#0A2A33`.
  That is a slip, not a decision, and two nearly identical colours in one
  identity is the thing nobody spots until print.
- **Colour slots are assigned** by grouping the artwork by colour, so colourways
  have something to repaint.
- **Hidden layers and zero-size leftovers are removed**, because they are
  invisible but they widen the measured bounds.

The test that matters: a deliberately filthy export, with nested transforms, CSS
classes, a hidden layer, a zero-size rectangle, bad metadata and an off-by-one
colour, normalises to measure **exactly** the same as the clean hand-written
master. Same 109 × 109 ink box, same stroke of 9, same 32 px and 9 mm floor.

## What it does not do yet

- **PDF and EPS.** `svg2pdf` goes in next for true vector output.
- **Open path detection.** A path that is filled but never closed renders
  differently in some tools, and that is not checked.
- **Overlapping identical shapes.** Duplicate artwork stacked on itself measures
  correctly and still doubles the file size.
- **Icons, patterns and motion.** Those are later phases.

## Layout

    src/project.js    load and check a project file, with readable errors
    src/svg.js        viewBox, recolour by slot, compose documents
    src/geometry.js   ink box, clear space, minimum size, PNG rendering
    src/variants.js   measure the master once, then build each lockup
    src/normalise.js  clean an export and say plainly what was wrong with it
    src/report.js     write the findings for a designer, not for an engineer
    src/naming.js     one naming rule for the whole package
    src/build.js      write the package, brand.json and the read me
    src/cli.js        check, measure and build
