export type JobStatus = "accepted" | "running" | "completed" | "failed" | "timeout";

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface HostRecord {
  id: string;
  baseUrl: string;
  machineType: string;
  capabilities: string[];
  enabledTools: string[];
  headers?: Record<string, string>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationRecord {
  id: string;
  title: string | null;
  userId: string | null;
  targetHost: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  toolName: string | null;
  jobId: string | null;
  createdAt: string;
}

export interface StoredJobRecord {
  jobId: string;
  requestId: string;
  remoteJobId: string | null;
  pollPath: string | null;
  tool: string;
  internalTool: string | null;
  targetHost: string;
  mode: "sync" | "async";
  status: JobStatus;
  source: string | null;
  sessionId: string | null;
  args: Record<string, unknown>;
  result: unknown | null;
  error: ApiErrorPayload | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  durationMs: number | null;
}

export interface ConversationMessagesResponse {
  conversation: ConversationRecord;
  messages: MessageRecord[];
  error?: ApiErrorPayload;
}

export interface JobsResponse {
  jobs: StoredJobRecord[];
  error?: ApiErrorPayload;
}

export interface ChatRequest {
  message: string;
  conversationId?: string;
  targetHost?: string;
}

export interface ChatResponse {
  conversation: ConversationRecord;
  messages: MessageRecord[];
  job: StoredJobRecord | null;
  tool: string | null;
  error?: ApiErrorPayload;
}
