import fs from "node:fs";
import path from "node:path";

import type Database from "better-sqlite3";

export function migrateDatabase(db: Database.Database): void {
  const schemaPath = path.join(__dirname, "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  db.exec(schemaSql);
}
