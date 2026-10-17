# Kanifnath Construction ERP

Static HTML + JavaScript app (Firebase Auth + Firestore), styled with Tailwind CSS. No framework, no bundler at runtime.

## Run / deploy
* **Deploy (GitHub Pages or any static host):** upload the folder as is. `assets/app.css` is pre-built and committed, so no build step is needed. All paths are relative, so it works from a sub-folder (`/repo/`).
* **Local:** serve the folder over HTTP (`npx serve .` or `python3 -m http.server`). Opening via `file://` will not work (ES modules + Firebase).
* **Changing styles:** `npm install` then `npm run build:css` (or `npm run watch:css`). Tailwind scans `*.html` and `js/*.js`. Colours/theme live in `tailwind.config.js` and `src/input.css`. `print.css` is hand-written on purpose (A4 print layout) and is separate from Tailwind.

## Files
| File | Purpose |
|---|---|
| `login.html` | Firebase email/password sign-in (the PIN screen was removed; sign-up is off by default) |
| `firestore.rules` | PROPOSED Firestore Security Rules (not deployed, not tested on a live project) |
| `index.html` | Dashboard (real Firestore data, filters, KPIs, charts, backup/restore) |
| `Billing Calculator Page.html` | Invoice create / edit / print. Open an existing one with `?id=<docId>` |
| `quotation.html` | Quotation create / edit / print (`?id=<docId>`) |
| `labour-management.html` | Labour profiles, work log, expenses, payments, reports (`?labour=<id>`) |
| `history.html` | All records, search / filters / CSV / view / edit / print / delete |
| `js/common.js` | Auth guard, app shell (sidebar, mobile drawer), toasts, modals, formatting |
| `js/data.js` | Firestore subscriptions, backup / idempotent restore |
| `js/finance.js` | Pure finance calculations shared by Dashboard and History |
| `firebase.js` | **Unchanged** Firebase config + helpers |
| `sw.js`, `manifest.json` | PWA |

## Firestore data (unchanged)
Collections: `documents` (Invoice + Quotation), `counters`, `labours`, `labourWorks`, `labourExpenses`, `labourPayments`. Existing field names and document ids are unchanged. New fields are additive only: invoices gain `terms`, `gstPercent` (already written by the old page), `updatedAt`; quotations gain `scope`, `specs`, `terms`, `payment`, `docTitle`, `gstIncluded`, `showAmounts`, `updatedAt`. Older records without these still open (defaults are used).

## How the money figures are defined
* **Invoice total** = `subtotal + gstAmount` (older records: `amount + advance`). `amount` on an invoice is the **balance after advance** (as the original app saved it).
* **Pending** = `amount` of invoices with status *Pending*. **Received** = total - pending.
* **Revenue (invoiced)** = sum of invoice totals. *(The old dashboard summed `amount`, i.e. the balance only, which under-reported revenue whenever an advance was taken.)*
* **GST:** Revenue and Profit include GST collected (GST is not netted out). Invoice GST = round(subtotal x GST% to the paise); quotation GST is fixed 18% (can be switched off per quotation). All totals are computed in whole paise so the printed subtotal + GST always equals the printed total.
* **Estimated profit** (dashboard) = revenue incl. GST - labour paid out. It excludes materials, transport, overheads and tax, so it is not net profit.
* **Profit is cash-basis for labour:** it subtracts what was actually paid out (labour expenses + labour payments), not the labour earned but still unpaid. Material/other costs are not recorded in the app, so Profit is not a full accounting profit.
* **Expenses (paid out)** = labour expenses + labour payments. **Profit** = revenue - paid out. **Labour cost (earned)** = sum of work amounts; **payable** = earned - paid out.
* A "project/site" is derived from the site name typed on invoices/labour (case and extra spaces ignored). There is no project collection, so there is no project status/contract amount; none is invented.

## Known limitations / needs Firebase Console access
* **Firestore Security Rules and Auth settings are not in the ZIP and were not verified.** The `apiKey` in `firebase.js` is a public identifier by design; real protection is the rules. Please check that rules require authentication (ideally restrict to your own user ids).
* **Authentication:** the hardcoded PIN was removed. Firebase email/password is the only gate. The login page no longer offers "Create an account" (`ALLOW_SIGNUP = false` in `login.html`); this only hides the UI. To really block sign-up: Firebase Console > Authentication > Settings > User actions > untick "Enable create (sign-up)" (do it after all staff accounts exist). Create staff in Authentication > Users.
* **Firestore Rules:** `firestore.rules` is provided but NOT deployed and NOT tested against your project. Put your real staff UIDs in it, paste it in Firebase Console > Firestore Database > Rules > Publish, then verify in the Rules Playground (signed-out = denied, staff UID = allowed). Without this step anyone who can sign in could read the data. Restoring a backup that would lower an invoice/quotation counter is rejected by these rules on purpose.
* Offline: the PWA caches the app shell only; data needs a connection (Firestore offline persistence is not enabled).
* **Logo icons are PLACEHOLDERS, not your logo.** No real logo file was supplied in any ZIP, so `icon-1922.png` (192x192) and `icon-5122.png` (512x512) are plain maroon "KC" monograms so the PWA can install and no image is broken. Replace both files (same names and sizes) with your real logo; nothing else needs to change.
* Offline: the service worker also caches the versioned Firebase SDK files after the first online visit; data itself still needs a connection.

## Backup & restore (what it really does)
* Backup = JSON with invoices/quotations, labours, work, expenses, payments. Invoice/quotation **counters are not stored in the backup**.
* Restore validates the file first (max 10 MB / 20,000 records, no duplicate or invalid ids, documents must be Invoice or Quotation, child records need `labourId`, prototype-pollution keys are stripped), then shows a preview (new vs overwritten per collection) and asks for confirmation. Nothing is ever deleted.
* Records go back to their **original ids**; same-id records are **overwritten** by the backup copy. Download a fresh backup first if you may want to undo.
* If some writes fail you get a "Restore incomplete" message listing what failed; running the same restore again is safe and finishes the rest.
* After a successful restore the invoice/quotation counters are raised (never lowered) to the highest restored number, so new numbers cannot repeat. The proposed `firestore.rules` enforce "counters can only go up".
* Old backups whose records have no id are added as NEW records; restoring such a file twice duplicates them (the preview warns).

## Theme
Maroon `#850D0D`, white cards, `#F7F8FA` background, `#222B3A` text (tokens in `src/input.css` / `tailwind.config.js`; rebuild with `npm run build:css`).
