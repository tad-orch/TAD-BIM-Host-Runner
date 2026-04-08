import { z, type ZodType } from "zod";

import {
  revitCreateWallArgsSchema,
  revitExportNwcArgsSchema,
  revitLaunchArgsSchema,
  revitList3dViewsArgsSchema,
  revitOpenCloudModelArgsSchema,
  revitPingArgsSchema,
  revitSessionStatusArgsSchema,
} from "../schemas/tools/revit";
import type { Env } from "../config/env";
import type { ToolName } from "../types";

export interface ToolDefinition<TArgs = unknown> {
  name: ToolName;
  mode: "sync" | "async";
  argsSchema: ZodType<TArgs>;
  bridge: {
    submitPath: string;
    statusPath?: string;
  };
  timeoutMs: number;
  polling?: {
    intervalMs: number;
    timeoutMs: number;
  };
  summarizeArgs: (args: TArgs | any) => Record<string, unknown>;
}

export class ToolRegistry {
  constructor(private readonly tools: Map<ToolName, ToolDefinition>) {}

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name as ToolName);
  }

  has(name: string): boolean {
    return this.tools.has(name as ToolName);
  }

  all(): ToolDefinition[] {
    return [...this.tools.values()];
  }
}

export function createToolRegistry(env: Env): ToolRegistry {
  const tools = new Map<ToolName, ToolDefinition>();

  tools.set("revit_ping", {
    name: "revit_ping",
    mode: "sync",
    argsSchema: revitPingArgsSchema,
    bridge: {
      submitPath: "/tools/revit_ping",
    },
    timeoutMs: env.BRIDGE_REQUEST_TIMEOUT_MS,
    summarizeArgs: () => ({}),
  });

  tools.set("revit_create_wall", {
    name: "revit_create_wall",
    mode: "async",
    argsSchema: revitCreateWallArgsSchema as ZodType<z.infer<typeof revitCreateWallArgsSchema>>,
    bridge: {
      submitPath: "/tools/revit_create_wall",
      statusPath: "/jobs/:jobId",
    },
    timeoutMs: env.BRIDGE_REQUEST_TIMEOUT_MS,
    polling: {
      intervalMs: env.POLL_INTERVAL_MS,
      timeoutMs: env.POLL_TIMEOUT_MS,
    },
    summarizeArgs: (args: z.infer<typeof revitCreateWallArgsSchema>) => ({
      documentPath: args.documentPath,
      levelName: args.levelName,
      wallType: args.wallType,
      start: args.start,
      end: args.end,
      unconnectedHeight: args.unconnectedHeight,
    }),
  });

  tools.set("revit_session_status", {
    name: "revit_session_status",
    mode: "sync",
    argsSchema: revitSessionStatusArgsSchema,
    bridge: {
      submitPath: "/tools/revit_session_status",
    },
    timeoutMs: env.BRIDGE_REQUEST_TIMEOUT_MS,
    summarizeArgs: () => ({}),
  });

  tools.set("revit_launch", {
    name: "revit_launch",
    mode: "sync",
    argsSchema: revitLaunchArgsSchema as ZodType<z.infer<typeof revitLaunchArgsSchema>>,
    bridge: {
      submitPath: "/tools/revit_launch",
    },
    timeoutMs: env.BRIDGE_REQUEST_TIMEOUT_MS,
    summarizeArgs: (args: z.infer<typeof revitLaunchArgsSchema>) => ({
      preferredVersion: args.preferredVersion ?? null,
      waitForReadySeconds: args.waitForReadySeconds,
    }),
  });

  tools.set("revit_open_cloud_model", {
    name: "revit_open_cloud_model",
    mode: "async",
    argsSchema: revitOpenCloudModelArgsSchema as ZodType<z.infer<typeof revitOpenCloudModelArgsSchema>>,
    bridge: {
      submitPath: "/tools/revit_open_cloud_model",
      statusPath: "/jobs/:jobId",
    },
    timeoutMs: env.BRIDGE_REQUEST_TIMEOUT_MS,
    polling: {
      intervalMs: env.POLL_INTERVAL_MS,
      timeoutMs: env.POLL_TIMEOUT_MS,
    },
    summarizeArgs: (args: z.infer<typeof revitOpenCloudModelArgsSchema>) => ({
      projectGuid: args.projectGuid,
      modelGuid: args.modelGuid,
      region: args.region,
      openInUi: args.openInUi,
      audit: args.audit,
      worksets: args.worksets,
      cloudOpenConflictPolicy: args.cloudOpenConflictPolicy,
    }),
  });

  tools.set("revit_list_3d_views", {
    name: "revit_list_3d_views",
    mode: "sync",
    argsSchema: revitList3dViewsArgsSchema,
    bridge: {
      submitPath: "/tools/revit_list_3d_views",
    },
    timeoutMs: env.BRIDGE_REQUEST_TIMEOUT_MS,
    summarizeArgs: (args: z.infer<typeof revitList3dViewsArgsSchema>) => ({
      onlyExportable: args.onlyExportable,
    }),
  });

  tools.set("revit_export_nwc", {
    name: "revit_export_nwc",
    mode: "async",
    argsSchema: revitExportNwcArgsSchema as ZodType<z.infer<typeof revitExportNwcArgsSchema>>,
    bridge: {
      submitPath: "/tools/revit_export_nwc",
      statusPath: "/jobs/:jobId",
    },
    timeoutMs: env.BRIDGE_REQUEST_TIMEOUT_MS,
    polling: {
      intervalMs: env.POLL_INTERVAL_MS,
      timeoutMs: env.POLL_TIMEOUT_MS,
    },
    summarizeArgs: (args: z.infer<typeof revitExportNwcArgsSchema>) => ({
      viewNames: args.viewNames,
      outputPath: args.outputPath,
      exportScope: args.exportScope,
    }),
  });

  return new ToolRegistry(tools);
}
