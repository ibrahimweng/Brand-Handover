# Mark to handoff

A build plan for one web application that covers tools 2, 3, 4 and 5 from the
brand designer brainstorm.

You upload the approved mark once. Every variation, the guidelines, the client
presentation and the delivery package are derived from it. Change the mark and
all three documents change, because none of them holds a copy.

| Decision | Choice |
|---|---|
| Tools covered | 2 (variations), 3 (guidelines), 4 (presentation), 5 (delivery) |
| Runs as | A web app |
| Editing | Full canvas editor |
| Built for | Pagrin first, sold as a product later |
| Estimate | 26 weeks for one person |

## 1.0 What the system is

The four tools are not four products. They are four readers of the same
project, which is why they were the right four to pick. All of them sit
downstream of an approved mark, so all of them can be derived from it.

The project holds the master SVG, the tokens for colour, type and spacing, the
rules for clear space and colour schemes, your written words, and any mockup
images you drop in. From those, the system derives about 80 files, covering
every lockup in every colourway, at every size and in every format.

The guidelines, the presentation and the delivery package all read from the
project and from that derived set. None of them stores a colour value or a copy
of the mark, so none of them can go out of date.

Compare that to what you do now. A folder of exported files goes stale the
second you re-export, and then you have two folders and no way to tell which one
is right. A project cannot go stale, because there is only one copy of the truth
in it.

## 2.0 The decision that makes the canvas work

You asked for a full canvas editor. That forces one choice early, and it is the
choice that most tools of this kind get wrong.

If the canvas draws with one engine and the PDF is produced by another, the two
will disagree. Text wraps in a different place, spacing shifts by a point, and
you spend the rest of the project chasing differences between what you saw and
what printed.

So the canvas edits real HTML in the browser. The published guidelines page is
that same HTML. The PDF is that same HTML printed by headless Chrome. One
renderer, three outputs, nothing to keep in sync. This removes a whole category
of bug rather than managing it, and it is also why the canvas editor is
affordable at all.

The one cost is that Chrome writes PDFs in RGB and a printer wants CMYK. That
matters for a guidelines document going to a press and for nothing on a screen.
The fix is a second path built later using Typst, which handles CMYK natively
and compiles a page in 200 to 500 milliseconds. It reads the same project, so it
is an extra output rather than a second system. Do not build it until a client
asks for print.

## 3.0 What exists, and where we go past it

### Tool 2. Lockup and variation generator

**Best today.** Logo Package Express, an Illustrator extension that writes over
200 files in under five minutes, generates every colour variation in one action
including Pantone, CMYK and RGB, and produces a clean named folder structure.
Users report roughly 45 percent more output. Standards also generates colour
variations from an uploaded SVG.

**Where it stops.** It lives inside Illustrator, so it is a step in the process
rather than the spine of it. The output is a one time export. Run it again after
a revision and you have two folders and no way to tell which is current.

**Our move.** Variations are never stored. They are derived on demand from the
master, so there is exactly one correct set at any moment and the two folder
problem cannot happen. They also feed the guidelines and the deck directly
instead of only a zip.

### Tool 3. Guidelines generator

**Best today.** Standards, with 10,000 users including NASA, Pentagram and
Rivian, which drafts the common sections from your assets. Brandpad makes the
most beautiful output. Frontify is the enterprise option and ships an MCP server
so AI tools can read the guidelines directly.

**Where it stops.** All three begin at the guidelines. You bring finished assets
and lay them out by hand, so nothing is derived and nothing updates itself.
Brandpad has no machine readable layer at all and is cloud only, so a client
loses the brand when offline. In every case the client inherits your
subscription.

**Our move.** Three things.

- Derive rather than lay out, so the clear space diagram, the minimum size, the
  colour chips and the variant grid are drawn from the project and are correct
  by construction.
- Ship a machine readable file beside the human page. Frontify moving that way
  is the signal.
- The client owns the export. A static site and a zip they keep forever, so if
  anyone stops paying the client still has their brand. That answers every
  complaint about lock in, and it will win you work.

### Tool 4. Presentation builder

**Best today.** Nothing. Pitch, Gamma and Storydoc apply a brand kit to a
generic deck, and the template shops sell static files you fill in by hand.

**Where it stops.** Those are deck tools that apply an existing brand. Not one
of them builds the deck that presents a brand for the first time, which is the
deck that wins or loses the project.

**Our move.** This is the open goal, and it is the reason to build the whole
system. The deck reads the same project, so the mark page, the colour page, the
type specimen and the variant pages generate themselves. You write the
rationale, which is the part the client is paying for. You drop your existing
mockup images into labelled slots. When the mark changes the night before, the
deck is right in the morning.

### Tool 5. Delivery packager

**Best today.** Logo Package Express again, with its Portal for client access.

**Where it stops.** Illustrator bound, and the portal is one more subscription
sitting between your client and their own files.

**Our move.** The packager is a view of the project rather than a separate step,
so it cannot disagree with the guidelines or the deck. It writes PNG through
resvg, true vector PDF through svg2pdf, and .ai files, because since version 9
an Illustrator file is a PDF wrapper that Illustrator will open.

## 4.0 How to build the canvas editor without losing a year

You chose full canvas editing after I said it was a multi year job. That is true
of a general design tool and it is not true of what you need, as long as you
hold one line.

You are not building Figma. You are building Keynote for brand documents. Fixed
page sizes, a grid, and a known set of blocks. The moment somebody asks for a
pen tool, the answer is that vector drawing belongs in Illustrator and the mark
arrives here finished.

**It has:** select, move, resize and snap to a grid, inline text editing on the
page, a properties panel per block, undo and multi select, and page templates
you can start from.

**It does not have:** a pen tool, vector point editing, boolean operations, an
infinite freeform canvas, arbitrary shape creation, or image editing beyond crop
and scale.

### The blocks are the actual product

There are three kinds of block. Plain blocks are text, an image, a rule and a
colour field, and they behave the way you expect.

Derived blocks draw themselves from the project. The colour chip row, the clear
space diagram, the minimum size diagram, the type specimen, the logo variant
grid, the contrast table, and the do and do not pair. You place one and set its
options. You never maintain it, and it is never wrong, because it is asking the
project rather than remembering an answer.

Rule blocks are the third kind, and they came out of building the specimen. You
make one creative decision, the system stores it as a rule, and from then on it
generates every instance without asking again. The brand pattern is the clearest
case. You decide that the pattern is the mark's own curve repeated in offset
rows. After that the system cuts every tile, every density and every colourway
from that one decision, and it checks each colourway against the contrast
results it already has.

The same shape applies to iconography, to motion and to brand architecture. In
each one you set the rule once and the system holds it. That is a third state in
the interface, not a second, so the editor needs to show three things about any
block: drawn by the system, set once by you, or yours.

A colour chip row in Figma is six rectangles somebody has to update by hand every
time the palette moves. Here it is one block that is always current. That
difference is the entire reason this is worth building rather than making a nice
template.

### Build it on the DOM, not on a canvas library

The usual advice is Fabric.js for design editors, or Konva when you own your own
data model, which you do. Both are MIT and both are good. Neither is right here.

A canvas library makes you rebuild text layout, text editing and selection from
scratch, and then hands you a picture that has to be turned back into a
printable document. On the DOM you get the browser's text layout for free, real
inline editing, and markup that prints straight to PDF. Your pages hold dozens
of objects rather than thousands, so the performance argument that normally
favours canvas does not apply.

Keep Konva in your pocket for one case only, which is if you later add freeform
application boards where somebody arranges many images at once.

## 5.0 The interface

You asked for something a beginner can use that is also advanced. Those two pull
against each other unless you stage them, so the rule is that power lives one
layer down and never on the surface.

1. **Three panes, learned once.** A project rail on the left, the page in the
   middle, properties on the right. The guidelines and the deck use the same
   three panes, so learning one teaches the other.
2. **The first run is a path, not a blank canvas.** Opening a new project gives
   you five steps: upload the mark, confirm the colours it found, choose the
   type, review the variations it generated, export. Every step is a real screen
   you can return to later. A beginner finishes a project without ever meeting
   the editor.
3. **Show the derivation happening.** When the mark changes, do not regenerate
   silently. Show what changed and count it. "84 files and 12 pages updated" is
   the moment somebody decides this is worth paying for. Never show a spinner
   with no number attached to it.
4. **Advanced, in a disclosure.** Every derived block shows three or four
   options and hides the rest behind more. Add a command palette and a keyboard
   shortcut for everything, so somebody's second week is faster than their
   first.
5. **Say exactly what happened.** A button that says Publish produces a message
   that says Published, with the link. An error says what broke and what to do
   about it, e.g., "your mark has 14 open paths, which will look wrong below 24
   pixels".
6. **One screen decides everything.** The variations review, where somebody sees
   80 files appear from a single upload for the first time. Spend
   disproportionate effort there.

## 6.0 The build

The order is deliberate. The two cheapest phases come first so that you have a
tool you can use on a real client before the risky phase starts.

| Phase | Work | Weeks |
|---|---|---|
| 0 | Project model and variations engine | 1 to 2 |
| 1 | Delivery packager and upload page | 3 to 5 |
| 2 | The canvas editor | 6 to 13 |
| 3 | Guidelines document and derived blocks | 14 to 18 |
| 4 | Presentation builder | 19 to 23 |
| 5 | Closing the loop and first run | 24 to 26 |

**Phase 0.** No interface at all. A command line that takes one SVG and a rules
file and writes the correct 80 files. You will know inside two weeks whether the
hard part works, and everything after this is built on it.

**Phase 1.** The first thing you can use on a real client. It is deliberately
before the editor so that an overrun in phase 2 still leaves you with a working
tool.

**Phase 2.** Pages, blocks, selection, move, resize, snap, inline text, the
properties panel, undo and multi select. Eight weeks because it is the one part
with no shortcut. Hold the scope from section 4.0 and it lands. Let it drift and
it eats the year.

**Phase 3.** The blocks that draw themselves, the page templates, publishing to
a live link, the PDF, and the machine readable brand file that goes beside them.

**Phase 4.** The same canvas with deck templates, the labelled image slots you
fill from your own mockups, and the export. Cheaper than the guidelines because
the editor already exists.

One thing this phase must not do is reflow the guidelines into slides. Building
both documents from the same specimen showed they are different documents rather
than two shapes of one. The manual is looked things up in, so it carries every
value and every edge case and nobody reads it start to finish. The deck is
presented, so it holds one idea a slide, keeps the argument and drops the
reference detail. A guidelines page has about four times the text of the slide
covering the same section.

So the presentation builder needs its own layouts and its own shorter content
fields, both reading the same project. It also needs slide types the manual has
no use for, which are the chapter divider, the full bleed mark, and the closing
statement. Budget about a week inside phase 4 for those layouts alone.

**Phase 5.** Change the mark and watch all three documents update. This is where
the first run flow and the derivation screen get built, and it is the phase that
turns a set of features into a product.

After that, in this order: the CMYK print path, then the mockup engine, then
accounts and billing on the day you decide to sell. Six months is honest for one
person. Two people is faster but not twice as fast, because phase 2 does not
split well.

## 7.0 What will actually go wrong

- **Messy SVG input, which will break more builds than everything else here
  combined.** Illustrator exports carry open paths, clipping masks, embedded
  rasters, live text that was never outlined, and transforms nested six deep.
  Normalise every upload through usvg and write a report in the designer's own
  language. Budget a week and expect to spend two.
- **The canvas editor overruns.** Eight weeks is the honest figure and editors
  always run long. The mitigation is the phase order, not optimism. Ship phases
  0 and 1 first and you have a real tool whatever happens next.
- **Headless Chrome has known print gaps.** It silently refuses to fetch images
  referenced inside @page rules, and page margin boxes are not supported at all.
  Paged.js polyfills most of the pagination and not all of it.
- **Chrome writes RGB only.** Anything going to a press needs the Typst path
  from section 2.0. Find this out now rather than in front of a client.
- **Pantone cannot be shipped.** The library is proprietary and enforced, so let
  the designer type the value they picked and store it.
- **Fonts.** Embedding a client's typeface in a PDF you generate needs the right
  licence, and showing a live specimen on a public page needs a webfont licence.

## 8.0 What is needed to start

None of this blocks phase 0. These four things make the result yours rather than
generic.

- One finished identity project you own, ideally one that went through a late
  revision. It becomes the test case.
- The master SVG from that project, exported the way you normally export, so the
  normaliser is written against real files.
- Your existing deck and guidelines layouts, so the templates look like Pagrin's
  work.
- Your file naming convention for a delivered package. That becomes the first
  rules file.

One open question that does not change the build. Should the client be able to
comment on the presentation inside the tool, or does the deck stay a PDF you
present and discuss live? It changes phase 4 by about a week and it is easy to
add later.

## 9.0 The quality target

A worked specimen of the output is published as a separate artifact. It is a
complete brand manual for a fictional tidal energy company, covering the mark,
colour, typography, the graphic language, motion, applications and the asset
package, with every section marked as drawn by the system, set once by you, or
yours.

The count on that specimen is 30 sections, of which 19 are drawn by the system,
5 are rules set once, and 6 are written or placed by hand. The package it
describes holds 172 files. Treat those numbers as the target for phase 3.

Building it settled three things that were not obvious from the plan alone.

First, the identity has one geometric rule that carries everywhere. In the
specimen every arc in the system is struck at 1.25 times the width of its own
box, which produces the tide line in the mark, the repeat in the pattern and the
curve in every icon. A system that stores that one ratio can draw all three. A
system that stores three separate numbers will let them drift apart.

Second, the icon and motion sections are worth more for what they refuse than
for what they draw. The useful feature is not exporting an icon at eight sizes,
it is rejecting the ninth icon whose stroke is wrong. An icon set falls apart at
the twentieth icon, not the eighth, and only a machine is still checking by
then.

Third, an earlier version of this plan said that photography and tone of voice
stay with the designer entirely. That was wrong, and writing those two chapters
proved it. Each of them splits three ways rather than belonging to one side.

The direction and the voice principles are the designer's forever. The treatment
and the mechanical rules are decided once, which means the duotone recipe, the
crop ratios, the date format, the unit style and the banned word list. The
measuring and the checking belong to the machine, and those are the parts people
actually get wrong. Nobody misreads a photographic brief. They put the mark on a
bright sky at 1.1 to 1, and that is arithmetic on the pixels underneath it.

The copy checker is worth building for the same reason, and it needs one honest
feature. Every flag it raises carries a certainty. String matching on the brand
name, the unit style, the date format and the lexicon is exact. Flagging a claim
with no figure behind it is a judgement, and the interface has to say so rather
than presenting both with the same confidence.

Co-branding lockups, data visualisation styling and templates are all fully
derived, since co-branding is arithmetic on the clear space rule and the rest
falls out of the tokens. Brand architecture is a rule block. What stays with the
designer is not a list of chapters. It is the judgement inside every chapter,
and there is some of it in all nine.

---

## Built so far, and what building it changed

Phases 0 to 3 are in `engine/`, together with the parts of phase 5 that turned
out to be cheap once the renderer was shared. What is running: the normaliser,
the measuring engine, the packager, both documents, the canvas editor,
publishing, all three kinds of block, image slots, page sizes and the
photography treatment, print work with bleed, CMYK, and a printed piece through
Typst, mockups, and the licence half of accounts. 138 files from one master,
340 tests, and fifteen more identities in the repo that the engine had not been
written against.

Three things the plan had wrong, found by building rather than by thinking.

**Rule blocks are a whole kind, not a footnote.** The plan named them and moved
on. They needed their own module, their own panel state, their own badge, and a
rule about where the decision lives: in the project, never in the document.
Without that last rule a rule block is just a derived block with more options,
and the first person to edit one on a page breaks the system quietly.

**A rule has to be derived from the artwork, or it is a memory.** The icon grid
takes its stroke and its live area from the mark's own stroke and margin. That
sounded like elegance when it was written down. It is actually the only version
that survives the mark changing, which it will. Thicken the ring from 9 to 14
and the icon stroke goes 1.8 to 2.8 and an icon drawn to yesterday's rule becomes
a blocker, which is correct and is the entire point.

**Refusing well is most of the value, and it is harder than drawing.** Two
defects in the first icon check would each have made it useless while looking
like it worked: it read an arc's radius as a coordinate, and it never saw paint
that shapes inherit from a group, which is how every drawing tool exports. Both
passed a casual look. Both were found by writing a fixture that looked like a
real export rather than like a test.

**The mark on a photograph is worth more than the image slot around it.** This
plan called it out in one line and then filed it under photography. Building it
took an afternoon and it is the only part of the editor that catches a mistake
a working designer actually makes: the mark on a bright sky at 1.1 to 1. It
also needed the block to stop painting its own ground, which nobody would have
noticed until the check confidently measured pixels the reader never sees.

**The photography chapter was right about the split, and wrong about the size
of the machine's half.** This plan said the treatment and the mechanical rules
are decided once and the measuring belongs to the machine. True, and it
undersells it. Once the treatment is a rule the machine draws rather than a
recipe someone applies in Photoshop, the machine also knows what every pixel
will look like before it is drawn — so it can answer the question a designer
actually has, which is not "what is the recipe" but "how much scrim does this
particular photograph need for the mark to survive". That is a number, it takes
a second to compute, and it is otherwise a slider dragged until it looks about
right on one person's screen.

Doing it that way costs a discipline: the treatment is implemented twice, once
as markup a browser paints and once as arithmetic the editor reasons with, and
the two must agree. So there is a check that renders through the real filter and
reads the pixels back. It caught a flat scrim painting solid while the numbers
assumed 42% on its first run.

**Accounts and billing split cleanly in two, and only one half is buildable
without a server.** This plan put them last, on the day you decide to sell, and
that was right. What it did not say is that the half worth doing early is not
the payments. It is deciding what the plans are, what each permits, how a
permission is proved, and what the client ends up owning — because the last of
those is the product's whole argument. Every tool this replaces leaves the
client inheriting the designer's subscription. Writing the opposite into the
package, in the package, is a one-file job that makes the positioning real
rather than a line in a pitch.

The rest is a server and should stay unwritten until there is a reason. Worth
being blunt about the limit: a licence check that runs on the customer's own
machine is a speed bump, not a lock. What a signature buys is that a licence
cannot be forged or quietly upgraded, so a support conversation is about facts.
Real enforcement is a server refusing to generate the package, which is the same
place the card gets taken, which is why the two arrive together or not at all.

One decision that looks small and is not: with no vendor key set, nothing is
limited. A tool that refuses to run your own job on your own machine because
nobody has decided to sell it yet is a tool you route around, and a tool the
author routes around stops being tested.

**The mockup engine turned out to be arithmetic, which the plan did not expect.**
It was filed after the print path as though it were an asset library: pictures
of cards and totes with a slot to drop a logo into. What it actually is, is one
projective transform and a blend mode, and both are exact. The mark takes the
photograph's perspective because a homography puts the corners where you drag
them, and it takes the photograph's creases because multiply is a multiplication.

Which means the machine can answer the question again. A blend moves a colour
one way only: multiply never lightens, screen never darkens. So light artwork
multiplied onto a light surface is not faint, it is invisible by arithmetic, and
the opacity slider a designer would reach for cannot help. Sampling the surface
under the artwork and saying which blend and which colourway do read is the same
move as the scrim strength and the icon stroke, and it was the third time that
shape has paid.

**The second emitter finally had to be built, and it needed a check rather than
a promise.** Everything in this plan rests on there being one layout engine.
Typst is a second one, and the argument for it is narrow but real: a piece laid
out on the canvas that is going to a press cannot go through Chrome, because
Chrome writes RGB. Building it turned up the finding that shaped it — Typst
places an SVG as vector but paints it in RGB, so the mark could not simply be
embedded, and had to be redrawn from its own path data.

Redrawing artwork by a second route is exactly the drift this project has spent
its length designing against, so the answer was not to be careful. It was to
make the disagreement measurable: the redrawn mark is rendered beside the
original and compared shape for shape, and the printed page is compared with
the published page area by area, ignoring absolute brightness because a
declared ink build and the hex beside it are different colours on purpose. Two
things also hold it down by construction. The emitter takes a deliberately
small set of blocks and refuses the rest by name, so nothing is ever half
drawn. And copy goes out as a string rather than as markup, because Typst
markup reads asterisks as bold — which would have printed a line of copy
differently from the same line on the canvas, and is drift in its purest form.

**The Typst plan was the wrong shape, and building the CMYK path showed why.**
This plan said Typst was needed because Chrome writes RGB and a printer wants
CMYK. True as far as it goes, and it points at the wrong file. What actually
goes to a press is the logo assets, and those are generated here with jsPDF
rather than by Chrome, so they can be written in ink directly and they now are:
the operators in the file are `k` and `K` with the declared builds. Chrome only
prints the documents, and nobody sends a brand manual to a four-colour press.
Typst is still wanted, but for a narrower thing than the plan claimed: a
printed piece laid out in the editor.

The harder half was not the file format. It was deciding that **CMYK is a
decision and not a conversion**, and then holding that line through the
interface. Every naive hex-to-CMYK formula is arithmetic on numbers that mean
something else, and this engine shipped one. The fix was not a better formula.
It was carrying the designer's own builds, refusing to send a guess to a press,
and marking a guess with a question mark everywhere it appears, because a chip
that shows given and guessed the same way is exactly how a guess ends up
printed. The machine's half is the arithmetic nobody enjoys: total ink
coverage, and rich black.

**Bleed is where "derive it" stopped being a preference and became the only
option.** The correct thing to hand a printer needs artwork painted outside the
page, and the honest way to ask for that is a block at minus eleven pixels with
a width of page plus twenty-three. Nobody would do that on every page, and the
one they forgot would be the one that came back with a white line down it. So
the same rule the resize already used — a block against an edge is meant to run
off it — does the work, and the designer never sees the negative number.

It also produced the two most embarrassing bugs so far, both from arithmetic
rather than design: a page rounded a third of a pixel too tall for its own
paper, so every sheet printed twice, and millimetres added to inches, so US
Letter came out three times its size. Neither was visible in the editor. Both
were caught by printing to PDF and measuring the result, which is now a check
that runs on six documents.

**Page sizes broke the assumption that type is free.** Every other measurement
in this system is derived, which is the whole argument. Type is the exception:
a size comes from the brand's scale, so it is a token, and a token does not
scale when the page does. A headline that fitted two lines at 1280 wide needs
three at 794, and no amount of arithmetic on the page size will tell you that —
only laying the text out will. The editor can, so it does, and it says so. This
is the first place where the answer was not "derive it" but "measure what the
browser did and report it".

The cost of images sat somewhere the plan never looked: undo. Sixty whole
documents cloned per session is fine until one of them holds a photograph. The
bytes had to live beside the document, and then pruning had to be moved off the
edit path entirely, because deleting a block and pressing undo has to bring the
picture back.

**The second project found ten bugs, and nine of them were invisible with one.**
The plan treats a run on unfamiliar artwork as validation, something you do at
the end to confirm the thing works. It is not. It is a different instrument, and
it measures a class of defect nothing else can reach: the branch that never ran,
the assumption that held by coincidence, the special case that was general all
along. Meridian's mark is a stroke, so the code that measures a filled shape had
never executed once. Meridian has one colour slot, so painting every slot the
same colour looked correct everywhere it appeared. Meridian cuts a colourway
named after each colour role, so three renderers that assumed it were all right,
every time, for months. None of these are subtle bugs. Each of them is obvious
the moment a second project exists, and unreachable while only one does.

The one bug that was not of that kind is worth separating out, because it is the
opposite lesson. The minimum size for filled artwork is measured by scanning the
rendered mark and reading the narrowest run of ink off it. The first version
took a low percentile of every run, which is fine on a stroke or a bar and wrong
on anything that comes to a point: Halyard's chevron measured 4.8 where the bar
across it is 12, and the floor came out a fifth too high. That was not found by
the second project. It was found by asking whether the number the second project
produced was actually right, and then measuring the estimator against seven
shapes whose answers are known by construction — a ring 16 thick, a cross of 12,
bars of 12 and 7, a disc with no thin part in it at all. A new project tells you
where to look. It does not tell you whether what you find there is correct.

**The third project found eight more, and the second could not have found
them.** The obvious reading of the Halyard run is that a second project is the
instrument and a third is a formality. It is not what happened. Halyard is
filled artwork in a square 120 unit box with an English name — it differs from
Meridian in exactly the ways it was built to differ, and it therefore shares
every assumption neither project was built to question. Both put the origin of
the mark's box at zero. Both name themselves in ASCII. Both cut a colourway for
each colour role. Both have an ink box within a few per cent of square. Kvist &
Sønn is none of those, and eight things broke — including the clear space box,
which had been drawn as a square since the first week and is a false statement
about the rule in every manual the system had ever produced.

So the lesson is not "test on a second project". It is that each new project
only reaches the assumptions it happens to violate, and you get to choose which
ones by choosing the project. The third was designed by listing what the first
two silently agreed about and contradicting the list. That is a repeatable
method and it is much better than waiting for a client file to find them.

**A wrong number is a different kind of defect from a wrong pixel, and the
system had no way to tell them apart.** Of the eight, two put a number in front
of a designer that was simply false: a minimum size at which the mark's own
subject renders 1.75 px wide, and a clear space diagram showing a square where
the rule makes a 4.7:1 rectangle. Both were produced by code that ran without
error, both were rendered beautifully, and both would have been read as
authoritative precisely because the whole argument of the system is that its
numbers are measured rather than typed. Nothing in the test suite or the browser
checks could have caught either, because both were internally consistent. What
caught them was designing the fixture so the right answer was known by
construction before the engine was asked — three 7 unit boards, an ink box of
228 by 49 — and then comparing. A system that derives its numbers needs fixtures
whose numbers are known independently of it, or it can only ever check itself
for consistency.

**The fourth project worked by subtraction, and that is a separate instrument.**
Kvist was built by listing what the first two agreed about and contradicting the
list — a different shape, a different alphabet, a different mix of fills and
strokes. Hallward was built by *taking things away*: no third colour, no second
colourway, no second typeface, no system block. Those are not exotic
configurations, they are the most ordinary identity there is — an ink, a paper
and one serif — and they had never been run, because every fixture in the repo
was made by someone who knew what the engine wanted. Adding an unusual project
tests the code that runs. Removing everything optional tests the code that
assumes, which is a different set of lines.

**Two of the five defects were about a number nobody had classified as a
number.** The viewBox is a unit system: 120, 252 and 2048 can describe the same
drawing at the same size. The engine had two places that quietly treated it as a
resolution — one rendering six pixels per unit, so cost grew with a number the
designer picked arbitrarily and a 2048 box took 45 seconds; the other rendering
to a fixed width, so precision *shrank* with that same number and an 8 unit
hairline measured 7.7. The same misconception, inverted, in two modules, each
looking locally reasonable. Neither would ever surface in a project whose units
happened to be of a familiar size, and every fixture's were, because the person
writing the fixtures also wrote the code.

**And the third lesson is about the checks, not the code.** Three of the five
were the same defect wearing different clothes: nothing anywhere was asking
whether the mark could be seen on what it was sitting on. The manual's headline
specimen was a black rectangle. So were four slides of the deck. So — it turned
out — had Halyard's title slide been, for two whole rounds of this exercise,
while browser checks measured console errors, missing renderers, and geometric
overflow, and passed it every time. The checks measured what was easy to
measure. A contrast module had been sitting in the repo since the first week and
no document was calling it. The lesson is not "check contrast"; it is that a
verification suite drifts toward the properties that are cheap to assert, and
the way out is to ask, periodically and deliberately, what a reader would notice
in one second that no assertion currently covers.

**The same defect turned up for the third time, and that is the finding.** The
fourth round found the manual showing the mark on a ground it could not be seen
on. The fifth found five of six misuse cells blank for the same reason — an ink
taken from a colour role, put on a ground nobody had measured it against. Twice
now the instance found in a new project turned out to have been shipping in an
old one: Halyard's title slide, then Halyard's misuse grid. A defect that recurs
in three places is not three defects, it is one missing rule, and the rule is
that no document may pick an ink and a ground independently. Fixing instances
will keep finding instances. What is wanted is for the choice to be impossible
to make wrongly — one function that returns a pair, never two lookups that
happen to be used together — and that is a design change, not a bug fix. It is
partly done: `showOn` exists and three places now call it. Nothing yet stops a
fourth place being written without it.

**Two rounds running, the new project's most valuable find was in the old
projects.** Kvist's printed piece has been carrying a solid rectangle the size of
its artboard since Kvist was added, because the Typst emitter walked into `defs`.
The check that exists precisely to catch that — redraw the mark, compare it with
the render — only ever ran on Meridian, which has no `defs` in it. The lesson is
not about `defs`. It is that a check pinned to one fixture tests that fixture,
and every check in this repo that takes a project as input should run over all of
them; the ones that do not are the ones with findings hiding behind them.

**The sixth project varied the file rather than the identity, and that is a
different axis entirely.** Five projects had varied what the identity *is* —
its shape, its palette, how much of it there is. All five were written by
someone who knew what the engine wanted, in the dialect the engine likes:
six-digit hex, slots tagged, no CSS colour functions. Perigee varied the
dialect instead, and found the two worst defects in the exercise. That is worth
stating as a rule: a fixture written by the author of the code inherits the
author's assumptions about *format* even when it is designed to violate their
assumptions about *content*. Varying the content finds missing branches;
varying the format finds missing parsers.

**NaN is the most dangerous value in a system that makes judgements.** A colour
the reader could not parse produced NaN, and NaN compares false against every
threshold — so a system built to refuse things refused silently and
confidently. `brand.json` told the client that every colour pair in their
identity was "Never for text", and the pattern set was withheld with the reason
"measures NaN:1 against its ground". Nothing threw, nothing warned, and both
outputs looked exactly like the system working. The rule that falls out: a
measurement that could not be taken must be a different value from a
measurement that came out badly, and every threshold must be reached through
something that knows the difference. `null` and a verdict of "Not measured"
cost nothing and make the failure impossible to mistake for a judgement.

**And the recurring-defect debt came due in a good way.** Last round's note said
a defect appearing in three places is one missing rule, and that fixing
instances would keep finding instances. It did: the colour pass and the slot
assignment were walking into `defs` exactly as the printed piece had been. This
time the fix was the rule rather than the instance — one `eachPainted`, one list
of what never draws, used by all three. The other debt from that note is paid
too: the path-translation check ran only on Meridian and now runs on every
project in the repo. Both were written down as things not done; both were cheap
once they were named. The general lesson is that a note saying "this is the real
problem and I have not fixed it" is worth more than it looks, because it is the
thing you can act on next time without rediscovering it.

**An error message that names a solution is a promise, and this one was not
kept.** The namer learned to refuse a brand with no latin letters in it and to
say "give the project a latinName". Nothing read `latinName`. A test asserted
that the message contained the word. So the refusal was correct, the wording was
helpful, the test passed, and the feature did not exist — every identity named
in Hebrew, Greek, Cyrillic, Arabic or Japanese was locked out by a sentence. The
rule that falls out is narrow and worth keeping: when a refusal tells the user
what to do instead, the thing it tells them to do is part of the change, and a
test that asserts the wording of a message is not a test that the message is
true.

**The most invisible defect is an unasked question, and the proof is that I
wrote two of them myself.** A colourway declares the ground it is cut for.
Whether its inks can be seen there is arithmetic and the module for it has been
in the repo since the first week — but nothing ever asked. Three of seven
projects carried an unreadable colourway, and two of those three were written by
me in the two rounds immediately before, while working directly on the code that
chooses what can be seen. Nothing failed, because the documents had already
learned to show a different colourway instead: the workaround for the symptom
was hiding the cause. That is worth stating as a general shape — when a system
gets good at routing around a bad input, it stops reporting that the input is
bad, and the better the routing the quieter the failure.

**Seven projects were unfamiliar; the eighth was damaged, and that is a
different thing.** Every fixture up to Thornbury was drawn on purpose and drawn
correctly — the variation was in shape, palette, alphabet, dialect, scale. All
of them were, in the end, well-formed files that the engine had simply not
anticipated. A real logo file is not well-formed. It has a stray click in it
from 2011, an old version dragged off the artboard rather than deleted, and a
handle somebody pulled by accident. The normaliser had a whole vocabulary for
what a shape *is* — its element type, its paint, its slot — and none at all for
where it is. One dragged handle put the minimum size five times too high, in a
document whose entire claim is that its numbers were measured rather than typed.
Robustness to damaged input is not the same axis as generality across designs,
and eight rounds in, it was the axis with the most left on it.

**A test for a property is worth more than a test for an instance, and it finds
things the instances cannot.** The claim this project rests on — change the
master and every number follows — had been checked once, on one project, by
changing one stroke width. Written as a property over all eight (halve the
artwork, everything derived halves or doubles) it immediately found a flaw in a
fixture shipped the previous round: Ma'ayan's ripples were being sliced flat by
its own artboard, which no individual assertion had been looking for and which
the brand-new artboard check would also have missed, because its tolerance was
a guess. The property did not know about clipping; it just knew what the
arithmetic ought to do, and clipping was the only thing that could break it.

**A refusal that nothing acts on is not a refusal.** `ok` was hardcoded `true`
at the end of the normaliser, so every blocker discovered after the first pass
was raised, described, attached to the report and then ignored. This is the
second round running that the shape of the defect was "the judgement is correct
and the machinery does not use it" — last round an error message named a
solution that did not exist, this round a function raised a refusal it then
overruled. Both are cheap to make and invisible to any test that checks the
finding rather than the outcome. The rule is the same in both cases: assert on
what happens, not on what is said.

**Ten identities in, the axis that was left had nothing to do with identities.**
Each new project had been a way of finding assumptions, and by the tenth the
returns had shifted: Fathom's find was a module no fixture had ever reached
rather than an assumption no fixture had ever broken — a coverage gap, not a
generality gap. The thing still untested was not a kind of identity at all. It
was whether building the same project twice produces the same package. It did
not: 45 of Meridian's 138 files changed on every run, from four separate causes,
none of them the artwork. That matters here more than it would elsewhere,
because the entire argument of this engine is "change the master and everything
follows", and the only honest way to watch that happen is to build, change one
thing, build again, and diff — which the noise made impossible. With it fixed,
one edit to the ring changes 96 files and leaves 42 alone, and the 42 are
exactly the wordmark files that do not depend on the mark. A demonstration you
can run beats an assertion you have to trust.

**The instrument was exhausted before the defects were, and the way to tell was
to stop guessing.** By the tenth identity the returns had changed character:
Fathom found a module no fixture had reached rather than an assumption no
fixture had broken. The question "would an eleventh identity find anything?"
is not answerable by intuition, but it is answerable: list every key a project
can declare, and count how many of the ten set each one. Every rule the engine
defaults was set by all ten, and both system blocks were exercised — so the
identity axis really was spent. What that listing turned up instead was that
`system.icons` is what the engine reads while `system.icon` is what a designer
writes beside `system.pattern`, and that any mis-cased rule is dropped in
silence. A defect found by auditing what the code *offers* rather than by
inventing another input, which is what you do when the inputs stop paying.

**A defect that only prints an error to a console is still a defect.** Every
scaled drawing in every document carried `height="auto"`, which is not a length
and so is not an SVG attribute. The inline style beside it did the work, the
pages were right, and the only symptom was one console error per drawing —
noise, in a place nobody looks. It was found by reading those errors, and the
reason it mattered is that the style was load-bearing without anybody deciding
it should be: a page stripped of its styles would have lost the proportion with
it. Checking a page in a real browser means reading what the browser says about
it, not only looking at what it drew.

**A measurement with only one dimension is an ambiguity waiting for the shape
that exposes it.** The smallest usable size has always been a *width* — the box
divided by the narrowest stem across it — and for ten identities that could not
be told apart from a height, because every mark in the repo was square or wide.
The eleventh is 1 to 4.7, and `13 px` read as a height gives a mark a quarter of
the size the number promised. The instrument that found it was not another
identity: it was asking what the ten existing ones had *in common*, which is a
cheaper question than inventing an eleventh and a more reliable one. Their
shapes clustered inside 1.22 to 1. The number to look for is the one that is
right for every input you have and undefined for an input you have not.

**Half a fix is a fix that will be found again.** The height went into the
manual's copy of the size specimen and not into the canvas's, so the same mark
read `110 × 40 px` in the book and `110 px` on the page the book published. The
block is drawn by two renderers on purpose — one server-side, one isomorphic —
and a change to what it *says* has to go through both. The fix that lasts is not
patching the second copy: it is computing the caption once, in the engine, and
having both read it. Duplication of layout is fine. Duplication of judgement is
the bug.

**When CSS rescues a layout, it destroys the meaning and reports success.**
Hallward's floor is 766 px, so the specimen showing above, at and below the
floor asked for 1532, 766 and 460 px in a column 282 wide. `svg{max-width:100%}`
capped each of the three separately, so all three drew at 282 — the same picture
three times under three different numbers, in the one block whose entire job is
to show a difference. Nothing was broken, nothing errored, and the page looked
fine. The same block on the canvas, which had no such rule, ran a 1532 px mark
off the right of the page — the honest failure, and the one that got noticed.
A layout that silently absorbs an impossible request is worse than one that
visibly fails it.

**A rule the engine enforces on your input and not on its own output is not a
rule.** `check <icon.svg> --icon` refuses an icon whose thinnest part paints
under `minStrokePx`. The engine then wrote its own icons at sizes far under the
same rule, in every one of the eleven projects, and reported success. Hallward's
seal paints at 0.49 px in its 180 px app icon and ships nothing that clears its
own rule at all. The check existed; it was pointed at the door and not at the
loading bay. Worth pairing with the earlier note that a check pinned to one
fixture tests that fixture: a check pinned to one *direction* tests that
direction.

**And a warning that fires on every project is not a warning.** No mark of any
weight clears a 3 px stroke in a 16 px favicon — that is a fact about favicons,
not a fault in the artwork — so warning about it would have put the real signal
(an app icon the designer chose *for this mark*, below the rule) on the same
line as a truth every package carries. The number goes in `brand.json` for
everyone; the warning fires for the one project that earns it. Deciding which
findings are worth interrupting for is part of refusing well, not separate
from it.

**Eleven identities varied everything except what the artwork was made of.**
Shape, script, damage, palette size, file dialect, aspect ratio — and every one
of the twenty-two master files was flat colour. The audit that finds this is the
same one the eleventh round used, run on a different axis: list the SVG features
a mark could use, and count how many of the eleven use each. Gradient: none.
Mask, filter, image, blend mode: none. A blind spot is not a thing you notice by
looking harder at what you have; it is a thing you find by listing what you
could have had.

**A gradient is the case that breaks "one colour per slot", and every layer had
its own way of getting it wrong.** The recolourer threw it away. The file kept
its definition anyway. The contrast arithmetic scored it zero. The build's
readability check skipped it. The PDF wrote it in the wrong colour space. The
Typst translator produced source that would not compile. Six failures, one
cause: every one of those layers had been written against artwork that is one
flat colour per slot, and none of them said so. When a shared assumption is
never written down, each layer breaks it differently, and the breakages do not
look related until you have an input that violates it.

**A vocabulary gap shows up as a silent wrong answer, not as an error.** There
was no way to say "leave this slot as the artwork draws it", so the honest thing
a designer would write — the middle stop's hex — was accepted and did the wrong
thing quietly. `"keep"` is four characters and it did not need inventing: the
engine had already decided, years of rounds ago, that `fill="none"` means the
artwork's own paint is a decision. The gap was that the rule existed for one
value and not as a concept. Where a system silently does something reasonable
with input it has no word for, look for the missing word.

**A check that compares a translation against its own source tests the parser,
not the target.** The Typst path had a per-project check that looked thorough —
every mark, every path, rendered and compared pixel by pixel. It translated SVG
paths to move/line/cubic and compared **SVG against SVG**. Typst was never
invoked. The one thing that ever went through Typst was a single Meridian page,
so a fill Typst refuses outright had been available to produce for as long as
the module had existed. A translation check has to end at the other language's
compiler; anything short of that is checking your own arithmetic.

**Two null-shaped bugs of opposite sign, from the same value.**
`Math.min(11.86, null, 2.8)` is 0, because null coerces to zero, so one place
rated a gradient colourway unreadable against every ground. Another place
filtered the null out, so the pale end of the gradient became the only part of
the mark never checked. Round six recorded that NaN is the most dangerous value
in a system that makes judgements; null is the same lesson wearing a different
coat, and the fix is the same — do not let a value that means "not a colour"
into arithmetic about colours. Resolve it to what it actually stands for, in one
place both callers read.

**Maximising a measurement is not the same as respecting a decision, and this
is the second time.** Choosing which colourway the manual opens on took the
highest contrast available, which put six of twelve manuals on a colourway the
designer had not put first — five while their first read perfectly well. An
earlier round had already made exactly this mistake with a ground colour and
recorded the rule: keep the designer's choice unless it fails. The rule had been
applied to the ground and not to the colourway. A lesson learned about one field
is not learned until you go and look for the same shape in the fields beside it.

**The largest gap was in the shape of the input, not its contents.** Twelve
rounds varied what artwork is made of and how it is drawn, and every one of them
handed the engine two files. An identity that is a logotype and nothing else is
arguably the commonest kind there is, and it could not be built — the engine said
so in one line naming a missing field, which reads like a rule rather than an
oversight, and that is exactly why it survived twelve rounds. The audit that
finds this is not about SVG features or aspect ratios: it is *how many pieces is
the input made of, and has anything ever handed us a different number?*

**A refusal is a design decision, and a refusal nobody revisits is a design
decision nobody made.** "The project does not say where the master mark is" was
written when a mark and a wordmark was the only shape anyone had tried. It was
never argued for; it was the first sentence that made a test pass. Refusals age
into architecture. Worth re-reading every one of them and asking which are
principles and which are just the first day's assumptions with a full stop.

**Four of the five defects this round were in code the new fixture merely
walked past.** The construction drawing had placed artwork at the canvas origin
rather than at the artwork's own — Kvist had been nine units out since the third
round, small enough to look like a rendering artefact. The same drawing never
clipped to the artboard, so Thornbury's deliberate overhang appeared in its
manual and in none of its files. The size specimen stood on the page's colour
rather than the brand's and vanished for eight of thirteen projects in light
mode. The read me named four folders in a package that writes what it is asked
for. None of these needed a logotype to exist; they needed something to *look*
at them, and a new kind of input is the cheapest way to make yourself look.

**Two renderers, again, and the same three fixes missing from the second one.**
The canvas draws construction and clear space too, and the origin fix, the
artboard clip and the round-eleven "clear space is the shape of the ink box, not
a square" had all landed only in the manual's copy. The twelfth round recorded
that duplication of judgement is the bug; the remedy this time was a property
test that pins the two renderers' geometry to each other, so a fix that lands in
one and not the other fails rather than ships.

**A crash is not a failing check, and a harness that counts "ok" lines will
report a green board for a script that died.** The Typst check compiled every
project's *mark* lockup; a logotype identity has none, so it threw halfway
through and the summary showed no failures at all — I only noticed because the
count had gone down. Any check that iterates over inputs needs to fail loudly
when an input kills it, and a count that shrinks is worth more attention than a
count that stays the same.

**The documents had never been given anything to document.** Thirteen rounds
varied the artwork — its shape, its material, its damage, how many files it came
in — and left the *writing* at a stub: the longest string in the whole content
block of twelve of the thirteen projects was 27 characters, and every fixture's
positioning statement was its own name. This plan says in its own opening that
what stays with the designer is the judgement inside every chapter. The engine
renders that judgement, and until this round it had never rendered any. The
cheapest audit in this whole sequence was `max(len(s))` over the content of
every project.

**A layout tested only with short strings is a layout that has not been tested.**
The deck set a positioning statement as its headline at 7cqw on a 15ch measure —
fine for the eight characters every fixture had, and 657 pixels past the bottom
of the slide for the 331 a real one has. The starter document put the same
statement in a block 700 by 120 whatever was in it. Neither was a bug anybody
wrote; both were the natural code to write when the only input you have ever
seen is a single word. Length is a dimension of input like any other, and the
short case is the one that hides it.

**Two renderers again, and this time they failed in opposite directions.** The
canvas had `overflow:hidden` so it swallowed what did not fit; Typst has no such
rule so it printed straight through the block underneath. The same document lost
words on screen and overlapped them on press, and neither said anything. Where
the twelfth round found two renderers disagreeing about a value, this one found
them disagreeing about a *failure mode* — which is harder to see, because each
one on its own looks like a reasonable choice. The fix that matters is not
picking one: it is that the condition is measured and named, in one place both
read.

**When you cannot compute the answer, fit it against measurement and constrain
the direction of the error.** How many lines a passage takes cannot be worked
out in Node without a layout engine. So the estimator was fitted against 540
measurements from a real browser — nine strings this engine actually sets, two
face stacks, six sizes, five widths — under one rule: never say a passage takes
fewer lines than it does. Under-counting misses a real overflow; over-counting
mentions a near miss. A parameter search that rejects every pair that ever
under-counts, and then minimises error among the rest, is a better instrument
than picking a plausible constant and hoping.

**A style is an assumption about length.** Misuse captions are set in
letter-spaced uppercase monospace, which is a label style and right for "do not
stretch it". Meridian's captions have been full sentences — 48 to 57 characters
— since the first identity in the repo, set in spaced capitals the whole time,
and nobody noticed because nobody had ever seen the alternative. Typography that
is chosen once and applied to whatever arrives is the same class of defect as a
box sized once and filled with whatever arrives.

**An override path that nothing has ever taken is not a feature, it is a
hypothesis.** Four rule blocks, and no project in fifteen rounds had set two of
them. The moment one did, both of the ways an override can be wrong turned up at
once: a shallow merge that deletes the keys you did not restate, and a derived
value that overwrites the one you did. Neither is exotic; both are what you get
when the only caller is the default. The audit that finds this is a list of every
key a project may set and a count of how many projects set each — the same
listing the eleventh round used, run again now that there are more keys.

**Defensive fixtures hide the defect they are defending against.** Every project
that overrode the pattern restated all three densities. I wrote those fixtures,
and I restated the keys because that is what you do when you are not sure — which
is exactly the instinct that kept a shallow merge alive for five rounds. A
fixture that writes the minimum is a better instrument than one that writes the
maximum, because the minimum is what a real project file contains.

**The plan called rule blocks a whole kind and the documents never mentioned
them.** They were built, resolved, written into brand.json, drawn on the canvas
and counted among the files in the deck — and neither the manual nor the deck
had a chapter for them. The identity whose entire graphic language is its
pattern shipped a brand manual that did not contain the word. This is not a
rendering bug: it is a whole section of the deliverable that nobody noticed was
absent, because absence has no symptom. Worth asking of every part of a system:
if this were missing from the output, what would break? If the answer is
nothing, nothing will tell you.

**Where the numbering shifts, the thing that shifts it has to be derived too.**
Adding a chapter meant the one after it moved from 04 to 05, and its two
sections with it. Hard-coding the new numbers would have been the same class of
mistake as the four hard-coded folder names the thirteenth round found in the
read me. The chapter after the system asks whether there is a system, and
numbers itself accordingly; a project with no pattern, no photography and no
declared motion still gets the icon grid, because every package writes icons.

**A subsystem nothing feeds is a subsystem nothing tests.** Sixteen rounds of
fixtures, and `bu.images` was `{}` in every build that had ever been made:
photographs could only enter through the editor, so no project ever shipped one,
so the entire raster path — the treatment, the naming, the print translation —
had never run from a project file. The audit is the same one the fifteenth round
used, pointed at block types instead of rule keys: of the eighteen the model
knows, six were generated by no fixture at all, and two of those were whole
subsystems. Count what your own tests never produce, not just what they assert.

**A substring search over a data URI searches the picture.** File extensions
were chosen with `im.src.includes('svg')`, and `im.src` is
`data:image/jpeg;base64,…` — so the test ran over the base64 payload as well as
the header, and about a quarter of 60 kB photographs contain those three letters
by chance. Both fixture photographs did. The failure was total: Typst refused
the mis-named file and the printed piece did not compile at all. Anything with a
header should be read at its header, and the reading belongs in one place — the
same function now decides whether an image is a vector, which until then was a
claim the caller made rather than a property of the file.

**Two renderers of one document have to be measured against the same
arithmetic, not against each other.** The published page applied the duotone
with an SVG filter; Typst placed the raw file. Nobody had looked, because both
outputs were individually plausible: a treated picture on screen and a
photograph in print. The fix is not a second implementation of the recipe but
the same `treatPixel` the browser check is measured against, run over the pixels
before they are handed to the press. Where a check compares one renderer to the
other it can only find disagreement; where both are derived from one function
there is nothing left to disagree about.

**Refusals from the layer below are usually right.** Typst will not put an alpha
value on a CMYK colour. The temptation is to work around it — flatten, fake,
approximate. But a translucent wash over a photograph is not something a press
does with an ink: by the time the file goes out, the scrim has to be part of the
picture. The refusal was describing the physical situation correctly, and the
code was the thing that was wrong.

**`\s` crosses newlines, so a pattern anchored with `/m` can still swallow the
line below.** The site's front page derives both its list of identities and the
order it shows them in from the fixture table in `engine/README.md`, rather than
keeping a second copy that would be wrong within a round. The pattern read
`^\s*projects\/([a-z0-9-]+)\/\s+(.+?)\s*$` — and `\s+` after the directory
name matched a newline and the indentation of the next line, so the layout
sketch elsewhere in the file (`projects/meridian/` with its contents listed
beneath) produced a second, bogus entry. It happened to come out right, because
the later real entry overwrote it and the accidental order matched the intended
one. The check that found it was not the site: it was a test asking whether every
project directory is named in the README exactly once, which is worth having on
its own — a fixture added without a line would put a card on the deployed page
with nothing under its name. Horizontal whitespace is `[ \t]`, and a description
that must stay on one line is `[^\n]+?`.

**A dependency that arrives through somebody else's package is not declared.**
`fast-png` was required directly by the treatment code and appeared nowhere in
`engine/package.json`; it was in `node_modules` only because `jspdf` depends on
it. Everything worked, and would have kept working until jspdf changed its mind
or somebody installed with a resolver that does not flatten. Deploying the thing
is what surfaced it — a fresh `npm ci` in a build image is the first honest test
of what a repository actually declares.

---

Prior art checked September 2026: Logo Package Express, Standards, Brandpad,
Frontify, Pitch and Gamma. The stack of usvg, resvg, svg2pdf and Typst is MIT or
Apache 2.0. Verify every licence again before selling anything built on it. Week
estimates are planning figures for one experienced developer, not quotes.
