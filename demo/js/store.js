/*
 * Basha Bari demo: the shared data store for the app and the admin website.
 *
 * Everything in here is made up: people, phone numbers, NIDs, addresses and money.
 * Data is saved in this browser (localStorage), so the app and the admin website see
 * the same data when they are open in the same browser. When the demo runs through
 * `node server.js`, the data is also shared live between phones and laptops on the
 * same Wi-Fi.
 *
 * Table and field names follow ARCHITECTURE.md §9.2 where they can.
 */
(function (root) {
  'use strict';

  const SCHEMA = 6;
  const KEY = 'bb.demo.state';
  const CLIENT = Math.random().toString(36).slice(2, 10);
  const MIN = 6e4, HOUR = 36e5, DAY = 864e5;

  const BB = { SCHEMA, CLIENT, MIN, HOUR, DAY };
  let state = null;
  let serverMode = false;
  let pushTimer = null;
  const listeners = new Set();

  const store = (() => {
    try {
      const s = root.localStorage;
      s.setItem('bb.t', '1');
      s.removeItem('bb.t');
      return s;
    } catch (e) {
      const m = {};
      return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } };
    }
  })();
  BB.local = store;

  // ───────────── Small helpers ─────────────
  const now = () => Date.now();
  const iso = t => new Date(t).toISOString();
  const ms = s => new Date(s).getTime();
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const uid = p => p + '_' + Math.random().toString(36).slice(2, 7) + (now() % 46656).toString(36);
  const clone = o => JSON.parse(JSON.stringify(o));
  BB.now = now;
  BB.uid = uid;

  function err(en, bn) {
    const e = new Error(en);
    e.en = en;
    e.bn = bn || en;
    return e;
  }
  BB.err = err;

  // ───────────── SHA-256 (pure JS, so it also works from file://) ─────────────
  const SHA_K = [], SHA_H = [];
  (function () {
    const isPrime = n => { for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
    for (let n = 2; SHA_K.length < 64; n++) {
      if (!isPrime(n)) continue;
      if (SHA_H.length < 8) SHA_H.push((Math.sqrt(n) % 1) * 4294967296 >>> 0);
      SHA_K.push((Math.cbrt(n) % 1) * 4294967296 >>> 0);
    }
  })();
  const ror = (x, n) => (x >>> n) | (x << (32 - n));
  function sha256(str) {
    const bytes = new TextEncoder().encode(String(str));
    const len = bytes.length;
    const padded = ((len + 9 + 63) >> 6) << 6;
    const buf = new Uint8Array(padded);
    buf.set(bytes);
    buf[len] = 0x80;
    const dv = new DataView(buf.buffer);
    dv.setUint32(padded - 8, Math.floor(len / 536870912));
    dv.setUint32(padded - 4, (len * 8) >>> 0);
    const h = SHA_H.slice();
    const w = new Uint32Array(64);
    for (let i = 0; i < padded; i += 64) {
      for (let j = 0; j < 16; j++) w[j] = dv.getUint32(i + j * 4);
      for (let j = 16; j < 64; j++) {
        const s0 = ror(w[j - 15], 7) ^ ror(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        const s1 = ror(w[j - 2], 17) ^ ror(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
      }
      let [a, b, c, d, e, f, g, k] = h;
      for (let j = 0; j < 64; j++) {
        const t1 = (k + (ror(e, 6) ^ ror(e, 11) ^ ror(e, 25)) + ((e & f) ^ (~e & g)) + SHA_K[j] + w[j]) >>> 0;
        const t2 = ((ror(a, 2) ^ ror(a, 13) ^ ror(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
        k = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
      h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + k) >>> 0;
    }
    return h.map(x => x.toString(16).padStart(8, '0')).join('');
  }
  BB.sha256 = sha256;

  // ───────────── Formatting (Bangla and English) ─────────────
  const BN = '০১২৩৪৫৬৭৮৯';
  const toBn = s => String(s).replace(/[0-9]/g, d => BN[d]);
  const toAscii = s => String(s).replace(/[০-৯]/g, d => String(BN.indexOf(d)));
  const group = n => Math.round(n).toLocaleString('en-IN');
  const TZ = 'Asia/Dhaka';
  BB.fmt = {
    toBn, toAscii,
    num: (n, lang) => (lang === 'bn' ? toBn(group(n)) : group(n)),
    digits: (s, lang) => (lang === 'bn' ? toBn(s) : String(s)),
    money: (n, lang) => '৳' + (lang === 'bn' ? toBn(group(n)) : group(n)),
    date: (s, lang) => new Date(s).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ }),
    day: (s, lang) => new Date(s).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ }),
    time: (s, lang) => new Date(s).toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ }),
    dateTime: (s, lang) => BB.fmt.day(s, lang) + ', ' + BB.fmt.time(s, lang),
    ago(s, lang) {
      const d = Math.max(0, now() - ms(s));
      const bn = lang === 'bn';
      if (d < 2 * MIN) return bn ? 'এইমাত্র' : 'just now';
      if (d < HOUR) { const m = Math.floor(d / MIN); return bn ? toBn(m) + ' মিনিট আগে' : m + ' min ago'; }
      if (d < DAY) { const h = Math.floor(d / HOUR); return bn ? toBn(h) + ' ঘণ্টা আগে' : h + (h === 1 ? ' hour ago' : ' hours ago'); }
      const n = Math.floor(d / DAY);
      if (n === 1) return bn ? 'গতকাল' : 'yesterday';
      return bn ? toBn(n) + ' দিন আগে' : n + ' days ago';
    },
    maskPhone: p => (p ? p.slice(0, 3) + '•••••' + p.slice(-3) : '—'),
    phone: (p, lang) => (p ? BB.fmt.digits(p.slice(0, 5) + '-' + p.slice(5), lang) : '—'),
  };

  function norm(s) {
    return toAscii(String(s || '')).toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  }
  function bigrams(s) { const out = []; const x = ' ' + s + ' '; for (let i = 0; i < x.length - 1; i++) out.push(x.slice(i, i + 2)); return out; }
  function similarity(a, b) {
    if (!a || !b) return 0;
    const A = bigrams(a), B = bigrams(b);
    let hit = 0;
    const pool = B.slice();
    for (const g of A) { const i = pool.indexOf(g); if (i >= 0) { hit++; pool.splice(i, 1); } }
    return (2 * hit) / (A.length + B.length);
  }
  BB.norm = norm;

  // ───────────── Fixed lists ─────────────
  BB.AREAS = [
    { id: 1, parent: null, en: 'Dhaka', bn: 'ঢাকা', lat: 23.8103, lng: 90.4125, al: ['dhaka', 'dacca'] },
    { id: 10, parent: 1, en: 'Mirpur', bn: 'মিরপুর', lat: 23.8060, lng: 90.3640, al: ['mirpur', 'mirpoor', 'merpur', 'mirpur dhaka'] },
    { id: 11, parent: 10, en: 'Mirpur 1', bn: 'মিরপুর ১', lat: 23.7956, lng: 90.3537, al: ['mirpur 1', 'mirpur one', 'mirpur-1'] },
    { id: 12, parent: 10, en: 'Mirpur 2', bn: 'মিরপুর ২', lat: 23.8049, lng: 90.3622, al: ['mirpur 2', 'mirpur two'] },
    { id: 13, parent: 10, en: 'Mirpur 10', bn: 'মিরপুর ১০', lat: 23.8069, lng: 90.3687, al: ['mirpur 10', 'mirpur ten', 'mirpur10'] },
    { id: 14, parent: 10, en: 'Mirpur 11', bn: 'মিরপুর ১১', lat: 23.8183, lng: 90.3660, al: ['mirpur 11', 'mirpur eleven'] },
    { id: 15, parent: 10, en: 'Pallabi', bn: 'পল্লবী', lat: 23.8262, lng: 90.3654, al: ['pallabi', 'pollobi', 'palabi'] },
    { id: 20, parent: 1, en: 'Mohammadpur', bn: 'মোহাম্মদপুর', lat: 23.7640, lng: 90.3600, al: ['mohammadpur', 'mohammedpur', 'mohamadpur', 'muhammadpur'] },
    { id: 21, parent: 20, en: 'Shyamoli', bn: 'শ্যামলী', lat: 23.7745, lng: 90.3653, al: ['shyamoli', 'shamoli', 'shyamli'] },
    { id: 22, parent: 20, en: 'Adabor', bn: 'আদাবর', lat: 23.7712, lng: 90.3562, al: ['adabor', 'adabar'] },
    { id: 23, parent: 20, en: 'Town Hall', bn: 'টাউন হল', lat: 23.7590, lng: 90.3612, al: ['town hall', 'townhall'] },
    { id: 30, parent: 1, en: 'Uttara', bn: 'উত্তরা', lat: 23.8740, lng: 90.3900, al: ['uttara', 'uttra', 'utara'] },
    { id: 31, parent: 30, en: 'Uttara Sector 4', bn: 'উত্তরা সেক্টর ৪', lat: 23.8640, lng: 90.4005, al: ['sector 4', 'uttara 4'] },
    { id: 32, parent: 30, en: 'Uttara Sector 7', bn: 'উত্তরা সেক্টর ৭', lat: 23.8737, lng: 90.3920, al: ['sector 7', 'uttara 7'] },
    { id: 33, parent: 30, en: 'Uttara Sector 10', bn: 'উত্তরা সেক্টর ১০', lat: 23.8800, lng: 90.3760, al: ['sector 10', 'uttara 10'] },
    { id: 34, parent: 30, en: 'Uttara Sector 13', bn: 'উত্তরা সেক্টর ১৩', lat: 23.8705, lng: 90.3830, al: ['sector 13', 'uttara 13'] },
    { id: 40, parent: 1, en: 'Dhanmondi', bn: 'ধানমন্ডি', lat: 23.7461, lng: 90.3742, al: ['dhanmondi', 'dhanmandi', 'dhanmondi 27'] },
    { id: 50, parent: 1, en: 'Bashundhara R/A', bn: 'বসুন্ধরা আ/এ', lat: 23.8150, lng: 90.4300, al: ['bashundhara', 'basundhara', 'bosundhora'] },
  ];
  const AREA_BY_ID = {};
  for (const a of BB.AREAS) { AREA_BY_ID[a.id] = a; a.keys = [...new Set([...a.al, a.en, a.bn].map(norm))]; }
  BB.area = id => AREA_BY_ID[id];
  BB.areaPath = id => { const p = []; let a = AREA_BY_ID[id]; while (a) { p.unshift(a.id); a = AREA_BY_ID[a.parent]; } return p; };
  BB.areaChildren = id => BB.AREAS.filter(a => a.parent === id);
  BB.searchAreas = function (q) {
    const n = norm(q);
    if (!n) return [];
    const scored = [];
    for (const a of BB.AREAS) {
      if (a.parent === null) continue;
      let best = 0;
      for (const k of a.keys) {
        let s = 0;
        if (k.startsWith(n)) s = 1 + n.length / k.length;
        else if (k.includes(n)) s = 0.8;
        else s = similarity(n, k);
        if (s > best) best = s;
      }
      if (best >= 0.45) scored.push({ a, s: best + (BB.areaChildren(a.id).length ? 0.05 : 0) });
    }
    return scored.sort((x, y) => y.s - x.s).slice(0, 8).map(x => x.a);
  };

  const L = (en, bn) => ({ en, bn });
  BB.LABELS = {
    kind: { flat: L('Flat', 'ফ্ল্যাট'), house: L('House', 'বাড়ি'), studio: L('Studio', 'স্টুডিও'), sublet: L('Sublet room', 'সাবলেট রুম'), mess_seat: L('Mess seat', 'মেস সিট') },
    accepts: { family: L('Family', 'পরিবার'), single_men: L('Single men', 'ব্যাচেলর (পুরুষ)'), single_women: L('Single women', 'ব্যাচেলর (নারী)'), students: L('Students', 'ছাত্রছাত্রী'), job_holders: L('Job holders', 'চাকরিজীবী') },
    amenity: {
      lift: L('Lift', 'লিফট'), generator: L('Generator', 'জেনারেটর'), parking_car: L('Car parking', 'গাড়ি পার্কিং'), parking_bike: L('Bike parking', 'বাইক পার্কিং'),
      guard: L('Security guard', 'সিকিউরিটি গার্ড'), cctv: L('CCTV', 'সিসিটিভি'), gated: L('Gated', 'গেটেড'), rooftop: L('Rooftop access', 'ছাদে যাওয়া যায়'),
      servant_room: L('Servant room', 'সার্ভেন্ট রুম'), attached_bath: L('Attached bath', 'অ্যাটাচড বাথ'), wifi: L('Wi-Fi', 'ওয়াই-ফাই'),
      pets_ok: L('Pets allowed', 'পোষা প্রাণী চলবে'), smoking_ok: L('Smoking allowed', 'ধূমপান চলবে'),
    },
    furnishing: { 0: L('Unfurnished', 'আনফার্নিশড'), 1: L('Semi-furnished', 'সেমি-ফার্নিশড'), 2: L('Furnished', 'ফার্নিশড') },
    gas: { pipeline: L('Pipeline gas', 'লাইনের গ্যাস'), cylinder: L('Cylinder gas', 'সিলিন্ডার গ্যাস'), none: L('No gas', 'গ্যাস নেই') },
    bill: { tenant: L('Paid by tenant', 'ভাড়াটিয়া দেবেন'), in_rent: L('Included in rent', 'ভাড়ার মধ্যে'), in_service: L('Included in service charge', 'সার্ভিস চার্জের মধ্যে') },
    electricity: { prepaid: L('Prepaid meter (tenant)', 'প্রিপেইড মিটার (ভাড়াটিয়া)'), postpaid: L('Postpaid meter (tenant)', 'পোস্টপেইড মিটার (ভাড়াটিয়া)'), in_rent: L('Included in rent', 'ভাড়ার মধ্যে') },
    role: { owner: L('Owner', 'মালিক'), family: L("Owner's family", 'মালিকের পরিবার'), caretaker: L('Caretaker', 'কেয়ারটেকার'), agent: L('Agent', 'এজেন্ট') },
    docType: { nid: L('NID (laminated)', 'এনআইডি (পুরনো)'), smart_nid: L('Smart NID', 'স্মার্ট এনআইডি'), passport: L('Passport', 'পাসপোর্ট'), driving_licence: L('Driving licence', 'ড্রাইভিং লাইসেন্স') },
    docKind: {
      nid_front: L('ID front', 'আইডির সামনের দিক'), nid_back: L('ID back', 'আইডির পেছনের দিক'), passport: L('Passport page', 'পাসপোর্টের পাতা'), selfie: L('Selfie', 'সেলফি'),
      holding_tax: L('Holding tax receipt', 'হোল্ডিং ট্যাক্সের রসিদ'), utility_bill: L('Utility bill', 'ইউটিলিটি বিল'), deed: L('Deed / mutation', 'দলিল / নামজারি'),
      owner_permission: L("Owner's permission letter", 'মালিকের অনুমতিপত্র'), owner_nid: L("Owner's NID", 'মালিকের এনআইডি'), bank_proof: L('Bank proof', 'ব্যাংকের প্রমাণ'),
    },
    room: { exterior: L('Building', 'ভবন'), living: L('Living room', 'বসার ঘর'), bedroom: L('Bedroom', 'শোবার ঘর'), kitchen: L('Kitchen', 'রান্নাঘর'), bath: L('Bathroom', 'বাথরুম'), balcony: L('Balcony', 'বারান্দা') },
    listingStatus: {
      draft: L('Draft', 'খসড়া'), in_review: L('In review', 'যাচাই চলছে'), active: L('Live', 'চালু'), paused: L('Paused', 'বিরতি'),
      let_agreed: L('Let agreed', 'ভাড়া চূড়ান্ত'), closed: L('Closed', 'বন্ধ'), rejected: L('Rejected', 'বাতিল'), removed: L('Removed', 'সরানো হয়েছে'),
    },
    advanceStatus: {
      awaiting_payment: L('Waiting for transfer', 'ট্রান্সফারের অপেক্ষা'), held: L('Held at the bank', 'ব্যাংকে জমা আছে'), released: L('Paid to landlord', 'বাড়িওয়ালাকে দেওয়া হয়েছে'),
      refunded: L('Refunded', 'ফেরত দেওয়া হয়েছে'), disputed: L('Problem reported', 'সমস্যা জানানো হয়েছে'), cancelled: L('Cancelled', 'বাতিল'),
    },
  };
  BB.label = (group, code, lang) => { const g = BB.LABELS[group]; const x = g && g[code]; return x ? (lang === 'bn' ? x.bn : x.en) : String(code); };

  // ───────────── Persistence and sync ─────────────
  function saveLocal() { try { store.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage full or blocked */ } }
  function emit(src) { for (const fn of listeners) { try { fn(src); } catch (e) { console.error(e); } } }
  BB.subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn); };
  BB.state = () => state;

  BB.load = function () {
    if (state) return state;
    try { state = JSON.parse(store.getItem(KEY)); } catch (e) { state = null; }
    if (!state || state.schema !== SCHEMA) { state = seed(); saveLocal(); }
    jobs();
    return state;
  };
  BB.commit = function () {
    state.rev = (state.rev || 0) + 1;
    state.client = CLIENT;
    state.savedAt = iso(now());
    saveLocal();
    if (serverMode) { clearTimeout(pushTimer); pushTimer = setTimeout(push, 120); }
    emit('local');
  };
  BB.reset = function () {
    state = seed();
    BB.commit();
  };
  function push() {
    if (!root.fetch) return;
    root.fetch('api/state', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(state) }).catch(() => {});
  }
  if (root.addEventListener) {
    root.addEventListener('storage', e => {
      if (e.key !== KEY || !e.newValue) return;
      try { const s = JSON.parse(e.newValue); if (s.schema === SCHEMA) { state = s; emit('remote'); } } catch (x) { /* ignore */ }
    });
  }
  BB.connect = function () {
    const proto = root.location && root.location.protocol;
    if (!root.fetch || !root.EventSource || !/^https?:$/.test(proto || '')) return Promise.resolve(false);
    return root.fetch('api/state', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('no server'))))
      .then(remote => {
        serverMode = true;
        if (remote && remote.schema === SCHEMA) { state = remote; saveLocal(); emit('remote'); } else push();
        const es = new root.EventSource('api/events');
        es.onmessage = ev => {
          try {
            const s = JSON.parse(ev.data);
            if (!s || s.schema !== SCHEMA || s.client === CLIENT) return;
            state = s;
            saveLocal();
            emit('remote');
          } catch (x) { /* ignore */ }
        };
        return true;
      })
      .catch(() => false);
  };
  BB.isShared = () => serverMode;

  // ───────────── Lookups ─────────────
  const by = (list, id) => state[list].find(x => x.id === id);
  BB.get = {
    user: id => by('users', id),
    userByPhone: p => state.users.find(u => u.phone === p && u.status !== 'deleted'),
    staff: id => by('staff', id),
    listing: id => by('listings', id),
    property: id => by('properties', id),
    doc: id => by('docs', id),
    conv: id => by('conversations', id),
    record: id => by('records', id),
    recordByCode: c => state.records.find(r => r.verifyCode === c),
    deal: id => by('deals', id),
    advance: id => by('advances', id),
    sub: id => by('scoutSubs', id),
    idCheck: id => by('idChecks', id),
    payoutAccount: id => by('payoutAccounts', id),
    report: id => by('reports', id),
  };
  BB.docsOf = userId => state.docs.filter(d => d.userId === userId);
  BB.latestIdCheck = userId => state.idChecks.filter(c => c.userId === userId).sort((a, b) => ms(b.createdAt) - ms(a.createdAt))[0];
  BB.messagesOf = convId => state.messages.filter(m => m.convId === convId).sort((a, b) => ms(a.at) - ms(b.at));
  BB.viewingsOf = convId => state.viewings.filter(v => v.convId === convId).sort((a, b) => ms(a.createdAt) - ms(b.createdAt));
  BB.latestViewing = convId => BB.viewingsOf(convId).slice(-1)[0];
  BB.recordOf = convId => state.records.filter(r => r.convId === convId).sort((a, b) => ms(a.createdAt) - ms(b.createdAt)).slice(-1)[0];
  BB.dealOf = convId => state.deals.filter(d => d.convId === convId && d.status !== 'withdrawn').slice(-1)[0];
  BB.advanceOf = dealId => state.advances.find(a => a.dealId === dealId && a.status !== 'cancelled');
  BB.payoutsOf = advId => state.payouts.filter(p => p.advanceId === advId);
  BB.approvedPayoutAccount = userId => state.payoutAccounts.find(p => p.userId === userId && p.status === 'approved');
  BB.pendingPayoutAccount = userId => state.payoutAccounts.find(p => p.userId === userId && p.status === 'pending');
  BB.scoutOf = userId => state.scouts.find(s => s.userId === userId);
  BB.convsOf = userId => state.conversations.filter(c => c.renterId === userId || c.landlordId === userId)
    .sort((a, b) => ms(lastAt(b)) - ms(lastAt(a)));
  function lastAt(c) { const m = BB.messagesOf(c.id).slice(-1)[0]; return m ? m.at : c.createdAt; }
  BB.lastAt = lastAt;
  BB.unreadCount = userId => state.conversations.filter(c => c.renterId === userId || c.landlordId === userId)
    .reduce((n, c) => n + state.messages.filter(m => m.convId === c.id && m.senderId !== userId && ms(m.at) > ms((c.readAt || {})[userId] || 0)).length, 0);
  BB.notificationsOf = userId => state.notifications.filter(n => n.userId === userId).sort((a, b) => ms(b.at) - ms(a.at));
  BB.unreadNotifications = userId => state.notifications.filter(n => n.userId === userId && !n.read).length;
  BB.favouriteOf = (userId, listingId) => state.favourites.some(f => f.userId === userId && f.listingId === listingId);

  BB.view = function (l) {
    const p = BB.get.property(l.propertyId);
    const area = BB.area(p.areaId);
    const lister = BB.get.user(l.listerId);
    const trust = p.proofStatus === 'approved' ? 2 : lister && lister.level >= 2 ? 1 : 0;
    return { l, p, area, lister, total: l.rent + l.service, trust, path: BB.areaPath(p.areaId) };
  };
  BB.title = (l, lang) => (lang === 'bn' ? l.title_bn : l.title_en);
  function makeTitles(kind, beds, areaId, accepts) {
    const a = BB.area(areaId);
    const who = accepts && accepts.length === 1 ? accepts[0] : null;
    const forEn = who ? ' for ' + BB.label('accepts', who, 'en').toLowerCase() : '';
    const forBn = who ? ' (' + BB.label('accepts', who, 'bn') + ')' : '';
    switch (kind) {
      case 'house': return { en: `${beds}-bed house in ${a.en}`, bn: `${toBn(beds)} বেডরুমের বাড়ি, ${a.bn}` };
      case 'studio': return { en: `Studio flat in ${a.en}`, bn: `স্টুডিও ফ্ল্যাট, ${a.bn}` };
      case 'sublet': return { en: `Sublet room in ${a.en}${forEn}`, bn: `সাবলেট রুম, ${a.bn}${forBn}` };
      case 'mess_seat': return { en: `Mess seat in ${a.en}${forEn}`, bn: `মেস সিট, ${a.bn}${forBn}` };
      default: return { en: `${beds}-bed flat in ${a.en}`, bn: `${toBn(beds)} বেডরুমের ফ্ল্যাট, ${a.bn}` };
    }
  }
  BB.makeTitles = makeTitles;

  // ───────────── Search (mirrors the listing_search query in ARCHITECTURE.md §9.3) ─────────────
  BB.defaultFilters = () => ({
    areaIds: [], kinds: [], minTotal: null, maxTotal: null, minBeds: null, minBaths: null, accepts: [], availableBy: null,
    furnishing: [], minSize: null, maxSize: null, floor: 'any', lift: false, gas: 'any', bills: [], amenities: [],
    maxAdvance: null, ownerChecked: false, addedWithin: null, hideLet: true, keywords: '', bounds: null, sort: 'recommended',
  });
  BB.search = function (f) {
    f = Object.assign(BB.defaultFilters(), f || {});
    const kw = norm(f.keywords);
    let rows = state.listings
      .filter(l => l.status === 'active' || (!f.hideLet && l.status === 'let_agreed'))
      .map(BB.view)
      .filter(v => v.lister && v.lister.status === 'active');
    if (f.areaIds.length) rows = rows.filter(v => f.areaIds.some(id => v.path.includes(id)));
    if (f.kinds.length) rows = rows.filter(v => f.kinds.includes(v.l.kind));
    if (f.minTotal != null) rows = rows.filter(v => v.total >= f.minTotal);
    if (f.maxTotal != null) rows = rows.filter(v => v.total <= f.maxTotal);
    if (f.minBeds != null) rows = rows.filter(v => v.l.beds >= f.minBeds);
    if (f.minBaths != null) rows = rows.filter(v => v.l.baths >= f.minBaths);
    if (f.accepts.length) rows = rows.filter(v => f.accepts.every(a => v.l.accepts.includes(a)));
    if (f.availableBy) rows = rows.filter(v => v.l.availableFrom <= f.availableBy);
    if (f.furnishing.length) rows = rows.filter(v => f.furnishing.includes(String(v.l.furnishing)));
    if (f.minSize != null) rows = rows.filter(v => (v.l.size || 0) >= f.minSize);
    if (f.maxSize != null) rows = rows.filter(v => v.l.size && v.l.size <= f.maxSize);
    if (f.floor === 'ground') rows = rows.filter(v => v.l.floor === 0);
    if (f.floor === 'low') rows = rows.filter(v => v.l.floor >= 1 && v.l.floor <= 3);
    if (f.floor === 'high') rows = rows.filter(v => v.l.floor >= 4);
    if (f.lift) rows = rows.filter(v => v.l.amenities.includes('lift'));
    if (f.gas !== 'any') rows = rows.filter(v => v.l.gas === f.gas);
    if (f.bills.includes('water')) rows = rows.filter(v => v.l.waterBill !== 'tenant');
    if (f.bills.includes('gas')) rows = rows.filter(v => v.l.gasBill !== 'tenant');
    if (f.bills.includes('electricity')) rows = rows.filter(v => v.l.electricity === 'in_rent');
    if (f.amenities.length) rows = rows.filter(v => f.amenities.every(a => v.l.amenities.includes(a)));
    if (f.maxAdvance != null) rows = rows.filter(v => v.l.advanceMonths <= f.maxAdvance);
    if (f.ownerChecked) rows = rows.filter(v => v.trust >= 2);
    if (f.addedWithin) rows = rows.filter(v => now() - ms(v.l.publishedAt) <= f.addedWithin * DAY);
    if (kw) rows = rows.filter(v => norm([v.l.title_en, v.l.title_bn, v.area.en, v.area.bn, v.l.description].join(' ')).includes(kw));
    if (f.bounds) {
      const [w, s, e, n] = f.bounds;
      rows = rows.filter(v => v.p.pub.lng >= w && v.p.pub.lng <= e && v.p.pub.lat >= s && v.p.pub.lat <= n);
    }
    const byNew = (a, b) => ms(b.l.publishedAt) - ms(a.l.publishedAt);
    if (f.sort === 'newest') rows.sort(byNew);
    else if (f.sort === 'price_asc') rows.sort((a, b) => a.total - b.total || byNew(a, b));
    else if (f.sort === 'price_desc') rows.sort((a, b) => b.total - a.total || byNew(a, b));
    else rows.sort((a, b) => (a.l.status === 'let_agreed') - (b.l.status === 'let_agreed') || b.trust - a.trust || byNew(a, b));
    return rows;
  };
  BB.areaMedian = function (areaId, kind) {
    const parent = BB.area(areaId).parent === 1 ? areaId : BB.area(areaId).parent;
    const xs = state.listings.filter(l => l.kind === kind && ['active', 'let_agreed'].includes(l.status))
      .map(BB.view).filter(v => v.path.includes(parent)).map(v => v.total).sort((a, b) => a - b);
    if (!xs.length) return null;
    return xs[Math.floor(xs.length / 2)];
  };

  // ───────────── Audit and notifications ─────────────
  function audit(actor, action, target, reason, meta) {
    const prev = state.audit.length ? state.audit[state.audit.length - 1].hash : '';
    const e = { id: state.audit.length + 1, at: iso(now()), actor, action, target: target || null, reason: reason || null, meta: meta || null, prevHash: prev };
    e.hash = sha256(prev + JSON.stringify([e.id, e.at, e.actor, e.action, e.target, e.reason, e.meta]));
    state.audit.push(e);
    return e;
  }
  BB.audit = (actor, action, target, reason, meta) => { const e = audit(actor, action, target, reason, meta); BB.commit(); return e; };
  BB.verifyAudit = function () {
    let prev = '';
    for (const e of state.audit) {
      const h = sha256(prev + JSON.stringify([e.id, e.at, e.actor, e.action, e.target, e.reason, e.meta]));
      if (h !== e.hash || e.prevHash !== prev) return { ok: false, at: e.id };
      prev = e.hash;
    }
    return { ok: true, count: state.audit.length };
  };
  function notify(userId, en, bn, link) {
    state.notifications.push({ id: uid('n'), userId, at: iso(now()), en, bn, link: link || null, read: false });
  }
  function sys(convId, en, bn, kind) {
    state.messages.push({ id: uid('m'), convId, senderId: null, system: kind || 'info', body_en: en, body_bn: bn, at: iso(now()) });
  }

  // ───────────── Documents (the ID vault) ─────────────
  function addDoc(userId, kind, art, at) {
    const prev = state.docs.filter(d => d.userId === userId && d.kind === kind).sort((a, b) => b.version - a.version)[0];
    const id = uid('doc');
    const d = {
      id, userId, kind, version: prev ? prev.version + 1 : 1, replacesId: prev ? prev.id : null,
      storageKey: 'vault/' + sha256(id).slice(0, 24) + '.enc', keyId: 'dk-2026-10', mime: 'image/jpeg',
      bytes: 180000 + Math.floor(Math.random() * 240000), uploadedAt: iso(at || now()), art, retainUntil: null, purgedAt: null,
    };
    d.sha256 = sha256(JSON.stringify(art) + '|' + d.id);
    state.docs.push(d);
    return d;
  }
  BB.verifyDocs = function () {
    let bad = 0;
    for (const d of state.docs) if (!d.purgedAt && sha256(JSON.stringify(d.art) + '|' + d.id) !== d.sha256) bad++;
    return { ok: bad === 0, count: state.docs.length, bad };
  };

  // ───────────── Accounts ─────────────
  BB.normalisePhone = function (raw) {
    let p = toAscii(String(raw || '')).replace(/[^\d+]/g, '');
    if (p.startsWith('+880')) p = '0' + p.slice(4);
    else if (p.startsWith('880')) p = '0' + p.slice(3);
    else if (p.startsWith('1') && p.length === 10) p = '0' + p;
    return /^01[3-9]\d{8}$/.test(p) ? p : null;
  };
  BB.createUser = function ({ phone, name, lang }) {
    if (BB.get.userByPhone(phone)) throw err('This number already has an account.', 'এই নম্বরে আগে থেকেই অ্যাকাউন্ট আছে।');
    const u = {
      id: uid('u'), kind: 'renter', name_en: name, name_bn: name, phone, lang: lang || 'bn', level: 1, status: 'active',
      createdAt: iso(now()), avatar: Math.floor(Math.random() * 1000), household: [], householdSize: null, occupation: '', seeded: false,
      busyToday: false, callHours: { days: ['sat', 'sun', 'mon', 'tue', 'wed', 'thu'], from: '10:00', to: '20:00' },
    };
    state.users.push(u);
    audit('user:' + u.id, 'account.created', u.id);
    BB.commit();
    return u;
  };
  BB.updateProfile = function (userId, patch) {
    const u = BB.get.user(userId);
    Object.assign(u, patch);
    BB.commit();
  };
  BB.loggedIn = function (userId) {
    const u = BB.get.user(userId);
    let cancelled = false;
    if (u.status === 'deletion_pending') {
      const d = state.deletions.find(x => x.userId === userId && !x.cancelledAt && !x.completedAt);
      if (d) d.cancelledAt = iso(now());
      u.status = 'active';
      cancelled = true;
      audit('user:' + userId, 'deletion.cancelled', userId);
    }
    BB.commit();
    return { cancelled };
  };

  // ───────────── Identity checks (level 2) ─────────────
  BB.ageOn = function (dob, at) {
    const d = new Date(dob), t = new Date(at || now());
    let a = t.getUTCFullYear() - d.getUTCFullYear();
    if (t.getUTCMonth() < d.getUTCMonth() || (t.getUTCMonth() === d.getUTCMonth() && t.getUTCDate() < d.getUTCDate())) a--;
    return a;
  };
  BB.checkDocNumber = function (docType, number) {
    const n = toAscii(String(number || '')).replace(/\s|-/g, '').toUpperCase();
    if (docType === 'passport') return /^[A-Z]{1,2}\d{7,8}$/.test(n) ? n : null;
    if (docType === 'driving_licence') return /^[A-Z0-9]{10,16}$/.test(n) ? n : null;
    return /^(\d{10}|\d{13}|\d{17})$/.test(n) ? n : null;
  };
  BB.submitIdCheck = function (userId, { docType, number, legalName, dob }) {
    const u = BB.get.user(userId);
    const n = BB.checkDocNumber(docType, number);
    if (!n) throw err('That document number does not look right.', 'নথির নম্বরটি সঠিক মনে হচ্ছে না।');
    if (BB.ageOn(dob) < 18) throw err('You must be 18 or older to use Basha Bari.', 'বাসাবাড়ি ব্যবহার করতে বয়স ১৮ বা তার বেশি হতে হবে।');
    const numberHash = sha256('pepper:' + n);
    const dup = state.idChecks.find(c => c.numberHash === numberHash && c.status === 'approved' && c.userId !== userId);
    const art = { name: legalName, number: n, dob, docType, avatar: u.avatar };
    const front = addDoc(userId, docType === 'passport' ? 'passport' : 'nid_front', Object.assign({ side: 'front' }, art));
    const back = docType === 'passport' ? null : addDoc(userId, 'nid_back', Object.assign({ side: 'back' }, art));
    const selfie = addDoc(userId, 'selfie', { avatar: u.avatar, name: legalName });
    const c = {
      id: uid('kyc'), userId, docType, numberHash, docNumber: n, docLast4: n.slice(-4), legalName, dob,
      frontId: front.id, backId: back ? back.id : null, selfieId: selfie.id, liveness: true,
      faceScore: Math.round((0.78 + Math.random() * 0.17) * 100) / 100, dupOf: dup ? dup.userId : null,
      status: 'pending', reviewedBy: null, reviewedAt: null, rejectReason: null, createdAt: iso(now()),
    };
    state.idChecks.push(c);
    audit('user:' + userId, 'kyc.submitted', c.id);
    BB.commit();
    return c;
  };
  BB.reviewIdCheck = function (staffId, checkId, approve, reason) {
    const c = BB.get.idCheck(checkId);
    if (!c || c.status !== 'pending') throw err('This check is no longer waiting for review.');
    const u = BB.get.user(c.userId);
    c.status = approve ? 'approved' : 'rejected';
    c.reviewedBy = staffId;
    c.reviewedAt = iso(now());
    c.rejectReason = approve ? null : reason || 'Not clear';
    if (approve) {
      u.level = 2;
      u.verifiedAt = c.reviewedAt;
      u.legalName = c.legalName;
      notify(u.id, 'Your ID is verified. You can now message landlords, book viewings and list a home.', 'আপনার পরিচয় যাচাই হয়েছে। এখন আপনি বাড়িওয়ালাকে বার্তা পাঠাতে, বাসা দেখার সময় ঠিক করতে আর বাসা দিতে পারবেন।', 'account');
    } else {
      notify(u.id, 'We could not verify your ID: ' + c.rejectReason + '. Please try again.', 'আপনার পরিচয় যাচাই করা যায়নি: ' + c.rejectReason + '। আবার চেষ্টা করুন।', 'verify');
    }
    audit('staff:' + staffId, approve ? 'kyc.approved' : 'kyc.rejected', c.id, c.rejectReason);
    BB.commit();
  };
  BB.revealPII = function (staffId, target, field, reason) {
    if (!reason || reason.trim().length < 5) throw err('Type a reason of at least 5 characters.');
    audit('staff:' + staffId, 'pii.revealed', target, reason.trim(), { field });
    BB.commit();
    return true;
  };

  // ───────────── Listings ─────────────
  function fuzz(lat, lng, R) {
    const r = R || Math.random;
    const d = 150 + r() * 250;
    const b = r() * 2 * Math.PI;
    return { lat: +(lat + (d * Math.cos(b)) / 111320).toFixed(6), lng: +(lng + (d * Math.sin(b)) / (111320 * Math.cos((lat * Math.PI) / 180))).toFixed(6) };
  }
  function roomsFor(kind, beds, baths, balconies) {
    if (kind === 'mess_seat') return ['exterior', 'bedroom', 'bath', 'kitchen'];
    if (kind === 'sublet') return ['exterior', 'bedroom', 'bath', 'kitchen'];
    const r = ['exterior', 'living'];
    for (let i = 1; i <= Math.max(1, beds); i++) r.push('bedroom');
    r.push('kitchen');
    for (let i = 1; i <= Math.max(1, baths); i++) r.push('bath');
    if (balconies > 0) r.push('balcony');
    return r;
  }
  BB.roomsFor = roomsFor;
  function photosFor(rooms, seedBase) {
    const count = {};
    return rooms.map((room, i) => { count[room] = (count[room] || 0) + 1; return { room, n: count[room], seed: seedBase * 31 + i * 7, inApp: true }; });
  }
  BB.createListing = function (userId, d, opts) {
    const u = BB.get.user(userId);
    if (!u || u.level < 2) throw err('Verify your ID before listing a home.', 'বাসা দেওয়ার আগে পরিচয় যাচাই করুন।');
    const area = BB.area(d.areaId);
    if (!area) throw err('Choose the area.', 'এলাকা বেছে নিন।');
    const exact = d.exact || { lat: area.lat, lng: area.lng };
    const pId = uid('prop');
    const prop = {
      id: pId, ownerId: userId, areaId: d.areaId, address: d.address || '', exact, pub: fuzz(exact.lat, exact.lng),
      listerRole: d.role || 'owner', relation: d.relation || '', proofStatus: 'pending', createdAt: iso(now()),
    };
    state.properties.push(prop);
    const proofKinds = d.proofKinds && d.proofKinds.length ? d.proofKinds : ['holding_tax'];
    for (const k of proofKinds) {
      const doc = addDoc(userId, k, { kind: k, name: u.legalName || u.name_en, address: d.address || area.en });
      state.proofs.push({ propertyId: pId, docId: doc.id, status: 'pending', reviewedBy: null });
    }
    const titles = makeTitles(d.kind, d.beds, d.areaId, d.accepts);
    const seedBase = Math.floor(Math.random() * 9000) + 100;
    const l = {
      id: uid('lst'), propertyId: pId, listerId: userId, kind: d.kind, status: 'in_review', pricePeriod: 'month',
      rent: +d.rent, service: +d.service || 0, serviceCovers: d.serviceCovers || '', advanceMonths: +d.advanceMonths || 1,
      beds: +d.beds || 0, baths: +d.baths || 0, balconies: +d.balconies || 0, size: d.size ? +d.size : null,
      floor: d.floor != null && d.floor !== '' ? +d.floor : null, floors: d.floors ? +d.floors : null, furnishing: +d.furnishing || 0,
      gas: d.gas || 'pipeline', waterBill: d.waterBill || 'tenant', gasBill: d.gasBill || 'tenant', electricity: d.electricity || 'prepaid',
      amenities: d.amenities || [], accepts: d.accepts && d.accepts.length ? d.accepts : ['family'], availableFrom: d.availableFrom || iso(now()).slice(0, 10),
      title_en: titles.en, title_bn: titles.bn, description: d.description || '', callHours: u.callHours,
      photos: photosFor(roomsFor(d.kind, +d.beds, +d.baths, +d.balconies), seedBase), publishedAt: null, createdAt: iso(now()),
      updatedAt: iso(now()), views: 0, scoutId: (opts && opts.scoutId) || null, palette: seedBase % 6,
    };
    state.listings.push(l);
    audit('user:' + userId, 'listing.submitted', l.id);
    BB.commit();
    return l;
  };
  BB.reviewListing = function (staffId, listingId, approve, reason) {
    const l = BB.get.listing(listingId);
    if (!l || l.status !== 'in_review') throw err('This listing is not waiting for review.');
    const p = BB.get.property(l.propertyId);
    if (approve) {
      l.status = 'active';
      l.publishedAt = iso(now());
      p.proofStatus = 'approved';
      for (const pr of state.proofs.filter(x => x.propertyId === p.id)) { pr.status = 'approved'; pr.reviewedBy = staffId; }
      notify(l.listerId, 'Your home is live: ' + l.title_en, 'আপনার বাসা এখন সবাই দেখতে পাচ্ছে: ' + l.title_bn, 'listing/' + l.id);
      const sub = state.scoutSubs.find(s => s.listingId === l.id);
      if (sub) {
        sub.status = 'live';
        sub.earnedLiveAt = iso(now());
        notify(sub.scoutId, 'A home you brought in is live. You earned ৳150.', 'আপনার আনা একটি বাসা চালু হয়েছে। আপনি ৳১৫০ পেলেন।', 'scout');
      }
      alertSavedSearches(l);
    } else {
      l.status = 'rejected';
      l.rejectReason = reason || 'Needs changes';
      p.proofStatus = 'rejected';
      notify(l.listerId, 'Your listing needs changes: ' + l.rejectReason, 'আপনার বিজ্ঞাপনে কিছু পরিবর্তন দরকার: ' + l.rejectReason, 'homes');
    }
    audit('staff:' + staffId, approve ? 'listing.approved' : 'listing.rejected', l.id, reason || null);
    BB.commit();
  };
  function alertSavedSearches(l) {
    const v = BB.view(l);
    for (const s of state.savedSearches) {
      if (s.alert === 'off' || s.userId === l.listerId) continue;
      const hits = BB.search(Object.assign({}, s.filters, { bounds: null }));
      if (hits.some(h => h.l.id === v.l.id)) notify(s.userId, 'New home for your saved search: ' + l.title_en, 'আপনার সংরক্ষিত খোঁজে নতুন বাসা: ' + l.title_bn, 'listing/' + l.id);
    }
  }
  BB.setListingStatus = function (userId, listingId, status) {
    const l = BB.get.listing(listingId);
    if (!l || l.listerId !== userId) throw err('Not your listing.');
    const allowed = { active: ['paused', 'let_agreed', 'closed'], paused: ['active', 'closed'], let_agreed: ['active', 'closed'], rejected: ['closed'], in_review: ['closed'] };
    if (!(allowed[l.status] || []).includes(status)) throw err('That change is not possible now.', 'এখন এই পরিবর্তন করা যাবে না।');
    l.status = status;
    l.updatedAt = iso(now());
    audit('user:' + userId, 'listing.' + status, l.id);
    BB.commit();
  };
  BB.countView = function (listingId, userId) {
    const l = BB.get.listing(listingId);
    if (!l || l.listerId === userId) return;
    l.views = (l.views || 0) + 1;
    BB.commit();
  };
  BB.toggleFavourite = function (userId, listingId) {
    const i = state.favourites.findIndex(f => f.userId === userId && f.listingId === listingId);
    if (i >= 0) state.favourites.splice(i, 1); else state.favourites.push({ userId, listingId, at: iso(now()) });
    BB.commit();
    return i < 0;
  };
  BB.saveSearch = function (userId, filters, label) {
    const s = { id: uid('ss'), userId, filters: clone(Object.assign({}, filters, { bounds: null })), label, alert: 'instant', createdAt: iso(now()) };
    state.savedSearches.push(s);
    BB.commit();
    return s;
  };
  BB.setSavedAlert = function (id, alert) { const s = state.savedSearches.find(x => x.id === id); if (s) { s.alert = alert; BB.commit(); } };
  BB.deleteSaved = function (id) { state.savedSearches = state.savedSearches.filter(x => x.id !== id); BB.commit(); };

  // ───────────── Conversations and the handshake (ARCHITECTURE.md §4) ─────────────
  BB.startConversation = function (renterId, listingId) {
    const r = BB.get.user(renterId);
    if (!r || r.level < 2) throw err('Verify your ID to contact landlords.', 'বাড়িওয়ালার সাথে যোগাযোগ করতে পরিচয় যাচাই করুন।');
    const l = BB.get.listing(listingId);
    if (l.listerId === renterId) throw err('This is your own listing.', 'এটি আপনার নিজের বিজ্ঞাপন।');
    if (state.blocks.some(b => (b.blocker === renterId && b.blocked === l.listerId) || (b.blocker === l.listerId && b.blocked === renterId))) throw err('You cannot contact this person.', 'এই ব্যক্তির সাথে যোগাযোগ করা যাবে না।');
    let c = state.conversations.find(x => x.listingId === listingId && x.renterId === renterId);
    if (!c) {
      c = { id: uid('c'), listingId, renterId, landlordId: l.listerId, stage: 'enquiry', createdAt: iso(now()), readAt: {} };
      state.conversations.push(c);
      sys(c.id, 'Phone numbers, links and bKash numbers stay hidden until you both tap "Share my details". Never pay any advance before you have seen the home and signed.',
        'আপনারা দুজনেই "আমার তথ্য শেয়ার করুন" না চাপা পর্যন্ত ফোন নম্বর, লিংক আর বিকাশ নম্বর লুকানো থাকবে। বাসা না দেখে আর সই না করে কোনো অগ্রিম দেবেন না।', 'safety');
      BB.commit();
    }
    return c;
  };
  BB.maskText = function (body) {
    const src = String(body);
    const ascii = toAscii(src);
    const ranges = [];
    const res = [
      /(?:\+?\s*8\s*8[\s-]*)?0\s*1[3-9](?:[\s-]*\d){8}/g,
      /(?:^|\s)1[3-9]\d{8}(?=\s|$)/g,
      /\bhttps?:\/\/\S+|\bwww\.\S+/gi,
      /[\w.+-]+@[\w-]+\.[\w.]+/g,
      /\b[\w-]+\.(?:com|net|org|bd|me|io|xyz)\b\S*/gi,
    ];
    for (const re of res) { let m; while ((m = re.exec(ascii))) ranges.push([m.index, m.index + m[0].length]); }
    if (!ranges.length) return { text: src, masked: false };
    ranges.sort((a, b) => a[0] - b[0]);
    let out = '', pos = 0;
    for (const [a, b] of ranges) { if (a < pos) continue; out += src.slice(pos, a) + (src[a] === ' ' ? ' ' : '') + '•••'; pos = b; }
    return { text: out + src.slice(pos), masked: true };
  };
  const RISKY = /(advance|bkash|bikash|nagad|rocket|send money|booking money|token money|অগ্রিম|বিকাশ|নগদ|টাকা পাঠা|এডভান্স|অ্যাডভান্স)/i;
  BB.sendMessage = function (convId, senderId, body) {
    const c = BB.get.conv(convId);
    const text = String(body || '').trim().slice(0, 2000);
    if (!text) return null;
    const shared = !!BB.recordOf(convId);
    const m = shared ? { text, masked: false } : BB.maskText(text);
    const msg = { id: uid('m'), convId, senderId, body: m.text, masked: m.masked, at: iso(now()) };
    state.messages.push(msg);
    c.readAt = c.readAt || {};
    c.readAt[senderId] = msg.at;
    if (m.masked) sys(convId, 'A phone number or link was hidden. Details are shared only when you both agree.', 'একটি ফোন নম্বর বা লিংক লুকানো হয়েছে। দুজনে রাজি হলেই কেবল তথ্য শেয়ার হয়।', 'masked');
    if (RISKY.test(text)) {
      const recent = BB.messagesOf(convId).filter(x => x.system === 'warning' && now() - ms(x.at) < 10 * MIN);
      if (!recent.length) sys(convId, 'Safety: never send any advance before you have seen the home and signed. Use the protected advance, which is held at the bank until you move in.',
        'সতর্কতা: বাসা না দেখে আর সই না করে কোনো অগ্রিম পাঠাবেন না। সুরক্ষিত অগ্রিম ব্যবহার করুন — বাসায় ওঠা পর্যন্ত টাকা ব্যাংকে থাকে।', 'warning');
    }
    const other = senderId === c.renterId ? c.landlordId : c.renterId;
    const s = BB.get.user(senderId);
    notify(other, 'New message from ' + s.name_en, s.name_bn + ' আপনাকে বার্তা পাঠিয়েছেন', 'chat/' + convId);
    BB.commit();
    return msg;
  };
  BB.markRead = function (convId, userId) {
    const c = BB.get.conv(convId);
    if (!c) return;
    const last = BB.messagesOf(convId).slice(-1)[0];
    c.readAt = c.readAt || {};
    if (last && (!c.readAt[userId] || ms(c.readAt[userId]) < ms(last.at))) { c.readAt[userId] = iso(now()); BB.commit(); }
  };
  BB.proposeViewing = function (convId, userId, slots) {
    if (!slots || !slots.length) throw err('Choose at least one time.', 'অন্তত একটি সময় বেছে নিন।');
    const c = BB.get.conv(convId);
    const open = BB.viewingsOf(convId).filter(v => v.status === 'proposed');
    for (const v of open) v.status = 'cancelled';
    const v = { id: uid('v'), convId, proposedBy: userId, slots: slots.slice(0, 3), startsAt: null, status: 'proposed', createdAt: iso(now()), decidedAt: null };
    state.viewings.push(v);
    if (c.stage === 'enquiry') c.stage = 'viewing_proposed';
    const u = BB.get.user(userId);
    sys(convId, u.name_en + ' suggested viewing times.', u.name_bn + ' বাসা দেখার সময় প্রস্তাব করেছেন।', 'viewing');
    notify(userId === c.renterId ? c.landlordId : c.renterId, 'Viewing times suggested by ' + u.name_en, u.name_bn + ' বাসা দেখার সময় প্রস্তাব করেছেন', 'chat/' + convId);
    BB.commit();
    return v;
  };
  BB.acceptViewing = function (viewingId, userId, slot) {
    const v = state.viewings.find(x => x.id === viewingId);
    if (!v || v.status !== 'proposed') throw err('This proposal is no longer open.', 'এই প্রস্তাবটি আর খোলা নেই।');
    if (v.proposedBy === userId) throw err('The other person must choose the time.', 'অন্যজনকে সময় বেছে নিতে হবে।');
    const c = BB.get.conv(v.convId);
    v.status = 'accepted';
    v.startsAt = slot || v.slots[0];
    v.decidedAt = iso(now());
    c.stage = 'viewing_agreed';
    sys(c.id, 'Viewing agreed: ' + BB.fmt.dateTime(v.startsAt, 'en'), 'বাসা দেখার সময় ঠিক হয়েছে: ' + BB.fmt.dateTime(v.startsAt, 'bn'), 'viewing');
    notify(v.proposedBy, 'Viewing agreed for ' + BB.fmt.dateTime(v.startsAt, 'en'), 'বাসা দেখার সময় ঠিক হয়েছে: ' + BB.fmt.dateTime(v.startsAt, 'bn'), 'chat/' + c.id);
    audit('user:' + userId, 'viewing.accepted', v.id);
    BB.commit();
  };
  BB.declineViewing = function (viewingId, userId) {
    const v = state.viewings.find(x => x.id === viewingId);
    if (!v || v.status !== 'proposed') return;
    v.status = v.proposedBy === userId ? 'cancelled' : 'declined';
    v.decidedAt = iso(now());
    const u = BB.get.user(userId);
    sys(v.convId, u.name_en + (v.status === 'cancelled' ? ' withdrew the viewing times.' : ' declined the viewing times.'), u.name_bn + (v.status === 'cancelled' ? ' প্রস্তাবিত সময় তুলে নিয়েছেন।' : ' প্রস্তাবিত সময়ে রাজি হননি।'), 'viewing');
    BB.commit();
  };
  BB.consentsOf = convId => state.consents.filter(x => x.convId === convId && !x.used);
  BB.shareDetails = function (convId, userId) {
    const c = BB.get.conv(convId);
    const v = BB.latestViewing(convId);
    if (!v || v.status !== 'accepted') throw err('Agree a viewing time first.', 'আগে বাসা দেখার সময় ঠিক করুন।');
    if (state.records.some(r => r.viewingId === v.id)) throw err('Details are already shared for this viewing.', 'এই সময়ের জন্য তথ্য আগেই শেয়ার হয়েছে।');
    if (!BB.consentsOf(convId).some(x => x.userId === userId && x.viewingId === v.id)) {
      state.consents.push({ convId, userId, viewingId: v.id, at: iso(now()) });
      const u = BB.get.user(userId);
      sys(convId, u.name_en + ' agreed to share contact details.', u.name_bn + ' যোগাযোগের তথ্য শেয়ার করতে রাজি হয়েছেন।', 'consent');
      audit('user:' + userId, 'contact.consented', convId);
    }
    const both = [c.renterId, c.landlordId].every(id => BB.consentsOf(convId).some(x => x.userId === id && x.viewingId === v.id));
    let rec = null;
    if (both) rec = buildRecord(c, v);
    BB.commit();
    return rec;
  };
  function personSnap(u) {
    const k = BB.latestIdCheck(u.id);
    return { id: u.id, name: u.legalName || u.name_en, name_bn: u.name_bn, phone: u.phone, idLast4: k ? k.docLast4 : '----', idType: k ? k.docType : null, verifiedAt: u.verifiedAt || null, avatar: u.avatar };
  }
  function buildRecord(c, v) {
    const l = BB.get.listing(c.listingId);
    const p = BB.get.property(l.propertyId);
    const a = BB.area(p.areaId);
    const renter = BB.get.user(c.renterId);
    const landlord = BB.get.user(c.landlordId);
    const snap = {
      issuedAt: iso(now()), viewingAt: v.startsAt,
      renter: Object.assign(personSnap(renter), { household: renter.household, householdSize: renter.householdSize, occupation: renter.occupation }),
      landlord: Object.assign(personSnap(landlord), { role: p.listerRole, relation: p.relation, callHours: landlord.callHours }),
      home: {
        listingId: l.id, title_en: l.title_en, title_bn: l.title_bn, area_en: a.en, area_bn: a.bn, address: p.address, exact: p.exact,
        rent: l.rent, service: l.service, advanceMonths: l.advanceMonths, waterBill: l.waterBill, gasBill: l.gasBill, electricity: l.electricity, gas: l.gas,
      },
    };
    const prev = state.records.length ? state.records[state.records.length - 1].sha256 : null;
    const hash = sha256(JSON.stringify(snap));
    const r = { id: uid('rec'), convId: c.id, viewingId: v.id, snapshot: snap, sha256: hash, prevSha256: prev, verifyCode: hash.slice(0, 10).toUpperCase(), createdAt: snap.issuedAt };
    state.records.push(r);
    c.stage = 'contacts_shared';
    for (const x of BB.consentsOf(c.id)) x.used = true;
    sys(c.id, 'Contact details shared. You both received the same record.', 'যোগাযোগের তথ্য শেয়ার হয়েছে। আপনারা দুজনেই একই রেকর্ড পেয়েছেন।', 'record');
    for (const id of [c.renterId, c.landlordId]) notify(id, 'Your contact record is ready.', 'আপনার যোগাযোগের রেকর্ড তৈরি হয়েছে।', 'record/' + r.id);
    audit('system', 'contact.shared', r.id, null, { sha256: hash });
    return r;
  }
  BB.verifyRecord = r => sha256(JSON.stringify(r.snapshot)) === r.sha256;

  // ───────────── The deal (both confirm with OTP) ─────────────
  BB.proposeDeal = function (convId, userId, { rent, advance, moveIn }) {
    const c = BB.get.conv(convId);
    const rec = BB.recordOf(convId);
    if (!rec) throw err('Share contact details after the viewing first.', 'আগে বাসা দেখার পর তথ্য শেয়ার করুন।');
    const l = BB.get.listing(c.listingId);
    if (l.status === 'let_agreed') throw err('This home is already let.', 'এই বাসাটি ইতিমধ্যে ভাড়া হয়ে গেছে।');
    if (!(+rent > 0) || !(+advance >= 0) || !moveIn) throw err('Fill in rent, advance and move-in date.', 'ভাড়া, অগ্রিম আর ওঠার তারিখ লিখুন।');
    const old = BB.dealOf(convId);
    if (old && !(old.renterAt && old.landlordAt)) old.status = 'withdrawn';
    const d = {
      id: uid('deal'), convId, recordId: rec.id, rent: +rent, advance: +advance, moveIn, proposedBy: userId, status: 'proposed',
      renterAt: userId === c.renterId ? iso(now()) : null, landlordAt: userId === c.landlordId ? iso(now()) : null,
      paidConfirm: {}, paidDirectlyAt: null, receiptSha: null, method: null, moveInCheck: null, createdAt: iso(now()),
    };
    state.deals.push(d);
    const u = BB.get.user(userId);
    sys(convId, u.name_en + ' confirmed the deal: rent ' + BB.fmt.money(d.rent, 'en') + ', advance ' + BB.fmt.money(d.advance, 'en') + ', move-in ' + BB.fmt.date(moveIn, 'en') + '.',
      u.name_bn + ' চুক্তি নিশ্চিত করেছেন: ভাড়া ' + BB.fmt.money(d.rent, 'bn') + ', অগ্রিম ' + BB.fmt.money(d.advance, 'bn') + ', ওঠার তারিখ ' + BB.fmt.date(moveIn, 'bn') + '।', 'deal');
    notify(userId === c.renterId ? c.landlordId : c.renterId, 'Please confirm the deal', 'অনুগ্রহ করে চুক্তি নিশ্চিত করুন', 'chat/' + convId);
    audit('user:' + userId, 'deal.proposed', d.id);
    BB.commit();
    return d;
  };
  BB.confirmDeal = function (dealId, userId) {
    const d = BB.get.deal(dealId);
    const c = BB.get.conv(d.convId);
    if (userId === c.renterId) d.renterAt = d.renterAt || iso(now());
    else if (userId === c.landlordId) d.landlordAt = d.landlordAt || iso(now());
    if (d.renterAt && d.landlordAt && d.status !== 'confirmed') {
      d.status = 'confirmed';
      d.confirmedAt = iso(now());
      d.sha256 = sha256(JSON.stringify([d.id, d.recordId, d.rent, d.advance, d.moveIn, d.renterAt, d.landlordAt]));
      const l = BB.get.listing(c.listingId);
      l.status = 'let_agreed';
      l.updatedAt = iso(now());
      c.stage = 'deal_agreed';
      sys(c.id, 'Deal confirmed by both of you. The home is now marked "Let agreed".', 'আপনারা দুজনেই চুক্তি নিশ্চিত করেছেন। বাসাটি এখন "ভাড়া চূড়ান্ত"।', 'deal');
      for (const oc of state.conversations.filter(x => x.listingId === l.id && x.id !== c.id)) sys(oc.id, 'This home has been let to someone else.', 'এই বাসাটি অন্য কারও কাছে ভাড়া হয়ে গেছে।', 'info');
      for (const id of [c.renterId, c.landlordId]) notify(id, 'Deal confirmed: ' + l.title_en, 'চুক্তি নিশ্চিত: ' + l.title_bn, 'deal/' + d.id);
      const sub = state.scoutSubs.find(s => s.listingId === l.id && s.earnedLiveAt && !s.earnedLetAt);
      if (sub && now() - ms(sub.earnedLiveAt) <= 60 * DAY) {
        sub.earnedLetAt = iso(now());
        notify(sub.scoutId, 'A home you brought in was let. You earned a ৳300 bonus.', 'আপনার আনা একটি বাসা ভাড়া হয়েছে। আপনি ৳৩০০ বোনাস পেলেন।', 'scout');
      }
      audit('system', 'deal.confirmed', d.id, null, { sha256: d.sha256 });
    }
    BB.commit();
    return d;
  };
  BB.confirmPaidDirect = function (dealId, userId) {
    const d = BB.get.deal(dealId);
    const c = BB.get.conv(d.convId);
    if (d.method === 'protected') throw err('This advance is going through the protected advance.', 'এই অগ্রিমটি সুরক্ষিত অগ্রিমের মাধ্যমে যাচ্ছে।');
    d.method = 'direct';
    d.paidConfirm = d.paidConfirm || {};
    d.paidConfirm[userId === c.renterId ? 'renter' : 'landlord'] = iso(now());
    const u = BB.get.user(userId);
    sys(c.id, u.name_en + ' confirmed the advance was paid directly.', u.name_bn + ' নিশ্চিত করেছেন যে অগ্রিম সরাসরি দেওয়া হয়েছে।', 'deal');
    if (d.paidConfirm.renter && d.paidConfirm.landlord && !d.paidDirectlyAt) {
      d.paidDirectlyAt = iso(now());
      d.receiptSha = sha256(JSON.stringify([d.id, d.advance, d.paidConfirm.renter, d.paidConfirm.landlord]));
      sys(c.id, 'Advance receipt issued to both of you.', 'আপনাদের দুজনকেই অগ্রিমের রসিদ দেওয়া হয়েছে।', 'record');
      audit('system', 'advance.receipt', d.id, null, { sha256: d.receiptSha });
    }
    BB.commit();
  };
  BB.saveMoveIn = function (dealId, userId, check) {
    const d = BB.get.deal(dealId);
    const c = BB.get.conv(d.convId);
    if (userId !== c.renterId) throw err('Only the renter fills in the move-in check.');
    d.moveInCheck = Object.assign({}, check, { at: iso(now()) });
    d.moveInCheck.sha256 = sha256(JSON.stringify(check));
    sys(c.id, 'Move-in check saved: keys received, meter readings recorded.', 'বাসায় ওঠার চেকলিস্ট সংরক্ষিত: চাবি পাওয়া গেছে, মিটারের রিডিং লেখা হয়েছে।', 'deal');
    notify(c.landlordId, 'Your tenant has moved in.', 'আপনার ভাড়াটিয়া বাসায় উঠেছেন।', 'deal/' + d.id);
    const a = BB.advanceOf(d.id);
    if (a && a.status === 'held' && !a.movedInAt) {
      a.movedInAt = iso(now());
      a.releaseDue = true;
      audit('user:' + userId, 'advance.moved_in', a.id);
    }
    BB.commit();
  };
  BB.confirmHandover = function (dealId, userId) {
    const d = BB.get.deal(dealId);
    if (!d.moveInCheck) return;
    d.moveInCheck.landlordAt = iso(now());
    sys(d.convId, 'The landlord confirmed the handover.', 'বাড়িওয়ালা বাসা বুঝিয়ে দেওয়া নিশ্চিত করেছেন।', 'deal');
    BB.commit();
  };

  // ───────────── Protected advance (ARCHITECTURE.md §4.1) ─────────────
  BB.feeFor = function (amount) {
    const s = state.settings;
    if (s.pilotMode) return 0;
    return Math.min(s.feeMax, Math.max(s.feeMin, Math.round((amount * s.feePct) / 100)));
  };
  function newRef() {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let r;
    do { r = 'BB-'; for (let i = 0; i < 5; i++) r += A[Math.floor(Math.random() * A.length)]; } while (state.advances.some(a => a.reference === r));
    return r;
  }
  BB.startProtected = function (dealId, renterId) {
    const d = BB.get.deal(dealId);
    const c = BB.get.conv(d.convId);
    if (renterId !== c.renterId) throw err('Only the renter starts the protected advance.');
    if (d.status !== 'confirmed') throw err('Both of you must confirm the deal first.', 'আগে দুজনকেই চুক্তি নিশ্চিত করতে হবে।');
    if (d.method === 'direct') throw err('You already recorded a direct payment for this deal.', 'এই চুক্তিতে সরাসরি পরিশোধের রসিদ আগেই নেওয়া হয়েছে।');
    if (BB.advanceOf(d.id)) return BB.advanceOf(d.id);
    if (d.advance > state.settings.advanceCap) throw err('During the pilot, protected advances are limited to ' + BB.fmt.money(state.settings.advanceCap, 'en') + '.', 'পাইলটের সময় সুরক্ষিত অগ্রিম সর্বোচ্চ ' + BB.fmt.money(state.settings.advanceCap, 'bn') + '।');
    const acct = BB.approvedPayoutAccount(c.landlordId);
    const a = {
      id: uid('adv'), dealId: d.id, convId: c.id, renterId: c.renterId, landlordId: c.landlordId, payoutAccountId: acct ? acct.id : null,
      advance: d.advance, fee: BB.feeFor(d.advance), reference: newRef(), moveIn: d.moveIn, status: 'awaiting_payment',
      renterSentAt: null, receivedAt: null, movedInAt: null, autoReleaseAt: null, releaseDue: false, disputeReason: null, decidedBy: null, createdAt: iso(now()),
    };
    state.advances.push(a);
    d.method = 'protected';
    sys(c.id, 'Protected advance started. Reference ' + a.reference + '.', 'সুরক্ষিত অগ্রিম শুরু হয়েছে। রেফারেন্স ' + a.reference + '।', 'advance');
    if (!acct) notify(c.landlordId, 'Add your payout bank account so the advance can be paid to you after move-in.', 'বাসায় ওঠার পর অগ্রিম পেতে আপনার ব্যাংক অ্যাকাউন্ট যোগ করুন।', 'homes');
    audit('user:' + renterId, 'advance.started', a.id, null, { reference: a.reference });
    BB.commit();
    return a;
  };
  BB.markSent = function (advId, renterId) {
    const a = BB.get.advance(advId);
    if (a.renterId !== renterId || a.status !== 'awaiting_payment') return;
    a.renterSentAt = iso(now());
    BB.commit();
  };
  function linkAccount(a) {
    if (!a.payoutAccountId) { const acct = BB.approvedPayoutAccount(a.landlordId); if (acct) a.payoutAccountId = acct.id; }
  }
  function matchLine(t) {
    if (t.direction !== 'in' || t.advanceId) return false;
    const a = state.advances.find(x => x.status === 'awaiting_payment' && t.narration.toUpperCase().includes(x.reference) && Math.round(t.amount) === x.advance + x.fee);
    if (!a) return false;
    t.advanceId = a.id;
    a.status = 'held';
    a.receivedAt = t.booked;
    a.autoReleaseAt = iso(ms(a.moveIn + 'T12:00:00+06:00') + 72 * HOUR);
    linkAccount(a);
    sys(a.convId, 'Advance received and held at the bank: ' + BB.fmt.money(a.advance + a.fee, 'en') + '.', 'অগ্রিম পাওয়া গেছে এবং ব্যাংকে জমা আছে: ' + BB.fmt.money(a.advance + a.fee, 'bn') + '।', 'advance');
    for (const id of [a.renterId, a.landlordId]) notify(id, 'Advance received and held at the bank.', 'অগ্রিম পাওয়া গেছে এবং ব্যাংকে জমা আছে।', 'advance/' + a.id);
    audit('system', 'advance.held', a.id, null, { txn: t.ref });
    return true;
  }
  BB.importLines = function (staffId, lines) {
    let added = 0, matched = 0;
    for (const x of lines) {
      if (!x.ref || state.bankTxns.some(t => t.ref === x.ref)) continue;
      const t = { id: uid('txn'), ref: x.ref, direction: x.direction || 'in', amount: +x.amount, narration: x.narration || '', fromAccount: x.fromAccount || null, booked: x.booked || iso(now()), advanceId: null, importedBy: staffId };
      state.bankTxns.push(t);
      added++;
      if (matchLine(t)) matched++;
    }
    audit(staffId === 'auto' ? 'system' : 'staff:' + staffId, 'bank.statement_imported', null, null, { added, matched });
    BB.commit();
    return { added, matched };
  };
  BB.demoStatementLines = function () {
    const lines = [];
    for (const a of state.advances.filter(x => x.status === 'awaiting_payment' && x.renterSentAt)) {
      const r = BB.get.user(a.renterId);
      lines.push({ ref: 'NPSB' + Math.floor(1e9 + Math.random() * 9e9), direction: 'in', amount: a.advance + a.fee, narration: 'NPSB ' + a.reference + ' ' + (r.legalName || r.name_en).toUpperCase(), fromAccount: '••••' + (1000 + Math.floor(Math.random() * 9000)), booked: iso(now()) });
    }
    return lines;
  };
  BB.parseStatement = function (text) {
    // date,reference,amount,narration  (one line per transaction; amounts in taka)
    return String(text).split(/\r?\n/).map(s => s.trim()).filter(Boolean).map(s => {
      const [date, ref, amount, ...rest] = s.split(',').map(x => x.trim());
      return { ref, amount: +amount, narration: rest.join(' '), direction: +amount < 0 ? 'out' : 'in', booked: date ? iso(ms(date) || now()) : iso(now()) };
    }).filter(x => x.ref && x.amount);
  };
  BB.manualMatch = function (staffId, txnId, advId) {
    const t = state.bankTxns.find(x => x.id === txnId);
    const a = BB.get.advance(advId);
    if (!t || !a) throw err('Choose a line and an advance.');
    if (Math.round(t.amount) !== a.advance + a.fee) throw err('The amount does not match: the line is ' + BB.fmt.money(t.amount, 'en') + ', the advance needs ' + BB.fmt.money(a.advance + a.fee, 'en') + '.');
    t.narration += ' [matched by hand to ' + a.reference + ']';
    const ok = matchLine(Object.assign(t, { narration: t.narration + ' ' + a.reference }));
    if (!ok) throw err('Could not match. Is the advance still waiting for payment?');
    audit('staff:' + staffId, 'bank.matched_by_hand', a.id, null, { txn: t.ref });
    BB.commit();
  };
  BB.reportProblem = function (advId, userId, reason) {
    const a = BB.get.advance(advId);
    if (!['held'].includes(a.status)) throw err('You can report a problem while the advance is held.', 'অগ্রিম ব্যাংকে জমা থাকা অবস্থায় সমস্যা জানাতে পারবেন।');
    a.status = 'disputed';
    a.disputeReason = reason;
    a.releaseDue = false;
    sys(a.convId, 'A problem was reported. The advance is frozen until our team decides (within 48 hours).', 'একটি সমস্যা জানানো হয়েছে। আমাদের টিম সিদ্ধান্ত না নেওয়া পর্যন্ত (৪৮ ঘণ্টার মধ্যে) অগ্রিম আটকে থাকবে।', 'warning');
    notify(a.landlordId, 'The renter reported a problem. The advance is frozen.', 'ভাড়াটিয়া একটি সমস্যা জানিয়েছেন। অগ্রিম আটকে রাখা হয়েছে।', 'advance/' + a.id);
    audit('user:' + userId, 'advance.disputed', a.id, reason);
    BB.commit();
  };
  BB.runDailyJob = function (actor) {
    let due = 0, expired = 0;
    for (const a of state.advances) {
      if (a.status === 'held' && !a.releaseDue && a.autoReleaseAt && now() >= ms(a.autoReleaseAt)) { a.releaseDue = true; due++; }
    }
    for (const s of state.scoutSubs) {
      if (s.status === 'invited' && now() - ms(s.invitedAt) > 7 * DAY) { s.status = 'expired'; s.landlordPhone = null; s.draft = null; expired++; }
    }
    audit(actor || 'system', 'job.daily', null, null, { due, expired });
    BB.commit();
    return { due, expired };
  };
  BB.preparePayout = function (staffId, advId, outcome, note) {
    const a = BB.get.advance(advId);
    if (BB.payoutsOf(advId).some(p => !p.voided)) throw err('A payout is already prepared for this advance.');
    if (outcome === 'release') {
      if (!(a.status === 'held' || a.status === 'disputed')) throw err('The advance is not held.');
      linkAccount(a);
      if (!a.payoutAccountId) throw err("The landlord has no approved payout account yet.");
      const acct = BB.get.payoutAccount(a.payoutAccountId);
      if (acct.usableFrom && now() < ms(acct.usableFrom)) throw err('The payout account can be paid from ' + BB.fmt.dateTime(acct.usableFrom, 'en') + ' (48-hour safety wait).');
      state.payouts.push({ id: uid('po'), advanceId: advId, kind: 'to_landlord', amount: a.advance, toAccountId: acct.id, preparedBy: staffId, preparedAt: iso(now()), approvedBy: null, note: note || null });
      if (a.fee > 0) state.payouts.push({ id: uid('po'), advanceId: advId, kind: 'fee_to_company', amount: a.fee, preparedBy: staffId, preparedAt: iso(now()), approvedBy: null, note: note || null });
    } else {
      if (!(a.status === 'held' || a.status === 'disputed')) throw err('The advance is not held.');
      state.payouts.push({ id: uid('po'), advanceId: advId, kind: 'refund_to_renter', amount: a.advance + a.fee, preparedBy: staffId, preparedAt: iso(now()), approvedBy: null, note: note || null });
    }
    a.outcome = outcome;
    audit('staff:' + staffId, 'payout.prepared', a.id, note || null, { outcome });
    BB.commit();
  };
  BB.approvePayout = function (staffId, payoutId) {
    const p = state.payouts.find(x => x.id === payoutId);
    if (!p || p.approvedBy) throw err('This payout is not waiting for approval.');
    if (p.preparedBy === staffId) throw err('The founder who prepared this payout cannot approve it. Sign in as the other founder.');
    p.approvedBy = staffId;
    p.approvedAt = iso(now());
    const a = BB.get.advance(p.advanceId);
    const t = { id: uid('txn'), ref: 'OUT' + Math.floor(1e8 + Math.random() * 9e8), direction: 'out', amount: p.amount, narration: p.kind.toUpperCase() + ' ' + a.reference, booked: iso(now()), advanceId: a.id, importedBy: staffId };
    state.bankTxns.push(t);
    p.bankTxnId = t.id;
    audit('staff:' + staffId, 'payout.approved', p.id, null, { amount: p.amount, kind: p.kind });
    const all = BB.payoutsOf(a.id).filter(x => !x.voided);
    if (all.every(x => x.approvedBy)) {
      a.status = a.outcome === 'refund' ? 'refunded' : 'released';
      a.releaseDue = false;
      a.closedAt = iso(now());
      if (a.status === 'released') {
        sys(a.convId, 'The advance was paid to the landlord\'s bank account.', 'অগ্রিম বাড়িওয়ালার ব্যাংক অ্যাকাউন্টে পাঠানো হয়েছে।', 'advance');
        notify(a.landlordId, 'Advance paid to your bank account: ' + BB.fmt.money(a.advance, 'en'), 'অগ্রিম আপনার ব্যাংক অ্যাকাউন্টে পাঠানো হয়েছে: ' + BB.fmt.money(a.advance, 'bn'), 'advance/' + a.id);
        notify(a.renterId, 'Your advance was released to the landlord. Welcome home!', 'আপনার অগ্রিম বাড়িওয়ালাকে দেওয়া হয়েছে। নতুন বাসায় স্বাগতম!', 'advance/' + a.id);
      } else {
        sys(a.convId, 'The advance was refunded to the renter, including our fee.', 'অগ্রিম ভাড়াটিয়াকে ফেরত দেওয়া হয়েছে, আমাদের ফি সহ।', 'advance');
        notify(a.renterId, 'Your advance was refunded: ' + BB.fmt.money(a.advance + a.fee, 'en'), 'আপনার অগ্রিম ফেরত দেওয়া হয়েছে: ' + BB.fmt.money(a.advance + a.fee, 'bn'), 'advance/' + a.id);
        notify(a.landlordId, 'The advance was refunded to the renter.', 'অগ্রিম ভাড়াটিয়াকে ফেরত দেওয়া হয়েছে।', 'advance/' + a.id);
      }
      audit('system', 'advance.' + a.status, a.id);
    }
    BB.commit();
  };
  BB.escrowBalance = function () {
    return state.bankTxns.reduce((n, t) => n + (t.direction === 'in' ? t.amount : -t.amount), 0);
  };
  BB.heldTotal = function () {
    return state.advances.filter(a => a.status === 'held' || a.status === 'disputed').reduce((n, a) => n + a.advance + a.fee, 0)
      + state.bankTxns.filter(t => t.direction === 'in' && !t.advanceId).reduce((n, t) => n + t.amount, 0);
  };

  // ───────────── Payout bank accounts ─────────────
  BB.addPayoutAccount = function (userId, { accountName, accountNo, bank, routing }) {
    const n = toAscii(String(accountNo || '')).replace(/\D/g, '');
    if (!accountName || n.length < 8 || !bank) throw err('Fill in the account name, number and bank.', 'অ্যাকাউন্টের নাম, নম্বর আর ব্যাংক লিখুন।');
    const u = BB.get.user(userId);
    const doc = addDoc(userId, 'bank_proof', { kind: 'bank_proof', name: accountName, bank, last4: n.slice(-4) });
    for (const p of state.payoutAccounts.filter(x => x.userId === userId && x.status === 'pending')) p.status = 'replaced';
    const p = { id: uid('pa'), userId, accountName: accountName.trim(), accountNo: n, last4: n.slice(-4), bank, routing: routing || '', proofId: doc.id, status: 'pending', usableFrom: null, reviewedBy: null, createdAt: iso(now()), nameOnId: u.legalName || u.name_en };
    state.payoutAccounts.push(p);
    audit('user:' + userId, 'payout_account.added', p.id);
    BB.commit();
    return p;
  };
  BB.namesMatch = (a, b) => norm(a).replace(/\b(md|mohammad|mohammed|muhammad|mst|mrs|mr)\b/g, '').replace(/\s+/g, ' ').trim() === norm(b).replace(/\b(md|mohammad|mohammed|muhammad|mst|mrs|mr)\b/g, '').replace(/\s+/g, ' ').trim();
  BB.reviewPayoutAccount = function (staffId, id, approve, reason) {
    const p = BB.get.payoutAccount(id);
    if (!p || p.status !== 'pending') throw err('This account is not waiting for review.');
    if (approve) {
      for (const old of state.payoutAccounts.filter(x => x.userId === p.userId && x.status === 'approved')) old.status = 'replaced';
      p.status = 'approved';
      p.usableFrom = iso(state.settings.skipWaits ? now() : now() + 48 * HOUR);
      for (const a of state.advances.filter(x => x.landlordId === p.userId && ['awaiting_payment', 'held', 'disputed'].includes(x.status))) a.payoutAccountId = p.id;
      notify(p.userId, 'Your payout bank account is approved.', 'আপনার ব্যাংক অ্যাকাউন্ট অনুমোদিত হয়েছে।', 'homes');
    } else {
      p.status = 'rejected';
      p.rejectReason = reason || 'Name does not match your verified ID';
      notify(p.userId, 'Your payout bank account was not approved: ' + p.rejectReason, 'আপনার ব্যাংক অ্যাকাউন্ট অনুমোদন পায়নি: ' + p.rejectReason, 'homes');
    }
    p.reviewedBy = staffId;
    audit('staff:' + staffId, approve ? 'payout_account.approved' : 'payout_account.rejected', p.id, reason || null);
    BB.commit();
  };

  // ───────────── Scouts (ARCHITECTURE.md §4.2) ─────────────
  BB.scoutSubmit = function (scoutUserId, draft, landlordPhone) {
    const sc = BB.scoutOf(scoutUserId);
    if (!sc || sc.status !== 'active') throw err('You are not an active scout.', 'আপনি সক্রিয় স্কাউট নন।');
    const today = state.scoutSubs.filter(s => s.scoutId === scoutUserId && now() - ms(s.invitedAt) < DAY).length;
    if (today >= sc.dailyLimit) throw err('Daily limit reached (' + sc.dailyLimit + ' homes).', 'আজকের সীমা শেষ (' + toBn(sc.dailyLimit) + 'টি বাসা)।');
    const phone = BB.normalisePhone(landlordPhone);
    if (!phone) throw err("Enter the landlord's mobile number.", 'বাড়িওয়ালার মোবাইল নম্বর লিখুন।');
    if (!draft.occupantOk) throw err('Confirm that the people living there agreed.', 'নিশ্চিত করুন যে বাসার বাসিন্দারা রাজি হয়েছেন।');
    const s = { id: uid('sub'), scoutId: scoutUserId, draft: clone(draft), landlordPhone: phone, capturePoint: draft.exact || null, listingId: null, status: 'invited', invitedAt: iso(now()), confirmedAt: null, earnedLiveAt: null, earnedLetAt: null, paidLiveAt: null, paidLetAt: null };
    state.scoutSubs.push(s);
    const landlord = BB.get.userByPhone(phone);
    if (landlord) notify(landlord.id, 'A Basha Bari scout prepared a listing for your home. Please check and confirm it.', 'বাসাবাড়ির একজন স্কাউট আপনার বাসার বিজ্ঞাপন তৈরি করেছেন। দেখে নিশ্চিত করুন।', 'invite/' + s.id);
    audit('user:' + scoutUserId, 'scout.submitted', s.id);
    BB.commit();
    return { sub: s, landlordExists: !!landlord };
  };
  BB.scoutConfirm = function (subId, landlordUserId) {
    const s = BB.get.sub(subId);
    if (!s || s.status !== 'invited') throw err('This invite is no longer open.', 'এই আমন্ত্রণটি আর খোলা নেই।');
    const u = BB.get.user(landlordUserId);
    if (u.phone !== s.landlordPhone) throw err('This invite was sent to a different number.', 'এই আমন্ত্রণটি অন্য নম্বরে পাঠানো হয়েছিল।');
    const l = BB.createListing(landlordUserId, s.draft, { scoutId: s.scoutId });
    s.status = 'confirmed';
    s.confirmedAt = iso(now());
    s.listingId = l.id;
    s.landlordPhone = null;
    notify(s.scoutId, 'The landlord confirmed your listing. It is now in review.', 'বাড়িওয়ালা আপনার বিজ্ঞাপন নিশ্চিত করেছেন। এখন যাচাই চলছে।', 'scout');
    audit('user:' + landlordUserId, 'scout.confirmed', s.id);
    BB.commit();
    return l;
  };
  BB.scoutEarnings = function (scoutUserId) {
    const subs = state.scoutSubs.filter(s => s.scoutId === scoutUserId);
    const live = subs.filter(s => s.earnedLiveAt), let_ = subs.filter(s => s.earnedLetAt);
    const due = live.filter(s => !s.paidLiveAt).length * 150 + let_.filter(s => !s.paidLetAt).length * 300;
    const paid = live.filter(s => s.paidLiveAt).length * 150 + let_.filter(s => s.paidLetAt).length * 300;
    return { subs, live: live.length, let: let_.length, due, paid, total: due + paid };
  };
  BB.payScout = function (staffId, scoutUserId) {
    const e = BB.scoutEarnings(scoutUserId);
    for (const s of e.subs) { if (s.earnedLiveAt && !s.paidLiveAt) s.paidLiveAt = iso(now()); if (s.earnedLetAt && !s.paidLetAt) s.paidLetAt = iso(now()); }
    notify(scoutUserId, 'Scout pay sent to your bank account: ' + BB.fmt.money(e.due, 'en'), 'স্কাউট পেমেন্ট আপনার ব্যাংক অ্যাকাউন্টে পাঠানো হয়েছে: ' + BB.fmt.money(e.due, 'bn'), 'scout');
    audit('staff:' + staffId, 'scout.paid', scoutUserId, null, { amount: e.due });
    BB.commit();
    return e.due;
  };

  // ───────────── Reports, blocks, accounts ─────────────
  BB.report = function (reporterId, targetType, targetId, reason, details) {
    const r = { id: uid('rep'), reporterId, targetType, targetId, reason, details: details || '', status: 'open', createdAt: iso(now()) };
    state.reports.push(r);
    audit('user:' + reporterId, 'report.created', r.id, reason);
    BB.commit();
    return r;
  };
  BB.actionReport = function (staffId, id, action, note) {
    const r = BB.get.report(id);
    r.status = action === 'dismiss' ? 'dismissed' : 'actioned';
    r.action = action;
    r.note = note || '';
    r.decidedBy = staffId;
    r.decidedAt = iso(now());
    if (action === 'remove_listing') {
      const l = r.targetType === 'listing' ? BB.get.listing(r.targetId) : null;
      if (l) { l.status = 'removed'; notify(l.listerId, 'Your listing was removed after a report: ' + (note || r.reason), 'একটি অভিযোগের পর আপনার বিজ্ঞাপন সরানো হয়েছে: ' + (note || r.reason), 'homes'); }
    }
    if (action === 'suspend_user') {
      const uidT = r.targetType === 'user' ? r.targetId : r.targetType === 'listing' ? BB.get.listing(r.targetId).listerId : (state.messages.find(m => m.id === r.targetId) || {}).senderId;
      const u = BB.get.user(uidT);
      if (u) { u.status = 'suspended'; audit('staff:' + staffId, 'user.suspended', u.id, note || r.reason); }
    }
    if (action === 'warn') {
      const uidT = r.targetType === 'user' ? r.targetId : r.targetType === 'listing' ? BB.get.listing(r.targetId).listerId : (state.messages.find(m => m.id === r.targetId) || {}).senderId;
      if (uidT) notify(uidT, 'Warning from Basha Bari: ' + (note || 'please follow our rules. Never ask for money before a viewing.'), 'বাসাবাড়ির সতর্কবার্তা: ' + (note || 'আমাদের নিয়ম মেনে চলুন। বাসা দেখার আগে টাকা চাইবেন না।'), 'page/safety');
    }
    notify(r.reporterId, 'We reviewed your report. Thank you for keeping Basha Bari safe.', 'আমরা আপনার অভিযোগটি দেখেছি। বাসাবাড়িকে নিরাপদ রাখার জন্য ধন্যবাদ।', null);
    audit('staff:' + staffId, 'report.' + r.status, r.id, note || null, { action });
    BB.commit();
  };
  BB.block = function (blocker, blocked) {
    if (!state.blocks.some(b => b.blocker === blocker && b.blocked === blocked)) state.blocks.push({ blocker, blocked, at: iso(now()) });
    for (const c of state.conversations.filter(x => (x.renterId === blocker && x.landlordId === blocked) || (x.renterId === blocked && x.landlordId === blocker))) c.stage = 'closed';
    audit('user:' + blocker, 'user.blocked', blocked);
    BB.commit();
  };
  BB.isBlocked = (a, b) => state.blocks.some(x => (x.blocker === a && x.blocked === b) || (x.blocker === b && x.blocked === a));
  BB.setUserStatus = function (staffId, userId, status, reason) {
    const u = BB.get.user(userId);
    u.status = status;
    audit('staff:' + staffId, 'user.' + status, userId, reason || null);
    BB.commit();
  };
  BB.requestDeletion = function (userId, reason) {
    const u = BB.get.user(userId);
    u.status = 'deletion_pending';
    const d = { userId, requestedAt: iso(now()), deleteAfter: iso(now() + 28 * DAY), reason: reason || '', cancelledAt: null, holdReason: null, completedAt: null };
    state.deletions = state.deletions.filter(x => !(x.userId === userId && !x.completedAt));
    state.deletions.push(d);
    for (const v of state.viewings.filter(x => x.status === 'proposed' || x.status === 'accepted')) {
      const c = BB.get.conv(v.convId);
      if (c && (c.renterId === userId || c.landlordId === userId) && (!v.startsAt || ms(v.startsAt) > now())) {
        v.status = 'cancelled';
        sys(c.id, 'This viewing was cancelled because the other person is closing their account.', 'অন্যজন অ্যাকাউন্ট বন্ধ করছেন, তাই বাসা দেখার সময় বাতিল হয়েছে।', 'info');
      }
    }
    audit('user:' + userId, 'deletion.requested', userId, reason || null);
    BB.commit();
    return d;
  };
  BB.holdDeletion = function (staffId, userId, reason) {
    const d = state.deletions.find(x => x.userId === userId && !x.completedAt && !x.cancelledAt);
    if (!d) return;
    d.holdReason = reason;
    notify(userId, 'Your account deletion is paused because of an open report. We will contact you.', 'একটি খোলা অভিযোগের কারণে আপনার অ্যাকাউন্ট মোছা স্থগিত রাখা হয়েছে। আমরা যোগাযোগ করব।', null);
    audit('staff:' + staffId, 'deletion.held', userId, reason);
    BB.commit();
  };
  BB.completeDeletion = function (staffId, userId) {
    const d = state.deletions.find(x => x.userId === userId && !x.completedAt && !x.cancelledAt);
    if (!d) throw err('No deletion request open for this account.');
    if (d.holdReason) throw err('This deletion is on hold: ' + d.holdReason);
    const u = BB.get.user(userId);
    d.completedAt = iso(now());
    u.status = 'deleted';
    u.name_en = 'Deleted user';
    u.name_bn = 'মুছে ফেলা ব্যবহারকারী';
    u.phone = null;
    u.occupation = '';
    state.favourites = state.favourites.filter(f => f.userId !== userId);
    state.savedSearches = state.savedSearches.filter(f => f.userId !== userId);
    state.notifications = state.notifications.filter(n => n.userId !== userId);
    for (const l of state.listings.filter(x => x.listerId === userId && ['active', 'paused', 'in_review'].includes(x.status))) l.status = 'closed';
    for (const doc of BB.docsOf(userId)) doc.retainUntil = iso(now() + 6 * 365 * DAY);
    audit('staff:' + staffId, 'deletion.completed', userId, null, { documentsKeptUntil: iso(now() + 6 * 365 * DAY) });
    BB.commit();
  };
  BB.setSetting = function (staffId, key, value) {
    state.settings[key] = value;
    audit('staff:' + staffId, 'settings.changed', key, null, { value });
    BB.commit();
  };

  // ───────────── Jobs that run when a page opens ─────────────
  function jobs() {
    let changed = false;
    for (const s of state.scoutSubs) if (s.status === 'invited' && now() - ms(s.invitedAt) > 7 * DAY) { s.status = 'expired'; s.landlordPhone = null; s.draft = null; changed = true; }
    if (changed) saveLocal();
  }

  // ───────────── Seed data: 5 renters, 10 landlords, 2 scouts, 2 founders, 20 homes ─────────────
  const PEOPLE = [
    { id: 'u_r1', kind: 'renter', en: 'Tanvir Ahmed', bn: 'তানভীর আহমেদ', phone: '01711000101', dob: '1996-03-14', doc: 'smart_nid', nid: '4612783905', joined: 34, verified: 33, household: ['single_men', 'job_holders'], size: 1, job: 'Software engineer', lang: 'bn' },
    { id: 'u_r2', kind: 'renter', en: 'Nusrat Jahan', bn: 'নুসরাত জাহান', phone: '01811000102', dob: '1990-07-02', doc: 'nid', nid: '1987265430123', joined: 40, verified: 39, household: ['family'], size: 4, job: 'School teacher', lang: 'bn' },
    { id: 'u_r3', kind: 'renter', en: 'Farhan Kabir', bn: 'ফারহান কবির', phone: '01911000103', dob: '2004-11-20', doc: 'smart_nid', nid: '7765012398', joined: 1, verified: null, household: ['students'], size: 1, job: 'University student', lang: 'en' },
    { id: 'u_r4', kind: 'renter', en: 'Sadia Islam', bn: 'সাদিয়া ইসলাম', phone: '01611000104', dob: '1995-01-25', doc: 'passport', nid: 'A09812345', joined: 21, verified: 20, household: ['single_women', 'job_holders'], size: 1, job: 'Bank officer', lang: 'en' },
    { id: 'u_r5', kind: 'renter', en: 'Arif Hossain', bn: 'আরিফ হোসেন', phone: '01511000105', dob: '1987-09-09', doc: 'nid', nid: '5528190374', joined: 60, verified: 58, household: ['family'], size: 3, job: 'Business owner', lang: 'bn' },
    { id: 'u_l1', kind: 'landlord', en: 'Abdul Karim', bn: 'আবদুল করিম', phone: '01711000201', dob: '1961-02-11', doc: 'nid', nid: '2214567890', joined: 90, verified: 89, lang: 'bn' },
    { id: 'u_l2', kind: 'landlord', en: 'Rokeya Begum', bn: 'রোকেয়া বেগম', phone: '01811000202', dob: '1966-05-30', doc: 'nid', nid: '3346789012', joined: 80, verified: 79, lang: 'bn' },
    { id: 'u_l3', kind: 'landlord', en: 'Mizanur Rahman', bn: 'মিজানুর রহমান', phone: '01911000203', dob: '1972-12-04', doc: 'smart_nid', nid: '6612309874', joined: 70, verified: 69, lang: 'bn' },
    { id: 'u_l4', kind: 'landlord', en: 'Shahnaz Parvin', bn: 'শাহনাজ পারভীন', phone: '01611000204', dob: '1969-08-17', doc: 'nid', nid: '7789012345', joined: 65, verified: 64, lang: 'en' },
    { id: 'u_l5', kind: 'landlord', en: 'Jamal Uddin', bn: 'জামাল উদ্দিন', phone: '01711000205', dob: '1978-03-21', doc: 'smart_nid', nid: '8890123456', joined: 50, verified: 49, lang: 'bn' },
    { id: 'u_l6', kind: 'landlord', en: 'Fatema Khatun', bn: 'ফাতেমা খাতুন', phone: '01811000206', dob: '1964-10-08', doc: 'nid', nid: '9901234567', joined: 45, verified: 44, lang: 'bn' },
    { id: 'u_l7', kind: 'landlord', en: 'Habibur Rahman', bn: 'হাবিবুর রহমান', phone: '01911000207', dob: '1958-01-15', doc: 'nid', nid: '1102345678', joined: 44, verified: 43, lang: 'bn' },
    { id: 'u_l8', kind: 'landlord', en: 'Nasima Akter', bn: 'নাসিমা আক্তার', phone: '01611000208', dob: '1985-06-12', doc: 'smart_nid', nid: '2203456789', joined: 30, verified: 29, lang: 'bn' },
    { id: 'u_l9', kind: 'landlord', en: 'Kamal Hossain', bn: 'কামাল হোসেন', phone: '01511000209', dob: '1982-04-02', doc: 'smart_nid', nid: '3304567890', joined: 25, verified: 24, lang: 'en' },
    { id: 'u_l10', kind: 'landlord', en: 'Selina Chowdhury', bn: 'সেলিনা চৌধুরী', phone: '01711000210', dob: '1970-11-27', doc: 'nid', nid: '4405678901', joined: 3, verified: 2, lang: 'en' },
    { id: 'u_s1', kind: 'scout', en: 'Rakib Hasan', bn: 'রাকিব হাসান', phone: '01811000301', dob: '2002-02-19', doc: 'smart_nid', nid: '5506789012', joined: 20, verified: 19, household: ['students'], size: 1, job: 'University student (scout)', lang: 'bn' },
    { id: 'u_s2', kind: 'scout', en: 'Mitu Akter', bn: 'মিতু আক্তার', phone: '01911000302', dob: '2001-07-07', doc: 'smart_nid', nid: '6607890123', joined: 18, verified: 17, household: ['students'], size: 1, job: 'Part-time scout', lang: 'bn' },
  ];

  // Facts per home. `ago` = days since it went live. `avail` = days until it is free.
  const HOMES = [
    { by: 'u_l1', area: 13, kind: 'flat', beds: 2, baths: 2, balc: 1, size: 950, floor: 4, floors: 6, furn: 1, rent: 18000, svc: 2000, covers: 'Guard, lift, generator, stair cleaning', adv: 1, gas: 'pipeline', water: 'in_service', gasBill: 'tenant', elec: 'prepaid', accepts: ['family', 'job_holders'], am: ['lift', 'generator', 'guard', 'cctv'], avail: 0, ago: 2, addr: 'House 14, Road 6, Block C, Mirpur 10', desc: 'Bright south-facing flat close to Mirpur 10 metro station. Quiet building, owner lives on the ground floor.' },
    { by: 'u_l1', area: 13, kind: 'flat', beds: 3, baths: 3, balc: 2, size: 1250, floor: 6, floors: 9, furn: 0, rent: 24000, svc: 3000, covers: 'Guard, lift, generator, water pump', adv: 2, gas: 'pipeline', water: 'in_service', gasBill: 'tenant', elec: 'prepaid', accepts: ['family'], am: ['lift', 'generator', 'guard', 'cctv', 'parking_bike'], avail: 20, ago: 6, addr: 'House 22, Road 2, Block D, Mirpur 10', desc: 'বড় পরিবারের জন্য ৩ বেডরুমের ফ্ল্যাট। মেট্রো স্টেশন ৫ মিনিটের হাঁটা পথ। জেনারেটর ও লিফট আছে।' },
    { by: 'u_l2', area: 23, kind: 'flat', beds: 3, baths: 2, balc: 1, size: 1100, floor: 3, floors: 5, furn: 0, rent: 22000, svc: 1500, covers: 'Guard, stair cleaning', adv: 1, gas: 'pipeline', water: 'in_rent', gasBill: 'tenant', elec: 'prepaid', accepts: ['family'], am: ['guard', 'rooftop'], avail: 5, ago: 1, addr: 'House 7, Road 4, Block B, Mohammadpur Town Hall', desc: 'টাউন হল বাজারের কাছে খোলামেলা ফ্ল্যাট। ছাদে কাপড় শুকানোর ব্যবস্থা আছে।' },
    { by: 'u_l2', area: 21, kind: 'flat', beds: 2, baths: 2, balc: 1, size: 900, floor: 2, floors: 6, furn: 1, rent: 16000, svc: 1500, covers: 'Guard, lift, generator', adv: 1, gas: 'pipeline', water: 'in_service', gasBill: 'tenant', elec: 'prepaid', accepts: ['family'], am: ['lift', 'generator', 'guard'], avail: 0, ago: 12, addr: 'House 3, Ring Road, Shyamoli', desc: 'Family flat near Shyamoli Square, schools and hospitals within walking distance.', status: 'let_agreed' },
    { by: 'u_l3', area: 32, kind: 'flat', beds: 3, baths: 3, balc: 2, size: 1450, floor: 5, floors: 8, furn: 1, rent: 32000, svc: 4000, covers: 'Guard, lift, generator, CCTV, cleaning', adv: 2, gas: 'pipeline', water: 'in_service', gasBill: 'tenant', elec: 'prepaid', accepts: ['family', 'job_holders'], am: ['lift', 'generator', 'parking_car', 'cctv', 'gated', 'servant_room', 'guard'], avail: 10, ago: 3, addr: 'House 18, Road 12, Sector 7, Uttara', desc: 'Spacious corner flat with two balconies and a car parking space. Gated building with 24-hour security.' },
    { by: 'u_l3', area: 32, kind: 'studio', beds: 1, baths: 1, balc: 0, size: 450, floor: 7, floors: 8, furn: 2, rent: 14000, svc: 1000, covers: 'Lift, generator, Wi-Fi', adv: 1, gas: 'cylinder', water: 'in_rent', gasBill: 'tenant', elec: 'prepaid', accepts: ['single_men', 'single_women', 'job_holders'], am: ['lift', 'generator', 'wifi'], avail: 0, ago: 9, addr: 'House 18, Road 12, Sector 7, Uttara (7th floor)', desc: 'Furnished studio with bed, desk and wardrobe. Ideal for one working person.' },
    { by: 'u_l4', area: 40, kind: 'flat', beds: 3, baths: 3, balc: 3, size: 1600, floor: 4, floors: 7, furn: 0, rent: 45000, svc: 5000, covers: 'Guard, lift, generator, CCTV, cleaning, water pump', adv: 2, gas: 'pipeline', water: 'in_service', gasBill: 'tenant', elec: 'postpaid', accepts: ['family'], am: ['lift', 'generator', 'parking_car', 'guard', 'cctv', 'servant_room'], avail: 15, ago: 4, addr: 'House 31, Road 9/A, Dhanmondi', desc: 'Lake-view flat in Dhanmondi with three balconies. Close to schools and Dhanmondi Lake.' },
    { by: 'u_l4', area: 40, kind: 'sublet', beds: 1, baths: 1, balc: 0, size: 180, floor: 3, floors: 6, furn: 1, rent: 9000, svc: 0, covers: '', adv: 1, gas: 'pipeline', water: 'in_rent', gasBill: 'in_rent', elec: 'in_rent', accepts: ['single_women', 'students'], am: ['attached_bath', 'wifi'], avail: 0, ago: 1, addr: 'House 31, Road 9/A, Dhanmondi (room 2)', desc: 'One room with attached bath in a family flat. All bills included. For a female student or working woman.' },
    { by: 'u_l5', area: 12, kind: 'flat', beds: 2, baths: 1, balc: 1, size: 800, floor: 1, floors: 5, furn: 0, rent: 13000, svc: 1000, covers: 'Guard, stair cleaning', adv: 1, gas: 'cylinder', water: 'in_rent', gasBill: 'tenant', elec: 'prepaid', accepts: ['family', 'job_holders'], am: ['guard'], avail: 0, ago: 12, addr: 'House 9, Road 11, Section 2, Mirpur', desc: 'মিরপুর ২-এ সাশ্রয়ী ফ্ল্যাট। স্টেডিয়ামের কাছে। কেয়ারটেকার বাসাতেই থাকেন।' },
    { by: 'u_l5', area: 12, kind: 'mess_seat', beds: 1, baths: 1, balc: 0, size: 120, floor: 2, floors: 5, furn: 1, rent: 3500, svc: 0, covers: '', adv: 1, gas: 'cylinder', water: 'in_rent', gasBill: 'in_rent', elec: 'in_rent', accepts: ['single_men', 'students'], am: ['wifi'], avail: 0, ago: 2, addr: 'House 9, Road 11, Section 2, Mirpur (2nd floor)', desc: 'দুই সিটের রুমে একটি সিট খালি। খাবার, বিদ্যুৎ, ওয়াই-ফাই সব ভাড়ার মধ্যে।' },
    { by: 'u_l6', area: 22, kind: 'flat', beds: 2, baths: 2, balc: 1, size: 850, floor: 5, floors: 6, furn: 0, rent: 15000, svc: 1200, covers: 'Guard, lift', adv: 1, gas: 'pipeline', water: 'in_service', gasBill: 'tenant', elec: 'prepaid', accepts: ['family'], am: ['lift', 'guard'], avail: 7, ago: 5, addr: 'House 40, Road 2, Adabor', desc: 'Neat 2-bed flat in Adabor, close to Shyamoli and Mohammadpur bus stops.' },
    { by: 'u_l6', area: 21, kind: 'sublet', beds: 1, baths: 1, balc: 1, size: 160, floor: 4, floors: 6, furn: 1, rent: 7500, svc: 0, covers: '', adv: 1, gas: 'pipeline', water: 'in_rent', gasBill: 'in_rent', elec: 'in_rent', accepts: ['single_women', 'job_holders'], am: ['attached_bath'], avail: 0, ago: 7, addr: 'House 12, Road 1, Shyamoli (room 1)', desc: 'একজন চাকরিজীবী নারীর জন্য অ্যাটাচড বাথসহ সাবলেট রুম।' },
    { by: 'u_l7', area: 34, kind: 'flat', beds: 3, baths: 2, balc: 1, size: 1250, floor: 2, floors: 6, furn: 0, rent: 26000, svc: 2500, covers: 'Guard, lift, generator', adv: 1, gas: 'pipeline', water: 'in_service', gasBill: 'tenant', elec: 'prepaid', accepts: ['family'], am: ['lift', 'generator', 'guard'], avail: 3, ago: 8, addr: 'House 5, Road 15, Sector 13, Uttara', desc: 'Family flat near Uttara Sector 13 park and the airport road.', scout: 'u_s2' },
    { by: 'u_l7', area: 33, kind: 'house', beds: 4, baths: 3, balc: 2, size: 2200, floor: 0, floors: 2, furn: 0, rent: 55000, svc: 0, covers: '', adv: 2, gas: 'pipeline', water: 'tenant', gasBill: 'tenant', elec: 'postpaid', accepts: ['family'], am: ['parking_car', 'gated', 'rooftop', 'servant_room'], avail: 30, ago: 15, addr: 'House 2, Road 8, Sector 10, Uttara', desc: 'Two-storey house with a small garden, car parking and a private rooftop.' },
    { by: 'u_l8', area: 15, kind: 'flat', beds: 2, baths: 2, balc: 1, size: 900, floor: 3, floors: 6, furn: 0, rent: 15500, svc: 1500, covers: 'Guard, lift, generator', adv: 1, gas: 'pipeline', water: 'in_service', gasBill: 'tenant', elec: 'prepaid', accepts: ['family', 'job_holders'], am: ['lift', 'generator', 'guard'], avail: 0, ago: 3, addr: 'House 27, Road 3, Pallabi', desc: 'পল্লবীতে লিফটসহ ২ বেডরুমের ফ্ল্যাট। মিরপুর ১১ মেট্রো স্টেশনের কাছে।', scout: 'u_s1' },
    { by: 'u_l8', area: 14, kind: 'mess_seat', beds: 1, baths: 1, balc: 0, size: 110, floor: 3, floors: 5, furn: 1, rent: 4000, svc: 0, covers: '', adv: 1, gas: 'cylinder', water: 'in_rent', gasBill: 'in_rent', elec: 'in_rent', accepts: ['students'], am: ['wifi'], avail: 0, ago: 10, addr: 'House 6, Avenue 4, Mirpur 11', desc: 'ছাত্রদের মেস। তিন বেলা খাবার আর ওয়াই-ফাই ভাড়ার মধ্যে।' },
    { by: 'u_l9', area: 50, kind: 'flat', beds: 3, baths: 3, balc: 2, size: 1500, floor: 6, floors: 10, furn: 1, rent: 38000, svc: 4500, covers: 'Guard, lift, generator, CCTV, gym', adv: 2, gas: 'cylinder', water: 'in_service', gasBill: 'tenant', elec: 'prepaid', accepts: ['family'], am: ['lift', 'generator', 'parking_car', 'cctv', 'guard', 'gated'], avail: 14, ago: 2, addr: 'Plot 12, Road 5, Block D, Bashundhara R/A', desc: 'Modern flat in a gated Bashundhara building, near North South University. Listed by an agent.' },
    { by: 'u_l9', area: 50, kind: 'studio', beds: 1, baths: 1, balc: 1, size: 550, floor: 3, floors: 10, furn: 2, rent: 20000, svc: 2000, covers: 'Lift, generator, Wi-Fi, cleaning', adv: 1, gas: 'cylinder', water: 'in_rent', gasBill: 'tenant', elec: 'prepaid', accepts: ['job_holders', 'single_men', 'single_women'], am: ['lift', 'generator', 'wifi', 'cctv'], avail: 0, ago: 6, addr: 'Plot 12, Road 5, Block D, Bashundhara R/A (3rd floor)', desc: 'Furnished studio for one working person. Listed by an agent.' },
    { by: 'u_l10', area: 31, kind: 'flat', beds: 3, baths: 3, balc: 2, size: 1350, floor: 4, floors: 7, furn: 0, rent: 30000, svc: 3500, covers: 'Guard, lift, generator, CCTV', adv: 1, gas: 'pipeline', water: 'in_service', gasBill: 'tenant', elec: 'prepaid', accepts: ['family'], am: ['lift', 'generator', 'parking_car', 'cctv', 'guard'], avail: 21, ago: null, addr: 'House 10, Road 4, Sector 4, Uttara', desc: 'New listing waiting for review. Holding tax receipt uploaded.', status: 'in_review' },
    { by: 'u_l10', area: 31, kind: 'sublet', beds: 1, baths: 1, balc: 0, size: 170, floor: 2, floors: 7, furn: 1, rent: 8000, svc: 0, covers: '', adv: 1, gas: 'pipeline', water: 'in_rent', gasBill: 'in_rent', elec: 'in_rent', accepts: ['students', 'single_men'], am: ['attached_bath', 'wifi'], avail: 0, ago: 2, addr: 'House 10, Road 4, Sector 4, Uttara (room 3)', desc: 'Room with attached bath for a male student near Uttara Sector 4 park.' },
  ];

  const ROLE_OF = { u_l5: ['caretaker', 'Caretaker for the owner, Mr. Siddique (abroad)'], u_l8: ['family', "Owner's daughter"], u_l9: ['agent', 'Agent with written permission from the owner'] };

  function seed() {
    const R = rng(26102026);
    const t0 = now();
    const at = d => iso(t0 - d * DAY);
    const s = {
      schema: SCHEMA, rev: 1, client: CLIENT, seededAt: iso(t0),
      users: [], staff: [], docs: [], idChecks: [], properties: [], proofs: [], listings: [], favourites: [], savedSearches: [],
      conversations: [], messages: [], viewings: [], consents: [], records: [], deals: [], payoutAccounts: [], advances: [], bankTxns: [],
      payouts: [], scouts: [], scoutSubs: [], reports: [], blocks: [], deletions: [], notifications: [], audit: [],
      settings: {
        pilotMode: true, feePct: 3, feeMin: 199, feeMax: 1500, advanceCap: 50000, autoReplies: true, autoApprove: false, skipWaits: true,
        escrow: { bank: 'Demo Bank PLC', branch: 'Gulshan Avenue (demo)', name: 'Basha Bari Ltd. — Escrow Account', number: '0000 1234 5678 90', routing: '000261726' },
      },
    };
    state = s;
    s.staff.push({ id: 's1', name: 'Founder 1', place: 'UK', role: 'admin', email: 'founder1@bashabari.demo' });
    s.staff.push({ id: 's2', name: 'Founder 2', place: 'Dhaka', role: 'admin', email: 'founder2@bashabari.demo' });

    PEOPLE.forEach((p, i) => {
      const role = ROLE_OF[p.id];
      const u = {
        id: p.id, kind: p.kind, name_en: p.en, name_bn: p.bn, phone: p.phone, lang: p.lang, level: p.verified != null ? 2 : 1, status: 'active',
        createdAt: at(p.joined), verifiedAt: p.verified != null ? at(p.verified) : null, legalName: p.verified != null ? p.en : null, avatar: 100 + i * 37,
        household: p.household || [], householdSize: p.size || null, occupation: p.job || '', seeded: true, busyToday: false,
        callHours: { days: ['sat', 'sun', 'mon', 'tue', 'wed', 'thu'], from: '10:00', to: '20:00' }, roleNote: role ? role[1] : '',
      };
      s.users.push(u);
      const art = { name: p.en, number: p.nid, dob: p.dob, docType: p.doc, avatar: u.avatar };
      const reviewed = p.verified != null;
      const atDoc = t0 - (p.verified != null ? p.verified : 0.03) * DAY - 30 * MIN;
      if (p.id === 'u_r3') {
        // Farhan's first try was blurry and rejected; the second try is waiting for review.
        const f1 = addDoc(u.id, 'nid_front', Object.assign({ side: 'front', blurry: true }, art), t0 - 20 * HOUR);
        const b1 = addDoc(u.id, 'nid_back', Object.assign({ side: 'back' }, art), t0 - 20 * HOUR);
        const se1 = addDoc(u.id, 'selfie', { avatar: u.avatar, name: p.en }, t0 - 20 * HOUR);
        s.idChecks.push({ id: 'kyc_r3a', userId: u.id, docType: p.doc, numberHash: sha256('pepper:' + p.nid), docNumber: p.nid, docLast4: p.nid.slice(-4), legalName: p.en, dob: p.dob, frontId: f1.id, backId: b1.id, selfieId: se1.id, liveness: true, faceScore: 0.61, dupOf: null, status: 'rejected', reviewedBy: 's2', reviewedAt: iso(t0 - 19 * HOUR), rejectReason: 'NID photo is blurry', createdAt: iso(t0 - 20 * HOUR) });
      }
      const front = addDoc(u.id, p.doc === 'passport' ? 'passport' : 'nid_front', Object.assign({ side: 'front' }, art), atDoc);
      const back = p.doc === 'passport' ? null : addDoc(u.id, 'nid_back', Object.assign({ side: 'back' }, art), atDoc);
      const selfie = addDoc(u.id, 'selfie', { avatar: u.avatar, name: p.en }, atDoc);
      s.idChecks.push({
        id: 'kyc_' + p.id.slice(2), userId: u.id, docType: p.doc, numberHash: sha256('pepper:' + p.nid), docNumber: p.nid, docLast4: p.nid.slice(-4), legalName: p.en, dob: p.dob,
        frontId: front.id, backId: back ? back.id : null, selfieId: selfie.id, liveness: true, faceScore: Math.round((0.82 + R() * 0.13) * 100) / 100, dupOf: null,
        status: reviewed ? 'approved' : 'pending', reviewedBy: reviewed ? (i % 2 ? 's1' : 's2') : null, reviewedAt: reviewed ? u.verifiedAt : null, rejectReason: null, createdAt: iso(atDoc),
      });
    });

    HOMES.forEach((h, i) => {
      const a = BB.area(h.area);
      const exact = { lat: +(a.lat + (R() - 0.5) * 0.008).toFixed(6), lng: +(a.lng + (R() - 0.5) * 0.008).toFixed(6) };
      const owner = s.users.find(u => u.id === h.by);
      const role = ROLE_OF[h.by];
      const pid = 'prop_' + String(i + 1).padStart(2, '0');
      const status = h.status || 'active';
      s.properties.push({ id: pid, ownerId: h.by, areaId: h.area, address: h.addr + ', Dhaka', exact, pub: fuzz(exact.lat, exact.lng, R), listerRole: role ? role[0] : 'owner', relation: role ? role[1] : '', proofStatus: status === 'in_review' ? 'pending' : 'approved', createdAt: at((h.ago || 0) + 1) });
      const kinds = role && role[0] !== 'owner' ? ['owner_permission', 'owner_nid'] : [i % 3 === 0 ? 'utility_bill' : i % 3 === 1 ? 'holding_tax' : 'deed'];
      for (const k of kinds) {
        const d = addDoc(h.by, k, { kind: k, name: role && k !== 'owner_nid' ? owner.name_en : 'Owner of ' + h.addr, address: h.addr }, t0 - ((h.ago || 0) + 1) * DAY);
        s.proofs.push({ propertyId: pid, docId: d.id, status: status === 'in_review' ? 'pending' : 'approved', reviewedBy: status === 'in_review' ? null : 's2' });
      }
      const titles = makeTitles(h.kind, h.beds, h.area, h.accepts);
      const avail = new Date(t0 + h.avail * DAY).toISOString().slice(0, 10);
      s.listings.push({
        id: 'lst_' + String(i + 1).padStart(2, '0'), propertyId: pid, listerId: h.by, kind: h.kind, status, pricePeriod: 'month', rent: h.rent, service: h.svc, serviceCovers: h.covers,
        advanceMonths: h.adv, beds: h.beds, baths: h.baths, balconies: h.balc, size: h.size, floor: h.floor, floors: h.floors, furnishing: h.furn, gas: h.gas,
        waterBill: h.water, gasBill: h.gasBill, electricity: h.elec, amenities: h.am, accepts: h.accepts, availableFrom: avail, title_en: titles.en, title_bn: titles.bn,
        description: h.desc, callHours: owner.callHours, photos: photosFor(roomsFor(h.kind, h.beds, h.baths, h.balc), 1000 + i * 17),
        publishedAt: h.ago != null ? iso(t0 - h.ago * DAY - (i % 5) * HOUR) : null, createdAt: at((h.ago || 0) + 1), updatedAt: at(h.ago || 0),
        views: Math.floor(20 + R() * 300), scoutId: h.scout || null, palette: i % 6,
      });
    });
    s.listings[8].views = 412;

    // Scouts and their submissions.
    for (const id of ['u_s1', 'u_s2']) s.scouts.push({ userId: id, agreementAt: at(18), payoutAccountId: null, dailyLimit: 10, status: 'active' });
    s.scoutSubs.push({ id: 'sub_01', scoutId: 'u_s1', draft: null, landlordPhone: null, capturePoint: null, listingId: 'lst_15', status: 'live', invitedAt: at(5), confirmedAt: at(4), earnedLiveAt: at(3), earnedLetAt: null, paidLiveAt: null, paidLetAt: null });
    s.scoutSubs.push({ id: 'sub_02', scoutId: 'u_s2', draft: null, landlordPhone: null, capturePoint: null, listingId: 'lst_13', status: 'live', invitedAt: at(10), confirmedAt: at(9), earnedLiveAt: at(8), earnedLetAt: null, paidLiveAt: at(1), paidLetAt: null });
    s.scoutSubs.push({
      id: 'sub_03', scoutId: 'u_s1', landlordPhone: '01711000299', capturePoint: { lat: 23.8191, lng: 90.3672 }, listingId: null, status: 'invited', invitedAt: iso(t0 - 26 * HOUR), confirmedAt: null, earnedLiveAt: null, earnedLetAt: null, paidLiveAt: null, paidLetAt: null,
      draft: { kind: 'flat', areaId: 14, address: 'House 3, Road 1, Avenue 2, Mirpur 11, Dhaka', exact: { lat: 23.8191, lng: 90.3672 }, role: 'owner', beds: 2, baths: 2, balconies: 1, size: 850, floor: 2, floors: 5, furnishing: 0, rent: 14500, service: 1200, serviceCovers: 'Guard', advanceMonths: 1, gas: 'pipeline', waterBill: 'in_service', gasBill: 'tenant', electricity: 'prepaid', accepts: ['family'], amenities: ['guard'], availableFrom: new Date(t0 + 9 * DAY).toISOString().slice(0, 10), description: 'Captured by a scout from a To-Let sign.', occupantOk: true, proofKinds: ['holding_tax'] },
    });

    // Payout bank accounts.
    const pa = (id, userId, name, bank, last, status, days) => {
      const d = addDoc(userId, 'bank_proof', { kind: 'bank_proof', name, bank, last4: last }, t0 - days * DAY);
      s.payoutAccounts.push({ id, userId, accountName: name, accountNo: '20501' + last.padStart(8, '0'), last4: last, bank, routing: '000' + last + '00', proofId: d.id, status, usableFrom: status === 'approved' ? at(days - 2) : null, reviewedBy: status === 'approved' ? 's2' : null, createdAt: at(days), nameOnId: s.users.find(u => u.id === userId).legalName });
    };
    pa('pa_l1', 'u_l1', 'Abdul Karim', 'Demo Bank PLC', '4421', 'approved', 30);
    pa('pa_l2', 'u_l2', 'Rokeya Begum', 'Sample Commercial Bank', '9087', 'approved', 25);
    pa('pa_l3', 'u_l3', 'Md. Mizanur Rahman', 'Demo Bank PLC', '1150', 'pending', 0.2);
    pa('pa_l7', 'u_l7', 'Habibur Rahman', 'Example Islami Bank', '3366', 'approved', 20);
    pa('pa_s1', 'u_s1', 'Rakib Hasan', 'Sample Commercial Bank', '7781', 'approved', 15);
    s.scouts[0].payoutAccountId = 'pa_s1';

    const conv = (id, listingId, renterId, stage, days) => { const l = s.listings.find(x => x.id === listingId); const c = { id, listingId, renterId, landlordId: l.listerId, stage, createdAt: at(days), readAt: {} }; s.conversations.push(c); return c; };
    const msg = (convId, senderId, body, minsAgo, extra) => s.messages.push(Object.assign({ id: uid('m'), convId, senderId, body, masked: false, at: iso(t0 - minsAgo * MIN) }, extra || {}));
    const smsg = (convId, en, bn, kind, minsAgo) => s.messages.push({ id: uid('m'), convId, senderId: null, system: kind, body_en: en, body_bn: bn, at: iso(t0 - minsAgo * MIN) });
    const SAFE = ['Phone numbers, links and bKash numbers stay hidden until you both tap "Share my details". Never pay any advance before you have seen the home and signed.', 'আপনারা দুজনেই "আমার তথ্য শেয়ার করুন" না চাপা পর্যন্ত ফোন নম্বর, লিংক আর বিকাশ নম্বর লুকানো থাকবে। বাসা না দেখে আর সই না করে কোনো অগ্রিম দেবেন না।'];

    // 1. Tanvir ↔ Abdul Karim: viewing agreed, details not shared yet.
    const c1 = conv('c_01', 'lst_01', 'u_r1', 'viewing_agreed', 2);
    smsg(c1.id, SAFE[0], SAFE[1], 'safety', 2 * 1440);
    msg(c1.id, 'u_r1', 'আসসালামু আলাইকুম। ফ্ল্যাটটি কি এখনও খালি আছে?', 2 * 1440 - 5);
    msg(c1.id, 'u_l1', 'ওয়ালাইকুম আসসালাম। জি, খালি আছে। এই মাস থেকেই উঠতে পারবেন।', 2 * 1440 - 40);
    msg(c1.id, 'u_r1', 'শনিবার সকালে দেখতে আসতে পারি?', 1440 + 300);
    const sat = nextWeekday(t0, 6, 11);
    s.viewings.push({ id: 'v_01', convId: c1.id, proposedBy: 'u_r1', slots: [sat, iso(ms(sat) + 4 * HOUR)], startsAt: sat, status: 'accepted', createdAt: iso(t0 - (1440 + 299) * MIN), decidedAt: iso(t0 - 1440 * MIN) });
    smsg(c1.id, 'Viewing agreed: ' + BB.fmt.dateTime(sat, 'en'), 'বাসা দেখার সময় ঠিক হয়েছে: ' + BB.fmt.dateTime(sat, 'bn'), 'viewing', 1440);
    msg(c1.id, 'u_l1', 'ঠিক আছে, শনিবার ১১টায় আসুন।', 1439);
    c1.readAt = { u_r1: iso(t0 - 1430 * MIN), u_l1: iso(t0 - 1430 * MIN) };

    // 2. Nusrat ↔ Rokeya: the whole journey done; advance held, moved in, payout waiting for the second founder.
    const c2 = conv('c_02', 'lst_04', 'u_r2', 'deal_agreed', 14);
    smsg(c2.id, SAFE[0], SAFE[1], 'safety', 14 * 1440);
    msg(c2.id, 'u_r2', 'Assalamu alaikum, we are a family of four. Is the flat available?', 14 * 1440 - 3);
    msg(c2.id, 'u_l2', 'জি আপা, খালি আছে। বৃহস্পতিবার বিকেলে দেখতে পারেন।', 14 * 1440 - 60);
    const v2at = iso(t0 - 11 * DAY - 6 * HOUR);
    s.viewings.push({ id: 'v_02', convId: c2.id, proposedBy: 'u_l2', slots: [v2at], startsAt: v2at, status: 'done', createdAt: at(13), decidedAt: at(13) });
    smsg(c2.id, 'Viewing agreed: ' + BB.fmt.dateTime(v2at, 'en'), 'বাসা দেখার সময় ঠিক হয়েছে: ' + BB.fmt.dateTime(v2at, 'bn'), 'viewing', 13 * 1440);
    s.consents.push({ convId: c2.id, userId: 'u_r2', viewingId: 'v_02', at: at(12), used: true }, { convId: c2.id, userId: 'u_l2', viewingId: 'v_02', at: at(12), used: true });
    const l4 = s.listings.find(x => x.id === 'lst_04');
    const p4 = s.properties.find(x => x.id === l4.propertyId);
    const snap = {
      issuedAt: at(12), viewingAt: v2at,
      renter: { id: 'u_r2', name: 'Nusrat Jahan', name_bn: 'নুসরাত জাহান', phone: '01811000102', idLast4: '0123', idType: 'nid', verifiedAt: at(39), avatar: s.users[1].avatar, household: ['family'], householdSize: 4, occupation: 'School teacher' },
      landlord: { id: 'u_l2', name: 'Rokeya Begum', name_bn: 'রোকেয়া বেগম', phone: '01811000202', idLast4: '9012', idType: 'nid', verifiedAt: at(79), avatar: s.users[6].avatar, role: 'owner', relation: '', callHours: s.users[6].callHours },
      home: { listingId: 'lst_04', title_en: l4.title_en, title_bn: l4.title_bn, area_en: 'Shyamoli', area_bn: 'শ্যামলী', address: p4.address, exact: p4.exact, rent: 16000, service: 1500, advanceMonths: 1, waterBill: 'in_service', gasBill: 'tenant', electricity: 'prepaid', gas: 'pipeline' },
    };
    const h2 = sha256(JSON.stringify(snap));
    s.records.push({ id: 'rec_02', convId: c2.id, viewingId: 'v_02', snapshot: snap, sha256: h2, prevSha256: null, verifyCode: h2.slice(0, 10).toUpperCase(), createdAt: at(12) });
    smsg(c2.id, 'Contact details shared. You both received the same record.', 'যোগাযোগের তথ্য শেয়ার হয়েছে। আপনারা দুজনেই একই রেকর্ড পেয়েছেন।', 'record', 12 * 1440);
    msg(c2.id, 'u_l2', 'Deal ঠিক আছে। ১ তারিখ থেকে উঠতে পারবেন।', 10 * 1440);
    const moveIn = new Date(t0 - 1 * DAY).toISOString().slice(0, 10);
    const d2 = { id: 'deal_02', convId: c2.id, recordId: 'rec_02', rent: 16000, advance: 16000, moveIn, proposedBy: 'u_l2', status: 'confirmed', renterAt: at(10), landlordAt: at(10), confirmedAt: at(10), paidConfirm: {}, paidDirectlyAt: null, receiptSha: null, method: 'protected', createdAt: at(10),
      moveInCheck: { keys: true, elec: '04521', gas: '', water: '0187', notes: 'Kitchen tap leaks a little; landlord will fix it this week.', photos: 3, at: at(1), landlordAt: null } };
    d2.sha256 = sha256(JSON.stringify([d2.id, d2.recordId, d2.rent, d2.advance, d2.moveIn, d2.renterAt, d2.landlordAt]));
    d2.moveInCheck.sha256 = sha256(JSON.stringify({ keys: true, elec: '04521', gas: '', water: '0187', notes: d2.moveInCheck.notes, photos: 3 }));
    s.deals.push(d2);
    smsg(c2.id, 'Deal confirmed by both of you. The home is now marked "Let agreed".', 'আপনারা দুজনেই চুক্তি নিশ্চিত করেছেন। বাসাটি এখন "ভাড়া চূড়ান্ত"।', 'deal', 10 * 1440);
    s.advances.push({ id: 'adv_02', dealId: 'deal_02', convId: c2.id, renterId: 'u_r2', landlordId: 'u_l2', payoutAccountId: 'pa_l2', advance: 16000, fee: 0, reference: 'BB-7K3Q9', moveIn, status: 'held', renterSentAt: at(9), receivedAt: at(8.9), movedInAt: at(1), autoReleaseAt: iso(ms(moveIn + 'T12:00:00+06:00') + 72 * HOUR), releaseDue: true, disputeReason: null, decidedBy: null, createdAt: at(9.5), outcome: 'release' });
    s.bankTxns.push({ id: 'txn_01', ref: 'NPSB4402918871', direction: 'in', amount: 16000, narration: 'NPSB BB-7K3Q9 NUSRAT JAHAN', fromAccount: '••••5531', booked: at(8.9), advanceId: 'adv_02', importedBy: 's2' });
    s.payouts.push({ id: 'po_01', advanceId: 'adv_02', kind: 'to_landlord', amount: 16000, toAccountId: 'pa_l2', preparedBy: 's2', preparedAt: iso(t0 - 3 * HOUR), approvedBy: null, note: 'Renter moved in yesterday' });
    smsg(c2.id, 'Advance received and held at the bank: ৳16,000.', 'অগ্রিম পাওয়া গেছে এবং ব্যাংকে জমা আছে: ৳১৬,০০০।', 'advance', 8.9 * 1440);
    smsg(c2.id, 'Move-in check saved: keys received, meter readings recorded.', 'বাসায় ওঠার চেকলিস্ট সংরক্ষিত: চাবি পাওয়া গেছে, মিটারের রিডিং লেখা হয়েছে।', 'deal', 1440);
    c2.readAt = { u_r2: at(0.9), u_l2: at(0.9) };

    // 3. Sadia ↔ Shahnaz: the landlord typed a phone number, which was hidden.
    const c3 = conv('c_03', 'lst_08', 'u_r4', 'enquiry', 1);
    smsg(c3.id, SAFE[0], SAFE[1], 'safety', 1440);
    msg(c3.id, 'u_r4', 'Hello, I work at a bank in Dhanmondi. Is the room still free?', 1440 - 2);
    msg(c3.id, 'u_l4', 'Yes it is. Call me on ••• to talk.', 1440 - 30, { masked: true });
    smsg(c3.id, 'A phone number or link was hidden. Details are shared only when you both agree.', 'একটি ফোন নম্বর বা লিংক লুকানো হয়েছে। দুজনে রাজি হলেই কেবল তথ্য শেয়ার হয়।', 'masked', 1440 - 30);
    c3.readAt = { u_l4: at(0.9) };

    // 4. Tanvir ↔ Kamal (agent): asked for money by bKash before any viewing; Tanvir reported it.
    const c4 = conv('c_04', 'lst_18', 'u_r1', 'enquiry', 3);
    smsg(c4.id, SAFE[0], SAFE[1], 'safety', 3 * 1440);
    msg(c4.id, 'u_r1', 'Is the studio available from next week?', 3 * 1440 - 4);
    const bad = { id: 'm_bad', convId: c4.id, senderId: 'u_l9', body: 'Yes. Send ৳5,000 booking money to my bKash ••• today to hold it.', masked: true, at: iso(t0 - (3 * 1440 - 20) * MIN) };
    s.messages.push(bad);
    smsg(c4.id, 'Safety: never send any advance before you have seen the home and signed. Use the protected advance, which is held at the bank until you move in.', 'সতর্কতা: বাসা না দেখে আর সই না করে কোনো অগ্রিম পাঠাবেন না। সুরক্ষিত অগ্রিম ব্যবহার করুন — বাসায় ওঠা পর্যন্ত টাকা ব্যাংকে থাকে।', 'warning', 3 * 1440 - 20);
    c4.readAt = { u_r1: at(2.9), u_l9: at(2.9) };
    s.reports.push({ id: 'rep_01', reporterId: 'u_r1', targetType: 'message', targetId: 'm_bad', reason: 'Asked for money before a viewing', details: 'The agent asked for ৳5,000 by bKash to "hold" the studio before I saw it.', status: 'open', createdAt: at(2.9) });

    // Favourites, saved searches, a deletion request and notifications.
    s.favourites.push({ userId: 'u_r1', listingId: 'lst_05', at: at(2) }, { userId: 'u_r1', listingId: 'lst_06', at: at(1) }, { userId: 'u_r4', listingId: 'lst_08', at: at(1) });
    s.savedSearches.push({ id: 'ss_01', userId: 'u_r1', label: 'Mirpur · up to ৳25,000', filters: Object.assign(BB.defaultFilters(), { areaIds: [10], maxTotal: 25000 }), alert: 'instant', createdAt: at(10) });
    s.deletions.push({ userId: 'u_r5', requestedAt: at(5), deleteAfter: iso(t0 + 23 * DAY), reason: 'Found a home elsewhere', cancelledAt: null, holdReason: null, completedAt: null });
    s.users.find(u => u.id === 'u_r5').status = 'deletion_pending';
    s.notifications.push({ id: 'n_s1', userId: 'u_r1', at: at(1), en: 'Viewing agreed for ' + BB.fmt.dateTime(sat, 'en'), bn: 'বাসা দেখার সময় ঠিক হয়েছে: ' + BB.fmt.dateTime(sat, 'bn'), link: 'chat/c_01', read: false });
    s.notifications.push({ id: 'n_s2', userId: 'u_r3', at: iso(t0 - 19 * HOUR), en: 'We could not verify your ID: NID photo is blurry. Please try again.', bn: 'আপনার পরিচয় যাচাই করা যায়নি: এনআইডির ছবি ঝাপসা। আবার চেষ্টা করুন।', link: 'verify', read: true });
    s.notifications.push({ id: 'n_s3', userId: 'u_r2', at: at(1), en: 'Move-in check saved. The advance will be paid to the landlord once both founders approve.', bn: 'বাসায় ওঠার চেকলিস্ট সংরক্ষিত। দুই প্রতিষ্ঠাতা অনুমোদন দিলেই অগ্রিম বাড়িওয়ালাকে দেওয়া হবে।', link: 'advance/adv_02', read: false });

    // A short audit history (hash-chained).
    const A = (d, actor, action, target, reason) => { const e = audit(actor, action, target, reason); e.at = at(d); };
    A(30, 'staff:s2', 'kyc.approved', 'kyc_l1');
    A(13, 'staff:s1', 'pii.revealed', 'kyc_r2', 'Checking the NID number against the photo before approval');
    A(12, 'system', 'contact.shared', 'rec_02');
    A(10, 'system', 'deal.confirmed', 'deal_02');
    A(8.9, 'system', 'advance.held', 'adv_02');
    A(1, 'user:u_r2', 'advance.moved_in', 'adv_02');
    A(0.13, 'staff:s2', 'payout.prepared', 'adv_02');
    // Re-chain with the backdated times so "Verify chain" passes.
    let prev = '';
    for (const e of s.audit) { e.prevHash = prev; e.hash = sha256(prev + JSON.stringify([e.id, e.at, e.actor, e.action, e.target, e.reason, e.meta])); prev = e.hash; }
    return s;
  }
  function nextWeekday(t, weekday, hour) {
    // Next given weekday (0 = Sunday … 6 = Saturday) at `hour`:00 Dhaka time, at least 1 day ahead.
    const dhaka = new Date(t + 6 * HOUR);
    let d = new Date(Date.UTC(dhaka.getUTCFullYear(), dhaka.getUTCMonth(), dhaka.getUTCDate(), hour - 6, 0, 0));
    do { d = new Date(d.getTime() + DAY); } while (new Date(d.getTime() + 6 * HOUR).getUTCDay() !== weekday);
    return d.toISOString();
  }
  BB.nextWeekday = nextWeekday;

  root.BB = BB;
  if (typeof module !== 'undefined') module.exports = BB;
})(typeof window !== 'undefined' ? window : globalThis);
