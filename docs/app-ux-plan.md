# The app: what is wrong with it, and what it should be

Written after the seventeenth identity, because the two turned out to be the
same problem. Winterbourne is an orchestra whose identity *is* its typeface —
and the app has never once asked what the typeface is. It hard-codes Archivo
and Literata into every project it builds, and then the manual it writes names
them as though a designer had chosen them.

That is the shape of everything below. The app collects the fields the engine
needs. It does not help anybody design.

## What is wrong

**1. It is a form, not a design tool.** You type values and press a button. A
designer works by looking, and there is nothing to look at until the build is
over.

**2. Colours are chosen blind.** The one question a designer actually has —
*what does my mark look like in these colours, on these grounds* — is never
answered. A contrast ratio is a fact about a pair of colours. It is not a
picture of the logo.

**3. The steps are lossy.** Three screens in one direction. Changing a colour
after seeing the package means starting the build again, so the loop that
design happens in — look, adjust, look — is the one thing the interface makes
expensive.

**4. The audit is a wall of alerts.** "Ink box 109 × 109. Clear space 27.25."
Those are drawings, and they are printed as a table. The engine measured them
off the artwork; the artwork is right there; nothing draws them on it.

**5. The package is four text cards.** No sense of what was made. You click a
card to find out whether the thing behind it is any good.

**6. Nothing survives a reload.** Name, palette, print inks — gone.

**7. Typography is never asked for.** See above. It is the largest hole.

## Principles

- **Show, don't state.** Anything the engine measures is also drawn.
- **One surface.** No wizard. A workspace that fills in as decisions are made.
- **Immediate feedback.** Colour changes redraw in the same frame. No round
  trip to a server to find out what a colour looks like.
- **The artefact is the hero.** The artwork is the largest thing on screen from
  the moment it arrives until the end.
- **Progressive disclosure.** Nothing is shown before it means anything, and
  nothing is hidden once it does.
- **Say which host you are on.** What is true locally is not true hosted, and
  the page says whichever is true rather than the flattering one.

## The design

**A two pane workspace.** Left: a stage. Right: a control column. On a narrow
screen they stack, stage first.

### The stage

It has three states, and it never goes blank between them.

1. **Empty.** One calm drop target and the offer of a sample.
2. **The artwork, measured.** The mark as large as it will go, with the
   measurements drawn *on* it and switchable: the ink box, the clear space
   margin, and the smallest usable size shown as a rule against a real scale.
   This is the moment the product earns trust — it tells a designer something
   about their own file that they did not know.
3. **The lockups, live.** Every lockup the artwork can make, in every
   colourway, on its own ground. Recoloured in the browser as a swatch is
   touched, because the artwork carries `data-slot` and recolouring it is DOM
   work, not a build.

### The control column

Sections appear as they become meaningful, and none of them ever disappears.

- **Artwork** — the two files, with the findings underneath. Quiet, grouped by
  which file they came from, collapsed when there is nothing to fix.
- **Name** — brand name, and the roman spelling only when the name has no
  latin letters in it.
- **Palette** — swatches, not rows. The contrast reading sits *on* the swatch.
  Roles are chosen by clicking a role, not from a dropdown.
- **Typography** — the hole this round found. A short list of pairings that
  actually work, and the option to bring your own licensed face, which is what
  a real identity is built on.
- **Lockups** — what can be built from what was given, with the rest explained
  rather than merely disabled.
- **Print inks** — folded away, since it is the one thing the engine cannot
  work out and most people will not have it to hand.

### The package

It does not replace the stage. It appears beside it, so the controls are still
there. Each document is a live thumbnail rather than a text card: the manual,
the deck, the cover and the canvas, rendered small, so you see what you made
before deciding to open it. Change a colour and rebuild; watch the thumbnails
change.

### What persists

Name, palette, typography, lockups and print inks go to local storage, so a
reload does not cost the work. The artwork does not — it is too large, and the
page says so rather than letting somebody find out.

## The order of work

1. The engine first, because the type control cannot be honest until a project
   can carry a typeface: validate `tokens.type`, load font files, embed them in
   every document, write them into the package with their licence, and refuse
   or warn where a face is named but unreachable.
2. The stage: overlays on the artwork, then live lockups.
3. The control column, section by section.
4. The package panel with thumbnails.
5. Persistence.
