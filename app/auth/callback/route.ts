import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const error = url.searchParams.get("error")
  const errorDescription = url.searchParams.get("error_description")
  const returnTo = url.searchParams.get("state") || "/"

  // Auth0 returned an error (e.g. user denied consent)
  if (error) {
    const dest = new URL("/", req.url)
    dest.searchParams.set("auth_error", errorDescription ?? error)
    return NextResponse.redirect(dest.toString())
  }

  if (!code) {
    return NextResponse.json({ error: "Missing authorization code" }, { status: 400 })
  }

  const domain = process.env.AUTH0_DOMAIN
  const clientId = process.env.AUTH0_CLIENT_ID
  const clientSecret = process.env.AUTH0_CLIENT_SECRET
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL

  if (!domain || !clientId || !clientSecret || !baseUrl) {
    console.error("Missing Auth0 env vars")
    return NextResponse.redirect(new URL("/", req.url).toString())
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

  // Popup mode: redirect to /close so the popup window closes itself
  const isPopup = returnTo === "/close" || url.searchParams.get("popup") === "1"
  const redirectTarget = isPopup ? `${baseUrl}/close` : returnTo

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

  return response
}
