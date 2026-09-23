/* ------------------------------ bank profiles ------------------------------
   Each profile adds bank-specific header names on top of the universal
   synonyms, the IFSC prefix used for auto-detection, and where transaction
   time is found. Confirmed user mappings are saved as learned templates.   */
const BANKS = [
  { code: 'AXIS', name: 'Axis Bank', ifsc: 'UTIB', rx: /axis\s*bank/i, hints: { date: ['trandate', 'transactiondate'], ref: ['chqno', 'chequeno'], narr: ['particulars'], debit: ['dr', 'debit'], credit: ['cr', 'credit'], balance: ['bal', 'balance'] } },
  { code: 'BANDHAN', name: 'Bandhan Bank', ifsc: 'BDBL', rx: /bandhan/i, hints: {} },
  { code: 'BOB', name: 'Bank of Baroda', ifsc: 'BARB', rx: /bank\s*of\s*baroda|\bbob\b/i, hints: { date: ['transactiondate'], txnId: ['transactionid'], credit: ['creditamount'], debit: ['debitamount'], balance: ['linebalance'] } },
  { code: 'CANARA', name: 'Canara Bank', ifsc: 'CNRB', rx: /canara/i, hints: { date: ['transdate', 'txndate'], narr: ['particulars'] } },
  { code: 'DHANLAXMI', name: 'Dhanlaxmi Bank', ifsc: 'DLXB', rx: /dhan\s*la?xmi/i, hints: {} },
  { code: 'ESAF', name: 'ESAF Small Finance Bank', ifsc: 'ESMF', rx: /esaf/i, hints: {} },
  { code: 'FEDERAL', name: 'Federal Bank', ifsc: 'FDRL', rx: /federal\s*bank/i, hints: { narr: ['particulars'], ref: ['tranid', 'chequedetails'] } },
  { code: 'HDFC', name: 'HDFC Bank', ifsc: 'HDFC', rx: /hdfc/i, hints: { narr: ['narration'], ref: ['chqrefno'], valueDate: ['valuedt'], debit: ['withdrawalamt'], credit: ['depositamt'], balance: ['closingbalance'] } },
  { code: 'ICICI', name: 'ICICI Bank', ifsc: 'ICIC', rx: /icici/i, hints: { txnId: ['tranid'], date: ['trandate'], debit: ['dramt'], credit: ['cramt'], balance: ['balance'], narr: ['narration', 'tranparticular'], postDate: ['pstddt'] }, timeFrom: 'postDate' },
  { code: 'IDBI', name: 'IDBI Bank', ifsc: 'IBKL', rx: /idbi/i, hints: {} },
  { code: 'IDFC', name: 'IDFC FIRST Bank', ifsc: 'IDFB', rx: /idfc/i, hints: { date: ['transactiondate'], narr: ['particulars'] } },
  { code: 'INDIAN', name: 'Indian Bank', ifsc: 'IDIB', rx: /indian\s*bank/i, hints: {} },
  { code: 'IOB', name: 'Indian Overseas Bank', ifsc: 'IOBA', rx: /indian\s*overseas/i, hints: {} },
  { code: 'KOTAK', name: 'Kotak Mahindra Bank', ifsc: 'KKBK', rx: /kotak/i, hints: { narr: ['description'], ref: ['chqrefno'] } },
  { code: 'IPPB', name: 'India Post Payments Bank', ifsc: 'IPOS', rx: /india\s*post\s*payments|ippb/i, hints: {} },
  { code: 'SBI', name: 'State Bank of India', ifsc: 'SBIN', rx: /state\s*bank\s*of\s*india|\bsbi\b/i, hints: { date: ['txndate'], valueDate: ['valuedate'], narr: ['description'], ref: ['refnochequeno', 'refno'] } },
  { code: 'UCO', name: 'UCO Bank', ifsc: 'UCBA', rx: /uco\s*bank/i, hints: {} },
  { code: 'UNION', name: 'Union Bank of India', ifsc: 'UBIN', rx: /union\s*bank/i, hints: {} },
  { code: 'YES', name: 'YES Bank', ifsc: 'YESB', rx: /yes\s*bank/i, hints: {} },
  { code: 'PNB', name: 'Punjab National Bank', ifsc: 'PUNB', rx: /punjab\s*national/i, hints: {} },
  { code: 'INDUSIND', name: 'IndusInd Bank', ifsc: 'INDB', rx: /indusind/i, hints: {} },
  { code: 'SIB', name: 'South Indian Bank', ifsc: 'SIBL', rx: /south\s*indian\s*bank/i, hints: {} },
  { code: 'CSB', name: 'CSB Bank', ifsc: 'CSBK', rx: /\bcsb\b|catholic\s*syrian/i, hints: {} },
  { code: 'AIRTEL', name: 'Airtel Payments Bank', ifsc: 'AIRP', rx: /airtel\s*payments/i, hints: {} },
  { code: 'PAYTM', name: 'Paytm Payments Bank', ifsc: 'PYTM', rx: /paytm/i, hints: {} },
  { code: 'AU', name: 'AU Small Finance Bank', ifsc: 'AUBL', rx: /\bau\s*small/i, hints: {} },
  { code: 'KVB', name: 'Karur Vysya Bank', ifsc: 'KVBL', rx: /karur\s*vysya/i, hints: {} },
  { code: 'KERALAGB', name: 'Kerala Gramin Bank', ifsc: 'KLGB', rx: /kerala\s*gramin/i, hints: {} },
  { code: 'GENERIC', name: 'Other / Generic', ifsc: '', rx: null, hints: {} }
];
const bankByCode = c => BANKS.find(b => b.code === c) || BANKS[BANKS.length - 1];
const bankByIfsc = ifsc => { const p = String(ifsc || '').toUpperCase().slice(0, 4); return BANKS.find(b => b.ifsc && b.ifsc === p); };
function detectBank(text, filename = '') {
  const t = String(text || '') + ' ' + filename;
  const ifsc = t.toUpperCase().match(/\b([A-Z]{4})0[A-Z0-9]{6}\b/g) || [];
  for (const i of ifsc) { const b = bankByIfsc(i); if (b) return b; }
  for (const b of BANKS) if (b.rx && b.rx.test(t)) return b;
  return null;
}

/* ------------------------- field dictionaries per data kind ------------------------- */
const FIELDS = {
  statement: {
    label: 'Bank statement', required: [['date'], ['debit', 'credit'], ['amount', 'drcr']], anyOf: true,
    f: {
      acctNo: ['accountno', 'acno', 'accountnumber', 'acctno', 'foracid', 'acnumber', 'accountnum', 'acctnum', 'ac'],
      date: ['txndate', 'transactiondate', 'trandate', 'date', 'transdate', 'trndate', 'transactiondatetime', 'dateandtime', 'txndatetime', 'datetime', 'trandt', 'txnpostdate', 'bookingdate'],
      valueDate: ['valuedate', 'valuedt', 'valdate', 'valdt'],
      postDate: ['pstddt', 'posteddate', 'postingdate', 'postdate', 'postingdatetime', 'pstdt', 'postedon'],
      time: ['time', 'txntime', 'transactiontime', 'trantime', 'txntm'],
      narr: ['narration', 'description', 'particulars', 'remarks', 'transactionremarks', 'transactiondetails', 'details', 'transactionparticulars', 'tranparticular', 'tranparticulars', 'trandescription', 'narrative', 'transactiondescription', 'remark', 'txndescription', 'txnremarks', 'naration'],
      ref: ['chqrefno', 'chequeno', 'chqno', 'refno', 'referenceno', 'reference', 'chequerefno', 'refchqno', 'instrumentno', 'chqrefnumber', 'refnochequeno', 'chequedetails', 'chequenumber', 'referencenumber', 'instrumentid', 'chqnorefno'],
      utr: ['utr', 'utrno', 'utrnumber', 'rrn', 'rrnno', 'utrrrn', 'transactionreferenceno', 'upirefno', 'upirrn', 'impsrrn'],
      txnId: ['tranid', 'transactionid', 'txnid', 'tranno', 'transactionno', 'journalno', 'txnno', 'tranidno'],
      debit: ['debit', 'withdrawal', 'withdrawals', 'withdrawalamt', 'withdrawalamount', 'dramt', 'dramount', 'debitamount', 'debitamt', 'dr', 'withdrawalinr', 'withdrawalsinr', 'debitinr', 'amountdr', 'debits', 'withdrawalrs', 'debitrs', 'wdlamt'],
      credit: ['credit', 'deposit', 'deposits', 'depositamt', 'depositamount', 'cramt', 'cramount', 'creditamount', 'creditamt', 'cr', 'depositinr', 'creditinr', 'amountcr', 'credits', 'depositrs', 'creditrs', 'depamt'],
      amount: ['amount', 'txnamount', 'transactionamount', 'amountinr', 'tranamount', 'amt', 'txnamt', 'amountrs'],
      drcr: ['drcr', 'crdr', 'dc', 'debitcredit', 'drcrindicator', 'parttrantype', 'type', 'txntype', 'trantype', 'transactiontype', 'crdrind', 'drcrflag'],
      balance: ['balance', 'closingbalance', 'runningbalance', 'balanceinr', 'linebalance', 'availablebalance', 'bal', 'balanceamt', 'balanceamount', 'ledgerbalance', 'balancers'],
      branch: ['branch', 'branchname', 'solid', 'branchcode'],
      channel: ['channel', 'mode', 'txnmode', 'transactionmode', 'paymentmode']
    }
  },
  kyc: {
    label: 'Account holder / KYC details', required: [['acctNo']],
    f: {
      acctNo: ['accountno', 'acno', 'accountnumber', 'acctno', 'foracid', 'acnumber', 'beneficiaryaccountno', 'account'],
      name: ['name', 'accountholder', 'accountholdername', 'customername', 'acname', 'accountname', 'holdername', 'custname', 'nameofaccountholder'],
      mobile: ['mobile', 'mobileno', 'mobilenumber', 'registeredmobile', 'registeredmobileno', 'rmn', 'phone', 'phoneno', 'contactno', 'contactnumber', 'linkedmobile', 'mobilenos'],
      altMobile: ['alternatemobile', 'alternateno', 'alternatenumber', 'altmobile', 'altno', 'mobile2', 'secondarymobile', 'othermobile', 'alternatecontact', 'landline', 'phone2', 'othercontact', 'altcontact'],
      email: ['email', 'emailid', 'mailid', 'emailaddress', 'registeredemail'],
      pan: ['pan', 'panno', 'pannumber'],
      address: ['address', 'communicationaddress', 'permanentaddress', 'custaddress', 'addr', 'correspondenceaddress'],
      ifsc: ['ifsc', 'ifsccode'], bank: ['bank', 'bankname'], branch: ['branch', 'branchname'],
      custId: ['customerid', 'custid', 'cif', 'cifid', 'ucic', 'crn'], openDate: ['accountopeningdate', 'openingdate', 'acopendate', 'dateofopening'],
      upi: ['upi', 'upiid', 'vpa', 'linkedvpa'], role: ['role', 'category', 'layer']
    }
  },
  iplog: {
    label: 'Bank login / IP log', required: [['ip']],
    f: {
      acctNo: ['accountno', 'acno', 'accountnumber', 'acctno', 'foracid'], custId: ['customerid', 'custid', 'cif', 'userid', 'loginid', 'cifid', 'crn'],
      datetime: ['logindatetime', 'datetime', 'timestamp', 'logintime', 'sessionstart', 'accesstime', 'eventtime', 'transactiondatetime', 'txndatetime', 'logindate', 'date'],
      time: ['time', 'logintm'], ip: ['ip', 'ipaddress', 'loginip', 'sourceip', 'clientip', 'publicip', 'ipaddr', 'deviceip', 'remoteip'],
      port: ['port', 'sourceport', 'srcport', 'clientport', 'publicport'], channel: ['channel', 'loginchannel', 'platform', 'medium', 'appname', 'mode'],
      device: ['deviceid', 'device', 'devicename', 'imei', 'deviceinfo', 'devicemodel', 'useragent'], event: ['event', 'activity', 'action', 'eventtype', 'status', 'logintype', 'description'],
      utr: ['utr', 'rrn', 'transactionid', 'txnid', 'referenceno', 'txnref'], mobile: ['mobile', 'mobileno', 'registeredmobile']
    }
  },
  cdr: {
    label: 'CDR (call detail record)', required: [['bParty']],
    f: {
      target: ['targetno', 'target', 'targetnumber', 'msisdn', 'subscriberno'], aParty: ['aparty', 'callingno', 'callingnumber', 'anumber', 'callingparty', 'source', 'caller', 'calling'],
      bParty: ['bparty', 'calledno', 'callednumber', 'bnumber', 'calledparty', 'destination', 'otherparty', 'bpartyno', 'called', 'othernumber', 'b'],
      date: ['date', 'calldate', 'startdate', 'calldatetime', 'datetime', 'callstartdate'], time: ['time', 'calltime', 'starttime', 'callstarttime'],
      duration: ['duration', 'callduration', 'dur', 'durationsec', 'durationinsec', 'callduration(sec)'], callType: ['calltype', 'type', 'callcategory', 'usagetype', 'eventtype', 'servicetype', 'direction', 'callstatus'],
      cellId: ['firstcellid', 'cellid', 'firstcgi', 'cgi', 'cellglobalid', 'startcellid', 'firstcellglobalid', 'celltowerid', 'firstcell'], lastCell: ['lastcellid', 'lastcgi', 'endcellid'],
      lac: ['lac', 'firstlac', 'locationareacode'], imei: ['imei', 'imeino'], imsi: ['imsi', 'imsino'], roaming: ['roaming', 'roamingcircle', 'circle', 'roamnw'],
      operator: ['operator', 'tsp', 'serviceprovider', 'network'], address: ['firstcelladdress', 'celladdress', 'address', 'siteaddress', 'towerlocation', 'location', 'firstcellsiteaddress'],
      lat: ['latitude', 'lat', 'firstcelllat'], lon: ['longitude', 'long', 'lon', 'lng', 'firstcelllong']
    }
  },
  ipdr: {
    label: 'IPDR (telecom/ISP IP detail record)', required: [['ip'], ['msisdn', 'subscriber']],
    f: {
      msisdn: ['msisdn', 'mobile', 'mobileno', 'subscriberno', 'targetno', 'landlineno', 'userid', 'username', 'mdn'], subscriber: ['subscribername', 'customername', 'name'],
      ip: ['publicip', 'natip', 'sourceip', 'translatedip', 'publicipv4', 'ipaddress', 'ip', 'allocatedip', 'srcip', 'publicipaddress', 'ipv6', 'publicipv6'],
      privIp: ['privateip', 'privateipv4', 'framedip', 'localip'],
      port: ['publicport', 'natport', 'sourceport', 'translatedport', 'srcport', 'port', 'publicportstart'], portEnd: ['publicportend', 'portend', 'natportend'],
      start: ['starttime', 'sessionstart', 'startdatetime', 'start', 'fromtime', 'sessionstarttime', 'datetime', 'date'], end: ['endtime', 'sessionend', 'enddatetime', 'end', 'totime', 'sessionendtime'],
      destIp: ['destinationip', 'destip', 'dstip'], destPort: ['destinationport', 'destport', 'dstport'],
      imei: ['imei'], imsi: ['imsi'], cellId: ['cellid', 'cgi', 'firstcellid'], address: ['address', 'celladdress', 'installationaddress']
    }
  },
  ncrp: {
    label: 'NCRP money trail / disputed transactions', required: [['acctNo', 'utr']],
    f: {
      ackNo: ['acknowledgementno', 'acknowledgmentno', 'ackno', 'complaintno'], layer: ['layer', 'layerno', 'level'],
      fromAcct: ['fromaccount', 'debitaccount', 'remitteraccount', 'victimaccount', 'senderaccount', 'accountnofrom'],
      acctNo: ['accountno', 'accountnowalletpgpaid', 'accountnumber', 'beneficiaryaccount', 'toaccount', 'creditaccount', 'acno', 'accountidwalletid', 'accountno.', 'accountnowalletpgpa'],
      bank: ['bank', 'bankname', 'bankfipayment', 'bankfi', 'bankwalletpgpa', 'bankwalletpgpaname'], ifsc: ['ifsc', 'ifsccode'],
      utr: ['transactionidutrnumber', 'utr', 'utrno', 'transactionid', 'referenceno', 'rrn', 'transactionidutr', 'txnid'],
      amount: ['transactionamount', 'amount', 'disputedamount', 'amountrs', 'txnamount'], hold: ['putonholdamount', 'holdamount', 'lienamount', 'amountonhold', 'onhold'],
      date: ['transactiondate', 'date', 'txndate', 'dateoftransaction', 'transactiondatetime'], status: ['actiontaken', 'status', 'action', 'remarks']
    }
  },
  sms: {
    label: 'SMS / OTP records', required: [['message']],
    f: {
      msisdn: ['msisdn', 'mobile', 'mobileno', 'targetno', 'receiver', 'to'], datetime: ['datetime', 'date', 'receivedtime', 'timestamp', 'smsdate'], time: ['time'],
      sender: ['sender', 'from', 'senderid', 'header', 'aparty'], message: ['message', 'text', 'smstext', 'content', 'body', 'sms']
    }
  }
};
