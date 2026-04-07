import type { FastifyInstance } from "fastify";

import { AppError, normalizeError } from "../../lib/errors";
import { ChatService } from "../../services/chat-service";

interface ConversationsRouteDeps {
  chatService: ChatService;
}

export async function registerConversationsRoutes(
  app: FastifyInstance,
  deps: ConversationsRouteDeps,
): Promise<void> {
  app.get("/api/conversations", async (_request, reply) =>
    reply.status(200).send({
      conversations: deps.chatService.listConversations(),
    }),
  );

  app.get("/api/conversations/:id/messages", async (request, reply) => {
    const params = request.params as { id?: string };
    const conversationId = params.id ?? "";

    try {
      const conversation = deps.chatService.getConversation(conversationId);

      if (!conversation) {
        throw new AppError(404, "conversation_not_found", `Conversation '${conversationId}' was not found.`, {
          conversationId,
        });
      }

      return reply.status(200).send({
        conversation,
        messages: deps.chatService.listConversationMessages(conversationId),
      });
    } catch (error) {
      const normalized = normalizeError(error);
      return reply.status(normalized.statusCode).send({
        conversation: null,
        messages: [],
        error: {
          code: normalized.code,
          message: normalized.message,
          details: normalized.details,
        },
      });
    }
  });
}
