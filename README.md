# Basha Bari (বাসাবাড়ি)

**Private. Only for the two of us (the founders). Don't share this folder or its files.**

Basha Bari is a Bangla and English app for renting homes in Bangladesh:

- **Search** works like Zoopla, **rooms and flatshares** like SpareRoom, and **the map** like
  Booking.com.
- **Both sides are ID-checked,** and contact details are shared only when both agree.
- **Later, the advance is held at a bank** until the renter moves in.

---

## Where we are (26 October 2026)

- **Done:** the plan is written and reviewed (version 0.4).
- **Done:** a fully clickable demo, made of the phone app and the admin website, in [demo/](demo/README.md).
- **Next:** show the demo to 10–20 landlords and renters, and write down what they say.
- **Not yet:** nothing is deployed or registered, and no real ID data has been collected.

---

## Files

| File | What's in it |
|---|---|
| [REVIEW.md](REVIEW.md) | **Start here.** Is the plan good, what was fixed, what's still open |
| [demo/](demo/README.md) | **The clickable demo.** Open `demo/index.html`. The guide lists every demo account and the full journey, from sign-up to moving in. |
| [ARCHITECTURE.md](ARCHITECTURE.md) | How the app is built: screens, flows, database, security, server, app stores |
| [BUSINESS_PLAN.md](BUSINESS_PLAN.md) | Customers, scouts and the first 1,000 homes, money, numbers, milestones |
| [LEGAL.md](LEGAL.md) | What to register, sign and write, and when, plus the questions for the lawyer |
| [REFERENCES.md](REFERENCES.md) | Every source behind the plan |
| [Basha Bari_ demo v3 (1).html](<Basha Bari_ demo v3 (1).html>) | The original demo, kept unchanged |

---

## What we've decided

| Topic | Decision |
|---|---|
| Company | A Bangladeshi private limited company, with both of us as shareholders and directors |
| Server | The home server in the UK for now. The lawyer confirms this before launch. |
| ID checks | Done by us, with no outside ID company: NID, passport or driving licence, plus a live selfie. Documents are kept in our own encrypted vault. |
| Payments | **Bank transfer only** (BEFTN or NPSB) into a bank escrow account. No bKash, Nagad or card gateway. |
| Fees | Free until 1,000 homes. Then 3% on protected advances, minimum ৳199 and maximum ৳1,500. |
| Getting homes | Paid scouts working from To-Let signs: ৳150 per live verified home, plus ৳300 if it is let |
| Demo | The clickable HTML demo is built (`demo/`). The real Flutter app comes next. |
| Launch | Once 1,000 verified homes are live in 2–3 Dhaka areas |

---

## Who does what

| | You (UK) | Your brother (Dhaka) |
|---|---|---|
| Now | Build the HTML demo, set up the server | Register the company, search the trademark, talk to banks |
| ID and listing reviews | 5pm–11pm Dhaka time | 9am–5pm Dhaka time |
| Money | Second approver on every payout | Prepares payouts; our contact at the bank |
| Scouts | Scout mode in the app | Recruits and manages the scouts |

---

## This month

1. **Your brother:** start the company registration (`LEGAL.md` §1).
2. Book one meeting with a lawyer, using the questions in `LEGAL.md` §5.
3. Talk to 2–3 banks about two things:
   - a company account now and an escrow account later
   - two-person approval that works from the UK
4. Search the trademark for "Basha Bari / বাসাবাড়ি".
5. Show the demo to 10–20 landlords and renters, and write down what they say.
6. Recruit the first 5 scouts.

---

## Rules for this folder

- **One AI assistant edits these files at a time.** Two assistants once wrote here at the same time
  and overwrote each other's work.
- **Every change to a plan file updates the version line at its top.**
