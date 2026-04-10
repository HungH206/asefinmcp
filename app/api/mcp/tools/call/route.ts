import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { appendAuditEntry } from "@/lib/backend/service"
import { sendGmail } from "@/lib/backend/gmail"
import { getVaultToken, getVaultTokenFromAccessToken, TokenVaultInterrupt } from "@/lib/backend/tokenVault"

const MFA_COOKIE = "vault_mfa_verified_at"
const MFA_TTL_SECONDS = 5 * 60
const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send"
const REQUIRE_MFA_FOR_EMAIL_REPORTS = process.env.REQUIRE_MFA_FOR_EMAIL_REPORTS === "true"

function stepUpRequiredResponse() {
  return NextResponse.json(
    {
      detail: {
        interrupt: {
          connection: "google-oauth2",
          requiredScopes: [GMAIL_SEND_SCOPE],
          authorizationParams: {
            stepUp: "1",
            prompt: "login",
            max_age: "0",
            acr_values: "http://schemas.openid.net/pape/policies/2007/06/multi-factor",
          },
        },
      },
    },
    { status: 401 }
  )
}

function vaultConsentRequiredResponse() {
  return NextResponse.json(
    {
      detail: {
        interrupt: {
          connection: "google-oauth2",
          requiredScopes: [GMAIL_SEND_SCOPE],
        },
      },
    },
    { status: 401 }
  )
}

async function hasRecentMfaProof() {
  const cookieStore = await cookies()
  const rawVerifiedAt = cookieStore.get(MFA_COOKIE)?.value
  if (!rawVerifiedAt) return false
  const verifiedAt = Number(rawVerifiedAt)
  if (!Number.isFinite(verifiedAt)) return false
  const nowEpoch = Math.floor(Date.now() / 1000)
  return nowEpoch - verifiedAt <= MFA_TTL_SECONDS
}

async function getGoogleAccessToken() {
  const cookieStore = await cookies()
  const refreshToken = cookieStore.get("vault_refresh_token")?.value
  const sessionJson = cookieStore.get("vault_session")?.value
  let auth0AccessToken: string | null = null

  if (sessionJson) {
    try {
      const session = JSON.parse(sessionJson) as { access_token?: string }
      auth0AccessToken = typeof session.access_token === "string" ? session.access_token : null
    } catch {
      auth0AccessToken = null
    }
  }

  if (!refreshToken && !auth0AccessToken) {
    return null
  }

  if (refreshToken) {
    try {
      const { accessToken } = await getVaultToken(
        refreshToken,
        "google-oauth2",
        ["https://www.googleapis.com/auth/gmail.send"]
      )
      return accessToken
    } catch (err) {
      if (
        err instanceof TokenVaultInterrupt &&
        err.reason?.includes("federated_connection_refresh_token_not_found")
      ) {
        throw err
      }

      if (auth0AccessToken) {
        try {
          const fallback = await getVaultTokenFromAccessToken(
            auth0AccessToken,
            "google-oauth2",
            ["https://www.googleapis.com/auth/gmail.send"]
          )
          return fallback.accessToken
        } catch (fallbackErr) {
          // Some tenants reject access-token subject exchange with:
          // "Not supported JWT type in subject token.".
          // In that case, preserve the original refresh-token interrupt semantics.
          if (
            err instanceof TokenVaultInterrupt &&
            fallbackErr instanceof Error &&
            fallbackErr.message.includes("Not supported JWT type in subject token")
          ) {
            throw err
          }

          if (fallbackErr instanceof TokenVaultInterrupt) {
            const combined = [
              err instanceof TokenVaultInterrupt ? err.reason : String(err),
              fallbackErr.reason,
            ]
              .filter(Boolean)
              .join(" | access-token fallback: ")

            throw new TokenVaultInterrupt(fallbackErr.interrupt, combined)
          }

          if (err instanceof TokenVaultInterrupt) {
            throw new TokenVaultInterrupt(err.interrupt, `${err.reason ?? String(err)} | access-token fallback failed: ${String(fallbackErr)}`)
          }

          throw fallbackErr
        }
      }
      throw err
    }
  }

  try {
    const fallback = await getVaultTokenFromAccessToken(
      auth0AccessToken!,
      "google-oauth2",
      ["https://www.googleapis.com/auth/gmail.send"]
    )
    return fallback.accessToken
  } catch (err) {
    if (err instanceof TokenVaultInterrupt) {
      throw err
    }
    throw new TokenVaultInterrupt(
      {
        connection: "google-oauth2",
        requiredScopes: [GMAIL_SEND_SCOPE],
      },
      err instanceof Error ? err.message : String(err)
    )
  }
}

const tools: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
  async get_market_brief({ ticker }) {
    const t = String(ticker ?? "AAPL").toUpperCase()
    const apiKey = process.env.EODHD_API_KEY
    if (!apiKey) {
      return { ticker: t, price: "N/A", change: "N/A", source: "EODHD (key not configured)", note: "Set EODHD_API_KEY in .env.local" }
    }
    const res = await fetch(`https://eodhd.com/api/real-time/${t}?api_token=${apiKey}&fmt=json`, { next: { revalidate: 60 } })
    if (!res.ok) {
      return { ticker: t, price: "N/A", change: "N/A", source: "EODHD", note: `API error: ${res.status}` }
    }
    const data = await res.json() as { close: number; change_p: number }
    return {
      ticker: t,
      price: `$${data.close}`,
      change: `${data.change_p > 0 ? "+" : ""}${data.change_p.toFixed(2)}%`,
      source: "EODHD via ASEFIN Vault",
      note: "Raw API key never exposed to LLM",
    }
  },

  async analyze_portfolio() {
    const positions = [
      { symbol: "AAPL", quantity: 100, price: 189.84, daily_change_pct: 2.3, volatility: 0.28 },
      { symbol: "TSLA", quantity: 50, price: 250.12, daily_change_pct: -1.2, volatility: 0.45 },
      { symbol: "MSFT", quantity: 75, price: 415.3, daily_change_pct: 0.8, volatility: 0.22 },
    ]
    const totalValue = positions.reduce((s, p) => s + p.quantity * p.price, 0)
    const weightedVol = positions.reduce((s, p) => s + ((p.quantity * p.price) / totalValue) * p.volatility, 0)
    const risk = weightedVol > 0.35 ? "High" : weightedVol > 0.2 ? "Medium" : "Low"
    return {
      total_value: `$${totalValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
      weighted_volatility: weightedVol.toFixed(4),
      risk,
      top_position: "AAPL (52.3% of portfolio)",
    }
  },

  async get_balance({ account_type }) {
    const balances: Record<string, number> = { checking: 12504.5, savings: 48200.0, investment: 124000.0 }
    const type = String(account_type ?? "checking")
    return { account: type, balance: `$${(balances[type] ?? 0).toLocaleString()}`, currency: "USD" }
  },

  async send_financial_report_email({ recipient, subject }) {
    if (REQUIRE_MFA_FOR_EMAIL_REPORTS && !(await hasRecentMfaProof())) {
      return stepUpRequiredResponse()
    }

    const accessToken = await getGoogleAccessToken()

    if (!accessToken) {
      return vaultConsentRequiredResponse()
    }

    const to = String(recipient ?? "recipient@example.com")
    const mailSubject = String(subject ?? "ASEFIN Financial Report")
    const body = [
      "ASEFIN Financial Report",
      "========================",
      "",
      "A secure report was generated and delivered through Auth0 Token Vault.",
      `Recipient: ${to}`,
      `Sent: ${new Date().toISOString()}`,
    ].join("\n")

    const result = await sendGmail({ accessToken, to, subject: mailSubject, body })

    appendAuditEntry({ action: `Report Sent to ${String(recipient ?? "recipient")}`, status: "success", actor: "Narrator Agent", eventType: "report" })
    return {
      status: "sent",
      messageId: result.messageId,
      recipient: to,
      message: `Report "${mailSubject}" sent to ${to} via Gmail and Auth0 Token Vault.`,
      security: { provider: "Auth0", scope: "gmail:send", keyExposed: false },
    }
  },

  async send_eod_report({ recipient }) {
    if (REQUIRE_MFA_FOR_EMAIL_REPORTS && !(await hasRecentMfaProof())) {
      return stepUpRequiredResponse()
    }

    const accessToken = await getGoogleAccessToken()

    if (!accessToken) {
      return vaultConsentRequiredResponse()
    }

    const apiKey = process.env.EODHD_API_KEY
    const tickers = ["AAPL", "TSLA", "MSFT", "GOOGL"]
    const prices = await Promise.all(
      tickers.map(async (t) => {
        if (!apiKey) return `${t}: N/A`
        try {
          const res = await fetch(`https://eodhd.com/api/real-time/${t}?api_token=${apiKey}&fmt=json`)
          const data = await res.json() as { close: number; change_p: number }
          return `${t}: $${data.close} (${data.change_p > 0 ? "+" : ""}${data.change_p.toFixed(2)}%)`
        } catch {
          return `${t}: N/A`
        }
      })
    )
    const to = String(recipient ?? "user@example.com")
    const subject = `ASEFIN EOD Report — ${new Date().toLocaleDateString()}`
    const body = [
      "End-of-Day Market Report",
      "========================",
      "",
      ...prices,
      "",
      "Secured by ASEFIN MCP — API keys never exposed to the AI agent.",
      `Sent: ${new Date().toISOString()}`,
    ].join("\n")

    const result = await sendGmail({ accessToken, to, subject, body })

    appendAuditEntry({ action: `EOD Report Sent to ${to}`, status: "success", actor: "Narrator Agent", eventType: "report" })
    return {
      status: "sent",
      messageId: result.messageId,
      recipient: to,
      summary: prices,
      message: `End-of-day report for ${tickers.join(", ")} sent to ${to} via Gmail and Auth0 Token Vault.`,
    }
  },
}

const toolAuditMap: Record<string, { action: string; eventType: "vault" | "mfa" | "market" | "report" | "auth" }> = {
  get_market_brief:          { action: "Market Data Fetched via MCP",         eventType: "market" },
  analyze_portfolio:         { action: "Portfolio Analysis Generated",         eventType: "report" },
  get_balance:               { action: "Account Balance Retrieved via Vault",  eventType: "vault"  },
  send_eod_report:           { action: "EOD Report Sent",                      eventType: "report" },
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { name?: string; arguments?: Record<string, unknown> }
  const { name, arguments: args = {} } = body

  if (!name || !(name in tools)) {
    return NextResponse.json({ detail: `Unknown tool: ${name ?? "(none)"}` }, { status: 404 })
  }

  try {
    const result = await tools[name](args)
    if (result instanceof NextResponse) return result
    const audit = toolAuditMap[name]
    if (audit) {
      appendAuditEntry({ action: audit.action, status: "success", actor: "Narrator Agent", eventType: audit.eventType })
    }
    return NextResponse.json({ result })
  } catch (err) {
    if (err instanceof TokenVaultInterrupt) {
      const needsConnectedAccountReset = Boolean(err.reason?.includes("federated_connection_refresh_token_not_found"))
      return NextResponse.json(
        {
          detail: {
            interrupt: {
              ...err.interrupt,
              ...(needsConnectedAccountReset
                ? {
                    authorizationParams: {
                      reset_connected_account: "1",
                      prompt: "consent",
                    },
                  }
                : {}),
            },
            reason: err.reason ?? null,
          },
        },
        { status: 401 }
      )
    }
    const message = err instanceof Error ? err.message : "Tool execution failed"
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}
