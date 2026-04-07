import type Database from "better-sqlite3";

import type { ConversationRecord } from "../../types";

interface ConversationRow {
  id: string;
  title: string | null;
  user_id: string | null;
  target_host: string | null;
  created_at: string;
  updated_at: string;
}

function toConversationRecord(row: ConversationRow): ConversationRecord {
  return {
    id: row.id,
    title: row.title,
    userId: row.user_id,
    targetHost: row.target_host,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ConversationsRepository {
  constructor(private readonly db: Database.Database) {}

  list(): ConversationRecord[] {
    const rows = this.db
      .prepare(
        `
          SELECT id, title, user_id, target_host, created_at, updated_at
          FROM conversations
          ORDER BY updated_at DESC, created_at DESC
        `,
      )
      .all() as ConversationRow[];

    return rows.map(toConversationRecord);
  }

  getById(id: string): ConversationRecord | null {
    const row = this.db
      .prepare(
        `
          SELECT id, title, user_id, target_host, created_at, updated_at
          FROM conversations
          WHERE id = ?
        `,
      )
      .get(id) as ConversationRow | undefined;

    return row ? toConversationRecord(row) : null;
  }
}
