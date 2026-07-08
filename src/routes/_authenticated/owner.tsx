import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyRole, getOwnerStats } from "@/lib/owner.functions";
import { Button } from "@/components/ui/button";
import { Shield, ArrowLeft, Users, MessagesSquare, MessageSquare } from "lucide-react";
import { isRedirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/owner")({
  head: () => ({ meta: [{ title: "Owner Panel — Nova Assistant" }] }),
  beforeLoad: async () => {
    try {
      const role = await getMyRole();
      if (!role.isOwner) {
        throw redirect({ to: "/chat" });
      }
    } catch (err) {
      if (isRedirect(err)) throw err;
      throw redirect({ to: "/chat" });
    }
  },
  component: OwnerPanel,
});

function OwnerPanel() {
  const navigate = useNavigate();
  const roleFn = useServerFn(getMyRole);
  const statsFn = useServerFn(getOwnerStats);

  const { data: role, isLoading: roleLoading } = useQuery({
    queryKey: ["my-role"],
    queryFn: () => roleFn(),
  });

  useEffect(() => {
    if (!roleLoading && role && !role.isOwner) {
      navigate({ to: "/chat", replace: true });
    }
  }, [role, roleLoading, navigate]);

  const { data: stats, isLoading, error } = useQuery({
    queryKey: ["owner-stats"],
    queryFn: () => statsFn(),
    enabled: !!role?.isOwner,
  });

  if (roleLoading || !role) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground text-sm">Loading…</div>;
  }
  if (!role.isOwner) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary text-primary-foreground grid place-items-center">
            <Shield className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Owner Panel</h1>
            <p className="text-xs text-muted-foreground">Administrative overview of Nova Assistant</p>
          </div>
          <Link to="/chat">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4" /> Back to chat
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            Failed to load owner data.
          </div>
        )}

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard icon={<Users className="w-4 h-4" />} label="Users" value={stats?.userCount} loading={isLoading} />
          <StatCard icon={<MessageSquare className="w-4 h-4" />} label="Threads" value={stats?.threadCount} loading={isLoading} />
          <StatCard icon={<MessagesSquare className="w-4 h-4" />} label="Messages" value={stats?.messageCount} loading={isLoading} />
        </section>

        <section>
          <h2 className="text-sm font-semibold mb-3">Users</h2>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Email</th>
                  <th className="text-left px-4 py-2 font-medium">Joined</th>
                  <th className="text-left px-4 py-2 font-medium">Last sign-in</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">Loading…</td></tr>
                )}
                {stats?.users.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="px-4 py-2">{u.email || <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-2 text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
                {!isLoading && stats && stats.users.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">No users yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, loading }: { icon: React.ReactNode; label: string; value: number | undefined; loading: boolean }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
        {icon} {label}
      </div>
      <div className="mt-2 text-2xl font-semibold">
        {loading ? "…" : value ?? 0}
      </div>
    </div>
  );
}
