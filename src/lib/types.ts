export type LeadSource = "facebook" | "manual" | "csv";

export interface Lead {
  id: string;
  fbLeadgenId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  source: LeadSource;
  campaignName: string | null;
  adName: string | null;
  formName: string | null;
  fieldDataRaw: Record<string, unknown> | null;
  stage: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Stage {
  id: string;
  name: string;
  order: number;
  color: string;
}

export type ActivityType =
  | "note"
  | "stage_change"
  | "system"
  | "message_sent"
  | "message_failed"
  | "capi_sent"
  | "capi_failed";

export interface Activity {
  id: string;
  leadId: string;
  type: ActivityType;
  content: string;
  createdAt: string;
}

export interface Task {
  id: string;
  leadId: string;
  description: string;
  dueAt: string;
  done: boolean;
  createdAt: string;
}

export type RuleTrigger = "new_lead" | "stage_change" | "stale_contacted";
export type RuleAction = "create_task" | "send_message";
export type MessageChannel = "email" | "sms" | "whatsapp";

export interface AutomationRule {
  id: string;
  key: string;
  label: string;
  trigger: RuleTrigger;
  action: RuleAction;
  enabled: boolean;
  config: {
    stage?: string;
    delayHours?: number;
    staleHours?: number;
    channel?: MessageChannel;
    templateKey?: string;
    taskDescription?: string;
  };
}

export interface SyncState {
  lastSyncAt: string | null;
  lastError: string | null;
  lastCapiAt: string | null;
  lastCapiError: string | null;
  tokenValid: boolean | null;
  tokenCheckedAt: string | null;
  tokenCheckError: string | null;
}

export interface MessageTemplate {
  key: string;
  channel: MessageChannel;
  label: string;
  subject?: string;
  body: string;
  // WhatsApp only: when set, sendMessageToLead() sends this via Meta's
  // Message Templates API (works outside the 24h window) instead of as
  // free-form text. Must match a template that's Approved in WhatsApp ->
  // Message Templates in Meta Business Manager — sending an unapproved or
  // misspelled name fails outright rather than falling back to free text.
  whatsappTemplateName?: string;
  whatsappTemplateLanguage?: string;
}

export interface DbSchema {
  leads: Lead[];
  stages: Stage[];
  activities: Activity[];
  tasks: Task[];
  automationRules: AutomationRule[];
  syncState: SyncState;
  templates: MessageTemplate[];
}
