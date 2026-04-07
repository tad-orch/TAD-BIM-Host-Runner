import type { FastifyInstance } from "fastify";

import { AppError, normalizeError } from "../../lib/errors";
import { JobStore } from "../../services/job-store";
import { PollingService } from "../../services/polling-service";
import type { JobRecord } from "../../types";

interface JobsRouteDeps {
  jobStore: JobStore;
  pollingService: PollingService;
}

function toJobResponse(job: JobRecord) {
  return {
    jobId: job.jobId,
    requestId: job.requestId,
    tool: job.tool,
    targetHost: job.targetHost,
    mode: job.mode,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    completedAt: job.completedAt ?? null,
    result: job.result,
    error: job.error,
  };
}

export async function registerJobsRoute(app: FastifyInstance, deps: JobsRouteDeps): Promise<void> {
  app.get("/jobs/:jobId", async (request, reply) => {
    const params = request.params as { jobId?: string };
    const jobId = params.jobId ?? "";

    try {
      const job = await deps.jobStore.getJob(jobId);

      if (!job) {
        throw new AppError(404, "job_not_found", `Job '${jobId}' was not found.`, {
          jobId,
        });
      }

      if (job.status === "accepted" || job.status === "running") {
        await deps.pollingService.ensureTracked(job);
      }

      return reply.status(200).send(toJobResponse(job));
    } catch (error) {
      const normalized = normalizeError(error);
      return reply.status(normalized.statusCode).send({
        jobId,
        requestId: null,
        status: "failed",
        tool: null,
        targetHost: null,
        result: null,
        error: {
          code: normalized.code,
          message: normalized.message,
          details: normalized.details,
        },
      });
    }
  });
}
