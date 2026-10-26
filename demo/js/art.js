/*
 * Basha Bari demo: drawn pictures, so the demo works offline and never needs real photos.
 * Rooms, sample ID cards (clearly marked DEMO), selfies, papers, avatars, icons and a simple map.
 */
(function (root) {
  'use strict';

  const ART = {};
  const enc = svg => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  ART.esc = esc;
  function rnd(seed) { let a = seed >>> 0; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; }

  const WALLS = ['#efe4d3', '#e3ebef', '#ece3ee', '#e5eee2', '#f3ecdc', '#e2e9ec'];
  const FLOORS = ['#c49a6c', '#b8afa4', '#d6c6ae', '#a88565', '#cdb79b', '#9f9488'];
  const ACCENTS = ['#0f7a5a', '#c0533a', '#3d6fb6', '#8a5cb8', '#c99a2e', '#2f8f8a'];
  const SOFT = ['#f6d7c3', '#cfe1f0', '#e4d4ef', '#d6ecd2', '#f3e4b8', '#cdeae7'];

  function fan(x) {
    return `<g opacity=".85"><rect x="${x - 3}" y="0" width="6" height="22" fill="#8b8b8b"/><ellipse cx="${x}" cy="26" rx="70" ry="5" fill="#9a9a9a"/><circle cx="${x}" cy="26" r="9" fill="#777"/></g>`;
  }
  function windowAt(x, y, w, h, sky, curtain) {
    return `<rect x="${x - 6}" y="${y - 6}" width="${w + 12}" height="${h + 12}" fill="#fff" opacity=".9"/>` +
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${sky}"/>` +
      `<path d="M${x + w / 2} ${y}v${h}M${x} ${y + h / 2}h${w}" stroke="#fff" stroke-width="4"/>` +
      `<rect x="${x + w * 0.6}" y="${y + h * 0.55}" width="${w * 0.35}" height="${h * 0.45}" fill="#9cc3a0" opacity=".7"/>` +
      (curtain ? `<path d="M${x - 14} ${y - 10}q16 ${h / 2} 0 ${h + 18}h18v-${h + 18}z" fill="${curtain}"/><path d="M${x + w + 14} ${y - 10}q-16 ${h / 2} 0 ${h + 18}h-18v-${h + 18}z" fill="${curtain}"/>` : '');
  }

  ART.room = function (room, seed, palette) {
    const r = rnd(seed || 1);
    const p = palette == null ? Math.floor(r() * 6) : palette % 6;
    const wall = WALLS[p], floor = FLOORS[(p + 2) % 6], acc = ACCENTS[p], soft = SOFT[(p + 1) % 6], sky = '#bfe0f5';
    let s = '';
    if (room === 'exterior') {
      const floors = 5 + Math.floor(r() * 4);
      const bw = 190 + Math.floor(r() * 40);
      const bx = 200 - bw / 2;
      const fh = 30;
      const top = 270 - floors * fh;
      const facade = ['#efe7da', '#e6e1d8', '#f1ddc9', '#dde3e6', '#ece2cf', '#e3d9cf'][p];
      s += `<defs><linearGradient id="sk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8ec9ee"/><stop offset="1" stop-color="#dff1fb"/></linearGradient></defs>`;
      s += `<rect width="400" height="300" fill="url(#sk)"/><circle cx="330" cy="50" r="22" fill="#fff2b8"/>`;
      s += `<rect x="20" y="${top + 40}" width="60" height="${270 - top - 40}" fill="#cfd6db"/><rect x="320" y="${top + 60}" width="70" height="${270 - top - 60}" fill="#d6dbe0"/>`;
      s += `<rect x="${bx}" y="${top}" width="${bw}" height="${270 - top}" fill="${facade}"/><rect x="${bx - 6}" y="${top - 8}" width="${bw + 12}" height="10" fill="#bdb3a5"/>`;
      for (let f = 0; f < floors; f++) {
        const y = top + 6 + f * fh;
        for (let c = 0; c < 3; c++) {
          const x = bx + 14 + c * ((bw - 28) / 3);
          const ww = (bw - 28) / 3 - 14;
          s += `<rect x="${x}" y="${y}" width="${ww}" height="16" fill="${r() > 0.3 ? '#9dc6e3' : '#e9d7a7'}"/>`;
          if (c !== 1) s += `<rect x="${x - 3}" y="${y + 16}" width="${ww + 6}" height="6" fill="#a9a196"/><path d="M${x - 3} ${y + 12}h${ww + 6}" stroke="#7d756c" stroke-width="1.5"/>`;
        }
      }
      s += `<rect x="${200 - 18}" y="236" width="36" height="34" fill="#6b5a4a"/><rect x="0" y="270" width="400" height="30" fill="#8c8f86"/><rect x="0" y="268" width="400" height="4" fill="#bfc2b8"/>`;
      s += `<circle cx="${bx - 10}" cy="236" r="26" fill="#5f9b5b"/><rect x="${bx - 13}" y="250" width="6" height="22" fill="#6b4f3a"/>`;
      s += `<g transform="translate(${bx + bw - 70} 226) rotate(-3)"><rect width="62" height="28" rx="3" fill="#fff" stroke="${acc}" stroke-width="2"/><text x="31" y="19" font-family="Arial,sans-serif" font-size="13" font-weight="700" text-anchor="middle" fill="${acc}">TO-LET</text></g>`;
    } else if (room === 'living') {
      s += `<rect width="400" height="300" fill="${wall}"/><rect y="215" width="400" height="85" fill="${floor}"/><path d="M0 215h400" stroke="#0002" stroke-width="3"/>`;
      s += fan(200) + windowAt(270, 70, 90, 80, sky, soft);
      s += `<rect x="70" y="72" width="70" height="50" fill="#fff" stroke="#a88" stroke-width="3"/><path d="M78 115l18-22 14 14 10-10 14 18z" fill="${acc}" opacity=".6"/>`;
      s += `<ellipse cx="170" cy="262" rx="120" ry="20" fill="${soft}" opacity=".9"/>`;
      s += `<rect x="40" y="160" width="220" height="70" rx="12" fill="${acc}"/><rect x="40" y="140" width="220" height="40" rx="12" fill="${acc}" opacity=".85"/><rect x="28" y="160" width="26" height="60" rx="8" fill="${acc}"/><rect x="246" y="160" width="26" height="60" rx="8" fill="${acc}"/>`;
      s += `<rect x="62" y="150" width="40" height="30" rx="6" fill="#fff" opacity=".55"/><rect x="190" y="150" width="40" height="30" rx="6" fill="#fff" opacity=".55"/>`;
      s += `<rect x="290" y="200" width="70" height="40" rx="4" fill="#8a6a4f"/><rect x="300" y="180" width="8" height="22" fill="#ddd"/><circle cx="304" cy="176" r="12" fill="#fff4c9"/>`;
    } else if (room === 'bedroom') {
      s += `<rect width="400" height="300" fill="${wall}"/><rect y="220" width="400" height="80" fill="${floor}"/>`;
      s += fan(190) + windowAt(40, 70, 80, 80, sky, soft);
      s += `<rect x="300" y="70" width="80" height="160" fill="#9a7b5f"/><path d="M340 70v160" stroke="#6f5643" stroke-width="2"/><circle cx="334" cy="150" r="3" fill="#e6d3b5"/><circle cx="346" cy="150" r="3" fill="#e6d3b5"/>`;
      s += `<rect x="130" y="120" width="160" height="70" rx="6" fill="#7b5b45"/><rect x="120" y="170" width="180" height="70" rx="10" fill="#fff"/><rect x="120" y="195" width="180" height="50" rx="8" fill="${acc}" opacity=".85"/>`;
      s += `<rect x="140" y="160" width="60" height="24" rx="8" fill="${soft}"/><rect x="220" y="160" width="60" height="24" rx="8" fill="${soft}"/><rect x="128" y="240" width="10" height="16" fill="#6b4f3a"/><rect x="282" y="240" width="10" height="16" fill="#6b4f3a"/>`;
    } else if (room === 'kitchen') {
      s += `<rect width="400" height="300" fill="${wall}"/>`;
      for (let y = 110; y < 190; y += 16) for (let x = 0; x < 400; x += 20) s += `<rect x="${x + 1}" y="${y + 1}" width="18" height="14" fill="#fff" opacity=".55"/>`;
      s += `<rect x="20" y="30" width="360" height="70" fill="${acc}" opacity=".8"/><path d="M110 30v70M200 30v70M290 30v70" stroke="#0003" stroke-width="2"/>`;
      s += `<rect y="190" width="400" height="16" fill="#d9d4cc"/><rect y="206" width="400" height="94" fill="${acc}" opacity=".9"/><path d="M100 206v94M200 206v94M300 206v94" stroke="#0003" stroke-width="2"/>`;
      s += `<rect x="60" y="176" width="110" height="16" rx="3" fill="#333"/><circle cx="90" cy="184" r="7" fill="#555"/><circle cx="140" cy="184" r="7" fill="#555"/><path d="M84 176q6-14 12 0M134 176q6-14 12 0" stroke="#3b82f6" stroke-width="3" fill="none"/>`;
      s += `<rect x="240" y="180" width="90" height="12" rx="4" fill="#bfc6cc"/><path d="M285 180v-22h14" stroke="#9aa3aa" stroke-width="5" fill="none"/>`;
      s += windowAt(250, 112, 70, 50, sky, null);
    } else if (room === 'bath') {
      s += `<rect width="400" height="300" fill="#eef3f5"/>`;
      for (let y = 0; y < 300; y += 25) for (let x = 0; x < 400; x += 25) s += `<rect x="${x + 1}" y="${y + 1}" width="23" height="23" fill="${(x + y) % 50 ? '#fff' : soft}" opacity=".9"/>`;
      s += `<rect x="40" y="70" width="90" height="70" rx="6" fill="#cfe6f2" stroke="#9fb7c4" stroke-width="4"/><path d="M70 160h30v60H70z" fill="#fff" stroke="#c7d0d5" stroke-width="3"/><path d="M45 150h80l-10 20H55z" fill="#fff" stroke="#c7d0d5" stroke-width="3"/>`;
      s += `<path d="M300 40v40" stroke="#9aa3aa" stroke-width="5"/><ellipse cx="300" cy="86" rx="22" ry="7" fill="#9aa3aa"/><path d="M286 98l-6 30M300 98v30M314 98l6 30" stroke="#8fc9ea" stroke-width="3" opacity=".8"/>`;
      s += `<rect x="190" y="200" width="60" height="60" rx="10" fill="#fff" stroke="#c7d0d5" stroke-width="3"/><rect x="196" y="170" width="48" height="34" rx="6" fill="#fff" stroke="#c7d0d5" stroke-width="3"/>`;
      s += `<path d="M300 230h44l-6 44h-32z" fill="${acc}" opacity=".85"/><rect x="306" y="214" width="14" height="18" rx="3" fill="${acc}"/>`;
    } else if (room === 'balcony') {
      s += `<rect width="400" height="300" fill="#bfe0f5"/><rect x="0" y="120" width="70" height="180" fill="#cfd6db"/><rect x="80" y="90" width="90" height="210" fill="#d9dee2"/><rect x="250" y="110" width="80" height="190" fill="#c9d1d7"/><rect x="340" y="140" width="60" height="160" fill="#d4d9dd"/>`;
      for (let i = 0; i < 6; i++) s += `<rect x="${92 + (i % 3) * 26}" y="${100 + Math.floor(i / 3) * 30}" width="16" height="16" fill="#9dc6e3"/>`;
      s += `<rect y="230" width="400" height="70" fill="${floor}"/><rect y="170" width="400" height="8" fill="#6f6a64"/>`;
      for (let x = 10; x < 400; x += 24) s += `<rect x="${x}" y="178" width="5" height="54" fill="#6f6a64"/>`;
      s += `<path d="M40 232h40l-6 30H46z" fill="#b5643c"/><circle cx="60" cy="214" r="22" fill="#4f9a55"/><path d="M320 232h44l-6 30h-32z" fill="#b5643c"/><circle cx="342" cy="208" r="26" fill="#5ea85f"/><circle cx="200" cy="40" r="20" fill="#fff2b8"/>`;
      s += `<path d="M140 60h140" stroke="#888" stroke-width="2"/><rect x="160" y="60" width="26" height="40" fill="${acc}" opacity=".8"/><rect x="200" y="60" width="22" height="34" fill="${soft}"/>`;
    } else {
      s += `<rect width="400" height="300" fill="${wall}"/>`;
    }
    return enc(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">${s}</svg>`);
  };

  // ───────────── Faces: avatars and selfies (all drawn, never real people) ─────────────
  const SKIN = ['#e8b98f', '#d9a37a', '#c68b62', '#b57a52', '#a56c47', '#f0c9a2'];
  const HAIR = ['#1f1a17', '#2b211b', '#3a2c22', '#4a3626', '#151515'];
  function face(seed, w, h, cx, cy, scale) {
    const r = rnd(seed || 7);
    const skin = SKIN[Math.floor(r() * SKIN.length)], hair = HAIR[Math.floor(r() * HAIR.length)];
    const long = r() > 0.5;
    const k = scale || 1;
    return `<g transform="translate(${cx} ${cy}) scale(${k})">` +
      (long ? `<path d="M-46 -10q0-62 46-62t46 62v70h-92z" fill="${hair}"/>` : '') +
      `<rect x="-14" y="30" width="28" height="22" fill="${skin}"/><path d="M-70 110q0-56 70-56t70 56z" fill="${['#3d6fb6', '#0f7a5a', '#8a5cb8', '#c0533a', '#555'][Math.floor(r() * 5)]}"/>` +
      `<ellipse cx="0" cy="0" rx="38" ry="46" fill="${skin}"/>` +
      `<path d="M-40 -8q2-48 40-48t40 48q-10-26-40-28t-40 28z" fill="${hair}"/>` +
      `<ellipse cx="-14" cy="2" rx="4.5" ry="5" fill="#222"/><ellipse cx="14" cy="2" rx="4.5" ry="5" fill="#222"/>` +
      `<path d="M-12 24q12 9 24 0" stroke="#7a3d2b" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M0 6v10" stroke="#0002" stroke-width="3" stroke-linecap="round"/>` +
      (r() > 0.6 ? `<path d="M-30 18q30 34 60 0q-6 34-30 36t-30-36z" fill="${hair}" opacity=".85"/>` : '') +
      `</g>`;
  }
  ART.avatar = function (seed, initials, size) {
    const bg = SOFT[(seed || 0) % SOFT.length];
    return enc(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="${bg}"/>${face(seed, 120, 120, 60, 58, 0.78)}</svg>`);
  };
  ART.selfie = function (seed, stage) {
    const ring = stage === 'done' ? '#1d6b3a' : '#0f7a5a';
    return enc(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 360"><rect width="300" height="360" fill="#20262b"/>` +
      `<g>${face(seed, 300, 360, 150, 170, 1.45)}</g>` +
      `<ellipse cx="150" cy="170" rx="104" ry="132" fill="none" stroke="${ring}" stroke-width="6" stroke-dasharray="${stage === 'done' ? '0' : '14 10'}"/>` +
      `<text x="150" y="344" font-family="Arial,sans-serif" font-size="13" fill="#9fb0bb" text-anchor="middle">DEMO SELFIE — DRAWN, NOT A PHOTO</text></svg>`);
  };

  // ───────────── Sample documents, all stamped DEMO ─────────────
  function stamp(w, h) {
    return `<g opacity=".18" transform="translate(${w / 2} ${h / 2}) rotate(-22)"><text font-family="Arial,sans-serif" font-size="${Math.round(w / 6)}" font-weight="700" fill="#c0392b" text-anchor="middle" dominant-baseline="middle">DEMO</text></g>`;
  }
  ART.idCard = function (a) {
    const w = 340, h = 214;
    const type = a.docType || 'nid';
    const blur = a.blurry ? `<filter id="bl"><feGaussianBlur stdDeviation="2.4"/></filter>` : '';
    const g = a.blurry ? ' filter="url(#bl)"' : '';
    const head = { nid: 'NATIONAL ID (SAMPLE)', smart_nid: 'SMART NATIONAL ID (SAMPLE)', passport: 'PASSPORT DATA PAGE (SAMPLE)', driving_licence: 'DRIVING LICENCE (SAMPLE)' }[type] || 'ID (SAMPLE)';
    const band = { nid: '#0f7a5a', smart_nid: '#0b6b8a', passport: '#1f3b73', driving_licence: '#8a3b2b' }[type] || '#0f7a5a';
    let body;
    if (a.side === 'back') {
      body = `<rect x="16" y="54" width="308" height="14" rx="3" fill="#e6ece9"/><rect x="16" y="76" width="250" height="10" rx="3" fill="#e6ece9"/><rect x="16" y="94" width="280" height="10" rx="3" fill="#e6ece9"/>` +
        `<text x="16" y="128" font-family="Arial,sans-serif" font-size="11" fill="#555">Address: House 00, Road 00, Dhaka (sample)</text>` +
        `<text x="16" y="146" font-family="Arial,sans-serif" font-size="11" fill="#555">Issue date: 01 Jan 2020 (sample)</text>` +
        Array.from({ length: 44 }, (_, i) => `<rect x="${16 + i * 7}" y="160" width="${i % 3 ? 2 : 4}" height="34" fill="#333"/>`).join('');
    } else {
      body = `<clipPath id="ph"><rect x="16" y="54" width="86" height="106" rx="6"/></clipPath><rect x="16" y="54" width="86" height="106" rx="6" fill="#eef2f1"/>` + `<g clip-path="url(#ph)">${face(a.avatar || 3, 86, 106, 59, 104, 0.6)}</g>` +
        `<text x="116" y="70" font-family="Arial,sans-serif" font-size="10" fill="#777">Name</text><text x="116" y="86" font-family="Arial,sans-serif" font-size="14" font-weight="700" fill="#111">${esc(a.name)}</text>` +
        `<text x="116" y="108" font-family="Arial,sans-serif" font-size="10" fill="#777">Date of birth</text><text x="116" y="123" font-family="Arial,sans-serif" font-size="13" fill="#111">${esc(a.dob)}</text>` +
        `<text x="116" y="145" font-family="Arial,sans-serif" font-size="10" fill="#777">${type === 'passport' ? 'Passport no.' : type === 'driving_licence' ? 'Licence no.' : 'ID no.'}</text><text x="116" y="160" font-family="Courier New,monospace" font-size="14" font-weight="700" fill="#111">${esc(a.number)}</text>` +
        `<rect x="16" y="172" width="308" height="26" rx="4" fill="#f4f6f5"/><text x="170" y="189" font-family="Arial,sans-serif" font-size="10" fill="#a33" text-anchor="middle">Sample card made by the demo. Not a real document.</text>`;
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><defs>${blur}</defs><g${g}><rect width="${w}" height="${h}" rx="14" fill="#fbfcfb" stroke="#d5dcd9"/>` +
      `<rect width="${w}" height="40" rx="14" fill="${band}"/><rect y="26" width="${w}" height="14" fill="${band}"/>` +
      `<text x="16" y="26" font-family="Arial,sans-serif" font-size="13" font-weight="700" fill="#fff">${head}</text>${body}${stamp(w, h)}</g></svg>`;
    return enc(svg);
  };
  ART.paper = function (a) {
    const w = 300, h = 380;
    const titles = {
      holding_tax: 'HOLDING TAX RECEIPT', utility_bill: 'ELECTRICITY BILL', deed: 'DEED / MUTATION (KHATIAN)', owner_permission: "OWNER'S PERMISSION LETTER",
      owner_nid: "OWNER'S NID (COPY)", bank_proof: 'CHEQUE LEAF / BANK STATEMENT',
    };
    let lines = '';
    for (let i = 0; i < 9; i++) lines += `<rect x="28" y="${120 + i * 22}" width="${180 + ((i * 37) % 70)}" height="8" rx="3" fill="#e2e6e4"/>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#fffdf7" stroke="#ddd6c8"/>` +
      `<text x="${w / 2}" y="46" font-family="Arial,sans-serif" font-size="14" font-weight="700" fill="#333" text-anchor="middle">${titles[a.kind] || 'DOCUMENT'}</text>` +
      `<text x="${w / 2}" y="66" font-family="Arial,sans-serif" font-size="10" fill="#a33" text-anchor="middle">Sample made by the demo — not a real document</text>` +
      `<text x="28" y="98" font-family="Arial,sans-serif" font-size="11" fill="#444">${esc(a.name || '')}</text>` + lines +
      `<text x="28" y="340" font-family="Arial,sans-serif" font-size="10" fill="#666">${esc((a.address || a.bank || '') + (a.last4 ? ' · A/C ••••' + a.last4 : ''))}</text>` +
      `<circle cx="240" cy="320" r="26" fill="none" stroke="#3d6fb6" stroke-width="3" opacity=".6"/>${stamp(w, h)}</svg>`;
    return enc(svg);
  };
  ART.doc = function (d) {
    if (!d) return '';
    if (d.kind === 'selfie') return ART.selfie(d.art.avatar, 'done');
    if (d.kind === 'nid_front' || d.kind === 'nid_back' || d.kind === 'passport') return ART.idCard(d.art);
    return ART.paper(d.art);
  };

  // A pattern made from the record fingerprint. It looks like a QR code but is a demo picture.
  ART.qr = function (hex) {
    const n = 25, c = 6;
    let s = `<rect width="${n * c}" height="${n * c}" fill="#fff"/>`;
    const bits = String(hex).split('').map(ch => parseInt(ch, 16).toString(2).padStart(4, '0')).join('');
    let k = 0;
    const finder = (x, y) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (finder(x, y)) continue;
      if (bits[k++ % bits.length] === '1') s += `<rect x="${x * c}" y="${y * c}" width="${c}" height="${c}" fill="#111"/>`;
    }
    for (const [x, y] of [[0, 0], [n - 7, 0], [0, n - 7]]) s += `<rect x="${x * c}" y="${y * c}" width="${7 * c}" height="${7 * c}" fill="#111"/><rect x="${(x + 1) * c}" y="${(y + 1) * c}" width="${5 * c}" height="${5 * c}" fill="#fff"/><rect x="${(x + 2) * c}" y="${(y + 2) * c}" width="${3 * c}" height="${3 * c}" fill="#111"/>`;
    return enc(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n * c} ${n * c}" shape-rendering="crispEdges">${s}</svg>`);
  };

  // ───────────── Icons (stroke icons, 24 × 24) ─────────────
  const P = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    heart: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/>',
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z"/>',
    chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    bed: '<path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9"/>',
    bath: '<path d="M9 6 6.5 3.5a1.5 1.5 0 0 0-1-.5C4.7 3 4 3.7 4 4.5V17a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/><path d="M10 5 8 7M2 12h20M7 19v2M17 19v2"/>',
    area: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h4M3 15h4M9 3v4M15 3v4"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    next: '<path d="m9 18 6-6-6-6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    alert: '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4M12 17h.01"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
    bank: '<path d="M3 22h18M6 18v-7M10 18v-7M14 18v-7M18 18v-7M12 2l9 5H3z"/>',
    qr: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h4v4h-4"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
    building: '<rect x="4" y="2" width="16" height="20" rx="1"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.4.4 1.4 1.4 2.4 2.5 2.9"/>',
    drop: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5S5 13 5 15a7 7 0 0 0 7 7z"/>',
    bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
    car: '<path d="M19 17h2v-4l-2-5H5L3 13v4h2M7 17h10"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
    wifi: '<path d="M5 13a10 10 0 0 1 14 0M8.5 16.5a5 5 0 0 1 7 0M2 8.8a15 15 0 0 1 20 0M12 20h.01"/>',
    send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    grid: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/>',
    star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2 2 9.3l6.9-1z"/>',
    compass: '<circle cx="12" cy="12" r="10"/><path d="m16.2 7.8-2.1 6.3-6.3 2.1 2.1-6.3z"/>',
    sofa: '<path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3"/><path d="M2 11a2 2 0 0 1 4 0v3h12v-3a2 2 0 0 1 4 0v6H2z"/><path d="M4 17v2M20 17v2"/>',
    stairs: '<path d="M3 21h5v-5h5v-5h5V6h3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    play: '<path d="m6 3 14 9-14 9z"/>',
    ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
    receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/><path d="M8 7h8M8 11h8M8 15h5"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  };
  ART.icon = (name, size, extra) => `<svg class="ic${extra ? ' ' + extra : ''}" width="${size || 20}" height="${size || 20}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || P.info}</svg>`;

  // ───────────── A simple map of Dhaka, used when the real map can't load (offline) ─────────────
  const BOX = { w: 90.335, e: 90.445, s: 23.735, n: 23.892 };
  ART.project = (lat, lng, W, H) => ({ x: ((lng - BOX.w) / (BOX.e - BOX.w)) * W, y: ((BOX.n - lat) / (BOX.n - BOX.s)) * H });
  ART.fallbackMap = function (W, H, areas) {
    let s = `<rect width="${W}" height="${H}" fill="#eef1ea"/>`;
    s += `<path d="M${W * 0.03} ${H} C ${W * 0.08} ${H * 0.6}, ${W * 0.02} ${H * 0.3}, ${W * 0.1} 0" stroke="#b9d7ea" stroke-width="18" fill="none"/>`;
    s += `<path d="M0 ${H * 0.52} H ${W}" stroke="#fff" stroke-width="7"/><path d="M${W * 0.5} 0 V ${H}" stroke="#fff" stroke-width="7"/><path d="M0 ${H * 0.2} L ${W} ${H * 0.35}" stroke="#fff" stroke-width="5"/>`;
    s += `<rect x="${W * 0.62}" y="${H * 0.55}" width="${W * 0.14}" height="${H * 0.08}" rx="8" fill="#cfe5c9"/>`;
    for (const a of areas) {
      const p = ART.project(a.lat, a.lng, W, H);
      s += `<text x="${p.x}" y="${p.y - 10}" font-family="system-ui,sans-serif" font-size="11" fill="#6b6a64" text-anchor="middle">${esc(a.label)}</text>`;
    }
    return s;
  };

  root.ART = ART;
  if (typeof module !== 'undefined') module.exports = ART;
})(typeof window !== 'undefined' ? window : globalThis);
