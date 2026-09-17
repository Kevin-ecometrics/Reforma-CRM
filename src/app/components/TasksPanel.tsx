"use client";

import { useEffect, useState } from "react";
import { Button, Checkbox } from "@nextui-org/react";
import Link from "next/link";
import type { Task } from "@/lib/types";

export function TasksPanel({ refreshKey }: { refreshKey: number }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/tasks");
    const data = await res.json();
    setTasks(data.tasks ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [refreshKey]);

  async function complete(id: string) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: true } : t)));
    await fetch(`/api/tasks/${id}`, { method: "PATCH" });
  }

  const now = Date.now();
  const open = tasks.filter((t) => !t.done);
  const dueSoon = open.filter((t) => new Date(t.dueAt).getTime() <= now + 24 * 60 * 60 * 1000);
  const overdueCount = dueSoon.filter((t) => new Date(t.dueAt).getTime() < now).length;

  return (
    <div className="w-72 shrink-0 border-l border-neutral-200 dark:border-neutral-800 p-4">
      <h2 className="font-semibold text-sm mb-3">
        Tasks due today ({dueSoon.length})
        {overdueCount > 0 && <span className="text-danger font-normal"> · {overdueCount} overdue</span>}
      </h2>
      {loading && <p className="text-xs text-neutral-500">Loading…</p>}
      {!loading && dueSoon.length === 0 && (
        <p className="text-xs text-neutral-500">Nothing due — nice.</p>
      )}
      <ul className="space-y-2">
        {dueSoon.map((task) => {
          const overdue = new Date(task.dueAt).getTime() < now;
          return (
            <li key={task.id} className="flex items-start gap-2 text-sm">
              <Checkbox size="sm" onValueChange={() => complete(task.id)} />
              <div className="min-w-0">
                <Link
                  href={`/leads/${task.leadId}`}
                  className={`hover:underline block truncate ${overdue ? "text-danger" : ""}`}
                >
                  {task.description}
                </Link>
                <span className={`text-xs ${overdue ? "text-danger" : "text-neutral-500"}`}>
                  {overdue ? "Overdue — " : ""}
                  {new Date(task.dueAt).toLocaleString()}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <Button size="sm" variant="light" className="mt-4 w-full" onPress={load}>
        Refresh
      </Button>
    </div>
  );
}
