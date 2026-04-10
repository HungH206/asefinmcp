import { NextRequest, NextResponse } from "next/server"

function resolveBaseUrl(req: NextRequest) {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim()
  const requestOrigin = new URL(req.url).origin
  const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(requestOrigin)

  // In local development, trust the current request origin so callback URLs match localhost.
  if (isLocalhost) {
    return requestOrigin
  }

  return configuredBaseUrl || requestOrigin
}

function buildAuthorizeUrl(opts: {
  domain: string
  clientId: string
  baseUrl: string
  statePayload: string
  scopes: string[]
  connection: string
  prompt: string | null
  maxAge: string | null
  acrValues: string | null
}) {
  const { domain, clientId, baseUrl, statePayload, scopes, connection, prompt, maxAge, acrValues } = opts
  const allScopes = ["openid", "profile", "email", "offline_access"].join(" ")
  const authUrl = new URL(`https://${domain}/authorize`)
  authUrl.searchParams.set("client_id", clientId)
  authUrl.searchParams.set("response_type", "code")
  authUrl.searchParams.set("redirect_uri", `${baseUrl}/auth/callback`)
  authUrl.searchParams.set("scope", allScopes)
  authUrl.searchParams.set("state", statePayload)

  // Provider/API scopes must be passed via connection_scope for social connections.
  const providerScopes = Array.from(new Set(["openid", "profile", "email", ...scopes]))
  if (providerScopes.length > 0) {
    authUrl.searchParams.set("connection_scope", providerScopes.join(","))
  }

  if (prompt) authUrl.searchParams.set("prompt", prompt)
  if (maxAge) authUrl.searchParams.set("max_age", maxAge)
  if (acrValues) authUrl.searchParams.set("acr_values", acrValues)
  if (connection) authUrl.searchParams.set("connection", connection)

  // Google must issue a provider refresh token, otherwise Token Vault exchange fails with
  // federated_connection_refresh_token_not_found.
  if (connection === "google-oauth2") {
    authUrl.searchParams.set("access_type", "offline")
    authUrl.searchParams.set("prompt", "consent")
    authUrl.searchParams.set("include_granted_scopes", "true")
  }

  return authUrl
}


export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const connection = url.searchParams.get("connection") ?? ""
  const scopes = url.searchParams.getAll("scopes")
  const returnTo = url.searchParams.get("returnTo") || "/"
  const popup = url.searchParams.get("popup") === "1"
  const stepUp = url.searchParams.get("stepUp") === "1"
  const resetConnectedAccount = url.searchParams.get("reset_connected_account") === "1"
  const prompt = url.searchParams.get("prompt")
  const maxAge = url.searchParams.get("max_age")
  const acrValues = url.searchParams.get("acr_values")

  const domain = process.env.AUTH0_DOMAIN
  const clientId = process.env.AUTH0_CLIENT_ID
  const baseUrl = resolveBaseUrl(req)

  if (!domain || !clientId) {
    return NextResponse.json({ error: "Auth0 is not configured. Set AUTH0_DOMAIN and AUTH0_CLIENT_ID." }, { status: 503 })
  }

  const statePayload = Buffer.from(
    JSON.stringify({ returnTo, popup, stepUp }),
    "utf8"
  ).toString("base64url")

  // Step-up authentication should still use the regular /authorize flow.
  if (stepUp) {
    const authUrl = buildAuthorizeUrl({
      domain,
      clientId,
      baseUrl,
      statePayload,
      scopes,
      connection,
      prompt,
      maxAge,
      acrValues,
    })

    return NextResponse.redirect(authUrl.toString())
  }

  const authUrl = buildAuthorizeUrl({
    domain,
    clientId,
    baseUrl,
    statePayload,
    scopes,
    connection,
    // For reconnect scenarios, force provider re-consent.
    prompt: resetConnectedAccount ? "consent" : prompt,
    maxAge,
    acrValues,
  })

  return NextResponse.redirect(authUrl.toString())
}
