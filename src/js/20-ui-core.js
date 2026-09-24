/* =============================== UI CORE =============================== */
const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']; // validated on dark surface #0f1b31
const NAV = [
  ['Overview', [['dashboard', '◉', 'Dashboard'], ['cases', '▤', 'Cases']]],
  ['Data', [['import', '⇪', 'Import Data'], ['quality', '✓', 'Data Quality'], ['accounts', '▭', 'Accounts'], ['entities', '◎', 'Entities & Links'], ['txns', '≡', 'Transactions']]],
  ['Intelligence', [['trail', '⤳', 'Money Trail'], ['network', '⬡', 'Network Graph'], ['telecom', '☏', 'Telecom / CDR'], ['ip', '⌘', 'IP Intelligence'], ['correlation', '⧗', 'Correlation'], ['patterns', '▦', 'Patterns / NDPS']]],
  ['Action', [['leads', '⚑', 'Leads'], ['requisitions', '✉', 'Requisitions'], ['tasks', '☑', 'Tasks'], ['reports', '⎙', 'Reports']]],
  ['System', [['backup', '☁', 'Drive Backup'], ['settings', '⚙', 'Settings & Audit']]]
];
const VIEWS = {}; let CHARTS = [];
function killCharts() { CHARTS.forEach(c => { try { c.destroy(); } catch {} }); CHARTS = []; }
function mkChart(canvas, cfg) {
  if (typeof Chart === 'undefined') return null;
  Chart.defaults.color = '#8aa0c2'; Chart.defaults.borderColor = 'rgba(40,64,107,.45)'; Chart.defaults.font.family = 'Inter,Segoe UI,system-ui,sans-serif'; Chart.defaults.font.size = 11;
  cfg.options = Object.assign({ responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { labels: { boxWidth: 10, boxHeight: 10 } }, tooltip: { backgroundColor: '#0b1528', borderColor: '#28406b', borderWidth: 1, titleColor: '#dbe6f7', bodyColor: '#dbe6f7' } } }, cfg.options || {});
  const ch = new Chart(canvas, cfg); CHARTS.push(ch); return ch;
}

function renderShell() {
  const app = $('#app'); app.hidden = false; $('#boot').hidden = true;
  app.innerHTML = `
  ${S.cur && S.cur.meta.demo ? '<div class="demo-banner">DEMO DATA — NOT REAL INVESTIGATION DATA</div>' : ''}
  <div class="layout">
    <aside class="side" id="side">
      <div class="brand"><span class="brand-mark">◈</span><div><b>SIXTH SENSE</b><small>Financial · Telecom · IP Intel</small></div></div>
      <nav class="nav" id="nav"></nav>
      <div class="foot">v${CONFIG.VERSION} · AES-256 vault${Vault.sessionOnly ? ' · session-only' : ''}<br>${esc(CONFIG.CREDIT)}</div>
    </aside>
    <main class="main">
      <div class="top">
        <button class="btn-g" id="menuBtn" style="display:none">☰</button>
        <div class="case-pill"><span class="small muted">${S.cur ? esc(S.cur.meta.conf) + ' · ' + esc(S.cur.meta.type) : 'No case open'}</span><b>${S.cur ? esc(S.cur.meta.crimeNo || S.cur.meta.id) + (S.cur.meta.ps ? ' — ' + esc(S.cur.meta.ps) : '') : 'Select or create a case'}</b></div>
        <div class="search"><input id="gsearch" placeholder="Search account, mobile, UPI, UTR, IP, IMEI, name, narration…" ${S.cur ? '' : 'disabled'}></div>
        <span class="grow"></span>
        <span id="saveState" class="small dim"></span>
        <button class="btn-sm" id="lockBtn" title="Lock vault">🔒 Lock</button>
        <div class="avatar" title="${esc(S.user.email)}">${S.user.picture ? `<img src="${esc(S.user.picture)}" referrerpolicy="no-referrer" alt="">` : esc((S.user.name || S.user.email)[0].toUpperCase())}</div>
      </div>
      <div class="content" id="content"></div>
    </main>
  </div>`;
  renderNav();
  $('#lockBtn').onclick = () => lockApp('Locked by user');
  $('#menuBtn').onclick = () => $('#side').classList.toggle('open');
  const gs = $('#gsearch'); if (gs) gs.addEventListener('keydown', e => { if (e.key === 'Enter' && gs.value.trim()) globalSearch(gs.value.trim()); });
}
function renderNav() {
  const c = S.cur; const cnt = { accounts: c ? c.accts.length : '', txns: c ? nfmt(c.txns.length) : '', telecom: c ? nfmt(c.telecom.cdr.length) : '', ip: c ? nfmt(c.ip.logs.length) : '' };
  $('#nav').innerHTML = NAV.map(([g, items]) => `<div class="grp">${g}</div>` + items.map(([k, ic, t]) => `<a data-v="${k}" class="${S.view === k ? 'on' : ''}"><span class="ic">${ic}</span>${t}${cnt[k] ? `<span class="cnt">${cnt[k]}</span>` : ''}</a>`).join('')).join('');
  $$('#nav a').forEach(a => a.onclick = () => { $('#side').classList.remove('open'); go(a.dataset.v); });
}
function go(view, arg) {
  if (!S.cur && !['cases', 'settings', 'backup'].includes(view)) view = 'cases';
  S.view = view; S.viewArg = arg; killCharts(); renderNav();
  const el = $('#content'); el.scrollTop = 0; el.innerHTML = '';
  try { (VIEWS[view] || VIEWS.dashboard)(el, arg); }
  catch (e) { console.error(e); el.innerHTML = `<div class="notice err">This view failed to render: ${esc(e.message)}</div>`; }
}
function pageHead(title, sub, actions = '') { return `<div class="crumb">${esc(S.cur ? (S.cur.meta.crimeNo || S.cur.meta.id) : CONFIG.APP_NAME)} › ${esc(title)}</div><div class="pagehead"><div><h2>${esc(title)}</h2>${sub ? `<p>${sub}</p>` : ''}</div><div class="row no-print">${actions}</div></div>`; }
function kpi(label, value, sub = '', color = 'rgba(34,211,238,.14)') { return `<div class="card kpi" style="--kc:${color}"><div class="l">${esc(label)}</div><div class="v">${value}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`; }
function emptyState(msg, btn) { return `<div class="empty">${msg}${btn ? `<div style="margin-top:10px">${btn}</div>` : ''}</div>`; }

/* ------------------------------ virtual table ------------------------------ */
function vtable(host, opt) {
  const rowH = opt.rowH || 30; let rows = opt.rows || []; let sortK = null, sortDir = 1; let selected = opt.selected || null;
  const wrap = document.createElement('div'); wrap.className = 'vt'; wrap.style.height = (opt.height || 520) + 'px';
  const totalW = sum(opt.cols, c => c.w || 120);
  wrap.innerHTML = `<div class="vh" style="width:${totalW}px">${opt.cols.map((c, i) => `<div data-i="${i}" style="width:${c.w || 120}px${c.num ? ';text-align:right' : ''}" title="${esc(c.label)}">${esc(c.label)}</div>`).join('')}</div><div class="vb" style="position:relative;width:${totalW}px"></div>`;
  host.appendChild(wrap); const body = $('.vb', wrap);
  function draw() {
    if (!wrap.isConnected || !S.cur) return;
    body.style.height = rows.length * rowH + 'px';
    const top = wrap.scrollTop - 34, h = wrap.clientHeight; const a = Math.max(0, Math.floor(top / rowH) - 8), b = Math.min(rows.length, Math.ceil((top + h) / rowH) + 8);
    let html = '';
    for (let i = a; i < b; i++) {
      const r = rows[i]; const cls = (opt.rowClass ? opt.rowClass(r) : '') + (selected && selected.has && selected.has(opt.key ? opt.key(r) : i) ? ' sel' : '');
      html += `<div class="vr ${cls}" data-r="${i}" style="top:${i * rowH}px;height:${rowH}px">` + opt.cols.map(c => `<div class="${c.num ? 'num' : ''}${c.cls ? ' ' + c.cls(r) : ''}" style="width:${c.w || 120}px">${c.html ? c.html(r) : esc(c.get ? c.get(r) : r[c.k])}</div>`).join('') + '</div>';
    }
    body.innerHTML = html;
  }
  wrap.addEventListener('scroll', () => requestAnimationFrame(draw));
  body.addEventListener('click', e => { const vr = e.target.closest('.vr'); if (!vr || e.target.closest('a,button,input')) return; opt.onClick && opt.onClick(rows[+vr.dataset.r], e); });
  $('.vh', wrap).addEventListener('click', e => { const d = e.target.closest('[data-i]'); if (!d) return; const c = opt.cols[+d.dataset.i]; const f = c.sort || c.get || (r => r[c.k]); if (sortK === d.dataset.i) sortDir *= -1; else { sortK = d.dataset.i; sortDir = 1; } rows = rows.slice().sort((x, y) => { const a = f(x), b = f(y); return (a > b ? 1 : a < b ? -1 : 0) * sortDir; }); draw(); });
  draw(); new ResizeObserver(() => draw()).observe(wrap);
  return { set(r) { rows = r; wrap.scrollTop = 0; draw(); }, redraw: draw, rows: () => rows, el: wrap };
}
function simpleTable(cols, rows, opt = {}) {
  if (!rows.length) return emptyState(opt.empty || 'No records.');
  return `<div class="tbl-wrap" style="max-height:${opt.maxH || 520}px"><table class="tbl"><thead><tr>${cols.map(c => `<th class="${c.num ? 'num' : ''}">${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${rows.map((r, i) => `<tr class="${opt.click ? 'click' : ''}" data-i="${i}">${cols.map(c => `<td class="${c.num ? 'num' : ''}">${c.html ? c.html(r) : esc(c.get ? c.get(r) : r[c.k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function bindRows(host, rows, fn) { $$('tr.click', host).forEach(tr => tr.onclick = e => { if (e.target.closest('button,a,input,select')) return; fn(rows[+tr.dataset.i]); }); }
function exportTable(name, cols, rows) {
  const data = [cols.map(c => c.label)].concat(rows.map(r => cols.map(c => { const v = c.x ? c.x(r) : c.get ? c.get(r) : r[c.k]; return safeCell(v == null ? '' : v); })));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), name.slice(0, 30));
  XLSX.writeFile(wb, `${CONFIG.FILE_PREFIX}_${fileSafe(S.cur.meta.id)}_${fileSafe(name)}.xlsx`); audit('Exported table', name);
}

/* ------------------------------ global search ------------------------------ */
function globalSearch(q) {
  const c = S.cur; const Q = q.toLowerCase(); const qn = normPhone(q); const qa = acctKey(q); const qi = normIP(q);
  const accts = c.accts.filter(a => acctKey(a.acctNo).includes(qa) && qa.length >= 4 || (a.holder || '').toLowerCase().includes(Q) || a.mobiles.concat(a.altMobiles).some(m => qn.length >= 6 && m.includes(qn)) || (a.pan || '').toLowerCase() === Q || a.emails.some(e => e.includes(Q)) || (a.kyc.upi || []).some(u => u.includes(Q)));
  const txns = c.txns.filter(t => (t.utr && t.utr.toLowerCase().includes(Q)) || t.id.toLowerCase() === Q || (t.upi && t.upi.includes(Q)) || (Q.length >= 4 && t.narr.toLowerCase().includes(Q)) || (t.ref && t.ref.toLowerCase() === Q)).slice(0, 500);
  const cdr = qn.length >= 6 ? c.telecom.cdr.filter(r => r.target.includes(qn) || r.other.includes(qn) || (r.imei && r.imei.startsWith(q.replace(/\D/g, '')) && q.replace(/\D/g, '').length >= 8)).slice(0, 500) : [];
  const ips = c.ip.logs.filter(l => l.ip === qi || (l.device && l.device.toLowerCase() === Q)).slice(0, 500);
  const ipdr = c.ip.ipdr.filter(r => r.ip === qi || r.msisdn === qn).slice(0, 500);
  const nums = Array.from(IX.numInfo.values()).filter(x => qn.length >= 6 && x.num.includes(qn));
  const body = `
    <h4>Accounts (${accts.length})</h4>${accts.map(a => `<div class="sr-item" data-a="${a.id}">${badge(a.role || 'Unassigned', roleColor(a.role))} <span class="mono">${esc(a.acctNo)}</span> ${esc(a.holder)} <span class="dim">${esc(a.bank)}</span></div>`).join('') || '<div class="dim small">—</div>'}
    <h4 style="margin-top:12px">Numbers (${nums.length})</h4>${nums.map(n => `<div class="sr-item" data-n="${n.num}"><span class="mono">${n.num}</span> <span class="small muted">${esc(n.links.map(l => l.kind + ': ' + l.label).join('; '))}</span></div>`).join('') || '<div class="dim small">—</div>'}
    <h4 style="margin-top:12px">Transactions (${txns.length})</h4>${txns.slice(0, 60).map(t => `<div class="sr-item" data-t="${t.id}"><span class="mono">${t.id}</span> ${fmtDT(t.ts, t.hasTime)} <b class="${t.dr ? 'dr' : 'cr'}">${inr(t.dr || t.cr)}</b> <span class="small muted">${esc(t.narr.slice(0, 70))}</span></div>`).join('') || '<div class="dim small">—</div>'}
    <h4 style="margin-top:12px">CDR events (${cdr.length})</h4>${cdr.slice(0, 30).map(r => `<div class="small">${fmtDT(r.ts)} ${r.target} ${r.dir === 'OUT' ? '→' : '←'} ${r.other} ${r.kind} ${r.dur}s cell ${esc(r.cell)}</div>`).join('') || '<div class="dim small">—</div>'}
    <h4 style="margin-top:12px">IP logins (${ips.length}) · IPDR (${ipdr.length})</h4>${ips.slice(0, 30).map(l => `<div class="small">${fmtDT(l.ts)} ${esc(l.ip)} → ${esc(acctLabel(IX.acctById.get(l.acctId)))} ${esc(l.channel)}</div>`).join('')}${ipdr.slice(0, 30).map(r => `<div class="small">IPDR ${esc(r.ip)}:${r.port || ''} ${fmtDT(r.start)}–${fmtTime(r.end)} → ${esc(r.msisdn)}</div>`).join('')}`;
  const m = modal({ title: 'Search: ' + esc(q), body, foot: false });
  $$('[data-a]', m.el).forEach(x => x.onclick = () => { m.close(); openAccount(x.dataset.a); });
  $$('[data-t]', m.el).forEach(x => x.onclick = () => { m.close(); openTx(x.dataset.t); });
  $$('[data-n]', m.el).forEach(x => x.onclick = () => { m.close(); openNumber(x.dataset.n); });
  audit('Search', q);
}

/* ------------------------------ lock / idle ------------------------------ */
function touch() { S.lastActivity = Date.now(); }
['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(e => document.addEventListener(e, touch, { passive: true, capture: true }));
setInterval(() => { if (Vault.key && Date.now() - S.lastActivity > (S.prefs.autoLockMin || 15) * 60000) lockApp('Auto-locked after inactivity'); }, 20000);
setInterval(async () => { // optional auto-backup (explicitly enabled only)
  if (!Vault.key || !S.cur || !S.prefs.autoBackup || S.cur.meta.demo || !GAuth.valid() || !S.cur._changedSinceBackup) return;
  const last = S.cur._lastAuto || 0; if (Date.now() - last < (S.prefs.autoBackupMin || 30) * 60000) return;
  S.cur._lastAuto = Date.now(); try { await backupCaseToDrive(); toast('Auto-backup to Google Drive complete', 'ok'); } catch (e) { toast('Auto-backup failed: ' + e.message, 'warn'); }
}, 60000);
async function lockApp(reason) {
  try { await saveNow(); } catch {}
  Vault.lock(); S.cur = null; S.derived = null; S.index = []; killCharts(); $('#modalRoot').innerHTML = '';
  $('#app').innerHTML = ''; $('#app').hidden = true; showVaultScreen(reason);
}
window.addEventListener('beforeunload', e => { if (S.dirty.size) { saveNow(); e.preventDefault(); e.returnValue = ''; } });
