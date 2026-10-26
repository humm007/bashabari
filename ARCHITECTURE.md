# Basha Bari (বাসাবাড়ি): Architecture and Launch Plan

Version 0.4 · 26 October 2026 · Reviewed (`REVIEW.md`) · Private to the two founders

This document is how the app is built. Three companion documents cover the rest:

- `BUSINESS_PLAN.md`: customers, scouts and the first 1,000 homes, money, numbers, milestones.
- `LEGAL.md`: what to register, sign and write, and when, plus the questions for the lawyer.
- `REVIEW.md`: the check of the whole plan, what was fixed in this version and what is still open.

References like [R12] point to `REFERENCES.md`. **(verify)** marks something that comes from a
secondary source or is still changing. A Bangladeshi lawyer or accountant should confirm those
before launch.

---

## 0. The plan on one page

- **What:** a Bangla/English Android and iOS app. Verified landlords list homes and verified
  renters find them. Search and filters work like Zoopla, flatshare and sublet features come from
  SpareRoom, and the map works like Booking.com.
- **Trust:** anyone can search and see the results. Full listing details need a free sign-up with
  a phone number. To call, message, book a viewing or list a home, everyone uploads their documents:
  NID, passport or driving licence, and a live selfie, which also proves they are 18+. Landlords also prove they
  own the home or are allowed to rent it out. We run every check ourselves, with no outside ID
  company. Every document is stored encrypted, so we have it if anything goes wrong.
- **Privacy:** phone numbers, the exact address and the map pin stay hidden. Contact details are
  shared only after both sides agree a viewing time and both tap "Share my details". The app then
  makes one identical, tamper-proof record for both sides, and keeps a copy for us.
- **Homes:** paid scouts find To-Let signs. With the landlord's permission, they photograph and
  film the home and help the landlord post it. The target is 1,000 verified homes before the public
  launch.
- **Money:**
  - Free until the first 1,000 homes are live.
  - The first income is referral commission from house-shifting companies.
  - The main income is a 3% fee on the **protected advance**. The renter pays the advance by bank
    transfer into an escrow account at a Bangladeshi bank. The landlord is paid only after the
    renter moves in (§4.1).
  - Payments are by bank transfer only, and we never hold money in our own account. Details are in
    `BUSINESS_PLAN.md`.
- **Tech:**
  - Flutter app, small and smooth on Tecno, Infinix, itel and Xiaomi phones.
  - A TypeScript API built as one program split into clear modules.
  - PostgreSQL with PostGIS.
  - Docker on the home server in the UK, behind Cloudflare Tunnel.
  - Free open-source maps: MapLibre with OpenStreetMap data.
- **Path to launch:**
  1. This document.
  2. A fully clickable HTML demo that runs in a phone browser. We use it to show landlords, scouts
     and friends and to collect feedback (about 2 weeks). It uses made-up data only and never asks
     for a real NID.
  3. The real app on real phones (about 4 weeks).
  4. A closed beta in 2–3 Dhaka areas, while scouts build up the homes (weeks 10–14).
  5. Public launch on both stores once 1,000 verified homes are live (about 3½–4 months).

  Company registration runs alongside, as a Bangladeshi private limited company. Apple requires a
  company for an app that collects NIDs, and the bank escrow account needs one (`LEGAL.md`).

We copy Zoopla's *product* structure: search, then results, then the listing, then contact, plus
saved-search alerts. Zoopla's internal tech is not public, so the system design below is our own.
It is built to grow like Airbnb and Booking.com.

---

## 1. Product principles

1. **No hassle.** At most three taps from opening the app to seeing homes, with no login needed to
   search.
2. **Facts first, free text second.** The landlord answers questions (rooms, bills, gas, service
   charge) and the app writes the title in both languages. That gives clean data and strong
   filters.
3. **Only verified people can make contact.**
4. **Equal privacy.** Neither side sees more than the other, and nothing is shared until both say
   yes.
5. **Real monthly cost up front.** Every listing shows rent + service charge + which bills are
   included.
6. **Light.** It must work on a 2–3 GB RAM phone on patchy 4G and save mobile data.
7. **Built to grow.** The data model already allows rooms, mess seats, short stays and sales, so
   we can grow like Airbnb or Booking.com without a rewrite.

---

## 2. What the demo gets right, and what is missing

`Basha Bari_ demo v3 (1).html` is a good guide for how the app should look and flow. Keep:

| In the demo | Plan |
|---|---|
| Bangla/English switch with Bangla digits | Keep. Move all text into translation files. |
| 18+ check, phone OTP, NID and face check before any contact | Keep and make them real (§11). Take the age from the NID, not a typed birth date. |
| Listing form: type, owner or relation to owner, rooms, a photo for each room, service charge and what it covers, whether water and gas bills are included and where, gas type | Keep. This is the core of the structured data. Make balcony photos optional. |
| Approximate pin shown publicly, exact pin kept private | Keep. Store the shifted point once (§7). |
| Landlord call hours and a "busy today" switch | Keep as a preference shown to renters. In-app calling waits for a BTRC check (`LEGAL.md` §3). |
| Listing review before it goes live | Keep, as a moderation queue. |
| Map with price pins | Replace the drawn picture with a real map (§7). |

Missing from the demo, and added in this plan:

- A real backend. The demo keeps passwords in plain text and everything in browser memory.
- Proper filters. The demo has only area, maximum budget and bedrooms.
- **Who the landlord accepts**: family, single men, single women, students. This is the first
  filter Dhaka renters need.
- Available-from date, furnishing, size, floor and lift, advance amount, total monthly cost.
- Saved searches with alerts, and favourites.
- The landlord's side of viewing requests, the mutual "Share my details" step and the shared
  record.
- Report and block, account deletion, terms and privacy policy.
- The demo shows the full address to any logged-in user. In this plan the address appears only
  after both sides agree.

---

## 3. Users, roles and verification

One account can both rent and let, as on Airbnb. There is no separate landlord app.

| Level | What the user gives | What it unlocks |
|---|---|---|
| 0 Guest | Nothing | Search, filters, map pins, result cards (cover photo, total monthly cost, area, type, bedrooms, badges). Tapping a card shows only this preview, with "Sign up to see full details". |
| 1 Signed up | Mobile number + OTP, name, language | Full listing details (all photos, bills, service charge, description, every fact), favourites, saved searches, alerts |
| 2 Verified person | NID front and back (or passport, or driving licence front and back), a live selfie with a blink/turn check, NID number and date of birth (must be 18+) | Call, message, request viewings, share details, list a home |
| 3 Verified home (per listing) | Proof of ownership or permission (below) | Listing goes live with an "Ownership checked" badge |
| 4 Inspected (later, paid) | Our field agent visits | "Inspected" badge |

Nobody below level 2 sees anything that identifies the landlord or the exact home: no name, no
phone number, no street, no exact pin. Phone numbers and the exact address appear only in the
shared record, after both sides agree (§4).

Which level unlocks full details is a feature flag. If we later want documents before details, it
is a one-line change.

Keeping search open to guests is what Zoopla and SpareRoom do. It also helps growth and app store
review (§14).

**Proof for a home** (any one of):

- the holding tax receipt from the City Corporation, in the owner's name
- a recent electricity, gas or WASA bill in the owner's name
- the deed or mutation papers (khatian/porcha)

If the person listing is not the owner (family, caretaker or agent), they also give:

- the owner's signed permission letter (the app has a template)
- the owner's NID
- their relationship to the owner (the demo already asks this)

**Scouts** are verified at level 2 like everyone else, and they also sign the scout agreement. A
scout can prepare a listing for a landlord. It goes live only after the landlord confirms it with
an OTP on their own phone and verifies (levels 2 and 3). See §4.2 and `BUSINESS_PLAN.md` §4.

**Payout bank account** (landlords, for protected advances in phase 2):

- The landlord adds a bank account in their own name: account name, number, bank and branch, plus a
  photo of a cheque leaf or bank statement.
- Staff check that the account name matches the verified NID name. When a caretaker lists with
  permission, it must match the owner's name.
- So a fake landlord can't receive money, even if their photos fool us.

**What we collect, and when.** We collect only what each step needs, which is also what the data
law asks [R12].

| Step | Renter | Landlord |
|---|---|---|
| Sign-up | Phone, name, language | Same |
| Verification | NID, passport or driving licence, selfie, date of birth | Same |
| Profile (shown to the other side at contact time) | Who is moving in (family, single, student, job holder), number of people, occupation | Role (owner, caretaker, agent) |
| Listing | — | Address, pin, proof, photos, all listing facts |
| Agreement and police form (phase 2) | Permanent address, emergency contact, family members (used only to fill the PDF) | Same |
| Protected advance (phase 2) | The bank account the payment came from, taken from the bank statement and used only for refunds | Payout bank account in their own name, with proof |

Scouts give the same as everyone else, plus a bank account for their pay.

**How verification works at launch:**

1. The phone checks liveness on the device with ML Kit, which is free [R60].
2. The server compares the NID photo with the selfie using OpenCV SFace, which is free for
   commercial use under the Apache-2.0 licence [R61]. Many popular face models are licensed for
   non-commercial use only, so check the licence before using any other model.
3. The server checks the NID number format, that the person is 18+, and that the NID is not
   already used by another account.
4. A person on our team gives the final approval, within 2 hours, between 9am and 11pm Dhaka
   time. Your brother covers 9am–5pm Dhaka. You cover 5pm–11pm Dhaka from the UK: that is
   11am–5pm UK time in winter, and 12pm–6pm in summer.
5. We run all of this ourselves, with no outside ID company. Per-check fees add up, and we keep
   every document under our own control.

Phase 2 adds an Election Commission NID check through an approved channel, once the company is
registered (`LEGAL.md` §3).

**How every document is stored.** We keep every file people upload, for our own security: NID,
passport, selfie, ownership proof, the owner's permission letter and the owner's NID.

- It is encrypted on the way to us (TLS) and in storage, in the ID vault, with its own key.
- **Nothing is ever overwritten.** A re-upload adds a new version and keeps the old one.
- Each file's SHA-256 fingerprint is stored, and a weekly job checks that every file still matches.
  So we can prove a document is exactly what the user uploaded.
- Only the verification team can open the files, inside the admin panel. Every view is logged with
  a reason.
- The main copy stays on our server. An encrypted backup copy goes to Cloudflare R2, and the key
  never leaves our server (§17). How long we keep them is in §13.

---

## 4. The main flow: search → viewing → mutual contact

```
RENTER                              BASHA BARI                              LANDLORD
 1 Finds a home, taps "Message" ──► phone numbers, links, bKash hidden ──► sees the verified renter
 2 Proposes viewing times       ──►                                     ──► 3 Accepts one, or offers another
                                ◄── "Viewing agreed: Sat 2 Nov, 11:00" ◄──
 4 Taps "Share my details"      ──► waits until BOTH have said yes     ◄── 4 Taps "Share my details"
   (confirms with OTP or fingerprint)                                       (confirms with OTP or fingerprint)
                                    5 Builds ONE snapshot:
                                      both people, the home, the exact
                                      address and pin, the agreed time
                                      → fingerprint (hash) → store → one PDF (bn + en)
 6 Gets the identical record    ◄──                                     ──► 6 Gets the identical record
```

Rules:

- **Before step 5**, chat hides phone numbers (01XXXXXXXXX, +880, and the same in Bangla digits),
  bKash and Nagad numbers, links and email addresses. It also shows a warning: *"Never pay any
  advance before you have seen the home and signed."*
- Either side can withdraw before step 5. After step 5 the record never changes. A new viewing
  makes a new record.
- **What the record contains:**
  - **Both sides:** verified name, verification photo, phone number, last 4 digits of the NID
    (••••1234), date verified.
  - **Renter:** household type, number of people, occupation.
  - **Landlord:** role (owner, caretaker or agent), full address, exact pin, call hours, and the
    listing facts at that moment (rent, service charge, bills, advance).
  - **Agreed:** the viewing date and time.
  - Record ID, SHA-256 fingerprint and a QR code.
- Anyone can scan the QR code, which opens `<our-domain>/v/<code>`. That page only says *"Genuine
  record, issued on <date>, between two verified users"*. It never shows personal data.
- We keep every record encrypted. It is the evidence if anything goes wrong later.
- **Deal and advance receipt (launch):**
  - After the viewing, both sides confirm the agreed rent, advance and move-in date with OTP. This
    is the **deal** record (§9.2), and the listing becomes "let agreed".
  - When the renter pays the landlord directly, both tap *"Advance paid: ৳X"* and confirm with OTP.
    The app adds an identical signed receipt to the deal.
  - We never touch the money.
- **Phase 2:** the same handshake produces a rental agreement and a pre-filled DMP CIMS tenant form
  [R19]. Both sides sign with OTP and both get the identical PDF. We do not submit it to the police
  on their behalf.

### 4.1 Protected advance (phase 2): bank transfer only

```
RENTER                              BASHA BARI + BANK ESCROW ACCOUNT        LANDLORD
 1 Deal confirmed by both (OTP)                                         ◄── payout account in their own
                                                                            name, checked against the NID
 2 Pays advance + fee by BEFTN/NPSB ─► escrow account at the bank,
   with reference BB-7K3Q9             matched by the reference
                                    ── "Advance received and held" ────► both sides see it
 3 Taps "I've moved in"             ─► payout within 24 h:
   (or 72 h pass after the move-in     founder A prepares, founder B approves
    date with no problem reported)  ─────────────────────────────────────► advance paid to the landlord
                                       our fee moves to the company account
 3' Reports a problem               ─► money frozen, decided within 48 h ─► refund to the renter (with our
                                                                            fee) or payout to the landlord
```

Rules:

- **The money stays in the bank's escrow account,** under an agreement with the bank
  (`LEGAL.md` §2). It never goes through our own operating account.
- **Bank transfer only.** BEFTN is free and NPSB costs up to ৳10 [R66, R67]. There is no bKash,
  Nagad or card gateway, so there is no 1.5–2.5% gateway charge [R71]. A renter with only a wallet
  can still send to the bank account through NPSB, and their wallet's charge applies [R66].
- **Matching:**
  - The reference code is unique to each advance, and the amount must be exact.
  - At first, staff import the bank statement daily and the admin panel matches the lines.
    Unmatched lines go to a queue.
  - Later, we use a bank API if the bank offers one.
- **Payouts and refunds** need two people (§11). Payouts go only to the approved account. Refunds go
  only to the account the money came from.
- **Pilot limits:**
  - one area only
  - only verified landlords whose ownership papers are checked
  - advances up to ৳50,000
  - no fee during the pilot
- **Fee:** after the pilot, 3%, minimum ৳199, maximum ৳1,500, VAT included (`BUSINESS_PLAN.md`
  §5).

### 4.2 Scout-assisted listing

1. **The scout captures the home.** In Scout mode they take photos with the in-app camera, plus an
   optional video of up to 30 seconds, and fill in the facts. Location is used only while
   capturing, to confirm the phone is at the home. That point is stored encrypted and never shown.
   If someone still lives in the home, the scout asks them as well. No people, faces, family
   photos or papers may appear in any shot.
2. **The landlord is invited.** The scout types the landlord's phone number, and the landlord gets
   an SMS link.
3. **The landlord confirms.** On their own phone, they confirm the listing and the publishing
   consent with an OTP, then verify (levels 2 and 3).
   - The listing is created under the landlord's account, not the scout's.
   - If the landlord doesn't confirm within 7 days, the draft and the phone number are deleted.
   - **No smartphone?** The OTP still goes by SMS to the landlord's own phone, and the landlord
     reads it out to the scout in person. The NID photo and selfie are taken on the scout's phone,
     with the landlord there. The OTP still proves the phone is theirs, and the ownership papers
     are still checked.
4. **Review.** The usual review runs, and the listing goes live.
5. **Pay.** The scout's pay is recorded: ৳150 when the listing goes live, and a bonus if a deal is
   confirmed within 60 days.

---

## 5. Features: at launch and later

| Area | MVP (launch) | Phase 2 (months 3–6) | Phase 3+ |
|---|---|---|---|
| Listing types | Flat, house, sublet room (সাবলেট), mess seat, studio | Hostel seat. Room-wanted ads, where renters post what they need (SpareRoom [R4]). | Shop/office, short stays (nightly), homes for sale |
| Search | Area autocomplete in Bangla or English, every filter in §6, list and map, sort, saved search with alerts | Draw an area on the map, "near me", nearby schools, hospitals and bus stops | Travel time to an office or university (Zoopla [R2]) |
| Trust | Phone + NID + selfie, ownership proof, review queue, report and block, scam warnings | Election Commission NID check, "photos taken in the app" badge | Inspected badge, two-way reviews after move-in |
| Contact | Chat, viewing requests, mutual sharing with an identical record | Rental agreement and DMP form PDFs, call hours | In-app calls, only if BTRC allows them |
| Landlord tools | Post, edit, pause, mark as let, call hours, "busy today" switch | Web portal, views and enquiries stats | Agent and developer accounts with teams |
| Getting homes | Scout mode: in-app photos and video, landlord confirms by OTP (§4.2) | Scouts do paid inspection visits | |
| Money | Everything free. Advance receipts confirmed by OTP. | House-shifting referrals. Protected advance by bank transfer into a bank escrow account (§4.1): a free pilot, then a 3% fee. Inspection visits. | Agent plans, boosts, rent and deposits held for the whole tenancy |

---

## 6. Search and filters

| Filter | Values | Source |
|---|---|---|
| Location | Area autocomplete that accepts any spelling, in Bangla or English. Several areas at once. "Mirpur" includes Mirpur 1, 2, 10, 11 and so on. | Zoopla location search |
| Map area | "Search as I move the map". Drawing your own area comes in phase 2. | Booking.com, Zoopla [R3] |
| Type | Flat, house, sublet, mess seat, studio | |
| Total monthly cost | Min–max ৳ (rent + service charge) | Real cost, no surprises |
| Bedrooms, bathrooms | Min–max bedrooms, minimum bathrooms | Zoopla |
| Who can rent | Family, single man, single woman, student, job holder | Dhaka's most-needed filter |
| Available from | Now, or by a date | Zoopla |
| Furnishing | Unfurnished, semi-furnished, furnished | Zoopla [R3] |
| Size | Min–max sq ft | |
| Floor | Ground, 1–3, 4+, and "lift required" | |
| Gas | Pipeline or cylinder | Big cost difference in Dhaka |
| Bills included | Water, gas, electricity | Demo |
| Must-haves | Lift, generator, car or bike parking, guard or CCTV, gated, rooftop, servant room, attached bath and similar | Zoopla "must-haves" |
| Advance | Maximum number of months | |
| Lifestyle (rooms and mess seats) | Pets allowed, smoking allowed, gender of the household | SpareRoom [R4] |
| Trust | Verified owner only, inspected only | |
| Added | Last 24 hours, 3 days, 7 days or 14 days | Zoopla "date added" [R3] |
| Status | Hide homes already agreed (on by default) | Zoopla "include let agreed" [R3] |
| Keywords | Free text in the title and description | |
| Sort | Recommended, newest, lowest price, highest price, nearest | |

**Never used as filters:** religion, ethnicity, caste or anything similar. That is discrimination,
and it puts the app at risk in store review.

**Saved searches and alerts:** an instant push or a daily summary when a matching home goes live.
This is the feature that keeps Zoopla users coming back.

---

## 7. A map like Booking.com, for free

**Yes, the map can be completely free.** Here is how:

| Part | What we use | Cost |
|---|---|---|
| Map engine in the app | MapLibre (open source), with the Flutter plugin `maplibre_gl` [R40, R41] | Free |
| Map data | OpenStreetMap, which already has Bangla place names | Free. We must show "© OpenStreetMap contributors" [R46]. |
| Map tiles (the map picture itself) | **Start:** the public OpenFreeMap server. It needs no key, has no limits and allows commercial use [R42]. **Then:** our own Bangladesh map file (a Protomaps PMTiles file cut to the Bangladesh area) hosted on Cloudflare R2 [R43, R50]. | Free. The R2 free tier gives 10 GB of storage with no download charges. |
| Price pins | Our own database: one query returns the homes inside the visible map area (§9.3) | Free |
| Address search | Our own area table (division → district → thana → area) built from open datasets [R48], plus the landlord dropping a pin | Free |

**Don't:**

- Load maps straight from `tile.openstreetmap.org` in an app. Their policy forbids heavy use like
  that [R44].
- Use the public Nominatim server for address search. It allows only one request per second and no
  heavy use [R45].

**Google Maps?** Map loads in the Android and iOS SDKs cost $0, but Google requires a billing card,
and its place search and geocoding cost money [R47]. We don't need it.

**How the pins work:**

1. The app sends the visible map area and the current filters.
2. Zoomed out, the server groups homes into clusters, for example "23 homes from ৳12k".
3. Zoomed in, each home gets its own pin with its price, for example "৳18k". Tapping a pin slides up
   a card, and the card opens the listing.
4. **Each pin sits at a shifted public point**, a random 150–400 m away from the real spot. This
   point is chosen **once**, when the listing is created, and stored. Because it never changes,
   repeated requests can't be averaged to find the real spot. The listing page shows a circle, not
   a pin, as Airbnb does. The exact pin appears only in the shared record.
5. **The server strips GPS data (EXIF) from every photo.** Phone cameras save the exact location
   inside each photo.

---

## 8. System architecture

### 8.1 Overview

```
 Android + iOS app (Flutter)              Web: share pages · /v/<code> check · /delete-account
            │ HTTPS (TLS 1.3)                         │
            ▼                                         ▼
 ┌─────────────────────────── Cloudflare (free plan) ──────────────────────────┐
 │ DNS · CDN cache for public search and photos · firewall and rate limits ·    │
 │ Tunnel (no open ports at home) · Access (locks the admin panel)              │
 └───────────────┬──────────────────────────────────────┬───────────────────────┘
                 │ tunnel                                │ R2: public listing photos, map file
                 ▼
 ┌──────────────────────── Home server · Docker Compose ───────────────────────┐
 │ cloudflared ─► api (Fastify, 2 copies) ─┬─ postgres + postgis (all data, personal data encrypted)
 │                                          ├─ valkey (cache, rate limits, OTP codes, job queue)
 │                                          ├─ worker (photos, PDFs, alerts, SMS, push, deletions)
 │                                          │     └─ gotenberg (PDFs that render Bangla correctly)
 │                                          └─ id-vault volume (encrypted NID, selfie, proof and bank-proof files)
 │ web (share pages + admin) · uptime-kuma · backup (pgBackRest + restic → off-site; vault copy → R2)
 └──────────────────────────────────────────────────────────────────────────────┘
 Outside services: SMS provider (BTRC-registered) · FCM/APNs push
 Phase 2: bank escrow account at a Bangladeshi bank (statement import, two-person payouts in the
          bank's business internet banking) · Election Commission NID check
```

### 8.2 Tech stack

| Layer | Choice | Why |
|---|---|---|
| Mobile app | **Flutter** (Dart): one codebase for Android and iOS | Compiles to native code, so it runs smoothly on cheap phones. Play delivers a small download built for each device [R57]. Renders Bangla conjuncts correctly. Good map and camera plugins. |
| App libraries | Riverpod (state), go_router, dio with a client generated from OpenAPI, drift (SQLite offline cache), flutter_secure_storage, maplibre_gl, google_mlkit_face_detection, firebase_messaging. The Noto Sans Bengali font is bundled [R65]. | Old phones have inconsistent Bangla system fonts, so we ship our own. |
| API | **TypeScript** on Node.js 24 LTS: Fastify, Kysely (type-safe SQL that stays close to raw SQL), Zod checks on every input, OpenAPI 3.1 [R63] | Same language as the demo, a large developer pool in Bangladesh, fast |
| Database | **PostgreSQL 18 + PostGIS 3.6 + pg_trgm** [R52] | One database covers data, map queries and fuzzy text search |
| Cache, limits, jobs | Valkey (the open-source Redis) + BullMQ [R63] | OTP codes, rate limits, background jobs |
| Files | **Public listing photos and scout videos:** Cloudflare R2, which has no download charges and is served through the CDN [R50]. **NID, selfie and proof files:** an encrypted "ID vault" on the server's own disk, with an encrypted copy in R2. | Keeps the home internet connection free for API traffic, and keeps ID files under our own control (§11, §17) |
| Payments (phase 2) | **Bank transfer only** (BEFTN or NPSB) into an escrow account at a Bangladeshi bank. No bKash, Nagad or card gateway. | BEFTN is free and NPSB costs up to ৳10 [R66, R67]. Apple Pay isn't available in Bangladesh, and Google Wallet only does tap-to-pay in shops [R69, R70]. |
| PDFs | Gotenberg (headless Chromium) [R56] | Most PDF libraries break Bangla conjuncts (যুক্তাক্ষর). Chromium renders them correctly. |
| Push | Firebase Cloud Messaging for Android and iOS [R59] | Free. Still delivers when Xiaomi or Tecno phones kill background apps [R58]. |
| SMS | A BTRC-registered Bangladeshi SMS provider with a masked sender name "BashaBari" [R27] | About ৳0.3–0.65 per SMS at vendor prices (verify) |
| Admin | A small React web app behind Cloudflare Access, free for up to 50 users [R51] | The admin panel is never open to the public internet |
| Errors | Firebase Crashlytics in the app. Sentry free tier or GlitchTip on the server. | |

### 8.3 Modules inside the API

Each module owns its own tables. Other modules call it and never touch its tables directly. Any
module can later become its own service, which is how Airbnb- or Booking-style growth happens
without a rewrite.

| Module | Owns |
|---|---|
| identity | accounts, devices, sessions, OTP |
| verification | NID and selfie checks, ownership proofs, badges, the ID vault |
| listings | properties, listings, photos, amenities |
| search | the listing_search table, saved searches, alerts, map queries |
| conversations | chat, number hiding, viewing requests |
| agreements | consent, contact records; later the rental agreement and DMP form |
| trust | reports, blocks, fraud signals, the audit log |
| notifications | push, SMS, in-app inbox |
| payments (phase 2) | payout accounts, protected advances, bank statement imports, payouts, refunds, fees |
| scouts | scouts, submissions, landlord invites, scout pay |
| billing (later) | boosts, app store purchase receipts |
| admin | staff accounts, review queues, support tools |

Modules share events through an `outbox` table. For example, `listing.published` triggers the
saved-search alert job. Later the same events can go to a message bus without changing the
modules.

### 8.4 Repository layout

```
basha-bari/
├── apps/
│   ├── mobile/            Flutter app (Android + iOS)
│   ├── admin/             React admin (behind Cloudflare Access)
│   └── web/               share pages, /v/<code>, /delete-account, terms, privacy
├── services/
│   └── api/               TypeScript modular monolith
│       └── src/modules/   identity · verification · listings · search · conversations
│                          agreements · trust · notifications · payments · scouts
│                          billing · admin
├── db/migrations/         numbered plain-SQL migrations
├── contracts/             openapi.yaml → generates the Dart and TypeScript clients
├── infra/                 docker-compose.yml, cloudflared, backup scripts, runbooks
└── docs/                  ARCHITECTURE.md, BUSINESS_PLAN.md, LEGAL.md, REFERENCES.md, decision log
```

### 8.5 API style

- REST with JSON under `/v1/...`, cursor pagination and ETags. Responses are compressed (gzip or
  brotli).
- **Every "create" request carries an idempotency key.** On bad mobile networks the app retries, and
  the key stops a retry from creating a duplicate.
- **Access is checked on the server, never only in the app.** Guests get only the card fields. The
  full listing endpoint needs a signed-in user, and every contact endpoint (call, message, viewing)
  needs a verified one.
- Chat uses a WebSocket while the app is open and FCM push when it is closed.
- Listing pages also exist on the web, so links shared on Facebook or WhatsApp open properly. They
  open in the app when it is installed (Android App Links, iOS Universal Links).

### 8.6 App screens

The bottom tabs are **Search · Saved · Messages · My homes · Account**.

- **Search:** search bar, quick filter chips, list or map toggle, sort, "Save search".
- **Listing:** photos grouped by room, price and total monthly cost, key facts as icons, a bills
  table, an approximate-area circle on the map, verification badges, and "Message" or "Request
  viewing" buttons. Guests see only the cover photo and the key facts, with a "Sign up to see full
  details" button.
- **Post a home:** the demo's form split into six short steps, with a progress bar and an
  automatically saved draft.
- **Verification:** NID photo capture with a frame guide, a selfie liveness check, status.
- **Messages:** chats, viewing proposals, the "Share my details" card, contact records, the
  "Advance paid" receipt.
- **Protected advance** (phase 2): bank details with the reference code, "Advance received and
  held", "I've moved in", "Report a problem".
- **Scout mode** (scouts only): the capture checklist, in-app camera and 30-second video, the facts
  form, "Send to landlord", my submissions and earnings.
- **Account:** language, profile, verification status, my records, safety tips, help, terms,
  privacy, delete account.

---

## 9. Database and SQL

### 9.1 Rules that keep it fast and safe

- **Only live listings are in `listing_search`.** It is a narrow table with just the columns search
  needs. It is small enough to stay in memory, so searches take a few milliseconds.
- **The API adds only the filters the user picked.** Kysely builds the WHERE clause, with no
  `($1 IS NULL OR ...)` tricks, so Postgres always picks the right index.
- **Cursor (keyset) pagination, never `OFFSET`.** Page 50 is as fast as page 1.
- **No exact counts.** We count up to 1,001 and show "1,000+".
- **Values always go in as parameters.** SQL is never built by joining strings, which blocks SQL
  injection.
- **Personal data is stored encrypted** with AES-256-GCM: phone, NID number, date of birth, legal
  name, address and exact pin. Lookups by phone or NID use a keyed hash (HMAC), called a "blind
  index".

### 9.2 Core schema (PostgreSQL 18 + PostGIS 3.6)

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ───────────── Places: division → district → city/upazila → thana → area ─────────────
CREATE TABLE area (
  id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  parent_id  integer REFERENCES area(id),
  level      smallint NOT NULL CHECK (level BETWEEN 1 AND 5),
  name_en    text NOT NULL,
  name_bn    text NOT NULL,
  path       integer[] NOT NULL,              -- ids from division down to this area
  centroid   geometry(Point, 4326) NOT NULL
);
CREATE INDEX area_parent ON area (parent_id);

CREATE TABLE area_alias (                     -- every way people type a place
  area_id  integer NOT NULL REFERENCES area(id) ON DELETE CASCADE,
  alias    text    NOT NULL,                  -- normalised: 'mirpur 10', 'মিরপুর 10', 'mirpoor'
  PRIMARY KEY (alias, area_id)
);
CREATE INDEX area_alias_trgm ON area_alias USING gin (alias gin_trgm_ops);
-- The API normalises input and aliases the same way: lower-case,
-- Bangla digits → 0-9, punctuation removed, single spaces.

-- ───────────── Staff (separate from app users; sign in with passkeys) ─────────────
CREATE TABLE staff (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  email        text NOT NULL UNIQUE,
  name         text NOT NULL,
  role         text NOT NULL CHECK (role IN ('moderator', 'kyc_reviewer', 'support', 'admin')),
  disabled_at  timestamptz
);

-- ───────────── Users and devices ─────────────
CREATE TYPE account_status AS ENUM ('active', 'suspended', 'deletion_pending', 'deleted');

CREATE TABLE app_user (
  id                  uuid PRIMARY KEY DEFAULT uuidv7(),
  phone_hmac          bytea NOT NULL UNIQUE,     -- HMAC-SHA256(pepper, '+8801XXXXXXXXX')
  phone_enc           bytea NOT NULL,            -- AES-256-GCM ciphertext
  display_name        text  NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 60),
  lang                text  NOT NULL DEFAULT 'bn' CHECK (lang IN ('bn', 'en')),
  verification_level  smallint NOT NULL DEFAULT 1 CHECK (verification_level BETWEEN 1 AND 2),
  household           smallint,                  -- same bits as listing.accepts (see below)
  household_size      smallint,
  occupation          text,
  status              account_status NOT NULL DEFAULT 'active',
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_device (
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id       uuid NOT NULL REFERENCES app_user(id),
  platform      text NOT NULL CHECK (platform IN ('android', 'ios')),
  push_token    text,
  refresh_hash  bytea NOT NULL,                 -- hash of the current refresh token, rotated on use
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at    timestamptz
);
CREATE INDEX user_device_active ON user_device (user_id) WHERE revoked_at IS NULL;

-- ───────────── ID vault: every document anyone uploads ─────────────
CREATE TABLE vault_document (
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id       uuid NOT NULL REFERENCES app_user(id),      -- who uploaded it
  kind          text NOT NULL CHECK (kind IN ('nid_front', 'nid_back', 'passport', 'selfie',
                                              'holding_tax', 'utility_bill', 'deed',
                                              'owner_permission', 'owner_nid', 'bank_proof')),
  replaces_id   uuid REFERENCES vault_document(id),         -- re-uploads add a version, never overwrite
  storage_key   text    NOT NULL UNIQUE,                    -- random name of the encrypted file
  key_id        text    NOT NULL,                           -- which wrapped data key encrypts it
  sha256        bytea   NOT NULL,                           -- fingerprint of the original file
  bytes         integer NOT NULL,
  mime          text    NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp',
                                                 'application/pdf')),
  uploaded_at   timestamptz NOT NULL DEFAULT now(),
  retain_until  timestamptz,                                -- set when the account is deleted (§13)
  purged_at     timestamptz
);
CREATE INDEX vault_by_user   ON vault_document (user_id);
CREATE INDEX vault_purge_due ON vault_document (retain_until) WHERE purged_at IS NULL;

-- ───────────── Identity checks (KYC) ─────────────
CREATE TABLE identity_check (
  id                uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id           uuid NOT NULL REFERENCES app_user(id),
  doc_type          text NOT NULL CHECK (doc_type IN ('nid', 'smart_nid', 'passport', 'driving_licence')),
  doc_number_hmac   bytea NOT NULL,              -- stops one NID opening many accounts
  doc_last4         char(4) NOT NULL,            -- shown on contact records as ••••1234
  legal_name_enc    bytea NOT NULL,
  dob_enc           bytea NOT NULL,
  doc_front_id      uuid NOT NULL REFERENCES vault_document(id),
  doc_back_id       uuid REFERENCES vault_document(id),
  selfie_id         uuid NOT NULL REFERENCES vault_document(id),
  liveness_passed   boolean NOT NULL,
  face_match_score  real,
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by       uuid REFERENCES staff(id),
  reviewed_at       timestamptz,
  reject_reason     text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX identity_one_account_per_doc
  ON identity_check (doc_number_hmac) WHERE status = 'approved';
CREATE INDEX identity_review_queue
  ON identity_check (created_at) WHERE status = 'pending';

-- ───────────── Homes and listings ─────────────
CREATE TYPE listing_kind   AS ENUM ('flat', 'house', 'studio', 'sublet', 'mess_seat',
                                    'hostel_bed', 'commercial');
CREATE TYPE listing_status AS ENUM ('draft', 'in_review', 'active', 'paused',
                                    'let_agreed', 'closed', 'rejected', 'removed');

CREATE TABLE property (                        -- the physical home; it can have many listings over time
  id                 uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_user_id      uuid NOT NULL REFERENCES app_user(id),
  area_id            integer NOT NULL REFERENCES area(id),
  address_enc        bytea NOT NULL,             -- full address: shown only after both sides agree
  exact_point_enc    bytea NOT NULL,             -- exact pin: same rule
  public_point       geometry(Point, 4326) NOT NULL,  -- shifted 150–400 m, chosen once, stored
  lister_role        text NOT NULL CHECK (lister_role IN ('owner', 'family', 'caretaker', 'agent')),
  relation_to_owner  text,
  proof_status       text NOT NULL DEFAULT 'pending'
                     CHECK (proof_status IN ('pending', 'approved', 'rejected')),
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE property_proof (                  -- ownership or permission papers for one home
  property_id  uuid NOT NULL REFERENCES property(id),
  document_id  uuid NOT NULL REFERENCES vault_document(id),
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by  uuid REFERENCES staff(id),
  reviewed_at  timestamptz,
  PRIMARY KEY (property_id, document_id)
);

CREATE TABLE listing (
  id                  uuid PRIMARY KEY DEFAULT uuidv7(),
  property_id         uuid NOT NULL REFERENCES property(id),
  lister_user_id      uuid NOT NULL REFERENCES app_user(id),
  kind                listing_kind   NOT NULL,
  status              listing_status NOT NULL DEFAULT 'draft',
  price_period        text     NOT NULL DEFAULT 'month' CHECK (price_period IN ('month', 'night')),
  rent_bdt            integer  NOT NULL CHECK (rent_bdt BETWEEN 500 AND 5000000),
  service_charge_bdt  integer  NOT NULL DEFAULT 0 CHECK (service_charge_bdt >= 0),
  service_covers      text,                      -- "guard, lift, generator, cleaning"
  advance_months      numeric(3,1) NOT NULL DEFAULT 1 CHECK (advance_months BETWEEN 0 AND 12),
  bedrooms            smallint NOT NULL CHECK (bedrooms  BETWEEN 0 AND 20),
  bathrooms           smallint NOT NULL CHECK (bathrooms BETWEEN 0 AND 20),
  balconies           smallint NOT NULL DEFAULT 0,
  size_sqft           integer  CHECK (size_sqft BETWEEN 50 AND 50000),
  floor_no            smallint,                  -- 0 = ground floor
  total_floors        smallint,
  furnishing          smallint NOT NULL DEFAULT 0 CHECK (furnishing BETWEEN 0 AND 2),  -- 0 none, 1 semi, 2 full
  gas                 text NOT NULL CHECK (gas         IN ('pipeline', 'cylinder', 'none')),
  water_bill          text NOT NULL CHECK (water_bill  IN ('tenant', 'in_rent', 'in_service')),
  gas_bill            text NOT NULL CHECK (gas_bill    IN ('tenant', 'in_rent', 'in_service')),
  electricity         text NOT NULL CHECK (electricity IN ('prepaid', 'postpaid', 'in_rent')),
  amenities           bigint   NOT NULL DEFAULT 0,  -- bit flags, see table amenity
  accepts             smallint NOT NULL,            -- bit flags: 1 family, 2 single men, 4 single women,
                                                    --            8 students, 16 job holders
  available_from      date     NOT NULL,
  title_bn            text NOT NULL,                -- generated from the facts, editable
  title_en            text NOT NULL,
  description         text CHECK (char_length(description) <= 3000),
  call_hours          jsonb,                        -- {"days":["Sat","Sun"],"from":"09:00","to":"18:00"}
  published_at        timestamptz,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX listing_by_lister    ON listing (lister_user_id);
CREATE INDEX listing_review_queue ON listing (created_at) WHERE status = 'in_review';

CREATE TABLE amenity (                          -- lift, generator, parking_car, parking_bike, cctv,
  bit      smallint PRIMARY KEY CHECK (bit BETWEEN 0 AND 62),   -- guard, gated, rooftop, servant_room,
  code     text NOT NULL UNIQUE,                                -- attached_bath, pets_ok, smoking_ok ...
  name_en  text NOT NULL,
  name_bn  text NOT NULL
);

CREATE TABLE listing_photo (
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  listing_id    uuid NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
  room          text NOT NULL,                   -- 'living', 'bedroom_1', 'kitchen', 'bath_1' ...
  position      smallint NOT NULL,
  storage_key   text NOT NULL,                   -- R2 key; 400 / 800 / 1600 px WebP versions
  thumbhash     bytea NOT NULL,                  -- ~25-byte blurred preview shown instantly
  taken_in_app  boolean NOT NULL DEFAULT false,
  UNIQUE (listing_id, position)
);

-- ───────────── Search table: one narrow row per LIVE listing ─────────────
-- The listings module writes this row in the same transaction that makes a listing
-- active, and deletes it when the listing is paused, let or removed.
CREATE TABLE listing_search (
  listing_id      uuid PRIMARY KEY REFERENCES listing(id) ON DELETE CASCADE,
  area_path       integer[]    NOT NULL,         -- "Mirpur" also matches Mirpur 1, 2, 10, 11 ...
  kind            listing_kind NOT NULL,
  monthly_total   integer      NOT NULL,         -- rent + service charge: what the renter really pays
  bedrooms        smallint     NOT NULL,
  bathrooms       smallint     NOT NULL,
  size_sqft       integer,
  floor_no        smallint,
  furnishing      smallint     NOT NULL,
  amenities       bigint       NOT NULL,
  accepts         smallint     NOT NULL,
  available_from  date         NOT NULL,
  published_at    timestamptz  NOT NULL,
  boost_until     timestamptz,                   -- paid boost (phase 2)
  trust           smallint     NOT NULL,         -- 1 ID-verified, 2 ownership checked, 3 inspected
  pt              geometry(Point, 4326) NOT NULL,  -- the shifted public point
  search_text     text         NOT NULL,         -- titles + area names (bn/en) + description, normalised
  card            jsonb        NOT NULL          -- ready-to-send card: titles, areas, first photo, thumbhash
);
CREATE INDEX ls_area     ON listing_search USING gin  (area_path);
CREATE INDEX ls_geo      ON listing_search USING gist (pt);
CREATE INDEX ls_geo_m    ON listing_search USING gist ((pt::geography));   -- "within 2 km"
CREATE INDEX ls_newest   ON listing_search (published_at DESC, listing_id DESC);
CREATE INDEX ls_price    ON listing_search (monthly_total, listing_id);
CREATE INDEX ls_text     ON listing_search USING gin  (search_text gin_trgm_ops);

-- ───────────── Favourites and saved searches ─────────────
CREATE TABLE favourite (
  user_id     uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  listing_id  uuid NOT NULL REFERENCES listing(id)  ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);

CREATE TABLE saved_search (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id     uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  filters     jsonb NOT NULL,                    -- the full filter set, replayed when opened
  area_ids    integer[] NOT NULL,                -- copied out of filters for fast matching
  max_total   integer,
  min_beds    smallint,
  alert       text NOT NULL DEFAULT 'instant' CHECK (alert IN ('instant', 'daily', 'off')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX saved_search_area ON saved_search USING gin (area_ids) WHERE alert <> 'off';

-- ───────────── Conversations, viewings and the mutual handshake ─────────────
CREATE TABLE conversation (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  listing_id   uuid NOT NULL REFERENCES listing(id),
  renter_id    uuid NOT NULL REFERENCES app_user(id),
  landlord_id  uuid NOT NULL REFERENCES app_user(id),
  stage        text NOT NULL DEFAULT 'enquiry'
               CHECK (stage IN ('enquiry', 'viewing_proposed', 'viewing_agreed',
                                'contacts_shared', 'deal_agreed', 'closed')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, renter_id)
);

CREATE TABLE message (
  id               uuid PRIMARY KEY DEFAULT uuidv7(),   -- time-ordered ids
  conversation_id  uuid NOT NULL REFERENCES conversation(id),
  sender_id        uuid NOT NULL REFERENCES app_user(id),
  body             text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  masked           boolean NOT NULL DEFAULT false,      -- a number, link or bKash was hidden
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX message_by_conversation ON message (conversation_id, id DESC);

CREATE TABLE viewing (
  id               uuid PRIMARY KEY DEFAULT uuidv7(),
  conversation_id  uuid NOT NULL REFERENCES conversation(id),
  proposed_by      uuid NOT NULL REFERENCES app_user(id),
  starts_at        timestamptz NOT NULL,
  status           text NOT NULL DEFAULT 'proposed'
                   CHECK (status IN ('proposed', 'accepted', 'declined', 'cancelled',
                                     'done', 'no_show')),
  decided_at       timestamptz
);
CREATE INDEX viewing_by_conversation ON viewing (conversation_id);

CREATE TABLE contact_consent (            -- each side taps "Share my details" and confirms with OTP/fingerprint
  conversation_id  uuid NOT NULL REFERENCES conversation(id),
  user_id          uuid NOT NULL REFERENCES app_user(id),
  device_id        uuid NOT NULL REFERENCES user_device(id),
  consented_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE contact_record (             -- the identical record both sides receive
  id               uuid PRIMARY KEY DEFAULT uuidv7(),
  conversation_id  uuid NOT NULL REFERENCES conversation(id),
  viewing_id       uuid NOT NULL UNIQUE REFERENCES viewing(id),
  snapshot_enc     bytea NOT NULL,        -- JSON: both people, the home, exact address + pin, agreed time
  snapshot_sha256  bytea NOT NULL,        -- printed on the PDF; proves nobody changed it
  prev_sha256      bytea,                 -- fingerprint of the previous record: a tamper-evident chain
  pdf_key          text  NOT NULL,
  verify_code      text  NOT NULL UNIQUE, -- QR → <our-domain>/v/<code>
  created_at       timestamptz NOT NULL DEFAULT now()
);
-- Run as the schema owner: the app's role may read and add records, never change or delete them.
-- GRANT SELECT, INSERT ON contact_record TO app_rw;

CREATE TABLE deal (                       -- after the viewing, both sides confirm the terms with OTP
  id                     uuid PRIMARY KEY DEFAULT uuidv7(),
  contact_record_id      uuid NOT NULL UNIQUE REFERENCES contact_record(id),
  rent_bdt               integer NOT NULL CHECK (rent_bdt > 0),
  advance_bdt            integer NOT NULL CHECK (advance_bdt >= 0),
  move_in_date           date NOT NULL,
  renter_confirmed_at    timestamptz,     -- both set → listing becomes 'let_agreed'
  landlord_confirmed_at  timestamptz,
  paid_directly_at       timestamptz,     -- launch: both confirmed "Advance paid" with OTP
  receipt_sha256         bytea,           -- fingerprint of the identical receipt both sides get
  receipt_pdf_key        text,
  created_at             timestamptz NOT NULL DEFAULT now()
);

-- ───────────── Trust and safety ─────────────
CREATE TABLE report (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  reporter_id  uuid NOT NULL REFERENCES app_user(id),
  target_type  text NOT NULL CHECK (target_type IN ('user', 'listing', 'message')),
  target_id    uuid NOT NULL,
  reason       text NOT NULL,             -- scam, fake listing, asked for money, harassment, wrong info
  details      text,
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'actioned', 'dismissed')),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX report_open ON report (created_at) WHERE status = 'open';

CREATE TABLE user_block (
  blocker_id  uuid NOT NULL REFERENCES app_user(id),
  blocked_id  uuid NOT NULL REFERENCES app_user(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE TABLE audit_event (                -- append-only and hash-chained, like contact_record
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at         timestamptz NOT NULL DEFAULT now(),
  actor      text NOT NULL,               -- 'user:<id>', 'staff:<id>', 'system'
  action     text NOT NULL,               -- 'kyc.approved', 'pii.revealed', 'contact.shared' ...
  target     text,
  reason     text,                        -- required when staff reveal personal data
  meta       jsonb,
  prev_hash  bytea,
  hash       bytea NOT NULL
);

CREATE TABLE deletion_request (
  user_id       uuid PRIMARY KEY REFERENCES app_user(id),
  requested_at  timestamptz NOT NULL DEFAULT now(),
  delete_after  timestamptz NOT NULL,     -- requested_at + 28 days
  cancelled_at  timestamptz,
  hold_reason   text,                     -- only an open fraud report or a lawful request
  completed_at  timestamptz
);

-- ───────────── Protected advance (phase 2): bank transfer only, held in a bank escrow account ─────────────
CREATE TABLE payout_account (             -- where a landlord or a scout gets paid
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id         uuid NOT NULL REFERENCES app_user(id),
  account_name    text NOT NULL,          -- must match the verified NID name (staff check)
  account_no_enc  bytea NOT NULL,
  account_last4   char(4) NOT NULL,
  bank_name       text NOT NULL,
  routing_no      text NOT NULL,          -- branch routing number for BEFTN/NPSB
  proof_id        uuid NOT NULL REFERENCES vault_document(id),   -- cheque leaf or statement photo
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected', 'replaced')),
  usable_from     timestamptz,            -- approval + 48 hours, so a hijacked account can't be paid at once
  reviewed_by     uuid REFERENCES staff(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX payout_one_active ON payout_account (user_id) WHERE status = 'approved';

CREATE TYPE advance_status AS ENUM ('awaiting_payment', 'held', 'released', 'refunded',
                                    'disputed', 'cancelled', 'expired');

CREATE TABLE advance_payment (
  id                 uuid PRIMARY KEY DEFAULT uuidv7(),
  deal_id            uuid NOT NULL UNIQUE REFERENCES deal(id),        -- the confirmed deal it belongs to
  renter_id          uuid NOT NULL REFERENCES app_user(id),
  landlord_id        uuid NOT NULL REFERENCES app_user(id),
  payout_account_id  uuid NOT NULL REFERENCES payout_account(id),
  advance_bdt        integer NOT NULL CHECK (advance_bdt BETWEEN 500 AND 50000),  -- pilot cap; raise later
  fee_bdt            integer NOT NULL CHECK (fee_bdt >= 0),          -- 3%, min ৳199, max ৳1,500; 0 in the pilot
  reference          text NOT NULL UNIQUE,                           -- 'BB-7K3Q9', written on the transfer
  move_in_date       date NOT NULL,
  status             advance_status NOT NULL DEFAULT 'awaiting_payment',
  received_at        timestamptz,
  moved_in_at        timestamptz,                                    -- renter tapped "I've moved in"
  auto_release_at    timestamptz,                                    -- move-in date + 72 hours
  dispute_reason     text,
  decided_by         uuid REFERENCES staff(id),
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX advance_release_due ON advance_payment (auto_release_at) WHERE status = 'held';

CREATE TABLE bank_txn (                   -- one line from the escrow account's bank statement
  id                uuid PRIMARY KEY DEFAULT uuidv7(),
  bank_txn_ref      text NOT NULL UNIQUE, -- the bank's own id, so importing twice never doubles a line
  direction         text NOT NULL CHECK (direction IN ('in', 'out')),
  amount            numeric(12,2) NOT NULL CHECK (amount > 0),
  narration         text NOT NULL,        -- where we look for 'BB-7K3Q9'
  from_account_enc  bytea,                -- the payer's account, kept for refunds
  booked_at         timestamptz NOT NULL,
  advance_id        uuid REFERENCES advance_payment(id),   -- set when matched
  imported_by       uuid NOT NULL REFERENCES staff(id)
);
CREATE INDEX bank_txn_unmatched ON bank_txn (booked_at) WHERE advance_id IS NULL;

CREATE TABLE payout (                     -- money leaving the escrow account
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  advance_id    uuid NOT NULL REFERENCES advance_payment(id),
  kind          text NOT NULL CHECK (kind IN ('to_landlord', 'fee_to_company', 'refund_to_renter')),
  amount_bdt    integer NOT NULL CHECK (amount_bdt > 0),
  prepared_by   uuid NOT NULL REFERENCES staff(id),   -- one founder sets it up in the bank
  approved_by   uuid REFERENCES staff(id),            -- the other founder approves it
  bank_txn_id   uuid REFERENCES bank_txn(id),         -- matched when it shows on the statement
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (approved_by IS NULL OR approved_by <> prepared_by)
);
-- Run as the schema owner: the app's role may read and add bank_txn and payout rows,
-- never change or delete them.

-- ───────────── Scouts: paid helpers who bring in homes from To-Let signs ─────────────
CREATE TABLE scout (
  user_id            uuid PRIMARY KEY REFERENCES app_user(id),   -- verified at level 2 like everyone
  agreement_at       timestamptz NOT NULL,                       -- signed the scout agreement in the app
  payout_account_id  uuid REFERENCES payout_account(id),
  daily_limit        smallint NOT NULL DEFAULT 10,
  status             text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'removed')),
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE scout_submission (
  id                     uuid PRIMARY KEY DEFAULT uuidv7(),
  scout_id               uuid NOT NULL REFERENCES scout(user_id),
  draft                  jsonb NOT NULL,      -- facts and photo keys; copied into property + listing on confirm
  landlord_phone_enc     bytea,               -- only for the SMS invite; wiped on confirm or after 7 days
  capture_point_enc      bytea,               -- where the phone was when the photos were taken; never shown
  listing_id             uuid UNIQUE REFERENCES listing(id),   -- set when the landlord confirms
  status                 text NOT NULL DEFAULT 'invited'
                         CHECK (status IN ('invited', 'confirmed', 'live', 'rejected', 'expired')),
  invited_at             timestamptz NOT NULL DEFAULT now(),
  landlord_confirmed_at  timestamptz,         -- the landlord's OTP consent, on their own phone
  earned_live_at         timestamptz,         -- ৳150 when live with a verified landlord
  earned_let_at          timestamptz          -- bonus when a deal is confirmed within 60 days
);
CREATE INDEX scout_submission_by_scout ON scout_submission (scout_id, invited_at DESC);
CREATE INDEX scout_invite_expiry ON scout_submission (invited_at) WHERE status = 'invited';

-- ───────────── Events between modules ─────────────
CREATE TABLE outbox (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  topic         text  NOT NULL,           -- 'listing.published', 'contact.shared' ...
  payload       jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  processed_at  timestamptz
);
CREATE INDEX outbox_pending ON outbox (id) WHERE processed_at IS NULL;
```

When a deletion completes, the `app_user` row is **anonymised** rather than removed: the phone
hash and ciphertext are overwritten and the name becomes "Deleted user". Foreign keys keep working,
and the other person's chat history still makes sense.

### 9.3 The main queries

**Results list.** Example: Mirpur, ৳10k–25k a month in total, 2+ bedrooms, a single man who is a
student, must have lift and generator, available by 1 December, newest first, page 2.

```sql
SELECT listing_id, card, monthly_total, published_at
FROM   listing_search
WHERE  area_path && $1::int[]                    -- {id of Mirpur}
AND    monthly_total BETWEEN $2 AND $3           -- 10000, 25000
AND    bedrooms >= $4                            -- 2
AND    (accepts   & $5::smallint) = $5::smallint -- 2 (single men) | 8 (students) = 10
AND    (amenities & $6::bigint)   = $6::bigint   -- lift bit | generator bit
AND    available_from <= $7                      -- '2026-12-01'
AND    (published_at, listing_id) < ($8, $9)     -- cursor: the last card of page 1
ORDER  BY published_at DESC, listing_id DESC
LIMIT  20;
```

For the "lowest price" sort, swap the cursor and order to
`(monthly_total, listing_id) > ($8, $9) ORDER BY monthly_total, listing_id`. Boosted homes come
from a separate tiny query that fills the top two slots, like Bikroy's "Top Ad" [R6], so the main
query stays simple.

**"1,000+ homes" count** (cheap, never counts everything):

```sql
SELECT count(*) FROM (
  SELECT 1 FROM listing_search WHERE /* same filters */ TRUE LIMIT 1001
) s;
```

**Map, zoomed in** (zoom ≥ 14): one price pin per home.

```sql
SELECT listing_id, ST_X(pt) AS lng, ST_Y(pt) AS lat, monthly_total
FROM   listing_search
WHERE  pt && ST_MakeEnvelope($1, $2, $3, $4, 4326)   -- the visible map area
/* AND same filters */
LIMIT  400;
```

**Map, zoomed out:** clusters on a grid that shrinks as you zoom in.

```sql
SELECT count(*)                          AS homes,
       min(monthly_total)                AS from_price,
       ST_X(ST_Centroid(ST_Collect(pt))) AS lng,
       ST_Y(ST_Centroid(ST_Collect(pt))) AS lat
FROM   listing_search
WHERE  pt && ST_MakeEnvelope($1, $2, $3, $4, 4326)
/* AND same filters */
GROUP  BY ST_SnapToGrid(pt, $5);   -- $5 = 80 / 2^zoom degrees (about 60 screen pixels)
```

**Within a distance** (phase 2 "near me" or "near my office"):

```sql
AND ST_DWithin(pt::geography, ST_SetSRID(ST_MakePoint($lng, $lat), 4326)::geography, $metres)
```

**Area autocomplete**, with any spelling in Bangla or English. The API escapes `%` and `_` in the
input first.

```sql
SELECT a.id, a.name_bn, a.name_en, p.name_bn AS parent_bn, p.name_en AS parent_en
FROM  (SELECT area_id, max(similarity(alias, $1)) AS score
       FROM   area_alias
       WHERE  alias LIKE $1 || '%' OR alias % $1
       GROUP  BY area_id
       ORDER  BY score DESC
       LIMIT  8) m
JOIN  area a      ON a.id = m.area_id
LEFT  JOIN area p ON p.id = a.parent_id
ORDER BY m.score DESC;
```

**Alerts.** When a listing goes live, this query finds who should hear about it:

```sql
SELECT id, user_id, filters
FROM   saved_search
WHERE  alert <> 'off'
AND    area_ids && $1                            -- the listing's area_path
AND    (max_total IS NULL OR max_total >= $2)
AND    (min_beds  IS NULL OR min_beds  <= $3);
-- The remaining filters in `filters` are checked in code against this short list.
```

Every new query is checked with `EXPLAIN (ANALYZE, BUFFERS)` against 100,000 generated test
listings before it ships.

---

## 10. Speed targets

| What | Target |
|---|---|
| App download from Play (per device) | ≤ 15 MB |
| Cold start to the search screen on a 3 GB RAM phone | ≤ 2 s |
| Search API p95 at our server | ≤ 80 ms (the database part ≤ 15 ms) |
| First results visible on 4G | ≤ 1 s |
| Search response with 20 cards | ≤ 15 KB compressed |
| Card photo | ≤ 40 KB (400 px WebP) |
| Load test before launch (k6) | 100 searches a second, p95 < 100 ms on the home server |

How we hit them:

- **App**
  - Flutter release build, obfuscated, shipped as an app bundle.
  - Images decoded at the size they are shown, with a capped image cache.
  - The last search is cached for offline viewing.
  - A **data saver** mode loads small photos only.
- **Photos**
  - Three WebP sizes are made on upload.
  - A ThumbHash (about 25 bytes) shows a blurred preview instantly [R62].
  - Photos are served from R2 through the Cloudflare CDN.
  - The phone shrinks photos before upload, and failed uploads retry in the background.
- **API**
  - Guest searches are cached at Cloudflare for 30 seconds, keyed by the sorted filter string.
    Most traffic never reaches the home server.
  - The card JSON is prebuilt, and responses are compressed.
- **Database:** `listing_search` stays in memory, with the indexes above, cursor pagination and
  capped counts.

---

## 11. Security and privacy

**An honest point first.** No system is 100% bulletproof. And because we hold both sides' NIDs,
Bangladesh's Personal Data Protection Act 2026 makes **us** responsible for protecting them. Fines
for negligent security failures reach Tk 25 lakh [R12, R13]. "It's only a platform" does not remove
that duty. So the plan is layers of defence, collecting less, and deleting on time.

**Network and server**

- No open ports at home. All public traffic comes through Cloudflare Tunnel [R49]. Admin access to
  the server goes over Tailscale [R54]. Cloudflare's firewall and rate limits sit in front.
- TLS 1.3 and HSTS everywhere.
- **Full-disk encryption (LUKS)** on the server, so a stolen box is unreadable.
- Automatic security updates.
- Containers run as non-root, with read-only filesystems where possible.
- Secrets live in Docker secret files, never in git.

**Accounts**

- **OTP:** 6 digits, valid for 5 minutes, 5 tries. Limits per number, device and IP address.
- **A Play Integrity or App Attest check before every SMS** [R38, R39]. This blocks fake clients
  and "SMS pumping" fraud, which runs up SMS bills.
- A new device needs a new OTP.
- **Tokens:** short access tokens (15 minutes) and a rotating refresh token tied to the device.
  If an old refresh token is reused, that device is logged out.
- Optional fingerprint or face unlock. It uses the phone's own biometrics; we never receive them.

**Data**

- **Field encryption (AES-256-GCM)** for phone, NID number, date of birth, legal name, address and
  exact pin.
  - Data keys are wrapped by a master key kept outside the database and outside backups.
  - A copy of the master key is printed and stored offline.
- **ID vault:**
  - Encrypted files with random names, on a separate volume that only the verification module can
    read.
  - Never served by URL.
  - Staff see the files only in the admin panel, watermarked and logged.
  - Never overwritten: re-uploads add versions, and a weekly job checks every file against its
    SHA-256 fingerprint.
  - An encrypted copy goes to Cloudflare R2. Files are encrypted on our server before upload, and
    the key stays on our server, so Cloudflare only ever holds scrambled files.
- Phone and NID lookups use blind-index HMACs.
- **Database roles:** the app cannot change the audit log or contact records. Analytics uses a
  separate read-only role with no personal data.
- Logs never contain phone numbers, NIDs or addresses; the logger removes them.
- GPS data (EXIF) is stripped from every photo.

**Staff**

- Passkeys or 2FA, plus Cloudflare Access.
- Personal data is masked by default. "Reveal" needs a typed reason and is written to the audit
  log, and reveals go into a daily report.
- Each role sees only what it needs.

**Money (phase 2)**

- **The escrow account is held at the bank** under the escrow agreement. It is never our operating
  account.
- **Every payout and refund needs two people.** One founder prepares it in the bank's business
  internet banking, and the other approves it. The database enforces the same rule:
  `approved_by <> prepared_by`.
- **Payouts go only to an approved account in the landlord's verified name.** Changing that account
  needs an OTP, a new review and a 48-hour wait.
- **Bank statement lines are imported, never typed in,** and each bank reference can be imported
  only once.
- **The balance is checked daily.** The money the app says is held must equal the escrow account
  balance. Any difference alerts both founders.

**App**

- Tokens are kept in the Android Keystore or iOS Keychain. The app holds no secrets.
- Code is obfuscated.
- Screenshots are blocked on NID screens.
- Rooted or jailbroken phones get a warning, not a block.
- We follow the OWASP MASVS checklist for the app and ASVS level 2 for the API [R64].

**Process**

- Dependabot scanning and a review of every change.
- A security review before launch, and an external penetration test once there is revenue.
- A written breach plan: who does what in the first hour, and who tells the authority and the
  affected users.
- One named data protection lead.

**Legal protection**

The terms say:

- We introduce people. We are not a party to any tenancy.
- We never hold money in our own account. Protected advances sit in a bank escrow account under
  published rules (`LEGAL.md` §2).
- Users are responsible for their own deals.
- Our liability is capped.

A Bangladeshi lawyer should draft them in Bangla and English.

---

## 12. Trust and safety (stopping scams)

Common Dhaka rental scams:

- A fake "landlord" takes an advance by bKash for a home they don't own.
- Photos copied from other sites.
- Brokers posing as owners.
- Bait prices that are too good to be true.

Our controls:

- **Verified identity on both sides.** One NID gives one account, and a banned NID cannot sign up
  again.
- **Ownership proof for every home.**
- **Photos:**
  - A badge for photos taken with the in-app camera.
  - A perceptual hash catches the same photo used on different listings.
- **Price check:** listings far below the area's median price are flagged for review.
- **Chat:**
  - Numbers, links and bKash numbers are hidden until both sides share.
  - Warnings in Bangla and English when someone writes "advance", "bKash" or "send money".
- **New-account limits:** at most 3 listings and 20 new chats a day in the first week.
- **Reports:** a report button on every user, listing and message. Reports are reviewed within 24
  hours, and users can block each other.
- **Agents:** agents must say they are agents, and their listings show an "Agent" label.
- **Payouts** (phase 2) go only to the verified landlord's own bank account (§4.1).
- **Scouts:**
  - They are paid only for homes that go live with a verified landlord.
  - In-app camera only, plus a location check while capturing.
  - Spot visits to 1 in 10 homes in the first month.
  - Removed after one proven complaint.
- **Safety tips page:** *never pay before you have seen the home and signed.*

---

## 13. Account deletion: the 28-day rule

**Day 0.** The user taps *Delete account*, optionally gives a reason, and confirms with OTP. Right
away:

- all devices are signed out
- the profile and listings are hidden
- upcoming viewings are cancelled and the other person is told
- notifications stop

The user sees: *"Your account will be permanently deleted on <date>. Log in before then to cancel."*

**Days 1–28: the safety period.** It lets us act on fraud reports that arrive after someone
disappears, which is a common pattern: take an advance, then delete the account. Only two things
can pause deletion, an open fraud report or a lawful request, and we tell the user if either
happens.

**Day 28.** The worker:

- deletes name, phone, photos, saved searches, favourites, devices, and chats that are not part of
  a report
- anonymises the account row (§9.2)
- keeps only the items in the table below, encrypted and with restricted access

**Store rules this meets.**

- **Apple:** deletion has to really happen; deactivating is not enough. The time it takes must
  follow local law, and we must tell users how long it takes [R30].
- **Google:** we also need a web page, `<our-domain>/delete-account`, that works for people who
  have already uninstalled the app. We must declare what we keep and why [R33].
- **Wording:** don't say "we will review and decide". Say what it is: a fixed safety period, then
  deletion.

| Data | Kept for | Why |
|---|---|---|
| Profile, phone, chats, favourites | Until day 28 | The service |
| Listing photos | Until the listing or the account is deleted | The service |
| All uploaded documents: NID, passport, selfie, ownership proofs, permission letters | While the account is active, then 6 years after deletion, encrypted in the ID vault, then purged **(verify)** | Our security: fraud, disputes, police or court requests |
| Verification result (NID hash, last 4 digits, date, outcome) | 6 years **(verify)** | Stops banned users rejoining. Record keeping. |
| Contact records and agreements | 6 years **(verify)** | Evidence for both sides. Business records must be kept at least 6 years [R20], and records of processing at least 5 years [R13]. |
| Audit log | 6 years **(verify)** | Accountability |
| Payment records (advances, bank statement lines, payouts) and scout pay | 6 years **(verify)** | Tax and business records [R20] |
| Backups | 35 days, rolling | Deleted data leaves backups within 35 days |

We can't keep documents forever. The Act requires telling users how long we keep their data when
they give consent [R12]. Six years matches the other record-keeping rules, and both the consent
screen and the privacy policy state it plainly.

---

## 14. App Store and Play Store checklist

You said that because we don't use location, the stores should be fine. That is partly right.
Ordinary users never get a location prompt; only scouts do, in Scout mode. But review will focus
on the **NID and selfie**, which are sensitive data, so we need the items below.

**Apple**

- [ ] **Publish as a company, not an individual.** Apps that need sensitive user information
      "should be submitted by a legal entity… and not by an individual developer" (guideline
      5.1.1(ix)) [R29].
      - A company account needs a D-U-N-S number, which is free and takes about 5 business days.
      - Apple does not accept sole proprietorships or trade names [R31].
- [ ] Account deletion inside the app (5.1.1(v)) [R30].
- [ ] Search works without an account; only full details and contact need sign-up. Apple asks that
      apps without significant account-based features work without login (5.1.1(v)) [R29]. Ours
      has those features, and open search keeps us well clear of the rule.
- [ ] A privacy policy linked in the app and on the store page that explains retention and
      deletion (5.1.1(i)) [R29].
- [ ] User-content rules (1.2): filtering, a report button, blocking, and public contact details
      [R29].
- [ ] **Login.** Phone OTP alone needs no "Sign in with Apple". If we add Google or Facebook login
      later, we must also offer an equivalent private login option (4.8) [R29].
- [ ] **Payments:**
      - **Boosts must be in-app purchases** (3.1.3(g): "boosts" for posts must use IAP) [R29].
      - Physical services, such as an inspection visit, must **not** use IAP (3.1.3(e)).
      - If something bought on our website also works inside the app, it must be on sale as an IAP
        too (3.1.3(b)).
      - The protected advance and its fee pay for a real-world rental, so they are not in-app
        purchases (3.1.3(e)). They are paid by bank transfer.
- [ ] App Privacy labels: name, phone, photos, government ID, face data, user content,
      identifiers.
- [ ] A ready-verified demo account for App Review, plus one test phone number with a fixed code.
      The test number works only for that number and only sees a demo data set.
- [ ] Camera permission text in Bangla and English.
- [ ] **Location, in Scout mode only, while taking photos.** The purpose text says exactly that: to
      confirm the scout is at the home. Ordinary users are never asked.

**Google Play**

- [ ] **Account type:**
      - A company account needs a D-U-N-S number **(verify)**.
      - Personal accounts created after November 2023 must run a closed test with **12+ testers for
        14 days** before production [R34]. Our beta covers this either way.
- [ ] Account deletion in the app **and** a web link that works after uninstall. The Data safety
      form must say what we keep and why [R33].
- [ ] Target Android 16 (API 36). This is required for new apps and updates from 31 August 2026
      [R36].
- [ ] **Payments:** boosts go through Google Play Billing because they are digital goods. Physical
      services are excluded from Play Billing [R35]. The service fee is 15% for the first $1M a
      year [R37]. The protected advance is a real-world service, so it stays outside Play Billing.
- [ ] Data safety form: the same items as Apple's labels, plus location for Scout mode
      (foreground only).
- [ ] Use the Play Integrity API to block fake clients and OTP abuse [R38].

---

## 15. Bangladesh rules

Moved to `LEGAL.md`. It lists what to do now, what to do before the payments pilot and what can
wait, plus the questions for the lawyer.

---

## 16. Making money

Moved to `BUSINESS_PLAN.md` §5 (when the money comes in) and §6 (the protected advance). The
technical side of the protected advance is in §4.1 here.

---

## 17. Running from home on Docker

**Hardware**

- 4+ CPU cores, 16 GB RAM (8 GB is the minimum), a 512 GB SSD.
- **A UPS** good for 1–2 hours. It is essential if the server ever moves to Bangladesh, where
  load-shedding is common.
- Wired internet, plus a second ISP or a 4G router as backup.

**OS**

- Ubuntu Server 24.04 LTS with full-disk encryption (LUKS).
- Automatic security updates.
- Firewall with **no** inbound ports.

| Container | Job | RAM (approx.) |
|---|---|---|
| cloudflared | Tunnel to Cloudflare | 50 MB |
| api × 2 | The API | 2 × 200 MB |
| worker | Photos, PDFs, alerts, SMS, push, deletions | 300 MB |
| postgres (PostGIS) | The database | 2–4 GB |
| valkey | Cache, rate limits, OTP codes, job queue | 100 MB |
| gotenberg | PDFs | 300–500 MB |
| web | Share pages and admin files | 100 MB |
| uptime-kuma | Monitoring, alerts to Telegram [R55] | 100 MB |
| backup | pgBackRest and restic schedules | 100 MB |

That is about 4–6 GB in total: 8 GB of RAM works, 16 GB is comfortable.

**Backups**

- **Database:** pgBackRest sends the write-ahead log every minute and a full backup every night,
  encrypted, to off-site storage such as R2 or Backblaze [R53].
- **ID vault:** restic, encrypted on our server, to Cloudflare R2 every night [R50, R53]. The key
  never leaves our server, so R2 only holds scrambled files. About 1.5 MB per person: the free
  10 GB holds about 6,000 people, and after that it costs about $0.015 per GB a month.
- **Why not the Amazon or Google free plans?** Amazon's free plan for new accounts now ends after
  6 months or when the $200 credit runs out [R85]. R2's 10 GB stays free.
- **Keys:** printed and stored offline, in a different place from the server.
- **Restore test every month.**
- Targets: at most 5 minutes of data lost; back up and running within 4 hours.

**Where the server sits.** The server is at your home in the UK.

- Newer sources say the final 2026 Act dropped the hard rule that data must stay in Bangladesh.
  Transfers abroad are allowed to countries that meet conditions set by the new data authority
  (s.29(4)) [R83].
- UK GDPR may also apply, because you are based in the UK.
- Question 1 for the lawyer in `LEGAL.md` §5 confirms this before the public launch. If the answer
  is no, move the server to Bangladesh, for example to your brother's home with a UPS.

**When to move off the home server:**

- over about 5,000 daily users, or
- before the protected advance pilot, so money records never depend on one home PC, or
- the first paying customers, or
- repeated outages.

Move to a VPS or a Bangladeshi data centre. The lawyer's answer in `LEGAL.md` decides which. The
same Docker Compose setup moves in an afternoon.

---

## 18. Growing like Airbnb or Booking.com

Built in from day one:

- `listing_kind` already covers rooms, mess seats, hostels and commercial space.
- `price_period` already allows nightly prices for short stays.
- `property` is separate from `listing`: one home can have many listings over time, as on Airbnb.
- The `area` tree covers all of Bangladesh: launch in Dhaka, then Chattogram and Sylhet with no
  schema change.
- Bilingual data everywhere.
- Modules with their own tables, plus outbox events. Any module can become its own service.
- `/v1` API versioning, and feature flags to switch features on area by area.
- When we pass about 1M listings, or need typo-tolerant ranking, search moves to Typesense or
  OpenSearch. `listing_search` is already shaped like a search index.

Added later: an availability calendar and instant booking (short stays), two-way reviews,
payments, homes for sale, commercial space.

---

## 19. Roadmap

Moved to `BUSINESS_PLAN.md` §9, which puts the product, scouts and business steps in one table.
The build steps:

- **Weeks 0–2:** a fully clickable HTML demo in a phone browser, with made-up data.
- **Weeks 2–6:** the real app on real phones.
- **Weeks 6–10:** the MVP, now including Scout mode, deal confirmation and OTP advance receipts.
- **Weeks 10–14:** the closed beta.
- **Then the public launch,** once 1,000 verified homes are live.

---

## 20. Costs

| Item | Cost |
|---|---|
| Home server | Your own PC, plus a UPS (one-time) and electricity |
| Domain | About $10–15 a year (.com) |
| Cloudflare: DNS, CDN, Tunnel, Access, R2 up to 10 GB | Free [R49–R51] |
| Maps | Free (§7) |
| Push notifications (FCM) | Free |
| SMS OTP | About ৳0.3–0.65 each. 5,000 sign-ups × 2 SMS ≈ ৳3,000–6,500 |
| Apple Developer Program | $99 a year |
| Google Play | $25, one-time |
| D-U-N-S number | Free [R31] |
| Bank transfers (BEFTN / NPSB) | Free / up to ৳10 each [R67] |
| GitHub (private repo and Actions) | Free tier |

Business costs (company, lawyer, scouts, ads) are in `BUSINESS_PLAN.md` §7.

---

## 21. Decisions needed

| # | Decision | Recommendation |
|---|---|---|
| D1 | Where does the server physically sit? | Your home in the UK for now. The lawyer confirms it before the public launch, or we move it to Bangladesh (§17). |
| D2 | Which legal company? | A Bangladeshi private limited company (RJSC), with both founders as shareholders and directors. It covers Apple, the bank escrow account and a local presence. |
| D3 | Tech stack | Flutter + TypeScript + PostgreSQL (§8.2) |
| D4 | Launch areas | 2–3 areas with high demand, for example Mirpur, Mohammadpur and Uttara |
| D5 | Name | Check the trademark, domain and store names for "Basha Bari / বাসাবাড়ি" now |
| D6 | Who reviews NIDs at launch? | Both founders, within 2 hours: your brother 9am–5pm Dhaka time, you 5pm–11pm Dhaka time from the UK (§3) |
| D7 | Retention periods (§13) | Confirm with a lawyer |
| D8 | ID checks | **Decided:** we do them ourselves, with no outside ID company (§3) |
| D9 | How money moves | **Decided:** bank transfer only, into a bank escrow account. No bKash, Nagad or card gateway (§4.1). |
| D10 | Scout pay | ৳150 per live verified home, plus ৳300 when it is let within 60 days. To test. |
| D11 | Which bank holds the escrow account | Ask 2–3 banks. Their business internet banking must have two-person approval. It must also let a director in the UK log in and approve, so check how its OTP reaches you abroad. |
| D12 | Demo before the real app | **Decided:** a fully clickable HTML demo first, to show people (§0) |

---

## 22. Risks

| Risk | What we do about it |
|---|---|
| No listings, so no renters | Scouts bring in 1,000 verified homes before the public launch (`BUSINESS_PLAN.md` §4). Free for landlords. |
| Verification puts people off | Anyone can search with no account. A quick phone sign-up shows full details. Documents are needed only at the first contact or listing. Approval is fast. |
| Scams and fake listings | §12, plus quick reaction to reports |
| Home server goes down | UPS, backup internet, Cloudflare cache, tested restore, a quick move to a VPS |
| App store rejection | Company account, clear privacy texts, a demo account for reviewers, this checklist (§14) |
| Laws change (data rules still being written, e-commerce authority) | A lawyer on call; features can be switched off with flags |
| Data breach | Encryption, the separate vault, collecting less, deleting on time, the breach plan |
| Brokers take over the listings | "Agent" labels, listing limits, owner-only filter |
| Scouts invent homes to get paid | Paid only when a verified landlord's home goes live; in-app camera, location check, spot visits (§12) |
| The bank or the lawyer says no to the escrow setup | Keep using OTP receipts for longer, or use a licensed escrow partner instead (`LEGAL.md` §2) |
| A payout goes to the wrong person | Approved account in the verified name only, two-person approval, 48-hour wait after any account change (§11) |
| Bank statement mistakes | Unique reference codes, one-time import per bank line, daily balance check (§11) |
| The UK founder can't approve payouts from abroad | Choose a bank that allows it (D11), and keep a Bangladeshi mobile number for bank OTPs |
