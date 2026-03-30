import { z } from "zod";

export const jobStatusSchema = z.enum([
  "accepted",
  "running",
  "completed",
  "failed",
  "timeout",
]);

export type JobStatus = z.infer<typeof jobStatusSchema>;

export type ToolName = "revit_ping" | "revit_create_wall";

export interface HostDefinition {
  id: string;
  baseUrl: string;
  machineType: string;
  capabilities: string[];
  enabledTools: ToolName[];
  headers?: Record<string, string>;
}

export interface JobRecord {
  jobId: string;
  remoteJobId: string;
  pollPath?: string;
  requestId: string;
  tool: ToolName;
  targetHost: string;
  mode: "async";
  status: JobStatus;
  source: string;
  sessionId: string;
  argsSummary: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  durationMs?: number;
  result: unknown | null;
  error: ErrorSummary | null;
}

export interface SyncExecutionRecord {
  requestId: string;
  tool: ToolName;
  targetHost: string;
  mode: "sync";
  source: string;
  sessionId: string;
  status: Extract<JobStatus, "completed" | "failed" | "timeout">;
  argsSummary: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  durationMs?: number;
  result: unknown | null;
  error: ErrorSummary | null;
}

export interface ErrorSummary {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface AuditEntry {
  timestamp: string;
  requestId: string;
  jobId: string | null;
  tool: string | null;
  targetHost: string | null;
  source: string | null;
  outcome: string;
  durationMs?: number;
  argsSummary?: Record<string, unknown>;
  errorSummary?: ErrorSummary | null;
}

export interface ExecuteResponse {
  requestId: string;
  jobId: string | null;
  status: JobStatus;
  tool: string | null;
  targetHost: string | null;
  result: unknown | null;
  error: ErrorSummary | null;
}
