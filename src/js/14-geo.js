/* ------------------------------ IFSC & ATM intelligence ------------------------------
   IFSC details come from (in order): the officer's imported IFSC master list, the online
   IFSC lookup (only the IFSC code is sent, never case data), then the offline bank-prefix
   table below. ATM locations come from the ATM database the station imports.
   Both reference lists are stored once per officer, encrypted, and reused in every case. */
const IFSC_PREFIX = {
  SBIN: 'State Bank of India', HDFC: 'HDFC Bank', ICIC: 'ICICI Bank', UTIB: 'Axis Bank', PUNB: 'Punjab National Bank', BARB: 'Bank of Baroda', CNRB: 'Canara Bank',
  UBIN: 'Union Bank of India', BKID: 'Bank of India', IOBA: 'Indian Overseas Bank', IDIB: 'Indian Bank', CBIN: 'Central Bank of India', UCBA: 'UCO Bank',
  MAHB: 'Bank of Maharashtra', PSIB: 'Punjab & Sind Bank', KKBK: 'Kotak Mahindra Bank', YESB: 'Yes Bank', INDB: 'IndusInd Bank', IDFB: 'IDFC FIRST Bank',
  IBKL: 'IDBI Bank', FDRL: 'Federal Bank', SIBL: 'South Indian Bank', KVBL: 'Karur Vysya Bank', CIUB: 'City Union Bank', TMBL: 'Tamilnad Mercantile Bank',
  KARB: 'Karnataka Bank', CSBK: 'CSB Bank', DLXB: 'Dhanlaxmi Bank', RATN: 'RBL Bank', BDBL: 'Bandhan Bank', JAKA: 'Jammu & Kashmir Bank', DCBL: 'DCB Bank',
  NTBL: 'Nainital Bank', AUBL: 'AU Small Finance Bank', ESFB: 'Equitas Small Finance Bank', ESMF: 'ESAF Small Finance Bank', UJVN: 'Ujjivan Small Finance Bank',
  JSFB: 'Jana Small Finance Bank', SURY: 'Suryoday Small Finance Bank', UTKS: 'Utkarsh Small Finance Bank', FSFB: 'Fincare Small Finance Bank',
  NESF: 'North East Small Finance Bank', CAPS: 'Capital Small Finance Bank', SMCB: 'Shivalik Small Finance Bank', UNBA: 'Unity Small Finance Bank',
  AIRP: 'Airtel Payments Bank', PYTM: 'Paytm Payments Bank', IPOS: 'India Post Payments Bank', FINO: 'Fino Payments Bank', JIOP: 'Jio Payments Bank',
  NSPB: 'NSDL Payments Bank', SCBL: 'Standard Chartered Bank', CITI: 'Citibank', HSBC: 'HSBC', DEUT: 'Deutsche Bank', DBSS: 'DBS Bank India',
  KSBK: 'Kerala State Co-operative Bank (Kerala Bank)', KLGB: 'Kerala Gramin Bank', SRCB: 'Saraswat Co-operative Bank', COSB: 'Cosmos Co-operative Bank',
  SVCB: 'SVC Co-operative Bank', TJSB: 'TJSB Sahakari Bank', APGB: 'Andhra Pragathi Grameena Bank', PKGB: 'Karnataka Gramin Bank', KVGB: 'Karnataka Vikas Grameena Bank',
  TNSC: 'Tamil Nadu State Apex Co-op Bank', HPSC: 'Himachal Pradesh State Co-op Bank', MSCI: 'Maharashtra State Co-op Bank', GSCB: 'Gujarat State Co-op Bank',
  ANDB: 'Andhra Bank (now Union Bank)', CORP: 'Corporation Bank (now Union Bank)', ALLA: 'Allahabad Bank (now Indian Bank)', ORBC: 'Oriental Bank of Commerce (now PNB)',
  UTBI: 'United Bank of India (now PNB)', SYNB: 'Syndicate Bank (now Canara Bank)', VIJB: 'Vijaya Bank (now Bank of Baroda)', BKDN: 'Dena Bank (now Bank of Baroda)',
  LAVB: 'Lakshmi Vilas Bank (now DBS)', SBBJ: 'State Bank of Bikaner & Jaipur (now SBI)', SBTR: 'State Bank of Travancore (now SBI)', SBMY: 'State Bank of Mysore (now SBI)',
  SBHY: 'State Bank of Hyderabad (now SBI)', STBP: 'State Bank of Patiala (now SBI)', BARC: 'Barclays Bank', BNPA: 'BNP Paribas', HUTI: 'HDFC (erstwhile)',
  YESP: 'Yes Bank (UPI)', PYTU: 'Paytm (UPI)', RAZR: 'Razorpay', CBHB: 'Chhattisgarh Rajya Gramin Bank', BGGB: 'Baroda Gujarat Gramin Bank', PUGB: 'Paschim Banga Gramin Bank',
  UGBX: 'Utkal Grameen Bank', RRBP: 'Rajasthan Marudhara Gramin Bank', SPCB: 'Surat People\'s Co-op Bank', ABHY: 'Abhyudaya Co-op Bank', APBL: 'Apna Sahakari Bank',
  MSNU: 'Mehsana Urban Co-op Bank', NKGS: 'NKGSB Co-op Bank', KCCB: 'Kalupur Commercial Co-op Bank', ZSBL: 'Zoroastrian Co-op Bank', GBCB: 'Greater Bombay Co-op Bank'
};
const IFSC_RX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
/* Gets the reference-data key from the access server and checks it against the fingerprint built into this version,
   so a wrong / old REF_KEY gives a clear message instead of a silent decryption failure. */
async function refKeyChecked(keyB64) {
  let key = keyB64; if (!key) { const r = await Backend.call('refKey'); key = r.key; }
  key = String(key || '').replace(/\s+/g, '');
  if (!key) throw new Error('The access server did not return a key (REF_KEY is empty in Apps Script → Project Settings → Script properties).');
  let raw; try { raw = b64.dec(key); } catch { throw new Error('REF_KEY in Apps Script is not a valid key — copy it again from the key file (the long code ending with =).'); }
  if (raw.length !== 32) throw new Error('REF_KEY in Apps Script has the wrong length — copy the whole code from the key file again.');
  if (typeof REF_KEY_FP === 'string' && REF_KEY_FP) { const fp = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', raw))).slice(0, 4).map(b => b.toString(16).padStart(2, '0')).join('');
    if (fp !== REF_KEY_FP) throw new Error(`Key mismatch: REF_KEY in Apps Script (fingerprint ${fp}) is not the key this version of the app needs (fingerprint ${REF_KEY_FP}). Paste the key from the latest NEW_REF_KEY file into Apps Script → Script properties → REF_KEY and save, then sign out and sign in again. If you just uploaded to GitHub, wait for the green ✓ and press Ctrl + Shift + R.`); }
  return key;
}
/* ---- Kerala identification: 14 districts, spelling variants, and a resolver that works for every IFSC source
   (built-in database, imported master, online lookup). The built-in database already carries a verified district per Kerala branch. */
const KERALA_DISTRICTS = ['Thiruvananthapuram', 'Kollam', 'Pathanamthitta', 'Alappuzha', 'Kottayam', 'Idukki', 'Ernakulam', 'Thrissur', 'Palakkad', 'Malappuram', 'Kozhikode', 'Wayanad', 'Kannur', 'Kasaragod'];
const KERALA_ALIAS = (() => { const A = { 0: 'thiruvananthapuram trivandrum trivandram thiruvanthapuram tvm', 1: 'kollam quilon', 2: 'pathanamthitta pathanamtitta pathanamthita', 3: 'alappuzha alleppey alapuzha alapuzzha alappuzzha', 4: 'kottayam', 5: 'idukki idukky',
  6: 'ernakulam ernakulum eranakulam kochi cochin kochin', 7: 'thrissur trissur trichur thrisur', 8: 'palakkad palghat palakad', 9: 'malappuram malapuram mallappuram', 10: 'kozhikode calicut kozhikkode', 11: 'wayanad wynad waynad', 12: 'kannur cannur cannanore', 13: 'kasaragod kasargod kasaragode kasargode' };
  const m = Object.create(null); for (const k in A) for (const w of A[k].split(' ')) m[w] = +k; return m; })();
const KERALA_BANK_PREFIX = { KLGB: 1, KSBK: 1 }; // Kerala Gramin Bank, Kerala State Co-operative Bank — Kerala-only banks
const KERALA_ROADW = new Set(['road', 'rd', 'r', 'junction', 'jn', 'bypass', 'highway', 'nh', 'bus', 'stand', 'market', 'main']);
const keralaDistrictFromText = t => { const w = String(t || '').toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean); const f = new Set(); w.forEach((x, i) => { if (x in KERALA_ALIAS && !KERALA_ROADW.has(w[i + 1]) && !['to', 'towards', 'via', 'from'].includes(w[i - 1])) f.add(KERALA_ALIAS[x]); }); return f.size === 1 ? Array.from(f)[0] : -1; };
/* info → { is: true | false | null (cannot tell), district: '' | name, how: why } */
function keralaOf(info) {
  if (!info) return { is: null, district: '', how: '' };
  if (info.kdist) return { is: true, district: info.kdist, how: 'IFSC database' };
  const st = String(info.state || '').trim().toLowerCase();
  if (st === 'kerala') {
    for (const t of [info.district, info.city]) { const i = keralaDistrictFromText(t); if (i >= 0) return { is: true, district: KERALA_DISTRICTS[i], how: 'district name' }; }
    const kp = IFSCDB.doc && IFSCDB.doc.kpin; const pin = info.pincode || (String(info.address || '').match(/\b(6[789]\d)\s?(\d{3})\b/) || []).slice(1).join('');
    if (kp && pin && kp[pin] != null) return { is: true, district: KERALA_DISTRICTS[kp[pin]], how: 'PIN ' + pin };
    const i = keralaDistrictFromText((info.branch || '') + ' ' + (info.address || '')); if (i >= 0) return { is: true, district: KERALA_DISTRICTS[i], how: 'address' };
    return { is: true, district: '', how: 'state' };
  }
  if (st) return { is: false, district: '', how: 'state' };
  if (KERALA_BANK_PREFIX[String(info.ifsc || '').slice(0, 4)]) return { is: true, district: '', how: 'Kerala-only bank' };
  return { is: null, district: '', how: '' };
}
/* Built-in IFSC branch database (public Razorpay IFSC data, ~1.24 lakh branches) — data/ifsc-db.bin, loaded in the
   background after sign-in and cached by the browser. Lookups work offline once loaded. */
const IFSCDB = {
  doc: null, idx: null, loading: null, err: '',
  load() { if (this.doc || this.loading) return this.loading; this.loading = (async () => {
      try { const r = await fetch(CONFIG.IFSC_DB_URL, { cache: 'default', credentials: 'omit' }); if (!r.ok) throw new Error('IFSC database not found on the site (' + r.status + ')');
        const d = JSON.parse(await gunzip(new Uint8Array(await r.arrayBuffer()))); const idx = new Map(); d.rows.forEach((row, i) => idx.set(row[0], i)); this.doc = d; this.idx = idx; this.err = ''; this._kn = 0; const kIdx = d.state.indexOf('Kerala'); for (const row of d.rows) if (row[10] >= 0 || row[5] === kIdx) this._kn++; this._kb = null;
        S.derived = null; if (S.cur) { try { S.cur.intel = null; } catch { } }
      } catch (e) { this.err = e.message; this.loading = null; console.warn('IFSC DB', e); } })(); return this.loading; },
  bankName(p) { return this.doc ? this.doc.banks[p] || '' : ''; },
  /* Approximate branch position: PIN-code centroid from the address, else district centroid. Returns {lat, lon, acc} or null. */
  geo(inf) {
    if (!inf) return null; if (inf.lat != null && inf.lon != null && inf.lat !== '' && isFinite(+inf.lat)) return { lat: +inf.lat, lon: +inf.lon, acc: 'exact' };
    const d = this.doc; if (!d || !d.pins) return null;
    const pin = inf.pincode || (String(inf.address || '').match(/\b(\d{3})\s?(\d{3})\b(?!.*\b\d{6}\b)/) || []).slice(1).join('');
    if (pin && d.pins[pin]) return { lat: d.pins[pin][0], lon: d.pins[pin][1], acc: 'PIN ' + pin };
    if (!this._dn) { this._dn = new Map(); (d.dist || []).forEach((n, i) => { if (d.dll && d.dll[i]) this._dn.set(String(n).toLowerCase().trim(), d.dll[i]); }); }
    for (const k of [inf.district, inf.city]) { const v = k && this._dn.get(String(k).toLowerCase().trim()); if (v) return { lat: v[0], lon: v[1], acc: 'district ' + k }; }
    if (inf.kdist && d.kll) { const i = (d.kdist || KERALA_DISTRICTS).indexOf(inf.kdist); if (i >= 0 && d.kll[i]) return { lat: d.kll[i][0], lon: d.kll[i][1], acc: 'district ' + inf.kdist }; }
    return null;
  },
  get(code) { if (!this.idx) return null; const i = this.idx.get(code); if (i == null) return null; const r = this.doc.rows[i]; const d = this.doc;
    const pin = (String(r[2]).match(/\b(\d{3})\s?(\d{3})\b(?!.*\b\d{6}\b)/) || []).slice(1).join('');
    return { ifsc: r[0], bank: d.banks[r[0].slice(0, 4)] || '', branch: r[1], address: r[2], city: r[3] >= 0 ? d.city[r[3]] : '', district: r[4] >= 0 ? d.dist[r[4]] : '', state: r[5] >= 0 ? d.state[r[5]] : (pin ? pinState(pin) : ''), micr: r[6], contact: r[7], pincode: pin, src: 'db',
      flags: r[8] >= 0 ? { neft: !!(r[8] & 1), imps: !!(r[8] & 2), rtgs: !!(r[8] & 4), upi: !!(r[8] & 8) } : null, swift: r[9] || '', kdist: r[10] >= 0 ? (d.kdist || KERALA_DISTRICTS)[r[10]] : '' }; },
  stats() { const d = this.doc; if (!d) return { rows: 0, banks: 0, created: '', text: this.err ? 'not loaded (' + this.err + ')' : this.loading ? 'loading…' : 'not loaded' }; const o = { rows: d.rows.length, banks: Object.keys(d.banks).length, created: d.created }; o.kerala = this._kn || 0; o.text = nfmt(o.rows) + ' branches · ' + nfmt(o.banks) + ' banks' + (o.kerala ? ' · ' + nfmt(o.kerala) + ' Kerala branches (district-wise)' : '') + (o.created ? ' · built ' + o.created : ''); return o; },
  /* Kerala branch index for the finder: bank prefix × district counts and a row filter (rows are decoded only for the matches). */
  kerala() { const d = this.doc; if (!d) return null; if (this._kb) return this._kb;
    const cnt = new Map(); const list = []; const kIdx = d.state.indexOf('Kerala'); d.rows.forEach((r, i) => { if (r[10] >= 0 || r[5] === kIdx) { list.push(i); if (r[10] >= 0) { const k = r[0].slice(0, 4); let a = cnt.get(k); if (!a) { a = new Array(14).fill(0); cnt.set(k, a); } a[r[10]]++; } } });
    this._kb = { list, cnt }; return this._kb; },
  /* Branch search. opt: { kerala:true|false, kd:-1|0..13, bank:'' (prefix), q:'' }  → { rows:[info…], total } (max 500 decoded) */
  find(opt) { const lim = opt.limit || 500; const d = this.doc; if (!d) return { rows: [], total: 0 }; const q = String(opt.q || '').trim().toUpperCase(); const out = []; let total = 0;
    const src = opt.kerala ? this.kerala().list : null; const n = src ? src.length : d.rows.length;
    for (let j = 0; j < n; j++) { const i = src ? src[j] : j; const r = d.rows[i];
      if (opt.kd >= 0 && r[10] !== opt.kd) continue; if (opt.bank && r[0].slice(0, 4) !== opt.bank) continue;
      if (q && !(r[0] + ' ' + r[1] + ' ' + r[2] + ' ' + r[6] + ' ' + (d.banks[r[0].slice(0, 4)] || '')).toUpperCase().includes(q)) continue;
      total++; if (out.length < lim) out.push(this.get(r[0])); }
    return { rows: out, total }; }
};
const GEO = {
  ifsc: new Map(), atm: new Map(), term: new Map(), ps: [], loaded: false, _t: null, online: false,
  ATM_COLS: ['atmId', 'term', 'cbs', 'bank', 'address', 'city', 'district', 'state', 'pincode', 'lat', 'lon'],
  _idx(r) { for (const k of [r.term, r.cbs]) if (k && k !== r.atmId) { if (this.term.has(k) && this.term.get(k) !== r.atmId) this.term.set(k, null); else this.term.set(k, r.atmId); } },
  async ready() {
    if (this.loaded || !Vault.key) return;
    try { const a = await Vault.get('geo:ifsc'); if (a) for (const r of a) this.ifsc.set(r.ifsc, r); } catch {}
    try { const p = await Vault.get('geo:ps'); if (p) this.ps = p; } catch {}
    try { const b = await Vault.get('geo:atm'); if (b) { const rows = Array.isArray(b) ? b : (b.rows || []); for (const x of rows) { const r = Array.isArray(x) ? Object.fromEntries(this.ATM_COLS.map((k, i) => [k, x[i] ?? ''])) : x; if (r.lat === '') r.lat = null; if (r.lon === '') r.lon = null; this.atm.set(r.atmId, r); this._idx(r); } } } catch (e) { console.warn(e); }
    this.loaded = true;
    if (!this.atm.size && Backend.on()) { try { await this.loadRef(); } catch (e) { this.refErr = e.message; console.warn('ATM reference', e); } }
  },
  /* Encrypted ATM reference file published with the site (data/atm-ref.enc). The key is given
     only to approved, signed-in officers by the access server and is kept in memory only. */
  refInfo: null, refErr: '', _refP: null,
  loadRef(keyB64) {
    if (this._refP) return this._refP;
    this._refP = (async () => {
      const key = await refKeyChecked(keyB64);
      const r = await fetch(CONFIG.REF_ATM_URL, { cache: 'default', credentials: 'omit' }); if (!r.ok) throw new Error('ATM reference file not found on the site');
      const buf = new Uint8Array(await r.arrayBuffer()); const magic = new TextDecoder().decode(buf.slice(0, 7)); if (magic !== 'SSREF1\n') throw new Error('Not a SIXTH SENSE reference file');
      const k = await crypto.subtle.importKey('raw', b64.dec(key), 'AES-GCM', false, ['decrypt']);
      const z = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(7, 19), additionalData: new TextEncoder().encode('SIXTHSENSE-REF-ATM-V1') }, k, buf.slice(19));
      const doc = JSON.parse(await gunzip(new Uint8Array(z)));
      for (const x of doc.rows) { const rec = { atmId: x[0], term: x[1], cbs: x[2], bank: doc.banks[x[3]] || '', address: x[4], city: x[5], district: '', state: pinState(x[6]), pincode: x[6], lat: x[7], lon: x[8], ref: 1 }; if (!this.atm.has(rec.atmId)) { this.atm.set(rec.atmId, rec); this._idx(rec); } }
      this.refInfo = { n: doc.rows.length, created: doc.created }; this.refErr = '';
    })().catch(e => { this._refP = null; throw e; });
    return this._refP;
  },
  save() { clearTimeout(this._t); this._t = setTimeout(async () => { try { await Vault.put('geo:ifsc', Array.from(this.ifsc.values())); await Vault.put('geo:atm', { v: 2, rows: Array.from(this.atm.values()).filter(r => !r.ref).map(r => this.ATM_COLS.map(k => r[k] ?? '')) }); } catch (e) { console.warn(e); } }, 400); },
  reset() { this.ps = []; this.ifsc = new Map(); this.atm = new Map(); this.term = new Map(); this.loaded = false; this._refP = null; this.refInfo = null; },
  async addIfsc(rows) { await this.ready(); let added = 0, updated = 0; for (const r of rows) { if (this.ifsc.has(r.ifsc)) updated++; else added++; this.ifsc.set(r.ifsc, Object.assign({}, this.ifsc.get(r.ifsc) || {}, r)); } this.save(); return { added, updated }; },
  async addPs(rows) { await this.ready(); const k = r => (r.name + '|' + r.district + '|' + r.state).toUpperCase(); const m = new Map(this.ps.map(r => [k(r), r])); let added = 0, updated = 0; for (const r of rows) { if (m.has(k(r))) updated++; else added++; m.set(k(r), r); } this.ps = Array.from(m.values()); try { await Vault.put('geo:ps', this.ps); } catch (e) { console.warn(e); } return { added, updated }; },
  nearestPs(lat, lon, n = 2) { if (lat == null || lon == null || !this.ps.length) return []; const R = 6371, rad = x => x * Math.PI / 180; return this.ps.filter(p => p.lat != null).map(p => { const dLa = rad(p.lat - lat), dLo = rad(p.lon - lon); const a = Math.sin(dLa / 2) ** 2 + Math.cos(rad(lat)) * Math.cos(rad(p.lat)) * Math.sin(dLo / 2) ** 2; return Object.assign({ km: Math.round(2 * R * Math.asin(Math.sqrt(a)) * 10) / 10 }, p); }).sort((a, b) => a.km - b.km).slice(0, n); },
  psByText(text, n = 2) { const t = String(text || '').toUpperCase(); if (!t || !this.ps.length) return []; return this.ps.filter(p => (p.district && t.includes(p.district.toUpperCase())) || (p.name && t.includes(p.name.toUpperCase().replace(/ (PS|POLICE STATION)$/, '')))).slice(0, n); },
  async addAtms(rows) { await this.ready(); let added = 0, updated = 0; for (const r of rows) { if (this.atm.has(r.atmId)) updated++; else added++; this.atm.set(r.atmId, r); this._idx(r); } this.save(); return { added, updated }; },
  info(code) {
    code = String(code || '').toUpperCase().replace(/\s/g, ''); if (!code) return null;
    const hit = this.ifsc.get(code) || (S.cur && S.cur.work.ifscInfo && S.cur.work.ifscInfo[code]); if (hit && !hit.invalid) return hit;
    const db = IFSCDB.get(code); if (db) return db;
    const p = code.slice(0, 4); const name = IFSC_PREFIX[p] || IFSCDB.bankName(p) || (bankByIfsc(code) || {}).name || '';
    return { ifsc: code, bank: name, branch: '', district: '', state: '', partial: true, invalid: !!(hit && hit.invalid) || !IFSC_RX.test(code) };
  },
  loc(code) { return IFSCDB.geo(this.info(code)); },
  atmInfo(id) { id = String(id || '').toUpperCase().replace(/\s/g, ''); if (!id) return null; const t = this.term.get(id); return this.atm.get(id) || (t ? this.atm.get(t) : null) || (S.cur && S.cur.work.atmInfo && S.cur.work.atmInfo[id]) || null; },
  /* Online lookup: sends ONLY the 11-character IFSC code to the public RBI-sourced IFSC API. */
  async lookupOnline(codes, onProgress) {
    await this.ready(); const todo = uniq(codes.filter(c => IFSC_RX.test(c) && !(this.ifsc.get(c) || {}).branch)); let done = 0, ok = 0, bad = 0, fail = 0;
    const one = async code => {
      try {
        const r = await fetch('https://ifsc.razorpay.com/' + encodeURIComponent(code), { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
        if (r.status === 404) { this.ifsc.set(code, { ifsc: code, invalid: true, src: 'online' }); bad++; }
        else if (r.ok) { const j = await r.json(); this.ifsc.set(code, { ifsc: code, bank: j.BANK || '', branch: j.BRANCH || '', address: j.ADDRESS || '', city: j.CITY || '', district: j.DISTRICT || '', state: j.STATE || '', contact: j.CONTACT || '', micr: j.MICR || '', src: 'online' }); ok++; }
        else fail++;
      } catch { fail++; }
      done++; onProgress && onProgress(done, todo.length);
    };
    const q = todo.slice(); const workers = Array.from({ length: Math.min(4, q.length) }, async () => { while (q.length) await one(q.shift()); });
    await Promise.all(workers); this.save(); return { total: todo.length, ok, bad, fail };
  }
};
const googleUrl = q => 'https://www.google.com/search?q=' + encodeURIComponent(q);
const gmapsUrl = (q, lat, lon) => lat != null && lon != null ? `https://www.google.com/maps/search/?api=1&query=${lat},${lon}` : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);

/* ATM terminal ID in a withdrawal narration, e.g. "ATW/S1NW001234/KOCHI", "NWD-SPCNE143-...". */
function extractAtmId(narr) {
  const s = String(narr || '').toUpperCase(); if (!/ATM|ATW|NWD|AWD|EAW|CASH\s*WD|CWDR/.test(s)) return '';
  const toks = s.split(/[\s\/\-+|:*,]+/).filter(Boolean);
  for (const t of toks) if (GEO.atm.has(t) || GEO.term.get(t)) return t;
  for (const t of toks) {
    if (t.length < 6 || t.length > 16) continue;
    if (!/[A-Z]/.test(t) || !/\d/.test(t)) continue;
    if (/^(ATM|ATW|NWD|AWD|EAW|WDL|CASH|UPI|IMPS|NEFT|RTGS)/.test(t) && t.length < 8) continue;
    if (/^\d+$/.test(t) || IFSC_RX.test(t) || /^\d{2}[A-Z]{3}\d{2,4}$/.test(t)) continue;
    return t;
  }
  return '';
}

/* Every IFSC in the case with the money that touched it. */
function caseIfscRows() {
  const c = S.cur; const d = D(); const m = new Map();
  const add = (code, o) => { code = String(code || '').toUpperCase(); if (!IFSC_RX.test(code)) return; let r = m.get(code); if (!r) { r = { ifsc: code, accts: new Set(), layers: new Set(), amount: 0, ncrpAmt: 0, hold: 0, sources: new Set() }; m.set(code, r); } if (o.acct) r.accts.add(o.acct); if (o.layer != null) r.layers.add(o.layer); r.amount += o.amount || 0; r.ncrpAmt += o.ncrp || 0; r.hold += o.hold || 0; r.sources.add(o.src); };
  for (const a of c.accts) if (a.ifsc) { const res = d.acctRes.get(a.id); add(a.ifsc, { acct: a.acctNo, layer: acctLayer(a.id), amount: res ? res.tin : 0, src: 'Account' }); }
  for (const r of c.work.ncrp) { if (r.ifsc) add(r.ifsc, { acct: r.acctNo, layer: r.layer, ncrp: r.amount || r.disputed, hold: r.hold, src: 'NCRP' }); if (r.toIfsc) add(r.toIfsc, { acct: r.toAcct, layer: r.layer != null ? r.layer + 1 : null, ncrp: r.amount, src: 'NCRP' }); }
  for (const f of d.flows) if (f.toExt && f.toExt.ifsc) add(f.toExt.ifsc, { acct: f.toExt.acctNo || f.toExt.upi, layer: f.layerFrom + 1, amount: f.amt, src: 'Narration' });
  return Array.from(m.values()).map(r => Object.assign(r, { info: GEO.info(r.ifsc), accts: Array.from(r.accts), layers: Array.from(r.layers).sort((a, b) => a - b), sources: Array.from(r.sources), amount: round2(r.amount), ncrpAmt: round2(r.ncrpAmt), hold: round2(r.hold) }));
}
/* Every account in the case (statement accounts + accounts seen only in the NCRP trail) with its branch, district and
   Kerala flag — the basis of the bank-wise / district-wise Kerala lists. */
function caseAccountGeoRows() {
  const c = S.cur; const d = D(); const seen = new Map();
  const add = (acctNo, o) => { const k = acctKey(acctNo); if (!k) return; let r = seen.get(k); if (!r) { r = { acctNo, ifsc: '', holder: '', bank: '', layer: null, amount: 0, stmt: false, role: '' }; seen.set(k, r); }
    if (o.ifsc && !r.ifsc) r.ifsc = String(o.ifsc).toUpperCase().replace(/\s/g, ''); if (o.holder && !r.holder) r.holder = o.holder; if (o.bank && !r.bank) r.bank = o.bank; if (o.role && !r.role) r.role = o.role;
    if (o.layer != null && (r.layer == null || o.layer < r.layer)) r.layer = o.layer; r.amount = Math.max(r.amount, o.amount || 0); if (o.stmt) r.stmt = true; };
  for (const a of c.accts) { const res = d.acctRes.get(a.id); add(a.acctNo, { ifsc: a.ifsc, holder: a.holder, bank: a.bank, role: a.role, layer: acctLayer(a.id), amount: res ? res.tin : 0, stmt: !!a.stmt }); }
  if (c.work.ncrp.length) { try { const m = ncrpModel(Object.assign({}, NCRPF, { cash: 0, ack: '' })); for (const n of m.N.values()) if (!n.exit && n.id !== 'VICTIM' && n.layer !== 0) add(n.id, { ifsc: n.ifsc, holder: n.holder, bank: n.bank, layer: n.layer, amount: n.in }); } catch (e) { console.warn(e); } }
  return Array.from(seen.values()).map(r => { const info = r.ifsc ? GEO.info(r.ifsc) : null; const kr = r.ifsc ? keralaOf(info) : { is: null, district: '', how: '' };
    const bank = r.bank || (info && info.bank) || (r.ifsc ? (IFSC_PREFIX[r.ifsc.slice(0, 4)] || '') : '');
    return Object.assign(r, { info, kr, bank, branch: info && info.branch || '', state: info && info.state || '', kerala: kr.is === true ? 'Kerala' : kr.is === false ? 'Outside Kerala' : (r.ifsc ? 'Not resolved' : 'No IFSC'), kdistrict: kr.district || (kr.is ? 'Kerala (district not resolved)' : '') }); })
    .sort((a, b) => b.amount - a.amount);
}
/* Every ATM withdrawal in the case (NCRP ATM rows + statement ATM debits). */
function caseAtmRows() {
  const c = S.cur; const m = new Map();
  const add = (id, o) => { const key = id || ('PLACE:' + (o.place || 'Unknown')); let r = m.get(key); if (!r) { r = { atmId: id, place: o.place || '', amount: 0, n: 0, accts: new Set(), first: null, last: null, src: new Set(), txns: [] }; m.set(key, r); } r.amount += o.amount || 0; r.n++; if (o.acct) r.accts.add(o.acct); if (o.ts) { r.first = r.first == null ? o.ts : Math.min(r.first, o.ts); r.last = r.last == null ? o.ts : Math.max(r.last, o.ts); } if (!r.place && o.place) r.place = o.place; r.src.add(o.srcK); if (r.txns.length < 200) r.txns.push(o); };
  for (const r of c.work.ncrp) if (r.action === 'ATM' || r.atmId) add(r.atmId, { place: r.atmPlace, amount: r.toAmount || r.amount || r.disputed, acct: r.acctNo, ts: r.toTs || r.ts, srcK: 'NCRP', layer: r.layer, utr: r.utr });
  for (const t of c.txns) if (t.dr > 0 && t.channel === 'ATM') { const a = IX.acctById.get(t.acctId); const id = extractAtmId(t.narr); add(id, { place: '', amount: t.dr, acct: a ? a.acctNo : '', ts: t.ts, srcK: 'Statement', layer: acctLayer(t.acctId), narr: t.narr, tx: t.id }); }
  return Array.from(m.values()).map(r => { const info = r.atmId ? GEO.atmInfo(r.atmId) : null; return Object.assign(r, { info, accts: Array.from(r.accts), src: Array.from(r.src), amount: round2(r.amount) }); }).sort((a, b) => b.amount - a.amount);
}
