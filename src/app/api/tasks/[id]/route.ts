import { NextResponse } from "next/server";
import { completeTask } from "@/lib/leads";

export async function PATCH(_req: Request, { params }: { params: { id: string } }) {
  const task = await completeTask(params.id);
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  return NextResponse.json({ task });
}
