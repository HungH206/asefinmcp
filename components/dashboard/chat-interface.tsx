"use client"

import { useEffect, useRef, useState } from "react"
import { Bot, User, Send, Sparkles, AlertTriangle, Loader2, KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import type { ChatMessageData, ChatResponse } from "@/lib/backend/types"
import type { GuardrailActionContext } from "@/components/dashboard/security-guardrail"
import { callAsefinTool } from "@/lib/backend/mcp-client"
import { TokenVaultConsent } from "@/components/auth0-ai/TokenVault"
import { useVaultSession } from "@/hooks/useVaultSession"

type ToolResult = Record<string, unknown>

function formatToolResult(toolName: string, result: ToolResult): { content: string; source: string; confidence: number } {
  switch (toolName) {
    case "get_market_brief": {
      const { ticker, price, change } = result
      return {
        content: `${String(ticker)} is currently trading at ${String(price)}, ${String(change)} today. Data retrieved securely — the raw API key was never exposed to this session.`,
        source: "ASEFIN Market Vault",
        confidence: 99,
      }
    }
    case "analyze_portfolio": {
      const { total_value, weighted_volatility, risk, top_position } = result
      return {
        content: `Portfolio analysis complete. Total value: ${String(total_value)}. Weighted volatility: ${String(weighted_volatility)} — risk level is ${String(risk)}. Largest position: ${String(top_position)}.`,
        source: "Risk Assessment Module",
        confidence: 94,
      }
    }
    case "get_balance": {
      const { account, balance, currency } = result
      return {
        content: `Your ${String(account)} account balance is ${String(balance)} ${String(currency)}, retrieved securely from the Auth0 Token Vault.`,
        source: "Auth0 Token Vault",
        confidence: 100,
      }
    }
    default:
      return {
        content: `Tool result: ${JSON.stringify(result)}`,
        source: "ASEFIN Vault",
        confidence: 90,
      }
  }
}

function MessageBubble({ message }: { message: ChatMessageData }) {
  const isAgent = message.role === "agent"
  const isHighStakes = message.metadata?.action === "high-stakes"

  return (
    <div className={`flex gap-3 ${isAgent ? "" : "flex-row-reverse"}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
          isAgent
            ? "bg-primary/10 border-primary/20"
            : "bg-secondary border-border"
        }`}
      >
        {isAgent ? (
          <Bot className="h-4 w-4 text-primary" />
        ) : (
          <User className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      <div className={`flex flex-col gap-1 max-w-[80%] ${isAgent ? "" : "items-end"}`}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">
            {isAgent ? "Narrator Agent" : "You"}
          </span>
          <span className="text-xs text-muted-foreground">{message.timestamp}</span>
        </div>

        <div
          className={`rounded-lg px-4 py-3 ${
            isAgent
              ? "bg-secondary/70 border border-border/50"
              : "bg-primary/10 border border-primary/20"
          } ${isHighStakes ? "border-warning/50 bg-warning/5" : ""}`}
        >
          {isHighStakes && (
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-warning/30">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <span className="text-xs font-medium text-warning">High-Stakes Action Detected</span>
            </div>
          )}
          <p className="text-sm leading-relaxed">{message.content}</p>
        </div>

        {message.metadata && !isHighStakes && (
          <div className="flex items-center gap-2 mt-1">
            {message.metadata.source && (
              <Badge variant="outline" className="text-xs px-2 py-0.5 border-border/50">
                <Sparkles className="h-3 w-3 mr-1 text-primary" />
                {message.metadata.source}
              </Badge>
            )}
            {message.metadata.confidence && (
              <Badge variant="outline" className="text-xs px-2 py-0.5 border-primary/30 text-primary">
                {message.metadata.confidence}% confidence
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

interface ChatInterfaceProps {
  onHighStakes?: (ctx: GuardrailActionContext) => void
}

export function ChatInterface({ onHighStakes }: ChatInterfaceProps) {
  const { session } = useVaultSession()
  const [messages, setMessages] = useState<ChatMessageData[]>([])
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isToolPending, setIsToolPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [interrupt, setInterrupt] = useState<{ connection: string; requiredScopes: string[]; resume: () => void } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isToolPending])

  useEffect(() => {
    let mounted = true

    const loadMessages = async () => {
      try {
        const response = await fetch("/api/chat")

        if (!response.ok) {
          throw new Error("Failed to fetch conversation")
        }

        const data = (await response.json()) as { messages: ChatMessageData[] }

        if (mounted) {
          setMessages(data.messages)
        }
      } catch {
        if (mounted) {
          setError("Could not load conversation")
        }
      }
    }

    void loadMessages()

    return () => {
      mounted = false
    }
  }, [])

  const sendMessage = async () => {
    const message = input.trim()
    if (!message || isSending) return

    setIsSending(true)
    setError(null)

    try {
      // 1. Initial request to your Next.js AI route
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      })

      if (!response.ok) {
        throw new Error("Failed to send chat request")
      }

      const data = (await response.json()) as ChatResponse & {
        toolCall?: { name: string; args?: unknown } | null
        interrupt?: { connection: string; requiredScopes: string[] }
      }

      // LangGraph returned a vault interrupt — show TokenVaultConsent
      if (data.interrupt) {
        setMessages((current) => [...current, data.userMessage, data.agentMessage])
        setInterrupt({
          connection: data.interrupt.connection,
          requiredScopes: data.interrupt.requiredScopes,
          resume: () => setInterrupt(null),
        })
        setInput("")
        return
      }

      // 2. CHECK FOR TOOL CALLS (high-stakes path still uses MCP route directly)
      if (data.toolCall) {
        setIsToolPending(true)
        try {
          const toolResult = (await callAsefinTool(data.toolCall.name, data.toolCall.args)) as { result?: ToolResult }
          const formatted = formatToolResult(data.toolCall.name, toolResult.result ?? {})

          setMessages((current) => [
            ...current,
            data.userMessage,
            {
              id: Date.now().toString(),
              role: "agent",
              content: formatted.content,
              metadata: { source: formatted.source, confidence: formatted.confidence },
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ])
        } catch (err: unknown) {
          // 3. STEP-UP AUTH TRIGGER
          if (err instanceof Error && err.message === "MFA_REQUIRED") {
            setMessages((current) => [...current, data.userMessage])
            setInterrupt({
              connection: "google-oauth2",
              requiredScopes: ["https://www.googleapis.com/auth/gmail.send"],
              resume: () => {
                void callAsefinTool("send_financial_report_email", {
                  recipient: "accountant@trustedpartner.com",
                  subject: "Portfolio Report",
                }).then(() => setInterrupt(null))
              },
            })
          } else {
            setError("Tool call failed")
          }
        } finally {
          setIsToolPending(false)
        }
      } else {
        setMessages((current) => [...current, data.userMessage, data.agentMessage])
        // Fire guardrail if agent flagged this as high-stakes
        if (data.agentMessage.metadata?.action === "high-stakes") {
          onHighStakes?.({
            action: "Send Financial Report via Email",
            recipient: "accountant@trustedpartner.com",
            docType: "Portfolio Performance Report",
            requestedBy: "Narrator Agent",
          })
        }
      }

      setInput("")
    } catch {
      setError("Unable to connect to ASEFIN backend")
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="flex flex-col h-full border border-border/50 rounded-lg bg-card/50 overflow-hidden">
      {interrupt && (
        <TokenVaultConsent
          mode="auto"
          interrupt={interrupt}
          onFinish={() => setInterrupt(null)}
          connectWidget={{
            title: "Connect Google Account",
            description: "ASEFIN needs permission to send emails on your behalf via Gmail.",
            action: { label: "Authorize Gmail" },
          }}
        />
      )}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-secondary/30">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">The Narrator</h3>
            <p className="text-xs text-muted-foreground">LangGraph · AI Financial Intelligence Agent</p>
          </div>
        </div>
        <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
          <div className="h-1.5 w-1.5 rounded-full bg-primary mr-1.5 animate-pulse" />
          Active
        </Badge>
        {session.authenticated ? (
          <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
            <KeyRound className="h-3 w-3 mr-1" />
            Vault Connected
          </Badge>
        ) : (
          <Badge
            className="bg-warning/10 text-warning border-warning/20 text-xs cursor-pointer hover:bg-warning/20"
            onClick={() => {
              window.open(
                `/auth/connect?connection=google-oauth2&scopes=https://www.googleapis.com/auth/gmail.send&returnTo=/close&popup=1`,
                "_blank",
                "width=800,height=650,status=no,toolbar=no,menubar=no"
              )
            }}
          >
            <KeyRound className="h-3 w-3 mr-1" />
            Connect Vault
          </Badge>
        )}
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="flex flex-col gap-4">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          {messages.length === 0 && !error && (
            <p className="text-sm text-muted-foreground">Loading conversation...</p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {isToolPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>Narrator is querying the secure vault...</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-border/50 bg-secondary/20">
        <div className="flex gap-2">
          <Input
            placeholder="Ask the Narrator for financial insights..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                void sendMessage()
              }
            }}
            className="flex-1 bg-background border-border/50 focus-visible:ring-primary/50"
          />
          <Button
            onClick={() => {
              void sendMessage()
            }}
            disabled={isSending}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          All communications are encrypted and logged for compliance
        </p>
      </div>
    </div>
  )
}
