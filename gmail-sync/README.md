# Seite Gmail sync (Google Apps Script)

A small script that runs **in your own Google account**, free, 24/7. It checks Gmail every 15 minutes for bank, wallet and receipt emails, has Gemini read each one, and keeps the result in a private queue. Seite collects the queue when you open the chat. There is no server to host.

## What it can and can't see

- **Read-only Gmail access** (`gmail.readonly`). It can't send, delete or label mail.
- Email text is sent to Gemini **after** masking card/account numbers, emails and phone numbers. On the free Gemini tier, Google may use submitted content to improve its products. Narrow the search (below) to only your banks if that matters to you.
- Email bodies are never stored. The queue holds only: merchant, amount, currency, date, time, category, payment method, kind, confidence.
- Anyone with the web-app URL **and** your sync key can read the queue, so keep the key private. Rotate it by changing `SEITE_SYNC_KEY` and re-connecting Seite.

## Set up (about 10 minutes)

1. Go to <https://script.google.com> → **New project**. Name it "Seite Gmail sync".
2. Replace the contents of `Code.gs` with this folder's `Code.gs`.
3. Project Settings (gear) → tick **Show "appsscript.json" manifest file in editor**. Open `appsscript.json` and replace it with this folder's version.
4. Project Settings → **Script properties** → add:
   - `GEMINI_API_KEY`: a key from <https://aistudio.google.com> on the free tier (no billing).
   - `SEITE_SYNC_KEY`: a long random secret (for example run `openssl rand -base64 24`). You'll paste the same value into Seite.
   - Optional `QUERY`: a Gmail search to narrow what is read, such as `newer_than:2d from:(dbs.com OR ocbc.com OR grab.com)`.
   - Optional `GEMINI_MODEL`: defaults to `gemini-3.5-flash-lite`. Change it if Google renames or retires the model.
5. In the editor choose the `setup` function → **Run**. Approve the Google permission prompt. Because this is your own script, Google shows an "unverified app" warning; choose Advanced → continue. `setup` creates the 15-minute trigger and runs one pass.
6. **Deploy → New deployment → Web app**. Execute as: **Me**. Who has access: **Anyone**. Copy the URL that ends in `/exec`.
7. In Seite open **Gmail** (account menu), paste the URL and the sync key, then **Connect**.

## Behaviour

- First run only looks back 2 days, so it won't flood you with old mail.
- One pass reads up to 20 emails (the free Gemini tier is rate limited). Anything left over is picked up next run.
- If Gemini is rate limited or down, those emails are retried next run; nothing is lost.
- Queue items stay until Seite confirms it has saved them.
- `stopSync` removes the trigger. Delete the deployment to revoke the URL entirely.

## Tests

The masking and validation logic in `Code.gs` is unit tested from the Seite repo (`tests/gmail-script.test.js`). The Google services (Gmail, Gemini, triggers) can only be verified by running the script in your account.
