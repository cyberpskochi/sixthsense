/* ============================ 94 BNSS LETTERS ============================
   One notice per recipient (bank, card issuer, wallet / UPI app, telecom operator, ISP), filled
   automatically from the NCRP trail and the bank statements. Output: on-screen preview, PDF and
   Word (.docx) with the station letterhead and a coloured footer band.                         */
const LET = { done: {}, type: 'bank_basic', src: 'all', bank: '', layer: 0, acct: '', s106: false, sel: '', focus: '', excl: new Set() };
const LET_CODE = { bank_basic: 'B94', freeze: 'F106', atm_cctv: 'ATM', cheque: 'CHQ', pos: 'POS', pg_wallet: 'UPI', tsp_cdr: 'CDR', isp_ipdr: 'IPDR' };
/* Wording follows the station's sample notice. Markup: blank line = new paragraph, **bold**, *italic*,
   lines starting with "1." or "-" = numbered list, [[TABLE]] = where the account / transaction table goes. */
const LET_COMMON = `{{agency}} is a Law Enforcement Agency of the Home Department of the Government of Kerala, India.

{{s94}}

{{agency}} is investigating a registered FIR number **{{crimeNo}}** dated **{{firDate}}** under Sections **{{sections}}**, pertaining to charges of **{{charges}}**.`;
const S94_QUOTE = 'Under Section 94 in Bharatiya Nagarik Suraksha Sanhita, 2023, "*Whenever any Court or any officer in charge of a police station considers that the production of any document, electronic communication, including communication devices, which is likely to contain digital evidence or other thing is necessary or desirable for the purposes of any investigation, inquiry, trial or other proceeding under this Sanhita by or before such Court or officer, such Court may issue a summons or such officer may, by a written order, either in physical form or in electronic form, require the person in whose possession or power such document or thing is believed to be, to attend and produce it, or to produce it, at the time and place stated in the summons or order.*"';
const S106_QUOTE = 'Under Section 106 of Bharatiya Nagarik Suraksha Sanhita, 2023, "*Any police officer may seize any property which may be alleged or suspected to have been stolen, or which may be found under circumstances which create suspicion of the commission of any offence.*"';
const S106 = '**In addition, under Section 106 of BNSS, 2023, you are requested to immediately debit-freeze the account(s) listed above and retain / put on hold the amount shown against each account, as the money is suspected to be property connected with the offence, and to intimate the amount put on hold with date and time.**';
const LET_TYPES = {
  bank_basic: { t: 'Bank — KYC, statement & login IP (Sec. 94)', to: 'The Branch Manager\n{{bank}}',
    body: `{{common}}

During the investigation it was found that the cheated money was credited to / routed through the following bank account(s) maintained with your bank, in which fraud transactions have been done.

[[TABLE]]

**Hence, please provide the information and do the needful under Section 94 BNSS, 2023:**

1. Account Opening Form (AOF) and complete KYC documents.
2. Bank account statement from the date of account opening to the current date.
3. Aadhaar, PAN, and mobile number linked to the bank account, along with mobile number change history.
4. Internet banking IP login logs with timestamps (DD/MM/YYYY HH:mm:ss) for the period {{fromDate}} to {{toDate}}.

{{s106}}` },
  freeze: { t: 'Bank — Debit freeze / hold of amount (Sec. 106)', to: 'The Branch Manager\n{{bank}}',
    body: `{{agency}} is a Law Enforcement Agency of the Home Department of the Government of Kerala, India.

${S106_QUOTE}

{{agency}} is investigating a registered FIR number **{{crimeNo}}** dated **{{firDate}}** under Sections **{{sections}}**, pertaining to charges of **{{charges}}**, in which the complainant was cheated of **{{fraudAmount}}**.

During the investigation it was found that the proceeds of the crime were credited to the following bank account(s) maintained with your bank.

[[TABLE]]

**Hence, you are requested to do the needful under Section 106 BNSS, 2023:**

1. Immediately debit-freeze the account(s) listed above without allowing any debit.
2. Retain / put on hold the amount shown against each account.
3. Intimate the available balance and the amount actually put on hold, with date and time.
4. Furnish the KYC documents, account statement and login IP logs of the account(s) under Section 94 BNSS, 2023.

The freeze may be continued until further orders from this office or the competent court.` },
  atm_cctv: { t: 'ATM withdrawal — CCTV footage (Sec. 94)', to: 'The Branch Manager / Nodal Officer\n{{bank}}',
    body: `{{common}}

During the investigation it was found that the cheated money was withdrawn in cash through the ATM(s) of your bank listed below, on the dates and at the times shown.

[[TABLE]]

**Hence, please provide the information and do the needful under Section 94 BNSS, 2023:**

1. CCTV footage of the ATM cabin and its surroundings covering 30 minutes before and after each withdrawal listed above.
2. Electronic Journal (EJ) log of each withdrawal listed above.
3. Exact address of the ATM.

**Kindly preserve the CCTV footage immediately, as it may be overwritten.**` },
  cheque: { t: 'Cheque withdrawal — CCTV footage (Sec. 94)', to: 'The Branch Manager\n{{bank}}',
    body: `{{common}}

During the investigation it was found that the cheated money was withdrawn from the account(s) of your bank by cheque, as listed below.

[[TABLE]]

**Hence, please provide the information and do the needful under Section 94 BNSS, 2023:**

1. CCTV footage of the branch counter covering 30 minutes before and after each cheque withdrawal listed above.
2. Front and back image of each cheque listed above.
3. Name and ID proof of the person who encashed the cheque, as recorded by the branch.

**Kindly preserve the CCTV footage immediately, as it may be overwritten.**` },
  pos: { t: 'Card / POS — merchant & transaction details (Sec. 94)', to: 'The Nodal Officer\n{{bank}}',
    body: `{{common}}

During the investigation it was found that the proceeds of the crime were spent through card / POS transactions from the account(s) of your bank at the merchants listed below.

[[TABLE]]

**Hence, please provide the information and do the needful under Section 94 BNSS, 2023:**

1. Merchant name, MID / TID, acquiring bank and full address of the merchant for each transaction.
2. Card number used, card holder details and the device / channel of the transaction.
3. Invoice / bill details, delivery address and contact number where the merchant is an online store.
4. CCTV footage at the merchant location for the transaction time, where available.` },
  pg_wallet: { t: 'UPI app / wallet / payment gateway (Sec. 94)', to: 'The Nodal Officer / Grievance Officer\n{{bank}}',
    body: `{{common}}

During the investigation it was found that the cheated money was routed through the following UPI IDs / wallet / payment-gateway IDs of your platform.

[[TABLE]]

**Hence, please provide the information and do the needful under Section 94 BNSS, 2023:**

1. KYC of the UPI / wallet user or merchant, with registered mobile number, e-mail ID, PAN and address.
2. Linked bank account(s) with IFSC, and the settlement account of the merchant with settlement statement.
3. Device ID, IMEI and login IP addresses with port and timestamps (DD/MM/YYYY HH:mm:ss) for the period {{fromDate}} to {{toDate}}.
4. Complete transaction history of the above IDs for the same period.

{{s106}}` },
  tsp_cdr: { t: 'Telecom — CDR & CAF of mobile numbers (Sec. 94)', to: 'The Nodal Officer\n{{bank}}',
    body: `{{common}}

During the investigation it was found that the following mobile numbers are linked to the bank accounts that received the proceeds of the crime.

[[TABLE]]

**Hence, please provide the information and do the needful under Section 94 BNSS, 2023:**

1. Call Detail Records (CDR) with cell ID, IMEI and IMSI for the period {{fromDate}} to {{toDate}}.
2. Customer Application Form (CAF), KYC documents and Point-of-Sale details.
3. IMEI-wise usage and the other numbers used in the same handsets.` },
  isp_ipdr: { t: 'Telecom / ISP — IPDR for login IP addresses (Sec. 94)', to: 'The Nodal Officer\n{{bank}}',
    body: `{{common}}

During the investigation it was found that the bank accounts that received the proceeds of the crime were accessed from the following public IP addresses at the times shown.

[[TABLE]]

**Hence, please provide the information and do the needful under Section 94 BNSS, 2023:**

1. Subscriber details (name, address, mobile number, CAF / KYC) of the user to whom each IP address and source port was allotted at the given date and time.
2. IPDR of the session, with the MSISDN, IMEI and cell ID.` }
};
const UPI_PSP = [[/@(ybl|ibl|axl)$/i, 'PhonePe (PSP banks: Yes Bank / ICICI Bank / Axis Bank)'], [/@(okaxis|okhdfcbank|okicici|oksbi)$/i, 'Google Pay (PSP banks: Axis / HDFC / ICICI / SBI)'], [/@(paytm|ptyes|ptaxis|pthdfc|ptsbi)$/i, 'Paytm (One97 Communications Ltd)'], [/@(apl|yapl|rapl)$/i, 'Amazon Pay (India) Pvt Ltd'], [/@upi$/i, 'NPCI BHIM'], [/@(fbl)$/i, 'Federal Bank (UPI)'], [/@(sbi)$/i, 'State Bank of India (UPI)'], [/@(icici|ikwik)$/i, 'ICICI Bank / MobiKwik'], [/@(freecharge)$/i, 'Freecharge'], [/@(jio)$/i, 'Jio Payments'], [/@(kotak)$/i, 'Kotak Mahindra Bank (UPI)'], [/@(hdfcbank)$/i, 'HDFC Bank (UPI)'], [/@(axisbank)$/i, 'Axis Bank (UPI)'], [/@(airtel)$/i, 'Airtel Payments Bank']];
const pspOf = u => { for (const [rx, n] of UPI_PSP) if (rx.test(u)) return n; const h = (String(u).split('@')[1] || '').toLowerCase(); return h ? 'UPI handle @' + h + ' — PSP bank' : 'Wallet / payment gateway'; };
function letterHead() {
  const m = (S.cur || {}).meta || {}; const p = S.prefs.letterhead || {};
  const h = Object.assign({ left: 'STATION HOUSE OFFICER\nCYBER CRIME POLICE STATION\nKOCHI -KERALA', tel: '0484 2956900', mob: '9497932735', email: 'cyberpskochi.pol@kerala.gov.in', agency: 'Cyber Crime Police Station, Kochi City', officer: '', sign: 'Station House Officer\nCyber Crime Police Station\nKochi City', band: 'CYBERCRIME POLICE STATION · KOCHI · KERALA', color: '#E00000', emblem: true, img: '', imgW: 0, imgH: 0 }, p);
  if (p.station && !p.left) h.left = [p.designation || 'STATION HOUSE OFFICER', p.station, p.unit].filter(Boolean).join('\n').toUpperCase(); // settings saved by the earlier version
  h.leftL = String(h.left).split('\n').map(s => s.trim()).filter(Boolean); h.signL = [h.officer].concat(String(h.sign).split('\n')).map(s => (s || '').trim()).filter(Boolean);
  return h;
}
/* ---------------- rows per recipient ---------------- */
const chqNo = n => { const m = String(n || '').toUpperCase().match(/(?:CHQ|CHEQUE|CH\.?Q?)\s*(?:NO\.?)?\s*[:#\-\/]?\s*(\d{6})\b/); return m ? m[1] : ''; };
function inLayer(a) { if (!LET.layer) return true; const l = a ? acctLayer(a.id) : null; return l === LET.layer || (l == null && ((LET.layer === 1 && /L1|accused/i.test(a && a.role || '')) || (LET.layer >= 2 && /suspect/i.test(a && a.role || '')))); }
function letterGroups(type) {
  const c = S.cur; const d = D(); const G = new Map();
  const put = (rec, row) => { rec = rec || 'Unknown'; if (!G.has(rec)) G.set(rec, []); G.get(rec).push(row); };
  const fx = row => !LET.focus || JSON.stringify(row).toUpperCase().includes(LET.focus.toUpperCase());
  if (['bank_basic', 'freeze'].includes(type)) {
    const seen = new Map();
    const add = (acctNo, o) => { const k = acctKey(acctNo); if (!k) return; let r = seen.get(k); if (!r) { r = { key: 'A:' + k, acctNo, ifsc: '', holder: '', bank: '', layer: null, amount: 0, hold: 0, utrs: new Set(), from: null }; seen.set(k, r); } if (o.ifsc && !r.ifsc) r.ifsc = o.ifsc; if (o.holder && !r.holder) r.holder = o.holder; if (o.bank && !r.bank) r.bank = o.bank; if (o.layer != null && (r.layer == null || o.layer < r.layer)) r.layer = o.layer; r.amount += o.amount || 0; r.hold += o.hold || 0; (o.utrs || []).forEach(u => u && r.utrs.add(u)); if (o.ts && (!r.from || o.ts < r.from)) r.from = o.ts; };
    if (LET.src !== 'ncrp') for (const [id, res] of d.acctRes) { const a = IX.acctById.get(id); if (a) add(a.acctNo, { ifsc: a.ifsc, holder: a.holder, bank: a.bank || (GEO.info(a.ifsc) || {}).bank, layer: res.layer, amount: res.tin, ts: res.firstIn }); }
    if (c.work.ncrp.length) { const m = ncrpModel(Object.assign({}, NCRPF, { cash: 0, ack: '' })); for (const n of m.N.values()) if (!n.exit && n.id !== 'VICTIM' && n.layer !== 0) add(n.id, { ifsc: n.ifsc, holder: n.holder, bank: n.bank, layer: n.layer, amount: n.in, hold: n.hold, utrs: n.rows.map(r => r.utr), ts: Math.min(...n.rows.map(r => r.ts || Infinity)) }); }
    for (const r of seen.values()) {
      if (LET.layer && r.layer !== LET.layer) continue; if (LET.acct && acctKey(r.acctNo) !== acctKey(LET.acct)) continue;
      if (/[A-Z]/.test(r.acctNo) && !/^\d+$/.test(r.acctNo)) continue; // wallets / PG IDs go to the UPI / wallet notice
      r.bank = r.bank || (GEO.info(r.ifsc) || {}).bank || 'Unknown bank'; r.utrs = Array.from(r.utrs);
      if (type === 'freeze' && !(r.amount > 0)) continue; if (fx(r)) put(r.bank, r);
    }
  } else if (type === 'atm_cctv') {
    const seenA = new Map(); // the same withdrawal can come from the NCRP report and from the statement
    for (const a of caseAtmRows()) for (const t of a.txns) { const acc = IX.acctByKey.get(acctKey(t.acct)); if (!inLayer(acc)) continue; const tx = t.tx ? IX.txById.get(t.tx) : null;
      const row = { key: 'ATM:' + (t.tx || t.utr || a.atmId + t.ts), atmId: a.atmId, place: a.info ? [a.info.address, a.info.city, a.info.state, a.info.pincode].filter(Boolean).join(', ') : a.place, ts: t.ts, hasTime: tx ? tx.hasTime : true, amount: t.amount, acct: t.acct, ref: (tx && (tx.utr || tx.ref)) || t.utr || '', narr: tx ? tx.narr : '' };
      const dk = acctKey(t.acct) + '|' + Math.round(t.amount || 0) + '|' + Math.floor((t.ts || 0) / 600000); const prev = seenA.get(dk);
      if (prev) { if (!prev.ref && row.ref) prev.ref = row.ref; if (!prev.atmId && row.atmId) prev.atmId = row.atmId; if ((!prev.place || prev.place === '—') && row.place) prev.place = row.place; continue; }
      if (fx(row)) { seenA.set(dk, row); put((a.info || {}).bank || (acc || {}).bank || 'Bank (ATM owner)', row); } }
  } else if (type === 'cheque') {
    for (const r of c.work.ncrp.filter(r => r.action === 'CHEQUE')) { const acc = IX.acctByKey.get(acctKey(r.acctNo)); if (!inLayer(acc)) continue; const row = { key: 'NCHQ:' + r.id, ts: r.ts, hasTime: r.hasTime, chequeNo: r.chequeNo || chqNo(r.remarks), amount: r.amount || r.disputed, acct: r.acctNo, ifsc: r.ifsc || (acc || {}).ifsc || '', remarks: r.remarks || r.status };
      if (fx(row)) put(r.bank || (acc || {}).bank || 'Bank', row); }
    for (const t of c.txns) { if (!(t.dr > 0)) continue; if (!(t.channel === 'CHEQUE' || /\bCHQ\b|CHEQUE|\bCLG\b|CLEARING|CASH\s*WDL.*CHQ|SELF\s*CHQ|TO\s+SELF/i.test(t.narr || ''))) continue; const acc = IX.acctById.get(t.acctId); if (!acc || !inLayer(acc) || acctType(acc) === 'Complainant' || acctType(acc) === 'Other') continue;
      const row = { key: 'TCHQ:' + t.id, ts: t.ts, hasTime: t.hasTime, chequeNo: chqNo(t.narr) || t.ref || '', amount: t.dr, acct: acc.acctNo, ifsc: acc.ifsc, remarks: t.narr };
      if (fx(row)) put(acc.bank || (GEO.info(acc.ifsc) || {}).bank || 'Bank', row); }
  } else if (type === 'pos') {
    for (const t of c.txns) { if (!(t.dr > 0)) continue; if (!(t.channel === 'POS' || t.channel === 'CARD' || /\bPOS\b|ECOM|PUR\//i.test(t.narr || ''))) continue; const acc = IX.acctById.get(t.acctId); if (!acc || !inLayer(acc) || acctType(acc) === 'Complainant') continue;
      const row = { key: 'POS:' + t.id, ts: t.ts, hasTime: t.hasTime, amount: t.dr, acct: acc.acctNo, place: posPlace(t.narr), ref: t.utr || t.ref || '', narr: t.narr };
      if (fx(row)) put(acc.bank || (GEO.info(acc.ifsc) || {}).bank || 'Card-issuing bank', row); }
  } else if (type === 'pg_wallet') {
    const U = anUpiPos(LET.layer === 1 ? 'Layer 1' : ''); for (const u of U.upi) { const row = { key: 'UPI:' + u.upi, acctNo: u.upi, holder: u.names.join(', '), amount: round2(u.dr), credit: round2(u.cr), accts: u.accts, from: null, utrs: [] }; if (fx(row)) put(pspOf(u.upi), row); }
    if (c.work.ncrp.length) { const m = ncrpModel(Object.assign({}, NCRPF, { cash: 0, ack: '' })); for (const n of m.N.values()) if (!n.exit && /[A-Z]/.test(n.id) && !/^\d+$/.test(n.id) && n.id !== 'VICTIM' && (!LET.layer || n.layer === LET.layer)) { const row = { key: 'W:' + n.id, acctNo: n.id, holder: n.holder || '', amount: round2(n.in), accts: [], utrs: n.rows.map(r => r.utr).filter(Boolean), from: Math.min(...n.rows.map(r => r.ts || Infinity)) }; if (fx(row)) put(n.bank && n.bank !== 'Wallet / PG' ? n.bank : 'Payment gateway / wallet', row); } }
  } else if (type === 'tsp_cdr') { for (const x of requisitions().cdr) { const row = Object.assign({ key: 'CDR:' + x.num }, x); if (fx(row)) put('Telecom Service Provider', row); } }
  else if (type === 'isp_ipdr') { const inf = c.work.ipinfo || {}; for (const x of requisitions().ipdr) { const i = inf[x.ip] || {}; const row = Object.assign({ key: 'IP:' + x.ip + x.ts }, x); if (fx(row)) put(i.isp || i.owner || i.org || 'Telecom / ISP', row); } }
  for (const [k, l] of G) { const f = l.filter(r => !LET.excl.has(r.key)); if (f.length) G.set(k, f); else G.delete(k); }
  return G;
}
/* ---------------- structured letter ---------------- */
const dts = (ts, h) => fmtDT(ts, h).replace(/^(\d{2})-(\d{2})-(\d{4})/, '$1/$2/$3');
function letterTableData(type, rows) {
  const amt = v => inr(v).replace('₹', ''); const T = (head, w, r) => ({ head, w, rows: r });
  if (type === 'atm_cctv') return T(['Sl', 'Date & time', 'ATM ID', 'ATM location', 'Amount (₹)', 'Account No.', 'Txn ref / RRN'], [5, 13, 16, 21, 12, 18, 15], rows.sort((a, b) => a.ts - b.ts).map((r, i) => [i + 1, r.ts ? dts(r.ts, r.hasTime) : '—', r.atmId || '—', r.place || '—', amt(r.amount), r.acct, r.ref || '—']));
  if (type === 'cheque') return T(['Sl', 'Date & time', 'Cheque No.', 'Amount (₹)', 'Account No.', 'IFSC / Branch'], [6, 17, 14, 15, 22, 26], rows.sort((a, b) => a.ts - b.ts).map((r, i) => { const inf = GEO.info(r.ifsc) || {}; return [i + 1, r.ts ? dts(r.ts, r.hasTime) : '—', r.chequeNo || '—', amt(r.amount), r.acct, [r.ifsc, inf.branch].filter(Boolean).join(' · ') || '—']; }));
  if (type === 'pos') return T(['Sl', 'Date & time', 'Merchant / place', 'Amount (₹)', 'Account No.', 'Txn ref'], [6, 17, 33, 13, 17, 14], rows.sort((a, b) => a.ts - b.ts).map((r, i) => [i + 1, dts(r.ts, r.hasTime), r.place, amt(r.amount), r.acct, r.ref || '—']));
  if (type === 'tsp_cdr') return T(['Sl', 'Mobile Number', 'Linked to'], [7, 23, 70], rows.map((r, i) => [i + 1, r.num, r.links]));
  if (type === 'isp_ipdr') return T(['Sl', 'IP Address', 'Port', 'Date & time (IST)', 'Date & time (UTC)', 'Account'], [6, 22, 9, 19, 19, 25], rows.map((r, i) => [i + 1, r.ip, r.port || '—', r.ts ? dts(r.ts) : '', r.ts ? new Date(r.ts - 5.5 * 3600000).toISOString().replace('T', ' ').slice(0, 19) : '', (r.accts || []).map(id => (IX.acctById.get(id) || {}).acctNo || id).join(', ')]));
  if (type === 'pg_wallet') return T(['Sl', 'UPI ID / Wallet ID', 'Amount (₹)', 'Linked case accounts'], [6, 38, 16, 40], rows.map((r, i) => [i + 1, r.acctNo, amt(r.amount), (r.accts || []).join(', ') || '—']));
  const hold = type === 'freeze' || LET.s106;
  if (hold) return T(['Sl', 'Account Number', 'IFSC Code', 'Bank Name', 'Layer', 'Amount to hold (₹)'], [6, 26, 17, 26, 9, 16], rows.map((r, i) => [i + 1, r.acctNo, r.ifsc || '—', r.bank || '—', r.layer != null ? 'L' + r.layer : '—', amt(r.hold > 0 ? r.hold : r.amount)]));
  return T(['Sl', 'Account Number', 'IFSC Code', 'Bank Name', 'Layer'], [7, 31, 21, 29, 12], rows.map((r, i) => [i + 1, r.acctNo, r.ifsc || '—', r.bank || '—', r.layer != null ? 'L' + r.layer : '—']));
}
const tplOf = t => { const x = (S.prefs.letterTpl || {})[t]; return x && x.v === 2 ? x : {}; }; // wording saved by the earlier layout is ignored
function fillTpl(txt, v) { return String(txt).replace(/\{\{(\w+)\}\}/g, (_, k) => v[k] != null ? v[k] : ''); }
const dmy = ts => { const d = new Date(ts); return String(d.getUTCDate()).padStart(2, '0') + '/' + String(d.getUTCMonth() + 1).padStart(2, '0') + '/' + d.getUTCFullYear(); };
function parseRich(s) { const out = []; const rx = /\*\*([^*]+)\*\*|\*([^*]+)\*/g; let last = 0, m; s = String(s); while ((m = rx.exec(s))) { if (m.index > last) out.push({ t: s.slice(last, m.index) }); out.push(m[1] != null ? { t: m[1], b: 1 } : { t: m[2], i: 1 }); last = rx.lastIndex; } if (last < s.length) out.push({ t: s.slice(last) }); return out; }
function letterDoc(type, rec, rows, n) {
  const lh = letterHead(); const m = S.cur.meta; const tp = LET_TYPES[type]; const cu = tplOf(type);
  const tsList = rows.map(r => r.from || r.ts).filter(x => x && isFinite(x)); const first = tsList.length ? Math.min(...tsList) : null;
  const fraud = (S.cur.work.ncrp.length ? ncrpModel().fraud : 0) || sum(D().seeds || [], s => s.dr || 0);
  const crime = String(m.crimeNo || m.id).replace(/^\s*(fir|crime|cr)\.?\s*(no\.?)?\s*/i, '');
  const today = Date.now() + 5.5 * 3600000; const reg = /^\d{4}-\d{2}-\d{2}$/.test(m.regDate || '') ? m.regDate.split('-').reverse().join('/') : '__________';
  const v = { bank: rec, crimeNo: crime, firDate: reg, agency: lh.agency, sections: m.sections || '318(4) and 319(2) of the Bharatiya Nyaya Sanhita, 2023 and 66(C), 66(D) of the Information Technology Act, 2000', charges: m.charges || 'Cheating and dishonestly inducing delivery of property and Cheating by personation',
    caseType: m.type || 'cyber fraud', fraudAmount: fraud ? inr(fraud) : 'the amount mentioned in the complaint', fromDate: dmy(first ? first - 30 * 864e5 : today - 30 * 864e5), toDate: dmy(today), date: dmy(today), s94: S94_QUOTE, s106: LET.s106 && type !== 'freeze' ? S106 : '', ps: lh.agency };
  v.common = fillTpl(LET_COMMON, v);
  const blocks = []; let tableAt = false;
  for (const para of fillTpl(fillTpl(cu.body || tp.body, v), v).split(/\n\s*\n/)) {
    const lines = para.split('\n').map(x => x.trim()).filter(Boolean); if (!lines.length) continue;
    if (lines.length === 1 && lines[0] === '[[TABLE]]') { blocks.push({ table: 1 }); tableAt = true; continue; }
    let list = null; const flush = () => { if (list) { blocks.push({ list }); list = null; } };
    for (const l of lines) { const li = l.match(/^(?:\d+[.)]|-)\s+(.*)$/); if (li) { (list = list || []).push(parseRich(li[1])); } else { flush(); blocks.push({ p: parseRich(l) }); } }
    flush();
  }
  if (!tableAt) blocks.push({ table: 1 });
  const sec = type === 'freeze' ? 'UNDER SECTION – 106 B.N.S.S. 2023' : 'UNDER SECTION – 94' + (LET.s106 ? ' & 106' : '') + ' B.N.S.S. 2023';
  return { lh, ref: `No. ${crime}/CCPS-KOCHI/${LET_CODE[type]}-${String(n).padStart(2, '0')}/${new Date().getFullYear()}`, date: v.date, title: 'NOTICE', sec, to: fillTpl(cu.to || tp.to, v).split('\n').map(s => s.trim()).filter(Boolean), blocks, table: letterTableData(type, rows.slice()) };
}
/* ---------------- renderers ---------------- */
const richHtml = runs => runs.map(r => r.b ? `<b>${esc(r.t)}</b>` : r.i ? `<i>${esc(r.t)}</i>` : esc(r.t)).join('');
function letterHeadHtml(L) {
  const lh = L.lh; if (lh.img) return `<img class="lh-img" src="${lh.img}" alt="Letterhead">`;
  return `<div class="lhk" style="--lhc:${esc(lh.color)}">${lh.emblem ? `<img class="lhk-e" src="${KERALA_EMBLEM.src}" alt="Emblem">` : ''}<div class="lhk-r"><div>${lh.leftL.map(esc).join('<br>')}</div><div class="lhk-c">${lh.tel ? `Tel Office: ${esc(lh.tel)}<br>` : ''}${lh.mob ? `Mob &nbsp;&nbsp;&nbsp;: ${esc(lh.mob)}<br>` : ''}${lh.email ? `Email : <u class="lhk-m">${esc(lh.email)}</u><br>` : ''}Date: ${esc(L.date)}</div></div></div>`;
}
function letterHtml(L) {
  return `<div class="letter-page lk">${letterHeadHtml(L)}
    <div class="ltitle">${L.title}<br><span>(${esc(L.sec)})</span></div>
    <div class="lto"><b>To,</b><div>${L.to.map((t, i) => i === L.to.length - 1 ? `<b>${esc(t)}</b>` : esc(t)).join('<br>')}</div></div>
    ${L.blocks.map(b => b.table ? `<table class="lt"><colgroup>${L.table.w.map(w => `<col style="width:${w}%">`).join('')}</colgroup><tr>${L.table.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr>${L.table.rows.map(r => `<tr>${r.map(x => `<td>${esc(String(x ?? ''))}</td>`).join('')}</tr>`).join('')}</table>` : b.p ? `<p>${richHtml(b.p)}</p>` : `<ol>${b.list.map(x => `<li>${richHtml(x)}</li>`).join('')}</ol>`).join('')}
    <div class="lsign">${L.lh.signL.map(s => `<div>${esc(s)}</div>`).join('')}<div>Date: ${esc(L.date)}</div></div>
    <div class="lband">${esc(L.lh.band)}</div></div>`;
}
const hexRgb = h => { const m = String(h || '').replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i); return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [224, 0, 0]; };
const TBL_BLUE = [53, 24, 214], BAND = [22, 32, 90], GOLD = [201, 162, 39];
function lettersPdf(docs, name) {
  docs = JSON.parse(JSON.stringify(docs).replace(/\(₹\)/g, '(Rs.)').replace(/₹\s?/g, 'Rs. ')); // standard PDF fonts have no rupee glyph
  const { jsPDF } = window.jspdf; const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true }); const W = pdf.internal.pageSize.getWidth(), H = pdf.internal.pageSize.getHeight(); const M = 56, FS = 11, LH = 15, F = 'helvetica';
  const sty = r => r.b && r.i ? 'bolditalic' : r.b ? 'bold' : r.i ? 'italic' : 'normal';
  const header = L => { const lh = L.lh;
    if (lh.img) { const w = W - 72, h = Math.min(lh.imgW ? w * lh.imgH / lh.imgW : 100, 150); try { pdf.addImage(lh.img, undefined, 36, 22, w, h, 'lh_img'); } catch (e) { console.warn(e); } return 22 + h + 16; }
    const c = hexRgb(lh.color); let y0 = 20; if (lh.emblem) { const ew = 66, eh = ew * KERALA_EMBLEM.h / KERALA_EMBLEM.w; pdf.addImage(KERALA_EMBLEM.src, 'PNG', W / 2 - ew / 2, y0, ew, eh, 'kl_emblem'); y0 += eh + 8; }
    pdf.setTextColor(...c); pdf.setFont(F, 'normal'); pdf.setFontSize(10.5);
    const right = [lh.tel ? 'Tel Office: ' + lh.tel : '', lh.mob ? 'Mob        : ' + lh.mob : '', lh.email ? 'Email : ' + lh.email : '', 'Date: ' + L.date].filter(Boolean);
    const rx = W / 2 + 70; const n = Math.max(lh.leftL.length, right.length); const top = y0 + 4;
    lh.leftL.forEach((s, i) => pdf.text(s, M, top + (n - lh.leftL.length + i) * 13));
    right.forEach((s, i) => { if (/^Email/.test(s)) { pdf.text('Email : ', rx, top + i * 13); const x2 = rx + pdf.getTextWidth('Email : '); pdf.setTextColor(17, 85, 204); pdf.text(lh.email, x2, top + i * 13); pdf.setDrawColor(17, 85, 204); pdf.setLineWidth(.5); pdf.line(x2, top + i * 13 + 1.5, x2 + pdf.getTextWidth(lh.email), top + i * 13 + 1.5); pdf.setTextColor(...c); } else pdf.text(s, rx, top + i * 13); });
    const yb = top + (n - 1) * 13 + 9; pdf.setDrawColor(...c); pdf.setLineWidth(1.2); pdf.line(M, yb, W - M, yb); pdf.setLineWidth(.4); pdf.line(M, yb + 2.5, W - M, yb + 2.5); return yb + 22; };
  docs.forEach((L, di) => {
    if (di) pdf.addPage(); let y = header(L); const need = h => { if (y + h > H - 78) { pdf.addPage(); y = 56; } };
    const rich = (runs, x0, w, o = {}) => { // word-wrapped, justified mixed-style text
      const toks = []; let sp = false; for (const r of runs) for (const part of String(r.t).split(/(\s+)/)) { if (!part) continue; if (/^\s+$/.test(part)) { sp = true; continue; } toks.push({ t: part, s: sty(r), sp: sp && toks.length > 0 }); sp = false; }
      pdf.setFontSize(o.size || FS); toks.forEach(t => { pdf.setFont(F, t.s); t.w = pdf.getTextWidth(t.t); }); pdf.setFont(F, 'normal'); const sw = pdf.getTextWidth(' ');
      const lines = []; let cur = [], cw = o.indent || 0; for (const t of toks) { const add = (cur.length && t.sp ? sw : 0) + t.w; if (cur.length && cw + add > w) { lines.push({ toks: cur, w: cw }); cur = []; cw = 0; } cw += (cur.length && t.sp ? sw : 0) + t.w; cur.push(t); } if (cur.length) lines.push({ toks: cur, w: cw, last: 1 });
      pdf.setTextColor(0, 0, 0);
      lines.forEach((ln, li) => { need(LH); const ind = li === 0 ? (o.indent || 0) : 0; const gaps = ln.toks.filter((t, i) => i && t.sp).length; const extra = !ln.last && o.justify !== false && gaps ? (w - ln.w) / gaps : 0; let x = x0 + ind;
        ln.toks.forEach((t, i) => { if (i && t.sp) x += sw + extra; pdf.setFont(F, t.s); pdf.text(t.t, x, y); x += t.w; }); y += LH; });
    };
    y += 4;
    pdf.setTextColor(0, 0, 0); pdf.setFont(F, 'bold'); pdf.setFontSize(13); pdf.text(L.title, W / 2, y, { align: 'center' }); y += 18; pdf.setFontSize(12); pdf.text('(' + L.sec + ')', W / 2, y, { align: 'center' }); y += 26;
    pdf.setFontSize(FS); pdf.text('To,', M, y); y += LH + 4; pdf.setFont(F, 'normal'); L.to.forEach((t, i) => { pdf.setFont(F, i === L.to.length - 1 ? 'bold' : 'normal'); pdf.text(t, M + 34, y); y += LH; }); y += 8;
    for (const b of L.blocks) {
      if (b.p) { rich(b.p, M, W - 2 * M, { indent: 34 }); y += 8; }
      else if (b.list) { b.list.forEach((x, i) => { need(LH); pdf.setFont(F, 'normal'); pdf.setFontSize(FS); pdf.setTextColor(0, 0, 0); pdf.text((i + 1) + '.', M + 4, y); rich(x, M + 22, W - 2 * M - 22); y += 3; }); y += 6; }
      else { need(50); pdf.autoTable({ startY: y - 6, head: [L.table.head], body: L.table.rows.map(r => r.map(x => String(x ?? ''))), theme: 'grid', margin: { left: M, right: M, bottom: 80 }, tableWidth: W - 2 * M, columnStyles: Object.fromEntries(L.table.w.map((w, i) => [i, { cellWidth: (W - 2 * M) * w / 100, overflow: 'linebreak' }])),
        styles: { font: F, fontSize: 9, cellPadding: 3.5, lineColor: [0, 0, 0], lineWidth: .6, textColor: [0, 0, 0], halign: 'center', valign: 'middle' }, headStyles: { fillColor: TBL_BLUE, textColor: 255, fontStyle: 'bold' } }); y = pdf.lastAutoTable.finalY + 20; }
    }
    need(100); y += 26; const cx = W - M - 95; pdf.setFont(F, 'bold'); pdf.setFontSize(FS); pdf.setTextColor(0, 0, 0);
    L.lh.signL.concat(['Date: ' + L.date]).forEach(s => { pdf.text(s, cx, y, { align: 'center' }); y += LH; });
  });
  const n = pdf.internal.getNumberOfPages(), lh = docs[0].lh;
  for (let i = 1; i <= n; i++) { pdf.setPage(i); pdf.setFillColor(...BAND); pdf.rect(0, H - 44, W, 44, 'F'); pdf.setFillColor(...hexRgb(lh.color)); pdf.rect(0, H - 47, W, 3, 'F');
    pdf.setTextColor(255, 255, 255); pdf.setFont(F, 'bold'); pdf.setFontSize(11); pdf.text(lh.band, W / 2, H - 24, { align: 'center' }); pdf.setFont(F, 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(200, 208, 235);
    pdf.text([lh.tel ? 'Tel: ' + lh.tel : '', lh.email].filter(Boolean).join('   ·   '), W / 2, H - 11, { align: 'center' }); pdf.setTextColor(150, 150, 150); pdf.setFontSize(7); pdf.text(`Page ${i} of ${n}`, W - 20, H - 54, { align: 'right' }); }
  pdf.save(name + '.pdf');
}
async function lettersDocx(docs, name) {
  if (typeof window.docx === 'undefined') { toast('Preparing Word export…', 'ok', 1500); await Libs.one(LIBS.docx); }
  const X = window.docx; if (!X) throw new Error('Word library could not be loaded (check internet).');
  const FONT = 'Calibri';
  const T = (text, o = {}) => new X.TextRun(Object.assign({ text: String(text ?? ''), font: FONT, size: 23 }, o));
  const P = (runs, o = {}) => new X.Paragraph(Object.assign({ children: Array.isArray(runs) ? runs : [runs], spacing: { after: 120, line: 300 } }, o));
  const RT = (runs, o = {}) => runs.map(r => T(r.t, Object.assign({ bold: !!r.b, italics: !!r.i }, o)));
  const hex = a => a.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  const b64 = d => Uint8Array.from(atob(d.split(',')[1]), ch => ch.charCodeAt(0));
  const NB = { style: X.BorderStyle.NONE, size: 0, color: 'FFFFFF' }; const noB = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };
  const sections = [];
  for (const L of docs) {
    const lh = L.lh; const red = String(lh.color || '#E00000').replace('#', ''); let headChildren;
    if (lh.img) headChildren = [P(new X.ImageRun({ data: b64(lh.img), transformation: { width: 620, height: Math.min(lh.imgW ? Math.round(620 * lh.imgH / lh.imgW) : 110, 170) } }), { alignment: X.AlignmentType.CENTER })];
    else {
      const line = (runs) => P(runs, { spacing: { after: 0 } });
      const leftCell = lh.leftL.map(s => line(T(s, { color: red, size: 21 })));
      const rightCell = [lh.tel ? line(T('Tel Office: ' + lh.tel, { color: red, size: 21 })) : null, lh.mob ? line(T('Mob        : ' + lh.mob, { color: red, size: 21 })) : null, lh.email ? line([T('Email : ', { color: red, size: 21 }), T(lh.email, { color: '1155CC', size: 21, underline: {} })]) : null, line(T('Date: ' + L.date, { color: red, size: 21 }))].filter(Boolean);
      const pad = Math.max(0, rightCell.length - leftCell.length); for (let i = 0; i < pad; i++) leftCell.unshift(line(T('', { size: 21 })));
      headChildren = (lh.emblem ? [P(new X.ImageRun({ data: b64(KERALA_EMBLEM.src), transformation: { width: 90, height: Math.round(90 * KERALA_EMBLEM.h / KERALA_EMBLEM.w) } }), { alignment: X.AlignmentType.CENTER, spacing: { after: 60 } })] : [])
        .concat([new X.Table({ width: { size: 100, type: X.WidthType.PERCENTAGE }, borders: noB, rows: [new X.TableRow({ children: [new X.TableCell({ borders: noB, width: { size: 58, type: X.WidthType.PERCENTAGE }, verticalAlign: X.VerticalAlign.BOTTOM, children: leftCell }), new X.TableCell({ borders: noB, width: { size: 42, type: X.WidthType.PERCENTAGE }, children: rightCell })] })] }),
          P(T(''), { spacing: { after: 0 }, border: { bottom: { style: X.BorderStyle.DOUBLE, size: 6, color: red, space: 2 } } })]);
    }
    const TW = 9638; const cellP = (t, o = {}) => new X.TableCell({ width: o.w ? { size: Math.round(TW * o.w / 100), type: X.WidthType.DXA } : undefined, children: [P(T(t, Object.assign({ size: 19 }, o.run || {})), { spacing: { after: 0 }, alignment: X.AlignmentType.CENTER })], verticalAlign: X.VerticalAlign.CENTER, shading: o.fill ? { fill: o.fill, type: X.ShadingType.CLEAR, color: 'auto' } : undefined, margins: { top: 60, bottom: 60, left: 80, right: 80 } });
    const BL = { style: X.BorderStyle.SINGLE, size: 8, color: '000000' };
    const table = new X.Table({ width: { size: TW, type: X.WidthType.DXA }, columnWidths: L.table.w.map(w => Math.round(TW * w / 100)), layout: X.TableLayoutType.FIXED, borders: { top: BL, bottom: BL, left: BL, right: BL, insideHorizontal: BL, insideVertical: BL }, rows: [new X.TableRow({ tableHeader: true, children: L.table.head.map((h, i) => cellP(h, { w: L.table.w[i], fill: hex(TBL_BLUE), run: { bold: true, color: 'FFFFFF' } })) })].concat(L.table.rows.map(r => new X.TableRow({ children: r.map((x, i) => cellP(String(x ?? ''), { w: L.table.w[i] })) }))) });
    const mkFooter = () => new X.Footer({ children: [new X.Table({ width: { size: 100, type: X.WidthType.PERCENTAGE }, borders: Object.assign({}, noB, { top: { style: X.BorderStyle.SINGLE, size: 18, color: red } }),
      rows: [new X.TableRow({ children: [new X.TableCell({ borders: Object.assign({}, noB, { top: { style: X.BorderStyle.SINGLE, size: 18, color: red } }), shading: { fill: hex(BAND), type: X.ShadingType.CLEAR, color: 'auto' }, margins: { top: 90, bottom: 90 }, children: [P(T(lh.band, { bold: true, color: 'FFFFFF', size: 22 }), { alignment: X.AlignmentType.CENTER, spacing: { after: 0 } }), P(T([lh.tel ? 'Tel: ' + lh.tel : '', lh.email].filter(Boolean).join('   ·   '), { color: 'C8D0EB', size: 15 }), { alignment: X.AlignmentType.CENTER, spacing: { after: 0 } })] })] })] })] });
    const footer = mkFooter();
    const kids = [P(T(L.title, { bold: true, size: 26 }), { alignment: X.AlignmentType.CENTER, spacing: { before: 160, after: 40 } }), P(T('(' + L.sec + ')', { bold: true, size: 24 }), { alignment: X.AlignmentType.CENTER, spacing: { after: 240 } }),
      P(T('To,', { bold: true }), { spacing: { after: 120 } })].concat(L.to.map((t, i) => P(T(t, { bold: i === L.to.length - 1 }), { indent: { left: 720 }, spacing: { after: 0 } })), [P(T(''), { spacing: { after: 60 } })]);
    for (const b of L.blocks) {
      if (b.p) kids.push(P(RT(b.p), { alignment: X.AlignmentType.JUSTIFIED, indent: { firstLine: 720 } }));
      else if (b.list) b.list.forEach((x, i) => kids.push(P([T((i + 1) + '.\t')].concat(RT(x)), { indent: { left: 360, hanging: 360 }, tabStops: [{ type: X.TabStopType.LEFT, position: 360 }], alignment: X.AlignmentType.JUSTIFIED, spacing: { after: 80, line: 300 } })));
      else { kids.push(table, P(T(''), { spacing: { after: 60 } })); }
    }
    kids.push(P(T(''), { spacing: { before: 400 } }));
    lh.signL.concat(['Date: ' + L.date]).forEach(s => kids.push(P(T(s, { bold: true }), { indent: { left: 5600 }, alignment: X.AlignmentType.CENTER, spacing: { after: 0 } })));
    sections.push({ properties: { titlePage: true, page: { size: { width: 11906, height: 16838 }, margin: { top: 900, bottom: 1300, left: 1134, right: 1134, header: 300, footer: 300 } } }, headers: { first: new X.Header({ children: headChildren }), default: new X.Header({ children: [P(T(''), { spacing: { after: 0 } })] }) }, footers: { first: footer, default: mkFooter() }, children: kids });
  }
  const blob = await X.Packer.toBlob(new X.Document({ creator: 'SIXTH SENSE', title: name, sections })); downloadBlob(blob, name + '.docx');
}
/* ---------------- view ---------------- */
VIEWS.letters = async el => {
  el.innerHTML = `<div class="empty" style="margin-top:60px"><div class="spin"></div>Preparing letters…</div>`; await GEO.ready();
  const G = letterGroups(LET.type); const recs = Array.from(G.keys()).sort();
  if (LET.bank) { LET.sel = recs.includes(LET.bank) ? LET.bank : (recs.find(r => r.toLowerCase().includes(LET.bank.toLowerCase())) || ''); LET.bank = ''; }
  const done = LET.done[LET.type] = LET.done[LET.type] || new Set();
  if (!LET.sel || !recs.includes(LET.sel)) LET.sel = recs.find(r => !done.has(r)) || recs[0] || '';
  const idx = recs.indexOf(LET.sel); const docs = LET.sel ? [letterDoc(LET.type, LET.sel, G.get(LET.sel), idx + 1)] : [];
  const maxL = Math.max(0, ...S.cur.accts.map(a => acctLayer(a.id) || 0), ...S.cur.work.ncrp.map(r => (r.layer || 0) + 1));
  const cats = [['Bank', ['bank_basic', 'freeze']], ['Cash-out', ['atm_cctv', 'cheque']], ['Entities', ['pos', 'pg_wallet']], ['Telecom / IP', ['tsp_cdr', 'isp_ipdr']]];
  el.innerHTML = pageHead('94 BNSS Letters', 'Notices filled automatically from the NCRP trail and bank statements — one letter per bank, card issuer, UPI app / wallet or operator. Download as Word or PDF with the station letterhead.') +
    `<div class="let-types">${cats.map(([g, ks]) => `<div class="lt-g"><div class="small dim">${g}</div>${ks.map(k => `<button class="${LET.type === k ? 'on' : ''}" data-lt="${k}">${esc(LET_TYPES[k].t)}<span>${k === LET.type ? recs.length : ''}</span></button>`).join('')}</div>`).join('')}</div>
    <div class="let-wrap"><div class="let-paper" id="lPaper">${docs.length ? docs.map(letterHtml).join('<div class="pgbrk"></div>') : `<div class="letter-page">${emptyState('No data for this letter type with the current filters.' + (LET.type === 'atm_cctv' ? ' ATM withdrawals come from the NCRP report and ATM narrations in statements.' : LET.type === 'cheque' ? ' Cheque withdrawals come from the NCRP report (action: cheque) and cheque debits in statements.' : ''))}</div>`}</div>
    <div class="let-side card">
      <h3>Letter ${recs.length ? idx + 1 : 0} of ${recs.length} <span class="small dim">· ${done.size} done</span></h3>
      <div class="row" style="gap:6px"><button class="btn-sm" id="lPrev" ${idx <= 0 ? 'disabled' : ''}>◀</button><select id="lRec" style="flex:1;min-width:0">${recs.map(r => `<option value="${esc(r)}" ${LET.sel === r ? 'selected' : ''}>${done.has(r) ? '✓ ' : ''}${esc(r)} (${G.get(r).length})</option>`).join('')}</select><button class="btn-sm" id="lNext" ${idx < 0 || idx >= recs.length - 1 ? 'disabled' : ''}>▶</button></div>
      <div class="row" style="flex-wrap:wrap;margin-top:10px"><button class="btn-p" id="lDocx">⇩ Word (.docx)</button><button class="btn-p" id="lPdf">⇩ PDF</button><button class="btn-sm" id="lCopy">⧉ Copy</button></div>
      <div class="small dim" style="margin-top:6px">Downloads only this letter. After saving, press ▶ for the next bank. ${recs.length > 1 ? `<a href="#" id="lAll">All ${recs.length} letters in one file</a>` : ''}</div>
      <div class="let-nodal" id="lNod"></div>
      <h3 style="margin-top:14px">Filters</h3>
      ${['tsp_cdr', 'isp_ipdr'].includes(LET.type) ? '' : `<label class="f">Layer<select id="lLay"><option value="0">All layers</option>${Array.from({ length: maxL }, (_, i) => `<option value="${i + 1}" ${LET.layer === i + 1 ? 'selected' : ''}>Layer ${i + 1}</option>`).join('')}</select></label>`}
      ${['bank_basic', 'freeze'].includes(LET.type) ? `<label class="f">Accounts from<select id="lSrc"><option value="all" ${LET.src !== 'ncrp' ? 'selected' : ''}>NCRP trail + bank statements</option><option value="ncrp" ${LET.src === 'ncrp' ? 'selected' : ''}>NCRP trail only</option></select></label>` : ''}
      ${['bank_basic', 'pg_wallet'].includes(LET.type) ? `<label class="row small" style="margin-top:6px"><input type="checkbox" id="l106" ${LET.s106 ? 'checked' : ''}> Add Section 106 (freeze / hold)</label>` : ''}
      <button class="btn-sm" id="lRows" style="margin-top:8px">☑ Choose rows (${LET.excl.size} excluded)</button>
      ${LET.focus ? `<div class="small" style="margin-top:6px">Only: <b class="mono">${esc(LET.focus)}</b> <a href="#" id="lClrF">show all</a></div>` : ''}${LET.acct ? `<div class="small">Account: <b class="mono">${esc(LET.acct)}</b> <a href="#" id="lClrA">clear</a></div>` : ''}
      <h3 style="margin-top:14px">Letterhead & wording</h3><div class="row" style="flex-wrap:wrap"><button class="btn-sm" id="lHead">🏢 Letterhead</button><button class="btn-sm" id="lCase">✎ FIR no., date & sections</button><button class="btn-sm" id="lEdit">✎ Edit wording</button><button class="btn-sm btn-d" id="lReset">↺ Reset</button></div>
      <p class="small dim" style="margin-top:10px">You can also type on the letter preview before copying. Word and PDF are made from the data and your saved wording.</p>
    </div></div>`;
  (async () => { const box = $('#lNod', el); if (!box || !LET.sel) return; try { await NODAL.load(); } catch { box.innerHTML = '<div class="small dim">Nodal directory not available.</div>'; return; }
    const r0 = (G.get(LET.sel) || [])[0] || {}; const o = NODAL.match(LET.sel, r0.ifsc || ''); if (!o) { box.innerHTML = `<div class="small dim">No nodal contact found for ${esc(LET.sel)}. <a href="#" id="lNodGo">Search the directory</a></div>`; }
    else { const em = uniq(o.contacts.filter(c => c.email && !NODAL.flags[c.email]).map(c => c.email)); const pick = uniq(o.contacts.filter(c => c.email && c.tier && !NODAL.flags[c.email]).map(c => c.email)).slice(0, 4);
      box.innerHTML = `<h3 style="margin:0 0 4px">Send to — nodal contacts</h3><div class="small"><b>${esc(o.name)}</b> — legal / LEA IDs first</div>${(pick.length ? pick : em.slice(0, 3)).map(e => `<div class="mono">${esc(e)} <a href="#" data-lcp="${esc(e)}">⧉</a></div>`).join('')}<div class="row" style="margin-top:6px;flex-wrap:wrap"><button class="btn-sm" id="lNodAll">⧉ Copy all e-mails</button><button class="btn-sm" id="lNodGo">Open in directory</button></div><div class="small dim" style="margin-top:4px">Confirm with the bank — contacts may have changed.</div>`;
      $$('[data-lcp]', box).forEach(a => a.onclick = e => { e.preventDefault(); copyText(a.dataset.lcp); }); $('#lNodAll', box).onclick = () => copyText(em.join('; '), 'All e-mails of ' + o.name); }
    const g = $('#lNodGo', box); if (g) g.onclick = e => { e.preventDefault(); NDL.q = o ? o.name : LET.sel.replace(/\(.*?\)/g, '').trim(); NDL.cat = ''; NDL.sub = ''; if (o) NDL.open.add(o.id); go('nodal'); };
  })();
  $$('[data-lt]', el).forEach(b => b.onclick = () => { LET.type = b.dataset.lt; LET.sel = ''; LET.excl = new Set(); go('letters'); });
  $$('.letter-page', el).forEach(p => p.contentEditable = 'true');
  $('#lRec', el).onchange = e => { LET.sel = e.target.value; go('letters'); };
  $('#lPrev', el).onclick = () => { LET.sel = recs[idx - 1]; go('letters'); }; $('#lNext', el).onclick = () => { LET.sel = recs[idx + 1]; go('letters'); };
  const markDone = () => { done.add(LET.sel); const nx = recs.find((r, i) => i > idx && !done.has(r)); setTimeout(() => { if (nx) { LET.sel = nx; toast('Saved. Next: ' + nx, 'ok'); } else toast('All letters of this type done', 'ok'); go('letters'); }, 900); };
  if ($('#lLay', el)) $('#lLay', el).onchange = e => { LET.layer = +e.target.value; LET.sel = ''; go('letters'); };
  if ($('#lSrc', el)) $('#lSrc', el).onchange = e => { LET.src = e.target.value; LET.sel = ''; go('letters'); };
  if ($('#l106', el)) $('#l106', el).onchange = e => { LET.s106 = e.target.checked; go('letters'); };
  if ($('#lClrF', el)) $('#lClrF', el).onclick = e => { e.preventDefault(); LET.focus = ''; go('letters'); };
  if ($('#lClrA', el)) $('#lClrA', el).onclick = e => { e.preventDefault(); LET.acct = ''; go('letters'); };
  const fname = () => `${CONFIG.FILE_PREFIX}_${fileSafe(S.cur.meta.id)}_${LET_CODE[LET.type]}_${fileSafe(LET.sel || 'all')}`;
  $('#lPdf', el).onclick = () => { if (!docs.length) return toast('No letters to download', 'warn'); lettersPdf(docs, fname()); audit('Generated letter (PDF)', LET.type + ' ' + LET.sel); markDone(); };
  $('#lDocx', el).onclick = async () => { if (!docs.length) return toast('No letters to download', 'warn'); try { await lettersDocx(docs, fname()); audit('Generated letter (Word)', LET.type + ' ' + LET.sel); markDone(); } catch (e) { toast(e.message, 'err'); } };
  if ($('#lAll', el)) $('#lAll', el).onclick = e => { e.preventDefault();
    const md = modal({ title: 'All letters in one file', size: 'sm', body: `<p>Make one file containing all ${recs.length} letters of this type?</p>`, foot: `<button data-c>Cancel</button><button class="btn-p" id="aW">⇩ Word</button><button class="btn-p" id="aP">⇩ PDF</button>` });
    $('[data-c]', md.el).onclick = () => md.close();
    const run = async w => { md.close(); const all = recs.map((r, i) => letterDoc(LET.type, r, G.get(r), i + 1)); const nm = `${CONFIG.FILE_PREFIX}_${fileSafe(S.cur.meta.id)}_${LET_CODE[LET.type]}_ALL`; try { if (w) await lettersDocx(all, nm); else lettersPdf(all, nm); recs.forEach(r => done.add(r)); audit('Generated letters (all)', LET.type); go('letters'); } catch (er) { toast(er.message, 'err'); } };
    $('#aW', md.el).onclick = () => run(true); $('#aP', md.el).onclick = () => run(false); };
  $('#lCopy', el).onclick = async () => { const html = $('#lPaper', el).innerHTML; try { await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([$('#lPaper', el).innerText], { type: 'text/plain' }) })]); toast('Copied — paste into Word / e-mail', 'ok'); } catch { await navigator.clipboard.writeText($('#lPaper', el).innerText); toast('Copied as text', 'ok'); } };
  $('#lRows', el).onclick = () => {
    const all = []; const Gall = (() => { const keep = LET.excl; LET.excl = new Set(); const g = letterGroups(LET.type); LET.excl = keep; return g; })();
    for (const [rec, rows] of Gall) if (rec === LET.sel) rows.forEach(r => all.push({ rec, r }));
    const lab = r => [r.acctNo || r.acct || r.num || r.ip || '', r.atmId || '', r.place || '', r.chequeNo ? 'Chq ' + r.chequeNo : '', r.ts ? fmtDT(r.ts, r.hasTime) : '', r.amount ? inr(r.amount) : '', r.holder || ''].filter(Boolean).join(' · ');
    const md = modal({ title: 'Choose rows for the letter(s)', body: `<div class="row" style="margin-bottom:8px"><button class="btn-sm" id="rAll">Select all</button><button class="btn-sm" id="rNone">Clear all</button></div><div class="tbl-wrap" style="max-height:60vh"><table class="tbl"><tbody>${all.map((x, i) => `<tr><td><input type="checkbox" data-ri="${i}" ${LET.excl.has(x.r.key) ? '' : 'checked'}></td><td class="small">${esc(x.rec)}</td><td class="small">${esc(lab(x.r))}</td></tr>`).join('')}</tbody></table></div>`, foot: `<button class="btn-p" id="rOk">Apply</button>` });
    $('#rAll', md.el).onclick = () => $$('[data-ri]', md.el).forEach(c => c.checked = true); $('#rNone', md.el).onclick = () => $$('[data-ri]', md.el).forEach(c => c.checked = false);
    $('#rOk', md.el).onclick = () => { $$('[data-ri]', md.el).forEach(cb => { const k = all[+cb.dataset.ri].r.key; if (cb.checked) LET.excl.delete(k); else LET.excl.add(k); }); md.close(); go('letters'); };
  };
  $('#lEdit', el).onclick = () => {
    const tp = LET_TYPES[LET.type]; const cu = tplOf(LET.type);
    const md = modal({ title: 'Edit wording — ' + esc(tp.t), body: `<p class="small muted">Placeholders: <code>{{common}}</code> (the standard opening: agency, Section 94 quotation and FIR paragraph) <code>{{bank}}</code> <code>{{crimeNo}}</code> <code>{{firDate}}</code> <code>{{sections}}</code> <code>{{charges}}</code> <code>{{fraudAmount}}</code> <code>{{fromDate}}</code> <code>{{toDate}}</code> <code>{{s106}}</code>.<br>A blank line starts a new paragraph · <code>**bold**</code> · <code>*italic*</code> · lines starting with <code>1.</code> become the numbered list · <code>[[TABLE]]</code> marks where the table goes.</p>
      <label class="f">To<textarea id="tTo" rows="2">${esc(cu.to || tp.to)}</textarea></label><label class="f">Body<textarea id="tBody" rows="18" style="font-family:var(--mono);font-size:13px">${esc(cu.body || tp.body)}</textarea></label>`, foot: `<button class="btn-p" id="tSave">Save wording</button>` });
    $('#tSave', md.el).onclick = async () => { S.prefs.letterTpl = Object.assign({}, S.prefs.letterTpl, { [LET.type]: { v: 2, to: $('#tTo', md.el).value, body: $('#tBody', md.el).value } }); await savePrefs(); md.close(); toast('Wording saved', 'ok'); go('letters'); };
  };
  $('#lReset', el).onclick = async () => { if (!await confirmBox('Reset wording', 'Restore the original wording for this letter type?', 'Reset')) return; const t = Object.assign({}, S.prefs.letterTpl); delete t[LET.type]; S.prefs.letterTpl = t; await savePrefs(); go('letters'); };
  $('#lCase', el).onclick = () => caseForm(true);
  $('#lHead', el).onclick = () => {
    const h = letterHead();
    const md = modal({ title: 'Letterhead', body: `<div class="grid g2">
      <label class="f">Left block (one line each)<textarea data-k="left" rows="3">${esc(h.left)}</textarea></label>
      <label class="f">Signature block (one line each)<textarea data-k="sign" rows="3">${esc(h.sign)}</textarea></label>
      <label class="f">Tel Office<input data-k="tel" value="${esc(h.tel)}"></label><label class="f">Mobile<input data-k="mob" value="${esc(h.mob)}"></label>
      <label class="f">E-mail<input data-k="email" value="${esc(h.email)}"></label><label class="f">Signing officer name (optional)<input data-k="officer" value="${esc(h.officer)}"></label>
      <label class="f">Agency name used in the text<input data-k="agency" value="${esc(h.agency)}"></label><label class="f">Footer band text<input data-k="band" value="${esc(h.band)}"></label>
      <label class="f">Letterhead colour<input data-k="color" type="color" value="${esc(h.color)}"></label><label class="row small" style="align-self:end"><input type="checkbox" id="hEm" ${h.emblem ? 'checked' : ''}> Show Kerala Government emblem</label></div>
      <div class="card" style="margin-top:10px"><b>Full letterhead image</b> <span class="small dim">(optional — a PNG / JPG scan of the printed letterhead top; replaces the header above)</span><div class="row" style="margin-top:8px"><button class="btn-sm" id="hImg">⇪ Choose image</button><button class="btn-sm btn-d" id="hRm">Remove image</button><span class="small" id="hSt">${h.img ? 'Image set' : 'No image — using the designed header'}</span></div></div>`, foot: `<button class="btn-d" id="hDef">Restore station defaults</button><button class="btn-p" id="hSave">Save letterhead</button>` });
    let img = h.img, iw = h.imgW, ih = h.imgH;
    $('#hImg', md.el).onclick = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/png,image/jpeg'; i.onchange = () => { const fl = i.files[0]; if (!fl) return; if (fl.size > 1.5e6) return toast('Please use an image under 1.5 MB', 'warn'); const rd = new FileReader(); rd.onload = () => { const im = new Image(); im.onload = () => { img = rd.result; iw = im.naturalWidth; ih = im.naturalHeight; $('#hSt', md.el).textContent = `Image ready (${iw}×${ih})`; }; im.src = rd.result; }; rd.readAsDataURL(fl); }; i.click(); };
    $('#hRm', md.el).onclick = () => { img = ''; $('#hSt', md.el).textContent = 'Image removed'; };
    $('#hDef', md.el).onclick = async () => { S.prefs.letterhead = {}; await savePrefs(); md.close(); toast('Station letterhead restored', 'ok'); go('letters'); };
    $('#hSave', md.el).onclick = async () => { const v = {}; $$('[data-k]', md.el).forEach(i => v[i.dataset.k] = i.value.trim()); S.prefs.letterhead = Object.assign(v, { emblem: $('#hEm', md.el).checked, img, imgW: iw, imgH: ih }); await savePrefs(); md.close(); toast('Letterhead saved', 'ok'); go('letters'); };
  };
};
