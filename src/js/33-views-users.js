/* ------------------------------ USERS & ACCESS (admin only) ------------------------------ */
VIEWS.users = async el => {
  if (!Backend.on()) {
    el.innerHTML = pageHead('Users & Access', 'Admin-approved access for every officer.') +
      `<div class="card" style="--pc:#ff2e88"><h3>Access server not connected</h3>
      <p class="muted">User adding, approval, blocking and deletion need the SIXTH SENSE access server (a small Google Apps Script that keeps only the user list and activity log in a Google Sheet in your Drive). Until it is connected, only the e-mails in the <code>CFITS_ALLOWED_EMAILS</code> GitHub variable can sign in.</p>
      <ol class="muted" style="line-height:1.8"><li>Open <b>script.google.com</b> → New project → paste <b>backend/Code.gs</b>.</li><li>Project Settings → Script properties: <code>CLIENT_ID</code> = your OAuth Client ID, <code>ADMIN_EMAIL</code> = your Gmail.</li><li>Run <b>setup</b> once and allow the permissions.</li><li>Deploy → New deployment → Web app → Execute as <b>Me</b>, access <b>Anyone</b> → copy the <code>/exec</code> URL.</li><li>GitHub → Settings → Variables → add <code>SIXTHSENSE_BACKEND_URL</code> = that URL → re-run the workflow.</li></ol></div>`;
    return;
  }
  el.innerHTML = pageHead('Users & Access', 'Google accounts that try to sign in appear here as <b>pending</b>. Approve, block, change role or delete them. A blocked or deleted user is signed out within 3 minutes. Every change is logged.', `<button id="uRef">↻ Refresh</button>`) +
    `<div class="grid g4" style="margin-bottom:14px" id="uKpi"></div>
    <div class="card" style="--pc:#00ff9d;margin-bottom:14px"><h3>Add a user</h3>
      <div class="row" style="align-items:flex-end">
        <label class="f grow">Gmail / Google account<input id="nuEmail" placeholder="officer@gmail.com" autocomplete="off" spellcheck="false"></label>
        <label class="f grow">Name / designation<input id="nuName" placeholder="e.g. SI Ananthu Ramesh" autocomplete="off"></label>
        <label class="f">Role<select id="nuRole"><option value="user">User</option><option value="admin">Admin</option></select></label>
        <button class="btn-p" id="nuAdd">＋ ADD &amp; APPROVE</button>
      </div>
      <p class="small dim" style="margin:8px 0 0">While your Google app is in <b>Testing</b>, also add this Gmail under Google Cloud → Audience → Test users (or publish the app to <b>In production</b> so this page is the only gate).</p></div>
    <div class="card" style="--pc:#ff2e88;margin-bottom:14px"><h3>Users</h3><div id="uTbl"><div class="muted small">Loading…</div></div></div>
    <div class="card" style="--pc:#00e5ff"><div class="row sb"><h3 style="margin:0">Activity log</h3><div class="row"><input id="lgF" placeholder="Filter…" style="width:220px"><button class="btn-sm" id="lgX">Export</button></div></div>
      <p class="small dim" style="margin:6px 0 10px">Sign-ins, access requests, sign-outs, reports, backups and admin changes. The full log is in the Google Sheet <b>SIXTH SENSE — Users &amp; Logs</b> in the admin's Drive. Case contents are never sent to this log.</p><div id="lgTbl"></div></div>`;
  const load = async () => {
    try {
      const [u, l] = await Promise.all([Backend.call('listUsers'), Backend.call('getLogs', { limit: 800 })]);
      ADM.users = u.users || []; ADM.mainAdmin = u.mainAdmin || ''; ADM.logs = l.logs || []; ADM.pending = ADM.users.filter(x => x.status === 'pending').length;
      drawUsers(); drawLogs(); renderNav();
    } catch (e) { $('#uTbl', el).innerHTML = `<div class="notice err">${esc(e.message)}</div>`; }
  };
  const drawUsers = () => {
    const us = ADM.users.slice().sort((a, b) => ({ pending: 0, approved: 1, blocked: 2 }[a.status] ?? 3) - ({ pending: 0, approved: 1, blocked: 2 }[b.status] ?? 3) || a.email.localeCompare(b.email));
    const cnt = s => us.filter(u => u.status === s).length;
    $('#uKpi', el).innerHTML = kpi('Approved users', cnt('approved'), `${us.filter(u => u.role === 'admin' && u.status === 'approved').length} admin(s)`, 'rgba(0,255,157,.35)') + kpi('Waiting approval', cnt('pending'), 'new sign-in requests', 'rgba(255,179,0,.35)') + kpi('Blocked', cnt('blocked'), '', 'rgba(255,77,94,.35)') + kpi('Log entries', nfmt(ADM.logs.length), 'latest 800 shown', 'rgba(0,229,255,.3)');
    const me = S.user.email;
    $('#uTbl', el).innerHTML = us.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>User</th><th>Status</th><th>Role</th><th>Added</th><th>Last sign-in · IP</th><th></th></tr></thead><tbody>${us.map(u => {
      const main = u.email === ADM.mainAdmin || /main admin/i.test(u.note), self = u.email === me, lock = main || self;
      return `<tr data-email="${esc(u.email)}" class="${u.status === 'pending' ? 'ut-pend' : ''}">
        <td><b>${esc(u.name || '—')}</b> ${main ? badge('Main admin', 'pink') : ''} ${self ? badge('You', 'cyan') : ''}<br><span class="mono small muted">${esc(u.email)}</span></td>
        <td><select data-f="status" ${lock ? 'disabled' : ''}>${['pending', 'approved', 'blocked'].map(x => `<option ${u.status === x ? 'selected' : ''}>${x}</option>`).join('')}</select></td>
        <td><select data-f="role" ${lock ? 'disabled' : ''}>${['user', 'admin'].map(x => `<option ${u.role === x ? 'selected' : ''}>${x}</option>`).join('')}</select></td>
        <td class="mono small">${esc(u.addedAt ? new Date(u.addedAt).toLocaleString('en-IN') : '—')}<br><span class="muted">${esc(u.addedBy || '')}</span></td>
        <td class="mono small">${esc(u.lastLogin ? new Date(u.lastLogin).toLocaleString('en-IN') : '—')}<br><span class="muted">${esc(u.lastIP || '')}</span></td>
        <td class="nowrap">${lock ? '' : `${u.status === 'pending' ? `<button class="btn-sm btn-green" data-ua="approve">✓ Approve</button> ` : ''}<button class="btn-sm btn-mag" data-ua="save">Save</button> <button class="btn-sm btn-d" data-ua="del" title="Delete user">✕</button>`}</td></tr>`;
    }).join('')}</tbody></table></div>` : emptyState('No users yet.');
    $$('[data-ua]', el).forEach(b => b.onclick = async () => {
      const tr = b.closest('tr'), email = tr.dataset.email, act = b.dataset.ua;
      try {
        b.disabled = true; let r;
        if (act === 'del') {
          const v = await promptBox('Delete user', [{ label: `Type DELETE to remove ${email}. They will lose access within 3 minutes.` }], 'Delete'); if (!v || v[0].trim().toUpperCase() !== 'DELETE') { b.disabled = false; return; }
          r = await Backend.call('deleteUser', { email }); toast('User deleted: ' + email, 'ok');
        } else {
          const status = act === 'approve' ? 'approved' : $('[data-f=status]', tr).value;
          r = await Backend.call('updateUser', { email, status, role: $('[data-f=role]', tr).value }); toast(`Saved: ${email} → ${status}`, 'ok');
        }
        ADM.users = r.users || ADM.users; ADM.pending = ADM.users.filter(x => x.status === 'pending').length; drawUsers(); renderNav();
        Backend.call('getLogs', { limit: 800 }).then(l => { ADM.logs = l.logs || []; drawLogs(); }).catch(() => {});
      } catch (e) { toast(e.message, 'err'); b.disabled = false; }
    });
  };
  const drawLogs = () => {
    const f = ($('#lgF', el).value || '').toLowerCase();
    const rows = ADM.logs.filter(l => !f || [l.email, l.name, l.action, l.detail, l.ip].join(' ').toLowerCase().includes(f)).slice(0, 500);
    const cls = a => /DENIED|DELETED|BLOCKED/.test(a) ? 'dr' : /REQUESTED|SIGN OUT/.test(a) ? '' : /LOGIN|ADDED|UPDATED/.test(a) ? 'cr' : '';
    $('#lgTbl', el).innerHTML = simpleTable([{ label: 'Time', html: l => `<span class="mono small">${esc(l.ts ? new Date(l.ts).toLocaleString('en-IN') : '')}</span>` }, { label: 'User', html: l => `${esc(l.name || '')}<br><span class="mono small muted">${esc(l.email)}</span>` }, { label: 'Action', html: l => `<span class="mono ${cls(l.action)}">${esc(l.action)}</span>` }, { label: 'Detail', k: 'detail' }, { label: 'IP address', html: l => `<span class="mono">${esc(l.ip || '—')}</span>` }], rows, { maxH: 420, empty: 'No log entries.' });
  };
  $('#lgF', el).oninput = drawLogs; $('#uRef', el).onclick = load;
  $('#lgX', el).onclick = () => exportTable('Access log', [{ label: 'Time', get: l => l.ts }, { label: 'E-mail', k: 'email' }, { label: 'Name', k: 'name' }, { label: 'Action', k: 'action' }, { label: 'Detail', k: 'detail' }, { label: 'IP', k: 'ip' }], ADM.logs);
  $('#nuAdd', el).onclick = async () => {
    const email = $('#nuEmail', el).value.trim().toLowerCase(), name = $('#nuName', el).value.trim(), role = $('#nuRole', el).value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast('Enter a valid Google e-mail address', 'warn');
    if (role === 'admin' && !await confirmBox('Add admin', `<b>${esc(email)}</b> will be able to add, block and delete users. Continue?`, 'Add admin')) return;
    try { const r = await Backend.call('addUser', { email, name, role }); ADM.users = r.users || []; $('#nuEmail', el).value = ''; $('#nuName', el).value = ''; drawUsers(); toast(`${email} added and approved`, 'ok'); Backend.call('getLogs', { limit: 800 }).then(l => { ADM.logs = l.logs || []; drawLogs(); }).catch(() => {}); }
    catch (e) { toast(e.message, 'err'); }
  };
  load();
};
