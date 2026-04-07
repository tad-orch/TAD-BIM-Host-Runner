import { createRequestId } from "../lib/ids";
import type { RevitCreateWallArgs, RevitPingArgs } from "../schemas/tools/revit";
import type {
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
