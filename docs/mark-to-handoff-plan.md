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
255 tests, and two more identities in the repo that the engine had not been
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

**A defect that only prints an error to a console is still a defect.** Every
scaled drawing in every document carried `height="auto"`, which is not a length
and so is not an SVG attribute. The inline style beside it did the work, the
pages were right, and the only symptom was one console error per drawing —
noise, in a place nobody looks. It was found by reading those errors, and the
reason it mattered is that the style was load-bearing without anybody deciding
it should be: a page stripped of its styles would have lost the proportion with
it. Checking a page in a real browser means reading what the browser says about
it, not only looking at what it drew.

---

Prior art checked September 2026: Logo Package Express, Standards, Brandpad,
Frontify, Pitch and Gamma. The stack of usvg, resvg, svg2pdf and Typst is MIT or
Apache 2.0. Verify every licence again before selling anything built on it. Week
estimates are planning figures for one experienced developer, not quotes.
