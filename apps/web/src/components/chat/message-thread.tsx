import type { MessageRecord } from "@/types/api";
import { cn, formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MessageThreadProps {
  messages: MessageRecord[];
  selectedHost: string;
  isLoading?: boolean;
  pending?: boolean;
}

export function MessageThread({
  messages,
  selectedHost,
  isLoading = false,
  pending = false,
}: MessageThreadProps) {
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Message history</p>
          <p className="text-xs text-muted-foreground">Target host: {selectedHost || "Not selected"}</p>
        </div>
        {pending ? <Badge variant="warning">Sending...</Badge> : null}
      </div>

      <ScrollArea className="max-h-[34rem] pr-2">
        <div className="space-y-4">
          {isLoading ? (
            <div className="rounded-xl border border-dashed border-border bg-background/70 px-4 py-6 text-sm text-muted-foreground">
              Loading messages...
            </div>
          ) : messages.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-background/70 px-4 py-6 text-sm text-muted-foreground">
              Select a conversation or send a message to start a new thread.
            </div>
          ) : (
            messages.map((message) => {
              const isAssistant = message.role === "assistant";

              return (
                <div
                  key={message.id}
                  className={cn(
                    "rounded-2xl border px-4 py-3",
                    isAssistant
                      ? "border-primary/25 bg-primary/5"
                      : "border-border/80 bg-background/70",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={isAssistant ? "default" : "outline"}>{isAssistant ? "Assistant" : "User"}</Badge>
                    <span className="text-xs text-muted-foreground">{formatDateTime(message.createdAt)}</span>
                    {message.toolName ? <Badge variant="secondary">Tool: {message.toolName}</Badge> : null}
                    {message.jobId ? <Badge variant="outline">Job: {message.jobId}</Badge> : null}
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
