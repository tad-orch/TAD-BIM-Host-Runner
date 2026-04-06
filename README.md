# TAD BIM Host Runner

Phase 1 Revit MCP Gateway that sits between OpenClaw or other clients and Windows-based machine bridges. The gateway keeps the existing execution engine, host registry, bridge client, local job store, polling, and audit trail, while adding an MCP-friendly entry layer for discipline-based Revit tools.

## Phase 1 Architecture

Current execution chain:

1. client calls a friendly MCP-facing tool on this gateway
2. the gateway validates structured input and maps it to the existing internal execution envelope
3. the existing execution service dispatches to the configured bridge host
4. the Windows bridge forwards to the Revit add-in
5. async work is still tracked locally through `data/jobs.json` and `GET /jobs/:jobId`

Phase 1 stays deterministic by design:

- no LLM call is made for `mcp-arch-system-health`
- no LLM call is made for `mcp-arch-walls-create`
- `OLLAMA_*` env vars are accepted for future modes only and are not part of the critical execution path

## Scope

Implemented MCP-facing tools:

- `mcp-arch-system-health` -> internal `revit_ping`
- `mcp-arch-walls-create` -> internal `revit_create_wall`

Implemented internal bridge tools:

- `revit_ping` via a synchronous bridge call
- `revit_create_wall` via async submit + local job persistence + polling

Prepared for later additions:

- `revit_open_model`
- `revit_export_views`
- `revit_export_nwc`
- `navis_run_clash`
- `get_acc_projects`
- `get_acc_project_users`

Not implemented by design:

- arbitrary shell execution
- any generic command runner
- external queues, auth providers, Docker, or multi-service orchestration

## Stack

- TypeScript
- Fastify
- Zod validation
- Local durable JSON persistence in `data/jobs.json`
- Append-only audit log in `data/audit.log.jsonl`

The repo started empty, so the persistence choice is intentionally lightweight and local to this runner.

## Endpoints

### `POST /mcp/tools/:toolName`

MCP-facing tool execution entrypoint. In Phase 1 the gateway exposes:

- `mcp-arch-system-health`
- `mcp-arch-walls-create`

External MCP-facing contract:

- tool name is carried in the route
- payloads stay friendly and typed
- the gateway translates them to the existing internal `/execute` contract
- the response includes both the friendly `tool` name and the mapped `internalTool`

`mcp-arch-system-health` request:

```json
{
  "targetHost": "tad-bim-01"
}
```

`mcp-arch-walls-create` request using `length`:

```json
{
  "targetHost": "tad-bim-01",
  "length": 15,
  "wallType": "Generic - 200mm",
  "level": "Level 1",
  "height": 3
}
```

`mcp-arch-walls-create` request using coordinates:

```json
{
  "targetHost": "tad-bim-01",
  "start": { "x": 0, "y": 0, "z": 0 },
  "end": { "x": 0, "y": 15, "z": 0 },
  "wallType": "Generic - 200mm",
  "level": "Level 1",
  "height": 3
}
```

Wall mapping rules:

- `documentPath` is always mapped internally to `"active"`
- if `length` is provided, the gateway creates:
  - `start = { "x": 0, "y": 0, "z": 0 }`
  - `end = { "x": 0, "y": length, "z": 0 }`
- `level` maps to `levelName`
- `height` maps to `unconnectedHeight`
- `wallType` defaults to `"first_available_generic"`
- `level` defaults to `"Level 1"`
- `height` defaults to `3`

Example response:

```json
{
  "requestId": "req_123",
  "jobId": null,
  "status": "completed",
  "tool": "mcp-arch-system-health",
  "internalTool": "revit_ping",
  "targetHost": "tad-bim-01",
  "result": {
    "ok": true
  },
  "error": null
}
```

### `POST /execute`

Internal execution envelope preserved for debugging and transition:

```json
{
  "requestId": "req_123",
  "sessionId": "macmini-01",
  "source": "openclaw",
  "targetHost": "tad-ops-01",
  "tool": "revit_ping",
  "mode": "sync",
  "args": {},
  "meta": {
    "user": "emnss26",
    "timestamp": "2026-03-30T15:20:00Z"
  }
}
```

The internal path still performs:

- envelope shape
- tool whitelist
- tool mode matches registry definition
- target host exists in host registry
- tool is enabled for the target host
- tool-specific args schema

Success response shape:

```json
{
  "requestId": "req_123",
  "jobId": null,
  "status": "completed",
  "tool": "revit_ping",
  "targetHost": "tad-ops-01",
  "result": {
    "ok": true
  },
  "error": null
}
```

Error response shape:

```json
{
  "requestId": "req_123",
  "jobId": null,
  "status": "failed",
  "tool": "revit_ping",
  "targetHost": "tad-ops-01",
  "result": null,
  "error": {
    "code": "bridge_unreachable",
    "message": "Bridge is unreachable."
  }
}
```

Status code behavior:

- `200` for sync completion or an async submission that already completed
- `202` for accepted/running async jobs
- `400` for invalid payload, unknown tool, invalid mode, or tool/host mismatch
- `404` for unknown host
- `502` for bridge failure or remote execution failure
- `504` for bridge timeout or job timeout

### `GET /jobs/:jobId`

Returns the persisted local async job record:

```json
{
  "jobId": "job_123",
  "requestId": "req_123",
  "tool": "revit_create_wall",
  "targetHost": "tad-ops-01",
  "mode": "async",
  "status": "running",
  "createdAt": "2026-03-30T15:20:00.000Z",
  "updatedAt": "2026-03-30T15:20:01.000Z",
  "completedAt": null,
  "result": null,
  "error": null
}
```

### `GET /health`

Returns a minimal service health response plus the configured tools and hosts.

## Internal vs MCP Contracts

- MCP-facing tools:
  - `mcp-arch-system-health` -> `revit_ping`
  - `mcp-arch-walls-create` -> `revit_create_wall`
- Internal bridge-facing tools remain:
  - `revit_ping`
  - `revit_create_wall`
- The gateway does not change the current bridge submit or polling paths:
  - `POST /tools/revit_ping`
  - `POST /tools/revit_create_wall`
  - `GET /jobs/:jobId`

## Discipline-Based Naming

The MCP-facing namespace is organized to scale by discipline and element family:

- architecture:
  - `mcp-arch-system-health`
  - `mcp-arch-walls-create`
  - reserved structure for `mcp-arch-floors-*`
  - reserved structure for `mcp-arch-roofs-*`
- structure:
  - reserved structure for `mcp-str-columns-*`
  - reserved structure for `mcp-str-beams-*`
- MEP:
  - reserved structure for `mcp-mep-pipes-*`

## Configured Tools

Current tool registry:

- `revit_ping`
  - mode: `sync`
  - bridge path: `POST /tools/revit_ping`
  - args: `{}` only
- `revit_create_wall`
  - mode: `async`
  - bridge path: `POST /tools/revit_create_wall`
  - poll path: `GET /jobs/:jobId`
  - args:

```json
{
  "documentPath": "C:/models/sample.rvt",
  "levelName": "Level 1",
  "wallType": "Generic - 8\"",
  "start": { "x": 0, "y": 0, "z": 0 },
  "end": { "x": 15, "y": 0, "z": 0 },
  "unconnectedHeight": 10
}
```

Adding a future tool only needs:

1. a Zod args schema
2. a new MCP-facing tool definition when needed
3. a new internal tool registry entry
4. bridge path mapping

## Configured Hosts

Default host registry when `HOSTS_JSON` is not set:

- `tad-ops-01` -> `http://127.0.0.1:3001`
- `tad-bim-01` -> `http://127.0.0.1:3002`

Both default hosts are marked as `revit-bridge` machines and currently enable:

- `revit_ping`
- `revit_create_wall`

Override the host registry with `HOSTS_JSON`:

```json
[
  {
    "id": "tad-ops-01",
    "baseUrl": "http://10.0.0.25:3001",
    "machineType": "revit-bridge",
    "capabilities": ["revit"],
    "enabledTools": ["revit_ping", "revit_create_wall"],
    "headers": {
      "x-bridge-key": "replace-me"
    }
  }
]
```

## Sync vs Async Flow

`revit_ping`:

1. validate request and tool args
2. route to the target host bridge
3. return immediate completion
4. record a minimal sync execution entry and audit log entry

`revit_create_wall`:

1. validate request and tool args
2. submit the job to the target host bridge
3. persist a local job record with a generated local `jobId`
4. poll the bridge until `completed`, `failed`, or `timeout`
5. update `data/jobs.json` as status changes
6. expose the latest state from `GET /jobs/:jobId`

On startup, the service resumes polling any persisted jobs still marked `accepted` or `running`.

## Persistence and Audit

Files written under `DATA_DIR`:

- `jobs.json`
  - async jobs keyed by local `jobId`
  - sync execution records keyed by `requestId`
- `audit.log.jsonl`
  - append-only JSON lines

Audit entries include:

- timestamp
- requestId
- jobId when present
- tool
- targetHost
- source
- outcome/status
- duration when available
- sanitized args summary
- sanitized error summary

Secrets are never copied into the audit log.

## Bridge Contract Assumptions

No bridge repo or adjacent contract was present locally, so the adapter uses conservative assumptions:

- sync submit: `POST /tools/revit_ping`
- async submit: `POST /tools/revit_create_wall`
- async poll: `GET /jobs/:jobId`

Expected bridge payload sent by this runner:

```json
{
  "requestId": "req_123",
  "sessionId": "macmini-01",
  "source": "openclaw",
  "targetHost": "tad-ops-01",
  "tool": "revit_create_wall",
  "mode": "async",
  "args": {
    "documentPath": "C:/models/sample.rvt",
    "levelName": "Level 1",
    "wallType": "Generic - 8\"",
    "start": { "x": 0, "y": 0, "z": 0 },
    "end": { "x": 15, "y": 0, "z": 0 },
    "unconnectedHeight": 10
  },
  "meta": {
    "user": "emnss26",
    "timestamp": "2026-03-30T15:20:00Z"
  }
}
```

Expected bridge responses:

- sync success: any `2xx` JSON body, ideally `{ "status": "completed", "result": { ... } }`
- async ack: `{ "status": "accepted", "jobId": "bridge-job-123" }`
- async poll: `{ "status": "running" }` or `{ "status": "completed", "result": { ... } }`

If the bridge returns `pollPath`, the runner stores and uses it for subsequent polling.

## Run Locally

Install and start:

```bash
npm install
npm run dev
```

Environment variables:

- `HOST`
- `PORT`
- `DATA_DIR`
- `HOSTS_JSON`
- `BRIDGE_REQUEST_TIMEOUT_MS`
- `POLL_INTERVAL_MS`
- `POLL_TIMEOUT_MS`
- `OLLAMA_BASE_URL`
  - default: `http://127.0.0.1:11434`
  - future natural-language mode only, unused in Phase 1 execution
- `OLLAMA_MODEL`
  - default: `qwen3:14b`
  - future natural-language mode only, unused in Phase 1 execution

Production build:

```bash
npm run build
npm start
```

## Test

Automated:

```bash
npm test
npm run build
```

Covered test cases:

- unknown tool rejection
- sync `revit_ping` end-to-end execution
- async `revit_create_wall` submit, polling, and persisted completion
- MCP `mcp-arch-system-health` -> `revit_ping` mapping
- MCP `mcp-arch-walls-create` length mapping and async `/jobs/:jobId` flow
- MCP `mcp-arch-walls-create` coordinate-based input validation and dispatch

## Manual Verification

Example MCP health request:

```bash
curl -X POST http://127.0.0.1:8080/mcp/tools/mcp-arch-system-health \
  -H "content-type: application/json" \
  -d '{
    "targetHost": "tad-bim-01"
  }'
```

Example MCP wall request:

```bash
curl -X POST http://127.0.0.1:8080/mcp/tools/mcp-arch-walls-create \
  -H "content-type: application/json" \
  -d '{
    "targetHost": "tad-bim-01",
    "length": 15,
    "wallType": "Generic - 200mm",
    "level": "Level 1",
    "height": 3
  }'
```

Then poll the local job:

```bash
curl http://127.0.0.1:8080/jobs/<local-job-id>
```

Example sync request:

```bash
curl -X POST http://127.0.0.1:8080/execute \
  -H "content-type: application/json" \
  -d '{
    "requestId": "req_ping_01",
    "sessionId": "macmini-01",
    "source": "openclaw",
    "targetHost": "tad-ops-01",
    "tool": "revit_ping",
    "mode": "sync",
    "args": {},
    "meta": {
      "user": "emnss26",
      "timestamp": "2026-03-30T15:20:00Z"
    }
  }'
```

Example async request:

```bash
curl -X POST http://127.0.0.1:8080/execute \
  -H "content-type: application/json" \
  -d '{
    "requestId": "req_wall_01",
    "sessionId": "macmini-01",
    "source": "openclaw",
    "targetHost": "tad-ops-01",
    "tool": "revit_create_wall",
    "mode": "async",
    "args": {
      "documentPath": "C:/models/sample.rvt",
      "levelName": "Level 1",
      "wallType": "Generic - 8\"",
      "start": { "x": 0, "y": 0, "z": 0 },
      "end": { "x": 15, "y": 0, "z": 0 },
      "unconnectedHeight": 10
    },
    "meta": {
      "user": "emnss26",
      "timestamp": "2026-03-30T15:20:00Z"
    }
  }'
```

Then poll the local job:

```bash
curl http://127.0.0.1:8080/jobs/<local-job-id>
```
