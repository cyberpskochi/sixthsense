/* ------------------------------ boot ------------------------------ */
window.addEventListener('error', e => { console.error(e.error || e.message); try { toast('Error: ' + (e.message || 'unexpected'), 'err'); } catch {} });
window.addEventListener('unhandledrejection', e => { console.error(e.reason); try { toast('Error: ' + ((e.reason && e.reason.message) || 'unexpected'), 'err'); } catch {} });
(async function boot() {
  if (window.top !== window.self) { document.body.innerHTML = ''; return; } // refuse to run inside frames (clickjacking)
  const msg = t => { const m = $('#bootMsg'); if (m) m.textContent = t; };
  if (!window.isSecureContext || !crypto.subtle) { msg('CFITS must be opened over HTTPS (or localhost) — encryption APIs are unavailable.'); return; }
  const missing = ['XLSX', 'pdfjsLib', 'cytoscape', 'Chart', 'jspdf'].filter(k => typeof window[k] === 'undefined');
  if (missing.length) { msg('Could not load: ' + missing.join(', ') + '. Check the internet connection (libraries load from cdn.jsdelivr.net with integrity checks).'); return; }
  try { // pdf.js worker via integrity-checked fetch → blob URL (cross-origin workers are blocked by browsers)
    const r = await fetch(LIBS.pdfWorker.src, { integrity: LIBS.pdfWorker.sri, mode: 'cors' });
    pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([await r.text()], { type: 'text/javascript' }));
  } catch (e) { console.warn('pdf worker fallback', e); }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  showLogin();
})();
