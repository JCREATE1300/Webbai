export type LocalModelInfo = {
  id: string;
  label: string;
  size: string;
  ctx: string;
  note: string;
};

export type LocalStatus = {
  runtimeInstalled: boolean;
  running: boolean;
  models: string[];
  catalog: LocalModelInfo[];
  selectedModel: string | null;
  ready: boolean;
};

export type LocalPullProgress = {
  id: string;
  status: string;
  completed?: number;
  total?: number;
  error?: string;
};

export type LocalChatChunk = {
  requestId: string;
  type: "text" | "tool" | "done" | "error";
  delta?: string;
  name?: string;
  args?: Record<string, unknown>;
  message?: string;
};

export type LocalBridge = {
  status: () => Promise<LocalStatus>;
  catalog: () => Promise<LocalModelInfo[]>;
  setModel: (id: string) => Promise<string>;
  pull: (id: string) => Promise<{ ok: boolean; error?: string }>;
  onPullProgress: (cb: (p: LocalPullProgress) => void) => () => void;
  chat: (payload: {
    requestId: string;
    messages: Array<{ role: string; content: string }>;
    tools?: unknown[];
  }) => Promise<{ ok: boolean; error?: string }>;
  onChatChunk: (cb: (c: LocalChatChunk) => void) => () => void;
};

type ElectronBridge = {
  isElectron: boolean;
  onUpdateAvailable: (callback: () => void) => void;
  onUpdateDownloaded: (callback: () => void) => void;
  onUpdateError: (callback: (message: string) => void) => void;
  checkForUpdates: () => Promise<unknown>;
  restartAndInstall: () => Promise<unknown>;
  captureScreen?: () => Promise<string | null>;
  openExternalSignIn?: () => Promise<boolean>;
  getPendingAuth?: () => Promise<AuthTokens | null>;
  onAuthTokens?: (cb: (t: AuthTokens) => void) => () => void;
  local?: LocalBridge;
};

export type AuthTokens = { access_token: string; refresh_token: string };

export function getElectron(): ElectronBridge | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { electron?: ElectronBridge }).electron;
}

export function getLocalBridge(): LocalBridge | undefined {
  return getElectron()?.local;
}

/** Screenshot of the window the user is currently looking at (desktop app only). */
export async function captureScreen(): Promise<string | null> {
  const api = getElectron();
  if (!api?.captureScreen) return null;
  try {
    return await api.captureScreen();
  } catch {
    return null;
  }
}
