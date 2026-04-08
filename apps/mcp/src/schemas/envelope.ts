import { z } from "zod";

export const executeRequestSchema = z
  .object({
    requestId: z.string().min(1).max(255).optional(),
    sessionId: z.string().min(1).max(255),
    source: z.string().min(1).max(255),
    targetHost: z.string().min(1).max(255),
    tool: z.string().min(1).max(255),
    mode: z.enum(["sync", "async"]),
    args: z.unknown(),
    meta: z
      .object({
        user: z.string().min(1).max(255),
        timestamp: z.iso.datetime(),
      })
      .strict(),
  })
  .strict();

export type ExecuteRequestEnvelope = z.infer<typeof executeRequestSchema>;

export const hostDefinitionSchema = z
  .object({
    id: z.string().min(1).max(255),
    baseUrl: z.url(),
    machineType: z.string().min(1).max(255),
    capabilities: z.array(z.string().min(1)).default([]),
    enabledTools: z
      .array(
        z.enum([
          "revit_ping",
          "revit_create_wall",
          "revit_session_status",
          "revit_launch",
          "revit_open_cloud_model",
          "revit_list_3d_views",
          "revit_export_nwc",
        ]),
      )
      .default([]),
    headers: z.record(z.string(), z.string()).optional(),
  })
  .strict();
