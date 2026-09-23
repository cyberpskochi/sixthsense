/* =========================== IP INTELLIGENCE ===========================
   Transaction → login session (bank IP log) → IPDR (ISP/telecom) → subscriber
   number → account holder / CDR. Also: IPs and devices shared across accounts,
   complainant account accessed from IPs outside its own baseline.            */
function IPX() {
  const d = D(); if (d.ipx) return d.ipx;
  const c = S.cur, st = c.work.settings;
  const logs = c.ip.logs.slice().sort((a, b) => a.ts - b.ts);
  const byAcct = groupBy(logs.filter(l => l.acctId), l => l.acctId);
  const byUtr = new Map(); for (const l of logs) if (l.utr) byUtr.set(normUtr(l.utr), l);
  const ipdrByIp = groupBy(c.ip.ipdr, r => r.ip);
  const tolMs = (st.ipdrTolMin || 2) * 60000;
  function resolve(ip, ts, port) {
    const rows = ipdrByIp.get(ip) || []; const hit = rows.filter(r => ts >= r.start - tolMs && ts <= r.end + tolMs);
    if (!hit.length) return null;
    const withPort = port ? hit.filter(r => r.port && port >= r.port && port <= (r.portEnd || r.port)) : [];
    const use = withPort.length ? withPort : hit; const nums = uniq(use.map(r => r.msisdn));
    return { rows: use, nums, portMatched: !!withPort.length, ambiguous: nums.length > 1, note: !port ? 'Source port not available — result may cover several subscribers on NAT' : withPort.length ? 'IP + port + time matched' : 'Port did not match any session; IP + time only' };
  }
  const txLogin = new Map(); const sessionMs = (st.ipSessionMin || 30) * 60000;
  const relevantTx = c.txns.filter(t => t.dr > 0 && byAcct.has(t.acctId));
  for (const t of relevantTx) {
    let l = null, how = '', gap = null;
    for (const k of [normUtr(t.utr), normUtr(t.ref), normUtr(t.txnId)]) if (k && byUtr.has(k)) { l = byUtr.get(k); how = 'EXACT — login log carries this transaction reference'; break; }
    const list = byAcct.get(t.acctId);
    if (!l && t.hasTime) {
      let lo = 0, hi = list.length; while (lo < hi) { const m = (lo + hi) >> 1; if (list[m].ts <= t.ts) lo = m + 1; else hi = m; }
      const cand = list[lo - 1]; if (cand && t.ts - cand.ts <= sessionMs) { l = cand; gap = t.ts - cand.ts; how = `SESSION — last login ${durTxt(gap)} before the transaction`; }
    }
    if (!l && !t.hasTime) { const day = isoDate(t.ts); const same = list.filter(x => isoDate(x.ts) === day); if (same.length) { l = same[same.length - 1]; how = `SAME DAY — transaction time unavailable; ${same.length} login(s) that day`; } }
    if (!l) continue;
    txLogin.set(t.id, { log: l, how, gap, ip: l.ip, port: l.port, cls: ipClass(l.ip), ipdr: resolve(l.ip, l.ts, l.port) });
  }
  // shared IPs / devices across accounts
  const ipAcc = new Map(); const devAcc = new Map();
  for (const l of logs) { if (!l.acctId) continue; if (!ipAcc.has(l.ip)) ipAcc.set(l.ip, new Map()); const m = ipAcc.get(l.ip); if (!m.has(l.acctId)) m.set(l.acctId, []); m.get(l.acctId).push(l.ts);
    if (l.device && l.device.length > 5) { if (!devAcc.has(l.device)) devAcc.set(l.device, new Set()); devAcc.get(l.device).add(l.acctId); } }
  const sharedIp = Array.from(ipAcc.entries()).filter(([, m]) => m.size >= 2).map(([ip, m]) => {
    const accts = Array.from(m.keys()); const times = Array.from(m.values());
    let close = Infinity; for (let i = 0; i < times.length; i++) for (let j = i + 1; j < times.length; j++) for (const a of times[i]) for (const b of times[j]) close = Math.min(close, Math.abs(a - b));
    return { ip, accts, cls: ipClass(ip), close, n: sum(times, x => x.length), comp: accts.some(a => (IX.acctById.get(a) || {}).role === 'Complainant') };
  }).sort((a, b) => (b.comp - a.comp) || a.close - b.close);
  const sharedDev = Array.from(devAcc.entries()).filter(([, s]) => s.size >= 2).map(([dev, s]) => ({ dev, accts: Array.from(s) }));
  // complainant baseline vs disputed sessions
  const seeds = D().seeds; const compAlerts = [];
  for (const cid of D().compIds) {
    const list = byAcct.get(cid) || []; const firstSeed = Math.min(...seeds.filter(s => s.acctId === cid).map(s => s.ts));
    const base = new Set(list.filter(l => l.ts < firstSeed - 864e5).map(l => l.ip));
    for (const s of seeds.filter(s => s.acctId === cid)) { const lg = txLogin.get(s.id); if (!lg) continue; const newIp = !base.has(lg.ip); const other = ipAcc.has(lg.ip) ? Array.from(ipAcc.get(lg.ip).keys()).filter(a => a !== cid) : []; if (newIp || other.length) compAlerts.push({ tx: s.id, ip: lg.ip, newIp, baseline: base.size, otherAccts: other }); }
  }
  // IPDR requisitions: public IPs tied to relevant logins without resolution
  const req = new Map();
  const relevantAccts = new Set([...D().compIds, ...D().acctRes.keys()]);
  for (const [txId, lg] of txLogin) { const t = IX.txById.get(txId); if (!relevantAccts.has(t.acctId) && !c.work.disputed.includes(txId)) continue; if (lg.ipdr || !['public', 'v6', 'cgnat'].includes(lg.cls.t)) continue; const k = lg.ip + '@' + lg.log.ts; if (!req.has(k)) req.set(k, { ip: lg.ip, ts: lg.log.ts, port: lg.port, cls: lg.cls, accts: new Set(), txns: [] }); req.get(k).accts.add(t.acctId); req.get(k).txns.push(txId); }
  for (const s of sharedIp) for (const a of s.accts) for (const ts of ipAcc.get(s.ip).get(a).slice(0, 3)) { if (resolve(s.ip, ts, null) || !['public', 'v6', 'cgnat'].includes(s.cls.t)) continue; const k = s.ip + '@' + ts; if (!req.has(k)) req.set(k, { ip: s.ip, ts, port: (logs.find(l => l.ip === s.ip && l.ts === ts) || {}).port, cls: s.cls, accts: new Set([a]), txns: [] }); }
  const ipdrPending = Array.from(req.values()).map(r => Object.assign(r, { accts: Array.from(r.accts) })).sort((a, b) => a.ts - b.ts);
  // subscriber numbers resolved from IPDR that are known elsewhere
  const resolvedHits = [];
  for (const [txId, lg] of txLogin) if (lg.ipdr) for (const n of lg.ipdr.nums) { const info = IX.numInfo.get(n); resolvedHits.push({ tx: txId, ip: lg.ip, num: n, info, acctOwnNum: acctNumbers(IX.acctById.get(IX.txById.get(txId).acctId)).includes(n) }); }
  d.ipx = { logs, byAcct, txLogin, sharedIp, sharedDev, compAlerts, ipdrPending, resolvedHits, resolve };
  return d.ipx;
}
