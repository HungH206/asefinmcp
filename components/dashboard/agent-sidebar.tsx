"use client"

import { 
  KeyRound, 
  Server, 
  Activity, 
  Clock, 
  Fingerprint,
  ShieldCheck,
  Database
} from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface StatusIndicatorProps {
  label: string
  status: "online" | "offline" | "warning"
  icon: React.ReactNode
  detail?: string
}

function StatusIndicator({ label, status, icon, detail }: StatusIndicatorProps) {
  const statusColors = {
    online: "bg-primary text-primary",
    offline: "bg-destructive text-destructive",
    warning: "bg-warning text-warning",
  }

  const statusLabels = {
    online: "Connected",
    offline: "Disconnected",
    warning: "Degraded",
  }

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50 border border-border/50">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-background border border-border">
        {icon}
      </div>
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`h-2 w-2 rounded-full ${statusColors[status]} ${status === "online" ? "animate-pulse" : ""}`} />
          <span className="text-xs text-muted-foreground">{statusLabels[status]}</span>
        </div>
        {detail && (
          <span className="text-xs text-muted-foreground mt-0.5">{detail}</span>
        )}
      </div>
    </div>
  )
}

export function AgentSidebar() {
  return (
    <aside className="w-72 border-r border-border/50 bg-sidebar p-4 flex flex-col gap-6">
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
          System Status
        </h2>
        <div className="flex flex-col gap-2">
          <StatusIndicator
            label="Token Vault"
            status="online"
            icon={<KeyRound className="h-4 w-4 text-primary" />}
            detail="AES-256 Encrypted"
          />
          <StatusIndicator
            label="MCP Server"
            status="online"
            icon={<Server className="h-4 w-4 text-accent" />}
            detail="v2.4.1 • 23ms latency"
          />
        </div>
      </div>

      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
          Security Modules
        </h2>
        <div className="flex flex-col gap-2">
          <StatusIndicator
            label="MFA Provider"
            status="online"
            icon={<Fingerprint className="h-4 w-4 text-primary" />}
            detail="Auth0 • TOTP Ready"
          />
          <StatusIndicator
            label="Guardrail Engine"
            status="online"
            icon={<ShieldCheck className="h-4 w-4 text-primary" />}
            detail="Policy v3.2 Active"
          />
        </div>
      </div>

      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
          Data Connections
        </h2>
        <div className="flex flex-col gap-2">
          <StatusIndicator
            label="Market Feed"
            status="online"
            icon={<Activity className="h-4 w-4 text-chart-3" />}
            detail="Real-time • 145 symbols"
          />
          <StatusIndicator
            label="Secure Store"
            status="online"
            icon={<Database className="h-4 w-4 text-accent" />}
            detail="PostgreSQL • Encrypted"
          />
        </div>
      </div>

      <div className="mt-auto pt-4 border-t border-border/50">
        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
          <Clock className="h-3.5 w-3.5" />
          <span>Last sync: 2 seconds ago</span>
        </div>
        <Badge variant="outline" className="mt-3 w-full justify-center border-primary/20 text-primary/80 text-xs">
          Session Expires in 28:45
        </Badge>
      </div>
    </aside>
  )
}
