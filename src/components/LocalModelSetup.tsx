import { useEffect, useState } from "react";
import { getLocalBridge, type LocalModelInfo, type LocalStatus } from "@/lib/electron";
import { Button } from "@/components/ui/button";
import { WebbaiMark } from "@/components/WebbaiMark";
import { Check, Download, HardDrive, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  onReady?: () => void;
  compact?: boolean;
};

export function LocalModelSetup({ onReady, compact }: Props) {
  const bridge = getLocalBridge();
  const [status, setStatus] = useState<LocalStatus | null>(null);
  const [pulling, setPulling] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ label: string; pct: number } | null>(null);

  const refresh = async () => {
    if (!bridge) return;
    const s = await bridge.status();
    setStatus(s);
    if (s.ready) onReady?.();
  };

  useEffect(() => {
    void refresh();
    if (!bridge) return;
    return bridge.onPullProgress((p) => {
      if (p.error) {
        toast.error(p.error);
        setPulling(null);
        setProgress(null);
        return;
      }
      const pct = p.total ? Math.round(((p.completed ?? 0) / p.total) * 100) : 0;
      setProgress({ label: p.status || "downloading", pct });
      if (p.status === "success") {
        setPulling(null);
        setProgress(null);
        toast.success("Local model installed");
        void refresh();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!bridge) {
    return compact ? null : (
      <div className="text-sm text-muted-foreground">
        Local Gemma 4 runs in the webbai desktop app for Windows. Download it to use the offline model.
      </div>
    );
  }

  const install = async (m: LocalModelInfo) => {
    setPulling(m.id);
    setProgress({ label: "starting", pct: 0 });
    await bridge.pull(m.id);
    void refresh();
  };

  const select = async (id: string) => {
    await bridge.setModel(id);
    void refresh();
  };

  const installed = (id: string) => status?.models.some((m) => m === id || m === `${id}:latest`);
  const catalog = status?.catalog ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <WebbaiMark size={36} />
        <div>
          <h2 className="font-semibold">Local AI model</h2>
          <p className="text-sm text-muted-foreground">
            Pick a Gemma 4 size to download once. webbai then answers with it — online and offline.
          </p>
        </div>
      </div>

      <div className="grid gap-2">
        {catalog.map((m) => {
          const isInstalled = installed(m.id);
          const isSelected = status?.selectedModel === m.id;
          return (
            <div
              key={m.id}
              className={`flex items-center gap-3 rounded-lg border p-3 ${
                isSelected ? "border-primary bg-accent/40" : ""
              }`}
            >
              <HardDrive className="w-4 h-4 shrink-0 opacity-60" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">
                  {m.label} <span className="text-muted-foreground font-normal">· {m.size} · {m.ctx} context</span>
                </div>
                <div className="text-xs text-muted-foreground truncate">{m.note}</div>
              </div>
              {isInstalled ? (
                <Button
                  size="sm"
                  variant={isSelected ? "secondary" : "outline"}
                  onClick={() => select(m.id)}
                  disabled={isSelected}
                >
                  {isSelected ? <><Check className="w-4 h-4" /> In use</> : "Use this"}
                </Button>
              ) : (
                <Button size="sm" onClick={() => install(m)} disabled={Boolean(pulling)}>
                  {pulling === m.id ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> {progress?.pct ?? 0}%</>
                  ) : (
                    <><Download className="w-4 h-4" /> Download</>
                  )}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {progress && (
        <div className="space-y-1">
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progress.pct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">{progress.label} — {progress.pct}%</p>
        </div>
      )}

      {status && !status.running && (
        <p className="text-xs text-destructive">
          Local runtime isn't running yet. It starts automatically a few seconds after launch — try again shortly.
        </p>
      )}
    </div>
  );
}
