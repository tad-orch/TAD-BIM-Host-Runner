import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import Database from "better-sqlite3";

import { buildApp } from "../src/app";

async function createTempDataDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "backend-api-test-"));
}

function getDbPath(dataDir: string): string {
  return path.join(dataDir, "app.db");
}

test("GET /api/hosts returns SQLite-backed hosts and prefers existing DB rows over later HOSTS_JSON", async () => {
  const dataDir = await createTempDataDir();

  const firstApp = await buildApp({
    envOverrides: {
      DATA_DIR: dataDir,
      HOSTS_JSON: JSON.stringify([
        {
          id: "seed-host-01",
          baseUrl: "http://127.0.0.1:3101",
          machineType: "revit-bridge",
          capabilities: ["revit", "acc"],
          enabledTools: ["revit_ping", "revit_create_wall"],
        },
      ]),
    },
  });

  await firstApp.close();

  const secondApp = await buildApp({
    envOverrides: {
      DATA_DIR: dataDir,
      HOSTS_JSON: JSON.stringify([
        {
          id: "replacement-host-01",
          baseUrl: "http://127.0.0.1:3201",
          machineType: "revit-bridge",
          capabilities: ["revit"],
          enabledTools: ["revit_ping"],
        },
      ]),
    },
  });

  try {
    const response = await secondApp.inject({
      method: "GET",
      url: "/api/hosts",
    });

    assert.equal(response.statusCode, 200);
    const payload = response.json();
    assert.equal(payload.hosts.length, 1);
    assert.equal(payload.hosts[0].id, "seed-host-01");
    assert.equal(payload.hosts[0].baseUrl, "http://127.0.0.1:3101");
    assert.equal(payload.hosts[0].machineType, "revit-bridge");
    assert.deepEqual(payload.hosts[0].capabilities, ["revit", "acc"]);
    assert.deepEqual(payload.hosts[0].enabledTools, ["revit_ping", "revit_create_wall"]);
    assert.equal(payload.hosts[0].isActive, true);
    assert.equal(typeof payload.hosts[0].createdAt, "string");
    assert.equal(typeof payload.hosts[0].updatedAt, "string");

    const db = new Database(getDbPath(dataDir), { readonly: true });

    try {
      const countRow = db
        .prepare("SELECT COUNT(*) AS count FROM hosts")
        .get() as {
        count: number;
      };

      assert.equal(countRow.count, 1);
    } finally {
      db.close();
    }
  } finally {
    await secondApp.close();
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});

test("GET /api/conversations and GET /api/conversations/:id/messages return SQLite-backed records", async () => {
  const dataDir = await createTempDataDir();
  const app = await buildApp({
    envOverrides: {
      DATA_DIR: dataDir,
    },
  });

  const db = new Database(getDbPath(dataDir));

  try {
    db.prepare(
      `
        INSERT INTO conversations (id, title, user_id, target_host, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
    ).run(
      "conv-01",
      "Wall Iteration",
      "user-01",
      "tad-bim-01",
      "2026-04-06T12:00:00.000Z",
      "2026-04-06T12:05:00.000Z",
    );

    db.prepare(
      `
        INSERT INTO messages (id, conversation_id, role, content, tool_name, job_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      "msg-01",
      "conv-01",
      "user",
      "Create a wall on Level 1",
      "mcp-arch-walls-create",
      "job-123",
      "2026-04-06T12:01:00.000Z",
    );

    db.prepare(
      `
        INSERT INTO messages (id, conversation_id, role, content, tool_name, job_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      "msg-02",
      "conv-01",
      "assistant",
      "Submitted wall creation job.",
      null,
      "job-123",
      "2026-04-06T12:02:00.000Z",
    );

    const conversationsResponse = await app.inject({
      method: "GET",
      url: "/api/conversations",
    });

    assert.equal(conversationsResponse.statusCode, 200);
    assert.deepEqual(conversationsResponse.json(), {
      conversations: [
        {
          id: "conv-01",
          title: "Wall Iteration",
          userId: "user-01",
          targetHost: "tad-bim-01",
          createdAt: "2026-04-06T12:00:00.000Z",
          updatedAt: "2026-04-06T12:05:00.000Z",
        },
      ],
    });

    const messagesResponse = await app.inject({
      method: "GET",
      url: "/api/conversations/conv-01/messages",
    });

    assert.equal(messagesResponse.statusCode, 200);
    assert.deepEqual(messagesResponse.json(), {
      conversation: {
        id: "conv-01",
        title: "Wall Iteration",
        userId: "user-01",
        targetHost: "tad-bim-01",
        createdAt: "2026-04-06T12:00:00.000Z",
        updatedAt: "2026-04-06T12:05:00.000Z",
      },
      messages: [
        {
          id: "msg-01",
          conversationId: "conv-01",
          role: "user",
          content: "Create a wall on Level 1",
          toolName: "mcp-arch-walls-create",
          jobId: "job-123",
          createdAt: "2026-04-06T12:01:00.000Z",
        },
        {
          id: "msg-02",
          conversationId: "conv-01",
          role: "assistant",
          content: "Submitted wall creation job.",
          toolName: null,
          jobId: "job-123",
          createdAt: "2026-04-06T12:02:00.000Z",
        },
      ],
    });
  } finally {
    db.close();
    await app.close();
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});

test("GET /api/jobs lists jobs latest-first with filters and GET /api/jobs/:jobId returns stored job data", async () => {
  const dataDir = await createTempDataDir();
  const app = await buildApp({
    envOverrides: {
      DATA_DIR: dataDir,
    },
  });

  const db = new Database(getDbPath(dataDir));

  try {
    db.prepare(
      `
        INSERT INTO jobs (
          job_id, request_id, remote_job_id, poll_path, tool, internal_tool, target_host,
          mode, status, source, session_id, args_json, result_json, error_json,
          created_at, updated_at, completed_at, duration_ms
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      "sync:req-old",
      "req-old",
      null,
      null,
      "revit_ping",
      "revit_ping",
      "tad-bim-01",
      "sync",
      "completed",
      "mcp-gateway",
      "mcp-gateway",
      "{}",
      "{\"ok\":true}",
      null,
      "2026-04-06T12:00:00.000Z",
      "2026-04-06T12:00:00.000Z",
      "2026-04-06T12:00:00.000Z",
      42,
    );

    db.prepare(
      `
        INSERT INTO jobs (
          job_id, request_id, remote_job_id, poll_path, tool, internal_tool, target_host,
          mode, status, source, session_id, args_json, result_json, error_json,
          created_at, updated_at, completed_at, duration_ms
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      "job-newer",
      "req-newer",
      "bridge-job-1",
      "/jobs/bridge-job-1",
      "revit_create_wall",
      "revit_create_wall",
      "tad-bim-02",
      "async",
      "accepted",
      "mcp-gateway",
      "mcp-gateway",
      "{\"levelName\":\"Level 1\"}",
      null,
      null,
      "2026-04-06T12:05:00.000Z",
      "2026-04-06T12:05:00.000Z",
      null,
      null,
    );

    db.prepare(
      `
        INSERT INTO jobs (
          job_id, request_id, remote_job_id, poll_path, tool, internal_tool, target_host,
          mode, status, source, session_id, args_json, result_json, error_json,
          created_at, updated_at, completed_at, duration_ms
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      "job-filter",
      "req-filter",
      "bridge-job-2",
      "/jobs/bridge-job-2",
      "revit_create_wall",
      "revit_create_wall",
      "tad-bim-01",
      "async",
      "completed",
      "mcp-gateway",
      "mcp-gateway",
      "{\"levelName\":\"Level 2\"}",
      "{\"elementId\":123}",
      null,
      "2026-04-06T12:10:00.000Z",
      "2026-04-06T12:11:00.000Z",
      "2026-04-06T12:11:00.000Z",
      60000,
    );

    const listResponse = await app.inject({
      method: "GET",
      url: "/api/jobs",
    });

    assert.equal(listResponse.statusCode, 200);
    assert.deepEqual(
      listResponse.json().jobs.map((job: { jobId: string }) => job.jobId),
      ["job-filter", "job-newer", "sync:req-old"],
    );

    const filteredResponse = await app.inject({
      method: "GET",
      url: "/api/jobs?status=completed&targetHost=tad-bim-01&tool=revit_create_wall",
    });

    assert.equal(filteredResponse.statusCode, 200);
    assert.equal(filteredResponse.json().jobs.length, 1);
    assert.equal(filteredResponse.json().jobs[0].jobId, "job-filter");

    const jobResponse = await app.inject({
      method: "GET",
      url: "/api/jobs/job-filter",
    });

    assert.equal(jobResponse.statusCode, 200);
    assert.deepEqual(jobResponse.json(), {
      jobId: "job-filter",
      requestId: "req-filter",
      remoteJobId: "bridge-job-2",
      pollPath: "/jobs/bridge-job-2",
      tool: "revit_create_wall",
      internalTool: "revit_create_wall",
      targetHost: "tad-bim-01",
      mode: "async",
      status: "completed",
      source: "mcp-gateway",
      sessionId: "mcp-gateway",
      args: {
        levelName: "Level 2",
      },
      createdAt: "2026-04-06T12:10:00.000Z",
      updatedAt: "2026-04-06T12:11:00.000Z",
      completedAt: "2026-04-06T12:11:00.000Z",
      durationMs: 60000,
      result: {
        elementId: 123,
      },
      error: null,
    });
  } finally {
    db.close();
    await app.close();
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});
