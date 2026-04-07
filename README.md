# TAD BIM Host Runner

Single backend/API/MCP gateway for Revit automation. This service keeps the existing bridge execution pipeline intact while now using SQLite as the primary persistence layer for hosts, jobs, audit logs, conversations, and messages.

## What It Does Now

- exposes MCP-facing Revit routes
- preserves the existing `/execute` and `/jobs/:jobId` execution flow
- dispatches to external execution-node bridges without absorbing bridge logic
- persists runtime state in SQLite
- provides backend read routes for hosts and conversation history

Implemented routes:

- `GET /health`
- `POST /execute`
- `GET /jobs/:jobId`
- `POST /mcp/tools/mcp-arch-system-health`
- `POST /mcp/tools/mcp-arch-walls-create`
- `GET /api/hosts`
- `GET /api/conversations`
- `GET /api/conversations/:id/messages`

## Tool Mapping

The MCP layer stays friendly and deterministic:

- `mcp-arch-system-health` -> internal `revit_ping`
- `mcp-arch-walls-create` -> internal `revit_create_wall`

The bridge-facing contract is unchanged.

## Persistence

Primary database:

- default path: `data/app.db`
- env override: `SQLITE_DB_PATH`

SQLite now stores:

- hosts
- jobs
- audit logs
- conversations
- messages

`HOSTS_JSON` is still supported for bootstrap. When the `hosts` table is empty, startup seeds the database from `HOSTS_JSON` if present, otherwise from the default host list.

## Local Run

Install dependencies:

```bash
npm install
```

Start in development:

```bash
npm run dev
```

Build and run:

```bash
npm run build
npm start
```

Run tests:

```bash
npm test
```

Manual smoke test:

```bash
npm run smoke:mcp
```

## Environment

Supported env vars:

- `HOST`
- `PORT`
- `DATA_DIR`
- `SQLITE_DB_PATH`
- `HOSTS_JSON`
- `BRIDGE_REQUEST_TIMEOUT_MS`
- `POLL_INTERVAL_MS`
- `POLL_TIMEOUT_MS`
- `OLLAMA_BASE_URL`
- `OLLAMA_MODEL`

`SQLITE_DB_PATH` defaults to `${DATA_DIR}/app.db`.

## Docs

- [Architecture](docs/architecture.md)
- [Database](docs/database.md)

## Planned Later

Not implemented yet:

- scheduler
- Telegram integration
- final chat/API behavior
- web frontend
- LLM-driven execution routing
