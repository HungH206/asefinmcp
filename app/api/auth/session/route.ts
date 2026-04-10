import { NextRequest, NextResponse } from "next/server"

const MFA_COOKIE = "vault_mfa_verified_at"
const STEPUP_MISSING_MFA_COOKIE = "vault_stepup_missing_mfa"
const MFA_TTL_SECONDS = 5 * 60

export async function GET(req: NextRequest) {
  const rawSession = req.cookies.get("vault_session")?.value
  const rawRefreshToken = req.cookies.get("vault_refresh_token")?.value
  const rawMfaVerifiedAt = req.cookies.get(MFA_COOKIE)?.value
  const stepUpMissingMfa = req.cookies.get(STEPUP_MISSING_MFA_COOKIE)?.value === "1"
  const responseInit = { headers: { "Cache-Control": "no-store" } }
  const nowEpoch = Math.floor(Date.now() / 1000)
  const mfaVerifiedAt = Number(rawMfaVerifiedAt)
  const hasRecentMfaProof = Number.isFinite(mfaVerifiedAt) && nowEpoch - mfaVerifiedAt <= MFA_TTL_SECONDS
  const mfaVerifiedUntil = hasRecentMfaProof ? mfaVerifiedAt + MFA_TTL_SECONDS : null

  if (!rawSession && !rawRefreshToken) {
    return NextResponse.json({ authenticated: false, hasMfaProof: false, mfaVerifiedUntil: null, stepUpMissingMfa: false }, responseInit)
  }

  try {
    const session = rawSession
      ? JSON.parse(rawSession) as { access_token?: string; expires_in?: number; token_type?: string }
      : null

    if (session && !session.access_token && !rawRefreshToken) {
      return NextResponse.json({ authenticated: false, hasMfaProof: false, mfaVerifiedUntil: null, stepUpMissingMfa: false }, responseInit)
    }

    return NextResponse.json({
      authenticated: Boolean(rawRefreshToken),
      tokenType: session?.token_type ?? "Bearer",
      // Never expose the raw token to the client — just confirm it exists
      hasAccessToken: Boolean(session?.access_token),
      hasRefreshToken: Boolean(rawRefreshToken),
      hasMfaProof: hasRecentMfaProof,
      mfaVerifiedUntil,
      stepUpMissingMfa,
    }, responseInit)
  } catch {
    return NextResponse.json({
      authenticated: Boolean(rawRefreshToken),
      hasAccessToken: false,
      hasRefreshToken: Boolean(rawRefreshToken),
      hasMfaProof: hasRecentMfaProof,
      mfaVerifiedUntil,
      stepUpMissingMfa,
    }, responseInit)
  }
}

// Allow clearing the session
export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.set("vault_session", "", { maxAge: 0, path: "/" })
  response.cookies.set("vault_refresh_token", "", { maxAge: 0, path: "/" })
  response.cookies.set(MFA_COOKIE, "", { maxAge: 0, path: "/" })
  response.cookies.set(STEPUP_MISSING_MFA_COOKIE, "", { maxAge: 0, path: "/" })
  return response
}
