import { NextResponse } from "next/server";
import { createLead, listLeads } from "@/lib/leads";
import type { LeadSource } from "@/lib/types";

export async function GET() {
  const leads = await listLeads();
  return NextResponse.json({ leads });
}

export async function POST(req: Request) {
  const body = await req.json();

  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const { lead } = await createLead({
    name: body.name,
    email: body.email ?? null,
    phone: body.phone ?? null,
    source: (body.source as LeadSource) ?? "manual",
    notes: body.notes ?? "",
  });

  return NextResponse.json({ lead }, { status: 201 });
}
