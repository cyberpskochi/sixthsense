/* ================================ UPLOAD ================================
   NCRP Trail → Bank Accounts (complainant / accused / suspects) → CDR → Bank login IP.
   Every file still goes through hashing, parsing and validation; files that pass
   are imported automatically, the rest show a Review button.                      */
const FILE_ACCEPT = '.xlsx,.xls,.xlsm,.xlsb,.csv,.txt,.tsv,.pdf,.ods,.html,.htm,.mht,.mhtml,.rpt,.prn,.lst,.dat,.xml';
const UP = { q: {}, extra: { comp: [], acc: [], sus: [] }, seg: 'comp', caseId: '' };
function upReset() { if (UP.caseId !== (S.cur && S.cur.meta.id)) { UP.q = {}; UP.extra = { comp: [], acc: [], sus: [] }; UP.caseId = S.cur && S.cur.meta.id; } }
function pickFiles(multi, cb) { const i = document.createElement('input'); i.type = 'file'; i.multiple = multi; i.accept = FILE_ACCEPT; i.onchange = () => cb(Array.from(i.files)); i.click(); }
/* Queue → parse → auto-import when confident. `key` groups queue items for status display. */
async function quickImport(key, files, kind, opts, redraw) {
  const qs = files.map(f => ({ id: rid(6), file: f, kind, status: 'queued', opts: Object.assign({}, IMP.opts, { bank: 'AUTO', dup: 'merge', tz: 'IST', role: 'AUTO', acctNo: '', target: '' }, opts) }));
  UP.q[key] = (UP.q[key] || []).concat(qs); IMP.queue.push(...qs); redraw && redraw();
  pumpQueue(); while (qs.some(q => ['queued', 'parsing'].includes(q.status))) await sleep(250);
  let n = 0; for (const q of qs) if (q.status === 'ready') { try { await commitQueued(q); n++; } catch (e) { q.status = 'error'; q.err = e.message; } }
  if (n) upAfterImport(kind);
  redraw && redraw(); return qs;
}
function upAfterImport(kind) {
  refreshStmtStats(); rebuildIndexes(); S.derived = null;
  if (kind === 'statement' || kind === 'ncrp') { markSeedsFromNcrp(); autoSeedComplainant(); S.derived = null; }
  markDirty(...PARTS.filter(p => p !== 'audit')); renderNav();
}
function qStatus(key) {
  const l = UP.q[key] || []; if (!l.length) return '';
  const q = l[l.length - 1]; const st = QSTAT[q.status]; const more = l.length > 1 ? ` <span class="dim small">+${l.length - 1} file(s)</span>` : '';
  return `${badge(st[0], st[1])}${more}${q.status === 'review' ? ` <button class="btn-sm" data-qrev="${q.id}">Review</button>` : ''}${q.err ? `<div class="small" style="color:var(--red)">${esc(q.err)}</div>` : ''}${(q.reasons || []).length && q.status === 'review' ? `<div class="small dim">${esc(q.reasons.join(' · '))}</div>` : ''}`;
}
function bindReview(host, redraw) {
  $$('[data-qrev]', host).forEach(b => b.onclick = () => { const q = IMP.queue.find(x => x.id === b.dataset.qrev); if (!q) return; reviewModal(q);
    const t = setInterval(async () => { if (!document.contains(b)) { clearInterval(t); } if (q.status === 'ready' && !$('#modalRoot .modal')) { clearInterval(t); await commitQueued(q); upAfterImport(q.kind); redraw(); } }, 600); });
}
function upSteps(active) {
  const st = [['up_ncrp', '1', 'NCRP Trail'], ['up_bank', '2', 'Bank Accounts'], ['up_cdr', '3', 'CDR'], ['up_ip', '4', 'Bank Login IP']];
  return `<div class="up-steps">${st.map(([k, n, t]) => `<button class="${active === k ? 'on' : ''}" data-step="${k}"><span>${n}</span>${t}</button>`).join('<i>›</i>')}</div>`;
}
function bindSteps(el) { $$('[data-step]', el).forEach(b => b.onclick = () => go(b.dataset.step)); }

/* ---------------------------------- 1 · NCRP TRAIL ---------------------------------- */
function ncrpComplainants() {
  const c = S.cur; const m = new Map();
  for (const r of c.work.ncrp) if (r.fromAcct && (r.layer ?? 1) <= 1) m.set(acctKey(r.fromAcct), r.fromAcct);
  for (const a of c.accts) if (a.role === 'Complainant' || a.layerNcrp === 0) m.set(acctKey(a.acctNo), a.acctNo);
  return Array.from(m.values());
}
function ncrpFraudRows() { const rows = S.cur.work.ncrp.filter(r => (r.layer ?? 1) === 1); const disp = rows.some(r => r.disputed > 0); const seen = new Set(); return rows.filter(r => (!disp || r.disputed > 0) && !seen.has(r.utr || r.id) && seen.add(r.utr || r.id)); }
VIEWS.up_ncrp = el => {
  upReset(); const c = S.cur; const has = c.work.ncrp.length > 0;
  el.innerHTML = pageHead('NCRP Trail', 'Upload the transaction-details Excel of each acknowledgement number from the NCRP / I4C portal. SIXTH SENSE reads it at once: complainant accounts, reported fraud transactions, banks involved and how the money left the banking network.') + upSteps('up_ncrp') +
    `<div class="drop up-drop" id="nDrop"><div class="ic">⇪</div><b>Drop the NCRP Excel here or click to choose</b><div class="small muted">One or more acknowledgement numbers · Excel / CSV / HTML</div><div id="nQ" style="margin-top:10px"></div></div><div id="nRes"></div>`;
  bindSteps(el);
  const drop = $('#nDrop', el); const redraw = () => { $('#nQ', el).innerHTML = qStatus('ncrp'); bindReview($('#nQ', el), () => go('up_ncrp')); };
  const run = async fs => { if (!fs.length) return; await quickImport('ncrp', fs, 'ncrp', {}, redraw); for (const no of ncrpComplainants()) { const a = ensureAcct(no, {}); a.role = 'Complainant'; if (a.layerNcrp == null) a.layerNcrp = 0; } upAfterImport('ncrp'); go('up_ncrp'); };
  drop.onclick = e => { if (e.target.closest('button')) return; pickFiles(true, run); };
  drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); }; drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); run(Array.from(e.dataTransfer.files)); };
  redraw();
  if (!has) { $('#nRes', el).innerHTML = `<div class="notice" style="margin-top:14px">No NCRP report in this case yet. You can also start directly with <a href="#" id="toBank">Bank Accounts</a>.</div>`; $('#toBank', el).onclick = e => { e.preventDefault(); go('up_bank'); }; return; }
  const m = ncrpModel(Object.assign({}, NCRPF, { cash: 1, ack: '' })); const fr = ncrpFraudRows(); const comp = ncrpComplainants();
  const l1 = Array.from(m.N.values()).filter(n => !n.exit && n.layer === 1); const banksL1 = uniq(l1.map(n => n.bank).filter(Boolean));
  const stL1 = uniq(l1.map(n => (n.info || GEO.info(n.ifsc) || {}).state).filter(Boolean));
  const acts = ['ATM', 'CHEQUE', 'AEPS', 'POS', 'CASH', 'HOLD'].map(k => { const rs = c.work.ncrp.filter(r => r.action === k); return { k, n: rs.length, amt: round2(sum(rs, r => k === 'HOLD' ? (r.hold || r.amount) : (r.amount || r.disputed))) }; });
  const byBank = Array.from(groupBy(Array.from(m.N.values()).filter(n => !n.exit && n.id !== 'VICTIM' && n.layer > 0), n => (n.bank || 'Unknown') + '|' + n.layer).entries()).map(([k, ns]) => ({ bank: k.split('|')[0], layer: +k.split('|')[1], n: ns.length, amt: round2(sum(ns, x => x.in)), hold: round2(sum(ns, x => x.hold)) })).sort((a, b) => a.layer - b.layer || b.amt - a.amt);
  const acks = uniq(c.work.ncrp.map(r => r.ackNo).filter(Boolean));
  $('#nRes', el).innerHTML = `<div class="grid g4" style="margin:14px 0">
      ${kpi('Total amount lost', inrShort(m.fraud), `${acks.length || 1} complaint(s) · ${nfmt(fr.length)} reported transactions`, 'rgba(255,77,94,.35)')}
      ${kpi('Banks in Layer 1', nfmt(banksL1.length), banksL1.slice(0, 3).join(', ') + (banksL1.length > 3 ? '…' : ''), 'rgba(255,179,0,.35)')}
      ${kpi('States (Layer 1 banks)', nfmt(stL1.length), stL1.slice(0, 4).join(', ') || 'from IFSC — look up in IFSC & ATM Map', 'rgba(0,229,255,.3)')}
      ${kpi('Amount on hold', inrShort(acts.find(a => a.k === 'HOLD').amt), 'put on hold by banks', 'rgba(0,255,157,.3)')}</div>
    <div class="grid g2" style="margin-bottom:14px">
      <div class="card"><h3>Complainant account(s)</h3><p class="small muted" style="margin-top:0">${comp.length ? 'Detected automatically from the NCRP report. Add any other account of the complainant below.' : 'The NCRP file does not show the complainant account. Enter it below.'}</p>
        <div id="cmpT"></div><div class="row" style="margin-top:8px"><input id="cmpNo" placeholder="Complainant account no." class="mono" style="max-width:240px"><input id="cmpNm" placeholder="Name of account holder" style="max-width:240px"><button id="cmpAdd" class="btn-sm btn-p">＋ Add account</button></div></div>
      <div class="card"><h3>How the money left the banking network</h3>${simpleTable([{ label: 'Mode', get: x => ACT_NAME[x.k] }, { label: 'Transactions', k: 'n', num: 1 }, { label: 'Amount', html: x => inr(x.amt), num: 1 }], acts.filter(a => a.n), { maxH: 240, empty: 'No withdrawals reported yet.' })}</div></div>
    <div class="card" style="margin-bottom:14px"><div class="row sb"><h3 style="margin:0">Reported fraud transactions (Layer 1)</h3><div class="row"><button id="frX">⇩ Excel</button><button class="btn-p" id="goVer">▶ Verify with statements</button></div></div><div id="frT" style="margin-top:10px"></div></div>
    <div class="card" style="margin-bottom:14px"><div class="row sb"><h3 style="margin:0">Banks involved (layer-wise)</h3><button class="btn-sm" id="goBank">⇪ Upload their statements →</button></div><div style="margin-top:10px">${simpleTable([{ label: 'Layer', get: x => 'L' + x.layer }, { label: 'Bank / wallet', k: 'bank' }, { label: 'Accounts', k: 'n', num: 1 }, { label: 'Received', html: x => inr(x.amt), num: 1 }, { label: 'On hold', html: x => x.hold ? inr(x.hold) : '', num: 1 }], byBank, { maxH: 360 })}</div></div>
    <div class="row" style="justify-content:flex-end;gap:8px"><button id="goGraph">⌬ Open NCRP Graph</button><button class="btn-p" id="goNext">Next: Bank Accounts ›</button></div>`;
  const cmpRows = comp.map(no => { const a = IX.acctByKey.get(acctKey(no)); return { no, a }; });
  $('#cmpT', el).innerHTML = simpleTable([{ label: 'Account', html: r => `<span class="mono">${esc(r.no)}</span>` }, { label: 'Holder', get: r => r.a ? r.a.holder : '' }, { label: 'Bank', get: r => r.a ? r.a.bank : '' }, { label: 'Statement', html: r => r.a && (IX.txByAcct.get(r.a.id) || []).length ? badge('Uploaded', 'green') : badge('Not uploaded', 'amber') }], cmpRows, { maxH: 200, empty: 'No complainant account yet.' });
  const frCols = [{ label: 'Ack No.', k: 'ackNo' }, { label: 'Date', get: r => r.ts ? fmtDT(r.ts, r.hasTime) : '' }, { label: 'UTR / Txn ID', html: r => `<span class="mono">${esc(r.utr)}</span>`, x: r => r.utr }, { label: 'Amount', html: r => inr(r.disputed || r.amount), num: 1, x: r => r.disputed || r.amount }, { label: 'From (complainant)', k: 'fromAcct' }, { label: 'To (Layer 1)', k: 'acctNo' }, { label: 'Bank', k: 'bank' }, { label: 'Action by bank', get: r => r.status || ACT_NAME[r.action] || '' }];
  $('#frT', el).innerHTML = simpleTable(frCols, fr, { maxH: 420 });
  $('#frX', el).onclick = () => exportTable('NCRP reported transactions', frCols, fr);
  $('#cmpAdd', el).onclick = () => { const no = normAcct($('#cmpNo', el).value); if (no.length < 6) return toast('Enter the complainant account number', 'warn'); const a = ensureAcct(no, {}); a.role = 'Complainant'; a.layerNcrp = 0; const nm = $('#cmpNm', el).value.trim(); if (nm) a.holder = nm; upAfterImport('statement'); audit('Added complainant account', no); go('up_ncrp'); };
  $('#goVer', el).onclick = () => go('verify'); $('#goBank', el).onclick = () => { UP.seg = 'acc'; go('up_bank'); }; $('#goGraph', el).onclick = () => go('ncrp'); $('#goNext', el).onclick = () => go('up_bank');
};

/* ---------------------------------- 2 · BANK ACCOUNTS ---------------------------------- */
function upAccountRows(seg) {
  const c = S.cur; const rows = new Map(); const add = (no, o) => { const k = acctKey(no); if (!k) return; const r = rows.get(k) || { no: normAcct(no), src: new Set(), amt: 0, hold: 0, bank: '', ifsc: '' }; Object.keys(o).forEach(x => { if (x === 'src') r.src.add(o.src); else if (x === 'amt' || x === 'hold') r[x] += o[x] || 0; else if (o[x] && !r[x]) r[x] = o[x]; }); rows.set(k, r); };
  const want = seg === 'comp' ? (l => l === 0) : seg === 'acc' ? (l => l === 1) : (l => l >= 2);
  if (c.work.ncrp.length) { const m = ncrpModel(Object.assign({}, NCRPF, { cash: 0, ack: '' })); for (const n of m.N.values()) if (!n.exit && n.id !== 'VICTIM' && n.layer != null && want(n.layer)) add(n.id, { src: 'NCRP', bank: n.bank, ifsc: n.ifsc, amt: n.in, hold: n.hold }); }
  if (seg === 'comp') ncrpComplainants().forEach(no => add(no, { src: 'NCRP' }));
  const roleOk = a => seg === 'comp' ? a.role === 'Complainant' : seg === 'acc' ? /L1|accused/i.test(a.role || '') : /suspect|L2|L3/i.test(a.role || '');
  for (const a of c.accts) if (roleOk(a)) add(a.acctNo, { src: (IX.txByAcct.get(a.id) || []).length ? 'Statement' : 'Added', bank: a.bank, ifsc: a.ifsc });
  for (const x of UP.extra[seg]) add(x.no, { src: 'Added' });
  return Array.from(rows.values()).map(r => { const a = IX.acctByKey.get(acctKey(r.no)); return Object.assign(r, { a, src: Array.from(r.src), n: a ? (IX.txByAcct.get(a.id) || []).length : 0, amt: round2(r.amt), hold: round2(r.hold) }); }).sort((x, y) => y.amt - x.amt);
}
const SEG_ROLE = { comp: 'Complainant', acc: 'Accused (L1)', sus: 'Suspect (L2)' };
VIEWS.up_bank = el => {
  upReset(); const seg = UP.seg; const rows = upAccountRows(seg); const cnt = k => upAccountRows(k).length;
  el.innerHTML = pageHead('Bank Accounts', 'Accused (Layer 1) and suspect accounts are listed automatically from the NCRP trail. Type the account holder’s name and upload each statement — it is read automatically. Add any other account with “＋ Add more accounts”.') + upSteps('up_bank') +
    `<div class="seg3">${[['comp', 'Complainant', '#00ff9d'], ['acc', 'Accused (Layer 1)', '#ffb300'], ['sus', 'Suspects (Layer 2+)', '#00e5ff']].map(([k, t, col]) => `<button class="${seg === k ? 'on' : ''}" data-seg="${k}" style="--pc:${col}">${t}<span>${cnt(k)}</span></button>`).join('')}</div>
    <div class="card"><div class="row sb" style="margin-bottom:8px"><div class="small muted">${rows.filter(r => r.n).length} of ${rows.length} statements uploaded · accepted: Excel, CSV, PDF (text or scanned), HTML, RPT / PRN / TXT reports</div><div class="row"><button id="bMany" class="btn-sm">⇪ Upload several statements</button><button id="bAdd" class="btn-sm btn-p">＋ Add more accounts</button></div></div><div id="bT"></div></div>
    <div class="row" style="justify-content:space-between;margin-top:12px"><button id="bPrev">‹ NCRP Trail</button><button class="btn-p" id="bNext">Next: CDR ›</button></div>`;
  bindSteps(el); $$('[data-seg]', el).forEach(b => b.onclick = () => { UP.seg = b.dataset.seg; go('up_bank'); });
  $('#bPrev', el).onclick = () => go('up_ncrp'); $('#bNext', el).onclick = () => go('up_cdr');
  const draw = () => {
    const rs = upAccountRows(seg);
    $('#bT', el).innerHTML = rs.length ? `<div class="tbl-wrap"><table class="tbl up-tbl"><thead><tr><th>#</th><th>Account / wallet</th><th>Bank · IFSC</th><th class="num">NCRP amount</th><th>Name of account holder</th><th>Statement</th><th></th></tr></thead><tbody>${rs.map((r, i) => `<tr data-no="${esc(r.no)}">
        <td class="dim">${i + 1}</td><td><span class="mono">${esc(r.no)}</span><div>${r.src.map(s => badge(s, s === 'NCRP' ? 'pink' : s === 'Statement' ? 'green' : 'gray')).join(' ')}</div></td>
        <td class="small">${esc(r.bank || (r.a && r.a.bank) || '')}<div class="mono dim">${esc(r.ifsc || (r.a && r.a.ifsc) || '')}</div></td>
        <td class="num">${r.amt ? inr(r.amt) : ''}${r.hold ? `<div class="small" style="color:var(--green)">hold ${inrShort(r.hold)}</div>` : ''}</td>
        <td><input data-nm value="${esc(r.a ? r.a.holder || '' : '')}" placeholder="type name"></td>
        <td>${r.n ? `${badge(nfmt(r.n) + ' txns', 'green')}<div class="small dim">${r.a && r.a.stmt ? esc(fmtDate(r.a.stmt.from) + ' – ' + fmtDate(r.a.stmt.to)) : ''}</div>` : badge('Not uploaded', 'amber')} ${qStatus('acct:' + acctKey(r.no))}</td>
        <td class="nowrap"><button class="btn-sm ${r.n ? '' : 'btn-p'}" data-up>⇪ ${r.n ? 'Add' : 'Upload'} statement</button></td></tr>`).join('')}</tbody></table></div>` : emptyState(seg === 'comp' ? 'No complainant account yet. Upload the NCRP report, or add the account.' : 'No accounts yet. Upload the NCRP report so the accounts are listed automatically, or add them.');
    $$('input[data-nm]', el).forEach(inp => inp.onchange = () => { const no = inp.closest('tr').dataset.no; const a = ensureAcct(no, {}); a.holder = inp.value.trim(); if (!a.role) a.role = SEG_ROLE[seg]; markDirty('accts'); toast('Name saved', 'ok', 1200); });
    $$('[data-up]', el).forEach(b => b.onclick = () => { const tr = b.closest('tr'); const no = tr.dataset.no; const nm = $('input[data-nm]', tr).value.trim();
      pickFiles(true, fs => fs.length && quickImport('acct:' + acctKey(no), fs, 'statement', { acctNo: no, role: SEG_ROLE[seg], holder: nm }, draw)); });
    bindReview(el, draw);
  };
  $('#bAdd', el).onclick = async () => { const v = await promptBox('Add ' + { comp: 'complainant', acc: 'accused', sus: 'suspect' }[seg] + ' account', [{ label: 'Account number / wallet ID' }, { label: 'Name of account holder (optional)' }], 'Add'); if (!v) return; const no = normAcct(v[0]); if (no.length < 5) return toast('Enter the account number', 'warn');
    const a = ensureAcct(no, {}); a.role = SEG_ROLE[seg]; if (v[1].trim()) a.holder = v[1].trim(); if (seg === 'comp') a.layerNcrp = 0; UP.extra[seg].push({ no }); markDirty('accts'); rebuildIndexes(); S.derived = null; draw(); };
  $('#bMany', el).onclick = () => pickFiles(true, fs => fs.length && quickImport('many:' + seg, fs, 'statement', { role: SEG_ROLE[seg] }, draw).then(qs => { const bad = qs.filter(q => q.status !== 'imported'); toast(`${qs.length - bad.length} statement(s) imported` + (bad.length ? ` · ${bad.length} need review (Import Data (advanced) → queue)` : ''), bad.length ? 'warn' : 'ok', 6000); go('up_bank'); }));
  draw();
};

/* ---------------------------------- 3 · CDR ---------------------------------- */
const CDR_KINDS = [['linked', 'Bank-linked number'], ['alt', 'Alternate number'], ['imei', 'IMEI trace']];
VIEWS.up_cdr = el => {
  upReset(); const c = S.cur; c.telecom.meta = c.telecom.meta || {};
  const accused = upAccountRows('acc'), sus = upAccountRows('sus'); const comp = upAccountRows('comp');
  const byAcct = new Map(); for (const [num, m] of Object.entries(c.telecom.meta)) if (m.acct) { const k = acctKey(m.acct); if (!byAcct.has(k)) byAcct.set(k, []); byAcct.get(k).push(Object.assign({ num }, m)); }
  const cdrCount = num => c.telecom.cdr.filter(r => r.target === num).length;
  const card = (r, role) => { const a = r.a; const have = byAcct.get(acctKey(r.no)) || []; const linked = a ? a.mobiles : []; const alt = a ? a.altMobiles : [];
    const slot = (kind, label, pre) => `<div class="cdr-slot"><div class="small"><b>${label}</b></div><input data-num placeholder="${kind === 'imei' ? 'IMEI (15 digits)' : 'mobile no. (optional)'}" value="${esc(pre || '')}" class="mono"><button class="btn-sm" data-cdr="${kind}">⇪ CDR</button><div data-st>${qStatus('cdr:' + acctKey(r.no) + ':' + kind)}</div></div>`;
    return `<div class="card cdr-card" data-no="${esc(r.no)}" data-role="${role}"><div class="row sb"><div><b>${esc(a && a.holder ? a.holder : 'Holder name not entered')}</b> <span class="mono small dim">${esc(r.no)}</span> ${esc(r.bank || '')}</div><div class="small">${have.length ? have.map(h => badge((CDR_KINDS.find(k => k[0] === h.type) || ['', 'CDR'])[1] + ' ' + h.num + ' · ' + nfmt(cdrCount(h.num)), 'green')).join(' ') : '<span class="dim">no CDR yet</span>'}</div></div>
      <div class="cdr-slots">${slot('linked', 'Bank-linked CDR', linked[0])}${slot('alt', 'Alternate no. CDR', alt[0])}${slot('imei', 'IMEI trace CDR', '')}</div></div>`; };
  const compNums = uniq(comp.flatMap(r => r.a ? acctNumbers(r.a) : []));
  el.innerHTML = pageHead('CDR', 'Nothing here is mandatory — add whichever CDRs are available. Each CDR is linked to its account so the location analysis knows whose phone it is.') + upSteps('up_cdr') +
    `<div class="card" style="margin-bottom:14px"><h3>Complainant CDR</h3><div class="row"><input id="ccNum" placeholder="complainant mobile" value="${esc(compNums[0] || '')}" class="mono" style="max-width:200px"><input id="ccNm" placeholder="name" value="${esc((comp[0] && comp[0].a && comp[0].a.holder) || 'Complainant')}" style="max-width:220px"><button id="ccUp" class="btn-p">⇪ Upload complainant CDR</button><div id="ccSt">${qStatus('cdr:comp')}</div></div>
      <div class="small dim" style="margin-top:6px">${uniq(c.telecom.cdr.filter(r => (c.telecom.meta[r.target] || {}).role === 'Victim').map(r => r.target)).join(', ') || 'No complainant CDR yet.'}</div></div>
    <h3 style="margin:18px 0 8px">Accused (Layer 1) accounts</h3><div class="grid g2" id="accC">${accused.map(r => card(r, 'Accused')).join('') || emptyState('No accused accounts yet — upload the NCRP trail or add them in Bank Accounts.')}</div>
    <h3 style="margin:18px 0 8px">Suspect accounts</h3><div class="grid g2" id="susC">${sus.slice(0, 60).map(r => card(r, 'Suspect')).join('') || emptyState('No suspect accounts yet.')}${sus.length > 60 ? `<div class="small dim">${sus.length - 60} more suspect accounts — use Other data for bulk CDR import.</div>` : ''}</div>
    <div class="card" style="margin-top:14px"><div class="row sb"><div><b>Other CDRs</b> <span class="small dim">(numbers not yet linked to an account — caller, associates)</span></div><button id="oUp" class="btn-sm">⇪ Upload CDR(s)</button></div><div id="oSt">${qStatus('cdr:other')}</div></div>
    <div class="row" style="justify-content:space-between;margin-top:12px"><button id="cPrev">‹ Bank Accounts</button><button class="btn-p" id="cNext">Next: Bank Login IP ›</button></div>`;
  bindSteps(el); $('#cPrev', el).onclick = () => go('up_bank'); $('#cNext', el).onclick = () => go('up_ip');
  const redraw = () => go('up_cdr');
  $('#ccUp', el).onclick = () => pickFiles(true, fs => fs.length && quickImport('cdr:comp', fs, 'cdr', { target: $('#ccNum', el).value.trim(), holder: $('#ccNm', el).value.trim() || 'Complainant', cdrRole: 'Victim', linkAcct: (comp[0] || {}).no || '', cdrType: 'linked' }, () => { $('#ccSt', el) && ($('#ccSt', el).innerHTML = qStatus('cdr:comp')); }).then(redraw));
  $('#oUp', el).onclick = () => pickFiles(true, fs => fs.length && quickImport('cdr:other', fs, 'cdr', { cdrRole: 'Suspect' }, () => { $('#oSt', el) && ($('#oSt', el).innerHTML = qStatus('cdr:other')); }).then(redraw));
  $$('.cdr-card [data-cdr]', el).forEach(b => b.onclick = () => { const cardEl = b.closest('.cdr-card'); const no = cardEl.dataset.no; const kind = b.dataset.cdr; const v = $('input[data-num]', b.parentElement).value.trim(); const a = IX.acctByKey.get(acctKey(no));
    pickFiles(true, fs => fs.length && quickImport('cdr:' + acctKey(no) + ':' + kind, fs, 'cdr', { target: kind === 'imei' ? '' : v, imei: kind === 'imei' ? v.replace(/\D/g, '') : '', holder: (a && a.holder) || '', cdrRole: cardEl.dataset.role, linkAcct: no, cdrType: kind }, () => { const st = $('[data-st]', b.parentElement); if (st) st.innerHTML = qStatus('cdr:' + acctKey(no) + ':' + kind); }).then(redraw)); });
  bindReview(el, redraw);
};

/* ---------------------------------- 4 · BANK LOGIN IP + IP LOOKUP ---------------------------------- */
const IPL = { list: '' };
async function ipLookupOnline(ips, onProg) {
  const c = S.cur; c.work.ipinfo = c.work.ipinfo || {}; let ok = 0, fail = 0, i = 0;
  for (const ip of ips) {
    const rec = c.work.ipinfo[ip] || { ip };
    try { const r = await fetch('https://ipwho.is/' + encodeURIComponent(ip), { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' }); const j = await r.json(); if (j && j.success !== false) Object.assign(rec, { city: j.city || '', region: j.region || '', country: j.country || '', lat: j.latitude ?? null, lon: j.longitude ?? null, isp: (j.connection || {}).isp || '', org: (j.connection || {}).org || '', asn: (j.connection || {}).asn || '', geoAt: nowStamp() }); ok++; } catch { fail++; }
    try { const r = await fetch('https://rdap.apnic.net/ip/' + encodeURIComponent(ip), { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' }); if (r.ok) { const j = await r.json(); rec.netName = j.name || ''; rec.range = (j.startAddress && j.endAddress) ? j.startAddress + ' – ' + j.endAddress : ''; rec.owner = ((j.entities || []).map(e => ((e.vcardArray || [])[1] || []).find(v => v[0] === 'fn')).filter(Boolean).map(v => v[3])[0]) || ''; rec.remarks = ((j.remarks || [])[0] || {}).description ? j.remarks[0].description.join(' ').slice(0, 160) : ''; } } catch {}
    c.work.ipinfo[ip] = rec; onProg && onProg(++i, ips.length);
  }
  markDirty('work'); return { ok, fail };
}
VIEWS.up_ip = el => {
  upReset(); const c = S.cur; c.work.ipinfo = c.work.ipinfo || {};
  const accts = c.accts.filter(a => a.role || (IX.txByAcct.get(a.id) || []).length);
  const byIp = new Map(); for (const l of c.ip.logs) { let x = byIp.get(l.ip); if (!x) { x = { ip: l.ip, n: 0, accts: new Set(), first: l.ts, last: l.ts, ports: new Set() }; byIp.set(l.ip, x); } x.n++; if (l.acctId) x.accts.add((IX.acctById.get(l.acctId) || {}).acctNo); x.first = Math.min(x.first, l.ts); x.last = Math.max(x.last, l.ts); if (l.port) x.ports.add(l.port); }
  const extra = IPL.list.split(/[\s,;]+/).map(s => s.trim()).filter(s => /^[0-9a-f.:]+$/i.test(s) && (s.includes('.') || s.includes(':')));
  for (const ip of extra) if (!byIp.has(ip)) byIp.set(ip, { ip, n: 0, accts: new Set(), first: null, last: null, ports: new Set(), manual: true });
  const rows = Array.from(byIp.values()).map(x => Object.assign(x, { accts: Array.from(x.accts), ports: Array.from(x.ports), cls: ipClass(x.ip), info: c.work.ipinfo[x.ip] || null })).sort((a, b) => (b.accts.length - a.accts.length) || b.n - a.n);
  el.innerHTML = pageHead('Bank Login IP & IP Lookup', 'Upload the internet / mobile banking and UPI login IP logs received from the banks, then look up who owns each IP (ISP) and where it is registered. Only the IP address is sent for lookup.') + upSteps('up_ip') +
    `<div class="card" style="margin-bottom:14px"><div class="row" style="align-items:flex-end;flex-wrap:wrap"><label class="f">Account (if the log has no account column)<select id="ipA"><option value="">Auto from file</option>${accts.map(a => `<option value="${esc(a.acctNo)}">${esc(acctName(a))}</option>`).join('')}</select></label>
      <label class="f">Time in the log<select id="ipTz"><option value="IST">IST (as given)</option><option value="UTC">UTC / GMT → convert to IST</option></select></label><button id="ipUp" class="btn-p">⇪ Upload bank IP log(s)</button><div id="ipSt">${qStatus('iplog')}</div></div></div>
    <div class="card"><div class="row sb" style="flex-wrap:wrap;gap:8px"><h3 style="margin:0">IP lookup (${rows.length} IPs)</h3><div class="row"><textarea id="ipList" rows="1" placeholder="Paste more IPs to look up…" style="width:280px;min-height:38px">${esc(IPL.list)}</textarea><button id="ipAddL" class="btn-sm">Add</button><button id="ipLook" class="btn-p">⌕ Look up all public IPs</button><button id="ipX">⇩ Excel</button></div></div>
      <div id="ipT" style="margin-top:10px"></div><p class="small dim" style="margin:8px 0 0">Lookup uses ipwho.is (location, ISP, ASN) and APNIC RDAP (network owner). A public IP identifies a subscriber only with the exact date, time and — for CGNAT — the source port: send the IPDR notice to the ISP shown.</p></div>
    <div class="row" style="justify-content:space-between;margin-top:12px"><button id="iPrev">‹ CDR</button><button class="btn-p" id="iNext">▶ Start analysis</button></div>`;
  bindSteps(el); $('#iPrev', el).onclick = () => go('up_cdr'); $('#iNext', el).onclick = () => go('verify');
  const cols = [{ label: 'IP address', html: r => `<span class="mono">${esc(r.ip)}</span>`, x: r => r.ip }, { label: 'Type', html: r => badge(r.cls.label, r.cls.t === 'public' ? 'cyan' : r.cls.t === 'cgnat' ? 'amber' : r.cls.t === 'v6' ? 'violet' : 'gray'), x: r => r.cls.label }, { label: 'Logins', k: 'n', num: 1 }, { label: 'Accounts', get: r => r.accts.join(', ') }, { label: 'Ports', get: r => r.ports.slice(0, 5).join(', ') }, { label: 'First – last', get: r => r.first ? fmtDT(r.first) + ' – ' + fmtDT(r.last) : '' },
    { label: 'ISP / owner', get: r => r.info ? [r.info.isp || r.info.org, r.info.owner || r.info.netName].filter(Boolean).join(' · ') : '' }, { label: 'ASN', get: r => r.info ? r.info.asn || '' : '' }, { label: 'Location (registry)', get: r => r.info ? [r.info.city, r.info.region, r.info.country].filter(Boolean).join(', ') : '' },
    { label: '', html: r => `<a class="btn-sm" target="_blank" rel="noopener noreferrer" href="https://ipinfo.io/${encodeURIComponent(r.ip)}">ipinfo</a> <a class="btn-sm" target="_blank" rel="noopener noreferrer" href="https://wq.apnic.net/static/search.html?query=${encodeURIComponent(r.ip)}">whois</a>` }];
  $('#ipT', el).innerHTML = simpleTable(cols, rows, { maxH: 520, empty: 'No IPs yet. Upload bank IP logs or paste IPs.' });
  $('#ipX', el).onclick = () => exportTable('IP lookup', cols, rows);
  $('#ipAddL', el).onclick = () => { IPL.list = $('#ipList', el).value; go('up_ip'); };
  $('#ipUp', el).onclick = () => pickFiles(true, fs => fs.length && quickImport('iplog', fs, 'iplog', { acctNo: $('#ipA', el).value, tz: $('#ipTz', el).value }, () => { $('#ipSt', el) && ($('#ipSt', el).innerHTML = qStatus('iplog')); }).then(() => go('up_ip')));
  $('#ipLook', el).onclick = async () => {
    const ips = rows.filter(r => ['public', 'v6'].includes(r.cls.t)).map(r => r.ip); if (!ips.length) return toast('No public IPs to look up (private and CGNAT addresses cannot be looked up).', 'warn');
    if (!await confirmBox('IP lookup', `Only these <b>${ips.length}</b> IP addresses will be sent to ipwho.is and APNIC RDAP. No names, accounts or times are sent. Continue?`, 'Look up')) return;
    const b = $('#ipLook', el); b.disabled = true; const r = await ipLookupOnline(ips, (i, n) => { b.textContent = `Looking up ${i}/${n}…`; });
    audit('IP lookup', ips.length + ' IPs'); toast(`IP lookup done (${r.ok} found${r.fail ? ', ' + r.fail + ' failed' : ''})`, r.fail ? 'warn' : 'ok'); go('up_ip');
  };
  bindReview(el, () => go('up_ip'));
};
