/* ------------------------------ file → grid ------------------------------ */
function cellVal(c) {
  if (!c) return '';
  if (c.t === 'e' || c.t === 'z') return '';
  if (c.t === 'd' && c.v instanceof Date) { const d = c.v; return { d: [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()] }; }
  if (c.t === 'n' && c.z && typeof c.z === 'string' && XLSX.SSF.is_date(c.z)) { const p = XLSX.SSF.parse_date_code(c.v); if (p) return { d: [p.y, p.m, p.d, p.H, p.M, Math.round(p.S)] }; }
  if (c.t === 's' && typeof c.v === 'string') return c.v.replace(/ /g, ' ').trim();
  return c.v;
}
function cellText(v) { if (v && typeof v === 'object' && v.d) { const [y, m, d, H, M, S] = v.d; return pad(d) + '-' + pad(m) + '-' + y + ((H || M || S) ? ' ' + pad(H) + ':' + pad(M) + ':' + pad(S) : ''); } return String(v ?? ''); }

async function readGrids(file, onProg) {
  const name = file.name.toLowerCase(); const buf = await file.arrayBuffer();
  const hash = await sha256Hex(buf);
  if (name.endsWith('.pdf')) return { hash, grids: await pdfGrids(buf, onProg), type: 'PDF' };
  const head = new TextDecoder().decode(buf.slice(0, 2048)).toLowerCase();
  if (/\.(html?|mht|mhtml)$/.test(name) || (/\.(xls|txt|dat|rpt)$/.test(name) && /<html|<table|<!doctype html/.test(head))) { // HTML statements (also .xls files that are really HTML)
    let text = new TextDecoder().decode(buf); if (/\.mhtm?l?$/.test(name) || /content-transfer-encoding:\s*quoted-printable/i.test(text.slice(0, 5000))) text = text.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
    const wb = XLSX.read(text, { type: 'string', dense: true }); return { hash, type: 'HTML', grids: wbGrids(wb) };
  }
  if (/\.(txt|dat|tsv|psv|rpt|prn|lst)$/.test(name)) {
    const text = new TextDecoder().decode(buf); const lines = text.split(/\r?\n/).filter(l => l.trim() && !/^[-=_*\s]{8,}$/.test(l));
    const cand = ['\t', '|', ',', ';']; const sample = lines.slice(0, 40);
    const score = d => { const cnts = sample.map(l => l.split(d).length - 1).filter(n => n > 0); return cnts.length >= sample.length * .5 ? cnts.reduce((a, b) => a + b, 0) / cnts.length : 0; };
    const best = cand.map(d => [d, score(d)]).sort((a, b) => b[1] - a[1])[0];
    // fixed-width bank reports (.rpt / .prn): rebuild the table from character columns, else split on runs of 2+ spaces
    if (best[1] < 2) { try { const t = textLayout(text); if (t && t.rows.length > 2) return { hash, type: 'REPORT', grids: [{ sheet: 'text', rows: t.rows, rowRef: t.rowRef, pre: t.pre, layout: true, rawLines: text.split(/\r?\n/).slice(0, 80) }] }; } catch (e) { console.warn('text layout', e); } }
    const rows = best[1] >= 2 ? lines.map(l => splitDelim(l, best[0])) : lines.map(l => l.trim().split(/\s{2,}/).map(x => x.trim()));
    return { hash, type: best[1] >= 2 ? 'TEXT' : 'REPORT', grids: [{ sheet: 'text', rows, rowRef: rows.map((_, i) => ({ row: i + 1 })), rawLines: text.split(/\r?\n/).slice(0, 80) }] };
  }
  const wb = XLSX.read(buf, { type: 'array', cellDates: false, cellNF: true, raw: /\.csv$/.test(name), dense: true });
  return { hash, grids: wbGrids(wb), type: /\.csv$/.test(name) ? 'CSV' : 'EXCEL' };
}
function wbGrids(wb) {
  const grids = [];
  for (const sn of wb.SheetNames) {
    const ws = wb.Sheets[sn]; if (!ws || !ws['!ref']) continue;
    const range = XLSX.utils.decode_range(ws['!ref']); const rows = [];
    const data = ws['!data'];
    for (let r = range.s.r; r <= range.e.r; r++) {
      const row = []; const dr = data ? data[r] : null;
      for (let c = range.s.c; c <= range.e.c; c++) row.push(cellVal(dr ? dr[c] : ws[XLSX.utils.encode_cell({ r, c })]));
      rows.push(row);
    }
    if (rows.some(r => r.some(v => v !== ''))) grids.push({ sheet: sn, rows, rowRef: rows.map((_, i) => ({ row: range.s.r + i + 1 })) });
  }
  return grids;
}
function splitDelim(line, d) {
  if (d !== ',') return line.split(d).map(s => s.trim().replace(/^"|"$/g, ''));
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) { const ch = line[i]; if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; } else if (ch === ',' && !q) { out.push(cur.trim()); cur = ''; } else cur += ch; }
  out.push(cur.trim()); return out;
}

/* ---------------- PDF: text layer (pdf.js) with OCR fallback (tesseract) ---------------- */
let _tess = null;
async function ocrWorker() {
  if (_tess) return _tess;
  if (typeof Tesseract === 'undefined') await new Promise((res, rej) => { const s = document.createElement('script'); s.src = LIBS.tesseract.src; s.integrity = LIBS.tesseract.sri; s.crossOrigin = 'anonymous'; s.onload = res; s.onerror = () => rej(new Error('OCR engine could not be loaded')); document.head.appendChild(s); });
  _tess = await Tesseract.createWorker('eng', 1, { workerPath: LIBS.tessWorker, corePath: LIBS.tessCore, langPath: LIBS.tessLang, workerBlobURL: true });
  return _tess;
}
/* ------------------------------ statement layout reader (PDF / OCR / fixed-width text) ------------------------------
   Rebuilds a bank-statement table from positioned text:
   1. words per line  2. header block (1–3 lines)  3. columns from the empty vertical "gutters" in the data lines,
      numeric columns split by the right edges of their amounts  4. one row per transaction: every line is assigned to
      the balance line it belongs to, cutting between two balance lines at the widest vertical gap (handles narration
      above, below or centred around the amounts)  5. summary / footer lines kept apart.
   Returns { rows:[header labels, ...rows], rowRef, pre } or null when no table could be recognised. */
const LAY_AMT = /^[-+(]?\s*(?:rs\.?|inr|₹)?\s*-?(?:\d{1,3}(?:,\d{2,3})+|\d+)\.\d{1,2}\)?\s*(?:\(?(?:cr|dr)\.?\)?)?-?$/i;
const LAY_DATE = /^(\d{1,2}\s?[-\/.]\s?(\d{1,2}|[A-Za-z]{3,9})\s?[-\/.]\s?(\d{4}|\d{2})\b|\d{4}-\d{2}-\d{2}\b|\d{1,2}\s?[-\/.]\s?(\d{1,2}|[A-Za-z]{3})\s?[-\/.]\s*$)/;
const LAY_SUMMARY = /\bpage\s*total|cumulative\s*totals?|\btotal\s*(credit|debit|withdrawal|deposit|dr|cr)s?\b|\bdraw(ing)?\s*power\b|^(opening|closing|brought|carried|b\/f|c\/f|bal(ance)?\s*(b\/f|c\/f|brought|carried)|total|transaction total|grand total|sub total)\b|\b(opening balance|closing balance|brought forward|carried forward|balance forward|transaction total)\b/i;
const LAY_FOOTER = /\bpage\s*(no\.?\s*:?\s*)?\d+(\s*(of|\/)\s*\d+)?\b|computer generated|does not require (any )?signature|system generated|generated (on|by)|statement summary|end of statement|abbreviations? used|\bdisclaimer\b|registered office|regd\.?\s*office|\bcin\s*:|www\.|toll free|customer care|call us|please (note|examine|check)|contact your branch|dear customer|\*{3,}|unless the constituent|legends?\s*:|report date|print(ed)? (on|date)|order by|considered correct|earmarked|gstn\s*:|this statement\b|\bfrom\s*:\s*\d|\bto\s*:\s*\d{1,2}[-\/.]/i;

function layWords(items) { // items of ONE line: [{s,x,w,h}] sorted by x → merge glyph-split runs, split multi-amount runs
  const out = [];
  items = items.flatMap(it => { const s = String(it.s).replace(/\s+/g, ' ').trim(); const ws = s.split(' ');
    if (ws.length > 1 && ws.some(p => LAY_DATE.test(p))) { const cw = (it.w || s.length * 4) / s.length; let x = it.x; return ws.map(p => { const o = { s: p, x, w: p.length * cw, h: it.h }; x += (p.length + 1) * cw; return o; }); }
    return [it]; }).flatMap(it => { const s = String(it.s).replace(/\s+/g, ' ').trim(); const parts = s.split(' ');
    if (parts.length < 2 || !parts.some(p => LAY_AMT.test(p)) || parts.every(p => LAY_AMT.test(p) || /^\(?(cr|dr)\.?\)?$/i.test(p))) return [it];
    const groups = []; for (const p of parts) { const isA = LAY_AMT.test(p) || (/^\(?(cr|dr)\.?\)?$/i.test(p) && groups.length && groups[groups.length - 1].a); const g = groups[groups.length - 1]; if (g && g.a === isA && !isA) g.t.push(p); else if (g && g.a && /^\(?(cr|dr)\.?\)?$/i.test(p)) g.t.push(p); else groups.push({ a: isA, t: [p] }); }
    const cw = (it.w || s.length * 4) / s.length; let x = it.x; return groups.map(g => { const t = g.t.join(' '); const o = { s: t, x, w: t.length * cw, h: it.h }; x += (t.length + 1) * cw; return o; }); });
  for (const it of items) {
    const s = String(it.s).replace(/\s+/g, ' ').trim(); if (!s) continue;
    const last = out[out.length - 1]; const h = it.h || 8;
    if (last && it.x - (last.x + last.w) < 0.18 * h && !(LAY_AMT.test(last.s) && LAY_AMT.test(s))) { last.s += s; last.w = it.x + it.w - last.x; continue; }
    out.push({ s, x: it.x, w: Math.max(it.w, 1), h });
  }
  // "95,000.00 95,500.00Cr" in one run → separate tokens placed proportionally
  return out.flatMap(t => {
    if (!/\d\.\d{2}\S*\s+\S*\d\.\d{2}/.test(t.s) || !t.s.split(/\s+(?![cd]r\b|\(?[cd]r\)?\.?$)/i).every(p => LAY_AMT.test(p) || /^\(?(cr|dr)\.?\)?$/i.test(p))) return [t];
    const parts = t.s.split(/\s+(?![cd]r\b|\(?[cd]r\)?\.?$)/i); const cw = t.w / t.s.length; let x = t.x;
    return parts.map(p => { const o = { s: p, x, w: p.length * cw, h: t.h }; x += (p.length + 1) * cw; return o; });
  }).flatMap(t => { // "01/01/23 14:18 01/01/23" style date + time + date runs → keep; "Cr"/"Dr" alone after an amount → glue
    return [t];
  }).reduce((a, t) => { const l = a[a.length - 1]; if (l && /^\(?(cr|dr)\.?\)?$/i.test(t.s) && LAY_AMT.test(l.s) && t.x - (l.x + l.w) < 3 * t.h) { if (l.ar == null) l.ar = l.x + l.w; l.s += ' ' + t.s; l.w = t.x + t.w - l.x; } else a.push(t); return a; }, []);
}
function layIsAmt(s) { return LAY_AMT.test(s); }
function layNormDate(s) { return String(s).replace(/(\d)\s*([-\/.])\s*(?=[\dA-Za-z])/g, '$1$2').replace(/([-\/.])\s+(\d)/g, '$1$2').trim(); }

/* pages: [{ page, lines:[{ y, h, items:[{s,x,w,h}] }] }]; classify(label) → field name or '' */
function layoutTable(pages, classify = layClassify, opt = {}) {
  // 1 · words
  const L = [];
  for (const pg of pages) for (const ln of pg.lines) { const words = layWords(ln.items.slice().sort((a, b) => a.x - b.x)); if (words.length) L.push({ page: pg.page, y: ln.y, h: ln.h || words[0].h, words, text: words.map(w => w.s).join(' ') }); }
  if (L.length < 3) return null;
  // 2 · header block: best-scoring line, merged with neighbours within ~1.8 line heights that also carry header words
  const fieldsOf = txt => { const set = new Set(); for (const w of txt) { const f = classify(w); if (f) set.add(f); } return set; };
  const lineFields = L.map(l => { const toks = l.words.map(w => w.s); const pairs = toks.slice(0, -1).map((t, i) => t + ' ' + toks[i + 1]); return fieldsOf(toks.concat(pairs)); });
  const cands = [];
  for (let i = 0; i < L.length; i++) {
    const blk = [i]; const f = new Set(lineFields[i]);
    for (const d of [-1, 1, 2, -2]) { const j = i + d; if (j < 0 || j >= L.length || L[j].page !== L[i].page) continue; if (Math.abs(L[j].y - L[i].y) > 2.2 * L[i].h) continue; if (/^[-=_*.\s]+$/.test(L[j].text) || LAY_SUMMARY.test(L[j].text) || /\d{4}/.test(L[j].text) || L[j].words.some(w => layIsAmt(w.s) || LAY_DATE.test(w.s))) continue; if (lineFields[j].size || L[j].words.length <= 8) { if (lineFields[j].size || blk.length < 3) { blk.push(j); lineFields[j].forEach(x => f.add(x)); } } }
    const money = ['debit', 'credit', 'amount', 'balance'].filter(x => f.has(x)).length; const dt = ['date', 'valueDate', 'postDate'].some(x => f.has(x));
    const sc = f.size + (dt ? 1 : 0) + (money ? 1 : 0) + (f.has('balance') ? .5 : 0);
    if (lineFields[i].size >= 2 && dt && money && (lineFields[i].size >= 3 || !LAY_SUMMARY.test(L[i].text))) cands.push({ i, sc, blk: blk.sort((a, b) => a - b) });
  }
  if (!cands.length) return null;
  const topSc = Math.max(...cands.map(c => c.sc)); const best = cands.find(c => c.sc >= topSc - 1);
  const H = best.blk.map(i => L[i]); const hy0 = Math.min(...H.map(l => l.y)), hy1 = Math.max(...H.map(l => l.y)); const hPage = L[best.i].page;
  const hdrSig = new Set(H.flatMap(l => l.words.map(w => w.s.toLowerCase())));
  const isRepeatHeader = l => { const ws = l.words.map(w => w.s.toLowerCase()); const hit = ws.filter(w => hdrSig.has(w)).length; return hit >= 2 && hit >= ws.length * 0.6; };
  // 3 · data lines
  const data = []; const repY = new Map();
  for (const l of L) if (l.page > hPage && isRepeatHeader(l) && !repY.has(l.page)) repY.set(l.page, l.y);
  { // pages without a repeated heading: drop the page-top block (address, account details) above the first dated line
    const pitch0 = (L[best.i].h || 8) * 1.4; const firstDate = new Map();
    for (const l of L) if (!firstDate.has(l.page) && !(l.page === hPage && l.y <= hy1) && LAY_DATE.test(l.words[0].s) && !/:/.test(l.words[0].s)) firstDate.set(l.page, l.y);
    for (const [p, y] of firstDate) if (!repY.has(p)) repY.set(p, y - 2.2 * pitch0 - 0.5); }
  for (let k = 0; k < L.length; k++) {
    const l = L[k]; if (l.page < hPage || (l.page === hPage && l.y <= hy1 + 0.5)) continue;
    if (isRepeatHeader(l)) { l.kind = 'hdr'; continue; }
    if (repY.has(l.page) && l.y < repY.get(l.page) && !(l.page === hPage && l.y > hy1 && LAY_SUMMARY.test(l.text))) { l.kind = 'top'; continue; }
    if (/^[-=_*.\s]+$/.test(l.text)) continue;
    if ((LAY_FOOTER.test(l.text) || (l.text.split(' ').length > 14 && !l.words.some(w => layIsAmt(w.s)))) && !LAY_DATE.test(l.words[0].s)) { l.kind = 'foot'; continue; }
    l.kind = LAY_SUMMARY.test(l.text) && !LAY_DATE.test(l.words[0].s) ? 'sum' : 'data'; data.push(l);
  }
  if (data.length < 2) return null;
  // 4 · columns from gutters
  const xs = data.flatMap(l => l.words.map(w => [w.x, w.x + w.w])); let minX = Math.min(...xs.map(a => a[0]), ...H.flatMap(l => l.words.map(w => w.x))), maxX = Math.max(...xs.map(a => a[1]));
  const span = maxX - minX; const RES = 0.5; const nb = Math.ceil(span / RES) + 2; const cov = new Float32Array(nb);
  const dl0 = data.filter(l => l.kind === 'data'); const rowLike = dl0.filter(l => l.words.length >= 2 && l.words.some(w => layIsAmt(w.s) || LAY_DATE.test(w.s))); const dl = rowLike.length >= 3 ? rowLike : dl0;
  for (const l of dl) for (const w of l.words) { if (w.w > span * 0.45) continue; const a = Math.floor((w.x - minX) / RES), b = Math.ceil((w.x + w.w - minX) / RES); for (let i = Math.max(0, a); i < Math.min(nb, b); i++) cov[i]++; }
  const thr = Math.max(0.5, dl.length * 0.004);
  let cols = []; let cur = null;
  for (let i = 0; i < nb; i++) { const on = cov[i] > thr; if (on && !cur) cur = { x0: minX + i * RES }; if (!on && cur) { cur.x1 = minX + i * RES; cols.push(cur); cur = null; } }
  if (cur) { cur.x1 = maxX; cols.push(cur); }
  // merge sub-gutters narrower than 2.5pt (inter-word gaps inside a column)
  cols = cols.reduce((a, c) => { const l = a[a.length - 1]; if (l && c.x0 - l.x1 < 2.5) l.x1 = c.x1; else a.push(c); return a; }, []);
  // split columns whose amounts right-align at clearly different edges (adjacent numeric columns)
  const amts = dl.flatMap(l => l.words.filter(w => layIsAmt(w.s)).map(w => ({ r: w.ar ?? (w.x + w.w), l: w.x })));
  const out = [];
  for (const c of cols) {
    const inC = amts.filter(a => a.r > c.x0 - 1 && a.r <= c.x1 + 1); if (inC.length < 3) { out.push(c); continue; }
    const rs = inC.map(a => a.r).sort((a, b) => a - b); const cl = [];
    for (const r of rs) { const k = cl[cl.length - 1]; if (k && r - k.max < 6) { k.max = r; k.n++; k.sum += r; } else cl.push({ min: r, max: r, n: 1, sum: r }); }
    let big = cl.filter(k => k.n >= Math.max(2, inC.length * 0.04));
    if (!big.length) { out.push(c); continue; }
    if (big.length > 1) { const ls = inC.map(a => a.l).sort((a, b) => a - b); const med = ls[Math.floor(ls.length / 2)]; if (ls.filter(v => Math.abs(v - med) <= 4).length >= inC.length * 0.7) { const rs2 = inC.map(a => a.r).sort((a, b) => a - b); big = [{ min: rs2[0], max: rs2[rs2.length - 1], n: inC.length, left: ls[0] }]; } }
    big.forEach(k => { const ls = inC.filter(a => a.r >= k.min - 0.5 && a.r <= k.max + 0.5).map(a => a.l).sort((a, b) => a - b); k.left = ls[Math.floor(ls.length * 0.05)]; });
    // text sitting left of the first amount block (narration merged with an amount column) keeps its own column
    const txtRight = dl.flatMap(l => l.words.filter(w => !layIsAmt(w.s) && w.x >= c.x0 - 1 && w.x + w.w <= c.x1 + 1).map(w => w.x + w.w));
    let x0 = c.x0;
    if (txtRight.filter(r => r < big[0].left - 1).length >= 3 && big[0].left - c.x0 > 25) { out.push({ x0: c.x0, x1: big[0].left - 1 }); x0 = big[0].left - 1; }
    if (big.length === 1) { out.push({ x0, x1: c.x1, amtR: big[0].max }); continue; }
    big.forEach((k, i) => { const x1 = i === big.length - 1 ? c.x1 : k.max + 1.5; out.push({ x0, x1, amtR: k.max }); x0 = x1; });
  }
  cols = out.filter(c => c.x1 - c.x0 >= 2);
  for (const c of cols) { const inC = amts.filter(a => a.r > c.x0 - 1 && a.r <= c.x1 + 1); if (inC.length && !c.amtR) { const rs = inC.map(a => a.r).sort((a, b) => a - b); c.amtR = rs[Math.floor(rs.length / 2)]; } c.hasAmt = inC.length; }
  // header words → columns (a header word far from any data column creates its own column)
  let hw = H.flatMap(l => l.words.filter(w => /[A-Za-z]/.test(w.s)).map(w => Object.assign({ yy: l.y }, w)));
  { // money headings ↔ amount columns in left-to-right order when the counts agree
    const cl = []; for (const w of hw.slice().sort((a, b) => a.x - b.x)) { const k = cl[cl.length - 1]; if (k && w.x < k.x1 + 6) { k.x1 = Math.max(k.x1, w.x + w.w); k.ws.push(w); } else cl.push({ x0: w.x, x1: w.x + w.w, ws: [w] }); }
    const money = cl.filter(k => ['debit', 'credit', 'amount', 'balance'].includes(classify(k.ws.map(w => w.s).join(' '))));
    const maxAmt = Math.max(0, ...cols.map(c => c.hasAmt || 0)); const numCols = cols.filter(c => c.hasAmt >= Math.max(3, maxAmt * 0.3));
    if (money.length >= 2 && money.length === numCols.length) { money.forEach((k, i) => { (numCols[i].labels = numCols[i].labels || []).push(...k.ws); }); const used = new Set(money.flatMap(k => k.ws)); hw = hw.filter(w => !used.has(w)); }
  }
  for (const w of hw) {
    const cx = w.x + w.w / 2; let bi = -1, bd = 1e9;
    cols.forEach((c, i) => { const d = cx < c.x0 ? c.x0 - cx : cx > c.x1 ? cx - c.x1 : 0; const dr = c.amtR ? Math.abs((w.x + w.w) - c.amtR) * 0.6 : 1e9; const dd = Math.min(d, dr); if (dd < bd) { bd = dd; bi = i; } });
    if (bi < 0 || bd > 45) { cols.push({ x0: w.x, x1: w.x + w.w, labels: [w], hdrOnly: true }); cols.sort((a, b) => a.x0 - b.x0); continue; }
    (cols[bi].labels = cols[bi].labels || []).push(w);
  }
  // a data column that sits under two or more separate headings (e.g. "VALUE DATE" + "DESCRIPTION") → split between them
  { const nc = [];
    for (const c of cols) {
      const ws = (c.labels || []).slice().sort((a, b) => a.x - b.x); const cl = [];
      for (const w of ws) { const k = cl[cl.length - 1]; if (k && w.x < k.x1 + 6) { k.x1 = Math.max(k.x1, w.x + w.w); k.ws.push(w); } else cl.push({ x0: w.x, x1: w.x + w.w, ws: [w] }); }
      if (cl.length < 2 || c.amtR && cl.length === 2 && cl.every(k => ['debit', 'credit', 'amount', 'balance'].includes(classify(k.ws.map(w => w.s).join(' '))))) { nc.push(c); continue; }
      const cutAt = (a, b) => { if (b <= a) return (a + b) / 2; let bestV = 1e9, run = null, bestRun = null; for (let x = a; x <= b; x += RES) { const v = cov[Math.max(0, Math.min(nb - 1, Math.round((x - minX) / RES)))]; if (v < bestV - 0.5) { bestV = v; run = [x, x]; bestRun = run; } else if (Math.abs(v - bestV) <= 0.5) { if (run && Math.abs(run[1] + RES - x) < RES / 2) run[1] = x; else run = [x, x]; if (!bestRun || run[1] - run[0] > bestRun[1] - bestRun[0]) bestRun = run; } else run = null; } return bestRun ? (bestRun[0] + bestRun[1]) / 2 : (a + b) / 2; };
      let x0 = c.x0; cl.forEach((k, i) => { const x1 = i === cl.length - 1 ? c.x1 : cutAt(k.x1, cl[i + 1].x0); nc.push({ x0, x1, labels: k.ws, amtR: i === cl.length - 1 ? c.amtR : undefined, hasAmt: i === cl.length - 1 ? c.hasAmt : 0 }); x0 = x1; });
    }
    cols = nc; }
  for (const c of cols) { const inC = amts.filter(a => a.r > c.x0 - 1 && a.r <= c.x1 + 1); c.hasAmt = inC.length; if (inC.length) { const rs = inC.map(a => a.r).sort((a, b) => a - b); c.amtR = rs[Math.floor(rs.length / 2)]; } else c.amtR = undefined; }
  cols.forEach(c => { c.label = (c.labels || []).sort((a, b) => a.yy - b.yy || a.x - b.x).map(w => w.s).join(' ').trim(); c.field = classify(c.label) || ''; });
  // a data column without heading between two labelled ones is usually the overflow of its left neighbour → merge
  const nAnchorish = dl.length; const numLike = c => c.hasAmt >= Math.max(3, nAnchorish * 0.15);
  { const keep = []; for (const c of cols) { if (!c.label && !numLike(c) && keep.length) { keep[keep.length - 1].x1 = Math.max(keep[keep.length - 1].x1, c.x1); continue; } keep.push(c); }
    if (keep.length > 1 && !keep[0].label && !numLike(keep[0])) { keep[1].x0 = keep[0].x0; keep.shift(); } cols = keep; }
  const numIdx = cols.map((c, i) => ['debit', 'credit', 'amount', 'balance'].includes(c.field) || (c.hasAmt >= 3 && !c.field) ? i : -1).filter(i => i >= 0);
  const balIdx = cols.findIndex(c => c.field === 'balance'); const dateIdx = cols.findIndex(c => ['date', 'postDate', 'valueDate'].includes(c.field));
  const colOf = w => {
    const cx = w.x + w.w / 2, r = w.ar ?? (w.x + w.w);
    if (layIsAmt(w.s) && numIdx.length) { let bi = -1, bd = 1e9; for (const i of numIdx) { const c = cols[i]; const d = c.amtR ? Math.abs(r - c.amtR) : (r < c.x0 ? c.x0 - r : r > c.x1 ? r - c.x1 : 0); if (d < bd) { bd = d; bi = i; } } if (bd < 30) return bi; }
    let bi = 0, bd = 1e9; cols.forEach((c, i) => { const d = cx < c.x0 ? c.x0 - cx : cx > c.x1 ? cx - c.x1 : 0; if (d < bd) { bd = d; bi = i; } }); return bi;
  };
  // 5 · anchors: lines with a balance amount (else a date in the date column)
  for (const l of data) { l.cells = l.words.map(w => ({ w, c: colOf(w) })); l.anchor = balIdx >= 0 ? l.cells.some(x => x.c === balIdx && layIsAmt(x.w.s)) : dateIdx >= 0 && l.cells.some(x => x.c === dateIdx && LAY_DATE.test(x.w.s)); }
  const nAnch = data.filter(l => l.anchor && l.kind === 'data').length; if (nAnch < 1) return null;
  // 6 · group lines into rows, page by page
  const byPage = new Map(); for (const l of data) { if (!byPage.has(l.page)) byPage.set(l.page, []); byPage.get(l.page).push(l); }
  const gapsAll = []; for (const ls of byPage.values()) for (let i = 1; i < ls.length; i++) { const g = ls[i].y - ls[i - 1].y; if (g > 0 && g < 4 * ls[i].h) gapsAll.push(g); }
  gapsAll.sort((a, b) => a - b); const pitch = gapsAll.length ? gapsAll[Math.floor(gapsAll.length / 2)] : 10;
  const rows = [];
  let toA = 0, toB = 0; // how narration usually sits: below its amounts (top-aligned) or above them
  for (const ls of byPage.values()) { const A = ls.map((l, i) => l.anchor ? i : -1).filter(i => i >= 0);
    for (let k = 0; k < A.length - 1; k++) { const a = A[k], b = A[k + 1]; if (b - a < 2) continue; let gm = -1, cut = a; for (let i = a; i < b; i++) { const g = ls[i + 1].y - ls[i].y; if (g > gm + 0.3) { gm = g; cut = i; } } toA += cut - a; toB += b - 1 - cut; } }
  const aboveMode = toB > 0.25 * (toA + toB);
  for (const [p, ls] of byPage) {
    const A = ls.map((l, i) => l.anchor || l.kind === 'sum' ? i : -1).filter(i => i >= 0); if (!A.length) { continue; }
    const owner = new Array(ls.length).fill(-1); A.forEach(i => owner[i] = i);
    // before the first anchor / after the last: only lines in the same text block (small gaps)
    if (p === hPage || aboveMode) for (let i = A[0] - 1; i >= 0; i--) { if (ls[i + 1].y - ls[i].y > 1.6 * pitch || ls[i].kind === 'sum') break; owner[i] = A[0]; }
    else if (rows.length && !rows[rows.length - 1].sum && A[0] > 0) { // a row that wrapped over the page break: its tail lines sit above this page's first row
      let ok = A[0] <= 3; for (let i = 0; i < A[0] && ok; i++) { if (ls[i].kind === 'sum' || ls[i].cells.some(x => numIdx.includes(x.c)) || /statement\s*of|account\s*(name|no|number|statement|summary)|a\/c\s*no|page\s*(no\.?\s*)?\d|customer\s*(id|name)|period\s*:|\bbranch\s*:|\bifsc\b/i.test(ls[i].text) || (i && ls[i].y - ls[i - 1].y > 1.6 * pitch) || (dateIdx >= 0 && ls[i].cells.some(x => x.c === dateIdx && LAY_DATE.test(x.w.s) && /\d{4}|\d{2}$/.test(x.w.s) && x.w.s.length > 6))) ok = false; }
      if (ok) { const prev = rows[rows.length - 1]; const add = cols.map(() => []);
        for (let i = 0; i < A[0]; i++) { for (const x of ls[i].cells) add[x.c].push(x.w.s); owner[i] = -2; }
        prev.row = prev.row.map((t, ci) => { if (!add[ci].length) return t; let v = (t + ' ' + add[ci].join(' ')).trim(); if (ci === dateIdx || ['date', 'postDate', 'valueDate'].includes(cols[ci].field)) v = layNormDate(v); return v; }); } }
    for (let i = A[A.length - 1] + 1; i < ls.length; i++) { if (ls[i].y - ls[i - 1].y > 1.6 * pitch || ls[i].kind === 'sum') break; owner[i] = A[A.length - 1]; }
    for (let k = 0; k < A.length - 1; k++) {
      const a = A[k], b = A[k + 1]; if (b - a < 2) continue;
      if (ls[a].kind === 'sum') { for (let i = a + 1; i < b; i++) owner[i] = b; continue; }
      if (ls[b].kind === 'sum') { for (let i = a + 1; i < b; i++) owner[i] = a; continue; }
      let gmax = -1; for (let i = a; i < b; i++) gmax = Math.max(gmax, ls[i + 1].y - ls[i].y);
      const cands = []; for (let i = a; i < b; i++) if (ls[i + 1].y - ls[i].y >= gmax - 0.3) cands.push(i);
      const hasD = i => dateIdx >= 0 && ls[i].cells.some(x => x.c === dateIdx && LAY_DATE.test(x.w.s));
      let cut = cands[cands.length - 1];
      if (cands.length > 1 && dateIdx >= 0) { const score = c => { let da = 0, db = 0; for (let i = a; i <= b; i++) if (hasD(i)) { if (i <= c) da++; else db++; } return (da === 1 ? 1 : 0) + (db === 1 ? 1 : 0) - (da > 1 ? 1 : 0) - (db > 1 ? 1 : 0); }; let bs = -9; for (const c of cands.slice().reverse()) { const sc = score(c); if (sc > bs) { bs = sc; cut = c; } } }
      for (let i = a + 1; i < b; i++) owner[i] = i <= cut ? a : b;
    }
    for (const i of A) {
      const members = ls.filter((l, j) => owner[j] === i);
      const cells = cols.map(() => []);
      for (const m of members) for (const x of m.cells) cells[x.c].push(x.w.s);
      const row = cells.map((c, ci) => { let t = c.join(' ').trim(); if (ci === dateIdx || ['date', 'postDate', 'valueDate'].includes(cols[ci].field)) t = layNormDate(t); return t; });
      if (!row.some(t => /[A-Za-z]{2,}/.test(t) || LAY_DATE.test(t))) continue;
      if (!row.some(t => LAY_DATE.test(t)) && /\bcount\b|balance as on|statement summary|\btotal\b/i.test(row.join(' '))) continue; // totals / summary figures without a date or text
      rows.push({ row, page: p, y: ls[i].y, sum: ls[i].kind === 'sum' });
    }
  }
  { // trailer after the last dated row (summary tables, bank address) is not part of the statement
    let lastD = -1; rows.forEach((r, i) => { if (r.row.some((t, ci) => ['date', 'postDate', 'valueDate'].includes(cols[ci].field) && LAY_DATE.test(t))) lastD = i; });
    if (lastD >= 0) rows.splice(lastD + 1, rows.length, ...rows.slice(lastD + 1).filter(r => LAY_SUMMARY.test(r.row.join(' ')) && /closing|carried|c\/f/i.test(r.row.join(' ')))); }
  const labels = cols.map(c => c.label || '');
  const preLines = L.filter(l => l.page < hPage || (l.page === hPage && l.y < hy0)).map(l => l.text);
  return { rows: [labels].concat(rows.map(r => r.row)), rowRef: [{ page: hPage, row: 0 }].concat(rows.map((r, i) => ({ page: r.page, row: i + 1 }))), pre: preLines.slice(0, 60).join('\n'), cols: cols.map(c => ({ label: c.label, field: c.field, x0: Math.round(c.x0), x1: Math.round(c.x1), amtR: c.amtR && Math.round(c.amtR) })) };
}

/* heading text → statement field (same synonym list as the Excel / CSV reader) */
function layClassify(label) {
  const k = normKey(label); if (!k || k.length > 40) return ''; const dict = FIELDS.statement.f; let best = '', bs = 0;
  for (const [f, syn] of Object.entries(dict)) { let s = 0; if (syn.includes(k)) s = 4; else if (k.length > 3) for (const w of syn) if (w.length > 3 && (k.startsWith(w) || k.endsWith(w))) s = Math.max(s, 2.5 + w.length / 100); if (s > bs) { bs = s; best = f; } }
  return best;
}
/* after the table is rebuilt: a first row with only a balance (no date, no text) is the opening balance */
function layFinish(t) {
  const H = t.rows[0].map(layClassify); const di = H.findIndex(f => ['date', 'postDate', 'valueDate'].includes(f)); const ni = H.indexOf('narr'); const bi = H.indexOf('balance');
  for (let i = 1; i < t.rows.length; i++) { const r = t.rows[i]; if (di >= 0 && LAY_DATE.test(r[di] || '')) break; if (bi >= 0 && LAY_AMT.test(r[bi] || '') && ni >= 0 && !/[A-Za-z]{3}/.test(r.join(' ').replace(/\b(cr|dr)\b/ig, ''))) r[ni] = 'OPENING BALANCE'; }
  return t;
}
/* fixed-width text reports (.txt / .rpt / .prn): each run of text separated by 2+ spaces is placed at its character column */
function textLayout(text) {
  const pages = [{ page: 1, lines: [] }]; let y = 0;
  for (const raw of text.split(/\r?\n/)) {
    if (/\f/.test(raw)) { pages.push({ page: pages.length + 1, lines: [] }); }
    const line = raw.replace(/[\f\x00-\x08\x0e-\x1f]/g, ' ').replace(/\t/g, '    '); y += 12; if (!line.trim()) continue;
    const items = []; const rx = /\S+(?: \S+)*/g; let m; while ((m = rx.exec(line))) items.push({ s: m[0], x: m.index * 6, w: m[0].length * 6, h: 10 });
    pages[pages.length - 1].lines.push({ y, h: 10, items });
  }
  const t = layoutTable(pages); return t ? layFinish(t) : null;
}

async function pdfGrids(buf, onProg) {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, disableFontFace: true }).promise;
  const lines = []; let ocrPages = 0; let pre = ''; const layPages = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    onProg && onProg(p / pdf.numPages, `page ${p}/${pdf.numPages}`);
    const page = await pdf.getPage(p); const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    let items = tc.items.filter(i => i.str && i.str.trim()).map(i => { const t = pdfjsLib.Util.transform(vp.transform, i.transform); const h = Math.hypot(t[2], t[3]) || 8; return { s: i.str.trim(), x: t[4], y: t[5], w: i.width || i.str.length * h * .5, h }; });
    if (items.reduce((a, i) => a + i.s.length, 0) < 25 && (p === 1 || ocrPages === p - 1)) { // scanned page -> OCR (a blank page inside a text PDF is skipped)
      ocrPages++; const w = await ocrWorker(); const vp2 = page.getViewport({ scale: 2.2 });
      const cv = document.createElement('canvas'); cv.width = vp2.width; cv.height = vp2.height;
      await page.render({ canvasContext: cv.getContext('2d'), viewport: vp2 }).promise;
      const res = await w.recognize(cv, {}, { blocks: true });
      items = []; const words = (res.data.words || []);
      for (const wd of words) if (wd.text.trim() && wd.confidence > 30) items.push({ s: wd.text.trim(), x: wd.bbox.x0 / 2.2, y: wd.bbox.y1 / 2.2, w: (wd.bbox.x1 - wd.bbox.x0) / 2.2, h: (wd.bbox.y1 - wd.bbox.y0) / 2.2 || 8, ocr: true });
    }
    { const its = items.slice().sort((a, b) => a.y - b.y || a.x - b.x); const pl = [];
      for (const it of its) { const l = pl[pl.length - 1]; if (l && Math.abs(it.y - l.y) <= Math.max(1.5, 0.3 * (it.h || 8))) l.items.push(it); else pl.push({ y: it.y, h: it.h || 8, items: [it] }); }
      layPages.push({ page: p, lines: pl }); }
    // split merged runs of amounts ("95,000.00 95,500.00") into separate positioned tokens
    items = items.flatMap(it => { if (!/^[\d,.()-]+(\s*(cr|dr))?(\s+[\d,.()-]+(\s*(cr|dr))?)+$/i.test(it.s)) return [it]; const parts = it.s.split(/\s+(?![cd]r\b)/i); const cw = it.w / it.s.length; let x = it.x; return parts.map(p => { const o = { s: p, x, y: it.y, w: p.length * cw, ocr: it.ocr }; x += (p.length + 1) * cw; return o; }); });
    items.sort((a, b) => a.y - b.y || a.x - b.x);
    let cur = null;
    for (const it of items) { if (!cur || Math.abs(it.y - cur.y) > 3) { cur = { y: it.y, page: p, items: [] }; lines.push(cur); } cur.items.push(it); }
  }
  lines.forEach(l => l.items.sort((a, b) => a.x - b.x));
  // 1st choice: rebuild the statement table from positions (multi-line headings / narration, row grouping by balance line)
  try { const t = layoutTable(layPages); if (t && t.rows.length > 2) { layFinish(t); return [{ sheet: 'PDF', rows: t.rows, rowRef: t.rowRef, pre: t.pre, ocrPages, layout: true }]; } } catch (e) { console.warn('layout reader', e); }
  // header line detection
  const dict = FIELDS.statement.f; let best = null;
  lines.forEach((l, i) => {
    const t = l.items.map(x => normKey(x.s)); let sc = 0;
    for (const f of ['date', 'narr', 'debit', 'credit', 'balance', 'amount', 'ref']) if (t.some(w => dict[f].includes(w) || dict[f].some(s => s.length > 4 && w.startsWith(s)))) sc++;
    const joined = normKey(l.items.map(x => x.s).join(' '));
    for (const f of ['debit', 'credit', 'balance']) if (dict[f].some(s => s.length > 5 && joined.includes(s))) sc += .5;
    if (sc >= 3 && (!best || sc > best.sc)) best = { i, sc };
  });
  if (!best) { // no table header → return raw lines as single-column grid for review
    const rows = lines.map(l => [l.items.map(x => x.s).join(' ')]);
    return [{ sheet: 'PDF text', rows, rowRef: lines.map((l, i) => ({ page: l.page, row: i + 1 })), pre: rows.slice(0, 40).join('\n'), ocrPages, noTable: true }];
  }
  const H = lines[best.i];
  // merge header words into column clusters
  const cols = [];
  const isHdr = s => { const k = normKey(s); if (k.length < 2) return false; return Object.values(dict).some(syn => syn.includes(k) || syn.some(w => w.length > 3 && k.startsWith(w))); };
  for (const it of H.items) { const last = cols[cols.length - 1]; if (last && it.x - last.x1 < 4 && !(isHdr(last.s) && isHdr(it.s))) { last.s += ' ' + it.s; last.x1 = it.x + it.w; } else cols.push({ s: it.s, x0: it.x, x1: it.x + it.w }); }
  cols.forEach(c => c.cx = (c.x0 + c.x1) / 2);
  const bounds = cols.map((c, i) => [i === 0 ? -1e9 : (cols[i - 1].x1 + c.x0) / 2, i === cols.length - 1 ? 1e9 : (c.x1 + cols[i + 1].x0) / 2]);
  const headerKey = normKey(H.items.map(x => x.s).join(''));
  pre = lines.slice(0, best.i).map(l => l.items.map(x => x.s).join(' ')).join('\n');
  const rows = [cols.map(c => c.s)]; const rowRef = [{ page: H.page, row: best.i + 1 }];
  for (let i = best.i + 1; i < lines.length; i++) {
    const l = lines[i]; if (normKey(l.items.map(x => x.s).join('')) === headerKey) continue;
    const row = cols.map(() => '');
    for (const it of l.items) {
      const cx = it.x + it.w / 2; let k = bounds.findIndex(b => cx >= b[0] && cx < b[1]);
      if (/^[\d,().₹-]+(\.\d{1,2})?\s*(cr|dr)?$/i.test(it.s)) { // numbers: nearest column by right edge
        let bd = 1e9; cols.forEach((c, j) => { const d = Math.abs((it.x + it.w) - c.x1); if (d < bd) { bd = d; k = j; } });
      }
      if (k < 0) k = 0; row[k] = row[k] ? row[k] + ' ' + it.s : it.s;
    }
    rows.push(row); rowRef.push({ page: l.page, row: i + 1 });
  }
  return [{ sheet: 'PDF', rows, rowRef, pre, ocrPages, headerFixed: 0 }];
}

/* ------------------------------ header detection ------------------------------ */
function scoreHeaderRow(cells, dict, hints) {
  const used = new Set(), map = {}; let score = 0;
  const cand = [];
  cells.forEach((c, i) => {
    const k = normKey(cellText(c)); if (!k || k.length > 40) return;
    for (const [f, syn] of Object.entries(dict)) {
      const hs = (hints && hints[f]) || [];
      let s = 0;
      if (hs.includes(k)) s = 5; else if (syn.includes(k)) s = 4;
      else if (k.length > 3) { for (const w of syn) if (w.length > 3 && (k.startsWith(w) || k.endsWith(w))) { s = Math.max(s, 2.5); } }
      if (s) cand.push({ f, i, s: s - syn.indexOf(k) * 0.001 });
    }
  });
  cand.sort((a, b) => b.s - a.s);
  for (const c of cand) { if (map[c.f] !== undefined || used.has(c.i)) continue; map[c.f] = c.i; used.add(c.i); score += c.s >= 4 ? 1 : .6; }
  return { map, score };
}
function detectHeader(rows, kind, bankCode) {
  const dict = FIELDS[kind].f; const hints = kind === 'statement' ? bankByCode(bankCode).hints : null;
  let best = { row: -1, score: 0, map: {} };
  const lim = Math.min(rows.length, 80);
  for (let r = 0; r < lim; r++) {
    const nonEmpty = rows[r].filter(v => v !== '' && v != null).length; if (nonEmpty < 2) continue;
    const a = scoreHeaderRow(rows[r], dict, hints);
    if (a.score > best.score) best = { row: r, score: a.score, map: a.map, rows: 1 };
    if (r + 1 < rows.length) { // two-row header
      const comb = rows[r].map((v, i) => cellText(v) + ' ' + cellText(rows[r + 1][i]));
      const b = scoreHeaderRow(comb, dict, hints);
      const b2 = scoreHeaderRow(rows[r + 1].map((v, i) => cellText(v) || cellText(rows[r][i])), dict, hints);
      const bb = b2.score > b.score ? b2 : b;
      if (bb.score > best.score + .5) best = { row: r, score: bb.score, map: bb.map, rows: 2 };
    }
  }
  if (kind === 'statement' && best.row >= 0 && best.map.date === undefined) { const alt = best.map.postDate !== undefined ? 'postDate' : best.map.valueDate !== undefined ? 'valueDate' : null; if (alt) { best.map.date = best.map[alt]; delete best.map[alt]; } }
  if (kind === 'ncrp' && best.row >= 0) ncrpRefineMap(best.rows === 2 ? rows[best.row].map((v, i) => cellText(v) + ' ' + cellText((rows[best.row + 1] || [])[i])) : rows[best.row], best.map);
  return best;
}
/* NCRP / I4C reports repeat some headings: the first "Transaction Id / UTR", "Transaction Amount", "Bank" belong to the
   transaction that brought money INTO the layer account; the later ones (after "Action Taken") describe the bank's action
   — e.g. the onward "Money Transfer to" transaction. Map the repeats to toUtr / toAmount / toBank / toDate. */
function ncrpRefineMap(cells, map) {
  const keys = cells.map(c => normKey(cellText(c))); const used = new Set(Object.values(map)); const dict = FIELDS.ncrp.f;
  if (map.acctNo === undefined) { const i = keys.findIndex((k, j) => !used.has(j) && /(wallet|pgpa)/.test(k) && /(acc|id)/.test(k) && !/bank/.test(k.slice(0, 4))); if (i >= 0) { if (map.toAcct === i) delete map.toAcct; map.acctNo = i; used.add(i); } }
  const like = (f, k) => dict[f].includes(k) || dict[f].some(w => w.length > 5 && (k.startsWith(w) || k.endsWith(w)));
  for (const [f, t] of [['utr', 'toUtr'], ['amount', 'toAmount'], ['bank', 'toBank'], ['date', 'toDate']]) {
    if (map[f] === undefined || map[t] !== undefined) continue;
    const idx = keys.map((k, i) => (i === map[f] || !used.has(i)) && k && like(f, k) && !/disput|hold/.test(k) ? i : -1).filter(i => i >= 0);
    if (idx.length < 2) continue;
    const first = Math.min(...idx); const rest = idx.filter(i => i !== first && (f !== 'utr' || /utr|transactionid|txnid|rrn/.test(keys[i])));
    const second = rest.find(i => keys[i] === keys[first]) ?? rest[0]; if (second === undefined) continue;
    map[f] = first; map[t] = second; used.add(first); used.add(second);
  }
  // Report with a separate onward UTR: a single amount / date column sitting in the action block (after the
  // beneficiary account / action columns) describes the onward transaction, not the credit into the layer account.
  if (map.toUtr !== undefined) {
    const gs = Math.min(...[map.toAcct, map.status, map.toBank].filter(v => v !== undefined && v > (map.acctNo ?? -1)), map.toUtr);
    for (const [f, t] of [['amount', 'toAmount'], ['date', 'toDate']]) if (map[t] === undefined && map[f] !== undefined && map[f] > gs) { map[t] = map[f]; delete map[f]; }
  }
  // the beneficiary account of the action must come after the layer account
  if (map.acctNo !== undefined && map.toAcct !== undefined && map.toAcct < map.acctNo) { const j = keys.findIndex((k, i) => i > map.acctNo && !used.has(i) && dict.toAcct.includes(k)); if (j >= 0) { map.toAcct = j; } }
}
function mappingValid(kind, map) {
  const req = FIELDS[kind].required;
  if (kind === 'statement') return map.date !== undefined && ((map.debit !== undefined && map.credit !== undefined) || map.amount !== undefined || map.debit !== undefined || map.credit !== undefined);
  return req.every(g => g.some(f => map[f] !== undefined));
}
function headerSignature(rows, hr, nrows) { return normKey((rows[hr] || []).map(cellText).join('|') + (nrows === 2 ? '|' + (rows[hr + 1] || []).map(cellText).join('|') : '')).slice(0, 400); }

/* ------------------------------ narration intelligence ------------------------------ */
const RX = {
  upi: /([a-z0-9][a-z0-9._]{1,60}@[a-z][a-z0-9]{1,30})\b/i,
  ifsc: /\b([A-Z]{4}0[A-Z0-9]{6})\b/,
  neftUtr: /\b([A-Z]{4}[NRH]\d{9,20}|[A-Z]{4}\d{12,18}|[A-Z]{2,4}\d{2}[A-Z]\d{8,14})\b/,
  rrn12: /(?:^|[^0-9])(\d{12})(?![0-9])/,
  masked: /\b([X*]{2,}\d{3,8})\b/i,
  longNum: /(?:^|[^0-9])(\d{9,18})(?![0-9])/g,
  mobile: /(?:^|[^0-9])(?:\+?91[- ]?)?([6-9]\d{9})(?![0-9])/,
  time: /\b([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\b/
};
function detectChannel(n) {
  const s = ' ' + String(n || '').toUpperCase() + ' ';
  if (/\bUPI\b|UPI\/|\/UPI|UPIAR|UPI-/.test(s)) return 'UPI';
  if (/IMPS|\bMMT\b|IMPS-/.test(s)) return 'IMPS';
  if (/RTGS/.test(s)) return 'RTGS';
  if (/NEFT/.test(s)) return 'NEFT';
  if (/\bATM\b|\bATW\b|\bNWD\b|ATM WDL|CASH WDL|ATMWDL|\bEAW\b|\bAWD\b/.test(s)) return 'ATM';
  if (/CASH|\bCDM\b|BY CSH|SELF/.test(s)) return 'CASH';
  if (/\bPOS\b|\bPCD\b|ECOM|DEBIT CARD|\bVPS\b|\bVIN\b/.test(s)) return 'POS';
  if (/\bCHQ\b|CHEQUE|\bCLG\b|CLEARING|INWARD|OUTWARD/.test(s)) return 'CHEQUE';
  if (/NETBANK|\bINB\b|\bIB\b|INTERNET BANKING|\bBIL\b|ONLINE/.test(s)) return 'NET BANKING';
  if (/\bTRF\b|TRANSFER|\bFT\b|\bTO A\/C|BY TRANSFER|\bFUND/.test(s)) return 'BANK TRANSFER';
  return 'UNKNOWN';
}
function extractNarr(narr, refCell) {
  const n = String(narr || ''); const u = n.toUpperCase(); const out = { utr: '', upi: '', ifsc: '', cpAcct: [], cpMasked: '', mobile: '', cpName: '', channel: detectChannel(n) };
  const r = String(refCell || '').trim();
  const mu = n.match(RX.upi); if (mu && !/@(gmail|yahoo|hotmail|outlook|rediff)\./i.test(mu[0])) out.upi = mu[1].toLowerCase();
  const mi = u.match(RX.ifsc); if (mi) out.ifsc = mi[1];
  const mn = u.match(RX.neftUtr); if (mn && mn[1] !== out.ifsc) out.utr = mn[1];
  if (!out.utr) { const m12 = n.match(RX.rrn12); if (m12 && ['UPI', 'IMPS', 'UNKNOWN', 'BANK TRANSFER', 'ATM', 'POS'].includes(out.channel)) out.utr = m12[1]; }
  if (!out.utr && r && (/^\d{12}$/.test(r) || RX.neftUtr.test(r.toUpperCase()))) out.utr = r.toUpperCase();
  const mm = u.match(RX.masked); if (mm) out.cpMasked = mm[1];
  let m; RX.longNum.lastIndex = 0;
  while ((m = RX.longNum.exec(n))) { const v = m[1]; if (v === out.utr) continue; if (v.length === 12 && out.channel === 'UPI' && !out.utr) continue; out.cpAcct.push(v); }
  if (out.upi && /^[6-9]\d{9}/.test(out.upi)) out.mobile = out.upi.slice(0, 10);
  if (!out.mobile) { const mb = n.match(RX.mobile); if (mb) out.mobile = mb[1]; }
  // counterparty name: alphabetic token block in slash/hyphen separated narration
  const parts = n.split(/[\/\-|:]+/).map(x => x.trim()).filter(x => /^[A-Za-z][A-Za-z .&]{2,40}$/.test(x) && !/^(UPI|IMPS|NEFT|RTGS|DR|CR|P2A|P2P|P2M|MMT|TRF|TO|BY|FROM|PAYMENT|SENT|RECEIVED|BANK|TRANSFER|ATM|CASH|INB|NA)$/i.test(x));
  if (parts.length) out.cpName = parts[0].toUpperCase().slice(0, 40);
  return out;
}
