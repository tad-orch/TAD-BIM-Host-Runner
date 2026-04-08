import type { ConversationRecord } from "@/types/api";
import { compactText, cn, formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ConversationListProps {
  conversations: ConversationRecord[];
  selectedConversationId: string | null;
  onSelect: (conversation: ConversationRecord) => void;
  onNewConversation: () => void;
  isLoading?: boolean;
}

export function ConversationList({
  conversations,
  selectedConversationId,
  onSelect,
  onNewConversation,
  isLoading = false,
}: ConversationListProps) {
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Conversations</p>
          <p className="text-xs text-muted-foreground">Latest activity first.</p>
        </div>
        <Button variant="outline" size="sm" onClick={onNewConversation}>
          New chat
        </Button>
      </div>

      <ScrollArea className="max-h-[28rem] pr-2">
        <div className="space-y-2">
          {isLoading ? (
            <div className="rounded-xl border border-dashed border-border bg-background/70 px-4 py-6 text-sm text-muted-foreground">
              Loading conversations...
            </div>
          ) : conversations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-background/70 px-4 py-6 text-sm text-muted-foreground">
              No conversations yet. Start from the composer or use a quick action.
            </div>
          ) : (
            conversations.map((conversation) => {
              const isSelected = conversation.id === selectedConversationId;

              return (
                <button
                  key={conversation.id}
                  type="button"
                  className={cn(
                    "w-full rounded-2xl border px-4 py-3 text-left transition-colors",
                    isSelected
                      ? "border-primary/40 bg-primary/8"
                      : "border-border/80 bg-background/70 hover:bg-secondary/40",
                  )}
                  onClick={() => onSelect(conversation)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{compactText(conversation.title, "Untitled conversation")}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(conversation.updatedAt)}</p>
                    </div>
                    {conversation.targetHost ? <Badge variant="secondary">{conversation.targetHost}</Badge> : null}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
