"use client"

import { useEffect, useState } from "react"
import { Bot, User, Send, Sparkles, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import type { ChatMessageData, ChatResponse } from "@/lib/backend/types"
import { callAsefinTool } from "@/lib/backend/mcp-client" // Ensure this path exists

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

export function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessageData[]>([])
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        toolCall?: { name: string; args?: unknown }
      }

      // 2. CHECK FOR TOOL CALLS: If the AI wants to use an MCP Tool (e.g., get_balance)
      if (data.toolCall) {
        try {
          const toolResult = (await callAsefinTool(data.toolCall.name, data.toolCall.args)) as {
            result?: string
          }

          // Add the tool result to your message state
          setMessages((current) => [
            ...current,
            data.userMessage,
            {
              id: Date.now().toString(),
              role: "agent",
              content: `Analysis Complete: ${toolResult.result ?? "No result returned"}`,
              metadata: { source: "ASEFIN Vault", confidence: 98 },
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ])
        } catch (err: unknown) {
          // 3. STEP-UP AUTH TRIGGER: If the tool returns 401/MFA required
          if (err instanceof Error && err.message === "MFA_REQUIRED") {
            setError("Action Blocked: Please complete MFA verification.")
            // Trigger your Auth0 MFA popup here
          } else {
            setError("Tool call failed")
          }
        }
      } else {
        setMessages((current) => [...current, data.userMessage, data.agentMessage])
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
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-secondary/30">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">The Narrator</h3>
            <p className="text-xs text-muted-foreground">AI Financial Intelligence Agent</p>
          </div>
        </div>
        <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
          <div className="h-1.5 w-1.5 rounded-full bg-primary mr-1.5 animate-pulse" />
          Active
        </Badge>
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
