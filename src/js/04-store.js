/* ------------------------------ case store ------------------------------ */
const PARTS = ['meta', 'accts', 'txns', 'telecom', 'ip', 'work', 'audit'];
const S = {
  user: null, index: [], cur: null, view: 'dashboard', viewArg: null,
  templates: [], prefs: { autoLockMin: CONFIG.AUTO_LOCK_MIN, autoBackup: false, autoBackupMin: 30, sessionOnly: false },
  dirty: new Set(), saveTimer: null, derived: null, lastActivity: Date.now()
};

function blankCase(meta) {
  return {
    meta: Object.assign({ id: '', crimeNo: '', ps: '', district: '', io: '', type: CASE_TYPES[0], regDate: '', status: CASE_STATUS[0], conf: CONF_LEVELS[0], remarks: '', created: nowStamp(), demo: false, lastBackup: null, backups: [] }, meta),
    accts: [], txns: [],
    telecom: { cdr: [], sms: [] },
    ip: { logs: [], ipdr: [] },
    work: {
      entities: [], numbers: [], tasks: [], imports: [], disputed: [], ncrp: [], links: [], leadState: {},
      seq: {}, settings: { windowMin: 30, unknownTimeWindowH: 24, amtTolAbs: 0, amtTolPct: 0, maxHoldDays: 30, taintRule: 'TAINT_FIRST', maxLayers: 0, cdrWindowMin: 15, ipSessionMin: 30, ipdrTolMin: 2, microMax: 10 }
    },
    audit: []
  };
}
function nextId(prefix) { const sq = S.cur.work.seq; sq[prefix] = (sq[prefix] || 0) + 1; return seqId(prefix, sq[prefix]); }
function markDirty(...parts) { parts.forEach(p => S.dirty.add(p)); S.derived = null; scheduleSave(); }
function scheduleSave() { clearTimeout(S.saveTimer); S.saveTimer = setTimeout(saveNow, 1200); }
async function saveNow() {
  if (!S.cur || !Vault.key) return;
  const parts = Array.from(S.dirty); S.dirty.clear();
  try {
    for (const p of parts) await Vault.put(`case:${S.cur.meta.id}:${p}`, S.cur[p]);
    const i = S.index.findIndex(x => x.id === S.cur.meta.id);
    const summ = caseSummary(S.cur); if (i >= 0) S.index[i] = summ; else S.index.push(summ);
    await Vault.put('index', S.index);
    S.cur._changedSinceBackup = true;
  } catch (e) { console.error(e); toast('Save failed: ' + e.message, 'err'); parts.forEach(p => S.dirty.add(p)); }
}
function caseSummary(c) {
  return { id: c.meta.id, crimeNo: c.meta.crimeNo, ps: c.meta.ps, type: c.meta.type, status: c.meta.status, io: c.meta.io, demo: !!c.meta.demo, created: c.meta.created, updated: nowStamp(), accts: c.accts.length, txns: c.txns.length, cdr: c.telecom.cdr.length, lastBackup: c.meta.lastBackup };
}
async function loadIndex() { S.index = (await Vault.get('index')) || []; S.templates = (await Vault.get('templates')) || []; Object.assign(S.prefs, (await Vault.get('prefs')) || {}); }
async function savePrefs() { await Vault.put('prefs', S.prefs); }
async function saveTemplates() { await Vault.put('templates', S.templates); }
async function openCase(id) {
  await saveNow();
  const c = blankCase({ id });
  for (const p of PARTS) { const v = await Vault.get(`case:${id}:${p}`); if (v) c[p] = p === 'work' ? Object.assign(c.work, v, { settings: Object.assign(c.work.settings, v.settings || {}) }) : v; }
  S.cur = c; S.derived = null; rebuildIndexes();
  await audit('Opened case', id);
}
async function createCase(meta) {
  const c = blankCase(meta); S.cur = c; rebuildIndexes();
  PARTS.forEach(p => S.dirty.add(p)); await audit('Created case', JSON.stringify({ id: meta.id, crimeNo: meta.crimeNo })); await saveNow();
}
async function deleteCase(id) {
  for (const k of await Vault.keys(`case:${id}:`)) await Vault.del(k);
  S.index = S.index.filter(x => x.id !== id); await Vault.put('index', S.index);
  if (S.cur && S.cur.meta.id === id) S.cur = null;
}
/* Tamper-evident audit log: each entry carries SHA-256 of (previous hash + entry). */
async function audit(action, detail = '') {
  if (!S.cur) return;
  const log = S.cur.audit; const prev = log.length ? log[log.length - 1].h : 'GENESIS';
  const e = { ts: nowStamp(), user: S.user ? S.user.email : 'local', action, detail: String(detail).slice(0, 600), prev };
  e.h = await sha256Hex(prev + '|' + e.ts + '|' + e.user + '|' + e.action + '|' + e.detail);
  log.push(e); S.dirty.add('audit'); scheduleSave();
  // Central activity log gets only the action type and case ID — never case contents.
  if (typeof Backend !== 'undefined' && /^(Created case|Opened case|Imported|Generated report|Exported|Backed up|Restored|Deleted Drive backup|Marked disputed|Changed vault passphrase)/.test(action)) Backend.log(action.toUpperCase().slice(0, 40), 'Case ' + S.cur.meta.id);
}
async function verifyAudit() {
  let prev = 'GENESIS';
  for (let i = 0; i < S.cur.audit.length; i++) {
    const e = S.cur.audit[i]; if (e.prev !== prev) return { ok: false, at: i };
    const h = await sha256Hex(prev + '|' + e.ts + '|' + e.user + '|' + e.action + '|' + e.detail); if (h !== e.h) return { ok: false, at: i };
    prev = e.h;
  }
  return { ok: true, n: S.cur.audit.length };
}

/* ---------- in-memory indexes (rebuilt after load/import) ---------- */
const IX = { acctById: new Map(), acctByKey: new Map(), txById: new Map(), txByAcct: new Map(), numInfo: new Map() };
function rebuildIndexes() {
  const c = S.cur; if (!c) return;
  IX.acctById = new Map(c.accts.map(a => [a.id, a]));
  IX.acctByKey = new Map(); c.accts.forEach(a => IX.acctByKey.set(acctKey(a.acctNo), a));
  IX.txById = new Map(c.txns.map(t => [t.id, t]));
  IX.txByAcct = groupBy(c.txns, t => t.acctId);
  for (const [k, list] of IX.txByAcct) list.sort((a, b) => a.ord - b.ord);
  IX.numInfo = buildNumberInfo();
}
function acctLabel(a) { if (!a) return '—'; return (a.holder ? a.holder + ' · ' : '') + a.acctNo; }
function findAcct(no) { return IX.acctByKey.get(acctKey(no)); }
function ensureAcct(no, info = {}) {
  const k = acctKey(no); if (!k) return null;
  let a = IX.acctByKey.get(k);
  if (!a) {
    a = { id: nextId('ACC'), acctNo: normAcct(no), bank: '', ifsc: '', branch: '', holder: '', role: '', layerNcrp: null, mobiles: [], altMobiles: [], emails: [], pan: '', address: '', custId: '', kyc: {}, stmt: null, sources: [], notes: '' };
    S.cur.accts.push(a); IX.acctById.set(a.id, a); IX.acctByKey.set(k, a);
  }
  for (const f of ['bank', 'ifsc', 'branch', 'holder', 'pan', 'address', 'custId']) if (info[f] && !a[f]) a[f] = String(info[f]).trim();
  if (info.role && !a.role) a.role = info.role;
  for (const f of ['mobiles', 'altMobiles', 'emails']) if (info[f]) for (const v of info[f]) if (v && !a[f].includes(v)) a[f].push(v);
  return a;
}
/* Map every known phone number to what it is linked to (accounts, KYC, entity, investigation list). */
function buildNumberInfo() {
  const m = new Map(); const c = S.cur;
  const add = (num, info) => { if (!num) return; if (!m.has(num)) m.set(num, { num, links: [], roles: new Set() }); const x = m.get(num); x.links.push(info); if (info.role) x.roles.add(info.role); };
  for (const a of c.accts) {
    a.mobiles.forEach(n => add(n, { kind: 'Registered mobile', acctId: a.id, role: a.role, label: acctLabel(a) }));
    a.altMobiles.forEach(n => add(n, { kind: 'Alternate number', acctId: a.id, role: a.role, label: acctLabel(a) }));
  }
  for (const n of c.work.numbers) add(n.num, { kind: 'Investigation number', role: n.role, label: n.remarks || n.person || n.role, numId: n.id });
  for (const e of c.work.entities) (e.mobiles || []).forEach(n => add(n, { kind: 'Entity mobile', entityId: e.id, role: e.type, label: e.name }));
  return m;
}
function numLabel(n) { const i = IX.numInfo.get(n); if (!i) return n; return n + ' (' + uniq(i.links.map(l => l.kind === 'Investigation number' ? l.role : l.kind.replace(' mobile', '').replace('Alternate number', 'Alt'))).join(', ') + ')'; }
