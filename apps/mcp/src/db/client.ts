import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import type { Env } from "../config/env";
import { migrateDatabase } from "./migrate";

export class DbClient {
  readonly db: Database.Database;

  constructor(private readonly filePath: string) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    this.db = new Database(filePath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.pragma("busy_timeout = 5000");
  }

  init(): void {
    migrateDatabase(this.db);
  }

  close(): void {
    this.db.close();
  }
}

export function createDbClient(env: Env): DbClient {
  const client = new DbClient(env.SQLITE_DB_PATH);
  client.init();
  return client;
}
