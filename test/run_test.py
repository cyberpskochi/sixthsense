"""End-to-end test: serves dist/CFITS.html on localhost, routes jsDelivr to the vendored
npm files (identical bytes, so SRI still applies), then drives the app."""
import http.server, threading, pathlib, sys, json, functools, time
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
V = ROOT / 'vendor'; SHOTS = ROOT / 'test' / 'shots'; SHOTS.mkdir(exist_ok=True)
MAP = {'@e965/xlsx@0.20.3/': V / 'e965/package/', 'pdfjs-dist@3.11.174/': V / 'pdfjs-dist-3.11.174/package/', 'cytoscape@3.30.2/': V / 'cytoscape-3.30.2/package/',
       'chart.js@4.4.4/': V / 'chart.js-4.4.4/package/', 'jspdf@2.5.1/': V / 'jspdf-2.5.1/package/', 'jspdf-autotable@3.8.2/': V / 'jspdf-autotable-3.8.2/package/', 'tesseract.js@5.1.1/': V / 'tesseract.js-5.1.1/package/'}

def serve():
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT / 'dist'))
    s = http.server.ThreadingHTTPServer(('127.0.0.1', 8765), h); threading.Thread(target=s.serve_forever, daemon=True).start(); return s

def cdn(route):
    url = route.request.url.split('cdn.jsdelivr.net/npm/')[1]
    for k, p in MAP.items():
        if url.startswith(k):
            f = p / url[len(k):]
            if f.exists(): return route.fulfill(status=200, body=f.read_bytes(), headers={'Content-Type': 'application/javascript', 'Access-Control-Allow-Origin': '*'})
    route.fulfill(status=404, body='nf')

errors = []
def main(mode):
    srv = serve()
    with sync_playwright() as p:
        b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 1500, 'height': 950}, accept_downloads=True)
        ctx.route('https://cdn.jsdelivr.net/**', cdn)
        pg = ctx.new_page()
        pg.on('console', lambda m: m.type in ('error', 'warning') and errors.append(f'[{m.type}] {m.text}'))
        pg.on('pageerror', lambda e: errors.append(f'[pageerror] {e}'))
        pg.goto('http://127.0.0.1:8765/CFITS.html'); pg.wait_for_selector('#locName', timeout=20000)
        pg.fill('#locName', 'test.io@kerala.gov.in'); pg.click('#locGo')
        pg.wait_for_selector('#vp1'); pg.fill('#vp1', 'Correct-Horse-Battery-77'); pg.fill('#vp2', 'Correct-Horse-Battery-77'); pg.click('#vGo')
        pg.wait_for_selector('#cNew', timeout=60000)
        if mode in ('demo', 'all'):
            t = time.time(); pg.click('#cDemo'); pg.wait_for_selector('#chLayer', timeout=120000); print('demo built in %.1fs' % (time.time() - t))
            pg.wait_for_timeout(800); pg.screenshot(path=str(SHOTS / '01_dashboard.png'), full_page=False)
            info = pg.evaluate("() => ({tot: D().tot, accts: S.cur.accts.length, txns: S.cur.txns.length, flows: D().flows.length, layers: Array.from(D().byLayer.keys()), leads: buildLeads().length, req: Object.fromEntries(Object.entries(requisitions()).map(([k,v])=>[k,v.length])), ipres: IPX().resolvedHits.length, shared: IPX().sharedIp.length, direct: T().direct.length, amb: D().L.ambiguous.length})")
            print(json.dumps(info, indent=1))
            for i, v in enumerate(['trail', 'network', 'telecom', 'ip', 'correlation', 'patterns', 'leads', 'requisitions', 'tasks', 'reports', 'accounts', 'txns', 'entities', 'quality', 'settings', 'backup']):
                t = time.time(); pg.evaluate(f"go('{v}')"); pg.wait_for_timeout(700)
                print(f'view {v}: {time.time()-t:.2f}s'); pg.screenshot(path=str(SHOTS / f'{i+2:02d}_{v}.png'))
            for tab in ['flows', 'seeds', 'common', 'amb']:
                pg.evaluate(f"TRAIL_TAB='{tab}'; go('trail')"); pg.wait_for_timeout(300)
            for tab in ['direct', 'common', 'imei', 'coloc', 'matrix']:
                pg.evaluate(f"TEL_TAB='{tab}'; go('telecom')"); pg.wait_for_timeout(300)
            for tab in ['shared', 'comp', 'pend', 'logs']:
                pg.evaluate(f"IP_TAB='{tab}'; go('ip')"); pg.wait_for_timeout(300)
            pg.evaluate("TRAIL_TAB='layers'; go('trail')"); pg.wait_for_timeout(300); pg.screenshot(path=str(SHOTS / '20_trail_layers.png'))
            pg.evaluate("IP_TAB='tx'; go('ip')"); pg.wait_for_timeout(300); pg.screenshot(path=str(SHOTS / '21_ip_chain.png'))
            pg.evaluate("openTx(S.cur.work.disputed[3])"); pg.wait_for_timeout(500); pg.screenshot(path=str(SHOTS / '22_tx_intel.png'))
            pg.evaluate("$('#modalRoot').innerHTML=''; openAccount(D().flows.find(f=>f.toAcct && f.layerFrom===0).toAcct)"); pg.wait_for_timeout(500); pg.screenshot(path=str(SHOTS / '23_account.png'))
            pg.evaluate("$('#modalRoot').innerHTML=''; openNumber(S.cur.work.numbers[0].num)"); pg.wait_for_timeout(400); pg.screenshot(path=str(SHOTS / '24_number.png'))
            pg.evaluate("$('#modalRoot').innerHTML=''")
            for fn in ["reportComplete()", "reportComplete('summary')", "reportTelecom()", "reportPatterns()", "exportWorkbook()", "reportAccount(S.cur.accts[5].id)", "reportTransaction(S.cur.work.disputed[0])"]:
                with pg.expect_download(timeout=120000) as dl: pg.evaluate(fn)
                d = dl.value; path = SHOTS / d.suggested_filename; d.save_as(str(path)); print('download', d.suggested_filename, path.stat().st_size // 1024, 'KB')
            ok = pg.evaluate("verifyAudit()"); print('audit', ok)
            # encrypted package round-trip
            rt = pg.evaluate("""async () => { const b = await Vault.pack(casePackage(S.cur)); const p = await Vault.unpack(b); let bad=null; try { await Vault.unpack(b, 'wrong-pass-123456'); } catch(e){ bad=e.message } return {size:b.length, txns:p.data.txns.length, wrong:bad}; }"""); print('package', rt)
        if mode in ('import', 'all'):
            pg.evaluate("go('cases')"); pg.click('#cNew'); pg.fill('#f_id', 'TEST-IMPORT-1'); pg.fill('#f_crime', 'Cr 1/2026'); pg.click('[data-s]'); pg.wait_for_selector('#drop')
            S = ROOT / 'test' / 'samples'
            def imp(kind, files, opts=None):
                pg.evaluate(f"IMP.kind='{kind}'; IMP.opts=Object.assign(IMP.opts,{json.dumps(opts or {})}); go('import')")
                with pg.expect_file_chooser() as fc: pg.click('#pickFiles')
                fc.value.set_files([str(S / f) for f in files])
                for _ in range(240):
                    pg.wait_for_timeout(500)
                    if pg.evaluate("IMP.queue.every(q=>!['queued','parsing'].includes(q.status))"): break
                st = pg.evaluate("IMP.queue.filter(q=>q.status!=='imported').map(q=>({f:q.file.name,s:q.status,r:q.reasons,sum:q.summary,err:q.err}))"); print(kind, json.dumps(st))
                return st
            st = imp('statement', ['ICICI_complainant.xlsx', 'BOB_L1_ravi.xlsx', 'SBI_L1_sunil.csv', 'HDFC_L1_meena.pdf'])
            pg.screenshot(path=str(SHOTS / '30_import_queue.png'))
            rev = [x['f'] for x in st if x['s'] == 'review']
            if rev:
                pg.evaluate(f"reviewModal(IMP.queue.find(q=>q.file.name==='{rev[0]}'))"); pg.wait_for_timeout(500); pg.screenshot(path=str(SHOTS / '31_review.png')); pg.evaluate("$('#modalRoot').innerHTML=''")
            pg.evaluate("(async()=>{for (const q of IMP.queue.filter(q=>q.status==='ready')) await commitQueued(q); refreshStmtStats();})()"); pg.wait_for_timeout(1500)
            for k, f, o in [('kyc', ['KYC_reply.xlsx'], {}), ('iplog', ['IPLOG_ICICI_BOB_SBI.xlsx'], {'tz': 'UTC'}), ('ipdr', ['IPDR_jio.xlsx'], {'tz': 'IST'}), ('cdr', ['CDR_7300000003.xlsx'], {'tz': 'IST'})]:
                imp(k, f, o); pg.evaluate("(async()=>{for (const q of IMP.queue.filter(q=>q.status==='ready')) await commitQueued(q); rebuildIndexes(); S.derived=null;})()"); pg.wait_for_timeout(800)
            res = pg.evaluate("""() => { const c=S.cur; const comp=c.accts.find(a=>a.acctNo.endsWith('01101234567')); if(comp){comp.role='Complainant';}
               c.work.disputed = c.txns.filter(t=>t.acctId===comp.id && t.dr>50000).map(t=>t.id); S.derived=null; rebuildIndexes(); const d=D();
               return { accts: c.accts.map(a=>[a.acctNo,a.holder,a.bank,a.mobiles,a.altMobiles, (a.stmt||{}).n]), txns: c.txns.map(t=>[t.id,(IX.acctById.get(t.acctId)||{}).acctNo,fmtDT(t.ts,t.hasTime),t.dr,t.cr,t.bal,t.utr,t.channel,t.flags.join(' ')]),
                 flows: d.flows.map(f=>[ (IX.acctById.get(f.fromAcct)||{}).acctNo, f.toAcct?(IX.acctById.get(f.toAcct)||{}).acctNo:f.toExt.label, f.amt, f.strength, f.reasons.join('; ')]), tot:d.tot,
                 ip: Array.from(IPX().txLogin.entries()).map(([id,l])=>[id,l.ip,l.how,l.ipdr&&l.ipdr.nums]), shared: IPX().sharedIp.map(s=>[s.ip,s.accts.length]), comp: IPX().compAlerts, cdr: c.telecom.cdr.length, direct: T().direct.map(x=>[x.a,x.b,x.n,x.complainant]),
                 imports: c.work.imports.map(i=>[i.file,i.kind,i.added,i.rejectCount,i.balFails]) }; }""")
            print(json.dumps(res, indent=1, default=str))
            pg.evaluate("go('trail')"); pg.wait_for_timeout(500); pg.screenshot(path=str(SHOTS / '32_import_trail.png'))
            pg.evaluate("openTx(S.cur.work.disputed[0])"); pg.wait_for_timeout(500); pg.screenshot(path=str(SHOTS / '33_import_tx.png'))
        # lock & unlock
        pg.evaluate("lockApp('test')"); pg.wait_for_selector('#vp1'); pg.fill('#vp1', 'wrong-pass-000000'); pg.click('#vGo'); pg.wait_for_timeout(2500)
        pg.fill('#vp1', 'Correct-Horse-Battery-77'); pg.click('#vGo'); pg.wait_for_selector('#cNew', timeout=60000); print('cases after relock:', pg.evaluate("S.index.map(x=>x.id+':'+x.txns)"))
        b.close()
    srv.shutdown()
    print('\nCONSOLE ERRORS/WARNINGS:', len(errors)); [print(' ', e[:300]) for e in errors[:40]]

if __name__ == '__main__': main(sys.argv[1] if len(sys.argv) > 1 else 'all')
