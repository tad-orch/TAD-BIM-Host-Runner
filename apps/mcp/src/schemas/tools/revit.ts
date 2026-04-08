import { z } from "zod";

export const revitPingArgsSchema = z.object({}).strict();
export const revitSessionStatusArgsSchema = z.object({}).strict();
export const revitPreferredVersionSchema = z.string().regex(/^20\d{2}$/).max(10);
export const revitCloudRegionSchema = z.enum(["US", "EMEA", "APAC"]);
export const revitGuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
export const revitWorksetOpenModeSchema = z.enum([
  "default",
  "open_all",
  "close_all",
  "open_last_viewed",
]);
export const revitCloudOpenConflictPolicySchema = z.enum([
  "use_default",
  "discard_local_changes_and_open_latest_version",
  "keep_local_changes",
  "detach_from_central",
  "cancel",
]);
export const revitExportScopeSchema = z.enum(["selected_views"]);

export const revitPointSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    z: z.number().finite().default(0),
  })
  .strict();

export const revitCreateWallArgsSchema = z
  .object({
    documentPath: z.string().min(1).max(1024),
    levelName: z.string().min(1).max(255),
    wallType: z.string().min(1).max(255),
    start: revitPointSchema,
    end: revitPointSchema,
    unconnectedHeight: z.number().positive().finite(),
  })
  .strict();

export const revitLaunchArgsSchema = z
  .object({
    preferredVersion: revitPreferredVersionSchema.optional(),
    waitForReadySeconds: z.number().int().positive().max(600).default(60),
  })
  .strict();

export const revitOpenCloudModelArgsSchema = z
  .object({
    projectGuid: revitGuidSchema,
    modelGuid: revitGuidSchema,
    region: revitCloudRegionSchema,
    openInUi: z.boolean().default(false),
    audit: z.boolean().default(false),
    worksets: z
      .object({
        mode: revitWorksetOpenModeSchema.default("default"),
      })
      .strict()
      .default({
        mode: "default",
      }),
    cloudOpenConflictPolicy: revitCloudOpenConflictPolicySchema.default("use_default"),
  })
  .strict();

export const revitList3dViewsArgsSchema = z
  .object({
    onlyExportable: z.boolean().default(true),
  })
  .strict();

export const revitExportNwcArgsSchema = z
  .object({
    viewNames: z.array(z.string().min(1).max(255)).min(1).max(100),
    outputPath: z.string().min(1).max(1024),
    exportScope: revitExportScopeSchema.default("selected_views"),
  })
  .strict();

export type RevitPingArgs = z.infer<typeof revitPingArgsSchema>;
export type RevitSessionStatusArgs = z.infer<typeof revitSessionStatusArgsSchema>;
export type RevitPoint = z.infer<typeof revitPointSchema>;
export type RevitCreateWallArgs = z.infer<typeof revitCreateWallArgsSchema>;
export type RevitLaunchArgs = z.infer<typeof revitLaunchArgsSchema>;
export type RevitOpenCloudModelArgs = z.infer<typeof revitOpenCloudModelArgsSchema>;
export type RevitList3dViewsArgs = z.infer<typeof revitList3dViewsArgsSchema>;
export type RevitExportNwcArgs = z.infer<typeof revitExportNwcArgsSchema>;
