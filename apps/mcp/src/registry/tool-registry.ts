import { z, type ZodType } from "zod";

import { revitCreateWallArgsSchema, revitPingArgsSchema } from "../schemas/tools/revit";
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

  return new ToolRegistry(tools);
}
