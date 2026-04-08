import { createRequestId } from "../lib/ids";
import type {
  RevitCreateWallArgs,
  RevitExportNwcArgs,
  RevitLaunchArgs,
  RevitList3dViewsArgs,
  RevitOpenCloudModelArgs,
  RevitPingArgs,
  RevitSessionStatusArgs,
} from "../schemas/tools/revit";
import type {
  McpArchRevitExportNwcRequest,
  McpArchRevitLaunchRequest,
  McpArchRevitList3dViewsRequest,
  McpArchRevitOpenCloudModelRequest,
  McpArchRevitSessionStatusRequest,
  McpArchSystemHealthRequest,
  McpArchWallsCreateRequest,
  McpBaseRequest,
  McpMappedExecuteRequest,
  McpToolDefinition,
} from "./types";

export const MCP_GATEWAY_SOURCE = "mcp-gateway";
export const MCP_GATEWAY_SESSION_ID = "mcp-gateway";
export const MCP_GATEWAY_USER = "mcp-gateway";

export function mapArchSystemHealthToInternalArgs(
  _input: McpArchSystemHealthRequest,
): RevitPingArgs {
  return {};
}

export function mapArchRevitSessionStatusToInternalArgs(
  _input: McpArchRevitSessionStatusRequest,
): RevitSessionStatusArgs {
  return {};
}

export function mapArchWallsCreateToInternalArgs(
  input: McpArchWallsCreateRequest,
): RevitCreateWallArgs {
  const start = input.start ?? { x: 0, y: 0, z: 0 };
  const end = input.end ?? { x: 0, y: input.length ?? 0, z: 0 };

  return {
    documentPath: "active",
    levelName: input.level,
    wallType: input.wallType,
    start,
    end,
    unconnectedHeight: input.height,
  };
}

export function mapArchRevitLaunchToInternalArgs(
  input: McpArchRevitLaunchRequest,
): RevitLaunchArgs {
  return {
    preferredVersion: input.preferredVersion,
    waitForReadySeconds: input.waitForReadySeconds,
  };
}

export function mapArchRevitOpenCloudModelToInternalArgs(
  input: McpArchRevitOpenCloudModelRequest,
): RevitOpenCloudModelArgs {
  return {
    projectGuid: input.projectGuid,
    modelGuid: input.modelGuid,
    region: input.region,
    openInUi: input.openInUi,
    audit: input.audit,
    worksets: input.worksets,
    cloudOpenConflictPolicy: input.cloudOpenConflictPolicy,
  };
}

export function mapArchRevitList3dViewsToInternalArgs(
  input: McpArchRevitList3dViewsRequest,
): RevitList3dViewsArgs {
  return {
    onlyExportable: input.onlyExportable,
  };
}

export function mapArchRevitExportNwcToInternalArgs(
  input: McpArchRevitExportNwcRequest,
): RevitExportNwcArgs {
  return {
    viewNames: input.viewNames,
    outputPath: input.outputPath,
    exportScope: input.exportScope,
  };
}

export function mapMcpRequestToExecuteRequest<TInput extends McpBaseRequest>(
  tool: McpToolDefinition<TInput>,
  input: TInput,
): McpMappedExecuteRequest {
  return {
    requestId: input.requestId ?? createRequestId(),
    sessionId: MCP_GATEWAY_SESSION_ID,
    source: MCP_GATEWAY_SOURCE,
    targetHost: input.targetHost,
    tool: tool.internalTool,
    mode: tool.mode,
    args: tool.toInternalArgs(input),
    meta: {
      user: MCP_GATEWAY_USER,
      timestamp: new Date().toISOString(),
    },
  };
}
