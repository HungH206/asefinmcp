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
  constructor(
    public readonly interrupt: VaultInterrupt,
    public readonly reason?: string
  ) {
    super("TOKEN_VAULT_INTERRUPT")
    this.name = "TokenVaultInterrupt"
  }
}

async function exchangeToken(params: {
  domain: string
  clientId: string
  clientSecret: string
  subjectToken: string
  subjectTokenType: "urn:ietf:params:oauth:token-type:refresh_token" | "urn:ietf:params:oauth:token-type:access_token"
  connection: string
  scopes: string[]
  loginHint?: string
}) {
  const { domain, clientId, clientSecret, subjectToken, subjectTokenType, connection, scopes, loginHint } = params

  const res = await fetch(`https://${domain}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "urn:auth0:params:oauth:grant-type:token-exchange:federated-connection-access-token",
      client_id: clientId,
      client_secret: clientSecret,
      subject_token: subjectToken,
      subject_token_type: subjectTokenType,
      requested_token_type: "http://auth0.com/oauth/token-type/federated-connection-access-token",
      connection,
      scope: scopes.join(" "),
      ...(loginHint ? { login_hint: loginHint } : {}),
    }),
  })

  if (res.status === 403 || res.status === 401) {
    const body = await res.text()
    throw new TokenVaultInterrupt({ connection, requiredScopes: scopes }, body)
  }

  if (!res.ok) {
    const body = await res.text()
    if (body.includes("login_required") || body.includes("consent_required")) {
      throw new TokenVaultInterrupt({ connection, requiredScopes: scopes }, body)
    }
    if (
      body.includes("\"error\":\"invalid_request\"") ||
      body.includes("\"error\":\"invalid_grant\"") ||
      body.includes("\"error\":\"access_denied\"")
    ) {
      throw new TokenVaultInterrupt({ connection, requiredScopes: scopes }, body)
    }
    throw new Error(`Token Vault error ${res.status}: ${body}`)
  }

  const data = (await res.json()) as { access_token: string; expires_in: number }
  return { accessToken: data.access_token, expiresIn: data.expires_in }
}

/**
 * Exchange an Auth0 refresh token for a connection-specific token (e.g. Google OAuth) via the Token Vault API.
 *
 * This is the server-side equivalent of with_token_vault() in the Python SDK.
 * The Google token never touches the LLM — only this server-side function sees it.
 *
 * @param refreshToken Auth0 refresh_token from the session
 * @param connection Target connection (e.g., 'google-oauth2')
 * @param scopes Requested scopes
 */
export async function getVaultToken(
  refreshToken: string,
  connection: string,
  scopes: string[],
  loginHint?: string
): Promise<VaultTokenResult> {
  const domain = process.env.AUTH0_DOMAIN
  const clientId = process.env.AUTH0_CLIENT_ID
  const clientSecret = process.env.AUTH0_CLIENT_SECRET

  if (!domain || !clientId || !clientSecret) {
    throw new Error("Missing Auth0 env vars for Token Vault")
  }

  return exchangeToken({
    domain,
    clientId,
    clientSecret,
    subjectToken: refreshToken,
    subjectTokenType: "urn:ietf:params:oauth:token-type:refresh_token",
    connection,
    scopes,
    loginHint,
  })
}

export async function getVaultTokenFromAccessToken(
  accessToken: string,
  connection: string,
  scopes: string[],
  loginHint?: string
): Promise<VaultTokenResult> {
  const domain = process.env.AUTH0_DOMAIN
  const clientId = process.env.AUTH0_CLIENT_ID
  const clientSecret = process.env.AUTH0_CLIENT_SECRET

  if (!domain || !clientId || !clientSecret) {
    throw new Error("Missing Auth0 env vars for Token Vault")
  }

  return exchangeToken({
    domain,
    clientId,
    clientSecret,
    subjectToken: accessToken,
    subjectTokenType: "urn:ietf:params:oauth:token-type:access_token",
    connection,
    scopes,
    loginHint,
  })
}
