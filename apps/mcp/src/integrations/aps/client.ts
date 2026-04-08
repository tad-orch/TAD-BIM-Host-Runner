import { AppError } from "../../lib/errors";
import type { Env } from "../../config/env";
import { ApsAuthService } from "./auth";
import { ApsTokenCache } from "./token-cache";

export class ApsClient {
  constructor(
    private readonly env: Env,
    private readonly authService: ApsAuthService = new ApsAuthService(env, new ApsTokenCache(env)),
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  isConfigured(): boolean {
    return this.authService.isConfigured();
  }

  async getJson(path: string): Promise<Record<string, unknown>> {
    const token = await this.authService.getAccessToken();
    const response = await this.fetchImpl(this.resolveUrl(path), {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/json",
      },
    });

    const body = await this.parseJson(response);

    if (!response.ok) {
      throw this.mapHttpError(response.status, body);
    }

    return body;
  }

  private resolveUrl(path: string): string {
    return new URL(path, this.env.APS_BASE_URL.endsWith("/") ? this.env.APS_BASE_URL : `${this.env.APS_BASE_URL}/`)
      .toString();
  }

  private async parseJson(response: Response): Promise<Record<string, unknown>> {
    const text = await response.text();

    if (!text) {
      return {};
    }

    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new AppError(502, "aps_request_failed", "APS returned non-JSON content.");
    }
  }

  private extractMessage(body: Record<string, unknown>): string | null {
    const detail = typeof body.detail === "string" ? body.detail : null;
    const developerMessage = typeof body.developerMessage === "string" ? body.developerMessage : null;
    const message = typeof body.message === "string" ? body.message : null;

    return detail ?? developerMessage ?? message;
  }

  private mapHttpError(statusCode: number, body: Record<string, unknown>): AppError {
    const message = this.extractMessage(body) ?? "APS request failed.";

    if (statusCode === 404) {
      return new AppError(404, "aps_resource_not_found", message);
    }

    if (statusCode === 401 || statusCode === 403) {
      return new AppError(502, "aps_auth_failed", message);
    }

    return new AppError(502, "aps_request_failed", message, {
      apsStatusCode: statusCode,
    });
  }
}
