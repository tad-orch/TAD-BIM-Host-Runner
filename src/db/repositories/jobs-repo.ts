import type Database from "better-sqlite3";

import type { JobQueryFilters, JobRecord, StoredJobRecord, SyncExecutionRecord } from "../../types";

interface JobRow {
  job_id: string;
  request_id: string;
  remote_job_id: string | null;
  poll_path: string | null;
  tool: string;
  internal_tool: string | null;
  target_host: string;
  mode: string;
  status: JobRecord["status"];
  source: string | null;
  session_id: string | null;
  args_json: string | null;
  result_json: string | null;
  error_json: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  duration_ms: number | null;
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }

  return JSON.parse(value) as T;
}

function createSyncJobId(requestId: string): string {
  return `sync:${requestId}`;
}

function toAsyncJobRecord(row: JobRow): JobRecord {
  return {
    jobId: row.job_id,
    remoteJobId: row.remote_job_id ?? row.job_id,
    pollPath: row.poll_path ?? undefined,
    requestId: row.request_id,
    tool: row.tool as JobRecord["tool"],
    targetHost: row.target_host,
    mode: "async",
    status: row.status,
    source: row.source ?? "",
    sessionId: row.session_id ?? "",
    argsSummary: parseJson<Record<string, unknown>>(row.args_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined,
    durationMs: row.duration_ms ?? undefined,
    result: parseJson<unknown | null>(row.result_json, null),
    error: parseJson<JobRecord["error"]>(row.error_json, null),
  };
}

function toStoredJobRecord(row: JobRow): StoredJobRecord {
  return {
    jobId: row.job_id,
    requestId: row.request_id,
    remoteJobId: row.remote_job_id,
    pollPath: row.poll_path,
    tool: row.tool,
    internalTool: row.internal_tool,
    targetHost: row.target_host,
    mode: row.mode === "sync" ? "sync" : "async",
    status: row.status,
    source: row.source,
    sessionId: row.session_id,
    args: parseJson<Record<string, unknown>>(row.args_json, {}),
    result: parseJson<unknown | null>(row.result_json, null),
    error: parseJson<StoredJobRecord["error"]>(row.error_json, null),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    durationMs: row.duration_ms,
  };
}

export class JobsRepository {
  constructor(private readonly db: Database.Database) {}

  saveJob(job: JobRecord): void {
    this.db
      .prepare(
        `
          INSERT INTO jobs (
            job_id, request_id, remote_job_id, poll_path, tool, internal_tool, target_host,
            mode, status, source, session_id, args_json, result_json, error_json,
            created_at, updated_at, completed_at, duration_ms
          )
          VALUES (
            @job_id, @request_id, @remote_job_id, @poll_path, @tool, @internal_tool, @target_host,
            @mode, @status, @source, @session_id, @args_json, @result_json, @error_json,
            @created_at, @updated_at, @completed_at, @duration_ms
          )
          ON CONFLICT(job_id) DO UPDATE SET
            request_id = excluded.request_id,
            remote_job_id = excluded.remote_job_id,
            poll_path = excluded.poll_path,
            tool = excluded.tool,
            internal_tool = excluded.internal_tool,
            target_host = excluded.target_host,
            mode = excluded.mode,
            status = excluded.status,
            source = excluded.source,
            session_id = excluded.session_id,
            args_json = excluded.args_json,
            result_json = excluded.result_json,
            error_json = excluded.error_json,
            updated_at = excluded.updated_at,
            completed_at = excluded.completed_at,
            duration_ms = excluded.duration_ms
        `,
      )
      .run({
        job_id: job.jobId,
        request_id: job.requestId,
        remote_job_id: job.remoteJobId,
        poll_path: job.pollPath ?? null,
        tool: job.tool,
        internal_tool: job.tool,
        target_host: job.targetHost,
        mode: job.mode,
        status: job.status,
        source: job.source,
        session_id: job.sessionId,
        args_json: JSON.stringify(job.argsSummary),
        result_json: JSON.stringify(job.result),
        error_json: JSON.stringify(job.error),
        created_at: job.createdAt,
        updated_at: job.updatedAt,
        completed_at: job.completedAt ?? null,
        duration_ms: job.durationMs ?? null,
      });
  }

  recordSyncExecution(execution: SyncExecutionRecord): void {
    const jobId = createSyncJobId(execution.requestId);
    const completedAt =
      execution.status === "completed" || execution.status === "failed" || execution.status === "timeout"
        ? execution.updatedAt
        : null;

    this.db
      .prepare(
        `
          INSERT INTO jobs (
            job_id, request_id, remote_job_id, poll_path, tool, internal_tool, target_host,
            mode, status, source, session_id, args_json, result_json, error_json,
            created_at, updated_at, completed_at, duration_ms
          )
          VALUES (
            @job_id, @request_id, NULL, NULL, @tool, @internal_tool, @target_host,
            @mode, @status, @source, @session_id, @args_json, @result_json, @error_json,
            @created_at, @updated_at, @completed_at, @duration_ms
          )
          ON CONFLICT(job_id) DO UPDATE SET
            status = excluded.status,
            source = excluded.source,
            session_id = excluded.session_id,
            args_json = excluded.args_json,
            result_json = excluded.result_json,
            error_json = excluded.error_json,
            updated_at = excluded.updated_at,
            completed_at = excluded.completed_at,
            duration_ms = excluded.duration_ms
        `,
      )
      .run({
        job_id: jobId,
        request_id: execution.requestId,
        tool: execution.tool,
        internal_tool: execution.tool,
        target_host: execution.targetHost,
        mode: execution.mode,
        status: execution.status,
        source: execution.source,
        session_id: execution.sessionId,
        args_json: JSON.stringify(execution.argsSummary),
        result_json: JSON.stringify(execution.result),
        error_json: JSON.stringify(execution.error),
        created_at: execution.createdAt,
        updated_at: execution.updatedAt,
        completed_at: completedAt,
        duration_ms: execution.durationMs ?? null,
      });
  }

  getJob(jobId: string): JobRecord | null {
    const row = this.db
      .prepare(
        `
          SELECT job_id, request_id, remote_job_id, poll_path, tool, internal_tool, target_host,
                 mode, status, source, session_id, args_json, result_json, error_json,
                 created_at, updated_at, completed_at, duration_ms
          FROM jobs
          WHERE job_id = ? AND mode = 'async'
        `,
      )
      .get(jobId) as JobRow | undefined;

    return row ? toAsyncJobRecord(row) : null;
  }

  getJobByRequestId(requestId: string): JobRecord | null {
    const row = this.db
      .prepare(
        `
          SELECT job_id, request_id, remote_job_id, poll_path, tool, internal_tool, target_host,
                 mode, status, source, session_id, args_json, result_json, error_json,
                 created_at, updated_at, completed_at, duration_ms
          FROM jobs
          WHERE request_id = ? AND mode = 'async'
          ORDER BY created_at DESC
          LIMIT 1
        `,
      )
      .get(requestId) as JobRow | undefined;

    return row ? toAsyncJobRecord(row) : null;
  }

  getStoredJob(jobId: string): StoredJobRecord | null {
    const row = this.db
      .prepare(
        `
          SELECT job_id, request_id, remote_job_id, poll_path, tool, internal_tool, target_host,
                 mode, status, source, session_id, args_json, result_json, error_json,
                 created_at, updated_at, completed_at, duration_ms
          FROM jobs
          WHERE job_id = ?
        `,
      )
      .get(jobId) as JobRow | undefined;

    return row ? toStoredJobRecord(row) : null;
  }

  listJobs(filters: JobQueryFilters = {}): StoredJobRecord[] {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (filters.status) {
      clauses.push("status = ?");
      params.push(filters.status);
    }

    if (filters.targetHost) {
      clauses.push("target_host = ?");
      params.push(filters.targetHost);
    }

    if (filters.tool) {
      clauses.push("tool = ?");
      params.push(filters.tool);
    }

    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = this.db
      .prepare(
        `
          SELECT job_id, request_id, remote_job_id, poll_path, tool, internal_tool, target_host,
                 mode, status, source, session_id, args_json, result_json, error_json,
                 created_at, updated_at, completed_at, duration_ms
          FROM jobs
          ${whereClause}
          ORDER BY created_at DESC, job_id DESC
        `,
      )
      .all(...params) as JobRow[];

    return rows.map(toStoredJobRecord);
  }

  listPendingJobs(): JobRecord[] {
    const rows = this.db
      .prepare(
        `
          SELECT job_id, request_id, remote_job_id, poll_path, tool, internal_tool, target_host,
                 mode, status, source, session_id, args_json, result_json, error_json,
                 created_at, updated_at, completed_at, duration_ms
          FROM jobs
          WHERE mode = 'async' AND status IN ('accepted', 'running')
          ORDER BY created_at ASC
        `,
      )
      .all() as JobRow[];

    return rows.map(toAsyncJobRecord);
  }
}
