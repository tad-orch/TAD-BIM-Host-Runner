import { z } from "zod";

import {
  revitCloudOpenConflictPolicySchema,
  revitExportScopeSchema,
  revitGuidSchema,
  revitPreferredVersionSchema,
  revitWorksetOpenModeSchema,
} from "../schemas/tools/revit";
import type {
  McpArchRevitActivateDocumentRequest,
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

const mcpArchRevitOpenCloudModelInputSchema = mcpBaseRequestSchema
  .extend({
    projectGuid: revitGuidSchema.optional(),
    projectId: revitGuidSchema.optional(),
    modelGuid: revitGuidSchema,
    region: z.enum(["US", "EMEA", "EU", "APAC"]),
    openInUi: z.boolean().optional(),
    openInCurrentSession: z.boolean().optional(),
    detach: z.boolean().default(false),
    audit: z.boolean().default(false),
    worksets: z
      .object({
        mode: revitWorksetOpenModeSchema.default("default"),
      })
      .strict()
      .optional(),
    cloudOpenConflictPolicy: revitCloudOpenConflictPolicySchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.projectGuid && !value.projectId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["projectGuid"],
        message: "Provide 'projectGuid'. Temporary compatibility alias 'projectId' is also accepted.",
      });
    }
  });

export const mcpArchRevitOpenCloudModelRequestSchema = mcpArchRevitOpenCloudModelInputSchema.transform(
  (value) => ({
    requestId: value.requestId,
    targetHost: value.targetHost,
    projectGuid: value.projectGuid ?? value.projectId ?? "",
    modelGuid: value.modelGuid,
    region: value.region === "EU" ? "EMEA" : value.region,
    openInUi: value.openInUi ?? value.openInCurrentSession ?? false,
    audit: value.audit,
    worksets: value.worksets ?? {
      mode: "default",
    },
    cloudOpenConflictPolicy:
      value.cloudOpenConflictPolicy ?? (value.detach ? "detach_from_central" : "use_default"),
  }),
) satisfies z.ZodType<McpArchRevitOpenCloudModelRequest>;

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

export const mcpArchRevitActivateDocumentRequestSchema = mcpBaseRequestSchema
  .extend({
    documentTitle: z.string().min(1).max(255),
  })
  .strict() satisfies z.ZodType<McpArchRevitActivateDocumentRequest>;
