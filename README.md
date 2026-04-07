# TAD BIM Host Runner

Single backend/API/MCP gateway for Revit automation. This service keeps the existing bridge execution pipeline intact while now using SQLite as the primary persistence layer for hosts, jobs, audit logs, conversations, and messages.

## What It Does Now

- exposes MCP-facing Revit routes
- preserves the existing `/execute` and `/jobs/:jobId` execution flow
- dispatches to external execution-node bridges without absorbing bridge logic
- persists runtime state in SQLite
- provides the first real backend API surface for the future UI

Implemented routes:

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

## API Chat

`POST /api/chat` is the Phase 4 backend entrypoint for a future web UI text box.

Request body:

```json
{
  "message": "Create a 15 meter wall in Revit using Generic - 200mm on Level 3",
  "conversationId": "optional-existing-id",
  "targetHost": "optional"
}
```

Behavior:

- creates a conversation automatically when `conversationId` is omitted
- persists the user message and assistant message in SQLite
- reuses the current MCP execution flow instead of calling the bridge directly
- returns the updated conversation, persisted messages, the selected tool, and the job when one exists

Deterministic routing rules currently implemented:

- health intent:
  - requests mentioning Revit or the host plus health, status, availability, running state, reachable, or ping
  - routed to `mcp-arch-system-health`
- wall intent:
  - requests mentioning create/draw/model/build plus wall
  - requires a numeric length
  - routed to `mcp-arch-walls-create`
- wall extraction:
  - length from phrases such as `15 meter wall`
  - wall type from a quoted string or recognizable values such as `Generic - 200mm`
  - level from `Level X`
  - height from `height` or `altura`
  - defaults: `wallType = "first_available_generic"`, `level = "Level 1"`, `height = 3`
- unsupported requests:
  - return a clear assistant message without invoking a tool

Example response:

```json
{
  "conversation": {
    "id": "conv_123",
    "title": "Create a 15 meter wall in Revit using Generic - 200mm on Level 3",
    "userId": null,
    "targetHost": "tad-bim-01",
    "createdAt": "2026-04-06T12:00:00.000Z",
    "updatedAt": "2026-04-06T12:00:02.000Z"
  },
  "messages": [
    {
      "id": "msg_1",
      "conversationId": "conv_123",
      "role": "user",
      "content": "Create a 15 meter wall in Revit using Generic - 200mm on Level 3",
      "toolName": null,
      "jobId": null,
      "createdAt": "2026-04-06T12:00:00.000Z"
    },
    {
      "id": "msg_2",
      "conversationId": "conv_123",
      "role": "assistant",
      "content": "Wall creation was submitted on host 'tad-bim-01'. Track local job 'job_123'.",
      "toolName": "mcp-arch-walls-create",
      "jobId": "job_123",
      "createdAt": "2026-04-06T12:00:02.000Z"
    }
  ],
  "job": {
    "jobId": "job_123",
    "requestId": "req_123",
    "remoteJobId": "bridge-wall-123",
    "tool": "revit_create_wall",
    "targetHost": "tad-bim-01",
    "mode": "async",
    "status": "accepted"
  },
  "tool": "mcp-arch-walls-create"
}
```

## API Jobs

`GET /api/jobs` returns latest-first job records from SQLite and supports optional query filters:

- `status`
- `targetHost`
- `tool`

`GET /api/jobs/:jobId` returns the stored job row by local `jobId`. The legacy `GET /jobs/:jobId` route remains unchanged for the existing async job flow.

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
- LLM-assisted chat interpretation
- web frontend
- richer conversation/user management and pagination

Phase 5 is expected to consume:

- `POST /api/chat`
- `GET /api/jobs`
- `GET /api/jobs/:jobId`
- `GET /api/hosts`
- `GET /api/conversations`
- `GET /api/conversations/:id/messages`
