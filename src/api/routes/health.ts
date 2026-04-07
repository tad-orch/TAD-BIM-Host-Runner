import type { FastifyInstance } from "fastify";

import { HostRegistry } from "../../registry/host-registry";
import { ToolRegistry } from "../../registry/tool-registry";

interface HealthRouteDeps {
  hostRegistry: HostRegistry;
  toolRegistry: ToolRegistry;
}

export async function registerHealthRoute(app: FastifyInstance, deps: HealthRouteDeps): Promise<void> {
  app.get("/health", async (_request, reply) =>
    reply.status(200).send({
      status: "ok",
      tools: deps.toolRegistry.all().map((tool) => ({
        name: tool.name,
        mode: tool.mode,
      })),
      hosts: deps.hostRegistry.all().map((host) => ({
        id: host.id,
        machineType: host.machineType,
        enabledTools: host.enabledTools,
      })),
    }),
  );
}
