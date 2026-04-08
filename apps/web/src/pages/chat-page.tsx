import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getConversationMessages, getConversations, getHosts, sendChatMessage } from "@/lib/api";
import { compactText, formatDateTime } from "@/lib/utils";
import type { ConversationRecord } from "@/types/api";
import { ConversationList } from "@/components/chat/conversation-list";
import { MessageThread } from "@/components/chat/message-thread";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const HEALTH_PROMPT = "Please check Revit health on the host.";
const DEMO_WALL_PROMPT = "Create a 10 meter wall in Revit using Generic - 200mm on Level 1 with height 3";

export function ChatPage() {
  const queryClient = useQueryClient();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedHost, setSelectedHost] = useState("");
  const [draft, setDraft] = useState("");
  const [isNewConversation, setIsNewConversation] = useState(false);

  const hostsQuery = useQuery({
    queryKey: ["hosts"],
    queryFn: getHosts,
  });
  const conversationsQuery = useQuery({
    queryKey: ["conversations"],
    queryFn: getConversations,
  });
  const messagesQuery = useQuery({
    queryKey: ["conversationMessages", selectedConversationId],
    queryFn: () => getConversationMessages(selectedConversationId!),
    enabled: Boolean(selectedConversationId),
  });

  useEffect(() => {
    if (!selectedHost && hostsQuery.data && hostsQuery.data.length > 0) {
      setSelectedHost(hostsQuery.data[0].id);
    }
  }, [hostsQuery.data, selectedHost]);

  useEffect(() => {
    if (!selectedConversationId && !isNewConversation && conversationsQuery.data && conversationsQuery.data.length > 0) {
      setSelectedConversationId(conversationsQuery.data[0].id);
    }
  }, [conversationsQuery.data, isNewConversation, selectedConversationId]);

  useEffect(() => {
    if (messagesQuery.data?.conversation.targetHost) {
      setSelectedHost(messagesQuery.data.conversation.targetHost);
    }
  }, [messagesQuery.data?.conversation.targetHost]);

  const sendMutation = useMutation({
    mutationFn: sendChatMessage,
    onSuccess: async (response) => {
      setSelectedConversationId(response.conversation.id);
      setIsNewConversation(false);
      setSelectedHost(response.conversation.targetHost ?? selectedHost);
      setDraft("");
      queryClient.setQueryData(["conversationMessages", response.conversation.id], {
        conversation: response.conversation,
        messages: response.messages,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["conversations"] }),
        queryClient.invalidateQueries({ queryKey: ["jobs"] }),
      ]);
    },
  });

  const hosts = hostsQuery.data ?? [];
  const conversations = conversationsQuery.data ?? [];
  const messages = messagesQuery.data?.messages ?? [];

  const activeConversation = useMemo(() => {
    if (!selectedConversationId) {
      return null;
    }

    return (
      messagesQuery.data?.conversation ??
      conversations.find((conversation) => conversation.id === selectedConversationId) ??
      null
    );
  }, [conversations, messagesQuery.data?.conversation, selectedConversationId]);

  const selectedHostRecord = useMemo(
    () => hosts.find((host) => host.id === selectedHost) ?? null,
    [hosts, selectedHost],
  );

  const composerDisabled = sendMutation.isPending || hosts.length === 0;

  function handleSelectConversation(conversation: ConversationRecord) {
    setSelectedConversationId(conversation.id);
    setIsNewConversation(false);
    if (conversation.targetHost) {
      setSelectedHost(conversation.targetHost);
    }
  }

  function handleNewConversation() {
    setSelectedConversationId(null);
    setIsNewConversation(true);
  }

  function submitMessage(message: string) {
    const trimmedMessage = message.trim();

    if (!trimmedMessage || sendMutation.isPending) {
      return;
    }

    sendMutation.mutate({
      message: trimmedMessage,
      conversationId: selectedConversationId ?? undefined,
      targetHost: selectedHost || undefined,
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chat"
        description="Use the existing deterministic /api/chat route to inspect a host or create a wall request."
        actions={
          <>
            <Badge variant="secondary">Selected host: {selectedHost || "None"}</Badge>
            {activeConversation ? <Badge variant="outline">{compactText(activeConversation.title, "Untitled")}</Badge> : null}
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Recent conversations</CardTitle>
            <CardDescription>Persisted threads from the SQLite-backed backend.</CardDescription>
          </CardHeader>
          <CardContent>
            <ConversationList
              conversations={conversations}
              selectedConversationId={selectedConversationId}
              onSelect={handleSelectConversation}
              onNewConversation={handleNewConversation}
              isLoading={conversationsQuery.isLoading}
            />
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Current context</CardTitle>
              <CardDescription>Keep the active host and thread visible while you chat.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-border/80 bg-background/70 p-4">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">Target host</p>
                  {selectedHostRecord ? (
                    <Badge variant={selectedHostRecord.isActive ? "success" : "outline"}>
                      {selectedHostRecord.isActive ? "Active" : "Inactive"}
                    </Badge>
                  ) : null}
                </div>
                {selectedHostRecord ? (
                  <div className="mt-3 space-y-2">
                    <p className="font-medium">{selectedHostRecord.id}</p>
                    <p className="text-sm text-muted-foreground">{selectedHostRecord.machineType}</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedHostRecord.enabledTools.map((tool) => (
                        <Badge key={tool} variant="secondary">
                          {tool}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {hostsQuery.isLoading ? "Loading hosts..." : "No host selected yet."}
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-border/80 bg-background/70 p-4">
                <p className="text-sm font-semibold">Thread</p>
                {activeConversation ? (
                  <div className="mt-3 space-y-2">
                    <p className="font-medium">{compactText(activeConversation.title, "Untitled conversation")}</p>
                    <p className="text-sm text-muted-foreground">Updated {formatDateTime(activeConversation.updatedAt)}</p>
                    <p className="font-mono text-xs text-muted-foreground">{activeConversation.id}</p>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    <p className="font-medium">New conversation</p>
                    <p className="text-sm text-muted-foreground">
                      Sending the next message will create a new thread through `POST /api/chat`.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {hostsQuery.error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              Failed to load hosts: {hostsQuery.error.message}
            </div>
          ) : null}

          {conversationsQuery.error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              Failed to load conversations: {conversationsQuery.error.message}
            </div>
          ) : null}

          {messagesQuery.error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              Failed to load messages: {messagesQuery.error.message}
            </div>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Conversation</CardTitle>
              <CardDescription>
                Assistant messages expose tool and job identifiers when the backend includes them.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MessageThread
                messages={messages}
                selectedHost={selectedHost}
                isLoading={messagesQuery.isLoading}
                pending={sendMutation.isPending}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Compose</CardTitle>
              <CardDescription>Select a host, send natural language, or trigger a quick action.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
                <div>
                  <label className="mb-2 block text-sm font-medium" htmlFor="target-host">
                    Target host
                  </label>
                  <Select
                    id="target-host"
                    value={selectedHost}
                    onChange={(event) => setSelectedHost(event.target.value)}
                    disabled={hostsQuery.isLoading || hosts.length === 0}
                  >
                    {hosts.map((host) => (
                      <option key={host.id} value={host.id}>
                        {host.id}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="flex flex-wrap gap-2 self-end">
                  <Button variant="secondary" onClick={() => submitMessage(HEALTH_PROMPT)} disabled={composerDisabled}>
                    Check Revit health
                  </Button>
                  <Button variant="outline" onClick={() => submitMessage(DEMO_WALL_PROMPT)} disabled={composerDisabled}>
                    Create demo wall
                  </Button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="chat-input">
                  Message
                </label>
                <Textarea
                  id="chat-input"
                  placeholder="Ask the assistant to inspect host health or create a wall with a numeric length."
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  disabled={composerDisabled}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                      event.preventDefault();
                      submitMessage(draft);
                    }
                  }}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  {hosts.length === 0 ? "A registered host is required before chat can send requests." : "Use Ctrl/Cmd + Enter to send."}
                </p>
              </div>

              {sendMutation.error ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  {sendMutation.error.message}
                </div>
              ) : null}

              <div className="flex justify-end">
                <Button onClick={() => submitMessage(draft)} disabled={composerDisabled || !draft.trim()}>
                  Send message
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
