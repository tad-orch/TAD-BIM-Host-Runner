# Architecture

## Role of This Repository

`apps/mcp` is now the single backend for the current system inside this workspace. It is responsible for:

- MCP-facing Revit tool routing
- the existing internal execution pipeline
- job orchestration and polling
- SQLite-backed persistence
- backend foundations for future chat/API flows
- the first deterministic chat-style API for the future UI

It is intentionally not responsible for Windows execution-node behavior. `TAD-Bridge-OC` remains the separate bridge/execution-node repository.

## Current Request Flow

1. A client calls an MCP route such as `POST /mcp/tools/mcp-arch-walls-create`.
2. The MCP layer validates the friendly payload and maps it to the existing internal execution contract.
3. `ExecutionService` validates the internal tool, host, mode, and args against the existing registries.
4. `BridgeClient` dispatches the request to the configured execution-node bridge.
5. Async jobs are persisted in SQLite and polled through the existing `/jobs/:jobId` flow.
6. Audit events are written to SQLite as execution state changes.

For `POST /api/chat`, the flow is:

1. the route persists the user message into a conversation
2. `ChatService` applies deterministic routing rules to the text
3. if a supported tool is recognized, `McpService` invokes the same MCP execution path used by the MCP HTTP route
4. the assistant response is persisted with `tool_name` and `job_id` when applicable
5. the updated conversation, messages, and job are returned to the client

The bridge-facing contract is unchanged:

- `revit_ping`
- `revit_create_wall`
- `revit_session_status`
- `revit_launch`
- `revit_open_cloud_model`
- `revit_list_3d_views`
- `revit_export_nwc`
- `POST /tools/revit_ping`
- `POST /tools/revit_create_wall`
- `POST /tools/revit_session_status`
- `POST /tools/revit_launch`
- `POST /tools/revit_open_cloud_model`
- `POST /tools/revit_list_3d_views`
- `POST /tools/revit_export_nwc`
- `GET /jobs/:jobId`

## Backend Layout

Current backend source layout under `apps/mcp` is organized around layers:

- `src/app.ts`, `src/server.ts`
  - bootstrap, dependency wiring, Fastify startup
- `src/api/routes/*`
  - HTTP route layer for health, jobs, execute, MCP, chat, hosts, and conversations
- `src/mcp/*`
  - MCP schemas, tool definitions, and friendly-to-internal mappings
- `src/db/*`
  - SQLite client, schema bootstrap, and repositories
- `src/services/*`
  - execution, polling, audit, MCP invocation, and chat orchestration services
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
- `POST /mcp/tools/mcp-arch-revit-session-status`
- `POST /mcp/tools/mcp-arch-revit-launch`
- `POST /mcp/tools/mcp-arch-revit-open-cloud-model`
- `POST /mcp/tools/mcp-arch-revit-list-3d-views`
- `POST /mcp/tools/mcp-arch-revit-export-nwc`
- `GET /api/hosts`
- `GET /api/jobs`
- `GET /api/jobs/:jobId`
- `GET /api/conversations`
- `GET /api/conversations/:id/messages`
- `POST /api/chat`
- SQLite initialization on startup
- host seeding into SQLite
- SQLite-backed jobs and audit logs
- SQLite-backed conversations and messages
- deterministic chat routing for health, session-status, launch, and wall creation

## Revit Operational Workflow

The next operational Revit workflow is now wired through the existing MCP and execution pipeline:

1. `mcp-arch-revit-session-status`
2. `mcp-arch-revit-launch`
3. `mcp-arch-revit-open-cloud-model`
4. `mcp-arch-revit-list-3d-views`
5. `mcp-arch-revit-export-nwc`

These tools intentionally reuse the same path as the current wall and health tools:

- friendly MCP payload validation in `src/mcp/*`
- internal tool validation in `ToolRegistry`
- dispatch through `ExecutionService`
- bridge calls through `BridgeClient`
- job persistence and polling through `JobStore` and `PollingService`
- audit logging through `AuditService`

Current chat support stays narrow and deterministic:

- supported in `/api/chat`
  - Revit health checks
  - Revit session status checks
  - Revit launch requests
  - wall creation with numeric length
- not yet routed from `/api/chat`
  - cloud model opening
  - 3D view listing
  - NWC export

## Current Limitations

- the new tools depend on matching bridge/add-in support for the new bridge tool names
- existing seeded hosts in SQLite remain the source of truth, so their `enabled_tools` must include the new internal tools before the backend can dispatch them
- cloud model opening requires explicit `projectId`, `modelGuid`, and `region`; it is intentionally not inferred from chat text

## What Is Intentionally Deferred

- scheduler/orchestration queue
- Telegram integration
- web frontend
- LLM-driven interpretation on the execution path
- richer UI-oriented APIs such as pagination and streaming

The `OLLAMA_*` settings remain future-facing only. Phase 4 execution still stays deterministic.
