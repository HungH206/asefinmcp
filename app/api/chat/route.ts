import { NextResponse } from "next/server"
import { getConversation, processChatMessage } from "@/lib/backend/service"

export async function GET() {
  return NextResponse.json({ messages: getConversation() })
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { message?: unknown }

    if (typeof body.message !== "string" || body.message.trim().length === 0) {
      return NextResponse.json(
        { error: "Invalid request: message must be a non-empty string." },
        { status: 400 }
      )
    }

    const response = processChatMessage({ message: body.message.trim() })

    return NextResponse.json(response)
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }
}
