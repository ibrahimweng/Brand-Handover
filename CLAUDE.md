# Working on this engine

Conventions that were learned the hard way here. Each one is in this file
because something got through without it.

## Build it three ways and compare

**Whenever a change is meant to make outputs differ, build it along the axis it
varies and put the results side by side.** Not one build and a description of
what the others would look like — the actual outputs, next to each other.

This is here because of the pattern route. A question went in at the door, the
answer went into `project.json` and into `brand.json`, and it was handed to
`suits()` — which cannot answer `literal`, because literal is not a generator.
The route was recorded and read by nobody. A client answering "made of the logo"
got the same package, **byte for byte**, as one answering "in the spirit of the
logo". Three options, two answers.

Every test asked whether the route reached `brand.json`. It did, faithfully, for
weeks. None asked whether it changed anything.

> **A check that a value was written is not a check that it was used.**

It surfaced the first time three packages were built and the tiles compared: the
same file came out of two of three columns. The general failure is *a difference
that should exist and doesn't*, and it hides better than a wrong value, because
every individual output looks right.

## Look at it

Measurements miss things that are obvious on sight. All of these passed every
number the engine had:

- Two logos drawn as **strokes** were filled, turning rings into solid blobs;
  one open path with no enclosed area drew **nothing at all** while reporting
  six moves.
- `motif.js` was never inlined into `editor.html`, so the studio and the editor
  drew every pattern **silently without the mark in it** — right ground, right
  colours, no logo.
- A soft ground came out flat on three seeds in sixteen, then as a faint stain,
  against a "not flat" bar of 5% ink that was no bar at all.

Render it, open it, put it beside the artwork it came from.

## Measure rather than assert

- **A threshold must sit in a gap in the data.** Find the gap first, then put
  the bar in it, and write both numbers in the comment.
- **Prove a check has teeth by reverting exactly the thing under test.** A
  reversion that passes means the check is vacuous or you reverted something
  redundant — both have happened here.
- A reversion can pass for a third reason: the check is blind to that axis.
  Median-versus-mean passed because tooth depth is monotone in the radius
  whatever the radius says. The fix was to assert the claim the median is *for*.
- **Never cry wolf.** A check that fires on healthy input gets ignored, and then
  so does the one that matters.

## The two gates, and run them sequentially

    node --max-old-space-size=6144 engine/test/run.js     # ~17 min
    <battery: build all 33 fixtures twice, compare bytes>  # ~9 min

Run the suite, wait for it to exit, then the battery. They used to run together
and the container killed the suite — 12.3 GB against the cgroup limit, at test
121, **with no failure and no summary**, which reads exactly like a run still in
progress. Sequential is also faster in wall clock: 26 minutes against the 50 the
parallel run was taking before it died.

A non-zero exit with no `N passed` line is a kill, not a failure. Say so rather
than hunting a bug that is not there.

**Never edit source while either gate is running.** The contaminated files are
always the ones that inline source — `editor.html`, `pattern-studio.html`,
`usage.json`, the zip.

Subset while iterating: `node engine/test/run.js --only "<text>"` — plain
substring, not a regex. A filter matching nothing runs nothing and reports
nothing failed.

## Everything is measured off the artwork

No number in this engine describes "a pattern in general". The old module had
`tile: 100, weight: 3` and gave every identity the same pattern. If you are
about to type a constant into a generator, the question is what in the drawing
it should have come from.

`zigzag`'s tooth depth was `0.9` for every identity in the repository until
somebody asked what it was measuring. It was measuring nothing.

## Reproducibility

Seeded, never random. `SOURCE_DATE_EPOCH` for builds. 33 fixtures under
`engine/projects/*/project.json` must rebuild byte for byte — that is what the
battery checks, and it is why nothing may reach for wall-clock time or
`Math.random()`.
