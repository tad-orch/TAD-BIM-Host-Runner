import { sleep } from "../lib/sleep";
import { AppError, toErrorSummary } from "../lib/errors";
import { HostRegistry } from "../registry/host-registry";
import { ToolRegistry } from "../registry/tool-registry";
import { BridgeClient } from "../clients/bridge-client";
import { AuditService } from "./audit-service";
import { JobStore } from "./job-store";
import type { JobRecord } from "../types";

export class PollingService {
  private readonly activeJobs = new Map<string, Promise<void>>();

  constructor(
    private readonly jobStore: JobStore,
    private readonly auditService: AuditService,
    private readonly bridgeClient: BridgeClient,
    private readonly hostRegistry: HostRegistry,
    private readonly toolRegistry: ToolRegistry,
  ) {}

  async resumePendingJobs(): Promise<void> {
    const pendingJobs = await this.jobStore.listPendingJobs();

    for (const job of pendingJobs) {
      this.track(job);
    }
  }

  track(job: JobRecord): void {
    if (this.activeJobs.has(job.jobId)) {
      return;
    }

    const promise = this.poll(job.jobId).finally(() => {
      this.activeJobs.delete(job.jobId);
    });

    this.activeJobs.set(job.jobId, promise);
  }

  async ensureTracked(job: JobRecord): Promise<void> {
    if (!this.activeJobs.has(job.jobId)) {
      this.track(job);
    }
  }

  private async poll(jobId: string): Promise<void> {
    while (true) {
      const job = await this.jobStore.getJob(jobId);

      if (!job) {
        return;
      }

      if (job.status === "completed" || job.status === "failed" || job.status === "timeout") {
        return;
      }

      const tool = this.toolRegistry.get(job.tool);

      if (!tool?.polling) {
        return;
      }

      const createdAtMs = new Date(job.createdAt).getTime();

      if (Date.now() - createdAtMs >= tool.polling.timeoutMs) {
        await this.finishJob(
          job,
          "timeout",
          null,
          new AppError(504, "job_timeout", "Job polling timed out."),
        );
        return;
      }

      await sleep(tool.polling.intervalMs);

      try {
        const host = this.hostRegistry.require(job.targetHost);
        const status = await this.bridgeClient.getJobStatus(host, tool, job.remoteJobId, job.pollPath);
        const nextStatus = status.status === "accepted" ? "running" : status.status;
        const now = new Date().toISOString();
        const durationMs = Date.now() - createdAtMs;

        const nextJob: JobRecord = {
          ...job,
          status: nextStatus,
          updatedAt: now,
          durationMs,
          result: nextStatus === "completed" ? status.result : job.result,
          error:
            nextStatus === "failed" || nextStatus === "timeout"
              ? toErrorSummary(
                  status.error ??
                    new AppError(
                      nextStatus === "timeout" ? 504 : 502,
                      nextStatus === "timeout" ? "job_timeout" : "remote_execution_failed",
                      nextStatus === "timeout" ? "Remote job timed out." : "Remote execution failed.",
                    ),
                )
              : null,
          completedAt:
            nextStatus === "completed" || nextStatus === "failed" || nextStatus === "timeout"
              ? now
              : job.completedAt,
        };

        await this.jobStore.saveJob(nextJob);

        if (nextStatus === "completed" || nextStatus === "failed" || nextStatus === "timeout") {
          await this.auditService.record({
            timestamp: now,
            requestId: nextJob.requestId,
            jobId: nextJob.jobId,
            tool: nextJob.tool,
            targetHost: nextJob.targetHost,
            source: nextJob.source,
            outcome: nextJob.status,
            durationMs,
            argsSummary: nextJob.argsSummary,
            errorSummary: nextJob.error,
          });
          return;
        }
      } catch (error) {
        const appError = error instanceof AppError ? error : null;

        if (appError && (appError.code === "bridge_unreachable" || appError.code === "bridge_timeout")) {
          continue;
        }

        await this.finishJob(job, "failed", null, error);
        return;
      }
    }
  }

  private async finishJob(
    job: JobRecord,
    status: "failed" | "timeout",
    result: unknown,
    error: unknown,
  ): Promise<void> {
    const now = new Date().toISOString();
    const nextJob: JobRecord = {
      ...job,
      status,
      updatedAt: now,
      completedAt: now,
      durationMs: Date.now() - new Date(job.createdAt).getTime(),
      result,
      error: toErrorSummary(error),
    };

    await this.jobStore.saveJob(nextJob);
    await this.auditService.record({
      timestamp: now,
      requestId: nextJob.requestId,
      jobId: nextJob.jobId,
      tool: nextJob.tool,
      targetHost: nextJob.targetHost,
      source: nextJob.source,
      outcome: nextJob.status,
      durationMs: nextJob.durationMs,
      argsSummary: nextJob.argsSummary,
      errorSummary: nextJob.error,
    });
  }
}
