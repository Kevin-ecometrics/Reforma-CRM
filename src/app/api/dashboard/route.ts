import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { listActivities, listLeads, listTasks } from "@/lib/leads";

export async function GET() {
  const db = await getDb();
  const [leads, tasks, activities] = await Promise.all([
    listLeads(),
    listTasks(),
    listActivities(),
  ]);
  const stages = [...db.data.stages].sort((a, b) => a.order - b.order);

  const leadsByStage = stages.map((stage) => ({
    id: stage.id,
    name: stage.name,
    color: stage.color,
    count: leads.filter((l) => l.stage === stage.id).length,
  }));

  const leadsBySource = {
    facebook: leads.filter((l) => l.source === "facebook").length,
    manual: leads.filter((l) => l.source === "manual").length,
    csv: leads.filter((l) => l.source === "csv").length,
  };

  const now = Date.now();
  const openTasks = tasks.filter((t) => !t.done);
  const overdueTasks = openTasks.filter((t) => new Date(t.dueAt).getTime() < now);

  const messagesSent = activities.filter((a) => a.type === "message_sent").length;
  const messagesFailed = activities.filter((a) => a.type === "message_failed").length;

  const wonStage =
    stages.find((s) => s.id.toLowerCase() === "won" || s.name.toLowerCase() === "won") ??
    stages[stages.length - 1];
  const conversionRate =
    leads.length > 0 && wonStage
      ? Math.round((leads.filter((l) => l.stage === wonStage.id).length / leads.length) * 100)
      : 0;

  return NextResponse.json({
    totalLeads: leads.length,
    leadsByStage,
    leadsBySource,
    tasksOpen: openTasks.length,
    tasksOverdue: overdueTasks.length,
    messagesSent,
    messagesFailed,
    conversionRate,
    conversionStageName: wonStage?.name ?? null,
  });
}
