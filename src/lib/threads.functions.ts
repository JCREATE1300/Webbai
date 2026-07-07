import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("threads")
      .select("id,title,updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("threads")
      .insert({ user_id: context.userId, title: "New chat" })
      .select("id")
      .single();
    if (error) throw error;
    return data;
  });

export const deleteThread = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("threads").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const renameThread = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), title: z.string().min(1).max(100) }).parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("threads")
      .update({ title: data.title })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const getThreadMessages = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ threadId: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("messages")
      .select("id,role,parts,created_at")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (rows ?? []) as Array<{ id: string; role: string; parts: any; created_at: string }>;
  });
