import { getDb } from "../db";
import { addActivity } from "../leads";
import type { Lead, MessageChannel } from "../types";
import { sendEmail } from "./email";
import { sendSms } from "./sms";
import { sendWhatsapp } from "./whatsapp";

function renderTemplate(body: string, lead: Lead): string {
  return body.replace(/{{\s*name\s*}}/gi, lead.name || "there");
}

export interface SendMessageResult {
  ok: boolean;
  error?: string;
}

export async function sendMessageToLead(
  lead: Lead,
  channel: MessageChannel,
  templateKey: string
): Promise<SendMessageResult> {
  const db = await getDb();
  const template = db.data.templates.find((t) => t.key === templateKey && t.channel === channel);

  if (!template) {
    const error = `No "${templateKey}" template found for channel "${channel}"`;
    await addActivity(lead.id, "message_failed", error);
    return { ok: false, error };
  }

  const body = renderTemplate(template.body, lead);
  let result: { ok: boolean; error?: string };

  if (channel === "email") {
    if (!lead.email) {
      result = { ok: false, error: "Lead has no email address" };
    } else {
      result = await sendEmail({
        to: lead.email,
        subject: renderTemplate(template.subject ?? "Reforma Dental", lead),
        text: body,
      });
    }
  } else if (channel === "sms") {
    result = lead.phone ? await sendSms(lead.phone, body) : { ok: false, error: "Lead has no phone number" };
  } else {
    result = lead.phone
      ? await sendWhatsapp(lead.phone, body)
      : { ok: false, error: "Lead has no phone number" };
  }

  await addActivity(
    lead.id,
    result.ok ? "message_sent" : "message_failed",
    result.ok
      ? `Sent "${templateKey}" via ${channel}`
      : `Failed to send "${templateKey}" via ${channel}: ${result.error}`
  );

  return result;
}
