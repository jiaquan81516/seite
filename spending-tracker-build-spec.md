# Daily Spending Tracker — Web App (PWA) Build Spec for Claude

> **How to use this file:** paste this whole document into Claude and say
> "Build this app milestone by milestone, starting with M1. Ask me before
> moving to the next milestone." Everything in it is the spec — do not
> invent features that are not listed here. Where a free-tier limit is
> quoted, verify it on the provider's own page before building, because
> free tiers change often.
>
> **Target: a web app (Progressive Web App, PWA) — NOT a native iOS /
> Android app.** It runs in the browser and installs to the phone's home
> screen. No App Store, no $99/year Apple Developer Program, no
> TestFlight. It must work on iPhone from the home screen, including web
> push notifications (iOS 16.4+). See §8.1 for the iOS specifics.

---

## 1. What this app is

A personal spending tracker for one user. The core promise:

> **Track daily spending without typing entries in by hand.**

Most spending happens by phone — tap-to-pay, QR scan-and-pay, e-wallets,
food-delivery and ride apps. The app watches the user's Gmail for bank and
wallet alerts and logs each spend automatically, and it has an **AI chat**
where the user can send screenshots (bank app, payment notifications,
receipts, statements) and the AI reads them and logs the spend.

The user should open the app and see what they spent — not a data-entry form.

---

## 2. Free AI models (mandatory: $0, no credit card)

The app needs two AI jobs: **vision** (read screenshots/receipts) and
**text** (classify emails, answer chat questions, summarise spending).
All of the following have a genuine free tier. Do not use any model that
requires a credit card or a paid plan.

### 2.1 Recommended setup — primary + fallbacks

| # | Provider / model | Job | Free limits (Nov 2026 — verify before building) | Card? |
|---|---|---|---|---|
| 1 — PRIMARY | **Google Gemini API — `gemini-2.5-flash`** | Vision + text + structured JSON output | ~1,500 requests/day, 10 req/min, 250k tokens/min. Exact limits vary per project — check Google AI Studio → Rate limits. No expiry, not a trial. | No |
| 1b | **Google Gemini API — `gemini-2.5-flash-lite`** | Same jobs, faster/cheaper, slightly weaker | Also free; use for high-volume simple jobs (classifying short alert emails). | No |
| 1c | **Google Gemini API — `gemini-2.5-pro`** | Hard cases only (messy statements, ambiguous receipts) | ~50 requests/day, 5 req/min free. Use sparingly. | No |
| 2 — FALLBACK | **Groq — `meta-llama/llama-4-scout-17b-16e-instruct`** (vision-capable) | Vision + text | ~30 req/min, ~1,000 requests/day, no card. Very fast. Free-tier tokens/min is tight (~6k–30k), so keep prompts short. OpenAI-compatible API. | No |
| 3 — FALLBACK | **OpenRouter free models (`:free`)** — e.g. `google/gemma-4-31b-it:free`, `nvidia/nemotron-3.5-super-vl:free` (both take image input) | Vision + text | 20 req/min; 50 requests/day, or 1,000/day after a one-time $10 credit purchase. No card needed for the 50/day tier. | No |
| 4 — PRIVATE MODE | **Ollama (local, on the user's own computer)** — `llama3.2-vision`, `qwen2-vl`, `gemma3` | Vision + text | $0 forever, no limits, fully private. Needs a computer with enough RAM/VRAM to run the model. No cloud account at all. | No |

### 2.2 Rules for using these models

- **One interface, swappable models.** Gemini, Groq and OpenRouter all
  expose an OpenAI-compatible chat-completions endpoint. Build a single
  `aiClient` that takes `{ provider, model, messages }` so the model can
  be changed by editing one config value. Never hard-code a model ID deep
  in business logic.
- **Never hard-code a rotating free model.** OpenRouter's free lineup
  changes (models are added and withdrawn). Keep the model list in a
  config file, and support the `openrouter/free` router as a last resort
  (it picks a free model at random — acceptable for fallback, not for
  primary use).
- **Fallback chain.** If the primary model returns a rate-limit error
  (429) or is unavailable, automatically try the next model in the chain
  (Gemini Flash → Groq Llama 4 Scout → OpenRouter free vision model).
  Log which model answered each request.
- **Structured output everywhere.** Every extraction call must request a
  JSON object (Gemini: `response_mime_type: "application/json"` with a
  schema; Groq/OpenRouter: `response_format: { type: "json_object" }`).
  Never parse free-form prose to get an amount or a date.
- **Keep prompts short.** Free tiers are limited by requests and by
  tokens per minute. Send the model only what it needs: the email body,
  or the screenshot, plus a short instruction — not the whole database.
- **Privacy caveat (tell the user).** Content sent through Google's free
  tier may be used by Google to improve its products. So: never send a
  full bank statement to a free cloud model. Send only the single email
  or screenshot being processed, and prefer the local Ollama option for
  anything the user marks sensitive. If the user later wants zero
  training-data use, the upgrade path is Gemini paid tier or Ollama —
  the code must not need rewriting for that switch.
- **API keys never ship in the app.** Keys live server-side (or in the
  OS secure enclave / Keychain for a local-only build). The mobile app
  never contains a Gemini/Groq/OpenRouter key.

### 2.3 Free services the AI needs alongside the models

| Need | Free option | Notes |
|---|---|---|
| Read Gmail | **Gmail API** (Google Cloud, free) | OAuth 2.0. Scopes: `gmail.readonly` for reading; add `gmail.modify` only if the app labels mail. No cost for API calls at this volume. |
| Push Gmail → app | **Gmail `watch` + Cloud Pub/Sub** (Google Cloud free tier) | Optional; polling every 15 minutes is fine for v1. |
| Foreign-exchange rates | **Frankfurter API** (`api.frankfurter.dev`, free, no key, ECB rates) | Primary. Fallback: exchangerate-api.com free tier (1,500 requests/month, needs a free key). |
| OCR fallback (if vision model is down) | **Google ML Kit on-device text recognition** (free) or **Tesseract** (open source, free) | Only a fallback. The vision model is the main reader. |
| Auth, database, push, scheduled jobs | **Firebase Spark plan (free)**: Auth, Firestore, Cloud Functions, Cloud Scheduler | Stays free at one-user volume. Push is via the Web Push API (below), not FCM — FCM is optional. See §8 for the no-server alternative. |
| Push notifications | **Web Push API with VAPID keys** (free, no provider account) | The backend sends pushes; the service worker shows them. Works on Android/Chrome/desktop everywhere, and on iPhone from iOS 16.4+ **only when the app is installed to the home screen** and the user grants permission. No Apple Developer Program needed. |
| PWA hosting | **Vercel / Netlify / Cloudflare Pages** (free tiers) | Free HTTPS hosting for the web app. HTTPS is mandatory for service workers and push. |

---

## 3. How automatic tracking works (Gmail)

### 3.1 Sources to watch (all configurable — the user edits this list in Settings)

- Bank alert emails: the user's bank(s) send an email per card charge,
  QR payment, PayNow / funds transfer. Typical senders are the bank's
  alert addresses (e.g. `ibanking.alert@`, `alerts.sg@`). The user adds
  their own banks' sender addresses in Settings.
- Wallet/e-wallet alerts: same idea for e-wallet apps that email receipts.
- Self-sent `walletLog` emails: an iOS Shortcuts automation ("when I tap
  a Wallet pass → send an email to myself") reports tap-to-pay purchases
  that generate no bank email. Body format:
  `Amount: <amount>`, `Merchant: <merchant>`, `Card: <card name>`.
  The app must parse this format. (Also support the equivalent Android
  automation if the user is on Android.)
- Food-delivery / ride e-receipts: emails from the delivery app with the
  order receipt. The amount that counts is the **user's own share**
  ("YOUR TOTAL"), not the group total. Merchant = the restaurant/store
  name. Category from the order type (food → Food & Drink, grocery →
  Groceries, ride → Transport).
- PayLater bill emails: monthly bill-ready emails from the delivery /
  shopping app. These create/update a bill (see §6), they are NOT spends
  by themselves.
- Partner/driver payout statements: weekly statement PDFs. The payout
  amount is read from the PDF and logged as **income**.

Ignore everything else: marketing mail, promos, login notices, account
statements that are not transactions.

### 3.2 Pipeline (runs every 15 minutes)

1. Fetch unread/new mail from the configured senders (last 2 days window).
2. Skip any message ID already in the `seen_ids` store.
3. Classify each new message:
   - **Outgoing spend** → extract merchant, amount, currency, date, time,
     payment method → import (step 4).
   - **Incoming money** from another person → log as **income**, with a
     note so the user can delete it if it was a reimbursement, not income.
   - **PayLater receipt** → do NOT import as a spend. Record it as a
     pending PayLater item to match against the bill later.
   - **PayLater bill-ready email** → create/update the bill.
   - **Payment confirmation for a PayLater bill** → do NOT import as a
     spend (the card deduction is tracked via the bank alert); mark the
     matching bill paid if the amount matches.
   - **Not spend** → skip silently, but still mark seen: transfers to the
     user's own accounts/phone number (wallet top-ups, self-transfers),
     reversals/refunds of a spend already in the tracker.
4. Import each spend with dedupe (see §7).
5. Send **one push notification per new spend** (see §5.4).
6. Mark every processed message ID as seen — even ones skipped — so
   nothing is ever reported twice.

### 3.3 What the AI does in this pipeline

- **Classify** short alert emails the rules can't match (unknown merchant
  string → ask the model "what kind of business is this?").
- **Parse** e-receipts and statement PDFs (extract totals, dates, payment
  method, payout amount).
- **Never guess.** If an amount, date or merchant cannot be read, skip
  the item and surface it to the user in the chat ("I couldn't read this
  one — what was it?") instead of inventing a value.

---

## 4. AI chat function (the second core feature)

A chat screen inside the app (or a floating chat button on every tab).
The user can send **text, photos/screenshots, and PDF files**. The AI:

### 4.1 Screenshot / receipt interpretation

- The user sends a screenshot of: a bank-app transaction list, a payment
  notification, a receipt, a statement page, a QR-payment confirmation.
- The vision model extracts a structured object:
  ```json
  {
    "merchant": "string",
    "amount": 9.20,
    "currency": "SGD",
    "date": "2026-11-16",
    "time": "14:44",
    "payment_method": "Card | PayLah | Apple Pay | ...",
    "category": "Food & Drink | Groceries | Transport | ...",
    "confidence": 0.0 - 1.0,
    "notes": "anything ambiguous, in plain words"
  }
  ```
- **Always confirm before saving.** Show the parsed result as a card
  with the fields editable, and a single "Save" / "Looks right" button.
  Never silently add a spend from a screenshot.
- If several transactions are visible in one screenshot (e.g. a bank-app
  list), extract all of them and show them as a checklist — the user
  ticks the ones to add.
- If confidence is low (< 0.7) or a field is missing, say so plainly and
  ask for the missing piece instead of guessing.
- Foreign currency: convert to the app's home currency at the live
  mid-market rate (Frankfurter API), show both amounts, and store the
  original amount + rate + date in the note.
- Duplicates: before saving, check date + amount against existing
  entries. If a match exists, warn "This looks like the [merchant]
  S$X.XX you already have on [date] — add anyway?" and default to No.
- Refunds/reversals in a screenshot: do not log as spending. Offer to
  mark the original spend as refunded, or log the refund as income with
  a note.
- Group orders: if the screenshot shows a group total and a personal
  share, use the personal share only. If only a group total is visible,
  ask "what was your share?"

### 4.2 Conversational questions

The AI can also answer questions about the user's own data, for example:
"How much did I spend on food this week?", "What's my biggest spend this
month?", "Did I already pay the parking bill?"

- To answer, the app sends the model a **compact summary** (totals by
  category, recent entries, upcoming bills) — never the whole database,
  and never raw account numbers.
- The model answers in plain words with the numbers, and links the
  answer to the relevant screen (e.g. opens the filtered entry list).
- It must never invent a transaction. If the data doesn't contain the
  answer, it says so.

### 4.3 Chat behaviour rules

- Short, plain replies. No filler, no lectures.
- When the user corrects the AI ("that was groceries, not food"), apply
  the correction to the entry and remember the merchant → category
  mapping for next time (store it in a `merchant_rules` collection).
- Keep a per-conversation history so follow-ups work ("and the one below
  it?" refers to the previous screenshot).
- The chat works offline for viewing history, but parsing needs the
  network (cloud model) unless local Ollama mode is on.

---

## 5. App features

### 5.1 Entries (main tab)

- Day / Week / Month toggle. **Day is the default view.**
- Each row: merchant, amount, category tile, "Category · Method" sub-line,
  optional time. Notes and source labels are hidden in the list, visible
  in the edit view.
- Period header shows "Spent today / this week / this month" with the
  matching total.
- Interactive donut chart of spending by category (tap a slice to filter).
- Day-by-day bar chart (tap a day to see that day's entries).
- Filters: category, payment method, merchant search, date.
- Tap an entry to edit (merchant, amount, date, time, category, method)
  or delete. Deleting asks for confirmation.
- Add a spend: manual form (date, merchant, amount, category, method,
  note) or via the AI chat (§4).

### 5.2 Income (same tab, "Expenses | Income" toggle)

- Income is stored separately and **never mixes into spending totals**.
- List of income entries (date, source, amount, note), add/delete.
- Balance card: money in − money out = balance for the selected period.
- "Where it came from" breakdown by source, tappable to filter.
- Optional recurring monthly income (source + day of month, auto-added
  each month, deduped).
- Day-by-day cash-flow chart (income bars vs spending bars).
- Monthly budget card (starts unset — the user sets their own cap),
  showing remaining-to-spend; savings target card with progress
  (this month's net saved vs target).

### 5.3 Bills ("My Upcoming Bills" tab)

- Name, amount (or "Amount TBC"), due date with a relative label
  (Due soon / Overdue / Paid), month stepping.
- Recurring bills (e.g. parking, subscriptions), instalment bills
  (e.g. PayLater bills with a fixed schedule), one-off bills (e.g. a fine).
- **Auto-tick:** when a tracked transaction in the due month matches a
  bill's merchant keywords AND exact amount, mark the bill Paid.
- Manual tick/untick overrides auto-match.
- Add / edit / delete bills in the tab.
- PayLater bills: created automatically from bill-ready emails (§3.2).

### 5.4 Notifications

- One push per new spend, heading exactly: `Spending Logged!💸`
  followed by one line: `S$9.20 — Merchant (Method) · added to your
  tracker · today so far: S$X.XX`.
- Converted foreign-currency spends show both amounts:
  `S$1.01 — Merchant (Method) · MYR 3.20 converted at 1 MYR = S$0.3152
  · added to your tracker · today so far: S$X.XX`.
- Income gets its own message starting `Money in!💰`.
- Weekly summary: every Sunday at 23:59, a message starting
  `here's your spending for the week: ` covering Monday–Sunday, with
  total, breakdown by category and method, income by source, and net
  (income − spending).

### 5.5 Savings goals ("Plan" tab)

- Keep it simple: goals have a name, a target amount, and an amount
  saved; a plain progress bar; tap a goal to add an amount or delete it.
- Starts empty — never invent goals for the user.
- No budgets, pace warnings or rings in v1.

### 5.6 Settings

- Home currency (default SGD), country/banks list, Gmail connect /
  disconnect, alert senders list, notification preferences, weekly
  summary on/off, data export (CSV), delete all data, sign out.
- Bright/light theme only.

---

## 6. Business rules (do not change these without asking the user)

### 6.1 Categorisation

Identify what the merchant actually is; do not default to Other.

| Merchant type | Category |
|---|---|
| Restaurants, food stalls, hawker/food-court names, cafes, bakeries, bubble tea, F&B brands (including POS names like Qashier-*) | Food & Drink |
| Supermarkets, convenience stores | Groceries |
| Rides, transit cards, taxi, parking, petrol | Transport |
| Shopee, Lazada, retail/clothing stores | Shopping |
| Insurers, utilities, telcos, GIRO bill payments | Bills & Utilities |
| Pharmacies, clinics, dental | Health |
| App Store, cinemas, games, entertainment subscriptions | Entertainment |
| Course fees, exam fees, school merchants | Education |
| PayNow / funds transfers to an individual person | Transfers & Top-ups |
| Genuinely unidentifiable (opaque processor names with no merchant shown) | Other |

### 6.2 PayLater rule

Buy-now-pay-later purchases are **NOT** counted as spending in the
month ordered. They count in the month the bill is paid (the bill's due
month). Card-paid orders stay in the order month.

### 6.3 Foreign currency

Always convert foreign-currency spends to the home currency at the
current mid-market rate (checked live at the time, never guessed) and
import them. Store the original amount, currency, rate and date in the
entry's note. If a statement later shows a different debited amount,
correct the entry.

### 6.4 Dates

Keep the transaction date from the email / receipt / screenshot. Never
"correct" it to the bank app's posting date — card payments often post
late. Bank-app screenshots are only for spends with no email record.

### 6.5 Transfers are not spending

Wallet top-ups from a bank/card are transfers, not spending. Spending
counts when the wallet pays a merchant. Transfers to the user's own
accounts/phone number are never spending. Incoming transfers from
another person are income (with the reimbursement caveat in §3.2).

### 6.6 Dedupe

The same physical tap can arrive twice (bank alert + self-sent wallet
email, or bank alert + delivery receipt). Before importing, check for an
existing entry with the same date and the same amount. If one exists,
skip the import and do not notify again. Every imported entry carries a
unique `external_ref` (e.g. `gmail-alert-<message_id>`).

### 6.7 Fresh start

Records begin on a start date the user sets (default: the 1st of the
current month). Never import spending dated before it.

---

## 7. Data model

```text
transactions
  id, date (YYYY-MM-DD), time (HH:MM, optional),
  merchant (string), amount_cents (int, home currency),
  currency (original, e.g. MYR), original_amount_cents (int, optional),
  fx_rate (number, optional), category (enum §6.1),
  method (Apple Pay | PayLah | SC Card | YouTrip | ShopeePay | Card | Cash | Other),
  source (manual | gmail_import | walletlog | grab_receipt | ai_chat),
  external_ref (unique, optional), note (string, optional), created_at

income
  id, date, source (string), amount_cents, note,
  recurring_rule_id (optional)

recurring_income_rules
  id, source, amount_cents, day_of_month

bills
  id, name, amount_cents (nullable = TBC), due_date (YYYY-MM-DD),
  kind (recurring | instalment | one-off), category,
  keywords (string[]), paid (bool), paid_via (transaction id, optional)

goals
  id, name, target_cents, saved_cents

seen_ids
  message_id → processed_at (for Gmail dedupe)

merchant_rules
  merchant_pattern → category (learned from user corrections in chat)
```

Amounts are always integer cents. Never store floats for money.

---

## 8. Recommended tech stack (free tier throughout)

| Layer | Choice | Why |
|---|---|---|
| App | **Web app (PWA): React + Vite + `vite-plugin-pwa`** | One codebase that runs on iPhone, Android and desktop from the browser. Installable to the home screen, works offline via service worker, camera/photo upload via the file picker. (Next.js + PWA plugin is an acceptable alternative.) |
| Hosting | **Vercel / Netlify / Cloudflare Pages** (free tier) | Free HTTPS hosting with automatic deploys from git. Custom domain optional. |
| Backend | **Firebase Spark (free)**: Auth (Google sign-in), Firestore, Cloud Functions (2nd gen), Cloud Scheduler, Web Push (VAPID) | Stays free at one-user volume. The 15-minute Gmail poll is a scheduled Cloud Function; pushes are sent with the `web-push` library and VAPID keys. |
| AI | **Gemini API free tier** via a Cloud Function (key in Secret Manager) | See §2. Fallback chain in the same function. |
| Gmail | **Gmail API** via the `googleapis` package, OAuth 2.0 | Tokens encrypted in Firestore, per user. |
| FX rates | **Frankfurter API** | Free, no key. |
| No-server alternative (MVP) | **Google Apps Script** as the backend (GmailApp + Gemini via UrlFetch, time-driven trigger every 15 min) + the PWA talking to the script as a web app | Zero Firebase setup. Good for a first working version; migrate to Firebase when more than one user needs it. |
| Offline-first storage | **IndexedDB (via `idb-keyval` or Dexie) + service-worker cache** | The app works offline for viewing history and entries; Firestore remains the source of truth and syncs when back online. iOS may evict web storage under storage pressure, so never treat the device cache as the only copy. |

**Do not** put API keys, OAuth client secrets, or tokens in the app
bundle, in git, or in any file the user can see. Keys live in Secret
Manager / environment variables (server) or the OS keychain (local-only).

### 8.1 Running it on iPhone (no App Store, no $99)

- **Install:** open the app's URL in Safari → Share → Add to Home
  Screen. It gets an icon and launches full-screen like a native app.
  There is no App Store listing and no Apple Developer Program fee.
- **Push notifications:** supported on iPhone from iOS 16.4+, but only
  for the home-screen-installed app, and only after the user grants
  notification permission (ask after install, not on first visit).
  Web push is less reliable than native push, so the 15-minute Gmail
  poll must keep running server-side regardless — the phone never polls.
- **Camera/photos:** the AI chat uses a file input (`accept="image/*"`)
  for screenshots and photos, which works in iOS Safari; in-app camera
  capture via `getUserMedia` is a nice-to-have, not a requirement.
- **Limits to design around:** no background sync on iOS (the app
  cannot refresh itself while closed — the server does the Gmail
  watching); web storage can be evicted under storage pressure (keep
  Firestore as the source of truth); no Apple Pay, no native widgets,
  no TestFlight. None of these block this app's features.
- **Android/desktop:** the same URL works everywhere; Chrome/Android
  support install + push + background sync fully.

---

## 9. Security & privacy

- Least-privilege OAuth: `gmail.readonly` for reading mail; request
  `gmail.modify` only if labelling is turned on. Never request full
  mailbox access.
- Never ask for, store, or transmit a bank password, card number, or
  OTP. The app only reads alert emails the bank already sent.
- Encrypt stored OAuth tokens. Support disconnecting Gmail and deleting
  all data (one tap in Settings, with confirmation).
- The free-tier training-data caveat in §2.2 must be shown to the user
  before first use, with the local-Ollama option offered.
- No analytics, ads, or third-party data sharing in v1.
- The PWA must be served over HTTPS (the free hosts in §8 provide it) —
  service workers and web push do not work over plain HTTP.

---

## 10. Build plan (milestones — build in this order, demo each one)

- **M1 — Manual tracker as a PWA.** Entries CRUD, Day/Week/Month views, donut +
  bar charts, filters, categories, methods, bright theme, manifest +
  icons + service worker so it installs to the home screen and opens
  offline. No AI, no Gmail yet.
- **M2 — AI chat.** Chat screen; send text + photos + PDFs; Gemini
  vision extraction to the JSON schema in §4.1; confirm-before-save
  card; duplicate warning; merchant-rule learning from corrections.
- **M3 — Gmail auto-import.** OAuth connect, 15-minute poll, classify,
  dedupe, import, push notification per spend. Include the self-sent
  wallet email format and delivery e-receipts.
- **M4 — Income, bills, goals.** Income tab + balance + cash-flow chart;
  Bills tab with auto-tick; Plan tab with simple savings goals.
- **M5 — Rules & polish.** PayLater bills + rule, FX conversion,
  weekly Sunday summary, recurring income, settings, export CSV.
- **M6 — Hardening.** Fallback AI chain, offline history, web-push
  permission flow (including the iOS home-screen path), disconnect /
  delete data, onboarding (connect Gmail, set start date, set banks),
  install-prompt guidance, and a test pass on a real iPhone from the
  home screen.

---

## 11. Acceptance tests (all must pass before calling it done)

1. A bank alert email arrives → within 15 minutes the spend is in the
   tracker and exactly one `Spending Logged!💸` push arrives.
2. The same tap arrives as both a bank alert and a wallet email → it is
   imported once, and no second notification is sent.
3. A delivery e-receipt for a group order → only the user's share is
   imported, with the right merchant and category.
4. A PayLater receipt → nothing is imported as a spend; it appears as a
   pending PayLater item; when the bill email arrives, the bill is
   created with the right amount and due date.
5. A foreign-currency spend → imported in home currency at a live rate,
   with original amount + rate + date in the note.
6. The user sends a bank-app screenshot in chat → the AI lists every
   transaction in it; the user ticks two and saves; exactly those two
   are added, with the right dates and amounts.
7. The user sends a payment-notification screenshot for a spend already
   imported → the AI warns it looks like a duplicate and does not add it.
8. The user corrects a category in chat → the entry changes and the
   next spend from the same merchant is categorised correctly.
9. A transfer to the user's own number → ignored, no notification.
10. An incoming transfer from a friend → logged as income with the
    reimbursement note, not as spending.
11. A bill's exact amount is paid → the bill auto-ticks to Paid.
12. Sunday 23:59 → the weekly summary message arrives starting with
    `here's your spending for the week: ` and the numbers match the
    tracker.
13. Gmail is disconnected → polling stops, existing data stays, and
    reconnecting does not re-import old mail.
14. The primary AI model is rate-limited → the fallback model answers
    and the user sees no error.
15. All money is stored as integer cents; no rounding errors appear in
    totals.
16. On an iPhone: open the URL in Safari, Add to Home Screen, launch
    from the icon — the app opens full-screen and works.
17. A new spend arrives while the iPhone app is closed → a web push
    notification appears (iOS 16.4+, home-screen install, permission
    granted).
18. The phone is offline → previously loaded entries and history are
    still viewable; new data syncs when back online.
19. In the AI chat on iPhone, tapping attach opens the photo library /
    camera and a screenshot can be sent and parsed.

---

## 12. Placeholders the builder must ask the user to fill in

- Home currency + country (default: SGD / Singapore — change if needed).
- Banks and wallets used, and each bank's alert sender address.
- The user's own phone number / account identifiers (for the
  self-transfer exclusion) — the user supplies these, the builder never
  invents them.
- Start date for records (default: 1st of the current month).
- Whether PayLater apps are used, and which ones.
- Whether the user wants cloud AI (Gemini free tier) or local-only AI
  (Ollama).
- Hosting provider for the PWA (Vercel, Netlify or Cloudflare Pages —
  all free).

---

*Spec version: 17 Nov 2026 (revised same day — retargeted from a native
app to a web app / PWA so it runs on iPhone with no App Store fee).
Free-tier limits quoted from public sources checked Nov 2026 — re-verify
on the provider's pricing/rate-limit page before building, and again
before launch.*
