/* ============================ CDR ANALYSIS (segregated) ============================
   One CDR target, or every uploaded CDR combined, split into:
   Call Summary · Contacts · Day / Night Location · Date-wise · IMEI & SIM · SMS Analysis · Event Log.
   Wording rule: cell-site correlation (serving area) — never an exact location, never proof.   */
const CDA = { num: '', tab: 'summary', nStart: 22, nEnd: 6, tac: null, tacName: '', q: '', fKind: '', fDir: '', cache: null };
const CDA_TABS = [['summary', 'Call Summary'], ['contacts', 'Contacts'], ['loc', 'Day / Night Location'], ['days', 'Date-wise'], ['imei', 'IMEI & SIM'], ['sms', 'SMS Analysis'], ['log', 'Event Log']];
const cdaHr = ts => new Date(ts).getUTCHours();
const cdaNight = h => CDA.nStart > CDA.nEnd ? (h >= CDA.nStart || h < CDA.nEnd) : (h >= CDA.nStart && h < CDA.nEnd);
const cdaIsHdr = s => /[A-Za-z]/.test(s || '');
const cdaCell = r => r.cell || r.lastCell || '';
const cdaPct = (a, b) => b ? Math.round(a / b * 1000) / 10 : 0;
const cdaT = ts => fmtDT(ts);
function cdaDur(s) { s = Math.round(+s || 0); if (!s) return '0 s'; const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ' h ' : '') + (h || m ? m + ' m ' : '') + x + ' s'; }
function cdaLink(n) { const i = IX.numInfo.get(n); return i ? i.links.map(l => (l.kind === 'Alternate number' ? 'ALT ' : l.kind === 'Registered mobile' ? 'REG ' : '') + (l.label || l.role || '')).join('; ') : ''; }
function cdaLuhnCd(d14) { let s = 0; for (let i = 0; i < 14; i++) { let x = +d14[i]; if (i % 2 === 1) { x *= 2; if (x > 9) x -= 9; } s += x; } return (10 - s % 10) % 10; }
function cdaImeiCheck(i15, i14) { if (i15.length === 15) { const cd = cdaLuhnCd(i15); return +i15[14] === cd ? 'Valid' : (+i15[14] === 0 ? 'Check digit zeroed by operator (should be ' + cd + ')' : 'Check digit wrong (should be ' + cd + ')'); } return '14 digits — check digit not given'; }
function cdaHdrCat(h) {
  const n = String(h).toUpperCase().replace(/^[A-Z]{2}-/, '').replace(/[^A-Z0-9]/g, '');
  if (/SBI|HDFC|ICICI|AXIS|BOB|BARODA|PNB|CANARA|KOTAK|IDFC|YESB|FEDBNK|FEDERAL|IOB|UNION|INDUS|BOI|UCO|CBI|IDBI|RBL|KVB|KGB|KLGB|AUBANK|BANDHAN|DCB|CSB|JKB|PAYTM|PHONEPE|GPAY|BHIM|MOBIKWIK|FREECHARGE|NPCI|UPI|CRED|SLICE|BANK|BNK/.test(n)) return 'Bank / Payment';
  if (/AIRTEL|JIO|VODAF|VIL|BSNL|MTNL|IDEA|TELECOM/.test(n)) return 'Telecom operator';
  if (/AMZN|AMAZON|FLIP|MYNTRA|SWIGGY|ZOMATO|MEESHO|UBER|IRCTC|BIGBSKT|BLINKIT|ZEPTO|NYKAA|AJIO|BOOKMY|GOIBIBO/.test(n)) return 'E-commerce / services';
  if (/GOVT|GOV|UIDAI|EPFO|INCOME|ITD|GST|DIGILK|MYGOV|POLICE/.test(n)) return 'Government';
  return 'Other header';
}
function cdaRows(num) {
  const cdr = S.cur.telecom.cdr; if (num === '*') return cdr.slice().sort((a, b) => a.ts - b.ts);
  return (cdrIndex().get(num) || []).map(i => cdr[i]);
}
function cdaCtx() {
  const c = S.cur; const key = CDA.num + '|' + c.telecom.cdr.length + '|' + c.telecom.sms.length + '|' + CDA.nStart + '|' + CDA.nEnd;
  if (CDA.cache && CDA.cache.key === key) return CDA.cache;
  const rows = cdaRows(CDA.num); const X = { key, rows, calls: [], sms: [], data: [], _: {} };
  for (const r of rows) (r.kind === 'SMS' ? X.sms : r.kind === 'DATA' ? X.data : X.calls).push(r);
  CDA.cache = X; return X;
}
const cdaMemo = (X, k, f) => k in X._ ? X._[k] : (X._[k] = f());

/* ---------- data builders (shared by screen and Excel export) ---------- */
function cdaContacts(X) {
  return cdaMemo(X, 'contacts', () => {
    const m = new Map();
    for (const r of X.rows) {
      if (!r.other || r.kind === 'DATA') continue; const hdr = cdaIsHdr(r.other); if (hdr) continue;
      let x = m.get(r.other); if (!x) { x = { num: r.other, cOut: 0, cIn: 0, cUnk: 0, sOut: 0, sIn: 0, n: 0, dur: 0, night: 0, first: r.ts, last: r.ts, days: new Set(), targets: new Set() }; m.set(r.other, x); }
      x.n++; x.dur += r.dur || 0; x.first = Math.min(x.first, r.ts); x.last = Math.max(x.last, r.ts); x.days.add(dayKey(r.ts)); x.targets.add(r.target); if (cdaNight(cdaHr(r.ts))) x.night++;
      if (r.kind === 'SMS') { if (r.dir === 'OUT') x.sOut++; else if (r.dir === 'IN') x.sIn++; } else { if (r.dir === 'OUT') x.cOut++; else if (r.dir === 'IN') x.cIn++; else x.cUnk++; }
    }
    return Array.from(m.values()).sort((a, b) => b.n - a.n);
  });
}
function cdaCellStats(rows, pred) {
  const m = new Map();
  for (const r of rows) {
    const k = cdaCell(r); if (!k || (pred && !pred(r))) continue;
    let x = m.get(k); if (!x) { x = { cell: k, addr: '', lat: null, lon: null, lac: '', n: 0, first: r.ts, last: r.ts, days: new Set() }; m.set(k, x); }
    x.n++; x.first = Math.min(x.first, r.ts); x.last = Math.max(x.last, r.ts); x.days.add(dayKey(r.ts));
    if (!x.addr && r.addr) x.addr = r.addr; if (r.cellSrc && (!x.src || r.cellSrc === 'DB~')) x.src = r.cellSrc; if (x.lat == null && r.lat != null) { x.lat = r.lat; x.lon = r.lon; } if (!x.lac && r.lac) x.lac = r.lac;
  }
  const l = Array.from(m.values()).sort((a, b) => b.n - a.n); const tot = sum(l, x => x.n); l.forEach(x => { x.pct = cdaPct(x.n, tot); x.d = x.days.size; }); return l;
}
function cdaNights(X) {
  return cdaMemo(X, 'nights', () => {
    const m = new Map();
    for (const r of X.rows) {
      const k = cdaCell(r); if (!k) continue; const h = cdaHr(r.ts); if (!cdaNight(h)) continue;
      const nk = CDA.nStart > CDA.nEnd && h < CDA.nEnd ? dayKey(r.ts - 86400000) : dayKey(r.ts);
      let n = m.get(nk); if (!n) { n = { night: nk, n: 0, cells: new Map(), first: r.ts, last: r.ts }; m.set(nk, n); }
      n.n++; n.first = Math.min(n.first, r.ts); n.last = Math.max(n.last, r.ts);
      let c = n.cells.get(k); if (!c) { c = { cell: k, n: 0, addr: '' }; n.cells.set(k, c); } c.n++; if (!c.addr && r.addr) c.addr = r.addr;
    }
    const out = Array.from(m.values()).sort((a, b) => a.night.localeCompare(b.night)).map(n => { const cl = Array.from(n.cells.values()).sort((a, b) => b.n - a.n); return { night: n.night, n: n.n, main: cl[0], pct: cdaPct(cl[0].n, n.n), others: cl.slice(1), first: n.first, last: n.last }; });
    const dom = new Map(); for (const n of out) dom.set(n.main.cell, (dom.get(n.main.cell) || { cell: n.main.cell, addr: n.main.addr, nights: 0 })), dom.get(n.main.cell).nights++;
    return { nights: out, dominant: Array.from(dom.values()).sort((a, b) => b.nights - a.nights) };
  });
}
function cdaDays(X) {
  return cdaMemo(X, 'days', () => Array.from(groupBy(X.rows, r => dayKey(r.ts)).entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([day, l]) => {
    const calls = l.filter(r => r.kind !== 'SMS' && r.kind !== 'DATA'); const cells = cdaCellStats(l); const withCell = l.filter(r => cdaCell(r));
    const f = withCell[0], z = withCell[withCell.length - 1];
    return { day, n: l.length, cOut: calls.filter(r => r.dir === 'OUT').length, cIn: calls.filter(r => r.dir === 'IN').length, sOut: l.filter(r => r.kind === 'SMS' && r.dir === 'OUT').length, sIn: l.filter(r => r.kind === 'SMS' && r.dir === 'IN').length, data: l.filter(r => r.kind === 'DATA').length, dur: sum(calls, r => r.dur), cells: cells.length, top: cells[0], first: l[0].ts, last: l[l.length - 1].ts, fCell: f ? cdaCell(f) : '', fAddr: f ? f.addr : '', zCell: z ? cdaCell(z) : '', zAddr: z ? z.addr : '', night: l.filter(r => cdaNight(cdaHr(r.ts))).length };
  }));
}
function cdaImei(X) {
  return cdaMemo(X, 'imei', () => {
    const g = new Map(); let noImei = 0;
    for (const r of X.rows) {
      if (!r.imei || r.imei.length < 14) { noImei++; continue; } const k = r.imei.slice(0, 14);
      let x = g.get(k); if (!x) { x = { k, forms: new Map(), n: 0, calls: 0, sms: 0, data: 0, imsis: new Map(), cells: new Set(), days: new Set(), targets: new Set(), first: r.ts, last: r.ts, rows: [] }; g.set(k, x); }
      x.n++; x.forms.set(r.imei, (x.forms.get(r.imei) || 0) + 1); if (r.kind === 'SMS') x.sms++; else if (r.kind === 'DATA') x.data++; else x.calls++;
      if (r.imsi) x.imsis.set(r.imsi, (x.imsis.get(r.imsi) || 0) + 1); const ce = cdaCell(r); if (ce) x.cells.add(ce); x.days.add(dayKey(r.ts)); x.targets.add(r.target); x.first = Math.min(x.first, r.ts); x.last = Math.max(x.last, r.ts); x.rows.push(r);
    }
    const imeis = Array.from(g.values()).map(x => { const i15 = Array.from(x.forms.entries()).sort((a, b) => b[1] - a[1])[0][0]; return Object.assign(x, { i15, tac: x.k.slice(0, 8), check: cdaImeiCheck(i15, x.k), model: CDA.tac ? (CDA.tac.get(x.k.slice(0, 8)) || '') : '' }); }).sort((a, b) => b.n - a.n);
    const sm = new Map();
    for (const r of X.rows) { if (!r.imsi) continue; let x = sm.get(r.imsi); if (!x) { x = { imsi: r.imsi, n: 0, imeis: new Set(), first: r.ts, last: r.ts, op: r.op || '', mcc: r.imsi.slice(0, 3), targets: new Set() }; sm.set(r.imsi, x); } x.n++; x.first = Math.min(x.first, r.ts); x.last = Math.max(x.last, r.ts); if (r.imei && r.imei.length >= 14) x.imeis.add(r.imei.slice(0, 14)); x.targets.add(r.target); if (!x.op && r.op) x.op = r.op; }
    const imsis = Array.from(sm.values()).sort((a, b) => b.n - a.n);
    const chg = []; for (const [t, l] of groupBy(X.rows, r => r.target)) { let pi = null, ps = null; for (const r of l) { const ci = r.imei && r.imei.length >= 14 ? r.imei.slice(0, 14) : null, cs = r.imsi || null; if (ci) { if (pi && ci !== pi) chg.push({ ts: r.ts, target: t, what: 'IMEI changed', from: pi, to: ci, cell: cdaCell(r) }); pi = ci; } if (cs) { if (ps && cs !== ps) chg.push({ ts: r.ts, target: t, what: 'IMSI / SIM changed', from: ps, to: cs, cell: cdaCell(r) }); ps = cs; } } }
    chg.sort((a, b) => a.ts - b.ts);
    return { imeis, imsis, chg, noImei };
  });
}
function cdaSmsData(X) {
  return cdaMemo(X, 'sms', () => {
    const hdr = new Map(), p2p = new Map(); const bank = [];
    for (const r of X.sms) {
      if (!r.other) continue;
      if (cdaIsHdr(r.other)) {
        let x = hdr.get(r.other); if (!x) { x = { h: r.other, cat: cdaHdrCat(r.other), n: 0, in: 0, out: 0, first: r.ts, last: r.ts, days: new Set() }; hdr.set(r.other, x); }
        x.n++; if (r.dir === 'OUT') x.out++; else x.in++; x.first = Math.min(x.first, r.ts); x.last = Math.max(x.last, r.ts); x.days.add(dayKey(r.ts));
        if (x.cat === 'Bank / Payment') bank.push({ r, cat: x.cat });
      } else {
        let x = p2p.get(r.other); if (!x) { x = { num: r.other, n: 0, in: 0, out: 0, first: r.ts, last: r.ts, days: new Set() }; p2p.set(r.other, x); }
        x.n++; if (r.dir === 'OUT') x.out++; else x.in++; x.first = Math.min(x.first, r.ts); x.last = Math.max(x.last, r.ts); x.days.add(dayKey(r.ts));
      }
    }
    const byHour = groupBy(X.sms, r => dayKey(r.ts) + ' ' + String(cdaHr(r.ts)).padStart(2, '0') + ':00');
    const busy = Array.from(byHour.entries()).map(([k, l]) => ({ when: k, n: l.length, out: l.filter(r => r.dir === 'OUT').length, uniq: uniq(l.map(r => r.other)).length })).sort((a, b) => b.n - a.n).slice(0, 15);
    const recs = S.cur.telecom.sms.filter(s => CDA.num === '*' || s.msisdn === CDA.num).sort((a, b) => a.ts - b.ts);
    return { hdr: Array.from(hdr.values()).sort((a, b) => b.n - a.n), p2p: Array.from(p2p.values()).sort((a, b) => b.n - a.n), bank: bank.sort((a, b) => a.r.ts - b.r.ts), busy, recs };
  });
}
function cdaBars(items, h = 90) {
  const mx = Math.max(1, ...items.map(i => sum(i.parts, p => p.v)));
  return `<div class="cda-bars" style="height:${h + 24}px">${items.map(i => { const t = sum(i.parts, p => p.v); return `<div class="cda-b" title="${esc(i.label + ': ' + i.parts.map(p => p.name + ' ' + p.v).join(', '))}"><div class="cda-s" style="height:${h}px"><div class="cda-st" style="height:${Math.round(t / mx * h)}px">${i.parts.map(p => `<i style="flex:${p.v};background:${p.c}"></i>`).join('')}</div></div><span>${esc(i.short)}</span></div>`; }).join('')}</div>`;
}
const CDA_C = { out: '#00e5ff', in: '#00ff9d', sms: '#ffb300', data: '#b388ff', unk: '#8fb3c9' };

/* ---------- tab renderers ---------- */
function cdaSummary(X) {
  const { rows, calls, sms, data } = X; const cOut = calls.filter(r => r.dir === 'OUT'), cIn = calls.filter(r => r.dir === 'IN'), cUnk = calls.filter(r => r.dir !== 'OUT' && r.dir !== 'IN');
  const sOut = sms.filter(r => r.dir === 'OUT'), sIn = sms.filter(r => r.dir === 'IN'), sUnk = sms.filter(r => r.dir !== 'OUT' && r.dir !== 'IN');
  const first = rows[0].ts, last = rows[rows.length - 1].ts; const days = cdaDays(X); const span = Math.max(1, Math.round((last - first) / 86400000) + 1);
  const conn = calls.filter(r => r.dur > 0); const peak = days.slice().sort((a, b) => b.n - a.n)[0];
  const mrow = (label, a, isCall) => { const cn = a.filter(r => r.dur > 0); return { label, n: a.length, cn: isCall ? cn.length : null, nc: isCall ? a.length - cn.length : null, dur: isCall ? sum(a, r => r.dur) : null, avg: isCall && cn.length ? sum(cn, r => r.dur) / cn.length : null, max: isCall && cn.length ? cn.reduce((m, r) => r.dur > m ? r.dur : m, 0) : null }; };
  const M = [mrow('Outgoing calls', cOut, 1), mrow('Incoming calls', cIn, 1), cUnk.length ? mrow('Calls (direction not in file)', cUnk, 1) : null, mrow('All calls', calls, 1), mrow('Outgoing SMS', sOut), mrow('Incoming SMS', sIn), sUnk.length ? mrow('SMS (direction not in file)', sUnk) : null, mrow('Data / GPRS sessions', data)].filter(Boolean);
  const bk = [['0 sec (not connected / missed)', r => r.dur === 0], ['1 – 30 sec', r => r.dur >= 1 && r.dur <= 30], ['31 – 60 sec', r => r.dur > 30 && r.dur <= 60], ['1 – 5 min', r => r.dur > 60 && r.dur <= 300], ['5 – 15 min', r => r.dur > 300 && r.dur <= 900], ['15 – 30 min', r => r.dur > 900 && r.dur <= 1800], ['Over 30 min', r => r.dur > 1800]].map(([l, f]) => ({ l, a: calls.filter(f) }));
  const HB = Array.from({ length: 24 }, () => [0, 0, 0, 0]), WB = Array.from({ length: 7 }, () => [0, 0, 0]);
  for (const r of rows) { const h = cdaHr(r.ts), w = new Date(r.ts).getUTCDay(); if (r.kind === 'SMS') { HB[h][2]++; WB[w][1]++; } else if (r.kind === 'DATA') { HB[h][3]++; WB[w][2]++; } else { HB[h][r.dir === 'OUT' ? 0 : 1]++; WB[w][0]++; } }
  const hrs = HB.map((v, h) => ({ label: String(h).padStart(2, '0') + ':00', short: String(h).padStart(2, '0'), parts: [{ name: 'Calls out', v: v[0], c: CDA_C.out }, { name: 'Calls in', v: v[1], c: CDA_C.in }, { name: 'SMS', v: v[2], c: CDA_C.sms }, { name: 'Data', v: v[3], c: CDA_C.data }] }));
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((n, i) => ({ label: n, short: n, parts: [{ name: 'Calls', v: WB[i][0], c: CDA_C.out }, { name: 'SMS', v: WB[i][1], c: CDA_C.sms }, { name: 'Data', v: WB[i][2], c: CDA_C.data }] }));
  const gaps = []; for (let i = 1; i < rows.length; i++) { const g = (rows[i].ts - rows[i - 1].ts) / 3600000; if (g >= 6) gaps.push({ from: rows[i - 1].ts, to: rows[i].ts, hrs: g, before: cdaCell(rows[i - 1]), after: cdaCell(rows[i]) }); } gaps.sort((a, b) => b.hrs - a.hrs);
  const longest = calls.filter(r => r.dur > 0).sort((a, b) => b.dur - a.dur).slice(0, 10);
  const nightEv = rows.filter(r => cdaNight(cdaHr(r.ts))).length;
  return `<div class="grid g6" style="margin-bottom:12px">${kpi('Total events', nfmt(rows.length), cdaT(first).slice(0, 10) + ' → ' + cdaT(last).slice(0, 10))}${kpi('Calls', nfmt(calls.length), `${cOut.length} out / ${cIn.length} in`, 'rgba(0,229,255,.3)')}${kpi('Connected calls', nfmt(conn.length), cdaPct(conn.length, calls.length) + '% of calls', 'rgba(0,255,157,.3)')}${kpi('Talk time', cdaDur(sum(calls, r => r.dur)), conn.length ? 'avg ' + cdaDur(sum(conn, r => r.dur) / conn.length) : '', 'rgba(41,121,255,.3)')}${kpi('SMS', nfmt(sms.length), `${sOut.length} out / ${sIn.length} in`, 'rgba(255,179,0,.3)')}${kpi('Unique contacts', nfmt(cdaContacts(X).length), `${days.length} active days of ${span}`, 'rgba(179,136,255,.3)')}</div>
  <div class="cda-one"><div class="card"><h4>Call summary</h4>${simpleTable([{ label: 'Type', get: x => x.label }, { label: 'Events', get: x => nfmt(x.n), num: 1 }, { label: 'Connected', get: x => x.cn == null ? '—' : nfmt(x.cn), num: 1 }, { label: '0 sec', get: x => x.nc == null ? '—' : nfmt(x.nc), num: 1 }, { label: 'Total duration', get: x => x.dur == null ? '—' : cdaDur(x.dur), num: 1 }, { label: 'Avg (connected)', get: x => x.avg == null ? '—' : cdaDur(x.avg), num: 1 }, { label: 'Longest', get: x => x.max == null ? '—' : cdaDur(x.max), num: 1 }], M, { maxH: 360 })}
      <p class="small dim" style="margin:8px 0 0">A 0-second incoming call is a probable missed call; a 0-second outgoing call is not connected / unanswered. Operators differ, so verify against the raw CDR.</p></div>
    <div class="card"><h4>Call duration profile</h4>${simpleTable([{ label: 'Duration', get: x => x.l }, { label: 'Calls', get: x => nfmt(x.a.length), num: 1 }, { label: '%', get: x => cdaPct(x.a.length, calls.length) + '%', num: 1 }, { label: 'Out / In', get: x => x.a.filter(r => r.dir === 'OUT').length + ' / ' + x.a.filter(r => r.dir === 'IN').length, num: 1 }], bk, { maxH: 300 })}
      <div class="kv" style="margin-top:10px"><div>Night activity (${CDA.nStart}:00–${String(CDA.nEnd).padStart(2, '0')}:00)</div><div>${nfmt(nightEv)} events (${cdaPct(nightEv, rows.length)}%)</div><div>Busiest day</div><div>${peak ? esc(peak.day) + ' — ' + peak.n + ' events' : '—'}</div><div>Avg events / active day</div><div>${days.length ? Math.round(rows.length / days.length * 10) / 10 : 0}</div></div></div></div>
  <div class="grid g2" style="margin-top:12px"><div class="card"><h4>Activity by hour of day</h4>${cdaBars(hrs)}<div class="small dim"><span style="color:${CDA_C.out}">■</span> calls out <span style="color:${CDA_C.in}">■</span> calls in <span style="color:${CDA_C.sms}">■</span> SMS <span style="color:${CDA_C.data}">■</span> data</div></div>
    <div class="card"><h4>Activity by day of week</h4>${cdaBars(wd)}</div></div>
  <div class="cda-one" style="margin-top:12px"><div class="card"><h4>Longest calls</h4>${simpleTable([{ label: 'When', get: x => cdaT(x.ts) }, { label: 'Other party', html: x => `<a href="#" data-num="${esc(x.other)}" class="mono">${esc(x.other)}</a>` }, { label: 'Dir', get: x => x.dir }, { label: 'Duration', get: x => cdaDur(x.dur), num: 1 }, { label: 'Cell', get: x => cdaCell(x) }], longest, { maxH: 320, empty: 'No connected calls.' })}</div>
    <div class="card"><h4>Longest silent periods <span class="dim small">(no CDR activity ≥ 6 h — phone off, no coverage, or CDR gap)</span></h4>${simpleTable([{ label: 'From', get: x => cdaT(x.from) }, { label: 'To', get: x => cdaT(x.to) }, { label: 'Hours', get: x => Math.round(x.hrs * 10) / 10, num: 1 }, { label: 'Cell before', get: x => x.before }, { label: 'Cell after', get: x => x.after }], gaps.slice(0, 10), { maxH: 320, empty: 'No silent period of 6 hours or more.' })}</div></div>`;
}
function cdaContactsHtml(X) {
  const L = cdaContacts(X); const top = (f, n = 5) => L.slice().sort(f).slice(0, n);
  const mini = (t, l, v) => `<div class="card"><h4>${t}</h4>${simpleTable([{ label: 'Number', html: x => `<a href="#" data-num="${esc(x.num)}" class="mono">${esc(x.num)}</a>` }, { label: '', get: v, num: 1 }], l, { maxH: 200, empty: 'None.' })}</div>`;
  return `<div class="grid g3" style="margin-bottom:12px">${mini('Most called (outgoing)', top((a, b) => b.cOut - a.cOut).filter(x => x.cOut), x => x.cOut + ' calls')}${mini('Most received (incoming)', top((a, b) => b.cIn - a.cIn).filter(x => x.cIn), x => x.cIn + ' calls')}${mini('Longest total talk time', top((a, b) => b.dur - a.dur).filter(x => x.dur), x => cdaDur(x.dur))}</div>
  <div class="row" style="margin-bottom:8px"><input id="cdaCq" placeholder="Filter by number…" class="mono" style="width:220px"><span class="small dim" id="cdaCn">${nfmt(L.length)} numbers</span><span class="grow"></span><button class="btn-sm" id="cdaCx">Export contacts</button></div><div id="cdaCT"></div>
  <p class="small dim">Service headers (alphanumeric SMS senders) are listed in the SMS Analysis tab.</p>`;
}
function cdaContactCols(X) {
  const multi = CDA.num === '*';
  return [{ label: 'Number', w: 130, html: x => `<a href="#" data-num="${esc(x.num)}" class="mono">${esc(x.num)}</a>`, get: x => x.num }, { label: 'Linked to', w: 190, get: x => cdaLink(x.num) || '' }, ...(multi ? [{ label: 'Seen in targets', w: 70, num: 1, get: x => x.targets.size }] : []),
    { label: 'Calls out', w: 80, num: 1, get: x => x.cOut }, { label: 'Calls in', w: 80, num: 1, get: x => x.cIn }, { label: 'SMS out', w: 80, num: 1, get: x => x.sOut }, { label: 'SMS in', w: 80, num: 1, get: x => x.sIn }, { label: 'Events', w: 80, num: 1, get: x => x.n }, { label: 'Talk time', w: 110, num: 1, get: x => cdaDur(x.dur), sort: x => x.dur, x: x => x.dur },
    { label: 'Night events', w: 90, num: 1, get: x => x.night }, { label: 'Active days', w: 90, num: 1, get: x => x.days.size }, { label: 'First', w: 150, get: x => cdaT(x.first), sort: x => x.first }, { label: 'Last', w: 150, get: x => cdaT(x.last), sort: x => x.last }];
}
function cdaCellTable(l, empty) {
  return simpleTable([{ label: 'Cell ID', html: x => `<b class="mono">${esc(x.cell)}</b>${x.lac ? `<div class="small dim">LAC ${esc(x.lac)}</div>` : ''}` }, { label: 'Site address', html: x => esc(x.addr || '—') + (x.src === 'DB' ? ' <span class="badge b-blue" title="Located from the Cell ID database">DB</span>' : x.src === 'DB~' ? ' <span class="badge b-amber" title="Located from the Cell ID database by cell ID only (LAC not matched) — approximate, verify">DB approx</span>' : '') }, { label: 'Events', get: x => nfmt(x.n), num: 1 }, { label: '%', get: x => x.pct + '%', num: 1 }, { label: 'Days seen', get: x => x.d, num: 1 }, { label: 'First', get: x => cdaT(x.first) }, { label: 'Last', get: x => cdaT(x.last) }, { label: 'Map', html: x => x.lat != null || x.addr ? `<a class="btn-sm" target="_blank" rel="noopener noreferrer" href="${esc(gmapsUrl(x.addr || ('cell ' + x.cell), x.lat, x.lon))}">Map</a>` : '' }], l.slice(0, 40), { maxH: 380, empty });
}
function cdaLocation(X) {
  const day = cdaCellStats(X.rows, r => !cdaNight(cdaHr(r.ts))), night = cdaCellStats(X.rows, r => cdaNight(cdaHr(r.ts))), NS = cdaNights(X);
  const nm = cdaCellStats(X.rows).length; const dom = NS.dominant[0]; const nTot = NS.nights.length;
  const dayD = cdaCellStats(X.rows.filter(r => !cdaNight(cdaHr(r.ts)))); const roam = Array.from(countBy(X.rows.filter(r => r.roam && r.roam.trim()), r => r.roam.trim()).entries()).sort((a, b) => b[1] - a[1]);
  const find = k => night.find(x => x.cell === k) || day.find(x => x.cell === k); const psOf = l => { try { return l ? psHtml(l) : '<span class="dim">—</span>'; } catch { return '<span class="dim">—</span>'; } };
  const nl = dom ? find(dom.cell) : null, dl = day[0];
  const sel = (id, v) => `<select id="${id}">${Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${h === v ? 'selected' : ''}>${String(h).padStart(2, '0')}:00</option>`).join('')}</select>`;
  return `<div class="notice" style="margin-bottom:12px">CDR / cell-site correlation: a cell covers an area, so day and night cells show where the phone was <b>served</b>, not an exact position. Treat the night-stay cell as a lead to verify.</div>
  <div class="row small" style="margin-bottom:12px">Night window ${sel('cdaNs', CDA.nStart)} to ${sel('cdaNe', CDA.nEnd)} <span class="dim">(everything else is day) · ${nfmt(nm)} distinct cells in total</span></div>
  <div class="grid g2" style="margin-bottom:12px"><div class="card" style="border-color:rgba(255,179,0,.5)"><h4>🌙 Probable night-stay cell</h4>${dom ? `<div style="font-size:20px" class="mono">${esc(dom.cell)}</div><div>${esc((nl && nl.addr) || dom.addr || 'Address not in CDR')}</div><div class="small dim">Main cell on <b>${dom.nights}</b> of ${nTot} nights (${cdaPct(dom.nights, nTot)}%)${NS.dominant[1] ? ` · next: ${esc(NS.dominant[1].cell)} (${NS.dominant[1].nights} nights)` : ''}</div><div style="margin-top:6px">${psOf(nl)}</div>` : '<span class="dim">No night-time events with a cell ID.</span>'}</div>
    <div class="card" style="border-color:rgba(0,229,255,.5)"><h4>☀ Main day cell</h4>${dl ? `<div style="font-size:20px" class="mono">${esc(dl.cell)}</div><div>${esc(dl.addr || 'Address not in CDR')}</div><div class="small dim">${nfmt(dl.n)} day events (${dl.pct}% of day activity) on ${dl.d} days</div><div style="margin-top:6px">${psOf(dl)}</div>` : '<span class="dim">No day-time events with a cell ID.</span>'}</div></div>
  <div class="cda-one"><div class="card"><h4>Day cells <span class="dim small">(${String(CDA.nEnd).padStart(2, '0')}:00–${String(CDA.nStart).padStart(2, '0')}:00)</span></h4>${cdaCellTable(day, 'No day-time cell data.')}</div>
    <div class="card"><h4>Night cells <span class="dim small">(${String(CDA.nStart).padStart(2, '0')}:00–${String(CDA.nEnd).padStart(2, '0')}:00)</span></h4>${cdaCellTable(night, 'No night-time cell data.')}</div></div>
  <div class="card" style="margin-top:12px"><h4>Night-by-night stay <span class="dim small">(night of the date shown — main cell of each night)</span></h4>${simpleTable([{ label: 'Night of', get: x => x.night }, { label: 'Events', get: x => x.n, num: 1 }, { label: 'Main cell', html: x => `<b class="mono">${esc(x.main.cell)}</b>` }, { label: '% of night', get: x => x.pct + '%', num: 1 }, { label: 'Site address', get: x => x.main.addr || '—' }, { label: 'Other cells', get: x => x.others.length ? x.others.slice(0, 3).map(c => c.cell).join(', ') + (x.others.length > 3 ? ' +' + (x.others.length - 3) : '') : '—' }, { label: 'First', get: x => cdaT(x.first) }, { label: 'Last', get: x => cdaT(x.last) }], NS.nights, { maxH: 420, empty: 'No night-time events with a cell ID.' })}</div>
  ${roam.length ? `<div class="card" style="margin-top:12px"><h4>Roaming / circle values in the CDR</h4>${simpleTable([{ label: 'Roaming value', get: x => x[0] }, { label: 'Events', get: x => nfmt(x[1]), num: 1 }], roam, { maxH: 240 })}</div>` : ''}`;
}
function cdaCellRes(X, enr) {
  const rows = X.rows.filter(r => cdaCell(r)); const cells = new Set(rows.map(cdaCell)); const withGeo = new Set(rows.filter(r => r.lat != null || r.addr).map(cdaCell));
  const db = new Set(rows.filter(r => r.cellSrc === 'DB').map(cdaCell)), ap = new Set(rows.filter(r => r.cellSrc === 'DB~').map(cdaCell)); const miss = Array.from(cells).filter(k => !withGeo.has(k));
  const m = CELLDB.meta || { total: 0 };
  return `<div class="card" style="margin-bottom:12px"><h4>Cell resolution <span class="dim small">· Cell ID Database: ${nfmt(m.total || 0)} cells</span></h4><div class="row small">${badge(nfmt(cells.size) + ' distinct cells', 'gray')} ${badge(nfmt(cells.size - db.size - ap.size - miss.length) + ' located from the CDR itself', 'green')} ${badge(nfmt(db.size) + ' located from database', 'blue')} ${ap.size ? badge(nfmt(ap.size) + ' database, approximate', 'amber') : ''} ${badge(nfmt(miss.length) + ' not located', miss.length ? 'red' : 'gray')} <a data-v="celldb" style="cursor:pointer;color:var(--cy,#00e5ff)">Open Cell ID Database →</a></div>${!m.total ? '<div class="small dim" style="margin-top:6px">No tower list imported yet. Import the Kerala / Jio lists once at <b>Cell ID Database</b> and every CDR is located automatically.</div>' : ''}${miss.length ? `<div class="small dim" style="margin-top:6px">Not in database (first 12): <span class="mono">${esc(miss.slice(0, 12).join(', '))}</span></div>` : ''}</div>`;
}
function cdaDaysHtml(X) {
  const L = cdaDays(X);
  return `<div class="row" style="margin-bottom:8px"><span class="small dim">One row per day with first / last cell, so movement between the first and last event of the day is visible.</span><span class="grow"></span><button class="btn-sm" id="cdaDx">Export</button></div>` + simpleTable([{ label: 'Date', get: x => x.day }, { label: 'Events', get: x => x.n, num: 1 }, { label: 'Calls out', get: x => x.cOut, num: 1 }, { label: 'Calls in', get: x => x.cIn, num: 1 }, { label: 'SMS out', get: x => x.sOut, num: 1 }, { label: 'SMS in', get: x => x.sIn, num: 1 }, { label: 'Data', get: x => x.data, num: 1 }, { label: 'Talk time', get: x => cdaDur(x.dur), num: 1 }, { label: 'Night events', get: x => x.night, num: 1 }, { label: 'Cells', get: x => x.cells, num: 1 }, { label: 'First event', get: x => fmtTime(x.first) + (x.fCell ? ' · ' + x.fCell : '') }, { label: 'Last event', get: x => fmtTime(x.last) + (x.zCell ? ' · ' + x.zCell : '') }, { label: 'Main cell of the day', get: x => x.top ? x.top.cell + (x.top.addr ? ' — ' + x.top.addr : '') : '—' }], L, { maxH: 640, empty: 'No events.' });
}
function cdaImeiHtml(X) {
  const I = cdaImei(X); const multiIm = I.imeis.length > 1, multiSim = I.imsis.length > 1;
  const flag = (t, c) => badge(t, c);
  return `<div class="grid g4" style="margin-bottom:12px">${kpi('IMEIs (handsets)', I.imeis.length, multiIm ? 'more than one handset used' : '', multiIm ? 'rgba(255,179,0,.35)' : 'rgba(0,229,255,.3)')}${kpi('IMSIs (SIMs)', I.imsis.length, multiSim ? 'more than one SIM seen' : '', multiSim ? 'rgba(255,179,0,.35)' : 'rgba(0,229,255,.3)')}${kpi('Handset / SIM changes', I.chg.length, 'in time order below', I.chg.length ? 'rgba(255,77,94,.3)' : 'rgba(0,229,255,.3)')}${kpi('Events without IMEI', nfmt(I.noImei), I.noImei ? 'IMEI blank / short in the file' : '', 'rgba(143,179,201,.3)')}</div>
  <div class="row" style="margin-bottom:8px"><button class="btn-sm" id="cdaTac">⇪ Load TAC list (CSV / XLSX: TAC, Brand, Model)</button><span class="small dim">${CDA.tac ? esc(CDA.tacName) + ' loaded — ' + nfmt(CDA.tac.size) + ' TACs (this session only)' : 'Handset make / model needs a TAC list. The first 8 digits of the IMEI are the TAC.'}</span><span class="grow"></span><button class="btn-sm" id="cdaIx">Export</button></div>
  <div class="card"><h4>IMEI-wise usage <span class="dim small">(click a row for detail)</span></h4>${simpleTable([{ label: 'IMEI', html: x => `<b class="mono">${esc(x.i15)}</b>` }, { label: 'TAC', get: x => x.tac }, { label: 'Handset', get: x => x.model || '—' }, { label: 'Check digit', html: x => x.check === 'Valid' ? badge('Valid', 'green') : badge(x.check.split(' (')[0], 'amber') }, { label: 'Events', get: x => nfmt(x.n), num: 1 }, { label: 'Calls', get: x => x.calls, num: 1 }, { label: 'SMS', get: x => x.sms, num: 1 }, { label: 'Data', get: x => x.data, num: 1 }, { label: 'SIMs (IMSI)', get: x => x.imsis.size, num: 1 }, { label: 'Cells', get: x => x.cells.size, num: 1 }, { label: 'Active days', get: x => x.days.size, num: 1 }, { label: 'First', get: x => cdaT(x.first) }, { label: 'Last', get: x => cdaT(x.last) }], I.imeis, { click: true, maxH: 360, empty: 'No IMEI in this CDR.' })}</div>
  <div class="cda-one" style="margin-top:12px"><div class="card"><h4>SIM-wise usage (IMSI)</h4>${simpleTable([{ label: 'IMSI', html: x => `<span class="mono">${esc(x.imsi)}</span>` }, { label: 'Operator', get: x => x.op || '—' }, { label: 'Events', get: x => nfmt(x.n), num: 1 }, { label: 'Handsets', get: x => x.imeis.size, num: 1 }, { label: 'First', get: x => cdaT(x.first) }, { label: 'Last', get: x => cdaT(x.last) }], I.imsis, { maxH: 320, empty: 'No IMSI in this CDR.' })}</div>
    <div class="card"><h4>Handset / SIM change log</h4>${simpleTable([{ label: 'When', get: x => cdaT(x.ts) }, ...(CDA.num === '*' ? [{ label: 'Target', get: x => x.target }] : []), { label: 'Change', html: x => badge(x.what, x.what.startsWith('IMEI') ? 'amber' : 'violet') }, { label: 'From', html: x => `<span class="mono">${esc(x.from)}</span>` }, { label: 'To', html: x => `<span class="mono">${esc(x.to)}</span>` }, { label: 'Cell', get: x => x.cell }], I.chg, { maxH: 320, empty: 'No IMEI or SIM change inside this CDR.' })}
      <p class="small dim" style="margin:8px 0 0">A new handset or SIM just before a fraud window is a lead worth a CAF / handset-purchase requisition.</p></div></div>`;
}
function cdaSmsHtml(X) {
  const D_ = cdaSmsData(X); const sms = X.sms; const sIn = sms.filter(r => r.dir !== 'OUT').length, sOut = sms.length - sIn; const hdrN = sum(D_.hdr, x => x.n), p2pN = sum(D_.p2p, x => x.n);
  const SB = Array.from({ length: 24 }, () => [0, 0]); for (const r of sms) SB[cdaHr(r.ts)][r.dir === 'OUT' ? 1 : 0]++; const hrs = SB.map((v, h) => ({ label: String(h).padStart(2, '0') + ':00', short: String(h).padStart(2, '0'), parts: [{ name: 'Incoming', v: v[0], c: CDA_C.in }, { name: 'Outgoing', v: v[1], c: CDA_C.out }] }));
  const cats = Array.from(groupBy(D_.hdr, x => x.cat).entries()).map(([k, l]) => ({ cat: k, hdrs: l.length, n: sum(l, x => x.n) })).sort((a, b) => b.n - a.n);
  const numA = n => `<a href="#" data-num="${esc(n)}" class="mono">${esc(n)}</a>`;
  if (!sms.length && !D_.recs.length) return emptyState('This CDR has no SMS events.');
  return `<div class="grid g6" style="margin-bottom:12px">${kpi('SMS events', nfmt(sms.length))}${kpi('Incoming', nfmt(sIn), '', 'rgba(0,255,157,.3)')}${kpi('Outgoing', nfmt(sOut), '', 'rgba(0,229,255,.3)')}${kpi('Service / header SMS', nfmt(hdrN), D_.hdr.length + ' senders', 'rgba(255,179,0,.3)')}${kpi('Person-to-person SMS', nfmt(p2pN), D_.p2p.length + ' numbers', 'rgba(179,136,255,.3)')}${kpi('Bank / payment SMS', nfmt(D_.bank.length), 'possible transaction alerts', 'rgba(255,77,94,.3)')}</div>
  <div class="notice" style="margin-bottom:12px">A CDR carries SMS <b>metadata</b> only (time, sender / receiver, cell) — not the message text. Message text is shown only where an SMS file was imported separately.</div>
  <div class="grid g2"><div class="card"><h4>SMS by category of sender</h4>${simpleTable([{ label: 'Category', get: x => x.cat }, { label: 'Senders', get: x => x.hdrs, num: 1 }, { label: 'SMS', get: x => nfmt(x.n), num: 1 }], cats, { maxH: 240, empty: 'No alphanumeric sender headers.' })}</div>
    <div class="card"><h4>SMS by hour of day</h4>${cdaBars(hrs)}<div class="small dim"><span style="color:${CDA_C.in}">■</span> incoming <span style="color:${CDA_C.out}">■</span> outgoing</div></div></div>
  <div class="cda-one" style="margin-top:12px"><div class="card"><h4>Service / header senders</h4>${simpleTable([{ label: 'Header', html: x => `<b class="mono">${esc(x.h)}</b>` }, { label: 'Category', get: x => x.cat }, { label: 'SMS', get: x => x.n, num: 1 }, { label: 'Active days', get: x => x.days.size, num: 1 }, { label: 'First', get: x => cdaT(x.first) }, { label: 'Last', get: x => cdaT(x.last) }], D_.hdr, { maxH: 380, empty: 'None.' })}</div>
    <div class="card"><h4>Person-to-person SMS</h4>${simpleTable([{ label: 'Number', html: x => numA(x.num) }, { label: 'Linked to', get: x => cdaLink(x.num) }, { label: 'Out', get: x => x.out, num: 1 }, { label: 'In', get: x => x.in, num: 1 }, { label: 'First', get: x => cdaT(x.first) }, { label: 'Last', get: x => cdaT(x.last) }], D_.p2p.slice(0, 200), { maxH: 380, empty: 'None.' })}</div></div>
  <div class="cda-one" style="margin-top:12px"><div class="card"><h4>Busiest SMS hours <span class="dim small">(bursts — bulk or OTP-type activity)</span></h4>${simpleTable([{ label: 'Hour', get: x => x.when }, { label: 'SMS', get: x => x.n, num: 1 }, { label: 'Outgoing', get: x => x.out, num: 1 }, { label: 'Distinct numbers', get: x => x.uniq, num: 1 }], D_.busy, { maxH: 320 })}</div>
    <div class="card"><h4>Bank / payment alerts timeline <span class="dim small">(use to fix transaction times)</span></h4>${simpleTable([{ label: 'When', get: x => cdaT(x.r.ts) }, { label: 'Header', html: x => `<b class="mono">${esc(x.r.other)}</b>` }, { label: 'Dir', get: x => x.r.dir }, { label: 'Cell', get: x => cdaCell(x.r) }, { label: 'Site address', get: x => x.r.addr || '—' }], D_.bank.slice(0, 500), { maxH: 320, empty: 'No bank / payment sender found.' })}</div></div>
  ${D_.recs.length ? `<div class="card" style="margin-top:12px"><h4>SMS text records (imported SMS file) — ${nfmt(D_.recs.length)}</h4>${simpleTable([{ label: 'When', get: x => cdaT(x.ts) }, { label: 'Number', get: x => x.msisdn }, { label: 'Sender', get: x => x.sender }, { label: 'OTP', html: x => x.otp ? badge('OTP', 'amber') : '' }, { label: 'Amount', get: x => x.amount == null ? '' : inr(x.amount), num: 1 }, { label: 'Message', get: x => x.msg }], D_.recs.slice(0, 500), { maxH: 380 })}</div>` : ''}`;
}
function cdaLogRows(X) {
  const q = CDA.q.trim().toLowerCase();
  return X.rows.filter(r => (!CDA.fKind || r.kind === CDA.fKind) && (!CDA.fDir || r.dir === CDA.fDir) && (!q || (r.other || '').toLowerCase().includes(q) || cdaCell(r).toLowerCase().includes(q) || (r.imei || '').includes(q) || (r.imsi || '').includes(q) || (r.addr || '').toLowerCase().includes(q)));
}
function cdaLogCols() {
  return [{ label: 'Time', w: 150, get: r => cdaT(r.ts), sort: r => r.ts, x: r => cdaT(r.ts) }, ...(CDA.num === '*' ? [{ label: 'Target', w: 110, get: r => r.target }] : []), { label: 'Service', w: 70, get: r => r.kind }, { label: 'Dir', w: 55, get: r => r.dir }, { label: 'Other party', w: 130, html: r => `<a href="#" data-num="${esc(r.other)}" class="mono">${esc(r.other)}</a>`, get: r => r.other }, { label: 'Duration (s)', w: 90, num: 1, get: r => r.dur }, { label: 'Cell', w: 130, get: r => cdaCell(r) }, { label: 'Site address', w: 260, get: r => r.addr || '' }, { label: 'LAC', w: 70, get: r => r.lac }, { label: 'IMEI', w: 140, get: r => r.imei }, { label: 'IMSI', w: 150, get: r => r.imsi }, { label: 'Roaming', w: 90, get: r => r.roam }];
}

/* ---------- Excel export (every tab, one workbook) ---------- */
function cdaExport(X) {
  const hr = r => r.map(v => safeCell(v == null ? '' : v));
  const ctc = cdaContactCols(X).filter(c => c.label !== 'Linked to' || true);
  const sheets = [];
  const rows = X.rows; const calls = X.calls; const conn = calls.filter(r => r.dur > 0);
  sheets.push(['Summary', [['Item', 'Value'], ['Target', CDA.num === '*' ? 'All uploaded CDRs (combined)' : CDA.num], ['Events', rows.length], ['Period', cdaT(rows[0].ts) + ' → ' + cdaT(rows[rows.length - 1].ts)], ['Calls', calls.length], ['Calls out', calls.filter(r => r.dir === 'OUT').length], ['Calls in', calls.filter(r => r.dir === 'IN').length], ['Connected calls', conn.length], ['0-second calls', calls.length - conn.length], ['Talk time (s)', sum(calls, r => r.dur)], ['SMS', X.sms.length], ['SMS out', X.sms.filter(r => r.dir === 'OUT').length], ['SMS in', X.sms.filter(r => r.dir === 'IN').length], ['Data sessions', X.data.length], ['Unique contacts', cdaContacts(X).length], ['Active days', cdaDays(X).length], ['Note', 'CDR / cell-site correlation only — not an exact location, not proof.']]]);
  sheets.push(['Contacts', [ctc.map(c => c.label), ...cdaContacts(X).map(x => ctc.map(c => c.x ? c.x(x) : c.get(x)))]]);
  const cellCols = ['Cell ID', 'LAC', 'Site address', 'Events', '% of events', 'Days seen', 'First', 'Last', 'Latitude', 'Longitude']; const cellRow = x => [x.cell, x.lac, x.addr, x.n, x.pct, x.d, cdaT(x.first), cdaT(x.last), x.lat, x.lon];
  sheets.push(['Day cells', [cellCols, ...cdaCellStats(rows, r => !cdaNight(cdaHr(r.ts))).map(cellRow)]]);
  sheets.push(['Night cells', [cellCols, ...cdaCellStats(rows, r => cdaNight(cdaHr(r.ts))).map(cellRow)]]);
  sheets.push(['Night by night', [['Night of', 'Events', 'Main cell', '% of night', 'Site address', 'Other cells', 'First', 'Last'], ...cdaNights(X).nights.map(x => [x.night, x.n, x.main.cell, x.pct, x.main.addr, x.others.map(c => c.cell).join(', '), cdaT(x.first), cdaT(x.last)])]]);
  sheets.push(['Date-wise', [['Date', 'Events', 'Calls out', 'Calls in', 'SMS out', 'SMS in', 'Data', 'Talk time (s)', 'Night events', 'Cells', 'First event', 'First cell', 'Last event', 'Last cell', 'Main cell'], ...cdaDays(X).map(x => [x.day, x.n, x.cOut, x.cIn, x.sOut, x.sIn, x.data, x.dur, x.night, x.cells, fmtTime(x.first), x.fCell, fmtTime(x.last), x.zCell, x.top ? x.top.cell : ''])]]);
  const I = cdaImei(X);
  sheets.push(['IMEI', [['IMEI', 'TAC', 'Handset', 'Check digit', 'Events', 'Calls', 'SMS', 'Data', 'SIMs', 'Cells', 'Active days', 'First', 'Last'], ...I.imeis.map(x => [x.i15, x.tac, x.model, x.check, x.n, x.calls, x.sms, x.data, Array.from(x.imsis.keys()).join(', '), x.cells.size, x.days.size, cdaT(x.first), cdaT(x.last)])]]);
  sheets.push(['IMSI', [['IMSI', 'Operator', 'Events', 'IMEIs', 'First', 'Last'], ...I.imsis.map(x => [x.imsi, x.op, x.n, Array.from(x.imeis).join(', '), cdaT(x.first), cdaT(x.last)])]]);
  sheets.push(['Handset-SIM changes', [['When', 'Target', 'Change', 'From', 'To', 'Cell'], ...I.chg.map(x => [cdaT(x.ts), x.target, x.what, x.from, x.to, x.cell])]]);
  const Sd = cdaSmsData(X);
  sheets.push(['SMS headers', [['Header', 'Category', 'SMS', 'Active days', 'First', 'Last'], ...Sd.hdr.map(x => [x.h, x.cat, x.n, x.days.size, cdaT(x.first), cdaT(x.last)])]]);
  sheets.push(['SMS person-to-person', [['Number', 'Linked to', 'Out', 'In', 'First', 'Last'], ...Sd.p2p.map(x => [x.num, cdaLink(x.num), x.out, x.in, cdaT(x.first), cdaT(x.last)])]]);
  const lc = cdaLogCols(); sheets.push(['Event log', [lc.map(c => c.label), ...rows.slice(0, 200000).map(r => lc.map(c => c.x ? c.x(r) : c.get(r)))]]);
  const wb = XLSX.utils.book_new();
  for (const [n, data] of sheets) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data.map((r, i) => i === 0 ? r : hr(r))), n.slice(0, 31));
  XLSX.writeFile(wb, `${CONFIG.FILE_PREFIX}_${fileSafe(S.cur.meta.id)}_CDR_${fileSafe(CDA.num === '*' ? 'ALL' : CDA.num)}.xlsx`); audit('Exported CDR analysis', CDA.num);
}

/* ---------- view ---------- */
VIEWS.cdrsum = async el => {
  const c = S.cur; const tel = T();
  if (!c.telecom.cdr.length) { el.innerHTML = pageHead('CDR Analysis', 'Call summary, day / night location, IMEI-wise and SMS analysis of every uploaded CDR.') + emptyState('Upload a CDR first.', `<button class="btn-p" id="toCdr">⇪ Upload CDR</button>`); $('#toCdr', el).onclick = () => go('up_cdr'); return; }
  if (CDA.num !== '*' && !tel.byTarget.has(CDA.num)) CDA.num = tel.targets[0].num;
  if (CDA.tab === 'loc') { try { await GEO.ready(); } catch { } }
  let enr = null; try { await CELLDB.loadSdr(); enr = await CELLDB.autoEnrich(); } catch (e) { console.warn(e); } if (S.view !== 'cdrsum') return;
  const X = cdaCtx();
  const meta = c.telecom.meta || {};
  const tlabel = t => { const m = meta[t.num] || {}; const i = IX.numInfo.get(t.num); return t.num + ' · ' + (m.name || (i && i.links[0] && (i.links[0].label || i.links[0].role)) || 'not linked') + ' · ' + nfmt(t.n) + ' events'; };
  el.innerHTML = pageHead('CDR Analysis', 'Each CDR split into call summary, contacts, day / night location, date-wise activity, IMEI & SIM, and SMS. Locations are CDR / cell-site correlation only.', `<button id="cdaX" class="btn-p">⇩ Export all tabs (Excel)</button>`) +
    `<div class="card" style="padding:12px 16px;margin-bottom:12px"><div class="row"><b>Target</b><select id="cdaTg" style="min-width:340px">${tel.targets.length > 1 ? `<option value="*" ${CDA.num === '*' ? 'selected' : ''}>All numbers — combined (${nfmt(c.telecom.cdr.length)} events)</option>` : ''}${tel.targets.map(t => `<option value="${esc(t.num)}" ${CDA.num === t.num ? 'selected' : ''}>${esc(tlabel(t))}</option>`).join('')}</select><span class="small dim">${esc(cdaT(X.rows[0].ts))} → ${esc(cdaT(X.rows[X.rows.length - 1].ts))}</span></div></div>
    <div class="tabs">${CDA_TABS.map(([k, l]) => `<button data-tab="${k}" class="${CDA.tab === k ? 'on' : ''}">${l}</button>`).join('')}</div><div id="cdaB"></div>`;
  const B = $('#cdaB', el);
  B.addEventListener('click', e => { const a = e.target.closest('[data-v]'); if (a) go(a.dataset.v); });
  $$('[data-tab]', el).forEach(b => b.onclick = () => { CDA.tab = b.dataset.tab; go('cdrsum'); });
  $('#cdaTg', el).onchange = e => { CDA.num = e.target.value; go('cdrsum'); };
  $('#cdaX', el).onclick = () => { try { cdaExport(X); } catch (e) { console.error(e); toast('Export failed: ' + e.message, 'err'); } };
  const bindNums = () => $$('[data-num]', B).forEach(x => x.onclick = e => { e.preventDefault(); openNumber(x.dataset.num); });
  try {
    if (CDA.tab === 'summary') { const sd = CDA.num !== '*' ? CELLDB.getSdr(CDA.num) : null; B.innerHTML = (sd ? sdrHtml(sd, 'Subscriber details (SDR) — ' + CDA.num) : '') + cdaSummary(X); }
    else if (CDA.tab === 'contacts') {
      B.innerHTML = cdaContactsHtml(X); const cols = cdaContactCols(X); const all = cdaContacts(X);
      const vt = vtable($('#cdaCT', B), { cols, rows: all, height: 480, onClick: r => openNumber(r.num) });
      $('#cdaCq', B).oninput = e => { const q = e.target.value.replace(/\D/g, ''); const l = q ? all.filter(x => x.num.includes(q)) : all; vt.set(l); $('#cdaCn', B).textContent = nfmt(l.length) + ' numbers'; };
      $('#cdaCx', B).onclick = () => exportTable('CDR contacts', cols, vt.rows());
    }
    else if (CDA.tab === 'loc') {
      B.innerHTML = cdaCellRes(X, enr) + cdaLocation(X);
      $('#cdaNs', B).onchange = e => { CDA.nStart = +e.target.value; go('cdrsum'); }; $('#cdaNe', B).onchange = e => { CDA.nEnd = +e.target.value; go('cdrsum'); };
    }
    else if (CDA.tab === 'days') { B.innerHTML = cdaDaysHtml(X); const b = $('#cdaDx', B); if (b) b.onclick = () => { const L = cdaDays(X); exportTable('CDR date-wise', [{ label: 'Date', get: x => x.day }, { label: 'Events', get: x => x.n }, { label: 'Calls out', get: x => x.cOut }, { label: 'Calls in', get: x => x.cIn }, { label: 'SMS out', get: x => x.sOut }, { label: 'SMS in', get: x => x.sIn }, { label: 'Talk time (s)', get: x => x.dur }, { label: 'First cell', get: x => x.fCell }, { label: 'Last cell', get: x => x.zCell }], L); }; }
    else if (CDA.tab === 'imei') {
      B.innerHTML = cdaImeiHtml(X); const I = cdaImei(X);
      bindRows(B, I.imeis, g => cdaImeiDetail(X, g));
      $('#cdaIx', B).onclick = () => exportTable('CDR IMEI', [{ label: 'IMEI', get: x => x.i15 }, { label: 'TAC', get: x => x.tac }, { label: 'Handset', get: x => x.model }, { label: 'Check digit', get: x => x.check }, { label: 'Events', get: x => x.n }, { label: 'Calls', get: x => x.calls }, { label: 'SMS', get: x => x.sms }, { label: 'IMSIs', get: x => Array.from(x.imsis.keys()).join(', ') }, { label: 'First', get: x => cdaT(x.first) }, { label: 'Last', get: x => cdaT(x.last) }], I.imeis);
      $('#cdaTac', B).onclick = () => { const f = document.createElement('input'); f.type = 'file'; f.accept = '.csv,.xlsx,.xls,.txt'; f.onchange = async () => { const file = f.files[0]; if (!file) return; try { const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' }); const rowsT = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' }); const h = (rowsT[0] || []).map(x => String(x).toLowerCase().replace(/[^a-z]/g, '')); const ti = h.findIndex(x => x === 'tac'), bi = h.findIndex(x => /brand|make|manufacturer/.test(x)), mi = h.findIndex(x => /model|name/.test(x)); if (ti < 0) { toast('No TAC column found in the first row.', 'err'); return; } const m = new Map(); for (const r of rowsT.slice(1)) { const t = String(r[ti]).replace(/\D/g, '').slice(0, 8); if (t.length === 8) m.set(t, [bi >= 0 ? r[bi] : '', mi >= 0 ? r[mi] : ''].filter(Boolean).join(' ')); } CDA.tac = m; CDA.tacName = file.name; CDA.cache = null; toast('TAC list loaded: ' + nfmt(m.size) + ' entries', 'ok'); go('cdrsum'); } catch (e) { toast('Could not read the TAC list: ' + e.message, 'err'); } }; f.click(); };
    }
    else if (CDA.tab === 'sms') B.innerHTML = cdaSmsHtml(X);
    else if (CDA.tab === 'log') {
      B.innerHTML = `<div class="row" style="margin-bottom:8px"><input id="cdaLq" placeholder="Search number, cell, IMEI, IMSI, address…" value="${esc(CDA.q)}" style="width:300px"><select id="cdaLk"><option value="">All services</option><option value="CALL">Calls</option><option value="SMS">SMS</option><option value="DATA">Data</option></select><select id="cdaLd"><option value="">In + out</option><option value="OUT">Outgoing</option><option value="IN">Incoming</option></select><span class="small dim" id="cdaLn"></span><span class="grow"></span><button class="btn-sm" id="cdaLx">Export view</button></div><div id="cdaLT"></div>`;
      $('#cdaLk', B).value = CDA.fKind; $('#cdaLd', B).value = CDA.fDir; const cols = cdaLogCols(); let rowsL = cdaLogRows(X);
      const vt = vtable($('#cdaLT', B), { cols, rows: rowsL, height: 560 }); const upd = () => { rowsL = cdaLogRows(X); vt.set(rowsL); $('#cdaLn', B).textContent = nfmt(rowsL.length) + ' of ' + nfmt(X.rows.length) + ' events'; }; upd();
      $('#cdaLq', B).oninput = e => { CDA.q = e.target.value; upd(); bindNums(); }; $('#cdaLk', B).onchange = e => { CDA.fKind = e.target.value; upd(); }; $('#cdaLd', B).onchange = e => { CDA.fDir = e.target.value; upd(); };
      $('#cdaLx', B).onclick = () => exportTable('CDR event log', cols, vt.rows().slice(0, 200000));
    }
  } catch (e) { console.error(e); B.innerHTML = `<div class="notice err">This tab failed to render: ${esc(e.message)}</div>`; }
  bindNums();
};
function cdaImeiDetail(X, g) {
  const contacts = Array.from(groupBy(g.rows.filter(r => r.other && !cdaIsHdr(r.other)), r => r.other).entries()).map(([n, l]) => ({ n, c: l.length, dur: sum(l, r => r.dur) })).sort((a, b) => b.c - a.c).slice(0, 10);
  const cells = cdaCellStats(g.rows).slice(0, 8);
  const body = `<div class="row" style="margin-bottom:10px"><b class="mono" style="font-size:18px">${esc(g.i15)}</b>${g.check === 'Valid' ? badge('Check digit valid', 'green') : badge('Check digit: ' + g.check, 'amber')}</div>
    <div class="kv"><div>TAC (first 8 digits)</div><div class="mono">${esc(g.tac)}</div><div>Handset</div><div>${esc(g.model || 'Not known — load a TAC list')}</div><div>Used between</div><div>${esc(cdaT(g.first))} → ${esc(cdaT(g.last))}</div><div>Events / active days</div><div>${nfmt(g.n)} / ${g.days.size}</div><div>Targets</div><div class="mono">${esc(Array.from(g.targets).join(', '))}</div></div>
    <div class="grid g2" style="margin-top:12px"><div class="card"><h4>SIMs (IMSI) used in this handset</h4>${simpleTable([{ label: 'IMSI', html: x => `<span class="mono">${esc(x[0])}</span>` }, { label: 'Events', get: x => x[1], num: 1 }], Array.from(g.imsis.entries()).sort((a, b) => b[1] - a[1]), { maxH: 200, empty: 'No IMSI.' })}</div>
    <div class="card"><h4>Top cells with this handset</h4>${simpleTable([{ label: 'Cell', html: x => `<span class="mono">${esc(x.cell)}</span>` }, { label: 'Address', get: x => x.addr || '—' }, { label: 'Events', get: x => x.n, num: 1 }], cells, { maxH: 200, empty: 'No cell data.' })}</div></div>
    <div class="card" style="margin-top:12px"><h4>Top contacts from this handset</h4>${simpleTable([{ label: 'Number', html: x => `<span class="mono">${esc(x.n)}</span>` }, { label: 'Events', get: x => x.c, num: 1 }, { label: 'Talk time', get: x => cdaDur(x.dur), num: 1 }], contacts, { maxH: 240, empty: 'None.' })}</div>`;
  modal({ title: 'Handset (IMEI) — ' + esc(g.i15), body });
}
