# Backlog / integration progress

Running log of what's been wired up, what's confirmed working, and what's still
open — mainly for the Facebook integrations, since those took the most back-and-forth
to get right. Newest entries at the top of each section.

## Done

- **Facebook Lead Ads sync** — polling every 5 min via `syncFacebookLeads()`.
  Confirmed pulling real leads end to end. Required Page Access Token permissions:
  `pages_show_list`, `pages_read_engagement`, `pages_manage_ads`, `leads_retrieval`
  (the last one needed enabling under the app's own App Review → Permissions
  first — see [facebook-setup.md](./facebook-setup.md#3-get-a-page-access-token-for-lead-ads-sync)).
- **Page Access Token validity check** — daily automatic check + manual "Check
  token" button in Settings, via `checkFacebookTokenValidity()` in
  `src/lib/facebookSync.ts`. Surfaces a red "Page token: invalid" chip in
  Settings before the sync silently starts failing.
- **Duplicate lead cleanup** — two leads (Narda Newkirk, Micheal Hagstrom) had
  been entered manually pre-API with `source: "facebook"` but no real
  `fbLeadgenId`. Once the real sync came online it created fresh duplicates.
  Merged: kept the original records (with their notes/history) in `scheduled`,
  attached the real `fbLeadgenId`, deleted the empty duplicates. One-off fix,
  not an automated dedup — if this happens again, dedupe by matching
  email/phone against leads with `fbLeadgenId: null`.
- **Facebook Conversions API (CAPI)** — outbound stage-change events firing
  via `sendCapiEvent()` on every lead creation and stage change. Confirmed
  working with a direct API call (`events_received: 1`, no `messages`) and via
  the app's own activity log (`capi_sent` on the verification lead's "New" and
  "Contacted" transitions).
  - Gotcha: Events Manager has two different "Generate access token" flows —
    **"Configurar con Dataset Quality API"** issues a read-only
    `read_ads_dataset_quality` token that *cannot* send events, even though it
    looks identical in the UI. **"Configurar sin Dataset Quality API" →
    "Continuar solo con integración directa"** is the one that works for
    sending events. `debug_token` on a working system-user token still only
    shows `read_ads_dataset_quality` in `scopes` — that field isn't a reliable
    check for this token type; the real test is sending an event and checking
    `events_received` / `messages` in the response.

## Open

- **Meta's Lead Ads → CRM verification widget** in Events Manager ("Recibiendo
  actividad") still shows "Esperando un evento" even after a real CAPI event
  was sent and accepted (`events_received: 1`). The integration itself is
  confirmed working via direct API test; this is Meta's own UI checklist, not
  a functional blocker. Follow up via "administra conexión" to see if it
  reports connected there instead — cosmetic/status-only, not urgent.
- **`.env` vs `.env.local` naming** — the working env file is currently named
  `.env` (both are gitignored, so no leak risk), but `README.md`'s setup
  instructions and `.env.local.example` still reference `.env.local`. Not
  breaking anything (Next.js loads `.env` fine), but worth reconciling so a
  fresh clone's setup instructions match what's actually on disk.

## Not started

- **Outbound email (SMTP)** — `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`/`SMTP_FROM` unset.
- **Outbound SMS (Twilio)** — `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_FROM_SMS_NUMBER` unset.
- **Outbound WhatsApp (Meta Cloud API)** — `WHATSAPP_ACCESS_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID` unset.
  Setup steps already documented in [facebook-setup.md §6](./facebook-setup.md#6-set-up-whatsapp-cloud-api-for-outbound-whatsapp).
