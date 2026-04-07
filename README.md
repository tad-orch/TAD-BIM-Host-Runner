# TAD BIM Platform

This repository is now a small npm-workspaces monorepo shell. The current backend/API/MCP gateway lives in `apps/mcp`.

Planned next applications:

- `apps/web`
- `apps/telegram`

Only `apps/mcp` exists in this phase.

## Current Workspace

- `apps/mcp`
  - the existing Revit MCP gateway and backend API
  - preserves the current bridge execution flow
  - preserves MCP, API, health, execute, and legacy job routes
  - uses SQLite for hosts, jobs, audit logs, conversations, and messages

Implemented backend routes remain unchanged:

- `GET /health`
- `POST /execute`
- `GET /jobs/:jobId`
- `POST /mcp/tools/mcp-arch-system-health`
- `POST /mcp/tools/mcp-arch-walls-create`
- `POST /api/chat`
- `GET /api/jobs`
- `GET /api/jobs/:jobId`
- `GET /api/hosts`
- `GET /api/conversations`
- `GET /api/conversations/:id/messages`

## Run From Root

Install dependencies:

```bash
npm install
```

Start the backend in development:

```bash
npm run dev:mcp
```

Build the backend:

```bash
npm run build:mcp
```

Run backend tests:

```bash
npm run test:mcp
```

Run backend typecheck:

```bash
npm run typecheck:mcp
```

Optional convenience aliases currently delegate to `apps/mcp`:

- `npm run dev`
- `npm run build`
- `npm run test`
- `npm run typecheck`

## Backend Notes

- backend package path: `apps/mcp`
- backend env file path: `apps/mcp/.env`
- default backend data directory: `apps/mcp/data`
- default SQLite path: `apps/mcp/data/app.db`

`HOSTS_JSON`, bridge dispatch, MCP mappings, deterministic `/api/chat` routing, and the existing async polling flow are unchanged.

## Backend Docs

- [Architecture](apps/mcp/docs/architecture.md)
- [Database](apps/mcp/docs/database.md)

## Planned Later

Not implemented yet:

- `apps/web`
- `apps/telegram`
- scheduler
- Telegram integration
- LLM-assisted chat interpretation on the execution path
