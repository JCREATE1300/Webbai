import { useEffect, useState } from "react";
import { getLocalBridge, type LocalSearchResult, type LocalStatus } from "@/lib/electron";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WebbaiMark } from "@/components/WebbaiMark";
import { Check, Download, HardDrive, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

type Props = {
  onReady?: () => void;
  compact?: boolean;
};

type Row = { id: string; title: string; detail: string };

export function LocalModelSetup({ onReady, compact }: Props) {
  const bridge = getLocalBridge();
  const [status, setStatus] = useState<LocalStatus | null>(null);
  const [pulling, setPulling] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ label: string; pct: number } | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocalSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);

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
        toast.success("Model downloaded");
        void refresh();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Search the full model library (debounced).
  useEffect(() => {
    if (!bridge?.search) return;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await bridge.search!(query));
      } catch {
        setResults(null);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  if (!bridge) {
    return compact ? null : (
      <div className="text-sm text-muted-foreground">
        Local AI models run in the webbai desktop app for Windows. Download it to use them.
      </div>
    );
  }

  const install = async (id: string) => {
    setPulling(id);
    setProgress({ label: "starting", pct: 0 });
    await bridge.pull(id);
    void refresh();
  };

  const select = async (id: string) => {
    await bridge.setModel(id);
    void refresh();
  };

  const installed = (id: string) =>
    status?.models.some((m) => m === id || m === `${id}:latest`);

  // Build rows: installed models first, then search results (each size is a row).
  const rows: Row[] = [];
  const seen = new Set<string>();
  const push = (r: Row) => {
    if (seen.has(r.id)) return;
    seen.add(r.id);
    rows.push(r);
  };
  for (const m of status?.models ?? []) push({ id: m.replace(/:latest$/, ""), title: m, detail: "Downloaded" });
  const list =
    results ??
    (status?.catalog ?? []).map((m) => ({ name: m.id, description: m.note, sizes: [], capabilities: [] }));
  for (const r of list) {
    const extra = r.capabilities.length ? ` · ${r.capabilities.join(", ")}` : "";
    if (r.sizes.length) {
      for (const sz of r.sizes) push({ id: `${r.name}:${sz}`, title: `${r.name}:${sz}`, detail: r.description + extra });
    } else {
      push({ id: r.name, title: r.name, detail: r.description + extra });
    }
  }
  const q = query.trim();
  if (q && /^[a-zA-Z0-9._:/-]+$/.test(q)) push({ id: q, title: q, detail: "Download this exact model name" });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <WebbaiMark size={36} />
        <div>
          <h2 className="font-semibold">Choose an AI model</h2>
          <p className="text-sm text-muted-foreground">
            Search every available model and download one. Models tagged "vision" can see your screen.
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-60" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search models (llama, qwen, gemma, vision…)"
          className="pl-9"
          aria-label="Search models"
        />
        {searching && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />}
      </div>

      <div className="grid gap-2 max-h-[45vh] overflow-y-auto pr-1">
        {rows.map((m) => {
          const isInstalled = installed(m.id);
          const isSelected = status?.selectedModel === m.id || status?.selectedModel === `${m.id}:latest`;
          return (
            <div
              key={m.id}
              className={`flex items-center gap-3 rounded-lg border p-3 ${isSelected ? "border-primary bg-accent/40" : ""}`}
            >
              <HardDrive className="w-4 h-4 shrink-0 opacity-60" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{m.title}</div>
                <div className="text-xs text-muted-foreground line-clamp-2">{m.detail}</div>
              </div>
              {isInstalled ? (
                <Button size="sm" variant={isSelected ? "secondary" : "outline"} onClick={() => select(m.id)} disabled={isSelected}>
                  {isSelected ? <><Check className="w-4 h-4" /> In use</> : "Use this"}
                </Button>
              ) : (
                <Button size="sm" onClick={() => install(m.id)} disabled={Boolean(pulling)}>
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
        {rows.length === 0 && !searching && (
          <p className="text-sm text-muted-foreground">No models found.</p>
        )}
      </div>

      {progress && (
        <div className="space-y-1">
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress.pct}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">{progress.label} — {progress.pct}%</p>
        </div>
      )}

      {status && !status.running && (
        <p className="text-xs text-destructive">
          The local AI engine is still starting — try again in a few seconds.
        </p>
      )}
    </div>
  );
}
