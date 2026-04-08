import { z } from "zod";

import {
  revitCloudRegionSchema,
  revitExportScopeSchema,
  revitPreferredVersionSchema,
} from "../schemas/tools/revit";
import type {
  McpArchRevitExportNwcRequest,
  McpArchRevitLaunchRequest,
  McpArchRevitList3dViewsRequest,
  McpArchRevitOpenCloudModelRequest,
  McpArchRevitSessionStatusRequest,
  McpArchSystemHealthRequest,
  McpArchWallsCreateRequest,
  McpPoint,
} from "./types";

const requestIdSchema = z.string().min(1).max(255).optional();
const targetHostSchema = z.string().min(1).max(255);

export const mcpBaseRequestSchema = z
  .object({
    requestId: requestIdSchema,
    targetHost: targetHostSchema,
  })
  .strict();

export const mcpPointSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    z: z.number().finite().default(0),
  })
  .strict() satisfies z.ZodType<McpPoint>;

export const mcpArchSystemHealthRequestSchema =
  mcpBaseRequestSchema satisfies z.ZodType<McpArchSystemHealthRequest>;

export const mcpArchRevitSessionStatusRequestSchema =
  mcpBaseRequestSchema satisfies z.ZodType<McpArchRevitSessionStatusRequest>;

export const mcpArchWallsCreateRequestSchema = mcpBaseRequestSchema
  .extend({
    length: z.number().positive().finite().optional(),
    start: mcpPointSchema.optional(),
    end: mcpPointSchema.optional(),
    wallType: z.string().min(1).max(255).default("first_available_generic"),
    level: z.string().min(1).max(255).default("Level 1"),
    height: z.number().positive().finite().default(3),
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasLength = value.length !== undefined;
    const hasStart = value.start !== undefined;
    const hasEnd = value.end !== undefined;

    if (hasLength && (hasStart || hasEnd)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["length"],
        message: "Provide either 'length' or both 'start' and 'end', but not both.",
      });
    }

    if (!hasLength && !hasStart && !hasEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["length"],
        message: "Provide either 'length' or both 'start' and 'end'.",
      });
    }

    if (!hasLength && hasStart !== hasEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [hasStart ? "end" : "start"],
        message: "Both 'start' and 'end' are required when 'length' is omitted.",
      });
    }
  }) satisfies z.ZodType<McpArchWallsCreateRequest>;

export const mcpArchRevitLaunchRequestSchema = mcpBaseRequestSchema
  .extend({
    preferredVersion: revitPreferredVersionSchema.optional(),
    waitForReadySeconds: z.number().int().positive().max(600).default(60),
  })
  .strict() satisfies z.ZodType<McpArchRevitLaunchRequest>;

export const mcpArchRevitOpenCloudModelRequestSchema = mcpBaseRequestSchema
  .extend({
    projectId: z.string().min(1).max(255),
    modelGuid: z.string().min(1).max(255),
    region: revitCloudRegionSchema,
    openInCurrentSession: z.boolean().default(true),
    detach: z.boolean().default(false),
    audit: z.boolean().default(false),
  })
  .strict() satisfies z.ZodType<McpArchRevitOpenCloudModelRequest>;

export const mcpArchRevitList3dViewsRequestSchema = mcpBaseRequestSchema
  .extend({
    onlyExportable: z.boolean().default(true),
  })
  .strict() satisfies z.ZodType<McpArchRevitList3dViewsRequest>;

export const mcpArchRevitExportNwcRequestSchema = mcpBaseRequestSchema
  .extend({
    viewNames: z.array(z.string().min(1).max(255)).min(1).max(100),
    outputPath: z.string().min(1).max(1024),
    exportScope: revitExportScopeSchema.default("selected_views"),
  })
  .strict() satisfies z.ZodType<McpArchRevitExportNwcRequest>;
