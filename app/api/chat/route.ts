import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getConversation, appendConversationMessages } from "@/lib/backend/service"
import { runAgent } from "@/lib/backend/agent"
import type { ChatMessageData } from "@/lib/backend/types"

const HIGH_STAKES_TERMS = ["email", "send", "wire", "transfer", "execute", "withdraw"]

function isHighStakes(text: string) {
  return HIGH_STAKES_TERMS.some((t) => text.toLowerCase().includes(t))
}

function formatTime() {
  return new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }).format(new Date())
}

export async function GET() {
  return NextResponse.json({ messages: getConversation() })
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { message?: unknown }

    if (typeof body.message !== "string" || body.message.trim().length === 0) {
      return NextResponse.json({ error: "Invalid request: message must be a non-empty string." }, { status: 400 })
    }

    const userText = body.message.trim()
    const now = formatTime()

    const userMessage: ChatMessageData = {
      id: crypto.randomUUID(),
      role: "user",
      content: userText,
      timestamp: now,
    }

    // High-stakes gate — show guardrail modal, do NOT call MCP tools directly
    if (isHighStakes(userText)) {
      const agentMessage: ChatMessageData = {
        id: crypto.randomUUID(),
        role: "agent",
        content: "I can prepare that action, but this request requires additional verification before execution because it involves a potentially high-stakes operation.",
        timestamp: now,
        metadata: { action: "high-stakes" },
      }
      appendConversationMessages(userMessage, agentMessage)
      return NextResponse.json({
        userMessage,
        agentMessage,
        toolCall: null,
      })
    }

    if (!process.env.OPENAI_API_KEY) {
      const agentMessage: ChatMessageData = {
        id: crypto.randomUUID(),
        role: "agent",
        content: "OpenAI API key is not configured. Set OPENAI_API_KEY in .env.local.",
        timestamp: now,
        metadata: { source: "System", confidence: 100 },
      }
      appendConversationMessages(userMessage, agentMessage)
      return NextResponse.json({ userMessage, agentMessage, toolCall: null })
    }

    // Extract refresh token from cookie — used by Token Vault refresh-token exchange
    const cookieStore = await cookies()
    const refreshToken = cookieStore.get("vault_refresh_token")?.value ?? null

    // Run LangGraph agent
    const result = await runAgent(userText, getConversation(), refreshToken)

    const agentMessage: ChatMessageData = {
      id: crypto.randomUUID(),
      role: "agent",
      content: result.content,
      timestamp: now,
      metadata: { source: "LangGraph · Narrator Agent", confidence: 95 },
    }

    appendConversationMessages(userMessage, agentMessage)

    // If a tool threw a VaultInterruptError, tell the frontend to show TokenVaultConsent
    if (result.interrupt) {
      return NextResponse.json({
        userMessage,
        agentMessage,
        interrupt: result.interrupt,
      })
    }

    return NextResponse.json({ userMessage, agentMessage, toolCall: null })

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
