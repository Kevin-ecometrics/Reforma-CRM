"use client";

import { useEffect, useState } from "react";

interface DashboardData {
  totalLeads: number;
  leadsByStage: { id: string; name: string; color: string; count: number }[];
  leadsBySource: { facebook: number; manual: number; csv: number };
  tasksOpen: number;
  tasksOverdue: number;
  messagesSent: number;
  messagesFailed: number;
  conversionRate: number;
  conversionStageName: string | null;
}

function StatCard({ label, value, tone }: { label: string; value: string | number; tone?: "danger" }) {
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${tone === "danger" ? "text-danger" : ""}`}>{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        setLoading(false);
      });
  }, []);

  if (loading || !data) return <div className="p-6 text-sm text-neutral-500">Loading…</div>;

  const maxStageCount = Math.max(1, ...data.leadsByStage.map((s) => s.count));

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-xl font-semibold mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatCard label="Total leads" value={data.totalLeads} />
        <StatCard
          label={data.conversionStageName ? `Conversion (${data.conversionStageName})` : "Conversion"}
          value={`${data.conversionRate}%`}
        />
        <StatCard label="Open tasks" value={data.tasksOpen} />
        <StatCard label="Overdue tasks" value={data.tasksOverdue} tone={data.tasksOverdue > 0 ? "danger" : undefined} />
        <StatCard label="Messages sent" value={data.messagesSent} />
        <StatCard label="Messages failed" value={data.messagesFailed} tone={data.messagesFailed > 0 ? "danger" : undefined} />
        <StatCard label="Facebook leads" value={data.leadsBySource.facebook} />
        <StatCard label="Manual + CSV leads" value={data.leadsBySource.manual + data.leadsBySource.csv} />
      </div>

      <section>
        <h2 className="text-sm font-semibold mb-3">Leads by stage</h2>
        <div className="space-y-2">
          {data.leadsByStage.map((stage) => (
            <div key={stage.id} className="flex items-center gap-3">
              <span className="w-32 shrink-0 text-sm truncate">{stage.name}</span>
              <div className="flex-1 h-4 rounded bg-neutral-100 dark:bg-neutral-900/50 overflow-hidden">
                <div
                  className="h-full rounded"
                  style={{
                    width: `${(stage.count / maxStageCount) * 100}%`,
                    backgroundColor: stage.color,
                  }}
                />
              </div>
              <span className="w-8 shrink-0 text-right text-sm text-neutral-500">{stage.count}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
