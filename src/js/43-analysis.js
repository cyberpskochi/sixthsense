/* ============================ ANALYSIS PAGES ============================
   CDR & Location Analysis · Dormant & Freeze Checks · Entities / UPI / POS            */
function psHtml(l, plain) {
  if (!l) return plain ? '' : '<span class="dim">—</span>';
  const near = l.lat != null ? GEO.nearestPs(l.lat, l.lon, 1) : GEO.psByText(l.addr, 1);
  if (near.length) { const p = near[0]; return plain ? `${p.name}${p.km != null ? ' (' + p.km + ' km)' : ''} ${p.phone || ''}` : `<b>${esc(p.name)}</b>${p.km != null ? ` <span class="dim">${p.km} km</span>` : ''}${p.phone ? `<div class="mono small">☎ ${esc(p.phone)}</div>` : ''}`; }
  const q = 'police station near ' + (l.addr || (l.lat != null ? l.lat + ',' + l.lon : 'cell ' + l.cell));
  return plain ? '' : `<a class="btn-sm" target="_blank" rel="noopener noreferrer" href="${l.lat != null ? `https://www.google.com/maps/search/police+station/@${l.lat},${l.lon},14z` : gmapsUrl(q)}">🚓 Nearby PS</a>`;
}
const locHtml = l => l ? `<div><b class="mono">${esc(l.num)}</b> ${esc(locLabel(l))}</div><div class="small dim">±${l.dt} min${l.imei ? ' · IMEI ' + esc(l.imei) : ''}</div>` : '<span class="dim">no CDR record near this time</span>';
function numsOf(a) { const meta = S.cur.telecom.meta || {}; const nums = a ? acctNumbers(a) : []; return { linked: nums.filter(n => a.mobiles.includes(n) || (meta[n] || {}).type === 'linked'), alt: nums.filter(n => !a.mobiles.includes(n) && (meta[n] || {}).type !== 'linked') }; }

/* ---------------- CDR & LOCATION ANALYSIS ---------------- */
const CD = { tab: 'days' };
function cdrDays() {
  return intelCache('cdrdays', () => {
    const c = S.cur; const V = verifyRows(); const T_ = T(); const compNums = Array.from(T_.compNums).filter(n => cdrIndex().has(n));
    const ev = V.l1.map(r => {
      const ft = r.fTx ? txTime(r.fTx) : (r.ncrp && r.ncrp.hasTime ? { ts: r.ncrp.ts, src: 'NCRP time' } : null);
      const tt = r.tTx ? txTime(r.tTx) : null; const tts = tt ? tt.ts : ft ? ft.ts : null;
      const compLoc = ft ? compNums.map(n => cdrNear(n, ft.ts, INTEL.smsWinMin)).filter(Boolean) : [];
      const nn = r.to ? numsOf(r.to) : { linked: [], alt: [] };
      const accLinked = tts != null ? nn.linked.map(n => cdrNear(n, tts, INTEL.smsWinMin)).filter(Boolean) : [];
      const accAlt = tts != null ? nn.alt.map(n => cdrNear(n, tts, INTEL.smsWinMin)).filter(Boolean) : [];
      return { r, day: dayKey(ft ? ft.ts : r.ts != null ? r.ts : (r.fTx || r.tTx || {}).ts || 0), ft, tt, compLoc, accLinked, accAlt, nn };
    }).filter(e => e.day && e.day !== '1970-01-01');
    return Array.from(groupBy(ev, e => e.day).entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([day, l]) => ({ day, l: l.sort((x, y) => ((x.ft || {}).ts || 0) - ((y.ft || {}).ts || 0)), amt: round2(sum(l, e => e.r.amt)) }));
  });
}
function numberProfile() {
  return intelCache('numprof', () => {
    const c = S.cur; const cdr = c.telecom.cdr; const meta = c.telecom.meta || {}; const F = anFusion();
    const num2acct = new Map(); for (const a of c.accts) for (const n of acctNumbers(a)) num2acct.set(n, a);
    const out = [];
    for (const [num, idx] of cdrIndex()) {
      const rows = idx.map(i => cdr[i]); const a = num2acct.get(num); const m = meta[num] || {};
      const mode = arr => { const cm = new Map(); for (const r of arr) { const k = r.addr || r.cell; if (!k) continue; const x = cm.get(k) || { k, n: 0, lat: r.lat, lon: r.lon, cell: r.cell, addr: r.addr }; x.n++; cm.set(k, x); } const l = Array.from(cm.values()).sort((p, q) => q.n - p.n); const tot = sum(l, x => x.n); return l.slice(0, 3).map(x => Object.assign(x, { pct: tot ? Math.round(x.n / tot * 100) : 0 })); };
      const hr = r => new Date(r.ts).getUTCHours(); const night = rows.filter(r => hr(r) >= 22 || hr(r) < 6), day = rows.filter(r => hr(r) >= 6 && hr(r) < 22);
      const txLocs = F.rows.flatMap(fr => fr.locs.filter(l => l.num === num).map(l => Object.assign({ role: fr.role, amt: fr.amt, ts: fr.ts }, l)));
      const txMode = (() => { const cm = new Map(); for (const l of txLocs) { const k = locLabel(l); const x = cm.get(k) || Object.assign({ k, n: 0 }, l); x.n++; cm.set(k, x); } return Array.from(cm.values()).sort((p, q) => q.n - p.n).slice(0, 3); })();
      const imeiAll = Array.from(countBy(rows.filter(r => r.imei), r => r.imei.slice(0, 15)).entries()).sort((p, q) => q[1] - p[1]);
      const imeiTx = uniq(txLocs.map(l => l.imei).filter(Boolean));
      const checkLocs = txLocs.filter(l => /Test|Dormant/.test(l.role));
      out.push({ num, name: m.name || (a && a.holder) || '', role: m.role || (a ? acctType(a) : ''), type: m.type || '', acct: a, n: rows.length, txMode, night: mode(night), day: mode(day), imeiAll, imeiTx, checkLocs, first: rows[0] && rows[0].ts, last: rows[rows.length - 1] && rows[rows.length - 1].ts });
    }
    return out.sort((x, y) => (y.txMode.length - x.txMode.length) || y.n - x.n);
  });
}
VIEWS.cdrday = async el => {
  const c = S.cur; await GEO.ready();
  if (!c.telecom.cdr.length) { el.innerHTML = pageHead('CDR & Location Analysis', '') + emptyState('Upload the complainant CDR and the CDRs of the accused / suspect numbers first.', `<button class="btn-p" id="toCdr">⇪ Upload CDR</button>`); $('#toCdr', el).onclick = () => go('up_cdr'); return; }
  el.innerHTML = `<div class="empty" style="margin-top:60px"><div class="spin"></div>Matching CDR locations with the money trail…</div>`; await tick();
  const F = anFusion();
  el.innerHTML = pageHead('CDR & Location Analysis', 'Day by day: where the complainant was when the money was paid, and where the accused numbers (bank-linked and alternate) were when it was credited. Then the usual day / night locations and the handset used by each number.', `<button id="cdX">⇩ Excel</button>`) +
    `${F.commonCells.length || F.commonImei.length ? `<div class="card iv-brk" style="margin-bottom:14px"><h3>⚡ Interconnections</h3><ul>${F.commonImei.slice(0, 4).map(x => `<li><b>Same handset IMEI ${esc(x.imei)}</b> — ${x.nums.map((n, i) => esc(n) + (x.names[i] ? ' (' + esc(x.names[i]) + ')' : '')).join(', ')}</li>`).join('')}${F.commonCells.slice(0, 4).map(x => `<li><b>Same place while money moved:</b> ${esc(x.addr || 'cell ' + x.cell)} — ${x.accts.length} accounts (${esc(x.accts.join(', '))})</li>`).join('')}</ul></div>` : ''}
    <div class="tabs">${[['days', 'Day-wise money & location'], ['report', 'Location report by number'], ['map', 'Map']].map(([k, t]) => `<button class="${CD.tab === k ? 'on' : ''}" data-cd="${k}">${t}</button>`).join('')}</div><div id="cdB"></div>`;
  $$('[data-cd]', el).forEach(b => b.onclick = () => { CD.tab = b.dataset.cd; go('cdrday'); });
  const B = $('#cdB', el); const days = cdrDays(); const prof = numberProfile();
  const dayCols = [{ label: 'Complainant paid at', get: e => e.ft ? fmtDT(e.ft.ts) + ' · ' + e.ft.src : 'time not known' }, { label: 'Amount · UTR', get: e => inr(e.r.amt) + ' · ' + (e.r.utr || '') }, { label: 'Complainant location', html: e => e.compLoc.map(locHtml).join('') || '<span class="dim">no complainant CDR record</span>', x: e => e.compLoc.map(l => l.num + ': ' + locLabel(l)).join('; ') },
    { label: 'Credited to (accused)', get: e => e.r.to ? acctName(e.r.to) : e.r.toNo }, { label: 'Credited at', get: e => e.tt ? fmtDT(e.tt.ts) + ' · ' + e.tt.src : e.ft ? 'same as payment' : '' },
    { label: 'Accused bank-linked no. location', html: e => e.accLinked.map(locHtml).join('') || (e.nn.linked.length ? '<span class="dim">no record near this time</span>' : '<span class="dim">no linked-number CDR</span>'), x: e => e.accLinked.map(l => l.num + ': ' + locLabel(l) + ' IMEI ' + (l.imei || '')).join('; ') },
    { label: 'Alternate no. location', html: e => e.accAlt.map(locHtml).join('') || '<span class="dim">—</span>', x: e => e.accAlt.map(l => l.num + ': ' + locLabel(l)).join('; ') }, { label: 'Nearest police station', html: e => psHtml(e.accLinked[0] || e.accAlt[0]), x: e => psHtml(e.accLinked[0] || e.accAlt[0], true) }];
  const profCols = [{ label: 'Number', html: p => `<b class="mono">${esc(p.num)}</b><div class="small">${esc(p.name)}</div>`, x: p => p.num }, { label: 'Role / CDR type', get: p => [p.role, (CDR_KINDS.find(k => k[0] === p.type) || [])[1]].filter(Boolean).join(' · ') }, { label: 'Account', get: p => p.acct ? p.acct.acctNo : '' },
    { label: 'Mostly at transaction times', html: p => p.txMode.map(x => `<div>${esc(x.k)} <span class="dim">×${x.n}</span></div>`).join('') || '<span class="dim">—</span>', x: p => p.txMode.map(x => x.k + ' x' + x.n).join('; ') },
    { label: 'Night location (10 pm – 6 am)', html: p => p.night.map(x => `<div>${esc(x.addr || 'cell ' + x.cell)} <span class="dim">${x.pct}%</span></div>`).join('') || '<span class="dim">—</span>', x: p => p.night.map(x => (x.addr || x.cell) + ' ' + x.pct + '%').join('; ') },
    { label: 'Day location', html: p => p.day.map(x => `<div>${esc(x.addr || 'cell ' + x.cell)} <span class="dim">${x.pct}%</span></div>`).join('') || '<span class="dim">—</span>', x: p => p.day.map(x => (x.addr || x.cell) + ' ' + x.pct + '%').join('; ') },
    { label: 'Handset at transaction time', get: p => p.imeiTx.join(', ') }, { label: 'All handsets (IMEI · records)', get: p => p.imeiAll.slice(0, 4).map(([i, n]) => i + ' · ' + n).join(', ') },
    { label: 'Location at dormant / test (₹1) times', html: p => p.checkLocs.slice(0, 3).map(l => `<div>${esc(l.role)}: ${esc(locLabel(l))}</div>`).join('') || '<span class="dim">—</span>', x: p => p.checkLocs.map(l => l.role + ': ' + locLabel(l)).join('; ') },
    { label: 'Nearest police station (night location)', html: p => psHtml(p.night[0] && Object.assign({ num: p.num }, p.night[0])), x: p => psHtml(p.night[0] && Object.assign({ num: p.num }, p.night[0]), true) }];
  $('#cdX', el).onclick = () => xlsxBook('CDR_location_analysis', [{ name: 'Day-wise', cols: [{ label: 'Date', get: e => e.day }].concat(dayCols), rows: days.flatMap(d => d.l) }, { name: 'Location by number', cols: profCols, rows: prof }, { name: 'Common locations', cols: CC_COLS, rows: F.commonCells }, { name: 'Common IMEI', cols: IM_COLS, rows: F.commonImei }]);
  if (CD.tab === 'days') B.innerHTML = days.length ? days.map(d => `<div class="card day-card" style="margin-bottom:12px"><div class="row sb"><h3 style="margin:0">📅 ${esc(fmtDate(Date.parse(d.day + 'T00:00:00Z')))}</h3><span class="chip on">${d.l.length} payment(s) · ${inrShort(d.amt)}</span></div><div style="margin-top:8px">${simpleTable(dayCols, d.l, { maxH: 520 })}</div></div>`).join('') : emptyState('No complainant → Layer 1 transactions with a known date yet.');
  else if (CD.tab === 'report') B.innerHTML = `<div class="card">${simpleTable(profCols, prof, { maxH: 700 })}</div><p class="small dim">Locations are CDR / cell-site correlations, not exact positions. “Nearest police station” needs the police stations list (Upload → Other data → Police stations list); until then the button opens Google Maps.</p>`;
  else {
    B.innerHTML = `<div class="card"><div class="row sb"><span class="small">● complainant · ● accused at credit time · ◆ night locations</span><label class="row small"><input type="checkbox" id="cdT" ${S.prefs.mapTiles ? 'checked' : ''}> Street map</label></div><div id="cdM" class="geo-map" style="margin-top:8px"></div></div>`;
    $('#cdT', B).onchange = async e => { S.prefs.mapTiles = e.target.checked; await savePrefs(); go('cdrday'); };
    if (typeof L === 'undefined') return; if (GEO_MAP) { try { GEO_MAP.remove(); } catch {} GEO_MAP = null; }
    const map = GEO_MAP = L.map($('#cdM', B), { preferCanvas: true }).setView([22.5, 80], 5); if (S.prefs.mapTiles) L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap contributors' }).addTo(map);
    const b = []; const pt = (l, col, txt, r = 7) => { if (!l || l.lat == null) return; b.push([l.lat, l.lon]); L.circleMarker([l.lat, l.lon], { radius: r, color: col, fillColor: col, fillOpacity: .55, weight: 2 }).addTo(map).bindPopup(txt); };
    for (const d of days) for (const e of d.l) { e.compLoc.forEach(l => pt(l, '#00ff9d', `<b>Complainant</b> ${esc(l.num)}<br>${esc(locLabel(l))}<br>${esc(d.day)} · ${esc(inr(e.r.amt))}`)); e.accLinked.concat(e.accAlt).forEach(l => pt(l, '#ff2e88', `<b>${esc(e.r.to ? acctName(e.r.to) : '')}</b><br>${esc(l.num)} · ${esc(locLabel(l))}<br>credited ${esc(inr(e.r.amt))}`, 9)); }
    for (const p of prof) p.night.slice(0, 1).forEach(x => pt(x, '#ffb300', `<b>Night location</b> ${esc(p.num)} ${esc(p.name)}<br>${esc(x.addr || x.cell)} (${x.pct}%)`, 6));
    if (b.length) map.fitBounds(b, { padding: [30, 30], maxZoom: 13 }); setTimeout(() => map.invalidateSize(), 150);
  }
};

/* ---------------- DORMANT & FREEZE CHECKS ---------------- */
VIEWS.dormant = async el => {
  await GEO.ready(); const DM = anDormant(), TT = anTest(), F = anFusion();
  const loc = t => { const r = t && F.byTx.get(t.id); return r ? r.locs : []; };
  el.innerHTML = pageHead('Dormant & Freeze Checks', 'Dormant accounts that suddenly became active, and small “freeze check” transactions (₹1, ₹10) sent to test whether an account is live before the fraud money is moved — with the phone location at those moments.', `<button id="dfX">⇩ Excel</button>`) +
    `<div class="grid g4" style="margin-bottom:14px">${kpi('Dormant accounts', nfmt(DM.filter(x => x.verdict.startsWith('Dormant')).length), DM.length + ' flagged in total', 'rgba(255,179,0,.35)')}${kpi('Freeze-check txns', nfmt(TT.rows.length), 'up to ₹' + INTEL.testMax, 'rgba(255,110,64,.35)')}${kpi('Exactly ₹1', nfmt(TT.rows.filter(r => r.one).length), TT.byAcct.length + ' accounts', 'rgba(255,77,94,.35)')}${kpi('Linked checks', nfmt(TT.cpLinks.length + TT.clusters.length), 'same sender or same hour, different accounts', 'rgba(255,46,136,.35)')}</div>
    <div class="card" style="margin-bottom:14px"><div class="row sb" style="align-items:flex-end;flex-wrap:wrap"><h3 style="margin:0">Dormant accounts with sudden activity</h3><div class="row"><label class="f">Silent for at least (days)<input id="dmD" type="number" min="15" value="${INTEL.dormantDays}" style="width:100px"></label><label class="f">Freeze-check amount up to (₹)<input id="ttM" type="number" min="1" value="${INTEL.testMax}" style="width:100px"></label></div></div><div id="dT" style="margin-top:10px"></div></div>
    <div class="grid g2" style="margin-bottom:14px"><div class="card"><h3>Same sender of freeze checks to different accounts</h3>${simpleTable([{ label: 'Sender / party', k: 'cp' }, { label: 'Accounts', get: x => x.accts.join(', ') }, { label: 'Txns', k: 'n', num: 1 }], TT.cpLinks, { maxH: 220, empty: 'None found.' })}</div>
      <div class="card"><h3>Freeze checks in different accounts within 1 hour</h3>${simpleTable([{ label: 'From', get: x => fmtDT(x.from) }, { label: 'To', get: x => fmtDT(x.to) }, { label: 'Accounts', get: x => x.accts.join(', ') }, { label: 'Txns', k: 'n', num: 1 }], TT.clusters, { maxH: 220, empty: 'None found.' })}</div></div>
    <div class="card"><h3>All freeze-check transactions</h3><div id="tT"></div></div>`;
  const dCols = DORM_COLS.concat([{ label: 'Phone location when reactivated', html: x => loc((IX.txByAcct.get(x.a.id) || []).find(t => t.ts === x.restart)).map(locHtml).join('') || '<span class="dim">—</span>', x: x => loc((IX.txByAcct.get(x.a.id) || []).find(t => t.ts === x.restart)).map(l => l.num + ': ' + locLabel(l)).join('; ') }]);
  const tCols = TEST_COLS.concat([{ label: 'Phone location at that time', html: r => loc(r.t).map(locHtml).join('') || '<span class="dim">—</span>', x: r => loc(r.t).map(l => l.num + ': ' + locLabel(l)).join('; ') }, { label: 'Nearest PS', html: r => psHtml(loc(r.t)[0]), x: r => psHtml(loc(r.t)[0], true) }]);
  $('#dT', el).innerHTML = simpleTable(dCols, DM, { maxH: 420, empty: 'No dormant or suddenly active accounts.' });
  $('#tT', el).innerHTML = simpleTable(tCols, TT.rows, { maxH: 480, empty: 'No freeze-check transactions.' });
  $('#dmD', el).onchange = e => { INTEL.dormantDays = Math.max(15, +e.target.value || 90); S.derived && (S.derived.intel = null); go('dormant'); };
  $('#ttM', el).onchange = e => { INTEL.testMax = Math.max(1, +e.target.value || 10); S.derived && (S.derived.intel = null); go('dormant'); };
  $('#dfX', el).onclick = () => xlsxBook('Dormant_and_freeze_checks', [{ name: 'Dormant accounts', cols: dCols, rows: DM }, { name: 'Freeze checks', cols: tCols, rows: TT.rows }, { name: 'By account', cols: TESTA_COLS, rows: TT.byAcct }]);
};

/* ---------------- ENTITIES · UPI · POS ---------------- */
const EN = { mode: 'l1', tab: 'upi' };
VIEWS.entities = el => {
  const type = EN.mode === 'l1' ? 'Layer 1' : ''; const R = anUpiPos(type);
  const upi = R.upi.slice().sort((a, b) => (b.dr + b.cr) - (a.dr + a.cr)), cp = R.cp.slice().sort((a, b) => (b.dr + b.cr) - (a.dr + a.cr));
  el.innerHTML = pageHead('Entities · UPI · POS', 'Who received and who sent the money: UPI IDs, persons / accounts, POS merchant places and identifiers shared between accounts.', `<button id="enX">⇩ Excel</button>`) +
    `<div class="seg3">${[['l1', 'Primary — Layer 1 accounts', '#ffb300'], ['all', 'Detailed — all accounts in the trail', '#00e5ff']].map(([k, t, col]) => `<button class="${EN.mode === k ? 'on' : ''}" data-em="${k}" style="--pc:${col}">${t}<span>${k === 'l1' ? S.cur.accts.filter(a => acctType(a) === 'Layer 1').length : S.cur.accts.length}</span></button>`).join('')}</div>
    <div class="tabs">${[['upi', `UPI IDs (${upi.length})`], ['cp', `Persons / accounts (${cp.length})`], ['pos', `POS / merchants (${R.pos.length})`], ['acc', 'Accounts by money moved'], ['links', 'Shared identifiers']].map(([k, t]) => `<button class="${EN.tab === k ? 'on' : ''}" data-et="${k}">${t}</button>`).join('')}</div><div id="enB"></div>`;
  $$('[data-em]', el).forEach(b => b.onclick = () => { EN.mode = b.dataset.em; go('entities'); }); $$('[data-et]', el).forEach(b => b.onclick = () => { EN.tab = b.dataset.et; go('entities'); });
  const B = $('#enB', el);
  if (EN.tab === 'upi') B.innerHTML = `<div class="card">${simpleTable(UPI_COLS.concat([{ label: '', html: u => `<button class="btn-sm" data-n94="${esc(u.upi)}">✉ Notice</button>` }]), upi, { maxH: 640, empty: 'No UPI IDs in the narrations.' })}</div>`;
  else if (EN.tab === 'cp') B.innerHTML = `<div class="card">${simpleTable(CP_COLS, cp, { maxH: 640 })}</div>`;
  else if (EN.tab === 'pos') B.innerHTML = `<div class="card">${simpleTable(POS_COLS.concat([{ label: '', html: p => `<button class="btn-sm" data-npos="${esc(p.place)}">✉ Notice</button>` }]), R.pos, { maxH: 640, empty: 'No POS or card purchases.' })}</div>`;
  else if (EN.tab === 'acc') B.innerHTML = `<div class="card">${simpleTable(ACC_COLS, R.acc.slice().sort((a, b) => (b.dr + b.cr) - (a.dr + a.cr)), { maxH: 640 })}</div>`;
  else { B.innerHTML = '<div id="oldEnt"></div>'; VIEWS.entitiesLinks($('#oldEnt', B)); }
  $$('[data-n94]', B).forEach(b => b.onclick = () => { LET.type = 'pg_wallet'; LET.sel = ''; LET.focus = b.dataset.n94; go('letters'); });
  $$('[data-npos]', B).forEach(b => b.onclick = () => { LET.type = 'pos'; LET.sel = ''; LET.focus = b.dataset.npos; go('letters'); });
  $('#enX', el).onclick = () => xlsxBook('Entities_UPI_POS_' + (EN.mode === 'l1' ? 'Layer1' : 'All'), [{ name: 'UPI IDs', cols: UPI_COLS, rows: upi }, { name: 'Persons', cols: CP_COLS, rows: cp }, { name: 'POS places', cols: POS_COLS, rows: R.pos }, { name: 'Accounts', cols: ACC_COLS, rows: R.acc }]);
};
