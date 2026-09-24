/* ------------------------------ background library loader ------------------------------
   The sign-in screen appears immediately; the analysis libraries (Excel, PDF, graph, charts,
   PDF reports, map ≈ 2.5 MB) download in parallel while the officer signs in and unlocks.
   Every file is still checked with Subresource Integrity (sha384) before it runs.            */
const LIB_GLOBAL = { xlsx: 'XLSX', pdfjs: 'pdfjsLib', cytoscape: 'cytoscape', chart: 'Chart', jspdf: 'jspdf', leaflet: 'L' };
const Libs = {
  done: false, p: null, failed: [],
  one(s) {
    return new Promise(res => {
      const g = LIB_GLOBAL[s.g]; if (g && typeof window[g] !== 'undefined') return res();
      const el = document.createElement('script'); el.src = s.src; el.integrity = s.sri; el.crossOrigin = 'anonymous'; el.referrerPolicy = 'no-referrer'; el.async = true;
      el.onload = () => res(); el.onerror = () => { this.failed.push(s.g); res(); }; document.head.appendChild(el);
    });
  },
  load() {
    if (this.p) return this.p;
    this.p = (async () => {
      const list = LIBS.scripts || [];
      await Promise.all(list.filter(s => s.g !== 'autotable').map(s => this.one(s)));
      const at = list.find(s => s.g === 'autotable'); if (at && typeof window.jspdf !== 'undefined') await this.one(at);
      if (typeof pdfjsLib !== 'undefined') try { // pdf.js worker via integrity-checked fetch → blob URL
        const r = await fetch(LIBS.pdfWorker.src, { integrity: LIBS.pdfWorker.sri, mode: 'cors' });
        pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([await r.text()], { type: 'text/javascript' }));
      } catch (e) { console.warn('pdf worker fallback', e); }
      this.done = true;
      if (this.failed.length) toast('Some modules could not load (' + this.failed.join(', ') + '). Check the internet connection and reload.', 'err', 8000);
    })();
    return this.p;
  },
  fonts() {
    if (document.getElementById('gfonts')) return;
    const l = document.createElement('link'); l.id = 'gfonts'; l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700&family=Rajdhani:wght@400;500;600;700&family=Share+Tech+Mono&display=swap'; document.head.appendChild(l);
  }
};
