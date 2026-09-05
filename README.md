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

## Status

The engine runs. `engine/` takes one master SVG and a project file and writes
138 files: every lockup in every colourway as SVG, PDF, `.ai` and PNG, icons,
favicons, social crops, the brand pattern at every density, `brand.json`, the
manual, the deck, a self contained canvas editor, and any document published out
of it. 332 tests.

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
applied to every image by rule, drawn with an SVG filter rather than baked into
the file, so changing the recipe changes every picture in every document. The
editor then measures the mark against the treated pixels and works out the
scrim strength that particular photograph needs, which is the thing an opacity
slider is usually guessed at.

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

Still to do: a run on **your** identity job. Fourteen identities the engine had
not seen is worth a great deal more than fourteen passes over one, but none of
them came out of your exporter — and the normaliser is the part that most needs
to meet one.
