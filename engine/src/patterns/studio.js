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

  // What the engine would choose, so "back to what it chose" is always one
  // click away and the client can wander without losing the argument.
  const asBuilt = (g) => Object.assign({}, PE.derive(g, B.measured));

  // ---------------------------------------------------------------- the tile
  function tileSVG(size) {
    const s = SURF.svg({ width: size, height: size, id: 'st' });
    gen().paint(s, size, size, state.params, pal());
    return s;
  }

  // The finest thing this setting draws, against what the mark allows. Not a
  // refusal — a sentence, and the size at which it stops holding.
  function fineness() {
    const finest = state.generator === 'weave' ? 1 / state.params.cells : state.params.stripe;
    const allowed = 1 / Math.max(2, B.measured.fineness / PE.FINEST);
    const px = B.minStrokePx / finest;
    return { finest, allowed, over: finest < allowed - 1e-9, px: Math.ceil(px),
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
    const sheet = SURF.svg({ width: across * size, height: down * size, id: 'sh' });
    for (let j = 0; j < down; j++) {
      for (let i = 0; i < across; i++) {
        sheet.save(); sheet.translate(i * size, j * size);
        gen().paint(sheet, size, size, state.params, pal());
        sheet.restore();
      }
    }
    box.innerHTML = sheet.toSVG('preserveAspectRatio="xMidYMid slice" style="width:100%;height:100%;display:block"');
    $('#one').innerHTML = svg.toSVG('style="width:100%;height:auto;display:block"');

    const f = fineness();
    $('#why').textContent = PE.because(state.generator, B.measured, state.params);
    $('#holds').className = f.over ? 'note over' : 'note';
    $('#holds').textContent = f.over
      ? `Finer than the mark. The thinnest thing here is ${(f.finest * 100).toFixed(2)}% of the tile, `
        + `where the mark allows ${(f.allowed * 100).toFixed(2)}%. It holds from ${f.px} px and ${f.mm} mm — `
        + 'below that the pattern goes before the mark does.'
      : `Holds from ${f.px} px and ${f.mm} mm, which is the size the mark itself holds at or larger.`;
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
  function controls() {
    const wrap = $('#controls');
    wrap.innerHTML = '';
    for (const c of gen().controls) {
      const row = el('div', 'ctl');
      const id = `c-${c.key}`;
      row.appendChild(el('label', 'k', `${esc(c.label)}<span class="v" id="${id}-v"></span>`));
      let input;
      if (c.type === 'range') {
        input = el('input'); input.type = 'range';
        input.min = c.min; input.max = c.max; input.step = c.step;
        input.value = state.params[c.key];
        input.addEventListener('input', () => {
          state.params[c.key] = Number(input.value);
          $(`#${id}-v`).textContent = shown(c, state.params[c.key]);
          draw();
        });
      } else if (c.type === 'chips') {
        input = el('div', 'chips');
        for (const o of c.options) {
          const b = el('button', state.params[c.key] === o ? 'chip on' : 'chip', esc(o));
          b.addEventListener('click', () => { state.params[c.key] = o; controls(); draw(); });
          input.appendChild(b);
        }
      } else if (c.type === 'seed') {
        input = el('div', 'seedrow');
        const n = el('input'); n.type = 'number'; n.value = state.params[c.key] || 1; n.className = 'seed';
        n.addEventListener('input', () => { state.params[c.key] = Number(n.value) || 1; draw(); });
        const b = el('button', 'btn', 'New variation');
        b.addEventListener('click', () => {
          state.params[c.key] = (state.params[c.key] || 1) + 1;
          n.value = state.params[c.key]; draw();
        });
        input.appendChild(n); input.appendChild(b);
      }
      row.appendChild(input);
      wrap.appendChild(row);
      const v = $(`#${id}-v`);
      if (v) v.textContent = shown(c, state.params[c.key]);
    }
  }
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
    gen().paint(s, B.tile, B.tile, state.params, pal());
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
      PE.GENERATORS[k.generator].paint(s, B.tile, B.tile, k.params, p);
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
