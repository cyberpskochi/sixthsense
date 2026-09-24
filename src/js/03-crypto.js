/* ------------------------- IndexedDB + encrypted vault ------------------------- */
const IDB = (() => {
  let dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open('cfits_vault', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function tx(mode, fn) { const db = await open(); return new Promise((res, rej) => { const t = db.transaction('kv', mode); const s = t.objectStore('kv'); const out = fn(s); t.oncomplete = () => res(out instanceof IDBRequest ? out.result : out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); }
  return {
    get: k => tx('readonly', s => s.get(k)),
    put: (k, v) => tx('readwrite', s => { s.put(v, k); }),
    del: k => tx('readwrite', s => { s.delete(k); }),
    keys: async prefix => { const all = await tx('readonly', s => s.getAllKeys()); return all.filter(k => String(k).startsWith(prefix)); }
  };
})();

const b64 = { enc: buf => btoa(String.fromCharCode(...new Uint8Array(buf))), dec: s => Uint8Array.from(atob(s), c => c.charCodeAt(0)) };
async function gzip(str) { const s = new Blob([str]).stream().pipeThrough(new CompressionStream('gzip')); return new Uint8Array(await new Response(s).arrayBuffer()); }
async function gunzip(buf) { const s = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip')); return await new Response(s).text(); }

const Vault = {
  email: null, ns: null, key: null, base: null, sessionOnly: false,
  async nsFor(email) { return 'u' + (await sha256Hex('cfits:' + String(email).toLowerCase())).slice(0, 20); },
  async deriveFrom(base, salt, iter = CONFIG.PBKDF2_ITER) {
    return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  },
  async baseKey(pass) { return crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']); },
  async destroy(email) { const ns = await this.nsFor(email); for (const k of await IDB.keys(ns + ':')) await IDB.del(k); this.lock && this.lock(); },
  async exists(email) { const ns = await this.nsFor(email); return !!(await IDB.get(ns + ':meta')); },
  async create(email, pass) {
    const ns = await this.nsFor(email); const salt = crypto.getRandomValues(new Uint8Array(16));
    const base = await this.baseKey(pass); const key = await this.deriveFrom(base, salt);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ver = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode('CFITS-VAULT-OK'));
    await IDB.put(ns + ':meta', { v: 1, salt: b64.enc(salt), iter: CONFIG.PBKDF2_ITER, iv: b64.enc(iv), ver: ver, created: nowStamp() });
    Object.assign(this, { email, ns, key, base });
  },
  async unlock(email, pass) {
    const ns = await this.nsFor(email); const meta = await IDB.get(ns + ':meta'); if (!meta) throw new Error('No vault');
    const base = await this.baseKey(pass); const key = await this.deriveFrom(base, b64.dec(meta.salt), meta.iter);
    try { await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64.dec(meta.iv) }, key, meta.ver); }
    catch { throw new Error('Incorrect passphrase'); }
    Object.assign(this, { email, ns, key, base }); return true;
  },
  lock() { this.key = null; this.base = null; },
  /* Trusted-computer mode: the derived AES key is kept in IndexedDB as a NON-EXTRACTABLE
     CryptoKey (the raw key bytes can never be read by any script) until it expires. */
  async remember(hours) { if (!this.key || !this.ns) return; await IDB.put(this.ns + ':remember', { key: this.key, base: this.base, exp: Date.now() + hours * 3600000, hours }); },
  async recall(email) {
    const ns = await this.nsFor(email); const r = await IDB.get(ns + ':remember'); if (!r) return false;
    if (!(r.exp > Date.now()) || !(r.key instanceof CryptoKey)) { await IDB.del(ns + ':remember'); return false; }
    const meta = await IDB.get(ns + ':meta'); if (!meta) return false;
    try { await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64.dec(meta.iv) }, r.key, meta.ver); } catch { await IDB.del(ns + ':remember'); return false; }
    Object.assign(this, { email: String(email).toLowerCase(), ns, key: r.key, base: r.base }); this.rememberedUntil = r.exp; return true;
  },
  async forget(email) { const ns = email ? await this.nsFor(email) : this.ns; if (ns) await IDB.del(ns + ':remember'); this.rememberedUntil = 0; },
  async encObj(obj, key = this.key) {
    const iv = crypto.getRandomValues(new Uint8Array(12)); const z = await gzip(JSON.stringify(obj));
    return { iv: b64.enc(iv), ct: await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, z) };
  },
  async decObj(rec, key = this.key) {
    const z = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64.dec(rec.iv) }, key, rec.ct);
    return JSON.parse(await gunzip(z));
  },
  async put(k, obj) { if (!this.key) throw new Error('Vault locked'); if (this.sessionOnly) return; await IDB.put(this.ns + ':' + k, await this.encObj(obj)); },
  async get(k) { if (!this.key) throw new Error('Vault locked'); const r = await IDB.get(this.ns + ':' + k); return r ? this.decObj(r) : null; },
  async del(k) { await IDB.del(this.ns + ':' + k); },
  async keys(prefix) { const ks = await IDB.keys(this.ns + ':' + prefix); return ks.map(k => k.slice(this.ns.length + 1)); },
  async changePass(oldPass, newPass) {
    await this.unlock(this.email, oldPass);
    const keys = (await IDB.keys(this.ns + ':')).filter(k => !k.endsWith(':meta') && !k.endsWith(':remember'));
    await this.forget();
    const plain = []; for (const k of keys) plain.push([k, await this.decObj(await IDB.get(k))]);
    const email = this.email; await this.create(email, newPass);
    for (const [k, o] of plain) await IDB.put(k, await this.encObj(o));
  },
  /* Portable encrypted package (Drive / file export). Key derived from the same
     passphrase with a fresh salt; the header carries only KDF parameters.     */
  async pack(obj) {
    const salt = crypto.getRandomValues(new Uint8Array(16)); const key = await this.deriveFrom(this.base, salt);
    const iv = crypto.getRandomValues(new Uint8Array(12)); const z = await gzip(JSON.stringify(obj));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, z);
    const header = new TextEncoder().encode(JSON.stringify({ app: 'CFITS', fmt: 1, kdf: 'PBKDF2-SHA256', iter: CONFIG.PBKDF2_ITER, salt: b64.enc(salt), iv: b64.enc(iv), cipher: 'AES-256-GCM', gz: true }));
    const out = new Uint8Array(4 + header.length + ct.byteLength); new DataView(out.buffer).setUint32(0, header.length);
    out.set(header, 4); out.set(new Uint8Array(ct), 4 + header.length); return out;
  },
  async unpack(buf, pass) {
    buf = new Uint8Array(buf); const hl = new DataView(buf.buffer, buf.byteOffset).getUint32(0);
    const header = JSON.parse(new TextDecoder().decode(buf.slice(4, 4 + hl)));
    if (header.app !== 'CFITS') throw new Error('Not a CFITS package');
    const base = pass ? await this.baseKey(pass) : this.base;
    const key = await this.deriveFrom(base, b64.dec(header.salt), header.iter);
    let z; try { z = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64.dec(header.iv) }, key, buf.slice(4 + hl)); }
    catch { throw new Error('Decryption failed — wrong passphrase or corrupted/tampered file'); }
    return JSON.parse(await gunzip(z));
  }
};
