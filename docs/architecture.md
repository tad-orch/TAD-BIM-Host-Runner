# Architecture

## Role of This Repository

`TAD-BIM-Host-Runner` is now the single backend for the current system. It is responsible for:

- MCP-facing Revit tool routing
- the existing internal execution pipeline
- job orchestration and polling
- SQLite-backed persistence
- backend foundations for future chat/API flows

It is intentionally not responsible for Windows execution-node behavior. `TAD-Bridge-OC` remains the separate bridge/execution-node repository.

## Current Request Flow

1. A client calls an MCP route such as `POST /mcp/tools/mcp-arch-walls-create`.
2. The MCP layer validates the friendly payload and maps it to the existing internal execution contract.
3. `ExecutionService` validates the internal tool, host, mode, and args against the existing registries.
4. `BridgeClient` dispatches the request to the configured execution-node bridge.
5. Async jobs are persisted in SQLite and polled through the existing `/jobs/:jobId` flow.
6. Audit events are written to SQLite as execution state changes.

The bridge-facing contract is unchanged:

- `revit_ping`
- `revit_create_wall`
- `POST /tools/revit_ping`
- `POST /tools/revit_create_wall`
- `GET /jobs/:jobId`

## Backend Layout

Current source layout is organized around layers:

- `src/app.ts`, `src/server.ts`
  - bootstrap, dependency wiring, Fastify startup
- `src/api/routes/*`
  - HTTP route layer for health, jobs, execute, MCP, hosts, and conversations
- `src/mcp/*`
  - MCP schemas, tool definitions, and friendly-to-internal mappings
- `src/db/*`
  - SQLite client, schema bootstrap, and repositories
- `src/services/*`
  - execution, polling, audit, and future chat-oriented services
- `src/clients/*`
  - bridge HTTP client
- `src/registry/*`
  - host and tool registry logic
- `src/lib/*`
  - errors, ids, and utilities

Legacy route modules under `src/routes/*` and `src/mcp/routes.ts` now act as compatibility re-exports so the route layer remains clearly centered in `src/api/routes/*`.

## What Is Implemented Now

- `GET /health`
- `POST /execute`
- `GET /jobs/:jobId`
- `POST /mcp/tools/mcp-arch-system-health`
- `POST /mcp/tools/mcp-arch-walls-create`
- `GET /api/hosts`
- `GET /api/conversations`
- `GET /api/conversations/:id/messages`
- SQLite initialization on startup
- host seeding into SQLite
- SQLite-backed jobs and audit logs

## What Is Intentionally Deferred

- scheduler/orchestration queue
- Telegram integration
- web frontend
- final `/api/chat` behavior
- LLM-driven interpretation on the execution path

The `OLLAMA_*` settings remain future-facing only. Phase 1 and Phase 2 execution stays deterministic.
