# CFITS — Setup, Security & User Guide
Cyber Financial Intelligence & Transaction Tracing System · v1.0.0
Developed by ARUN R, Cyber Crime PS Kochi City

---

## 1. What you get

| File | Purpose |
|---|---|
| `dist/CFITS.html` | The complete application — one page. Host it on GitHub Pages (or any HTTPS host). |
| `src/` | Source modules (`styles.css`, `js/01…99`). Edit these, then rebuild. |
| `build.py` | Combines `src/` into `dist/CFITS.html`, adds library integrity hashes and a strict Content-Security-Policy. |
| `fetch_vendor.sh` | Downloads the exact library versions so `build.py` can compute the integrity hashes. |
| `test/` | Synthetic sample files in several bank formats, plus automated browser tests. |

## 2. Security design (read before deploying)

- **Local-first.** Statements, KYC, CDR, IP logs and IPDR are parsed and analysed only in the officer's browser. Nothing is sent to an AI or any third-party service.
- **Encrypted at rest.** Everything saved on the computer (IndexedDB) is AES-256-GCM encrypted. The key is derived from the **vault passphrase** (PBKDF2-SHA256, 600,000 iterations). The passphrase cannot be recovered — if it is lost, the data cannot be decrypted.
- **Google sign-in** identifies the officer. It also grants a Drive token limited to the `drive.file` scope, which means the app can only see the files it created itself.
- **Google Drive = encrypted backup only.** Each backup is a `.enc` package encrypted in the browser before upload. The file header holds only the key-derivation settings (salt and iteration count), never the key. Verify checks the SHA-256 hash and decrypts the package. Restore brings it back as a case.
- **Access list.** `CONFIG.ALLOWED_EMAILS` and `CONFIG.ALLOWED_DOMAINS` reject any Google account that is not listed. This check runs in the browser, so it keeps honest users out but cannot stop a determined attacker. The real protection is the vault encryption: without the passphrase, the data cannot be read.
- **Hardening:** strict CSP (the inline script is allowed only by its SHA-256 hash, no `eval`), integrity-checked libraries from jsDelivr, refusal to run inside frames, auto-lock after inactivity (default 15 min, which also wipes decrypted data from memory), optional session-only mode, and protection against formula injection in Excel/CSV exports.
- **Tamper-evident audit log.** Every entry is hash-chained to the one before it. Use Settings → *Verify integrity* to check the chain.
- **Evidence integrity.** Every imported file's SHA-256 is recorded in Data Quality → Import register (useful for the Sec. 63 BSA certificate). Every transaction keeps its source file, sheet/page, row and original text.

## 3. Google OAuth setup (one time, ~10 minutes)

1. Open **console.cloud.google.com** → create a project, e.g. `cfits-cyberps-kochi`.
2. **APIs & Services → Library** → enable **Google Drive API**.
3. **APIs & Services → OAuth consent screen**
   - User type: *Internal* if you use a Google Workspace domain; otherwise *External*.
   - App name `CFITS`, your support e-mail.
   - Scopes: `openid`, `email`, `profile`, `.../auth/drive.file`.
   - For *External*: add each officer's Gmail under **Test users**. While the app is in Testing, only these accounts can sign in, which gives you an extra server-side gate.
4. **Credentials → Create credentials → OAuth client ID → Web application**
   - Authorised JavaScript origins: `https://cyberpskochi.github.io` (your Pages origin). Add `http://localhost:8000` if you want to test locally.
   - No redirect URI is needed (the app uses the token popup).
   - Copy the **Client ID** (`…apps.googleusercontent.com`). There is **no client secret** in this app — never put one in the page.
5. Build with your client ID:
   ```bash
   ./fetch_vendor.sh                       # once
   python3 build.py 1234567890-abc.apps.googleusercontent.com
   ```
6. Set who may sign in: edit `src/js/01-config.js` before building:
   ```js
   ALLOWED_EMAILS: ['io1.cyberkochi@gmail.com', 'sho.cyberkochi@gmail.com'],
   ALLOWED_DOMAINS: ['kerala.gov.in'],
   ```
7. Deploy: copy `dist/CFITS.html` into your Pages repo (e.g. as `cfits/index.html`) and push. It must be served over HTTPS, because the encryption APIs refuse to run otherwise.

Without a client ID the app runs in **local mode**. The encrypted vault works, but Drive backup is disabled.

## 4. Workflow for a case (complainant → 50 accused → 100 suspects)

1. **Cases → New case** (Case ID, FIR, PS, IO, type, confidentiality).
2. **Import Data → Bank statements.** Choose the bank (or Auto-detect), leave Role = *Auto*, and drop all statements at once, or use *Choose folder*.
   - Excel, CSV, TXT and PDF are accepted. Scanned PDFs go through OCR.
   - A bank reply that lists many accounts in one sheet is split by the account-number column.
   - Files that pass header detection, date parsing and the **balance-continuity check** are *Ready*. Anything uncertain goes to **Needs review**.
   - **Review** shows the detected header and the column mapping, lets you edit it, and previews the normalised rows. Rows that could not be parsed are kept with the reason — never silently dropped.
   - *Save as template* remembers the layout for that bank, so the next file in the same format imports automatically.
3. **Mark the complainant.** Set Role = Complainant on the complainant's accounts (Accounts → Set role, or choose it at import). Then either:
   - mark the disputed debits (Transactions → filter → ⚑ Mark, or *Mark by UTR list*), or
   - import the **NCRP money trail**, which sets layers and auto-marks the disputed debits by UTR.
4. **Import KYC replies.** These bring in the registered mobile, **alternate numbers**, e-mail, PAN, UPI IDs and customer ID.
5. **Import bank login IP logs.** Set *UTC → IST* if the bank gives GMT. Then import the **IPDR** from the telecom operator or ISP.
6. **Import CDRs** for registered and alternate numbers. The target number is auto-detected. Add the caller's number under Entities → *Add investigation number*.
7. Work the screens:
   - **Money Trail:** layer view (Complainant → L1 → L2 → L3…), flow ledger with the reason for every match, trace by disputed transaction, common receivers, ambiguous matches to confirm.
   - **Transaction Intelligence** (click any transaction): backward and forward trace, ±15-min timeline of calls, SMS/OTP and logins, the login IP → IPDR → subscriber chain, and the source row.
   - **IP Intelligence:** transaction → login session → IPDR number; IPs and devices shared across accounts; new-IP alerts on the complainant account; IPDR requisition list with IST and UTC times and ports.
   - **Telecom:** direct hits between known numbers (complainant contact flagged), common contacts, shared IMEI, cell co-location, hit matrix.
   - **Correlation:** one row per trail transaction with calls, OTP, login IP, IPDR number and strength.
   - **Patterns / NDPS:** date range, weekday, amount ± tolerance → repeated amounts, heatmap, micro/validation transactions.
   - **Leads, Requisitions, Tasks.**
   - **Reports:** PDF (complete, summary, account, transaction, CDR, pattern), Excel workbook, encrypted `.enc` package.
8. **Drive Backup:** Connect → Backup current case → Verify. Auto-backup can be switched on.

### How matching decides (shown in every flow's "Why")
1. Same **UTR/RRN** on the debit and the credit → STRONG.
2. Same transaction **reference** → STRONG.
3. Beneficiary **account number / masked account / UPI ID / mobile** in the debit narration, linked to a known account → STRONG if the credit is found, MODERATE if its statement is still pending.
4. **Amount + time window**, only when exactly one candidate exists → POSSIBLE. Several candidates → *Ambiguous*, which the officer confirms.

The traced amount follows the money through each account (traced-funds-first by default, or proportional to balance) and is never more than the running balance allows. "Possibly available" is the traced money not yet debited as of the last statement row. Confirm it with the bank before a hold request.

## 5. Interpretation rules built into the app
- Cell-site data is shown as "CDR / cell-site correlation", never as an exact location.
- A public IP identifies a subscriber only together with the exact time, and for CGNAT (100.64/10) the source port. The app says when the port is missing.
- Leads are observations for verification, never proof of guilt. Records are never merged automatically; possible matches need *Confirm* or *Reject*.
- When the source statement has no transaction time, the app says so ("time unavailable") and uses wider, weaker windows.

## 6. Test checklist (run before production)
- [ ] Sign-in with an allowed and a non-allowed Google account (the second must be refused).
- [ ] Create the vault. A wrong passphrase must be rejected. Auto-lock works.
- [ ] Load the demo case. All 19 screens open without errors.
- [ ] Import one real statement per bank you use. Compare opening/closing balance, the debit and credit totals and the transaction count with the bank's own figures. Save a template for each bank.
- [ ] Import a scanned PDF (OCR). Check the unparsed-rows list.
- [ ] Mark disputed transactions. Check Layer 1 amounts against the NCRP trail.
- [ ] IP log (UTC) + IPDR. Check that login times convert to IST and that the IPDR number resolves.
- [ ] CDR for a registered and an alternate number. Check direct hits and common contacts.
- [ ] Generate the complete PDF report and the Excel workbook.
- [ ] Drive backup → Verify → Restore under a new Case ID.
- [ ] Settings → Verify audit integrity.

## 7. Bank formats
Built-in profiles: Axis, Bandhan, Bank of Baroda, Canara, Dhanlaxmi, ESAF, Federal, HDFC, ICICI, IDBI, IDFC FIRST, Indian Bank, IOB, Kotak, IPPB, SBI, UCO, Union, YES, PNB, IndusInd, South Indian Bank, CSB, Airtel/Paytm Payments, AU SFB, KVB, Kerala Gramin + Generic.

The automated tests used synthetic files shaped like ICICI (Tran_ID / Dr_Amt / Cr_Amt / pstd_dt with time), BoB (newest-first, date+time, Line Balance), SBI CSV (single Amount + Dr/Cr, no time) and an HDFC-style text PDF. All four parsed with 0 rejects and matched by UTR.

**Your real bank sample templates were not available in this session.** Run each real template through Import once, and confirm and save the mapping. After that, files in the same layout from that bank import automatically.

## 8. Rebuilding after edits
```bash
python3 build.py <client-id>          # rebuild dist/CFITS.html
python3 test/make_samples.py          # synthetic sample files
python3 test/run_test.py all          # headless end-to-end test (needs Playwright + Chromium)
python3 test/scale_test.py            # 100k transactions / 300k CDR performance test
```
