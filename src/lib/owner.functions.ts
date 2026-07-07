import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = (data ?? []).map((r) => r.role as string);
    return { isOwner: roles.includes("owner"), roles };
  });

export const getOwnerStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Verify caller is owner
    const { data: roleRows } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "owner");
    if (!roleRows || roleRows.length === 0) {
      throw new Error("Forbidden");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ count: threadCount }, { count: messageCount }, usersRes] = await Promise.all([
      supabaseAdmin.from("threads").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("messages").select("*", { count: "exact", head: true }),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 100 }),
    ]);

    const users = (usersRes.data?.users ?? []).map((u) => ({
      id: u.id,
      email: u.email ?? "",
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
    }));

    return {
      threadCount: threadCount ?? 0,
      messageCount: messageCount ?? 0,
      userCount: users.length,
      users,
    };
  });
