import { AppError } from "../../lib/errors";
import type { Env } from "../../config/env";
import { ApsTokenCache } from "./token-cache";
import type { ApsCachedToken } from "./types";

interface ApsTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
}

export class ApsAuthService {
  private inMemoryToken: ApsCachedToken | null = null;

  constructor(
    private readonly env: Env,
    private readonly tokenCache: ApsTokenCache,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.env.APS_CLIENT_ID && this.env.APS_CLIENT_SECRET);
  }

  async getAccessToken(): Promise<string> {
    this.requireConfigured();

    if (this.isUsable(this.inMemoryToken)) {
      return this.inMemoryToken.accessToken;
    }

    const cachedToken = await this.tokenCache.read();

    if (this.isUsable(cachedToken)) {
      this.inMemoryToken = cachedToken;
      return cachedToken.accessToken;
    }

    const token = await this.requestToken();
    this.inMemoryToken = token;
    await this.tokenCache.write(token);
    return token.accessToken;
  }

  private async requestToken(): Promise<ApsCachedToken> {
    const response = await this.fetchImpl(this.resolveUrl("/authentication/v2/token"), {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.env.APS_CLIENT_ID ?? "",
        client_secret: this.env.APS_CLIENT_SECRET ?? "",
        scope: this.env.APS_SCOPES,
      }),
    });

    const payload = await this.parseJson(response);

    if (!response.ok) {
      throw new AppError(
        502,
        "aps_auth_failed",
        this.extractMessage(payload) ?? "APS authentication failed.",
      );
    }

    const tokenPayload = payload as ApsTokenResponse;

    if (!tokenPayload.access_token) {
      throw new AppError(502, "aps_auth_failed", "APS did not return an access token.");
    }

    return {
      accessToken: tokenPayload.access_token,
      tokenType: tokenPayload.token_type ?? "Bearer",
      expiresAtMs: Date.now() + (tokenPayload.expires_in ?? 3600) * 1000,
      scope: tokenPayload.scope ?? this.env.APS_SCOPES,
      accountContext: this.env.APS_ACCOUNT_ID ?? null,
      userContext: this.env.APS_USER_ID ?? null,
    };
  }

  private requireConfigured(): void {
    if (!this.isConfigured()) {
      throw new AppError(
        503,
        "aps_not_configured",
        "APS discovery is not configured. Set APS_CLIENT_ID and APS_CLIENT_SECRET first.",
      );
    }
  }

  private isUsable(token: ApsCachedToken | null): token is ApsCachedToken {
    return Boolean(token && token.expiresAtMs > Date.now() + 60_000);
  }

  private resolveUrl(inputPath: string): string {
    return new URL(
      inputPath,
      this.env.APS_BASE_URL.endsWith("/") ? this.env.APS_BASE_URL : `${this.env.APS_BASE_URL}/`,
    ).toString();
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
}
