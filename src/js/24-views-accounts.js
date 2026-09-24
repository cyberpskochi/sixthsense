/* ------------------------------ ACCOUNTS ------------------------------ */
VIEWS.accounts = el => {
  const c = S.cur; const d = D();
  const rows = c.accts.map(a => { const r = d.acctRes.get(a.id) || {}; const lay = acctLayer(a.id); return { a, lay, r, n: (IX.txByAcct.get(a.id) || []).length }; }).sort((x, y) => (x.lay ?? 99) - (y.lay ?? 99) || (y.r.tin || 0) - (x.r.tin || 0));
  el.innerHTML = pageHead('Accounts', 'All accounts in the case with role, computed trail layer, statement coverage, KYC and linked numbers.', `<button id="aAdd">＋ Add account</button><button id="aX">Export</button>`) +
    `<div class="row" style="margin-bottom:10px"><input id="aQ" placeholder="Filter…" style="width:260px"><select id="aL"><option value="">All layers</option><option value="0">Complainant</option><option value="1">Layer 1</option><option value="2">Layer 2</option><option value="3">Layer 3+</option><option value="x">Not in trail</option></select><span class="small muted" id="aN"></span></div><div id="aT"></div>`;
  const cols = [
    { label: 'Layer', w: 110, html: x => x.lay == null ? badge('—', 'gray') : badge(x.lay === 0 ? 'Complainant' : 'L' + x.lay, x.lay === 0 ? 'red' : x.lay === 1 ? 'amber' : x.lay === 2 ? 'violet' : 'blue'), sort: x => x.lay ?? 99, x: x => x.lay },
    { label: 'Role', w: 120, html: x => x.a.role ? badge(x.a.role, roleColor(x.a.role)) : '<span class="dim">—</span>', get: x => x.a.role },
    { label: 'Account No', w: 170, html: x => `<span class="mono">${esc(x.a.acctNo)}</span>`, get: x => x.a.acctNo },
    { label: 'Holder', w: 190, get: x => x.a.holder }, { label: 'Bank', w: 150, get: x => x.a.bank }, { label: 'IFSC', w: 110, get: x => x.a.ifsc },
    { label: 'Txns', w: 70, num: 1, get: x => x.n }, { label: 'Traced in', w: 120, num: 1, get: x => x.r.tin ? inr(x.r.tin) : '', sort: x => x.r.tin || 0, x: x => x.r.tin || 0 },
    { label: 'Onward', w: 120, num: 1, get: x => x.r.tout ? inr(x.r.tout) : '', sort: x => x.r.tout || 0, x: x => x.r.tout || 0 },
    { label: 'Cash out', w: 110, num: 1, get: x => x.r.cash ? inr(x.r.cash) : '', sort: x => x.r.cash || 0, x: x => x.r.cash || 0 },
    { label: 'Possibly available', w: 140, num: 1, get: x => x.r.retained ? inr(x.r.retained) : '', sort: x => x.r.retained || 0, x: x => x.r.retained || 0 },
    { label: 'Mobiles (reg / alt)', w: 220, get: x => x.a.mobiles.join(', ') + (x.a.altMobiles.length ? ' / ' + x.a.altMobiles.join(', ') : '') },
    { label: 'Statement', w: 100, html: x => x.n ? badge('Uploaded', 'green') : badge('Pending', 'amber'), get: x => x.n ? 'Uploaded' : 'Pending' }
  ];
  const vt = vtable($('#aT', el), { cols, rows, height: 600, onClick: x => openAccount(x.a.id) });
  const filt = () => { const q = $('#aQ', el).value.toLowerCase(); const l = $('#aL', el).value; const f = rows.filter(x => (!q || (x.a.acctNo + ' ' + x.a.holder + ' ' + x.a.bank + ' ' + x.a.mobiles.join(' ') + ' ' + x.a.altMobiles.join(' ')).toLowerCase().includes(q)) && (!l || (l === 'x' ? x.lay == null : l === '3' ? x.lay >= 3 : x.lay === +l))); vt.set(f); $('#aN', el).textContent = f.length + ' accounts'; };
  $('#aQ', el).oninput = filt; $('#aL', el).onchange = filt; filt();
  $('#aX', el).onclick = () => exportTable('Accounts', cols, vt.rows());
  $('#aAdd', el).onclick = async () => { const v = await promptBox('Add account', [{ label: 'Account number' }, { label: 'Holder name' }, { label: 'Bank' }, { label: 'IFSC' }, { label: 'Role', type: 'select', options: ROLES, value: 'Accused (L1)' }]); if (!v || !v[0]) return; const a = ensureAcct(v[0], { holder: v[1], bank: v[2], ifsc: v[3].toUpperCase() }); a.role = v[4]; rebuildIndexes(); markDirty('accts'); audit('Added account manually', a.acctNo); go('accounts'); };
};
function openAccount(id) {
  const c = S.cur; const a = IX.acctById.get(id); if (!a) return; const d = D(); const r = d.acctRes.get(id) || {}; const list = IX.txByAcct.get(id) || []; const s = a.stmt;
  const inFlows = d.flows.filter(f => f.toAcct === id), outFlows = d.flows.filter(f => f.fromAcct === id);
  const cpAgg = (arr, key) => Array.from(groupBy(arr, key).entries()).filter(([k]) => k).map(([k, l]) => ({ k, n: l.length, amt: sum(l, t => t.dr || t.cr) })).sort((x, y) => y.amt - x.amt).slice(0, 8);
  const cpKey = t => { const m = t.cr ? d.L.R.get(t.id) : null; if (m) return (IX.acctById.get(IX.txById.get(m).acctId) || {}).acctNo; const mm = t.dr ? d.L.M.get(t.id) : null; if (mm && mm.toAcct) return (IX.acctById.get(mm.toAcct) || {}).acctNo; return t.cpAcct[0] || t.upi || t.cpMasked || t.cpName || ''; };
  const topIn = cpAgg(list.filter(t => t.cr), cpKey), topOut = cpAgg(list.filter(t => t.dr), cpKey);
  const nums = acctNumbers(a); const tel = T(); const logs = IPX().byAcct.get(id) || [];
  const micro = list.filter(t => (t.dr || t.cr) <= c.work.settings.microMax);
  const body = `
    <div class="row" style="margin-bottom:10px">${badge(a.role || 'Role not set', roleColor(a.role))} ${badge(layerName(acctLayer(id)), 'cyan')} ${a.layerNcrp != null ? badge('NCRP layer ' + a.layerNcrp, 'gray') : ''} ${list.length ? badge('Statement uploaded', 'green') : badge('Statement pending', 'amber')}</div>
    <div class="grid g2">
      <div class="card"><h4>Account & KYC</h4><div class="kv">
        <div>Account</div><div class="mono">${esc(a.acctNo)}</div><div>Holder</div><div>${esc(a.holder || '—')}</div><div>Bank / IFSC</div><div>${esc(a.bank || '—')} · ${esc(a.ifsc || '—')}</div><div>Branch</div><div>${esc(a.branch || '—')}</div>
        <div>Registered mobile</div><div>${a.mobiles.map(n => `<a href="#" data-num="${n}">${n}</a>`).join(', ') || '—'}</div><div>Alternate numbers</div><div>${a.altMobiles.map(n => `<a href="#" data-num="${n}">${n}</a>`).join(', ') || '—'}</div>
        <div>E-mail</div><div>${esc(a.emails.join(', ') || '—')}</div><div>PAN</div><div>${esc(a.pan || '—')}</div><div>UPI IDs</div><div>${esc((a.kyc.upi || []).join(', ') || '—')}</div><div>Customer ID</div><div>${esc(a.custId || '—')}</div><div>Address</div><div>${esc(a.address || '—')}</div></div></div>
      <div class="card"><h4>Statement period analysis</h4>${s ? `<div class="kv">
        <div>Period</div><div>${fmtDate(s.from)} → ${fmtDate(s.to)}</div><div>Opening / Closing</div><div>${inr(s.opening)} / ${inr(s.closing)}</div>
        <div>Transactions</div><div>${s.n} (${s.nCr} Cr / ${s.nDr} Dr)</div><div>Total credits</div><div class="cr">${inr(s.totCr)}</div><div>Total debits</div><div class="dr">${inr(s.totDr)}</div>
        <div>Largest Cr / Dr</div><div>${inr(s.maxCr)} / ${inr(s.maxDr)}</div><div>Average Cr / Dr</div><div>${inr(s.avgCr)} / ${inr(s.avgDr)}</div><div>Minimum Cr / Dr</div><div>${inr(s.minCr)} / ${inr(s.minDr)}</div>
        <div>Channels</div><div class="small">${Object.entries(s.channels).map(([k, v]) => k + ' ' + v).join(' · ')}</div><div>Time available</div><div>${s.timeAvail}/${s.n} ${s.timeAvail < s.n ? '<span class="small dim">(time unavailable in source statement for others)</span>' : ''}</div></div>` : '<div class="dim">No statement uploaded.</div>'}</div>
    </div>
    <div class="grid g4" style="margin-top:12px">${kpi('Traced in', inr(r.tin || 0))}${kpi('Onward (traced)', inr(r.tout || 0))}${kpi('Cash / ATM', inr(r.cash || 0))}${kpi('Possibly available', inr(r.retained || 0), '', 'rgba(0,255,157,.18)')}</div>
    <div class="grid g2" style="margin-top:12px">
      <div class="card"><h4>Traced money in (${inFlows.length})</h4>${simpleTable([{ label: 'From', get: f => (IX.acctById.get(f.fromAcct) || {}).acctNo }, { label: 'When', get: f => fmtDT(f.ts, f.hasTime) }, { label: 'Amount', get: f => inr(f.amt), num: 1 }, { label: 'Match', html: f => strengthBadge(f.strength) }], inFlows, { maxH: 220 })}</div>
      <div class="card"><h4>Traced money out (${outFlows.length})</h4>${simpleTable([{ label: 'To', get: f => f.toAcct ? (IX.acctById.get(f.toAcct) || {}).acctNo : f.toExt.label }, { label: 'When', get: f => fmtDT(f.ts, f.hasTime) }, { label: 'Amount', get: f => inr(f.amt), num: 1 }, { label: 'After receipt', get: f => f.gap != null ? durTxt(f.gap) : '' }, { label: 'Match', html: f => strengthBadge(f.strength) }], outFlows, { maxH: 220 })}</div>
      <div class="card"><h4>Top incoming sources (all credits)</h4>${simpleTable([{ label: 'Source', k: 'k' }, { label: 'Count', k: 'n', num: 1 }, { label: 'Amount', get: x => inr(x.amt), num: 1 }], topIn, { maxH: 220 })}</div>
      <div class="card"><h4>Top outgoing destinations (all debits)</h4>${simpleTable([{ label: 'Destination', k: 'k' }, { label: 'Count', k: 'n', num: 1 }, { label: 'Amount', get: x => inr(x.amt), num: 1 }], topOut, { maxH: 220 })}</div>
      <div class="card"><h4>Linked numbers & CDR</h4>${nums.length ? nums.map(n => { const tg = tel.targets.find(t => t.num === n); return `<div class="small" style="padding:3px 0"><a href="#" data-num="${n}" class="mono">${n}</a> ${a.mobiles.includes(n) ? badge('Registered', 'blue') : badge('Alternate', 'violet')} ${tg ? badge(tg.n + ' CDR events', 'green') : badge('CDR pending', 'amber')}</div>`; }).join('') : '<div class="dim small">No mobile numbers on record — import KYC.</div>'}</div>
      <div class="card"><h4>Login IPs (${logs.length})</h4>${logs.length ? simpleTable([{ label: 'Time', get: l => fmtDT(l.ts) }, { label: 'IP', get: l => l.ip + (l.port ? ':' + l.port : '') }, { label: 'Type', get: l => ipClass(l.ip).label }, { label: 'Channel', k: 'channel' }, { label: 'Device', k: 'device' }], logs.slice(-50).reverse(), { maxH: 220 }) : '<div class="dim small">No IP logs imported.</div>'}</div>
    </div>
    ${micro.length ? `<div class="card" style="margin-top:12px"><h4>Micro transactions (≤ ${inr(c.work.settings.microMax, 0)})</h4>${simpleTable([{ label: 'Date', get: t => fmtDT(t.ts, t.hasTime) }, { label: 'Amount', html: t => `<span class="${t.dr ? 'dr' : 'cr'}">${inr(t.dr || t.cr)}</span>`, num: 1 }, { label: 'Label', html: t => VALIDATION_RX.test(t.narr) ? badge('POSSIBLE ACCOUNT VALIDATION', 'amber') : badge('MICRO TRANSACTION', 'gray') }, { label: 'Narration', get: t => t.narr.slice(0, 80) }], micro, { maxH: 200 })}</div>` : ''}`;
  const m = modal({ title: 'Account profile — ' + esc(acctLabel(a)), body, foot: `<button id="apRole">Set role</button><button id="apEdit">Edit KYC</button><button id="apTx">View transactions</button><button id="apRep" class="btn-p">⎙ Account report (PDF)</button>` });
  $$('[data-num]', m.el).forEach(x => x.onclick = e => { e.preventDefault(); m.close(); openNumber(x.dataset.num); });
  $('#apTx', m.el).onclick = () => { m.close(); go('txns', { acct: id }); };
  $('#apRep', m.el).onclick = () => reportAccount(id);
  $('#apRole', m.el).onclick = async () => { const v = await promptBox('Role of ' + a.acctNo, [{ label: 'Role', type: 'select', options: ROLES, value: a.role || 'Unknown' }]); if (v) { a.role = v[0]; markDirty('accts'); audit('Set account role', a.acctNo + ' → ' + v[0]); m.close(); openAccount(id); } };
  $('#apEdit', m.el).onclick = async () => { const v = await promptBox('Edit KYC — ' + a.acctNo, [{ label: 'Holder', value: a.holder }, { label: 'Bank', value: a.bank }, { label: 'IFSC', value: a.ifsc }, { label: 'Registered mobile(s), comma separated', value: a.mobiles.join(', ') }, { label: 'Alternate numbers, comma separated', value: a.altMobiles.join(', ') }, { label: 'E-mails', value: a.emails.join(', ') }, { label: 'PAN', value: a.pan }, { label: 'UPI IDs', value: (a.kyc.upi || []).join(', ') }, { label: 'Address', value: a.address }]); if (!v) return; const before = JSON.stringify([a.holder, a.mobiles, a.altMobiles]); Object.assign(a, { holder: v[0].toUpperCase(), bank: v[1], ifsc: v[2].toUpperCase(), mobiles: v[3].split(/[,\s]+/).map(normPhone).filter(Boolean), altMobiles: v[4].split(/[,\s]+/).map(normPhone).filter(Boolean), emails: v[5].split(/[,\s]+/).filter(Boolean), pan: v[6].toUpperCase(), address: v[8] }); a.kyc.upi = v[7].split(/[,\s]+/).filter(Boolean); rebuildIndexes(); markDirty('accts'); audit('Edited KYC', a.acctNo + ' before=' + before); m.close(); openAccount(id); };
}

/* ------------------------------ ENTITIES & LINKS ------------------------------ */
VIEWS.entities = el => {
  const c = S.cur; const matches = entityMatches();
  el.innerHTML = pageHead('Entities & Links', 'Persons and organisations, plus identifiers shared between accounts. Records are never merged automatically — each possible match must be confirmed or rejected with its evidence.', `<button id="eAdd">＋ Add entity</button><button id="nAdd">＋ Add investigation number</button>`) +
    `<div class="grid g2"><div class="card"><h3>Possible matches between accounts (${matches.length})</h3><div id="mT"></div></div>
     <div class="card"><h3>Entities (${c.work.entities.length})</h3><div id="eT"></div><h3 style="margin-top:14px">Investigation numbers (${c.work.numbers.length})</h3><div id="nT"></div></div></div>`;
  $('#mT', el).innerHTML = simpleTable([{ label: 'Shared', html: m => `${badge(m.type, 'cyan')} <span class="mono">${esc(m.v)}</span>` }, { label: 'Accounts', html: m => m.accts.map(id => esc(acctLabel(IX.acctById.get(id)))).join('<br>') }, { label: 'Status', html: m => badge(m.status, m.status === 'CONFIRMED LINK' ? 'green' : m.status === 'REJECTED' ? 'gray' : 'amber') }, { label: '', html: m => `<button class="btn-sm" data-cf="${esc(m.id)}">Confirm</button> <button class="btn-sm btn-g" data-rj="${esc(m.id)}">Reject</button>` }], matches, { empty: 'No identifiers shared between accounts.' });
  const setLink = async (key, status) => { c.work.links = c.work.links.filter(l => !(l.type === 'entity' && l.key === key)); c.work.links.push({ type: 'entity', key, status, by: S.user.email, at: nowStamp() }); markDirty('work'); await audit(status === 'CONFIRMED LINK' ? 'Confirmed entity link' : 'Rejected entity link', key); go('entities'); };
  $$('[data-cf]', el).forEach(b => b.onclick = () => setLink(b.dataset.cf, 'CONFIRMED LINK')); $$('[data-rj]', el).forEach(b => b.onclick = () => setLink(b.dataset.rj, 'REJECTED'));
  $('#eT', el).innerHTML = simpleTable([{ label: 'ID', k: 'id' }, { label: 'Type', html: e => badge(e.type, roleColor(e.type)) }, { label: 'Name', k: 'name' }, { label: 'Identifiers', get: e => [...(e.mobiles || []), ...(e.ids || [])].join(', ') }, { label: 'Accounts', get: e => (e.accts || []).join(', ') }], c.work.entities, { empty: 'Account holders appear under Accounts. Add persons/organisations here (e.g. SIM holders, handlers).' });
  $('#nT', el).innerHTML = simpleTable([{ label: 'Number', html: n => `<a href="#" data-num="${n.num}" class="mono">${n.num}</a>` }, { label: 'Role', html: n => badge(n.role, roleColor(n.role)) }, { label: 'Source', k: 'source' }, { label: 'Person', k: 'person' }, { label: 'Remarks', k: 'remarks' }, { label: '', html: n => `<button class="btn-sm btn-g" data-nd="${n.id}">✕</button>` }], c.work.numbers, { empty: 'Add numbers that have no known bank account (e.g. caller of the complainant).' });
  $$('[data-num]', el).forEach(x => x.onclick = e => { e.preventDefault(); openNumber(x.dataset.num); });
  $$('[data-nd]', el).forEach(b => b.onclick = async () => { c.work.numbers = c.work.numbers.filter(n => n.id !== b.dataset.nd); rebuildIndexes(); markDirty('work'); await audit('Removed investigation number', b.dataset.nd); go('entities'); });
  $('#nAdd', el).onclick = () => addNumberDialog();
  $('#eAdd', el).onclick = async () => { const v = await promptBox('Add entity', [{ label: 'Type', type: 'select', options: ENTITY_TYPES, value: 'PERSON' }, { label: 'Name' }, { label: 'Mobile numbers (comma separated)' }, { label: 'Other identifiers (UPI, e-mail, IMEI, PAN…)' }, { label: 'Linked account numbers' }, { label: 'Remarks', type: 'textarea' }]); if (!v || !v[1]) return; c.work.entities.push({ id: nextId('PERSON'), type: v[0], name: v[1], mobiles: v[2].split(/[,\s]+/).map(normPhone).filter(Boolean), ids: v[3].split(/[,\s]+/).filter(Boolean), accts: v[4].split(/[,\s]+/).filter(Boolean), remarks: v[5] }); rebuildIndexes(); markDirty('work'); await audit('Added entity', v[1]); go('entities'); };
};
async function addNumberDialog(num = '') {
  const v = await promptBox('Add investigation number', [{ label: 'Mobile number', value: num }, { label: 'Role', type: 'select', options: NUMBER_ROLES, value: 'Suspect' }, { label: 'Source (e.g. complainant statement, NCRP, CDR)' }, { label: 'Person / entity if known' }, { label: 'Remarks' }]);
  if (!v || !normPhone(v[0])) return; const c = S.cur;
  c.work.numbers.push({ id: nextId('MOB'), num: normPhone(v[0]), role: v[1], source: v[2], person: v[3], remarks: v[4], added: nowStamp() });
  rebuildIndexes(); markDirty('work'); await audit('Added investigation number', normPhone(v[0]) + ' ' + v[1]); toast('Number added — all CDR/IPDR data is now searched for it', 'ok');
  if (S.view === 'entities' || S.view === 'telecom') go(S.view);
}
