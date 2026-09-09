import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/messaging/email";
import { sendSms } from "@/lib/messaging/sms";
import { sendWhatsapp } from "@/lib/messaging/whatsapp";
import type { MessageChannel } from "@/lib/types";

export async function POST(req: Request) {
  const body = await req.json();
  const channel = body.channel as MessageChannel;
  const to = body.to as string | undefined;

  if (!channel || !to) {
    return NextResponse.json({ error: "channel and to are required" }, { status: 400 });
  }

  const testBody = "This is a test message from the Reforma Dental CRM.";
  let result: { ok: boolean; error?: string };

  if (channel === "email") {
    result = await sendEmail({ to, subject: "Reforma Dental CRM — test message", text: testBody });
  } else if (channel === "sms") {
    result = await sendSms(to, testBody);
  } else if (channel === "whatsapp") {
    result = await sendWhatsapp(to, testBody);
  } else {
    return NextResponse.json({ error: `Unknown channel "${channel}"` }, { status: 400 });
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
