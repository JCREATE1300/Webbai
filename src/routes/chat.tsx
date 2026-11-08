import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { readThreads, createDeviceThread } from "@/lib/device-threads";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/chat")({
  head: () => ({ meta: [
    { title: "Conversations — webbai" },
    { name: "description", content: "Open your webbai conversations and continue chatting with your AI assistant." },
    { property: "og:title", content: "Conversations — webbai" },
    { property: "og:description", content: "Your saved conversations with the webbai assistant." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  ssr: false,
  component: ChatIndex,
});

function ChatIndex() {
  const location = useLocation();
  const navigate = useNavigate();
  const ranRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const isChatIndex = location.pathname.replace(/\/$/, "") === "/chat";

  useEffect(() => {
    if (!isChatIndex) return;
    if (ranRef.current) return;
    ranRef.current = true;
    (async () => {
      try {
        const threads = readThreads();
        if (threads.length > 0) {
          navigate({
            to: "/chat/$threadId",
            params: { threadId: threads[0].id },
            replace: true,
          });
          return;
        }
        const t = createDeviceThread();
        navigate({
          to: "/chat/$threadId",
          params: { threadId: t.id },
          replace: true,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to load chats";
        setError(msg);
        toast.error(msg);
      }
    })();
  }, [isChatIndex, navigate]);

  if (!isChatIndex) {
    return <Outlet />;
  }

  if (error) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-lg font-semibold">Couldn't load your chats</h1>
          <p className="text-sm text-muted-foreground break-words">{error}</p>
          <Button
            onClick={() => {
              ranRef.current = false;
              setError(null);
            }}
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center text-muted-foreground text-sm">
      Loading…
    </div>
  );
}
