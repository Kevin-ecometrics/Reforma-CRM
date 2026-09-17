import { getDb, nanoid, nowIso } from "./db";
import type { Activity, ActivityType, Lead, LeadSource, Task } from "./types";
import { fireStageChangeSideEffects } from "./automation";

export async function listLeads(): Promise<Lead[]> {
  const db = await getDb();
  return [...db.data.leads].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function getLead(id: string): Promise<Lead | undefined> {
  const db = await getDb();
  return db.data.leads.find((l) => l.id === id);
}

export async function addActivity(
  leadId: string,
  type: ActivityType,
  content: string
): Promise<Activity> {
  const db = await getDb();
  const activity: Activity = {
    id: nanoid(),
    leadId,
    type,
    content,
    createdAt: nowIso(),
  };
  db.data.activities.push(activity);
  await db.write();
  return activity;
}

export async function listActivities(leadId?: string): Promise<Activity[]> {
  const db = await getDb();
  const activities = leadId ? db.data.activities.filter((a) => a.leadId === leadId) : db.data.activities;
  return [...activities].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function listTasks(leadId?: string): Promise<Task[]> {
  const db = await getDb();
  const tasks = leadId ? db.data.tasks.filter((t) => t.leadId === leadId) : db.data.tasks;
  return [...tasks].sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
}

export async function createTask(leadId: string, description: string, dueAt: string): Promise<Task> {
  const db = await getDb();
  const task: Task = {
    id: nanoid(),
    leadId,
    description,
    dueAt,
    done: false,
    createdAt: nowIso(),
  };
  db.data.tasks.push(task);
  await db.write();
  return task;
}

export async function completeTask(taskId: string): Promise<Task | undefined> {
  const db = await getDb();
  const task = db.data.tasks.find((t) => t.id === taskId);
  if (!task) return undefined;
  task.done = true;
  await db.write();
  return task;
}

export interface CreateLeadInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  source: LeadSource;
  fbLeadgenId?: string | null;
  campaignName?: string | null;
  adName?: string | null;
  formName?: string | null;
  fieldDataRaw?: Record<string, unknown> | null;
  notes?: string;
}

export async function createLead(input: CreateLeadInput): Promise<{ lead: Lead; created: boolean }> {
  const db = await getDb();

  if (input.fbLeadgenId) {
    const existing = db.data.leads.find((l) => l.fbLeadgenId === input.fbLeadgenId);
    if (existing) return { lead: existing, created: false };
  }

  const ts = nowIso();
  const lead: Lead = {
    id: nanoid(),
    fbLeadgenId: input.fbLeadgenId ?? null,
    name: input.name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    source: input.source,
    campaignName: input.campaignName ?? null,
    adName: input.adName ?? null,
    formName: input.formName ?? null,
    fieldDataRaw: input.fieldDataRaw ?? null,
    stage: "new",
    notes: input.notes ?? "",
    createdAt: ts,
    updatedAt: ts,
  };
  db.data.leads.push(lead);
  await db.write();

  await addActivity(lead.id, "system", `Lead created via ${input.source}`);
  await fireStageChangeSideEffects(lead, null, "new");

  return { lead, created: true };
}

export async function changeLeadStage(id: string, newStage: string): Promise<Lead | undefined> {
  const db = await getDb();
  const lead = db.data.leads.find((l) => l.id === id);
  if (!lead) return undefined;

  const stageExists = db.data.stages.some((s) => s.id === newStage);
  if (!stageExists) return lead;

  const oldStage = lead.stage;
  if (oldStage === newStage) return lead;

  lead.stage = newStage;
  lead.updatedAt = nowIso();
  await db.write();

  await addActivity(id, "stage_change", `Stage changed: ${oldStage} → ${newStage}`);
  await fireStageChangeSideEffects(lead, oldStage, newStage);

  return lead;
}

export async function updateLeadNotes(id: string, notes: string): Promise<Lead | undefined> {
  const db = await getDb();
  const lead = db.data.leads.find((l) => l.id === id);
  if (!lead) return undefined;
  lead.notes = notes;
  lead.updatedAt = nowIso();
  await db.write();
  await addActivity(id, "note", notes);
  return lead;
}
