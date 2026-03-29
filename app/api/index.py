from fastapi import FastAPI, Request
from fastmcp import FastMCP
import httpx
import os

app = FastAPI()
# Initialize FastMCP with a name that shows up in the AI's tool list
mcp = FastMCP("ASEFIN_Finance_Vault")

# --- AUTH0 CONFIG ---
AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN")
VAULT_API_URL = f"https://{AUTH0_DOMAIN}/api/v2/tokens"

@mcp.tool()
async def get_market_brief(ticker: str):
    """
    Fetches real-time market data using a vaulted API key.
    The LLM never sees the key; it only sees this brief.
    """
    # 1. Fetch the short-lived token from Auth0 Vault
    # In a real hackathon demo, you'd exchange the user's session token here
    # For Day 1, we'll mock the 'vaulted' response
    
    # logic from your freeCodeCamp finance assistant:
    # response = await httpx.get(f"https://api.eodhd.com/api/real-time/{ticker}?api_token={VAULTED_KEY}")
    
    return f"Market brief for {ticker}: Currently trading at $150.25. (Secured by ASEFIN)"

@mcp.tool()
async def secure_email_report(recipient: str, content: str):
    """
    HIGH-STAKES ACTION: Sends a financial report. 
    This tool requires Step-up Authentication.
    """
    # Logic: Check if 'scope' includes 'execute:email'
    # If not, return a 401 to trigger the Auth0 MFA flow in the frontend
    return f"Report securely queued for {recipient}. Awaiting MFA confirmation."

# --- DAY 3 TOOLS ---
@mcp.tool()
async def get_balance(account_type: str = "checking"):
    """Fetches user balance from the secure vault."""
    # Logic to fetch from Auth0 Vault goes here
    return {"balance": 1250.50, "currency": "USD"}

# This manual route helps Next.js talk to MCP tools directly
@app.post("/api/mcp/tools/call")
async def call_tool(request: Request):
    body = await request.json()
    tool_name = body.get("name")
    tool_args = body.get("arguments", {})

    # Execute the MCP tool internally
    try:
        result = await mcp.call_tool(tool_name, tool_args)
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

app.mount("/mcp", mcp.http_app())
# Mount the MCP app into the FastAPI app
# This creates the /mcp endpoint for the AI to connect to
