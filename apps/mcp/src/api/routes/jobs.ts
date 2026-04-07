import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { AppError, normalizeError } from "../../lib/errors";
import { JobsRepository } from "../../db/repositories/jobs-repo";
import { JobStore } from "../../services/job-store";
import { PollingService } from "../../services/polling-service";
import { jobStatusSchema, type JobRecord, type StoredJobRecord } from "../../types";

const jobsQuerySchema = z
  .object({
    status: jobStatusSchema.optional(),
    targetHost: z.string().min(1).max(255).optional(),
    tool: z.string().min(1).max(255).optional(),
  })
  .strict();

interface JobsRouteDeps {
  jobStore: JobStore;
  pollingService: PollingService;
  jobsRepository: JobsRepository;
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

function toStoredJobResponse(job: StoredJobRecord) {
  return {
    jobId: job.jobId,
    requestId: job.requestId,
    remoteJobId: job.remoteJobId,
    pollPath: job.pollPath,
    tool: job.tool,
    internalTool: job.internalTool,
    targetHost: job.targetHost,
    mode: job.mode,
    status: job.status,
    source: job.source,
    sessionId: job.sessionId,
    args: job.args,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    completedAt: job.completedAt,
    durationMs: job.durationMs,
    result: job.result,
    error: job.error,
  };
}

export async function registerJobsRoute(app: FastifyInstance, deps: JobsRouteDeps): Promise<void> {
  app.get("/api/jobs", async (request, reply) => {
    try {
      const parsed = jobsQuerySchema.parse((request.query as Record<string, unknown> | undefined) ?? {});
      const jobs = deps.jobsRepository.listJobs(parsed).map(toStoredJobResponse);
      return reply.status(200).send({ jobs });
    } catch (error) {
      const normalized = normalizeError(error);
      return reply.status(normalized.statusCode).send({
        jobs: [],
        error: {
          code: normalized.code,
          message: normalized.message,
          details: normalized.details,
        },
      });
    }
  });

  app.get("/api/jobs/:jobId", async (request, reply) => {
    const params = request.params as { jobId?: string };
    const jobId = params.jobId ?? "";

    try {
      const asyncJob = await deps.jobStore.getJob(jobId);

      if (asyncJob && (asyncJob.status === "accepted" || asyncJob.status === "running")) {
        await deps.pollingService.ensureTracked(asyncJob);
      }

      const job = deps.jobsRepository.getStoredJob(jobId);

      if (!job) {
        throw new AppError(404, "job_not_found", `Job '${jobId}' was not found.`, {
          jobId,
        });
      }

      return reply.status(200).send(toStoredJobResponse(job));
    } catch (error) {
      const normalized = normalizeError(error);
      return reply.status(normalized.statusCode).send({
        jobId,
        error: {
          code: normalized.code,
          message: normalized.message,
          details: normalized.details,
        },
      });
    }
  });

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
