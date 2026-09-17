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

- **WhatsApp permanent access token** — second-admin approval came through;
  never-expiring token from the "Claude-agent" System User generated and
  dropped in `.env` as `WHATSAPP_ACCESS_TOKEN`, replacing the temporary 24h
  token. Verified with `debug_token`: `expires_at: 0`, `is_valid: true`,
  all 3 required scopes present (`whatsapp_business_messaging`,
  `whatsapp_business_management`, `whatsapp_business_manage_events`).

## Open

- **WhatsApp: no real approved business template yet** — code support is
  done (see above); don't enable the WhatsApp "new lead confirmation"
  automation rule until an actual template is created and Approved in Meta,
  and assigned to that CRM template via Settings.
- **Meta's "Conecta tu CRM" (Qualified Leads) checklist** in Events Manager
  is stuck at "Configuración completada al 20%" — "Enviar un evento de CRM"
  step not yet marked done, even after real CAPI events were sent and
  accepted (`events_received: 1`). Still open as of 2026-09-15 (payload fix
  landed 2026-09-10; 5 days later, checklist unchanged despite events flowing
  correctly). Latest findings:
  - **Likely real cause found**: went through Meta's own CRM integration
    guide (the "Guía de instrucciones" page in Events Manager) line by line
    against `sendCapiEvent()` — payload structure, `action_source`,
    `custom_data`, `lead_id`, hashed `em`/`ph`, dataset ID (confirmed exact
    match: `606403608113212`) all check out against the guide's spec. The
    one thing that doesn't: the guide's own "Próximos pasos" section states
    the integration must be "subiendo datos al menos una vez al día." There
    was a 4-day gap (2026-09-11 to 2026-09-15) with zero CAPI events —
    no new leads/stage changes happened to trigger `sendCapiEvent()` in that
    window. This — not a payload bug — is now the leading theory for why
    the checklist won't advance.
  - Minor discrepancy noted but not chased (low confidence it matters):
    guide's sample payload shows `lead_id` as a bare JSON number
    (`1234567890123456`), our code sends it as a string. Graph API IDs are
    conventionally strings to avoid float-precision loss on 17-digit IDs, so
    likely a non-issue.
  - **Action taken**: sent a fresh test event 2026-09-15 17:52 UTC via
    Settings → "Send a test Facebook CAPI event" (confirmed
    `events_received: 1`). Owner will manually send one test event per day
    from that same button until either real lead traffic resumes daily on
    its own or the checklist updates. **Next check: 2026-09-16**, when
    owner reviews the checklist again.
  - **Update 2026-09-17**: owner sent a manual CAPI test event on 3
    consecutive days (2026-09-15, 09-16, 09-17). Checklist still reads
    "Configuración completada al 20%" today. This weakens the daily-cadence
    theory considerably — three straight days of confirmed delivery
    (`events_received: 1` each time) should have been enough for the "al
    menos una vez al día" requirement to register if that were the real
    blocker. Leaning back toward this being a UI/backend lag on Meta's side
    or a stricter/different requirement than the guide states (e.g. needing
    real, non-test lead-sourced events rather than the manual test button,
    or a longer observation window). Per the plan below, next step is
    escalating to Meta support with the accumulated evidence rather than
    continuing to wait.
  - **If still stuck after that**: two options discussed, neither
    implemented yet — (a) automate a daily "heartbeat" cron job (project
    already runs `node-cron` in `src/lib/scheduler.ts`) that re-sends a CAPI
    event for an existing real lead only if no real `capi_sent` happened in
    the prior 24h, or (b) escalate to Meta support with the accumulated
    evidence (payload fix date, dataset ID match, `events_received`
    confirmations, fbtrace_ids). Owner wants to hold off on both until
    seeing tomorrow's checklist result.
  - Older history below, kept for context:
  - **Payload structure fix**: the CRM integration guide's sample payload
    nests `event_source`/`lead_event_source` inside `custom_data`, but
    `sendCapiEvent()` (`src/lib/facebookCapi.ts`) was sending them as
    top-level fields instead — silently accepted by the API (no error) but
    likely why Meta's checklist wasn't recognizing the events as CRM lead
    events. Fixed: both fields now nest under `custom_data`, matching the
    guide exactly. Verified the new shape directly against the live
    endpoint (`events_received: 1`, no `messages`) before rolling it into
    the app code.
  - **New CAPI access token**: generated a fresh one from the "Conecta tu
    CRM" guide page itself (its own "Generar identificador de acceso"
    button, separate from the general Events Manager Settings flow).
    `debug_token` still only shows `read_ads_dataset_quality` in `scopes`
    (same known-unreliable field, see gotcha above) but a direct test send
    confirmed it works (`events_received: 1`). Saved to `.env` as
    `FB_CAPI_ACCESS_TOKEN`, replacing the previous one. Confirmed this is a
    completely separate app/System User from the WhatsApp and Page Access
    tokens (`888511418541765` "Conversions API Application" vs `1567984181462924`
    "E-commetrics - RD Leads") — regenerating it has no effect on those.
  - Meta's own guide notes correct events "normalmente aparecen en un día de
    plazo" — checklist was checked same-day as the fix/token swap, so it may
    just need another day to reflect. (Superseded — see 2026-09-15 findings
    above: the checklist was still stuck 5 days later, and the likelier
    cause turned out to be the daily-cadence gap, not this.)
  - Separately, clicking "Probar eventos" in that same guide page threw a
    generic "Se ha producido un error..." in the Events Manager UI — not
    reproduced via direct API calls, so likely a UI-side permissions/session
    issue on that account rather than an integration problem. Not chased
    further since the direct API test already confirmed delivery.
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

## CRM feature backlog

Product/UI features for the CRM app itself, separate from the messaging
integrations tracked above.

### Done (2026-09-17)

- **Send message from a lead** — "Send message" button on the lead detail
  page opens a modal to pick Email or WhatsApp and a template, then sends via
  the existing `sendMessageToLead()`. See `src/app/components/SendMessageModal.tsx`
  and `POST /api/leads/[id]/send`.
- **Form answers on lead detail** — Facebook Lead Ads form Q&A (previously
  captured in `fieldDataRaw` but never shown) now renders as a readable
  section on the lead page.
- **Search/filter leads** — search box on the pipeline filters by name,
  email, phone, or campaign.
- **Overdue task highlighting** — overdue tasks show in red with an
  "Overdue" label, both in the sidebar tasks panel and on the lead detail
  page.
- **Dashboard** (`/dashboard`) — total leads, conversion rate (to "Won"),
  open/overdue tasks, messages sent/failed, leads by source, leads-by-stage
  bar chart. Backed by `GET /api/dashboard`.
- **Export leads to CSV** — "Export CSV" button on the pipeline, backed by
  `GET /api/leads/export`.

### Open — no API/webhook needed

- **Manually create a task from a lead** — right now tasks only get created
  by automation rules; there's no button on the lead detail page to add an
  ad-hoc task ("call tomorrow", etc.).
- **Edit lead contact info** — name/email/phone can only be set at creation
  (`AddLeadModal`); there's no way to fix a typo or update a lead's phone
  number afterward.
- **Bulk actions on the pipeline** — select multiple lead cards to move
  stage or send the same message/template at once.
- **Click-to-call / click-to-copy** — `tel:`/`mailto:` links and a copy
  button on phone/email in the lead card and detail page.
- **Automated duplicate-lead detection** — flag/warn when a new lead's
  email or phone matches an existing lead instead of creating a silent
  duplicate (see the one-off manual cleanup under Done above — this would
  make that a recurring safeguard rather than a one-time fix).

### Open — needs a real API/webhook integration (bigger lift)

- **Inbound WhatsApp/email replies visible in the CRM** — currently the CRM
  only shows what *it* sent; a lead's replies have to be checked in
  WhatsApp/the mailbox directly. Would need a WhatsApp webhook (Meta Cloud
  API) and an inbound-email listener.
