# Tools worth building for brand designers

A brainstorm of tools that would take mechanical work out of an identity
project, ranked by how much time each one gives back.

The target was more than 50 percent. For a brand designer that is easier to hit
than for a product designer, because so little of an identity project is
actually design. The mark is usually finished in week one. The rest of the
project is spent putting it on things.

## 1.0 Where an identity project goes

Brand work is shaped by the project rather than the week, so measure a project.
This is one identity job of about 120 hours, which is a four to six week
engagement for a single designer.

| Stage of the project | Hours | A tool could take |
|---|---:|---:|
| Drawing the mark and exploring routes | 20.0 | 0.0 |
| Making mockups | 17.0 | 15.0 |
| Building the client presentation | 15.0 | 10.0 |
| Writing the guidelines | 14.0 | 10.0 |
| Revisions across everything | 13.0 | 7.5 |
| Building lockups and variations | 11.0 | 9.5 |
| Research, audit and competitor landscape | 9.0 | 5.0 |
| Type and colour decisions | 7.0 | 2.0 |
| Direction and moodboards | 7.0 | 3.0 |
| Exporting and packaging the delivery | 7.0 | 6.5 |
| **Total** | **120.0** | **68.5** |

That is 57 percent of the project. Only 20 of the 120 hours is drawing the mark.

The shape is the argument. Drawing the mark is the largest single stage and none
of it can be given to a tool. Every stage under it exists only because a mark
was decided, and each one follows from that mark in a way you could write down.

These hours are an estimate from a typical identity job, not a measurement of
yours. Track two real projects before you build anything, because your own split
will differ and the order is what decides what you build first.

## 2.0 The one idea behind all of it

**One master file. Everything else is generated.**

Change the mark on day 20 of a project and look at what has to be remade:

- About 40 photographic mockups.
- About 60 presentation slides.
- About 80 export files.
- About 50 pages of guidelines.

All of it by hand, one at a time, every revision. This is why a late change to a
brand costs a week, and it is why designers quietly resist a change they know is
right. The cost is not in the thinking. It is in the redoing.

Judge every tool below by one test. Does it regenerate from a single master
file? A tool that helps you build one mockup faster saves an hour. A tool that
rebuilds all forty when the mark changes saves the week, and it also removes
your reason to argue against a good revision.

## 3.0 The five with the most leverage

Ranked by how much time they give back. The build order in section 7.0 accounts
for effort as well.

### 1. Mockup engine

You point it at one logo file and it renders the mark into forty photographic
mockups. Change the logo and all forty are made again in a minute.

The library covers signage, a business card, a tote bag, a cup, apparel, a
billboard, an app icon, a storefront, packaging and a vehicle. This is the
largest block of mechanical time in the whole project.

Today each mockup is a Photoshop file. You open the smart object, paste the
mark, resize it, save, then export. Then the client asks to see the mark a
little heavier and you do all forty again.

How to build it. Each mockup is four things: a photograph, a displacement map
for the texture of the surface, a lighting map for the shadow and the highlight,
and a set of four corner points for the perspective. That is what a smart object
does internally, and you can do the same without Photoshop using ImageMagick or
a WebGL canvas. Build the pipeline once. After that each new mockup you add is
three images and four numbers.

The value grows on its own. After a year you have two hundred mockups, and the
library is the part a competitor cannot copy quickly.

- Build: 3 to 4 weeks, then about an hour for each mockup you add.
- Saves: 15 of the 17 hours.
- Needs: ImageMagick or WebGL, and a photo library.

### 2. Lockup and variation generator

From one master mark it produces every version you owe the client, and it draws
the diagrams that go with them.

The output is the horizontal lockup, the vertical, the stacked, the icon on its
own, the wordmark on its own, each of those with and without the tagline, and
each of those in black, in white, reversed, and in every brand colour. It also
draws the clear space diagram and works out the minimum legible size by testing
the mark at decreasing sizes.

That is 40 to 80 files, and every one follows from the master by a rule. It is
also where mistakes hide. On the third revision one variant does not get
updated, nobody checks all eighty, and the old mark ships inside the delivery
folder.

- Build: 2 weeks.
- Saves: 9.5 of the 11 hours.
- Needs: an SVG library and a rules file per client.

### 3. Guidelines generator

You set the rules once and it writes the document, including every diagram in
it.

It draws the clear space diagram, the minimum size diagram and the misuse
examples. It lays out the colour chips with the hex, rgb, cmyk and pantone
values under each one. It sets the type specimen at every size in your scale.

The guidelines are the most valuable thing you hand over and the most tedious
thing to make, which is a bad combination. Deliver a live web page as well as
the PDF. A page the client's team can search is the thing that actually keeps a
brand consistent, because nobody opens a 60 page PDF to check a colour value.

- Build: 3 weeks.
- Saves: 10 of the 14 hours.
- Needs: a layout engine and PDF output.

### 4. Presentation builder

It assembles the client deck from the approved assets in your studio's layout.

It builds the mark page, the colour page, the type specimen and every mockup
page, pulling the images straight from the mockup engine. When the mark changes
the whole deck is made again.

Keep the writing manual. The rationale for why the mark is right is the part the
client is paying you for, and a generated paragraph will read like one. The tool
should build every page around your words, not write them.

Build this after the mockup engine, never before. Most of a reveal deck is
mockups, so without the engine you have automated the easy half and left the
slow half alone.

- Build: 2 weeks, after the mockup engine.
- Saves: 10 of the 15 hours.
- Needs: the mockup engine and your deck template.

### 5. Delivery packager

It takes the approved set and builds the entire client handoff in one go.

It writes SVG, PDF, EPS and PNG at four sizes, plus the favicon, the app icons,
and the social profile crops sized to each platform's safe area. It puts them in
a named folder structure with a short read me file and zips the result.

This is the last job of the project. It always happens when you are tired and
already thinking about the next client, and a mistake here is the first thing
the new client sees.

- Build: 1 week.
- Saves: 6.5 of the 7 hours.
- Needs: an SVG toolchain and a zip writer.

## 4.0 The rest of the list

### Before the work starts

- **Brand audit scraper.** Point it at the client's website and it pulls out
  every colour, typeface and logo variant currently in use. Showing a client the
  fourteen shades of blue their own teams have invented is the fastest way to
  sell a rebrand.
- **Competitor landscape board.** Give it the names of the client's competitors
  and it collects their logos and palettes onto one board. You get to show where
  the client sits today and which part of the space is empty.
- **Moodboard tool with licensing attached.** Every reference carries its licence
  status, so you never present an image you are not allowed to use. The awkward
  version of this problem is finding out after the client has fallen in love
  with it.
- **Naming checker.** It takes a candidate name and checks the domain, the
  trademark registers and the social handles at the same time. Run it before
  anyone in the room falls in love with the name.

### Colour and type

- **Colour system tool.** One place where you set the palette and get hex, rgb,
  cmyk, pantone and ral together. It warns you when a colour cannot be printed,
  checks contrast for accessibility, and previews how the colour will look on
  uncoated stock. Picking a screen colour that cannot be printed is a mistake
  you only find out about at the proof.
- **Type licence calculator.** You describe the client, including how many
  employees they have, how much web traffic they get, and whether there is an
  app or any broadcast use. It tells you what each candidate typeface costs
  across the foundries and what the licence actually permits. This is a common
  source of a bill nobody expected.

### During revisions

- **Version diff for the client.** It shows this round against the last one and
  marks what changed. The client sees the work instead of asking what is
  different, which is the question that makes a designer feel unpaid.
- **Route comparison sheet.** It lays three directions side by side in the same
  applications at the same size. The client then compares the idea rather than
  which route happened to get the better mockup.

### After handoff

- **Consistency checker.** The client uploads a deck or a web page and it flags a
  stretched mark, an old logo file, an off brand colour and a wrong typeface.
  Sell it as a yearly retainer, because the problem it solves never goes away.
- **Asset portal.** One link where the client's team asks for the file they need
  by describing where it is going, and gets the correct version. It replaces the
  situation where somebody uses whatever logo they found in an old email.

### Motion and social

- **Motion identity generator.** It animates the static mark using a set of
  presets and exports Lottie, MP4 and GIF at the sizes each platform asks for.
  Most clients now expect a moving version of the mark, and most brand designers
  are not motion designers.
- **Social kit generator.** Every profile picture, cover image, story and post
  template for each platform at the current sizes. The platforms change those
  sizes often enough that a kit made by hand is out of date within a year.

## 5.0 What actually needs AI

None of it. Every one of the seventeen tools above can be built with ordinary
code that does the same thing every time. That is the useful finding here, and
it is not an accident. Brand production is mechanical file work, and mechanical
file work is what plain code has always been good at.

Several of them are better without a model. Reading the colours off a website is
exact when you read the computed styles, and a guess when you ask a model to
look at a screenshot. A calculation you can check once and then trust is worth
more than an answer you have to check every time.

| Tool | What does the work instead | Free library |
|---|---|---|
| Mockup engine | A displacement map for the surface, a perspective transform, and a multiply blend for the shadow | ImageMagick, or a WebGL shader |
| Lockup and variation generator | Transforms and fill swaps on the master SVG. Clear space is the bounding box times a factor. Minimum size is the thinnest stroke measured against 0.5pt | resvg, svgo |
| Guidelines generator | Computed geometry for the diagrams, then HTML laid out and printed to PDF | Headless Chrome, or Typst |
| Presentation builder | Placing images and text into your template | Headless Chrome |
| Delivery packager | Format conversion, resizing and zipping | resvg, ImageMagick |
| Brand audit scraper | Reading the computed styles off every element in the page. This is exact, not a guess, so a model would make it worse | Playwright |
| Competitor landscape board | The scraper again, run once per competitor | Playwright |
| Moodboard with licensing | Recording where an image came from at the moment you save it | Any database |
| Naming checker | Lookups against public registries | RDAP, the USPTO and EUIPO APIs |
| Colour system tool | Colour science. Conversion and out of gamut checks are ICC soft proofing, and contrast is the WCAG formula | littleCMS with the free ECI profiles |
| Type licence calculator | A dataset you build and maintain by hand. There is no clever part | None. The work is the data |
| Version diff | Rasterise both rounds and compare pixels, or compare the SVG path data directly | resvg, pixelmatch |
| Route comparison sheet | The mockup engine, run three times into a fixed layout | Same as the engine |
| Consistency checker | Pulling the colour values and embedded font names straight out of the PDF, plus a perceptual hash to spot an old logo file | pdfplumber, imagehash |
| Asset portal | A lookup table from context to file | Any database |
| Motion identity generator | Keyframe maths written straight into Lottie JSON, then rendered out | ffmpeg |
| Social kit generator | Fixed dimensions per platform held in a data file you edit | ImageMagick |

### Where a model does help

There is one place on the list, and it is optional. Adding a mockup by hand
means drawing a displacement map and a lighting map in Photoshop, and that is
where the hour per mockup goes. A depth estimation model produces the
displacement map from any photograph in about a second, and a segmentation model
picks out the surface you want the mark to sit on. An hour becomes a few
minutes, and you can then add a mockup from any photo you shoot on your phone.

The model runs on your own machine and costs nothing per use. Check the licence
on the exact model you pick, because they differ inside the same project. Depth
Anything V2 releases its smallest model under a permissive licence and its
larger ones under a non commercial licence, so the larger ones are fine in your
studio and not fine in a product you sell. MiDaS is MIT and safe either way.

Two smaller uses, neither of them part of the product. A model can read type
licence PDFs into a spreadsheet as a one time helper, though you should check
every row by hand afterwards because a wrong answer costs your client money. A
local embedding model can power free text search in the asset portal, so
somebody can type "the one for a dark background on Instagram". Keyword matching
also works.

### The real blockers are licences, not AI

This is where the actual cost sits, and it is the part people miss.

- **Pantone.** The colour library is proprietary and Pantone enforces it. You
  cannot ship a table that turns a hex value into a Pantone number. Let the
  designer enter the Pantone they picked and store it. Do not generate it.
- **The mockup photographs.** This is the true cost of the mockup engine, not the
  code. Stock licences allow commercial use but not resale of the photograph
  itself, and a mockup product sits close to that line. Shoot your own. It is
  slower to start and it is also what makes the library impossible to copy.
- **Ghostscript is AGPL.** Fine inside your studio, a problem the day you sell
  the tool. Use resvg for SVG to PNG and PDF, and write EPS straight from the
  path data, which is simple PostScript.
- **PyMuPDF is AGPL as well.** Read PDFs with pdfplumber instead, which is MIT.
- **Fonts inside a generated PDF.** Embedding the client's typeface in a document
  your tool produces needs the right licence. It is usually covered. Check it
  once per project rather than never.
- **Automated social handle checking** is against the terms of most platforms.
  Domains through RDAP and trademarks through the USPTO and EUIPO are free and
  allowed.

Verify every licence yourself before you sell anything built on this. Licence
terms change, and the ones above are what I understand them to be today rather
than legal advice.

### The whole stack, free

- Image maths: ImageMagick or a WebGL shader.
- SVG in and out: resvg and svgo.
- Colour and print: littleCMS with the free ECI profiles.
- PDF out: headless Chrome or Typst.
- PDF in: pdfplumber.
- Video and GIF: ffmpeg.
- Page scraping: Playwright.
- Image hashing: imagehash.
- Pixel diffing: pixelmatch.
- Depth maps, optional: MiDaS.
- Cutouts, optional: Segment Anything.
- Registries: RDAP, the USPTO and EUIPO.

Nothing on this list needs a service you pay for by the call. The two optional
models run on your own machine. Your recurring cost for all seventeen tools is
the electricity.

## 6.0 What not to build

**Do not build a logo generator.** That market is crowded, the output is poor,
and it competes with the one part of the job clients actually pay a designer
for. Every tool on this list deliberately starts after the mark exists.

**Do not sell mockup files one at a time.** The marketplace for PSD mockups is
crowded and the prices are low. The engine that renders any mark into any mockup
is a different product and a much better one.

The tools worth your time need something only a working studio has:

- **Your mockup library**, which grows with every project and takes years to
  match.
- **Your layouts** for decks and guidelines, so the output already looks like
  your studio made it.
- **Your client relationships**, which is what makes the consistency checker and
  the asset portal sellable as a retainer rather than a one off.

## 7.0 What to build first

- **Weeks 1 to 2. Delivery packager.** Small and self contained. It fixes the job
  you are most likely to get wrong, because it happens when you are tired at the
  end of a project.
- **Weeks 3 to 6. Mockup engine.** The largest win by a wide margin. Build the
  pipeline with five mockups first and check that the output looks like a real
  photograph. If it does not, nothing else matters, so find that out in week
  three rather than week six.
- **Weeks 7 to 8. Lockup and variation generator.** By now you will have written
  down your own naming and variant conventions, which is the input this tool
  needs.
- **Weeks 9 to 13. Guidelines generator, then the presentation builder.** Both
  sit on top of the first three, so neither makes sense before them.

Use every one of them on real client work before you sell any of them. A month
of your own projects tells you which parts of the idea were wrong, and brand
designers can tell within a minute whether a tool was made by somebody who does
the work.

One of these is a business and the rest are time savers. The mockup engine is
the one. Every brand studio has the same problem, the output is easy to show in
a single image, and the photo library you build becomes the reason a competitor
cannot catch up. Build the other four for yourself. Build that one for
everybody.
