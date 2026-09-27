#!/usr/bin/env python3
"""Converts provider contact workbooks (legal / LE / grievance / nodal sheets) into the 'official'
JSON format used by make_nodal_ref.py. Help sheets (Read Me, workflow, checklist...) are skipped.
Usage: python3 tools/contacts_xlsx_to_json.py out.json file1.xlsx file2.xlsx ..."""
import sys, re, json, openpyxl, pathlib
EM = re.compile(r'[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}')
SKIP = re.compile(r'read ?me|workflow|checklist|categor|source register', re.I)
def cat_of(fname, sheet, row):
    f = (fname + ' ' + sheet).lower()
    if 'courier' in f or 'logistic' in f: return 'Courier / logistics'
    if 'domain' in f or 'registrar' in f: return 'Registrar / hosting'
    if 'app_developer' in f or 'developer' in sheet.lower(): return 'App developer'
    if 'food' in f or 'quickcommerce' in f: return 'Food / quick commerce'
    if 'police le' in f and 'ecommerce' in f: return 'Website / content platform'
    if 'legal routes' in f: return 'App store / platform'
    return 'E-commerce'
def role_of(h):
    h = ' ' + re.sub(r'\s+', ' ', h.lower().replace('/', ' / ')) + ' '
    if re.search(r'legal / le / grievance|legal / grievance|police / le / grievance', h): return ''   # combined column: use the row's contact type
    for k, v in [('police', 'Police / LE'), ('law enforcement', 'Law enforcement'), (' le ', 'Police / LE'), ('legal', 'Legal'), ('nodal', 'Nodal'), ('grievance', 'Grievance'), ('registrar abuse', 'Registrar abuse'), ('abuse', 'Abuse'), ('developer', 'Developer'), ('support', 'Support'), ('registry', 'Registry listing'), ('public', 'Public contact')]:
        if re.search(r'(^|[^a-z])' + re.escape(k.strip()) + r'([^a-z]|$)', h): return v
    return ''
out = []
for f in sys.argv[2:]:
    fname = pathlib.Path(f).name; checked = (re.search(r'(20\d\d-\d\d-\d\d)', fname) or [None, '2026-09-28'])[1]
    wb = openpyxl.load_workbook(f, read_only=True, data_only=True)
    for ws in wb.worksheets:
        if SKIP.search(ws.title): continue
        rows = [[('' if c is None else str(c).strip()) for c in r] for r in ws.iter_rows(values_only=True)]
        rows = [r for r in rows if any(r)]
        if len(rows) < 2: continue
        H = [h.strip() for h in rows[0]]; hl = [h.lower() for h in H]
        if not any('mail' in h or 'phone' in h or 'portal' in h or 'source' in h for h in hl): continue
        cOrg = 1 if hl[0] in ('no.', 'no', 'sl', 'sl no') else 0
        ci = lambda *k: next((i for x in k for i, h in enumerate(hl) if x in h and i != cOrg), None)
        cEnt = ci('legal entity', 'operator / entity', 'developer / legal', 'entity type' if False else 'legal entity')
        cWeb = ci('portal / route', 'official website', 'website', 'official source', 'source / evidence', 'url')
        cType = ci('contact type', 'legal contact type', 'route / contact type', 'purpose'); cNote = ci('police request note', 'police use', 'police/legal use', 'verification', 'notes', 'key point', 'data status')
        cAddr = ci('address')
        emailCols = [i for i, h in enumerate(hl) if 'mail' in h]; phoneCols = [i for i, h in enumerate(hl) if 'phone' in h]
        nameCols = {i: h for i, h in enumerate(hl) if re.search(r'(grievance|nodal) officer$', h)}
        for r in rows[1:]:
            g = lambda i: r[i] if i is not None and i < len(r) else ''
            org = re.sub(r'\s+', ' ', g(cOrg)).strip()
            if not org or len(org) > 120: continue
            ent = g(cEnt) if cEnt is not None and cEnt != cOrg else ''
            contacts = []; seen = set()
            for i in emailCols:
                role = role_of(H[i]); nm = ''
                for j, h in nameCols.items():
                    if h.split()[0] in H[i].lower(): nm = g(j)
                for e in EM.findall(g(i)):
                    e = e.lower().rstrip('.')
                    if e in seen: continue
                    seen.add(e); ct = g(cType) if len(g(cType)) < 60 else ''
                    contacts.append({'role': (role + (' · ' + ct if ct and role and ct.lower() != role.lower() else '')) if role else (ct or 'Contact'), 'name': nm, 'email': e, 'phone': '', 'address': g(cAddr)[:160] if cAddr is not None else ''})
            phones = [p for p in (g(i) for i in phoneCols) if re.search(r'\d{3}', p)]
            ph = ' / '.join(dict.fromkeys(phones))[:80]
            if contacts and ph: contacts[0]['phone'] = ph
            elif ph: contacts.append({'role': role_of(H[phoneCols[0]]) if phoneCols else 'Phone', 'email': '', 'phone': ph})
            web = g(cWeb); portal = web if re.match(r'https?://', web) else ''
            if not contacts and portal: contacts.append({'role': g(cType)[:60] or 'Legal / LE route', 'email': '', 'phone': '', 'portal': portal})
            elif not contacts and g(cType) and re.search(r'portal', g(cWeb) + g(cType), re.I): contacts.append({'role': g(cType)[:60], 'email': '', 'phone': '', 'note': g(cWeb)[:200]})
            if not contacts: continue
            note = g(cNote)[:220] if cNote is not None else ''
            for c in contacts:
                if note and not c.get('note'): c['note'] = note
            out.append({'entity': org, 'category': cat_of(fname, ws.title, r), 'aliases': [ent] if ent and ent.lower() != org.lower() else [], 'contacts': contacts, 'web': portal, 'source': [fname], 'confidence': 'list', 'checked': checked, 'file': fname})
json.dump(out, open(sys.argv[1], 'w'), ensure_ascii=False, indent=0)
print(len(out), 'entries,', sum(len(e['contacts']) for e in out), 'contacts,', sum(1 for e in out for c in e['contacts'] if c.get('email')), 'emails')
