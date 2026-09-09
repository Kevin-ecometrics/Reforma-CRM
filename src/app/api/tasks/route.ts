import { NextResponse } from "next/server";
import { listTasks } from "@/lib/leads";

export async function GET() {
  const tasks = await listTasks();
  return NextResponse.json({ tasks });
}
