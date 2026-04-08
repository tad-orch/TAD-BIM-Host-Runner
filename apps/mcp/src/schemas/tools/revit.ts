import { z } from "zod";

export const revitPingArgsSchema = z.object({}).strict();
export const revitSessionStatusArgsSchema = z.object({}).strict();
export const revitPreferredVersionSchema = z.string().regex(/^20\d{2}$/).max(10);
export const revitCloudRegionSchema = z.enum(["US", "EMEA", "APAC"]);
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
    projectId: z.string().min(1).max(255),
    modelGuid: z.string().min(1).max(255),
    region: revitCloudRegionSchema,
    openInCurrentSession: z.boolean().default(true),
    detach: z.boolean().default(false),
    audit: z.boolean().default(false),
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
