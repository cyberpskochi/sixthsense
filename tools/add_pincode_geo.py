"""Adds approximate branch coordinates to data/ifsc-db.bin.
PIN-code centroids: npm `pincode-lat-long` 1.0.3 (ISC licence, ~18.9k PIN codes).
Per IFSC the PIN is read from the branch address; district centroids (mean of branch PINs) are the fallback.
Usage: python3 tools/add_pincode_geo.py pins.json   (pins.json = {"682011": [lat, lon], ...})"""
import gzip, json, re, sys, collections, pathlib
P = pathlib.Path(__file__).resolve().parent.parent / 'data' / 'ifsc-db.bin'
pins = json.load(open(sys.argv[1]))
d = json.loads(gzip.decompress(P.read_bytes()))
rx = re.compile(r'\b(\d{3})\s?(\d{3})\b(?!.*\b\d{6}\b)')
acc = collections.defaultdict(list); hit = 0
for r in d['rows']:
    m = rx.search(str(r[2])); pin = ''.join(m.groups()) if m else ''
    if pin in pins:
        hit += 1
        if r[4] >= 0: acc[r[4]].append(pins[pin])
dll = {str(k): [round(sum(p[0] for p in v) / len(v), 4), round(sum(p[1] for p in v) / len(v), 4)] for k, v in acc.items() if len(v) >= 1}
used = set()
for r in d['rows']:
    m = rx.search(str(r[2]))
    if m: used.add(''.join(m.groups()))
d['pins'] = {k: v for k, v in pins.items() if k in used or True}
d['dll'] = dll; d['geoSrc'] = 'PIN centroids: npm pincode-lat-long 1.0.3 (ISC). Approximate (PIN-code / district level).'
P.write_bytes(gzip.compress(json.dumps(d, separators=(',', ':')).encode(), 9))
print('rows', len(d['rows']), 'with PIN coords', hit, 'district centroids', len(dll), 'size', P.stat().st_size)
