import type {
  ChatRequest,
  ChatResponse,
  ConversationMessagesResponse,
  ConversationRecord,
  HostRecord,
  JobsResponse,
  StoredJobRecord,
} from "@/types/api";

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  return JSON.parse(text) as unknown;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    const errorPayload =
      payload && typeof payload === "object" && "error" in payload
        ? (payload.error as
            | {
                code?: string;
                message?: string;
                details?: Record<string, unknown>;
              }
            | null)
        : null;

    throw new ApiRequestError(
      errorPayload?.message ?? `Request failed with status ${response.status}.`,
      response.status,
      errorPayload?.code,
      errorPayload?.details,
    );
  }

  return payload as T;
}

export function getHosts(): Promise<HostRecord[]> {
  return request<{ hosts: HostRecord[] }>("/api/hosts").then((response) => response.hosts);
}

export function getConversations(): Promise<ConversationRecord[]> {
  return request<{ conversations: ConversationRecord[] }>("/api/conversations").then(
    (response) => response.conversations,
  );
}

export function getConversationMessages(conversationId: string): Promise<ConversationMessagesResponse> {
  return request<ConversationMessagesResponse>(`/api/conversations/${conversationId}/messages`);
}

export function sendChatMessage(input: ChatRequest): Promise<ChatResponse> {
  return request<ChatResponse>("/api/chat", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getJobs(filters: {
  status?: string;
  targetHost?: string;
  tool?: string;
} = {}): Promise<StoredJobRecord[]> {
  const searchParams = new URLSearchParams();

  if (filters.status) {
    searchParams.set("status", filters.status);
  }

  if (filters.targetHost) {
    searchParams.set("targetHost", filters.targetHost);
  }

  if (filters.tool) {
    searchParams.set("tool", filters.tool);
  }

  const query = searchParams.toString();

  return request<JobsResponse>(query ? `/api/jobs?${query}` : "/api/jobs").then((response) => response.jobs);
}

export function getJobById(jobId: string): Promise<StoredJobRecord> {
  return request<StoredJobRecord>(`/api/jobs/${jobId}`);
}
