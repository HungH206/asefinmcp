"use client"

import { useState } from "react"
import { Bot, User, Send, Sparkles, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"

interface Message {
  id: string
  role: "user" | "agent"
  content: string
  timestamp: string
  metadata?: {
    source?: string
    confidence?: number
    action?: string
  }
}

const initialMessages: Message[] = [
  {
    id: "1",
    role: "agent",
    content: "Good morning. I&apos;ve completed my initial analysis of your portfolio. Your current exposure shows strong performance in tech equities, but I&apos;ve identified some volatility concerns in your emerging market positions.",
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
    content: "Your AAPL position currently represents 12.4% of your portfolio with an unrealized gain of +23.7% since acquisition. Based on current market conditions and your risk profile, I recommend maintaining your position but setting a trailing stop-loss at 8% below current price to protect gains.",
    timestamp: "09:15 AM",
    metadata: {
      source: "Risk Assessment Module",
      confidence: 89,
    },
  },
  {
    id: "4",
    role: "user",
    content: "Generate a detailed performance report and email it to my accountant.",
    timestamp: "09:16 AM",
  },
  {
    id: "5",
    role: "agent",
    content: "I can prepare the performance report. However, sending it via email requires additional verification as this is classified as a high-stakes action involving external data transmission. Please complete MFA verification to proceed.",
    timestamp: "09:16 AM",
    metadata: {
      action: "high-stakes",
    },
  },
]

function MessageBubble({ message }: { message: Message }) {
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
  const [messages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState("")

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
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-border/50 bg-secondary/20">
        <div className="flex gap-2">
          <Input
            placeholder="Ask the Narrator for financial insights..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 bg-background border-border/50 focus-visible:ring-primary/50"
          />
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
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
