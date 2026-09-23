/* ------------------------------ TELECOM / CDR ------------------------------ */
let TEL_TAB = 'targets';
VIEWS.telecom = el => {
  const c = S.cur; const tel = T();
  el.innerHTML = pageHead('Telecom / CDR Intelligence', 'CDRs of account-linked (registered) and alternate numbers, plus investigation numbers. Hits are computed across every uploaded CDR.', `<button id="tlAdd">＋ Investigation number</button><button id="tlImp">⇪ Import CDR</button>`) +
    `<div class="grid g6" style="margin-bottom:12px">${kpi('Target CDRs', tel.targets.length)}${kpi('CDR events', nfmt(c.telecom.cdr.length))}${kpi('Direct hits', tel.direct.length, `${tel.direct.filter(x => x.complainant).length} with complainant`, 'rgba(248,113,113,.18)')}${kpi('Common contacts', tel.common.length)}${kpi('Shared IMEI', tel.sharedImei.length)}${kpi('CDR pending', tel.pendingCdr.length, 'linked numbers without CDR', 'rgba(251,191,36,.18)')}</div>
    <div class="tabs">${[['targets', 'Targets'], ['direct', 'Direct contact hits'], ['common', 'Common contacts'], ['imei', 'Shared IMEI'], ['coloc', 'Cell co-location'], ['matrix', 'Hit matrix']].map(([k, l]) => `<button class="${TEL_TAB === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div><div id="tlB"></div>`;
  $$('[data-tab]', el).forEach(b => b.onclick = () => { TEL_TAB = b.dataset.tab; go('telecom'); });
  $('#tlAdd', el).onclick = () => addNumberDialog(); $('#tlImp', el).onclick = () => { IMP.kind = 'cdr'; go('import'); };
  const B = $('#tlB', el); const numA = n => `<a href="#" data-num="${n}" class="mono">${n}</a>`;
  const linkTxt = n => { const i = IX.numInfo.get(n); return i ? i.links.map(l => (l.kind === 'Alternate number' ? 'ALT ' : l.kind === 'Registered mobile' ? 'REG ' : '') + (l.label || l.role || '')).join('; ') : ''; };
  if (TEL_TAB === 'targets') {
    B.innerHTML = simpleTable([{ label: 'Target', html: x => numA(x.num) }, { label: 'Linked to', get: x => linkTxt(x.num) || 'Not linked' }, { label: 'Events', k: 'n', num: 1 }, { label: 'In / Out', get: x => x.inc + ' / ' + x.out }, { label: 'Contacts', k: 'contacts', num: 1 }, { label: 'Cells', k: 'cells', num: 1 }, { label: 'IMEIs', get: x => x.imeis.join(', ') }, { label: 'First', get: x => fmtDT(x.first) }, { label: 'Last', get: x => fmtDT(x.last) }], tel.targets, { empty: 'No CDR imported yet.' }) +
      `<h3 style="margin-top:14px">Linked numbers without CDR (${tel.pendingCdr.length})</h3>` + simpleTable([{ label: 'Number', html: x => numA(x.num) }, { label: 'Linked to', get: x => x.links.map(l => l.kind + ': ' + l.label).join('; ') }], tel.pendingCdr, { empty: 'None.' });
  } else if (TEL_TAB === 'direct') {
    B.innerHTML = simpleTable([{ label: 'Number A', html: x => numA(x.a) + '<div class="small dim">' + esc(linkTxt(x.a)) + '</div>' }, { label: 'Number B', html: x => numA(x.b) + '<div class="small dim">' + esc(linkTxt(x.b)) + '</div>' }, { label: 'Events', k: 'n', num: 1 }, { label: 'SMS', k: 'sms', num: 1 }, { label: 'Duration', get: x => Math.round(x.dur / 60) + ' min', num: 1 }, { label: 'First', get: x => fmtDT(x.first) }, { label: 'Last', get: x => fmtDT(x.last) }, { label: '', html: x => x.complainant ? badge('COMPLAINANT', 'red') : '' }], tel.direct, { empty: 'No direct contact between known numbers.' });
  } else if (TEL_TAB === 'common') {
    B.innerHTML = simpleTable([{ label: 'Common number', html: x => numA(x.num) + (x.known ? ' ' + badge('KNOWN', 'amber') : '') }, { label: 'Seen in targets', html: x => x.targets.map(numA).join(', ') }, { label: '# targets', get: x => x.targets.length, num: 1 }, { label: 'Events', k: 'n', num: 1 }, { label: 'Linked to', get: x => linkTxt(x.num) }], tel.common.slice(0, 1000), { empty: 'No number appears in more than one target CDR.' });
  } else if (TEL_TAB === 'imei') {
    B.innerHTML = simpleTable([{ label: 'IMEI (14)', k: 'imei' }, { label: 'Numbers used in this handset', html: x => x.nums.map(n => numA(n) + ' <span class="small dim">' + esc(linkTxt(n)) + '</span>').join('<br>') }, { label: 'Source', get: x => x.src.join(', ') }], tel.sharedImei, { empty: 'No handset shared between numbers.' });
  } else if (TEL_TAB === 'coloc') {
    B.innerHTML = `<p class="small muted">CDR / cell-site correlation: two numbers served by the same cell within 15 minutes. A cell covers a wide area — this is not an exact location.</p>` + simpleTable([{ label: 'Number A', html: x => numA(x.a) }, { label: 'Number B', html: x => numA(x.b) }, { label: 'Cell ID', k: 'cell' }, { label: 'Site address (from CDR)', k: 'addr' }, { label: 'Times', k: 'n', num: 1 }, { label: 'First', get: x => fmtDT(x.first) }, { label: 'Last', get: x => fmtDT(x.last) }], tel.colocPairs.slice(0, 500), { empty: 'No co-location found.' });
  } else if (TEL_TAB === 'matrix') {
    const tg = tel.targets.slice(0, 40).map(x => x.num); const idx = new Map(tg.map((n, i) => [n, i])); const M = tg.map(() => tg.map(() => ({ d: 0, cm: 0 })));
    for (const x of tel.direct) if (idx.has(x.a) && idx.has(x.b)) { M[idx.get(x.a)][idx.get(x.b)].d += x.n; M[idx.get(x.b)][idx.get(x.a)].d += x.n; }
    for (const x of tel.common) for (let i = 0; i < x.targets.length; i++) for (let j = i + 1; j < x.targets.length; j++) if (idx.has(x.targets[i]) && idx.has(x.targets[j])) { M[idx.get(x.targets[i])][idx.get(x.targets[j])].cm++; M[idx.get(x.targets[j])][idx.get(x.targets[i])].cm++; }
    B.innerHTML = tg.length ? `<p class="small muted">Cell = direct events / common contacts between two target numbers (first 40 targets).</p><div class="tbl-wrap"><table class="tbl"><thead><tr><th></th>${tg.map(n => `<th style="writing-mode:vertical-rl">${n}</th>`).join('')}</tr></thead><tbody>${tg.map((n, i) => `<tr><td class="mono">${numA(n)}</td>${tg.map((m, j) => { const v = M[i][j]; const s = v.d * 3 + v.cm; return `<td class="center small" style="background:${i === j ? '#0a1324' : s ? `rgba(57,135,229,${Math.min(.85, .15 + s / 30)})` : ''}">${i === j ? '' : (v.d ? '<b>' + v.d + '</b>' : '') + (v.cm ? '<span class="dim">/' + v.cm + '</span>' : '')}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>` : emptyState('No CDR imported.');
  }
  $$('[data-num]', el).forEach(x => x.onclick = e => { e.preventDefault(); openNumber(x.dataset.num); });
};

/* ------------------------------ CORRELATION ------------------------------ */
VIEWS.correlation = el => {
  const c = S.cur; const d = D(); const w = c.work.settings.cdrWindowMin;
  const txs = uniq(d.seeds.map(s => s.id).concat(d.flows.map(f => f.debit)).concat(d.flows.map(f => f.credit).filter(Boolean))).map(id => IX.txById.get(id)).filter(Boolean).sort((a, b) => a.ts - b.ts);
  const rows = txs.map(t => ({ t, a: IX.acctById.get(t.acctId), k: txCorrelation(t, w) }));
  el.innerHTML = pageHead('Transaction Correlation Matrix', `Every disputed and traced transaction checked against CDR, SMS/OTP, bank login IP and IPDR inside ±${w} minutes. Strength reflects how many independent sources line up — it is an investigative lead, not proof.`, `<button id="crSet">⚙ Window</button><button id="crX">Export</button>`) + '<div id="crT"></div>';
  const cols = [{ label: 'Txn', w: 100, get: r => r.t.id }, { label: 'Date', w: 92, get: r => fmtDate(r.t.ts), sort: r => r.t.ts }, { label: 'Time', w: 70, get: r => r.t.hasTime ? fmtTime(r.t.ts) : 'n/a' }, { label: 'Amount', w: 115, num: 1, html: r => `<span class="${r.t.dr ? 'dr' : 'cr'}">${inr(r.t.dr || r.t.cr)}</span>`, sort: r => r.t.dr || r.t.cr, x: r => r.t.dr || r.t.cr },
    { label: 'Account', w: 150, get: r => r.a.acctNo }, { label: 'Layer', w: 90, get: r => layerName(acctLayer(r.a.id)) }, { label: 'UTR', w: 140, get: r => r.t.utr },
    { label: 'Linked numbers', w: 170, get: r => acctNumbers(r.a).join(', ') }, { label: 'Own calls', w: 80, num: 1, html: r => r.k.ownCalls.length ? `<b class="cr">${r.k.ownCalls.length}</b>` : '<span class="dim">0</span>', x: r => r.k.ownCalls.length },
    { label: 'Complainant calls', w: 110, num: 1, html: r => r.k.compCalls.length ? `<b class="dr">${r.k.compCalls.length}</b>` : '<span class="dim">0</span>', x: r => r.k.compCalls.length },
    { label: 'SMS/OTP', w: 80, html: r => r.k.sms.length ? (r.k.sms.some(s => s.otp) ? badge('OTP', 'amber') : r.k.sms.length) : '<span class="dim">—</span>', x: r => r.k.sms.length },
    { label: 'Login IP', w: 150, get: r => r.k.login ? r.k.login.ip : '' }, { label: 'IPDR → number', w: 130, get: r => r.k.login && r.k.login.ipdr ? r.k.login.ipdr.nums.join(', ') : '' },
    { label: 'IMEI', w: 130, get: r => r.k.imeis.join(', ') }, { label: 'Cell', w: 110, get: r => r.k.cells.join(', ') }, { label: 'Strength', w: 100, html: r => r.k.strength === '—' ? '<span class="dim">—</span>' : strengthBadge(r.k.strength), sort: r => r.k.score, x: r => r.k.strength }];
  const vt = vtable($('#crT', el), { cols, rows, height: 620, onClick: r => openTx(r.t.id) });
  $('#crX', el).onclick = () => exportTable('Correlation', cols, vt.rows()); $('#crSet', el).onclick = trailSettings;
};
