import type { FastifyInstance } from "fastify";

import { createRequestId } from "../../lib/ids";
import { AppError, formatZodIssues, normalizeError } from "../../lib/errors";
import { executeRequestSchema } from "../../schemas/envelope";
import type { ExecuteResponse } from "../../types";
import { ExecutionService } from "../../services/execution-service";

interface ExecuteRouteDeps {
  executionService: ExecutionService;
}

interface ExecuteErrorContext {
  requestId: string;
  tool: string | null;
  targetHost: string | null;
}

function extractContext(body: unknown): ExecuteErrorContext {
  const candidate = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  return {
    requestId:
      typeof candidate.requestId === "string" && candidate.requestId.trim().length > 0
        ? candidate.requestId
        : createRequestId(),
    tool: typeof candidate.tool === "string" ? candidate.tool : null,
    targetHost: typeof candidate.targetHost === "string" ? candidate.targetHost : null,
  };
}

function buildErrorResponse(context: ExecuteErrorContext, error: AppError): ExecuteResponse {
  return {
    requestId: context.requestId,
    jobId: null,
    status: "failed",
    tool: context.tool,
    targetHost: context.targetHost,
    result: null,
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
    },
  };
}

function getExecuteStatusCode(response: ExecuteResponse): number {
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

export async function registerExecuteRoute(app: FastifyInstance, deps: ExecuteRouteDeps): Promise<void> {
  app.post("/execute", async (request, reply) => {
    const context = extractContext(request.body);

    try {
      const parsed = executeRequestSchema.safeParse(request.body);

      if (!parsed.success) {
        throw new AppError(400, "invalid_payload", "Request payload is invalid.", {
          issues: formatZodIssues(parsed.error),
        });
      }

      const response = await deps.executionService.execute({
        ...parsed.data,
        requestId: parsed.data.requestId ?? context.requestId,
      });

      return reply.status(getExecuteStatusCode(response)).send(response);
    } catch (error) {
      const normalized = normalizeError(error);
      return reply.status(normalized.statusCode).send(buildErrorResponse(context, normalized));
    }
  });
}
