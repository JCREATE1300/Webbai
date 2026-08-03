type ElectronBridge = {
  isElectron: boolean;
  onUpdateAvailable: (callback: () => void) => void;
  onUpdateDownloaded: (callback: () => void) => void;
  onUpdateError: (callback: (message: string) => void) => void;
  checkForUpdates: () => Promise<unknown>;
  restartAndInstall: () => Promise<unknown>;
};

export function getElectron(): ElectronBridge | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { electron?: ElectronBridge }).electron;
}
