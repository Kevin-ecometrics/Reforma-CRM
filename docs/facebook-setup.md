# Facebook setup — step by step (no coding required)

You need three separate things configured. They use different tokens.

1. **Lead Ads sync** — lets the CRM pull in new leads from your running ad automatically.
2. **Conversions API (CAPI)** — lets the CRM tell Facebook when a lead becomes a patient, so ad delivery optimizes toward real outcomes, not just form fills.
3. **WhatsApp Cloud API** — lets the CRM send WhatsApp messages from your business's own WhatsApp number (not through Twilio).

## 1. Create a Meta App (needed for both)

1. Go to [developers.facebook.com/apps](https://developers.facebook.com/apps) and click **Create App**.
2. Choose **Business** as the app type.
3. Name it something like "Reforma Dental CRM".
4. Under **Add products**, add **Facebook Login for Business** (or skip if you'll generate tokens from Business Manager directly — see below, usually simpler).

## 2. Connect the App to your Business Manager

1. In [Business Settings](https://business.facebook.com/settings), go to **Accounts → Pages** and confirm the Reforma Dental Page is there and you're an admin.
2. Go to **Accounts → Apps**, add the app you just created, and connect it to the Page.

## 3. Get a Page Access Token (for Lead Ads sync)

Easiest path — Graph API Explorer:

1. Go to [developers.facebook.com/tools/explorer](https://developers.facebook.com/tools/explorer).
2. Select your app in the top-right dropdown, and set the **"User or Page"** selector to **User** (not Page — a Page token generated directly from that selector doesn't support the `/accounts` edge used in step 6 below).
3. Grant permissions. **All of these are required** — the sync fails at a different step for each one that's missing:

   | Permission | Why it's required |
   |---|---|
   | `pages_show_list` | Lets `/me/accounts` list the pages you manage, needed to find the Page Access Token itself. |
   | `pages_read_engagement` | Base read access to the Page. |
   | `pages_manage_ads` | Required to call `GET /{page-id}/leadgen_forms` — without it, that call fails with `(#200) Requires pages_manage_ads permission to manage the object`. |
   | `leads_retrieval` | Required to call `GET /{form-id}/leads` (the actual lead data). Without it: `(#200) Requires leads_retrieval permission to manage the object`. **Note:** this permission must be enabled for the app first — see the callout below. |

   Request all of them in the same OAuth grant. Re-authorizing with a partial set (e.g. adding `pages_manage_ads` in one pass, `leads_retrieval` in another) can silently drop one of the previously-granted scopes.

   > **`leads_retrieval` gotcha:** unlike the other permissions above, Meta won't grant this one through the Explorer's consent screen unless the app already has it enabled in its own dashboard. If the checkbox doesn't stick (the resulting token is missing it — verify with the `debug_token` check below), go to `https://developers.facebook.com/apps/{app-id}/app-review/permissions/`, find `leads_retrieval`, and request/enable it there (Standard Access is enough for your own Page/Business — no full App Review needed). Then redo the token generation.

4. Click **Generate Access Token**. It comes back as **Type: User** with those scopes — that's expected; it's used to derive the Page Access Token in the next step, not used directly.
5. This gives you a **short-lived** token (~1 hour). To make it long-lived (60 days, renewable), use the [Access Token Debugger](https://developers.facebook.com/tools/debug/accesstoken/) → "Extend Access Token", or exchange it via the Graph API:
   ```
   GET https://graph.facebook.com/v26.0/oauth/access_token
     ?grant_type=fb_exchange_token
     &client_id={app-id}
     &client_secret={app-secret}
     &fb_exchange_token={short-lived-token}
   ```
6. Back in Graph API Explorer, paste the extended token into the Access Token field, then query `me/accounts?limit=100`. Find the block for your Page and take two fields from it:
   - `access_token` (not the one at the top of the screen) → `FB_PAGE_ACCESS_TOKEN`
   - `id` (same block, next to `name`) → `FB_PAGE_ID`

   Both go in `.env.local`. Note: the `id` inside `category_list` is the Page's business *category* ID, not the Page ID — don't use that one.

### Verify the token has every permission before moving on

```
GET https://graph.facebook.com/v26.0/debug_token?input_token={page-access-token}&access_token={page-access-token}
```

Check the `scopes` array in the response. A working token for this integration looks like:

```json
"scopes": [
  "pages_show_list",
  "business_management",
  "leads_retrieval",
  "pages_read_engagement",
  "pages_manage_metadata",
  "pages_manage_ads",
  "public_profile"
]
```

`business_management`, `pages_manage_metadata`, and `public_profile` show up automatically (Meta adds them alongside the ones you requested) — you don't request them explicitly, but their absence isn't a problem either way. The four that actually matter and must be present are `pages_show_list`, `pages_read_engagement`, `pages_manage_ads`, and `leads_retrieval`. If any of the last two is missing, redo step 3.

Also useful: `expires_at: 0` means the Page token doesn't expire by time (normal for a Page token derived from a long-lived User token). The CRM checks this token's validity automatically once a day and on a manual "Check token" click in Settings — see `checkFacebookTokenValidity()` in `src/lib/facebookSync.ts`.

## 4. Get a CAPI access token (for the outbound integration)

1. In [Events Manager](https://business.facebook.com/events_manager2), open the dataset (`606403608113212` — already set in the CRM code).
2. Go to **Settings → Conversions API → Generate access token**.
3. Copy it into `.env.local` as `FB_CAPI_ACCESS_TOKEN`.

## 5. Test the CAPI integration before trusting it

1. In Events Manager, open the dataset → **Test events** tab, copy the **Test event code** shown there.
2. Put it in `.env.local` as `FB_CAPI_TEST_EVENT_CODE` and restart the dev server.
3. In the CRM, go to **Settings → Send a test Facebook CAPI event**, pick a lead, and send.
4. Within ~30 seconds it should appear in Events Manager's Test Events tab. Check that `em`/`ph` show as matched (hashed) fields.
5. Move a real lead through a pipeline stage and confirm the event shows up too.
6. **Remove `FB_CAPI_TEST_EVENT_CODE` from `.env.local`** once you're confident — while it's set, events are marked as test traffic and won't affect ad optimization.

## 6. Set up WhatsApp Cloud API (for outbound WhatsApp)

This uses your Meta App directly — no Twilio involved.

1. In your Meta App (same one from step 1), add the **WhatsApp** product.
2. Under **WhatsApp → API Setup**, you'll get a test number automatically (fine for development) or you can add/verify your own business number.
3. Note the **Phone number ID** shown on that page — put it in `.env.local` as `WHATSAPP_PHONE_NUMBER_ID`.
4. Generate an access token: either the temporary token shown on the API Setup page (24h, fine for testing), or a permanent one via **Business Settings → System Users → generate token** with the `whatsapp_business_messaging` permission (for production). Put it in `.env.local` as `WHATSAPP_ACCESS_TOKEN`.
5. In **API Setup**, add the phone numbers you'll be messaging to the allowed test recipient list (required while using a test number — not needed once you're on a verified production number).
6. Test it: Settings → **Send a test message** → channel WhatsApp → your own number.

**Important caveat**: WhatsApp only allows free-form text messages within a 24-hour window after the customer last messaged you. Automated reminders sent *outside* that window (e.g. an appointment reminder a lead never replied to) require a pre-approved **Message Template**, created under WhatsApp → Message Templates and submitted for Meta review. The CRM currently sends plain text — if reminder messages start failing with a template-required error, that's why; the fix is creating and referencing an approved template instead of free text for that specific automation.

## Notes

- Lead Ads sync is polling-based (every 5 minutes), not a webhook — no public URL needed to run this locally.
- If any token expires, the CRM's Settings page will show the integration as "not configured" / log the error rather than crash.
