import { NextResponse } from "next/server"
import { cookies } from "next/headers"

type ConnectedAccount = {
  id?: string
  connection?: string
  access_type?: string
  scopes?: string[]
  created_at?: string
}

type MyAccountTokenResult = {
  accessToken: string
  tokenType: string
  authorizationHeader: string
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

export async function GET() {
  const domain = process.env.AUTH0_DOMAIN
  const clientId = process.env.AUTH0_CLIENT_ID
  const clientSecret = process.env.AUTH0_CLIENT_SECRET
  if (!domain || !clientId || !clientSecret) {
    return NextResponse.json({ error: "Missing Auth0 environment variables" }, { status: 503 })
  }

  const cookieStore = await cookies()
  const refreshToken = cookieStore.get("vault_refresh_token")?.value
  if (!refreshToken) {
    return NextResponse.json({ error: "Not authenticated. Missing vault_refresh_token cookie." }, { status: 401 })
  }

  try {
    const myAccountToken = await getMyAccountApiToken(domain, clientId, clientSecret, refreshToken)
    const accountsRes = await fetch(`https://${domain}/me/v1/connected-accounts/accounts?connection=google-oauth2`, {
      headers: {
        Accept: "application/json",
        Authorization: myAccountToken.authorizationHeader,
      },
    })

    const text = await accountsRes.text()
    if (!accountsRes.ok) {
      return NextResponse.json({
        error: `Connected accounts query failed (${accountsRes.status})`,
        detail: text,
      }, { status: accountsRes.status })
    }

    const parsed = JSON.parse(text) as { accounts?: ConnectedAccount[] }
    const accounts = parsed.accounts ?? []
    const hasGmailSend = accounts.some((a) => a.scopes?.includes("https://www.googleapis.com/auth/gmail.send"))

    return NextResponse.json({
      connection: "google-oauth2",
      accountCount: accounts.length,
      hasGmailSend,
      accounts,
    })
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : "Unknown error",
    }, { status: 500 })
  }
}

export async function DELETE() {
  const domain = process.env.AUTH0_DOMAIN
  const clientId = process.env.AUTH0_CLIENT_ID
  const clientSecret = process.env.AUTH0_CLIENT_SECRET
  if (!domain || !clientId || !clientSecret) {
    return NextResponse.json({ error: "Missing Auth0 environment variables" }, { status: 503 })
  }

  const cookieStore = await cookies()
  const refreshToken = cookieStore.get("vault_refresh_token")?.value
  if (!refreshToken) {
    return NextResponse.json({ error: "Not authenticated. Missing vault_refresh_token cookie." }, { status: 401 })
  }

  try {
    const myAccountToken = await getMyAccountApiToken(domain, clientId, clientSecret, refreshToken)
    const accountsRes = await fetch(`https://${domain}/me/v1/connected-accounts/accounts?connection=google-oauth2`, {
      headers: {
        Accept: "application/json",
        Authorization: myAccountToken.authorizationHeader,
      },
    })

    const text = await accountsRes.text()
    if (!accountsRes.ok) {
      return NextResponse.json({
        error: `Connected accounts query failed (${accountsRes.status})`,
        detail: text,
      }, { status: accountsRes.status })
    }

    const parsed = JSON.parse(text) as { accounts?: ConnectedAccount[] }
    const ids = (parsed.accounts ?? [])
      .map((a) => a.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0)

    const deletionResults = await Promise.all(
      ids.map(async (id) => {
        const del = await fetch(`https://${domain}/me/v1/connected-accounts/accounts/${id}`, {
          method: "DELETE",
          headers: {
            Accept: "application/json",
            Authorization: myAccountToken.authorizationHeader,
          },
        })
        return { id, ok: del.ok, status: del.status }
      })
    )

    return NextResponse.json({
      deletedCount: deletionResults.filter((r) => r.ok).length,
      attemptedCount: deletionResults.length,
      results: deletionResults,
    })
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : "Unknown error",
    }, { status: 500 })
  }
}
