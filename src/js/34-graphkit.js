/* ------------------------------ GraphKit: shared graph canvas + toolbar ------------------------------
   Used by the Network Graph and the NCRP Graph. Layouts: Tree ↓, Tree →, Network (force), Radial.
   Node style: cards (boxes with layer badge) or dots. Search, focus-on-path, zoom, fit, fullscreen, PNG. */
const GK_STATE = {};
const GraphKit = {
  mount(host, opt) {
    const st = GK_STATE[opt.key] = Object.assign({ layout: opt.defaultLayout || 'tree', style: 'auto', labels: true }, GK_STATE[opt.key] || {});
    const lay = [['tree', 'flow', 'Tree ↓'], ['lr', 'list', 'Tree →'], ['net', 'nodes', 'Network'], ['radial', 'globe', 'Radial']];
    host.innerHTML = `<div class="gk" id="gkWrap">
      <div class="gk-bar">
        <div class="seg">${lay.map(([k, ic, t]) => `<button class="btn-sm ${st.layout === k ? 'on' : ''}" data-lay="${k}" title="${t} layout">${icon(ic)}<span>${t}</span></button>`).join('')}</div>
        <div class="seg"><button class="btn-sm ${st.style === 'cards' || (st.style === 'auto' && ['tree', 'lr'].includes(st.layout)) ? 'on' : ''}" data-sty="cards" title="Show nodes as cards">▭ Cards</button><button class="btn-sm ${st.style === 'dots' || (st.style === 'auto' && !['tree', 'lr'].includes(st.layout)) ? 'on' : ''}" data-sty="dots" title="Show nodes as dots">● Dots</button><button class="btn-sm ${st.labels ? 'on' : ''}" data-lbl="1" title="Amounts on arrows">₹ Amounts</button></div>
        <div class="gk-search"><input id="gkQ" placeholder="Find account / UPI / mobile…" autocomplete="off"><button class="btn-sm" id="gkGo">⌕</button></div>
        <div class="seg"><button class="btn-sm" id="gkFocus" title="Show only the money path through the selected node">◎ Focus path</button><button class="btn-sm" id="gkAll" title="Show everything">Show all</button></div>
        <div class="seg"><button class="btn-sm" id="gkIn" title="Zoom in">＋</button><button class="btn-sm" id="gkOut" title="Zoom out">－</button><button class="btn-sm" id="gkFit" title="Fit to screen">⤢ Fit</button><button class="btn-sm" id="gkFull" title="Full screen">⛶</button><button class="btn-sm" id="gkPng" title="Save as picture">⇩ PNG</button></div>
        <div class="gk-stats">${(opt.stats || []).map(s => `<span class="chip ${s.cls || 'on'}">${esc(s.label)}: <b>${s.value}</b></span>`).join('')}</div>
      </div>
      ${opt.legend ? `<div class="legend gk-legend">${opt.legend}</div>` : ''}
      <div class="gk-cv" id="gkCv"></div><div class="gk-tip" id="gkTip" hidden></div>
      <div class="gk-hint small dim">Click a node for details · drag to move · scroll to zoom · select a node then “Focus path” to see only its money chain</div>
    </div>`;
    if (typeof cytoscape === 'undefined') { $('#gkCv', host).innerHTML = emptyState('Graph library not loaded.'); return null; }
    if (!opt.nodes.length) { $('#gkCv', host).innerHTML = emptyState(opt.empty || 'Nothing to draw yet.'); return null; }
    const ids = new Set(opt.nodes.map(n => n.id));
    const els = opt.nodes.map(n => ({ data: Object.assign({ size: 26, color: '#2f9bff', sub: '', badge: '' }, n, { card: [n.badge ? '[' + n.badge + ']  ' + n.label : n.label, n.sub || ''].filter(Boolean).join('\n') }) }))
      .concat(opt.edges.filter(e => ids.has(e.source) && ids.has(e.target) && e.source !== e.target).map((e, i) => ({ data: Object.assign({ id: 'e' + i, color: '#00e5ff', w: 1.6, label: '' }, e) })));
    const cardsOn = () => st.style === 'cards' || (st.style === 'auto' && ['tree', 'lr'].includes(st.layout));
    const cy = cytoscape({ container: $('#gkCv', host), elements: els, minZoom: 0.05, maxZoom: 3,
      style: [
        { selector: 'node', style: { 'background-color': 'data(color)', label: 'data(label)', color: '#dff6ff', 'font-size': 10, 'font-weight': 600, 'text-valign': 'center', 'text-halign': 'right', 'text-margin-x': 6, width: 'data(size)', height: 'data(size)', 'border-width': 2, 'border-color': '#070d1a', 'text-outline-color': '#070d1a', 'text-outline-width': 2 } },
        { selector: 'node.card', style: { shape: 'round-rectangle', width: 196, height: 54, 'background-color': '#0f1b31', 'border-color': 'data(color)', 'border-width': 2, label: 'data(card)', 'text-wrap': 'wrap', 'text-max-width': 186, 'text-halign': 'center', 'text-margin-x': 0, 'font-size': 10.5, 'line-height': 1.35, 'text-outline-width': 0, color: '#e6f4ff' } },
        { selector: 'node[shape]', style: { shape: 'data(shape)' } },
        { selector: 'node.card[shape]', style: { shape: 'round-rectangle' } },
        { selector: 'edge', style: { width: 'data(w)', 'line-color': 'data(color)', 'target-arrow-color': 'data(color)', 'target-arrow-shape': 'triangle', 'arrow-scale': 0.9, 'curve-style': 'bezier', opacity: .85 } },
        { selector: 'edge[dash]', style: { 'line-style': 'dashed', 'target-arrow-shape': 'none' } },
        { selector: 'edge.lbl[label]', style: { label: 'data(label)', 'font-size': 9, color: '#070d1a', 'text-rotation': 'autorotate', 'text-background-color': '#dff6ff', 'text-background-opacity': 1, 'text-background-padding': 2, 'text-background-shape': 'round-rectangle', 'text-border-color': 'data(color)', 'text-border-width': 1, 'text-border-opacity': 1 } },
        { selector: '.dim', style: { opacity: 0.07 } },
        { selector: '.hit', style: { 'border-color': '#ff2e88', 'border-width': 5 } },
        { selector: 'node:selected', style: { 'border-color': '#ffffff', 'border-width': 4 } }] });
    const applyStyle = () => { cy.nodes().toggleClass('card', cardsOn()); cy.edges().toggleClass('lbl', !!st.labels); };
    const runLayout = () => {
      applyStyle(); const card = cardsOn();
      if (st.layout === 'net') cy.layout({ name: 'cose', animate: false, nodeRepulsion: () => card ? 60000 : 14000, idealEdgeLength: () => card ? 220 : 110, nodeOverlap: 20, componentSpacing: 90, padding: 30, randomize: true }).run();
      else if (st.layout === 'radial') { const dep = GraphKit.depths(cy, opt.roots); const mx = Math.max(0, ...dep.values()); cy.layout({ name: 'concentric', concentric: n => mx - (dep.get(n.id()) ?? mx), levelWidth: () => 1, minNodeSpacing: card ? 60 : 24, padding: 30, animate: false }).run(); }
      else cy.layout({ name: 'preset', positions: GraphKit.treePositions(cy, opt.roots, st.layout === 'lr', card), fit: true, padding: 30 }).run();
      cy.fit(undefined, 30);
    };
    runLayout();
    const tip = $('#gkTip', host);
    cy.on('mouseover', 'node', e => { const d = e.target.data(); if (!d.tip) return; tip.innerHTML = d.tip; tip.hidden = false; const p = e.renderedPosition; tip.style.left = (p.x + 16) + 'px'; tip.style.top = (p.y + 10) + 'px'; });
    cy.on('mouseout', 'node', () => { tip.hidden = true; });
    cy.on('tap', 'node', e => { tip.hidden = true; opt.onTap && opt.onTap(e.target.id(), e.target.data()); });
    $$('[data-lay]', host).forEach(b => b.onclick = () => { st.layout = b.dataset.lay; st.style = 'auto'; $$('[data-lay]', host).forEach(x => x.classList.toggle('on', x === b)); syncSty(); runLayout(); });
    const syncSty = () => { $$('[data-sty]', host).forEach(x => x.classList.toggle('on', (x.dataset.sty === 'cards') === cardsOn())); };
    $$('[data-sty]', host).forEach(b => b.onclick = () => { st.style = b.dataset.sty; syncSty(); runLayout(); });
    $('[data-lbl]', host).onclick = e => { st.labels = !st.labels; e.currentTarget.classList.toggle('on', st.labels); applyStyle(); };
    const find = () => {
      const q = $('#gkQ', host).value.trim().toUpperCase().replace(/\s/g, ''); cy.nodes().removeClass('hit'); if (!q) return;
      const hits = cy.nodes().filter(n => (n.id() + ' ' + (n.data('label') || '') + ' ' + (n.data('sub') || '') + ' ' + (n.data('search') || '')).toUpperCase().replace(/\s/g, '').includes(q));
      if (!hits.length) return toast('Not found in this graph: ' + q, 'warn');
      hits.addClass('hit'); cy.animate({ fit: { eles: hits, padding: 120 } }, { duration: 400 }); if (hits.length === 1) hits.select();
      toast(hits.length + ' match(es)', 'ok', 1800);
    };
    $('#gkGo', host).onclick = find; $('#gkQ', host).onkeydown = e => { if (e.key === 'Enter') find(); };
    $('#gkFocus', host).onclick = () => { const s = cy.$('node:selected'); if (!s.length) return toast('Click a node first, then Focus path.', 'warn'); const keep = s.union(s.predecessors()).union(s.successors()); cy.elements().addClass('dim'); keep.removeClass('dim'); cy.animate({ fit: { eles: keep, padding: 60 } }, { duration: 400 }); };
    $('#gkAll', host).onclick = () => { cy.elements().removeClass('dim hit'); cy.fit(undefined, 30); };
    $('#gkIn', host).onclick = () => cy.zoom({ level: cy.zoom() * 1.25, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
    $('#gkOut', host).onclick = () => cy.zoom({ level: cy.zoom() / 1.25, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
    $('#gkFit', host).onclick = () => cy.fit(undefined, 30);
    $('#gkFull', host).onclick = () => { const w = $('#gkWrap', host); if (document.fullscreenElement) document.exitFullscreen(); else if (w.requestFullscreen) w.requestFullscreen(); };
    const onFs = () => setTimeout(() => { if (!host.isConnected) return document.removeEventListener('fullscreenchange', onFs); cy.resize(); cy.fit(undefined, 30); }, 120);
    document.addEventListener('fullscreenchange', onFs);
    $('#gkPng', host).onclick = () => { const uri = cy.png({ full: true, scale: 2, bg: '#070d1a', maxWidth: 12000, maxHeight: 12000 }); fetch(uri).then(r => r.blob()).then(b => downloadBlob(b, `${CONFIG.FILE_PREFIX}_${fileSafe(S.cur ? S.cur.meta.id : 'graph')}_${opt.file || 'graph'}.png`)); };
    return cy;
  },
  depths(cy, roots) {
    const dep = new Map(); let q = (roots || []).filter(id => cy.getElementById(id).length);
    if (!q.length) q = cy.nodes().filter(n => n.indegree(false) === 0).map(n => n.id());
    if (!q.length && cy.nodes().length) q = [cy.nodes()[0].id()];
    q.forEach(id => dep.set(id, 0));
    while (q.length) { const nx = []; for (const id of q) { const d = dep.get(id); cy.getElementById(id).outgoers('node').forEach(n => { if (!dep.has(n.id())) { dep.set(n.id(), d + 1); nx.push(n.id()); } }); } q = nx; }
    // nodes not reachable from a root: place them by their own layer (or after the deepest level)
    const mx = Math.max(0, ...dep.values());
    cy.nodes().forEach(n => { if (!dep.has(n.id())) { const l = n.data('layer'); dep.set(n.id(), Number.isFinite(l) && l < 50 ? l : mx + 1); } });
    return dep;
  },
  treePositions(cy, roots, lr, card) {
    const dep = this.depths(cy, roots); const levels = new Map();
    for (const [id, d] of dep) { if (!levels.has(d)) levels.set(d, []); levels.get(d).push(id); }
    const order = new Map(); const ds = Array.from(levels.keys()).sort((a, b) => a - b);
    for (const d of ds) {
      const arr = levels.get(d);
      const key = id => { const ps = cy.getElementById(id).incomers('node').map(n => order.get(n.id())).filter(v => v != null); return ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : 1e9; };
      arr.sort((a, b) => key(a) - key(b) || String(a).localeCompare(String(b))); arr.forEach((id, i) => order.set(id, i));
    }
    const gapA = card ? (lr ? 70 : 225) : (lr ? 34 : 70), gapB = card ? (lr ? 300 : 150) : (lr ? 220 : 120), gapSub = card ? (lr ? 230 : 78) : (lr ? 120 : 46);
    const total = cy.nodes().length; const maxPer = Math.max(8, Math.ceil(Math.sqrt(total) * (lr ? 1.0 : 1.2)));
    const pos = {}; let band = 0;
    for (const d of ds) {
      const arr = levels.get(d); const per = Math.min(arr.length, maxPer); const rows = Math.ceil(arr.length / maxPer); const w = (per - 1) * gapA;
      arr.forEach((id, i) => { const sub = Math.floor(i / maxPer), j = i % maxPer; const stagger = rows > 1 && sub % 2 ? gapA / 2 : 0; const a = j * gapA - w / 2 + stagger, b = band + sub * gapSub; pos[id] = lr ? { x: b, y: a } : { x: a, y: b }; });
      band += (rows - 1) * gapSub + gapB;
    }
    return pos;
  }
};
