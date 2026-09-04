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
- `Typst` is the later print path, because Chrome writes RGB only and a printer
  wants CMYK.

Nothing here needs a paid API. Two optional models, for depth maps and cutouts,
run locally.

## Status

The engine runs. `engine/` takes one master SVG and a project file and writes
136 files: every lockup in every colourway as SVG, PDF, `.ai` and PNG, icons,
favicons, social crops, the brand pattern at every density, `brand.json`, the
manual, the deck, a self contained canvas editor, and any document published out
of it. 136 tests.

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

Still to do: the photography treatment rules, bleed and crop marks, the CMYK
print path through Typst, and a run on a real identity job — which is the next
checkpoint and matters more than any further feature.
