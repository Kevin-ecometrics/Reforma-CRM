import { NextResponse } from "next/server";
import { checkFacebookTokenValidity } from "@/lib/facebookSync";
import { getDb } from "@/lib/db";

export async function POST() {
  await checkFacebookTokenValidity();
  const db = await getDb();
  const { tokenValid, tokenCheckedAt, tokenCheckError } = db.data.syncState;
  return NextResponse.json({ tokenValid, tokenCheckedAt, tokenCheckError });
}
