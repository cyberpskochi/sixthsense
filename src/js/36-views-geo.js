/* ------------------------------ IFSC & ATM INTELLIGENCE ------------------------------ */
let GEO_TAB = 'analysis'; let GEO_MAP = null;
VIEWS.geo = async el => {
  if (!GEO.loaded) el.innerHTML = `<div class="empty" style="margin-top:60px"><div class="spin"></div>Loading bank & ATM reference data…</div>`;
  await GEO.ready();
  const ifs = caseIfscRows(); const atms = caseAtmRows();
  const withState = ifs.filter(r => r.info && r.info.state);
  const states = groupBy(withState, r => r.info.state), districts = groupBy(withState.filter(r => r.info.district), r => r.info.district + ', ' + r.info.state);
  const unresolved = ifs.filter(r => !r.info || r.info.partial).length;
  const atmLocated = atms.filter(a => a.info).length;
  el.innerHTML = pageHead('IFSC & ATM Map', 'Where the money went: branch, district and state for every IFSC in the case, and the location of every ATM used for cash-out.',
    `<button id="gLook" class="btn-p" ${unresolved ? '' : 'disabled'}>${unresolved ? `⌕ Look up ${unresolved} IFSC online` : '✓ All IFSC resolved'}</button><button id="gAtm">⇪ Import ATM database</button><button id="gIfsc">⇪ Import IFSC master</button>`) +
    `<div class="grid g6" style="margin-bottom:14px">
      ${kpi('States', nfmt(states.size), 'from resolved IFSC', 'rgba(0,229,255,.3)')}${kpi('Districts', nfmt(districts.size), '', 'rgba(179,136,255,.35)')}
      ${kpi('Unique IFSC', nfmt(ifs.length), unresolved ? unresolved + ' not yet looked up' : 'all resolved', 'rgba(41,121,255,.35)')}
      ${kpi('Banks', nfmt(uniq(ifs.map(r => (r.info || {}).bank).filter(Boolean)).length), '', 'rgba(255,179,0,.35)')}
      ${kpi('ATM cash-out', inrShort(sum(atms, a => a.amount)), nfmt(sum(atms, a => a.n)) + ' withdrawals', 'rgba(255,110,64,.35)')}
      ${kpi('ATMs located', `${atmLocated} / ${atms.length}`, GEO.atm.size ? nfmt(GEO.atm.size) + ' ATMs in database' + (GEO.refInfo ? ' (encrypted reference)' : '') : GEO.refErr ? 'ATM data: ' + esc(GEO.refErr) : 'ATM database not loaded', 'rgba(0,255,157,.3)')}
    </div>
    <div class="tabs" id="gTabs">${[['analysis', 'Analysis'], ['ifsc', 'IFSC table'], ['atm', 'ATM withdrawals'], ['map', 'Map']].map(([k, t]) => `<button class="${GEO_TAB === k ? 'on' : ''}" data-t="${k}">${t}</button>`).join('')}</div>
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
  } else if (GEO_TAB === 'ifsc') {
    const cols = [{ label: 'IFSC', html: r => `<span class="mono">${esc(r.ifsc)}</span>`, x: r => r.ifsc }, { label: 'Bank', get: r => (r.info || {}).bank || '' }, { label: 'Branch', get: r => (r.info || {}).branch || '' }, { label: 'District', get: r => (r.info || {}).district || '' }, { label: 'State', get: r => (r.info || {}).state || '' },
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
    const map = GEO_MAP = L.map($('#gMap', body), { zoomControl: true, attributionControl: true, preferCanvas: true }).setView([22.5, 80], 5);
    if (tilesOn) L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap contributors' }).addTo(map);
    else { // offline orientation grid (latitude / longitude every 2°) with a few reference cities
      for (let la = 6; la <= 38; la += 2) L.polyline([[la, 66], [la, 98]], { color: '#1d3a5c', weight: 1, interactive: false }).addTo(map);
      for (let lo = 66; lo <= 98; lo += 2) L.polyline([[6, lo], [38, lo]], { color: '#1d3a5c', weight: 1, interactive: false }).addTo(map);
      for (const [n, la, lo] of [['Delhi', 28.61, 77.21], ['Mumbai', 19.08, 72.88], ['Kolkata', 22.57, 88.36], ['Chennai', 13.08, 80.27], ['Bengaluru', 12.97, 77.59], ['Hyderabad', 17.39, 78.49], ['Kochi', 9.93, 76.27], ['Patna', 25.59, 85.14], ['Jaipur', 26.91, 75.79], ['Lucknow', 26.85, 80.95], ['Ranchi', 23.34, 85.31], ['Guwahati', 26.14, 91.74], ['Ahmedabad', 23.02, 72.57]])
        L.circleMarker([la, lo], { radius: 3, color: '#5f7599', fillColor: '#5f7599', fillOpacity: 1, weight: 1, interactive: false }).addTo(map).bindTooltip(n, { permanent: true, direction: 'right', className: 'geo-city', offset: [4, 0] });
    }
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
