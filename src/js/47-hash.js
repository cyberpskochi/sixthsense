/* ============================ HASH GENERATOR ============================
   Hash values (MD5 · SHA-1 · SHA-256 · SHA-512 — only the ticked ones) and BSA 2023 Section 63(4)(c)
   Part-A / Part-B certificates with Annexure-I, in English or fully in Malayalam.
   Everything runs in this browser; files are never uploaded. Print: certificate on page 1,
   Annexure-I on page 2 (so it prints on the back in duplex). Word export needs no library.      */
(() => {
const HG = { tab: 'hash', part: 'A', algos: ['sha256'], results: [], active: ['sha256'], busy: false, lang: 'en', form: {}, out: { A: '', B: '' } };
const ALGO_LABELS = { md5: 'MD5', sha1: 'SHA-1', sha256: 'SHA-256', sha512: 'SHA-512' };
function ensureMeera() { if (document.getElementById('meeraFace')) return; const st = document.createElement('style'); st.id = 'meeraFace'; st.textContent = `@font-face{font-family:"Meera";src:url(data:font/woff2;base64,${MEERA_WOFF2}) format("woff2");font-display:swap}`; document.head.appendChild(st); }
/* ---------- streaming MD5 (no big word arrays — works for large files) ---------- */
const MD5K = new Int32Array(64).map((_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0);
const MD5S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
async function md5Hex(bytes, onProg) {
  let a0 = 0x67452301 | 0, b0 = 0xefcdab89 | 0, c0 = 0x98badcfe | 0, d0 = 0x10325476 | 0; const M = new Int32Array(16);
  const blk = (dv, off) => { for (let j = 0; j < 16; j++) M[j] = dv.getInt32(off + 4 * j, true);
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) { let F, g;
      if (i < 16) { F = (B & C) | (~B & D); g = i; } else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) & 15; } else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) & 15; } else { F = C ^ (B | ~D); g = (7 * i) & 15; }
      F = (F + A + MD5K[i] + M[g]) | 0; A = D; D = C; C = B; B = (B + ((F << MD5S[i]) | (F >>> (32 - MD5S[i])))) | 0; }
    a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0; };
  const len = bytes.length, full = Math.floor(len / 64), dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let k = 0; k < full; k++) { blk(dv, k * 64); if ((k & 0x1ffff) === 0x1ffff) { onProg && onProg(k / full); await new Promise(r => setTimeout(r)); } }
  const rem = len - full * 64; const tail = new Uint8Array(rem < 56 ? 64 : 128); tail.set(bytes.subarray(full * 64)); tail[rem] = 0x80;
  const tdv = new DataView(tail.buffer); tdv.setUint32(tail.length - 8, (len * 8) >>> 0, true); tdv.setUint32(tail.length - 4, Math.floor(len / 0x20000000), true);
  for (let off = 0; off < tail.length; off += 64) blk(tdv, off);
  const hx = n => [0, 8, 16, 24].map(s => ((n >>> s) & 255).toString(16).padStart(2, '0')).join('');
  return hx(a0) + hx(b0) + hx(c0) + hx(d0);
}
async function shaHex(alg, buf) { return Array.from(new Uint8Array(await crypto.subtle.digest(alg, buf))).map(x => x.toString(16).padStart(2, '0')).join(''); }
function fmtSize(n, lang) { const U = lang === 'ml' ? ['ബൈറ്റ്', 'കെ.ബി.', 'എം.ബി.', 'ജി.ബി.', 'ടി.ബി.'] : ['B', 'KB', 'MB', 'GB', 'TB']; if (n < 1024) return n + ' ' + U[0]; let u = 0; do { n /= 1024; u++; } while (n >= 1024 && u < 4); return n.toFixed(2) + ' ' + U[u]; }

const ALGO_W={md5:1,sha1:1.2,sha256:1.7,sha512:2.8};
function colFractions(){
  const fixed=[0.055,0.135,0.08], rem=1-0.27;
  const tot=HG.active.reduce((sum,a)=>sum+ALGO_W[a],0);
  return fixed.concat(HG.active.map(a=>rem*ALGO_W[a]/tot));
}
function annexureTableHtml(lang){
  lang=lang||'en';
  const t=CERT_I18N[lang].tableHeaders;
  const cols='<colgroup>'+colFractions().map(f=>'<col style="width:'+(f*100).toFixed(2)+'%">').join('')+'</colgroup>';
  const headCells='<th>'+t.sno+'</th><th>'+t.fileName+'</th><th>'+t.size+'</th>'+HG.active.map(a=>'<th>'+ALGO_LABELS[a]+'</th>').join('');
  const rows=HG.results.map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(r.name)+'</td><td>'+fmtSize(r.size,lang)+'</td>'+
    HG.active.map(a=>'<td class="mono">'+r[a]+'</td>').join('')+'</tr>').join('');
  return '<table>'+cols+'<thead><tr>'+headCells+'</tr></thead><tbody>'+rows+'</tbody></table>';
}


const CERT_PRINT_CSS=
'@page{size:A4 portrait;margin:0}'+'html,body{margin:0;padding:0}'+
'*{-webkit-print-color-adjust:exact;print-color-adjust:exact;box-sizing:border-box}'+
'.cert-page{width:210mm;height:296.5mm;padding:17mm 15mm 16mm 18mm;overflow:visible}'+
'body{font-family:"Times New Roman",Times,"Meera",serif;font-size:12.5pt;line-height:1.55;color:#111;margin:0}'+
'.lang-ml{font-size:12.5pt;line-height:1.7}.lang-ml p{margin-bottom:9pt;text-align:justify;text-justify:inter-word}.lang-ml .cbline{line-height:2;margin-bottom:9pt}.lang-ml .cert-bottom{margin-top:12pt}.dt{display:inline-block;margin-right:18pt}'+
'.annex-page{break-before:page;page-break-before:always}'+
'.annex-page.first{break-before:auto;page-break-before:auto}'+
'p{margin:0 0 8pt;text-align:justify}'+
'.cert-title{text-align:center;font-size:17pt;font-weight:700;letter-spacing:.06em;margin:0 0 2pt}'+
'.cert-sub{text-align:center;font-style:italic;font-size:11pt;margin-bottom:8pt}'+
'.cert-part{text-align:center;font-size:14pt;font-weight:700;margin:4pt 0 0}'+
'.cert-partsub{text-align:center;font-style:italic;font-size:11pt;margin-bottom:6pt}'+
'.cert-hr{border:none;border-top:1.5pt solid #333;margin:4pt 0 10pt}'+
'.cert-bottom{display:grid;grid-template-columns:1fr 1fr;gap:18pt;margin-top:16pt;line-height:2;break-inside:avoid}'+
'.cert-foot{text-align:center;font-style:italic;font-size:9.5pt;color:#444;margin-top:12pt}'+
'.cbline{margin:2pt 0 9pt;line-height:2}'+
'.cbitem{display:inline-block;white-space:nowrap;margin-right:16pt}'+
'.cb{display:inline-block;width:11.5pt;height:11.5pt;border:1.2pt solid #000;border-radius:1pt;text-align:center;line-height:10.5pt;font-size:11pt;font-weight:900;vertical-align:-2pt;margin-right:4pt;font-family:"Segoe UI Symbol","DejaVu Sans",Arial,sans-serif}'+
'.annex-title{text-align:center;font-size:15pt;font-weight:700;letter-spacing:.05em;margin:0 0 2pt}'+
'table{border-collapse:collapse;width:100%;font-size:8pt;line-height:1.35;table-layout:fixed;margin-top:6pt}'+
'thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}'+
'th,td{border:0.8pt solid #666;padding:3pt 4pt;word-break:break-all;vertical-align:top;text-align:left}'+
'th{background:#e9e9e9;font-weight:700}'+
'td.mono{font-family:Consolas,"Courier New",monospace;font-size:7.5pt}'+
'.annex-sign{display:flex;justify-content:flex-end;margin-top:18pt;break-inside:avoid}'+
'.annex-sign div{min-width:200pt;line-height:1.9}';
/* Shrinks a page's text just enough to keep it on ONE A4 sheet, so the certificate is
   always page 1 and Annexure-I always page 2 (prints on the back in duplex). */
const FIT_JS_UNUSED='function fitPages(){var H=263*96/25.4;'+
  'document.querySelectorAll(".cert-page").forEach(function(pg){'+
  'var fs=parseFloat(getComputedStyle(pg).fontSize),n=0;'+
  'var t=pg.querySelector("table"),ts=t?parseFloat(getComputedStyle(t).fontSize):0;'+
  'while(pg.scrollHeight>pg.clientHeight+2&&n<80){n++;'+
  'if(t&&ts>6.5){ts-=0.25;t.style.fontSize=ts+"px";t.querySelectorAll("td.mono").forEach(function(c){c.style.fontSize=(ts-0.5)+"px"});}'+
  'else if(fs>10){fs-=0.25;pg.style.fontSize=fs+"px";}else break;}});}';

/* ================= Minimal offline DOCX (ZIP + OOXML) writer ================= */
function crc32(buf){
  if(!crc32.table){
    const t=[];
    for(let n=0;n<256;n++){
      let c=n;
      for(let k=0;k<8;k++) c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);
      t[n]=c>>>0;
    }
    crc32.table=t;
  }
  let crc=0^(-1);
  for(let i=0;i<buf.length;i++) crc=(crc>>>8)^crc32.table[(crc^buf[i])&0xFF];
  return (crc^(-1))>>>0;
}
function strToBytes(str){ return new TextEncoder().encode(str); }

function makeZip(entries){
  const localParts=[], centralParts=[]; let offset=0;
  const now=new Date();
  const dosTime=((now.getHours()<<11)|(now.getMinutes()<<5)|(now.getSeconds()>>1))&0xFFFF;
  const dosDate=(((now.getFullYear()-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate())&0xFFFF;
  entries.forEach(e=>{
    const nameBytes=strToBytes(e.name); const data=e.data;
    const crc=crc32(data); const size=data.length;
    const local=new Uint8Array(30+nameBytes.length);
    const dv=new DataView(local.buffer);
    dv.setUint32(0,0x04034b50,true); dv.setUint16(4,20,true); dv.setUint16(6,0,true);
    dv.setUint16(8,0,true); dv.setUint16(10,dosTime,true); dv.setUint16(12,dosDate,true);
    dv.setUint32(14,crc,true); dv.setUint32(18,size,true); dv.setUint32(22,size,true);
    dv.setUint16(26,nameBytes.length,true); dv.setUint16(28,0,true);
    local.set(nameBytes,30);
    localParts.push(local,data);

    const central=new Uint8Array(46+nameBytes.length);
    const cdv=new DataView(central.buffer);
    cdv.setUint32(0,0x02014b50,true); cdv.setUint16(4,20,true); cdv.setUint16(6,20,true);
    cdv.setUint16(8,0,true); cdv.setUint16(10,0,true); cdv.setUint16(12,dosTime,true); cdv.setUint16(14,dosDate,true);
    cdv.setUint32(16,crc,true); cdv.setUint32(20,size,true); cdv.setUint32(24,size,true);
    cdv.setUint16(28,nameBytes.length,true); cdv.setUint16(30,0,true); cdv.setUint16(32,0,true);
    cdv.setUint16(34,0,true); cdv.setUint16(36,0,true); cdv.setUint32(38,0,true);
    cdv.setUint32(42,offset,true);
    central.set(nameBytes,46);
    centralParts.push(central);
    offset+=local.length+data.length;
  });
  const centralStart=offset;
  let centralSize=0; centralParts.forEach(c=>centralSize+=c.length);
  const eocd=new Uint8Array(22);
  const edv=new DataView(eocd.buffer);
  edv.setUint32(0,0x06054b50,true); edv.setUint16(8,entries.length,true); edv.setUint16(10,entries.length,true);
  edv.setUint32(12,centralSize,true); edv.setUint32(16,centralStart,true);
  const out=new Uint8Array(offset+centralSize+eocd.length);
  let pos=0;
  localParts.forEach(p=>{out.set(p,pos);pos+=p.length;});
  centralParts.forEach(p=>{out.set(p,pos);pos+=p.length;});
  out.set(eocd,pos);
  return out;
}

function xesc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
const PORTRAIT={w:11906,h:16838,top:1134,right:1134,bottom:1134,left:1304};
const LANDSCAPE={w:16838,h:11906,top:850,right:850,bottom:850,left:850};
function usableW(g){ return g.w-g.left-g.right; }
function sectPrXml(g,landscape){
  return '<w:sectPr><w:footerReference w:type="default" r:id="rId1"/><w:pgSz w:w="'+g.w+'" w:h="'+g.h+'"'+(landscape?' w:orient="landscape"':'')+'/>'+
    '<w:pgMar w:top="'+g.top+'" w:right="'+g.right+'" w:bottom="'+g.bottom+'" w:left="'+g.left+'" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr>';
}
function wr(text,o){
  o=o||{}; const f=o.font||'Times New Roman'; const sz=o.size||DOCX_SZ;
  let r='<w:rFonts w:ascii="'+f+'" w:hAnsi="'+f+'" w:cs="Meera"/>';
  if(o.bold) r+='<w:b/><w:bCs/>';
  if(o.italic) r+='<w:i/><w:iCs/>';
  r+='<w:sz w:val="'+sz+'"/><w:szCs w:val="'+sz+'"/>';
  return '<w:r><w:rPr>'+r+'</w:rPr><w:t xml:space="preserve">'+xesc(text)+'</w:t></w:r>';
}
/* Small box with bold tick (Unicode ballot boxes — render in Word, LibreOffice and WPS alike) */
function wbox(checked){
  return '<w:r><w:rPr><w:rFonts w:ascii="Segoe UI Symbol" w:hAnsi="Segoe UI Symbol" w:cs="Segoe UI Symbol" w:eastAsia="Segoe UI Symbol" w:hint="default"/><w:b/><w:bCs/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr><w:t>'+(checked?'\u2611\uFE0E':'\u2610')+'</w:t></w:r>';
}
function wchecks(items){ return items.map(it=>wbox(it.checked)+wr('\u00A0'+it.label.replace(/ /g,'\u00A0')+'      ')).join(''); }
let DOCX_LINE=300, DOCX_JC='both', DOCX_SZ=24;
function wpara(runs,o){
  o=o||{}; let p='';
  if(o.keepNext) p+='<w:keepNext/>';
  if(o.pageBreakBefore) p+='<w:pageBreakBefore/>';
  p+='<w:spacing w:before="'+(o.spacingBefore||0)+'" w:after="'+(o.spacingAfter!==undefined?o.spacingAfter:140)+'" w:line="'+(o.line||DOCX_LINE)+'" w:lineRule="auto"/>';
  p+='<w:jc w:val="'+(o.center?'center':(o.right?'right':(o.left?'left':DOCX_JC)))+'"/>';
  if(o.sect) p+=o.sect;
  return '<w:p><w:pPr>'+p+'</w:pPr>'+runs+'</w:p>';
}
function wp(text,opts){ return wpara(wr(text,opts),opts); }
function wlv(label,value,o){ return wpara(wr(label,{bold:true})+wr(' '+value),o||{left:true}); }
function wtable(headers,rows,opt){
  opt=opt||{}; const total=opt.total||usableW(PORTRAIT);
  const fr=opt.fractions||headers.map(()=>1/headers.length);
  const widths=fr.map(f=>Math.floor(total*f));
  const monoFrom=opt.monoFrom!==undefined?opt.monoFrom:999;
  const borders='<w:tblBorders>'+['top','left','bottom','right','insideH','insideV'].map(x=>'<w:'+x+' w:val="single" w:sz="4" w:space="0" w:color="777777"/>').join('')+'</w:tblBorders>';
  const tblPr='<w:tblPr><w:tblW w:w="'+total+'" w:type="dxa"/>'+borders+'<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="70" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar></w:tblPr>';
  const grid='<w:tblGrid>'+widths.map(w=>'<w:gridCol w:w="'+w+'"/>').join('')+'</w:tblGrid>';
  function cell(text,w,o){
    const shd=o.head?'<w:shd w:val="clear" w:color="auto" w:fill="E9E9E9"/>':'';
    return '<w:tc><w:tcPr><w:tcW w:w="'+w+'" w:type="dxa"/>'+shd+'</w:tcPr>'+wpara(wr(text,{bold:o.head,size:o.size,font:o.font}),{left:true,spacingAfter:0,line:240})+'</w:tc>';
  }
  let xml='<w:tbl>'+tblPr+grid+'<w:tr><w:trPr><w:cantSplit/><w:tblHeader/></w:trPr>'+headers.map((h,i)=>cell(h,widths[i],{head:true,size:18})).join('')+'</w:tr>';
  rows.forEach(r=>{ xml+='<w:tr><w:trPr><w:cantSplit/></w:trPr>'+r.map((c,i)=>cell(c,widths[i],{size:i>=monoFrom?15:17,font:i>=monoFrom?'Consolas':undefined})).join('')+'</w:tr>'; });
  return xml+'</w:tbl>';
}
function wgrid2(leftXml,rightXml,total){
  const half=Math.floor(total/2);
  const nb='<w:tblBorders>'+['top','left','bottom','right','insideH','insideV'].map(x=>'<w:'+x+' w:val="nil"/>').join('')+'</w:tblBorders>';
  return '<w:tbl><w:tblPr><w:tblW w:w="'+total+'" w:type="dxa"/>'+nb+'<w:tblLayout w:type="fixed"/></w:tblPr>'+
    '<w:tblGrid><w:gridCol w:w="'+half+'"/><w:gridCol w:w="'+half+'"/></w:tblGrid>'+
    '<w:tr><w:trPr><w:cantSplit/></w:trPr><w:tc><w:tcPr><w:tcW w:w="'+half+'" w:type="dxa"/></w:tcPr>'+leftXml+'</w:tc>'+
    '<w:tc><w:tcPr><w:tcW w:w="'+half+'" w:type="dxa"/></w:tcPr>'+rightXml+'</w:tc></w:tr></w:tbl>';
}
function annexDocxTable(lang){
  const t=CERT_I18N[lang].tableHeaders;
  const headers=[t.sno,t.fileName,t.size].concat(HG.active.map(a=>ALGO_LABELS[a]));
  const rows=HG.results.map((r,idx)=>[String(idx+1), r.name, fmtSize(r.size,lang)].concat(HG.active.map(a=>r[a])));
  return wtable(headers,rows,{total:usableW(PORTRAIT),fractions:colFractions(),monoFrom:3});
}
function buildDocumentXml(bodyXml,finalSect){
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
  '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'+
  '<w:body>'+bodyXml+finalSect+'</w:body></w:document>';
}
function footerXml(){
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
  '<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'+
  '<w:p><w:pPr><w:jc w:val="center"/></w:pPr>'+
  '<w:r><w:rPr><w:sz w:val="18"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r>'+
  '<w:r><w:rPr><w:sz w:val="18"/></w:rPr><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>'+
  '<w:r><w:rPr><w:sz w:val="18"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>';
}
function contentTypesXml(){
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'+
  '<Default Extension="xml" ContentType="application/xml"/>'+
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'+
  '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>'+
  '</Types>';
}
function rootRelsXml(){
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'+
  '</Relationships>';
}
function docRelsXml(){
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>'+
  '</Relationships>';
}
function generateDocx(bodyXml, filename, landscapeFinal){
  const finalSect=landscapeFinal?sectPrXml(LANDSCAPE,true):sectPrXml(PORTRAIT,false);
  const files=[
    {name:'[Content_Types].xml', data:strToBytes(contentTypesXml())},
    {name:'_rels/.rels', data:strToBytes(rootRelsXml())},
    {name:'word/_rels/document.xml.rels', data:strToBytes(docRelsXml())},
    {name:'word/document.xml', data:strToBytes(buildDocumentXml(bodyXml,finalSect))},
    {name:'word/footer1.xml', data:strToBytes(footerXml())}
  ];
  const zipBytes=makeZip(files);
  const blob=new Blob([zipBytes],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download=filename;
  document.body.appendChild(a); a.click(); a.remove();
}


const CL={
en:{partATitle:'Part-A — To be filled by the Party', partBTitle:'Part-B — To be filled by the Expert',
  fullName:'Full Name', expertFullName:"Expert's Full Name", parentSpouse:'Son/daughter/spouse of', age:'Age',
  fullAddr:'Residing/employed at (Full Address)', orgAddr:'Residing/employed at (Organisation/Address)',
  sourceTick:'Electronic/digital record source (tick mark)',
  ownership:'The digital device or the source of the digital record is (select as applicable)',
  makeModel:'Make & Model', color:'Color', serial:'Serial Number', imeiId:'IMEI/UIN/UID/MAC/Cloud ID',
  otherInfo:'Any other relevant information', hashAlgo:'HASH algorithm (for certificate statement)',
  date:'Date (DD/MM/YYYY)', time:'Time (Hrs)', place:'Place', designation:'Designation',
  genA:'Generate Part-A Certificate', genB:'Generate Part-B Certificate', relation:'Relation', relName:"Father's / Mother's / Spouse's Name", relSon:'Son of (Father / Mother)', relDaughter:'Daughter of (Father / Mother)', relWife:'Wife of (Husband)', relHusband:'Husband of (Wife)'},
ml:{partATitle:'ഭാഗം-എ — കക്ഷി പൂരിപ്പിക്കേണ്ടത്', partBTitle:'ഭാഗം-ബി — വിദഗ്ധൻ പൂരിപ്പിക്കേണ്ടത്',
  fullName:'മുഴുവൻ പേര്', expertFullName:'വിദഗ്ധന്റെ മുഴുവൻ പേര്', parentSpouse:'പിതാവ്/മാതാവ്/ഭർത്താവ്/ഭാര്യയുടെ പേര്', age:'വയസ്സ്',
  fullAddr:'താമസിക്കുന്ന/ജോലി ചെയ്യുന്ന വിലാസം', orgAddr:'സ്ഥാപനം/വിലാസം',
  sourceTick:'ഇലക്ട്രോണിക്/ഡിജിറ്റൽ രേഖയുടെ സ്രോതസ്സ് (ടിക് ചെയ്യുക)',
  ownership:'ഡിജിറ്റൽ ഉപകരണം അല്ലെങ്കിൽ രേഖയുടെ സ്രോതസ്സ് (ബാധകമായത് തിരഞ്ഞെടുക്കുക)',
  makeModel:'നിർമ്മാണവും മോഡലും', color:'നിറം', serial:'സീരിയൽ നമ്പർ', imeiId:'IMEI/UIN/UID/MAC/Cloud ID',
  otherInfo:'മറ്റ് പ്രസക്തമായ വിവരങ്ങൾ', hashAlgo:'സർട്ടിഫിക്കറ്റിനായി ഉപയോഗിക്കുന്ന ഹാഷ് അൽഗോരിതം',
  date:'തീയതി (DD/MM/YYYY)', time:'സമയം (Hrs)', place:'സ്ഥലം', designation:'പദവി',
  genA:'ഭാഗം-എ സർട്ടിഫിക്കറ്റ് തയ്യാറാക്കുക', genB:'ഭാഗം-ബി സർട്ടിഫിക്കറ്റ് തയ്യാറാക്കുക', relation:'ബന്ധം', relName:'പിതാവ്/മാതാവ്/ജീവിതപങ്കാളിയുടെ പേര്', relSon:'മകൻ (പിതാവ്/മാതാവ്)', relDaughter:'മകൾ (പിതാവ്/മാതാവ്)', relWife:'ഭാര്യ (ഭർത്താവ്)', relHusband:'ഭർത്താവ് (ഭാര്യ)'}
};

const CERT_I18N={
en:{
  certTitle:'CERTIFICATE', addressL:'Address:', otherInfoL:'Other relevant information:',
  personTail:(rel,rn,a,ad)=>(rn?', '+({son:'Son of',daughter:'Daughter of',wife:'Wife of',husband:'Husband of'}[rel])+' '+rn:'')+(a?', Age '+a:'')+(ad?', residing/employed at '+ad:''),
  underSection:'[Under section 63(4)(c) of Bharatiya Sakshya Adhiniyam, 2023]',
  partLabel:{A:'PART-A',B:'PART-B'}, partSub:{A:'(To be filled by the Party)',B:'(To be filled by the Expert)'},
  makeModelL:'Make & Model:', colorL:'Color:', serialL:'Serial Number:',
  imeiL:'IMEI/UIN/UID/MAC/Cloud ID:', asApplicable:'(as applicable) and any other relevant information:',
  dateL:'Date (DD/MM/YYYY):', timeL:'Time (Hrs):', placeL:'Place:',
  signatureL:'Signature:', nameL:'Name:', designationL:'Designation:',
  annexureHeading:'Annexure-I', annexRef:'Attached to the Certificate under Section 63(4)(c) of Bharatiya Sakshya Adhiniyam, 2023 \u2014 ', noFiles:'No files hashed yet \u2014 go to the Hashes tab and compute hashes first.',
  tableHeaders:{sno:'#', fileName:'File Name', size:'Size'},
  sourceLabels:{computer:'Computer/Storage Media',dvr:'DVR',mobile:'Mobile',flashdrive:'Flash Drive',cddvd:'CD/DVD',server:'Server',cloud:'Cloud',other:'Other'},
  ownLabels:{owned:'Owned',maintained:'Maintained',managed:'Managed',operated:'Operated by me'},
  introA:(n,pr)=>'I, '+n+pr+', do hereby solemnly affirm and sincerely state and submit as follows:\u2014 I have produced electronic record/output of the digital record taken from the following electronic/digital record source:\u2014',
  introB:(n,pr)=>'I, '+n+pr+', do hereby solemnly affirm and sincerely state and submit as follows:\u2014 The produced electronic record/output of the digital record are obtained from the following device/digital record source:\u2014',
  midA:(own,alg)=>'The digital device or the digital record source was under the lawful control for regularly creating, storing or processing information for the purposes of carrying out regular activities and during this period, the computer or the communication device was working properly and the relevant information was regularly fed into the computer during the ordinary course of business. If the computer/digital device at any point of time was not working properly or out of operation, then it has not affected the electronic record or its accuracy. The digital device or the source of the digital record is:\u2014 '+own+' I state that the HASH value/s of the electronic/digital record/s is as per Annexure-I, obtained through '+alg+' algorithm. Attached Annexure-I.',
  midB:(alg)=>'I state that the HASH value/s of the electronic/digital record/s is as per Annexure-I, obtained through '+alg+' algorithm. Attached Annexure-I.'
},
ml:{
  certTitle:'സാക്ഷ്യപത്രം', addressL:'വിലാസം:', otherInfoL:'മറ്റ് പ്രസക്തമായ വിവരങ്ങൾ:',
  personTail:(rel,rn,a,ad)=>(rn?', '+rn+'-ന്റെ '+({son:'മകൻ',daughter:'മകൾ',wife:'ഭാര്യ',husband:'ഭർത്താവ്'}[rel]):'')+(a?', വയസ്സ് '+a:'')+(ad?', '+ad+' എന്ന സ്ഥലത്ത് താമസിക്കുന്ന/ജോലി ചെയ്യുന്ന വ്യക്തി':''),
  underSection:'[ഭാരതീയ സാക്ഷ്യ അധിനിയം, 2023-ലെ വകുപ്പ് 63(4)(സി) പ്രകാരം]',
  partLabel:{A:'ഭാഗം-എ',B:'ഭാഗം-ബി'}, partSub:{A:'(കക്ഷി പൂരിപ്പിക്കേണ്ടത്)',B:'(വിദഗ്ധൻ പൂരിപ്പിക്കേണ്ടത്)'},
  makeModelL:'നിർമ്മാണവും മോഡലും:', colorL:'നിറം:', serialL:'സീരിയൽ നമ്പർ:',
  imeiL:'IMEI/UIN/UID/MAC/ക്ലൗഡ് ഐഡി:', asApplicable:'(ബാധകമെങ്കിൽ) കൂടാതെ മറ്റ് പ്രസക്തമായ വിവരങ്ങൾ:',
  dateL:'തീയതി:', timeL:'സമയം (Hrs):', placeL:'സ്ഥലം:',
  signatureL:'ഒപ്പ്:', nameL:'പേര്:', designationL:'പദവി:',
  annexureHeading:'അനുബന്ധം-I', annexRef:'ഭാരതീയ സാക്ഷ്യ അധിനിയം, 2023-ലെ വകുപ്പ് 63(4)(സി) പ്രകാരമുള്ള സാക്ഷ്യപത്രത്തോടൊപ്പം ചേർത്തത് \u2014 ', noFiles:'ഇതുവരെ ഫയലുകളൊന്നും ഹാഷ് ചെയ്തിട്ടില്ല \u2014 ആദ്യം ഹാഷ് ടാബിൽ പോയി ഹാഷ് കണക്കാക്കുക.',
  tableHeaders:{sno:'ക്രമ നം.', fileName:'ഫയൽ നാമം', size:'വലുപ്പം'},
  sourceLabels:{computer:'കമ്പ്യൂട്ടർ/സ്റ്റോറേജ് മീഡിയ',dvr:'ഡിവിആർ',mobile:'മൊബൈൽ',flashdrive:'ഫ്ലാഷ് ഡ്രൈവ്',cddvd:'സിഡി/ഡിവിഡി',server:'സെർവർ',cloud:'ക്ലൗഡ്',other:'മറ്റുള്ളവ'},
  ownLabels:{owned:'ഉടമസ്ഥതയിലുള്ളത്',maintained:'പരിപാലിക്കുന്നത്',managed:'നിയന്ത്രിക്കുന്നത്',operated:'ഞാൻ പ്രവർത്തിപ്പിക്കുന്നത്'},
  introA:(n,pr)=>'ഞാൻ, '+n+pr+', ഇതിനാൽ ഗൗരവപൂർവ്വം ദൃഢപ്രതിജ്ഞ ചെയ്ത് ആത്മാർത്ഥമായി താഴെ പറയും പ്രകാരം പ്രസ്താവിക്കുകയും ബോധിപ്പിക്കുകയും ചെയ്യുന്നു:\u2014 താഴെ പറയുന്ന സ്രോതസ്സിൽ നിന്നും എടുത്ത ഇലക്ട്രോണിക് രേഖ/ഡിജിറ്റൽ രേഖയുടെ ഔട്ട്പുട്ട് ഞാൻ ഹാജരാക്കിയിട്ടുണ്ട്.',
  introB:(n,pr)=>'ഞാൻ, '+n+pr+', ഇതിനാൽ ഗൗരവപൂർവ്വം ദൃഢപ്രതിജ്ഞ ചെയ്ത് ആത്മാർത്ഥമായി താഴെ പറയും പ്രകാരം പ്രസ്താവിക്കുകയും ബോധിപ്പിക്കുകയും ചെയ്യുന്നു:\u2014 ഹാജരാക്കിയ ഇലക്ട്രോണിക് രേഖ/ഡിജിറ്റൽ രേഖയുടെ ഔട്ട്പുട്ട് താഴെ പറയുന്ന ഉപകരണം/ഡിജിറ്റൽ രേഖാ സ്രോതസ്സിൽ നിന്ന് ലഭിച്ചതാണ്:\u2014',
  midA:(own,alg)=>'പതിവ് പ്രവർത്തനങ്ങൾ നിർവഹിക്കുന്നതിനായി വിവരങ്ങൾ ക്രമമായി സൃഷ്ടിക്കുന്നതിനോ സൂക്ഷിക്കുന്നതിനോ സംസ്കരിക്കുന്നതിനോ വേണ്ടി ഡിജിറ്റൽ ഉപകരണം അല്ലെങ്കിൽ ഡിജിറ്റൽ രേഖയുടെ സ്രോതസ്സ് നിയമപരമായ നിയന്ത്രണത്തിൻ കീഴിലായിരുന്നു, ഈ കാലയളവിൽ കമ്പ്യൂട്ടർ അല്ലെങ്കിൽ ആശയവിനിമയ ഉപകരണം ശരിയായി പ്രവർത്തിക്കുകയും പ്രസക്തമായ വിവരങ്ങൾ സാധാരണ പ്രവർത്തനങ്ങളുടെ ഗതിയിൽ ക്രമമായി കമ്പ്യൂട്ടറിലേക്ക് നൽകുകയും ചെയ്തിരുന്നു. ഏതെങ്കിലും ഘട്ടത്തിൽ കമ്പ്യൂട്ടർ/ഡിജിറ്റൽ ഉപകരണം ശരിയായി പ്രവർത്തിക്കാതിരിക്കുകയോ പ്രവർത്തനരഹിതമാവുകയോ ചെയ്തിട്ടുണ്ടെങ്കിൽ, അത് ഇലക്ട്രോണിക് രേഖയെയോ അതിന്റെ കൃത്യതയെയോ ബാധിച്ചിട്ടില്ല. ഡിജിറ്റൽ ഉപകരണം അല്ലെങ്കിൽ ഡിജിറ്റൽ രേഖയുടെ സ്രോതസ്സ്:\u2014 '+own+' ഇലക്ട്രോണിക്/ഡിജിറ്റൽ രേഖയുടെ ഹാഷ് മൂല്യം/മൂല്യങ്ങൾ അനുബന്ധം-I പ്രകാരമുള്ളതാണെന്നും അത് '+alg+' അൽഗോരിതം ഉപയോഗിച്ച് ലഭിച്ചതാണെന്നും ഞാൻ പ്രസ്താവിക്കുന്നു. അനുബന്ധം-I ഇതോടൊപ്പം ചേർത്തിരിക്കുന്നു.',
  midB:(alg)=>'ഇലക്ട്രോണിക്/ഡിജിറ്റൽ രേഖയുടെ ഹാഷ് മൂല്യം/മൂല്യങ്ങൾ അനുബന്ധം-I പ്രകാരമുള്ളതാണെന്നും അത് '+alg+' അൽഗോരിതം ഉപയോഗിച്ച് ലഭിച്ചതാണെന്നും ഞാൻ പ്രസ്താവിക്കുന്നു. അനുബന്ധം-I ഇതോടൊപ്പം ചേർത്തിരിക്കുന്നു.'
}
};


/* ---------- Certificate data helpers ---------- */
function pad2(n){ return n<10?'0'+n:''+n; }
function nowDateStr(){ const d=new Date(); return pad2(d.getDate())+'/'+pad2(d.getMonth()+1)+'/'+d.getFullYear(); }
function nowTimeStr(){ const d=new Date(); return pad2(d.getHours())+':'+pad2(d.getMinutes())+':'+pad2(d.getSeconds()); }
function fv(id){ const el=document.getElementById(id); return el && el.value ? el.value : '_____________'; }
const SRC_KEYS=['computer','dvr','mobile','flashdrive','cddvd','server','cloud','other'];
const OWN_KEYS=['owned','maintained','managed','operated'];
const OWN_TOKEN='\u0001OWN\u0001';
function srcItems(p,lang,E){ E=E||(x=>x);
  const labels=CERT_I18N[lang].sourceLabels;
  return SRC_KEYS.map(k=>{
    const el=document.getElementById(p+'_src_'+k);
    const checked=!!(el&&el.checked);
    let label=labels[k];
    if(k==='other'&&checked){ const t=document.getElementById(p+'_otherSourceText').value; if(t) label+=' ('+E(t)+')'; }
    return {checked,label};
  });
}
function ownItems(p,lang){
  const labels=CERT_I18N[lang].ownLabels;
  return OWN_KEYS.map(k=>{ const el=document.getElementById(p+'_own_'+k); return {checked:!!(el&&el.checked),label:labels[k]}; });
}
function checksHtml(items,suffix){
  const inner=items.map(it=>'<span class="cbitem"><span class="cb">'+(it.checked?'&#10004;':'&nbsp;')+'</span>'+it.label+'</span>').join(' ');
  return '<div class="cbline">'+inner+(suffix?' <i>'+suffix+'</i>':'')+'</div>';
}
function refreshCertAlgoSelects(){
  ['A_hashAlgo','B_hashAlgo'].forEach(id=>{
    const sel=document.getElementById(id);
    const cur=sel.value;
    sel.innerHTML=HG.active.map(a=>'<option'+(ALGO_LABELS[a]===cur?' selected':'')+'>'+ALGO_LABELS[a]+'</option>').join('');
  });
}
function fe(id){ const el=document.getElementById(id); return el&&el.value?el.value.trim():''; }
function certParts(p,html){
  const lang=HG.lang, i=CERT_I18N[lang]; const E=html?esc:(x=>x);
  const name=E(fv(p+'_fullName'));
  const rel=document.getElementById(p+'_relation').value;
  const relName=E(fe(p+'_parentSpouse')), age=E(fe(p+'_age')), addr=E(fe(p+'_addr'));
  const tail=i.personTail(rel,relName,age,addr);
  const intro=p==='A'?i.introA(name,tail):i.introB(name,tail);
  const details=[[i.makeModelL,E(fe(p+'_makeModel'))],[i.colorL,E(fe(p+'_color'))],[i.serialL,E(fe(p+'_serial'))],
    [i.imeiL,E(fe(p+'_imeiId'))],[i.otherInfoL,E(fe(p+'_otherInfo'))]].filter(d=>d[1]);
  const hashAlgo=document.getElementById(p+'_hashAlgo').value;
  const date=E(fe(p+'_date')||nowDateStr()), time=E(fe(p+'_time')||nowTimeStr()), place=E(fe(p+'_place'));
  const leftRows=[[i.dateL,date],[i.timeL,time]]; if(place) leftRows.push([i.placeL,place]);
  const signRows=[[i.nameL,name]];
  if(p==='A'){ if(addr) signRows.push([i.addressL,addr]); }
  else { const d=E(fe('B_designation')); if(d) signRows.push([i.designationL,d]); }
  let midPre=null, midParen='', midPost;
  if(p==='A'){
    const parts=i.midA(OWN_TOKEN,hashAlgo).split(OWN_TOKEN);
    midPre=parts[0].trim();
    let rest=parts[1]||''; const m=rest.match(/^\s*(\([^)]*\))\s*/);
    if(m){ midParen=m[1]; rest=rest.slice(m[0].length); }
    midPost=rest.trim();
  } else midPost=i.midB(hashAlgo);
  return {i,name,intro,details,midPre,midParen,midPost,leftRows,signRows,
    srcI:srcItems(p,lang,E), ownI:p==='A'?ownItems('A',lang):null};
}
const SIG_LINE=' ________________________';
function rowsHtml(rows){ return rows.map(r=>'<b>'+r[0]+'</b> '+r[1]).join('<br>'); }

function buildCertHtml(p){
  const c=certParts(p,true), i=c.i;
  const sign='<b>'+i.signatureL+'</b>'+SIG_LINE+'<br>'+rowsHtml(c.signRows);
  const page1='<div class="cert-page lang-'+HG.lang+'">'+
    '<div class="cert-title">'+i.certTitle+'</div>'+
    '<div class="cert-sub">'+i.underSection+'</div>'+
    '<div class="cert-part">'+i.partLabel[p]+'</div>'+
    '<div class="cert-partsub">'+i.partSub[p]+'</div>'+
    '<hr class="cert-hr">'+
    '<p>'+c.intro+'</p>'+
    checksHtml(c.srcI)+
    (c.details.length?'<p>'+c.details.map(d=>'<span class="dt"><b>'+d[0]+'</b> '+d[1]+'</span>').join(' ')+'</p>':'')+
    (c.midPre!==null?'<p>'+c.midPre+'</p>'+checksHtml(c.ownI,c.midParen):'')+
    '<p>'+c.midPost+'</p>'+
    '<div class="cert-bottom"><div>'+rowsHtml(c.leftRows)+'</div><div>'+sign+'</div></div>'+
    '<div class="cert-foot">'+i.underSection+'</div>'+
  '</div>';
  const page2='<div class="cert-page annex-page lang-'+HG.lang+'">'+
    '<div class="annex-title">'+i.annexureHeading+'</div>'+
    '<div class="cert-partsub">'+i.annexRef+i.partLabel[p]+'</div>'+
    (HG.results.length? annexureTableHtml(HG.lang) : '<p><i>'+i.noFiles+'</i></p>')+
    '<div class="annex-sign"><div>'+sign+'</div></div>'+
  '</div>';
  return page1+page2;
}

function buildCertDocxBody(p){
  const c=certParts(p), i=c.i, W=usableW(PORTRAIT);
  DOCX_LINE = HG.lang==='ml' ? 264 : 290; DOCX_JC = 'both'; DOCX_SZ = HG.lang==='ml' ? 21 : 24;
  const gap = HG.lang==='ml' ? 90 : 120;
  let body='';
  body+=wp(i.certTitle,{bold:true,center:true,size:32,spacingAfter:40});
  body+=wp(i.underSection,{italic:true,center:true,size:21,spacingAfter:120});
  body+=wp(i.partLabel[p],{bold:true,center:true,size:28,spacingAfter:20});
  body+=wp(i.partSub[p],{italic:true,center:true,size:21,spacingAfter:220});
  body+=wp(c.intro,{spacingAfter:gap});
  body+=wpara(wchecks(c.srcI),{left:true,spacingAfter:gap+40});
  c.details.forEach((d,k)=>{ body+=wpara(wr(d[0],{bold:true})+wr(' '+d[1]),{left:true,spacingAfter:k===c.details.length-1?gap:40}); });
  if(c.midPre!==null){
    body+=wp(c.midPre,{spacingAfter:gap});
    body+=wpara(wchecks(c.ownI),{left:true,spacingAfter:gap+40});
  }
  body+=wp(c.midPost,{spacingAfter:260});
  const L={left:true,spacingAfter:160};
  const left=c.leftRows.map(r=>wlv(r[0],r[1],L)).join('');
  const right=wlv(i.signatureL,SIG_LINE,L)+c.signRows.map(r=>wlv(r[0],r[1],L)).join('');
  body+=wgrid2(left,right,W);
  body+=wp(i.underSection,{italic:true,center:true,size:18,spacingBefore:200,spacingAfter:0});
  // Annexure-I always starts on a new A4 portrait page
  body+=wp(i.annexureHeading,{bold:true,center:true,size:30,spacingAfter:20,pageBreakBefore:true});
  body+=wp(i.annexRef+i.partLabel[p],{italic:true,center:true,size:20,spacingAfter:160});
  body+= HG.results.length ? annexDocxTable(HG.lang) : wp(i.noFiles);
  const R={right:true,spacingAfter:80};
  body+=wpara(wr(i.signatureL,{bold:true})+wr(SIG_LINE),{right:true,spacingBefore:360,spacingAfter:80});
  body+=c.signRows.map(r=>wlv(r[0],r[1],R)).join('');
  return body;
}


function certFileName(p){
  const n=fe(p+'_fullName').replace(/[\\/:*?"<>|]+/g,'').trim();
  const d=(fe(p+'_date')||nowDateStr()).replace(/\//g,'-');
  return 'BSA63-Part'+p+'-Certificate'+(n?'-'+n:'')+'-'+d;
}

/* ---------- in-page printing (no pop-up window; certificate = page 1, Annexure-I = page 2) ---------- */
function scopedPrintCss() { return CERT_PRINT_CSS.replace(/(^|})\s*([^@{}][^{}]*)\{/g, (m, b, sel) => b + sel.split(',').map(s => { s = s.trim(); return s === 'body' || s === 'html' || s === '*' ? (s === '*' ? '#hgPrint *' : '#hgPrint') : '#hgPrint ' + s; }).join(',') + '{').replace(/@page\{[^}]*\}/, ''); }
function fitPages(root) { root.querySelectorAll('.cert-page').forEach(pg => {
  let fs = parseFloat(getComputedStyle(pg).fontSize), n = 0; const t = pg.querySelector('table'); let ts = t ? parseFloat(getComputedStyle(t).fontSize) : 0;
  while (pg.scrollHeight > pg.clientHeight + 2 && n < 90) { n++; if (t && ts > 6.5) { ts -= 0.25; t.style.fontSize = ts + 'px'; t.querySelectorAll('td.mono').forEach(c => c.style.fontSize = (ts - 0.5) + 'px'); } else if (fs > 10) { fs -= 0.25; pg.style.fontSize = fs + 'px'; } else break; }
  if (pg.scrollHeight > pg.clientHeight + 2) pg.style.height = 'auto'; }); }
async function hgPrint(title, innerHtml, pdf) {
  ensureMeera(); let root = document.getElementById('hgPrint'); if (!root) { root = document.createElement('div'); root.id = 'hgPrint'; document.body.appendChild(root); }
  let st = document.getElementById('hgPrintCss'); if (!st) { st = document.createElement('style'); st.id = 'hgPrintCss'; st.textContent = '@media print{@page{size:A4 portrait;margin:0}}' + scopedPrintCss() + '#hgPrint .cert-page{margin:0!important;max-width:none!important;border-radius:0!important;box-shadow:none!important;background:#fff;font-size:inherit;line-height:inherit;font-family:inherit;color:#111;box-sizing:border-box}#hgPrint .lang-ml,#hgPrint .lang-ml *{font-family:"Meera","Times New Roman",serif}#hgPrint td.mono{font-family:Consolas,"Courier New",monospace!important}'; document.head.appendChild(st); }
  root.innerHTML = innerHtml; try { await document.fonts.load('16px Meera'); await document.fonts.ready; } catch { }
  fitPages(root); const old = document.title; document.title = title; document.body.classList.add('hg-printing');
  if (pdf) toast('In the print window choose “Save as PDF” · Paper A4 · Margins None · Scale 100%', 'ok', 6000);
  const done = () => { document.body.classList.remove('hg-printing'); document.title = old; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done); setTimeout(() => window.print(), 150);
}
/* ---------- view ---------- */
const SRC = [['computer', 'Computer/Storage Media'], ['dvr', 'DVR'], ['mobile', 'Mobile'], ['flashdrive', 'Flash Drive'], ['cddvd', 'CD/DVD'], ['server', 'Server'], ['cloud', 'Cloud'], ['other', 'Other']];
const OWN = [['owned', 'Owned'], ['maintained', 'Maintained'], ['managed', 'Managed'], ['operated', 'Operated by me']];
const inp = (id, k, extra = '') => `<div><label class="f"><span class="lbl" data-k="${k}">${esc(CL.en[k] || k)}</span><input type="text" id="${id}" ${extra}></label></div>`;
function partForm(p) {
  const rel = `<div><label class="f"><span class="lbl" data-k="relation">Relation</span><select id="${p}_relation">${[['son', 'relSon'], ['daughter', 'relDaughter'], ['wife', 'relWife'], ['husband', 'relHusband']].map(([v, k]) => `<option value="${v}" class="lbl" data-k="${k}">${esc(CL.en[k])}</option>`).join('')}</select></label></div>`;
  return `<div class="card hg-form" id="hgForm${p}" ${HG.part === p ? '' : 'hidden'}><h3 class="lbl" data-k="${p === 'A' ? 'partATitle' : 'partBTitle'}">${esc(CL.en[p === 'A' ? 'partATitle' : 'partBTitle'])}</h3>
    <div class="grid g4">${inp(p + '_fullName', p === 'A' ? 'fullName' : 'expertFullName')}${rel}${inp(p + '_parentSpouse', 'relName')}${inp(p + '_age', 'age')}</div>
    <div class="grid g2" style="margin-top:10px">${inp(p + '_addr', p === 'A' ? 'fullAddr' : 'orgAddr')}${p === 'B' ? inp('B_designation', 'designation') : ''}</div>
    <div style="margin-top:12px"><div class="small dim lbl" data-k="sourceTick">${esc(CL.en.sourceTick)}</div><div class="hg-checks">${SRC.map(([k, t]) => `<label><input type="checkbox" id="${p}_src_${k}"> ${t}</label>`).join('')}</div><input type="text" id="${p}_otherSourceText" placeholder="If Other, specify" style="margin-top:6px;max-width:420px"></div>
    <div class="grid g4" style="margin-top:12px">${inp(p + '_makeModel', 'makeModel')}${inp(p + '_color', 'color')}${inp(p + '_serial', 'serial')}${inp(p + '_imeiId', 'imeiId')}</div>
    <div style="margin-top:10px">${inp(p + '_otherInfo', 'otherInfo')}</div>
    ${p === 'A' ? `<div style="margin-top:12px"><div class="small dim lbl" data-k="ownership">${esc(CL.en.ownership)}</div><div class="hg-checks">${OWN.map(([k, t]) => `<label><input type="checkbox" id="A_own_${k}"> ${t}</label>`).join('')}</div></div>` : ''}
    <div class="grid g4" style="margin-top:12px"><div><label class="f"><span class="lbl" data-k="hashAlgo">${esc(CL.en.hashAlgo)}</span><select id="${p}_hashAlgo"></select></label></div>${inp(p + '_date', 'date', 'placeholder="today if blank"')}${inp(p + '_time', 'time', 'placeholder="now if blank"')}${inp(p + '_place', 'place')}</div>
    <div class="row" style="margin-top:14px"><button class="btn-p" data-gen="${p}"><span class="lbl" data-k="gen${p}">${esc(CL.en['gen' + p])}</span></button></div></div>
    <div class="card hg-prev" id="hgPrev${p}" ${HG.out[p] && HG.part === p ? '' : 'hidden'}><div class="row sb"><h3 style="margin:0">Part-${p} — preview (page 1 certificate · page 2 Annexure-I)</h3><div class="row"><button class="btn-p" data-print="${p}">🖨 Print</button><button data-pdf="${p}">⇩ PDF</button><button data-docx="${p}">⇩ Word (.docx)</button></div></div><div class="certbox" id="certOutput${p}">${HG.out[p]}</div></div>`;
}
function saveForm(el) { $$('input,select', el).forEach(i => { if (!i.id || i.type === 'file' || i.id.startsWith('algo_')) return; HG.form[i.id] = i.type === 'checkbox' ? i.checked : i.value; }); }
function loadForm(el) { $$('input,select', el).forEach(i => { if (!(i.id in HG.form)) return; if (i.type === 'checkbox') i.checked = HG.form[i.id]; else i.value = HG.form[i.id]; }); }
function applyLang(el) { const d = CL[HG.lang]; $$('.lbl[data-k]', el).forEach(x => { const k = x.dataset.k; if (d[k] !== undefined) x.textContent = d[k]; }); }
function refreshAlgoSelects(el) { ['A_hashAlgo', 'B_hashAlgo'].forEach(id => { const s = $('#' + id, el); if (!s) return; const cur = HG.form[id] || s.value; const list = HG.results.length ? HG.active : HG.algos; s.innerHTML = list.map(a => `<option ${ALGO_LABELS[a] === cur ? 'selected' : ''}>${ALGO_LABELS[a]}</option>`).join(''); }); }
VIEWS.hash = el => {
  ensureMeera();
  const res = HG.results; const A = HG.active;
  el.innerHTML = pageHead('Hash Generator', 'Hash values and BSA 2023 Section 63(4)(c) certificates with Annexure-I — computed in this browser; files never leave this computer.') +
    `<div class="tabs"><button class="${HG.tab === 'hash' ? 'on' : ''}" data-ht="hash">1 · Calculate hash values</button><button class="${HG.tab === 'cert' ? 'on' : ''}" data-ht="cert">2 · BSA 63(4)(c) certificate</button></div>
    <div id="hgHash" ${HG.tab === 'hash' ? '' : 'hidden'}>
      <div class="card"><h3>Hash types to generate</h3><p class="small dim" style="margin:0 0 8px">Only the ticked types are calculated and printed in Annexure-I.</p>
        <div class="hg-algos">${Object.entries(ALGO_LABELS).map(([k, t]) => `<label class="${HG.algos.includes(k) ? 'on' : ''}"><input type="checkbox" id="algo_${k}" ${HG.algos.includes(k) ? 'checked' : ''}> ${t}</label>`).join('')}</div></div>
      <div class="card"><h3>Evidence files</h3><div class="drop" id="hgDrop"><div class="ic">⇪</div><b>Drop evidence file(s) here or click to choose</b><div class="small muted">Calculated locally — nothing is uploaded</div></div>
        <input type="file" id="hgFiles" multiple hidden><input type="file" id="hgFolder" webkitdirectory multiple hidden>
        <div class="row" style="margin-top:10px"><button id="hgPickF">Select file(s)</button><button id="hgPickD">Select folder</button><button class="btn-g" id="hgClear" ${res.length ? '' : 'disabled'}>Clear</button></div>
        <div id="hgProg" class="small" style="margin-top:8px"></div></div>
      <div class="card"><div class="row sb"><h3 style="margin:0">Annexure-I — hash value table</h3><div class="row"><button class="btn-sm" id="hgCopy" ${res.length ? '' : 'disabled'}>⧉ Copy table</button><button class="btn-sm" id="hgCsv" ${res.length ? '' : 'disabled'}>⇩ Excel register (CSV)</button><button class="btn-sm" id="hgDoc" ${res.length ? '' : 'disabled'}>⇩ Word</button><button class="btn-sm" id="hgPrintX" ${res.length ? '' : 'disabled'}>🖨 Print</button></div></div>
        ${res.length ? `<div class="tbl-wrap" style="margin-top:10px"><table class="tbl hg-tbl"><thead><tr><th>#</th><th>File name</th><th>Size</th>${A.map(a => `<th>${ALGO_LABELS[a]}</th>`).join('')}</tr></thead><tbody>${res.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.name)}</td><td class="nowrap">${fmtSize(r.size)}</td>${A.map(a => `<td class="mono hg-h">${r[a]} <a href="#" data-cp="${r[a]}" title="Copy">⧉</a></td>`).join('')}</tr>`).join('')}</tbody></table></div>` : `<div class="dim small" style="margin-top:8px">No files hashed yet.</div>`}
        <p class="small dim" style="margin:10px 0 0">Very large disk images (several GB) depend on this computer's memory; files of a few hundred MB to about 2 GB work comfortably.</p></div>
    </div>
    <div id="hgCert" ${HG.tab === 'cert' ? '' : 'hidden'}>
      <div class="card"><div class="row" style="flex-wrap:wrap;gap:16px"><div><div class="small dim">Certificate language (the whole certificate and Annexure-I)</div><div class="row" style="margin-top:4px"><button class="${HG.lang === 'en' ? 'btn-p' : ''}" data-lang="en">English</button><button class="${HG.lang === 'ml' ? 'btn-p' : ''}" data-lang="ml">മലയാളം</button></div></div>
        <div><div class="small dim">Certificate</div><div class="row" style="margin-top:4px"><button class="${HG.part === 'A' ? 'btn-p' : ''}" data-part="A">Part-A · by the party</button><button class="${HG.part === 'B' ? 'btn-p' : ''}" data-part="B">Part-B · by the expert</button></div></div></div>
        ${res.length ? `<p class="small" style="margin:10px 0 0">Annexure-I will list <b>${res.length}</b> file(s) with ${A.map(a => ALGO_LABELS[a]).join(', ')}.</p>` : `<p class="small" style="margin:10px 0 0;color:var(--amber)">No hash values yet — calculate them in step 1 first; Annexure-I will be empty otherwise.</p>`}</div>
      ${partForm('A')}${partForm('B')}
      <p class="small dim">Recreates the standard Part-A / Part-B format under Section 63(4)(c), BSA 2023. Verify the wording against the format prescribed in your jurisdiction before filing.</p>
    </div>`;
  loadForm(el); applyLang(el); refreshAlgoSelects(el);
  $$('[data-ht]', el).forEach(b => b.onclick = () => { saveForm(el); HG.tab = b.dataset.ht; go('hash'); });
  $$('.hg-algos input', el).forEach(c => c.onchange = () => { HG.algos = Object.keys(ALGO_LABELS).filter(k => $('#algo_' + k, el).checked); c.parentElement.classList.toggle('on', c.checked); });
  const run = async list => { list = Array.from(list || []); if (!list.length) return; if (HG.busy) return toast('Please wait — hashing in progress', 'warn');
    if (!HG.algos.length) return toast('Tick at least one hash type first', 'warn');
    HG.busy = true; HG.active = HG.algos.slice(); const out = []; const pr = $('#hgProg', el);
    try { for (let i = 0; i < list.length; i++) { const f = list[i]; const lab = t => pr.innerHTML = `<div class="spin" style="display:inline-block;width:14px;height:14px;vertical-align:-2px"></div> Hashing ${i + 1} / ${list.length} — ${esc(f.name)} ${t || ''}`; lab();
        const buf = await f.arrayBuffer(); const e = { name: f.webkitRelativePath || f.name, size: f.size };
        const jobs = []; if (HG.active.includes('sha1')) jobs.push(shaHex('SHA-1', buf).then(v => e.sha1 = v)); if (HG.active.includes('sha256')) jobs.push(shaHex('SHA-256', buf).then(v => e.sha256 = v)); if (HG.active.includes('sha512')) jobs.push(shaHex('SHA-512', buf).then(v => e.sha512 = v));
        if (HG.active.includes('md5')) e.md5 = await md5Hex(new Uint8Array(buf), p => lab(`(MD5 ${Math.round(p * 100)}%)`));
        await Promise.all(jobs); out.push(e); }
      HG.results = out; if (S.cur) audit('Hash values generated', out.map(r => `${r.name} (${r.size} B) ` + HG.active.map(a => ALGO_LABELS[a] + ' ' + r[a]).join(' ')).join(' | ').slice(0, 580));
    } catch (er) { toast('Could not read a file: ' + er.message, 'err'); } finally { HG.busy = false; }
    go('hash'); };
  const fi = $('#hgFiles', el), fd = $('#hgFolder', el), dz = $('#hgDrop', el);
  dz.onclick = () => fi.click(); $('#hgPickF', el).onclick = () => fi.click(); $('#hgPickD', el).onclick = () => fd.click();
  fi.onchange = () => run(fi.files); fd.onchange = () => run(fd.files);
  dz.ondragover = e => { e.preventDefault(); dz.classList.add('hover'); }; dz.ondragleave = () => dz.classList.remove('hover'); dz.ondrop = e => { e.preventDefault(); dz.classList.remove('hover'); run(e.dataTransfer.files); };
  $('#hgClear', el).onclick = () => { HG.results = []; HG.out = { A: '', B: '' }; go('hash'); };
  $$('[data-cp]', el).forEach(a => a.onclick = ev => { ev.preventDefault(); copyText(a.dataset.cp, 'Hash value'); });
  $('#hgCopy', el).onclick = () => copyText(['#\tFile name\tSize (bytes)\t' + HG.active.map(a => ALGO_LABELS[a]).join('\t')].concat(HG.results.map((r, i) => [i + 1, r.name, r.size].concat(HG.active.map(a => r[a])).join('\t'))).join('\n'), 'Hash table');
  $('#hgCsv', el).onclick = () => { const q = v => '"' + String(v).replace(/"/g, '""') + '"'; const csv = ['#', 'File Name', 'Size (bytes)'].concat(HG.active.map(a => ALGO_LABELS[a])).map(q).join(',') + '\n' + HG.results.map((r, i) => [i + 1, safeCell ? safeCell(r.name) : r.name, r.size].concat(HG.active.map(a => r[a])).map(q).join(',')).join('\n'); downloadBlob(new Blob(['﻿' + csv], { type: 'text/csv' }), 'SixthSense-HashRegister.csv'); };
  $('#hgDoc', el).onclick = () => { DOCX_LINE = 300; DOCX_JC = 'both'; DOCX_SZ = 24; let body = wp('SIXTH SENSE — Hash Generator', { bold: true, size: 28, center: true, spacingAfter: 40 }) + wp('Annexure-I', { bold: true, size: 26, center: true, spacingAfter: 160 }) + annexDocxTable('en'); generateDocx(body, 'SixthSense-Annexure-I.docx', false); };
  $('#hgPrintX', el).onclick = () => hgPrint('Annexure-I', '<div class="cert-page annex-page first lang-en"><div class="annex-title">Annexure-I</div><div class="cert-partsub">Hash Value Table</div>' + annexureTableHtml('en') + '</div>');
  $$('[data-lang]', el).forEach(b => b.onclick = () => { saveForm(el); HG.lang = b.dataset.lang; HG.out = { A: '', B: '' }; go('hash'); });
  $$('[data-part]', el).forEach(b => b.onclick = () => { saveForm(el); HG.part = b.dataset.part; go('hash'); });
  $$('input,select', $('#hgCert', el)).forEach(i => i.addEventListener('change', () => saveForm(el)));
  $$('[data-gen]', el).forEach(b => b.onclick = () => { const p = b.dataset.gen; saveForm(el); HG.out[p] = buildCertHtml(p); const box = $('#certOutput' + p, el); box.innerHTML = HG.out[p]; $('#hgPrev' + p, el).hidden = false; $('#hgPrev' + p, el).scrollIntoView({ behavior: 'smooth' }); if (S.cur) audit('BSA 63(4)(c) certificate generated', 'Part-' + p + ' · ' + (HG.lang === 'ml' ? 'Malayalam' : 'English')); });
  $$('[data-print]', el).forEach(b => b.onclick = () => hgPrint(certFileName(b.dataset.print), HG.out[b.dataset.print]));
  $$('[data-pdf]', el).forEach(b => b.onclick = () => hgPrint(certFileName(b.dataset.pdf), HG.out[b.dataset.pdf], true));
  $$('[data-docx]', el).forEach(b => b.onclick = () => generateDocx(buildCertDocxBody(b.dataset.docx), certFileName(b.dataset.docx) + '.docx', false));
};
})();
