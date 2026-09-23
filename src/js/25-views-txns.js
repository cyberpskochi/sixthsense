/* ------------------------------ TRANSACTIONS ------------------------------ */
VIEWS.txns = (el, arg) => {
  const c = S.cur; const dis = new Set(c.work.disputed); const d = D();
  el.innerHTML = pageHead('Transactions', 'Universal transaction model across all banks. Click a row for Transaction Intelligence. Disputed (seed) transactions are marked with a red bar.', `<button id="tMark">⚑ Mark filtered debits as disputed</button><button id="tUtr">Mark by UTR list</button><button id="tX">Export filtered</button>`) +
    `<div class="card" style="margin-bottom:10px"><div class="row">
      <select id="fA" style="max-width:260px"><option value="">All accounts</option>${c.accts.filter(a => IX.txByAcct.has(a.id)).map(a => `<option value="${a.id}" ${arg && arg.acct === a.id ? 'selected' : ''}>${esc(acctLabel(a))}</option>`).join('')}</select>
      <select id="fR"><option value="">Any role</option>${ROLES.map(r => `<option>${r}</option>`).join('')}</select>
      <select id="fD"><option value="">Dr & Cr</option><option value="DR">Debits</option><option value="CR">Credits</option></select>
      <select id="fC"><option value="">Any channel</option>${CHANNELS.map(x => `<option>${x}</option>`).join('')}</select>
      <input id="fF" type="date" title="From"><input id="fT" type="date" title="To">
      <input id="fMin" type="number" placeholder="Min ₹" style="width:100px"><input id="fMax" type="number" placeholder="Max ₹" style="width:100px">
      <input id="fQ" placeholder="Narration / UTR / UPI" style="width:200px">
      <label class="row small"><input type="checkbox" id="fS" ${arg && arg.seeds ? 'checked' : ''}> Disputed only</label><label class="row small"><input type="checkbox" id="fFl"> Flagged only</label><label class="row small"><input type="checkbox" id="fTr"> In trail</label>
      <button class="btn-g btn-sm" id="fReset">Reset</button><span class="small muted" id="fN"></span></div></div><div id="tT"></div>`;
  const inTrail = new Set(d.flows.flatMap(f => [f.debit, f.credit]).filter(Boolean));
  const cols = [
    { label: 'ID', w: 100, get: t => t.id }, { label: 'Account', w: 150, get: t => (IX.acctById.get(t.acctId) || {}).acctNo },
    { label: 'Date', w: 92, get: t => fmtDate(t.ts), sort: t => t.ts }, { label: 'Time', w: 70, get: t => t.hasTime ? fmtTime(t.ts) : '—', sort: t => t.ts },
    { label: 'Debit', w: 115, num: 1, html: t => t.dr ? `<span class="dr">${inr(t.dr)}</span>` : '', sort: t => t.dr, x: t => t.dr || '' },
    { label: 'Credit', w: 115, num: 1, html: t => t.cr ? `<span class="cr">${inr(t.cr)}</span>` : '', sort: t => t.cr, x: t => t.cr || '' },
    { label: 'Balance', w: 115, num: 1, get: t => t.bal == null ? '' : inr(t.bal), sort: t => t.bal, x: t => t.bal },
    { label: 'Channel', w: 90, get: t => t.channel }, { label: 'UTR / Ref', w: 150, get: t => t.utr || t.ref },
    { label: 'Counterparty', w: 170, get: t => t.cpAcct[0] || t.upi || t.cpMasked || t.cpName || '' },
    { label: 'Trail', w: 70, html: t => dis.has(t.id) ? badge('SEED', 'red') : inTrail.has(t.id) ? badge('TRAIL', 'cyan') : '', get: t => dis.has(t.id) ? 'SEED' : inTrail.has(t.id) ? 'TRAIL' : '' },
    { label: 'Flags', w: 110, get: t => t.flags.join(' ') }, { label: 'Narration', w: 420, get: t => t.narr }
  ];
  const vt = vtable($('#tT', el), { cols, rows: [], height: 620, rowClass: t => dis.has(t.id) ? 'seed' : '', onClick: t => openTx(t.id) });
  const role = new Map(c.accts.map(a => [a.id, a.role]));
  let filtered = [];
  const apply = () => {
    const A = $('#fA', el).value, R = $('#fR', el).value, Dd = $('#fD', el).value, C = $('#fC', el).value, F = $('#fF', el).value, To = $('#fT', el).value, mn = +$('#fMin', el).value || 0, mx = +$('#fMax', el).value || 0, Q = $('#fQ', el).value.toLowerCase(), Sd = $('#fS', el).checked, Fl = $('#fFl', el).checked, Tr = $('#fTr', el).checked;
    const f0 = F ? Date.parse(F + 'T00:00:00Z') : null, t0 = To ? Date.parse(To + 'T23:59:59Z') : null;
    filtered = c.txns.filter(t => (!A || t.acctId === A) && (!R || role.get(t.acctId) === R) && (!Dd || (Dd === 'DR' ? t.dr : t.cr)) && (!C || t.channel === C) && (!f0 || t.ts >= f0) && (!t0 || t.ts <= t0) && (!mn || (t.dr || t.cr) >= mn) && (!mx || (t.dr || t.cr) <= mx) && (!Q || (t.narr + ' ' + t.utr + ' ' + t.upi + ' ' + t.ref).toLowerCase().includes(Q)) && (!Sd || dis.has(t.id)) && (!Fl || t.flags.length) && (!Tr || inTrail.has(t.id)));
    filtered.sort((a, b) => a.acctId === b.acctId ? a.ord - b.ord : a.ts - b.ts);
    vt.set(filtered); $('#fN', el).textContent = `${nfmt(filtered.length)} txns · Dr ${inr(sum(filtered, t => t.dr))} · Cr ${inr(sum(filtered, t => t.cr))}`;
  };
  $$('.card select, .card input', el).forEach(i => i.addEventListener(i.tagName === 'INPUT' && ['text', 'number', ''].includes(i.type) ? 'input' : 'change', apply));
  $('#fReset', el).onclick = () => go('txns');
  apply();
  $('#tX', el).onclick = () => exportTable('Transactions', cols.concat([{ label: 'Source file', x: t => t.src.file }, { label: 'Sheet/Page', x: t => t.src.page || t.src.sheet }, { label: 'Row', x: t => t.src.row }]), filtered);
  $('#tMark', el).onclick = async () => {
    const deb = filtered.filter(t => t.dr > 0 && !dis.has(t.id)); if (!deb.length) return toast('No unmarked debits in the filter', 'warn');
    const nonComp = deb.filter(t => role.get(t.acctId) !== 'Complainant').length;
    if (!await confirmBox('Mark disputed transactions', `Mark <b>${deb.length}</b> debit(s) totalling <b>${inr(sum(deb, t => t.dr))}</b> as disputed (money-trail seeds)?${nonComp ? `<br><br><span class="dr">${nonComp} of them are not in accounts with role “Complainant”.</span>` : ''}`, 'Mark disputed')) return;
    c.work.disputed = uniq(c.work.disputed.concat(deb.map(t => t.id))); markDirty('work'); await audit('Marked disputed transactions', deb.map(t => t.id).join(',').slice(0, 500)); go('txns', arg);
  };
  $('#tUtr', el).onclick = async () => { const v = await promptBox('Mark disputed by UTR / reference', [{ label: 'Paste UTRs (one per line or comma separated)', type: 'textarea' }]); if (!v) return; const set = new Set(v[0].split(/[\s,;]+/).map(normUtr).filter(Boolean)); const hit = c.txns.filter(t => t.dr > 0 && (set.has(normUtr(t.utr)) || set.has(normUtr(t.ref)))); c.work.disputed = uniq(c.work.disputed.concat(hit.map(t => t.id))); markDirty('work'); await audit('Marked disputed by UTR list', hit.length + ' matched'); toast(`${hit.length} debit(s) matched and marked`, 'ok'); go('txns', arg); };
};

/* --------------------- TRANSACTION INTELLIGENCE (single txn) --------------------- */
function openTx(id) {
  const c = S.cur; const t = IX.txById.get(id); if (!t) return; const d = D(); const a = IX.acctById.get(t.acctId);
  const isSeed = c.work.disputed.includes(id); const w = c.work.settings.cdrWindowMin;
  const back = traceBackward(id); const fwd = traceForward(id, 6);
  const corr = txCorrelation(t, w); const m = t.dr ? d.L.M.get(id) : null; const srcDebit = t.cr ? d.L.R.get(id) : null;
  // master timeline
  const ev = [{ ts: t.ts, c: 'var(--cyan)', t: 'BANK TRANSACTION', s: `${t.dr ? 'Debit' : 'Credit'} ${inr(t.dr || t.cr)} · ${a.acctNo} · ${t.channel}${t.utr ? ' · UTR ' + t.utr : ''}`, focus: 1 }];
  for (const r of corr.calls.slice(0, 120)) ev.push({ ts: r.ts, c: tel_color(r), t: r.kind + ' ' + (r.dir === 'OUT' ? 'OUT' : r.dir === 'IN' ? 'IN' : ''), s: `${numLabel(r.target)} ${r.dir === 'IN' ? '←' : '→'} ${numLabel(r.other)} · ${r.dur}s${r.cell ? ' · cell ' + r.cell : ''}${r.imei ? ' · IMEI ' + r.imei : ''}` });
  for (const s of corr.sms) ev.push({ ts: s.ts, c: 'var(--amber)', t: s.otp ? 'SMS / OTP' : 'SMS', s: `${s.msisdn} ← ${s.sender}: ${s.msg.slice(0, 90)}` });
  if (corr.login) ev.push({ ts: corr.login.log.ts, c: 'var(--violet)', t: 'LOGIN', s: `IP ${corr.login.ip}${corr.login.port ? ':' + corr.login.port : ''} · ${corr.login.log.channel || ''} ${corr.login.log.device || ''}` });
  for (const x of (IX.txByAcct.get(t.acctId) || []).filter(x => x.id !== id && Math.abs(x.ts - t.ts) <= w * 60000 && x.hasTime)) ev.push({ ts: x.ts, c: 'var(--blue)', t: 'OTHER TXN', s: `${x.dr ? 'Dr' : 'Cr'} ${inr(x.dr || x.cr)} ${x.narr.slice(0, 50)}` });
  ev.sort((x, y) => x.ts - y.ts);
  const lg = corr.login;
  const body = `
    <div class="card glow" style="margin-bottom:12px"><div class="row sb"><div><div class="small muted">TRANSACTION INTELLIGENCE · ${esc(t.id)} ${isSeed ? badge('DISPUTED / SEED', 'red') : ''} ${t.flags.map(f => badge(f, 'amber')).join(' ')}</div>
      <div style="font-size:24px;font-weight:700" class="${t.dr ? 'dr' : 'cr'}">${t.dr ? '−' : '+'}${inr(t.dr || t.cr)}</div>
      <div class="small">${fmtDate(t.ts)} ${t.hasTime ? '<b>' + fmtTime(t.ts) + '</b>' : '<span class="dim">Transaction time unavailable in source statement</span>'} · ${esc(t.channel)} · UTR <span class="mono">${esc(t.utr || '—')}</span> · Ref ${esc(t.ref || '—')}</div>
      <div class="small">Account <b class="mono">${esc(a.acctNo)}</b> ${esc(a.holder)} · ${esc(a.bank)} ${badge(layerName(acctLayer(a.id)), 'cyan')}</div></div>
      <div class="small muted" style="max-width:420px">${esc(t.narr)}</div></div></div>
    <div class="grid g2">
      <div class="card"><h4>Money flow</h4>
        ${back.length ? `<div class="small muted">Backward</div>${back.map(b => `<div class="chain" style="margin:4px 0"><span class="lk">${esc((IX.acctById.get(b.debit.acctId) || {}).acctNo)}<br><span class="dr">${inr(b.debit.dr)}</span> ${fmtDT(b.debit.ts, b.debit.hasTime)}</span><span class="ar">⟶</span><span class="lk">${esc((IX.acctById.get(b.credit.acctId) || {}).acctNo)}<br><span class="cr">${inr(b.credit.cr)}</span> ${b.m ? strengthBadge(b.m.strength) : ''}</span></div>`).join('')}` : ''}
        ${m ? `<div class="small muted" style="margin-top:6px">This debit → ${m.toAcct ? '<b class="mono">' + esc((IX.acctById.get(m.toAcct) || {}).acctNo) + '</b>' : 'unresolved'} ${strengthBadge(m.strength)}<br>${m.reasons.map(esc).join(' · ')}</div>` : ''}
        ${srcDebit ? `<div class="small muted" style="margin-top:6px">Funded by debit ${esc(srcDebit)} in ${esc((IX.acctById.get(IX.txById.get(srcDebit).acctId) || {}).acctNo)}</div>` : ''}
        ${fwd.length ? `<div class="small muted" style="margin-top:8px">Forward trace (traced amounts)</div>${fwd.slice(0, 40).map(f => `<div class="small" style="padding-left:${f.depth * 14}px">↳ ${esc((IX.acctById.get(f.fromAcct) || {}).acctNo)} → <b>${f.toAcct ? esc((IX.acctById.get(f.toAcct) || {}).acctNo) : esc(f.toExt.label)}</b> ${inr(f.amt)} ${f.gap != null ? '· after ' + durTxt(f.gap) : ''} ${strengthBadge(f.strength)}</div>`).join('')}` : '<div class="dim small" style="margin-top:6px">No onward traced flow.</div>'}
      </div>
      <div class="card"><h4>Time correlation (±${w} min) ${corr.strength !== '—' ? strengthBadge(corr.strength) : ''}</h4><div class="tl" style="max-height:340px;overflow:auto">${ev.map(e => `<div class="ev ${e.focus ? 'focus' : ''}" style="--c:${e.c}"><span class="t">${fmtTime(e.ts)}</span> <b class="small">${esc(e.t)}</b><div class="small">${esc(e.s)}</div></div>`).join('')}</div>${!t.hasTime ? '<div class="notice small">Transaction time is unavailable in the source statement; correlation uses the whole day and is weak.</div>' : ''}</div>
      <div class="card"><h4>Login / IP chain</h4>${lg ? `<div class="chain"><span class="lk">Txn ${fmtTime(t.ts)}</span><span class="ar">⟵</span><span class="lk">Login ${fmtDT(lg.log.ts)}<br><b class="mono">${esc(lg.ip)}${lg.port ? ':' + lg.port : ''}</b></span><span class="ar">⟶</span><span class="lk">${lg.ipdr ? 'IPDR: ' + lg.ipdr.nums.map(n => `<a href="#" data-num="${n}">${n}</a>`).join(', ') : 'IPDR pending'}</span></div>
        <div class="small muted" style="margin-top:6px">${esc(lg.how)}<br>${esc(lg.cls.label)} — ${esc(lg.cls.note || '')}${lg.ipdr ? '<br>' + esc(lg.ipdr.note) : ''}</div>` : '<div class="dim small">No login session found for this transaction (import bank IP logs for this account).</div>'}</div>
      <div class="card"><h4>Telecom</h4><div class="kv"><div>Account-linked numbers</div><div>${acctNumbers(a).map(n => `<a href="#" data-num="${n}">${n}</a>`).join(', ') || '—'}</div><div>Their calls in window</div><div>${corr.ownCalls.length}</div><div>Complainant calls in window</div><div>${corr.compCalls.length}</div><div>SMS/OTP in window</div><div>${corr.sms.length} ${corr.sms.some(s => s.otp) ? badge('OTP', 'amber') : ''}</div><div>Cell IDs</div><div>${esc(corr.cells.join(', ') || '—')}</div><div>IMEIs</div><div>${esc(corr.imeis.join(', ') || '—')}</div></div><div class="small dim" style="margin-top:6px">CDR / cell-site correlation indicates the serving cell only — not an exact location.</div></div>
    </div>
    <div class="card" style="margin-top:12px"><h4>Source reference</h4><div class="kv"><div>File</div><div>${esc(t.src.file)}</div><div>Sheet / Page</div><div>${esc(t.src.sheet || '')} ${t.src.page ? 'page ' + t.src.page : ''}</div><div>Row</div><div>${t.src.row}</div><div>Import</div><div>${esc(t.imp)} · parser ${esc(t.parser || '')} · confidence ${Math.round((t.conf || 0) * 100)}%</div><div>Original text</div><div class="mono small">${esc(t.raw)}</div></div></div>`;
  const md = modal({ title: 'Transaction ' + esc(t.id), body, foot: `${t.dr ? `<button id="txSeed">${isSeed ? 'Unmark disputed' : '⚑ Mark as disputed'}</button>` : ''}${m && m.credit ? '<button id="txRej">Reject this link</button>' : ''}${t.dr && (!m || !m.credit) ? '<button id="txLink">Link to credit…</button>' : ''}<button id="txTask">＋ Task</button><button class="btn-p" id="txRep">⎙ Transaction report</button>` });
  $$('[data-num]', md.el).forEach(x => x.onclick = e => { e.preventDefault(); md.close(); openNumber(x.dataset.num); });
  const fe = $('.tl .ev.focus', md.el); if (fe) fe.parentElement.scrollTop = Math.max(0, fe.offsetTop - 120);
  const seedB = $('#txSeed', md.el); if (seedB) seedB.onclick = async () => { c.work.disputed = isSeed ? c.work.disputed.filter(x => x !== id) : c.work.disputed.concat([id]); markDirty('work'); await audit(isSeed ? 'Unmarked disputed' : 'Marked disputed', id); md.close(); openTx(id); };
  const rj = $('#txRej', md.el); if (rj) rj.onclick = async () => { c.work.links.push({ type: 'txn', debit: id, credit: m.credit, status: 'REJECTED', by: S.user.email, at: nowStamp() }); markDirty('work'); await audit('Rejected transaction link', id + ' > ' + m.credit); md.close(); openTx(id); };
  const lk = $('#txLink', md.el); if (lk) lk.onclick = async () => { const v = await promptBox('Link debit ' + id + ' to a credit', [{ label: 'Credit transaction ID (TX-…)' }]); if (!v) return; const cr = IX.txById.get(v[0].trim()); if (!cr || !cr.cr) return toast('Not a credit transaction ID', 'warn'); c.work.links.push({ type: 'txn', debit: id, credit: cr.id, status: 'CONFIRMED', by: S.user.email, at: nowStamp() }); markDirty('work'); await audit('Confirmed transaction link', id + ' > ' + cr.id); md.close(); openTx(id); };
  $('#txTask', md.el).onclick = () => taskDialog({ task: 'Verify transaction ' + id + ' (' + inr(t.dr || t.cr) + ')', acct: a.acctNo });
  $('#txRep', md.el).onclick = () => reportTransaction(id);
}
function tel_color(r) { return r.kind === 'SMS' ? 'var(--amber)' : r.dir === 'OUT' ? 'var(--green)' : 'var(--pink)'; }

/* ------------------------------ NUMBER PROFILE ------------------------------ */
function openNumber(num) {
  const c = S.cur; const tel = T(); const info = IX.numInfo.get(num); const rows = tel.byTarget.get(num) || [];
  const appears = c.telecom.cdr.filter(r => r.other === num); const ipdr = c.ip.ipdr.filter(r => r.msisdn === num);
  const contacts = Array.from(groupBy(rows.filter(r => r.other), r => r.other).entries()).map(([n, l]) => ({ n, c: l.length, dur: sum(l, r => r.dur), known: tel.known.has(n) })).sort((a, b) => (b.known - a.known) || b.c - a.c).slice(0, 25);
  const linkedAccts = info ? uniq(info.links.filter(l => l.acctId).map(l => l.acctId)) : [];
  const txNear = []; const w = c.work.settings.cdrWindowMin * 60000;
  const evs = rows.concat(appears); if (evs.length) for (const t of c.txns.filter(t => c.work.disputed.includes(t.id) || D().flows.some(f => f.debit === t.id))) { if (!t.hasTime) continue; const n = evs.filter(r => Math.abs(r.ts - t.ts) <= w).length; if (n) txNear.push({ t, n }); }
  const body = `<div class="row" style="margin-bottom:10px"><b class="mono" style="font-size:18px">${esc(num)}</b> ${info ? Array.from(info.roles).map(r => badge(r, roleColor(r))).join(' ') : badge('Not linked to any account', 'gray')} ${rows.length ? badge('CDR uploaded', 'green') : badge('CDR pending', 'amber')}</div>
    <div class="grid g2"><div class="card"><h4>Links</h4>${info ? info.links.map(l => `<div class="small">${badge(l.kind, 'blue')} ${esc(l.label || '')}</div>`).join('') : '<div class="dim small">—</div>'}
      ${linkedAccts.map(id => `<div class="small"><a href="#" data-acc="${id}">Open account ${esc(IX.acctById.get(id).acctNo)}</a></div>`).join('')}</div>
    <div class="card"><h4>CDR summary</h4>${rows.length ? `<div class="kv"><div>Events</div><div>${rows.length} (${rows.filter(r => r.dir === 'IN').length} in / ${rows.filter(r => r.dir === 'OUT').length} out)</div><div>First / last seen</div><div>${fmtDT(Math.min(...rows.map(r => r.ts)))} → ${fmtDT(Math.max(...rows.map(r => r.ts)))}</div><div>Unique contacts</div><div>${uniq(rows.map(r => r.other)).length}</div><div>IMEIs</div><div class="mono small">${esc(uniq(rows.map(r => r.imei).filter(Boolean)).join(', ') || '—')}</div><div>Cells</div><div>${uniq(rows.map(r => r.cell).filter(Boolean)).length}</div></div>` : '<div class="dim small">No CDR for this number.</div>'}
      <div class="small" style="margin-top:6px">Appears in other targets' CDRs: <b>${appears.length}</b> events with ${esc(uniq(appears.map(r => r.target)).join(', ') || '—')}</div>
      <div class="small">IPDR sessions: <b>${ipdr.length}</b></div></div></div>
    <div class="grid g2" style="margin-top:12px"><div class="card"><h4>Top contacts</h4>${simpleTable([{ label: 'Number', html: x => `<a href="#" data-num="${x.n}" class="mono">${x.n}</a> ${x.known ? badge('KNOWN', 'amber') : ''}` }, { label: 'Events', k: 'c', num: 1 }, { label: 'Duration', get: x => Math.round(x.dur / 60) + ' min', num: 1 }, { label: 'Linked to', get: x => { const i = IX.numInfo.get(x.n); return i ? i.links.map(l => l.label).join('; ').slice(0, 60) : ''; } }], contacts, { maxH: 280 })}</div>
    <div class="card"><h4>Activity near traced transactions (±${c.work.settings.cdrWindowMin} min)</h4>${simpleTable([{ label: 'Txn', html: x => `<a href="#" data-tx="${x.t.id}">${x.t.id}</a>` }, { label: 'When', get: x => fmtDT(x.t.ts) }, { label: 'Amount', get: x => inr(x.t.dr || x.t.cr), num: 1 }, { label: 'Events', k: 'n', num: 1 }], txNear, { maxH: 280, empty: 'None.' })}</div></div>`;
  const md = modal({ title: 'Number profile — ' + esc(num), body, foot: `<button id="nbAdd">＋ Add as investigation number</button>` });
  $$('[data-num]', md.el).forEach(x => x.onclick = e => { e.preventDefault(); md.close(); openNumber(x.dataset.num); });
  $$('[data-acc]', md.el).forEach(x => x.onclick = e => { e.preventDefault(); md.close(); openAccount(x.dataset.acc); });
  $$('[data-tx]', md.el).forEach(x => x.onclick = e => { e.preventDefault(); md.close(); openTx(x.dataset.tx); });
  $('#nbAdd', md.el).onclick = () => { md.close(); addNumberDialog(num); };
}
