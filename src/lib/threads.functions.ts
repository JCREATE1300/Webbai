import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  createLocalThread,
  deleteLocalThread,
  getLocalThreadMessages,
  listLocalThreads,
  renameLocalThread,
  setLocalThreadMessages,
} from "@/lib/local-thread-store";

export const listThreads = createServerFn({ method: "GET" }).handler(async () => {
  return listLocalThreads();
});

export const createThread = createServerFn({ method: "POST" }).handler(async () => {
  return createLocalThread();
});

export const deleteThread = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    deleteLocalThread(data.id);
    return { ok: true };
  });

export const renameThread = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.string(), title: z.string().min(1).max(100) }).parse(d),
  )
  .handler(async ({ data }) => {
    renameLocalThread(data.id, data.title);
    return { ok: true };
  });

export const getThreadMessages = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ threadId: z.string() }).parse(d))
  .handler(async ({ data }) => {
    return getLocalThreadMessages(data.threadId) as Array<{
      id: string;
      role: string;
      parts: any;
      created_at: string;
    }>;
  });

export const saveThreadMessages = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      threadId: z.string(),
      messages: z.array(
        z.object({
          id: z.string(),
          role: z.string(),
          parts: z.any(),
          created_at: z.string().optional(),
        }),
      ),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    setLocalThreadMessages(
      data.threadId,
      data.messages.map((m) => ({
        id: m.id,
        thread_id: data.threadId,
        user_id: "local-user",
        role: m.role,
        parts: m.parts,
        created_at: m.created_at ?? new Date().toISOString(),
      })),
    );
    return { ok: true };
  });
