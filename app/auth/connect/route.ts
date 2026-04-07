import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const connection = url.searchParams.get("connection") ?? ""
  const scopes = url.searchParams.getAll("scopes")
  const returnTo = url.searchParams.get("returnTo") || "/"

  const domain = process.env.AUTH0_DOMAIN
  const clientId = process.env.AUTH0_CLIENT_ID
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL

  if (!domain || !clientId || !baseUrl) {
    return NextResponse.json({ error: "Auth0 is not configured. Set AUTH0_DOMAIN, AUTH0_CLIENT_ID, and NEXT_PUBLIC_BASE_URL." }, { status: 503 })
  }

  // Always include openid so Auth0 returns an id_token
  const allScopes = ["openid", "offline_access", ...scopes].join(" ")

  const authUrl = new URL(`https://${domain}/authorize`)
  authUrl.searchParams.set("client_id", clientId)
  authUrl.searchParams.set("response_type", "code")
  authUrl.searchParams.set("redirect_uri", `${baseUrl}/auth/callback`)
  authUrl.searchParams.set("scope", allScopes)
  authUrl.searchParams.set("state", returnTo)

  if (connection) {
    authUrl.searchParams.set("connection", connection)
  }

  return NextResponse.redirect(authUrl.toString())
}
