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
136 files: every lockup in every colourway as SVG, PDF, `.ai` and PNG, icons,
favicons, social crops, the brand pattern at every density, `brand.json`, the
manual, the deck, a self contained canvas editor, and any document published out
of it. 275 tests.

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

Still to do: a run on **your** identity job. Seven identities the engine had not
seen is worth a great deal more than seven passes over one, but none of them
came out of your exporter — and the normaliser is the part that most needs to
meet one.
