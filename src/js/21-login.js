/* ------------------------------ sign-in & vault screens ------------------------------ */
function bootCard(inner) {
  const b = $('#boot'); b.hidden = false; NetFx.init(); NetFx.intensity = 1;
  b.innerHTML = `<div class="boot-card">
    <div class="lock-logo"><div class="orbit"></div><svg viewBox="0 0 64 64" class="logoSvg"></svg></div>
    <h1>SIXTH SENSE<span>FINANCIAL · TELECOM · IP INTELLIGENCE</span></h1>
    <p class="org">Cyber Crime Police Station · Kochi City</p>${inner}
    <div class="lock-foot">GOOGLE SIGN-IN · ADMIN-APPROVED ACCESS · AES-256-GCM · IP-LOGGED</div></div>
    <div class="credit">© ARUN R</div>`;
  paintLogos(b); return b;
}
const GLOGO = '<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 38.2 44 33 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
function showLogin(msg = '', kind = 'notice') {
  const g = GAuth.configured();
  const b = bootCard(`<div class="lock-form">
    ${msg ? `<div class="${kind === 'ok' ? 'notice info' : kind === 'err' ? 'notice err' : 'notice'}">${esc(msg)}</div>` : ''}
    ${!g && !CONFIG.ALLOW_LOCAL_MODE ? `<div class="notice err"><b>Google sign-in is not configured for this deployment.</b><br>The administrator must add the GOOGLE_CLIENT_ID repository variable and re-run the build workflow. Access is blocked until then.</div>`
      : g ? `<p class="muted center" style="margin:0 0 4px;font-size:14px">Authorised personnel only. Sign in with your Google account — access is granted by the admin.</p>
        <button class="gbtn" id="gSign">${GLOGO} Sign in with Google</button><div class="small muted center" id="gBusy"></div>`
      : `<div class="notice info">Local test mode (not for production).</div>
         <label class="f">Officer name / e-mail for this local profile<input id="locName" placeholder="e.g. io.cyberkochi@kerala.gov.in"></label>
         <button class="btn-p" id="locGo">Continue in local mode</button>`}
    <div class="sec-note">🔐 Statements, CDR, IP logs and reports are processed only in this browser and stored AES-256-GCM encrypted with a key derived from your vault passphrase (PBKDF2-SHA256, ${nfmt(CONFIG.PBKDF2_ITER)} iterations). Google Drive receives only encrypted backup packages.</div>
  </div>`);
  if (g) $('#gSign', b).onclick = async () => {
    const btn = $('#gSign', b), busy = $('#gBusy', b);
    try {
      btn.disabled = true; busy.textContent = 'Waiting for Google…';
      await GAuth.request('select_account'); const u = await GAuth.userinfo();
      if (!u.email_verified) throw new Error('Google e-mail address is not verified');
      let role = 'user';
      if (Backend.on()) {
        busy.textContent = 'VERIFYING ACCESS…'; Backend.ip = await Backend.publicIP();
        const r = await Backend.call('login', { name: u.name || '' });
        if (r.status !== 'approved') {
          GAuth.signOut();
          return showLogin(r.status === 'pending' ? `Access request sent for ${u.email}. The admin must approve your account before you can use SIXTH SENSE.` : r.status === 'blocked' ? `The account ${u.email} has been blocked by the admin.` : 'Access denied.', r.status === 'pending' ? 'notice' : 'err');
        }
        role = r.role === 'admin' ? 'admin' : 'user';
      } else {
        if (!GAuth.allowed(u.email, u.email_verified)) { GAuth.signOut(); return showLogin('Access denied for ' + u.email + '. This account is not on the authorised list.', 'err'); }
        role = 'admin'; // no access server configured: single-office mode
      }
      S.user = { email: u.email.toLowerCase(), name: u.name, picture: u.picture, google: true, role };
      showVaultScreen();
    } catch (e) { GAuth.signOut(); showLogin('Sign-in failed: ' + e.message, 'err'); }
  };
  else if ($('#locGo', b)) $('#locGo', b).onclick = () => { const n = $('#locName', b).value.trim(); if (n.length < 3) return toast('Enter a name or e-mail', 'warn'); S.user = { email: n.toLowerCase(), name: n, google: false, role: 'admin' }; showVaultScreen(); };
}
async function showVaultScreen(msg = '') {
  const exists = await Vault.exists(S.user.email);
  const b = bootCard(`<div class="lock-form">
    <div class="row" style="justify-content:center"><div class="avatar">${S.user.picture ? `<img src="${esc(S.user.picture)}" referrerpolicy="no-referrer" alt="">` : esc(S.user.email[0].toUpperCase())}</div><div><b>${esc(S.user.name || S.user.email)}</b><div class="small muted">${esc(S.user.email)} ${S.user.google ? badge('Google', 'blue') : badge('Local', 'gray')} ${S.user.role === 'admin' ? badge('Admin', 'pink') : ''}</div></div></div>
    ${msg ? `<div class="notice info">${esc(msg)}</div>` : ''}
    ${exists ? `<label class="f">Vault passphrase<input type="password" id="vp1" autocomplete="current-password"></label>
      <button class="btn-p" id="vGo">UNLOCK VAULT</button>`
    : `<div class="notice">Create your vault passphrase (min ${CONFIG.MIN_PASSPHRASE} characters). It encrypts all case data on this computer and your Drive backups. <b>It cannot be recovered</b> — if lost, the data cannot be decrypted.</div>
      <label class="f">New passphrase<input type="password" id="vp1" autocomplete="new-password"></label>
      <div class="prog"><i id="vpStr"></i></div><div id="vpTxt" class="small dim"></div>
      <label class="f">Confirm passphrase<input type="password" id="vp2" autocomplete="new-password"></label>
      <button class="btn-p" id="vGo">CREATE ENCRYPTED VAULT</button>`}
    <label class="row small muted"><input type="checkbox" id="vSess"> Session-only mode (nothing written to this computer; use Drive backup to keep work)</label>
    <div class="row sb"><button class="btn-g btn-sm" id="vOut">⏻ Sign out / switch user</button><span class="small dim" id="vBusy"></span></div>
  </div>`);
  const p1 = $('#vp1', b); p1.focus();
  if (!exists) p1.addEventListener('input', () => { const s = passStrength(p1.value); $('#vpStr', b).style.width = s.pct + '%'; $('#vpStr', b).style.background = s.pct < 50 ? 'var(--red)' : s.pct < 80 ? 'var(--amber)' : 'var(--green)'; $('#vpTxt', b).textContent = s.txt; });
  const doUnlock = async () => {
    const pass = p1.value; $('#vBusy', b).textContent = 'Deriving key…'; $('#vGo', b).disabled = true;
    try {
      if (exists) await Vault.unlock(S.user.email, pass);
      else { if (pass.length < CONFIG.MIN_PASSPHRASE) throw new Error(`Passphrase must be at least ${CONFIG.MIN_PASSPHRASE} characters`); if (pass !== $('#vp2', b).value) throw new Error('Passphrases do not match'); if (passStrength(pass).pct < 50) throw new Error('Passphrase too weak — use a longer phrase'); await Vault.create(S.user.email, pass); }
      Vault.sessionOnly = $('#vSess', b).checked;
      await loadIndex(); S.lastActivity = Date.now(); S.view = 'cases'; renderShell(); go('cases');
      if (isAdmin() && Backend.on()) Backend.call('listUsers').then(r => { ADM.users = r.users || []; ADM.pending = ADM.users.filter(u => u.status === 'pending').length; ADM.mainAdmin = r.mainAdmin || ''; renderNav(); if (ADM.pending) toast(`${ADM.pending} user(s) waiting for approval — see Users & Access`, 'warn', 7000); }).catch(() => {});
    } catch (e) { $('#vBusy', b).textContent = ''; $('#vGo', b).disabled = false; toast(e.message, 'err'); p1.select(); }
  };
  $('#vGo', b).onclick = doUnlock; $$('input[type=password]', b).forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') doUnlock(); }));
  $('#vOut', b).onclick = () => signOut('Signed out');
}
async function signOut(reason) {
  try { Backend.log('SIGN OUT', reason || ''); } catch {}
  try { await saveNow(); } catch {}
  Vault.lock(); S.cur = null; S.derived = null; S.index = []; killCharts(); $('#modalRoot').innerHTML = '';
  $('#app').innerHTML = ''; $('#app').hidden = true;
  setTimeout(() => GAuth.signOut(), 400); S.user = null; ADM.users = []; ADM.pending = 0;
  showLogin(reason, /withdrawn|blocked/i.test(reason || '') ? 'err' : 'ok');
}
function passStrength(p) {
  let s = 0; if (p.length >= 12) s += 30; if (p.length >= 16) s += 20; if (p.length >= 20) s += 10; if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s += 15; if (/\d/.test(p)) s += 10; if (/[^A-Za-z0-9]/.test(p)) s += 15; if (/(.)\1{3,}/.test(p) || /^(password|123456|qwerty)/i.test(p)) s -= 40;
  s = clamp(s, 0, 100); return { pct: s, txt: s < 50 ? 'Weak' : s < 80 ? 'Fair — a longer phrase is better' : 'Strong' };
}
