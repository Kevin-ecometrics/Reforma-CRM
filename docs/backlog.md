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

## Done

- **Outbound WhatsApp (Meta Cloud API)** — owner accepted the WhatsApp
  Business Platform ToS (under the "Ecommetrica Studio" business portfolio —
  the app's owning business, not the Page's; expected for an agency-managed
  setup, confirmed intentional). Got the test number's Phone Number ID
  (`1332188503303466`, test number +1 555 204 4430) and a temporary (24h)
  access token, both saved in `.env`. Verified with `debug_token`:
  `whatsapp_business_messaging` scope present, `is_valid: true`.
  - **Confirmed free-form text messages fail silently outside the 24h
    session window** — sent a plain `type: "text"` test message via the
    CRM's own `/api/messaging-test`; the Graph API accepted it (200, with a
    `message id`) but it never arrived, because the test recipient had never
    messaged the test number first. Sending the same recipient a
    `type: "template"` message (`hello_world`, Meta's default pre-approved
    template) delivered successfully. This confirms the caveat already
    called out in `src/lib/messaging/whatsapp.ts` and
    `facebook-setup.md` — it just wasn't verified live before now.
  - **Real gap found**: `sendWhatsapp()` only ever sent `type: "text"` — the
    "New lead arrives → send confirmation message" automation rule (WhatsApp
    channel) would have looked successful (message id returned) while
    silently never reaching a brand-new lead, since first contact is always
    outside the 24h window.
  - **Fixed**: added `sendWhatsappTemplate()` to
    `src/lib/messaging/whatsapp.ts` (sends `type: "template"` with a
    `name`/`language`/optional `components` body-parameter list) and a
    `MessageTemplate.whatsappTemplateName` /`.whatsappTemplateLanguage`
    field (`src/lib/types.ts`) so a CRM template can opt into sending via an
    approved Meta template instead of free text.
    `sendMessageToLead()` (`src/lib/messaging/index.ts`) now branches on
    that field automatically, and `PATCH /api/settings/templates` accepts
    both new fields. Verified the exact request shape against the live API
    (both with and without `components` — the zero-params case returned
    `message_status: "accepted"`; the with-params case against `hello_world`
    correctly errored on param-count mismatch, confirming the payload itself
    is well-formed).
  - **Still open**: no real approved business template exists yet — only
    Meta's demo `hello_world`. The "new-lead-confirmation" WhatsApp CRM
    template has *not* been pointed at it (would send meaningless "Hello
    World" content to real leads). Creating and getting Meta's approval for
    an actual template (e.g. "thanks for reaching out, we'll call you
    shortly") is a manual step under WhatsApp → Message Templates — do that,
    then set `whatsappTemplateName`/`whatsappTemplateLanguage` on that CRM
    template via Settings before enabling the automation rule.

  Confirmed-working template send (PowerShell), for reference:
  ```powershell
  curl -i -X POST `
    https://graph.facebook.com/v25.0/1332188503303466/messages `
    -H 'Authorization: Bearer {WHATSAPP_ACCESS_TOKEN from .env}' `
    -H 'Content-Type: application/json' `
    -d '{ \"messaging_product\": \"whatsapp\", \"to\": \"{recipient in E.164, no +}\", \"type\": \"template\", \"template\": { \"name\": \"hello_world\", \"language\": { \"code\": \"en_US\" } } }'
  ```

## Open

- **WhatsApp: no real approved business template yet** — code support is
  done (see above); don't enable the WhatsApp "new lead confirmation"
  automation rule until an actual template is created and Approved in Meta,
  and assigned to that CRM template via Settings.
- **WhatsApp permanent token: pending second-admin approval.** In progress —
  found the existing System User ("Claude-agent", confirmed intentional,
  has Admin access + assigned to the Page, the "E-commetrics - RD Leads"
  app, and all 3 WhatsApp Business Accounts), requested a never-expiring
  token scoped to `whatsapp_business_messaging`,
  `whatsapp_business_management`, `whatsapp_business_manage_events` (Meta
  wouldn't allow narrowing below these 3 — the app had already accumulated
  more permissions across Lead Ads/CAPI/WhatsApp, and Meta bundles a token
  with everything the app has, not per-request). Meta requires a *second*
  Business Manager admin (not the requester) to approve generating a
  never-expiring token — request submitted, waiting on that approval before
  the token is issued. Currently still running on the temporary 24h token
  from API Setup, which expires same-day — this will need re-requesting if
  the approval doesn't land before then. Once approved and generated, drop
  it in `.env` as `WHATSAPP_ACCESS_TOKEN`, verify with `debug_token`
  (`expires_at: 0`), and update this entry.
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

- **Outbound SMS (Twilio)** — waiting on the business owner. Separate
  platform from Meta, needs a brand-new Twilio account (billing/business
  info) created and owned by the business, not something to set up on their
  behalf. In the US, SMS may also require A2P 10DLC carrier registration
  before production sending works (can take days to approve). Once the owner
  hands over `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_FROM_SMS_NUMBER`,
  drop them in `.env` and send a real test message via `/api/messaging-test`
  to confirm before enabling any SMS automation rules.

## Not started

(nothing currently — SMTP, Facebook Lead Ads/CAPI, and WhatsApp connectivity
are done; Twilio is blocked on the owner above; WhatsApp's remaining gaps are
tracked under Open.)
