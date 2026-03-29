export type RiskLevel = "low" | "medium" | "high"

export interface FinancialCardData {
  id: string
  metric: "price" | "portfolio" | "volatility" | "risk"
  title: string
  value: string
  change: number
  changeLabel: string
  lastUpdate: string
}

export type AuditStatus = "success" | "pending" | "denied"
export type AuditEventType = "vault" | "mfa" | "market" | "report" | "auth"

export interface AuditEntryData {
  id: string
  action: string
  status: AuditStatus
  timestamp: string
  actor: string
  eventType: AuditEventType
}

export interface ChatMetadata {
  source?: string
  confidence?: number
  action?: "high-stakes"
}

export interface ChatMessageData {
  id: string
  role: "user" | "agent"
  content: string
  timestamp: string
  metadata?: ChatMetadata
}

export interface ChatRequest {
  message: string
}

export interface ChatResponse {
  userMessage: ChatMessageData
  agentMessage: ChatMessageData
}
