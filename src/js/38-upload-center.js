/* ------------------------------ UPLOAD CENTER (guided upload) ------------------------------
   Step 1 Accounts: complainant (25), Layer-1 (25), suspect (50) statements with the holder name typed by the officer.
   Step 2 NCRP report(s).  Step 3 CDRs: complainant (10), accused (100), suspect (100) with the CDR holder name.
   Every file goes through the normal import pipeline (hash, parse, validate, review).          */
const UPC_SECS = [
  { k: 'comp_ac', step: 1, t: 'Complainant accounts', d: 'Statements of the complainant’s accounts from which money was lost.', kind: 'statement', role: 'Complainant', max: 25, cols: 'acct' },
  { k: 'l1_ac', step: 1, t: 'Layer 1 accounts (money received directly from the complainant)', d: 'Statements of the accused accounts that received money directly from the complainant.', kind: 'statement', role: 'Accused (L1)', max: 25, cols: 'acct' },
  { k: 'sus_ac', step: 1, t: 'Suspect accounts (money transferred from Layer 1)', d: 'Statements of accounts that received money from the Layer 1 accounts.', kind: 'statement', role: 'Suspect (L2)', max: 50, cols: 'acct' },
  { k: 'ncrp', step: 2, t: 'NCRP report (action taken by banks)', d: 'Transaction-details Excel of each acknowledgement number from the NCRP / I4C portal — gives the full money trail and hold amounts.', kind: 'ncrp', max: 10, cols: 'none' },
  { k: 'comp_cdr', step: 3, t: 'Complainant CDR', d: 'CDR of the complainant’s mobile (bank SMS times help fix the exact transaction time).', kind: 'cdr', cdrRole: 'Victim', max: 10, cols: 'cdr' },
  { k: 'acc_cdr', step: 3, t: 'Accused CDR', d: 'CDRs of numbers linked to the Layer 1 accounts.', kind: 'cdr', cdrRole: 'Accused', max: 100, cols: 'cdr' },
  { k: 'sus_cdr', step: 3, t: 'Suspect CDR', d: 'CDRs of numbers linked to suspect accounts, callers and other suspects.', kind: 'cdr', cdrRole: 'Suspect', max: 100, cols: 'cdr' }
];
const UPC = { rows: [], seq: 0, caseId: '' };
function upcRows(k) { return UPC.rows.filter(r => r.sec === k); }
function upcNew(sec, file) { const r = { id: 'u' + (++UPC.seq), sec: sec.k, name: '', num: '', link: '', q: null }; UPC.rows.push(r); if (file) upcAttach(r, file); return r; }
function upcAttach(r, file) {
  const sec = UPC_SECS.find(s => s.k === r.sec);
  const q = { id: rid(6), file, kind: sec.kind, status: 'queued', opts: Object.assign({}, IMP.opts, { bank: 'AUTO', dup: 'merge', tz: 'IST', role: sec.role || 'AUTO', holder: r.name, acctNo: sec.cols === 'acct' ? r.num : '', target: sec.cols === 'cdr' ? r.num : '', cdrRole: sec.cdrRole || '', linkAcct: r.link, upc: sec.k }) };
  r.q = q; IMP.queue.push(q); pumpQueue().then(() => { if (S.view === 'upload') upcDrawAll(); });
}
function upcSync(r) { if (!r.q) return; const sec = UPC_SECS.find(s => s.k === r.sec); Object.assign(r.q.opts, { holder: r.name, linkAcct: r.link }); if (sec.cols === 'acct') r.q.opts.acctNo = r.num; if (sec.cols === 'cdr') r.q.opts.target = r.num; }
VIEWS.upload = el => {
  const c = S.cur; c.telecom.meta = c.telecom.meta || {};
  if (UPC.caseId !== c.meta.id) { UPC.rows = []; UPC.caseId = c.meta.id; }
  for (const s of UPC_SECS) { const n = upcRows(s.k).length; for (let i = n; i < (s.kind === 'ncrp' ? 1 : 3); i++) upcNew(s); }
  const steps = [[1, 'Account statements', 'Type the account holder’s name and choose the statement file (Excel, CSV or PDF). The account number is read from the file; type it only if the file has none.'], [2, 'NCRP report', 'Action taken by each bank and the full money trail from the portal.'], [3, 'Call detail records (CDR)', 'Type the name of the CDR holder, the mobile number (optional — read from the file) and, if known, the linked bank account.']];
  el.innerHTML = pageHead('Upload Center', 'Upload everything for this case in three simple steps. Each file is checked (SHA-256, balance continuity, dates) before it is added. Other data types (KYC, bank IP logs, IPDR, SMS) are in Import Data.', `<button id="upAdv">Import Data (advanced)</button>`) +
    steps.map(([n, t, d]) => `<div class="card up-step" style="margin-bottom:16px"><div class="up-sh"><span class="up-n">${n}</span><div><h3 style="margin:0">${t}</h3><p class="small muted" style="margin:2px 0 0">${d}</p></div></div>
      ${UPC_SECS.filter(s => s.step === n).map(s => `<div class="up-sec" id="sec_${s.k}"></div>`).join('')}</div>`).join('') +
    `<div class="up-bar"><div id="upSum" class="small"></div><div class="row"><button id="upImp" class="btn-p">⇪ Import all ready files</button><button id="upGo" class="btn-green">▶ Open Case Intelligence</button></div></div>`;
  $('#upAdv', el).onclick = () => go('import');
  $('#upGo', el).onclick = () => go('intel');
  $('#upImp', el).onclick = async () => {
    const ready = UPC.rows.filter(r => r.q && r.q.status === 'ready'); if (!ready.length) return toast('No files are ready. Files marked “Needs review” must be checked first.', 'warn');
    const b = $('#upImp', el); b.disabled = true;
    for (const r of ready) { upcSync(r); b.textContent = `Importing ${r.q.file.name}…`; try { await commitQueued(r.q); } catch (e) { r.q.status = 'error'; r.q.err = e.message; } await tick(); }
    refreshStmtStats(); rebuildIndexes(); S.derived = null;
    const seeded = autoSeedComplainant(); S.derived = null; renderNav();
    b.disabled = false; b.textContent = '⇪ Import all ready files'; upcDrawAll();
    toast(`Imported ${ready.length} file(s)` + (seeded ? ` · ${seeded} complainant debit(s) to uploaded accounts marked as disputed` : ''), 'ok', 6000);
  };
  upcDrawAll();
};
function upcDrawAll() { for (const s of UPC_SECS) upcDraw(s); upcSummary(); }
function upcSummary() {
  const el = $('#upSum'); if (!el) return; const qs = UPC.rows.filter(r => r.q).map(r => r.q);
  const n = st => qs.filter(q => q.status === st).length;
  el.innerHTML = `${badge(n('ready') + ' ready', 'green')} ${badge(n('review') + ' need review', 'amber')} ${badge((n('queued') + n('parsing')) + ' reading', 'cyan')} ${badge(n('imported') + ' imported', 'blue')} ${n('error') ? badge(n('error') + ' error', 'red') : ''}`;
}
function upcDraw(s) {
  const host = $('#sec_' + s.k); if (!host) return; const rows = upcRows(s.k); const used = rows.filter(r => r.q).length;
  const head = s.cols === 'acct' ? '<th>#</th><th>Name of account holder</th><th>Account no. <span class="dim">(optional)</span></th><th>Statement file</th><th>Status</th><th></th>'
    : s.cols === 'cdr' ? '<th>#</th><th>Name of CDR holder</th><th>Mobile no. <span class="dim">(optional)</span></th><th>Linked bank account <span class="dim">(optional)</span></th><th>CDR file</th><th>Status</th><th></th>'
    : '<th>#</th><th>NCRP file</th><th>Status</th><th></th>';
  const stat = r => { if (!r.q) return '<span class="dim">—</span>'; const st = QSTAT[r.q.status]; const sm = r.q.summary || {}; const det = r.q.imported ? `added ${nfmt(r.q.imported.added)}` : sm.rows != null ? `${nfmt(sm.rows)} rows` : ''; return `${badge(st[0], st[1])} <span class="small dim">${esc(det)}${(sm.accts || []).length ? ' · ' + esc(sm.accts.slice(0, 2).join(', ')) : ''}</span>${r.q.err ? `<div class="small" style="color:var(--red)">${esc(r.q.err)}</div>` : ''}`; };
  const fileCell = r => r.q ? `<span class="small mono" title="${esc(r.q.file.name)}">${esc(r.q.file.name.length > 34 ? r.q.file.name.slice(0, 31) + '…' : r.q.file.name)}</span>` : `<button class="btn-sm" data-pick="${r.id}">⇪ Choose file</button>`;
  const act = r => r.q ? `${['ready', 'review'].includes(r.q.status) ? `<button class="btn-sm" data-urev="${r.id}">Review</button> ` : ''}${r.q.status !== 'imported' ? `<button class="btn-sm btn-d" data-urm="${r.id}" title="Remove">✕</button>` : ''}` : '';
  const dis = r => r.q && r.q.status === 'imported' ? 'disabled' : '';
  host.innerHTML = `<div class="row sb" style="margin:10px 0 6px"><div><b>${esc(s.t)}</b> <span class="small dim">· ${used} / ${s.max}</span><div class="small muted">${esc(s.d)}</div></div>
      <div class="row"><button class="btn-sm" data-uadd="${s.k}" ${rows.length >= s.max ? 'disabled' : ''}>＋ Add row</button><button class="btn-sm btn-p" data-umany="${s.k}" ${used >= s.max ? 'disabled' : ''}>⇪ Add several files</button></div></div>
    <div class="tbl-wrap"><table class="tbl up-tbl"><thead><tr>${head}</tr></thead><tbody>${rows.map((r, i) => `<tr data-r="${r.id}"><td class="dim">${i + 1}</td>${s.cols === 'acct' ? `<td><input data-f="name" value="${esc(r.name)}" placeholder="e.g. Rahul Kumar" ${dis(r)}></td><td><input data-f="num" value="${esc(r.num)}" placeholder="auto from file" class="mono" ${dis(r)}></td>` : s.cols === 'cdr' ? `<td><input data-f="name" value="${esc(r.name)}" placeholder="e.g. Rahul Kumar" ${dis(r)}></td><td><input data-f="num" value="${esc(r.num)}" placeholder="auto from file" class="mono" ${dis(r)}></td><td><input data-f="link" value="${esc(r.link)}" placeholder="account no." class="mono" ${dis(r)}></td>` : ''}<td>${fileCell(r)}</td><td>${stat(r)}</td><td class="nowrap">${act(r)}</td></tr>`).join('')}</tbody></table></div>`;
  $$('input[data-f]', host).forEach(inp => inp.oninput = () => { const r = UPC.rows.find(x => x.id === inp.closest('tr').dataset.r); r[inp.dataset.f] = inp.value.trim(); upcSync(r); });
  const pick = (multi, cb) => { const i = document.createElement('input'); i.type = 'file'; i.multiple = multi; i.accept = '.xlsx,.xls,.xlsm,.csv,.txt,.tsv,.pdf,.ods'; i.onchange = () => cb(Array.from(i.files)); i.click(); };
  $$('[data-pick]', host).forEach(b => b.onclick = () => pick(false, fs => { if (!fs[0]) return; const r = UPC.rows.find(x => x.id === b.dataset.pick); upcAttach(r, fs[0]); upcDraw(s); upcSummary(); }));
  $$('[data-uadd]', host).forEach(b => b.onclick = () => { upcNew(s); upcDraw(s); });
  $$('[data-umany]', host).forEach(b => b.onclick = () => pick(true, fs => {
    const free = s.max - upcRows(s.k).filter(r => r.q).length; if (fs.length > free) toast(`Only ${free} more file(s) allowed here (limit ${s.max}). The rest were not added.`, 'warn', 6000);
    for (const f of fs.slice(0, free)) { const empty = upcRows(s.k).find(r => !r.q); if (empty) upcAttach(empty, f); else upcNew(s, f); }
    upcDraw(s); upcSummary(); toast('Files added. Type the holder names while they are being read.', 'ok');
  }));
  $$('[data-urev]', host).forEach(b => b.onclick = () => { const r = UPC.rows.find(x => x.id === b.dataset.urev); upcSync(r); reviewModal(r.q); });
  $$('[data-urm]', host).forEach(b => b.onclick = () => { const r = UPC.rows.find(x => x.id === b.dataset.urm); IMP.queue = IMP.queue.filter(q => q !== r.q); r.q = null; upcDraw(s); upcSummary(); });
}
/* Complainant debits that reach an uploaded account (matched by UTR / reference / beneficiary) become disputed seeds. */
function autoSeedComplainant() {
  const c = S.cur; const comp = c.accts.filter(a => a.role === 'Complainant'); if (!comp.length) return 0;
  const L = linkTransactions(); const dis = new Set(c.work.disputed); let n = 0;
  for (const a of comp) for (const t of IX.txByAcct.get(a.id) || []) {
    if (!(t.dr > 0) || dis.has(t.id)) continue; const m = L.M.get(t.id); if (!m || !m.toAcct) continue;
    const to = IX.acctById.get(m.toAcct); if (!to || to.role === 'Complainant') continue;
    c.work.disputed.push(t.id); dis.add(t.id); n++;
  }
  if (n) { markDirty('work'); audit('Auto-marked disputed', n + ' complainant debit(s) matched to uploaded accounts'); }
  return n;
}
