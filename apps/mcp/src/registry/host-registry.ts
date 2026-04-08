import { hostDefinitionSchema } from "../schemas/envelope";
import type { Env } from "../config/env";
import type { HostDefinition, ToolName } from "../types";
import { AppError } from "../lib/errors";
import { HostsRepository } from "../db/repositories/hosts-repo";

const defaultHosts = (_env: Env): HostDefinition[] => [
  {
    id: "tad-ops-01",
    baseUrl: "http://127.0.0.1:3001",
    machineType: "revit-bridge",
    capabilities: ["revit"],
    enabledTools: [
      "revit_ping",
      "revit_create_wall",
      "revit_session_status",
      "revit_launch",
      "revit_open_cloud_model",
      "revit_list_3d_views",
      "revit_export_nwc",
    ],
  },
  {
    id: "tad-bim-01",
    baseUrl: "http://127.0.0.1:3002",
    machineType: "revit-bridge",
    capabilities: ["revit"],
    enabledTools: [
      "revit_ping",
      "revit_create_wall",
      "revit_session_status",
      "revit_launch",
      "revit_open_cloud_model",
      "revit_list_3d_views",
      "revit_export_nwc",
    ],
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

function resolveBootstrapHosts(env: Env): HostDefinition[] {
  if (env.HOSTS_JSON) {
    return hostDefinitionSchema.array().parse(JSON.parse(env.HOSTS_JSON));
  }

  return defaultHosts(env);
}

export function createHostRegistry(env: Env, hostsRepository: HostsRepository): HostRegistry {
  if (hostsRepository.countAll() === 0) {
    hostsRepository.upsertMany(resolveBootstrapHosts(env));
  }

  const hosts = new Map<string, HostDefinition>();
  const configuredHosts = hostsRepository.list({ activeOnly: true });

  for (const host of configuredHosts) {
    hosts.set(host.id, {
      id: host.id,
      baseUrl: host.baseUrl,
      machineType: host.machineType,
      capabilities: host.capabilities,
      enabledTools: host.enabledTools,
      headers: host.headers,
    });
  }

  return new HostRegistry(hosts);
}
