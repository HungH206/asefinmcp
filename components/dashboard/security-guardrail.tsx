/* eslint-disable react-hooks/set-state-in-effect */
"use client"

import { useEffect, useState } from "react"
import {
  ShieldAlert,
  Mail,
  Fingerprint,
  X,
  AlertTriangle,
  Lock,
  CheckCircle2,
  Loader2,
  Send,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

const REQUIRE_MFA_FOR_EMAIL_REPORTS = process.env.NEXT_PUBLIC_REQUIRE_MFA_FOR_REPORTS === "true"

export interface GuardrailActionContext {
  action: string
  recipient?: string
  docType?: string
  requestedBy?: string
  toolName?: string
  toolArgs?: Record<string, unknown>
}

interface SecurityGuardrailProps {
  isOpen: boolean
  onClose: () => void
  onVerify: (ctx: GuardrailActionContext | undefined) => void
  onDeny?: (ctx: GuardrailActionContext | undefined) => void
  actionContext?: GuardrailActionContext
}

export function SecurityGuardrail({ isOpen, onClose, onVerify, onDeny, actionContext }: SecurityGuardrailProps) {
  const [isVerifying, setIsVerifying] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [recipient, setRecipient] = useState("")
  const [verifyError, setVerifyError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setIsVerifying(false)
      setIsVerified(false)
      setRecipient(actionContext?.recipient ?? "")
      setVerifyError(null)
    }
  }, [isOpen, actionContext])

  const handleVerify = async () => {
    setVerifyError(null)
    setIsVerifying(true)

    if (!REQUIRE_MFA_FOR_EMAIL_REPORTS) {
      setTimeout(() => {
        setIsVerifying(false)
        setIsVerified(true)
        setTimeout(() => {
          onVerify({ ...(actionContext ?? { action: "Action" }), recipient: recipient || actionContext?.recipient })
        }, 300)
      }, 400)
      return
    }

    const search = new URLSearchParams({
      connection: "google-oauth2",
      scopes: "https://www.googleapis.com/auth/gmail.send",
      returnTo: "/close",
      popup: "1",
      stepUp: "1",
      prompt: "login",
      max_age: "0",
      acr_values: "http://schemas.openid.net/pape/policies/2007/06/multi-factor",
    })

    const authUrl = `/auth/connect?${search.toString()}`
    const popup = window.open(
      authUrl,
      "_blank",
      "width=800,height=650,status=no,toolbar=no,menubar=no"
    )

    if (!popup) {
      setIsVerifying(false)
      setVerifyError("Popup was blocked. Please allow popups and try again.")
      return
    }

    const waitForStepUpResult = async () => {
      while (!popup.closed) {
        await new Promise((resolve) => setTimeout(resolve, 750))
      }

      const sessionRes = await fetch("/api/auth/session", { cache: "no-store" })
      if (!sessionRes.ok) {
        throw new Error("Unable to confirm MFA status")
      }

      const session = (await sessionRes.json()) as { hasMfaProof?: boolean; stepUpMissingMfa?: boolean }
      if (!session.hasMfaProof) {
        if (session.stepUpMissingMfa) {
          throw new Error("Auth0 login succeeded, but MFA was not enforced by tenant policy (missing amr:mfa)")
        }
        throw new Error("MFA step-up was not completed")
      }
    }

    try {
      await waitForStepUpResult()
      setIsVerifying(false)
      setIsVerified(true)
      setTimeout(() => {
        onVerify({ ...(actionContext ?? { action: "Action" }), recipient: recipient || actionContext?.recipient })
      }, 600)
    } catch (err) {
      setIsVerifying(false)
      setIsVerified(false)
      setVerifyError(err instanceof Error ? err.message : "Verification failed")
    }
  }

  const handleDeny = () => {
    onDeny?.(actionContext)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />

      <Card className="relative z-10 w-full max-w-lg mx-4 border-warning/50 bg-card shadow-2xl shadow-warning/10">
        <CardHeader className="relative pb-4">
          <Button variant="ghost" size="icon" className="absolute right-4 top-4 h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>

          <div className="flex flex-col items-center text-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-warning/10 border-2 border-warning/30">
              <ShieldAlert className="h-8 w-8 text-warning" />
            </div>
            <div>
              <Badge className="mb-2 bg-warning/10 text-warning border-warning/30 hover:bg-warning/20">
                <AlertTriangle className="h-3 w-3 mr-1" />
                High-Stakes Action
              </Badge>
              <h2 className="text-xl font-semibold tracking-tight">Step-up Authentication Required</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {REQUIRE_MFA_FOR_EMAIL_REPORTS
                  ? "This action requires additional verification to proceed"
                  : "Review and approve this action to proceed"}
              </p>
            </div>
          </div>
        </CardHeader>

        <Separator />

        <CardContent className="pt-6 space-y-4">
          {/* Action summary */}
          <div className="rounded-lg bg-secondary/50 border border-border/50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 border border-accent/20">
                <Mail className="h-5 w-5 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium">Requested Action</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {actionContext?.action ?? "Email Performance Report to External Recipient"}
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Badge variant="outline" className="text-xs">
                    <Lock className="h-3 w-3 mr-1" />
                    External Transmission
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Contains Financial Data
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Recipient input — judges can enter their own email */}
          <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-2">
              <Send className="h-3 w-3" />
              Send Report To
            </label>
            <Input
              type="email"
              placeholder="Enter recipient email..."
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="bg-background border-border/50 text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              Judges: enter your email to receive a live EOD stock report
            </p>
          </div>

          {/* Action details */}
          <div className="p-4 rounded-lg border border-border/50 bg-background">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Action Details
            </h4>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Recipient</dt>
                <dd className="font-medium">{recipient || actionContext?.recipient || "accountant@trustedpartner.com"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Document Type</dt>
                <dd className="font-medium">{actionContext?.docType ?? "EOD Portfolio Report"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Data Classification</dt>
                <dd className="font-medium text-warning">Confidential</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Requested By</dt>
                <dd className="font-medium">{actionContext?.requestedBy ?? "Narrator Agent"}</dd>
              </div>
            </dl>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 pt-2">
          {isVerified ? (
            <div className="w-full flex items-center justify-center gap-2 py-4 text-primary">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Verification Successful — Sending Report...</span>
            </div>
          ) : (
            <>
              {verifyError && (
                <p className="w-full rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {verifyError}
                </p>
              )}
              <Button
                className="w-full h-12 bg-warning text-warning-foreground hover:bg-warning/90"
                onClick={handleVerify}
                disabled={isVerifying}
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Waiting for Auth0 MFA...
                  </>
                ) : (
                  <>
                    <Fingerprint className="h-4 w-4 mr-2" />
                    Verify with MFA
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={handleDeny}
                disabled={isVerifying}
              >
                Cancel Action
              </Button>
            </>
          )}
          <p className="text-xs text-center text-muted-foreground">
            This action will be recorded in the compliance audit log
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}

export function SecurityGuardrailTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <Card className="bg-warning/5 border-warning/30 hover:border-warning/50 transition-colors cursor-pointer" onClick={onOpen}>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-warning/10 border border-warning/20">
            <ShieldAlert className="h-6 w-6 text-warning" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Pending Authorization</h3>
              <Badge className="bg-warning/10 text-warning border-warning/30 text-xs">Action Required</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Email EOD Report — click to authorize
            </p>
          </div>
          <Button variant="outline" className="border-warning/50 text-warning hover:bg-warning/10">
            <Fingerprint className="h-4 w-4 mr-2" />
            Verify
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
