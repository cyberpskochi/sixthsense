/* ============================ DEMO CASE (synthetic only) ============================
   Clearly marked DEMO, stored under its own Case ID, never mixed with real data.
   Scenario: "digital arrest" fraud — complainant loses money from 2 accounts to
   50 Layer-1 accounts, onward to 100 Layer-2 and 5 Layer-3 aggregator accounts,
   with KYC, login IP logs, IPDR, CDR (registered + alternate numbers) and OTP SMS. */
const DEMO_ATMS = [
  { atmId: 'DM1JMT0011', bank: 'State Bank of India', address: 'Main Road, near Bus Stand (DEMO)', city: 'Jamtara', district: 'Jamtara', state: 'Jharkhand', lat: 23.9626, lon: 86.8034 },
  { atmId: 'DM2JMT0042', bank: 'Punjab National Bank', address: 'Karmatanr Chowk (DEMO)', city: 'Karmatanr', district: 'Jamtara', state: 'Jharkhand', lat: 24.0120, lon: 86.7290 },
  { atmId: 'DM1KOL0107', bank: 'Axis Bank', address: 'Esplanade (DEMO)', city: 'Kolkata', district: 'Kolkata', state: 'West Bengal', lat: 22.5646, lon: 88.3510 },
  { atmId: 'DM3KOL0219', bank: 'HDFC Bank', address: 'Salt Lake Sector V (DEMO)', city: 'Kolkata', district: 'North 24 Parganas', state: 'West Bengal', lat: 22.5760, lon: 88.4330 },
  { atmId: 'DM1NUH0033', bank: 'Canara Bank', address: 'Punhana Road (DEMO)', city: 'Nuh', district: 'Nuh', state: 'Haryana', lat: 28.1039, lon: 77.0017 },
  { atmId: 'DM2BTP0058', bank: 'Bank of Baroda', address: 'Kaman (DEMO)', city: 'Bharatpur', district: 'Bharatpur', state: 'Rajasthan', lat: 27.6560, lon: 77.2700 },
  { atmId: 'DM1DGH0071', bank: 'State Bank of India', address: 'Tower Chowk (DEMO)', city: 'Deoghar', district: 'Deoghar', state: 'Jharkhand', lat: 24.4854, lon: 86.6947 }
];
async function buildDemoCase() {
  let seed = 20260818; const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)); const pick = a => a[Math.floor(rnd() * a.length)];
  const FN = ['ARJUN', 'RAHUL', 'VISHNU', 'AKHIL', 'SREEJITH', 'ANAND', 'RIYAS', 'FAIZAL', 'NIKHIL', 'MANU', 'JITHIN', 'SUDHEER', 'RAKESH', 'IMRAN', 'DEEPAK', 'SANJAY', 'KIRAN', 'ROHIT', 'AMAL', 'SHIJU', 'PRIYA', 'ANJALI', 'NEHA', 'FATHIMA', 'DIVYA'];
  const LN = ['KUMAR', 'NAIR', 'SINGH', 'SHARMA', 'KHAN', 'YADAV', 'PATEL', 'DAS', 'VERMA', 'MENON', 'GUPTA', 'ALI', 'JOSEPH', 'MISHRA', 'REDDY'];
  const bankList = ['SBI', 'HDFC', 'ICICI', 'AXIS', 'FEDERAL', 'KOTAK', 'BOB', 'CANARA', 'UNION', 'IDFC', 'YES', 'INDIAN', 'PNB', 'IPPB', 'AU'];
  const ifscFor = code => { const b = bankByCode(code); return (b.ifsc || 'DEMO') + '0' + String(ri(100000, 999999)); };
  const mob = () => String(ri(6, 9)) + String(ri(100000000, 999999999));
  const acno = () => String(ri(1, 9)) + Array.from({ length: ri(10, 14) }, () => ri(0, 9)).join('');
  const utr12 = () => String(ri(6, 6)) + Array.from({ length: 11 }, () => ri(0, 9)).join('');
  await createCase({ id: 'DEMO-CASE', crimeNo: 'DEMO Cr. No. 999/2026', ps: 'DEMO Police Station', district: 'Ernakulam', io: 'DEMO Inspector', type: 'Digital Arrest', regDate: '2026-08-20', status: 'Under Investigation', conf: 'CONFIDENTIAL', remarks: 'SYNTHETIC DEMO DATA — NOT REAL INVESTIGATION DATA', demo: true });
  const c = S.cur; const imp = nextId('IMP'); c.work.imports.push({ id: imp, file: 'DEMO_SYNTHETIC_DATA', size: 0, hash: 'demo', kind: 'demo', type: 'SYNTHETIC', bank: '', at: nowStamp(), by: S.user.email, added: 0, dups: 0, rejects: [], rejectCount: 0, accts: [], reviewed: false, balFails: 0, ocrPages: 0 });
  const T0 = mkTs(2026, 8, 18, 10, 0, 0); const MIN = 60000, DAY = 864e5;
  const ev = new Map(); // acctId -> events
  const mkA = (role, bank, extra = {}) => { const a = ensureAcct(acno(), { holder: pick(FN) + ' ' + pick(LN), bank: bankByCode(bank).name, ifsc: ifscFor(bank), role }); a.role = role; a.mobiles.push(mob()); Object.assign(a, extra); a._bank = bank; ev.set(a.id, []); return a; };
  const push = (a, e) => ev.get(a.id).push(e);
  const narr = (ch, utr, to, dir) => ch === 'IMPS' ? `IMPS/P2A/${utr}/${to.holder.split(' ')[0]}/${to._bank}/${dir === 'DR' ? (rnd() < .5 ? 'XXXXXXXX' + to.acctNo.slice(-4) : to.acctNo) : 'FROM'}` : ch === 'NEFT' ? `NEFT-${to.ifsc.slice(0, 4)}N${utr.slice(1)}-${to.holder}-${dir === 'DR' ? to.acctNo : ''}` : `UPI/${dir}/${utr}/${to.holder.split(' ')[0]}/${to._bank}/${(to.kyc.upi || ['x@upi'])[0]}`;
  // complainant
  const comp1 = mkA('Complainant', 'SBI', { holder: 'DEMO VICTIM MATHEW' }), comp2 = mkA('Complainant', 'HDFC', { holder: 'DEMO VICTIM MATHEW' }); comp2.mobiles = comp1.mobiles.slice(); comp1.emails = ['demo.victim@example.com'];
  const L1 = Array.from({ length: 50 }, () => mkA('', pick(bankList))), L2 = Array.from({ length: 100 }, () => mkA('', pick(bankList))), L3 = Array.from({ length: 5 }, () => mkA('', pick(bankList)));
  [...L1, ...L2, ...L3].forEach(a => { if (rnd() < .35) a.altMobiles.push(mob()); a.kyc.upi = [a.mobiles[0] + '@' + pick(['ybl', 'okaxis', 'paytm', 'ibl', 'oksbi'])]; a.pan = 'DEMO' + String.fromCharCode(65 + ri(0, 25)) + ri(1000, 9999) + 'X'; a.address = ri(1, 400) + ', DEMO NAGAR, ' + pick(['JAMTARA', 'NUH', 'BHARATPUR', 'KOCHI', 'KOLKATA', 'SURAT', 'DEOGHAR']); });
  // shared identifiers (possible matches)
  L1[3].altMobiles.push(L1[7].mobiles[0]); L2[10].mobiles[0] = L1[12].mobiles[0]; L2[11].pan = L1[12].pan; L3[0].altMobiles.push(L2[5].mobiles[0]);
  // opening balances & background activity
  for (const [id, list] of ev) { const a = IX.acctById.get(id); a._open = a.role === 'Complainant' ? 2500000 : ri(200, 8000);
    for (let k = 0; k < ri(4, 12); k++) { const ts = T0 - ri(2, 40) * DAY + ri(0, 600) * MIN; const cr = rnd() < .5; const amt = ri(50, 2500); list.push({ ts, dr: cr ? 0 : amt, cr: cr ? amt : 0, ch: 'UPI', narr: `UPI/${cr ? 'CR' : 'DR'}/${utr12()}/${pick(FN)}/${pick(['SWIGGY', 'ZOMATO', 'RECHARGE', 'SHOP', 'SELF'])}`, utr: '' }); } }
  // micro validation credits into some L1
  for (const a of L1.slice(0, 14)) push(a, { ts: T0 - ri(1, 3) * DAY + ri(0, 500) * MIN, cr: 1, dr: 0, ch: 'IMPS', narr: `IMPS/P2A/${utr12()}/ACCOUNT VALIDATION/PENNYDROP`, utr: '' });
  // dormant accounts: one old credit long before the fraud period
  for (const a of [L1[5], L1[9], L2[3]]) push(a, { ts: T0 - ri(200, 260) * DAY, cr: ri(500, 3000), dr: 0, ch: 'UPI', narr: `UPI/CR/${utr12()}/${pick(FN)}/SALARY`, utr: '' });
  // SEEDS: 60 disputed debits from 2 complainant accounts to 50 L1
  const seedsIdx = []; let t = T0;
  for (let i = 0; i < 60; i++) {
    const to = L1[i < 50 ? i : ri(0, 9)]; const from = i % 3 === 2 ? comp2 : comp1; const amt = ri(20, 160) * 1000 + (rnd() < .3 ? ri(1, 9) * 100 : 0);
    t += ri(4, 22) * MIN; if (i === 30) t = T0 + DAY + 60 * MIN; const ch = pick(['IMPS', 'IMPS', 'NEFT', 'UPI']); const u = ch === 'NEFT' ? from.ifsc.slice(0, 4) + 'N' + ri(10000000000, 99999999999) : utr12();
    push(from, { ts: t, dr: amt, cr: 0, ch, narr: narr(ch, u, to, 'DR'), utr: u, seed: true });
    push(to, { ts: t + ri(0, 2) * MIN, dr: 0, cr: amt, ch, narr: narr(ch, u, from, 'CR'), utr: u, _in: true });
    seedsIdx.push({ from, to, ts: t, amt });
  }
  // L1 -> L2 forwarding
  const l1Out = new Map();
  for (const s of seedsIdx) {
    const a = s.to; let rem = s.amt; let tt = s.ts + ri(6, 70) * MIN; const n = ri(1, 3);
    for (let k = 0; k < n && rem > 2000; k++) {
      if (rnd() < .12) { const w = Math.min(rem, ri(10, 40) * 1000); push(a, { ts: tt, dr: w, cr: 0, ch: 'ATM', narr: `ATM WDL/${pick(DEMO_ATMS).atmId}/DEMO ATM CASH`, utr: '' }); rem -= w; tt += ri(5, 40) * MIN; continue; }
      const to = L2[(L1.indexOf(a) * 2 + k) % 100]; const amt = k === n - 1 ? Math.round(rem * (rnd() < .2 ? .7 : .98)) : Math.round(rem * (0.3 + rnd() * .4)); rem -= amt;
      const mode = rnd(); const u = utr12();
      if (mode < .7) { push(a, { ts: tt, dr: amt, cr: 0, ch: 'IMPS', narr: narr('IMPS', u, to, 'DR'), utr: u }); if (to._stmt !== false) push(to, { ts: tt + MIN, dr: 0, cr: amt, ch: 'IMPS', narr: narr('IMPS', u, a, 'CR'), utr: u }); }
      else if (mode < .88) { push(a, { ts: tt, dr: amt, cr: 0, ch: 'UPI', narr: `UPI/DR/${u}/${to.holder.split(' ')[0]}/${to.kyc.upi[0]}`, utr: u }); push(to, { ts: tt + MIN, dr: 0, cr: amt, ch: 'UPI', narr: `UPI/CR/${u}/${a.holder.split(' ')[0]}/${a.kyc.upi[0]}`, utr: u }); }
      else { push(a, { ts: tt, dr: amt, cr: 0, ch: 'BANK TRANSFER', narr: `TRF TO ${to.holder}`, utr: '' }); push(to, { ts: tt + 2 * MIN, dr: 0, cr: amt, ch: 'BANK TRANSFER', narr: `BY TRF FROM ${a.holder.split(' ')[0]}`, utr: '' }); }
      l1Out.set(to.id, (l1Out.get(to.id) || 0) + amt); tt += ri(3, 50) * MIN;
    }
  }
  // L2 -> L3 / cash ; NDPS-like weekend pattern in L2[20]
  for (const a of L2) { const list = ev.get(a.id); const ins = list.filter(e => e.cr > 5000 && e.ts >= T0).sort((x, y) => x.ts - y.ts); for (const e of ins) { let rem = e.cr; let tt = e.ts + ri(10, 180) * MIN; if (rnd() < .3) { const w = Math.round(rem * .6); push(a, { ts: tt, dr: w, cr: 0, ch: 'ATM', narr: `ATW-${pick(DEMO_ATMS).atmId}-DEMO ATM`, utr: '' }); rem -= w; tt += 30 * MIN; } if (rnd() < .75) { const to = L3[ri(0, 4)]; const amt = Math.round(rem * .9); const u = utr12(); push(a, { ts: tt, dr: amt, cr: 0, ch: 'IMPS', narr: narr('IMPS', u, to, 'DR'), utr: u }); push(to, { ts: tt + MIN, dr: 0, cr: amt, ch: 'IMPS', narr: narr('IMPS', u, a, 'CR'), utr: u }); } } }
  const nd = L2[20]; for (let w = 0; w < 6; w++) { const sat = mkTs(2026, 7, 4 + w * 7, 0, 0, 0); for (let k = 0; k < ri(3, 5); k++) push(nd, { ts: sat + (k % 2) * DAY + ri(18, 22) * 60 * MIN + ri(0, 59) * MIN, dr: 0, cr: 5000, ch: 'UPI', narr: `UPI/CR/${utr12()}/${pick(FN)}/${mob()}@ybl`, utr: '' }); push(nd, { ts: sat + DAY + 23 * 60 * MIN, dr: 15000, cr: 0, ch: 'ATM', narr: 'ATM WDL/DM1DGH0071/DEMO ATM', utr: '' }); }
  for (const a of L3) for (let k = 0; k < 4; k++) push(a, { ts: T0 + ri(1, 3) * DAY + ri(0, 600) * MIN, dr: ri(20, 60) * 1000, cr: 0, ch: 'ATM', narr: `ATM WDL/${pick(DEMO_ATMS.slice(2, 4)).atmId}/DEMO ATM KOLKATA`, utr: '' });
  // 30 L2 accounts have no statement yet (requisition demo)
  const noStmt = new Set(L2.slice(70).map(a => a.id));
  // materialise transactions with running balances
  let seq = 0;
  for (const [id, list] of ev) {
    if (noStmt.has(id)) continue; const a = IX.acctById.get(id); list.sort((x, y) => x.ts - y.ts); let bal = a._open;
    const need = (() => { let b = a._open, minB = 0; for (const e of list) { b += e.cr - e.dr; minB = Math.min(minB, b); } return -minB; })(); bal += need + (need ? ri(100, 900) : 0);
    const opening = bal;
    list.forEach((e, i) => { bal = round2(bal + e.cr - e.dr); const x = extractNarr(e.narr); c.txns.push({ id: nextId('TX'), acctId: id, imp, seq: i, ts: e.ts, hasTime: !(a._bank === 'CANARA' || a._bank === 'IPPB'), vdate: null, dr: e.dr, cr: e.cr, bal, narr: e.narr, ref: '', utr: e.utr || x.utr, txnId: '', channel: e.ch, upi: x.upi, cpAcct: x.cpAcct, cpMasked: x.cpMasked, cpIfsc: x.ifsc, cpMobile: x.mobile, cpName: x.cpName, src: { file: 'DEMO_' + a._bank + '_' + a.acctNo + '.xlsx', sheet: 'Statement', page: null, row: i + 2 }, raw: e.narr, flags: (a._bank === 'CANARA' || a._bank === 'IPPB') ? ['NO_TIME'] : [], conf: 1, parser: 'demo' }); if (e.seed) c.work.disputed.push(c.txns[c.txns.length - 1].id); });
    a._opening = opening;
  }
  // time-unavailable banks: drop the time component
  for (const tx of c.txns) if (!tx.hasTime) { const d = new Date(tx.ts); tx.ts = mkTs(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); }
  reorderAll(); rebuildIndexes(); for (const a of c.accts) { const l = IX.txByAcct.get(a.id); if (l) a.stmt = stmtStats(a, l, { opening: a._opening }); delete a._open; delete a._opening; delete a._stmt; }
  // IP logs
  const attackerIp = '49.36.12.34', attackerPort = 40211; const homeIp = () => '117.216.' + ri(10, 250) + '.' + ri(2, 250);
  for (let dday = 30; dday > 1; dday -= ri(1, 3)) c.ip.logs.push({ id: nextId('IPL'), acctId: comp1.id, custId: 'DEMO' + comp1.acctNo.slice(-5), ts: T0 - dday * DAY + ri(8, 21) * 3600000, hasTime: true, ip: homeIp(), port: null, channel: 'YONO', device: 'SM-A515F', event: 'LOGIN', utr: '', src: { file: 'DEMO_SBI_IPLOG.xlsx', row: 2 } });
  const seedTx = c.work.disputed.map(id => IX.txById.get(id));
  seedTx.forEach((s, i) => c.ip.logs.push({ id: nextId('IPL'), acctId: s.acctId, custId: '', ts: s.ts - ri(1, 6) * MIN, hasTime: true, ip: i % 4 === 3 ? '100.64.' + ri(1, 200) + '.' + ri(1, 200) : attackerIp, port: attackerPort + (i % 5), channel: s.acctId === comp1.id ? 'YONO' : 'NETBANKING', device: 'DEMO-ANDROID-7731', event: 'LOGIN', utr: '', src: { file: 'DEMO_IPLOG.xlsx', row: i + 2 } }));
  for (const a of [...L1, ...L2.slice(0, 70), ...L3]) { const l = IX.txByAcct.get(a.id) || []; for (const tx of l.filter(x => x.dr > 5000 && x.hasTime).slice(0, 4)) c.ip.logs.push({ id: nextId('IPL'), acctId: a.id, custId: '', ts: tx.ts - ri(1, 8) * MIN, hasTime: true, ip: L1.indexOf(a) >= 0 && L1.indexOf(a) < 4 ? attackerIp : L1.indexOf(a) >= 4 && L1.indexOf(a) < 12 ? '157.49.' + (L1.indexOf(a) % 3) + '.77' : '106.' + ri(192, 223) + '.' + ri(1, 250) + '.' + ri(1, 250), port: ri(20000, 60000), channel: 'MOBILE BANKING', device: L1.indexOf(a) >= 0 && L1.indexOf(a) < 6 ? 'DEMO-ANDROID-7731' : 'DEV-' + ri(1000, 9999), event: 'LOGIN', utr: '', src: { file: 'DEMO_IPLOG_' + a._bank + '.xlsx', row: 2 } }); }
  // IPDR: attacker IP resolves to an alternate number of an L1 holder
  const culpritNum = L1[7].altMobiles[0] || (L1[7].altMobiles.push(mob()), L1[7].altMobiles[0]); const callerNum = mob();
  for (let k = 0; k < 5; k++) c.ip.ipdr.push({ id: nextId('IPDR'), msisdn: culpritNum, name: 'DEMO SUBSCRIBER', ip: attackerIp, privIp: '10.' + ri(1, 200) + '.1.' + ri(2, 200), port: attackerPort + k, portEnd: attackerPort + k, start: T0 - 30 * MIN, end: T0 + 2 * DAY, destIp: '203.0.113.' + ri(1, 99), destPort: 443, imei: '35' + ri(1000000000000, 9999999999999), imsi: '4045' + ri(10000000000, 99999999999), cell: '404-45-' + ri(1000, 9999), addr: 'DEMO SITE, JAMTARA', src: { file: 'DEMO_IPDR.xlsx', row: k + 2 } });
  // investigation number: the caller who contacted the complainant
  c.work.numbers.push({ id: nextId('MOB'), num: callerNum, role: 'Suspect', source: 'Complainant statement (video call as "CBI officer")', person: 'Unknown caller', remarks: 'Digital-arrest caller', added: nowStamp() });
  c.work.numbers.push({ id: nextId('MOB'), num: comp1.mobiles[0], role: 'Victim', source: 'Complaint', person: 'Complainant', remarks: '', added: nowStamp() });
  // CDR
  const imeiShared = '3567' + ri(1000000000, 9999999999);
  const cdrOf = (target, rows) => rows.forEach(r => c.telecom.cdr.push(Object.assign({ i: c.telecom.cdr.length, target, imp, hasTime: true, kind: 'CALL', dur: ri(20, 900), cell: '404-45-' + ri(1000, 1010), lastCell: '', lac: '4501', imei: '', imsi: '', roam: '', op: 'DEMO-TSP', addr: 'DEMO SITE', lat: null, lon: null, src: { file: 'DEMO_CDR_' + target + '.xlsx', row: 2 } }, r)));
  const vict = comp1.mobiles[0]; const vr = [];
  for (let k = 0; k < 18; k++) vr.push({ other: callerNum, dir: k % 3 ? 'IN' : 'OUT', ts: T0 - 90 * MIN + k * 25 * MIN + ri(0, 5) * MIN });
  for (let k = 0; k < 40; k++) vr.push({ other: mob(), dir: pick(['IN', 'OUT']), ts: T0 - ri(1, 20) * DAY + ri(0, 800) * MIN });
  cdrOf(vict, vr);
  const cr = []; for (let k = 0; k < 18; k++) cr.push({ other: vict, dir: k % 3 ? 'OUT' : 'IN', ts: T0 - 90 * MIN + k * 25 * MIN + ri(0, 5) * MIN, imei: imeiShared, cell: '404-45-2201' });
  const common = [mob(), mob(), mob()];
  for (let k = 0; k < 30; k++) cr.push({ other: pick([culpritNum, L1[0].mobiles[0], L1[1].mobiles[0], ...common]), dir: pick(['IN', 'OUT']), ts: T0 - ri(0, 5) * DAY + ri(0, 900) * MIN, imei: imeiShared, cell: '404-45-2201' });
  cdrOf(callerNum, cr);
  const ur = []; for (let k = 0; k < 25; k++) ur.push({ other: pick([callerNum, ...common, mob()]), dir: pick(['IN', 'OUT']), ts: T0 - ri(0, 5) * DAY + ri(0, 900) * MIN, imei: imeiShared, cell: '404-45-2201' });
  cdrOf(culpritNum, ur);
  for (const a of L1.slice(0, 6)) { const rr = []; for (let k = 0; k < 20; k++) rr.push({ other: pick([...common, mob(), mob(), a === L1[0] ? callerNum : mob()]), dir: pick(['IN', 'OUT']), ts: T0 - ri(0, 4) * DAY + ri(0, 900) * MIN, imei: '35' + a.acctNo.slice(-12).padStart(12, '1') }); cdrOf(a.mobiles[0], rr); }
  // bank SMS + locations at money-movement times (for CDR location intelligence)
  const SITES = [['404-45-2201', 'Karmatanr Main Road, Jamtara (DEMO)', 24.012, 86.729], ['404-45-3302', 'Station Road, Deoghar (DEMO)', 24.485, 86.695], ['404-45-1177', 'Esplanade, Kolkata (DEMO)', 22.565, 88.351], ['404-45-5120', 'Punhana, Nuh (DEMO)', 28.104, 77.002]];
  const hdrOf = a => 'VM-' + ((bankByIfsc(a.ifsc) || {}).code || 'BANK').slice(0, 6) + 'BK';
  const vs = []; for (const s0 of c.work.disputed.map(id => IX.txById.get(id)).filter(Boolean)) vs.push({ other: hdrOf(IX.acctById.get(s0.acctId)), dir: 'IN', kind: 'SMS', ts: s0.ts + ri(10, 50) * 1000, cell: '404-45-9001', addr: 'Kakkanad, Kochi (DEMO)', lat: 10.015, lon: 76.341 });
  cdrOf(vict, vs);
  L1.slice(0, 12).forEach((a, i) => { const site = SITES[i < 7 ? 0 : i % SITES.length]; const rr = [];
    for (const t of (IX.txByAcct.get(a.id) || []).filter(t => (t.cr > 5000 || t.dr > 5000) && t.ts >= T0 - DAY)) {
      const base = t.hasTime ? t.ts : t.ts + (10 + rr.length) * 3600000;
      rr.push({ other: hdrOf(a), dir: 'IN', kind: 'SMS', ts: base + ri(5, 60) * 1000, cell: site[0], addr: site[1], lat: site[2], lon: site[3], imei: i < 4 ? imeiShared : '35' + a.acctNo.slice(-12).padStart(12, '1') });
      rr.push({ other: pick(common), dir: 'OUT', ts: base + ri(2, 9) * MIN, cell: site[0], addr: site[1], lat: site[2], lon: site[3], imei: i < 4 ? imeiShared : '35' + a.acctNo.slice(-12).padStart(12, '1') });
    }
    if (rr.length) cdrOf(a.mobiles[0], rr); c.telecom.meta = c.telecom.meta || {}; c.telecom.meta[a.mobiles[0]] = { name: a.holder, role: 'Accused' };
  });
  c.telecom.meta = c.telecom.meta || {}; c.telecom.meta[vict] = { name: 'Complainant', role: 'Victim' };
  // OTP SMS to complainant around seeds
  for (const s of seedTx.filter(s => s.hasTime).slice(0, 25)) c.telecom.sms.push({ id: nextId('SMS'), msisdn: vict, ts: s.ts - ri(30, 110) * 1000, hasTime: true, sender: 'VM-SBIOTP', msg: `DEMO: OTP for transaction of Rs.${s.dr} is ${ri(100000, 999999)}. Do not share.`, otp: 'OTP', amount: s.dr, src: { file: 'DEMO_SMS.xlsx', row: 2 } });
  // a few tasks
  c.work.tasks.push({ id: nextId('TASK'), task: 'Send Sec. 94 BNSS notice to banks for 30 pending Layer-2 statements', officer: 'DEMO SI', acct: '', person: '', due: '2026-09-30', priority: 'High', status: 'PENDING', remarks: '', evidence: '', created: nowStamp(), updated: nowStamp() });
  c.work.tasks.push({ id: nextId('TASK'), task: 'Request IPDR for CGNAT addresses with source ports', officer: 'DEMO ASI', acct: '', person: '', due: '2026-09-28', priority: 'Normal', status: 'IN PROGRESS', remarks: '', evidence: '', created: nowStamp(), updated: nowStamp() });
  for (const a of c.accts) delete a._bank;
  c.work.imports[0].added = c.txns.length;
  rebuildIndexes(); S.derived = null;
  // Synthetic NCRP report derived from the demo trail + reference data for IFSC / ATM views
  c.work.atmInfo = Object.fromEntries(DEMO_ATMS.map(a => [a.atmId, a]));
  const ST = [['Jharkhand', ['Jamtara', 'Deoghar', 'Dhanbad']], ['West Bengal', ['Kolkata', 'Howrah', 'North 24 Parganas']], ['Haryana', ['Nuh', 'Gurugram']], ['Rajasthan', ['Bharatpur', 'Alwar']], ['Bihar', ['Nawada', 'Patna']], ['Uttar Pradesh', ['Mathura', 'Noida']], ['Delhi', ['New Delhi']]];
  c.work.ifscInfo = {};
  for (const a of c.accts) if (a.ifsc && !c.work.ifscInfo[a.ifsc]) { const comp = a.role === 'Complainant'; const [stn, ds] = comp ? ['Kerala', ['Ernakulam']] : pick(ST); const dist = pick(ds); c.work.ifscInfo[a.ifsc] = { ifsc: a.ifsc, bank: a.bank || (bankByIfsc(a.ifsc) || {}).name || '', branch: dist.toUpperCase() + ' MAIN (DEMO)', address: 'DEMO BRANCH ADDRESS', city: dist, district: dist, state: stn, src: 'demo' }; }
  // Synthetic NCRP report in the I4C layout: every row = the credit INTO the layer account (UTR / amount / date)
  // + the action its bank reported (Money Transfer to → beneficiary with onward UTR / amount, ATM, cheque, hold).
  const d = D(); const ncrp = []; const nAck = '31508260023559';
  const inc = new Map(); // acctId → first credit that brought fraud money in
  for (const f of d.flows) { if (!f.toAcct || inc.has(f.toAcct)) continue; const t = IX.txById.get(f.debit) || {}; inc.set(f.toAcct, { utr: t.utr, amt: f.amt, ts: t.ts, hasTime: t.hasTime, L: f.layerFrom + 1 }); }
  const base = (a, L, x) => Object.assign({ ackNo: nAck, layer: L, fromAcct: '', acctNo: a.acctNo, toAcct: '', bank: a.bank, ifsc: a.ifsc, toIfsc: '', toBank: '', utr: x ? x.utr : '', amount: x ? x.amt : 0, disputed: 0, hold: 0, ts: x ? x.ts : null, hasTime: x ? x.hasTime : false, toUtr: '', toAmount: 0, toTs: null, remarks: '', atmId: '', atmPlace: '' });
  for (const f of d.flows) {
    const t = IX.txById.get(f.debit) || {}; const fromA = IX.acctById.get(f.fromAcct); const L = f.layerFrom; if (!fromA) continue;
    if (L === 0 && f.toAcct) { const to = IX.acctById.get(f.toAcct); ncrp.push(Object.assign(base(to, 1, { utr: t.utr, amt: f.amt, ts: t.ts, hasTime: t.hasTime }), { fromAcct: fromA.acctNo, disputed: f.amt, status: 'Disputed transaction', action: '' })); continue; }
    if (L < 1 || L > 3) continue; const x = inc.get(fromA.id);
    if (f.toAcct) { const to = IX.acctById.get(f.toAcct); ncrp.push(Object.assign(base(fromA, L, x), { toAcct: to.acctNo, toIfsc: to.ifsc, toBank: to.bank, toUtr: t.utr || '', toAmount: f.amt, toTs: t.ts, status: 'Money Transfer to', action: 'TRANSFER' })); }
    else if (t.channel === 'ATM') { const id = extractAtmId(t.narr); const at = c.work.atmInfo[id]; ncrp.push(Object.assign(base(fromA, L, x), { toUtr: t.utr || '', toAmount: f.amt, toTs: t.ts, status: 'Withdrawal through ATM', action: 'ATM', atmId: id, atmPlace: at ? at.city + ', ' + at.state : '' })); }
  }
  const holdAccts = uniq(ncrp.filter(r => r.layer <= 2 && r.action === 'TRANSFER').map(r => r.toAcct)).slice(0, 18);
  holdAccts.forEach(no => { const a = IX.acctByKey.get(acctKey(no)); if (!a) return; const x = inc.get(a.id); if (!x) return; const res = d.acctRes.get(a.id) || {}; const h = Math.round(Math.min(res.tin || 20000, 5000 + ri(2, 40) * 1000)); ncrp.push(Object.assign(base(a, x.L, x), { hold: h, toAmount: h, toTs: T0 + 2 * DAY, status: 'Transaction put on hold', action: 'HOLD' })); });
  uniq(ncrp.filter(r => r.layer === 2 && r.action === 'TRANSFER').map(r => r.toAcct)).slice(0, 4).forEach(no => { const a = IX.acctByKey.get(acctKey(no)); if (!a) return; const x = inc.get(a.id); if (!x) return; const amt = Math.min(x.amt, 15000 + ri(1, 30) * 1000); ncrp.push(Object.assign(base(a, x.L, x), { toAmount: amt, toTs: (x.ts || T0) + ri(2, 30) * 3600000, status: 'Withdrawal through Cheque', action: 'CHEQUE', chequeNo: String(100000 + ri(1, 899999)).slice(0, 6), remarks: 'Self cheque encashed at branch' })); });
  ncrp.forEach(r => { r.id = nextId('NCRP'); r.imp = imp; r.src = { file: 'DEMO_NCRP_report.xlsx', sheet: 'Sheet1', row: null }; });
  c.work.ncrp = ncrp;
  PARTS.forEach(p => S.dirty.add(p)); S.derived = null; await audit('Generated synthetic demo case'); await saveNow();
}
