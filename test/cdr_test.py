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
        b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 1500, 'height': 950}, accept_downloads=True)
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
        rows = build_rows() + build_rows(target='9400000002', imei1='490154203237518', imei2='490154203237518', home='404-10-100-1001', work='404-10-100-2002', away='404-10-100-4004', n_days=30, per_day=10)
        pg.evaluate("""(rows) => { const c = S.cur; let base = c.telecom.cdr.length; rows.forEach((r, i) => { r.i = base + i; c.telecom.cdr.push(r); }); c.telecom.sms.push({msisdn:'9400000001', ts: rows[5].ts, hasTime:true, sender:'VM-SBIINB', msg:'Rs 5,000 debited. OTP 123456', otp:'OTP', amount:5000, src:{file:'sms.csv',row:2}}); S.derived = null; c.intel = null; rebuildIndexes(); }""", rows)
        res = {}
        pg.evaluate("CDA.num='9400000001'; CDA.tab='summary'; go('cdrsum')"); pg.wait_for_timeout(900); pg.screenshot(path=str(R.SHOTS / 'cda_1_summary.png'))
        res['summary_text'] = pg.evaluate("$('#cdaB').innerText.slice(0,300)")
        for tab in ['contacts', 'loc', 'days', 'imei', 'sms', 'log']:
            pg.evaluate(f"CDA.tab='{tab}'; go('cdrsum')"); pg.wait_for_timeout(1200); pg.screenshot(path=str(R.SHOTS / f'cda_{tab}.png'))
        pg.evaluate("CDA.tab='loc'; go('cdrsum')"); pg.wait_for_timeout(1000)
        res['night_card'] = pg.evaluate("(() => { const t = $('#cdaB').innerText; const i = t.indexOf('Probable night-stay'); return t.slice(i, i + 220); })()")
        pg.evaluate("CDA.tab='imei'; go('cdrsum')"); pg.wait_for_timeout(800)
        res['imei_rows'] = pg.evaluate("$$('#cdaB .tbl')[0].querySelectorAll('tbody tr').length"); res['imei_changes'] = pg.evaluate("cdaImei(cdaCtx()).chg.map(x => x.what + ' ' + x.from + '>' + x.to)")
        pg.evaluate("$$('#cdaB .tbl')[0].querySelector('tbody tr').click()"); pg.wait_for_timeout(500); pg.screenshot(path=str(R.SHOTS / 'cda_imei_detail.png')); pg.evaluate("$('#modalRoot').innerHTML=''")
        pg.evaluate("CDA.tab='sms'; go('cdrsum')"); pg.wait_for_timeout(800)
        res['sms'] = pg.evaluate("(() => { const d = cdaSmsData(cdaCtx()); return { hdr: d.hdr.map(x => x.h + ':' + x.cat + ':' + x.n), p2p: d.p2p.length, bank: d.bank.length, recs: d.recs.length }; })()")
        # combined + night-window change
        pg.evaluate("CDA.num='*'; CDA.tab='summary'; go('cdrsum')"); pg.wait_for_timeout(900); pg.screenshot(path=str(R.SHOTS / 'cda_combined.png'))
        for tab in ['contacts', 'loc', 'days', 'imei', 'sms', 'log']:
            pg.evaluate(f"CDA.tab='{tab}'; go('cdrsum')"); pg.wait_for_timeout(700)
        pg.evaluate("CDA.nStart=20; CDA.nEnd=7; CDA.tab='loc'; go('cdrsum')"); pg.wait_for_timeout(700); pg.evaluate("CDA.nStart=22; CDA.nEnd=6")
        # log filters
        pg.evaluate("CDA.tab='log'; go('cdrsum')"); pg.wait_for_timeout(600); pg.select_option('#cdaLk', 'SMS'); pg.wait_for_timeout(300); res['log_count'] = pg.inner_text('#cdaLn'); pg.fill('#cdaLq', '9812345670'); pg.wait_for_timeout(300); res['log_count_q'] = pg.inner_text('#cdaLn')
        # telecom page Analyse button
        pg.evaluate("TEL_TAB='targets'; go('telecom')"); pg.wait_for_timeout(600); res['analyse_btns'] = pg.evaluate("$$('[data-an]').length"); pg.evaluate("$$('[data-an]')[0].click()"); pg.wait_for_timeout(800); res['view_after'] = pg.evaluate("S.view")
        # export
        with pg.expect_download(timeout=120000) as dl: pg.evaluate("$('#cdaX').click()")
        d = dl.value; path = R.SHOTS / d.suggested_filename; d.save_as(str(path)); res['export'] = f'{d.suggested_filename} {path.stat().st_size // 1024} KB'
        # scale: 300k rows generated inside the page (keeps Python / transfer memory small)
        if '--scale' in sys.argv:
            n = pg.evaluate("""() => { const c = S.cur; const rows = []; const base = Date.UTC(2026, 7, 1); let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
              for (let k = 0; k < 30; k++) for (let d = 0; d < 60; d++) for (let j = 0; j < 170; j++) { const h = Math.floor(rnd() * 24), night = h >= 22 || h < 6; const kind = rnd() < .6 ? 'CALL' : rnd() < .75 ? 'SMS' : 'DATA'; const cell = night ? 'H' + k : (rnd() < .7 ? 'W' + k : 'A' + Math.floor(rnd() * 40));
                rows.push({ target: '94000' + String(k).padStart(5, '0'), other: kind === 'DATA' ? '' : (rnd() < .1 ? 'VM-SBIINB' : '98' + String(Math.floor(rnd() * 3000)).padStart(8, '0')), dir: rnd() < .5 ? 'IN' : 'OUT', kind, ts: base + d * 86400000 + h * 3600000 + Math.floor(rnd() * 3600000), hasTime: true, dur: kind === 'CALL' ? Math.floor(rnd() * 600) : 0, cell, lastCell: '', lac: '1', imei: '3569380356' + String(k).padStart(4, '0') + '0', imsi: '40410000000' + String(k).padStart(4, '0'), roam: '', op: 'JIO', addr: 'Tower ' + cell, lat: null, lon: null, i: rows.length, src: { file: 'x', row: 1 } }); }
              c.telecom.cdr = rows; c.telecom.sms = []; S.derived = null; c.intel = null; rebuildIndexes(); return rows.length; }""")
            res['scale_rows'] = n
            for tab in ['summary', 'contacts', 'loc', 'days', 'imei', 'sms']:
                pg.evaluate("CDA.cache = null"); t = pg.evaluate(f"(() => {{ const t0 = performance.now(); CDA.num = '*'; CDA.tab = '{tab}'; go('cdrsum'); return performance.now() - t0; }})()"); pg.wait_for_timeout(3000)
                res[f'scale_{tab}_ms'] = round(t)
        json.dump(res, open(R.SHOTS / 'cda_result.json', 'w'), indent=1, default=str); print(json.dumps(res, indent=1, default=str))
        real = [e for e in errs if 'Failed to load resource' not in e and 'fonts' not in e.lower()]
        print('ERRORS (excluding offline font/CDN noise):', len(real)); [print(' ', e[:300]) for e in real[:15]]
        b.close()
main()
