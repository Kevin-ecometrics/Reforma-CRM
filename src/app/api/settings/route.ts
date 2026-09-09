import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = await getDb();
  const { automationRules, templates, syncState, stages } = db.data;
  const configured = {
    facebookLeadSync: Boolean(process.env.FB_PAGE_ACCESS_TOKEN && process.env.FB_PAGE_ID),
    facebookCapi: Boolean(process.env.FB_CAPI_ACCESS_TOKEN),
    facebookCapiTestMode: Boolean(process.env.FB_CAPI_TEST_EVENT_CODE),
    email: Boolean(
      process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_FROM
    ),
    sms: Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_FROM_SMS_NUMBER
    ),
    whatsapp: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
  };

  return NextResponse.json({ automationRules, templates, syncState, stages, configured });
}
