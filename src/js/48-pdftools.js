/* ================================ PDF TOOLS ================================
   Runs fully in the browser (pdf-lib + pdf.js). Nothing is uploaded anywhere.
   Compress · Merge (page ranges) · Extract / reorder pages · Edit (change text, add text, redact).
   Edited files are marked as edited in the PDF properties and the original file's SHA-256 is shown,
   so an edited copy is never mistaken for the original. Keep the original for evidence.                */
const PT = { tab: 'compress', c: { file: null }, m: { items: [] }, x: { file: null }, e: { file: null, pg: 1, mode: 'edit', ops: [], sel: null, vp: null, scale: 1.5, items: [], pdfjs: null } };

const ptSize = n => n >= 1048576 ? (n / 1048576).toFixed(2) + ' MB' : (n / 1024).toFixed(0) + ' KB';
async function ptLib() { if (typeof window.PDFLib === 'undefined') await Libs.one(LIBS.pdflib); if (!window.PDFLib) throw new Error('PDF library could not be loaded. Check the internet connection and reload.'); return window.PDFLib; }
async function ptRead(file) { const buf = new Uint8Array(await file.arrayBuffer()); if (!(buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46)) throw new Error(file.name + ' is not a PDF file.'); return buf; }
async function ptPdfjs(bytes) { const base = LIBS.pdfWorker.src.replace('build/pdf.worker.min.js', ''); return pdfjsLib.getDocument({ data: bytes.slice(), isEvalSupported: false, disableFontFace: true, standardFontDataUrl: base + 'standard_fonts/', cMapUrl: base + 'cmaps/', cMapPacked: true }).promise; }
function ptProg(id, pct, msg) { const b = $('#' + id); if (!b) return; b.hidden = false; b.innerHTML = `<div class="pt-bar"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div><div class="small dim">${esc(msg || '')} ${Math.round(pct)}%</div>`; }
const ptTick = () => new Promise(r => setTimeout(r, 0));
async function ptRenderPage(pdf, n, scale, filter) {
  const page = await pdf.getPage(n); const vp = page.getViewport({ scale });
  const cv = document.createElement('canvas'); cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height);
  const cx = cv.getContext('2d', { willReadFrequently: true }); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
  await page.render({ canvasContext: cx, viewport: vp }).promise;
  if (filter) { const c2 = document.createElement('canvas'); c2.width = cv.width; c2.height = cv.height; const x2 = c2.getContext('2d'); x2.filter = 'grayscale(1) contrast(1.7) brightness(1.06)'; x2.drawImage(cv, 0, 0); return { cv: c2, vp, page }; }
  return { cv, vp, page };
}
const ptJpeg = (cv, q) => new Promise(res => cv.toBlob(b => b.arrayBuffer().then(a => res(new Uint8Array(a))), 'image/jpeg', q));
/* "1-5, 8, 11-13" / "all" → zero-based page indices in the order typed */
function ptRanges(txt, n) {
  txt = String(txt || '').trim().toLowerCase(); if (!txt || txt === 'all') return Array.from({ length: n }, (_, i) => i);
  const out = [];
  for (const part of txt.split(/[,;]+/).map(x => x.trim()).filter(Boolean)) {
    const m = part.match(/^(\d+)?\s*(?:-|–|to)\s*(\d+)?$/);
    if (m && (m[1] || m[2])) { let a = m[1] ? +m[1] : 1, b = m[2] ? +m[2] : n; if (a < 1 || b > n || a > b) throw new Error(`Page range “${part}” is outside 1–${n}.`); for (let i = a; i <= b; i++) out.push(i - 1); }
    else if (/^\d+$/.test(part)) { const p = +part; if (p < 1 || p > n) throw new Error(`Page ${p} does not exist (1–${n}).`); out.push(p - 1); }
    else throw new Error(`Cannot read “${part}”. Use for example: all, 1-5, 3, 7-12, 15`);
  }
  if (!out.length) throw new Error('No pages selected.'); return out;
}
function ptDrop(box, multi, cb) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.pdf,application/pdf'; inp.multiple = !!multi; inp.onchange = () => { cb(Array.from(inp.files)); inp.value = ''; };
  box.onclick = () => inp.click(); box.ondragover = e => { e.preventDefault(); box.classList.add('over'); }; box.ondragleave = () => box.classList.remove('over');
  box.ondrop = e => { e.preventDefault(); box.classList.remove('over'); cb(Array.from(e.dataTransfer.files).filter(f => /\.pdf$/i.test(f.name) || f.type === 'application/pdf')); };
}
const ptDropHtml = (id, multi) => `<div class="drop pt-drop" id="${id}"><div class="ic">⇪</div><b>Drop ${multi ? 'PDF files' : 'a PDF'} here or click to choose</b><div class="small muted">Processed only in this browser — nothing is uploaded</div></div>`;
async function ptThumb(bytes) { try { const pdf = await ptPdfjs(bytes); const r = await ptRenderPage(pdf, 1, 0.25); const url = r.cv.toDataURL('image/jpeg', 0.6); return { url, n: pdf.numPages }; } catch { return { url: '', n: 0 }; } }
function ptMark(doc, note) {
  try { doc.setProducer('SIXTH SENSE PDF Tools'); doc.setCreator('SIXTH SENSE PDF Tools'); doc.setModificationDate(new Date()); if (note) doc.setKeywords([note]); } catch { /* ignore */ }
}

VIEWS.pdf = el => {
  const T = [['compress', '⇩ Compress'], ['merge', '⧉ Merge'], ['extract', '✂ Extract / reorder pages'], ['edit', '✎ Edit text · Redact']];
  el.innerHTML = pageHead('PDF Tools', 'Compress, merge, extract pages and edit PDFs. Everything runs in this browser; files are not uploaded.') +
    `<div class="tabs pt-tabs">${T.map(([k, t]) => `<button class="${PT.tab === k ? 'on' : ''}" data-pt="${k}">${t}</button>`).join('')}</div><div id="ptBody"></div>`;
  $$('[data-pt]', el).forEach(b => b.onclick = () => { PT.tab = b.dataset.pt; VIEWS.pdf(el); });
  const B = $('#ptBody', el); ({ compress: ptCompress, merge: ptMerge, extract: ptExtract, edit: ptEdit })[PT.tab](B);
};

/* ---------------------------------- Compress ---------------------------------- */
function ptCompress(B) {
  const C = PT.c;
  B.innerHTML = `<div class="grid g2 pt-g"><div class="card">${ptDropHtml('cDrop')}<div id="cInfo" class="pt-info"></div></div>
    <div class="card"><h3>Settings</h3>
      <label class="f">Compression level: <b id="cLvVal">60</b>% <span class="dim">(higher = smaller file, lower quality)</span><input type="range" id="cLv" min="0" max="100" value="60"></label>
      <label class="f">Target file size (MB) <span class="dim">(optional — the tool tries to reach it)</span><input type="number" id="cTarget" min="0.05" step="0.05" placeholder="e.g. 2"></label>
      <label class="row small"><input type="checkbox" id="cKeep"> Keep text selectable (light compression only — no image resampling)</label>
      <label class="row small"><input type="checkbox" id="cEnh"> Enhance scanned pages (black-and-white contrast for faded text)</label>
      <p class="small dim" style="margin-top:8px">Normal mode redraws each page as a compressed image, which gives the biggest saving but the text can no longer be selected or searched. Use “Keep text selectable” for typed (non-scanned) PDFs when a small saving is enough.</p>
      <div class="row"><button class="btn-p" id="cGo" disabled>Compress</button></div><div id="cProg" hidden style="margin-top:10px"></div><div id="cOut" style="margin-top:10px"></div></div></div>`;
  const info = () => { $('#cInfo', B).innerHTML = C.file ? `<div class="pt-file"><b>${esc(C.file.name)}</b><span class="mono">${ptSize(C.file.size)} · ${C.pages || '?'} page(s)</span></div>` : ''; $('#cGo', B).disabled = !C.file; };
  ptDrop($('#cDrop', B), false, async fs => { const f = fs[0]; if (!f) return; try { C.bytes = await ptRead(f); C.file = f; C.pages = 0; info(); const pdf = await ptPdfjs(C.bytes); C.pages = pdf.numPages; info(); } catch (e) { toast(e.message, 'err'); } });
  info(); $('#cLv', B).oninput = e => $('#cLvVal', B).textContent = e.target.value;
  $('#cGo', B).onclick = async () => {
    const go = $('#cGo', B); go.disabled = true; $('#cOut', B).innerHTML = '';
    try {
      const lib = await ptLib(); const orig = C.bytes; const lv = +$('#cLv', B).value; const tgtMb = parseFloat($('#cTarget', B).value); const target = tgtMb > 0 ? tgtMb * 1048576 : 0;
      const keep = $('#cKeep', B).checked, enh = $('#cEnh', B).checked; let best = null, note = '';
      if (keep) {
        ptProg('cProg', 20, 'Optimising structure…'); const d = await lib.PDFDocument.load(orig, { ignoreEncryption: false }); ptMark(d, 'compressed');
        best = await d.save({ useObjectStreams: true, addDefaultPage: false }); note = 'Text kept selectable. Only the PDF structure was optimised.';
        if (target && best.length > target) note += ' The target size could not be reached without resampling images — untick “Keep text selectable” to go further.';
      } else {
        const pdf = await ptPdfjs(orig); const n = pdf.numPages;
        // dpi 200 → 72 and JPEG quality 0.85 → 0.15 according to the level; with a target, tighten step by step
        let dpi = 200 - lv * 1.28, q = 0.85 - lv * 0.0070; let tries = 0, res = null;
        const run = async (dpi, q, base) => {
          const out = await lib.PDFDocument.create(); ptMark(out, 'compressed');
          for (let i = 1; i <= n; i++) {
            ptProg('cProg', base + (i / n) * 70 / (target ? 4 : 1), `Page ${i} of ${n}`); await ptTick();
            const r = await ptRenderPage(pdf, i, dpi / 72, enh); const jb = await ptJpeg(r.cv, q); const img = await out.embedJpg(jb);
            const pt = r.page.getViewport({ scale: 1 }); const pg = out.addPage([pt.width, pt.height]); pg.drawImage(img, { x: 0, y: 0, width: pt.width, height: pt.height });
          }
          return out.save();
        };
        res = await run(dpi, q, 5); tries = 1;
        while (target && res.length > target && tries < 5 && (dpi > 60 || q > 0.2)) {
          const ratio = Math.sqrt(target / res.length); dpi = Math.max(60, dpi * Math.max(0.55, Math.min(0.9, ratio))); q = Math.max(0.15, q * (ratio < 0.6 ? 0.8 : 0.9)); tries++;
          res = await run(dpi, q, 5 + (tries - 1) * 18);
        }
        best = res; note = `Pages redrawn at about ${Math.round(dpi)} dpi, JPEG quality ${Math.round(q * 100)}%${enh ? ', contrast-enhanced' : ''}. Text is no longer selectable.` + (target && best.length > target ? ` The ${tgtMb} MB target could not be reached — the smallest result is shown.` : '');
      }
      ptProg('cProg', 100, 'Done'); const sm = best.length < orig.length;
      $('#cOut', B).innerHTML = `<div class="notice ${sm ? 'ok' : 'warn'}"><b>${ptSize(orig.length)} → ${ptSize(best.length)}</b> ${sm ? `(${Math.round((1 - best.length / orig.length) * 100)}% smaller)` : '(not smaller — the original is better)'}<br><span class="small">${esc(note)}</span></div><button class="btn-p" id="cDl">⇩ Download compressed PDF</button>`;
      $('#cDl', B).onclick = () => downloadBlob(new Blob([best], { type: 'application/pdf' }), C.file.name.replace(/\.pdf$/i, '') + '_compressed.pdf');
    } catch (e) { toast(e.message || String(e), 'err', 6000); $('#cProg', B).hidden = true; }
    go.disabled = false;
  };
}

/* ----------------------------------- Merge ----------------------------------- */
function ptMerge(B) {
  const M = PT.m;
  const draw = () => {
    $('#mList', B).innerHTML = M.items.length ? M.items.map((it, i) => `<div class="pt-row"><span class="pt-ord">${i + 1}</span>${it.url ? `<img class="pt-th" src="${it.url}" alt="">` : '<div class="pt-th"></div>'}<div class="pt-nm"><b>${esc(it.name)}</b><div class="small dim mono">${ptSize(it.size)} · ${it.n} page(s)</div></div>
      <label class="f pt-rg">Pages<input data-r="${i}" value="${esc(it.range)}" placeholder="All, 1-5, 3, 7-12"></label><div class="row"><button class="btn-sm" data-up="${i}" ${i === 0 ? 'disabled' : ''}>▲</button><button class="btn-sm" data-dn="${i}" ${i === M.items.length - 1 ? 'disabled' : ''}>▼</button><button class="btn-sm btn-d" data-rm="${i}">✕</button></div></div>`).join('') : '<div class="empty">No files added yet.</div>';
    $$('[data-r]', B).forEach(x => x.oninput = () => M.items[+x.dataset.r].range = x.value);
    $$('[data-up]', B).forEach(x => x.onclick = () => { const i = +x.dataset.up; [M.items[i - 1], M.items[i]] = [M.items[i], M.items[i - 1]]; draw(); });
    $$('[data-dn]', B).forEach(x => x.onclick = () => { const i = +x.dataset.dn; [M.items[i + 1], M.items[i]] = [M.items[i], M.items[i + 1]]; draw(); });
    $$('[data-rm]', B).forEach(x => x.onclick = () => { M.items.splice(+x.dataset.rm, 1); draw(); });
    $('#mGo', B).disabled = M.items.length < 2;
  };
  B.innerHTML = `<div class="card">${ptDropHtml('mDrop', true)}<div id="mList" style="margin-top:14px"></div>
    <p class="small dim">Pages: type <code>All</code>, a range <code>1-5</code>, single pages <code>3</code> or a mix <code>7-12, 15</code>. Files are joined in the order shown.</p>
    <div class="row"><button class="btn-p" id="mGo" disabled>Merge into one PDF</button><button class="btn-sm" id="mClr">Clear</button></div><div id="mProg" hidden style="margin-top:10px"></div><div id="mOut" style="margin-top:10px"></div></div>`;
  ptDrop($('#mDrop', B), true, async fs => { for (const f of fs) { try { const bytes = await ptRead(f); const t = await ptThumb(bytes); M.items.push({ name: f.name, size: f.size, bytes, url: t.url, n: t.n, range: 'All' }); } catch (e) { toast(e.message, 'err'); } } draw(); });
  $('#mClr', B).onclick = () => { M.items = []; draw(); };
  $('#mGo', B).onclick = async () => {
    const go = $('#mGo', B); go.disabled = true; $('#mOut', B).innerHTML = '';
    try {
      const lib = await ptLib(); const out = await lib.PDFDocument.create(); ptMark(out, 'merged');
      for (let i = 0; i < M.items.length; i++) {
        const it = M.items[i]; ptProg('mProg', (i / M.items.length) * 95, `Adding ${it.name}`); await ptTick();
        const src = await lib.PDFDocument.load(it.bytes); const idx = ptRanges(it.range, src.getPageCount());
        const pages = await out.copyPages(src, idx); pages.forEach(p => out.addPage(p));
      }
      const bytes = await out.save(); ptProg('mProg', 100, 'Done');
      $('#mOut', B).innerHTML = `<div class="notice ok"><b>${out.getPageCount()} page(s)</b> · ${ptSize(bytes.length)}</div><button class="btn-p" id="mDl">⇩ Download merged PDF</button>`;
      $('#mDl', B).onclick = () => downloadBlob(new Blob([bytes], { type: 'application/pdf' }), 'merged.pdf');
    } catch (e) { toast(e.message || String(e), 'err', 6000); $('#mProg', B).hidden = true; }
    go.disabled = M.items.length < 2;
  };
  draw();
}

/* ------------------------------ Extract / reorder ------------------------------ */
function ptExtract(B) {
  const X = PT.x;
  B.innerHTML = `<div class="grid g2 pt-g"><div class="card">${ptDropHtml('xDrop')}<div id="xInfo" class="pt-info"></div></div>
    <div class="card"><h3>Pages to keep</h3><label class="f">Page list <span class="dim">(the order you type is the order in the new file)</span><input id="xRg" value="all" placeholder="e.g. 1-3, 7, 5"></label>
      <p class="small dim">Examples: <code>2-4</code> keep pages 2 to 4 · <code>5,1,3</code> reorder · <code>1-3, 3</code> repeat a page.</p>
      <label class="f">Rotate pages (degrees)<select id="xRot"><option value="0">No rotation</option><option value="90">90° clockwise</option><option value="180">180°</option><option value="270">90° anticlockwise</option></select></label>
      <div class="row"><button class="btn-p" id="xGo" disabled>Create PDF</button></div><div id="xOut" style="margin-top:10px"></div></div></div>`;
  const info = () => { $('#xInfo', B).innerHTML = X.file ? `<div class="pt-file"><b>${esc(X.file.name)}</b><span class="mono">${ptSize(X.file.size)} · ${X.n} page(s)</span></div>${X.thumbs || ''}` : ''; $('#xGo', B).disabled = !X.file; };
  ptDrop($('#xDrop', B), false, async fs => { const f = fs[0]; if (!f) return; try { X.bytes = await ptRead(f); X.file = f; const t = await ptThumb(X.bytes); X.n = t.n; X.thumbs = t.url ? `<img class="pt-th big" src="${t.url}" alt="">` : ''; info(); } catch (e) { toast(e.message, 'err'); } });
  info();
  $('#xGo', B).onclick = async () => {
    try {
      const lib = await ptLib(); const src = await lib.PDFDocument.load(X.bytes); const idx = ptRanges($('#xRg', B).value, src.getPageCount()); const rot = +$('#xRot', B).value;
      const out = await lib.PDFDocument.create(); ptMark(out, 'pages extracted'); const pages = await out.copyPages(src, idx);
      pages.forEach(p => { if (rot) p.setRotation(lib.degrees(((p.getRotation().angle || 0) + rot) % 360)); out.addPage(p); });
      const bytes = await out.save();
      $('#xOut', B).innerHTML = `<div class="notice ok"><b>${out.getPageCount()} page(s)</b> · ${ptSize(bytes.length)}</div><button class="btn-p" id="xDl">⇩ Download PDF</button>`;
      $('#xDl', B).onclick = () => downloadBlob(new Blob([bytes], { type: 'application/pdf' }), X.file.name.replace(/\.pdf$/i, '') + '_pages.pdf');
    } catch (e) { toast(e.message || String(e), 'err', 6000); }
  };
}

/* ---------------------------- Edit text · Add · Redact ---------------------------- */
const PT_FONTS = [['Helvetica', 'Helvetica (sans-serif)'], ['HelveticaBold', 'Helvetica Bold'], ['HelveticaOblique', 'Helvetica Italic'], ['TimesRoman', 'Times (serif)'], ['TimesRomanBold', 'Times Bold'], ['TimesRomanItalic', 'Times Italic'], ['Courier', 'Courier (mono)'], ['CourierBold', 'Courier Bold']];
function ptGuessFont(name, family) {
  const n = String(name || '').toLowerCase(), bold = /bold|black|heavy|semibold/.test(n), ital = /italic|oblique/.test(n);
  const mono = /courier|mono|consolas|typewriter/.test(n) || family === 'monospace'; const serif = /times|serif|georgia|garamond|cambria|book|roman|palatino/.test(n) && !/sans/.test(n) || (family === 'serif' && !/arial|helvet|calibri|sans/.test(n));
  if (mono) return bold ? 'CourierBold' : 'Courier'; if (serif) return bold ? 'TimesRomanBold' : ital ? 'TimesRomanItalic' : 'TimesRoman';
  return bold ? 'HelveticaBold' : ital ? 'HelveticaOblique' : 'Helvetica';
}
const ptHex = (r, g, b) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const ptRgb = h => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); const v = m ? parseInt(m[1], 16) : 0; return [(v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255]; };
function ptSample(cv, x, y, w, h) { // darkest pixel = text colour; border average = background
  x = Math.max(0, Math.floor(x)); y = Math.max(0, Math.floor(y)); w = Math.max(2, Math.min(cv.width - x, Math.ceil(w))); h = Math.max(2, Math.min(cv.height - y, Math.ceil(h)));
  const d = cv.getContext('2d', { willReadFrequently: true }).getImageData(x, y, w, h).data; let dark = [0, 0, 0], dl = 1e9, br = 0, bg = 0, bb = 0, bn = 0;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const o = (j * w + i) * 4, r = d[o], g = d[o + 1], b = d[o + 2], l = r * .3 + g * .59 + b * .11; if (l < dl) { dl = l; dark = [r, g, b]; } if (j === 0 || j === h - 1 || i === 0 || i === w - 1) { br += r; bg += g; bb += b; bn++; } }
  return { text: ptHex(...dark), bg: ptHex(br / bn, bg / bn, bb / bn) };
}
async function ptEdit(B) {
  const E = PT.e;
  B.innerHTML = `<div class="card">${E.file ? '' : ptDropHtml('eDrop')}<div id="eMain"></div></div>`;
  const load = async f => {
    try { E.bytes = await ptRead(f); E.file = f; E.ops = []; E.sel = null; E.pg = 1; E.origHash = await sha256Hex(E.bytes); E.pdf = await ptPdfjs(E.bytes); E.n = E.pdf.numPages; ptEdit(B); } catch (e) { toast(e.message, 'err'); }
  };
  if (!E.file) { ptDrop($('#eDrop', B), false, fs => fs[0] && load(fs[0])); return; }
  const M = $('#eMain', B);
  M.innerHTML = `<div class="notice warn small"><b>Evidence caution:</b> edit only copies of documents you are entitled to change (drafts, forms, your own notices). The edited PDF is marked “edited” in its properties. Keep the original unchanged for evidence — its SHA-256: <span class="mono">${E.origHash.slice(0, 20)}…</span></div>
    <div class="row pt-tool"><button class="btn-sm" id="eNew">📂 Other file</button><span class="mono small">${esc(E.file.name)}</span>
      <span style="margin-left:14px">Page</span><button class="btn-sm" id="ePrev" ${E.pg <= 1 ? 'disabled' : ''}>◀</button><b id="ePg">${E.pg} / ${E.n}</b><button class="btn-sm" id="eNext" ${E.pg >= E.n ? 'disabled' : ''}>▶</button>
      <span style="margin-left:14px">Tool</span>${[['edit', '✎ Edit text'], ['add', '＋ Add text'], ['redact', '▮ Redact']].map(([k, t]) => `<button class="btn-sm ${E.mode === k ? 'btn-p' : ''}" data-md="${k}">${t}</button>`).join('')}
      <button class="btn-sm" id="eZm">−</button><button class="btn-sm" id="eZp">+</button></div>
    <div class="pt-ed"><div class="pt-stage" id="eStage"><div class="empty"><div class="spin"></div>Rendering page…</div></div>
      <div class="pt-side card"><h3>${E.mode === 'edit' ? 'Edit text' : E.mode === 'add' ? 'Add text' : 'Redact'}</h3><div id="eForm" class="small dim">${E.mode === 'edit' ? 'Click a line of text on the page.' : E.mode === 'add' ? 'Click where the new text should start.' : 'Drag a rectangle over the area to hide. Pages with redaction are flattened to an image so the hidden text is really removed.'}</div>
        <h3 style="margin-top:16px">Changes (${E.ops.length})</h3><div id="eOps" class="pt-ops"></div>
        <div class="row" style="margin-top:10px"><button class="btn-p" id="eSave" ${E.ops.length ? '' : 'disabled'}>⇩ Save edited PDF</button></div><div id="eProg" hidden style="margin-top:8px"></div></div></div>`;
  $('#eNew', M).onclick = () => { PT.e = { file: null, pg: 1, mode: 'edit', ops: [], sel: null, scale: 1.5 }; ptEdit(B); };
  const rerender = () => ptEdit(B);
  $('#ePrev', M).onclick = () => { E.pg--; E.sel = null; rerender(); }; $('#eNext', M).onclick = () => { E.pg++; E.sel = null; rerender(); };
  $$('[data-md]', M).forEach(b => b.onclick = () => { E.mode = b.dataset.md; E.sel = null; rerender(); });
  $('#eZm', M).onclick = () => { E.scale = Math.max(0.8, E.scale - 0.25); rerender(); }; $('#eZp', M).onclick = () => { E.scale = Math.min(3, E.scale + 0.25); rerender(); };
  const opsBox = $('#eOps', M);
  const drawOps = () => { opsBox.innerHTML = E.ops.length ? E.ops.map((o, i) => `<div class="pt-op"><span class="small"><b>p${o.page}</b> ${o.type === 'redact' ? '▮ Redact' : o.type === 'edit' ? '✎ “' + esc(o.old.slice(0, 18)) + '” → “' + esc(o.text.slice(0, 18)) + '”' : '＋ “' + esc(o.text.slice(0, 24)) + '”'}</span><button class="btn-sm btn-d" data-del="${i}">✕</button></div>`).join('') : '<div class="small dim">None yet.</div>';
    $$('[data-del]', opsBox).forEach(b => b.onclick = () => { E.ops.splice(+b.dataset.del, 1); rerender(); }); };
  drawOps();
  // render the page
  const st = $('#eStage', M);
  try {
    const r = await ptRenderPage(E.pdf, E.pg, E.scale); E.cv = r.cv; E.vp = r.vp; const tc = await r.page.getTextContent();
    try { await r.page.getOperatorList(); } catch { /* font objects */ }
    st.innerHTML = ''; st.style.width = r.cv.width + 'px'; st.style.height = r.cv.height + 'px'; r.cv.className = 'pt-cv'; st.appendChild(r.cv);
    if (r.page.rotate) st.insertAdjacentHTML('beforeend', '<div class="notice warn small" style="position:absolute;left:8px;top:8px">This page is rotated; editing positions may be off. Rotate it first with “Extract / reorder”.</div>');
    const ov = document.createElement('div'); ov.className = 'pt-ov'; st.appendChild(ov);
    const pageOps = E.ops.filter(o => o.page === E.pg);
    for (const o of pageOps) { const d = document.createElement('div'); d.className = 'pt-box done ' + o.type; const k0 = E.scale / o.sc; d.style.cssText = `left:${o.px.x * k0}px;top:${o.px.y * k0}px;width:${o.px.w * k0}px;height:${o.px.h * k0}px`; ov.appendChild(d); }
    if (E.mode === 'edit') {
      tc.items.filter(i => i.str && i.str.trim()).forEach(it => {
        const t = pdfjsLib.Util.transform(r.vp.transform, it.transform); const h = Math.hypot(t[2], t[3]) || 8; const w = it.width * E.scale;
        const font = (() => { try { return r.page.commonObjs.get(it.fontName); } catch { return null; } })(); const fam = (tc.styles[it.fontName] || {}).fontFamily;
        const b = document.createElement('div'); b.className = 'pt-box'; b.style.cssText = `left:${t[4]}px;top:${t[5] - h * 0.92}px;width:${Math.max(6, w)}px;height:${h * 1.2}px`; b.title = it.str;
        b.onclick = ev => { ev.stopPropagation(); const px = { x: t[4], y: t[5] - h * 0.92, w: Math.max(6, w), h: h * 1.2 }; const col = ptSample(r.cv, px.x, px.y, px.w, px.h);
          E.sel = { type: 'edit', page: E.pg, old: it.str, text: it.str, font: ptGuessFont(font && font.name, fam), size: Math.round(h / E.scale * 10) / 10, color: col.text, bg: col.bg, base: { x: t[4], y: t[5] }, px, fname: font && font.name || '' }; showForm(); $$('.pt-box.sel', ov).forEach(x => x.classList.remove('sel')); b.classList.add('sel'); };
        ov.appendChild(b);
      });
    } else if (E.mode === 'add') {
      ov.style.cursor = 'crosshair'; ov.onclick = ev => { const rc = ov.getBoundingClientRect(); const x = ev.clientX - rc.left, y = ev.clientY - rc.top; E.sel = { type: 'add', page: E.pg, old: '', text: '', font: 'Helvetica', size: 11, color: '#000000', bg: '#ffffff', base: { x, y: y + 11 * E.scale }, px: { x, y, w: 120, h: 14 * E.scale } }; showForm(); };
    } else {
      ov.style.cursor = 'crosshair'; let s = null, rb = null;
      ov.onmousedown = ev => { const rc = ov.getBoundingClientRect(); s = { x: ev.clientX - rc.left, y: ev.clientY - rc.top }; rb = document.createElement('div'); rb.className = 'pt-box redact'; ov.appendChild(rb); ev.preventDefault(); };
      ov.onmousemove = ev => { if (!s) return; const rc = ov.getBoundingClientRect(); const x = ev.clientX - rc.left, y = ev.clientY - rc.top; rb.style.cssText = `left:${Math.min(s.x, x)}px;top:${Math.min(s.y, y)}px;width:${Math.abs(x - s.x)}px;height:${Math.abs(y - s.y)}px`; };
      ov.onmouseup = ev => { if (!s) return; const rc = ov.getBoundingClientRect(); const x = ev.clientX - rc.left, y = ev.clientY - rc.top; const px = { x: Math.min(s.x, x), y: Math.min(s.y, y), w: Math.abs(x - s.x), h: Math.abs(y - s.y) }; s = null; if (px.w < 4 || px.h < 4) { rb.remove(); return; }
        E.ops.push({ type: 'redact', page: E.pg, px, text: '', old: '', sc: E.scale, H: E.vp.height }); rerender(); };
    }
  } catch (e) { st.innerHTML = `<div class="notice err">${esc(e.message)}</div>`; }

  function showForm() {
    const s = E.sel; if (!s) return; const f = $('#eForm', M);
    f.className = ''; f.innerHTML = `${s.type === 'edit' ? `<div class="small dim">Original: <i>${esc(s.old)}</i>${s.fname ? ` · font ${esc(s.fname)}` : ''}</div>` : ''}
      <label class="f">Text<textarea id="fTxt" rows="2">${esc(s.text)}</textarea></label>
      <div class="grid g2" style="gap:8px"><label class="f">Font<select id="fFont">${PT_FONTS.map(([k, t]) => `<option value="${k}" ${s.font === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label class="f">Size (pt)<input id="fSz" type="number" step="0.5" min="4" max="96" value="${s.size}"></label>
      <label class="f">Text colour<input id="fCol" type="color" value="${s.color}"></label>
      ${s.type === 'edit' ? `<label class="f">Cover colour<input id="fBg" type="color" value="${s.bg}"></label>` : ''}</div>
      <div class="small dim">Font, size and colour are matched from the page; adjust if needed. Standard fonts only (Latin characters).</div>
      <div class="row" style="margin-top:8px"><button class="btn-p" id="fOk">${s.type === 'edit' ? 'Apply change' : 'Add text'}</button></div>`;
    $('#fOk', f).onclick = () => { const txt = $('#fTxt', f).value; if (!txt.trim() && s.type === 'add') return toast('Type the text first', 'warn');
      E.ops.push(Object.assign({}, s, { sc: E.scale, H: E.vp.height, text: txt, font: $('#fFont', f).value, size: +$('#fSz', f).value || s.size, color: $('#fCol', f).value, bg: $('#fBg', f) ? $('#fBg', f).value : '#ffffff' })); E.sel = null; rerender(); };
  }
  $('#eSave', M).onclick = async () => {
    const sv = $('#eSave', M); sv.disabled = true;
    try {
      const lib = await ptLib(); const doc = await lib.PDFDocument.load(E.bytes); const cache = {}; const getF = async k => cache[k] || (cache[k] = await doc.embedFont(lib.StandardFonts[k]));
      const pagesWith = [...new Set(E.ops.map(o => o.page))].sort((a, b) => a - b); let step = 0;
      for (const pn of pagesWith) {
        ptProg('eProg', (step++ / pagesWith.length) * 90, `Page ${pn}`); await ptTick();
        const ops = E.ops.filter(o => o.page === pn); const page = doc.getPage(pn - 1); const mb = page.getMediaBox();
        const toPt = (p, o) => ({ x: mb.x + p.x / o.sc, y: mb.y + (o.H - p.y) / o.sc });
        if (ops.some(o => o.type === 'redact')) { // flatten: render at 150 dpi, burn black boxes, replace page with the image
          const r = await ptRenderPage(E.pdf, pn, 150 / 72); const cx = r.cv.getContext('2d');
          for (const o of ops) { const k = (150 / 72) / o.sc; if (o.type === 'redact') { cx.fillStyle = '#000'; cx.fillRect(o.px.x * k, o.px.y * k, o.px.w * k, o.px.h * k); } else if (o.type === 'edit') { cx.fillStyle = o.bg; cx.fillRect(o.px.x * k - 1, o.px.y * k - 1, o.px.w * k + 2, o.px.h * k + 2); cx.fillStyle = o.color; cx.font = `${o.size * 150 / 72}px ${o.font.startsWith('Times') ? 'serif' : o.font.startsWith('Courier') ? 'monospace' : 'sans-serif'}`; cx.fillText(o.text, o.base.x * k, o.base.y * k); } else { cx.fillStyle = o.color; cx.font = `${o.size * 150 / 72}px sans-serif`; cx.fillText(o.text, o.base.x * k, o.base.y * k); } }
          const img = await doc.embedJpg(await ptJpeg(r.cv, 0.9)); const sz = page.getSize(); doc.removePage(pn - 1); const np = doc.insertPage(pn - 1, [sz.width, sz.height]); np.drawImage(img, { x: 0, y: 0, width: sz.width, height: sz.height });
          continue;
        }
        for (const o of ops) {
          const f = await getF(o.font); const [r1, g1, b1] = ptRgb(o.color); const pos = toPt(o.base, o); const sc = o.sc;
          if (o.type === 'edit') { const [rb, gb, bb] = ptRgb(o.bg); const a = toPt({ x: o.px.x - 1, y: o.px.y + o.px.h + 1 }, o); page.drawRectangle({ x: a.x, y: a.y, width: o.px.w / sc + 2, height: o.px.h / sc + 2, color: lib.rgb(rb, gb, bb) }); }
          try { f.encodeText(o.text.replace(/\n/g, ' ')); } catch { throw new Error('Some characters in “' + o.text.slice(0, 20) + '” are not available in the standard fonts (Latin text only).'); }
          o.text.split('\n').forEach((ln, li) => page.drawText(ln, { x: pos.x, y: pos.y - li * o.size * 1.2, size: o.size, font: f, color: lib.rgb(r1, g1, b1) }));
        }
      }
      ptMark(doc, 'edited with SIXTH SENSE PDF Tools; original sha256 ' + E.origHash); doc.setTitle((doc.getTitle() || E.file.name.replace(/\.pdf$/i, '')) + ' (edited copy)');
      const out = await doc.save(); ptProg('eProg', 100, 'Done'); downloadBlob(new Blob([out], { type: 'application/pdf' }), E.file.name.replace(/\.pdf$/i, '') + '_edited.pdf');
      if (S.cur) audit('PDF edited', E.file.name + ' · ' + E.ops.length + ' change(s) · original sha256 ' + E.origHash); toast('Edited copy downloaded. Original SHA-256 ' + E.origHash.slice(0, 12) + '…', 'ok', 6000);
    } catch (e) { toast(e.message || String(e), 'err', 7000); $('#eProg', M).hidden = true; }
    sv.disabled = !E.ops.length;
  };
}
