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
  return fs.mkdtemp(path.join(os.tmpdir(), "host-runner-test-"));
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

test("POST /execute rejects unknown tools", async () => {
  const dataDir = await createTempDataDir();
  const app = await buildApp({
    envOverrides: {
      DATA_DIR: dataDir,
    },
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/execute",
      payload: {
        requestId: "req_unknown_tool",
        sessionId: "macmini-01",
        source: "openclaw",
        targetHost: "tad-ops-01",
        tool: "shell_exec",
        mode: "sync",
        args: {},
        meta: {
          user: "emnss26",
          timestamp: "2026-03-30T15:20:00Z",
        },
      },
    });

    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error.code, "unknown_tool");
  } finally {
    await app.close();
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});

test("POST /execute completes revit_ping synchronously and records audit data", async () => {
  const bridge = Fastify({ logger: false });
  await bridge.post("/tools/revit_ping", async () => ({
    status: "completed",
    result: {
      ok: true,
      bridge: "revit",
    },
  }));
  await bridge.listen({ host: "127.0.0.1", port: 0 });

  const baseUrl = getBaseUrl(bridge.server.address());
  const dataDir = await createTempDataDir();

  const app = await buildApp({
    envOverrides: {
      DATA_DIR: dataDir,
      HOSTS_JSON: JSON.stringify([
        {
          id: "tad-ops-01",
          baseUrl,
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
      url: "/execute",
      payload: {
        requestId: "req_ping_sync",
        sessionId: "macmini-01",
        source: "openclaw",
        targetHost: "tad-ops-01",
        tool: "revit_ping",
        mode: "sync",
        args: {},
        meta: {
          user: "emnss26",
          timestamp: "2026-03-30T15:20:00Z",
        },
      },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      requestId: "req_ping_sync",
      jobId: null,
      status: "completed",
      tool: "revit_ping",
      targetHost: "tad-ops-01",
      result: {
        ok: true,
        bridge: "revit",
      },
      error: null,
    });

    const db = new Database(getDbPath(dataDir), { readonly: true });

    try {
      const persistedExecution = db
        .prepare(
          `
            SELECT status, mode, tool, request_id
            FROM jobs
            WHERE request_id = ? AND mode = 'sync'
          `,
        )
        .get("req_ping_sync") as
        | {
            status: string;
            mode: string;
            tool: string;
            request_id: string;
          }
        | undefined;

      assert.deepEqual(persistedExecution, {
        status: "completed",
        mode: "sync",
        tool: "revit_ping",
        request_id: "req_ping_sync",
      });

      const auditRow = db
        .prepare(
          `
            SELECT outcome, request_id
            FROM audit_logs
            ORDER BY id ASC
            LIMIT 1
          `,
        )
        .get() as
        | {
            outcome: string;
            request_id: string;
          }
        | undefined;

      assert.deepEqual(auditRow, {
        outcome: "completed",
        request_id: "req_ping_sync",
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

test("POST /execute accepts revit_create_wall and GET /jobs/:jobId returns the completed async state", async () => {
  const bridge = Fastify({ logger: false });
  let pollCount = 0;

  await bridge.post("/tools/revit_create_wall", async () => ({
    status: "accepted",
    jobId: "bridge-wall-123",
  }));

  await bridge.get("/jobs/bridge-wall-123", async () => {
    pollCount += 1;

    if (pollCount < 2) {
      return {
        status: "running",
      };
    }

    return {
      status: "completed",
      result: {
        elementId: 4567,
      },
    };
  });

  await bridge.listen({ host: "127.0.0.1", port: 0 });
  const baseUrl = getBaseUrl(bridge.server.address());
  const dataDir = await createTempDataDir();

  const app = await buildApp({
    envOverrides: {
      DATA_DIR: dataDir,
      POLL_INTERVAL_MS: "25",
      POLL_TIMEOUT_MS: "750",
      HOSTS_JSON: JSON.stringify([
        {
          id: "tad-ops-01",
          baseUrl,
          machineType: "revit-bridge",
          capabilities: ["revit"],
          enabledTools: ["revit_ping", "revit_create_wall"],
        },
      ]),
    },
  });

  try {
    const submitResponse = await app.inject({
      method: "POST",
      url: "/execute",
      payload: {
        requestId: "req_create_wall_async",
        sessionId: "macmini-01",
        source: "openclaw",
        targetHost: "tad-ops-01",
        tool: "revit_create_wall",
        mode: "async",
        args: {
          documentPath: "C:/models/sample.rvt",
          levelName: "Level 1",
          wallType: "Generic - 8\"",
          start: { x: 0, y: 0, z: 0 },
          end: { x: 15, y: 0, z: 0 },
          unconnectedHeight: 10,
        },
        meta: {
          user: "emnss26",
          timestamp: "2026-03-30T15:20:00Z",
        },
      },
    });

    assert.equal(submitResponse.statusCode, 202);
    assert.equal(submitResponse.json().status, "accepted");

    const jobId = submitResponse.json().jobId;

    const completedJob = await waitFor(
      async () => {
        const response = await app.inject({
          method: "GET",
          url: `/jobs/${jobId}`,
        });

        assert.equal(response.statusCode, 200);
        return response.json();
      },
      (payload) => payload.status === "completed",
      1_500,
    );

    assert.deepEqual(completedJob.result, {
      elementId: 4567,
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
        .get(jobId) as
        | {
            status: string;
            remote_job_id: string;
          }
        | undefined;

      assert.deepEqual(persistedJob, {
        status: "completed",
        remote_job_id: "bridge-wall-123",
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
