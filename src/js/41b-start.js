/* ================================ UPLOAD HOME ================================
   Two ways in:
   A · NCRP Trail  — only the NCRP / I4C bank-trail file. No case details: the acknowledgement number is read from
                     the file, the petitioner name is optional. Gives the same NCRP Graph and 94 BNSS letters.
   B · Case Upload — the full case (bank statements, CDR, KYC, bank login IP …), exactly as before.            */
function hubRecent(n = 6) { return S.index.filter(x => !x.demo).slice().sort((a, b) => String(b.updated).localeCompare(String(a.updated))).slice(0, n); }
function newQuickId() {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  let id = `NCRP-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  while (S.index.some(x => x.id === id)) id += 'x';
  return id;
}
/* Keeps the acknowledgement number(s) and the complainant account roles in step with what was read from the file. */
function hubSync() {
  const c = S.cur; if (!isQuick(c) || !c.work.ncrp.length) return;
  const acks = uniq(c.work.ncrp.map(r => r.ackNo).filter(Boolean)).join(', ');
  if ((c.meta.ack || '') !== acks) { c.meta.ack = acks; markDirty('meta'); const i = S.index.findIndex(x => x.id === c.meta.id); if (i >= 0) S.index[i] = caseSummary(c); renderShell(); }
}
async function hubRun(files) {
  files = (files || []).filter(Boolean); if (!files.length) return;
  const petEl = $('#hubPet'); const pet = petEl ? petEl.value.trim() : '';
  if (!isQuick(S.cur)) {
    await createCase({ id: newQuickId(), mode: 'ncrp', petitioner: pet, ack: '' });
    renderShell(); upReset(); go('start'); // the NCRP card is now in "reading the file" state
  }
  upReset();
  const redraw = () => { const h = $('#hubQ'); if (h) { h.innerHTML = qStatus('ncrp'); bindReview(h, () => go('start')); } };
  await quickImport('ncrp', files, 'ncrp', {}, redraw);
  const c = S.cur; if (!c) return;
  for (const no of ncrpComplainants()) { const a = ensureAcct(no, {}); if (a) { a.role = 'Complainant'; if (a.layerNcrp == null) a.layerNcrp = 0; } }
  upAfterImport('ncrp'); hubSync();
  const acks = uniq(c.work.ncrp.map(r => r.ackNo).filter(Boolean));
  audit('NCRP trail loaded', acks.join(', ') || 'no acknowledgement number found in the file');
  if (S.view === 'start') go('start');
}
async function hubOpen(id) { await openCase(id); renderShell(); go(isQuick(S.cur) ? 'ncrp' : 'dashboard'); }

/* ---- Upload ▸ NCRP Trail ---- */
VIEWS.start = el => {
  upReset(); const c = S.cur; const quick = isQuick(c); const has = quick && c.work.ncrp.length > 0;
  if (has) hubSync();
  const acks = has ? uniq(c.work.ncrp.map(r => r.ackNo).filter(Boolean)) : [];
  let kp = '';
  if (has) {
    const m = ncrpModel(Object.assign({}, NCRPF, { cash: 1, ack: '' })); const byL = ncrpLayers(m); const l1 = byL.get(1) || [];
    const hold = round2(sum(Array.from(m.N.values()).filter(n => !n.exit), n => n.hold || 0));
    const banks = uniq(Array.from(m.N.values()).filter(n => !n.exit && !n.unknown && n.layer > 0).map(n => n.bank).filter(Boolean));
    kp = `<div class="grid g4 hub-kpis">${kpi('Amount lost', inrShort(m.fraud), `${nfmt(m.disputedN)} disputed transaction(s)`, 'rgba(255,77,94,.35)')}${kpi('Layer 1 accounts', nfmt(l1.length), `${byL.size} layer(s) · ${banks.length} bank(s)`, 'rgba(255,179,0,.35)')}${kpi('Amount on hold', inrShort(hold), m.fraud ? Math.round(hold / m.fraud * 100) + '% of amount lost' : '', 'rgba(0,255,157,.3)')}${kpi('Acknowledgement No.', acks.length ? String(acks.length) : '—', acks.length ? acks.join(', ') : 'not found in the file', 'rgba(0,229,255,.3)')}</div>`;
  }
  const petField = `<label class="f">Petitioner name <span class="dim">(optional)</span><input id="hubPet" placeholder="Name of the complainant / petitioner" value="${esc(quick ? c.meta.petitioner || '' : '')}"></label>`;
  const body = has ? `
      <div class="hub-ack">Acknowledgement No.: <b class="mono">${esc(acks.join(', ') || 'not found in the file')}</b></div>
      ${petField}
      ${kp}
      <div class="row hub-go"><button class="btn-p hub-big" id="hubGraph">⌬ Open NCRP Graph</button><button class="btn-p hub-big" id="hubLet">✉ Make 94 BNSS letters</button></div>
      <div class="row hub-more"><button id="hubMore">⇪ Add another NCRP file</button><button id="hubNew">＋ New NCRP trail</button><button id="hubFull" class="btn-g">Convert to a full case…</button></div>
      <div id="hubQ"></div>` : `
      <ul class="hub-ul"><li>The <b>acknowledgement number is read from the file</b></li><li>Opens the layer-wise <b>NCRP graph</b> and the <b>94 BNSS letters</b></li><li>Nothing else to fill in — add the petitioner name if you want it in the letters</li></ul>
      ${petField}
      <div class="drop up-drop" id="hubDrop"><div class="ic">⇪</div><b>Drop the NCRP Excel here or click to choose</b><div class="small muted">Transaction details from the NCRP / I4C portal · Excel / CSV / HTML · one or more files</div></div>
      <div id="hubQ" style="margin-top:12px"></div>`;
  el.innerHTML = pageHead('NCRP Trail', 'Upload only the NCRP / I4C report. No case details are needed — you get the money-trail graph and the bank notices.') +
    `<section class="card hub-card hub-one ${has ? 'done' : ''}" style="--pc:#00ff9d">${body}</section>`;
  const run = fs => hubRun(fs);
  const drop = $('#hubDrop', el);
  if (drop) { drop.onclick = () => pickFiles(true, run); drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); }; drop.ondragleave = () => drop.classList.remove('over'); drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); run(Array.from(e.dataTransfer.files)); }; }
  const q = $('#hubQ', el); if (q) { q.innerHTML = qStatus('ncrp'); bindReview(q, () => go('start')); }
  const pet = $('#hubPet', el); if (pet && quick) pet.onchange = () => { c.meta.petitioner = pet.value.trim(); markDirty('meta'); const i = S.index.findIndex(x => x.id === c.meta.id); if (i >= 0) S.index[i] = caseSummary(c); renderShell(); toast('Petitioner name saved', 'ok', 1500); };
  const on = (id, fn) => { const b = $('#' + id, el); if (b) b.onclick = fn; };
  on('hubGraph', () => go('ncrp')); on('hubLet', () => { LET.src = 'ncrp'; go('letters'); }); on('hubMore', () => pickFiles(true, run));
  on('hubNew', async () => { await saveNow(); S.cur = null; S.derived = null; renderShell(); go('start'); });
  on('hubFull', async () => { if (!await confirmBox('Convert to a full case', 'The NCRP trail stays as it is. You will then be able to enter the case details and upload bank statements, CDR, KYC and IP logs in this same case.', 'Convert')) return; c.meta.mode = ''; markDirty('meta'); const i = S.index.findIndex(x => x.id === c.meta.id); if (i >= 0) S.index[i] = caseSummary(c); await audit('Converted NCRP trail to full case'); renderShell(); caseForm(true); });
};

/* ---- Upload ▸ Case Upload ---- */
VIEWS.caseup = el => {
  upReset(); const c = S.cur; const full = c && !isQuick(c);
  const rec = hubRecent();
  el.innerHTML = pageHead('Case Upload', 'The full investigation: bank statements, CDR, KYC and bank login IP logs, with money-trail verification, location correlation, leads and reports.') +
    `<section class="card hub-card hub-one" style="--pc:#00e5ff">
      <ul class="hub-ul"><li>Statements of the complainant, accused and suspect accounts</li><li>NCRP report · CDR · IPDR · KYC replies · bank login IP logs</li></ul>
      <div class="row hub-go"><button class="btn-p hub-big" id="hubCase">＋ New case</button>${full ? `<button class="hub-big" id="hubCont">▶ Continue: ${esc(caseTitle(c.meta).slice(0, 30))}</button>` : ''}<button class="hub-big" id="hubCases">🗂 Open an existing case</button></div>
    </section>` +
    (rec.length ? `<div class="card hub-recent hub-one"><h3 style="margin:0">Recent</h3><div class="hub-rl">${rec.map(r => `<button class="hub-r" data-open="${esc(r.id)}"><span class="hub-rt">${esc(caseTitle(r))}</span><span class="small dim">${r.mode === 'ncrp' ? 'NCRP trail' : esc(r.type || 'Case')} · ${esc(String(r.updated || '').slice(0, 16))}</span></button>`).join('')}</div></div>` : '');
  const on = (id, fn) => { const b = $('#' + id, el); if (b) b.onclick = fn; };
  on('hubCase', () => caseForm()); on('hubCont', () => go('upload')); on('hubCases', () => go('cases'));
  $$('[data-open]', el).forEach(b => b.onclick = () => hubOpen(b.dataset.open));
};
