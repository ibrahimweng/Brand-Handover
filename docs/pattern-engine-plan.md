# The pattern engine

A plan for generating brand patterns the way PLAYGRND generates artwork, and
for handing the controls to the client.

## What is there now

`src/pattern.js` is a **motif-repeat** engine. It reads every shape in the
master, ranks them by how well each carries a repeat, tiles the best one, and
says which it chose and why. Seven constructions — straight grid, half-drop,
brick, rotary, mirror, scale, scatter. Output is SVG tiles in `07-pattern/`,
one per density per colourway.

It works, it is measured off the artwork, and it is tested. Nothing here
replaces it.

What it cannot do is make a pattern that is not the logo repeated. Every
identity gets the same seven answers, and the only choices a designer has are
*which shape* and *which construction*. There is no field, no texture, no
weave, no way for the pattern to be a thing in its own right that happens to
be built from the identity's own measurements.

## What PLAYGRND does that is worth taking

Not the pictures — the method. Four ideas, in the order they matter.

**One paint function, every surface.** `paint(ctx, W, H, frame)` draws one
complete image and is pure with respect to state and seed. The screen preview,
the 2400 px export, the SVG recorder and the video encoder all call *that same
function*. That is what guarantees the vector file and the raster file can never
drift, and it is the whole architecture in one line.

**Everything derived from one unit.** Never read the canvas size from a global.
Every dimension comes from `W`, `H`, or `U = √(W·H)`. A generator written that
way is resolution-free by construction.

**Seeded, never random.** No `Math.random()` anywhere. Sub-systems derive their
own streams (`Math.imul(seed, 2654435761)`) so moving one slider does not
re-deal everything else.

**4-D noise closes the loop.** Animation is exact because the two extra noise
axes trace a circle: `z = cos φ`, `w = sin φ`. Come back round and you are
where you started.

That last one is the key to this whole plan, for a reason PLAYGRND never needed.

## The one thing PLAYGRND does not have to do

PLAYGRND makes pictures. A brand pattern has to **tile**. Put four of them
together and the seam must not be findable.

The same trick that closes an animation closes a tile. Sample the noise on a
torus: `x → (cos 2πu, sin 2πu)` and `y → (cos 2πv, sin 2πv)`, and the field is
periodic in both directions by construction — not smoothed, not mirrored, not
cross-faded. Exactly periodic. The 4-D noise PLAYGRND uses for *time* is the
same 4-D noise this needs for *space*, and a generator that wants both gets
6-D for free.

So: one noise function, and seamlessness is not a post-process.

For the generators that are not fields:

- **Index grids** (weave, field) tile if the index expression is periodic in
  whole cells. It is arithmetic — nothing to smooth.
- **Streamlines** (thread) integrate on the torus and wrap. `pattern.js`
  already has `wrapped()` for drawing an instance nine times and clipping to
  the tile; it does the same job here.

And a check, not an assertion: lay the tile 3×3, measure the gradient energy
along the seam lines against the gradient energy in the interior, and refuse a
tile where the seam is measurably different. A seam you can find is a fault the
engine can find first.

## Six generators

Named for what they make. Five new, and the one that is there already.

| | Makes | From | Output |
|---|---|---|---|
| `weave` | index-grid blankets, mirror-symmetric, whole-cell | Quilt | vector |
| `zigzag` | interlocking rounded chevrons, stairs, scales | Zig | vector |
| `field` | pixel compositions on a cell grid, marks optional | Oddgrid | vector |
| `thread` | streamline fields on a direction field | Filament | vector |
| `terrace` | posterised contour bands from warped noise | Terrain | raster |
| `repeat` | the mark itself, tiled seven ways | *(here already)* | vector |

Five of the six are vector: run-length-merged rectangles, merged collinear
segments, rounded closed polygons. They go into `07-pattern/` as SVG, print at
any size, and recolour by editing an attribute.

`terrace` is a per-pixel field and has no honest vector form. It ships as
raster at declared print sizes, and the manual says so in those words — a
pattern that cannot be scaled without loss is a fact a client needs, not a
thing to hide. A small deterministic PNG writer (Node's own `zlib`, no
dependency) does the encoding, so the build stays reproducible.

## How a pattern becomes *this* identity's pattern

The rule this engine already follows everywhere: measure, never type. The old
pattern module had `tile: 100, weight: 3` — numbers that describe no particular
drawing. Every default here comes off the artwork.

| The generator wants | It is measured from |
|---|---|
| the finest line it may draw | `minimumSize.thinnestStroke` — a pattern finer than the mark's own minimum cannot print |
| the module the grid steps on | the mark's measured ink box |
| stroke weight | the mark's measured stem |
| the dominant angle | the orientation histogram of the mark's own path data |
| corner rounding | the corner radii the mark actually uses |
| the palette and its roles | `rules.colourways`, roles assigned by relative luminance |
| the motif, where one is used | `pattern.js`'s existing `candidates()` and `rank()` |

Which means the engine can say *why* this identity got this pattern, in the same
voice it uses for the floor and the clear space, and a designer can check it.

## Matching a pattern the client already has

Not a trace. Measure theirs, then measure ours, and put the two columns of
numbers next to each other.

Six measurements, from the uploaded image:

1. **Palette** — dominant colours and their coverage shares, clustered in Lab.
2. **Scale** — the autocorrelation peak: the dominant period, in pixels.
3. **Orientation** — the gradient-direction histogram: axis-aligned, diagonal,
   or isotropic, and at what angle.
4. **Coverage** — the ink share.
5. **Regularity** — the height of that autocorrelation peak against its
   background. A sharp peak is a repeat; no peak is a field.
6. **Edge hardness** — the distribution of gradient magnitudes. Hard is
   posterised or vector; soft is gradient or noise.

Every generator declares which region of that six-dimensional space it can
reach. Score them, pick the closest, invert what can be inverted directly
(period → cell size, angle → rotation, coverage → fill, hardness → dither),
and fit the rest with a small deterministic search — a few dozen candidate
parameter sets, each scored by **re-measuring the generated tile with the same
six measurements**.

Then print both columns. "Yours repeats every 42 px, ours every 44. Yours is
61% ink, ours 59%." A claim anyone can check, which is the only kind this
engine is allowed to make.

**With no reference pattern**, the same six measurements run on the logo
instead. One input swapped, everything else identical.

## Where the controls live

One source of truth, three hosts — the discipline `publish.js` already uses to
be the same file in Node and in a browser.

`src/patterns/*.js` are UMD modules that run unchanged in both. Then:

- **`pattern-studio.html`** in the package, emitted the way `editor.html` is:
  everything inlined, no server, opens offline. Full control rig, seed field,
  presets, PNG / SVG / tile export, the client's own variations kept in
  `localStorage`. This is the file that makes the handover a thing the client
  keeps using rather than a thing they receive.
- **The hosted front door**, as a step before the build, so the chosen pattern's
  parameters are written into `project.json` and every rebuild reproduces it.
- **A `pattern` block in `editor.html`**, whose controls open in place — so a
  pattern can be retouched on a guidelines page or a deck slide while the guide
  is being put together, not exported and re-imported.

The control grammar is PLAYGRND's, because it is good and it is consistent:
groups, `range` / `chips` / `swatch` / `switch` / `file`, presets as chips that
set several controls at once, one seed, one new-variation button. The *look* is
this product's, not PLAYGRND's — the chrome belongs to the package.

## Reproducibility

Non-negotiable: 32 of 32 identities build byte-identical today and must after
this. Every generator is seeded and pure — no `Math.random()`, no clock. The
full parameter set and the seed go into `brand.json` under `pattern`, so the
package carries the recipe for its own artwork and a rebuild returns the same
bytes.

## Rounds

Each one shippable, each one provable on its own.

**A — the surface contract.** `paint(surface, W, H, S, frame)`; the canvas,
SVG and raster surfaces; tileable 4-D noise; the seeded PRNG; the PNG writer.
*Proved by:* rasterising the same paint through the canvas and SVG surfaces and
comparing them; and by the seam measurement on a 3×3 lay-up.

**B — two generators, end to end.** `weave` and `zigzag` — both pure vector and
hard-edged, so a fault has nowhere to hide. Wired into `build.js`, written into
`07-pattern/`, described in the manual, reproducible.

**C — the studio.** `pattern-studio.html` in the package: controls, presets,
export, saved variations.

**D — the field family.** `field`, `thread`, `terrace`; the raster path and the
PNG writer in anger.

**E — measurement and matching.** `match.js`: the six measurements, the
generator scoring, the parameter fit, the two columns in the manual. Logo
matching when no reference is given.

**F — the other two hosts.** The front-door step and the editor block.
