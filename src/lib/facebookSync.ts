import { getDb, nowIso } from "./db";
import { createLead } from "./leads";

const FB_API_VERSION = "v26.0";
const GRAPH_URL = `https://graph.facebook.com/${FB_API_VERSION}`;

interface LeadgenForm {
  id: string;
  name: string;
}

interface FieldDatum {
  name: string;
  values: string[];
}

interface LeadgenLead {
  id: string;
  created_time: string;
  ad_name?: string;
  campaign_name?: string;
  field_data: FieldDatum[];
}

function fieldValue(fields: FieldDatum[], ...candidateNames: string[]): string | null {
  for (const name of candidateNames) {
    const match = fields.find((f) => f.name.toLowerCase() === name.toLowerCase());
    if (match?.values?.[0]) return match.values[0];
  }
  return null;
}

export interface SyncResult {
  ok: boolean;
  fetched: number;
  created: number;
  error?: string;
}

export async function syncFacebookLeads(): Promise<SyncResult> {
  const accessToken = process.env.FB_PAGE_ACCESS_TOKEN;
  const pageId = process.env.FB_PAGE_ID;
  const db = await getDb();

  if (!accessToken || !pageId) {
    const error = "FB_PAGE_ACCESS_TOKEN / FB_PAGE_ID not set — Facebook sync skipped";
    db.data.syncState.lastError = error;
    await db.write();
    return { ok: false, fetched: 0, created: 0, error };
  }

  try {
    const formsRes = await fetch(
      `${GRAPH_URL}/${pageId}/leadgen_forms?fields=id,name&access_token=${accessToken}`
    );
    const formsJson = await formsRes.json();
    if (!formsRes.ok) {
      throw new Error(`leadgen_forms failed: HTTP ${formsRes.status}: ${JSON.stringify(formsJson)}`);
    }
    const forms: LeadgenForm[] = formsJson.data ?? [];

    let fetched = 0;
    let created = 0;

    for (const form of forms) {
      const leadsRes = await fetch(
        `${GRAPH_URL}/${form.id}/leads?fields=field_data,created_time,ad_name,campaign_name&access_token=${accessToken}`
      );
      const leadsJson = await leadsRes.json();
      if (!leadsRes.ok) {
        throw new Error(
          `leads fetch failed for form ${form.id}: HTTP ${leadsRes.status}: ${JSON.stringify(leadsJson)}`
        );
      }
      const leads: LeadgenLead[] = leadsJson.data ?? [];
      fetched += leads.length;

      for (const raw of leads) {
        const fields = raw.field_data ?? [];
        const joinedName = [fieldValue(fields, "first_name"), fieldValue(fields, "last_name")]
          .filter(Boolean)
          .join(" ");
        const name = fieldValue(fields, "full_name", "name") || joinedName || "Unnamed lead";
        const email = fieldValue(fields, "email");
        const phone = fieldValue(fields, "phone_number", "phone");

        const fieldDataRaw: Record<string, unknown> = {};
        for (const f of fields) fieldDataRaw[f.name] = f.values?.[0] ?? null;

        const { created: wasCreated } = await createLead({
          name,
          email,
          phone,
          source: "facebook",
          fbLeadgenId: raw.id,
          campaignName: raw.campaign_name ?? null,
          adName: raw.ad_name ?? null,
          formName: form.name,
          fieldDataRaw,
        });
        if (wasCreated) created += 1;
      }
    }

    db.data.syncState.lastSyncAt = nowIso();
    db.data.syncState.lastError = null;
    await db.write();

    return { ok: true, fetched, created };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    db.data.syncState.lastError = error;
    await db.write();
    return { ok: false, fetched: 0, created: 0, error };
  }
}

interface DebugTokenData {
  is_valid?: boolean;
  error?: { message?: string };
}

// Checks the stored Page Access Token against Facebook's own /debug_token
// endpoint. Page tokens derived from a long-lived User token normally never
// expire by time, but this catches the other ways they go bad: a revoked
// permission, a changed Facebook password, or the app losing access — so
// Settings can surface it before the next sync silently starts failing.
export async function checkFacebookTokenValidity(): Promise<void> {
  const accessToken = process.env.FB_PAGE_ACCESS_TOKEN;
  const db = await getDb();
  if (!accessToken) return;

  try {
    const res = await fetch(
      `${GRAPH_URL}/debug_token?input_token=${accessToken}&access_token=${accessToken}`
    );
    const json = await res.json();
    if (!res.ok || json.error) {
      throw new Error(json.error?.message ?? `HTTP ${res.status}`);
    }
    const data: DebugTokenData = json.data ?? {};
    db.data.syncState.tokenValid = Boolean(data.is_valid);
    db.data.syncState.tokenCheckedAt = nowIso();
    db.data.syncState.tokenCheckError = data.is_valid
      ? null
      : data.error?.message ?? "Token is no longer valid";
  } catch (err) {
    db.data.syncState.tokenValid = false;
    db.data.syncState.tokenCheckedAt = nowIso();
    db.data.syncState.tokenCheckError = err instanceof Error ? err.message : String(err);
  }
  await db.write();
}
