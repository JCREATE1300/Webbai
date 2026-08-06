// Local LLM runtime manager (Ollama + Gemma 4) for the webbai desktop app.
const { app } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const HOST = 'http://127.0.0.1:11434';

const MODELS = [
  { id: 'gemma4:e2b', label: 'Gemma 4 E2B', size: '7.2 GB', ctx: '128K', note: 'Lightest — best for 8 GB RAM laptops' },
  { id: 'gemma4:e4b', label: 'Gemma 4 E4B', size: '9.6 GB', ctx: '128K', note: 'Balanced default' },
  { id: 'gemma4:12b', label: 'Gemma 4 12B', size: '7.6 GB', ctx: '256K', note: 'Smarter, 256K context' },
  { id: 'gemma4:26b', label: 'Gemma 4 26B', size: '18 GB', ctx: '256K', note: 'Needs a strong GPU / 32 GB RAM' },
  { id: 'gemma4:31b', label: 'Gemma 4 31B', size: '20 GB', ctx: '256K', note: 'Maximum quality, heaviest' },
];

let serverProc = null;

function settingsFile() {
  return path.join(app.getPath('userData'), 'webbai-local.json');
}

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
  } catch {
    return {};
  }
}

function writeSettings(patch) {
  const next = { ...readSettings(), ...patch };
  try {
    fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
    fs.writeFileSync(settingsFile(), JSON.stringify(next, null, 2));
  } catch {
    /* ignore */
  }
  return next;
}

function bundledBinary() {
  const exe = process.platform === 'win32' ? 'ollama.exe' : 'ollama';
  const candidates = [
    path.join(process.resourcesPath || '', 'ollama', exe),
    path.join(__dirname, 'vendor', 'ollama', exe),
  ];
  for (const c of candidates) {
    try {
      if (c && fs.existsSync(c)) return c;
    } catch {
      /* ignore */
    }
  }
  return null;
}

function binaryPath() {
  return bundledBinary() || (process.platform === 'win32' ? 'ollama.exe' : 'ollama');
}

async function isUp() {
  try {
    const res = await fetch(`${HOST}/api/tags`, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureServer() {
  if (await isUp()) return true;
  if (serverProc) {
    // already starting — wait for it
  } else {
    try {
      serverProc = spawn(binaryPath(), ['serve'], {
        stdio: 'ignore',
        windowsHide: true,
        detached: false,
      });
      serverProc.on('exit', () => {
        serverProc = null;
      });
      serverProc.on('error', () => {
        serverProc = null;
      });
    } catch {
      serverProc = null;
      return false;
    }
  }
  for (let i = 0; i < 40; i++) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 500));
    // eslint-disable-next-line no-await-in-loop
    if (await isUp()) return true;
  }
  return false;
}

async function installedModels() {
  try {
    const res = await fetch(`${HOST}/api/tags`);
    if (!res.ok) return [];
    const json = await res.json();
    return (json.models || []).map((m) => m.name);
  } catch {
    return [];
  }
}

async function status() {
  const running = await isUp();
  const models = running ? await installedModels() : [];
  const settings = readSettings();
  const selected = settings.model || null;
  const installed = (id) => models.some((m) => m === id || m === `${id}:latest`);
  return {
    runtimeInstalled: Boolean(bundledBinary()) || running,
    running,
    models,
    catalog: MODELS,
    selectedModel: selected,
    ready: Boolean(running && selected && installed(selected)),
  };

}

function setModel(id) {
  writeSettings({ model: id });
  return readSettings().model;
}

// Pull a model, streaming progress back through `onProgress`.
async function pullModel(id, onProgress) {
  const ok = await ensureServer();
  if (!ok) throw new Error('Could not start the local AI runtime (Ollama).');

  const res = await fetch(`${HOST}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: id, stream: true }),
  });
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status})`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const json = JSON.parse(line);
        if (json.error) throw new Error(json.error);
        onProgress({
          status: json.status || '',
          completed: json.completed || 0,
          total: json.total || 0,
        });
      } catch {
        /* ignore malformed chunk */
      }
    }
  }
  setModel(id);
  onProgress({ status: 'success', completed: 1, total: 1 });
  return true;
}

// Chat against the local model. Calls onChunk with { type, ... } events.
async function chat({ messages, tools }, onChunk) {
  const ok = await ensureServer();
  if (!ok) throw new Error('Local AI runtime is not running.');
  const model = readSettings().model;
  if (!model) throw new Error('No local model selected.');

  const res = await fetch(`${HOST}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, tools, stream: true }),
  });
  if (!res.ok || !res.body) throw new Error(`Local model error (${res.status})`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      let json;
      try {
        json = JSON.parse(line);
      } catch {
        continue;
      }
      if (json.error) {
        onChunk({ type: 'error', message: json.error });
        return;
      }
      const msg = json.message || {};
      if (msg.content) onChunk({ type: 'text', delta: msg.content });
      if (Array.isArray(msg.tool_calls)) {
        for (const call of msg.tool_calls) {
          onChunk({
            type: 'tool',
            name: call.function?.name,
            args: call.function?.arguments || {},
          });
        }
      }
      if (json.done) onChunk({ type: 'done' });
    }
  }
  onChunk({ type: 'done' });
}

function stopServer() {
  if (serverProc) {
    try {
      serverProc.kill();
    } catch {
      /* ignore */
    }
    serverProc = null;
  }
}

module.exports = { MODELS, ensureServer, status, pullModel, chat, setModel, stopServer, readSettings };
