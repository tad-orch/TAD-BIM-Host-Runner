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
  return fs.mkdtemp(path.join(os.tmpdir(), "chat-api-test-"));
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

test("POST /api/chat routes Revit health requests deterministically and persists conversation messages", async () => {
  const bridge = Fastify({ logger: false });

  await bridge.post("/tools/revit_ping", async () => ({
    status: "completed",
    result: {
      ok: true,
      bridge: "revit",
    },
  }));

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
      url: "/api/chat",
      payload: {
        message: "Please check Revit health on the host.",
      },
    });

    assert.equal(response.statusCode, 200);

    const payload = response.json();
    assert.equal(payload.tool, "mcp-arch-system-health");
    assert.equal(payload.job, null);
    assert.equal(payload.conversation.targetHost, "tad-bim-01");
    assert.equal(payload.messages.length, 2);
    assert.equal(payload.messages[0].role, "user");
    assert.equal(payload.messages[1].role, "assistant");
    assert.equal(payload.messages[1].toolName, "mcp-arch-system-health");
    assert.equal(payload.messages[1].jobId, null);
    assert.match(payload.messages[1].content, /Revit connectivity check completed/i);

    const db = new Database(getDbPath(dataDir), { readonly: true });

    try {
      const rows = db
        .prepare(
          `
            SELECT role, tool_name, job_id
            FROM messages
            WHERE conversation_id = ?
            ORDER BY created_at ASC
          `,
        )
        .all(payload.conversation.id) as Array<{
        role: string;
        tool_name: string | null;
        job_id: string | null;
      }>;

      assert.deepEqual(rows, [
        {
          role: "user",
          tool_name: null,
          job_id: null,
        },
        {
          role: "assistant",
          tool_name: "mcp-arch-system-health",
          job_id: null,
        },
      ]);
    } finally {
      db.close();
    }
  } finally {
    await app.close();
    await bridge.close();
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});

test("POST /api/chat routes wall creation deterministically, persists messages, and exposes the created job", async () => {
  const bridge = Fastify({ logger: false });
  let capturedPayload: Record<string, unknown> | null = null;
  let pollCount = 0;

  await bridge.post("/tools/revit_create_wall", async (request) => {
    capturedPayload = request.body as Record<string, unknown>;

    return {
      status: "accepted",
      jobId: "bridge-wall-chat-1",
    };
  });

  await bridge.get("/jobs/bridge-wall-chat-1", async () => {
    pollCount += 1;

    if (pollCount < 2) {
      return {
        status: "running",
      };
    }

    return {
      status: "completed",
      result: {
        elementId: 321,
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
      url: "/api/chat",
      payload: {
        message: "Create a 15 meter wall in Revit using Generic - 200mm on Level 3 with height 4",
      },
    });

    assert.equal(response.statusCode, 200);

    const payload = response.json();
    assert.equal(payload.tool, "mcp-arch-walls-create");
    assert.equal(payload.job.status, "accepted");
    assert.equal(payload.job.remoteJobId, "bridge-wall-chat-1");
    assert.equal(payload.messages.length, 2);
    assert.equal(payload.messages[1].toolName, "mcp-arch-walls-create");
    assert.equal(payload.messages[1].jobId, payload.job.jobId);
    assert.match(payload.messages[1].content, /submitted/i);

    assert.deepEqual(capturedPayload, {
      requestId: payload.job.requestId,
      sessionId: "mcp-gateway",
      source: "mcp-gateway",
      targetHost: "tad-bim-01",
      tool: "revit_create_wall",
      mode: "async",
      args: {
        documentPath: "active",
        levelName: "Level 3",
        wallType: "Generic - 200mm",
        start: { x: 0, y: 0, z: 0 },
        end: { x: 0, y: 15, z: 0 },
        unconnectedHeight: 4,
      },
      meta: {
        user: "mcp-gateway",
        timestamp:
          capturedPayload?.meta && typeof capturedPayload.meta === "object"
            ? (capturedPayload.meta as Record<string, unknown>).timestamp
            : null,
      },
    });

    const jobResponse = await app.inject({
      method: "GET",
      url: `/api/jobs/${payload.job.jobId}`,
    });

    assert.equal(jobResponse.statusCode, 200);
    assert.equal(jobResponse.json().status, "accepted");
    assert.equal(jobResponse.json().tool, "revit_create_wall");

    const completedJob = await waitFor(
      async () => {
        const response = await app.inject({
          method: "GET",
          url: `/jobs/${payload.job.jobId}`,
        });

        assert.equal(response.statusCode, 200);
        return response.json();
      },
      (job) => job.status === "completed",
      1_500,
    );

    assert.deepEqual(completedJob.result, {
      elementId: 321,
    });
  } finally {
    await app.close();
    await bridge.close();
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});

test("POST /api/chat returns a deterministic unsupported response when the message cannot be mapped", async () => {
  const dataDir = await createTempDataDir();
  const app = await buildApp({
    envOverrides: {
      DATA_DIR: dataDir,
    },
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Export the current model to NWC",
      },
    });

    assert.equal(response.statusCode, 200);

    const payload = response.json();
    assert.equal(payload.tool, null);
    assert.equal(payload.job, null);
    assert.equal(payload.messages.length, 2);
    assert.match(payload.messages[1].content, /unsupported in the current phase/i);
  } finally {
    await app.close();
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});
