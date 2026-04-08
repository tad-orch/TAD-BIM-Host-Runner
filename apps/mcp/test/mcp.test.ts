import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import Database from "better-sqlite3";
import Fastify from "fastify";
import type { AddressInfo } from "node:net";

import { buildApp } from "../src/app";

async function createTempDataDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "mcp-gateway-test-"));
}

function getBaseUrl(portSource: AddressInfo | string | null): string {
  if (!portSource || typeof portSource === "string") {
    throw new Error("Bridge server did not expose a TCP address.");
  }

  return `http://127.0.0.1:${portSource.port}`;
}

function getDbPath(dataDir: string): string {
  return path.join(dataDir, "app.db");
}

const allEnabledTools = [
  "revit_ping",
  "revit_create_wall",
  "revit_session_status",
  "revit_launch",
  "revit_open_cloud_model",
  "revit_list_3d_views",
  "revit_export_nwc",
] as const;

async function waitFor<T>(
  action: () => Promise<T>,
  predicate: (value: T) => boolean,
  timeoutMs: number,
): Promise<T> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const value = await action();

    if (predicate(value)) {
      return value;
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error(`Condition was not met within ${timeoutMs}ms.`);
}

test("POST /mcp/tools/mcp-arch-system-health maps to revit_ping", async () => {
  const bridge = Fastify({ logger: false });
  let capturedPayload: Record<string, unknown> | null = null;

  await bridge.post("/tools/revit_ping", async (request) => {
    capturedPayload = request.body as Record<string, unknown>;

    return {
      status: "completed",
      result: {
        ok: true,
        bridge: "revit",
      },
    };
  });

  await bridge.listen({ host: "127.0.0.1", port: 0 });

  const dataDir = await createTempDataDir();
  const app = await buildApp({
    envOverrides: {
      DATA_DIR: dataDir,
      HOSTS_JSON: JSON.stringify([
        {
          id: "tad-bim-01",
          baseUrl: getBaseUrl(bridge.server.address()),
          machineType: "revit-bridge",
          capabilities: ["revit"],
          enabledTools: ["revit_ping", "revit_create_wall"],
        },
      ]),
    },
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/mcp/tools/mcp-arch-system-health",
      payload: {
        targetHost: "tad-bim-01",
      },
    });

    assert.equal(response.statusCode, 200);

    const body = response.json();
    assert.equal(body.tool, "mcp-arch-system-health");
    assert.equal(body.internalTool, "revit_ping");
    assert.equal(body.targetHost, "tad-bim-01");
    assert.equal(body.jobId, null);
    assert.equal(body.status, "completed");
    assert.deepEqual(body.result, {
      ok: true,
      bridge: "revit",
    });
    assert.equal(typeof body.requestId, "string");
    assert.match(body.requestId, /^req_/);

    assert.deepEqual(capturedPayload, {
      requestId: body.requestId,
      sessionId: "mcp-gateway",
      source: "mcp-gateway",
      targetHost: "tad-bim-01",
      tool: "revit_ping",
      mode: "sync",
      args: {},
      meta: {
        user: "mcp-gateway",
        timestamp: capturedPayload?.meta && typeof capturedPayload.meta === "object"
          ? (capturedPayload.meta as Record<string, unknown>).timestamp
          : null,
      },
    });
  } finally {
    await app.close();
    await bridge.close();
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});

test("POST /mcp/tools/mcp-arch-walls-create maps length input to revit_create_wall and preserves /jobs polling", async () => {
  const bridge = Fastify({ logger: false });
  let capturedPayload: Record<string, unknown> | null = null;
  let pollCount = 0;

  await bridge.post("/tools/revit_create_wall", async (request) => {
    capturedPayload = request.body as Record<string, unknown>;

    return {
      status: "accepted",
      jobId: "bridge-wall-456",
    };
  });

  await bridge.get("/jobs/bridge-wall-456", async () => {
    pollCount += 1;

    if (pollCount < 2) {
      return {
        status: "running",
      };
    }

    return {
      status: "completed",
      result: {
        elementId: 9001,
      },
    };
  });

  await bridge.listen({ host: "127.0.0.1", port: 0 });

  const dataDir = await createTempDataDir();
  const app = await buildApp({
    envOverrides: {
      DATA_DIR: dataDir,
      POLL_INTERVAL_MS: "25",
      POLL_TIMEOUT_MS: "750",
      HOSTS_JSON: JSON.stringify([
        {
          id: "tad-bim-01",
          baseUrl: getBaseUrl(bridge.server.address()),
          machineType: "revit-bridge",
          capabilities: ["revit"],
          enabledTools: ["revit_ping", "revit_create_wall"],
        },
      ]),
    },
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/mcp/tools/mcp-arch-walls-create",
      payload: {
        targetHost: "tad-bim-01",
        length: 15,
      },
    });

    assert.equal(response.statusCode, 202);

    const body = response.json();
    assert.equal(body.tool, "mcp-arch-walls-create");
    assert.equal(body.internalTool, "revit_create_wall");
    assert.equal(body.status, "accepted");
    assert.equal(typeof body.jobId, "string");
    assert.equal(typeof body.requestId, "string");

    assert.deepEqual(capturedPayload, {
      requestId: body.requestId,
      sessionId: "mcp-gateway",
      source: "mcp-gateway",
      targetHost: "tad-bim-01",
      tool: "revit_create_wall",
      mode: "async",
      args: {
        documentPath: "active",
        levelName: "Level 1",
        wallType: "first_available_generic",
        start: { x: 0, y: 0, z: 0 },
        end: { x: 0, y: 15, z: 0 },
        unconnectedHeight: 3,
      },
      meta: {
        user: "mcp-gateway",
        timestamp: capturedPayload?.meta && typeof capturedPayload.meta === "object"
          ? (capturedPayload.meta as Record<string, unknown>).timestamp
          : null,
      },
    });

    const completedJob = await waitFor(
      async () => {
        const jobResponse = await app.inject({
          method: "GET",
          url: `/jobs/${body.jobId}`,
        });

        assert.equal(jobResponse.statusCode, 200);
        return jobResponse.json();
      },
      (payload) => payload.status === "completed",
      1_500,
    );

    assert.equal(completedJob.tool, "revit_create_wall");
    assert.deepEqual(completedJob.result, {
      elementId: 9001,
    });

    const db = new Database(getDbPath(dataDir), { readonly: true });

    try {
      const persistedJob = db
        .prepare(
          `
            SELECT status, remote_job_id
            FROM jobs
            WHERE job_id = ?
          `,
        )
        .get(body.jobId) as
        | {
            status: string;
            remote_job_id: string;
          }
        | undefined;

      assert.deepEqual(persistedJob, {
        status: "completed",
        remote_job_id: "bridge-wall-456",
      });
    } finally {
      db.close();
    }
  } finally {
    await app.close();
    await bridge.close();
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});

test("POST /mcp/tools/mcp-arch-walls-create supports coordinate-based input", async () => {
  const bridge = Fastify({ logger: false });
  let capturedPayload: Record<string, unknown> | null = null;

  await bridge.post("/tools/revit_create_wall", async (request) => {
    capturedPayload = request.body as Record<string, unknown>;

    return {
      status: "completed",
      result: {
        elementId: 4567,
      },
    };
  });

  await bridge.listen({ host: "127.0.0.1", port: 0 });

  const dataDir = await createTempDataDir();
  const app = await buildApp({
    envOverrides: {
      DATA_DIR: dataDir,
      HOSTS_JSON: JSON.stringify([
        {
          id: "tad-bim-01",
          baseUrl: getBaseUrl(bridge.server.address()),
          machineType: "revit-bridge",
          capabilities: ["revit"],
          enabledTools: ["revit_ping", "revit_create_wall"],
        },
      ]),
    },
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/mcp/tools/mcp-arch-walls-create",
      payload: {
        targetHost: "tad-bim-01",
        start: { x: 1, y: 2, z: 0 },
        end: { x: 1, y: 17, z: 0 },
        wallType: "Generic - 200mm",
        level: "Level 2",
        height: 4,
      },
    });

    assert.equal(response.statusCode, 200);

    const body = response.json();
    assert.equal(body.tool, "mcp-arch-walls-create");
    assert.equal(body.internalTool, "revit_create_wall");
    assert.equal(body.status, "completed");
    assert.deepEqual(body.result, {
      elementId: 4567,
    });

    assert.deepEqual(capturedPayload, {
      requestId: body.requestId,
      sessionId: "mcp-gateway",
      source: "mcp-gateway",
      targetHost: "tad-bim-01",
      tool: "revit_create_wall",
      mode: "async",
      args: {
        documentPath: "active",
        levelName: "Level 2",
        wallType: "Generic - 200mm",
        start: { x: 1, y: 2, z: 0 },
        end: { x: 1, y: 17, z: 0 },
        unconnectedHeight: 4,
      },
      meta: {
        user: "mcp-gateway",
        timestamp: capturedPayload?.meta && typeof capturedPayload.meta === "object"
          ? (capturedPayload.meta as Record<string, unknown>).timestamp
          : null,
      },
    });
  } finally {
    await app.close();
    await bridge.close();
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});

test("POST /mcp/tools/mcp-arch-walls-create rejects ambiguous geometry payloads", async () => {
  const dataDir = await createTempDataDir();
  const app = await buildApp({
    envOverrides: {
      DATA_DIR: dataDir,
    },
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/mcp/tools/mcp-arch-walls-create",
      payload: {
        targetHost: "tad-bim-01",
        length: 15,
        start: { x: 0, y: 0, z: 0 },
        end: { x: 0, y: 15, z: 0 },
      },
    });

    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error.code, "invalid_payload");
    assert.match(
      JSON.stringify(response.json().error.details.issues),
      /Provide either 'length' or both 'start' and 'end', but not both\./,
    );
  } finally {
    await app.close();
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});

test("POST /mcp/tools/mcp-arch-revit-session-status maps to revit_session_status", async () => {
  const bridge = Fastify({ logger: false });
  let capturedPayload: Record<string, unknown> | null = null;

  await bridge.post("/tools/revit_session_status", async (request) => {
    capturedPayload = request.body as Record<string, unknown>;

    return {
      status: "completed",
      result: {
        isOpen: true,
        activeVersion: "2025",
      },
    };
  });

  await bridge.listen({ host: "127.0.0.1", port: 0 });

  const dataDir = await createTempDataDir();
  const app = await buildApp({
    envOverrides: {
      DATA_DIR: dataDir,
      HOSTS_JSON: JSON.stringify([
        {
          id: "tad-bim-01",
          baseUrl: getBaseUrl(bridge.server.address()),
          machineType: "revit-bridge",
          capabilities: ["revit"],
          enabledTools: [...allEnabledTools],
        },
      ]),
    },
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/mcp/tools/mcp-arch-revit-session-status",
      payload: {
        targetHost: "tad-bim-01",
      },
    });

    assert.equal(response.statusCode, 200);

    const body = response.json();
    assert.equal(body.tool, "mcp-arch-revit-session-status");
    assert.equal(body.internalTool, "revit_session_status");
    assert.equal(body.targetHost, "tad-bim-01");
    assert.equal(body.jobId, null);
    assert.equal(body.status, "completed");
    assert.deepEqual(body.result, {
      isOpen: true,
      activeVersion: "2025",
    });

    assert.deepEqual(capturedPayload, {
      requestId: body.requestId,
      sessionId: "mcp-gateway",
      source: "mcp-gateway",
      targetHost: "tad-bim-01",
      tool: "revit_session_status",
      mode: "sync",
      args: {},
      meta: {
        user: "mcp-gateway",
        timestamp:
          capturedPayload?.meta && typeof capturedPayload.meta === "object"
            ? (capturedPayload.meta as Record<string, unknown>).timestamp
            : null,
      },
    });
  } finally {
    await app.close();
    await bridge.close();
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});

test("POST /mcp/tools/mcp-arch-revit-launch maps to revit_launch as a sync tool", async () => {
  const bridge = Fastify({ logger: false });
  let capturedPayload: Record<string, unknown> | null = null;

  await bridge.post("/tools/revit_launch", async (request) => {
    capturedPayload = request.body as Record<string, unknown>;

    return {
      status: "completed",
      result: {
        ready: true,
        version: "2025",
      },
    };
  });

  await bridge.listen({ host: "127.0.0.1", port: 0 });

  const dataDir = await createTempDataDir();
  const app = await buildApp({
    envOverrides: {
      DATA_DIR: dataDir,
      POLL_INTERVAL_MS: "25",
      POLL_TIMEOUT_MS: "750",
      HOSTS_JSON: JSON.stringify([
        {
          id: "tad-bim-01",
          baseUrl: getBaseUrl(bridge.server.address()),
          machineType: "revit-bridge",
          capabilities: ["revit"],
          enabledTools: [...allEnabledTools],
        },
      ]),
    },
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/mcp/tools/mcp-arch-revit-launch",
      payload: {
        targetHost: "tad-bim-01",
        preferredVersion: "2025",
        waitForReadySeconds: 60,
      },
    });

    assert.equal(response.statusCode, 200);

    const body = response.json();
    assert.equal(body.tool, "mcp-arch-revit-launch");
    assert.equal(body.internalTool, "revit_launch");
    assert.equal(body.status, "completed");
    assert.equal(body.jobId, null);
    assert.deepEqual(body.result, {
      ready: true,
      version: "2025",
    });

    assert.deepEqual(capturedPayload, {
      requestId: body.requestId,
      sessionId: "mcp-gateway",
      source: "mcp-gateway",
      targetHost: "tad-bim-01",
      tool: "revit_launch",
      mode: "sync",
      args: {
        preferredVersion: "2025",
        waitForReadySeconds: 60,
      },
      meta: {
        user: "mcp-gateway",
        timestamp:
          capturedPayload?.meta && typeof capturedPayload.meta === "object"
            ? (capturedPayload.meta as Record<string, unknown>).timestamp
            : null,
      },
    });
  } finally {
    await app.close();
    await bridge.close();
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});

test("POST /mcp/tools/mcp-arch-revit-open-cloud-model maps explicit cloud identity to revit_open_cloud_model", async () => {
  const bridge = Fastify({ logger: false });
  let capturedPayload: Record<string, unknown> | null = null;

  await bridge.post("/tools/revit_open_cloud_model", async (request) => {
    capturedPayload = request.body as Record<string, unknown>;

    return {
      status: "completed",
      result: {
        documentTitle: "Coordination Model",
        opened: true,
      },
    };
  });

  await bridge.listen({ host: "127.0.0.1", port: 0 });

  const dataDir = await createTempDataDir();
  const app = await buildApp({
    envOverrides: {
      DATA_DIR: dataDir,
      HOSTS_JSON: JSON.stringify([
        {
          id: "tad-bim-01",
          baseUrl: getBaseUrl(bridge.server.address()),
          machineType: "revit-bridge",
          capabilities: ["revit"],
          enabledTools: [...allEnabledTools],
        },
      ]),
    },
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/mcp/tools/mcp-arch-revit-open-cloud-model",
      payload: {
        targetHost: "tad-bim-01",
        projectGuid: "fd1335eb-733b-480c-9d16-1a22e742ef70",
        modelGuid: "e5a59497-0d79-4df0-879d-396310288bb0",
        region: "US",
        openInUi: false,
        audit: false,
        worksets: {
          mode: "default",
        },
        cloudOpenConflictPolicy: "use_default",
      },
    });

    assert.equal(response.statusCode, 200);

    const body = response.json();
    assert.equal(body.tool, "mcp-arch-revit-open-cloud-model");
    assert.equal(body.internalTool, "revit_open_cloud_model");
    assert.equal(body.status, "completed");
    assert.equal(typeof body.jobId, "string");
    assert.deepEqual(body.result, {
      documentTitle: "Coordination Model",
      opened: true,
    });

    assert.deepEqual(capturedPayload, {
      requestId: body.requestId,
      sessionId: "mcp-gateway",
      source: "mcp-gateway",
      targetHost: "tad-bim-01",
      tool: "revit_open_cloud_model",
      mode: "async",
      args: {
        projectGuid: "fd1335eb-733b-480c-9d16-1a22e742ef70",
        modelGuid: "e5a59497-0d79-4df0-879d-396310288bb0",
        region: "US",
        openInUi: false,
        audit: false,
        worksets: {
          mode: "default",
        },
        cloudOpenConflictPolicy: "use_default",
      },
      meta: {
        user: "mcp-gateway",
        timestamp:
          capturedPayload?.meta && typeof capturedPayload.meta === "object"
            ? (capturedPayload.meta as Record<string, unknown>).timestamp
            : null,
      },
    });
  } finally {
    await app.close();
    await bridge.close();
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});

test("POST /mcp/tools/mcp-arch-revit-open-cloud-model accepts temporary compatibility aliases", async () => {
  const bridge = Fastify({ logger: false });
  let capturedPayload: Record<string, unknown> | null = null;

  await bridge.post("/tools/revit_open_cloud_model", async (request) => {
    capturedPayload = request.body as Record<string, unknown>;

    return {
      status: "completed",
      result: {
        opened: false,
      },
    };
  });

  await bridge.listen({ host: "127.0.0.1", port: 0 });

  const dataDir = await createTempDataDir();
  const app = await buildApp({
    envOverrides: {
      DATA_DIR: dataDir,
      HOSTS_JSON: JSON.stringify([
        {
          id: "tad-bim-01",
          baseUrl: getBaseUrl(bridge.server.address()),
          machineType: "revit-bridge",
          capabilities: ["revit"],
          enabledTools: [...allEnabledTools],
        },
      ]),
    },
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/mcp/tools/mcp-arch-revit-open-cloud-model",
      payload: {
        targetHost: "tad-bim-01",
        projectId: "fd1335eb-733b-480c-9d16-1a22e742ef70",
        modelGuid: "e5a59497-0d79-4df0-879d-396310288bb0",
        region: "EU",
        openInCurrentSession: true,
        detach: true,
        audit: false,
      },
    });

    assert.equal(response.statusCode, 200);

    const body = response.json();
    assert.equal(body.tool, "mcp-arch-revit-open-cloud-model");
    assert.equal(body.internalTool, "revit_open_cloud_model");
    assert.deepEqual(capturedPayload, {
      requestId: body.requestId,
      sessionId: "mcp-gateway",
      source: "mcp-gateway",
      targetHost: "tad-bim-01",
      tool: "revit_open_cloud_model",
      mode: "async",
      args: {
        projectGuid: "fd1335eb-733b-480c-9d16-1a22e742ef70",
        modelGuid: "e5a59497-0d79-4df0-879d-396310288bb0",
        region: "EMEA",
        openInUi: true,
        audit: false,
        worksets: {
          mode: "default",
        },
        cloudOpenConflictPolicy: "detach_from_central",
      },
      meta: {
        user: "mcp-gateway",
        timestamp:
          capturedPayload?.meta && typeof capturedPayload.meta === "object"
            ? (capturedPayload.meta as Record<string, unknown>).timestamp
            : null,
      },
    });
  } finally {
    await app.close();
    await bridge.close();
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});

test("POST /mcp/tools/mcp-arch-revit-list-3d-views maps to revit_list_3d_views", async () => {
  const bridge = Fastify({ logger: false });
  let capturedPayload: Record<string, unknown> | null = null;

  await bridge.post("/tools/revit_list_3d_views", async (request) => {
    capturedPayload = request.body as Record<string, unknown>;

    return {
      status: "completed",
      result: {
        views: [
          { name: "{3D}", exportable: true },
          { name: "Coordination 3D", exportable: true },
        ],
      },
    };
  });

  await bridge.listen({ host: "127.0.0.1", port: 0 });

  const dataDir = await createTempDataDir();
  const app = await buildApp({
    envOverrides: {
      DATA_DIR: dataDir,
      HOSTS_JSON: JSON.stringify([
        {
          id: "tad-bim-01",
          baseUrl: getBaseUrl(bridge.server.address()),
          machineType: "revit-bridge",
          capabilities: ["revit"],
          enabledTools: [...allEnabledTools],
        },
      ]),
    },
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/mcp/tools/mcp-arch-revit-list-3d-views",
      payload: {
        targetHost: "tad-bim-01",
        onlyExportable: true,
      },
    });

    assert.equal(response.statusCode, 200);

    const body = response.json();
    assert.equal(body.tool, "mcp-arch-revit-list-3d-views");
    assert.equal(body.internalTool, "revit_list_3d_views");
    assert.equal(body.jobId, null);
    assert.deepEqual(body.result, {
      views: [
        { name: "{3D}", exportable: true },
        { name: "Coordination 3D", exportable: true },
      ],
    });

    assert.deepEqual(capturedPayload, {
      requestId: body.requestId,
      sessionId: "mcp-gateway",
      source: "mcp-gateway",
      targetHost: "tad-bim-01",
      tool: "revit_list_3d_views",
      mode: "sync",
      args: {
        onlyExportable: true,
      },
      meta: {
        user: "mcp-gateway",
        timestamp:
          capturedPayload?.meta && typeof capturedPayload.meta === "object"
            ? (capturedPayload.meta as Record<string, unknown>).timestamp
            : null,
      },
    });
  } finally {
    await app.close();
    await bridge.close();
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});

test("POST /mcp/tools/mcp-arch-revit-export-nwc maps to revit_export_nwc and preserves /jobs polling", async () => {
  const bridge = Fastify({ logger: false });
  let capturedPayload: Record<string, unknown> | null = null;
  let pollCount = 0;

  await bridge.post("/tools/revit_export_nwc", async (request) => {
    capturedPayload = request.body as Record<string, unknown>;

    return {
      status: "accepted",
      jobId: "bridge-export-1",
    };
  });

  await bridge.get("/jobs/bridge-export-1", async () => {
    pollCount += 1;

    if (pollCount < 2) {
      return {
        status: "running",
      };
    }

    return {
      status: "completed",
      result: {
        outputPath: "C:\\Exports\\MyModel.nwc",
        exportedViews: ["{3D}"],
      },
    };
  });

  await bridge.listen({ host: "127.0.0.1", port: 0 });

  const dataDir = await createTempDataDir();
  const app = await buildApp({
    envOverrides: {
      DATA_DIR: dataDir,
      POLL_INTERVAL_MS: "25",
      POLL_TIMEOUT_MS: "750",
      HOSTS_JSON: JSON.stringify([
        {
          id: "tad-bim-01",
          baseUrl: getBaseUrl(bridge.server.address()),
          machineType: "revit-bridge",
          capabilities: ["revit"],
          enabledTools: [...allEnabledTools],
        },
      ]),
    },
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/mcp/tools/mcp-arch-revit-export-nwc",
      payload: {
        targetHost: "tad-bim-01",
        viewNames: ["{3D}"],
        outputPath: "C:\\Exports\\MyModel.nwc",
        exportScope: "selected_views",
      },
    });

    assert.equal(response.statusCode, 202);

    const body = response.json();
    assert.equal(body.tool, "mcp-arch-revit-export-nwc");
    assert.equal(body.internalTool, "revit_export_nwc");
    assert.equal(body.status, "accepted");

    assert.deepEqual(capturedPayload, {
      requestId: body.requestId,
      sessionId: "mcp-gateway",
      source: "mcp-gateway",
      targetHost: "tad-bim-01",
      tool: "revit_export_nwc",
      mode: "async",
      args: {
        viewNames: ["{3D}"],
        outputPath: "C:\\Exports\\MyModel.nwc",
        exportScope: "selected_views",
      },
      meta: {
        user: "mcp-gateway",
        timestamp:
          capturedPayload?.meta && typeof capturedPayload.meta === "object"
            ? (capturedPayload.meta as Record<string, unknown>).timestamp
            : null,
      },
    });

    const completedJob = await waitFor(
      async () => {
        const jobResponse = await app.inject({
          method: "GET",
          url: `/jobs/${body.jobId}`,
        });

        assert.equal(jobResponse.statusCode, 200);
        return jobResponse.json();
      },
      (payload) => payload.status === "completed",
      1_500,
    );

    assert.equal(completedJob.tool, "revit_export_nwc");
    assert.deepEqual(completedJob.result, {
      outputPath: "C:\\Exports\\MyModel.nwc",
      exportedViews: ["{3D}"],
    });
  } finally {
    await app.close();
    await bridge.close();
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});
