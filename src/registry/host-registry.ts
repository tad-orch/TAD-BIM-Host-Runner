import { hostDefinitionSchema } from "../schemas/envelope";
import type { Env } from "../config/env";
import type { HostDefinition, ToolName } from "../types";
import { AppError } from "../lib/errors";

const defaultHosts = (_env: Env): HostDefinition[] => [
  {
    id: "tad-ops-01",
    baseUrl: "http://127.0.0.1:3001",
    machineType: "revit-bridge",
    capabilities: ["revit"],
    enabledTools: ["revit_ping", "revit_create_wall"],
  },
  {
    id: "tad-bim-01",
    baseUrl: "http://127.0.0.1:3002",
    machineType: "revit-bridge",
    capabilities: ["revit"],
    enabledTools: ["revit_ping", "revit_create_wall"],
  },
];

export class HostRegistry {
  constructor(private readonly hosts: Map<string, HostDefinition>) {}

  get(hostId: string): HostDefinition | undefined {
    return this.hosts.get(hostId);
  }

  require(hostId: string): HostDefinition {
    const host = this.get(hostId);

    if (!host) {
      throw new AppError(404, "host_not_found", `Target host '${hostId}' was not found.`, {
        targetHost: hostId,
      });
    }

    return host;
  }

  isToolEnabled(hostId: string, tool: ToolName): boolean {
    const host = this.require(hostId);
    return host.enabledTools.includes(tool);
  }

  all(): HostDefinition[] {
    return [...this.hosts.values()];
  }
}

export function createHostRegistry(env: Env): HostRegistry {
  const configuredHosts = env.HOSTS_JSON
    ? hostDefinitionSchema.array().parse(JSON.parse(env.HOSTS_JSON))
    : defaultHosts(env);

  const hosts = new Map<string, HostDefinition>();

  for (const host of configuredHosts) {
    hosts.set(host.id, host);
  }

  return new HostRegistry(hosts);
}
