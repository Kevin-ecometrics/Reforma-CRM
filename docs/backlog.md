# Backlog / integration progress

Running log of what's been wired up, what's confirmed working, and what's still
open — mainly for the Facebook integrations, since those took the most back-and-forth
to get right. Newest entries at the top of each section.

## Done

- **Outbound email (SMTP)** — wired to the clinic's own domain mailbox
  (`mydentist@reformadental.com`) via cPanel/Namecheap-style hosting
  (`host11.registrar-servers.com:465`). `SMTP_FROM` had to be corrected to
  match the authenticated `SMTP_USER` domain — a mismatched From address gets
  rejected/flagged by most SMTP relays. Confirmed working with a real
  self-test send (`ok: true` from `/api/messaging-test`). Email automation
  rules are still off by default (per `README.md`) — turn them on in
  Settings → Automation rules once the message copy is reviewed.
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

## Blocked

- **Outbound WhatsApp (Meta Cloud API)** — waiting on the business owner.
  Entry point: [developers.facebook.com/apps/1567984181462924](https://developers.facebook.com/apps/1567984181462924)
  (the same Meta App used for Lead Ads/CAPI) → the "Requisitos y
  personalización de la aplicación" checklist → **"Personaliza el caso de uso
  Conectar con los clientes a través de WhatsApp"** (don't touch the other
  use cases listed there — Marketing API, Catalog, Instagram, etc. are
  unrelated). That flow leads to "Aceptar las Condiciones del servicio de la
  plataforma de WhatsApp Business" — a real ToS acceptance on behalf of the
  business, then on to **API Setup** for the Phone Number ID + temporary
  access token + adding a verified test recipient number.

  **Caveat found while checking this**: the checklist item for the WhatsApp
  use case showed as green/checked in the App Dashboard panel *before* the
  setup was actually completed — don't trust the green checkmark alone as
  proof it's done. Verify by actually reaching API Setup and getting real
  values for `WHATSAPP_PHONE_NUMBER_ID` / the access token, not just by the
  checklist turning green.

  Once the owner hands over `WHATSAPP_PHONE_NUMBER_ID` and
  `WHATSAPP_ACCESS_TOKEN`, drop them in `.env` and send a real test message
  via `/api/messaging-test` to confirm before enabling any WhatsApp
  automation rules. Steps: [facebook-setup.md §6](./facebook-setup.md#6-set-up-whatsapp-cloud-api-for-outbound-whatsapp).
- **Outbound SMS (Twilio)** — waiting on the business owner. Separate
  platform from Meta, needs a brand-new Twilio account (billing/business
  info) created and owned by the business, not something to set up on their
  behalf. In the US, SMS may also require A2P 10DLC carrier registration
  before production sending works (can take days to approve). Once the owner
  hands over `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_FROM_SMS_NUMBER`,
  drop them in `.env` and send a real test message via `/api/messaging-test`
  to confirm before enabling any SMS automation rules.

## Not started

(nothing currently — SMTP, Facebook Lead Ads/CAPI are done; WhatsApp and
Twilio are blocked on the owner above.)
