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

type Row = { id: string; title: string; detail: string; family?: boolean; cloudOnly?: boolean };

export function LocalModelSetup({ onReady, compact }: Props) {
  const bridge = getLocalBridge();
  const [status, setStatus] = useState<LocalStatus | null>(null);
  const [pulling, setPulling] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ phase: string; pct: number | null } | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocalSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [versions, setVersions] = useState<Record<string, LocalSearchResult[]>>({});
  const [loadingVersion, setLoadingVersion] = useState<string | null>(null);

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
      // Older installed runtimes do not report whole-model totals: don't show
      // a misleading percentage for only the currently downloading file.
      const pct = p.percent == null ? null : Math.max(0, Math.min(100, p.percent));
      const phase = /verifying|writing|removing/i.test(p.status) ? "Finishing" :
        /preparing|manifest/i.test(p.status) ? "Preparing" : "Downloading";
      setProgress({ phase, pct });
      if (p.status === "success") {
        setPulling(null);
        setProgress(null);
        toast.success("Model downloaded");
        void refresh();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ignore replies from searches that have already been replaced.
  useEffect(() => {
    if (!bridge?.search) return;
    let active = true;
    setSearching(true);
    setResults(null);
    setSearchError(null);
    const t = setTimeout(async () => {
      try {
        const found = await bridge.search?.(query);
        if (active) setResults(found ?? []);
      } catch (error) {
        if (active) setSearchError(error instanceof Error ? error.message : "Could not load the Ollama library.");
      } finally {
        if (active) setSearching(false);
      }
    }, 350);
    return () => { active = false; clearTimeout(t); };
  }, [query, retry]);

  if (!bridge) {
    return compact ? null : (
      <div className="text-sm text-muted-foreground">
        Local AI models run in the webbai desktop app for Windows. Download it to use them.
      </div>
    );
  }

  const install = async (id: string) => {
    setPulling(id);
    setProgress({ phase: "Preparing", pct: null });
    try {
      const result = await bridge.pull(id);
      if (!result.ok) throw new Error(result.error || "Model download failed. Please try again.");
      await refresh();
    } catch (error) {
      setPulling(null);
      setProgress(null);
      toast.error(error instanceof Error ? error.message : "Model download failed. Please try again.");
    }
  };

  const select = async (id: string) => {
    try {
      await bridge.setModel(id);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not select this model.");
    }
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
  for (const m of status?.models ?? []) {
    if (!query || m.toLowerCase().includes(query.toLowerCase())) push({ id: m.replace(/:latest$/, ""), title: m, detail: "Downloaded" });
  }
  for (const r of results ?? []) {
    const extra = r.capabilities.length ? ` · ${r.capabilities.join(", ")}` : "";
    push({ id: r.name, title: r.name, detail: r.description + extra, family: !r.name.includes(":") });
    for (const version of versions[r.name] ?? []) {
      push({ id: version.name, title: version.name, detail: version.size ?? version.description, cloudOnly: version.cloudOnly });
    }
  }
  const q = query.trim();
  if (q && /^[a-zA-Z0-9._:/-]+$/.test(q)) push({ id: q, title: q, detail: "Download this exact model name" });
  const showVersions = async (id: string) => {
    if (!bridge.versions) {
      toast.error("Update the Windows app to browse model versions.");
      return;
    }
    if (versions[id]) { setVersions((old) => { const next = { ...old }; delete next[id]; return next; }); return; }
    setLoadingVersion(id);
    try {
      const found = await bridge.versions(id);
      setVersions((old) => ({ ...old, [id]: found }));
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not load model versions."); }
    finally { setLoadingVersion(null); }
  };
  const modelName = status?.catalog.find((model) => model.id === pulling)?.label ?? pulling;
  const percentage = progress?.pct == null ? null : `${progress.pct.toFixed(2)}%`;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <WebbaiMark size={36} />
        <div>
          <h2 className="font-semibold">Choose an AI model</h2>
          <p className="text-sm text-muted-foreground">
            Ollama library
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

      {searchError && <div role="alert" className="flex items-center gap-3 text-sm text-destructive"><span>{searchError}</span><Button variant="outline" size="sm" onClick={() => setRetry((value) => value + 1)}>Retry</Button></div>}
      <div className="grid gap-2 max-h-[45vh] overflow-y-auto pr-1">
        {rows.map((m) => {
          const isInstalled = installed(m.id);
          const isSelected = status?.selectedModel === m.id || status?.selectedModel === `${m.id}:latest`;
          return (
            <div
              key={m.id}
              className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 ${isSelected ? "border-primary bg-accent/40" : ""}`}
            >
              <HardDrive className="w-4 h-4 shrink-0 opacity-60" />
              <div className="flex-1 min-w-0 basis-36">
                <div className="text-sm font-medium truncate">{m.title}</div>
                <div className="text-xs text-muted-foreground line-clamp-2">{m.detail}</div>
              </div>
              {m.family && (
                <Button size="sm" variant="outline" disabled={loadingVersion === m.id} onClick={() => void showVersions(m.id)}>
                  {loadingVersion === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : versions[m.id] ? "Hide versions" : "Versions"}
                </Button>
              )}
              {m.cloudOnly ? <span className="text-xs text-muted-foreground">Cloud only</span> : isInstalled ? (
                <Button size="sm" variant={isSelected ? "secondary" : "outline"} onClick={() => select(m.id)} disabled={isSelected || Boolean(pulling)}>
                  {isSelected ? <><Check className="w-4 h-4" /> In use</> : "Use this"}
                </Button>
              ) : (
                <Button size="sm" onClick={() => install(m.id)} disabled={Boolean(pulling)}>
                  {pulling === m.id ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> {percentage ?? "Preparing…"}</>
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
          <div className="flex items-start justify-between gap-3 text-xs" role="status">
            <span className="min-w-0 break-words">{progress.phase} {modelName}</span>
            <span className="shrink-0 tabular-nums">{percentage ?? "Calculating…"}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden" role="progressbar"
            aria-label={`Download ${modelName}`} aria-valuemin={0} aria-valuemax={100}
            aria-valuenow={progress.pct ?? undefined}>
            <div className={`h-full bg-primary transition-all ${progress.pct == null ? "w-full motion-safe:animate-pulse" : ""}`}
              style={progress.pct == null ? undefined : { width: `${progress.pct}%` }} />
          </div>
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
