/* ------------------------------ CASE INTELLIGENCE (results page) ------------------------------ */
const IV = { tab: 'summary', acct: '', type: '' };
const IV_TABS = [['summary', 'Key findings'], ['direct', 'Complainant → Layer 1'], ['upi', 'UPI · persons · POS'], ['dormant', 'Dormant accounts'], ['peak', 'Peak dates'], ['test', 'Test (₹1) transactions'], ['fusion', 'CDR location intelligence'], ['loc', 'Location hotspots']];
function xlsxBook(name, sheets) {
  const wb = XLSX.utils.book_new(); const used = new Set();
  for (const sh of sheets) { let n = String(sh.name).replace(/[\\\/?*\[\]:]/g, ' ').slice(0, 31) || 'Sheet'; let k = 1; while (used.has(n)) n = n.slice(0, 28) + '~' + (k++); used.add(n);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([sh.cols.map(c => c.label)].concat(sh.rows.map(r => sh.cols.map(c => { const v = c.x ? c.x(r) : c.get ? c.get(r) : r[c.k]; return safeCell(v == null ? '' : v); })))), n); }
  XLSX.writeFile(wb, `${CONFIG.FILE_PREFIX}_${fileSafe(S.cur.meta.id)}_${fileSafe(name)}_${isoDate(nowWall())}.xlsx`); audit('Exported', name);
}
const DIRECT_COLS = [{ label: 'Date & time', get: r => fmtDT(r.tx.ts, r.tx.hasTime) }, { label: 'From (complainant)', get: r => acctName(r.from) }, { label: 'Complainant UTR / Txn ID', get: r => r.utr }, { label: 'Amount', html: r => inr(r.amt), num: 1, x: r => r.amt },
  { label: 'To (Layer 1)', get: r => r.to ? acctName(r.to) : r.benef ? 'Not uploaded: ' + r.benef : '—' }, { label: 'Credit found in Layer 1 statement', get: r => r.cr ? fmtDT(r.cr.ts, r.cr.hasTime) + ' · ' + (r.crUtr || '') : r.to ? 'Not found in statement' : '—' },
  { label: 'UTR on both sides', html: r => r.utrMatch ? badge('✓ Same UTR', 'green') : r.cr ? badge('Other match', 'amber') : badge('—', 'gray'), x: r => r.utrMatch ? 'YES' : 'NO' }, { label: 'Match', get: r => r.strength }, { label: 'Channel', get: r => r.tx.channel }];
const DSUM_COLS = [{ label: 'Layer 1 account', get: s => s.label }, { label: 'Bank', get: s => s.bank || '' }, { label: 'Transactions', k: 'n', num: 1 }, { label: 'Amount received', html: s => inr(s.amt), num: 1, x: s => s.amt }, { label: 'Same UTR', k: 'utrOk', num: 1 }, { label: 'First', get: s => fmtDT(s.first) }, { label: 'Last', get: s => fmtDT(s.last) }, { label: 'From complainant a/c', get: s => s.from.join(', ') }];
function ivHead(el, extra = '') {
  el.innerHTML = pageHead('Case Intelligence', 'Results from all uploaded statements, NCRP and CDRs in one place. Every finding is a lead for verification against the source records.', `<button id="ivRe">↻ Re-run</button><button id="ivRep" class="btn-p">⎙ Intelligence report (PDF)</button><button id="ivXl">⇩ All results (Excel)</button>`) +
    `<div class="tabs" id="ivTabs">${IV_TABS.map(([k, t]) => `<button class="${IV.tab === k ? 'on' : ''}" data-t="${k}">${t}</button>`).join('')}</div>${extra}<div id="ivB"></div>`;
  $$('#ivTabs button', el).forEach(b => b.onclick = () => { IV.tab = b.dataset.t; go('intel'); });
  $('#ivRe', el).onclick = () => { S.derived = null; go('intel'); toast('Analysis re-run', 'ok'); };
  $('#ivRep', el).onclick = () => reportIntel();
  $('#ivXl', el).onclick = () => exportIntelAll();
}
VIEWS.intel = async el => {
  if (!S.cur.txns.length && !S.cur.telecom.cdr.length) { el.innerHTML = pageHead('Case Intelligence', '') + emptyState('Upload statements, NCRP reports or CDRs first.', `<button class="btn-p" id="goUp">⇪ Open Upload Center</button>`); $('#goUp', el).onclick = () => go('upload'); return; }
  el.innerHTML = `<div class="empty" style="margin-top:60px"><div class="spin"></div>Analysing statements, NCRP and CDRs…</div>`; await tick();
  await GEO.ready();
  ivHead(el); const B = $('#ivB', el); const t = IV.tab;
  if (t === 'summary') ivSummary(B); else if (t === 'direct') ivDirect(B); else if (t === 'upi') ivUpi(B); else if (t === 'dormant') ivDormant(B); else if (t === 'peak') ivPeak(B); else if (t === 'test') ivTest(B); else if (t === 'fusion') ivFusion(B); else ivLoc(B);
};
function ivCard(title, body, color = '#00e5ff', go_) { return `<div class="card iv-f" style="--pc:${color}" ${go_ ? `data-go="${go_}"` : ''}><h3>${title}</h3>${body}</div>`; }
function ivSummary(B) {
  const D1 = anDirect(), U = anUpiPos(), DM = anDormant(), P = anPeak(), TT = anTest(), F = anFusion(), LO = anLocations().filter(x => x.link);
  const topUpi = U.upi.slice().sort((a, b) => (b.dr + b.cr) - (a.dr + a.cr))[0], topCp = U.cp.slice().sort((a, b) => b.dr - a.dr)[0];
  const brk = [];
  for (const x of F.commonImei.slice(0, 5)) brk.push(`<li><b>Same handset (IMEI ${esc(x.imei)})</b> used by ${x.nums.map((n, i) => `${esc(n)}${x.names[i] ? ' (' + esc(x.names[i]) + ')' : ''}`).join(', ')}${x.accts.length ? ' — linked to accounts ' + esc(x.accts.join(', ')) : ''}</li>`);
  for (const x of F.commonCells.slice(0, 5)) brk.push(`<li><b>Same location when money moved:</b> ${esc(x.addr || 'cell ' + x.cell)} — accounts ${esc(x.accts.join(', '))} (numbers ${esc(x.nums.join(', '))})</li>`);
  for (const x of F.sharedCells.filter(s => s.accts.length >= 2).slice(0, 3)) brk.push(`<li><b>Common CDR location:</b> ${esc(x.addr || 'cell ' + x.cell)} visited by ${x.nums.length} holders (${esc(x.nums.map((n, i) => x.names[i] || n).join(', '))})</li>`);
  for (const x of TT.cpLinks.slice(0, 3)) brk.push(`<li><b>Same sender of test transactions</b> (${esc(x.cp)}) to ${x.accts.length} accounts: ${esc(x.accts.join(', '))}</li>`);
  B.innerHTML = `${brk.length ? `<div class="card iv-brk"><h3>⚡ Possible breakthroughs — interconnections found</h3><ul>${brk.join('')}</ul><p class="small dim" style="margin:6px 0 0">Verify each with the operator / bank records before relying on it.</p></div>` : `<div class="notice">${F.hasCdr ? 'No common handset or common location found between different accounts yet.' : 'Upload CDRs of the account-linked numbers to find common locations and common handsets.'}</div>`}
    <div class="grid g3" style="margin-top:14px">
      ${ivCard('Complainant → Layer 1', `<div class="iv-big">${nfmt(D1.n)} txns · ${inrShort(D1.total)}</div><div class="small muted">${D1.toL1} reached uploaded Layer 1 accounts · ${D1.utrOk} with the same UTR on both statements · ${D1.sum.filter(s => s.to).length} Layer 1 accounts</div>`, '#ff2e88', 'direct')}
      ${ivCard('Top UPI ID', topUpi ? `<div class="iv-big mono">${esc(topUpi.upi)}</div><div class="small muted">debited ${inrShort(topUpi.dr)} · credited ${inrShort(topUpi.cr)} · ${topUpi.accts.length} account(s)</div>` : '<div class="dim">No UPI IDs in narrations.</div>', '#00e5ff', 'upi')}
      ${ivCard('Top receiving person / account', topCp ? `<div class="iv-big">${esc(topCp.who)}</div><div class="small muted">received ${inrShort(topCp.dr)} from the case accounts · ${topCp.accts.length} account(s)</div>` : '<div class="dim">—</div>', '#b388ff', 'upi')}
      ${ivCard('Dormant accounts', `<div class="iv-big">${DM.filter(x => x.verdict.startsWith('Dormant')).length} dormant · ${DM.length} flagged</div><div class="small muted">${DM[0] ? esc(acctName(DM[0].a)) + ': silent ' + DM[0].gap + ' days, then ' + DM[0].postN + ' txns in 30 days' : 'No sudden reactivation found.'}</div>`, '#ffb300', 'dormant')}
      ${ivCard('Peak dates', P.types.map(x => `<div class="small"><b>${esc(x.type)}:</b> ${esc(x.date)} — ${x.n} txns</div>`).join('') || '<div class="dim">—</div>', '#00ff9d', 'peak')}
      ${ivCard('Test (₹1) transactions', `<div class="iv-big">${nfmt(TT.rows.length)} in ${TT.byAcct.length} accounts</div><div class="small muted">${TT.rows.filter(r => r.one).length} of exactly ₹1 · ${TT.cpLinks.length} common senders · ${TT.clusters.length} time clusters</div>`, '#ff6e40', 'test')}
      ${ivCard('CDR location intelligence', F.hasCdr ? `<div class="iv-big">${nfmt(F.located)} of ${nfmt(F.rows.length)} money events located</div><div class="small muted">${F.commonCells.length} common locations · ${F.commonImei.length} common handsets · ${F.sharedCells.length} cells shared by different CDR holders</div>` : '<div class="dim">No CDR uploaded yet.</div>', '#2979ff', 'fusion')}
      ${ivCard('Location hotspots', LO.length ? LO.slice(0, 4).map(x => `<div class="small"><b>${esc(x.label)}</b> — ${x.accts.length} a/c · ${esc(x.src.join(', '))}</div>`).join('') : '<div class="dim">No shared locations yet.</div>', '#00e5ff', 'loc')}
    </div>`;
  $$('[data-go]', B).forEach(c => c.onclick = () => { IV.tab = c.dataset.go; go('intel'); });
}
function ivDirect(B) {
  const R = anDirect(); const accts = R.sum;
  const sel = IV.acct && accts.some(s => s.key === IV.acct) ? IV.acct : '';
  const rows = sel ? R.rows.filter(r => (r.to ? r.to.id : 'X:' + (r.benef || 'unknown')) === sel) : R.rows;
  B.innerHTML = `<div class="grid g4" style="margin-bottom:14px">${kpi('Direct transactions', nfmt(R.n), 'complainant debits to Layer 1', 'rgba(255,46,136,.35)')}${kpi('Amount', inrShort(R.total), '', 'rgba(255,179,0,.35)')}${kpi('Same UTR both sides', nfmt(R.utrOk), 'complainant UTR found on Layer 1 credit', 'rgba(0,255,157,.3)')}${kpi('Layer 1 accounts', nfmt(accts.filter(s => s.to).length), accts.filter(s => !s.to).length + ' beneficiaries not uploaded', 'rgba(0,229,255,.3)')}</div>
    <div class="card" style="margin-bottom:14px"><div class="row sb"><h3 style="margin:0">Per Layer 1 account (amount and number of transactions)</h3><div class="row"><button id="dX1">⇩ Summary</button></div></div><div id="dSum" style="margin-top:10px"></div></div>
    <div class="card"><div class="row sb" style="flex-wrap:wrap"><div class="row"><label class="f">Show<select id="dSel"><option value="">All accounts — combined</option>${accts.map(s => `<option value="${esc(s.key)}" ${sel === s.key ? 'selected' : ''}>${esc(s.label)} (${s.n})</option>`).join('')}</select></label></div>
      <div class="row"><button id="dXone">⇩ Export this view</button><button id="dXall" class="btn-p">⇩ Export all — one sheet per account + combined</button></div></div><div id="dT" style="margin-top:10px"></div></div>`;
  $('#dSum', B).innerHTML = simpleTable(DSUM_COLS, accts, { maxH: 320, click: 1, empty: 'No complainant debits reach uploaded accounts yet. Upload complainant and Layer 1 statements, or mark disputed transactions.' });
  bindRows($('#dSum', B), accts, s => { IV.acct = s.key; go('intel'); });
  $('#dT', B).innerHTML = simpleTable(DIRECT_COLS, rows, { maxH: 520 });
  $('#dSel', B).onchange = e => { IV.acct = e.target.value; go('intel'); };
  $('#dX1', B).onclick = () => xlsxBook('Complainant_to_L1_summary', [{ name: 'Summary', cols: DSUM_COLS, rows: accts }]);
  $('#dXone', B).onclick = () => xlsxBook('Complainant_to_L1_' + (sel ? (accts.find(s => s.key === sel) || {}).label : 'combined'), [{ name: sel ? 'Account' : 'Combined', cols: DIRECT_COLS, rows }]);
  $('#dXall', B).onclick = () => xlsxBook('Complainant_to_L1_all', [{ name: 'Summary', cols: DSUM_COLS, rows: accts }, { name: 'Combined', cols: DIRECT_COLS, rows: R.rows }].concat(accts.map(s => ({ name: (s.to ? s.to.acctNo : s.label).slice(-28), cols: DIRECT_COLS, rows: R.rows.filter(r => (r.to ? r.to.id : 'X:' + (r.benef || 'unknown')) === s.key) }))));
}
const UPI_COLS = [{ label: 'UPI ID', html: u => `<span class="mono">${esc(u.upi)}</span>`, x: u => u.upi }, { label: 'Names seen', get: u => u.names.join(', ') }, { label: 'Debited to it', html: u => inr(u.dr), num: 1, x: u => u.dr }, { label: 'Txns', k: 'nDr', num: 1 }, { label: 'Credited from it', html: u => inr(u.cr), num: 1, x: u => u.cr }, { label: 'Txns ', k: 'nCr', num: 1 }, { label: 'Accounts', get: u => u.accts.join(', ') }];
const CP_COLS = [{ label: 'Person / account', get: p => p.who }, { label: 'Money sent to them (debits)', html: p => inr(p.dr), num: 1, x: p => p.dr }, { label: 'Money received from them (credits)', html: p => inr(p.cr), num: 1, x: p => p.cr }, { label: 'Txns', k: 'n', num: 1 }, { label: 'In accounts', get: p => p.accts.join(', ') }];
const POS_COLS = [{ label: 'POS / merchant place', get: p => p.place }, { label: 'Amount', html: p => inr(p.amt), num: 1, x: p => p.amt }, { label: 'Txns', k: 'n', num: 1 }, { label: 'Accounts', get: p => p.accts.join(', ') }, { label: 'First – last', get: p => fmtDT(p.first) + ' – ' + fmtDT(p.last) }];
const ACC_COLS = [{ label: 'Account', get: x => acctName(x.a) }, { label: 'Type', get: x => acctType(x.a) }, { label: 'Total debited', html: x => inr(x.dr), num: 1, x: x => x.dr }, { label: 'Debit txns', k: 'nDr', num: 1 }, { label: 'Total credited', html: x => inr(x.cr), num: 1, x: x => x.cr }, { label: 'Credit txns', k: 'nCr', num: 1 }];
function ivTypeSel(B, id) { return `<label class="f">Account type<select id="${id}"><option value="">All types</option>${ACCT_TYPES.map(t => `<option ${IV.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`; }
function ivUpi(B) {
  const R = anUpiPos(IV.type); const upD = R.upi.slice().sort((a, b) => b.dr - a.dr), upC = R.upi.slice().sort((a, b) => b.cr - a.cr), cpD = R.cp.slice().sort((a, b) => b.dr - a.dr), cpC = R.cp.slice().sort((a, b) => b.cr - a.cr), acD = R.acc.slice().sort((a, b) => b.dr - a.dr);
  B.innerHTML = `<div class="card" style="margin-bottom:14px"><div class="row sb">${ivTypeSel(B, 'uT')}<button id="uX" class="btn-p">⇩ Export (all tables)</button></div></div>
    <div class="grid g2"><div class="card"><h3>UPI IDs — maximum amount DEBITED to them</h3>${simpleTable(UPI_COLS, upD.slice(0, 50), { maxH: 360 })}</div><div class="card"><h3>UPI IDs — maximum amount CREDITED from them</h3>${simpleTable(UPI_COLS, upC.slice(0, 50), { maxH: 360 })}</div>
    <div class="card"><h3>Persons / accounts who RECEIVED the most</h3>${simpleTable(CP_COLS, cpD.slice(0, 50), { maxH: 360 })}</div><div class="card"><h3>Persons / accounts who SENT the most</h3>${simpleTable(CP_COLS, cpC.slice(0, 50), { maxH: 360 })}</div>
    <div class="card"><h3>POS / merchant places</h3>${simpleTable(POS_COLS, R.pos.slice(0, 50), { maxH: 360, empty: 'No POS or card purchases in the statements.' })}</div><div class="card"><h3>Accounts by money moved</h3>${simpleTable(ACC_COLS, acD, { maxH: 360 })}</div></div>`;
  $('#uT', B).onchange = e => { IV.type = e.target.value; go('intel'); };
  $('#uX', B).onclick = () => xlsxBook('UPI_Persons_POS' + (IV.type ? '_' + IV.type : ''), [{ name: 'UPI by debit', cols: UPI_COLS, rows: upD }, { name: 'UPI by credit', cols: UPI_COLS, rows: upC }, { name: 'Persons received', cols: CP_COLS, rows: cpD }, { name: 'Persons sent', cols: CP_COLS, rows: cpC }, { name: 'POS places', cols: POS_COLS, rows: R.pos }, { name: 'Accounts', cols: ACC_COLS, rows: acD }]);
}
const DORM_COLS = [{ label: 'Account', get: x => acctName(x.a) }, { label: 'Type', k: 'type' }, { label: 'Finding', html: x => badge(x.verdict, x.verdict.startsWith('Dormant →') ? 'red' : x.verdict.startsWith('Dormant') ? 'amber' : 'violet'), x: x => x.verdict }, { label: 'Last activity before', get: x => x.lastBefore ? fmtDate(x.lastBefore) : '—' }, { label: 'Silent days', k: 'gap', num: 1 }, { label: 'Reactivated on', get: x => fmtDT(x.restart) },
  { label: 'Txns / month before', k: 'preMonthly', num: 1 }, { label: 'Txns in 30 days after', k: 'postN', num: 1 }, { label: 'Amount in 30 days after', html: x => inr(x.postAmt), num: 1, x: x => x.postAmt }, { label: 'Times normal', k: 'ratio', num: 1 }, { label: 'First credit after reactivation', get: x => x.firstCr ? inr(x.firstCr.cr) + ' · ' + fmtDT(x.firstCr.ts, x.firstCr.hasTime) + ' · ' + (x.firstCr.cpName || x.firstCr.upi || '') : '' }];
function ivDormant(B) {
  const R = anDormant();
  B.innerHTML = `<div class="card" style="margin-bottom:14px"><div class="row sb" style="align-items:flex-end"><div class="row"><label class="f">Silent for at least (days)<input id="dmD" type="number" min="15" value="${INTEL.dormantDays}" style="width:110px"></label></div><button id="dmX" class="btn-p">⇩ Export</button></div>
      <p class="small dim" style="margin:8px 0 0">An account is flagged when it had no transactions for the chosen number of days and then became active, or when its activity in 30 days is at least 5 times its normal monthly level (and 10 or more transactions).</p></div>
    <div class="card">${simpleTable(DORM_COLS, R, { maxH: 560, empty: 'No dormant or suddenly active accounts found.' })}</div>`;
  $('#dmD', B).onchange = e => { INTEL.dormantDays = Math.max(15, +e.target.value || 90); S.derived && (S.derived.intel = null); go('intel'); };
  $('#dmX', B).onclick = () => xlsxBook('Dormant_accounts', [{ name: 'Dormant accounts', cols: DORM_COLS, rows: R }]);
}
const PEAKT_COLS = [{ label: 'Account type', k: 'type' }, { label: 'Busiest date (most transactions)', k: 'date' }, { label: 'Transactions that day', k: 'n', num: 1 }, { label: 'Accounts active that day', get: x => x.accts.length + ': ' + x.accts.slice(0, 6).join(', ') }, { label: 'Date with highest amount', k: 'amtDate' }, { label: 'Amount that day', html: x => inr(x.amt), num: 1, x: x => x.amt }, { label: 'Next busiest dates', get: x => x.top5.slice(1).map(d => d.date + ' (' + d.n + ')').join(', ') }];
const PEAKA_COLS = [{ label: 'Account', get: x => acctName(x.a) }, { label: 'Type', k: 'type' }, { label: 'Busiest date', k: 'date' }, { label: 'Txns that day', k: 'n', num: 1 }, { label: 'Debit that day', html: x => inr(x.dr), num: 1, x: x => x.dr }, { label: 'Credit that day', html: x => inr(x.cr), num: 1, x: x => x.cr }, { label: 'Total txns', k: 'total', num: 1 }, { label: 'Active days', k: 'days', num: 1 }];
function ivPeak(B) {
  const R = anPeak();
  B.innerHTML = `<div class="card" style="margin-bottom:14px"><div class="row sb"><h3 style="margin:0">Busiest date for each account type</h3><button id="pkX" class="btn-p">⇩ Export</button></div><div style="margin-top:10px">${simpleTable(PEAKT_COLS, R.types, { maxH: 300 })}</div></div>
    <div class="card"><h3>Busiest date of each account</h3>${simpleTable(PEAKA_COLS, R.byAcct, { maxH: 520 })}</div>`;
  $('#pkX', B).onclick = () => xlsxBook('Peak_dates', [{ name: 'By account type', cols: PEAKT_COLS, rows: R.types }, { name: 'By account', cols: PEAKA_COLS, rows: R.byAcct }]);
}
const TEST_COLS = [{ label: 'Date & time', get: r => fmtDT(r.t.ts, r.t.hasTime) }, { label: 'Account', get: r => acctName(r.a) }, { label: 'Type', k: 'type' }, { label: 'Sent / received', k: 'dir' }, { label: 'Amount', html: r => r.one ? `<b style="color:var(--red)">${inr(r.amt)}</b>` : inr(r.amt), num: 1, x: r => r.amt }, { label: 'Other party', get: r => r.cp }, { label: 'Narration', get: r => (r.t.narr || '').slice(0, 80) }];
const TESTA_COLS = [{ label: 'Account', get: x => acctName(x.a) }, { label: 'Type', k: 'type' }, { label: 'Test txns', k: 'n', num: 1 }, { label: 'Exactly ₹1', k: 'ones', num: 1 }, { label: 'First', get: x => fmtDT(x.first) }, { label: 'Last', get: x => fmtDT(x.last) }, { label: 'Other parties', get: x => x.cps.slice(0, 5).join(', ') }];
function ivTest(B) {
  const R = anTest(); const F = anFusion(); const locOf = new Map(F.rows.filter(r => r.role === 'Test transaction').map(r => [r.t.id, r.locs]));
  const cols = TEST_COLS.concat([{ label: 'Phone location at that time', get: r => (locOf.get(r.t.id) || []).map(l => l.num + ': ' + (l.addr || 'cell ' + l.cell)).join('; ') }]);
  B.innerHTML = `<div class="card" style="margin-bottom:14px"><div class="row sb" style="align-items:flex-end"><label class="f">Treat as test transaction up to (₹)<input id="ttM" type="number" min="1" value="${INTEL.testMax}" style="width:110px"></label><button id="ttX" class="btn-p">⇩ Export</button></div>
      <p class="small dim" style="margin:8px 0 0">Small credits such as ₹1 are often sent to check that an account is live (not frozen) before the fraud money is moved.</p></div>
    <div class="grid g2" style="margin-bottom:14px"><div class="card"><h3>Accounts with test transactions</h3>${simpleTable(TESTA_COLS, R.byAcct, { maxH: 300 })}</div>
      <div class="card"><h3>Interconnections</h3><h4 class="small">Same sender / party to different accounts</h4>${simpleTable([{ label: 'Party', k: 'cp' }, { label: 'Accounts', get: x => x.accts.join(', ') }, { label: 'Txns', k: 'n', num: 1 }], R.cpLinks, { maxH: 150, empty: 'None found.' })}
        <h4 class="small" style="margin-top:10px">Test transactions in different accounts within 1 hour</h4>${simpleTable([{ label: 'From', get: x => fmtDT(x.from) }, { label: 'To', get: x => fmtDT(x.to) }, { label: 'Accounts', get: x => x.accts.join(', ') }, { label: 'Txns', k: 'n', num: 1 }], R.clusters, { maxH: 150, empty: 'None found.' })}</div></div>
    <div class="card"><h3>All test transactions</h3>${simpleTable(cols, R.rows, { maxH: 480, empty: 'No transactions of this size.' })}</div>`;
  $('#ttM', B).onchange = e => { INTEL.testMax = Math.max(1, +e.target.value || 10); S.derived && (S.derived.intel = null); go('intel'); };
  $('#ttX', B).onclick = () => xlsxBook('Test_transactions', [{ name: 'By account', cols: TESTA_COLS, rows: R.byAcct }, { name: 'All test txns', cols, rows: R.rows }, { name: 'Common senders', cols: [{ label: 'Party', k: 'cp' }, { label: 'Accounts', get: x => x.accts.join(', ') }, { label: 'Txns', k: 'n' }], rows: R.cpLinks }, { name: 'Time clusters', cols: [{ label: 'From', get: x => fmtDT(x.from) }, { label: 'To', get: x => fmtDT(x.to) }, { label: 'Accounts', get: x => x.accts.join(', ') }, { label: 'Txns', k: 'n' }], rows: R.clusters }]);
}
const FUS_COLS = [{ label: 'Account', get: r => acctName(r.a) }, { label: 'Type', k: 'type' }, { label: 'Event', k: 'role' }, { label: 'Amount', html: r => inr(r.amt), num: 1, x: r => r.amt }, { label: 'Statement date', get: r => fmtDT(r.t.ts, r.t.hasTime) }, { label: 'Time used', get: r => r.ts != null ? fmtDT(r.ts) : '—' }, { label: 'Time source', k: 'src' },
  { label: 'Linked number(s)', get: r => r.nums.join(', ') || 'no CDR for linked numbers' }, { label: 'Location at that time', html: r => r.locs.length ? r.locs.map(l => `<div><b class="mono">${esc(l.num)}</b> ${esc(l.addr || 'cell ' + l.cell)} <span class="dim">(±${l.dt} min${l.imei ? ' · IMEI ' + esc(l.imei) : ''})</span></div>`).join('') : '<span class="dim">—</span>', x: r => r.locs.map(l => l.num + ': ' + (l.addr || 'cell ' + l.cell) + ' (±' + l.dt + ' min) IMEI ' + (l.imei || '')).join(' | ') }];
const CC_COLS = [{ label: 'Location (cell / address)', get: x => x.addr || 'Cell ' + x.cell }, { label: 'Cell ID', k: 'cell' }, { label: 'Different accounts', get: x => x.accts.length + ': ' + x.accts.join(', ') }, { label: 'Numbers', get: x => x.nums.join(', ') }, { label: 'Money events', k: 'n', num: 1 }, { label: 'Amount', html: x => inr(x.amt), num: 1, x: x => x.amt }];
const IM_COLS = [{ label: 'IMEI (handset)', html: x => `<span class="mono">${esc(x.imei)}</span>`, x: x => x.imei }, { label: 'Numbers used in it', get: x => x.nums.map((n, i) => n + (x.names[i] ? ' (' + x.names[i] + ')' : '')).join(', ') }, { label: 'Linked accounts', get: x => x.accts.join(', ') }];
const SC_COLS = [{ label: 'Location', get: x => x.addr || 'Cell ' + x.cell }, { label: 'Cell ID', k: 'cell' }, { label: 'CDR holders seen here', get: x => x.nums.map((n, i) => (x.names[i] ? x.names[i] + ' ' : '') + n).join(', ') }, { label: 'Holders', get: x => x.nums.length, num: 1 }, { label: 'Records', k: 'events', num: 1 }, { label: 'Linked accounts', get: x => x.accts.join(', ') }];
const TC_COLS = [{ label: 'Number', k: 'num' }, { label: 'Name', k: 'name' }, { label: 'Role', k: 'role' }, { label: 'Linked accounts', get: x => x.accts.join(', ') }, { label: 'Most frequent locations', get: x => x.top.map(t => (t.addr || 'cell ' + t.cell) + ' (' + t.pct + '%)').join('; ') }];
function ivFusion(B) {
  const F = anFusion();
  if (!F.hasCdr) { B.innerHTML = emptyState('Upload CDRs of the complainant and of the numbers linked to the accused / suspect accounts (Upload Center → step 3). Link each CDR to its bank account, or import KYC so the linked numbers are known.', `<button class="btn-p" id="fUp">⇪ Upload Center</button>`); $('#fUp', B).onclick = () => go('upload'); return; }
  B.innerHTML = `<div class="grid g4" style="margin-bottom:14px">${kpi('Money events', nfmt(F.rows.length), 'credits and debits in the trail', 'rgba(0,229,255,.3)')}${kpi('Time fixed', nfmt(F.timed), 'from statement or bank SMS', 'rgba(179,136,255,.35)')}${kpi('Located', nfmt(F.located), 'phone location at that time', 'rgba(0,255,157,.3)')}${kpi('Interconnections', nfmt(F.commonCells.length + F.commonImei.length), `${F.commonCells.length} common locations · ${F.commonImei.length} common handsets`, 'rgba(255,46,136,.35)')}</div>
    <div class="card iv-brk" style="margin-bottom:14px"><div class="row sb"><h3 style="margin:0">⚡ Breakthrough — different accounts, same location or same handset</h3><button id="fX" class="btn-p">⇩ Export all</button></div>
      <h4 class="small" style="margin-top:10px">Same location while money moved</h4>${simpleTable(CC_COLS, F.commonCells, { maxH: 260, empty: 'No common location at transaction times yet.' })}
      <h4 class="small" style="margin-top:10px">Same handset (IMEI) used by different numbers</h4>${simpleTable(IM_COLS, F.commonImei, { maxH: 200, empty: 'No common handset.' })}</div>
    ${F.located ? '<div class="card" style="margin-bottom:14px"><h3>Map of phone locations at transaction times</h3><div id="fMap" class="geo-map" style="height:420px"></div></div>' : ''}
    <div class="card" style="margin-bottom:14px"><h3>Where each linked number was when money moved</h3><p class="small dim">Time source order: statement time → time from the linked statement on the other side → bank SMS in the CDR of the account-linked number or the complainant (when the statement has only the date). The nearest CDR record within ±${INTEL.fusionWinMin} min (±${INTEL.smsWinMin} min for SMS time) gives the cell and handset.</p>${simpleTable(FUS_COLS, F.rows, { maxH: 520 })}</div>
    <div class="grid g2"><div class="card"><h3>Locations visited by different CDR holders (whole CDR period)</h3>${simpleTable(SC_COLS, F.sharedCells.slice(0, 300), { maxH: 380, empty: 'None.' })}</div>
      <div class="card"><h3>Most frequent locations of each number (suspect feature)</h3>${simpleTable(TC_COLS, F.topCells, { maxH: 380 })}</div></div>`;
  $('#fX', B).onclick = () => xlsxBook('CDR_location_intelligence', [{ name: 'Common locations', cols: CC_COLS, rows: F.commonCells }, { name: 'Common IMEI', cols: IM_COLS, rows: F.commonImei }, { name: 'Location at txn time', cols: FUS_COLS, rows: F.rows }, { name: 'Shared cells', cols: SC_COLS, rows: F.sharedCells }, { name: 'Top cells per number', cols: TC_COLS, rows: F.topCells }]);
  const pts = F.rows.flatMap(r => r.locs.filter(l => l.lat != null && l.lon != null).map(l => ({ r, l })));
  if ($('#fMap', B) && typeof L !== 'undefined') {
    if (GEO_MAP) { try { GEO_MAP.remove(); } catch {} GEO_MAP = null; }
    const map = GEO_MAP = L.map($('#fMap', B), { preferCanvas: true }).setView([22.5, 80], 5);
    if (S.prefs.mapTiles) L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap contributors' }).addTo(map);
    const colors = ['#ff2e88', '#00e5ff', '#ffb300', '#00ff9d', '#b388ff', '#ff6e40', '#2f9bff']; const accs = uniq(pts.map(p => p.r.a.acctNo)); const b = [];
    for (const { r, l } of pts) { const col = colors[accs.indexOf(r.a.acctNo) % colors.length]; b.push([l.lat, l.lon]); L.circleMarker([l.lat, l.lon], { radius: 8, color: col, fillColor: col, fillOpacity: .5, weight: 2 }).addTo(map).bindPopup(`<b>${esc(acctName(r.a))}</b><br>${esc(r.role)} ${esc(inr(r.amt))}<br>${esc(fmtDT(r.ts))}<br>${esc(l.num)} · ${esc(l.addr || 'cell ' + l.cell)}`); }
    if (b.length) map.fitBounds(b, { padding: [30, 30], maxZoom: 14 }); else $('#fMap', B).insertAdjacentHTML('beforeend', '<div class="small dim" style="position:absolute;z-index:500;padding:10px">The CDRs have no latitude / longitude columns — see the addresses in the table below.</div>');
    setTimeout(() => map.invalidateSize(), 150);
  }
}
const LOC_COLS = [{ label: 'Location', get: x => x.label }, { label: 'Interconnection', html: x => x.link ? badge(x.accts.length >= 2 ? x.accts.length + ' accounts' : x.nums.length >= 2 ? x.nums.length + ' numbers' : 'several sources', 'red') : '', x: x => x.link ? 'YES' : '' }, { label: 'Found in', get: x => x.src.join(', ') }, { label: 'Accounts', get: x => x.accts.join(', ') }, { label: 'Numbers', get: x => x.nums.join(', ') }, { label: 'Events', k: 'n', num: 1 }, { label: 'Amount', html: x => x.amt ? inr(x.amt) : '', num: 1, x: x => x.amt },
  { label: '', html: x => `<a class="btn-sm" target="_blank" rel="noopener noreferrer" href="${gmapsUrl(x.label, x.lat, x.lon)}">⌖ Map</a>` }];
function ivLoc(B) {
  const R = anLocations();
  B.innerHTML = `<div class="card"><div class="row sb"><p class="small dim" style="margin:0;max-width:760px">Locations from ATM withdrawals, POS purchases, branches (IFSC) of the accounts, and CDR cell locations of the linked numbers. Rows marked in red are places linked to two or more different accounts or numbers.</p><button id="lX" class="btn-p">⇩ Export</button></div><div style="margin-top:10px">${simpleTable(LOC_COLS, R, { maxH: 620, empty: 'No locations yet. Import the ATM database / IFSC details or CDRs.' })}</div></div>`;
  $('#lX', B).onclick = () => xlsxBook('Location_hotspots', [{ name: 'Locations', cols: LOC_COLS, rows: R }]);
}
function exportIntelAll() {
  const D1 = anDirect(), U = anUpiPos(), P = anPeak(), TT = anTest(), F = anFusion();
  xlsxBook('Case_Intelligence_all', [{ name: 'L1 summary', cols: DSUM_COLS, rows: D1.sum }, { name: 'Complainant to L1', cols: DIRECT_COLS, rows: D1.rows }, { name: 'UPI', cols: UPI_COLS, rows: U.upi.slice().sort((a, b) => (b.dr + b.cr) - (a.dr + a.cr)) }, { name: 'Persons', cols: CP_COLS, rows: U.cp.slice().sort((a, b) => (b.dr + b.cr) - (a.dr + a.cr)) }, { name: 'POS places', cols: POS_COLS, rows: U.pos },
    { name: 'Dormant', cols: DORM_COLS, rows: anDormant() }, { name: 'Peak by type', cols: PEAKT_COLS, rows: P.types }, { name: 'Peak by account', cols: PEAKA_COLS, rows: P.byAcct }, { name: 'Test txns', cols: TEST_COLS, rows: TT.rows }, { name: 'Test by account', cols: TESTA_COLS, rows: TT.byAcct },
    { name: 'Location at txn time', cols: FUS_COLS, rows: F.rows }, { name: 'Common locations', cols: CC_COLS, rows: F.commonCells }, { name: 'Common IMEI', cols: IM_COLS, rows: F.commonImei }, { name: 'Shared CDR cells', cols: SC_COLS, rows: F.sharedCells }, { name: 'Location hotspots', cols: LOC_COLS, rows: anLocations() }]);
}
/* PDF: Case Intelligence Report */
function reportIntel() {
  const R = pdfDoc('Case Intelligence Report'); const txt = (cols, rows, n = 60) => [cols.map(c => c.label), rows.slice(0, n).map(r => cols.map(c => { const v = c.x ? c.x(r) : c.get ? c.get(r) : r[c.k]; return typeof v === 'number' && c.num ? (Number.isInteger(v) ? nfmt(v) : inrP(v)) : String(v == null ? '' : v).slice(0, 120); }))];
  const tb = (cols, rows, n) => { const [h, b] = txt(cols, rows, n); R.table(h, b); if (rows.length > n) R.p(`… ${rows.length - n} more rows in the Excel export.`, 7.5); };
  const D1 = anDirect(), U = anUpiPos(), DM = anDormant(), P = anPeak(), TT = anTest(), F = anFusion(), LO = anLocations();
  R.h('Case details'); R.kv(caseKv());
  R.h('1. Key findings');
  R.kv([['Complainant → Layer 1', `${D1.n} transactions, ${inrP(D1.total)}; ${D1.utrOk} with the same UTR on both statements; ${D1.sum.filter(s => s.to).length} Layer 1 accounts`], ['Dormant / sudden activity', `${DM.length} account(s) flagged`], ['Test transactions', `${TT.rows.length} in ${TT.byAcct.length} account(s); ${TT.cpLinks.length} common sender(s)`], ['CDR location intelligence', F.hasCdr ? `${F.located} of ${F.rows.length} money events located; ${F.commonCells.length} common location(s); ${F.commonImei.length} common handset(s)` : 'No CDR uploaded'], ['Locations linked to 2+ accounts / numbers', String(LO.filter(x => x.link).length)]]);
  R.h('2. Complainant → Layer 1: per account'); tb(DSUM_COLS, D1.sum, 80);
  R.h('3. Complainant → Layer 1: transactions'); tb(DIRECT_COLS, D1.rows, 200);
  R.h('4. UPI IDs by amount'); tb(UPI_COLS, U.upi.slice().sort((a, b) => (b.dr + b.cr) - (a.dr + a.cr)), 40);
  R.h('5. Persons / accounts by amount'); tb(CP_COLS, U.cp.slice().sort((a, b) => (b.dr + b.cr) - (a.dr + a.cr)), 40);
  R.h('6. POS / merchant places'); tb(POS_COLS, U.pos, 30);
  R.h('7. Dormant accounts with sudden activity'); tb(DORM_COLS, DM, 60);
  R.h('8. Peak transaction dates'); tb(PEAKT_COLS, P.types, 10); tb(PEAKA_COLS, P.byAcct, 80);
  R.h('9. Test (small-value) transactions'); tb(TESTA_COLS, TT.byAcct, 60); if (TT.cpLinks.length) tb([{ label: 'Common sender', k: 'cp' }, { label: 'Accounts', get: x => x.accts.join(', ') }, { label: 'Txns', k: 'n' }], TT.cpLinks, 30);
  R.h('10. CDR location intelligence — interconnections'); tb(CC_COLS, F.commonCells, 40); tb(IM_COLS, F.commonImei, 40); tb(SC_COLS, F.sharedCells, 40);
  R.h('11. Location of linked numbers at transaction times'); tb(FUS_COLS, F.rows.filter(r => r.locs.length), 150);
  R.h('12. Location hotspots'); tb(LOC_COLS.slice(0, 7), LO, 60);
  R.h('Notes'); R.p('All findings are investigative leads derived from the uploaded records. Locations are CDR / cell-site correlations, not exact positions. Times taken from bank SMS in a CDR are approximate when several SMS were received on the same day. Verify with the banks and telecom operators before use in any report to court.');
  R.save('Case_Intelligence_Report');
}
