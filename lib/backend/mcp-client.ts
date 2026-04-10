type ToolInterrupt = {
  connection: string
  requiredScopes: string[]
  authorizationParams?: Record<string, string>
}

type ToolError = Error & { interrupt?: ToolInterrupt }

export async function callAsefinTool(toolName: string, args: Record<string, unknown>) {
  const response = await fetch('/api/mcp/tools/call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: toolName,
      arguments: args,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    if (response.status === 401) {
      const mfaError = new Error("MFA_REQUIRED") as ToolError
      mfaError.interrupt = error?.detail?.interrupt as ToolInterrupt | undefined
      throw mfaError
    }
    throw new Error(error.detail || "Failed to call tool");
  }

  return response.json();
}