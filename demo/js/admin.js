/*
 * Basha Bari demo: the admin website for the two founders (web only, never in the app).
 * Both founders see everything. Personal data is masked until a reason is typed, and every
 * reveal, document view and decision goes into the hash-chained audit log.
 */
(function () {
  'use strict';
  const F = BB.fmt, I = ART.icon, esc = ART.esc;
  BB.load();
  const S = () => BB.state();
  const SKEY = 'bb.demo.session.admin';
  let session = (() => { try { return JSON.parse(BB.local.getItem(SKEY)) || {}; } catch (e) { return {}; } })();
  const saveSession = () => { try { BB.local.setItem(SKEY, JSON.stringify(session)); } catch (e) { /* ignore */ } };
  const staff = () => (session.staffId ? BB.get.staff(session.staffId) : null);
  const ui = { page: location.hash.replace('#/', '') || 'dashboard', tab: null, sel: null, revealed: {}, viewedDocs: {}, modal: null, q: '', kind: 'all' };
  const $root = document.getElementById('root');
  const $layer = document.getElementById('layer');
  const $toast = document.getElementById('toast');
  const money = n => F.money(n, 'en');
  const num = n => F.num(n, 'en');
  const when = s => (s ? F.dateTime(s, 'en') : '—');
  const day = s => (s ? F.date(s, 'en') : '—');
  const ago = s => (s ? F.ago(s, 'en') : '—');
  const lab = (g, c) => BB.label(g, c, 'en');
  const user = id => BB.get.user(id);
  const uname = id => { const u = user(id); return u ? u.name_en : '—'; };
  const staffName = id => { const s = BB.get.staff(id); return s ? s.name + ' (' + s.place + ')' : id === 'auto' ? 'System' : '—'; };
  const actorName = a => { if (!a) return '—'; if (a === 'system') return 'System'; const [k, id] = a.split(':'); return k === 'staff' ? staffName(id) : uname(id) + ' (user)'; };
  let toastTimer;
  function toast(msg, err) { $toast.textContent = msg; $toast.className = 'atoast show' + (err ? ' err' : ''); clearTimeout(toastTimer); toastTimer = setTimeout(() => { $toast.className = 'atoast'; }, err ? 4500 : 2600); }
  function run(fn) { try { return fn(); } catch (e) { console.error(e); toast(e.en || e.message, true); return null; } }
  function badge(text, cls) { return `<span class="badge ${cls || ''}">${esc(text)}</span>`; }
  function statusBadge(s) {
    const map = { pending: 'info', approved: 'ok', rejected: 'danger', active: 'ok', in_review: 'info', let_agreed: 'dark', paused: '', closed: '', removed: 'danger', held: 'info', released: 'ok', refunded: 'warn', disputed: 'danger', awaiting_payment: '', open: 'warn', actioned: 'ok', dismissed: '', suspended: 'danger', deletion_pending: 'warn', deleted: '', replaced: '' };
    return badge(String(s).replace(/_/g, ' '), map[s] || '');
  }

  // ───────────── Counts for the menu and dashboard ─────────────
  function counts() {
    const s = S();
    return {
      kyc: s.idChecks.filter(c => c.status === 'pending').length,
      listings: s.listings.filter(l => l.status === 'in_review').length,
      accounts: s.payoutAccounts.filter(p => p.status === 'pending').length,
      payouts: s.payouts.filter(p => !p.approvedBy).length,
      due: s.advances.filter(a => (a.releaseDue || a.status === 'disputed') && !BB.payoutsOf(a.id).length && ['held', 'disputed'].includes(a.status)).length,
      unmatched: s.bankTxns.filter(t => t.direction === 'in' && !t.advanceId).length,
      reports: s.reports.filter(r => r.status === 'open').length,
      deletions: s.deletions.filter(d => !d.completedAt && !d.cancelledAt).length,
      live: s.listings.filter(l => l.status === 'active').length,
    };
  }

  // ───────────── Login ─────────────
  function loginPage() {
    return `<div class="login"><div class="box"><div class="row" style="gap:12px;margin-bottom:6px"><div class="mark" style="width:44px;height:44px;border-radius:12px;background:var(--brand);color:#fff;display:grid;place-items:center;font-weight:800;font-size:20px">বা</div><div><h1 style="font-size:20px">Basha Bari admin</h1><div class="small muted">Founders only · web only</div></div></div>
      <p class="small muted" style="margin:12px 0 4px">Choose who you are. In the real system this page sits behind Cloudflare Access and each founder signs in with a passkey.</p>
      ${S().staff.map(s => `<button class="founder" data-a="login" data-id="${s.id}"><span class="av">${esc(s.name.slice(-1))}</span><span class="grow"><b>${esc(s.name)}</b><br><span class="small muted">${esc(s.place)} · ${esc(s.email)}</span></span>${I('key', 20)} <span class="small">Sign in with passkey</span></button>`).join('')}
      <p class="tiny muted" style="margin-top:14px"><span class="demo-tag">DEMO</span> Made-up data only. Both founders have full access. Payouts need both of you: one prepares, the other approves.</p></div></div>`;
  }

  // ───────────── Shell ─────────────
  const NAV = [
    ['dashboard', 'grid', 'Dashboard'],
    ['g', 'Checks'],
    ['kyc', 'shield', 'ID checks', 'kyc'],
    ['listings', 'home', 'Listings', 'listings'],
    ['accounts', 'bank', 'Bank accounts', 'accounts'],
    ['g', 'Money'],
    ['money', 'receipt', 'Advances and bank', 'money'],
    ['g', 'People'],
    ['users', 'users', 'Users'],
    ['scouts', 'compass', 'Scouts'],
    ['reports', 'flag', 'Reports', 'reports'],
    ['deletions', 'trash', 'Deletions', 'deletions'],
    ['g', 'Records'],
    ['records', 'qr', 'Records and deals'],
    ['vault', 'lock', 'Document vault'],
    ['audit', 'file', 'Audit log'],
    ['settings', 'sliders', 'Settings'],
  ];
  function shell(title, body, actions) {
    const c = counts();
    const nav = NAV.map(n => {
      if (n[0] === 'g') return `<div class="group">${esc(n[1])}</div>`;
      const [id, ic, label, ck] = n;
      let k = ck ? c[ck] : 0;
      if (ck === 'money') k = c.payouts + c.due + c.unmatched;
      return `<button class="${ui.page === id ? 'on' : ''}" data-a="page" data-p="${id}">${I(ic, 18)} ${esc(label)}${k ? `<span class="count ${ck === 'reports' || ck === 'money' ? 'warn' : ''}">${num(k)}</span>` : ''}</button>`;
    }).join('');
    const me = staff();
    return `<div class="shell"><aside class="side"><div class="brand"><span class="mark">বা</span><span>Basha Bari<small>Admin · founders only</small></span></div><nav class="nav">${nav}</nav></aside>
      <div class="main"><div class="topbar"><h1>${esc(title)}</h1>${actions || ''}<span class="demo-tag">DEMO</span><span class="small muted nowrap">${BB.isShared() ? I('wifi', 14) + ' live' : 'this browser'}</span>
        <div class="row" style="gap:6px"><span class="small">Signed in as <b>${esc(me.name)}</b> (${esc(me.place)})</span><button class="btn plain sm" data-a="switch">${I('users', 15)} Switch founder</button><a class="btn plain sm" href="app.html" target="_blank" rel="noopener">${I('phone', 15)} Open app</a></div></div>
      <div class="content">${body}</div></div></div>`;
  }

  // ───────────── Reveal (personal data is masked by default) ─────────────
  function masked(key, value, label, shown) {
    if (value == null || value === '') return '—';
    if (ui.revealed[key]) return `<span class="masked">${esc(value)}</span> <span class="badge ok">revealed · logged</span>`;
    return `<span class="masked">${esc(shown)}</span> <button class="link small" data-a="reveal" data-k="${esc(key)}" data-l="${esc(label)}">${I('eye', 14)} Reveal</button>`;
  }
  function viewDoc(docId) {
    if (ui.viewedDocs[docId]) return;
    ui.viewedDocs[docId] = true;
    const d = BB.get.doc(docId);
    if (d) BB.audit('staff:' + session.staffId, 'document.viewed', docId, null, { kind: d.kind, user: d.userId });
  }
  function docBox(docId, caption) {
    const d = BB.get.doc(docId);
    if (!d) return '';
    setTimeout(() => viewDoc(docId), 0);
    const me = staff();
    return `<div class="docbox"><img src="${ART.doc(d)}" alt=""><div class="wm">Viewed by ${esc(me.name)} · ${esc(F.dateTime(new Date().toISOString(), 'en'))}</div><div class="cap"><b>${esc(caption || lab('docKind', d.kind))}</b> · v${num(d.version)}<div class="mono tiny">sha256 ${esc(d.sha256.slice(0, 16))}…</div><div class="tiny muted">${esc(day(d.uploadedAt))} · ${num(Math.round(d.bytes / 1024))} KB · encrypted (${esc(d.keyId)})</div></div></div>`;
  }

  // ───────────── Pages ─────────────
  function pageDashboard() {
    const c = counts();
    const s = S();
    const bal = BB.escrowBalance(), held = BB.heldTotal();
    const stat = (label, val, sub, page, ic, alert) => `<div class="stat ${alert ? 'alert' : ''}" data-a="page" data-p="${page}"><div class="lbl">${I(ic, 16)} ${esc(label)}</div><div class="val">${val}</div><div class="sub">${esc(sub || '')}</div></div>`;
    const areas = BB.AREAS.filter(a => a.parent === 1).map(a => {
      const rows = BB.search({ areaIds: [a.id], hideLet: false });
      const live = rows.filter(v => v.l.status === 'active');
      const totals = live.map(v => v.total).sort((x, y) => x - y);
      return { a, live: live.length, let: rows.length - live.length, median: totals.length ? totals[Math.floor(totals.length / 2)] : null };
    });
    const weekAgo = Date.now() - 7 * BB.DAY;
    const recent = x => new Date(x) > weekAgo;
    const approved = s.idChecks.filter(k => k.status !== 'pending' && k.reviewedAt);
    const avgMin = approved.length ? Math.round(approved.reduce((n, k) => n + (new Date(k.reviewedAt) - new Date(k.createdAt)), 0) / approved.length / BB.MIN) : 0;
    const deals = s.deals.filter(d => d.status === 'confirmed').length;
    const enq = s.conversations.filter(x => recent(x.createdAt)).length;
    const live = s.listings.filter(l => l.status === 'active');
    const enquired = live.filter(l => s.conversations.some(x => x.listingId === l.id)).length;
    const weekly = [
      ['Live verified homes', num(c.live), 'Target before public launch: 1,000'],
      ['Homes with an enquiry', live.length ? Math.round((enquired / live.length) * 100) + '%' : '—', 'Share of live homes with at least one enquiry'],
      ['New enquiries (7 days)', num(enq), ''],
      ['Viewings agreed', num(s.viewings.filter(v => v.status === 'accepted' || v.status === 'done').length), ''],
      ['Contact records', num(s.records.length), 'Both sides shared details'],
      ['Deals confirmed', num(deals), ''],
      ['Protected advances', num(s.advances.length), num(s.advances.filter(a => a.status === 'released').length) + ' released · ' + num(s.advances.filter(a => a.status === 'refunded' || a.status === 'disputed').length) + ' refunded or disputed'],
      ['Fraud reports per 100 deals', deals ? Math.round((s.reports.length / deals) * 100) : num(s.reports.length), ''],
      ['Average ID review time', avgMin < 120 ? num(avgMin) + ' min' : Math.round(avgMin / 60) + ' h', 'Target: within 2 hours, 9am–11pm'],
    ];
    return `<div class="grid k4">
      ${stat('ID checks waiting', num(c.kyc), 'Target: within 2 hours', 'kyc', 'shield', c.kyc > 0)}
      ${stat('Listings in review', num(c.listings), 'Photos + ownership papers', 'listings', 'home', c.listings > 0)}
      ${stat('Bank accounts to check', num(c.accounts), 'Name must match the NID', 'accounts', 'bank', c.accounts > 0)}
      ${stat('Payouts to approve', num(c.payouts + c.due), num(c.payouts) + ' prepared · ' + num(c.due) + ' to prepare', 'money', 'receipt', c.payouts + c.due > 0)}
      ${stat('Held at the bank', money(held), num(s.advances.filter(a => a.status === 'held' || a.status === 'disputed').length) + ' advances', 'money', 'lock')}
      ${stat('Open reports', num(c.reports), 'Review within 24 hours', 'reports', 'flag', c.reports > 0)}
      ${stat('Deletion requests', num(c.deletions), '28-day safety period', 'deletions', 'trash')}
      ${stat('Live homes', num(c.live), num(s.listings.filter(l => l.status === 'let_agreed').length) + ' let agreed', 'listings', 'building')}
    </div>
    <div class="grid k2" style="margin-top:14px">
      <div class="card-a"><h2>${I('bank', 18)} Escrow reconciliation</h2><div class="body">
        <div class="kv"><dt>Escrow account balance (from the bank lines)</dt><dd>${money(bal)}</dd><dt>Money the app says is held</dt><dd>${money(held)}</dd></div>
        <div style="margin-top:10px">${Math.abs(bal - held) < 1 ? `<div class="note ok">${I('check', 18)}<div>Balanced. Every taka at the bank belongs to a held advance.</div></div>` : `<div class="note danger">${I('alert', 18)}<div>Difference of ${money(bal - held)}. Both founders get an alert. Check unmatched lines on the money page.</div></div>`}</div>
        <p class="tiny muted" style="margin-top:8px">${esc(S().settings.escrow.bank)} · ${esc(S().settings.escrow.name)} · ${esc(S().settings.escrow.number)}</p></div></div>
      <div class="card-a"><h2>${I('map', 18)} Homes by area</h2><div class="body" style="padding:0"><table class="t"><tr><th>Area</th><th>Live</th><th>Let agreed</th><th>Median monthly total</th></tr>${areas.map(x => `<tr><td>${esc(x.a.en)} <span class="muted small">${esc(x.a.bn)}</span></td><td>${num(x.live)}</td><td>${num(x.let)}</td><td>${x.median ? money(x.median) : '—'}</td></tr>`).join('')}</table></div></div>
    </div>
    <div class="grid k2" style="margin-top:14px">
      <div class="card-a"><h2>${I('star', 18)} Numbers to watch (BUSINESS_PLAN.md §10)</h2><div class="body" style="padding:0"><table class="t">${weekly.map(([a, b, cmt]) => `<tr><td>${esc(a)}${cmt ? `<div class="tiny muted">${esc(cmt)}</div>` : ''}</td><td style="text-align:right"><b>${b}</b></td></tr>`).join('')}</table>
        <div style="padding:10px 12px"><div class="tiny muted" style="margin-bottom:4px">Progress to 1,000 homes</div><div class="bar"><span style="width:${Math.min(100, c.live / 10)}%"></span></div></div></div></div>
      <div class="card-a"><h2>${I('file', 18)} Recent activity</h2><div class="body" style="padding:0"><table class="t">${S().audit.slice(-10).reverse().map(e => `<tr><td class="nowrap small">${esc(ago(e.at))}</td><td class="small">${esc(actorName(e.actor))}</td><td class="small"><b>${esc(e.action)}</b>${e.reason ? `<div class="tiny muted">${esc(e.reason)}</div>` : ''}</td></tr>`).join('')}</table></div></div>
    </div>`;
  }

  function filterTabs(tabs, current) { return `<div class="tabs">${tabs.map(([k, label, n]) => `<button class="${current === k ? 'on' : ''}" data-a="tab" data-t="${k}">${esc(label)}${n != null ? ' · ' + num(n) : ''}</button>`).join('')}</div>`; }

  function pageKyc() {
    const tab = ui.tab || 'pending';
    const all = S().idChecks.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const rows = tab === 'all' ? all : all.filter(c => c.status === tab);
    return filterTabs([['pending', 'Waiting', all.filter(c => c.status === 'pending').length], ['approved', 'Approved'], ['rejected', 'Rejected'], ['all', 'All']], tab) +
      `<div class="card-a tablewrap"><table class="t"><tr><th>Person</th><th>Document</th><th>Submitted</th><th>Face match</th><th>Liveness</th><th>Flags</th><th>Status</th></tr>
      ${rows.map(c => { const u = user(c.userId); const age = BB.ageOn(c.dob); const flags = []; if (c.dupOf) flags.push(badge('NID used by another account', 'danger')); if (age < 18) flags.push(badge('Under 18', 'danger')); if (c.faceScore < 0.7) flags.push(badge('Low face match', 'warn')); const prev = S().idChecks.filter(x => x.userId === c.userId && x.id !== c.id).length; if (prev) flags.push(badge(prev + ' earlier try', '')); return `<tr class="click ${ui.sel === c.id ? 'sel' : ''}" data-a="sel" data-id="${c.id}"><td><b>${esc(u.name_en)}</b><div class="tiny muted">${esc(u.kind)}</div></td><td>${esc(lab('docType', c.docType))} ••••${esc(c.docLast4)}</td><td class="nowrap">${esc(ago(c.createdAt))}</td><td>${Math.round(c.faceScore * 100)}%</td><td>${c.liveness ? badge('passed', 'ok') : badge('failed', 'danger')}</td><td>${flags.join(' ') || '—'}</td><td>${statusBadge(c.status)}</td></tr>`; }).join('') || `<tr><td colspan="7" class="muted center" style="padding:30px">Nothing here.</td></tr>`}</table></div>`;
  }
  function drawerKyc(id) {
    const c = BB.get.idCheck(id);
    const u = user(c.userId);
    const age = BB.ageOn(c.dob);
    const versions = S().idChecks.filter(x => x.userId === c.userId).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const body = `<div class="row" style="margin-bottom:12px"><img class="avatar" style="width:46px;height:46px;border-radius:50%" src="${ART.avatar(u.avatar)}" alt=""><div class="grow"><b>${esc(u.name_en)}</b> <span class="muted">${esc(u.name_bn)}</span><div class="small muted">Phone ${masked('phone:' + u.id, u.phone, 'phone number of ' + u.name_en, F.maskPhone(u.phone))} · joined ${esc(day(u.createdAt))} · ${esc(u.kind)}</div></div>${statusBadge(c.status)}</div>
      <div class="docs">${docBox(c.frontId, c.docType === 'passport' ? 'Passport page' : 'Front')}${c.backId ? docBox(c.backId, 'Back') : ''}${docBox(c.selfieId, 'Live selfie')}</div>
      <h3 style="margin:16px 0 8px;font-size:14px">What they typed</h3><div class="kv"><dt>Legal name</dt><dd>${esc(c.legalName)}</dd><dt>Date of birth</dt><dd>${esc(c.dob)} · age ${num(age)}</dd><dt>${esc(lab('docType', c.docType))} number</dt><dd>${masked('doc:' + c.id, c.docNumber, 'document number of ' + u.name_en, '••••••' + c.docLast4)}</dd></div>
      <h3 style="margin:16px 0 8px;font-size:14px">Automatic checks</h3><div class="checks">
        <div class="checkrow ${c.liveness ? 'ok' : 'bad'}">${I(c.liveness ? 'check' : 'x', 16)} Liveness (on the phone, ML Kit)</div>
        <div class="checkrow ${c.faceScore >= 0.75 ? 'ok' : 'warn'}">${I(c.faceScore >= 0.75 ? 'check' : 'alert', 16)} Face match ${Math.round(c.faceScore * 100)}% (SFace)</div>
        <div class="checkrow ${age >= 18 ? 'ok' : 'bad'}">${I(age >= 18 ? 'check' : 'x', 16)} 18 or older</div>
        <div class="checkrow ${c.dupOf ? 'bad' : 'ok'}">${I(c.dupOf ? 'x' : 'check', 16)} ${c.dupOf ? 'Same NID already approved for ' + esc(uname(c.dupOf)) : 'No other account uses this NID'}</div>
        <div class="checkrow ${BB.checkDocNumber(c.docType, c.docNumber) ? 'ok' : 'bad'}">${I('check', 16)} Number format</div>
        <div class="checkrow ${BB.namesMatch(c.legalName, u.name_en) ? 'ok' : 'warn'}">${I(BB.namesMatch(c.legalName, u.name_en) ? 'check' : 'alert', 16)} Name ${BB.namesMatch(c.legalName, u.name_en) ? 'matches' : 'differs from'} the account name</div></div>
      ${versions.length > 1 ? `<h3 style="margin:16px 0 8px;font-size:14px">All tries (nothing is overwritten)</h3><table class="t">${versions.map(v => `<tr><td>${esc(when(v.createdAt))}</td><td>${statusBadge(v.status)}</td><td class="small">${esc(v.rejectReason || '')}</td><td class="small muted">${v.reviewedBy ? esc(staffName(v.reviewedBy)) : ''}</td></tr>`).join('')}</table>` : ''}
      ${c.status !== 'pending' ? `<div class="note ${c.status === 'approved' ? 'ok' : 'danger'}" style="margin-top:14px">${I(c.status === 'approved' ? 'check' : 'x', 18)}<div>${c.status === 'approved' ? 'Approved' : 'Rejected: ' + esc(c.rejectReason)} by ${esc(staffName(c.reviewedBy))}, ${esc(when(c.reviewedAt))}</div></div>` : ''}
      <p class="tiny muted" style="margin-top:12px">Phase 2 adds an Election Commission NID check here, once the company has access.</p>`;
    const foot = c.status === 'pending' ? `<button class="btn" data-a="kyc-approve" data-id="${c.id}">${I('check', 16)} Approve</button><button class="btn danger ghost" data-a="kyc-reject" data-id="${c.id}">${I('x', 16)} Reject</button>` : '';
    return drawer('ID check · ' + u.name_en, body, foot);
  }

  function pageListings() {
    const tab = ui.tab || 'in_review';
    const all = S().listings.slice().sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    const groups = { in_review: x => x.status === 'in_review', active: x => x.status === 'active', let_agreed: x => x.status === 'let_agreed', other: x => ['paused', 'closed', 'rejected', 'removed'].includes(x.status), all: () => true };
    const rows = all.filter(groups[tab]);
    return filterTabs([['in_review', 'In review', all.filter(groups.in_review).length], ['active', 'Live', all.filter(groups.active).length], ['let_agreed', 'Let agreed', all.filter(groups.let_agreed).length], ['other', 'Paused, closed, rejected'], ['all', 'All', all.length]], tab) +
      `<div class="card-a tablewrap"><table class="t"><tr><th></th><th>Home</th><th>Lister</th><th>Monthly total</th><th>Status</th><th>Flags</th><th>Views</th></tr>${rows.map(l => { const v = BB.view(l); const med = BB.areaMedian(v.p.areaId, l.kind); const low = med && v.total < med * 0.6; return `<tr class="click ${ui.sel === l.id ? 'sel' : ''}" data-a="sel" data-id="${l.id}"><td><img src="${ART.room(l.photos[0].room, l.photos[0].seed, l.palette)}" style="width:64px;height:48px;object-fit:cover;border-radius:8px" alt=""></td><td><b>${esc(l.title_en)}</b><div class="tiny muted">${esc(v.area.en)} · ${esc(lab('kind', l.kind))} · ${esc(l.id)}</div></td><td>${esc(uname(l.listerId))}<div class="tiny muted">${esc(lab('role', v.p.listerRole))}</div></td><td>${money(v.total)}</td><td>${statusBadge(l.status)}</td><td>${low ? badge('Far below area median', 'danger') : ''} ${l.scoutId ? badge('Scout: ' + uname(l.scoutId)) : ''} ${v.p.proofStatus === 'approved' ? badge('Ownership checked', 'ok') : ''}</td><td>${num(l.views || 0)}</td></tr>`; }).join('') || `<tr><td colspan="7" class="muted center" style="padding:30px">Nothing here.</td></tr>`}</table></div>`;
  }
  function drawerListing(id) {
    const l = BB.get.listing(id);
    const v = BB.view(l);
    const med = BB.areaMedian(v.p.areaId, l.kind);
    const proofs = S().proofs.filter(p => p.propertyId === v.p.id);
    const sub = S().scoutSubs.find(s => s.listingId === l.id);
    const kyc = BB.latestIdCheck(l.listerId);
    const body = `<div class="photostrip">${l.photos.map(p => `<img src="${ART.room(p.room, p.seed, l.palette)}" alt="" title="${esc(lab('room', p.room))}">`).join('')}</div>
      <div class="grid k2" style="margin-top:12px"><div><h3 style="font-size:14px;margin-bottom:6px">${esc(l.title_en)}</h3><div class="small muted">${esc(l.title_bn)}</div>
        <div class="kv small" style="margin-top:10px"><dt>Rent</dt><dd>${money(l.rent)}</dd><dt>Service charge</dt><dd>${money(l.service)} ${l.serviceCovers ? '· ' + esc(l.serviceCovers) : ''}</dd><dt>Advance</dt><dd>${num(l.advanceMonths)} month(s) ${l.advanceMonths > 1 ? badge('above 1 month', 'warn') : ''}</dd><dt>Rooms</dt><dd>${num(l.beds)} bed · ${num(l.baths)} bath · ${num(l.balconies)} balcony · ${l.size ? num(l.size) + ' sq ft' : '—'}</dd><dt>Floor</dt><dd>${l.floor == null ? '—' : num(l.floor)} / ${l.floors ? num(l.floors) : '—'}</dd><dt>Bills</dt><dd>Water: ${esc(lab('bill', l.waterBill))} · Gas: ${esc(lab('bill', l.gasBill))} (${esc(lab('gas', l.gas))}) · Electricity: ${esc(lab('electricity', l.electricity))}</dd><dt>Who can rent</dt><dd>${esc(l.accepts.map(a => lab('accepts', a)).join(', '))}</dd><dt>Features</dt><dd>${esc(l.amenities.map(a => lab('amenity', a)).join(', ') || '—')}</dd></div></div>
        <div><div class="checks" style="grid-template-columns:1fr">
          <div class="checkrow ${!med || v.total >= med * 0.6 ? 'ok' : 'bad'}">${I(!med || v.total >= med * 0.6 ? 'check' : 'alert', 16)} Price ${money(v.total)} vs area median ${med ? money(med) : '—'}</div>
          <div class="checkrow ok">${I('check', 16)} Photo fingerprints: no copies found on other listings</div>
          <div class="checkrow ok">${I('check', 16)} GPS removed from all photos</div>
          <div class="checkrow ${kyc && kyc.status === 'approved' ? 'ok' : 'bad'}">${I(kyc && kyc.status === 'approved' ? 'check' : 'x', 16)} Lister ID ${kyc ? kyc.status : 'missing'}: ${esc(uname(l.listerId))}</div>
          <div class="checkrow ${v.p.listerRole === 'owner' ? 'ok' : 'warn'}">${I(v.p.listerRole === 'owner' ? 'check' : 'info', 16)} Lister is ${esc(lab('role', v.p.listerRole))}${v.p.relation ? ': ' + esc(v.p.relation) : ''}</div>
          ${sub ? `<div class="checkrow ok">${I('compass', 16)} Brought in by scout ${esc(uname(sub.scoutId))}; capture location recorded (kept private)</div>` : ''}</div>
          <div class="kv small" style="margin-top:10px"><dt>Address</dt><dd>${masked('addr:' + v.p.id, v.p.address, 'exact address of ' + l.id, v.area.en + ' (exact address hidden)')}</dd><dt>Exact pin</dt><dd>${masked('pin:' + v.p.id, v.p.exact.lat + ', ' + v.p.exact.lng, 'exact pin of ' + l.id, 'hidden')}</dd><dt>Public point</dt><dd class="mono">${v.p.pub.lat}, ${v.p.pub.lng} (shifted once)</dd></div></div></div>
      <h3 style="margin:16px 0 8px;font-size:14px">Ownership or permission papers</h3><div class="docs">${proofs.map(p => docBox(p.docId)).join('') || '<p class="muted small">None uploaded.</p>'}</div>
      ${l.description ? `<h3 style="margin:16px 0 6px;font-size:14px">Description</h3><p class="small">${esc(l.description)}</p>` : ''}
      ${l.rejectReason ? `<div class="note danger">${I('x', 18)}<div>Rejected: ${esc(l.rejectReason)}</div></div>` : ''}`;
    const foot = l.status === 'in_review' ? `<button class="btn" data-a="lst-approve" data-id="${l.id}">${I('check', 16)} Approve — goes live</button><button class="btn danger ghost" data-a="lst-reject" data-id="${l.id}">${I('x', 16)} Reject</button>`
      : l.status === 'active' ? `<button class="btn danger ghost" data-a="lst-remove" data-id="${l.id}">${I('trash', 16)} Remove listing</button>` : '';
    return drawer('Listing · ' + l.id, body, foot);
  }

  function pageAccounts() {
    const tab = ui.tab || 'pending';
    const all = S().payoutAccounts.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const rows = tab === 'all' ? all : all.filter(p => p.status === tab);
    return `<div class="note" style="margin-bottom:14px">${I('info', 18)}<div class="small">Protected advances are paid only to an approved account in the landlord's verified name. After approval there is a 48-hour wait before it can be paid${S().settings.skipWaits ? ' (skipped in the demo — see Settings)' : ''}.</div></div>` +
      filterTabs([['pending', 'Waiting', all.filter(p => p.status === 'pending').length], ['approved', 'Approved'], ['rejected', 'Rejected'], ['all', 'All']], tab) +
      `<div class="card-a tablewrap"><table class="t"><tr><th>Account holder</th><th>Verified NID name</th><th>Match</th><th>Bank</th><th>Added</th><th>Status</th></tr>${rows.map(p => { const u = user(p.userId); const ok = BB.namesMatch(p.accountName, u.legalName || u.name_en); return `<tr class="click ${ui.sel === p.id ? 'sel' : ''}" data-a="sel" data-id="${p.id}"><td><b>${esc(p.accountName)}</b><div class="tiny muted">${esc(u.name_en)} · ${esc(u.kind)}</div></td><td>${esc(u.legalName || '—')}</td><td>${ok ? badge('matches', 'ok') : badge('check by eye', 'warn')}</td><td>${esc(p.bank)} ••••${esc(p.last4)}</td><td>${esc(ago(p.createdAt))}</td><td>${statusBadge(p.status)}</td></tr>`; }).join('') || `<tr><td colspan="6" class="muted center" style="padding:30px">Nothing here.</td></tr>`}</table></div>`;
  }
  function drawerAccount(id) {
    const p = BB.get.payoutAccount(id);
    const u = user(p.userId);
    const ok = BB.namesMatch(p.accountName, u.legalName || u.name_en);
    const body = `<div class="checks" style="grid-template-columns:1fr"><div class="checkrow ${ok ? 'ok' : 'warn'}">${I(ok ? 'check' : 'alert', 16)} Account name "${esc(p.accountName)}" ${ok ? 'matches' : 'looks different from'} the verified NID name "${esc(u.legalName || '—')}". Titles like Md. and Mst. are ignored.</div>
      <div class="checkrow ${u.level >= 2 ? 'ok' : 'bad'}">${I(u.level >= 2 ? 'check' : 'x', 16)} Account holder ID verified</div></div>
      <div class="kv" style="margin-top:12px"><dt>Bank</dt><dd>${esc(p.bank)}</dd><dt>Account number</dt><dd>${masked('acct:' + p.id, p.accountNo, 'bank account number of ' + u.name_en, '••••••' + p.last4)}</dd><dt>Routing number</dt><dd class="mono">${esc(p.routing || '—')}</dd><dt>Added</dt><dd>${esc(when(p.createdAt))}</dd>${p.usableFrom ? `<dt>Usable from</dt><dd>${esc(when(p.usableFrom))}</dd>` : ''}</div>
      <h3 style="margin:16px 0 8px;font-size:14px">Proof</h3><div class="docs">${docBox(p.proofId)}</div>`;
    return drawer('Bank account · ' + u.name_en, body, p.status === 'pending' ? `<button class="btn" data-a="acct-approve" data-id="${p.id}">${I('check', 16)} Approve</button><button class="btn danger ghost" data-a="acct-reject" data-id="${p.id}">${I('x', 16)} Reject</button>` : '');
  }

  function pageMoney() {
    const me = session.staffId;
    const waiting = S().payouts.filter(p => !p.approvedBy);
    const advs = S().advances.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const unmatched = S().bankTxns.filter(t => t.direction === 'in' && !t.advanceId);
    const open = S().advances.filter(a => a.status === 'awaiting_payment');
    let h = `<div class="card-a" style="margin-bottom:14px"><h2>${I('users', 18)} Payouts waiting for the second founder</h2><div class="body" style="padding:0"><table class="t"><tr><th>Advance</th><th>Pay</th><th>To</th><th>Amount</th><th>Prepared by</th><th></th></tr>
      ${waiting.map(p => { const a = BB.get.advance(p.advanceId); const acct = p.toAccountId && BB.get.payoutAccount(p.toAccountId); const same = p.preparedBy === me; return `<tr><td><b>${esc(a.reference)}</b><div class="tiny muted">${esc(uname(a.renterId))} → ${esc(uname(a.landlordId))}</div></td><td>${esc(p.kind.replace(/_/g, ' '))}</td><td class="small">${acct ? esc(acct.bank) + ' ••••' + esc(acct.last4) + '<div class="tiny muted">' + esc(acct.accountName) + '</div>' : p.kind === 'refund_to_renter' ? 'Account the money came from' : 'Basha Bari company account'}</td><td><b>${money(p.amount)}</b></td><td class="small">${esc(staffName(p.preparedBy))}<div class="tiny muted">${esc(ago(p.preparedAt))}${p.note ? ' · ' + esc(p.note) : ''}</div></td><td>${same ? `<span class="small muted">You prepared this. Switch founder to approve.</span>` : `<button class="btn sm" data-a="po-approve" data-id="${p.id}">${I('check', 15)} Approve and send</button>`}</td></tr>`; }).join('') || `<tr><td colspan="6" class="muted center" style="padding:20px">Nothing waiting.</td></tr>`}</table></div></div>`;
    h += `<div class="card-a" style="margin-bottom:14px"><h2>${I('lock', 18)} Protected advances</h2><div class="body tablewrap" style="padding:0"><table class="t"><tr><th>Reference</th><th>Renter → landlord</th><th>Advance + fee</th><th>Status</th><th>Move-in</th><th>Release</th><th></th></tr>
      ${advs.map(a => { const pos = BB.payoutsOf(a.id); const canPrep = ['held', 'disputed'].includes(a.status) && !pos.length; return `<tr><td class="mono">${esc(a.reference)}</td><td class="small">${esc(uname(a.renterId))} → ${esc(uname(a.landlordId))}</td><td>${money(a.advance)} + ${money(a.fee)}</td><td>${statusBadge(a.status)}${a.disputeReason ? `<div class="tiny muted">${esc(a.disputeReason)}</div>` : ''}</td><td class="small">${esc(day(a.moveIn))}${a.movedInAt ? '<div class="tiny muted">moved in ' + esc(ago(a.movedInAt)) + '</div>' : ''}</td><td class="small">${a.releaseDue ? badge('due now', 'warn') : a.autoReleaseAt && a.status === 'held' ? 'auto ' + esc(day(a.autoReleaseAt)) : ''}${pos.length ? '<div class="tiny muted">' + pos.map(p => esc(p.kind.replace(/_/g, ' ')) + (p.approvedBy ? ' ✓' : ' (waiting)')).join(', ') + '</div>' : ''}</td>
        <td class="nowrap">${canPrep && a.status === 'held' ? `<button class="btn sm" data-a="po-prepare" data-id="${a.id}" data-o="release">Prepare payout</button> ` : ''}${canPrep ? `<button class="btn plain sm" data-a="po-prepare" data-id="${a.id}" data-o="refund">${a.status === 'disputed' ? 'Refund renter' : 'Refund'}</button>` : ''}${canPrep && a.status === 'disputed' ? ` <button class="btn soft sm" data-a="po-prepare" data-id="${a.id}" data-o="release">Release to landlord</button>` : ''}</td></tr>`; }).join('') || `<tr><td colspan="7" class="muted center" style="padding:20px">No protected advances yet.</td></tr>`}</table></div></div>`;
    h += `<div class="grid k2"><div class="card-a"><h2>${I('upload', 18)} Import the bank statement</h2><div class="body">
        <p class="small muted">The escrow account's statement is imported every day. Lines are matched by the reference code and the exact amount. Each bank line can be imported only once.</p>
        <button class="btn" data-a="import-demo">${I('refresh', 16)} Import today's statement (demo)</button> <span class="small muted">${num(open.filter(a => a.renterSentAt).length)} renter(s) said they sent a transfer · ${num(open.length)} waiting</span>
        <label class="field" style="margin-top:14px"><span>Or paste CSV lines: date, bank reference, amount, narration</span><textarea class="input" id="csv" placeholder="2026-10-26, NPSB12345, 16000, NPSB BB-7K3Q9 NUSRAT JAHAN"></textarea></label><button class="btn plain sm" style="margin-top:8px" data-a="import-csv">Import pasted lines</button>
        <button class="btn plain sm" style="margin-top:8px" data-a="daily-job">${I('clock', 15)} Run the daily job (auto-release due, expire old scout invites)</button></div></div>
      <div class="card-a"><h2>${I('alert', 18)} Unmatched lines</h2><div class="body" style="padding:0"><table class="t"><tr><th>Booked</th><th>Amount</th><th>Narration</th><th>Match to</th></tr>${unmatched.map(t => `<tr><td class="small">${esc(day(t.booked))}</td><td>${money(t.amount)}</td><td class="small mono">${esc(t.narration)}</td><td><select class="input" style="min-height:34px" id="m-${t.id}"><option value="">Choose…</option>${open.map(a => `<option value="${a.id}">${esc(a.reference)} · ${money(a.advance + a.fee)}</option>`).join('')}</select><button class="btn sm" style="margin-top:4px" data-a="match" data-id="${t.id}">Match</button></td></tr>`).join('') || `<tr><td colspan="4" class="muted center" style="padding:20px">Every line is matched.</td></tr>`}</table></div></div></div>`;
    h += `<div class="card-a" style="margin-top:14px"><h2>${I('list', 18)} Escrow account lines</h2><div class="body" style="padding:0"><table class="t"><tr><th>Booked</th><th>Bank ref</th><th>In / out</th><th>Amount</th><th>Narration</th><th>Advance</th></tr>${S().bankTxns.slice().reverse().map(t => `<tr><td class="small">${esc(when(t.booked))}</td><td class="mono">${esc(t.ref)}</td><td>${t.direction === 'in' ? badge('in', 'ok') : badge('out', '')}</td><td>${money(t.amount)}</td><td class="small mono">${esc(t.narration)}</td><td class="mono small">${t.advanceId ? esc(BB.get.advance(t.advanceId).reference) : '—'}</td></tr>`).join('')}</table></div></div>`;
    return h;
  }

  function pageUsers() {
    const q = BB.norm(ui.q);
    const kind = ui.kind;
    const rows = S().users.filter(u => (kind === 'all' || u.kind === kind) && (!q || BB.norm([u.name_en, u.name_bn, u.phone].join(' ')).includes(q)));
    return `<div class="row wrap" style="margin-bottom:14px"><input class="input" style="max-width:320px" id="uq" placeholder="Search by name or phone" value="${esc(ui.q)}" data-in="uq"><div class="tabs" style="margin:0">${[['all', 'Everyone'], ['renter', 'Renters'], ['landlord', 'Landlords'], ['scout', 'Scouts']].map(([k, t]) => `<button class="${kind === k ? 'on' : ''}" data-a="ukind" data-k="${k}">${esc(t)} · ${num(S().users.filter(u => k === 'all' || u.kind === k).length)}</button>`).join('')}</div></div>
      <div class="card-a tablewrap"><table class="t"><tr><th>Name</th><th>Type</th><th>Phone</th><th>Level</th><th>Status</th><th>Listings</th><th>Joined</th></tr>${rows.map(u => `<tr class="click ${ui.sel === u.id ? 'sel' : ''}" data-a="sel" data-id="${u.id}"><td><div class="row"><img src="${ART.avatar(u.avatar)}" style="width:28px;height:28px;border-radius:50%" alt=""><span><b>${esc(u.name_en)}</b><div class="tiny muted">${esc(u.name_bn)}</div></span></div></td><td>${esc(u.kind)}</td><td class="masked">${esc(F.maskPhone(u.phone))}</td><td>${u.level >= 2 ? badge('2 · ID verified', 'ok') : badge('1 · phone', '')}</td><td>${statusBadge(u.status)}</td><td>${num(S().listings.filter(l => l.listerId === u.id).length)}</td><td class="small">${esc(day(u.createdAt))}</td></tr>`).join('')}</table></div>`;
  }
  function drawerUser(id) {
    const u = user(id);
    const docs = BB.docsOf(id);
    const listings = S().listings.filter(l => l.listerId === id);
    const convs = S().conversations.filter(c => c.renterId === id || c.landlordId === id);
    const reps = S().reports.filter(r => r.targetId === id || (r.targetType === 'listing' && listings.some(l => l.id === r.targetId)) || (r.targetType === 'message' && S().messages.some(m => m.id === r.targetId && m.senderId === id)));
    const del = S().deletions.find(d => d.userId === id && !d.completedAt && !d.cancelledAt);
    const body = `<div class="row" style="margin-bottom:12px"><img src="${ART.avatar(u.avatar)}" style="width:52px;height:52px;border-radius:50%" alt=""><div class="grow"><b style="font-size:16px">${esc(u.name_en)}</b> <span class="muted">${esc(u.name_bn)}</span><div class="small muted">${esc(u.kind)} · ${statusBadge(u.status)} · level ${num(u.level)}</div></div></div>
      <div class="kv"><dt>Phone</dt><dd>${masked('phone:' + u.id, u.phone, 'phone number of ' + u.name_en, F.maskPhone(u.phone))}</dd><dt>Legal name</dt><dd>${esc(u.legalName || '—')}</dd><dt>Joined</dt><dd>${esc(when(u.createdAt))}</dd><dt>Verified</dt><dd>${esc(when(u.verifiedAt))}</dd><dt>Household</dt><dd>${esc((u.household || []).map(a => lab('accepts', a)).join(', ') || '—')}${u.householdSize ? ' · ' + num(u.householdSize) + ' people' : ''}</dd><dt>Occupation</dt><dd>${esc(u.occupation || '—')}</dd>${u.roleNote ? `<dt>Role</dt><dd>${esc(u.roleNote)}</dd>` : ''}</div>
      ${del ? `<div class="note warn" style="margin-top:12px">${I('trash', 18)}<div class="small">Deletion requested ${esc(ago(del.requestedAt))}; deleted after ${esc(day(del.deleteAfter))}.${del.holdReason ? ' On hold: ' + esc(del.holdReason) : ''}</div></div>` : ''}
      <h3 style="margin:16px 0 8px;font-size:14px">Documents in the vault (${num(docs.length)})</h3><table class="t">${docs.map(d => `<tr><td>${esc(lab('docKind', d.kind))} v${num(d.version)}</td><td class="small">${esc(day(d.uploadedAt))}</td><td class="mono tiny">${esc(d.sha256.slice(0, 20))}…</td><td class="small">${d.retainUntil ? 'keep until ' + esc(day(d.retainUntil)) : 'while account is open'}</td></tr>`).join('')}</table>
      <h3 style="margin:16px 0 8px;font-size:14px">Listings (${num(listings.length)})</h3>${listings.map(l => `<div class="row small" style="margin-bottom:4px">${statusBadge(l.status)} <span>${esc(l.title_en)}</span></div>`).join('') || '<p class="small muted">None.</p>'}
      <h3 style="margin:16px 0 8px;font-size:14px">Conversations (${num(convs.length)})</h3>${convs.map(c => `<div class="row small" style="margin-bottom:6px"><span class="grow">${esc(uname(c.renterId))} ↔ ${esc(uname(c.landlordId))} · ${esc(BB.get.listing(c.listingId).title_en)}</span><button class="btn plain sm" data-a="read-conv" data-id="${c.id}">${I('eye', 14)} Read</button></div>${ui.revealed['conv:' + c.id] ? chatView(c.id) : ''}`).join('') || '<p class="small muted">None.</p>'}
      ${reps.length ? `<h3 style="margin:16px 0 8px;font-size:14px">Reports about this person</h3>${reps.map(r => `<div class="small">${statusBadge(r.status)} ${esc(r.reason)} · ${esc(ago(r.createdAt))}</div>`).join('')}` : ''}`;
    const foot = (u.status === 'active' ? `<button class="btn danger ghost" data-a="u-suspend" data-id="${u.id}">${I('ban', 16)} Suspend</button>` : u.status === 'suspended' ? `<button class="btn" data-a="u-activate" data-id="${u.id}">Reactivate</button>` : '') + (del && !del.holdReason ? `<button class="btn plain" data-a="del-hold" data-id="${u.id}">Hold deletion</button>` : '');
    return drawer(u.name_en, body, foot);
  }
  function chatView(convId) {
    return `<div class="chatview" style="margin:6px 0 10px">${BB.messagesOf(convId).map(m => m.system ? `<div class="m sys">${esc(m.body_en)}</div>` : `<div class="m"><b>${esc(uname(m.senderId))} · ${esc(when(m.at))}</b>${esc(m.body)}${m.masked ? ' ' + badge('hidden', 'warn') : ''}</div>`).join('')}</div>`;
  }

  function pageScouts() {
    const scouts = S().scouts;
    let h = `<div class="card-a tablewrap" style="margin-bottom:14px"><table class="t"><tr><th>Scout</th><th>Live homes</th><th>Let bonuses</th><th>Due</th><th>Paid so far</th><th>Payout account</th><th>Daily limit</th><th></th></tr>${scouts.map(sc => { const e = BB.scoutEarnings(sc.userId); const acct = BB.approvedPayoutAccount(sc.userId); return `<tr><td><b>${esc(uname(sc.userId))}</b><div class="tiny muted">agreement signed ${esc(day(sc.agreementAt))}</div></td><td>${num(e.live)} × ৳150</td><td>${num(e.let)} × ৳300</td><td><b>${money(e.due)}</b></td><td>${money(e.paid)}</td><td class="small">${acct ? esc(acct.bank) + ' ••••' + esc(acct.last4) : badge('none', 'warn')}</td><td>${num(sc.dailyLimit)}</td><td>${e.due && acct ? `<button class="btn sm" data-a="pay-scout" data-id="${sc.userId}">Pay ${money(e.due)} by bank</button>` : ''}</td></tr>`; }).join('')}</table></div>`;
    const subs = S().scoutSubs.slice().sort((a, b) => new Date(b.invitedAt) - new Date(a.invitedAt));
    h += `<div class="card-a tablewrap"><h2>${I('compass', 18)} Submissions</h2><table class="t"><tr><th>When</th><th>Scout</th><th>Home</th><th>Landlord</th><th>Status</th><th>Spot check</th></tr>${subs.map((s, i) => { const l = s.listingId && BB.get.listing(s.listingId); const t = l ? l.title_en : s.draft ? BB.makeTitles(s.draft.kind, s.draft.beds, s.draft.areaId, s.draft.accepts).en : '(draft deleted)'; return `<tr><td class="small">${esc(ago(s.invitedAt))}</td><td>${esc(uname(s.scoutId))}</td><td class="small">${esc(t)}</td><td class="small">${l ? esc(uname(l.listerId)) : s.landlordPhone ? '<span class="masked">' + esc(F.maskPhone(s.landlordPhone)) + '</span> (invite sent)' : '—'}</td><td>${statusBadge(s.status)}${s.status === 'invited' ? `<div class="tiny muted">expires ${esc(day(new Date(new Date(s.invitedAt).getTime() + 7 * BB.DAY).toISOString()))}</div>` : ''}</td><td>${i % 10 === 0 && s.status === 'live' ? badge('visit in person', 'warn') : ''}</td></tr>`; }).join('')}</table></div>
      <p class="tiny muted" style="margin-top:10px">Scouts are paid only for homes that go live with a verified landlord. In the first month, someone visits 1 in 10 of their homes in person.</p>`;
    return h;
  }

  function pageReports() {
    const tab = ui.tab || 'open';
    const all = S().reports.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const rows = tab === 'all' ? all : all.filter(r => (tab === 'open' ? r.status === 'open' : r.status !== 'open'));
    return filterTabs([['open', 'Open', all.filter(r => r.status === 'open').length], ['closed', 'Closed'], ['all', 'All']], tab) +
      `<div class="card-a tablewrap"><table class="t"><tr><th>When</th><th>Reported by</th><th>About</th><th>Reason</th><th>Status</th></tr>${rows.map(r => `<tr class="click ${ui.sel === r.id ? 'sel' : ''}" data-a="sel" data-id="${r.id}"><td class="small">${esc(ago(r.createdAt))}</td><td>${esc(uname(r.reporterId))}</td><td class="small">${esc(r.targetType)}: ${esc(reportTargetName(r))}</td><td><b>${esc(r.reason)}</b></td><td>${statusBadge(r.status)}</td></tr>`).join('') || `<tr><td colspan="5" class="muted center" style="padding:30px">No reports.</td></tr>`}</table></div>`;
  }
  function reportTargetName(r) {
    if (r.targetType === 'listing') { const l = BB.get.listing(r.targetId); return l ? l.title_en : r.targetId; }
    if (r.targetType === 'user') return uname(r.targetId);
    const m = S().messages.find(x => x.id === r.targetId);
    return m ? 'message from ' + uname(m.senderId) : r.targetId;
  }
  function drawerReport(id) {
    const r = BB.get.report(id);
    let target = '';
    if (r.targetType === 'message') { const m = S().messages.find(x => x.id === r.targetId); if (m) target = `<div class="chatview"><div class="m"><b>${esc(uname(m.senderId))} · ${esc(when(m.at))}</b>${esc(m.body)}</div></div><p class="tiny muted">The hidden part (•••) was a phone or bKash number; it was never shown to the renter.</p>`; }
    if (r.targetType === 'listing') { const l = BB.get.listing(r.targetId); if (l) target = `<p><b>${esc(l.title_en)}</b> by ${esc(uname(l.listerId))} · ${statusBadge(l.status)}</p>`; }
    if (r.targetType === 'user') target = `<p><b>${esc(uname(r.targetId))}</b> · ${statusBadge(user(r.targetId).status)}</p>`;
    const body = `<div class="kv"><dt>Reported by</dt><dd>${esc(uname(r.reporterId))}</dd><dt>When</dt><dd>${esc(when(r.createdAt))}</dd><dt>Reason</dt><dd>${esc(r.reason)}</dd><dt>Details</dt><dd>${esc(r.details || '—')}</dd></div><h3 style="margin:16px 0 8px;font-size:14px">What was reported</h3>${target}
      ${r.status !== 'open' ? `<div class="note ok">${I('check', 18)}<div>${esc(r.status)} (${esc(r.action || '')}) by ${esc(staffName(r.decidedBy))} · ${esc(when(r.decidedAt))}${r.note ? '<br>' + esc(r.note) : ''}</div></div>` : ''}`;
    const foot = r.status === 'open' ? `<button class="btn plain" data-a="rep" data-id="${r.id}" data-x="dismiss">Dismiss</button><button class="btn soft" data-a="rep" data-id="${r.id}" data-x="warn">Warn the person</button>${r.targetType === 'listing' ? `<button class="btn danger ghost" data-a="rep" data-id="${r.id}" data-x="remove_listing">Remove listing</button>` : ''}<button class="btn danger" data-a="rep" data-id="${r.id}" data-x="suspend_user">Suspend the person</button>` : '';
    return drawer('Report', body, foot);
  }

  function pageDeletions() {
    const all = S().deletions.slice().sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
    return `<div class="note" style="margin-bottom:14px">${I('info', 18)}<div class="small">Deletion is a fixed 28-day safety period, then the account is deleted. Only an open fraud report or a lawful request can pause it, and the person is told. ID documents, contact records, deals and payments are kept encrypted for 6 years (lawyer to confirm), then purged.</div></div>
      <div class="card-a tablewrap"><table class="t"><tr><th>Person</th><th>Requested</th><th>Deleted after</th><th>Reason</th><th>Status</th><th></th></tr>${all.map(d => { const u = user(d.userId); const days = Math.ceil((new Date(d.deleteAfter) - Date.now()) / BB.DAY); const st = d.completedAt ? 'deleted' : d.cancelledAt ? 'cancelled' : d.holdReason ? 'on hold' : 'waiting'; return `<tr><td><b>${esc(u.name_en)}</b></td><td class="small">${esc(day(d.requestedAt))}</td><td class="small">${esc(day(d.deleteAfter))}${!d.completedAt && !d.cancelledAt ? '<div class="tiny muted">' + num(Math.max(0, days)) + ' days left</div>' : ''}</td><td class="small">${esc(d.reason || '—')}${d.holdReason ? '<div class="tiny" style="color:var(--warn)">Hold: ' + esc(d.holdReason) + '</div>' : ''}</td><td>${badge(st, st === 'deleted' ? '' : st === 'on hold' ? 'warn' : st === 'cancelled' ? 'ok' : 'info')}</td><td class="nowrap">${st === 'waiting' ? `<button class="btn plain sm" data-a="del-hold" data-id="${u.id}">Hold</button> <button class="btn danger ghost sm" data-a="del-now" data-id="${u.id}">Delete now (demo)</button>` : ''}</td></tr>`; }).join('') || `<tr><td colspan="6" class="muted center" style="padding:30px">No requests.</td></tr>`}</table></div>`;
  }

  function pageRecords() {
    const recs = S().records.slice().reverse();
    const deals = S().deals.slice().reverse();
    return `<div class="card-a tablewrap" style="margin-bottom:14px"><h2>${I('qr', 18)} Contact records (identical copies for both sides)</h2><table class="t"><tr><th>Issued</th><th>Renter ↔ landlord</th><th>Home</th><th>Check code</th><th>Fingerprint</th><th>Chain</th></tr>${recs.map(r => `<tr><td class="small">${esc(when(r.createdAt))}</td><td class="small">${esc(r.snapshot.renter.name)} ↔ ${esc(r.snapshot.landlord.name)}</td><td class="small">${esc(r.snapshot.home.title_en)}</td><td class="mono">${esc(r.verifyCode)}</td><td>${BB.verifyRecord(r) ? badge('unchanged', 'ok') : badge('CHANGED', 'danger')}<div class="mono tiny">${esc(r.sha256.slice(0, 20))}…</div></td><td class="mono tiny">${r.prevSha256 ? esc(r.prevSha256.slice(0, 12)) + '…' : 'first'}</td></tr>`).join('') || `<tr><td colspan="6" class="muted center" style="padding:20px">None yet.</td></tr>`}</table></div>
      <div class="card-a tablewrap"><h2>${I('receipt', 18)} Deals</h2><table class="t"><tr><th>Created</th><th>Renter ↔ landlord</th><th>Rent</th><th>Advance</th><th>Move-in</th><th>Status</th><th>Advance paid</th><th>Move-in check</th></tr>${deals.map(d => { const c = BB.get.conv(d.convId); const a = BB.advanceOf(d.id); return `<tr><td class="small">${esc(day(d.createdAt))}</td><td class="small">${esc(uname(c.renterId))} ↔ ${esc(uname(c.landlordId))}</td><td>${money(d.rent)}</td><td>${money(d.advance)}</td><td class="small">${esc(day(d.moveIn))}</td><td>${statusBadge(d.status)}</td><td class="small">${a ? 'protected · ' + esc(a.status) : d.paidDirectlyAt ? 'direct · receipt' : '—'}</td><td>${d.moveInCheck ? badge('saved', 'ok') : '—'}</td></tr>`; }).join('') || `<tr><td colspan="8" class="muted center" style="padding:20px">None yet.</td></tr>`}</table></div>`;
  }

  function pageVault() {
    const docs = S().docs.slice().sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    return `<div class="row" style="margin-bottom:14px"><button class="btn" data-a="verify-docs">${I('shield', 16)} Check every fingerprint now</button><span class="small muted">Runs weekly in the real system. ${num(docs.length)} documents · encrypted on our server, encrypted copy in Cloudflare R2.</span></div>
      <div class="card-a tablewrap"><table class="t"><tr><th>Uploaded</th><th>Owner</th><th>Kind</th><th>Version</th><th>Size</th><th>SHA-256</th><th>Storage key</th><th>Keep until</th></tr>${docs.map(d => `<tr class="click" data-a="view-doc" data-id="${d.id}"><td class="small">${esc(day(d.uploadedAt))}</td><td>${esc(uname(d.userId))}</td><td>${esc(lab('docKind', d.kind))}</td><td>v${num(d.version)}${d.replacesId ? ' <span class="tiny muted">(replaces v' + num(d.version - 1) + ')</span>' : ''}</td><td class="small">${num(Math.round(d.bytes / 1024))} KB</td><td class="mono tiny">${esc(d.sha256.slice(0, 16))}…</td><td class="mono tiny">${esc(d.storageKey)}</td><td class="small">${d.retainUntil ? esc(day(d.retainUntil)) : 'account open'}</td></tr>`).join('')}</table></div>`;
  }

  function pageAudit() {
    return `<div class="row" style="margin-bottom:14px"><button class="btn" data-a="verify-audit">${I('shield', 16)} Verify the hash chain</button><span class="small muted">Append-only. Each entry includes the fingerprint of the one before it, so a changed or deleted entry breaks the chain.</span></div>
      <div class="card-a tablewrap"><table class="t"><tr><th>#</th><th>When</th><th>Who</th><th>Action</th><th>Target</th><th>Reason</th><th>Hash</th></tr>${S().audit.slice().reverse().map(e => `<tr><td>${num(e.id)}</td><td class="small nowrap">${esc(when(e.at))}</td><td class="small">${esc(actorName(e.actor))}</td><td><b class="small">${esc(e.action)}</b></td><td class="mono tiny">${esc(e.target || '')}</td><td class="small">${esc(e.reason || '')}</td><td class="mono tiny">${esc(e.hash.slice(0, 12))}…</td></tr>`).join('')}</table></div>`;
  }

  function pageSettings() {
    const st = S().settings;
    const tog = (k, label, sub) => `<label class="check" style="margin-bottom:12px"><input type="checkbox" data-a="set-toggle" data-k="${k}" ${st[k] ? 'checked' : ''}><span><b>${esc(label)}</b><div class="small muted">${esc(sub)}</div></span></label>`;
    return `<div class="grid k2"><div class="card-a"><h2>${I('receipt', 18)} Protected advance fee</h2><div class="body">
        ${tog('pilotMode', 'Pilot mode: no fee', 'During the pilot, protected advances are free (BUSINESS_PLAN.md §5).')}
        <div class="grid k3"><label class="field"><span>Fee %</span><input class="input" id="s-feePct" inputmode="decimal" value="${st.feePct}"></label><label class="field"><span>Minimum ৳</span><input class="input" id="s-feeMin" inputmode="numeric" value="${st.feeMin}"></label><label class="field"><span>Maximum ৳</span><input class="input" id="s-feeMax" inputmode="numeric" value="${st.feeMax}"></label></div>
        <label class="field" style="margin-top:10px"><span>Advance cap during the pilot (৳)</span><input class="input" id="s-advanceCap" inputmode="numeric" value="${st.advanceCap}"></label>
        <button class="btn" style="margin-top:12px" data-a="save-fees">Save</button>
        <p class="small muted" style="margin-top:10px">Example: a ৳20,000 advance pays ${money(st.pilotMode ? 0 : Math.min(st.feeMax, Math.max(st.feeMin, Math.round(20000 * st.feePct / 100))))} in fees now.</p></div></div>
      <div class="card-a"><h2>${I('bank', 18)} Escrow account (demo)</h2><div class="body"><div class="kv"><dt>Bank</dt><dd>${esc(st.escrow.bank)}</dd><dt>Branch</dt><dd>${esc(st.escrow.branch)}</dd><dt>Account name</dt><dd>${esc(st.escrow.name)}</dd><dt>Account number</dt><dd class="mono">${esc(st.escrow.number)}</dd><dt>Routing</dt><dd class="mono">${esc(st.escrow.routing)}</dd></div><p class="small muted" style="margin-top:10px">Held by the bank under the escrow agreement (LEGAL.md §2). Never our operating account.</p></div></div>
      <div class="card-a"><h2>${I('sparkle', 18)} Demo settings</h2><div class="body">
        ${tog('autoReplies', 'Demo people reply and act by themselves', 'Seeded landlords and renters answer messages, accept viewings and confirm deals in the app.')}
        ${tog('autoApprove', 'Auto-approve in the app', 'IDs, listings, bank accounts and bank statements are approved automatically, so one person can demo on one phone. Payouts still need both founders.')}
        ${tog('skipWaits', 'Skip the 48-hour wait after a bank account change', 'Real system: payouts to a new account wait 48 hours.')}
        <div class="row wrap"><button class="btn plain" data-a="export">${I('upload', 16)} Export all data (JSON)</button><button class="btn danger ghost" data-a="reset">${I('refresh', 16)} Reset demo data</button></div></div></div>
      <div class="card-a"><h2>${I('users', 18)} Founders</h2><div class="body">${S().staff.map(s => `<div class="row" style="margin-bottom:8px"><b>${esc(s.name)}</b><span class="small muted">${esc(s.place)} · ${esc(s.email)} · full access</span></div>`).join('')}<p class="small muted">Both founders see everything. Personal data is masked until a reason is typed. Every payout needs one founder to prepare it and the other to approve it.</p></div></div></div>`;
  }

  // ───────────── Drawer and modal ─────────────
  function drawer(title, body, foot) {
    return `<div class="drawer-back" data-a="close"></div><div class="drawer"><div class="drawer-head"><h2>${esc(title)}</h2><button class="icon-btn" data-a="close">${I('x', 20)}</button></div><div class="drawer-body">${body}</div>${foot ? `<div class="drawer-foot">${foot}</div>` : ''}</div>`;
  }
  function modalHTML(m) {
    return `<div class="modal-back"><div class="modal"><h2>${esc(m.title)}</h2><div class="mb">${m.text ? `<p class="small muted">${esc(m.text)}</p>` : ''}${m.options ? `<select class="input" id="mopt">${m.options.map(o => `<option>${esc(o)}</option>`).join('')}</select>` : ''}${m.input !== false ? `<textarea class="input" id="mtext" style="margin-top:8px" placeholder="${esc(m.placeholder || 'Type a reason')}"></textarea>` : ''}</div><div class="mf"><button class="btn plain" data-a="modal-cancel">Cancel</button><button class="btn ${m.danger ? 'danger' : ''}" data-a="modal-ok">${esc(m.ok || 'OK')}</button></div></div></div>`;
  }
  function ask(m, onOk) { ui.modal = Object.assign({}, m, { onOk }); renderLayer(); setTimeout(() => { const t = document.getElementById('mtext') || document.getElementById('mopt'); if (t) t.focus(); }, 30); }

  // ───────────── Render ─────────────
  const PAGES = {
    dashboard: ['Dashboard', pageDashboard], kyc: ['ID checks', pageKyc], listings: ['Listings', pageListings], accounts: ['Bank accounts', pageAccounts], money: ['Advances and bank', pageMoney],
    users: ['Users', pageUsers], scouts: ['Scouts', pageScouts], reports: ['Reports', pageReports], deletions: ['Deletions', pageDeletions], records: ['Records and deals', pageRecords],
    vault: ['Document vault', pageVault], audit: ['Audit log', pageAudit], settings: ['Settings', pageSettings],
  };
  const DRAWERS = { kyc: drawerKyc, listings: drawerListing, accounts: drawerAccount, users: drawerUser, reports: drawerReport };
  function render() {
    if (!staff()) { $root.innerHTML = loginPage(); $layer.innerHTML = ''; return; }
    const p = PAGES[ui.page] || PAGES.dashboard;
    const a = document.activeElement;
    const fid = a && a.id && /INPUT|TEXTAREA|SELECT/.test(a.tagName) ? { id: a.id, s: a.selectionStart, e: a.selectionEnd } : null;
    const scroll = window.scrollY;
    let body;
    try { body = p[1](); } catch (e) { console.error(e); body = `<div class="note danger">${I('alert', 18)}<div>${esc(e.message)}</div></div>`; }
    $root.innerHTML = shell(p[0], body);
    window.scrollTo(0, scroll);
    if (fid) { const el = document.getElementById(fid.id); if (el) { el.focus(); try { el.setSelectionRange(fid.s, fid.e); } catch (x) { /* ignore */ } } }
    renderLayer();
  }
  function renderLayer() {
    let h = '';
    const d = DRAWERS[ui.page];
    if (ui.sel && d) {
      const exists = { kyc: BB.get.idCheck, listings: BB.get.listing, accounts: BB.get.payoutAccount, users: BB.get.user, reports: BB.get.report }[ui.page](ui.sel);
      if (exists) { try { h += d(ui.sel); } catch (e) { console.error(e); } } else ui.sel = null;
    }
    if (ui.docView) { const doc = BB.get.doc(ui.docView); if (doc) h += drawer(lab('docKind', doc.kind) + ' · ' + uname(doc.userId), `<div class="docs" style="grid-template-columns:1fr">${docBox(doc.id)}</div><div class="kv small" style="margin-top:12px"><dt>Document ID</dt><dd class="mono">${esc(doc.id)}</dd><dt>Storage key</dt><dd class="mono">${esc(doc.storageKey)}</dd><dt>SHA-256</dt><dd class="mono">${esc(doc.sha256)}</dd><dt>Encryption key</dt><dd>${esc(doc.keyId)}</dd></div>`, ''); }
    if (ui.modal) h += modalHTML(ui.modal);
    const scrollEl = $layer.querySelector('.drawer-body');
    const sc = scrollEl ? scrollEl.scrollTop : 0;
    $layer.innerHTML = h;
    const ne = $layer.querySelector('.drawer-body');
    if (ne) ne.scrollTop = sc;
  }

  // ───────────── Actions ─────────────
  const me = () => session.staffId;
  const A = {
    login: el => { session.staffId = el.dataset.id; saveSession(); BB.audit('staff:' + el.dataset.id, 'staff.signed_in', null, null, { method: 'passkey (demo)' }); toast('Signed in as ' + staffName(el.dataset.id)); render(); },
    switch: () => { session.staffId = null; saveSession(); ui.sel = null; ui.revealed = {}; ui.viewedDocs = {}; render(); },
    page: el => { ui.page = el.dataset.p; ui.tab = null; ui.sel = null; ui.docView = null; location.hash = '#/' + ui.page; render(); },
    tab: el => { ui.tab = el.dataset.t; ui.sel = null; render(); },
    sel: el => { ui.sel = el.dataset.id; render(); },
    close: () => { ui.sel = null; ui.docView = null; render(); },
    reveal: el => ask({ title: 'Reveal ' + el.dataset.l + '?', text: 'Your name, the time and your reason go into the audit log and the daily reveal report.', placeholder: 'Why do you need to see this? (at least 5 characters)', ok: 'Reveal' }, txt => { BB.revealPII(me(), el.dataset.k, el.dataset.l, txt); ui.revealed[el.dataset.k] = true; }),
    'read-conv': el => ask({ title: 'Read this conversation?', text: 'Staff read chats only for safety reports or support. This is logged.', ok: 'Read' }, txt => { BB.revealPII(me(), 'conv:' + el.dataset.id, 'conversation', txt); ui.revealed['conv:' + el.dataset.id] = true; }),
    'kyc-approve': el => { BB.reviewIdCheck(me(), el.dataset.id, true); toast('Approved. They can now contact and list.'); ui.sel = null; },
    'kyc-reject': el => ask({ title: 'Reject this ID check?', options: ['Photo is blurry or cut off', 'Name does not match the document', 'Face does not match the document', 'Under 18', 'Document looks edited or fake', 'NID already used by another account'], placeholder: 'Note for the person (optional)', ok: 'Reject', danger: true }, (txt, opt) => { BB.reviewIdCheck(me(), el.dataset.id, false, opt + (txt ? ' — ' + txt : '')); toast('Rejected. They were told why and can try again.'); ui.sel = null; }),
    'lst-approve': el => { BB.reviewListing(me(), el.dataset.id, true); toast('Approved. The home is live and saved-search alerts were sent.'); ui.sel = null; },
    'lst-reject': el => ask({ title: 'Reject this listing?', options: ['Ownership proof is missing or unclear', 'Photos do not match the home', 'Price looks wrong', 'Copied photos', 'Wrong information'], placeholder: 'What should they change?', ok: 'Reject', danger: true }, (txt, opt) => { BB.reviewListing(me(), el.dataset.id, false, opt + (txt ? ' — ' + txt : '')); toast('Rejected with a reason.'); ui.sel = null; }),
    'lst-remove': el => ask({ title: 'Remove this live listing?', placeholder: 'Reason', ok: 'Remove', danger: true }, txt => { const r = BB.report(BB.get.listing(el.dataset.id).listerId, 'listing', el.dataset.id, 'Removed by staff', txt); BB.actionReport(me(), r.id, 'remove_listing', txt); toast('Removed.'); ui.sel = null; }),
    'acct-approve': el => { BB.reviewPayoutAccount(me(), el.dataset.id, true); toast('Approved.'); ui.sel = null; },
    'acct-reject': el => ask({ title: 'Reject this bank account?', options: ['Name does not match the verified NID', 'Proof is unclear', 'Account belongs to someone else'], placeholder: 'Note (optional)', ok: 'Reject', danger: true }, (txt, opt) => { BB.reviewPayoutAccount(me(), el.dataset.id, false, opt + (txt ? ' — ' + txt : '')); toast('Rejected.'); ui.sel = null; }),
    'po-prepare': el => ask({ title: el.dataset.o === 'refund' ? 'Prepare a refund to the renter?' : 'Prepare the payout to the landlord?', text: 'You prepare it; the other founder must approve it before any money moves.', placeholder: 'Note (optional)', ok: 'Prepare' }, txt => { BB.preparePayout(me(), el.dataset.id, el.dataset.o, txt || null); toast('Prepared. Now the other founder approves it.'); }),
    'po-approve': el => { el.disabled = true; BB.approvePayout(me(), el.dataset.id); toast('Approved. The bank transfer was sent.'); },
    'import-demo': () => { const r = BB.importLines(me(), BB.demoStatementLines()); toast(r.added ? `Imported ${r.added} line(s); ${r.matched} matched automatically.` : 'No new lines. A renter must tap "I\'ve sent the transfer" first.'); },
    'import-csv': () => { const lines = BB.parseStatement(document.getElementById('csv').value); if (!lines.length) throw BB.err('Paste at least one line: date, bank reference, amount, narration.'); const r = BB.importLines(me(), lines); toast(`Imported ${r.added} line(s); ${r.matched} matched.`); },
    match: el => { const sel = document.getElementById('m-' + el.dataset.id); if (!sel.value) throw BB.err('Choose an advance to match.'); BB.manualMatch(me(), el.dataset.id, sel.value); toast('Matched.'); },
    'daily-job': () => { const r = BB.runDailyJob('staff:' + me()); toast(`Daily job: ${r.due} advance(s) now due for payout, ${r.expired} scout invite(s) expired.`); },
    ukind: el => { ui.kind = el.dataset.k; render(); },
    'u-suspend': el => ask({ title: 'Suspend ' + uname(el.dataset.id) + '?', text: 'They can browse but cannot contact anyone or list.', placeholder: 'Reason', ok: 'Suspend', danger: true }, txt => { BB.setUserStatus(me(), el.dataset.id, 'suspended', txt); toast('Suspended.'); }),
    'u-activate': el => { BB.setUserStatus(me(), el.dataset.id, 'active', 'Reactivated'); toast('Reactivated.'); },
    'del-hold': el => ask({ title: 'Hold this deletion?', text: 'Only for an open fraud report or a lawful request. The person is told.', placeholder: 'Reason', ok: 'Hold' }, txt => { if (!txt.trim()) throw BB.err('Type the reason.'); BB.holdDeletion(me(), el.dataset.id, txt); toast('On hold.'); }),
    'del-now': el => ask({ title: 'Delete this account now?', text: 'Demo shortcut for the end of the 28 days: the profile is anonymised, documents are kept encrypted for 6 years.', input: false, ok: 'Delete now', danger: true }, () => { BB.completeDeletion(me(), el.dataset.id); toast('Deleted and anonymised.'); }),
    rep: el => ask({ title: { dismiss: 'Dismiss the report?', warn: 'Warn the person?', remove_listing: 'Remove the listing?', suspend_user: 'Suspend the person?' }[el.dataset.x], placeholder: 'Note (sent with the warning, or kept for the record)', ok: 'Confirm', danger: el.dataset.x !== 'dismiss' }, txt => { BB.actionReport(me(), el.dataset.id, el.dataset.x, txt); toast('Done. The reporter was told.'); ui.sel = null; }),
    'pay-scout': el => { const amt = BB.payScout(me(), el.dataset.id); toast('Paid ' + money(amt) + ' to ' + uname(el.dataset.id) + ' by bank transfer.'); },
    'verify-docs': () => { const r = BB.verifyDocs(); toast(r.ok ? `All ${r.count} documents match their fingerprints.` : `${r.bad} document(s) do not match!`, !r.ok); },
    'verify-audit': () => { const r = BB.verifyAudit(); toast(r.ok ? `Chain intact: ${r.count} entries.` : `Chain broken at entry ${r.at}!`, !r.ok); },
    'view-doc': el => { ui.docView = el.dataset.id; renderLayer(); },
    'set-toggle': el => { BB.setSetting(me(), el.dataset.k, !S().settings[el.dataset.k]); toast('Saved.'); },
    'save-fees': () => {
      const n = id => +document.getElementById(id).value;
      const pct = n('s-feePct'), min = n('s-feeMin'), max = n('s-feeMax'), cap = n('s-advanceCap');
      if (!(pct >= 0 && pct <= 20) || !(min >= 0) || !(max >= min) || !(cap > 0)) throw BB.err('Check the numbers: fee 0–20%, maximum at least the minimum.');
      BB.setSetting(me(), 'feePct', pct); BB.setSetting(me(), 'feeMin', min); BB.setSetting(me(), 'feeMax', max); BB.setSetting(me(), 'advanceCap', cap);
      toast('Saved.');
    },
    export: () => { const blob = new Blob([JSON.stringify(S(), null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'basha-bari-demo-data.json'; a.click(); BB.audit('staff:' + me(), 'data.exported'); },
    reset: () => ask({ title: 'Reset all demo data?', text: 'Everything goes back to the start: 20 homes, 5 renters, 10 landlords, 2 scouts.', input: false, ok: 'Reset', danger: true }, () => { BB.reset(); ui.sel = null; toast('Demo reset.'); }),
    'modal-cancel': () => { ui.modal = null; renderLayer(); },
    'modal-ok': () => { const m = ui.modal; const txt = (document.getElementById('mtext') || {}).value || ''; const opt = (document.getElementById('mopt') || {}).value || ''; run(() => { m.onOk(txt, opt); ui.modal = null; renderLayer(); render(); }); },
  };
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-a]');
    if (!el) return;
    const fn = A[el.dataset.a];
    if (!fn) return;
    if (el.tagName !== 'INPUT') e.preventDefault();
    run(() => fn(el, e));
  });
  document.addEventListener('input', e => { if (e.target.dataset && e.target.dataset.in === 'uq') { ui.q = e.target.value; render(); } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (ui.modal) { ui.modal = null; renderLayer(); } else if (ui.sel || ui.docView) { ui.sel = null; ui.docView = null; render(); } } });
  window.addEventListener('hashchange', () => { const p = location.hash.replace('#/', ''); if (p && p !== ui.page && PAGES[p]) { ui.page = p; ui.sel = null; render(); } });
  let pend = false;
  BB.subscribe(() => { if (pend) return; pend = true; requestAnimationFrame(() => { pend = false; if (ui.modal) return; render(); }); });
  render();
  BB.connect();
})();
