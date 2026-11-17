# Seite · Daily Spending

A spending tracker and offline PWA with server-backed AI receipt chat. This implements **M1/M2** of the [build spec](spending-tracker-build-spec.md), using React, Vite and `vite-plugin-pwa`. The existing cream/coral design and IndexedDB records are preserved.

## Run

Use Node.js 22.12+ (an even-numbered supported release; Node 24 recommended).

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. The old Python static-server command no longer serves the source app; JSX is compiled by Vite.

To check the production PWA locally:

```sh
npm run build
npm run preview
```

For the manual tracker alone, deploy `dist/` to an HTTPS static host. AI chat also needs the protected backend described below. The build generates the manifest, service worker and versioned offline asset cache. Service workers are enabled in production builds, not the development server.

## Code structure

```text
src/
  App.jsx                Welcome/account/tracker page coordination
  account/               Local profile/preferences provider and navigation
  main.jsx               React entry point and service-worker registration
  pages/
    HomePage.jsx         Z-flow introduction and email-to-tracker illustration
    AuthPage.jsx         Dummy sign-in/sign-up screens
    TrackerPage.jsx      Existing manual tracker screen
    AccountPage.jsx      Profile, preferences, data, help and privacy screens
  components/
    account/             Small settings panels, menu and data dialogs
    AppErrorBoundary.jsx Recoverable fallback for render failures
    Brand.jsx            Shared Seite wordmark
    ProductPreview.jsx   Illustrative product preview (no seeded records)
    SeiteLoader.jsx      Rising liquid icon and loading captions
    TrackerControls.jsx  Period navigation and filters
    SpendingTotal.jsx    Selected period total
    CategoryChart.jsx    Interactive category donut
    DayChart.jsx         Interactive day bars
    EntryList.jsx        Entries and empty state
    EntryForm.jsx        Create/edit form and validation feedback
    DeleteConfirmation.jsx
    Modal.jsx            Native dialog lifecycle
  hooks/
    useDataControls.js   Export, reviewed restore and local deletion
    useEntries.js        Load/save/delete state and storage status
    useOnline.js         Connection status
    usePageNavigation.js Hash navigation and page transitions
  lib/
    account.js           Profile/preferences validation and local keys
    backups.js           JSON validation, restore planning and safe CSV
    config.js            Categories, methods and colours
    dates.js             Singapore today, date ranges and navigation
    money.js             Decimal input → integer cents; formatting and totals
    transactions.js      Entry validation, creation, filtering and sorting
    storage.js           IndexedDB persistence
  styles.css             Formatted styles for the current tracker
  welcome.css            Landing/account layouts, transitions and liquid animation
  account.css            Account menu, settings panels and feedback
public/icons/            PWA and Apple touch icons
tests/                   Focused unit, IndexedDB and UI tests
vite.config.js           React, PWA and test configuration
```

Components use JSX and React event handlers. Business rules live in ordinary functions and storage is isolated behind `entryStorage`. No global click dispatchers or HTML-string templates are used. Prettier keeps the source consistently formatted.

## Checks

```sh
npm test
npm run build
npm run format:check
```

`node checks.cjs` remains a compatibility shortcut for `npm test`.

Tests cover integer-cent arithmetic, validation, calendar boundaries, filters, IndexedDB CRUD, UI forms, save failures, delete confirmation, chart keyboard interaction, period navigation, offline viewing, profile/preferences persistence, sign-out, backup validation, atomic restores, CSV formula handling, deletion isolation and render-error recovery. Tests use jsdom and fake-indexeddb; real-browser layout, service-worker operation and physical iPhone installation still need verification. Browser automation was unavailable in this session.

## Welcome and account preview

The app now opens on a landing page with a desktop Z reading flow, an illustrative email-to-spending preview and three steps explaining the planned AI workflow. On mobile, the same story stacks vertically.

- `#/home`: landing page (also the default at `/`).
- `#/signin` and `#/signup`: styled dummy account forms.
- `#/tracker`: working tracker; accessible without an account.
- `#/chat`: AI receipt review and spending questions (requires server setup).

Submitting a valid account form or choosing **Explore without an account** opens a three-second loading sequence: two waves wash left and right as they fill the Seite mark, while reassuring captions change below. **Open tracker now** skips the sequence; **Back** cancels it. Page changes fade and slide, with reduced-motion alternatives. Hash routes support refresh and browser Back/Forward without server route configuration.

Account fields are never sent, logged or saved. There is no real authentication or email connection. The landing page labels its illustrated data as an example and notes that email import is upcoming and AI chat requires setup.

## Account essentials

Open the avatar in the tracker header for **My profile**, **Preferences**, **Your data**, **Help & getting started**, **Privacy & about**, or **Sign out**. The settings layout stacks on mobile; the add-entry bar remains fixed to the viewport on the tracker.

- **Profile:** optional display name and contact email, generated initials, four avatar colours, explicit save/discard actions and storage-error feedback. Saved only in this browser. Profile email does not change a login or connect Gmail.
- **Preferences:** default Day/Week/Month view, default payment method for new spends, and reduced motion. Light theme and SGD/Singapore remain the current supported choices.
- **Sign out:** clears the local preview-session flag and returns to sign-in with confirmation. Entries and profile remain on the device. This is a guest/demo session action, not real authentication or a password lock. Direct tracker access remains available without an account.
- **Data export:** export every entry as CSV for spreadsheets or as JSON for restoration. Formula-like CSV text, including full-width variants, is prefixed with a tab for spreadsheet viewing. JSON preserves the entry records without spreadsheet formatting.
- **Restore:** choose a version-1 Seite JSON backup (up to 5 MB), review new-entry count and total, and confirm. Exact matching IDs are skipped; conflicting IDs reject the batch. Validation and the IndexedDB transaction prevent partially imported batches. This restores entries only, not profile/preferences.
- **Delete local data:** a separate dialog offers backup first and requires typing `DELETE`. Removes entries and Seite’s profile/preferences keys from this browser. Other sites, downloaded files and other devices are unaffected. Failures are shown explicitly, including partial completion across IndexedDB and localStorage.
- **Help:** searchable FAQ for entries, filters, offline/install, storage, backups, sign-out and future integrations. Password-help in the sign-in screen explains the preview rather than claiming a reset email was sent.
- **Privacy & about:** app version, connection status, actual storage locations and integration status. No real mailbox/bank/AI connection is implied.
- **Error recovery:** a render-error fallback offers reload without deleting stored entries.

Profile/preferences use `seite-account` in localStorage. Only a boolean preview-session flag is stored in sessionStorage (`seite-preview-session`). Passwords and the dummy auth-form email/name are never persisted; profile details are saved separately only through the explicit profile form.

The additions follow [NN/g’s user-control guidance](https://www.nngroup.com/articles/user-control-and-freedom/) and [W3C guidance for clear success/error feedback](https://www.w3.org/WAI/tutorials/forms/notifications/). Backup/restore addresses [browser storage eviction and user-cleared data](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria). CSV handling follows [OWASP’s formula-injection guidance](https://owasp.org/www-community/attacks/CSV_Injection).

## M1 behaviour and data

- Starts empty in Day view, with SGD and Singapore date defaults.
- Add/edit/delete spends with merchant, amount, transaction date, optional time, category, payment method and optional note.
- Notes and source appear in the edit dialog; deletion requires confirmation.
- Day, Monday–Sunday Week and Month views; merchant/category/method/date filters.
- Interactive category donut and day bars.
- Integer-cent storage; writes are confirmed only after the IndexedDB transaction commits.
- Responsive light theme, install guidance, manifest, icons and an offline app shell.

Records remain in the same `seite-tracker` IndexedDB database and `records` store. Schema version 2 adds `chat` and `merchant_rules` stores without replacing saved entries. The old prototype's `seite-data` localStorage is not migrated; seeded demo records are not imported. It is removed only if you confirm Delete all local data.

**Records are stored only in this browser on this device.** There is no cloud backup or device sync yet. Clearing site data, private browsing or storage eviction can remove entries.

## Install and offline use

On iPhone, serve over HTTPS, open in Safari, then choose **Share → Add to Home Screen**. On Android/desktop, use the browser's Install action. Install links are intentionally absent from the app navigation; installation remains available through the browser.

After the first production load, reload once so the service worker controls the page. Previously saved entries should remain accessible after disabling networking and reloading. Verify this on the target device before relying on offline access.

## Bulk removal in chat

Asking the assistant to remove several entries (for example "delete all my transport spending in October") produces a reviewable proposal, never an immediate change.

- **Filter, not IDs:** the model only describes a filter (category, payment method, merchant text, date range). The app finds the matching saved entries itself. A filter needs at least one field, so "delete everything" is refused; use Your data → Delete local data for that. Up to 200 matches can be reviewed at once.
- **Review:** every match is listed with a running count and total. Untick any entry to keep it.
- **Stronger confirmation:** removing 10 or more entries requires typing the count.
- **All or nothing:** the removal commits in one IndexedDB transaction. If any entry changed since the preview, nothing is removed.
- **Undo and backup:** the applied card offers **Undo** (restores every removed entry together, or none if an ID now exists) and **Download backup** (a Seite JSON file of just the removed entries, restorable from Your data).

## Gmail auto-logging

A small Google Apps Script in your own Google account (folder `gmail-sync/`, setup steps in its README) reads bank, wallet and receipt emails read-only every 15 minutes, has Gemini parse each one, and keeps only the parsed fields in a private queue. Seite collects the queue when the chat is open (on opening, every 10 minutes while open, and on **Check now**), then acknowledges each item so it is removed from the queue.

- **Saved automatically:** SGD expenses with confidence of at least 0.85, a clear payment method and no same-day same-amount entry already saved. They are marked as imported from Gmail and the chat says what was added.
- **Shown for review:** unclear, foreign-currency, vague-payment-method or possible duplicate transactions use the same review card as receipt scans.
- **Never logged:** refunds, income and transfers.
- **No double counting:** each email is saved under `gmail-<message id>`, so a re-delivered email is ignored.
- **Demo tab:** account menu → Demo groups the sample November data (147 entries added on each sign-in, with a switch to turn that off, reload or remove them), the Gmail demo and a Prototype A/B switch (A is the original layout with donut and day bars; B is insight-first, with headline numbers, ranked category bars and entries grouped by day; the same switch also sits at the top of the tracker).
- **Gmail demo mode:** account menu → Demo → Try the demo. Simulated bank emails go through the same queue, auto-save, review and skip steps with no Google setup. Demo entries are labelled “demo data” in their note and can be removed without touching other entries. It never reads a real inbox.
- **Connect:** account menu → Gmail. The script URL and sync key are stored in this browser only and removed by Delete all local data.
- **Privacy:** card/account numbers, emails and phone numbers are masked before text goes to Gemini. On Gemini's free tier Google may use submitted content to improve its products.

## Remaining milestones

M1, the account essentials and the local M2 AI integration are implemented. Live model verification needs your server-side key. Gmail, income, bills, goals, push notifications and cloud sync remain future milestones. Profile/preferences and data export/restore work locally. Hosting and provider credentials are not configured. Verify provider availability, pricing and free-tier requirements when implementing those integrations.

Framework references: [Vite React plugin](https://vite.dev/plugins/), [Vite PWA documentation](https://vite-pwa-org.netlify.app/guide/).

## AI chat (M2): Gemini setup

The AI chat is implemented at `#/chat`, accessible through **AI chat** in the fixed tracker navigation. It needs the local Node API server; a static-only preview cannot call the models.

1. Copy `.env.example` to `.env` without replacing any existing settings.
2. Create a key in [Google AI Studio](https://aistudio.google.com/apikey) for an **unpaid free-tier project**. Do not enable Cloud Billing or add a payment method.
3. Put the key in `GEMINI_API_KEY` in `.env`. Never paste it into chat, put it in a `VITE_*` variable, or commit it.
4. Check the project's current model access and limits, then set `AI_FREE_TIER_CONFIRMED=true`. The app cannot inspect your Google project's billing status; this flag is your explicit confirmation that you configured an unpaid project.
5. Run `npm run dev`. This starts the React app at `http://127.0.0.1:5173` and the server-only API at `http://127.0.0.1:8787`. Restart after changing `.env`.
6. Open the tracker → **AI chat**, choose a photo or PDF and press Send; try a cropped receipt or screenshot without full account/card numbers or OTPs.

No provider key is included. Until you configure one, chat shows setup instructions and existing history remains viewable; it does not manufacture AI responses.

For a production-build check on this computer:

```sh
npm run build
npm start
```

Open `http://127.0.0.1:8787`. `npm run preview` serves only static files and is intended for frontend checks, not AI requests.

**This backend is deliberately local-only while account authentication is a dummy preview.** It binds to loopback, checks origins/hosts, limits request size and concurrency, and never serves dotfiles. Public hosting and access from an iPhone require a protected hosted backend with real access control; do not expose this local demo API or its keys publicly. Choosing/deploying that backend is separate from the local M2 implementation.

### What M2 supports

- Text questions, iPhone HEIC/HEIF photos, JPEG/PNG/WebP/AVIF screenshots and photos, and a selected PDF page. Images are resized in the browser; PDFs are rendered locally through PDF.js and only one chosen page is sent as an image. Encrypted/unreadable PDFs can be supplied as screenshots instead.
- Structured JSON extraction with nullable unreadable fields, confidence, category, payment method, transaction date/time and notes. Missing fields must be filled rather than guessed.
- Editable review cards and multi-entry selection. Saving is explicit. Date/amount duplicates default to No; an explicit override is required. Unique external references make repeated saves idempotent, even when duplicate overrides are enabled.
- Low-confidence and group-order safeguards: confirm unclear fields, and provide/confirm your own share. Refunds, income, self-transfers and PayLater purchases cannot be saved as outgoing spends.
- Full-refund matching: select and confirm the matching original spend to mark it refunded. It stays in history, is excluded from totals and can be unmarked in its edit form. Partial/unmatched refunds require adjusting the original spend manually; logging refund income waits for the income milestone.
- Latest available Frankfurter mid-market **reference** rates for foreign receipts. These are dated central-bank/reference rates, not intraday trading quotes. The converted SGD amount, original cents, rate and dates are retained. An unavailable or stale rate blocks saving; it is never guessed.
- Spending questions choose from app-calculated facts for today/this week/this month, category/method totals and biggest spends. The returned financial sentence is taken from the calculated fact, replacing any model-created total. A link opens the corresponding filtered tracker view. Bills/income and arbitrary historical periods are not available in these answers yet.
- Explicit category corrections are shown for confirmation, then update the saved entry or draft and remember an exact normalized merchant → category rule. Draft follow-ups use the ordered previous extraction; raw screenshots are not resent from history.
- Local chat history in IndexedDB, up to 100 messages; only the last six text messages and bounded summaries/recent entries are sent to a model. Attachments are **not** retained. Clear chat keeps saved spends and merchant rules; Delete all local data clears all three stores and cloud-consent settings.
- Sensitive/local-only messages and entries are excluded from later cloud context, including restored backups. Cloud answers are labelled “Shared entries only” if private entries were excluded; their tracker link preserves that filter. Simple spending questions are answered locally using the complete saved dataset.

### Providers, free tiers and model changes

Model IDs are centralized in `server/ai/config.js`; keys and enabled providers come only from `.env`. The AI SDK adapters request structured JSON and the shared Zod schema validates every result. Gemini uses a simplified native generation schema with strict local validation; Groq/OpenRouter use JSON-object mode with the schema in the prompt. No prose is parsed for amounts or dates, no paid models/grounding tools are selected automatically, and there is no paid fallback or credit-purchase flow.

The current default is **`gemini-3.5-flash-lite`**, verified against [Google&#39;s current free-tier pricing](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash-lite). The spec's `gemini-2.5-flash` is now listed as deprecated, with routing changes announced for December 1, 2026. This updates the provider/model choice without changing spending rules. Exact free quotas depend on your project; check AI Studio rather than relying on the spec's quoted daily limit.

Optional free cloud fallback keys can be configured for **Groq `qwen/qwen3.8-27b`** and **OpenRouter `openrouter/free`** or an explicitly configured `:free` vision model. The spec's Groq Scout example is no longer the model listed in the current vision guide. Verify [Groq&#39;s vision support](https://console.groq.com/docs/vision) and [free-plan limits](https://console.groq.com/docs/rate-limits), and [OpenRouter&#39;s current limits](https://openrouter.ai/docs/api_reference/limits). Use free, unbilled accounts; no top-up is needed or performed by this app. The model that answered is shown in chat and logged without prompts, files, keys or provider error bodies. Optional fallbacks can be turned off per chat request.

Google's free tier may use submitted content to improve its products, as described in [Google&#39;s API terms](https://ai.google.dev/gemini-api/terms). Upload only the cropped/redacted item being reviewed. Text redaction removes account/card/phone-like long digit sequences while preserving ISO receipt dates; it does not perform OCR redaction of images. Uploads no longer require an extra checkbox. Never send full bank statements to cloud AI.

### Optional local Ollama mode

Install Ollama and a downloaded vision model such as `gemma3:4b`, then set `OLLAMA_ENABLED=true` and `OLLAMA_MODEL=gemma3:4b` in the server `.env`. This can require several GB of disk/RAM; it is not downloaded automatically. For private use, disable Ollama cloud features in Ollama itself (`OLLAMA_NO_CLOUD=1` when starting its server, or its documented local settings). See [Ollama structured outputs](https://docs.ollama.com/capabilities/structured-outputs) and [OpenAI compatibility](https://docs.ollama.com/api/openai-compatibility).

The optional backend local/sensitive mode (not exposed in the streamlined chat UI) forces the fixed loopback Ollama endpoint and has **no cloud fallback**. Before passing any content to Ollama, the API checks its installed-model metadata and rejects remote/cloud-proxied models. Local mode works without cloud consent or a cloud key, but does need the local model service running.

### M2 verification and limits

Tests cover provider wire formats through the installed SDK with mocked HTTP responses, rate-limit fallback, no-cloud sensitive routing, local-model verification, consent enforcement, host/origin checks, screenshot review, selected-only saving, duplicates, category learning, full refunds, foreign-currency audit fields and backup round-trips, local history/privacy exclusions, and chosen-page PDF handling. Production builds cache the PDF worker as well as the app shell; API responses are not cached by the service worker.

The Frankfurter MYR→SGD endpoint was checked live. **Live Gemini text and synthetic receipt-image extraction were verified on 17 November 2026 after the server key was configured.** The local API returned HTTP 200 and the expected SGD 3.20 receipt fields. Groq/OpenRouter/Ollama generation remains mocked unless separately configured and tested. Accuracy on your own receipts, browser layout, PDF rendering on real devices and a real iPhone test still need checking. Mocked tests do not claim model accuracy. Gmail OAuth/polling, push notifications, income/bills/goals and the remaining milestones are separate work.

### M2 code map

- `server/ai/config.js`: model choices and free-tier restrictions.
- `server/ai/client.js`: shared provider interface, fallback chain and validated output.
- `server/ai/output-schema.js`: reduces Gemini decoder complexity while retaining strict application validation.
- `server/ai/failure.js`: safe error classification for response-format, key/access, quota, timeout and output failures.
- `server/ai/local-model.js`: checks that private mode uses downloaded local weights.
- `server/http.js`, `server/fx.js`: local API boundaries and dated reference rates.
- `shared/ai-schema.js`, `shared/privacy.js`: request/output schemas and text redaction.
- `src/chat/`: client requests, compact facts, review rules, IndexedDB chat/rules and conversation state.
- `src/components/chat/`: privacy notice, attachment composer, selected-page PDF preview and review/refund cards.
- `src/pages/ChatPage.jsx`: chat screen and mode controls.

All model calls are request/response operations; there are no unattended Gmail polls or push jobs in M2.

### Gemini schema compatibility

Gemini rejected the original bounded receipt schema with HTTP 400 (`too many states for serving`). The generation schema now retains object structure, required keys, nullable fields and category enums, while leaving string-length, array-count, numeric-bound and pattern checks to the unchanged Zod validator. Invalid outputs are still rejected before they reach review/save logic. This follows [Google’s structured-output guidance](https://ai.google.dev/gemini-api/docs/structured-output). The API now reports actionable error categories instead of concealing every provider failure behind a generic retry message.

### iPhone photo uploads

Use **Photo or PDF** to choose from the photo library or Files, or **Take photo** for a camera capture. The library picker does not force the camera; the separate camera input requests the rear camera where supported.

HEIC/HEIF photos are accepted directly, including uppercase extensions, generic/empty MIME types and HEIF container detection. Safari’s native image decoder is tried first; if the browser cannot decode HEIC, a lazy-loaded `heic-to` worker converts it locally. No original photo is uploaded to an external conversion service. Photos up to 20 MB are accepted (the PDF limit remains 10 MB), resized to a maximum 2,000-pixel edge, and encoded as JPEG within the AI API payload limit. Re-encoding drops source EXIF metadata. Image bytes leave the device only when you choose Send. The upload confirmation checkbox has been removed.

The fallback decoder is included in the PWA’s offline cache. Tests cover native decoding, fallback conversion, missing MIME types, resizing, limits, camera/library inputs and sending only the prepared JPEG without an extra upload checkbox. Actual device-picker behaviour and decoding on a physical iPhone remain to be verified. Safari’s native HEIC support is documented by [WebKit](https://webkit.org/blog/14445/webkit-features-in-safari-17-0/); the fallback uses [heic-to](https://github.com/hoppergee/heic-to).

After updating an already-installed PWA, close old Seite tabs and reopen it to let the new service worker activate.

### Chat and entry UI

Chat opens directly in Gemini cloud mode. The mode/fallback/sensitive controls and first-use declaration panel are removed; sending uses the configured cloud providers. The server request retains its authorization field, set by the app when the user presses Send. Existing private entries/history remain excluded from cloud context. Simple today/week/month spending questions run locally, including private entries, and private totals stay local-only in history.

The chat has a contained, scrolling conversation with a persistent composer, clickable starter questions, Enter-to-send and Shift+Enter for newlines. Review cards retain Save/Cancel, duplicate protection and financial validation. Provider/model implementation labels are removed from message bubbles. Entries and Install are removed from the fixed navigation, and the top-right Install app button is removed.

Manual entry emphasizes the SGD amount, groups date/time and uses warm form surfaces. `SelectField.jsx` provides one [Radix Select](https://www.radix-ui.com/primitives/docs/components/select) wrapper across manual entry, receipt review, refunds, filters and preferences. Options support keyboard navigation, type-ahead, Escape, selected indicators and category colours. Menus inside native modal dialogs portal into the dialog so they remain in its top layer. `forms.css` owns these shared styles.

Browser preview is unavailable in this session. Functional changes are covered by component tests; desktop/mobile visual QA remains pending.

### Saved-entry actions in chat

You can now ask Seite to change saved entries, for example:

- “Remove the recently added log.”
- “Remove the Test cafe entry.”
- “Change Test cafe to $11.70 and pay by Cash.”
- “Rename that entry to Kopi & Toast.”
- “Move that entry to yesterday.”
- “Change the category to Groceries.”

Each action shows its target and an explicit Remove entry / Apply changes button plus Cancel. Nothing is changed by the model itself. Edits show the old and new field values. When the target is unclear, choose from the supplied recent entries. Undo restores the exact original entry and persists with the action in chat history. Saved receipt cards reflect later edits/removals and cannot accidentally re-save a deleted expense.

“Recently added” means the newest `created_at`, independently of transaction date. The standard most-recent deletion command works entirely locally, even without Gemini availability. Equal save times show a chooser. Other natural-language actions are parsed by Gemini using the allowlisted `entryActionSchema`: delete one entry or update merchant, integer SGD amount, date, time, category, payment method and/or note. The model sees at most 12 recent permitted entries and cannot invent a target ID, run arbitrary code, perform external actions or delete the whole tracker. Existing category-learning and refund flows are retained. Foreign-currency amount changes are deferred to the tracker so conversion details can be reviewed.

`entry-actions.js` handles proposals and validation; `entry-action-storage.js` commits entry/chat changes atomically; `useEntryActions.js` coordinates the action lifecycle; `EntryActionCard.jsx` renders previews and results. Applying a stale preview or Undo never overwrites a newer edit from another tab. Cancellation only updates the chat action. Live Gemini edit parsing was verified with synthetic data on 17 November 2026; this did not modify the user’s saved entries.

## Income, bills and plan

- **Income:** on the tracker, switch Expenses | Income. Income is stored separately and never mixes into spending totals. It shows money in, money out and the balance for the selected period, where the money came from, and add/edit/delete.
- **Bills:** the Bills tab lists upcoming bills by month with Paid, Due soon, Due today and Overdue labels (amounts can be “TBC”). A saved spend with the same merchant words and the exact amount ticks a bill paid; a manual tick or untick always wins. Ticking a recurring bill creates next month's.
- **Plan:** set spending limits for today, this week and this month (a slim reminder shows on the tracker), and track savings goals with progress bars. Limits are kept in the browser; goals, bills and income are in IndexedDB (schema version 3).
- **Sample data:** the Demo tab adds sample income, bills (November and December), three savings goals and starter limits along with the November spending. Your own limits are never overwritten, and removing the sample data removes only the sample records.
- **Not included yet:** income, bills and goals are not part of the JSON entries backup, and the chat does not read them yet.

- **AI message limit:** the server allows 100 AI chat messages per client every 24 hours (change it with `CHAT_DAILY_LIMIT`), on top of the existing 10 per minute and 2 at a time. Past the limit, chat shows how long until messages free up, and the rest of the app keeps working.

## Deploying the chat on Vercel

The `api/` folder holds three Vercel functions (`/api/chat`, `/api/ai/status`, `/api/fx`) that reuse the same code as the local server (`server/vercel.js`). In Vercel → Settings → Environment Variables add `GEMINI_API_KEY` and `AI_FREE_TIER_CONFIRMED=true` (names without `VITE_`), then redeploy. On Vercel the whole site shares one allowance of 100 AI messages per 24 hours (`CHAT_DAILY_LIMIT` changes it), and only requests from the site's own address are accepted. Without a shared counter each function instance counts on its own, so add a free Upstash Redis store from Vercel's Storage tab to make the limit exact. Private on-device AI (Ollama) is off in the cloud.
