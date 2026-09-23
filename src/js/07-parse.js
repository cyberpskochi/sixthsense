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
  if (/\.(txt|dat|tsv|psv)$/.test(name)) {
    const text = new TextDecoder().decode(buf); const lines = text.split(/\r?\n/).filter(l => l.trim());
    const cand = ['\t', '|', ',', ';']; const sample = lines.slice(0, 30).join('\n');
    const delim = cand.map(d => [d, sample.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
    const rows = lines.map(l => splitDelim(l, delim)); return { hash, type: 'TEXT', grids: [{ sheet: 'text', rows, rowRef: rows.map((_, i) => ({ row: i + 1 })) }] };
  }
  const wb = XLSX.read(buf, { type: 'array', cellDates: false, cellNF: true, raw: /\.csv$/.test(name), dense: true });
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
  return { hash, grids, type: /\.csv$/.test(name) ? 'CSV' : 'EXCEL' };
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
async function pdfGrids(buf, onProg) {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, disableFontFace: true }).promise;
  const lines = []; let ocrPages = 0; let pre = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    onProg && onProg(p / pdf.numPages, `page ${p}/${pdf.numPages}`);
    const page = await pdf.getPage(p); const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    let items = tc.items.filter(i => i.str && i.str.trim()).map(i => ({ s: i.str.trim(), x: i.transform[4], y: vp.height - i.transform[5], w: i.width || i.str.length * 4 }));
    if (items.reduce((a, i) => a + i.s.length, 0) < 25) { // scanned page -> OCR
      ocrPages++; const w = await ocrWorker(); const vp2 = page.getViewport({ scale: 2.2 });
      const cv = document.createElement('canvas'); cv.width = vp2.width; cv.height = vp2.height;
      await page.render({ canvasContext: cv.getContext('2d'), viewport: vp2 }).promise;
      const res = await w.recognize(cv, {}, { blocks: true });
      items = []; const words = (res.data.words || []);
      for (const wd of words) if (wd.text.trim() && wd.confidence > 30) items.push({ s: wd.text.trim(), x: wd.bbox.x0 / 2.2, y: wd.bbox.y1 / 2.2, w: (wd.bbox.x1 - wd.bbox.x0) / 2.2, ocr: true });
    }
    // split merged runs of amounts ("95,000.00 95,500.00") into separate positioned tokens
    items = items.flatMap(it => { if (!/^[\d,.()-]+(\s*(cr|dr))?(\s+[\d,.()-]+(\s*(cr|dr))?)+$/i.test(it.s)) return [it]; const parts = it.s.split(/\s+(?![cd]r\b)/i); const cw = it.w / it.s.length; let x = it.x; return parts.map(p => { const o = { s: p, x, y: it.y, w: p.length * cw, ocr: it.ocr }; x += (p.length + 1) * cw; return o; }); });
    items.sort((a, b) => a.y - b.y || a.x - b.x);
    let cur = null;
    for (const it of items) { if (!cur || Math.abs(it.y - cur.y) > 3) { cur = { y: it.y, page: p, items: [] }; lines.push(cur); } cur.items.push(it); }
  }
  lines.forEach(l => l.items.sort((a, b) => a.x - b.x));
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
  return best;
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
