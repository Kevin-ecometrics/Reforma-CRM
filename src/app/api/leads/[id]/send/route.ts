import { NextResponse } from "next/server";
import { getLead } from "@/lib/leads";
import { sendMessageToLead } from "@/lib/messaging";
import type { MessageChannel } from "@/lib/types";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const channel = body.channel as MessageChannel;
  const templateKey = body.templateKey as string | undefined;

  if (!channel || !templateKey) {
    return NextResponse.json({ error: "channel and templateKey are required" }, { status: 400 });
  }

  const lead = await getLead(params.id);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const result = await sendMessageToLead(lead, channel, templateKey);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
