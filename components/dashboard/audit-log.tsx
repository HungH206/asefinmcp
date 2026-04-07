"use client"

import { useEffect, useRef, useState } from "react"
import {
  KeyRound,
  Fingerprint,
  BarChart3,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { AuditEntryData } from "@/lib/backend/types"
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

function auditIcon(eventType: AuditEntryData["eventType"]): React.ReactNode {
  switch (eventType) {
    case "vault":
      return <KeyRound className="h-4 w-4" />
    case "mfa":
      return <Fingerprint className="h-4 w-4" />
    case "market":
      return <BarChart3 className="h-4 w-4" />
    case "report":
      return <FileText className="h-4 w-4" />
    case "auth":
      return <Shield className="h-4 w-4" />
  }
}

function StatusBadge({ status }: { status: AuditEntry["status"] }) {
  const variants = {
    success: "bg-primary/10 text-primary border-primary/20",
    pending: "bg-warning/10 text-warning border-warning/20",
    denied: "bg-destructive/10 text-destructive border-destructive/20",
  }
  const labels = { success: "Success", pending: "Pending", denied: "Denied" }

  return (
    <Badge className={`${variants[status]} text-xs font-medium`}>
      {status === "success" && <CheckCircle2 className="h-3 w-3 mr-1" />}
      {status === "denied" && <XCircle className="h-3 w-3 mr-1" />}
      {labels[status]}
    </Badge>
  )
}

export function AuditLog() {
  const [entries, setEntries] = useState<AuditEntryData[]>([])
  const [error, setError] = useState<string | null>(null)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const prevIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    let mounted = true

    const loadEntries = async () => {
      try {
        const response = await fetch("/api/audit")
        if (!response.ok) throw new Error("Failed to fetch audit logs")
        const data = (await response.json()) as { entries: AuditEntryData[] }
        if (!mounted) return

        const incoming = data.entries
        const fresh = incoming.filter((e) => !prevIdsRef.current.has(e.id)).map((e) => e.id)

        if (fresh.length > 0) {
          setNewIds(new Set(fresh))
          setTimeout(() => setNewIds(new Set()), 2000)
        }

        prevIdsRef.current = new Set(incoming.map((e) => e.id))
        setEntries(incoming)
      } catch {
        if (mounted) setError("Could not load audit logs")
      }
    }

    void loadEntries()
    const interval = setInterval(() => { void loadEntries() }, 3000)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

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
              {entries.map((entry) => (
                <TableRow
                  key={entry.id}
                  className={`hover:bg-secondary/30 transition-colors duration-500 ${
                    newIds.has(entry.id) ? "bg-primary/5" : ""
                  }`}
                >
                  <TableCell className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary border border-border/50">
                        {auditIcon(entry.eventType)}
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
              {entries.length === 0 && !error && (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                    Loading audit logs...
                  </TableCell>
                </TableRow>
              )}
              {error && (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-sm text-destructive">
                    {error}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-3">
          Showing {entries.length} {entries.length === 1 ? "entry" : "entries"} • Updates every 3s
        </p>
      </CardContent>
    </Card>
  )
}
