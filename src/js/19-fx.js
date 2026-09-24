/* ------------------------------ icons, logo, cyber background ------------------------------ */
const ICONS = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  folder: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/><path d="M3 10h18"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v4h16v-4"/>',
  shield: '<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  bank: '<path d="M3 10l9-6 9 6"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8"/><path d="M3 21h18M3 18h18"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-3.5 3.2-5.5 6.5-5.5s6 2 6.5 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M16 14.6c2.8.2 4.9 2 5.4 5"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1.2"/><circle cx="4" cy="12" r="1.2"/><circle cx="4" cy="18" r="1.2"/>',
  flow: '<circle cx="5" cy="12" r="2.5"/><circle cx="19" cy="5" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="M7.3 11l9.2-5M7.3 13l9.2 5"/><path d="M14 4.5l2.6 1-1 2.6M14 19.5l2.6-1-1-2.6"/>',
  nodes: '<circle cx="12" cy="12" r="2.6"/><circle cx="4.5" cy="5" r="2"/><circle cx="19.5" cy="5" r="2"/><circle cx="4.5" cy="19" r="2"/><circle cx="19.5" cy="19" r="2"/><path d="M6 6.4l4.2 4M18 6.4l-4.2 4M6 17.6l4.2-4M18 17.6l-4.2-4"/>',
  phone: '<rect x="6.5" y="2" width="11" height="20" rx="2.5"/><path d="M10.5 5h3"/><circle cx="12" cy="18" r="1"/><path d="M1.5 9a6 6 0 0 1 0 6M22.5 9a6 6 0 0 1 0 6"/>',
  globe: '<circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19M12 2.5c3 3 3 16 0 19M12 2.5c-3 3-3 16 0 19"/>',
  clock: '<circle cx="12" cy="12" r="9.5"/><path d="M12 6.5V12l3.8 2.4"/>',
  chart: '<path d="M3 21h18"/><rect x="5" y="11" width="3" height="7"/><rect x="10.5" y="6" width="3" height="12"/><rect x="16" y="9" width="3" height="9"/><path d="M4 7l5-3 5 3 6-4"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/>',
  check: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M8 12.5l3 3 5.5-6.5"/>',
  doc: '<path d="M6 2h8l5 5v15H6z"/><path d="M14 2v5h5"/><path d="M9 12h7M9 15.5h7M9 19h4"/>',
  cloud: '<path d="M7 18h10a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.1 9.2 4.5 4.5 0 0 0 7 18z"/><path d="M12 11v5M9.5 13.5L12 11l2.5 2.5"/>',
  ushield: '<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/><circle cx="12" cy="10" r="2.6"/><path d="M7.8 16.5c.8-2 2.3-3 4.2-3s3.4 1 4.2 3"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15.5" r="1.6"/>',
  power: '<path d="M12 3v9"/><path d="M6.3 6.8a8 8 0 1 0 11.4 0"/>'
};
function icon(name) { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`; }
/* SIXTH SENSE mark: shield + eye (the sixth sense) + network nodes */
const LOGO_SVG = `<defs><linearGradient id="ssg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#00e5ff"/><stop offset="1" stop-color="#2979ff"/></linearGradient></defs>
<path d="M32 3l24 9v17c0 15-10.5 26-24 32C18.5 55 8 44 8 29V12z" fill="rgba(0,229,255,.08)" stroke="url(#ssg1)" stroke-width="2.4"/>
<path d="M15 29c4.5-7 10.2-10.5 17-10.5S44.5 22 49 29c-4.5 7-10.2 10.5-17 10.5S19.5 36 15 29z" fill="none" stroke="#00e5ff" stroke-width="2" opacity=".9"/>
<circle cx="32" cy="29" r="6.5" fill="none" stroke="#00ff9d" stroke-width="2.2"/><circle cx="32" cy="29" r="2.5" fill="#00ff9d"/>
<path d="M32 9v6M32 43v8M22 47l4-5M42 47l-4-5" stroke="#00e5ff" stroke-width="1.5" stroke-linecap="round" opacity=".7"/>
<circle cx="32" cy="9" r="2" fill="#00e5ff"/><circle cx="32" cy="51" r="2" fill="#00e5ff"/><circle cx="21" cy="48" r="1.8" fill="#ff2e88"/><circle cx="43" cy="48" r="1.8" fill="#ff2e88"/>`;
function paintLogos(root = document) { $$('svg.logoSvg', root).forEach(s => s.innerHTML = LOGO_SVG); }

const NetFx = {
  c: null, x: null, nodes: [], pk: [], w: 0, h: 0, intensity: 1, mouse: null, reduced: false, started: false,
  init() {
    if (this.started) return; this.started = true;
    this.c = $('#netfx'); if (!this.c) return; this.x = this.c.getContext('2d');
    this.reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resize(); addEventListener('resize', () => this.resize());
    addEventListener('mousemove', e => { this.mouse = { x: e.clientX, y: e.clientY }; }, { passive: true });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) requestAnimationFrame(() => this.frame()); });
    requestAnimationFrame(() => this.frame());
  },
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = innerWidth; this.h = innerHeight; this.c.width = this.w * dpr; this.c.height = this.h * dpr;
    this.x.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.max(28, Math.min(110, Math.round(this.w * this.h / 14000)));
    this.nodes = Array.from({ length: n }, () => ({ x: Math.random() * this.w, y: Math.random() * this.h, vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35, r: Math.random() * 1.6 + 1, hub: Math.random() < .09, ph: Math.random() * 6.28 }));
    this.pk = []; if (this.reduced) this.frame();
  },
  frame() {
    if (document.hidden || !this.x) return;
    const x = this.x, N = this.nodes, D = 145, I = this.intensity, edges = [];
    x.clearRect(0, 0, this.w, this.h);
    for (const n of N) if (!this.reduced) { n.x += n.vx; n.y += n.vy; if (n.x < 0 || n.x > this.w) n.vx *= -1; if (n.y < 0 || n.y > this.h) n.vy *= -1; n.ph += .03; }
    x.lineWidth = 1;
    for (let i = 0; i < N.length; i++) for (let j = i + 1; j < N.length; j++) {
      const a = N[i], b = N[j], dx = a.x - b.x, dy = a.y - b.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d < D) { x.strokeStyle = `rgba(0,229,255,${((1 - d / D) * .32 * I).toFixed(3)})`; x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke(); edges.push([a, b]); }
    }
    if (this.mouse) for (const n of N) { const dx = n.x - this.mouse.x, dy = n.y - this.mouse.y, d = Math.sqrt(dx * dx + dy * dy); if (d < 190) { x.strokeStyle = `rgba(0,255,157,${((1 - d / 190) * .45 * I).toFixed(3)})`; x.beginPath(); x.moveTo(n.x, n.y); x.lineTo(this.mouse.x, this.mouse.y); x.stroke(); } }
    if (!this.reduced && edges.length && this.pk.length < 26 && Math.random() < .22) { const e = edges[Math.floor(Math.random() * edges.length)]; this.pk.push({ a: e[0], b: e[1], t: 0, s: .008 + Math.random() * .016, c: ['0,229,255', '0,255,157', '255,46,136', '41,121,255'][Math.floor(Math.random() * 4)] }); }
    this.pk = this.pk.filter(p => p.t <= 1);
    for (const p of this.pk) { p.t += p.s; const px = p.a.x + (p.b.x - p.a.x) * p.t, py = p.a.y + (p.b.y - p.a.y) * p.t; const g = x.createRadialGradient(px, py, 0, px, py, 7); g.addColorStop(0, `rgba(${p.c},${.95 * I})`); g.addColorStop(1, `rgba(${p.c},0)`); x.fillStyle = g; x.beginPath(); x.arc(px, py, 7, 0, 6.283); x.fill(); }
    for (const n of N) { x.fillStyle = n.hub ? `rgba(0,255,157,${.9 * I})` : `rgba(120,220,255,${.75 * I})`; x.beginPath(); x.arc(n.x, n.y, n.hub ? n.r + 1.4 : n.r, 0, 6.283); x.fill(); if (n.hub) { const r = 6 + (Math.sin(n.ph) + 1) * 6; x.strokeStyle = `rgba(0,255,157,${Math.max(0, (.35 - r / 60)) * I})`; x.beginPath(); x.arc(n.x, n.y, r, 0, 6.283); x.stroke(); } }
    if (!this.reduced) requestAnimationFrame(() => this.frame());
  }
};
