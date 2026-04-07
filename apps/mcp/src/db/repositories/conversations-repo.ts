import type Database from "better-sqlite3";

import type { ConversationCreateInput, ConversationRecord, ConversationUpdateInput } from "../../types";

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

  create(input: ConversationCreateInput): ConversationRecord {
    this.db
      .prepare(
        `
          INSERT INTO conversations (id, title, user_id, target_host, created_at, updated_at)
          VALUES (@id, @title, @user_id, @target_host, @created_at, @updated_at)
        `,
      )
      .run({
        id: input.id,
        title: input.title,
        user_id: input.userId,
        target_host: input.targetHost,
        created_at: input.createdAt,
        updated_at: input.updatedAt,
      });

    const record = this.getById(input.id);

    if (!record) {
      throw new Error(`Conversation '${input.id}' was not created.`);
    }

    return record;
  }

  update(id: string, input: ConversationUpdateInput): ConversationRecord | null {
    const current = this.getById(id);

    if (!current) {
      return null;
    }

    this.db
      .prepare(
        `
          UPDATE conversations
          SET
            title = @title,
            target_host = @target_host,
            updated_at = @updated_at
          WHERE id = @id
        `,
      )
      .run({
        id,
        title: input.title === undefined ? current.title : input.title,
        target_host: input.targetHost === undefined ? current.targetHost : input.targetHost,
        updated_at: input.updatedAt,
      });

    return this.getById(id);
  }
}
