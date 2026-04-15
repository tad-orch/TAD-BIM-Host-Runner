import type { ZodType } from "zod";

import type { ExecuteRequestEnvelope } from "../schemas/envelope";
import type { ErrorSummary, JobStatus, ToolName } from "../types";

export type McpNamespace = "arch" | "str" | "mep";

export type McpToolName =
  | "mcp-arch-system-health"
  | "mcp-arch-walls-create"
  | "mcp-arch-revit-session-status"
  | "mcp-arch-revit-launch"
  | "mcp-arch-revit-open-cloud-model"
  | "mcp-arch-revit-list-3d-views"
  | "mcp-arch-revit-export-nwc"
  | "mcp-arch-revit-activate-document";

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

export interface McpArchRevitSessionStatusRequest extends McpBaseRequest {}

export interface McpArchRevitLaunchRequest extends McpBaseRequest {
  preferredVersion?: string;
  waitForReadySeconds: number;
}

export interface McpArchRevitOpenCloudModelRequest extends McpBaseRequest {
  projectGuid: string;
  modelGuid: string;
  region: "US" | "EMEA" | "APAC";
  openInUi: boolean;
  audit: boolean;
  worksets: {
    mode: "default" | "open_all" | "close_all" | "open_last_viewed";
  };
  cloudOpenConflictPolicy:
    | "use_default"
    | "discard_local_changes_and_open_latest_version"
    | "keep_local_changes"
    | "detach_from_central"
    | "cancel";
}

export interface McpArchRevitList3dViewsRequest extends McpBaseRequest {
  onlyExportable: boolean;
}

export interface McpArchRevitExportNwcRequest extends McpBaseRequest {
  viewNames: string[];
  outputPath: string;
  exportScope: "selected_views";
}

export interface McpArchRevitActivateDocumentRequest extends McpBaseRequest {
  documentTitle: string;
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
