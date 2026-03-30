import { BridgeClient } from "../clients/bridge-client";
import { AppError, normalizeError, toErrorSummary } from "../lib/errors";
import { createJobId } from "../lib/ids";
import { HostRegistry } from "../registry/host-registry";
import { ToolRegistry } from "../registry/tool-registry";
import { AuditService } from "./audit-service";
import { JobStore } from "./job-store";
import { PollingService } from "./polling-service";
import type { ExecuteRequestEnvelope } from "../schemas/envelope";
import type { ExecuteResponse, JobRecord, SyncExecutionRecord, ToolName } from "../types";

export class ExecutionService {
  constructor(
    private readonly hostRegistry: HostRegistry,
    private readonly toolRegistry: ToolRegistry,
    private readonly bridgeClient: BridgeClient,
    private readonly jobStore: JobStore,
    private readonly auditService: AuditService,
    private readonly pollingService: PollingService,
  ) {}

  async execute(request: ExecuteRequestEnvelope & { requestId: string }): Promise<ExecuteResponse> {
    const tool = this.toolRegistry.get(request.tool);

    if (!tool) {
      throw new AppError(400, "unknown_tool", `Tool '${request.tool}' is not allowed.`, {
        tool: request.tool,
      });
    }

    const host = this.hostRegistry.require(request.targetHost);

    if (!host.enabledTools.includes(tool.name as ToolName)) {
      throw new AppError(
        400,
        "tool_disabled_for_host",
        `Tool '${tool.name}' is not enabled for host '${host.id}'.`,
        {
          tool: tool.name,
          targetHost: host.id,
        },
      );
    }

    if (request.mode !== tool.mode) {
      throw new AppError(
        400,
        "invalid_mode",
        `Tool '${tool.name}' must run in '${tool.mode}' mode.`,
        {
          tool: tool.name,
          requestedMode: request.mode,
          expectedMode: tool.mode,
        },
      );
    }

    let args: unknown;
    let argsSummary: Record<string, unknown> = {};

    try {
      args = tool.argsSchema.parse(request.args);
      argsSummary = tool.summarizeArgs(args);
    } catch (error) {
      throw normalizeError(error);
    }

    const startedAtMs = Date.now();

    try {
      if (tool.mode === "sync") {
        const remote = await this.bridgeClient.executeSync(host, tool, {
          ...request,
          args,
        });

        if (remote.status === "failed" || remote.status === "timeout") {
          throw new AppError(
            remote.status === "timeout" ? 504 : 502,
            remote.status === "timeout" ? "bridge_timeout" : "remote_execution_failed",
            "Remote execution failed.",
            {
              tool: tool.name,
            },
          );
        }

        if (remote.status !== "completed") {
          throw new AppError(
            502,
            "remote_execution_failed",
            `Sync tool '${tool.name}' did not complete immediately.`,
          );
        }

        const now = new Date().toISOString();
        const record: SyncExecutionRecord = {
          requestId: request.requestId,
          tool: tool.name,
          targetHost: host.id,
          mode: "sync",
          source: request.source,
          sessionId: request.sessionId,
          status: "completed",
          argsSummary,
          createdAt: now,
          updatedAt: now,
          durationMs: Date.now() - startedAtMs,
          result: remote.result,
          error: null,
        };

        await this.jobStore.recordSyncExecution(record);
        await this.auditService.record({
          timestamp: now,
          requestId: request.requestId,
          jobId: null,
          tool: tool.name,
          targetHost: host.id,
          source: request.source,
          outcome: "completed",
          durationMs: record.durationMs,
          argsSummary,
          errorSummary: null,
        });

        return {
          requestId: request.requestId,
          jobId: null,
          status: "completed",
          tool: tool.name,
          targetHost: host.id,
          result: remote.result,
          error: null,
        };
      }

      const remoteAck = await this.bridgeClient.submitAsync(host, tool, {
        ...request,
        args,
      });

      if (!remoteAck.remoteJobId && remoteAck.status !== "completed") {
        throw new AppError(
          502,
          "remote_execution_failed",
          "Bridge did not return a remote job identifier for async execution.",
        );
      }

      const now = new Date().toISOString();
      const jobId = createJobId();
      const terminalStatus =
        remoteAck.status === "failed" || remoteAck.status === "timeout" || remoteAck.status === "completed"
          ? remoteAck.status
          : remoteAck.status;

      const job: JobRecord = {
        jobId,
        remoteJobId: remoteAck.remoteJobId ?? jobId,
        pollPath: remoteAck.pollPath,
        requestId: request.requestId,
        tool: tool.name,
        targetHost: host.id,
        mode: "async",
        status: terminalStatus,
        source: request.source,
        sessionId: request.sessionId,
        argsSummary,
        createdAt: now,
        updatedAt: now,
        completedAt:
          terminalStatus === "completed" || terminalStatus === "failed" || terminalStatus === "timeout"
            ? now
            : undefined,
        durationMs:
          terminalStatus === "completed" || terminalStatus === "failed" || terminalStatus === "timeout"
            ? Date.now() - startedAtMs
            : undefined,
        result: terminalStatus === "completed" ? remoteAck.result : null,
        error:
          terminalStatus === "failed" || terminalStatus === "timeout"
            ? toErrorSummary(
                remoteAck.error ??
                  new AppError(
                    terminalStatus === "timeout" ? 504 : 502,
                    terminalStatus === "timeout" ? "bridge_timeout" : "remote_execution_failed",
                    terminalStatus === "timeout"
                      ? "Remote job timed out."
                      : "Remote execution failed.",
                  ),
              )
            : null,
      };

      await this.jobStore.saveJob(job);
      await this.auditService.record({
        timestamp: now,
        requestId: request.requestId,
        jobId,
        tool: tool.name,
        targetHost: host.id,
        source: request.source,
        outcome: job.status,
        durationMs: job.durationMs,
        argsSummary,
        errorSummary: job.error,
      });

      if (job.status === "accepted" || job.status === "running") {
        this.pollingService.track(job);
      }

      return {
        requestId: request.requestId,
        jobId,
        status: job.status,
        tool: tool.name,
        targetHost: host.id,
        result: job.result,
        error: job.error,
      };
    } catch (error) {
      const now = new Date().toISOString();
      const errorSummary = toErrorSummary(error);
      const durationMs = Date.now() - startedAtMs;

      if (tool.mode === "sync") {
        const record: SyncExecutionRecord = {
          requestId: request.requestId,
          tool: tool.name,
          targetHost: host.id,
          mode: "sync",
          source: request.source,
          sessionId: request.sessionId,
          status: errorSummary.code === "bridge_timeout" ? "timeout" : "failed",
          argsSummary,
          createdAt: now,
          updatedAt: now,
          durationMs,
          result: null,
          error: errorSummary,
        };

        await this.jobStore.recordSyncExecution(record);
      }

      await this.auditService.record({
        timestamp: now,
        requestId: request.requestId,
        jobId: null,
        tool: tool.name,
        targetHost: host.id,
        source: request.source,
        outcome: "failed",
        durationMs,
        argsSummary,
        errorSummary,
      });

      throw error;
    }
  }
}
