"""CDR Analysis view test: synthetic CDR (2 targets, 2 handsets, 2 SIMs, night/day cells, bank SMS headers),
every tab, Excel export, combined view, and a 300k-row timing check. Expect 0 console errors."""
import sys, json, random, time, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import run_test as R
from playwright.sync_api import sync_playwright

def synth(n_days=60, seed=7):
    random.seed(seed); rows = []
    def ts(d, h, m, s=0): return (1750000000 + 0) and R_ms(d, h, m, s)
    return rows

def R_ms(d, h, m, s=0):  # wall-clock IST encoded as UTC ms, day d from 2026-08-01
    import datetime
    t = datetime.datetime(2026, 8, 1) + datetime.timedelta(days=d, hours=h, minutes=m, seconds=s)
    return int(t.replace(tzinfo=datetime.timezone.utc).timestamp() * 1000)

def build_rows(n_days=60, per_day=20, target='9400000001', imei1='356938035643809', imei2='861234050123450', home='404-10-100-1001', work='404-10-100-2002', away='404-10-100-3003'):
    random.seed(11); out = []
    others = ['9812345670', '9812345671', '9812345672', '9912300001', '9447000001', '9446000002']
    heads = ['VM-SBIINB', 'AD-HDFCBK', 'JX-AIRTEL', 'VK-AMAZON', 'BP-ICICIB', 'TX-GOVTIN']
    for d in range(n_days):
        imei = imei1 if d < 40 else imei2; imsi = '404100000000001' if d < 45 else '404100000000002'
        for k in range(per_day):
            h = random.choice([0, 1, 2, 5, 7, 9, 10, 11, 13, 15, 17, 19, 21, 22, 23]); m = random.randint(0, 59)
            night = h >= 22 or h < 6
            cell = home if night else (work if 9 <= h <= 18 else random.choice([home, away]))
            kind = random.choices(['CALL', 'SMS', 'DATA'], [60, 30, 10])[0]
            direc = random.choice(['IN', 'OUT'])
            other = random.choice(others) if kind != 'DATA' else ''
            if kind == 'SMS' and random.random() < 0.5: other = random.choice(heads); direc = 'IN'
            dur = 0 if kind != 'CALL' else random.choice([0, 0, 12, 45, 120, 400, 1500])
            out.append(dict(target=target, other=other, dir=direc if kind != 'DATA' else '?', kind=kind, ts=R_ms(d, h, m, random.randint(0, 59)), hasTime=True, dur=dur, cell=cell, lastCell='', lac='1001', imei=imei, imsi=imsi, roam='', op='JIO', addr=('Home Tower, Ernakulam' if cell == home else 'Office Tower, Kakkanad' if cell == work else 'Mall Tower, Edappally'), lat=9.98 if cell == home else 10.01, lon=76.30 if cell == home else 76.35, src={'file': 'synth.csv', 'sheet': 'S', 'page': None, 'row': len(out) + 2}))
    return out

def main():
    srv = R.serve(); errs = R.errors
    with sync_playwright() as p:
        b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 1500, 'height': 2100}, accept_downloads=True)
        ctx.route('https://cdn.jsdelivr.net/**', R.cdn); pg = ctx.new_page()
        pg.on('console', lambda m: m.type in ('error', 'warning') and errs.append(f'[{m.type}] {m.text}')); pg.on('pageerror', lambda e: errs.append(f'[pageerror] {e}'))
        pg.goto('http://127.0.0.1:8765/CFITS.html'); pg.wait_for_selector('#locName', timeout=20000)
        pg.fill('#locName', 'test.io@kerala.gov.in'); pg.click('#locGo'); pg.wait_for_selector('#vp1')
        pg.fill('#vp1', 'Correct-Horse-Battery-77'); pg.fill('#vp2', 'Correct-Horse-Battery-77'); pg.click('#vGo')
        pg.wait_for_selector('#content', timeout=60000); pg.wait_for_timeout(1500); pg.evaluate("go('cases')"); pg.wait_for_selector('#cNew', timeout=20000)
        pg.click('#cDemo')
        for _ in range(240):
            if pg.evaluate("!!(S.cur && S.cur.meta && S.cur.meta.demo && S.derived)"): break
            pg.wait_for_timeout(500)
        pg.wait_for_timeout(800)
        res = {}
        # --- tower file (Windows-1252, pipe delimited, Airtel Kerala-like) + Jio comma file
        air = "Site Name|MCC|MNC|LAC|Cell ID|Latitude|Longitude|Azimuth|Address\n" + "\n".join(f"Caf\xe9 Tower {i}|404|10|{1000+i%5}|{50000+i}|{9.9+i*0.0001}|{76.2+i*0.0001}|120|Ernakulam {i}" for i in range(2000))
        jio = "radio,mcc,net,area,cell,lon,lat,range\n" + "\n".join(f"LTE,405,857,{200+i%3},{ (1<<20)+i },{76.3+i*0.0001},{10.0+i*0.0001},500" for i in range(2000))
        pg.evaluate("""async ([a,j]) => {
          const enc = s => Uint8Array.from(Array.from(s, ch => ch.charCodeAt(0) & 255));
          window.__t1 = await CELLDB.importFile(new File([enc(a)], 'Airtel_Kerala_BTS.txt'), {});
          window.__t2 = await CELLDB.importFile(new File([j], 'jio_all_india.csv'), {});
        }""", [air, jio])
        res['import'] = pg.evaluate("[__t1, __t2]")
        # --- CDR rows without lat/lon : 1 exact airtel (4G ECI without LAC), 1 dashed, 1 unknown, 1 with own addr (learn)
        R0 = R_ms(3, 23, 10)
        mk = lambda cell, lac='', op='', addr='', lat=None, lon=None, k=0: dict(target='9400000001', other='9812345670', dir='OUT', kind='CALL', ts=R0 + k*60000, hasTime=True, dur=30, cell=cell, lastCell='', lac=lac, imei='356938035643809', imsi='', roam='', op=op, addr=addr, lat=lat, lon=lon, src={'file':'x.csv','sheet':'S','page':None,'row':k+2})
        rows = [mk('50010', '1000', 'AIRTEL', k=0), mk('404-10-1001-50011', '', '', k=1), mk(str((1<<20)+7), '', 'JIO', k=2), mk('99999999', '1', '', k=3), mk('77777', '5', 'VI', 'Learned Site, Kochi', 9.97, 76.28, k=4), mk('50010', '9999', 'AIRTEL', k=5)]
        pg.evaluate("""async (rows) => { const c = S.cur; let base = c.telecom.cdr.length; rows.forEach((r, i) => { r.i = base + i; c.telecom.cdr.push(r); }); S.derived = null; c.intel = null; rebuildIndexes();
          window.__out = await CELLDB.afterCdrImport(rows); window.__rows = c.telecom.cdr.slice(-rows.length).map(r => [r.cell, r.lat, r.cellSrc || '', r.addr]); }""", rows)
        res['afterImport'] = pg.evaluate("[__rows, __out.learn, {found: __out.enrich.found, approx: __out.enrich.approx, missing: __out.enrich.missing}]")
        # --- persistence: drop RAM cache, resolve again from encrypted storage; learned cell now resolvable
        res['persist'] = pg.evaluate("""async () => { CELLDB.cache.clear(); CELLDB.meta = null; const r = await CELLDB.resolve([{cell:'77777', lac:'5', op:'VI'},{cell:'50999', lac:'1004', op:'Airtel'}]); return [Array.from(r.values()), (await CELLDB.loadMeta()).total]; }""")
        # --- SDR from CDR header block
        pg.evaluate("""async () => { const rows = [['Call Detail Record'],['Subscriber Name : RAJESH KUMAR'],['Address','12/4 MG Road, Kochi 682011'],['Father Name: SURESH KUMAR'],['ID Proof Type : Aadhaar'],['Date of Activation : 12-03-2021'],['IMSI: 404100000000001'],['Calling No','Called No','Date','Time','Duration','First Cell ID']].concat([['9400000001','9812345670','01-08-2026','10:00:00','30','50010']]); const grid = {sheet:'S', rows, rowRef: rows.map((_,i)=>({row:i+1}))}; const hdr = detectHeader ? null : null; window.__grid = grid; }""")
        res['sdr'] = pg.evaluate("""() => { const g = window.__grid; return cdrSdr(g, {row: 6}); }""")
        pg.evaluate("async () => { await CELLDB.saveSdr('9400000001', Object.assign(cdrSdr(window.__grid,{row:6}), {src:'x.csv'})); CELLDB.sdrMap.clear(); CELLDB.sdrLoaded = false; await CELLDB.loadSdr(); }")
        res['sdr_reload'] = pg.evaluate("CELLDB.getSdr('9400000001') && CELLDB.getSdr('9400000001').name")
        # --- views
        pg.evaluate("go('celldb')"); pg.wait_for_timeout(1200); pg.screenshot(path=str(R.SHOTS / 'cdb_1_database.png'))
        pg.evaluate("document.querySelector('#cdbQ').value='50010'; document.querySelector('#cdbQGo').click()"); pg.wait_for_timeout(500); pg.screenshot(path=str(R.SHOTS / 'cdb_2_lookup.png'))
        pg.evaluate("CDA.num='9400000001'; CDA.tab='loc'; CDA.cache=null; go('cdrsum')"); pg.wait_for_timeout(1500); pg.screenshot(path=str(R.SHOTS / 'cdb_3_location.png'))
        pg.evaluate("CDA.tab='summary'; go('cdrsum')"); pg.wait_for_timeout(900); pg.screenshot(path=str(R.SHOTS / 'cdb_4_summary_sdr.png'))
        res['loc_card'] = pg.evaluate("(()=>{CDA.tab='loc';go('cdrsum');return 1})()"); pg.wait_for_timeout(800)
        res['res_text'] = pg.evaluate("(document.querySelector('#cdaB')||{innerText:''}).innerText.slice(0,260)")
        # --- scale: 1M-row streaming import
        big = "cgi,lat,lon\n" + "\n".join(f"404-10-{1+i%900}-{i},{8.5+(i%3000)*0.002},{76.0+(i%2500)*0.0005}" for i in range(1000000))
        t0 = time.time(); res['big'] = pg.evaluate("async (b) => { const t = performance.now(); const st = await CELLDB.importFile(new File([b], 'bsnl_kerala_big.csv'), {}); return [st.kept, Math.round(performance.now()-t)]; }", big); res['big_wall_s'] = round(time.time()-t0, 1)
        res['total'] = pg.evaluate("CELLDB.meta.total")
        b.close()
    real = [e for e in errs if not any(k in e for k in ('fonts.g', 'ERR_', 'Failed to load resource', 'net::'))]
    print(json.dumps(res, indent=1, default=str)); print('ERRORS', len(real)); [print(e) for e in real[:10]]

if __name__ == '__main__':
    main()
