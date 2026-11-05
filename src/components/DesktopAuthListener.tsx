import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getElectron, type AuthTokens } from "@/lib/electron";

/** Desktop app: accept the browser sign-in handoff on any page, not just /auth. */
export function DesktopAuthListener() {
  const router = useRouter();
  useEffect(() => {
    const api = getElectron();
    if (!api) return;
    // Desktop skips sign-in: start a quiet guest session and open the chat.
    void (async () => {
      const path = window.location.pathname;
      const params = new URLSearchParams(window.location.search);
      if (params.get("desktop") === "1") return;
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        const { error } = await supabase.auth.signInAnonymously();
        if (error) return;
      }
      if (path === "/" || path === "/auth") void router.navigate({ to: "/chat", replace: true });
    })();
    if (!api.onAuthTokens) return;
    const apply = async (t: AuthTokens) => {
      const { error } = await supabase.auth.setSession(t);
      if (!error) void router.navigate({ to: "/chat" });
    };
    const off = api.onAuthTokens((t) => void apply(t));
    void api.getPendingAuth?.().then((t) => {
      if (t) void apply(t);
    });
    return off;
  }, [router]);
  return null;
}
