#!/usr/bin/env python3
"""Rotates the reference-data key (REF_KEY) — run it whenever an approved user is removed or blocked.
Decrypts data/atm-ref.enc and data/nodal-ref.enc with the OLD key and re-encrypts them with a NEW random key,
then rewrites src/js/46-nodal-data.js. Afterwards: paste the new key into Apps Script → Project Settings →
Script properties → REF_KEY, upload the changed files to GitHub, and delete the key file.
Usage: python3 tools/rotate_ref_key.py OLD_KEY_BASE64 [NEW_KEY_BASE64]"""
import sys, os, base64, pathlib
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
root = pathlib.Path(__file__).resolve().parent.parent
old = base64.b64decode(sys.argv[1]); new = base64.b64decode(sys.argv[2]) if len(sys.argv) > 2 else AESGCM.generate_key(256)
FILES = [('data/atm-ref.enc', b'SIXTHSENSE-REF-ATM-V1'), ('data/nodal-ref.enc', b'SIXTHSENSE-REF-NODAL-V1')]
done = []
for rel, aad in FILES:
    p = root / rel
    if not p.exists(): print('skip (missing)', rel); continue
    b = p.read_bytes(); assert b[:7] == b'SSREF1\n', rel + ' is not a reference file'
    plain = AESGCM(old).decrypt(b[7:19], b[19:], aad)          # raises if the old key is wrong — nothing is changed then
    iv = os.urandom(12); done.append((p, b'SSREF1\n' + iv + AESGCM(new).encrypt(iv, plain, aad)))
for p, data in done: p.write_bytes(data); print('re-encrypted', p.relative_to(root), f'{len(data)/1e3:.0f} KB')
nodal = root / 'data/nodal-ref.enc'
if nodal.exists():
    (root / 'src/js/46-nodal-data.js').write_text('/* Encrypted nodal officers directory (AES-256-GCM). Opens only with the key the access server gives approved officers. */\nconst NODAL_REF_B64 = "' + base64.b64encode(nodal.read_bytes()).decode() + '";\n')
    print('rewrote src/js/46-nodal-data.js')
kf = root / 'NEW_REF_KEY.txt'
kf.write_text('SIXTH SENSE - NEW reference data key\n\nApps Script > Project Settings > Script properties > REF_KEY = \n' + base64.b64encode(new).decode() + '\n\nPaste it, upload the changed files to GitHub, then DELETE this file. Never commit it.\n')
print('new key written to', kf.name, '(paste into Apps Script REF_KEY, then delete the file)')
