import { ConversationsRepository } from "../db/repositories/conversations-repo";
import { MessagesRepository } from "../db/repositories/messages-repo";
import type { ConversationRecord, MessageRecord } from "../types";

export class ChatService {
  constructor(
    private readonly conversationsRepository: ConversationsRepository,
    private readonly messagesRepository: MessagesRepository,
  ) {}

  listConversations(): ConversationRecord[] {
    return this.conversationsRepository.list();
  }

  getConversation(id: string): ConversationRecord | null {
    return this.conversationsRepository.getById(id);
  }

  listConversationMessages(conversationId: string): MessageRecord[] {
    return this.messagesRepository.listByConversationId(conversationId);
  }
}
