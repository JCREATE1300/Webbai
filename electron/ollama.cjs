// Local LLM runtime manager (Ollama + Gemma 4) for the webbai desktop app.
const { app } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const HOST = 'http://127.0.0.1:11434';

const MODELS = [
  { id: 'llama3.2', label: 'Llama 3.2', size: '2.0 GB', ctx: '128K', note: 'Fast general-purpose model (Meta)' },
  { id: 'llama3.2:3b', label: 'Llama 3.2 3B', size: '2.0 GB', ctx: '128K', note: 'Small and fast (Meta)' },
  { id: 'llama3.1', label: 'Llama 3.1', size: '4.7 GB', ctx: '128K', note: 'Popular general-purpose model (Meta)' },
  { id: 'llama3.1:8b', label: 'Llama 3.1 8B', size: '4.7 GB', ctx: '128K', note: 'Balanced reasoning and speed (Meta)' },
  { id: 'qwen2.5:7b', label: 'Qwen 2.5 7B', size: '4.7 GB', ctx: '128K', note: 'Strong all-rounder (Alibaba)' },
  { id: 'qwen2.5-coder:7b', label: 'Qwen 2.5 Coder 7B', size: '4.7 GB', ctx: '128K', note: 'Code-focused model (Alibaba)' },
  { id: 'qwen2.5vl:7b', label: 'Qwen 2.5 VL 7B', size: '6.0 GB', ctx: '128K', note: 'Vision — reads your screen well' },
  { id: 'phi4-mini', label: 'Phi-4 Mini', size: '2.5 GB', ctx: '128K', note: 'Compact reasoning (Microsoft)' },
  { id: 'phi4', label: 'Phi-4', size: '9.0 GB', ctx: '128K', note: 'Stronger reasoning model (Microsoft)' },
  { id: 'mistral:7b', label: 'Mistral 7B', size: '4.4 GB', ctx: '32K', note: 'Classic open model' },
  { id: 'mistral-nemo', label: 'Mistral Nemo', size: '4.6 GB', ctx: '128K', note: 'Modern Mistral model' },
  { id: 'deepseek-r1:7b', label: 'DeepSeek R1 7B', size: '4.7 GB', ctx: '128K', note: 'Thinks step by step' },
  { id: 'deepseek-coder-v2:16b', label: 'DeepSeek Coder V2 16B', size: '9.0 GB', ctx: '128K', note: 'Code generation and reasoning' },
  { id: 'llava:7b', label: 'LLaVA 7B', size: '4.7 GB', ctx: '4K', note: 'Can see images & screenshots' },
  { id: 'llava:13b', label: 'LLaVA 13B', size: '8.0 GB', ctx: '4K', note: 'Bigger multimodal model' },
  { id: 'granite3.2:8b', label: 'Granite 3.2 8B', size: '4.8 GB', ctx: '128K', note: 'Enterprise-focused model (IBM)' },
  { id: 'olmo2:7b', label: 'OLMo 2 7B', size: '4.7 GB', ctx: '128K', note: 'Open-language-model family' },
  { id: 'tinyllama', label: 'TinyLlama', size: '637 MB', ctx: '4K', note: 'Very small and lightweight' },
  { id: 'gemma3:4b', label: 'Gemma 3 4B', size: '3.3 GB', ctx: '128K', note: 'Sees images, light (Google)' },
  { id: 'gemma3:12b', label: 'Gemma 3 12B', size: '7.9 GB', ctx: '128K', note: 'Balanced multimodal model (Google)' },
  { id: 'gemma4:e2b', label: 'Gemma 4 E2B', size: '7.2 GB', ctx: '128K', note: 'Lightest — best for 8 GB RAM laptops' },
  { id: 'gemma4:e4b', label: 'Gemma 4 E4B', size: '9.6 GB', ctx: '128K', note: 'Balanced default' },
  { id: 'gemma4:12b', label: 'Gemma 4 12B', size: '7.6 GB', ctx: '256K', note: 'Smarter, 256K context' },
  { id: 'gemma4:26b', label: 'Gemma 4 26B', size: '18 GB', ctx: '256K', note: 'Needs a strong GPU / 32 GB RAM' },
  { id: 'gemma4:31b', label: 'Gemma 4 31B', size: '20 GB', ctx: '256K', note: 'Maximum quality, heaviest' },
];

let serverProc = null;

function normalizeModelName(name) {
  return String(name || '')
    .trim()
    .replace(/^ollama\//i, '')
    .replace(/:latest$/i, '');
}

function pushModelResult(out, name, description = '', sizes = [], capabilities = []) {
  const normalized = normalizeModelName(name);
  if (!normalized || out.some((item) => normalizeModelName(item.name) === normalized)) return;
  out.push({
    name: normalized,
    description: description || 'Ollama model',
    sizes: [...new Set((sizes || []).map((s) => String(s).trim()).filter(Boolean))],
    capabilities: [...new Set((capabilities || []).map((s) => String(s).trim()).filter(Boolean))],
  });
}

// Search the installed models and the broader Ollama catalog. The public Ollama
// library pages can be inconsistent, so we fall back to the curated catalog and
// exact-name entries instead of assuming a Gemma-only result set.
async function searchModels(query) {
  const q = String(query || '').trim();
  const out = [];

  try {
    const installed = await installedModels();
    for (const name of installed) pushModelResult(out, name, 'Installed locally', [], ['local']);
  } catch {
    // ignore if the local runtime is not running yet
  }

  const matches = MODELS.filter((x) => {
    if (!q) return true;
    const needle = q.toLowerCase();
    return x.id.toLowerCase().includes(needle) || x.label.toLowerCase().includes(needle) || x.note.toLowerCase().includes(needle);
  });
  for (const x of matches) pushModelResult(out, x.id, x.note, [], []);

  if (q) {
    try {
      const url = `https://ollama.com/search?q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'webbai' } });
      if (res.ok) {
        const html = await res.text();
        const names = new Set();
        for (const match of html.matchAll(/(?:href|data-name|data-model-name|modelName)[^\n\r"'<>:=]*["']?\s*[:=]\s*["']([^"'<>\s]+)["']/gi)) {
          const value = match[1];
          if (!value || /^(?:https?:|\/|#)/.test(value)) continue;
          names.add(value);
        }
        for (const match of html.matchAll(/\/library\/([a-zA-Z0-9._:-]+)/g)) {
          names.add(match[1]);
        }
        for (const name of [...names]) {
          if (!/^[a-zA-Z0-9._:-]+$/.test(name)) continue;
          pushModelResult(out, name, 'Available in the Ollama library', [], []);
        }
      }
    } catch {
      // ignore library scrape errors and continue to the fallback catalog below
    }
  }

  if (q && /^[a-zA-Z0-9._:-]+$/.test(q)) {
    pushModelResult(out, q, 'Download this exact model name', [], []);
  }

  if (!q && out.length === 0) {
    for (const x of MODELS) pushModelResult(out, x.id, x.note, [], []);
  }

  return out.slice(0, 80);
}

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
      const bin = binaryPath();
      serverProc = spawn(bin, ['serve'], {
        stdio: 'ignore',
        windowsHide: true,
        detached: false,
        // Run next to the binary so the bundled runtime libs (lib/ollama) resolve.
        cwd: path.isAbsolute(bin) ? path.dirname(bin) : undefined,
        env: { ...process.env, OLLAMA_HOST: '127.0.0.1:11434' },
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

  const send = (withTools) =>
    fetch(`${HOST}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withTools ? { model, messages, tools, stream: true } : { model, messages, stream: true }),
    });
  let res = await send(true);
  if (!res.ok) {
    // Many models don't support tools (or images) — retry plainly.
    res = await send(false);
  }
  if (!res.ok) {
    const plain = messages.map(({ images, ...m }) => m);
    res = await fetch(`${HOST}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: plain, stream: true }),
    });
  }
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

module.exports = { MODELS, searchModels, ensureServer, status, pullModel, chat, setModel, stopServer, readSettings };
