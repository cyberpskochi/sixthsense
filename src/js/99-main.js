/* ------------------------------ boot ------------------------------ */
window.addEventListener('error', e => { console.error(e.error || e.message); try { toast('Error: ' + (e.message || 'unexpected'), 'err'); } catch {} });
window.addEventListener('unhandledrejection', e => { console.error(e.reason); try { toast('Error: ' + ((e.reason && e.reason.message) || 'unexpected'), 'err'); } catch {} });
(async function boot() {
  if (window.top !== window.self) { document.body.innerHTML = ''; return; } // refuse to run inside frames (clickjacking)
  const msg = t => { const m = $('#bootMsg'); if (m) m.textContent = t; };
  if (!window.isSecureContext || !crypto.subtle) { msg(CONFIG.APP_NAME + ' must be opened over HTTPS (or localhost) — encryption APIs are unavailable.'); return; }
  Libs.fonts(); Libs.load(); // start downloads now; sign-in does not wait for them
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  showLogin();
})();
