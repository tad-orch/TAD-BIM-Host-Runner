import type { JobRecord, SyncExecutionRecord } from "../types";
import { JobsRepository } from "../db/repositories/jobs-repo";

export class JobStore {
  constructor(private readonly jobsRepository: JobsRepository) {}

  async init(): Promise<void> {
    return Promise.resolve();
  }

  async saveJob(job: JobRecord): Promise<void> {
    this.jobsRepository.saveJob(job);
  }

  async recordSyncExecution(execution: SyncExecutionRecord): Promise<void> {
    this.jobsRepository.recordSyncExecution(execution);
  }

  async getJob(jobId: string): Promise<JobRecord | null> {
    return this.jobsRepository.getJob(jobId);
  }

  async getJobByRequestId(requestId: string): Promise<JobRecord | null> {
    return this.jobsRepository.getJobByRequestId(requestId);
  }

  async listPendingJobs(): Promise<JobRecord[]> {
    return this.jobsRepository.listPendingJobs();
  }
}
