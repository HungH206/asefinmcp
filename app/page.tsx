"use client"

import { useState } from "react"
import { X, Sparkles } from "lucide-react"
import { Header } from "@/components/dashboard/header"
import { GlassyNav, type TabId } from "@/components/dashboard/glassy-nav"
import { ChatInterface } from "@/components/dashboard/chat-interface"
import { FinancialCards } from "@/components/dashboard/financial-cards"
import { StockChart } from "@/components/dashboard/stock-chart"
import { SecurityGuardrail, SecurityGuardrailTrigger, type GuardrailActionContext } from "@/components/dashboard/security-guardrail"
import { AuditLog } from "@/components/dashboard/audit-log"
import { StatusFooter } from "@/components/dashboard/status-footer"

export default function Dashboard() {
  const [showHint, setShowHint] = useState(true)
  const [activeTab, setActiveTab] = useState<TabId>("market")
  const [isGuardrailOpen, setIsGuardrailOpen] = useState(false)
  const [guardrailContext, setGuardrailContext] = useState<GuardrailActionContext | undefined>()

  const postAuditEntry = (entry: { action: string; status: "success" | "pending" | "denied"; actor: string; eventType: "vault" | "mfa" | "market" | "report" | "auth" }) => {
    void fetch("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    })
  }

  const handleHighStakes = (ctx: GuardrailActionContext) => {
    setGuardrailContext({
      ...ctx,
      toolName: "send_eod_report",
      toolArgs: { recipient: ctx.recipient ?? "accountant@trustedpartner.com" },
    })
    setIsGuardrailOpen(true)
    postAuditEntry({ action: "High-Stakes Action Intercepted", status: "pending", actor: "Guardrail Engine", eventType: "vault" })
  }

  const handleVerify = (ctx: GuardrailActionContext | undefined) => {
    setIsGuardrailOpen(false)
    postAuditEntry({ action: "MFA Verification Completed", status: "success", actor: "John Doe", eventType: "mfa" })
    postAuditEntry({ action: ctx?.action ?? "Action Authorized", status: "success", actor: "Narrator Agent", eventType: "report" })

    // Actually execute the tool after MFA passes
    const recipient = ctx?.recipient ?? "accountant@trustedpartner.com"
    void fetch("/api/mcp/tools/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "send_eod_report", arguments: { recipient } }),
    }).then(async (res) => {
      const data = await res.json() as { result?: { status?: string; message?: string } }
      const msg = data.result?.message ?? "Report sent."
      postAuditEntry({ action: msg.slice(0, 80), status: "success", actor: "Narrator Agent", eventType: "report" })
    }).catch(() => {
      postAuditEntry({ action: "EOD Report delivery failed", status: "denied", actor: "Narrator Agent", eventType: "report" })
    })

    setActiveTab("audit")
  }

  const handleDeny = (ctx: GuardrailActionContext | undefined) => {
    postAuditEntry({ action: ctx?.action ?? "Action Denied by User", status: "denied", actor: "John Doe", eventType: "auth" })
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      {showHint && (
        <div className="bg-primary/5 border-b border-primary/20 px-6 py-2.5">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <span className="text-muted-foreground">Try the demo:</span>
              <span>
                Go to <button onClick={() => setActiveTab("narrator")} className="text-primary font-medium hover:underline">The Narrator</button> and type{" "}
                <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">AAPL price</code>,{" "}
                <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">analyze my portfolio</code>, or{" "}
                <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">send report to accountant</code>
              </span>
            </div>
            <button onClick={() => setShowHint(false)} className="text-muted-foreground hover:text-foreground shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      
      <GlassyNav activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="flex-1 px-6 pb-6 overflow-auto">
        <div className="max-w-7xl mx-auto">
          {/* Live Market Data Tab */}
          {activeTab === "market" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div>
                <h2 className="text-xl font-semibold mb-1">Live Market Data</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Real-time financial insights fetched via MCP integration
                </p>
              </div>
              
              <FinancialCards />

              <StockChart />
              
              <SecurityGuardrailTrigger onOpen={() => setIsGuardrailOpen(true)} />
            </div>
          )}

          {/* The Narrator Tab */}
          {activeTab === "narrator" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div>
                <h2 className="text-xl font-semibold mb-1">The Narrator</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Your AI financial intelligence agent with security guardrails
                </p>
              </div>
              
              <div className="h-[600px]">
                <ChatInterface onHighStakes={handleHighStakes} />
              </div>
            </div>
          )}

          {/* Compliance & Audit Tab */}
          {activeTab === "audit" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div>
                <h2 className="text-xl font-semibold mb-1">Compliance & Audit</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Real-time security event monitoring and audit trail
                </p>
              </div>
              
              <AuditLog />
            </div>
          )}
        </div>
      </main>

      <StatusFooter />

      {/* Security Guardrail Modal */}
      <SecurityGuardrail 
        isOpen={isGuardrailOpen}
        onClose={() => setIsGuardrailOpen(false)}
        onVerify={handleVerify}
        onDeny={handleDeny}
        actionContext={guardrailContext}
      />
    </div>
  )
}
