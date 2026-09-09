import { NextResponse } from "next/server";
import { getLead } from "@/lib/leads";
import { sendCapiEvent } from "@/lib/facebookCapi";

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.leadId) {
    return NextResponse.json({ error: "leadId is required" }, { status: 400 });
  }

  const lead = await getLead(body.leadId);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const result = await sendCapiEvent(lead, body.stageName ?? lead.stage);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
