#!/usr/bin/env python3
"""Cut a font down to the characters an identity actually sets.

A subset is subset to what somebody knew about when it was cut, and this one
has now been re-cut twice — once when the Japanese dictionary arrived and the
type specimen's own sample turned out to use a character the font did not have,
and once when a single word was added to that dictionary and took 材 with it.
Both times the method was worked out again from nothing, because it lived in
somebody's terminal history rather than in the repository. It lives here now.

    python3 engine/tools/subset-font.py <source.ttf> <out.ttf> <chars-file>...

Every argument after the output is a file whose entire text is treated as
characters the font must be able to draw. Pass the identity's project file, its
documents, or src/strings.js — whatever the font has to cover.

The cut is lean on purpose: hinting and subroutines come out. Measured against
the subset this replaced, all 726 shared characters keep the same advance width
and the same bounding box to the unit, and the file is smaller.

Nothing in the build runs this. Fonts are cut by hand, rarely, and the result is
committed; what this file is for is that the next person does not have to
reinvent it. Check the result with test/font-check.mjs, which asks a browser
whether every character on every page is drawn by a face the package ships.
"""
import sys
from fontTools.ttLib import TTFont
from fontTools.subset import Subsetter, Options

if len(sys.argv) < 4:
    sys.exit(__doc__)

src, out, sources = sys.argv[1], sys.argv[2], sys.argv[3:]
want = set()
for path in sources:
    with open(path, encoding='utf-8', errors='ignore') as fh:
        want |= {ord(ch) for ch in fh.read()}
want |= {ord(ch) for ch in ' \t\n'}                 # never leave the space out

font = TTFont(src)
have = set(font.getBestCmap())
missing = sorted(want - have)
opts = Options()
opts.hinting = False
opts.desubroutinize = False
opts.notdef_outline = True
sub = Subsetter(options=opts)
sub.populate(unicodes=want & have)
sub.subset(font)
font.save(out)

kept = TTFont(out)
print('%d characters asked for, %d in the source, %d written, %d glyphs'
      % (len(want), len(want & have), len(kept.getBestCmap()), kept['maxp'].numGlyphs))
if missing:
    show = ''.join(chr(c) for c in missing[:40])
    print('%d asked for that %s does not have: %s' % (len(missing), src, show))
