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
import { getWindowsDownloadUrl } from "@/lib/downloads.functions";
import { getLocalBridge, getElectron, captureScreen } from "@/lib/electron";
import { createLocalChatFetch } from "@/lib/local-chat";
import { LocalModelSetup } from "@/components/LocalModelSetup";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
import { WebbaiMark } from "@/components/WebbaiMark";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  Plus,
  Trash2,
  LogOut,
  Globe,
  Download,
  MessageSquare,
  Shield,
  X,
  Maximize2,
  Minimize2,
  ExternalLink,
  Cpu,
  Camera,
  PanelRightOpen,
  PanelRightClose,
  Send,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  head: ({ params }) => ({
    meta: [
      { title: "Chat — webbai" },
      {
        name: "description",
        content:
          "Your private webbai conversation: ask questions and open websites in the in-app browser panel beside the chat.",
      },
      { property: "og:title", content: "Chat — webbai" },
      {
        property: "og:description",
        content: "A webbai thread with AI chat and an in-app browser panel.",
      },
      {
        property: "og:url",
        content: `https://webbai.lovable.app/chat/${params.threadId}`,
      },
      { name: "robots", content: "noindex" },
    ],
    links: [
      { rel: "canonical", href: `https://webbai.lovable.app/chat/${params.threadId}` },
    ],
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

  // Local Gemma 4 (desktop app) — preferred whenever it's installed & ready.
  const localBridge = getLocalBridge();
  const [localReady, setLocalReady] = useState(false);
  const [localModel, setLocalModel] = useState<string | null>(null);
  const promptedRef = useRef(false);
  const [setupOpen, setSetupOpen] = useState(false);

  useEffect(() => {
    if (!localBridge) return;
    let cancelled = false;
    const check = async () => {
      try {
        const s = await localBridge.status();
        if (cancelled) return;
        setLocalReady(s.ready);
        setLocalModel(s.selectedModel);
        // First launch of the desktop app: prompt the model-size choice.
        if (!s.selectedModel && !promptedRef.current) {
          promptedRef.current = true;
          setSetupOpen(true);
        }

      } catch {
        /* ignore */
      }
    };
    void check();
    const t = setInterval(check, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [localBridge]);

  const transport = useMemo(
    () =>
      localReady
        ? new DefaultChatTransport({
            api: "/local-chat",
            fetch: createLocalChatFetch(),
            body: { threadId },
          })
        : new DefaultChatTransport({
            api: "/api/chat",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: { threadId },
          }),
    [token, threadId, localReady],
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


  // Embedded in-app browser panel
  const [openedUrl, setOpenedUrl] = useState<string | null>(null);
  const [openedTitle, setOpenedTitle] = useState<string>("");
  const [isFullscreen, setIsFullscreen] = useState(false);
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
            setOpenedUrl(p.output.url);
            setOpenedTitle(p.output.title || p.output.url);
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

  const downloadFn = useServerFn(getWindowsDownloadUrl);
  const downloadWindows = async () => {
    try {
      const { url, filename } = await downloadFn();
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    }
  };

  const isLoading = status === "submitted" || status === "streaming";

  return (
    <div className="h-screen flex bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside
        aria-labelledby="threads-heading"
        className="w-64 shrink-0 border-r bg-sidebar text-sidebar-foreground flex flex-col"
      >
        <h2 id="threads-heading" className="sr-only">Your chat threads</h2>
        <div className="p-4 flex items-center gap-2 border-b border-sidebar-border">
          <WebbaiMark size={32} />
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
          {localBridge && (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => setSetupOpen(true)}
            >
              <Cpu className="w-4 h-4" />
              <span className="truncate">
                {localReady ? `Local: ${localModel}` : "Set up local model"}
              </span>
            </Button>
          )}
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={downloadWindows}>
            <Download className="w-4 h-4" /> Download for Windows
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
            <LogOut className="w-4 h-4" /> Sign out
          </Button>
        </div>
      </aside>

      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Local Gemma 4</DialogTitle>
          </DialogHeader>
          <LocalModelSetup onReady={() => setLocalReady(true)} />
        </DialogContent>
      </Dialog>


      {/* Chat pane */}
      <main aria-labelledby="chat-heading" className="flex-1 flex flex-col min-w-0">
        <h2 id="chat-heading" className="sr-only">Conversation with the webbai assistant</h2>
        <Conversation className="flex-1">
          <ConversationContent>
            {(messages.length === 0 && !msgsLoading) && (
              <div className="max-w-2xl mx-auto text-center py-16">
                <WebbaiMark size={56} className="mx-auto" />
                <h1 className="mt-4 text-2xl font-semibold">How can I help?</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Ask a question, or say <span className="font-medium">"open a website"</span> — it opens in a panel next to the chat with a fullscreen toggle.
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
                              onClick={() => {
                                setOpenedUrl(url);
                                setOpenedTitle(title);
                              }}
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
              <div className="px-4 py-2 flex items-center gap-2">
                <WebbaiMark size={22} animated />
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

      {/* In-app browser panel */}
      {openedUrl && (
        <section
          className={
            isFullscreen
              ? "fixed inset-0 z-50 bg-background flex flex-col"
              : "w-[46%] shrink-0 border-l bg-background flex flex-col"
          }
        >
          <h2 className="sr-only">In-app browser</h2>
          <div className="h-11 shrink-0 flex items-center gap-2 px-3 border-b bg-muted/40">
            <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">{openedTitle}</div>
              <div className="text-[10px] text-muted-foreground truncate">{openedUrl}</div>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              title="Open in system browser"
              aria-label="Open in system browser"
              onClick={() => window.open(openedUrl, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              onClick={() => setIsFullscreen((v) => !v)}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              title="Close browser panel"
              aria-label="Close browser panel"
              onClick={() => {
                setOpenedUrl(null);
                setIsFullscreen(false);
              }}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <iframe
            src={openedUrl}
            title={openedTitle}
            className="flex-1 w-full bg-white"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
            referrerPolicy="no-referrer"
          />
        </section>
      )}
    </div>
  );
}
