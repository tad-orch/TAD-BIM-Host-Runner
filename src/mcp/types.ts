import type { ZodType } from "zod";

import type { ExecuteRequestEnvelope } from "../schemas/envelope";
import type { ErrorSummary, JobStatus, ToolName } from "../types";

export type McpNamespace = "arch" | "str" | "mep";

export type McpToolName = "mcp-arch-system-health" | "mcp-arch-walls-create";

export interface McpBaseRequest {
  requestId?: string;
  targetHost: string;
}

export interface McpPoint {
  x: number;
  y: number;
  z: number;
}

export interface McpArchSystemHealthRequest extends McpBaseRequest {}

export interface McpArchWallsCreateRequest extends McpBaseRequest {
  length?: number;
  start?: McpPoint;
  end?: McpPoint;
  wallType: string;
  level: string;
  height: number;
}

export interface McpToolGroupDefinition {
  name: string;
  description: string;
  tools: McpToolName[];
}

export interface McpToolCatalog {
  namespace: McpNamespace;
  prefix: `mcp-${McpNamespace}-`;
  groups: McpToolGroupDefinition[];
}

export interface McpToolDefinition<TInput extends McpBaseRequest = McpBaseRequest> {
  name: McpToolName;
  internalTool: ToolName;
  mode: "sync" | "async";
  namespace: McpNamespace;
  group: string;
  description: string;
  schema: ZodType<TInput>;
  toInternalArgs: (input: TInput) => unknown;
}

export type AnyMcpToolDefinition = McpToolDefinition<any>;

export interface McpMappedExecuteRequest extends ExecuteRequestEnvelope {
  requestId: string;
}

export interface McpExecuteResponse {
  requestId: string;
  jobId: string | null;
  status: JobStatus;
  tool: McpToolName | string | null;
  internalTool: ToolName | null;
  targetHost: string | null;
  result: unknown | null;
  error: ErrorSummary | null;
}
