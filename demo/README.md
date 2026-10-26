# Basha Bari demo

A fully clickable demo with made-up data, to show people and to build from. It has two parts:

- **The app** (`app.html`), for renters, landlords and scouts. It is in Bangla and English, shows in a phone frame on a laptop and fills the screen on a phone.
- **The admin website** (`admin.html`), web only, for the two founders. You check NIDs and documents there, approve listings and bank accounts, approve payouts, and handle reports and deletions.

Nothing here is real: no real people, NIDs, phone numbers, addresses or money. Every ID card, selfie and paper is a drawing stamped **DEMO**. The camera is never used.

---

## How to open it

**On one computer:** double-click `index.html`, then open the app and the admin website in two tabs. They share data in the same browser, and a change in one shows up in the other straight away.

**On a phone and a laptop together (best for showing people):**

1. On the laptop, open Terminal in this folder and run `node server.js`.
2. It prints two addresses: `http://localhost:8080` for the laptop and `http://192.168.x.x:8080` for the phone. The phone must be on the same Wi-Fi.
3. Open the app on the phone and the admin website on the laptop. Both see the same data, live.

**Internet:** the demo works offline. With internet it loads the real map (MapLibre with OpenFreeMap) and the Bangla font. Without internet it shows a drawn map of Dhaka.

---

## Who is in the demo

20 homes: 18 live, 1 let agreed, 1 waiting for review. Use the **DEMO** tab on the right edge of the app, or the side panel on a laptop, to switch person in one tap. You can also log in with any phone number below; the code arrives as a demo SMS at the top of the screen.

**Admin website:** one website, two logins with full access, one for each founder:

- Founder 1 (UK)
- Founder 2 (Dhaka)

Two logins are needed because every payout needs one founder to prepare it and the other to approve it.

### Renters (5)

| Name | Phone | Starting point |
|---|---|---|
| Tanvir Ahmed | 01711000101 | Verified. Viewing agreed with Abdul Karim, ready to share details. Reported an agent. |
| Nusrat Jahan | 01811000102 | Verified. Whole journey done: advance held at the bank, moved in, payout waiting for the second founder. |
| Farhan Kabir | 01911000103 | Phone only. ID check waiting in the admin website (first try rejected as blurry). |
| Sadia Islam | 01611000104 | Verified with a passport. In her chat, the landlord's phone number was hidden. |
| Arif Hossain | 01511000105 | Asked to delete his account 5 days ago. Logging in cancels it. |

### Landlords (10)

| Name | Phone | Homes |
|---|---|---|
| Abdul Karim | 01711000201 | 2 in Mirpur 10. Bank account approved. |
| Rokeya Begum | 01811000202 | 2 in Mohammadpur; one let to Nusrat. |
| Mizanur Rahman | 01911000203 | 2 in Uttara Sector 7. Bank account waiting for review. |
| Shahnaz Parvin | 01611000204 | 2 in Dhanmondi |
| Jamal Uddin | 01711000205 | 2 in Mirpur 2, as caretaker for the owner |
| Fatema Khatun | 01811000206 | 2 in Adabor and Shyamoli |
| Habibur Rahman | 01911000207 | 2 in Uttara |
| Nasima Akter | 01611000208 | 2 in Pallabi and Mirpur 11, as the owner's daughter |
| Kamal Hossain | 01511000209 | 2 in Bashundhara, as an agent. Reported for asking for bKash money. |
| Selina Chowdhury | 01711000210 | 2 in Uttara Sector 4; one waiting for review |

### Scouts (2)

| Name | Phone | Starting point |
|---|---|---|
| Rakib Hasan | 01811000301 | 1 live home (৳150 due), 1 invite waiting for a landlord |
| Mitu Akter | 01911000302 | 1 live home, already paid |

---

## The whole journey: from sign-up to moving in (about 5 minutes)

1. **Search as a guest.** Open the app and type an area. Spellings like "mirpoor" or "মিরপুর ১০" work. Try the filters and the map with price pins. Open a home: guests see only the cover photo and key facts.
2. **Sign up.** Tap *Sign up to see full details* and use any new number, such as 01700000555. The 6-digit code arrives as a demo SMS, or tap *Demo: fill the code*. You now see every photo, the bills and the description.
3. **Verify your ID.** Give consent, then choose NID, smart NID, passport or driving licence. Take the demo photos, type the details and do the live selfie.
4. **Approve it (admin website).** Go to *ID checks*, open the person and look at the documents, which are watermarked and logged. *Reveal* the number with a reason, then *Approve*.
5. **Message a landlord** and suggest viewing times. Demo landlords reply, accept and confirm by themselves (this can be turned off in Settings). Type a phone number in the chat to see it hidden.
6. **Share my details** with an OTP. Once both of you have shared, you each get the same contact record, with a SHA-256 fingerprint and a check code.
7. **Confirm the deal** with an OTP. The home becomes "Let agreed" for everyone.
8. **Protected advance.** Choose it, see the escrow bank details and reference code, then tap *I've sent the transfer*.
9. **Admin website → Advances and bank → Import today's statement.** The line matches by reference and amount, and the app shows *Advance received and held*.
10. **Move in (check-in).** On the deal page, tick the keys, type the meter readings and save the move-in check with an OTP.
11. **Admin website → Prepare payout** as one founder, then *Switch founder* and *Approve and send* as the other. The same founder cannot do both. The app now shows *Paid to the landlord*.

**On one phone only?** Open the DEMO tab and turn on *Auto-approve*. IDs, listings, bank accounts and the bank statement are then approved automatically. *Act as both founders* releases payouts.

**Also try:**
- **Landlord view (Abdul Karim):** *My homes* for stats, pause and mark as let, the payout bank account, and contact hours. *List a home* is a 6-step form with a map pin and ownership papers.
- **Scout (Rakib):** *New capture from a To-Let sign*, sent to 01811000206 (Fatema). Switch to Fatema, confirm the invite with an OTP, then approve the listing in the admin website. Rakib's ৳150 shows in his earnings.
- **Admin website:** the open report about the agent, the deletion with its 28-day countdown, the document vault (*Check every fingerprint*), the audit log (*Verify the hash chain*) and the escrow reconciliation on the dashboard.
- **Account → Delete account:** the 28-day notice. Logging in again cancels it.

---

## What is simulated

| In the demo | In the real app |
|---|---|
| SMS codes appear as a banner on screen | A BTRC-registered SMS provider |
| Drawn ID cards and selfies; no camera | The camera, ML Kit liveness and SFace face match |
| Bank transfers are a button; the statement is generated | The renter's own bank app; the escrow account's real statement (CSV import is already in the admin website) |
| QR pattern drawn from the fingerprint | A real QR code to `bashabari.example/v/<code>` |
| Data in the browser, or in `.demo-state.json` with `node server.js` | PostgreSQL on the server (`ARCHITECTURE.md` §9) |
| Founders pick a name to sign in | Passkeys behind Cloudflare Access |

Field and table names follow `ARCHITECTURE.md` §9.2, so the real build can reuse the same shapes.

---

## Files

| File | What it is |
|---|---|
| `index.html` | Start page, linking to the app and the admin website |
| `app.html`, `js/app.js`, `css/app.css` | The phone app |
| `admin.html`, `js/admin.js`, `css/admin.css` | The admin website |
| `js/store.js` | Shared data: the 20 homes and all the people, plus every rule (search, masking, handshake, deal, escrow, payouts, scouts, deletion, audit chain) |
| `js/art.js` | Drawn room photos, sample ID cards, selfies, papers, icons, the offline map |
| `css/base.css` | Shared colours (the v3 demo's green) and parts |
| `server.js` | Optional live sharing between devices. Demo only: no login, so never open it to the internet. |

To start from scratch: *Reset all demo data* in the DEMO panel or in admin Settings.
