# CFITS — Cyber Financial Intelligence & Transaction Tracing System

Local-first investigation-support web app for Cyber Crime PS, Kochi City: bank-statement parsing (Excel/CSV/PDF/OCR),
multi-layer money trail (complainant → accused → suspects), KYC-linked and alternate-number CDR hits,
bank login IP → IPDR → subscriber correlation, NDPS pattern analysis, leads, requisitions and reports.
Case data never leaves the browser unencrypted; Google Drive holds only AES-256-GCM encrypted backups.

**Live app:** `https://<your-github-username>.github.io/cfits/` (after the first deployment)

- Setup, OAuth and security details: [SETUP_GUIDE.md](SETUP_GUIDE.md)
- This repository contains **no case data** and **no secrets**. The Google OAuth client ID is public by design.
- Never commit statements, CDRs, IPDRs or `.enc` backups to this repository.

Developed by ARUN R, Cyber Crime PS Kochi City.
