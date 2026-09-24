/**
 * SIXTH SENSE — access-control backend (Google Apps Script Web App)
 * (C) ARUN R — Cyber Crime Police Station, Kochi City
 *
 * Stores ONLY the user list and an activity log in a private Google Sheet in the
 * admin's Drive ("SIXTH SENSE — Users & Logs"). No case data ever reaches this script.
 *
 * Every request carries the user's Google access token. The script verifies it with
 * Google (tokeninfo), checks it was issued to the SIXTH SENSE OAuth client, and reads
 * the verified e-mail from Google — the browser cannot fake who it is.
 *
 * Script properties (Project Settings → Script properties):
 *   CLIENT_ID    = the OAuth Web client ID (…apps.googleusercontent.com)
 *   ADMIN_EMAIL  = the main admin's Gmail (cannot be blocked or deleted)
 *   REF_KEY      = (optional) key that unlocks the encrypted ATM reference file for approved users
 *
 * Deploy → New deployment → Web app → Execute as: Me · Who has access: Anyone
 */
var SHEET_NAME = 'SIXTH SENSE — Users & Logs';
var USER_COLS = ['email', 'name', 'role', 'status', 'addedAt', 'addedBy', 'lastLogin', 'lastIP', 'note'];
var LOG_COLS = ['ts', 'email', 'name', 'action', 'detail', 'ip'];

function doGet() { return out_({ ok: true, app: 'SIXTH SENSE access backend', time: new Date().toISOString() }); }

function doPost(e) {
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var who = verify_(req.token);
    var c = cfg_();
    ensureMainAdmin_(c.admin);
    var ip = clip_(req.ip, 60);
    var me = findUser_(who.email);
    var a = String(req.action || '');

    if (a === 'login') {
      if (!me) {
        appendUser_({ email: who.email, name: clip_(req.name, 80), role: 'user', status: 'pending', addedAt: now_(), addedBy: 'self-request', lastLogin: now_(), lastIP: ip, note: '' });
        log_(who.email, req.name, 'ACCESS REQUESTED', 'New sign-in waiting for admin approval', ip);
        return out_({ ok: true, status: 'pending', role: 'user' });
      }
      me.lastLogin = now_(); me.lastIP = ip; if (!me.name && req.name) me.name = clip_(req.name, 80);
      writeUser_(me);
      log_(who.email, me.name, me.status === 'approved' ? 'LOGIN' : 'LOGIN DENIED (' + me.status + ')', '', ip);
      return out_({ ok: true, status: me.status, role: me.role, name: me.name });
    }
    if (a === 'check') return out_({ ok: true, status: me ? me.status : 'unknown', role: me ? me.role : 'user' });

    if (!me || me.status !== 'approved') return out_({ ok: false, error: 'Access not approved' });

    if (a === 'refKey') {
      var k = PropertiesService.getScriptProperties().getProperty('REF_KEY');
      if (!k) return out_({ ok: false, error: 'ATM reference key not set on the access server (Script property REF_KEY)' });
      log_(who.email, me.name, 'REF DATA KEY', 'Encrypted ATM reference data unlocked', ip);
      return out_({ ok: true, key: k });
    }

    if (a === 'log') {
      var en = req.entry || {};
      log_(who.email, me.name, clip_(en.action, 60), clip_(en.detail, 300), ip);
      return out_({ ok: true });
    }

    if (me.role !== 'admin') return out_({ ok: false, error: 'Admin only' });

    if (a === 'listUsers') return out_({ ok: true, users: readUsers_(), mainAdmin: c.admin, me: who.email });

    if (a === 'addUser') {
      var em = String(req.email || '').toLowerCase().trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return out_({ ok: false, error: 'Invalid e-mail address' });
      var role = req.role === 'admin' ? 'admin' : 'user';
      var ex = findUser_(em);
      if (ex) { ex.status = 'approved'; ex.role = em === c.admin ? 'admin' : role; if (req.name) ex.name = clip_(req.name, 80); writeUser_(ex); }
      else appendUser_({ email: em, name: clip_(req.name, 80), role: role, status: 'approved', addedAt: now_(), addedBy: who.email, lastLogin: '', lastIP: '', note: clip_(req.note, 120) });
      log_(who.email, me.name, 'USER ADDED', em + ' as ' + role, ip);
      return out_({ ok: true, users: readUsers_() });
    }

    if (a === 'updateUser') {
      var em2 = String(req.email || '').toLowerCase().trim(); var u = findUser_(em2);
      if (!u) return out_({ ok: false, error: 'User not found' });
      if (em2 === c.admin) return out_({ ok: false, error: 'The main admin cannot be changed' });
      var st = ['pending', 'approved', 'blocked'].indexOf(req.status) >= 0 ? req.status : u.status;
      var rl = req.role === 'admin' ? 'admin' : 'user';
      if (em2 === who.email && (st !== 'approved' || rl !== 'admin')) return out_({ ok: false, error: 'You cannot block or demote yourself' });
      var before = u.status + '/' + u.role; u.status = st; u.role = rl; if (typeof req.name === 'string' && req.name) u.name = clip_(req.name, 80); if (typeof req.note === 'string') u.note = clip_(req.note, 120);
      writeUser_(u);
      log_(who.email, me.name, st === 'blocked' ? 'USER BLOCKED' : 'USER UPDATED', em2 + ': ' + before + ' → ' + st + '/' + rl, ip);
      return out_({ ok: true, users: readUsers_() });
    }

    if (a === 'deleteUser') {
      var em3 = String(req.email || '').toLowerCase().trim();
      if (em3 === c.admin) return out_({ ok: false, error: 'The main admin cannot be deleted' });
      if (em3 === who.email) return out_({ ok: false, error: 'You cannot delete yourself' });
      if (!deleteUser_(em3)) return out_({ ok: false, error: 'User not found' });
      log_(who.email, me.name, 'USER DELETED', em3, ip);
      return out_({ ok: true, users: readUsers_() });
    }

    if (a === 'getLogs') {
      var lim = Math.min(Math.max(parseInt(req.limit, 10) || 500, 1), 3000);
      return out_({ ok: true, logs: readLogs_(lim) });
    }
    return out_({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return out_({ ok: false, error: String((err && err.message) || err) });
  }
}

/* ---------------- token verification ---------------- */
function verify_(token) {
  if (!token || typeof token !== 'string' || token.length > 4096) throw new Error('Not signed in');
  var key = 'tk_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token));
  var cache = CacheService.getScriptCache(); var hit = cache.get(key);
  if (hit) return JSON.parse(hit);
  var r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error('Google sign-in expired — please sign in again');
  var t = JSON.parse(r.getContentText()); var c = cfg_();
  if (!c.clientId) throw new Error('Backend not configured: set the CLIENT_ID script property');
  if (t.aud !== c.clientId && t.azp !== c.clientId) throw new Error('Token was not issued to SIXTH SENSE');
  if (String(t.email_verified) !== 'true' || !t.email) throw new Error('Google e-mail address not verified');
  var who = { email: String(t.email).toLowerCase() };
  var ttl = Math.min(300, Math.max(0, parseInt(t.expires_in, 10) - 30)); if (ttl > 0) cache.put(key, JSON.stringify(who), ttl);
  return who;
}

/* ---------------- storage ---------------- */
function cfg_() { var p = PropertiesService.getScriptProperties(); return { clientId: String(p.getProperty('CLIENT_ID') || '').trim(), admin: String(p.getProperty('ADMIN_EMAIL') || '').toLowerCase().trim() }; }
var _SS = null, _USERS = null;
function book_() {
  if (_SS) return _SS;
  var p = PropertiesService.getScriptProperties(); var id = p.getProperty('SHEET_ID'); var ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) { ss = SpreadsheetApp.create(SHEET_NAME); p.setProperty('SHEET_ID', ss.getId()); }
  sheet_(ss, 'Users', USER_COLS); sheet_(ss, 'Logs', LOG_COLS);
  var def = ss.getSheetByName('Sheet1'); if (def && ss.getSheets().length > 2) ss.deleteSheet(def);
  _SS = ss; return ss;
}
function sheet_(ss, name, cols) { var sh = ss.getSheetByName(name); if (!sh) { sh = ss.insertSheet(name); sh.appendRow(cols); sh.setFrozenRows(1); } return sh; }
function fresh_() { _USERS = null; }
function users_() { return book_().getSheetByName('Users'); }
function readUsers_() {
  if (_USERS) return _USERS;
  var sh = users_(); var v = sh.getDataRange().getValues(); var out = [];
  for (var i = 1; i < v.length; i++) { if (!v[i][0]) continue; var o = { _row: i + 1 }; USER_COLS.forEach(function (k, j) { o[k] = v[i][j] instanceof Date ? v[i][j].toISOString() : String(v[i][j] || ''); }); out.push(o); }
  _USERS = out; return out;
}
function findUser_(email) { email = String(email || '').toLowerCase(); var us = readUsers_(); for (var i = 0; i < us.length; i++) if (us[i].email.toLowerCase() === email) return us[i]; return null; }
function withLock_(fn) { var l = LockService.getScriptLock(); l.waitLock(15000); try { return fn(); } finally { l.releaseLock(); } }
function appendUser_(u) { fresh_(); withLock_(function () { users_().appendRow(USER_COLS.map(function (k) { return safe_(u[k] || ''); })); }); }
function writeUser_(u) { fresh_(); withLock_(function () { users_().getRange(u._row, 1, 1, USER_COLS.length).setValues([USER_COLS.map(function (k) { return safe_(u[k] || ''); })]); }); }
function deleteUser_(email) { return withLock_(function () { fresh_(); var u = findUser_(email); fresh_(); if (!u) return false; users_().deleteRow(u._row); return true; }); }
function ensureMainAdmin_(admin) {
  if (!admin) return; var cache = CacheService.getScriptCache(); if (cache.get('mainok_' + admin)) return;
  var u = findUser_(admin);
  if (!u) appendUser_({ email: admin, name: '', role: 'admin', status: 'approved', addedAt: now_(), addedBy: 'setup', lastLogin: '', lastIP: '', note: 'main admin' });
  else if (u.role !== 'admin' || u.status !== 'approved' || u.note !== 'main admin') { u.role = 'admin'; u.status = 'approved'; u.note = 'main admin'; writeUser_(u); }
  cache.put('mainok_' + admin, '1', 600);
}
function log_(email, name, action, detail, ip) { withLock_(function () { book_().getSheetByName('Logs').appendRow([now_(), safe_(email), safe_(name || ''), safe_(action), safe_(detail || ''), safe_(ip || '')]); }); }
function readLogs_(limit) {
  var sh = book_().getSheetByName('Logs'); var n = sh.getLastRow() - 1; if (n <= 0) return [];
  var start = Math.max(2, sh.getLastRow() - limit + 1); var v = sh.getRange(start, 1, sh.getLastRow() - start + 1, LOG_COLS.length).getValues();
  return v.reverse().map(function (r) { var o = {}; LOG_COLS.forEach(function (k, j) { o[k] = r[j] instanceof Date ? r[j].toISOString() : String(r[j] || ''); }); return o; });
}
function now_() { return new Date().toISOString(); }
function clip_(s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').slice(0, n); }
function safe_(v) { v = String(v == null ? '' : v); return /^[=+\-@]/.test(v) ? "'" + v : v; }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* Run once from the editor (▶ setup) to create the sheet and check the properties. */
function setup() {
  var c = cfg_(); if (!c.clientId || !c.admin) throw new Error('Set CLIENT_ID and ADMIN_EMAIL in Project Settings → Script properties first');
  ensureMainAdmin_(c.admin); Logger.log('Users & Logs sheet: ' + book_().getUrl());
}
