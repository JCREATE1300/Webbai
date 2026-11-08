import type { UIMessage } from "ai";

export type DeviceThread = { id: string; title: string; updated_at: string; messages: UIMessage[] };
const KEY = "webbai-device-threads-v1";

export function readThreads(): DeviceThread[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) || "[]") as DeviceThread[]; }
  catch { return []; }
}
function write(threads: DeviceThread[]) {
  localStorage.setItem(KEY, JSON.stringify(threads));
  window.dispatchEvent(new Event("webbai-threads"));
}
export function createDeviceThread(id = crypto.randomUUID()): DeviceThread {
  const existing = readThreads().find((thread) => thread.id === id);
  if (existing) return existing;
  const thread = { id, title: "New chat", updated_at: new Date().toISOString(), messages: [] };
  write([thread, ...readThreads()]);
  return thread;
}
export function deleteDeviceThread(id: string) { write(readThreads().filter((thread) => thread.id !== id)); }
export function persistMessages(id: string, messages: UIMessage[]) {
  const cleaned = messages.map((message) => ({ ...message, parts: message.parts.filter((part) => part.type !== "file") }));
  const title = messages.find((m) => m.role === "user")?.parts.find((p) => p.type === "text");
  write(readThreads().map((thread) => thread.id === id ? {
    ...thread, messages: cleaned, updated_at: new Date().toISOString(),
    title: title?.type === "text" ? title.text.slice(0, 80) : thread.title,
  } : thread));
}