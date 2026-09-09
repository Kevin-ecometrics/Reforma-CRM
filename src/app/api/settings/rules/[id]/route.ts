import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const db = await getDb();
  const rule = db.data.automationRules.find((r) => r.id === params.id);
  if (!rule) return NextResponse.json({ error: "Rule not found" }, { status: 404 });

  if (typeof body.enabled === "boolean") {
    rule.enabled = body.enabled;
    await db.write();
  }

  return NextResponse.json({ rule });
}
