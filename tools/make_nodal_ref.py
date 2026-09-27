#!/usr/bin/env python3
"""Builds the encrypted nodal officers directory (data/nodal-ref.enc).
Usage: python3 tools/make_nodal_ref.py Nodal_Officers_Master_List.xlsx KEY_BASE64 [official1.json ...]
KEY_BASE64 is the same REF_KEY used for the ATM reference (Apps Script property REF_KEY).
Only the .enc file may be committed; never the Excel or the key. Cleaning and grouping happen in the app."""
import sys, json, gzip, os, base64, datetime, pathlib, re
import openpyxl
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
src, key = sys.argv[1], base64.b64decode(sys.argv[2])
wb = openpyxl.load_workbook(src, read_only=True)
ws = wb['All Nodal Officers'] if 'All Nodal Officers' in wb.sheetnames else wb.worksheets[0]
it = ws.iter_rows(values_only=True); hdr = [str(h or '').lower() for h in next(it)]
def col(*k): return next((i for i, h in enumerate(hdr) if any(x in h for x in k)), None)
cC, cO, cP, cE, cS = col('category'), col('organi', 'contact'), col('phone', 'mobile'), col('email', 'mail'), col('source')
rows, seen = [], set()
for r in it:
    g = lambda c: (str(r[c]).strip() if c is not None and c < len(r) and r[c] is not None else '')
    e, o, p = g(cE).lower(), re.sub(r'\s+', ' ', g(cO)), re.sub(r'[^\d+,/ ]', '', g(cP)).strip()
    if not (e or p): continue
    k = (e, o, p)
    if k in seen: continue
    seen.add(k); rows.append([g(cC), o, p, e, g(cS)])
official = []
for f in sys.argv[3:]:
    try: official += json.load(open(f))
    except Exception as ex: print('skip', f, ex)
doc = {'v': 1, 'kind': 'nodal', 'created': datetime.date.today().isoformat(), 'cols': ['cat', 'text', 'phone', 'email', 'src'], 'rows': rows, 'official': official}
raw = gzip.compress(json.dumps(doc, separators=(',', ':'), ensure_ascii=False).encode(), 9)
iv = os.urandom(12); ct = AESGCM(key).encrypt(iv, raw, b'SIXTHSENSE-REF-NODAL-V1')
out = pathlib.Path(__file__).resolve().parent.parent / 'data' / 'nodal-ref.enc'; out.write_bytes(b'SSREF1\n' + iv + ct)
js = pathlib.Path(__file__).resolve().parent.parent / 'src' / 'js' / '46-nodal-data.js'
js.write_text('/* Encrypted nodal officers directory (AES-256-GCM). Opens only with the key the access server gives approved officers. */\nconst NODAL_REF_B64 = "' + base64.b64encode(out.read_bytes()).decode() + '";\n')
print(f'{len(rows)} rows + {len(official)} official entries -> {out} ({out.stat().st_size/1e3:.0f} KB)')
