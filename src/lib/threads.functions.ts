import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

type ThreadRecord = {
  id: string;
  title: string;
  updated_at: string;
};

type MessageRecord = {
  id: string;
  thread_id: string;
  user_id: string;
  role: string;
  parts: unknown;
  created_at: string;
};

const threadStore = new Map<string, ThreadRecord>();
const messageStore = new Map<string, MessageRecord[]>();

const makeLocalId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const normalizeThread = (thread: ThreadRecord) => ({
  id: thread.id,
  title: thread.title,
  updated_at: thread.updated_at,
});

export const listThreads = createServerFn({ method: "GET" }).handler(async () => {
  return [...threadStore.values()]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .map(normalizeThread);
});

export const createThread = createServerFn({ method: "POST" }).handler(async () => {
  const id = makeLocalId();
  const now = new Date().toISOString();
  const thread = { id, title: "New chat", updated_at: now };
  threadStore.set(id, thread);
  messageStore.set(id, []);
  return { id, title: thread.title, updated_at: thread.updated_at };
});

export const deleteThread = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    threadStore.delete(data.id);
    messageStore.delete(data.id);
    return { ok: true };
  });

export const renameThread = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.string(), title: z.string().min(1).max(100) }).parse(d),
  )
  .handler(async ({ data }) => {
    const existing = threadStore.get(data.id);
    if (!existing) {
      return { ok: false };
    }

    const updated = { ...existing, title: data.title, updated_at: new Date().toISOString() };
    threadStore.set(data.id, updated);
    return { ok: true };
  });

export const getThreadMessages = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ threadId: z.string() }).parse(d))
  .handler(async ({ data }) => {
    return (messageStore.get(data.threadId) ?? []) as Array<{
      id: string;
      role: string;
      parts: any;
      created_at: string;
    }>;
  });
