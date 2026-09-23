/* ------------------------------ IMPORT VIEW ------------------------------ */
VIEWS.import = el => {
  const o = IMP.opts;
  el.innerHTML = pageHead('Import Data', 'Select the data type, set options, then drop any number of files (or a whole folder). Files are hashed (SHA-256), parsed locally, validated (balance continuity, dates, amounts) and only auto-imported when confidence is high — otherwise they wait for your review.') +
    `<div class="grid g4" id="kinds" style="margin-bottom:12px">${IMPORT_KINDS.map(k => `<div class="kind-card ${IMP.kind === k.k ? 'on' : ''}" data-k="${k.k}"><b>${k.t}</b><span>${k.d}</span></div>`).join('')}</div>
    <div class="card" style="margin-bottom:12px"><div class="row" id="impOpts"></div></div>
    <div class="drop" id="drop"><div class="ic">⇪</div><b>Drop files here or click to choose</b><div class="small muted">Excel (.xlsx/.xls), CSV, TXT, PDF (text or scanned — OCR) · multiple files supported</div>
      <div class="row" style="justify-content:center;margin-top:10px"><button id="pickFiles">Choose files</button><button id="pickDir">Choose folder</button></div></div>
    <div class="card" style="margin-top:12px"><div class="row sb"><h3 style="margin:0">Import queue</h3><div class="row"><button id="qAll" class="btn-p">Import all ready</button><button id="qClear">Clear finished</button></div></div><div id="queue" style="margin-top:10px"></div></div>`;
  $$('.kind-card', el).forEach(k => k.onclick = () => { IMP.kind = k.dataset.k; go('import'); });
  const opt = $('#impOpts', el);
  const bankSel = `<label class="f">Bank (activates parser profile)<select id="oBank"><option value="AUTO">Auto-detect from file (IFSC / name)</option>${BANKS.map(b => `<option value="${b.code}" ${o.bank === b.code ? 'selected' : ''}>${b.name}</option>`).join('')}</select></label>`;
  const roleSel = `<label class="f">Role of these accounts<select id="oRole"><option value="AUTO">Auto — decided by money trail / NCRP layer</option>${ROLES.map(r => `<option ${o.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>`;
  const tz = `<label class="f">Timestamps in source<select id="oTz"><option value="IST" ${o.tz === 'IST' ? 'selected' : ''}>IST (as given)</option><option value="UTC" ${o.tz === 'UTC' ? 'selected' : ''}>UTC / GMT → convert to IST (+5:30)</option></select></label>`;
  let h = '';
  if (IMP.kind === 'statement') h = bankSel + roleSel + `<label class="f">Duplicates across statements<select id="oDup"><option value="merge" ${o.dup === 'merge' ? 'selected' : ''}>Merge (skip exact duplicates, counted)</option><option value="keep" ${o.dup === 'keep' ? 'selected' : ''}>Keep both (flag as possible duplicate)</option></select></label><label class="f">Account no. (only if file lacks it)<input id="oAcct" value="${esc(o.acctNo)}" placeholder="auto"></label>`;
  else if (IMP.kind === 'cdr') h = `<label class="f">Target number (optional — auto-detected)<input id="oTarget" value="${esc(o.target)}" placeholder="auto"></label>` + tz;
  else if (IMP.kind === 'iplog') h = `<label class="f">Account no. (if the log has no account column)<input id="oAcct" value="${esc(o.acctNo)}" placeholder="auto"></label>` + tz;
  else if (IMP.kind === 'ipdr') h = tz + `<div class="small muted" style="max-width:520px">IPDR is matched on IP + session time (± ${S.cur.work.settings.ipdrTolMin} min) and, where both sides carry it, the source/public port — essential for CGNAT.</div>`;
  else if (IMP.kind === 'sms') h = `<label class="f">Mobile number (if not in file)<input id="oTarget" value="${esc(o.target)}"></label>`;
  else h = `<div class="small muted">${IMPORT_KINDS.find(k => k.k === IMP.kind).d}</div>`;
  opt.innerHTML = h;
  $$('select,input', opt).forEach(i => i.onchange = () => { o.bank = ($('#oBank', opt) || {}).value || o.bank; o.role = ($('#oRole', opt) || {}).value || o.role; o.dup = ($('#oDup', opt) || {}).value || o.dup; o.tz = ($('#oTz', opt) || {}).value || o.tz; if ($('#oAcct', opt)) o.acctNo = $('#oAcct', opt).value.trim(); if ($('#oTarget', opt)) o.target = $('#oTarget', opt).value.trim(); });
  const addFiles = files => { for (const f of files) { if (!/\.(xlsx|xls|xlsm|csv|txt|tsv|pdf|ods)$/i.test(f.name)) continue; IMP.queue.push({ id: rid(6), file: f, kind: IMP.kind, opts: Object.assign({}, o), status: 'queued' }); } renderQueue(); pumpQueue(); };
  const drop = $('#drop', el);
  const pick = dir => { const i = document.createElement('input'); i.type = 'file'; i.multiple = true; if (dir) i.webkitdirectory = true; i.onchange = () => addFiles(Array.from(i.files)); i.click(); };
  $('#pickFiles', el).onclick = e => { e.stopPropagation(); pick(false); }; $('#pickDir', el).onclick = e => { e.stopPropagation(); pick(true); };
  drop.onclick = () => pick(false);
  drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); }; drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); addFiles(Array.from(e.dataTransfer.files)); };
  $('#qAll', el).onclick = async () => { for (const q of IMP.queue.filter(q => q.status === 'ready')) { await commitQueued(q); renderQueue(); await tick(); } refreshStmtStats(); renderNav(); toast('Import complete', 'ok'); };
  $('#qClear', el).onclick = () => { IMP.queue = IMP.queue.filter(q => !['imported', 'skipped'].includes(q.status)); renderQueue(); };
  renderQueue();
};
async function pumpQueue() {
  if (IMP.running) return; IMP.running = true;
  try { let q; while ((q = IMP.queue.find(x => x.status === 'queued'))) { await parseQueued(q); await tick(); } } finally { IMP.running = false; }
  const ready = IMP.queue.filter(q => q.status === 'ready').length, rev = IMP.queue.filter(q => q.status === 'review').length;
  if (ready || rev) toast(`${ready} file(s) ready to import · ${rev} need review`, rev ? 'warn' : 'ok', 5000);
}
const QSTAT = { queued: ['Queued', 'gray'], parsing: ['Parsing…', 'cyan'], ready: ['Ready', 'green'], review: ['Needs review', 'amber'], imported: ['Imported', 'blue'], error: ['Error', 'red'], skipped: ['Skipped', 'gray'] };
function renderQueue() {
  const host = $('#queue'); if (!host) return;
  if (!IMP.queue.length) { host.innerHTML = emptyState('No files queued.'); return; }
  host.innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>File</th><th>Type</th><th>Status</th><th>Accounts / target</th><th class="num">Rows parsed</th><th class="num">Unparsed</th><th>Notes</th><th></th></tr></thead><tbody>${IMP.queue.map(q => `<tr id="q_${q.id}">${queueRowHtml(q)}</tr>`).join('')}</tbody></table></div>`;
  bindQueue(host);
}
function queueRowHtml(q) {
  const s = q.summary || {}; const st = QSTAT[q.status];
  const notes = [q.warn, q.err, ...(q.reasons || []), q.imported ? `Added ${q.imported.added}, duplicates skipped ${q.imported.dups}` : '', q.msg && q.status === 'parsing' ? q.msg : ''].filter(Boolean).join(' · ');
  return `<td><b>${esc(q.file.name)}</b><div class="small dim">${(q.file.size / 1024).toFixed(0)} KB ${q.hash ? '· ' + q.hash.slice(0, 12) + '…' : ''}</div></td><td>${esc(FIELDS[q.kind].label)}${q.result && q.result[0] && q.kind === 'statement' ? '<div class="small dim">' + esc(bankByCode(q.result[0].bank).name) + '</div>' : ''}</td>
    <td>${badge(st[0], st[1])}</td><td class="mono small">${esc((s.accts || []).slice(0, 4).join(', '))}${(s.accts || []).length > 4 ? ' +' + (s.accts.length - 4) : ''}</td><td class="num">${s.rows != null ? nfmt(s.rows) : ''}</td><td class="num">${s.rej ? `<span class="dr">${s.rej}</span>` : ''}</td>
    <td class="small" style="max-width:340px">${esc(notes)}</td>
    <td class="nowrap">${['ready', 'review'].includes(q.status) ? `<button class="btn-sm" data-rev="${q.id}">Review</button> ` : ''}${q.status === 'ready' ? `<button class="btn-sm btn-p" data-imp="${q.id}">Import</button> ` : ''}${['ready', 'review', 'error', 'queued'].includes(q.status) ? `<button class="btn-sm btn-g" data-skip="${q.id}">✕</button>` : ''}</td>`;
}
function renderQueueRow(q) { const tr = $('#q_' + q.id); if (tr) { tr.innerHTML = queueRowHtml(q); bindQueue(tr); } }
function bindQueue(host) {
  $$('[data-rev]', host).forEach(b => b.onclick = () => reviewModal(IMP.queue.find(q => q.id === b.dataset.rev)));
  $$('[data-imp]', host).forEach(b => b.onclick = async () => { const q = IMP.queue.find(q => q.id === b.dataset.imp); await commitQueued(q); refreshStmtStats(); renderQueue(); renderNav(); toast('Imported ' + q.file.name, 'ok'); });
  $$('[data-skip]', host).forEach(b => b.onclick = () => { const q = IMP.queue.find(q => q.id === b.dataset.skip); q.status = 'skipped'; renderQueue(); });
}
const colName = i => { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
function reviewModal(q) {
  let gi = 0;
  const m = modal({ title: 'Parser review — ' + esc(q.file.name), body: '<div id="rv"></div>', foot: `<label class="row small" style="margin-right:auto"><input type="checkbox" id="rvTpl" checked> Save confirmed mapping as template for this bank/format</label><button data-c>Cancel</button><button id="rvApply">Re-parse with mapping</button><button class="btn-p" id="rvOk">Confirm & import</button>` });
  const draw = () => {
    const G = q.grids[gi]; if (!G) { $('#rv', m.el).innerHTML = emptyState('No table could be found in this file. ' + (q.grids[0] && q.grids[0].g.noTable ? 'PDF text was extracted but no statement header row was detected.' : '')); return; }
    const hdr = G.hdr; const rows = G.g.rows; const ncol = Math.max(...rows.slice(0, 60).map(r => r.length));
    const fields = Object.keys(FIELDS[q.kind].f);
    const headerCells = r => (rows[r] || []).map(cellText);
    const colOpts = sel => `<option value="">— none —</option>` + Array.from({ length: ncol }, (_, i) => `<option value="${i}" ${sel === i ? 'selected' : ''}>${colName(i)}: ${esc(String(headerCells(hdr.row)[i] || '').slice(0, 26))}${hdr.rows === 2 ? ' ' + esc(String(headerCells(hdr.row + 1)[i] || '').slice(0, 14)) : ''}</option>`).join('');
    const prevStart = hdr.row + (hdr.rows || 1);
    const res = G.res; let preview = '';
    if (q.kind === 'statement' && res) { const tx = res.groups.flatMap(g => g.txns).slice(0, 12); preview = simpleTable([{ label: 'Date/Time', get: t => fmtDT(t.ts, t.hasTime) }, { label: 'Debit', html: t => t.dr ? `<span class="dr">${inr(t.dr)}</span>` : '', num: 1 }, { label: 'Credit', html: t => t.cr ? `<span class="cr">${inr(t.cr)}</span>` : '', num: 1 }, { label: 'Balance', get: t => t.bal == null ? '' : inr(t.bal), num: 1 }, { label: 'Channel', k: 'channel' }, { label: 'UTR', k: 'utr' }, { label: 'Narration', get: t => t.narr.slice(0, 60) }, { label: 'Flags', get: t => t.flags.join(' ') }], tx, { maxH: 260 }); }
    else if (res && res.rows) { const r0 = res.rows.slice(0, 10); const keys = r0[0] ? Object.keys(r0[0]).filter(k => !['src', 'i', 'imp'].includes(k)).slice(0, 10) : []; preview = simpleTable(keys.map(k => ({ label: k, get: r => ['ts', 'start', 'end'].includes(k) ? fmtDT(r[k]) : Array.isArray(r[k]) ? r[k].join(',') : r[k] })), r0, { maxH: 260 }); }
    const stats = q.kind === 'statement' && res ? res.groups.map(g => `<div class="small">A/c <b class="mono">${esc(g.acctNo || '(not found)')}</b>: ${g.txns.length} txns · balance checks ${g.balChecks - g.balFails}/${g.balChecks} OK · date order ${g.order} · time available ${g.txns.filter(t => t.hasTime).length}/${g.txns.length}</div>`).join('') : '';
    $('#rv', m.el).innerHTML = `
      ${q.grids.length > 1 ? `<div class="tabs">${q.grids.map((x, i) => `<button class="${i === gi ? 'on' : ''}" data-g="${i}">${esc(x.g.sheet)}${x.skip ? ' (skipped)' : ''}</button>`).join('')}</div>` : ''}
      ${(q.reasons || []).length ? `<div class="notice" style="margin-bottom:10px">${q.reasons.map(esc).join('<br>')}</div>` : ''}
      <div class="grid g4" style="margin-bottom:10px">
        <label class="f">Header row (1-based)<input id="rvHr" type="number" min="1" value="${hdr.row + 1}"></label>
        <label class="f">Header spans<select id="rvHrs"><option value="1" ${hdr.rows !== 2 ? 'selected' : ''}>1 row</option><option value="2" ${hdr.rows === 2 ? 'selected' : ''}>2 rows</option></select></label>
        <label class="f">Date format<select id="rvDo"><option value="">Auto (${esc((res && res.order) || 'DMY')})</option><option value="DMY" ${G.dateOrder === 'DMY' ? 'selected' : ''}>DD/MM/YYYY</option><option value="MDY" ${G.dateOrder === 'MDY' ? 'selected' : ''}>MM/DD/YYYY</option></select></label>
        ${q.kind === 'statement' ? `<label class="f">Bank profile<select id="rvBank">${BANKS.map(b => `<option value="${b.code}" ${G.bank === b.code ? 'selected' : ''}>${b.name}</option>`).join('')}</select></label><label class="f">Account number<input id="rvAcct" value="${esc(q.opts.acctNo || G.meta.acctNo || '')}"></label><label class="f">Holder (from header)<input id="rvHolder" value="${esc(G.meta.holder || '')}"></label>` : ''}
        ${q.kind === 'cdr' ? `<label class="f">Target number<input id="rvTarget" value="${esc(q.opts.target || (res && res.target) || '')}"></label>` : ''}
      </div>
      <h4>Column mapping ${hdr.template ? badge('template: ' + hdr.template, 'green') : badge('detected score ' + (+hdr.score || 0).toFixed(1), 'gray')}</h4>
      <div class="grid g4" style="margin-bottom:10px">${fields.map(f => `<label class="f">${f}<select data-f="${f}">${colOpts(hdr.map[f])}</select></label>`).join('')}</div>
      <h4>Source preview (rows ${hdr.row + 1}…)</h4>
      <div class="tbl-wrap" style="max-height:200px"><table class="tbl"><thead><tr><th>#</th>${Array.from({ length: ncol }, (_, i) => `<th>${colName(i)}</th>`).join('')}</tr></thead><tbody>${rows.slice(hdr.row, prevStart + 8).map((r, k) => `<tr><td class="dim">${(G.g.rowRef[hdr.row + k] || {}).row || ''}</td>${Array.from({ length: ncol }, (_, i) => `<td class="small">${esc(cellText(r[i]).slice(0, 40))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <h4 style="margin-top:12px">Normalised result</h4>${stats}${preview}
      ${res && res.rejects && res.rejects.length ? `<details style="margin-top:8px"><summary class="small">${res.rejects.length} rows not parsed (kept in the import record — never silently discarded)</summary>${simpleTable([{ label: 'Page', get: r => r.row.page || '' }, { label: 'Row', get: r => r.row.row }, { label: 'Reason', k: 'reason' }, { label: 'Source text', k: 'raw' }], res.rejects.slice(0, 100), { maxH: 200 })}</details>` : ''}`;
    $$('[data-g]', m.el).forEach(b => b.onclick = () => { gi = +b.dataset.g; draw(); });
  };
  const apply = () => {
    const G = q.grids[gi]; if (!G) return;
    G.hdr = Object.assign({}, G.hdr, { row: Math.max(0, +$('#rvHr', m.el).value - 1), rows: +$('#rvHrs', m.el).value, map: {}, template: '' });
    $$('[data-f]', m.el).forEach(s => { if (s.value !== '') G.hdr.map[s.dataset.f] = +s.value; });
    G.dateOrder = $('#rvDo', m.el).value;
    if ($('#rvBank', m.el)) { G.bank = $('#rvBank', m.el).value; q.opts.acctNo = $('#rvAcct', m.el).value.trim(); G.meta.holder = $('#rvHolder', m.el).value.trim(); }
    if ($('#rvTarget', m.el)) q.opts.target = $('#rvTarget', m.el).value.trim();
    G.sig = headerSignature(G.g.rows, G.hdr.row, G.hdr.rows);
    runNormalise(q); draw(); renderQueueRow(q);
  };
  $('#rvApply', m.el).onclick = apply; $('[data-c]', m.el).onclick = () => m.close();
  $('#rvOk', m.el).onclick = async () => {
    apply(); const G = q.grids[gi]; if (!G || !mappingValid(q.kind, G.hdr.map)) return toast('Required columns are not mapped', 'warn');
    if (q.kind === 'statement' && G.res.groups.some(g => !g.acctNo) && !q.opts.acctNo) return toast('Enter the account number', 'warn');
    q.result.forEach(x => x.saveTpl = $('#rvTpl', m.el).checked); q.reviewed = true;
    await commitQueued(q); refreshStmtStats(); m.close(); renderQueue(); renderNav(); toast('Imported after review: ' + q.file.name, 'ok');
  };
  draw();
}

/* ------------------------------ DATA QUALITY ------------------------------ */
VIEWS.quality = el => {
  const c = S.cur; const imps = c.work.imports.slice().reverse();
  const tx = c.txns; const noTime = tx.filter(t => !t.hasTime).length, noUtr = tx.filter(t => !t.utr && !['ATM', 'CASH', 'POS'].includes(t.channel)).length, bal = tx.filter(t => t.flags.includes('BAL_MISMATCH')).length, dup = tx.filter(t => t.flags.includes('POSSIBLE_DUPLICATE')).length;
  const rej = sum(imps, i => i.rejectCount || 0), dupSkipped = sum(imps, i => i.dups || 0);
  el.innerHTML = pageHead('Data Quality Control', 'What was detected, parsed, flagged and rejected for every imported file. Source file SHA-256 hashes support evidence integrity (e.g. certificate under Sec. 63 BSA).', `<button id="dqX">Export import register</button>`) +
    `<div class="grid g6" style="margin-bottom:12px">${kpi('Transactions parsed', nfmt(tx.length))}${kpi('Rows not parsed', nfmt(rej), 'kept with reason', 'rgba(248,113,113,.2)')}${kpi('Balance mismatches', nfmt(bal), 'require review', 'rgba(251,191,36,.2)')}${kpi('Time unavailable', nfmt(noTime), 'in source statement')}${kpi('No UTR/reference', nfmt(noUtr), 'transfers only')}${kpi('Duplicates', nfmt(dupSkipped) + ' / ' + nfmt(dup), 'merged / kept-flagged')}</div>
    <div class="card"><h3>Import register</h3><div id="dqT"></div></div>`;
  const cols = [{ label: 'Import', k: 'id' }, { label: 'File', k: 'file' }, { label: 'Kind', k: 'kind' }, { label: 'Format', k: 'type' }, { label: 'Bank', get: r => r.bank && bankByCode(r.bank).name }, { label: 'Imported', k: 'at' }, { label: 'By', k: 'by' }, { label: 'Added', k: 'added', num: 1 }, { label: 'Dups skipped', k: 'dups', num: 1 }, { label: 'Unparsed', k: 'rejectCount', num: 1 }, { label: 'Bal. mismatch', k: 'balFails', num: 1 }, { label: 'OCR pages', k: 'ocrPages', num: 1 }, { label: 'Reviewed', get: r => r.reviewed ? 'Yes' : 'Auto' }, { label: 'SHA-256', html: r => `<span class="mono small">${esc(r.hash)}</span>`, x: r => r.hash }];
  $('#dqT', el).innerHTML = simpleTable(cols, imps, { click: 1, empty: 'Nothing imported yet.' });
  bindRows(el, imps, r => modal({ title: 'Import ' + esc(r.id) + ' — ' + esc(r.file), body: `<div class="kv"><div>SHA-256</div><div class="mono small">${esc(r.hash)}</div><div>Accounts / targets</div><div class="mono">${esc(r.accts.join(', '))}</div><div>Template</div><div>${esc(r.template || '—')}</div></div><h4 style="margin-top:12px">Rows not parsed (${r.rejectCount})</h4>${simpleTable([{ label: 'Page', get: x => x.row.page || '' }, { label: 'Row', get: x => x.row.row }, { label: 'Reason', k: 'reason' }, { label: 'Source text', k: 'raw' }], r.rejects)}`, foot: false }));
  $('#dqX', el).onclick = () => exportTable('Import register', cols, imps);
};
