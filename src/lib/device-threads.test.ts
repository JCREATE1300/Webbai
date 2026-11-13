import { test } from "node:test";
import { strict as assert } from "node:assert";
import { createDeviceThread, persistMessages, readThreads } from "./device-threads";

test("account-free conversations remain on the device and screenshots are not saved", () => {
  const stored = new Map<string, string>();
  const originalWindow = globalThis.window;
  const originalStorage = globalThis.localStorage;
  Object.defineProperty(globalThis, "window", { configurable: true, value: { dispatchEvent() {} } });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
  } });
  try {
    createDeviceThread("device-thread");
    persistMessages("device-thread", [{ id: "question", role: "user", parts: [
      { type: "text", text: "What is on my screen?" },
      { type: "file", mediaType: "image/png", url: "data:image/png;base64,screen" },
    ] }]);
    assert.equal(readThreads()[0].title, "What is on my screen?");
    assert.deepEqual(readThreads()[0].messages[0].parts, [{ type: "text", text: "What is on my screen?" }]);
  } finally {
    Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: originalStorage });
  }
});