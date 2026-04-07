import type Database from "better-sqlite3";

import { hostDefinitionSchema } from "../../schemas/envelope";
import type { HostDefinition, StoredHostRecord } from "../../types";

interface HostRow {
  id: string;
  base_url: string;
  machine_type: string;
  capabilities_json: string;
  enabled_tools_json: string;
  headers_json: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }

  return JSON.parse(value) as T;
}

function toStoredHostRecord(row: HostRow): StoredHostRecord {
  const host = hostDefinitionSchema.parse({
    id: row.id,
    baseUrl: row.base_url,
    machineType: row.machine_type,
    capabilities: parseJson<string[]>(row.capabilities_json, []),
    enabledTools: parseJson<HostDefinition["enabledTools"]>(row.enabled_tools_json, []),
    headers: parseJson<Record<string, string> | undefined>(row.headers_json, undefined),
  });

  return {
    ...host,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class HostsRepository {
  constructor(private readonly db: Database.Database) {}

  countAll(): number {
    const row = this.db.prepare("SELECT COUNT(*) AS count FROM hosts").get() as { count: number };
    return row.count;
  }

  list(options: { activeOnly?: boolean } = {}): StoredHostRecord[] {
    const rows = options.activeOnly
      ? (this.db
          .prepare(
            `
              SELECT id, base_url, machine_type, capabilities_json, enabled_tools_json, headers_json,
                     is_active, created_at, updated_at
              FROM hosts
              WHERE is_active = 1
              ORDER BY id
            `,
          )
          .all() as HostRow[])
      : (this.db
          .prepare(
            `
              SELECT id, base_url, machine_type, capabilities_json, enabled_tools_json, headers_json,
                     is_active, created_at, updated_at
              FROM hosts
              ORDER BY id
            `,
          )
          .all() as HostRow[]);

    return rows.map(toStoredHostRecord);
  }

  upsertMany(hosts: HostDefinition[]): void {
    if (hosts.length === 0) {
      return;
    }

    const now = new Date().toISOString();
    const statement = this.db.prepare(
      `
        INSERT INTO hosts (
          id, base_url, machine_type, capabilities_json, enabled_tools_json,
          headers_json, is_active, created_at, updated_at
        )
        VALUES (
          @id, @base_url, @machine_type, @capabilities_json, @enabled_tools_json,
          @headers_json, 1, @created_at, @updated_at
        )
        ON CONFLICT(id) DO UPDATE SET
          base_url = excluded.base_url,
          machine_type = excluded.machine_type,
          capabilities_json = excluded.capabilities_json,
          enabled_tools_json = excluded.enabled_tools_json,
          headers_json = excluded.headers_json,
          is_active = excluded.is_active,
          updated_at = excluded.updated_at
      `,
    );

    const transaction = this.db.transaction((items: HostDefinition[]) => {
      for (const host of items) {
        statement.run({
          id: host.id,
          base_url: host.baseUrl,
          machine_type: host.machineType,
          capabilities_json: JSON.stringify(host.capabilities),
          enabled_tools_json: JSON.stringify(host.enabledTools),
          headers_json: host.headers ? JSON.stringify(host.headers) : null,
          created_at: now,
          updated_at: now,
        });
      }
    });

    transaction(hosts);
  }
}
