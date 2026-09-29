/* ------------------------------ REPORT A FILE PROBLEM ------------------------------
   When a statement / CDR / NCRP file does not read correctly, the officer can send the developer a
   MASKED sample: header row(s) + a few rows. Everything is masked here in the browser before anything
   leaves the device:
     · account / card / mobile / UTR numbers (5+ digit runs) → random digits of the same length, consistent
       inside one sample (the same real number always becomes the same fake number)
     · names, addresses and other words → W1, W2 … (banking words, bank names, months kept)
     · e-mail / UPI ids → user1@…, handle kept (@okaxis, @ybl …)
     · dates, times, amounts, IFSC codes and column headings are kept — they are needed to fix the reader
   The officer sees the exact masked sample, can black out any cell, and chooses to send or download. */
const SAMPLE_KEEP = new Set(('upi imps neft rtgs nach ecs ach atm pos nwd cwdr chq cheque chq cash dep deposit wdl withdrawal transfer trf tfr trn txn tran ' +
  'to by from of the and for at in on ref refno no number id payment paid pay received credit debit cr dr int interest chg chrg charges charge gst sms fee fees ' +
  'balance bal opening closing brought forward carried b/f c/f total amount amt rs inr value date narration particulars description remarks details mode ' +
  'branch ifsc micr code account acct ac a/c statement period customer cust type currency joint holder name address city state pin pincode phone mobile email ' +
  'self own reversal rev return refund failed success salary rent emi loan bill recharge wallet merchant online mob mobile net netbanking ib mb app ' +
  'jan feb mar apr may jun jul aug sep sept oct nov dec january february march april june july august september october november december ' +
  'bank ltd limited pvt private co coop cooperative gramin small finance payments india indian national state union central overseas kerala ' +
  'hdfc icici axis sbi pnb bob kotak yes idfc idbi uco canara federal south csb dhanlaxmi karur vysya esaf au airtel paytm fino jio phonepe gpay google amazon ' +
  'razorpay cashfree payu billdesk bharatpe mobikwik freecharge cred bhim nsdl ippb post baroda punjab sind bandhan indusind rbl dbs hsbc citi standard chartered ' +
  'layer action taken hold put lien freeze disputed acknowledgement complaint call sms voice data incoming outgoing in out mt mo duration imei imsi cell cgi lac tower ' +
  'roaming home first last site location a b party calling called service provider circle user').split(/\s+/));
function sampleMasker() {
  const dig = new Map(), wd = new Map(), em = new Map(); let wn = 0, en = 0;
  const rnd = n => { let s = ''; while (s.length < n) s += Math.floor(Math.random() * 10); return s; };
  const digits = d => { if (!dig.has(d)) dig.set(d, d[0] + rnd(d.length - 1)); return dig.get(d); };
  const word = w => { const k = w.toUpperCase(); if (SAMPLE_KEEP.has(w.toLowerCase())) return w; if (!wd.has(k)) wd.set(k, 'W' + (++wn)); return wd.get(k); };
  const DATE = /^(\d{1,2}[-\/. ](\d{1,2}|[A-Za-z]{3,9})[-\/. ]\d{2,4}|\d{4}-\d{2}-\d{2})([ T]\d{1,2}[:.]\d{2}([:.]\d{2})?(\s*[AP]M)?)?$/i;
  const TIME = /^\d{1,2}[:.]\d{2}([:.]\d{2})?(\s*[AP]M)?$/i;
  const AMT = /^[-+(]?\s*(Rs\.?|INR|₹)?\s*-?[\d,]*\.\d{1,2}\)?\s*(Cr|Dr)?\.?$/i;
  const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  const text = s => s
    .replace(/([A-Za-z0-9._-]+)@([A-Za-z][A-Za-z0-9.-]*)/g, (m, u, h) => { if (!em.has(u)) em.set(u, 'user' + (++en)); return em.get(u) + '@' + h; })
    .replace(/\d{5,}/g, digits)
    .replace(/[A-Za-z][A-Za-z']+/g, (w, off, all) => all[off - 1] === '@' || (/^[A-Z]{2,6}$/.test(w) && /\d/.test(all[off + w.length] || '')) ? w : word(w)); // bank / channel prefix of a UTR (e.g. SIBLR, ICICN) kept
  return {
    cell(v, keep) {
      if (v == null || v === '') return '';
      if (typeof v === 'number') return Number.isInteger(v) && Math.abs(v) >= 1e7 ? digits(String(Math.abs(v))) : v; // big integers = account / phone numbers
      const s = cellText(v).trim(); if (!s) return '';
      if (keep === 'head') return s.length > 120 ? s.slice(0, 120) : s;
      if (DATE.test(s) || TIME.test(s) || AMT.test(s) || IFSC.test(s) || /^\d{1,4}$/.test(s)) return s;
      return text(s.length > 300 ? s.slice(0, 300) : s);
    },
    stats: () => ({ numbers: dig.size, words: wd.size, emails: em.size })
  };
}
/* Build the masked sample for one queued file (works for failed files too, from the raw table / text). */
function buildSample(q) {
  const M = sampleMasker(); const grids = (q.grids && q.grids.length ? q.grids : (q.rawGrids || []).map(g => ({ g, hdr: { row: -1, map: {} } }))).slice(0, 4);
  const sheets = grids.map(G => {
    const rows = G.g.rows || []; const hr = G.hdr && G.hdr.row >= 0 ? G.hdr.row : -1; const hn = (G.hdr && G.hdr.rows) || 1;
    const pick = new Set(); const add = i => { if (i >= 0 && i < rows.length) pick.add(i); };
    if (hr >= 0) { for (let i = Math.max(0, hr - 12); i < hr + hn; i++) add(i); for (let i = hr + hn; i < hr + hn + 20; i++) add(i); for (let i = rows.length - 5; i < rows.length; i++) add(i); }
    else for (let i = 0; i < 40; i++) add(i);
    const rej = ((q.result || []).flatMap(x => (x.res && x.res.rejects) || x.rejects || [])).slice(0, 10);
    const ids = Array.from(pick).sort((a, b) => a - b); const ncol = Math.min(40, Math.max(0, ...ids.map(i => (rows[i] || []).length)));
    const out = ids.map(i => ({ r: i + 1, part: hr >= 0 && i < hr ? 'above header' : hr >= 0 && i < hr + hn ? 'HEADER' : 'data', c: Array.from({ length: ncol }, (_, j) => M.cell((rows[i] || [])[j], hr >= 0 && i >= hr && i < hr + hn ? 'head' : '')) }));
    const map = {}; if (G.hdr && G.hdr.map) for (const [f, ci] of Object.entries(G.hdr.map)) map[f] = colName(ci) + (hr >= 0 ? ' · ' + cellText((rows[hr] || [])[ci]).slice(0, 60) : '');
    return { sheet: M.cell(G.g.sheet || '', 'head'), totalRows: rows.length, headerRow: hr >= 0 ? hr + 1 : null, headerRows: hn, detectedBank: G.bank ? bankByCode(G.bank).name : '', template: (G.hdr && G.hdr.template) || '', mapping: map, rows: out,
      rawLines: (G.g.rawLines || []).slice(0, 60).map(l => M.cell(l)), rejects: rej.map(x => ({ reason: String(x.reason || x.why || '').slice(0, 160) })) };
  });
  const ext = (String(q.file.name).match(/\.[a-z0-9]{2,5}$/i) || [''])[0].toLowerCase();
  const bank = (grids.find(G => G.bank && G.bank !== 'GENERIC') || {}).bank;
  return { masked: true, v: 1, app: CONFIG.APP_NAME + ' ' + CONFIG.VERSION, parser: CONFIG.PARSER_VERSION, created: new Date().toISOString(), kind: q.kind, kindLabel: FIELDS[q.kind] ? FIELDS[q.kind].label : q.kind,
    fileType: (q.type || '') + (ext ? ' (' + ext + ')' : ''), sizeKB: Math.round((q.file.size || 0) / 1024), bank: bank ? bankByCode(bank).name : '', status: q.status,
    problems: [q.err, q.warn, ...(q.reasons || [])].filter(Boolean).map(x => M.cell(x)), note: '', sheets, masking: M.stats() };
}
function sampleModal(q) {
  if (!q) return; let smp;
  try { smp = buildSample(q); } catch (e) { console.error(e); return toast('Could not prepare the sample: ' + e.message, 'err'); }
  const tbl = sh => `<div class="small dim" style="margin:8px 0 4px">${esc(sh.sheet || 'Sheet')} · ${nfmt(sh.totalRows)} rows · header row ${sh.headerRow || 'not found'}${sh.detectedBank ? ' · ' + esc(sh.detectedBank) : ''}</div>
    <div class="tbl-wrap" style="max-height:340px"><table class="tbl smp-t"><tbody>${sh.rows.map((r, ri) => `<tr class="${r.part === 'HEADER' ? 'smp-h' : ''}"><td class="dim small">${r.r}</td>${r.c.map((v, ci) => `<td data-r="${ri}" data-c="${ci}" title="Click to black out this cell">${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    ${sh.rawLines.length ? `<details style="margin-top:6px"><summary class="small">Raw text lines (masked, for fixed-width .rpt / .txt reports)</summary><pre class="smp-pre">${esc(sh.rawLines.join('\n'))}</pre></details>` : ''}`;
  const body = `<div class="notice" style="margin-bottom:10px">🔒 This is exactly what will be shared. Account / phone / UTR numbers and names are already replaced with fake values; dates, amounts, IFSC codes and column headings are kept so the reader can be fixed. <b>Click any cell to black it out</b> if something personal is still visible.</div>
    <div class="small">${esc(smp.kindLabel)} · ${esc(smp.fileType)} · ${smp.sizeKB} KB${smp.bank ? ' · ' + esc(smp.bank) : ''} · replaced ${smp.masking.numbers} number(s), ${smp.masking.words} word(s), ${smp.masking.emails} e-mail/UPI id(s)</div>
    ${smp.problems.length ? `<div class="small" style="margin-top:4px;color:var(--amber)">Problem seen: ${esc(smp.problems.join(' · '))}</div>` : ''}
    <div id="smpSheets">${smp.sheets.map((sh, i) => `<div data-s="${i}">${tbl(sh)}</div>`).join('') || emptyState('No table rows could be read from this file — the sample will contain only the file type and the error.')}</div>
    <label class="f" style="margin-top:10px">What went wrong? (optional — do not type names or numbers)<textarea id="smpNote" rows="2" maxlength="500" placeholder="e.g. Debit and credit columns swapped; dates read wrongly; PDF second page missing"></textarea></label>
    <label class="row small" style="margin-top:8px"><input type="checkbox" id="smpOk"> I have checked the sample and no real account number, name, phone number or address is visible.</label>`;
  const md = modal({ title: '⚑ Report a file problem — masked sample', body, foot: `<button data-c>Cancel</button><button id="smpDl">⇩ Download masked sample</button><button class="btn-p" id="smpSend" ${Backend.on() ? '' : 'disabled title="Access server not connected — use Download"'}>➤ Send to developer</button>` });
  $$('.smp-t td[data-r]', md.el).forEach(td => td.onclick = () => { const sh = smp.sheets[+td.closest('[data-s]').dataset.s]; const row = sh.rows[+td.dataset.r]; const on = td.classList.toggle('smp-x'); row.c[+td.dataset.c] = on ? '█████' : row.c[+td.dataset.c]; if (on) td.textContent = '█████'; });
  const ready = () => { if (!$('#smpOk', md.el).checked) { toast('Please check the sample and tick the confirmation first.', 'warn'); return null; } smp.note = sampleMasker().cell($('#smpNote', md.el).value.trim()); return JSON.stringify(smp); };
  $('[data-c]', md.el).onclick = () => md.close();
  $('#smpDl', md.el).onclick = () => { const j = ready(); if (!j) return; downloadBlob(new Blob([j], { type: 'application/json' }), `${CONFIG.FILE_PREFIX}_masked_sample_${q.kind}_${Date.now()}.json`); audit('Downloaded masked file sample', q.kind); };
  $('#smpSend', md.el).onclick = async e => { const j = ready(); if (!j) return; e.target.disabled = true;
    try { const r = await Backend.call('reportSample', { sample: j }); toast('Sent to the developer — reference ' + r.id, 'ok', 6000); audit('Sent masked file sample', q.kind + ' ' + r.id); md.close(); }
    catch (err) { e.target.disabled = false; toast(err.message + ' — you can use Download instead.', 'err', 7000); } };
}
/* Admin: list and open the samples officers have sent. */
async function drawSamplesAdmin(host) {
  if (!host) return; host.innerHTML = '<div class="muted small">Loading file samples…</div>';
  let list = []; try { list = (await Backend.call('listSamples')).samples || []; } catch (e) { host.innerHTML = `<div class="small dim">File samples: ${esc(e.message)}. Update the access server with the latest backend/Code.gs to enable this.</div>`; return; }
  host.innerHTML = simpleTable([{ label: 'Received', get: s => fmtDT(Date.parse(s.ts) + 330 * 60000) }, { label: 'From', get: s => s.name || s.email }, { label: 'Kind', k: 'kind' }, { label: 'Bank', k: 'bank' }, { label: 'File type', k: 'fileType' }, { label: 'Problem', k: 'problem' }, { label: 'Note', k: 'note' },
    { label: '', html: s => `<button class="btn-sm" data-sv="${esc(s.id)}">View</button> <button class="btn-sm" data-sd="${esc(s.id)}">⇩ JSON</button>` }], list, { maxH: 360, empty: 'No file samples received yet.' });
  const get = async id => JSON.parse((await Backend.call('getSample', { id })).sample);
  $$('[data-sd]', host).forEach(b => b.onclick = async () => { try { const s = await get(b.dataset.sd); downloadBlob(new Blob([JSON.stringify(s, null, 1)], { type: 'application/json' }), `${CONFIG.FILE_PREFIX}_sample_${b.dataset.sd}.json`); } catch (e) { toast(e.message, 'err'); } });
  $$('[data-sv]', host).forEach(b => b.onclick = async () => { try { const s = await get(b.dataset.sv);
    modal({ title: 'File sample ' + esc(b.dataset.sv), foot: false, body: `<div class="small">${esc(s.kindLabel || s.kind)} · ${esc(s.fileType)} · ${esc(s.bank || '')} · ${esc(s.app || '')}</div>${(s.problems || []).length ? `<div class="small" style="color:var(--amber)">${esc(s.problems.join(' · '))}</div>` : ''}${s.note ? `<div class="small">Note: ${esc(s.note)}</div>` : ''}` +
      (s.sheets || []).map(sh => `<div class="small dim" style="margin-top:10px">${esc(sh.sheet)} · ${sh.totalRows} rows · header row ${sh.headerRow || '—'} · mapping: ${esc(Object.entries(sh.mapping || {}).map(([k, v]) => k + '=' + v).join(', '))}</div><div class="tbl-wrap" style="max-height:320px"><table class="tbl smp-t"><tbody>${sh.rows.map(r => `<tr class="${r.part === 'HEADER' ? 'smp-h' : ''}"><td class="dim small">${r.r}</td>${r.c.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${(sh.rawLines || []).length ? `<pre class="smp-pre">${esc(sh.rawLines.join('\n'))}</pre>` : ''}`).join('') }); } catch (e) { toast(e.message, 'err'); } });
}
