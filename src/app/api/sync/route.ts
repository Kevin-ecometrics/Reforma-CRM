import { NextResponse } from "next/server";
import { syncFacebookLeads } from "@/lib/facebookSync";

export async function POST() {
  const result = await syncFacebookLeads();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
