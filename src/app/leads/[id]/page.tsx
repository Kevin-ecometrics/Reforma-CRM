"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Button,
  Chip,
  Select,
  SelectItem,
  Textarea,
} from "@nextui-org/react";
import { FaArrowLeft } from "react-icons/fa";
import { SendMessageModal } from "@/app/components/SendMessageModal";
import type { Activity, Lead, MessageTemplate, Stage, Task } from "@/lib/types";

const HIDDEN_FIELD_KEYS = new Set(["platform", "is_organic"]);
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?$/;

function formatFieldLabel(key: string): string {
  const words = key.replace(/_/g, " ").replace(/\?$/, "").trim();
  const label = words.charAt(0).toUpperCase() + words.slice(1);
  return key.endsWith("?") ? `${label}?` : label;
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" && ISO_DATE_RE.test(value)) {
    return new Date(value).toLocaleString();
  }
  return String(value);
}

const ACTIVITY_LABEL: Record<Activity["type"], string> = {
  note: "Note",
  stage_change: "Stage change",
  system: "System",
  message_sent: "Message sent",
  message_failed: "Message failed",
  capi_sent: "Facebook event sent",
  capi_failed: "Facebook event failed",
};

export default function LeadDetailPage({ params }: { params: { id: string } }) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [notesDraft, setNotesDraft] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    const [leadRes, settingsRes] = await Promise.all([
      fetch(`/api/leads/${params.id}`),
      fetch("/api/settings"),
    ]);
    const leadData = await leadRes.json();
    const settingsData = await settingsRes.json();
    setLead(leadData.lead ?? null);
    setActivities(leadData.activities ?? []);
    setTasks(leadData.tasks ?? []);
    setStages((settingsData.stages ?? []).sort((a: Stage, b: Stage) => a.order - b.order));
    setTemplates(settingsData.templates ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function changeStage(stage: string) {
    await fetch(`/api/leads/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    load();
  }

  async function saveNote() {
    if (!notesDraft.trim()) return;
    await fetch(`/api/leads/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notesDraft }),
    });
    setNotesDraft("");
    load();
  }

  async function completeTask(id: string) {
    await fetch(`/api/tasks/${id}`, { method: "PATCH" });
    load();
  }

  if (loading) return <div className="p-6 text-sm text-neutral-500">Loading…</div>;
  if (!lead) return <div className="p-6 text-sm text-neutral-500">Lead not found.</div>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:underline mb-4">
        <FaArrowLeft size={12} /> Back to pipeline
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold">{lead.name}</h1>
          <div className="flex gap-3 mt-1 text-sm text-neutral-500">
            {lead.email && <span>{lead.email}</span>}
            {lead.phone && <span>{lead.phone}</span>}
          </div>
          <div className="flex gap-2 mt-2">
            <Chip size="sm" variant="flat">
              source: {lead.source}
            </Chip>
            {lead.campaignName && (
              <Chip size="sm" variant="flat">
                {lead.campaignName}
              </Chip>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Select
            label="Stage"
            className="w-48"
            selectedKeys={[lead.stage]}
            onChange={(e) => e.target.value && changeStage(e.target.value)}
          >
            {stages.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </Select>
          <SendMessageModal lead={lead} templates={templates} onSent={load} />
        </div>
      </div>

      {lead.fieldDataRaw && Object.keys(lead.fieldDataRaw).some((k) => !HIDDEN_FIELD_KEYS.has(k)) && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold mb-2">Form answers</h2>
          <dl className="space-y-2 text-sm border border-neutral-200 dark:border-neutral-800 rounded-md p-3">
            {Object.entries(lead.fieldDataRaw)
              .filter(([key]) => !HIDDEN_FIELD_KEYS.has(key))
              .map(([key, value]) => (
                <div key={key} className="flex flex-col">
                  <dt className="text-xs text-neutral-500">{formatFieldLabel(key)}</dt>
                  <dd className="whitespace-pre-wrap">{formatFieldValue(value)}</dd>
                </div>
              ))}
          </dl>
        </section>
      )}

      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-2">Tasks</h2>
        {tasks.length === 0 && <p className="text-sm text-neutral-500">No tasks yet.</p>}
        <ul className="space-y-1">
          {tasks.map((task) => {
            const overdue = !task.done && new Date(task.dueAt).getTime() < Date.now();
            return (
              <li key={task.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={task.done}
                  onChange={() => !task.done && completeTask(task.id)}
                />
                <span className={task.done ? "line-through text-neutral-400" : overdue ? "text-danger" : ""}>
                  {task.description}
                </span>
                <span className={`text-xs ml-auto ${overdue ? "text-danger" : "text-neutral-500"}`}>
                  {overdue ? "Overdue — " : ""}
                  {new Date(task.dueAt).toLocaleString()}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-2">Add a note</h2>
        <Textarea
          value={notesDraft}
          onValueChange={setNotesDraft}
          placeholder="What happened on this lead?"
          minRows={2}
        />
        <Button size="sm" color="primary" className="mt-2" onPress={saveNote}>
          Save note
        </Button>
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-2">Activity</h2>
        <ul className="space-y-3">
          {activities.map((a) => (
            <li key={a.id} className="text-sm border-l-2 border-neutral-200 dark:border-neutral-800 pl-3">
              <div className="flex items-center gap-2">
                <span className="font-medium">{ACTIVITY_LABEL[a.type]}</span>
                <span className="text-xs text-neutral-500">
                  {new Date(a.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap">{a.content}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
