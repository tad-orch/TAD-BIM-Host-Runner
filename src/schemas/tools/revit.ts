import { z } from "zod";

export const revitPingArgsSchema = z.object({}).strict();

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

export type RevitPingArgs = z.infer<typeof revitPingArgsSchema>;
export type RevitPoint = z.infer<typeof revitPointSchema>;
export type RevitCreateWallArgs = z.infer<typeof revitCreateWallArgsSchema>;
