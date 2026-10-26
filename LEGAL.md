# Basha Bari (বাসাবাড়ি): Legal Checklist

Version 0.3 · 26 October 2026 · Reviewed (`REVIEW.md`) · Private to the two founders

This lists what to register, sign and write, and when. It is a plan, not legal advice. Items
marked **(lawyer)** or **(accountant)** need a Bangladeshi professional to confirm them. References
like [R12] point to `REFERENCES.md`.

---

## 1. Now: before the closed beta

| # | What | Why | How |
|---|---|---|---|
| 1 | **Bangladeshi private limited company** (RJSC), with both founders as shareholders and directors | <ul><li>Apple requires a company for an app that collects NIDs [R29, R31].</li><li>The bank escrow account and payouts need a Bangladeshi company.</li><li>It gives a local presence for police and users.</li></ul> | <ul><li>Your brother files in Dhaka with a lawyer or registration agent.</li><li>A private company needs at least 2 shareholders and 2 directors.</li><li>**(lawyer)** How you sign the papers from the UK.</li></ul> |
| 2 | Trade licence | Required to run a business | From the City Corporation. DSCC's is also available through BIDA's online service [R26]. It needs a registered office address in Dhaka. |
| 3 | Company e-TIN | Tax ID, needed for the bank account and the stores | NBR online |
| 4 | Company bank account | Scout pay, partner income, and later the escrow account | <ul><li>Choose a bank whose business internet banking supports two-person approval.</li><li>Check that a director in the UK can log in and approve.</li><li>Its OTP may need a Bangladeshi mobile number.</li></ul> |
| 5 | D-U-N-S number, then the store accounts | Apple's organisation account needs one [R31] | <ul><li>D-U-N-S: free, about 5 working days.</li><li>Apple Developer Program: $99 a year.</li><li>Google Play organisation account: $25. Organisation accounts skip the 12-tester rule [R34].</li></ul> |
| 6 | Trademark and domain | Protect "Basha Bari / বাসাবাড়ি" | Search, then file with the Department of Patents, Designs and Trademarks (DPDT). Check the domain and store names. |
| 7 | **Privacy policy** (Bangla and English) | The data law requires it [R12], and so do both stores | <ul><li>What we collect, why and for how long (`ARCHITECTURE.md` §13).</li><li>Where it is stored: our server in the UK, with an encrypted backup in Cloudflare R2.</li><li>Who can see it, users' rights and how to contact us.</li></ul> |
| 8 | **Consent screens** in the app | NID and selfie are sensitive data and need "specific consent" [R12] | A separate yes for the ID check, with the retention period written on the screen |
| 9 | **Terms of use** (Bangla and English) | Protects us and users | <ul><li>We introduce people and are not part of any tenancy.</li><li>The fees.</li><li>Banned behaviour.</li><li>Rules for scouts and agents.</li><li>A cap on our liability.</li><li>Bangladeshi law applies.</li></ul> |
| 10 | **Landlord listing consent** (in the app, confirmed by OTP) | We publish their photos and details | The landlord confirms they own the home or are allowed to rent it out, and allows us to publish it |
| 11 | **Scout agreement** | Scouts are paid contractors, not employees | <ul><li>The pay.</li><li>No fees from anyone.</li><li>**Photos and videos belong to Basha Bari.** Under the Copyright Act 2023 the photographer owns them by default [R82], so the agreement must transfer them to us.</li><li>No people or personal papers in photos.</li><li>If someone lives in the home, their permission before entering or filming.</li><li>Landlord numbers are used only for the invite.</li><li>Safety, code of conduct, ending the agreement.</li></ul> |
| 12 | Data protection set-up | The data law [R12, R13] | <ul><li>A named data lead.</li><li>A record of processing, kept 5 years.</li><li>A breach plan.</li><li>Rules on which staff can see what.</li></ul> |
| 13 | SMS sender name "BashaBari" | BTRC rules [R27] | Register it through a BTRC-registered SMS provider |
| 14 | Store forms | [R30, R33] | <ul><li>Apple privacy labels.</li><li>Google Data safety form.</li><li>The `/delete-account` web page.</li><li>Location explained as Scout mode only.</li></ul> |

---

## 2. Before the protected advance pilot (months 4–6)

| # | What | How |
|---|---|---|
| 1 | **Escrow account agreement with the bank** | <ul><li>The bank holds the money as escrow agent. The release rules are written into the agreement, and we instruct releases under those rules.</li><li>**(lawyer + bank)** Confirm that this needs no Bangladesh Bank licence of our own [R24]. A payment provider licence needs about Tk 20 crore of capital [R74], so that route is out.</li><li>If the answer is no, use a licensed escrow partner instead, and learn from the 2021 problems [R72, R73].</li></ul> |
| 2 | Protected advance terms (Bangla and English) | <ul><li>The timelines: payout within 24 hours, automatic release after 72 hours, a decision on any problem within 48 hours.</li><li>Refunds, including our fee.</li><li>What counts as a valid problem, and what evidence we need.</li><li>The limits.</li></ul> |
| 3 | Payout account checks | The account name must match the verified NID name. Any change needs an OTP, a new review and a 48-hour wait. |
| 4 | VAT registration (BIN) before charging any fee | **(accountant)** How VAT applies to the 3% fee and to referral commissions |
| 5 | DBID | **(lawyer)** Whether we need one once we charge fees [R20, R21] |
| 6 | Advances above one month | <ul><li>The Rent Control Act allows one month without the Rent Controller's permission [R18].</li><li>DNCC's guidelines mention one to three months [R80].</li><li>**(lawyer)** Confirm the notice we show, and whether a protected advance can be more than one month.</li></ul> |
| 7 | Tax on scout pay and partner commissions | **(accountant)** Whether tax has to be deducted at source |

---

## 3. Later

- Election Commission NID verification access, once the company exists [R25].
- Ask BTRC before building in-app calls [R28].
- **(lawyer)** The Real Estate Development and Management Act 2010, before adding agent or
  developer plans.
- The DMP CIMS tenant form PDF [R19].
- Insurance for scouts doing inspection visits.
- Holding rent or deposits for a whole tenancy: the same escrow setup, held for longer.

---

## 4. The UK side

- **UK law may apply too.** You live in the UK and the server is at your home. UK GDPR covers data
  handled by someone based in the UK, even when the users are in Bangladesh.
- **(lawyer)** With a Bangladeshi company and the server in your UK home, what does that mean for
  you and the company? Does either of you need ICO registration? It costs £52 a year for small
  organisations [R84].
- **If the answer is difficult,** move the server to Bangladesh before the public launch. The Docker
  setup moves in an afternoon (`ARCHITECTURE.md` §17).

---

## 5. Questions for the lawyer (one meeting)

1. Can we keep Bangladeshi users' NID and selfie copies on a server in the UK, with an encrypted
   copy in Cloudflare R2? This concerns the rules for sending data abroad under the Personal Data
   Protection Act 2026, s.29(4) [R83].
2. Is a bank escrow account allowed without our own Bangladesh Bank licence, if the bank holds the
   money and we instruct releases under written rules?
3. With a Bangladeshi company and the server in the UK, what UK GDPR and ICO duties apply?
4. Are these retention periods acceptable: documents, records, the audit log and payment records
   kept for 6 years after the account closes (`ARCHITECTURE.md` §13)?
5. Do we need a DBID, and from when?
6. What notice do we show for advances above one month, and can a protected advance be more than one
   month?
7. How does a founder living in the UK sign the company papers?
8. **(accountant)** VAT and tax deducted at source on our fee, scout pay and partner commissions.

**Moved off the urgent list:**
- In-app calls (BTRC) and Election Commission NID access are now in §3, because neither is needed
  for launch.
- Google's D-U-N-S rule is answered during store sign-up.
