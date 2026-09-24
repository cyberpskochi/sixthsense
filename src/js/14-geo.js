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
const GEO = {
  ifsc: new Map(), atm: new Map(), term: new Map(), loaded: false, _t: null, online: false,
  ATM_COLS: ['atmId', 'term', 'cbs', 'bank', 'address', 'city', 'district', 'state', 'pincode', 'lat', 'lon'],
  _idx(r) { for (const k of [r.term, r.cbs]) if (k && k !== r.atmId) { if (this.term.has(k) && this.term.get(k) !== r.atmId) this.term.set(k, null); else this.term.set(k, r.atmId); } },
  async ready() {
    if (this.loaded || !Vault.key) return;
    try { const a = await Vault.get('geo:ifsc'); if (a) for (const r of a) this.ifsc.set(r.ifsc, r); } catch {}
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
      const key = keyB64 || (await Backend.call('refKey')).key;
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
  reset() { this.ifsc = new Map(); this.atm = new Map(); this.term = new Map(); this.loaded = false; this._refP = null; this.refInfo = null; },
  async addIfsc(rows) { await this.ready(); let added = 0, updated = 0; for (const r of rows) { if (this.ifsc.has(r.ifsc)) updated++; else added++; this.ifsc.set(r.ifsc, Object.assign({}, this.ifsc.get(r.ifsc) || {}, r)); } this.save(); return { added, updated }; },
  async addAtms(rows) { await this.ready(); let added = 0, updated = 0; for (const r of rows) { if (this.atm.has(r.atmId)) updated++; else added++; this.atm.set(r.atmId, r); this._idx(r); } this.save(); return { added, updated }; },
  info(code) {
    code = String(code || '').toUpperCase().replace(/\s/g, ''); if (!code) return null;
    const hit = this.ifsc.get(code) || (S.cur && S.cur.work.ifscInfo && S.cur.work.ifscInfo[code]); if (hit && !hit.invalid) return hit;
    const p = code.slice(0, 4); const name = IFSC_PREFIX[p] || (bankByIfsc(code) || {}).name || '';
    return { ifsc: code, bank: name, branch: '', district: '', state: '', partial: true, invalid: !!(hit && hit.invalid) || !IFSC_RX.test(code) };
  },
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
/* Every ATM withdrawal in the case (NCRP ATM rows + statement ATM debits). */
function caseAtmRows() {
  const c = S.cur; const m = new Map();
  const add = (id, o) => { const key = id || ('PLACE:' + (o.place || 'Unknown')); let r = m.get(key); if (!r) { r = { atmId: id, place: o.place || '', amount: 0, n: 0, accts: new Set(), first: null, last: null, src: new Set(), txns: [] }; m.set(key, r); } r.amount += o.amount || 0; r.n++; if (o.acct) r.accts.add(o.acct); if (o.ts) { r.first = r.first == null ? o.ts : Math.min(r.first, o.ts); r.last = r.last == null ? o.ts : Math.max(r.last, o.ts); } if (!r.place && o.place) r.place = o.place; r.src.add(o.srcK); if (r.txns.length < 200) r.txns.push(o); };
  for (const r of c.work.ncrp) if (r.action === 'ATM' || r.atmId) add(r.atmId, { place: r.atmPlace, amount: r.amount || r.disputed, acct: r.acctNo, ts: r.ts, srcK: 'NCRP', layer: r.layer, utr: r.utr });
  for (const t of c.txns) if (t.dr > 0 && t.channel === 'ATM') { const a = IX.acctById.get(t.acctId); const id = extractAtmId(t.narr); add(id, { place: '', amount: t.dr, acct: a ? a.acctNo : '', ts: t.ts, srcK: 'Statement', layer: acctLayer(t.acctId), narr: t.narr, tx: t.id }); }
  return Array.from(m.values()).map(r => { const info = r.atmId ? GEO.atmInfo(r.atmId) : null; return Object.assign(r, { info, accts: Array.from(r.accts), src: Array.from(r.src), amount: round2(r.amount) }); }).sort((a, b) => b.amount - a.amount);
}
