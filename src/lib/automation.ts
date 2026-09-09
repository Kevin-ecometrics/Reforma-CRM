import { getDb } from "./db";
import { createTask, listLeads, listTasks } from "./leads";
import { sendCapiEvent } from "./facebookCapi";
import { sendMessageToLead } from "./messaging";
import type { AutomationRule, Lead } from "./types";

async function getStageName(stageId: string): Promise<string> {
  const db = await getDb();
  return db.data.stages.find((s) => s.id === stageId)?.name ?? stageId;
}

async function applyRule(rule: AutomationRule, lead: Lead): Promise<void> {
  if (!rule.enabled) return;

  if (rule.action === "create_task") {
    const dueAt = new Date(
      Date.now() + (rule.config.delayHours ?? 0) * 60 * 60 * 1000
    ).toISOString();
    const description = rule.config.taskDescription ?? rule.label;

    // Avoid duplicate open tasks for the same rule on the same lead.
    const existing = await listTasks(lead.id);
    const alreadyOpen = existing.some((t) => !t.done && t.description === description);
    if (alreadyOpen) return;

    await createTask(lead.id, description, dueAt);
  } else if (rule.action === "send_message" && rule.config.channel && rule.config.templateKey) {
    await sendMessageToLead(lead, rule.config.channel, rule.config.templateKey);
  }
}

// Called whenever a lead is created (oldStage === null) or its stage changes.
// Fires the Facebook CAPI event for the new stage and evaluates matching
// automation rules ("new_lead" on creation, "stage_change" on transitions).
export async function fireStageChangeSideEffects(
  lead: Lead,
  oldStage: string | null,
  newStage: string
): Promise<void> {
  const stageName = await getStageName(newStage);
  await sendCapiEvent(lead, stageName);

  const db = await getDb();
  const rules = db.data.automationRules;

  if (oldStage === null) {
    for (const rule of rules.filter((r) => r.trigger === "new_lead")) {
      await applyRule(rule, lead);
    }
    return;
  }

  for (const rule of rules.filter((r) => r.trigger === "stage_change")) {
    if (rule.config.stage && rule.config.stage !== newStage) continue;
    await applyRule(rule, lead);
  }
}

// Called on the scheduler tick to evaluate time-based rules (currently just
// "stale_contacted") that aren't triggered by a specific event.
export async function runAutomationTick(): Promise<void> {
  const db = await getDb();
  const staleRules = db.data.automationRules.filter(
    (r) => r.enabled && r.trigger === "stale_contacted"
  );
  if (staleRules.length === 0) return;

  const leads = await listLeads();
  const contactedLeads = leads.filter((l) => l.stage === "contacted");

  for (const rule of staleRules) {
    const staleMs = (rule.config.staleHours ?? 48) * 60 * 60 * 1000;
    for (const lead of contactedLeads) {
      const lastTouch = new Date(lead.updatedAt).getTime();
      if (Date.now() - lastTouch >= staleMs) {
        await applyRule(rule, lead);
      }
    }
  }
}
