export type LocalThreadRecord = {
  id: string;
  title: string;
  updated_at: string;
};

export type LocalMessageRecord = {
  id: string;
  thread_id: string;
  user_id: string;
  role: string;
  parts: unknown;
  created_at: string;
};

type LocalThreadStore = {
  threads: LocalThreadRecord[];
  messages: Record<string, LocalMessageRecord[]>;
};

const STORAGE_KEY = "webbai-local-thread-store";
const inMemoryStore: LocalThreadStore = {
  threads: [],
  messages: {},
};

const makeId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export function getLocalThreadStore(): LocalThreadStore {
  if (typeof window === "undefined") {
    return inMemoryStore;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return inMemoryStore;
    }
    const parsed = JSON.parse(raw) as LocalThreadStore;
    return {
      threads: Array.isArray(parsed.threads) ? parsed.threads : [],
      messages: parsed.messages && typeof parsed.messages === "object" ? parsed.messages : {},
    };
  } catch {
    return inMemoryStore;
  }
}

export function writeLocalThreadStore(store: LocalThreadStore) {
  if (typeof window === "undefined") {
    Object.assign(inMemoryStore, store);
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore quota/storage issues in browsers
  }
}

export function listLocalThreads(): LocalThreadRecord[] {
  const store = getLocalThreadStore();
  return [...store.threads].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
}

export function createLocalThread() {
  const store = getLocalThreadStore();
  const id = makeId();
  const now = new Date().toISOString();
  const thread = { id, title: "New chat", updated_at: now };

  const next = {
    threads: [thread, ...store.threads],
    messages: { ...store.messages, [id]: [] },
  };

  writeLocalThreadStore(next);
  return thread;
}

export function deleteLocalThread(id: string) {
  const store = getLocalThreadStore();
  const next = {
    threads: store.threads.filter((t) => t.id !== id),
    messages: Object.fromEntries(
      Object.entries(store.messages).filter(([threadId]) => threadId !== id),
    ),
  };
  writeLocalThreadStore(next);
}

export function renameLocalThread(id: string, title: string) {
  const store = getLocalThreadStore();
  const next = {
    threads: store.threads.map((thread) =>
      thread.id === id ? { ...thread, title, updated_at: new Date().toISOString() } : thread,
    ),
    messages: store.messages,
  };
  writeLocalThreadStore(next);
}

export function getLocalThreadMessages(threadId: string): LocalMessageRecord[] {
  const store = getLocalThreadStore();
  return store.messages[threadId] ?? [];
}

export function setLocalThreadMessages(threadId: string, messages: LocalMessageRecord[]) {
  const store = getLocalThreadStore();
  const next = {
    threads: store.threads.some((thread) => thread.id === threadId)
      ? store.threads.map((thread) =>
          thread.id === threadId ? { ...thread, updated_at: new Date().toISOString() } : thread,
        )
      : [...store.threads, { id: threadId, title: "New chat", updated_at: new Date().toISOString() }],
    messages: {
      ...store.messages,
      [threadId]: messages,
    },
  };
  writeLocalThreadStore(next);
}
