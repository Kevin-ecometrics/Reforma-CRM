# Backlog / integration progress

Running log of what's been wired up, what's confirmed working, and what's still
open. Newest entries at the top of each section.

**Start with [Migration](#migration--crm-on-expressmysql--webapp-inside-the-dashboard-2026-09-28)**
— it covers the rewrite of the CRM onto Reforma's Express + MySQL and the new
webapp inside the dashboard, which is where all the current work is. The
sections below it are the running log of the messaging integrations (SMTP,
Facebook Lead Ads/CAPI, WhatsApp, Twilio), most of which predate the migration
and were carried over to the new backend.

## Migration — CRM on Express/MySQL + webapp inside the dashboard (2026-09-28)

This Next.js app is now a **read-only reference**. The CRM that will run in
production is two pieces:

- **Backend**: CommonJS module mounted on Reforma Dental's existing Express at
  `/crm/*`, shipped as **one file**: `ReformaDental2025/server/out/server.js`. It is
  generated (`cd server && bun run build`) from `server.src.js` (the original
  server + the `/crm` mount) and `server/crm/`; edit those, never `out/server.js`.
  Shares the MySQL pool and the nodemailer transport the calendar already uses.
  The three setup scripts are flags of the same file: `--crm-seed`,
  `--crm-create-user`, `--crm-migrate`.
- **Frontend**: static webapp inside `e-commetrics-dashboard` at
  `/dashboard/webapp/crm` (`output: "export"`, so it ships inside the dashboard's
  `out/`).

Plan of record: [migration.md](../migration.md). Several of its decisions were
changed while implementing; the divergences are listed under **Open** so the doc
and reality don't quietly drift apart.

### Status 2026-09-29 — deploy in progress, PAUSED (pending)

Work was paused mid-deploy to switch projects. **Nothing is half-applied in the
database**: no `crm_*` table exists yet. Everything under "Pending" is still to do.

**Done since 2026-09-28**

- **Backend is now ONE file.** Source = `ReformaDental2025/server/server.src.js`
  (the original server + `/crm` mount + CLI flags) plus `server/crm/`. Build =
  `cd server && bun run build` → `server/out/server.js` (gitignored, generated;
  never edit it). That single file is what gets uploaded to cPanel, **renamed
  `server.js`**. `server/crm/` is NOT uploaded. The only differences from the
  original production server are: the CLI-flag check at the top, `PATCH` added to
  the CORS methods (the webapp uses PATCH; without it the browser blocks every
  stage move, task completion, rule toggle and template save), the `/health`
  route, the `/crm` mount, and `app.listen` wrapped in `if (!crmCliMode)`.
- **Setup scripts are flags of the same file**: `--crm-seed`,
  `--crm-create-user`, `--crm-migrate <db.json>`. cPanel here has no terminal, so
  phpMyAdmin equivalents exist (see Pending 1).
- **`GET /health`** (public, only booleans and counts): 200 `ok`, or 503 with a
  `failures` list (DB, calendar tables, the 8 `crm_*` tables, seed, at least one
  user, `CRM_JWT_SECRET`). `warnings` (Facebook/email unconfigured, CAPI test
  mode on) don't fail it. Code in `server/crm/health.js`.
- **`server/schema.sql` now holds the 8 `crm_*` tables** (idempotent: `IF NOT
  EXISTS` + `INSERT IGNORE`), and `crm/db/schema.sql` was removed so two copies
  can't drift. In phpMyAdmin run only from the CRM header down; the
  `CREATE DATABASE` / `USE` at the top of the file are not allowed there.
- **`.env.example` rewritten with placeholders.** Optional vars are commented out
  on purpose: any variable with a value counts as "configured", so an active
  placeholder would fake an integration, and `CRM_FB_CAPI_TEST_EVENT_CODE` with
  any value puts Meta in test mode (events not counted).
- **Env decisions**: `CRM_SMTP_FROM` and `CRM_SMTP_*` are NOT used. Email goes
  through the calendar's transport (`EMAIL_HOST/USER/PASS`) and sends from
  `EMAIL_USER`. Only `CRM_JWT_SECRET` (32+ chars, required) and the `CRM_FB_*` /
  `CRM_WHATSAPP_*` credentials are new. `EMAIL_PORT`, `EMAIL_SECURE` and `PORT`
  exist in cPanel but the server ignores them (465, secure and 3001 are fixed).
- **Uploaded to production**: the bundle as `server.js`, env vars and
  `package.json` (adds `jsonwebtoken`, `node-cron`). **cPanel Node must be 20+**
  (now 22). On 14.21.3 the app crashed at boot: the Bun bundle contains `??=`
  (Node 15+), there is no global `fetch` (Node 18+; used by the Facebook sync,
  CAPI and WhatsApp) and `node-cron` 4.x needs Node 20+. Node 18 would boot, but
  `node-cron` 4.6 doesn't officially support it.
- **Production `/health` right now**: database OK (`clinicareforma_contacts`,
  MariaDB 11.4.13), calendar tables OK, `CRM_JWT_SECRET` OK, cron running,
  Facebook / CAPI / WhatsApp / email flagged as configured, CAPI test mode off.
  The only failure: the 8 `crm_*` tables are missing.
- **Frontend re-verified** (dashboard): 20/20 backend routes matched by 20 webapp
  calls, request/response shapes match the handlers, `tsc --noEmit` clean,
  `next build` clean with `/dashboard/webapp/crm` static. **Not uploaded yet.**
- **phpMyAdmin helpers written** (in `ReformaDental2025/server/`, not uploaded):
  `crm-seed.sql` (6 stages, 5 rules, 6 templates; idempotent) and
  `crm-user-sql.js` (`node crm-user-sql.js <email> "<name>" "<12+ char password>"`
  prints the `INSERT INTO crm_users` with a scrypt hash in the exact login
  format; the password never leaves the machine).

**Pending, in this order**

1. **phpMyAdmin, base `clinicareforma_contacts`** (SQL tab): (a) the CRM section
   of `server/schema.sql`; (b) `server/crm-seed.sql`; (c) the `INSERT` printed by
   `crm-user-sql.js`. Then `/health` must return 200 `ok` with `seeded.ok: true`
   and `users: 1`. (The CRM login email is only a username, and the CRM login is
   independent of the dashboard login.)
2. **Ordering risk with the Facebook sync.** The CRM cron starts with the server
   and syncs every 5 min. The moment the tables exist it will import every lead
   from the Facebook forms with **new ids**, and `crm_leads.fb_leadgen_id` is
   UNIQUE. `migrate-db-json` only dedupes by `id`, so migrating the old `db.json`
   *after* that sync fails on the first lead that already arrived from Facebook,
   leaving a partial migration. It also means the automation rules fire on every
   imported lead (the "Call within 1 hour" and follow-up task rules are enabled by
   default), while the old Next.js CRM keeps syncing in parallel. Migrate
   *before* the first tick (same sitting as the seed), or change the migration to
   skip leads whose `fb_leadgen_id` already exists. This was found by reading the
   code, not by running it.
3. **Migrate the old data.** First find the live `db.json`. Still unresolved:
   where the old CRM is hosted isn't recorded anywhere, and the local copy is from
   2026-09-17 (18 leads, about 11 days stale). With no terminal on cPanel,
   `--crm-migrate` needs a `package.json` script plus "Run JS script", or a
   generated SQL file instead.
4. **Calendar smoke test** after the Node 14 → 22 change: `GET /api/appointments`
   and `GET /fechas-bloqueadas` must answer as before. `mysql` and `nodemailer`
   were not re-tested on the new Node.
5. **Upload the dashboard** `out/` to `public_html`, only after `/health` is 200.
   Then grant `"CRM"` (see 6) and test the CRM login end to end.
6. **Production dashboard backend** (`ReformaDental2025/server/dashboard.js`, the
   file that runs at `e-commetrics.com/api/*`): `GET /api/users/:id/apps` returns
   a hardcoded list (`QR, Vcard, blogs, calendar, Reforma, Monge, PromoPalmas,
   CalendarioPalmas`) with **no `CRM` and no `ScanEat`**. The sidebar filters by
   that list, so only `role: "admin"` will ever see the CRM until `"CRM"` is added
   to `allComponents` there. One line, in production.
7. **Security findings in `dashboard.js`** (read from the code, NOT tested against
   the server; confirm before acting): `JWT_SECRET = "mi-clave-super-secreta"` is
   hardcoded (anyone who knows it can forge an admin token); `GET /api/users` does
   `SELECT * FROM users` with no auth (exposes password hashes); only
   `/api/profile` checks the token, so `POST /api/users/:id/apps`,
   `PUT/DELETE /api/users/:id` and `/api/register` need no session; and it calls
   `process.exit(1)` on a DB failure at boot. Proposed fix order: secret into an
   env var, then auth middleware on the list/write routes, then `"CRM"` in the
   component list.
8. **Decision pending: one login or two?** Today they are separate. The dashboard
   session lives on `e-commetrics.com` in an `httpOnly` cookie, so the frontend
   can't hand it to `reformadental.com`, and the CRM has its own `crm_users`.
   Unifying needs a new endpoint in the dashboard backend that issues a
   short-lived CRM token, plus a secret shared between both servers, which must
   not be the hardcoded one above. Recommendation: keep them separate for now.
9. **Git: nothing is committed.** `ReformaDental2025` (`feature/crm-module`):
   modified `crm/*`, `schema.sql`, `package.json`, `.env.example`, `.gitignore`;
   renamed `server.js` → `server.src.js`; new `crm/cli.js`, `crm/health.js`,
   `crm-seed.sql`, `crm-user-sql.js`; deleted `crm/db/schema.sql`.
   **Do NOT `git add .`**: `server/dashboard.js` is untracked and not ignored, and
   contains the hardcoded secret; `server/backup.js` is also untracked and wasn't
   created by this work (check what it is). Dashboard (`main`):
   `access-app/page.tsx` and `app-sidebar.tsx` modified, `webapp/crm/` untracked.
10. **Last, not first**: retire the old Next.js CRM once the new one is verified.
11. Reconcile `migration.md` (still lists the old decisions) and the stale
    mentions of `crm/seed.js` and `scripts/migrate-db-json.js` in this file.

### Where to pick up (state as of 2026-09-28, superseded by the block above)

Nothing is left to write. The backend module (`server/crm/`, 32 files) and the
webapp (`webapp/crm/`, 19 files) are complete, typecheck clean, and were checked
against each other route by route. What remains is deploying to production, in
the order below. **Backend first, always**: if the dashboard is uploaded before
`/crm` exists, the webapp calls routes that don't answer.

**Exact state as of 2026-09-28**

- `ReformaDental2025`: branch `feature/crm-module`, HEAD `b0bb0af`. Uncommitted:
  `server/crm/auth.js` and `server/crm/routes/auth.js` — the change that returns
  the token in the login body for the Bearer flow. Nothing pushed, merged or
  uploaded.
- `e-commetrics-dashboard`: branch `main`, HEAD `2303287`. Uncommitted:
  `src/app/dashboard/access-app/page.tsx` and `src/components/app-sidebar.tsx`
  modified, `src/app/dashboard/webapp/crm/` (19 files) untracked. The build is
  clean but nothing is committed either.

**Read this before migrating the data** — the one step that can lose data quietly

- The local copy of the old CRM's `src/data/db.json` was last written
  **2026-09-17** (18 leads, 52 activities, 21 tasks). The old app's cron has run
  every 5 minutes since, so the copy *on the server* holds roughly 11 more days
  of leads, activities and tasks that the local file doesn't have.
- Fetch the live `db.json` from wherever the old CRM is hosted **before** running
  `scripts/migrate-db-json.js`. The script is idempotent by `id`, so a later
  re-run with a fresher file only inserts what's missing — a premature run is
  recoverable, migrating from a stale file and not noticing is not.
- **Unresolved: where is the old CRM hosted?** It isn't recorded anywhere in the
  repo (no cPanel path, no process name, no URL), and it's needed to fetch that
  file. Resolve this first thing.

**Deployment sequence**

*A. cPanel / database*

1. Back up the production `server.js`. On the server it is still a single
   unversioned file.
2. Run `SELECT VERSION();` in cPanel's SQL editor. The DDL needs MySQL 5.7+ /
   MariaDB 10.2+ because of the `JSON` columns.
3. Apply `server/schema.sql` (only the CRM section, from its header down) from the same editor: 8 `crm_*` tables, idempotent, with
   no `CREATE DATABASE` / `USE` on purpose (cPanel disallows them).
4. Upload the single new `out/server.js` (bundle, uploaded as `server.js`) to the host, and `npm install`
   there so `jsonwebtoken` and `node-cron` are present. `server/crm/` is NOT
   uploaded.
5. Add the env vars to the backend's `.env` (mapping below).
6. `node server.js --crm-seed` → stages, automation rules, templates.
7. `node server.js --crm-migrate <live db.json path>`.
8. `node server.js --crm-create-user <email> [name] [password]` → the first
   admin account.
9. Restart the Node app in cPanel. Passenger doesn't hot reload, and a new
   `require` needs it.

*B. Dashboard*

10. Build locally and upload the whole `out/` to `public_html`.
11. Grant the `"CRM"` component to whoever needs it in `/dashboard/access-app`.
    Admin role bypasses the check, so anyone else stays locked out until this is
    done.

*C. Verification*

11b. **First, `curl -i https://reformadental.com/health`** (public, no secrets in the
    output): `200 {"status":"ok"}` means DB reachable, calendar + 8 `crm_*` tables
    present, seed applied, at least one CRM user and `CRM_JWT_SECRET` set. `503`
    lists the exact cause under `failures`. `warnings` (Facebook/email not
    configured, CAPI test mode on) do not fail it.
12. Calendar smoke test **first**: `GET /api/appointments` and
    `GET /fechas-bloqueadas` must answer exactly as before. This is the test that
    runs on every deploy, because the backend is shared with the calendar.
13. `GET /crm/me` answering `200` with `{"user": null}` proves `/crm` is mounted
    — it's the only unauthenticated read, so it's the probe that doesn't need
    credentials.
14. Log in → pipeline → create and edit a lead → send a template → "Sync now".
15. Only then retire the old Next.js CRM. It's the thing currently serving the
    leads, so it's the last step, not the first.

**Env vars: the mapping is just a prefix**

- All 14 vars the old app already has have a `CRM_` counterpart, name for name:
  `FB_*` → `CRM_FB_*`, `SMTP_*` → `CRM_SMTP_*`, `TWILIO_*` → `CRM_TWILIO_*`,
  `WHATSAPP_*` → `CRM_WHATSAPP_*`. Nothing to rename by hand, nothing new to
  look up.
- One genuinely new one: `CRM_JWT_SECRET`, minimum 32 characters, no default.
  Without it `jwtSecret()` throws and the CRM doesn't boot. Generate a random
  48-byte hex string rather than inventing one.
- `MYSQL_*` is shared with the calendar and needs no change.
- The module ships **no `.env.example`**, which is exactly why this step is easy
  to get wrong: the full list is scattered across the code.

**Known non-blocking gotchas**

- `twilio` is not in `server/package.json` on purpose, so SMS won't work until
  the package and the credentials are both in place. `sms.js` returns an explicit
  error instead of throwing.
- `npm run lint` fails repo-wide in the dashboard (ESLint 9 + `FlatCompat` +
  `next/core-web-vitals`). It fails on untouched files too and doesn't affect
  the build.
- `migration.md` still describes decisions that changed during implementation
  (listed under *Open — migration* below).
- The WhatsApp webhook and Embedded Signup routes were never written — the one
  group of routes from the plan that doesn't exist. Inbound replies stay out of
  scope.

### Done — backend (`server/crm/`, 32 files, ~3.3k lines)

- **Rescue and version control first** (the blocking prerequisite): Reforma's
  production backend was a single unversioned file, so it was pulled down,
  `git init`-ed and put on `feature/crm-module` before a line was written.
  Commits `8c38e91` (version the Express backend) and `b0bb0af` (the CRM
  migration, 36 files / +3806 lines).
- **Module mounted on `/crm`**, no build step, CommonJS, no `process.exit` on a
  failed boot (Passenger would restart-loop and take the calendar's
  appointments down with it).
- **8 tables `crm_*`** in `server/schema.sql`: `crm_stages`, `crm_leads`,
  `crm_activities`, `crm_tasks`, `crm_automation_rules`, `crm_templates`,
  `crm_sync_state`, `crm_users`. The DDL is applied by hand once; there is
  **no DDL at runtime**, and nothing may `DROP`/`TRUNCATE` anything — the CRM
  shares the calendar's database.
- **Repos per table** with `snake_case → camelCase` mapping and transactions, so
  a stage change and its activity log row are atomic.
- **All 15 existing endpoints translated**, with the automation engine, Facebook
  sync, CAPI and message sending moved over as-is, plus `/crm/login`,
  `/crm/logout` and `/crm/me`.
- **Auth is new and was the P0** — the old CRM had *none* (`grep auth|jwt|bcrypt`
  → 0 hits; its own README said "meant to run on localhost only"). `scrypt`
  password hashing, JWT (7-day TTL) in an `httpOnly` `SameSite=None; Secure`
  cookie, login rate limiting, `requireAuth` applied per router so a new file in
  `routes/` can't be added unprotected by accident, and a manual `Origin` check
  on every write (mandatory because the cookie is cross-site, which makes
  SameSite CSRF protection useless).
- **Login returns the token in the body** (`{ user, token }`) so the frontend can
  send `Authorization: Bearer` instead of relying on a third-party cookie —
  Safari blocks those. The cookie is kept as the fallback. *(Uncommitted:*
  `server/crm/auth.js` + `server/crm/routes/auth.js`.)*
- **Idempotent seed** (`seed.js`) plus two CLI scripts: `migrate-db-json.js`
  (moves the existing `db.json` data into MySQL) and `create-crm-user.js`.
- **Own cron**, started from `mount()`: Facebook sync every 5 min, Page token
  check daily, each tick wrapped so a Meta outage can't kill the process. Sync
  and automation run in the same tick, like before.
- **Verified 29/29** by booting the real `server.js` against a deliberately
  downed database: all 15 routes return 401 without a session, a fake token or
  cookie doesn't get through, the calendar keeps answering and the cron starts.
  A second 13/13 pass covered the Bearer change (valid/invalid login, 401
  without token, 403 on a disallowed origin).

### Done — webapp (`e-commetrics-dashboard/src/app/dashboard/webapp/crm/`, 19 files, ~2.9k lines)

- **Four screens, rebuilt from the old components keeping the current look**:
  pipeline, lead detail, dashboard, settings. The pipeline's kanban drag & drop
  is still native HTML5 — six columns and a few dozen cards don't justify a dnd
  library.
- **Own login screen.** The old CRM had none, so all 15 of its routes were
  public to anyone who knew the URL. Token in `sessionStorage` + Bearer, with
  a global 401 handler that drops the user back to the login form.
- **Type contracts mirrored from `server/crm/types.js`**, and every one of them
  checked against the real Express routes — including the three path shapes
  where the plan was wrong (`/crm/settings/rules/:key`,
  `/crm/settings/templates`, `/crm/import-csv`). Had those been coded from the
  plan, every rules toggle, template save and CSV import would have 404'd.
- **Pipeline**: search, manual lead creation, CSV export (fetched as text and
  saved as a blob — an `<a href>` can't carry the Bearer header), tasks sidebar
  filtered to what's due today/tomorrow with an explicit count of what it hides.
- **Lead detail**: stage selector, template send, Facebook form answers, tasks,
  notes, activity log. 502 is shown as "the provider rejected it, this is
  temporary" rather than as a broken app.
- **Dashboard**: 8 KPI tiles + per-stage bars (plain divs, no chart library —
  the dashboard has none and six bars don't need one).
- **Settings**: integration status chips, last sync / last CAPI / last token
  check, "Sync now", "Check token", rule on/off switches, template editor,
  messaging test, CAPI test and CSV import.
- **Navigation by query param** (`?view=pipeline|lead|dashboard|settings&id=…`)
  because a static export can't prerender `/leads/[id]`, plus a `<Suspense>`
  boundary around `useSearchParams`. This buys deep links and the browser back
  button, which the old state-in-memory UI didn't have.
- **Registered in the dashboard**: sidebar entry with `component: "CRM"` and the
  component added to `AVAILABLE_COMPONENTS` in `access-app` so it can be granted
  per user.
- **No new dependencies**: no TanStack Query (a `revision` counter in context
  replaces the four hand-rewritten `refreshKey` invalidations the old app had),
  no chart lib, no shadcn globals — the shared UI pieces live in the webapp's own
  `components/ui.tsx`, with only Radix `Select` reused from the dashboard.
- **Verified**: `tsc --noEmit` clean, `next build` clean with
  `/dashboard/webapp/crm` prerendered as static, every endpoint cross-checked
  against the backend routes, and every `ec-*` class / `--ec-*` CSS variable
  used confirmed to exist in `globals.css`.

### Open — migration

- **Backend deploy**: nothing has been pushed, merged or uploaded. The ordered
  sequence in migration.md §7 stands — apply `schema.sql`, run `seed.js`, add
  the `CRM_*` env vars, restart the Node app, then the dashboard build. Deploy
  backend first; the reverse order has a window where the webapp calls routes
  that don't exist yet.
- **MySQL version unconfirmed**: `SELECT VERSION();` hasn't been run on cPanel
  yet, and `schema.sql` needs MySQL 5.7+ / MariaDB 10.2+ because of the `JSON`
  columns.
- **`.env` → `CRM_*`**: the Facebook/SMTP/WhatsApp/Twilio credentials currently
  live in the old app's `.env` and have to be copied into the backend's `.env`
  with the `CRM_` prefix, plus `CRM_JWT_SECRET` generated fresh. `CRM_JWT_SECRET`
  in particular has no default: without it the CRM doesn't boot.
- **Live verification (Fase 3)** is still pending on all of it: login → pipeline
  → CRUD → template send → manual sync, plus the calendar smoke test
  (`GET /api/appointments`, `GET /fechas-bloqueadas` unchanged).
- **The old Next.js CRM stays public until the new one is live.** It's the only
  thing currently serving the leads, so retiring it is the last step, not the
  first.
- **Deviations from `migration.md` to reconcile in that doc** (implementation
  won, doc didn't follow): webapp path `reforma-crm` → `crm`; sidebar component
  `ReformaCRM` → `CRM`; `CRM_API_URL` env var → hardcoded
  `https://reformadental.com/crm` constant (same reason the calendar does it:
  static export, no proxy); **separate database with its own grants → the
  calendar's database, isolated by the `crm_` table prefix**; bcrypt → scrypt;
  and the real route shapes are `/crm/settings`, `/crm/settings/rules/:key`,
  `/crm/settings/templates` and `/crm/import-csv` (the plan says `/crm/templates`,
  `/crm/rules/:id`, `/leads/import`).
- **Contract change the UI depends on**: automation rules are keyed by `key`
  (stable, so the seed is idempotent), not by the `nanoid` lowdb generated. The
  `PATCH` path takes the key.
- **`npm run lint` is broken repo-wide** in the dashboard, not by this work:
  `eslint.config.mjs` uses `FlatCompat` with `next/core-web-vitals` and ESLint
  9.32 dies with `Converting circular structure to JSON` on any file, including
  untouched ones.
- **Edit lead contact info** (below in the feature backlog) now needs a backend
  change first: `PATCH /crm/leads/:id` only accepts `stage` and `notes`, and
  ignores anything else while still answering 200.
- **Nothing is committed or pushed on either side yet**: the dashboard is on
  `main` with `access-app/page.tsx` + `app-sidebar.tsx` modified and the new
  `crm/` folder untracked; the backend is on `feature/crm-module` with
  `server/crm/auth.js` + `routes/auth.js` (the Bearer change) modified on top of
  `b0bb0af`.

### Blocked — migration

- **`SELECT VERSION();` on cPanel** — can't be answered from here, and the DDL
  can't be applied until it is.
- **Twilio**: the `twilio` package isn't in `server/package.json` yet (deliberate,
  so an unused SDK isn't loaded into the process that also serves the calendar).
  `sms.js` degrades with an explicit "package not installed / vars missing"
  error instead of throwing. Same owner-blocked credentials as the old app's
  *Blocked → Outbound SMS (Twilio)* below.

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

### Done — WhatsApp

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
  - **Carried into the new backend**: the variables are now `CRM_TWILIO_*` and
    the `twilio` package still has to be added to `server/package.json` (see
    *Blocked — migration*). The UI's messaging test exposes SMS deliberately,
    even though the lead modal only offers Email/WhatsApp, because the endpoint
    accepts it and it reports the exact missing piece.

## Not started

- **Inbound WhatsApp / email replies in the CRM** — still not built, in either
  app (see the feature backlog at the bottom). It needs the webhook routes,
  which are the one group of routes from migration.md §3.1 that was never
  written.
- **WhatsApp Embedded Signup routes** (`/crm/whatsapp/onboard/*`,
  `/crm/whatsapp/webhook`) — not built, and the Phone Number ID diagnosis comes
  before them (see *Open* above).

Everything else in flight is under *Migration* at the top of this file.

## CRM feature backlog

Product/UI features for the CRM app itself, separate from the messaging
integrations tracked above.

> The 2026-09-17 entries below were done in the Next.js app. All of them were
> re-implemented in the new webapp (see *Done — webapp* at the top), and the
> "Open" items below are still open — they were not carried over, because the
> migration only rebuilt what already existed.

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
  ad-hoc task ("call tomorrow", etc.). Deliberately left out of the new
  backend too: there is no `POST /crm/tasks` (the old app didn't have one
  either — its API only ever had `GET` and `PATCH`).
- **Edit lead contact info** — name/email/phone can only be set at creation
  (`AddLeadModal`); there's no way to fix a typo or update a lead's phone
  number afterward. This one needs backend work first: `PATCH /crm/leads/:id`
  only applies `stage` and `notes` and returns 200 for anything else, so
  the endpoint has to accept the contact fields before the UI can offer them.
- **Bulk actions on the pipeline** — select multiple lead cards to move
  stage or send the same message/template at once.
- **Click-to-call / click-to-copy** — `tel:`/`mailto:` links and a copy
  button on phone/email in the lead card and detail page. The new lead card
  does show phone and email, just as plain text.
- **Automated duplicate-lead detection** — flag/warn when a new lead's
  email or phone matches an existing lead instead of creating a silent
  duplicate (see the one-off manual cleanup under Done above — this would
  make that a recurring safeguard rather than a one-time fix).

### Open — needs a real API/webhook integration (bigger lift)

- **Inbound WhatsApp/email replies visible in the CRM** — currently the CRM
  only shows what *it* sent; a lead's replies have to be checked in
  WhatsApp/the mailbox directly. Would need a WhatsApp webhook (Meta Cloud
  API) and an inbound-email listener.
