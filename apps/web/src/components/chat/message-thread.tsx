import { useEffect, useRef } from "react";

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
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = scrollRef.current;

    if (!node) {
      return;
    }

    node.scrollTop = node.scrollHeight;
  }, [messages.length]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Message history</p>
          <p className="text-xs text-muted-foreground">Target host: {selectedHost || "Not selected"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{messages.length} messages</Badge>
          {pending ? <Badge variant="warning">Sending...</Badge> : null}
        </div>
      </div>

      <ScrollArea ref={scrollRef} className="min-h-0 flex-1 pr-1">
        <div className="space-y-3 pb-2">
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
                <div key={message.id} className={cn("flex", isAssistant ? "justify-start" : "justify-end")}>
                  <div
                    className={cn(
                      "max-w-[92%] rounded-2xl border px-4 py-3 shadow-sm sm:max-w-[85%]",
                      isAssistant
                        ? "border-primary/25 bg-primary/5"
                        : "border-border/80 bg-background/85",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={isAssistant ? "default" : "outline"}>{isAssistant ? "Assistant" : "User"}</Badge>
                      <span className="text-[11px] text-muted-foreground">{formatDateTime(message.createdAt)}</span>
                    </div>

                    {message.toolName || message.jobId ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {message.toolName ? (
                          <Badge variant="secondary" className="text-[11px]">
                            Tool: {message.toolName}
                          </Badge>
                        ) : null}
                        {message.jobId ? (
                          <Badge variant="outline" className="max-w-full break-all font-mono text-[11px]">
                            Job: {message.jobId}
                          </Badge>
                        ) : null}
                      </div>
                    ) : null}

                    <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{message.content}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
