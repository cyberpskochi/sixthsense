/* ------------------------------ CASES ------------------------------ */
VIEWS.cases = el => {
  el.innerHTML = pageHead('Case Management', 'Every record belongs to a case. Case data is encrypted at rest; demo data is kept in a separate, clearly marked case.',
    `<button class="btn-p" id="cNew">＋ New case</button><button id="cImp">⇪ Import case package</button><button id="cDemo">▶ Load demo case</button><button id="cBk">☁ Drive backup</button>`) +
    `<div id="cList"></div>`;
  const rows = S.index.slice().sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
  const tc = r => r.demo ? '#ffb300' : /closed/i.test(r.status) ? '#8fb3c9' : /charge/i.test(r.status) ? '#00ff9d' : '#00e5ff';
  $('#cList', el).innerHTML = rows.length ? `<div class="tiles">${rows.map(r => `<div class="card tile" style="--pc:${tc(r)}" data-open="${esc(r.id)}"><div class="pulse"></div>
      <div class="tile-h"><div class="hexi" style="--pc:${tc(r)};width:46px;height:46px">${icon('folder')}</div><div style="min-width:0"><b>${esc(r.crimeNo || r.id)}</b><small>${esc(r.id)} · ${esc(r.ps || '')}</small></div></div>
      <div class="row" style="margin-top:10px;gap:6px">${badge(r.type || 'Case', 'cyan')} ${badge(r.status || '', /closed/i.test(r.status) ? 'gray' : 'green')} ${r.demo ? badge('DEMO', 'amber') : ''}</div>
      <div class="tile-stats"><div><span>Accounts</span><b>${nfmt(r.accts)}</b></div><div><span>Txns</span><b>${nfmt(r.txns)}</b></div><div><span>CDR</span><b>${nfmt(r.cdr)}</b></div><div><span>IO</span><b style="font-size:12px;font-family:var(--font)">${esc((r.io || '—').slice(0, 14))}</b></div></div>
      <div class="when"><span>☁ ${esc(r.lastBackup || 'not backed up')}</span><span class="row" style="gap:6px"><button class="btn-sm" data-data="${esc(r.id)}" title="Manage or delete uploaded data">🗂 Data</button><button class="btn-sm btn-d" data-del="${esc(r.id)}" title="Delete this case and all its data">🗑 Delete</button></span></div></div>`).join('')}</div>` : emptyState('No cases yet. Create a case or load the demo case to explore the system.');
  $$('[data-data]', el).forEach(b => b.onclick = async e => { e.stopPropagation(); if (!S.cur || S.cur.meta.id !== b.dataset.data) { await openCase(b.dataset.data); renderShell(); } caseDataManager(); });
  $$('[data-open]', el).forEach(b => b.onclick = async () => { await openCase(b.dataset.open); renderShell(); go('dashboard'); });
  $$('[data-del]', el).forEach(b => b.onclick = e => { e.stopPropagation(); confirmDeleteCase(b.dataset.del); });
  $('#cNew', el).onclick = () => caseForm();
  $('#cDemo', el).onclick = async () => { if (S.index.some(x => x.id === 'DEMO-CASE')) { await openCase('DEMO-CASE'); } else { toast('Generating synthetic demo case…'); await tick(); await buildDemoCase(); } renderShell(); go('dashboard'); };
  $('#cBk', el).onclick = () => go('backup');
  $('#cImp', el).onclick = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.enc'; i.onchange = async () => { try { const buf = await i.files[0].arrayBuffer(); const v = await promptBox('Decrypt package', [{ label: 'Passphrase used when the package was created, or your Backup Key (leave empty to use your current vault)', type: 'password' }, { label: 'Restore as Case ID (optional, to avoid clashes)' }], 'Decrypt & restore'); if (!v) return; const pkg = await Vault.unpack(buf, v[0] || null); await restorePackage(pkg, v[1].trim() || null); toast('Case restored', 'ok'); renderShell(); go('dashboard'); } catch (e) { toast(e.message, 'err'); } }; i.click(); };
};
function caseForm(existing) {
  const m = existing ? S.cur.meta : {};
  const body = `<div class="grid g2">
    <label class="f">Case ID *<input id="f_id" value="${esc(m.id || '')}" ${existing ? 'disabled' : ''} placeholder="e.g. CASE-37-2026"></label>
    <label class="f">FIR / Crime Number<input id="f_crime" value="${esc(m.crimeNo || '')}" placeholder="Cr. No. 37/2026"></label>
    <label class="f">Police Station<input id="f_ps" value="${esc(m.ps || '')}" placeholder="Police station"></label>
    <label class="f">District<input id="f_dist" value="${esc(m.district || 'Ernakulam')}"></label>
    <label class="f">Investigating Officer<input id="f_io" value="${esc(m.io || '')}"></label>
    <label class="f">Case Type<select id="f_type">${CASE_TYPES.map(t => `<option ${t === m.type ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
    <label class="f">Date of Registration<input id="f_reg" type="date" value="${esc(m.regDate || '')}"></label>
    <label class="f">Investigation Status<select id="f_st">${CASE_STATUS.map(t => `<option ${t === m.status ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
    <label class="f">Confidentiality<select id="f_conf">${CONF_LEVELS.map(t => `<option ${t === m.conf ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
    <label class="f" style="grid-column:1/-1">Sections of law (used in 94 BNSS letters)<input id="f_sec" value="${esc(m.sections || '318(4) and 319(2) of the Bharatiya Nyaya Sanhita, 2023 and 66(C), 66(D) of the Information Technology Act, 2000')}"></label>
    <label class="f" style="grid-column:1/-1">Charges (used in 94 BNSS letters)<input id="f_chg" value="${esc(m.charges || 'Cheating and dishonestly inducing delivery of property and Cheating by personation')}"></label>
    <label class="f" style="grid-column:1/-1">Remarks<textarea id="f_rem" rows="2">${esc(m.remarks || '')}</textarea></label></div>`;
  const md = modal({ title: existing ? 'Edit case details' : 'New case', size: 'md', body, foot: `<button data-c>Cancel</button><button class="btn-p" data-s>${existing ? 'Save' : 'Create case'}</button>` });
  $('[data-c]', md.el).onclick = () => md.close();
  $('[data-s]', md.el).onclick = async () => {
    const v = id => $('#' + id, md.el).value.trim(); const id = existing ? m.id : v('f_id').replace(/[^\w\-\/. ]/g, '').trim();
    if (!id) return toast('Case ID required', 'warn'); if (!existing && S.index.some(x => x.id === id)) return toast('Case ID already exists', 'warn');
    const meta = { id, crimeNo: v('f_crime'), ps: v('f_ps'), district: v('f_dist'), io: v('f_io'), type: v('f_type'), regDate: v('f_reg'), status: v('f_st'), conf: v('f_conf'), remarks: v('f_rem'), sections: v('f_sec'), charges: v('f_chg') };
    if (existing) { Object.assign(S.cur.meta, meta); markDirty('meta'); await audit('Edited case details', JSON.stringify(meta).slice(0, 300)); md.close(); renderShell(); go('dashboard'); }
    else { await createCase(meta); md.close(); renderShell(); go('upload'); toast('Case created. Upload the statements, NCRP report and CDRs.', 'ok'); }
  };
}

/* ------------------------------ DASHBOARD ------------------------------ */
VIEWS.dashboard = el => {
  const c = S.cur; const d = D(); const t = d.tot; const leads = buildLeads(); const pendingTasks = c.work.tasks.filter(x => x.status === 'PENDING' || x.status === 'IN PROGRESS');
  const layerCounts = Array.from(d.byLayer.entries()).sort((a, b) => a[0] - b[0]);
  const req = requisitions();
  el.innerHTML = pageHead('Investigation Dashboard', `${esc(c.meta.type)} · ${esc(c.meta.ps)} · IO ${esc(c.meta.io || '—')} · Status ${esc(c.meta.status)}`, `<button id="dEdit">✎ Case details</button><button id="dData">🗂 Case data & delete</button><button id="dRun">↻ Re-run analysis</button><button class="btn-p" id="dImp">⇪ Import data</button>`) +
    (c.work.disputed.length ? '' : `<div class="notice" style="margin-bottom:12px">No disputed transactions are marked yet. Mark the complainant's fraudulent debits in <a href="#" data-go="txns">Transactions</a> (or import the NCRP money trail) — the money trail starts from them.</div>`) +
    `<div class="grid g6" style="margin-bottom:12px">
      ${kpi('Amount lost', inrShort(t.loss), `${t.seeds} disputed txn · ${t.compAccts} complainant a/c`, 'rgba(255,77,94,.2)')}
      ${kpi('Traced to Layer 1', inrShort(t.traced), t.loss ? Math.round(100 * t.traced / t.loss) + '% of loss' : '', 'rgba(255,179,0,.18)')}
      ${kpi('Possibly available', inrShort(t.retained), 'not yet debited in last rows', 'rgba(0,255,157,.18)')}
      ${kpi('Cash / ATM out', inrShort(t.cash), 'withdrawn from trail', 'rgba(179,136,255,.18)')}
      ${kpi('Unresolved onward', inrShort(t.unresolved + t.pending), `${req.stmt.length} statements to request`, 'rgba(41,121,255,.18)')}
      ${kpi('Trail depth', t.maxLayer ? 'L' + t.maxLayer : '—', `${d.acctRes.size} accounts in trail`)}
    </div>
    <div class="grid g6" style="margin-bottom:12px">
      ${kpi('Accounts', nfmt(c.accts.length), `${IX.txByAcct.size} with statements`)} ${kpi('Transactions', nfmt(c.txns.length))} ${kpi('Mobiles known', nfmt(IX.numInfo.size), `${T().targets.length} with CDR`)}
      ${kpi('CDR events', nfmt(c.telecom.cdr.length), `${nfmt(c.telecom.sms.length)} SMS/OTP`)} ${kpi('IP logins / IPDR', nfmt(c.ip.logs.length) + ' / ' + nfmt(c.ip.ipdr.length))} ${kpi('Leads · Pending tasks', leads.length + ' · ' + pendingTasks.length, `${leads.filter(l => l.sev === 'high').length} high priority`, 'rgba(255,179,0,.18)')}
    </div>
    <div class="grid g3">
      <div class="card"><h3>Money by layer</h3><div class="chart-box"><canvas id="chLayer"></canvas></div></div>
      <div class="card"><h3>Top receiving accounts (traced)</h3><div class="chart-box"><canvas id="chTop"></canvas></div></div>
      <div class="card"><h3>Channel mix (all debits)</h3><div class="chart-box"><canvas id="chCh"></canvas></div></div>
    </div>
    <div class="grid g2" style="margin-top:12px">
      <div class="card"><h3>⚑ Priority leads</h3>${leads.slice(0, 7).map(leadHtml).join('') || emptyState('No leads yet — import statements, KYC, IP logs and CDRs.')}<a href="#" data-go="leads" class="small">All leads →</a></div>
      <div class="card"><h3>✉ Pending requisitions</h3>
        <div class="grid g2">${kpi('Statements', req.stmt.length, 'beneficiary a/cs without statement')}${kpi('KYC details', req.kyc.length, 'trail a/cs without KYC')}${kpi('CDR', req.cdr.length, 'linked / alternate numbers')}${kpi('IPDR', req.ipdr.length, 'login IPs to resolve')}</div>
        <h3 style="margin-top:12px">☑ Pending tasks</h3>${pendingTasks.slice(0, 6).map(x => `<div class="small" style="padding:4px 0;border-bottom:1px solid var(--line)">${badge(x.priority || 'Normal', x.priority === 'High' ? 'red' : 'gray')} ${esc(x.task)} <span class="dim">· ${esc(x.officer || '')} ${esc(x.due || '')}</span></div>`).join('') || '<div class="dim small">No pending tasks.</div>'}
      </div>
    </div>
    <div class="card" style="margin-top:12px"><h3>Transaction timeline (daily debit volume, all accounts)</h3><div class="chart-box"><canvas id="chTl"></canvas></div></div>`;
  $$('[data-go]', el).forEach(a => a.onclick = e => { e.preventDefault(); go(a.dataset.go); });
  $('#dEdit', el).onclick = () => caseForm(true); $('#dData', el).onclick = () => caseDataManager(); $('#dImp', el).onclick = () => go('upload'); $('#dRun', el).onclick = () => { S.derived = null; go('dashboard'); toast('Analysis refreshed', 'ok'); };
  bindLeadButtons(el);
  mkChart($('#chLayer', el), { type: 'bar', data: { labels: layerCounts.map(([l]) => layerName(l)), datasets: [{ label: 'Traced in', data: layerCounts.map(([, b]) => round2(b.tin)), backgroundColor: SERIES[0], borderRadius: 4 }, { label: 'Possibly available', data: layerCounts.map(([, b]) => round2(b.retained)), backgroundColor: SERIES[2], borderRadius: 4 }, { label: 'Cash out', data: layerCounts.map(([, b]) => round2(b.cash)), backgroundColor: SERIES[1], borderRadius: 4 }] }, options: { scales: { y: { ticks: { callback: v => inrShort(v) } } }, plugins: { tooltip: { callbacks: { label: x => x.dataset.label + ': ' + inr(x.raw) } } } } });
  const top = Array.from(d.acctRes.entries()).sort((a, b) => b[1].tin - a[1].tin).slice(0, 8);
  mkChart($('#chTop', el), { type: 'bar', data: { labels: top.map(([id]) => (IX.acctById.get(id) || {}).acctNo), datasets: [{ label: 'Traced in', data: top.map(([, r]) => r.tin), backgroundColor: SERIES[0], borderRadius: 4 }] }, options: { indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: x => inr(x.raw) } } }, scales: { x: { ticks: { callback: v => inrShort(v) } } } } });
  const ch = countBy(c.txns.filter(x => x.dr), x => x.channel); const chE = Array.from(ch.entries()).sort((a, b) => b[1] - a[1]); const main = chE.slice(0, 7); const other = sum(chE.slice(7), x => x[1]); if (other) main.push(['Other', other]);
  mkChart($('#chCh', el), { type: 'bar', data: { labels: main.map(x => x[0]), datasets: [{ label: 'Debits', data: main.map(x => x[1]), backgroundColor: SERIES[0], borderRadius: 4 }] }, options: { plugins: { legend: { display: false } } } });
  const byDay = groupBy(c.txns.filter(x => x.dr), x => isoDate(x.ts)); const days = Array.from(byDay.keys()).sort();
  mkChart($('#chTl', el), { type: 'line', data: { labels: days.map(x => x.split('-').reverse().join('-')), datasets: [{ label: 'Debit amount', data: days.map(k => round2(sum(byDay.get(k), x => x.dr))), borderColor: SERIES[0], backgroundColor: 'rgba(57,135,229,.12)', fill: true, borderWidth: 2, pointRadius: 0, tension: .2 }] }, options: { interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: x => inr(x.raw) } } }, scales: { y: { ticks: { callback: v => inrShort(v) } }, x: { ticks: { maxTicksLimit: 12 } } } } });
};
/* ---------- Case data manager: delete one uploaded file, all uploaded data, or the whole case ---------- */
function caseDataManager() {
  const c = S.cur; if (!c) return;
  const KN = { statement: 'Bank statement', kyc: 'KYC', iplog: 'Bank login IP log', cdr: 'CDR', ipdr: 'IPDR', ncrp: 'NCRP report', sms: 'SMS', atm: 'ATM database', ifscdb: 'IFSC master', psdb: 'Police stations' };
  const imps = c.work.imports.slice().reverse();
  const md = modal({ title: 'Case data & delete — ' + esc(c.meta.crimeNo || c.meta.id), body: `<p class="small muted">Every uploaded file is listed. Deleting a file removes all records that came from it (transactions, CDR rows, NCRP rows, IP logs…). The analysis is recalculated automatically. Deleted data cannot be recovered unless you have a backup.</p>
    ${imps.length ? `<div class="tbl-wrap" style="max-height:52vh"><table class="tbl"><thead><tr><th>File</th><th>Type</th><th>Records</th><th>Uploaded</th><th></th></tr></thead><tbody>${imps.map(r => `<tr><td>${esc(r.file)}${r.bank ? `<div class="small dim">${esc(r.bank)}</div>` : ''}</td><td>${esc(KN[r.kind] || r.kind)}</td><td class="num">${nfmt(r.added)}</td><td class="small">${esc(r.at)}<div class="dim">${esc(r.by || '')}</div></td><td><button class="btn-sm btn-d" data-di="${esc(r.id)}">🗑 Delete</button></td></tr>`).join('')}</tbody></table></div>` : emptyState('No uploaded files in this case.')}`,
    foot: `<button class="btn-d" id="dmAll" ${c.meta.demo ? 'disabled' : ''}>🗑 Delete ALL uploaded data (keep case)</button><button class="btn-d" id="dmCase">🗑 Delete this case</button><button data-c>Close</button>` });
  $('[data-c]', md.el).onclick = () => md.close();
  $$('[data-di]', md.el).forEach(b => b.onclick = async () => { const r = c.work.imports.find(x => x.id === b.dataset.di); if (!await confirmBox('Delete uploaded file', `Delete all data that came from “${esc(r.file)}” (${nfmt(r.added)} records)? This cannot be undone.`, 'Delete', true)) return;
    const { out } = deleteImport(r.id); await audit('Deleted uploaded file', `${r.file} (${r.kind}) — ` + Object.entries(out).filter(x => x[1]).map(x => x[1] + ' ' + x[0]).join(', ')); await saveNow(); Backend.log('DATA DELETED', 'Case ' + c.meta.id + ' file removed'); toast('Deleted: ' + r.file, 'ok'); md.close(); renderShell(); caseDataManager(); });
  $('#dmAll', md.el).onclick = async () => { const v = await promptBox('Delete ALL uploaded data', [{ label: `Type the Case ID “${c.meta.id}” to delete every uploaded file, account and record. Case details, tasks and the audit log are kept.` }], 'Delete all data'); if (!v) return; if (v[0] !== c.meta.id) return toast('Case ID did not match', 'warn');
    clearCaseData(); await audit('Deleted all uploaded data'); await saveNow(); Backend.log('DATA DELETED', 'Case ' + c.meta.id + ' all data'); toast('All uploaded data deleted', 'ok'); md.close(); renderShell(); go('up_ncrp'); };
  $('#dmCase', md.el).onclick = async () => { md.close(); confirmDeleteCase(c.meta.id); };
}
async function confirmDeleteCase(id) {
  const v = await promptBox('Delete case ' + id, [{ label: 'Type the Case ID to permanently delete this case and all its data from this computer (Google Drive backups are not affected)', value: '' }], 'Delete case');
  if (!v) return; if (v[0] !== id) return toast('Case ID did not match', 'warn');
  await deleteCase(id); Backend.log('CASE DELETED', 'Case ' + id); toast('Case deleted', 'ok'); renderShell(); go('cases');
}
