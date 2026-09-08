/* The editor. Page layout, not illustration: fixed page sizes, a grid, and a
   known set of blocks. There is no pen tool on purpose, because vector drawing
   belongs in Illustrator and the mark arrives here finished.
   The canvas edits real DOM, so what is on screen is the same markup that gets
   published and printed. One layout engine, nothing to keep in sync. */
(function () {
  'use strict';
  const M = window.HandoverModel, R = window.HandoverRender, BUNDLE = window.HANDOVER_BUNDLE;
  const PH = window.HandoverPhotography, PR = window.HandoverPrint, SU = window.HandoverSurface;
  const $ = (s, r) => (r || document).querySelector(s);
  const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };
  const esc = R.esc;

  const KEY = 'handover:' + BUNDLE.brand;
  const IMGKEY = KEY + ':images';
  let doc = null;
  try { const saved = localStorage.getItem(KEY); if (saved) doc = JSON.parse(saved); } catch (_) {}
  if (!doc || !doc.pages || !doc.pages.length) doc = window.HANDOVER_DOC;
  // ids count on from whatever this document already holds, so a reload never
  // hands out one that is already in use
  M.seedIds(doc);

  // Images live beside the document, never in it, so undo clones a small object
  // and a nudge does not rewrite a photograph. See editor/images.js.
  const IM = window.HandoverImages;
  // Every word this file puts on the screen. The same lookup the renderer
  // uses, against the words the engine put in the bundle: see src/strings.js.
  const T = (k, v) => R.t(BUNDLE, k, v);
  let startImages = {};
  try { startImages = JSON.parse(localStorage.getItem(IMGKEY) || '{}'); } catch (_) {}
  const images = IM.store(Object.assign({}, window.HANDOVER_IMAGES || {}, startImages));
  images.prune(doc);
  const syncImages = () => { BUNDLE.images = images.all(); };
  syncImages();

  const H = M.history(doc);
  let pageId = H.get().pages[0].id;
  let selection = [];
  let scale = 1;
  let editing = null;
  let pickFor = null;

  const D = () => H.get();
  const page = () => M.findPage(D(), pageId) || D().pages[0];
  const blockById = (id) => page().blocks.find((b) => b.id === id);
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(D())); } catch (_) {} };
  // Written only when the store changes, because it is the big one.
  //
  // It deliberately does not prune. Deleting a block and pressing undo has to
  // bring the photograph back, and undo is a stack of past documents that this
  // store cannot see. So the store only grows while a session is open, and the
  // pruning happens at the two moments nothing can be undone into: when a
  // document is opened, and when one is written out.
  function persistImages() {
    syncImages();
    try { localStorage.setItem(IMGKEY, JSON.stringify(images.all())); }
    catch (_) {
      note(T(images.count() === 1 ? 'cvNoRoomOne' : 'cvNoRoomMany', { n: images.count() }), 'warn');
    }
  }

  function change(fn) { H.apply(fn); persist(); draw(); }

  // ------------------------------------------------------------- notices
  // The engine says what is wrong in words a designer uses, and the editor
  // should not fall back to alert() for the same job.
  function note(text, level) {
    const box = $('#notes');
    const n = el('div', 'note' + (level ? ' ' + level : ''), esc(text));
    const x = el('button', 'nx', '&times;');
    x.onclick = () => n.remove();
    n.appendChild(x);
    box.appendChild(n);
    if (level !== 'warn') setTimeout(() => n.remove(), 5200);
  }
  const findings = (list) => { for (const f of list) note(`${f.what} ${f.how}`, 'warn'); };

  // ------------------------------------------------------------- images
  // A photograph off a phone is four thousand pixels wide and a slot is four
  // hundred. Storing the original would fill the browser's quota with detail
  // no page can show, so it is resampled once, on the way in, to twice the
  // largest box on any page. Everything after that is small.
  const MAXEDGE = 2400;

  function readImage(file) {
    return new Promise((resolve, reject) => {
      if (!/^image\//.test(file.type)) {
        return reject(new Error(T('cvNotAnImage', { name: file.name })));
      }
      const r = new FileReader();
      r.onerror = () => reject(new Error(T('cvUnreadable', { name: file.name })));
      r.onload = () => {
        const raw = String(r.result);
        // vector art is resolution independent, so it is kept exactly as given
        if (file.type === 'image/svg+xml') {
          return resolve({ src: raw, w: 0, h: 0, vector: true, name: file.name });
        }
        const img = new Image();
        img.onerror = () => reject(new Error(T('cvUnopenable', { name: file.name })));
        img.onload = () => {
          const long = Math.max(img.naturalWidth, img.naturalHeight);
          const k = long > MAXEDGE ? MAXEDGE / long : 1;
          if (k === 1 && raw.length < 900000) {
            return resolve({ src: raw, w: img.naturalWidth, h: img.naturalHeight, name: file.name });
          }
          const c = document.createElement('canvas');
          c.width = Math.round(img.naturalWidth * k);
          c.height = Math.round(img.naturalHeight * k);
          const g = c.getContext('2d');
          g.drawImage(img, 0, 0, c.width, c.height);
          // PNG keeps transparency, and a photograph does not need it
          const clear = /png|webp|gif/.test(file.type);
          resolve({ src: c.toDataURL(clear ? 'image/png' : 'image/jpeg', 0.86),
            w: c.width, h: c.height, name: file.name });
        };
        img.src = raw;
      };
      r.readAsDataURL(file);
    });
  }

  async function placeImage(file, blockId) {
    let im;
    try { im = await readImage(file); }
    catch (e) { return note(e.message, 'warn'); }
    const id = images.add(im.src, { w: im.w, h: im.h, name: im.name, vector: im.vector || false });
    const b = blockById(blockId);
    change((d) => M.ops.setProps(d, pageId, blockId, { image: id }));
    persistImages();
    draw();
    if (b) {
      findings(IM.check(images.get(id), { w: b.w, h: b.h }, im.name));
      const ph = (BUNDLE.system || {}).photography;
      // a mockup is a photograph of a thing, not brand photography, so the
      // crop rule does not apply to it
      if (ph && b.type === 'slot') findings(PH.checkCrop(ph, { w: b.w, h: b.h }, im.name));
    }
  }

  // ------------------------------------------- the mark on a photograph
  // The one thing people actually get wrong with photography. Nobody misreads
  // a brief; they put the mark on a bright sky at 1.1 to 1 and it disappears.
  // That is arithmetic on the pixels underneath it, so the machine can do it.
  const OVER = ['mark', 'lockup'];
  let overlays = [];

  // A grid of patches rather than one average, because a mark over a sky that
  // is bright in one corner fails in that corner while the mean looks fine.
  const GX = 12, GY = 8;
  const sampler = document.createElement('canvas');
  sampler.width = GX; sampler.height = GY;

  function patchesOf(imgEl, src) {
    const g = sampler.getContext('2d', { willReadFrequently: true });
    g.clearRect(0, 0, GX, GY);
    try { g.drawImage(imgEl, src.x, src.y, src.w, src.h, 0, 0, GX, GY); }
    catch (_) { return null; }
    let data;
    try { data = g.getImageData(0, 0, GX, GY).data; }
    catch (_) { return null; }        // a tainted canvas, which a data URI is not
    // the raw pixel, not its luminance: the treatment has to be applied to it
    // before anything is measured, or the check reports a photograph nobody
    // will ever see
    const out = [];
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 8) continue;                    // transparent, nothing under
      const n = i / 4;
      out.push({ r: data[i] / 255, g: data[i + 1] / 255, b: data[i + 2] / 255,
        col: n % GX, row: Math.floor(n / GX) });
    }
    return out.length ? out : null;
  }

  // The pixels under a mockup's artwork: a grid over the surface itself, taken
  // through the same mapping the artwork uses, so it samples the thing the mark
  // is actually sitting on rather than the whole photograph.
  function surfacePatches(b, imgEl, im) {
    const quad = (b.props.quad && b.props.quad.length === 4) ? b.props.quad : SU.DEFAULT;
    const px = quad.map(([u, v]) => [u * b.w, v * b.h]);
    const H = SU.homography(px);
    const geo = IM.sourceRect(im, b, { fit: 'cover', focusX: 50, focusY: 50 });
    const g = sampler.getContext('2d', { willReadFrequently: true });
    const out = [];
    const N = 6;
    for (let iy = 0; iy < N; iy++) {
      for (let ix = 0; ix < N; ix++) {
        // inside the artwork's own margin, which is where legibility matters
        const u = 0.14 + (ix + 0.5) / N * 0.72, v = 0.14 + (iy + 0.5) / N * 0.72;
        const [bx, by] = SU.project(H, u, v);
        const src = geo.toSource({ x: bx, y: by, w: 1, h: 1 });
        if (src.x < 0 || src.y < 0 || src.x >= im.w || src.y >= im.h) continue;
        g.clearRect(0, 0, 1, 1);
        try { g.drawImage(imgEl, src.x, src.y, 1, 1, 0, 0, 1, 1); } catch (_) { return null; }
        let d;
        try { d = g.getImageData(0, 0, 1, 1).data; } catch (_) { return null; }
        if (d[3] < 8) continue;
        out.push({ r: d[0] / 255, g: d[1] / 255, b: d[2] / 255 });
      }
    }
    return out.length ? out : null;
  }

  function checkOverlays() {
    overlays = [];
    const blocks = page().blocks;
    const ways = Object.entries(BUNDLE.roles).map(([name, r]) => ({ name, hex: r.hex }));

    // a mockup carries its own artwork, so it is checked on its own
    for (const b of blocks) {
      if (b.type !== 'surface' || !b.props.image) continue;
      const im = images.get(b.props.image);
      const imgEl = sheet.querySelector(`.hb-block[data-id="${b.id}"] img`);
      if (!im || im.vector || !im.w || !imgEl || !imgEl.complete || !imgEl.naturalWidth) continue;
      const shape = SU.check(b.props.quad || SU.DEFAULT, b, {});
      if (shape.length) {
        overlays.push({ id: b.id, x: b.x, y: b.y, w: b.w, h: b.h,
          verdict: { ratio: '—', finding: shape[0] } });
        continue;
      }
      const patches = surfacePatches(b, imgEl, im);
      if (!patches) continue;
      const C = window.HandoverContrast;
      const hex = R.colour(BUNDLE, b.props.colourway);
      const [ir, ig, ib] = C.unit(hex);
      const a = SU.advise(C, { ink: { r: ir, g: ig, b: ib }, inkName: b.props.colourway,
        patches, mode: b.props.blend || 'multiply',
        opacity: b.props.opacity === undefined ? 1 : b.props.opacity, colourways: ways });
      if (a.ok) continue;
      overlays.push({ id: b.id, x: b.x, y: b.y, w: b.w, h: b.h, where: 'on the surface',
        verdict: { ratio: a.ratio, finding: a.finding, best: a.best } });
    }

    for (let i = 0; i < blocks.length; i++) {
      const under = blocks[i];
      if (under.type !== 'slot' || !under.props.image) continue;
      const im = images.get(under.props.image);
      if (!im || im.vector || !im.w) continue;
      const imgEl = sheet.querySelector(`.hb-block[data-id="${under.id}"] img`);
      if (!imgEl || !imgEl.complete || !imgEl.naturalWidth) continue;
      const geo = IM.sourceRect(im, under, under.props);
      // only what is drawn on top of the photograph counts
      for (let j = i + 1; j < blocks.length; j++) {
        const over = blocks[j];
        if (!OVER.includes(over.type)) continue;
        // a block with a ground of its own is not on the photograph, it is on
        // its own rectangle, and the contrast table already covers that pair
        if (over.props.on && over.props.on !== 'none') continue;
        const hit = IM.overlap(under, over);
        if (!hit) continue;
        const raw = patchesOf(imgEl, geo.toSource(hit));
        if (!raw) continue;

        // measured through the treatment, because that is what is on the page
        const rules = (BUNDLE.system || {}).photography;
        const treated = rules && rules.declared && under.props.treatment !== false;
        // where each patch sits in the image block, so a gradient scrim can be
        // read at that point rather than averaged into a number true nowhere
        const place = (px) => ({
          x: (hit.x + (px.col + 0.5) / GX * hit.w) / under.w,
          y: (hit.y + (px.row + 0.5) / GY * hit.h) / under.h,
        });
        const lit = raw.map((px) => {
          const l = treated
            ? PH.luminanceAfter(rules, BUNDLE, px, under.props.scrim, place(px))
            : window.HandoverContrast.luminanceOf(px.r, px.g, px.b);
          return { luminance: l, col: px.col, row: px.row };
        });
        const ink = R.colour(BUNDLE, over.props.colourway);
        const v = IM.overlayVerdict(ink, lit, { what: over.type === 'lockup' ? 'lockup' : 'mark' });
        if (!v || v.passes) continue;

        // Two ways out, and the scrim is the one that keeps the photograph.
        // Working out the strength by eye is what an opacity slider is for, and
        // it is guesswork on one person's screen; this is the number.
        const better = IM.bestColourway(ways.filter((w) => w.name !== over.props.colourway), lit);
        const scrimHex = PH.hexOf(BUNDLE, (rules && rules.scrim && rules.scrim.colour) || 'primary');
        const dir = (rules && rules.scrim && rules.scrim.direction) || 'bottom';
        const need = PH.scrimNeeded(ink,
          raw.map((px) => Object.assign(treated ? PH.treatPixel(rules, BUNDLE, px) : px, { at: place(px) })),
          scrimHex, dir);
        const scrimName = (rules && rules.scrim && rules.scrim.colour) || 'primary';
        const pct = (n) => `${Math.round(n * 100)}%`;
        const ways2 = [];
        if (need.needed) {
          ways2.push(T('cvWayScrim', { pc: pct(need.needed), ratio: need.ratio }));
        } else if (dir !== 'flat') {
          // a gradient can be strong at one end and absent where the mark is,
          // and that is a different problem from the scrim being too weak
          const flat = PH.scrimNeeded(ink,
            raw.map((px) => Object.assign(treated ? PH.treatPixel(rules, BUNDLE, px) : px, { at: place(px) })),
            scrimHex, 'flat');
          if (flat.needed) ways2.push(T('cvWayFlat', { pc: pct(flat.needed), colour: scrimName, dir, ratio: flat.ratio }));
        }
        if (better) ways2.push(T('cvWayColourway', { name: better.name, ratio: better.ratio }));
        const sentence = ways2.length === 0 ? null
          : ways2.length === 1 ? ways2[0][0].toUpperCase() + ways2[0].slice(1) + '.'
          : T('cvEither', { ways: ways2.join(T('cvOrJoin')) });
        v.finding.how = sentence || T('cvMoveMark', { why: need.why || '' }).trim();
        v.instead = better; v.scrim = need;
        overlays.push({ id: over.id, x: over.x, y: over.y, w: over.w, h: over.h, slot: under.id, verdict: v });
      }
    }
    drawOverlayWarnings();
  }

  function drawOverlayWarnings() {
    for (const n of overlay.querySelectorAll('.ovwarn')) n.remove();
    for (const o of overlays) {
      const n = el('div', 'ovwarn', o.verdict.ratio === '\u2014'
        ? 'the corners cross' : `${o.verdict.ratio}:1 ${o.where || T('cvOnThePicture')}`);
      n.style.cssText = `left:${o.x}px;top:${o.y + o.h}px`;
      n.title = o.verdict.finding.what + ' ' + o.verdict.finding.how;
      overlay.appendChild(n);
    }
  }
  const overlayFor = (id) => overlays.find((o) => o.id === id);

  let overTimer = null;
  const scheduleOverlayCheck = () => {
    clearTimeout(overTimer);
    overTimer = setTimeout(() => { try { checkOverlays(); } catch (_) {} }, 140);
  };

  // ------------------------------------------------------------- rendering
  const stage = $('#stage'), sheet = $('#sheet'), overlay = $('#overlay');

  // The size of the page being looked at, which is the document's unless this
  // page overrides it.
  const sheetOf = (p) => M.pageSize(D(), p || page());

  // The stage is the sheet that goes through the press; the page sits inside it.
  // Keeping #sheet at trim size and simply moving it means every coordinate in
  // the editor stays in trim space and none of the pointer maths knows bleed
  // exists. See src/print.js for the three boxes.
  const boxOf = (p) => PR.boxes(sheetOf(p), M.printSpec(D()));

  function fit() {
    const p = sheetOf(), b = boxOf(), box = $('#canvas').getBoundingClientRect();
    scale = Math.min((box.width - 80) / b.media.w, (box.height - 80) / b.media.h, 1.6);
    stage.style.transform = `scale(${scale})`;
    stage.style.width = b.media.w + 'px'; stage.style.height = b.media.h + 'px';
    stage.style.background = BUNDLE.roles.ground.hex;
    for (const n of [sheet, overlay]) {
      n.style.left = b.offset + 'px'; n.style.top = b.offsetY + 'px';
      n.style.width = p.w + 'px'; n.style.height = p.h + 'px';
    }
    sheet.style.overflow = b.bleed ? 'visible' : 'hidden';
    const guide = $('#trimline');
    guide.style.display = b.bleed ? 'block' : 'none';
    if (b.bleed) {
      guide.style.cssText += `;left:${b.offset}px;top:${b.offsetY}px;width:${p.w}px;height:${p.h}px`;
    }
    $('#zoom').textContent = Math.round(scale * 100) + '%';
    $('#sheetname').textContent = p.name + (b.bleed ? ` · ${T('cvBleedMm', { mm: b.bleedMm })}` : '');
    drawOverlay();
  }

  // What a block is, said out loud. Until the thirty-fourth round the editing
  // surface could only be worked with a pointer: four blocks on a page and not
  // one of them reachable by keyboard, so selecting, moving, resizing and
  // deleting — the whole of the application — were unavailable without a mouse.
  // Focus is the selection here, which is what a design tool does; the sentence
  // says which block, how big it is, where it sits and whether it is selected.
  function labelFor(b) {
    const on = selection.includes(b.id);
    return T('cvBlockName', { name: nameOf(b.type), w: Math.round(b.w), h: Math.round(b.h) })
      + T('cvBlockAt', { x: Math.round(b.x), y: Math.round(b.y) }) + (on ? T('cvBlockSelected') : '');
  }

  function wireBlocks() {
    const p = page();
    sheet.setAttribute('aria-label', T(p.blocks.length === 1 ? 'cvOneBlockOn' : 'cvBlocksOn', { n: p.blocks.length, page: p.name }));
    for (const node of sheet.querySelectorAll('.hb-block')) {
      const b = blockById(node.dataset.id);
      if (!b) continue;
      node.tabIndex = 0;
      node.setAttribute('aria-label', labelFor(b));
    }
  }

  function draw() {
    const p = page();
    const box = boxOf(p);
    sheet.innerHTML = p.blocks.map((b) => R.positioned(b, BUNDLE, sheetOf(p), box)).join('');
    sheet.style.background = BUNDLE.roles.ground.hex;
    fitSheet();
    wireBlocks();
    drawPages(); drawOverlay(); drawPanel(); drawHistory(); drawSizes();
    for (const im of sheet.querySelectorAll('img')) im.addEventListener('load', scheduleOverlayCheck, { once: true });
    scheduleOverlayCheck();
  }

  function drawOverlay() {
    overlay.innerHTML = '';
    // the selection moved; what each block says about itself moves with it
    for (const node of sheet.querySelectorAll('.hb-block')) {
      const b = blockById(node.dataset.id);
      if (b) node.setAttribute('aria-label', labelFor(b));
    }
    for (const id of selection) {
      const b = blockById(id); if (!b) continue;
      const box = el('div', 'sel');
      box.style.cssText = `left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px`;
      if (selection.length === 1) {
        for (const h of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
          const k = el('div', 'h h-' + h); k.dataset.handle = h; k.dataset.id = id; box.appendChild(k);
        }
        box.appendChild(el('span', 'tag', esc(nameOf(b.type))));
        // a mockup also has the four corners of the surface itself, which is
        // the whole interaction: you drag them onto the thing in the photograph
        if (b.type === 'surface') {
          const quad = (b.props.quad && b.props.quad.length === 4) ? b.props.quad : SU.DEFAULT;
          const wrap = el('div', 'quad');
          wrap.appendChild(el('div', 'quadline', quadSvg(quad, b)));
          quad.forEach(([u, v], i) => {
            const c = el('div', 'qh');
            c.style.cssText = `left:${u * b.w}px;top:${v * b.h}px`;
            c.dataset.corner = String(i); c.dataset.id = id;
            wrap.appendChild(c);
          });
          box.appendChild(wrap);
        }
      }
      overlay.appendChild(box);
    }
    drawOverlayWarnings();
    checkBleed();
  }

  // the outline of the surface, so the four corners read as a shape
  const quadSvg = (quad, b) =>
    `<svg width="${b.w}" height="${b.h}" viewBox="0 0 ${b.w} ${b.h}" style="display:block">`
    + `<polygon points="${quad.map(([u, v]) => `${u * b.w},${v * b.h}`).join(' ')}" `
    + `fill="none" stroke="var(--sel)" stroke-width="1" stroke-dasharray="5 4"/></svg>`;

  function drawPages() {
    const list = $('#pages'); list.innerHTML = '';
    D().pages.forEach((p, i) => {
      const row = el('button', 'pg' + (p.id === pageId ? ' on' : ''));
      row.setAttribute('role', 'listitem');
      if (p.id === pageId) row.setAttribute('aria-current', 'page');
      const own = p.page ? M.pageSize(D(), p).name : '';
      row.innerHTML = `<i>${String(i + 1).padStart(2, '0')}</i><span>${esc(p.name)}`
        + (own ? `<u>${esc(own)}</u>` : '') + `</span><em>${p.blocks.length}</em>`;
      row.onclick = () => { pageId = p.id; selection = []; draw(); };
      row.ondblclick = () => {
        const n = prompt(T('cvNamePage'), p.name);
        if (n) change((d) => M.ops.renamePage(d, p.id, n));
      };
      list.appendChild(row);
    });
  }

  // switching to a page of a different size has to resize the stage, and doing
  // it inside draw() keeps every caller honest without each one remembering
  function fitSheet() {
    const b = boxOf();
    if (stage.style.width === b.media.w + 'px' && sheet.style.width === b.trim.w + 'px') return;
    fit();
  }

  const drawHistory = () => {
    $('#undo').disabled = !H.canUndo(); $('#redo').disabled = !H.canRedo();
  };

  // ------------------------------------------------------------- panel
  const field = (label, input) => `<label class="f"><span>${esc(label)}</span>${input}</label>`;
  const NUM_NAME = { x: 'left', y: 'top', w: 'width', h: 'height' };
  const num = (k, v) => `<input type="number" data-num="${k}" value="${v}" aria-label="${esc(NUM_NAME[k] || k)}">`;
  // An option's value is code and its label is a word, and until this round
  // they were the same string. A colour or a lockup is named by the project and
  // stays as it is; left, center and cover are the engine's words and are not.
  const opts = (list, cur) => list.map((o) => {
    const v = Array.isArray(o) ? o[0] : o, label = Array.isArray(o) ? T(o[1]) : o;
    return `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(label)}</option>`;
  }).join('');
  const sel = (k, list, cur) => `<select data-prop="${k}">${opts(list, cur)}</select>`;
  const chk = (k, on) => `<input type="checkbox" data-prop="${k}"${on ? ' checked' : ''}>`;
  const rng = (k, v) => `<input type="range" min="0" max="100" step="1" data-prop="${k}" data-num-prop="1" value="${Number(v) || 0}">`;

  // What a block is called to a designer. The type name is the code's business.
  const NAME = {
    text: 'cvBlockText', rule: 'cvBlockRule', fill: 'cvBlockFill', slot: 'cvBlockSlot',
    surface: 'cvBlockSurface', mark: 'cvBlockMark', lockup: 'cvBlockLockup',
    construction: 'cvBlockConstruction', clearSpace: 'cvBlockClearSpace',
    minimumSize: 'cvBlockMinimumSize', palette: 'cvBlockPalette',
    contrast: 'cvBlockContrast', typeSpecimen: 'cvBlockTypeSpecimen',
    assetIndex: 'cvBlockAssetIndex', pattern: 'cvBlockPattern', iconGrid: 'cvBlockIconGrid',
    motion: 'cvBlockMotion', photography: 'cvBlockPhotography',
  };
  const nameOf = (t) => (NAME[t] ? T(NAME[t]) : t);

  const COLOURS = () => [...Object.keys(BUNDLE.roles), ...Object.keys(BUNDLE.colours)];
  // a block laid over a photograph needs no ground of its own
  const GROUNDS = () => [['none', 'cvNone'], ...COLOURS()];
  // the roles a pattern tile was actually cut for
  const PATTERN_INKS = () => {
    const seen = [];
    for (const k of Object.keys(BUNDLE.patternTiles || {})) {
      const role = k.slice(k.indexOf(':') + 1);
      if (seen.indexOf(role) < 0) seen.push(role);
    }
    return seen.length ? seen : COLOURS();
  };
  const STYLES = () => ((BUNDLE.type || {}).scale || []).map((s) => s.name);

  // A photograph follows the brand's treatment unless this one has a reason not
  // to. The scrim is the exception worth having per image: the check works out
  // the strength a particular picture needs, and that number has to go
  // somewhere other than back into the rule.
  function treatmentFields(b) {
    const r = (BUNDLE.system || {}).photography;
    if (!r || !r.declared) return '';
    const on = b.props.treatment !== false;
    const over = b.props.scrim;
    return field(T('cvTreatment'), chk('treatment', on))
      + (on ? `<p class="hint imeta">${esc(PH.describe(r, BUNDLE))}</p>` : '')
      + (on && r.scrim ? field(over == null ? T('cvScrimRule') : T('cvScrimOne'),
        `<input type="range" min="0" max="100" step="5" data-prop="scrim" data-num-prop="1" data-pct="1" value="${Math.round((over == null ? r.scrim.opacity : over) * 100)}">`) : '');
  }

  const PROPS = {
    text: (b) => field(T('cvText'), `<textarea data-prop="text" rows="4">${esc(b.props.text)}</textarea>`)
      + field(T('cvStyle'), sel('style', STYLES(), b.props.style))
      + field(T('cvAlign'), sel('align', [['left', 'cvLeft'], ['center', 'cvCentre'], ['right', 'cvRight']], b.props.align))
      + field(T('cvColour'), sel('colour', COLOURS(), b.props.colour)),
    rule: (b) => field(T('cvColour'), sel('colour', COLOURS(), b.props.colour)) + field(T('cvWeight'), `<input type="number" data-prop="weight" value="${b.props.weight}" min="1">`),
    fill: (b) => field(T('cvColour'), sel('colour', COLOURS(), b.props.colour)),
    slot: (b) => {
      const im = b.props.image && images.get(b.props.image);
      const head = im
        ? `<p class="hint imeta">${esc(im.name || T('cvAnImage'))} · ${im.vector ? T('cvVector') : im.w + ' \u00d7 ' + im.h}</p>`
        : `<p class="hint">${esc(T('cvDropImage'))}</p>`;
      return head
        + `<div class="ord"><button id="pick">${esc(T(im ? 'cvReplaceImage' : 'cvChooseImage'))}</button>`
        + (im ? `<button id="clearimg">${esc(T('cvRemove'))}</button>` : '') + `</div>`
        + (im ? field(T('cvFit'), sel('fit', [['cover', 'cvFitCover'], ['contain', 'cvFitContain']], b.props.fit))
            + (b.props.fit !== 'contain' ? field(T('cvFocusX'), rng('focusX', b.props.focusX))
              + field(T('cvFocusY'), rng('focusY', b.props.focusY)) : '')
            + treatmentFields(b) : '')
        + field(T('cvCaption'), `<input data-prop="caption" value="${esc(b.props.caption || '')}">`)
        + field(T('cvLabel'), `<input data-prop="label" value="${esc(b.props.label)}">`);
    },
    surface: (b) => {
      const im = b.props.image && images.get(b.props.image);
      return (im ? `<p class="hint imeta">${esc(im.name || T('cvAPhotograph'))} · ${im.w} \u00d7 ${im.h}</p>`
        : `<p class="hint">${esc(T('cvDropPhoto'))}</p>`)
        + `<div class="ord"><button id="pick">${esc(T(im ? 'cvReplacePhoto' : 'cvChoosePhoto'))}</button>`
        + (im ? `<button id="clearimg">${esc(T('cvRemove'))}</button>` : '') + `</div>`
        + field(T('cvPutOnIt'), sel('art', [['lockup', 'cvArtLockup'], ['mark', 'cvArtMarkOpt'], ['pattern', 'cvArtPatternOpt']], b.props.art))
        + (b.props.art === 'lockup' ? field(T('cvLockup'), sel('lockup', BUNDLE.lockups, b.props.lockup)) : '')
        + field(T('cvColourway'), sel('colourway', COLOURS(), b.props.colourway))
        + field(T('cvBlend'), sel('blend', [['multiply', 'cvBlendMultiply'], ['screen', 'cvBlendScreen'], ['normal', 'cvBlendNormal']], b.props.blend))
        + field(T('cvStrength'), `<input type="range" min="10" max="100" step="5" data-prop="opacity" data-num-prop="1" data-pct="1" value="${Math.round((b.props.opacity === undefined ? 1 : b.props.opacity) * 100)}">`)
        + field(T('cvSurfaceMm'), `<input type="number" min="0" step="1" data-prop="surfaceWidthMm" value="${b.props.surfaceWidthMm || 0}">`)
        + `<button class="ghost" id="resetquad">${esc(T('cvResetQuad'))}</button>`;
    },
    mark: (b) => field(T('cvColourway'), sel('colourway', COLOURS(), b.props.colourway)) + field(T('cvOn'), sel('on', GROUNDS(), b.props.on)),
    lockup: (b) => field(T('cvLockup'), sel('lockup', BUNDLE.lockups, b.props.lockup))
      + field(T('cvColourway'), sel('colourway', COLOURS(), b.props.colourway)) + field(T('cvOn'), sel('on', GROUNDS(), b.props.on)),
    construction: (b) => field(T('cvInk'), sel('colourway', COLOURS(), b.props.colourway || 'primary'))
      + field(T('cvOn'), sel('on', COLOURS(), b.props.on || 'ground')) + field(T('cvLines'), sel('line', COLOURS(), b.props.line || 'neutral')),
    minimumSize: (b) => field(T('cvInk'), sel('colourway', COLOURS(), b.props.colourway || 'primary'))
      + field(T('cvOn'), sel('on', COLOURS(), b.props.on || 'ground')),
    contrast: (b) => field(T('cvRows'), `<input type="number" data-prop="limit" value="${b.props.limit || 6}" min="1" max="${BUNDLE.contrast.length}">`),
    // The ink menu offers what there is a tile for, not the whole palette.
    // Tiles are cut per role and only where the ink can be seen on its ground,
    // so seven of meridian's ten menu entries had no tile behind them and the
    // block quietly drew a different colourway.
    pattern: (b) => field(T('cvDensity'), sel('density', Object.keys((BUNDLE.system.pattern || {}).densities || { medium: 1 }), b.props.density))
      + field(T('cvInk'), sel('colourway', PATTERN_INKS(), b.props.colourway)) + field(T('cvOn'), sel('on', COLOURS(), b.props.on))
      + field(T('cvStateRule'), chk('caption', b.props.caption)),
    iconGrid: (b) => field(T('cvInk'), sel('colourway', COLOURS(), b.props.colourway))
      + field(T('cvOn'), sel('on', COLOURS(), b.props.on)) + field(T('cvLines'), sel('line', COLOURS(), b.props.line))
      + field(T('cvStateRule'), chk('caption', b.props.caption !== false)),
    motion: (b) => field(T('cvInk'), sel('colourway', COLOURS(), b.props.colourway)) + field(T('cvOn'), sel('on', COLOURS(), b.props.on))
      + field(T('cvStateRule'), chk('caption', b.props.caption !== false)),
    photography: (b) => field(T('cvOn'), sel('on', COLOURS(), b.props.on))
      + field(T('cvStateRule'), chk('caption', b.props.caption !== false)),
  };
  PROPS.clearSpace = PROPS.construction;

  function drawPanel() {
    const box = $('#panel');
    if (selection.length !== 1) {
      box.innerHTML = selection.length
        ? `<p class="hint">${esc(T('cvManySelected', { n: selection.length }))}</p>`
        : `<p class="hint">${esc(T('cvNothingSelected'))}</p>`;
      return;
    }
    const b = blockById(selection[0]); if (!b) { box.innerHTML = ''; return; }
    const kind = M.kindOf(b.type);
    // the same three words the manual sets on the same three kinds of block
    const LABEL = { derived: T('badgeSystem'), rule: T('badgeOnce'), plain: T('badgeYours') };
    const NOTE = { derived: T('cvNoteDerived'), rule: T('cvNoteRule'), plain: '' };
    const ov = overlayFor(b.id), tw = bleedFor(b.id);
    box.innerHTML =
      `<div class="ph"><h3>${esc(nameOf(b.type))}</h3><span class="kind ${kind[0]}">${LABEL[kind]}</span></div>`
      + (ov ? `<p class="hint bad">${esc(ov.verdict.finding.what)} ${esc(ov.verdict.finding.how)}</p>` : '')
      + (tw ? `<p class="hint bad">${esc(tw.what)} ${esc(tw.how)}</p>` : '')
      + (NOTE[kind] ? `<p class="hint">${esc(NOTE[kind])}</p>` : '')
      + `<div class="grid4">${num('x', b.x)}${num('y', b.y)}${num('w', b.w)}${num('h', b.h)}</div>`
      + `<div class="labels" aria-hidden="true"><span>X</span><span>Y</span><span>W</span><span>H</span></div>`
      + ((PROPS[b.type] && PROPS[b.type](b)) || '')
      + `<div class="ord"><button data-ord="back">${esc(T('cvBack'))}</button><button data-ord="-1">−</button><button data-ord="1">+</button><button data-ord="front">${esc(T('cvFront'))}</button></div>`
      + `<button class="danger" id="del">${esc(T('cvDeleteBlock'))}</button>`;

    box.querySelectorAll('[data-num]').forEach((i) => {
      i.onchange = () => change((d) => {
        const t = M.findPage(d, pageId).blocks.find((x) => x.id === b.id);
        t[i.dataset.num] = Math.round(Number(i.value) || 0);
      });
    });
    box.querySelectorAll('[data-prop]').forEach((i) => {
      const ev = i.tagName === 'SELECT' || i.type === 'checkbox' ? 'change' : 'input';
      i.addEventListener(ev, () => {
        const v = i.type === 'checkbox' ? i.checked
          : i.dataset.pct ? Number(i.value) / 100
          : (i.type === 'number' || i.dataset.numProp) ? Number(i.value) : i.value;
        change((d) => M.ops.setProps(d, pageId, b.id, { [i.dataset.prop]: v }));
      });
    });
    box.querySelectorAll('[data-ord]').forEach((btn) => {
      btn.onclick = () => change((d) => M.ops.reorder(d, pageId, b.id, isNaN(+btn.dataset.ord) ? btn.dataset.ord : +btn.dataset.ord));
    });
    const del = $('#del', box); if (del) del.onclick = removeSelected;
    const pick = $('#pick', box);
    if (pick) pick.onclick = () => { pickFor = b.id; $('#imgfile').click(); };
    const clear = $('#clearimg', box);
    if (clear) clear.onclick = () => { change((d) => M.ops.setProps(d, pageId, b.id, { image: null })); persistImages(); draw(); };
    const rq = $('#resetquad', box);
    if (rq) rq.onclick = () => change((d) => M.ops.setProps(d, pageId, b.id, { quad: M.clone(SU.DEFAULT) }));
  }

  // ------------------------------------------------------------- editing
  function removeSelected() {
    if (!selection.length) return;
    const ids = selection.slice(); selection = [];
    change((d) => M.ops.removeBlocks(d, pageId, ids));
  }
  function duplicate() {
    if (!selection.length) return;
    const copies = selection.map((id) => blockById(id)).filter(Boolean);
    const made = [];
    change((d) => { for (const b of copies) made.push(M.ops.addBlock(d, pageId, b.type, { x: b.x + 16, y: b.y + 16, w: b.w, h: b.h, props: b.props })); });
    selection = made; drawOverlay(); drawPanel();
  }

  function startTextEdit(b) {
    const node = sheet.querySelector(`[data-id="${b.id}"] .hb-text`);
    if (!node) return;
    editing = b.id;
    node.contentEditable = 'true'; node.classList.add('editing'); node.focus();
    const r = document.createRange(); r.selectNodeContents(node);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    const finish = () => {
      node.contentEditable = 'false'; node.classList.remove('editing'); editing = null;
      const text = node.innerText.replace(/ /g, ' ');
      change((d) => M.ops.setProps(d, pageId, b.id, { text }));
    };
    node.onblur = finish;
    node.onkeydown = (e) => { if (e.key === 'Escape') { e.preventDefault(); node.blur(); } e.stopPropagation(); };
  }

  // Focusing a block selects it, which is the keyboard half of the click below.
  // Shift keeps what was already selected, the way shift-click does.
  // What the selection was before focus replaced it, so a second block can be
  // added to it. Tab moving focus has to select — otherwise the arrows have
  // nothing to move — and that leaves no way to build a selection of two
  // unless the one it displaced is remembered.
  let prior = [];
  sheet.addEventListener('focusin', (e) => {
    const node = e.target.closest && e.target.closest('.hb-block');
    if (!node || editing) return;
    const id = node.dataset.id;
    if (selection.length === 1 && selection[0] === id) return;
    prior = selection.slice();
    selection = [id];
    drawOverlay(); drawPanel();
  });

  // ------------------------------------------------------------- pointer
  const toPage = (e) => {
    const r = sheet.getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  };

  let drag = null;
  $('#canvas').addEventListener('pointerdown', (e) => {
    if (editing) return;
    const corner = e.target.closest('.qh');
    const handle = e.target.closest('.h');
    const hit = e.target.closest('.hb-block');
    const start = toPage(e);

    if (corner) {
      const b = blockById(corner.dataset.id);
      drag = { mode: 'corner', index: Number(corner.dataset.corner), id: b.id, start,
        orig: M.clone((b.props.quad && b.props.quad.length === 4) ? b.props.quad : SU.DEFAULT),
        box: { x: b.x, y: b.y, w: b.w, h: b.h } };
    } else if (handle) {
      const b = blockById(handle.dataset.id);
      drag = { mode: 'resize', dir: handle.dataset.handle, start, orig: { x: b.x, y: b.y, w: b.w, h: b.h }, id: b.id };
    } else if (hit) {
      const id = hit.dataset.id;
      if (e.shiftKey) selection = selection.includes(id) ? selection.filter((s) => s !== id) : [...selection, id];
      else if (!selection.includes(id)) selection = [id];
      drag = { mode: 'move', start, orig: selection.map((s) => { const b = blockById(s); return { id: s, x: b.x, y: b.y }; }) };
      drawOverlay(); drawPanel();
    } else {
      selection = []; drag = { mode: 'marquee', start };
      drawOverlay(); drawPanel();
    }
    // A browser starts its own image drag the moment the pointer moves over a
    // picture, and that swallows every event after it: the corner you were
    // dragging simply stops following. Refusing the default here, and marking
    // the pictures undraggable in the renderer, is what keeps the gesture.
    if (drag) e.preventDefault();
    e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId);
  });
  // belt and braces: a drag that starts anyway is not one this editor wants
  $('#canvas').addEventListener('dragstart', (e) => e.preventDefault());

  window.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const now = toPage(e), dx = now.x - drag.start.x, dy = now.y - drag.start.y;
    const g = e.altKey ? 0 : D().grid;

    if (drag.mode === 'move') {
      for (const o of drag.orig) {
        const node = sheet.querySelector(`[data-id="${o.id}"]`);
        const sx = M.snap(o.x + dx, g), sy = M.snap(o.y + dy, g);
        if (node) { node.style.left = sx + 'px'; node.style.top = sy + 'px'; }
        const box = overlay.children[drag.orig.indexOf(o)];
        if (box) { box.style.left = sx + 'px'; box.style.top = sy + 'px'; }
      }
      drag.dx = dx; drag.dy = dy; drag.g = g;
    } else if (drag.mode === 'resize') {
      const o = drag.orig, d = drag.dir;
      let x = o.x, y = o.y, w = o.w, h = o.h;
      if (d.includes('e')) w = o.w + dx;
      if (d.includes('s')) h = o.h + dy;
      if (d.includes('w')) { x = o.x + dx; w = o.w - dx; }
      if (d.includes('n')) { y = o.y + dy; h = o.h - dy; }
      drag.box = { x, y, w: Math.max(8, w), h: Math.max(8, h) }; drag.g = g;
      const node = sheet.querySelector(`[data-id="${drag.id}"]`), box = overlay.children[0];
      for (const n of [node, box]) if (n) {
        n.style.left = M.snap(drag.box.x, g) + 'px'; n.style.top = M.snap(drag.box.y, g) + 'px';
        n.style.width = M.snap(drag.box.w, g) + 'px'; n.style.height = M.snap(drag.box.h, g) + 'px';
      }
    } else if (drag.mode === 'corner') {
      // in fractions of the block, so the mapping survives a resize. A corner
      // may go outside the block: a surface often runs off the edge of a photo.
      const q = M.clone(drag.orig);
      q[drag.index] = [
        Math.round(((drag.orig[drag.index][0] * drag.box.w) + dx) / drag.box.w * 1e4) / 1e4,
        Math.round(((drag.orig[drag.index][1] * drag.box.h) + dy) / drag.box.h * 1e4) / 1e4,
      ];
      drag.quad = q;
      // Shown live, because dragging a corner you cannot see the result of is
      // guesswork. Only the transform is touched: rebuilding the block would
      // mean parsing a few hundred kilobytes of photograph on every mouse
      // move, which is slow enough to lose the rest of the drag.
      const b = blockById(drag.id);
      const art = sheet.querySelector(`[data-id="${drag.id}"] .hb-art`);
      if (art && b) art.style.transform = SU.matrix3d(SU.homography(q.map(([u, v]) => [u * b.w, v * b.h])), b.w, b.h);
      const wrap = overlay.querySelector('.quad');
      if (wrap && b) {
        wrap.querySelector('.quadline').innerHTML = quadSvg(q, b);
        wrap.querySelectorAll('.qh').forEach((c, i) => {
          c.style.left = q[i][0] * b.w + 'px'; c.style.top = q[i][1] * b.h + 'px';
        });
      }
    } else if (drag.mode === 'marquee') {
      const x = Math.min(drag.start.x, now.x), y = Math.min(drag.start.y, now.y);
      const w = Math.abs(dx), h = Math.abs(dy);
      overlay.innerHTML = `<div class="marq" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"></div>`;
      drag.rect = { x, y, w, h };
    }
  });

  window.addEventListener('pointerup', () => {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.mode === 'move' && (d.dx || d.dy)) {
      change((doc2) => M.ops.moveBlocks(doc2, pageId, d.orig.map((o) => o.id), d.dx, d.dy, d.g));
    } else if (d.mode === 'resize' && d.box) {
      change((doc2) => M.ops.resizeBlock(doc2, pageId, d.id, d.box, d.g));
    } else if (d.mode === 'corner' && d.quad) {
      change((doc2) => M.ops.setProps(doc2, pageId, d.id, { quad: d.quad }));
    } else if (d.mode === 'marquee' && d.rect && d.rect.w > 4) {
      const r = d.rect;
      selection = page().blocks.filter((b) => b.x < r.x + r.w && b.x + b.w > r.x && b.y < r.y + r.h && b.y + b.h > r.y).map((b) => b.id);
      drawOverlay(); drawPanel();
    } else { drawOverlay(); drawPanel(); }
  });

  sheet.addEventListener('dblclick', (e) => {
    const hit = e.target.closest('.hb-block');
    if (!hit) return;
    const b = blockById(hit.dataset.id);
    if (b && b.type === 'text') startTextEdit(b);
  });

  // ------------------------------------------------------------- keyboard
  window.addEventListener('keydown', (e) => {
    if (editing) return;
    const t = e.target.tagName;
    if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); (e.shiftKey ? H.redo() : H.undo()); persist(); draw(); return; }
    if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicate(); return; }
    if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); selection = page().blocks.map((b) => b.id); drawOverlay(); drawPanel(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSelected(); return; }
    if (e.key === 'Escape') { selection = []; drawOverlay(); drawPanel(); $('#sheet').focus(); return; }
    const onBlock = e.target.closest && e.target.closest('.hb-block');
    // Enter adds the block focus has just landed on to the one that was
    // selected before it, which is shift-click without the pointer. Pressed
    // again it takes it back out, so it is a toggle either way.
    if (onBlock && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      const id = onBlock.dataset.id;
      const base = selection.length === 1 && selection[0] === id ? prior : selection;
      selection = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
      prior = [];
      drawOverlay(); drawPanel();
      return;
    }
    // F2 is the edit key everywhere else a list has editable rows, and it is
    // the only way into a text block without a double click.
    if (onBlock && e.key === 'F2') {
      const b = blockById(onBlock.dataset.id);
      if (b && b.type === 'text') { e.preventDefault(); startTextEdit(b); return; }
    }
    const step = e.shiftKey ? D().grid * 4 : D().grid;
    const arrow = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!arrow || !selection.length) return;
    e.preventDefault();
    // A block is moved with the arrows and resized with them held down with the
    // same modifier that undoes and duplicates, because resizing was a corner
    // handle and nothing else — eight of them, all pointer only.
    if (mod) {
      const dw = arrow[0] * step, dh = arrow[1] * step;
      const boxes = selection.map((id) => blockById(id)).filter(Boolean)
        .map((b) => ({ id: b.id, x: b.x, y: b.y, w: b.w + dw, h: b.h + dh }));
      change((d) => { for (const box of boxes) M.ops.resizeBlock(d, pageId, box.id, box, D().grid); });
      return;
    }
    change((d) => M.ops.moveBlocks(d, pageId, selection, arrow[0] * step, arrow[1] * step, D().grid));
  });

  // ------------------------------------------------------------- chrome
  const INSERT = [
    [T('cvPlain'), ['text', 'rule', 'fill', 'slot', 'surface']],
    [T('badgeSystem'), ['mark', 'lockup', 'construction', 'clearSpace', 'minimumSize', 'palette', 'contrast', 'typeSpecimen', 'assetIndex']],
    [T('badgeOnce'), ['pattern', 'iconGrid', 'motion', 'photography']],
  ];
  function drawInsert() {
    const box = $('#insert'); box.innerHTML = '';
    for (const [group, types] of INSERT) {
      box.appendChild(el('p', 'gl', esc(group)));
      const wrap = el('div', 'gi');
      for (const t of types) {
        const b = el('button', 'ins', esc(nameOf(t)));
        b.onclick = () => { let made; change((d) => { made = M.ops.addBlock(d, pageId, t, { on: sheetOf() }); }); selection = [made]; drawOverlay(); drawPanel(); };
        wrap.appendChild(b);
      }
      box.appendChild(wrap);
    }
  }

  $('#undo').onclick = () => { H.undo(); persist(); draw(); };
  $('#redo').onclick = () => { H.redo(); persist(); draw(); };
  $('#addpage').onclick = () => change((d) => { pageId = M.ops.addPage(d); });
  $('#delpage').onclick = () => {
    if (D().pages.length < 2) return alert(T('cvNeedPage'));
    const gone = pageId;
    change((d) => { M.ops.removePage(d, gone); });
    pageId = D().pages[0].id; selection = []; draw();
  };
  // One file to hand around, with the images the document uses inside it. A
  // bare document still opens, which is what the server writes.
  $('#save').onclick = () => {
    const used = IM.forDoc(D(), images.all());
    const out = Object.keys(used).length ? Object.assign({}, D(), { images: used }) : D();
    download(`${BUNDLE.brand.toLowerCase()}-document.json`, JSON.stringify(out, null, 2), 'application/json');
  };
  // Publish uses the same module the server uses, so what comes out of this
  // button and what comes out of the command line are the same bytes.
  const download = (name, text, mime) => {
    const a = el('a');
    a.href = URL.createObjectURL(new Blob([text], { type: mime }));
    a.download = name; a.click(); URL.revokeObjectURL(a.href);
  };
  $('#publish').onclick = () => {
    const html = window.HandoverPublish.publish(D(),
      Object.assign({}, BUNDLE, { images: IM.forDoc(D(), images.all()) }), { title: T('cvPublishTitle') });
    download(`${BUNDLE.brand.toLowerCase()}-guidelines.html`, html, 'text/html');
  };
  // Dropping a file on a slot is the gesture people try first, so it is the one
  // that has to work. The whole canvas listens, and the slot under the pointer
  // is the target.
  const slotUnder = (e) => {
    const el2 = document.elementFromPoint(e.clientX, e.clientY);
    const blk = el2 && el2.closest
      && el2.closest('.hb-block[data-type="slot"], .hb-block[data-type="surface"]');
    return blk ? blk.dataset.id : null;
  };
  const mark = (id) => {
    for (const n of sheet.querySelectorAll('.drop')) n.classList.remove('drop');
    if (id) { const n = sheet.querySelector(`.hb-block[data-id="${id}"]`); if (n) n.classList.add('drop'); }
  };
  $('#canvas').addEventListener('dragover', (e) => {
    if (![...e.dataTransfer.types].includes('Files')) return;
    e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; mark(slotUnder(e));
  });
  $('#canvas').addEventListener('dragleave', () => mark(null));
  $('#canvas').addEventListener('drop', (e) => {
    const files = [...(e.dataTransfer.files || [])];
    if (!files.length) return;
    e.preventDefault();
    const id = slotUnder(e); mark(null);
    if (!id) return note(T('cvDropNowhere'), 'warn');
    placeImage(files[0], id);
  });
  $('#imgfile').onchange = (e) => {
    const f = e.target.files[0];
    if (f && pickFor) placeImage(f, pickFor);
    pickFor = null; e.target.value = '';
  };

  $('#open').onclick = () => $('#file').click();
  $('#file').onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const next = JSON.parse(r.result);
        if (!next || !Array.isArray(next.pages) || !next.pages.length) throw new Error('that file has no pages in it');
        const withImages = next.images || {};
        delete next.images;                       // the document holds layout, never bytes
        images.reset(withImages); images.prune(next);
        H.reset(next); pageId = D().pages[0].id; selection = [];
        persist(); persistImages(); draw(); fit();
      } catch (err) { alert(T('cvOpenFailed', { message: err.message })); }
    };
    r.readAsText(f);
    e.target.value = '';
  };

  $('#reset').onclick = () => {
    if (!confirm(T('cvResetAsk'))) return;
    H.reset(window.HANDOVER_DOC); pageId = D().pages[0].id; selection = []; persist(); draw();
  };
  $('#grid').onchange = (e) => change((d) => { d.grid = Number(e.target.value); });

  // ------------------------------------------------------------- page size
  // Changing the size scales the layout rather than throwing it away, and
  // anything that was against an edge stays against it. That is worth saying
  // out loud before it happens, because it is the one action here that touches
  // every block on the page at once.
  const sizeOptions = (cur, extra) =>
    (extra || []).concat(Object.entries(M.SHEETS).map(([k, v]) =>
      [k, `${v.name}  ${v.w} × ${v.h} ${v.unit}`]))
      .map(([k, label]) => `<option value="${esc(k)}"${k === cur ? ' selected' : ''}>${esc(label)}</option>`).join('');

  function drawSizes() {
    const d = D();
    $('#sheet-size').innerHTML = sizeOptions((d.page || {}).size);
    const p = page();
    $('#page-size').innerHTML = sizeOptions(p.page ? p.page.size : '', [['', T('cvSameAsDoc')]]);
    $('#bleed').value = String(M.printSpec(d).bleed || 0);
  }

  // The two mistakes bleed exists to prevent, neither of which is visible on
  // screen. Run whenever the page changes, like the contrast check.
  let bleedFindings = [];
  function checkBleed() {
    const b = boxOf();
    bleedFindings = b.bleed ? PR.check(page(), sheetOf(), b, (blk) => nameOf(blk.type)) : [];
    for (const n of overlay.querySelectorAll('.trimwarn')) n.remove();
    for (const f of bleedFindings) {
      const blk = blockById(f.block); if (!blk) continue;
      const n = el('div', 'trimwarn', 'trim');
      n.style.cssText = `left:${blk.x}px;top:${blk.y}px`;
      n.title = `${f.what} ${f.why} ${f.how}`;
      overlay.appendChild(n);
    }
  }
  const bleedFor = (id) => bleedFindings.find((f) => f.block === id);

  // Type does not scale with the page, and it should not: a size comes from the
  // brand's type scale, not from a number somebody stretched. So after a resize
  // a headline can need more lines than its box has room for. The editor can
  // see that, because the text is laid out in front of it, so it grows the box
  // to fit rather than leaving a clipped word on the page.
  function fitText() {
    const sh = sheetOf();
    let grown = 0, stuck = 0;
    for (const node of sheet.querySelectorAll('.hb-block[data-type="text"]')) {
      const inner = node.firstElementChild;
      if (!inner) continue;
      const need = inner.scrollHeight;
      const have = node.clientHeight;
      if (need <= have + 1) continue;
      const b = blockById(node.dataset.id);
      if (!b) continue;
      const room = sh.h - b.y;
      const h = Math.min(need + 2, room);
      if (h <= have + 1) { stuck++; continue; }
      H.amend((d) => { const t = M.findPage(d, pageId).blocks.find((x) => x.id === b.id); if (t) t.h = h; });
      grown++;
      if (h < need) stuck++;
    }
    if (grown) { persist(); draw(); }
    return { grown, stuck };
  }

  function askScale(what) {
    return confirm(T('cvScaleAsk', { what }))
      ? 'scale' : 'keep';
  }

  $('#bleed').onchange = (e) => {
    const mm = Number(e.target.value) || 0;
    change((d) => M.ops.setBleed(d, mm));
    draw(); fit();
    const n = bleedFindings.length;
    note(mm
      ? T('cvBleedOn', { mm })
        + (n ? ' ' + T(n === 1 ? 'cvOneToLook' : 'cvManyToLook', { n }) : '')
      : T('cvBleedOff'), n ? 'warn' : '');
  };

  $('#sheet-size').onchange = (e) => {
    const key = e.target.value, next = M.sheet(key);
    const mode = askScale(T('cvSetAllAsk', { name: next.name }));
    change((d) => M.ops.setPageSize(d, null, key, null, mode));
    selection = []; draw(); fit(); drawSizes();
    const f = mode === 'scale' ? fitText() : { grown: 0, stuck: 0 };
    note(T('cvSetAllDone', { name: next.name })
      + (f.grown ? ' ' + T(f.grown === 1 ? 'cvOneGrew' : 'cvManyGrew', { n: f.grown }) : '')
      + (f.stuck ? ' ' + T(f.stuck === 1 ? 'cvOneStuck' : 'cvManyStuck', { n: f.stuck }) : ''), f.stuck ? 'warn' : '');
  };
  $('#page-size').onchange = (e) => {
    const key = e.target.value;
    const target = pageId;
    let mode;
    if (!key) {                       // back to whatever the document says
      const back = M.pageSize(D(), null);
      mode = askScale(T('cvBackToDocAsk', { name: back.name }));
      change((d) => {
        const pg = M.findPage(d, target);
        const from = M.pageSize(d, pg);
        delete pg.page;
        if (mode !== 'keep') M.reflow(pg, from, M.pageSize(d, pg));
      });
    } else {
      const next = M.sheet(key);
      mode = askScale(T('cvSetPageAsk', { name: next.name }));
      change((d) => M.ops.setPageSize(d, target, key, null, mode));
    }
    selection = []; draw(); fit(); drawSizes();
    const f = mode === 'scale' ? fitText() : { grown: 0, stuck: 0 };
    if (f.stuck) note(T(f.stuck === 1 ? 'cvOneStuckPage' : 'cvManyStuckPage', { n: f.stuck }), 'warn');
  };

  window.addEventListener('resize', fit);
  drawInsert(); drawSizes(); draw(); fit();
  window.__handover = { get doc() { return D(); }, get selection() { return selection; },
    publish: () => window.HandoverPublish.publish(D(),
      Object.assign({}, BUNDLE, { images: IM.forDoc(D(), images.all()) }), { title: 'Guidelines', builtAt: 'test' }),
    load: (d) => { H.reset(d); pageId = D().pages[0].id; selection = []; draw(); fit(); },
    select: (i) => { selection = [page().blocks[i].id]; drawOverlay(); drawPanel(); },
    setPage: (i) => { pageId = D().pages[i].id; selection = []; draw(); } };
})();
