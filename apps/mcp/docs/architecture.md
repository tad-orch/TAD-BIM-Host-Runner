# Architecture

## Role of This Repository

`apps/mcp` is now the single backend for the current system inside this workspace. It is responsible for:

- MCP-facing Revit tool routing
- APS metadata discovery for ACC/BIM 360 backed models
- the existing internal execution pipeline
- job orchestration and polling
- SQLite-backed persistence
- backend foundations for future chat/API flows
- the first deterministic chat-style API for the future UI

It is intentionally not responsible for Windows execution-node behavior. `TAD-Bridge-OC` remains the separate bridge/execution-node repository.

## Three-Repo Responsibility Split

The current system is intentionally split across three repositories:

- `TadOcRevitBridge`
  - executes real Revit API actions
  - owns live session/document state
  - opens cloud models from GUIDs and region
  - lists 3D views and exports NWC
- `TAD-Bridge-OC`
  - exposes the Windows-local HTTP surface
  - performs process/session prechecks
  - launches Revit when needed
  - relays structured requests and results to and from the add-in
- `TAD-BIM-Host-Runner`
  - exposes typed MCP and backend API contracts
  - resolves host routing
  - persists jobs, audit logs, conversations, and messages
  - performs APS discovery before Revit execution when cloud-model metadata is needed

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
- `GET /api/aps/projects`
- `GET /api/aps/projects/:projectId/top-folders`
- `GET /api/aps/projects/:projectId/folders/:folderId/contents`
- `GET /api/aps/projects/:projectId/items/:itemId/cloud-model-info`
- SQLite initialization on startup
- host seeding into SQLite
- SQLite-backed jobs and audit logs
- SQLite-backed conversations and messages
- deterministic chat routing for health, session-status, launch, and wall creation
- APS discovery with two-legged Autodesk Platform Services auth

## Revit Operational Workflow

The next operational Revit workflow is now wired through the existing MCP and execution pipeline:

1. `mcp-arch-revit-session-status`
2. `mcp-arch-revit-launch`
3. APS discovery to resolve project and model GUIDs
4. `mcp-arch-revit-open-cloud-model`
5. `mcp-arch-revit-list-3d-views`
6. `mcp-arch-revit-export-nwc`

The data flow for cloud-backed Revit models is:

1. APS Data Management routes resolve the ACC/BIM 360 project, folder, item, and version metadata.
2. `apps/mcp` extracts `projectGuid`, `modelGuid`, and `region` from APS metadata.
3. the client calls `mcp-arch-revit-open-cloud-model` with explicit typed identifiers
4. `ExecutionService` dispatches to the configured bridge host
5. the bridge relays the request to the Revit add-in
6. the add-in opens the model and returns the structured result back through the same path

These tools intentionally reuse the same path as the current wall and health tools:

- friendly MCP payload validation in `src/mcp/*`
- internal tool validation in `ToolRegistry`
- dispatch through `ExecutionService`
- bridge calls through `BridgeClient`
- job persistence and polling through `JobStore` and `PollingService`
- audit logging through `AuditService`

APS discovery intentionally stays separate from Revit execution:

- APS discovery lives in `src/integrations/aps`
- HTTP exposure lives in `src/api/routes/aps.ts`
- two-legged auth and token caching live entirely inside the backend
- the bridge and add-in do not call APS directly in this phase

The APS integration supports the current environment naming conventions already used in this workflow:

- `APS_CLIENT_ID`
- `APS_CLIENT_SECRET`
- `APS_BASE_URL`
- `APS_SCOPES`
- `APS_ACCOUNT_ID`
- `APS_USER_ID`
- `APS_TOKEN_STORAGE_PATH`
- `APS_CALLBACK_URL`
  - optional only
  - reserved for future three-legged flows
  - not required for this discovery MVP

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

- `revit_launch` is live and sync at the bridge, so the backend now treats it as a sync tool
- `mcp-arch-revit-open-cloud-model` now uses `projectGuid` as the canonical field, because that is what the add-in actually requires
- temporary MCP compatibility aliases are still accepted for cloud opening:
  - `projectId`
  - `openInCurrentSession`
  - `detach`
- APS discovery currently assumes a two-legged APS app with access to the relevant ACC/BIM 360 account data
- region is inferred conservatively from APS hub/project metadata
  - `US` and `EMEA` are supported directly
  - `EU` is normalized to `EMEA`
  - other values are returned as `null` instead of guessed
- existing seeded hosts in SQLite remain the source of truth, so their `enabled_tools` must include the new internal tools before the backend can dispatch them
- cloud model opening requires explicit `projectGuid`, `modelGuid`, and `region`; it is intentionally not inferred from chat text
- `TAD-Bridge-OC` currently exposes routes for `revit_open_cloud_model`, `revit_list_3d_views`, and `revit_export_nwc`, but its action files still return `NOT_IMPLEMENTED` instead of queueing to the add-in even though the add-in already implements those tools

## What Is Intentionally Deferred

- scheduler/orchestration queue
- Telegram integration
- web frontend
- LLM-driven interpretation on the execution path
- richer UI-oriented APIs such as pagination and streaming

The `OLLAMA_*` settings remain future-facing only. Phase 4 execution still stays deterministic.
