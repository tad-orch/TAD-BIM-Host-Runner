import { z } from "zod";

import type { McpArchSystemHealthRequest, McpArchWallsCreateRequest, McpPoint } from "./types";

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
