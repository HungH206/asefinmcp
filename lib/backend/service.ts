import type {
  AuditEntryData,
  ChatMessageData,
  ChatRequest,
  ChatResponse,
  FinancialCardData,
} from "@/lib/backend/types"

const marketCards: FinancialCardData[] = [
  {
    id: "aapl-price",
    metric: "price",
    title: "AAPL Price",
    value: "$189.84",
    change: 2.34,
    changeLabel: "vs. yesterday close",
    lastUpdate: "2s ago",
  },
  {
    id: "portfolio-value",
    metric: "portfolio",
    title: "Portfolio Value",
    value: "$1.24M",
    change: 1.87,
    changeLabel: "24h change",
    lastUpdate: "5s ago",
  },
  {
    id: "portfolio-volatility",
    metric: "volatility",
    title: "Portfolio Volatility",
    value: "14.2%",
    change: -0.8,
    changeLabel: "vs. market avg",
    lastUpdate: "10s ago",
  },
  {
    id: "risk-score",
    metric: "risk",
    title: "Risk Score",
    value: "Low",
    change: 5.2,
    changeLabel: "improved this week",
    lastUpdate: "1m ago",
  },
]

const auditEntries: AuditEntryData[] = [
  {
    id: "1",
    action: "Token Requested from Vault",
    status: "success",
    timestamp: "09:16:42 AM",
    actor: "Narrator Agent",
    eventType: "vault",
  },
  {
    id: "2",
    action: "MFA Verification Completed",
    status: "success",
    timestamp: "09:15:18 AM",
    actor: "John Doe",
    eventType: "mfa",
  },
  {
    id: "3",
    action: "Market Data Fetched via MCP",
    status: "success",
    timestamp: "09:14:55 AM",
    actor: "Market Feed Service",
    eventType: "market",
  },
  {
    id: "4",
    action: "Portfolio Analysis Generated",
    status: "success",
    timestamp: "09:14:23 AM",
    actor: "Narrator Agent",
    eventType: "report",
  },
  {
    id: "5",
    action: "Session Authenticated via Auth0",
    status: "success",
    timestamp: "09:00:12 AM",
    actor: "John Doe",
    eventType: "auth",
  },
]

const initialMessages: ChatMessageData[] = [
  {
    id: "1",
    role: "agent",
    content:
      "Good morning. I have completed my initial analysis of your portfolio. Your current exposure shows strong performance in tech equities, but I have identified volatility concerns in your emerging market positions.",
    timestamp: "09:14 AM",
    metadata: {
      source: "Portfolio Analysis Engine",
      confidence: 94,
    },
  },
  {
    id: "2",
    role: "user",
    content: "Can you show me the current status of my AAPL holdings and any recommendations?",
    timestamp: "09:15 AM",
  },
  {
    id: "3",
    role: "agent",
    content:
      "Your AAPL position currently represents 12.4% of your portfolio with an unrealized gain of +23.7% since acquisition. Based on current market conditions and your risk profile, I recommend maintaining your position and setting a trailing stop-loss at 8% below current price to protect gains.",
    timestamp: "09:15 AM",
    metadata: {
      source: "Risk Assessment Module",
      confidence: 89,
    },
  },
]

let conversation: ChatMessageData[] = [...initialMessages]

export function getMarketCards(): FinancialCardData[] {
  return marketCards
}

export function getAuditEntries(): AuditEntryData[] {
  return [...auditEntries].reverse()
}

export function appendAuditEntry(entry: Omit<AuditEntryData, "id" | "timestamp">): AuditEntryData {
  const newEntry: AuditEntryData = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).format(new Date()),
  }
  auditEntries.push(newEntry)
  return newEntry
}

export function getConversation(): ChatMessageData[] {
  return conversation
}

export function appendConversationMessages(...messages: ChatMessageData[]): void {
  conversation = [...conversation, ...messages]
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date)
}

function isHighStakesPrompt(text: string): boolean {
  const highStakesTerms = ["email", "send", "wire", "transfer", "execute", "withdraw"]
  const lowerText = text.toLowerCase()

  return highStakesTerms.some((term) => lowerText.includes(term))
}

export function processChatMessage(input: ChatRequest): ChatResponse {
  const now = formatTime(new Date())
  const userMessage: ChatMessageData = {
    id: crypto.randomUUID(),
    role: "user",
    content: input.message,
    timestamp: now,
  }

  const highStakes = isHighStakesPrompt(input.message)

  const agentMessage: ChatMessageData = highStakes
    ? {
        id: crypto.randomUUID(),
        role: "agent",
        content:
          "I can prepare that action, but this request requires additional verification before execution because it involves a potentially high-stakes operation.",
        timestamp: now,
        metadata: {
          action: "high-stakes",
        },
      }
    : {
        id: crypto.randomUUID(),
        role: "agent",
        content:
          "Request received. I have logged it and queued an updated portfolio analysis. You can review risk-adjusted recommendations in the next sync.",
        timestamp: now,
        metadata: {
          source: "Narrator Orchestrator",
          confidence: 91,
        },
      }

  conversation = [...conversation, userMessage, agentMessage]

  return { userMessage, agentMessage }
}
