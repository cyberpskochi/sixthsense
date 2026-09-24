/* ------------------------------ import pipeline ------------------------------ */
const IMPORT_KINDS = [
  { k: 'statement', t: 'Bank statements', d: 'Complainant, accused & suspect statements — Excel / CSV / PDF (text or scanned). Many files at once; multi-account bank replies are split automatically.' },
  { k: 'kyc', t: 'Account / KYC details', d: 'Bank replies with holder name, registered mobile, alternate numbers, email, PAN, address, customer ID.' },
  { k: 'iplog', t: 'Bank login IP logs', d: 'Internet/mobile-banking & UPI login IP, port, device and time from the bank.' },
  { k: 'cdr', t: 'CDR', d: 'Call detail records of account-linked and alternate numbers (one or many files).' },
  { k: 'ipdr', t: 'IPDR', d: 'Telecom/ISP IP detail records to resolve a login IP + time (+port) to a subscriber number.' },
  { k: 'ncrp', t: 'NCRP money trail', d: 'NCRP layer-wise transaction / put-on-hold report. Sets layers and marks disputed transactions by UTR.' },
  { k: 'sms', t: 'SMS / OTP', d: 'Lawfully obtained SMS / OTP records.' },
  { k: 'atm', t: 'ATM database', d: 'Master list of ATM IDs with address / district / state / latitude-longitude. Stored once (encrypted) and used for every case.' },
  { k: 'ifscdb', t: 'IFSC master list', d: 'RBI / bank IFSC branch list (Excel/CSV). Gives branch, district and state offline for every case.' }
];
const IMP = { queue: [], kind: 'statement', opts: { bank: 'AUTO', role: 'AUTO', dup: 'merge', tz: 'IST', target: '', acctNo: '' }, running: false };

function findTemplate(kind, sig, bank) { return S.templates.find(t => t.kind === kind && t.sig === sig && (!bank || bank === 'AUTO' || !t.bank || t.bank === bank)); }

async function parseQueued(q) {
  q.status = 'parsing'; renderQueue();
  try {
    const r = await readGrids(q.file, (p, m) => { q.msg = m; renderQueueRow(q); });
    q.hash = r.hash; q.type = r.type;
    if (S.cur.work.imports.some(i => i.hash === q.hash && i.kind === q.kind)) q.warn = 'Identical file already imported (same SHA-256)';
    q.grids = r.grids.map(g => {
      const bank = q.opts.bank !== 'AUTO' ? q.opts.bank : null;
      let hdr = detectHeader(g.rows, q.kind, bank || 'GENERIC');
      const sig = hdr.row >= 0 ? headerSignature(g.rows, hdr.row, hdr.rows) : '';
      const tpl = sig && findTemplate(q.kind, sig, bank);
      if (tpl) hdr = { row: hdr.row, rows: tpl.rows, map: Object.assign({}, tpl.map), score: 99, template: tpl.name };
      const pre = preText(g, hdr.row);
      const meta = q.kind === 'statement' ? extractStmtMeta(pre + '\n' + (g.pre || ''), q.file.name) : {};
      const bankCode = bank || (meta.bank) || (tpl && tpl.bank) || 'GENERIC';
      return { g, hdr, sig, meta, bank: bankCode, dateOrder: tpl ? tpl.dateOrder : '' };
    }).filter(x => x.hdr.row >= 0 || x.g.noTable);
    runNormalise(q);
    q.status = q.needsReview ? 'review' : 'ready';
  } catch (e) { console.error(e); q.status = 'error'; q.err = e.message; }
  renderQueue();
}
function runNormalise(q) {
  q.result = []; q.needsReview = false; q.reasons = [];
  if (!q.grids.length) { q.needsReview = true; q.reasons.push('No recognisable table found'); return; }
  let usable = 0;
  for (const G of q.grids) {
    if (!mappingValid(q.kind, G.hdr.map)) { if (q.grids.length === 1) { q.needsReview = true; q.reasons.push('Required columns not identified'); } G.skip = true; continue; }
    G.skip = false; usable++;
    const opts = { fileName: q.file.name, dateOrder: G.dateOrder, acctNo: q.opts.acctNo || G.meta.acctNo, target: q.opts.target, tzShiftMin: q.opts.tz === 'UTC' ? 330 : 0 };
    let res;
    if (q.kind === 'statement') {
      res = normStatement(G.g, G.hdr, opts);
      for (const grp of res.groups) {
        if (!grp.acctNo) { q.needsReview = true; q.reasons.push('Account number not found in file — enter it in review'); }
        if (grp.balChecks && grp.balFails / grp.balChecks > 0.02) { q.needsReview = true; q.reasons.push(`Balance continuity failed on ${grp.balFails}/${grp.balChecks} rows`); }
      }
      const tot = sum(res.groups, x => x.txns.length);
      if (!tot) { q.needsReview = true; q.reasons.push('No transactions parsed'); }
      if (res.rejects.length && res.rejects.length / (tot + res.rejects.length) > 0.02) { q.needsReview = true; q.reasons.push(res.rejects.length + ' rows could not be parsed'); }
      if (G.hdr.score < 3 && !G.hdr.template) { q.needsReview = true; q.reasons.push('Low header-detection confidence'); }
    }
    else if (q.kind === 'kyc') res = { rows: normKyc(G.g, G.hdr, opts), rejects: [] };
    else if (q.kind === 'iplog') res = normIpLog(G.g, G.hdr, opts);
    else if (q.kind === 'cdr') { res = normCdr(G.g, G.hdr, opts); if (!res.target && G.hdr.map.target === undefined) { q.needsReview = true; q.reasons.push('CDR target number not identified — enter it'); } }
    else if (q.kind === 'ipdr') res = normIpdr(G.g, G.hdr, opts);
    else if (q.kind === 'ncrp') res = { rows: normNcrp(G.g, G.hdr, opts), rejects: [] };
    else if (q.kind === 'sms') res = { rows: normSms(G.g, G.hdr, opts), rejects: [] };
    else if (q.kind === 'atm') res = { rows: normAtm(G.g, G.hdr, opts), rejects: [] };
    else if (q.kind === 'ifscdb') res = { rows: normIfscDb(G.g, G.hdr, opts), rejects: [] };
    G.res = res; q.result.push(G);
    if (q.kind !== 'statement' && res.rows && !res.rows.length) { q.needsReview = true; q.reasons.push('No rows parsed from ' + G.g.sheet); }
  }
  if (!usable) { q.needsReview = true; if (!q.reasons.length) q.reasons.push('Required columns not identified'); }
  q.reasons = uniq(q.reasons);
  q.summary = summariseQ(q);
}
function summariseQ(q) {
  let rows = 0, rej = 0, accts = [];
  for (const G of q.result) { if (!G.res) continue; if (q.kind === 'statement') { rows += sum(G.res.groups, x => x.txns.length); accts = accts.concat(G.res.groups.map(x => x.acctNo || '?')); } else rows += G.res.rows.length; rej += (G.res.rejects || []).length; }
  return { rows, rej, accts: uniq(accts) };
}

async function commitQueued(q) {
  const c = S.cur; const impId = nextId('IMP'); let added = 0, dups = 0; const accts = [];
  const rejects = [];
  for (const G of q.result) {
    if (G.skip || !G.res) continue; rejects.push(...(G.res.rejects || []));
    if (q.kind === 'statement') {
      for (const grp of G.res.groups) {
        const no = grp.acctNo || q.opts.acctNo || G.meta.acctNo; if (!no) { rejects.push(...grp.txns.map(t => ({ row: t.src, reason: 'No account number', raw: t.raw }))); continue; }
        const bank = G.bank !== 'GENERIC' ? bankByCode(G.bank).name : (bankByIfsc(G.meta.ifsc) || {}).name || '';
        const role = q.opts.role !== 'AUTO' ? q.opts.role : '';
        const a = ensureAcct(no, { bank, ifsc: G.meta.ifsc, holder: G.meta.holder, role });
        if (role) a.role = role;
        a.sources.push(impId);
        const existing = IX.txByAcct.get(a.id) || []; const keys = new Set(existing.map(dupKey));
        const newList = [];
        grp.txns.forEach((t, i) => {
          const k = dupKey(t);
          if (keys.has(k) && q.opts.dup === 'merge') { dups++; return; }
          if (keys.has(k)) t.flags.push('POSSIBLE_DUPLICATE');
          keys.add(k);
          delete t.acctNoRaw; t.id = nextId('TX'); t.acctId = a.id; t.imp = impId; t.seq = i; t.conf = t.flags.includes('BAL_MISMATCH') ? 0.7 : (G.hdr.template ? 0.99 : 0.95); t.parser = CONFIG.PARSER_VERSION;
          newList.push(t); added++;
        });
        c.txns.push(...newList);
        const all = existing.concat(newList);
        a.stmt = stmtStats(a, all, { opening: G.res.opening, closing: G.res.closing, period: G.meta.period });
        accts.push(a.acctNo);
      }
    } else if (q.kind === 'kyc') {
      for (const k of G.res.rows) {
        let role = ''; if (k.roleCell) { const l = parseInt(k.roleCell.replace(/\D/g, '')); role = /compl|victim/i.test(k.roleCell) ? 'Complainant' : l === 1 ? 'Accused (L1)' : l === 2 ? 'Suspect (L2)' : l >= 3 ? 'Suspect (L3+)' : ''; }
        const a = ensureAcct(k.acctNo, { holder: k.holder, mobiles: k.mobiles, altMobiles: k.altMobiles, emails: k.emails, pan: k.pan, address: k.address, ifsc: k.ifsc, bank: k.bank || (bankByIfsc(k.ifsc) || {}).name, branch: k.branch, custId: k.custId, role });
        if (k.holder) a.holder = k.holder; if (k.upi) a.kyc.upi = uniq((a.kyc.upi || []).concat([k.upi]));
        if (k.openDate) a.kyc.openDate = k.openDate; a.kyc.src = k.src; a.sources.push(impId); added++; accts.push(a.acctNo);
      }
    } else if (q.kind === 'iplog') {
      for (const r of G.res.rows) {
        let a = r.acctNoRaw ? ensureAcct(r.acctNoRaw) : null;
        if (!a && r.custId) a = c.accts.find(x => x.custId && x.custId === r.custId) || null;
        c.ip.logs.push(Object.assign({ id: nextId('IPL'), acctId: a ? a.id : null, imp: impId }, r)); delete c.ip.logs[c.ip.logs.length - 1].acctNoRaw; added++;
        if (a && r.mobile && !a.mobiles.includes(r.mobile) && !a.altMobiles.includes(r.mobile)) a.altMobiles.push(r.mobile);
      }
    } else if (q.kind === 'cdr') {
      let base = c.telecom.cdr.length; const seen = new Set(c.telecom.cdr.filter(x => x.target === G.res.target).map(x => x.target + x.other + x.ts + x.dir));
      for (const r of G.res.rows) { const k = r.target + r.other + r.ts + r.dir; if (seen.has(k)) { dups++; continue; } seen.add(k); r.i = base++; r.imp = impId; c.telecom.cdr.push(r); added++; }
      accts.push(G.res.target || '');
    } else if (q.kind === 'ipdr') {
      for (const r of G.res.rows) { r.id = nextId('IPDR'); r.imp = impId; c.ip.ipdr.push(r); added++; }
    } else if (q.kind === 'ncrp') {
      for (const r of G.res.rows) {
        r.id = nextId('NCRP'); r.imp = impId; c.work.ncrp.push(r); added++;
        if (r.acctNo) { const role = r.layer == null ? '' : r.layer === 0 ? 'Complainant' : r.layer === 1 ? 'Accused (L1)' : r.layer === 2 ? 'Suspect (L2)' : 'Suspect (L3+)'; const a = ensureAcct(r.acctNo, { bank: r.bank, ifsc: r.ifsc, role }); if (r.layer != null && (a.layerNcrp == null || r.layer < a.layerNcrp)) a.layerNcrp = r.layer; if (!a.role && role) a.role = role; }
        if (r.toAcct) { const tl = r.layer != null ? r.layer + 1 : null; const role = tl == null ? '' : tl === 1 ? 'Accused (L1)' : tl === 2 ? 'Suspect (L2)' : 'Suspect (L3+)'; const a = ensureAcct(r.toAcct, { ifsc: r.toIfsc, bank: (bankByIfsc(r.toIfsc) || {}).name || '', role }); if (!a.ifsc && r.toIfsc) a.ifsc = r.toIfsc; if (tl != null && (a.layerNcrp == null || tl < a.layerNcrp)) a.layerNcrp = tl; if (!a.role && role) a.role = role; }
        if (r.fromAcct && r.layer === 1) { const a = ensureAcct(r.fromAcct, { role: 'Complainant' }); a.role = a.role || 'Complainant'; if (a.layerNcrp == null) a.layerNcrp = 0; }
      }
    } else if (q.kind === 'sms') { for (const r of G.res.rows) { r.id = nextId('SMS'); r.imp = impId; c.telecom.sms.push(r); added++; } }
    else if (q.kind === 'atm') { const n = await GEO.addAtms(G.res.rows); added += n.added; dups += n.updated; }
    else if (q.kind === 'ifscdb') { const n = await GEO.addIfsc(G.res.rows); added += n.added; dups += n.updated; }
    if (G.saveTpl && G.sig) {
      S.templates = S.templates.filter(t => !(t.kind === q.kind && t.sig === G.sig));
      S.templates.push({ name: (G.bank !== 'GENERIC' ? bankByCode(G.bank).name : 'Custom') + ' · ' + q.kind + ' · ' + nowStamp(), kind: q.kind, bank: G.bank, sig: G.sig, map: G.hdr.map, rows: G.hdr.rows || 1, dateOrder: G.dateOrder || '', created: nowStamp() });
      await saveTemplates();
    }
  }
  const rec = { id: impId, file: q.file.name, size: q.file.size, hash: q.hash, kind: q.kind, type: q.type, bank: (q.result[0] || {}).bank || '', at: nowStamp(), by: S.user ? S.user.email : 'local', added, dups, rejects: rejects.slice(0, 500), rejectCount: rejects.length, accts: uniq(accts), reviewed: !!q.reviewed, template: ((q.result[0] || {}).hdr || {}).template || '', balFails: q.kind === 'statement' ? sum(q.result, G => sum((G.res && G.res.groups) || [], g => g.balFails)) : 0, ocrPages: sum(q.result, G => G.g.ocrPages || 0) };
  c.work.imports.push(rec);
  if (q.kind === 'statement') reorderAll();
  rebuildIndexes(); if (q.kind === 'statement' || q.kind === 'ncrp') markSeedsFromNcrp();
  markDirty(...PARTS.filter(p => p !== 'audit'));
  await audit('Imported ' + q.kind, `${q.file.name} sha256=${q.hash.slice(0, 16)}… added=${added} dups=${dups} rejected=${rejects.length}`);
  q.status = 'imported'; q.imported = rec;
  return rec;
}
function dupKey(t) { return [isoDate(t.ts), t.hasTime ? fmtTime(t.ts) : '', t.dr, t.cr, t.bal ?? '', (t.utr || t.narr.slice(0, 40)).toUpperCase()].join('|'); }
function reorderAll() {
  const c = S.cur; const byA = groupBy(c.txns, t => t.acctId); const impOrder = new Map(c.work.imports.map((x, i) => [x.id, i]));
  for (const [, list] of byA) {
    list.sort((a, b) => { const da = Math.floor(a.ts / 864e5), db = Math.floor(b.ts / 864e5); if (da !== db) return da - db; if (a.hasTime && b.hasTime && a.ts !== b.ts) return a.ts - b.ts; const ia = impOrder.get(a.imp) ?? 1e9, ib = impOrder.get(b.imp) ?? 1e9; if (ia !== ib) return ia - ib; return a.seq - b.seq; });
    list.forEach((t, i) => t.ord = i);
  }
}
function stmtStats(a, list, x = {}) {
  const dr = list.filter(t => t.dr), cr = list.filter(t => t.cr);
  const first = list[0], last = list[list.length - 1];
  const opening = x.opening ?? (first && first.bal != null ? round2(first.bal - first.cr + first.dr) : null);
  const byCh = countBy(list, t => t.channel);
  return {
    from: first ? first.ts : null, to: last ? last.ts : null, opening, closing: x.closing ?? (last ? last.bal : null), n: list.length,
    totDr: round2(sum(dr, t => t.dr)), totCr: round2(sum(cr, t => t.cr)), nDr: dr.length, nCr: cr.length,
    maxDr: dr.length ? Math.max(...dr.map(t => t.dr)) : 0, maxCr: cr.length ? Math.max(...cr.map(t => t.cr)) : 0,
    minDr: dr.length ? Math.min(...dr.map(t => t.dr)) : 0, minCr: cr.length ? Math.min(...cr.map(t => t.cr)) : 0,
    avgDr: dr.length ? round2(sum(dr, t => t.dr) / dr.length) : 0, avgCr: cr.length ? round2(sum(cr, t => t.cr) / cr.length) : 0,
    channels: Object.fromEntries(byCh), timeAvail: list.filter(t => t.hasTime).length
  };
}
function refreshStmtStats() { for (const a of S.cur.accts) { const l = IX.txByAcct.get(a.id); if (l && l.length) a.stmt = stmtStats(a, l, { opening: a.stmt && a.stmt.opening, closing: a.stmt && a.stmt.closing }); } }
/* Disputed (seed) transactions = complainant debits whose UTR/amount matches NCRP layer-1 rows */
function markSeedsFromNcrp() {
  const c = S.cur; if (!c.work.ncrp.length) return 0;
  const utrs = new Set(c.work.ncrp.filter(r => r.layer === 1 || r.layer == null).map(r => normUtr(r.utr)).filter(Boolean));
  const comp = new Set(c.accts.filter(a => a.role === 'Complainant').map(a => a.id));
  let n = 0; const set = new Set(c.work.disputed);
  for (const t of c.txns) if (t.dr && comp.has(t.acctId) && t.utr && utrs.has(normUtr(t.utr)) && !set.has(t.id)) { set.add(t.id); n++; }
  c.work.disputed = Array.from(set); return n;
}
function normUtr(u) { return String(u || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^0+/, ''); }
