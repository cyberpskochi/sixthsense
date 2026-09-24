/* ------------------------------ NCRP GRAPH & ANALYSIS ------------------------------
   Builds the complaint money trail straight from the I4C / NCRP transaction report:
   victim → layer-1 accounts (disputed UTRs) → onward "Money Transfer to" accounts → …
   plus ATM / cheque / AEPS / POS cash-outs and put-on-hold amounts per account.       */
const NCRPF = { ack: '', maxL: 0, bank: '', min: 0, cash: 1 };
const ACT_NAME = { TRANSFER: 'Money transfer', ATM: 'ATM withdrawal', CHEQUE: 'Cheque withdrawal', AEPS: 'AEPS withdrawal', POS: 'POS / purchase', HOLD: 'Put on hold', CASH: 'Cash withdrawal', OTHER: 'Other' };
function ncrpModel(f = NCRPF) {
  const c = S.cur; let rows = c.work.ncrp.slice();
  if (f.ack) rows = rows.filter(r => r.ackNo === f.ack);
  const comp = c.accts.filter(a => a.layerNcrp === 0 || /complainant|victim/i.test(a.role || ''));
  const victimId = comp.length === 1 ? comp[0].acctNo : 'VICTIM';
  const N = new Map(), E = new Map(); const seenL1 = new Set(); let fraud = 0; const hasDisp = rows.some(r => r.disputed > 0);
  const node = (id, layer, o = {}) => {
    if (!id) return null; let n = N.get(id);
    if (!n) { const a = IX.acctByKey.get(acctKey(id)) || null; n = { id, layer, bank: '', ifsc: '', in: 0, out: 0, hold: 0, cash: 0, act: {}, rows: [], atms: [], acct: a || null }; N.set(id, n); }
    if (layer != null && (n.layer == null || layer < n.layer)) n.layer = layer;
    if (o.bank && !n.bank) n.bank = o.bank; if (o.ifsc && !n.ifsc) n.ifsc = o.ifsc; return n;
  };
  const edge = (s, t, amt, key, kind = 'money') => { if (!s || !t || s === t) return; const k = s + '>' + t; let e = E.get(k); if (!e) { e = { source: s, target: t, amount: 0, n: 0, keys: new Set(), kind }; E.set(k, e); } if (key && e.keys.has(key)) return; if (key) e.keys.add(key); e.amount += amt || 0; e.n++; };
  for (const r of rows) {
    const L = r.layer ?? 1; const amt = r.amount || r.disputed || 0;
    const n = node(r.acctNo, L, { bank: r.bank, ifsc: r.ifsc }); if (!n) continue;
    n.rows.push(r); if (r.action) n.act[r.action] = (n.act[r.action] || 0) + amt;
    n.hold += r.hold || (r.action === 'HOLD' ? amt : 0);
    if (L === 1 && (!hasDisp || r.disputed > 0 || r.fromAcct)) { const src = r.fromAcct || victimId; node(src, 0, {}); edge(src, r.acctNo, r.disputed || amt, 'V' + (r.utr || r.id)); const k = r.utr || r.id; if (!seenL1.has(k)) { seenL1.add(k); fraud += r.disputed || amt; } }
    else if (r.fromAcct) { node(r.fromAcct, L - 1, {}); edge(r.fromAcct, r.acctNo, amt, 'F' + (r.utr || r.id)); }
    if (r.toAcct) { node(r.toAcct, L + 1, { ifsc: r.toIfsc }); edge(r.acctNo, r.toAcct, amt, 'T' + (r.utr || '') + '|' + amt + '|' + r.toAcct); n.out += amt; }
    if (['ATM', 'CHEQUE', 'AEPS', 'POS', 'CASH'].includes(r.action)) { n.cash += amt; if (r.action === 'ATM') n.atms.push(r);
      if (f.cash) { const xid = 'X:' + r.action + ':' + (r.atmId || r.acctNo); const x = N.get(xid) || (N.set(xid, { id: xid, layer: L + 1, exit: r.action, label: r.action === 'ATM' ? 'ATM ' + (r.atmId || '') : ACT_NAME[r.action], place: r.atmPlace || r.merchant || '', in: 0, rows: [], act: {}, atms: [] }), N.get(xid)); x.rows.push(r); edge(r.acctNo, xid, amt, 'X' + r.id, 'cash'); } }
  }
  for (const e of E.values()) { const t = N.get(e.target); if (t) t.in += e.amount; }
  // enrich with bank / IFSC info and case accounts
  for (const n of N.values()) {
    if (n.exit) continue;
    const a = n.acct || IX.acctByKey.get(acctKey(n.id)); if (a) { n.acct = a; if (!n.ifsc) n.ifsc = a.ifsc; if (!n.bank) n.bank = a.bank; n.holder = a.holder; }
    const inf = n.ifsc ? GEO.info(n.ifsc) : null; n.info = inf; if (!n.bank && inf) n.bank = inf.bank;
    if (!n.bank && /^[A-Z]/.test(n.id) && /\d/.test(n.id) && !/^\d/.test(n.id)) n.bank = 'Wallet / PG';
  }
  if (N.has('VICTIM')) Object.assign(N.get('VICTIM'), { bank: 'Complainant', holder: 'Victim account(s)' });
  return { rows, N, E, fraud: round2(fraud), disputedN: seenL1.size, victimId, roots: Array.from(N.values()).filter(n => n.layer === 0).map(n => n.id) };
}
VIEWS.ncrp = async el => {
  if (!GEO.loaded) el.innerHTML = `<div class="empty" style="margin-top:60px"><div class="spin"></div>Loading bank & ATM reference data…</div>`;
  const c = S.cur; await GEO.ready();
  const acks = uniq(c.work.ncrp.map(r => r.ackNo).filter(Boolean));
  if (!c.work.ncrp.length) {
    el.innerHTML = pageHead('NCRP Graph', 'Money trail straight from the NCRP (I4C) transaction report — layers, onward transfers, ATM / cheque / AEPS cash-outs and put-on-hold amounts.') +
      `<div class="card">${emptyState('No NCRP report imported in this case yet.<br><span class="small dim">Download the transaction details Excel of the complaint from the NCRP / I4C portal and import it here. Several acknowledgement numbers can be imported into one case.</span>', `<button class="btn-p" id="nImp">⇪ Import NCRP report</button>`)}</div>`;
    $('#nImp', el).onclick = () => { IMP.kind = 'ncrp'; go('import'); }; return;
  }
  const m = ncrpModel(); const all = Array.from(m.N.values()); const accts = all.filter(n => !n.exit && n.id !== 'VICTIM');
  const actSum = k => round2(sum(m.rows.filter(r => r.action === k), r => r.amount || r.disputed));
  const holdTot = round2(sum(accts, n => n.hold)); const banks = uniq(accts.map(n => n.bank).filter(Boolean));
  const maxL = Math.max(0, ...accts.map(n => n.layer || 0)); const ifscs = uniq(accts.map(n => n.ifsc).filter(Boolean));
  const states = uniq(ifscs.map(i => (GEO.info(i) || {}).state).filter(Boolean));
  const K = (l, v, s, col) => kpi(l, v, s, col);
  el.innerHTML = pageHead('NCRP Graph', 'Complaint money trail from the NCRP report. Tree ↓ / Tree → / Network / Radial views, search, focus path and full-screen are in the graph toolbar.', `<button id="nImp">⇪ Import NCRP</button><button id="nXl">Export rows</button><button class="btn-p" id="nLet">✉ Letters for these banks</button>`) +
    `<div class="grid g6" style="margin-bottom:14px">
      ${K('Fraud amount', inrShort(m.fraud), `${nfmt(m.disputedN)} disputed transaction(s)`, 'rgba(255,77,94,.35)')}
      ${K('Amount on hold', inrShort(holdTot), m.fraud ? Math.round(holdTot / m.fraud * 100) + '% of fraud amount' : '', 'rgba(255,179,0,.35)')}
      ${K('Money transfers', nfmt(m.rows.filter(r => r.action === 'TRANSFER' || r.toAcct).length), inrShort(actSum('TRANSFER')) + ' moved onward', 'rgba(0,229,255,.3)')}
      ${K('Accounts / wallets', nfmt(accts.length), `${banks.length} banks · max layer ${maxL}`, 'rgba(179,136,255,.35)')}
      ${K('ATM withdrawals', inrShort(actSum('ATM')), nfmt(m.rows.filter(r => r.action === 'ATM').length) + ' withdrawals', 'rgba(255,110,64,.35)')}
      ${K('Cheque / AEPS / POS', inrShort(actSum('CHEQUE') + actSum('AEPS') + actSum('POS')), `Cheque ${inrShort(actSum('CHEQUE'))} · AEPS ${inrShort(actSum('AEPS'))} · POS ${inrShort(actSum('POS'))}`, 'rgba(0,255,157,.3)')}
    </div>
    <div class="card" style="margin-bottom:14px"><div class="row" style="align-items:flex-end;flex-wrap:wrap">
      <label class="f">Complaint (Ack. No.)<select id="fAck"><option value="">All complaints (${acks.length || 1})</option>${acks.map(a => `<option ${NCRPF.ack === a ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select></label>
      <label class="f">Show layers up to<select id="fL"><option value="0">All layers</option>${Array.from({ length: maxL }, (_, i) => `<option value="${i + 1}" ${NCRPF.maxL === i + 1 ? 'selected' : ''}>Layer ${i + 1}</option>`).join('')}</select></label>
      <label class="f">Bank<select id="fB"><option value="">All banks</option>${banks.sort().map(b => `<option ${NCRPF.bank === b ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select></label>
      <label class="f">Min. amount (₹)<input id="fMin" type="number" min="0" value="${NCRPF.min || ''}" style="width:130px" placeholder="0"></label>
      <span class="chip ${NCRPF.cash ? 'on' : ''}" id="fCash" style="cursor:pointer">ATM / cash-outs</span>
      <span class="small dim">States: ${esc(states.join(', ') || '— (run IFSC lookup in IFSC & ATM)')}</span>
    </div></div>
    <div id="nGraph" style="margin-bottom:14px"></div>
    <div class="grid g2" style="margin-bottom:14px"><div class="card"><h3>Layer summary</h3><div id="nLay"></div></div><div class="card"><h3>Bank summary</h3><div id="nBank"></div></div></div>
    <div class="card"><div class="row sb"><h3 style="margin:0">NCRP transaction rows</h3><input id="nQ" placeholder="Filter rows…" style="width:240px"></div><div id="nRows" style="margin-top:10px"></div></div>`;
  $('#nImp', el).onclick = () => { IMP.kind = 'ncrp'; go('import'); };
  $('#fAck', el).onchange = e => { NCRPF.ack = e.target.value; go('ncrp'); };
  $('#fL', el).onchange = e => { NCRPF.maxL = +e.target.value; go('ncrp'); };
  $('#fB', el).onchange = e => { NCRPF.bank = e.target.value; go('ncrp'); };
  $('#fMin', el).onchange = e => { NCRPF.min = +e.target.value || 0; go('ncrp'); };
  $('#fCash', el).onclick = () => { NCRPF.cash = NCRPF.cash ? 0 : 1; go('ncrp'); };
  $('#nLet', el).onclick = () => { LET.src = 'ncrp'; LET.bank = NCRPF.bank || ''; go('letters'); };
  // graph
  const lc = l => l === 0 ? '#00ff9d' : l === 1 ? '#ffb300' : l === 2 ? '#00e5ff' : l === 3 ? '#b388ff' : '#2f9bff';
  let show = all.filter(n => !NCRPF.maxL || (n.layer ?? 0) <= NCRPF.maxL);
  if (NCRPF.bank) { const keep = new Set(); const byT = groupBy(Array.from(m.E.values()), e => e.target), byS = groupBy(Array.from(m.E.values()), e => e.source);
    const up = id => { if (keep.has('u' + id)) return; keep.add('u' + id); keep.add(id); (byT.get(id) || []).forEach(e => up(e.source)); };
    const down = id => { if (keep.has('d' + id)) return; keep.add('d' + id); keep.add(id); (byS.get(id) || []).forEach(e => { const t = m.N.get(e.target); if (t && t.exit) keep.add(t.id); }); };
    all.filter(n => n.bank === NCRPF.bank).forEach(n => { up(n.id); down(n.id); }); show = show.filter(n => keep.has(n.id)); }
  const nodes = show.map(n => n.exit ? { id: n.id, label: n.label, sub: [n.place, inrShort(n.in)].filter(Boolean).join(' | '), badge: '₹', color: '#ff6e40', layer: n.layer, size: 18, shape: 'round-rectangle', tip: `<b>${esc(n.label)}</b><br>${esc(n.place || '')}<br>${inr(n.in)} · ${n.rows.length} txn` } :
    { id: n.id, label: n.id === 'VICTIM' ? 'Victim account(s)' : n.id, sub: [n.bank || 'N/A', n.ifsc || 'N/A', n.hold ? 'Hold ' + inrShort(n.hold) : (n.info && n.info.state) || 'N/A'].join(' | '), badge: n.layer === 0 ? 'V-AC' : String(n.layer ?? '?'), layer: n.layer, color: n.hold > 0 ? '#00ff9d' : lc(n.layer), size: 22 + Math.min(24, Math.sqrt((n.in || 0) / 2500)), search: [n.holder, n.bank, n.ifsc].join(' '),
      tip: `<b>${esc(n.id)}</b>${n.holder ? '<br>' + esc(n.holder) : ''}<br>${esc(n.bank || '')} ${esc(n.ifsc || '')}${n.info && n.info.branch ? '<br>' + esc(n.info.branch + ', ' + (n.info.district || '') + ', ' + (n.info.state || '')) : ''}<br>Layer ${n.layer ?? '?'} · in ${inr(n.in)}${n.hold ? '<br><b>On hold ' + inr(n.hold) + '</b>' : ''}` });
  const edges = Array.from(m.E.values()).filter(e => e.amount >= (NCRPF.min || 0)).map(e => ({ source: e.source, target: e.target, label: nfmt(Math.round(e.amount)), w: 1.2 + Math.min(6, Math.log10(e.amount + 1) - 2.5), color: e.kind === 'cash' ? '#ff6e40' : '#00e5ff', dash: e.kind === 'cash' ? 1 : undefined }));
  GraphKit.mount($('#nGraph', el), { key: 'ncrp', file: 'ncrp_graph', defaultLayout: 'tree', nodes, edges, roots: m.roots,
    stats: [{ label: 'Fraud amount', value: inrShort(m.fraud), cls: 'adm' }, { label: 'Hold', value: inrShort(holdTot) }],
    legend: '<span><i style="background:#00ff9d"></i>Victim / amount on hold</span><span><i style="background:#ffb300"></i>Layer 1</span><span><i style="background:#00e5ff"></i>Layer 2</span><span><i style="background:#b388ff"></i>Layer 3</span><span><i style="background:#2f9bff"></i>Layer 4+</span><span><i style="background:#ff6e40"></i>ATM / cash-out</span>',
    onTap: id => ncrpNodeModal(m, id) });
  // tables
  const byL = groupBy(accts, n => n.layer ?? '?');
  $('#nLay', el).innerHTML = simpleTable([{ label: 'Layer', k: 'l' }, { label: 'Accounts', k: 'n', num: 1 }, { label: 'Received', html: r => inr(r.in), num: 1 }, { label: 'On hold', html: r => inr(r.hold), num: 1 }, { label: 'Cash-out', html: r => inr(r.cash), num: 1 }],
    Array.from(byL.entries()).sort((a, b) => a[0] - b[0]).map(([l, ns]) => ({ l: 'Layer ' + l, n: ns.length, in: sum(ns, x => x.in), hold: sum(ns, x => x.hold), cash: sum(ns, x => x.cash) })), { maxH: 300 });
  const byB = Array.from(groupBy(accts, n => n.bank || 'Unknown').entries()).map(([b, ns]) => ({ b, n: ns.length, in: sum(ns, x => x.in), hold: sum(ns, x => x.hold) })).sort((a, b) => b.in - a.in);
  $('#nBank', el).innerHTML = simpleTable([{ label: 'Bank / wallet', k: 'b' }, { label: 'Accounts', k: 'n', num: 1 }, { label: 'Received', html: r => inr(r.in), num: 1 }, { label: 'On hold', html: r => inr(r.hold), num: 1 }, { label: '', html: r => `<button class="btn-sm" data-lb="${esc(r.b)}">✉ Letter</button>` }], byB, { maxH: 300 });
  $$('[data-lb]', el).forEach(b => b.onclick = () => { LET.src = 'ncrp'; LET.bank = b.dataset.lb; go('letters'); });
  const cols = [{ label: 'Ack No.', k: 'ackNo' }, { label: 'Layer', k: 'layer' }, { label: 'Account / wallet', k: 'acctNo' }, { label: 'Bank', k: 'bank' }, { label: 'UTR', k: 'utr' }, { label: 'Date', get: r => r.ts ? fmtDT(r.ts, r.hasTime) : '' }, { label: 'Amount', html: r => inr(r.amount || r.disputed), num: 1, x: r => r.amount || r.disputed }, { label: 'Action', get: r => r.status || ACT_NAME[r.action] || '' }, { label: 'To account', k: 'toAcct' }, { label: 'To IFSC', k: 'toIfsc' }, { label: 'ATM ID', k: 'atmId' }, { label: 'ATM place', k: 'atmPlace' }, { label: 'Hold', html: r => r.hold ? inr(r.hold) : '', num: 1, x: r => r.hold }];
  const draw = () => { const q = ($('#nQ', el).value || '').toLowerCase(); const rs = m.rows.filter(r => !q || JSON.stringify(r).toLowerCase().includes(q)); $('#nRows', el).innerHTML = simpleTable(cols, rs.slice(0, 2000), { maxH: 460 }); };
  $('#nQ', el).oninput = draw; draw();
  $('#nXl', el).onclick = () => exportTable('NCRP rows', cols, m.rows);
};
function ncrpNodeModal(m, id) {
  const n = m.N.get(id); if (!n) return;
  if (n.id === 'VICTIM') return toast('Complainant account(s): set a case account’s role to Complainant to show it here.', 'ok', 5000);
  const inf = n.info || {}; const ins = Array.from(m.E.values()).filter(e => e.target === id), outs = Array.from(m.E.values()).filter(e => e.source === id);
  const body = `<div class="grid g2" style="gap:10px">
    <div class="card"><h3>${n.exit ? esc(n.label) : 'Account / wallet'}</h3><div class="mono" style="font-size:16px">${esc(n.exit ? (n.rows[0] || {}).acctNo || '' : n.id)}</div>
      ${n.holder ? `<div>${esc(n.holder)}</div>` : ''}<div class="muted">${esc(n.bank || '')} ${n.ifsc ? '· ' + esc(n.ifsc) : ''}</div>
      ${inf.branch ? `<div class="small">${esc(inf.branch)}, ${esc(inf.address || '')}<br>${esc(inf.district || '')}, ${esc(inf.state || '')}</div>` : n.ifsc ? `<div class="small dim">Branch not looked up yet (IFSC & ATM → Look up IFSC online)</div>` : ''}
      <div class="row" style="margin-top:8px;flex-wrap:wrap">${badge('Layer ' + (n.layer ?? '?'), 'cyan')} ${n.hold ? badge('On hold ' + inr(n.hold), 'green') : ''} ${Object.entries(n.act || {}).map(([k, v]) => badge(ACT_NAME[k] + ' ' + inrShort(v), k === 'HOLD' ? 'green' : k === 'TRANSFER' ? 'blue' : 'amber')).join(' ')}</div>
      <div class="row" style="margin-top:10px;flex-wrap:wrap">${n.ifsc ? `<a class="btn-sm" href="${gmapsUrl((inf.bank || n.bank || '') + ' ' + (inf.branch || n.ifsc) + ' ' + (inf.city || ''))}" target="_blank" rel="noopener noreferrer">⌖ Branch on Google Maps</a>` : ''}${n.acct ? `<button class="btn-sm" id="mAcc">Open account</button>` : ''}${!n.exit ? `<button class="btn-sm btn-p" id="mLet">✉ Letter to ${esc((n.bank || 'bank').slice(0, 22))}</button>` : ''}</div></div>
    <div class="card"><h3>Money in / out</h3>${simpleTable([{ label: 'From', k: 'source' }, { label: 'Amount', html: e => inr(e.amount), num: 1 }, { label: 'Txns', k: 'n', num: 1 }], ins, { maxH: 160, empty: 'No incoming rows' })}
      <div style="height:8px"></div>${simpleTable([{ label: 'To', get: e => e.target.startsWith('X:') ? (m.N.get(e.target) || {}).label : e.target }, { label: 'Amount', html: e => inr(e.amount), num: 1 }, { label: 'Txns', k: 'n', num: 1 }], outs, { maxH: 160, empty: 'No onward rows' })}</div></div>
    ${n.atms && n.atms.length ? `<div class="card" style="margin-top:10px"><h3>ATM withdrawals</h3>${simpleTable([{ label: 'ATM ID', k: 'atmId' }, { label: 'Place', k: 'atmPlace' }, { label: 'Date', get: r => r.ts ? fmtDT(r.ts, r.hasTime) : '' }, { label: 'Amount', html: r => inr(r.amount), num: 1 }, { label: '', html: r => { const a = GEO.atmInfo(r.atmId); return `<a class="btn-sm" target="_blank" rel="noopener noreferrer" href="${gmapsUrl(a ? [a.bank, a.address, a.city, a.state].join(' ') : (r.atmPlace || 'ATM ' + r.atmId), a && a.lat, a && a.lon)}">⌖ Map</a>`; } }], n.atms, { maxH: 200 })}</div>` : ''}
    <div class="card" style="margin-top:10px"><h3>NCRP rows (${n.rows.length})</h3>${simpleTable([{ label: 'Layer', k: 'layer' }, { label: 'UTR', k: 'utr' }, { label: 'Date', get: r => r.ts ? fmtDT(r.ts, r.hasTime) : '' }, { label: 'Amount', html: r => inr(r.amount || r.disputed), num: 1 }, { label: 'Action', get: r => r.status || ACT_NAME[r.action] || '' }, { label: 'To', k: 'toAcct' }, { label: 'Hold', html: r => r.hold ? inr(r.hold) : '', num: 1 }], n.rows, { maxH: 260 })}</div>`;
  const md = modal({ title: 'NCRP · ' + esc(n.exit ? n.label : n.id), body, foot: false });
  if ($('#mAcc', md.el)) $('#mAcc', md.el).onclick = () => { md.close(); openAccount(n.acct.id); };
  if ($('#mLet', md.el)) $('#mLet', md.el).onclick = () => { md.close(); LET.src = 'ncrp'; LET.bank = n.bank || ''; LET.acct = n.id; go('letters'); };
}
