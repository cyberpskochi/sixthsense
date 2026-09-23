/* =========================== PATTERNS, LEADS, REQUISITIONS =========================== */
const VALIDATION_RX = /valid|verif|test\b|penny|pennydrop|acc(?:ount)?\s*ver|a\/c\s*ver|api\s*bank|name\s*check|benef.*check|\bpv\b/i;
function microTxns(max) {
  return S.cur.txns.filter(t => (t.dr > 0 && t.dr <= max) || (t.cr > 0 && t.cr <= max)).map(t => ({ t, label: VALIDATION_RX.test(t.narr) ? 'POSSIBLE ACCOUNT VALIDATION' : 'MICRO TRANSACTION' }));
}
function patternQuery(q) {
  // q: {from, to, days:Set, amount, tol, dir:'ALL'|'DR'|'CR', accts:Set|null}
  const out = []; const w = S.cur.work.settings.cdrWindowMin;
  for (const t of S.cur.txns) {
    if (q.accts && !q.accts.has(t.acctId)) continue;
    if (q.from && t.ts < q.from) continue; if (q.to && t.ts > q.to + 864e5 - 1) continue;
    if (q.days && q.days.size && !q.days.has(dow(t.ts))) continue;
    const amt = t.dr || t.cr; if (q.dir === 'DR' && !t.dr) continue; if (q.dir === 'CR' && !t.cr) continue;
    if (q.amount && Math.abs(amt - q.amount) > (q.tol || 0)) continue;
    out.push(t);
  }
  const byAmt = groupBy(out, t => Math.round(t.dr || t.cr));
  const groups = Array.from(byAmt.entries()).map(([amt, list]) => {
    const cps = uniq(list.map(t => (t.cpAcct[0] || t.upi || t.cpMasked || '')).filter(Boolean));
    const accts = uniq(list.map(t => t.acctId)); const mobiles = uniq(list.map(t => t.cpMobile).filter(Boolean)); const upis = uniq(list.map(t => t.upi).filter(Boolean));
    let cdrHits = 0; if (S.cur.telecom.cdr.length) for (const t of list.slice(0, 400)) { const a = IX.acctById.get(t.acctId); const own = new Set(acctNumbers(a)); if (own.size && cdrWindow(t.ts, w, own).length) cdrHits++; }
    return { amt, n: list.length, list, accts: accts.length, cps: cps.length, mobiles: mobiles.length, upis: upis.length, weekend: list.filter(t => [0, 6].includes(dow(t.ts))).length, dates: uniq(list.map(t => isoDate(t.ts))).length, cdrHits };
  }).sort((a, b) => b.n - a.n);
  return { rows: out, groups };
}
function heatDowHour(list) { const m = Array.from({ length: 7 }, () => Array(24).fill(0)); for (const t of list) if (t.hasTime) m[dow(t.ts)][hourOf(t.ts)]++; return m; }
function smallThenCash(acctId) {
  const list = IX.txByAcct.get(acctId) || []; const out = [];
  for (let i = 0; i < list.length; i++) { const t = list[i]; if (!(t.dr && ['ATM', 'CASH'].includes(t.channel))) continue;
    const prior = list.slice(Math.max(0, i - 30), i).filter(x => x.cr > 0 && t.ts - x.ts <= 48 * 3600000 && x.cr <= 20000);
    if (prior.length >= 3 && t.dr >= 0.8 * sum(prior, x => x.cr)) out.push({ cash: t, credits: prior }); }
  return out;
}
/* ---------- entity possible-match engine (never auto-merges) ---------- */
function entityMatches() {
  const c = S.cur; const keys = new Map();
  const add = (type, v, a) => { if (!v) return; const k = type + ':' + v; if (!keys.has(k)) keys.set(k, { type, v, accts: new Set() }); keys.get(k).accts.add(a.id); };
  for (const a of c.accts) { a.mobiles.forEach(m => add('Mobile', m, a)); a.altMobiles.forEach(m => add('Mobile', m, a)); if (a.pan) add('PAN', a.pan, a); a.emails.forEach(e => add('Email', e, a)); (a.kyc.upi || []).forEach(u => add('UPI', u, a)); if (a.holder && a.holder.length > 4) add('Name', a.holder.replace(/\s+/g, ' '), a); if (a.address && a.address.length > 15) add('Address', normKey(a.address).slice(0, 60), a); }
  return Array.from(keys.values()).filter(x => x.accts.size >= 2).map(x => { const id = 'M-' + x.type + '-' + x.v; const st = c.work.links.find(l => l.type === 'entity' && l.key === id); return { id, type: x.type, v: x.v, accts: Array.from(x.accts), status: st ? st.status : 'POSSIBLE MATCH' }; }).sort((a, b) => ['PAN', 'Mobile', 'UPI', 'Email', 'Address', 'Name'].indexOf(a.type) - ['PAN', 'Mobile', 'UPI', 'Email', 'Address', 'Name'].indexOf(b.type));
}

/* ------------------------------ lead rules ------------------------------ */
function buildLeads() {
  const c = S.cur; const d = D(); const leads = [];
  const L = (rule, sev, key, title, detail, ents, ev) => leads.push({ id: 'LD-' + rule + '-' + String(key).slice(0, 60), rule, sev, title, detail, ents: ents || [], ev: ev || [], state: c.work.leadState['LD-' + rule + '-' + String(key).slice(0, 60)] || { status: 'New' } });
  const an = id => { const a = IX.acctById.get(id); return a ? acctLabel(a) : id; };
  for (const [id, r] of d.multiVictim) L('R01', 'high', id, `Account ${an(id)} received traced funds from multiple complainant accounts / disputed transactions`, `${r.origins.length} disputed transactions, ${r.fromAccts.length} sending accounts, ${inr(r.tin)} traced in.`, [id]);
  for (const [id, r] of d.acctRes) {
    if (r.tin >= 1000 && r.tout >= 0.8 * r.tin) { const fl = d.flows.filter(f => f.fromAcct === id && f.gap != null); const med = fl.length ? fl.map(f => f.gap).sort((a, b) => a - b)[Math.floor(fl.length / 2)] : null; if (med != null && med <= 3600000) L('R02', 'med', id, `Account ${an(id)} moved ${Math.round(100 * r.tout / r.tin)}% of traced funds onward shortly after receipt`, `Median time between receipt and onward debit: ${durTxt(med)}.`, [id]); }
    if (r.retained >= 1000) L('R03', r.retained >= 100000 ? 'high' : 'med', id, `Traced funds may still be available in ${an(id)}`, `${inr(r.retained)} of traced money was not debited as of the last statement row — consider hold/freeze request.`, [id]);
    if (r.cash >= 1000) L('R04', 'med', id, `Traced funds withdrawn as cash/ATM from ${an(id)}`, `${inr(r.cash)} withdrawn. Request ATM ID, location and CCTV footage from the bank.`, [id]);
    if (!r.hasStmt && r.tin > 0) L('R05', 'high', id, `Statement pending for ${an(id)} (Layer ${r.layer})`, `${inr(r.tin)} traced into this account; onward trail cannot continue without its statement.`, [id]);
  }
  const unresolved = d.flows.filter(f => f.toExt && f.toExt.kind === 'EXT'); if (unresolved.length) L('R05B', 'med', 'ext', `${unresolved.length} onward transfers go to beneficiaries not yet identified`, `${inr(sum(unresolved, f => f.amt))} traced to unidentified beneficiaries. See Requisitions → Statements.`, []);
  const ipx = IPX();
  for (const s of ipx.sharedIp.slice(0, 200)) L('R06', s.comp ? 'high' : s.close < 864e5 ? 'high' : 'med', s.ip, `Login IP ${s.ip} used on ${s.accts.length} different accounts`, `${s.cls.label}. Closest logins across accounts: ${s.close === Infinity ? '—' : durTxt(s.close)} apart.${s.comp ? ' Includes the complainant account.' : ''} ${s.cls.note || ''}`, s.accts);
  for (const s of ipx.sharedDev) L('R06B', 'high', s.dev, `Same device ID on ${s.accts.length} accounts`, `Device ${s.dev}`, s.accts);
  for (const a of ipx.compAlerts) L('R07', 'high', a.tx, `Disputed transaction ${a.tx} performed in a session from IP ${a.ip}${a.newIp ? ' not seen in complainant\'s earlier logins' : ''}`, a.otherAccts.length ? `The same IP also appears in logins of: ${a.otherAccts.map(an).join(', ')}.` : `Complainant baseline had ${a.baseline} earlier IP(s).`, [IX.txById.get(a.tx).acctId, ...a.otherAccts]);
  for (const h of ipx.resolvedHits) if (h.info || h.acctOwnNum) L('R08', 'high', h.tx + h.num, `Login IP ${h.ip} for ${h.tx} resolves (IPDR) to ${h.num}`, h.acctOwnNum ? 'Resolved number is the account\'s own registered/alternate number.' : `Number is linked to: ${h.info.links.map(l => l.kind + ' ' + (l.label || '')).join('; ')}`, [IX.txById.get(h.tx).acctId, h.num]);
  if (c.telecom.cdr.length) {
    const tel = T();
    for (const x of tel.direct.filter(x => x.complainant).slice(0, 100)) L('R09', 'high', x.a + x.b, `Complainant number in contact with ${x.a === x.b ? x.a : (tel.compNums.has(x.a) ? x.b : x.a)}`, `${x.n} events (${x.sms} SMS) between ${fmtDT(x.first)} and ${fmtDT(x.last)}. ${numLabel(tel.compNums.has(x.a) ? x.b : x.a)}`, [x.a, x.b]);
    for (const x of tel.direct.filter(x => !x.complainant).slice(0, 100)) L('R09B', 'med', x.a + x.b, `Direct contact between known numbers ${x.a} and ${x.b}`, `${x.n} events, ${Math.round(x.dur / 60)} min total. ${numLabel(x.a)} ↔ ${numLabel(x.b)}`, [x.a, x.b]);
    for (const x of tel.common.filter(x => x.targets.length >= 3).slice(0, 50)) L('R10', 'med', x.num, `Number ${x.num} appears in ${x.targets.length} target CDRs`, `${x.n} events with ${x.targets.join(', ')}`, [x.num, ...x.targets]);
    for (const x of tel.sharedImei) L('R11', 'high', x.imei, `Handset IMEI ${x.imei} used with ${x.nums.length} numbers`, x.nums.map(numLabel).join(', '), x.nums);
    for (const x of tel.colocPairs.slice(0, 50)) L('R12', 'low', x.a + x.b + x.cell, `${x.a} and ${x.b} active on the same cell ${x.cell} within 15 minutes (${x.n}×)`, `CDR / cell-site correlation — not an exact location. ${x.addr || ''}`, [x.a, x.b]);
  }
  for (const m of entityMatches().filter(m => m.status !== 'REJECTED' && ['Mobile', 'PAN', 'UPI', 'Email'].includes(m.type))) L('R13', 'med', m.id, `Same ${m.type} ${m.v} linked to ${m.accts.length} accounts`, m.accts.map(an).join('; '), m.accts);
  const micro = microTxns(c.work.settings.microMax).filter(x => x.label === 'POSSIBLE ACCOUNT VALIDATION');
  for (const [acctId, l] of groupBy(micro, x => x.t.acctId)) L('R15', 'low', acctId, `${l.length} micro transaction(s) with account-validation related narration in ${an(acctId)}`, l.slice(0, 5).map(x => fmtDate(x.t.ts) + ' ' + inr(x.t.dr || x.t.cr) + ' ' + x.t.narr.slice(0, 40)).join(' | '), [acctId]);
  for (const [acctId, list] of IX.txByAcct) {
    const rep = Array.from(countBy(list.filter(t => t.dr || t.cr), t => (t.dr ? 'D' : 'C') + Math.round(t.dr || t.cr)).entries()).filter(([k, n]) => n >= 5 && +k.slice(1) >= 500).sort((a, b) => b[1] - a[1]).slice(0, 3);
    for (const [k, n] of rep) L('R16', 'low', acctId + k, `Repeated ${k[0] === 'D' ? 'debits' : 'credits'} of ${inr(+k.slice(1), 0)} (${n}×) in ${an(acctId)}`, 'Repeated same-amount transactions detected. Review counterparties and dates in Patterns.', [acctId]);
    if (list.length >= 10) { const we = list.filter(t => [0, 6].includes(dow(t.ts))).length; if (we / list.length >= 0.6) L('R17', 'low', acctId, `Weekend concentration in ${an(acctId)}`, `${we} of ${list.length} transactions on Saturday/Sunday.`, [acctId]); }
    for (const s of smallThenCash(acctId).slice(0, 3)) L('R18', 'low', s.cash.id, `Multiple small credits followed by cash withdrawal in ${an(acctId)}`, `${s.credits.length} credits (${inr(sum(s.credits, x => x.cr))}) then ${inr(s.cash.dr)} ${s.cash.channel} on ${fmtDT(s.cash.ts, s.cash.hasTime)}`, [acctId]);
  }
  if (d.L.ambiguous.length) L('R19', 'med', 'amb', `${d.L.ambiguous.length} debit(s) have several possible matching credits`, 'Not linked automatically. Review in Money Trail → Ambiguous and confirm the correct link.', []);
  const badImp = c.work.imports.filter(i => i.balFails > 0 || i.rejectCount > 0); if (badImp.length) L('R20', 'low', 'dq', `Data quality: ${badImp.length} imported file(s) have rows needing review`, badImp.map(i => `${i.file}: ${i.rejectCount} unparsed, ${i.balFails} balance mismatch`).join(' | ').slice(0, 500), []);
  const sevO = { high: 0, med: 1, low: 2 }; leads.sort((a, b) => sevO[a.sev] - sevO[b.sev]);
  return leads;
}
function requisitions() {
  const c = S.cur; const d = D(); const out = { stmt: [], kyc: [], cdr: [], ipdr: [], iplog: [] };
  for (const [id, r] of d.acctRes) { const a = IX.acctById.get(id); if (!r.hasStmt) out.stmt.push({ acctNo: a.acctNo, bank: a.bank || (bankByIfsc(a.ifsc) || {}).name || '', ifsc: a.ifsc, holder: a.holder, layer: r.layer, amount: r.tin, reason: 'Received traced funds', from: r.fromAccts.map(x => (IX.acctById.get(x) || {}).acctNo).join(', ') }); }
  const ext = groupBy(d.flows.filter(f => f.toExt && f.toExt.kind === 'EXT' && (f.toExt.acctNo || f.toExt.upi)), f => f.toExt.acctNo || f.toExt.upi);
  for (const [k, fl] of ext) { const f = fl[0]; out.stmt.push({ acctNo: f.toExt.acctNo || '', upi: f.toExt.upi || '', bank: (bankByIfsc(f.toExt.ifsc) || {}).name || '', ifsc: f.toExt.ifsc || '', holder: f.toExt.name || '', layer: f.layerFrom + 1, amount: round2(sum(fl, x => x.amt)), reason: 'Beneficiary named in narration (not uploaded)', from: uniq(fl.map(x => (IX.acctById.get(x.fromAcct) || {}).acctNo)).join(', '), utrs: fl.map(x => (IX.txById.get(x.debit) || {}).utr).filter(Boolean).join(', ') }); }
  const trailAccts = new Set([...d.compIds, ...d.acctRes.keys()]);
  for (const id of trailAccts) { const a = IX.acctById.get(id); if (!a) continue; if (!a.mobiles.length && !a.holder) out.kyc.push({ acctNo: a.acctNo, bank: a.bank, ifsc: a.ifsc, layer: acctLayer(id) }); if (!(IPX().byAcct.get(id) || []).length) out.iplog.push({ acctNo: a.acctNo, bank: a.bank, layer: acctLayer(id), from: fmtDate(((d.acctRes.get(id) || {}).firstIn) || (d.seeds[0] || {}).ts) }); }
  const haveCdr = new Set(c.telecom.cdr.map(r => r.target));
  for (const [num, info] of IX.numInfo) if (isMobile(num) && !haveCdr.has(num)) out.cdr.push({ num, links: info.links.map(l => l.kind + ': ' + l.label).join('; '), roles: Array.from(info.roles).join(', ') });
  for (const h of IPX().resolvedHits) if (!haveCdr.has(h.num) && isMobile(h.num) && !out.cdr.some(x => x.num === h.num)) out.cdr.push({ num: h.num, links: 'Resolved from IPDR of login IP ' + h.ip, roles: '' });
  out.ipdr = IPX().ipdrPending;
  return out;
}
