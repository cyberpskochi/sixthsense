/* ============================ CASE INTELLIGENCE ENGINE ============================
   Result-oriented analyses requested by the station:
   1 Complainant → Layer 1 direct transfers (UTR on both sides, per account and combined)
   2 UPI IDs / counterparties / POS places with the highest debits and credits
   3 Dormant accounts with sudden activity
   4 Peak transaction dates per account type
   5 Test (₹1 / small) transactions and their interconnections
   6 CDR location intelligence: where each linked number was when money moved,
     using statement time, or bank-SMS time from the CDR when the statement has no time;
     common cells / common IMEI across different accounts = interconnection
   7 Location hotspots combining ATM, POS, branch (IFSC) and CDR locations
   All results are investigative leads to be verified against source records.       */
const INTEL = { testMax: 10, dormantDays: 90, fusionWinMin: 15, smsWinMin: 30 };
function acctType(a) {
  if (!a) return 'Other'; const l = acctLayer(a.id), r = a.role || '';
  if (l === 0 || r === 'Complainant') return 'Complainant';
  if (l === 1) return 'Layer 1'; if (l === 2) return 'Suspect (L2)'; if (l != null && l >= 3) return 'Suspect (L3+)';
  if (/L1|accused/i.test(r)) return 'Layer 1'; if (/L3/i.test(r)) return 'Suspect (L3+)'; if (/L2|suspect/i.test(r)) return 'Suspect (L2)';
  return 'Other';
}
const ACCT_TYPES = ['Complainant', 'Layer 1', 'Suspect (L2)', 'Suspect (L3+)', 'Other'];
const acctName = a => a ? (a.holder ? a.holder + ' · ' : '') + a.acctNo : '';
function dayKey(ts) { const d = new Date(ts); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
function intelCache(k, fn) { const d = D(); d.intel = d.intel || {}; if (!(k in d.intel)) d.intel[k] = fn(); return d.intel[k]; }

/* 1 ─ Complainant → Layer 1 direct transfers */
function anDirect() {
  return intelCache('direct', () => {
    const c = S.cur; const d = D(); const rows = [];
    const comp = c.accts.filter(a => acctType(a) === 'Complainant');
    const dis = new Set(c.work.disputed);
    for (const a of comp) for (const t of IX.txByAcct.get(a.id) || []) {
      if (!(t.dr > 0)) continue; const m = d.L.M.get(t.id);
      const to = m && m.toAcct ? IX.acctById.get(m.toAcct) : null;
      if (to && acctType(to) === 'Complainant') continue;
      if (!to && !dis.has(t.id)) continue;
      const cr = m && m.credit ? IX.txById.get(m.credit) : null;
      rows.push({ from: a, tx: t, to, cr, amt: t.dr, utr: t.utr || t.ref || '', crUtr: cr ? (cr.utr || cr.ref || '') : '', utrMatch: !!(cr && t.utr && normUtr(t.utr) === normUtr(cr.utr)), strength: m ? m.strength : 'UNRESOLVED', reasons: m ? m.reasons : ['Beneficiary statement not uploaded'], disputed: dis.has(t.id),
        benef: to ? '' : (t.cpAcct && t.cpAcct[0]) || t.upi || t.cpMasked || '' });
    }
    rows.sort((x, y) => x.tx.ts - y.tx.ts);
    const by = new Map();
    for (const r of rows) { const k = r.to ? r.to.id : 'X:' + (r.benef || 'unknown'); let s = by.get(k); if (!s) { s = { key: k, to: r.to, label: r.to ? acctName(r.to) : (r.benef ? 'Not uploaded: ' + r.benef : 'Beneficiary not identified'), bank: r.to ? r.to.bank : '', n: 0, amt: 0, utrOk: 0, first: null, last: null, from: new Set() }; by.set(k, s); }
      s.n++; s.amt += r.amt; if (r.utrMatch) s.utrOk++; s.first = s.first == null ? r.tx.ts : Math.min(s.first, r.tx.ts); s.last = s.last == null ? r.tx.ts : Math.max(s.last, r.tx.ts); s.from.add(r.from.acctNo); }
    const sum_ = Array.from(by.values()).map(s => Object.assign(s, { amt: round2(s.amt), from: Array.from(s.from) })).sort((a, b) => b.amt - a.amt);
    return { rows, sum: sum_, total: round2(sum(rows, r => r.amt)), n: rows.length, toL1: rows.filter(r => r.to).length, utrOk: rows.filter(r => r.utrMatch).length };
  });
}

/* 2 ─ UPI / counterparty / POS */
function posPlace(narr) {
  let s = String(narr || '').toUpperCase().replace(/X{3,}\d*/g, ' ').replace(/\d{6,}/g, ' ');
  s = s.replace(/\b(POS|PUR|PURCHASE|ECOM|VPS|IPS|DEBIT|CARD|VISA|MASTER|RUPAY|TXN|REF|NO|DR|CR|AT|ON|INR|RS)\b/g, ' ').replace(/[\/\-_:*#|]+/g, ' ').replace(/\s+/g, ' ').trim();
  return s.slice(0, 48) || 'Unknown merchant';
}
function anUpiPos(type = '') {
  return intelCache('upi|' + type, () => {
    const c = S.cur; const upi = new Map(), cp = new Map(), pos = new Map(), acc = new Map();
    const inType = a => !type || acctType(a) === type;
    for (const t of c.txns) {
      const a = IX.acctById.get(t.acctId); if (!inType(a)) continue; const amt = t.dr || t.cr; const isDr = t.dr > 0;
      let x = acc.get(a.id); if (!x) { x = { a, dr: 0, cr: 0, nDr: 0, nCr: 0 }; acc.set(a.id, x); } if (isDr) { x.dr += t.dr; x.nDr++; } else { x.cr += t.cr; x.nCr++; }
      if (t.upi) { let u = upi.get(t.upi); if (!u) { u = { upi: t.upi, dr: 0, cr: 0, nDr: 0, nCr: 0, accts: new Set(), names: new Set() }; upi.set(t.upi, u); } if (isDr) { u.dr += amt; u.nDr++; } else { u.cr += amt; u.nCr++; } u.accts.add(a.acctNo); if (t.cpName) u.names.add(t.cpName); }
      const who = t.cpName || (t.cpAcct && t.cpAcct[0]) || t.cpMasked || t.upi; if (who && t.channel !== 'ATM') { let p = cp.get(who); if (!p) { p = { who, dr: 0, cr: 0, n: 0, accts: new Set() }; cp.set(who, p); } if (isDr) p.dr += amt; else p.cr += amt; p.n++; p.accts.add(a.acctNo); }
      if (t.channel === 'POS' || t.channel === 'CARD' || /\bPOS\b|ECOM|PUR\//i.test(t.narr || '')) { const pl = posPlace(t.narr); let p = pos.get(pl); if (!p) { p = { place: pl, amt: 0, n: 0, accts: new Set(), first: t.ts, last: t.ts }; pos.set(pl, p); } p.amt += amt; p.n++; p.accts.add(a.acctNo); p.first = Math.min(p.first, t.ts); p.last = Math.max(p.last, t.ts); }
    }
    const fin = m => Array.from(m.values()).map(v => { for (const k of Object.keys(v)) if (v[k] instanceof Set) v[k] = Array.from(v[k]); return v; });
    return { upi: fin(upi), cp: fin(cp), pos: fin(pos).sort((a, b) => b.amt - a.amt), acc: Array.from(acc.values()) };
  });
}

/* 3 ─ Dormant accounts with sudden activity */
function anDormant() {
  return intelCache('dormant', () => {
    const c = S.cur; const out = []; const DAY = 864e5; const dd = INTEL.dormantDays;
    for (const a of c.accts) {
      const l = (IX.txByAcct.get(a.id) || []).slice().sort((x, y) => x.ts - y.ts); if (l.length < 3) continue;
      let best = null;
      for (let i = 1; i < l.length; i++) { const gap = (l[i].ts - l[i - 1].ts) / DAY; if (!best || gap > best.gap) best = { gap, i }; }
      // spike: 30-day window after the longest gap vs the 180 days before it
      const at = best ? l[best.i].ts : l[0].ts; const before = l.filter(t => t.ts < at && t.ts >= at - 180 * DAY); const after = l.filter(t => t.ts >= at && t.ts < at + 30 * DAY);
      const preMonthly = before.length / 6, postN = after.length, postAmt = sum(after, t => t.dr + t.cr), preAmt = sum(before, t => t.dr + t.cr);
      const ratio = preMonthly > 0 ? postN / preMonthly : postN;
      const dormant = best && best.gap >= dd; const spike = postN >= 10 && ratio >= 5;
      if (!dormant && !spike) continue;
      const firstCr = after.find(t => t.cr > 0);
      const months = new Map(); for (const t of l) { const k = dayKey(t.ts).slice(0, 7); months.set(k, (months.get(k) || 0) + 1); }
      out.push({ a, type: acctType(a), lastBefore: best && best.i ? l[best.i - 1].ts : null, restart: at, gap: best ? Math.round(best.gap) : 0, preMonthly: round2(preMonthly), preAmt: round2(preAmt), postN, postAmt: round2(postAmt), ratio: round2(ratio), firstCr,
        verdict: dormant && spike ? 'Dormant → sudden heavy activity' : dormant ? 'Dormant, then reactivated' : 'Sudden spike in activity', months: Array.from(months.entries()) });
    }
    return out.sort((x, y) => (y.verdict.startsWith('Dormant →') - x.verdict.startsWith('Dormant →')) || y.gap - x.gap);
  });
}

/* 4 ─ Peak dates */
function anPeak() {
  return intelCache('peak', () => {
    const c = S.cur; const byType = new Map(), byAcct = [];
    for (const a of c.accts) {
      const l = IX.txByAcct.get(a.id) || []; if (!l.length) continue; const ty = acctType(a); const days = new Map();
      for (const t of l) { const k = dayKey(t.ts); let x = days.get(k); if (!x) { x = { n: 0, amt: 0, dr: 0, cr: 0 }; days.set(k, x); } x.n++; x.amt += t.dr + t.cr; x.dr += t.dr; x.cr += t.cr;
        let T_ = byType.get(ty); if (!T_) { T_ = new Map(); byType.set(ty, T_); } let y = T_.get(k); if (!y) { y = { n: 0, amt: 0, accts: new Set() }; T_.set(k, y); } y.n++; y.amt += t.dr + t.cr; y.accts.add(a.acctNo); }
      const top = Array.from(days.entries()).sort((p, q) => q[1].n - p[1].n || q[1].amt - p[1].amt)[0];
      byAcct.push({ a, type: ty, date: top[0], n: top[1].n, amt: round2(top[1].amt), dr: round2(top[1].dr), cr: round2(top[1].cr), total: l.length, days: days.size });
    }
    const types = ACCT_TYPES.filter(t => byType.has(t)).map(t => { const e = Array.from(byType.get(t).entries()); const topN = e.slice().sort((p, q) => q[1].n - p[1].n)[0], topA = e.slice().sort((p, q) => q[1].amt - p[1].amt)[0];
      return { type: t, date: topN[0], n: topN[1].n, accts: Array.from(topN[1].accts), amtDate: topA[0], amt: round2(topA[1].amt), top5: e.sort((p, q) => q[1].n - p[1].n).slice(0, 5).map(([k, v]) => ({ date: k, n: v.n, amt: round2(v.amt) })) }; });
    return { types, byAcct: byAcct.sort((x, y) => ACCT_TYPES.indexOf(x.type) - ACCT_TYPES.indexOf(y.type) || y.n - x.n) };
  });
}

/* 6 ─ CDR location intelligence */
const BANK_HDR = /SBI|HDFC|ICICI|AXIS|KOTAK|FEDBNK|FEDERAL|CANBNK|CANARA|BOB|BARODA|UNION|UBI|PNB|IDFC|YESBNK|YES|INDUS|INDBNK|IOB|UCO|CENTBK|BOI|IPPB|AIRBNK|PAYTM|PYTM|AUBANK|RBL|SIB|KVB|CUB|IDBI|DBS|BANK|BNK|UPI|NEFT|IMPS/;
function isBankSender(o) { o = String(o || '').toUpperCase(); return /[A-Z]/.test(o) && (/^[A-Z]{2}-/.test(o) || BANK_HDR.test(o)); }
function anFusion() {
  return intelCache('fusion', () => {
    const c = S.cur; const d = D(); const cdr = c.telecom.cdr; const meta = c.telecom.meta || {};
    const byTarget = groupBy(cdr.map((r, i) => i), i => cdr[i].target); for (const v of byTarget.values()) v.sort((a, b) => cdr[a].ts - cdr[b].ts);
    const bankSms = new Map(); // target -> day -> [ts]
    for (const r of cdr) if (r.kind === 'SMS' && r.dir !== 'OUT' && isBankSender(r.other)) { const k = r.target + '|' + dayKey(r.ts); if (!bankSms.has(k)) bankSms.set(k, []); bankSms.get(k).push(r.ts); }
    for (const v of bankSms.values()) v.sort((a, b) => a - b);
    const nearest = (num, ts, winMin) => { const l = byTarget.get(num); if (!l) return null; let lo = 0, hi = l.length; while (lo < hi) { const m = (lo + hi) >> 1; if (cdr[l[m]].ts < ts) lo = m + 1; else hi = m; } let best = null;
      for (let j = Math.max(0, lo - 6); j < Math.min(l.length, lo + 6); j++) { const r = cdr[l[j]]; if (!r.cell && !r.addr) continue; const dt = Math.abs(r.ts - ts); if (dt <= winMin * 60000 && (!best || dt < best.dt)) best = { r, dt }; } return best; };
    // events: every trail debit and credit + complainant disputed debits
    const ev = new Map(); const add = (tx, role, flow) => { if (!tx || ev.has(tx.id)) return; ev.set(tx.id, { tx, role, flow }); };
    for (const f of d.flows) { add(IX.txById.get(f.debit), 'Debit (transfer out)', f); if (f.credit) add(IX.txById.get(f.credit), 'Credit (money received)', f); }
    for (const s of d.seeds) add(s, 'Complainant debit', null);
    for (const t of anTestRaw()) add(t, 'Test transaction', null);
    // order of same-day events per account (for pairing with bank SMS when time is missing)
    const dayIdx = new Map(); for (const e of Array.from(ev.values()).sort((x, y) => x.tx.ts - y.tx.ts || x.tx.seq - y.tx.seq)) { const k = e.tx.acctId + '|' + dayKey(e.tx.ts); const n = dayIdx.get(k) || 0; e.k = n; dayIdx.set(k, n + 1); }
    const rows = [];
    for (const e of ev.values()) {
      const t = e.tx; const a = IX.acctById.get(t.acctId); if (!a) continue; const nums = acctNumbers(a).filter(n => byTarget.has(n));
      let ts = null, src = '', win = INTEL.fusionWinMin;
      if (t.hasTime) { ts = t.ts; src = 'Statement time'; }
      else {
        const other = e.flow ? IX.txById.get(t.id === e.flow.debit ? e.flow.credit : e.flow.debit) : null;
        if (other && other.hasTime) { ts = other.ts; src = 'Time from linked statement (' + ((IX.acctById.get(other.acctId) || {}).acctNo || '') + ')'; }
        else {
          const tryNums = nums.concat(other ? acctNumbers(IX.acctById.get(other.acctId) || { mobiles: [], altMobiles: [] }) : []).concat(Array.from(T().compNums));
          for (const n of tryNums) { const l = bankSms.get(n + '|' + dayKey(t.ts)); if (l && l.length) { ts = l[Math.min(e.k || 0, l.length - 1)]; src = `Bank SMS in CDR of ${n}` + (l.length > 1 ? ` (${(e.k || 0) + 1} of ${l.length} that day)` : ''); win = INTEL.smsWinMin; break; } }
        }
      }
      const locs = []; if (ts != null) for (const n of nums) { const h = nearest(n, ts, win); if (h) locs.push({ num: n, name: (meta[n] || {}).name || '', cell: h.r.cell, addr: h.r.addr, lat: h.r.lat, lon: h.r.lon, imei: h.r.imei, at: h.r.ts, dt: Math.round(h.dt / 60000) }); }
      rows.push({ t, a, type: acctType(a), role: e.role, amt: t.dr || t.cr, ts, src: src || 'Time not available', nums, locs });
    }
    rows.sort((x, y) => (x.ts || x.t.ts) - (y.ts || y.t.ts));
    // interconnections
    const cellM = new Map(); for (const r of rows) for (const l of r.locs) { const k = l.cell || l.addr; if (!k) continue; let x = cellM.get(k); if (!x) { x = { cell: l.cell, addr: l.addr, lat: l.lat, lon: l.lon, accts: new Set(), nums: new Set(), n: 0, amt: 0 }; cellM.set(k, x); } if (r.type !== 'Complainant') x.accts.add(r.a.acctNo); else x.victim = true; x.nums.add(l.num); x.n++; x.amt += r.amt; if (!x.addr && l.addr) x.addr = l.addr; }
    const commonCells = Array.from(cellM.values()).filter(x => x.accts.size >= 2).map(x => Object.assign(x, { accts: Array.from(x.accts), nums: Array.from(x.nums), amt: round2(x.amt) })).sort((a, b) => b.accts.length - a.accts.length || b.n - a.n);
    const num2acct = new Map(); for (const a of c.accts) for (const n of acctNumbers(a)) { if (!num2acct.has(n)) num2acct.set(n, new Set()); num2acct.get(n).add(a.acctNo); }
    const imeiM = new Map(); for (const r of cdr) { if (!r.imei || r.imei.length < 14) continue; const k = r.imei.slice(0, 14); if (!imeiM.has(k)) imeiM.set(k, new Set()); imeiM.get(k).add(r.target); }
    const commonImei = Array.from(imeiM.entries()).filter(([, s]) => s.size >= 2).map(([imei, s]) => { const nums = Array.from(s); return { imei, nums, names: nums.map(n => (meta[n] || {}).name || ''), accts: uniq(nums.flatMap(n => Array.from(num2acct.get(n) || []))) }; }).sort((a, b) => b.nums.length - a.nums.length);
    // whole-CDR common locations: cells visited by ≥2 different CDR holders; top cells per holder
    const allCell = new Map(); const perNum = new Map();
    for (const r of cdr) { if (!r.cell) continue; let x = allCell.get(r.cell); if (!x) { x = { cell: r.cell, addr: r.addr, lat: r.lat, lon: r.lon, nums: new Map() }; allCell.set(r.cell, x); } x.nums.set(r.target, (x.nums.get(r.target) || 0) + 1); if (!x.addr && r.addr) x.addr = r.addr;
      let p = perNum.get(r.target); if (!p) { p = new Map(); perNum.set(r.target, p); } p.set(r.cell, (p.get(r.cell) || 0) + 1); }
    const byAddr = new Map(); for (const x of allCell.values()) { const k = (x.addr || '').toUpperCase() || ('CELL ' + x.cell); let y = byAddr.get(k); if (!y) { y = { cell: x.cell, cells: [x.cell], addr: x.addr, lat: x.lat, lon: x.lon, nums: new Map() }; byAddr.set(k, y); } else y.cells.push(x.cell); for (const [n, v] of x.nums) y.nums.set(n, (y.nums.get(n) || 0) + v); }
    const sharedCells = Array.from(byAddr.values()).filter(x => x.nums.size >= 2).map(x => ({ cell: x.cells.slice(0, 4).join(', ') + (x.cells.length > 4 ? ' …' : ''), addr: x.addr, lat: x.lat, lon: x.lon, nums: Array.from(x.nums.keys()), names: Array.from(x.nums.keys()).map(n => (meta[n] || {}).name || ''), events: sum(Array.from(x.nums.values())), accts: uniq(Array.from(x.nums.keys()).flatMap(n => Array.from(num2acct.get(n) || []))) })).sort((a, b) => b.nums.length - a.nums.length || b.events - a.events);
    const topCells = Array.from(perNum.entries()).map(([n, m]) => { const tot = sum(Array.from(m.values())); const top = Array.from(m.entries()).sort((p, q) => q[1] - p[1]).slice(0, 3); return { num: n, name: (meta[n] || {}).name || '', role: (meta[n] || {}).role || '', accts: Array.from(num2acct.get(n) || []), top: top.map(([cell, k]) => ({ cell, addr: (allCell.get(cell) || {}).addr || '', n: k, pct: Math.round(k / tot * 100) })) }; });
    return { rows, located: rows.filter(r => r.locs.length).length, timed: rows.filter(r => r.ts != null).length, commonCells, commonImei, sharedCells, topCells, hasCdr: cdr.length > 0 };
  });
}

/* 5 ─ Test transactions */
function anTestRaw() { return intelCache('testRaw', () => S.cur.txns.filter(t => { const v = t.dr || t.cr; return v > 0 && v <= INTEL.testMax; })); }
function anTest() {
  return intelCache('test', () => {
    const raw = anTestRaw(); const rows = raw.map(t => { const a = IX.acctById.get(t.acctId); return { t, a, type: acctType(a), amt: t.dr || t.cr, dir: t.dr ? 'Sent' : 'Received', cp: t.cpName || (t.cpAcct && t.cpAcct[0]) || t.upi || t.cpMasked || '', one: (t.dr || t.cr) === 1 }; }).sort((x, y) => x.t.ts - y.t.ts);
    const byAcct = Array.from(groupBy(rows, r => r.a.id).values()).map(l => ({ a: l[0].a, type: l[0].type, n: l.length, ones: l.filter(r => r.one).length, first: l[0].t.ts, last: l[l.length - 1].t.ts, cps: uniq(l.map(r => r.cp).filter(Boolean)) })).sort((x, y) => y.n - x.n);
    const cpLinks = Array.from(groupBy(rows.filter(r => r.cp), r => r.cp).entries()).map(([cp, l]) => ({ cp, accts: uniq(l.map(r => r.a.acctNo)), n: l.length })).filter(x => x.accts.length >= 2).sort((a, b) => b.accts.length - a.accts.length);
    const clusters = []; let cur = [];
    for (const r of rows) { if (cur.length && r.t.ts - cur[cur.length - 1].t.ts > 60 * 60000) { if (uniq(cur.map(x => x.a.id)).length >= 2) clusters.push(cur); cur = []; } cur.push(r); }
    if (uniq(cur.map(x => x.a.id)).length >= 2) clusters.push(cur);
    return { rows, byAcct, cpLinks, clusters: clusters.map(l => ({ from: l[0].t.ts, to: l[l.length - 1].t.ts, accts: uniq(l.map(r => r.a.acctNo)), n: l.length })) };
  });
}

/* 7 ─ Location hotspots */
function anLocations() {
  return intelCache('loc', () => {
    const M = new Map(); const add = (label, src, o) => { label = String(label || '').trim(); if (!label) return; const k = label.toUpperCase(); let x = M.get(k); if (!x) { x = { label, src: new Set(), accts: new Set(), nums: new Set(), n: 0, amt: 0, lat: null, lon: null }; M.set(k, x); } x.src.add(src); (o.accts || []).forEach(v => v && x.accts.add(v)); (o.nums || []).forEach(v => v && x.nums.add(v)); x.n += o.n || 1; x.amt += o.amt || 0; if (x.lat == null && o.lat != null) { x.lat = o.lat; x.lon = o.lon; } };
    try { for (const a of caseAtmRows()) add(a.info ? [a.info.city || a.info.district, a.info.state].filter(Boolean).join(', ') : a.place, 'ATM cash-out', { accts: a.accts, n: a.n, amt: a.amount, lat: a.info && a.info.lat, lon: a.info && a.info.lon }); } catch {}
    try { for (const r of caseIfscRows()) if (r.info && (r.info.district || r.info.city)) add([r.info.district || r.info.city, r.info.state].filter(Boolean).join(', '), 'Bank branch (IFSC)', { accts: r.accts, amt: r.amount + r.ncrpAmt }); } catch {}
    for (const p of anUpiPos().pos) add(p.place, 'POS / merchant', { accts: p.accts, n: p.n, amt: p.amt });
    const F = anFusion(); for (const r of F.rows) for (const l of r.locs) add(l.addr || ('Cell ' + l.cell), 'Phone location at transaction', { accts: [r.a.acctNo], nums: [l.num], amt: r.amt, lat: l.lat, lon: l.lon });
    for (const s of F.sharedCells.slice(0, 200)) add(s.addr || ('Cell ' + s.cell), 'Common CDR location', { accts: s.accts, nums: s.nums, n: s.events, lat: s.lat, lon: s.lon });
    return Array.from(M.values()).map(x => Object.assign(x, { src: Array.from(x.src), accts: Array.from(x.accts), nums: Array.from(x.nums), amt: round2(x.amt), link: x.accts.size >= 2 || x.nums.size >= 2 || x.src.size >= 2 })).sort((a, b) => (b.link - a.link) || b.accts.length - a.accts.length || b.amt - a.amt);
  });
}
