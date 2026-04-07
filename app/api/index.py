from fastapi import FastAPI, HTTPException, Request
from fastmcp import FastMCP
from risk_engine import analyze, parse_positions
import json
from fastapi import Request, HTTPException
import httpx
import os

app = FastAPI()
# Initialize FastMCP with a name that shows up in the AI's tool list
mcp = FastMCP("ASEFIN_Finance_Vault")

# --- AUTH0 CONFIG ---
AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN")
VAULT_API_URL = f"https://{AUTH0_DOMAIN}/api/v2/tokens"

# --- MOCK VAULT DATA ---
# In 10 hours, we use Env Vars to mock the Auth0 Token Vault
#FINANCIAL_API_KEY = os.getenv("FINANCIAL_API_KEY", "MOCK_KEY_123")

async def get_user_session(request: Request):
    return request.cookies.get("vault_session")

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


async def get_vault_token(connection: str, scopes: list[str]) -> dict:
    # Placeholder: replace with real Auth0 token exchange in production
    return {"access_token": os.getenv("FINANCIAL_API_KEY", "MOCK_TOKEN_123")}

@mcp.tool()
async def send_financial_report_email(
    recipient: str,
    subject: str,
    request: Request
):
    # 🔐 STEP 1: Get session from cookie
    session_cookie = request.cookies.get("vault_session")

    if not session_cookie:
        # ❌ No auth → trigger Token Vault UI
        raise HTTPException(
            status_code=401,
            detail={
                "interrupt": {
                    "connection": "google-oauth2",
                    "requiredScopes": [
                        "https://www.googleapis.com/auth/gmail.send"
                    ]
                }
            }
        )

    # 🔐 STEP 2: Parse session (from /auth/callback)
    try:
        session = json.loads(session_cookie)
    except:
        raise HTTPException(status_code=401, detail="Invalid session")

    # 🔐 STEP 3: Exchange session → vault token
    token = await get_vault_token(
        "google-oauth2",
        ["https://www.googleapis.com/auth/gmail.send"]
    )

    # 🧾 STEP 4: Log audit
    print({
        "tool": "send_email",
        "recipient": recipient,
        "scope": "gmail:send",
        "status": "authorized"
    })

    # 🚨 STEP 5: Enforce MFA (demo logic)
    requires_mfa = True

    if requires_mfa:
        return {
            "status": "blocked",
            "message": f"Email to {recipient} requires MFA approval",
            "security": {
                "provider": "Google",
                "scope": "gmail:send",
                "token_preview": token["access_token"][:15] + "...",
                "step_up_required": True
            }
        }

    # ✅ STEP 6: (optional) simulate success
    return {
        "status": "sent",
        "message": f"Email successfully sent to {recipient}",
        "security": {
            "provider": "Google",
            "scope": "gmail:send"
        }
    }

# --- DAY 3 TOOLS ---
@mcp.tool()
async def get_balance(account_type: str = "checking"):
    """Fetches user balance from the secure vault."""
    # Logic to fetch from Auth0 Vault goes here
    return {"balance": 1250.50, "currency": "USD"}

@mcp.tool()
async def analyze_portfolio():
    sample_data = [
        {
            "symbol": "AAPL",
            "quantity": 100,
            "price": 189.84,
            "daily_change_pct": 2.3,
            "volatility": 0.28
        },
        {
            "symbol": "TSLA",
            "quantity": 50,
            "price": 250,
            "daily_change_pct": -1.2,
            "volatility": 0.45
        }
    ]

    total_value = sum(p["quantity"] * p["price"] for p in sample_data)
    weighted_volatility = sum(
        (p["quantity"] * p["price"] / total_value) * p["volatility"] for p in sample_data
    )
    risk = "High" if weighted_volatility > 0.35 else "Medium" if weighted_volatility > 0.2 else "Low"
    report = {"risk": risk, "weighted_volatility": round(weighted_volatility, 4), "total_value": total_value}

    return report

# --- INTEGRATED CHAT HANDLER ---
# This matches your chat-interface.tsx fetch("/api/chat") call
@app.post("/api/chat")
async def chat_handler(request: Request):
    body = await request.json()
    user_query = body.get("message", "").upper()
    
    # 1. Logic for Price/Market Tools
    if "PRICE" in user_query or "BRIEF" in user_query:
        # Simple extraction: assumes ticker is the last word
        ticker = user_query.split()[-1].strip("?")
        result = await mcp.call_tool("get_market_brief", {"ticker": ticker})
        return {
            "userMessage": {"role": "user", "content": body.get("message")},
            "agentMessage": {
                "role": "agent", 
                "content": result, 
                "metadata": {"source": "ASEFIN Vault", "confidence": 99}
            }
        }

    # 2. Logic for Balance
    if "BALANCE" in user_query:
        result = await mcp.call_tool("get_balance", {})
        data = result.structured_content or {}
        return {
            "userMessage": {"role": "user", "content": body.get("message")},
            "agentMessage": {
                "role": "agent",
                "content": f"Your current balance is ${data.get('balance')} {data.get('currency')}.",
                "metadata": {"source": "Auth0 Token Vault"}
            }
        }

    # 3. Logic for High-Stakes Actions (Triggers AlertTriangle in UI)
    if "SEND" in user_query or "REPORT" in user_query or "EMAIL" in user_query:
        return {
            "userMessage": {"role": "user", "content": body.get("message")},
            "agentMessage": {
                "role": "agent",
                "content": "I've detected a request for a sensitive data export. This requires additional authorization.",
                "metadata": {"action": "high-stakes"}
            }
        }

    # 🔵 PORTFOLIO ANALYSIS
    if "RISK" in user_query or "PORTFOLIO" in user_query:
        result = await mcp.call_tool("analyze_portfolio", {})
        data = result.structured_content or {}
        return {
            "userMessage": {"role": "user", "content": body.get("message")},
            "agentMessage": {
                "role": "agent",
                "content": f"Risk: {data.get('risk')}, Volatility: {data.get('weighted_volatility')}",
                "metadata": {"tool_used": "analyze_portfolio"}
            }
        }

    # Default fallback
    return {
        "userMessage": {"role": "user", "content": body.get("message")},
        "agentMessage": {
            "role": "agent",
            "content": "I am ASEFIN, your secure financial narrator. Ask me for a 'price', your 'balance', or to 'send a report'."
        }
    }

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
