import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const raw = req.cookies.get("vault_session")?.value

  if (!raw) {
    return NextResponse.json({ authenticated: false })
  }

  try {
    const session = JSON.parse(raw) as { access_token?: string; expires_in?: number; token_type?: string }

    if (!session.access_token) {
      return NextResponse.json({ authenticated: false })
    }

    return NextResponse.json({
      authenticated: true,
      tokenType: session.token_type ?? "Bearer",
      // Never expose the raw token to the client — just confirm it exists
      hasAccessToken: true,
    })
  } catch {
    return NextResponse.json({ authenticated: false })
  }
}

// Allow clearing the session
export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.set("vault_session", "", { maxAge: 0, path: "/" })
  return response
}
