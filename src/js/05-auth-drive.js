/* ------------------------ Google sign-in & Drive backup ------------------------ */
const GAuth = {
  token: null, exp: 0, client: null, pending: null,
  configured() { return CONFIG.GOOGLE_CLIENT_ID && !CONFIG.GOOGLE_CLIENT_ID.startsWith('__') && /apps\.googleusercontent\.com$/.test(CONFIG.GOOGLE_CLIENT_ID); },
  async loadGis() {
    if (window.google && google.accounts && google.accounts.oauth2) return;
    await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = res; s.onerror = () => rej(new Error('Could not load Google Sign-In (offline?)')); document.head.appendChild(s); });
  },
  async request(prompt = '') {
    await this.loadGis();
    if (!this.client) this.client = google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.GOOGLE_CLIENT_ID, scope: 'openid email profile ' + CONFIG.DRIVE_SCOPE,
      callback: r => { const p = this.pending; this.pending = null; if (!p) return; if (r.error) p.rej(new Error(r.error_description || r.error)); else { this.token = r.access_token; this.exp = Date.now() + (r.expires_in - 60) * 1000; p.res(r); } },
      error_callback: e => { const p = this.pending; this.pending = null; p && p.rej(new Error(e.message || e.type || 'Sign-in cancelled')); }
    });
    return new Promise((res, rej) => { this.pending = { res, rej }; this.client.requestAccessToken({ prompt }); });
  },
  valid() { return this.token && Date.now() < this.exp; },
  async ensure() { if (!this.valid()) await this.request(''); return this.token; },
  async userinfo() {
    const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + this.token } });
    if (!r.ok) throw new Error('Could not read Google profile'); return r.json();
  },
  allowed(email, verified) {
    if (!verified) return false; email = String(email).toLowerCase();
    const E = CONFIG.ALLOWED_EMAILS.map(x => x.toLowerCase()), D = CONFIG.ALLOWED_DOMAINS.map(x => x.toLowerCase());
    if (!E.length && !D.length) return true;
    return E.includes(email) || D.includes(email.split('@')[1]);
  },
  signOut() { if (this.token && window.google) try { google.accounts.oauth2.revoke(this.token, () => {}); } catch {} this.token = null; this.exp = 0; }
};

const Drive = {
  folderId: null,
  async api(url, opt = {}) {
    const tok = await GAuth.ensure();
    const r = await fetch(url, Object.assign({}, opt, { headers: Object.assign({ Authorization: 'Bearer ' + tok }, opt.headers || {}) }));
    if (!r.ok) { const t = await r.text(); throw new Error('Drive error ' + r.status + ': ' + t.slice(0, 200)); }
    return r;
  },
  async folder() {
    if (this.folderId) return this.folderId;
    const q = encodeURIComponent(`name='${CONFIG.DRIVE_FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
    const r = await (await this.api(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&spaces=drive`)).json();
    if (r.files && r.files.length) return (this.folderId = r.files[0].id);
    const c = await (await this.api('https://www.googleapis.com/drive/v3/files?fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: CONFIG.DRIVE_FOLDER, mimeType: 'application/vnd.google-apps.folder' }) })).json();
    return (this.folderId = c.id);
  },
  async upload(name, bytes, appProperties) {
    const parent = await this.folder();
    const meta = { name, parents: [parent], mimeType: 'application/octet-stream', appProperties };
    const tok = await GAuth.ensure();
    const init = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,createdTime', {
      method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'application/octet-stream', 'X-Upload-Content-Length': String(bytes.length) }, body: JSON.stringify(meta)
    });
    const loc = init.ok && init.headers.get('Location');
    if (loc) { const r = await fetch(loc, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: bytes }); if (!r.ok) throw new Error('Upload failed ' + r.status); return r.json(); }
    // fallback: multipart
    const boundary = 'cfits' + rid(12);
    const body = new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`, bytes, `\r\n--${boundary}--`]);
    return (await this.api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,createdTime', { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body })).json();
  },
  async list() {
    const parent = await this.folder();
    const q = encodeURIComponent(`'${parent}' in parents and trashed=false`);
    const r = await (await this.api(`https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=createdTime desc&pageSize=200&fields=files(id,name,size,createdTime,appProperties)`)).json();
    return r.files || [];
  },
  async download(id) { return new Uint8Array(await (await this.api(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`)).arrayBuffer()); },
  async remove(id) { await this.api(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}`, { method: 'DELETE' }); }
};

function casePackage(c) { const o = {}; for (const p of PARTS) o[p] = c[p]; return { kind: 'CFITS_CASE', app: CONFIG.VERSION, exported: nowStamp(), by: S.user && S.user.email, data: o }; }
async function backupCaseToDrive(c = S.cur) {
  await saveNow();
  const bytes = await Vault.pack(casePackage(c));
  const hash = await sha256Hex(bytes);
  const name = `CFITS_CASE_${fileSafe(c.meta.id)}_${isoDate(nowWall())}_${pad(new Date().getHours())}${pad(new Date().getMinutes())}.enc`;
  const f = await Drive.upload(name, bytes, { cfits: '1', caseId: c.meta.id.slice(0, 100), sha256: hash });
  c.meta.lastBackup = nowStamp(); c.meta.backups = (c.meta.backups || []).concat([{ id: f.id, name, at: c.meta.lastBackup, sha256: hash, size: bytes.length }]).slice(-50);
  c._changedSinceBackup = false; markDirty('meta'); await audit('Backed up case to Google Drive', name + ' sha256=' + hash.slice(0, 16));
  return f;
}
async function verifyDriveBackup(file) {
  const bytes = await Drive.download(file.id); const hash = await sha256Hex(bytes);
  const hashOk = !file.appProperties || !file.appProperties.sha256 || file.appProperties.sha256 === hash;
  const pkg = await Vault.unpack(bytes);
  const d = pkg.data; return { hashOk, hash, caseId: d.meta.id, accts: d.accts.length, txns: d.txns.length, cdr: d.telecom.cdr.length, exported: pkg.exported, by: pkg.by };
}
async function restorePackage(pkg, asNewId) {
  if (pkg.kind !== 'CFITS_CASE') throw new Error('Unsupported package');
  const d = pkg.data; const id = asNewId || d.meta.id;
  if (S.index.some(x => x.id === id)) throw new Error('A case with ID ' + id + ' already exists. Restore under a new ID.');
  d.meta.id = id; S.cur = Object.assign(blankCase({ id }), d); S.cur.work = Object.assign(blankCase({}).work, d.work);
  rebuildIndexes(); PARTS.forEach(p => S.dirty.add(p)); await audit('Restored case from encrypted package', 'exported ' + pkg.exported + ' by ' + pkg.by); await saveNow();
}
