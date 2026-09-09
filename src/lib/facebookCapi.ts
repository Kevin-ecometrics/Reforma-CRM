import crypto from "node:crypto";
import type { Lead } from "./types";
import { addActivity } from "./leads";
import { getDb, nowIso } from "./db";

const FB_API_VERSION = "v26.0";
const FB_DATASET_ID = "606403608113212";

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function hashEmail(email: string | null): string[] | undefined {
  if (!email) return undefined;
  return [sha256(email)];
}

function hashPhone(phone: string | null): string[] | undefined {
  if (!phone) return undefined;
  const digitsOnly = phone.replace(/[^\d]/g, "");
  if (!digitsOnly) return undefined;
  return [sha256(digitsOnly)];
}

interface CapiUserData {
  lead_id?: string;
  click_id?: string;
  em?: string[];
  ph?: string[];
  ge?: string[];
  db?: string[];
  ct?: string[];
  st?: string[];
  zp?: string[];
  country?: string[];
}

interface CapiEventPayload {
  event_name: string;
  event_time: number;
  action_source: "system_generated";
  event_source: "crm";
  lead_event_source: string;
  user_data: CapiUserData;
}

function buildUserData(lead: Lead): CapiUserData {
  const raw = (lead.fieldDataRaw ?? {}) as Record<string, unknown>;
  const userData: CapiUserData = {};

  if (lead.fbLeadgenId) userData.lead_id = lead.fbLeadgenId;

  // Meta's Lead Ads API does not return a click id on field_data, so this is
  // only populated when a caller has stashed one on fieldDataRaw (e.g. from a
  // future website-form source). Absent for pure Facebook Lead Ads leads.
  const clickId = raw.click_id ?? raw.fbc;
  if (typeof clickId === "string" && clickId) userData.click_id = clickId;

  const em = hashEmail(lead.email);
  if (em) userData.em = em;

  const ph = hashPhone(lead.phone);
  if (ph) userData.ph = ph;

  for (const [target, field] of [
    ["ge", "gender"],
    ["db", "date_of_birth"],
    ["ct", "city"],
    ["st", "state"],
    ["zp", "zip"],
    ["country", "country"],
  ] as const) {
    const val = raw[field];
    if (typeof val === "string" && val) {
      userData[target] = [sha256(val)];
    }
  }

  return userData;
}

export interface CapiSendResult {
  ok: boolean;
  status?: number;
  body?: unknown;
  error?: string;
  payload: CapiEventPayload;
}

export async function sendCapiEvent(lead: Lead, stageName: string): Promise<CapiSendResult> {
  const accessToken = process.env.FB_CAPI_ACCESS_TOKEN;
  const testEventCode = process.env.FB_CAPI_TEST_EVENT_CODE;

  const payload: CapiEventPayload = {
    event_name: stageName,
    event_time: Math.floor(Date.now() / 1000),
    action_source: "system_generated",
    event_source: "crm",
    lead_event_source: "Reforma Dental CRM",
    user_data: buildUserData(lead),
  };

  const db = await getDb();

  if (!accessToken) {
    db.data.syncState.lastCapiError = "FB_CAPI_ACCESS_TOKEN is not set — CAPI event not sent";
    await db.write();
    await addActivity(
      lead.id,
      "capi_failed",
      `CAPI event "${stageName}" not sent: missing FB_CAPI_ACCESS_TOKEN`
    );
    return { ok: false, error: "missing_access_token", payload };
  }

  const url = new URL(`https://graph.facebook.com/${FB_API_VERSION}/${FB_DATASET_ID}/events`);
  url.searchParams.set("access_token", accessToken);

  const body: Record<string, unknown> = { data: [payload] };
  if (testEventCode) body.test_event_code = testEventCode;

  try {
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => undefined);

    if (res.ok) {
      db.data.syncState.lastCapiAt = nowIso();
      db.data.syncState.lastCapiError = null;
      await db.write();
      await addActivity(
        lead.id,
        "capi_sent",
        `CAPI event "${stageName}" sent${testEventCode ? " (test mode)" : ""}`
      );
      return { ok: true, status: res.status, body: json, payload };
    }

    const errMsg = `HTTP ${res.status}: ${JSON.stringify(json)}`;
    db.data.syncState.lastCapiError = errMsg;
    await db.write();
    await addActivity(lead.id, "capi_failed", `CAPI event "${stageName}" failed: ${errMsg}`);
    return { ok: false, status: res.status, body: json, error: errMsg, payload };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    db.data.syncState.lastCapiError = errMsg;
    await db.write();
    await addActivity(lead.id, "capi_failed", `CAPI event "${stageName}" failed: ${errMsg}`);
    return { ok: false, error: errMsg, payload };
  }
}
