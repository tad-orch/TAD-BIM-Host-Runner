import type { FastifyInstance } from "fastify";

import { HostsRepository } from "../../db/repositories/hosts-repo";

interface HostsRouteDeps {
  hostsRepository: HostsRepository;
}

export async function registerHostsRoute(app: FastifyInstance, deps: HostsRouteDeps): Promise<void> {
  app.get("/api/hosts", async (_request, reply) =>
    reply.status(200).send({
      hosts: deps.hostsRepository.list(),
    }),
  );
}
