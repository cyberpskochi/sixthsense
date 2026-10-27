/* ============================ CELL ID DATABASE + SDR FROM CDR ============================
   · Tower lists (Airtel / Jio / Vi / BSNL, Kerala or all-India, OpenCellID, operator BTS lists) are imported once,
     streamed in pieces, and kept AES-GCM encrypted in 4096 shards under the officer's vault key.
   · Every CDR upload: cells that carry their own address / coordinates are LEARNED into the database, and cells
     without a location are LOOKED UP in it (exact LAC+cell, or cell-only flagged "approximate").
   · Subscriber (SDR) details found in the CDR header block are saved with the case and in the vault for future cases.
   Wording rule: a cell is the serving tower area — correlation, not an exact position.                           */
const CELLDB = {
  SH: 4096, cache: new Map(), meta: null, sdrMap: new Map(), sdrLoaded: false, busy: false, lastEnrich: '',
  // record = [ci, lac, mccmnc, lat, lon, addr, azimuth, operator, tech, src('ref'|'learn'), seenCount]
  I: { ci: 0, lac: 1, plmn: 2, lat: 3, lon: 4, addr: 5, az: 6, op: 7, tech: 8, src: 9, n: 10 },
  shardOf(ci) { const n = Number(ci); if (Number.isFinite(n)) return n % this.SH; let h = 0; for (const ch of String(ci)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % this.SH; },
  inIndia: (la, lo) => la != null && lo != null && la > 6 && la < 38 && lo > 67 && lo < 98,
  async loadMeta() { if (this.meta) return this.meta; let m = null; try { m = await Vault.get('cells:meta'); } catch { } this.meta = m || { total: 0, byOp: {}, ver: 0, updated: 0 }; return this.meta; },
  async saveMeta() { this.meta.updated = Date.now(); try { await Vault.put('cells:meta', this.meta); } catch (e) { console.warn(e); } },
  async shard(i) {
    if (this.cache.has(i)) { const m = this.cache.get(i); this.cache.delete(i); this.cache.set(i, m); return m; }
    let arr = []; try { arr = (await Vault.get('cells:' + i)) || []; } catch { }
    const m = new Map(); for (const r of arr) { const l = m.get(r[0]); if (l) l.push(r); else m.set(r[0], [r]); }
    this.cache.set(i, m); if (this.cache.size > 800) this.cache.delete(this.cache.keys().next().value); return m;
  },
  /* ---- cell string → candidate keys ---- */
  parseCell(s, lacHint, plmnHint) {
    s = String(s == null ? '' : s).trim(); if (!s) return null;
    const parts = s.split(/[-:\/_\s]+/).filter(Boolean); let plmn = plmnHint || '', lac = lacHint || '', ci = '', alt = null;
    const dec = v => /^[0-9]+$/.test(v) ? String(Number(v)) : (/^[0-9a-fA-F]+$/.test(v) ? String(parseInt(v, 16)) : '');
    if (parts.length >= 4 && /^\d{3}$/.test(parts[0])) { plmn = parts[0] + parts[1]; lac = dec(parts[2]); ci = dec(parts[parts.length - 1]); }
    else if (parts.length === 3 && /^\d{5,6}$/.test(parts[0])) { plmn = parts[0]; lac = dec(parts[1]); ci = dec(parts[2]); }
    else if (parts.length === 2) { const a = dec(parts[0]), b = dec(parts[1]); lac = a; ci = b; if (a && b && Number(b) <= 255 && Number(a) > 0) alt = String(Number(a) * 256 + Number(b)); }
    else { ci = dec(parts[0]); if (lac) lac = dec(String(lac)); }
    if (!ci || ci === 'NaN') return null; return { ci, lac: lac || '', plmn, alt };
  },
  candidates(cell, lac, plmn) { const p = this.parseCell(cell, lac, plmn); if (!p) return []; const out = [{ ci: p.ci, lac: p.lac, plmn: p.plmn, eci: Number(p.ci) > 65535 }]; if (p.alt) out.push({ ci: p.alt, lac: '', plmn: p.plmn, eci: true }); return out; },
  opMatch(a, b) { const f = x => { x = String(x || '').toLowerCase(); return /airtel|bharti/.test(x) ? 'airtel' : /jio|reliance/.test(x) ? 'jio' : /vodafone|idea|\bvi\b|^vi/.test(x) ? 'vi' : /bsnl/.test(x) ? 'bsnl' : x; }; return f(a) && f(a) === f(b); },
  /* ---- look up a list of {cell, lac, op} ---- */
  async resolve(queries) {
    await this.loadMeta(); const out = new Map(); if (!this.meta.total) return out;
    for (const q of queries) {
      const key = q.cell + '|' + (q.lac || '') + '|' + (q.op || ''); if (out.has(key)) continue;
      let best = null, bs = 0;
      for (const c of this.candidates(q.cell, q.lac, q.plmn)) {
        const m = await this.shard(this.shardOf(c.ci));
        for (const r of (m.get(c.ci) || [])) {
          let sc = 1;
          if (c.lac && r[1]) { if (c.lac === r[1]) sc += 4; else sc -= 5; }
          if (c.plmn && r[2]) { if (c.plmn === r[2]) sc += 3; else sc -= 5; }
          if (q.op && r[7] && this.opMatch(q.op, r[7])) sc += 1;
          if (r[9] === 'ref') sc += .5; if (c.eci) sc += 4;
          if (sc > bs) { bs = sc; best = { r, exact: sc >= 4 }; }
        }
      }
      if (best && bs > 0) out.set(key, { lat: best.r[3], lon: best.r[4], addr: best.r[5], az: best.r[6], op: best.r[7], tech: best.r[8], lac: best.r[1], src: best.r[9], approx: !best.exact });
      else out.set(key, null);
    }
    return out;
  },
  /* ---- write records (merge) ---- */
  async upsertMany(recs, mode) {
    // mode 'ref': imported list, overwrites; 'learn': never overwrites a reference record that has coordinates
    const byShard = new Map(); for (const r of recs) { const s = this.shardOf(r[0]); let l = byShard.get(s); if (!l) byShard.set(s, l = []); l.push(r); }
    const m = await this.loadMeta(); let added = 0, updated = 0; const keyOf = r => r[0] + '|' + r[1] + '|' + r[2];
    const todo = Array.from(byShard.entries()); let idx = 0;
    const worker = async () => {
      while (idx < todo.length) {
        const [s, list] = todo[idx++]; let arr = []; try { arr = (await Vault.get('cells:' + s)) || []; } catch { }
        const mp = new Map(arr.map(r => [keyOf(r), r]));
        for (const r of list) {
          const k = keyOf(r), ex = mp.get(k);
          if (!ex) { mp.set(k, r); added++; m.byOp[r[7] || '?'] = m.byOp[r[7] || '?'] || { ref: 0, learn: 0 }; m.byOp[r[7] || '?'][r[9]]++; continue; }
          if (mode === 'learn') { if (ex[9] === 'ref' && ex[3] != null) continue; if (r[3] != null) { ex[3] = r[3]; ex[4] = r[4]; } if (r[5] && !ex[5]) ex[5] = r[5]; ex[10] = (ex[10] || 1) + 1; updated++; continue; }
          if (ex[9] !== r[9]) { const o = (m.byOp[ex[7] || '?'] = m.byOp[ex[7] || '?'] || { ref: 0, learn: 0 }); if (o[ex[9]] > 0) o[ex[9]]--; const n = (m.byOp[r[7] || '?'] = m.byOp[r[7] || '?'] || { ref: 0, learn: 0 }); n[r[9]]++; }
          mp.set(k, r); updated++;
        }
        await Vault.put('cells:' + s, Array.from(mp.values())); this.cache.delete(s);
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    m.total += added; m.ver = (m.ver || 0) + 1; await this.saveMeta(); return { added, updated };
  },
  /* ---- learn from a CDR ---- */
  rowToRec(r) {
    const p = this.parseCell(r.cell || r.lastCell, r.lac, ''); if (!p) return null;
    const la = r.lat, lo = r.lon; const geo = this.inIndia(la, lo); if (!geo && !r.addr) return null;
    return [p.ci, p.lac, p.plmn, geo ? la : null, geo ? lo : null, r.addr || '', '', r.op || '', Number(p.ci) > 65535 ? '4G/5G' : '2G/3G', 'learn', 1];
  },
  async learn(rows) {
    const seen = new Map(); for (const r of rows) { if (r.cellSrc || !(r.cell || r.lastCell)) continue; const rec = this.rowToRec(r); if (!rec) continue; const k = rec[0] + '|' + rec[1] + '|' + rec[2]; if (!seen.has(k)) seen.set(k, rec); }
    if (!seen.size) return { added: 0, updated: 0, seen: 0 };
    const x = await this.upsertMany(Array.from(seen.values()), 'learn'); x.seen = seen.size; return x;
  },
  /* ---- fill location of CDR rows that have none ---- */
  async enrichCase(force) {
    const c = S.cur; if (!c || !c.telecom.cdr.length) return { cells: 0, found: 0, approx: 0, missing: [] };
    const m = await this.loadMeta(); if (!m.total) return { cells: 0, found: 0, approx: 0, missing: [], empty: true };
    const ver = m.ver || 0; const need = c.telecom.cdr.filter(r => (r.lat == null || r.lon == null) && (r.cell || r.lastCell) && (force || r.cdbv !== ver));
    if (!need.length) return { cells: 0, found: 0, approx: 0, missing: [] };
    const qs = new Map(); for (const r of need) { const cell = r.cell || r.lastCell; const k = cell + '|' + (r.lac || '') + '|' + (r.op || ''); if (!qs.has(k)) qs.set(k, { cell, lac: r.lac || '', op: r.op || '' }); }
    const res = await this.resolve(Array.from(qs.values())); let found = 0, approx = 0, rowsSet = 0; const missing = new Map();
    for (const r of need) {
      const cell = r.cell || r.lastCell; const hit = res.get(cell + '|' + (r.lac || '') + '|' + (r.op || '')); r.cdbv = ver;
      if (hit && this.inIndia(hit.lat, hit.lon)) { r.lat = hit.lat; r.lon = hit.lon; if (!r.addr && hit.addr) r.addr = String(hit.addr).slice(0, 160); r.cellSrc = hit.approx ? 'DB~' : 'DB'; if (hit.az !== '' && hit.az != null) r.az = hit.az; rowsSet++; }
      else if (hit && !r.addr && hit.addr) { r.addr = String(hit.addr).slice(0, 160); r.cellSrc = hit.approx ? 'DB~' : 'DB'; rowsSet++; }
      else if (!hit) missing.set(cell, (missing.get(cell) || 0) + 1);
    }
    for (const h of res.values()) if (h) { found++; if (h.approx) approx++; }
    if (rowsSet || need.length) { markDirty('telecom'); if (typeof CDA !== 'undefined') CDA.cache = null; }
    return { cells: qs.size, found, approx, rows: rowsSet, missing: Array.from(missing.entries()).sort((a, b) => b[1] - a[1]).map(([cell, n]) => ({ cell, n })) };
  },
  async autoEnrich() { const c = S.cur; if (!c) return null; const m = await this.loadMeta(); const key = c.meta.id + '|' + c.telecom.cdr.length + '|' + (m.ver || 0); if (key === this.lastEnrich) return null; const r = await this.enrichCase(); this.lastEnrich = key; return r; },
  /* hook: called after a CDR file is committed to the case */
  async afterCdrImport(rows) {
    if (!rows.length) return null; const out = {}; try { out.learn = await this.learn(rows); out.enrich = await this.enrichCase(); } catch (e) { console.warn('Cell database', e); return null; }
    const L = out.learn, E = out.enrich; const bits = [];
    if (L.added) bits.push(L.added + ' new cell ID' + (L.added > 1 ? 's' : '') + ' saved to the database');
    if (E.found) bits.push(E.found + ' cell' + (E.found > 1 ? 's' : '') + ' located from the database' + (E.approx ? ' (' + E.approx + ' approximate)' : ''));
    if (E.missing && E.missing.length) bits.push(E.missing.length + ' not in the database');
    if (bits.length) toast('Cell IDs: ' + bits.join(' · '), E.missing && E.missing.length ? 'warn' : 'ok', 6500);
    this.lastEnrich = ''; return out;
  },
  /* ---- tower list import (streamed) ---- */
  HMAP: {
    mcc: ['mcc', 'mobilecountrycode'], mnc: ['mnc', 'net', 'network', 'mobilenetworkcode'], lac: ['lac', 'tac', 'lactac', 'area', 'locationareacode', 'trackingareacode', 'lacid', 'tacid'],
    cell: ['cgi', 'ecgi', 'eci', 'cellid', 'cid', 'ci', 'cell', 'cellidentity', 'cellglobalid', 'ncgi', 'nci'], enb: ['enb', 'enodebid', 'enbid', 'siteid', 'btsid'], sector: ['sector', 'sectorid', 'cellno', 'cellnumber', 'localcellid'],
    lat: ['lat', 'latitude', 'sitelatitude', 'latdeg', 'y'], lon: ['lon', 'lng', 'long', 'longitude', 'sitelongitude', 'londeg', 'x'], az: ['azimuth', 'azi', 'bearing', 'direction', 'antennaazimuth', 'azimuthdeg'],
    op: ['operator', 'provider', 'tsp', 'carrier', 'operatorname', 'network name'], tech: ['radio', 'tech', 'technology', 'rat', 'nettype', 'band'],
    addr: ['address', 'siteaddress', 'location', 'locationaddress', 'fulladdress', 'cellsiteaddress', 'celladdress', 'sitelocation', 'towerlocation', 'installationaddress'], name: ['site', 'sitename', 'name', 'btsname', 'towername', 'cellname'],
    city: ['city', 'town', 'locality', 'village'], dist: ['district'], pin: ['pincode', 'pin', 'zip'], circle: ['circle', 'lsa', 'licensedservicearea']
  },
  mapHeader(cols) { const idx = {}; const n = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); cols.forEach((c, i) => { const k = n(c); for (const f of Object.keys(this.HMAP)) if (idx[f] == null && this.HMAP[f].includes(k)) { idx[f] = i; break; } }); return idx; },
  opFromName(n) { n = String(n || '').toLowerCase(); return /airtel|bharti/.test(n) ? 'Airtel' : /jio|reliance/.test(n) ? 'Jio' : /\bvi\b|vodafone|idea|_vi_|vil/.test(n) ? 'Vi' : /bsnl/.test(n) ? 'BSNL' : ''; },
  rowToTower(row, h, opts) {
    const g = f => h[f] != null ? String(row[h[f]] == null ? '' : row[h[f]]).trim() : '';
    const la = parseFloat(g('lat')), lo = parseFloat(g('lon')); if (!this.inIndia(la, lo)) return { skip: 'nogeo' };
    let plmn = (g('mcc') && g('mnc')) ? g('mcc') + String(g('mnc')).padStart(2, '0') : ''; let lac = g('lac'); let cellRaw = g('cell'); const op = g('op') || opts.operator || '';
    let p = null;
    if (cellRaw) p = this.parseCell(cellRaw, lac, plmn);
    else if (g('enb') && g('sector')) p = { ci: String(Number(g('enb')) * 256 + Number(g('sector'))), lac: '', plmn, alt: null };
    if (!p) return { skip: 'nocell' }; if (lac && !p.lac) p.lac = String(Number(lac) || ''); if (!p.plmn) p.plmn = plmn;
    const addr = [g('name'), g('addr'), g('city'), g('dist'), g('pin')].filter(Boolean).join(', ').slice(0, 200);
    const tech = g('tech') || (Number(p.ci) > 65535 ? '4G/5G' : '2G/3G'); const az = g('az');
    const recs = [[p.ci, p.lac, p.plmn, la, lo, addr, az, op, tech, 'ref', 1]]; if (p.alt) recs.push([p.alt, '', p.plmn, la, lo, addr, az, op, tech, 'ref', 1]);
    return { recs };
  },
  async importFile(file, opts, onProg) {
    opts = opts || {}; opts.operator = opts.operator || this.opFromName(file.name); const st = { rows: 0, kept: 0, nogeo: 0, nocell: 0, added: 0, updated: 0, name: file.name }; let h = null, hdrRows = 0; let batch = [];
    const flush = async () => { if (!batch.length) return; const b = batch; batch = []; const x = await this.upsertMany(b, 'ref'); st.added += x.added; st.updated += x.updated; };
    const handle = async row => {
      if (!h) { hdrRows++; const m = this.mapHeader(row); if ((m.cell != null || (m.enb != null && m.sector != null)) && m.lat != null && m.lon != null) h = m; else if (hdrRows > 40) throw new Error('Header row with cell id, latitude and longitude columns not found in ' + file.name); return; }
      st.rows++; const t = this.rowToTower(row, h, opts); if (t.skip) { st[t.skip]++; return; } for (const r of t.recs) { batch.push(r); st.kept++; } if (batch.length >= 150000) await flush();
    };
    if (/\.(xlsx|xls|xlsb)$/i.test(file.name)) {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' }); for (const sn of wb.SheetNames) { h = null; hdrRows = 0; const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: false, defval: '' }); let i = 0; for (const r of rows) { await handle(r); if (++i % 20000 === 0) onProg && onProg({ read: i, total: rows.length, st }); } }
    } else {
      const reader = file.stream().getReader(); let dec = null, buf = '', read = 0, delim = null;
      for (; ;) {
        const { done, value } = await reader.read(); if (done) break; read += value.length;
        if (!dec) { dec = new TextDecoder('utf-8'); try { new TextDecoder('utf-8', { fatal: true }).decode(value.subarray(0, Math.max(0, Math.min(value.length, 60000) - 4))); } catch { dec = new TextDecoder('windows-1252'); } }
        buf += dec.decode(value, { stream: true }); const lines = buf.split(/\r?\n/); buf = lines.pop();
        for (const ln of lines) { if (!ln) continue; if (!delim) { const c = { ',': 0, '|': 0, ';': 0, '\t': 0 }; for (const ch of ln) if (ch in c) c[ch]++; delim = Object.keys(c).sort((a, b) => c[b] - c[a])[0]; } await handle(this.split(ln, delim)); }
        onProg && onProg({ read, total: file.size, st }); await new Promise(r => setTimeout(r, 0));
      }
      if (buf) await handle(this.split(buf, delim || ','));
    }
    await flush(); onProg && onProg({ read: file.size, total: file.size, st }); this.cache.clear(); this.lastEnrich = ''; return st;
  },
  split(line, d) { if (line.indexOf('"') < 0) return line.split(d); const o = []; let cur = '', q = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; } else if (ch === d && !q) { o.push(cur); cur = ''; } else cur += ch; } o.push(cur); return o; },
  /* ---- export / clear ---- */
  async exportLearned() {
    const rows = [['MCC-MNC', 'LAC/TAC', 'Cell ID', 'Latitude', 'Longitude', 'Address', 'Operator', 'Technology', 'Times seen']];
    for (let s = 0; s < this.SH; s++) { let arr = []; try { arr = (await Vault.get('cells:' + s)) || []; } catch { } for (const r of arr) if (r[9] === 'learn') rows.push([r[2], r[1], r[0], r[3] == null ? '' : r[3], r[4] == null ? '' : r[4], r[5], r[7], r[8], r[10]]); }
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows.map((r, i) => i ? r.map(safeCell) : r)), 'Learned cells'); XLSX.writeFile(wb, `${CONFIG.FILE_PREFIX}_learned_cell_ids.xlsx`); return rows.length - 1;
  },
  async clear(which) {
    const m = await this.loadMeta();
    for (let s = 0; s < this.SH; s++) { let arr = null; try { arr = await Vault.get('cells:' + s); } catch { } if (!arr || !arr.length) continue; const keep = which === 'all' ? [] : arr.filter(r => r[9] !== which); if (keep.length === arr.length) continue; if (keep.length) await Vault.put('cells:' + s, keep); else await Vault.del('cells:' + s); }
    this.cache.clear(); if (which === 'all') { this.meta = { total: 0, byOp: {}, ver: (m.ver || 0) + 1, updated: Date.now() }; } else { let t = 0; for (const o of Object.values(m.byOp)) { t += (o.ref || 0) + (o.learn || 0) - (o[which] || 0); o[which] = 0; } m.total = t; m.ver = (m.ver || 0) + 1; }
    await this.saveMeta(); this.lastEnrich = '';
  },
  async search(text, lacHint) { const out = []; for (const c of this.candidates(text, lacHint, '')) { const m = await this.shard(this.shardOf(c.ci)); for (const r of (m.get(c.ci) || [])) out.push(r); } return out; },
  /* ---- SDR ---- */
  async loadSdr() { if (this.sdrLoaded || !Vault.key) return; try { for (const k of await Vault.keys('sdr:')) { const v = await Vault.get(k); if (v) this.sdrMap.set(k.slice(4), v); } } catch (e) { console.warn(e); } this.sdrLoaded = true; },
  getSdr(num) { const m = S.cur && S.cur.telecom.meta && S.cur.telecom.meta[num]; return (m && m.sdr) || this.sdrMap.get(num) || null; },
  async saveSdr(num, sdr) { if (!num || !sdr) return; const rec = Object.assign({}, sdr, { num, at: nowStamp() }); const c = S.cur; if (c) { c.telecom.meta = c.telecom.meta || {}; c.telecom.meta[num] = Object.assign(c.telecom.meta[num] || {}, { sdr: rec }); } this.sdrMap.set(num, rec); try { await Vault.put('sdr:' + num, rec); } catch (e) { console.warn(e); } }
};

/* ---------- SDR found in the CDR header block (rows above the table) ---------- */
const SDR_FIELDS = {
  name: ['name', 'subscribername', 'customername', 'nameofsubscriber', 'nameofcustomer', 'nameofthesubscriber', 'subscriber', 'customer'], father: ['fathername', 'fathersname', 'fatherhusbandname', 'fatherorhusbandname', 'husbandname', 'relationname', 'guardianname'],
  address: ['address', 'subscriberaddress', 'customeraddress', 'localaddress', 'installationaddress', 'permanentaddress', 'residentialaddress', 'addressofsubscriber', 'addressofthesubscriber', 'communicationaddress'],
  dob: ['dob', 'dateofbirth'], idType: ['idproof', 'idproofype', 'idprooftype', 'photoid', 'poitype', 'idtype', 'kyctype', 'identityproof', 'proofofidentity'], idNo: ['idproofnumber', 'idproofno', 'idnumber', 'idno', 'poinumber', 'photoidnumber', 'aadhaarno', 'aadharno'],
  altNo: ['alternatenumber', 'alternatecontactnumber', 'alternatecontactno', 'altno', 'alternatemobile', 'alternatephone'], activated: ['activationdate', 'dateofactivation', 'simactivationdate', 'connectiondate', 'dateofissue', 'dateofconnection'],
  imsi: ['imsi', 'imsino', 'imsinumber'], simType: ['connectiontype', 'prepaidpostpaid', 'typeofconnection', 'simtype', 'planttype', 'subscribertype'], circle: ['circle', 'lsa', 'licensedservicearea', 'servicearea'], operator: ['operator', 'serviceprovider', 'tsp', 'network'],
  email: ['email', 'emailid', 'emailaddress'], pin: ['pincode', 'pin']
};
function cdrSdr(grid, hdr) {
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); const found = {}; const end = Math.max(0, hdr.row); const look = new Map();
  for (const [f, syn] of Object.entries(SDR_FIELDS)) for (const s of syn) look.set(s, f);
  const take = (label, val) => { const f = look.get(norm(label)); val = String(val == null ? '' : val).trim(); if (!f || !val || found[f] || val.length > 250 || /^(na|n\/a|nil|null|-|none)$/i.test(val)) return; found[f] = val; };
  for (let r = 0; r < Math.min(end, 80); r++) {
    const cells = (grid.rows[r] || []).map(cellText).filter(Boolean);
    for (let i = 0; i < cells.length; i++) { const c = cells[i]; const m = c.match(/^([A-Za-z][A-Za-z0-9 .\/()&'_-]{1,40}?)\s*[:：]\s*(.+)$/); if (m) take(m[1], m[2]); else if (i + 1 < cells.length && look.has(norm(c))) { take(c, cells[i + 1]); i++; } }
  }
  const keys = Object.keys(found).filter(k => !['imsi', 'circle', 'operator', 'simType'].includes(k)); if (keys.length < 2) return null; return found;
}
const sdrHtml = (s, title) => s ? `<div class="card" style="margin-top:8px"><h4>${esc(title || 'Subscriber details (SDR)')} <span class="dim small">${esc(s.src || '')}${s.at ? ' · saved ' + esc(s.at) : ''}</span></h4><div class="kv">${[['name', 'Name'], ['father', 'Father / husband'], ['address', 'Address'], ['pin', 'PIN'], ['dob', 'Date of birth'], ['idType', 'ID proof'], ['idNo', 'ID number'], ['altNo', 'Alternate number'], ['activated', 'Activation date'], ['simType', 'Connection type'], ['operator', 'Operator'], ['circle', 'Circle'], ['imsi', 'IMSI'], ['email', 'E-mail']].filter(([k]) => s[k]).map(([k, l]) => `<div>${l}</div><div>${esc(s[k])}</div>`).join('')}</div></div>` : '';

/* ---------- Cell ID Database screen ---------- */
VIEWS.celldb = async el => {
  const m = await CELLDB.loadMeta(); await CELLDB.loadSdr(); if (S.view !== 'celldb') return;
  const ops = Object.entries(m.byOp || {}).map(([op, v]) => ({ op, ref: v.ref || 0, learn: v.learn || 0 })).filter(x => x.ref + x.learn > 0).sort((a, b) => (b.ref + b.learn) - (a.ref + a.learn));
  const sdrs = Array.from(CELLDB.sdrMap.values()).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  el.innerHTML = pageHead('Cell ID Database', 'Tower lists you import once, plus every cell ID learned from uploaded CDRs. Used to place the cells of every CDR on a location. Stored encrypted under your vault key.') +
    `<div class="grid g4" style="margin-bottom:12px">${kpi('Cell IDs stored', nfmt(m.total || 0), m.updated ? 'updated ' + new Date(m.updated).toLocaleString('en-IN') : 'nothing imported yet')}${kpi('From tower lists', nfmt(sum(ops, x => x.ref)), '', 'rgba(0,229,255,.3)')}${kpi('Learned from CDRs', nfmt(sum(ops, x => x.learn)), 'grows with every CDR', 'rgba(0,255,157,.3)')}${kpi('SDR records', sdrs.length, 'subscriber details found in CDRs', 'rgba(255,179,0,.3)')}</div>
    <div class="card"><h4>Import tower list</h4><p class="small dim" style="margin-top:0">CSV / TXT (comma, pipe, semicolon or tab) or Excel, one or many files, any size — read in pieces. Needs columns for the cell ID (CGI / ECI / Cell ID, optionally LAC / TAC, MCC, MNC) and latitude and longitude; address, azimuth, operator and site name are used when present. The operator is read from the file name or an Operator column. Windows-1252 files are handled. Importing the same cell again updates it.</p>
      <div class="row"><input type="file" id="cdbFile" multiple accept=".csv,.txt,.tsv,.xlsx,.xls,.xlsb"><label class="row small">Operator if the file does not say <select id="cdbOp"><option value="">Auto (file name / column)</option><option>Airtel</option><option>Jio</option><option>Vi</option><option>BSNL</option></select></label><button class="btn-p" id="cdbGo">Import</button></div><div class="small" id="cdbProg" style="margin-top:8px"></div></div>
    <div class="grid g2" style="margin-top:12px"><div class="card"><h4>By operator</h4>${simpleTable([{ label: 'Operator', get: x => x.op }, { label: 'Tower lists', get: x => nfmt(x.ref), num: 1 }, { label: 'Learned', get: x => nfmt(x.learn), num: 1 }], ops, { maxH: 260, empty: 'No cell IDs yet — import a tower list, or upload a CDR that carries site addresses.' })}</div>
      <div class="card"><h4>Look up a cell</h4><div class="row"><input id="cdbQ" placeholder="404-45-1234-56789 or Cell ID / ECI" class="mono" style="width:250px"><input id="cdbL" placeholder="LAC (optional)" class="mono" style="width:120px"><button id="cdbQGo">Search</button></div><div id="cdbR" style="margin-top:8px"></div></div></div>
    <div class="card" style="margin-top:12px"><h4>Backup and housekeeping</h4><div class="row"><button id="cdbExp">⇩ Export learned cell IDs (Excel)</button><button id="cdbClrL" class="btn-d">Clear learned only</button><button id="cdbClrA" class="btn-d">Clear entire database</button></div><p class="small dim" style="margin:8px 0 0">The exported file can be imported again here or in any other tool. Clearing does not touch any case.</p></div>
    <div class="card" style="margin-top:12px"><h4>Subscriber (SDR) records saved from CDRs</h4>${simpleTable([{ label: 'Number', html: x => `<span class="mono">${esc(x.num)}</span>` }, { label: 'Name', get: x => x.name || '' }, { label: 'Address', get: x => x.address || '' }, { label: 'ID proof', get: x => [x.idType, x.idNo].filter(Boolean).join(' ') }, { label: 'Activated', get: x => x.activated || '' }, { label: 'From file', get: x => x.src || '' }, { label: 'Saved', get: x => x.at || '' }], sdrs, { maxH: 300, empty: 'None yet. When a CDR file carries subscriber details above its table, they are saved here automatically.' })}</div>`;
  const prog = $('#cdbProg', el);
  $('#cdbGo', el).onclick = async () => {
    const files = Array.from($('#cdbFile', el).files); if (!files.length) return toast('Choose a tower file first.', 'warn'); const btn = $('#cdbGo', el); btn.disabled = true; let tot = { rows: 0, kept: 0, added: 0, updated: 0, nogeo: 0, nocell: 0 };
    try {
      for (const f of files) { const st = await CELLDB.importFile(f, { operator: $('#cdbOp', el).value }, p => { prog.textContent = `${f.name}: ${Math.round(100 * p.read / Math.max(1, p.total))}% · ${nfmt(p.st.kept)} cells kept of ${nfmt(p.st.rows)} rows`; }); for (const k of Object.keys(tot)) tot[k] += st[k] || 0; }
      prog.textContent = `Done: ${nfmt(tot.kept)} cells read from ${nfmt(tot.rows)} rows — ${nfmt(tot.added)} new, ${nfmt(tot.updated)} updated${tot.nogeo ? ', ' + nfmt(tot.nogeo) + ' skipped (no coordinates)' : ''}${tot.nocell ? ', ' + nfmt(tot.nocell) + ' skipped (no cell id)' : ''}.`; toast('Tower list imported', 'ok'); await audit('Cell ID database import', files.map(f => f.name).join(', ') + ' kept=' + tot.kept); go('celldb');
    } catch (e) { console.error(e); prog.textContent = ''; toast(e.message, 'err', 7000); btn.disabled = false; }
  };
  $('#cdbQGo', el).onclick = async () => {
    const q = $('#cdbQ', el).value.trim(); if (!q) return; const L = $('#cdbL', el).value.trim(); const rs = await CELLDB.search(q, L);
    $('#cdbR', el).innerHTML = simpleTable([{ label: 'Cell', html: x => `<b class="mono">${esc(x[0])}</b>` }, { label: 'LAC/TAC', get: x => x[1] }, { label: 'MCC-MNC', get: x => x[2] }, { label: 'Operator', get: x => x[7] }, { label: 'Tech', get: x => x[8] }, { label: 'Lat, Long', get: x => x[3] == null ? '' : x[3] + ', ' + x[4] }, { label: 'Address', get: x => x[5] }, { label: 'Source', html: x => badge(x[9] === 'ref' ? 'Tower list' : 'Learned', x[9] === 'ref' ? 'blue' : 'green') }, { label: 'Map', html: x => x[3] != null ? `<a class="btn-sm" target="_blank" rel="noopener noreferrer" href="${esc(gmapsUrl('', x[3], x[4]))}">Map</a>` : '' }], rs, { maxH: 260, empty: 'Not found in the database.' });
  };
  $('#cdbExp', el).onclick = async () => { const n = await CELLDB.exportLearned(); toast(n + ' learned cell IDs exported', 'ok'); };
  $('#cdbClrL', el).onclick = async () => { if (await confirmBox('Clear learned cell IDs', 'Remove the cell IDs learned from CDRs? Imported tower lists stay.', 'Clear', true)) { await CELLDB.clear('learn'); go('celldb'); } };
  $('#cdbClrA', el).onclick = async () => { if (await confirmBox('Clear the entire cell database', 'Remove every cell ID — imported lists and learned ones? Cases are not affected. You will need to import the tower lists again.', 'Clear all', true)) { await CELLDB.clear('all'); go('celldb'); } };
};
