export async function callAsefinTool(toolName: string, args: any) {
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
    // Handle the "Step-up Auth" trigger here later!
    if (response.status === 401) {
       throw new Error("MFA_REQUIRED");
    }
    throw new Error(error.detail || "Failed to call tool");
  }

  return response.json();
}