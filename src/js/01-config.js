'use strict';
/* =====================================================================
   SIXTH SENSE (CFITS engine) — Cyber Financial Intelligence & Transaction Tracing System
   (C) ARUN R — Cyber Crime Police Station, Kochi City
   Local-first. All analysis runs in this browser. Data at rest is
   AES-256-GCM encrypted. Google Drive is used only for encrypted backup.
   ===================================================================== */
const CONFIG = {
  APP: 'CFITS', APP_NAME: 'SIXTH SENSE', FILE_PREFIX: 'SIXTHSENSE', VERSION: '1.0.0', PARSER_VERSION: 'cfits-parser-1.0',
  // ---- Google OAuth (see SETUP guide). Public client ID only; no secret is ever placed here.
  GOOGLE_CLIENT_ID: '__GOOGLE_CLIENT_ID__',
  // Access-control backend (Apps Script Web App …/exec). Holds the approved-user list and activity log only.
  BACKEND_URL: '__BACKEND_URL__',
  REF_ATM_URL: 'data/atm-ref.enc',
  // Local (no-Google) mode is disabled in production builds; Google sign-in is mandatory.
  ALLOW_LOCAL_MODE: false,
  // Access gate. Leave both empty to allow any Google account (not recommended).
  // Note: this check runs in the browser; the real protection is the vault encryption.
  ALLOWED_EMAILS: [],            // e.g. ['io1.cyberkochi@gmail.com']
  ALLOWED_DOMAINS: [],           // e.g. ['kerala.gov.in','keralapolice.gov.in']
  DRIVE_SCOPE: 'https://www.googleapis.com/auth/drive.file',
  DRIVE_FOLDER: 'SIXTH SENSE Encrypted Backups',
  PBKDF2_ITER: 600000,
  MIN_PASSPHRASE: 12,
  AUTO_LOCK_MIN: 30,
  CREDIT: 'Developed by ARUN R, Cyber Crime PS Kochi City'
};
const CASE_TYPES = ['Cyber Financial Fraud','Account Takeover','Digital Arrest','Investment Fraud','UPI Fraud','OTP Sharing','Mule Account','NDPS Financial Tracking','Other'];
const CASE_STATUS = ['Under Investigation','Charge-sheeted','Referred','Closed'];
const CONF_LEVELS = ['CONFIDENTIAL','SECRET','RESTRICTED'];
const ENTITY_TYPES = ['PERSON','ORGANISATION','VICTIM','ACCUSED','SUSPECT','MULE ACCOUNT HOLDER','UNKNOWN ACCOUNT HOLDER','BANK OFFICIAL','MERCHANT','OTHER'];
const ROLES = ['Complainant','Accused (L1)','Suspect (L2)','Suspect (L3+)','Mule','Merchant','Unknown','Other'];
const NUMBER_ROLES = ['Victim','Accused','Suspect','Bank-linked','Unknown','Other'];
const CHANNELS = ['UPI','IMPS','NEFT','RTGS','ATM','CASH','CARD','CHEQUE','POS','NET BANKING','BANK TRANSFER','UNKNOWN'];
const LEAD_STATUS = ['New','Under Review','Verified','Not Relevant','Closed'];
const TASK_STATUS = ['PENDING','IN PROGRESS','COMPLETED','NOT REQUIRED'];
