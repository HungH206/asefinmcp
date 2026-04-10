"use client"

import { useEffect, useState } from "react"

interface VaultSession {
  authenticated: boolean
  hasAccessToken?: boolean
  hasRefreshToken?: boolean
  hasMfaProof?: boolean
  stepUpMissingMfa?: boolean
  mfaVerifiedUntil?: number | null
  tokenType?: string
}

export function useVaultSession() {
  const [session, setSession] = useState<VaultSession>({ authenticated: false })

  useEffect(() => {
    let mounted = true

    const check = async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" })
        if (res.ok && mounted) {
          const data = (await res.json()) as VaultSession
          setSession(data)
        }
      } catch {
        // silently ignore — session just stays unauthenticated
      }
    }

    void check()
    const interval = setInterval(() => { void check() }, 10000)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  const signOut = async () => {
    await fetch("/api/auth/session", { method: "DELETE", cache: "no-store" })
    setSession({ authenticated: false })
  }

  return { session, signOut }
}
