/*
 * Basha Bari demo: the phone app for renters, landlords and scouts (Bangla and English).
 * The admin website is a separate page (admin.html). Both use the shared store in store.js.
 */
(function () {
  'use strict';
  const F = BB.fmt, I = ART.icon, esc = ART.esc;
  BB.load();
  const S = () => BB.state();

  // ───────────── Session: who is signed in on this device (never shared) ─────────────
  const SKEY = 'bb.demo.session.app';
  let session = readJSON(SKEY) || { lang: 'bn', onboarded: false, userId: null, made: [] };
  function readJSON(k) { try { return JSON.parse(BB.local.getItem(k)); } catch (e) { return null; } }
  function saveSession() { try { BB.local.setItem(SKEY, JSON.stringify(session)); } catch (e) { /* private mode */ } }
  const lang = () => session.lang || 'bn';
  const bn = () => lang() === 'bn';
  function L(en, bnText, v) {
    let s = bn() ? bnText : en;
    if (v) s = s.replace(/\{(\w+)\}/g, (_, k) => (v[k] == null ? '' : typeof v[k] === 'number' ? F.num(v[k], lang()) : v[k]));
    return s;
  }
  const me = () => (session.userId ? BB.get.user(session.userId) : null);
  const lvl = () => { const u = me(); if (!u) return 0; if (u.status === 'suspended') return 1; return u.level; };
  const nm = u => (u ? (bn() ? u.name_bn : u.name_en) : '');
  const firstName = u => nm(u).split(' ')[0];
  const shortName = u => { const p = nm(u).split(' '); return p.length > 1 ? p[0] + ' ' + p[p.length - 1][0] + '.' : p[0]; };
  const money = n => F.money(n, lang());
  const num = n => F.num(n, lang());
  const dig = s => F.digits(s, lang());
  const lab = (g, c) => BB.label(g, c, lang());
  const ago = s => F.ago(s, lang());
  const when = s => F.dateTime(s, lang());
  const day = s => F.date(s, lang());
  const areaName = a => (a ? (bn() ? a.bn : a.en) : '');
  const msgText = m => (m.system ? (bn() ? m.body_bn : m.body_en) : m.body);
  const ymd = t => new Date(t + 6 * BB.HOUR).toISOString().slice(0, 10);
  const today = () => ymd(Date.now());

  // ───────────── Screen state ─────────────
  const ui = {
    f: Object.assign(BB.defaultFilters(), session.filters || {}), q: '', suggest: [], suggestOpen: false, view: 'list', page: 1,
    pin: null, mapMove: false, sheet: null, viewer: null, room: 'all', wizard: null, verify: null, after: null, viewed: {}, seen: {},
  };
  const $screen = document.getElementById('screen');
  const $tabs = document.getElementById('tabbar');
  const $sheet = document.getElementById('sheet');
  const $sms = document.getElementById('sms');
  const $toast = document.getElementById('toast');
  const $side = document.getElementById('side');

  function route() {
    const h = location.hash.replace(/^#\/?/, '');
    const parts = h.split('/').map(decodeURIComponent);
    return { name: parts[0] || 'search', args: parts.slice(1) };
  }
  function go(path) { const target = '#/' + path; if (location.hash === target) render(true); else location.hash = target; }
  const TAB_OF = { search: 'search', listing: 'search', saved: 'saved', messages: 'messages', chat: 'messages', record: 'messages', deal: 'messages', advance: 'messages', v: 'messages', homes: 'homes', post: 'homes', account: 'account', verify: 'account', notifications: 'account', page: 'account', profile: 'account', scout: 'scout', scoutnew: 'scout', invite: 'account' };

  // ───────────── Rendering ─────────────
  function captureFocus() {
    const a = document.activeElement;
    if (!a || !a.id || !/INPUT|TEXTAREA|SELECT/.test(a.tagName)) return null;
    return { id: a.id, start: a.selectionStart, end: a.selectionEnd };
  }
  function restoreFocus(f) {
    if (!f) return;
    const el = document.getElementById(f.id);
    if (!el) return;
    el.focus({ preventScroll: true });
    try { if (f.start != null) el.setSelectionRange(f.start, f.end); } catch (e) { /* number inputs */ }
  }
  function checkSession() {
    const u = me();
    if (session.userId && (!u || u.status === 'deleted' || u.status === 'deletion_pending')) { session.userId = null; saveSession(); }
  }
  let lastRoute = '';
  function render(reset) {
    checkSession();
    document.documentElement.lang = bn() ? 'bn' : 'en';
    if (!session.onboarded) {
      $screen.innerHTML = scrOnboard();
      $tabs.hidden = true;
      renderSide();
      return;
    }
    const r = route();
    const key = r.name + '/' + r.args.join('/');
    if (key !== lastRoute) reset = true;
    lastRoute = key;
    const fn = SCREENS[r.name] || scrSearch;
    const focus = captureFocus();
    const scroll = reset ? 0 : $screen.scrollTop;
    destroyMinis();
    let html;
    try { html = fn.apply(null, r.args); } catch (e) { console.error(e); html = `<div class="empty">${I('alert', 40)}<p>${esc(e.message)}</p><button class="btn" data-a="nav" data-to="search">${L('Back to search', 'খোঁজে ফিরে যান')}</button></div>`; }
    $screen.innerHTML = html;
    $tabs.hidden = false;
    $tabs.innerHTML = tabs(TAB_OF[r.name] || 'search');
    $screen.scrollTop = scroll;
    restoreFocus(focus);
    after(r);
    renderSheet();
    renderSide();
  }
  function after(r) {
    if (r.name === 'search' && ui.view === 'map') mountSearchMap();
    if (r.name === 'listing') mountListingMap(r.args[0]);
    if (r.name === 'record') mountRecordMap(r.args[0]);
    if (r.name === 'post' || r.name === 'scoutnew') mountWizardMap();
    if (r.name === 'chat') { const log = document.getElementById('chatlog'); if (log) $screen.scrollTop = $screen.scrollHeight; }
  }
  let toastTimer = null;
  function toast(msg, isErr) {
    $toast.textContent = msg;
    $toast.className = 'toast show' + (isErr ? ' err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $toast.className = 'toast'; }, isErr ? 4200 : 2600);
  }
  let smsTimer = null;
  function sms(text) {
    $sms.innerHTML = `<div class="appic">${I('chat', 18)}</div><div class="grow"><b>BashaBari · SMS <span class="demo-tag">DEMO</span></b><p>${esc(text)}</p></div>`;
    $sms.className = 'sms show';
    clearTimeout(smsTimer);
    smsTimer = setTimeout(() => { $sms.className = 'sms'; }, 9000);
  }
  $sms.addEventListener('click', () => { $sms.className = 'sms'; });
  function run(fn) {
    try { return fn(); } catch (e) {
      console.error(e);
      toast(bn() ? e.bn || e.message : e.en || e.message, true);
      return null;
    }
  }

  // ───────────── Common pieces ─────────────
  function top(title, opts) {
    opts = opts || {};
    return `<header class="top"><div class="row">` +
      (opts.back !== false ? `<button class="icon-btn" data-a="back" aria-label="Back">${I('back', 22)}</button>` : '') +
      `<h1 class="grow ellipsis">${esc(title)}</h1>${opts.right || ''}</div>${opts.below || ''}</header>`;
  }
  function langBtn() { return `<button class="btn plain sm" data-a="lang" title="Language">${I('globe', 16)} ${bn() ? 'EN' : 'বাংলা'}</button>`; }
  function bell() {
    const u = me();
    const n = u ? BB.unreadNotifications(u.id) : 0;
    return `<button class="icon-btn" data-a="nav" data-to="notifications" aria-label="Notifications">${I('bell', 22)}${n ? `<span class="dot">${num(n)}</span>` : ''}</button>`;
  }
  function tabs(active) {
    const u = me();
    const scout = u && BB.scoutOf(u.id);
    const items = [
      ['search', 'search', L('Search', 'খুঁজুন'), 0],
      ['saved', 'heart', L('Saved', 'সংরক্ষিত'), 0],
      ['messages', 'chat', L('Messages', 'বার্তা'), u ? BB.unreadCount(u.id) : 0],
      scout ? ['scout', 'compass', L('Scout', 'স্কাউট'), 0] : ['homes', 'home', L('My homes', 'আমার বাসা'), 0],
      ['account', 'user', L('Account', 'অ্যাকাউন্ট'), u ? BB.unreadNotifications(u.id) : 0],
    ];
    return items.map(([r, ic, label, n]) => `<button data-a="nav" data-to="${r}" class="${active === r ? 'on' : ''}">${I(ic, 22)}<span>${esc(label)}</span>${n ? `<span class="dot">${num(n)}</span>` : ''}</button>`).join('');
  }
  function photoSrc(l, p) { return ART.room(p.room, p.seed, l.palette); }
  function trustBadges(v, small) {
    const out = [];
    if (v.trust >= 2) out.push(`<span class="badge ok">${I('shield', 13)} ${L('Ownership checked', 'মালিকানা যাচাই')}</span>`);
    else if (v.trust >= 1) out.push(`<span class="badge info">${I('check', 13)} ${L('ID checked', 'আইডি যাচাই')}</span>`);
    if (v.p.listerRole === 'agent') out.push(`<span class="badge warn">${L('Agent', 'এজেন্ট')}</span>`);
    if (!small && v.l.scoutId) out.push(`<span class="badge">${I('camera', 12)} ${L('Photos by our scout', 'আমাদের স্কাউটের তোলা ছবি')}</span>`);
    return out.join('');
  }
  function priceLine(v) {
    const per = v.l.kind === 'mess_seat' ? L('/seat', '/সিট') : L('/month', '/মাস');
    return `<div class="price">${money(v.l.rent)} <small>${per}</small></div>` +
      (v.l.service ? `<div class="total">${L('{t} a month with service charge', 'সার্ভিস চার্জসহ মাসে {t}', { t: money(v.total) })}</div>` : `<div class="total">${L('No service charge', 'সার্ভিস চার্জ নেই')}</div>`);
  }
  function factsLine(l) {
    const out = [];
    if (l.kind === 'mess_seat') out.push(`<span>${I('bed', 16)} ${L('1 seat', '১টি সিট')}</span>`);
    else out.push(`<span>${I('bed', 16)} ${num(l.beds)} ${l.kind === 'sublet' ? L('room', 'রুম') : L('bed', 'বেড')}</span>`);
    out.push(`<span>${I('bath', 16)} ${num(l.baths)} ${L('bath', 'বাথ')}</span>`);
    if (l.size) out.push(`<span>${I('area', 16)} ${num(l.size)} ${L('sq ft', 'বর্গফুট')}</span>`);
    return out.join('');
  }
  function acceptsLine(l) { return l.accepts.map(a => lab('accepts', a)).join(' · '); }
  function availText(l) { return l.availableFrom <= today() ? L('Available now', 'এখনই ওঠা যাবে') : L('Available from {d}', '{d} থেকে ওঠা যাবে', { d: day(l.availableFrom) }); }
  function card(v) {
    const l = v.l;
    const u = me();
    const fav = u && BB.favouriteOf(u.id, l.id);
    const photos = lvl() >= 1 ? l.photos : l.photos.slice(0, 1);
    return `<article class="card" data-a="open" data-id="${l.id}">
      <div class="photos"><div class="track">${photos.map(p => `<img loading="lazy" alt="${esc(lab('room', p.room))}" src="${photoSrc(l, p)}">`).join('')}</div>
        <div class="tl">${trustBadges(v, true)}</div>
        <button class="fav ${fav ? 'on' : ''}" data-a="fav" data-id="${l.id}" aria-label="Save">${I('heart', 20)}</button>
        <span class="badge dark count">${I('camera', 12)} <span class="n">${num(1)}</span>/${num(l.photos.length)}</span>
        ${l.status === 'let_agreed' ? `<span class="ribbon">${L('Let agreed', 'ভাড়া চূড়ান্ত')}</span>` : ''}
        ${lvl() < 1 && l.photos.length > 1 ? `<div class="lockover" style="padding-top:0;background:none;justify-content:flex-end;align-items:flex-start;padding:0 0 10px 12px"><span class="badge dark">${I('lock', 12)} ${L('Sign up to see all {n} photos', 'সব {n}টি ছবি দেখতে সাইন আপ করুন', { n: l.photos.length })}</span></div>` : ''}
      </div>
      <div class="card-body">${priceLine(v)}<div class="facts">${factsLine(l)}</div>
        <h3>${esc(BB.title(l, lang()))}</h3><div class="meta">${esc(lab('kind', l.kind))} · ${esc(acceptsLine(l))} · ${esc(availText(l))}</div>
        <div class="added"><span>${L('Added {a}', '{a} যোগ হয়েছে', { a: ago(l.publishedAt) })}</span><span>${esc(lab('role', v.p.listerRole))}</span></div></div>
    </article>`;
  }
  function gateBox(title, body, btn, action) {
    return `<div class="gate">${I('lock', 30)}<h3 style="margin-bottom:6px">${esc(title)}</h3><p class="muted small">${esc(body)}</p><button class="btn" data-a="${action}">${esc(btn)}</button></div>`;
  }

  // ───────────── Onboarding ─────────────
  function scrOnboard() {
    return `<div class="onboard"><div class="hero"><div class="mark">বা</div><h1>বাসাবাড়ি · Basha Bari</h1><p style="opacity:.9;margin-top:6px">${L('Rent a home in Bangladesh, safely.', 'নিরাপদে বাসা ভাড়া নিন, বাসা দিন।')}</p></div>
      <div class="card2"><div class="row between" style="margin-bottom:10px"><b>${L('Choose your language', 'ভাষা বেছে নিন')}</b><div class="seg"><button class="${bn() ? 'on' : ''}" data-a="setlang" data-l="bn">বাংলা</button><button class="${!bn() ? 'on' : ''}" data-a="setlang" data-l="en">English</button></div></div>
        <div class="feature">${I('search', 22)}<div><b>${L('Search without signing up', 'সাইন আপ ছাড়াই খুঁজুন')}</b><div class="small muted">${L('Real homes with the real monthly cost, on a list or a map.', 'আসল বাসা, মাসের আসল খরচসহ — তালিকা বা ম্যাপে।')}</div></div></div>
        <div class="feature">${I('shield', 22)}<div><b>${L('Everyone is ID-checked', 'সবার পরিচয় যাচাই করা')}</b><div class="small muted">${L('Landlords and renters verify with NID and a selfie. Landlords also prove they own the home.', 'বাড়িওয়ালা ও ভাড়াটিয়া এনআইডি আর সেলফি দিয়ে যাচাই করেন। বাড়িওয়ালা মালিকানাও প্রমাণ করেন।')}</div></div></div>
        <div class="feature">${I('lock', 22)}<div><b>${L('Numbers stay private', 'নম্বর গোপন থাকে')}</b><div class="small muted">${L('Phone and address are shared only when you both agree.', 'দুজনে রাজি হলেই কেবল ফোন আর ঠিকানা শেয়ার হয়।')}</div></div></div>
        <div class="feature">${I('bank', 22)}<div><b>${L('Your advance is held at a bank', 'অগ্রিম ব্যাংকে জমা থাকে')}</b><div class="small muted">${L('The landlord is paid only after you move in.', 'আপনি বাসায় ওঠার পরেই বাড়িওয়ালা টাকা পান।')}</div></div></div>
        <button class="btn block" style="margin-top:12px" data-a="start">${L('Start searching', 'খোঁজা শুরু করুন')}</button>
        <button class="btn plain block" style="margin-top:8px" data-a="start-login">${L('I already have an account', 'আমার অ্যাকাউন্ট আছে')}</button>
      </div><p class="center tiny muted" style="margin:16px">${L('Demo with made-up data. Nothing here is real.', 'বানানো তথ্য দিয়ে তৈরি ডেমো। এখানে কিছুই আসল নয়।')}</p></div>`;
  }

  // ───────────── Search (list and map) ─────────────
  function activeFilterCount() {
    const d = BB.defaultFilters(), f = ui.f;
    let n = 0;
    for (const k of Object.keys(d)) {
      if (['areaIds', 'kinds', 'sort', 'bounds', 'keywords'].includes(k)) continue;
      const a = JSON.stringify(f[k]), b = JSON.stringify(d[k]);
      if (a !== b) n++;
    }
    return n;
  }
  function areaLabel() {
    if (!ui.f.areaIds.length) return L('Dhaka', 'ঢাকা');
    return ui.f.areaIds.map(id => areaName(BB.area(id))).join(', ');
  }
  function scrSearch() {
    ui.seen.search = true;
    const rows = BB.search(Object.assign({}, ui.f, { bounds: ui.view === 'map' && ui.mapMove ? ui.f.bounds : null }));
    const shown = rows.slice(0, ui.page * 10);
    const kinds = ['flat', 'sublet', 'mess_seat', 'studio', 'house'];
    const nf = activeFilterCount();
    const u = me();
    let html = `<header class="top"><div class="row"><a class="brand" data-a="nav" data-to="search"><span class="mark">বা</span><span>${L('Basha Bari', 'বাসাবাড়ি')}<small>${L('Homes to rent', 'ভাড়ার বাসা')}</small></span></a><span class="grow"></span>${langBtn()}${bell()}</div>
      <div class="searchbox" style="margin-top:8px">${I('search', 18, 'lead')}<input id="q" class="input" autocomplete="off" placeholder="${esc(L('Area, e.g. Mirpur 10 or মিরপুর', 'এলাকা, যেমন মিরপুর ১০ বা Uttara'))}" value="${esc(ui.q || (ui.f.areaIds.length ? areaLabel() : ''))}" data-in="q">
      ${ui.q || ui.f.areaIds.length ? `<button class="icon-btn clear" data-a="clear-area" aria-label="Clear">${I('x', 18)}</button>` : ''}
      ${ui.suggestOpen && ui.suggest.length ? `<div class="suggest">${ui.suggest.map(a => `<button data-a="pick-area" data-id="${a.id}">${I('pin', 18)}<span class="grow"><b>${esc(areaName(a))}</b><br><span class="tiny muted">${esc(a.parent ? areaName(BB.area(a.parent)) : '')}${BB.areaChildren(a.id).length ? ' · ' + L('includes {n} areas', '{n}টি এলাকা সহ', { n: BB.areaChildren(a.id).length }) : ''}</span></span></button>`).join('')}</div>` : ''}</div>
      <div class="chips" style="margin-top:10px"><button class="chip ${!ui.f.kinds.length ? 'on' : ''}" data-a="kind" data-k="">${L('All', 'সব')}</button>${kinds.map(k => `<button class="chip ${ui.f.kinds.includes(k) ? 'on' : ''}" data-a="kind" data-k="${k}">${esc(lab('kind', k))}</button>`).join('')}</div>
    </header>
    <div class="toolbar"><button class="btn plain sm" data-a="filters">${I('sliders', 16)} ${L('Filters', 'ফিল্টার')}${nf ? ` <span class="badge brand">${num(nf)}</span>` : ''}</button>
      <button class="btn plain sm" data-a="view" data-v="${ui.view === 'map' ? 'list' : 'map'}">${ui.view === 'map' ? I('list', 16) + ' ' + L('List', 'তালিকা') : I('map', 16) + ' ' + L('Map', 'ম্যাপ')}</button>
      <span class="grow"></span><button class="btn soft sm" data-a="save-search">${I('bell', 16)} ${L('Save search', 'খোঁজ সংরক্ষণ')}</button></div>
    <div class="resultbar"><div><b>${L('{n} homes', '{n}টি বাসা', { n: rows.length })}</b> <span class="muted small">${L('in {a}', '{a} এলাকায়', { a: esc(areaLabel()) })}</span></div>
      <select class="sort" data-in="sort" id="sort">${[['recommended', L('Recommended', 'প্রস্তাবিত')], ['newest', L('Newest', 'নতুন')], ['price_asc', L('Lowest price', 'কম দাম')], ['price_desc', L('Highest price', 'বেশি দাম')]].map(([v, t]) => `<option value="${v}" ${ui.f.sort === v ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>`;
    if (ui.view === 'map') {
      html += `<div class="mapview" id="mapslot"></div>`;
    } else if (!rows.length) {
      html += `<div class="empty">${I('search', 40)}<p><b>${L('No homes match yet', 'এখনো মেলে এমন বাসা নেই')}</b></p><p class="small">${L('Try a bigger area or fewer filters. Save the search and we will tell you when one comes up.', 'বড় এলাকা বা কম ফিল্টার দিয়ে চেষ্টা করুন। খোঁজ সংরক্ষণ করলে নতুন বাসা এলে জানাব।')}</p><button class="btn ghost" data-a="reset-filters">${L('Clear filters', 'ফিল্টার মুছুন')}</button></div>`;
    } else {
      html += `<div class="cards">${shown.map(card).join('')}</div>`;
      if (rows.length > shown.length) html += `<div class="pad" style="padding-top:0"><button class="btn plain block" data-a="more">${L('Show more homes', 'আরও বাসা দেখুন')}</button></div>`;
      else html += `<p class="center tiny muted" style="padding:0 0 18px">${L("That's all for now. Save this search to hear about new homes.", 'এখন এ পর্যন্তই। নতুন বাসার খবর পেতে খোঁজটি সংরক্ষণ করুন।')}</p>`;
    }
    if (!u) html += `<div class="pad" style="padding-top:0"><div class="note">${I('info', 18)}<div>${L('You can search as a guest. Sign up free with your phone number to see all photos and details.', 'অতিথি হিসেবেও খুঁজতে পারেন। সব ছবি আর তথ্য দেখতে ফোন নম্বর দিয়ে বিনামূল্যে সাইন আপ করুন।')}</div></div></div>`;
    return html;
  }

  // ───────────── Listing page ─────────────
  function scrListing(id) {
    const l = BB.get.listing(id);
    if (!l) return top(L('Home not found', 'বাসা পাওয়া যায়নি')) + `<div class="empty">${I('home', 40)}<p>${L('This home is no longer listed.', 'এই বাসার বিজ্ঞাপন আর নেই।')}</p></div>`;
    const v = BB.view(l);
    const u = me();
    const mine = u && l.listerId === u.id;
    if (!mine && !['active', 'let_agreed'].includes(l.status)) return top(L('Home not available', 'বাসা পাওয়া যাচ্ছে না')) + `<div class="empty">${I('home', 40)}<p>${L('This home is not available right now.', 'এই বাসাটি এখন পাওয়া যাচ্ছে না।')}</p></div>`;
    if (!ui.viewed[id]) { ui.viewed[id] = 1; setTimeout(() => BB.countView(id, u && u.id), 0); }
    const level = lvl();
    const allPhotos = l.photos;
    const photos = level >= 1 ? (ui.room === 'all' ? allPhotos : allPhotos.filter(p => p.room === ui.room)) : allPhotos.slice(0, 2);
    const rooms = [...new Set(allPhotos.map(p => p.room))];
    const fav = u && BB.favouriteOf(u.id, l.id);
    const conv = u && S().conversations.find(c => c.listingId === l.id && c.renterId === u.id);
    const lister = v.lister;
    const per = l.kind === 'mess_seat' ? L('per seat a month', 'প্রতি সিট মাসে') : L('a month', 'প্রতি মাসে');
    let h = `<div class="gallery"><div class="topbtns"><button class="icon-btn" data-a="back">${I('back', 22)}</button><span class="row"><button class="icon-btn" data-a="share" data-id="${l.id}">${I('send', 20)}</button><button class="icon-btn" data-a="fav" data-id="${l.id}" style="${fav ? 'color:#e0245e' : ''}">${I('heart', 20)}</button></span></div>
      <div class="track">${photos.map((p, i) => `<figure data-a="${level >= 1 ? 'viewer' : 'gate-signup'}" data-i="${allPhotos.indexOf(p)}"><img class="${level < 1 && i > 0 ? 'blurred' : ''}" src="${photoSrc(l, p)}" alt=""><figcaption><span class="badge dark">${esc(lab('room', p.room))}${p.room === 'bedroom' || p.room === 'bath' ? ' ' + num(p.n) : ''}</span></figcaption>${level < 1 && i > 0 ? `<div class="lockover" style="padding:0">${I('lock', 26)}${L('Sign up free to see all {n} photos', 'সব {n}টি ছবি দেখতে বিনামূল্যে সাইন আপ করুন', { n: allPhotos.length })}</div>` : ''}</figure>`).join('')}</div>
      <span class="badge dark count">${I('camera', 12)} <span class="n">${num(1)}</span>/${num(photos.length)}</span></div>`;
    if (level >= 1 && rooms.length > 2) h += `<div class="roomtabs chips"><button class="chip ${ui.room === 'all' ? 'on' : ''}" data-a="room" data-r="all">${L('All photos', 'সব ছবি')}</button>${rooms.map(r => `<button class="chip ${ui.room === r ? 'on' : ''}" data-a="room" data-r="${r}">${esc(lab('room', r))}</button>`).join('')}</div>`;
    h += `<div class="section"><div class="row wrap" style="gap:6px;margin-bottom:8px">${trustBadges(v)}${l.status === 'let_agreed' ? `<span class="badge dark">${L('Let agreed', 'ভাড়া চূড়ান্ত')}</span>` : ''}</div>
      ${priceLine(v)}<h2 style="font-size:18px;margin:8px 0 2px">${esc(BB.title(l, lang()))}</h2><div class="muted small">${I('pin', 14)} ${esc(areaName(v.area))}, ${esc(areaName(BB.area(v.area.parent)))} · ${L('Added {a}', '{a} যোগ হয়েছে', { a: ago(l.publishedAt) })}</div>
      <div class="keyfacts" style="margin-top:14px">
        <div>${L('Type', 'ধরন')}<b>${esc(lab('kind', l.kind))}</b></div>
        <div>${l.kind === 'sublet' ? L('Rooms', 'রুম') : L('Bedrooms', 'বেডরুম')}<b>${l.kind === 'mess_seat' ? L('1 seat', '১টি সিট') : num(l.beds)}</b></div>
        <div>${L('Bathrooms', 'বাথরুম')}<b>${num(l.baths)}</b></div>
        <div>${L('Size', 'আয়তন')}<b>${l.size ? num(l.size) + ' ' + L('sq ft', 'বর্গফুট') : '—'}</b></div>
        <div>${L('Floor', 'তলা')}<b>${l.floor === 0 ? L('Ground', 'নিচতলা') : l.floor != null ? num(l.floor) + (l.floors ? ' / ' + num(l.floors) : '') : '—'}</b></div>
        <div>${L('Furnishing', 'ফার্নিচার')}<b>${esc(lab('furnishing', l.furnishing))}</b></div>
      </div>
      <div class="note ok" style="margin-top:12px">${I('calendar', 18)}<div><b>${esc(availText(l))}</b><br><span class="small">${L('Who can rent', 'কারা ভাড়া নিতে পারবেন')}: ${esc(acceptsLine(l))}</span></div></div></div>`;
    if (level < 1) {
      h += `<div class="section">${gateBox(L('Sign up to see full details', 'পুরো তথ্য দেখতে সাইন আপ করুন'), L('Free with your mobile number. See every photo, the bills, the service charge and the description.', 'মোবাইল নম্বর দিয়ে বিনামূল্যে। সব ছবি, বিল, সার্ভিস চার্জ আর বিবরণ দেখুন।'), L('Sign up free', 'বিনামূল্যে সাইন আপ'), 'gate-signup')}</div>`;
    } else {
      h += `<div class="section"><h2>${L('Monthly cost', 'মাসিক খরচ')}</h2><table class="costs">
        <tr><td>${L('Rent', 'ভাড়া')}</td><td>${money(l.rent)}</td></tr>
        <tr><td>${L('Service charge', 'সার্ভিস চার্জ')}${l.serviceCovers ? `<div class="tiny muted">${esc(l.serviceCovers)}</div>` : ''}</td><td>${l.service ? money(l.service) : L('None', 'নেই')}</td></tr>
        <tr class="total"><td>${L('Total', 'মোট')} ${per}</td><td>${money(v.total)}</td></tr></table>
        <table class="costs" style="margin-top:8px">
        <tr><td>${I('drop', 16)} ${L('Water bill', 'পানির বিল')}</td><td>${esc(lab('bill', l.waterBill))}</td></tr>
        <tr><td>${I('flame', 16)} ${L('Gas', 'গ্যাস')} · ${esc(lab('gas', l.gas))}</td><td>${esc(lab('bill', l.gasBill))}</td></tr>
        <tr><td>${I('bolt', 16)} ${L('Electricity', 'বিদ্যুৎ')}</td><td>${esc(lab('electricity', l.electricity))}</td></tr>
        <tr><td>${I('bank', 16)} ${L('Advance', 'অগ্রিম')}</td><td>${L('{n} month(s)', '{n} মাস', { n: l.advanceMonths })} · ${money(l.rent * l.advanceMonths)}</td></tr></table>
        ${l.advanceMonths > 1 ? `<div class="note warn" style="margin-top:10px">${I('alert', 18)}<div class="small">${L('More than one month in advance needs the Rent Controller\'s permission under the Premises Rent Control Act 1991. You can ask the landlord to accept one month.', 'বাড়ি ভাড়া নিয়ন্ত্রণ আইন ১৯৯১ অনুযায়ী এক মাসের বেশি অগ্রিম নিতে ভাড়া নিয়ন্ত্রকের অনুমতি লাগে। আপনি বাড়িওয়ালাকে এক মাস নিতে অনুরোধ করতে পারেন।')}</div></div>` : ''}
        <div class="note" style="margin-top:10px">${I('shield', 18)}<div class="small">${L('Pay the advance with a protected advance: it stays at the bank until you move in.', 'সুরক্ষিত অগ্রিম ব্যবহার করুন: বাসায় ওঠা পর্যন্ত টাকা ব্যাংকে থাকে।')}</div></div></div>`;
      if (l.amenities.length) h += `<div class="section"><h2>${L('Features', 'সুবিধাসমূহ')}</h2><div class="amen">${l.amenities.map(a => `<span>${I('check', 16)} ${esc(lab('amenity', a))}</span>`).join('')}</div></div>`;
      if (l.description) h += `<div class="section"><h2>${L('About this home', 'বাসা সম্পর্কে')}</h2><p style="white-space:pre-wrap">${esc(l.description)}</p><p class="tiny muted">${L('Written by the lister.', 'বিজ্ঞাপনদাতার লেখা।')}</p></div>`;
    }
    h += `<div class="section"><h2>${L('Location', 'অবস্থান')}</h2><div class="minimap" id="minimap"></div><p class="small muted" style="margin-top:8px">${I('lock', 14)} ${L('The circle shows the area. The exact address is shared only after you both agree a viewing time and both tap "Share my details".', 'বৃত্তটি এলাকা দেখায়। দুজনে বাসা দেখার সময় ঠিক করে "আমার তথ্য শেয়ার করুন" চাপলেই কেবল সঠিক ঠিকানা শেয়ার হয়।')}</p></div>`;
    if (level >= 1 && lister) {
      h += `<div class="section"><h2>${L('Listed by', 'বিজ্ঞাপনদাতা')}</h2><div class="lister"><img src="${ART.avatar(lister.avatar)}" alt=""><div class="grow"><b>${esc(shortName(lister))}</b> <span class="badge">${esc(lab('role', v.p.listerRole))}</span>
        <div class="small muted">${v.p.relation ? esc(v.p.relation) + ' · ' : ''}${L('On Basha Bari since {d}', '{d} থেকে বাসাবাড়িতে', { d: day(lister.createdAt) })}</div>
        <div class="row wrap" style="margin-top:6px;gap:6px">${lister.level >= 2 ? `<span class="badge ok">${I('check', 12)} ${L('ID checked', 'আইডি যাচাই')}</span>` : ''}${lister.busyToday ? `<span class="badge warn">${L('Busy today', 'আজ ব্যস্ত')}</span>` : ''}</div></div></div>
        <p class="small muted" style="margin-top:10px">${I('clock', 14)} ${L('Prefers contact', 'যোগাযোগের সময়')}: ${esc(hoursText(lister.callHours))}</p></div>`;
    }
    h += `<div class="section"><div class="note warn">${I('alert', 18)}<div class="small"><b>${L('Stay safe', 'নিরাপদ থাকুন')}</b><br>${L('Never pay any advance before you have seen the home and signed. Basha Bari will never ask you to send money to a personal bKash number.', 'বাসা না দেখে আর সই না করে কোনো অগ্রিম দেবেন না। বাসাবাড়ি কখনো ব্যক্তিগত বিকাশ নম্বরে টাকা পাঠাতে বলবে না।')}</div></div>
      ${level >= 1 && !mine ? `<button class="link small" style="margin-top:12px" data-a="report" data-t="listing" data-id="${l.id}">${I('flag', 14)} ${L('Report this listing', 'এই বিজ্ঞাপন সম্পর্কে অভিযোগ')}</button>` : ''}</div>`;
    let bar;
    if (mine) bar = `<button class="btn plain" data-a="nav" data-to="homes">${L('Manage my homes', 'আমার বাসা ব্যবস্থাপনা')}</button><span class="badge">${esc(lab('listingStatus', l.status))}</span>`;
    else if (l.status === 'let_agreed') bar = `<button class="btn plain" disabled>${L('This home is let', 'এই বাসা ভাড়া হয়ে গেছে')}</button>`;
    else if (level < 1) bar = `<button class="btn" data-a="gate-signup">${L('Sign up to see full details', 'পুরো তথ্য দেখতে সাইন আপ করুন')}</button>`;
    else if (level < 2) bar = `<button class="btn" data-a="nav" data-to="verify">${I('shield', 18)} ${L('Verify your ID to contact', 'যোগাযোগ করতে আইডি যাচাই করুন')}</button>`;
    else if (conv) bar = `<button class="btn" data-a="nav" data-to="chat/${conv.id}">${I('chat', 18)} ${L('Open chat', 'চ্যাট খুলুন')}</button>`;
    else bar = `<button class="btn ghost" data-a="contact" data-id="${l.id}" data-then="viewing">${I('calendar', 18)} ${L('Request viewing', 'দেখার অনুরোধ')}</button><button class="btn" data-a="contact" data-id="${l.id}">${I('chat', 18)} ${L('Message', 'বার্তা')}</button>`;
    h += `<div class="stickybar">${bar}</div>`;
    return h;
  }
  function hoursText(ch) {
    if (!ch) return '—';
    const dn = { sat: L('Sat', 'শনি'), sun: L('Sun', 'রবি'), mon: L('Mon', 'সোম'), tue: L('Tue', 'মঙ্গল'), wed: L('Wed', 'বুধ'), thu: L('Thu', 'বৃহস্পতি'), fri: L('Fri', 'শুক্র') };
    return ch.days.map(d => dn[d]).join(', ') + ' · ' + dig(ch.from) + '–' + dig(ch.to);
  }

  // ───────────── Saved ─────────────
  function scrSaved() {
    const u = me();
    if (!u) return top(L('Saved', 'সংরক্ষিত'), { back: false }) + `<div class="pad">${gateBox(L('Save homes and searches', 'বাসা আর খোঁজ সংরক্ষণ করুন'), L('Sign up to keep favourites and get alerts when a matching home comes up.', 'পছন্দের বাসা রাখতে আর মিলে যাওয়া নতুন বাসার খবর পেতে সাইন আপ করুন।'), L('Sign up free', 'বিনামূল্যে সাইন আপ'), 'gate-signup')}</div>`;
    const favs = S().favourites.filter(f => f.userId === u.id).map(f => BB.get.listing(f.listingId)).filter(Boolean).map(BB.view);
    const searches = S().savedSearches.filter(s => s.userId === u.id);
    let h = top(L('Saved', 'সংরক্ষিত'), { back: false, right: bell() });
    h += `<div class="section"><h2>${L('Saved searches', 'সংরক্ষিত খোঁজ')}</h2>`;
    if (!searches.length) h += `<p class="muted small">${L('Save a search from the search screen to get alerts.', 'খোঁজার পাতা থেকে খোঁজ সংরক্ষণ করলে নতুন বাসার খবর পাবেন।')}</p>`;
    for (const s of searches) {
      const n = BB.search(s.filters).length;
      h += `<div class="panel tight" style="margin-bottom:10px"><div class="row between"><div class="grow"><b>${esc(s.label)}</b><div class="tiny muted">${L('{n} homes now', 'এখন {n}টি বাসা', { n })}</div></div><button class="btn soft sm" data-a="open-search" data-id="${s.id}">${L('Open', 'খুলুন')}</button><button class="icon-btn" data-a="del-search" data-id="${s.id}">${I('trash', 18)}</button></div>
        <div class="row" style="margin-top:8px"><span class="small muted">${L('Alerts', 'নোটিফিকেশন')}</span><div class="seg">${[['instant', L('Instant', 'সাথে সাথে')], ['daily', L('Daily', 'দিনে একবার')], ['off', L('Off', 'বন্ধ')]].map(([v, t]) => `<button class="${s.alert === v ? 'on' : ''}" data-a="alert" data-id="${s.id}" data-v="${v}">${esc(t)}</button>`).join('')}</div></div></div>`;
    }
    h += `</div><div class="section"><h2>${L('Favourite homes', 'পছন্দের বাসা')}</h2>`;
    if (!favs.length) h += `<p class="muted small">${L('Tap the heart on a home to save it here.', 'বাসার ছবিতে হার্ট চাপলে এখানে জমা হবে।')}</p></div>`;
    else h += `</div><div class="cards">${favs.map(card).join('')}</div>`;
    return h;
  }

  // ───────────── Messages and chat ─────────────
  function scrMessages() {
    const u = me();
    if (!u) return top(L('Messages', 'বার্তা'), { back: false }) + `<div class="pad">${gateBox(L('Talk to landlords safely', 'নিরাপদে বাড়িওয়ালার সাথে কথা বলুন'), L('Sign up and verify your ID to message landlords. Numbers stay hidden until you both agree.', 'বার্তা পাঠাতে সাইন আপ করে আইডি যাচাই করুন। দুজনে রাজি না হওয়া পর্যন্ত নম্বর গোপন থাকে।'), L('Sign up free', 'বিনামূল্যে সাইন আপ'), 'gate-signup')}</div>`;
    const convs = BB.convsOf(u.id);
    let h = top(L('Messages', 'বার্তা'), { back: false, right: bell() });
    if (!convs.length) return h + `<div class="empty">${I('chat', 40)}<p><b>${L('No messages yet', 'এখনো কোনো বার্তা নেই')}</b></p><p class="small">${L('Find a home and tap Message.', 'বাসা খুঁজে "বার্তা" চাপুন।')}</p><button class="btn" data-a="nav" data-to="search">${L('Search homes', 'বাসা খুঁজুন')}</button></div>`;
    h += `<div class="list">`;
    for (const c of convs) {
      const l = BB.get.listing(c.listingId);
      const other = BB.get.user(c.renterId === u.id ? c.landlordId : c.renterId);
      const last = BB.messagesOf(c.id).slice(-1)[0];
      const unread = BB.messagesOf(c.id).some(m => m.senderId !== u.id && new Date(m.at) > new Date((c.readAt || {})[u.id] || 0));
      h += `<button data-a="nav" data-to="chat/${c.id}"><img class="thumb" src="${photoSrc(l, l.photos[0])}" alt=""><div class="grow"><div class="row between"><b class="ellipsis">${esc(shortName(other))}</b><span class="tiny muted nowrap">${last ? ago(last.at) : ''}</span></div>
        <div class="tiny muted ellipsis">${esc(BB.title(l, lang()))}</div><div class="small ellipsis" style="${unread ? 'font-weight:700' : 'color:var(--muted)'}">${last ? esc(msgText(last)) : ''}</div>
        <div style="margin-top:4px">${stageBadge(c)}</div></div>${unread ? '<span class="unread"></span>' : ''}</button>`;
    }
    return h + `</div>`;
  }
  const STAGES = ['enquiry', 'viewing_agreed', 'contacts_shared', 'deal_agreed', 'moved_in'];
  function stageOf(c) {
    const d = BB.dealOf(c.id);
    if (d && d.moveInCheck) return 'moved_in';
    if (c.stage === 'viewing_proposed') return 'enquiry';
    return c.stage;
  }
  function stageBadge(c) {
    const s = stageOf(c);
    const t = { enquiry: L('Enquiry', 'জিজ্ঞাসা'), viewing_agreed: L('Viewing agreed', 'দেখার সময় ঠিক'), contacts_shared: L('Details shared', 'তথ্য শেয়ার হয়েছে'), deal_agreed: L('Deal agreed', 'চুক্তি নিশ্চিত'), moved_in: L('Moved in', 'বাসায় উঠেছেন'), closed: L('Closed', 'বন্ধ') }[s];
    return `<span class="badge ${s === 'enquiry' ? '' : s === 'closed' ? 'danger' : 'ok'}">${esc(t || s)}</span>`;
  }
  function scrChat(id) {
    const u = me();
    const c = BB.get.conv(id);
    if (!u || !c || (c.renterId !== u.id && c.landlordId !== u.id)) return top(L('Chat', 'চ্যাট')) + `<div class="empty">${L('This chat is not available.', 'এই চ্যাটটি পাওয়া যাচ্ছে না।')}</div>`;
    setTimeout(() => BB.markRead(c.id, u.id), 300);
    const l = BB.get.listing(c.listingId);
    const iAmRenter = c.renterId === u.id;
    const other = BB.get.user(iAmRenter ? c.landlordId : c.renterId);
    const rec = BB.recordOf(c.id);
    const stage = stageOf(c);
    const si = STAGES.indexOf(stage);
    let h = `<div class="chat-head"><div class="row"><button class="icon-btn" data-a="back">${I('back', 22)}</button><img class="avatar sm" src="${ART.avatar(other.avatar)}" alt=""><div class="grow"><b class="ellipsis" style="display:block">${esc(rec ? nm(other) : shortName(other))}</b><span class="tiny muted ellipsis" style="display:block">${esc(BB.title(l, lang()))}</span></div>
      <button class="icon-btn" data-a="nav" data-to="listing/${l.id}" title="Listing">${I('home', 20)}</button><button class="icon-btn" data-a="chat-menu" data-id="${c.id}">${I('flag', 20)}</button></div>
      <div class="progress">${STAGES.map((s, i) => `<span class="${i <= si ? 'on' : ''}"></span>`).join('')}</div>
      <div class="progress-labels"><span>${L('Enquiry', 'জিজ্ঞাসা')}</span><span>${L('Viewing', 'দেখা')}</span><span>${L('Details', 'তথ্য')}</span><span>${L('Deal', 'চুক্তি')}</span><span>${L('Moved in', 'উঠেছেন')}</span></div></div>`;
    h += `<div class="chatlog" id="chatlog">`;
    for (const m of BB.messagesOf(c.id)) {
      if (m.system) { h += `<div class="sysmsg ${m.system}">${esc(msgText(m))}</div>`; continue; }
      const mine = m.senderId === u.id;
      h += `<div class="bubble ${mine ? 'me' : ''}">${esc(m.body)}${m.masked ? `<div class="masked">${I('lock', 12)} ${L('Number or link hidden until you both share details', 'দুজনে তথ্য শেয়ার না করা পর্যন্ত নম্বর/লিংক লুকানো')}</div>` : ''}<time>${F.time(m.at, lang())}</time></div>`;
    }
    h += actionCards(c, u, other, iAmRenter) + `</div>`;
    if (c.stage === 'closed' || BB.isBlocked(c.renterId, c.landlordId)) {
      h += `<div class="composer"><div class="grow center small muted">${L('This conversation is closed.', 'এই কথোপকথন বন্ধ।')}</div></div>`;
    } else {
      h += `<div class="quick">${quickActions(c, u, iAmRenter)}</div><div class="composer"><textarea id="msg" class="input" rows="1" placeholder="${esc(L('Write a message…', 'বার্তা লিখুন…'))}" data-in="draft" data-id="${c.id}">${esc((ui.drafts || {})[c.id] || '')}</textarea><button class="btn" style="width:46px;padding:0" data-a="send" data-id="${c.id}" aria-label="Send">${I('send', 18)}</button></div>`;
    }
    return h;
  }
  function quickActions(c, u, iAmRenter) {
    const out = [];
    const v = BB.latestViewing(c.id);
    const rec = BB.recordOf(c.id);
    const d = BB.dealOf(c.id);
    if (!rec && (!v || ['declined', 'cancelled', 'done'].includes(v.status))) out.push(`<button class="chip" data-a="viewing-sheet" data-id="${c.id}">${I('calendar', 15)} ${L('Suggest viewing times', 'দেখার সময় প্রস্তাব')}</button>`);
    if (rec && !d) out.push(`<button class="chip" data-a="deal-sheet" data-id="${c.id}">${I('file', 15)} ${L('Confirm the deal', 'চুক্তি নিশ্চিত করুন')}</button>`);
    if (rec) out.push(`<button class="chip" data-a="nav" data-to="record/${rec.id}">${I('qr', 15)} ${L('Contact record', 'যোগাযোগের রেকর্ড')}</button>`);
    if (d && d.status === 'confirmed') out.push(`<button class="chip" data-a="nav" data-to="deal/${d.id}">${I('receipt', 15)} ${L('Deal and move-in', 'চুক্তি ও বাসায় ওঠা')}</button>`);
    out.push(`<button class="chip" data-a="nav" data-to="page/safety">${I('shield', 15)} ${L('Safety tips', 'নিরাপত্তা টিপস')}</button>`);
    return out.join('');
  }
  function actionCards(c, u, other, iAmRenter) {
    let h = '';
    const v = BB.latestViewing(c.id);
    const rec = BB.recordOf(c.id);
    const d = BB.dealOf(c.id);
    const on = first => firstName(first);
    if (v && v.status === 'proposed') {
      if (v.proposedBy === u.id) {
        h += `<div class="actioncard"><h4>${I('clock', 18)} ${L('Waiting for {n} to choose a time', '{n} সময় বেছে নেওয়ার অপেক্ষা', { n: on(other) })}</h4>${v.slots.map(s => `<div class="slot"><span>${esc(when(s))}</span></div>`).join('')}<button class="btn plain sm" data-a="viewing-decline" data-id="${v.id}">${L('Withdraw', 'তুলে নিন')}</button></div>`;
      } else {
        h += `<div class="actioncard"><h4>${I('calendar', 18)} ${L('{n} suggested viewing times', '{n} দেখার সময় প্রস্তাব করেছেন', { n: on(other) })}</h4>${v.slots.map(s => `<div class="slot"><span>${esc(when(s))}</span><button class="btn sm" data-a="viewing-accept" data-id="${v.id}" data-s="${s}">${L('Accept', 'রাজি')}</button></div>`).join('')}
          <div class="row"><button class="btn plain sm grow" data-a="viewing-sheet" data-id="${c.id}">${L('Suggest other times', 'অন্য সময় প্রস্তাব')}</button><button class="btn danger ghost sm" data-a="viewing-decline" data-id="${v.id}">${L('Decline', 'না')}</button></div></div>`;
      }
    }
    if (v && v.status === 'accepted' && !rec) {
      const cons = BB.consentsOf(c.id).filter(x => x.viewingId === v.id);
      const mineC = cons.some(x => x.userId === u.id), otherC = cons.some(x => x.userId === other.id);
      h += `<div class="actioncard"><h4>${I('calendar', 18)} ${L('Viewing agreed: {t}', 'দেখার সময় ঠিক: {t}', { t: esc(when(v.startsAt)) })}</h4>
        <p class="small muted" style="margin:0">${L('To get the exact address and phone numbers, you both tap "Share my details". You both receive the same record, and we keep a copy.', 'সঠিক ঠিকানা আর ফোন নম্বর পেতে দুজনকেই "আমার তথ্য শেয়ার করুন" চাপতে হবে। দুজনেই একই রেকর্ড পাবেন, আমরাও একটি কপি রাখি।')}</p>
        <div class="row"><span class="badge ${mineC ? 'ok' : ''}">${mineC ? I('check', 12) : ''} ${L('You', 'আপনি')}</span><span class="badge ${otherC ? 'ok' : ''}">${otherC ? I('check', 12) : ''} ${esc(on(other))}</span></div>
        ${mineC ? `<div class="small muted row"><span class="spin" style="color:var(--brand)"></span> ${L('Waiting for {n} to share', '{n}-এর শেয়ারের অপেক্ষা', { n: on(other) })}</div>` : `<button class="btn" data-a="share-details" data-id="${c.id}">${I('lock', 18)} ${L('Share my details', 'আমার তথ্য শেয়ার করুন')}</button>`}</div>`;
    }
    if (rec) {
      h += `<div class="actioncard"><h4>${I('qr', 18)} ${L('Contact record ready', 'যোগাযোগের রেকর্ড তৈরি')}</h4><p class="small muted" style="margin:0">${L('Phone: {p} · Address: {a}', 'ফোন: {p} · ঠিকানা: {a}', { p: esc(F.phone(iAmRenter ? rec.snapshot.landlord.phone : rec.snapshot.renter.phone, lang())), a: esc(rec.snapshot.home.address) })}</p><button class="btn soft sm" data-a="nav" data-to="record/${rec.id}">${L('Open the record', 'রেকর্ড খুলুন')}</button></div>`;
    }
    if (rec && d) {
      if (d.status === 'proposed') {
        const mineP = d.proposedBy === u.id;
        h += `<div class="actioncard"><h4>${I('file', 18)} ${L('Deal', 'চুক্তি')}</h4><table class="amount-table"><tr><td>${L('Rent', 'ভাড়া')}</td><td>${money(d.rent)}</td></tr><tr><td>${L('Advance', 'অগ্রিম')}</td><td>${money(d.advance)}</td></tr><tr><td>${L('Move-in date', 'ওঠার তারিখ')}</td><td>${esc(day(d.moveIn))}</td></tr></table>
          ${mineP ? `<div class="small muted row"><span class="spin" style="color:var(--brand)"></span> ${L('Waiting for {n} to confirm', '{n}-এর নিশ্চিতকরণের অপেক্ষা', { n: on(other) })}</div>` : `<div class="row"><button class="btn grow" data-a="deal-confirm" data-id="${d.id}">${L('Confirm with OTP', 'ওটিপি দিয়ে নিশ্চিত করুন')}</button><button class="btn plain" data-a="deal-sheet" data-id="${c.id}">${L('Change', 'বদলান')}</button></div>`}</div>`;
      } else if (d.status === 'confirmed') {
        const a = BB.advanceOf(d.id);
        h += `<div class="actioncard"><h4>${I('check', 18)} ${L('Deal confirmed', 'চুক্তি নিশ্চিত')}</h4><p class="small muted" style="margin:0">${L('Rent {r} · Advance {a} · Move in {d}', 'ভাড়া {r} · অগ্রিম {a} · ওঠা {d}', { r: money(d.rent), a: money(d.advance), d: esc(day(d.moveIn)) })}</p>`;
        if (a) h += `<div class="note ok">${I('bank', 18)}<div class="small"><b>${L('Protected advance', 'সুরক্ষিত অগ্রিম')}: ${esc(lab('advanceStatus', a.status))}</b><br>${L('Reference', 'রেফারেন্স')} ${esc(a.reference)}</div></div><button class="btn soft sm" data-a="nav" data-to="advance/${a.id}">${L('Open the protected advance', 'সুরক্ষিত অগ্রিম খুলুন')}</button>`;
        else if (d.paidDirectlyAt) h += `<div class="note ok">${I('receipt', 18)}<div class="small">${L('Advance paid directly. You both have the same receipt.', 'অগ্রিম সরাসরি দেওয়া হয়েছে। দুজনের কাছেই একই রসিদ আছে।')}</div></div>`;
        else if (iAmRenter) {
          const fee = BB.feeFor(d.advance);
          h += d.method === 'direct' && d.paidConfirm.renter
            ? `<div class="small muted row"><span class="spin" style="color:var(--brand)"></span> ${L('Waiting for {n} to confirm they received the advance', '{n} অগ্রিম পেয়েছেন কিনা নিশ্চিত করার অপেক্ষা', { n: on(other) })}</div>`
            : `<p class="small" style="margin:0"><b>${L('How do you want to pay the advance?', 'অগ্রিম কীভাবে দেবেন?')}</b></p>
            <button class="btn" data-a="protected" data-id="${d.id}">${I('shield', 18)} ${L('Protected advance (recommended)', 'সুরক্ষিত অগ্রিম (প্রস্তাবিত)')}</button>
            <p class="tiny muted" style="margin:-4px 0 0">${L('Bank transfer to our escrow account at the bank. Paid to the landlord only after you move in. Fee: {f}.', 'ব্যাংকে আমাদের এসক্রো অ্যাকাউন্টে ট্রান্সফার। আপনি ওঠার পরেই বাড়িওয়ালা পাবেন। ফি: {f}।', { f: fee ? money(fee) : L('free during the pilot', 'পাইলটে ফ্রি') })}</p>
            <button class="btn plain" data-a="paid-direct" data-id="${d.id}">${I('receipt', 18)} ${L('I paid the landlord directly — get a receipt', 'সরাসরি দিয়েছি — রসিদ নিন')}</button>`;
        } else {
          if (d.method === 'direct' && d.paidConfirm.renter && !d.paidConfirm.landlord) h += `<button class="btn" data-a="paid-direct" data-id="${d.id}">${I('receipt', 18)} ${L('Confirm you received {a}', '{a} পেয়েছেন নিশ্চিত করুন', { a: money(d.advance) })}</button>`;
          else h += `<p class="small muted" style="margin:0">${L('Waiting for the renter to choose how to pay the advance.', 'ভাড়াটিয়া কীভাবে অগ্রিম দেবেন তা বেছে নেওয়ার অপেক্ষা।')}</p>`;
          if (!BB.approvedPayoutAccount(u.id)) h += `<button class="btn soft sm" data-a="payout-sheet">${I('bank', 16)} ${L('Add your payout bank account', 'আপনার ব্যাংক অ্যাকাউন্ট যোগ করুন')}</button>`;
        }
        h += `<button class="btn plain sm" data-a="nav" data-to="deal/${d.id}">${L('Deal page and move-in check', 'চুক্তির পাতা ও বাসায় ওঠার চেকলিস্ট')}</button></div>`;
      }
    }
    return h;
  }

  // ───────────── Contact record, verify page ─────────────
  function party(p, title, extra) {
    return `<div class="party"><img class="avatar" src="${ART.avatar(p.avatar)}" alt=""><div class="grow"><div class="tiny muted">${esc(title)}</div><b>${esc(bn() ? p.name_bn || p.name : p.name)}</b>
      <div>${I('phone', 13)} ${esc(F.phone(p.phone, lang()))}</div><div class="tiny muted">${esc(lab('docType', p.idType || 'nid'))} ••••${esc(dig(p.idLast4))} · ${L('verified {d}', '{d} যাচাই', { d: p.verifiedAt ? day(p.verifiedAt) : '—' })}</div>${extra || ''}</div></div>`;
  }
  function scrRecord(id) {
    const u = me();
    const r = BB.get.record(id);
    if (!r || !u) return top(L('Record', 'রেকর্ড')) + `<div class="empty">${L('Record not found.', 'রেকর্ড পাওয়া যায়নি।')}</div>`;
    const c = BB.get.conv(r.convId);
    if (c.renterId !== u.id && c.landlordId !== u.id) return top(L('Record', 'রেকর্ড')) + `<div class="empty">${L('This record belongs to someone else.', 'এই রেকর্ডটি অন্য কারও।')}</div>`;
    const s = r.snapshot, hm = s.home;
    const ok = BB.verifyRecord(r);
    const household = (s.renter.household || []).map(a => lab('accepts', a)).join(', ');
    return top(L('Contact record', 'যোগাযোগের রেকর্ড'), { right: `<button class="icon-btn" data-a="print" title="PDF">${I('print', 20)}</button>` }) +
      `<div class="pad"><div class="record"><div class="rhead"><h2>${L('Contact record · Basha Bari', 'যোগাযোগের রেকর্ড · বাসাবাড়ি')}</h2><div class="small" style="opacity:.9">${L('Issued {d}. Both sides received this exact copy.', '{d} তারিখে তৈরি। দুই পক্ষই হুবহু এই কপি পেয়েছেন।', { d: esc(when(r.createdAt)) })}</div></div>
        ${party(s.renter, L('Renter', 'ভাড়াটিয়া'), `<div class="tiny muted">${esc(household)}${s.renter.householdSize ? ' · ' + L('{n} people', '{n} জন', { n: s.renter.householdSize }) : ''}${s.renter.occupation ? ' · ' + esc(s.renter.occupation) : ''}</div>`)}
        ${party(s.landlord, L('Landlord', 'বাড়িওয়ালা'), `<div class="tiny muted">${esc(lab('role', s.landlord.role))}${s.landlord.relation ? ' · ' + esc(s.landlord.relation) : ''}</div>`)}
        <div class="party" style="display:block"><div class="tiny muted">${L('Home', 'বাসা')}</div><b>${esc(bn() ? hm.title_bn : hm.title_en)}</b><div class="small">${I('pin', 13)} ${esc(hm.address)}</div>
          <div class="minimap" id="recmap" style="height:150px;margin-top:8px"></div>
          <table class="costs" style="margin-top:8px"><tr><td>${L('Viewing time', 'দেখার সময়')}</td><td>${esc(when(s.viewingAt))}</td></tr><tr><td>${L('Rent', 'ভাড়া')}</td><td>${money(hm.rent)}</td></tr><tr><td>${L('Service charge', 'সার্ভিস চার্জ')}</td><td>${money(hm.service)}</td></tr><tr><td>${L('Advance', 'অগ্রিম')}</td><td>${L('{n} month(s)', '{n} মাস', { n: hm.advanceMonths })}</td></tr><tr><td>${L('Water / gas / electricity', 'পানি / গ্যাস / বিদ্যুৎ')}</td><td class="small">${esc(lab('bill', hm.waterBill))} / ${esc(lab('bill', hm.gasBill))} / ${esc(lab('electricity', hm.electricity))}</td></tr></table></div>
        <div class="sha"><img src="${ART.qr(r.sha256)}" alt="QR" data-a="nav" data-to="v/${r.verifyCode}" style="cursor:pointer"><div class="grow"><div class="tiny muted">${L('Record ID', 'রেকর্ড আইডি')}</div><div class="mono">${esc(r.id)}</div><div class="tiny muted" style="margin-top:6px">${L('Fingerprint (SHA-256)', 'ফিঙ্গারপ্রিন্ট (SHA-256)')}</div><div class="mono">${esc(r.sha256)}</div>
          <div style="margin-top:6px">${ok ? `<span class="badge ok">${I('check', 12)} ${L('Unchanged since it was issued', 'তৈরির পর থেকে অপরিবর্তিত')}</span>` : `<span class="badge danger">${L('Changed!', 'পরিবর্তিত!')}</span>`}</div></div></div></div>
        <p class="tiny muted" style="margin-top:10px">${L('Tap the QR code to see what anyone sees when they scan it. In the real app, the QR opens a check page on our website. Demo: the pattern is drawn from the fingerprint and is not a scannable code.', 'কেউ স্ক্যান করলে কী দেখবেন তা দেখতে QR কোডে চাপুন। আসল অ্যাপে QR আমাদের ওয়েবসাইটের যাচাই পাতা খোলে। ডেমো: নকশাটি ফিঙ্গারপ্রিন্ট থেকে আঁকা, স্ক্যানযোগ্য নয়।')}</p></div>`;
  }
  function scrVerifyRecord(code) {
    const r = BB.get.recordByCode(code);
    return top(L('Check a record', 'রেকর্ড যাচাই')) + `<div class="pad"><div class="panel center">${r && BB.verifyRecord(r)
      ? `${I('shield', 44, '')}<h2 style="margin:10px 0 4px;color:var(--ok)">${L('Genuine record', 'আসল রেকর্ড')}</h2><p>${L('Issued on {d} between two verified Basha Bari users.', '{d} তারিখে বাসাবাড়ির দুজন যাচাই করা ব্যবহারকারীর মধ্যে তৈরি।', { d: esc(day(r.createdAt)) })}</p><p class="small muted">${L('For privacy, this page never shows names, phone numbers or addresses.', 'গোপনীয়তার জন্য এই পাতায় কখনো নাম, ফোন নম্বর বা ঠিকানা দেখানো হয় না।')}</p><div class="mono">${esc(code)}</div>`
      : `${I('alert', 44)}<h2 style="margin:10px 0 4px;color:var(--danger)">${L('Not found', 'পাওয়া যায়নি')}</h2><p>${L('We have no record with this code.', 'এই কোডের কোনো রেকর্ড আমাদের কাছে নেই।')}</p>`}</div><p class="tiny muted center" style="margin-top:10px">bashabari.example/v/${esc(code)} <span class="demo-tag">DEMO</span></p></div>`;
  }

  // ───────────── Deal page: terms, receipt, move-in check, police form preview ─────────────
  function scrDeal(id) {
    const u = me();
    const d = BB.get.deal(id);
    if (!u || !d) return top(L('Deal', 'চুক্তি')) + `<div class="empty">${L('Not found.', 'পাওয়া যায়নি।')}</div>`;
    const c = BB.get.conv(d.convId);
    if (c.renterId !== u.id && c.landlordId !== u.id) return top(L('Deal', 'চুক্তি')) + `<div class="empty">${L('This deal belongs to someone else.', 'এই চুক্তিটি অন্য কারও।')}</div>`;
    const l = BB.get.listing(c.listingId);
    const renter = BB.get.user(c.renterId), landlord = BB.get.user(c.landlordId);
    const iAmRenter = u.id === c.renterId;
    const a = BB.advanceOf(d.id);
    const rec = BB.get.record(d.recordId);
    let h = top(L('Deal and move-in', 'চুক্তি ও বাসায় ওঠা'), { right: `<button class="icon-btn" data-a="print">${I('print', 20)}</button>` });
    h += `<div class="section"><div class="row"><img class="thumb" src="${photoSrc(l, l.photos[0])}" alt=""><div class="grow"><b>${esc(BB.title(l, lang()))}</b><div class="small muted">${esc(rec ? rec.snapshot.home.address : '')}</div></div></div>
      <table class="amount-table" style="margin-top:12px"><tr><td>${L('Monthly rent', 'মাসিক ভাড়া')}</td><td>${money(d.rent)}</td></tr><tr><td>${L('Advance', 'অগ্রিম')}</td><td>${money(d.advance)}</td></tr><tr><td>${L('Move-in date', 'ওঠার তারিখ')}</td><td>${esc(day(d.moveIn))}</td></tr></table>
      <div class="kv small" style="margin-top:10px"><dt>${L('Renter confirmed', 'ভাড়াটিয়ার নিশ্চিতকরণ')}</dt><dd>${d.renterAt ? esc(when(d.renterAt)) + ' · OTP' : '—'}</dd><dt>${L('Landlord confirmed', 'বাড়িওয়ালার নিশ্চিতকরণ')}</dt><dd>${d.landlordAt ? esc(when(d.landlordAt)) + ' · OTP' : '—'}</dd>${d.sha256 ? `<dt>${L('Fingerprint', 'ফিঙ্গারপ্রিন্ট')}</dt><dd class="mono">${esc(d.sha256.slice(0, 32))}…</dd>` : ''}</div></div>`;
    h += `<div class="section"><h2>${L('Advance', 'অগ্রিম')}</h2>`;
    if (a) h += `<div class="note ok">${I('bank', 18)}<div><b>${L('Protected advance', 'সুরক্ষিত অগ্রিম')}: ${esc(lab('advanceStatus', a.status))}</b><br><span class="small">${L('Reference', 'রেফারেন্স')} ${esc(a.reference)}</span></div></div><button class="btn soft block" style="margin-top:10px" data-a="nav" data-to="advance/${a.id}">${L('Open the protected advance', 'সুরক্ষিত অগ্রিম খুলুন')}</button>`;
    else if (d.paidDirectlyAt) h += `<div class="panel tight"><div class="row">${I('receipt', 22)}<div class="grow"><b>${L('Advance receipt', 'অগ্রিমের রসিদ')}</b><div class="small muted">${L('{a} paid directly to {n}. Confirmed by both with OTP.', '{a} সরাসরি {n}-কে দেওয়া হয়েছে। দুজনেই ওটিপি দিয়ে নিশ্চিত করেছেন।', { a: money(d.advance), n: esc(nm(landlord)) })}</div><div class="mono tiny">${esc(d.receiptSha)}</div></div></div></div>`;
    else h += `<p class="small muted">${L('Not paid yet. Choose how to pay in the chat.', 'এখনো দেওয়া হয়নি। চ্যাট থেকে কীভাবে দেবেন বেছে নিন।')}</p><button class="btn plain sm" data-a="nav" data-to="chat/${c.id}">${L('Open the chat', 'চ্যাট খুলুন')}</button>`;
    h += `</div><div class="section"><h2>${I('key', 20)} ${L('Move-in check', 'বাসায় ওঠার চেকলিস্ট')}</h2>`;
    const m = d.moveInCheck;
    if (m) {
      h += `<div class="note ok">${I('check', 18)}<div class="small"><b>${L('Saved {d}', '{d} সংরক্ষিত', { d: esc(when(m.at)) })}</b></div></div>
        <table class="costs" style="margin-top:8px"><tr><td>${L('Keys received', 'চাবি পাওয়া গেছে')}</td><td>${m.keys ? L('Yes', 'হ্যাঁ') : L('No', 'না')}</td></tr><tr><td>${L('Electricity meter', 'বিদ্যুৎ মিটার')}</td><td>${esc(m.elec || '—')}</td></tr><tr><td>${L('Gas meter', 'গ্যাস মিটার')}</td><td>${esc(m.gas || '—')}</td></tr><tr><td>${L('Water meter', 'পানির মিটার')}</td><td>${esc(m.water || '—')}</td></tr><tr><td>${L('Condition photos', 'অবস্থার ছবি')}</td><td>${num(m.photos || 0)}</td></tr></table>
        ${m.notes ? `<p class="small" style="margin-top:8px"><b>${L('Notes', 'মন্তব্য')}:</b> ${esc(m.notes)}</p>` : ''}
        <p class="small">${m.landlordAt ? `<span class="badge ok">${I('check', 12)} ${L('Landlord confirmed the handover', 'বাড়িওয়ালা বুঝিয়ে দেওয়া নিশ্চিত করেছেন')}</span>` : !iAmRenter ? `<button class="btn sm" data-a="handover" data-id="${d.id}">${L('Confirm handover', 'বুঝিয়ে দেওয়া নিশ্চিত করুন')}</button>` : `<span class="badge">${L('Waiting for the landlord to confirm the handover', 'বাড়িওয়ালার নিশ্চিতকরণের অপেক্ষা')}</span>`}</p>`;
    } else if (iAmRenter && d.status === 'confirmed') {
      const mi = ui.movein || (ui.movein = { keys: false, elec: '', gas: '', water: '', notes: '', photos: 0 });
      h += `<p class="small muted">${L('On move-in day, record the keys and meter readings. The landlord sees the same check. If you used a protected advance, saving this tells us you have moved in.', 'ওঠার দিন চাবি আর মিটারের রিডিং লিখে রাখুন। বাড়িওয়ালাও একই চেকলিস্ট দেখবেন। সুরক্ষিত অগ্রিম নিলে এটি সংরক্ষণ করলেই আমরা বুঝব আপনি উঠেছেন।')}</p>
        <label class="check" style="margin:10px 0"><input type="checkbox" id="mi-keys" data-in="movein" data-k="keys" ${mi.keys ? 'checked' : ''}><span>${L('I received all the keys', 'সব চাবি পেয়েছি')}</span></label>
        <div class="stack"><label class="field"><span>${L('Electricity meter reading', 'বিদ্যুৎ মিটারের রিডিং')}</span><input class="input" id="mi-elec" inputmode="numeric" data-in="movein" data-k="elec" value="${esc(mi.elec)}"></label>
        <label class="field"><span>${L('Gas meter reading (if any)', 'গ্যাস মিটারের রিডিং (থাকলে)')}</span><input class="input" id="mi-gas" inputmode="numeric" data-in="movein" data-k="gas" value="${esc(mi.gas)}"></label>
        <label class="field"><span>${L('Water meter reading (if any)', 'পানির মিটারের রিডিং (থাকলে)')}</span><input class="input" id="mi-water" inputmode="numeric" data-in="movein" data-k="water" value="${esc(mi.water)}"></label>
        <label class="field"><span>${L('Anything broken or missing?', 'কিছু ভাঙা বা নেই?')}</span><textarea class="input" id="mi-notes" data-in="movein" data-k="notes">${esc(mi.notes)}</textarea></label></div>
        <div class="row" style="margin:10px 0"><button class="btn plain sm" data-a="movein-photo">${I('camera', 16)} ${L('Add a condition photo', 'অবস্থার ছবি যোগ করুন')}</button><span class="small muted">${L('{n} added', '{n}টি যোগ হয়েছে', { n: mi.photos })}</span></div>
        <button class="btn block" data-a="movein-save" data-id="${d.id}">${I('key', 18)} ${L("Save the move-in check — I've moved in", 'চেকলিস্ট সংরক্ষণ — আমি বাসায় উঠেছি')}</button>`;
    } else h += `<p class="small muted">${L('The renter fills this in on move-in day.', 'ভাড়াটিয়া ওঠার দিন এটি পূরণ করবেন।')}</p>`;
    h += `</div><div class="section"><h2>${I('file', 20)} ${L('Police tenant form (DMP CIMS)', 'পুলিশের ভাড়াটিয়া ফরম (ডিএমপি সিআইএমএস)')} <span class="badge">${L('Phase 2 preview', 'ফেজ ২ প্রিভিউ')}</span></h2>
      <p class="small muted">${L('Landlords and tenants in Dhaka must register with their local police station. In phase 2 the app fills in the form for you. We never submit it on your behalf.', 'ঢাকায় বাড়িওয়ালা ও ভাড়াটিয়াকে স্থানীয় থানায় নিবন্ধন করতে হয়। ফেজ ২-এ অ্যাপ ফরমটি পূরণ করে দেবে। আমরা কখনো আপনার পক্ষে জমা দিই না।')}</p>
      <table class="costs"><tr><td>${L('Tenant', 'ভাড়াটিয়া')}</td><td>${esc(nm(renter))}</td></tr><tr><td>${L('Tenant phone', 'ভাড়াটিয়ার ফোন')}</td><td>${esc(F.phone(renter.phone, lang()))}</td></tr><tr><td>${L('Household', 'পরিবারের সদস্য')}</td><td>${renter.householdSize ? num(renter.householdSize) : '—'}</td></tr><tr><td>${L('Landlord', 'বাড়িওয়ালা')}</td><td>${esc(nm(landlord))}</td></tr><tr><td>${L('Address', 'ঠিকানা')}</td><td class="small">${esc(rec ? rec.snapshot.home.address : '')}</td></tr><tr><td>${L('Move-in date', 'ওঠার তারিখ')}</td><td>${esc(day(d.moveIn))}</td></tr><tr><td>${L('Permanent address, emergency contact', 'স্থায়ী ঠিকানা, জরুরি যোগাযোগ')}</td><td class="small muted">${L('asked in phase 2', 'ফেজ ২-এ চাওয়া হবে')}</td></tr></table></div>`;
    return h;
  }

  // ───────────── Protected advance page ─────────────
  function scrAdvance(id) {
    const u = me();
    const a = BB.get.advance(id);
    if (!u || !a || (a.renterId !== u.id && a.landlordId !== u.id)) return top(L('Protected advance', 'সুরক্ষিত অগ্রিম')) + `<div class="empty">${L('Not found.', 'পাওয়া যায়নি।')}</div>`;
    const iAmRenter = a.renterId === u.id;
    const d = BB.get.deal(a.dealId);
    const es = S().settings.escrow;
    const total = a.advance + a.fee;
    const payouts = BB.payoutsOf(a.id);
    const po = payouts.find(p => p.kind !== 'fee_to_company');
    const step = (state, title, body) => `<div class="tl-item ${state}"><span class="tl-dot">${state === 'done' ? I('check', 12) : ''}</span><h4>${title}</h4>${body ? `<p>${body}</p>` : ''}</div>`;
    const st = a.status;
    const isHeld = st === 'held' || st === 'disputed';
    const sent = !!a.renterSentAt || st !== 'awaiting_payment';
    let h = top(L('Protected advance', 'সুরক্ষিত অগ্রিম'));
    h += `<div class="section"><div class="row between"><div><div class="tiny muted">${L('Status', 'অবস্থা')}</div><b style="font-size:17px">${esc(lab('advanceStatus', st))}</b></div><span class="badge ${st === 'released' ? 'ok' : st === 'disputed' || st === 'refunded' ? 'warn' : 'info'}">${esc(a.reference)}</span></div>
      <div class="timeline" style="margin-top:16px">
      ${step('done', L('Deal confirmed by both', 'দুজনেই চুক্তি নিশ্চিত করেছেন'), esc(day(d.confirmedAt || d.createdAt)))}
      ${step(st === 'awaiting_payment' ? 'now' : 'done', iAmRenter ? L('Send the bank transfer', 'ব্যাংক ট্রান্সফার পাঠান') : L('Renter sends the bank transfer', 'ভাড়াটিয়া ব্যাংক ট্রান্সফার পাঠাবেন'), a.renterSentAt ? L('Sent {t}', '{t} পাঠানো হয়েছে', { t: esc(when(a.renterSentAt)) }) : '')}
      ${step(isHeld || st === 'released' || st === 'refunded' ? 'done' : sent ? 'now' : '', L('Received and held at the bank', 'ব্যাংকে পৌঁছেছে ও জমা আছে'), a.receivedAt ? esc(when(a.receivedAt)) : L('We match it from the bank statement, usually the same day.', 'ব্যাংক স্টেটমেন্ট দেখে মেলানো হয়, সাধারণত একই দিনে।'))}
      ${step(a.movedInAt || st === 'released' ? 'done' : st === 'held' ? 'now' : st === 'disputed' ? 'bad' : '', st === 'disputed' ? L('Problem reported — money frozen', 'সমস্যা জানানো হয়েছে — টাকা আটকে আছে') : L('Renter moves in', 'ভাড়াটিয়া বাসায় ওঠেন'), st === 'disputed' ? esc(a.disputeReason || '') : a.movedInAt ? esc(when(a.movedInAt)) : a.autoReleaseAt ? L('If no problem is reported, it is released automatically on {t}.', 'কোনো সমস্যা না জানালে {t}-এ নিজে থেকেই ছাড়া হবে।', { t: esc(when(a.autoReleaseAt)) }) : '')}
      ${step(st === 'released' || st === 'refunded' ? 'done' : a.releaseDue || st === 'disputed' ? 'now' : '', st === 'refunded' ? L('Refunded to the renter', 'ভাড়াটিয়াকে ফেরত') : L('Paid to the landlord', 'বাড়িওয়ালাকে দেওয়া'), st === 'released' || st === 'refunded' ? esc(when(a.closedAt)) : po ? (po.approvedBy ? '' : L('Prepared by one founder, waiting for the other to approve (two-person rule).', 'একজন প্রতিষ্ঠাতা প্রস্তুত করেছেন, অন্যজনের অনুমোদনের অপেক্ষা (দুই-ব্যক্তির নিয়ম)।')) : a.releaseDue ? L('Our two founders approve every payout.', 'প্রতিটি পেমেন্ট আমাদের দুই প্রতিষ্ঠাতা অনুমোদন করেন।') : '')}
      </div></div>`;
    if (iAmRenter && st === 'awaiting_payment') {
      h += `<div class="section"><h2>${L('Send this bank transfer', 'এই ব্যাংক ট্রান্সফার পাঠান')}</h2>
        <table class="amount-table"><tr><td>${L('Advance', 'অগ্রিম')}</td><td>${money(a.advance)}</td></tr><tr><td>${L('Basha Bari fee', 'বাসাবাড়ি ফি')}${S().settings.pilotMode ? ` <span class="badge ok">${L('Pilot: free', 'পাইলট: ফ্রি')}</span>` : ` <span class="tiny muted">(${num(S().settings.feePct)}%)</span>`}</td><td>${money(a.fee)}</td></tr><tr class="total"><td>${L('Send exactly', 'ঠিক এই পরিমাণ পাঠান')}</td><td>${money(total)}</td></tr></table>
        <div class="panel tight" style="margin-top:12px"><div class="kv small"><dt>${L('Bank', 'ব্যাংক')}</dt><dd>${esc(es.bank)}</dd><dt>${L('Branch', 'শাখা')}</dt><dd>${esc(es.branch)}</dd><dt>${L('Account name', 'অ্যাকাউন্টের নাম')}</dt><dd>${esc(es.name)}</dd><dt>${L('Account number', 'অ্যাকাউন্ট নম্বর')}</dt><dd class="mono">${esc(es.number)}</dd><dt>${L('Routing number', 'রাউটিং নম্বর')}</dt><dd class="mono">${esc(es.routing)}</dd></div>
        <div style="margin-top:12px" class="center"><div class="tiny muted">${L('Write this reference on the transfer', 'ট্রান্সফারে এই রেফারেন্সটি লিখুন')}</div><div class="big-ref">${esc(a.reference)}</div><button class="btn plain sm" data-a="copy" data-v="${esc(a.reference)}">${I('copy', 15)} ${L('Copy', 'কপি')}</button></div></div>
        <div class="note" style="margin-top:12px">${I('info', 18)}<div class="small">${L('Use your bank app: BEFTN is free, NPSB is instant and costs up to ৳10. Only have bKash or Nagad? Use "Send to bank" in your wallet (NPSB); your wallet\'s own charge applies.', 'আপনার ব্যাংক অ্যাপ ব্যবহার করুন: BEFTN ফ্রি, NPSB সাথে সাথে যায় আর সর্বোচ্চ ৳১০। শুধু বিকাশ বা নগদ আছে? ওয়ালেটের "ব্যাংকে পাঠান" (NPSB) ব্যবহার করুন; ওয়ালেটের নিজের চার্জ প্রযোজ্য।')}</div></div>
        <div class="note warn" style="margin-top:8px">${I('alert', 18)}<div class="small">${L('Send only to this escrow account. Never to a personal bKash or bank account, even if someone asks.', 'শুধু এই এসক্রো অ্যাকাউন্টেই পাঠান। কেউ বললেও কখনো ব্যক্তিগত বিকাশ বা ব্যাংক অ্যাকাউন্টে নয়।')}</div></div>
        ${a.renterSentAt ? `<div class="note ok" style="margin-top:12px">${I('clock', 18)}<div class="small">${L('Thanks. We will confirm as soon as the transfer shows on the bank statement.', 'ধন্যবাদ। ব্যাংক স্টেটমেন্টে ট্রান্সফারটি দেখা গেলেই আমরা নিশ্চিত করব।')}</div></div>` : `<button class="btn block" style="margin-top:12px" data-a="sent" data-id="${a.id}">${L("I've sent the transfer", 'আমি ট্রান্সফার পাঠিয়েছি')}</button>`}</div>`;
    }
    if (iAmRenter && st === 'held') {
      h += `<div class="section"><h2>${L('Moving in?', 'বাসায় উঠছেন?')}</h2><p class="small muted">${L('When you have the keys, save the move-in check. Then our two founders release the advance to the landlord.', 'চাবি হাতে পেলে বাসায় ওঠার চেকলিস্ট সংরক্ষণ করুন। তারপর আমাদের দুই প্রতিষ্ঠাতা অগ্রিম বাড়িওয়ালাকে দেবেন।')}</p>
        ${a.movedInAt ? `<div class="note ok">${I('check', 18)}<div class="small">${L('Move-in check saved. Waiting for the payout approval.', 'চেকলিস্ট সংরক্ষিত। পেমেন্ট অনুমোদনের অপেক্ষা।')}</div></div>` : `<button class="btn block" data-a="nav" data-to="deal/${d.id}">${I('key', 18)} ${L("I've moved in — do the move-in check", 'আমি উঠেছি — চেকলিস্ট পূরণ করুন')}</button>`}
        <button class="btn danger ghost block" style="margin-top:10px" data-a="problem" data-id="${a.id}">${I('alert', 18)} ${L('Report a problem', 'সমস্যা জানান')}</button></div>`;
    }
    if (!iAmRenter) {
      const acct = BB.approvedPayoutAccount(u.id), pend = BB.pendingPayoutAccount(u.id);
      h += `<div class="section"><h2>${L('Your payout', 'আপনার পেমেন্ট')}</h2><table class="amount-table"><tr><td>${L('Advance', 'অগ্রিম')}</td><td>${money(a.advance)}</td></tr></table>
        ${acct ? `<div class="note ok" style="margin-top:8px">${I('bank', 18)}<div class="small">${L('Paid to {b} ••••{n} ({name}).', '{b} ••••{n} ({name})-এ দেওয়া হবে।', { b: esc(acct.bank), n: esc(dig(acct.last4)), name: esc(acct.accountName) })}</div></div>`
        : pend ? `<div class="note">${I('clock', 18)}<div class="small">${L('Your bank account is being checked.', 'আপনার ব্যাংক অ্যাকাউন্ট যাচাই চলছে।')}</div></div>`
        : `<div class="note warn">${I('alert', 18)}<div class="small">${L('Add a payout bank account in your own name to receive the advance.', 'অগ্রিম পেতে নিজের নামে ব্যাংক অ্যাকাউন্ট যোগ করুন।')}</div></div><button class="btn block" style="margin-top:10px" data-a="payout-sheet">${L('Add bank account', 'ব্যাংক অ্যাকাউন্ট যোগ করুন')}</button>`}
        <p class="small muted" style="margin-top:10px">${L('The money is held at the bank, not by Basha Bari. It is paid to you after the renter moves in, or automatically 72 hours after the move-in date if no problem is reported.', 'টাকা ব্যাংকে জমা থাকে, বাসাবাড়ির কাছে নয়। ভাড়াটিয়া ওঠার পর, অথবা কোনো সমস্যা না জানালে ওঠার তারিখের ৭২ ঘণ্টা পর নিজে থেকেই আপনি পাবেন।')}</p></div>`;
    }
    if (st === 'released') h += `<div class="section"><div class="note ok">${I('check', 18)}<div>${iAmRenter ? L('Done. The landlord has been paid. Welcome to your new home!', 'সম্পন্ন। বাড়িওয়ালা টাকা পেয়েছেন। নতুন বাসায় স্বাগতম!') : L('Done. The advance is in your bank account.', 'সম্পন্ন। অগ্রিম আপনার ব্যাংক অ্যাকাউন্টে পৌঁছেছে।')}</div></div></div>`;
    if (st === 'refunded') h += `<div class="section"><div class="note">${I('info', 18)}<div>${L('The advance and our fee were refunded to the renter\'s account.', 'অগ্রিম আর আমাদের ফি ভাড়াটিয়ার অ্যাকাউন্টে ফেরত দেওয়া হয়েছে।')}</div></div></div>`;
    return h;
  }

  // ───────────── My homes (landlords) ─────────────
  function scrHomes() {
    const u = me();
    if (!u) return top(L('My homes', 'আমার বাসা'), { back: false }) + `<div class="pad">${gateBox(L('List your home for free', 'বিনামূল্যে বাসার বিজ্ঞাপন দিন'), L('Verified renters only. Your number stays private until you both agree.', 'শুধু যাচাই করা ভাড়াটিয়া। দুজনে রাজি না হওয়া পর্যন্ত আপনার নম্বর গোপন থাকে।'), L('Sign up free', 'বিনামূল্যে সাইন আপ'), 'gate-signup')}</div>`;
    const mine = S().listings.filter(l => l.listerId === u.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const invites = S().scoutSubs.filter(s => s.status === 'invited' && s.landlordPhone === u.phone);
    let h = top(L('My homes', 'আমার বাসা'), { back: false, right: bell() });
    for (const s of invites) h += `<div class="pad" style="padding-bottom:0"><div class="note">${I('compass', 18)}<div class="grow small"><b>${L('A scout prepared a listing for your home', 'একজন স্কাউট আপনার বাসার বিজ্ঞাপন তৈরি করেছেন')}</b><br><button class="btn sm" style="margin-top:6px" data-a="nav" data-to="invite/${s.id}">${L('Check and confirm', 'দেখে নিশ্চিত করুন')}</button></div></div></div>`;
    h += `<div class="pad"><button class="btn block" data-a="post-start">${I('plus', 18)} ${L('List a home', 'বাসার বিজ্ঞাপন দিন')}</button>${u.level < 2 ? `<p class="hint">${L('You need a verified ID to list. It takes about 3 minutes.', 'বিজ্ঞাপন দিতে যাচাই করা আইডি লাগবে। প্রায় ৩ মিনিট লাগে।')}</p>` : ''}</div>`;
    if (mine.length) {
      h += `<div class="section"><h2>${L('Your listings', 'আপনার বিজ্ঞাপন')}</h2><div class="stack">`;
      for (const l of mine) {
        const enquiries = S().conversations.filter(c => c.listingId === l.id).length;
        const saves = S().favourites.filter(f => f.listingId === l.id).length;
        h += `<div class="panel tight"><div class="row" data-a="nav" data-to="listing/${l.id}" style="cursor:pointer"><img class="thumb" src="${photoSrc(l, l.photos[0])}" alt=""><div class="grow"><b class="ellipsis" style="display:block">${esc(BB.title(l, lang()))}</b><div class="small">${money(l.rent)} · <span class="badge ${l.status === 'active' ? 'ok' : l.status === 'in_review' ? 'info' : l.status === 'rejected' ? 'danger' : ''}">${esc(lab('listingStatus', l.status))}</span></div></div></div>
          <div class="row small muted" style="margin-top:8px;gap:14px"><span>${I('eye', 14)} ${num(l.views || 0)}</span><span>${I('chat', 14)} ${num(enquiries)}</span><span>${I('heart', 14)} ${num(saves)}</span></div>
          ${l.status === 'rejected' ? `<div class="note danger small" style="margin-top:8px">${I('alert', 16)}<div>${esc(l.rejectReason || '')}</div></div>` : ''}
          ${l.status === 'in_review' ? `<div class="note small" style="margin-top:8px">${I('clock', 16)}<div>${L('Our team checks the photos and ownership papers, usually within 2 hours.', 'আমাদের টিম ছবি আর মালিকানার কাগজ যাচাই করছে, সাধারণত ২ ঘণ্টার মধ্যে।')}</div></div>` : ''}
          <div class="row wrap" style="margin-top:8px">${l.status === 'active' ? `<button class="btn plain sm" data-a="lstatus" data-id="${l.id}" data-s="paused">${L('Pause', 'বিরতি')}</button><button class="btn plain sm" data-a="lstatus" data-id="${l.id}" data-s="let_agreed">${L('Mark as let', 'ভাড়া হয়েছে')}</button>` : ''}${l.status === 'paused' ? `<button class="btn soft sm" data-a="lstatus" data-id="${l.id}" data-s="active">${L('Resume', 'আবার চালু')}</button>` : ''}${l.status === 'let_agreed' ? `<button class="btn soft sm" data-a="lstatus" data-id="${l.id}" data-s="active">${L('Relist', 'আবার বিজ্ঞাপন')}</button>` : ''}</div></div>`;
      }
      h += `</div></div>`;
    }
    const acct = BB.approvedPayoutAccount(u.id), pend = BB.pendingPayoutAccount(u.id);
    const rej = S().payoutAccounts.filter(p => p.userId === u.id && p.status === 'rejected').slice(-1)[0];
    h += `<div class="section"><h2>${L('Payout bank account', 'পেমেন্টের ব্যাংক অ্যাকাউন্ট')}</h2><p class="small muted">${L('Protected advances are paid here after the renter moves in. It must be in your own name, matching your NID.', 'ভাড়াটিয়া ওঠার পর সুরক্ষিত অগ্রিম এখানে পাঠানো হয়। অ্যাকাউন্টটি আপনার নিজের নামে, এনআইডির নামের সাথে মিলিয়ে হতে হবে।')}</p>
      ${acct ? `<div class="panel tight row">${I('bank', 22)}<div class="grow"><b>${esc(acct.bank)} ••••${esc(dig(acct.last4))}</b><div class="small muted">${esc(acct.accountName)} · <span class="badge ok">${L('Approved', 'অনুমোদিত')}</span>${acct.usableFrom && new Date(acct.usableFrom) > new Date() ? ' · ' + L('usable from {t}', '{t} থেকে ব্যবহারযোগ্য', { t: esc(when(acct.usableFrom)) }) : ''}</div></div><button class="btn plain sm" data-a="payout-sheet">${L('Change', 'বদলান')}</button></div>`
      : pend ? `<div class="panel tight row">${I('bank', 22)}<div class="grow"><b>${esc(pend.bank)} ••••${esc(dig(pend.last4))}</b><div class="small muted"><span class="badge info">${L('Being checked', 'যাচাই চলছে')}</span></div></div></div>`
      : `${rej ? `<div class="note danger small" style="margin-bottom:8px">${I('alert', 16)}<div>${esc(rej.rejectReason)}</div></div>` : ''}<button class="btn plain block" data-a="payout-sheet">${I('plus', 16)} ${L('Add bank account', 'ব্যাংক অ্যাকাউন্ট যোগ করুন')}</button>`}</div>`;
    h += `<div class="section"><h2>${L('When renters can reach you', 'কখন যোগাযোগ করা যাবে')}</h2><div class="row between"><div><b>${L('Busy today', 'আজ ব্যস্ত')}</b><div class="small muted">${L('Renters see that you will reply later.', 'ভাড়াটিয়ারা দেখবেন আপনি পরে উত্তর দেবেন।')}</div></div><label class="check"><input type="checkbox" id="busy" data-in="busy" ${u.busyToday ? 'checked' : ''}></label></div>
      <div class="row between" style="margin-top:12px"><div><b>${L('Contact hours', 'যোগাযোগের সময়')}</b><div class="small muted">${esc(hoursText(u.callHours))}</div></div><button class="btn plain sm" data-a="hours-sheet">${L('Edit', 'সম্পাদনা')}</button></div></div>`;
    return h;
  }

  // ───────────── Post a home (6 steps), also used by scouts ─────────────
  function newDraft(mode) {
    const avail = ymd(Date.now() + 7 * BB.DAY);
    return { mode, step: 1, d: { kind: 'flat', role: 'owner', relation: '', areaId: null, areaQ: '', address: '', exact: null, beds: 2, baths: 2, balconies: 1, size: '', floor: '', floors: '', furnishing: 0, lift: false,
      rent: '', service: '', serviceCovers: '', advanceMonths: 1, waterBill: 'in_service', gasBill: 'tenant', electricity: 'prepaid', gas: 'pipeline', accepts: [], availableFrom: avail, amenities: [], description: '',
      shots: {}, proofKinds: [], proofDone: {}, occupantOk: false, landlordPhone: '', locationOk: false } };
  }
  function draftKey() { const u = me(); return 'bb.demo.draft.' + (u ? u.id : 'x'); }
  function saveDraft() { try { BB.local.setItem(draftKey(), JSON.stringify(ui.wizard)); } catch (e) { /* ignore */ } }
  const STEP_TITLES = mode => mode === 'scout'
    ? [L('Where is the home?', 'বাসাটি কোথায়?'), L('Rooms', 'রুম'), L('Rent and bills', 'ভাড়া ও বিল'), L('Who and when', 'কারা ও কবে'), L('Photos', 'ছবি'), L('Send to the landlord', 'বাড়িওয়ালাকে পাঠান')]
    : [L('The home and you', 'বাসা ও আপনি'), L('Where is it?', 'কোথায়?'), L('Rooms', 'রুম'), L('Rent and bills', 'ভাড়া ও বিল'), L('Who and when', 'কারা ও কবে'), L('Photos and proof', 'ছবি ও প্রমাণ')];
  function scrPost(mode) {
    const u = me();
    mode = mode || 'owner';
    const label = mode === 'scout' ? L('New scout capture', 'নতুন স্কাউট ক্যাপচার') : L('List a home', 'বাসার বিজ্ঞাপন');
    if (!u) return top(label) + `<div class="pad">${gateBox(L('Sign up first', 'আগে সাইন আপ করুন'), '', L('Sign up', 'সাইন আপ'), 'gate-signup')}</div>`;
    if (u.level < 2) return top(label) + `<div class="pad">${gateBox(L('Verify your ID first', 'আগে আইডি যাচাই করুন'), L('Everyone who lists a home is ID-checked. It keeps renters safe and builds trust in your listing.', 'যিনিই বাসার বিজ্ঞাপন দেন, তাঁর আইডি যাচাই করা হয়। এতে ভাড়াটিয়া নিরাপদ থাকেন আর আপনার বিজ্ঞাপনে আস্থা বাড়ে।'), L('Verify my ID', 'আইডি যাচাই করুন'), 'go-verify')}</div>`;
    if (!ui.wizard || ui.wizard.mode !== mode) ui.wizard = readJSON(draftKey()) && readJSON(draftKey()).mode === mode ? readJSON(draftKey()) : newDraft(mode);
    const w = ui.wizard, d = w.d;
    const titles = STEP_TITLES(mode);
    let h = top(label, { right: `<span class="small muted">${num(w.step)}/${num(6)}</span>`, below: `<div class="steps" style="padding:10px 0 0">${titles.map((_, i) => `<span class="${i < w.step ? 'on' : ''}"></span>`).join('')}</div>` });
    h += `<div class="pad"><h2 style="font-size:19px;margin-bottom:4px">${esc(titles[w.step - 1])}</h2><p class="tiny muted" style="margin-bottom:14px">${L('Draft saved automatically.', 'খসড়া নিজে থেকেই সংরক্ষিত হয়।')}</p>`;
    const kindChips = ['flat', 'house', 'studio', 'sublet', 'mess_seat'].map(k => `<button class="chip ${d.kind === k ? 'on' : ''}" data-a="w-set" data-k="kind" data-v="${k}">${esc(lab('kind', k))}</button>`).join('');
    const stepId = mode === 'scout' ? ['where', 'rooms', 'costs', 'who', 'photos', 'send'][w.step - 1] : ['type', 'where', 'rooms', 'costs', 'who', 'photos'][w.step - 1];
    if (stepId === 'type') {
      h += `<div class="stack"><div><div class="field"><span>${L('Type of home', 'বাসার ধরন')}</span></div><div class="chips wrap">${kindChips}</div></div>
        <div><div class="field"><span>${L('You are the…', 'আপনি…')}</span></div><div class="chips wrap">${['owner', 'family', 'caretaker', 'agent'].map(r => `<button class="chip ${d.role === r ? 'on' : ''}" data-a="w-set" data-k="role" data-v="${r}">${esc(lab('role', r))}</button>`).join('')}</div></div>
        ${d.role !== 'owner' ? `<label class="field"><span>${L('Your relationship to the owner', 'মালিকের সাথে আপনার সম্পর্ক')}</span><input class="input" id="w-relation" data-in="w" data-k="relation" value="${esc(d.relation)}" placeholder="${esc(L("e.g. owner's son, caretaker for 5 years", 'যেমন: মালিকের ছেলে, ৫ বছর ধরে কেয়ারটেকার'))}"></label><div class="note">${I('info', 18)}<div class="small">${L("You will also upload the owner's signed permission letter and the owner's NID.", 'মালিকের সই করা অনুমতিপত্র আর মালিকের এনআইডিও আপলোড করতে হবে।')}</div></div>` : ''}</div>`;
    }
    if (stepId === 'where') {
      const a = d.areaId && BB.area(d.areaId);
      const sug = d.areaQ && !a ? BB.searchAreas(d.areaQ).slice(0, 6) : [];
      h += `<div class="stack">${mode === 'scout' ? `<div><div class="field"><span>${L('Type of home', 'বাসার ধরন')}</span></div><div class="chips wrap">${kindChips}</div></div>
        <label class="check"><input type="checkbox" id="w-loc" data-in="wbool" data-k="locationOk" ${d.locationOk ? 'checked' : ''}><span class="small">${L('Allow location while capturing. We use it only to confirm you are at the home; it is never shown to anyone.', 'ক্যাপচারের সময় লোকেশন চালু রাখুন। শুধু আপনি বাসায় আছেন কিনা নিশ্চিত করতে ব্যবহার করি; কাউকে দেখানো হয় না।')}</span></label>` : ''}
        <label class="field"><span>${L('Area', 'এলাকা')}</span><input class="input" id="w-area" data-in="w-area" autocomplete="off" value="${esc(a ? areaName(a) : d.areaQ)}" placeholder="${esc(L('Start typing, e.g. Mirpur 10', 'লিখতে শুরু করুন, যেমন মিরপুর ১০'))}"></label>
        ${sug.length ? `<div class="list panel" style="padding:0">${sug.map(x => `<button data-a="w-area-pick" data-id="${x.id}">${I('pin', 16)} ${esc(areaName(x))} <span class="tiny muted">${esc(areaName(BB.area(x.parent)))}</span></button>`).join('')}</div>` : ''}
        ${a ? `<div class="row"><span class="badge ok">${I('check', 12)} ${esc(areaName(a))}</span><button class="link small" data-a="w-area-clear">${L('Change', 'বদলান')}</button></div>` : ''}
        <label class="field"><span>${L('Full address (private)', 'পূর্ণ ঠিকানা (গোপন)')}</span><input class="input" id="w-address" data-in="w" data-k="address" value="${esc(d.address)}" placeholder="${esc(L('House, road, block', 'বাড়ি, রোড, ব্লক'))}"></label>
        <div><div class="field"><span>${L('Drop the pin on the building', 'ভবনের উপর পিন দিন')}</span></div><div class="minimap" id="wizmap" style="height:220px"></div><p class="hint">${I('lock', 13)} ${L('Only you and a renter who agrees with you see the exact pin. The public map shows a circle.', 'সঠিক পিন শুধু আপনি আর রাজি হওয়া ভাড়াটিয়া দেখবেন। সাধারণ ম্যাপে একটি বৃত্ত দেখায়।')}</p>${d.exact ? `<span class="badge ok">${I('pin', 12)} ${L('Pin set', 'পিন দেওয়া হয়েছে')}</span>` : ''}</div></div>`;
    }
    if (stepId === 'rooms') {
      const stepper = (k, label, min, max) => `<div class="row between"><span>${esc(label)}</span><div class="stepper"><button data-a="w-step" data-k="${k}" data-d="-1" data-min="${min}" data-max="${max}">−</button><b>${num(d[k])}</b><button data-a="w-step" data-k="${k}" data-d="1" data-min="${min}" data-max="${max}">+</button></div></div>`;
      h += `<div class="stack">${d.kind === 'mess_seat' ? '' : stepper('beds', d.kind === 'sublet' ? L('Rooms', 'রুম') : L('Bedrooms', 'বেডরুম'), d.kind === 'studio' ? 1 : 1, 10)}${stepper('baths', L('Bathrooms', 'বাথরুম'), 1, 8)}${stepper('balconies', L('Balconies', 'বারান্দা'), 0, 6)}
        <div class="row"><label class="field grow"><span>${L('Size (sq ft)', 'আয়তন (বর্গফুট)')}</span><input class="input" id="w-size" inputmode="numeric" data-in="w" data-k="size" value="${esc(d.size)}"></label><label class="field grow"><span>${L('Floor', 'তলা')}</span><input class="input" id="w-floor" inputmode="numeric" data-in="w" data-k="floor" value="${esc(d.floor)}" placeholder="0 = ${esc(L('ground', 'নিচতলা'))}"></label><label class="field grow"><span>${L('Floors in building', 'ভবনের তলা')}</span><input class="input" id="w-floors" inputmode="numeric" data-in="w" data-k="floors" value="${esc(d.floors)}"></label></div>
        <div><div class="field"><span>${L('Furnishing', 'ফার্নিচার')}</span></div><div class="seg">${[0, 1, 2].map(x => `<button class="${+d.furnishing === x ? 'on' : ''}" data-a="w-set" data-k="furnishing" data-v="${x}">${esc(lab('furnishing', x))}</button>`).join('')}</div></div></div>`;
    }
    if (stepId === 'costs') {
      const billSel = (k, opts) => `<select class="input" id="w-${k}" data-in="w" data-k="${k}">${opts.map(o => `<option value="${o}" ${d[k] === o ? 'selected' : ''}>${esc(k === 'electricity' ? lab('electricity', o) : k === 'gas' ? lab('gas', o) : lab('bill', o))}</option>`).join('')}</select>`;
      h += `<div class="stack"><div class="row"><label class="field grow"><span>${L('Rent per month (৳)', 'মাসিক ভাড়া (৳)')}</span><input class="input" id="w-rent" inputmode="numeric" data-in="w" data-k="rent" value="${esc(d.rent)}" placeholder="18000"></label><label class="field grow"><span>${L('Service charge (৳)', 'সার্ভিস চার্জ (৳)')}</span><input class="input" id="w-service" inputmode="numeric" data-in="w" data-k="service" value="${esc(d.service)}" placeholder="0"></label></div>
        <label class="field"><span>${L('Service charge covers', 'সার্ভিস চার্জে যা আছে')}</span><input class="input" id="w-covers" data-in="w" data-k="serviceCovers" value="${esc(d.serviceCovers)}" placeholder="${esc(L('Guard, lift, generator, cleaning', 'গার্ড, লিফট, জেনারেটর, পরিষ্কার'))}"></label>
        <div class="row between"><span>${L('Advance (months)', 'অগ্রিম (মাস)')}</span><div class="stepper"><button data-a="w-step" data-k="advanceMonths" data-d="-1" data-min="0" data-max="6">−</button><b>${num(d.advanceMonths)}</b><button data-a="w-step" data-k="advanceMonths" data-d="1" data-min="0" data-max="6">+</button></div></div>
        ${d.advanceMonths > 1 ? `<div class="note warn">${I('alert', 18)}<div class="small">${L('Taking more than one month in advance needs the Rent Controller\'s permission (Premises Rent Control Act 1991). Renters will see this note.', 'এক মাসের বেশি অগ্রিম নিতে ভাড়া নিয়ন্ত্রকের অনুমতি লাগে (বাড়ি ভাড়া নিয়ন্ত্রণ আইন ১৯৯১)। ভাড়াটিয়ারা এই নোট দেখবেন।')}</div></div>` : ''}
        <label class="field"><span>${L('Gas', 'গ্যাস')}</span>${billSel('gas', ['pipeline', 'cylinder', 'none'])}</label>
        <label class="field"><span>${L('Water bill', 'পানির বিল')}</span>${billSel('waterBill', ['tenant', 'in_rent', 'in_service'])}</label>
        <label class="field"><span>${L('Gas bill', 'গ্যাস বিল')}</span>${billSel('gasBill', ['tenant', 'in_rent', 'in_service'])}</label>
        <label class="field"><span>${L('Electricity', 'বিদ্যুৎ')}</span>${billSel('electricity', ['prepaid', 'postpaid', 'in_rent'])}</label></div>`;
    }
    if (stepId === 'who') {
      h += `<div class="stack"><div><div class="field"><span>${L('Who can rent?', 'কারা ভাড়া নিতে পারবেন?')}</span></div><div class="chips wrap">${Object.keys(BB.LABELS.accepts).map(a => `<button class="chip ${d.accepts.includes(a) ? 'on' : ''}" data-a="w-toggle" data-k="accepts" data-v="${a}">${esc(lab('accepts', a))}</button>`).join('')}</div><p class="hint">${L('Never by religion, ethnicity or caste.', 'ধর্ম, জাতি বা বর্ণ দিয়ে কখনো নয়।')}</p></div>
        <label class="field"><span>${L('Available from', 'কবে থেকে ওঠা যাবে')}</span><input class="input" type="date" id="w-avail" data-in="w" data-k="availableFrom" value="${esc(d.availableFrom)}"></label>
        <div><div class="field"><span>${L('Features', 'সুবিধাসমূহ')}</span></div><div class="chips wrap">${Object.keys(BB.LABELS.amenity).map(a => `<button class="chip ${d.amenities.includes(a) ? 'on' : ''}" data-a="w-toggle" data-k="amenities" data-v="${a}">${esc(lab('amenity', a))}</button>`).join('')}</div></div>
        <label class="field"><span>${L('Description (optional)', 'বিবরণ (ঐচ্ছিক)')}</span><textarea class="input" id="w-desc" maxlength="3000" data-in="w" data-k="description" placeholder="${esc(L('What is nearby, what makes it good…', 'কাছে কী আছে, বাসাটি কেন ভালো…'))}">${esc(d.description)}</textarea></label></div>`;
    }
    if (stepId === 'photos') {
      const rooms = BB.roomsFor(d.kind, +d.beds, +d.baths, +d.balconies);
      const count = {};
      const slots = rooms.map(r => { count[r] = (count[r] || 0) + 1; return { key: r + count[r], room: r, n: count[r], optional: r === 'balcony' }; });
      const need = slots.filter(s => !s.optional && !d.shots[s.key]).length;
      h += `<p class="small muted">${L('Take a photo of every room with the in-app camera. Photos taken in the app get a badge, and GPS data is removed before anyone sees them.', 'অ্যাপের ক্যামেরা দিয়ে প্রতিটি রুমের ছবি তুলুন। অ্যাপে তোলা ছবিতে ব্যাজ থাকে, আর সবাই দেখার আগে জিপিএস তথ্য মুছে ফেলা হয়।')}</p>
        <div class="photo-grid">${slots.map((s, i) => `<button class="photo-slot ${d.shots[s.key] ? 'done' : ''}" data-a="w-shot" data-k="${s.key}" data-r="${s.room}">${d.shots[s.key] ? `<img src="${ART.room(s.room, d.shots[s.key], 0)}" alt="">` : I('camera', 22)}<span class="${d.shots[s.key] ? 'lbl' : ''}">${esc(lab('room', s.room))}${s.room === 'bedroom' || s.room === 'bath' ? ' ' + num(s.n) : ''}${s.optional ? ' · ' + L('optional', 'ঐচ্ছিক') : ''}</span></button>`).join('')}</div>
        <button class="btn plain sm" style="margin-top:10px" data-a="w-shots-all">${I('camera', 16)} ${L('Take all photos (demo)', 'সব ছবি তুলুন (ডেমো)')}</button>
        ${need ? `<p class="hint">${L('{n} photos still needed.', 'আরও {n}টি ছবি লাগবে।', { n: need })}</p>` : ''}`;
      if (mode === 'scout') {
        h += `<label class="check" style="margin-top:14px"><input type="checkbox" id="w-occ" data-in="wbool" data-k="occupantOk" ${d.occupantOk ? 'checked' : ''}><span class="small">${L('The landlord agreed, and if someone still lives there, they agreed too. No people, faces, family photos or papers are in any photo.', 'বাড়িওয়ালা রাজি হয়েছেন, আর কেউ এখনও থাকলে তিনিও রাজি। কোনো ছবিতে মানুষ, মুখ, পারিবারিক ছবি বা কাগজ নেই।')}</span></label>`;
      } else {
        const kinds = d.role === 'owner' ? ['holding_tax', 'utility_bill', 'deed'] : ['owner_permission', 'owner_nid'];
        h += `<h3 style="margin-top:18px">${L('Proof you can rent it out', 'ভাড়া দেওয়ার অধিকারের প্রমাণ')}</h3><p class="small muted">${d.role === 'owner' ? L('Any one of these, in the owner\'s name. Stored encrypted; only our verification team sees it.', 'মালিকের নামে এগুলোর যেকোনো একটি। এনক্রিপ্ট করে রাখা হয়; শুধু আমাদের যাচাই টিম দেখে।') : L('Both of these are needed when you are not the owner.', 'আপনি মালিক না হলে দুটোই লাগবে।')}</p>
          <div class="stack">${kinds.map(k => `<div class="panel tight row"><img src="${ART.paper({ kind: k, name: nm(u) })}" style="width:44px;height:56px;border-radius:4px;border:1px solid var(--line)" alt=""><div class="grow"><b class="small">${esc(lab('docKind', k))}</b><div class="tiny muted">${d.proofDone[k] ? L('Uploaded (sample)', 'আপলোড হয়েছে (নমুনা)') : L('Not uploaded', 'আপলোড হয়নি')}</div></div><button class="btn ${d.proofDone[k] ? 'plain' : 'soft'} sm" data-a="w-proof" data-k="${k}">${d.proofDone[k] ? I('check', 15) : I('upload', 15)} ${d.proofDone[k] ? L('Done', 'হয়েছে') : L('Upload', 'আপলোড')}</button></div>`).join('')}</div>
          <div class="panel tight" style="margin-top:14px"><div class="tiny muted">${L('Title (made from your answers)', 'শিরোনাম (আপনার উত্তর থেকে তৈরি)')}</div>${d.areaId ? `<b>${esc(BB.makeTitles(d.kind, d.beds, d.areaId, d.accepts).bn)}</b><br><b>${esc(BB.makeTitles(d.kind, d.beds, d.areaId, d.accepts).en)}</b>` : '—'}</div>`;
      }
    }
    if (stepId === 'send') {
      h += `<div class="stack"><div class="panel tight"><div class="tiny muted">${L('Title', 'শিরোনাম')}</div>${d.areaId ? `<b>${esc(BB.makeTitles(d.kind, d.beds, d.areaId, d.accepts)[bn() ? 'bn' : 'en'])}</b>` : '—'}<div class="small muted">${d.rent ? money(+d.rent) : ''} · ${num(Object.keys(d.shots).length)} ${L('photos', 'ছবি')}</div></div>
        <label class="field"><span>${L("Landlord's mobile number", 'বাড়িওয়ালার মোবাইল নম্বর')}</span><input class="input" id="w-ll" type="tel" inputmode="tel" data-in="w" data-k="landlordPhone" value="${esc(d.landlordPhone)}" placeholder="01XXXXXXXXX"></label>
        <div class="note">${I('info', 18)}<div class="small">${L('The landlord gets an SMS link. The listing goes live only after they confirm with an OTP on their own phone and verify their ID and ownership papers. If they don\'t confirm within 7 days, the draft and their number are deleted.', 'বাড়িওয়ালা একটি এসএমএস লিংক পাবেন। তিনি নিজের ফোনে ওটিপি দিয়ে নিশ্চিত করে আইডি ও মালিকানার কাগজ যাচাই করলেই বিজ্ঞাপন চালু হবে। ৭ দিনের মধ্যে নিশ্চিত না করলে খসড়া আর নম্বর মুছে যায়।')}</div></div>
        <p class="tiny muted">${L('Demo: try 01811000206 (Fatema, a landlord in the demo) to see the invite arrive in her account.', 'ডেমো: 01811000206 (ফাতেমা, ডেমোর একজন বাড়িওয়ালা) লিখে দেখুন, তাঁর অ্যাকাউন্টে আমন্ত্রণ যাবে।')}</p></div>`;
    }
    const last = w.step === 6;
    h += `</div><div class="stickybar">${w.step > 1 ? `<button class="btn plain" data-a="w-back">${L('Back', 'পেছনে')}</button>` : `<button class="btn plain" data-a="w-cancel">${L('Cancel', 'বাতিল')}</button>`}<button class="btn" data-a="${last ? 'w-submit' : 'w-next'}">${last ? (mode === 'scout' ? L('Send to the landlord', 'বাড়িওয়ালাকে পাঠান') : L('Submit for review', 'যাচাইয়ের জন্য জমা দিন')) : L('Next', 'পরের ধাপ')}</button></div>`;
    return h;
  }
  function validateStep(w) {
    const d = w.d;
    const stepId = w.mode === 'scout' ? ['where', 'rooms', 'costs', 'who', 'photos', 'send'][w.step - 1] : ['type', 'where', 'rooms', 'costs', 'who', 'photos'][w.step - 1];
    const E = (en, b) => { throw BB.err(en, b); };
    if (stepId === 'type' && d.role !== 'owner' && !d.relation.trim()) E('Say how you are related to the owner.', 'মালিকের সাথে আপনার সম্পর্ক লিখুন।');
    if (stepId === 'where') {
      if (w.mode === 'scout' && !d.locationOk) E('Allow location while capturing.', 'ক্যাপচারের সময় লোকেশন চালু করুন।');
      if (!d.areaId) E('Choose the area from the list.', 'তালিকা থেকে এলাকা বেছে নিন।');
      if (d.address.trim().length < 6) E('Write the full address.', 'পূর্ণ ঠিকানা লিখুন।');
      if (!d.exact) { const a = BB.area(d.areaId); d.exact = { lat: a.lat, lng: a.lng }; }
    }
    if (stepId === 'costs' && !(+F.toAscii(d.rent) >= 500)) E('Enter the monthly rent (at least ৳500).', 'মাসিক ভাড়া লিখুন (অন্তত ৳৫০০)।');
    if (stepId === 'who' && !d.accepts.length) E('Choose who can rent.', 'কারা ভাড়া নিতে পারবেন বেছে নিন।');
    if (stepId === 'photos') {
      const rooms = BB.roomsFor(d.kind, +d.beds, +d.baths, +d.balconies);
      const count = {};
      const missing = rooms.filter(r => { count[r] = (count[r] || 0) + 1; return r !== 'balcony' && !d.shots[r + count[r]]; });
      if (missing.length) E('Take the remaining room photos.', 'বাকি রুমগুলোর ছবি তুলুন।');
      if (w.mode === 'scout' && !d.occupantOk) E('Confirm that the landlord and anyone living there agreed.', 'বাড়িওয়ালা ও বাসিন্দারা রাজি হয়েছেন তা নিশ্চিত করুন।');
      if (w.mode !== 'scout') {
        const kinds = d.role === 'owner' ? ['holding_tax', 'utility_bill', 'deed'] : ['owner_permission', 'owner_nid'];
        const done = kinds.filter(k => d.proofDone[k]);
        if (d.role === 'owner' ? !done.length : done.length < 2) E('Upload the proof documents.', 'প্রমাণের কাগজ আপলোড করুন।');
      }
    }
  }
  function draftForStore(d) {
    const n = x => (x === '' || x == null ? null : +F.toAscii(x));
    const kinds = d.role === 'owner' ? ['holding_tax', 'utility_bill', 'deed'] : ['owner_permission', 'owner_nid'];
    const amen = d.amenities.slice();
    return {
      kind: d.kind, role: d.role, relation: d.relation, areaId: d.areaId, address: d.address + ', Dhaka', exact: d.exact, beds: d.kind === 'mess_seat' ? 1 : d.beds, baths: d.baths, balconies: d.balconies,
      size: n(d.size), floor: n(d.floor), floors: n(d.floors), furnishing: +d.furnishing, rent: n(d.rent), service: n(d.service) || 0, serviceCovers: d.serviceCovers, advanceMonths: d.advanceMonths,
      gas: d.gas, waterBill: d.waterBill, gasBill: d.gasBill, electricity: d.electricity, accepts: d.accepts, amenities: amen, availableFrom: d.availableFrom, description: d.description,
      proofKinds: kinds.filter(k => d.proofDone[k]).length ? kinds.filter(k => d.proofDone[k]) : kinds.slice(0, d.role === 'owner' ? 1 : 2), occupantOk: d.occupantOk,
    };
  }

  // ───────────── Scouts ─────────────
  function scrScout() {
    const u = me();
    const sc = u && BB.scoutOf(u.id);
    if (!sc) return top(L('Scout', 'স্কাউট'), { back: false }) + `<div class="empty">${L('You are not a scout.', 'আপনি স্কাউট নন।')}</div>`;
    const e = BB.scoutEarnings(u.id);
    const subs = e.subs.slice().sort((a, b) => new Date(b.invitedAt) - new Date(a.invitedAt));
    const todayCount = subs.filter(s => Date.now() - new Date(s.invitedAt) < BB.DAY).length;
    let h = top(L('Scout', 'স্কাউট'), { back: false, right: bell() });
    h += `<div class="section"><div class="keyfacts"><div>${L('Live homes', 'চালু বাসা')}<b>${num(e.live)}</b></div><div>${L('Let bonuses', 'ভাড়ার বোনাস')}<b>${num(e.let)}</b></div><div>${L('To be paid', 'পাওনা')}<b>${money(e.due)}</b></div></div>
      <p class="small muted" style="margin-top:10px">${L('৳150 for each home that goes live with a verified landlord, plus ৳300 if it is let through the app within 60 days. Paid monthly by bank transfer. Paid so far: {p}.', 'যাচাই করা বাড়িওয়ালার প্রতিটি চালু বাসার জন্য ৳১৫০, আর ৬০ দিনের মধ্যে অ্যাপে ভাড়া হলে আরও ৳৩০০। প্রতি মাসে ব্যাংকে দেওয়া হয়। এ পর্যন্ত পেয়েছেন: {p}।', { p: money(e.paid) })}</p>
      <button class="btn block" data-a="scout-start">${I('camera', 18)} ${L('New capture from a To-Let sign', 'টু-লেট সাইন থেকে নতুন ক্যাপচার')}</button><p class="hint center">${L('Today: {n} of {m}', 'আজ: {m}-এর মধ্যে {n}', { n: todayCount, m: sc.dailyLimit })}</p></div>
      <div class="section"><h2>${L('Rules', 'নিয়ম')}</h2><ul class="small" style="margin:0;padding-left:18px"><li>${L('Never take money from landlords or renters.', 'বাড়িওয়ালা বা ভাড়াটিয়ার কাছ থেকে কখনো টাকা নেবেন না।')}</li><li>${L('Only the in-app camera. No people, faces or papers in photos.', 'শুধু অ্যাপের ক্যামেরা। ছবিতে মানুষ, মুখ বা কাগজ নয়।')}</li><li>${L('Visit in daylight and tell your team lead before going in.', 'দিনের আলোয় যান, ঢোকার আগে টিম লিডকে জানান।')}</li><li>${L('Never enter a home where people live unless they agree.', 'বাসিন্দারা রাজি না হলে কখনো বাসায় ঢুকবেন না।')}</li></ul></div>
      <div class="section"><h2>${L('My submissions', 'আমার জমা')}</h2>`;
    if (!subs.length) h += `<p class="small muted">${L('Nothing yet.', 'এখনো কিছু নেই।')}</p>`;
    for (const s of subs) {
      const l = s.listingId && BB.get.listing(s.listingId);
      const label = { invited: L('Waiting for the landlord', 'বাড়িওয়ালার অপেক্ষা'), confirmed: L('In review', 'যাচাই চলছে'), live: L('Live', 'চালু'), rejected: L('Rejected', 'বাতিল'), expired: L('Expired (7 days)', 'মেয়াদ শেষ (৭ দিন)') }[s.status];
      h += `<div class="panel tight row" style="margin-bottom:8px">${l ? `<img class="thumb" src="${photoSrc(l, l.photos[0])}" alt="">` : `<div class="thumb" style="display:grid;place-items:center;background:var(--line-2)">${I('home', 22)}</div>`}<div class="grow"><b class="small">${esc(l ? BB.title(l, lang()) : s.draft ? BB.makeTitles(s.draft.kind, s.draft.beds, s.draft.areaId, s.draft.accepts)[bn() ? 'bn' : 'en'] : '—')}</b><div class="tiny muted">${esc(ago(s.invitedAt))}</div>
        <span class="badge ${s.status === 'live' ? 'ok' : s.status === 'expired' || s.status === 'rejected' ? 'danger' : 'info'}">${esc(label)}</span>${s.earnedLiveAt ? ` <span class="badge ok">+৳${num(150)}</span>` : ''}${s.earnedLetAt ? ` <span class="badge ok">+৳${num(300)}</span>` : ''}
        ${s.status === 'invited' ? `<div style="margin-top:6px"><button class="btn plain sm" data-a="demo-confirm-invite" data-id="${s.id}">${L('Landlord confirms (demo)', 'বাড়িওয়ালা নিশ্চিত (ডেমো)')}</button></div>` : ''}</div></div>`;
    }
    return h + `</div>`;
  }
  function scrInvite(id) {
    const u = me();
    const s = BB.get.sub(id);
    if (!s || s.status !== 'invited') return top(L('Invite', 'আমন্ত্রণ')) + `<div class="empty">${L('This invite is no longer open.', 'এই আমন্ত্রণটি আর খোলা নেই।')}</div>`;
    const d = s.draft;
    const scout = BB.get.user(s.scoutId);
    const t = BB.makeTitles(d.kind, d.beds, d.areaId, d.accepts);
    let h = top(L('Confirm your listing', 'আপনার বিজ্ঞাপন নিশ্চিত করুন'));
    h += `<div class="section"><div class="row"><img class="thumb" src="${ART.room('exterior', 77, 2)}" alt=""><div class="grow"><b>${esc(bn() ? t.bn : t.en)}</b><div class="small muted">${esc(d.address)}</div></div></div>
      <table class="costs" style="margin-top:10px"><tr><td>${L('Rent', 'ভাড়া')}</td><td>${money(d.rent)}</td></tr><tr><td>${L('Service charge', 'সার্ভিস চার্জ')}</td><td>${money(d.service || 0)}</td></tr><tr><td>${L('Advance', 'অগ্রিম')}</td><td>${L('{n} month(s)', '{n} মাস', { n: d.advanceMonths })}</td></tr><tr><td>${L('Who can rent', 'কারা ভাড়া নিতে পারবেন')}</td><td>${esc((d.accepts || []).map(a => lab('accepts', a)).join(', '))}</td></tr></table>
      <p class="small muted" style="margin-top:10px">${L('Prepared by our scout {n}. Scouts never ask for money.', 'আমাদের স্কাউট {n} তৈরি করেছেন। স্কাউটরা কখনো টাকা চান না।', { n: esc(nm(scout)) })}</p></div>`;
    if (!u) h += `<div class="pad">${gateBox(L('Sign in with the number the scout used', 'স্কাউটের দেওয়া নম্বর দিয়ে সাইন ইন করুন'), '', L('Sign in', 'সাইন ইন'), 'gate-signup')}</div>`;
    else if (u.phone !== s.landlordPhone) h += `<div class="pad"><div class="note warn">${I('alert', 18)}<div class="small">${L('This invite was sent to a different number.', 'এই আমন্ত্রণটি অন্য নম্বরে পাঠানো হয়েছিল।')}</div></div></div>`;
    else if (u.level < 2) h += `<div class="pad">${gateBox(L('Verify your ID to confirm', 'নিশ্চিত করতে আইডি যাচাই করুন'), L('Then confirm with an OTP. Ownership papers are checked before it goes live.', 'তারপর ওটিপি দিয়ে নিশ্চিত করুন। চালুর আগে মালিকানার কাগজ যাচাই হবে।'), L('Verify my ID', 'আইডি যাচাই করুন'), 'go-verify')}</div>`;
    else h += `<div class="stickybar"><button class="btn" data-a="invite-confirm" data-id="${s.id}">${L('Confirm with OTP', 'ওটিপি দিয়ে নিশ্চিত করুন')}</button></div>`;
    return h;
  }

  // ───────────── Account, profile, verification ─────────────
  function scrAccount() {
    const u = me();
    let h = top(L('Account', 'অ্যাকাউন্ট'), { back: false, right: langBtn() });
    if (!u) {
      h += `<div class="pad">${gateBox(L('Sign up or log in', 'সাইন আপ বা লগ ইন'), L('Free with your mobile number.', 'মোবাইল নম্বর দিয়ে বিনামূল্যে।'), L('Continue with phone', 'ফোন দিয়ে চালিয়ে যান'), 'gate-signup')}</div>`;
    } else {
      const k = BB.latestIdCheck(u.id);
      h += `<div class="section"><div class="lister"><img src="${ART.avatar(u.avatar)}" alt=""><div class="grow"><b style="font-size:17px">${esc(nm(u))}</b><div class="small muted">${esc(F.phone(u.phone, lang()))}</div>
        <div class="row wrap" style="gap:6px;margin-top:4px">${u.level >= 2 ? `<span class="badge ok">${I('shield', 12)} ${L('ID verified', 'আইডি যাচাই হয়েছে')}</span>` : k && k.status === 'pending' ? `<span class="badge info">${I('clock', 12)} ${L('ID being checked', 'আইডি যাচাই চলছে')}</span>` : `<span class="badge warn">${L('Phone only', 'শুধু ফোন')}</span>`}${BB.scoutOf(u.id) ? `<span class="badge">${I('compass', 12)} ${L('Scout', 'স্কাউট')}</span>` : ''}</div></div><button class="btn plain sm" data-a="nav" data-to="profile">${L('Edit', 'সম্পাদনা')}</button></div>
        ${u.status === 'suspended' ? `<div class="note danger" style="margin-top:10px">${I('ban', 18)}<div class="small">${L('Your account is suspended after a report. You can browse but not contact anyone. Contact support to appeal.', 'একটি অভিযোগের পর আপনার অ্যাকাউন্ট স্থগিত। খুঁজতে পারবেন, কিন্তু যোগাযোগ করতে পারবেন না। আপিল করতে সাপোর্টে যোগাযোগ করুন।')}</div></div>` : ''}
        ${u.level < 2 ? `<div class="note" style="margin-top:12px">${I('shield', 18)}<div class="grow small"><b>${L('Verify your ID to message landlords, book viewings and list a home.', 'বাড়িওয়ালাকে বার্তা, বাসা দেখার সময় আর বিজ্ঞাপন দিতে আইডি যাচাই করুন।')}</b><br><button class="btn sm" style="margin-top:6px" data-a="nav" data-to="verify">${k && k.status === 'pending' ? L('See status', 'অবস্থা দেখুন') : L('Verify now', 'এখনই যাচাই করুন')}</button></div></div>` : ''}</div>`;
      const recs = S().records.filter(r => { const c = BB.get.conv(r.convId); return c && (c.renterId === u.id || c.landlordId === u.id); });
      const deals = S().deals.filter(d => { const c = BB.get.conv(d.convId); return d.status === 'confirmed' && c && (c.renterId === u.id || c.landlordId === u.id); });
      h += `<div class="list" style="border-top:8px solid var(--line-2)">
        <button data-a="nav" data-to="notifications">${I('bell', 20, 'lead')}<span class="grow">${L('Notifications', 'নোটিফিকেশন')}</span>${BB.unreadNotifications(u.id) ? `<span class="badge danger">${num(BB.unreadNotifications(u.id))}</span>` : ''}</button>
        ${recs.map(r => `<button data-a="nav" data-to="record/${r.id}">${I('qr', 20, 'lead')}<span class="grow">${L('Contact record', 'যোগাযোগের রেকর্ড')} · <span class="small muted">${esc(day(r.createdAt))}</span></span>${I('next', 18)}</button>`).join('')}
        ${deals.map(d => `<button data-a="nav" data-to="deal/${d.id}">${I('receipt', 20, 'lead')}<span class="grow">${L('Deal', 'চুক্তি')} · <span class="small muted">${money(d.rent)} · ${esc(day(d.moveIn))}</span></span>${I('next', 18)}</button>`).join('')}
        ${BB.scoutOf(u.id) ? `<button data-a="nav" data-to="homes">${I('home', 20, 'lead')}<span class="grow">${L('My homes', 'আমার বাসা')}</span>${I('next', 18)}</button>` : ''}
      </div>`;
    }
    h += `<div class="list" style="border-top:8px solid var(--line-2)">
      <button data-a="nav" data-to="page/safety">${I('shield', 20, 'lead')}<span class="grow">${L('Safety tips', 'নিরাপত্তা টিপস')}</span>${I('next', 18)}</button>
      <button data-a="nav" data-to="page/help">${I('info', 20, 'lead')}<span class="grow">${L('Help', 'সাহায্য')}</span>${I('next', 18)}</button>
      <button data-a="nav" data-to="page/terms">${I('file', 20, 'lead')}<span class="grow">${L('Terms of use', 'ব্যবহারের শর্ত')}</span>${I('next', 18)}</button>
      <button data-a="nav" data-to="page/privacy">${I('lock', 20, 'lead')}<span class="grow">${L('Privacy policy', 'গোপনীয়তা নীতি')}</span>${I('next', 18)}</button>
      ${u ? `<button data-a="logout">${I('logout', 20, 'lead')}<span class="grow">${L('Log out', 'লগ আউট')}</span></button><button data-a="delete-account" style="color:var(--danger)">${I('trash', 20)}<span class="grow">${L('Delete account', 'অ্যাকাউন্ট মুছুন')}</span></button>` : ''}
    </div><p class="center tiny muted" style="padding:16px">Basha Bari demo · ${L('made-up data only', 'শুধু বানানো তথ্য')}</p>`;
    return h;
  }
  function scrProfile() {
    const u = me();
    if (!u) return scrAccount();
    let h = top(L('Your profile', 'আপনার প্রোফাইল'));
    h += `<div class="pad stack"><label class="field"><span>${L('Display name', 'নাম')}</span><input class="input" id="p-name" value="${esc(nm(u))}"></label>
      <div><div class="field"><span>${L('Who is moving in?', 'কারা উঠবেন?')}</span></div><div class="chips wrap">${Object.keys(BB.LABELS.accepts).map(a => `<button class="chip ${u.household.includes(a) ? 'on' : ''}" data-a="p-house" data-v="${a}">${esc(lab('accepts', a))}</button>`).join('')}</div></div>
      <div class="row"><label class="field grow"><span>${L('Number of people', 'কতজন')}</span><input class="input" id="p-size" inputmode="numeric" value="${esc(u.householdSize || '')}"></label><label class="field grow"><span>${L('Occupation', 'পেশা')}</span><input class="input" id="p-job" value="${esc(u.occupation || '')}"></label></div>
      <p class="hint">${L('Landlords see this only after you both share details.', 'দুজনে তথ্য শেয়ার করার পরেই বাড়িওয়ালা এটি দেখবেন।')}</p>
      <button class="btn block" data-a="p-save">${L('Save', 'সংরক্ষণ')}</button></div>`;
    return h;
  }
  function scrVerify() {
    const u = me();
    if (!u) return top(L('Verify your ID', 'আইডি যাচাই')) + `<div class="pad">${gateBox(L('Sign up first', 'আগে সাইন আপ করুন'), '', L('Sign up', 'সাইন আপ'), 'gate-signup')}</div>`;
    const k = BB.latestIdCheck(u.id);
    let h = top(L('Verify your ID', 'আইডি যাচাই'));
    if (u.level >= 2) return h + `<div class="pad"><div class="panel center">${I('shield', 46)}<h2 style="margin:10px 0 4px;color:var(--ok)">${L('Your ID is verified', 'আপনার আইডি যাচাই হয়েছে')}</h2><p class="small muted">${L('Verified {d}. You can message landlords, book viewings and list homes.', '{d} যাচাই হয়েছে। এখন বার্তা, বাসা দেখা আর বিজ্ঞাপন — সব করতে পারবেন।', { d: esc(day(u.verifiedAt)) })}</p><button class="btn" data-a="nav" data-to="search">${L('Find a home', 'বাসা খুঁজুন')}</button></div></div>`;
    if (k && k.status === 'pending' && !ui.verify) return h + `<div class="pad"><div class="panel center">${I('clock', 46)}<h2 style="margin:10px 0 4px">${L('Being checked', 'যাচাই চলছে')}</h2><p class="small muted">${L('A person on our team checks every ID, usually within 2 hours between 9am and 11pm. We will send you a notification.', 'আমাদের টিমের একজন প্রতিটি আইডি দেখেন, সাধারণত সকাল ৯টা থেকে রাত ১১টার মধ্যে ২ ঘণ্টার ভেতরে। আমরা নোটিফিকেশন পাঠাব।')}</p>
      <div class="kv small" style="text-align:left;margin-top:10px"><dt>${L('Document', 'নথি')}</dt><dd>${esc(lab('docType', k.docType))} ••••${esc(dig(k.docLast4))}</dd><dt>${L('Submitted', 'জমা')}</dt><dd>${esc(ago(k.createdAt))}</dd><dt>${L('Liveness', 'লাইভনেস')}</dt><dd>${L('Passed', 'সফল')}</dd></div>
      ${S().settings.autoApprove ? `<p class="tiny muted" style="margin-top:10px">${L('Demo: auto-approve is on, so this is approved in a few seconds.', 'ডেমো: অটো-অনুমোদন চালু, তাই কয়েক সেকেন্ডে অনুমোদন হবে।')}</p>` : `<p class="tiny muted" style="margin-top:10px">${L('Demo: open the admin website to approve it, or turn on auto-approve in the demo menu.', 'ডেমো: অনুমোদন দিতে অ্যাডমিন ওয়েবসাইট খুলুন, অথবা ডেমো মেনুতে অটো-অনুমোদন চালু করুন।')}</p>`}</div></div>`;
    const v = ui.verify || (ui.verify = { step: k && k.status === 'rejected' ? 'retry' : 'intro', docType: 'smart_nid', front: false, back: false, name: u.legalName || u.name_en, number: '', dob: '', selfie: 0 });
    const steps = ['intro', 'doc', 'front', 'back', 'details', 'selfie'];
    const idx = Math.max(0, steps.indexOf(v.step));
    h = top(L('Verify your ID', 'আইডি যাচাই'), { below: `<div class="steps" style="padding:10px 0 0">${steps.map((_, i) => `<span class="${i <= idx ? 'on' : ''}"></span>`).join('')}</div>` });
    h += `<div class="pad">`;
    if (v.step === 'retry') {
      h += `<div class="note danger">${I('alert', 18)}<div class="small"><b>${L('We could not verify your last try', 'আগের চেষ্টাটি যাচাই করা যায়নি')}</b><br>${esc(k.rejectReason)}</div></div><p class="small muted" style="margin-top:10px">${L('Your old photos stay in our encrypted vault as an earlier version. Nothing is overwritten.', 'আপনার পুরনো ছবিগুলো আমাদের এনক্রিপ্টেড ভল্টে আগের সংস্করণ হিসেবে থাকে। কিছুই মুছে ফেলা হয় না।')}</p><button class="btn block" data-a="v-go" data-s="intro">${L('Try again', 'আবার চেষ্টা করুন')}</button>`;
    }
    if (v.step === 'intro') {
      h += `<h2 style="font-size:19px">${L('Why we check IDs', 'কেন আইডি যাচাই করি')}</h2><div class="feature">${I('shield', 22)}<div class="small">${L('Every landlord and renter is a real, adult person. Scams stop when everyone is known.', 'প্রত্যেক বাড়িওয়ালা ও ভাড়াটিয়া আসল, প্রাপ্তবয়স্ক মানুষ। সবাই পরিচিত হলে প্রতারণা বন্ধ হয়।')}</div></div>
        <div class="feature">${I('lock', 22)}<div class="small">${L('Your NID photos and selfie are stored encrypted in our ID vault. Only our verification team can open them, and every view is logged.', 'আপনার এনআইডির ছবি আর সেলফি আমাদের আইডি ভল্টে এনক্রিপ্ট করে রাখা হয়। শুধু যাচাই টিম খুলতে পারে, আর প্রতিবার দেখার রেকর্ড থাকে।')}</div></div>
        <div class="feature">${I('clock', 22)}<div class="small">${L('We keep them while your account is open and for 6 years after you delete it, then they are destroyed.', 'অ্যাকাউন্ট চালু থাকা পর্যন্ত আর মুছে ফেলার পর ৬ বছর রাখি, তারপর ধ্বংস করা হয়।')}</div></div>
        <div class="feature">${I('eye', 22)}<div class="small">${L('Other users never see your NID. They see only "ID checked" and, after you both agree, the last 4 digits.', 'অন্য ব্যবহারকারীরা কখনো আপনার এনআইডি দেখেন না। তাঁরা শুধু "আইডি যাচাই" আর দুজনে রাজি হলে শেষ ৪টি সংখ্যা দেখেন।')}</div></div>
        <label class="check" style="margin:14px 0"><input type="checkbox" id="v-consent" ${v.consent ? 'checked' : ''} data-in="v-consent"><span class="small">${L('I agree that Basha Bari may use my ID document and selfie to verify who I am, as described above.', 'উপরের বর্ণনা অনুযায়ী আমার পরিচয় যাচাইয়ের জন্য বাসাবাড়ি আমার আইডি আর সেলফি ব্যবহার করতে পারবে — আমি রাজি।')}</span></label>
        <button class="btn block" data-a="v-go" data-s="doc" ${v.consent ? '' : 'disabled'}>${L('Continue', 'চালিয়ে যান')}</button>`;
    }
    if (v.step === 'doc') {
      h += `<h2 style="font-size:19px;margin-bottom:10px">${L('Choose your document', 'আপনার নথি বেছে নিন')}</h2><div class="stack">${['smart_nid', 'nid', 'passport', 'driving_licence'].map(t => `<button class="panel tight row" style="cursor:pointer;text-align:left;${v.docType === t ? 'border-color:var(--brand);box-shadow:0 0 0 2px var(--brand-50)' : ''}" data-a="v-doc" data-t="${t}">${I(t === 'passport' ? 'globe' : 'file', 22)}<span class="grow"><b>${esc(lab('docType', t))}</b></span>${v.docType === t ? I('check', 18) : ''}</button>`).join('')}</div>
        <button class="btn block" style="margin-top:14px" data-a="v-go" data-s="front">${L('Continue', 'চালিয়ে যান')}</button>`;
    }
    if (v.step === 'front' || v.step === 'back') {
      const side = v.step;
      const done = v[side];
      const sample = ART.idCard({ docType: v.docType, side, name: v.name || u.name_en, dob: v.dob || '1995-01-01', number: v.number || (v.docType === 'passport' ? 'A01234567' : '1234567890'), avatar: u.avatar });
      h += `<h2 style="font-size:19px">${side === 'front' ? (v.docType === 'passport' ? L('Photo page of your passport', 'পাসপোর্টের ছবির পাতা') : L('Front of your card', 'কার্ডের সামনের দিক')) : L('Back of your card', 'কার্ডের পেছনের দিক')}</h2>
        <p class="small muted">${L('Place it inside the frame, in good light, with no glare.', 'ভালো আলোয়, ঝলক ছাড়া, ফ্রেমের ভেতরে রাখুন।')}</p>
        <div class="capture"><div class="idframe">${done ? `<img src="${sample}" alt="">` : L('Camera preview', 'ক্যামেরা প্রিভিউ')}</div>
        <p class="tiny" style="color:#9fb0bb;margin:10px 0">${L('Demo: no camera, no real document. A sample card stamped DEMO is used.', 'ডেমো: ক্যামেরা নেই, আসল নথিও নেই। "DEMO" লেখা নমুনা কার্ড ব্যবহার হয়।')}</p>
        <button class="btn ${done ? 'plain' : ''}" data-a="v-capture" data-s="${side}">${I('camera', 18)} ${done ? L('Retake', 'আবার তুলুন') : L('Take photo (demo picture)', 'ছবি তুলুন (ডেমো ছবি)')}</button></div>
        <button class="btn block" style="margin-top:14px" data-a="v-go" data-s="${side === 'front' && v.docType !== 'passport' ? 'back' : 'details'}" ${done ? '' : 'disabled'}>${L('Continue', 'চালিয়ে যান')}</button>`;
    }
    if (v.step === 'details') {
      h += `<h2 style="font-size:19px;margin-bottom:10px">${L('Details on your document', 'নথিতে যা লেখা আছে')}</h2><div class="stack">
        <label class="field"><span>${L('Full name as written', 'নথিতে লেখা পুরো নাম')}</span><input class="input" id="v-name" data-in="v" data-k="name" value="${esc(v.name)}"></label>
        <label class="field"><span>${v.docType === 'passport' ? L('Passport number', 'পাসপোর্ট নম্বর') : v.docType === 'driving_licence' ? L('Licence number', 'লাইসেন্স নম্বর') : L('NID number (10, 13 or 17 digits)', 'এনআইডি নম্বর (১০, ১৩ বা ১৭ সংখ্যা)')}</span><input class="input" id="v-number" inputmode="${v.docType === 'nid' || v.docType === 'smart_nid' ? 'numeric' : 'text'}" data-in="v" data-k="number" value="${esc(v.number)}" placeholder="${v.docType === 'passport' ? 'A01234567' : '1234567890'}"></label>
        <label class="field"><span>${L('Date of birth', 'জন্ম তারিখ')}</span><input class="input" type="date" id="v-dob" data-in="v" data-k="dob" value="${esc(v.dob)}"></label>
        <p class="hint">${L('You must be 18 or older. We check your age from the document, not from what you type.', 'বয়স ১৮ বা তার বেশি হতে হবে। আপনি যা লেখেন তা নয়, নথি থেকে বয়স যাচাই করি।')}</p></div>
        <button class="btn block" style="margin-top:14px" data-a="v-details">${L('Continue', 'চালিয়ে যান')}</button>`;
    }
    if (v.step === 'selfie') {
      const cues = [L('Look at the camera', 'ক্যামেরার দিকে তাকান'), L('Blink twice', 'দুবার চোখ পিটপিট করুন'), L('Turn your head left', 'মাথা বাঁ দিকে ঘোরান'), L('Done!', 'হয়েছে!')];
      h += `<h2 style="font-size:19px">${L('Live selfie', 'লাইভ সেলফি')}</h2><p class="small muted">${L('A quick check that it is really you, on your phone. Your face data never leaves the check.', 'এটি সত্যিই আপনি কিনা — ফোনেই দ্রুত যাচাই।')}</p>
        <div class="capture"><div class="liveness ${v.selfie === 1 ? 'blink' : v.selfie === 2 ? 'turn' : ''}"><img src="${ART.selfie(u.avatar, v.selfie >= 3 ? 'done' : 'live')}" alt=""><div class="cue">${esc(cues[Math.min(v.selfie, 3)])}</div></div>
        <p class="tiny" style="color:#9fb0bb;margin:10px 0">${L('Demo: the face is drawn; the camera is not used.', 'ডেমো: মুখটি আঁকা; ক্যামেরা ব্যবহার হয় না।')}</p>
        ${v.selfie >= 3 ? `<span class="badge ok">${I('check', 12)} ${L('Liveness passed', 'লাইভনেস সফল')}</span>` : `<button class="btn" data-a="v-selfie">${I('camera', 18)} ${v.selfie ? L('Next step', 'পরের ধাপ') : L('Start', 'শুরু')}</button>`}</div>
        <button class="btn block" style="margin-top:14px" data-a="v-submit" ${v.selfie >= 3 ? '' : 'disabled'}>${L('Submit for checking', 'যাচাইয়ের জন্য জমা দিন')}</button>`;
    }
    return h + `</div>`;
  }

  // ───────────── Notifications, pages ─────────────
  function scrNotifications() {
    const u = me();
    if (!u) return top(L('Notifications', 'নোটিফিকেশন')) + `<div class="pad">${gateBox(L('Sign up to get alerts', 'নোটিফিকেশন পেতে সাইন আপ করুন'), '', L('Sign up free', 'বিনামূল্যে সাইন আপ'), 'gate-signup')}</div>`;
    const list = BB.notificationsOf(u.id);
    setTimeout(() => { let ch = false; for (const n of S().notifications) if (n.userId === u.id && !n.read) { n.read = true; ch = true; } if (ch) BB.commit(); }, 1200);
    let h = top(L('Notifications', 'নোটিফিকেশন'));
    if (!list.length) return h + `<div class="empty">${I('bell', 40)}<p>${L('Nothing yet.', 'এখনো কিছু নেই।')}</p></div>`;
    return h + `<div class="list">${list.map(n => `<button data-a="${n.link ? 'nav' : 'noop'}" data-to="${esc(n.link || '')}">${n.read ? I('bell', 20, 'lead') : '<span class="unread"></span>'}<div class="grow"><div class="small" style="${n.read ? '' : 'font-weight:700'}">${esc(bn() ? n.bn : n.en)}</div><div class="tiny muted">${esc(ago(n.at))}</div></div>${n.link ? I('next', 18) : ''}</button>`).join('')}</div>`;
  }
  function scrPage(name) {
    const pages = {
      safety: [L('Safety tips', 'নিরাপত্তা টিপস'), [
        L('Never pay any advance before you have seen the home and signed.', 'বাসা না দেখে আর সই না করে কোনো অগ্রিম দেবেন না।'),
        L('Use the protected advance. It is held at the bank until you move in.', 'সুরক্ষিত অগ্রিম ব্যবহার করুন। বাসায় ওঠা পর্যন্ত টাকা ব্যাংকে থাকে।'),
        L('Basha Bari never asks you to send money to a personal bKash, Nagad or bank account.', 'বাসাবাড়ি কখনো ব্যক্তিগত বিকাশ, নগদ বা ব্যাংক অ্যাকাউন্টে টাকা পাঠাতে বলে না।'),
        L('Keep talking in the app until you both share details. Phone numbers are hidden for your safety.', 'দুজনে তথ্য শেয়ার না করা পর্যন্ত অ্যাপেই কথা বলুন। নিরাপত্তার জন্য ফোন নম্বর লুকানো থাকে।'),
        L('Go to viewings in daylight and tell a friend where you are going.', 'দিনের আলোয় বাসা দেখতে যান, আর কোথায় যাচ্ছেন একজন বন্ধুকে জানান।'),
        L('Check the contact record: the name and NID digits must match the person you meet.', 'যোগাযোগের রেকর্ড মিলিয়ে নিন: যাঁর সাথে দেখা করছেন, তাঁর নাম আর এনআইডির সংখ্যা মিলতে হবে।'),
        L('Something wrong? Tap the flag in the chat to report it. We review every report within 24 hours.', 'কিছু ভুল মনে হলে চ্যাটে পতাকা চিহ্নে চেপে জানান। প্রতিটি অভিযোগ ২৪ ঘণ্টার মধ্যে দেখি।'),
      ]],
      help: [L('Help', 'সাহায্য'), [
        L('Search is open to everyone. Sign up with your phone to see full details.', 'খোঁজা সবার জন্য খোলা। পুরো তথ্য দেখতে ফোন দিয়ে সাইন আপ করুন।'),
        L('Verify your ID (NID, smart NID, passport or driving licence, plus a selfie) to message, book viewings and list.', 'বার্তা, বাসা দেখা আর বিজ্ঞাপনের জন্য আইডি (এনআইডি, স্মার্ট এনআইডি, পাসপোর্ট বা ড্রাইভিং লাইসেন্স, সাথে সেলফি) যাচাই করুন।'),
        L('After a viewing time is agreed, both tap "Share my details" to get the same contact record.', 'দেখার সময় ঠিক হলে দুজনেই "আমার তথ্য শেয়ার করুন" চাপলে একই যোগাযোগের রেকর্ড পাবেন।'),
        L('Confirm the deal with an OTP, then pay the advance by bank transfer into the escrow account.', 'ওটিপি দিয়ে চুক্তি নিশ্চিত করুন, তারপর ব্যাংক ট্রান্সফারে এসক্রো অ্যাকাউন্টে অগ্রিম দিন।'),
        L('Support (demo): help@bashabari.example · 9am–11pm.', 'সাপোর্ট (ডেমো): help@bashabari.example · সকাল ৯টা–রাত ১১টা।'),
      ]],
      terms: [L('Terms of use (summary)', 'ব্যবহারের শর্ত (সংক্ষেপ)'), [
        L('Basha Bari introduces renters and landlords. We are not a party to any tenancy.', 'বাসাবাড়ি ভাড়াটিয়া ও বাড়িওয়ালার পরিচয় করিয়ে দেয়। আমরা কোনো ভাড়া চুক্তির পক্ষ নই।'),
        L('We never hold money in our own account. Protected advances are held in an escrow account at a bank under published rules.', 'আমরা কখনো নিজের অ্যাকাউন্টে টাকা রাখি না। সুরক্ষিত অগ্রিম প্রকাশিত নিয়মে ব্যাংকের এসক্রো অ্যাকাউন্টে থাকে।'),
        L('Searching, listing and messaging are free. A clear fee is shown before any protected advance.', 'খোঁজা, বিজ্ঞাপন দেওয়া আর বার্তা পাঠানো ফ্রি। সুরক্ষিত অগ্রিমের আগে পরিষ্কারভাবে ফি দেখানো হয়।'),
        L('No discrimination by religion, ethnicity or caste. Agents must say they are agents.', 'ধর্ম, জাতি বা বর্ণের ভিত্তিতে বৈষম্য নিষেধ। এজেন্টদের জানাতে হবে যে তাঁরা এজেন্ট।'),
        L('Demo text. The real terms will be written by a Bangladeshi lawyer in Bangla and English.', 'ডেমো লেখা। আসল শর্ত বাংলাদেশি আইনজীবী বাংলা ও ইংরেজিতে লিখবেন।'),
      ]],
      privacy: [L('Privacy policy (summary)', 'গোপনীয়তা নীতি (সংক্ষেপ)'), [
        L('We collect your phone and name at sign-up; your ID and a selfie when you verify; and your address and pin when you list.', 'সাইন আপে ফোন আর নাম; যাচাইয়ে আইডি আর সেলফি; বিজ্ঞাপনে ঠিকানা আর পিন নিই।'),
        L('ID documents are encrypted in our ID vault, kept while your account is open and for 6 years after deletion.', 'আইডির কাগজ এনক্রিপ্ট করে আইডি ভল্টে থাকে — অ্যাকাউন্ট চালু থাকা পর্যন্ত আর মুছে ফেলার পর ৬ বছর।'),
        L('Phone numbers and addresses are shared only when both sides agree. We never sell your data.', 'দুই পক্ষ রাজি হলেই কেবল ফোন নম্বর আর ঠিকানা শেয়ার হয়। আমরা কখনো আপনার তথ্য বিক্রি করি না।'),
        L('Delete your account any time. It is deleted 28 days later; log in before then to cancel.', 'যেকোনো সময় অ্যাকাউন্ট মুছতে পারেন। ২৮ দিন পর মুছে যায়; এর আগে লগ ইন করলে বাতিল হয়।'),
        L('Where it is stored: our server, with an encrypted backup in Cloudflare R2 (demo wording; the lawyer confirms the final text).', 'কোথায় রাখা হয়: আমাদের সার্ভারে, আর এনক্রিপ্ট করা ব্যাকআপ Cloudflare R2-তে (ডেমো লেখা; আইনজীবী চূড়ান্ত করবেন)।'),
      ]],
    };
    const p = pages[name] || pages.help;
    return top(p[0]) + `<div class="pad stack">${p[1].map(t => `<div class="feature">${I('check', 20)}<div>${esc(t)}</div></div>`).join('')}</div>`;
  }

  // ───────────── Sheets ─────────────
  function renderSheet() {
    const s = ui.sheet;
    if (ui.viewer) { $sheet.innerHTML = viewerHTML(); const tr = $sheet.querySelector('.track'); if (tr) tr.scrollLeft = tr.clientWidth * ui.viewer.i; return; }
    if (!s) { $sheet.innerHTML = ''; return; }
    const focus = captureFocus();
    const fn = SHEETS[s.type];
    $sheet.innerHTML = fn ? `<div class="backdrop" data-a="close"></div>${fn(s)}` : '';
    restoreFocus(focus);
  }
  function sheet(title, body, foot, full) {
    return `<div class="sheet ${full ? 'full' : ''}" role="dialog">${full ? '' : '<div class="grabber"></div>'}<div class="sheet-head"><h2>${esc(title)}</h2><button class="icon-btn" data-a="close" aria-label="Close">${I('x', 20)}</button></div><div class="sheet-body">${body}</div>${foot ? `<div class="sheet-foot">${foot}</div>` : ''}</div>`;
  }
  function viewerHTML() {
    const l = BB.get.listing(ui.viewer.id);
    return `<div class="viewer"><div class="bar"><span>${esc(BB.title(l, lang()))}</span><button class="icon-btn" data-a="viewer-close">${I('x', 22)}</button></div><div class="track">${l.photos.map(p => `<img src="${photoSrc(l, p)}" alt="">`).join('')}</div><div class="bar small">${L('Swipe to see more · photos taken in the app', 'আরও দেখতে সোয়াইপ করুন · অ্যাপে তোলা ছবি')}</div></div>`;
  }
  const SHEETS = {
    auth(s) {
      if (s.step === 'phone') return sheet(L('Sign up or log in', 'সাইন আপ বা লগ ইন'), `${s.reason ? `<div class="note" style="margin-bottom:12px">${I('lock', 18)}<div class="small">${esc(s.reason)}</div></div>` : ''}
        <label class="field"><span>${L('Mobile number', 'মোবাইল নম্বর')}</span><div class="row"><span class="input" style="width:76px;flex:none;display:grid;place-items:center">+880</span><input class="input" id="auth-phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="1XXXXXXXXX" value="${esc(s.phone || '')}" data-in="auth-phone"></div></label>
        <p class="hint">${L("We'll text you a 6-digit code. No password needed.", 'আমরা ৬ সংখ্যার কোড পাঠাব। পাসওয়ার্ড লাগবে না।')}</p>${s.error ? `<div class="error-text">${esc(s.error)}</div>` : ''}
        <div class="note" style="margin-top:14px">${I('info', 18)}<div class="tiny">${L('Demo: type any new number such as 01700000555 to create an account, or 01711000101 to log in as Tanvir (a verified renter).', 'ডেমো: নতুন অ্যাকাউন্ট খুলতে 01700000555-এর মতো যেকোনো নতুন নম্বর লিখুন, অথবা তানভীর (যাচাই করা ভাড়াটিয়া) হিসেবে ঢুকতে 01711000101।')}</div></div>`,
        `<button class="btn" data-a="auth-send">${L('Send code', 'কোড পাঠান')}</button>`);
      if (s.step === 'code') return sheet(L('Enter the code', 'কোডটি লিখুন'), `<p class="small">${L('We sent a 6-digit code to {p}.', '{p} নম্বরে ৬ সংখ্যার কোড পাঠানো হয়েছে।', { p: esc(F.phone(s.phone, lang())) })}</p>
        <input class="input otp" id="auth-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••" value="${esc(s.typed || '')}" data-in="auth-code">${s.error ? `<div class="error-text">${esc(s.error)}</div>` : ''}
        <div class="row between" style="margin-top:10px"><button class="link small" data-a="auth-fill">${L('Demo: fill the code', 'ডেমো: কোড বসিয়ে দিন')}</button><button class="link small" data-a="auth-resend">${L('Send again', 'আবার পাঠান')}</button></div>
        <p class="hint">${L('The code works for 5 minutes and 5 tries.', 'কোডটি ৫ মিনিট আর ৫ বার চেষ্টার জন্য কাজ করে।')}</p><button class="link small" data-a="auth-back">${L('Change number', 'নম্বর বদলান')}</button>`,
        `<button class="btn" data-a="auth-verify">${L('Continue', 'চালিয়ে যান')}</button>`);
      return sheet(L('Create your account', 'অ্যাকাউন্ট খুলুন'), `<label class="field"><span>${L('Your name', 'আপনার নাম')}</span><input class="input" id="auth-name" value="${esc(s.name || '')}" data-in="auth-name" autocomplete="name"></label>
        <div style="margin-top:12px"><div class="field"><span>${L('Language', 'ভাষা')}</span></div><div class="seg"><button class="${bn() ? 'on' : ''}" data-a="setlang" data-l="bn">বাংলা</button><button class="${!bn() ? 'on' : ''}" data-a="setlang" data-l="en">English</button></div></div>
        <label class="check" style="margin-top:14px"><input type="checkbox" id="auth-terms" ${s.terms ? 'checked' : ''} data-in="auth-terms"><span class="small">${L('I agree to the terms of use and the privacy policy.', 'আমি ব্যবহারের শর্ত ও গোপনীয়তা নীতিতে রাজি।')}</span></label>${s.error ? `<div class="error-text">${esc(s.error)}</div>` : ''}`,
        `<button class="btn" data-a="auth-create">${L('Create account', 'অ্যাকাউন্ট খুলুন')}</button>`);
    },
    otp(s) {
      return sheet(s.title, `<p class="small">${L('To confirm, enter the code we sent to {p}.', 'নিশ্চিত করতে {p} নম্বরে পাঠানো কোডটি লিখুন।', { p: esc(F.phone(me().phone, lang())) })}</p><input class="input otp" id="otp-code" inputmode="numeric" maxlength="6" placeholder="••••••" value="${esc(s.typed || '')}" data-in="otp-code">${s.error ? `<div class="error-text">${esc(s.error)}</div>` : ''}
        <div class="row between" style="margin-top:10px"><button class="link small" data-a="otp-fill">${L('Demo: fill the code', 'ডেমো: কোড বসিয়ে দিন')}</button></div>${s.note ? `<div class="note" style="margin-top:12px">${I('info', 18)}<div class="small">${s.note}</div></div>` : ''}`,
        `<button class="btn" data-a="otp-ok">${L('Confirm', 'নিশ্চিত করুন')}</button>`);
    },
    filters() {
      const f = ui.f;
      const count = BB.search(f).length;
      const chip = (k, v, label) => `<button class="chip ${(f[k] || []).includes(v) ? 'on' : ''}" data-a="ftoggle" data-k="${k}" data-v="${v}">${esc(label)}</button>`;
      const numIn = (k, ph) => `<input class="input" id="f-${k}" inputmode="numeric" placeholder="${esc(ph)}" value="${f[k] == null ? '' : f[k]}" data-in="fnum" data-k="${k}">`;
      const radio = (k, v, label) => `<button class="chip ${f[k] === v ? 'on' : ''}" data-a="fset" data-k="${k}" data-v="${v}">${esc(label)}</button>`;
      const body = `<div class="stack">
        <div><div class="field"><span>${L('Total monthly cost (rent + service charge)', 'মাসে মোট খরচ (ভাড়া + সার্ভিস চার্জ)')}</span></div><div class="row">${numIn('minTotal', L('Min ৳', 'সর্বনিম্ন ৳'))}${numIn('maxTotal', L('Max ৳', 'সর্বোচ্চ ৳'))}</div><div class="chips" style="margin-top:6px">${[10000, 15000, 20000, 30000, 50000].map(x => `<button class="chip ${f.maxTotal === x ? 'on' : ''}" data-a="fset" data-k="maxTotal" data-v="${x}" data-n="1">≤ ${money(x)}</button>`).join('')}</div></div>
        <div><div class="field"><span>${L('Bedrooms (at least)', 'বেডরুম (অন্তত)')}</span></div><div class="chips">${[null, 1, 2, 3, 4].map(x => `<button class="chip ${f.minBeds === x ? 'on' : ''}" data-a="fset" data-k="minBeds" data-v="${x == null ? '' : x}" data-n="1">${x == null ? L('Any', 'যেকোনো') : num(x) + '+'}</button>`).join('')}</div></div>
        <div><div class="field"><span>${L('Bathrooms (at least)', 'বাথরুম (অন্তত)')}</span></div><div class="chips">${[null, 1, 2, 3].map(x => `<button class="chip ${f.minBaths === x ? 'on' : ''}" data-a="fset" data-k="minBaths" data-v="${x == null ? '' : x}" data-n="1">${x == null ? L('Any', 'যেকোনো') : num(x) + '+'}</button>`).join('')}</div></div>
        <div><div class="field"><span>${L('Who is moving in', 'কারা উঠবেন')}</span></div><div class="chips wrap">${Object.keys(BB.LABELS.accepts).map(a => chip('accepts', a, lab('accepts', a))).join('')}</div><p class="hint">${L('Shows homes that accept everyone you pick.', 'যাঁদের বেছে নেবেন, তাঁদের সবাইকে নেয় এমন বাসা দেখায়।')}</p></div>
        <label class="field"><span>${L('Move in by', 'এর মধ্যে উঠতে চাই')}</span><input class="input" type="date" id="f-availableBy" value="${esc(f.availableBy || '')}" data-in="fdate" data-k="availableBy"></label>
        <div><div class="field"><span>${L('Furnishing', 'ফার্নিচার')}</span></div><div class="chips wrap">${['0', '1', '2'].map(x => chip('furnishing', x, lab('furnishing', x))).join('')}</div></div>
        <div><div class="field"><span>${L('Size (sq ft)', 'আয়তন (বর্গফুট)')}</span></div><div class="row">${numIn('minSize', L('Min', 'সর্বনিম্ন'))}${numIn('maxSize', L('Max', 'সর্বোচ্চ'))}</div></div>
        <div><div class="field"><span>${L('Floor', 'তলা')}</span></div><div class="chips wrap">${radio('floor', 'any', L('Any', 'যেকোনো'))}${radio('floor', 'ground', L('Ground', 'নিচতলা'))}${radio('floor', 'low', L('1st–3rd', '১–৩ তলা'))}${radio('floor', 'high', L('4th and up', '৪ তলা বা উপরে'))}<button class="chip ${f.lift ? 'on' : ''}" data-a="fbool" data-k="lift">${L('Lift required', 'লিফট লাগবে')}</button></div></div>
        <div><div class="field"><span>${L('Gas', 'গ্যাস')}</span></div><div class="chips wrap">${radio('gas', 'any', L('Any', 'যেকোনো'))}${radio('gas', 'pipeline', lab('gas', 'pipeline'))}${radio('gas', 'cylinder', lab('gas', 'cylinder'))}</div></div>
        <div><div class="field"><span>${L('Bills included', 'বিল অন্তর্ভুক্ত')}</span></div><div class="chips wrap">${chip('bills', 'water', L('Water', 'পানি'))}${chip('bills', 'gas', L('Gas', 'গ্যাস'))}${chip('bills', 'electricity', L('Electricity', 'বিদ্যুৎ'))}</div></div>
        <div><div class="field"><span>${L('Must-haves', 'অবশ্যই চাই')}</span></div><div class="chips wrap">${['lift', 'generator', 'parking_car', 'parking_bike', 'guard', 'cctv', 'gated', 'rooftop', 'servant_room', 'attached_bath', 'wifi'].map(a => chip('amenities', a, lab('amenity', a))).join('')}</div></div>
        <div><div class="field"><span>${L('Lifestyle (rooms and mess seats)', 'জীবনযাপন (রুম ও মেস সিট)')}</span></div><div class="chips wrap">${chip('amenities', 'pets_ok', lab('amenity', 'pets_ok'))}${chip('amenities', 'smoking_ok', lab('amenity', 'smoking_ok'))}</div></div>
        <div><div class="field"><span>${L('Advance (at most)', 'অগ্রিম (সর্বোচ্চ)')}</span></div><div class="chips">${[null, 1, 2].map(x => `<button class="chip ${f.maxAdvance === x ? 'on' : ''}" data-a="fset" data-k="maxAdvance" data-v="${x == null ? '' : x}" data-n="1">${x == null ? L('Any', 'যেকোনো') : L('{n} month(s)', '{n} মাস', { n: x })}</button>`).join('')}</div></div>
        <div><div class="field"><span>${L('Trust', 'আস্থা')}</span></div><div class="chips wrap"><button class="chip ${f.ownerChecked ? 'on' : ''}" data-a="fbool" data-k="ownerChecked">${I('shield', 14)} ${L('Ownership checked only', 'শুধু মালিকানা যাচাই করা')}</button></div></div>
        <div><div class="field"><span>${L('Added', 'যোগ হয়েছে')}</span></div><div class="chips">${[null, 1, 3, 7, 14].map(x => `<button class="chip ${f.addedWithin === x ? 'on' : ''}" data-a="fset" data-k="addedWithin" data-v="${x == null ? '' : x}" data-n="1">${x == null ? L('Any time', 'যেকোনো সময়') : x === 1 ? L('Last 24 hours', 'গত ২৪ ঘণ্টা') : L('Last {n} days', 'গত {n} দিন', { n: x })}</button>`).join('')}</div></div>
        <label class="check"><input type="checkbox" id="f-hideLet" ${f.hideLet ? 'checked' : ''} data-in="fcheck" data-k="hideLet"><span>${L('Hide homes that are already let', 'ভাড়া হয়ে যাওয়া বাসা লুকান')}</span></label>
        <label class="field"><span>${L('Keywords', 'শব্দ দিয়ে খুঁজুন')}</span><input class="input" id="f-keywords" value="${esc(f.keywords || '')}" placeholder="${esc(L('e.g. metro, lake, rooftop', 'যেমন মেট্রো, লেক, ছাদ'))}" data-in="ftext" data-k="keywords"></label></div>`;
      return sheet(L('Filters', 'ফিল্টার'), body, `<button class="btn plain" data-a="reset-filters">${L('Clear all', 'সব মুছুন')}</button><button class="btn" data-a="close" id="fcount">${L('Show {n} homes', '{n}টি বাসা দেখুন', { n: count > 1000 ? '1,000+' : count })}</button>`, true);
    },
    viewing(s) {
      const days = [];
      for (let i = 1; i <= 7; i++) days.push(ymd(Date.now() + i * BB.DAY));
      const times = ['10:00', '11:00', '12:00', '15:00', '16:00', '17:00', '18:00', '19:00'];
      const sel = s.slots || [];
      const isoOf = (d, t) => new Date(`${d}T${t}:00+06:00`).toISOString();
      const dsel = s.day || days[0];
      return sheet(L('Suggest viewing times', 'দেখার সময় প্রস্তাব করুন'), `<p class="small muted">${L('Pick up to 3 times. The other person chooses one.', 'সর্বোচ্চ ৩টি সময় বেছে নিন। অন্যজন একটি বেছে নেবেন।')}</p>
        <div class="chips" style="margin:10px 0">${days.map(d => `<button class="chip ${d === dsel ? 'on' : ''}" data-a="vs-day" data-d="${d}">${esc(F.day(d + 'T06:00:00Z', lang()))}</button>`).join('')}</div>
        <div class="chips wrap">${times.map(t => { const x = isoOf(dsel, t); return `<button class="chip ${sel.includes(x) ? 'on' : ''}" data-a="vs-time" data-v="${x}">${esc(F.time(x, lang()))}</button>`; }).join('')}</div>
        <h3 style="margin:16px 0 8px">${L('Your choices', 'আপনার বেছে নেওয়া সময়')}</h3>${sel.length ? sel.map(x => `<div class="slot" style="margin-bottom:6px"><span>${esc(when(x))}</span><button class="icon-btn" data-a="vs-time" data-v="${x}">${I('x', 16)}</button></div>`).join('') : `<p class="small muted">${L('None yet.', 'এখনো নেই।')}</p>`}`,
        `<button class="btn" data-a="vs-send" ${sel.length ? '' : 'disabled'}>${L('Send {n} times', '{n}টি সময় পাঠান', { n: sel.length })}</button>`);
    },
    deal(s) {
      return sheet(L('Confirm the deal', 'চুক্তি নিশ্চিত করুন'), `<p class="small muted">${L('Both of you confirm the same terms with an OTP. The home is then marked "Let agreed".', 'দুজনেই ওটিপি দিয়ে একই শর্ত নিশ্চিত করবেন। তারপর বাসাটি "ভাড়া চূড়ান্ত" হবে।')}</p><div class="stack">
        <label class="field"><span>${L('Monthly rent (৳)', 'মাসিক ভাড়া (৳)')}</span><input class="input" id="d-rent" inputmode="numeric" value="${esc(s.rent)}" data-in="dealf" data-k="rent"></label>
        <label class="field"><span>${L('Advance (৳)', 'অগ্রিম (৳)')}</span><input class="input" id="d-adv" inputmode="numeric" value="${esc(s.advance)}" data-in="dealf" data-k="advance"></label>
        <label class="field"><span>${L('Move-in date', 'ওঠার তারিখ')}</span><input class="input" type="date" id="d-move" value="${esc(s.moveIn)}" data-in="dealf" data-k="moveIn"></label>
        ${+s.advance > +s.rent ? `<div class="note warn">${I('alert', 18)}<div class="small">${L('More than one month in advance needs the Rent Controller\'s permission (Premises Rent Control Act 1991).', 'এক মাসের বেশি অগ্রিমে ভাড়া নিয়ন্ত্রকের অনুমতি লাগে (বাড়ি ভাড়া নিয়ন্ত্রণ আইন ১৯৯১)।')}</div></div>` : ''}</div>`,
        `<button class="btn" data-a="deal-send">${L('Confirm with OTP', 'ওটিপি দিয়ে নিশ্চিত করুন')}</button>`);
    },
    report(s) {
      const reasons = [['scam', L('Asked for money or a scam', 'টাকা চেয়েছে বা প্রতারণা')], ['fake', L('Fake listing or wrong photos', 'ভুয়া বিজ্ঞাপন বা ভুল ছবি')], ['let', L('Already let', 'আগেই ভাড়া হয়ে গেছে')], ['harass', L('Harassment', 'হয়রানি')], ['wrong', L('Wrong information', 'ভুল তথ্য')], ['other', L('Something else', 'অন্য কিছু')]];
      return sheet(L('Report', 'অভিযোগ'), `<div class="stack">${reasons.map(([k, t]) => `<label class="check"><input type="radio" name="rr" ${s.reason === k ? 'checked' : ''} data-in="rep-reason" data-v="${k}" id="rr-${k}"><span>${esc(t)}</span></label>`).join('')}
        <label class="field"><span>${L('What happened? (optional)', 'কী হয়েছে? (ঐচ্ছিক)')}</span><textarea class="input" id="rep-details" data-in="rep-details">${esc(s.details || '')}</textarea></label>
        <p class="hint">${L('We review every report within 24 hours. The other person is not told who reported.', 'প্রতিটি অভিযোগ ২৪ ঘণ্টার মধ্যে দেখি। কে অভিযোগ করেছে অন্যজনকে জানানো হয় না।')}</p></div>`,
        `<button class="btn danger" data-a="rep-send" ${s.reason ? '' : 'disabled'}>${L('Send report', 'অভিযোগ পাঠান')}</button>`);
    },
    chatmenu(s) {
      const c = BB.get.conv(s.id);
      const other = c.renterId === me().id ? c.landlordId : c.renterId;
      return sheet(L('Options', 'অপশন'), `<div class="list" style="margin:-14px"><button data-a="report" data-t="user" data-id="${other}">${I('flag', 20, 'lead')}<span class="grow">${L('Report this person', 'এই ব্যক্তির বিরুদ্ধে অভিযোগ')}</span></button><button data-a="block" data-id="${other}" style="color:var(--danger)">${I('ban', 20)}<span class="grow">${L('Block this person', 'এই ব্যক্তিকে ব্লক করুন')}</span></button><button data-a="nav" data-to="page/safety">${I('shield', 20, 'lead')}<span class="grow">${L('Safety tips', 'নিরাপত্তা টিপস')}</span></button></div>`);
    },
    payout() {
      const u = me();
      return sheet(L('Payout bank account', 'পেমেন্টের ব্যাংক অ্যাকাউন্ট'), `<div class="note" style="margin-bottom:12px">${I('info', 18)}<div class="small">${L('The account must be in your own name: {n}. Our team checks it against your verified ID. After any change there is a 48-hour wait before payouts, to stop account takeovers.', 'অ্যাকাউন্টটি আপনার নিজের নামে হতে হবে: {n}। আমাদের টিম যাচাই করা আইডির সাথে মিলিয়ে দেখবে। যেকোনো পরিবর্তনের পর পেমেন্টের আগে ৪৮ ঘণ্টা অপেক্ষা, যাতে কেউ অ্যাকাউন্ট দখল করতে না পারে।', { n: esc(u.legalName || u.name_en) })}</div></div><div class="stack">
        <label class="field"><span>${L('Account name', 'অ্যাকাউন্টের নাম')}</span><input class="input" id="pa-name" value="${esc(u.legalName || u.name_en)}"></label>
        <label class="field"><span>${L('Account number', 'অ্যাকাউন্ট নম্বর')}</span><input class="input" id="pa-no" inputmode="numeric" placeholder="2050100012345"></label>
        <label class="field"><span>${L('Bank', 'ব্যাংক')}</span><select class="input" id="pa-bank">${['Demo Bank PLC', 'Sample Commercial Bank', 'Example Islami Bank'].map(b => `<option>${esc(b)}</option>`).join('')}</select></label>
        <label class="field"><span>${L('Branch routing number', 'শাখার রাউটিং নম্বর')}</span><input class="input" id="pa-routing" inputmode="numeric" placeholder="000261726"></label>
        <div class="panel tight row"><img src="${ART.paper({ kind: 'bank_proof', name: u.legalName || u.name_en })}" style="width:40px;height:52px" alt=""><div class="grow small">${L('Photo of a cheque leaf or bank statement (sample used in the demo)', 'চেকের পাতা বা ব্যাংক স্টেটমেন্টের ছবি (ডেমোতে নমুনা)')}</div>${I('check', 18)}</div></div>`,
        `<button class="btn" data-a="pa-save">${L('Submit for checking', 'যাচাইয়ের জন্য জমা দিন')}</button>`);
    },
    hours() {
      const u = me();
      const ch = ui.hoursDraft || (ui.hoursDraft = JSON.parse(JSON.stringify(u.callHours)));
      const dn = [['sat', L('Sat', 'শনি')], ['sun', L('Sun', 'রবি')], ['mon', L('Mon', 'সোম')], ['tue', L('Tue', 'মঙ্গল')], ['wed', L('Wed', 'বুধ')], ['thu', L('Thu', 'বৃহস্পতি')], ['fri', L('Fri', 'শুক্র')]];
      return sheet(L('Contact hours', 'যোগাযোগের সময়'), `<div class="chips wrap">${dn.map(([k, t]) => `<button class="chip ${ch.days.includes(k) ? 'on' : ''}" data-a="hours-day" data-v="${k}">${esc(t)}</button>`).join('')}</div>
        <div class="row" style="margin-top:12px"><label class="field grow"><span>${L('From', 'থেকে')}</span><input class="input" type="time" id="h-from" value="${esc(ch.from)}"></label><label class="field grow"><span>${L('To', 'পর্যন্ত')}</span><input class="input" type="time" id="h-to" value="${esc(ch.to)}"></label></div>`,
        `<button class="btn" data-a="hours-save">${L('Save', 'সংরক্ষণ')}</button>`);
    },
    problem(s) {
      return sheet(L('Report a problem', 'সমস্যা জানান'), `<p class="small muted">${L('The advance is frozen while our team looks at what happened. We decide within 48 hours and either refund you (including our fee) or pay the landlord.', 'আমাদের টিম দেখা পর্যন্ত অগ্রিম আটকে থাকবে। ৪৮ ঘণ্টার মধ্যে সিদ্ধান্ত নিয়ে হয় আপনাকে ফেরত দেব (ফি সহ), নয়তো বাড়িওয়ালাকে দেব।')}</p>
        <div class="stack">${[L('The "landlord" is not the real owner', '"বাড়িওয়ালা" আসল মালিক নন'), L('The home is not as listed', 'বাসা বিজ্ঞাপনের মতো নয়'), L('I was not given the keys', 'আমাকে চাবি দেওয়া হয়নি'), L('Something else', 'অন্য কিছু')].map((t, i) => `<label class="check"><input type="radio" name="pr" id="pr-${i}" ${s.reason === t ? 'checked' : ''} data-in="pr-reason" data-v="${esc(t)}"><span>${esc(t)}</span></label>`).join('')}
        <textarea class="input" id="pr-details" placeholder="${esc(L('Tell us what happened', 'কী হয়েছে লিখুন'))}"></textarea></div>`,
        `<button class="btn danger" data-a="pr-send" ${s.reason ? '' : 'disabled'}>${L('Freeze the advance and report', 'অগ্রিম আটকে অভিযোগ করুন')}</button>`);
    },
    savesearch() {
      return sheet(L('Save this search', 'এই খোঁজ সংরক্ষণ করুন'), `<label class="field"><span>${L('Name', 'নাম')}</span><input class="input" id="ss-name" value="${esc(areaLabel() + (ui.f.maxTotal ? ' · ≤ ' + money(ui.f.maxTotal) : ''))}"></label><p class="hint">${L('We will send you an alert as soon as a matching home goes live.', 'মিলে যাওয়া বাসা চালু হলেই আমরা জানাব।')}</p>`,
        `<button class="btn" data-a="ss-save">${I('bell', 18)} ${L('Save and get alerts', 'সংরক্ষণ করে নোটিফিকেশন নিন')}</button>`);
    },
    confirm(s) { return sheet(s.title, `<p>${s.body}</p>`, `<button class="btn plain" data-a="close">${L('Cancel', 'বাতিল')}</button><button class="btn ${s.danger ? 'danger' : ''}" data-a="confirm-ok">${esc(s.ok)}</button>`); },
    demo() { return sheet(L('Demo controls', 'ডেমো নিয়ন্ত্রণ'), demoPanel(true), null, true); },
  };

  // ───────────── OTP helpers ─────────────
  function newCode() { return String(Math.floor(100000 + Math.random() * 900000)); }
  function askOtp(title, onOk, note) {
    const code = newCode();
    ui.sheet = { type: 'otp', title, code, onOk, tries: 0, note };
    sms(L('{c} is your Basha Bari code to confirm: {t}. Never share it.', '{c} আপনার বাসাবাড়ি কোড, নিশ্চিত করতে: {t}। কাউকে বলবেন না।', { c: code, t: title }));
    renderSheet();
    setTimeout(() => { const el = document.getElementById('otp-code'); if (el) el.focus(); }, 60);
  }
  function openAuth(reason, after) {
    ui.after = after || null;
    ui.sheet = { type: 'auth', step: 'phone', phone: '', reason: reason || '' };
    renderSheet();
    setTimeout(() => { const el = document.getElementById('auth-phone'); if (el) el.focus(); }, 60);
  }
  function signedIn(u, isNew) {
    session.userId = u.id;
    if (isNew) { session.made = session.made || []; session.made.push(u.id); }
    saveSession();
    const r = BB.loggedIn(u.id);
    ui.sheet = null;
    ui.verify = null;
    ui.wizard = null;
    toast(r.cancelled ? L('Welcome back. Your account deletion was cancelled.', 'আবার স্বাগতম। আপনার অ্যাকাউন্ট মোছা বাতিল হয়েছে।') : isNew ? L('Account created. You can now see full details.', 'অ্যাকাউন্ট খোলা হয়েছে। এখন পুরো তথ্য দেখতে পারবেন।') : L('Welcome back, {n}', 'আবার স্বাগতম, {n}', { n: firstName(u) }));
    const next = ui.after;
    ui.after = null;
    if (next) next(); else render();
  }

  // ───────────── Click actions ─────────────
  const A = {
    nav: el => { ui.sheet = null; ui.viewer = null; if (el.dataset.to === 'search') { ui.suggestOpen = false; } go(el.dataset.to); },
    back: () => { if (history.length > 1) history.back(); else go('search'); },
    noop: () => {},
    close: () => { ui.sheet = null; ui.hoursDraft = null; renderSheet(); if (route().name === 'search') render(); },
    lang: () => { session.lang = bn() ? 'en' : 'bn'; saveSession(); render(); },
    setlang: el => { session.lang = el.dataset.l; saveSession(); render(); },
    start: () => { session.onboarded = true; saveSession(); go('search'); },
    'start-login': () => { session.onboarded = true; saveSession(); go('search'); setTimeout(() => openAuth(), 50); },
    open: el => go('listing/' + el.dataset.id),
    fav: el => {
      const u = me();
      if (!u) return openAuth(L('Sign up to save homes.', 'বাসা সংরক্ষণ করতে সাইন আপ করুন।'));
      const on = BB.toggleFavourite(u.id, el.dataset.id);
      toast(on ? L('Saved to favourites', 'পছন্দের তালিকায় রাখা হয়েছে') : L('Removed from favourites', 'পছন্দের তালিকা থেকে সরানো হয়েছে'));
    },
    kind: el => { const k = el.dataset.k; ui.f.kinds = !k ? [] : ui.f.kinds.includes(k) ? ui.f.kinds.filter(x => x !== k) : [k]; ui.page = 1; saveFilters(); render(); },
    'pick-area': el => { ui.f.areaIds = [+el.dataset.id]; ui.q = ''; ui.suggestOpen = false; ui.page = 1; ui.f.bounds = null; saveFilters(); document.activeElement && document.activeElement.blur(); render(); flyToArea(+el.dataset.id); },
    'clear-area': () => { ui.f.areaIds = []; ui.q = ''; ui.suggestOpen = false; ui.page = 1; saveFilters(); render(); },
    filters: () => { ui.sheet = { type: 'filters' }; renderSheet(); },
    view: el => { ui.view = el.dataset.v; ui.pin = null; render(); },
    more: () => { ui.page++; render(); },
    'reset-filters': () => { const keep = { areaIds: ui.f.areaIds, kinds: ui.f.kinds, sort: ui.f.sort }; ui.f = Object.assign(BB.defaultFilters(), keep); saveFilters(); if (ui.sheet) renderSheet(); render(); },
    ftoggle: el => { const k = el.dataset.k, v = el.dataset.v; const a = ui.f[k] || []; ui.f[k] = a.includes(v) ? a.filter(x => x !== v) : a.concat([v]); saveFilters(); renderSheet(); },
    fset: el => { const k = el.dataset.k; let v = el.dataset.v; if (el.dataset.n) v = v === '' ? null : +v; if (ui.f[k] === v && el.dataset.n) v = null; ui.f[k] = v; saveFilters(); renderSheet(); },
    fbool: el => { const k = el.dataset.k; ui.f[k] = !ui.f[k]; saveFilters(); renderSheet(); },
    'save-search': () => {
      const u = me();
      if (!u) return openAuth(L('Sign up to save searches and get alerts.', 'খোঁজ সংরক্ষণ আর নোটিফিকেশন পেতে সাইন আপ করুন।'), () => { ui.sheet = { type: 'savesearch' }; render(); });
      ui.sheet = { type: 'savesearch' }; renderSheet();
    },
    'ss-save': () => { const name = document.getElementById('ss-name').value.trim() || areaLabel(); BB.saveSearch(me().id, ui.f, name); ui.sheet = null; renderSheet(); toast(L('Search saved. We will alert you about new homes.', 'খোঁজ সংরক্ষিত। নতুন বাসা এলে জানাব।')); },
    'open-search': el => { const s = S().savedSearches.find(x => x.id === el.dataset.id); ui.f = Object.assign(BB.defaultFilters(), s.filters); ui.page = 1; saveFilters(); go('search'); },
    'del-search': el => { BB.deleteSaved(el.dataset.id); toast(L('Deleted', 'মুছে ফেলা হয়েছে')); },
    alert: el => BB.setSavedAlert(el.dataset.id, el.dataset.v),
    room: el => { ui.room = el.dataset.r; render(); },
    viewer: el => { ui.viewer = { id: route().args[0], i: +el.dataset.i }; renderSheet(); },
    'viewer-close': () => { ui.viewer = null; renderSheet(); },
    share: () => { toast(L('Link copied. On Facebook or WhatsApp it opens this home (demo).', 'লিংক কপি হয়েছে। ফেসবুক বা হোয়াটসঅ্যাপে এই বাসাটি খুলবে (ডেমো)।')); },
    'gate-signup': () => openAuth(L('Free with your mobile number. No password.', 'মোবাইল নম্বর দিয়ে বিনামূল্যে। পাসওয়ার্ড লাগে না।')),
    'go-verify': () => go('verify'),
    contact: el => {
      const u = me();
      if (lvl() < 2) return go('verify');
      const c = BB.startConversation(u.id, el.dataset.id);
      go('chat/' + c.id);
      if (el.dataset.then === 'viewing') setTimeout(() => { ui.sheet = { type: 'viewing', convId: c.id, slots: [] }; renderSheet(); }, 80);
    },
    report: el => { if (!me()) return openAuth(); ui.sheet = { type: 'report', t: el.dataset.t, id: el.dataset.id, reason: null }; renderSheet(); },
    'rep-send': () => { const s = ui.sheet; const det = document.getElementById('rep-details').value; BB.report(me().id, s.t, s.id, s.reason, det); ui.sheet = null; renderSheet(); toast(L('Report sent. We review it within 24 hours.', 'অভিযোগ পাঠানো হয়েছে। ২৪ ঘণ্টার মধ্যে দেখব।')); },
    'chat-menu': el => { ui.sheet = { type: 'chatmenu', id: el.dataset.id }; renderSheet(); },
    block: el => { confirmSheet(L('Block this person?', 'এই ব্যক্তিকে ব্লক করবেন?'), L('You will not be able to message each other. The chat is closed.', 'আপনারা আর একে অপরকে বার্তা পাঠাতে পারবেন না। চ্যাট বন্ধ হবে।'), L('Block', 'ব্লক'), true, () => { BB.block(me().id, el.dataset.id); toast(L('Blocked', 'ব্লক করা হয়েছে')); }); },
    send: el => {
      const ta = document.getElementById('msg');
      const text = ta.value;
      if (!text.trim()) return;
      if (me().status === 'suspended') throw BB.err('Your account is suspended.', 'আপনার অ্যাকাউন্ট স্থগিত।');
      ui.drafts = ui.drafts || {};
      ui.drafts[el.dataset.id] = '';
      BB.sendMessage(el.dataset.id, me().id, text);
      botAfter(el.dataset.id);
    },
    'viewing-sheet': el => { ui.sheet = { type: 'viewing', convId: el.dataset.id, slots: [] }; renderSheet(); },
    'vs-day': el => { ui.sheet.day = el.dataset.d; renderSheet(); },
    'vs-time': el => { const s = ui.sheet; const v = el.dataset.v; s.slots = s.slots.includes(v) ? s.slots.filter(x => x !== v) : s.slots.length >= 3 ? s.slots : s.slots.concat([v]); s.slots.sort(); renderSheet(); },
    'vs-send': () => { const s = ui.sheet; BB.proposeViewing(s.convId, me().id, s.slots); ui.sheet = null; renderSheet(); toast(L('Times sent', 'সময় পাঠানো হয়েছে')); botAfter(s.convId); },
    'viewing-accept': el => { const v = S().viewings.find(x => x.id === el.dataset.id); BB.acceptViewing(el.dataset.id, me().id, el.dataset.s); toast(L('Viewing agreed', 'দেখার সময় ঠিক হয়েছে')); botAfter(v.convId); },
    'viewing-decline': el => { const v = S().viewings.find(x => x.id === el.dataset.id); BB.declineViewing(el.dataset.id, me().id); botAfter(v.convId); },
    'share-details': el => {
      const id = el.dataset.id;
      askOtp(L('Share my details', 'আমার তথ্য শেয়ার করুন'), () => {
        const rec = BB.shareDetails(id, me().id);
        toast(rec ? L('Details shared. You both have the same record.', 'তথ্য শেয়ার হয়েছে। দুজনের কাছেই একই রেকর্ড।') : L('Done. Waiting for the other person.', 'হয়েছে। অন্যজনের অপেক্ষা।'));
        botAfter(id);
      }, L('Your name, phone number, the last 4 digits of your ID and the exact address are shared only when both of you have confirmed.', 'দুজনেই নিশ্চিত করলে তবেই আপনার নাম, ফোন নম্বর, আইডির শেষ ৪ সংখ্যা আর সঠিক ঠিকানা শেয়ার হবে।'));
    },
    'deal-sheet': el => {
      const c = BB.get.conv(el.dataset.id);
      const l = BB.get.listing(c.listingId);
      const old = BB.dealOf(c.id);
      const moveIn = l.availableFrom > today() ? l.availableFrom : ymd(Date.now() + 3 * BB.DAY);
      ui.sheet = { type: 'deal', convId: c.id, rent: old ? old.rent : l.rent, advance: old ? old.advance : l.rent * Math.max(1, l.advanceMonths), moveIn: old ? old.moveIn : moveIn };
      renderSheet();
    },
    'deal-send': () => {
      const s = ui.sheet;
      askOtp(L('Confirm the deal', 'চুক্তি নিশ্চিত করুন'), () => { BB.proposeDeal(s.convId, me().id, { rent: +F.toAscii(s.rent), advance: +F.toAscii(s.advance), moveIn: s.moveIn }); toast(L('Deal sent for confirmation', 'নিশ্চিতকরণের জন্য চুক্তি পাঠানো হয়েছে')); botAfter(s.convId); });
    },
    'deal-confirm': el => { const d = BB.get.deal(el.dataset.id); askOtp(L('Confirm the deal', 'চুক্তি নিশ্চিত করুন'), () => { BB.confirmDeal(d.id, me().id); toast(L('Deal confirmed', 'চুক্তি নিশ্চিত হয়েছে')); botAfter(d.convId); }); },
    protected: el => {
      const d = BB.get.deal(el.dataset.id);
      const fee = BB.feeFor(d.advance);
      confirmSheet(L('Use the protected advance?', 'সুরক্ষিত অগ্রিম ব্যবহার করবেন?'),
        L('You send {a} by bank transfer to our escrow account at the bank. The landlord is paid after you move in, or you get it back if something is wrong. Fee: {f}.', 'আপনি ব্যাংক ট্রান্সফারে {a} আমাদের এসক্রো অ্যাকাউন্টে পাঠাবেন। আপনি ওঠার পর বাড়িওয়ালা পাবেন; কিছু ভুল হলে আপনি ফেরত পাবেন। ফি: {f}।', { a: money(d.advance + fee), f: fee ? money(fee) : L('free during the pilot', 'পাইলটে ফ্রি') }),
        L('Continue', 'চালিয়ে যান'), false, () => { const a = BB.startProtected(d.id, me().id); botAfter(d.convId); go('advance/' + a.id); });
    },
    'paid-direct': el => { const d = BB.get.deal(el.dataset.id); askOtp(L('Confirm the advance payment', 'অগ্রিম পরিশোধ নিশ্চিত করুন'), () => { BB.confirmPaidDirect(d.id, me().id); toast(L('Confirmed', 'নিশ্চিত হয়েছে')); botAfter(d.convId); }); },
    sent: el => { BB.markSent(el.dataset.id, me().id); toast(L('Thanks. We will confirm when it arrives.', 'ধন্যবাদ। টাকা পৌঁছালে জানাব।')); autoStaffSoon(); const a = BB.get.advance(el.dataset.id); botAfter(a.convId); },
    copy: el => { try { navigator.clipboard.writeText(el.dataset.v); } catch (e) { /* ignore */ } toast(L('Copied', 'কপি হয়েছে')); },
    problem: el => { ui.sheet = { type: 'problem', id: el.dataset.id, reason: null }; renderSheet(); },
    'pr-send': () => { const s = ui.sheet; const det = document.getElementById('pr-details').value; BB.reportProblem(s.id, me().id, s.reason + (det ? ' — ' + det : '')); ui.sheet = null; renderSheet(); toast(L('The advance is frozen. We will decide within 48 hours.', 'অগ্রিম আটকে রাখা হয়েছে। ৪৮ ঘণ্টার মধ্যে সিদ্ধান্ত জানাব।')); },
    'movein-photo': () => { ui.movein.photos = Math.min(6, (ui.movein.photos || 0) + 1); render(); },
    'movein-save': el => {
      const mi = ui.movein;
      if (!mi.keys) throw BB.err('Tick that you received the keys.', 'চাবি পেয়েছেন তা টিক দিন।');
      if (!mi.elec) throw BB.err('Write the electricity meter reading.', 'বিদ্যুৎ মিটারের রিডিং লিখুন।');
      const id = el.dataset.id;
      askOtp(L('Save the move-in check', 'চেকলিস্ট সংরক্ষণ'), () => { BB.saveMoveIn(id, me().id, Object.assign({}, mi)); ui.movein = null; toast(L('Saved. Welcome home!', 'সংরক্ষিত। নতুন বাসায় স্বাগতম!')); botAfter(BB.get.deal(id).convId); });
    },
    handover: el => { BB.confirmHandover(el.dataset.id, me().id); toast(L('Handover confirmed', 'বুঝিয়ে দেওয়া নিশ্চিত')); },
    print: () => window.print(),
    'post-start': () => { if (lvl() < 2) return go('verify'); ui.wizard = null; go('post'); },
    lstatus: el => { BB.setListingStatus(me().id, el.dataset.id, el.dataset.s); toast(L('Updated', 'আপডেট হয়েছে')); },
    'payout-sheet': () => { ui.sheet = { type: 'payout' }; renderSheet(); },
    'pa-save': () => {
      BB.addPayoutAccount(me().id, { accountName: document.getElementById('pa-name').value, accountNo: document.getElementById('pa-no').value, bank: document.getElementById('pa-bank').value, routing: document.getElementById('pa-routing').value });
      ui.sheet = null; renderSheet(); toast(L('Submitted. Our team checks it against your ID.', 'জমা হয়েছে। আমাদের টিম আইডির সাথে মিলিয়ে দেখবে।')); autoStaffSoon();
    },
    'hours-sheet': () => { ui.hoursDraft = null; ui.sheet = { type: 'hours' }; renderSheet(); },
    'hours-day': el => { const ch = ui.hoursDraft; const v = el.dataset.v; ch.days = ch.days.includes(v) ? ch.days.filter(x => x !== v) : ch.days.concat([v]); renderSheet(); },
    'hours-save': () => { const ch = ui.hoursDraft; ch.from = document.getElementById('h-from').value; ch.to = document.getElementById('h-to').value; BB.updateProfile(me().id, { callHours: ch }); ui.sheet = null; ui.hoursDraft = null; renderSheet(); toast(L('Saved', 'সংরক্ষিত')); },
    // Wizard
    'w-set': el => { const d = ui.wizard.d; let v = el.dataset.v; if (el.dataset.k === 'furnishing') v = +v; d[el.dataset.k] = v; if (el.dataset.k === 'kind') { if (v === 'studio') d.beds = 1; if (v === 'mess_seat' || v === 'sublet') { d.beds = 1; d.baths = 1; d.balconies = 0; } } saveDraft(); render(); },
    'w-step': el => { const d = ui.wizard.d; const k = el.dataset.k; d[k] = Math.max(+el.dataset.min, Math.min(+el.dataset.max, (+d[k] || 0) + +el.dataset.d)); saveDraft(); render(); },
    'w-toggle': el => { const d = ui.wizard.d; const k = el.dataset.k, v = el.dataset.v; d[k] = d[k].includes(v) ? d[k].filter(x => x !== v) : d[k].concat([v]); saveDraft(); render(); },
    'w-area-pick': el => { const d = ui.wizard.d; d.areaId = +el.dataset.id; d.areaQ = ''; d.exact = null; saveDraft(); render(); },
    'w-area-clear': () => { const d = ui.wizard.d; d.areaId = null; d.exact = null; saveDraft(); render(); },
    'w-shot': el => { const d = ui.wizard.d; d.shots[el.dataset.k] = Math.floor(Math.random() * 99999); saveDraft(); render(); },
    'w-shots-all': () => { const d = ui.wizard.d; const rooms = BB.roomsFor(d.kind, +d.beds, +d.baths, +d.balconies); const c = {}; for (const r of rooms) { c[r] = (c[r] || 0) + 1; d.shots[r + c[r]] = d.shots[r + c[r]] || Math.floor(Math.random() * 99999); } saveDraft(); render(); },
    'w-proof': el => { const d = ui.wizard.d; d.proofDone[el.dataset.k] = !d.proofDone[el.dataset.k]; saveDraft(); render(); },
    'w-next': () => { validateStep(ui.wizard); ui.wizard.step++; saveDraft(); render(true); },
    'w-back': () => { ui.wizard.step--; saveDraft(); render(true); },
    'w-cancel': () => { history.back(); },
    'w-submit': () => {
      const w = ui.wizard;
      validateStep(w);
      if (w.mode === 'scout') {
        const r = BB.scoutSubmit(me().id, draftForStore(w.d), w.d.landlordPhone);
        try { BB.local.removeItem(draftKey()); } catch (e) { /* ignore */ }
        ui.wizard = null;
        sms(L('To landlord: A Basha Bari scout prepared a listing for your home. Check and confirm: bashabari.example/i/{c}', 'বাড়িওয়ালাকে: বাসাবাড়ির একজন স্কাউট আপনার বাসার বিজ্ঞাপন তৈরি করেছেন। দেখে নিশ্চিত করুন: bashabari.example/i/{c}', { c: r.sub.id.slice(-5) }));
        toast(r.landlordExists ? L('Sent. The landlord got the invite in their account.', 'পাঠানো হয়েছে। বাড়িওয়ালা তাঁর অ্যাকাউন্টে আমন্ত্রণ পেয়েছেন।') : L('Sent by SMS. It expires in 7 days if the landlord does not confirm.', 'এসএমএসে পাঠানো হয়েছে। বাড়িওয়ালা ৭ দিনে নিশ্চিত না করলে মেয়াদ শেষ।'));
        go('scout');
      } else {
        const l = BB.createListing(me().id, draftForStore(w.d));
        try { BB.local.removeItem(draftKey()); } catch (e) { /* ignore */ }
        ui.wizard = null;
        toast(L('Submitted. We check it, usually within 2 hours.', 'জমা হয়েছে। সাধারণত ২ ঘণ্টার মধ্যে যাচাই করি।'));
        autoStaffSoon();
        go('homes');
        void l;
      }
    },
    'scout-start': () => { ui.wizard = null; go('scoutnew'); },
    'demo-confirm-invite': el => {
      const s = BB.get.sub(el.dataset.id);
      let ll = BB.get.userByPhone(s.landlordPhone);
      if (!ll) {
        ll = BB.createUser({ phone: s.landlordPhone, name: 'New Landlord', lang: 'bn' });
        const k = BB.submitIdCheck(ll.id, { docType: 'smart_nid', number: '9' + s.landlordPhone.slice(-9), legalName: 'New Landlord', dob: '1975-05-05' });
        BB.reviewIdCheck('s2', k.id, true);
      } else if (ll.level < 2) {
        throw BB.err('That landlord must verify their ID first.', 'সেই বাড়িওয়ালাকে আগে আইডি যাচাই করতে হবে।');
      }
      BB.scoutConfirm(s.id, ll.id);
      toast(L('The landlord confirmed (demo). The listing is now in review.', 'বাড়িওয়ালা নিশ্চিত করেছেন (ডেমো)। বিজ্ঞাপনটি এখন যাচাইয়ে।'));
      autoStaffSoon();
    },
    'invite-confirm': el => { const id = el.dataset.id; askOtp(L('Confirm your listing', 'বিজ্ঞাপন নিশ্চিত করুন'), () => { BB.scoutConfirm(id, me().id); toast(L('Confirmed. Our team will check the ownership papers.', 'নিশ্চিত হয়েছে। আমাদের টিম মালিকানার কাগজ দেখবে।')); autoStaffSoon(); go('homes'); }); },
    // Verification
    'v-go': el => { const v = ui.verify; if (el.dataset.s === 'intro' && v.step === 'retry') { v.front = v.back = false; v.selfie = 0; } v.step = el.dataset.s; render(true); },
    'v-doc': el => { ui.verify.docType = el.dataset.t; ui.verify.front = ui.verify.back = false; render(); },
    'v-capture': el => { ui.verify[el.dataset.s] = true; render(); },
    'v-details': () => {
      const v = ui.verify;
      if (!v.name.trim()) throw BB.err('Write your name as on the document.', 'নথিতে লেখা নাম লিখুন।');
      if (!BB.checkDocNumber(v.docType, v.number)) throw BB.err('That document number does not look right.', 'নথির নম্বরটি সঠিক মনে হচ্ছে না।');
      if (!v.dob) throw BB.err('Enter your date of birth.', 'জন্ম তারিখ লিখুন।');
      if (BB.ageOn(v.dob) < 18) throw BB.err('You must be 18 or older to use Basha Bari.', 'বাসাবাড়ি ব্যবহার করতে বয়স ১৮ বা তার বেশি হতে হবে।');
      v.step = 'selfie';
      render(true);
    },
    'v-selfie': () => {
      const v = ui.verify;
      const step = () => { if (ui.verify !== v || v.selfie >= 3) return; v.selfie++; render(); if (v.selfie < 3) setTimeout(step, 1600); };
      if (!v.selfie) step();
    },
    'v-submit': () => {
      const v = ui.verify;
      BB.submitIdCheck(me().id, { docType: v.docType, number: v.number, legalName: v.name.trim(), dob: v.dob });
      ui.verify = null;
      toast(L('Submitted. We usually check within 2 hours.', 'জমা হয়েছে। সাধারণত ২ ঘণ্টার মধ্যে যাচাই করি।'));
      autoStaffSoon();
      render(true);
    },
    'p-house': el => { const u = me(); const v = el.dataset.v; const hh = u.household.includes(v) ? u.household.filter(x => x !== v) : u.household.concat([v]); BB.updateProfile(u.id, { household: hh }); },
    'p-save': () => {
      const u = me();
      const name = document.getElementById('p-name').value.trim();
      if (name.length < 2) throw BB.err('Write your name.', 'নাম লিখুন।');
      const patch = { householdSize: +F.toAscii(document.getElementById('p-size').value) || null, occupation: document.getElementById('p-job').value.trim() };
      if (bn()) patch.name_bn = name; else patch.name_en = name;
      if (!u.seeded) { patch.name_bn = name; patch.name_en = name; }
      BB.updateProfile(u.id, patch);
      toast(L('Saved', 'সংরক্ষিত'));
      history.back();
    },
    logout: () => { session.userId = null; saveSession(); toast(L('Logged out', 'লগ আউট হয়েছে')); go('search'); },
    'delete-account': () => {
      const when28 = day(new Date(Date.now() + 28 * BB.DAY).toISOString());
      confirmSheet(L('Delete your account?', 'অ্যাকাউন্ট মুছবেন?'),
        L('Your profile and listings are hidden now and upcoming viewings are cancelled. Your account is permanently deleted on {d}. Log in before then to cancel. ID documents and contact records are kept encrypted for 6 years for safety and the law, then destroyed.', 'আপনার প্রোফাইল আর বিজ্ঞাপন এখনই লুকানো হবে, আসন্ন বাসা দেখার সময় বাতিল হবে। {d} তারিখে অ্যাকাউন্ট স্থায়ীভাবে মুছে যাবে। এর আগে লগ ইন করলে বাতিল হবে। নিরাপত্তা ও আইনের জন্য আইডির কাগজ আর যোগাযোগের রেকর্ড ৬ বছর এনক্রিপ্ট করে রাখা হয়, তারপর ধ্বংস করা হয়।', { d: esc(when28) }),
        L('Continue', 'চালিয়ে যান'), true,
        () => askOtp(L('Delete account', 'অ্যাকাউন্ট মুছুন'), () => { BB.requestDeletion(me().id); session.userId = null; saveSession(); toast(L('Your account will be deleted on {d}. Log in before then to cancel.', '{d} তারিখে অ্যাকাউন্ট মুছে যাবে। এর আগে লগ ইন করলে বাতিল হবে।', { d: when28 })); go('search'); }));
    },
    'confirm-ok': () => { const s = ui.sheet; ui.sheet = null; renderSheet(); s.onOk(); },
    // Auth
    'auth-send': () => {
      const s = ui.sheet;
      const p = BB.normalisePhone(document.getElementById('auth-phone').value);
      if (!p) { s.error = L('Enter a Bangladeshi mobile number, e.g. 01711000101.', 'বাংলাদেশি মোবাইল নম্বর লিখুন, যেমন 01711000101।'); return renderSheet(); }
      const u = BB.get.userByPhone(p);
      if (u && u.status === 'deleted') { s.error = L('This number cannot be used.', 'এই নম্বর ব্যবহার করা যাবে না।'); return renderSheet(); }
      s.phone = p; s.code = newCode(); s.tries = 0; s.expires = Date.now() + 5 * BB.MIN; s.step = 'code'; s.error = null; s.typed = '';
      sms(L('{c} is your Basha Bari code. It expires in 5 minutes. Never share it.', '{c} আপনার বাসাবাড়ি কোড। ৫ মিনিটে মেয়াদ শেষ। কাউকে বলবেন না।', { c: s.code }));
      renderSheet();
      setTimeout(() => { const el = document.getElementById('auth-code'); if (el) el.focus(); }, 60);
    },
    'auth-fill': () => { ui.sheet.typed = ui.sheet.code; renderSheet(); },
    'auth-resend': () => { const s = ui.sheet; s.code = newCode(); s.tries = 0; s.expires = Date.now() + 5 * BB.MIN; sms(L('{c} is your Basha Bari code. It expires in 5 minutes. Never share it.', '{c} আপনার বাসাবাড়ি কোড। ৫ মিনিটে মেয়াদ শেষ। কাউকে বলবেন না।', { c: s.code })); },
    'auth-back': () => { ui.sheet.step = 'phone'; renderSheet(); },
    'auth-verify': () => {
      const s = ui.sheet;
      const typed = F.toAscii(document.getElementById('auth-code').value.trim());
      if (Date.now() > s.expires) { s.error = L('The code expired. Send a new one.', 'কোডের মেয়াদ শেষ। নতুন কোড নিন।'); return renderSheet(); }
      if (typed !== s.code) { s.tries++; s.error = s.tries >= 5 ? L('Too many tries. Send a new code.', 'অনেকবার ভুল। নতুন কোড নিন।') : L('That code is not right. {n} tries left.', 'কোডটি ঠিক নয়। আর {n} বার চেষ্টা করা যাবে।', { n: 5 - s.tries }); if (s.tries >= 5) s.expires = 0; return renderSheet(); }
      const u = BB.get.userByPhone(s.phone);
      if (u) return signedIn(u, false);
      s.step = 'name'; s.error = null; renderSheet();
    },
    'auth-create': () => {
      const s = ui.sheet;
      const name = document.getElementById('auth-name').value.trim();
      if (name.length < 2) { s.error = L('Write your name.', 'আপনার নাম লিখুন।'); return renderSheet(); }
      if (!document.getElementById('auth-terms').checked) { s.error = L('Please agree to the terms and privacy policy.', 'শর্ত ও গোপনীয়তা নীতিতে রাজি হোন।'); return renderSheet(); }
      const u = BB.createUser({ phone: s.phone, name, lang: lang() });
      signedIn(u, true);
    },
    'otp-fill': () => { ui.sheet.typed = ui.sheet.code; renderSheet(); },
    'otp-ok': () => {
      const s = ui.sheet;
      const typed = F.toAscii(document.getElementById('otp-code').value.trim());
      if (typed !== s.code) { s.tries++; s.error = L('That code is not right.', 'কোডটি ঠিক নয়।'); return renderSheet(); }
      ui.sheet = null; renderSheet();
      s.onOk();
    },
    // Demo
    demo: () => { ui.sheet = { type: 'demo' }; renderSheet(); },
    'demo-as': el => {
      const u = BB.get.user(el.dataset.id);
      session.userId = u.id; session.onboarded = true; saveSession();
      const r = BB.loggedIn(u.id);
      ui.sheet = null; ui.verify = null; ui.wizard = null; ui.movein = null;
      toast(r.cancelled ? L('Logged in as {n}. Their pending deletion was cancelled.', '{n} হিসেবে লগ ইন। মোছার অনুরোধ বাতিল হয়েছে।', { n: nm(u) }) : L('You are now {n}', 'এখন আপনি {n}', { n: nm(u) }));
      if (route().name === 'search') render(); else go('search');
    },
    'demo-guest': () => { session.userId = null; saveSession(); ui.sheet = null; toast(L('Browsing as a guest', 'অতিথি হিসেবে দেখছেন')); go('search'); },
    'demo-toggle': el => { const k = el.dataset.k; BB.setSetting('s1', k, !S().settings[k]); if (k === 'autoApprove' && S().settings.autoApprove) autoStaffSoon(); },
    'demo-reset': () => confirmSheet(L('Reset the demo?', 'ডেমো রিসেট করবেন?'), L('All demo data goes back to the start: 20 homes, 5 renters, 10 landlords, 2 scouts.', 'সব ডেমো তথ্য শুরুর অবস্থায় ফিরে যাবে: ২০টি বাসা, ৫ জন ভাড়াটিয়া, ১০ জন বাড়িওয়ালা, ২ জন স্কাউট।'), L('Reset', 'রিসেট'), true, () => {
      BB.reset();
      session = { lang: lang(), onboarded: true, userId: null, made: [] }; saveSession();
      ui.f = BB.defaultFilters(); ui.wizard = null; ui.verify = null; ui.movein = null;
      toast(L('Demo reset', 'ডেমো রিসেট হয়েছে')); go('search');
    }),
    'demo-founders': () => {
      let n = 0;
      for (const a of S().advances.filter(x => (x.status === 'held' || x.status === 'disputed') && (x.releaseDue || x.status === 'disputed'))) {
        if (!BB.payoutsOf(a.id).length) BB.preparePayout('s2', a.id, a.status === 'disputed' ? 'refund' : 'release', 'Demo shortcut');
        for (const p of BB.payoutsOf(a.id).filter(x => !x.approvedBy)) { BB.approvePayout(p.preparedBy === 's1' ? 's2' : 's1', p.id); n++; }
      }
      toast(n ? L('Both founders approved {n} payout(s) (demo shortcut).', 'দুই প্রতিষ্ঠাতা {n}টি পেমেন্ট অনুমোদন করেছেন (ডেমো শর্টকাট)।', { n }) : L('Nothing is waiting for a payout.', 'কোনো পেমেন্ট অপেক্ষায় নেই।'));
    },
  };
  function confirmSheet(title, body, ok, danger, onOk) { ui.sheet = { type: 'confirm', title, body, ok, danger, onOk }; renderSheet(); }
  function saveFilters() { session.filters = Object.assign({}, ui.f, { bounds: null }); saveSession(); }

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-a]');
    if (!el || el.disabled) return;
    const fn = A[el.dataset.a];
    if (!fn) return;
    e.preventDefault();
    run(() => fn(el, e));
  });

  // ───────────── Typing and toggles ─────────────
  const IN = {
    q: el => {
      ui.q = el.value;
      ui.suggest = BB.searchAreas(el.value);
      ui.suggestOpen = true;
      const box = el.parentElement;
      let sg = box.querySelector('.suggest');
      const html = ui.suggest.length ? ui.suggest.map(a => `<button data-a="pick-area" data-id="${a.id}">${I('pin', 18)}<span class="grow"><b>${esc(areaName(a))}</b><br><span class="tiny muted">${esc(a.parent ? areaName(BB.area(a.parent)) : '')}${BB.areaChildren(a.id).length ? ' · ' + L('includes {n} areas', '{n}টি এলাকা সহ', { n: BB.areaChildren(a.id).length }) : ''}</span></span></button>`).join('') : '';
      if (!html) { if (sg) sg.remove(); return; }
      if (!sg) { sg = document.createElement('div'); sg.className = 'suggest'; box.appendChild(sg); }
      sg.innerHTML = html;
    },
    sort: el => { ui.f.sort = el.value; saveFilters(); render(); },
    fnum: el => { const v = F.toAscii(el.value).replace(/\D/g, ''); ui.f[el.dataset.k] = v ? +v : null; saveFilters(); updateFilterCount(); },
    fdate: el => { ui.f[el.dataset.k] = el.value || null; saveFilters(); updateFilterCount(); },
    fcheck: el => { ui.f[el.dataset.k] = el.checked; saveFilters(); updateFilterCount(); },
    ftext: el => { ui.f[el.dataset.k] = el.value; saveFilters(); updateFilterCount(); },
    draft: el => { ui.drafts = ui.drafts || {}; ui.drafts[el.dataset.id] = el.value; el.style.height = 'auto'; el.style.height = Math.min(120, el.scrollHeight) + 'px'; },
    'auth-phone': el => { ui.sheet.phone = el.value; },
    'auth-code': el => { ui.sheet.typed = el.value; if (F.toAscii(el.value).length === 6) A['auth-verify'](); },
    'auth-name': el => { ui.sheet.name = el.value; },
    'auth-terms': el => { ui.sheet.terms = el.checked; },
    'otp-code': el => { ui.sheet.typed = el.value; if (F.toAscii(el.value).length === 6) run(() => A['otp-ok']()); },
    dealf: el => { ui.sheet[el.dataset.k] = el.value; },
    'rep-reason': el => { ui.sheet.reason = el.dataset.v; renderSheet(); },
    'rep-details': el => { ui.sheet.details = el.value; },
    'pr-reason': el => { ui.sheet.reason = el.dataset.v; renderSheet(); },
    movein: el => { ui.movein[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value; },
    busy: el => BB.updateProfile(me().id, { busyToday: el.checked }),
    w: el => { ui.wizard.d[el.dataset.k] = el.value; saveDraft(); },
    wbool: el => { ui.wizard.d[el.dataset.k] = el.checked; saveDraft(); },
    'w-area': el => {
      const d = ui.wizard.d;
      d.areaQ = el.value; d.areaId = null; saveDraft();
      const holder = el.closest('.stack');
      let list = holder.querySelector('.list');
      const sug = BB.searchAreas(el.value).slice(0, 6);
      const html = sug.map(x => `<button data-a="w-area-pick" data-id="${x.id}">${I('pin', 16)} ${esc(areaName(x))} <span class="tiny muted">${esc(areaName(BB.area(x.parent)))}</span></button>`).join('');
      if (!html) { if (list) list.remove(); return; }
      if (!list) { list = document.createElement('div'); list.className = 'list panel'; list.style.padding = '0'; el.closest('label').after(list); }
      list.innerHTML = html;
    },
    v: el => { ui.verify[el.dataset.k] = el.value; },
    'v-consent': el => { ui.verify.consent = el.checked; render(); },
  };
  function updateFilterCount() { const b = document.getElementById('fcount'); if (b) { const n = BB.search(ui.f).length; b.textContent = L('Show {n} homes', '{n}টি বাসা দেখুন', { n: n > 1000 ? '1,000+' : n }); } }
  function onInput(e) {
    const el = e.target.closest('[data-in]');
    if (!el) return;
    const fn = IN[el.dataset.in];
    if (!fn) return;
    if (e.type === 'change' && /text|search|tel|textarea/.test(el.type || el.tagName.toLowerCase()) && el.dataset.in !== 'sort') return;
    run(() => fn(el, e));
  }
  document.addEventListener('input', onInput);
  document.addEventListener('change', e => { const el = e.target.closest('[data-in]'); if (el && (el.type === 'checkbox' || el.type === 'radio' || el.type === 'date' || el.tagName === 'SELECT')) onInput(e); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.id === 'q') {
      const first = ui.suggest[0];
      if (first) A['pick-area']({ dataset: { id: first.id } });
      else { ui.f.keywords = e.target.value; ui.q = ''; ui.suggestOpen = false; saveFilters(); render(); }
    }
    if (e.key === 'Enter' && !e.shiftKey && e.target.id === 'msg') { e.preventDefault(); const b = document.querySelector('[data-a="send"]'); if (b) b.click(); }
    if (e.key === 'Escape' && (ui.sheet || ui.viewer)) { ui.sheet = null; ui.viewer = null; renderSheet(); }
  });
  document.addEventListener('focusin', e => { if (e.target.id === 'q' && ui.q) { ui.suggest = BB.searchAreas(ui.q); } });
  document.addEventListener('click', e => { if (!e.target.closest('.searchbox') && ui.suggestOpen) { ui.suggestOpen = false; const sg = document.querySelector('.suggest'); if (sg) sg.remove(); } }, true);
  // Photo counters on swipe.
  document.addEventListener('scroll', e => {
    const tr = e.target;
    if (!tr.classList || !tr.classList.contains('track')) return;
    const n = Math.round(tr.scrollLeft / Math.max(1, tr.clientWidth)) + 1;
    const c = tr.parentElement.querySelector('.count .n');
    if (c) c.textContent = num(n);
  }, true);

  // ───────────── Maps: MapLibre + OpenFreeMap when online, a drawn map when offline ─────────────
  const MAP = { loading: null, failed: false, search: null, el: null, markers: [], minis: [], wiz: null };
  const STYLE = 'https://tiles.openfreemap.org/styles/liberty';
  function webgl() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } }
  function loadMapLib() {
    if (window.maplibregl) return Promise.resolve(window.maplibregl);
    if (MAP.failed || !webgl() || !navigator.onLine) { MAP.failed = true; return Promise.reject(new Error('offline')); }
    if (!MAP.loading) {
      MAP.loading = new Promise((res, rej) => {
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
        document.head.appendChild(css);
        const s = document.createElement('script');
        s.src = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js';
        const timer = setTimeout(() => { MAP.failed = true; rej(new Error('timeout')); }, 9000);
        s.onload = () => { clearTimeout(timer); if (window.maplibregl) res(window.maplibregl); else { MAP.failed = true; rej(new Error('no lib')); } };
        s.onerror = () => { clearTimeout(timer); MAP.failed = true; rej(new Error('offline')); };
        document.head.appendChild(s);
      });
    }
    return MAP.loading;
  }
  function priceShort(n) { return money(n); }
  function quietSprites(m) { m.on('styleimagemissing', e => { if (!m.hasImage(e.id)) m.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) }); }); }
  function mapRows() { return BB.search(Object.assign({}, ui.f, { bounds: null })); }
  function mountSearchMap() {
    const slot = document.getElementById('mapslot');
    if (!slot) return;
    if (!MAP.el) {
      MAP.el = document.createElement('div');
      MAP.el.className = 'mapwrap';
      MAP.el.style.height = '100%';
      MAP.el.innerHTML = `<div class="mapbox" id="mapbox"></div><div class="maptoggle" id="maptoggle"></div><div id="mapcard"></div>`;
    }
    slot.appendChild(MAP.el);
    renderMapToggle();
    if (MAP.search) { MAP.search.resize(); drawSearchMarkers(); return; }
    loadMapLib().then(ml => {
      if (MAP.search) return;
      MAP.search = new ml.Map({ container: MAP.el.querySelector('#mapbox'), style: STYLE, center: [90.385, 23.805], zoom: 11.2, attributionControl: { compact: true } });
      MAP.search.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right');
      quietSprites(MAP.search);
      MAP.search.on('load', drawSearchMarkers);
      MAP.search.on('zoomend', drawSearchMarkers);
      MAP.search.on('moveend', () => {
        if (!ui.mapMove) return;
        const b = MAP.search.getBounds();
        ui.f.bounds = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
        renderMapToggle();
      });
      const a = ui.f.areaIds[0] && BB.area(ui.f.areaIds[0]);
      if (a) MAP.search.jumpTo({ center: [a.lng, a.lat], zoom: BB.areaChildren(a.id).length ? 13 : 14.2 });
    }).catch(() => { drawFallbackSearch(); });
  }
  function renderMapToggle() {
    const t = MAP.el && MAP.el.querySelector('#maptoggle');
    if (!t) return;
    const n = BB.search(Object.assign({}, ui.f, { bounds: ui.mapMove ? ui.f.bounds : null })).length;
    t.innerHTML = MAP.search ? `<label class="check" style="align-items:center"><input type="checkbox" id="mapmove" ${ui.mapMove ? 'checked' : ''}><span>${L('Search as I move the map', 'ম্যাপ সরালে খুঁজুন')}</span></label><b>${num(n)}</b>` : `<span>${L('Offline map (simplified)', 'অফলাইন ম্যাপ (সরল)')}</span>`;
    const cb = t.querySelector('#mapmove');
    if (cb) cb.onchange = () => { ui.mapMove = cb.checked; if (!cb.checked) ui.f.bounds = null; else { const b = MAP.search.getBounds(); ui.f.bounds = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]; } renderMapToggle(); };
  }
  function drawSearchMarkers() {
    if (!MAP.search || !window.maplibregl) return;
    for (const m of MAP.markers) m.remove();
    MAP.markers = [];
    const rows = mapRows();
    const z = MAP.search.getZoom();
    if (z < 13.2) {
      const cell = 80 / Math.pow(2, z);
      const groups = {};
      for (const v of rows) { const k = Math.floor(v.p.pub.lng / cell) + ':' + Math.floor(v.p.pub.lat / cell); (groups[k] = groups[k] || []).push(v); }
      for (const g of Object.values(groups)) {
        const lng = g.reduce((s, v) => s + v.p.pub.lng, 0) / g.length, lat = g.reduce((s, v) => s + v.p.pub.lat, 0) / g.length;
        const el = document.createElement('div');
        if (g.length === 1) { el.className = 'pin' + (g[0].l.status === 'let_agreed' ? ' let' : ''); el.textContent = priceShort(g[0].total); el.onclick = ev => { ev.stopPropagation(); showMapCard(g[0].l.id); }; }
        else { el.className = 'pin cluster'; el.textContent = L('{n} homes from {p}', '{n}টি বাসা, {p} থেকে', { n: g.length, p: priceShort(Math.min(...g.map(v => v.total))) }); el.onclick = ev => { ev.stopPropagation(); MAP.search.flyTo({ center: [lng, lat], zoom: Math.min(16, z + 2) }); }; }
        MAP.markers.push(new window.maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(MAP.search));
      }
    } else {
      for (const v of rows) {
        const el = document.createElement('div');
        el.className = 'pin' + (ui.pin === v.l.id ? ' on' : '') + (v.l.status === 'let_agreed' ? ' let' : '');
        el.textContent = priceShort(v.total);
        el.onclick = ev => { ev.stopPropagation(); showMapCard(v.l.id); };
        MAP.markers.push(new window.maplibregl.Marker({ element: el }).setLngLat([v.p.pub.lng, v.p.pub.lat]).addTo(MAP.search));
      }
    }
    renderMapToggle();
  }
  function showMapCard(id) {
    ui.pin = id;
    const v = BB.view(BB.get.listing(id));
    const box = MAP.el.querySelector('#mapcard');
    box.innerHTML = `<div class="mapcard" data-a="open" data-id="${id}"><img src="${photoSrc(v.l, v.l.photos[0])}" alt=""><div class="grow"><div class="price" style="font-size:17px">${money(v.l.rent)}</div><div class="tiny muted">${L('{t} a month in total', 'মাসে মোট {t}', { t: money(v.total) })}</div><div class="small ellipsis"><b>${esc(BB.title(v.l, lang()))}</b></div><div class="facts" style="margin:4px 0 0">${factsLine(v.l)}</div></div></div>`;
    if (MAP.search) for (const m of MAP.markers) { const e = m.getElement(); e.classList.toggle('on', e.textContent === priceShort(v.total) && Math.abs(m.getLngLat().lng - v.p.pub.lng) < 1e-6); }
  }
  function drawFallbackSearch() {
    const box = MAP.el.querySelector('#mapbox');
    const W = box.clientWidth || 360, H = box.clientHeight || 520;
    const labels = BB.AREAS.filter(a => a.parent === 1).map(a => ({ lat: a.lat, lng: a.lng, label: areaName(a) }));
    let html = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="position:absolute;inset:0">${ART.fallbackMap(W, H, labels)}</svg>`;
    for (const v of mapRows()) {
      const p = ART.project(v.p.pub.lat, v.p.pub.lng, W, H);
      html += `<div class="pin" style="left:${p.x}px;top:${p.y}px" data-pin="${v.l.id}">${esc(priceShort(v.total))}</div>`;
    }
    box.innerHTML = html;
    box.onclick = e => { const p = e.target.closest('[data-pin]'); if (p) showMapCard(p.dataset.pin); };
    renderMapToggle();
  }
  function flyToArea(id) { const a = BB.area(id); if (MAP.search && a) MAP.search.flyTo({ center: [a.lng, a.lat], zoom: BB.areaChildren(id).length ? 13 : 14.2 }); }
  function circle(lng, lat, m) {
    const pts = [];
    for (let i = 0; i <= 48; i++) { const t = (i / 48) * 2 * Math.PI; pts.push([lng + (m * Math.sin(t)) / (111320 * Math.cos((lat * Math.PI) / 180)), lat + (m * Math.cos(t)) / 111320]); }
    return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [pts] } };
  }
  function destroyMinis() { for (const m of MAP.minis) { try { m.remove(); } catch (e) { /* ignore */ } } MAP.minis = []; MAP.wiz = null; }
  function mini(elId, center, opts) {
    const el = document.getElementById(elId);
    if (!el) return;
    const fallback = () => {
      const W = el.clientWidth || 340, H = el.clientHeight || 190;
      const a = BB.AREAS.filter(x => x.parent === 1).map(x => ({ lat: x.lat, lng: x.lng, label: areaName(x) }));
      const p = ART.project(center.lat, center.lng, W, H);
      el.innerHTML = `<svg viewBox="0 0 ${W} ${H}">${ART.fallbackMap(W, H, a)}${opts.circle ? `<circle cx="${p.x}" cy="${p.y}" r="22" fill="#0f7a5a" fill-opacity=".18" stroke="#0f7a5a" stroke-width="2"/>` : ''}${opts.marker ? `<circle cx="${p.x}" cy="${p.y}" r="7" fill="#c0392b" stroke="#fff" stroke-width="2"/>` : ''}</svg><span class="map-attrib">${L('Offline map', 'অফলাইন ম্যাপ')}</span>`;
      if (opts.onPick) el.onclick = () => opts.onPick({ lat: center.lat, lng: center.lng });
    };
    loadMapLib().then(ml => {
      if (!document.body.contains(el)) return;
      const m = new ml.Map({ container: el, style: STYLE, center: [center.lng, center.lat], zoom: opts.zoom || 14.3, interactive: !!opts.interactive, attributionControl: { compact: true } });
      quietSprites(m);
      MAP.minis.push(m);
      if (opts.onPick) MAP.wiz = m;
      let mk = null;
      m.on('load', () => {
        if (opts.circle) {
          m.addSource('c', { type: 'geojson', data: circle(center.lng, center.lat, 330) });
          m.addLayer({ id: 'cf', type: 'fill', source: 'c', paint: { 'fill-color': '#0f7a5a', 'fill-opacity': 0.18 } });
          m.addLayer({ id: 'cl', type: 'line', source: 'c', paint: { 'line-color': '#0f7a5a', 'line-width': 2 } });
        }
        if (opts.marker) mk = new ml.Marker({ color: '#c0392b' }).setLngLat([center.lng, center.lat]).addTo(m);
      });
      if (opts.onPick) {
        m.on('click', e => {
          if (mk) mk.remove();
          mk = new ml.Marker({ color: '#c0392b' }).setLngLat(e.lngLat).addTo(m);
          opts.onPick({ lat: +e.lngLat.lat.toFixed(6), lng: +e.lngLat.lng.toFixed(6) });
        });
      }
    }).catch(fallback);
  }
  function mountListingMap(id) { const l = BB.get.listing(id); if (!l) return; const p = BB.get.property(l.propertyId); mini('minimap', p.pub, { circle: true, zoom: 14.2 }); }
  function mountRecordMap(id) { const r = BB.get.record(id); if (r) mini('recmap', r.snapshot.home.exact, { marker: true, zoom: 15.5 }); }
  function mountWizardMap() {
    const w = ui.wizard;
    if (!w || !document.getElementById('wizmap')) return;
    const d = w.d;
    const a = d.areaId ? BB.area(d.areaId) : BB.area(1);
    const c = d.exact || { lat: a.lat, lng: a.lng };
    mini('wizmap', c, { interactive: true, marker: !!d.exact, zoom: d.areaId ? 15 : 11.5, onPick: pt => { d.exact = pt; saveDraft(); toast(L('Pin set on the building', 'ভবনের উপর পিন দেওয়া হয়েছে')); } });
  }

  // ───────────── Demo helpers: landlords who reply, and optional auto-approval ─────────────
  const BOT_LINES = {
    first: ['Yes, it is still available. Suggest a time if you would like to see it.', 'জি, বাসাটি এখনও খালি আছে। দেখতে চাইলে সময় প্রস্তাব করুন।'],
    again: ['Sure, no problem.', 'জি, ঠিক আছে।'],
    renter: ['Thank you. When can I come to see it?', 'ধন্যবাদ। কবে দেখতে আসতে পারি?'],
    viewing: ['That time works. See you then.', 'ঠিক আছে, ওই সময়ে চলে আসুন।'],
    deal: ['Confirmed. Welcome!', 'নিশ্চিত করলাম। স্বাগতম!'],
    acct: ['I have added my bank account for the advance.', 'অগ্রিমের জন্য আমার ব্যাংক অ্যাকাউন্ট যোগ করেছি।'],
  };
  function botAfter(convId, delay) {
    if (!S().settings.autoReplies) return;
    setTimeout(() => run(() => botStep(convId)), delay || 1500 + Math.random() * 1200);
  }
  function botSay(c, other, key) {
    const line = BOT_LINES[key];
    BB.sendMessage(c.id, other.id, other.lang === 'en' ? line[0] : line[1]);
  }
  function botStep(convId) {
    const c = BB.get.conv(convId);
    const u = me();
    if (!c || !u || (u.id !== c.renterId && u.id !== c.landlordId) || c.stage === 'closed') return;
    const otherId = u.id === c.renterId ? c.landlordId : c.renterId;
    const other = BB.get.user(otherId);
    if (!other || !other.seeded || other.status !== 'active') return;
    const botIsLandlord = otherId === c.landlordId;
    const v = BB.latestViewing(convId);
    const rec = BB.recordOf(convId);
    const d = BB.dealOf(convId);
    const again = () => botAfter(convId, 1800);
    if (v && v.status === 'proposed' && v.proposedBy === u.id) { BB.acceptViewing(v.id, otherId, v.slots[0]); botSay(c, other, 'viewing'); return again(); }
    if (v && v.status === 'accepted' && !rec) {
      const cons = BB.consentsOf(convId).filter(x => x.viewingId === v.id);
      if (cons.some(x => x.userId === u.id) && !cons.some(x => x.userId === otherId)) { BB.shareDetails(convId, otherId); return again(); }
    }
    if (d && d.status === 'proposed' && d.proposedBy === u.id) { BB.confirmDeal(d.id, otherId); botSay(c, other, 'deal'); return again(); }
    if (d && d.method === 'direct' && !d.paidDirectlyAt) {
      const mine = u.id === c.renterId ? 'renter' : 'landlord', theirs = mine === 'renter' ? 'landlord' : 'renter';
      if (d.paidConfirm[mine] && !d.paidConfirm[theirs]) { BB.confirmPaidDirect(d.id, otherId); return again(); }
    }
    const a = d && BB.advanceOf(d.id);
    if (a && botIsLandlord && !BB.approvedPayoutAccount(otherId) && !BB.pendingPayoutAccount(otherId)) {
      BB.addPayoutAccount(otherId, { accountName: other.legalName || other.name_en, accountNo: '2050100' + other.phone.slice(-6), bank: 'Demo Bank PLC', routing: '000261726' });
      botSay(c, other, 'acct');
      autoStaffSoon();
      return;
    }
    if (a && !botIsLandlord) {
      if (a.status === 'awaiting_payment' && !a.renterSentAt) { BB.markSent(a.id, otherId); autoStaffSoon(); return; }
      if (a.status === 'held' && !d.moveInCheck) { BB.saveMoveIn(d.id, otherId, { keys: true, elec: '01234', gas: '', water: '0456', notes: '', photos: 2 }); return; }
    }
    if (d && d.moveInCheck && !d.moveInCheck.landlordAt && botIsLandlord) { BB.confirmHandover(d.id, otherId); return; }
    const msgs = BB.messagesOf(convId).filter(m => !m.system);
    const last = msgs[msgs.length - 1];
    if (last && last.senderId === u.id) {
      const said = msgs.filter(m => m.senderId === otherId).length;
      botSay(c, other, botIsLandlord ? (said ? 'again' : 'first') : 'renter');
    }
  }
  let autoTimer = null;
  function autoStaffSoon() { if (!S().settings.autoApprove) return; clearTimeout(autoTimer); autoTimer = setTimeout(() => run(autoStaff), 3500); }
  function autoStaff() {
    if (!S().settings.autoApprove) return;
    for (const k of S().idChecks.filter(x => x.status === 'pending' && !BB.get.user(x.userId).seeded)) BB.reviewIdCheck('s2', k.id, true);
    for (const l of S().listings.filter(x => x.status === 'in_review' && !BB.get.user(x.listerId).seeded)) BB.reviewListing('s2', l.id, true);
    for (const l of S().listings.filter(x => x.status === 'in_review' && x.scoutId && S().scoutSubs.some(s => s.listingId === x.id && s.invitedAt > S().seededAt))) BB.reviewListing('s2', l.id, true);
    for (const p of S().payoutAccounts.filter(x => x.status === 'pending' && x.createdAt > S().seededAt)) BB.reviewPayoutAccount('s2', p.id, true);
    const lines = BB.demoStatementLines();
    if (lines.length) BB.importLines('s2', lines);
  }

  // ───────────── Demo panel (desktop side panel and the demo sheet on phones) ─────────────
  function walkthrough() {
    const u = me();
    const mine = u ? S().conversations.filter(c => c.renterId === u.id) : [];
    const anyV = mine.some(c => BB.viewingsOf(c.id).some(v => v.status === 'accepted' || v.status === 'done'));
    const anyR = mine.some(c => BB.recordOf(c.id));
    const deals = mine.map(c => BB.dealOf(c.id)).filter(Boolean);
    const anyD = deals.some(d => d.status === 'confirmed');
    const advs = deals.map(d => BB.advanceOf(d.id)).filter(Boolean);
    const steps = [
      [L('Search as a guest (list and map)', 'অতিথি হিসেবে খুঁজুন (তালিকা ও ম্যাপ)'), !!ui.seen.search],
      [L('Sign up with phone + OTP', 'ফোন + ওটিপি দিয়ে সাইন আপ'), !!u],
      [L('Verify ID: NID + selfie', 'আইডি যাচাই: এনআইডি + সেলফি'), !!(u && BB.latestIdCheck(u.id))],
      [L('ID approved in the admin website', 'অ্যাডমিন ওয়েবসাইটে আইডি অনুমোদন'), !!(u && u.level >= 2)],
      [L('Message a landlord', 'বাড়িওয়ালাকে বার্তা'), mine.length > 0],
      [L('Agree a viewing time', 'দেখার সময় ঠিক করুন'), anyV],
      [L('Both share details → identical record', 'দুজনে তথ্য শেয়ার → একই রেকর্ড'), anyR],
      [L('Confirm the deal with OTP', 'ওটিপি দিয়ে চুক্তি নিশ্চিত'), anyD],
      [L('Protected advance: bank transfer, held', 'সুরক্ষিত অগ্রিম: ব্যাংক ট্রান্সফার, জমা'), advs.some(a => ['held', 'released', 'refunded', 'disputed'].includes(a.status))],
      [L('Move in: keys and meter readings', 'বাসায় ওঠা: চাবি ও মিটার রিডিং'), deals.some(d => d.moveInCheck)],
      [L('Two founders approve the payout', 'দুই প্রতিষ্ঠাতা পেমেন্ট অনুমোদন'), advs.some(a => a.status === 'released')],
    ];
    return `<ol class="walk">${steps.map(([t, done]) => `<li class="${done ? 'done' : ''}"><span class="tick">${done ? I('check', 12) : ''}</span><span>${esc(t)}</span></li>`).join('')}</ol>`;
  }
  function demoPanel(inSheet) {
    const u = me();
    const st = S().settings;
    const group = (title, kind) => `<div class="tiny muted" style="margin:10px 0 4px;font-weight:700">${esc(title)}</div>${S().users.filter(x => x.kind === kind && x.status !== 'deleted').map(x => `<button class="acct ${u && u.id === x.id ? 'on' : ''}" data-a="demo-as" data-id="${x.id}"><img class="avatar xs" src="${ART.avatar(x.avatar)}" alt=""><span class="grow ellipsis">${esc(nm(x))}</span>${x.level >= 2 ? `<span class="badge ok" style="height:18px">${I('check', 11)}</span>` : `<span class="badge" style="height:18px">${L('L1', 'ধাপ ১')}</span>`}${x.status === 'deletion_pending' ? `<span class="badge warn" style="height:18px">${L('deleting', 'মোছা হচ্ছে')}</span>` : ''}</button>`).join('')}`;
    const made = S().users.filter(x => (session.made || []).includes(x.id) && x.status !== 'deleted');
    return `<div class="${inSheet ? '' : 'side-card'}"><h3>${L('From sign-up to moving in', 'সাইন আপ থেকে বাসায় ওঠা')}</h3>${walkthrough()}</div>
      <div class="${inSheet ? '' : 'side-card'}" style="${inSheet ? 'margin-top:16px' : ''}"><h3>${L('Switch person', 'ব্যক্তি বদলান')}</h3><button class="acct ${!u ? 'on' : ''}" data-a="demo-guest">${I('user', 18)} <span class="grow">${L('Guest (not signed in)', 'অতিথি (সাইন ইন নয়)')}</span></button>
        ${made.length ? `<div class="tiny muted" style="margin:10px 0 4px;font-weight:700">${L('Accounts you created', 'আপনার খোলা অ্যাকাউন্ট')}</div>${made.map(x => `<button class="acct ${u && u.id === x.id ? 'on' : ''}" data-a="demo-as" data-id="${x.id}"><img class="avatar xs" src="${ART.avatar(x.avatar)}" alt=""><span class="grow ellipsis">${esc(nm(x))}</span></button>`).join('')}` : ''}
        ${group(L('Renters (5)', 'ভাড়াটিয়া (৫)'), 'renter')}${group(L('Landlords (10)', 'বাড়িওয়ালা (১০)'), 'landlord')}${group(L('Scouts (2)', 'স্কাউট (২)'), 'scout')}</div>
      <div class="${inSheet ? '' : 'side-card'}" style="${inSheet ? 'margin-top:16px' : ''}"><h3>${L('Demo settings', 'ডেমো সেটিংস')}</h3>
        <label class="check" style="margin-bottom:8px"><input type="checkbox" data-a="demo-toggle" data-k="autoReplies" ${st.autoReplies ? 'checked' : ''}><span class="small">${L('Demo people reply and act by themselves', 'ডেমোর মানুষেরা নিজে থেকে উত্তর দেন ও কাজ করেন')}</span></label>
        <label class="check" style="margin-bottom:8px"><input type="checkbox" data-a="demo-toggle" data-k="autoApprove" ${st.autoApprove ? 'checked' : ''}><span class="small">${L('Auto-approve IDs, listings, bank accounts and bank statements (so you can demo on one phone)', 'আইডি, বিজ্ঞাপন, ব্যাংক অ্যাকাউন্ট ও স্টেটমেন্ট নিজে থেকে অনুমোদন (এক ফোনে ডেমোর জন্য)')}</span></label>
        <button class="btn soft sm block" style="margin-bottom:8px" data-a="demo-founders">${I('users', 15)} ${L('Act as both founders: approve waiting payouts', 'দুই প্রতিষ্ঠাতা হিসেবে অপেক্ষমাণ পেমেন্ট অনুমোদন')}</button>
        <a class="btn plain sm block" style="margin-bottom:8px" href="admin.html" target="_blank" rel="noopener">${I('grid', 15)} ${L('Open the admin website', 'অ্যাডমিন ওয়েবসাইট খুলুন')}</a>
        <button class="btn danger ghost sm block" data-a="demo-reset">${I('refresh', 15)} ${L('Reset all demo data', 'সব ডেমো তথ্য রিসেট')}</button>
        <p class="tiny muted" style="margin-top:8px">${BB.isShared() ? L('Live: shared with other devices on this Wi-Fi.', 'লাইভ: এই ওয়াই-ফাইয়ের অন্য ডিভাইসের সাথে শেয়ার হচ্ছে।') : L('Saved in this browser. Run "node server.js" to share live between a phone and a laptop.', 'এই ব্রাউজারে সংরক্ষিত। ফোন আর ল্যাপটপে একসাথে লাইভ দেখতে "node server.js" চালান।')}</p></div>`;
  }
  function renderSide() {
    if ($side && getComputedStyle($side).display !== 'none') $side.innerHTML = demoPanel(false);
    let fab = document.getElementById('demofab');
    if (!fab) {
      fab = document.createElement('button');
      fab.id = 'demofab';
      fab.className = 'demo-fab';
      fab.dataset.a = 'demo';
      fab.setAttribute('aria-label', 'Demo controls');
      document.getElementById('phone').appendChild(fab);
    }
    fab.textContent = 'DEMO';
    const sideOn = $side && getComputedStyle($side).display !== 'none';
    fab.style.display = session.onboarded && !sideOn ? '' : 'none';
  }
  document.addEventListener('change', e => { if (e.target.matches('[data-a="demo-toggle"]')) { /* handled by click */ } });

  // ───────────── Wiring ─────────────
  const SCREENS = {
    search: scrSearch, listing: scrListing, saved: scrSaved, messages: scrMessages, chat: scrChat, record: scrRecord, v: scrVerifyRecord, deal: scrDeal, advance: scrAdvance,
    homes: scrHomes, post: () => scrPost('owner'), scoutnew: () => scrPost('scout'), scout: scrScout, invite: scrInvite, account: scrAccount, profile: scrProfile, verify: scrVerify,
    notifications: scrNotifications, page: scrPage,
  };
  let pending = false;
  BB.subscribe(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      const a = document.activeElement;
      const typing = a && /INPUT|TEXTAREA/.test(a.tagName) && a.type !== 'checkbox' && a.type !== 'radio' && $sheet.contains(a);
      if (typing) { renderSide(); return; }
      render();
    });
  });
  window.addEventListener('hashchange', () => { ui.sheet = null; ui.viewer = null; ui.room = 'all'; render(true); });
  const clock = document.getElementById('clock');
  if (clock) { const tick = () => { clock.textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dhaka' }); }; tick(); setInterval(tick, 30000); }
  setInterval(() => { if (route().name === 'chat' && !ui.sheet) { /* keep relative times fresh */ } }, 60000);
  render(true);
  BB.connect();
  const r0 = route();
  if (r0.name === 'chat' && r0.args[0]) botAfter(r0.args[0], 900);
  window.addEventListener('hashchange', () => { const r = route(); if (r.name === 'chat' && r.args[0]) botAfter(r.args[0], 900); });
})();
