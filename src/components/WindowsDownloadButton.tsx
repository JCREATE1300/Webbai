import { useEffect, useState } from "react";
import { Download, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getElectron } from "@/lib/electron";
import { findWindowsRelease, WINDOWS_RELEASES_API } from "@/lib/windows-release";
import { useDesktopUpdate } from "@/components/UpdateNotification";
import { toast } from "sonner";

export function WindowsDownloadButton() {
  const update = useDesktopUpdate();
  const desktop = Boolean(getElectron());
  const [release, setRelease] = useState<ReturnType<typeof findWindowsRelease>>(null);
  const [loading, setLoading] = useState(false);
  const loadRelease = async () => {
    setLoading(true);
    try {
      const response = await fetch(WINDOWS_RELEASES_API);
      if (!response.ok) throw new Error("Couldn't check Windows downloads. Please try again.");
      const found = findWindowsRelease(await response.json());
      if (!found) throw new Error("No Windows download is available yet.");
      setRelease(found);
      return found;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't check Windows downloads.");
      return null;
    } finally { setLoading(false); }
  };
  useEffect(() => { if (!desktop) void loadRelease(); }, [desktop]);
  const click = async () => {
    if (desktop) {
      if (update.state.kind === "ready") getElectron()?.restartAndInstall();
      else if (update.state.kind === "available") void update.download();
      else void update.check();
      return;
    }
    const found = release ?? await loadRelease();
    if (found) window.location.assign(found.url);
  };
  const busy = loading || update.state.kind === "downloading" || update.state.kind === "checking";
  const label = !desktop ? "Latest version" : update.state.kind === "available" ? "Update now"
    : update.state.kind === "ready" ? "Restart to update"
    : update.state.kind === "downloading" ? `Updating ${update.state.percent.toFixed(0)}%`
    : update.state.kind === "checking" ? "Checking…"
    : update.state.kind === "current" ? "Latest version" : "Check for updates";
  return <Button variant="outline" size="sm" className="w-full justify-start" disabled={busy} onClick={() => void click()}
    title={release ? `Windows · ${release.version}` : desktop ? "Windows updates" : "Download for Windows"}>
    {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : update.state.kind === "ready" ? <RotateCcw className="h-4 w-4 shrink-0" /> : <Download className="h-4 w-4 shrink-0" />}
    <span className="truncate">{label}</span>
  </Button>;
}