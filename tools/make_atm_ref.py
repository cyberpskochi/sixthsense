#!/usr/bin/env python3
"""Builds the encrypted ATM reference file (data/atm-ref.enc) from the ATM master Excel.
Usage: python3 tools/make_atm_ref.py ATM_INDIA-1.xlsx [existing_key_base64]
Prints the key (base64) to put in the access server's Script property REF_KEY.
The Excel and the key must never be committed to the public repository; only the .enc file is."""
import sys, re, json, gzip, os, base64, datetime, pathlib
import openpyxl
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

def id_like(v):
    v = re.sub(r'\s', '', str(v or '')).upper()
    return v if 5 <= len(v) <= 16 and re.fullmatch(r'[A-Z0-9]+', v) and re.search(r'\d', v) and re.search(r'[A-Z]', v) else ''
def clean(v):
    v = re.sub(r'_xludf\.', '', str(v or ''), flags=re.I); v = re.sub(r'^[=+\-\s]+', '', v); return re.sub(r'\s+', ' ', v).strip()
def num(v):
    try: return float(v)
    except Exception: return None

src = sys.argv[1]; key = base64.b64decode(sys.argv[2]) if len(sys.argv) > 2 else AESGCM.generate_key(256)
ws = openpyxl.load_workbook(src, read_only=True).worksheets[0]
it = ws.iter_rows(values_only=True); hdr = [re.sub(r'[^a-z0-9]', '', str(h or '').lower()) for h in next(it)]
col = lambda *names: next((hdr.index(n) for n in names if n in hdr), None)
cB, cT, cU, cC, cA1, cA2, cP, cPO, cLa, cLo = col('bankname'), col('atmnamecspname'), col('ucnpart1codeprovidedbycisbi'), col('banksinternalsystemcodecbsprovidedbybank'), col('address1'), col('address2'), col('pincode'), col('postoffice'), col('latitude'), col('longitude')
banks, bidx, rows, seen = [], {}, [], set()
for r in it:
    g = lambda c: r[c] if c is not None and c < len(r) else None
    term, cbs = id_like(g(cT)), id_like(g(cC)); ucn = re.sub(r'\s', '', str(g(cU) or '')).upper()
    aid = ucn or term or cbs
    if not aid or aid in seen: continue
    seen.add(aid)
    b = str(g(cB) or '').strip(); bi = bidx.setdefault(b, len(banks)); banks.append(b) if bi == len(banks) else None
    la, lo = num(g(cLa)), num(g(cLo)); ok = la is not None and lo is not None and 5 < la < 38 and 67 < lo < 99
    a1, a2 = clean(g(cA1)), clean(g(cA2)); addr = a1 if not a2 or a2 == a1 else a1 + ', ' + a2
    pin = re.sub(r'\D', '', str(g(cP) or ''))[:6]
    rows.append([aid, term if term != aid else '', cbs if cbs != aid else '', bi, addr[:160], clean(g(cPO))[:60], pin, round(la, 6) if ok else None, round(lo, 6) if ok else None])
doc = {'v': 1, 'kind': 'atm', 'created': datetime.date.today().isoformat(), 'cols': ['atmId', 'term', 'cbs', 'bank', 'address', 'city', 'pincode', 'lat', 'lon'], 'banks': banks, 'rows': rows}
raw = gzip.compress(json.dumps(doc, separators=(',', ':')).encode(), 9)
iv = os.urandom(12); ct = AESGCM(key).encrypt(iv, raw, b'SIXTHSENSE-REF-ATM-V1')
out = pathlib.Path(__file__).resolve().parent.parent / 'data' / 'atm-ref.enc'; out.parent.mkdir(exist_ok=True)
out.write_bytes(b'SSREF1\n' + iv + ct)
print(f'{len(rows)} ATMs, {len(banks)} banks -> {out} ({out.stat().st_size/1e6:.1f} MB)')
print('REF_KEY=' + base64.b64encode(key).decode())
