# TAD BIM Platform

This repository is an npm-workspaces monorepo. The backend/API/MCP gateway lives in `apps/mcp`, and the Phase 5 frontend now lives in `apps/web`.

## Current Workspace

- `apps/mcp`
  - the existing Revit MCP gateway and backend API
  - preserves the current bridge execution flow
  - preserves MCP, API, health, execute, and legacy job routes
  - uses SQLite for hosts, jobs, audit logs, conversations, and messages
- `apps/web`
  - React + Vite + TypeScript frontend
  - Tailwind CSS with lightweight shadcn-style UI primitives
  - routes for chat, jobs, hosts, and schedules
  - talks to the existing backend without changing bridge logic or backend flow

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

Start only the backend in development:

```bash
npm run dev:mcp
```

Start only the frontend in development:

```bash
npm run dev:web
```

Start backend and frontend together:

```bash
npm run dev
```

Build only the backend:

```bash
npm run build:mcp
```

Build only the frontend:

```bash
npm run build:web
```

Run backend tests:

```bash
npm run test:mcp
```

Run backend typecheck:

```bash
npm run typecheck:mcp
```

Run frontend typecheck:

```bash
npm run typecheck:web
```

Convenience aliases from the root:

- `npm run dev` runs `apps/mcp` and `apps/web` together
- `npm run build` builds `apps/mcp` and `apps/web`
- `npm run test`
- `npm run typecheck` typechecks `apps/mcp` and `apps/web`

## Frontend Pages

The web app lives at `apps/web` and currently includes:

- `/chat`
  - target host selector
  - recent conversation list
  - conversation message history
  - send box and quick actions
  - uses `GET /api/hosts`, `GET /api/conversations`, `GET /api/conversations/:id/messages`, and `POST /api/chat`
- `/jobs`
  - latest-first job list
  - filters for status, target host, and tool
  - detail panel from `GET /api/jobs/:jobId`
- `/hosts`
  - registered hosts, machine type, enabled tools, and active status
- `/schedules`
  - lightweight scaffold page for the next scheduler phase

## Frontend Dev Notes

- default frontend dev server: `http://127.0.0.1:5173`
- default backend target in local frontend proxy: `http://127.0.0.1:8080`
- the frontend assumes the backend runs separately and calls the existing API without backend changes
- if you need a non-default backend origin for the frontend, set `BACKEND_URL` for Vite proxying in dev or `VITE_API_BASE_URL` when building

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

- `apps/telegram`
- scheduler APIs and scheduler execution flow
- Telegram integration
- LLM-assisted chat interpretation on the execution path
