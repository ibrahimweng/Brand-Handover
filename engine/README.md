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

An identity states its own language, and the documents are written in whichever
language the engine has strings for:

    "language": "fr"

`src/strings.js` holds the words, and what a language can write is asked **per
document**, because the manual and the deck are not written from the same ones.
Where a document can be written in the brand's language it is. Where it cannot,
it carries the language it is written in and the brand's own words carry theirs —
and the build says which document came out in which, and where the words it is
still missing live.

An identity can state the standard its documents are held to:

    "accessibility": { "standard": "WCAG 2.2 AA" }

Every build measures the manual, the deck and the published page — the chrome's
own type against the ground the page paints, in both themes, at the size each
rule sets; one first level heading and no level skipped; a landmark to skip to;
an accessible name on every drawing that carries meaning and `aria-hidden` on
every one that does not — and writes `ACCESSIBILITY.txt` saying what was checked
and what it came to.

An identity whose mark builds names the parts in the artwork and gives each of
them a step:

    <path data-part="near" .../>

    "motion": { "build": [
      { "part": "hub",  "how": "rises", "from": 0,   "to": 240, "ease": "out" },
      { "part": "near", "how": "draws", "from": 160, "to": 520, "ease": "out" }
    ] }

`how` is draws, rises, fades or turns; drawing needs a stroke, because a fill has
no length to dash. The sequence may only name parts the artwork has. `15-motion`
gets one self-contained animated SVG per colourway, and a reader who has asked
their machine for less movement gets the finished mark and no animation.

A brand with brands inside it names them, and each takes one colour from the
parent's own palette:

    "tokens": { "family": [ { "name": "Maritime", "colour": "tide" } ] },
    "rules":  { "family": { "nameRatio": 0.42, "endorsementRatio": 0.16 } }

Every lockup is composed from the mark's measured ink and the name is set from
the face the project ships, so nothing is drawn and nothing can drift. Both the
endorsed and the plain lockup are written to `14-family` in every colourway, each
with its own minimum size.

An identity that is made as physical things says what they are and how big:

    "fabrication": [
      { "process": "embroidery", "at": 70,  "note": "the blazer badge" },
      { "process": "engraving",  "at": 240, "tool": 3, "note": "the gate" }
    ]

`at` is the width in millimetres. Processes are embroidery, vinyl, screenprint,
foil, engraving and cast; each has a smallest feature it can hold, and `feature`
on the entry moves it, because a maker who knows their own machine knows better
than this file. The drawing sent to each is the most detailed one that survives,
written to `13-fabrication` at true size in millimetres.

An identity that steps down through simpler drawings as it gets smaller ships
each of them, and states the order:

    "assets": { "mark": "mark.svg", "tiers": [
      { "name": "compact",  "file": "mark-compact.svg",  "note": "…" },
      { "name": "monogram", "file": "mark-monogram.svg", "note": "…" } ] },
    "rules":  { "ladder": ["horizontal", "mark", "compact", "monogram"] }

A rung is a lockup the package already contains or a tier drawn for the purpose.
Each band runs from the size its drawing holds at up to where the rung above
takes over; the order is checked against what the drawings measure; icons are cut
from the bottom rung. A mark built on a module says so, and every point in it is
checked against that module:

    "system": { "grid": { "unit": 15, "box": 240 } }

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

## A twenty-fifth identity

The twenty-third round gave every drawing in a package its own floor, which was
right and half an answer. A floor still meant **stop**. Below it the engine had
nothing to say, and the manual's advice at 20 px was the same as its advice at
2 px — which is not how any identity worth the name behaves. Below the size at
which the full mark stops holding you do not stop using the mark. You move to a
simpler drawing of it, and below that to a simpler one again, until what is left
is a silhouette that survives at sixteen pixels. This is the standard pattern in
responsive identity work, and the engine had no concept of it at all.

**Oriel** is a gallery in a building whose front is a bay window, and its mark is
that bay drawn in elevation on the building's own module — sixteen units square,
every point a multiple of fifteen, stroke weights of two thirds, one and four
thirds of a unit. It ships as five drawings:

    "ladder": ["horizontal", "mark", "standard", "compact", "monogram"]

    horizontal    100 px and above
    mark          58–99 px
    standard      39–57 px      two mullions instead of four
    compact       29–38 px      the bay and its corbel, nothing inside
    monogram      13–28 px      the silhouette with one aperture

Which drawings are in the ladder is a decision and the project states it. The
order is not a decision: it is what the drawings measure, and a stated order that
disagrees with the measurement is refused rather than accepted. So is a rung
named in the ladder that is neither a lockup nor a tier, a tier whose file is
missing, and a ladder of one — which is a minimum size with a longer name.

Every rung is cut in every colourway into `12-ladder`, each band runs from the
size the drawing holds at up to where the one above takes over, and the bands
meet with no gap. **The identity holds at 13 px where the drawing at the top of
the ladder holds at 100.** Every icon and favicon is cut from the bottom rung,
because that is the drawing this identity uses at the sizes an icon lives at,
and all four sizes clear where the full mark would have cleared none.

**And a construction grid is a claim.** The manual has drawn one since the
beginning: six divisions of the box, chosen because six looks like a grid, over
artwork built on whatever it was actually built on — a decoration, under a
caption saying the mark was constructed on it. Where a project states its module
the diagram now draws that module, and every point in the master and in every
tier is asked whether it is on it, to a hundredth of a unit. Oriel's forty-six
points all are. Move one two units and the build names it.

Four things it found on the way, all of them mine or older.

**`mark` in the build meant two things.** It was the artwork icons are cut from
and the shape the pattern is cut from, and those were the same file until a
ladder could say which drawing is used at icon sizes. Fathom's whole identity is
its pattern; it would have been cut from a monogram and nothing would have said
so.

**A check that could never fire.** The first version of "is this rung simpler
than the one above" let a heavier stroke stand as a reason to say nothing. A
floor is the box divided by the thinnest thing in it, so a rung that holds
smaller *always* has relatively heavier lines: the escape clause was every case.
It went unnoticed until the check was tested rather than read.

**A check that cried wolf.** The first version of "is this rung the same shape as
the one above" compared each rung with whatever preceded it, and flagged every
well-made ladder in the repository — a horizontal lockup is 0.43 tall for its
width and the mark under it is 1.1, and that step is the entire point of the
step. It asks of the tiers against the mark they are drawings of, which is the
only comparison that means anything.

**Both captions on the construction diagram were written twice** — once to work
out how wide the canvas has to be, and again in full inside the text that draws
them. They agreed for as long as nobody edited one.

## A twenty-sixth identity

Since the twenty-second round the engine has been writing this sentence into
packages: *"anything already made between 32 px and 64 px was inside the rule —
small print, favicons, embroidery, anything cut in vinyl."* It had never measured
one thing about embroidery or vinyl. Twenty-five identities specified in pixels
and millimetres of ink, for brands that mostly exist as objects.

**Ancroft** has been cutting the same arms into things since 1614: a blazer
badge, a cap badge, a house tie, the stone over the gate, a minibus door, games
kit, a bookplate, a bench plaque. Each is a process and a size:

    { "process": "embroidery", "at": 70,  "note": "the blazer badge" }

A process is a floor like every other floor here, in a unit the engine already
works in. A satin stitch below about 1.3 mm will not lie down; vinyl below about
2 mm tears when the waste is weeded; cast metal below 1.5 mm will not fill the
mould. Given a drawing, its box and the size the thing is made at, whether it can
be made is arithmetic — and the answer is the most detailed drawing that
survives, which is what the twenty-fifth round's ladder is for:

    embroidery 70 mm     standard, finest part 2.333 mm
    embroidery 32 mm     compact,  finest part 1.6 mm
    embroidery 18 mm     monogram, finest part 2.632 mm

One process, three sizes, three different drawings, none of it decided by
anybody. `13-fabrication` holds each of them at true size, in millimetres, ready
to send. A size nothing can be made at is said out loud with the smallest each
drawing could be made at beside it. The vinyl artwork is told it is drawn in
strokes and a cutter follows outlines. And the stone is told what the tool does:
a round bit cannot cut an internal corner at all, so the six in the shield come
back with the bit's radius on them — 1.25% of the width at 240 mm, which is a
note, and 5% on a 60 mm trophy, which is a warning.

**And the measurement it all rests on was wrong.**

`thinnestFeature` decides every minimum size in every package. For a filled
shape it scans the render for runs that narrow, and then took the *fifth
percentile* of them — a defence against one or two anti-aliased samples. But a
percentile is a share of the sample, and the sample is however much outline the
shape happens to have. Ancroft's monogram is a solid shield with a chevron cut
out of it: the metal beside the cut is 36 units wide and appears on eleven
scanlines out of two hundred and twenty. **The fifth percentile stepped straight
past it and reported 84** — not the narrowest part, but the width of a fairly
narrow one.

Stepping over a fixed handful instead does the job the percentile was for and
does not scale with the outline; the answer is stable from the second smallest
to the ninth on every drawing in the repository, which is what says this is not
noise being chased. Six identities were corrected, all upward, and two were
checked by rendering: at the floor **Beaumont** has published since it was added,
its finest stem paints **2.80 px against its own rule of 3**. Marlow's paints
2.47. Spire's floor was 13 px and is 23.

## A twenty-seventh identity

Twenty-six identities, and every one of them is one thing. Real institutions are
not: a group has museums in it, a university has faculties, a network has lines,
and the hardest question any of them asks is the one this engine had no way to
answer — what is a sub-brand allowed to be, and what does it inherit?

The engine's own rule generalises straight up a level. One master, everything
derived from it: a sub-brand is the parent's mark and **a stated difference**,
and the difference is a name and a colour.

    "family": [
      { "name": "Maritime",   "colour": "tide" },
      { "name": "Print Room", "colour": "rope" },
      { "name": "Yard",       "colour": "kelp" }
    ]

**Harbourne** is three museums round one harbour. Nothing in any of their lockups
is drawn: the name is set from the face the identity ships — the twenty-first
round's work — and the lockup is composed from the mark's own measured ink, the
name at 0.42 of its height, the endorsement at 0.16, the gap at 0.34. A sub-brand
therefore cannot drift from its parent, and a fourth one costs a line in the
project file. A colour that is not in the parent's palette is refused: the palette
is what holds a family together, and a sub-brand that brings its own colour is a
separate identity wearing somebody else's mark.

**And the words are the finest thing in the drawing.** A floor is the box divided
by whatever is thinnest in it, and in an endorsed lockup that is a letter, not the
mark:

    Maritime     in tide   endorsed above 854 px, plain to 418 px
    Print Room   in rope   endorsed above 980 px, plain to 507 px
    Yard         in kelp   endorsed above 797 px, plain to 293 px

The mark alone holds at 29. Every check a group brand runs is run on the mark,
and the number that actually governs the asset is set by "Part of Harbourne" —
around thirty times larger. It is not a fault and there is nothing to fix in the
artwork: it is what the endorsement costs. So the package contains the lockup
without it as well, each with its own floor, and says where to change over —
endorse it above the first figure, drop the line down to the second, use the mark
below that. The same answer the twenty-fifth round gave for size, applied to
words.

The siblings are also asked the twenty-fourth round's question without being
told to. Three sub-brands sharing one mark, one face and one lockup are separated
by colour and by nothing else, so a pair of them that collapses for a colour
vision deficiency is not two museums to that reader — it is one.

## A twenty-eighth identity

Every package this engine has built states how the identity animates: two easing
curves, four durations, and a build sequence naming the parts and when each of
them arrives. The manual printed it as the specification — *"the mark builds in
2 parts: outline draws from the top, fill rises to its line"* — and two things
were true of all twenty-seven.

**No artwork named a part called outline, or fill, or anything else.** And **no
package contained a single file that moves.** The client was handed a
specification for an animation, in prose, about parts that do not exist, with
nothing to play. It is the twenty-second round's shape again: a promise nothing
collects on, kept in perfectly good order because nobody had asked it for
anything.

The contract is the one the colour system already uses. `data-slot` says what a
part is painted from; **`data-part` says what it is when the mark builds**, and a
sequence may only name parts the artwork has:

    <path data-part="near" d="M60 120a60 60 0 0 1 60 60"/>
    <circle data-part="hub" cx="60" cy="180" r="24"/>

**Farne** broadcasts from a rock in the North Sea, and its ident is the mark
arriving: the transmitter, then each arc in turn.

    hub    rises   0–240 ms on out
    near   draws   160–520 ms on out
    mid    draws   300–660 ms on out
    far    draws   440–800 ms on through

`15-motion` holds that, one file per colourway, each a single SVG with its own
CSS inside it — nothing to install, nothing to fetch, nothing that stops working
when a player is not there. A stroke draws itself by being given a dash the
length of the line and having the dash moved off the end; `pathLength="1"` lets
the file state that length as one whatever shape the path is. A fill has no
length to dash, so asking one to draw is a warning and it is written as the
nearest thing that works rather than quietly playing something else. A part the
artwork names that the sequence never moves is a warning too: it is on screen
from the first frame, which reads as the animation having already started.

**And the default build sequence was fiction, so it is gone.** Two curves and
four durations are a real default because they apply to anything — a panel, a
menu, a page. A build sequence is about particular parts of a particular drawing,
and inventing one is describing a mark nobody drew. An identity that has not said
how it builds now reads: *"This identity has not said how the mark builds, so
nothing here does."*

The manual plays the sequence on the page that specifies it, with the timeline
beside it, both from the same data — because a specification for an animation,
printed as prose, is the one thing in a brand manual nobody can check by reading
it.

Round twenty-five's grid check caught this round's own artwork twice: the arcs
were at five and a half units of radius, and the transmitter's radius put its
extremes between grid lines.

## A twenty-ninth identity

The twenty-fourth round taught this engine to ask whether the client's colours
can be told apart, and it has printed a WCAG contrast table since the first week
— measuring the palette against the grounds the client will set text on, on a
page whose own captions are ten and a half pixels of grey measuring **3.18 to
one**.

Twenty-eight identities. Every caption, every column heading, every chapter
number and the footer of every manual, deck and published page, in both themes,
below the standard printed beside them. **The engine checked the identity's
accessibility and had never once checked its own.**

`src/access.js` reads the stylesheet the documents actually ship — not a copy of
its values — works out which token paints which rule and at what size, and
measures every pair against the ground it sits on in each theme. Then it reads
the HTML for what a document has to get right whatever it is about. It found
five things:

- **`--ink-3` failed in both themes**, across nineteen rules each. One token.
- **Seventeen of the twenty drawings** on a manual page had no accessible name
  and were not hidden, so a screen reader announced them as unlabelled graphics
  or skipped them, depending which one it was. `scaled()` names a specimen when
  told what it is and hides it when the caption beside it is the name.
- **No `<main>`** on the manual or the deck: nothing to skip to.
- **The published page had no first level heading at all.**
- And the audit's own first answer was wrong. It took the page's ground to be
  `--surface`, because that is what a token called surface sounds like. The page
  paints `--paper`, a shade darker, and the shade is the whole answer: **4.47
  against 4.61 for a figure that has to clear 4.5.** A browser found it in one
  measurement while the arithmetic here had been agreeing with itself. It reads
  the ground off the `body` rule now.

**Rookhope** runs twelve libraries on one ticket, and states the standard its
documents are held to:

    "accessibility": { "standard": "WCAG 2.2 AA" }

Every package now carries `ACCESSIBILITY.txt`: what was checked, what it
measured, and what it came to — written by measuring the pages beside it rather
than by describing them, so it changes when they do. The hairlines between rows
are named in it as excluded and why, rather than quietly left out. And the canvas
is named as an application rather than a document, whose own accessibility is a
separate question this package does not claim an answer to.

## A thirtieth identity

A project states its language, and the engine has read it since the seventh
round — for `lang` and `dir` on the document, which is exactly right if the
document is in that language. It is not.

**Maayan's manual carried `lang="he" dir="rtl"` around 988 English words and
twenty-one Hebrew ones.** The whole of it was laid out right to left: headings
against the wrong edge, section numbers after their titles, an eyebrow reading
from the wrong end. And the twenty-ninth round made it worse rather than better,
because it checked that a language was *declared* and never asked whether it was
*true*. A speech synthesiser told a page is Hebrew and handed English words reads
gibberish with more confidence than one told nothing at all.

The language of a document is the language it is **written in**. The brand's
language belongs to the brand's own words — its name, its positioning, the
samples in its type scale. Those are two different things and the engine had one
field for both.

    <html lang="en" dir="ltr">
      …
      <h1><span lang="he" dir="rtl">מעיין</span> brand manual</h1>

`src/strings.js` holds the words, in one place, one language at a time. A project
whose language the engine can write a document in gets that document in it:
**Verdon** is a French regional park and its deck is a French document, from
*Taille minimale* on the slide to *boîte 240 ÷ trait 16 = 15 largeurs de trait en
travers* under it. A document it cannot write gets an English one that says so,
in the build and on the page, with the brand's own words marked as the brand's —
which is the honest answer and the one a screen reader can act on. Adding a
language is a block of strings and nothing else.

`src/access.js` gained the check that would have caught it: sample the prose that
carries no language of its own, count the scripts in it, and refuse a page whose
declared language does not match what is actually written there. Its own first
version dropped every element carrying a `lang` — `<html>` included, which is the
claim being tested — and was left with three characters of text on every page in
the repository.

The seventh round's test is rewritten rather than deleted. It was half right and
the wrong half: it found four documents declaring English whatever was in them,
and fixed it by declaring the brand's language on a document written in English.

## A thirty-first identity

The page that says what not to do.

A misuse page is a set of pairs: a picture of the mark treated badly, and a
sentence naming the treatment. The engine drew six pictures in a fixed order —
stretched, rotated, recoloured, shadowed, on a busy ground, outlined — and
captioned them with whatever sentences the project happened to list, in the order
it happened to list them. **Nothing joined a sentence to the picture above it
except the index of an array.**

Measured across the thirty packages built before this round: **132 misuse cells,
of which 33 showed a picture that contradicts its own caption**, and eighteen
more carried a caption about something the engine cannot draw at all, so the
picture beside it was arbitrary.

    Ravelston  "Do not add a drop shadow to make it look engraved."
               drawn: the mark on a striped green ground, no shadow on it
    Ravelston  "Do not place it on a photograph without the reversed lockup."
               drawn: the mark outlined
    Rookhope   "Do not rotate it."          drawn: the mark with a drop shadow
    Oriel      "Do not stretch the mark."   drawn: the mark in magenta
    Lammas     "Do not put Ember behind text."  drawn: the mark with a shadow

**Fourteen projects had a rule about crowding and every one of them got a mark on
a striped green ground**, because crowding was the one thing on that page the
engine had never been able to draw at all. Eight of the thirty stated no misuse rules and got a
numbered heading, a *Drawn by the system* badge and an empty box.

The only page in the manual whose whole job is to be unambiguous was the one page
in it that could not be trusted.

So a misuse rule is not a sentence any more. `src/misuse.js` holds ten treatments
the engine can perform on the identity's own artwork; a rule names one, the
engine writes the sentence from the treatment it drew, and the designer's reason
follows underneath in their own words — the half a machine cannot supply.

    "misuse": [
      { "do": "redraw", "part": "label",
        "why": "A disc with nothing in the middle is a target." },
      { "do": "undersize", "why": "Below the floor the grooves close into one ring." },
      { "do": "crowd",  "why": "Clear space here is the label itself." }
    ]

    stretch    the mark scaled on one axis only
    rotate     the mark turned off its baseline
    crowd      the clear space rule with type and rules set inside it
    undersize  the mark below the floor measured for it
    recolour   the mark in an ink that is not in the palette
    shadow     the mark with a drop shadow under it
    outline    the mark hollowed out and keylined
    busy       the mark on a ground it has to compete with
    redraw     the mark with one named part taken out of it
    retype     the name set in a face that is not the identity's

Four of the ten are new, and they are the ones a real manual keeps asking for.
`crowd` draws the clear space rule from the same two numbers section 1.3 states,
with a block and two rules set inside it. `undersize` draws the mark at the
figure the third step of the minimum size block already calls *below the floor*,
inside a dashed box the size of the floor. `redraw` takes a named part out of the
master. `retype` sets the brand's name in whatever face the machine already had.

Two things fall out of it, and both are worth having.

**A project can only forbid what the engine can draw.** A rule about redrawing
part of a mark requires the artwork to name that part, with the `data-part` the
twenty-eighth round added — so Winterbourne, Yamabiko and Lammas name a stave, an
echo and a band, and the rule and the drawing are about the same thing. Eleven
rules across the fixtures survived the migration and are not on this page any
more: seven were about something other than the mark — a poster's type size, a
colour behind text, the face a name is set in — and four were about the drawing
in a way that taking a part out of it cannot show, among them Oriel's *do not
redraw a tier to sit between two of them*. A rule the engine cannot draw is a
caption over the wrong picture, which is the whole of what this round is about.

**A rule can be checked against the rest of the identity.** `contradictions()`
compares the rules with what the identity actually does:

    ✗ the manual says never rotate the mark, and the ident turns inner
      and middle and outer.
      One of the two is wrong, and a reader who watches the ident and then
      reads the page cannot tell which. A rule the identity itself breaks is
      worse than no rule, because it teaches the reader that the rules on
      this page are decoration.
      → If the mark turns, drop the rotate rule and say in the ident section
        what the turn is for. If it does not, take the turn out of
        system.motion.build.

**Carrock** is a sound archive: a disc read from the outside in, three grooves
each interrupted where the one outside it left off, and a label in the middle.
The ident is the disc coming up to speed — the label arrives, then each groove
turns into line behind it. **The mark turns**, so its manual has no rule against
turning it, and the engine refuses one. Its six rules are `redraw`, `undersize`,
`retype`, `crowd`, `recolour`, `busy`: four of them things the old page could not
draw, and none of them in the old fixed order.

Built with the code as it stood at the end of the thirtieth round, all six of
Carrock's cells showed the wrong picture:

    cell 0  the mark stretched     under "Do not redraw the label…"
    cell 1  the mark ROTATED       under "Do not use the mark below its floor…"
    cell 2  the mark in magenta    under "Do not retype the name…"
    cell 3  the mark shadowed      under "Do not crowd it…"
    cell 4  on a busy ground       under "Do not recolour it…"
    cell 5  the mark outlined      under "Do not put it on a photograph…"

The second cell is the one that matters: a manual forbidding, in a picture, the
one thing this identity does on purpose.

Carrock is also set out in radii and degrees rather than on a square module, so
it states no `system.grid` — the engine checks every point against a declared
module, and a polar drawing fails that check honestly. It said so, and the fixture
took the note rather than the claim.

The deck's misuse slide had the same fault and one of its own: a heading reading
*Six ways it breaks* whatever the count, every mark painted in the ground colour
whatever it stood on, and the same six treatments in the same fixed order. Both
documents draw from one list now, so they cannot disagree about what a rule
forbids, and a project with no rules gets no slide and no line about one on the
divider.

And the deck turned out to be carrying the thirtieth round's own fault. Every
slide in `documents/deck.js` was an English literal, so **Verdon shipped a French
manual and an English deck, both under `lang="fr"`** — a page claiming a language
it is not written in, which is exactly what the round before had finished fixing.
A dictionary was made to say which documents it can write:

    const FR = { lang: 'fr', … writes: ['manual'] };
    resolve(project, 'manual') → fr        resolve(project, 'deck') → en

Each document said which language it was in, and the build said why they differ,
which was the part that could not wait. The next round found that the list was a
hand-typed claim and measured it: see *What a language actually writes* below.

## The pattern the engine would not draw

`src/pattern.js` opened with this:

    // Which shape is the decision, so the designer marks it in the master with
    // data-pattern="source". Nothing here guesses.

That reads as principled and is not. **No file coming out of Illustrator or
Figma carries that attribute**, so for every real user the pattern chapter did
not exist. Nine of the thirty-one identities in this repository had a pattern,
and they had one because the attribute was typed into the master by hand. The
other twenty-two shipped this instead:

    warning: no pattern was written. Nothing in the master is marked as the
    pattern source. Add data-pattern="source" to the shape the pattern should
    be built from. It is a decision, so the engine will not pick one for you.

Refusing to guess is right when a guess would be a claim nobody could check. It
is wrong when the engine can **measure** the answer, show its working, and offer
the alternatives. So it reads every shape in the drawing, ranks them, builds from
the best one, says which and why, and offers the rest.

    the first shape in the drawing — it is close to square, so it repeats as a
    field rather than as stripes, it is a substantial part of the drawing rather
    than a fragment of one. Ranked first of 5 shapes in the drawing.

A shape is ranked on four measurements, not on a rule of thumb: how square it is
(a long shape tiles as stripes), how simple (a motif is read at a tenth of the
size the mark is), what share of the drawing it is, and **how much of its own box
it actually inks** — measured by rendering it. That last one matters: Hallward's
best-scoring shape was a hairline ring. Close to square, simple, a good share of
the drawing, and three per cent ink. Tiled, it was an empty page.

Then nine constructions, each seamless by construction rather than by careful
drawing — anything crossing an edge is emitted again one tile away and the tile
is clipped to itself, which is what makes `scatter` possible at all:

    grid       a straight repeat, every instance the same way up
    halfDrop   rows offset by half a cell, the way a textile repeats
    brick      columns offset by half a cell, the way brickwork courses
    rotary     a block of four, each turned a quarter more than the last
    mirror     a block of four, reflected across both axes
    scale      the same shape at four sizes, the way the size ladder steps down
    scatter    placed at intervals that do not line up, never twice the same
    lines      rules at the weight the mark is drawn in, at its own pitch
    arcs       quarter turns at the mark's weight, meeting across every edge

`tile: 100` and `weight: 3` are gone. How large the field reads is a judgement
about the piece it goes on, so the cell size stays a decision; everything inside
it is a proportion off the artwork. The line weight is the same fraction of the
motif that the mark's stroke is of the mark. The air around it is the clear space
rule the identity already states. And a **filled** shape tiles as a fill — every
tile used to be drawn `fill="none" stroke=…` whatever it was, so Meridian's tide
lens came out as a hairline outline of itself and Hallward's seal as nothing.

Which construction, where nobody has said, comes from the motif: Marlow is a
logotype and its shape is one fifth as tall as it is wide, so it gets a line
system rather than six lines of small print repeated.

**What a browser found that the code could not.** Every construction built, and
`arcs` did not tile: four hooks facing the same way, meeting nothing. It was
drawn from four corners with the wrong sweep, and no assertion in the engine
could have known — the tile was valid, seamless by the same wrapping as the
others, and wrong. It took a contact sheet and looking at it.

**What a real export found that the fixtures could not.** Kvist's master is an
Illustrator file and carries `<style>`, `<metadata>`, a `<clipPath>`, a
`vector-effect="non-scaling-stroke"`, and this:

    <rect x="0" y="0" width="228" height="49" opacity="0"/>

The invisible bounding box Illustrator leaves behind. It made the motif measure
the whole artboard rather than the mark, so the pattern was built at the wrong
size — and when the tile was clipped, resvg did not throw, it **panicked from
Rust and aborted the process**. A build that dies is worse than any wrong answer.
A motif is reduced to the shapes it draws now: no ids (it is drawn many times
over), no clip paths, no non-scaling strokes, and nothing that draws nothing.

Thirty-one of thirty-one identities ship a pattern: 300 tiles, every one seamless
in both directions, and the seeded scatter builds the same field twice.

## Four books, and six questions

Every manual and deck this engine had written looked the same. One stylesheet,
one set of proportions, one idea of how a page is arranged. Defensible for a tool
that measures things and indefensible for one that presents them: a brand book is
a piece of design, and choosing between a quiet editorial system and a loud one is
a real choice about how an identity is introduced.

`src/directions.js` holds four, and they are systems rather than themes. Swapping
colours is a theme. These change the modular scale the type is built on, the
measure, the page width, how much air a specimen stands in, how heavy the rules
are, whether the brand's own display face sets the headings — and, the part that
makes them four books rather than one book four ways, **how the page is
organised**:

    quiet      the section heading sits in a column of its own and the work runs
               beside it, so a page reads as one measure with a margin
    technical  everything numbered lives in a rail down the left, so a reader
               looking for 1.4 runs a finger down a column
    warm       centred, narrow, no rules anywhere, soft panels, generous rhythm
    bold       a chapter opens as a band across the page rather than as a rule
               above a heading

The whole of a direction is tokens plus a short override block, applied by a
`data-dir` attribute on the root. No markup branches on it. Four copies of a
hundred and thirty lines of CSS would be four things to keep in step, and they
would not stay in step.

**The first attempt was four variations, not four systems.** Margins, rule
weights, a number size. Built, valid, and a client would not have felt they were
choosing between anything. It took rendering all four side by side to see it; the
fix was to stop varying proportions and start varying structure.

**The audit caught the band.** A chapter opener that reverses out on the ink was
reported as failing at 1 to 1 — because `chromeContrast` read every rule's colour
against the *page*, and could not see an element that paints its own ground. The
same shape of mistake as the twenty-ninth round's `--surface`: the arithmetic was
right and it was pointed at the wrong thing. It reads a rule's own `background`
now, and the band measures 18.6 to 1.

### Six questions

A brand package has about forty decisions in it. Most are facts about the artwork
— the thinnest stroke, the floor, the colours, the parts, which shape carries a
repeat — and the engine measures every one already. Asking a designer to type in
something the file can be asked is how a tool grows a fourteen step wizard nobody
finishes.

`src/intake.js` asks six, and three of them are the engine showing its own answer
and asking whether it is right:

    1  what it is called                    cannot be measured
    2  what it does, in one line            cannot be measured
    3  how it should be laid out            shown, four ways, with your own logo
    4  where it mostly lives                cannot be measured, and decides a lot
    5  the colours                          read off the file, confirm the roles
    6  what it must never do                suggested from the drawing

Question four is the one that earns its place: *where does it live* switches on
the formats, the sizes, the stock and the making. Say screens, print and things
people wear and the package comes out as SVG, PNG, PDF and .ai, at three sizes,
on coated stock, checked against embroidery at 70mm and foil at 40mm — none of
which anybody had to type.

Question five is measurement wearing a question mark: every colour in the file,
ordered by how much of the drawing it covers, with a role proposed for each. The
darkest is what the mark is drawn in, the lightest is what it stands on, the one
furthest from grey is the one doing the work. Question six is the ten treatments
from `src/misuse.js` with the ones that apply to this drawing already ticked — a
suggestion to untick is a better question than a blank list.

Six answers and a drawing make a 73 file package, and the only thing it complains
about is CMYK, which genuinely cannot be measured: it has to come from a printer.

## The type, and the last link out

A `google: true` family became a `<link>` to fonts.googleapis.com. Three things
were wrong with that and only one of them is about privacy:

- **the document did not work without a network.** Open a manual on a plane and
  the identity is set in Georgia. It bit this repository during the layout work:
  four preview pages hung for thirty seconds each waiting for a stylesheet.
- **the package was not self contained**, which is the one promise the whole
  engine is built on — *the client keeps this whether or not anyone is still
  paying for the tool that made it* — and it was not true of the type.
- **the build was not reproducible**, because the bytes came from somebody
  else's server and could change under it.

`fonts/` holds the faces now: eleven families, sixty-four woff2 files, with a
manifest of the weight and unicode subset each one covers and the copyright
notice each one ships under. `src/typefaces.js` inlines them into every document
as data URIs and writes them into `09-type` with the licence. Nothing is fetched
at render time and nothing is fetched at build time.

Which subsets go in is measured rather than assumed. A `unicode-range` stops a
browser *downloading* a subset it does not need, and a data URI is already
downloaded, so the range saves nothing once the bytes are inline — the filtering
has to happen first. The document's own words decide it: **an English manual
carries four faces at 162 KB and a French one carries eight at 296 KB**, because
French needs Latin Extended and English does not.

That costs something, and the package says what: *the type is 453 KB inlined into
each of the documents, which is what it costs to open one with no network at
all.* A size threshold as a warning would fire on almost every project and mean
nothing, so the warning is the precise version of the same question — **a weight
the type scale never sets**, carried in every document for nothing, named with
what it costs.

## A front door that asks six questions

`src/app/client.html` is four screens: drop the artwork, answer what the file
cannot be asked, choose a layout by looking at four of them drawn with your own
logo, and take the package. The page sets its own type in faces the engine holds,
inlined by the server — the front door was the last thing in the product still
reaching out for a stylesheet.

Two endpoints stand behind it. `/api/ask` returns what was measured together with
the six questions, so the screen never guesses at something the engine already
knows: the palette with a role proposed for each colour, the named parts, the
floor, and the pattern it would build. `/api/preview` returns the four layouts as
whole pages, drawn through the same stylesheet the real manual uses and painted
in the identity's own ink — a preview in black is a preview of something else.

Driven end to end in a browser: two SVGs in, four parts and two colours measured,
six questions, four layouts rendered, seventy-three files out, **no request
leaving the application and no error in the console**.

## The edits somebody makes by hand

This engine's whole architecture is that nothing is typed twice. Every value in
every document is measured off the master or worked out from the project, so
changing the master changes all of it. Editing a document by hand breaks that,
and it is also the thing anybody actually needs: no engine writes a sentence
about a mark as well as the person who drew it.

So an edit is not a change to a document. It is a **replacement for one derived
value**, stored against a key, and re-applied every time the documents are
built.

**The whole design is in what the key is.** A key of "the third paragraph in
section 2" is the misuse page's mistake again — two things joined by position,
right until anything moves. A key names the value:

    content/markRationale        why the mark is what it is
    misuse/redraw/why            the reason under a misuse rule
    pattern/construction         how the pattern repeats
    colour/<name>/name           what a colour is called
    section/1.4/title            the title of a section

Sections can be added, removed and renumbered under it and the edit still lands
on the thing it was about. A key that matches nothing is **refused**, not
ignored: an edit that silently does nothing is worse than one turned away,
because whoever made it goes on believing it took.

Two of these change what is *built* rather than only what is written —
`pattern/motif` and `pattern/construction` are applied where the rules resolve,
so choosing a different repeat by hand cuts different tiles.

### What it is worth, measured

The same project, built twice, with the master swapped for a different mark
between the two and the same two edits in place both times:

                              the disc      a different mark
      floor      derived      61 px         60 px
      clear space derived     30.4          21
      pattern    derived      the marked shape   the first shape
      my paragraph  by hand   kept          kept
      my reason     by hand   kept          kept

That is the contract, and it is a test rather than a claim.

### An override has to keep facing the engine

An override records **what it replaced**. When the engine derives that value
again and gets something different, the edit is sitting on top of a changed
identity — the mark was redrawn, so the sentence about its construction now
describes the old one. That is not an error; the person may still mean it. But
it is the one thing nobody can see by looking at the document, so the build says
it every time, and the words stay on the page while it does.

`overrides.json` travels in the package. There is no account and no database:
the thing that comes back is the thing that went out, and this is the half of it
that is not the drawing. Delete a line from it and that value goes back to what
the engine works out.

### Editing them

The front door gained a screen. The manual is shown as it stands and edited in
place: every value a person may replace carries its key in a `data-edit`
attribute, the app makes those elements editable, and a change is recorded
against the key rather than against the markup. A value nobody has written yet
is shown as an empty line to put the cursor in, because otherwise the only
paragraphs that could be changed are the ones that already exist and nothing
could ever be added.

The first version put the key on the whole caption of a misuse cell, which
contains the engine's sentence *and* the designer's reason — so editing the
reason replaced the rule with it. The rule is a statement about the picture
beside it and is not anybody's to rewrite; the key is on the reason alone.

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

The same app runs hosted, off wrappers around those same handlers in `api/`.
(There were two at this point, `inspect.js` and `build.js`; there are four now
and `inspect.js` is not one of them — see "The upload that failed with a parser
error" and "The audit had been taken off the door it was written for" below.)
One thing genuinely differs there and the page says so rather than hiding it:
a serverless function has no filesystem it can share with the next request, so
it cannot serve a package file by file. It sends the zip — the package,
compressed, in one answer, about 300 KB for a plain identity — and the browser
opens the documents out of it. They open in a tab and do not survive a reload,
because they live in the page's memory.

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

## The manual's body, and where its words actually lived

The round before this one moved the deck into the dictionary and measured what
was left. What was left was the manual: **1,453 words of prose that no dictionary
had ever seen**, so `français` wrote the deck and did not write the manual, and
the build said so with the file named.

This is that file. Most of it was where you would expect — `documents/blocks.js`,
one template literal per block — and the conversion is mechanical: every
sentence becomes a key, every number stays a `{placeholder}`, and the English
value reproduces the literal it replaced. The check that this is true is not a
promise: the English manual of all thirty other identities comes out with **the
same words in the same order** after every chunk, and the harness says so.

Three things were not where you would expect.

**A sentence can be written below every dictionary.** The manual's `<pre>` is
`brand.json` and is English on purpose, and so is `CHANGES.txt` — but the
sentences *inside* them were also the sentences on the page. What a making
process can hold was written in `fabrication.js`:

    what: 'a satin stitch narrower than this will not lie down, and reads as a
           crease rather than a line'

Why the engine picked the shape it built the pattern from was written in
`pattern.js`. Which half of a partner pair sets the floor was written in
`partners.js`. And the whole of chapter 00 — fifteen kinds of change, three
sentences each — was written in `previous.js`, which is also the body of
`CHANGES.txt`. Each of those now carries the facts and a key beside the English,
the way `geometry.js` already did:

    whatKey: 'whatEmbroidery'      what: 'a satin stitch narrower than this…'
    whyFacts: { bits: […], all: 14 }   why: 'it is close to square, so it repeats…'
    keys: { what: 'cgMinWhat', … }     what: 'the smallest usable size has gone up…'

**A key that belongs to the engine does not belong in the client's file.**
Adding `labelKey` to the partner floor put `"labelKey": "ptOurHalf"` into
`brand.json` twelve times. `brand.json` carries facts about the brand, not the
engine's string table; the key went back to the document layer.

**Two sections were built with the wrong helper.** `sec()` takes the document's
language and `S()` passes it; chapter 2's contrast and colour-vision sections
called `sec()` directly, so their badge read *Drawn by the system* in the middle
of a French page while every other badge on it read *Tracé par le système*.
Nothing found that but reading the finished page.

Verdon's manual, before and after:

    before   2,255 prose words, 2,034 of them the English build      90%
    after    1,361 prose words,   136 of them the English build      10%

and across thirteen identities chosen so that every block is exercised at least
once — the ladder is only in oriel, the pairs only in kilnsey, the making only
in ancroft, the sub-brands only in harbourne, the ident only in farne, the
changes chapter only in tarnbrook — the worst is 18 per cent, which is `px`,
`mm`, the folder names, the `brand.json` listing and the words the two languages
spell the same way.

The battery asks it of all thirteen, so a sentence still nailed to the source is
caught by the one identity that prints it:

    tarnbrook's French manual is 30 per cent the English one:
    verdon 18%, ancroft 11%, kilnsey 9%, oriel 14%, farne 12%,
    harbourne 11%, tarnbrook 30%

That is the message with the French half of chapter 00 deleted, which is how the
check was proved to have teeth.

## What a language actually writes

The round before this one caught the deck claiming a language it was not written
in, and answered it with a list:

    const FR = { lang: 'fr', … writes: ['manual'] };

A list is a claim. Nothing was checking it, and the way to check it is not to
look at the dictionary — it is to look at the page. Render the same project
twice, once in the language it asks for and once in English, and count the prose
words the two share. `src/strings.js` does that now, in `residue()`, over the
words that could have been translated at all: a number, a hex code, a folder name
and the brand's own vocabulary are the same in every language and are evidence of
nothing.

Verdon, before this round:

    guidelines.html   2,255 prose words, 2,034 of them the English build   90%
    deck.html           638 prose words,   596 of them the English build   93%

Both under `lang="fr"`. The chrome came from the dictionary and the body did not,
and every check the engine had looked at the chrome and passed. `writes:
['manual']` had been true about the chrome and false about the document.

Three things came out of it.

**The deck's words moved into the dictionary — all of them.** Not the headings:
the badges, the slide titles, the captions under the size ladder, *Prev* and
*Next*, the aria-label on every slide, the word for the drawing itself, so a
sentence can decline around *symbole* where English says *mark*.

**The sentences below the dictionary moved too.** Some of the prose in these
documents was never written in `documents/` at all. `geometry.js` returned the
reasoning behind the floor as an English sentence:

    basis: `box ${vb.w} ÷ stroke ${measured} = ${ratio} stroke widths across`

so a French manual printed *box 240 ÷ stroke 16 = 15 stroke widths across* in the
middle of a French paragraph. `contrast.js` returned *Pass AA* and *Never for
text*. `pattern.js` named the motif it had picked — *the second circle in the
drawing* — and described how it repeats. A measurement is a number; how it is
said belongs to a language. Each now carries the facts and a key, and keeps the
English string beside it because `brand.json` and the command line are read as
English whatever the brand is:

    basisFacts: { how: 'stroke', box: 240, width: 16, ratio: 15 }
    basis:      'box 240 ÷ stroke 16 = 15 stroke widths across'
    G.basisText(facts, fr) → 'boîte 240 ÷ trait 16 = 15 largeurs de trait en travers'

**And one document was quietly speaking the other's language.** The misuse cells
are drawn from one list so the deck and the manual cannot disagree about what a
rule forbids — and the list read `ctx.L`, which is the *manual's* language. Five
of Verdon's deck captions were French inside a document declared English.
`misuseCells(ctx, W, L)` takes the language of the page it is drawing into.

Verdon now:

    deck.html       fr    321 prose words, 41 shared with the English build   13%
    guidelines.html en    an English document, and says so

The 13 per cent is `px`, `mm`, `Aa`, the folder names, and the words the two
languages spell the same — *palette*, *construction*, *accent*, *document*.

The claim has teeth. The language battery renders every document in every
language the dictionary offers, twice, and compares:

    fr says it writes the manual and 84 per cent of it is the English build

The manual's body was still 1,453 words of prose that had never gone through a
dictionary at all, so `français` wrote the deck and not the manual, and the build
said so with the file named:

    warning: this identity is in français and the manual is written in English.
    The deck is in français. … What is missing is words rather than machinery:
    the manual still takes its prose from literals in src/documents/blocks.js
    rather than from the dictionary.

The round after this one moved those words too, and the warning goes quiet for
`français` — see *The manual's body* above. It still fires for a language the
engine has no dictionary for at all, which is what it is for.

## The canvas, which nobody had looked at

Every ACCESSIBILITY.txt this engine has written carried this sentence:

    The canvas is an application rather than a document and is not in that
    file: its own accessibility is a separate question and this package does
    not claim an answer to it.

True, and also the reason nobody had looked. Driven with a keyboard in a
browser, the canvas answered for none of it:

    blocks on the sheet: 4, reachable by keyboard: 0
    <main>: none    <h1>: 0    a region that announces: none
    the page you are on says so: no

The editing surface — selecting, moving, resizing, duplicating, deleting, the
whole of the application — was reachable with a pointer and with nothing else.
The keyboard handler was already there and already good: arrows nudge, shift
nudges further, cmd D duplicates, delete removes. All of it needed a selection,
and a selection needed a mouse.

**Focus is the selection.** Every block is a tab stop that says what it is, how
big it is, where it sits and whether it is selected — `Colour field, 1280 by
720, at 0 0, selected` — and focusing it selects it, which is what a design tool
does with a click. Two things had no keyboard at all and now do: `cmd` with the
arrows resizes, where resizing had been eight corner handles and nothing else,
and `enter` adds the focused block to the one that was selected before it, which
is shift-click without the pointer. `F2` opens a text block, `escape` lets go.

Then the things a page owes anybody: a `<main>` to work in, one `<h1>`, panels
that say what they are, `aria-current` on the page you are on, and `role=status`
on the strip where the application answers you — every refusal and every warning
it gave had been silent to a reader who was not watching that corner.

Three things were found only by measuring, and could not have been found any
other way.

**A focus ring you have not decided on is not a focus ring.** Every control in
the canvas had a visible one, and only because Chromium draws its own. That is
one browser's colour against this application's, and it changes between them.
The stylesheet says it now — and saying it is how the next one was found: the
one block that fills its sheet had its ring drawn at `outline-offset:3px`, and
the sheet clips what leaves it, so the ring was cut away. Every block could be
seen except the one covering the whole page. `outline-offset:-2px`.

**Four number fields had no name.** The boxes that set position and size were
labelled by a row of `X Y W H` underneath them, which is a caption and not a
label: a screen reader reached four unnamed fields and read "edit, blank".

**A stylesheet cannot say what ground a rule lands on.** The first attempt
measured every text rule against every ground the application declares and took
the worst, which called 87 pairs failures — `.keys` measured against the colour
of a warning chip it never sits on. An application has a real ancestor chain and
only a browser has it. The measurement moved into `test/canvas-check.mjs`, which
reads the computed colour of every piece of text and walks up to the nearest
element that actually paints a ground. Measured that way, 82 pieces of text, one
failure: the tag naming a selected block, white on the selection blue, 3.68 to 1
at 10 px. It is set in the application's own ground colour now — 4.93, and one
blue rather than two.

And the checker had a defect of its own. `structure()` read the file rather than
what a browser lays out, so a page that inlines its scripts was measured on its
own source code: the canvas ships `render.js` and `publish.js` as text, and
those hold an `<h1>` and forty-nine `<svg>`. It reported a heading outline and
forty-one unnamed drawings on a page that has neither.

`ACCESSIBILITY.txt` now covers the canvas, and says which three questions were
answered in a browser rather than at build time, because a file cannot answer
them. Run against the canvas as it was, the browser check reports twelve.

One more thing turned up while it was being read. `lang` is an accessibility
attribute, and the canvas resolved it against the manual's dictionary — so
after the two rounds that made français write both documents, **Verdon's canvas
declared `lang="fr"` over Undo, Pages, Add a block and Properties.** The script
check that catches Maayan cannot catch this: French and English are the same
alphabet. The canvas is a third document a dictionary declares now, English
writes it and français does not, and the build says which files its words are
still literals in.

## Five hundred exports the engine had never seen

Thirty-one identities is thirty-one drawings that came to the engine already
willing to be measured. The normaliser is the one part written for the opposite
case — artwork out of somebody else's hand, on somebody else's layers, with
whatever that program happened to write — and it had never met one at scale.

What is on this machine is not identity artwork. It is 16,311 SVG files that are
not the engine's own, of which 3,624 are signed by Inkscape and 32 by
Illustrator: icon themes, mostly. A status icon is not a logo and this run is not
the run the standing item asks for. But the normaliser's failures are failures
about what an exporter writes — layers, transforms, clip paths, coordinate
spaces — and about those a 22 px status icon out of Inkscape is exactly as real
as a wordmark out of Inkscape.

So: 508 of them, each dropped in as the mark of a complete package build. Not
`check`, which is the front door and was already exercised — the whole house.
Measurement, rasterising, the pattern, the PDFs, the zip.

    508 builds     267 from Inkscape, 16 from Illustrator, 225 unsigned
    332 built
     41 refused
    135 aborted the process outright

The 41 are the engine working. They are live text and embedded images, refused at
the door in words a designer can act on. A refusal is an answer.

The 135 are not an answer. `resvg` does not throw on the input that beats it: it
panics from Rust and takes the process with it — exit 134, SIGABRT, no exception,
nothing any `try`/`catch` in this codebase can see. It also defeats the engine's
own habit of reading back every file it writes, because the read back aborts too.
One build in four ended with no findings, no report and no zip, and nothing in
the engine had a way to notice.

Five defects.

### A tile mostly full of copies that drew nothing

122 of the 508. The pattern emits a copy of the motif for every neighbouring tile
it might cross into, and it decided how many from the cell size rather than from
how much of the cell the drawing actually covers. A 16 unit shape in a 45 unit
cell got ten copies, of which three could be seen. The tile is clipped to itself,
and a clipped group whose contents all fall outside the clip is a shape resvg
aborts on — so the seven that drew nothing were not merely weight in the file.

Culling them took three tries, and the first two are the point. Comparing the
instance's reach against the cell culled nothing. Deriving a bound from the
motif's declared box, its scale and its stroke still left seven copies in ten
outside the tile — because a motif's box is what the ranking measured and the
markup around it draws further: lammas's measures 52 by 38 and paints 56 by 94.
Only rendering the motif and reading its real ink was right. It is measured once
per motif and remembered.

### Three ways of reading geometry in the wrong space

**The normaliser moved the artwork.** `placePass` works out where each shape
lands, which means applying the shape's own transform — and then wrote those
placed coordinates back into the `d` while leaving the transform on the element,
so it was applied twice. A shape at (7, 4) came out at (-218, -993). It only did
this when some *other* shape in the file was off the artboard, which is why it
took five hundred real exports to find, and why no fixture had it: the pass has
to have a reason to rewrite anything at all before it rewrites everything.

**A shape lifted out of the drawing left its place behind.** `pattern.candidates`
takes each shape out of the file on its own to rank it as a motif, and left the
group transform above it behind. The drawing it is handed is the export as the
client sent it — `masterOf().source` is read off disk, not put through the
normaliser — so the layers are still there. An Inkscape layer is a group
translated by the document height, and leaving that behind put a shape on one at
y = 1004 in a 24 unit box: outside the drawing, and drawn at a fifth opacity,
which is again a shape resvg does not survive.

**The normaliser deleted artwork that was on the artboard.** `shapeExtents` read
the shape's own transform and no ancestor's. On a file whose every shape sits on
one offset layer, every shape is off the artboard by that reckoning, and the pass
removed them — and then reported, in a designer's words, that it had tidied
something up. This is the worst of them: the others end in a crash, which is
at least loud. It is also why the refusals fell from 41 to 32. Nine
files were being refused as having nothing left to measure, because the engine
had just deleted all of it.

All three are the same fault. Geometry read in one coordinate space and used in
another — and each time, the coordinate space that was missing belonged to a
layer, which is the thing every drawing program puts artwork on and no fixture in
this repository had.

### The fifth, which the measurement found in the other four

Re-running all 508 against the four fixes took the aborts from 135 to 6. Four of
those six had aborted before as well. **Two of them had built before and now did
not** — a regression, in a run whose whole purpose was to prove the opposite.

They were the last defect's own doing. Once the normaliser stopped deleting
artwork on an offset layer, those two files kept shapes they had previously lost,
and among the shapes was one carrying `opacity=".5"`.

The rule, measured rather than guessed at — a clip, a group, a path, in and out
of the tile, one shape at a time:

    a plain group entirely outside the clip            renders
    a group with opacity, entirely outside             ABORTS
    a group with opacity, straddling the edge          renders
    a path with opacity, entirely outside              ABORTS
    a nested clip group, entirely outside              ABORTS

Anything that makes resvg build an isolation layer — `clip-path`, `mask`,
`filter`, `opacity` — aborts if what it applies to falls entirely outside the
clip. It is the layer that unwraps a `None`, so it is exactly those four
attributes and nothing else, and it applies to a `<path>` as much as to a `<g>`.
The cull cannot reach this: it works on whole copies, and this is one path inside
a copy that legitimately straddles the edge.

`onlyShapes` already stripped three of the four, each added the last time one of
them took a build down. `painted()` now strips the fourth — which it should have
been doing anyway, because `painted()` exists to discard the artwork's own paint
and repaint the motif in one ink at one weight, and `opacity` is paint. Zero is
left alone: `opacity="0"` is the invisible bounding box Illustrator leaves
behind, and stripping it would turn artwork that draws nothing into artwork that
draws.

With that, all six build, and so does everything else. The same 508, against the
same engine, once the tree had stopped moving:

    508 builds
    476 built                     was 332
     32 refused                   was 41 — live text and embedded images, all of it
      0 aborted the process       was 135

Nothing regressed: every file that built before builds now. The 135 that used to
abort all build. The nine that moved out of the refusals are the ones the
normaliser had been emptying — refused for having nothing left to measure, by the
pass that had just deleted it.

### What it cost the identities that already worked

Every tile of every one of the 31, rendered before and after and compared pixel
by pixel:

    16 pixel-identical
    15 differing at an edge — at most 94 pixels of 720,000, none of them
       adjacent to another, worst channel 29 of 255

A dropped copy that showed would be one contiguous patch of thousands of pixels
at full contrast. These are single pixels, ninety-two separate spots in the worst
file, biggest run of two — the rasteriser compositing a different number of
layers. Nothing that could be seen was cut.

Two fixtures now carry the shapes. `test/fixtures/off-tile-clip.svg` is the
smallest file that aborts resvg, kept with a warning that nothing may render it,
and `test/fixtures/layer-offset.svg` is a mark on a layer a thousand units away
with one shape carrying a transform of its own and one shape off the artboard,
which is the smallest thing that has three of the five at once.

## A third language, and the first that is not written the way the engine is

`en` and `fr` proved the mechanism is a mechanism. They could not prove much
else. They share an alphabet, a direction and a sentence shape, so a page that
is wrong in French is wrong in a way an English reader can see — and the two
things a language is really made of, the script it is written in and the way it
runs across a page, were the same in both.

מעיין has been in this repository since the ninth round. It is a Hebrew
identity, it declares `he`, and every round since the thirtieth has handed it an
English manual with a warning attached saying the engine had no Hebrew and that
adding one was "a block of strings in `src/strings.js` and nothing else". That
last part was wrong, and this is what was actually in the way.

עברית is 499 keys and 3,761 words. Thirteen of the keys are not in English at
all.

### An ordinal agrees with its noun, and this table had one of each

`motifShapeNth` is "the {ord} {shape} in the drawing", and the ordinals were one
word each: `ord2: 'second'`. That is right for English and wrong for every other
language here. French has been printing

    le deuxième ellipse du dessin

since the thirtieth round. `ellipse` is feminine; five of the six shape nouns
happen to be masculine and the sixth had never come up in a fixture. Hebrew
makes it unavoidable — every ordinal has two forms, the nouns do not agree with
one another, and the ordinal follows the noun rather than preceding it.

So a dictionary now says which of its nouns are feminine, a key may carry a
second form under the same name with an `f` on the end, and `agree()` picks. The
Hebrew needed it; the French had needed it all along.

    en   the second circle in the drawing   the second ellipse in the drawing
    fr   le deuxième cercle du dessin       la deuxième ellipse du dessin
    he   העיגול השני שבשרטוט                האליפסה השנייה שבשרטוט

### The alphabet in a type specimen is a specimen of a script

`alphabet` is `ABCDEFGHIJKLM abcdefghijklm 0123456789`, and français sets the
same string with an É in it. Both are the same answer to the same question,
because both languages are asking it about the same letters. Hebrew has no
capitals at all, so a specimen of it is neither of those and cannot be made from
either by adding an accent. It is in the dictionary, where it always was — but
only now for a reason, because only a language knows what its own letters are.

### The manual prints a machine file, and a machine file is English

`brand.json` is read as English whatever the brand's language is. That is the
decision the whole table was built on and it is the right one: a developer
reading the machine file reads English. The manual then prints it whole, inside
a `<pre>`, carrying nothing that says what it is — so a Hebrew manual was 3,719
Latin characters of JSON keys and English sentences under `lang="he"`.

    in guidelines.html, the page says it is in he and 55 per cent of the
    text on it that carries no language of its own is latin.

The engine refused to build it, and it was right to: a speech synthesiser told
the page is Hebrew reads that block in Hebrew. It says `lang="en" dir="ltr"` now.
So does every `<code>` on the page, for the second half of the same reason —
`05-icons/` under `dir="rtl"` is drawn `/05-icons`, and `check <icon.svg> --icon`
comes out with its flag first. Marked, the manual measures 85 per cent Hebrew and
builds.

### A published page carried one document's words under another's claim

`published.html` is a canvas document, and it asked which language writes the
*manual*. For a Hebrew project that is Hebrew, and the words on it had all come
from the English canvas: 97 per cent latin under `lang="he"`. That is the
thirty-fourth round's fault a level further down, and the same shape as the two
before it — a claim about a document taken from something that is not that
document. It asks about the canvas now.

Eleven English literals came out of `editor/bundle.js` while that was being
looked at. The canvas opens on a document rather than a blank page, and that
document is content: its page names and its two sentences had never been in any
dictionary, because everything else on it — the mark, the palette, the pattern —
is drawn from the project and needs no words at all.

### Every measurement on the page was a different measurement

This is the one nothing at build time could have found, and neither `en` nor
`fr` could have found at all.

A run of Latin characters inside Hebrew prose is laid out by the bidirectional
algorithm, and the neutral characters around it — a `#`, a `÷`, a `·`, the space
between a number and its unit — go to whichever end the paragraph direction says.
Measured in a browser, character by character, on the manual as it first built:

    file  #C8873A          reader sees  C8873A#
    file  18 59 58         reader sees  58 59 18
    file  82 52 60 40      reader sees  40 60 52 82
    file  1385 C           reader sees  C 1385
    file  122 × 50 px      reader sees  px 50 × 122
    file  140 ÷ 7 = 20     reader sees  20 = 7 ÷ 140
    file  01-horizontal    reader sees  horizontal-01
    file  1 / 19           reader sees  19 / 1

Twenty-nine of them. Every one of those is a different value from the one the
package measured: a different colour, a different ink to send to a press, a
different shape, a sum that is not true, a folder that is not there, slide
nineteen of one. The file is right in all twenty-nine, every check the engine had
passed, and the reader was shown something else.

A value has to say it is its own run. U+2068 FIRST STRONG ISOLATE and U+2069 POP
DIRECTIONAL ISOLATE do that, and they are characters rather than markup, so they
survive escaping and reach the page through every one of the hundred callers that
sets a measurement — isolated in one place, in `t()`, where the values are
substituted. Three things had to be got right and each was found by measuring
again:

- **The run, not the value.** Isolating each value on its own left the characters
  *between* two of them outside any isolate, and a neutral between two isolated
  runs takes the paragraph's direction. `140 ÷ 7 = 20` stayed backwards.
- **The sentence's punctuation is not the value's.** An isolate that swallows the
  full stop of `WCAG 2.2.` puts it at the run's left-hand end, which in a
  right-to-left sentence is the middle of it.
- **The brand's own name breaks a run.** The sentinel a document leaves where the
  brand goes is filled in afterwards, so first-strong resolved `מעיין 3.0.0 · 67`
  as Hebrew and turned the footer back round.

The cells that hold nothing but a value — the palette, the contrast table, the
floor table — say `direction:ltr` in the stylesheet instead. They were already
the cells the design sets in the numeric face, so there was a hook to hang it on.

And one thing the isolate cannot reach: the deck's slide counter is built in the
browser, so the engine emits the two characters into the script.

### A label inside an equation only works in one direction

`basisStroke` is "box {box} ÷ stroke {w} = {ratio} stroke widths across" —
English puts its labels inside the arithmetic, and that reads because the words
and the sum run the same way. In Hebrew a word in the middle of a sum breaks the
sum into two runs, and two runs with a neutral between them are laid out in the
paragraph's direction. The label goes in front in the Hebrew and the sum stays
whole. Nothing in the machinery forbids the English shape; the language it is
wrong for is the one that has to say so.

### An arrow is a direction

The deck's buttons were `← Prev` and `Next →`, characters in the markup,
whichever way the deck reads. In a right-to-left deck the start is on the right,
so back points right and forward points left — and the arrow keys go with them,
because pressing the right arrow in a right-to-left carousel moves towards the
beginning. Two glyphs and one sign.

### What it is measured with

`test/rtl-check.mjs` reads every text node in a built page, takes the screen
position of each character in every run that has no right-to-left letter in it,
and compares the order they are drawn in with the order they are written in. It
knows that a run which wraps is not a run that was reordered, that two identical
letters side by side measure to all but the same place, and that punctuation at
a run's edge belongs to the boundary rather than the value.

Against the manual as it first built it reports 29. Against the one that ships,
0 — on all four pages, the two that read right to left and the two that do not.

### What עברית does not write

The canvas. Its chrome is literals in `src/editor/emit.js` and, mostly, in
`src/editor/app.js`, which is client side and would have to be handed a
dictionary rather than read one. So a Hebrew project gets a Hebrew manual, a
Hebrew deck, and an English canvas that says it is English — which is the same
answer français gets, and the point of the mechanism is that the answer is said
rather than assumed. The build says exactly that, and names the two files.

山彦 is still in `ja` and the engine still has no `ja`, so it has taken over the
job מעיין used to do: it is the identity that proves a language the engine
cannot write is said so rather than quietly swapped.

## The canvas says it too

Three rounds carried the same sentence. The thirty-fourth made the canvas answer
for its own accessibility and noted that its words were still literals; the
thirty-fifth repeated it; the thirty-sixth wrote a whole third language and had
to repeat it again, and set `writes: ['manual', 'deck']` for עברית because the
third document was not one this table could write.

That is what made `writes` naming the canvas worth so little. English literals
are English whatever a dictionary claims, so `EN.writes` could say `canvas` and
the claim cost nothing to make. The script check cannot see through it either —
français and English are the same alphabet — and by the time a language arrived
whose script *is* different, the honest answer was to stop claiming it.

### It is not a document, and that is the whole of the problem

A document is a string the engine builds and writes to disk. The canvas is an
application, and half of it runs in a browser: `app.js` and `render.js` are
shipped as text and executed there, where `src/strings.js` does not exist and
cannot be made to.

So the words travel. `resolve(project, 'canvas').words()` flattens the resolved
dictionary — every key the canvas sets, plus the ones it shares with the two
documents so that a badge on a block and a badge in the manual cannot drift —
and the bundle carries it, which is the thing the editor and the published page
already share. `HandoverRender.t` is the same lookup on the other side.

Two implementations of one thing, which this repository already knows how to
keep honest: a test holds them to each other, key by key, in all three
languages.

The second implementation is four lines long, and the reason it is four lines
rather than forty is worth writing down. The engine hands over each string
**already looked up and already isolated**, with its `{slots}` still in it. A
slot is a run of Latin characters like any other, so the isolate the engine puts
round a value in a right-to-left document lands on the slot — and the value
drops into a run that is already marked. The browser only has to substitute.
One implementation of the bidi rule, not two.

### What it cost the canvas that already worked

Nothing, measured. Every word the English canvas puts on the screen, collected
from the screen — 285 strings, including the ones that only appear once a block
of each of the eighteen kinds has been added — is the same before and after.

Three of them nearly were not, and each is the kind of thing that only shows up
when you compare rather than assume. The type specimen in a canvas block is
`ABCDEFGHIJ abcdefghij 0123`, shorter than the manual's, because the block is a
preview a few centimetres wide — so it is its own key rather than the manual's.
And the three options in the mockup block's "Put on it" are lower case, because
they sit in a list beside colour names and lockup names, which are the project's
own words and are lower case. Reusing the block names would have capitalised
them.

### Key names are not translated

`tab`, `esc`, `cmd Z`, `F2`. A reader in any language is looking at the same
keyboard. The sentences beside them are translated; the keys are what is printed
on the key. It is why the French canvas's *page* still measures 47 per cent word
for word the English one while its vocabulary measures 20 — most of what is left
in the markup is the keyboard legend, and that is correct.

Which is also why the check for this is not the one the two documents get. The
canvas has seventy words in its markup and the rest is built in the browser, so
the thing that has to be in the language is the bundle. Measured there: the
French canvas is 20 per cent word for word the English one, the Hebrew 9, and
山彦's — a language the engine still has no dictionary for — is 100, which is
what gives the number its teeth.

### An application that reads the other way

A block's `x` and `y` are the design. They do not mirror, and they must not: a
canvas that flipped its artwork when the interface changed direction would be
useless. The furniture around them is reading order and does turn over. So the
panes take `border-inline-start`, the notes take `padding-inline-end`, the page
buttons take `text-align: start`, and the sheet keeps its physical positions.

And the values inside the blocks needed what the manual's needed. `published.html`
is drawn by the same renderer, so the moment a Hebrew project could write the
canvas, the published page arrived with twenty measurements in the wrong order —
`#C8873A` drawn `C8873A#`, `18 59 58` drawn `58 59 18`, the same catalogue as the
thirty-sixth round found in the manual, in the one file that round had not
reached because it was still English. `test/rtl-check.mjs` found all twenty
without being changed.

### The check that was written in one language

`test/canvas-check.mjs` asks whether a block says what it is, and it asked with

    /^[A-Z].*\d.*selected$/

which is a sentence in English. Hebrew has no capitals and its word for selected
is not `selected`, so a canvas that answered perfectly failed. The page carries
its own words, so the check reads them: a name, four numbers, and the marker the
page itself puts on a selected block. All three canvases pass it now, and it is
the assertion rather than the canvas that had to learn a second language.

### What is left

`ja`. 山彦 has declared it since the ninth round and the engine still has no
Japanese, so it goes on being the identity that proves a language the engine
cannot write is said so rather than quietly swapped. The build's own note about
that used to end "adding one is a block of strings in src/strings.js and nothing
else". Two rounds have now shown that to be untrue, and it says so: most of it is
a block of strings, but the first language that was not written the way the
engine is needed an agreement rule for its ordinals, an isolate round every
measurement, and a specimen of its own script.

## A fourth language, and the first written without spaces

山彦 has declared `ja` since the ninth round. Three rounds in a row it was the
identity that proves a language the engine cannot write is said so rather than
quietly swapped — a useful job, and one it only had because nobody had written
the Japanese. 日本語 is 666 keys now, and two of the things it found could not
have come from any of the three before it.

### A word is not a unit every language has

`splitWords` split on spaces and punctuation. Japanese is written without
spaces, so a whole page came back as one token:

    residue(japanese manual, english manual) → { words: 1, shared: 0, share: 0 }

Which reads as a perfect score and is a sample of one. `residue` is the
measurement that turns `writes: [...]` from a claim into something with teeth —
the thirty-first round built it because a hand-typed list is a claim — and here
it was blind. Worse than blind: a Japanese page that was secretly English would
have scored 1 out of 1 the other way, and passed just as quietly.

The unit that works for both is the character where a script is written without
spaces and the space-delimited run everywhere else. It is not a tokeniser and
does not pretend to be one — 録音室 is one word and three tokens. For a ratio of
how much of one page is word for word another that does not matter: what matters
is that the denominator is the length of the text rather than one, and that a
Latin word inside Japanese prose still comes out as itself.

    録音室 recording room です  →  録 音 室 recording room で す

Measured that way, the Japanese manual is 656 tokens and 11 per cent of it is
the English one, which is about what français and עברית score. Before this
round the same manual scored 1 token and 0 per cent, and 0 per cent is what
success looks like.

### A font can arrive and still have nothing to draw with

This is the sharper one, because it was already wrong before this round started.

山彦 ships IPAGothic subsetted to the characters its own content sets: 210 of
them, 59 KB instead of several megabytes, which is why the package opens with no
network at all. That is the right thing to do. But a subset is subset to what
somebody knew about when it was cut, and one character in this repository was
already outside it:

    立ち会いは一枚ずつ行います。

行 is not in the font. That sentence is `tokens.type.scale`'s own sample — it is
on the type specimen page, whose entire job is to prove what the face looks
like. `src/typeface.js` has carried a comment since the sixteenth round saying
that a specimen showing the wrong face is worse than no specimen, because it is
offered as proof. It was showing one character of somebody else's face.

Nothing said so, and nothing could have: a missing glyph is not an error. The
browser falls through to the next family, draws the character in whatever the
reader happens to have installed, and the page goes on claiming to be set in the
face. What a reader sees depends on their machine, which is the one thing a
package that fetches nothing is built not to depend on.

The engine asks now, in two places, because there are two different questions:

- **At build time**, of the words it knows go in the identity's own face — the
  brand's, the project's prose, the samples in its type scale. That is what
  `typeface.cannotDraw` reads out of the shipped font's own cmap, and it is what
  found 行.
- **In a browser**, of the finished pages, because which characters land in
  which face is a fact about the page and not about the project.
  `test/font-check.mjs` walks every text node, takes the family the element
  actually asks for, and checks each character against what that face holds. It
  found `÷` in the deck — a character the engine's dictionary sets in the
  identity's face, which the build check could not have known about.

Then the dictionary arrived and the deck alone needed **111 characters the font
did not have**. The subset was re-cut against the finished documents rather than
against the project file: 726 glyphs, 210 KB. Cutting it is the project's
business — a project ships a font — and what the engine does is notice, which is
the warning and the check. The next time the dictionary grows they will say so
again.

One character in the new list is not in the source font either: `™`. IPAGothic
does not have it, nothing in the documents sets it, and the check says which.

And the check had a fault of its own, found by running it on the other three
identities. It said `this package ships no font files, so there is nothing to
check` about a package shipping twelve — they are woff2, which is Brotli
compressed, and opentype.js does not decompress it. A check that reports "no
fonts" when it means "twelve I could not read" is worse than no check. It says
which now.

### What a script asks of a line

Two more, both visible on the first page the engine drew.

**A measure is counted in characters, and how wide a character is depends on the
script.** `max-width: 16ch` is sixteen Latin characters. A `ch` is the width of a
zero, which is half-width in a Japanese face, so the same rule is seven Japanese
characters — and seven characters is one word. The title broke as

    山彦 ブラン
    ドマニュアル

which is ブランド across two lines. The display measures are counted in whatever
unit counts the script's own characters now: `ch` for en, fr and he, `em` for ja.
The body measures stay in `ch` on purpose — 64ch already comes out at 36
full-width characters, which is what a Japanese text column wants.

**And Japanese has no spaces, so a browser may break between any two
characters.** `word-break: auto-phrase` breaks at phrase boundaries instead, and
the paragraph goes from breaking inside words to breaking between them. A
language declares what its script asks of a line; the three that ask nothing say
nothing, and their documents carry no rule they do not use.

### The fixture that ran out

Each of the last three rounds took the identity that proved "a language the
engine cannot write is said so" and wrote its language, and the job moved to the
next one — מעיין, then 山彦, then nothing. All four fixtures are written now, so
the case has a fixture of its own rather than a borrowed one: 山彦 declaring
`ko`, a real language the table does not have and is no more likely to gain by
accident than any other.

## Pointing a screen reader at it

Every round since the twenty-ninth has ended with the same sentence: what these
pages say is measured, how they sound is not. Ten rounds of accessibility work
sat on an argument nobody had tested.

A screen reader does two things. It reads the accessibility tree — which is not
the markup and not the rendered page, but a third thing the browser computes
from both, where a name is resolved through the whole labelling algorithm and a
good deal of what is in the markup never arrives at all. And it speaks what it
finds, in a voice chosen by the language each run declares.

Both halves are measurable. `test/reader-check.mjs` reads the tree through
Chrome DevTools Protocol and asks of it the things that make a page unusable by
ear; with `SPEAK=1` it hands each run to espeak-ng in the voice its language
asks for, and prints the phonemes. It is not NVDA, JAWS, VoiceOver or Orca and
does not claim to be — it is the layer all four of them read, plus a
synthesiser. Where the two disagree the real reader is right.

### The argument this engine has been making since the twenty-ninth round

    A speech synthesiser told the page is in one language and handed another
    reads it with that language's sounds, which is worse than being told
    nothing at all — it is said with confidence.

That sentence is in `src/strings.js`, in `src/access.js`, and in the refusal the
build prints. It is the whole justification for four rounds of language work.
Spoken, it is wrong, and it understates the problem:

    מדריך מותג   as he    mdQ"'iX mvtg
                 as en    h'i:bru:m'em  h'i:bru:d'alet  h'i:bru:R'eS  h'i:bru:j'od …

It is not read with English sounds. It is **spelled out**: "hebrew mem, hebrew
dalet, hebrew resh, hebrew yod". Two words become nine letter names. The same
thing in Japanese comes out as "japanese letter" nine times over.

### A language inside a language

The thirty-sixth round marked the machine readable file `lang="en"`, because
`brand.json` is English whatever the brand is and a page carrying several
thousand English characters under `lang="he"` is a page a synthesiser reads
wrong. That was right about the block and wrong about what is inside it. The
file holds the brand's own name. It holds the misuse rules the project wrote and
its colour rationale — eight runs of Hebrew in מעיין's, five of Japanese in
山彦's. So a screen reader said

    מעיין  →  hebrew mem, hebrew ayin, hebrew yod, hebrew yod, hebrew nun

which is the exact fault the whole mechanism exists to stop, one level further
down, in the one place none of the checks could see it. `language()` measures
the text that carries no language of its own — it drops every element that
declares one, and that is precisely where this hides.

`access.markScript` marks runs of the brand's own script wherever they land, and
the machine file uses it. `access.foreignScript` catches it at build time, so it
cannot come back between browser runs, and the finding says what, why and how
like every other.

The first version of that check could not see it. It scanned with a global
regular expression, so the match on `<html lang="he">` ate the whole document
and the `<pre lang="en">` inside it — the case the check exists for — was never
looked at. It found the one Hebrew string in a comment inside `editor.html` and
nothing else, and looked like it was working. The test caught it.

### Chromium does not name a figure from its caption

The first run reported nineteen figures announced as a bare "figure". The HTML
accessibility mapping says a `<figure>` takes its name from its `<figcaption>`.
Measured, of five ways of captioning one, only `aria-labelledby` produces a name:

    img + figcaption          name=""
    div + figcaption          name=""
    aria-labelledby           name="Caption by labelledby"
    named svg + figcaption    name=""

So the check was asking the wrong question. The caption is still announced — it
is text inside the figure and a reader reads it — it simply is not the figure's
name. What a reader needs is that something inside the figure is said at all,
which is what the check asks now, and which a silent drawing in a silent frame
would fail.

### A stylesheet is not a way of saying something

`text-transform: uppercase` reaches the accessibility tree. The eyebrow is
written `Brand manual · generated from one master file` and announced
`BRAND MANUAL · GENERATED FROM ONE MASTER FILE`; 167 words of the manual and 120
of the deck are capitalised on their way to a reader because a stylesheet said
so.

The received wisdom is that this makes a synthesiser spell them out. Measured,
it does not:

    Drawn by the system   dr'O:n baI D@ s'Ist@m
    DRAWN BY THE SYSTEM   dr'O:n baI D@ s'Ist@m

Identical. What does change is a reader who has capital indication turned on —
a setting real readers expose and some people need:

    -k 2   Drawn by the system   capital drawn by the system
           DRAWN BY THE SYSTEM   capital drawn capital by capital the capital system

One marker per phrase becomes one per word. And the only fix that keeps the
written text in the tree is `font-variant-caps` — `aria-label` on a span is
ignored, as ARIA in HTML says it should be — and small capitals are a smaller,
lighter thing than the capitals this design sets. So this is reported and not
changed: the check prints the count and what it costs, and the design stands.
Measuring something and then declining to act on the measurement is a different
thing from not measuring it.

### What passed

Names, on everything announced as a bare role. The heading outline, on every
document in four languages. Every character of text inside a stated language,
after the machine file was fixed. Nothing a reader cannot walk past — the one
long block on the page, the machine file itself, is inside a section a reader
can skip by heading. And every drawing says what it is.

### What this is not

espeak-ng is a synthesiser, not a screen reader: it has no notion of navigating
by heading, no forms mode, no braille. Its Japanese voice reads kana and
announces kanji as "chinese letter" whichever language it is told, so for
Japanese it understates what a real reader does rather than overstating it. And
the accessibility tree is Chromium's; Firefox and WebKit compute names slightly
differently, and a real reader adds its own rules on top of all of them.

What can now be said is narrower than "this works with a screen reader" and
more than was true before: the tree these pages present has been read, the
questions that make a page unusable by ear have been asked of it in four
languages, and the sentence the engine has been repeating for ten rounds has
been listened to and found to understate its own case.

## An identity nobody made for the engine

Every fixture in this repository was drawn, or chosen, by somebody who knew what
the engine was going to do with it. Thirty-one identities, five hundred and eight
scraped exports, and all of them either authored here or picked because they
broke something. None of that is the same as a mark a designer made for their own
company and exported without a thought for what would read it next.

Pagrin's is. It came out of Figma's own SVG exporter — `exportAsync`, the same
call the export dialog makes — and went in untouched.

    <path d="M183.837 101.889V136.496…" fill="url(#paint0_linear_7_67)"/>
    <linearGradient id="paint0_linear_7_67" gradientUnits="userSpaceOnUse"
        x1="206.82" y1="-21.6646" x2="-15.9812" y2="188.933">
      <stop stop-color="#FF5715"/><stop offset=".5" stop-color="#FFBADC"/>
      <stop offset="1" stop-color="#2409FF"/>

One path. One gradient. No flat colour anywhere in the file, and a gradient whose
coordinates sit outside the viewBox on both ends. The package built — 118 files,
exit zero — and six of the warnings were about the artwork and right:
no CMYK for any colour, a wordmark drawn in `#000000` where the interface ink is
`#0E0E0E`, app icons at 180 and 192 px painting at 0.73 and 0.78 px, a floor of
335 px on screen and 100.4 mm in print because the rays taper to nothing where
they converge. That last one is a real property of a converging fan and the
advice it came with — draw a simplified icon mark, set it as `assets.icon`,
check it with `check --icon` — is the right advice.

### Empty is not the same as invisible

    no pattern was written. nothing in this drawing can carry a repeat:
    every shape in it measured as empty.

It offered an explanation with it: *if the mark is a single hairline, a pattern
built from it would be a grey wash rather than a field.* That is a good sentence
about a different drawing. This one is a solid fan that inks 93 per cent of its
own box.

`pattern.candidates` lifts each shape out of the drawing on its own so the
ranker can measure it, and `onlyShapes` strips everything that draws nothing on
the way. `defs`, `linearGradient`, `radialGradient` and `pattern` are on that
list, and the reason given is true: a paint server draws nothing by itself. It
is still the wrong reason. It is the only reason the shape it fills has any
colour at all. Lifted out without the `<defs>` that names it, `fill="url(#a)"`
points at nothing, resvg paints nothing, `geo.inkBox` throws *the artwork
renders empty*, and `measureRank` catches that and drops the candidate. Every
candidate was dropped.

Measured, before and after:

    candidates: 2
      [mark]     THREW: the artwork renders empty      defs:false  url(#):true
      [shape:1]  THREW: the artwork renders empty      defs:false  url(#):true
    rank() -> 0 shapes

    candidates: 2
      [mark]     inks 184 x 182     carried defs: 242 chars
      [shape:1]  inks 184 x 182     carried defs: 242 chars
    rank() -> 2 shapes

This is the same mistake as `layer-offset.svg`, one attribute over. That one was
geometry read in one coordinate space and drawn in another. This is a reference
read in one document and drawn in another that no longer holds what it names.
`carryPaint` walks the `url(#…)` and `href="#…"` references out of a candidate's
markup, pulls the paint servers they name out of the source document
transitively — a gradient can take its stops from another one — and hands them
back with their ids intact, because a reference is only a reference for as long
as the name it points at survives. It is kept beside the shape rather than glued
in front of it: `painted()` puts the pattern's flat ink on the first element it
sees, and the first element has to be the shape.

`perigee` is the check that it is not too eager. Its `url(#clip0_1_2)` is a clip
path, not a paint server, and clip paths are dropped on purpose — one wholly
outside its clip is the resvg abort. It is not carried, and perigee's package
does not move.

### And a measurement that was quietly wrong for thirty rounds

The missing pattern was the visible half. The half nothing reported: any mark
with a gradient *in* it was being measured with that piece painting nothing.

**vesper** has shipped since the ninth round. Its whole-mark candidate measured
its own ink at 0.300. The mark actually inks 0.418 — the difference is a ring
filled `url(#dusk)` that contributed nothing to the measurement. `solid` peaks
at 0.3, so the wrong number sat exactly on the peak and scored 1.0000 where the
true one scores 0.9202. Vesper ranked two shapes and chose between them; there
are three, and the third now wins by 0.7454 to 0.7326.

So one of the thirty-one then in the repository changes, and it is the one that
should. It is a close
call between two real shapes from the same drawing — a star it used to pick and
a ring it could not previously see — and vesper pins neither, so the engine
chooses. `system.pattern.motif` is there for a designer who disagrees.

### Six files with six names and one set of bytes

With a pattern building, the next thing was visible. Pagrin's mark came out of
all six of its colourways identical, byte for byte:

    spectrum  f0f43617fe809a26   signal  f0f43617fe809a26
    ink       f0f43617fe809a26   page    f0f43617fe809a26
    black     f0f43617fe809a26   white   f0f43617fe809a26

Including `white`, which a designer drops onto a dark ground, and `black`, which
goes to a one-colour job. All six were the gradient.

The engine's own report had been promising the opposite the whole time — *a
colourway names one colour for a slot, and a gradient is not one colour; any
colourway that names a colour for this slot replaces the gradient with it* —
and everything downstream of the promise was already built to keep it.
`applyColourway` writes the flat colour straight over a `url()` fill.
`dropUnusedPaint` clears the definition it has just orphaned, which is a bug
somebody already fixed once. `KEEP` leaves it alone where a colourway asks.

Only the tagging was missing. `colourPass` skips a `url()` fill on purpose —

    if (!raw || raw === 'none' || raw.startsWith('url(')) continue;

— and that line is right: a paint server is not a hex and must not be snapped to
the nearest brand colour. The consequence was not right. The shape reached
`assignSlots` uncounted, was given no `data-slot`, and `applyColourway` works
entirely off `data-slot`, so there was nothing to repaint. `assignSlots` now
counts paint servers alongside the hexes and tags them the same way, which makes
a drawing whose only paint is one gradient come out with the slot `ink` — the
same rule a drawing with one flat colour already got.

Every shipped identity that has a gradient carries a hand-written `data-slot`,
which is exactly why nothing caught this in thirty rounds. vesper's ring is
tagged `ring` and its `dusk` colourway says `ring: keep`. An export nobody
prepared has no slots at all, and that is every export a client actually sends.
Measured across the thirty-one that existed when this was measured: none has an
untagged paint-server fill, so the tagging change moved nothing that shipped.
Pagrin is the thirty-second, and it is the one that does — which is the whole
reason it is now a fixture rather than a note about a run that happened once.

What it does to Pagrin's package:

    package                14688 KB  ->  6334 KB
    PDFs carrying a gradient     18  ->  3
    mark colourways, distinct     1  ->  5

The size is the gradient no longer being copied into every file that could not
repaint it. And a check that had never been able to see the shape starts
firing — the middle stop of the gradient is `#FFBADC`, and against the white it
is cut for that measures **1.58:1**, which is not a mark anyone can make out.
The engine could not have said that yesterday, because as far as it was
concerned the shape had no colour to check.

### What this run does not show

One identity is one identity. It happens to be an unusually good one to have
picked — a single path, a single gradient, no flat colour to fall back on — so it
put weight on exactly the seam that had never been loaded. A different real
export would find a different seam, and the honest claim is not that the engine
now handles real exports. It is that it handles one more thing than it did, and
that the thing was found the only way this kind of thing gets found.

## The first ladder the engine asked for

`src/ladder.js` has existed since the twenty-third round, and two identities use
it — ancroft and oriel. Both were drawn by somebody who already knew the answer:
the tiers were authored alongside the master, in the same hand, to the same
grid. Pagrin is the first mark that arrived with the problem and no answer, and
the engine said so itself:

    warning: 2 app icons were written where the thinnest part of the mark paints
    under the 2 px this project sets as the thinnest a stroke may go:
    icon-180.png at 0.73 px, icon-192.png at 0.78 px … this artwork needs 492 px
    square before it holds together.

### What actually sets the floor

The obvious reading is that a fan of seven rays is too busy and the fix is fewer
rays. That is wrong, and it is worth being precise about why, because the wrong
reading produces a ladder that does not work.

The fan converges. Measured off the render at r = 60, 100 and 150 units — stable
across all three — the white wedges sit at 11.2, 24.3, 35.4, 44.4, 52.0, 60.4 and
77.5 degrees from an apex at (7.6, 177.2), which is the point the path's own
coordinates return to eleven times. The ink between two adjacent wedges at radius
r is about `r × Δθ`. As r goes to zero so does the ink, for any Δθ at all. Seven
rays or two, a fan that meets at a point has a hairline at that point, and
`scanAt` finds it: 1.1 units, so `ceil(184 / 1.1 × 2)` = 335 px.

Dropping rays widens Δθ and buys a little. Stopping the rays short of the corner
removes the term that goes to zero. Measured, on the same seven wedges:

    all seven, meeting at the apex        1.1 units    335 px
    all seven, stopped 20 units short     1.87 units   197 px
    four of seven, stopped 20 short       8.03 units    46 px
    two of seven, opened, stopped 45      31 units      12 px

The first row is the master. The second drops nothing at all and takes the floor
down by 40 per cent, which is the whole of the argument: the convergence was the
constraint, not the count.

### The rungs

    horizontal   864 px and up
    mark         335 – 863      the master
    standard     197 – 334      all seven wedges, stopped 20 units short
    compact       46 – 196      four of the seven
    monogram      12 – 45       two, opened to six degrees, stopped 45 short

Each rung's bearings are a subset of the rung above it, so stepping down takes
rays out and never swaps one for another. That is not a rule `check()` enforces —
it compares part counts, proportion and slots — and it costs something: the
monogram is [24.3°, 60.4°] rather than a pair that reads slightly better in
isolation, because those are the two the compact rung keeps furthest apart. A
subset that is a little worse alone is better as a ladder, because a reader who
sees two of them at different sizes sees the same drawing.

Everything else the ladder checks passes without adjustment. Each rung is one
closed subpath, so `inkParts` is 1 at every rung and `ladderDetail` — which fires
when a lower rung has *more* in it — has nothing to say. Each is drawn in the
full 184 × 182 box, so every rung is 0.99 tall for its width against the mark's
0.99 and `ladderShape` is quiet. Each carries `data-slot="ink"`, so the
colourways reach them.

All four checks were confirmed to have teeth against these exact tiers rather
than assumed to: reordering the ladder blocks the build, stripping the
monogram's slot raises `ladderSlots`, squashing its viewBox raises
`ladderShape`, and adding two stray subpaths raises `ladderDetail`.

### What it buys

The icon warning is gone, because icons are cut from the bottom rung. The package
goes from 143 files to 197 — the `12-ladder/` folder is 54 of them, three
drawings in six colourways in three formats. `favicon-16.png` was a grey square
with a moiré in it and is now a mark with two rays in it.

What this is not: a claim that these three drawings are the right three. They are
derived rather than designed — the bearings are the master's, the truncation is
a number chosen to hit a floor, and a designer who sat with it would very likely
draw the monogram differently. What the engine can say is that the ladder is
continuous, that every rung is simpler than the one above it and holds smaller,
and that no size in the package now falls below the drawing it is cut from.

## Two descriptions of the same colour

`src/cmyk.js` has said the same thing since it was written, and it is correct:

> The one rule here is that CMYK is a decision, not a conversion … sRGB
> describes light leaving a screen and CMYK describes ink sitting on a
> particular paper under a particular press. Nothing in a hex code knows which
> paper.

So the engine carries the four numbers somebody competent gives it, labels the
fallback formula as a guess, refuses to put a guess in `inkMap`, and warns where
a build is missing — a blocker if the file is going to press. Pagrin's palette
has no builds and the honest answer is still that they have to come from
Pagrin's printer. Fabricating five of them to clear a warning is the exact
failure this file was written to prevent.

What follows from carrying both, though, is that every brand colour is written
down twice. A hex and four numbers, describing one colour, in one file, and
nothing had ever asked whether they agreed.

### The axis that survives

The two are not meant to be identical, which is why this is not as simple as a
colour difference. Ink has a smaller gamut than a screen: a vivid colour comes
back duller, and that gap *is* the reason a build is a decision. So a large
difference is expected and means nothing on its own.

But the loss is in chroma. Lightness is the one axis every printing condition
keeps — paper white to solid black is available whatever the ink and the stock.
So the two failures separate cleanly:

- far apart in **chroma**, close in lightness → the press cannot reach the hue.
  Normal, expected, not a finding.
- far apart in **lightness**, and further than in chroma → nothing about gamut
  explains it. The build is a different colour.

Measured over the 148 declared builds here. Taking the 108 the plain model
reproduces without chroma loss, so that the model is being trusted only where it
is trustworthy:

    lightness away from its own hex
      median 2.3    90th 6.8    99th 14.6    then 50.8

One value, three and a half times the ninety-ninth percentile, with a gap under
it and nothing in the gap. It is `halyard/fog`: `#6E7B82`, a mid grey, in the
`neutral` role, declared `0/0/0/100`. Solid black. Printed, halyard's neutral
would have come out black, next to `pitch` — its actual black — at 78/62/50/92.

Every threshold from 15 to 30 finds that one and nothing else, so `TONE_LIMIT`
is 20 because that is the middle of an empty band, not because it is where the
one known case happened to fall. The check is insensitive across a 2× range of
its own constant, which is the thing worth being able to say about a threshold.

### The check that had already seen it

The rich-black check found this colour eight rounds ago and said the wrong thing
about it:

    warning: fog is 0/0/0/100, which is a plain black. Back it up to about
    240% total, for instance 60/40/40/100.

That advice is correct for a black and this is not a black. Following it would
have moved halyard's mid grey from solid black to *rich* black — further from
`#6E7B82`, not nearer, and with the warning cleared. A check that reads a
symptom and prescribes confidently for the wrong illness is worse than no check,
because it closes the question.

`fog` is `52/46/43/10` now, which is where ancroft's `#5A6068` (62/48/42/12) and
harbourne's `#5E6265` (58/46/44/14) sit, allowing for it being the lighter grey.
halyard is the only one of the thirty-two whose output moves.

### What it is not

`unInk` is the plain inverse of the plain formula and is not a press simulation.
It is never asked what a colour will look like — only whether two descriptions
of one colour are the same tone, which is a comparison, and whatever the model
gets wrong it gets wrong for both sides at once. The check cannot tell anybody
that their build is *right*; only the printer can. It can tell them when it is
not even close, which is the case nobody was watching for.

## The third description

The round before this one found that a colour is written down twice and the two
were never compared. It is written down three times. The spot ink was carried
faithfully from the project file into `brand.json`, into the print check, into
the manual, and read by nothing on the way.

### What can honestly be asked

Not what colour it is. That belongs to Pantone, `licence.js` already says this
package grants no rights to their references, and a lookup table lifted from
somewhere would be both wrong and theirs. So the checks here know nothing about
colour. They know about the shape of a reference, which is public:

    solid       185 C     7527 U     Black 6 C     Cool Gray 9 U
    process     185 CP    185 UP     extended gamut  185 XGC
    FHI         11-0601 TCX / TPG / TPM   — a different book entirely

`spot()` splits a reference into a body, a book and a finish. Three things
follow from it, and none needs a colour value.

**It is a reference.** northline shipped twelve colours, five with real
references and seven whose spot ink was the string `"line"`. The print check
laid it out for the client:

    north      88/17/86/3      194%  given   line

That is the one line in a manual somebody acts on without translating it: it is
read down a telephone to an ink supplier. Nothing downstream sees anything odd,
because nothing downstream expects to have to.

**A number says which book it came from.** Solid coated and solid uncoated hold
the same numbers, and they are not one ink on two papers — they are two inks,
mixed so that each matches its own chip on its own stock. `185` on its own names
both and neither.

**The book is the one the paper asks for.** `rules.stock` is already declared,
already drives the ink limit, and had never been asked this. Seven identities
here declare `uncoated` and named coated inks — thirty-two references in
beaumont, carrock, halyard, marlow, saltmarsh, thornbury and yarrow. A `C` ink
on uncoated paper is not the colour of the `C` chip that was signed off, and the
gap is large enough to be argued about at a press check.

### What was fixed and what was not

northline's seven are removed rather than replaced. The right PMS numbers for
those greens and reds are not something that can be worked out from a hex, and
the whole position of `src/cmyk.js` is that a print value nobody chose is worse
than an absent one. Those colours print from their builds now, and the manual
shows an empty spot column for them, which is true.

The thirty-two say `U`. That is a format completion rather than a colour claim:
the solid books carry the same numbers, so `Black 6 U` is the same chip in the
book the declared stock asks for.

Fifteen identities give their paper colour a six-figure code — `11-0601`,
`11-0605`, `11-0602` — the Fashion, Home + Interiors form, a different system
from the printing inks around it. Those were measured and left alone at first,
because they sit on near-white colours that are arguably stock rather than ink
and the fix looked ambiguous between TCX and TPG. See the section below: it is
not that choice, and the thing that decides it is measurable.

`spotFinish` asks for a book only of a PMS number, where a missing book means
two named inks and a printer choosing. It fires on nothing in the repository
today and has teeth for the case it is for.

Eight identities change. meridian and vesper, both coated and both correct, do
not.

## A chip is not an ink, where it is printed as one

The FHI codes, left alone one round ago on the grounds that a bare `11-0601` is
underspecified rather than wrong, and that choosing between TCX and TPG for
somebody else was not the engine's business.

Both halves of that were wrong, and one measurement shows why.

    identity     colour     hex       role     fhi       what it does
    ancroft      chalk      #F5F3EC   ground   11-0601   ink in "reverse"
    fathom       foam       #F1F0EA   primary  11-0601   ink in "reverse"
    perigee      paper      …         primary  11-0602   ink in "full"
    verdon       calcaire   #F3F1EA   ground   11-0601   ink in "inverse"
    hallward     paper      #FBFAF7   ground   11-0601   ground only
    …

**Fourteen of the fifteen are printed.** Each is the ink of a reversed
colourway: the mark goes on paper in that colour. And the Fashion, Home +
Interiors book numbers cloth, paint and plastic — there is no ink formula behind
any of it. So the suffix was never the problem. A press cannot mix `11-0601`
whether it says TCX, TPG or nothing at all.

The fifteenth is hallward's paper, which appears in no colourway's slots and is
only ever the ground a colourway is cut *for*. That is the stock, and recording
which chip your stock matches is a reasonable thing for a manual to say.

So `spotBook` does not ask whether a reference is FHI. It asks whether the
colour is an ink, and `inked()` reads that off `rules.colourways` — a slot value
is ink, the `on` is paper. Both callers already had the colourways to hand and
now pass them. Fourteen fire; hallward does not; hallward is the one identity
that still carries a six-figure code, which is the outcome that says the check
is about the right thing.

The fourteen are removed rather than replaced, for the reason northline's seven
were: what printing ink matches `#F5F3EC` on a given press and paper is not
derivable from the hex, and this file's whole position is that an absent print
value beats one nobody chose. They print from their builds.

What is lost by removing them is the record that the stock was matched to a
chip, and there was nowhere in the schema to put that — `rules.fabrication` is
about engraving and foil, not paper. That gap is closed in the section below.

## A colour has two lives

The gap the round before this one named and could not fill.

A near-white brand colour is two things at once. It is the paper the job is
printed on — `ancroft/chalk` is the ground the whole manual sits on — and it is
the ink the mark reverses out in, because `reverse` names it as the ink of a
slot. Those want different references. Paper is ordered from a mill by a
material chip; ink is mixed on a press from a formula. One `pantone` field could
hold one of them, so the two collided in it and the FHI chip lost.

`tokens.colour.<name>.material` is the other field. `cmyk.table()` carries it,
`brand.json` records it, and the palette chip prints it beside HEX, RGB, CMYK
and PMS. The fifteen chips are back where they belong and `pantone` now holds
nothing but printing inks.

The two checks are mirrors of each other, and worth reading together:

- `spotBook` — a Fashion, Home + Interiors chip in `pantone`, on a colour that
  is printed. There is no ink formula behind it.
- `materialBook` — a Pantone solid number in `material`. That is a formula for
  putting ink on something, so it answers a different question, and nobody can
  order a paper by it.

Neither fires on anything here now. That is not the checks going quiet: it is
what a schema with the right two fields in it looks like, and each still has
teeth against the case it is for.

### The label broke a font

`MATERIAL` has to be written in the language the document is written in, like
every other word on the page — `MATIÈRE`, `חומר`, `素材`. And 材 was not among
the 726 characters yamabiko's subsetted IPAGothic was cut for, so the Japanese
manual asked for a character its own shipped face could not draw.

`typeface.cannotDraw` caught it at build time, which is the whole reason that
check exists. Nothing would have looked wrong in a browser here: Chromium falls
back to the system's full IPAGothic, which this machine has. Two of the three
ways of checking were quietly useless for the same reason and had to be thrown
away — a resvg render, because resvg ignores an `@font-face` data URI
altogether and was drawing both fonts with a system face; and a first browser
comparison written without a charset, which rendered both in mojibake and
matched perfectly.

What settled it was metrics. Against the subset it replaces, the re-cut keeps
the same advance width and the same bounding box for all 726 shared characters,
worst difference 0 units of 2048, with the vertical metrics unchanged. It is
727 characters now and 133 KB rather than 209, because the cut drops hinting
that nothing in these documents was using.

### And the method is in the repository now

This font has been re-cut twice — once when the Japanese dictionary arrived and
the type specimen's own sample turned out to use a character the font lacked,
and once for a single word — and both times the method was worked out again from
nothing, because it lived in a terminal history. `engine/tools/subset-font.py`
does it now, reads the characters out of whatever files it is pointed at, and
says what it could not find. Nothing in the build runs it; fonts are cut rarely
and by hand. It is there so the next person does not start from zero, which is
the same argument the whole engine makes about a value nobody can regenerate.

## A warning that was true and useless

    warning: the master is drawn in 2 weights (5, 9), and an icon grid has one.
    The icons are cut at 1.8 on a 24 box, from the 9 the mark carries its shape
    in, not the 5 of its finest detail.

Every word of that is correct. It is also the whole of what the designer is
given: two numbers, and the news that the engine has chosen between them. There
is no way to tell from it whether the choice was obvious or a coin toss, and it
fired identically for both.

### The measurement that was wrong

`svgu.strokeWidths` answers "which weights is this drawn in" and nothing else,
so the grid took the last one — the heaviest — by ordering. Ordering is exactly
what this engine is not supposed to do, so the first move was to measure which
weight actually draws most of the mark.

Summed by drawn length, that produced a disagreement:

    tarnbrook   widths [4.5, 9]   engine picks 9   most length at 4.5  (66%)

Which would mean the icon grid was inheriting the minority weight. It is the
wrong measurement. Weight is not carried by length but by ink, and a 4.5 stroke
drawn twice as far lays down the same ink as a 9. Length times width:

    ancroft     8: 89%   3: 11%
    ravelston   6: 88%   4: 12%     (its icons come off its own icon drawing)
    yamabiko    9: 70%   5: 30%
    tarnbrook   9: 51%   4.5: 49%

The heaviest weight is the largest share on all of them. The rule was right and
had never been checked, and the check nearly broke it. That is worth writing
down: a measurement that contradicts a working rule is a reason to look at the
measurement first.

### What changed

`svgu.strokeInk` walks the drawing the same way `strokeWidths` does — the same
inheritance, the same treatment of containers and of `stroke-width: 0` — and
returns each width with the share of the ink drawn at it. `variants.measure`
takes it, `iconRules` records it in `derivedFrom` beside the weights, and
`brand.json` carries it, so a developer reading the file sees the basis and not
just the answer.

The build says the share, and only warns where the two weights genuinely share
the mark: above two thirds of the ink it is a note, below it a warning. That
threshold separates tarnbrook from yamabiko anywhere between about 0.55 and 0.7,
which is a gap in the data rather than a number fitted to the one case.

Nothing about which weight the icons inherit changed. The point of the round is
that the sentence saying so is now evidence.

### Curves, and what this does not claim

`strokeInk` counts a curve as the straight line between the points it runs
through, so it under-counts — and under-counts every weight by about as much as
every other, which is all a share needs. It does not reuse `system.pathPoints`,
which is more careful about arcs and would be a dependency pointing the wrong
way: `system.js` reads `svg.js`, not the other way round.

## Ranked first of one

The pattern note explains which shape the field was built from and why. It ends:

    Ranked first of 2 shapes in the drawing; the others are offered beside it.

Five identities said that about a drawing with one shape in it. `candidates()`
offers the whole mark and each shape separately, and where a drawing holds a
single element those are the same element — once bare, once inside a `<g>` that
carries nothing. The dedupe compared markup strings, so it saw two. They scored
identically, to four decimal places, because they were identical, and the winner
was decided by which was added first. The canvas offered a choice between two of
the same drawing.

`bare()` is deliberately narrow: a group with no attributes holding exactly one
element draws what that element draws, and anything else is left alone because
the wrapper may be doing something. vesper's `mark` holds two paths and stays.

### How good is the number?

The other half of the note is the ranking, and it never said by how much. Three
identities are decided by under a hundredth. That is only worth reporting if the
score is precise to better than a hundredth, so the next question was whether it
is.

`ink` is a coverage read off a square raster. The square was 44 pixels across.
Recomputing every score with it at 176:

    worst score shift                    0.0912
    winner changes                       ravelston, tarnbrook

A tenth of the whole score, and two identities tiling a different shape. The
margins the note was presenting as a ranking are 0.007 to 0.03, so the ranking
was being settled inside its own quantisation.

The mechanism is the one `solid` exists to prevent. A hairline lights whole
pixels at 44 across, so a thin shape reads as far more solid than it is:

    tarnbrook  shape:2  compact 0.18   won at 44, and it is very nearly a line
               mark     compact 0.64   wins at 176

Ravelston's field was a set of plain rules; it is the hatched shield panels now.
Tarnbrook's was three heavy bars; it is the arch and the waves. Both moved from
an elongated shape to a squarish one, which is the direction the coarse read was
biased in.

176 is where it settles: 352 moves the worst score by 0.025 and changes no
winner. The finer read costs about a tenth of a second on a build that takes six.

### And then the note

With a number worth quoting, the note quotes it — the winner's score, the
runner-up's, and by name. Under 0.02 apart it says so plainly, because two
motifs that close are inside the precision of the thing that ranked them and the
designer should look at both rather than take the engine's word.

`whyOnly` is the fourth string this needed: "Ranked first of 1 shape" is a
sentence about a competition that did not happen.

## The canvas motif options, which do not exist

Every package the engine has ever written ends its pattern note the same way:

    the canvas shows every one of them and system.pattern.motif and
    system.pattern.construction pin whichever you want.

The second half is true. The first half is not, and grep settles it in one line:
`pattern.options()` — which builds every motif crossed with every construction
as swatches, and is exported — is called by nothing. Not `editor/bundle.js`, not
`documents/`, not a test, not `site/`, not `api/`. Confirmed against a built
`editor.html` as well as against the source: `halfDrop`, the chosen
construction, appears 48 times in ravelston's editor and `brick`, `rotary` and
`scatter` appear zero times.

### Why it cannot simply be turned on

The canvas is one static HTML file with no engine behind it. `bundle.js` writes
`patternTiles` keyed `density:colourway`, and the block looks its tile up there,
so anything the canvas can offer has to be pre-generated. Offering motif and
construction multiplies that key by both:

    ravelston   9 tiles today,  32 KB    486 tiles, 1729 KB
    vesper      9 tiles today,  14 KB    243 tiles,  369 KB
    pagrin     18 tiles today, 147 KB    162 tiles, 1319 KB

`editor.html` is about a megabyte, so the full grid doubles or triples it. A
cross-section — the chosen motif in every construction, plus every motif in the
chosen construction — is 150 KB to 1.3 MB, which is no better for pagrin,
because its mark is one enormous path and every swatch carries several copies of
it. Even one density and one colourway is 41 to 73 KB and still would not be a
chooser.

None of that is an argument for keeping a sentence that says otherwise.

### What replaced it

`options()` is gone, with the measurement written where it was, so the next
person to think of building it starts from the numbers rather than from
scratch.

The alternatives were already in `brand.json` and were not usable: bare keys.

    "alternatives": { "motifs": ["shape:2", "shape:3", "shape:5", …] }

Nobody chooses between `shape:5` and `shape:7`. They carry the name the engine
wrote off the artwork and the score it ranked them by, in order:

    { "key": "shape:3", "name": "the third shape in the drawing", "score": 0.5572 }

and the note points there. The test does not take that sentence's word for it:
it pins each alternative in turn and checks the spec comes back with the motif
it asked for, because "you can pin whichever you want" is a promise about
behaviour and this file has just been caught making one it could not keep.

The close-call advice added one round earlier — "look at both on the canvas
before you take it" — was the same false promise, one round old. It says where
they actually are now.

## Seven of ten inks were not there

`editor/render.js` drew a pattern block by looking up `density:colourway` in the
tiles the bundle carries, and falling back when it missed:

    const tile = bu.patternTiles[key] || bu.patternTiles[Object.keys(bu.patternTiles)[0]];

Two things make that miss. Tiles are cut per **role** — ground, primary,
secondary, accent — and `COLOURS()`, which fills the menu, is every role *and*
every colour name. And a role whose ink fails contrast on its ground gets no
tile at all, on purpose.

Measured on meridian:

    the ink menu offers   primary ground accent secondary neutral
                          deep tide beacon chalk slate      (10)
    tiles exist for       ground primary secondary           (3)

The other seven drew `fine:ground` and said nothing. `accent` was refused
because it measures 1.83:1 on its ground, and `gen.refused` carries that
sentence into the bundle as `patternRefused`, where the block could have read
it. The fallback meant `cvPatternRefused` — a string that exists in four
languages for this exact case — could only appear when an identity had no
pattern whatsoever.

The menu is built from the tiles now, and a block whose tile is missing prints
the refusal in the engine's own words rather than drawing somebody else's
colourway.

## The upload that failed with a parser error

Reported from use: every SVG upload on the hosted app failed with

    Unexpected token 'T', "The page c"... is not valid JSON

The string is not in this repository. It is `JSON.parse` reading the first
letter of a hosting 404 page — "The page could not be found".

### The route was never deployed

`client.html` posts the artwork to `/api/ask` as the first thing it does.
`vercel.json` publishes `api/*.js` and nothing else, and `api/` held two files:

    the client posts to    /api/ask  /api/preview  /api/build  /api/render
    api/ held              build.js  inspect.js

Three of the four had no function behind them, and the one function the client
never calls is the one that was there. The local server in `src/app/server.js`
routes all five, which is why this never showed up in development: the hosted
route list and the local route list are different lists in different files and
nothing compared them.

`api/ask.js`, `api/preview.js` and `api/render.js` wrap the same handlers
`server.js` calls, which is the point of `src/app/handlers.js` — the hosted app
and the local one answer from the same code.

### The client assumed every answer was JSON

    fetch(path, …).then(function (r) { return r.json().then(function (j) {
      if (!r.ok || j.ok === false) { … }

`r.json()` before `r.ok`. Anything in front of the app that answers in HTML —
a 404 where a route is missing, a 413 where an upload is too large, a proxy's
own page — became a `SyntaxError` about a character, shown to somebody holding
an SVG with nothing to do about it.

It reads the body as text and tries JSON now. A 404 names the route that is
missing; a 413 says the artwork is too large and that running it locally uploads
nothing; a refusal the engine wrote still arrives as its own `what` and `how`.

The test reads the route list out of `client.html` and checks it against the
files in `api/` **and** the paths in `server.js`, because the defect was three
lists drifting rather than any one of them being wrong.

## The audit had been taken off the door it was written for

The route list above says one more thing, read the other way round.
`/api/inspect` was deployed, tested, and called by nothing.

It had been the first screen: drop the artwork, and before any question is
asked, read back what the file actually contains. When `client.html` was
rewritten into four screens that screen went, and the audit went with it. What
took its place was `/api/ask`, and `ask` read the artwork by a different path —
`intake.read`, which measures, and never runs the audit at all.

Two readers of one file, in one product, that nothing had put side by side:

    dropped on the door                what ask said         what the audit says
    a mark set in live text            fine, 1 colour        blocker: live text
    a PNG in an SVG wrapper            fine, 0 colours       blocker: a raster
    a drawing with nothing painted     (threw)               blocker: nothing painted

The first is the one that matters: accepted, described, measured, carried into
the questions, and the package at the end of it contains a mark that needs the
recipient to have Futura. The third threw `the artwork renders empty, so it
cannot be measured` — the engine's own internal sentence, written for a caller
rather than for somebody holding an SVG, and `normalise` has had a proper
three-part refusal for that exact case the whole time.

### The audit runs at the door

`ask` puts each asset through `normalise`, the same function `project.load` puts
every asset through. A refusal at the door is the refusal the build would have
made, in the same words, before any work is done on the strength of it. It costs
2–36 ms against a round trip that already takes 750–1800 ms, nearly all of it
the pattern search.

### And it measures what came out of that, not what went in

Raw and audited are not the same drawing. Across the thirty-two identities, read
one way against the other:

    a different pattern motif   9 of 32
    a different colour count    3 of 32

A fill still sitting in a `<style>` block is invisible to anything reading
attributes. A transform that has not been flattened measures a stroke thinner
than it prints. A shape lying off the artboard widens the box every size is
worked out from. Pagrin is the sharpest case — the one identity that came out of
a real exporter, drawn in a gradient:

    read raw       0 colours, slots ["all"]
    read audited   slots ["ink"], plus a warning that was already written

`normalise` has said the right thing about a gradient since the twelfth
identity: that a colourway names one colour for a slot, that a gradient is not
one colour, that `keep` is how you carry it, and that it cannot be a spot ink.
It was generated on every upload and thrown away. It is on the screen now, under
the facts, shut by default, split into what was cleaned up and what is worth
looking at — those are different things and one summary line calling both "did"
was wrong about half of them.

### Three smaller things it was hiding

- A refusal was flattened to one line of `what`s, dropping the `why` and the
  `how`. The `how` is the half that tells somebody what to do.
- A refusal *returned* went out as **200**; the same finding *thrown* from
  `asSvg` went out as **400**. One answer, two status codes, in both the local
  server and the hosted function.
- `Continue` stayed lit after a refusal, because step 0 asked whether a file had
  been read rather than whether the door had accepted it. It asks the second
  question now.

`inspect` is gone: the handler, the route in `server.js` and `api/inspect.js`.
Everything it did that anything used, `ask` does. What is left of it was a
second reader of the same artwork, which can only ever disagree with the first.
Its one other duplication went with it — `lockupsFor` said, for the fourth time
in this codebase, that three of the four lockups need both drawings; that rule
is `seen.lockups` now and the front door reads it instead of restating it twice.

The route test runs both directions. A deployed function nothing calls is a list
that has drifted, exactly like a call nothing serves.

## The front door could not recolour the artwork it was given

With the audit at the door, the next question is what the door does with what
it read. It reads the palette off the drawing, shows it, asks which colour does
what — and then writes the colourways, and none of them were about this artwork.

Every identity dropped on the door, built the way `client.html` builds it, and
the files measured:

    came out drawn in one colour, having been drawn in more     9 of 32
    wrote two colourways that are the same file                 2 of 32
    had a slot no colourway named                               5 of 32

### The first colourway was a flattening, not a colourway

    colourways: [way(first.name, first.hex), way('reverse', ground.hex)]

`way` maps every slot to one colour. Carrock is drawn in an ink and a shellac
label; the door measured the shellac, put it on screen, asked the designer to
confirm it was the accent, and then wrote:

    door           ink #241C1A   label #241C1A
    project file   ink #241C1A   label #B4442C

The word for this was already in the engine. `keep` means "leave this slot as
the master drew it" — `svg.js` has had it since the twelfth identity, for
gradients. The master is already painted, so the drawing's own colourway is
every slot set to `keep`. It is called `full-colour`, and the flat version is
still cut, on purpose, as `mono`.

`mono` is cut only where there is something to flatten, and that is the number
of distinct paints on the drawing's slots — not the number of slots. Beaumont
has four slots all painted `#1A1714`; counting slots cut it the same file under
two names, which is the first thing the check caught after it was written.

### A colourway can only name the slots it was told about

`intake.read` took them off the master alone:

    const slots = svgu.slotsUsed(doc);          // doc is mark || wordmark

Five identities draw a slot that lives only in the logotype — beaumont's
`word`, vesper's, yarrow's, perigee's, saltmarsh's. No colourway ever named it,
so `applyColourway` left it painted as the master drew it, and in the reverse
lockup the words stood on a ground of their own colour:

    beaumont   word     #1A1714 on #1A1714   1.00   → #FFFFFF   17.85
    vesper     word     #2E2A63 on #2E2A63   1.00   → #FFFFFF   12.90
    yarrow     word     #2C4A3B on #2C4A3B   1.00   → #FFFFFF    9.77
    saltmarsh  word     #25373C on #25373C   1.00   → #FFFFFF   12.42
    perigee    ink      #000000 on #000000   1.00   → #FFFFFF   21.00

### And the door read the upload again to decide what to name

The last round's fault, in the next function along. `ask` had been fixed to
audit; `stage` still called `intake.read` on the raw upload to work out what the
colourways would name.

Auditing is not sufficient on its own here, which is the part worth keeping.
`assignSlots` names a slot **after the palette colour it is painted in**, and
falls back to `colour-1`, `colour-2` when nothing matches. So the same drawing
read without a palette and read with one comes back with different names:

    perigee   without   colour-1  colour-2  colour-3  ink
              with      colour-2  ink       accent

The audit has to be the audit the loader will run, palette and all. `stage`
passes the confirmed colours into it now. Before that, perigee and pagrin wrote
colourways naming slots that would not exist, nothing was repainted in any of
them, and their `reverse` was byte-for-byte the same file as their default.

### One reader, again

`ask` read the upload, `stage` read it again, `preview` read it a third time for
a colour to draw in. Three readers of one drawing is three chances to disagree,
and two of them were wrong. `readArtwork(mark, wordmark, colours)` is the only
one now: audit, then measure, with the palette that will be used.

### The advice was true and unfollowable

The build had been saying all of this, into the notes at the end of a package it
had already written:

    colourway "reverse" gives no colour for word, so every file in it keeps what
    the master was painted: word (#1A1714). Add the slot to the colourway, or
    remove it from the artwork.

    the master paints a slot (ink) with a gradient, and every colourway names a
    flat colour for it, so the gradient is in the master and in none of the
    files this wrote. Write "keep" instead of a colour in the colourway that is
    meant to carry it.

Both correct. Both telling somebody holding a browser to edit a colourway,
which the front door does not offer — the same shape as the CMYK `how` that was
written for a text editor and shown in a form. The fix is not better wording; it
is not writing the project that needs it. A test asserts the door produces no
package the build has to say `gives no colour for` about, which is also the only
check with teeth on the palette: an audit run without it names slots the loader
will not.

One hand-written colourway of the 106 in this repository has the same fault —
northline's `outline` names a colour for `route` and says nothing about `ticks`
— and the build has been warning about it. It stays: that fixture exists to
exercise this warning, and a test says so.

## "keep" is not a colour, and seven places thought it was

Making the drawing the first colourway made `keep` the common case, and that
found a bug that was already shipping.

Seven places reduce a colourway to the one colour something needs when it can
only take one — a pattern tile, a partner lockup, a sub-brand row, a misuse
diagram — and every one did it the same way:

    const ink = Object.values(cw.slots)[0];

A colour, right up until the slot says `keep`, and then it is the word. The
tiles went out with `stroke="keep"` in them, which paints nothing.

Vesper and pagrin are the two identities here whose own project files use
`keep`, and both were shipping it:

    vesper   07-pattern/pattern-{coarse,fine,medium}-dusk.svg
             guidelines.html, deck.html
    pagrin   07-pattern/pattern-{coarse,fine,medium}-spectrum.svg

Vesper's documents got it a second way. The pattern specimen in the manual and
in the deck takes the colourway's value for the master's own first slot, and
vesper's first slot is `ring` — the gradient one, the whole reason its `dusk`
colourway says `keep` at all. Eight files, in packages this repository builds
and publishes, and nobody saw them: a tile that paints nothing looks like a tile
you have not scrolled to.

There is a third way in, which only appears once *every* slot says keep, as the
door's `full-colour` does. `misuseCells` sorts the colourway's inks by contrast
and paints the diagrams in the best; `contrast.ratio('keep', …)` is `null`, the
comparator is `NaN`, the order survives untouched, and `[0]` is the word. Its
`|| ctx.primary.hex` fallback never fired because `'keep'` is not falsy.

`svg.js` has `inkOf(cw, paint)` now — the first slot with a colour anything can
name, resolving `keep` through `paintBySlot` to what the master actually paints
— and `blocks.js` has `inkOn(ctx, cw)`, which keeps its existing preference for
the master's own slot and resolves the same way. The seventh site was already
sitting next to the resolver it needed: `inksOf` is two functions above
`misuseCells` and does exactly this.

    vesper  pattern-coarse-dusk.svg      stroke="keep"  →  #C2620E
    pagrin  pattern-coarse-spectrum.svg  stroke="keep"  →  #FF5715

The check is the flat one: no file in a package, of any kind, may be painted
with the word.

## A name the files cannot carry

Type a Japanese or a Hebrew brand name into the front door and it dies on the
fourth screen:

    the brand name "やまびこ" has no letters a file name can carry.
    Add "latinName" to the project — the roman spelling the files should be
    named after, for example "latinName": "Maayan".

Correct, and the right sentence to somebody holding a project file. No help at
all to somebody holding a browser: there is no file to add it to. Third time
this repository has found the same shape — the CMYK `how` written for a text
editor and shown in a form, "add the slot to the colourway" shown to a door
with no colourway editor, and now this.

`project.js` states the intent the door was breaking:

    // Romanising a name is the designer's decision, not an algorithm's, so it
    // is asked for and used, and asked for here rather than three quarters of
    // the way through writing a package.

Asked for at load, which is early for a project file and late for a person: the
door took the artwork, six answers and a layout choice first. Two of the
thirty-two identities are this exact case — maayan and yamabiko — and both set
`latinName` by hand, so the engine has always been able to build them.

It is asked for under the name now, and only when it is needed. The test for
"needed" is `naming.slug`, which is UMD as of this round for the same reason
`contrast.js` is:

    // UMD, for the same reason contrast.js is: the front door has to know
    // whether a name it has just been typed can carry a file, and the answer
    // has to be this one. A second copy of the fold table in the page would be
    // a second answer, and the two would disagree the first time somebody
    // typed an ø.

`kvist-and-sønn` is the reason that table exists; a naive slug in the page would
have written `kvist-s-nn` and the two screens would have disagreed about the
same name.

`render` and `make` both refuse a name nothing can be filed under, in the door's
language, with a what, a why and a how that can be followed where it is read.
With a roman spelling, やまびこ builds all 55 files as `yamabiko-mark-…` and
`brand.json` still says `"brand": "やまびこ"` — it names files only.

## The hosted front door handed back a package nobody could open

Hosted, there is no filesystem between one request and the next, so the answer
to `/api/build` carries the package rather than pointing at it. `api/build.js`
has sent `zipBase64` since the app was first hosted, and both hosts have served
`jszip.min.js` for the page to open it with — `server.js` says why in as many
words: *"hosted, it opens the documents out of the zip because a function has no
filesystem to serve them from"*.

The page rewritten after it never asked for jszip and read only `j.base`:

    a.href = j.base + d[0];

    local    /b/8f2c1a9d/guidelines.html
    hosted   undefinedguidelines.html

Five cards on the last screen — the manual, the deck, the canvas, the published
page and the zip — and hosted, not one of them opened anything. The bytes were
in the answer the whole time.

Two answer shapes with one reader and nothing comparing them, which is the
route-list defect again a layer down. `npm test` now asserts the hosted answer
has no `base` and does carry the bytes, and that the page has a branch for that
shape; `test/hosted-check.mjs` stands up the actual deployment — `site/out` as
static files, `api/*` as functions, no filesystem shared — and walks the door
from an SVG to a package. Reverting the branch makes it name all five cards and
open the manual as a 404 page.

The documents become blob URLs, and the card says the one thing that genuinely
differs: they live in the page and do not survive a reload.

## The hosted front door had no type at all

Found in the same measurement. `client.html` is a template with markers in it.
The local server fills `/*FONTS*/` with 449 KB of inlined faces. `site/build.js`
copied the file:

    // The same page the local server serves, byte for byte.
    fs.copyFileSync(path.join(src, 'client.html'), path.join(OUT, 'index.html'));

Byte for byte is the defect. The marker travels unfilled, so the deployed page
carries the literal `/*FONTS*/` and none of the faces:

    served     document.fonts.size  10
    deployed   document.fonts.size   0

The page names `'Archivo','Helvetica Neue',Helvetica,Arial` and `'Literata',
Georgia`, so it does not look broken — it looks like somebody else's page. Which
undoes the round that put the fonts there: that one existed because "the front
door was the last thing in the product still reaching out for a stylesheet", and
the hosted copy has been set in the visitor's own Helvetica through twenty-three
releases since.

`server.page()` renders it; the route calls it and so does the site build. The
test reads the markers out of the template with a regex rather than naming them,
so a marker added later cannot be forgotten in the same way.

## Every package the front door built had no type in it

Going to answer the language question meant asking first what type a door-built
package is set in. None.

    projectJson:  tokens: { type: { heading: 'Archivo', body: 'Literata' } }
    everything else: tokens.type.families = { display: {…}, text: {…} }

`heading` and `body` are words nothing in this engine reads. The loader, the
three documents, the canvas and both checks written about type all speak
`families`, so `tokens.type.families` was `undefined` in every package the door
has ever made. The same artwork, built the two ways:

    through the door       09-type  0 files | @font-face  0 | manual   63 KB
    from its project file  09-type  9 files | @font-face  4 | manual  248 KB

The 185 KB is the type. The typefaces page named Archivo and Literata over
specimens set in whatever the reader had, which is the defect at the top of
`src/typeface.js`:

    // A specimen showing the wrong face is worse than no specimen, because it
    // is offered as proof.

Two checks exist for exactly this and both had to stay quiet. `unreachable`
asks which named families cannot arrive, and none were named. `cannotDraw` asks
what the shipped fonts cannot draw, and none were shipped. A silence meaning
"nothing wrong" and a silence meaning "nothing here" are the same silence.

    display  Archivo   600 700   Helvetica,Arial,sans-serif
    text     Literata  400       Georgia,serif

Both held by the engine — the test asserts that rather than trusting the names —
and the weights are the ones the specimen sets, because the fonts round's own
warning is about a weight carried in every document for nothing.

### A scale nobody wrote is not a heading over nothing

A type scale is a decision, not a measurement, and the door decides one for
nobody. The manual printed `secScale` over `<div class="scale"></div>` and the
deck a slide reading "0 steps" over an empty box, and listed it on the chapter
divider as something to come. Both are conditional now, the way `secMisuse`
already was:

    + (((ctx.project.tokens.type || {}).scale || []).length
      ? S('3.2', T('secScale'), 'system', b.typeScale(ctx)) : '')

## What it does not do yet

- **The door cannot choose a language.** The engine writes in English, French,
  Hebrew and Japanese, with `strings.js` holding four dictionaries under a
  key-parity test and a fixture for each, and `stage` already carries a
  `language`. The front door asks nothing about it, so a Hebrew identity built
  through it gets an English manual laid out left to right — one flag from
  `<html lang="he" dir="rtl">` and a manual whose chapters read הסמל, צבע,
  טיפוגרפיה. What it needs first is type that can set the words: Hebrew's chrome
  is 38 characters Archivo and Literata cannot draw and Japanese's is 596, of
  which the engine holds no face at all — maayan ships Heebo and Frank Ruhl
  Libre, yamabiko a subsetted IPAGothic of its own. A language whose script the
  type cannot set produces a manual in tofu, which is worse than one in English.
  Now that the door writes type, choosing it to match the script is tractable.
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
    src/misuse.js     what not to do, drawn from the artwork rather than described
    src/strings.js    every word both documents set, and what a language can write
    src/previous.js   what moved since the last version, in both languages
    src/access.js     the documents measured, and the canvas asked different things
    test/canvas-check.mjs  the canvas driven by keyboard in a real browser
    test/hosted-check.mjs  the app as deployed: static page, functions, no disk
    test/rtl-check.mjs     every value, drawn against the way it is written
    test/font-check.mjs    every character, against the face it is set in
    test/reader-check.mjs  the tree a screen reader reads, and what it says
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
    projects/oriel/   the twenty-fifth: five drawings of one mark, one for each size
    projects/ancroft/ the twenty-sixth: thread, vinyl, stone and cast metal
    projects/harbourne/ the twenty-seventh: three museums, one mark, one difference each
    projects/farne/   the twenty-eighth: a mark that arrives, in a file that plays it
    projects/rookhope/ the twenty-ninth: the documents the engine writes, measured
    projects/verdon/  the thirtieth: a French document, because the brand is French
    projects/carrock/ the thirty-first: a mark that turns, and a manual that knows it
    projects/pagrin/  the thirty-second: the first that came out of a real exporter
    src/editor/       model.js, render.js, publish.js, app.js, bundle.js, emit.js
    src/editor/images.js  photographs, kept out of the document and out of undo
    src/naming.js     one naming rule for the whole package, UMD for the page
    src/build.js      write the package, brand.json and the read me
    src/cli.js        check, measure, build, edit and publish
    src/typeface.js   how a typeface reaches a document, decided once
    src/setname.js    a name that is set in the brand's face rather than drawn
    src/app/          the front door: handlers.js, server.js, client.html
    ../api/           the same four handlers, as functions, for hosting it
    ../site/build.js  every identity, built into one site, index and all
