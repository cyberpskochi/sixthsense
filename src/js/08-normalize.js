/* ------------------------------ normalisers per data kind ------------------------------ */
function preText(grid, hdrRow) {
  if (grid.pre) return grid.pre;
  return grid.rows.slice(0, Math.max(0, hdrRow)).map(r => r.map(cellText).filter(Boolean).join(' ')).join('\n');
}
function extractStmtMeta(text, fileName) {
  const t = String(text || ''); const meta = {};
  let m = t.match(/(?:a\/?c|account)\s*(?:no|number|num|#)?\.?\s*[:\-–]?\s*([0-9]{6,20})/i) || t.match(/(?:a\/?c|account)[^0-9\n]{0,25}([0-9]{9,20})/i);
  if (m) meta.acctNo = m[1];
  if (!meta.acctNo) { const f = String(fileName).match(/(\d{9,18})/); if (f) meta.acctNo = f[1]; }
  m = t.match(/(?:account\s*holder(?:'s)?\s*name|account\s*name|customer\s*name|a\/c\s*name|name\s*of\s*(?:the\s*)?(?:account\s*)?holder|^name)\s*[:\-–]\s*([A-Za-z][A-Za-z .&']{2,60})/im); if (m) meta.holder = m[1].trim().replace(/\s{2,}.*/, '').toUpperCase();
  m = t.toUpperCase().match(/\b([A-Z]{4}0[A-Z0-9]{6})\b/); if (m) meta.ifsc = m[1];
  m = t.match(/(?:from|period)\s*[:\-]?\s*([0-9]{1,2}[-/. ][0-9A-Za-z]{1,9}[-/. ][0-9]{2,4})\s*(?:to|-|–)\s*([0-9]{1,2}[-/. ][0-9A-Za-z]{1,9}[-/. ][0-9]{2,4})/i);
  if (m) { const a = parseDateTime(m[1]), b = parseDateTime(m[2]); if (a && b) meta.period = [a.ts, b.ts]; }
  m = t.match(/opening\s*balance[^0-9\-]{0,20}(-?[\d,]+\.\d{1,2})/i); if (m) meta.opening = parseAmount(m[1]).v;
  m = t.match(/closing\s*balance[^0-9\-]{0,20}(-?[\d,]+\.\d{1,2})/i); if (m) meta.closing = parseAmount(m[1]).v;
  const b = detectBank(t, fileName); if (b) meta.bank = b.code;
  return meta;
}
const SUMMARY_RX = /^(opening|closing)\s*balance|^(grand\s*)?total|^b\/f|^c\/f|brought\s*forward|carried\s*forward|^page\s*\d|statement\s*summary|^\*+\s*end|end\s*of\s*statement|computer\s*generated|^dr\s*count|^cr\s*count/i;

function normStatement(grid, hdr, opts) {
  const { map } = hdr; const rows = grid.rows; const start = hdr.row + (hdr.rows || 1);
  const dateVals = []; for (let r = start; r < Math.min(rows.length, start + 400); r++) if (map.date !== undefined) dateVals.push(rows[r][map.date]);
  const order = opts.dateOrder || detectDateOrder(dateVals);
  const out = []; const rejects = []; let opening = null, closing = null; let prev = null;
  for (let r = start; r < rows.length; r++) {
    const row = rows[r]; const ref = grid.rowRef[r] || { row: r + 1 };
    const joined = row.map(cellText).join(' ').trim(); if (!joined) continue;
    const first = cellText(row.find(v => v !== '' && v != null));
    if (SUMMARY_RX.test(first) || SUMMARY_RX.test(cellText(row[map.narr]))) {
      const nums = row.map(v => parseAmount(v).v).filter(v => v != null);
      if (/opening/i.test(joined) && nums.length) opening = nums[nums.length - 1];
      if (/closing/i.test(joined) && nums.length) closing = nums[nums.length - 1];
      continue;
    }
    if (map.date !== undefined && normKey(cellText(row[map.date])) && FIELDS.statement.f.date.includes(normKey(cellText(row[map.date])))) continue; // repeated header
    const d = map.date !== undefined ? parseDateTime(row[map.date], order) : null;
    let dr = map.debit !== undefined ? parseAmount(row[map.debit]) : { v: null };
    let cr = map.credit !== undefined ? parseAmount(row[map.credit]) : { v: null };
    let amt = map.amount !== undefined ? parseAmount(row[map.amount]) : { v: null };
    const narrCell = map.narr !== undefined ? cellText(row[map.narr]) : '';
    if (!d) {
      const hasAmt = [dr.v, cr.v, amt.v].some(v => v != null && v !== 0);
      if (!hasAmt && prev && narrCell) { prev.narr = (prev.narr + ' ' + narrCell).trim(); prev.raw += ' | ' + joined.slice(0, 160); continue; } // continuation line
      if (!hasAmt) continue;
      rejects.push({ row: ref, reason: 'Date missing or unreadable', raw: joined.slice(0, 300) }); continue;
    }
    let D = 0, C = 0;
    if (map.debit !== undefined || map.credit !== undefined) { D = Math.abs(dr.v || 0); C = Math.abs(cr.v || 0); }
    if (!D && !C && amt.v != null) {
      let ind = amt.ind;
      if (map.drcr !== undefined) { const t = String(cellText(row[map.drcr])).trim().toUpperCase(); if (/^(D|DR|DEBIT|W|WDL|WITHDRAWAL)/.test(t)) ind = 'DR'; else if (/^(C|CR|CREDIT|DEP|DEPOSIT)/.test(t)) ind = 'CR'; }
      if (!ind) ind = amt.v < 0 ? 'DR' : null;
      if (!ind) { rejects.push({ row: ref, reason: 'Debit/credit direction not stated in source', raw: joined.slice(0, 300) }); continue; }
      if (ind === 'DR') D = Math.abs(amt.v); else C = Math.abs(amt.v);
    }
    if (!D && !C) { rejects.push({ row: ref, reason: 'No debit/credit amount', raw: joined.slice(0, 300) }); continue; }
    let bal = map.balance !== undefined ? parseAmount(row[map.balance]) : { v: null };
    let balV = bal.v; if (balV != null && bal.ind === 'DR') balV = -Math.abs(balV);
    // time: explicit column → posting date/time → date cell time → narration
    let ts = d.ts, hasTime = d.hasTime;
    const tryT = v => { const t = parseTimeStr(typeof v === 'object' && v && v.d ? pad(v.d[3]) + ':' + pad(v.d[4]) + ':' + pad(v.d[5]) : v); if (t && (t[0] || t[1] || t[2])) { const day = new Date(d.ts); ts = mkTs(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), t[0], t[1], t[2]); hasTime = true; return true; } return false; };
    if (!hasTime && map.time !== undefined) tryT(row[map.time]);
    if (!hasTime && map.postDate !== undefined) { const pd = parseDateTime(row[map.postDate], order); if (pd && pd.hasTime && isoDate(pd.ts) === isoDate(d.ts)) { ts = pd.ts; hasTime = true; } }
    if (!hasTime && narrCell) { const tm = narrCell.match(RX.time); if (tm && /\d{1,2}:\d{2}:\d{2}/.test(tm[0])) tryT(tm[0]); }
    const refCell = map.ref !== undefined ? cellText(row[map.ref]) : '';
    const utrCell = map.utr !== undefined ? cellText(row[map.utr]) : '';
    const x = extractNarr(narrCell + ' ' + (utrCell || ''), refCell || utrCell);
    const acctCell = map.acctNo !== undefined ? normAcct(cellText(row[map.acctNo])) : '';
    const t = {
      acctNoRaw: acctCell || opts.acctNo || '', ts, hasTime, vdate: map.valueDate !== undefined ? (parseDateTime(row[map.valueDate], order) || {}).ts || null : null,
      dr: round2(D), cr: round2(C), bal: balV == null ? null : round2(balV), narr: narrCell, ref: refCell, utr: (utrCell && utrCell.replace(/\s/g, '').toUpperCase()) || x.utr,
      txnId: map.txnId !== undefined ? cellText(row[map.txnId]) : '', channel: (map.channel !== undefined && detectChannel(cellText(row[map.channel])) !== 'UNKNOWN') ? detectChannel(cellText(row[map.channel])) : x.channel,
      upi: x.upi, cpAcct: x.cpAcct, cpMasked: x.cpMasked, cpIfsc: x.ifsc, cpMobile: x.mobile, cpName: x.cpName,
      src: { file: opts.fileName, sheet: grid.sheet, page: ref.page || null, row: ref.row }, raw: joined.slice(0, 300), flags: []
    };
    if (!t.hasTime) t.flags.push('NO_TIME');
    out.push(t); prev = t;
  }
  // group by account (bulk bank replies may carry many accounts in one sheet)
  const groups = groupBy(out, t => t.acctNoRaw || '');
  const res = [];
  for (const [acctNo, list] of groups) {
    // order: statements may be newest-first
    if (list.length > 1 && list[0].ts > list[list.length - 1].ts) list.reverse();
    // balance continuity check
    let fails = 0, checks = 0;
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1], b = list[i]; if (a.bal == null || b.bal == null) continue; checks++;
      if (Math.abs(round2(a.bal + b.cr - b.dr) - b.bal) > 0.02) { fails++; b.flags.push('BAL_MISMATCH'); }
    }
    res.push({ acctNo, txns: list, balChecks: checks, balFails: fails, order });
  }
  return { groups: res, rejects, opening, closing, order };
}

function normKyc(grid, hdr, opts) {
  const { map } = hdr; const out = [];
  for (let r = hdr.row + (hdr.rows || 1); r < grid.rows.length; r++) {
    const row = grid.rows[r]; const get = f => map[f] !== undefined ? cellText(row[map[f]]).trim() : '';
    const acctNo = normAcct(get('acctNo')); if (!acctNo || acctNo.length < 5) continue;
    const mobs = get('mobile').split(/[\/,;&\s]+|\bor\b/i).map(normPhone).filter(x => x.length >= 10);
    const alts = get('altMobile').split(/[\/,;&\s]+/).map(normPhone).filter(x => x.length >= 10);
    out.push({ acctNo, holder: get('name').toUpperCase(), mobiles: mobs.slice(0, 1), altMobiles: uniq(mobs.slice(1).concat(alts)), emails: get('email') ? get('email').split(/[,;\s]+/).filter(e => e.includes('@')).map(e => e.toLowerCase()) : [], pan: get('pan').toUpperCase(), address: get('address'), ifsc: get('ifsc').toUpperCase(), bank: get('bank'), branch: get('branch'), custId: get('custId'), openDate: get('openDate'), upi: get('upi').toLowerCase(), roleCell: get('role'), src: { file: opts.fileName, sheet: grid.sheet, row: (grid.rowRef[r] || {}).row } });
  }
  return out;
}

function normIpLog(grid, hdr, opts) {
  const { map } = hdr; const out = []; const rejects = []; const shift = (opts.tzShiftMin || 0) * 60000;
  const dv = []; for (let r = hdr.row + 1; r < Math.min(grid.rows.length, hdr.row + 300); r++) if (map.datetime !== undefined) dv.push(grid.rows[r][map.datetime]);
  const order = opts.dateOrder || detectDateOrder(dv);
  for (let r = hdr.row + (hdr.rows || 1); r < grid.rows.length; r++) {
    const row = grid.rows[r]; const ref = grid.rowRef[r] || { row: r + 1 }; const get = f => map[f] !== undefined ? row[map[f]] : '';
    const ipRaw = cellText(get('ip')); const ip = normIP(ipRaw.split(/[,\s]/)[0]); if (!ip || !/[.:]/.test(ip)) continue;
    let d = parseDateTime(get('datetime'), order);
    if (d && !d.hasTime && map.time !== undefined) { const t = parseTimeStr(get('time')); if (t) { const x = new Date(d.ts); d = { ts: mkTs(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate(), t[0], t[1], t[2]), hasTime: true }; } }
    if (!d) { rejects.push({ row: ref, reason: 'Login date/time unreadable', raw: grid.rows[r].map(cellText).join(' ').slice(0, 300) }); continue; }
    out.push({ acctNoRaw: normAcct(cellText(get('acctNo'))) || opts.acctNo || '', custId: cellText(get('custId')), ts: d.ts + shift, hasTime: d.hasTime, ip, port: +cellText(get('port')) || ipPortFrom(ipRaw) || null, channel: cellText(get('channel')), device: cellText(get('device')), event: cellText(get('event')), utr: cellText(get('utr')).toUpperCase(), mobile: normPhone(cellText(get('mobile'))), src: { file: opts.fileName, sheet: grid.sheet, page: ref.page || null, row: ref.row } });
  }
  return { rows: out, rejects };
}

function normCdr(grid, hdr, opts) {
  const { map } = hdr; const rows = grid.rows; const start = hdr.row + (hdr.rows || 1); const rejects = [];
  const get = (row, f) => map[f] !== undefined ? row[map[f]] : '';
  const dv = []; for (let r = start; r < Math.min(rows.length, start + 300); r++) dv.push(get(rows[r], 'date'));
  const order = opts.dateOrder || detectDateOrder(dv);
  // target number: explicit column > option > most frequent party > filename/header text
  let target = normPhone(opts.target || '');
  if (!target && map.target === undefined && map.aParty !== undefined) {
    const cnt = new Map(); for (let r = start; r < Math.min(rows.length, start + 2000); r++) { const a = normPhone(cellText(get(rows[r], 'aParty'))), b = normPhone(cellText(get(rows[r], 'bParty'))); [a, b].forEach(x => x && cnt.set(x, (cnt.get(x) || 0) + 1)); }
    const top = Array.from(cnt).sort((a, b) => b[1] - a[1])[0]; if (top) target = top[0];
  }
  if (!target && map.target === undefined) { const m = (opts.fileName + ' ' + preText(grid, hdr.row)).match(/(?:\+?91)?([6-9]\d{9})/); if (m) target = m[1]; }
  const out = [];
  for (let r = start; r < rows.length; r++) {
    const row = rows[r]; const ref = grid.rowRef[r] || { row: r + 1 };
    let tgt = map.target !== undefined ? normPhone(cellText(get(row, 'target'))) : target;
    let a = normPhone(cellText(get(row, 'aParty'))), b = normPhone(cellText(get(row, 'bParty')));
    if (!a && !b) continue;
    let d = parseDateTime(get(row, 'date'), order);
    if (d && !d.hasTime) { const t = parseTimeStr(get(row, 'time')); if (t) { const x = new Date(d.ts); d = { ts: mkTs(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate(), t[0], t[1], t[2]), hasTime: true }; } }
    if (!d) { rejects.push({ row: ref, reason: 'Call date/time unreadable', raw: row.map(cellText).join(' ').slice(0, 300) }); continue; }
    const ct = String(cellText(get(row, 'callType'))).toUpperCase();
    let other, dir;
    if (map.aParty === undefined) { other = b; dir = /IN|MTC|MT\b|TERM|RECEIV/.test(ct) ? 'IN' : /OUT|MOC|MO\b|ORIG|DIAL/.test(ct) ? 'OUT' : '?'; }
    else if (tgt && a === tgt) { other = b; dir = 'OUT'; } else if (tgt && b === tgt) { other = a; dir = 'IN'; }
    else { other = b; dir = '?'; if (!tgt) tgt = a; }
    if (/IN|MTC|INCOMING|TERM/.test(ct) && !/OUT/.test(ct)) dir = 'IN'; else if (/OUT|MOC|OUTGOING|ORIG/.test(ct)) dir = 'OUT';
    const kind = /SMS|SMT|SMO/.test(ct) ? 'SMS' : /GPRS|DATA|PDP|INTERNET/.test(ct) ? 'DATA' : 'CALL';
    const dur = parseInt(String(cellText(get(row, 'duration'))).replace(/[^\d:]/g, '').split(':').reduce((s, x) => s * 60 + (+x || 0), 0)) || 0;
    out.push({ target: tgt, other, dir, kind, ts: d.ts + (opts.tzShiftMin || 0) * 60000, hasTime: d.hasTime, dur, cell: cellText(get(row, 'cellId')).replace(/\s/g, ''), lastCell: cellText(get(row, 'lastCell')).replace(/\s/g, ''), lac: cellText(get(row, 'lac')), imei: cellText(get(row, 'imei')).replace(/\D/g, ''), imsi: cellText(get(row, 'imsi')).replace(/\D/g, ''), roam: cellText(get(row, 'roaming')), op: cellText(get(row, 'operator')), addr: cellText(get(row, 'address')).slice(0, 160), lat: parseFloat(cellText(get(row, 'lat'))) || null, lon: parseFloat(cellText(get(row, 'lon'))) || null, src: { file: opts.fileName, sheet: grid.sheet, page: ref.page || null, row: ref.row } });
  }
  return { rows: out, rejects, target };
}

function normIpdr(grid, hdr, opts) {
  const { map } = hdr; const out = []; const rejects = []; const shift = (opts.tzShiftMin || 0) * 60000;
  const dv = []; for (let r = hdr.row + 1; r < Math.min(grid.rows.length, hdr.row + 300); r++) dv.push(grid.rows[r][map.start]);
  const order = opts.dateOrder || detectDateOrder(dv);
  for (let r = hdr.row + (hdr.rows || 1); r < grid.rows.length; r++) {
    const row = grid.rows[r]; const ref = grid.rowRef[r] || { row: r + 1 }; const get = f => map[f] !== undefined ? row[map[f]] : '';
    const ip = normIP(cellText(get('ip'))); if (!ip) continue;
    const s = parseDateTime(get('start'), order); const e = parseDateTime(get('end'), order);
    if (!s) { rejects.push({ row: ref, reason: 'Session start unreadable', raw: row.map(cellText).join(' ').slice(0, 300) }); continue; }
    out.push({ msisdn: normPhone(cellText(get('msisdn'))) || cellText(get('msisdn')), name: cellText(get('subscriber')), ip, privIp: normIP(cellText(get('privIp'))), port: +cellText(get('port')) || null, portEnd: +cellText(get('portEnd')) || null, start: s.ts + shift, end: (e ? e.ts : s.ts) + shift, destIp: normIP(cellText(get('destIp'))), destPort: +cellText(get('destPort')) || null, imei: cellText(get('imei')).replace(/\D/g, ''), imsi: cellText(get('imsi')).replace(/\D/g, ''), cell: cellText(get('cellId')), addr: cellText(get('address')).slice(0, 160), src: { file: opts.fileName, sheet: grid.sheet, page: ref.page || null, row: ref.row } });
  }
  return { rows: out, rejects };
}

function normNcrp(grid, hdr, opts) {
  const { map } = hdr; const out = [];
  for (let r = hdr.row + (hdr.rows || 1); r < grid.rows.length; r++) {
    const row = grid.rows[r]; const get = f => map[f] !== undefined ? row[map[f]] : '';
    const acctNo = normAcct(cellText(get('acctNo'))); const utr = cellText(get('utr')).replace(/\s/g, '').toUpperCase();
    if (!acctNo && !utr) continue;
    const lay = parseInt(String(cellText(get('layer'))).replace(/\D/g, '')); const d = parseDateTime(get('date'));
    out.push({ ackNo: cellText(get('ackNo')), layer: isNaN(lay) ? null : lay, fromAcct: normAcct(cellText(get('fromAcct'))), acctNo, bank: cellText(get('bank')), ifsc: cellText(get('ifsc')).toUpperCase(), utr, amount: parseAmount(get('amount')).v || 0, hold: parseAmount(get('hold')).v || 0, ts: d ? d.ts : null, status: cellText(get('status')), src: { file: opts.fileName, sheet: grid.sheet, row: (grid.rowRef[r] || {}).row } });
  }
  return out;
}

function normSms(grid, hdr, opts) {
  const { map } = hdr; const out = [];
  for (let r = hdr.row + (hdr.rows || 1); r < grid.rows.length; r++) {
    const row = grid.rows[r]; const get = f => map[f] !== undefined ? row[map[f]] : '';
    const msg = cellText(get('message')); if (!msg) continue;
    let d = parseDateTime(get('datetime')); if (d && !d.hasTime) { const t = parseTimeStr(get('time')); if (t) { const x = new Date(d.ts); d = { ts: mkTs(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate(), ...t), hasTime: true }; } }
    if (!d) continue;
    const otp = /\b(otp|one[\s-]?time|verification code|passcode)\b/i.test(msg) ? ((msg.match(/\b(\d{4,8})\b/) || [])[1] || 'yes') : '';
    const amt = (msg.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i) || [])[1];
    out.push({ msisdn: normPhone(cellText(get('msisdn'))) || normPhone(opts.target || ''), ts: d.ts, hasTime: d.hasTime, sender: cellText(get('sender')), msg: msg.slice(0, 500), otp: otp ? 'OTP' : '', amount: amt ? parseAmount(amt).v : null, src: { file: opts.fileName, sheet: grid.sheet, row: (grid.rowRef[r] || {}).row } });
  }
  return out;
}
