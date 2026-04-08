import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { normalizeError } from "../../lib/errors";
import { ApsCloudModelDiscoveryService } from "../../integrations/aps/cloud-model-discovery";

const projectParamsSchema = z
  .object({
    projectId: z.string().min(1).max(512),
  })
  .strict();

const folderParamsSchema = z
  .object({
    projectId: z.string().min(1).max(512),
    folderId: z.string().min(1).max(2048),
  })
  .strict();

const cloudModelInfoParamsSchema = z
  .object({
    projectId: z.string().min(1).max(512),
    itemId: z.string().min(1).max(2048),
  })
  .strict();

interface ApsRouteDeps {
  apsDiscoveryService: ApsCloudModelDiscoveryService;
}

export async function registerApsRoutes(app: FastifyInstance, deps: ApsRouteDeps): Promise<void> {
  app.get("/api/aps/projects", async (_request, reply) => {
    try {
      return reply.status(200).send({
        projects: await deps.apsDiscoveryService.listProjects(),
      });
    } catch (error) {
      const normalized = normalizeError(error);
      return reply.status(normalized.statusCode).send({
        projects: [],
        error: {
          code: normalized.code,
          message: normalized.message,
          details: normalized.details,
        },
      });
    }
  });

  app.get("/api/aps/projects/:projectId/top-folders", async (request, reply) => {
    try {
      const params = projectParamsSchema.parse(request.params);
      const payload = await deps.apsDiscoveryService.listTopFolders(params.projectId);
      return reply.status(200).send(payload);
    } catch (error) {
      const normalized = normalizeError(error);
      return reply.status(normalized.statusCode).send({
        project: null,
        folders: [],
        error: {
          code: normalized.code,
          message: normalized.message,
          details: normalized.details,
        },
      });
    }
  });

  app.get("/api/aps/projects/:projectId/folders/:folderId/contents", async (request, reply) => {
    try {
      const params = folderParamsSchema.parse(request.params);
      const payload = await deps.apsDiscoveryService.listFolderContents(params.projectId, params.folderId);
      return reply.status(200).send(payload);
    } catch (error) {
      const normalized = normalizeError(error);
      return reply.status(normalized.statusCode).send({
        projectId: null,
        folderId: null,
        entries: [],
        error: {
          code: normalized.code,
          message: normalized.message,
          details: normalized.details,
        },
      });
    }
  });

  app.get("/api/aps/projects/:projectId/items/:itemId/cloud-model-info", async (request, reply) => {
    try {
      const params = cloudModelInfoParamsSchema.parse(request.params);
      const payload = await deps.apsDiscoveryService.getItemCloudModelInfo(params.projectId, params.itemId);
      return reply.status(200).send(payload);
    } catch (error) {
      const normalized = normalizeError(error);
      return reply.status(normalized.statusCode).send({
        isCloudModel: false,
        reason: normalized.message,
        projectId: null,
        projectName: null,
        itemId: null,
        versionId: null,
        displayName: null,
        sourceFileName: null,
        region: null,
        projectGuid: null,
        modelGuid: null,
        versionExtensionType: null,
        originalItemUrn: null,
        lookupSource: "aps-data-management",
        accountContext: null,
        userContext: null,
        openCloudModelRequest: null,
        error: {
          code: normalized.code,
          message: normalized.message,
          details: normalized.details,
        },
      });
    }
  });
}
