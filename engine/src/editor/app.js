/* The editor. Page layout, not illustration: fixed page sizes, a grid, and a
   known set of blocks. There is no pen tool on purpose, because vector drawing
   belongs in Illustrator and the mark arrives here finished.
   The canvas edits real DOM, so what is on screen is the same markup that gets
   published and printed. One layout engine, nothing to keep in sync. */
(function () {
  'use strict';
  const M = window.HandoverModel, R = window.HandoverRender, BUNDLE = window.HANDOVER_BUNDLE;
  const $ = (s, r) => (r || document).querySelector(s);
  const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };
  const esc = R.esc;

  const KEY = 'handover:' + BUNDLE.brand;
  let doc = null;
  try { const saved = localStorage.getItem(KEY); if (saved) doc = JSON.parse(saved); } catch (_) {}
  if (!doc || !doc.pages || !doc.pages.length) doc = window.HANDOVER_DOC;

  const H = M.history(doc);
  let pageId = H.get().pages[0].id;
  let selection = [];
  let scale = 1;
  let editing = null;

  const D = () => H.get();
  const page = () => M.findPage(D(), pageId) || D().pages[0];
  const blockById = (id) => page().blocks.find((b) => b.id === id);
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(D())); } catch (_) {} };

  function change(fn) { H.apply(fn); persist(); draw(); }

  // ------------------------------------------------------------- rendering
  const stage = $('#stage'), sheet = $('#sheet'), overlay = $('#overlay');

  function fit() {
    const p = D().page, box = $('#canvas').getBoundingClientRect();
    scale = Math.min((box.width - 80) / p.w, (box.height - 80) / p.h, 1.6);
    sheet.style.width = p.w + 'px'; sheet.style.height = p.h + 'px';
    stage.style.transform = `scale(${scale})`;
    stage.style.width = p.w + 'px'; stage.style.height = p.h + 'px';
    $('#zoom').textContent = Math.round(scale * 100) + '%';
    drawOverlay();
  }

  function draw() {
    const p = page();
    sheet.innerHTML = p.blocks.map((b) => R.positioned(b, BUNDLE)).join('');
    sheet.style.background = BUNDLE.roles.ground.hex;
    drawPages(); drawOverlay(); drawPanel(); drawHistory();
  }

  function drawOverlay() {
    overlay.innerHTML = '';
    for (const id of selection) {
      const b = blockById(id); if (!b) continue;
      const box = el('div', 'sel');
      box.style.cssText = `left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px`;
      if (selection.length === 1) {
        for (const h of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
          const k = el('div', 'h h-' + h); k.dataset.handle = h; k.dataset.id = id; box.appendChild(k);
        }
        box.appendChild(el('span', 'tag', esc(b.type)));
      }
      overlay.appendChild(box);
    }
  }

  function drawPages() {
    const list = $('#pages'); list.innerHTML = '';
    D().pages.forEach((p, i) => {
      const row = el('button', 'pg' + (p.id === pageId ? ' on' : ''));
      row.innerHTML = `<i>${String(i + 1).padStart(2, '0')}</i><span>${esc(p.name)}</span><em>${p.blocks.length}</em>`;
      row.onclick = () => { pageId = p.id; selection = []; draw(); };
      row.ondblclick = () => {
        const n = prompt('Name this page', p.name);
        if (n) change((d) => M.ops.renamePage(d, p.id, n));
      };
      list.appendChild(row);
    });
  }

  const drawHistory = () => {
    $('#undo').disabled = !H.canUndo(); $('#redo').disabled = !H.canRedo();
  };

  // ------------------------------------------------------------- panel
  const field = (label, input) => `<label class="f"><span>${esc(label)}</span>${input}</label>`;
  const num = (k, v) => `<input type="number" data-num="${k}" value="${v}">`;
  const opts = (list, cur) => list.map((o) => `<option value="${esc(o)}"${o === cur ? ' selected' : ''}>${esc(o)}</option>`).join('');
  const sel = (k, list, cur) => `<select data-prop="${k}">${opts(list, cur)}</select>`;

  const COLOURS = () => [...Object.keys(BUNDLE.roles), ...Object.keys(BUNDLE.colours)];
  const STYLES = () => ((BUNDLE.type || {}).scale || []).map((s) => s.name);

  const PROPS = {
    text: (b) => field('Text', `<textarea data-prop="text" rows="4">${esc(b.props.text)}</textarea>`)
      + field('Style', sel('style', STYLES(), b.props.style))
      + field('Align', sel('align', ['left', 'center', 'right'], b.props.align))
      + field('Colour', sel('colour', COLOURS(), b.props.colour)),
    rule: (b) => field('Colour', sel('colour', COLOURS(), b.props.colour)) + field('Weight', `<input type="number" data-prop="weight" value="${b.props.weight}" min="1">`),
    fill: (b) => field('Colour', sel('colour', COLOURS(), b.props.colour)),
    slot: (b) => field('Label', `<input data-prop="label" value="${esc(b.props.label)}">`) + field('Ratio', `<input data-prop="ratio" value="${esc(b.props.ratio)}">`),
    mark: (b) => field('Colourway', sel('colourway', COLOURS(), b.props.colourway)) + field('On', sel('on', COLOURS(), b.props.on)),
    lockup: (b) => field('Lockup', sel('lockup', BUNDLE.lockups, b.props.lockup))
      + field('Colourway', sel('colourway', COLOURS(), b.props.colourway)) + field('On', sel('on', COLOURS(), b.props.on)),
    construction: (b) => field('Ink', sel('colourway', COLOURS(), b.props.colourway || 'primary'))
      + field('On', sel('on', COLOURS(), b.props.on || 'ground')) + field('Lines', sel('line', COLOURS(), b.props.line || 'neutral')),
    minimumSize: (b) => field('Ink', sel('colourway', COLOURS(), b.props.colourway || 'primary')),
    contrast: (b) => field('Rows', `<input type="number" data-prop="limit" value="${b.props.limit || 6}" min="1" max="${BUNDLE.contrast.length}">`),
  };
  PROPS.clearSpace = PROPS.construction;

  function drawPanel() {
    const box = $('#panel');
    if (selection.length !== 1) {
      box.innerHTML = selection.length
        ? `<p class="hint">${selection.length} blocks selected. Move them together, or press Delete.</p>`
        : `<p class="hint">Nothing selected. Click a block, or add one from the left.</p>`;
      return;
    }
    const b = blockById(selection[0]); if (!b) { box.innerHTML = ''; return; }
    const derived = M.DERIVED.indexOf(b.type) > -1;
    box.innerHTML =
      `<div class="ph"><h3>${esc(b.type)}</h3><span class="kind ${derived ? 'd' : 'p'}">${derived ? 'Drawn by the system' : 'Yours'}</span></div>`
      + (derived ? `<p class="hint">This block reads the project and draws itself. Change the master and it redraws. You set where it sits and what it is painted in, and nothing else.</p>` : '')
      + `<div class="grid4">${num('x', b.x)}${num('y', b.y)}${num('w', b.w)}${num('h', b.h)}</div>`
      + `<div class="labels"><span>X</span><span>Y</span><span>W</span><span>H</span></div>`
      + ((PROPS[b.type] && PROPS[b.type](b)) || '')
      + `<div class="ord"><button data-ord="back">Back</button><button data-ord="-1">−</button><button data-ord="1">+</button><button data-ord="front">Front</button></div>`
      + `<button class="danger" id="del">Delete block</button>`;

    box.querySelectorAll('[data-num]').forEach((i) => {
      i.onchange = () => change((d) => {
        const t = M.findPage(d, pageId).blocks.find((x) => x.id === b.id);
        t[i.dataset.num] = Math.round(Number(i.value) || 0);
      });
    });
    box.querySelectorAll('[data-prop]').forEach((i) => {
      const ev = i.tagName === 'SELECT' ? 'change' : 'input';
      i.addEventListener(ev, () => {
        const v = i.type === 'number' ? Number(i.value) : i.value;
        change((d) => M.ops.setProps(d, pageId, b.id, { [i.dataset.prop]: v }));
      });
    });
    box.querySelectorAll('[data-ord]').forEach((btn) => {
      btn.onclick = () => change((d) => M.ops.reorder(d, pageId, b.id, isNaN(+btn.dataset.ord) ? btn.dataset.ord : +btn.dataset.ord));
    });
    const del = $('#del', box); if (del) del.onclick = removeSelected;
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

  // ------------------------------------------------------------- pointer
  const toPage = (e) => {
    const r = sheet.getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  };

  let drag = null;
  $('#canvas').addEventListener('pointerdown', (e) => {
    if (editing) return;
    const handle = e.target.closest('.h');
    const hit = e.target.closest('.hb-block');
    const start = toPage(e);

    if (handle) {
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
    e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId);
  });

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
    if (e.key === 'Escape') { selection = []; drawOverlay(); drawPanel(); return; }
    const step = e.shiftKey ? D().grid * 4 : D().grid;
    const nudge = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (nudge && selection.length) {
      e.preventDefault();
      change((d) => M.ops.moveBlocks(d, pageId, selection, nudge[0], nudge[1], D().grid));
    }
  });

  // ------------------------------------------------------------- chrome
  const INSERT = [
    ['Plain', ['text', 'rule', 'fill', 'slot']],
    ['Drawn by the system', ['mark', 'lockup', 'construction', 'clearSpace', 'minimumSize', 'palette', 'contrast', 'typeSpecimen', 'assetIndex']],
  ];
  function drawInsert() {
    const box = $('#insert'); box.innerHTML = '';
    for (const [group, types] of INSERT) {
      box.appendChild(el('p', 'gl', esc(group)));
      const wrap = el('div', 'gi');
      for (const t of types) {
        const b = el('button', 'ins', esc(t));
        b.onclick = () => { let made; change((d) => { made = M.ops.addBlock(d, pageId, t); }); selection = [made]; drawOverlay(); drawPanel(); };
        wrap.appendChild(b);
      }
      box.appendChild(wrap);
    }
  }

  $('#undo').onclick = () => { H.undo(); persist(); draw(); };
  $('#redo').onclick = () => { H.redo(); persist(); draw(); };
  $('#addpage').onclick = () => change((d) => { pageId = M.ops.addPage(d); });
  $('#delpage').onclick = () => {
    if (D().pages.length < 2) return alert('A document needs at least one page.');
    const gone = pageId;
    change((d) => { M.ops.removePage(d, gone); });
    pageId = D().pages[0].id; selection = []; draw();
  };
  $('#save').onclick = () => {
    const blob = new Blob([JSON.stringify(D(), null, 2)], { type: 'application/json' });
    const a = el('a'); a.href = URL.createObjectURL(blob); a.download = `${BUNDLE.brand.toLowerCase()}-document.json`; a.click();
  };
  $('#reset').onclick = () => {
    if (!confirm('Throw away your edits and start from the document this project generated?')) return;
    H.reset(window.HANDOVER_DOC); pageId = D().pages[0].id; selection = []; persist(); draw();
  };
  $('#grid').onchange = (e) => change((d) => { d.grid = Number(e.target.value); });

  window.addEventListener('resize', fit);
  drawInsert(); draw(); fit();
  window.__handover = { get doc() { return D(); }, get selection() { return selection; },
    select: (i) => { selection = [page().blocks[i].id]; drawOverlay(); drawPanel(); },
    setPage: (i) => { pageId = D().pages[i].id; selection = []; draw(); } };
})();
