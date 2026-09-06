# The engine

Phase 0 of the plan. Takes one master SVG, a token file and a rules file, and
writes the whole logo package. There is no interface, on purpose. This is the
part everything else is built on, so it had to work before anything was drawn
around it.

## Run it

    cd engine
    npm install
    npm test                                            # 339 checks
    node test/print-check.mjs                           # prints, and measures the paper
    node test/treatment-check.mjs                       # renders, and reads the pixels back
    node test/typst-check.mjs                           # the printed piece against the published page
    node src/cli.js check   test/fixtures/messy-illustrator.svg --tokens projects/meridian/project.json
    node src/cli.js check   my-icon.svg --icon projects/meridian/project.json
    node src/cli.js check   projects/meridian/project.json --print
    node src/cli.js print   projects/meridian/project.json out/document.json -o print
    node src/cli.js licence
    node src/cli.js measure projects/meridian/project.json
    node src/cli.js build   projects/meridian/project.json -o out
    node src/cli.js edit    projects/meridian/project.json -o editor.html
    node src/cli.js publish projects/meridian/project.json out/document.json -o page.html
    node src/cli.js build   projects/halyard/project.json  -o out-halyard
    node src/cli.js build   projects/kvist/project.json    -o out-kvist
    node src/cli.js build   projects/hallward/project.json -o out-hallward
    node src/cli.js build   projects/northline/project.json -o out-northline
    node src/cli.js build   projects/perigee/project.json   -o out-perigee
    node src/cli.js build   projects/maayan/project.json    -o out-maayan
    node src/cli.js build   projects/thornbury/project.json -o out-thornbury
    node src/cli.js build   projects/cusp/project.json      -o out-cusp
    node src/cli.js build   projects/fathom/project.json    -o out-fathom
    node src/cli.js build   projects/spire/project.json     -o out-spire
    node src/cli.js build   projects/vesper/project.json    -o out-vesper
    node src/cli.js build   projects/marlow/project.json    -o out-marlow
    node src/cli.js build   projects/beaumont/project.json  -o out-beaumont
    node src/cli.js build   projects/yarrow/project.json    -o out-yarrow
    node src/cli.js build   projects/saltmarsh/project.json -o out-saltmarsh

The Meridian example writes 138 files in about six seconds, including both
documents, the editor, the document it opens with, that document published, and
the pattern at every density in every colourway.

Halyard is the second identity, kept in the repo because everything above was
written against the first one. It has four faults left in on purpose and it
writes 62 files, saying what each fault is and what to do about it. See
[A second identity](#a-second-identity).

Kvist & Sønn is the third, and it is the one that is shaped wrong on purpose:
fills and a stroke in the same mark, a box 252 by 90 with its origin at minus
six, a name that is not spellable in ASCII, and no mark lockup at all. See
[A third identity](#a-third-identity).

Hallward Press is the fourth, and it is the one with nothing in it: an ink, a
paper, one colourway, one typeface, no system block, and a seal drawn in a 2048
unit box. See [A fourth identity](#a-fourth-identity).

Northline is the fifth and the opposite: twelve colours, eight colourways, four
typefaces, 245 files, and a mark written the way a drawing tool actually writes
a repeated element. See [A fifth identity](#a-fifth-identity).

Perigee is the sixth, and it differs in what the *file* is rather than what the
identity is: a mark exported the way a web tool writes one. See
[A sixth identity](#a-sixth-identity).

מעיין is the seventh: named in Hebrew, written in Hebrew, and reading right to
left. See [A seventh identity](#a-seventh-identity).

Thornbury Mills is the eighth, and the first that is *damaged* rather than
merely unfamiliar: a file that has been edited by three people since 1998. See
[An eighth identity](#an-eighth-identity).

Cusp is the ninth, where the thin part is the project file rather than the
artwork. Fathom is the tenth, whose graphic language *is* the pattern. Spire is
the eleventh, and it is a tower: 76 wide by 358 tall, six colour slots, the
first mark in the repo that is not roughly square. See
[An eleventh identity](#an-eleventh-identity).

Vesper is the twelfth, and it is the first mark in the repo that is not flat
colour: its ring is a three stop gradient, which is the one thing a colourway
cannot express. See [A twelfth identity](#a-twelfth-identity).

Marlow is the thirteenth, and it is a logotype and nothing else — no symbol at
all, which the engine refused outright. See
[A thirteenth identity](#a-thirteenth-identity).

Beaumont & Whitcombe Rare Books is the fourteenth, and the artwork is
deliberately dull: what it varies is the **writing**. See
[A fourteenth identity](#a-fourteenth-identity).

Yarrow is the fifteenth, and the first to declare all four rule blocks — the
pattern, the photography treatment, the icon grid and the motion. See
[A fifteenth identity](#a-fifteenth-identity).

Saltmarsh is the sixteenth, and the first identity in the repo with a
**photograph** in it. See [A sixteenth identity](#a-sixteenth-identity).

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

An identity in its second version points at the package its first version
produced, and the build reports what moved between them:

    projects/tarnbrook/
      project.json      "version": "2.0.0", "previous": "previous/brand.json"
      mark.svg          the new artwork
      wordmark.svg
      previous/
        brand.json      copied out of the package that shipped as 1.4.0

Colours that are read together and have to be told apart are named as a set, and
what tells each of them apart other than its colour is named beside it:

    "tokens": {
      "sets": {
        "states": {
          "of": ["clear", "prepare", "act"],
          "why": "shown together on every gauge board and roadside sign",
          "apartBy": { "clear": "an open ring", "prepare": "a half ring",
                       "act": "a solid disc" }
        }
      }
    }

A set whose colours collapse for some readers and which has no second channel is
refused. `rules.minColourSeparation` is the distance below which two colours stop
being reliably different, in CIE ΔE*ab; it defaults to 12 and moves like every
other rule here.

An identity whose mark appears beside somebody else's carries their artwork, one
file per ground they have agreed to stand on:

    projects/kilnsey/
      project.json      "rules": { "partners": { "with": "horizontal", … } }
      mark.svg
      partners/
        ingleby.svg           their version for our light ground
        ingleby-reverse.svg   their version for our dark one

`assets.partners` names each one, who owns it, and which of our colourways each
of their files is for. The pairs are written to `11-partners`, each with a
minimum size of its own, and a colourway they have not supplied a version for is
not made: recolouring somebody else's mark to fit this palette is the one thing
a partner lockup may never do.

`previous` takes the brand.json from the root of the earlier package, whole and
unedited. What comes back is `CHANGES.txt`, chapter 00 of the manual and a
`changes` block in this version's own brand.json — the floor, clear space,
colours, lockups, colourways, contrast verdicts and the icon grid, with the ones
that retire something the client already holds separated from the ones that only
add. A previous package for a different brand, or carrying a version that is not
earlier than this one, is refused rather than compared.

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

## Licences, and what the client owns

**There is no server in this project, so there is no billing in it.** Sign up,
take a card, handle a webhook, revoke on non-payment: all of that is a server,
and none of it is here. What is here is the half that has to be settled before
a server is worth writing — what the plans are, what each permits, how a
permission is proved, and what the client ends up owning.

**With no vendor key set, nothing is limited.** That is deliberate rather than a
gap. This is being built for one studio's own work first, and a tool that
refuses to run your own job on your own machine because nobody has decided to
sell it yet is a tool you route around. Set `HANDOVER_LICENCE_KEY` to a public
key and the limits below become real, everywhere at once.

    handover licence --keypair ~/keys          # once, for whoever issues licences
    handover licence --issue --key ~/keys/handover-licence.key \
      --holder "Weng Studio" --plan solo --expires 2027-09-01
    handover licence                           # what this engine thinks it has

    trial      1 projects,   2 colourways,   2 lockups  publish
    solo       8 projects,   6 colourways,   6 lockups  print, mockups, publish
    studio   any projects, any colourways, any lockups  print, mockups, publish

A licence is signed with Ed25519, so it cannot be forged or edited. Change the
plan from `solo` to `studio` in the file and the engine says so:

    The signature does not match what the licence says, so one of them has
    been edited since it was issued.

Every field is covered, not just the plan — a test walks the holder, the expiry,
the seat count and the email and checks each one breaks the signature. And
running out is reported as a different thing from being forged, because those
are two different support conversations.

A limit that is hit reads like every other refusal in this engine, because it is
one:

    ✗ This project has 5 colourways, and Trial covers 2.
      Trial is enough to run one identity end to end and see whether the
      thing works.
      → Cut it to 2, or move to a plan that carries more.

### What this is not

**A signature is not a lock.** The engine runs on the designer's own machine, so
anybody can edit it, and a determined person will. What a signature buys is that
a licence cannot be forged or quietly upgraded, so a support conversation is
about facts rather than claims. Real enforcement, on the day it matters, is a
server refusing to generate the package at all — and that is also where the card
gets taken.

**What a server would still need**, in the order it would get written:

- accounts, sessions, and a project store, so a licence attaches to somebody
- a payment provider's checkout and its webhooks, so a plan changes when a card
  does, and lapses when it does not
- the build running server side, so the entitlement check is somewhere the
  customer cannot edit
- a licence endpoint the engine can ask, with an offline grace period, so a
  designer on a train is not locked out of their own work

None of that is written, and none of it should be until there is a reason.

### What the client gets

The whole argument against the tools this replaces is that **the client inherits
the designer's subscription**. So the package says, in the package, that they do
not. Every build writes `LICENCE.txt`:

    WHAT YOU HAVE
      Every file in this package is yours. [...] Nothing here calls home and
      nothing stops working.

    WHAT YOU DO NOT NEED
      An account. A subscription. This tool. [...] It is not inherited by you,
      and it does not expire.

    WHAT IS NOT OURS TO GIVE
      Typefaces are licensed separately by whoever made them [...] The same
      goes for any Pantone reference quoted in the documents.

Beside it, `usage.json`: what was actually made, counted off the build rather
than estimated, so an invoice and the package agree with each other. And
`brand.json` records the plan and licence fingerprint a package was built under,
or `null` when nothing was enforcing.

## The package

Every file is cut from the master when you press build.

    01-horizontal/  02-stacked/  03-mark/  04-wordmark/   20 lockups, 5 files each
    05-icons/       app and touch icons, favicons, and a multi-size .ico
    06-social/      profile, header and open graph crops
    07-pattern/     the pattern, every density in every colourway
    brand.json      the whole system, machine readable
    LICENCE.txt     what the client owns, which is all of it
    usage.json      what was made, for whoever is invoicing
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

## Print colour

**CMYK is a decision, not a conversion.** Every naive hex-to-CMYK formula,
including the one this engine ships in `contrast.js`, is arithmetic on numbers
that mean something else: sRGB describes light leaving a screen, and CMYK
describes ink sitting on a particular paper under a particular press. Nothing in
a hex code knows which paper. So a brand's builds come from the designer or
their printer, the project carries them, and where they have not been given the
engine says so rather than inventing four numbers that will print a different
colour to the one everybody signed off.

    "deep": { "hex": "#0A2A33", "pantone": "5467 C", "cmyk": [88, 58, 45, 72] }

**The PDFs in the package are then genuinely DeviceCMYK.** Not converted at the
end, not a claim in a read-me: the operators in the file are `k` and `K`, with
the declared values.

    $ node -e '...pull the operators out of 01-horizontal/...-deep.pdf'
    ["0.88 0.58 0.45 0.72 K", "0.88 0.58 0.45 0.72 k"]

svg2pdf reads the hex out of the artwork and hands jsPDF three numbers, which
become a DeviceRGB operator. `src/pdf.js` wraps the two colour setters, and
where the project has declared what a colour is in ink, answers that call with
four numbers instead. Done by wrapping rather than by rewriting the finished
stream, because the stream is compressed and svg2pdf is entitled to call those
setters however it likes. **A colour with no declared build falls through
untouched and stays RGB**, which is the honest outcome.

### What gets checked

`handover check project.json --print` is the pre-press pass.

**Total ink coverage.** Ink laid over ink has to dry, and past the limit for the
stock it does not: the sheet offsets onto the next one in the stack and the job
is reprinted at somebody's cost. Coated takes 300%, uncoated 260, newsprint 240.

    ✗ slate lays down 310% ink, and coated stock takes 300%.
      → Take 10% out of the build, usually from cyan.

**Rich black.** 100 K alone is a thin, washed-out dark grey over anything larger
than a word, because one pass of black ink does not cover. Print work backs it
up with the other three and keeps the plain build for small text, where a rich
black goes fuzzy if the plates are a hair out of register.

    ! deep is 0/0/0/100, which is a plain black.
      → Back it up to about 240% total, for instance 60/40/40/100.

**A build that was never given.** A blocker for press, a warning otherwise. A
guessed build is never audited for coverage or blackness, because there is
nothing there to audit: nobody chose those numbers.

The manual and the editor both mark a guess with a question mark and say which
colour it is, since a chip that shows given and guessed the same way is exactly
how a guess ends up on a press.

### A printed piece, through Typst

The last thing left over. The logo assets go to a press and are already in ink.
The documents go through Chrome and are RGB, which is right for what they are.
What was missing is a piece laid out **on the canvas** that is going to a press:
a poster, a cover, a card.

    handover print project.json document.json -o print --fonts ~/fonts

writes a `.typ` file and, if a `typst` binary is about, compiles it. Every page
comes out at its real size, with bleed and crop marks if the document has them,
and **every declared colour as ink**:

    colour ops: ["0.03 0.03 0.08 0 k", "0.88 0.58 0.45 0.72 k", ...]
    any RGB? false

**Typst places an SVG as vector but paints it in RGB.** That was the finding
that shaped the whole thing: an embedded mark would arrive on a CMYK page in a
different colour space, and the press would convert it however it liked — the
exact uncontrolled conversion the print path exists to prevent. So the mark is
not embedded. It is **redrawn from the same path data the canvas uses**, as
Typst curves, in declared ink.

`src/paths.js` does the translating: arcs and quadratics have no equivalent in
Typst's `curve`, so they are converted to cubics, and group transforms are
composed rather than ignored — a lockup keeps its parts in transformed groups,
and paths scraped out without them draw on top of each other.

### Two emitters, and the check that they agree

This is the second emitter in a project whose whole argument is that there is
one. That risk is real and it gets a check rather than an assurance.
`test/typst-check.mjs` compares three things:

    ok  the mark redraws to the same shape
        2 paths, 2 of 2720000 pixels differ at an edge, worst 16, 0 structural
    ok  the wordmark redraws to the same shape
        1 path, 237 of 318000 pixels differ at an edge, worst 64, 0 structural
    ok  the printed page matches the published page
        576 areas, mean 0.59 of 255, worst 9.0  (the whole page previews 5.7
        off, which is the ink build differing from the screen colour, as it should)
    ok  the printed piece is entirely in ink
        4 distinct colours, 0 of them screen colours

A pixel solid in one render and empty in the other is a shape error; everything
else is a curve's edge being antialiased by two different rasterisers. The page
comparison deliberately ignores absolute brightness, because a declared build
and the hex beside it are **different colours on purpose** — what is being asked
is whether the same thing is in the same place.

Two things hold the drift down besides the check. The emitter handles a
deliberately small set of blocks — fill, rule, text, mark, lockup, slot,
pattern — and **refuses the rest by name** rather than half-drawing them:

    left out, because a printed piece is not a manual: 1 construction,
    1 clearSpace, 1 minimumSize, 1 palette, 1 contrast, 1 photography,
    1 iconGrid, 1 motion

And copy is emitted as a Typst **string**, not a markup block. A markup block
reads `*stars*` as bold and `_underscores_` as italic, so a line of copy would
come out of the press styled differently from the same line on the canvas. That
is drift in its purest form, and it was in the first version.

### What it will tell you

- **Which fonts it needs**, and that Typst substituted when it could not find
  them. A substituted font in a printed piece is not a small problem.
- **Any colour with no declared build**, written as screen colour and named, with
  a pointer at `check --print`.
- **A photograph**, placed as given. A press converts those itself, which is
  normal and correct: nobody specifies a photograph in ink percentages.

### A correction to the plan

The plan said Typst would be the print path, because Chrome writes RGB and a
printer wants CMYK. That was the wrong shape of answer. The files that go to a
press are the **logo assets**, and those are generated here with jsPDF rather
than by Chrome, so they can be written in ink directly. Chrome only prints the
documents, and nobody sends a brand manual to a four-colour press.

So Typst was not needed for the thing that mattered. It was needed for a
printed piece laid out **in the editor**, which is the section above.

### What this is not

- **Not PDF/X.** A valid DeviceCMYK PDF, with no OutputIntent and no embedded
  ICC profile. For a logo asset with specified builds that is the right file:
  the values are absolute ink percentages and the press uses them as given. A
  job demanding PDF/X-1a compliance needs the profile embedded, which is a
  licensing question before it is a code one.
- **No ICC conversion.** Nothing here transforms sRGB into a press profile,
  because doing that properly needs a colour management module and a profile
  for the actual press. The engine's position is that the transform is the
  printer's job and the numbers are the designer's.
- **No spot plates.** A Pantone reference is carried as text. Making it a real
  `/Separation` colour space with its own plate is a different PDF than jsPDF
  will write.
- **Documents print RGB.** `guidelines.html` and `deck.html` through Chrome are
  RGB, which is correct for what they are.

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

Blocks come in three kinds, and the properties panel says which one you have
selected.

**Plain blocks** are text, a rule, a fill, an image slot and a mockup. Ordinary
furniture, and yours to arrange. The last two have something to say, and they
are below.

**Derived blocks** draw themselves from the project: the mark, any lockup, the
construction drawing, clear space, minimum size, the palette, the contrast
table, the type specimen and the asset index. You set where one sits and what it
is painted in, and nothing else. Change the master and every one of them
redraws. A colour chip row in Figma is six rectangles somebody has to update by
hand. Here it is one block that is always current, and that difference is the
reason this is worth building rather than making a nice template.

**Rule blocks** are the pattern, the icon grid and the motion curve. See below.

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

## Rule blocks, the third kind

A derived block reads a measurement. A rule block reads a **decision**. You make
it once, the project stores it, and from then on the engine generates every
instance without asking again. That is the difference between a pattern in a
brand manual and a pattern in a brand system: one is a picture of a decision,
the other is the decision.

There are four, and each is one decision.

### The pattern

The decision is *which shape*. Mark it in the master and nothing else is needed:

    <path data-pattern="source" d="..."/>

The engine will not pick one for you. Guessing which part of a mark is the motif
is a taste judgement, and a wrong guess produces a plausible pattern that is
quietly not the brand's. With nothing marked, the build says so and tells you
what to add.

From that one shape it cuts a seamless tile — two rows, the second dropped by
half, so the field reads as movement rather than as stripes — at every density
in every colourway. Fifteen files for Meridian, none of them drawn.

**A colourway that fails contrast is refused rather than drawn faintly.** Beacon
on Chalk measures 1.83:1, so the tile is not written and the build says why. A
pattern nobody can see is worse than no pattern, because it ships.

### The icon grid

The decision is the box, and everything else comes off the mark:

    24 box · 21.8 live · 1.8 stroke · curve r 30
    from the mark: viewBox 120, margin 5.5, stroke 9

The stroke is the mark's own stroke as a fraction of its box. The live area is
the mark's own margin. So an icon set drawn to this grid looks like it came from
the same hand as the mark, because arithmetically it did. Any of it can be
overridden in `project.json`; what is overridden stays overridden and the rest
still follows the artwork.

Then the rule does the part that actually matters:

    node src/cli.js check my-icon.svg --icon projects/meridian/project.json

Exporting an icon at eight sizes is easy. Rejecting the ninth icon whose stroke
is wrong is the part that keeps a set coherent, and by the twentieth icon a
machine is the only thing still checking. A wrong stroke or the wrong artboard
is a blocker. A butt cap, a mitred corner, a filled shape in an outline set, or
a drawing that reaches outside the live area is worth a look.

Two things this gets right that a naive version does not, both found by testing
rather than by thinking:

- **Paint is inherited.** Every drawing tool hangs `stroke` and `stroke-width`
  on the `<svg>` or on a `<g>` and lets the shapes inherit them. Reading only
  what is on the shape itself finds no strokes at all, so an icon with the wrong
  weight passes silently — which is worse than not checking.
- **An arc's radii are not points.** `A30 30 0 0 1 21 9.5` carries a radius of 30
  in the same number stream as the coordinates. Scraping numbers reads that as a
  point 30 units across and fails a perfectly good icon on a 24 unit grid.

### Motion

The decision is the easing pair and how the mark builds. The rule then splits
the artwork the only way that generalises: **what is stroked is the outline,
what is filled is the fill.** The outline settles, then the fill rises to its
line inside a clip of the mark's own measured ink box, so it fills up rather
than sliding past. `prefers-reduced-motion` turns it off.

    400ms out · 600ms through · outline, then fill

The first version translated the whole mark as one piece, which is a slide, not
a build. Splitting it is what makes the rule a rule rather than an animation
somebody made once.

### Photography

The plan filed this under photography and moved on, as though a treatment were
a matter of taste. Most of it is. The direction is the designer's forever, and
nobody misreads a photographic brief. What people get wrong is the mechanical
half, and the mechanical half is arithmetic.

The decision is a duotone, a scrim, and the ratios photography is allowed to be
cropped to:

    "photography": {
      "duotone": { "shadow": "primary", "highlight": "ground", "amount": 0.82 },
      "scrim":   { "colour": "primary", "opacity": 0.42, "direction": "bottom" },
      "ratios":  ["3:2", "16:9", "1:1", "4:5"]
    }

**It is drawn with an SVG filter and a CSS gradient, not by rewriting pixels,
and that is the whole reason it is a rule.** The stored photograph is never
touched, so changing the recipe once changes every image in every document, and
the same markup draws it in the editor, on a published page and in print.
Baking it into the file would give you a picture of a decision instead of the
decision.

A duotone is a greyscale ramped between two brand colours: `feColorMatrix
saturate 0`, then `feComponentTransfer` mapping the one remaining value onto a
line from the shadow colour to the highlight. Held in sRGB on purpose, because
that is the space the two colours were picked in. An `amount` below 1 composites
some of the original back, which is how a treatment reads as a grade rather than
as a poster.

### The mark on a treated photograph

The check from the image slots section had to be rebuilt for this, and it got
much better in the process.

Sampling the raw file is now wrong: what is on the page is the treated image,
so the check works on the **treated** pixel. `src/photography.js` computes what
the filter will produce, and the gradient scrim is read at the point the mark
actually sits rather than averaged, because a scrim strong at the bottom is
absent at the top and a single number for it is true nowhere.

Then the useful part. Working out how much scrim a particular picture needs is
what an opacity slider is for, and it is guesswork on one person's screen. Here
it is a number:

    1.79:1 on the picture
    The mark measures 1.79:1 against the lightest part of the photograph under
    it. Either turn the scrim on this image up to 80%, which takes it to
    3.13:1, or use the primary colourway, which measures 5.54:1.

Set it to 80 and the warning goes. When the rule's own scrim cannot get there,
it says which of the two reasons it is — the gradient does not reach that far up
the frame, or a scrim in the mark's own colour can never separate them, however
strong:

    Either use a flat 50% primary scrim here, since the gradient from the
    bottom does not reach this far up (3.12:1), or use the primary colourway.

A crop that drifts off the allowed ratios is reported with the box that fixes
it, because a set of photographs stops looking like a set one box at a time.

### Two implementations of one thing

The treatment is drawn by a browser and computed in JavaScript, and the second
is only worth having if it agrees with the first. `test/treatment-check.mjs`
renders through the real filter, reads the pixels back, and compares:

    ok    duotone, full                (worst channel off by 1)
    ok    duotone at 60%               (worst channel off by 1)
    ok    duotone into the accent      (worst channel off by 1)
    ok    scrim from the bottom        (worst channel off by 1)
    ok    scrim from the flat          (worst channel off by 0)

One off in 255 is rounding. It earned its place immediately: a flat scrim was
being painted as a bare hex, so a 42% scrim rendered solid while every number
the editor reported assumed 42%. Nothing in the unit tests could have seen that,
and nobody would have noticed by eye until a photograph disappeared under a wash
of Deep.

### On the page

Place a rule block, choose which instance to show, and you are done. The panel
shows an amber **set once by you** badge and offers only the instance: density,
ink, ground, and whether the block states its rule underneath. To change the
rule itself you edit the project, not the block — which is the whole point, and
why the panel says so rather than letting you drift.

The loop closes here too. Thicken the ring in `mark.svg` from 9 to 14 and the
icon stroke goes 1.8 → 2.8, the live area 21.8 → 22.8, and an icon drawn to the
old rule becomes a blocker. A test asserts exactly that, because a rule that
remembers an old master is not a rule.

### Mockups

The mark on a business card, a sign, a van door. Done properly this is not a
picture of a card with a logo pasted flat on it: it is the artwork **mapped into
the surface the photograph shows**, so it takes that surface's perspective, its
shadows and its creases.

Drop a photograph on a mockup block, then drag the four corners onto the thing
in the picture. The mapping is a homography, the one projective transform that
takes a rectangle to four arbitrary points, and CSS applies it directly with
`matrix3d` — so the canvas and the published page do it the same way, and
nothing is baked into the photograph. A check drives a browser and confirms the
corners land where the arithmetic says: worst case, nine hundredths of a pixel.

The shading comes from the photograph rather than from anywhere else, through a
blend mode. That is what puts the paper's tooth and the bag's creases into the
logo instead of leaving it sitting on top like a sticker.

### What a mockup refuses

**A blend can only move a colour one way.** Multiply never lightens; screen
never darkens. So light artwork multiplied onto a light surface is not faint,
it is arithmetically invisible, and no amount of dragging the opacity slider
will help. The editor samples the surface under the artwork, through the same
mapping the artwork uses, and says so:

    1.16:1 on the surface
    The artwork measures 1.16:1 against the surface, blended multiply. Multiply
    can only darken, so light artwork on a light surface has nothing to darken
    and disappears. Use the primary colourway, which measures 10.88:1.

It tries every blend and every colourway against those same pixels and names
the one that reads best. Take the advice and the warning goes.

Two more. **Corners that fold over each other** have no single mapping, so the
artwork comes out torn — that is a blocker, and nothing else is worth saying
about a torn mapping. And if you tell it what the surface is in the real world,
**the mark is checked against its own floor**: on a pen barrel 8 mm across, a
mark whose floor is 9 mm is going to close up on the object, not on the mockup.

One bug worth recording, because it would have looked like a mystery. A browser
starts its own image drag the moment the pointer moves across a picture, and
that swallows every event after it — the corner simply stops following, and no
error is raised anywhere. Short drags worked and long ones did not, which is
the least helpful symptom a bug can have. `draggable="false"` on every
photograph the renderer emits, and refusing the default on pointer down. It was
latent in image slots too.

### Image slots

Drop a file on a slot, or choose one from the panel. Then fit (cover or
contain), a focal point, and a caption set in the brand's own caption style.
The image is resampled once on the way in, to a long edge of 2400, because a
photograph off a phone is four thousand pixels wide and no page here can show
more than a fraction of that.

**The bytes live beside the document, never in it**, and that is the whole
design rather than a detail. Undo is a stack of whole documents cloned sixty
deep, and the editor writes the document to localStorage on every nudge. A
photograph inlined into a block would be cloned sixty times and rewritten on
every arrow key. So a block holds an id, the bytes live in a store keyed by
content, and nothing that happens on the canvas touches them. A test asserts
that no `data:` string ever appears inside a document.

Which leaves one trap, and it is the reason the store does not prune eagerly.
Delete a block and press undo: the photograph has to come back, and undo is a
stack of past documents the store cannot see. So the store only grows while a
session is open, and pruning happens at the two moments nothing can be undone
into — when a document is opened, and when one is written out. Save JSON writes
one file with the images the document uses inside it, and `handover publish`
reads that same file.

Two things get checked, both in the same voice as the rest of the engine.

**An image too small for its box.** Two pixels for one is the working standard,
so a 420 wide block wants 840. A 600 px photograph in it is reported with both
numbers, because "it looks a bit soft" is not something anyone acts on.

**The mark on a photograph.** This is the one from the plan:

> Nobody misreads a photographic brief. They put the mark on a bright sky at
> 1.1 to 1, and that is arithmetic on the pixels underneath it.

So the editor does the arithmetic. When a mark or a lockup with no ground of
its own sits over an image, the pixels under its footprint are sampled through
the same object-fit maths the browser uses, in a grid of patches rather than as
one average — a mark over a sky that is bright in one corner fails in that
corner while the mean looks fine. The worst patch is what gets reported, at
3:1, which is the WCAG figure for a shape rather than for words.

    1.06:1 on the picture
    The mark measures 1.06:1 against the lightest part of the photograph
    under it. Use the ground colourway here, which measures 13.64:1, or move
    the mark to a quieter part of the picture.

It names the colourway that would work by measuring every one of them against
the same pixels. Switch to it and the warning goes.

Two things this needed that were not obvious. A mark block used to paint its
own ground, so a mark over a photograph was really a mark on a rectangle on a
photograph and the check was measuring pixels nobody sees; `on` now takes
**none**. And `src/contrast.js` became UMD, because the alternative was a second
copy of the WCAG arithmetic in the browser to disagree with the first.

### Page sizes

Nine named sizes, from a 16:9 slide to A4, A5, US Letter and a square. One for
the document, and any page may override it, which is how a fold-out or a
full-bleed cover lives in the same file as everything else.

**Layout is in pixels; printing is in millimetres.** 794 px is only A4 by
accident of 96 dpi, and a printer has to be told 210 mm or it will fit the page
to whatever paper it has. So a size carries both, and the `@page` rule gets the
physical one:

    A4 portrait        794 × 1123 px on screen      @page size: 210mm 297mm
    US Letter          816 × 1056 px on screen      @page size: 8.5in 11in
    Slide 16:9        1280 ×  720 px on screen      @page size: 1280px 720px

A document that mixes sizes gets one plain `@page` rule for the size most of its
pages use, and a named rule for every other one. That ordering is deliberate: a
browser that does not support named pages still prints the bulk of the document
at the right size instead of all of it at the wrong one.

`test/print-check.mjs` drives a browser, prints, and reads the MediaBox back out
of the PDF, because the CSS assertions in the suite only prove the right rule
was written. A document of four A4 pages comes out 209.9 × 297.0 mm four times,
and a document that mixes three sizes comes out at three sizes.

**Changing the size scales the layout rather than throwing it away.** Both
directions scale by the same factor, so nothing is stretched, and then anything
that was against an edge is put back against it. That last rule is what keeps a
full-bleed cover full bleed and a footer on its baseline; a plain proportional
scale leaves both floating a few pixels inside the page. "Keep positions" is
offered for anyone who would rather redo it themselves.

### Bleed, trim and crop marks

A printed page is three boxes, and confusing them is how a job comes back with
a white line down one side.

    trim    the finished page. 210 by 297 for A4, and the space every block's
            x and y is measured in.
    bleed   trim plus a margin all round, usually 3 mm. Anything meant to reach
            the edge has to be painted out to here, because a guillotine cutting
            a stack of paper is accurate to about a millimetre.
    media   the sheet that goes through the press: bleed plus room for the marks
            that tell the finisher where to cut.

Set the bleed once for the document and the rest follows. `@page` grows to the
media size in real units, the marks are drawn at the four trim corners with the
bleed as the gap between mark and artwork, and the page on screen stays the trim
size, because a reader has no use for a bleed.

**The awkward part is that a designer draws to trim and the printer needs
bleed**, so something has to paint outside the page. Asking for that by hand
means a block at `x: -11.34` with a width of page plus 22.68, which breaks the
grid, breaks the resize, and gets forgotten on the one page that matters. So the
rule is the one the resize already uses: **a block that touches an edge is meant
to run off it**, and the system paints it out.

Only what can bleed does. A photograph or a colour field running off the page is
what bleed is for; a line of type doing it is a mistake, and quietly widening
its box would move centred text. So `fill`, `slot` and `pattern` bleed and
nothing else does.

Two things get checked, and neither is visible on screen:

    Colour field stops 3 px from the left and 3 px from the right of the page
    edge. On screen that is nothing. After trimming it is a white line down the
    side, and it cannot be fixed at that point. Put it exactly on the edge and
    it will be painted out into the bleed for you.

    Text comes within 3 mm of the left edge. A guillotine cutting a stack of
    paper is accurate to about that, so anything inside the 3 mm margin can be
    cut into. Keep it 12 px or more from the edge.

In the editor the stage becomes the sheet and the page sits inside it, so you
see the bleed and a dashed trim line. `#sheet` stays at trim size and simply
moves, which means every coordinate in the editor is still in trim space and
none of the pointer maths knows bleed exists.

Two bugs this turned up, both found by printing rather than by reading:

- **The pixel media box and the physical `@page` were rounded separately.** An
  A4 page came out a third of a pixel taller than its paper and every sheet
  spilled onto a second one — eight pages for four. The pixel box is now derived
  from the physical one and floored, so it can only ever be smaller than the
  paper.
- **Millimetres were being added to inches.** US Letter with a 3 mm bleed came
  out three times the size it should have been. The pad is converted into the
  sheet's own unit once, and both boxes are built from that.

A document that does not use bleed publishes exactly the bytes it did before the
feature existed, which a test asserts.

One thing that falls out of the type coming from the project rather than from a
number: **type does not scale with the page, and it should not.** A headline is
set in H1, and H1 is a token. So a headline that fitted two lines at 1280 wide
can need three at 794. The editor can see that, because the text is laid out in
front of it, so it grows the box to fit and says why:

    Every page is now A4 portrait. Undo puts it back. 1 text block grew to
    fit, because type comes from the scale and does not shrink with the page.

That correction is folded into the same history entry as the resize, so one
press of undo puts everything back. `history.amend` exists for exactly this: a
correction that can only be made once the browser has laid the new size out.

### What the editor does not do yet

- **The icon grid draws a demonstration glyph**, not your icon set. Icons are
  checked one at a time through the CLI; a set is not yet held in the project.
- **Images are per document, not per project.** A photograph dropped into one
  document is not offered in the next one.
- **No grade beyond the duotone.** Saturation and contrast as separate dials
  are not there; the duotone's `amount` is the only mixer.

## A second identity

Everything above was written against one mark. That is not a test, it is a
coincidence waiting to be found out, so the engine was pointed at a second
identity built to be unlike the first: **Halyard**, a ring and a chevron, drawn
entirely in fills where Meridian is a stroke, two inks in the mark where
Meridian has one, a naming pattern with underscores in it, a colourway set that
does not line up with the colour roles, and four faults left in on purpose — a
colour with no CMYK build, a ground that lays down 282% ink on stock that takes
260%, a plain 0/0/0/100 black, and no shape marked as the pattern source.

The four faults were all reported, in designer language, with the fix in each
one. The interesting part is the ten things that were wrong with the engine.

**The minimum size had never been measured off a fill.** Meridian's mark is a
stroke, so `thinnestStroke` always had an answer and the fallback behind it had
never run. Halyard has no strokes at all and the floor came back null. It is now
measured off the rendered artwork: scan it line by line, collect every unbroken
run of ink, and read the stem off the runs. On a stroke whose width is known the
measurement returns that width exactly, which is the control the suite keeps.

**A sharp corner is not a thin stem.** The first version of that scan took a low
percentile of every run, which reads the point of Halyard's chevron rather than
the bar across it: 4.8 where the answer is 12, and a floor of 36 px instead of
30. A stem has ink on the lines either side of it and a tip does not, so only
runs that are a local minimum with neighbours on both sides count. A ring 16
thick measures 16, a cross of 12 measures 12, and a solid disc — which has no
thin part anywhere — answers with its width rather than with nothing.

**The mark specimen flattened two inks into one.** Every diagram painted the
whole mark in a single colour, which is right for a construction drawing, where
a second ink is only noise, and wrong for the page that says *this is the mark*.
With one colour slot nobody could tell the difference. Drawing the mark as it is
actually used is now a separate thing from drawing it as a silhouette.

**A block can ask for a colourway the project does not cut.** Nothing says an
identity names a colourway after each of its colour roles. Meridian happens to;
Halyard does not, and the canvas, the deck and the Typst emitter each dropped or
mis-drew the mark in their own way. The canvas now resolves it once — the name
asked for, then the role's own name, then a colourway cut for the ground it is
going onto, then whatever exists — and the bundle carries which ground each
colourway was cut for so that third step can be taken.

**A mark drawn entirely in fills had no motion.** The motion rule draws the
outline and then rises the fill through it, so the renderer split the artwork in
two. With nothing stroked, everything landed in the rising half and the block
came out empty. It now says what is true: the mark arrives in one piece, and the
caption says so.

**The construction drawings were painted in a brand role.** `primary` is the
dark one in Meridian and the light one in Halyard, so a diagram drawn in it
disappeared on a light page. Diagrams take `currentColor` and inherit the ink of
whatever page they are on; the deck, which is not that page, passes its own.

**The naming pattern's separators were being thrown away.** The whole assembled
name was slugged at the end, so a studio that writes `{brand}_{colourway}` got
hyphens anyway and was never told. The pattern belongs to the project, which
means its separators do too. Case is still normalised, deliberately: lowercase
survives a case-insensitive filesystem, a URL and a stylesheet without anybody
having to think about it.

**`height="auto"` is not a length, so it is not an SVG attribute.** Every scaled
drawing carried one, and the style beside it did the work, so the only sign was
an error in the console per drawing. A page that lost its styles would have lost
the proportion with it. The viewBox knows the ratio, so the height is stated
outright.

**The words did not follow the measurement.** The manual, the deck and the CLI
all said *thinnest stroke* even when the number had come off a fill, and
`brand.json` gave the floor with no account of where it came from. It now
carries the width, whether it was a stroke or a stem, and the arithmetic:

    "minSize": { "screenPx": 30, "printMm": 8, "from": "stem", "width": 12,
      "basis": "box 120 ÷ narrowest stem 12 = 10 stems across, measured off the artwork" }

**And the deck fell over** when a project's ground colour is not itself one of
the colourways.

None of these were visible with one project in the repo. They are all in the
suite now, each one pinned to the case that found it.

## A third identity

Two projects is better than one and it is still not many. Both of the first two
draw the mark in a square box with its origin at zero, name themselves in plain
ASCII, and cut a colourway for each colour role. **Kvist & Sønn** is the third,
and every one of those is deliberately untrue of it: a mark 252 units wide and
90 tall with its origin at minus six on both axes, fills and a stroke together
in the same artwork, an o with a stroke through it in the name, an ampersand,
two colourways rather than five, no mark lockup at all, and a leftover Illustrator
stylesheet at the top of the file.

Eight more things were wrong. Two of them put a wrong number in front of a
designer, one stopped the build outright, and one made every icon in the package
come out blank.

**The floor was set by the stroke whenever there was one.** Kvist is three 7
unit boards under a 12 unit strap, and a mark with any stroke in it had never
had its fills measured, because the stroke width was always believed first. So
the engine reported 12, put the floor at 63 px, and at 63 px those boards are
1.75 px wide — the smallest size the manual permits is one where the mark's own
subject has disappeared. Both are measured now and the thinner wins, which puts
Kvist at 110 px and leaves Meridian, whose stroke really is its thinnest part,
exactly where it was.

**The measurement depended on how large the artwork happened to be rendered.**
The scan counts a run of ink in pixels and converts back to units, and it was
counting whole pixels, so the boundary pixel — half covered, half not — was
worth either one or nothing. On a 120 unit box rendered 600 wide that is a
fortieth of a unit and invisible. On a 252 unit box it is a quarter, and the
same 7 unit bar read 7 in the first and 6.72 in the second. Summing coverage
rather than counting pixels makes the answer the same at any scale, which is
what a measurement has to be.

**A style rule that matches nothing survived cleaning and stopped the build.**
Illustrator leaves one behind whenever artwork that used a class has since been
deleted, and the inliner keeps unmatched rules because in a browser they might
still match something later. Nothing here reads CSS — the measuring, the
recolouring and the PDF writer all work off attributes — but the PDF writer does
not ignore a stylesheet, it hands it to a browser to parse, and on a machine with
no browser in it the whole build stops with `CSSStyleSheet is not defined` and
no mention of which file or why. Dead rules are dropped now and reported as
dropped. Rules the artwork actually uses were always inlined correctly, and
still are.

**A brand name that is not spellable in ASCII was mangled rather than
transliterated.** `Kvist & Sønn` became `kvist-s-nn`: the ø is not in a-z, so
it was replaced with a separator and split a word down the middle. Every file in
the package, and the zip around them, carried it. Accents decompose and drop, but
the letters that are letters in their own right have to be spelled out — ø as o,
æ as ae, ß as ss, ł as l. It is `kvist-and-sonn` now. A name with no latin in it
at all asks for a `latinName` rather than writing a file called `-`.

**Two of the four emitters escaped the brand name and two did not.** The deck and
the published page did; the manual and the editor put it in a `<title>` raw. An
ampersand in a brand name is not exotic.

**The clear space box was drawn square.** Clear space is x on every side of the
ink box, so the box it makes is the ink box grown by 2x — the same shape, not a
square. Drawing it square is correct for a mark measuring 109 by 109 and 2%
wrong for one measuring 92 by 96, which is why it survived two projects. For a
mark measuring 228 by 49 the manual was showing a rule nobody could have
followed. This one is not a layout complaint: it was a false statement in the
document the client is handed.

**And the diagrams were drawn on a square canvas** whatever shape the artwork
was, so the same wide mark sat in a strip across the top with its own caption
261 px below it and nothing in between.

**Every icon, favicon and social crop came out blank.** The icon writer repainted
a slot literally named `ink`, and both earlier projects have one. Kvist's slots
are `board` and `strap`, so nothing was repainted at all: the mark kept its
master colours, the boards happened to be the same brown as the icon background,
and what a client would have installed on their phone is a brown square with one
orange mark in the corner of it. It paints every slot now, whatever they are
called.

Worth recording what did **not** break, because it is the first evidence that
any of this generalises: the negative viewBox origin was handled correctly
everywhere it was used — the ink box, the clear space, the lockups, the printed
piece and the canvas all read 228 × 49 at 0, 0 out of a box starting at −6, −9.
A mark with no mark lockup, a project with two colourways, and an Illustrator
export that puts all its paint in CSS classes rather than attributes were all
already right.

## A fourth identity

The first three all have five colours filling all five roles, two type
families, a photography block, and a mark drawn in a few hundred units.
**Hallward Press** has none of that: an ink and a paper and no third colour, one
colourway, one typeface used for everything, no `system` block at all, and a
monochrome seal of twenty-three paths — two rings, an inner ring exactly 8 units
thick, and its name set around the circumference — drawn in a 2048 unit box with
one part-transparent shape in it.

Five more things were wrong. Two of them are about a number nobody had thought
of as a number.

**A viewBox is a unit system, not a resolution, and the engine was treating it
as one.** The ink box is measured by rendering the artwork and reading the alpha
channel, at six pixels to the unit — so a mark drawn in 120 units rendered 720
across and a mark drawn in 2048 units rendered 12288 across, which is 151
million pixels and about 600 MB, every single time an ink box was wanted. The
Hallward build took **45 seconds** where the others take two or three, and a
mark exported at 10000 units would simply have run out of memory. Nobody chose
2048; Figma did. The measurement needs enough pixels to find an edge, which is a
resolution, so it is bounded as one — and bounded on area rather than width,
because the cost is width times height and a wordmark 657 units wide by 77 tall
is cheap at any scale. 45 s → 2.5 s, and every existing measurement is
byte-identical.

**And the same assumption, inverted, in the other direction.** The stem scan
renders at a *fixed* 600 pixels wide, so the finer the units the fewer pixels a
feature gets: Hallward's 8 unit ring lands on 2.3 pixels and measured 7.7. It
now looks at what it found, and if the thinnest thing is only a couple of pixels
across it renders again large enough to see it properly. 7.7 → 8.03. The other
three are unchanged, and only pay for the second look if they need it.

**The manual showed the mark on a ground it cannot be seen on.** The headline
specimen — the first picture in the document, captioned *the primary mark* —
puts the artwork on the colour in the primary role. That is a colour to present
on in an identity with a palette, and it is the mark's own ink in an identity
built from an ink and a paper. Hallward's specimen was a **plain black
rectangle**, mark and ground both `#14110E`, 1.00 to 1. Contrast is arithmetic,
the module for it has been in this repo since the first week, and nothing was
asking it. It asks now, and keeps the choice that was being made wherever that
choice works.

**Four slides of the deck were the same rectangle**, and finding out why turned
up an older one. Every slide is painted in the primary role, and the lockup
slides ask for the variant cut for the colourway *named after the ground role* —
which is a colourway name in Meridian and in no other project, by coincidence.
Everywhere else that lookup was falling back to whatever existed. Halyard's
title slide has therefore been drawing bone on bone, at 1.00 to 1, since the day
Halyard was added, through two rounds of browser checks that looked for console
errors, missing renderers and overflow, and never once asked whether the mark
could be seen. It can be seen now, on all four, at 12.86, 15.87, 17.37 and 18.02
to 1, and that is a check rather than a claim.

**A part-transparent shape passed without comment, and was measured three
different ways.** The ink box counts it, because alpha above a nudge is ink. The
stem scan cannot see it at all, because it thresholds at half coverage — so the
size at which the mark stops working is calculated as though the shape were not
there. And a printer cannot lay down 35 percent of a spot ink without a tint
screen. Three defensible decisions taken separately and never reconciled. It is
a warning now, in the same voice as the gradient one, saying all three.

What did **not** break is worth as much: two colours with three of the five
roles simply absent, one colourway, one type family, no `system` block, a naming
pattern that never mentions the colourway, an absent `social` section, and
eighteen rotate transforms flattened out of the artwork. All of those were
already right, and none of them had been tried.

## A fifth identity

Hallward was built by taking everything optional away. **Northline** is the
opposite: a transit authority with twelve colours, eight colourways, four
typefaces, four PNG widths, four social crops, 245 files in the package, one
colourway that leaves a slot out on purpose, and a mark drawn the way a drawing
tool actually writes a repeated element — once, in `defs`, placed three times
with `<use>`.

Six more things were wrong, and two of them were already shipping.

**`<use>` is a reference, and nothing here had ever heard of one.** Every drawing
tool writes a repeated element that way: the shape lives in `defs` and each use
places a copy. Both emitters walk the tree looking for geometry, so both found
the original sitting in `defs` and drew it **once, at the coordinates it is
defined at rather than placed at, in black rather than in the colour the `<use>`
carries.** The printed piece showed one misplaced black bar where there should
have been three brand-coloured ones; the PDF drew one shape and never filled it.
Teaching each consumer about references would have meant teaching all of them,
so it is resolved at the front door instead: the normaliser places the copies
and hands everything downstream plain geometry. A `<use>`-written master and a
plain-path master now produce byte-identical output, which is the test.

**And walking `defs` at all was drawing things that must never appear.** A
clipping path lives in `defs` and describes a shape that exists to hide other
shapes. **Kvist's printed piece has been carrying a solid rectangle the size of
its own artboard** ever since Kvist was added, because `defs` was being treated
as an ordinary group. `typst-check` never caught it: it compares the mark
redrawn against the mark rendered, and it only ever ran on Meridian, which has
no `defs` in it.

**Five of the six misuse cells were invisible.** They were painted in the colour
in the primary role, on a stage whose colour belongs to the page — and the
page's flips with the reader's light or dark setting, so no fixed brand ink can
read on both. **Halyard's have been blank since the day it was added**, at 1.01
to 1, and Northline's the same. This is the third place the same root cause has
turned up — an ink taken from a role without anybody checking it can be seen —
and the second time it was already in a shipped document. The cells have a
ground of the brand's own now, and an ink measured against it.

**The sixth misuse cell had no treatment at all.** Six captions, four
treatments: one showed the mark plainly correct under a caption saying not to do
it, in every manual the engine has ever built. It is hollowed out and outlined
now. The deeper problem is left standing and worth naming: the grid pairs a
fixed sequence of treatments with whatever six strings the project lists, so the
pictures match the words only because every project here happens to list its
misuses in the order the engine assumes. Meridian's sixth is *do not retype the
wordmark*, for which no fixed treatment is right. That pairing should be the
project's to state, and it is not, yet.

**A wrong colour nobody can see makes no point either.** The recolouring cell is
deliberately painted in a colour plainly outside the palette, which was a fixed
magenta — 2.96 to 1 on Meridian's dark ground. It is chosen against the ground
now, from a set of colours no identity would own.

**A colourway that leaves a slot out warned once per lockup and never said what
it did.** Three identical lines for one problem, and the thing a designer needs
to know is missing from all three: the slot keeps whatever the *master* was
painted, which is a colour from some other colourway, and the files are written
anyway. It is said once now, with the colour named.

There was also a defect of my own from an hour earlier: the new message read
*"Placed 4 referenced copy copies"*, and a dangling `<use>` pointing at nothing
was removed from the artwork and then the edit thrown away, because only placed
copies counted as a change. Both fixed, and a reference to artwork that is not
in the file is now a warning of its own.

What did **not** break: twelve colours reached the palette with roles and line
colours laid out together, eight colourways across four lockups produced 245
files with no name collisions, four typefaces produced four font requests, and
the excess touched nothing in the documents.

## A sixth identity

The first five differ in what the identity is — its shape, its palette, how much
of it there is. **Perigee** differs in what the *file* is. It is a mark exported
the way a web tool writes one: `hsl()` for one colour, the word `black` for
another, `#F63` for a third, no `data-slot` anywhere, a `clipPath` wrapper around
everything, and a 64 unit box. The dialect, not the design.

Five more things were wrong, and the first two are the worst this exercise has
found.

**A mark drawn in black never changed colour.** An unset `fill` in SVG paints
black, so the cleaner removes `fill="#000000"` as redundant — correctly. But
`applyColourway` repainted attributes that were already there, and after the
cleaner there was nothing to repaint. So a mark in plain black came out **black
in every colourway**, in every file in the package, silently, with nothing
reported: not a warning, not a missing slot, nothing. Every way of writing it is
affected — `black`, `#000`, `#000000`, `rgb(0,0,0)` — while `#010101` works
perfectly. Black is the commonest colour a logo is drawn in.

**A palette written in any notation but six-digit hex broke every measurement in
the package.** Three modules each had their own hex reader, and none of them knew
`hsl()`, a colour name, or a three-digit `#123`. Anything else gave `NaN` — and a
`NaN` compares false against every threshold, so nothing failed loudly. Instead
**`brand.json` told the client that every pair in their identity was "Never for
text"**, with every ratio `null`; `NaN` appeared sixteen times in the manual and
eleven in the published page; and the entire pattern set was refused, three
densities in three colourways, each with the reason *"measures NaN:1 against its
ground, so the pattern would not be visible"*. There is one reader now, in the
module the editor shares, and it takes hex of three, four, six or eight digits,
`rgb()`, `hsl()`, and the colour names. Where it genuinely cannot tell, it
returns `null` rather than `NaN`, the verdict is *"Not measured"* rather than
*"Never for text"*, and a project file with an unreadable colour is refused at
load with the colour named.

**`hsl()` survived the normaliser** and reached the printed piece as the literal
text `rgb("hsl(207` — because the normaliser's own reader knew hex and `rgb()`
and stopped there. Colours are written out in canonical form now, so nothing
downstream ever sees anything else.

**The colour pass and the slot assignment walked into `defs`.** A clipping
rectangle's white was near enough to the `paper` brand colour to be snapped to
it and given the `paper` colour slot — a phantom slot, on a shape that never
reaches the page, consuming a real palette name. This is the same rule the
printed piece needed last round, in the two other places that walk the tree.
There is one shared `eachPainted` now, and one list of what never draws.

**And one of my own from last round:** the message that says what a missing slot
kept only ever looked at the mark, so a wordmark slot was reported as keeping
"its master colour" instead of the colour.

The check that only knew Meridian now knows all of them. `typst-check`'s path
translation — redraw every path, render both, compare — runs over every project
in the repo rather than the first one: twelve assets, and Perigee's relative
smooth curves and arcs redraw with zero structural difference, which is the
first real evidence the path parser is right rather than merely untested.

## A seventh identity

Six identities, all named in letters a filename can carry, all written in a
language the documents already assumed. **מעיין** (Ma'ayan, a wellspring) is
named in Hebrew, its words are Hebrew, and it reads right to left.

**It could not be built at all, and the reason was a promise nobody kept.** Two
rounds ago the namer learned to refuse a brand name with no latin in it, and the
message it gave said: *give the project a "latinName" the package can be named
after.* Nothing anywhere read `latinName`. The message named a solution that did
not exist, a test asserted the wording of that message, and the whole class of
identity — every brand named in Hebrew, Greek, Cyrillic, Arabic, Thai, Japanese
— was locked out by an escape hatch that was only ever a sentence. It is real
now. Romanising a name is a decision, not an algorithm, so the project states
it; the files are named `maayan-*` and every document keeps the real name. And
it is settled when the project loads rather than three quarters of the way
through writing a package.

**The printed piece was writing itself to `-.typ`.** A second place that turns
the brand into a filename, which never learned about the latin name either.

**Every document declared itself English and laid itself out left to right.**
Four emitters, four hardcoded `<html lang="en">`, no `dir` anywhere. A Hebrew
manual told a screen reader to say Hebrew in an English voice and set the
paragraphs flush left. The language belongs to the project now, the direction
follows from it unless stated, and the six that were already right are
byte-identical. The chrome of these documents is written in English and
translating it is not done — that is a real limit, and it is better stated than
hidden behind a document that at least admits what language it is in.

**A colourway that cannot be seen on the ground it names was never reported.**
Every colourway declares the ground it is cut for. Whether its inks can actually
be seen there is arithmetic, and the contrast module has been in this repo since
the first week — but nothing was asking it that question. The documents had
learned to quietly show a *different* colourway instead, which is how it stayed
hidden, and every file for the unreadable one was written and shipped anyway.
**Three of the seven projects here had one**, and two of those three I wrote
myself in the two previous rounds, while working directly on the code that picks
what can be seen. That is the honest measure of how invisible an unasked
question is. It is a warning now, naming the colourway, the slot, the ground and
the ratio.

## An eighth identity

The first seven are all plausible. Unfamiliar to the engine, certainly — a
different shape, a different alphabet, a different dialect — but every one of
them drawn on purpose and drawn correctly. **Thornbury Mills** is a file that has
been edited by three people since 1998: a stray click that left a path of no
area, an old roundel dragged off the artboard rather than deleted, a rim that
bleeds past the edge, coordinates carried to nine decimal places, groups nested
four deep. Damaged, rather than merely unexpected.

**The normaliser had never looked at a coordinate.** It read what kind of
element each shape was, what colour it was painted and which slot it belonged
to — and never once where it was. So the roundel sitting entirely off the
artboard drew nothing, was mentioned by nobody, and would come back the moment
anyone widened the box. Worse, a single handle dragged to 99999 draws a hairline
across the artwork thinner than anything drawn on purpose: Thornbury measured a
**narrowest stem of 2 where the thinnest real part is 10**, and an ink box of
140 × 120 where the mark is 120 × 120. The smallest usable size would have come
out five times too high, and the manual would have said so with a straight face.
Shapes are measured against the artboard now: one lying entirely outside it is
removed and reported, one crossing the edge is a warning naming how far, and one
reaching several times the width of the box past it is a **blocker**, because
nothing is drawn that far outside on purpose and every number in the package
would be false.

**A box with no size was accepted as a size.** `viewBox="0 0 0 0"` gave every
measurement as zero; `viewBox="0 0 -100 -100"` gave a **negative narrowest
stem**, reported as a fact. Both are blockers now.

**A file with nothing painted in it threw a bare `Error` out of the measuring
step**, much later and in the wrong voice. It is a blocker from the normaliser,
in the same words as everything else.

**And a refusal nothing acted on.** `ok` was hardcoded `true` at the end of the
normaliser, so every blocker discovered *after* the first pass — which is every
blocker that needs the file cleaned before it can be seen, including all three
above — was found, described, attached to the report, and then ignored. The
first thing the new stray-geometry blocker did was get politely overruled by the
function that raised it.

**The claim the whole thing rests on is now checked on all of them.** *Change the
master and every number follows* had only ever been tested on Meridian. Halve
the artwork inside the same box and the ink box halves, the clear space halves,
the narrowest part halves, and the smallest usable size doubles — for all seven
projects whose artwork fits its artboard. Thornbury is the eighth and the one it
cannot hold for, because clipped artwork un-clips as it shrinks; the test names
it rather than skipping quietly.

Writing that test found one more thing, in a fixture shipped the round before:
**Ma'ayan's ripples were sliced flat by the bottom of its own artboard.** The
first version of the artboard check would not have caught it either — it allowed
anything within a fifth of the box, and the overhang was less than that. There
is no such thing as a harmless clip on a logo, so the tolerance is now half a
unit, which is the parser's rounding and nothing more. The ripples have been
brought inside the box; the mark is a slightly different shape than it was, and
a better one.

## A ninth identity

Eight rounds spent checking the artwork. The engine reads a mark with real
suspicion — its element types, its colours, its slots, and since the last round
its coordinates — and it had been taking **its own numbers entirely on faith**.

`minStrokePx: -3` gave a smallest usable size of **−40 px**. `clearSpaceRatio:
-0.5` gave **negative clear space**. `wordmarkHeightRatio: 0` shrank the
wordmark to nothing. `lockupGapRatio: -1` sat it on top of the mark. All of them
loaded without a word and were reported as measurements.

The worst was quieter. A naming pattern with no `{colourway}` in it writes every
colourway of a lockup to the same filename, so **five files become one** and the
client receives a package whose manual promises five colourways and whose folder
holds one. Two colourways sharing a name do the same. Both are refused now, and
so is every rule that cannot be true — with the same voice used for a mark that
cannot be drawn, because a rule that cannot be true is the same kind of defect.

**Cusp** is the fixture: one lockup, one colourway, two colours, no content
section at all, clear space set to 2.5 — a multiple of the mark rather than a
fraction of it, which reserves thirty-six times the area the mark occupies — and
a colourway cut for a ground called `bone` that is not in the palette. The last
one had a consequence: the ground could not be resolved, the fallback landed on
the ink itself, and the specimen was drawn at **1.00 to 1**. A ground is now
resolved as a palette colour *or* a plain one — Meridian legitimately cuts
colourways for `white` and `black`, which are paper and ink rather than brand
colours — and anything that is neither is said out loud, with the palette listed.

## A tenth identity

Nine projects, and not one of them had ever produced a pattern. Every build said
*no pattern was written* — because a pattern needs a shape marked
`data-pattern="source"` in the master, it is a decision the engine will not make
for you, and no fixture had ever made it. So `src/pattern.js` — the tile, the
three densities, the contrast refusals — had never once run end to end. It was
tested, and it was not exercised, and those are different things.

**Fathom** is a marine institute whose graphic language *is* the pattern, so it
marks one. The nine tiles it produced were **invalid SVG, and no renderer would
open any of them.**

The tile builder strips the source shape's own `fill` and `stroke` and writes
its own — but the regex it used to strip them does not match `stroke-width` or
`stroke-linecap`, so a source that carries either ends up with the attribute
written twice. That is malformed, `resvg` refuses to parse it, and the duplicate
`stroke-width` also silently overrode the weight the pattern rules had set. Nine
files went into the package and into the zip, and the build reported success.

The fix in `pattern.js` is one character class. The fix that matters is
elsewhere: **the engine now reads back every SVG it writes.** Nothing had ever
tried, which is exactly why nine unopenable files could ship without a murmur —
every check in this repo looked at things the engine had computed, and none at
the bytes it had actually put on disk. A file it cannot re-read is reported as
a defect in the engine rather than in your artwork, and says so.

With the tiles readable, the module's own claim could finally be checked: *a
tile that repeats seamlessly in both directions.* It does. Four by four, the
arcs run continuously across every boundary and the field reads as a scale
pattern rather than as a grid of cut-off pieces.

## Building the same thing twice

Ten identities in, the axis that was left had nothing to do with identities. The
whole argument of this engine is *change the master, rebuild, and everything
follows* — and the way you would actually check that is to build, change one
thing, build again, and diff the two packages. **That did not work.** Two builds
of an entirely unchanged master produced 45 different files out of Meridian's
138, so the noise swamped whatever signal a real change would have made.

Four separate causes, none of them the artwork:

- **The block ids in the starter document were a counter plus the clock.** The
  clock was doing real work — the counter restarts at zero every session, so a
  document loaded from disk and added to would have handed out `b1` twice — but
  it meant `document.json`, the editor and the published page were different
  every run. Counting on from the ids a document already holds does the same job
  and can be repeated.
- **Every PDF carried a creation date and a freshly generated file identifier**,
  so the same artwork written twice was two different files.
- **`usage.json` recorded the moment it was written.**
- **The zip stamped the mtime of every entry**, including the folder entries
  JSZip creates for itself, which do not take the option the files do.

`SOURCE_DATE_EPOCH` is the usual way to ask for a build you can compare, so it is
honoured: set it and all ten projects build byte-identically. Leave it unset and
a package still records when it was made, which is worth knowing.

With that working, the claim can be watched rather than asserted. Thicken
Meridian's ring from 9 to 14, rebuild, and **96 of 138 files change while 42 stay
untouched** — and the 42 are exactly the wordmark-only files, which do not depend
on the mark. That is a far better demonstration than any number of assertions,
and it was not possible to run until now.

## Settings the engine ignores

By this point a new identity was finding coverage gaps rather than broken
assumptions, so the question became a different one: **is there anything a
project can declare that nothing reads?** Every rule the engine defaults is set
by all ten projects and both `system` blocks are exercised, so the answer looked
like no. It was not.

`system.icons` is what the engine reads. Beside `system.pattern` and
`system.photography`, the natural thing to write is `system.icon`, and that did
nothing at all — no icon grid override, no warning, the manual showing the
default. The same is true of any mis-cased rule: `clearspaceRatio`,
`minStrokePX`, `lockUps` are all silently dropped, and the designer sees a
number they did not set and has no way to find out why.

A key nothing reads is now reported at build time, with the nearest real one
named and the consequence spelled out:

    rules.clearspaceRatio is set, and nothing reads it. Did you mean
    rules.clearSpaceRatio? Whatever you meant it to change is still on
    its default.

Only `rules` and `system` are checked. `content` is the designer's own prose and
it is none of the engine's business what else they keep in it — which is worth
saying because the first version of this check did police it, and refused
Meridian for carrying three keys the documents do read.

## An eleventh identity

Ten marks, and a check written to find out what they had in common turned up
something none of them tested: **not one was taller than 1 to 1.22.** Every
identity in the repo was square or wide. So Spire is a tower — ink 76 by 358,
1 to 4.7 — and it broke two things immediately and led to three more.

**The smallest usable size is a width, and nothing ever said so.** The floor is
computed by dividing the box by the narrowest stem across it, so it has always
been a width; while every mark was roughly square that made no difference at
all. It makes a great deal of difference to Spire. `brand.json` said `screenPx:
13`, and anybody who read that as a height would set the mark 13 px tall and get
one **3 px wide with a 0.9 px stem in it** — a quarter of the size the number
promised, and well under the floor it was quoting. Kvist has been ambiguous the
same way since the third round: its 110 px is a width, its height is 40.

The floor now carries both dimensions and says which is which. A square mark
still reads `32 px`; a mark that is not reads `13 × 42 px`, in the manual, the
deck, the read me, `brand.json` and the canvas.

**A tall mark's diagram was narrower than its own caption.** The construction
and clear-space canvases follow the shape of the artwork — right, and added in
the third round, when the only awkward shape was a wide one. Spire's canvases
came out 123 and 129 units across carrying captions that need 173 and 197, so
`narrowest stem 29.7` was cut off after the word *stem*. The canvas is now at
least as wide as the words written under it, which widened Spire's to 188 and
213 and left every other project's exactly where it was.

Three more came out of checking the fix rather than the fixture:

**Half a fix is not a fix.** The size specimen is drawn by two renderers — one
for the manual, one for the canvas — and only the manual was taught to say the
height. The same mark read `110 × 40 px` in the book and `110 px` on the page
the book published. The three steps are worked out once now, in `geometry.js`,
and both renderers read them.

**Three sizes drawn as one picture.** Hallward's floor is 766 px, so its
specimen asks for 1532, 766 and 460 px in a column 282 wide. The manual's CSS
capped each preview on its own at `max-width:100%`, which drew **the same
picture three times under three different numbers** — a specimen whose entire
job is to show the difference between above and below the floor showing no
difference at all. The canvas capped nothing and ran a 1532 px mark off the
right of a 1400 px page. Each step is now offered at its true size *and* at its
share of the column, so three previews are either all life-size or all shrunk by
one factor, and the page says which.

**The engine broke its own rule and reported success.** `check <icon.svg>
--icon` refuses an icon you hand it whose thinnest part paints under
`minStrokePx`. The engine then wrote its own icons at sizes far under the same
rule and said nothing. An icon is the mark inset to a safe area of 0.68, so
Hallward's hairline seal paints at **0.49 px in its 180 px app icon and 0.04 px
in its favicon** — 177 pixels touched carrying 64 pixels' worth of ink, which is
a grey haze rather than a seal. It ships nothing that clears its own rule: the
artwork needs a 1095 px square before it holds together.

A favicon under the rule is not a fault of the artwork — no mark of any weight
clears 3 px at 16 px, which is precisely why a favicon is a simplified glyph —
so `brand.json` now carries the crossover for every project and only an **app**
icon under it is a warning. One of the eleven gets one, which is the one that
deserves it.

Two things this round did *not* break, both worth recording because I expected
them to. Six colour slots, where every previous fixture had one to three: cut
correctly in every colourway with nothing missing. And the horizontal lockup of
a mark 4.7 times taller than it is wide, which I predicted would blow out
sideways because the wordmark is scaled against the mark's *height* — it comes
out at 1.71 to 1, which is an ordinary lockup, and measuring it was quicker than
arguing about it.

## A twelfth identity

Twenty-two master files across eleven identities, and every one of them was
**flat colour**: no gradient, no mask, no filter, no image, no blend mode. That
is the repo's blind spot, and a gradient is the commonest thing in it — and the
one thing that breaks the idea a colourway rests on, which is that a slot is one
colour.

**Vesper** is a gradient identity: a ring running #C2620E → #B8336A → #2E2A63,
with a flat star sitting on it.

**The gradient reached none of the files.** `applyColourway` rewrites the fill
of every slot it is given a colour for, gradient or not, so writing the middle
stop as the ring's colour — the obvious thing to write, since the colourway
wants one colour — silently replaced the gradient with a flat pink in all three
colourways, including the one whose whole job was to carry it. Nine SVGs, nine
PDFs and every PNG went out flat. And each of those nine SVGs still carried the
`<linearGradient>` definition, referenced by nothing, because repainting a fill
leaves the defs alone.

The engine's one sentence on the subject said the opposite of what happened:
*"those parts will not change between colourways."* They changed in every one.

A colourway slot can now say `"keep"`, which leaves it painted as the master
drew it — the same rule `fill="none"` has always had, that the artwork's own
paint is a decision the engine does not overrule. Paint nothing references is
dropped from the file. Which colourways carry the gradient and which are the
flat version is stated in the build, in `brand.json` and on a page of the manual
that draws the gradient and quotes its stops off the artwork. A gradient that
**no** colourway keeps is a warning, because then it is in the master and in
nothing else.

Then the parts of the engine that had never met one:

**The printed piece would not compile.** `src/typst.js` asks `colour()` for
every fill, and `colour()` answers `rgb("…")` whatever it is handed — so a
gradient fill came out as `rgb("url(#a)")`, which Typst refuses outright:
*color string contains non-hexadecimal letters.* Nothing had ever noticed,
because the only Typst source this repo ever compiled was Meridian's page, and
the per-project check translates paths and then compares **SVG against SVG** —
it never went near Typst at all. A linear gradient is now written as Typst's own
`gradient.linear`, with the declared CMYK build at each stop and the angle taken
from the axis; a paint server that cannot be said — a radial, a pattern — is
named rather than quietly drawn in black. And the check now compiles every mark
in every colourway: twelve projects, thirty-eight colourways.

**The PDF says DeviceRGB in a package that calls itself DeviceCMYK.** The ink
path works by wrapping jsPDF's two colour setters, and a gradient never goes
through them: jsPDF writes it as a shading dictionary whose colour space its
own writer hardcodes to `/ColorSpace /DeviceRGB`, with no hook to say otherwise.
So Vesper's mark PDF has the star in the declared ink — `0.92 0.94 0.3 0.2 k` —
and the ring beside it in screen colour, in a file `brand.json` called
DeviceCMYK. That claim was computed from the palette rather than from what was
written. It now reads *"DeviceCMYK, except the gradient in 3 files, which is
DeviceRGB"*, the files are named, and the build says what a printer should do
with them: a gradient cannot be a spot ink in any case, so a two-colour job gets
the flat version.

**A gradient was measured as contrast zero.** `"keep"` is not a colour,
`contrast.ratio` returns `null` for it, and `Math.min(11.86, null, 2.8)` is
**0** — so a colourway carrying a gradient scored zero against every ground and
was never chosen for anything. The build's readability check had the opposite
bug: it dropped the `null`, so the pale end of the gradient was the one part of
the mark never checked at all. Both resolve `"keep"` now to what the master
actually paints — a gradient's stops, or its flat fill — through one reader in
`svg.js`, so a gradient is judged on its worst stop and a stop that cannot be
seen is named with the colour that fails.

**And the manual was opening on the wrong colourway.** Choosing which colourway
to lead with used to keep whichever landed on the colour holding the `primary`
role and otherwise take the highest contrast it could find, which only agrees
with the designer when the primary role happens to be a ground. **Six of the
twelve projects opened on a colourway their designer had not put first**, five
of them while the first read perfectly well: Halyard's manual opened in reverse,
Perigee's in reverse, Vesper's in flat white rather than in the gradient that is
the identity. It now takes the designer's order and goes looking only when the
mark genuinely cannot be seen — which leaves exactly one project switching,
Ma'ayan, whose first colourway measures 2.76 to 1 on its own ground and which
the build has warned about since the round it was added.

## A thirteenth identity

Thirteen rounds of varying the artwork, and every project so far had **both a
mark and a wordmark**. An identity that is a logotype and nothing else — Google,
FedEx, Braun, most of publishing — is arguably the commonest kind there is, and
the engine would not build one at all:

    This project file is not usable yet:
      - the project does not say where the master mark is (assets.mark)

A refusal naming a missing field rather than the problem, with nothing to do
about it. **Marlow** is a logotype in a serif with a copper rule under it, and
nothing else.

Either asset may be the master now. With both it is the mark, exactly as before;
with only a logotype, the logotype is what gets measured, what the icons are cut
from, and what the read me says every file came out of. Asking for a lockup the
project has not got the artwork for is refused by name — *"this project asks for
the stacked lockup, which needs assets.mark, and it is not set. With
assets.wordmark the lockups available are wordmark."*

Five more came out of it, and four of them had been wrong for other projects the
whole time.

**The construction drawing put the artwork in the wrong place.** It placed the
top left of the viewBox at the top left of the canvas and then drew the artwork
in its own coordinates, so any master whose box does not begin at `0 0` landed
somewhere else. Kvist has been nine units out since the round it arrived. A
logotype's box begins 94 units *above* the baseline, so the whole drawing fell
outside its own grid, through the rectangle labelled as the box. The clear space
diagram beside it has always subtracted the origin; this one never did.

**And it drew artwork that is in no file.** Everything the engine delivers is
clipped to the artboard, because that is what a viewBox does. This drawing was
not, so Thornbury's bar reaching fourteen units past its box — left in on
purpose since the eighth round — was drawn here complete, sticking out through
the box outline, under a caption saying what the mark fills. The manual showed a
shape the package does not contain.

**The smallest size specimen was invisible.** It painted a brand colourway onto
a stage the colour of the page, and the page flips with the reader's light or
dark setting, so no fixed ink reads on both. **Eight of the thirteen projects
drew this block at under 1.1 to 1 in light mode** — three blank rectangles where
the one diagram that says how small the mark may go should be. The misuse grid
was fixed this way several rounds ago and this block was left with the same
fault; it now stands on a ground of the brand's own, chosen the same way.

**The read me listed four folders, always.** Written out as four fixed lines, in
a package that writes the lockups the project asks for. **Eleven of the thirteen
projects do not ask for all four**, so eleven read mes named folders that are not
in the package — Cusp's named three of them. It lists what was written now, and
says what each one is for given what else is beside it: a wordmark next to a
symbol is the fallback below the mark's floor; a wordmark that *is* the identity
is the logotype everything else was cut from.

**An icon is square and a logotype is not.** The icon check measured stroke
weight and never asked whether the artwork is the right shape for a square. A
mark is inset to fit its longest side, so Marlow — 3.84 times longer than it is
deep — fills **12% of an icon** where a square mark fills about 46%, and the
advice the engine gave was to redraw it with heavier strokes, which is not
advice you can take about a word. Kvist and Spire fill under a tenth of every
icon in their packages and nothing had ever said so. The shape is now measured
and reported, and a mark that is not square is told to draw a device — a
monogram, an initial, the part of the mark that stands alone — rather than to
thicken what it has.

Two smaller things went with it. The manual for an identity with no symbol
stopped calling it "the mark". And the Typst check compiled every project's
**mark** lockup, which a logotype identity has not got: it crashed on Marlow and
reported no failure, because a crash is not a failing check. It compiles every
lockup a project asks for now — thirteen projects, forty checks.

## A fourteenth identity

The audit this time was of the *content*, not the artwork, and it was stark: the
longest string in the whole content block of **twelve of the thirteen projects
was 27 characters**. Every fixture's positioning statement was its own name.
Only Meridian had ever been given prose, and only in a couple of fields.

A real identity job is mostly writing. The manual, the deck and the canvas exist
to carry that writing, and they had never been given any. **Beaumont & Whitcombe
Rare Books** is a bookseller with a 31 character name, a positioning statement of
331 characters, real prose in all six content fields, and misuse captions that
are sentences rather than labels. Its mark is a plain bookplate roundel on
purpose: the artwork is not the instrument this round.

**The title slide had no bound at all.** The deck set the positioning statement
as its headline — `h1` is 7cqw on a 15ch measure — so 331 characters became
twenty-two lines, ran **657px past the bottom of the slide**, and the deck
opened halfway through the word "Street" with the beginning and the end both
off the slide. A statement that long is not a headline: the name goes in the
headline now, the statement underneath at reading size, and both step down until
they fit a budget taken from measuring built decks rather than from adding up
the stylesheet.

**Text that does not fit its block was silently swallowed on screen and printed
through whatever was underneath.** A text block is a rectangle somebody drew and
words somebody wrote, and nothing had ever asked whether the second fits the
first. The canvas had `overflow:hidden`, so the cover lost the last two thirds
of its sentence with no sign at all; Typst has no such rule, so **the same block
on the same page printed straight through the caption below it**. One document,
two renderers, two different wrong answers, and no report from either.

Both show it now, which is the honest failure — a page that looks wrong gets
fixed and a page that quietly drops a sentence does not — and the build, and
`print`, name the block, its page, the lines it needs and the height it has. The
arithmetic behind that is fitted against **540 measurements taken from a real
browser** under one rule: never say a passage takes fewer lines than it does,
because a check that misses an overflow is worse than one that mentions a near
miss. At 0.55em a character and 0.16em a space it under-counted none of the 540,
got 75 per cent exactly right and 93 per cent within a line.

**The engine was generating a cover it knew would not fit.** The starter
document put the positioning into a block 700 by 120 at H1, whatever was in it.
It sizes the block to its own words now, and drops to a step that can carry a
statement rather than a phrase.

**A caption that is a sentence was set as a label.** Misuse captions are
uppercase, letter-spaced monospace, which is right for "do not stretch it" and
unreadable at 150 characters. Meridian's have been 48 to 57 characters — full
sentences — since the first identity in this repo, set in spaced capitals the
whole time. A caption longer than a label is now set as prose.

And one that had nothing to do with the words. **The printed piece and the
canvas resolved a colourway differently.** A block asks for a colourway by role
and nothing says a project cuts one named after each role; the canvas answers
that by taking a colourway cut for the ground the block is going *onto*, and
`typst.js` had its own answer — take the first variant of that lockup. For a
project whose colourways are named `ink`, `reverse` and `gilt`, that put the
mark **in ink on an ink field**: invisible, on the one deliverable that costs
money to find out about. There is one resolution now and both read it.

## A fifteenth identity

Two audits this round, and both came back empty in the same place. **No project
had ever set `system.icons` or `system.motion`** — two of the four rule blocks,
whose override paths had never once run. And of the eighteen block types the
model knows, six are never generated by any fixture.

**Yarrow** is a land trust: eleven thousand acres, a fingerpost, a lorry, a
lanyard and a phone. It is the first project to declare all four systems, and —
this is the part that matters — to override each of them *in part*, which is
what a designer actually writes.

**Overriding part of a rule deleted the rest of it.** The rules were merged with
`Object.assign`, which replaces whatever it is given. So

    "motion": { "durations": { "base": 420 } }

— the obvious thing to write — **deleted quick, considered and slow**, leaving a
motion specification with one duration in it. And

    "pattern": { "densities": { "medium": 1.2 } }

deleted fine and coarse, and with them **six of the nine tiles the package
writes**: Yarrow shipped three. Both silently. Every existing project happened
to restate every key, which is why fourteen rounds never found it. An override
now merges a level at a time; an array — an easing curve, the build order, the
crop ratios — is a whole answer rather than a set of named parts, so an array
still replaces.

**A size the project stated was overwritten by the derived one.** Three of the
icon rules are ratios and three are the sizes those ratios come out at, and the
sizes were computed *after* the merge. A project writing `"stroke": 2` — the
number a designer thinks in — had it accepted, stored in the rules object, and
then replaced by `box × strokeRatio`. No error, no effect. The size wins where
the size is what was written, and the ratio is worked back from it.

**And the whole kind was missing from both documents.** The plan calls rule
blocks "a whole kind, not a footnote". They reached the canvas, `brand.json` and
the deck's file count, and **neither the manual nor the deck ever mentioned
one**. Fathom's entire identity is its pattern; nine tiles went into its package
and its brand manual did not contain the word. Four projects declare a
photography treatment and no manual described it. Every package writes icons on
a grid derived from the mark and nothing said what the grid was.

There is a chapter for it now, in both, with a section only where the project
has that system, so nothing grows an empty one: the pattern drawn at every
density it is cut at, the treatment shown as a grey ramp run through it under
its own scrim, the icon grid with the mark's own margin and stroke worked out on
the page, and the easing curves drawn from their control points beside the
durations. A project that never mentioned motion gets no motion section. Cusp,
which has no pattern and no photography, gets one section — the icon grid — and
its Assets chapter is renumbered around it rather than colliding with it.

## A sixteenth identity

Sixteen rounds, and **not one identity had a photograph in it**. The audit that
found it was the same one the fifteenth used, run on the block types: of the
eighteen the model knows, six are never generated by any fixture, and two of
those — the image slot and the mockup — are whole subsystems. `bu.images` was
`{}` in every build there had ever been.

The reason was structural. A photograph could only reach the engine by somebody
dropping one into the editor, and it travelled with the saved document from
there. So a brand package could not contain the art directed pictures the
identity is built on; the manual's photography page had a grey ramp and nothing
else — a treatment specimen with nothing treated in it; and the whole raster
path had never once run from a project.

**Saltmarsh** is eleven rooms on a tidal creek. Its photography *is* the
identity and the mark is only there to sign it. A project can list its
photographs now:

    "assets": {
      "mark": "mark.svg",
      "wordmark": "wordmark.svg",
      "photography": [
        { "file": "photography/marsh-at-dusk.png", "caption": "the marsh at dusk, looking east" }
      ]
    }

They are read at load, sized from each file's own header, written into the
package as given *and* as the project's own rules treat them, carried into the
canvas so a designer does not upload them again, put on the cover of the
document the engine generates, and shown on the manual's photography page —
which now has the actual brand photography on it beside the ramp.

Then two defects that had been waiting for the first photograph to arrive.

**The printed piece would not compile.** The Typst path names its image files
like this:

    im.src.includes('image/png') ? 'png' : im.src.includes('svg') ? 'svg' : 'jpg'

`im.src` is a data URI, so that searches **the base64 payload as well as the
header**. About a quarter of 60 kB photographs contain the three letters "svg"
somewhere in their base64, and both of the ones here do — so a JPEG was written
as `image-….svg`, and Typst refused the file outright: *file is not valid
utf-8*. Not a wrong colour or a shifted box: **the whole printed piece failed to
compile**, over an extension. It is read from the URI's header now, in one place
that also decides whether an image is a vector — which was a claim the caller
made rather than a property of the file.

**The photograph went to press untreated.** The published page applies the
duotone and the scrim; Typst placed the raw file. The same document showed a
brand photograph in the brand's own colours on the page it publishes and in
whatever the camera saw on the page it prints, with nothing said about it. The
treatment is baked into the pixels now, with the same `treatPixel` the browser
check is measured against, so the two cannot disagree. The scrim is baked in
too: Typst will not put alpha on a CMYK colour — *CMYK does not have an alpha
component* — which is the right refusal, because a translucent wash over a
photograph is not something a press does with an ink. It is part of the picture
by the time it gets there, so it becomes part of the picture here.

## A seventeenth identity

The audit this time was one line long: **every typeface in every fixture was
`google: true`.** Sixteen identities, six distinct families, and not one of them
licensed, self-hosted or drawn for the brand — which is what most serious
identities are built on, and the only path the engine had never taken.

**Winterbourne** is a chamber orchestra whose identity *is* its typography. Its
logotype is set in its own display face and outlined, so the wordmark and the
headline of a programme note are the same drawing. It ships the faces it is
licensed to ship, subsetted to the characters a brand actually sets:

    "display": {
      "family": "Liberation Serif",
      "files": [{ "file": "fonts/liberation-serif-regular.ttf", "weight": 400 }],
      "licence": "SIL Open Font Licence 1.1. It may be redistributed with this package…"
    }

Four defects, and the first was in the way in.

**A type scale written the way a designer would write it crashed the build.**
`"scale": { "base": 16, "ratio": 1.25 }` is what anybody would put down cold. It
reached the document layer and came back as `(t.scale || []).map is not a
function`. `tokens.type` was the one token block nobody had ever validated — the
artwork is checked, the rules are checked, the colours are canonicalised, and
the typography was taken entirely on faith. A crash is not a refusal.

**A typeface not hosted by Google reached no document at all.** Both emitters
filtered families to `f.google`, so a licensed face got no `@font-face`,
silently. The CSS asked for `'Liberation Serif', Georgia, serif` and every
reader saw Georgia — including on the manual's type specimen page, which carried
the licensed name above type set in the fallback. **A specimen that shows the
wrong face is worse than no specimen, because it is offered as proof.** Nothing
warned. Four documents answered this question in three places and now answer it
in one, `src/typeface.js`: a face that ships is inlined, a face somebody else
hosts is linked, and one that is neither is named in a warning that says what
the reader will actually see instead.

**Every document fetched a typeface the identity never chose.** The manual's own
furniture named Schibsted Grotesk and the deck's named Spline Sans Mono, hard
coded. For Winterbourne that was the *only* webfont the deck loaded: a font from
nobody's identity, while the identity's own was absent.

**The printed piece asked for fonts the project was already carrying.** `handover
print` named the families and told you to go and find the files — which were
sitting in the project. It writes them out and points Typst at them now, and the
PDF embeds `LiberationSerif-Bold` rather than a substitute.

The faces travel too: `09-type/` with the files and a `LICENCE.txt` beside them,
because a licence is the half of a typeface that is not in the file, and a client
handed webfonts needs to know what they may do with them.

## An eighteenth identity

The audit was of the artwork rather than the project file, and it said the same
thing three ways: **the largest mark in seventeen identities is 23 paths.**
Every fixture is a handful of strokes, where the thinnest ink is a fair proxy
for what survives at a small size and every drawing is its own icon.

**Ravelston** is a distillery with a heraldic crest it did not commission and
cannot replace: a hatched shield, a chevron and three casks, 46 paths, drawn to
be cut into stone at half a metre across.

The first thing it exposed was not about detail at all.

**A package with no icons in it, documenting an icon system.** `rules.iconSizes`
and `rules.faviconSizes` were the only "what gets written" rules with no
default — `formats`, `pngWidths`, `naming`, `clearSpaceRatio` all have one — so
`for (const size of rules.iconSizes || [])` skipped in silence. Sixteen of
eighteen projects happened to name their sizes. The two that did not were the
last two written, and both shipped `brand.json` carrying the whole icon
specification — box, stroke, curve radius — and a manual chapter on the grid,
into a package containing no icons whatsoever. Nothing said a word.

Thirteen of the sixteen declare exactly `[1024, 180]` and `[16, 32]`, which is
what makes those the default rather than a guess. And the manual's chapter is
now tied to whether icons get written at all, because a section describing what
the reader has not been given is worse than no section.

The second was the crest's own doing. With icons finally written, the check
that has existed since the thirteenth round did its job:

> 1 app icon was written where the thinnest part of the mark paints under the
> 2.4 px this project sets… this artwork needs 195 px square before it holds
> together… Draw a simplified icon mark — fewer parts, heavier strokes.

**And a project could not carry the answer.** `assets.icon` was loaded,
normalised, and then ignored: icons were always cut from the master. The file
the advice asked for could be checked by `check --icon` and used by nothing.
Ravelston ships one — the chevron and one bar, at 13 units of stroke, which is
not a smaller crest but a different drawing meaning the same thing — and the
icons come out of it. The read me, `brand.json` and the manual all say which
drawing they came from, because a client who sees icons that are not the mark
should be told that is deliberate.

The crest also settled a hypothesis in the negative, which is worth recording:
the hatching is five units of ink to one and a fifth of paper, and the guess was
that the paper would close long before the ink thinned, making the stated floor
a lie. It does not. Rendered at the engine's 116 px the bars still separate;
they collapse around 48. The floor is honest, and the reason to say so is that
a defect I went looking for and did not find is a defect somebody else does not
have to go looking for.

## A nineteenth identity

Eighteen identities, and the audit fits in one line: **every one of them is
written in an alphabet.** Maayan is Hebrew, which reads the other way but is
still letters separated by spaces. Nothing had ever been set in a script that
does not put spaces between words.

**山彦** — Yamabiko, an echo — is a recording studio in a converted silk-worn
house. Its name is two characters, its prose is Japanese, and it ships the face
it is set in.

The line counter answered **one line** to any amount of it.

    const words = para.split(/\s+/).filter(Boolean);

Japanese has no spaces, so a paragraph came back as a single unbreakable word,
and the greedy wrap has nothing to break. The width was wrong as well: a
full-width character is exactly one em — measured off the shipped face, 2048 of
2048 — against the 0.55 fitted for Latin.

This matters more than a wrong number usually does, because of what the counter
is for. The fourteenth round established it under one rule: *never say a passage
takes fewer lines than it does, because a check that misses an overflow is worse
than one that mentions a near miss.* Text that does not fit is swallowed on
screen and printed over whatever is beneath it. Measured against 270 browser
measurements of Japanese, the counter under-counted **235 of them** — worst case
one line where the browser took sixteen.

It breaks a paragraph into pieces now: a run of letters between spaces is one
piece as it always was, and a full-width character is a piece of its own,
because a line of Japanese may break between almost any two. Kinsoku is in
there too — a comma may not open a line, so it binds to the character before it
— which was worth five of the remaining under-counts. Japanese now runs **270 of
270 exactly right, none short.**

Then the Latin half, which was the surprise.

**The 0.55 had quietly stopped holding.** It was fitted in the fourteenth round
and under-counted none of that round's 540 measurements. The corpus grew — a
project with prose in every field arrived in the same round, and three more
since — and re-measuring the same way found **65 of 540 under-counted**, worst by
two lines. Raising the single average to 0.61 restores the rule and throws away
most of the accuracy: 29 per cent exactly right against 46.

So it is not an average any more. The advance of every character this engine
sets is measured off Archivo and Literata, the wider of the two, and baked in as
428 characters of table with five per cent of headroom. `W` is 1.09 em and `i`
is 0.33; no average can tell them apart, and a line of one holds three times as
many as a line of the other.

Across all 810 measurements, both scripts:

    under-counted   300  ->  0
    exactly right   35%  ->  65%
    mean error     1.48  ->  0.75

The measurements are in `test/fixtures/line-measurements.json` and the suite
checks the rule against every one of them, because the only evidence a counter
tells the truth is a browser that was asked.

## A twentieth identity

Nineteen identities, and the audit was of the blocks rather than the projects:
of the eighteen kinds the model knows, **five had never been generated by any
fixture** — `rule`, `mark`, `typeSpecimen`, `assetIndex` and `surface`, which is
the mockup the sixteenth round named and nothing has exercised since.

They were not broken. The reason nothing generated them was: **a project could
not carry the pages a designer laid out.** The canvas exists so somebody can
lay out the pieces an identity is actually delivered as, and every package's
`document.json` was the cover the engine writes on its own. A designer's own
pages were not part of the source and did not survive a rebuild. That is the
fourth time this exact shape has turned up — the photographs, the typeface, the
icon, and now the layouts.

**Lammas** is a small arts festival. It ships three pieces: a poster on a 1080
by 1920 sheet, a two page programme on A4 landscape, and an A5 ticket with the
lockup mapped onto a canvas bag. Between them they use all five.

    "documents": [
      { "file": "documents/poster.json", "name": "Poster" },
      { "file": "documents/programme.json", "name": "Programme" },
      { "file": "documents/ticket.json", "name": "Ticket" }
    ]

Handing an array to `assets` threw `The "path" argument must be of type string`,
which is the same crash `assets.photography` gave in the sixteenth round for the
same reason. Three more, all found by looking at what came out.

**The mockup published the editor's own instructions.** With no photograph in
it, `surface` draws "MOCKUP · drop a photograph here" — right on a canvas, where
somebody is working, and wrong on a ticket, where somebody is holding it. The
renderer is shared between the two on purpose, one layout engine with nothing to
keep in sync, and it had never been told which of the two it was drawing. It is
told now, for the length of a publish call and no longer, so the canvas still
offers to take the photograph afterwards.

**A block was cut to a page it was never told about.** `makeBlock(type, at, on)`
clamped to `on || PAGE` — and `PAGE` is the default slide. A caller that did not
pass a page had its sizes quietly trimmed to 1280 by 720, so the poster's
full-bleed fill came out 720 tall of 1920 and everything below it was set in the
ground colour on the ground: two rules, the standfirst and the date, invisible
rather than absent. An explicit size from the caller is the best information
there is, and clamping it against a page the block is not on is worse than not
clamping at all.

**A page that indexed the package indexed most of it.** The bundle is built from
what has been written so far, which at that point is everything except the
documents, the licence and the zip — so an asset index a designer laid out
reported **45 files in a package of 57** and did not name the folder its own page
was in. Every remaining name is known before it is written; only the sizes are
not, and nothing in the index reads a size. It is exact now, for every project
in the repository, and the suite checks the package against the index rather
than against itself.

## A twenty-first identity

Twenty identities and **every one of them had a wordmark** — a drawing of the
name, artwork, fixed. Marlow inverted it in the thirteenth round, a logotype
with no symbol; nothing had ever been the other inversion. A mark that stands
alone: Nike, Apple, Shell, Target, the Olympic rings.

**Skerry** runs eleven islands on one timetable. Its mark is a roundel with the
channel cut through it, painted on hulls and printed at nine millimetres on a
ticket, and **its name is not drawn**. It is set, in the network's own face, at
fifty eight per cent of the mark's height.

For that kind of identity the lockup is not two pieces of artwork. It is the
mark, and the name at a stated size and distance — a rule rather than a file,
and the single most important thing the manual has to say. There was nowhere in
a project to say it. The engine could take the mark and had nothing at all to
tell anybody about the name.

    "system": {
      "nameSetting": {
        "family": "display", "weight": 700,
        "heightRatio": 0.58, "tracking": 0.03, "transform": "uppercase"
      }
    }

The name is outlined from the face the project ships — the seventeenth round's
work, used for something else — so the files still need no font to render,
which is the whole reason a wordmark is artwork in the first place and stays
true when the engine is the one drawing it. Everything downstream then works
unchanged, because by then there is a wordmark.

Three things it caught on the way, two of them mine.

**A symbol that is the whole identity was described as a fallback.** The read
me said `03-mark` is for "avatars, app icons, and anywhere the name is already
present" — exactly backwards when there is no name to be present anywhere. The
same sentence the thirteenth round rewrote for a logotype, unrewritten for its
mirror.

**The rule stated a size that something else silently overruled.** The lockups
are composed from `rules.wordmarkHeightRatio`, and the new rule said the same
thing in a different field. Skerry asked for 0.58 and would have got the 0.34
default without a word, which is the fifteenth round's defect returning the
moment a second way to say one number existed. It is one field now, and a
project that states both differently is refused rather than resolved.

**The audit kept its own copy of the list it audits.** `system.nameSetting` was
added to the engine's list of keys that are read, and the suite's check has its
own — so the check failed on a project that was correct. Two lists of one thing
is the defect this engine keeps finding in other people's code; it was inside
the check. The list is exported now and the test reads it.

## A twenty-second identity

Every read me this engine has ever written ends the same way:

    brand.json holds all of the above in a form software can read.

Twenty-one identities shipped that sentence. A grep for anything that opens a
brand.json found writers, and no readers. It was a promise with nothing on the
other end of it — a format emitted and never consumed, which is a format nobody
has tested, however well-formed it is.

**Tarnbrook** is a building society, and the fixture is its **second version**.
The input to the build is the brand.json its own first version wrote:

    "version": "2.0.0",
    "previous": "previous/brand.json",

That makes the engine the first reader of its own contract, and what it reads is
the part of a second version that is in neither package. Both packages are
correct. Both describe a complete identity. The expensive facts are in the
difference between them, and nothing had ever looked at it.

    warning: 7 changes since 1.4.0 retire something the client already has

The floor went from 32 px to 64 px, because the new artwork has a finer part in
it and the floor is set by whatever disappears first — so everything already
made between the two was inside the rule when it was made and is outside it now.
`beck` and `gorse` moved, so stock already printed is off palette, and a colour
that has moved a little is worse than one that has moved a lot: the two sit side
by side and read as a printing fault rather than as two versions. The `stacked`
lockup and the `beck` colourway were withdrawn, and the files clients already
downloaded keep working and keep their names — nothing about them announces that
they have left the identity. `fell on gorse` carried body text at 4.69:1 and
carries headings only at 4.14:1: the words did not change and the layout did not
change, so there is nothing on the page to look at.

`CHANGES.txt` is that list, in the package, ordered by what it costs. The manual
opens with it, chapter 00, before the specification the reader already has. And
a previous package that is missing, unreadable, not a brand.json, for a
different brand, later than this build, or **carrying the same version number as
this one** is refused in the designer's language rather than compared — that last
one being what a version number exists to prevent.

Four defects came out of it, three older than the round.

**A stroke written where SVG writes it was not read.** `thinnestStroke` wanted
`stroke` and `stroke-width` on the same element. A mark that puts the colour on
the group and the widths on the paths — which is how anyone draws a mark in one
colour and two weights — reported no stroke at all, and the floor fell back to a
measurement off the render. Three of the twenty-two fixtures are drawn that way.
Ravelston's manual certified a size at which its finest line paints **1.94 px
against its own 2.4 px rule**; at the corrected floor it paints 2.44. The lesson
was already written down twenty lines away, in `checkIcon`, which carries paint
down the tree and says why: "an icon with the wrong weight passes silently,
which is worse than not checking at all."

**The icon grid took the thinnest weight, which is the only weight until it
isn't.** `minimumSize.thinnestStroke` was already computed, so the icon grid used
it — never argued for, and identical to "the mark's weight" for every mark drawn
in one. Tarnbrook's arch is 9 and its brook is 4.5, and the whole icon set came
out at half the weight of the mark it belongs to. Icons take the weight the mark
carries its shape in now, and a mark with more than one says so in the build.

**And it took it from the wrong drawing.** An identity that ships a simplified
drawing for its icons has the files and the floor cut from it — and the grid in
its manual was still worked out from the full mark. Ravelston's icon drawing is
13 units on a 120 box; the grid it handed the client said 0.6 on 24, a quarter
of the weight of the only icon in the package. The checker worked its own rule
out separately, so `check --icon` and the manual could disagree; both read the
one grid now.

**brand.json said 34 files in a package of 43.** It counted what had been written
at the moment it was written, and the read me, the manual, the deck, the canvas,
the licence and the zip all come after. Every package ever built was wrong the
same way, in the one file whose job is to be read by software. The list of names
still to come already existed for the asset index; it is worked out before
brand.json now, and both read it. Under it was a second one: Skerry ships one
face for two roles, so the same file was written twice and counted twice.

## A twenty-third identity

Twenty-two identities, and every asset in every package belonged to the brand it
described. The mark, the logotype, the icon, the photographs, the typeface: all
of it the client's, all of it the engine's to clean, recolour, rescale and cut
into a hundred files. The whole method rests on that — one master, everything
derived from it — and a grep for anything resembling a second party found
nothing at all.

**Kilnsey** makes grants in Wharfedale and its mark is never seen alone. Every
project it funds carries it beside the recipient's own, and the recipient's mark
is not Kilnsey's to change:

    "partners": [
      { "name": "Ingleby Sailing Club", "owner": "Ingleby Sailing Club",
        "files": { "crag": "partners/ingleby.svg",
                   "reverse": "partners/ingleby-reverse.svg" } },
      …
    ]

The keys are our colourway names, because that is the question being asked: on
which of our grounds may this mark stand, and in which of their versions. They
answer it once, with a file, and where there is no file there is no pair. Almost
every rule the engine applies elsewhere is wrong here — their artwork is not
recoloured into our palette, not redrawn to fix its faults, and not swapped for
another of their versions when the one asked for is missing. Barrowden's file
even marks its ink with `data-slot`, which in our own artwork means *paint this
from the colourway*; in theirs it means nothing we are entitled to act on.

What is left is measuring, and measuring is where the pair stops behaving like
either of its halves.

    the Ravensworth Hospice pair in crag holds at 549 px, where horizontal on
    its own holds at 152 px — set by their mark

A pair is a third drawing. It is wider than ours and it contains whatever is
finest in theirs, and both put the floor up. Their manual states their mark
alone and ours states ours, and the pair's own figure appears in neither. The
first divider the engine drew between two marks was set at 0.4 of the thinnest
thing we draw, which made **the rule between the brands the first thing to
disappear** and the thing that decided how small the pair could go; it is drawn
at the full weight now, and the check still fires if anyone thins it. Matched on
height, Barrowden's logotype is 2.3 times the width of everything else in the
pair, so the engine says so and names the two settings that change it: matching
two marks on one measurement is the convention, and a logotype beside a symbol
is the case it fails on.

**And the same question, asked of the package itself, had a worse answer.**

A minimum size is a property of a drawing: a width, divided by the thinnest thing
inside it. Every package this engine has ever built states one, measured off the
master — and then hands over four lockups and a read me saying `01-horizontal` is
"the default, use this unless the space is too narrow". At the figure Meridian's
manual prints, its horizontal lockup lays down **0.48 px** of ink against a rule
of 2.4. Beaumont's lays down **0.14** against a rule of 3. Winterbourne's 0.18.
Twenty-three identities, every one of them certifying a size at which its own
default lockup is a smear.

Every drawing states its own floor now — in the read me by folder, in a table in
the manual, under each lockup in the deck, and in `logo.minSizes` in brand.json —
and the twenty-second round's comparator watches each of them from one version to
the next.

Two more, both older than the round. `assets.partners` reached `path.join` as an
array and produced *"the path argument must be of type string"* — the third
time, after photography in the sixteenth round and documents in the
twenty-second, that a new kind of asset was met by a Node type error and the
skip list grew by one. The loader names what a single file is now, and anything
else is a question with an answer. And the first draft of the partner contrast
check tested every colour in their file against our ground, so Ingleby's sail —
white, inside their blue disc, where white is exactly right — was reported as
disappearing into a page it reads on perfectly well. A mark has a silhouette as
long as one of its colours reads.

## A twenty-fourth identity

Every claim this engine has ever made about accessibility is a WCAG contrast
ratio, and a contrast ratio is a ratio of **luminance**. It is the right measure
for text on a ground, and it is silent about the thing colour is mostly used
for. Two colours can sit at a comfortable ratio against the page and be the same
colour *as each other* to one reader in sixteen, because what separates them is
hue and hue is what a colour vision deficiency takes away. A grep across
twenty-three rounds found no mention of it anywhere.

**Deben** warns an estuary when the water is coming, in three states:

    "sets": {
      "states": {
        "of": ["clear", "prepare", "act"],
        "why": "They appear together on every gauge board, tide table,
                roadside sign and phone alert, and a reader has to tell
                them apart at a glance, often at speed and in bad light."
      }
    }

`tokens.sets` is the only place a project says *these are read together and have
to be told apart*, and saying so is what invites the check — a palette of six
colours has fifteen pairs and most of them never appear side by side, so
reporting all fifteen is noise. Naming the three that carry a meaning turns a
curiosity into a requirement. Deben's green and red are 67 ΔE apart and 2.8
apart to a deuteranope, and both pass every contrast check in the package:

    ✗ the "states" set is told apart by colour alone, and one of its pairs
      is the same colour to some readers
      → Give every colour in the set a second channel and say what it is,
        in tokens.sets.states.apartBy

The answer is `apartBy`, one per member: an open ring, a half ring, a solid
disc. The engine checks that every member has one and that no two share it —
a second channel only some of the set carries is not a second channel — and
then the manual prints the palette four times over, once as you see it and once
for each of the three dichromacies.

**Everything else it found was already in the repository.** Twelve of the
twenty-four palettes carry a pair that separates for most readers and not for
all; those are notes, because a pair is only a fault if something depends on
telling it apart, and `tokens.sets` is how a project says which. Vesper's whole
identity is a gradient, and one length of it — flare to ember, 63 ΔE — does not
travel at all for a tritanope: that stretch is a flat fill, and whatever the
movement was doing is not happening. Northline's `signal` and `north` are 101
apart and 8.6 apart to a protanope.

And **the first version of the simulation was wrong**, in a way worth writing
down. The coefficients in Viénot, Brettel and Mollon are defined on *cone
responses*, and most of the versions circulating apply them straight to linear
RGB. Done that way they do not preserve the achromatic axis: the first thing
this module drew was Deben's near-white paper rendered as cyan. A dichromat sees
white as white, grey as grey and black as black, and a simulation that moves
them is wrong everywhere, not only on the greys. RGB → LMS, project, LMS → RGB —
and the fixture had to be redesigned, because the wrong maths had exaggerated
the red-green collapse and the amber and red it was built around turned out to
be perfectly distinguishable.

Two more. `tokens` was outside the unread-key audit entirely, so a whole branch
of a project file could be written, saved and shipped with nothing reading it —
which is exactly what `tokens.sets` did on its first run. And a refusal raised
while *building* printed one line of an `Error` and lost its why and its how:
the loader has reported findings in the designer's language since the first
week, and nothing had ever thrown findings from inside `build`, so nothing had
ever noticed.

## A front door

Sixteen rounds, and the only way into the engine was to hand-write a project
file and run a command. The artwork audit — the part that tells a designer
something about their own export that they did not know — was a paragraph of
terminal output nobody outside this repository had ever seen.

    handover serve            # http://localhost:3000

Three screens. **Drop the artwork**, and it reads the file before anything is
decided: what the normaliser cleaned out and why, the ink box against the
canvas the file declares, clear space, the thinnest part, the smallest the mark
may go on screen and in print with the arithmetic that got there, and which
parts of it carry a colour slot. **Name it and pick the ink**, starting from the
colours already in the artwork, commonest first, with WCAG ratios recomputed as
you type — from `contrast.js` served to the page rather than a second copy
written into it, because two implementations of one number is two answers.
**Take the package**: the manual, the deck, a published cover, the canvas and
the zip, each at a real URL.

Nothing here reimplements anything. Both handlers write a real project into a
temporary directory and go through `project.load` and `build` exactly as the
CLI does, so what the app reports is what the command line reports. It listens
on localhost and uploads nothing, which is not a limitation: brand artwork is
usually under an NDA before it is under anything else.

The same app runs hosted, off `api/inspect.js` and `api/build.js`, which are
wrappers around those same handlers. One thing genuinely differs there and the
page says so rather than hiding it: a serverless function has no filesystem it
can share with the next request, so it cannot serve a package file by file. It
sends the zip — the package, compressed, in one answer, about 300 KB for a plain
identity — and the browser opens the documents out of it. They open in a tab and
do not survive a reload, because they live in the page's memory.

Two defects the app found in its first hour, both in itself:

**A lone logotype was built as a mark called one.** `assets.mark` was always
set, because every fixture had a symbol, so a designer dropping only a wordmark
got it in `03-mark` with the manual calling it the mark — reintroducing exactly
the confusion the thirteenth round existed to remove. Either asset may be the
only one now, at the front door as well as in the loader.

**The advice on a warning was only true in one of the two places it could be
read.** The CMYK finding said to "put it in the project as `cmyk`: [c, m, y,
k]", which is right in a text editor and meaningless in a browser where the
field is on the screen in front of you. A `how` written for one host is wrong
on the other; it names the four numbers now and not where they get typed.

And two more, from hosting it. **A deploy uploads what its tracer can see, and a
tracer sees `require`.** The editor is assembled by reading nine files as text
and inlining them; eight are `require`d elsewhere in the engine and so were
uploaded by accident, and `app.js` is required by nothing because it is browser
code. Nothing traced it, nothing uploaded it, and the first hosted build died on
`ENOENT /var/task/engine/src/editor/app.js`. `vercel.json` names `engine/src/**`
now, and a test asserts that every path `emit.js` reads is inside it.

**The build answer called two different things
`zip`** — the file's name, which the local server needs for a URL, and the bytes
the hosted function sends. `Object.assign({ zip: bytes }, r)` put the name over
them, and a 412 KB response arrived as 562 bytes: no error, no exception, a
`200`, and a field of the right type holding the wrong thing. Argument order was
the mechanism. The name was the cause, and renaming the payload is the fix.

## What it does not do yet

- **EPS.** Rarely asked for now that print shops take PDF, but not written.
- **Open path detection.** A path that is filled but never closed renders
  differently in some tools, and that is not checked.
- **Overlapping identical shapes.** Duplicate artwork stacked on itself measures
  correctly and still doubles the file size.
- **Motion is CSS only.** It plays in a browser. Exporting Lottie or a video is
  not written.

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
    src/system.js     the rules: icon grid off the mark, pattern, motion
    src/photography.js  the duotone, the scrim, and what a treated pixel becomes
    src/print.js      trim, bleed and media boxes, and the marks between them
    src/cmyk.js       declared ink, total coverage, rich black, and the refusals
    src/paths.js      svg path data reduced to move, line and cubic
    src/typst.js      a printed piece, in ink, for Typst to compile
    src/surface.js    the mark mapped into a surface, and whether it reads there
    src/licence.js    plans, signed licences, and what the client owns
    src/pattern.js    seamless tiles cut from the shape you marked
    src/documents/    blocks.js, chrome.js, index.js (manual), deck.js
    projects/meridian/  the first identity: one stroked mark, one ink
    projects/halyard/   the second: filled artwork, two inks, four faults left in
    projects/kvist/     the third: fills and a stroke, a 252x90 box, a name in Norwegian
    projects/hallward/  the fourth: two colours, one colourway, a seal in a 2048 box
    projects/northline/ the fifth: twelve colours, eight colourways, a mark drawn with <use>
    projects/perigee/   the sixth: a web export — hsl(), a named colour, no slots at all
    projects/maayan/    the seventh: named in Hebrew, written in Hebrew, reads right to left
    projects/thornbury/ the eighth: a file edited by three people since 1998
    projects/cusp/      the ninth: the project file is the thin part, not the artwork
    projects/fathom/    the tenth: the graphic language is the pattern
    projects/spire/     the eleventh: 1 to 4.7, six colour slots, a floor that is a width
    projects/vesper/    the twelfth: a gradient, which is not one colour
    projects/marlow/    the thirteenth: a logotype, with no symbol to fall back on
    projects/beaumont/  the fourteenth: a long name and prose in every field
    projects/yarrow/    the fifteenth: all four rule blocks, each overridden in part
    projects/saltmarsh/ the sixteenth: the identity is the photography
    projects/winterbourne/ the seventeenth: a licensed typeface, shipped with it
    projects/ravelston/ the eighteenth: an engraved crest, and an icon of its own
    projects/yamabiko/ the nineteenth: Japanese, which has no spaces in it
    projects/lammas/  the twentieth: it ships the pages somebody laid out
    projects/skerry/  the twenty-first: a symbol, and a name that is set not drawn
    projects/tarnbrook/ the twenty-second: a second version, built against its first
    projects/kilnsey/ the twenty-third: half of every pair belongs to somebody else
    projects/deben/   the twenty-fourth: two of its colours are one colour to some readers
    src/editor/       model.js, render.js, publish.js, app.js, bundle.js, emit.js
    src/editor/images.js  photographs, kept out of the document and out of undo
    src/naming.js     one naming rule for the whole package
    src/build.js      write the package, brand.json and the read me
    src/cli.js        check, measure, build, edit and publish
    src/typeface.js   how a typeface reaches a document, decided once
    src/setname.js    a name that is set in the brand's face rather than drawn
    src/app/          the front door: handlers.js, server.js, client.html
    ../api/           the same two handlers, as functions, for hosting it
    ../site/build.js  every identity, built into one site, index and all
