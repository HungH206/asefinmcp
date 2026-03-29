# Next.js template

This is a Next.js template with shadcn/ui.

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button";
```

## Backend in this project

This project now includes a backend implemented with Next.js App Router route handlers.

### API routes

- GET /api/market
	- Returns financial card data for the market dashboard.
- GET /api/audit
	- Returns recent audit entries for the compliance table.
- GET /api/chat
	- Returns current chat history.
- POST /api/chat
	- Accepts `{ "message": "..." }` and returns `{ userMessage, agentMessage }`.

### Backend structure

- lib/backend/types.ts
	- Shared request/response contracts between server and client.
- lib/backend/service.ts
	- Server-side business logic and in-memory data source.
- app/api/*/route.ts
	- HTTP route handlers.

### How to extend to production

1. Replace in-memory arrays in `lib/backend/service.ts` with a real database (PostgreSQL, MongoDB, etc.).
2. Add authentication/authorization (NextAuth, Clerk, Auth0, or custom middleware).
3. Add runtime validation for request bodies (for example with zod).
4. Add logging and audit persistence for compliance.
5. Add integration tests for all /api routes.
