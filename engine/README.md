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
    node src/cli.js edit    projects/meridian/project.json -o editor.html
    node src/cli.js publish projects/meridian/project.json out/document.json -o page.html

The Meridian example writes 121 files in about four seconds, including both documents, the editor, the document it opens with, and that document published.

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

## The package

Every file is cut from the master when you press build.

    01-horizontal/  02-stacked/  03-mark/  04-wordmark/   20 lockups, 5 files each
    05-icons/       app and touch icons, favicons, and a multi-size .ico
    06-social/      profile, header and open graph crops
    brand.json      the whole system, machine readable
    guidelines.html the manual
    deck.html       the presentation
    README.txt      which file to use where, in plain words
    *.zip           all of the above, for the client to keep

**PDF is true vector**, not a rasterised picture, so a printer receives paths.
**The `.ai` file is the same bytes as the PDF**, because since version 9 an
Illustrator file is a PDF wrapper and Illustrator opens one without complaint.
The `.ico` is written by hand, since a whole dependency for 22 bytes of header
would be silly.

One trap worth knowing if you touch `src/pdf.js`. jsPDF ships a UMD bundle that
attaches itself to `window` when it finds one, so it must be required **before**
the jsdom globals exist or `require()` hands back nothing at all. svg2pdf reads
the DOM as it loads, so it must be required **after** they exist. And its UMD
wrapper then takes the browser branch, which looks for a global called `jspdf`
rather than requiring it, so that has to be handed over too. All three are
commented in the file.

## The two documents

Both read the same project and the same measurements, and they are not one
document in two shapes. The manual carries every value and edge case. The deck
holds one idea a slide and runs in the brand's own colours, because a
presentation is brand expression where a manual is reference. A test asserts the
deck is the shorter document, so a future change cannot quietly turn it into a
reflow.

The blocks that draw them live in `src/documents/blocks.js`. Two rules hold
there, both learned the hard way when the deck first rendered:

- **A block styles its own text.** A diagram that needs the host page's
  stylesheet is not a block, it is a fragment that works in one document.
- **A block takes the ink colour it should draw in.** The first version assumed
  the manual's ground, so on a dark slide the mark was drawn in the background
  colour and simply vanished.

Both are covered by tests.

## The loop

This is the whole point, and it is checked in the suite. Thicken the ring in
`mark.svg` from 9 to 14 and rebuild:

    ink box       109 → 114
    clear space   27.25 → 28.5
    minimum size  32 px → 21 px,  9 mm → 5.8 mm

`brand.json`, `guidelines.html` and `deck.html` all say the new numbers, because
none of them holds a copy of the old ones.

## The canvas editor

`editor.html` is a single self-contained file. Open it in a browser and it
works: no server, no build step, no script fetched from anywhere. The project
bundle, the model and the renderer are all inlined, which a test enforces.

It is page layout, not illustration. Fixed page sizes, a grid, and a known set
of blocks. **There is no pen tool on purpose**, because vector drawing belongs
in Illustrator and the mark arrives here finished. Holding that line is what
turns an eight week job into something usable.

    drag              move, snapped to the grid
    alt drag          ignore the grid
    shift click       multi select, or drag a marquee
    double click      edit text where it sits
    arrows            nudge, shift for four steps
    cmd Z / shift Z   undo and redo, sixty deep
    cmd D             duplicate
    cmd A             select everything on the page
    delete            remove

Blocks come in two kinds, and the properties panel says which one you have
selected.

**Plain blocks** are text, a rule, a fill and an image slot. Ordinary furniture,
and yours to arrange.

**Derived blocks** draw themselves from the project: the mark, any lockup, the
construction drawing, clear space, minimum size, the palette, the contrast
table, the type specimen and the asset index. You set where one sits and what it
is painted in, and nothing else. Change the master and every one of them
redraws. A colour chip row in Figma is six rectangles somebody has to update by
hand. Here it is one block that is always current, and that difference is the
reason this is worth building rather than making a nice template.

### One renderer

`src/editor/render.js` is pure string building against a precomputed bundle. It
needs no DOM, no native module and no measuring at draw time, so **the same file
runs in the editor and on the server**. A test asserts the editor inlines the
renderer that is on disk, so the canvas and the published page cannot drift
apart. That was the whole argument for editing real DOM rather than drawing to a
canvas, and this is where it gets paid.

`src/editor/model.js` is the same: one file, UMD, so Node and the browser cannot
disagree about what a document is. Every change goes through `ops`, which is why
undo is a stack of whole documents and no operation has to know undo exists.

### Publishing, and why the loop is now closed

The editor has **Open**, **Save JSON** and **Publish**. Publish writes a
standalone page: the pages at their real size, a print stylesheet sized to the
page so Cmd+P gives an exact PDF, and no dependency on the editor at all.

`src/editor/publish.js` is the same UMD arrangement as the renderer, so the
Publish button in the browser and `handover publish` on the server run the same
code. That is tested by publishing an identical document in both places and
comparing: **byte identical**.

The loop it closes is this. A document holds layout and words. It holds no
measurements at all, which a test checks by looking for them in the JSON. Every
number comes from the bundle at publish time. So:

    handover publish project.json document.json -o a.html
    (thicken the ring in mark.svg from 9 to 14)
    handover publish project.json document.json -o b.html

    ink box     109 → 114
    min size    32 px → 21 px

Same document, same layout, new numbers. A block somebody nudged to `x: 40`
is still at 40. Edit the mark at eleven at night and every page is right by
morning without anyone reopening the editor, which is the thing the whole
project was for.

One trap, now covered by a test. `publish.js` contains a `</script>` in the page
it generates. Inlined into the editor that closed the editor's own script block
early and took the rest of the file with it, so it is escaped in the source. The
test refuses a raw closing tag in any file that gets inlined.

### What the editor does not do yet

- **Image slots are placeholders.** Dropping a file in is not wired up.
- **No rule blocks.** The pattern, the icon grid and the motion curve are the
  third kind of block from the specimen and none of them is built.
- **One page size.** 1280 by 720 for everything, print sizes included.

## What it does not do yet

- **CMYK output.** The conversion on the page is arithmetic from hex. Real print
  work soft proofs through an ICC profile, and that is the Typst path in the plan.
- **EPS.** Rarely asked for now that print shops take PDF, but not written.
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
    src/contrast.js   WCAG ratios and CMYK, computed rather than typed
    src/pdf.js        true vector PDF, and the .ai that is the same bytes
    src/export.js     icons, favicons, social crops and the zip
    src/documents/    blocks.js, chrome.js, index.js (manual), deck.js
    src/editor/       model.js, render.js, publish.js, app.js, bundle.js, emit.js
    src/naming.js     one naming rule for the whole package
    src/build.js      write the package, brand.json and the read me
    src/cli.js        check, measure and build
