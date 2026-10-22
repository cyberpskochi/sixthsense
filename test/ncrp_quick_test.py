import sys, pathlib, json
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import run_test as R
from playwright.sync_api import sync_playwright
SH = R.SHOTS; S = R.serve()
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 1500, 'height': 950}, accept_downloads=True)
    ctx.route('https://cdn.jsdelivr.net/**', R.cdn); pg = ctx.new_page()
    pg.on('console', lambda m: m.type in ('error','warning') and R.errors.append(f'[{m.type}] {m.text}')); pg.on('pageerror', lambda e: R.errors.append(f'[pageerror] {e}'))
    pg.goto('http://127.0.0.1:8765/CFITS.html'); pg.wait_for_selector('#locName', timeout=20000)
    pg.fill('#locName', 'test.io@kerala.gov.in'); pg.click('#locGo')
    pg.wait_for_selector('#vp1'); pg.fill('#vp1','Correct-Horse-Battery-77'); pg.fill('#vp2','Correct-Horse-Battery-77'); pg.click('#vGo')
    pg.wait_for_selector('#hubDrop', timeout=60000); print('nav', pg.evaluate("Array.from(document.querySelectorAll('#nav .nitems a')).map(a=>a.innerText.trim())")); pg.wait_for_timeout(600)
    pg.screenshot(path=str(SH/'q1_hub.png'))
    pg.fill('#hubPet', 'Test Petitioner')
    with pg.expect_file_chooser() as fc: pg.click('#hubDrop')
    fc.value.set_files(str(R.ROOT/'test/samples/NCRP_trail.xlsx'))
    pg.wait_for_selector('#hubGraph', timeout=60000); pg.wait_for_timeout(800)
    pg.screenshot(path=str(SH/'q2_loaded.png'))
    print(json.dumps(pg.evaluate("() => ({mode:S.cur.meta.mode, ack:S.cur.meta.ack, pet:S.cur.meta.petitioner, n:S.cur.work.ncrp.length, nav:Array.from(document.querySelectorAll('#nav [data-v]')).map(a=>a.dataset.v)})")))
    pg.click('#hubGraph'); pg.wait_for_timeout(1500); pg.screenshot(path=str(SH/'q3_graph.png')); pg.evaluate("document.querySelector('.content').scrollTo(0,420)"); pg.wait_for_timeout(300); pg.screenshot(path=str(SH/'q3b_graph.png'))
    pg.evaluate("go('letters')"); pg.wait_for_selector('#lPaper .letter-page', timeout=20000); pg.wait_for_timeout(800)
    pg.screenshot(path=str(SH/'q4_letters.png'))
    print(pg.evaluate("document.querySelector('.letter-page').innerText.slice(0,1500)"))
    print('zoom', pg.evaluate("LET.zoom"), pg.evaluate("(()=>{const p=document.querySelector('.letter-page').getBoundingClientRect();return [p.top,p.bottom,innerHeight]})()"))
    for t in ['bank_basic','freeze']:
        pg.evaluate(f"LET.type='{t}'; LET.sel=''; go('letters')"); pg.wait_for_timeout(500)
    with pg.expect_download(timeout=60000) as dl: pg.evaluate("LET.type='bank_basic'; LET.sel=''; go('letters')"); pg.wait_for_timeout(800); pg.click('#lPdf')
    print('pdf', dl.value.suggested_filename)
    pg.evaluate("go('start')"); pg.wait_for_timeout(500); pg.screenshot(path=str(SH/'q6_hub_after.png'))
    for v in ['dashboard','upload','cases','settings']:
        pg.evaluate(f"go('{v}')"); pg.wait_for_timeout(500); print(v, '->', pg.evaluate("S.view"))
    # case upload path
    pg.evaluate("S.cur=null; go('caseup')"); pg.wait_for_timeout(500); pg.screenshot(path=str(SH/'q6b_caseup.png')); pg.click('#hubCase'); pg.wait_for_timeout(600); pg.screenshot(path=str(SH/'q7_caseform.png'))
    print('ERRORS', R.errors)
    b.close()
