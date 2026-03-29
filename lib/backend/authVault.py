# Example of fetching a vaulted token for an MCP tool
from auth0_ai import Auth0AI

auth0_ai = Auth0AI(domain="YOUR_DOMAIN", client_id="YOUR_ID")

async def get_financial_data():
    # This trades your Auth0 session for a real Google/EODHD token
    token = await auth0_ai.get_access_token_for_connection(
        connection="google-oauth2", 
        scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"]
    )
    # Use 'token' to call your financial API
    return call_external_api(token)