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
  OLLAMA_BASE_URL: z.string().url().default("http://127.0.0.1:11434"),
  OLLAMA_MODEL: z.string().min(1).default("qwen3:14b"),
});

export type Env = z.infer<typeof envSchema> & {
  SQLITE_DB_PATH: string;
};

export function loadEnv(overrides: Partial<NodeJS.ProcessEnv> = {}): Env {
  const parsed = envSchema.parse({
    ...process.env,
    ...overrides,
  });

  const dataDir = path.resolve(parsed.DATA_DIR);
  const sqliteDbPath = path.resolve(parsed.SQLITE_DB_PATH ?? path.join(dataDir, "app.db"));

  return {
    ...parsed,
    DATA_DIR: dataDir,
    SQLITE_DB_PATH: sqliteDbPath,
  };
}
