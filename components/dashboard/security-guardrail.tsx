"use client"

import { useState } from "react"
import { 
  ShieldAlert, 
  Mail, 
  Fingerprint, 
  X, 
  AlertTriangle,
  Lock,
  CheckCircle2,
  Loader2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

interface SecurityGuardrailProps {
  isOpen: boolean
  onClose: () => void
  onVerify: () => void
}

export function SecurityGuardrail({ isOpen, onClose, onVerify }: SecurityGuardrailProps) {
  const [isVerifying, setIsVerifying] = useState(false)
  const [isVerified, setIsVerified] = useState(false)

  const handleVerify = () => {
    setIsVerifying(true)
    setTimeout(() => {
      setIsVerifying(false)
      setIsVerified(true)
      setTimeout(() => {
        onVerify()
      }, 1500)
    }, 2000)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      
      <Card className="relative z-10 w-full max-w-lg mx-4 border-warning/50 bg-card shadow-2xl shadow-warning/10">
        <CardHeader className="relative pb-4">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 h-8 w-8"
            onClick={onClose}
          >
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
              <h2 className="text-xl font-semibold tracking-tight">
                Step-up Authentication Required
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                This action requires additional verification to proceed
              </p>
            </div>
          </div>
        </CardHeader>

        <Separator />

        <CardContent className="pt-6">
          <div className="rounded-lg bg-secondary/50 border border-border/50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 border border-accent/20">
                <Mail className="h-5 w-5 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium">Requested Action</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Email Performance Report to External Recipient
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

          <div className="mt-4 p-4 rounded-lg border border-border/50 bg-background">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Action Details
            </h4>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Recipient</dt>
                <dd className="font-medium">accountant@trustedpartner.com</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Document Type</dt>
                <dd className="font-medium">Q4 Performance Report</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Data Classification</dt>
                <dd className="font-medium text-warning">Confidential</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Requested By</dt>
                <dd className="font-medium">Narrator Agent</dd>
              </div>
            </dl>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 pt-2">
          {isVerified ? (
            <div className="w-full flex items-center justify-center gap-2 py-4 text-primary">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Verification Successful</span>
            </div>
          ) : (
            <>
              <Button 
                className="w-full h-12 bg-warning text-warning-foreground hover:bg-warning/90"
                onClick={handleVerify}
                disabled={isVerifying}
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verifying Identity...
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
                onClick={onClose}
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
              <Badge className="bg-warning/10 text-warning border-warning/30 text-xs">
                Action Required
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Email Report to accountant@trustedpartner.com
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
