import Fastify, { type FastifyInstance } from "fastify";

import { BridgeClient } from "./clients/bridge-client";
import { loadEnv, type Env } from "./config/env";
import { createHostRegistry, type HostRegistry } from "./registry/host-registry";
import { createToolRegistry, type ToolRegistry } from "./registry/tool-registry";
import { registerExecuteRoute } from "./routes/execute";
import { registerHealthRoute } from "./routes/health";
import { registerJobsRoute } from "./routes/jobs";
import { AuditService } from "./services/audit-service";
import { ExecutionService } from "./services/execution-service";
import { JobStore } from "./services/job-store";
import { PollingService } from "./services/polling-service";

export interface BuildAppOptions {
  env?: Env;
  envOverrides?: Partial<NodeJS.ProcessEnv>;
  hostRegistry?: HostRegistry;
  toolRegistry?: ToolRegistry;
  bridgeClient?: BridgeClient;
  jobStore?: JobStore;
  auditService?: AuditService;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const env = options.env ?? loadEnv(options.envOverrides);
  const hostRegistry = options.hostRegistry ?? createHostRegistry(env);
  const toolRegistry = options.toolRegistry ?? createToolRegistry(env);
  const bridgeClient = options.bridgeClient ?? new BridgeClient();
  const jobStore = options.jobStore ?? new JobStore(env.JOBS_FILE_PATH);
  const auditService = options.auditService ?? new AuditService(env.AUDIT_LOG_PATH);

  await jobStore.init();
  await auditService.init();

  const pollingService = new PollingService(
    jobStore,
    auditService,
    bridgeClient,
    hostRegistry,
    toolRegistry,
  );
  const executionService = new ExecutionService(
    hostRegistry,
    toolRegistry,
    bridgeClient,
    jobStore,
    auditService,
    pollingService,
  );

  const app = Fastify({
    logger: false,
  });

  await registerHealthRoute(app, { hostRegistry, toolRegistry });
  await registerExecuteRoute(app, { executionService });
  await registerJobsRoute(app, { jobStore, pollingService });
  await pollingService.resumePendingJobs();

  return app;
}
