import { AppError } from "../lib/errors";
import type { HostDefinition, JobStatus } from "../types";
import type { ToolDefinition } from "../registry/tool-registry";

interface BridgeEnvelope {
  requestId: string;
  sessionId: string;
  source: string;
  targetHost: string;
  tool: string;
  mode: "sync" | "async";
  args: unknown;
  meta: {
    user: string;
    timestamp: string;
  };
}

export interface BridgeSyncResult {
  status: JobStatus;
  result: unknown | null;
  error: unknown | null;
}

export interface BridgeAsyncAck {
  status: JobStatus;
  remoteJobId?: string;
  result: unknown | null;
  error: unknown | null;
  pollPath?: string;
}

export interface BridgeJobStatus {
  status: JobStatus;
  result: unknown | null;
  error: unknown | null;
}

export class BridgeClient {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async executeSync(
    host: HostDefinition,
    tool: ToolDefinition,
    payload: BridgeEnvelope,
  ): Promise<BridgeSyncResult> {
    const body = await this.sendJson(host, tool.bridge.submitPath, "POST", payload, tool.timeoutMs);

    return {
      status: this.normalizeStatus(body?.status, body),
      result: body?.result ?? body ?? null,
      error: body?.error ?? null,
    };
  }

  async submitAsync(
    host: HostDefinition,
    tool: ToolDefinition,
    payload: BridgeEnvelope,
  ): Promise<BridgeAsyncAck> {
    const body = await this.sendJson(host, tool.bridge.submitPath, "POST", payload, tool.timeoutMs);

    return {
      status: this.normalizeStatus(body?.status, body),
      remoteJobId: body?.jobId ?? body?.bridgeJobId,
      result: body?.result ?? null,
      error: body?.error ?? null,
      pollPath: body?.pollPath,
    };
  }

  async getJobStatus(
    host: HostDefinition,
    tool: ToolDefinition,
    remoteJobId: string,
    pollPath?: string,
  ): Promise<BridgeJobStatus> {
    const statusPath = pollPath ?? tool.bridge.statusPath?.replace(":jobId", encodeURIComponent(remoteJobId));

    if (!statusPath) {
      throw new AppError(
        500,
        "internal_error",
        `Tool '${tool.name}' does not define an async status path.`,
      );
    }

    const body = await this.sendJson(host, statusPath, "GET", undefined, tool.timeoutMs);

    return {
      status: this.normalizeStatus(body?.status, body),
      result: body?.result ?? null,
      error: body?.error ?? null,
    };
  }

  private async sendJson(
    host: HostDefinition,
    inputPath: string,
    method: "GET" | "POST",
    payload: unknown,
    timeoutMs: number,
  ): Promise<Record<string, any> | null> {
    const url = inputPath.startsWith("http")
      ? inputPath
      : new URL(inputPath, host.baseUrl.endsWith("/") ? host.baseUrl : `${host.baseUrl}/`).toString();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await this.fetchImpl(url, {
        method,
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          ...(host.headers ?? {}),
        },
        body: payload ? JSON.stringify(payload) : undefined,
      });

      const body = await this.parseBody(response);

      if (!response.ok) {
        throw this.mapHttpError(response.status, body);
      }

      return body;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === "AbortError") {
        throw new AppError(504, "bridge_timeout", "Bridge request timed out.");
      }

      throw new AppError(502, "bridge_unreachable", "Bridge is unreachable.", {
        cause: error instanceof Error ? error.message : "unknown",
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async parseBody(response: Response): Promise<Record<string, any> | null> {
    const text = await response.text();

    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text) as Record<string, any>;
    } catch {
      return {
        result: text,
      };
    }
  }

  private mapHttpError(statusCode: number, body: Record<string, any> | null): AppError {
    const message =
      body?.error?.message ??
      body?.message ??
      (statusCode === 408 || statusCode === 504
        ? "Bridge request timed out."
        : "Bridge execution failed.");

    if (statusCode === 408 || statusCode === 504) {
      return new AppError(504, "bridge_timeout", message);
    }

    if (statusCode === 502 || statusCode === 503) {
      return new AppError(502, "bridge_unreachable", message);
    }

    return new AppError(502, "remote_execution_failed", message, {
      bridgeStatusCode: statusCode,
      bridgeCode: body?.error?.code,
    });
  }

  private normalizeStatus(status: string | undefined, body: Record<string, any> | null): JobStatus {
    const value = status?.toLowerCase();

    if (!value) {
  if (body?.error) {
    return "failed";
  }

  if (body?.ok === true) {
    return "completed";
  }

  if (body?.result !== undefined) {
    return "completed";
  }

  return "running";
}

    if (value === "accepted" || value === "queued" || value === "submitted") {
      return "accepted";
    }

    if (value === "running" || value === "in_progress") {
      return "running";
    }

    if (value === "completed" || value === "succeeded" || value === "success" || value === "done") {
      return "completed";
    }

    if (value === "timeout" || value === "timed_out") {
      return "timeout";
    }

    return "failed";
  }
}
