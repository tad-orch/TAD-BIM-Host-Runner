import { AppError, toErrorSummary } from "../lib/errors";
import { createConversationId, createMessageId } from "../lib/ids";
import { ConversationsRepository } from "../db/repositories/conversations-repo";
import { JobsRepository } from "../db/repositories/jobs-repo";
import { MessagesRepository } from "../db/repositories/messages-repo";
import type { McpToolName } from "../mcp/types";
import type { ConversationRecord, MessageRecord, StoredJobRecord } from "../types";
import { McpService } from "./mcp-service";

const DEFAULT_TARGET_HOST = "tad-bim-01";

interface ChatRequestInput {
  message: string;
  conversationId?: string;
  targetHost?: string;
}

interface ChatResponsePayload {
  conversation: ConversationRecord;
  messages: MessageRecord[];
  job: StoredJobRecord | null;
  tool: McpToolName | null;
}

interface ChatRoutingDecision {
  tool: McpToolName | null;
  payload?: Record<string, unknown>;
  unsupportedReason?: string;
}

export class ChatService {
  constructor(
    private readonly conversationsRepository: ConversationsRepository,
    private readonly messagesRepository: MessagesRepository,
    private readonly jobsRepository: JobsRepository,
    private readonly mcpService: McpService,
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

  async sendMessage(input: ChatRequestInput): Promise<ChatResponsePayload> {
    const message = input.message.trim();

    if (message.length === 0) {
      throw new AppError(400, "invalid_payload", "Message is required.");
    }

    const existingConversation = input.conversationId
      ? this.conversationsRepository.getById(input.conversationId)
      : null;

    if (input.conversationId && !existingConversation) {
      throw new AppError(404, "conversation_not_found", `Conversation '${input.conversationId}' was not found.`, {
        conversationId: input.conversationId,
      });
    }

    const resolvedTargetHost = input.targetHost ?? existingConversation?.targetHost ?? DEFAULT_TARGET_HOST;
    const now = new Date().toISOString();
    let conversation =
      existingConversation ??
      this.conversationsRepository.create({
        id: createConversationId(),
        title: this.buildConversationTitle(message),
        userId: null,
        targetHost: resolvedTargetHost,
        createdAt: now,
        updatedAt: now,
      });

    const userMessage = this.messagesRepository.create({
      id: createMessageId(),
      conversationId: conversation.id,
      role: "user",
      content: message,
      createdAt: now,
    });

    const decision = this.routeMessage(message, resolvedTargetHost);
    let assistantText = "";
    let job: StoredJobRecord | null = null;
    let tool: McpToolName | null = decision.tool;

    if (!decision.tool || !decision.payload) {
      assistantText =
        decision.unsupportedReason ??
        "This request is not supported in the current phase. I can currently check Revit health or create a straight wall with a numeric length.";
    } else {
      try {
        const response = await this.mcpService.executeTool(decision.tool, decision.payload);

        if (response.jobId) {
          job = this.jobsRepository.getStoredJob(response.jobId);
        }

        assistantText = this.buildAssistantSuccessMessage(decision.tool, response, job);
      } catch (error) {
        assistantText = this.buildAssistantErrorMessage(error, decision.tool, resolvedTargetHost);
      }
    }

    const assistantMessage = this.messagesRepository.create({
      id: createMessageId(),
      conversationId: conversation.id,
      role: "assistant",
      content: assistantText,
      toolName: tool,
      jobId: job?.jobId ?? null,
      createdAt: new Date().toISOString(),
    });

    conversation =
      this.conversationsRepository.update(conversation.id, {
        targetHost: resolvedTargetHost,
        updatedAt: assistantMessage.createdAt,
      }) ?? conversation;

    return {
      conversation,
      messages: this.messagesRepository.listByConversationId(conversation.id),
      job,
      tool,
    };
  }

  private buildConversationTitle(message: string): string {
    return message.replace(/\s+/g, " ").trim().slice(0, 80) || "New conversation";
  }

  private routeMessage(message: string, targetHost: string): ChatRoutingDecision {
    if (this.isHealthIntent(message)) {
      return {
        tool: "mcp-arch-system-health",
        payload: {
          targetHost,
        },
      };
    }

    if (this.isWallIntent(message)) {
      const length = this.extractWallLength(message);

      if (length === null) {
        return {
          tool: null,
          unsupportedReason:
            "Wall creation currently requires a numeric length. Try something like 'Create a 15 meter wall on Level 1'.",
        };
      }

      return {
        tool: "mcp-arch-walls-create",
        payload: {
          targetHost,
          length,
          wallType: this.extractWallType(message) ?? "first_available_generic",
          level: this.extractLevel(message) ?? "Level 1",
          height: this.extractHeight(message) ?? 3,
        },
      };
    }

    return {
      tool: null,
      unsupportedReason:
        "This request is unsupported in the current phase. I can currently check Revit health or create a straight wall with a numeric length.",
    };
  }

  private isHealthIntent(message: string): boolean {
    const normalized = message.toLowerCase();
    const mentionsEnvironment =
      normalized.includes("revit") || normalized.includes("host") || normalized.includes("bridge");
    const mentionsHealth =
      normalized.includes("health") ||
      normalized.includes("availability") ||
      normalized.includes("available") ||
      normalized.includes("reachable") ||
      normalized.includes("running") ||
      normalized.includes("status") ||
      normalized.includes("ping");

    return mentionsEnvironment && mentionsHealth;
  }

  private isWallIntent(message: string): boolean {
    const normalized = message.toLowerCase();
    const mentionsWall = normalized.includes("wall") || normalized.includes("muro");
    const mentionsCreate =
      normalized.includes("create") ||
      normalized.includes("draw") ||
      normalized.includes("model") ||
      normalized.includes("make") ||
      normalized.includes("build") ||
      normalized.includes("add");

    return mentionsWall && mentionsCreate;
  }

  private extractWallLength(message: string): number | null {
    const patterns = [
      /(\d+(?:\.\d+)?)\s*(?:m|meter|meters|metre|metres)\s+(?:wall|muro)\b/i,
      /(?:wall|muro)[^0-9]{0,30}(\d+(?:\.\d+)?)\s*(?:m|meter|meters|metre|metres)\b/i,
      /(?:length|longitud)\s*(?:of|de)?\s*(\d+(?:\.\d+)?)/i,
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);

      if (match) {
        return Number.parseFloat(match[1]);
      }
    }

    return null;
  }

  private extractWallType(message: string): string | null {
    const quotedMatch = message.match(/["']([^"']+)["']/);

    if (quotedMatch) {
      return quotedMatch[1].trim();
    }

    const knownTypeMatch = message.match(/\b(Generic\s*-\s*\d+\s*mm)\b/i);

    if (knownTypeMatch) {
      return knownTypeMatch[1].trim();
    }

    return null;
  }

  private extractLevel(message: string): string | null {
    const match = message.match(/\b(Level\s+[A-Za-z0-9._-]+)\b/i);

    if (!match) {
      return null;
    }

    return match[1]
      .replace(/\s+/g, " ")
      .replace(/^level/i, "Level")
      .trim();
  }

  private extractHeight(message: string): number | null {
    const match = message.match(/\b(?:height|altura)\s*(?:of|de)?\s*(\d+(?:\.\d+)?)\b/i);

    return match ? Number.parseFloat(match[1]) : null;
  }

  private buildAssistantSuccessMessage(
    tool: McpToolName,
    response: Awaited<ReturnType<McpService["executeTool"]>>,
    job: StoredJobRecord | null,
  ): string {
    if (tool === "mcp-arch-system-health") {
      return `Revit connectivity check completed for host '${response.targetHost}'.`;
    }

    if (response.status === "accepted" || response.status === "running") {
      return `Wall creation was submitted on host '${response.targetHost}'. Track local job '${response.jobId}'.`;
    }

    if (response.status === "completed") {
      return `Wall creation completed on host '${response.targetHost}'.`;
    }

    if (response.status === "failed" || response.status === "timeout") {
      return `Wall creation did not complete successfully: ${response.error?.message ?? response.status}.`;
    }

    return job
      ? `Wall creation status for job '${job.jobId}' is '${job.status}'.`
      : `Wall creation returned status '${response.status}'.`;
  }

  private buildAssistantErrorMessage(error: unknown, tool: McpToolName, targetHost: string): string {
    const summary = toErrorSummary(error);

    if (tool === "mcp-arch-system-health") {
      return `I could not check Revit health on host '${targetHost}': ${summary.message}`;
    }

    return `I could not submit wall creation on host '${targetHost}': ${summary.message}`;
  }
}
