/* ------------------------------ utilities ------------------------------ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = v => String(v ?? '').replace(/[&<>"'`]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;'}[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tick = () => new Promise(r => setTimeout(r, 0));
const uniq = a => Array.from(new Set(a));
const sum = (a, f = x => x) => a.reduce((s, x) => s + (+f(x) || 0), 0);
const groupBy = (a, f) => { const m = new Map(); for (const x of a) { const k = f(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; };
const countBy = (a, f) => { const m = new Map(); for (const x of a) { const k = f(x); m.set(k, (m.get(k) || 0) + 1); } return m; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const round2 = v => Math.round((+v || 0) * 100) / 100;
const pad = (n, w = 2) => String(n).padStart(w, '0');
const normKey = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* Indian currency formatting (lakh/crore grouping) */
function inr(v, dec = 2) {
  if (v === null || v === undefined || v === '' || isNaN(v)) return '—';
  const neg = v < 0; v = Math.abs(+v);
  let [i, f] = v.toFixed(dec).split('.');
  let last3 = i.slice(-3), rest = i.slice(0, -3);
  if (rest) last3 = ',' + last3;
  rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return (neg ? '-' : '') + '₹' + rest + last3 + (dec ? '.' + f : '');
}
function inrShort(v) {
  v = +v || 0; const a = Math.abs(v);
  if (a >= 1e7) return '₹' + (v / 1e7).toFixed(2) + ' Cr';
  if (a >= 1e5) return '₹' + (v / 1e5).toFixed(2) + ' L';
  if (a >= 1e3) return '₹' + (v / 1e3).toFixed(1) + ' K';
  return '₹' + v.toFixed(0);
}
const nfmt = v => (+v || 0).toLocaleString('en-IN');

/* ------------------------ date/time (wall-clock IST) ------------------------
   All timestamps are stored as "wall-clock" milliseconds built with Date.UTC
   from the local (IST) components, so no browser timezone shifts are applied.
   Sources that deliver UTC are shifted at import by a per-file offset.       */
const MONTHS = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12};
function mkTs(y, m, d, H = 0, M = 0, S = 0) { return Date.UTC(y, m - 1, d, H, M, S); }
function validYMD(y, m, d) { return y > 1970 && y < 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31; }
function fmtDate(ts) { if (ts == null || isNaN(ts)) return '—'; const d = new Date(ts); return pad(d.getUTCDate()) + '-' + pad(d.getUTCMonth() + 1) + '-' + d.getUTCFullYear(); }
function fmtTime(ts) { if (ts == null || isNaN(ts)) return ''; const d = new Date(ts); return pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds()); }
function fmtDT(ts, hasTime = true) { return fmtDate(ts) + (hasTime ? ' ' + fmtTime(ts) : ''); }
function isoDate(ts) { const d = new Date(ts); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
function nowWall() { const n = new Date(); return mkTs(n.getFullYear(), n.getMonth() + 1, n.getDate(), n.getHours(), n.getMinutes(), n.getSeconds()); }
function nowStamp() { return fmtDT(nowWall()); }
function dow(ts) { return new Date(ts).getUTCDay(); }
function hourOf(ts) { return new Date(ts).getUTCHours(); }
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function durTxt(ms) {
  ms = Math.abs(ms); const m = Math.round(ms / 60000);
  if (m < 1) return Math.round(ms / 1000) + 's'; if (m < 60) return m + 'm';
  const h = Math.floor(m / 60); if (h < 48) return h + 'h ' + (m % 60) + 'm';
  return Math.floor(h / 24) + 'd ' + (h % 24) + 'h';
}

/* Parse a time fragment: "14:32", "14:32:18", "2:32:18 PM", "143218" */
function parseTimeStr(s) {
  if (s == null) return null;
  if (typeof s === 'number') { if (s >= 0 && s < 1) { const t = Math.round(s * 86400); return [Math.floor(t / 3600), Math.floor(t / 60) % 60, t % 60]; } return null; }
  s = String(s).trim();
  let m = s.match(/(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?(?:\.\d+)?\s*([AaPp][Mm])?/);
  if (!m) { m = s.match(/^(\d{2})(\d{2})(\d{2})$/); if (m) return [+m[1], +m[2], +m[3]]; return null; }
  let H = +m[1]; const M = +m[2], S = +(m[3] || 0);
  if (m[4]) { const pm = /p/i.test(m[4]); if (H === 12) H = pm ? 12 : 0; else if (pm) H += 12; }
  if (H > 23 || M > 59 || S > 59) return null;
  return [H, M, S];
}

/* Parse a date (+optional time). order: 'DMY' (India default) | 'MDY' | 'YMD'.
   Returns {ts, hasTime} or null. Never guesses silently: invalid -> null. */
function parseDateTime(v, order = 'DMY') {
  if (v == null || v === '') return null;
  if (typeof v === 'object' && v.d) { // grid date cell from Excel [y,m,d,H,M,S]
    const [y, m, d, H, M, S] = v.d; if (!validYMD(y, m, d)) return null;
    return { ts: mkTs(y, m, d, H, M, S), hasTime: !!(H || M || S) };
  }
  if (typeof v === 'number') {
    if (v > 20000 && v < 80000 && typeof XLSX !== 'undefined') { // Excel serial
      const p = XLSX.SSF.parse_date_code(v); if (!p) return null;
      return { ts: mkTs(p.y, p.m, p.d, p.H, p.M, Math.round(p.S)), hasTime: !!(p.H || p.M || p.S) };
    }
    const s = String(v); if (/^\d{8}$/.test(s)) v = s; else return null;
  }
  let s = String(v).trim().replace(/\s+/g, ' ');
  if (!s) return null;
  let y, m, d, rest = '';
  let r;
  if ((r = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ](.*))?$/))) { y = +r[1]; m = +r[2]; d = +r[3]; rest = r[4] || ''; }
  else if ((r = s.match(/^(\d{1,2})[-/. ]([A-Za-z]{3,9})[-/. ,]*(\d{2,4})(?:[ ,T]+(.*))?$/))) { d = +r[1]; m = MONTHS[r[2].toLowerCase().slice(0, r[2].length > 4 ? 3 : 4)] || MONTHS[r[2].toLowerCase().slice(0, 3)]; y = +r[3]; rest = r[4] || ''; }
  else if ((r = s.match(/^([A-Za-z]{3,9})[ -](\d{1,2}),?[ -](\d{2,4})(?:[ ,T]+(.*))?$/))) { m = MONTHS[r[1].toLowerCase().slice(0, 3)]; d = +r[2]; y = +r[3]; rest = r[4] || ''; }
  else if ((r = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:[ ,T]+(.*))?$/))) {
    const a = +r[1], b = +r[2]; y = +r[3]; rest = r[4] || '';
    if (order === 'MDY') { m = a; d = b; } else { d = a; m = b; }
    if (m > 12 && d <= 12) { const t = m; m = d; d = t; } // unambiguous swap
  }
  else if ((r = s.match(/^(\d{4})(\d{2})(\d{2})(?:[ T]?(\d{2}):?(\d{2}):?(\d{2}))?$/))) { y = +r[1]; m = +r[2]; d = +r[3]; if (r[4]) rest = r[4] + ':' + r[5] + ':' + r[6]; }
  else return null;
  if (y < 100) y += 2000;
  if (!validYMD(y, m, d)) return null;
  const t = rest ? parseTimeStr(rest) : null;
  return { ts: mkTs(y, m, d, t ? t[0] : 0, t ? t[1] : 0, t ? t[2] : 0), hasTime: !!t };
}
/* Detect DMY vs MDY for a column of slash dates. */
function detectDateOrder(values) {
  let dmy = 0, mdy = 0;
  for (const v of values) {
    if (typeof v !== 'string') continue;
    const r = v.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/); if (!r) continue;
    if (+r[1] > 12) dmy++; if (+r[2] > 12) mdy++;
  }
  return mdy > dmy ? 'MDY' : 'DMY';
}

/* Amount parsing: returns {v:number|null, ind:'DR'|'CR'|null} */
function parseAmount(v) {
  if (v == null || v === '') return { v: null, ind: null };
  if (typeof v === 'number') return { v, ind: null };
  if (typeof v === 'object') return { v: null, ind: null };
  let s = String(v).trim(); if (!s || /^[-–—]+$/.test(s)) return { v: null, ind: null };
  let ind = null;
  const mi = s.match(/\b(cr|dr|c|d)\.?\s*$/i) || s.match(/^\s*(cr|dr)\b/i);
  if (mi) { const t = mi[1].toLowerCase(); ind = t[0] === 'c' ? 'CR' : 'DR'; s = s.replace(mi[0], ''); }
  let neg = false;
  if (/^\(.*\)$/.test(s.trim())) { neg = true; s = s.replace(/[()]/g, ''); }
  s = s.replace(/₹|rs\.?|inr|,|\s/gi, '');
  if (s.startsWith('-')) { neg = true; s = s.slice(1); } else if (s.endsWith('-')) { neg = true; s = s.slice(0, -1); }
  if (s.startsWith('+')) s = s.slice(1);
  if (!/^\d*\.?\d+$/.test(s)) return { v: null, ind: null };
  const n = parseFloat(s); return { v: neg ? -n : n, ind };
}

/* Identifiers */
function normPhone(v) {
  let d = String(v ?? '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 13 && d.startsWith('091')) d = d.slice(3);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
}
const isMobile = d => /^[6-9]\d{9}$/.test(d);
const isServiceNo = d => !d || d.length < 8 || /^(1800|1860|140|155|1\d{2,4}$)/.test(d);
function normAcct(v) { return String(v ?? '').toUpperCase().replace(/[^0-9A-Z]/g, ''); }
function acctKey(v) { const s = normAcct(v); return /^\d+$/.test(s) ? s.replace(/^0+/, '') : s; }
function maskedMatch(masked, full) { // "XXXXXX1234" vs full number
  const m = normAcct(masked).replace(/[X*]+/g, '*'); if (!m.includes('*')) return false;
  const tail = m.split('*').pop(); return tail.length >= 4 && normAcct(full).endsWith(tail);
}
function normIP(v) {
  let s = String(v ?? '').trim(); if (!s) return '';
  s = s.replace(/^\[|\]$/g, '');
  const m4 = s.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::(\d+))?$/); if (m4) return m4[1].split('.').map(x => String(+x)).join('.');
  if (/^[0-9a-f:]+$/i.test(s) && s.includes(':')) return s.toLowerCase();
  return s;
}
function ipPortFrom(v) { const m = String(v ?? '').trim().match(/^(\d{1,3}(?:\.\d{1,3}){3}):(\d+)$/); return m ? +m[2] : null; }
function ipClass(ip) {
  if (!ip) return { t: 'none', label: '—' };
  if (ip.includes(':')) return { t: 'v6', label: 'IPv6 (public)', note: 'IPv6 is usually subscriber-unique at the /64 prefix; request IPDR with exact time.' };
  const p = ip.split('.').map(Number); if (p.length !== 4 || p.some(x => isNaN(x) || x > 255)) return { t: 'bad', label: 'Invalid' };
  if (p[0] === 10 || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168)) return { t: 'private', label: 'Private (RFC1918)', note: 'Private address — not traceable on the internet; obtain the NAT/public IP from the bank.' };
  if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return { t: 'cgnat', label: 'CGNAT (100.64/10)', note: 'Carrier-grade NAT — the source port and exact time are essential for IPDR resolution.' };
  if (p[0] === 127 || p[0] === 0 || p[0] >= 224) return { t: 'reserved', label: 'Reserved' };
  return { t: 'public', label: 'Public IPv4', note: 'Shared by many subscribers over time (dynamic NAT). Resolve with the exact timestamp and port.' };
}

/* hashing & ids */
async function sha256Hex(data) {
  const buf = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const h = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function rid(n = 10) { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, b => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join(''); }
function seqId(prefix, n) { return prefix + '-' + pad(n, prefix === 'TX' ? 6 : 4); }

/* downloads (formula-injection safe for CSV) */
function safeCell(v) { if (typeof v === 'string' && /^[=+\-@\t\r]/.test(v)) return "'" + v; return v; }
function downloadBlob(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
function toCSV(rows) { return rows.map(r => r.map(c => { c = safeCell(c ?? ''); c = String(c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(',')).join('\r\n'); }
function fileSafe(s) { return String(s || '').replace(/[^A-Za-z0-9_\-]+/g, '_').replace(/_+/g, '_').slice(0, 60); }

/* ------------------------------ UI helpers ------------------------------ */
function toast(msg, type = '', ms = 3800) {
  const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = msg;
  $('#toastRoot').appendChild(t); setTimeout(() => t.remove(), ms);
}
function modal({ title, body, foot, size = '', onClose, wide }) {
  const back = document.createElement('div'); back.className = 'modal-back';
  back.innerHTML = `<div class="modal ${size}"><div class="mh"><h3 style="margin:0">${title}</h3><button class="btn-g" data-x>✕</button></div><div class="mb"></div>${foot !== false ? '<div class="mf"></div>' : ''}</div>`;
  const mb = $('.mb', back); if (typeof body === 'string') mb.innerHTML = body; else if (body) mb.appendChild(body);
  const mf = $('.mf', back); if (mf && foot) { if (typeof foot === 'string') mf.innerHTML = foot; else mf.appendChild(foot); }
  const close = () => { back.remove(); onClose && onClose(); };
  $('[data-x]', back).onclick = close;
  back.addEventListener('mousedown', e => { if (e.target === back) close(); });
  $('#modalRoot').appendChild(back);
  return { el: back, body: mb, foot: mf, close };
}
function confirmBox(title, msg, okText = 'Confirm', danger = false) {
  return new Promise(res => {
    const m = modal({ title, size: 'sm', body: `<p>${msg}</p>`, foot: `<button data-c>Cancel</button><button class="${danger ? 'btn-d' : 'btn-p'}" data-o>${esc(okText)}</button>`, onClose: () => res(false) });
    $('[data-c]', m.el).onclick = () => { m.close(); };
    $('[data-o]', m.el).onclick = () => { m.el.remove(); res(true); };
  });
}
function promptBox(title, fields, okText = 'Save') {
  return new Promise(res => {
    const html = fields.map((f, i) => `<label class="f">${esc(f.label)}${f.type === 'select'
      ? `<select data-i="${i}">${f.options.map(o => `<option ${o === f.value ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`
      : f.type === 'textarea' ? `<textarea data-i="${i}" rows="3">${esc(f.value || '')}</textarea>`
      : `<input data-i="${i}" type="${f.type || 'text'}" value="${esc(f.value || '')}" placeholder="${esc(f.ph || '')}" ${f.type === 'password' ? 'autocomplete="new-password"' : ''}>`}</label>`).join('');
    const m = modal({ title, size: 'sm', body: `<div class="grid">${html}</div>`, foot: `<button data-c>Cancel</button><button class="btn-p" data-o>${esc(okText)}</button>`, onClose: () => res(null) });
    $('[data-c]', m.el).onclick = () => m.close();
    const ok = () => { const vals = fields.map((f, i) => { const el = $(`[data-i="${i}"]`, m.el); return el.value; }); m.el.remove(); res(vals); };
    $('[data-o]', m.el).onclick = ok;
    $$('input', m.el).forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); }));
    setTimeout(() => { const f = $('input,select,textarea', m.el); f && f.focus(); }, 30);
  });
}
function badge(text, color = 'gray') { return `<span class="badge b-${color}">${esc(text)}</span>`; }
function strengthBadge(s) { return badge(s, s === 'STRONG' ? 'green' : s === 'MODERATE' ? 'amber' : s === 'POSSIBLE' ? 'violet' : 'gray'); }
function roleColor(r) { r = String(r || ''); if (/complain|victim/i.test(r)) return 'red'; if (/L1|accused/i.test(r)) return 'amber'; if (/L2/i.test(r)) return 'violet'; if (/L3/i.test(r)) return 'blue'; if (/mule/i.test(r)) return 'pink'; return 'gray'; }
function layerName(l) { if (l == null) return 'Unlinked'; if (l === 0) return 'Complainant'; if (l === 1) return 'Layer 1 (Accused)'; if (l === 2) return 'Layer 2 (Suspect)'; return 'Layer ' + l; }
