import Fastify, { type FastifyInstance } from "fastify";

import { registerConversationsRoutes } from "./api/routes/conversations";
import { registerExecuteRoute } from "./api/routes/execute";
import { registerHealthRoute } from "./api/routes/health";
import { registerHostsRoute } from "./api/routes/hosts";
import { registerJobsRoute } from "./api/routes/jobs";
import { registerMcpRoutes } from "./api/routes/mcp";
import { BridgeClient } from "./clients/bridge-client";
import { loadEnv, type Env } from "./config/env";
import { createDbClient, type DbClient } from "./db/client";
import { AuditRepository } from "./db/repositories/audit-repo";
import { ConversationsRepository } from "./db/repositories/conversations-repo";
import { HostsRepository } from "./db/repositories/hosts-repo";
import { JobsRepository } from "./db/repositories/jobs-repo";
import { MessagesRepository } from "./db/repositories/messages-repo";
import { createHostRegistry, type HostRegistry } from "./registry/host-registry";
import { createToolRegistry, type ToolRegistry } from "./registry/tool-registry";
import { AuditService } from "./services/audit-service";
import { ChatService } from "./services/chat-service";
import { ExecutionService } from "./services/execution-service";
import { JobStore } from "./services/job-store";
import { PollingService } from "./services/polling-service";

export interface BuildAppOptions {
  env?: Env;
  envOverrides?: Partial<NodeJS.ProcessEnv>;
  dbClient?: DbClient;
  hostRegistry?: HostRegistry;
  toolRegistry?: ToolRegistry;
  bridgeClient?: BridgeClient;
  jobStore?: JobStore;
  auditService?: AuditService;
  chatService?: ChatService;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const env = options.env ?? loadEnv(options.envOverrides);
  const ownsDbClient = !options.dbClient;
  const dbClient = options.dbClient ?? createDbClient(env);
  const hostsRepository = new HostsRepository(dbClient.db);
  const jobsRepository = new JobsRepository(dbClient.db);
  const auditRepository = new AuditRepository(dbClient.db);
  const conversationsRepository = new ConversationsRepository(dbClient.db);
  const messagesRepository = new MessagesRepository(dbClient.db);
  const hostRegistry = options.hostRegistry ?? createHostRegistry(env, hostsRepository);
  const toolRegistry = options.toolRegistry ?? createToolRegistry(env);
  const bridgeClient = options.bridgeClient ?? new BridgeClient();
  const jobStore = options.jobStore ?? new JobStore(jobsRepository);
  const auditService = options.auditService ?? new AuditService(auditRepository);
  const chatService = options.chatService ?? new ChatService(conversationsRepository, messagesRepository);

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

  app.addHook("onClose", async () => {
    if (ownsDbClient) {
      dbClient.close();
    }
  });

  await registerHealthRoute(app, { hostRegistry, toolRegistry });
  await registerHostsRoute(app, { hostsRepository });
  await registerConversationsRoutes(app, { chatService });
  await registerMcpRoutes(app, { executionService });
  await registerExecuteRoute(app, { executionService });
  await registerJobsRoute(app, { jobStore, pollingService });
  await pollingService.resumePendingJobs();

  return app;
}
