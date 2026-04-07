import { NextResponse } from "next/server"
import { getAuditEntries, appendAuditEntry } from "@/lib/backend/service"
import type { AuditEntryData } from "@/lib/backend/types"

export async function GET() {
  return NextResponse.json({ entries: getAuditEntries() })
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<Omit<AuditEntryData, "id" | "timestamp">>

    if (!body.action || !body.status || !body.actor || !body.eventType) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 })
    }

    const entry = appendAuditEntry({
      action: body.action,
      status: body.status,
      actor: body.actor,
      eventType: body.eventType,
    })

    return NextResponse.json({ entry }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }
}
