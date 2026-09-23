/* ------------------------------ MONEY TRAIL ------------------------------ */
let TRAIL_TAB = 'layers';
VIEWS.trail = el => {
  const c = S.cur; const d = D(); const t = d.tot; const st = c.work.settings;
  const layers = Array.from(new Set(Array.from(d.acctRes.values()).map(r => r.layer))).sort((a, b) => a - b);
  el.innerHTML = pageHead('Money Trail', `Forward trace from ${t.seeds} disputed transaction(s) across ${d.acctRes.size} account(s). Matching priority: UTR → reference → beneficiary account/UPI/mobile in narration → amount + time (unique only). Rule: <b>${st.taintRule === 'PROPORTIONAL' ? 'proportional to balance' : 'traced-funds-first (FIFO)'}</b>, capped by running balance.`, `<button id="trSet">⚙ Trace settings</button><button id="trX">Export trail (Excel)</button>`) +
    (t.seeds ? '' : `<div class="notice" style="margin-bottom:12px">Mark the complainant's disputed debits first (Transactions → ⚑), or import the NCRP money trail.</div>`) +
    `<div class="row" style="margin-bottom:12px;gap:6px;flex-wrap:wrap"><span class="chain"><span class="lk" style="border-color:var(--red)">Loss<br><b>${inr(t.loss)}</b></span>${layers.filter(l => l > 0).map(l => { const b = d.byLayer.get(l); return `<span class="ar">⟶</span><span class="lk">${layerName(l)}<br><b>${inr(b.tin)}</b> · ${b.accts} a/c</span>`; }).join('')}<span class="ar">⟶</span><span class="lk" style="border-color:var(--green)">Possibly available<br><b>${inr(t.retained)}</b></span><span class="lk">Cash/ATM<br><b>${inr(t.cash)}</b></span><span class="lk" style="border-color:var(--amber)">Unresolved<br><b>${inr(t.unresolved + t.pending)}</b></span></span></div>
    <div class="tabs">${[['layers', 'Layer view'], ['flows', 'Flow ledger'], ['seeds', 'By disputed transaction'], ['common', 'Common receivers'], ['amb', `Ambiguous (${d.L.ambiguous.length})`]].map(([k, l]) => `<button class="${TRAIL_TAB === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div><div id="trBody"></div>`;
  $$('[data-tab]', el).forEach(b => b.onclick = () => { TRAIL_TAB = b.dataset.tab; go('trail'); });
  $('#trSet', el).onclick = trailSettings; $('#trX', el).onclick = () => exportWorkbook(['Trail', 'Accounts']);
  const body = $('#trBody', el); const an = id => IX.acctById.get(id) || {};
  if (TRAIL_TAB === 'layers') {
    const cols = [0, ...layers.filter(l => l > 0)];
    const nodeHtml = (id, lay) => { const a = an(id); const r = d.acctRes.get(id) || { tin: sum(d.seeds.filter(s => s.acctId === id), s => s.dr), tout: 0, retained: 0, cash: 0 }; const base = Math.max(r.tin, 1);
      return `<div class="acc-node l${Math.min(lay, 4)}" data-acc="${id}"><div class="row sb"><span class="an">${esc(a.acctNo)}</span>${r.hasStmt === false ? badge('No stmt', 'amber') : ''}</div><div class="small">${esc((a.holder || '').slice(0, 26))}</div><div class="small dim">${esc((a.bank || '').slice(0, 26))}</div>
        <div class="small" style="margin-top:4px">${lay === 0 ? 'Lost' : 'In'} <b>${inr(lay === 0 ? r.tin : r.tin)}</b>${r.retained >= 1 ? ` · <span class="cr">avail ${inrShort(r.retained)}</span>` : ''}${r.cash >= 1 ? ` · cash ${inrShort(r.cash)}` : ''}</div>
        <div class="bar"><i style="width:${Math.min(100, 100 * r.tout / base)}%;background:var(--blue)"></i></div></div>`; };
    const extFlows = d.flows.filter(f => f.toExt);
    body.innerHTML = `<div class="trail-layer">${cols.map(l => { const ids = l === 0 ? Array.from(d.compIds) : Array.from(d.acctRes.entries()).filter(([, r]) => r.layer === l).sort((a, b) => b[1].tin - a[1].tin).map(x => x[0]); return `<div class="layer-col"><div class="lh"><span>${layerName(l)}</span><span>${ids.length}</span></div>${ids.map(id => nodeHtml(id, l)).join('')}</div>`; }).join('')}
      <div class="layer-col"><div class="lh"><span>Exits & unresolved</span><span>${extFlows.length}</span></div>${Array.from(groupBy(extFlows, f => f.toExt.kind + '|' + f.toExt.label).entries()).sort((a, b) => sum(b[1], f => f.amt) - sum(a[1], f => f.amt)).slice(0, 150).map(([k, fl]) => `<div class="acc-node ext lx"><div class="an">${esc(fl[0].toExt.label)}</div><div class="small">${badge(fl[0].toExt.kind, fl[0].toExt.kind === 'CASH' ? 'violet' : fl[0].toExt.kind === 'EXT' ? 'amber' : 'gray')} ${fl.length} txn · <b>${inr(sum(fl, f => f.amt))}</b></div><div class="small dim">from ${esc(uniq(fl.map(f => an(f.fromAcct).acctNo)).slice(0, 3).join(', '))}</div></div>`).join('')}</div></div>`;
    $$('[data-acc]', body).forEach(n => n.onclick = () => openAccount(n.dataset.acc));
  } else if (TRAIL_TAB === 'flows') {
    const cols = [{ label: 'Flow', w: 60, get: f => f.id }, { label: 'From layer', w: 90, get: f => layerName(f.layerFrom) }, { label: 'From account', w: 150, get: f => an(f.fromAcct).acctNo }, { label: 'To', w: 190, get: f => f.toAcct ? an(f.toAcct).acctNo + (f.pending ? ' (no stmt)' : '') : f.toExt.label },
      { label: 'Date', w: 92, get: f => fmtDate(f.ts), sort: f => f.ts }, { label: 'Time', w: 70, get: f => f.hasTime ? fmtTime(f.ts) : '—' }, { label: 'Traced amt', w: 120, num: 1, get: f => inr(f.amt), sort: f => f.amt, x: f => f.amt }, { label: 'Txn amount', w: 120, num: 1, get: f => inr(f.full), sort: f => f.full, x: f => f.full },
      { label: '% of txn', w: 70, num: 1, get: f => Math.round(100 * f.amt / f.full) + '%' }, { label: 'After receipt', w: 100, get: f => f.gap != null ? durTxt(f.gap) : '', sort: f => f.gap }, { label: 'Channel', w: 80, get: f => f.channel }, { label: 'UTR', w: 150, get: f => (IX.txById.get(f.debit) || {}).utr || '' },
      { label: 'Match', w: 100, html: f => strengthBadge(f.strength), get: f => f.strength }, { label: 'Why', w: 420, get: f => (f.reasons || []).join(' · ') }];
    body.innerHTML = '<div id="flT"></div>'; vtable($('#flT', body), { cols, rows: d.flows.slice().sort((a, b) => a.layerFrom - b.layerFrom || a.ts - b.ts), height: 600, onClick: f => openTx(f.debit) });
  } else if (TRAIL_TAB === 'seeds') {
    body.innerHTML = d.seeds.map(s => { const fw = traceForward(s.id, 8); const a = an(s.acctId); const reach = uniq(fw.filter(f => f.toAcct).map(f => f.toAcct));
      return `<div class="card" style="margin-bottom:10px"><div class="row sb"><div><b class="mono">${esc(s.id)}</b> · ${fmtDT(s.ts, s.hasTime)} · <span class="dr">${inr(s.dr)}</span> from <span class="mono">${esc(a.acctNo)}</span> · UTR ${esc(s.utr || '—')}</div><div class="small muted">${reach.length} accounts reached · ${inr(sum(fw.filter(f => f.toExt && f.toExt.kind === 'CASH'), f => f.parts.filter(p => p.o === s.id).reduce((x, p) => x + p.a, 0)))} cash</div></div>
        <div style="margin-top:6px">${fw.slice(0, 80).map(f => `<div class="small" style="padding-left:${f.depth * 16}px">↳ ${esc(an(f.fromAcct).acctNo)} → <b>${f.toAcct ? esc(an(f.toAcct).acctNo) : esc(f.toExt.label)}</b> ${inr(sum(f.parts.filter(p => p.o === s.id), p => p.a))} <span class="dim">${fmtDT(f.ts, f.hasTime)}</span> ${strengthBadge(f.strength)}</div>`).join('') || '<div class="dim small">Not traced beyond the complainant account.</div>'}</div></div>`; }).join('') || emptyState('No disputed transactions.');
  } else if (TRAIL_TAB === 'common') {
    const rows = Array.from(d.acctRes.entries()).map(([id, r]) => ({ id, r, a: an(id), nO: r.origins.length, nF: r.fromAccts.length, nC: uniq(r.origins.map(o => d.originAcct.get(o))).length })).filter(x => x.nO >= 2 || x.nF >= 2).sort((a, b) => b.nO - a.nO || b.r.tin - a.r.tin);
    body.innerHTML = `<p class="small muted">Accounts that received traced money from more than one disputed transaction or sending account — typical of mule/aggregator accounts.</p>` + simpleTable([{ label: 'Account', html: x => `<span class="mono">${esc(x.a.acctNo)}</span> ${esc(x.a.holder || '')}` }, { label: 'Layer', get: x => layerName(x.r.layer) }, { label: 'Disputed txns', k: 'nO', num: 1 }, { label: 'Complainant a/cs', k: 'nC', num: 1 }, { label: 'Sending a/cs', k: 'nF', num: 1 }, { label: 'Total traced in', get: x => inr(x.r.tin), num: 1 }, { label: 'Breakdown by complainant account', get: x => Array.from(groupBy(d.flows.filter(f => f.toAcct === x.id), f => 'all').values()).length ? uniq(x.r.origins.map(o => an(d.originAcct.get(o)).acctNo)).join(', ') : '' }], rows, { click: 1 });
    bindRows(body, rows, x => openAccount(x.id));
  } else if (TRAIL_TAB === 'amb') {
    body.innerHTML = `<p class="small muted">These debits have several credits with the same amount inside the time window and no UTR/account reference. They are <b>not</b> linked automatically. Confirm the right one if evidence supports it.</p>` + (d.L.ambiguous.map(x => { const dt = IX.txById.get(x.debit); return `<div class="card" style="margin-bottom:8px"><b>${esc(dt.id)}</b> ${esc(an(dt.acctId).acctNo)} · <span class="dr">${inr(dt.dr)}</span> · ${fmtDT(dt.ts, dt.hasTime)} · ${esc(dt.narr.slice(0, 80))}${x.cands.map(cid => { const cr = IX.txById.get(cid); return `<div class="row small" style="margin-top:4px">→ <span class="mono">${esc(an(cr.acctId).acctNo)}</span> <span class="cr">${inr(cr.cr)}</span> ${fmtDT(cr.ts, cr.hasTime)} ${esc(cr.narr.slice(0, 60))} <button class="btn-sm" data-cf="${dt.id}>${cid}">Confirm link</button></div>`; }).join('')}</div>`; }).join('') || emptyState('No ambiguous matches.'));
    $$('[data-cf]', body).forEach(b => b.onclick = async () => { const [dd, cc] = b.dataset.cf.split('>'); c.work.links.push({ type: 'txn', debit: dd, credit: cc, status: 'CONFIRMED', by: S.user.email, at: nowStamp() }); markDirty('work'); await audit('Confirmed transaction link', dd + ' > ' + cc); go('trail'); });
  }
};
async function trailSettings() {
  const st = S.cur.work.settings;
  const v = await promptBox('Trace & correlation settings', [
    { label: 'Matching time window when both times known (minutes)', type: 'number', value: st.windowMin },
    { label: 'Matching window when time unavailable (hours)', type: 'number', value: st.unknownTimeWindowH },
    { label: 'Amount tolerance (₹)', type: 'number', value: st.amtTolAbs }, { label: 'Amount tolerance (%)', type: 'number', value: st.amtTolPct },
    { label: 'Max days traced money is followed inside one account', type: 'number', value: st.maxHoldDays },
    { label: 'Attribution rule', type: 'select', options: ['TAINT_FIRST', 'PROPORTIONAL'], value: st.taintRule },
    { label: 'Layers to trace (0 = unlimited)', type: 'number', value: st.maxLayers },
    { label: 'CDR / SMS correlation window ± minutes', type: 'number', value: st.cdrWindowMin },
    { label: 'Login session window before a transaction (minutes)', type: 'number', value: st.ipSessionMin },
    { label: 'IPDR time tolerance ± minutes', type: 'number', value: st.ipdrTolMin },
    { label: 'Micro-transaction threshold (₹)', type: 'number', value: st.microMax }], 'Apply & re-run');
  if (!v) return;
  const keys = ['windowMin', 'unknownTimeWindowH', 'amtTolAbs', 'amtTolPct', 'maxHoldDays', 'taintRule', 'maxLayers', 'cdrWindowMin', 'ipSessionMin', 'ipdrTolMin', 'microMax'];
  keys.forEach((k, i) => st[k] = k === 'taintRule' ? v[i] : Math.max(0, +v[i] || 0));
  markDirty('work'); await audit('Changed analysis settings', JSON.stringify(st)); go(S.view);
}

/* ------------------------------ NETWORK GRAPH ------------------------------ */
const NET = { f: { accts: 1, ext: 1, mobiles: 1, calls: 1, ip: 1, imei: 1, all: 0 }, layout: 'layered' };
VIEWS.network = el => {
  el.innerHTML = pageHead('Network Graph', 'Accounts, money flows, linked numbers, direct calls, shared login IPs and handsets in one picture. Click a node for details. Edge thickness = traced amount.', `<select id="nLay"><option value="layered">Layered (money trail)</option><option value="cose">Force-directed</option></select><button id="nPng">Save PNG</button>`) +
    `<div class="row" style="margin-bottom:8px" id="nChips">${[['accts', 'Trail accounts'], ['all', 'All other accounts'], ['ext', 'Exits / unresolved'], ['mobiles', 'Linked mobiles'], ['calls', 'CDR hits'], ['ip', 'Shared IPs'], ['imei', 'Shared IMEI']].map(([k, l]) => `<span class="chip ${NET.f[k] ? 'on' : ''}" data-k="${k}">${l}</span>`).join('')}</div>
    <div class="legend" style="margin-bottom:8px"><span><i style="background:#e66767"></i>Complainant</span><span><i style="background:#c98500"></i>Layer 1</span><span><i style="background:#9085e9"></i>Layer 2</span><span><i style="background:#3987e5"></i>Layer 3+</span><span><i style="background:#5f7599"></i>Exit / other</span><span><i style="background:#199e70"></i>Mobile</span><span><i style="background:#d55181"></i>IP / IMEI</span></div>
    <div id="graph"></div>`;
  $('#nLay', el).value = NET.layout; $('#nLay', el).onchange = e => { NET.layout = e.target.value; go('network'); };
  $$('#nChips .chip', el).forEach(ch => ch.onclick = () => { NET.f[ch.dataset.k] = NET.f[ch.dataset.k] ? 0 : 1; go('network'); });
  if (typeof cytoscape === 'undefined') { $('#graph', el).innerHTML = emptyState('Graph library not loaded.'); return; }
  const d = D(); const nodes = new Map(); const edges = [];
  const lc = l => l === 0 ? '#e66767' : l === 1 ? '#c98500' : l === 2 ? '#9085e9' : l >= 3 ? '#3987e5' : '#5f7599';
  const addA = (id) => { if (nodes.has(id)) return; const a = IX.acctById.get(id); const l = acctLayer(id); nodes.set(id, { data: { id, label: a.acctNo.slice(-6) + (a.holder ? '\n' + a.holder.split(' ')[0] : ''), color: lc(l), layer: l ?? 9, kind: 'acct', size: 26 + Math.min(30, Math.sqrt(((d.acctRes.get(id) || {}).tin || 0) / 2000)) } }); };
  if (NET.f.accts) { d.compIds.forEach(addA); for (const id of d.acctRes.keys()) addA(id); }
  if (NET.f.all) S.cur.accts.forEach(a => addA(a.id));
  const agg = new Map();
  for (const f of d.flows) {
    if (!nodes.has(f.fromAcct)) continue; let to = f.toAcct;
    if (!to) { if (!NET.f.ext) continue; to = 'X:' + f.toExt.kind + ':' + f.toExt.label; if (!nodes.has(to)) nodes.set(to, { data: { id: to, label: f.toExt.label.slice(0, 22), color: '#5f7599', layer: 99, kind: 'ext', size: 20 } }); }
    else if (!nodes.has(to)) continue;
    const k = f.fromAcct + '>' + to; agg.set(k, (agg.get(k) || 0) + f.amt);
  }
  for (const [k, amt] of agg) { const [s, t] = k.split('>'); edges.push({ data: { id: 'e' + edges.length, source: s, target: t, label: inrShort(amt), w: 1 + Math.min(9, Math.log10(amt + 1) - 2), color: '#3987e5', kind: 'money' } }); }
  const accIds = Array.from(nodes.values()).filter(n => n.data.kind === 'acct').map(n => n.data.id);
  if (NET.f.mobiles) for (const id of accIds) { const a = IX.acctById.get(id); for (const n of acctNumbers(a)) { const nid = 'M:' + n; if (!nodes.has(nid)) nodes.set(nid, { data: { id: nid, label: n, color: '#199e70', layer: 50, kind: 'mob', size: 16 } }); edges.push({ data: { id: 'e' + edges.length, source: id, target: nid, w: 1, color: '#199e70', kind: 'owns', label: a.mobiles.includes(n) ? '' : 'alt' } }); } }
  if (NET.f.calls && S.cur.telecom.cdr.length) for (const x of T().direct.slice(0, 300)) { for (const n of [x.a, x.b]) { const nid = 'M:' + n; if (!nodes.has(nid)) nodes.set(nid, { data: { id: nid, label: n, color: '#199e70', layer: 50, kind: 'mob', size: 16 } }); } edges.push({ data: { id: 'e' + edges.length, source: 'M:' + x.a, target: 'M:' + x.b, w: 1 + Math.min(6, Math.log2(x.n)), color: x.complainant ? '#e66767' : '#8aa0c2', kind: 'call', label: x.n + ' calls' } }); }
  if (NET.f.ip) for (const s of IPX().sharedIp.slice(0, 100)) { const nid = 'I:' + s.ip; nodes.set(nid, { data: { id: nid, label: s.ip, color: '#d55181', layer: 60, kind: 'ip', size: 18 } }); for (const a of s.accts) { addA(a); edges.push({ data: { id: 'e' + edges.length, source: a, target: nid, w: 1.5, color: '#d55181', kind: 'login', label: 'login' } }); } }
  if (NET.f.imei && S.cur.telecom.cdr.length) for (const s of T().sharedImei) { const nid = 'E:' + s.imei; nodes.set(nid, { data: { id: nid, label: 'IMEI ' + s.imei.slice(-6), color: '#d55181', layer: 70, kind: 'imei', size: 16 } }); for (const n of s.nums) { const mid = 'M:' + n; if (!nodes.has(mid)) nodes.set(mid, { data: { id: mid, label: n, color: '#199e70', layer: 50, kind: 'mob', size: 16 } }); edges.push({ data: { id: 'e' + edges.length, source: mid, target: nid, w: 1.5, color: '#d55181', kind: 'imei' } }); } }
  const els = Array.from(nodes.values()).concat(edges.filter(e => nodes.has(e.data.source) && nodes.has(e.data.target)));
  if (!nodes.size) { $('#graph', el).innerHTML = emptyState('Nothing to draw yet.'); return; }
  const layout = NET.layout === 'layered' ? { name: 'preset', positions: layeredPositions(nodes, edges), fit: true, padding: 30 } : { name: 'cose', animate: false, nodeRepulsion: 9000, idealEdgeLength: 90 };
  const cy = cytoscape({ container: $('#graph', el), elements: els, layout,
    style: [
      { selector: 'node', style: { 'background-color': 'data(color)', label: 'data(label)', color: '#dbe6f7', 'font-size': 9, 'text-wrap': 'wrap', 'text-valign': 'bottom', 'text-margin-y': 4, width: 'data(size)', height: 'data(size)', 'border-width': 2, 'border-color': '#0f1b31', 'text-outline-color': '#070d1a', 'text-outline-width': 2 } },
      { selector: 'node[kind="ext"]', style: { shape: 'round-rectangle', 'border-style': 'dashed', 'border-color': '#8aa0c2' } },
      { selector: 'node[kind="ip"],node[kind="imei"]', style: { shape: 'diamond' } }, { selector: 'node[kind="mob"]', style: { shape: 'ellipse' } },
      { selector: 'edge', style: { width: 'data(w)', 'line-color': 'data(color)', 'target-arrow-color': 'data(color)', 'curve-style': 'bezier', opacity: .8, 'font-size': 8, color: '#8aa0c2', 'text-rotation': 'autorotate', 'text-background-color': '#070d1a', 'text-background-opacity': .8, 'text-background-padding': 1 } },
      { selector: 'edge[label]', style: { label: 'data(label)' } },
      { selector: 'edge[kind="money"]', style: { 'target-arrow-shape': 'triangle' } },
      { selector: ':selected', style: { 'border-color': '#22d3ee', 'border-width': 4 } }] });
  cy.on('tap', 'node', e => { const id = e.target.id(); if (IX.acctById.has(id)) openAccount(id); else if (id.startsWith('M:')) openNumber(id.slice(2)); else if (id.startsWith('I:')) globalSearch(id.slice(2)); });
  $('#nPng', el).onclick = () => { const uri = cy.png({ full: true, scale: 2, bg: '#070d1a' }); fetch(uri).then(r => r.blob()).then(b => downloadBlob(b, `CFITS_${fileSafe(S.cur.meta.id)}_network.png`)); };
}
function layeredPositions(nodes, edges) {
  const pos = {}; const all = Array.from(nodes.values()); const PER = 16;
  const main = all.filter(n => !['mob'].includes(n.data.kind)); const cols = groupBy(main, n => n.data.layer);
  const keys = Array.from(cols.keys()).sort((a, b) => a - b); let x = 0;
  for (const k of keys) { const l = cols.get(k); const sub = Math.ceil(l.length / PER);
    for (let s = 0; s < sub; s++) { const part = l.slice(s * PER, (s + 1) * PER); part.forEach((n, i) => pos[n.data.id] = { x: x + s * 190, y: (i - (part.length - 1) / 2) * 95 }); }
    x += sub * 190 + 170; }
  // mobiles sit beside the account that owns them; free-floating ones in a last column
  const owner = new Map(); for (const e of edges) if (e.data.kind === 'owns' && !owner.has(e.data.target)) owner.set(e.data.target, e.data.source);
  const offs = new Map(); let fy = 0;
  for (const n of all.filter(n => n.data.kind === 'mob')) { const o = owner.get(n.data.id); if (o && pos[o]) { const k = (offs.get(o) || 0); offs.set(o, k + 1); pos[n.data.id] = { x: pos[o].x + 70, y: pos[o].y + 30 + k * 22 }; } else { pos[n.data.id] = { x: x, y: fy }; fy += 60; } }
  return pos;
}
