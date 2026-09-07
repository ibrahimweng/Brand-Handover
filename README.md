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
`site/out`, and put `api/inspect.js` and `api/build.js` on the two endpoints the
page calls. They are wrappers — the work is the same `engine/src/app/handlers.js`
the local server calls, so the hosted app and the one on your own machine cannot
answer differently.

One thing does differ, and the page says so rather than hiding it. A serverless
function has no filesystem it can share with the next request, so a hosted build
cannot serve a package file by file the way the local server does. It sends the
zip — the package, compressed, in one answer, about 300 KB for a plain identity
— and the browser opens the documents out of it. They open in a tab; they will
not survive a reload, because they live in the page's memory. Run it yourself
and they get real URLs.

`/gallery/` is every identity in `engine/projects/`, each built to break the
engine a different way — thirty-one of them at the time of writing, and the count
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
138 files: every lockup in every colourway as SVG, PDF, `.ai` and PNG, icons,
favicons, social crops, the brand pattern at every density, `brand.json`, the
manual, the deck, a self contained canvas editor, and any document published out
of it. 368 tests.

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

Still to do: that run on **your** identity job, which this is not. A third
language: `en` and `fr` are two, and two is enough to prove the mechanism is a
mechanism, but the first non-Latin one will find things neither of these could.
And the canvas is answerable for itself now, but a screen reader has still never
been pointed at it: what it says is measured, how it sounds is not.
