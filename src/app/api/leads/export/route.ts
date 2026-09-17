import { listLeads } from "@/lib/leads";

const COLUMNS = [
  "id",
  "name",
  "email",
  "phone",
  "source",
  "campaignName",
  "adName",
  "formName",
  "stage",
  "notes",
  "createdAt",
  "updatedAt",
] as const;

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export async function GET() {
  const leads = await listLeads();
  const rows = [
    COLUMNS.join(","),
    ...leads.map((lead) => COLUMNS.map((col) => csvEscape(lead[col])).join(",")),
  ];
  const csv = rows.join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
