/* ============================ NODAL OFFICERS DIRECTORY ============================
   Source: the station's master list (encrypted file data/nodal-ref.enc, same key as the ATM reference,
   given only to approved officers) + a few contacts published on providers' own websites that were
   missing from the list + contacts the officer adds (stored encrypted in the vault).
   Copy-to-clipboard only — no export.                                                              */
const NCAT = { BANK: ['Banks', '#00e5ff'], PAY: ['Payments · Wallets · PG', '#00ff9d'], TEL: ['Telecom · ISP', '#ffb300'], SOC: ['Social media · Messaging', '#ff5aa5'], ECOM: ['E-commerce · Travel · Services', '#b388ff'], TECH: ['Email · Cloud · Tech', '#60a5fa'], DOM: ['Registrars · Hosting', '#9ccc65'], CRYPTO: ['Crypto exchanges', '#ffd54f'], GOV: ['Government · Regulators', '#90caf9'], POL: ['Police cyber nodal', '#ff8a65'], OTH: ['Other', '#8fb3c9'] };
/* [stems (email domain without TLD), name, category, sub-type, IFSC prefix, aliases] */
const NODAL_ORGS = [
  ['sbi|sbbj|sbhyd|statebank', 'State Bank of India', 'BANK', 'Public sector bank', 'SBIN', 'SBI; State Bank of Bikaner & Jaipur (merged)'],
  ['bankofbaroda|bobfinancial|vijayabank|denabank|barodarajasthanrrb|barodagujaratrrb', 'Bank of Baroda', 'BANK', 'Public sector bank', 'BARB', 'BOB; Vijaya Bank (merged); Dena Bank (merged)'],
  ['pnb|obc|unitedbank', 'Punjab National Bank', 'BANK', 'Public sector bank', 'PUNB', 'PNB; Oriental Bank of Commerce (merged); United Bank of India (merged)'],
  ['canarabank|syndicatebank', 'Canara Bank', 'BANK', 'Public sector bank', 'CNRB', 'Syndicate Bank (merged)'],
  ['unionbankofindia|andhrabank|corpbank|ubisl', 'Union Bank of India', 'BANK', 'Public sector bank', 'UBIN', 'Andhra Bank (merged); Corporation Bank (merged)'],
  ['bankofindia', 'Bank of India', 'BANK', 'Public sector bank', 'BKID', 'BOI'],
  ['indianbank|allahabadbank', 'Indian Bank', 'BANK', 'Public sector bank', 'IDIB', 'Allahabad Bank (merged)'],
  ['centralbank', 'Central Bank of India', 'BANK', 'Public sector bank', 'CBIN', 'CBI'],
  ['iobnet|iob', 'Indian Overseas Bank', 'BANK', 'Public sector bank', 'IOBA', 'IOB'],
  ['ucobank|uco', 'UCO Bank', 'BANK', 'Public sector bank', 'UCBA', ''],
  ['mahabank', 'Bank of Maharashtra', 'BANK', 'Public sector bank', 'MAHB', 'Mahabank'],
  ['psb', 'Punjab & Sind Bank', 'BANK', 'Public sector bank', 'PSIB', 'PSB'],
  ['hdfcbank|hdfc', 'HDFC Bank', 'BANK', 'Private bank', 'HDFC', ''],
  ['icicibank|icici', 'ICICI Bank', 'BANK', 'Private bank', 'ICIC', ''],
  ['axisbank|axis|axismf', 'Axis Bank', 'BANK', 'Private bank', 'UTIB', 'Citibank India retail (moved to Axis)'],
  ['kotak', 'Kotak Mahindra Bank', 'BANK', 'Private bank', 'KKBK', 'Kotak'],
  ['indusind', 'IndusInd Bank', 'BANK', 'Private bank', 'INDB', ''],
  ['yesbank|yes', 'YES Bank', 'BANK', 'Private bank', 'YESB', ''],
  ['idfcfirstbank|idfcbank|idfcfirst', 'IDFC FIRST Bank', 'BANK', 'Private bank', 'IDFB', 'IDFC Bank'],
  ['federalbank|federal', 'Federal Bank', 'BANK', 'Private bank', 'FDRL', ''],
  ['sib|southindianbank', 'South Indian Bank', 'BANK', 'Private bank', 'SIBL', 'SIB'],
  ['csb', 'CSB Bank', 'BANK', 'Private bank', 'CSBK', 'Catholic Syrian Bank'],
  ['dhanbank|dhanlaxmibank', 'Dhanlaxmi Bank', 'BANK', 'Private bank', 'DLXB', ''],
  ['kvbmail|kvb', 'Karur Vysya Bank', 'BANK', 'Private bank', 'KVBL', 'KVB'],
  ['cityunionbank', 'City Union Bank', 'BANK', 'Private bank', 'CIUB', 'CUB'],
  ['tmbank', 'Tamilnad Mercantile Bank', 'BANK', 'Private bank', 'TMBL', 'TMB'],
  ['ktkbank', 'Karnataka Bank', 'BANK', 'Private bank', 'KARB', ''],
  ['rblbank|rbl', 'RBL Bank', 'BANK', 'Private bank', 'RATN', 'Ratnakar Bank'],
  ['bandhanbank', 'Bandhan Bank', 'BANK', 'Private bank', 'BDBL', ''],
  ['idbi|ext-idbi', 'IDBI Bank', 'BANK', 'Private bank', 'IBKL', ''],
  ['dcbbank', 'DCB Bank', 'BANK', 'Private bank', 'DCBL', ''],
  ['jkbmail|jkbank', 'Jammu & Kashmir Bank', 'BANK', 'Private bank', 'JAKA', 'J&K Bank'],
  ['nainitalbank', 'Nainital Bank', 'BANK', 'Private bank', 'NTBL', ''],
  ['lvbank', 'DBS Bank India (erstwhile Lakshmi Vilas Bank)', 'BANK', 'Foreign bank', 'DBSS', 'Lakshmi Vilas Bank; LVB'],
  ['aubank|fincarebank', 'AU Small Finance Bank', 'BANK', 'Small finance bank', 'AUBL', 'AU Bank; Fincare SFB (merged)'],
  ['equitasbank', 'Equitas Small Finance Bank', 'BANK', 'Small finance bank', 'ESFB', ''],
  ['ujjivan', 'Ujjivan Small Finance Bank', 'BANK', 'Small finance bank', 'UJVN', ''],
  ['janabank', 'Jana Small Finance Bank', 'BANK', 'Small finance bank', 'JSFB', ''],
  ['suryodaybank', 'Suryoday Small Finance Bank', 'BANK', 'Small finance bank', 'SURY', ''],
  ['esafbank', 'ESAF Small Finance Bank', 'BANK', 'Small finance bank', 'ESMF', 'ESAF'],
  ['utkarsh', 'Utkarsh Small Finance Bank', 'BANK', 'Small finance bank', 'UTKS', ''],
  ['capitalbank', 'Capital Small Finance Bank', 'BANK', 'Small finance bank', 'CLBL', ''],
  ['nesfb|slicebank', 'slice Small Finance Bank (erstwhile North East SFB)', 'BANK', 'Small finance bank', 'NESF', 'North East Small Finance Bank'],
  ['shivalikbank', 'Shivalik Small Finance Bank', 'BANK', 'Small finance bank', 'SMCB', ''],
  ['unitybank', 'Unity Small Finance Bank', 'BANK', 'Small finance bank', 'UNBA', 'PMC Bank (taken over)'],
  ['airtelbank', 'Airtel Payments Bank', 'BANK', 'Payments bank', 'AIRP', ''],
  ['ippbonline', 'India Post Payments Bank', 'BANK', 'Payments bank', 'IPOS', 'IPPB'],
  ['finobank|fino', 'Fino Payments Bank', 'BANK', 'Payments bank', 'FINO', ''],
  ['jiobank|jiopaymentsbank', 'Jio Payments Bank', 'BANK', 'Payments bank', 'JIOP', ''],
  ['nsdlbank', 'NSDL Payments Bank', 'BANK', 'Payments bank', 'NSPB', ''],
  ['paytmbank', 'Paytm Payments Bank', 'BANK', 'Payments bank', 'PYTM', 'PPBL'],
  ['hsbc|noexternalmail', 'HSBC', 'BANK', 'Foreign bank', 'HSBC', ''],
  ['sc', 'Standard Chartered Bank', 'BANK', 'Foreign bank', 'SCBL', 'StanChart'],
  ['citi', 'Citibank', 'BANK', 'Foreign bank', 'CITI', 'Citi'],
  ['dbs', 'DBS Bank India', 'BANK', 'Foreign bank', 'DBSS', ''],
  ['db', 'Deutsche Bank', 'BANK', 'Foreign bank', 'DEUT', ''],
  ['sbmbank', 'SBM Bank (India)', 'BANK', 'Foreign bank', 'STCB', ''],
  ['hanafn', 'KEB Hana Bank', 'BANK', 'Foreign bank', 'KOEX', ''],
  ['ibk', 'Industrial Bank of Korea', 'BANK', 'Foreign bank', 'IBKO', ''],
  ['shinhan', 'Shinhan Bank', 'BANK', 'Foreign bank', 'SHBK', ''],
  ['mufg', 'MUFG Bank', 'BANK', 'Foreign bank', 'BOTM', ''],
  ['ca-cib', 'Credit Agricole CIB', 'BANK', 'Foreign bank', 'CRLY', ''],
  ['dohabank', 'Doha Bank', 'BANK', 'Foreign bank', 'DOHB', ''],
  ['keralagbank|keralagramin', 'Kerala Gramin Bank', 'BANK', 'Regional rural bank', 'KLGB', 'Kerala Grameena Bank'],
  ['keralabank', 'Kerala Bank (Kerala State Co-operative Bank)', 'BANK', 'Co-operative bank', 'KSBK', 'KSCB'],
  ['kgbk', 'Karnataka Gramin Bank', 'BANK', 'Regional rural bank', 'PKGB', ''],
  ['apgb', 'Andhra Pradesh Grameena Vikas Bank', 'BANK', 'Regional rural bank', 'APGV', 'APGVB'],
  ['mahagramin', 'Maharashtra Gramin Bank', 'BANK', 'Regional rural bank', 'MAHG', ''],
  ['tngb', 'Tamil Nadu Grama Bank', 'BANK', 'Regional rural bank', 'IDIB', ''],
  ['saraswatbank', 'Saraswat Co-operative Bank', 'BANK', 'Co-operative bank', 'SRCB', ''],
  ['cosmosbank', 'Cosmos Co-operative Bank', 'BANK', 'Co-operative bank', 'COSB', ''],
  ['tjsb', 'TJSB Sahakari Bank', 'BANK', 'Co-operative bank', 'TJSB', ''],
  ['svcbank', 'SVC Co-operative Bank', 'BANK', 'Co-operative bank', 'SVCB', ''],
  ['sbicard', 'SBI Card', 'BANK', 'Card issuer', '', 'SBI Cards & Payment Services'],
  ['bobcard|bobcards', 'BOB Card (BOBCARD Ltd)', 'BANK', 'Card issuer', '', 'BOB Financial'],
  ['aexp', 'American Express', 'BANK', 'Card issuer', '', 'Amex'],
  ['bajajfinserv', 'Bajaj Finance / Bajaj Finserv', 'BANK', 'NBFC', '', ''],
  ['manappuram', 'Manappuram Finance', 'BANK', 'NBFC', '', ''],
  ['homecredit', 'Home Credit India', 'BANK', 'NBFC', '', ''],
  ['krazybee', 'KrazyBee (KreditBee)', 'BANK', 'NBFC', '', 'KreditBee'],
  ['npci', 'NPCI (National Payments Corporation of India)', 'PAY', 'UPI / RuPay network', '', 'UPI; BHIM; RuPay'],
  ['phonepe', 'PhonePe', 'PAY', 'UPI app / wallet / PG', '', '@ybl; @ibl; @axl'],
  ['paytm|paytmpayments|ppsltp|ocltp', 'Paytm (One97 Communications / Paytm Payments Services)', 'PAY', 'UPI app / wallet / PG', '', '@paytm; @ptyes; @ptaxis; @pthdfc; @ptsbi; PPSL'],
  ['mobikwik', 'MobiKwik', 'PAY', 'Wallet / UPI', '', '@ikwik'],
  ['freecharge', 'Freecharge', 'PAY', 'Wallet / UPI', '', '@freecharge'],
  ['billdesk', 'BillDesk', 'PAY', 'Payment gateway', '', ''],
  ['payu', 'PayU India', 'PAY', 'Payment gateway', '', ''],
  ['razorpay', 'Razorpay', 'PAY', 'Payment gateway', '', ''],
  ['cashfree|gocashfree', 'Cashfree Payments', 'PAY', 'Payment gateway', '', ''],
  ['bharatpe', 'BharatPe', 'PAY', 'UPI / merchant payments', '', ''],
  ['pinelabs', 'Pine Labs', 'PAY', 'POS / payment gateway', '', ''],
  ['airpay', 'Airpay', 'PAY', 'Payment gateway', '', ''],
  ['easebuzz', 'Easebuzz', 'PAY', 'Payment gateway', '', ''],
  ['zaakpay', 'Zaakpay', 'PAY', 'Payment gateway', '', ''],
  ['avenues|ccavenue', 'CCAvenue (Infibeam Avenues)', 'PAY', 'Payment gateway', '', ''],
  ['atomtech', 'Atom Technologies', 'PAY', 'Payment gateway', '', ''],
  ['jiopay', 'JioPay', 'PAY', 'Payment gateway / wallet', '', 'Jio Money'],
  ['navi', 'Navi', 'PAY', 'UPI app / lender', '', ''],
  ['sliceit', 'slice', 'PAY', 'Card / UPI app', '', ''],
  ['transerv|udio', 'Transerv (Udio)', 'PAY', 'Wallet / prepaid', '', ''],
  ['qwikcilver', 'Qwikcilver (Pine Labs)', 'PAY', 'Gift cards / prepaid', '', ''],
  ['itzcash', 'ItzCash', 'PAY', 'Prepaid / wallet', '', ''],
  ['spicemoney|spicedigital', 'Spice Money', 'PAY', 'AEPS / BC network', '', ''],
  ['payworldindia', 'PayWorld', 'PAY', 'Retail payments', '', ''],
  ['rechargeitnow', 'RechargeItNow', 'PAY', 'Recharge / bill payments', '', ''],
  ['paypal', 'PayPal', 'PAY', 'Payment gateway', '', ''],
  ['firstdata', 'First Data / Fiserv', 'PAY', 'Card processing', '', ''],
  ['wazirx', 'WazirX (Zanmai Labs)', 'CRYPTO', 'Crypto exchange', '', ''], ['coindcx', 'CoinDCX', 'CRYPTO', 'Crypto exchange', '', ''], ['coinswitch', 'CoinSwitch', 'CRYPTO', 'Crypto exchange', '', ''], ['zebpay', 'ZebPay', 'CRYPTO', 'Crypto exchange', '', ''], ['binance', 'Binance', 'CRYPTO', 'Crypto exchange', '', ''], ['mudrex', 'Mudrex', 'CRYPTO', 'Crypto exchange', '', ''], ['giottus', 'Giottus', 'CRYPTO', 'Crypto exchange', '', ''], ['bitbns', 'Bitbns', 'CRYPTO', 'Crypto exchange', '', ''],
  ['airtel', 'Bharti Airtel', 'TEL', 'Mobile / broadband', '', 'Airtel'],
  ['ril|jio', 'Reliance Jio Infocomm', 'TEL', 'Mobile / broadband', '', 'Jio; JioFiber; Reliance Industries'],
  ['vodafoneidea|vodafone|adityabirla|idea', 'Vodafone Idea (Vi)', 'TEL', 'Mobile operator', '', 'Vi; Vodafone; Idea'],
  ['bsnl', 'BSNL', 'TEL', 'Mobile / broadband', '', 'Bharat Sanchar Nigam'],
  ['mtnl', 'MTNL', 'TEL', 'Mobile / broadband', '', ''],
  ['tikona', 'Tikona Infinet', 'TEL', 'ISP', '', ''], ['tatatel|tatatele', 'Tata Teleservices', 'TEL', 'Telecom', '', 'Tata Docomo'], ['aircel', 'Aircel (closed)', 'TEL', 'Mobile operator', '', ''], ['uninor', 'Uninor / Telenor (closed)', 'TEL', 'Mobile operator', '', ''], ['relianceada|rcom', 'Reliance Communications', 'TEL', 'Telecom', '', 'RCom'], ['videocon', 'Videocon Telecom', 'TEL', 'Telecom', '', ''], ['sifycorp|sify', 'Sify Technologies', 'TEL', 'ISP / data centre', '', ''], ['denonline', 'DEN Networks', 'TEL', 'Cable / ISP', '', ''], ['actcorp', 'ACT Fibernet', 'TEL', 'ISP', '', ''], ['hathway', 'Hathway', 'TEL', 'ISP', '', ''], ['asianet', 'Asianet Broadband', 'TEL', 'ISP', '', ''],
  ['google|xwf', 'Google (Gmail · YouTube · Google Pay)', 'SOC', 'Tech platform', '', 'Gmail; YouTube; Google Pay; GPay; @okaxis; @okhdfcbank; @okicici; @oksbi'],
  ['fb|facebook|meta|instagram', 'Meta (Facebook · Instagram)', 'SOC', 'Social media', '', 'Facebook; Instagram'],
  ['whatsapp', 'WhatsApp', 'SOC', 'Messaging', '', ''], ['microsoft|outlook|hotmail|skype', 'Microsoft', 'TECH', 'Email / cloud', '', 'Outlook; Hotmail; Skype'], ['yahoo-inc', 'Yahoo', 'TECH', 'Email', '', ''], ['nimbuzz', 'Nimbuzz', 'SOC', 'Messaging', '', ''], ['twitter|x', 'X (Twitter)', 'SOC', 'Social media', '', 'Twitter'], ['sharechat', 'ShareChat / Moj', 'SOC', 'Social media', '', ''], ['snapchat|snap', 'Snapchat', 'SOC', 'Social media', '', ''], ['telegram', 'Telegram', 'SOC', 'Messaging', '', ''], ['linkedin', 'LinkedIn', 'SOC', 'Social media', '', ''], ['truecaller', 'Truecaller', 'SOC', 'Caller ID app', '', ''],
  ['amazon', 'Amazon (Amazon.in · Amazon Pay)', 'ECOM', 'E-commerce / wallet', '', 'Amazon Pay; @apl'], ['flipkart', 'Flipkart', 'ECOM', 'E-commerce', '', ''], ['myntra', 'Myntra', 'ECOM', 'E-commerce', '', ''], ['bigbasket', 'BigBasket', 'ECOM', 'E-commerce', '', ''], ['snapdeal', 'Snapdeal', 'ECOM', 'E-commerce', '', ''], ['shopclues', 'ShopClues', 'ECOM', 'E-commerce', '', ''], ['ebay', 'eBay', 'ECOM', 'E-commerce', '', ''], ['grofers|blinkit', 'Blinkit (Grofers)', 'ECOM', 'E-commerce', '', ''], ['olacabs|ola', 'Ola', 'ECOM', 'Mobility', '', ''], ['uber', 'Uber', 'ECOM', 'Mobility', '', ''], ['bookmyshow', 'BookMyShow', 'ECOM', 'Ticketing', '', ''], ['irctc', 'IRCTC', 'ECOM', 'Travel / ticketing', '', ''], ['makemytrip', 'MakeMyTrip', 'ECOM', 'Travel', '', ''], ['goibibo', 'Goibibo', 'ECOM', 'Travel', '', ''], ['oyorooms|oyo', 'OYO', 'ECOM', 'Travel', '', ''], ['cleartrip', 'Cleartrip', 'ECOM', 'Travel', '', ''], ['justdial', 'Justdial', 'ECOM', 'Listings', '', ''], ['magicbricks', 'Magicbricks', 'ECOM', 'Classifieds', '', ''], ['indriver', 'inDrive', 'ECOM', 'Mobility', '', ''], ['olx', 'OLX India', 'ECOM', 'Classifieds', '', ''], ['meesho', 'Meesho', 'ECOM', 'E-commerce', '', ''], ['swiggy', 'Swiggy', 'ECOM', 'Food delivery', '', ''], ['zomato', 'Zomato', 'ECOM', 'Food delivery', '', ''], ['khatabook', 'Khatabook', 'PAY', 'Merchant app', '', ''],
  ['godaddy', 'GoDaddy', 'DOM', 'Registrar / hosting', '', ''], ['publicdomainregistry', 'PublicDomainRegistry (PDR)', 'DOM', 'Registrar', '', ''], ['hostinger', 'Hostinger', 'DOM', 'Hosting', '', ''], ['cloudflare', 'Cloudflare', 'DOM', 'CDN / DNS', '', ''],
];
const NODAL_GENERIC = /^(gmail|googlemail|yahoo|ymail|rediffmail|rediff|hotmail|outlook|live|aol|protonmail|zoho|icloud)$/;
/* 1 = legal / statutory-notice / LEA mailbox, 2 = nodal / fraud / grievance mailbox, 0 = other */
function nodalTier(c) { const loc = String(c.email || '').split('@')[0]; const w = loc + ' ' + (c.who || '') + ' ' + (c.listed || '');
  if (/(^|[^a-z])(statutory|legal|lea|law|lawful|notices?|summons|subpoena|courts?|records|police|ncrp|lien|debit.?freeze|cyber.?cell|cybercrime|lesupport|leasupport|lerequest|le\.request|legalrequest)|lea(\d|[^a-z]|$)/i.test(w)) return 1;
  if (/nodal|pno|fraud|grievance|compliance|abuse|cyber|risk|vigilance|frm|dispute|chargeback/i.test(w)) return 2; return 0; }
const NODAL = {
  orgs: [], byId: new Map(), loaded: false, err: '', info: null, _p: null, user: [], flags: {},
  stemOf(dom) { let d = String(dom || '').toLowerCase().replace(/^(ext|ext-|in|mail|noexternalmail)\./, ''); if (/^noexternalmail\./.test(dom)) return 'noexternalmail'; d = d.replace(/\.(co|org|net|gov|nic|ac|bank|com)\.(in|au|kr|uk|jp)$|\.(com|in|co|bank|net|org|coop|ban|info|jp|io|app|ai)$/, ''); const p = d.split('.'); return p[p.length - 1]; },
  clean(t) { return String(t || '').replace(/^\[SHEET[^\]]*\]\s*/i, '').replace(/^\d{1,5}\s+/, '').replace(/\*{4,}/g, ' ').replace(/\b\d{2}-\d{2}-\d{4},?\s*\d{1,2}\s\d{2}\s\d{2}\s*(AM|PM)?/gi, ' ').replace(/\bN\/A\b|\bNot available\b/gi, ' ').replace(/\s+/g, ' ').trim(); },
  orgFromText(t) { if (!t) return ''; const dash = t.split(/\s+—\s+/); if (dash.length > 1) return dash[0].trim(); const m = t.slice(0, 110).match(/^(.*?\b(?:ltd|limited)\.?)(?=\s|$)/i) || t.match(/^(.*?\bbank\b)/i); return m ? m[1].replace(/[,.\s]+$/, '').trim() : ''; },
  yearOf(t, src) { const m = String(t + ' ' + src).match(/(20[12]\d)/g); return m ? Math.max(...m.map(Number)) : null; },
  catFromSheet(c) { c = String(c || ''); return /bank|nbfc/i.test(c) ? 'BANK' : /payment|wallet|fintech/i.test(c) ? 'PAY' : /telecom|isp|dot/i.test(c) ? 'TEL' : /social|messag/i.test(c) ? 'SOC' : /e-?commerce|merchant|travel/i.test(c) ? 'ECOM' : /email|cloud|tech/i.test(c) ? 'TECH' : /registrar|domain/i.test(c) ? 'DOM' : /police/i.test(c) ? 'POL' : /govern|law|cert|regulat/i.test(c) ? 'GOV' : 'OTH'; },
  build(doc) {
    const stem2 = new Map(); NODAL_ORGS.forEach((o, i) => o[0].split('|').forEach(s => stem2.set(s, i)));
    const orgs = new Map(); const get = (key, init) => { let o = orgs.get(key); if (!o) { o = Object.assign({ id: key, name: '', cat: 'OTH', sub: '', ifsc: '', aliases: [], domains: new Set(), contacts: [], names: {} }, init); orgs.set(key, o); } return o; };
    const lk = x => String(x || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/\b(the|ltd|limited|pvt|private|co|including.*)\b\.?/g, ' ').replace(/[^a-z0-9]/g, '');
    const lab = new Map(); NODAL_ORGS.forEach((d, i) => [d[1]].concat(d[5] ? d[5].split(/;\s*/) : []).forEach(n => { const k = lk(n); if (k.length > 3 && !lab.has(k)) lab.set(k, i); }));
    const fromDef = i => { const d = NODAL_ORGS[i]; return get('k' + i, { name: d[1], cat: d[2], sub: d[3], ifsc: d[4], aliases: d[5] ? d[5].split(/;\s*/) : [], known: true }); };
    for (const [cat, text, phone, email, src] of doc.rows) {
      const t = this.clean(text); const dom = (email.split('@')[1] || '').toLowerCase(); const stem = this.stemOf(dom); const c0 = this.orgFromText(t); const generic = /^(cfcfrms|gmail|yahoo|rediff(mail)?|hotmail|outlook|webmail|n\/?a|nodal officers?|not available)$/i.test(t); const cand = c0 || (!generic && t.length <= 70 && !/floor|road|nagar,|bhawan/i.test(t) ? t : '');
      let o;
      if (/police/i.test(cat)) { o = get('pol:' + (cand || t).toUpperCase(), { name: cand || t || dom, cat: 'POL', sub: 'State / district cyber nodal' }); }
      else if (stem2.has(stem) && !(stem === 'sc' && !/^sc\.com$/.test(dom)) && !(stem === 'db' && dom !== 'db.com') && !(stem === 'x' && dom !== 'x.com')) o = fromDef(stem2.get(stem));
      else if (/\.(gov|nic)\.in$|^nic\.in$|^gov\.in$/.test(dom) && !cand) o = get('gov:' + dom, { name: dom, cat: 'GOV', sub: 'Government' });
      else if ((NODAL_GENERIC.test(stem) || !dom) && cand && lab.has(lk(cand))) o = fromDef(lab.get(lk(cand)));
      else if (NODAL_GENERIC.test(stem) || !dom) { const nm = cand || 'Unidentified (webmail)'; o = get('n:' + nm.toUpperCase(), { name: nm, cat: this.catFromSheet(cat) }); }
      else { o = get('d:' + stem, { cat: this.catFromSheet(cat) }); if (cand) o.names[cand] = (o.names[cand] || 0) + 1; }
      if (dom) o.domains.add(dom);
      let who = c0 && t.toUpperCase().startsWith(c0.toUpperCase()) ? t.slice(c0.length).replace(/^[\s,.\-—]+/, '') : (cand ? '' : generic ? '' : t); const listed = cand && !generic ? cand : '';
      o.contacts.push({ who, listed, email, phone, src, year: this.yearOf(t, src), tags: [/CFCFRMS/i.test(t) ? 'CFCFRMS' : '', /\bLEA\b|law enforcement/i.test(t) ? 'LEA' : '', /nodal/i.test(t) ? 'Nodal' : '', /grievance/i.test(t) ? 'Grievance' : ''].filter(Boolean) });
    }
    for (const o of orgs.values()) {
      if (!o.name) { const best = Object.entries(o.names).sort((a, b) => b[1] - a[1])[0]; o.name = best ? best[0] : Array.from(o.domains)[0] || o.id; }
      if (o.cat === 'OTH' || o.cat === 'TECH') { if (/\bbank\b|co-?op|sahakari|gramin|grameena|dccb|credit society/i.test(o.name)) o.cat = 'BANK'; }
      if (o.cat === 'BANK' && !o.sub) o.sub = /co-?op|sahakari|urban|dccb|district central|nagari|janata|mahila/i.test(o.name + ' ' + Array.from(o.domains).join(' ')) ? 'Co-operative bank' : /gramin|grameena|rrb/i.test(o.name + ' ' + Array.from(o.domains).join(' ')) ? 'Regional rural bank' : 'Bank / NBFC';
      if (/wazirx|coindcx|coinswitch|zebpay|binance|mudrex|giottus|bitbns/i.test(o.name + Array.from(o.domains).join(' '))) o.cat = 'CRYPTO';
      delete o.names;
    }
    for (const [key, o] of Array.from(orgs.entries())) { if (o.known || key.startsWith('pol:')) continue; const i = lab.get(lk(o.name)); if (i == null) continue; const t = fromDef(i); t.contacts.push(...o.contacts); o.domains.forEach(d => t.domains.add(d)); orgs.delete(key); }
    /* Contacts published on providers' own websites — added only where the master list lacks them */
    const byName = new Map(); const nk = s => String(s || '').toLowerCase().replace(/\(.*?\)|—.*$/g, '').replace(/\b(ltd|limited|pvt|private|the|co|company|inc)\b\.?/g, '').replace(/[^a-z0-9]/g, '');
    for (const o of orgs.values()) [o.name].concat(o.aliases).forEach(n => { const k = nk(n); if (k.length > 2 && !byName.has(k)) byName.set(k, o); });
    const have = new Set(); for (const o of orgs.values()) o.contacts.forEach(c => c.email && have.add(c.email));
    const cmap = { 'bank': 'BANK', 'telecom / isp': 'TEL', 'payments / wallet': 'PAY', 'payment gateway': 'PAY', 'card network': 'PAY', 'social media': 'SOC', 'messaging': 'SOC', 'tech platform': 'TECH', 'e-commerce': 'ECOM', 'classifieds': 'ECOM', 'travel / mobility': 'ECOM', 'food delivery': 'ECOM', 'regulator / govt': 'GOV' };
    for (const e of doc.official || []) {
      let base = [e.entity].concat(e.aliases || []).map(n => byName.get(nk(n))).find(Boolean) || null; let made = null;
      const own = () => base || made || (made = get('o:' + nk(e.entity), { name: e.entity, cat: cmap[String(e.category || '').toLowerCase()] || 'OTH', sub: e.sub || '', aliases: e.aliases || [] }));
      for (const c of e.contacts || []) { if (c.email && have.has(c.email.toLowerCase())) continue; if (!c.email && !c.phone && !c.portal) continue;
        const st = c.email && this.stemOf(c.email.split('@')[1]); const o = st && stem2.has(st) ? fromDef(stem2.get(st)) : own(); if (o === own() || !o.web) { if (e.web && !o.web && o === own()) o.web = e.web; if (e.ifsc && !o.ifsc && o === own()) o.ifsc = e.ifsc; }
        o.contacts.push({ who: [c.name, c.designation && c.designation !== c.role ? c.designation : '', c.role].filter(Boolean).join(' · '), email: (c.email || '').toLowerCase(), phone: c.phone || '', portal: c.portal || c.url || '', address: c.address || '', src: 'Official website' + (e.checked ? ' (checked ' + e.checked.split('-').reverse().join('/') + ')' : ''), year: 2026, tags: ['Official site'], note: c.note || e.note || '' }); if (c.email) have.add(c.email.toLowerCase()); }
    }
    this.orgs = Array.from(orgs.values()).filter(o => o.contacts.length).map(o => Object.assign(o, { domains: Array.from(o.domains) }));
    this.applyUser();
  },
  applyUser() {
    for (const o of this.orgs) o.contacts = o.contacts.filter(c => !c.mine);
    this.orgs = this.orgs.filter(o => o.contacts.length || !o.mineOnly);
    for (const u of this.user) { let o = this.orgs.find(x => x.name.toLowerCase() === String(u.org).toLowerCase()); if (!o) { o = { id: 'u:' + u.org.toUpperCase(), name: u.org, cat: u.cat || 'OTH', sub: '', ifsc: '', aliases: [], domains: [], contacts: [], mineOnly: true }; this.orgs.push(o); } o.contacts.unshift(Object.assign({ mine: true, tags: ['Added by you'], src: 'Added by ' + (u.by || 'you') + ' on ' + (u.on || '') }, u)); }
    this.byId = new Map(this.orgs.map(o => [o.id, o]));
    for (const o of this.orgs) for (const c of o.contacts) { c.tier = nodalTier(c); if (c.tier === 1 && !c.tags.includes('Legal / LEA')) c.tags.unshift('Legal / LEA'); }
    const rank = c => (c.mine ? 50 : 0) + (c.tier === 1 ? 30 : c.tier === 2 ? 15 : 0) + (c.tags.includes('LEA') ? 8 : 0) + (c.tags.includes('Official site') ? 6 : 0) + (c.tags.includes('Nodal') ? 4 : 0) + (/nodal|pno|lea|cyber|fraud|grievance/i.test(c.email) ? 3 : 0) + (c.who ? 2 : 0) + (c.phone ? 1 : 0) + ((c.year || 2015) - 2015) / 4;
    for (const o of this.orgs) o.contacts.sort((a, b) => rank(b) - rank(a));
    for (const o of this.orgs) { o.hay = [o.name, o.sub, o.ifsc].concat(o.aliases, o.domains, uniq(o.contacts.map(c => c.listed).filter(Boolean))).join(' | ').toLowerCase(); o.n = o.contacts.length; }
    this.orgs.sort((a, b) => (b.known ? 1 : 0) - (a.known ? 1 : 0) || b.n - a.n || a.name.localeCompare(b.name));
  },
  async load(keyB64) {
    if (this.loaded) return; if (this._p) return this._p;
    this._p = (async () => {
      try { this.user = (await Vault.get('nodal:user')) || []; this.flags = (await Vault.get('nodal:flags')) || {}; } catch { }
      let doc = null;
      if (!doc) {
        if (!keyB64 && !Backend.on()) throw new Error('The directory opens after signing in with Google through the access server.');
        const key = keyB64 || (await Backend.call('refKey')).key;
        const r = await fetch(CONFIG.REF_NODAL_URL, { cache: 'default', credentials: 'omit' }); if (!r.ok) throw new Error('Directory file not found on the site');
        const buf = new Uint8Array(await r.arrayBuffer()); if (new TextDecoder().decode(buf.slice(0, 7)) !== 'SSREF1\n') throw new Error('Not a SIXTH SENSE reference file');
        const k = await crypto.subtle.importKey('raw', b64.dec(key), 'AES-GCM', false, ['decrypt']);
        const z = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(7, 19), additionalData: new TextEncoder().encode('SIXTHSENSE-REF-NODAL-V1') }, k, buf.slice(19));
        doc = JSON.parse(await gunzip(new Uint8Array(z)));
      }
      this.build(doc); this.info = { rows: doc.rows.length, created: doc.created, official: (doc.official || []).length, local: !!doc.local }; this.loaded = true; this.err = '';
    })().catch(e => { this._p = null; this.err = e.message; throw e; });
    return this._p;
  },
  reset() { this.orgs = []; this.byId = new Map(); this.loaded = false; this._p = null; this.user = []; this.flags = {}; },
  /* accurate search: e-mail, phone, IFSC, UPI handle, "exact phrase" or all words */
  search(q, cat, sub) {
    q = String(q || '').trim(); let list = this.orgs.filter(o => (!cat || (cat === 'KERALA' ? /kerala|kochi|ernakulam|thiruvananthapuram|trivandrum|kozhikode|calicut|thrissur|kannur|kollam|palakkad|kottayam|alappuzha|malappuram|idukki|wayanad|pathanamthitta|kasaragod/i.test(o.name + ' ' + o.contacts.map(c => c.who + ' ' + (c.address || '')).join(' ')) : o.cat === cat)) && (!sub || o.sub === sub));
    if (!q) return list.map(o => ({ o, hits: null }));
    const out = []; const lq = q.toLowerCase(); const digits = q.replace(/\D/g, '');
    const phrase = (lq.match(/^"(.+)"$/) || [])[1];
    const words = (phrase ? [phrase] : lq.split(/\s+/)).filter(Boolean); const wr = words.map(w => new RegExp('(^|[^a-z0-9])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    const mode = /@/.test(lq) && !/^@/.test(lq) ? 'email' : /^@[a-z]+$/.test(lq) ? 'upi' : digits.length >= 6 && digits.length >= lq.replace(/[\s\-+()]/g, '').length - 1 ? 'phone' : /^[a-z]{4}(0[a-z0-9]{6})?$/i.test(q) && q === q.toUpperCase() ? 'ifsc' : 'text';
    for (const o of list) {
      let score = 0, hits = null;
      if (mode === 'email') { hits = o.contacts.filter(c => c.email && c.email.includes(lq)); if (!hits.length && o.domains.some(d => lq.endsWith('@' + d) || d === lq.replace(/^.*@/, ''))) hits = o.contacts.filter(c => c.email && c.email.endsWith(lq.replace(/^.*@/, '@'))); score = hits.length ? 100 : 0; }
      else if (mode === 'phone') { const d10 = digits.slice(-10); hits = o.contacts.filter(c => String(c.phone).replace(/\D/g, '').includes(d10)); score = hits.length ? 100 : 0; }
      else if (mode === 'upi') { score = o.aliases.some(a => a.toLowerCase() === lq) ? 100 : 0; }
      else if (mode === 'ifsc') { score = o.ifsc && o.ifsc === q.slice(0, 4) ? 100 : 0; if (!score) { const all = words.every(w => o.hay.includes(w)); score = all ? 40 : 0; } }
      else {
        const name = o.name.toLowerCase(); const orgAll = wr.every(r => r.test(o.hay));
        if (name === lq || o.aliases.some(a => a.toLowerCase() === lq)) score = 100; else if (orgAll && name.startsWith(words[0])) score = 80; else if (orgAll) score = 60;
        if (!score) { hits = o.contacts.filter(c => { const h = (c.who + ' ' + (c.listed || '') + ' ' + c.email + ' ' + (c.address || '') + ' ' + (c.note || '')).toLowerCase(); return words.every(w => h.includes(w)); }); if (hits.length) score = 30; else hits = null; }
      }
      if (score) out.push({ o, hits, score });
    }
    return out.sort((a, b) => b.score - a.score || (b.o.known ? 1 : 0) - (a.o.known ? 1 : 0) || b.o.n - a.o.n);
  },
  /* best directory entry for a letter recipient (bank name / IFSC prefix) */
  match(name, ifsc) {
    if (!this.loaded) return null; const p = String(ifsc || '').slice(0, 4).toUpperCase();
    if (p) { const o = this.orgs.find(o => o.ifsc === p && o.known); if (o) return o; }
    const r = this.search(String(name || '').replace(/\(.*?\)/g, '').trim(), ''); return r.length && r[0].score >= 60 ? r[0].o : null;
  }
};
async function copyText(t, what) { try { await navigator.clipboard.writeText(t); } catch { const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch { } ta.remove(); } toast((what || 'Copied') + ' — copied to clipboard', 'ok', 1400); }
const NDL = { q: '', cat: '', shown: 200, sort: 'org', dir: 1 };
/* rows = one line per contact: organisation · e-mail · phone (legal / LEA first inside each organisation) */
function nodalRows() {
  const q = NDL.q.trim(); if (!q && !NDL.cat) return null;
  const res = NODAL.search(q, NDL.cat === 'ALL' ? '' : NDL.cat, '');
  const rows = []; for (const { o, hits } of res) for (const c of (hits || o.contacts)) if (c.email || c.phone) rows.push({ o, c, score: q ? (hits ? 1 : 2) : 0 });
  const k = NDL.sort, d = NDL.dir; const t = x => x.c.tier === 1 ? 0 : x.c.tier === 2 ? 1 : 2;
  rows.sort((a, b) => (q && k === 'org' ? 0 : 0) || (k === 'email' ? d * String(a.c.email).localeCompare(String(b.c.email)) : k === 'phone' ? d * String(a.c.phone || '~').localeCompare(String(b.c.phone || '~')) : d * a.o.name.localeCompare(b.o.name, 'en', { sensitivity: 'base' })) || t(a) - t(b) || String(a.c.email).localeCompare(String(b.c.email)));
  if (q && k === 'org' && d === 1) { const rank = new Map(res.map((r, i) => [r.o, i])); rows.sort((a, b) => rank.get(a.o) - rank.get(b.o) || t(a) - t(b) || String(a.c.email).localeCompare(String(b.c.email))); }
  return rows;
}
VIEWS.nodal = async el => {
  el.innerHTML = pageHead('Nodal Officers', 'Nodal, legal and LEA contacts of banks, payment companies, telecom operators, platforms and police cyber units.') + `<div class="empty" style="margin-top:40px"><div class="spin"></div>Opening the directory…</div>`;
  try { await NODAL.load(); } catch (e) { }
  const warn = `<div class="nd-warn">⚠ <b>Contact details may have changed.</b> Confirm with the concerned provider before relying on a contact. E-mails may bounce and officers may have moved.</div>`;
  if (!NODAL.loaded) { el.innerHTML = pageHead('Nodal Officers', 'Nodal, legal and LEA contacts.') + warn + `<div class="card" style="margin-top:12px">${emptyState(esc(NODAL.err || 'Directory not available.') + '<br>Sign out and sign in again with Google. If it still fails, ask the admin to check that the site update (data/nodal-ref.enc) was uploaded.')}</div>`; return; }
  const cats = Object.keys(NCAT).filter(k => NODAL.orgs.some(o => o.cat === k));
  el.innerHTML = pageHead('Nodal Officers', 'Nodal, legal and LEA contacts of banks, payment companies, telecom operators, platforms and police cyber units.') +
    `<form class="nd-main" id="ndF" autocomplete="off"><svg class="nd-si" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M15.5 15.5 21 21" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg><input id="ndQ" placeholder="Search organisation, e-mail ID or phone number" value="${esc(NDL.q)}"><button type="button" class="btn-g" id="ndClr" ${NDL.q ? '' : 'hidden'} title="Clear">✕</button><button class="btn-p" type="submit">Search</button></form>
    <div class="nd-cats"><button class="${NDL.cat === 'ALL' ? 'on' : ''}" data-nc="ALL">All</button>${cats.map(k => `<button class="${NDL.cat === k ? 'on' : ''}" data-nc="${k}" style="--c:${NCAT[k][1]}">${NCAT[k][0]}</button>`).join('')}</div>
    ${warn}<div id="ndList"></div>`;
  const hl = s => { s = esc(s); const w = NDL.q.replace(/"/g, '').trim().split(/\s+/).filter(x => x.length > 1).map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); return w.length ? s.replace(new RegExp('(' + w.join('|') + ')', 'ig'), '<mark>$1</mark>') : s; };
  const draw = () => {
    const rows = nodalRows(); const box = $('#ndList', el);
    if (!rows) { box.innerHTML = `<div class="nd-idle">Type in the search bar, or choose a heading above.</div>`; return; }
    if (!rows.length) { box.innerHTML = emptyState('No match. Try fewer words, the e-mail domain (e.g. @federalbank.co.in) or a phone number.'); return; }
    const shown = rows.slice(0, NDL.shown); const arrow = k => NDL.sort === k ? (NDL.dir > 0 ? ' ▲' : ' ▼') : '';
    box.innerHTML = `<div class="nd-bar"><span class="small dim">${NDL.cat && NDL.cat !== 'ALL' ? esc((NCAT[NDL.cat] || ['All'])[0]) : 'All'}${NDL.q ? ' · “' + esc(NDL.q) + '”' : ''}</span><button class="btn-sm" id="ndCopyAll">⧉ Copy e-mails shown</button></div>
      <div class="tbl-wrap nd-wrap"><table class="tbl nd-tbl"><thead><tr><th data-sort="org">Organization${arrow('org')}</th><th data-sort="email">Email ID${arrow('email')}</th><th data-sort="phone">Phone No.${arrow('phone')}</th><th></th></tr></thead><tbody>
      ${shown.map((r, i) => { const prev = shown[i - 1]; const same = prev && prev.o === r.o; return `<tr class="${same ? 'nd-same' : 'nd-first'}">
        <td>${same ? '' : `<b>${hl(r.o.name)}</b><div class="small dim">${esc((NCAT[r.o.cat] || NCAT.OTH)[0])}${r.o.ifsc ? ' · IFSC ' + esc(r.o.ifsc) : ''}</div>`}</td>
        <td class="mono">${r.c.email ? `${hl(r.c.email)}${r.c.tier === 1 ? ' <span class="badge pink">Legal / LEA</span>' : ''} <a href="#" data-cp="${esc(r.c.email)}" title="Copy e-mail">⧉</a>` : '—'}</td>
        <td class="mono">${r.c.phone ? `${hl(r.c.phone)} <a href="#" data-cp="${esc(r.c.phone)}" title="Copy phone">⧉</a>` : '—'}</td>
        <td><a href="#" data-row="${i}" title="Copy organisation, e-mail and phone">⧉ Copy</a></td></tr>`; }).join('')}</tbody></table></div>
      ${rows.length > NDL.shown ? `<div style="text-align:center;margin:12px"><button id="ndMore">Show more</button></div>` : ''}`;
    $$('[data-cp]', box).forEach(a => a.onclick = e => { e.preventDefault(); copyText(a.dataset.cp); });
    $$('[data-row]', box).forEach(a => a.onclick = e => { e.preventDefault(); const r = shown[+a.dataset.row]; copyText([r.o.name, r.c.email, r.c.phone].filter(Boolean).join('\t'), 'Row'); });
    $('#ndCopyAll', box).onclick = () => copyText(uniq(shown.map(r => r.c.email).filter(Boolean)).join('; '), 'E-mails');
    $$('[data-sort]', box).forEach(th => th.onclick = () => { const k = th.dataset.sort; NDL.dir = NDL.sort === k ? -NDL.dir : 1; NDL.sort = k; draw(); });
    if ($('#ndMore', box)) $('#ndMore', box).onclick = () => { NDL.shown += 200; draw(); };
  };
  const run = () => { NDL.q = $('#ndQ', el).value.trim(); NDL.shown = 200; NDL.sort = 'org'; NDL.dir = 1; $('#ndClr', el).hidden = !NDL.q; draw(); };
  $('#ndF', el).onsubmit = e => { e.preventDefault(); run(); };
  let t; $('#ndQ', el).oninput = () => { clearTimeout(t); t = setTimeout(run, 250); };
  $('#ndClr', el).onclick = () => { $('#ndQ', el).value = ''; run(); $('#ndQ', el).focus(); };
  $$('[data-nc]', el).forEach(b => b.onclick = () => { NDL.cat = NDL.cat === b.dataset.nc ? '' : b.dataset.nc; NDL.shown = 200; NDL.sort = 'org'; NDL.dir = 1; $$('[data-nc]', el).forEach(x => x.classList.toggle('on', x.dataset.nc === NDL.cat)); draw(); });
  draw(); $('#ndQ', el).focus();
};
