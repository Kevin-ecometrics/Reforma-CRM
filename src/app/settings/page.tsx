"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Chip,
  Select,
  SelectItem,
  Switch,
  Textarea,
  Input,
} from "@nextui-org/react";
import type { AutomationRule, Lead, MessageTemplate } from "@/lib/types";

interface SettingsData {
  automationRules: AutomationRule[];
  templates: MessageTemplate[];
  syncState: {
    lastSyncAt: string | null;
    lastError: string | null;
    lastCapiAt: string | null;
    lastCapiError: string | null;
    tokenValid: boolean | null;
    tokenCheckedAt: string | null;
    tokenCheckError: string | null;
  };
  configured: {
    facebookLeadSync: boolean;
    facebookCapi: boolean;
    facebookCapiTestMode: boolean;
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
  };
}

function StatusChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Chip size="sm" color={ok ? "success" : "default"} variant="flat">
      {label}: {ok ? "configured" : "not configured"}
    </Chip>
  );
}

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [tokenCheckResult, setTokenCheckResult] = useState<string | null>(null);
  const [csvText, setCsvText] = useState("");
  const [csvResult, setCsvResult] = useState<string | null>(null);
  const [testChannel, setTestChannel] = useState("email");
  const [testTo, setTestTo] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [capiLeadId, setCapiLeadId] = useState("");
  const [capiResult, setCapiResult] = useState<string | null>(null);

  async function load() {
    const [settingsRes, leadsRes] = await Promise.all([
      fetch("/api/settings"),
      fetch("/api/leads"),
    ]);
    setData(await settingsRes.json());
    const leadsData = await leadsRes.json();
    setLeads(leadsData.leads ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleRule(rule: AutomationRule) {
    setData((prev) =>
      prev
        ? {
            ...prev,
            automationRules: prev.automationRules.map((r) =>
              r.id === rule.id ? { ...r, enabled: !r.enabled } : r
            ),
          }
        : prev
    );
    await fetch(`/api/settings/rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !rule.enabled }),
    });
  }

  async function saveTemplate(t: MessageTemplate) {
    await fetch("/api/settings/templates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: t.key, channel: t.channel, subject: t.subject, text: t.body }),
    });
  }

  function updateTemplateDraft(key: string, channel: string, field: "body" | "subject", value: string) {
    setData((prev) =>
      prev
        ? {
            ...prev,
            templates: prev.templates.map((t) =>
              t.key === key && t.channel === channel ? { ...t, [field]: value } : t
            ),
          }
        : prev
    );
  }

  async function runSync() {
    setSyncResult("Syncing…");
    const res = await fetch("/api/sync", { method: "POST" });
    const json = await res.json();
    setSyncResult(json.ok ? `Synced. Fetched ${json.fetched}, created ${json.created}.` : `Failed: ${json.error}`);
    load();
  }

  async function runTokenCheck() {
    setTokenCheckResult("Checking…");
    const res = await fetch("/api/check-token", { method: "POST" });
    const json = await res.json();
    setTokenCheckResult(
      json.tokenValid ? "Token is valid." : `Token invalid — ${json.tokenCheckError}`
    );
    load();
  }

  async function runCsvImport() {
    setCsvResult("Importing…");
    const res = await fetch("/api/import-csv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv: csvText }),
    });
    const json = await res.json();
    setCsvResult(res.ok ? `Imported ${json.created} leads.` : `Failed: ${json.error}`);
    if (res.ok) setCsvText("");
  }

  async function sendTestMessage() {
    setTestResult("Sending…");
    const res = await fetch("/api/messaging-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: testChannel, to: testTo }),
    });
    const json = await res.json();
    setTestResult(json.ok ? "Sent." : `Failed: ${json.error}`);
  }

  async function sendCapiTest() {
    if (!capiLeadId) return;
    setCapiResult("Sending…");
    const res = await fetch("/api/capi-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId: capiLeadId }),
    });
    const json = await res.json();
    setCapiResult(json.ok ? "Sent — check Events Manager Test Events." : `Failed: ${json.error}`);
  }

  if (!data) return <div className="p-6 text-sm text-neutral-500">Loading…</div>;

  const templateKeys = Array.from(new Set(data.templates.map((t) => t.key)));

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-10">
      <h1 className="text-xl font-semibold">Settings</h1>

      <section>
        <h2 className="text-sm font-semibold mb-2">Integration status</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          <StatusChip ok={data.configured.facebookLeadSync} label="Facebook lead sync" />
          {data.syncState.tokenValid !== null && (
            <Chip size="sm" color={data.syncState.tokenValid ? "success" : "danger"} variant="flat">
              Page token: {data.syncState.tokenValid ? "valid" : "invalid"}
            </Chip>
          )}
          <StatusChip ok={data.configured.facebookCapi} label="Facebook CAPI" />
          {data.configured.facebookCapiTestMode && (
            <Chip size="sm" color="warning" variant="flat">
              CAPI test mode ON
            </Chip>
          )}
          <StatusChip ok={data.configured.email} label="Email (SMTP)" />
          <StatusChip ok={data.configured.sms} label="SMS (Twilio)" />
          <StatusChip ok={data.configured.whatsapp} label="WhatsApp (Meta)" />
        </div>
        <p className="text-xs text-neutral-500 mb-2">
          Last sync: {data.syncState.lastSyncAt ?? "never"}
          {data.syncState.lastError && (
            <span className="text-danger"> — error: {data.syncState.lastError}</span>
          )}
        </p>
        <p className="text-xs text-neutral-500 mb-2">
          Last token check: {data.syncState.tokenCheckedAt ?? "never"}
          {data.syncState.tokenCheckError && (
            <span className="text-danger"> — error: {data.syncState.tokenCheckError}</span>
          )}
        </p>
        <div className="flex gap-2">
          <Button size="sm" onPress={runSync}>
            Sync now
          </Button>
          <Button size="sm" variant="flat" onPress={runTokenCheck}>
            Check token
          </Button>
        </div>
        {syncResult && <p className="text-xs mt-2">{syncResult}</p>}
        {tokenCheckResult && <p className="text-xs mt-2">{tokenCheckResult}</p>}
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-2">Automation rules</h2>
        <ul className="space-y-2">
          {data.automationRules.map((rule) => (
            <li
              key={rule.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 dark:border-neutral-800 p-3"
            >
              <div className="text-sm">
                <div>{rule.label}</div>
                <div className="text-xs text-neutral-500">
                  trigger: {rule.trigger} · action: {rule.action}
                </div>
              </div>
              <Switch size="sm" isSelected={rule.enabled} onValueChange={() => toggleRule(rule)} />
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-2">Message templates</h2>
        {templateKeys.map((key) => (
          <div key={key} className="mb-4">
            <h3 className="text-xs font-semibold text-neutral-500 mb-1">{key}</h3>
            {data.templates
              .filter((t) => t.key === key)
              .map((t) => (
                <div key={`${t.key}-${t.channel}`} className="mb-2 rounded-lg border border-neutral-200 dark:border-neutral-800 p-3">
                  <div className="text-xs font-medium mb-1">{t.label}</div>
                  {t.channel === "email" && (
                    <Input
                      size="sm"
                      label="Subject"
                      value={t.subject ?? ""}
                      onValueChange={(v) => updateTemplateDraft(t.key, t.channel, "subject", v)}
                      className="mb-2"
                    />
                  )}
                  <Textarea
                    size="sm"
                    value={t.body}
                    onValueChange={(v) => updateTemplateDraft(t.key, t.channel, "body", v)}
                    minRows={2}
                  />
                  <Button size="sm" variant="flat" className="mt-2" onPress={() => saveTemplate(t)}>
                    Save
                  </Button>
                </div>
              ))}
          </div>
        ))}
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-2">Send a test message</h2>
        <div className="flex gap-2 items-end">
          <Select
            label="Channel"
            className="w-40"
            selectedKeys={[testChannel]}
            onChange={(e) => setTestChannel(e.target.value)}
          >
            <SelectItem key="email" value="email">Email</SelectItem>
            <SelectItem key="sms" value="sms">SMS</SelectItem>
            <SelectItem key="whatsapp" value="whatsapp">WhatsApp</SelectItem>
          </Select>
          <Input label="To (email or phone)" value={testTo} onValueChange={setTestTo} />
          <Button onPress={sendTestMessage}>Send test</Button>
        </div>
        {testResult && <p className="text-xs mt-2">{testResult}</p>}
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-2">Send a test Facebook CAPI event</h2>
        <div className="flex gap-2 items-end">
          <Select
            label="Lead"
            className="w-64"
            selectedKeys={capiLeadId ? [capiLeadId] : []}
            onChange={(e) => setCapiLeadId(e.target.value)}
          >
            {leads.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name}
              </SelectItem>
            ))}
          </Select>
          <Button onPress={sendCapiTest}>Send test event</Button>
        </div>
        {capiResult && <p className="text-xs mt-2">{capiResult}</p>}
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-2">Import leads from CSV</h2>
        <p className="text-xs text-neutral-500 mb-2">
          Paste CSV with a header row: <code>name,email,phone</code>
        </p>
        <Textarea value={csvText} onValueChange={setCsvText} minRows={4} placeholder={"name,email,phone\nJane Doe,jane@example.com,555-0100"} />
        <Button size="sm" className="mt-2" onPress={runCsvImport}>
          Import
        </Button>
        {csvResult && <p className="text-xs mt-2">{csvResult}</p>}
      </section>
    </div>
  );
}
