import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash, timingSafeEqual } from "node:crypto";

function codeMatches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

/**
 * Verifies the owner access code (checked against OWNER_ACCESS_CODE env var).
 * On success, ensures a dedicated owner auth user exists with the 'owner' role
 * and returns its fixed email + password so the client can sign in.
 * On failure, returns { ok: false } with no additional detail.
 */
export const redeemOwnerCode = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ code: z.string().min(1).max(200) }).parse(d),
  )
  .handler(async ({ data }) => {
    const expected = process.env.OWNER_ACCESS_CODE;
    const ownerEmail = process.env.OWNER_EMAIL;
    const ownerPassword = process.env.OWNER_ACCOUNT_PASSWORD;

    if (!expected || !ownerEmail || !ownerPassword) {
      return { ok: false as const };
    }
    if (data.code.length !== expected.length) {
      return { ok: false as const };
    }
    if (!codeMatches(data.code, expected)) {
      return { ok: false as const };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Find existing user by email
    let userId: string | null = null;
    const list = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existing = list.data?.users.find(
      (u) => (u.email ?? "").toLowerCase() === ownerEmail.toLowerCase(),
    );
    if (existing) {
      userId = existing.id;
      // Ensure the password is in sync with the current secret
      await supabaseAdmin.auth.admin.updateUserById(existing.id, {
        password: ownerPassword,
        email_confirm: true,
      });
    } else {
      const created = await supabaseAdmin.auth.admin.createUser({
        email: ownerEmail,
        password: ownerPassword,
        email_confirm: true,
      });
      if (created.error || !created.data.user) {
        return { ok: false as const };
      }
      userId = created.data.user.id;
    }

    // Ensure owner role
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "owner" }, { onConflict: "user_id,role" });

    return { ok: true as const, email: ownerEmail, password: ownerPassword };
  });
