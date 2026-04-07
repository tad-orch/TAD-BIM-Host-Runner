import type Database from "better-sqlite3";

import type { MessageRecord } from "../../types";

interface MessageRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  tool_name: string | null;
  job_id: string | null;
  created_at: string;
}

function toMessageRecord(row: MessageRow): MessageRecord {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    toolName: row.tool_name,
    jobId: row.job_id,
    createdAt: row.created_at,
  };
}

export class MessagesRepository {
  constructor(private readonly db: Database.Database) {}

  listByConversationId(conversationId: string): MessageRecord[] {
    const rows = this.db
      .prepare(
        `
          SELECT id, conversation_id, role, content, tool_name, job_id, created_at
          FROM messages
          WHERE conversation_id = ?
          ORDER BY created_at ASC
        `,
      )
      .all(conversationId) as MessageRow[];

    return rows.map(toMessageRecord);
  }
}
