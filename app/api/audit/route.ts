import { NextResponse } from "next/server"
import { getAuditEntries } from "@/lib/backend/service"

export async function GET() {
  return NextResponse.json({ entries: getAuditEntries() })
}
