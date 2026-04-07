import type Database from "better-sqlite3";

import type { AuditEntry } from "../../types";

export class AuditRepository {
  constructor(private readonly db: Database.Database) {}

  record(entry: AuditEntry): void {
    this.db
      .prepare(
        `
          INSERT INTO audit_logs (
            timestamp, request_id, job_id, tool, target_host, source, outcome,
            duration_ms, args_summary_json, error_summary_json
          )
          VALUES (
            @timestamp, @request_id, @job_id, @tool, @target_host, @source, @outcome,
            @duration_ms, @args_summary_json, @error_summary_json
          )
        `,
      )
      .run({
        timestamp: entry.timestamp,
        request_id: entry.requestId,
        job_id: entry.jobId,
        tool: entry.tool,
        target_host: entry.targetHost,
        source: entry.source,
        outcome: entry.outcome,
        duration_ms: entry.durationMs ?? null,
        args_summary_json: entry.argsSummary ? JSON.stringify(entry.argsSummary) : null,
        error_summary_json: entry.errorSummary ? JSON.stringify(entry.errorSummary) : null,
      });
  }
}
