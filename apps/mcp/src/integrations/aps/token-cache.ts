import fs from "node:fs/promises";
import path from "node:path";

import type { Env } from "../../config/env";
import type { ApsCachedToken } from "./types";

export class ApsTokenCache {
  constructor(private readonly env: Env) {}

  async read(): Promise<ApsCachedToken | null> {
    try {
      const raw = await fs.readFile(this.env.APS_TOKEN_STORAGE_PATH, "utf8");
      const parsed = JSON.parse(raw) as Partial<ApsCachedToken>;

      if (
        typeof parsed.accessToken !== "string" ||
        typeof parsed.tokenType !== "string" ||
        typeof parsed.expiresAtMs !== "number" ||
        typeof parsed.scope !== "string"
      ) {
        return null;
      }

      return {
        accessToken: parsed.accessToken,
        tokenType: parsed.tokenType,
        expiresAtMs: parsed.expiresAtMs,
        scope: parsed.scope,
        accountContext: typeof parsed.accountContext === "string" ? parsed.accountContext : null,
        userContext: typeof parsed.userContext === "string" ? parsed.userContext : null,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }

      return null;
    }
  }

  async write(token: ApsCachedToken): Promise<void> {
    await fs.mkdir(path.dirname(this.env.APS_TOKEN_STORAGE_PATH), { recursive: true });
    await fs.writeFile(this.env.APS_TOKEN_STORAGE_PATH, JSON.stringify(token, null, 2), "utf8");
  }
}
