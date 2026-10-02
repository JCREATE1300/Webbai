import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { WebbaiMark } from "@/components/WebbaiMark";
import { getElectron } from '@/lib/electron';

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — webbai" },
      {
        name: "description",
        content:
          "Sign in or create a free webbai account to chat with the AI browser assistant, open websites in-app and download the Windows build.",
      },
      { property: "og:title", content: "Sign in to webbai" },
      {
        property: "og:description",
        content:
          "Access your webbai threads, open any website inside the app and grab the Windows desktop build.",
      },
      { property: "og:url", content: "https://webbai.lovable.app/auth" },
    ],
    links: [{ rel: "canonical", href: "https://webbai.lovable.app/auth" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Detected after mount so server and client render the same markup.
  const [isElectron, setIsElectron] = useState(false);
  const [desktopHandoff, setDesktopHandoff] = useState(false);
  const [openedBrowser, setOpenedBrowser] = useState(false);
  useEffect(() => {
    setIsElectron(Boolean(getElectron()));
    setDesktopHandoff(new URLSearchParams(window.location.search).get("desktop") === "1");
  }, []);

  // Desktop app: open the system browser automatically.
  useEffect(() => {
    if (!isElectron || openedBrowser) return;
    setOpenedBrowser(true);
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) return;
      void getElectron()?.openExternalSignIn?.();
    });
  }, [isElectron, openedBrowser]);

  const handoffToApp = async () => {
    const { data } = await supabase.auth.getSession();
    const s = data.session;
    if (!s) return false;
    window.location.href =
      `webbai://auth?access_token=${encodeURIComponent(s.access_token)}` +
      `&refresh_token=${encodeURIComponent(s.refresh_token)}`;
    return true;
  };

  const afterSignIn = async () => {
    if (desktopHandoff) {
      const ok = await handoffToApp();
      if (ok) {
        toast.success("Signed in — returning to the webbai app.");
        return;
      }
    }
    navigate({ to: "/chat" });
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return;
      if (desktopHandoff) void handoffToApp();
      else navigate({ to: "/chat" });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, desktopHandoff]);

  // Desktop app: receive the session that the browser sign-in sent back.
  useEffect(() => {
    const api = getElectron();
    if (!api?.onAuthTokens) return;
    const apply = async (t: { access_token: string; refresh_token: string }) => {
      const { error } = await supabase.auth.setSession(t);
      if (error) {
        toast.error(error.message);
        return;
      }
      navigate({ to: "/chat" });
    };
    const off = api.onAuthTokens((t) => void apply(t));
    void api.getPendingAuth?.().then((t) => {
      if (t) void apply(t);
    });
    return off;
  }, [navigate]);


  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await afterSignIn();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setLoading(false);
    }
  };


  const google = async () => {
    const redirect = desktopHandoff
      ? `${window.location.origin}/auth?desktop=1`
      : window.location.origin;
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: redirect,
    });
    if (result.error) {
      toast.error(result.error.message);
      return;
    }
    // A redirect means the page is leaving; it continues on return.
    if ("redirected" in result && result.redirected) return;
    await afterSignIn();
  };

  const signInViaBrowser = async () => {
    const api = getElectron();
    if (!api?.openExternalSignIn) {
      toast.error("Update the webbai app to sign in through your browser.");
      return;
    }
    await api.openExternalSignIn();
    toast.info("Finish signing in in your browser — you'll come right back here.");
  };

  if (isElectron) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/30 px-4">
        <div className="w-full max-w-md text-center">
          <div className="flex flex-col items-center mb-8">
            <WebbaiMark size={56} />
            <h1 className="mt-4 text-2xl font-semibold">Sign in to webbai</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We'll open your browser so you can sign in safely. When you're done,
              you'll be sent straight back here already signed in.
            </p>
          </div>
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <Button className="w-full" onClick={signInViaBrowser} type="button">
              Sign in in your browser
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">
              Waiting for you to finish in the browser…
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/30 px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <WebbaiMark size={56} />
          <h1 className="mt-4 text-2xl font-semibold text-center">
            Sign in to webbai — AI chat and in-app browser
          </h1>
          <p className="text-sm text-muted-foreground">Chat with AI. Open any website in-app.</p>
        </div>
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <form onSubmit={submit} className="space-y-4" noValidate>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="text" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />

            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">Or</span></div>
          </div>
          <Button variant="outline" className="w-full" onClick={google} type="button">
            Continue with Google
          </Button>
          <button
            type="button"
            className="mt-4 text-sm text-muted-foreground hover:text-foreground w-full text-center"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "No account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
