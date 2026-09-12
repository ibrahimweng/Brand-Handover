# Brand handover

One web application that turns an approved brand mark into everything downstream
of it. You upload the mark once, and the variations, the guidelines, the client
presentation and the delivery package are all derived from it. Change the mark
and all three documents change, because none of them holds a copy.

## Why

An identity project runs to about 120 hours. Only 20 of those hours is drawing
the mark. The other 100 is applying it, showing it, documenting it and packaging
it, and about 68 of those could be done by a tool.

The measurement that matters is what a late revision costs. Change the mark on
day 20 today and somebody remakes roughly 40 mockups, 60 slides, 80 export files
and 50 pages of guidelines by hand. That is why designers quietly resist changes
they know are right, and it is the thing this removes.

## What is here

| Path | What it is |
|---|---|
| `docs/brand-designer-tools.md` | The original brainstorm. Seventeen tools ranked by the hours they give back, with a build order and a note on what not to build. |
| `docs/mark-to-handoff-plan.md` | The build plan. Named for the pipeline it describes, which runs from the approved mark to the client handover. Architecture, prior art, the canvas editor scope, the interface, 26 weeks in six phases, and the risks. |
| `specimens/meridian-manual.html` | The quality target as a brand manual. A complete guidelines document for a fictional tidal energy company, 30 sections. |
| `specimens/meridian-deck.html` | The same brand system as a 49 slide presentation, 11 chapters. |

Open either specimen in a browser. There is no build step.

## The two specimens

They are the standard the software has to clear, not decoration. Every section
in both is marked with who made it, using three states.

- **Drawn by the system.** Derived from the master SVG, the tokens and the rules
  file. Nobody touches it and it redraws itself when the mark changes.
- **Set once by you.** You make one creative decision and the system generates
  every instance of it from then on. The brand pattern, the icon set and the
  motion curve all work this way.
- **Yours.** Judgement, words, or an image you place.

Across both documents that comes to 35 sections, of which 22 are drawn, 6 are
rules set once, and 7 are written or placed by hand.

The two specimens are also deliberately different documents rather than one
document in two shapes. The manual is looked things up in and carries every
value and edge case. The deck is presented, holds one idea a slide, and drops
the reference detail. A guidelines page runs to roughly four times the text of
the slide covering the same section.

## The stack

Everything sits on one SVG parser, and all of it is MIT or Apache 2.0.

- `usvg` parses and normalises every uploaded mark.
- `resvg` renders PNG.
- `svg2pdf` renders true vector PDF, without rasterising.
- Headless Chrome is the single layout engine, so the canvas editor, the
  published guidelines page and the printed PDF are the same HTML and cannot
  drift apart.
- `Typst` compiles a printed piece laid out in the editor. It is not needed for
  the logo assets: those are written here in ink directly, so the PDFs are
  DeviceCMYK already.

Nothing here needs a paid API. Two optional models, for depth maps and cutouts,
run locally.

## Using it

    npm install
    npm run serve             # then open http://localhost:3000

Drop your logo on it. It reads the file first — what was in the export, what was
cleaned out of it, the ink box, the clear space, the smallest the mark can go on
screen and in print, and which parts of it recolour — and only then asks for a
name and a palette. The colours are the ones already in your artwork. Contrast
is measured as you type, with the same arithmetic the manual will print. Then it
builds: the manual, the deck, a published cover, the canvas and the zip, at real
URLs you can open in a tab.

A symbol on its own is enough. So is a logotype on its own — Google, FedEx and
most of publishing are exactly that, and the engine builds it as a logotype
rather than as a mark called one.

It listens on localhost and nothing is uploaded. Brand artwork is usually under
an NDA before it is under anything else, and a tool that measures it should not
be the reason it leaves the building.

## Hosting it

    npm run build            # the app, and every identity, into site/out

The same app runs on Vercel. `vercel.json` wires it up: install, build, serve
`site/out`, and put `api/*.js` on the four endpoints the page calls — `ask`,
`preview`, `render` and `build`, and nothing else. They are wrappers: the work
is the same `engine/src/app/handlers.js` the local server calls, so the hosted
app and the one on your own machine cannot answer differently. A test compares
the three lists — what the page posts to, what is in `api/`, and what
`server.js` routes — in both directions.

One thing does differ, and the page says so rather than hiding it. A serverless
function has no filesystem it can share with the next request, so a hosted build
cannot serve a package file by file the way the local server does. It sends the
zip — the package, compressed, in one answer, about 300 KB for a plain identity
— and the browser opens the documents out of it. They open in a tab; they will
not survive a reload, because they live in the page's memory. Run it yourself
and they get real URLs.

`/gallery/` is every identity in `engine/projects/`, each built to break the
engine a different way — thirty-two of them at the time of writing, and the count
is deliberately not stated anywhere the engine does not read it. Nothing in the
gallery is committed: the repository holds a master file and a project file per
identity, and the site is what the engine makes of them, rebuilt from scratch on
every deploy.

The four links per identity are the four things worth opening. **Manual** and
**Deck** are the two client-facing documents. **Cover** is a page published out
of the canvas. **Canvas** is the editor itself: one self-contained HTML file,
no server, where you drag blocks, drop a photograph on an image slot and undo
with ⌘Z, and where the system-drawn blocks refuse edits that would make them
lie.

## Status

The engine runs. `engine/` takes one master SVG and a project file and writes
150 files: every lockup in every colourway as SVG, PDF, `.ai` and PNG, icons,
favicons, social crops, the brand pattern at every density, `brand.json`, the
manual, the deck, a self contained canvas editor, and any document published out
of it. 606 tests.

The claim the whole thing rests on is checked in the suite. Thicken the ring in
`mark.svg` from 9 to 14, rebuild, and the ink box goes 109 to 114, clear space
27.25 to 28.5, the minimum size 32 px to 21 px and 9 mm to 5.8 mm, the icon
stroke 1.8 to 2.8 — through `brand.json`, the manual, the deck and every
published page at once, while a block somebody nudged to `x: 40` is still at 40.

Blocks come in three kinds: yours, drawn by the system, and set once by you.
`engine/README.md` has the detail.

Photographs go in by dropping a file on an image slot. The editor then measures
the mark against the actual pixels underneath it and says which colourway would
read there, because putting the mark on a bright sky is the thing people
actually get wrong and it is arithmetic, not taste.

Pages come in nine sizes, from a 16:9 slide to A4 and US Letter, one per
document and any page free to differ. Layout is in pixels and printing is in
millimetres, because 794 px is only A4 by accident of 96 dpi. Changing the size
scales the layout and keeps anything that was against an edge against it.

Photography has a treatment: a duotone and a scrim set once in the project and
applied to every image by rule, drawn on screen with an SVG filter rather than
baked into the file, so changing the recipe changes every picture in every
document at once. The editor then measures the mark against the treated pixels
and works out the scrim strength that particular photograph needs, which is the
thing an opacity slider is usually guessed at. A project can list its own
photographs, and then they are in the package — as given and as the rules treat
them — on the cover of the document the engine writes, and on the manual's
photography page, which shows the brand's actual pictures rather than a grey
ramp standing in for them. Going to press, the treatment is baked into the
pixels, because a press has no filters and CMYK has no alpha channel.

Print work has bleed and crop marks. Set the bleed once and the sheet grows to
the media size, the marks land on the trim corners, and anything touching an
edge is painted out past the trim for you, because asking a designer to draw a
block at minus eleven pixels is how it gets forgotten on the one page that
matters.

The logo PDFs are genuinely CMYK. Not converted at the end: the operators in
the file are the declared ink builds, because a hex code describes light
leaving a screen and what it becomes in ink depends on a press and a paper no
formula knows about. Where a build has not been given the engine says so rather
than inventing four numbers, and it checks total ink coverage and rich black
before anything goes near a press.

A piece laid out on the canvas can go to a press. `handover print` writes it as
Typst and compiles it: real page size, bleed and crop marks, every declared
colour as ink and nothing in RGB. The mark is redrawn from its own path data
rather than embedded, because Typst places an SVG as vector but paints it in
RGB, and an RGB mark on a CMYK page is the uncontrolled conversion the whole
print path exists to prevent.

That makes two emitters in a project whose argument is that there is one, so it
has a check rather than an assurance: the redrawn artwork is compared with the
SVG renderer shape for shape, and the printed page with the published page area
by area.

Mockups put the mark on things. Drop a photograph, drag four corners onto the
surface in it, and the artwork is mapped into that surface's perspective and
blended so the photograph's own shading comes through it. The editor then
samples the surface and tells you when the artwork cannot be seen on it, which
is most often because multiply can only darken and the artwork is lighter than
what it is sitting on.

There are plans and signed licences, and a package that tells the client they
own it outright. No billing, though, and none is possible here: taking a card
is a server, and there is no server in this. What is built is the half that has
to be settled first, and with no vendor key set nothing is limited at all,
because a tool that refuses to run your own job on your own machine is one you
route around.

The whole thing had been written against one mark, which is a coincidence
rather than a test, so it has now been run on a second identity: **Halyard**,
built to be unlike the first — filled artwork where Meridian is a stroke, two
inks in the mark where Meridian has one, underscores in its naming pattern,
colourways that do not line up with the colour roles, and four faults left in on
purpose. All four were reported with the fix in each. Ten things were wrong with
the engine, and none of them could have been seen with one project in the repo:
the minimum size had never been measured off a fill; a sharp corner read as a
thin stem and put the floor 20% too high; the mark specimen flattened two inks
into one; three separate renderers dropped the mark when a block asked for a
colourway the project does not cut; a mark drawn entirely in fills had no
motion; the construction diagrams were painted in a brand role that vanishes on
a light page; the naming pattern's own separators were being thrown away
silently; `height="auto"` was on every scaled drawing and is not a length; the
manual, the deck and the CLI all said *thinnest stroke* for a number read off a
fill; and the deck fell over on a ground colour that is not one of the
colourways. All ten are fixed and each is pinned in the suite to the case that
found it. `engine/README.md` has the detail.

A third followed, because two projects that agree about something is not
evidence. **Kvist & Sønn** breaks every assumption the first two share: a mark
252 units wide and 90 tall with its origin at minus six, fills and a stroke in
the same artwork, a name that is not spellable in ASCII, two colourways rather
than five, no mark lockup, and a leftover Illustrator stylesheet in the file.
Eight more defects, and this time two of them put a wrong number in front of a
designer rather than a wrong pixel: the minimum size was read off the stroke
whenever there was one, so a mark that is mostly fills declared a floor at which
its own subject is 1.75 px wide; and the clear space box was drawn as a square,
which is a false statement about the rule in the document the client is handed.
One more stopped the build outright — a CSS rule matching nothing, which the PDF
writer hands to a browser that is not there. One made every icon and social
crop in the package come out blank. The rest: a measurement that changed with
the render scale, a Norwegian name mangled into `kvist-s-nn`, two of four
emitters not escaping the brand name, and diagrams drawn on a square canvas
whatever shape the mark is. All eight are fixed and pinned in the suite.

It also produced the first evidence that any of this generalises. A viewBox with
a negative origin, a project with no mark lockup, two colourways instead of
five, and an Illustrator export that puts all its paint in CSS classes were
already handled correctly, everywhere they were used.

A fourth, **Hallward Press**, took away everything the first three have in
common rather than adding something new: an ink and a paper and no third colour,
one colourway, one typeface, no photography block, and a monochrome seal drawn
in a 2048 unit box. Five more defects. Two were about a number nobody had
thought of as a number — a viewBox is a unit system, not a resolution, and the
engine was rendering six pixels to the unit, so a mark drawn at 2048 rendered
12288 across, 151 million pixels, and the build took 45 seconds instead of two;
while the stem scan, rendering at a fixed width, gave that same mark's hairlines
two pixels and measured them wrong. Both are bounded properly now, 45 s to 2.5 s,
with every existing measurement byte-identical.

The other three were about the same thing from different angles: **nobody was
asking whether the mark could be seen.** The manual's headline specimen, the
first picture in the document, puts the mark on the colour in the primary role —
which is a colour to present on in an identity with a palette and is the mark's
own ink in one built from an ink and a paper. Hallward's specimen was a plain
black rectangle at 1.00 to 1. Four slides of its deck were the same, and chasing
that turned up an older one: Halyard's title slide had been drawing bone on bone
since the day Halyard was added, through two rounds of browser checks that
looked for console errors, missing renderers and overflow and never once asked
whether anything was visible. Contrast is arithmetic and the module for it has
been in the repo since the first week. It is asked now, on every document, and
all four read between 12.9 and 18.0 to 1. The fifth: a part-transparent shape
was counted by the ink box, invisible to the stem scan, and unprintable in a
spot ink, three defensible decisions never reconciled and never mentioned.

A fifth, **Northline**, is Hallward's opposite: twelve colours, eight
colourways, four typefaces, 245 files, and a mark written the way a drawing tool
actually writes a repeated element — once, in `defs`, placed with `<use>`. Six
more defects, and two were already shipping. Nothing here had ever heard of a
reference: both emitters found the original sitting in `defs` and drew it once,
at the coordinates it is defined at rather than placed at, in black rather than
the colour the `<use>` carries. And walking `defs` at all draws things that must
never appear — **Kvist's printed piece has been carrying a solid rectangle the
size of its own artboard** since the day Kvist was added, which the Typst check
missed because it only ever ran on Meridian, which has no `defs`. References are
resolved at the front door now, so a `<use>`-written master and a plain-path
master produce byte-identical output.

The third was the same root cause as the fourth round's, for the third time:
**five of the six misuse cells were invisible** — painted in the colour in the
primary role on a stage whose colour belongs to the page, which flips with the
reader's light or dark setting. Halyard's have been blank since the day it was
added. The sixth cell had no treatment at all, so one cell in every manual ever
built showed a plainly correct mark under a caption saying not to do it. Then a
deliberately-wrong colour too dark to see on its own ground, and a colourway
missing a slot that warned three times without ever saying what it did instead.

A sixth, **Perigee**, differs in what the *file* is rather than what the
identity is: a mark exported the way a web tool writes one — `hsl()` for one
colour, the word `black` for another, `#F63` for a third, no slots tagged, a
`clipPath` around everything. Five more defects, and the first two are the worst
found in the whole exercise.

**A mark drawn in black never changed colour.** An unset fill paints black in
SVG, so the cleaner removes `fill="#000000"` as redundant — and the recolouring
step only repainted attributes that were already there. A mark in plain black
came out black in every colourway, in every file, silently, with nothing
reported. Every notation is affected — `black`, `#000`, `rgb(0,0,0)` — while
`#010101` works. Black is the commonest colour a logo is drawn in.

**A palette written in anything but six-digit hex broke every measurement.**
Three modules each had their own hex reader and none knew `hsl()`, a colour
name, or `#123`. Anything else gave `NaN`, and `NaN` compares false against
every threshold, so nothing failed loudly: `brand.json` told the client every
pair in their identity was "Never for text", `NaN` appeared sixteen times in the
manual, and the whole pattern set was refused for "measuring NaN:1". There is
one reader now; where it cannot tell it says "Not measured" rather than "Never
for text", and a project with an unreadable colour is refused at load by name.

The rest: `hsl()` survived into the printed piece as the literal `rgb("hsl(207`;
the colour pass and slot assignment walked into `defs` and gave a clipping
rectangle a brand colour slot — the same rule the printed piece needed last
round, now shared; and a warning of mine that only looked at the mark.

The check that only knew Meridian now knows all of them: the path translation
runs over every project, twelve assets, all with zero structural difference.

A seventh, **מעיין**, is named in Hebrew, written in Hebrew, and reads right to
left. It could not be built at all, and the reason is the sharpest thing found
in the whole exercise: two rounds earlier the namer had learned to refuse a
brand with no latin in it, and to say *give the project a "latinName"* — which
nothing anywhere read. A test asserted the wording of that message. So every
brand named in Hebrew, Greek, Cyrillic, Arabic or Japanese was locked out by an
escape hatch that was only ever a sentence. It is real now, and settled when the
project loads rather than three quarters of the way through a build. A second
place that turns a brand into a filename was writing the printed piece to
`-.typ`.

Every document also declared itself English and laid itself out left to right —
four emitters, four hardcoded `lang="en"`, no `dir` anywhere. That comes from
the project now.

And a colourway that cannot be seen on the ground it names was never reported.
The contrast module has been in the repo since the first week; nothing was
asking it that question. The documents had learned to quietly show a different
colourway instead, which is exactly how it stayed hidden, and every file for the
unreadable one shipped anyway. Three of the seven projects had one — **two of
them written by me in the two previous rounds, while working on the code that
picks what can be seen.** That is the honest measure of how invisible an unasked
question is.

An eighth, **Thornbury Mills**, is the first that is *damaged* rather than
merely unfamiliar: a file edited by three people since 1998, with a stray click,
an old roundel dragged off the artboard instead of deleted, a rim bleeding past
the edge, and coordinates to nine decimal places.

**The normaliser had never looked at a coordinate.** It read what kind of
element each shape was, what colour it was and which slot it belonged to, and
never where it was. So one handle dragged to 99999 drew a hairline across the
artwork thinner than anything drawn on purpose: the mark measured a narrowest
stem of 2 where the thinnest real part is 10, and the smallest usable size would
have come out five times too high with nothing said about it. Shapes are
measured against the artboard now — outside it is removed, crossing it is a
warning, and several times past it is a refusal.

A box of no size was accepted as a size (`viewBox="0 0 -100 -100"` produced a
negative narrowest stem, reported as a fact), and a file with nothing painted in
it threw a bare `Error` out of the measuring step much later. Both are refusals
in plain words now. And `ok` was hardcoded `true` at the end of the normaliser,
so **every blocker found after the first pass was described and then ignored** —
the first thing the new refusal did was get overruled by the function that
raised it.

The claim the whole thing rests on is finally checked on all of them: halve the
artwork inside the same box, and the ink box, the clear space and the narrowest
part all halve while the smallest usable size doubles — on every project whose
artwork fits its artboard. Writing that test found one more thing, in a fixture
shipped the round before: **Ma'ayan's ripples were sliced flat by its own
artboard**, and the first version of the new check would have let it through.

Ten identities in, the axis that was left had nothing to do with identities: two
builds of an **unchanged** master produced 45 different files out of 138. Block
ids mixed the clock into a counter, PDFs carried a creation date and a fresh
random file identifier, `usage.json` recorded when it was written, and the zip
stamped every entry. So the one thing this project asks you to do — build,
change the master, build again, diff — was impossible, because everything
changed every time. `SOURCE_DATE_EPOCH` is honoured now and all ten projects
build byte-identically. Thicken Meridian's ring from 9 to 14 and **96 of 138
files change while 42 stay untouched**, and the 42 are exactly the wordmark
files that do not depend on the mark.

The last thing found was of a different kind again, and it was found by asking
what a project can declare that nothing reads. `system.icons` is what the engine
reads; written beside `system.pattern` and `system.photography` the natural
spelling is `system.icon`, which did nothing at all — no override, no warning,
the manual showing the default. So does any mis-cased rule. A setting nothing
reads is reported now, with the nearest real one named.

The eleventh identity was picked by asking what the ten had in common, and the
answer was their shape: **not one was taller than 1 to 1.22.** So **Spire** is a
tower, 76 wide by 358 tall, with six colour slots. The smallest usable size is
computed by dividing the box by the narrowest stem across it, so it has always
been a *width* — which nothing had ever needed to say, because until now every
mark was roughly square. `brand.json` said `13 px`; read as a height that gives
a mark 3 px wide with a 0.9 px stem, a quarter of what the number promised. It
reads `13 × 42 px` now, everywhere, and a square mark still reads `32 px`.

Checking that fix found three more. The size specimen is drawn by two renderers
and only one of them learned to say the height, so the same mark read `110 × 40
px` in the manual and `110 px` on the page the manual published. Hallward's
floor is 766 px, so its specimen asked for 1532, 766 and 460 px in a column 282
wide: the manual capped each preview on its own and drew **the same picture
three times under three different numbers**, and the canvas capped none and ran
a 1532 px mark off the edge of the page. And the engine refuses an icon *you*
hand it whose thinnest part paints under the stroke rule, then wrote its own
below the same rule without a word — Hallward's seal paints at **0.49 px in its
180 px app icon**, and it ships nothing that clears its own rule at all.

The twelfth was chosen the same way, and the answer this time was about the
material rather than the shape: **all twenty-two master files were flat
colour.** No gradient, no mask, no filter, no image. So **Vesper** is a gradient
identity — and a gradient is the one thing a colourway cannot say, because a
colourway names one colour per slot.

Writing the middle stop as the ring's colour, which is the obvious thing to
write, silently replaced the gradient with a flat pink in **every file** — all
three colourways, the primary one included — while each of the nine SVGs went on
carrying the gradient definition that nothing referenced. The engine's one
sentence on the subject said those parts "will not change between colourways";
they changed in all of them. A colourway slot can now say `"keep"`, the manual
has a page that draws the gradient and quotes its stops off the artwork, and a
gradient no colourway keeps is a warning.

Four more came out of the parts that had never met one. The **printed piece
would not compile**: Typst was handed `rgb("url(#a)")`, which it refuses, and
nothing had noticed because the only Typst source this repo ever compiled was
Meridian's page. The **PDF goes to press in DeviceRGB** while `brand.json` calls
the package DeviceCMYK, because jsPDF writes a gradient as a shading whose
colour space it hardcodes. A gradient **measured as contrast zero**, so the
colourway carrying it was never chosen for anything, while the build's own
readability check dropped it and never looked at the pale end of the mark at
all. And the manual was **opening on the wrong colourway** in six of the twelve
projects — five of them while the designer's first one read perfectly well.

The thirteenth found the biggest gap yet, and it was structural rather than
material: every project so far had **both a mark and a wordmark**. An identity
that is a logotype and nothing else — Google, FedEx, Braun, most of publishing —
is arguably the commonest kind there is, and the engine refused to build one,
naming a missing field rather than the problem. **Marlow** is a logotype and
nothing else. Either asset can be the master now, and a lockup the project has
not got the artwork for is refused by name with the ones it can have.

Four of the five things that came out of it had been wrong for other projects
the whole time. The **construction drawing placed the artwork at the canvas
origin** and then drew it in its own coordinates — nine units out for Kvist since
the round it arrived, and completely outside its own grid for a logotype, whose
box starts above the baseline. It also **drew artwork that is in no file**,
because it never clipped to the artboard: Thornbury's deliberate overhanging bar
appears in its manual and in none of its deliverables. The **smallest size
specimen was invisible** in light mode for eight of the thirteen — three blank
rectangles where the diagram saying how small the mark may go should be. The
**read me listed four folders always**, in a package that writes the lockups the
project asks for; eleven of the thirteen do not ask for all four, and Cusp's read
me named three folders it does not contain. And the **icon check never asked
whether the artwork is the right shape for a square**: Marlow fills 12% of an
icon where a square mark fills 46%, and the advice given was to draw heavier
strokes, which is not advice you can take about a word.

The fourteenth audited the *content* rather than the artwork, and the number was
stark: the longest string in the whole content block of **twelve of the thirteen
projects was 27 characters**. Every fixture's positioning statement was its own
name. A real identity job is mostly writing, and the manual, the deck and the
canvas exist to carry that writing — and had never been given any. **Beaumont &
Whitcombe Rare Books** has a 31 character name, a 331 character positioning
statement, prose in all six content fields and misuse captions that are
sentences. Its mark is deliberately dull.

The deck's title slide set the statement as its headline at 7cqw, so it ran
**657px past the bottom of the slide** and opened halfway through a word. Text
that does not fit its block was **silently swallowed on screen and printed
through whatever was underneath** — one document, two renderers, two different
wrong answers, and no report from either; the arithmetic that now catches it is
fitted against 540 measurements taken from a real browser, under the rule that
it must never say a passage is shorter than it is. The engine was **generating a
cover it knew would not fit**. Misuse captions set in spaced uppercase
monospace have been carrying full sentences since the very first identity. And,
unrelated to the words, the printed piece and the canvas **resolved a colourway
differently**, which put the mark in ink on an ink field on the one deliverable
that costs money.

The fifteenth came from two audits that both came back empty in the same place.
**No project had ever set `system.icons` or `system.motion`** — two of the four
rule blocks, whose override paths had never run. **Yarrow** is a land trust that
declares all four, and overrides each of them in part, which is what a designer
actually writes.

Overriding part of a rule **deleted the rest of it**: `"motion": {"durations":
{"base": 420}}` deleted the other three durations, and one density deleted the
other two — and with them **six of the nine pattern tiles the package writes**.
Silently, in both cases; every existing project happened to restate every key. A
size the project stated was **overwritten by the derived one**, so `"stroke": 2`
was accepted, stored and then replaced.

And the whole kind was missing from both documents. Rule blocks reached the
canvas, `brand.json` and the deck's file count, and **neither the manual nor the
deck ever mentioned one**. Fathom's entire identity is its pattern; nine tiles
went into its package and its brand manual did not contain the word. There is a
chapter for it now in both, with a section only where the project has that
system.

The sixteenth ran the same audit over the block types, and six of the eighteen
the model knows had never been generated by any fixture — two of them, the image
slot and the mockup, whole subsystems. **Sixteen rounds, and not one identity
had a photograph in it.** The reason was structural: a photograph could only
reach the engine by somebody dropping one into the editor, so a brand package
could not contain the art directed pictures the identity is built on, and the
manual's photography page was a treatment specimen with nothing treated in it.
**Saltmarsh** is eleven rooms on a tidal creek, where the photography *is* the
identity and the mark is only there to sign it.

Two defects had been waiting for the first photograph to arrive. The printed
piece **would not compile**: file names were chosen by searching `im.src` for
`'svg'`, and `im.src` is a data URI, so the search ran over the base64 payload
as well as the header — about a quarter of 60 kB photographs contain those three
letters somewhere, both of these do, and Typst refused a JPEG named `.svg`
outright. Not a wrong colour: the whole piece failed. And the photograph **went
to press untreated** — the same document showed a brand picture in the brand's
own colours on the page it publishes and in whatever the camera saw on the page
it prints, with nothing said about either.

The seventeenth needed one line of Python to find: **every typeface in every
fixture was `google: true`.** Sixteen identities, six families, and not one
licensed — which is what most serious identities are built on, and the only path
the engine had never taken. **Winterbourne** is a chamber orchestra whose
identity is its typography, and it ships the faces it is licensed to ship.

A type scale written the way a designer would write one — `{ "base": 16,
"ratio": 1.25 }` — **crashed the build**, because `tokens.type` was the one
token block nobody validated. A typeface not hosted by Google **reached no
document at all**: the CSS named it and every reader saw the fallback, including
on the manual's type specimen page, which carried the licensed name above type
set in Georgia. A specimen that shows the wrong face is worse than no specimen,
because it is offered as proof. And every document was **fetching a typeface the
identity never chose**, because the documents' own furniture hard-coded two.

The app found the same hole from the other end: it had never asked what the
typeface was, and hard-coded Archivo and Literata into every project it built.
It asks now, and the interface it asks in was rebuilt around what a designer
actually does — see `docs/app-ux-plan.md`.

The eighteenth audited the artwork rather than the project file, and the answer
was stark: **the largest mark in seventeen identities is 23 paths.** **Ravelston**
is a distillery with a heraldic crest of 46 — hatched shield, chevron, three
casks — drawn to be cut into stone.

It exposed a package **documenting an icon system it did not contain**.
`iconSizes` and `faviconSizes` were the only "what gets written" rules with no
default, so a project that did not name them shipped no icons at all, while
`brand.json` carried the full specification and the manual kept its chapter on
the grid. Sixteen of eighteen projects covered it by habit; the two that did not
were the two most recently written. And once icons were finally written, the
check that has existed since the thirteenth round said the crest needs 195 px
before it holds together and told the designer to draw a simplified icon — **which
the project had no way to carry**. It does now, and the read me, `brand.json` and
the manual all say which drawing the icons came from.

The nineteenth audit fits in a line: **every one of eighteen identities was
written in an alphabet.** **山彦** — Yamabiko, a recording studio — is Japanese,
which does not put spaces between words. The line counter, whose entire reason
for existing is that text which does not fit gets swallowed on screen and
printed over whatever is beneath it, answered **one line** to any amount of it:
`para.split(/\s+/)` returned the whole paragraph as one unbreakable word.
Against 270 browser measurements it under-counted 235, worst case one line where
the browser took sixteen.

The Latin half was the surprise. The 0.55 average fitted in the fourteenth round
had **quietly stopped holding** — the corpus grew in that same round and nobody
re-ran the experiment — and re-measuring found 65 of 540 under-counted. It is not
an average now: the advance of every character the engine sets is measured off
the faces and baked in, because `W` is 1.09 em and `i` is 0.33 and no average
tells them apart. Across all 810 measurements: **300 under-counts to none**,
exactly-right 35% to 65%. The measurements are checked in, so the claim cannot
lapse again quietly.

The twentieth audited the blocks rather than the projects: of the eighteen kinds
the model knows, **five had never been generated by any fixture** — including the
mockup. They were not broken. The reason nothing generated them was that **a
project could not carry the pages a designer laid out**, so every package's
document was the cover the engine writes on its own. That is the fourth time the
same shape has appeared: the photographs, the typeface, the icon, the layouts.

**Lammas** is a small arts festival that ships a poster, a two page programme and
a ticket. Three more defects came out of looking at them. The mockup **published
the editor's own instructions** — "drop a photograph here", on a ticket somebody
is holding — because the renderer is shared between canvas and page on purpose
and had never been told which it was drawing. A block was **cut to a page it was
never told about**: `on || PAGE` trimmed the poster's full-bleed fill to slide
height, so two rules and the standfirst were set in the ground colour on the
ground, invisible rather than absent. And a page that **indexed the package
indexed 45 files of 57**, because the list it was built from stopped where it
happened to be standing.

The twenty-first found that **every one of twenty identities had a wordmark** — a
drawing of the name. Round thirteen fixed the logotype with no symbol; nothing
had ever been the other inversion. **Skerry** is an island ferry network whose
mark is a roundel and whose **name is not drawn**: it is set, in the network's own
face, at fifty eight per cent of the mark's height.

For that kind of identity the lockup is a rule, not two files — and it is the
most important thing the manual has to say. There was nowhere to say it. The
name is outlined from the shipped face now, so the files still need no font.
Three things came out of it: a symbol that was the whole identity was **described
as a fallback**, the mirror of the sentence round thirteen rewrote; the new rule
**stated a size something else silently overruled**, which is round fifteen's
defect returning the moment a second way to say one number existed; and the
audit **kept its own copy of the list it audits**, so it failed on a project that
was correct.

The twenty-second went looking for the sentence the engine has written into
every read me it has ever produced: *"brand.json holds all of the above in a
form software can read."* Twenty-one identities shipped that line, and a grep
found only writers. **Nothing had ever read one.** A promise with nothing on the
other end of it.

**Tarnbrook** is a building society in its second version, and the input to the
build is the brand.json its own first version wrote. That makes the engine the
first reader of its own contract — and what it reads is the half of a second
version that is in neither package: **the difference**. The floor has doubled, so
every application already made between 32 px and 64 px was inside the rule when
it was made and is outside it now. A colour has moved, so stock already printed
is off palette. A colourway has been withdrawn, and the files clients already
downloaded keep working and keep their names, and nothing about them says they
are no longer part of the identity. `fell on gorse` carried body text at 4.69:1
and carries headings at 4.14:1, and the words did not change and the layout did
not change — only the colour underneath moved. `CHANGES.txt` is that list, the
manual opens with it, and a package whose previous version is missing, mistyped,
for a different brand, or carrying the same version number as this one is
refused in words rather than compared.

Four defects came out of it, three of them older than the round. `thinnestStroke`
wanted `stroke` and `stroke-width` **on the same element**, so a mark that puts the
colour on the group and the widths on the paths reported no stroke at all —
three of the twenty-two are drawn that way, and Ravelston certified a floor at
which its finest line paints 1.94 px against its own 2.4 px rule. The lesson was
already written twenty lines away, in the icon checker, which carries paint down
the tree and says why. The icon grid took the mark's **thinnest** weight, which is
the same number as its only weight until a mark has two — Tarnbrook's icons came
out at half the weight of the mark they belong to — and took it from the master
even where the identity **ships a drawing for its icons**, so Ravelston's grid
specified a quarter of the weight of the only icon in its own package. And
`brand.json` said Tarnbrook held **34 files in a package of 43**: it counted what
had been written at the moment it was written, and the read me, the manual, the
deck, the canvas and the zip all come after. Every package ever built was wrong
the same way, in the one file whose job is to be read by software.

The twenty-third asked what a package contains that isn't the client's. The
answer, for twenty-two identities, was **nothing**: every mark, logotype, icon,
photograph and typeface belonged to the brand, and the whole method rests on it —
one master, everything derived from it.

**Kilnsey** makes grants in Wharfedale, and its mark is never seen alone. Every
project it funds carries it beside the recipient's own, and that half is not
Kilnsey's to change: not recoloured into the palette, not redrawn to fix its
faults, and not swapped for another of their versions when the one for a ground
is missing — where a partner has supplied no artwork, there is no pair, and only
they can make one. What is left is measuring, and a pair does not behave like
either of its halves. The Ravensworth pair holds at **549 px** where Kilnsey's
own lockup holds at 152, because a pair is a third drawing: wider than ours, and
containing whatever is finest in theirs. Their manual states their mark alone and
ours states ours; the pair's figure is in neither.

**Then the same question, asked of the package itself.** A minimum size belongs
to a drawing — a width, divided by the thinnest thing in it. Every package this
engine has built states one, measured off the master, and then hands over four
lockups and a read me saying `01-horizontal` is "the default". At the figure
Meridian's manual prints, its horizontal lockup lays down **0.48 px of ink
against a rule of 2.4**. Beaumont's lays down 0.14 against a rule of 3.
Twenty-three identities certifying a size at which their own default lockup is a
smear. Every drawing states its own floor now, and the twenty-second round's
comparator watches each of them from one version to the next.

Two more, both older than the round: `assets.partners` reached `path.join` as an
array and produced *"the path argument must be of type string"* — the third new
kind of asset met by a Node type error rather than a sentence — and the first
draft of the partner contrast check reported Ingleby's mark as disappearing into
a page it reads on perfectly well, because it tested the white of their sail,
which sits inside their own blue disc.

The twenty-fourth asked what every package here says about accessibility. The
answer is a WCAG contrast ratio, and a contrast ratio is a ratio of **luminance**
— the right measure for text on a ground, and silent about the thing colour is
mostly used for. Two colours can sit at a comfortable ratio against the page and
be the same colour *as each other* to one reader in sixteen, because what
separates them is hue, and hue is what a colour vision deficiency takes away.
Twenty-three rounds, no mention of it anywhere.

**Deben** warns an estuary when the water is coming: clear, prepare, act. Its
green and its red are 67 ΔE apart, 2.8 apart to a deuteranope, and both pass
every contrast check in the package. `tokens.sets` is the only place a project
can say *these are read together and have to be told apart* — and saying it is
what invites the check, because a palette has more pairs than meanings and
reporting all of them is noise. A set that collapses and has no second channel
is refused; the answer is `apartBy`, one per member, an open ring and a half
ring and a solid disc, checked so that no two of them share it.

**Everything else it found was already here.** Twelve of the twenty-four palettes
carry a pair that separates for most readers and not for all. Vesper's whole
identity is a gradient, and one length of it does not travel at all for a
tritanope — that stretch is a flat fill, and whatever the movement was doing is
not happening. Northline has two colours 101 ΔE apart that a protanope reads as
one.

And **the first version of the simulation was wrong.** The coefficients in
Viénot, Brettel and Mollon are defined on cone responses, and most versions in
circulation apply them straight to linear RGB — where they do not preserve the
achromatic axis. The first thing the module drew was Deben's near-white paper
rendered as cyan. A dichromat sees white as white; a simulation that moves it is
wrong everywhere. The maths was corrected, and then the fixture had to be
redesigned, because the wrong version had exaggerated the red-green collapse and
the two colours it was built around turned out to be perfectly distinguishable.

Two more, both structural. `tokens` was outside the unread-key audit entirely,
so a whole branch of a project file could be shipped with nothing reading it —
which is exactly what `tokens.sets` did on its first run. And a refusal raised
while *building* printed one line of an `Error` and lost its why and its how,
because nothing had ever thrown findings from inside `build`.

The twenty-fifth took the twenty-third round's answer and finished it. Every
drawing had been given its own floor, which was right — and a floor still meant
**stop**. Below it the engine had nothing to say, so its advice at 20 px was its
advice at 2 px. That is not how a serious identity behaves: below the size at
which the full mark holds you move to a simpler drawing of it, and below that to
a simpler one again, until what is left survives at sixteen pixels.

**Oriel** is a gallery in a building whose front is a bay window. Its mark is
that bay in elevation, built on the building's own module — sixteen units square,
every point a multiple of fifteen — and it ships as **five drawings, one for each
size band**: the horizontal lockup above 100 px, the mark to 58, then two
mullions instead of four, then the bay and its corbel alone, then a silhouette
with one aperture that holds at **13 px**. The bands meet with no gap. Which
drawings are in the ladder is a decision the project states; the order is not,
and a stated order that disagrees with what the drawings measure is refused.
Every icon and favicon is cut from the bottom rung, so all four sizes clear where
the full mark would have cleared none.

**And a construction grid is a claim.** The manual had drawn one since the
beginning — six divisions of the box, chosen because six looks like a grid, over
artwork built on something else entirely. Where a project states its module the
diagram draws that module, and every point in every drawing is checked against
it. Oriel's forty-six are all on it; move one two units and the build names it.

Four things came out of the work, all of them mine or older. `mark` in the build
meant the artwork icons come from *and* the shape the pattern is cut from, which
were the same file until a ladder could say otherwise. A check that could never
fire — a rung that holds smaller always has relatively heavier lines, so "unless
it is heavier" was every case, and it took testing rather than reading to see it.
A check that cried wolf on every well-made ladder, by comparing a wide lockup
with the square mark below it. And both captions on the construction diagram were
written twice — once to size the canvas, once to draw it — and agreed only for as
long as nobody edited one.

The twenty-sixth caught the engine writing advice it could not check. Since the
twenty-second round its packages have said *"anything already made between 32 px
and 64 px was inside the rule — small print, favicons, embroidery, anything cut
in vinyl"*, and it had never measured one thing about embroidery or vinyl.
Twenty-five identities specified in pixels and millimetres of ink, for brands
that mostly exist as objects.

**Ancroft** has been cutting the same arms into things since 1614 — a blazer
badge, a cap badge, a house tie, the stone over the gate, a minibus door, kit, a
bookplate, a bench plaque. A process is a floor like any other: a satin stitch
below 1.3 mm will not lie down, vinyl below 2 mm tears when it is weeded, cast
metal below 1.5 mm will not fill the mould. So which drawing goes to which maker
is arithmetic. **One process at three sizes takes three different drawings** —
the badge gets `standard`, the cap gets `compact`, the tie gets `monogram` — and
`13-fabrication` holds each at true size in millimetres, ready to send. The
cutter is told the artwork is drawn in strokes. The stonemason is told that a
round bit cannot cut an internal corner at all, and what its radius costs at
that size.

**And the measurement it all rests on was wrong.** `thinnestFeature` decides
every minimum size in every package, and for a filled shape it took the *fifth
percentile* of the runs it found — a defence against one or two anti-aliased
samples. But a percentile is a share of the sample, and the sample is however
much outline the shape happens to have. Ancroft's monogram has 36 units of metal
beside its chevron cut, on eleven scanlines out of two hundred and twenty, and
the percentile **stepped straight past it and reported 84**. Six identities were
corrected, all upward; two were checked by rendering. At the floor **Beaumont**
has published since the day it was added, its finest stem paints **2.80 px
against its own rule of 3**.

The twenty-seventh took the engine's own rule up a level. Twenty-six identities,
and every one of them is one thing; real institutions are not. One master and
everything derived from it becomes: **a sub-brand is the parent's mark and a
stated difference**, and the difference is a name and a colour.

**Harbourne** is three museums round one harbour. Nothing in any of their lockups
is drawn — the name is set from the face the identity ships, and the lockup is
composed from the mark's own measured ink — so a sub-brand cannot drift from its
parent and a fourth one costs a line in the project file. A colour that is not in
the parent's palette is refused, because the palette is what holds a family
together.

**And the words are the finest thing in the drawing.** A floor is the box divided
by whatever is thinnest in it, and in an endorsed lockup that is a letter, not the
mark: Maritime holds at **854 px** endorsed where the mark alone holds at 29. Every
check a group brand runs is run on the mark, and the number that governs the asset
is set by "Part of Harbourne". It is not a fault and there is nothing to fix in
the artwork — it is what the endorsement costs — so the package contains the
lockup without it too, each with its own floor, and says where to change over.
The same answer the twenty-fifth round gave for size, applied to words.

The twenty-eighth found the same shape as the twenty-second, in the last place
left. Every package states how the identity animates — two curves, four
durations, and a build sequence naming the parts and when each arrives — and the
manual printed it as the specification. **No artwork in twenty-seven identities
named a part called outline, or fill, or anything at all. And no package
contained a single file that moves.** A specification for an animation, in prose,
about parts that do not exist, with nothing to play.

The contract is the one the colour system already uses: `data-slot` says what a
part is painted from, **`data-part` says what it is when the mark builds**, and a
sequence may only name parts the artwork has. **Farne** broadcasts from a rock in
the North Sea and its ident is the mark arriving — the transmitter, then each arc
in turn, over 800 ms. `15-motion` holds it, one file per colourway, each a single
SVG with its own CSS inside it: nothing to install, nothing to fetch, and a
reader who has asked for less movement gets the finished mark and no animation.
A fill asked to draw itself is told so — a stroke draws by being dashed the
length of the line, and a fill has no length to dash.

**And the default build sequence is gone**, because it was the fiction. Two
curves and four durations are a real default; a sequence is about particular
parts of a particular drawing, and inventing one describes a mark nobody drew.

The twenty-ninth turned the engine on itself. It has printed a WCAG contrast
table since the first week, measuring the client's palette against the grounds
the client will set text on — on a page whose own captions were **3.18 to one**.
Twenty-eight identities: every caption, every column heading, every chapter
number and the footer of every manual, deck and published page, in both themes,
below the standard printed beside them. **The engine checked the identity's
accessibility and had never checked its own.**

It found five things. One token failing in both themes across thirty-eight
rules. **Seventeen of twenty drawings** on a manual page with no accessible name
and not hidden. No `<main>` to skip to. A published page with **no first level
heading at all**. And its own first answer wrong: the audit took the page's
ground to be `--surface`, because that is what a token called surface sounds
like — the page paints `--paper`, a shade darker, and the shade was the whole
answer, 4.47 against 4.61 for a figure that has to clear 4.5. A browser found it
in one measurement while the arithmetic had been agreeing with itself.

**Rookhope** runs twelve libraries on one ticket and states the standard its
documents are held to. Every package now carries `ACCESSIBILITY.txt` — what was
checked, what it measured, what it came to — written by measuring the pages
beside it rather than describing them.

The thirtieth found the engine declaring a language it does not write in.
**Maayan's manual carried `lang="he" dir="rtl"` around 988 English words and
twenty-one Hebrew ones** — so the whole English document was laid out right to
left, headings against the wrong edge and section numbers after their titles. The
twenty-ninth round made it worse rather than better: it checked that a language
was *declared* and never asked whether it was *true*, and a synthesiser told a
page is Hebrew and handed English reads gibberish with confidence.

The language of a document is the language it is **written in**. The brand's
language belongs to the brand's own words. Those are two different things and the
engine had one field for both. `src/strings.js` holds the words in one place, one
language at a time, and what a language can write is asked **per document**:
**Verdon** is a French regional park and its deck is a French document. A
document the engine cannot write in the brand's language gets written in English
and says so, with the brand's own name and words marked as the brand's — which is
the honest answer and the one a screen reader can act on.

The check that would have caught it is now in the audit, and the seventh round's
test is rewritten rather than deleted: it was half right and the wrong half.

The thirty-first found the one page in every manual whose whole job is to be
unambiguous saying the opposite of what it showed. A misuse page is a set of
pairs — a picture of the mark treated badly, and a sentence naming the treatment
— and nothing joined a sentence to the picture above it except the index of an
array. Six fixed treatments in a fixed order, captioned with whatever sentences
the project happened to list.

Across the thirty packages built before this round: **132 misuse cells, of which
33 showed a picture that contradicts its own caption.** Ravelston printed *"Do
not add a drop shadow to make it look engraved"* over a mark with no shadow, and
*"Do not place it on a photograph without the reversed lockup"* over an outlined
one. Rookhope's *"Do not rotate it"* sat over a drop shadow. Eighteen more cells
carried a caption about something the engine cannot draw at all, so the picture
beside it was arbitrary — **fourteen projects had a rule about crowding and every
one of them got a mark on a striped green ground**, because crowding was the one
thing on that page the engine had never been able to draw. Eight of the thirty
stated no rules and got a numbered heading, a badge and an empty box.

So a misuse rule is not a sentence any more. It names one of ten treatments the
engine performs on the identity's own artwork; the engine writes the sentence
from the treatment it drew; the designer's reason follows in their own words,
which is the half a machine cannot supply. Four of the ten are new and are the
ones a real manual keeps asking for: the clear space rule with type set inside
it, the mark below the floor measured for it, the mark with one of its named
parts taken out, and the name set in whatever face the machine already had.

Two things fall out of it. **A project can only forbid what the engine can
draw** — so a rule about redrawing part of a mark requires the artwork to name
that part. And a rule can be checked against the rest of the identity:
**Carrock** is a sound archive whose mark is a disc, whose ident turns it, and
whose manual therefore must not say never rotate it. The engine refuses the pair.
Built with the code as it stood a round ago, all six of Carrock's cells showed
the wrong picture — and the second of them showed the mark rotated, which is the
one thing this identity does on purpose.

The deck's version of the page had the same fault; both documents read one list
now, so they cannot disagree about what a rule forbids. And the deck turned out
to be carrying **the thirtieth round's own fault**: every slide in it is an
English literal, so Verdon shipped a French manual and an English deck, both
under `lang="fr"`. A language now says which documents it can write, and each
document says which it is in.

Then the product met its owner, who pointed out that it does not generate
patterns — and it did not. `src/pattern.js` would only build one from a shape
carrying `data-pattern="source"`, an attribute no file out of Illustrator or
Figma has. **Nine of thirty-one identities had a pattern and all nine had the
attribute typed in by hand; the other twenty-two shipped a warning.** Refusing to
guess is right when a guess is a claim nobody can check, and wrong when the
engine can measure the answer and show its working.

It reads every shape in the drawing now and ranks them on four measurements —
how square, how simple, what share of the drawing, and how much of its own box it
actually inks, which is measured by rendering it. Then nine constructions, all
seamless by construction: grid, half-drop, brick, rotary, mirror, scale, scatter,
a line system at the weight the mark is drawn in, and arcs. `tile: 100` and
`weight: 3` are gone; the line weight is the same fraction of the motif that the
mark's stroke is of the mark, and the air around it is the clear space rule the
identity already states.

Two things were found by looking rather than by testing. `arcs` built, tiled
cleanly by the same wrapping as everything else, and **did not join** — four
hooks meeting nothing, which took a contact sheet to see. And Kvist's master, a
real Illustrator export, carries the invisible bounding rect Illustrator leaves
behind: it made the motif measure the whole artboard instead of the mark, and
made the renderer **panic from Rust and abort the build**.

Thirty-one of thirty-one identities ship a pattern now: 300 tiles, all
reproducible byte for byte.

Then the layouts, which had never been a choice. Every manual and deck looked the
same — one stylesheet, one set of proportions, one idea of how a page is arranged
— which is defensible for a tool that measures things and indefensible for one
that presents them. There are four now, and they are systems rather than themes:
they change the scale the type is built on, the measure, how much air a specimen
stands in, and how the page is organised. **Quiet** puts the section heading in a
column of its own with the work beside it. **Technical** runs everything numbered
down a rail on the left. **Warm** is centred and narrow with no rules anywhere.
**Bold** opens a chapter as a band across the page.

The first attempt was four *variations* — margins and rule weights — and it took
rendering them side by side to see that a client would not have felt they were
choosing between anything. And the accessibility audit caught the reversed band,
reporting it as failing at 1 to 1: it read every rule's colour against the page
and could not see an element that paints its own ground. The same shape of
mistake as the twenty-ninth round's, and the band measures 18.6 to 1 now.

Alongside it, the intake. A brand package has about forty decisions in it and the
engine measures most of them already, so it asks **six questions** — and three of
those are the engine showing its own answer and asking whether it is right. The
one that earns its place is *where does it live*: say screens, print and things
people wear, and the formats, sizes, stock and making all follow without anybody
typing them. Six answers and a drawing make a seventy-three file package, and the
only thing it complains about is CMYK, which has to come from a printer.

Then the type, which was the last thing in the product reaching outside it. A
family marked `google: true` became a link to fonts.googleapis.com, and three
things were wrong with that: a manual opened without a network was set in
Georgia, the package was not self contained — which is the one promise the whole
engine is built on — and the build was not reproducible, because the bytes came
from somebody else's server. Eleven families are vendored now, inlined into every
document and written into the package with their licences. Which character
subsets go in is measured from the document's own words: an English manual
carries four faces, a French one eight.

And the front door. Four screens — drop the artwork, answer what the file cannot
be asked, choose a layout by looking at four of them drawn with your own logo,
take the package. Driven end to end in a browser: two SVGs in, seventy-three
files out, **no request leaving the application**.

And then the last of it: the edits somebody makes by hand. Everything this
engine writes is derived, which is the point of it and also the problem — no
engine writes a sentence about a mark as well as the person who drew it. So an
edit is not a change to a document, it is a **replacement for one derived
value**, stored against a key that names the value rather than its place on the
page: `content/markRationale`, `misuse/redraw/why`, `pattern/construction`.
Sections can move under it and the edit still lands.

The contract is measured rather than claimed. Build the same project twice with
the master swapped for a different mark in between: the floor moves 61 px to 60,
the clear space 30.4 to 21, the pattern picks a different shape — and both
hand-written paragraphs are still there. An override also records what it
replaced, so when the ground moves under an edit the build says so instead of
quietly keeping a sentence about an identity that has changed.

`overrides.json` travels in the package. There is no account and no database:
the thing that comes back is the thing that went out. And the front door gained
a screen where the manual is edited in place — click a paragraph and type.

The thirty-second found the same fault a third time, in the place the two rounds
before it had each just left. The thirty-first had caught the deck claiming a
language it was not written in and answered it with a hand-typed list —
`writes: ['manual']` — saying which documents a language could write. A list is a
claim, and nothing was checking it. The way to check it is not to look at the
dictionary but at the page: render the same project twice, once in the language
it asks for and once in English, and count the prose the two share.

Verdon, measured: **the deck was 93 per cent word for word the English build, and
the manual 90 per cent** — both under `lang="fr"`. The chrome came from the
dictionary and the body did not, and every check the engine had looked at the
chrome and passed.

The deck's words are all in the dictionary now, and so are the sentences that had
been written one level below any dictionary at all: the reasoning behind the
minimum size in `geometry.js` — *box 240 ÷ stroke 16 = 15 stroke widths across*,
set in the middle of a French paragraph — the contrast verdicts, and the name the
engine gives the shape it built the pattern from. A measurement is a number; how
it is said belongs to a language. Each keeps its English beside the facts, because
`brand.json` and the command line are read as English whatever the brand is.

One more thing had been speaking the wrong language outright. The misuse cells
are drawn from one list so the two documents cannot disagree about what a rule
forbids — and the list read the *manual's* language, so five French captions sat
inside a deck declared English.

Verdon's deck now shares 13 per cent with the English build: `px`, `mm`, the
folder names, and the words French and English spell the same way. Its manual is
an English document and says so, because its body is still literals. And the
claim has teeth — declare a document you cannot write and the test fails with the
number in it: *fr says it writes the manual and 84 per cent of it is the English
build.*

The thirty-third took the number that round left behind. The manual's body was
**1,453 words of prose no dictionary had ever seen**, so a French project got a
French deck and an English manual, and the build said which file to open. This
is that file.

Most of it was where you would expect: one template literal per block in
`documents/blocks.js`, each sentence becoming a key with the numbers left as
placeholders. Three things were not. A sentence can be written *below* every
dictionary — what a making process can hold was a string inside `fabrication.js`,
why the engine picked the shape it built the pattern from was one inside
`pattern.js`, and the whole of chapter 00, fifteen kinds of change with three
sentences each, was inside `previous.js`. A key that belongs to the engine does
not belong in the client's machine-readable file — one of them put
`"labelKey": "ptOurHalf"` into `brand.json` twelve times before it was caught.
And two sections were built with the wrong helper, so their badge read *Drawn by
the system* in the middle of a French page while every other badge on it read
*Tracé par le système*. Nothing found that but reading the finished page.

    Verdon's manual   before   2,255 prose words, 2,034 of them English   90%
                      after    1,361 prose words,   136 of them English   10%

The check runs over thirteen identities chosen so every block is exercised at
least once — the ladder is only in oriel, the pairs only in kilnsey, the making
only in ancroft, the changes chapter only in tarnbrook — and the worst is 18 per
cent: `px`, `mm`, folder names, and the words French and English spell the same.
Delete one block's French and it fails with the number in it.

Both documents are written in the language the brand asked for now, or the engine
says plainly that it cannot. The English manual of all thirty other identities
comes out with the same words in the same order.

The thirty-fourth looked at the canvas, which no round had. Every
`ACCESSIBILITY.txt` this engine wrote said the canvas was an application rather
than a document and was not in the file — true, and also the reason nobody had
looked. Driven with a keyboard: **four blocks on a page and none of them
reachable.** Selecting, moving, resizing, duplicating and deleting — the whole
of the application — worked with a pointer and with nothing else.

Focus is the selection now. Every block is a tab stop that says what it is, how
big it is, where it sits and whether it is selected. `cmd` with the arrows
resizes, which had been eight corner handles and no keys at all; `enter` adds a
second block to the selection; `F2` opens a text block; `escape` lets go. And
the things a page owes anybody: a `<main>`, one heading, panels that say what
they are, and a region that announces — every warning the application gave had
been silent to a reader not watching that corner of the screen.

Three things were found only by measuring. A focus ring nobody decided on is the
browser's, not the product's — and writing one down immediately found the block
whose ring was clipped away by the sheet it filled. Four number fields were
labelled by a caption underneath rather than by a label, so they read as "edit,
blank". And a stylesheet cannot say what ground a rule lands on: measured
against the worst ground in the file it called 87 pairs failures; measured in a
browser against the nearest ancestor that actually paints one, 82 pieces of text
and a single real failure, the tag naming a selected block at 3.68 to 1.

The checker had a fault of its own: it read the file rather than what a browser
lays out, so a page that inlines its own scripts was measured on its source
code — an `<h1>` and forty-nine `<svg>` that are inside `render.js`.

And reading the canvas found the last round's own fault in it. `lang` is an
accessibility attribute, and the canvas took it from the manual's dictionary —
so once français wrote both documents, **Verdon's canvas declared `lang="fr"`
over Undo, Pages and Add a block.** The check that catches Hebrew cannot catch
this: French and English are the same alphabet.

The thirty-fifth took the engine to five hundred drawings it had never seen.

Five hundred and eight exports the engine had never seen, each built as a
complete package rather than passed through the front door. Not the identity job
that item asks for — there is no identity artwork on this machine — but 16,311
SVG files that are somebody else's output, 267 of the 508 signed by Inkscape and
16 by Illustrator. A status icon is not a logo, and about layers, transforms and
coordinate spaces it is exactly as real as one.

    332 built     41 refused     135 aborted the process outright

The 41 are the engine working: live text and embedded images, refused at the door
in words a designer can act on. The 135 are not an answer at all. `resvg` does
not throw on the input that beats it — it panics from Rust and takes the process
with it, which no `try`/`catch` sees, and which defeats the engine's own habit of
reading back every file it writes, because the read back aborts too. One build in
four ended with no findings, no report and no zip.

Five defects. **The pattern filled each tile with copies that drew nothing** — it
decided how many neighbours to emit from the cell size rather than from how much
of the cell the drawing covers, so a 16 unit shape in a 45 unit cell got ten
copies of which three could be seen, and that ended 122 of the builds. Culling
them took three tries: only rendering the motif and reading its real ink was
right, because a motif's box is what the ranking measured and the markup around
it draws further — lammas's measures 52 by 38 and paints 56 by 94.

Three more are one mistake told three ways, and each time the missing coordinate
space belonged to a layer — the thing every drawing program puts artwork on, and
that no fixture here had. **The normaliser moved the artwork**, writing placed
coordinates back under a transform that was still there, so it applied twice and
a shape at (7, 4) came out at (-218, -993). **A shape lifted out to be ranked as
a motif left its place behind**, landing at y = 1004 in a 24 unit box. And **the
normaliser deleted artwork that was on the artboard**, because it read a shape's
own transform and no ancestor's — then reported that it had tidied something up,
which is the worst of them, the others being at least loud. It is also why nine
files that had been refused as having nothing left to measure now build.

The fifth was found by the re-run catching a regression of its own: two files
that had built before the fixes now aborted, because artwork the normaliser had
been deleting was back, and one shape in it carried `opacity=".5"`. Measured one
shape at a time, the rule is that **anything making resvg build an isolation
layer — `clip-path`, `mask`, `filter`, `opacity` — aborts if what it applies to
falls entirely outside the clip**; a plain group out there is fine, and one
straddling the edge is fine. `onlyShapes` already stripped three of the four,
each added the last time one took a build down. `painted()` now strips the
fourth, which it should have been doing anyway: it exists to discard the
artwork's own paint and repaint the motif in one ink, and opacity is paint.

The same 508 against the settled tree: **476 built, 32 refused, none aborted** —
was 332, 41 and 135. Nothing regressed, every one of the 135 builds, and the nine
that left the refusals are the ones the normaliser had been emptying.

What it cost the identities that already worked, measured tile by tile: 16
pixel-identical, and 15 differing by at most 94 pixels of 720,000, none of them
adjacent to another, worst channel 29 of 255 — the rasteriser compositing a
different number of layers, not a copy that showed being cut.

The thirty-sixth added a third language, and the first one that is not written
the way the engine is. `en` and `fr` share an alphabet, a direction and a
sentence shape; the two things a language is actually made of were the same in
both. מעיין has been here since the ninth round declaring `he` and getting an
English manual with a warning saying that adding Hebrew was "a block of strings
and nothing else". That was wrong, and this is what was in the way.

**An ordinal agrees with its noun.** The table had one form of each, so French
has been printing **"le deuxième ellipse du dessin"** since the thirtieth round —
`ellipse` is feminine, five of the six shape nouns are not, and the sixth had
never come up. Hebrew makes it unavoidable. A dictionary says which of its nouns
are feminine now and a key may carry a second form; the Hebrew needed it and the
French had needed it all along.

**A type specimen is a specimen of a script.** English sets ABC abc, French adds
an É, and both are the same answer to the same question. Hebrew has no capitals,
so it is neither and cannot be made from either.

**The manual prints `brand.json` whole**, and `brand.json` is English whatever
the brand is — so a Hebrew manual was 3,719 Latin characters under `lang="he"`,
55 per cent of the page, and the engine refused to build it. It was right to. The
machine file says what it is now, and so does every `<code>`: `05-icons/` under
`dir="rtl"` is drawn `/05-icons`.

**The published page carried the canvas's words under the manual's claim** — 97
per cent latin under `lang="he"`, which is the thirty-fourth round's fault one
level down.

**And every measurement on the page was a different measurement.** A value inside
right-to-left prose is reordered by the browser, and measured character by
character in a real one, the first Hebrew manual drew twenty-nine of them wrong:

    #C8873A → C8873A#      18 59 58 → 58 59 18      1385 C → C 1385
    122 × 50 px → px 50 × 122       140 ÷ 7 = 20 → 20 = 7 ÷ 140

A different colour, a different ink to send to a press, a different shape, a sum
that is not true. The file was right in all twenty-nine and every check passed. A
value says it is its own run now — two Unicode isolate characters, put in at the
one place values are substituted, so that none of the hundred callers that set a
measurement has to know. `test/rtl-check.mjs` reports 29 against the page as it
first built and 0 against the one that ships.

The arrows went the same way: `← Prev` and `Next →` were characters in the
markup, and in a right-to-left deck back points right and the right arrow key
moves towards the beginning.

עברית writes the manual and the deck. It does not write the canvas — that is
still literals in `editor/` — and the build says so, which is the same answer
français gets and the whole point of the mechanism. 山彦 is still in `ja` and has
taken over the job מעיין used to do: the identity that proves a language the
engine cannot write is said so rather than quietly swapped.

The thirty-seventh moved the last of the words. Three rounds had carried the
same sentence — that the canvas was an application whose chrome was literals —
and it is what made `writes` naming the canvas worth so little: English literals
are English whatever a dictionary claims, and the script check cannot see
through it, because français and English are the same alphabet.

The canvas is not a document. Half of it runs in a browser, where
`src/strings.js` does not exist, so the resolved words travel in the bundle and
`HandoverRender.t` is the same lookup on the other side. Two implementations of
one thing, held to each other key by key in all three languages by a test. The
second one is four lines long, because the engine hands over each string already
looked up **and already isolated**: a `{slot}` is a run of Latin characters like
any other, so the isolate a right-to-left document puts round a value lands on
the slot, and the value drops into a run that is already marked. One
implementation of the bidi rule, not two.

**It cost the English canvas nothing, measured.** Every word it puts on the
screen — 285 strings, collected from the screen after adding a block of each of
the eighteen kinds — is the same before and after. Three nearly were not: the
canvas's type specimen is shorter than the manual's because the block is a
preview, and the three options in "Put on it" are lower case because they sit
beside colour names, which are the project's own words.

**Key names are not translated.** `tab`, `esc`, `cmd Z` are what is printed on
the key. It is why the French canvas's page still measures 47 per cent word for
word the English one while its vocabulary measures 20 — and why the check for
this is not the one the documents get. The canvas has seventy words in its
markup and builds the rest in the browser, so the bundle is what has to be in
the language. There: français 20 per cent, עברית 9, and 山彦 — still a language
the engine has no dictionary for — 100, which is what gives the number teeth.

**An application that reads the other way is not itself mirrored.** A block's x
and y are the design and stay where they are put; the furniture around them is
reading order and turns over. And the moment a Hebrew project could write the
canvas, `published.html` arrived with twenty measurements in the wrong order —
the same catalogue the thirty-sixth round found in the manual, in the one file
that round had not reached because it was still English. `test/rtl-check.mjs`
found all twenty without being changed.

**And one check had been written in a language too.** `canvas-check.mjs` asked
whether a block says what it is with `/^[A-Z].*\d.*selected$/`, which is a
sentence in English; Hebrew has no capitals and its word for selected is not
"selected". It reads the page's own words now. All three canvases pass.

The thirty-eighth wrote 日本語, and the first language here written without
spaces between its words found two things the other three could not.

**A word is not a unit every language has.** `splitWords` split on spaces, so a
whole Japanese page came back as one token and `residue` scored a Japanese manual
`{words: 1, shared: 0}` — which reads as a perfect score and is a sample of one.
That is the measurement that turns `writes` from a claim into something with
teeth, and here it was blind; a Japanese page that was secretly English would
have scored 1 out of 1 the other way and passed just as quietly. The unit is the
character where a script has no spaces and the space-delimited run everywhere
else. Measured that way the Japanese manual is 656 tokens and 11 per cent the
English one, which is about what français and עברית score.

**And a font can arrive and still have nothing to draw with.** 山彦 ships
IPAGothic subsetted to the 210 characters its own content sets, which is why the
package opens with no network at all — and a subset is subset to what somebody
knew about when it was cut. One character was already outside it before this
round: 行, in 立ち会いは一枚ずつ行います。, which is the type scale's own sample,
on the page whose whole job is to prove what the face looks like. Nothing said
so, because a missing glyph is not an error: the browser falls through to the
next family, draws the character in whatever the reader happens to have, and the
page goes on claiming to be set in the face.

The engine asks now in two places, because there are two questions: at build
time, of the words it knows go in the identity's face, which is what found 行;
and in a browser, of the finished pages, because which character lands in which
face is a fact about the page — which is what found `÷` in the deck, set in the
identity's face by the engine's own dictionary. Then the dictionary arrived and
the deck alone needed 111 characters the font did not have. The subset was
re-cut against the finished documents: 726 glyphs, 210 KB.

The check had a fault of its own, found by running it on the other three
identities: it reported `ships no font files` about a package shipping twelve.
They are woff2, which opentype.js cannot decompress. It says so now.

**Two more, visible on the first page the engine drew.** A `ch` is the width of
a zero, so `max-width: 16ch` is sixteen Latin characters and seven Japanese
ones — and seven is one word, so the title broke as ブラン / ドマニュアル. The
display measures are counted in whatever counts the script's own characters now.
And Japanese has no spaces, so a browser may break anywhere; `word-break:
auto-phrase` breaks at phrases instead. A language declares what its script asks
of a line, and the three that ask nothing carry nothing.

Each of the last three rounds took the identity that proved "a language the
engine cannot write is said so" and wrote its language, moving the job to the
next one — מעיין, then 山彦, then nothing. The case has a fixture of its own now
rather than a borrowed one.

The thirty-ninth pointed one at it. Every round since the twenty-ninth ended
with the same sentence — what these pages say is measured, how they sound is
not — and ten rounds of accessibility work sat on an argument nobody had tested.

A screen reader reads the accessibility tree, which is neither the markup nor
the rendered page but a third thing the browser computes from both; then it
speaks what it finds, in a voice chosen by the language each run declares. Both
halves are measurable. `test/reader-check.mjs` reads the tree through Chrome
DevTools Protocol and asks of it the things that make a page unusable by ear;
with `SPEAK=1` it hands each run to espeak-ng in the voice its language asks for.

**The argument the engine has been making since the twenty-ninth round is wrong,
and understates the problem.** It says a synthesiser told the page is Hebrew and
handed English "reads it with that language's sounds". It does not read it with
the wrong sounds — it spells it out:

    מדריך מותג   as he   mdQ"'iX mvtg
                 as en   hebrew mem · hebrew dalet · hebrew resh · hebrew yod …

**A language inside a language.** The thirty-sixth round marked the machine
readable file `lang="en"` — correctly, because `brand.json` is English whatever
the brand is. But the file holds the brand's own name, and the misuse rules the
project wrote, and its colour rationale: eight runs of Hebrew in מעיין's, five of
Japanese in 山彦's. So a reader said מעיין as five Hebrew letter names in an
English voice. No check could see it: the page-level one drops every element
that declares a language, and that is exactly where this hides. It is marked
now, and caught at build time as well — and the first version of that build check
scanned with a global regex, so the `<html lang>` match ate the document and the
`<pre lang>` inside it was never looked at. The test caught that.

**Chromium does not name a `<figure>` from its `<figcaption>`.** Measured across
five ways of captioning one, only `aria-labelledby` does. The caption is still
announced; it just is not the name — so the check asks whether anything inside a
figure is said at all, which is what a reader needs.

**And `text-transform` reaches the tree**: 167 words of the manual are announced
in capitals because a stylesheet says so. The received wisdom is that a
synthesiser then spells them out. Measured, it does not — the phonemes are
identical — unless the reader has capital indication on, and then one marker per
phrase becomes one per word. The only fix that keeps the written text in the
tree changes full capitals to small ones. So it is reported and not changed:
measuring something and then declining to act on it is a different thing from
not measuring it.

Names, heading outlines, stated languages, walls and drawings pass on every
document in four languages. What this is not: espeak-ng is a synthesiser, not a
screen reader, and its Japanese voice announces kanji as "chinese letter"
whichever language it is told — so for Japanese it understates a real reader
rather than overstating it.

The fortieth did that run. Every round since the twenty-fourth has ended by
saying it was still owed, and the reason it kept being owed is that the engine
had never been pointed at an identity nobody made for it. Pagrin's own mark came
out of Figma's SVG exporter, untouched, and was built as a package.

It built. 118 files, and six warnings that were all true — no CMYK anywhere, a
wordmark drawn in `#000000` against an interface ink of `#0E0E0E`, app icons at
180 and 192 px that paint at 0.73 px and will read as a smudge, a floor of
335 px because the rays taper to a hairline where they converge. Then one
warning that was about the engine rather than the artwork:

    no pattern was written. nothing in this drawing can carry a repeat:
    every shape in it measured as empty.

**It is not empty. It inks 93 per cent of its own box.** Pagrin's mark is one
path filled `url(#a)`. `pattern.candidates` lifts each shape out of the drawing
to rank it as a motif, and `onlyShapes` drops everything that draws nothing —
metadata, clip paths, and paint servers, which are on that list because a
gradient does indeed draw nothing by itself. True, and the wrong reason: it is
the only reason the shape it fills has any colour. Lifted out without the
`<defs>` that names `a`, the fill pointed at nothing, resvg painted nothing, and
every candidate was dropped as blank. It is the same mistake as the last round's
transform, one attribute over: read in one document, drawn in another that no
longer holds what it refers to. A shape now comes out with its paint.

That was the visible half. The measured half was worse: the whole-mark candidate
for **vesper**, which has shipped for thirty rounds, was measuring its own ink at
0.300 with the gradient piece painting nothing. It actually inks 0.418. One of
the thirty-one identities that existed when this was measured changes as a
result, and it is the one that should.

**And then the thing the first fix uncovered.** With a pattern to build, the six
colourways of the mark were still one file, byte for byte — the white one meant
for a dark ground and the black one meant for a one-colour job included. The
engine's own report has always promised otherwise: *"any colourway that names a
colour for this slot replaces the gradient with it."* Everything downstream was
right — `applyColourway` writes over a `url()` fill, `dropUnusedPaint` clears
what it orphans, `keep` leaves it alone. Only the tagging was missing:
`colourPass` skips a `url()` fill deliberately, because a paint server is not a
hex and must not be snapped to the palette, so the shape arrived carrying no
slot and nothing could repaint it. Every shipped identity with a gradient has a
hand-written `data-slot`, which is why no fixture ever caught it. An export
nobody prepared has none, and that is every export a client sends.

Fixed, Pagrin's package goes from 14688 KB to 6334 KB — the gradient had been
copied into every file — the PDFs carrying a gradient drop from 18 to 3, and a
check that could never see the shape starts firing: the middle of the gradient
is `#FFBADC`, which measures **1.58:1** against white.

Pagrin is the thirty-second identity in `engine/projects/` now, kept as the
export it arrived as. It is the only one whose mark has no flat colour in it at
all, and the only one that came out of an exporter rather than out of somebody
deciding what the engine should be made to face. It ships four warnings, and all
four are true: no CMYK, two icon sizes that will read as a smudge, three PDFs
that carry a gradient, and a middle stop of `#FFBADC` that measures 1.58:1
against the white it is cut for. That last one is a finding this repository
could not have made a day ago.

The forty-second built its ladder. Pagrin's package shipped a warning that two
of its app icons would read as a smudge — `icon-180.png at 0.73 px`,
`icon-192.png at 0.78 px` — and the engine's advice with it: draw a simpler mark,
put the drawings in `assets.tiers`, name the order in `rules.ladder`, and icons
are cut from the last rung. That machinery has existed since the twenty-third
round and two identities used it, both drawn by somebody who already knew the
answer. This is the first time it has been pointed at a mark that arrived with
the problem.

**The floor is not about how many rays there are.** Measured off the render at
three radii, the fan is seven wedges at 11.2, 24.3, 35.4, 44.4, 52.0, 60.4 and
77.5 degrees from a point the path returns to eleven times, at (7.6, 177.2). Near
that point the ink between two wedges is the radius times the angle between them,
so it goes to nothing whatever the count is: the master measures 1.1 units at its
thinnest and cannot go below 335 px. Dropping rays does not fix that. Stopping
them short of the corner does, and it is the only move that does.

So the ladder is the same drawing three times with less of it, and nothing in any
rung sits at a bearing the master does not use:

    horizontal   864 px and up
    mark         335 – 863      seven wedges, meeting at a point
    standard     197 – 334      the same seven, stopped 20 units short
    compact       46 – 196      four of the seven
    monogram      12 – 45       two, opened to six degrees

The bands meet, so there is no size from 12 px up that nothing serves. The icon
warning is gone, the package goes from 143 files to 197, and `favicon-16.png`
stops being a grey square and becomes a mark.

The forty-third went after Pagrin's last warning and found somebody else's.

`src/cmyk.js` opens by saying that CMYK is a decision and not a conversion: a
hex describes light leaving a screen, ink sits on a particular paper under a
particular press, and no formula knows which paper. So the engine carries the
four numbers a designer or printer gives it, refuses to print a guess, and says
so where they are missing. That is right, and Pagrin's four numbers still have
to come from Pagrin's printer — inventing them is the exact thing this file
exists to prevent.

But it means every brand colour is written down **twice**, as a hex and as a
build, and nothing had ever asked whether the two were the same colour.

They are not meant to be identical. Ink has a smaller gamut, so a vivid colour
comes back duller — that difference is the whole reason a build is a decision.
The loss is in **chroma**. Lightness is the axis ink keeps: every press runs from
paper white to solid black. So a build far from its hex in chroma is a colour the
press cannot reach, and a build far from it in lightness is a different colour.

Measured over the 148 declared builds in the repository — of the 108 the plain
model reproduces without losing chroma, lightness differs by a median of 2.3 and
a 99th percentile of 14.6, and then one sits at **50.8**:

    halyard/fog   #6E7B82   declared 0/0/0/100

A mid grey, declared as solid black. It is the `neutral` role, it has shipped
since the ninth round, and printed it would have come out black beside halyard's
actual black. Nothing caught it because nothing compared the two descriptions.
The rich-black check had actually *seen* it — it warned "fog is 0/0/0/100, which
is a plain black" and advised backing it up to 60/40/40/100, which would have
taken a mid grey from solid black to **rich** black. It read a symptom and
prescribed for the wrong illness.

Every threshold between 15 and 30 catches that one and nothing else, so the
number is a gap in the data rather than one fitted to the case that found it.
fog is `52/46/43/10` now, which is where the repository's other cool greys sit.

What this gives Pagrin is not four numbers. It is that when the four numbers
arrive from the printer, the engine will check them against the colour they are
supposed to be, which it could not do yesterday.

The forty-fourth did the third description. A colour can be written down three
times — a hex, a build, and a spot ink — and the round before this one found that
nothing compared the first two. Nothing read the third at all.

It cannot be read very far. What colour any Pantone reference is belongs to
Pantone, and `licence.js` already says this package grants no rights to it. But
a reference has a shape, and the shape is answerable:

    northline    north      #0E7C4A     pantone: "line"

Seven of northline's twelve colours named `"line"` as their spot ink, and the
manual printed it to the client without comment:

    north      88/17/86/3      194%  given   line

The spot line is the one thing in a manual a print buyer acts on without
translating it first — it gets read down a telephone to an ink supplier — so
nothing downstream catches it. It is simply mixed wrong.

**And the book matters as much as the number.** Solid coated and solid uncoated
carry the same numbers and are not the same ink: each is mixed so that it matches
its own chip on its own paper. Seven identities in this repository declared
`stock: uncoated` and named coated inks — thirty-two references across beaumont,
carrock, halyard, marlow, saltmarsh, thornbury and yarrow. `Black 6 C` laid on
uncoated paper is not the colour of the chip anybody signed off.

Three checks, none of which needs to know what colour anything is: the reference
is a reference, a Pantone number says which book it came from, and that book is
the one the declared stock asks for. northline's seven are gone rather than
guessed at — the right numbers are not something that can be worked out — and
those colours print from their builds now. The thirty-two say `U`.

Fifteen identities give their paper colour a six-figure code like `11-0601`,
which is the Fashion, Home + Interiors form rather than a printing ink. That was
measured and left alone, because a bare one is underspecified rather than wrong
and the fix looked like a choice between two systems.

The forty-fifth found it was not that choice. **Fourteen of the fifteen colours
are printed** — each is the ink of a reversed colourway, so the mark really is
put on paper in it. That book numbers cloth, paint and plastic; there is no ink
formula behind any of it, so the one line a print buyer works from names
something their supplier does not stock. It reads like a Pantone reference and
is not one.

The fifteenth is hallward's paper, which is only ever the ground. For that,
recording which chip the stock matches is a fair thing to write down.

So the check does not ask whether a code is FHI. It asks whether the colour is
an **ink** — read off `rules.colourways`, where a slot value is ink and the
ground a colourway is cut for is paper. Fourteen fire, hallward does not, and
hallward is the one that keeps its chip. The fourteen are removed rather than
replaced, for the same reason northline's were: the right printing reference is
not something that can be worked out from a hex.

The forty-sixth filled the gap the round before it named. Removing the FHI chips
was right — a press cannot mix from that book — but it threw away a true fact,
that the stock had been matched to a chip, because there was nowhere to put it.

**A near-white brand colour has two lives.** It is the paper the job is printed
on, and it is the ink the mark reverses out in. One `pantone` field could only
ever hold one of them, so an ink reference and a material reference collided in
it and the wrong one had to go. Colours have a `material` field now. The fifteen
chips are back, in the field that fits them, and `pantone` holds only inks.

The two checks are mirrors: a cloth chip in `pantone` is wrong where the colour
is printed, and a printing ink in `material` is wrong because nobody can order a
paper by a Pantone number. Neither fires on anything in the repository, which is
what having the right two fields looks like.

**And adding one word to the dictionary broke a font.** `MATERIAL` is `素材` in
Japanese, and 材 was not among the 726 characters yamabiko's subsetted IPAGothic
was cut for. Nothing about the page would have looked wrong on a machine that
happens to have the full face installed — which is exactly what that check is
for. The font is re-cut: same design, 727 characters, every shared one keeping
its advance width and bounding box **to the unit**, and 209 KB down to 133 KB
because the new cut drops hinting the documents never used.

The method is in the repository this time, as `engine/tools/subset-font.py`.
It had been worked out from scratch twice and lost twice, which is the same
failure as a colour value nobody can regenerate.

The forty-seventh went after a warning that had been telling the truth and not
much else. A mark drawn in two weights hands the icon grid one of them, and the
build said so:

    the master is drawn in 2 weights (5, 9), and an icon grid has one.

Two numbers, a statement that a decision was made on the designer's behalf, and
nothing to check it with. It fired in the same voice for a mark drawn 89 per
cent in its heavy weight and one split 51 to 49.

**The first measurement said the rule was broken, and it was the measurement
that was wrong.** Summing the drawn length at each weight, tarnbrook is 66 per
cent at 4.5 and 34 per cent at 9 — so the engine, which takes the heaviest,
looked like it was picking the minority weight. But weight is not carried by
length, it is carried by ink: a 4.5 stroke drawn twice as far lays down the same
ink as a 9. Measured that way tarnbrook is 51 to 49 the other way, and the
heaviest weight turns out to be the largest share on **every** identity here.
The rule was right. It had just never been checked.

So nothing about which weight the icons inherit changes. What changes is that
the engine now measures the share and says it, and only raises its voice where
the choice is real:

    tarnbrook   9 draws 51% and 4.5 draws 49%      warning
    yamabiko    9 draws 70% and 5 draws 30%        note
    ancroft     8 draws 89% and 3 draws 11%        note

Above two thirds the heavy weight is simply what the mark looks like and nobody
would pick the other. Below it, two weights share the drawing and an icon set
cut at the finer one is a different set. Every threshold from about 0.55 to 0.7
separates these the same way, so the number is a gap in the data rather than one
fitted to the case that prompted it.

The forty-eighth started on a note and found what was under it.

    Ranked first of 2 shapes in the drawing; the others are offered beside it.

**Five identities said that about a drawing with one shape in it.** "The whole
mark" and "the only shape" are the same element — once bare, once inside a
wrapper that carries nothing — and the dedupe compared markup strings, so it saw
two. They scored identically because they were identical, and the canvas offered
a choice between two of the same thing.

Then the margin, which the note never gave. Three identities are decided by under
a hundredth. So: how precise is the score? `ink` is a coverage read off a square
raster, and that square was **44 pixels**. Recomputing every score at 176 moved
one by **0.09** — a tenth of the whole score — and **changed which shape won on
two identities**. The ranking was being decided inside its own quantisation.

A hairline lights whole pixels at 44 across, so a thin shape read as far more
solid than it is, and `solid` — the term that exists to stop a wash winning —
rewarded it. tarnbrook was tiling a shape 0.18 compact, which is very nearly a
line. Ravelston's field was a set of plain rules. At 176 both move to a squarish
shape: ravelston to its hatched shield panels, tarnbrook to its own arch and
waves. Going on to 352 changes no winner at all, and the finer read costs about a
tenth of a second on a build that takes six.

So the note says the margin now, and where the two are inside that precision it
says the choice is a decision rather than a reading and to look at both. What
made the round worth doing was asking how good the number was before reporting
it.

The forty-ninth went to look at the canvas motif options and found there are
none. Every package ever built ends its pattern note with:

    the canvas shows every one of them

It does not, and it never has. `pattern.options()` built exactly that — every
motif crossed with every construction, as swatches — and **nothing has ever
called it**. Not the editor, not the documents, not a test. The note was
describing a chooser that was never wired up.

It also cannot be wired up in that form. The canvas is one static file with no
engine behind it, so every tile it might offer has to be written into it in
advance, and a tile is keyed by density and colourway as well as by motif and
construction:

    ravelston   today 9 tiles, 32 KB     every combination 486 tiles, 1729 KB
    vesper      today 9 tiles, 14 KB     every combination 243 tiles,  369 KB
    pagrin      today 18 tiles, 147 KB   every combination 162 tiles, 1319 KB

into an `editor.html` of about a megabyte. Even one density and one colourway —
a contact sheet rather than a chooser — is 41 to 73 KB, and would still not be
what the note described.

So the note says what is true. The alternatives live in `brand.json`, and they
are worth reading now: they used to be bare keys, `shape:5` and `shape:7`, which
is not something anybody can choose between. Each carries its name and its
score, in ranked order, and every one of them can be pinned with
`system.pattern.motif` — which the test checks by pinning each in turn rather
than taking the sentence's word for it.

**And one of the sentences was mine.** The round before this added, on a close
call, "look at both on the canvas before you take it." Same false promise, one
round old.

The fiftieth: the pattern block's ink menu offered ten choices and three of them
existed.

The block looks its tile up by `density:colourway` and, when it missed, fell
back to whatever was first in the map. Meridian's menu offers every role and
every colour name; tiles are cut per role, and only for roles whose ink can be
seen on its ground. So seven of the ten silently drew `fine:ground` while the
panel said something else.

One of the seven was refused on purpose. Meridian's accent measures **1.83:1**
against its ground, so the engine cuts no tile for it and records why — and
ships that reason in the bundle. The fallback threw it away. Which also means
`cvPatternRefused`, the string written for exactly this, could only ever appear
for an identity with no pattern at all.

The menu offers the roles there are tiles for, and a request with no tile says
why in the words the engine already wrote.

**A bug report, mid-round: uploading an SVG failed with**

    Unexpected token 'T', "The page c"... is not valid JSON

That string is not in this repository. It is `JSON.parse` complaining about the
first letter of somebody else's error page — "The page could not be found" — and
it was the wrong error about the wrong thing.

Two faults, one on top of the other.

**The route was never deployed.** `client.html` posts the artwork to `/api/ask`
as the very first thing it does. `vercel.json` publishes `api/*.js` as the only
routes, and `api/` held `build.js` and `inspect.js`. Of the four routes the
client uses — `ask`, `preview`, `build`, `render` — **three had no function**,
and the one deployed function the client never calls is `inspect`. The local
server has all five, which is exactly why nobody saw it: two lists, in two
files, that nothing compared. `api/ask.js`, `api/preview.js` and `api/render.js`
are thin wrappers around the same handlers the local server calls, so the hosted
app and the one on your own machine cannot answer differently.

**And the client assumed every answer was JSON.** It called `r.json()` before
looking at `r.ok`, so anything in front of the app answering in HTML — a 404
where a route is missing, a 413 where the upload was too large — surfaced as a
parser error. It reads the body as text and tries it as JSON now: a 404 says
which route is missing, a 413 says the artwork is too large, and a refusal the
engine itself wrote still reads as itself.

A test now reads the routes out of `client.html` and compares them against the
files in `api/` and the paths in `server.js`, so the three lists cannot drift
apart again.

---

The fifty-first: the audit had been taken off the door it was written for.

The last round found three routes the client posts to that nothing served. The
same list, read the other way, says something worse. `/api/inspect` was
deployed, tested, and **called by nothing**. It had been the first screen —
drop the artwork, and before any question is asked, read back what the file
actually contains. When the front door was rewritten into four screens that
screen went, and the audit went with it.

What replaced it was `/api/ask`, and `ask` read the artwork by a different path:
`intake.read`, which measures, and never runs the audit at all. So the door and
the build held two opinions about one file, and nobody had put them side by
side. Three files the door used to take:

| dropped on the door | what `ask` said | what the audit says |
|---|---|---|
| a mark set in live text | fine, 1 colour | **live text** — it renders in another font on any machine without your typeface |
| a PNG in an SVG wrapper | fine, 0 colours | **a raster** — there is no geometry in it to measure |
| a drawing with nothing painted | *the artwork renders empty, so it cannot be measured* | **nothing is painted** — check the layer has not been left switched off |

The first is the one that matters. It was accepted, described, measured, and
carried into the questions, and the package at the end of it contains a mark
that needs Futura installed to look like itself. The third is the engine's own
internal sentence, written for a caller rather than for a person holding an SVG
— and the audit has had a proper refusal for it, in three parts, the whole time.

**The audit runs at the door now.** `ask` puts each asset through `normalise`,
the same function `project.load` puts every asset through, so a refusal at the
door is the refusal the build would have made, in the same words, before any
work is done on the strength of it.

**And what it measures is what comes out of that**, not what came in. They are
not the same drawing, which is easy to say and easy to under-rate, so it was
measured across all thirty-two identities: read raw against read audited, **nine
name a different pattern motif and three count their colours differently**. A
fill still sitting in a `<style>` block is invisible to anything reading
attributes; a transform that has not been flattened measures a stroke thinner
than it prints; a shape lying off the artboard widens the box every size is
worked out from.

Pagrin is the sharpest case, because it is the identity that came out of a real
exporter. Its mark is drawn in a gradient. Read raw, it has **no colour and one
slot called `all`** — so the door offered an empty palette to confirm, and a
colourway would have repainted nothing. Read audited, the slot is `ink`, and
the engine has had the right thing to say about it all along:

> **1 gradient.** A colourway names one colour for a slot, and a gradient is not
> one colour. Any colourway that names a colour for this slot replaces the
> gradient with it… A gradient also cannot be printed as a spot ink, so the flat
> version is the one a two-colour job uses.

That sentence existed, was generated on every upload, and was thrown away. It is
on the screen now — under the facts, shut by default, saying what was cleaned up
and what is worth looking at, because it is reassurance rather than a problem.

Three smaller things fell out of it. A refusal was being flattened to one line
of *whats*, dropping the why and the how, which is the half that tells somebody
what to do; the client renders all three now. A refusal returned rather than
thrown went out as **HTTP 200**, while the same finding thrown from `asSvg` went
out as 400 — one answer, two status codes, for the next caller to get wrong.
And `Continue` stayed lit after a refusal, so the next screen was one click from
drawing itself out of a measurement that was never taken.

`inspect` is gone — the handler, the route and the function. Everything it did
that anything used, `ask` does; the rest was a second reader of the same artwork
that could only ever disagree with the first. The route test now runs **both
directions**: a deployed function nothing calls is a list that has drifted,
exactly like a call nothing serves.

---

The fifty-second: the front door could not recolour the artwork it was given.

The audit reaches the door now, so the next thing to ask is what the door does
with what it read. It reads the palette off the drawing, shows it, and asks
which colour does what. Then it writes the colourways — and none of the three
things it wrote were about this artwork.

Measured by building all thirty-two identities through the door and reading the
files that came out:

| | |
|---|---|
| came out drawn in one colour, having been drawn in more | **9 of 32** |
| wrote two colourways that are the same file | **2 of 32** |
| had a slot no colourway named, so the logotype stayed dark in the reverse | **5 of 32** |

**The first colourway painted every slot the same colour.** That is not a
colourway of an identity, it is a flattening of one. Carrock is drawn in an ink
and a shellac label; the door measured the shellac, put it on the screen, asked
the designer to confirm it was the accent — and then wrote
`{ink: #241C1A, label: #241C1A}`, and every file in the package came out in one
colour. It is fixed with a word the engine already had: `keep` means "as the
master drew it", and the master is already painted. The first colourway is
`full-colour` and every slot in it is `keep`. The flat version is still cut,
on purpose, under the name it deserves — `mono` — and only where there is
something to flatten, which is measured as the number of distinct paints on the
drawing's slots rather than the number of slots. Beaumont has four slots all
painted `#1A1714`; counting slots would have cut it the same file twice.

**The slots were read off the master alone.** A colourway repaints by slot and
can only name the slots it was told about. Five identities draw a slot that
lives only in the logotype, so no colourway ever named it — and in the reverse
lockup the words stayed the colour of the ground they were standing on.
All five measured **1.00 to 1** — the words painted in exactly the colour
behind them. They measure between 9.77 and 21.00 now.

**And the door read the upload again to decide what to name.** This is the
last round's fault standing in the next function along: `ask` had been fixed to
audit, and `stage` was still reading the raw file. Worse, the audit is not
enough on its own here — a slot is *named after the palette colour it is
painted in*, so the same drawing read without a palette and read with one comes
back with different slot names. Perigee's are `colour-1, colour-2, colour-3,
ink` without and `colour-2, ink, accent` with. Its colourways named slots that
would not exist, nothing was ever repainted, and its "reverse" was byte-for-byte
the same file as its default. Pagrin's too.

The engine had been saying so the whole time, in two voices:

> colourway "reverse" gives no colour for word, so every file in it keeps what
> the master was painted: word (#1A1714). **Add the slot to the colourway**, or
> remove it from the artwork.

> the master paints a slot (ink) with a gradient, and every colourway names a
> flat colour for it, so the gradient is in the master and in none of the files
> this wrote. **Write "keep"** instead of a colour in the colourway that is
> meant to carry it.

Both correct, both arriving in a list of notes at the end of a package that had
already been written, and both telling a person holding a browser to edit a
colourway — which is not a thing the front door has. A `how` that cannot be
followed where it is read is the same defect this repository fixed once before
for the CMYK advice; the fix this time is not to word it better but to stop
producing the package that needs it.

**And making `keep` the common case found it already shipping.** Seven places
in the engine reduced a colourway to the single colour something needs when it
can only take one — a pattern tile, a partner lockup, a misuse diagram — and
every one of them did it the same way: take the value of the first slot. That
is a colour right up until the slot says `keep`, and then it is the word
itself. The tiles went out with `stroke="keep"` in them, which paints nothing.

This was not introduced by making the drawing the first colourway. Vesper and
pagrin are the two identities in this repository whose own project files use
`keep`, and both have been shipping it: three pattern tiles each, and for vesper
the manual and the deck as well — their pattern specimen takes the colourway's
value for the master's own first slot, and vesper's first slot is the gradient
one that says `keep`. Eight files across two identities, in packages this
repository builds and publishes. Nobody saw it because a tile that paints
nothing looks like a tile you have not scrolled to.

All seven go through one resolver now — `keep` means "as the master drew it",
so it resolves to what the master actually paints that slot — and the check is
that nothing anywhere in a package is painted with the word.

---

The fifty-third: a name the files cannot carry, and a page that lost its type.

**Type a Japanese or Hebrew brand name into the front door and it dies on the
fourth screen.** Not with a refusal — with this:

    the brand name "やまびこ" has no letters a file name can carry.
    Add "latinName" to the project — the roman spelling the files should be
    named after, for example "latinName": "Maayan".

That sentence is correct, and it is the right thing to say to somebody holding a
project file. It is no help at all to somebody holding a browser, because there
is no file to add it to. The same defect this repository has now fixed three
times: a `how` written for one place and shown in another.

The engine has supported this since the seventh identity. `project.js` says so
in as many words — *"Romanising a name is the designer's decision, not an
algorithm's, so it is asked for and used, and asked for here rather than three
quarters of the way through writing a package"* — and two of the thirty-two
identities are exactly this case: maayan in Hebrew, yamabiko in Japanese. Both
set `latinName` by hand. The door never asked, so it hit the person three
quarters of the way through anyway: artwork, six questions, a layout chosen, and
then a dead end.

It asks where the name is typed now, and only when it has to. The test for
"has to" is the engine's own `slug` — `naming.js` is UMD and served into the
page the way `contrast.js` already is, because a second copy of that fold table
in the browser is a second answer the first time somebody types an ø. With a
roman spelling, やまびこ builds all fifty-five files as `yamabiko-mark-…` and the
manual still says やまびこ on the cover.

**And measuring that turned up two more, both about the app as hosted rather
than as run.**

**The package it builds cannot be opened.** Hosted, there is no filesystem
between one request and the next, so the answer to `/api/build` carries the
package as bytes rather than pointing at files — `api/build.js` has sent them
since the app was first hosted, and both hosts have served jszip for the page
to open them with. The page rewritten after it reads only `j.base`, which
hosted is `undefined`, and builds every link as `j.base + name`:

    The manual             undefinedguidelines.html
    The deck               undefineddeck.html
    The canvas             undefinededitor.html
    A published page       undefinedpublished.html
    Download the package   undefinedhosted-brand-package.zip?download

Five cards on the last screen, after a full build, and not one of them opens
anything. The bytes were in the answer the whole time. The page opens the
documents out of them into blob URLs now, and says the one thing that genuinely
differs rather than hiding it: they live in the page and do not survive a
reload.

**And the hosted front door has been shipping with no typefaces at all.**

`client.html` is a template. The local server fills a `/*FONTS*/` marker with
449 KB of inlined faces; `site/build.js` copied the file to `site/out` — the
comment said *"the same page the local server serves, byte for byte"* — and byte
for byte is exactly the bug, because the marker travels unfilled.

    served     10 faces loaded
    deployed    0

Which makes it the round about fonts undone by the round about hosting. The
fonts round existed because "the front door was the last thing in the product
still reaching out for a stylesheet"; the hosted copy has been set in whatever
Helvetica the visitor happened to have ever since, through twenty-three
releases. There is one `page()` function now, called by the route and by the
site build, so the page you get on your own machine and the page you get hosted
cannot be different pages — and the test reads the markers out of the template
rather than naming them, so the next one added cannot be forgotten.

---

The fifty-fourth: every package the front door has built came out with no
typefaces in it.

Going to answer the language question — the one thing named as still to do —
meant asking first what type a door-built package is set in. The answer is none.
`projectJson` wrote this:

    tokens: { type: { heading: 'Archivo', body: 'Literata' } }

`heading` and `body` are words nothing in this engine reads. Everything else —
the loader, the three documents, the canvas, both checks written about type —
speaks `families: { display, text }`. So `tokens.type.families` was `undefined`
in every package the door has ever made:

| the same artwork | through the door | from its project file |
|---|---|---|
| `09-type` | **0 files** | 9 |
| `@font-face` in the manual | **0** | 4 |
| the manual | 63 KB | 248 KB |

The typefaces page named Archivo and Literata over specimens set in whatever
the reader happened to have. Which is the exact defect `src/typeface.js` exists
to end, in the comment at the top of it: *"A specimen showing the wrong face is
worse than no specimen, because it is offered as proof."*

Both checks written for this stayed quiet, and had to. `unreachable` asks which
named families cannot arrive — none were named. `cannotDraw` asks what the
shipped fonts cannot draw — none were shipped. A silence that means "nothing is
wrong" and a silence that means "there is nothing here" look identical from the
outside.

The door writes the engine's shape now: Archivo at 600 and 700, Literata at 400,
both faces the engine already holds, with fallbacks. A door-built package
carries `09-type` with six woff2 files and the OFL, every document has the faces
inlined, and the package says so — *"Archivo and Literata are in 09-type as 6
web font files, under the SIL Open Font License, and inlined in every document
so nothing is fetched to read one."*

**And a scale nobody wrote is not a heading over nothing.** A type scale is a
decision, not a measurement, and the door decides one for nobody — so the manual
printed "The scale" over an empty div and the deck a slide reading "0 steps"
over an empty box. Neither does now, the same way a manual with no misuse rules
has had no misuse page since the round that noticed it.

One thing measured and left alone: `site/out/contrast.js` and the `/contrast.js`
route are served to nobody — the page that fetched them was the one replaced.
The same was true of jszip an hour ago, and the right answer there was to use it
rather than delete it, so this is recorded rather than removed.

Still to do: **the door cannot choose a language.** Fixed in the next round.

---

The fifty-fifth: the front door wrote every package in English.

`src/strings.js` holds four dictionaries under a key-parity test — English,
French, Hebrew, Japanese — with a fixture for each, and all four were reachable
only by hand-writing a project file. The same identity, one flag apart:

    language: undefined   <html lang="en" dir="ltr">   The mark | Colour | …
    language: "he"        <html lang="he" dir="rtl">   הסמל | צבע | …

Which is the thing `project.js` says was wrong to begin with: *"A Hebrew manual
told a screen reader to say Hebrew in an English voice."* The door reintroduced
it for everybody who came through it.

**So there are seven questions now, and four of them the engine answers for
you.** The seventh is the language. It is asked rather than guessed: the script
a name is written in is a signal and not an answer — verdon is French with a
Latin name, and a studio in Tel Aviv may well want the book in English.

**The language chooses the type, or the manual comes out in boxes.** A document
carries the engine's words as well as the identity's, and the Hebrew ones are 38
characters Archivo and Literata have no glyph for. So the options say what each
is set in, and the answer decides it:

| | | |
|---|---|---|
| English | latin | Archivo and Literata |
| français | latin-ext | Archivo and Literata |
| עברית | hebrew | Heebo and Frank Ruhl Libre, right to left |
| 日本語 | cjk | **not available** |

Japanese is shown and not available — the same idiom the misuse question already
uses for a treatment a particular drawing cannot take. Its chrome is 596
characters and nothing in `fonts/` has a CJK subset; yamabiko sets it from a
subsetted IPAGothic its own project ships, which is a thing a project file can
do and a front door cannot. Asking for it anyway is refused with that in the
`how`, rather than delivered as a manual in tofu under a page naming the face it
claims to be set in.

A Hebrew identity now comes out of the door as a Hebrew manual: right to left,
chapters reading הסמל, צבע, טיפוגרפיה, `heebo-500-hebrew.woff2` and
`frank-ruhl-libre-400-hebrew.woff2` in `09-type`, the faces inlined in every
document, and a specimen page showing the Hebrew alphabet in the face it says it
is set in.

One thing the reversion test caught that reading would not have: setting the
language *over* the answers rather than *into* them picks the faces first and
the language second, so a caller naming `language` on its own — which is what
`/api/render` accepts — got a Hebrew manual set in Archivo. It goes in with the
answers now.

---

**A bug report, from use: "Build the package" answered**

    That did not work.

and nothing else. Three faults, stacked.

**The refusal never reached the person.** Both servers answer a refusal as
`{ ok: false, findings: [{ what, why, how }] }` — there is no top-level `what`.
The page read `j.what || j.error || 'That did not work.'`, so *every* refusal
from *every* route came out as the fallback, with the engine's own sentence
sitting unread in the answer beside it. In this case:

> **No lockups were chosen.** The engine has nothing it can work from. *Pick at
> least one — the mark on its own is enough to start.*

**And it was painted onto a screen nobody was looking at.** `fail()` was told
which box to use, and two of the four it was told are not error boxes: `#picks`
is the layout chooser and `#changed` is the list of your edits — and `fail()`
empties what it is handed. So a build that refused wrote its reason onto the
previous screen and destroyed the four layout choices doing it. Every screen has
an `.errbox` now, `fail()` finds the one on the screen you are on, and it scrolls
itself into view — a panel can be taller than the window, and the editing screen
is a whole manual.

**And the refusal should not have happened at all.** `make` demanded the caller
name the lockups; the page sends `seen.lockups`, which a page one commit older
than its server does not have. The drawing knows what can be locked up — the
engine reads the slots, the paint and the scale off it already — so it reads
this too, and a build with nothing named still writes all four.

---

**The canvas opened with artwork nobody could see**

Twenty-four of the 158 pieces of artwork the canvas opens with, across nine of
the thirty-two identities here, were drawn in a colour they could not be seen
in. Measured in a browser: one picture of the page, and a count of how many
pixels of each block are the ink the mark is meant to be drawn in.

    Hallward   lockup        ink                1:1  100.0% of 124000 px, 2 tones
    Cusp       minimumSize   ink                1:1   99.5% of  72800 px, 2 tones
    Vesper     lockup        dusk               1:1   91.7% of 124000 px
    Thornbury  construction  reverse #EDE7D9 9.66:1    0.0% of 159600 px
    Marlow     lockup        horizontal:reverse — the project never cut it

One shape, five times: the canvas asked for a colourway, a ground and a lockup
without asking whether the project cuts them. The colourway resolver took the
first one there was; three blocks painted a ground and then resolved a colourway
without mentioning it; the cover went on the primary colour and the diagrams on
the ground colour, which for Hallward and Cusp are the ink itself; and the cover
asked for a horizontal lockup Marlow does not cut. All four now read the project
and measure the contrast, and the project's own first choice still wins wherever
it reads — so only what nobody could see has moved.

Two more the browser found and the arithmetic could not. Reading a mark as text
to find its colours counted a `clipPath`'s white rectangle as paint, which is
the thing `src/svg.js` names at `NEVER_DRAWN`; the inks are measured through the
walker that knows better and carried on the bundle. And the motion block split
the artwork with a regex, which closed Kvist's `<defs>` in the wrong place and
put the whole logotype inside it — a block that has drawn nothing at all in
every package this repository has published.

Fixing the last of those took yamabiko's `published.html` from 50.7 per cent
Japanese to 48, and the engine's own accessibility check refused the build.
Twenty latin characters were the margin: the build titled every published page
`Guidelines`, in English, on a page declaring the identity's language. It uses
the identity's own word now.

---

**The package said it measured three documents and measured one**

Every package ships an ACCESSIBILITY.txt that names three documents and ends
"Everything above passed on every page in this package". Every row in its table
came from the manual's stylesheet. The deck and the published page carry their
own, and neither had ever been read — in any package this repository has
published. Both were under the line the same package prints a table about: the
deck's top bar and keyboard hint at 3.97 to 1, the published page's bar and
captions at 4.37, where 4.5 is the figure.

Three faults under it, each of which hid the others. The theme reader knew only
one way of writing two themes — light on `:root`, dark in a media query, which
is how the manual is written; the deck and the published page are written dark
first, so it read their dark palette twice and called half of it light. The page
ground was only found when `body` was the whole selector, and the published page
writes `html,body`. And the identity's own colours were being measured as the
document's: the deck sets a chapter number in the brand's accent on a slide
painted in the brand's primary, and scoring that against the shell it is nowhere
near is eighty failures that are not there.

Which tokens belong to the document is now read off the stylesheet rather than a
list kept by hand: they are the ones every block that declares the page ground
declares, because a reader's light or dark preference redefines the chrome and
is not allowed to change what colour a brand is. A hundred rules are measured
across the three documents in both themes, four failed, and the statement prints
a table per page.

Those two were the next one, and measuring them properly found four.

---

**Every document drew words in a colour it never checked**

1326 runs of text, across all thirty-two identities, in two of the four
documents, set in a colour nobody had checked against the ground under it.

    published.html  dark   13px  #E9EBEC on #EFEDE4  1.02:1  "deep"
    guidelines.html dark   10px  #C2352B on #0C0D0F  3.55:1  "Never for text"
    guidelines.html light   8px  #B08D3F on #FCFCFB  3.04:1  "24 unit box"
    published.html  light  36px  #FBFAF7 on #FBFAF7     1:1  "Hallward Press"

Four ways of not checking. **A block that names no colour takes the document's**
— the palette chips, the contrast rows, the type specimen and the asset index
each set none, so they came out in the canvas's dark ink, or the published
page's, on a page painted in the identity's ground. **An accent is not a text
colour** — the construction and clear space diagrams drew their 8 px captions in
it, and Meridian's accent is 2.09 to 1 on Meridian's paper. **A verdict written
once, for a light page** — green, amber and red were written out four times, all
four for white, and printed at 3.55 to 1 on the dark one. **And a cover that
chose its ground and not its words** — the round before taught the cover to pick
a ground the artwork can be seen on and left the writing set in the old one, so
Hallward's own name came out in paper on paper at 36 px.

Green has to stay green, so a colour that cannot be read keeps its hue and moves
only how light it is, stopping at the first step that reads. Words a block draws
for itself come from the identity's own palette, measured against the page they
land on. The three verdict colours live in one place and the manual declares them
as tokens beside its page ground, which means the engine's own check measures
them from here on — it found one the same minute, on a card a shade off the page.

26010 runs of text, four documents, thirty-two identities, both themes, measured
in Chromium: none under the standard.

---

**A package that carries its faces, and documents that never ask for them**

Every document sets its own furniture in a stack of names — Schibsted Grotesk,
Helvetica Neue, Helvetica, Arial, sans-serif — and not one of them is a face the
package ships. Chromium knows which font actually drew each page, and will say:

    yamabiko  guidelines.html   1.0% of 12826 glyphs from a file the package ships
    maayan    guidelines.html   0.5% of 14802 glyphs from a file the package ships
    meridian  guidelines.html   1.8% of 18293 glyphs from a file the package ships

124 of the 128 documents this repository builds were drawn mostly by fonts that
are not in them. For an English document that is a neutral system stack working
as designed. For a Japanese or Hebrew one it is a promise the package cannot
keep: none of those four names holds a single CJK or Hebrew glyph, so a manual
whose whole point is that it opens with no network depends on the reader owning
a font. 2960 glyphs of Yamabiko's manual were drawn by WenQuanYi Zen Hei, which
nobody here has ever named.

The faces were in the package the whole time. Each stack ends with them now,
which costs no bytes and overrides nothing the reader has — it is reached only
for a character every name before it lacks. 128 of 128.

The check that exists for this had never run. `test/font-check.mjs` says in its
own header that only a browser has the answer, and then asked Node: it read the
shipped fonts with opentype.js, opentype.js cannot decompress woff2, and woff2
is what every package ships. It stopped at "nothing was measured" every time it
was run. It asks Chromium now.

---

**The engine has a check for naming a face you do not deliver**

`src/typeface.js` opens by describing the fault it exists to prevent: a family
named in the CSS, no `@font-face` ever written, every page falling through to
its fallback while the document goes on saying it is the face. It has a check
for it, and that check had only ever been asked about the families an identity
declares. Nobody had asked it of the documents' own furniture — where every
manual this engine has written begins

    --ui: "Schibsted Grotesk", "Helvetica Neue", Helvetica, Arial, sans-serif

and the engine vendors Schibsted Grotesk, eight files in `fonts/` with a full
manifest entry, in no package.

What separates it from Helvetica is not a judgement but the manifest: a family
named in a stylesheet that the engine's own catalogue holds is a face it could
have delivered and did not. A name outside the catalogue is a system name, which
is what a fallback is for. Asked of all eleven catalogue families against all
four stylesheets, it finds exactly one, in every identity here.

Carrying it is 245 KB onto a 296 KB manual, four documents over, for furniture
`chrome.js` itself calls deliberately neutral and that Helvetica has been drawing
all along; cutting it down needs a subsetter the build cannot have, because the
package is built inside a serverless function. So the name goes and the sheet
says what has always been true. Nothing on any page changes — measured across
128 documents, identical before and after, because Schibsted Grotesk was never
winning. What changes is that the build now says so if a document claims a face
it does not have.

---

**A check that skipped two thirds of itself and signed off anyway**

`test/typst-check.mjs` compares four things about the printed piece. Two of them
need a Typst compiler to compile with, and there has never been one in this
repository. For the seventy-four commits since it was written it printed

    every mark, compiled
      skipped: no typst binary (set TYPST)

    the printed page against the published page
      skipped: no typst binary (set TYPST) no playwright (set PW_PATH)

    the piece on paper is the piece on the canvas

and exited 0. The last line is the one anybody reads, and it answers the question
the two lines above it say nobody asked. The other nine checks in that directory
stop dead — *playwright is not installed, so nothing was measured* — and say
nothing further. This one was alone in signing off on work it had skipped, and it
is the check on the one path that goes to a press.

It is also solvable rather than only sayable. A Typst compiler is an npm package,
so it is found the way Playwright is found: not a dependency — 51 MB of native
binary per platform, which is why Playwright is not one either — looked for where
one might be, skipped plainly when it is not there. With one present all four
sections run:

    379 marks compiled, every colourway and every lockup of all 32 identities
    ok   the printed page matches the published page
         576 areas, mean 0.52 of 255, worst 8.9
    ok   the printed piece is entirely in ink
         5 distinct colours, 0 of them screen colours

They pass. That is the thing nobody could see — and the reason nobody went
looking is that the closing line said it had been checked.

It now names what ran and counts what did not: *the path translation — measured
and clean. 3 of the 4 could not run here, so nothing above says anything about
them.* A suite test runs every `*-check.mjs` with the environment emptied and
fails any that comes back without saying what it could not do.

---

**A mark that changed colour depending on where you put it on the page**

Two of the thirty-two identities here have a gradient in their artwork. Both
printed wrong, and one of them printed *differently in different places*: the
same mark, the same size, at four corners of one page, came out four colourways.
Measured across the whole repository — the same drawing, moved, compared with
itself:

    pagrin        98.63 of 255
    vesper         4.58
    the other 30   0.00

Every curve was written into the file at its page coordinates and placed at the
paper's corner. Typst sizes an element by what is in it and runs a gradient
across that box, so an element holding a mark at the foot of an A4 page is an
A4-sized element, and the ramp was drawn across the sheet rather than across the
mark. Flat artwork could not notice, which is why thirty of them read 0.00.

The file's own comment said *Typst has gradient.linear, and it fills the
element's own box, which is what an SVG gradient in objectBoundingBox units
means, so the two line up.* Neither half held. Each shape is placed at its own
box now; `gradientUnits` is read, because Pagrin's mark came out of a real
exporter and a real exporter writes a line in the artwork's own coordinates
running well outside the drawing — read as fractions of a box it is about 180
times too long, and 180 times too long is one flat colour. And an angle is not
an axis: SVG runs a ramp between two named points and holds the end colour
beyond them, so the stops are moved to where they fall across the box and the
ends are the colour the artwork actually holds there.

One more, found on the way: `Z` closes a path with a straight line, and Typst's
`close()` is a curve unless told otherwise — which draws a shape the artwork does
not have and grows the box a gradient is measured against. A dome 100 tall,
closed smoothly, measures 150. On this repository's artwork it is worth at most
0.10 of 255, and it is still the wrong line.

    the printed page against the published page      before   after
      pagrin                       mean of 576 areas   3.41     1.50
                                          worst area   71.8     16.6
      vesper                                    mean   0.84     0.13
      the other 30                                     unchanged to the digit

Thirty-two of thirty-two pass now; before, Pagrin failed both thresholds. The
check that should have caught it was pinned to one fixture — the file said in its
own comment why that is a risk, and it was right — so it runs on every identity
now, 1 page to 32. It also reads Typst's own box back out of the compiler and
compares it with the box the emitter computed, because the whole translation
rests on those being the same rectangle: 0.000pt apart. And the colour-space
question got better rather than louder: not *no screen colour anywhere*, but *no
screen colour the build did not name* — Pagrin's wordmark is a plain black nobody
gave an ink for, and the build says so out loud.

---

**Half the package was in no sentence the client reads**

A client opens README.txt. It carried one index, headed *Which file to use*, and
that index listed the lockup folders. Across the thirty-two identities here:

    folder            ships in   named in its read me   files
    01-horizontal           31                     31     393
    02-stacked              29                     29     382
    03-mark                 29                     29     381
    04-wordmark             21                     21     289
    05-icons                32                      0     167
    06-social               15                      0      36
    07-pattern              32                     32     318
    08-photography           2                      0       5
    09-type                 32                      0     274
    10-documents             1                      0       6

82 of 233 folders, 488 files. Every package ever built shipped a folder of cut
icons and a folder of typefaces that its own read me never mentions. The manual
and the deck do name those; 10-documents is named by nothing in the package at
all — not the read me, not the manual, not the deck, not brand.json. The only
thing that ever said it was there is a build note, which stays on the machine
that ran the build and does not travel with the zip.

And it was not merely silent. *Which file to use* sent you to **03-mark** for
"avatars, app icons" with a folder of avatars and app icons cut to size sitting
beside it, unnamed.

The comment above that index records the same fault being fixed once already,
for the lockups: four hardcoded lines in a package that writes the lockups the
project asks for, so eleven read mes named folders that were not there. It was
taught to list what it wrote — and only the lockups. 07-pattern got its line the
same way, because *the pattern was in the package and in no sentence anybody
reads*.

So the read me now reads its folders off the package, from the same list
brand.json counts, which knows about the folders written after the read me is
composed — that is how 10-documents was invisible even to a fix like this one.
Any folder no other line already covers gets a line of its own, and the line is
read off what is in it:

    Also in here
    ------------
      05-icons        the mark cut square: 180, 192, 512, 1024 px for an app
                      icon, 16, 32, 48 px and a favicon.ico holding them, for
                      a browser tab. Use these rather than resizing one
                      yourself.
      06-social       the mark placed and centred for each crop a network asks
                      for: 400×400, 1128×191, 1200×630, 1500×500. The name of
                      each file says which is which.
      09-type         Archivo and Literata, as web font files. Every document
                      carries the type inside it, so this folder is for
                      everything else you set.

A folder the read me has no sentence for is still listed, with a count of what
is in it, and the build tells whoever ran it to write one — the fault is a file
nobody mentions, and a wrong sentence is not the cure for it.

233 of 233 folders named, 0 files unmentioned. And 03-mark now says the one
thing that is a choice between drawings rather than a size: *the symbol on its
own, where the name is already present.*

---

**"No old variant can be hiding in a folder"**

That sentence opens the read me in every package this engine has ever built. A
build only ever created files. It never removed one.

`-o out` is for the folder a designer keeps, so rebuilding into it handed the
client yesterday's package with today's laid over the top. Measured, on Meridian:

    what changed between the two builds     handed over   the package   yesterday's
    a colourway is dropped                          150           127            23
    a lockup is dropped                             150           125            25
    the brand is renamed                            251           150           101
    an icon size is dropped                         150           149             1
    nothing changes at all                          150           150             0

Drop a colourway and twenty-three files of it stay, `.pdf` and `.ai` included.
Drop a lockup and the whole of `02-stacked` stays. Rename the brand and a
hundred and one files stay: two complete sets of artwork under two names, in one
folder, with a read me, a `brand.json` and a manual that describe one of them —
and the old zip beside the new one. Nothing distinguishes the old set from the
real thing except knowing which name is current.

The zip was always right, because it is packed from what that run wrote. It was
the folder that was not, and the folder is what gets handed over.

A build clears what it wrote before and no longer writes. Only that. `brand.json`
carried `generated.files` — a count — and now carries the list beside it, so what
a build removes is a path this engine has a record of writing, in a `brand.json`
it wrote itself. Anything else in the folder is somebody's own: it is left where
it is, and named.

    25 files from the package that was in this folder are not in this one, so
    they were removed: 02-stacked/meridian-stacked-black-1024.png, … and 21
    more. Only files this engine recorded writing here are cleared; anything
    else you put in this folder is left alone.

    3 files in this folder are not part of the package and were left alone:
    01-horizontal/my-own-crop.png, from-the-printer/proof.pdf,
    notes-for-the-client.txt. The read me says everything here was cut from the
    master, which is true of what this wrote and cannot be true of what it did
    not — hand over the zip, or a folder with only the package in it.

Nothing left from yesterday in any of the five cases; a folder emptied of the
package goes with it; the designer's own files stay; and a rebuild into the same
folder is byte for byte a fresh build. The list is read rather than obeyed, so a
`brand.json` naming `../something` removes nothing outside the folder it is in —
which is the fifth reversion, and it takes the guard away and watches a file
outside the package disappear.

It costs `brand.json` 10.3 KB to 17.0 KB on Meridian, 19.7 to 34.2 on Northline.
The count on its own was enough to check a package against itself and never
enough to clear one.

---

**A bug report, from use: "I uploaded an SVG and it kept throwing errors"**

Different errors, and no package at the end of them. So forty-seven exports —
Figma, Illustrator, Inkscape, Sketch, and the awkward things in between — were
walked through the front door the way a person walks it, in a real browser: drop
the file, take the defaults on every screen, press Build the package.

Thirty-six finished. Five could not, and four of those five got all the way to
the last button first — through the audit, the questions, the layout preview and
a rendered manual — before being told:

> **No colours were chosen.** The engine has nothing it can work from. *Pick at
> least one ink and one ground.*

on a screen with nothing to pick, to somebody who had picked nothing wrong.

**A logo drawn in plain black could not be handed over.** One black path is the
commonest export there is. A shape with no `fill` attribute is not unfilled —
SVG paints it black — and the cleaner removes `fill="#000000"` precisely because
it is the default. So the drawing arrived with no colour to count, and therefore
no slot to repaint and no palette to confirm. `applyColourway` already knew this
and said so in a comment; it never got the chance, because the slot it needs is
assigned from the attribute that is not there. The black is written out now, and
the file says what it draws.

**Artwork that names no colour at all** — a fill of `currentColor`, a shape
filled with a pattern — hit the same wall by another road. Both are drawings, and
both handed back an empty palette. The door proposes ink on paper now, which is
what a renderer draws them as, and says why rather than presenting them as read
off the file.

**A `<use>` of a `<symbol>` was refused as an empty file.** `<symbol>` holds
artwork without showing it, so the expander cloning the symbol element put a
never-drawn tag into the drawing — and a file whose whole artwork is one symbol
placed twice came back *"Nothing in this file is painted. Check the layer the
artwork is on, and that it has not been left switched off or moved aside."* The
designer goes looking for a hidden layer that does not exist. A symbol is a
viewport: its own viewBox is fitted into the width and height the `<use>` asks
for, the way a picture fits a box. It is placed that way now, and the result is
the same drawing the renderer makes of the file that went in.

**And one that built and should not have.** A `<foreignObject>` is HTML inside
the artwork, so only a browser paints it: the page showed the mark with its name
on it and every PNG and PDF came out without it — 2424 dark pixels in Chromium
against 1620 in the engine's own renderer, on the same file at the same size. The
word is the 804 that never reach the package. It is refused by name now, the way
live text is.

    forty-seven uploads, through the front door   before   after
      built the package                              36       40
      refused at the door, with a way forward         6        7
      could not be finished                           5        0

Every cleaned file is still the drawing that went in: rendered before and after
at the same size, none of the thirty-nine that get through differs by so much as
half a percent of its pixels.

---

**A bug report, from use: an error that argued with itself**

> **This copy of Node cannot load an ES module from ordinary code, which is what
> drawing a PDF needs. It is Node 22.23.2; 22.12 and newer can.**

22.23.2 *is* newer than 22.12. The sentence reads as a version rule that the
version already satisfies, so the one person who could act on it had nothing to
act on — and no package, after answering every question and reading the whole
manual on the screen.

The check was right that it cannot. It was wrong about why. `require(esm)`
arrived in Node 22.12, and it can also be switched off on a Node new enough to
have it: `--no-experimental-require-module`, usually through `NODE_OPTIONS`,
which is a thing a host sets. Which of the two it is, is knowable at the point of
refusing, and the two need different sentences. Below 22.12 it says the version
and where a host takes it from; at or above, it says the switch, and where to
turn it back on. Reverting the boundary to 22.13 fails the test; so does making
it a version rule again whatever the version.

**And the second half, which is the one that cost the package.** A package is a
hundred and fifty files and forty of them — the `.pdf` and the `.ai` — are drawn
by that one library. The build stopped on the first of them, so 110 files that
need nothing from it were never written: every SVG, every PNG, the icons, the
pattern, the type, the manual, the deck, the canvas, `brand.json` and the read
me. The person got nothing.

A format that cannot be drawn drops out now, and the build finishes:

    meridian, with the PDF writer unavailable      110 of 150 files
      52 png   35 svg   10 woff2   4 txt   4 html   3 json   1 zip   1 ico
      and the 20 pdf and 20 ai that are missing, named first on the last screen

> Node 22.23.2 can load an ES module from ordinary code, which is what drawing a
> PDF needs, and in this process that is switched off. […] So this package has no
> pdf or ai in it: every other file is here — the SVGs, every PNG, the icons, the
> pattern, the type, the manual, the deck and the read me — and the pdf and ai
> that go to a printer are the ones missing. Take
> `--no-experimental-require-module` out of `NODE_OPTIONS` and out of however
> this is started. On a host that is an environment variable in the project
> settings, and it needs redeploying after the change. Then build again and the
> same package comes out whole.

It is the first thing the last screen says, because it is the one thing about
that package which is not in it.

---

**The instrument, before the fix**

The last round found the smallest usable size measured off the pixel grid — a
plain triangle told it needs 3600 px on screen and 1012 mm in print — and shipped
nothing, because four rules were tried and every one broke something this suite
already checks. There was nothing to test a rule against. This builds that.

`src/thickness.js` asks the question a floor is *for*, of the whole drawing:
rendered this big, what share of the ink is thinner than the rule the project
states? It is a morphological opening with a disc — erode by half the rule,
grow back, and whatever did not come back was thinner — on an exact Euclidean
distance transform. A tapering tip costs almost nothing; a hairline across the
mark costs everything. It decides nothing: `geometry.js` still states the floor.

Two things had to be right before it could be believed.

**The size asked about is never the size rendered.** A 10 unit bar in a 120 unit
box, drawn 60 px wide, should be 5 px of ink and comes out 6, because the edge
pixels clear the threshold — ask about a 5 px stroke that way and you get an
answer about a 6 px one. The question is a ratio, so the artwork is rendered
once, large, and the rule moves instead.

**And every case has an answer worked out on paper first.** A 10 unit bar is
under 10.5 units and not under 9.5. A 30 unit bar beside a 6 unit one is 16.7%
thin at 10 units, which is six thirty-sixths. A 60 unit disc is not thin at 10
and entirely thin at 70. Three render sizes give the same answer. Fourteen of
those, and four ways of breaking the instrument that each fail them.

What it says, on the whole repository:

    a ring stroked 9 units    100%  100%  100%  100%  0.3%  0.0%  0.0%   at 8…64 px
    a solid triangle         13.6%  6.0%  3.4%  1.5%  0.9%  0.4%  0.2%

That is the difference a single number cannot hold. The ring *is* its stroke: it
falls off a cliff of 99.7% between 24 and 32 px, which is its floor. The triangle
has no cliff — it loses the tip of a corner and goes on being a triangle.

    142 drawings measured, against the size each one's package states
      9 state a size at which more than 2% of their ink is under the rule
      8 state a size at least twice the size they hold from
      stated against measured: median 0.97x, worst 5.3x

    northline/master     says 48 px and 38% of its ink is under the rule there
    ancroft/wordmark     says 169 px and 4.4%
    pagrin/stacked       says 505 px, holds from 96 px — 5.3x the other way

**Those figures are wrong and the next round withdraws them.** They were read
once each, off one render, at exactly the size where the rule falls on the
stroke it was taken from — which is the one place a single reading decides
nothing. See the round below.

`test/floor-check.mjs` prints that table for every identity in a minute. Next
is the fix, tested against it.

Still to do: the floor itself, now that there is something to test a rule
against.

---

**The instrument was blind, and answered anyway.**

Last round built `src/thickness.js` to ask what a floor is really for: rendered
this big, how much of the ink is thinner than a press can hold. It opens the ink
with a disc of half the rule and reports what did not come back. What it never
did was check that the disc was bigger than a pixel. A disc under one pixel
erodes nothing, so everything comes back, so nothing is thin — and the value
returned for that is **0%**, which is also what a perfectly robust drawing
returns. Between about two pixels of rule and about nine the reading wanders
rather than failing. A ring stroked eleven units, asked whether any of it is
under ten, which none of it is:

    rule, in pixels of the render      4      6      8      9     12     16     24
    share of it said to be under     71%     3%    52%     0%     0%     0%     0%

Same drawing every column. What moves is whether the core — the ink still
standing after the erosion — is a continuous shape on the grid or a dotted line,
and the core is only as wide as the ink exceeds the rule.

Three faults, one root, all of them in code that shipped a round ago:

**It measured between pixel middles**, so every stroke came out half a pixel
thicker at each edge than it is — and the stroke a floor is worked out from is
always exactly on the rule, so half a pixel decides it.

**It answered questions it could not see.** The render is now chosen from the
question, always the size that puts the rule at twelve pixels, and where that
would need a render larger than this will make, there is no number and it says
so. 37 of the 142 drawings state a size that cannot be checked at all.

**It asked on the edge.** A stated floor *is* the size at which the thinnest
stroke is exactly the minimum, so the rule lands exactly on the stroke it came
from, and the render decides which side:

    a ring stroked exactly 10 units, asked whether it is under 10
    render      600    700    800    900   1100   1400
    one number  100%    74%    86%    82%   100%    83%

It is now asked a pixel and a half either side and comes back as a pair, and
where the two disagree the answer is **"on the rule"** — a fact about the floor,
not a failure to measure. The width was measured, not chosen: across three
renders of every drawing here, no width ever called one over the rule at one
render and under it at another, and a pixel and a half is where the agreement
stops climbing steeply.

**So last round's headline is withdrawn.** "Nine floors are too small" and
"northline says 48 px and 38% of its ink is under the rule there" were one side
of a coin toss, read once. northline is not on the corrected list. Five drawings
are, each short on the kindest reading the measurement allows, which is the only
way this should ever call a package wrong.

    142 drawings, against the size each one's package states
      37 state a size past what a render can see, and were not measured
       5 state a size at which more than 2% of their ink is under the rule
      80 state a size where the rule falls on the stroke it was taken from
       5 state a size at least twice the size they hold from

**And the floors that look absurd turn out to be right.** Beaumont states 2581 px
because of a feature 0.64 units wide in a 550 unit box, and the suspicion was
that this was a taper being cut off by the grid — an answer that would keep
halving as the render grew. Followed down through five render widths it does not
halve; it converges on 0.65, and 2541 px really is the size at which that line
paints three pixels. The arithmetic is right and the answer is useless, which is
a different fault: a feature carrying **0.10% of the drawing's ink** is setting
the rule for the whole drawing. Hallward's carries 0.00%.

The instrument cannot take the job over either. Asked for the smallest size at
which no more than 2% of the ink is under the rule on the strictest reading, it
finds no size at all up to 512 px for 23 of the 142 — a shape with corners
keeps a percent or two under any rule, because a corner is a tip — and where it
does answer, the stated floors are already slightly the smaller of the two:
median 0.84x. Swapping it in would raise most of the floors in the repository to
fix five of them.

So the floor is still next, and the question has changed shape: not how to
measure a thin place, but which thin place is entitled to set the rule.

---

**A pattern engine, and the floor it stands on**

`src/pattern.js` tiles a shape cut from the master — seven constructions, the
shape ranked and chosen by measurement. It works, and every identity gets the
same seven answers. What it cannot make is a pattern that is a thing in its own
right rather than the logo repeated.

PLAYGRND is forty-three generative tools, and what is worth taking from it is
not the pictures but the method. One `paint()` function, drawn by every surface
— screen, export, vector recorder — so the raster and the vector cannot drift,
because there is only one of them. Every dimension derived from one unit, so a
generator is resolution-free by construction. Seeded, never random. And
four-dimensional noise, so an animation closes exactly: the two extra axes trace
a circle and after one turn you are where you began.

**That last one solves a problem PLAYGRND never had.** It makes pictures; a
brand pattern has to tile. It is the same problem and it takes the same answer —
value noise on an integer lattice is exactly periodic if the lattice index is
taken modulo the period, so sampling at x and at x + P interpolates the same
four corners with the same weights. Equal in the last bit, not blurred at the
join. Every octave doubles the frequency and doubles the period with it, so an
fBm stays periodic however deep it goes, and a domain warp survives it because a
periodic displacement of a periodic field is periodic.

Measured rather than asserted: fifteen hundred points, each compared with itself
up to four periods away.

    plain noise, six octaves of fBm      differ by 0
    a domain-warped field                differ by 1.2 × 10⁻¹⁴

And a check that a tile actually repeats, since the claim is cheap and the
failure is a wall covered in a visible join. Lay the tile out the way a designer
does — an SVG `<pattern>` filling a rectangle — and ask where the boundary
columns sit in the distribution of ordinary columns. Built on the periodic
noise the boundary is unremarkable; built on the same noise with the wrap taken
out it is the largest value there is.

    a field that wraps           z = 0.76
    the same field, unwrapped    z = 8.73

**Summed octaves pile up in the middle**, and the more octaves the worse. Six of
them, sampled into ten bins, come out `0.0 0.8 5.1 21.4 31.9 25.7 12.0 3.0 0.1
0.0` — posterise that into ten colours and two never appear and one takes a
third of the tile. It is the central limit theorem, so it has an exact answer
rather than a fitted constant: the octaves are independent, so the sum's spread
is the root of the sum of their squared amplitudes over their sum. That agrees
with a measurement of ninety thousand samples to four decimal places at every
octave count from one to six, and passing the field through the normal
distribution of that spread gives `9.3 11.1 11.2 10.8 9.9 8.2 9.0 9.8 9.4 11.3`.
One measured number in it — one octave's own spread, 0.1993.

**Then the claim that the two surfaces agree.** Not by reading the code: one
drawing, using nothing outside the contract, painted on a real canvas in
Chromium and recorded to SVG in Node, both rasterised at 480 px and compared
pixel by pixel. 0.49 of 255 mean difference, 0.04% of pixels differing by more
than 48 — the edges of diagonals, which two rasterisers will never agree about.

**And the check was passing for nothing.** Reverted the stroke scaling: passed.
Reverted the arc join: passed. Composed the transforms the other way round:
*identical numbers*. Three of the four things it existed to check, and the
drawing reached none of them — every stroke was at the identity transform, every
arc began its own path. A test drawing has to go where the code is. Rebuilt as
six panels, one per part of the contract, each under a transform of its own:

    the stroke width no longer scaled by the matrix     6.70    3.27%
    fillRect ignoring the matrix                       20.39    9.81%
    an arc that jumps to its start instead of joining   2.86    1.29%
    translate composed the other way round              3.09    1.56%
    clip not opening a group                           38.81   19.25%

The bar was 3.0 and 1.5%, guessed before any of that was measured, and it let
two of the five through. It sits in the gap now.

Round A of six. Next are the generators.

---

**Two generators, and four checks that were checking nothing**

`weave` makes index-grid blankets — all fourteen of Quilt's styles. `zigzag`
makes interlocking rounded stripes, all six of Zig's. Both are after PLAYGRND tools, and both carry the one
change that turns a picture into a brand pattern: **every period is an exact
divisor of the tile**. A style asks for a rib every eleven cells on a
forty-eight cell tile and gets twelve, because a pattern that nearly repeats is
worse than one that obviously does not.

Which makes seamlessness a thing to *prove* rather than look at. A weave style
is `cellAt(x, y)` — an integer expression defined outside the tile as well as
in it — so the test asks for the cell at (x, y) and at (x + C, y), for fourteen
styles, nine cell counts, four coarsenesses, three seeds, in both directions.
Same value or not. A zigzag boundary is a chain, and a chain has to come back to
itself down its own run and land exactly one tile over after a whole number of
stripes. Both arithmetic, both exact.

**Then the checks. Every one of them was wrong first, and each was wrong in a
way that let something through.**

*The seam check was measuring the renderer.* It laid the tile out as an SVG
`<pattern>` filling a rectangle — what a designer actually does — and that is
the wrong instrument, because a renderer draws `<pattern>` by rasterising the
tile once into its own bitmap and repeating it, and the bitmap's edges are
antialiased against nothing. Stripes with a period of ten on a hundred-unit
tile, seamless by arithmetic, read 2.88 against a bar of 4. Now the tile is
drawn nine times into one surface and rasterised once: the same stripes read
0.00.

*Then it was calling every edge a seam.* The change between neighbouring pixel
columns is bimodal — almost every column is flat and a few are the edge of a
shape — so a seam landing on an edge is invisible and an edge landing on the
seam scores three standard deviations while being nothing. It also missed the
other kind entirely: stripes at a period of thirteen leave a gap of nine at the
join, every transition there is an ordinary edge, and what is wrong is the
rhythm. Smoothed over a band an eighth of the tile wide, both kinds read as the
same number.

*`ricrac` seamed at eleven standard deviations with exactly periodic
arithmetic.* A stripe is a closed polygon — one boundary down, the next back up,
a straight edge across each end — and those end edges meet the chain at a corner
that gets rounded like any other, making a notch that exists nowhere else in the
run. At the tile boundary two notches meet. The chain runs a whole tooth past
each end now, so the caps fall outside the clip.

*And a helper that did nothing.* `divisorNearEven` kept brick and block counts
even, on the reasoning that a colour alternating on a parity flips where the
tile meets itself. True of a grid walked from zero to C; untrue of this one,
because every style wraps its coordinates first, so the tile *is* the period.
Both checks agree — the values repeat at every count, and the seam reads 1.00x
for an odd count against 0.89x for an even one. It is gone rather than left in
looking careful.

**Two styles that were one picture.** `teeth` was a triangle wave and `stairs` a
square one sampled twice per tooth, and the straight lines between samples
turned the square into the same trapezoid — two rows of a rounding sweep that
were identical. And `waves` and `scales` were both destroyed by sending an
already-smooth curve through the corner-rounder at a radius the size of the
sample spacing, which turns a wave into a column of lozenges. Six styles are six
shapes now, and a test compares their fingerprints rather than trusting the
names.

**What makes it this identity's pattern.** Three measurements off the mark —
how many of its own narrowest runs it is across, what share of its outline is
curved, which way it runs — and one rule that sets the scale of both generators:
**nothing is drawn finer than twice the thinnest thing in the mark**. A pattern
printed beside the mark at the size the mark's own floor allows cannot then be
the thing that fails first. Where a mark is heavy enough that the rule would
leave under four stripes in a tile, a cap overrules it, and the manual says the
cap decided rather than the mark.

    32 identities, each choosing for itself
      9 of the 14 styles reached
      32 different tiles — no two identities got the same one
      worst join 1.00x — no tile reaches even the most unusual band
      its own pattern already contains

Every package now carries both kinds: the mark tiled seven ways, and one
generated tile per generator per colourway, with the parameters in `brand.json`
so any of them can be rebuilt or changed.

Round B of six.

---

**The studio, in the package**

A brand package is a folder of finished files: whatever the engine decided,
frozen. The pattern is the one part of an identity a client genuinely keeps
making — a quieter one behind type, a louder one on a van, a finer one for an
endpaper — and handing over twelve SVGs makes every one of those a phone call.

So the parameters ship, not only the pictures. `pattern-studio.html` goes into
every package beside `editor.html`, and it runs the same generator files this
build ran, starting from the parameters this build chose. One file, 86 KB,
nothing fetched, opens from a drive in five years.

It has the generators and their controls, every colourway the project declares,
SVG and PNG export at any size, and a strip along the bottom of the client's own
kept variations. It says **why** the engine chose what it chose, in the same
sentence the manual prints. And it says the size the pattern holds from — the
one rule it will not quietly let go of:

    Holds from 48 px and 12.8 mm, which is the size the mark itself
    holds at or larger.

Push a control past what the mark allows and that becomes a sentence rather than
a refusal. The client owns the identity; an engine that silently overrules them
is worse than one that tells them what they are doing.

**The claim worth checking is that it is the same drawing.** Two copies of a
generator is two patterns waiting to disagree, and this is exactly where that
would happen: the build draws through the SVG recorder in Node, the studio
through the same recorder in a browser. So the modules are UMD and the studio
inlines the files themselves — a test finds each one byte for byte in the HTML,
exactly once — and another loads all seven into a bare sandbox with no `require`
at all, draws a tile, and compares it with the tile Node draws. Same bytes.

`test/studio-check.mjs` builds a package and drives the file in Chromium: switch
generator, move a slider, change colourway, keep one, reload. Eighteen things
measured, including that the tile on screen has the same shapes as the tile in
`07-pattern/`, that nothing is fetched, and that nothing throws.

**And two things it caught.** Not carrying the engine's parameters across when
you switch generator leaves the new one holding a style it does not own —
weave's "plaid" handed to zigzag, which falls through to a straight stripe and
looks deliberate. "It drew something different" passes that, so the check now
asks whether the parameters *belong* to the generator showing. And the ban on
clocks in `src/patterns/` fired on the studio, correctly and too widely: it
stamps a download filename, which is not artwork. The exemption is one file,
one line, and the test checks it stays that narrow.

Round C of six. Next are the field generators.

---

**A bug report, from use: "Build the package" answered with a require()**

    require() of ES Module /var/task/node_modules/@exodus/bytes/encoding-lite.js
    from .../html-encoding-sniffer.js not supported. Instead change the require
    of encoding-lite.js to a dynamic import()

True, and it names two files nobody outside this repository has heard of.
Three faults.

**The engine needs a Node it never asked for.** jspdf, svg2pdf and jsdom's
dependencies are ES modules loaded with `require()`, which Node learned in
22.12; the manifest said `>=20`, so the host gave it one that cannot and the
first PDF killed the build. There is nothing to retreat to — every recent jsdom
reaches an ES-only package, and `svg2pdf.js` ships a UMD bundle inside a
`"type": "module"` package. It asks for `22.x` now.

**And nothing asked whether it could, before starting.** A version is not the
question, because the flag that turns the feature off is real. `pdf.js` asks
`process.features.require_module` before it builds a DOM, and says the answer in
the same what/why/how the rest of the engine refuses in.

**And the door threw away the reason it had been given.** `fail()` looked for
`e.finding` — what the door's own refusals carry — and an error the build raised
carries `e.findings`. Every build failure in the hosted app fell past it to the
branch that puts the raw message in the headline and replaces the why and the
how with two sentences about the engine stopping. The reason was on the error
the whole time.


---

**The field generators, and a texture that was aliasing**

Three more: `field` (pixel compositions, after Oddgrid), `thread` (flowing line
fields, after Filament) and `terrace` (posterised contour bands, after Terrain).
Five generators, 27 styles. Every package now writes a tile per generator per
colourway.

This is the round where the noise built in Round A gets used for what it was
for. `weave`'s styles are arithmetic on a cell index and repeat because the
index repeats. These sample a continuous field, so the field itself has to come
back round — and the same 4-D trick that closes an animation loop closes a tile.

**`terrace` looked wrong, and "wrong" is not a bug report.** Five octaves on a
field of period 3 puts the finest octave at 48 cycles across the tile, sampled
on a lattice of 24 cells. Half a sample per cycle. It was not being drawn
coarsely, it was being *aliased*, and aliasing a smooth field gives speckle —
which looks like a deliberate texture rather than a fault, which is why it
nearly shipped. Nyquist is not a matter of taste: two samples a cycle or it is
not there. The octave count is now derived from the lattice, and the check
proves the cap actually binds, because a cap that never binds is a comment.

**`thread` had a real join — 2.09 times its own worst ordinary band — and most
of the diagnosis was wrong.** The nine-times-over draw meant to catch strands
leaving the edge measured as doing nothing, and came out. Path length was
conserved. Caps, overshoot and the clip made no difference. Drawing with one ink
removed the join entirely, which said the fault was in *what colour went where*,
not in the geometry.

So the field's period was swept, four styles by four identities at each scale:

    cycles across the tile   1     2     3     4     5     6     7     8
    joins that stand out    3/16  4/16  0/16  1/16  8/16  5/16  0/16  3/16

The lattice has its nodes at whole fractions of the tile, so the tile's edge is
always a lattice line — and where the field's largest feature sits on that line,
every copy shows a band down every join. Nothing is discontinuous and nothing is
lost. The feature is simply there, in every tile, at the same place.

Two of the eight are clean, and I have no derivation for which two: the obvious
guess, that it is the odd periods, is wrong, since 5 is odd and is the worst of
the eight. What there is, is sixteen measurements at each scale. So the scale is
not a slider — it is two chips, `open` and `close`, at periods 3 and 7.
**2.09x to 1.47x.** An offset fitted first was removed: it made the number
smaller without making the claim true.

**And one generator is not vector, on purpose.** A field warped, dithered and
quantised into bands is a decision taken per pixel; the honest vector form is a
hundred thousand polygons nobody wants to open, and the dishonest one quietly
stops being the picture the studio showed. `terrace` ships as PNG at a stated
size, `brand.json` carries `vector` and the printed millimetres per tile, the
read me says how many are raster, and the studio disables the SVG button and
says which kind you are looking at. A client needs to know this one has a size
beyond which it stops being sharp. Hiding it would be the fault.

    07-pattern/thread-brass.svg     vector       570 KB
    07-pattern/terrace-brass.png    raster  2400 px, 203.2 mm at 300 dpi

**Where a cap overrules the mark, it says so.** The scale rule is that nothing
is drawn finer than twice the thinnest thing in the mark. Two identities are
fine enough that it stops being useful — pagrin at 167.3 of its own narrowest
runs across, hallward at 266.7 — and they ask for grids of 80 and 132 cells.
A tile of 132 cells is a texture rather than a pattern. Four limits are named, and where one binds it
is audible in the sentence the manual prints: *"which would ask for a grid of
132 — finer than anything anybody prints. It is held at 108."* A judgement about
what the word "pattern" means may overrule a measurement. It may not do it
quietly.

**And a defect the read me found, not the suite.** Counting how many styles the
32 identities reach — for a table in this file — printed `field/undefined` once,
among names like `weave/basket`. `derive` looked the look up by name, spread the
preset that name pointed at, and dropped the name. Nothing threw and every tile
drew correctly, because the preset carries the numbers; but `params.style` was
undefined for that one generator, so the studio showed no chip selected and
brand.json recorded no look. A value that is only ever spread into an object is
invisible until something asks it for its name. All five generators are now
asked it, against all 32 identities. Two notes on getting there: the first
reversion of that check *passed*, because I reverted a redundant clause rather
than the fault; and I wrote it as its own test, which cost the suite 25 minutes
building 160 tiles that the very next test already builds. Folded into that
loop it costs nothing. A check earns its place by what it catches, and should
not also charge rent.

Seven reversions, seven caught. Running the suite takes the better part of an
hour, so `test/run.js --only <text>` now runs a named subset — and prints a
banner, so a subset can never be read as a pass.

Round D of six. Next is matching: measuring a client's own pattern and
regenerating it in this system, and matching the logo when there isn't one.


---

**Measuring a pattern, and matching one the client already has**

If a brand arrives with a pattern of its own, the engine does not trace it. A
trace of their pattern *is* their pattern, redrawn: it cannot be recoloured for
a second colourway, re-scaled for a bag after being drawn for a letterhead, or
regenerated at all. So it measures theirs, generates one of ours, measures ours
the same way, and prints both columns — a claim anybody can check.

    Yours                Ours
    Repeats every        96 px          96 px
    Repeats across       8              8
    Ink                  45%            53%
    Runs at              135°           116.3°
    Edges over           4.4 px         1.1 px    beyond what this engine draws
    Repeat or tendency   a repeat       a repeat

Six measurements: palette, scale, orientation, coverage, regularity, edge
hardness. Every one is proved against a picture built to have a known answer.
Three were wrong first, and each was wrong in a way that looked right.

**Hardness counted edges instead of measuring them.** Asking what share of a
picture's change sits in its steepest tenth is a count of *how many* edges there
are wearing the name of *how sharp* they are — identical knife edges read 0.56
at period 40 and 0.93 at period 200. Sharpness is a local shape, so measure it
locally: curvature against slope is about 1/k for a transition k pixels wide.
Ramps built 1, 2, 4, 8 and 20 px wide now measure 1.0, 2.0, 3.9, 7.7 and 14.2 —
the number *is* the width — and four different periods of the same hard edge all
measure exactly 1.

**Sampling a pattern on a lattice lands on one phase of it.** Red dots one pixel
in four, sampled every second pixel, came back 100% red and 0% white; a
ten-column pattern's ink share came back at exactly double. A pattern can be
relied on to be in step with any lattice laid over it.

**The scale measurement picked its axis by which correlated highest** — and
stripes running down correlate *perfectly* at every vertical lag, because
sliding a column of one colour down changes nothing. That scored 1.00 against
the real period's 0.97. Whether a peak was found has to decide first.

**What twenty runs say about the matcher.** Hand each generator its own output
back and ask which drew it, over two identities at two resolutions: weave and
zigzag come back right every time by margins of 0.026 to 0.465; field, thread
and terrace come back right seven times in ten by margins of 0.004 to 0.021. So
the claim is not "the matcher names the generator" — the two hard-edged ones are
recovered exactly, and the three field generators are one family under these six
measurements, with the winner among them inside the noise. That is a property of
the measurements, not a fault in the search, so the engine reports every
generator that ties and the tests assert only what those runs support.

**And a wall is not a near miss.** Every one of the five generators draws with a
knife edge — the softest any reaches is 0.91 where a step is 1.00 — because all
five quantise, to a cell, a stripe, a stroke or a band. A soft reference loses
that row against every generator, every time, and a score alone hides it. The
table names it: *"none of the 5 generators draws an edge that soft… yours
softens over 4.4 px; the softest this engine draws is 1.1 px."* A client whose
pattern is an airbrushed gradient should be told this engine does not draw one.

**Against a logo the rows are different.** A mark is one drawing, not a repeat,
and its ink share is the share inside its own box: kvist's mark is 6% ink, and a
pattern at 6% ink is an empty page. Matching those rows drove every sparse mark
to the same answer at 0.40; scoring a logo on what a logo has takes it to 0.14,
and the rows that were not scored say so rather than reading as misses.

**In the package.** `assets.patternReference` takes a PNG or an SVG, read as
bytes and never normalised — every other asset is artwork the engine redraws and
ships, and a reference that has been tidied is no longer the thing being
matched. The build measures it and uses the matched generator and parameters in
every colourway, while the other four keep what the mark chose. `brand.json`
carries the whole argument. **salvage** is the thirty-third identity and the one
that brings a pattern of its own: its mark alone chooses `terrace`, and its
reference makes the package choose `weave`.

**The manual finally has a page for it.** Rounds B to D put five generated
patterns into every package, into `brand.json`, into the read me — and into no
manual. The client was handed artwork with nothing saying where it came from.

Two things that had gone vacuous, both caught by reverting rather than by
reading. The fixture agreed with its own mark by accident, so the reversion for
"let the mark decide anyway" passed twice looking exactly like a check with
teeth; the fixture's mark was redrawn until the two genuinely disagree. And the
manual check went through a fixture whose chosen generator happened to be first
in the list, so "name whichever is listed first" passed — that claim is asked of
the block directly now, with a list whose first entry is deliberately not the
chosen one.

Round E of six. Next is the last one: the front-door step and the editor block.


---

**The pattern, where the client actually changes it**

The last round of six, and the one that makes the pattern a thing the client
keeps using rather than a folder of files they were sent.

**Three things can decide the pattern, and they are in an order.** A person who
opened the studio and chose one beats a picture the brand already had, which
beats the artwork. A project that sets `system.patterns` is not asked again —
the reference is not even measured, which saves the thirteen seconds the match
costs and, more to the point, avoids producing an answer that is then discarded.
The read me and `brand.json` say which of the three decided, and the tile's own
reason says it in words.

The studio prints exactly what goes in `project.json` and nothing else. It used
to print the colourway alongside; that is not part of the decision — a pattern is
chosen once and drawn in every colourway the project cuts — and pasting it back
would have meant "this pattern, and only in this one colour", which is not what
anybody meant by copying it.

**And the pattern can be retouched on the page it is on.** `editor.html` has a
generated-pattern block now, because exporting, reopening the studio,
re-exporting and re-importing is not a way to lay out a guide. The canvas
carries the pattern engine — the same ten files the build drew `07-pattern/`
from and the same ones the studio carries, byte for byte, checked to appear
exactly once. Two copies of a generator is two patterns waiting to disagree, and
the canvas was the third place one could have hidden.

It is still one decision. The parameters live on the document rather than on any
one block, so retouching one changes every generated pattern in the document and
the panel says so. A brand pattern that is different on page 4 from page 9 is
not a brand pattern, and a canvas that quietly allowed it would be handing
somebody a way to break their own system. Driven in Chromium: place two, retouch
one, both follow, it lands on the document, and it survives a reload.

    ok    a generated pattern can be placed        terrace, ridge | terrace, ridge
    ok    retouching one retouches every one       weave, diamond | weave, diamond
    ok    and it is still there after a reload     weave, diamond | weave, diamond

**And a hole a check found.** The first version of the block reached for
`window.PatternEngine` — the engine in a browser, undefined in Node. The canvas
looked right the whole time, and every published document would have had a hole
exactly where the pattern was, because this renderer draws the canvas *and* the
page `publish.js` writes. A check called "every block type renders without a
DOM", there since long before any of this, said `generated did not render`.

The canvas is **handed** the recipe rather than working it out again — the same
fault the manual page had, one file along. Re-deriving from the mark gives
salvage `terrace` while its reference chose `weave`, so the canvas would have
drawn a pattern that appears nowhere else in the package. The check asserts
those two disagree for that fixture, or it would be proving nothing.

Six reversions, six caught. That is six rounds of six: the surface contract, two
generators, the studio, the field family, measuring and matching, and the two
places a pattern is changed.


---

**The three limits, closed**

Two of the three things the last round ended on turned out to be faults rather
than limits. The third is as closed as I can close it from here.

**A soft edge.** Every generator quantises, so the softest edge any of them drew
measured 1.0 px where a knife edge is 1.0 — and a client with an airbrushed
pattern could be told only that this engine does not draw one. Softness is
native to exactly one of the five: a contour map with the contours blurred is a
relief map. Three things then had to be measured rather than reasoned about.
Dither is grain, and grain holds the edge at a pixel whatever the bands do.
Contrast is the lever and runs the opposite way to intuition — 1.0 px at 0.28
and 7.2 px at 1.68 — so my first guess made the new look *harder* than the one
it replaced. And a wash is a look, not a slider: it is a slow field and few
bands and no grain and full softening, and no one of those alone is a wash, so a
search that moves one knob at a time correctly took none of them.

Which exposed the actual fault. A style's own settings **never reached the
planner** — `derive()` sets bands, dither and scale for every identity and the
caller's value wins — so choosing the soft look gave 1.1 px, exactly as hard as
the look it replaced. The engine was reporting that it could not draw a soft
edge while holding the style that does. Same fault `field` had with its own name
two rounds ago: a value that exists and never reaches the place that uses it.

    ridge 1.0 px · strata 1.0 · basin 1.0 · drift 1.0 · wash 6.3 px, soft

A soft reference now matches that row exactly: theirs 2.2 px, ours 2.2 px.

**And it broke a table in a way worth keeping.** Salvage's reference is soft
*and* repeating, and the engine can do either but not both. The row went from
"beyond what this engine draws" to nothing at all — 4.4 px printed beside 1 px,
unmarked, which reads as a match. A row nothing can reach, a row this match
missed, and a row that landed are three different things to tell somebody.

**Telling the three field generators apart.** Six measurements put `field`,
`thread` and `terrace` in the same place while they look nothing like each
other, which is a missing axis rather than a weak search. Two were added: how
thick the ink is (area over half its boundary, which is the width of a run
whatever the shape does elsewhere), and how much of the change lies on the two
axes.

    across eight identities   thickness        axiality
    thread                    3.3 – 9.1 px     0.05 – 0.71
    terrace                   5.7 – 38.1       0.02 – 0.12
    field                     17.5 – 68.1      0.77 – 0.96

Thread is thin and field is not, with nothing in between; field is square to the
page and terrace is not, with nothing in between. The same twenty runs that
recovered the right generator seven times in ten now recover it **twenty times
out of twenty** — family margins 0.031 to 0.158, up from 0.004 to 0.021. It
costs 35 seconds a match instead of 13.

**The two translations I cannot read.** Still true, and not fixable from here.
What is checkable is whether they introduce a second word for something the
dictionary already has a word for — the failure a non-reader is most likely to
ship and least likely to notice. There is a check for that now, and it caught
one: the Japanese for ink here is 墨, in three existing strings, and my new table
row said インク. Two words for ink on facing pages of one manual. The machine
part is done by machine; the rest still wants a reader.

---

**A texture is not a pattern, and three numbers are not a logo**

Two rounds of pattern work landed and then the brief arrived, which is the
right order for a brief to arrive in. Four decisions came out of it, and all
four were about the same thing: a pattern has to be *of* the identity, not
merely *derived from* it.

**`terrace` is deleted.** It made posterised contour bands after Terrain and it
was the engine's only raster generator. Six rounds went into it — a Nyquist cap
on octaves, dither hashed on the wrapped cell so the grain tiled, a soft `wash`
ground reached by coupling two knobs worthless apart, a rule that sized the
file to what the picture was worth. None of it was wrong and all of it was
beside the point: a posterised noise field is a *texture*, and it carries
nothing of the identity that made it. Asked whether to demote it or delete it,
the answer was delete — a generator the engine is told never to choose is a
generator nobody maintains. Every pattern is vector now, so no file in a
package has a size beyond which it stops being sharp, and there is one fewer
caveat to print about a client's own artwork.

**The five generators only ever knew three numbers about the logo.** How fine
it is, how much of it curves, how wide against tall. That is enough to set a
scale and pick a style, and it is not enough to make a pattern anyone would
call theirs. The mark-tiler has read the actual shapes since the first round —
it ranks every shape in the drawing by how well it carries a repeat, and its
`lines` construction is rules at the weight the mark is drawn in while `arcs`
is quarter turns at its own curve — but nothing generative could reach them.

So the shape is now something a generator can draw. `motif-read.js` parses it
once, in Node, into move-line-cubic through `paths.js` — the same reduction the
print path already makes, for the same reason every drawing system agrees on
those three. The result travels in `brand.json`, so the studio redraws it
offline a year later with no SVG anywhere near it, and the generator has no
branch for what kind of shape the client happened to draw.

**Which a screenshot caught three bugs in, and no measurement would have.**
Eight marks read; five looked right. `salvage` and `carrock` are rings drawn as
*strokes*, and filling their paths turned them into solid blobs. `deben`
reported six moves and drew nothing, because an open path with no enclosed area
fills to nothing. `pattern.js` has answered fill-or-stroke since the tiler was
written; the fix was to read its answer rather than form a second one.

**Three routes, and the eighth question.** `literal` is the mark's shapes
repeated. `motif` is a generated ground whose cells hold the mark's own shape.
`inspired` is generated from what the mark measures, in new geometry.

(Two of those three were the same package for a while. See **A question with an
answer nobody read** below.) The
engine can measure a drawing; it cannot measure how closely a client wants
their pattern tied to their logo. That is a brief, not a fact about the
artwork, and it was the one thing about the pattern nobody was asked while the
whole engine turned on it. The door asks seven questions — eight now, and the
count is the guard rather than the rule. The rule is that nothing is asked
which can be measured.

**Two generators can hold a shape and two cannot**, which the route is told
rather than allowed to fudge. `zigzag` is interlocking stripes and `thread` is
streamlines: neither has a cell to put a motif in, and handing them one
produces a tile identical to the inspired route under a name claiming it is
made of the client's logo. So the motif route narrows to `weave` and `field`.
Both are still built and still in the studio.

**`weave` was placing the motif where three of its styles have nowhere to put
it.** It puts the mark on the cells its own arithmetic already made the accent
colour, which is the right place — sparse, spread by the style's own
reasoning. Except `basket`, `zigzag` and `waves` have 0.0% accent cells at some
settings, so the motif would never have been drawn while the tile went on
saying it was made of the client's mark. Below a floor the placement falls back
to a hash. A pattern that quietly is not what it claims is worse than one that
is plainly something else.

**And one thing is deliberately left open.** `field` on the motif route reads
busy — the mark ends up sitting on a speckle, so it looks like camouflage with
a logo in it rather than a pattern made of one. The motif is not the problem:
`field` samples three noise fields per cell whatever route it is on, which is
the thing this round was told to stop making. Whether `field`'s looks belong at
all is a decision about what that generator is for, not about how a motif is
placed, and it is not smuggled in under a change about placement. For now the
route prefers `weave`, and `field` is kept for marks too fine for weave's
cells.

---

**Two generators, and what that costs**

`field` and `thread` follow `terrace`, for the reason `terrace` went. Each of
the three sampled a noise field. `field` made pixel compositions after Oddgrid
— five looks, three periodic fields per cell, and one lerp pulling cell
coordinates towards the middle of a block so the composition gathered into
patches instead of dissolving. `thread` made line fields after Filament: a
direction field of two noise samples, strands dropped in by bundles and
integrated forward a few hundred steps each, nothing drawn and all of it
consequence. Both were good work. Both made a texture rather than a pattern —
something carrying nothing of the identity that made it beyond three numbers
off the mark.

`field` on the motif route was the proof, and it is why I raised it rather than
waiting to be told: handed the client's own shape, it put it on a speckle, so
the result read as camouflage with a logo in it. The mechanism was right and
the ground was wrong.

What is left draws shapes — a cell grid and interlocking stripes — and one of
them holds the mark itself. **Twenty styles between them**, fourteen and six,
plus nine constructions in the mark-tiler and the motif, which is different for
every logo that arrives.

**And the rule got shorter, which is the part worth noticing.** It used to key
on curviness and fineness both, and send a curved mark to a line field. There is
no line field. `zigzag` answers curviness with its own rounding rather than by
being a different generator, so the rule is one line: enough detail to fill a
grid gets a grid, a mark drawn in few heavy parts gets stripes, because a grid
of eight cells is a chequerboard and not a pattern.

**Two measurements stopped deciding anything, and were kept anyway.** `weight`
and `axiality` were added because the six could not separate the three
noise-field generators. All three are gone, and the two that remain were
separated by the six all along — measured with these two weighted in and with
them zeroed, the matcher recovers both generators eight times out of eight.
Normally that is a deletion. They stay because `columns()` prints them for the
client: how thick their pattern's ink is against ours, how square to the page
each runs. A number somebody can check by looking at the two pictures beside it
earns its place whether or not the search needs it, and the difference between
*load-bearing* and *true* was worth writing down once.

One claim did have to shrink. Thickness no longer separates anything — weave
measures 12.2 to 46.2 px across six identities and zigzag 7.8 to 27.1, which
overlap. Axiality still does. The test now asserts the smaller claim and records
the overlap, so nobody reaches for thickness later believing it discriminates.

---

**The stripe, taking its character from the mark**

`zigzag` could not hold a motif — interlocking stripes have no cell to put a
shape in — so on the motif route it was simply not offered. The other way to
make a pattern *of* an identity is to take the drawing's character rather than
its shapes, and that meant measuring something the engine had never measured.

**`curviness` counted path command letters.** The file said so in its own
header: "a crude measure of a real thing". It was cruder than that. A `<circle>`
scored four curves whatever its radius. A rounded rectangle scored four curves
and four lines whether its corners were a hair or a half-stem. And **yamabiko —
a drawing of mountain chevrons, with no curve anywhere in the file — scored
0.50**, so every pattern it was ever given carried half a pattern's worth of
rounding it had never asked for.

`winterbourne` is the same error the other way: an arc over four straight bars.
The bars are separate strokes that meet nothing, so every turn in that drawing
is on the arc. It scored 0.20 and got a nearly-sharp stripe.

So it is measured off the geometry now — every place the outline changes
direction, how far it turns there, and whether it turns on a curve or at a
point. Yamabiko reads 0.00 and winterbourne 1.00, which is what anybody looking
at them would say. Across the repository the two measures disagree by more than
0.3 on eight of the thirty-three marks, and every disagreement resolves in the
new one's favour when you put the drawing next to the number.

**And tooth depth was the number 0.9, for every identity.** Stripe came off the
scale rule and rounding off curviness; depth — which is most of what a zigzag
looks like — came off nothing at all. It now comes from the radius the mark
turns at: a drawing that turns inside a couple of its own stems is making tight,
worked gestures and gets a tooth that cuts; one that turns over six or more is
making broad ones and gets a tooth that leans.

Two things had to be right and neither was obvious. **The radius is a median
weighted by turning, not a mean** — pagrin turns 91% of its total at hard
corners and averages 31.7 stems, because the remaining 9% happens on two
enormous sweeps, so a mean sends the most angular drawing in the repository to
the shallowest tooth there is. And **a drawing whose strokes never meet has no
turning to measure** — deben is three bars that do not touch, and the answer
there is not "no corners were found, so it must be round".

Five reversions, five caught — but only after the fifth was written properly.
The median-versus-mean reversion passed the first time, because tooth depth is
monotone in the radius whatever the radius says, so a test that only checks the
ordering cannot see it. What catches it is the claim the median is actually for:
every mark that turns mostly at a corner cuts 1.15 where the roundest cut 1.05
at most. On a mean, hallward cuts 0.6 against cusp's 0.96, and the check names
them.


---

**A question with an answer nobody read**

The eighth question went in at the door, the answer went into the project file
and into `brand.json`, and then it was handed to `suits()` — which cannot answer
"literal", because literal is not a generator. It is the mark-tiler. So the
route was recorded and read by nobody, and **a client choosing "made of the
logo" got the same package, byte for byte, as one choosing "in the spirit of the
logo"**. Three options and two answers, which is worse than two options.

Every test asked whether the route reached `brand.json`, and it did. None asked
whether it changed anything. The two builds' `07-pattern` folders were
byte-identical and nothing was looking.

It surfaced because the examples were built. Three logos, three routes, nine
packages — and the same tile came out of two of the three columns.

The fix is one decision the build was missing: **which of the two families is
this identity's pattern.** Both are always built — the mark-tiler's, from the
shapes in the drawing, and the generated ones — and until now nothing said which
was which. `brand.json` carries `primary` now, and the read me leads with it,
because a client should not have to work out which of two chapters is theirs.

    literal    The pattern     built from the shape marked in the master...
                               This is the one you asked for at the door.
               And generated   8 tiles in 07-pattern...

    inspired   Also drawn      built from the shape marked in the master...
               The pattern     8 tiles in 07-pattern...

The test builds one identity three ways and asks whether the packages differ. A
check that a value was written is not a check that it was used, and that is the
general form of the mistake rather than a detail of this one.

**And the gates run one after the other now.** They used to run together, and
the container killed the suite: 12.3 GB of anonymous memory against the cgroup's
limit, at test 121, with no failure and no summary — just a process that stopped.
A suite that dies silently is worse than one that fails, because the run looks
like it is still going. Sequential turned out to be *faster* in wall-clock terms
as well: 26 minutes against the 50 the parallel run was taking before it died.
