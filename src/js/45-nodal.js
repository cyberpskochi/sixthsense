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
      let doc = null; try { doc = await Vault.get('nodal:list'); } catch { }
      if (!doc) {
        if (!keyB64 && !Backend.on()) throw new Error('The directory opens after signing in through the access server (or import the master Excel below).');
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
const NDL = { q: '', cat: '', sub: '', open: new Set(), shown: 40, all: new Set() };
VIEWS.nodal = async el => {
  el.innerHTML = pageHead('Nodal Officers', 'Directory of nodal / grievance officers of banks, payment companies, telecom operators, platforms and police cyber units.') + `<div class="empty" style="margin-top:40px"><div class="spin"></div>Opening the directory…</div>`;
  try { await NODAL.load(); } catch (e) { }
  const warn = `<div class="nd-warn">⚠ <b>Contact details may have changed.</b> This directory is compiled from nodal officer lists circulated to police units and from providers' websites. Always confirm with the concerned provider before relying on a contact. Emails may bounce and officers may have moved.</div>`;
  if (!NODAL.loaded) {
    el.innerHTML = pageHead('Nodal Officers', 'Directory of nodal / grievance officers.') + warn + `<div class="card" style="margin-top:12px">${emptyState(esc(NODAL.err || 'Directory not available.'))}<div class="row" style="justify-content:center"><button class="btn-p" id="ndImp">⇪ Import nodal officers master Excel</button></div><p class="small dim" style="text-align:center">The imported list is stored encrypted on this computer only.</p></div>`;
    $('#ndImp', el).onclick = nodalImport; return;
  }
  const cats = Object.keys(NCAT).filter(k => NODAL.orgs.some(o => o.cat === k));
  const subs = NDL.cat === 'BANK' ? uniq(NODAL.orgs.filter(o => o.cat === 'BANK').map(o => o.sub)).sort() : [];
  el.innerHTML = pageHead('Nodal Officers', `Nodal, legal and LEA contacts of banks, payment companies, telecom operators, platforms and police cyber units · list dated ${esc(NODAL.info.created || '—')}${NODAL.info.local ? ' (imported on this computer)' : ''}`, `<button id="ndAdd">＋ Add contact</button>${isAdmin() ? '<button id="ndImp">⇪ Update master list</button>' : ''}`) +
    `<div class="nd-main"><span class="nd-mi">⌕</span><input id="ndQ" placeholder="Search any bank, wallet, telecom, platform, e-mail, phone, IFSC (FDRL) or UPI handle (@ybl)" value="${esc(NDL.q)}" autocomplete="off"><button class="btn-sm" id="ndClr" ${NDL.q ? '' : 'hidden'}>✕ Clear</button></div>
    <div class="nd-cats"><button class="${!NDL.cat ? 'on' : ''}" data-nc="">All</button>${cats.map(k => `<button class="${NDL.cat === k ? 'on' : ''}" data-nc="${k}" style="--c:${NCAT[k][1]}">${NCAT[k][0]}</button>`).join('')}<button class="${NDL.cat === 'KERALA' ? 'on' : ''}" data-nc="KERALA" style="--c:#34d399">Kerala related</button></div>
    ${subs.length ? `<div class="nd-subs">${['', ...subs].map(s => `<button class="chip ${NDL.sub === s ? 'on' : ''}" data-ns="${esc(s)}">${esc(s || 'All banks')}</button>`).join('')}</div>` : ''}
    ${warn}<span id="ndN" hidden></span>
    <div id="ndList"></div>`;
  const draw = () => {
    const res = NODAL.search(NDL.q, NDL.cat, NDL.sub); 
    const lim = res.slice(0, NDL.shown); const hl = s => { s = esc(s); if (!NDL.q || /^".*"$/.test(NDL.q) === false && NDL.q.length < 2) return s; const w = NDL.q.replace(/"/g, '').trim().split(/\s+/).filter(x => x.length > 1).map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); return w.length ? s.replace(new RegExp('(' + w.join('|') + ')', 'ig'), '<mark>$1</mark>') : s; };
    $('#ndList', el).innerHTML = lim.length ? lim.map(({ o, hits }) => {
      const open = NDL.open.has(o.id) || (hits && hits.length <= 6) || res.length === 1 || (NDL.q && res[0] && res[0].o === o && res[0].score >= 80); const list = hits && !NDL.all.has(o.id) ? hits : o.contacts; const emails = uniq(o.contacts.map(c => c.email).filter(Boolean)); const legal = uniq(o.contacts.filter(c => c.tier === 1 && c.email && !NODAL.flags[c.email]).map(c => c.email));
      return `<div class="nd-org ${open ? 'open' : ''}" data-id="${esc(o.id)}" style="--c:${(NCAT[o.cat] || NCAT.OTH)[1]}">
        <div class="nd-h" data-tog="${esc(o.id)}"><div><b>${hl(o.name)}</b> <span class="nd-cat">${esc((NCAT[o.cat] || NCAT.OTH)[0])}</span>${o.sub ? ` <span class="small dim">${esc(o.sub)}</span>` : ''}${o.ifsc ? ` <span class="mono small">IFSC ${esc(o.ifsc)}</span>` : ''}
          ${o.aliases.length ? `<div class="small dim">${hl(o.aliases.join(' · '))}</div>` : ''}</div>
          <div class="row" style="gap:6px">${hits ? `<span class="small" style="color:var(--amber)">match inside</span>` : ''}${emails.length ? `<button class="btn-sm" data-ce="${esc(o.id)}" title="Copy all e-mails, separated by ; for the To: field">⧉ All e-mails</button>` : ''}<span class="nd-car">${open ? '▾' : '▸'}</span></div></div>
        ${legal.length ? `<div class="nd-legal"><span class="nd-lt">⚖ Legal / LEA</span>${legal.slice(0, 6).map(e => `<span class="mono">${hl(e)} <a href="#" data-cp="${esc(e)}" title="Copy">⧉</a></span>`).join('')}${legal.length > 1 ? `<a href="#" data-cl="${esc(o.id)}" class="small">⧉ Copy legal IDs</a>` : ''}</div>` : ''}
        ${open ? `<div class="nd-body">${o.web ? `<div class="small" style="margin-bottom:6px">Website: <span class="mono">${esc(o.web)}</span></div>` : ''}<table class="tbl nd-t"><thead><tr><th>Officer / details</th><th>E-mail</th><th>Phone</th><th>Source</th><th></th></tr></thead><tbody>${list.slice(0, 300).map((c, i) => { const fl = c.email && NODAL.flags[c.email]; return `<tr class="${fl ? 'nd-flag' : ''}">
          <td>${hl(c.who || (c.listed && c.listed.toLowerCase() !== o.name.toLowerCase() ? c.listed : '') || '—')}${c.tags.map(t => ` <span class="badge ${t === 'Legal / LEA' ? 'pink' : t === 'Official site' ? 'blue' : t === 'Added by you' ? 'green' : 'gray'}">${esc(t)}</span>`).join('')}${c.address ? `<div class="small dim">${esc(c.address)}</div>` : ''}${c.portal ? `<div class="small">Portal: <span class="mono">${esc(c.portal)}</span> <a href="#" data-cp="${esc(c.portal)}">⧉</a></div>` : ''}${c.note ? `<div class="small dim">${esc(c.note)}</div>` : ''}${fl ? `<div class="small" style="color:var(--amber)">⚠ Marked outdated by ${esc(fl.by || 'you')} on ${esc(fl.on)}</div>` : ''}</td>
          <td class="mono">${c.email ? `${hl(c.email)} <a href="#" data-cp="${esc(c.email)}" title="Copy e-mail">⧉</a>` : '—'}</td>
          <td class="mono">${c.phone ? `${hl(c.phone)} <a href="#" data-cp="${esc(c.phone)}" title="Copy phone">⧉</a>` : '—'}</td>
          <td class="small dim">${esc(String(c.src || '').split(';')[0].slice(0, 60))}${c.year ? `<br>${c.year}` : ''}</td>
          <td style="white-space:nowrap"><a href="#" data-cr="${esc(o.id)}|${o.contacts.indexOf(c)}" title="Copy this contact">⧉ Copy</a>${c.email && !c.mine ? ` · <a href="#" data-fl="${esc(c.email)}">${fl ? 'Unmark' : 'Outdated?'}</a>` : ''}${c.mine ? ` · <a href="#" data-del="${esc(c.uid)}">Delete</a>` : ''}</td></tr>`; }).join('')}</tbody></table>
          ${hits && !NDL.all.has(o.id) && hits.length < o.n ? `<a href="#" data-all="${esc(o.id)}" class="small">Show all contacts</a>` : ''}${list.length > 300 ? `<div class="small dim">First 300 shown — refine the search.</div>` : ''}</div>` : ''}</div>`;
    }).join('') + (res.length > NDL.shown ? `<div style="text-align:center;margin:12px"><button id="ndMore">Show more</button></div>` : '') : emptyState('No match. Try fewer words, the e-mail domain (e.g. @federalbank.co.in), the IFSC prefix or a phone number.');
    $$('[data-tog]', el).forEach(h => h.onclick = e => { if (e.target.closest('button,a')) return; const id = h.dataset.tog; NDL.open.has(id) ? NDL.open.delete(id) : NDL.open.add(id); draw(); });
    $$('[data-ce]', el).forEach(b => b.onclick = () => { const o = NODAL.byId.get(b.dataset.ce); copyText(uniq(o.contacts.filter(c => c.email && !NODAL.flags[c.email]).map(c => c.email)).join('; '), 'All e-mails of ' + o.name); });
    $$('[data-cl]', el).forEach(a => a.onclick = e => { e.preventDefault(); const o = NODAL.byId.get(a.dataset.cl); copyText(uniq(o.contacts.filter(c => c.tier === 1 && c.email && !NODAL.flags[c.email]).map(c => c.email)).join('; '), 'Legal / LEA e-mails of ' + o.name); });
    $$('[data-cp]', el).forEach(a => a.onclick = e => { e.preventDefault(); copyText(a.dataset.cp); });
    $$('[data-cr]', el).forEach(a => a.onclick = e => { e.preventDefault(); const [id, i] = a.dataset.cr.split('|'); const o = NODAL.byId.get(id), c = o.contacts[+i]; copyText([o.name, c.who, c.email ? 'E-mail: ' + c.email : '', c.phone ? 'Phone: ' + c.phone : '', c.address || '', c.portal ? 'Portal: ' + c.portal : ''].filter(Boolean).join('\n'), 'Contact'); });
    $$('[data-all]', el).forEach(a => a.onclick = e => { e.preventDefault(); NDL.all.add(a.dataset.all); draw(); });
    $$('[data-fl]', el).forEach(a => a.onclick = async e => { e.preventDefault(); const k = a.dataset.fl; if (NODAL.flags[k]) delete NODAL.flags[k]; else NODAL.flags[k] = { on: fmtDate(Date.now() + 5.5 * 3600000), by: (S.user || {}).email || '' }; try { await Vault.put('nodal:flags', NODAL.flags); } catch { } draw(); });
    $$('[data-del]', el).forEach(a => a.onclick = async e => { e.preventDefault(); if (!await confirmBox('Delete contact', 'Remove this contact you added?', 'Delete', true)) return; NODAL.user = NODAL.user.filter(u => u.uid !== a.dataset.del); await Vault.put('nodal:user', NODAL.user); NODAL.applyUser(); draw(); });
    if ($('#ndMore', el)) $('#ndMore', el).onclick = () => { NDL.shown += 40; draw(); };
  };
  let t; $('#ndQ', el).oninput = e => { clearTimeout(t); t = setTimeout(() => { NDL.q = e.target.value; NDL.shown = 40; NDL.all.clear(); $('#ndClr', el).hidden = !NDL.q; draw(); }, 180); };
  $('#ndClr', el).onclick = () => { NDL.q = ''; $('#ndQ', el).value = ''; $('#ndClr', el).hidden = true; draw(); $('#ndQ', el).focus(); };
  $$('[data-nc]', el).forEach(b => b.onclick = () => { NDL.cat = b.dataset.nc; NDL.sub = ''; NDL.shown = 40; go('nodal'); });
  $$('[data-ns]', el).forEach(b => b.onclick = () => { NDL.sub = b.dataset.ns; NDL.shown = 40; go('nodal'); });
  $('#ndAdd', el).onclick = () => nodalAdd(() => go('nodal'));
  if ($('#ndImp', el)) $('#ndImp', el).onclick = nodalImport;
  draw(); $('#ndQ', el).focus();
};
function nodalAdd(done, pre = {}) {
  const md = modal({ title: 'Add a nodal contact', size: 'md', body: `<datalist id="ndOrgs">${NODAL.orgs.slice(0, 3000).map(o => `<option value="${esc(o.name)}">`).join('')}</datalist><div class="grid g2">
    <label class="f" style="grid-column:1/-1">Organisation *<input id="na_o" list="ndOrgs" value="${esc(pre.org || '')}" placeholder="Start typing — pick an existing name to add to it"></label>
    <label class="f">Category<select id="na_c">${Object.entries(NCAT).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select></label>
    <label class="f">Officer name / designation<input id="na_w"></label><label class="f">E-mail<input id="na_e"></label><label class="f">Phone<input id="na_p"></label>
    <label class="f" style="grid-column:1/-1">Note (e.g. "confirmed by phone on …")<input id="na_n"></label></div><p class="small dim">Saved encrypted on this computer and included in your encrypted backups.</p>`, foot: `<button data-c>Cancel</button><button class="btn-p" id="na_s">Save</button>` });
  $('[data-c]', md.el).onclick = () => md.close();
  $('#na_s', md.el).onclick = async () => { const v = id => $('#' + id, md.el).value.trim(); if (!v('na_o') || !(v('na_e') || v('na_p'))) return toast('Organisation and an e-mail or phone are needed', 'warn'); if (v('na_e') && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v('na_e'))) return toast('Check the e-mail address', 'warn');
    NODAL.user.push({ uid: 'U' + Date.now(), org: v('na_o'), cat: v('na_c'), who: v('na_w'), email: v('na_e').toLowerCase(), phone: v('na_p'), note: v('na_n'), on: fmtDate(Date.now() + 5.5 * 3600000), by: (S.user || {}).email || '' }); await Vault.put('nodal:user', NODAL.user); NODAL.applyUser(); md.close(); toast('Contact added', 'ok'); done && done(); };
}
function nodalImport() {
  const i = document.createElement('input'); i.type = 'file'; i.accept = '.xlsx,.xls,.csv';
  i.onchange = async () => { const f = i.files[0]; if (!f) return; try { await Libs.load(); const wb = XLSX.read(new Uint8Array(await f.arrayBuffer()), { type: 'array' }); const ws = wb.Sheets['All Nodal Officers'] || wb.Sheets[wb.SheetNames[0]]; const g = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const h = g[0].map(x => String(x).toLowerCase()); const c = (...k) => h.findIndex(x => k.some(y => x.includes(y))); const cC = c('category'), cO = c('organi', 'contact', 'name'), cP = c('phone', 'mobile'), cE = c('email', 'mail'), cS = c('source');
    if (cE < 0) throw new Error('No e-mail column found'); const rows = g.slice(1).map(r => [String(r[cC] ?? ''), String(r[cO] ?? '').replace(/\s+/g, ' ').trim(), String(r[cP] ?? '').trim(), String(r[cE] ?? '').trim().toLowerCase(), String(r[cS] ?? '')]).filter(r => r[3] || r[2]);
    const doc = { v: 1, kind: 'nodal', created: new Date().toISOString().slice(0, 10), rows, official: [], local: true }; await Vault.put('nodal:list', doc); NODAL.reset(); await NODAL.load(); await audit('Imported nodal officers list', rows.length + ' rows'); toast(rows.length + ' contacts imported', 'ok'); go('nodal'); } catch (e) { toast(e.message, 'err'); } };
  i.click();
}
