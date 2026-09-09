import path from "node:path";
import { JSONFilePreset } from "lowdb/node";
import type { Low } from "lowdb";
import { nanoid } from "nanoid";
import type { AutomationRule, DbSchema, MessageTemplate, Stage } from "./types";

const DB_PATH = path.join(process.cwd(), "src", "data", "db.json");

// Colors follow the Reforma Dental brand palette (RD Branding/1. Paleta de
// color) where a stage maps naturally onto it; "Lost" uses a plain red since
// the brand kit has no negative/danger color of its own.
const DEFAULT_STAGES: Stage[] = [
  { id: "new", name: "New", order: 0, color: "#545758" }, // black-brand
  { id: "contacted", name: "Contacted", order: 1, color: "#73CFED" }, // blue-light
  { id: "scheduled", name: "Scheduled", order: 2, color: "#4F646F" }, // blue-dark
  { id: "consultation", name: "Consultation", order: 3, color: "#8AA6AE" }, // blue-dark tint
  { id: "won", name: "Won", order: 4, color: "#AED136" }, // green-primary
  { id: "lost", name: "Lost", order: 5, color: "#ef4444" },
];

const DEFAULT_RULES: AutomationRule[] = [
  {
    id: nanoid(),
    key: "new_lead_call_task",
    label: 'New lead arrives → create "Call within 1 hour" task',
    trigger: "new_lead",
    action: "create_task",
    enabled: true,
    config: { delayHours: 1, taskDescription: "Call within 1 hour" },
  },
  {
    id: nanoid(),
    key: "new_lead_confirmation_message",
    label: "New lead arrives → send confirmation message",
    trigger: "new_lead",
    action: "send_message",
    enabled: false,
    config: { channel: "email", templateKey: "new-lead-confirmation" },
  },
  {
    id: nanoid(),
    key: "stale_contacted_followup_task",
    label: 'Contacted > 48h with no activity → create "Follow up again" task',
    trigger: "stale_contacted",
    action: "create_task",
    enabled: true,
    config: { staleHours: 48, taskDescription: "Follow up again" },
  },
  {
    id: nanoid(),
    key: "scheduled_reminder_task",
    label: "Stage → Scheduled → create appointment reminder task",
    trigger: "stage_change",
    action: "create_task",
    enabled: true,
    config: { stage: "scheduled", taskDescription: "Appointment reminder (1 day before)" },
  },
  {
    id: nanoid(),
    key: "scheduled_reminder_message",
    label: "Stage → Scheduled → send appointment reminder message",
    trigger: "stage_change",
    action: "send_message",
    enabled: false,
    config: { stage: "scheduled", channel: "sms", templateKey: "appointment-reminder" },
  },
];

const DEFAULT_TEMPLATES: MessageTemplate[] = [
  {
    key: "new-lead-confirmation",
    channel: "email",
    label: "New lead confirmation (email)",
    subject: "Gracias por contactar a Reforma Dental",
    body:
      "Hola {{name}},\n\nGracias por tu interes en Reforma Dental. Un miembro de nuestro equipo te contactara en breve para agendar tu cita.\n\nSaludos,\nReforma Dental",
  },
  {
    key: "new-lead-confirmation",
    channel: "sms",
    label: "New lead confirmation (SMS)",
    body: "Hola {{name}}, gracias por contactar a Reforma Dental. Te llamaremos pronto para agendar tu cita.",
  },
  {
    key: "new-lead-confirmation",
    channel: "whatsapp",
    label: "New lead confirmation (WhatsApp)",
    body: "Hola {{name}}! Gracias por contactar a Reforma Dental. Te contactaremos pronto para agendar tu cita.",
  },
  {
    key: "appointment-reminder",
    channel: "sms",
    label: "Appointment reminder (SMS)",
    body: "Hola {{name}}, te recordamos tu cita en Reforma Dental. Si necesitas reagendar, respondenos a este mensaje.",
  },
  {
    key: "appointment-reminder",
    channel: "whatsapp",
    label: "Appointment reminder (WhatsApp)",
    body: "Hola {{name}}! Te recordamos tu proxima cita en Reforma Dental.",
  },
  {
    key: "appointment-reminder",
    channel: "email",
    label: "Appointment reminder (email)",
    subject: "Recordatorio de tu cita — Reforma Dental",
    body: "Hola {{name}},\n\nTe recordamos tu proxima cita en Reforma Dental.\n\nSaludos,\nReforma Dental",
  },
];

const DEFAULT_DATA: DbSchema = {
  leads: [],
  stages: DEFAULT_STAGES,
  activities: [],
  tasks: [],
  automationRules: DEFAULT_RULES,
  syncState: {
    lastSyncAt: null,
    lastError: null,
    lastCapiAt: null,
    lastCapiError: null,
    tokenValid: null,
    tokenCheckedAt: null,
    tokenCheckError: null,
  },
  templates: DEFAULT_TEMPLATES,
};

declare global {
  // eslint-disable-next-line no-var
  var __crmDb: Promise<Low<DbSchema>> | undefined;
}

export function getDb(): Promise<Low<DbSchema>> {
  if (!global.__crmDb) {
    global.__crmDb = JSONFilePreset<DbSchema>(DB_PATH, DEFAULT_DATA).then((db) => {
      let dirty = false;
      for (const key of Object.keys(DEFAULT_DATA) as (keyof DbSchema)[]) {
        if (db.data[key] === undefined) {
          // @ts-expect-error - narrowing per key at runtime
          db.data[key] = DEFAULT_DATA[key];
          dirty = true;
        }
      }
      return dirty ? db.write().then(() => db) : db;
    });
  }
  return global.__crmDb;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export { nanoid };
