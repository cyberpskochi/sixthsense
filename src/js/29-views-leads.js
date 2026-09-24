/* ------------------------------ LEADS ------------------------------ */
function leadHtml(l) {
  const st = l.state.status;
  return `<div class="lead s-${l.sev}" data-lead="${esc(l.id)}"><div class="row sb"><div><span class="small dim">${esc(l.id.split('-').slice(0, 2).join('-'))}</span> ${badge(l.sev === 'high' ? 'HIGH' : l.sev === 'med' ? 'MEDIUM' : 'LOW', l.sev === 'high' ? 'red' : l.sev === 'med' ? 'amber' : 'blue')} ${badge(st, st === 'Verified' ? 'green' : st === 'Not Relevant' || st === 'Closed' ? 'gray' : 'cyan')}</div>
    <div class="row no-print"><select class="btn-sm" data-ls="${esc(l.id)}">${LEAD_STATUS.map(s => `<option ${s === st ? 'selected' : ''}>${s}</option>`).join('')}</select><button class="btn-sm" data-lt="${esc(l.id)}">＋ Task</button></div></div>
    <div style="margin-top:4px"><b>${esc(l.title)}</b></div><div class="small muted">${esc(l.detail)}</div>${l.state.note ? `<div class="small" style="margin-top:3px">📝 ${esc(l.state.note)}</div>` : ''}</div>`;
}
function bindLeadButtons(el) {
  const leads = buildLeads(); const by = new Map(leads.map(l => [l.id, l]));
  $$('[data-ls]', el).forEach(s => s.onchange = async () => { const id = s.dataset.ls; const note = s.value === 'Not Relevant' || s.value === 'Verified' ? ((await promptBox('Lead ' + s.value, [{ label: 'Reason / note (recorded in audit log)', type: 'textarea' }])) || [''])[0] : ''; S.cur.work.leadState[id] = { status: s.value, note, by: S.user.email, at: nowStamp() }; markDirty('work'); await audit('Lead status → ' + s.value, id + (note ? ' — ' + note : '')); go(S.view); });
  $$('[data-lt]', el).forEach(b => b.onclick = () => { const l = by.get(b.dataset.lt); taskDialog({ task: 'Follow up: ' + (l ? l.title : b.dataset.lt).slice(0, 160), lead: b.dataset.lt }); });
}
VIEWS.leads = el => {
  const leads = buildLeads(); const rules = uniq(leads.map(l => l.rule));
  el.innerHTML = pageHead('Investigation Leads', 'Rule-based, source-linked observations for the investigator to verify. A lead is never proof of guilt; update its status after verification.', `<button id="lX">Export leads</button>`) +
    `<div class="row" style="margin-bottom:10px"><select id="lSev"><option value="">All priorities</option><option value="high">High</option><option value="med">Medium</option><option value="low">Low</option></select><select id="lSt"><option value="">All statuses</option>${LEAD_STATUS.map(s => `<option>${s}</option>`).join('')}</select><select id="lRu"><option value="">All rules</option>${rules.map(r => `<option>${r}</option>`).join('')}</select><span class="small muted" id="lN"></span></div><div id="lL"></div>`;
  const draw = () => { const sv = $('#lSev', el).value, st = $('#lSt', el).value, ru = $('#lRu', el).value; const f = leads.filter(l => (!sv || l.sev === sv) && (!st || l.state.status === st) && (!ru || l.rule === ru)); $('#lL', el).innerHTML = f.slice(0, 400).map(leadHtml).join('') || emptyState('No leads for this filter.'); $('#lN', el).textContent = f.length + ' leads'; bindLeadButtons(el); };
  $$('select', el).forEach(s => s.onchange = draw); draw();
  $('#lX', el).onclick = () => exportTable('Leads', [{ label: 'Lead ID', k: 'id' }, { label: 'Rule', k: 'rule' }, { label: 'Priority', k: 'sev' }, { label: 'Status', get: l => l.state.status }, { label: 'Observation', k: 'title' }, { label: 'Supporting data', k: 'detail' }, { label: 'Entities', get: l => l.ents.map(e => (IX.acctById.get(e) || {}).acctNo || e).join(', ') }, { label: 'Note', get: l => l.state.note || '' }], leads);
};

/* ------------------------------ REQUISITIONS ------------------------------ */
VIEWS.requisitions = el => {
  const r = requisitions();
  el.innerHTML = pageHead('Requisitions (notices to banks / TSPs / ISPs)', 'Auto-generated from gaps in the trail: which statements, KYC, IP logs, CDRs and IPDRs are still needed to continue. Export and attach to notices under Sec. 94 BNSS / Sec. 79 IT Act as applicable.', `<button class="btn-p" id="rqX">Export all (Excel)</button>`) +
    `<div class="card" style="margin-bottom:12px"><h3>Bank statements & account details (${r.stmt.length})</h3>${simpleTable([{ label: 'Account / UPI', html: x => `<span class="mono">${esc(x.acctNo || x.upi)}</span>` }, { label: 'Bank', k: 'bank' }, { label: 'IFSC', k: 'ifsc' }, { label: 'Name (narration)', k: 'holder' }, { label: 'Layer', get: x => layerName(x.layer) }, { label: 'Traced amount', get: x => inr(x.amount), num: 1 }, { label: 'Received from', k: 'from' }, { label: 'UTRs', get: x => x.utrs || '' }, { label: 'Reason', k: 'reason' }], r.stmt.sort((a, b) => a.layer - b.layer || b.amount - a.amount), { empty: 'All beneficiary statements are available.' })}</div>
    <div class="grid g2"><div class="card"><h3>KYC / account opening details (${r.kyc.length})</h3>${simpleTable([{ label: 'Account', k: 'acctNo' }, { label: 'Bank', k: 'bank' }, { label: 'Layer', get: x => layerName(x.layer) }], r.kyc, { empty: 'None.' })}</div>
    <div class="card"><h3>Login IP logs (${r.iplog.length})</h3>${simpleTable([{ label: 'Account', k: 'acctNo' }, { label: 'Bank', k: 'bank' }, { label: 'Layer', get: x => layerName(x.layer) }, { label: 'From date', k: 'from' }], r.iplog, { empty: 'None.' })}</div>
    <div class="card"><h3>CDR (${r.cdr.length})</h3>${simpleTable([{ label: 'Number', k: 'num' }, { label: 'Linked to', k: 'links' }], r.cdr, { empty: 'None.' })}</div>
    <div class="card"><h3>IPDR (${r.ipdr.length})</h3>${simpleTable([{ label: 'IP', k: 'ip' }, { label: 'Port', get: x => x.port || '—' }, { label: 'IST', get: x => fmtDT(x.ts) }, { label: 'UTC', get: x => fmtDT(x.ts - 330 * 60000) }, { label: 'Type', get: x => x.cls.label }], r.ipdr, { empty: 'None.' })}</div></div>`;
  $('#rqX', el).onclick = () => {
    const wb = XLSX.utils.book_new(); const add = (n, head, rows) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([head].concat(rows.map(x => x.map(safeCell)))), n);
    add('Statements', ['Account/UPI', 'Bank', 'IFSC', 'Name', 'Layer', 'Traced amount', 'Received from', 'UTRs', 'Reason'], r.stmt.map(x => [x.acctNo || x.upi, x.bank, x.ifsc, x.holder, layerName(x.layer), x.amount, x.from, x.utrs || '', x.reason]));
    add('KYC', ['Account', 'Bank', 'IFSC', 'Layer'], r.kyc.map(x => [x.acctNo, x.bank, x.ifsc, layerName(x.layer)]));
    add('IP logs', ['Account', 'Bank', 'Layer', 'From date'], r.iplog.map(x => [x.acctNo, x.bank, layerName(x.layer), x.from]));
    add('CDR', ['Number', 'Linked to', 'Roles'], r.cdr.map(x => [x.num, x.links, x.roles]));
    add('IPDR', ['IP', 'Port', 'Timestamp IST', 'Timestamp UTC', 'Type', 'Accounts'], r.ipdr.map(x => [x.ip, x.port || '', fmtDT(x.ts), fmtDT(x.ts - 330 * 60000), x.cls.label, x.accts.map(a => (IX.acctById.get(a) || {}).acctNo).join(', ')]));
    XLSX.writeFile(wb, `${CONFIG.FILE_PREFIX}_${fileSafe(S.cur.meta.id)}_Requisitions.xlsx`); audit('Exported requisitions');
  };
};

/* ------------------------------ TASKS ------------------------------ */
async function taskDialog(pre = {}) {
  const v = await promptBox('Investigation task', [{ label: 'Task', value: pre.task || '', type: 'textarea' }, { label: 'Assigned officer', value: pre.officer || S.cur.meta.io || '' }, { label: 'Account', value: pre.acct || '' }, { label: 'Person', value: pre.person || '' }, { label: 'Due date', type: 'date', value: pre.due || '' }, { label: 'Priority', type: 'select', options: ['High', 'Normal', 'Low'], value: pre.priority || 'Normal' }, { label: 'Status', type: 'select', options: TASK_STATUS, value: pre.status || 'PENDING' }, { label: 'Remarks', value: pre.remarks || '' }, { label: 'Evidence / document ref.', value: pre.evidence || '' }]);
  if (!v || !v[0].trim()) return;
  const t = { id: pre.id || nextId('TASK'), task: v[0], officer: v[1], acct: v[2], person: v[3], due: v[4], priority: v[5], status: v[6], remarks: v[7], evidence: v[8], lead: pre.lead || '', created: pre.created || nowStamp(), updated: nowStamp() };
  const c = S.cur; const i = c.work.tasks.findIndex(x => x.id === t.id); if (i >= 0) c.work.tasks[i] = t; else c.work.tasks.push(t);
  markDirty('work'); await audit(i >= 0 ? 'Updated task' : 'Created task', t.id + ' ' + t.task.slice(0, 100) + ' [' + t.status + ']'); toast('Task saved', 'ok'); if (S.view === 'tasks' || S.view === 'dashboard') go(S.view);
}
VIEWS.tasks = el => {
  const c = S.cur; const tasks = c.work.tasks.slice().sort((a, b) => TASK_STATUS.indexOf(a.status) - TASK_STATUS.indexOf(b.status) || String(a.due).localeCompare(String(b.due)));
  el.innerHTML = pageHead('Investigation Tasks', 'Pending work is shown first. Tasks can be created from leads, transactions or requisitions.', `<button class="btn-p" id="tkN">＋ New task</button><button id="tkX">Export</button>`) +
    `<div class="grid g4" style="margin-bottom:12px">${TASK_STATUS.map(s => kpi(s, tasks.filter(t => t.status === s).length)).join('')}</div><div class="card" id="tkL"></div>`;
  const cols = [{ label: 'ID', k: 'id' }, { label: 'Priority', html: t => badge(t.priority, t.priority === 'High' ? 'red' : t.priority === 'Low' ? 'gray' : 'blue'), get: t => t.priority }, { label: 'Status', html: t => badge(t.status, t.status === 'COMPLETED' ? 'green' : t.status === 'PENDING' ? 'amber' : t.status === 'IN PROGRESS' ? 'cyan' : 'gray'), get: t => t.status }, { label: 'Task', k: 'task' }, { label: 'Officer', k: 'officer' }, { label: 'Account', k: 'acct' }, { label: 'Due', k: 'due' }, { label: 'Remarks', k: 'remarks' }, { label: 'Evidence', k: 'evidence' }];
  $('#tkL', el).innerHTML = simpleTable(cols, tasks, { click: 1, empty: 'No tasks yet.' }); bindRows(el, tasks, t => taskDialog(t));
  $('#tkN', el).onclick = () => taskDialog(); $('#tkX', el).onclick = () => exportTable('Tasks', cols, tasks);
};
