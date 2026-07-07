import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createThread, listThreads } from "@/lib/threads.functions";

export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatIndex,
});

function ChatIndex() {
  const navigate = useNavigate();
  const list = useServerFn(listThreads);
  const create = useServerFn(createThread);

  useEffect(() => {
    (async () => {
      const threads = await list();
      if (threads.length > 0) {
        navigate({ to: "/chat/$threadId", params: { threadId: threads[0].id }, replace: true });
      } else {
        const t = await create();
        navigate({ to: "/chat/$threadId", params: { threadId: t.id }, replace: true });
      }
    })();
  }, [list, create, navigate]);

  return (
    <div className="min-h-screen grid place-items-center text-muted-foreground text-sm">
      Loading…
    </div>
  );
}
