import { NextRequest, NextResponse } from "next/server"

function resolveBaseUrl(req: NextRequest) {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim()
  const requestOrigin = new URL(req.url).origin
  const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(requestOrigin)

  if (isLocalhost) {
    return requestOrigin
  }

  return configuredBaseUrl || requestOrigin
}

const MFA_COOKIE = "vault_mfa_verified_at"
const STEPUP_MISSING_MFA_COOKIE = "vault_stepup_missing_mfa"
const CONNECT_SESSION_COOKIE = "vault_connect_auth_session"
const MFA_TTL_SECONDS = 5 * 60

type MyAccountTokenResult = {
  accessToken: string
  tokenType: string
  authorizationHeader: string
}

type CallbackState = {
  returnTo: string
  popup: boolean
  stepUp: boolean
}

type IdTokenClaims = {
  amr?: string[]
  auth_time?: number
  email?: string
  preferred_username?: string
  sub?: string
}

function parseState(rawState: string | null): CallbackState {
  if (!rawState) return { returnTo: "/", popup: false, stepUp: false }

  try {
    const decoded = Buffer.from(rawState, "base64url").toString("utf8")
    const parsed = JSON.parse(decoded) as Partial<CallbackState>
    return {
      returnTo: typeof parsed.returnTo === "string" && parsed.returnTo.length > 0 ? parsed.returnTo : "/",
      popup: parsed.popup === true,
      stepUp: parsed.stepUp === true,
    }
  } catch {
    return { returnTo: rawState, popup: rawState === "/close", stepUp: false }
  }
}

function parseIdTokenClaims(idToken: unknown): IdTokenClaims | null {
  if (typeof idToken !== "string") return null

  const parts = idToken.split(".")
  if (parts.length < 2) return null

  try {
    const payload = Buffer.from(parts[1], "base64url").toString("utf8")
    return JSON.parse(payload) as IdTokenClaims
  } catch {
    return null
  }
}

async function getMyAccountApiToken(
  domain: string,
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<MyAccountTokenResult> {
  const form = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    audience: `https://${domain}/me/`,
    scope: "openid profile offline_access create:me:connected_accounts read:me:connected_accounts delete:me:connected_accounts",
  })

  const res = await fetch(`https://${domain}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: form,
  })

  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Unable to get My Account API token (${res.status}): ${detail}`)
  }

  const token = (await res.json()) as { access_token?: unknown; token_type?: unknown }
  if (typeof token.access_token !== "string" || token.access_token.trim().length === 0) {
    throw new Error("Missing My Account API access token")
  }

  const tokenTypeRaw = typeof token.token_type === "string" ? token.token_type.trim() : ""
  const tokenType = tokenTypeRaw.length > 0 ? tokenTypeRaw.split(/\s+/)[0] : "Bearer"
  const accessToken = token.access_token.trim()

  return {
    accessToken,
    tokenType,
    authorizationHeader: `${tokenType} ${accessToken}`,
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const connectCode = url.searchParams.get("connect_code")
  const error = url.searchParams.get("error")
  const errorDescription = url.searchParams.get("error_description")
  const state = parseState(url.searchParams.get("state"))

  // Auth0 returned an error (e.g. user denied consent)
  if (error) {
    const dest = new URL("/", req.url)
    dest.searchParams.set("auth_error", errorDescription ?? error)
    return NextResponse.redirect(dest.toString())
  }

  const domain = process.env.AUTH0_DOMAIN
  const clientId = process.env.AUTH0_CLIENT_ID
  const clientSecret = process.env.AUTH0_CLIENT_SECRET
  const baseUrl = resolveBaseUrl(req)

  if (!domain || !clientId || !clientSecret) {
    console.error("Missing Auth0 env vars")
    return NextResponse.redirect(new URL("/", req.url).toString())
  }

  // Connected Accounts flow callback (My Account API)
  if (connectCode) {
    const refreshToken = req.cookies.get("vault_refresh_token")?.value
    const authSession = req.cookies.get(CONNECT_SESSION_COOKIE)?.value
    if (!refreshToken || !authSession) {
      const dest = new URL("/", req.url)
      dest.searchParams.set("auth_error", "Missing connected account session context")
      return NextResponse.redirect(dest.toString())
    }

    try {
      const myAccountToken = await getMyAccountApiToken(domain, clientId, clientSecret, refreshToken)
      const completeRes = await fetch(`https://${domain}/me/v1/connected-accounts/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: myAccountToken.authorizationHeader,
        },
        body: JSON.stringify({
          auth_session: authSession,
          connect_code: connectCode,
          redirect_uri: `${baseUrl}/auth/callback`,
        }),
      })

      if (!completeRes.ok) {
        const detail = await completeRes.text()
        const dest = new URL("/", req.url)
        dest.searchParams.set("auth_error", `Connected account completion failed: ${detail}`)
        return NextResponse.redirect(dest.toString())
      }
    } catch (err) {
      const dest = new URL("/", req.url)
      dest.searchParams.set("auth_error", err instanceof Error ? err.message : "Connected account completion failed")
      return NextResponse.redirect(dest.toString())
    }

    const isPopupConnect = state.popup || state.returnTo === "/close"
    const redirectTarget = isPopupConnect ? `${baseUrl}/close` : state.returnTo
    const response = NextResponse.redirect(redirectTarget)
    response.cookies.set(CONNECT_SESSION_COOKIE, "", { maxAge: 0, path: "/" })
    return response
  }

  if (!code) {
    return NextResponse.json({ error: "Missing authorization code" }, { status: 400 })
  }

  const tokenRes = await fetch(`https://${domain}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: `${baseUrl}/auth/callback`,
    }),
  })

  if (!tokenRes.ok) {
    console.error("Token exchange failed", await tokenRes.text())
    return NextResponse.redirect(new URL("/", req.url).toString())
  }

  const tokenData = (await tokenRes.json()) as Record<string, unknown>
  const idTokenClaims = parseIdTokenClaims(tokenData.id_token)
  const hasMfaClaim = Array.isArray(idTokenClaims?.amr)
    ? idTokenClaims.amr.some((method) => method.toLowerCase() === "mfa")
    : false
  const loginHint = idTokenClaims?.email ?? idTokenClaims?.preferred_username ?? idTokenClaims?.sub

  // Popup mode: redirect to /close so the popup window closes itself
  const isPopup = state.popup || state.returnTo === "/close" || url.searchParams.get("popup") === "1"
  const redirectTarget = isPopup ? `${baseUrl}/close` : state.returnTo

  const response = NextResponse.redirect(redirectTarget)

  // Store the full token response — we need refresh_token for Token Vault exchange
  response.cookies.set("vault_session", JSON.stringify(tokenData), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  })

  // Store refresh_token separately for easy access in Token Vault calls
  if (tokenData.refresh_token) {
    response.cookies.set("vault_refresh_token", String(tokenData.refresh_token), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })
  }

  if (loginHint) {
    response.cookies.set("vault_login_hint", String(loginHint), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    })
  }

  // Keep a short-lived proof that Auth0 returned an MFA method in the latest id_token.
  if (hasMfaClaim) {
    const verifiedAt = typeof idTokenClaims?.auth_time === "number"
      ? idTokenClaims.auth_time
      : Math.floor(Date.now() / 1000)

    response.cookies.set(MFA_COOKIE, String(verifiedAt), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: MFA_TTL_SECONDS,
    })
    response.cookies.set(STEPUP_MISSING_MFA_COOKIE, "", { maxAge: 0, path: "/" })
  } else if (state.stepUp) {
    response.cookies.set(MFA_COOKIE, "", { maxAge: 0, path: "/" })
    response.cookies.set(STEPUP_MISSING_MFA_COOKIE, "1", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: MFA_TTL_SECONDS,
    })
  } else {
    response.cookies.set(STEPUP_MISSING_MFA_COOKIE, "", { maxAge: 0, path: "/" })
  }

  return response
}
