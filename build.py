#!/usr/bin/env python3
"""Builds dist/CFITS.html — one self-contained page (libraries from jsDelivr with SRI)."""
import base64, hashlib, json, os, pathlib, sys

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / 'src'
V = ROOT / 'vendor'
CDN = 'https://cdn.jsdelivr.net/npm/'

def sri(p):
    return 'sha384-' + base64.b64encode(hashlib.sha384(p.read_bytes()).digest()).decode()

LIBS = [  # (global, npm path, local file)
    ('xlsx', '@e965/xlsx@0.20.3/dist/xlsx.full.min.js', V / 'e965/package/dist/xlsx.full.min.js'),
    ('pdfjs', 'pdfjs-dist@3.11.174/build/pdf.min.js', V / 'pdfjs-dist-3.11.174/package/build/pdf.min.js'),
    ('cytoscape', 'cytoscape@3.30.2/dist/cytoscape.min.js', V / 'cytoscape-3.30.2/package/dist/cytoscape.min.js'),
    ('chart', 'chart.js@4.4.4/dist/chart.umd.js', V / 'chart.js-4.4.4/package/dist/chart.umd.js'),
    ('jspdf', 'jspdf@2.5.1/dist/jspdf.umd.min.js', V / 'jspdf-2.5.1/package/dist/jspdf.umd.min.js'),
    ('autotable', 'jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js', V / 'jspdf-autotable-3.8.2/package/dist/jspdf.plugin.autotable.min.js'),
]
PDF_WORKER = ('pdfjs-dist@3.11.174/build/pdf.worker.min.js', V / 'pdfjs-dist-3.11.174/package/build/pdf.worker.min.js')
TESS = ('tesseract.js@5.1.1/dist/tesseract.min.js', V / 'tesseract.js-5.1.1/package/dist/tesseract.min.js')

def build(client_id='__GOOGLE_CLIENT_ID__', out='dist/CFITS.html'):
    css = (SRC / 'styles.css').read_text()
    js_files = sorted((SRC / 'js').glob('*.js'))
    libs_js = 'const LIBS = ' + json.dumps({
        'pdfWorker': {'src': CDN + PDF_WORKER[0], 'sri': sri(PDF_WORKER[1])},
        'tesseract': {'src': CDN + TESS[0], 'sri': sri(TESS[1])},
        'tessWorker': CDN + 'tesseract.js@5.1.1/dist/worker.min.js',
        'tessCore': CDN + 'tesseract.js-core@5.1.1',
        'tessLang': CDN + '@tesseract.js-data/eng@1.0.0/4.0.0_best_int',
    }) + ';\n'
    js = libs_js + '\n'.join(f.read_text() for f in js_files)
    js = js.replace('__GOOGLE_CLIENT_ID__', client_id)
    js = js.replace('__BACKEND_URL__', os.environ.get('SIXTHSENSE_BACKEND_URL', '').strip())
    def as_js_list(env):
        items = [x.strip().lower() for x in os.environ.get(env, '').split(',') if x.strip()]
        return json.dumps(items)
    js = js.replace('ALLOWED_EMAILS: [],', 'ALLOWED_EMAILS: ' + as_js_list('CFITS_ALLOWED_EMAILS') + ',', 1)
    if os.environ.get('CFITS_ALLOW_LOCAL_MODE') == '1':
        js = js.replace('ALLOW_LOCAL_MODE: false,', 'ALLOW_LOCAL_MODE: true,', 1)
    js = js.replace('ALLOWED_DOMAINS: [],', 'ALLOWED_DOMAINS: ' + as_js_list('CFITS_ALLOWED_DOMAINS') + ',', 1)
    tags = '\n'.join(f'<script src="{CDN + p}" integrity="{sri(f)}" crossorigin="anonymous" referrerpolicy="no-referrer"></script>' for _, p, f in LIBS)
    inline = '\n' + js + '\n'
    h = base64.b64encode(hashlib.sha256(inline.encode()).digest()).decode()
    csp = ("default-src 'none'; "
           f"script-src 'sha256-{h}' https://cdn.jsdelivr.net https://accounts.google.com/gsi/client 'wasm-unsafe-eval'; "
           "style-src 'unsafe-inline' https://accounts.google.com/gsi/style https://fonts.googleapis.com; "
           "img-src data: blob: https://*.googleusercontent.com https://*.gstatic.com; "
           "connect-src https://www.googleapis.com https://oauth2.googleapis.com https://accounts.google.com https://cdn.jsdelivr.net https://script.google.com https://script.googleusercontent.com https://api.ipify.org blob: data:; "
           "frame-src https://accounts.google.com; worker-src blob:; font-src data: https://fonts.gstatic.com; "
           "form-action 'none'; base-uri 'none'; object-src 'none'")
    html = (SRC / 'shell.html').read_text()
    html = html.replace('__CSS__', css).replace('__LIBS__', tags).replace('__CSP__', csp)
    html = html.replace('<script>\n__JS__\n</script>', '<script>' + inline + '</script>')
    p = ROOT / out; p.parent.mkdir(exist_ok=True); p.write_text(html)
    print(f'built {p} {p.stat().st_size/1024:.0f} KB, {len(js_files)} modules')

if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if a]
    build(*args)
