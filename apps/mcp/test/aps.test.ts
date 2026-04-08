import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import Fastify from "fastify";
import type { AddressInfo } from "node:net";

import { buildApp } from "../src/app";

async function createTempDataDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "aps-api-test-"));
}

function getBaseUrl(portSource: AddressInfo | string | null): string {
  if (!portSource || typeof portSource === "string") {
    throw new Error("APS server did not expose a TCP address.");
  }

  return `http://127.0.0.1:${portSource.port}`;
}

async function createApsServer(): Promise<ReturnType<typeof Fastify>> {
  const aps = Fastify({ logger: false });

  aps.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_request, body, done) => {
    done(null, body);
  });

  return aps;
}

test("GET /api/aps/projects lists APS projects and top folders and reuses the cached token file", async () => {
  const aps = await createApsServer();
  let tokenRequests = 0;

  await aps.post("/authentication/v2/token", async (request) => {
    tokenRequests += 1;
    assert.match(String(request.body), /grant_type=client_credentials/);

    return {
      access_token: "aps-token",
      token_type: "Bearer",
      expires_in: 3600,
    };
  });

  await aps.get("/project/v1/hubs", async () => ({
    data: [
      {
        id: "b.hub-001",
        type: "hubs",
        attributes: {
          name: "ACC Hub",
          region: "US",
          extension: {
            type: "hubs:autodesk.bim360:Account",
            data: {
              accountId: "b.hub-001",
            },
          },
        },
      },
    ],
  }));

  await aps.get("/project/v1/hubs/:hubId/projects", async (request) => {
    const { hubId } = request.params as { hubId: string };
    assert.equal(hubId, "b.hub-001");

    return {
      data: [
        {
          id: "b.project-001",
          type: "projects",
          attributes: {
            name: "Coordination Project",
            extension: {
              type: "projects:autodesk.bim360:Project",
            },
          },
        },
      ],
    };
  });

  await aps.get("/project/v1/hubs/:hubId/projects/:projectId/topFolders", async (request) => {
    const { projectId } = request.params as { hubId: string; projectId: string };
    assert.equal(projectId, "b.project-001");

    return {
      data: [
        {
          id: "urn:adsk.wipprod:fs.folder:co.project-files",
          type: "folders",
          attributes: {
            name: "Project Files",
            displayName: "Project Files",
            extension: {
              type: "folders:autodesk.bim360:Folder",
            },
          },
        },
      ],
    };
  });

  await aps.listen({ host: "127.0.0.1", port: 0 });

  const dataDir = await createTempDataDir();
  const tokenPath = path.join(dataDir, "auth", "aps-token.json");
  const envOverrides = {
    DATA_DIR: dataDir,
    APS_BASE_URL: getBaseUrl(aps.server.address()),
    APS_CLIENT_ID: "test-client",
    APS_CLIENT_SECRET: "test-secret",
    APS_TOKEN_STORAGE_PATH: tokenPath,
    APS_ACCOUNT_ID: "b.hub-001",
  };

  const app = await buildApp({ envOverrides });

  try {
    const projectsResponse = await app.inject({
      method: "GET",
      url: "/api/aps/projects",
    });

    assert.equal(projectsResponse.statusCode, 200);
    assert.deepEqual(projectsResponse.json(), {
      projects: [
        {
          id: "b.project-001",
          name: "Coordination Project",
          hubId: "b.hub-001",
          hubName: "ACC Hub",
          region: "US",
          projectType: "projects:autodesk.bim360:Project",
        },
      ],
    });

    const foldersResponse = await app.inject({
      method: "GET",
      url: "/api/aps/projects/b.project-001/top-folders",
    });

    assert.equal(foldersResponse.statusCode, 200);
    assert.deepEqual(foldersResponse.json(), {
      project: {
        id: "b.project-001",
        name: "Coordination Project",
        hubId: "b.hub-001",
        hubName: "ACC Hub",
        region: "US",
        projectType: "projects:autodesk.bim360:Project",
      },
      folders: [
        {
          id: "urn:adsk.wipprod:fs.folder:co.project-files",
          name: "Project Files",
          displayName: "Project Files",
          type: "folders",
          extensionType: "folders:autodesk.bim360:Folder",
        },
      ],
    });

    assert.equal(tokenRequests, 1);
    const cachedToken = JSON.parse(await fs.readFile(tokenPath, "utf8")) as {
      accessToken: string;
      tokenType: string;
      expiresAtMs: number;
      scope: string;
      accountContext: string | null;
      userContext: string | null;
    };

    assert.equal(cachedToken.accessToken, "aps-token");
    assert.equal(cachedToken.tokenType, "Bearer");
    assert.equal(cachedToken.scope, "data:read");
    assert.equal(cachedToken.accountContext, "b.hub-001");
    assert.equal(cachedToken.userContext, null);
    assert.equal(typeof cachedToken.expiresAtMs, "number");
    assert.ok(cachedToken.expiresAtMs > Date.now());
  } finally {
    await app.close();
  }

  const secondApp = await buildApp({ envOverrides });

  try {
    const secondResponse = await secondApp.inject({
      method: "GET",
      url: "/api/aps/projects",
    });

    assert.equal(secondResponse.statusCode, 200);
    assert.equal(tokenRequests, 1);
  } finally {
    await secondApp.close();
    await aps.close();
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});

test("GET /api/aps/projects/:projectId/items/:itemId/cloud-model-info resolves a Revit cloud model into an MCP-ready payload", async () => {
  const aps = await createApsServer();

  await aps.post("/authentication/v2/token", async () => ({
    access_token: "aps-token",
    token_type: "Bearer",
    expires_in: 3600,
  }));

  await aps.get("/project/v1/hubs", async () => ({
    data: [
      {
        id: "b.hub-001",
        type: "hubs",
        attributes: {
          name: "ACC Hub",
          region: "US",
        },
      },
    ],
  }));

  await aps.get("/project/v1/hubs/:hubId/projects", async () => ({
    data: [
      {
        id: "b.project-001",
        type: "projects",
        attributes: {
          name: "Coordination Project",
          extension: {
            type: "projects:autodesk.bim360:Project",
          },
        },
      },
    ],
  }));

  await aps.get("/data/v1/projects/:projectId/items/:itemId", async (request) => {
    const { projectId, itemId } = request.params as { projectId: string; itemId: string };
    assert.equal(projectId, "b.project-001");
    assert.equal(itemId, "urn:adsk.wipprod:dm.lineage:item-001");

    return {
      data: {
        id: itemId,
        type: "items",
        attributes: {
          displayName: "Coordination Model.rvt",
          name: "Coordination Model.rvt",
        },
        relationships: {
          tip: {
            data: {
              type: "versions",
              id: "urn:adsk.wipprod:fs.file:vf.model-001?version=3",
            },
          },
          storage: {
            data: {
              id: "urn:adsk.objects:os.object:wip.dm.prod/original-item",
            },
          },
        },
      },
    };
  });

  await aps.get("/data/v1/projects/:projectId/versions/:versionId", async (request) => {
    const { versionId } = request.params as { projectId: string; versionId: string };
    assert.equal(versionId, "urn:adsk.wipprod:fs.file:vf.model-001?version=3");

    return {
      data: {
        id: versionId,
        type: "versions",
        attributes: {
          displayName: "Coordination Model.rvt",
          name: "Coordination Model.rvt",
          versionNumber: 3,
          lastModifiedTime: "2026-04-07T12:00:00Z",
          extension: {
            type: "versions:autodesk.bim360:C4RModel",
            data: {
              projectGuid: "fd1335eb-733b-480c-9d16-1a22e742ef70",
              modelGuid: "e5a59497-0d79-4df0-879d-396310288bb0",
            },
          },
        },
        relationships: {
          item: {
            data: {
              id: "urn:adsk.wipprod:dm.lineage:item-001",
            },
          },
        },
      },
    };
  });

  await aps.listen({ host: "127.0.0.1", port: 0 });

  const dataDir = await createTempDataDir();
  const app = await buildApp({
    envOverrides: {
      DATA_DIR: dataDir,
      APS_BASE_URL: getBaseUrl(aps.server.address()),
      APS_CLIENT_ID: "test-client",
      APS_CLIENT_SECRET: "test-secret",
      APS_USER_ID: "ops-user-01",
    },
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/aps/projects/b.project-001/items/urn%3Aadsk.wipprod%3Adm.lineage%3Aitem-001/cloud-model-info",
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      isCloudModel: true,
      projectId: "b.project-001",
      projectName: "Coordination Project",
      itemId: "urn:adsk.wipprod:dm.lineage:item-001",
      versionId: "urn:adsk.wipprod:fs.file:vf.model-001?version=3",
      displayName: "Coordination Model.rvt",
      sourceFileName: "Coordination Model.rvt",
      region: "US",
      projectGuid: "fd1335eb-733b-480c-9d16-1a22e742ef70",
      modelGuid: "e5a59497-0d79-4df0-879d-396310288bb0",
      versionExtensionType: "versions:autodesk.bim360:C4RModel",
      originalItemUrn: "urn:adsk.objects:os.object:wip.dm.prod/original-item",
      lookupSource: "aps-data-management",
      accountContext: "b.hub-001",
      userContext: "ops-user-01",
      openCloudModelRequest: {
        region: "US",
        projectGuid: "fd1335eb-733b-480c-9d16-1a22e742ef70",
        modelGuid: "e5a59497-0d79-4df0-879d-396310288bb0",
        openInUi: false,
        audit: false,
        worksets: {
          mode: "default",
        },
        cloudOpenConflictPolicy: "use_default",
      },
    });
  } finally {
    await app.close();
    await aps.close();
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});

test("GET /api/aps/projects/:projectId/items/:itemId/cloud-model-info returns a clear non-cloud-model result", async () => {
  const aps = await createApsServer();

  await aps.post("/authentication/v2/token", async () => ({
    access_token: "aps-token",
    token_type: "Bearer",
    expires_in: 3600,
  }));

  await aps.get("/project/v1/hubs", async () => ({
    data: [
      {
        id: "b.hub-001",
        type: "hubs",
        attributes: {
          name: "ACC Hub",
          region: "EU",
        },
      },
    ],
  }));

  await aps.get("/project/v1/hubs/:hubId/projects", async () => ({
    data: [
      {
        id: "b.project-001",
        type: "projects",
        attributes: {
          name: "Coordination Project",
        },
      },
    ],
  }));

  await aps.get("/data/v1/projects/:projectId/items/:itemId", async (request) => {
    const { itemId } = request.params as { projectId: string; itemId: string };

    return {
      data: {
        id: itemId,
        type: "items",
        attributes: {
          displayName: "Reference.pdf",
          name: "Reference.pdf",
        },
        relationships: {
          tip: {
            data: {
              type: "versions",
              id: "version-001",
            },
          },
        },
      },
    };
  });

  await aps.get("/data/v1/projects/:projectId/versions/:versionId", async () => ({
    data: {
      id: "version-001",
      type: "versions",
      attributes: {
        displayName: "Reference.pdf",
        name: "Reference.pdf",
        extension: {
          type: "versions:autodesk.core:File",
          data: {},
        },
      },
    },
  }));

  await aps.listen({ host: "127.0.0.1", port: 0 });

  const dataDir = await createTempDataDir();
  const app = await buildApp({
    envOverrides: {
      DATA_DIR: dataDir,
      APS_BASE_URL: getBaseUrl(aps.server.address()),
      APS_CLIENT_ID: "test-client",
      APS_CLIENT_SECRET: "test-secret",
    },
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/aps/projects/b.project-001/items/item-001/cloud-model-info",
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      isCloudModel: false,
      reason: "item/version is not a Revit cloud model",
      projectId: "b.project-001",
      projectName: "Coordination Project",
      itemId: "item-001",
      versionId: "version-001",
      displayName: "Reference.pdf",
      sourceFileName: "Reference.pdf",
      region: "EMEA",
      projectGuid: null,
      modelGuid: null,
      versionExtensionType: "versions:autodesk.core:File",
      originalItemUrn: "item-001",
      lookupSource: "aps-data-management",
      accountContext: "b.hub-001",
      userContext: null,
      openCloudModelRequest: null,
    });
  } finally {
    await app.close();
    await aps.close();
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});
