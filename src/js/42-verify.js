/* ============================ MONEY TRAIL VERIFICATION ============================
   Every reported / traced transaction is checked on both statements:
   UTR / transaction ID, amount, date and type must agree. Only then is it VERIFIED.
   Anything else is NOT VERIFIED (highlighted) and can be reviewed and marked verified manually. */
const VF = { f: 'all', layer: 'l1' };
const sameAmt = (a, b) => Math.abs((a || 0) - (b || 0)) <= 1;
const sameDay = (a, b) => a != null && b != null && dayKey(a) === dayKey(b);
const nearDay = (a, b) => a != null && b != null && Math.abs(a - b) <= 36 * 3600000;
function utrIn(t, u) { if (!t || !u) return false; const n = normUtr(u); if (!n || n.length < 6) return false; return normUtr(t.utr) === n || normUtr(t.ref) === n || String(t.narr || '').toUpperCase().replace(/[^A-Z0-9]/g, '').includes(n); }
function findTx(acct, pred) { if (!acct) return null; for (const t of IX.txByAcct.get(acct.id) || []) if (pred(t)) return t; return null; }
function vCheck(row) {
  // row: { key, utr, amt, ts, from (acct|null), to (acct|null), fromTx?, toTx? }
  const f = row.fromTx || (row.from && (findTx(row.from, t => t.dr > 0 && utrIn(t, row.utr)) || null));
  const t = row.toTx || (row.to && (findTx(row.to, x => x.cr > 0 && utrIn(x, row.utr)) || null));
  const fAlt = !f && row.from ? findTx(row.from, x => x.dr > 0 && sameAmt(x.dr, row.amt) && nearDay(x.ts, row.ts)) : null;
  const tAlt = !t && row.to ? findTx(row.to, x => x.cr > 0 && sameAmt(x.cr, row.amt) && nearDay(x.ts, row.ts)) : null;
  const fs = !!(row.from && (IX.txByAcct.get(row.from.id) || []).length), ts_ = !!(row.to && (IX.txByAcct.get(row.to.id) || []).length);
  const checks = [];
  const ok = (nm, v, why) => { const [short, name] = nm.split('|'); checks.push({ short, name, ok: v, why }); };
  const F = f || fAlt, T_ = t || tAlt;
  if (fs) { ok('S·UTR|UTR in complainant / sender statement', !!f, f ? '' : fAlt ? 'Same amount & date found, but UTR differs / missing' : 'No debit found'); if (F) { ok('S·Amount|Amount in sender statement', sameAmt(F.dr, row.amt), inr(F.dr) + ' vs ' + inr(row.amt)); if (row.ts != null) ok('S·Date|Date in sender statement', sameDay(F.ts, row.ts) || !row.tsFromNcrp && nearDay(F.ts, row.ts), fmtDate(F.ts) + ' vs ' + fmtDate(row.ts)); } }
  if (ts_) { ok('R·UTR|UTR in receiving statement', !!t, t ? '' : tAlt ? 'Same amount & date found, but UTR differs / missing' : 'No credit found'); if (T_) { ok('R·Amount|Amount in receiving statement', sameAmt(T_.cr, row.amt), inr(T_.cr) + ' vs ' + inr(row.amt)); ok('R·Date|Date in receiving statement', nearDay(T_.ts, F ? F.ts : row.ts), fmtDate(T_.ts)); } }
  if (F && T_) ok('Type|Transaction type on both sides', !F.channel || !T_.channel || F.channel === T_.channel || [F.channel, T_.channel].includes('UNKNOWN'), (F.channel || '?') + ' / ' + (T_.channel || '?'));
  const man = (S.cur.work.verif || {})[row.key];
  let status = !fs && !ts_ ? 'PENDING' : checks.every(c => c.ok) && fs && ts_ ? 'VERIFIED' : checks.every(c => c.ok) ? 'PARTLY VERIFIED' : 'NOT VERIFIED';
  const pending = [!fs && row.from !== undefined ? 'sender statement' : '', !ts_ ? 'receiver statement' : ''].filter(Boolean);
  if (man) status = man.status;
  return Object.assign(row, { fTx: F, tTx: T_, checks, status, man, pending, auto: !man });
}
function verifyRows() {
  return intelCache('verify', () => {
    const c = S.cur; const out = { l1: [], l2: [] }; const d = D(); const seen = new Set();
    const accOf = no => no ? IX.acctByKey.get(acctKey(no)) || null : null;
    const comps = c.accts.filter(a => acctType(a) === 'Complainant');
    // A. NCRP reported fraud transactions (Layer 1)
    for (const r of (c.work.ncrp.length ? ncrpFraudRows() : [])) {
      const to = accOf(r.acctNo); let from = accOf(r.fromAcct);
      if (!from) { for (const a of comps) if (findTx(a, t => t.dr > 0 && utrIn(t, r.utr))) { from = a; break; } if (!from && comps.length === 1) from = comps[0]; }
      const key = 'N:' + (r.utr || r.id); seen.add(normUtr(r.utr));
      out.l1.push(vCheck({ key, src: 'NCRP', utr: r.utr, amt: r.disputed || r.amount, ts: r.ts, tsFromNcrp: true, from, to, fromNo: from ? from.acctNo : r.fromAcct, toNo: r.acctNo, bank: r.bank, ncrp: r }));
    }
    // B. Complainant debits traced to uploaded accounts (statement trail) not already covered by NCRP
    for (const f of d.flows) {
      const debit = IX.txById.get(f.debit); if (!debit) continue; const fromA = IX.acctById.get(f.fromAcct); const toA = f.toAcct ? IX.acctById.get(f.toAcct) : null;
      const lay = f.layerFrom; if (lay > 1) continue; if (lay === 0 && debit.utr && seen.has(normUtr(debit.utr))) continue;
      const cr = f.credit ? IX.txById.get(f.credit) : null;
      const row = vCheck({ key: 'F:' + f.debit, src: 'Statements', utr: debit.utr || (cr && cr.utr) || debit.ref || '', amt: debit.dr, ts: debit.ts, from: fromA, to: toA, fromTx: debit.utr ? null : debit, toTx: null, fromNo: fromA.acctNo, toNo: toA ? toA.acctNo : (f.toExt && (f.toExt.acctNo || f.toExt.upi)) || '', bank: toA ? toA.bank : '' });
      (lay === 0 ? out.l1 : out.l2).push(row);
    }
    return out;
  });
}
const VST = { 'VERIFIED': 'green', 'VERIFIED (manual)': 'green', 'PARTLY VERIFIED': 'cyan', 'NOT VERIFIED': 'red', 'PENDING': 'amber', 'NOT VERIFIED (manual)': 'red' };
VIEWS.verify = el => {
  const c = S.cur; const V = verifyRows(); const rowsAll = VF.layer === 'l1' ? V.l1 : V.l2;
  const rows = rowsAll.filter(r => VF.f === 'all' || (VF.f === 'ok' ? /^VERIFIED/.test(r.status) : VF.f === 'bad' ? /NOT VERIFIED/.test(r.status) : r.status === 'PENDING' || r.status === 'PARTLY VERIFIED'));
  const m = c.work.ncrp.length ? ncrpModel(Object.assign({}, NCRPF, { cash: 0, ack: '' })) : null;
  const lost = m ? m.fraud : sum(D().seeds, s => s.dr); const nTx = m ? ncrpFraudRows().length : D().seeds.length;
  const l1 = m ? Array.from(m.N.values()).filter(n => !n.exit && n.layer === 1) : []; const l1Accts = l1.length ? l1.map(n => ({ bank: n.bank, ifsc: n.ifsc || (n.acct || {}).ifsc })) : c.accts.filter(a => acctType(a) === 'Layer 1').map(a => ({ bank: a.bank, ifsc: a.ifsc }));
  const banks = uniq(l1Accts.map(x => x.bank).filter(Boolean)); const states = uniq(l1Accts.map(x => (GEO.info(x.ifsc) || {}).state).filter(Boolean));
  const cnt = s => V.l1.filter(r => s.test(r.status)).length;
  el.innerHTML = pageHead('Money Trail Verification', 'Each reported transaction is checked on both bank statements — UTR / transaction ID, amount, date and type. Only when all agree is it marked VERIFIED. Others are highlighted for review; you can mark them verified manually with a note.', `<button id="vX">⇩ Excel</button>`) +
    `<div class="grid g6" style="margin-bottom:14px">${kpi('Amount lost', inrShort(lost), m ? 'from NCRP' : 'disputed transactions', 'rgba(255,77,94,.35)')}${kpi('Transactions', nfmt(nTx), 'complainant → Layer 1', 'rgba(255,46,136,.35)')}${kpi('Banks in Layer 1', nfmt(banks.length), banks.slice(0, 2).join(', '), 'rgba(255,179,0,.35)')}${kpi('States (Layer 1 banks)', nfmt(states.length), states.slice(0, 3).join(', ') || 'look up IFSC in IFSC & ATM Map', 'rgba(0,229,255,.3)')}
      ${kpi('Verified', nfmt(cnt(/^VERIFIED/)), inrShort(sum(V.l1.filter(r => /^VERIFIED/.test(r.status)), r => r.amt)), 'rgba(0,255,157,.3)')}${kpi('Not verified', nfmt(cnt(/NOT VERIFIED/)), cnt(/PENDING|PARTLY/) + ' waiting for statements', 'rgba(255,77,94,.35)')}</div>
    <div class="card" style="margin-bottom:12px"><div class="row sb" style="flex-wrap:wrap;gap:8px"><div class="seg3" style="margin:0;flex:1">${[['l1', 'Complainant → Layer 1', '#ff2e88', V.l1.length], ['l2', 'Layer 1 → Layer 2', '#00e5ff', V.l2.length]].map(([k, t, col, n]) => `<button class="${VF.layer === k ? 'on' : ''}" data-vl="${k}" style="--pc:${col}">${t}<span>${n}</span></button>`).join('')}</div>
      <div class="row">${[['all', 'All'], ['bad', 'Not verified'], ['wait', 'Waiting / partly'], ['ok', 'Verified']].map(([k, t]) => `<span class="chip ${VF.f === k ? 'on' : ''}" data-vf="${k}" style="cursor:pointer">${t}</span>`).join('')}</div></div></div>
    <div class="card"><div id="vT"></div></div>`;
  $$('[data-vl]', el).forEach(b => b.onclick = () => { VF.layer = b.dataset.vl; go('verify'); });
  $$('[data-vf]', el).forEach(b => b.onclick = () => { VF.f = b.dataset.vf; go('verify'); });
  const cols = [{ label: 'Status', html: r => `${badge(r.status, VST[r.status] || 'gray')}${r.man ? '<div class="small dim">by ' + esc(r.man.by.split('@')[0]) + '</div>' : ''}`, x: r => r.status }, { label: 'Source', k: 'src' }, { label: 'Date', get: r => r.fTx ? fmtDT(r.fTx.ts, r.fTx.hasTime) : r.ts != null ? fmtDT(r.ts, r.ncrp ? r.ncrp.hasTime : false) : '' },
    { label: 'UTR / Txn ID', html: r => `<span class="mono">${esc(r.utr || '—')}</span>`, x: r => r.utr }, { label: 'Amount', html: r => inr(r.amt), num: 1, x: r => r.amt }, { label: 'From', get: r => r.from ? acctName(r.from) : r.fromNo || '' }, { label: 'To', get: r => r.to ? acctName(r.to) : r.toNo || '' },
    { label: 'Checks', html: r => r.checks.length ? r.checks.map(ch => `<span class="vchk ${ch.ok ? 'ok' : 'bad'}" title="${esc(ch.name + (ch.why ? ' — ' + ch.why : ''))}">${ch.ok ? '✓' : '✗'} ${esc(ch.short)}</span>`).join('') : `<span class="small dim">Upload ${esc(r.pending.join(' and ') || 'statements')}</span>`, x: r => r.checks.map(ch => (ch.ok ? 'OK ' : 'FAIL ') + ch.name + (ch.why ? ' (' + ch.why + ')' : '')).join('; ') },
    { label: '', html: (r, i) => `<button class="btn-sm" data-vr="${esc(r.key)}">Review</button>` }];
  $('#vT', el).innerHTML = simpleTable(cols, rows, { maxH: 640, empty: rowsAll.length ? 'Nothing in this filter.' : 'Nothing to verify yet. Upload the NCRP trail and the complainant and Layer 1 statements.' });
  $$('#vT tbody tr', el).forEach((tr, i) => { const r = rows[i]; if (r && /NOT VERIFIED/.test(r.status)) tr.classList.add('vrow-bad'); else if (r && /^VERIFIED/.test(r.status)) tr.classList.add('vrow-ok'); });
  $$('[data-vr]', el).forEach(b => b.onclick = () => verifyModal(rowsAll.find(r => r.key === b.dataset.vr)));
  $('#vX', el).onclick = () => xlsxBook('Money_trail_verification', [{ name: 'Complainant to L1', cols, rows: V.l1 }, { name: 'L1 to L2', cols, rows: V.l2 }]);
};
function verifyModal(r) {
  if (!r) return; const txCard = (t, title) => t ? `<div class="kv"><div>Date & time</div><div>${esc(fmtDT(t.ts, t.hasTime))}</div><div>Amount</div><div>${esc(inr(t.dr || t.cr))} ${t.dr ? 'Dr' : 'Cr'}</div><div>UTR / Ref</div><div class="mono">${esc(t.utr || t.ref || '—')}</div><div>Type</div><div>${esc(t.channel || '')}</div><div>Narration</div><div class="small">${esc(t.narr || '')}</div><div>Source</div><div class="small dim">${esc(t.src.file)} · row ${esc(t.src.row || '')}</div></div>` : `<div class="notice">${title} not found${title.includes('sender') && !(r.from && (IX.txByAcct.get(r.from.id) || []).length) ? ' — statement not uploaded' : title.includes('receiver') && !(r.to && (IX.txByAcct.get(r.to.id) || []).length) ? ' — statement not uploaded' : ''}.</div>`;
  const n = r.ncrp; const body = `<div class="grid g3" style="gap:10px">
    <div class="card"><h3>${n ? 'NCRP report' : 'Trail link'}</h3>${n ? `<div class="kv"><div>Ack No.</div><div>${esc(n.ackNo)}</div><div>Date</div><div>${esc(n.ts ? fmtDT(n.ts, n.hasTime) : '')}</div><div>UTR</div><div class="mono">${esc(n.utr)}</div><div>Amount</div><div>${esc(inr(n.disputed || n.amount))}</div><div>Layer 1 a/c</div><div class="mono">${esc(n.acctNo)}</div><div>Bank</div><div>${esc(n.bank)}</div><div>Action</div><div>${esc(n.status)}</div></div>` : `<div class="kv"><div>UTR</div><div class="mono">${esc(r.utr)}</div><div>Amount</div><div>${esc(inr(r.amt))}</div></div>`}</div>
    <div class="card"><h3>Sender statement · ${esc(r.from ? r.from.acctNo : r.fromNo || '')}</h3>${txCard(r.fTx, 'Debit in sender statement')}</div>
    <div class="card"><h3>Receiver statement · ${esc(r.to ? r.to.acctNo : r.toNo || '')}</h3>${txCard(r.tTx, 'Credit in receiver statement')}</div></div>
    <div class="card" style="margin-top:10px"><h3>Checks</h3>${r.checks.length ? r.checks.map(ch => `<div>${ch.ok ? '<b style="color:var(--green)">✓</b>' : '<b style="color:var(--red)">✗</b>'} ${esc(ch.name)} ${ch.why ? `<span class="dim small">— ${esc(ch.why)}</span>` : ''}</div>`).join('') : '<div class="dim">No statement uploaded yet for either side.</div>'}
      <label class="f" style="margin-top:10px">Note (reason for manual decision)<input id="vNote" value="${esc(r.man ? r.man.note : '')}" placeholder="e.g. bank confirmed by e-mail dated …"></label></div>`;
  const md = modal({ title: 'Review · ' + esc(r.utr || r.key) + ' · ' + badge(r.status, VST[r.status] || 'gray'), body, foot: `<button id="vClr">Clear manual decision</button><button class="btn-d" id="vBad">Mark NOT verified</button><button class="btn-green" id="vOk">✓ Mark verified</button>` });
  const set = async st => { const c = S.cur; c.work.verif = c.work.verif || {}; if (st) c.work.verif[r.key] = { status: st, note: $('#vNote', md.el).value.trim(), by: S.user.email, at: nowStamp() }; else delete c.work.verif[r.key]; markDirty('work'); await audit(st ? 'Manual verification: ' + st : 'Cleared manual verification', r.key + ' ' + (r.utr || '')); S.derived && (S.derived.intel = null); md.close(); go('verify'); };
  $('#vOk', md.el).onclick = () => set('VERIFIED (manual)'); $('#vBad', md.el).onclick = () => set('NOT VERIFIED (manual)'); $('#vClr', md.el).onclick = () => set(null);
}
