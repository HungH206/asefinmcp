/**
 * Auth0 Token Vault — TypeScript equivalent of:
 *
 *   auth0_ai = Auth0AI()
 *   with_google_connection = auth0_ai.with_token_vault(
 *     connection="google-oauth2",
 *     scopes=["https://www.googleapis.com/auth/gmail.send"],
 *     refresh_token=get_auth0_refresh_token,
 *   )
 *
 * Auth0 Token Vault API docs:
 * https://auth0.com/docs/secure/tokens/token-vault
 */

export interface VaultTokenResult {
  accessToken: string
  expiresIn: number
}

export interface VaultInterrupt {
  connection: string
  requiredScopes: string[]
}

export class TokenVaultInterrupt extends Error {
  constructor(public readonly interrupt: VaultInterrupt) {
    super("TOKEN_VAULT_INTERRUPT")
    this.name = "TokenVaultInterrupt"
  }
}

/**
 * Exchange an Auth0 session (refresh_token or access_token) for a
 * connection-specific token (e.g. Google OAuth) via the Token Vault API.
 *
 * This is the server-side equivalent of with_token_vault() in the Python SDK.
 * The Google token never touches the LLM — only this server-side function sees it.
 */
export async function getVaultToken(
  auth0SessionToken: string,
  connection: string,
  scopes: string[]
): Promise<VaultTokenResult> {
  const domain = process.env.AUTH0_DOMAIN
  const clientId = process.env.AUTH0_CLIENT_ID
  const clientSecret = process.env.AUTH0_CLIENT_SECRET

  if (!domain || !clientId || !clientSecret) {
    throw new Error("Missing Auth0 env vars for Token Vault")
  }

  // Auth0 Token Vault endpoint — exchanges your Auth0 token for a
  // connection-specific (Google) token with the requested scopes
  const res = await fetch(`https://${domain}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      client_id: clientId,
      client_secret: clientSecret,
      subject_token: auth0SessionToken,
      subject_token_type: "urn:ietf:params:oauth:token-type:refresh_token",
      requested_token_type: "urn:auth0:params:oauth:token-type:connection",
      connection,
      scope: scopes.join(" "),
    }),
  })

  if (res.status === 403 || res.status === 401) {
    // No token in vault for this connection/scope — user needs to consent
    throw new TokenVaultInterrupt({ connection, requiredScopes: scopes })
  }

  if (!res.ok) {
    const body = await res.text()
    // Auth0 returns login_required when the connection hasn't been authorized yet
    if (body.includes("login_required") || body.includes("consent_required")) {
      throw new TokenVaultInterrupt({ connection, requiredScopes: scopes })
    }
    throw new Error(`Token Vault error ${res.status}: ${body}`)
  }

  const data = await res.json() as { access_token: string; expires_in: number }
  return { accessToken: data.access_token, expiresIn: data.expires_in }
}
