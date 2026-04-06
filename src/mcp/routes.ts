import type { FastifyInstance } from "fastify";

import { createRequestId } from "../lib/ids";
import { AppError, formatZodIssues, normalizeError } from "../lib/errors";
import { ExecutionService } from "../services/execution-service";
import { mapMcpRequestToExecuteRequest } from "./mapper";
import { createMcpToolRegistry } from "./tool-groups";
import type { AnyMcpToolDefinition, McpExecuteResponse } from "./types";

interface McpRouteDeps {
  executionService: ExecutionService;
}

interface McpErrorContext {
  requestId: string;
  tool: string | null;
  internalTool: AnyMcpToolDefinition["internalTool"] | null;
  targetHost: string | null;
}

function extractContext(toolName: string | undefined, body: unknown, tool?: AnyMcpToolDefinition): McpErrorContext {
  const candidate = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  return {
    requestId: typeof candidate.requestId === "string" && candidate.requestId.trim().length > 0
      ? candidate.requestId
      : createRequestId(),
    tool: toolName ?? null,
    internalTool: tool?.internalTool ?? null,
    targetHost: typeof candidate.targetHost === "string" ? candidate.targetHost : null,
  };
}

function buildErrorResponse(context: McpErrorContext, error: AppError): McpExecuteResponse {
  return {
    requestId: context.requestId,
    jobId: null,
    status: "failed",
    tool: context.tool,
    internalTool: context.internalTool,
    targetHost: context.targetHost,
    result: null,
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
    },
  };
}

function buildSuccessResponse(
  tool: AnyMcpToolDefinition,
  payload: Awaited<ReturnType<ExecutionService["execute"]>>,
): McpExecuteResponse {
  return {
    requestId: payload.requestId,
    jobId: payload.jobId,
    status: payload.status,
    tool: tool.name,
    internalTool: tool.internalTool,
    targetHost: payload.targetHost,
    result: payload.result,
    error: payload.error,
  };
}

function getExecuteStatusCode(response: McpExecuteResponse): number {
  if (response.status === "completed") {
    return 200;
  }

  if (response.status === "accepted" || response.status === "running") {
    return 202;
  }

  if (response.status === "timeout") {
    return 504;
  }

  return 502;
}

export async function registerMcpRoutes(app: FastifyInstance, deps: McpRouteDeps): Promise<void> {
  const mcpToolRegistry = createMcpToolRegistry();

  app.post("/mcp/tools/:toolName", async (request, reply) => {
    const params = request.params as { toolName?: string };
    const tool = mcpToolRegistry.get(params.toolName ?? "");
    const context = extractContext(params.toolName, request.body, tool);

    try {
      if (!tool) {
        throw new AppError(404, "mcp_tool_not_found", `MCP tool '${params.toolName ?? ""}' is not supported.`, {
          tool: params.toolName ?? null,
        });
      }

      const parsed = tool.schema.safeParse(request.body);

      if (!parsed.success) {
        throw new AppError(400, "invalid_payload", "Request payload is invalid.", {
          issues: formatZodIssues(parsed.error),
        });
      }

      const executeRequest = mapMcpRequestToExecuteRequest(tool, parsed.data);
      const executeResponse = await deps.executionService.execute(executeRequest);
      const response = buildSuccessResponse(tool, executeResponse);

      return reply.status(getExecuteStatusCode(response)).send(response);
    } catch (error) {
      const normalized = normalizeError(error);
      return reply.status(normalized.statusCode).send(buildErrorResponse(context, normalized));
    }
  });
}
