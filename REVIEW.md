# Basha Bari (বাসাবাড়ি): Plan Review

Version 0.4 · 26 October 2026 · Private to the two founders

**The question:** are our architecture, plan and strategy good enough to start building?

**The answer:** yes. I checked every document and found 8 problems, all now fixed in version 0.3.
Six questions are still open. Only a lawyer, a bank or real users can answer them, and two of them
could change the plan.

---

## 1. Verdict by area

| Area | Verdict | Why |
|---|---|---|
| Product (Zoopla search, SpareRoom rooms, Booking.com map) | Good | A clear path: search → listing → viewing → mutual contact → deal. Guests can search, a phone sign-up shows full details, and an ID check unlocks contact. |
| Architecture | Good | Flutter, TypeScript and PostgreSQL with PostGIS, built as one program in modules, with a fast search table and free maps. It fits one home server now and can grow later without a rewrite. |
| Trust and safety | Strong | <ul><li>Both sides are ID-checked, and ownership papers are checked.</li><li>Numbers stay hidden until both sides agree.</li><li>Both sides get identical signed records.</li><li>Payouts go only to the landlord's own named bank account.</li></ul> |
| Money | Good, not yet proven | Free until 1,000 homes. The protected advance with a 3% fee is a real selling point, but it depends on a bank agreeing to the escrow setup. |
| Getting homes (scouts) | Strong | Cheap (about ৳2.4 lakh for 1,000 homes) and local. Hard to cheat, because scouts are paid only for homes with a verified landlord. |
| Getting renters | Was the weakest part | Homes alone don't bring renters. Fixed with QR stickers on To-Let signs, but this still needs testing. |
| Legal | On track | One clear list. Two answers could change the plan: whether NID data can sit on a UK server, and whether the bank escrow setup is allowed. |
| Day-to-day running | Tight | Two founders, two time zones: reviewing IDs, managing scouts and approving payouts. Fine for the beta. Hire someone at about 50 reviews a day. |

---

## 2. What I found and fixed in version 0.3

| # | Problem | Fix | Where |
|---|---|---|---|
| 1 | **No record of the agreed deal.** The advance receipt and the protected advance both relied on a "deal", but the database didn't store one. The scout bonus ("let within 60 days") had nothing to count. | <ul><li>New `deal` table: both sides confirm rent, advance and move-in date with OTP.</li><li>The listing then becomes "let agreed".</li><li>The receipt and the protected advance both hang off the deal.</li></ul> | `ARCHITECTURE.md` §4, §4.1, §9.2 |
| 2 | **Landlords without a smartphone** couldn't confirm a scout's listing, because the SMS link needs one | The landlord reads out the OTP from their own phone in person. The NID photo and selfie are taken on the scout's phone, with the landlord there. | `ARCHITECTURE.md` §4.2, `BUSINESS_PLAN.md` §4 |
| 3 | **Scouts photographing homes where people still live** | <ul><li>The people living there must agree too.</li><li>No people, faces, family photos or papers in any shot.</li><li>Scout safety rules.</li></ul> | `ARCHITECTURE.md` §4.2, `BUSINESS_PLAN.md` §4, `LEGAL.md` §1 |
| 4 | **The UK founder approving payouts.** Bangladeshi banks often send their OTP to a local mobile number and may limit logins from abroad. | Check this before choosing the bank, and keep a Bangladeshi number for bank OTPs | `ARCHITECTURE.md` D11 and §22, `LEGAL.md` §1, `BUSINESS_PLAN.md` §11 |
| 5 | **Nobody owned the 9am–11pm review hours** | Your brother covers 9am–5pm Dhaka time. You cover 5pm–11pm Dhaka time, which is 11am–5pm UK time in winter. | `ARCHITECTURE.md` §3 and D6, `BUSINESS_PLAN.md` §8 |
| 6 | **Strong on getting homes, weak on getting renters** | QR stickers on To-Let signs (with permission), plus Facebook groups and small area ads | `BUSINESS_PLAN.md` §4 and §11 |
| 7 | **Payment records on one home PC** | Move the server off the home PC before the protected advance pilot | `ARCHITECTURE.md` §17 |
| 8 | **Your decision to show people a clickable HTML demo first** wasn't in the plan | Added as step 2, using made-up data only. The timeline moves by about 2 weeks, so launch is in about 3½–4 months. | `ARCHITECTURE.md` §0, §19 and D12, `BUSINESS_PLAN.md` §9 |

---

## 3. Still open

| # | Question | Who answers | If the answer is no |
|---|---|---|---|
| 1 | Can NID copies sit on a UK server, with an encrypted copy in R2? | Lawyer (`LEGAL.md` §5, question 1) | Move the server to Bangladesh before the public launch |
| 2 | Can a bank hold the escrow account, with us instructing releases, without our own licence? | Lawyer and bank (question 2) | Keep the OTP receipts only, or use a licensed escrow partner |
| 3 | Will the bank let a director in the UK approve payouts? | The bank | Choose another bank, or make someone you both trust in Dhaka the second approver |
| 4 | Will renters pay 3% for protection? | The pilot | Lower the fee, or have the landlord pay part of it |
| 5 | Will landlords agree to show NID and ownership papers? | The closed beta | Let a home go live as "ID checked" and ask for the papers only for the "Ownership checked" badge |
| 6 | Is ৳150 per home enough for scouts? | The first 5 scouts | Raise it. The budget has room. |

---

## 4. What I would not change

- Search open to everyone, with no account needed.
- Bank transfer only, with no bKash, Nagad or card gateway.
- ID checks done by us, with the documents in our own encrypted vault.
- Free until 1,000 homes are live.
- One program split into modules, not many small services.
- Free maps: MapLibre and OpenStreetMap.

---

## 5. The clickable HTML demo: built

It is in `demo/`; how to open it is in `demo/README.md`. It covers every item below, plus the admin
website for the two founders. It was tested end to end in Chrome: 102 steps from sign-up to the
payout, with no errors.

**What it lets people try on their phone:**

1. Switch between Bangla and English.
2. Search as a guest: filters, a list and a map with price pins.
3. Sign up with a phone number and a demo OTP, then see full details.
4. Do an ID check with dummy pictures only.
5. Request a viewing, tap "Share my details" and get the identical record with its QR code.
6. Confirm the deal and get an advance receipt.
7. Pay a protected advance: bank details with the reference code, "Advance received and held",
   "I've moved in".
8. **Landlord side:** post a home in six steps, see the inbox, accept a viewing.
9. **Scout mode:** the capture checklist, "Send to landlord", earnings.
10. Delete the account and see the 28-day notice.

**How it was built, against the rules set here:**

- **Not one file:** it is two pages (the app, and the admin website) plus shared code. Both open
  by double-clicking, with no install.
- **Offline:** it works offline except the real map tiles and the font. Without internet it shows
  a drawn map of Dhaka instead.
- **Made-up data only.** It never uses the camera and never asks for a real NID; every ID card,
  selfie and paper is a drawing stamped DEMO. Data stays in the browser. The optional
  `node server.js` keeps it in a local file so a phone and a laptop can share it.
- **Your brother's v3 demo:** it keeps his green colours, his listing questions (rooms, bills,
  gas, service charge, a photo of every room) and his approximate-pin idea. The code is new.
