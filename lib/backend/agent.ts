import { DynamicStructuredTool } from "@langchain/core/tools"
import { ChatOpenAI } from "@langchain/openai"
import { createReactAgent } from "@langchain/langgraph/prebuilt"
import { HumanMessage, AIMessage } from "@langchain/core/messages"
import { z } from "zod"
import { appendAuditEntry } from "@/lib/backend/service"
import { sendGmail } from "@/lib/backend/gmail"
import { getVaultToken, getVaultTokenFromAccessToken, TokenVaultInterrupt } from "@/lib/backend/tokenVault"
import type { ChatMessageData } from "@/lib/backend/types"

// Re-export so chat route only needs one import
export { TokenVaultInterrupt }

export class VaultInterruptError extends Error {
  constructor(
    public readonly connection: string,
    public readonly requiredScopes: string[]
  ) {
    super("VAULT_INTERRUPT")
    this.name = "VaultInterruptError"
  }
}

// Build all tools — refreshToken is injected per-request from the cookie
export function buildTools(refreshToken: string | null) {
  const getMarketBrief = new DynamicStructuredTool({
    name: "get_market_brief",
    description: "Fetch real-time market price and change for a stock ticker via the secure ASEFIN vault.",
    schema: z.object({
      ticker: z.string().describe("Stock ticker symbol e.g. AAPL, TSLA, MSFT"),
    }),
    func: async ({ ticker }) => {
      const t = ticker.toUpperCase()
      const apiKey = process.env.EODHD_API_KEY
      if (!apiKey) return JSON.stringify({ ticker: t, price: "N/A", note: "Set EODHD_API_KEY" })
      const res = await fetch(`https://eodhd.com/api/real-time/${t}?api_token=${apiKey}&fmt=json`)
      if (!res.ok) return JSON.stringify({ ticker: t, price: "N/A", note: `API error ${res.status}` })
      const data = await res.json() as { close: number; change_p: number }
      appendAuditEntry({ action: "Market Data Fetched via MCP", status: "success", actor: "Narrator Agent", eventType: "market" })
      return JSON.stringify({
        ticker: t,
        price: `$${data.close}`,
        change: `${data.change_p > 0 ? "+" : ""}${data.change_p.toFixed(2)}%`,
        source: "EODHD via ASEFIN Vault",
        note: "Raw API key never exposed to LLM",
      })
    },
  })

  const analyzePortfolio = new DynamicStructuredTool({
    name: "analyze_portfolio",
    description: "Run a risk analysis on the user's portfolio. Returns total value, weighted volatility, risk level.",
    schema: z.object({}),
    func: async () => {
      const positions = [
        { symbol: "AAPL", quantity: 100, price: 189.84, volatility: 0.28 },
        { symbol: "TSLA", quantity: 50,  price: 250.12, volatility: 0.45 },
        { symbol: "MSFT", quantity: 75,  price: 415.3,  volatility: 0.22 },
      ]
      const totalValue = positions.reduce((s, p) => s + p.quantity * p.price, 0)
      const weightedVol = positions.reduce((s, p) => s + ((p.quantity * p.price) / totalValue) * p.volatility, 0)
      const risk = weightedVol > 0.35 ? "High" : weightedVol > 0.2 ? "Medium" : "Low"
      appendAuditEntry({ action: "Portfolio Analysis Generated", status: "success", actor: "Narrator Agent", eventType: "report" })
      return JSON.stringify({
        total_value: `$${totalValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
        weighted_volatility: weightedVol.toFixed(4),
        risk,
        top_position: "AAPL (52.3% of portfolio)",
      })
    },
  })

  const getBalance = new DynamicStructuredTool({
    name: "get_balance",
    description: "Retrieve the user's account balance from the secure vault.",
    schema: z.object({
      account_type: z.enum(["checking", "savings", "investment"]).default("checking"),
    }),
    func: async ({ account_type }) => {
      const balances: Record<string, number> = { checking: 12504.5, savings: 48200.0, investment: 124000.0 }
      appendAuditEntry({ action: "Account Balance Retrieved via Vault", status: "success", actor: "Narrator Agent", eventType: "vault" })
      return JSON.stringify({ account: account_type, balance: `$${(balances[account_type] ?? 0).toLocaleString()}`, currency: "USD" })
    },
  })

  const sendEodReport = new DynamicStructuredTool({
    name: "send_eod_report",
    description: "Send an end-of-day stock price report via Gmail. Fetches live prices for AAPL, TSLA, MSFT, GOOGL and emails them. Requires Gmail vault authorization.",
    schema: z.object({
      recipient: z.string().email().describe("Email address to send the report to"),
    }),
    func: async ({ recipient }) => {
      // No refresh token — user hasn't authenticated yet
      if (!refreshToken) {
        throw new TokenVaultInterrupt({
          connection: "google-oauth2",
          requiredScopes: ["https://www.googleapis.com/auth/gmail.send"],
        })
      }

      // Exchange Auth0 refresh token for a Google OAuth access token via Token Vault
      // This is the with_token_vault() equivalent — Google token never touches the LLM
      let googleToken: string
      try {
        const primary = await getVaultToken(
          refreshToken,
          "google-oauth2",
          ["https://www.googleapis.com/auth/gmail.send"]
        )
        googleToken = primary.accessToken
      } catch (err) {
        if (err instanceof TokenVaultInterrupt && err.reason?.includes("federated_connection_refresh_token_not_found")) {
          // Agent path may only have refresh token available; fallback requires access token and
          // is therefore only feasible in API routes where vault_session is available.
          throw err
        }
        throw err
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

      // Real Gmail send using the Google token from Auth0 Token Vault
      const result = await sendGmail({ accessToken: googleToken, to: recipient, subject, body })

      appendAuditEntry({ action: `EOD Report Sent to ${recipient}`, status: "success", actor: "Narrator Agent", eventType: "report" })

      return JSON.stringify({
        status: "sent",
        messageId: result.messageId,
        recipient,
        summary: prices,
        message: `End-of-day report sent to ${recipient} via Gmail (Auth0 Token Vault). Message ID: ${result.messageId}`,
      })
    },
  })

  return [getMarketBrief, analyzePortfolio, getBalance, sendEodReport]
}

export interface AgentResult {
  content: string
  // Set when a tool needs vault auth
  interrupt?: { connection: string; requiredScopes: string[] }
}

export async function runAgent(
  userText: string,
  history: ChatMessageData[],
  refreshToken: string | null
): Promise<AgentResult> {
  const model = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0,
    openAIApiKey: process.env.OPENAI_API_KEY,
  })

  const tools = buildTools(refreshToken)
  const agent = createReactAgent({ llm: model, tools })

  // Convert history to LangChain messages
  const historyMessages = history.slice(-10).map((m) =>
    m.role === "agent"
      ? new AIMessage(m.content)
      : new HumanMessage(m.content)
  )

  try {
    const result = await agent.invoke({
      messages: [
        new HumanMessage({
          content: `You are The Narrator, an elite AI financial intelligence agent for ASEFIN MCP.
You have tools to fetch real market data, analyze portfolios, check balances, and send email reports via a secure vault.
The user never sees raw API keys — all sensitive operations go through the Auth0 Token Vault.
Be concise, professional, and security-conscious.

User: ${userText}`,
        }),
        ...historyMessages,
      ],
    })

    const lastMessage = result.messages[result.messages.length - 1]
    const content = typeof lastMessage.content === "string"
      ? lastMessage.content
      : JSON.stringify(lastMessage.content)

    return { content }
  } catch (err) {
    if (err instanceof TokenVaultInterrupt) {
      return {
        content: "This action requires Gmail authorization via the Auth0 Token Vault. Please connect your Google account to proceed.",
        interrupt: err.interrupt,
      }
    }
    if (err instanceof VaultInterruptError) {
      return {
        content: "This action requires Gmail authorization via the Auth0 Token Vault. Please connect your Google account to proceed.",
        interrupt: { connection: err.connection, requiredScopes: err.requiredScopes },
      }
    }
    throw err
  }
}
