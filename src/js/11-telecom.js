/* =========================== TELECOM INTELLIGENCE ===========================
   Account-linked (registered) and alternate numbers come from KYC / bank replies.
   Cross-hits: direct contact between known numbers, common contacts across
   target CDRs, shared handsets (IMEI), co-location on the same cell, contact
   with complainant numbers, and calls inside transaction time windows.       */
function T() {
  const d = D(); if (d.tel) return d.tel;
  const c = S.cur; const cdr = c.telecom.cdr;
  const byTs = cdr.map((_, i) => i).sort((a, b) => cdr[a].ts - cdr[b].ts);
  const byTarget = groupBy(cdr, r => r.target);
  const known = new Set(IX.numInfo.keys()); for (const k of byTarget.keys()) known.add(k);
  const compNums = new Set(); for (const a of c.accts) if (a.role === 'Complainant') { a.mobiles.forEach(n => compNums.add(n)); a.altMobiles.forEach(n => compNums.add(n)); }
  c.work.numbers.filter(n => n.role === 'Victim').forEach(n => compNums.add(n.num));
  // targets summary
  const targets = Array.from(byTarget.entries()).map(([t, rows]) => {
    const ts = rows.map(r => r.ts); const others = countBy(rows.filter(r => r.other), r => r.other);
    return { num: t, n: rows.length, first: Math.min(...ts), last: Math.max(...ts), inc: rows.filter(r => r.dir === 'IN').length, out: rows.filter(r => r.dir === 'OUT').length, contacts: others.size, imeis: uniq(rows.map(r => r.imei).filter(Boolean)), cells: uniq(rows.map(r => r.cell).filter(Boolean)).length, info: IX.numInfo.get(t) };
  }).sort((a, b) => b.n - a.n);
  // a. direct contact between known numbers
  const directM = new Map();
  for (const r of cdr) { if (!r.other || r.other === r.target || !known.has(r.other)) continue; const k = [r.target, r.other].sort().join('~'); if (!directM.has(k)) directM.set(k, { a: k.split('~')[0], b: k.split('~')[1], n: 0, dur: 0, first: r.ts, last: r.ts, sms: 0, rows: [] }); const x = directM.get(k); x.n++; x.dur += r.dur; if (r.kind === 'SMS') x.sms++; x.first = Math.min(x.first, r.ts); x.last = Math.max(x.last, r.ts); if (x.rows.length < 200) x.rows.push(r.i); }
  const direct = Array.from(directM.values()).map(x => Object.assign(x, { complainant: compNums.has(x.a) || compNums.has(x.b) })).sort((a, b) => (b.complainant - a.complainant) || b.n - a.n);
  // b. common contacts across targets
  const cm = new Map();
  for (const r of cdr) { if (!r.other || isServiceNo(r.other) || r.other === r.target) continue; if (!cm.has(r.other)) cm.set(r.other, new Map()); const m = cm.get(r.other); m.set(r.target, (m.get(r.target) || 0) + 1); }
  const common = Array.from(cm.entries()).filter(([, m]) => m.size >= 2).map(([n, m]) => ({ num: n, targets: Array.from(m.keys()), n: sum(Array.from(m.values())), known: known.has(n), info: IX.numInfo.get(n) })).sort((a, b) => b.targets.length - a.targets.length || b.n - a.n);
  // c. shared IMEI (from CDR + IPDR)
  const im = new Map(); const addI = (imei, num, src) => { if (!imei || imei.length < 14 || !num) return; const k = imei.slice(0, 14); if (!im.has(k)) im.set(k, new Map()); const m = im.get(k); if (!m.has(num)) m.set(num, new Set()); m.get(num).add(src); };
  for (const r of cdr) addI(r.imei, r.target, 'CDR'); for (const r of c.ip.ipdr) addI(r.imei, r.msisdn, 'IPDR');
  const sharedImei = Array.from(im.entries()).filter(([, m]) => m.size >= 2).map(([imei, m]) => ({ imei, nums: Array.from(m.keys()), src: uniq(Array.from(m.values()).flatMap(s => Array.from(s))) }));
  // d. co-location on same cell within 15 minutes (different targets)
  const coloc = []; const byCell = groupBy(cdr.filter(r => r.cell), r => r.cell);
  for (const [cell, rows] of byCell) {
    if (uniq(rows.map(r => r.target)).length < 2) continue; rows.sort((a, b) => a.ts - b.ts);
    for (let i = 0; i < rows.length && coloc.length < 3000; i++) for (let j = i + 1; j < rows.length && rows[j].ts - rows[i].ts <= 15 * 60000; j++) if (rows[j].target !== rows[i].target) coloc.push({ cell, a: rows[i].target, b: rows[j].target, ta: rows[i].ts, tb: rows[j].ts, addr: rows[i].addr || rows[j].addr });
  }
  const colocPairs = Array.from(groupBy(coloc, x => [x.a, x.b].sort().join('~') + '@' + x.cell).values()).map(g => ({ a: g[0].a, b: g[0].b, cell: g[0].cell, addr: g[0].addr, n: g.length, first: Math.min(...g.map(x => x.ta)), last: Math.max(...g.map(x => x.ta)) })).sort((a, b) => b.n - a.n);
  // numbers pending CDR (known but no CDR uploaded)
  const pendingCdr = Array.from(IX.numInfo.values()).filter(x => !byTarget.has(x.num) && isMobile(x.num));
  d.tel = { byTs, byTarget, targets, direct, common, sharedImei, colocPairs, compNums, known, pendingCdr };
  return d.tel;
}
function cdrWindow(ts, minutes, filterNums) {
  const c = S.cur; const cdr = c.telecom.cdr; const { byTs } = T(); const w = minutes * 60000;
  let lo = 0, hi = byTs.length; while (lo < hi) { const m = (lo + hi) >> 1; if (cdr[byTs[m]].ts < ts - w) lo = m + 1; else hi = m; }
  const out = []; for (let i = lo; i < byTs.length && cdr[byTs[i]].ts <= ts + w; i++) { const r = cdr[byTs[i]]; if (!filterNums || filterNums.has(r.target) || filterNums.has(r.other)) out.push(r); }
  return out;
}
function smsWindow(ts, minutes, filterNums) { const w = minutes * 60000; return S.cur.telecom.sms.filter(s => Math.abs(s.ts - ts) <= w && (!filterNums || filterNums.has(s.msisdn))); }
function acctNumbers(a) { return uniq(a.mobiles.concat(a.altMobiles)); }
/* Correlation row for one transaction */
function txCorrelation(t, minutes) {
  const c = S.cur; minutes = minutes || c.work.settings.cdrWindowMin; const a = IX.acctById.get(t.acctId);
  const own = new Set(acctNumbers(a)); const tel = T();
  const rel = new Set([...own, ...tel.compNums, ...tel.known]);
  const calls = cdrWindow(t.ts, minutes, rel);
  const ownCalls = calls.filter(r => own.has(r.target) || own.has(r.other));
  const compCalls = calls.filter(r => tel.compNums.has(r.target) || tel.compNums.has(r.other));
  const sms = smsWindow(t.ts, minutes, null).filter(s => own.has(s.msisdn) || tel.compNums.has(s.msisdn) || tel.known.has(s.msisdn));
  const login = IPX().txLogin.get(t.id);
  const cells = uniq(ownCalls.map(r => r.cell).filter(Boolean)); const imeis = uniq(ownCalls.map(r => r.imei).filter(Boolean));
  let score = 0; if (ownCalls.length) score += 2; if (compCalls.length) score += 2; if (sms.some(s => s.otp)) score += 2; else if (sms.length) score += 1; if (login) score += login.ipdr ? 3 : 2; if (cells.length) score += 1;
  return { calls, ownCalls, compCalls, sms, login, cells, imeis, score, strength: score >= 6 ? 'STRONG' : score >= 3 ? 'MODERATE' : score > 0 ? 'POSSIBLE' : '—', timeKnown: t.hasTime };
}
