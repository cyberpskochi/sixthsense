/* ------------------------------ IFSC & ATM INTELLIGENCE ------------------------------ */
let GEO_TAB = 'analysis'; let GEO_MAP = null;
let KR_F = { k: 'all', d: '', b: '', q: '' }; let BR_F = { scope: 'kerala', kd: -1, bank: '', q: '' };
const distOf = i => (i && (i.kdist || i.district)) || '';
VIEWS.geo = async el => {
  if (!GEO.loaded) el.innerHTML = `<div class="empty" style="margin-top:60px"><div class="spin"></div>Loading bank & ATM reference data…</div>`;
  await GEO.ready();
  const ifs = caseIfscRows(); const atms = caseAtmRows();
  const withState = ifs.filter(r => r.info && r.info.state);
  const states = groupBy(withState, r => r.info.state), districts = groupBy(withState.filter(r => distOf(r.info)), r => distOf(r.info) + ', ' + r.info.state);
  const unresolved = ifs.filter(r => !r.info || r.info.partial).length;
  const atmLocated = atms.filter(a => a.info).length;
  el.innerHTML = pageHead('IFSC & ATM Map', 'Where the money went: branch, district and state for every IFSC in the case, and the location of every ATM used for cash-out.',
    `<button id="gLook" class="btn-p" ${unresolved ? '' : 'disabled'}>${unresolved ? `⌕ Look up ${unresolved} IFSC online` : '✓ All IFSC resolved'}</button><button id="gAtm">⇪ Import ATM database</button><button id="gIfsc">⇪ Import IFSC master</button>`) +
    `<div class="notice" style="margin-bottom:12px">🏦 Offline IFSC branch database: <b>${esc(IFSCDB.stats().text)}</b> — branch, address, district and state are looked up on this device; nothing is sent online. Codes not in it can be looked up online or added from an IFSC master file.</div>
    <div class="grid g6" style="margin-bottom:14px">
      ${kpi('States', nfmt(states.size), 'from resolved IFSC', 'rgba(0,229,255,.3)')}${kpi('Districts', nfmt(districts.size), '', 'rgba(179,136,255,.35)')}
      ${kpi('Unique IFSC', nfmt(ifs.length), unresolved ? unresolved + ' not yet looked up' : 'all resolved', 'rgba(41,121,255,.35)')}
      ${kpi('Banks', nfmt(uniq(ifs.map(r => (r.info || {}).bank).filter(Boolean)).length), '', 'rgba(255,179,0,.35)')}
      ${kpi('ATM cash-out', inrShort(sum(atms, a => a.amount)), nfmt(sum(atms, a => a.n)) + ' withdrawals', 'rgba(255,110,64,.35)')}
      ${kpi('ATMs located', `${atmLocated} / ${atms.length}`, GEO.atm.size ? nfmt(GEO.atm.size) + ' ATMs in database' + (GEO.refInfo ? ' (encrypted reference)' : '') : GEO.refErr ? 'ATM data: ' + esc(GEO.refErr) : 'ATM database not loaded', 'rgba(0,255,157,.3)')}
    </div>
    <div class="tabs" id="gTabs">${[['analysis', 'Analysis'], ['kerala', 'Kerala accounts'], ['branches', 'Kerala branch finder'], ['ifsc', 'IFSC table'], ['atm', 'ATM withdrawals'], ['map', 'Map']].map(([k, t]) => `<button class="${GEO_TAB === k ? 'on' : ''}" data-t="${k}">${t}</button>`).join('')}</div>
    <div id="gBody"></div>
    <p class="small dim" style="margin-top:10px">Online IFSC lookup sends only the 11-character IFSC code (a public bank-branch code) to the RBI-sourced IFSC service — never account numbers, names or amounts. The ATM database and IFSC master you import are stored encrypted on this computer and reused in every case.</p>`;
  $$('#gTabs button', el).forEach(b => b.onclick = () => { GEO_TAB = b.dataset.t; go('geo'); });
  $('#gAtm', el).onclick = () => { if (!S.cur) return; IMP.kind = 'atm'; go('import'); };
  $('#gIfsc', el).onclick = () => { if (!S.cur) return; IMP.kind = 'ifscdb'; go('import'); };
  $('#gLook', el).onclick = async () => {
    const codes = ifs.filter(r => !r.info || r.info.partial).map(r => r.ifsc); const b = $('#gLook', el); b.disabled = true;
    if (!await confirmBox('Look up IFSC online', `Only these <b>${codes.length}</b> IFSC codes (public branch codes) will be sent to the IFSC service to get branch, district and state. No account numbers, names or amounts are sent. Continue?`, 'Look up')) { b.disabled = false; return; }
    const r = await GEO.lookupOnline(codes, (d, t) => { b.textContent = `Looking up ${d}/${t}…`; });
    toast(`IFSC lookup: ${r.ok} found, ${r.bad} not valid, ${r.fail} failed` + (r.fail ? ' (offline or blocked — import the RBI IFSC list instead)' : ''), r.fail ? 'warn' : 'ok', 6000);
    audit('IFSC online lookup', `${r.total} codes: ${r.ok} ok, ${r.bad} invalid, ${r.fail} failed`); go('geo');
  };
  const body = $('#gBody', el);
  if (GEO_TAB === 'analysis') {
    const st = Array.from(states.entries()).map(([s, rs]) => ({ s, amt: sum(rs, r => r.amount + r.ncrpAmt), n: rs.length, accts: uniq(rs.flatMap(r => r.accts)).length })).sort((a, b) => b.amt - a.amt);
    const ds = Array.from(districts.entries()).map(([d, rs]) => ({ d, amt: sum(rs, r => r.amount + r.ncrpAmt), accts: uniq(rs.flatMap(r => r.accts)).length })).sort((a, b) => b.amt - a.amt);
    const bk = Array.from(groupBy(ifs, r => (r.info || {}).bank || r.ifsc.slice(0, 4)).entries()).map(([b, rs]) => ({ b, amt: sum(rs, r => r.amount + r.ncrpAmt), n: rs.length })).sort((a, b) => b.amt - a.amt);
    body.innerHTML = `<div class="grid g2"><div class="card"><h3>State-wise amount</h3>${st.length ? '<div style="height:320px"><canvas id="cSt"></canvas></div>' : emptyState('No states yet. Click “Look up IFSC online” or import the IFSC master list.')}</div>
      <div class="card"><h3>Top districts</h3>${simpleTable([{ label: 'District', k: 'd' }, { label: 'Accounts', k: 'accts', num: 1 }, { label: 'Amount', html: r => inr(r.amt), num: 1 }], ds.slice(0, 30), { maxH: 320, empty: 'No districts yet.' })}</div></div>
      <div class="grid g2" style="margin-top:14px"><div class="card"><h3>Bank-wise amount</h3><div style="height:300px"><canvas id="cBk"></canvas></div></div>
      <div class="card"><h3>Top ATM cash-out locations</h3>${simpleTable([{ label: 'ATM', get: a => a.atmId || '—' }, { label: 'Location', get: a => a.info ? [a.info.city || a.info.district, a.info.state].filter(Boolean).join(', ') : (a.place || 'Not in ATM database') }, { label: 'Withdrawals', k: 'n', num: 1 }, { label: 'Amount', html: a => inr(a.amount), num: 1 }], atms.slice(0, 15), { maxH: 300, empty: 'No ATM withdrawals in this case.' })}</div></div>`;
    if (st.length) CHARTS.push(mkChart($('#cSt', body), { type: 'bar', data: { labels: st.slice(0, 15).map(x => x.s), datasets: [{ label: 'Amount', data: st.slice(0, 15).map(x => x.amt), backgroundColor: '#00e5ff' }] }, options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { callback: v => inrShort(v) } } } } }));
    CHARTS.push(mkChart($('#cBk', body), { type: 'bar', data: { labels: bk.slice(0, 12).map(x => x.b.slice(0, 22)), datasets: [{ label: 'Amount', data: bk.slice(0, 12).map(x => x.amt), backgroundColor: '#b388ff' }] }, options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { callback: v => inrShort(v) } } } } }));
  } else if (GEO_TAB === 'kerala') {
    const all = caseAccountGeoRows(); const kr = all.filter(r => r.kr.is === true), outs = all.filter(r => r.kr.is === false), unk = all.filter(r => r.kr.is == null);
    const dRows = Array.from(groupBy(kr, r => r.kdistrict).entries()).map(([d, rs]) => ({ d, accts: rs.length, banks: uniq(rs.map(r => r.bank).filter(Boolean)).length, amt: sum(rs, r => r.amount) })).sort((a, b) => b.accts - a.accts || b.amt - a.amt);
    const bRows = Array.from(groupBy(kr, r => r.bank || 'Unknown bank').entries()).map(([b, rs]) => ({ b, accts: rs.length, dists: uniq(rs.map(r => r.kdistrict).filter(Boolean)).length, amt: sum(rs, r => r.amount) })).sort((a, b) => b.accts - a.accts || b.amt - a.amt);
    const dNames = dRows.map(x => x.d);
    body.innerHTML = `<div class="grid g6" style="margin-bottom:14px">
      ${kpi('Kerala accounts', nfmt(kr.length), 'of ' + nfmt(all.length) + ' accounts in the case', 'rgba(0,255,157,.35)')}${kpi('Money into Kerala accounts', inrShort(sum(kr, r => r.amount)), '', 'rgba(0,229,255,.3)')}
      ${kpi('Outside Kerala', nfmt(outs.length), inrShort(sum(outs, r => r.amount)), 'rgba(179,136,255,.35)')}${kpi('Not resolved', nfmt(unk.length), unk.filter(r => !r.ifsc).length ? unk.filter(r => !r.ifsc).length + ' without IFSC' : 'IFSC not in database', 'rgba(255,179,0,.35)')}
      ${kpi('Kerala districts', nfmt(dRows.filter(x => x.d !== 'Kerala (district not resolved)').length) + ' / 14', '', 'rgba(41,121,255,.35)')}${kpi('Kerala banks', nfmt(bRows.length), '', 'rgba(255,110,64,.35)')}</div>
    <div class="grid g2"><div class="card"><div class="row sb"><h3>District-wise (Kerala accounts)</h3><button id="kXd" class="btn-sm">Export</button></div><div id="kD"></div></div>
    <div class="card"><div class="row sb"><h3>Bank-wise (Kerala accounts)</h3><button id="kXb" class="btn-sm">Export</button></div><div id="kB"></div></div></div>
    <div class="card" style="margin-top:14px"><div class="row sb"><h3>Bank × District matrix <span class="small dim">(Kerala accounts)</span></h3><button id="kXm" class="btn-sm">Export</button></div><div id="kM"></div></div>
    <div class="card" style="margin-top:14px"><div class="row sb" style="gap:8px;flex-wrap:wrap"><h3>Account list — bank statement wise</h3>
      <div class="row" style="gap:8px;flex-wrap:wrap"><select id="kK"><option value="all">All accounts</option><option value="Kerala">Kerala only</option><option value="Outside Kerala">Outside Kerala</option><option value="unres">Not resolved / no IFSC</option></select>
      <select id="kDs"><option value="">All districts</option>${KERALA_DISTRICTS.map(x => `<option>${x}</option>`).join('')}</select>
      <input id="kQ" placeholder="Filter account / holder / bank / IFSC / branch…" style="width:260px"><button id="kX" class="btn-sm">Export</button></div></div>
      <div id="kL" style="margin-top:10px"></div></div>
    <p class="small dim" style="margin-top:8px">“Kerala” means the account's IFSC branch is in Kerala, taken from the offline IFSC database (district checked against the branch address and PIN code). Click a district or bank above to filter the list. Accounts without an IFSC cannot be placed — add the IFSC from the bank reply or NCRP data.</p>`;
    const dCols = [{ label: 'District', k: 'd' }, { label: 'Accounts', k: 'accts', num: 1 }, { label: 'Banks', k: 'banks', num: 1 }, { label: 'Amount in', html: r => inr(r.amt), num: 1, x: r => r.amt }];
    const bCols = [{ label: 'Bank', k: 'b' }, { label: 'Accounts', k: 'accts', num: 1 }, { label: 'Districts', k: 'dists', num: 1 }, { label: 'Amount in', html: r => inr(r.amt), num: 1, x: r => r.amt }];
    $('#kD', body).innerHTML = simpleTable(dCols, dRows, { maxH: 320, click: 1, empty: 'No Kerala accounts identified yet. Upload statements / NCRP data with IFSC codes.' }); bindRows($('#kD', body), dRows, r => { KR_F.d = r.d.startsWith('Kerala (') ? '' : r.d; KR_F.k = 'Kerala'; KR_F.b = ''; syncK(); });
    $('#kB', body).innerHTML = simpleTable(bCols, bRows, { maxH: 320, click: 1, empty: 'No Kerala accounts identified yet.' }); bindRows($('#kB', body), bRows, r => { KR_F.b = r.b; KR_F.k = 'Kerala'; KR_F.d = ''; syncK(); });
    const topB = bRows.slice(0, 25).map(x => x.b); const cell = (b, d) => kr.filter(r => (r.bank || 'Unknown bank') === b && r.kdistrict === d).length;
    const mCols = [{ label: 'Bank', get: r => r.b }].concat(dNames.map(d => ({ label: d, get: r => r.cells[d] || '', num: 1 })), [{ label: 'Total', get: r => r.t, num: 1 }]);
    const mRows = topB.map(b => ({ b, cells: Object.fromEntries(dNames.map(d => [d, cell(b, d)])), t: bRows.find(x => x.b === b).accts }));
    $('#kM', body).innerHTML = mRows.length ? `<div class="tbl-wrap" style="max-height:380px"><table class="tbl"><thead><tr><th>Bank</th>${dNames.map(d => `<th class="num">${esc(d.replace('Kerala (district not resolved)', 'District n/r'))}</th>`).join('')}<th class="num">Total</th></tr></thead><tbody>${mRows.map(r => `<tr><td>${esc(r.b)}</td>${dNames.map(d => `<td class="num" style="${r.cells[d] ? 'background:rgba(0,229,255,.14);font-weight:600' : 'opacity:.35'}">${r.cells[d] || '·'}</td>`).join('')}<td class="num"><b>${r.t}</b></td></tr>`).join('')}</tbody></table></div>${bRows.length > 25 ? `<div class="small dim">Top 25 banks shown; the export has all.</div>` : ''}` : emptyState('No Kerala accounts to tabulate yet.');
    $('#kXd', body).onclick = () => exportTable('Kerala district-wise', dCols, dRows); $('#kXb', body).onclick = () => exportTable('Kerala bank-wise', bCols, bRows);
    $('#kXm', body).onclick = () => exportTable('Kerala bank x district', mCols, bRows.map(b => ({ b: b.b, cells: Object.fromEntries(dNames.map(d => [d, cell(b.b, d)])), t: b.accts })));
    const lCols = [{ label: 'Account no.', html: r => `<span class="mono">${esc(r.acctNo)}</span>`, x: r => r.acctNo }, { label: 'Holder', k: 'holder' }, { label: 'Bank', k: 'bank' }, { label: 'IFSC', html: r => `<span class="mono">${esc(r.ifsc)}</span>`, x: r => r.ifsc }, { label: 'Branch', k: 'branch' },
      { label: 'District', get: r => r.kdistrict || (r.info && r.info.district) || '' }, { label: 'State', k: 'state' }, { label: 'Where', html: r => r.kr.is === true ? badge('Kerala', 'green') : r.kr.is === false ? badge('Outside Kerala', 'gray') : badge(r.kerala, 'amber'), x: r => r.kerala },
      { label: 'Layer', get: r => r.layer == null ? '' : 'L' + r.layer }, { label: 'Money in', html: r => inr(r.amount), num: 1, x: r => r.amount }, { label: 'Statement', get: r => r.stmt ? 'Uploaded' : 'Not uploaded' }];
    let cur = [];
    const drawL = () => { const q = KR_F.q.toLowerCase(); cur = all.filter(r => (KR_F.k === 'all' || (KR_F.k === 'unres' ? r.kr.is == null : r.kerala === KR_F.k)) && (!KR_F.d || r.kdistrict === KR_F.d) && (!KR_F.b || (r.bank || 'Unknown bank') === KR_F.b) && (!q || [r.acctNo, r.holder, r.bank, r.ifsc, r.branch, r.kdistrict].join(' ').toLowerCase().includes(q)));
      $('#kL', body).innerHTML = `<div class="small dim" style="margin-bottom:6px">${nfmt(cur.length)} account(s)${KR_F.b ? ' · bank: ' + esc(KR_F.b) : ''}${KR_F.d ? ' · district: ' + esc(KR_F.d) : ''}${(KR_F.b || KR_F.d) ? ' <a href="#" id="kClr">clear</a>' : ''}</div>` + simpleTable(lCols, cur, { maxH: 520, empty: 'No accounts match.' }); const c = $('#kClr', body); if (c) c.onclick = e => { e.preventDefault(); KR_F.b = ''; KR_F.d = ''; syncK(); }; };
    const syncK = () => { $('#kK', body).value = KR_F.k; $('#kDs', body).value = KR_F.d; $('#kQ', body).value = KR_F.q; drawL(); };
    $('#kK', body).onchange = e => { KR_F.k = e.target.value; drawL(); }; $('#kDs', body).onchange = e => { KR_F.d = e.target.value; KR_F.k = e.target.value ? 'Kerala' : KR_F.k; syncK(); }; $('#kQ', body).oninput = e => { KR_F.q = e.target.value; drawL(); };
    $('#kX', body).onclick = () => exportTable('Accounts by bank and district', lCols, cur); syncK();
  } else if (GEO_TAB === 'branches') {
    if (!IFSCDB.doc) { body.innerHTML = `<div class="card">${emptyState(IFSCDB.err ? 'IFSC database could not be loaded: ' + esc(IFSCDB.err) : '<div class="spin"></div>The IFSC database is still loading — try again in a few seconds.', '<button id="bRe" class="btn-p">Reload</button>')}</div>`; $('#bRe', body).onclick = () => { IFSCDB.loading = null; IFSCDB.load().then(() => go('geo')); }; return; }
    const kb = IFSCDB.kerala(); const bn = p => IFSCDB.bankName(p) || IFSC_PREFIX[p] || p;
    const tot = a => a.reduce((x, y) => x + y, 0); const kBanks = Array.from(kb.cnt.entries()).map(([p, a]) => ({ p, name: bn(p), a, t: tot(a) })).sort((x, y) => y.t - x.t);
    body.innerHTML = `<div class="notice" style="margin-bottom:12px">Find any branch by IFSC, bank, branch name, address, MICR or PIN. <b>${nfmt(kb.list.length)}</b> Kerala branches are indexed district-wise (14 districts) and bank-wise; the whole India list is searchable too. Works offline.</div>
    <div class="card"><div class="row" style="gap:8px;flex-wrap:wrap"><select id="bS"><option value="kerala">Kerala branches</option><option value="all">All India</option></select>
      <select id="bD"><option value="-1">All districts</option>${KERALA_DISTRICTS.map((x, i) => `<option value="${i}">${x}</option>`).join('')}</select>
      <select id="bB"></select><input id="bQ" placeholder="IFSC / branch / address / MICR / PIN…" style="flex:1;min-width:220px"><button id="bGo" class="btn-p">⌕ Search</button><button id="bX" class="btn-sm">Export all matches</button></div>
      <div id="bR" style="margin-top:10px"></div></div>
    <div class="card" style="margin-top:14px"><div class="row sb"><h3>Kerala branches — bank × district</h3><button id="bXm" class="btn-sm">Export</button></div><div class="small dim" style="margin-bottom:6px">Click a number to list those branches.</div>
      <div class="tbl-wrap" style="max-height:460px"><table class="tbl"><thead><tr><th>Bank</th>${KERALA_DISTRICTS.map(d => `<th class="num">${d.slice(0, 5)}.</th>`).join('')}<th class="num">Total</th></tr></thead><tbody>
      ${kBanks.map(b => `<tr><td>${esc(b.name)}</td>${b.a.map((n, i) => `<td class="num click-cell" data-p="${b.p}" data-d="${i}" style="${n ? 'cursor:pointer;background:rgba(0,229,255,.14)' : 'opacity:.35'}">${n || '·'}</td>`).join('')}<td class="num click-cell" data-p="${b.p}" data-d="-1" style="cursor:pointer"><b>${b.t}</b></td></tr>`).join('')}
      <tr><td><b>All banks</b></td>${KERALA_DISTRICTS.map((d, i) => `<td class="num click-cell" data-p="" data-d="${i}" style="cursor:pointer"><b>${tot(kBanks.map(b => b.a[i]))}</b></td>`).join('')}<td class="num"><b>${kb.list.length}</b></td></tr></tbody></table></div></div>`;
    const fillBanks = () => { const k = $('#bS', body).value === 'kerala'; const opts = k ? kBanks.map(b => [b.p, `${b.name} (${b.t})`]) : Object.entries(IFSCDB.doc.banks).map(([p, n]) => [p, n]).sort((a, b) => a[1].localeCompare(b[1])); $('#bB', body).innerHTML = '<option value="">All banks</option>' + opts.map(([p, n]) => `<option value="${esc(p)}">${esc(n)}</option>`).join(''); $('#bB', body).value = BR_F.bank; if ($('#bB', body).value !== BR_F.bank) { BR_F.bank = ''; $('#bB', body).value = ''; } };
    const svc = r => r.flags ? [r.flags.neft && 'NEFT', r.flags.imps && 'IMPS', r.flags.rtgs && 'RTGS', r.flags.upi && 'UPI'].filter(Boolean).join(' · ') : '';
    const mapA = r => `<a class="btn-sm" target="_blank" rel="noopener noreferrer" href="${gmapsUrl([r.bank, r.branch, r.address].filter(Boolean).join(' '))}">⌖ Map</a>`;
    const bCols = [{ label: 'IFSC', html: r => `<span class="mono">${esc(r.ifsc)}</span>`, x: r => r.ifsc }, { label: 'Bank', html: r => `<b>${esc(r.bank)}</b>`, x: r => r.bank }, { label: 'Branch', k: 'branch' }, { label: 'District · State', get: r => [distOf(r), r.state].filter(Boolean).join(' · ') }, { label: 'Address', k: 'address' }, { label: 'MICR', k: 'micr' }, { label: 'Contact', k: 'contact' }, { label: 'Services', get: svc }, { label: '', html: mapA, x: () => '' }];
    const bExp = [bCols[0], bCols[1], bCols[2], { label: 'District', get: r => distOf(r) }, { label: 'State', k: 'state' }, bCols[4], { label: 'City', k: 'city' }, bCols[5], bCols[6], bCols[7], { label: 'SWIFT', k: 'swift' }];
    let last = null;
    const run = () => { BR_F.scope = $('#bS', body).value; BR_F.kd = +$('#bD', body).value; BR_F.bank = $('#bB', body).value; BR_F.q = $('#bQ', body).value.trim(); const kerala = BR_F.scope === 'kerala';
      if (!kerala && !BR_F.q && !BR_F.bank) { $('#bR', body).innerHTML = emptyState('For All India, type at least 3 characters or pick a bank.'); last = null; return; }
      if (BR_F.q && BR_F.q.length < 3 && !kerala) return toast('Type at least 3 characters', 'warn');
      last = IFSCDB.find({ kerala, kd: kerala ? BR_F.kd : -1, bank: BR_F.bank, q: BR_F.q }); const exact = /^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(BR_F.q) && last.rows.length === 0 ? IFSCDB.get(BR_F.q.toUpperCase()) : null; if (exact) last = { rows: [exact], total: 1 };
      $('#bR', body).innerHTML = `<div class="small dim" style="margin-bottom:6px">${nfmt(last.total)} branch(es) found${last.total > 500 ? ' — first 500 shown, use Export for all' : ''}</div>` + simpleTable(bCols, last.rows, { maxH: 520, empty: 'No branch found.' }); };
    $('#bS', body).value = BR_F.scope; $('#bD', body).value = String(BR_F.kd); $('#bQ', body).value = BR_F.q; fillBanks();
    $('#bS', body).onchange = () => { BR_F.bank = ''; fillBanks(); run(); }; $('#bD', body).onchange = run; $('#bB', body).onchange = run; $('#bGo', body).onclick = run; $('#bQ', body).onkeydown = e => { if (e.key === 'Enter') run(); };
    $('#bX', body).onclick = () => { if (!last) return toast('Search first', 'warn'); const all = IFSCDB.find({ kerala: BR_F.scope === 'kerala', kd: BR_F.scope === 'kerala' ? BR_F.kd : -1, bank: BR_F.bank, q: BR_F.q, limit: 1e9 }); exportTable('IFSC branches', bExp, all.rows); };
    $$('.click-cell', body).forEach(td => td.onclick = () => { BR_F.scope = 'kerala'; BR_F.bank = td.dataset.p; BR_F.kd = +td.dataset.d; BR_F.q = ''; $('#bS', body).value = 'kerala'; $('#bD', body).value = String(BR_F.kd); $('#bQ', body).value = ''; fillBanks(); run(); $('#bR', body).scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    $('#bXm', body).onclick = () => exportTable('Kerala bank x district branches', [{ label: 'Bank', get: r => r.name }].concat(KERALA_DISTRICTS.map((d, i) => ({ label: d, get: r => r.a[i], num: 1 })), [{ label: 'Total', get: r => r.t, num: 1 }]), kBanks);
    if (BR_F.q || BR_F.bank || BR_F.kd >= 0) run();
  } else if (GEO_TAB === 'ifsc') {
    const cols = [{ label: 'IFSC', html: r => `<span class="mono">${esc(r.ifsc)}</span>`, x: r => r.ifsc }, { label: 'Bank', get: r => (r.info || {}).bank || '' }, { label: 'Branch', get: r => (r.info || {}).branch || '' }, { label: 'District', get: r => distOf(r.info) }, { label: 'State', get: r => (r.info || {}).state || '' }, { label: 'Kerala?', html: r => { const k = keralaOf(r.info); return k.is === true ? badge('Kerala', 'green') : k.is === false ? badge('Outside', 'gray') : badge('Unknown', 'amber'); }, x: r => { const k = keralaOf(r.info); return k.is === true ? 'Kerala' : k.is === false ? 'Outside Kerala' : 'Unknown'; } },
      { label: 'Accounts', get: r => r.accts.slice(0, 4).join(', ') + (r.accts.length > 4 ? ' +' + (r.accts.length - 4) : '') }, { label: 'Layers', get: r => r.layers.join(', ') }, { label: 'Amount', html: r => inr(r.amount + r.ncrpAmt), num: 1, x: r => r.amount + r.ncrpAmt }, { label: 'Hold', html: r => r.hold ? inr(r.hold) : '', num: 1, x: r => r.hold },
      { label: 'Status', html: r => r.info && r.info.invalid ? badge('Invalid IFSC', 'red') : r.info && r.info.partial ? badge('Bank only', 'amber') : badge((r.info || {}).src === 'master' ? 'IFSC list' : 'Looked up', 'green'), x: r => r.info && r.info.invalid ? 'Invalid' : r.info && r.info.partial ? 'Bank only' : 'Resolved' },
      { label: '', html: r => `<a class="btn-sm" target="_blank" rel="noopener noreferrer" href="${googleUrl('IFSC ' + r.ifsc)}">Google</a> <a class="btn-sm" target="_blank" rel="noopener noreferrer" href="${gmapsUrl([(r.info || {}).bank, (r.info || {}).branch || r.ifsc, (r.info || {}).city].filter(Boolean).join(' '))}">⌖ Map</a>` }];
    body.innerHTML = `<div class="card"><div class="row sb"><input id="gQ" placeholder="Filter IFSC / bank / district / state…" style="width:320px"><button id="gX">Export</button></div><div id="gT" style="margin-top:10px"></div></div>`;
    const draw = () => { const q = $('#gQ', body).value.toLowerCase(); const rs = ifs.filter(r => !q || (r.ifsc + ' ' + JSON.stringify(r.info || {}) + r.accts.join(' ')).toLowerCase().includes(q)).sort((a, b) => (b.amount + b.ncrpAmt) - (a.amount + a.ncrpAmt)); $('#gT', body).innerHTML = simpleTable(cols, rs, { maxH: 560, empty: 'No IFSC codes found in this case yet.' }); };
    $('#gQ', body).oninput = draw; draw(); $('#gX', body).onclick = () => exportTable('IFSC intelligence', cols, ifs);
  } else if (GEO_TAB === 'atm') {
    const cols = [{ label: 'ATM ID', html: a => a.atmId ? `<span class="mono">${esc(a.atmId)}</span>` : '<span class="dim">not in narration</span>', x: a => a.atmId }, { label: 'Bank', get: a => (a.info || {}).bank || '' },
      { label: 'Address / place', get: a => a.info ? [a.info.address, a.info.city].filter(Boolean).join(', ') : a.place }, { label: 'District', get: a => (a.info || {}).district || '' }, { label: 'State', get: a => (a.info || {}).state || '' },
      { label: 'Withdrawals', k: 'n', num: 1 }, { label: 'Amount', html: a => inr(a.amount), num: 1, x: a => a.amount }, { label: 'From accounts', get: a => a.accts.join(', ') }, { label: 'First – last', get: a => a.first ? fmtDT(a.first) + ' – ' + fmtDT(a.last) : '' },
      { label: 'Status', html: a => a.info ? badge(a.info.lat != null ? 'Located (map)' : 'In ATM database', 'green') : a.atmId ? badge('Not in database', 'amber') : badge('ID unknown', 'gray'), x: a => a.info ? 'Located' : 'Not found' },
      { label: '', html: a => `${a.atmId ? `<a class="btn-sm" target="_blank" rel="noopener noreferrer" href="${googleUrl('ATM ID ' + a.atmId + (a.place ? ' ' + a.place : ''))}">Google</a> ` : ''}<a class="btn-sm" target="_blank" rel="noopener noreferrer" href="${gmapsUrl(a.info ? [a.info.bank, 'ATM', a.info.address, a.info.city, a.info.state].filter(Boolean).join(' ') : (a.place || 'ATM ' + a.atmId), a.info && a.info.lat, a.info && a.info.lon)}">⌖ Map</a>` }];
    body.innerHTML = `<div class="card" style="margin-bottom:14px"><h3>Search ATM database <span class="small dim">(${nfmt(GEO.atm.size)} ATMs)</span></h3>
      <div class="row"><input id="aQ" placeholder="ATM / terminal ID (e.g. S1BW015656190), PIN code, place or bank…" style="flex:1"><button id="aGo" class="btn-p">⌕ Search</button></div><div id="aRes" style="margin-top:10px"></div></div>
      <div class="card"><div class="row sb"><span class="small dim">ATM IDs come from the NCRP report (ATM ID / place columns) and from ATM withdrawal narrations in statements, and are matched with the UCN or terminal ID in your ATM database.</span><button id="gX">Export</button></div><div style="margin-top:10px">${simpleTable(cols, atms, { maxH: 560, empty: 'No ATM withdrawals in this case.' })}</div></div>`;
    $('#gX', body).onclick = () => exportTable('ATM withdrawals', cols, atms);
    const search = () => {
      const q = $('#aQ', body).value.trim().toUpperCase(); if (q.length < 3) return toast('Type at least 3 characters', 'warn');
      if (!GEO.atm.size) { $('#aRes', body).innerHTML = emptyState('ATM database not imported yet — click “Import ATM database”.'); return; }
      const exact = GEO.atmInfo(q); const out = exact ? [exact] : []; const qs = q.replace(/\s+/g, ' ');
      if (!exact) for (const r of GEO.atm.values()) { if ((r.atmId + ' ' + r.term + ' ' + r.cbs + ' ' + r.pincode + ' ' + r.bank + ' ' + r.address + ' ' + r.city + ' ' + r.state).toUpperCase().includes(qs)) { out.push(r); if (out.length >= 100) break; } }
      $('#aRes', body).innerHTML = simpleTable([{ label: 'UCN / ATM ID', html: r => `<span class="mono">${esc(r.atmId)}</span>` }, { label: 'Terminal ID', html: r => `<span class="mono">${esc([r.term, r.cbs].filter(Boolean).join(' / '))}</span>` }, { label: 'Bank', k: 'bank' }, { label: 'Address', k: 'address' }, { label: 'Post office', k: 'city' }, { label: 'PIN', k: 'pincode' }, { label: 'State', k: 'state' },
        { label: '', html: r => `<a class="btn-sm" target="_blank" rel="noopener noreferrer" href="${gmapsUrl([r.bank, 'ATM', r.address, r.city, r.pincode].filter(Boolean).join(' '), r.lat, r.lon)}">⌖ Map</a>` }], out, { maxH: 360, empty: 'No ATM found for “' + esc(q) + '”.' }) + (out.length >= 100 ? '<div class="small dim">First 100 matches shown — refine the search.</div>' : '');
    };
    $('#aGo', body).onclick = search; $('#aQ', body).onkeydown = e => { if (e.key === 'Enter') search(); };
  } else {
    const pts = atms.filter(a => a.info && a.info.lat != null);
    const tilesOn = !!S.prefs.mapTiles;
    body.innerHTML = `<div class="card"><div class="row sb" style="margin-bottom:8px"><span class="small">${pts.length} ATM location(s) with coordinates${atms.length - pts.length ? ` · ${atms.length - pts.length} without coordinates (use the ⌖ Map links in the ATM tab)` : ''}</span>
      <label class="row small"><input type="checkbox" id="gTiles" ${tilesOn ? 'checked' : ''}> Show street map (loads map pictures from OpenStreetMap — only the map area is requested, no case data)</label></div>
      <div id="gMap" class="geo-map"></div></div>`;
    $('#gTiles', body).onchange = async e => { S.prefs.mapTiles = e.target.checked; await savePrefs(); go('geo'); };
    if (typeof L === 'undefined') { $('#gMap', body).innerHTML = emptyState('Map library not loaded.'); return; }
    if (GEO_MAP) { try { GEO_MAP.remove(); } catch {} GEO_MAP = null; }
    const map = GEO_MAP = geoBaseMap($('#gMap', body), tilesOn);
    const mx = Math.max(1, ...pts.map(p => p.amount)); const b = [];
    for (const p of pts) {
      const r = 6 + 16 * Math.sqrt(p.amount / mx); const ll = [p.info.lat, p.info.lon]; b.push(ll);
      L.circleMarker(ll, { radius: r, color: '#ff6e40', weight: 2, fillColor: '#ff6e40', fillOpacity: .45 }).addTo(map)
        .bindPopup(`<b>ATM ${esc(p.atmId)}</b><br>${esc([p.info.bank, p.info.address, p.info.city, p.info.state].filter(Boolean).join(', '))}<br>${p.n} withdrawal(s) · <b>${esc(inr(p.amount))}</b><br>${esc(p.accts.join(', '))}<br><a target="_blank" rel="noopener noreferrer" href="${gmapsUrl('', p.info.lat, p.info.lon)}">Open in Google Maps</a>`);
    }
    if (b.length) map.fitBounds(b, { padding: [30, 30], maxZoom: 13 });
    setTimeout(() => map.invalidateSize(), 150);
  }
};

/* Shared India base map: OpenStreetMap tiles when the officer allows it, otherwise an offline lat/long grid with reference cities. */
function geoBaseMap(host, tilesOn) {
  const map = L.map(host, { zoomControl: true, attributionControl: true, preferCanvas: true }).setView([22.5, 80], 5);
  if (tilesOn) L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap contributors' }).addTo(map);
  else {
    for (let la = 6; la <= 38; la += 2) L.polyline([[la, 66], [la, 98]], { color: '#1d3a5c', weight: 1, interactive: false }).addTo(map);
    for (let lo = 66; lo <= 98; lo += 2) L.polyline([[6, lo], [38, lo]], { color: '#1d3a5c', weight: 1, interactive: false }).addTo(map);
    for (const [n, la, lo] of [['Delhi', 28.61, 77.21], ['Mumbai', 19.08, 72.88], ['Kolkata', 22.57, 88.36], ['Chennai', 13.08, 80.27], ['Bengaluru', 12.97, 77.59], ['Hyderabad', 17.39, 78.49], ['Kochi', 9.93, 76.27], ['Patna', 25.59, 85.14], ['Jaipur', 26.91, 75.79], ['Lucknow', 26.85, 80.95], ['Ranchi', 23.34, 85.31], ['Guwahati', 26.14, 91.74], ['Ahmedabad', 23.02, 72.57]])
      L.circleMarker([la, lo], { radius: 3, color: '#5f7599', fillColor: '#5f7599', fillOpacity: 1, weight: 1, interactive: false }).addTo(map).bindTooltip(n, { permanent: true, direction: 'right', className: 'geo-city', offset: [4, 0] });
  }
  return map;
}
const kmBetween = (a, b) => { const R = 6371, r = x => x * Math.PI / 180; const dLa = r(b.lat - a.lat), dLo = r(b.lon - a.lon); const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
/* NCRP trail accounts placed by the IFSC of their branch (PIN / district centroid — approximate). */
function ncrpGeoPoints(m) {
  const out = [];
  for (const n of m.N.values()) { if (n.exit || n.unknown || !n.ifsc) continue; const g = GEO.loc(n.ifsc); if (!g) continue; out.push({ n, lat: g.lat, lon: g.lon, acc: g.acc, info: n.info || GEO.info(n.ifsc) }); }
  return out;
}
/* Groups of 2+ trail accounts (Layer 1 and deeper) whose branches are within `km` of each other (single-link). */
function ncrpGeoClusters(m, km = 10) {
  // wallets / PG / collection accounts are central, not local — left out of the 10 km grouping
  const PG = /razorpay|paytm|phonepe|amazon|cashfree|payu|billdesk|wallet|payments?\s*services|^others?$/i;
  const pts = ncrpGeoPoints(m).filter(p => (p.n.layer ?? 1) >= 1 && /^\d+$/.test(p.n.id) && !PG.test(p.n.bank || '')); const par = pts.map((_, i) => i); const f = i => par[i] === i ? i : (par[i] = f(par[i]));
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) if (kmBetween(pts[i], pts[j]) <= km) par[f(i)] = f(j);
  const g = groupBy(pts.map((p, i) => [f(i), p]), x => x[0]); const out = [];
  for (const arr of g.values()) { if (arr.length < 2) continue; const ps = arr.map(x => x[1]); const lat = sum(ps, p => p.lat) / ps.length, lon = sum(ps, p => p.lon) / ps.length;
    const place = uniq(ps.map(p => p.info && (p.info.city || p.info.district)).filter(Boolean)).slice(0, 3).join(' / ') || uniq(ps.map(p => p.info && p.info.state).filter(Boolean)).join(', ');
    let maxKm = 0; for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) maxKm = Math.max(maxKm, kmBetween(ps[i], ps[j]));
    out.push({ pts: ps, lat, lon, place, state: uniq(ps.map(p => p.info && p.info.state).filter(Boolean)).join(', '), layers: uniq(ps.map(p => p.n.layer)).sort((a, b) => a - b), amt: sum(ps, p => p.n.in), hold: sum(ps, p => p.n.hold), maxKm: round2(maxKm) }); }
  return out.sort((a, b) => b.pts.length - a.pts.length || b.amt - a.amt);
}
