import { z } from "zod";

export const revitPingArgsSchema = z.object({}).strict();

const pointSchema = z
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
    start: pointSchema,
    end: pointSchema,
    unconnectedHeight: z.number().positive().finite(),
  })
  .strict();
