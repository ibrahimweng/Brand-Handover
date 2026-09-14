/* The pattern studio, in the package.

   A brand package is usually a folder of finished files: whatever the engine
   decided, frozen. The pattern is the one part of an identity that a client
   genuinely needs to keep making — a different scale for an endpaper than for a
   tote, a quieter one behind type, a louder one on a van — and handing over
   twelve SVGs means every one of those is a phone call.

   So the parameters ship, not only the pictures. This draws the same generators
   the build drew, from the same files, starting from what the engine chose, and
   exports SVG and PNG at any size. Nothing is uploaded and nothing is fetched:
   open the file and it works.

   The one rule it will not let go of is the one the mark set. A control that
   would draw finer than twice the thinnest thing in the mark says so and shows
   the size at which it stops holding, rather than refusing — the client owns
   the identity, and an engine that silently overrules them is worse than one
   that tells them what they are doing. */
(function () {
  'use strict';
  const PE = window.PatternEngine, PAL = window.PatternPalette, SURF = window.PatternSurface;
  const B = window.PATTERN_BUNDLE;
  const $ = (s, r) => (r || document).querySelector(s);
  const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const KEY = `pattern-studio:${B.brand}`;
  let state = null;
  try { const saved = localStorage.getItem(KEY); if (saved) state = JSON.parse(saved); } catch (_) {}
  if (!state || !state.generator) {
    state = { generator: B.chose, colourway: B.colourways[0].name,
      params: Object.assign({}, (B.made.find((m) => m.generator === B.chose) || B.made[0]).params) };
  }
  const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {} };

  const gen = () => PE.GENERATORS[state.generator];
  // One question, asked one way. Two spellings of it — `vector !== false` where
  // the button is enabled and `!vector` where the click is handled — agree on
  // every generator that declares the flag and disagree on one that forgets it,
  // which is an enabled button that refuses.
  const isVector = () => gen().vector !== false;
  const way = () => B.colourways.find((c) => c.name === state.colourway) || B.colourways[0];
  const pal = () => PAL.of(B.colours, way());

  // The shape this identity's pattern is made of.
  //
  // It travels in the built parameters rather than beside them, and every
  // generator that carries one carries the same one, so the first that has it
  // answers for all of them. Without this, switching to `lattice` in the studio
  // derives its numbers from no shape and draws an empty ground — the generator
  // is nothing but the motif.
  const carrier = B.made.find((m) => m.params && m.params.motif);
  const motif = carrier ? carrier.params.motif : null;

  // What the engine would choose, so "back to what it chose" is always one
  // click away and the client can wander without losing the argument.
  const asBuilt = (g) => Object.assign({}, PE.derive(g, B.measured, B.route, motif),
    PE.GENERATORS[g].motif && motif ? { motif } : {});

  // ---------------------------------------------------------------- the tile
  // A tile is square; a poster is cut at its own proportion. Drawn square, a
  // 4:5 fly-poster comes out squashed, and the stage repeats it — which is a
  // poster shown as wallpaper.
  const ratio = () => PE.ratioOf(state.generator);
  const repeats = () => PE.tilesOf(state.generator);
  /* The generator, inside whatever effect layers are switched on.

     Every place that draws goes through this. There are five of them — the one
     tile, the sheet, the poster, the export and the kept thumbnails — and the
     first version left four of them calling the generator directly, so
     switching a layer on changed nothing anybody could see and the toggles
     looked broken. */
  function painted(surf, w, h, params, palette, g) {
    const G = g || gen();
    PE.LAYERS.paint(surf, w, h, params, palette,
      (s2, p2) => G.paint(s2, w, h, params, p2 || palette));
  }
  function tileSVG(size) {
    const w = size, h = Math.round((size / ratio()) * 1000) / 1000;
    const s = SURF.svg({ width: w, height: h, id: 'st' });
    painted(s, w, h, state.params, pal());
    return s;
  }

  // The finest thing this setting draws, against what the mark allows. Not a
  // refusal — a sentence, and the size at which it stops holding.
  function fineness() {
    // The finest thing each generator draws, in its own terms. A lattice draws
    // the motif's own stroke, and the motif's weight is a share of the box it
    // is drawn in — so at a scale of a fifth of the tile, a stroke of 7% of the
    // motif is 1.4% of the tile. Reading `cells` here, as this did before the
    // lattice existed, gave `undefined` and a note about a pattern finer than
    // the mark on every lattice in every package.
    // A poster has no tile to be fine or coarse. Asked for `cells` it returned
    // undefined and the note read "Holds from NaN px and NaN mm" — a sentence
    // about a repeat, printed under a finished page.
    if (!repeats()) return { poster: true, ratio: ratio() };
    const finest = state.generator === 'lattice'
      ? state.params.scale * Math.max(0.07, (motif && motif.weight) || 0.06)
      : state.generator === 'weave' ? 1 / state.params.cells : state.params.stripe;
    const allowed = 1 / Math.max(2, B.measured.fineness / PE.FINEST);
    const px = B.minStrokePx / finest;
    // Two different limits, because the two kinds of generator draw two
    // different things.
    //
    // `weave` and `zigzag` invent a structure — cells, stripes — and the rule
    // is that the invented structure must not be finer than half the mark's own
    // fineness, or a pattern printed beside the mark fails before the mark
    // does. A lattice invents nothing: it redraws the client's own artwork
    // smaller, and any small redrawing of a logo has strokes that are a smaller
    // share of the sheet than the logo's strokes are of the logo. Held to the
    // stripe rule it was over on every identity in the repository at its own
    // derived default — a warning that fires on healthy input, which is a
    // warning nobody reads by the third package.
    //
    // What can actually go wrong is the motif drawn so small that the mark's
    // own thinnest stroke falls under its floor at the size this is being cut
    // at. So the limit is the holding size against the export size — and it has
    // to be the export size, because a lattice has no size-independent bar at
    // all. The first version of this used a fixed 2400 px and was vacuous: the
    // motif-size slider bottoms out at 5% of the tile, which holds from 858 px,
    // so nothing the client could do would ever have tripped it.
    const cut = Number(($('#px') || {}).value) || 2400;
    const over = state.generator === 'lattice' ? Math.ceil(px) > cut : finest < allowed - 1e-9;
    return { finest, allowed, over, px: Math.ceil(px), cut,
      mm: Math.ceil((B.minStrokeMm / finest) * 10) / 10 };
  }

  function draw() {
    const size = B.tile;
    const svg = tileSVG(size);
    const body = svg.body();
    const box = $('#preview');
    const across = Math.max(1, Math.round(box.clientWidth / (state.zoom || 120)));
    const px = box.clientWidth / across;
    const down = Math.max(1, Math.ceil(box.clientHeight / px));
    // Laid out as nine-and-more copies of one paint rather than an SVG
    // <pattern>: the same reason the seam check does it, and here it also means
    // what is on screen is exactly what the file contains.
    const ph = Math.round((size / ratio()) * 1000) / 1000;
    let sheet;
    if (repeats()) {
      sheet = SURF.svg({ width: across * size, height: down * ph, id: 'sh' });
      for (let j = 0; j < down; j++) {
        for (let i = 0; i < across; i++) {
          sheet.save(); sheet.translate(i * size, j * ph);
          painted(sheet, size, ph, state.params, pal());
          sheet.restore();
        }
      }
    } else {
      // One page, whole. A poster laid out nine times is not what anybody is
      // looking at when they open this.
      sheet = SURF.svg({ width: size, height: ph, id: 'sh' });
      painted(sheet, size, ph, state.params, pal());
    }
    box.innerHTML = sheet.toSVG(`preserveAspectRatio="xMidYMid ${repeats() ? 'slice' : 'meet'}" `
      + 'style="width:100%;height:100%;display:block"');
    $('#one').innerHTML = svg.toSVG('style="width:100%;height:auto;display:block"');

    const f = fineness();
    $('#why').textContent = PE.because(state.generator, B.measured, state.params);
    $('#holds').className = f.over ? 'note over' : 'note';
    const cutAt = f.poster && f.ratio === 1 ? 'square'
      : f.poster ? `${f.ratio.toFixed(2)} as wide as it is tall` : '';
    $('#holds').textContent = f.poster
      ? `A finished page, cut ${cutAt}. It does not repeat: use it at the size it is cut, or `
        + 'export it at any size — it is vector, so there is none beyond which it stops being sharp.'
      : !f.over
      ? `Holds from ${f.px} px and ${f.mm} mm, which is the size the mark itself holds at or larger.`
      : state.generator === 'lattice'
        ? `Smaller than you are cutting it. The mark is drawn at `
          + `${(state.params.scale * 100).toFixed(0)}% of the tile here, so its thinnest stroke needs `
          + `${f.px} px to hold and this is being exported at ${f.cut} px. Draw the motif larger, `
          + 'or export bigger.'
        : `Finer than the mark. The thinnest thing here is ${(f.finest * 100).toFixed(2)}% of the tile, `
          + `where the mark allows ${(f.allowed * 100).toFixed(2)}%. It holds from ${f.px} px and ${f.mm} mm — `
          + 'below that the pattern goes before the mark does.';
    // Exactly what goes in project.json, and nothing else.
    //
    // It used to print the colourway alongside, which is not part of the
    // decision — a pattern is chosen once and drawn in every colourway the
    // project cuts. Pasting it back in would have said "this pattern, and only
    // in this one colour", which is not what anybody meant by copying it.
    $('#code').textContent = JSON.stringify({
      system: { patterns: { generator: state.generator, params: state.params } },
    }, null, 2);
    // The SVG button is not offered for a pattern that has no vector form, and
    // the note says which kind this is rather than leaving it to be discovered.
    // "One tile" is the wrong label for something that does not tile.
    const oneLabel = document.querySelector('[for=one], #one-h');
    if (oneLabel) oneLabel.textContent = repeats() ? 'One tile' : 'One page';
    const vector = isVector();
    $('#svg').disabled = !vector;
    $('#svg').title = vector ? '' : 'this pattern is raster — use PNG';
    $('#kind').textContent = vector
      ? 'Vector. It prints at any size.'
      : `Raster. At ${Number($('#px').value) || 2400} px it prints sharp to `
        + `${Math.round(((Number($('#px').value) || 2400) / (300 / 25.4)) * 10) / 10} mm at 300 dpi.`;
    keep();
  }

  // ------------------------------------------------------------- the controls

  /* One row, for any control against any parameters object.

     The generator's own controls and the nineteen effect layers' controls are
     the same shape — a key, a label, a type and a range — so they are rendered
     by the same function against different objects. The alternative was a
     second copy of this that would have drifted from the first the first time
     a control type was added. */
  function row(c, into, id, after) {
    const line = el('div', 'ctl');
    line.appendChild(el('label', 'k', `${esc(c.label)}<span class="v" id="${id}-v"></span>`));
    // A control that has nothing to work on says so, rather than sitting there
    // moving and drawing the same tile. Corner rounding takes the joins where
    // two straight runs meet, and two thirds of the drawings in this repository
    // are drawn in curves and have none.
    const want = c.needs && (state.params[c.needs.of] || {})[c.needs.key];
    const idle = !!c.needs && !(want >= c.needs.least);
    let input;
    if (c.type === 'range') {
      input = el('input'); input.type = 'range';
      input.min = c.min; input.max = c.max; input.step = c.step;
      input.value = into[c.key];
      input.addEventListener('input', () => {
        into[c.key] = Number(input.value);
        const v = $(`#${id}-v`);
        if (v) v.textContent = shown(c, into[c.key]);
        draw();
      });
    } else if (c.type === 'chips') {
      input = el('div', 'chips');
      for (const o of c.options) {
        const b = el('button', into[c.key] === o ? 'chip on' : 'chip', esc(o));
        b.addEventListener('click', () => { into[c.key] = o; (after || controls)(); draw(); });
        input.appendChild(b);
      }
    } else if (c.type === 'seed') {
      input = el('div', 'seedrow');
      const n = el('input'); n.type = 'number'; n.value = into[c.key] || 1; n.className = 'seed';
      n.addEventListener('input', () => { into[c.key] = Number(n.value) || 1; draw(); });
      const b = el('button', 'btn', 'New variation');
      b.addEventListener('click', () => {
        into[c.key] = (into[c.key] || 1) + 1;
        n.value = into[c.key]; draw();
      });
      input.appendChild(n); input.appendChild(b);
    }
    line.appendChild(input);
    if (idle) {
      line.classList.add('idle');
      if (input.tagName === 'INPUT') input.disabled = true;
      else input.querySelectorAll('button,input').forEach((n) => { n.disabled = true; });
      line.appendChild(el('p', 'cant', esc(c.needs.without)));
    }
    return { line, set: () => { const v = $(`#${id}-v`); if (v) v.textContent = shown(c, into[c.key]); } };
  }

  function controls() {
    const wrap = $('#controls');
    wrap.innerHTML = '';
    let group = null;
    for (const c of gen().controls) {
      // A heading whenever the group changes, so twelve controls read as two
      // short lists rather than one long one. Generators that declare no group
      // are unchanged: `undefined` never differs from `undefined`.
      if (c.group && c.group !== group) {
        group = c.group;
        if (group !== 'pattern') wrap.appendChild(el('div', 'grp', esc(GROUPS[group] || group)));
      }
      const r = row(c, state.params, `c-${c.key}`);
      wrap.appendChild(r.line);
      r.set();
    }
    effects(wrap);
  }

  /* The effect layers.

     Nineteen of them, each off until it is switched on, each with every one of
     its own parameters. They are listed in the order they stack rather than
     alphabetically, because the order is what they do: a ground under a fibre
     field makes the fibres lie along it, and moving one would be offering a
     control that does nothing.

     Switching one on sets its amount to something visible rather than to zero.
     A toggle that turns a thing on and leaves it looking identical is a toggle
     that appears broken, and the first version of this did exactly that. */
  function effects(wrap) {
    const FX = PE.LAYERS;
    if (!FX) return;
    if (!state.params.effects) state.params.effects = {};
    const fx = state.params.effects;
    wrap.appendChild(el('div', 'grp', 'Effect layers'));
    for (const key of FX.NAMES) {
      const on = !!(fx[key] && FX.live(fx[key]));
      const head = el('div', on ? 'fxhead on' : 'fxhead');
      const b = el('button', 'chip' + (on ? ' on' : ''), esc(FX.LAYERS[key].label));
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.addEventListener('click', () => {
        // Switched on at the channel the layer suggests, at something you can
        // see. A toggle that turns a thing on and leaves the page identical is
        // a toggle that looks broken.
        if (on) delete fx[key];
        else fx[key] = FX.wakeOf(key);
        controls(); draw();
      });
      head.appendChild(b);
      if (on) {
        /* The field itself, as a picture.

           A field is invisible until something is driven by it, which makes
           these controls hard to learn: a client turns Scale up and sees the
           pattern change in a way they cannot connect to anything. The thumbnail
           is the thing they are driving with. */
        const thumb = el('div', 'fxfield');
        const s = SURF.svg({ width: 60, height: 60, id: `fld-${key}` });
        FX.show(s, 60, 60, key, Object.assign({}, fx[key],
          { motif: state.params.motif, seed: state.params.seed }), 12);
        thumb.innerHTML = s.toSVG('style="width:100%;height:100%;display:block"');
        thumb.title = 'what this layer measures';
        head.appendChild(thumb);
      }
      wrap.appendChild(head);
      if (!on) continue;
      for (const c of FX.controlsOf(key)) {
        const r = row(c, fx[key], `fx-${key}-${c.key}`, () => { controls(); draw(); });
        r.line.classList.add('fxctl');
        wrap.appendChild(r.line);
        r.set();
      }
    }
  }

  // Every group any generator declares, named by the engine rather than here:
  // two copies of this map is two things to forget to update, and the second
  // one was already a line behind the first.
  const GROUPS = PE.GROUPS;
  const shown = (c, v) => {
    if (c.type !== 'range') return '';
    return c.max <= 2.5 ? `${Math.round(v * 100)}%` : String(v);
  };

  function rails() {
    const g = $('#gens'); g.innerHTML = '';
    for (const name of PE.NAMES) {
      const b = el('button', state.generator === name ? 'chip on' : 'chip', esc(name));
      b.addEventListener('click', () => {
        state.generator = name; state.params = asBuilt(name); controls(); rails(); draw();
      });
      g.appendChild(b);
    }
    const c = $('#ways'); c.innerHTML = '';
    for (const w of B.colourways) {
      const b = el('button', state.colourway === w.name ? 'chip on' : 'chip', esc(w.name));
      b.addEventListener('click', () => { state.colourway = w.name; rails(); draw(); });
      c.appendChild(b);
    }
    const sw = $('#swatches'); sw.innerHTML = '';
    const p = pal();
    for (const [hex, label] of [[p.ground, 'ground']].concat(p.inks.map((i) => [i.hex, i.name]))) {
      const s = el('span', 'sw');
      s.style.background = hex;
      s.title = `${label} ${hex}`;
      sw.appendChild(s);
    }
  }

  // ---------------------------------------------------------------- exporting
  const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '').replace('T', '-');
  function download(name, text, type) {
    const blob = new Blob([text], { type: type || 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 400);
    say(`${name} saved`);
  }
  function say(text) {
    const n = $('#said'); n.textContent = text;
    clearTimeout(say.t); say.t = setTimeout(() => { n.textContent = ''; }, 2600);
  }

  function exportPNG() {
    const size = Number($('#px').value) || 2400;
    // The same paint, on a canvas, at whatever size was asked for — which is
    // the whole point of the surface contract. A 2400 px export and the tile on
    // screen cannot be different pictures.
    const cv = document.createElement('canvas');
    cv.width = size; cv.height = size;
    const ctx = cv.getContext('2d');
    const s = SURF.canvas(ctx, B.tile, B.tile);
    ctx.scale(size / B.tile, size / B.tile);
    painted(s, B.tile, B.tile, state.params, pal());
    cv.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${B.slug}-${state.generator}-${state.colourway}-${stamp()}.png`;
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 400);
      say('PNG saved');
    }, 'image/png');
  }

  // ------------------------------------------------------------------ saving
  function saved() {
    let list = [];
    try { list = JSON.parse(localStorage.getItem(`${KEY}:kept`) || '[]'); } catch (_) {}
    return list;
  }
  function drawSaved() {
    const row = $('#kept'); row.innerHTML = '';
    const list = saved();
    if (!list.length) { row.appendChild(el('span', 'quiet', 'Nothing kept yet. Keep one and it stays in this browser.')); return; }
    list.forEach((k, i) => {
      const b = el('button', 'keptone');
      const s = SURF.svg({ width: B.tile, height: B.tile, id: `k${i}` });
      const p = PAL.of(B.colours, B.colourways.find((c) => c.name === k.colourway) || B.colourways[0]);
      painted(s, B.tile, B.tile, k.params, p, PE.GENERATORS[k.generator]);
      b.innerHTML = s.toSVG('style="width:100%;height:100%;display:block"');
      b.title = `${k.generator} · ${k.colourway}`;
      b.addEventListener('click', () => {
        state = { generator: k.generator, colourway: k.colourway, params: Object.assign({}, k.params) };
        controls(); rails(); draw();
      });
      const x = el('button', 'x', '×');
      x.title = 'Forget this one';
      x.addEventListener('click', (e) => {
        e.stopPropagation();
        const next = saved(); next.splice(i, 1);
        localStorage.setItem(`${KEY}:kept`, JSON.stringify(next)); drawSaved();
      });
      const cell = el('span', 'keptcell'); cell.appendChild(b); cell.appendChild(x);
      row.appendChild(cell);
    });
  }

  // -------------------------------------------------------------------- wire
  $('#svg').addEventListener('click', () => {
    // Four of the five generators are vector; one decides per pixel and has no
    // honest vector form. Rather than hand over an SVG that is not the picture,
    // it says so and offers the PNG instead.
    if (!isVector()) { say('this one is a raster pattern — use PNG'); return; }
    download(`${B.slug}-${state.generator}-${state.colourway}-${stamp()}.svg`, tileSVG(B.tile).toSVG());
  });
  $('#png').addEventListener('click', exportPNG);
  $('#px').addEventListener('input', draw);
  $('#copy').addEventListener('click', () => {
    const text = $('#code').textContent;
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => say('parameters copied'), () => say('could not copy'));
    else say('this browser will not copy for us — select the text instead');
  });
  $('#keepit').addEventListener('click', () => {
    const list = saved();
    list.unshift({ generator: state.generator, colourway: state.colourway, params: Object.assign({}, state.params) });
    localStorage.setItem(`${KEY}:kept`, JSON.stringify(list.slice(0, 24)));
    drawSaved(); say('kept in this browser');
  });
  $('#revert').addEventListener('click', () => {
    state.params = asBuilt(state.generator); controls(); draw(); say('back to what the engine chose');
  });
  $('#zoom').addEventListener('input', (e) => { state.zoom = Number(e.target.value); draw(); });
  window.addEventListener('resize', draw);

  rails(); controls(); drawSaved(); draw();
}());
