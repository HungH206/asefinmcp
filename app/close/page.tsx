"use client"

import { useEffect } from "react"
import { CheckCircle2 } from "lucide-react"

export default function ClosePage() {
  useEffect(() => {
    // Signal the opener that auth is complete, then close
    if (window.opener) {
      window.close()
    }
  }, [])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-center">
        <CheckCircle2 className="h-10 w-10 text-primary" />
        <h2 className="text-lg font-semibold">Authorization Complete</h2>
        <p className="text-sm text-muted-foreground">You can close this window.</p>
      </div>
    </div>
  )
}
