# Basha Bari (বাসাবাড়ি): Business Plan

Version 0.3 · 26 October 2026 · Reviewed (`REVIEW.md`) · Private to the two founders

This is how Basha Bari wins customers and makes money. `ARCHITECTURE.md` covers how the app is
built, `LEGAL.md` covers what to register and sign, and `REVIEW.md` checks the whole plan.
References like [R79] point to
`REFERENCES.md`. All prices and numbers here are planning guesses to test, not promises.

---

## 1. Summary

- **The problem.** Finding a home in Dhaka means walking the streets for To-Let signs and calling
  strangers. Brokers charge about a month's rent [R79]. Fake landlords take an advance and
  disappear.
- **What we do.** One app with real homes, real photos and the real monthly cost:
  - Both sides are ID-checked.
  - Contact details are shared only when both sides agree.
  - From phase 2, the advance is held at a bank until the renter moves in.
- **Selling line.** *"Every landlord ID-checked. Every home real. Your advance safe until you move
  in."*
- **How we make money.**
  - Free to start.
  - First income: referral commissions from house-shifting companies.
  - Main income: a 3% fee on protected advances, paid by bank transfer only.
- **First goal.** 1,000 verified homes live in 2–3 Dhaka areas before the public launch. Paid
  scouts collect them from To-Let signs.

---

## 2. Customers

| Who | What they want | What we give them |
|---|---|---|
| Renters: families, job holders, students, single men and women | Real homes at real prices, no broker, no scam | Free search, a "who can rent" filter, ID-checked landlords, a protected advance |
| Landlords and caretakers | Good tenants quickly, no wasted visits, paid on time | Free listing, ID-checked renters, scouts who take the photos, the advance paid before the keys are handed over |
| Agents (later) | More enquiries | An agent plan, with an "Agent" label on their listings |

Most users have low-cost Android phones (TECNO, Infinix, Xiaomi) [R10], so the app is built to be
light (`ARCHITECTURE.md` §10).

---

## 3. Why people will choose us

| | To-Let signs and Facebook groups | Brokers | Basha Bari |
|---|---|---|---|
| Cost to the renter | Free | About one month's rent [R79] | Free. 3% only for a protected advance. |
| Landlord checked | No | Sometimes | ID and ownership papers |
| Real photos | Rarely | No | Taken in the app, by the landlord or a scout |
| Advance safe | No | No | Held at a bank until move-in (phase 2) |
| Proof if something goes wrong | None | None | The same signed record for both sides |

---

## 4. The first 1,000 homes: Basha Bari Scouts

**The idea.** Most Dhaka homes are advertised on To-Let signs. We pay local people to:
- find the signs
- get the landlord's permission
- photograph and film the home
- help the landlord post it

Airbnb did something similar in 2009. The founders photographed New York listings themselves, and
bookings went up [R78].

**How it works**

1. **The scout joins.** They verify with their NID and a selfie, like every user, and sign the scout
   agreement in the app (`LEGAL.md` §1). They get 30 minutes of training: the photo checklist, what
   to say to landlords, and safety.
2. **They find a home.** The scout finds a To-Let sign, meets or calls the landlord, and explains
   that the app is free.
3. **They capture it.** With the landlord's permission, the scout opens **Scout mode**:
   - photos of every room, the outside and the street, using the in-app camera only
   - an optional video of up to 30 seconds
   - the facts: rent, service charge, bills and gas
   - if someone still lives there, their permission too. No people, faces, family photos or papers
     in any shot.
4. **The landlord confirms.** The landlord gets an SMS link. On their own phone they confirm the
   listing and their consent with an OTP, then verify (NID, selfie and ownership papers). The scout
   can help them on the landlord's phone.
   - Without the landlord's OTP, the listing never goes live.
   - The landlord's phone number is deleted after 7 days if they don't confirm.
   - **No smartphone?** The landlord reads out the OTP that arrives on their own phone. The scout
     takes the NID photo and selfie on the scout's phone, with the landlord there.
5. **We review it** and the listing goes live.
6. **The scout gets paid.**

**Scout pay** (guesses to test)

| Event | Scout earns |
|---|---|
| The listing goes live with the landlord verified and ownership checked | ৳150 |
| The home is let through the app within 60 days | ৳300 bonus |

Scouts are paid monthly by bank transfer.

**Budget for 1,000 homes**

| | Cost |
|---|---|
| 1,000 live homes × ৳150 | ৳1.5 lakh |
| Bonuses, if 300 of them are let (300 × ৳300) | ৳90,000 |
| **Total** | **about ৳2.4 lakh** |

For example, 20 scouts bringing in 50 homes each, over about 6 weeks.

**Rules that stop cheating**

- Pay only for homes that go live with a verified landlord. Fake homes earn nothing.
- In-app camera only. A photo fingerprint catches the same photo used twice (`ARCHITECTURE.md`
  §12).
- Scout mode checks that the phone was at the home when the photos were taken. That location stays
  private and is never shown to anyone.
- In the first month, someone visits 1 in 10 homes in person.
- At the start, each scout can send at most 10 homes a day.
- Scouts never take money from landlords or renters. One proven complaint and they are removed.

**Who to recruit:** university students, people who know the area well, and part-timers.

**Scout safety:**
- Visit in daylight.
- Tell the team lead before going into a home.
- Never enter a home where people live unless they agree.

Later, scouts become the field team for paid inspection visits and the "Inspected" badge.

**Other ways to get homes and renters**

- **QR stickers on To-Let signs.** With the landlord's permission, the scout puts a small sticker
  on the sign: *"See this home with photos on Basha Bari"*, plus a QR code. People already stop at
  these signs, so each one becomes a free advert for the app. This is our main way to reach
  renters.
- Share listing links in Dhaka house-rent Facebook groups. The web share pages make the links work
  (`ARCHITECTURE.md` §8.5).
- Run small Facebook ads aimed only at the launch areas.
- Put notices on university and office boards in those areas.

---

## 5. How we make money

**Our rules**

1. Searching, listing and messaging are always free.
2. One clear fee, shown before paying. No hidden charges.
3. We only earn when you move in safely. If the advance is refunded, our fee is refunded too.
4. We never hold money in our own account, and we never sell anyone's data.
5. **Payments are by bank transfer only.**
   - **No bKash, Nagad or card gateway**, which would take about 1.5–2.5% of every payment [R71].
   - **BEFTN transfers are free, and NPSB transfers cost up to ৳10** [R66, R67].
   - **Apple Pay isn't available in Bangladesh, and Google Wallet only does tap-to-pay in shops**
     [R69, R70], so neither can take payments in the app.

**When the money comes in**

| When | Income | Who pays | Amount |
|---|---|---|---|
| Months 0–3 | None; everything is free | — | ৳0 |
| From month 3 | **House-shifting referrals**: after a deal, "Book a shifting truck" from a partner such as Sheba.xyz, Lalamove, Trucklagbe or Packshift [R81] | The partner company | A Dhaka flat move costs about ৳8,000–12,000 [R81]. A 5–10% commission would be ৳400–1,200 (to negotiate). |
| Months 4–6 | **Protected advance pilot**, free | — | ৳0 |
| From month 6 | **Protected advance fee** | Renter | 3%, minimum ৳199, maximum ৳1,500, VAT included |
| From month 6 | Inspection visits by scouts | Landlord | ৳500–1,000 a visit, by bank transfer |
| Later | Agent plans on the web portal | Agents | ৳1,500–3,000 a month, by bank transfer |
| Maybe later | Boosts | Landlords and agents | ৳149–299 for 7 days. Inside the app these must be App Store or Play purchases, and Apple and Google keep 15% [R32, R37]. |

**Example fee.** For a ৳20,000 advance, the renter pays ৳20,000 + ৳600 = ৳20,600 by bank transfer.
The landlord receives ৳20,000 and we keep ৳600, minus VAT. The accountant confirms the VAT rate
(`LEGAL.md` §2). With a broker, the same renter would pay about ৳20,000 in commission [R79].

---

## 6. The protected advance, step by step

1. **The deal is agreed.** After the viewing, both sides agree. The landlord has added a payout
   bank account **in their own name**, and we have checked that it matches their verified NID.
2. **The renter pays.** The app shows:
   *"Pay ৳20,600 to Basha Bari Escrow A/C, <bank>, <account number>. Reference: BB-7K3Q9."*
   - The renter pays from their bank app, by BEFTN (free) or NPSB (instant, up to ৳10).
   - A renter with only bKash or Nagad can still send to a bank account through NPSB. Their
     wallet's own charge applies [R66], and we don't connect to bKash or Nagad ourselves.
3. **We match the payment.** We find it by its reference code; at first, by importing the bank
   statement every day. Both sides then see *"Advance received and held"*.
4. **The renter moves in.**

   | What happens | Result |
   |---|---|
   | Renter taps "I've moved in" | Paid to the landlord within 24 hours |
   | No reply 72 hours after the move-in date | Paid to the landlord automatically |
   | Renter reports a problem | Money frozen. We decide within 48 hours, using the evidence. |

5. **We pay out.** One founder sets up the transfer in the bank's business internet banking, and
   the other approves it. Our fee moves to the company's own account at the same time.
6. **Refunds** go back to the account the money came from, including our fee.

**Pilot limits:**
- one area only
- only verified landlords whose ownership papers are checked
- advances up to ৳50,000
- free during the pilot

**Why it's safe**

- The money sits in an escrow account at a bank, not in an account we can spend from.
- Two people are needed to move any money.
- **The payout account must be in the landlord's verified name.** A fake landlord can't receive the
  money even if their photos fool us.
- Every step is on the record, and both sides see the same record.

This only goes ahead once the bank and our lawyer confirm the setup (`LEGAL.md` §2). Until then,
step 1 still protects people: when the renter pays the landlord directly, both confirm with an OTP
and get the same signed receipt.

---

## 7. Numbers

**Launch budget (one-time)**

| Item | Cost |
|---|---|
| Company registration, trade licence, lawyer | Get quotes in Dhaka (`LEGAL.md` §1) |
| Scouts for 1,000 homes | About ৳2.4 lakh (§4) |
| Apple Developer Program | $99 a year |
| Google Play | $25, one-time |
| Domain | About $10–15 a year |
| UPS for the server | One-time |
| SMS for 5,000 sign-ups × 2 | About ৳3,000–6,500 |
| Facebook ads in the launch areas | About ৳50,000 (guess) |

**Monthly running costs at launch:** SMS and electricity. Cloudflare, maps and push notifications
are free (`ARCHITECTURE.md` §20).

**Income example** (protected advance fee only, average fee ৳600, before VAT)

| Protected advances a month | Fee income a month |
|---|---|
| 100 | ৳60,000 |
| 300 | ৳1.8 lakh |
| 1,000 | ৳6 lakh |

Shifting referrals and inspection visits come on top.

---

## 8. Team

| Person | Role |
|---|---|
| You (UK) | Tech: the app, the server, security. Reviews IDs and listings 5pm–11pm Dhaka time (11am–5pm UK time in winter). Second approver on every payout. |
| Your brother (Dhaka) | Company director in Bangladesh. Manages scouts. Reviews IDs and listings 9am–5pm Dhaka time. Handles the bank and partners. The local contact for support and police. |
| First hire | A support and review person, once there are more than about 50 reviews a day |

---

## 9. Milestones

| Weeks | Product | Business | Done when |
|---|---|---|---|
| 0–2 | **Fully clickable HTML demo** in a phone browser, with made-up data | Start the company registration. Show the demo to 10–20 landlords, renters and possible scouts. | People can try every step on their own phone, and we have their feedback written down |
| 2–6 | The real app on real phones | Trademark search, company bank account, recruit the first 5 scouts | It runs smoothly on a 3 GB Tecno or Infinix, a Xiaomi and an iPhone |
| 6–10 | MVP, including Scout mode, deal confirmation and OTP advance receipts | Scouts start in launch area 1. The lawyer reviews the terms and privacy policy. | Every item in `ARCHITECTURE.md` §14 is ticked |
| 10–14 | Closed beta (TestFlight and Play closed testing) | Grow to 20 scouts across 2–3 areas, with QR stickers on the signs | **1,000 verified homes live**, getting real enquiries |
| About 14–16 | Public launch on both stores | Facebook groups, small ads | Live on both stores |
| Month 3+ | "Book a shifting truck" in the app | Sign 1–2 shifting companies | First income |
| Months 4–6 | Protected advance pilot | Escrow agreement signed with the bank | 50 pilot payments, with no money lost |
| Month 6+ | 3% fee switched on | Open the next area | Paying customers |

The public launch happens when there are 1,000 homes, not on a fixed date. A rental app with few
homes loses renters on day one.

---

## 10. Numbers to watch every week

- Live verified homes per area.
- Share of homes that get an enquiry within 7 days.
- Viewings agreed, and deals (let agreed).
- Protected advances, and how many end in a refund or a dispute.
- Fraud reports per 100 deals.
- Average time to review an ID or a listing.
- Homes per scout, and how many of their homes are rejected.

---

## 11. Business risks

| Risk | What we do |
|---|---|
| Scouts invent homes to get paid | Pay only when a verified landlord's home goes live. In-app camera, location check and spot visits. |
| Landlords won't verify | Scouts help on the spot. It is quick, and verified homes rank higher. |
| The bank won't offer an escrow account, or the lawyer says we need a licence | Keep using OTP receipts for longer, or use a licensed escrow partner instead |
| Bank-only payment excludes renters without a bank account | They can send from bKash or Nagad to the bank account through NPSB [R66], or pay the landlord directly and get the OTP receipt |
| Mistakes matching payments by hand | Unique reference codes, two-person approval, and a daily balance check. Move to a bank API when one is available. |
| Competitors copy us | Speed, the scouts' head start on homes, and trust built from real records |
| Homes arrive but renters don't | QR stickers on To-Let signs, Facebook groups and small area ads. Watch enquiries per home every week (§10). |
| The UK founder can't approve payouts from abroad | Pick a bank that allows it, and keep a Bangladeshi mobile number for bank OTPs (`LEGAL.md` §1) |
