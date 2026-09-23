"""Scale test: ~100k transactions across 2,000 accounts and 300k CDR rows."""
import sys, time; sys.path.insert(0, __file__.rsplit('/', 1)[0])
import run_test as R
from playwright.sync_api import sync_playwright
srv = R.serve()
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 1500, 'height': 950}); ctx.route('https://cdn.jsdelivr.net/**', R.cdn); pg = ctx.new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8765/CFITS.html'); pg.wait_for_selector('#locName'); pg.fill('#locName', 'scale@x.in'); pg.click('#locGo')
    pg.wait_for_selector('#vp2'); pg.fill('#vp1', 'Scale-Test-Passphrase-1'); pg.fill('#vp2', 'Scale-Test-Passphrase-1'); pg.click('#vGo'); pg.wait_for_selector('#cDemo')
    pg.click('#cDemo'); pg.wait_for_selector('#chLayer', timeout=120000)
    print(pg.evaluate("""async () => {
      const c = S.cur; let seq = c.txns.length; const base = c.txns.slice();
      // clone accounts 13x with shifted numbers -> ~2000 accounts, ~18k txns; then pad each with background rows to ~100k
      const accts = c.accts.slice();
      for (let k = 1; k <= 12; k++) for (const a of accts) { const b = ensureAcct(a.acctNo.slice(0, -3) + String(100 + k).slice(-3) + 'Z' + k, { holder: a.holder, bank: a.bank }); b.role = a.role === 'Complainant' ? '' : ''; }
      const all = c.accts; let t0 = mkTs(2026, 6, 1);
      for (let i = 0; c.txns.length < 100000; i++) { const a = all[i % all.length]; const cr = i % 2 ? 1234 + (i % 97) : 0; c.txns.push({ id: 'TX-S' + i, acctId: a.id, imp: 'IMP-0001', seq: i, ts: t0 + (i % 80) * 864e5 + (i % 1440) * 60000, hasTime: true, dr: cr ? 0 : 500 + (i % 311), cr, bal: null, narr: 'UPI/DR/' + (700000000000 + i) + '/X/SHOP', ref: '', utr: String(700000000000 + i), txnId: '', channel: 'UPI', upi: '', cpAcct: [], cpMasked: '', cpIfsc: '', cpMobile: '', cpName: '', src: { file: 'scale', row: i }, raw: '', flags: [], conf: 1 }); }
      const cdr = c.telecom.cdr; const nums = Array.from(IX.numInfo.keys());
      for (let i = 0; cdr.length < 300000; i++) cdr.push({ i: cdr.length, target: nums[i % nums.length], other: String(9000000000 + (i * 7919) % 90000000), dir: i % 2 ? 'IN' : 'OUT', kind: 'CALL', ts: t0 + (i % 100000) * 60000, hasTime: true, dur: 30, cell: '404-45-' + (i % 500), imei: '', imsi: '', src: { file: 'scale', row: i } });
      reorderAll(); rebuildIndexes(); S.derived = null;
      const tm = {}; let s = performance.now();
      runTrail(); tm.trail = performance.now() - s; s = performance.now(); T(); tm.telecom = performance.now() - s; s = performance.now(); IPX(); tm.ip = performance.now() - s;
      s = performance.now(); buildLeads(); tm.leads = performance.now() - s; s = performance.now(); requisitions(); tm.req = performance.now() - s;
      s = performance.now(); markDirty(...PARTS); await saveNow(); tm.saveEncrypted = performance.now() - s;
      return { txns: c.txns.length, accts: c.accts.length, cdr: cdr.length, ms: Object.fromEntries(Object.entries(tm).map(([k, v]) => [k, Math.round(v)])) };
    }"""))
    for v in ['dashboard', 'txns', 'trail', 'correlation', 'telecom', 'patterns', 'accounts', 'network']:
        t = time.time(); pg.evaluate(f"go('{v}')"); print('view', v, round(time.time() - t, 2), 's')
    t = time.time(); pg.evaluate("(async()=>{ await openCase('DEMO-CASE'); })()"); pg.wait_for_timeout(200); print('reload encrypted case', round(time.time() - t, 2), 's', pg.evaluate("S.cur.txns.length"))
    print('errors', errs[:5]); b.close()
srv.shutdown()
