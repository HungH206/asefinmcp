"use client"

import { 
  KeyRound, 
  Fingerprint, 
  BarChart3, 
  FileText, 
  CheckCircle2,
  Clock,
  Shield
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface AuditEntry {
  id: string
  action: string
  status: "success" | "pending" | "denied"
  timestamp: string
  actor: string
  icon: React.ReactNode
}

const auditEntries: AuditEntry[] = [
  {
    id: "1",
    action: "Token Requested from Vault",
    status: "success",
    timestamp: "09:16:42 AM",
    actor: "Narrator Agent",
    icon: <KeyRound className="h-4 w-4" />,
  },
  {
    id: "2",
    action: "MFA Verification Completed",
    status: "success",
    timestamp: "09:15:18 AM",
    actor: "John Doe",
    icon: <Fingerprint className="h-4 w-4" />,
  },
  {
    id: "3",
    action: "Market Data Fetched via MCP",
    status: "success",
    timestamp: "09:14:55 AM",
    actor: "Market Feed Service",
    icon: <BarChart3 className="h-4 w-4" />,
  },
  {
    id: "4",
    action: "Portfolio Analysis Generated",
    status: "success",
    timestamp: "09:14:23 AM",
    actor: "Narrator Agent",
    icon: <FileText className="h-4 w-4" />,
  },
  {
    id: "5",
    action: "Session Authenticated via Auth0",
    status: "success",
    timestamp: "09:00:12 AM",
    actor: "John Doe",
    icon: <Shield className="h-4 w-4" />,
  },
]

function StatusBadge({ status }: { status: AuditEntry["status"] }) {
  const variants = {
    success: "bg-primary/10 text-primary border-primary/20",
    pending: "bg-warning/10 text-warning border-warning/20",
    denied: "bg-destructive/10 text-destructive border-destructive/20",
  }

  const labels = {
    success: "Success",
    pending: "Pending",
    denied: "Denied",
  }

  return (
    <Badge className={`${variants[status]} text-xs font-medium`}>
      {status === "success" && <CheckCircle2 className="h-3 w-3 mr-1" />}
      {labels[status]}
    </Badge>
  )
}

export function AuditLog() {
  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Audit Log
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            <Clock className="h-3 w-3 mr-1" />
            Real-time
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="rounded-lg border border-border/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                <TableHead className="text-xs font-semibold text-muted-foreground">Action</TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground">Status</TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground">Actor</TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground text-right">Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditEntries.map((entry) => (
                <TableRow key={entry.id} className="hover:bg-secondary/30">
                  <TableCell className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary border border-border/50">
                        {entry.icon}
                      </div>
                      <span className="text-sm font-medium">{entry.action}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={entry.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {entry.actor}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground text-right font-mono">
                    {entry.timestamp}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-3">
          Showing last 5 entries • Full audit trail available in compliance dashboard
        </p>
      </CardContent>
    </Card>
  )
}
