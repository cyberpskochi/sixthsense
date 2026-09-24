/* ------------------------ access-control backend (Apps Script) ------------------------
   Holds only the approved-user list and an activity log in the admin's Google Sheet.
   The backend verifies every Google access token with Google, so identities cannot be
   forged from the browser. No case data is ever sent to it.                          */
const ADM = { users: [], logs: [], pending: 0, mainAdmin: '' };
const Backend = {
  ip: '',
  url() { const u = String(CONFIG.BACKEND_URL || ''); return /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(u) ? u : ''; },
  on() { return !!this.url() && GAuth.configured(); },
  async call(action, data = {}) {
    const tok = await GAuth.ensure();
    let r;
    try { r = await fetch(this.url(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({}, data, { action, token: tok, ip: this.ip })), redirect: 'follow', cache: 'no-store', credentials: 'omit' }); }
    catch (e) { throw new Error('Cannot reach the SIXTH SENSE access server'); }
    let j; try { j = await r.json(); } catch { throw new Error('Access server returned an invalid reply (check the deployment is "Anyone")'); }
    if (!j.ok) throw new Error(j.error || 'Access server error');
    return j;
  },
  async publicIP() { try { const r = await fetch('https://api.ipify.org?format=json', { cache: 'no-store', credentials: 'omit' }); return (await r.json()).ip || ''; } catch { return ''; } },
  log(action, detail = '') { if (!this.on() || !GAuth.valid() || !S.user || S.user.role === 'pending') return; this.call('log', { entry: { action, detail: String(detail).slice(0, 300) } }).catch(() => {}); }
};
/* Heartbeat: a blocked or deleted user is signed out within ~3 minutes. */
setInterval(async () => {
  if (!Backend.on() || !S.user || !S.user.google || !GAuth.valid()) return;
  try {
    const r = await Backend.call('check');
    if (r.status !== 'approved') { signOut('Your access has been withdrawn by the admin.'); return; }
    if (r.role !== S.user.role) { S.user.role = r.role; if ($('#nav')) renderShell(), go(S.view === 'users' && r.role !== 'admin' ? (S.cur ? 'dashboard' : 'cases') : S.view); }
  } catch (e) { /* network hiccup — try again next time */ }
}, 180000);
