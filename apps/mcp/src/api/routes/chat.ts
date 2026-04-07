import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { normalizeError } from "../../lib/errors";
import { ChatService } from "../../services/chat-service";

const chatRequestSchema = z
  .object({
    message: z.string().min(1).max(4000),
    conversationId: z.string().min(1).max(255).optional(),
    targetHost: z.string().min(1).max(255).optional(),
  })
  .strict();

interface ChatRouteDeps {
  chatService: ChatService;
}

export async function registerChatRoute(app: FastifyInstance, deps: ChatRouteDeps): Promise<void> {
  app.post("/api/chat", async (request, reply) => {
    try {
      const parsed = chatRequestSchema.parse(request.body);
      const response = await deps.chatService.sendMessage(parsed);
      return reply.status(200).send(response);
    } catch (error) {
      const normalized = normalizeError(error);
      return reply.status(normalized.statusCode).send({
        conversation: null,
        messages: [],
        job: null,
        tool: null,
        error: {
          code: normalized.code,
          message: normalized.message,
          details: normalized.details,
        },
      });
    }
  });
}
