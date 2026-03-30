import fs from "node:fs/promises";
import path from "node:path";

import type { JobRecord, SyncExecutionRecord } from "../types";

interface JobStoreState {
  jobs: Record<string, JobRecord>;
  syncExecutions: Record<string, SyncExecutionRecord>;
}

const emptyState = (): JobStoreState => ({
  jobs: {},
  syncExecutions: {},
});

export class JobStore {
  private state: JobStoreState | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async init(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      await fs.access(this.filePath);
    } catch {
      await this.writeState(emptyState());
    }

    await this.loadState();
  }

  async saveJob(job: JobRecord): Promise<void> {
    await this.updateState((state) => {
      state.jobs[job.jobId] = job;
    });
  }

  async recordSyncExecution(execution: SyncExecutionRecord): Promise<void> {
    await this.updateState((state) => {
      state.syncExecutions[execution.requestId] = execution;
    });
  }

  async getJob(jobId: string): Promise<JobRecord | null> {
    await this.writeQueue;
    const state = await this.loadState();
    return structuredClone(state.jobs[jobId] ?? null);
  }

  async getJobByRequestId(requestId: string): Promise<JobRecord | null> {
    await this.writeQueue;
    const state = await this.loadState();
    const match = Object.values(state.jobs).find((job) => job.requestId === requestId);
    return structuredClone(match ?? null);
  }

  async listPendingJobs(): Promise<JobRecord[]> {
    await this.writeQueue;
    const state = await this.loadState();

    return Object.values(state.jobs)
      .filter((job) => job.status === "accepted" || job.status === "running")
      .map((job) => structuredClone(job));
  }

  private async updateState(mutator: (state: JobStoreState) => void): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      const state = await this.loadState();
      mutator(state);
      await this.writeState(state);
    });

    return this.writeQueue;
  }

  private async loadState(): Promise<JobStoreState> {
    if (this.state) {
      return this.state;
    }

    const contents = await fs.readFile(this.filePath, "utf8");
    this.state = contents.trim().length > 0 ? (JSON.parse(contents) as JobStoreState) : emptyState();
    return this.state;
  }

  private async writeState(state: JobStoreState): Promise<void> {
    const nextState = structuredClone(state);
    const tmpPath = `${this.filePath}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(nextState, null, 2), "utf8");
    await fs.rename(tmpPath, this.filePath);
    this.state = nextState;
  }
}
