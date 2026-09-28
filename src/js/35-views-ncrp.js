/* ------------------------------ NCRP GRAPH & ANALYSIS ------------------------------
   Builds the complaint money trail straight from the I4C / NCRP transaction report.
   How an I4C row is read:
     · "Account No./(Wallet/PG/PA) Id" + "Layer"  = the account at that layer
     · first "Transaction Id / UTR", "Transaction Amount", "Transaction Date" = the credit that brought money INTO it
     · "Action Taken by bank" + "Account No" + "Ifsc Code" (+ repeated UTR / amount columns) = what the bank reported
       happened next (Money Transfer to …, ATM, cheque, AEPS, POS, put on hold)
   Each Layer-N row is linked to the Layer-(N-1) row whose "Money Transfer to" account is this account: exact UTR first,
   then equal amount, then nearest time. Anything that cannot be linked is shown in "Report check", never hidden.  */
const NCRPF = { ack: '', maxL: 0, bank: '', min: 0, cash: 1, tab: 'trail', tl: 0 };
const ACT_NAME = { TRANSFER: 'Money transfer', ATM: 'ATM withdrawal', CHEQUE: 'Cheque withdrawal', AEPS: 'AEPS withdrawal', POS: 'POS / purchase', UPI: 'UPI / wallet / merchant payment', DEBIT: 'Debit (beneficiary not reported)', HOLD: 'Put on hold', CASH: 'Cash withdrawal', OTHER: 'Other' };
const CASH_ACTS = ['ATM', 'CHEQUE', 'AEPS', 'POS', 'CASH', 'UPI', 'DEBIT'];
const EXIT_BADGE = { ATM: 'ATM', CHEQUE: 'CHQ', AEPS: 'AEPS', POS: 'POS', CASH: 'CASH', UPI: 'UPI', DEBIT: 'DR' };
/* Transfer mode from the UTR / remarks (indicative): RTGS / NEFT UTRs carry R / N as the 5th character; 12-digit RRNs are IMPS or UPI. */
function txnMode(utr, remarks, bank) { const u = String(utr || '').toUpperCase(), t = (remarks || '') + ' ' + (bank || '');
  if (/\bUPI\b|phonepe|paytm|google\s*pay|gpay|bhim|amazon\s*pay|mobikwik|freecharge|cred\b|razorpay|cashfree|payu/i.test(t)) return 'UPI / wallet';
  if (/RTGS/i.test(t) || /^[A-Z]{4}R\d/.test(u)) return 'RTGS'; if (/NEFT/i.test(t) || /^[A-Z]{4}N\d/.test(u)) return 'NEFT'; if (/IMPS/i.test(t)) return 'IMPS'; if (/^\d{12}$/.test(u)) return 'IMPS / UPI'; if (/^[A-Z]{4}H\d/.test(u)) return 'NEFT'; return ''; }
const ncrpBranch = ifsc => { const i = ifsc ? GEO.info(ifsc) : null; return i ? [i.branch, i.city || i.district, i.state].filter(Boolean).filter((v, k, a) => a.indexOf(v) === k).join(', ') : ''; };
const ncrpDT = (ts, hasTime) => ts ? fmtDT(ts, hasTime) : '';

function ncrpModel(f = NCRPF) {
  const c = S.cur; let rows = c.work.ncrp.slice();
  if (f.ack) rows = rows.filter(r => r.ackNo === f.ack);
  rows.sort((a, b) => (!!a.actOnly - !!b.actOnly) || (a.layer ?? 99) - (b.layer ?? 99) || (a.ts || 0) - (b.ts || 0));
  const disp = new Map(); const K = id => { if (!id) return ''; const k = acctKey(id); if (!disp.has(k)) disp.set(k, id); return disp.get(k); };
  const comp = c.accts.filter(a => a.layerNcrp === 0 || /complainant|victim/i.test(a.role || ''));
  const victimId = comp.length === 1 ? K(comp[0].acctNo) : 'VICTIM';
  const N = new Map(), H = []; const hopByKey = new Map(); const issues = { orphan: [], assumed: [], noDetail: [], unlinked: [] };
  const hasDisp = rows.some(r => r.disputed > 0);
  const node = (id, layer, o = {}, own = false) => {
    if (!id) return null; let n = N.get(id);
    if (!n) { const a = IX.acctByKey.get(acctKey(id)) || null; n = { id, layer: null, rl: null, dl: null, bank: '', ifsc: '', in: 0, out: 0, hold: 0, cash: 0, act: {}, rows: [], atms: [], hin: [], hout: [], acct: a }; N.set(id, n); }
    if (layer != null) { if (own) { if (n.rl == null || layer < n.rl) n.rl = layer; } else if (n.dl == null || layer < n.dl) n.dl = layer; n.layer = n.rl ?? n.dl; }
    if (o.bank && !n.bank) n.bank = o.bank; if (o.ifsc && !n.ifsc) n.ifsc = o.ifsc; return n;
  };
  const addHop = (from, to, o) => {
    const k = o.utr ? from + '>' + to + '>' + o.utr : null; let h = k ? hopByKey.get(k) : null;
    if (h) { for (const r of o.rows || []) if (!h.rows.includes(r)) h.rows.push(r); if (!h.ts && o.ts) { h.ts = o.ts; h.hasTime = !!o.hasTime; } if (!h.amount && o.amount) h.amount = o.amount; return h; }
    h = { id: 'H' + H.length, from, to, utr: o.utr || '', amount: round2(o.amount || 0), disputed: o.disputed || 0, ts: o.ts || null, hasTime: !!o.hasTime, layer: o.layer, kind: o.kind || 'money', action: o.action || '', basis: o.basis || '', rows: (o.rows || []).slice(), ifsc: o.ifsc || '' }; h.mode = txnMode(h.utr, (h.rows[0] || {}).remarks, (h.rows[0] || {}).merchant || (h.rows[0] || {}).toBank);
    H.push(h); if (k) hopByKey.set(k, h); return h;
  };
  const amtOf = r => r.amount || r.disputed || 0;
  const pending = []; // "Money Transfer to" rows waiting for their layer N+1 credit
  // pass 1 — accounts, actions, cash-outs, holds
  for (const r of rows) {
    const L = r.layer ?? (r.actOnly ? null : 1); const n = node(K(r.acctNo), L, { bank: r.bank, ifsc: r.ifsc }, true); if (!n) continue;
    if (L == null) issues.unlinked.push(r);
    n.rows.push(r); const actAmt = r.toAmount || amtOf(r);
    if (r.action) n.act[r.action] = round2((n.act[r.action] || 0) + (r.action === 'HOLD' ? (r.hold || actAmt) : actAmt));
    n.hold += r.hold || (r.action === 'HOLD' ? actAmt : 0);
    if (K(r.toAcct)) { node(K(r.toAcct), L + 1, { ifsc: r.toIfsc, bank: r.toBank }); pending.push({ r, from: K(r.acctNo), to: K(r.toAcct), L, hop: null }); }
    if (CASH_ACTS.includes(r.action)) {
      n.cash += actAmt; if (r.action === 'ATM') n.atms.push(r);
      if (f.cash) { const xid = 'X:' + r.action + ':' + (r.atmId || K(r.acctNo) + (r.merchant ? ':' + r.merchant : '')) + ':L' + L; let x = N.get(xid);
        if (!x) { x = { id: xid, layer: L, exit: r.action, label: r.action === 'ATM' ? 'ATM ' + (r.atmId || '') : ['UPI', 'POS', 'DEBIT'].includes(r.action) && r.merchant ? r.merchant : ACT_NAME[r.action], place: r.atmPlace || (r.merchant && !['UPI', 'DEBIT'].includes(r.action) ? r.merchant : '') || (r.action === 'UPI' ? 'UPI / wallet payment' : r.action === 'DEBIT' ? 'Beneficiary not reported by bank' : ''), in: 0, rows: [], act: {}, atms: [], hin: [], hout: [] }; N.set(xid, x); }
        x.rows.push(r); addHop(K(r.acctNo), xid, { utr: r.toUtr || '', amount: actAmt, ts: r.toTs || r.ts, hasTime: r.toTs ? true : r.hasTime, layer: L, kind: 'cash', action: r.action, rows: [r], basis: r.toTs || r.toAmount ? 'Action columns of the NCRP row' : 'Layer ' + L + ' row' }); }
    }
  }
  // pass 2 — the credit INTO each account (victim → Layer 1, Layer N-1 → Layer N)
  const pendTo = groupBy(pending, p => p.to);
  let fraud = 0; const seenL1 = new Set();
  for (const r of rows) {
    if (r.actOnly) { const ex = H.find(h => h.to === K(r.acctNo) && h.kind === 'money' && (!r.utr || normUtr(h.utr) === normUtr(r.utr))) || H.find(h => h.to === K(r.acctNo) && h.kind === 'money'); if (ex && !ex.rows.includes(r)) ex.rows.push(r); continue; }
    const L = r.layer ?? 1; if (!K(r.acctNo)) continue;
    const inHop = { utr: r.utr, amount: L === 1 ? (r.disputed || amtOf(r)) : amtOf(r), ts: r.ts, hasTime: r.hasTime, layer: L, action: 'CREDIT', rows: [r] };
    if (L <= 1 || (K(r.fromAcct) && !pendTo.get(K(r.acctNo)))) {
      if (L <= 1 && hasDisp && !(r.disputed > 0) && !K(r.fromAcct)) { // an action-only Layer-1 row: attach to the existing credit
        const ex = H.find(h => h.to === K(r.acctNo) && h.action === 'CREDIT' && (!r.utr || h.utr === r.utr)); if (ex) { ex.rows.push(r); continue; } }
      const src = K(r.fromAcct) || (L <= 1 ? victimId : null);
      if (src) { node(src, Math.max(0, L - 1), { bank: r.fmt === 'trail' ? r.actBank : '' }); const h = addHop(src, K(r.acctNo), Object.assign(inHop, { basis: L <= 1 ? 'Disputed transaction (complainant → Layer 1)' : r.fmt === 'trail' ? 'Money Transfer to — as reported' : 'From-account column of the report', disputed: r.disputed }));
        if (L <= 1) { const k = r.utr || h.id; if (!seenL1.has(k)) { seenL1.add(k); fraud += h.amount || 0; } } continue; }
    }
    // a row without its own UTR repeats an account already credited → attach to that credit
    if (!r.utr) { const ex = H.find(h => h.to === K(r.acctNo) && h.kind === 'money'); if (ex) { if (!ex.rows.includes(r)) ex.rows.push(r); continue; } }
    // already linked with the same UTR (several action rows repeat the same credit)
    const same = r.utr && H.find(h => h.to === K(r.acctNo) && h.utr === r.utr && h.action === 'CREDIT'); if (same) { if (!same.rows.includes(r)) same.rows.push(r); continue; }
    const cand = pendTo.get(K(r.acctNo)) || [];
    let p = cand.find(q => q.r.toUtr && r.utr && normUtr(q.r.toUtr) === normUtr(r.utr)), basis = 'Exact UTR match';
    if (!p) { const open = cand.filter(q => !q.hop);
      p = amtOf(r) ? open.find(q => q.r.toAmount && Math.abs(q.r.toAmount - amtOf(r)) < 1) : null; basis = 'Same amount';
      if (!p && open.length) { open.sort((a, b) => Math.abs((a.r.toTs || a.r.ts || 0) - (r.ts || 0)) - Math.abs((b.r.toTs || b.r.ts || 0) - (r.ts || 0))); p = open[0]; basis = open.length === 1 && uniq(cand.map(q => q.from)).length === 1 ? 'Only transfer to this account' : 'Nearest time (please verify)'; }
    }
    if (p) {
      const h = addHop(p.from, K(r.acctNo), Object.assign(inHop, { utr: r.utr || p.r.toUtr, amount: p.r.toAmount && basis === 'Exact UTR match' ? p.r.toAmount : (amtOf(r) || p.r.toAmount), ts: r.ts || p.r.toTs, hasTime: r.ts ? r.hasTime : !!p.r.toTs, basis, rows: [p.r, r] }));
      h.action = 'TRANSFER'; p.hop = h; if (/verify/.test(basis)) issues.assumed.push(h); continue;
    }
    if (cand.length) { // every onward transfer to this account is already linked — same sender, another credit
      const h = addHop(cand[0].from, K(r.acctNo), Object.assign(inHop, { basis: 'Additional credit from the same sender (please verify)', rows: [r] })); h.action = 'TRANSFER'; issues.assumed.push(h); continue; }
    // no Layer N-1 row sends money here → keep it visible with an explicit "sender not in report" box
    const uid = 'U:' + (L - 1); if (!N.has(uid)) N.set(uid, { id: uid, layer: L - 1, rl: L - 1, unknown: true, bank: 'Not in report', ifsc: '', in: 0, out: 0, hold: 0, cash: 0, act: {}, rows: [], atms: [], hin: [], hout: [] });
    const h = addHop(uid, K(r.acctNo), Object.assign(inHop, { basis: 'Sender not found in the report' })); h.action = 'TRANSFER'; issues.orphan.push(h);
  }
  // pass 3 — onward transfers whose Layer N+1 row is not in the report
  for (const p of pending) {
    if (p.hop) continue;
    const r = p.r; const h = addHop(p.from, p.to, { utr: r.toUtr, amount: r.toAmount || amtOf(r), ts: r.toTs || null, hasTime: !!r.toTs, layer: p.L + 1, action: 'TRANSFER', rows: [r], ifsc: r.toIfsc,
      basis: r.toUtr || r.toAmount ? 'Action columns of the Layer ' + p.L + ' row' : 'Amount of the Layer ' + p.L + ' row (no onward UTR in report)' });
    p.hop = h; if (!r.toUtr && !r.toAmount) issues.noDetail.push(h);
  }
  // aggregate hops into graph edges
  const E = new Map();
  for (const h of H) {
    const k = h.from + '>' + h.to; let e = E.get(k);
    if (!e) { e = { source: h.from, target: h.to, amount: 0, n: 0, kind: h.kind, rows: [], hops: [] }; E.set(k, e); }
    e.hops.push(h); e.amount = round2(e.amount + (h.amount || 0)); e.n++; for (const r of h.rows) if (!e.rows.includes(r)) e.rows.push(r);
    const s = N.get(h.from), t = N.get(h.to); if (s) { s.hout.push(h); if (h.kind === 'money') s.out += h.amount || 0; } if (t) { t.hin.push(h); t.in += h.amount || 0; }
  }
  for (const e of E.values()) e.hops.sort((a, b) => (a.ts || 0) - (b.ts || 0));
  for (const n of N.values()) {
    n.in = round2(n.in || 0); n.out = round2(n.out || 0); n.hold = round2(n.hold || 0);
    if (n.exit || n.unknown) continue;
    if (n.layer == null) n.layer = n.id === victimId || n.id === 'VICTIM' ? 0 : null;
    const a = n.acct || IX.acctByKey.get(acctKey(n.id)); if (a) { n.acct = a; if (!n.ifsc) n.ifsc = a.ifsc; if (!n.bank) n.bank = a.bank; n.holder = a.holder; }
    const inf = n.ifsc ? GEO.info(n.ifsc) : null; n.info = inf; if (!n.bank && inf) n.bank = inf.bank;
    if (!n.bank && /^[A-Z]/.test(n.id) && /\d/.test(n.id) && !/^\d/.test(n.id)) n.bank = 'Wallet / PG';
    n.hin.sort((a, b) => (a.ts || 0) - (b.ts || 0)); n.hout.sort((a, b) => (a.ts || 0) - (b.ts || 0));
  }
  const V = N.get(victimId); if (V) { V.layer = 0; if (victimId === 'VICTIM') Object.assign(V, { bank: 'Complainant', holder: 'Victim account(s)' }); }
  return { rows, N, E, H, fraud: round2(fraud), disputedN: seenL1.size, victimId, issues, roots: Array.from(N.values()).filter(n => n.layer === 0).map(n => n.id) };
}

const NLAYER_COL = ['#00e676', '#ffb300', '#00e5ff', '#b388ff', '#4d7cff', '#ff4fa3', '#c6ff00', '#ffffff', '#26c6da', '#ff8a65'];
const nlc = l => NLAYER_COL[Math.max(0, l ?? 9) % NLAYER_COL.length];
const NEXIT_COL = { ATM: '#ff3b30', CHEQUE: '#e040fb', AEPS: '#ff9100', POS: '#ffd180', CASH: '#ff3b30', UPI: '#18ffff', DEBIT: '#b0bec5' };
function ncrpLayers(m) { const by = new Map(); for (const n of m.N.values()) { if (n.exit || n.unknown || n.layer === 0 || n.layer == null) continue; if (!by.has(n.layer)) by.set(n.layer, []); by.get(n.layer).push(n); } return by; }
function ncrpFlowStrip(m) {
  const by = ncrpLayers(m); const ls = Array.from(by.keys()).sort((a, b) => a - b); const iss = m.issues.orphan.length + m.issues.assumed.length;
  return `<div class="nc-flow card" style="margin-bottom:14px">
      <div class="nc-step" style="--lc:${nlc(0)}"><div class="nc-l">Complainant</div><div class="nc-v">${inrShort(m.fraud)}</div><div class="nc-s">${nfmt(m.disputedN)} disputed txn</div></div>
      ${ls.map(l => { const ns = by.get(l); const bk = uniq(ns.map(n => n.bank).filter(Boolean)); const inAmt = sum(ns, n => n.in), hold = sum(ns, n => n.hold), cash = sum(ns, n => n.cash);
        return `<div class="nc-arrow">→</div><div class="nc-step" style="--lc:${nlc(l)}"><div class="nc-l">Layer ${l}</div><div class="nc-v">${nfmt(ns.length)} <small>account${ns.length > 1 ? 's' : ''}</small></div><div class="nc-s">in ${inrShort(inAmt)}${hold ? ' · hold ' + inrShort(hold) : ''}${cash ? ' · cash-out ' + inrShort(cash) : ''}</div><div class="nc-b">${esc(bk.slice(0, 3).join(', '))}${bk.length > 3 ? '…' : ''}</div></div>`; }).join('')}
      ${iss ? `<div class="nc-warn" title="Open Report check on the NCRP Graph page">⚠ ${iss} link(s) need checking</div>` : `<div class="nc-ok">✓ every row linked</div>`}
    </div>`;
}

VIEWS.ncrp = async el => {
  if (!GEO.loaded) el.innerHTML = `<div class="empty" style="margin-top:60px"><div class="spin"></div>Loading bank & ATM reference data…</div>`;
  const c = S.cur; await GEO.ready();
  const acks = uniq(c.work.ncrp.map(r => r.ackNo).filter(Boolean));
  if (!c.work.ncrp.length) {
    el.innerHTML = pageHead('NCRP Graph', 'Money trail straight from the NCRP (I4C) transaction report — layers, onward transfers, ATM / cheque / AEPS cash-outs and put-on-hold amounts.') +
      `<div class="card">${emptyState('No NCRP report imported in this case yet.<br><span class="small dim">Download the transaction details Excel of the complaint from the NCRP / I4C portal and import it here. Several acknowledgement numbers can be imported into one case.</span>', `<button class="btn-p" id="nImp">⇪ Import NCRP report</button>`)}</div>`;
    $('#nImp', el).onclick = () => go('up_ncrp'); return;
  }
  const m = ncrpModel(); const all = Array.from(m.N.values()); const accts = all.filter(n => !n.exit && !n.unknown && n.layer !== 0);
  const actSum = k => round2(sum(m.H.filter(h => h.kind === 'cash' && h.action === k), h => h.amount));
  const holdTot = round2(sum(accts, n => n.hold)); const banks = uniq(accts.map(n => n.bank).filter(Boolean));
  const maxL = Math.max(0, ...accts.map(n => n.layer || 0)); const ifscs = uniq(accts.map(n => n.ifsc).filter(Boolean));
  const states = uniq(ifscs.map(i => (GEO.info(i) || {}).state).filter(Boolean));
  const transfers = m.H.filter(h => h.kind === 'money' && h.action === 'TRANSFER');
  const byLayer = ncrpLayers(m);
  const layersSorted = Array.from(byLayer.keys()).sort((a, b) => a - b);
  const issuesN = m.issues.orphan.length + m.issues.assumed.length;
  el.innerHTML = pageHead('NCRP Graph', 'Layer-wise money trail from the NCRP / I4C report. Click any account box or amount on an arrow for date, time, UTR and branch details.', `<button id="nImp">⇪ Import NCRP</button><button id="nXl">⇩ Export trail</button><button class="btn-p" id="nLet">✉ Letters for these banks</button>`) +
    `<div class="grid g6" style="margin-bottom:14px">
      ${kpi('Fraud amount', inrShort(m.fraud), `${nfmt(m.disputedN)} disputed transaction(s)`, 'rgba(255,77,94,.35)')}
      ${kpi('Amount on hold', inrShort(holdTot), m.fraud ? Math.round(holdTot / m.fraud * 100) + '% of fraud amount' : '', 'rgba(255,179,0,.35)')}
      ${kpi('Onward transfers', nfmt(transfers.length), inrShort(sum(transfers, h => h.amount)) + ' moved to next layers', 'rgba(0,229,255,.3)')}
      ${kpi('Accounts / wallets', nfmt(accts.length), `${banks.length} banks · ${maxL} layer(s)`, 'rgba(179,136,255,.35)')}
      ${kpi('ATM withdrawals', inrShort(actSum('ATM')), nfmt(m.H.filter(h => h.action === 'ATM').length) + ' withdrawals', 'rgba(255,110,64,.35)')}
      ${kpi('Cheque / POS / UPI', inrShort(actSum('CHEQUE') + actSum('AEPS') + actSum('POS') + actSum('UPI') + actSum('DEBIT')), `Cheque ${inrShort(actSum('CHEQUE'))} · POS ${inrShort(actSum('POS'))} · UPI/wallet ${inrShort(actSum('UPI'))}${actSum('AEPS') ? ' · AEPS ' + inrShort(actSum('AEPS')) : ''}${actSum('DEBIT') ? ' · other debits ' + inrShort(actSum('DEBIT')) : ''}`, 'rgba(0,255,157,.3)')}
    </div>
    ${ncrpFlowStrip(m)}
    <div class="card" style="margin-bottom:14px"><div class="row" style="align-items:flex-end;flex-wrap:wrap">
      <label class="f">Complaint (Ack. No.)<select id="fAck"><option value="">All complaints (${acks.length || 1})</option>${acks.map(a => `<option ${NCRPF.ack === a ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select></label>
      <label class="f">Show layers up to<select id="fL"><option value="0">All layers</option>${Array.from({ length: maxL }, (_, i) => `<option value="${i + 1}" ${NCRPF.maxL === i + 1 ? 'selected' : ''}>Layer ${i + 1}</option>`).join('')}</select></label>
      <label class="f">Bank<select id="fB"><option value="">All banks</option>${banks.sort().map(b => `<option ${NCRPF.bank === b ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select></label>
      <label class="f">Min. amount (₹)<input id="fMin" type="number" min="0" value="${NCRPF.min || ''}" style="width:130px" placeholder="0"></label>
      <span class="chip ${NCRPF.cash ? 'on' : ''}" id="fCash" style="cursor:pointer">ATM / cash-outs</span>
      <span class="small dim">States: ${esc(states.join(', ') || '—')}</span>
    </div></div>
    <div id="nGraph" style="margin-bottom:14px"></div>
    <div class="card"><div class="tabs" id="nTabs">${[['trail', 'Money trail (hop by hop)'], ['map', 'Map (by IFSC)'], ['layers', 'Layer summary'], ['banks', 'Bank summary'], ['check', 'Report check' + (issuesN ? ' ⚠' : '')], ['rows', 'NCRP rows']].map(([k, t]) => `<button data-t="${k}" class="${NCRPF.tab === k ? 'on' : ''}">${esc(t)}</button>`).join('')}</div><div id="nTab"></div></div>`;
  $('#nImp', el).onclick = () => go('up_ncrp');
  $('#fAck', el).onchange = e => { NCRPF.ack = e.target.value; go('ncrp'); };
  $('#fL', el).onchange = e => { NCRPF.maxL = +e.target.value; go('ncrp'); };
  $('#fB', el).onchange = e => { NCRPF.bank = e.target.value; go('ncrp'); };
  $('#fMin', el).onchange = e => { NCRPF.min = +e.target.value || 0; go('ncrp'); };
  $('#fCash', el).onclick = () => { NCRPF.cash = NCRPF.cash ? 0 : 1; go('ncrp'); };
  $('#nLet', el).onclick = () => { LET.src = 'ncrp'; LET.bank = NCRPF.bank || ''; go('letters'); };
  if ($('.nc-warn', el)) $('.nc-warn', el).onclick = () => { NCRPF.tab = 'check'; drawTab(); $('#nTabs', el).scrollIntoView({ behavior: 'smooth' }); };
  // ---------- graph ----------
  let show = all.filter(n => !NCRPF.maxL || (n.layer ?? 0) <= NCRPF.maxL);
  if (NCRPF.bank) { const keep = new Set(); const byT = groupBy(Array.from(m.E.values()), e => e.target), byS = groupBy(Array.from(m.E.values()), e => e.source);
    const up = id => { if (keep.has('u' + id)) return; keep.add('u' + id); keep.add(id); (byT.get(id) || []).forEach(e => up(e.source)); };
    const down = id => { if (keep.has('d' + id)) return; keep.add('d' + id); keep.add(id); (byS.get(id) || []).forEach(e => { const t = m.N.get(e.target); if (t && t.exit) keep.add(t.id); }); };
    all.filter(n => n.bank === NCRPF.bank).forEach(n => { up(n.id); down(n.id); }); show = show.filter(n => keep.has(n.id)); }
  const cut = (s, k) => { s = String(s || ''); return s.length > k ? s.slice(0, k - 1) + '…' : s; };
  const nodes = show.map(n => {
    if (n.exit) { const h0 = n.rows[0] || {}; const when = n.rows.length === 1 ? ncrpDT(h0.toTs || h0.ts, h0.toTs ? true : h0.hasTime) : n.rows.length + (n.exit === 'ATM' ? ' withdrawals' : ' transactions');
      return { id: n.id, label: n.label, lv: n.layer == null ? 99.5 : n.layer + 0.5, cardLines: [n.label, n.place || ACT_NAME[n.exit], `${inr(n.in)} · ${when}`], ch: 66, cw: 240,
        sub: [n.place, inrShort(n.in)].filter(Boolean).join(' | '), badge: EXIT_BADGE[n.exit] || n.exit, color: NEXIT_COL[n.exit] || '#ff6e40', blink: ['ATM', 'CHEQUE', 'CASH'].includes(n.exit) ? (NEXIT_COL[n.exit] || '#ff3b30') : undefined, lk: 'X' + n.exit, layer: n.layer, size: 20, shape: 'round-rectangle', tip: `<b>${esc(n.label)}</b><br>${esc(n.place || '')}<br>${inr(n.in)} · ${n.rows.length} txn` }; }
    if (n.unknown) return { id: n.id, label: 'Sender not in report', lv: n.layer, layer: n.layer, lk: 'L' + n.layer, color: '#8a94a6', badge: '?', cardLines: ['Sender not in report', `Layer ${n.layer} row missing`, 'see Report check'], ch: 66, cw: 240, size: 20, tip: 'The report has Layer ' + (n.layer + 1) + ' rows whose sender is not listed at Layer ' + n.layer };
    const isV = n.layer === 0; const br = n.info && (n.info.branch || n.info.city) ? cut([n.info.branch, n.info.state].filter(Boolean).join(', '), 38) : (n.ifsc ? 'Branch: IFSC not in database' : '');
    const h1 = n.hin[0]; const inLine = isV ? `Sent ${inr(n.out)} · ${n.hout.length} txn` : h1 ? `${ncrpDT(h1.ts, h1.hasTime) || 'date not in report'} · UTR ${cut(h1.utr || 'n/a', 16)}${n.hin.length > 1 ? ' (+' + (n.hin.length - 1) + ')' : ''}` : 'no credit row';
    const tail = isV ? '' : `In ${inr(n.in)}${n.hold ? ' · HOLD ' + inrShort(n.hold) : ''}${n.cash ? ' · cash ' + inrShort(n.cash) : ''}`;
    return { id: n.id, label: n.id === 'VICTIM' ? 'Victim account(s)' : n.id, lv: n.layer ?? 99, w8: n.in,
      cardLines: [n.id === 'VICTIM' ? 'Victim account(s)' : n.id, [n.bank || 'Bank n/a', n.ifsc].filter(Boolean).join(' · '), br, inLine, tail].filter(Boolean), ch: isV ? 62 : 96, cw: 240,
      sub: [n.bank || 'N/A', n.ifsc || 'N/A'].join(' | '), badge: isV ? 'V-AC' : n.layer == null ? 'NL' : 'L' + n.layer, layer: n.layer, lk: 'L' + (n.layer ?? 'null'), color: n.layer == null ? '#8a94a6' : nlc(n.layer), hold: n.hold > 0 ? 1 : undefined, size: 22 + Math.min(24, Math.sqrt((n.in || 0) / 2500)), search: [n.holder, n.bank, n.ifsc, ...n.hin.map(h => h.utr)].join(' '),
      tip: `<b>${esc(n.id)}</b>${n.holder ? '<br>' + esc(n.holder) : ''}<br>${esc(n.bank || '')} ${esc(n.ifsc || '')}${br ? '<br>' + esc(br) : ''}<br>Layer ${n.layer ?? '?'} · in ${inr(n.in)}${n.hold ? '<br><b>On hold ' + inr(n.hold) + '</b>' : ''}<br><i>Click for all transactions</i>` };
  });
  const EL = Array.from(m.E.values()).filter(e => e.amount >= (NCRPF.min || 0));
  const edges = EL.map((e, i) => { const h = e.hops[0] || {}; const when = h.ts ? fmtDate(h.ts) + (h.hasTime ? ' ' + fmtTime(h.ts).slice(0, 5) : '') : '';
    return { id: 'ne' + i, ei: i, source: e.source, target: e.target, label: '₹' + nfmt(Math.round(e.amount)) + (e.n > 1 ? ' ×' + e.n : '') + (h.mode && e.n === 1 ? ' · ' + h.mode : '') + (when ? '\n' + when : ''), w: 1.2 + Math.min(6, Math.max(0, Math.log10(e.amount + 1) - 2.5)), color: e.kind === 'cash' ? (NEXIT_COL[(m.N.get(e.target) || {}).exit] || '#ff6e40') : nlc((m.N.get(e.target) || {}).layer), dash: e.kind === 'cash' ? 1 : undefined }; });
  const lays = uniq(show.filter(n => !n.exit && n.layer != null).map(n => n.layer)).sort((a, b) => a - b); const exits = uniq(show.filter(n => n.exit).map(n => n.exit));
  const titles = {}; lays.forEach(l => { const ns = show.filter(n => !n.exit && (n.layer ?? 0) === l && !n.unknown); titles[l] = { label: l === 0 ? 'COMPLAINANT' : `LAYER ${l}  ·  ${ns.length} a/c  ·  ${inrShort(sum(ns, n => n.in))}`, color: nlc(l), lk: 'L' + l }; });
  uniq(show.filter(n => n.exit).map(n => n.layer == null ? 99.5 : n.layer + 0.5)).forEach(v => { titles[v] = { label: v > 99 ? 'CASH-OUT · NOT LINKED' : 'CASH-OUT  ·  L' + Math.floor(v), color: '#ff6e40' }; });
  if (show.some(n => !n.exit && n.layer == null)) titles[99] = { label: 'NOT LINKED TO THE TRAIL', color: '#8a94a6', lk: 'Lnull' };
  GraphKit.mount($('#nGraph', el), { key: 'ncrp', file: 'ncrp_graph', defaultLayout: 'lr', strict: true, levelTitles: titles, nodes, edges, roots: m.roots,
    layers: lays.map(l => ({ key: 'L' + l, label: l === 0 ? 'V' : 'L' + l, color: nlc(l), title: l === 0 ? 'victim accounts' : 'layer ' + l })).concat(exits.map(x => ({ key: 'X' + x, label: x === 'CHEQUE' ? 'CHQ' : x, color: NEXIT_COL[x] || '#ff6e40', title: ACT_NAME[x] }))),
    stats: [{ label: 'Fraud amount', value: inrShort(m.fraud), cls: 'adm' }, { label: 'Hold', value: inrShort(holdTot) }],
    legend: lays.map(l => `<span><i style="background:${nlc(l)}"></i>${l === 0 ? 'Complainant' : 'Layer ' + l}</span>`).join('') + exits.map(x => `<span><i class="blinkdot" style="background:${NEXIT_COL[x] || '#ff6e40'}"></i>${ACT_NAME[x]}</span>`).join('') + '<span><i style="background:none;border:3px double #00ff9d"></i>Amount on hold</span><span class="dim">Click a box or an amount on an arrow for date · time · UTR · branch</span>',
    onTap: id => ncrpNodeModal(m, id), onEdgeTap: d => ncrpEdgeModal(m, EL[d.ei]) });
  // ---------- tabs ----------
  const hopCols = [
    { label: 'Layer', get: h => h.kind === 'cash' ? 'L' + h.layer + ' cash-out' : h.layer === 1 ? 'L1 (disputed)' : 'L' + h.layer },
    { label: 'Date & time', html: h => h.ts ? esc(fmtDT(h.ts, h.hasTime)) + (h.hasTime ? '' : ' <span class="dim small">(time n/a)</span>') : '<span class="dim">not in report</span>', x: h => h.ts ? fmtDT(h.ts, h.hasTime) : '' },
    { label: 'UTR / Txn ID', html: h => h.utr ? `<span class="mono">${esc(h.utr)}</span>` : '<span class="dim">—</span>', x: h => h.utr },
    { label: 'Mode', get: h => h.mode || '' },
    { label: 'From account', html: h => { const s = m.N.get(h.from) || {}; return `<span class="mono">${esc(s.unknown ? 'Not in report' : s.id === 'VICTIM' ? 'Complainant' : h.from)}</span><div class="small dim">${esc(s.bank || '')}</div>`; }, x: h => h.from },
    { label: 'To account', html: h => { const t = m.N.get(h.to) || {}; return t.exit ? `<b>${esc(t.label)}</b><div class="small dim">${esc(t.place || '')}</div>` : `<span class="mono">${esc(h.to)}</span><div class="small dim">${esc(t.bank || '')}${t.ifsc ? ' · ' + esc(t.ifsc) : ''}</div>`; }, x: h => h.to },
    { label: 'Branch / location', get: h => { const t = m.N.get(h.to) || {}; return t.exit ? (t.place || '') : ncrpBranch(t.ifsc); } },
    { label: 'Amount', html: h => inr(h.amount), num: 1, x: h => h.amount },
    { label: 'Action', html: h => { const t = m.N.get(h.to) || {}; return h.kind === 'cash' ? badge(ACT_NAME[h.action] || h.action, 'red') : t.hold ? badge('Hold ' + inrShort(t.hold), 'green') : h.layer === 1 ? badge('Disputed', 'amber') : badge('Transfer', 'blue'); }, x: h => ACT_NAME[h.action] || h.action },
    { label: 'Link basis', html: h => `<span class="small ${/verify|not found|no onward/i.test(h.basis) ? 'warn-t' : 'dim'}">${esc(h.basis)}</span>`, x: h => h.basis }];
  const drawTab = () => {
    $$('#nTabs button', el).forEach(b => b.classList.toggle('on', b.dataset.t === NCRPF.tab)); const host = $('#nTab', el);
    if (NCRPF.tab === 'trail') {
      const Ls = uniq(m.H.map(h => h.layer)).filter(v => v != null).sort((a, b) => a - b);
      const q0 = NCRPF.tl; const hs = m.H.filter(h => (!q0 || h.layer === q0) && (h.kind === 'money' || NCRPF.cash)).sort((a, b) => (a.layer || 0) - (b.layer || 0) || (a.kind === 'cash') - (b.kind === 'cash') || (a.ts || 0) - (b.ts || 0));
      host.innerHTML = `<div class="row sb" style="margin-bottom:10px;flex-wrap:wrap"><div class="row" style="gap:6px;flex-wrap:wrap"><span class="chip ${!q0 ? 'on' : ''}" data-tl="0">All layers</span>${Ls.map(l => `<span class="chip ${q0 === l ? 'on' : ''}" data-tl="${l}" style="--c:${nlc(l)}">Layer ${l}</span>`).join('')}</div><input id="nTq" placeholder="Filter by account, UTR, bank…" style="width:260px"></div><div id="nTt"></div>`;
      const draw = () => { const q = ($('#nTq', host).value || '').toUpperCase().replace(/\s/g, ''); const rs = !q ? hs : hs.filter(h => { const t = m.N.get(h.to) || {}, s = m.N.get(h.from) || {}; return (h.from + h.to + h.utr + (t.bank || '') + (s.bank || '') + (t.ifsc || '') + ncrpBranch(t.ifsc)).toUpperCase().replace(/\s/g, '').includes(q); });
        $('#nTt', host).innerHTML = simpleTable(hopCols, rs, { maxH: 520, click: 1, empty: 'No hops for this filter.' }); bindRows($('#nTt', host), rs, h => { const e = m.E.get(h.from + '>' + h.to); if (e) ncrpEdgeModal(m, e, h); }); };
      $$('[data-tl]', host).forEach(b => b.onclick = () => { NCRPF.tl = +b.dataset.tl; drawTab(); }); $('#nTq', host).oninput = draw; draw();
    } else if (NCRPF.tab === 'map') {
      const pts = ncrpGeoPoints(m); const cl = ncrpGeoClusters(m); const noLoc = all.filter(n => !n.exit && !n.unknown && n.id !== 'VICTIM' && !pts.some(p => p.n === n));
      const tilesOn = !!S.prefs.mapTiles;
      host.innerHTML = `<div class="row sb" style="flex-wrap:wrap;gap:8px;margin-bottom:8px"><div class="legend">${uniq(pts.map(p => p.n.layer)).sort((a, b) => a - b).map(l => `<span><i style="background:${nlc(l)}"></i>${l === 0 ? 'Complainant' : 'Layer ' + l}</span>`).join('')}<span><i style="background:none;border:2px dashed #ff6e40"></i>2+ accounts within 10 km</span></div>
        <label class="row small"><input type="checkbox" id="ncTiles" ${tilesOn ? 'checked' : ''}> Street map (OpenStreetMap tiles — only the map area is requested, no case data)</label></div>
        <div id="ncMap" class="geo-map"></div>
        <div class="small dim" style="margin-top:6px">${pts.length} account(s) placed by the IFSC of their branch — position is approximate (branch PIN-code or district centre), not the account holder’s address.${noLoc.length ? ` ${noLoc.length} account(s) without a usable IFSC / location are not on the map.` : ''}</div>
        <h4 style="margin-top:14px">Accounts within 10 km of each other ${cl.length ? badge(cl.length + ' lead(s)', 'amber') : ''}</h4>
        ${simpleTable([{ label: 'Area', html: g => `<b>${esc(g.place || '—')}</b><div class="small dim">${esc(g.state)}</div>` , x: g => g.place }, { label: 'Accounts', html: g => g.pts.map(p => `<span class="mono">${esc(p.n.id)}</span> <span class="small" style="color:${nlc(p.n.layer)}">L${p.n.layer}</span> <span class="small dim">${esc(p.n.bank || '')}</span>`).join('<br>'), x: g => g.pts.map(p => p.n.id + ' (L' + p.n.layer + ')').join(', ') }, { label: 'Layers', get: g => g.layers.map(l => 'L' + l).join(', ') }, { label: 'Spread', get: g => g.maxKm + ' km' }, { label: 'Received', html: g => inr(g.amt), num: 1 }, { label: 'On hold', html: g => g.hold ? inr(g.hold) : '', num: 1 }], cl, { maxH: 320, empty: 'No two trail accounts have branches within 10 km of each other.' })}`;
      $('#ncTiles', host).onchange = async e => { S.prefs.mapTiles = e.target.checked; await savePrefs(); drawTab(); };
      if (typeof L === 'undefined') { $('#ncMap', host).innerHTML = emptyState('Map library not loaded.'); return; }
      if (window.NC_MAP) { try { NC_MAP.remove(); } catch { } } const map = window.NC_MAP = geoBaseMap($('#ncMap', host), tilesOn); const b = [];
      const mx = Math.max(1, ...pts.map(p => p.n.in || 0));
      for (const g of cl) L.circle([g.lat, g.lon], { radius: Math.max(10000, g.maxKm * 500 + 6000), color: '#ff6e40', weight: 2, dashArray: '6 6', fill: true, fillOpacity: 0.06 }).addTo(map).bindTooltip(`${g.pts.length} accounts within 10 km · ${esc(g.place)}`);
      const jit = new Map();
      for (const p of pts) { const k = p.lat.toFixed(3) + ',' + p.lon.toFixed(3); const j = jit.get(k) || 0; jit.set(k, j + 1); const ll = [p.lat + (j ? 0.004 * Math.cos(j * 2.4) * Math.ceil(j / 6) : 0), p.lon + (j ? 0.004 * Math.sin(j * 2.4) * Math.ceil(j / 6) : 0)]; b.push(ll);
        const col = nlc(p.n.layer); const inf = p.info || {};
        L.circleMarker(ll, { radius: 6 + 10 * Math.sqrt((p.n.in || 0) / mx), color: p.n.hold ? '#00ff9d' : '#0b1220', weight: p.n.hold ? 3 : 1.5, fillColor: col, fillOpacity: .85 }).addTo(map)
          .bindTooltip(`${p.n.layer === 0 ? 'V-AC' : 'L' + p.n.layer} · ${esc(p.n.id)}`)
          .bindPopup(`<b>${p.n.layer === 0 ? 'Complainant' : 'Layer ' + p.n.layer}</b> · <span class="mono">${esc(p.n.id)}</span><br>${esc(p.n.bank || '')} · ${esc(p.n.ifsc)}<br>${esc([inf.branch, inf.address].filter(Boolean).join(', '))}<br>${esc([inf.city, inf.district, inf.state].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', '))}<br>Received <b>${esc(inr(p.n.in))}</b>${p.n.hold ? ' · on hold ' + esc(inr(p.n.hold)) : ''}<br><span class="small">Location: ${esc(p.acc)} (approximate)</span><br><a target="_blank" rel="noopener noreferrer" href="${gmapsUrl([inf.bank || p.n.bank, inf.branch, inf.address].filter(Boolean).join(' '))}">Branch on Google Maps</a>`); }
      if (b.length) map.fitBounds(b, { padding: [30, 30], maxZoom: 11 }); setTimeout(() => map.invalidateSize(), 150);
    } else if (NCRPF.tab === 'layers') {
      host.innerHTML = simpleTable([{ label: 'Layer', k: 'l' }, { label: 'Accounts', k: 'n', num: 1 }, { label: 'Banks', k: 'b' }, { label: 'Received', html: r => inr(r.in), num: 1 }, { label: 'Moved onward', html: r => inr(r.out), num: 1 }, { label: 'On hold', html: r => inr(r.hold), num: 1 }, { label: 'Cash-out', html: r => inr(r.cash), num: 1 }, { label: 'First credit', get: r => r.first }],
        layersSorted.map(l => { const ns = byLayer.get(l); const f0 = ns.flatMap(n => n.hin).filter(h => h.ts).sort((a, b) => a.ts - b.ts)[0]; return { l: 'Layer ' + l, n: ns.length, b: uniq(ns.map(n => n.bank).filter(Boolean)).join(', '), in: sum(ns, x => x.in), out: sum(ns, x => x.out), hold: sum(ns, x => x.hold), cash: sum(ns, x => x.cash), first: f0 ? fmtDT(f0.ts, f0.hasTime) : '' }; }), { maxH: 400 });
    } else if (NCRPF.tab === 'banks') {
      const byB = Array.from(groupBy(accts, n => n.bank || 'Unknown').entries()).map(([b, ns]) => ({ b, n: ns.length, lay: uniq(ns.map(n => 'L' + n.layer)).sort().join(', '), in: sum(ns, x => x.in), hold: sum(ns, x => x.hold), st: uniq(ns.map(n => n.info && n.info.state).filter(Boolean)).join(', ') })).sort((a, b) => b.in - a.in);
      host.innerHTML = simpleTable([{ label: 'Bank / wallet', k: 'b' }, { label: 'Layers', k: 'lay' }, { label: 'Accounts', k: 'n', num: 1 }, { label: 'Branch states', k: 'st' }, { label: 'Received', html: r => inr(r.in), num: 1 }, { label: 'On hold', html: r => inr(r.hold), num: 1 }, { label: '', html: r => `<button class="btn-sm" data-lb="${esc(r.b)}">✉ Letter</button>` }], byB, { maxH: 420 });
      $$('[data-lb]', host).forEach(b => b.onclick = () => { LET.src = 'ncrp'; LET.bank = b.dataset.lb; go('letters'); });
    } else if (NCRPF.tab === 'check') {
      const rowsL = groupBy(m.rows, r => r.layer ?? '?'); const noIfsc = accts.filter(n => n.ifsc && !(n.info && n.info.branch)); const noL = m.rows.filter(r => r.layer == null);
      const hasTo = m.rows.some(r => r.toUtr || r.toAmount);
      host.innerHTML = `<div class="grid g2" style="gap:12px">
        <div><h4>Rows read per layer</h4>${simpleTable([{ label: 'Layer', k: 'l' }, { label: 'Rows', k: 'r', num: 1 }, { label: 'Distinct accounts', k: 'a', num: 1 }, { label: 'Actions', k: 'x' }], Array.from(rowsL.entries()).sort((a, b) => (a[0] === '?') - (b[0] === '?') || a[0] - b[0]).map(([l, rs]) => ({ l: l === '?' ? 'No layer in file' : 'Layer ' + l, r: rs.length, a: uniq(rs.map(r => r.acctNo)).length, x: Array.from(groupBy(rs, r => ACT_NAME[r.action] || r.status || '—').entries()).map(([k, v]) => k + ' ' + v.length).join(' · ') })), { maxH: 260 })}
          <div class="small dim" style="margin-top:8px">Each Layer-1 account is counted once even when the report repeats it on several action rows.</div></div>
        <div><h4>Checks</h4><ul class="chk">
          <li class="${m.issues.orphan.length ? 'bad' : 'ok'}">${m.issues.orphan.length ? `${m.issues.orphan.length} credit(s) whose sender is not in the report (shown as “Sender not in report”)` : 'Every Layer 2+ credit has its sender in the previous layer'}</li>
          <li class="${m.issues.assumed.length ? 'warn' : 'ok'}">${m.issues.assumed.length ? `${m.issues.assumed.length} link(s) chosen by nearest time — verify with the bank statement` : 'All links matched by UTR, amount or a single onward transfer'}</li>
          <li class="${hasTo ? 'ok' : 'warn'}">${hasTo ? 'Onward UTR / amount columns found in the report' : 'No separate onward UTR / amount columns — onward transfer details are taken from the next layer’s row'}</li>
          <li class="${m.issues.unlinked.length ? 'bad' : 'ok'}">${m.issues.unlinked.length ? m.issues.unlinked.length + ' action row(s) (hold / ATM / POS / cheque / other) on accounts not found in the money-transfer trail — shown as “Not linked”' : 'Every hold / withdrawal / other action is on an account in the trail'}</li>
          <li class="${noL.filter(r => !r.actOnly).length ? 'bad' : 'ok'}">${noL.filter(r => !r.actOnly).length ? noL.filter(r => !r.actOnly).length + ' transfer row(s) without a layer number (treated as Layer 1)' : 'Every transfer row has a layer number'}</li>
          <li class="dim">${m.rows.filter(r => r.layerDerived).length} hold / withdrawal / other row(s) took their layer from the transfer that credited the account (same UTR)</li>
          <li class="${noIfsc.length ? 'warn' : 'ok'}">${noIfsc.length ? noIfsc.length + ' IFSC code(s) not in the offline branch database: ' + esc(uniq(noIfsc.map(n => n.ifsc)).slice(0, 8).join(', ')) : 'Branch and location found for every IFSC'}</li>
          <li class="dim">IFSC database: ${esc(IFSCDB.stats().text)}</li></ul></div></div>
        ${m.issues.orphan.length + m.issues.assumed.length ? `<h4 style="margin-top:14px">Links to verify</h4>${simpleTable(hopCols, m.issues.orphan.concat(m.issues.assumed), { maxH: 300 })}` : ''}`;
    } else {
      const cols = [{ label: 'Ack No.', k: 'ackNo' }, { label: 'Layer', k: 'layer' }, { label: 'Account / wallet', k: 'acctNo' }, { label: 'Bank', k: 'bank' }, { label: 'UTR', k: 'utr' }, { label: 'Date', get: r => r.ts ? fmtDT(r.ts, r.hasTime) : '' }, { label: 'Amount', html: r => inr(r.amount || r.disputed), num: 1, x: r => r.amount || r.disputed },
        { label: 'Action taken', get: r => r.status || ACT_NAME[r.action] || '' }, { label: 'To account', k: 'toAcct' }, { label: 'IFSC', get: r => r.toIfsc || r.ifsc }, { label: 'Onward UTR', k: 'toUtr' }, { label: 'Onward amt', html: r => r.toAmount ? inr(r.toAmount) : '', num: 1, x: r => r.toAmount }, { label: 'ATM ID / place', get: r => [r.atmId, r.atmPlace].filter(Boolean).join(' · ') }, { label: 'Hold', html: r => r.hold ? inr(r.hold) : '', num: 1, x: r => r.hold }, { label: 'Source row', get: r => r.src ? (r.src.file || '') + ' r' + (r.src.row || '') : '' }];
      host.innerHTML = `<div class="row sb" style="margin-bottom:8px"><span class="small dim">${nfmt(m.rows.length)} rows exactly as imported</span><input id="nQ" placeholder="Filter rows…" style="width:240px"></div><div id="nRows"></div>`;
      const draw = () => { const q = ($('#nQ', host).value || '').toLowerCase(); const rs = m.rows.filter(r => !q || JSON.stringify(r).toLowerCase().includes(q)); $('#nRows', host).innerHTML = simpleTable(cols, rs.slice(0, 2000), { maxH: 460 }); };
      $('#nQ', host).oninput = draw; draw();
    }
  };
  $$('#nTabs button', el).forEach(b => b.onclick = () => { NCRPF.tab = b.dataset.t; drawTab(); }); drawTab();
  $('#nXl', el).onclick = () => exportTable('NCRP money trail', hopCols.concat([{ label: 'Branch / location', get: h => { const t = m.N.get(h.to) || {}; return t.exit ? t.place : ncrpBranch(t.ifsc); } }]).filter((c, i, a) => a.findIndex(x => x.label === c.label) === i), m.H.slice().sort((a, b) => (a.layer || 0) - (b.layer || 0) || (a.ts || 0) - (b.ts || 0)));
};

function ncrpNodeModal(m, id) {
  const n = m.N.get(id); if (!n) return;
  if (n.id === 'VICTIM' && !n.hout.length) return toast('Complainant account(s): set a case account’s role to Complainant to show it here.', 'ok', 5000);
  const inf = n.info || {}; const nm = x => { const t = m.N.get(x) || {}; return t.exit ? t.label : t.unknown ? 'Sender not in report' : t.id === 'VICTIM' ? 'Complainant' : x; };
  const hin = n.hin, hout = n.hout;
  const inCols = [{ label: 'Date & time', get: h => h.ts ? fmtDT(h.ts, h.hasTime) : 'not in report' }, { label: 'UTR / Txn ID', html: h => `<span class="mono">${esc(h.utr || '—')}</span>` }, { label: 'From', html: h => `<span class="mono">${esc(nm(h.from))}</span><div class="small dim">${esc((m.N.get(h.from) || {}).bank || '')}</div>` }, { label: 'Amount', html: h => inr(h.amount), num: 1 }, { label: 'Basis', html: h => `<span class="small dim">${esc(h.basis)}</span>` }];
  const outCols = [{ label: 'Date & time', get: h => h.ts ? fmtDT(h.ts, h.hasTime) : 'not in report' }, { label: 'UTR / Txn ID', html: h => `<span class="mono">${esc(h.utr || '—')}</span>` }, { label: 'To', html: h => { const t = m.N.get(h.to) || {}; return `<span class="mono">${esc(nm(h.to))}</span><div class="small dim">${esc(t.exit ? t.place || '' : [t.bank, t.ifsc].filter(Boolean).join(' · '))}</div>`; } }, { label: 'Branch / location', get: h => { const t = m.N.get(h.to) || {}; return t.exit ? '' : ncrpBranch(t.ifsc); } }, { label: 'Amount', html: h => inr(h.amount), num: 1 }, { label: 'Action', get: h => ACT_NAME[h.action] || (h.kind === 'cash' ? 'Cash-out' : 'Transfer') }];
  const body = `<div class="grid g2" style="gap:10px">
    <div class="card"><h3>${n.exit ? esc(n.label) : n.layer === 0 ? 'Complainant account' : 'Layer ' + esc(n.layer ?? '?') + ' account / wallet'}</h3><div class="mono" style="font-size:17px">${esc(n.exit ? (n.rows[0] || {}).acctNo || '' : n.id)}</div>
      ${n.holder ? `<div>${esc(n.holder)}</div>` : ''}<div class="muted">${esc(n.bank || '')} ${n.ifsc ? '· <span class="mono">' + esc(n.ifsc) + '</span>' : ''}</div>
      ${inf.branch ? `<div class="small" style="margin-top:4px"><b>${esc(inf.branch)}</b><br>${esc(inf.address || '')}<br>${esc([inf.city, inf.district, inf.state].filter(Boolean).filter((v, k, a) => a.indexOf(v) === k).join(', '))}${inf.contact ? '<br>☎ ' + esc(inf.contact) : ''}</div>` : n.ifsc ? `<div class="small dim">IFSC not in the offline branch database</div>` : n.exit ? `<div class="small">${esc(n.place || '')}</div>` : ''}
      <div class="row" style="margin-top:8px;flex-wrap:wrap">${n.exit ? '' : badge(n.layer === 0 ? 'Complainant' : 'Layer ' + (n.layer ?? '?'), 'cyan')} ${n.hold ? badge('On hold ' + inr(n.hold), 'green') : ''} ${Object.entries(n.act || {}).map(([k, v]) => badge(ACT_NAME[k] + ' ' + inrShort(v), k === 'HOLD' ? 'green' : k === 'TRANSFER' ? 'blue' : 'amber')).join(' ')}</div>
      <div class="row" style="margin-top:10px;flex-wrap:wrap">${n.ifsc ? `<a class="btn-sm" href="${gmapsUrl((inf.bank || n.bank || '') + ' ' + (inf.branch || n.ifsc) + ' ' + (inf.city || ''))}" target="_blank" rel="noopener noreferrer">⌖ Branch on Google Maps</a>` : ''}${n.acct ? `<button class="btn-sm" id="mAcc">Open account</button>` : ''}${!n.exit && !n.unknown && n.layer !== 0 ? `<button class="btn-sm btn-p" id="mLet">✉ Letter to ${esc((n.bank || 'bank').slice(0, 22))}</button>` : ''}</div></div>
    <div class="card"><h3>Summary</h3>${simpleTable([{ label: '', k: 'k' }, { label: '', html: r => r.v, num: 1 }], [{ k: 'Money received', v: inr(n.in) }, { k: 'Credits', v: nfmt(hin.length) }, { k: 'Moved onward', v: inr(n.out) }, { k: 'Cash-out', v: inr(n.cash || 0) }, { k: 'On hold', v: inr(n.hold || 0) }, { k: 'First credit', v: esc(hin[0] && hin[0].ts ? fmtDT(hin[0].ts, hin[0].hasTime) : '—') }, { k: 'Last debit', v: esc(hout.length && hout[hout.length - 1].ts ? fmtDT(hout[hout.length - 1].ts, hout[hout.length - 1].hasTime) : '—') }], { maxH: 300 })}</div></div>
    <div class="card" style="margin-top:10px"><h3>Money in (${hin.length})</h3>${simpleTable(inCols, hin, { maxH: 240, empty: 'No incoming transaction in the report' })}</div>
    <div class="card" style="margin-top:10px"><h3>Money out / action by bank (${hout.length})</h3>${simpleTable(outCols, hout, { maxH: 240, empty: 'No onward transaction in the report' })}</div>
    ${n.atms && n.atms.length ? `<div class="card" style="margin-top:10px"><h3>ATM withdrawals</h3>${simpleTable([{ label: 'ATM ID', k: 'atmId' }, { label: 'Place', k: 'atmPlace' }, { label: 'Date', get: r => ncrpDT(r.toTs || r.ts, r.toTs ? true : r.hasTime) }, { label: 'Amount', html: r => inr(r.toAmount || r.amount), num: 1 }, { label: '', html: r => { const a = GEO.atmInfo(r.atmId); return `<a class="btn-sm" target="_blank" rel="noopener noreferrer" href="${gmapsUrl(a ? [a.bank, a.address, a.city, a.state].join(' ') : (r.atmPlace || 'ATM ' + r.atmId), a && a.lat, a && a.lon)}">⌖ Map</a>`; } }], n.atms, { maxH: 200 })}</div>` : ''}
    <div class="card" style="margin-top:10px"><h3>NCRP rows (${n.rows.length})</h3>${simpleTable([{ label: 'Layer', k: 'layer' }, { label: 'UTR', k: 'utr' }, { label: 'Date', get: r => ncrpDT(r.ts, r.hasTime) }, { label: 'Amount', html: r => inr(r.amount || r.disputed), num: 1 }, { label: 'Action taken', get: r => r.status || ACT_NAME[r.action] || '' }, { label: 'To account', k: 'toAcct' }, { label: 'IFSC', get: r => r.toIfsc || r.ifsc }, { label: 'Hold', html: r => r.hold ? inr(r.hold) : '', num: 1 }, { label: 'Source row', get: r => r.src ? (r.src.file || '') + ' r' + (r.src.row || '') : '' }], n.rows, { maxH: 240, empty: 'No rows of its own — this account appears only as a beneficiary in the previous layer.' })}</div>`;
  const md = modal({ title: 'NCRP · ' + esc(n.exit ? n.label : n.id === 'VICTIM' ? 'Complainant' : n.id), body, foot: false });
  if ($('#mAcc', md.el)) $('#mAcc', md.el).onclick = () => { md.close(); openAccount(n.acct.id); };
  if ($('#mLet', md.el)) $('#mLet', md.el).onclick = () => { md.close(); LET.src = 'ncrp'; LET.bank = n.bank || ''; LET.acct = n.id; go('letters'); };
}

function ncrpEdgeModal(m, e, only) {
  if (!e) return; const src = m.N.get(e.source) || {}, dst = m.N.get(e.target) || {};
  const nm = t => t.exit ? t.label : t.unknown ? 'Sender not in report' : t.id === 'VICTIM' ? 'Complainant' : t.id;
  const hops = only ? [only] : e.hops;
  const tile = (t, head) => `<div class="card nc-tile" style="--lc:${t.exit ? NEXIT_COL[t.exit] || '#ff6e40' : nlc(t.layer)}"><div class="small dim">${head}</div><div class="mono" style="font-size:15px">${esc(nm(t))}</div><div class="small">${esc(t.exit ? t.place || '' : [t.bank, t.ifsc].filter(Boolean).join(' · '))}</div>${!t.exit && ncrpBranch(t.ifsc) ? `<div class="small dim">${esc(ncrpBranch(t.ifsc))}</div>` : ''}${!t.exit && t.layer != null ? `<div class="small">${t.layer === 0 ? 'Complainant' : 'Layer ' + t.layer}</div>` : ''}</div>`;
  const hopCard = h => `<div class="nc-hop"><div class="nc-hk"><span>Date & time</span><b>${esc(h.ts ? fmtDT(h.ts, h.hasTime) : 'Not in report')}</b>${h.ts && !h.hasTime ? '<i class="small dim">time unavailable in source report</i>' : ''}</div><div class="nc-hk"><span>UTR / Transaction ID</span><b class="mono">${esc(h.utr || '—')}</b></div><div class="nc-hk"><span>Amount</span><b>${esc(inr(h.amount))}</b></div>${h.mode ? `<div class="nc-hk"><span>Mode (from UTR)</span><b>${esc(h.mode)}</b></div>` : ''}${h.rows[0] && h.rows[0].remarks ? `<div class="nc-hk" style="grid-column:1/-1"><span>Remarks by bank</span><b class="small">${esc(h.rows[0].remarks)}</b></div>` : ''}<div class="nc-hk"><span>Action</span><b>${esc(h.kind === 'cash' ? ACT_NAME[h.action] || 'Cash-out' : h.layer === 1 && h.action === 'CREDIT' ? 'Disputed transaction' : 'Money transfer')}</b></div><div class="nc-hk"><span>Link basis</span><b class="small">${esc(h.basis)}</b></div>${h.rows[0] && h.rows[0].atmId ? `<div class="nc-hk"><span>ATM</span><b>${esc(h.rows[0].atmId)} ${esc(h.rows[0].atmPlace || '')}</b></div>` : ''}${h.rows[0] && h.rows[0].chequeNo ? `<div class="nc-hk"><span>Cheque no.</span><b>${esc(h.rows[0].chequeNo)}</b></div>` : ''}</div>`;
  const rowCols = [{ label: 'Ack No.', k: 'ackNo' }, { label: 'Layer', k: 'layer' }, { label: 'Account / wallet', k: 'acctNo' }, { label: 'UTR', k: 'utr' }, { label: 'Date & time', get: r => ncrpDT(r.ts, r.hasTime) }, { label: 'Amount', html: r => inr(r.amount || r.disputed), num: 1 }, { label: 'Action taken by bank', get: r => r.status || ACT_NAME[r.action] || '' }, { label: 'To account', k: 'toAcct' }, { label: 'IFSC', get: r => r.toIfsc || r.ifsc }, { label: 'Source row', get: r => r.src ? (r.src.file || '') + ' r' + (r.src.row || '') : '' }];
  const rows = uniq(hops.flatMap(h => h.rows));
  const body = `<div class="nc-pair">${tile(src, 'FROM')}<div class="nc-mid">→<div>${esc(inr(sum(hops, h => h.amount)))}</div><div class="small dim">${hops.length} transaction${hops.length > 1 ? 's' : ''}</div></div>${tile(dst, 'TO')}</div>
    ${hops.map(hopCard).join('')}
    <div class="card" style="margin-top:10px"><h3>Source NCRP rows (${rows.length})</h3>${simpleTable(rowCols, rows, { maxH: 260, empty: 'No NCRP rows for this link.' })}</div>`;
  modal({ title: `Transaction · ${esc(nm(src))} → ${esc(nm(dst))}`, body, foot: false });
}
