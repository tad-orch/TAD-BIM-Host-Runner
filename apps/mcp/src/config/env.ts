import path from "node:path";

import { z } from "zod";

const envSchema = z.object({
  HOST: z.string().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(8080),
  DATA_DIR: z.string().min(1).default(path.resolve(process.cwd(), "data")),
  SQLITE_DB_PATH: z.string().min(1).optional(),
  HOSTS_JSON: z.string().optional(),
  BRIDGE_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  POLL_INTERVAL_MS: z.coerce.number().int().positive().default(2_000),
  POLL_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  APS_BASE_URL: z.string().url().default("https://developer.api.autodesk.com"),
  APS_CLIENT_ID: z.string().min(1).optional(),
  APS_CLIENT_SECRET: z.string().min(1).optional(),
  APS_SCOPES: z.string().min(1).default("data:read"),
  APS_ACCOUNT_ID: z.string().min(1).optional(),
  APS_USER_ID: z.string().min(1).optional(),
  APS_TOKEN_STORAGE_PATH: z.string().min(1).optional(),
  APS_CALLBACK_URL: z.string().url().optional(),
  OLLAMA_BASE_URL: z.string().url().default("http://127.0.0.1:11434"),
  OLLAMA_MODEL: z.string().min(1).default("qwen3:14b"),
});

export type Env = z.infer<typeof envSchema> & {
  SQLITE_DB_PATH: string;
  APS_TOKEN_STORAGE_PATH: string;
};

export function loadEnv(overrides: Partial<NodeJS.ProcessEnv> = {}): Env {
  const parsed = envSchema.parse({
    ...process.env,
    ...overrides,
  });

  const dataDir = path.resolve(parsed.DATA_DIR);
  const sqliteDbPath = path.resolve(parsed.SQLITE_DB_PATH ?? path.join(dataDir, "app.db"));
  const apsTokenStoragePath = path.resolve(parsed.APS_TOKEN_STORAGE_PATH ?? path.join(dataDir, "auth", "aps-token.json"));

  return {
    ...parsed,
    DATA_DIR: dataDir,
    SQLITE_DB_PATH: sqliteDbPath,
    APS_TOKEN_STORAGE_PATH: apsTokenStoragePath,
  };
}
