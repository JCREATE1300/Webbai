import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import {
  createThread,
  deleteThread,
  getThreadMessages,
  listThreads,
} from "@/lib/threads.functions";
import { getMyRole } from "@/lib/owner.functions";
import { Button } from "@/components/ui/button";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputFooter,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  Bot,
  Plus,
  Trash2,
  LogOut,
  Globe,
  Download,
  MessageSquare,
  Shield,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  head: () => ({
    meta: [{ title: "webbai" }],
  }),
  component: ChatThread,
});

function ChatThread() {
  const { threadId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listFn = useServerFn(listThreads);
  const createFn = useServerFn(createThread);
  const deleteFn = useServerFn(deleteThread);
  const getMsgsFn = useServerFn(getThreadMessages);

  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token ?? null);
    });
  }, []);

  const { data: threads = [] } = useQuery({
    queryKey: ["threads"],
    queryFn: () => listFn(),
  });

  const roleFn = useServerFn(getMyRole);
  const { data: myRole } = useQuery({
    queryKey: ["my-role"],
    queryFn: () => roleFn(),
  });

  const { data: initialMessages, isLoading: msgsLoading } = useQuery({
    queryKey: ["messages", threadId],
    queryFn: async () => {
      const rows = await getMsgsFn({ data: { threadId } });
      return rows.map((r) => ({
        id: r.id,
        role: r.role as "user" | "assistant" | "system",
        parts: r.parts as UIMessage["parts"],
      })) as UIMessage[];
    },
  });

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: { threadId },
      }),
    [token, threadId],
  );

  const { messages, sendMessage, status } = useChat({
    id: threadId,
    messages: initialMessages ?? [],
    transport,
    onError: (err) => toast.error(err.message),
    onFinish: () => {
      qc.invalidateQueries({ queryKey: ["threads"] });
    },
  });

  // Auto-open website in a new window when a tool result comes in
  const lastOpenedRef = useRef<string>("");
  useEffect(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role !== "assistant") continue;
      for (const part of m.parts) {
        const p = part as any;
        if (p.type === "tool-open_website" && p.state === "output-available") {
          const key = `${m.id}:${p.toolCallId}`;
          if (lastOpenedRef.current !== key && p.output?.url) {
            lastOpenedRef.current = key;
            window.open(p.output.url, "_blank", "noopener,noreferrer");
          }
        }
      }
    }
  }, [messages]);

  const [input, setInput] = useState("");
  const submit = () => {
    const text = input.trim();
    if (!text || status === "streaming" || status === "submitted") return;
    setInput("");
    sendMessage({ text });
  };

  const newChat = async () => {
    const t = await createFn();
    qc.invalidateQueries({ queryKey: ["threads"] });
    navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
  };

  const removeThread = async (id: string) => {
    await deleteFn({ data: { id } });
    qc.invalidateQueries({ queryKey: ["threads"] });
    if (id === threadId) {
      const remaining = threads.filter((t) => t.id !== id);
      if (remaining.length > 0) {
        navigate({ to: "/chat/$threadId", params: { threadId: remaining[0].id } });
      } else {
        navigate({ to: "/chat" });
      }
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const downloadWindows = async () => {
    try {
      const res = await fetch("/webbai-windows.zip");
      if (!res.ok) throw new Error("Download not ready yet");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "webbai-windows.zip";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    }
  };

  const isLoading = status === "submitted" || status === "streaming";

  return (
    <div className="h-screen flex bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="p-4 flex items-center gap-2 border-b border-sidebar-border">
          <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground grid place-items-center">
            <Bot className="w-4 h-4" />
          </div>
          <div className="font-semibold text-sm">webbai</div>
        </div>
        <div className="p-3">
          <Button onClick={newChat} className="w-full justify-start" size="sm">
            <Plus className="w-4 h-4" /> New chat
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 space-y-1">
          {threads.map((t) => (
            <div
              key={t.id}
              className={`group flex items-center gap-1 rounded-md text-sm ${
                t.id === threadId ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50"
              }`}
            >
              <Link
                to="/chat/$threadId"
                params={{ threadId: t.id }}
                className="flex-1 flex items-center gap-2 px-2 py-2 truncate"
              >
                <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-60" />
                <span className="truncate">{t.title}</span>
              </Link>
              <button
                onClick={() => removeThread(t.id)}
                className="opacity-0 group-hover:opacity-100 p-2 hover:text-destructive"
                aria-label="Delete thread"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-sidebar-border space-y-2">
          {myRole?.isOwner && (
            <Link to="/owner" className="block">
              <Button variant="outline" size="sm" className="w-full justify-start">
                <Shield className="w-4 h-4" /> Owner Panel
              </Button>
            </Link>
          )}
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={downloadWindows}>
            <Download className="w-4 h-4" /> Download for Windows
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
            <LogOut className="w-4 h-4" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Chat pane */}
      <main className="flex-1 flex flex-col min-w-0">
        <Conversation className="flex-1">
          <ConversationContent>
            {(messages.length === 0 && !msgsLoading) && (
              <div className="max-w-2xl mx-auto text-center py-16">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-primary text-primary-foreground grid place-items-center shadow">
                  <Bot className="w-7 h-7" />
                </div>
                <h1 className="mt-4 text-2xl font-semibold">How can I help?</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Ask a question, or say <span className="font-medium">"open a website"</span> — it opens in a new window with a built-in AI assistant (Windows app).
                </p>
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                  {[
                    "Open wikipedia.org",
                    "Show me hacker news",
                    "Explain quantum entanglement",
                    "Open github.com/trending",
                  ].map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage({ text: s })}
                      className="rounded-lg border p-3 text-sm hover:bg-accent transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <Message key={m.id} from={m.role}>
                <MessageContent>
                  {m.parts.map((part, i) => {
                    const p = part as any;
                    if (p.type === "text") {
                      return (
                        <div key={i} className="prose prose-sm max-w-none dark:prose-invert">
                          <ReactMarkdown>{p.text}</ReactMarkdown>
                        </div>
                      );
                    }
                    if (p.type === "tool-open_website") {
                      const url = p.input?.url || p.output?.url;
                      const title = p.input?.title || p.output?.title || url;
                      return (
                        <div
                          key={i}
                          className="my-2 rounded-lg border bg-muted/50 p-3 flex items-center gap-3"
                        >
                          <div className="w-8 h-8 rounded-md bg-primary/10 text-primary grid place-items-center">
                            <Globe className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{title}</div>
                            <div className="text-xs text-muted-foreground truncate">{url}</div>
                          </div>
                          {url && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
                            >
                              Open
                            </Button>
                          )}
                        </div>
                      );
                    }
                    return null;
                  })}
                </MessageContent>
              </Message>
            ))}

            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="px-4 py-2">
                <Shimmer>Thinking…</Shimmer>
              </div>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="p-4 border-t bg-background">
          <div className="max-w-3xl mx-auto">
            <PromptInput onSubmit={submit}>
              <PromptInputTextarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything, or say 'open example.com'…"
              />
              <PromptInputFooter className="justify-end">
                <PromptInputSubmit status={status} disabled={!input.trim() || isLoading} />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </div>
      </main>

    </div>
  );
}
