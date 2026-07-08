import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createThread, listThreads } from "@/lib/threads.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatIndex,
});

function ChatIndex() {
  const navigate = useNavigate();
  const list = useServerFn(listThreads);
  const create = useServerFn(createThread);
  const ranRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    (async () => {
      try {
        const threads = await list();
        if (threads.length > 0) {
          navigate({
            to: "/chat/$threadId",
            params: { threadId: threads[0].id },
            replace: true,
          });
          return;
        }
        const t = await create();
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
  }, [list, create, navigate]);

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
