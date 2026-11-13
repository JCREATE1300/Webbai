import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getElectron } from "@/lib/electron";
import { toast } from "sonner";

type State =
  | { kind: "idle" | "checking" | "current" | "error" }
  | { kind: "available" | "ready"; version?: string }
  | { kind: "downloading"; version?: string; percent: number };
const UpdateContext = createContext<{ state: State; check: () => Promise<void>; download: () => Promise<void> }>({
  state: { kind: "idle" }, check: async () => {}, download: async () => {},
});
export const useDesktopUpdate = () => useContext(UpdateContext);

export function DesktopUpdateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const check = async () => {
    const api = getElectron();
    if (!api) return;
    setState({ kind: "checking" });
    try {
      const result = await api.checkForUpdates();
      if (!result || result.status === "error") throw new Error(result?.error || "Couldn't check for updates.");
      setState(result.status === "available" ? { kind: "available", version: result.version } : { kind: "current" });
    } catch (error) {
      setState({ kind: "error" });
      toast.error(error instanceof Error ? error.message : "Couldn't check for updates.");
    }
  };
  const download = async () => {
    if (state.kind !== "available") return;
    const version = state.version;
    setState({ kind: "downloading", version, percent: 0 });
    try {
      if (!await getElectron()?.downloadUpdate?.()) throw new Error("Update download failed. Please try again.");
    } catch (error) {
      setState({ kind: "available", version });
      toast.error(error instanceof Error ? error.message : "Update download failed.");
    }
  };
  useEffect(() => {
    const api = getElectron();
    if (!api) return;
    const cleanups = [
      api.onUpdateAvailable((info) => setState({ kind: "available", version: info.version })),
      api.onDownloadProgress?.((p) => setState((s) => ({ kind: "downloading", version: "version" in s ? s.version : undefined, percent: p.percent ?? 0 }))),
      api.onUpdateDownloaded(() => setState((s) => ({ kind: "ready", version: "version" in s ? s.version : undefined }))),
      api.onUpdateError(() => setState((s) => s.kind === "downloading" ? { kind: "available", version: s.version } : { kind: "error" })),
    ];
    void check();
    return () => cleanups.forEach((cleanup) => { if (typeof cleanup === "function") cleanup(); });
  }, []);
  return <UpdateContext.Provider value={{ state, check, download }}>{children}</UpdateContext.Provider>;
}

export function UpdateNotification() {
  const { state, download } = useDesktopUpdate();
  if (state.kind !== "available" && state.kind !== "ready" && state.kind !== "downloading") return null;
  const version = state.version ? ` (v${state.version})` : "";
  return <div className="fixed top-4 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-card p-3 text-card-foreground shadow-lg" role="status">
    {state.kind === "downloading" ? <div className="space-y-2">
      <div className="flex justify-between gap-2 text-sm"><span>Downloading update{version}</span><span>{state.percent.toFixed(0)}%</span></div>
      <Progress value={state.percent} />
    </div> : <div className="flex flex-wrap items-center gap-3">
      {state.kind === "ready" ? <RotateCcw className="h-4 w-4 text-primary" /> : <Download className="h-4 w-4 text-primary" />}
      <span className="flex-1 text-sm">{state.kind === "ready" ? "Update ready" : "Update available"}{version}</span>
      <Button size="sm" onClick={() => state.kind === "ready" ? getElectron()?.restartAndInstall() : void download()}>
        {state.kind === "ready" ? "Restart to update" : "Update now"}
      </Button>
    </div>}
  </div>;
}