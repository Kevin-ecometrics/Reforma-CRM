import { NextResponse } from "next/server";
import { createLead } from "@/lib/leads";

// Expects a simple CSV with a header row containing at least a "name" column
// and optionally "email"/"phone" columns, e.g.:
//   name,email,phone
//   Jane Doe,jane@example.com,555-0100
export async function POST(req: Request) {
  const body = await req.json();
  const csvText = body.csv as string | undefined;
  if (!csvText || typeof csvText !== "string") {
    return NextResponse.json({ error: "csv (string) is required" }, { status: 400 });
  }

  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    return NextResponse.json({ error: "CSV must have a header row and at least one data row" }, { status: 400 });
  }

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const nameIdx = headers.indexOf("name");
  const emailIdx = headers.indexOf("email");
  const phoneIdx = headers.indexOf("phone");

  if (nameIdx === -1) {
    return NextResponse.json({ error: 'CSV header must include a "name" column' }, { status: 400 });
  }

  let created = 0;
  for (const line of lines.slice(1)) {
    const cols = line.split(",").map((c) => c.trim());
    const name = cols[nameIdx];
    if (!name) continue;

    await createLead({
      name,
      email: emailIdx !== -1 ? cols[emailIdx] || null : null,
      phone: phoneIdx !== -1 ? cols[phoneIdx] || null : null,
      source: "csv",
    });
    created += 1;
  }

  return NextResponse.json({ created });
}
