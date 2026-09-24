/* ------------------------------ LETTERS / NOTICES (Sec. 94 & 106 BNSS) ------------------------------
   One letter per bank (or per ATM / wallet / telecom operator) filled from the case data.
   The wording is a template the station can edit once (placeholders in {{braces}}) and reuse. */
const LET = { type: 'bank_basic', src: 'all', bank: '', layer: 0, acct: '', s106: false, sel: '' };
const LET_TYPES = {
  bank_basic: { t: 'Bank — KYC, statement & login IP (Sec. 94 BNSS)', to: 'The Nodal Officer / Branch Manager\n{{bank}}', subject: 'Notice under Section 94 of BNSS, 2023 — furnishing of account details in Crime No. {{crimeNo}} of {{ps}}',
    body: `This police station is investigating Crime No. {{crimeNo}} registered at {{ps}} regarding an online financial fraud ({{caseType}}), in which the complainant was cheated of {{fraudAmount}}. Investigation revealed that the cheated money was credited to / routed through the account(s) of your bank shown in the table below.

Under Section 94 of the Bharatiya Nagarik Suraksha Sanhita, 2023, you are hereby directed to produce the following documents and information in respect of the account(s) listed below, in electronic form (Excel / PDF) to the e-mail address given above, at the earliest and in any case within 3 days:

- Account opening form, KYC documents, photograph and specimen signature of the account holder(s)
- Complete account statement from {{fromDate}} till date, with UTR / RRN, counterparty account and IFSC for every transaction
- Registered mobile number, alternate mobile numbers, e-mail ID, PAN, address and customer ID; other accounts linked to the same customer ID / PAN / mobile
- Internet banking, mobile banking and UPI login / transaction IP address logs with date, time (IST), source port, device ID and IMEI for the period
- UPI VPA(s), linked devices and debit card details; details of ATM / cash withdrawals with ATM ID, location and CCTV footage where available
- Beneficiary details of all onward transfers made from the account(s)

{{section106}}
The information is urgently required for the investigation of the case. This notice is issued for official investigation purposes only.` },
  freeze: { t: 'Bank — Debit freeze / hold of amount (Sec. 106 BNSS)', to: 'The Nodal Officer / Branch Manager\n{{bank}}', subject: 'Request to debit-freeze / retain amount — Crime No. {{crimeNo}} of {{ps}}',
    body: `This police station is investigating Crime No. {{crimeNo}} registered at {{ps}} regarding an online financial fraud in which the complainant was cheated of {{fraudAmount}}. The proceeds of the crime were credited to the account(s) of your bank listed below.

The money lying in these accounts is suspected to be property connected with the commission of the offence. Under Section 106 of the Bharatiya Nagarik Suraksha Sanhita, 2023, you are requested to:

- Immediately debit-freeze the account(s) listed below and retain / put on hold the amount shown against each account, without allowing any debit
- Intimate the available balance and the amount actually put on hold, with date and time
- Furnish the KYC, statement and login IP details of the account(s) under Section 94 BNSS

The freeze may be continued until further orders from this office or the competent court.` },
  atm_cctv: { t: 'Bank — ATM CCTV footage & EJ log', to: 'The Nodal Officer / Branch Manager\n{{bank}}', subject: 'Notice under Section 94 of BNSS, 2023 — ATM CCTV footage and journal log in Crime No. {{crimeNo}} of {{ps}}',
    body: `This police station is investigating Crime No. {{crimeNo}} registered at {{ps}}. The proceeds of the crime were withdrawn in cash through the ATM(s) listed below.

Under Section 94 of the Bharatiya Nagarik Suraksha Sanhita, 2023, you are directed to preserve and produce:

- CCTV footage of the ATM cabin and surroundings covering 30 minutes before and after each withdrawal listed below
- Electronic journal (EJ) log, card number used, and the account / card holder details for each withdrawal
- Exact location and address of the ATM, and details of the cash-loading agency

Please preserve the footage immediately as it may be overwritten.` },
  pg_wallet: { t: 'Wallet / payment gateway — merchant & user details', to: 'The Nodal Officer / Grievance Officer\n{{bank}}', subject: 'Notice under Section 94 of BNSS, 2023 — wallet / merchant details in Crime No. {{crimeNo}} of {{ps}}',
    body: `This police station is investigating Crime No. {{crimeNo}} registered at {{ps}}. The cheated money was routed through the wallet / payment-gateway IDs of your platform listed below.

Under Section 94 of the Bharatiya Nagarik Suraksha Sanhita, 2023, you are directed to furnish:

- KYC of the wallet user / merchant, registered mobile, e-mail, PAN and address
- Settlement bank account(s) and IFSC of the merchant, with settlement statement for the period
- Login IP addresses with port, device ID and IMEI, and the website / app through which the payment was collected
- Complete transaction history of the listed IDs from {{fromDate}} till date

{{section106}}` },
  tsp_cdr: { t: 'Telecom — CDR & CAF of mobile numbers', to: 'The Nodal Officer\n{{bank}}', subject: 'Notice under Section 94 of BNSS, 2023 — CDR and CAF in Crime No. {{crimeNo}} of {{ps}}',
    body: `This police station is investigating Crime No. {{crimeNo}} registered at {{ps}} regarding an online financial fraud. The mobile numbers listed below are linked to the bank accounts that received the proceeds of the crime.

Under Section 94 of the Bharatiya Nagarik Suraksha Sanhita, 2023, you are directed to furnish:

- Call detail records (with cell ID, IMEI and IMSI) from {{fromDate}} till date
- Customer application form (CAF), KYC documents and point-of-sale details
- IMEI-wise usage and alternate numbers used in the same handsets` },
  isp_ipdr: { t: 'Telecom / ISP — IPDR for login IP addresses', to: 'The Nodal Officer\n{{bank}}', subject: 'Notice under Section 94 of BNSS, 2023 — subscriber details of IP addresses in Crime No. {{crimeNo}} of {{ps}}',
    body: `This police station is investigating Crime No. {{crimeNo}} registered at {{ps}}. The bank accounts that received the proceeds of the crime were accessed from the public IP addresses listed below at the times shown.

Under Section 94 of the Bharatiya Nagarik Suraksha Sanhita, 2023, you are directed to furnish the subscriber details (name, address, mobile number, CAF / KYC) of the user to whom each IP address and source port was allotted at the given date and time, along with the IPDR for the session.` }
};
const LET_CODE = { bank_basic: 'B94', freeze: 'F106', atm_cctv: 'ATM', pg_wallet: 'PG', tsp_cdr: 'CDR', isp_ipdr: 'IPDR' };
const S106 = 'In addition, under Section 106 of the Bharatiya Nagarik Suraksha Sanhita, 2023, you are requested to immediately debit-freeze the account(s) listed below and retain the amount shown against each, since the money is suspected to be property connected with the offence, and to intimate the amount put on hold.';
function letterHead() {
  const m = (S.cur || {}).meta || {};
  return Object.assign({ station: m.ps || 'Cyber Crime Police Station, Kochi City', address: 'Kochi, Kerala', phone: '', email: '', officer: m.io || '', designation: 'Station House Officer', place: 'Kochi' }, S.prefs.letterhead || {});
}
/* Rows grouped by recipient for the chosen letter type. */
function letterGroups(type) {
  const c = S.cur; const d = D(); const G = new Map();
  const put = (rec, row) => { rec = rec || 'Unknown'; if (!G.has(rec)) G.set(rec, []); G.get(rec).push(row); };
  if (['bank_basic', 'freeze', 'pg_wallet'].includes(type)) {
    const seen = new Map();
    const add = (acctNo, o) => { const k = acctKey(acctNo); if (!k) return; let r = seen.get(k); if (!r) { r = { acctNo, ifsc: '', holder: '', bank: '', layer: null, amount: 0, hold: 0, utrs: new Set(), from: null }; seen.set(k, r); } if (o.ifsc && !r.ifsc) r.ifsc = o.ifsc; if (o.holder && !r.holder) r.holder = o.holder; if (o.bank && !r.bank) r.bank = o.bank; if (o.layer != null && (r.layer == null || o.layer < r.layer)) r.layer = o.layer; r.amount += o.amount || 0; r.hold += o.hold || 0; (o.utrs || []).forEach(u => u && r.utrs.add(u)); if (o.ts && (!r.from || o.ts < r.from)) r.from = o.ts; };
    if (LET.src !== 'ncrp') for (const [id, res] of d.acctRes) { const a = IX.acctById.get(id); if (a) add(a.acctNo, { ifsc: a.ifsc, holder: a.holder, bank: a.bank || (GEO.info(a.ifsc) || {}).bank, layer: res.layer, amount: res.tin, ts: res.firstIn }); }
    if (c.work.ncrp.length) { const m = ncrpModel(Object.assign({}, NCRPF, { cash: 0 })); for (const n of m.N.values()) if (!n.exit && n.id !== 'VICTIM' && n.layer !== 0) add(n.id, { ifsc: n.ifsc, holder: n.holder, bank: n.bank, layer: n.layer, amount: n.in, hold: n.hold, utrs: n.rows.map(r => r.utr), ts: Math.min(...n.rows.map(r => r.ts || Infinity)) }); }
    for (const r of seen.values()) {
      if (LET.layer && r.layer !== LET.layer) continue; if (LET.acct && acctKey(r.acctNo) !== acctKey(LET.acct)) continue;
      const wallet = /[A-Z]/.test(r.acctNo) && !/^\d+$/.test(r.acctNo);
      if (type === 'pg_wallet' && !wallet) continue; if (type !== 'pg_wallet' && wallet) continue;
      r.bank = r.bank || (GEO.info(r.ifsc) || {}).bank || 'Unknown bank'; r.utrs = Array.from(r.utrs);
      if (type === 'freeze' && !(r.amount > 0)) continue;
      put(r.bank, r);
    }
  } else if (type === 'atm_cctv') {
    for (const a of caseAtmRows()) for (const t of a.txns) put((a.info || {}).bank || (IX.acctByKey.get(acctKey(t.acct)) || {}).bank || 'Bank (ATM owner)', { atmId: a.atmId, place: a.info ? [a.info.address, a.info.city, a.info.state].filter(Boolean).join(', ') : a.place, ts: t.ts, amount: t.amount, acct: t.acct });
  } else if (type === 'tsp_cdr') {
    for (const x of requisitions().cdr) put('Telecom Service Provider', { num: x.num, links: x.links });
  } else if (type === 'isp_ipdr') {
    for (const x of requisitions().ipdr) put(x.isp || x.org || 'Telecom / ISP', x);
  }
  return G;
}
function letterTable(type, rows) {
  const th = h => `<tr>${h.map(x => `<th>${esc(x)}</th>`).join('')}</tr>`, td = r => `<tr>${r.map(x => `<td>${esc(x == null ? '' : String(x))}</td>`).join('')}</tr>`;
  let h, body;
  if (type === 'atm_cctv') { h = ['Sl', 'ATM ID', 'ATM location', 'Date & time', 'Amount (₹)', 'Account']; body = rows.map((r, i) => [i + 1, r.atmId || '—', r.place || '—', r.ts ? fmtDT(r.ts) : '—', inr(r.amount).replace('₹', ''), r.acct]); }
  else if (type === 'tsp_cdr') { h = ['Sl', 'Mobile number', 'Linked to']; body = rows.map((r, i) => [i + 1, r.num, r.links]); }
  else if (type === 'isp_ipdr') { h = ['Sl', 'IP address', 'Port', 'Date & time (IST)', 'Date & time (UTC)', 'Account']; body = rows.map((r, i) => [i + 1, r.ip, r.port || '—', r.ts ? fmtDT(r.ts) : '', r.ts ? new Date(r.ts - 5.5 * 3600000).toISOString().replace('T', ' ').slice(0, 19) : '', (r.accts || []).map(id => (IX.acctById.get(id) || {}).acctNo || id).join(', ')]); }
  else { h = ['Sl', type === 'pg_wallet' ? 'Wallet / PG ID' : 'Account number', 'IFSC', 'Account holder', 'Layer', 'Amount (₹)'].concat(type === 'freeze' || LET.s106 ? ['Amount to hold (₹)'] : []).concat(['UTR / reference']);
    body = rows.map((r, i) => [i + 1, r.acctNo, r.ifsc || '—', r.holder || '—', r.layer ?? '—', inr(r.amount).replace('₹', '')].concat(type === 'freeze' || LET.s106 ? [inr(r.hold > 0 ? r.hold : r.amount).replace('₹', '')] : []).concat([(r.utrs || []).slice(0, 4).join(', ') + ((r.utrs || []).length > 4 ? ' …' : '')])); }
  return `<table class="lt">${th(h)}${body.map(td).join('')}</table>`;
}
function fillTpl(txt, v) { return String(txt).replace(/\{\{(\w+)\}\}/g, (_, k) => v[k] != null ? v[k] : ''); }
function textToHtml(t) {
  const out = []; let list = [];
  const flush = () => { if (list.length) { out.push('<ol type="a">' + list.map(x => `<li>${x}</li>`).join('') + '</ol>'); list = []; } };
  for (const para of String(t).split(/\n\s*\n/)) { const lines = para.split('\n'); for (const ln of lines) { if (/^\s*-\s+/.test(ln)) list.push(esc(ln.replace(/^\s*-\s+/, ''))); else if (ln.trim()) { flush(); out.push(`<p>${esc(ln.trim())}</p>`); } } flush(); }
  return out.join('');
}
function renderLetter(type, rec, rows, n) {
  const lh = letterHead(); const m = S.cur.meta; const tp = LET_TYPES[type]; const custom = (S.prefs.letterTpl || {})[type] || {};
  const fromTs = Math.min(...rows.map(r => r.from || r.ts || Infinity)); const fraud = (S.cur.work.ncrp.length ? ncrpModel().fraud : 0) || sum(D().seeds || [], s => s.dr || 0);
  const v = { bank: rec, crimeNo: m.crimeNo || m.id, ps: lh.station, caseType: m.type || 'cyber fraud', fraudAmount: fraud ? inr(fraud) : 'the amount mentioned in the complaint', fromDate: isFinite(fromTs) ? fmtDate(fromTs - 7 * 86400000) : 'the date of account opening', io: lh.officer, date: fmtDate(Date.now() + 5.5 * 3600000), section106: LET.s106 && type !== 'freeze' ? S106 : '' };
  const ref = `No. ${esc(m.crimeNo || m.id)} / ${esc(LET_CODE[type] || 'L')}-${String(n).padStart(2, '0')}`;
  return `<div class="letter-page">
    <div class="lh"><div class="lh-t">${esc(lh.station)}</div><div>${esc(lh.address)}</div><div>${[lh.phone ? 'Phone: ' + esc(lh.phone) : '', lh.email ? 'E-mail: ' + esc(lh.email) : ''].filter(Boolean).join(', ')}</div></div>
    <div class="lrow"><span>${ref}</span><span>Date: ${esc(v.date)}</span></div>
    <div class="ltitle">NOTICE<br><span>(${type === 'freeze' ? 'UNDER SECTION 106 B.N.S.S. 2023' : 'UNDER SECTION 94' + (LET.s106 && type !== 'freeze' ? ' & 106' : '') + ' B.N.S.S. 2023'})</span></div>
    <div class="lto"><b>To,</b><div>${esc(fillTpl(custom.to || tp.to, v)).replace(/\n/g, '<br>')}</div></div>
    <p class="lsub"><b>Sub:</b> ${esc(fillTpl(custom.subject || tp.subject, v))}</p>
    <p class="lsub"><b>Ref:</b> Crime No. ${esc(m.crimeNo || m.id)} of ${esc(lh.station)}</p>
    <p>Sir / Madam,</p>
    ${textToHtml(fillTpl(custom.body || tp.body, v))}
    ${letterTable(type, rows)}
    <p>Kindly treat this as most urgent. Any delay may result in loss of evidence and of the victim's money.</p>
    <div class="lsign"><div>Yours faithfully,</div><div style="height:46px"></div><div><b>${esc(lh.officer || '')}</b></div><div>${esc(lh.designation)}</div><div>${esc(lh.station)}</div></div>
  </div>`;
}
VIEWS.letters = async el => {
  if (!GEO.loaded) el.innerHTML = `<div class="empty" style="margin-top:60px"><div class="spin"></div>Loading bank & ATM reference data…</div>`;
  await GEO.ready();
  const G = letterGroups(LET.type); const recs = Array.from(G.keys()).sort();
  if (LET.bank && !recs.includes(LET.bank)) { const f = recs.find(r => r.toLowerCase().includes(LET.bank.toLowerCase())); LET.sel = f || ''; } else if (LET.bank) LET.sel = LET.bank;
  if (LET.sel && !recs.includes(LET.sel)) LET.sel = '';
  const pick = LET.sel ? [LET.sel] : recs; LET.bank = '';
  const maxL = Math.max(0, ...S.cur.accts.map(a => acctLayer(a.id) || 0), ...S.cur.work.ncrp.map(r => (r.layer || 0) + 1));
  el.innerHTML = pageHead('Letters / 94 BNSS', 'Ready-to-send notices filled from the case: one letter per bank, ATM owner, wallet or telecom operator. Edit the wording once with “Edit template”; you can also type directly on the letter before printing.') +
    `<div class="let-wrap"><div class="let-paper" id="lPaper">${pick.length ? pick.map((r, i) => renderLetter(LET.type, r, G.get(r), i + 1)).join('<div class="pgbrk"></div>') : `<div class="letter-page">${emptyState('No recipients for this letter type with the current filters.')}</div>`}</div>
    <div class="let-side card">
      <h3>Actions</h3><div class="row"><button class="btn-sm" id="lCopy" title="Copy letter">⧉ Copy</button><button class="btn-sm" id="lDoc" title="Download Word file">⇩ Word</button><button class="btn-sm btn-p" id="lPrint" title="Print or save as PDF">⎙ Print / PDF</button></div>
      <h3 style="margin-top:14px">Letter type</h3><select id="lType">${Object.entries(LET_TYPES).map(([k, t]) => `<option value="${k}" ${LET.type === k ? 'selected' : ''}>${esc(t.t)}</option>`).join('')}</select>
      ${['bank_basic', 'pg_wallet'].includes(LET.type) ? `<label class="row small" style="margin-top:8px"><input type="checkbox" id="l106" ${LET.s106 ? 'checked' : ''}> Add Section 106 (freeze / hold) clause</label>` : ''}
      <h3 style="margin-top:14px">Filters</h3>
      <label class="f">Recipient (${recs.length})<select id="lRec"><option value="">All — ${recs.length} letter(s)</option>${recs.map(r => `<option ${LET.sel === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
      ${['bank_basic', 'freeze', 'pg_wallet'].includes(LET.type) ? `<label class="f">Layer<select id="lLay"><option value="0">All layers</option>${Array.from({ length: maxL }, (_, i) => `<option value="${i + 1}" ${LET.layer === i + 1 ? 'selected' : ''}>Layer ${i + 1}</option>`).join('')}</select></label>
      <label class="f">Data from<select id="lSrc"><option value="all" ${LET.src !== 'ncrp' ? 'selected' : ''}>Statements + NCRP</option><option value="ncrp" ${LET.src === 'ncrp' ? 'selected' : ''}>NCRP report only</option></select></label>
      ${LET.acct ? `<div class="small">Account: <b class="mono">${esc(LET.acct)}</b> <a href="#" id="lClrA">clear</a></div>` : ''}` : ''}
      <h3 style="margin-top:14px">Template</h3><div class="row"><button class="btn-sm" id="lEdit">✎ Edit template</button><button class="btn-sm" id="lHead">🏢 Letterhead</button><button class="btn-sm btn-d" id="lReset">↺ Reset</button></div>
      <p class="small dim" style="margin-top:10px">Print → choose “Save as PDF” to get a PDF. The letter text is editable on screen; edits there are not saved.</p>
    </div></div>
`;
  $$('.letter-page', el).forEach(p => p.contentEditable = 'true');
  $('#lType', el).onchange = e => { LET.type = e.target.value; LET.sel = ''; go('letters'); };
  $('#lRec', el).onchange = e => { LET.sel = e.target.value; go('letters'); };
  if ($('#l106', el)) $('#l106', el).onchange = e => { LET.s106 = e.target.checked; go('letters'); };
  if ($('#lLay', el)) $('#lLay', el).onchange = e => { LET.layer = +e.target.value; LET.sel = ''; go('letters'); };
  if ($('#lSrc', el)) $('#lSrc', el).onchange = e => { LET.src = e.target.value; LET.sel = ''; go('letters'); };
  if ($('#lClrA', el)) $('#lClrA', el).onclick = e => { e.preventDefault(); LET.acct = ''; go('letters'); };
  const css = `body{font-family:'Times New Roman',serif;color:#000;background:#fff}.letter-page{padding:10px 0;font-size:12.5pt;line-height:1.5}.lh{text-align:center;border-bottom:1.5px solid #000;padding-bottom:6px;margin-bottom:10px}.lh-t{font-size:17pt;font-weight:bold}.lrow{display:flex;justify-content:space-between}.ltitle{text-align:center;font-weight:bold;margin:12px 0}.ltitle span{font-weight:bold}.lto{margin:8px 0}.lto div{margin-left:36px}p{text-align:justify;margin:6px 0}table.lt{border-collapse:collapse;width:100%;font-size:10.5pt;margin:10px 0}table.lt th,table.lt td{border:1px solid #000;padding:3px 5px;text-align:left}.lsign{margin-left:60%;margin-top:18px}.pgbrk{page-break-after:always}`;
  const html = () => $('#lPaper', el).innerHTML;
  const name = () => `${CONFIG.FILE_PREFIX}_${fileSafe(S.cur.meta.id)}_${LET.type}_${fileSafe(LET.sel || 'all')}`;
  $('#lDoc', el).onclick = () => { const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>${css}</style></head><body>${html().replace(/<div class="pgbrk"><\/div>/g, '<br clear=all style="page-break-before:always">')}</body></html>`; downloadBlob(new Blob(['﻿', doc], { type: 'application/msword' }), name() + '.doc'); audit('Generated letter', LET.type + ' ' + (LET.sel || 'all')); };
  $('#lCopy', el).onclick = async () => { try { await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html()], { type: 'text/html' }), 'text/plain': new Blob([$('#lPaper', el).innerText], { type: 'text/plain' }) })]); toast('Letter copied — paste into Word / e-mail', 'ok'); } catch { await navigator.clipboard.writeText($('#lPaper', el).innerText); toast('Copied as text', 'ok'); } };
  $('#lPrint', el).onclick = () => { let pr = document.getElementById('printRoot'); if (!pr) { pr = document.createElement('div'); pr.id = 'printRoot'; pr.style.display = 'none'; document.body.appendChild(pr); } pr.innerHTML = `<style>@media print{${css.replace(/body\{[^}]*\}/, '')}}</style>` + html(); document.body.classList.add('printing-letters'); audit('Generated letter', LET.type + ' ' + (LET.sel || 'all')); setTimeout(() => { window.print(); document.body.classList.remove('printing-letters'); pr.innerHTML = ''; }, 60); };
  $('#lEdit', el).onclick = async () => {
    const tp = LET_TYPES[LET.type]; const cu = (S.prefs.letterTpl || {})[LET.type] || {};
    const md = modal({ title: 'Edit template — ' + esc(tp.t), body: `<p class="small muted">Placeholders: <code>{{bank}}</code> <code>{{crimeNo}}</code> <code>{{ps}}</code> <code>{{caseType}}</code> <code>{{fraudAmount}}</code> <code>{{fromDate}}</code> <code>{{date}}</code> <code>{{section106}}</code>. A blank line starts a new paragraph; lines starting with “- ” become the (a), (b), (c) list. The account table is added automatically.</p>
      <label class="f">To<textarea id="tTo" rows="2">${esc(cu.to || tp.to)}</textarea></label><label class="f">Subject<input id="tSub" value="${esc(cu.subject || tp.subject)}"></label><label class="f">Body<textarea id="tBody" rows="16" style="font-family:var(--mono);font-size:13px">${esc(cu.body || tp.body)}</textarea></label>`,
      foot: `<button data-x2>Cancel</button><button class="btn-p" id="tSave">Update template</button>` });
    $('[data-x2]', md.el).onclick = md.close;
    $('#tSave', md.el).onclick = async () => { S.prefs.letterTpl = Object.assign({}, S.prefs.letterTpl, { [LET.type]: { to: $('#tTo', md.el).value, subject: $('#tSub', md.el).value, body: $('#tBody', md.el).value } }); await savePrefs(); md.close(); toast('Template updated', 'ok'); go('letters'); };
  };
  $('#lHead', el).onclick = async () => {
    const h = letterHead(); const f = [['station', 'Police station / unit'], ['address', 'Address'], ['phone', 'Phone'], ['email', 'E-mail'], ['officer', 'Signing officer name'], ['designation', 'Designation'], ['place', 'Place']];
    const v = await promptBox('Letterhead', f.map(([k, l]) => ({ label: l, value: h[k] || '' })), 'Save letterhead'); if (!v) return;
    S.prefs.letterhead = Object.fromEntries(f.map(([k], i) => [k, v[i].trim()])); await savePrefs(); toast('Letterhead saved', 'ok'); go('letters');
  };
  $('#lReset', el).onclick = async () => { if (!await confirmBox('Reset template', 'Restore the original wording for this letter type?', 'Reset')) return; const t = Object.assign({}, S.prefs.letterTpl); delete t[LET.type]; S.prefs.letterTpl = t; await savePrefs(); go('letters'); };
};
