# TAD BIM Host Runner

Minimal host-runner service that sits between OpenClaw and machine-specific bridges. The runner only accepts structured tool requests, validates them against a whitelist, routes them to a configured bridge host, persists async job state locally, and returns clean envelopes.

## Scope

Implemented MVP tools:

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

### `POST /execute`

Request envelope:

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

Validation performed before execution:

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
2. a new tool registry entry
3. bridge path mapping

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

## Manual Verification

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
