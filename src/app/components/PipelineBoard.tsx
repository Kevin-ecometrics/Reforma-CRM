"use client";

import { useEffect, useState } from "react";
import type { Lead, Stage } from "@/lib/types";
import { LeadCard } from "./LeadCard";
import { AddLeadModal } from "./AddLeadModal";
import { TasksPanel } from "./TasksPanel";

export function PipelineBoard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  async function load() {
    const [leadsRes, settingsRes] = await Promise.all([
      fetch("/api/leads"),
      fetch("/api/settings"),
    ]);
    const leadsData = await leadsRes.json();
    const settingsData = await settingsRes.json();
    setLeads(leadsData.leads ?? []);
    setStages((settingsData.stages ?? []).sort((a: Stage, b: Stage) => a.order - b.order));
  }

  useEffect(() => {
    load();
  }, [refreshKey]);

  async function moveLead(id: string, stage: string) {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, stage } : l)));
    await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="flex h-screen">
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold">Lead pipeline</h1>
            <p className="text-xs text-neutral-500">{leads.length} leads total</p>
          </div>
          <AddLeadModal onCreated={() => setRefreshKey((k) => k + 1)} />
        </header>
        <div className="flex-1 overflow-x-auto px-6 py-4">
          <div className="flex gap-4 h-full min-w-max">
            {stages.map((stage) => {
              const stageLeads = leads.filter((l) => l.stage === stage.id);
              return (
                <div
                  key={stage.id}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => draggingId && moveLead(draggingId, stage.id)}
                  className="w-64 shrink-0 rounded-xl bg-neutral-100 dark:bg-neutral-900/50 p-3 flex flex-col"
                >
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: stage.color }}
                    />
                    <span className="text-sm font-medium">{stage.name}</span>
                    <span className="ml-auto text-xs text-neutral-500">{stageLeads.length}</span>
                  </div>
                  <div className="flex flex-col gap-2 overflow-y-auto">
                    {stageLeads.map((lead) => (
                      <LeadCard key={lead.id} lead={lead} onDragStart={setDraggingId} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <TasksPanel refreshKey={refreshKey} />
    </div>
  );
}
