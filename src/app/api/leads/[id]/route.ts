import { NextResponse } from "next/server";
import {
  changeLeadStage,
  getLead,
  listActivities,
  listTasks,
  updateLeadNotes,
} from "@/lib/leads";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const lead = await getLead(params.id);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const [activities, tasks] = await Promise.all([
    listActivities(params.id),
    listTasks(params.id),
  ]);

  return NextResponse.json({ lead, activities, tasks });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  let lead = await getLead(params.id);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  if (typeof body.stage === "string") {
    lead = (await changeLeadStage(params.id, body.stage)) ?? lead;
  }
  if (typeof body.notes === "string") {
    lead = (await updateLeadNotes(params.id, body.notes)) ?? lead;
  }

  return NextResponse.json({ lead });
}
