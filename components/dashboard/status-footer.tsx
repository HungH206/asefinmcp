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

interface StatusItemProps {
  label: string
  status: "online" | "offline" | "warning"
  icon: React.ReactNode
  detail?: string
}

function StatusItem({ label, status, icon, detail }: StatusItemProps) {
  const statusColors = {
    online: "bg-primary",
    offline: "bg-destructive",
    warning: "bg-warning",
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-secondary/30 border border-border/30">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-background/50 border border-border/50">
        {icon}
      </div>
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          <div className={`h-1.5 w-1.5 rounded-full ${statusColors[status]} ${status === "online" ? "animate-pulse" : ""}`} />
        </div>
        {detail && (
          <span className="text-xs text-muted-foreground">{detail}</span>
        )}
      </div>
    </div>
  )
}

export function StatusFooter() {
  return (
    <footer className="border-t border-border/50 bg-sidebar/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 py-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* System Status */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              System Status
            </h3>
            <div className="flex flex-col gap-2">
              <StatusItem
                label="Token Vault"
                status="online"
                icon={<KeyRound className="h-4 w-4 text-primary" />}
                detail="AES-256 Encrypted"
              />
              <StatusItem
                label="MCP Server"
                status="online"
                icon={<Server className="h-4 w-4 text-accent" />}
                detail="v2.4.1 - 23ms latency"
              />
            </div>
          </div>

          {/* Security Modules */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Security Modules
            </h3>
            <div className="flex flex-col gap-2">
              <StatusItem
                label="MFA Provider"
                status="online"
                icon={<Fingerprint className="h-4 w-4 text-primary" />}
                detail="Auth0 - TOTP Ready"
              />
              <StatusItem
                label="Guardrail Engine"
                status="online"
                icon={<ShieldCheck className="h-4 w-4 text-primary" />}
                detail="Policy v3.2 Active"
              />
            </div>
          </div>

          {/* Data Connections */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Data Connections
            </h3>
            <div className="flex flex-col gap-2">
              <StatusItem
                label="Market Feed"
                status="online"
                icon={<Activity className="h-4 w-4 text-chart-3" />}
                detail="Real-time - 145 symbols"
              />
              <StatusItem
                label="Secure Store"
                status="online"
                icon={<Database className="h-4 w-4 text-accent" />}
                detail="PostgreSQL - Encrypted"
              />
            </div>
          </div>
        </div>

        {/* Footer bar */}
        <div className="flex items-center justify-between mt-5 pt-4 border-t border-border/30">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>Last sync: 2 seconds ago</span>
          </div>
          <Badge variant="outline" className="border-primary/20 text-primary/80 text-xs">
            Session Expires in 28:45
          </Badge>
        </div>
      </div>
    </footer>
  )
}
