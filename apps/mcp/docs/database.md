# Database

## Location

SQLite is now the primary persistence layer.

- env var: `SQLITE_DB_PATH`
- default: `${DATA_DIR}/app.db`
- default on disk in this repo: `apps/mcp/data/app.db`

Schema bootstrap runs automatically on startup through:

- `src/db/client.ts`
- `src/db/migrate.ts`
- `src/db/schema.sql`

## Tables

### `hosts`

Stores backend host definitions previously sourced only from `HOSTS_JSON`.

Key fields:

- `id`
- `base_url`
- `machine_type`
- `capabilities_json`
- `enabled_tools_json`
- `headers_json`
- `is_active`
- `created_at`
- `updated_at`

### `jobs`

Stores persisted execution records.

Key fields:

- `job_id`
- `request_id`
- `remote_job_id`
- `poll_path`
- `tool`
- `internal_tool`
- `target_host`
- `mode`
- `status`
- `source`
- `session_id`
- `args_json`
- `result_json`
- `error_json`
- `created_at`
- `updated_at`
- `completed_at`
- `duration_ms`

Notes:

- async jobs back `GET /jobs/:jobId`
- sync executions are also recorded in this table using `mode = 'sync'`
- `poll_path` is stored to preserve bridge-provided async polling paths across restarts

Indexes:

- `idx_jobs_status`
- `idx_jobs_target_host`
- `idx_jobs_created_at`

### `audit_logs`

Append-only execution audit history.

Key fields:

- `timestamp`
- `request_id`
- `job_id`
- `tool`
- `target_host`
- `source`
- `outcome`
- `duration_ms`
- `args_summary_json`
- `error_summary_json`

Index:

- `idx_audit_logs_timestamp`

### `conversations`

Conversation container used by `POST /api/chat` and future UI workflows.

Key fields:

- `id`
- `title`
- `user_id`
- `target_host`
- `created_at`
- `updated_at`

### `messages`

Conversation message history persisted by `POST /api/chat` and read through `GET /api/conversations/:id/messages`.

Key fields:

- `id`
- `conversation_id`
- `role`
- `content`
- `tool_name`
- `job_id`
- `created_at`

Index:

- `idx_messages_conversation_created_at`

## Host Seeding Strategy

On startup:

1. if the `hosts` table already has rows, the backend uses SQLite as the source of truth
2. if the table is empty and `HOSTS_JSON` is present, those hosts are inserted into SQLite
3. if the table is empty and `HOSTS_JSON` is not present, the current default hosts are inserted into SQLite

This keeps backward compatibility while making the database authoritative after first bootstrap.

## Storage Responsibilities After Phase 2

SQLite now owns persistence for:

- hosts
- jobs
- audit logs
- conversations
- messages

The previous JSON file persistence for `jobs.json` and `audit.log.jsonl` is no longer used by the running application.

## Phase 4 Usage Notes

- `GET /api/jobs` and `GET /api/jobs/:jobId` read directly from the `jobs` table
- `POST /api/chat` writes to `conversations` and `messages`
- when `/api/chat` invokes a tool, the assistant message stores:
  - `tool_name`
  - `job_id` when a local job exists
- unsupported chat requests still persist both the user message and the assistant reply

## Operational Tooling Notes

The new Revit operational tools use the same tables and flow as the existing ones:

- sync tools such as `revit_session_status`, `revit_launch`, and `revit_list_3d_views` are recorded in `jobs` with `mode = 'sync'`
- async tools such as `revit_open_cloud_model` and `revit_export_nwc` persist local jobs, remote job ids, poll paths, and final results/errors in `jobs`
- audit entries continue to record request id, tool, host, outcome, duration, arg summary, and error summary

Host availability caveat:

- if a host already exists in SQLite, its `enabled_tools_json` must be updated to include the new internal tools before those tools can be dispatched
- `HOSTS_JSON` only seeds hosts when the table is empty
