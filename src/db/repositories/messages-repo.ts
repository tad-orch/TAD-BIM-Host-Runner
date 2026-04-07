import type Database from "better-sqlite3";

import type { MessageCreateInput, MessageRecord } from "../../types";

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

  create(input: MessageCreateInput): MessageRecord {
    this.db
      .prepare(
        `
          INSERT INTO messages (id, conversation_id, role, content, tool_name, job_id, created_at)
          VALUES (@id, @conversation_id, @role, @content, @tool_name, @job_id, @created_at)
        `,
      )
      .run({
        id: input.id,
        conversation_id: input.conversationId,
        role: input.role,
        content: input.content,
        tool_name: input.toolName ?? null,
        job_id: input.jobId ?? null,
        created_at: input.createdAt,
      });

    const row = this.db
      .prepare(
        `
          SELECT id, conversation_id, role, content, tool_name, job_id, created_at
          FROM messages
          WHERE id = ?
        `,
      )
      .get(input.id) as MessageRow | undefined;

    if (!row) {
      throw new Error(`Message '${input.id}' was not created.`);
    }

    return toMessageRecord(row);
  }
}
