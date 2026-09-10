import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function PATCH(req: Request) {
  const body = await req.json();
  const { key, channel, subject, text, whatsappTemplateName, whatsappTemplateLanguage } = body;

  if (!key || !channel) {
    return NextResponse.json({ error: "key and channel are required" }, { status: 400 });
  }

  const db = await getDb();
  const template = db.data.templates.find((t) => t.key === key && t.channel === channel);
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  if (typeof text === "string") template.body = text;
  if (typeof subject === "string") template.subject = subject;
  if (typeof whatsappTemplateName === "string") template.whatsappTemplateName = whatsappTemplateName || undefined;
  if (typeof whatsappTemplateLanguage === "string") template.whatsappTemplateLanguage = whatsappTemplateLanguage || undefined;
  await db.write();

  return NextResponse.json({ template });
}
