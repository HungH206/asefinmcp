"use client"

import { useState } from "react"
import { Header } from "@/components/dashboard/header"
import { GlassyNav, type TabId } from "@/components/dashboard/glassy-nav"
import { ChatInterface } from "@/components/dashboard/chat-interface"
import { FinancialCards } from "@/components/dashboard/financial-cards"
import { SecurityGuardrail, SecurityGuardrailTrigger } from "@/components/dashboard/security-guardrail"
import { AuditLog } from "@/components/dashboard/audit-log"
import { StatusFooter } from "@/components/dashboard/status-footer"

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabId>("market")
  const [isGuardrailOpen, setIsGuardrailOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
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
                <ChatInterface />
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
        onVerify={() => setIsGuardrailOpen(false)}
      />
    </div>
  )
}
