export {};

declare global {
  interface Window {
    electron?: {
      isElectron: boolean;
      onUpdateAvailable: (callback: () => void) => void;
      onUpdateDownloaded: (callback: () => void) => void;
      onUpdateError: (callback: (message: string) => void) => void;
      checkForUpdates: () => Promise<unknown>;
      restartAndInstall: () => Promise<unknown>;
    };
    __webbai?: {
      getToken: () => Promise<string | null>;
      getApiBase: () => Promise<string>;
    };
  }
}
