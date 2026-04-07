import { AppError, formatZodIssues } from "../lib/errors";
import { mapMcpRequestToExecuteRequest } from "../mcp/mapper";
import { createMcpToolRegistry } from "../mcp/tool-groups";
import type { AnyMcpToolDefinition, McpExecuteResponse } from "../mcp/types";
import { ExecutionService } from "./execution-service";

export class McpService {
  private readonly mcpToolRegistry = createMcpToolRegistry();

  constructor(private readonly executionService: ExecutionService) {}

  getTool(name: string): AnyMcpToolDefinition | undefined {
    return this.mcpToolRegistry.get(name);
  }

  async executeTool(toolName: string, input: unknown): Promise<McpExecuteResponse> {
    const tool = this.getTool(toolName);

    if (!tool) {
      throw new AppError(404, "mcp_tool_not_found", `MCP tool '${toolName}' is not supported.`, {
        tool: toolName,
      });
    }

    const parsed = tool.schema.safeParse(input);

    if (!parsed.success) {
      throw new AppError(400, "invalid_payload", "Request payload is invalid.", {
        issues: formatZodIssues(parsed.error),
      });
    }

    const executeRequest = mapMcpRequestToExecuteRequest(tool, parsed.data);
    const executeResponse = await this.executionService.execute(executeRequest);

    return {
      requestId: executeResponse.requestId,
      jobId: executeResponse.jobId,
      status: executeResponse.status,
      tool: tool.name,
      internalTool: tool.internalTool,
      targetHost: executeResponse.targetHost,
      result: executeResponse.result,
      error: executeResponse.error,
    };
  }
}
