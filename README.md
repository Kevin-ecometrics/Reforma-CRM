# Reforma Dental — CRM & Automation Center

A local lead pipeline for Reforma Dental: pulls in Facebook Lead Ads leads, tracks them through a pipeline, automates follow-up tasks and messages, and reports pipeline stage changes back to Facebook's Conversions API for ad optimization.

Built on the same stack as [`Dash.e-commetrics`](https://github.com/e-commetrics/Dash.e-commetrics) (Next.js 14 App Router, TypeScript, Tailwind, NextUI) so it can be folded into that dashboard later without a rewrite.

## Running it

```bash
npm install
cp .env.local.example .env.local   # then fill in credentials, see below
npm run dev
```

Open `http://localhost:3000`.

## What's live vs. stubbed out of the box

Everything runs and the UI is fully usable with **zero credentials** — you can add leads manually, move them through the pipeline, create/complete tasks, and take notes. The integrations below only activate once you add the matching credentials to `.env.local`; until then they fail gracefully and show "not configured" in **Settings**.

| Feature | Requires | Setup |
|---|---|---|
| Facebook Lead Ads sync (pulls new leads in every 5 min) | `FB_PAGE_ACCESS_TOKEN`, `FB_PAGE_ID` | [docs/facebook-setup.md](docs/facebook-setup.md) |
| Facebook Conversions API (reports stage changes back to Meta) | `FB_CAPI_ACCESS_TOKEN` | [docs/facebook-setup.md](docs/facebook-setup.md) |
| Outbound email | `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`/`SMTP_FROM` | any SMTP provider (Gmail, SendGrid, etc.) |
| Outbound SMS | `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_FROM_SMS_NUMBER` | Twilio console |
| Outbound WhatsApp (Meta Cloud API, not Twilio) | `WHATSAPP_ACCESS_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID` | [docs/facebook-setup.md](docs/facebook-setup.md) |

Message-sending automation rules ship **disabled** even once credentials are set — review the templates under Settings → Message templates and turn the rule on yourself when you're happy with the copy. Task-creation rules (e.g. "call within 1 hour") are on by default.

## How it's put together

- `src/lib/db.ts` — data layer (lowdb, a JSON file at `src/data/db.json`, gitignored)
- `src/lib/facebookSync.ts` — inbound: polls Graph API for new Lead Ads leads
- `src/lib/facebookCapi.ts` — outbound: sends pipeline stage events to Meta's Conversions API
- `src/lib/messaging/` — email/SMS/WhatsApp adapters
- `src/lib/automation.ts` + `src/lib/scheduler.ts` — rule engine, driven by a `node-cron` job started once via `src/instrumentation.ts`
- `src/app/` — pages (`/` pipeline board, `/leads/[id]` detail, `/settings`) and `api/*` route handlers

## Progress log

See [docs/backlog.md](docs/backlog.md) for what's confirmed working, what's
open, and what hasn't been started yet — mainly the Facebook integrations.

## Known gaps (intentional for this stage)

- No login/auth — single local user, meant to run on localhost only.
- No git history yet — this gets initialized once the first draft is approved as 1.0.1.
- Not yet embedded into `Dash.e-commetrics` — built on the same stack on purpose, but the merge itself is a separate step.
