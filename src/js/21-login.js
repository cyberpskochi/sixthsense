/* ------------------------------ sign-in & vault screens ------------------------------ */
function bootCard(inner) { const b = $('#boot'); b.hidden = false; b.innerHTML = `<div class="boot-card"><div class="brand-mark big">◈</div><h1>CFITS</h1><p class="muted" style="margin:0">Cyber Financial Intelligence &amp; Transaction Tracing System</p>${inner}</div>`; return b; }
function showLogin(msg = '') {
  const g = GAuth.configured();
  const b = bootCard(`<div class="lock-form">
    ${msg ? `<div class="notice">${esc(msg)}</div>` : ''}
    ${g ? `<button class="gbtn" id="gSign"><svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 38.2 44 33 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg> Sign in with Google</button>`
      : `<div class="notice info">Google sign-in is not configured yet (see setup guide). You can use <b>local mode</b>: data stays encrypted on this computer; Drive backup is unavailable.</div>
         <label class="f">Officer name / e-mail for this local profile<input id="locName" placeholder="e.g. io.cyberkochi@kerala.gov.in"></label>
         <button class="btn-p" id="locGo" style="justify-content:center">Continue in local mode</button>`}
    <div class="sec-note">🔐 Local-first: statements, CDR, IP logs and reports are processed only in this browser and stored AES-256-GCM encrypted with a key derived from your vault passphrase (PBKDF2-SHA256, ${nfmt(CONFIG.PBKDF2_ITER)} iterations). Google Drive receives only encrypted backup packages. No data is sent to any AI or third-party service.<br><br>Authorised use only — Kerala Police investigation data. All actions are recorded in a tamper-evident audit log.</div>
  </div>`);
  if (g) $('#gSign', b).onclick = async () => {
    try {
      $('#gSign', b).disabled = true; await GAuth.request('select_account'); const u = await GAuth.userinfo();
      if (!GAuth.allowed(u.email, u.email_verified)) { GAuth.signOut(); return showLogin('Access denied for ' + u.email + '. This account is not on the authorised list.'); }
      S.user = { email: u.email, name: u.name, picture: u.picture, google: true }; showVaultScreen();
    } catch (e) { showLogin('Sign-in failed: ' + e.message); }
  };
  else $('#locGo', b).onclick = () => { const n = $('#locName', b).value.trim(); if (n.length < 3) return toast('Enter a name or e-mail', 'warn'); S.user = { email: n.toLowerCase(), name: n, google: false }; showVaultScreen(); };
}
async function showVaultScreen(msg = '') {
  const exists = await Vault.exists(S.user.email);
  const b = bootCard(`<div class="lock-form">
    <div class="row"><div class="avatar">${esc(S.user.email[0].toUpperCase())}</div><div><b>${esc(S.user.name || S.user.email)}</b><div class="small muted">${esc(S.user.email)} ${S.user.google ? badge('Google', 'blue') : badge('Local mode', 'gray')}</div></div></div>
    ${msg ? `<div class="notice info">${esc(msg)}</div>` : ''}
    ${exists ? `<label class="f">Vault passphrase<input type="password" id="vp1" autocomplete="current-password"></label>
      <button class="btn-p" id="vGo" style="justify-content:center">Unlock vault</button>`
    : `<div class="notice">Create your vault passphrase (min ${CONFIG.MIN_PASSPHRASE} characters). It encrypts all case data on this computer and your Drive backups. <b>It cannot be recovered</b> — if lost, the data cannot be decrypted.</div>
      <label class="f">New passphrase<input type="password" id="vp1" autocomplete="new-password"></label>
      <div class="prog"><i id="vpStr"></i></div><div id="vpTxt" class="small dim"></div>
      <label class="f">Confirm passphrase<input type="password" id="vp2" autocomplete="new-password"></label>
      <button class="btn-p" id="vGo" style="justify-content:center">Create encrypted vault</button>`}
    <label class="row small muted"><input type="checkbox" id="vSess"> Session-only mode (nothing written to this computer; use Drive backup to keep work)</label>
    <div class="row sb"><button class="btn-g btn-sm" id="vOut">Switch user</button><span class="small dim" id="vBusy"></span></div>
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
    } catch (e) { $('#vBusy', b).textContent = ''; $('#vGo', b).disabled = false; toast(e.message, 'err'); p1.select(); }
  };
  $('#vGo', b).onclick = doUnlock; $$('input[type=password]', b).forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') doUnlock(); }));
  $('#vOut', b).onclick = () => { GAuth.signOut(); S.user = null; showLogin(); };
}
function passStrength(p) {
  let s = 0; if (p.length >= 12) s += 30; if (p.length >= 16) s += 20; if (p.length >= 20) s += 10; if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s += 15; if (/\d/.test(p)) s += 10; if (/[^A-Za-z0-9]/.test(p)) s += 15; if (/(.)\1{3,}/.test(p) || /^(password|123456|qwerty)/i.test(p)) s -= 40;
  s = clamp(s, 0, 100); return { pct: s, txt: s < 50 ? 'Weak' : s < 80 ? 'Fair — a longer phrase is better' : 'Strong' };
}
