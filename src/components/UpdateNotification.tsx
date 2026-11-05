import { useEffect, useState } from "react";
import { Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getElectron } from "@/lib/electron";

type State =
  | { kind: "idle" }
  | { kind: "available"; version?: string }
  | { kind: "downloading"; version?: string; percent: number }
  | { kind: "ready"; version?: string };

export function UpdateNotification() {
  const [state, setState] = useState<State>({ kind: "idle" });

  useEffect(() => {
    const api = getElectron();
    if (!api) return;
    api.onUpdateAvailable((info) => setState({ kind: "available", version: info?.version }));
    api.onDownloadProgress?.((p) =>
      setState((s) => ({ kind: "downloading", version: "version" in s ? s.version : undefined, percent: p?.percent ?? 0 })),
    );
    api.onUpdateDownloaded(() =>
      setState((s) => ({ kind: "ready", version: "version" in s ? s.version : undefined })),
    );
    api.onUpdateError(() => setState((s) => (s.kind === "downloading" ? { kind: "available", version: s.version } : s)));
  }, []);

  if (state.kind === "idle") return null;
  const api = getElectron();
  const v = state.version ? ` (v${state.version})` : "";

  return (
    <div className="fixed bottom-4 left-4 z-50 w-80 rounded-lg border border-border bg-card p-3 text-card-foreground shadow-lg">
      {state.kind === "available" && (
        <div className="flex items-center gap-3">
          <Download className="h-4 w-4 shrink-0 text-primary" />
          <span className="flex-1 text-sm">Update available{v}</span>
          <Button
            size="sm"
            onClick={() => {
              setState({ kind: "downloading", version: state.version, percent: 0 });
              api?.downloadUpdate?.();
            }}
          >
            Update Now
          </Button>
        </div>
      )}
      {state.kind === "downloading" && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Downloading update{v}</span>
            <span className="text-muted-foreground">{state.percent}%</span>
          </div>
          <Progress value={state.percent} />
        </div>
      )}
      {state.kind === "ready" && (
        <div className="flex items-center gap-3">
          <RotateCcw className="h-4 w-4 shrink-0 text-primary" />
          <span className="flex-1 text-sm">Update ready{v}</span>
          <Button size="sm" onClick={() => api?.restartAndInstall()}>
            Restart to update
          </Button>
        </div>
      )}
    </div>
  );
}
