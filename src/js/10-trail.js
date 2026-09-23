/* =========================== MONEY TRAIL ENGINE ===========================
   1) Link debits to credits across statements. Priority: UTR/RRN → reference
      → beneficiary account in narration (full / masked) → UPI/mobile → amount
      + time window (unique candidate only). Every link carries its reasons.
   2) Follow the disputed money: each disputed complainant debit is an origin.
      At each receiving account the traced amount enters a pool at the exact
      credit row; later debits draw from the pool (tainted-first, FIFO, or
      proportional to balance), never more than the running balance allows.
   3) Result: flows, layers, per-account in/out/cash/retained, unresolved
      beneficiaries (statement requisitions), ambiguous candidates for review. */
function linkTransactions() {
  const c = S.cur, st = c.work.settings;
  const credits = c.txns.filter(t => t.cr > 0), debits = c.txns.filter(t => t.dr > 0);
  const byUtr = new Map(); for (const t of credits) { const u = normUtr(t.utr); if (u && u.length >= 8) { if (!byUtr.has(u)) byUtr.set(u, []); byUtr.get(u).push(t); } }
  const byRef = new Map(); for (const t of credits) { const r = normUtr(t.ref); if (r && r.length >= 8) { if (!byRef.has(r)) byRef.set(r, []); byRef.get(r).push(t); } }
  const byAmt = new Map(); for (const t of credits) { const k = Math.round(t.cr); if (!byAmt.has(k)) byAmt.set(k, []); byAmt.get(k).push(t); }
  const tol = t => Math.max(st.amtTolAbs || 0, (st.amtTolPct || 0) / 100 * t.dr);
  const win = (a, b) => (a.hasTime && b.hasTime) ? st.windowMin * 60000 : st.unknownTimeWindowH * 3600000;
  const inWin = (d, cr) => Math.abs(cr.ts - d.ts) <= win(d, cr) && cr.ts >= d.ts - win(d, cr);
  const amtOk = (d, cr) => Math.abs(cr.cr - d.dr) <= tol(d) + 0.005;
  const userLinks = new Map(); const rejected = new Set();
  for (const l of c.work.links.filter(l => l.type === 'txn')) { if (l.status === 'CONFIRMED') userLinks.set(l.debit, l.credit); if (l.status === 'REJECTED') rejected.add(l.debit + '>' + l.credit); }
  const M = new Map(), usedCr = new Set(), ambiguous = [];
  const take = (d, cr, strength, reasons) => { M.set(d.id, { credit: cr ? cr.id : null, toAcct: cr ? cr.acctId : null, strength, reasons }); if (cr) usedCr.add(cr.id); };
  const ok = (d, cr) => cr.acctId !== d.acctId && !usedCr.has(cr.id) && !rejected.has(d.id + '>' + cr.id);
  // 0. investigator-confirmed links
  for (const [dId, cId] of userLinks) { const d = IX.txById.get(dId), cr = IX.txById.get(cId); if (d && cr) take(d, cr, 'CONFIRMED', ['Confirmed by investigator']); }
  // 1. UTR / RRN
  for (const d of debits) {
    if (M.has(d.id)) continue; const u = normUtr(d.utr); if (!u || u.length < 8) continue;
    const cands = (byUtr.get(u) || []).filter(cr => ok(d, cr)); if (!cands.length) continue;
    cands.sort((a, b) => Math.abs(a.cr - d.dr) - Math.abs(b.cr - d.dr) || Math.abs(a.ts - d.ts) - Math.abs(b.ts - d.ts));
    const cr = cands[0]; const r = [`Same UTR/RRN ${d.utr} on debit and credit`]; if (amtOk(d, cr)) r.push('Amount matches'); else r.push(`Amount differs by ${inr(Math.abs(cr.cr - d.dr))}`);
    take(d, cr, amtOk(d, cr) ? 'STRONG' : 'MODERATE', r);
  }
  // 2. reference / transaction id
  for (const d of debits) {
    if (M.has(d.id)) continue; const r = normUtr(d.ref) || normUtr(d.txnId); if (!r || r.length < 8) continue;
    const cands = (byRef.get(r) || byUtr.get(r) || []).filter(cr => ok(d, cr) && amtOk(d, cr)); if (cands.length === 1) take(d, cands[0], 'STRONG', ['Same transaction reference ' + r, 'Amount matches']);
  }
  // 3. beneficiary account / masked account / UPI / mobile named in the debit narration
  const acctsWithStmt = new Set(IX.txByAcct.keys());
  const bySuffix = new Map(), byUpi = new Map(), byMob = new Map(); const addTo = (m, k, a) => { if (!k) return; if (!m.has(k)) m.set(k, []); m.get(k).push(a); };
  for (const a of S.cur.accts) { const n = normAcct(a.acctNo); for (let L = 3; L <= 8 && L <= n.length; L++) addTo(bySuffix, L + ':' + n.slice(-L), a); (a.kyc.upi || []).forEach(u => addTo(byUpi, u, a)); a.mobiles.concat(a.altMobiles).forEach(m => addTo(byMob, m, a)); }
  for (const d of debits) {
    if (M.has(d.id)) continue;
    let target = null, why = '';
    for (const n of d.cpAcct || []) { const a = findAcct(n); if (a && a.id !== d.acctId) { target = a; why = `Debit narration names account ${n}`; break; } }
    if (!target && d.cpMasked) { const tail = normAcct(d.cpMasked).replace(/^[X*]+/, ''); const m = (bySuffix.get(Math.min(8, tail.length) + ':' + tail.slice(-8)) || []).filter(a => a.id !== d.acctId && maskedMatch(d.cpMasked, a.acctNo)); if (m.length === 1) { target = m[0]; why = `Masked account ${d.cpMasked} matches ${m[0].acctNo}`; } }
    if (!target && d.upi) { const m = (byUpi.get(d.upi) || []).filter(a => a.id !== d.acctId); if (m.length === 1) { target = m[0]; why = `UPI ID ${d.upi} belongs to ${m[0].acctNo} (KYC)`; } }
    if (!target && d.cpMobile) { const m = uniq((byMob.get(d.cpMobile) || []).filter(a => a.id !== d.acctId)); if (m.length === 1) { target = m[0]; why = `Mobile ${d.cpMobile} in narration is linked to ${m[0].acctNo}`; } }
    if (!target) continue;
    if (acctsWithStmt.has(target.id)) {
      const cands = (IX.txByAcct.get(target.id) || []).filter(cr => cr.cr > 0 && ok(d, cr) && amtOk(d, cr) && inWin(d, cr)).sort((a, b) => Math.abs(a.ts - d.ts) - Math.abs(b.ts - d.ts));
      if (cands.length) take(d, cands[0], 'STRONG', [why, 'Matching credit amount within time window']);
      else M.set(d.id, { credit: null, toAcct: target.id, strength: 'MODERATE', reasons: [why, 'No matching credit row found in the uploaded statement'] });
    } else M.set(d.id, { credit: null, toAcct: target.id, strength: 'MODERATE', reasons: [why, 'Statement of beneficiary account not yet uploaded'] });
  }
  // 4. amount + time (unique candidate only)
  for (const d of debits) {
    if (M.has(d.id)) continue; if (['ATM', 'CASH', 'POS', 'CARD'].includes(d.channel)) continue;
    const cands = [];
    for (let k = Math.round(d.dr - tol(d)) - 1; k <= Math.round(d.dr + tol(d)) + 1; k++) for (const cr of byAmt.get(k) || []) if (ok(d, cr) && amtOk(d, cr) && inWin(d, cr)) cands.push(cr);
    if (cands.length === 1) take(d, cands[0], 'POSSIBLE', [`Same amount ${inr(d.dr)} credited ${durTxt(cands[0].ts - d.ts)} ${cands[0].ts >= d.ts ? 'after' : 'before'}`, 'No UTR / account reference available — verify']);
    else if (cands.length > 1) ambiguous.push({ debit: d.id, cands: cands.slice(0, 8).map(x => x.id) });
  }
  const R = new Map(); for (const [dId, m] of M) if (m.credit) R.set(m.credit, dId);
  return { M, R, ambiguous };
}

function runTrail() {
  const c = S.cur, st = c.work.settings;
  const L = linkTransactions();
  const seeds = c.work.disputed.map(id => IX.txById.get(id)).filter(t => t && t.dr > 0).sort((a, b) => a.ts - b.ts);
  const holdMs = (st.maxHoldDays || 30) * 864e5; const maxL = st.maxLayers || 0;
  const arrivals = new Map(); // acctId -> Map(key -> arrival)
  const layer = new Map(); const flows = []; const terminals = new Map();
  const compIds = new Set(seeds.map(s => s.acctId));
  compIds.forEach(id => layer.set(id, 0));
  const flowOut = new Map(); // acctId -> flows emitted (replaced on recompute)
  function posOf(acctId, creditId, ts) {
    const list = IX.txByAcct.get(acctId) || [];
    if (creditId) { const t = IX.txById.get(creditId); if (t) return t.ord; }
    let lo = 0; while (lo < list.length && list[lo].ts < ts) lo++; return lo - 0.5;
  }
  function emit(fromAcct, fromLayer, d, amt, parts, arrTs) {
    const m = L.M.get(d.id); const f = { id: 'F' + (flows.length + 1), fromAcct, debit: d.id, amt: round2(amt), full: d.dr, ts: d.ts, hasTime: d.hasTime, parts, layerFrom: fromLayer, gap: arrTs != null ? d.ts - arrTs : null, channel: d.channel };
    if (m && m.toAcct) {
      Object.assign(f, { toAcct: m.toAcct, credit: m.credit, strength: m.strength, reasons: m.reasons });
      const dest = m.toAcct; if (!arrivals.has(dest)) arrivals.set(dest, new Map());
      const crT = m.credit ? IX.txById.get(m.credit) : null;
      arrivals.get(dest).set(d.id, { pos: posOf(dest, m.credit, crT ? crT.ts : d.ts), ts: crT ? crT.ts : d.ts, parts, amt, layer: fromLayer + 1, from: fromAcct, flow: f.id });
      if (!layer.has(dest) || layer.get(dest) > fromLayer + 1) layer.set(dest, fromLayer + 1);
      if (!IX.txByAcct.has(dest)) f.pending = true;
    } else {
      let kind = 'EXT', label = 'Unidentified beneficiary';
      if (['ATM', 'CASH'].includes(d.channel)) { kind = 'CASH'; label = 'Cash / ATM withdrawal'; }
      else if (['POS', 'CARD'].includes(d.channel)) { kind = 'CARD'; label = 'Card / POS spend'; }
      else if (d.cpAcct && d.cpAcct.length) { label = 'A/c ' + d.cpAcct[0]; }
      else if (d.upi) label = 'UPI ' + d.upi; else if (d.cpMasked) label = 'A/c ' + d.cpMasked;
      Object.assign(f, { toExt: { kind, label, acctNo: (d.cpAcct || [])[0] || d.cpMasked || '', upi: d.upi, ifsc: d.cpIfsc, name: d.cpName, mobile: d.cpMobile }, strength: kind === 'EXT' ? 'UNRESOLVED' : 'TERMINAL', reasons: kind === 'EXT' ? ['Beneficiary not among uploaded statements'] : ['Funds left the banking trail (' + label + ')'] });
      if (ambiguousSet.has(d.id)) f.ambiguous = true;
    }
    flows.push(f); return f;
  }
  const ambiguousSet = new Set(L.ambiguous.map(a => a.debit));
  // seeds: complainant disputed debits
  const seedFlows = [];
  for (const s of seeds) seedFlows.push(emit(s.acctId, 0, s, s.dr, [{ o: s.id, a: s.dr }], null));
  // iterative propagation
  const queue = uniq(Array.from(arrivals.keys())); let guard = 0; const lastSig = new Map(); const acctRes = new Map();
  while (queue.length && guard++ < 20000) {
    const acctId = queue.shift(); if (compIds.has(acctId) && !arrivals.has(acctId)) continue;
    const arr = Array.from((arrivals.get(acctId) || new Map()).values()).sort((a, b) => a.pos - b.pos);
    const sig = arr.map(a => a.pos + ':' + a.amt.toFixed(2)).join(',');
    if (lastSig.get(acctId) === sig) continue; lastSig.set(acctId, sig);
    // remove this account's previous outflows (and the arrivals they created downstream)
    const prev = flowOut.get(acctId) || [];
    for (const f of prev) { f.dead = true; if (f.toAcct && arrivals.has(f.toAcct)) { arrivals.get(f.toAcct).delete(f.debit); queue.push(f.toAcct); } }
    const myLayer = layer.get(acctId) ?? 1; const list = IX.txByAcct.get(acctId) || [];
    const out = []; const pool = []; let ai = 0; let tIn = 0, tOut = 0, cash = 0, card = 0, ext = 0, pend = 0;
    const firstIn = arr.length ? arr[0].ts : null;
    const addArr = a => { for (const p of a.parts) pool.push({ o: p.o, a: p.a * (a.amt / sum(a.parts, x => x.a) || 1), ts: a.ts, from: a.from }); tIn += a.amt; };
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      while (ai < arr.length && arr[ai].pos <= i) addArr(arr[ai++]);
      if (!pool.length) continue;
      if (t.dr > 0 && !compIds.has(acctId)) {
        let avail = sum(pool.filter(p => t.ts - p.ts <= holdMs), p => p.a); if (avail < 0.01) continue;
        let want = Math.min(t.dr, avail);
        if (st.taintRule === 'PROPORTIONAL' && t.bal != null) { const before = t.bal + t.dr; const pAll = sum(pool, p => p.a); want = before > 0 ? Math.min(t.dr, t.dr * Math.min(1, pAll / before)) : want; }
        if (want < 0.01) continue;
        const parts = []; let need = want;
        for (const p of pool) { if (need < 0.005) break; if (p.a < 0.005 || t.ts - p.ts > holdMs) continue; const x = Math.min(p.a, need); p.a -= x; need -= x; const q = parts.find(z => z.o === p.o); if (q) q.a += x; else parts.push({ o: p.o, a: x }); }
        for (let k = pool.length - 1; k >= 0; k--) if (pool[k].a < 0.005) pool.splice(k, 1);
        const lastArr = arr.filter(a => a.pos <= i).map(a => a.ts).pop();
        if (maxL && myLayer >= maxL) { tOut += want; ext += 0; const f = { id: 'F' + (flows.length + 1), fromAcct: acctId, debit: t.id, amt: round2(want), full: t.dr, ts: t.ts, hasTime: t.hasTime, parts, layerFrom: myLayer, toExt: { kind: 'LIMIT', label: 'Trace depth limit reached' }, strength: 'LIMIT', reasons: ['Maximum layer depth setting reached'] }; flows.push(f); out.push(f); continue; }
        const f = emit(acctId, myLayer, t, want, parts, lastArr); out.push(f); tOut += want;
        if (f.toExt) { if (f.toExt.kind === 'CASH') cash += want; else if (f.toExt.kind === 'CARD') card += want; else ext += want; }
        if (f.toAcct) { if (!queue.includes(f.toAcct)) queue.push(f.toAcct); if (f.pending) pend += want; }
      }
      if (t.bal != null) { const tot = sum(pool, p => p.a); const cap = Math.max(0, t.bal); if (tot > cap + 0.01) { const r = cap / tot; pool.forEach(p => p.a *= r); } }
    }
    while (ai < arr.length) addArr(arr[ai++]);
    const retained = sum(pool, p => p.a);
    flowOut.set(acctId, out);
    acctRes.set(acctId, { layer: myLayer, tin: round2(tIn), tout: round2(tOut), cash: round2(cash), card: round2(card), ext: round2(ext), pend: round2(pend), retained: round2(retained), firstIn, origins: uniq(arr.flatMap(a => a.parts.map(p => p.o))), fromAccts: uniq(arr.map(a => a.from)), hasStmt: list.length > 0 });
  }
  const live = flows.filter(f => !f.dead);
  // accounts that received traced money but have no statement
  for (const f of live) if (f.toAcct && !IX.txByAcct.has(f.toAcct)) {
    const r = acctRes.get(f.toAcct) || { layer: f.layerFrom + 1, tin: 0, tout: 0, cash: 0, card: 0, ext: 0, pend: 0, retained: 0, origins: [], fromAccts: [], hasStmt: false };
    r.tin = round2(sum(live.filter(x => x.toAcct === f.toAcct), x => x.amt)); r.origins = uniq(live.filter(x => x.toAcct === f.toAcct).flatMap(x => x.parts.map(p => p.o))); r.fromAccts = uniq(live.filter(x => x.toAcct === f.toAcct).map(x => x.fromAcct)); r.layer = layer.get(f.toAcct); acctRes.set(f.toAcct, r);
  }
  const loss = round2(sum(seeds, s => s.dr));
  const byLayer = new Map(); for (const [id, r] of acctRes) { const l = r.layer; if (!byLayer.has(l)) byLayer.set(l, { accts: 0, tin: 0, retained: 0, cash: 0 }); const b = byLayer.get(l); b.accts++; b.tin += r.tin; b.retained += r.retained; b.cash += r.cash; }
  const originAcct = new Map(seeds.map(s => [s.id, s.acctId]));
  const tot = {
    loss, seeds: seeds.length, compAccts: compIds.size,
    traced: round2(sum(live.filter(f => f.toAcct && f.layerFrom === 0), f => f.amt)),
    cash: round2(sum(Array.from(acctRes.values()), r => r.cash) + sum(seedFlows.filter(f => f.toExt && f.toExt.kind === 'CASH'), f => f.amt)),
    retained: round2(sum(Array.from(acctRes.values()), r => r.retained)),
    unresolved: round2(sum(live.filter(f => f.toExt && f.toExt.kind === 'EXT'), f => f.amt)),
    pending: round2(sum(live.filter(f => f.pending), f => f.amt)),
    maxLayer: Math.max(0, ...Array.from(acctRes.values()).map(r => r.layer || 0))
  };
  const multiVictim = Array.from(acctRes.entries()).filter(([, r]) => uniq(r.origins.map(o => originAcct.get(o))).length > 1 || r.fromAccts.filter(x => compIds.has(x)).length > 1);
  S.derived = { L, flows: live, acctRes, layer, seeds, tot, byLayer, compIds, originAcct, multiVictim, at: Date.now() };
  return S.derived;
}
function D() { if (!S.derived) runTrail(); return S.derived; }
function acctLayer(id) { const d = D(); const r = d.acctRes.get(id); if (d.compIds.has(id)) return 0; return r ? r.layer : null; }

/* forward / backward traces for one transaction */
function traceForward(txId, depth = 99) {
  const d = D(); const out = []; const seenF = new Set();
  const start = d.flows.filter(f => f.debit === txId); const seedOrigin = d.seeds.some(s => s.id === txId) ? txId : null;
  let frontier = start.slice(); let lvl = 0;
  if (!start.length) { const m = d.L.R.get(txId); const t = IX.txById.get(txId); if (t && t.cr) frontier = d.flows.filter(f => f.fromAcct === t.acctId && f.ts >= t.ts); }
  while (frontier.length && lvl < depth) {
    const next = [];
    for (const f of frontier) { if (seenF.has(f.id)) continue; seenF.add(f.id); if (seedOrigin && !f.parts.some(p => p.o === seedOrigin)) continue; out.push(Object.assign({ depth: lvl }, f)); if (f.toAcct) next.push(...d.flows.filter(x => x.fromAcct === f.toAcct && (!seedOrigin || x.parts.some(p => p.o === seedOrigin)))); }
    frontier = next; lvl++;
  }
  return out;
}
function traceBackward(txId) {
  const d = D(); const t = IX.txById.get(txId); if (!t) return [];
  const chain = []; let cur = t; const seen = new Set();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    const debitId = cur.cr ? d.L.R.get(cur.id) : null;
    if (cur.cr && debitId) { const dt = IX.txById.get(debitId); const m = d.L.M.get(debitId); chain.push({ debit: dt, credit: cur, m }); cur = dt; }
    else if (cur.dr) { // which credit(s) funded this debit: look at flows
      const f = d.flows.find(x => x.debit === cur.id); if (!f || d.compIds.has(cur.acctId)) break;
      const arr = d.flows.filter(x => x.toAcct === cur.acctId && x.credit && IX.txById.get(x.credit) && IX.txById.get(x.credit).ord <= cur.ord).sort((a, b) => IX.txById.get(b.credit).ord - IX.txById.get(a.credit).ord);
      if (!arr.length) break; cur = IX.txById.get(arr[0].credit);
    } else break;
  }
  return chain;
}
