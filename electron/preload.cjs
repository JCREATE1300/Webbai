// Preload for assistant windows. Injects a floating AI chat panel into every
// page the user opens, and executes agent actions (click/type/scroll) directly
// against the page DOM.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('__webbai', {
  getToken: () => ipcRenderer.invoke('webbai:get-token'),
  getApiBase: () => ipcRenderer.invoke('webbai:api-base'),
});

function injectOverlay() {
  if (document.getElementById('__webbai_root')) return;
  const host = document.createElement('div');
  host.id = '__webbai_root';
  host.style.all = 'initial';
  host.style.position = 'fixed';
  host.style.zIndex = '2147483647';
  host.style.bottom = '20px';
  host.style.right = '20px';
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      :host, * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
      .fab {
        width: 56px; height: 56px; border-radius: 28px;
        background: linear-gradient(135deg,#4f46e5,#7c3aed);
        color: white; display: grid; place-items: center;
        cursor: pointer; box-shadow: 0 8px 24px rgba(0,0,0,.25);
        border: none; user-select: none; font-size: 22px;
      }
      .panel {
        width: 340px; height: 460px; background: #0f172a; color: #e2e8f0;
        border-radius: 14px; box-shadow: 0 20px 40px rgba(0,0,0,.35);
        display: none; flex-direction: column; overflow: hidden;
        border: 1px solid rgba(255,255,255,.08);
      }
      .panel.open { display: flex; }
      .head {
        display:flex; align-items:center; gap:8px; padding:10px 12px;
        background:#111827; border-bottom:1px solid rgba(255,255,255,.06);
        font-weight:600; font-size:13px;
      }
      .head .dot { width:8px; height:8px; border-radius:50%; background:#22c55e; }
      .head button { margin-left:auto; background:transparent; border:0; color:#94a3b8; cursor:pointer; font-size:16px; }
      .log { flex:1; overflow:auto; padding:10px 12px; font-size:13px; line-height:1.4; }
      .msg { margin-bottom:8px; white-space:pre-wrap; word-wrap:break-word; }
      .msg.user { color:#a5b4fc; }
      .msg.ai { color:#e2e8f0; }
      .msg.sys { color:#94a3b8; font-size:11px; font-style:italic; }
      .msg.act { color:#fbbf24; font-size:12px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      .row { display:flex; gap:6px; padding:10px; border-top:1px solid rgba(255,255,255,.06); background:#0b1220; }
      input, textarea {
        flex:1; background:#1e293b; border:1px solid #334155; color:#f1f5f9;
        border-radius:8px; padding:8px 10px; font-size:13px; outline:none; resize:none;
      }
      input:focus, textarea:focus { border-color:#6366f1; }
      button.send {
        background:#6366f1; color:white; border:0; border-radius:8px; padding:0 12px;
        cursor:pointer; font-weight:600;
      }
      button.send:disabled { opacity:.5; cursor:not-allowed; }
    </style>
    <div>
      <div class="panel" id="panel">
        <div class="head">
          <span class="dot"></span>
          <span>webbai assistant</span>
          <button id="close" title="Close">×</button>
        </div>
        <div class="log" id="log">
          <div class="msg sys">Ask me to do something on this page. e.g. "search for cats" or "click sign in".</div>
        </div>
        <div class="row">
          <input id="input" placeholder="What should I do?" />
          <button class="send" id="send">Go</button>
        </div>
      </div>
      <button class="fab" id="fab" title="Ask webbai">✦</button>
    </div>
  `;

  const $ = (id) => shadow.getElementById(id);
  const panel = $('panel'), fab = $('fab'), log = $('log'), input = $('input'), send = $('send');
  fab.addEventListener('click', () => { panel.classList.toggle('open'); input.focus(); });
  $('close').addEventListener('click', () => panel.classList.remove('open'));

  const add = (cls, text) => {
    const div = document.createElement('div');
    div.className = 'msg ' + cls;
    div.textContent = text;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  };

  const history = [];

  async function run(task) {
    history.push({ role: 'user', text: task });
    add('user', 'You: ' + task);
    send.disabled = true;
    input.value = '';
    try {
      const [token, apiBase] = await Promise.all([
        window.__webbai.getToken(),
        window.__webbai.getApiBase(),
      ]);
      const pageState = snapshotPage();
      add('sys', 'Thinking…');
      const res = await fetch(apiBase + '/api/browser-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        },
        body: JSON.stringify({
          task,
          url: location.href,
          pageState,
          history,
        }),
      });
      if (!res.ok) {
        add('sys', 'Error: ' + res.status + ' ' + (await res.text()));
        return;
      }
      const data = await res.json();
      for (const action of data.actions || []) {
        await executeAction(action, add);
      }
      if (data.summary) {
        add('ai', 'AI: ' + data.summary);
        history.push({ role: 'assistant', text: data.summary });
      }
    } catch (e) {
      add('sys', 'Failed: ' + (e && e.message ? e.message : String(e)));
    } finally {
      send.disabled = false;
      input.focus();
    }
  }

  send.addEventListener('click', () => {
    const v = input.value.trim();
    if (v) run(v);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const v = input.value.trim();
      if (v) run(v);
    }
  });
}

function snapshotPage() {
  const parts = [];
  parts.push('TITLE: ' + document.title);
  parts.push('URL: ' + location.href);
  const seen = new Set();
  const describe = (el) => {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? '#' + el.id : '';
    const name = el.getAttribute('name');
    const aria = el.getAttribute('aria-label');
    const type = el.getAttribute('type');
    const placeholder = el.getAttribute('placeholder');
    const text = (el.innerText || el.value || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    let selector = id;
    if (!selector && name) selector = `${tag}[name="${name}"]`;
    if (!selector && aria) selector = `${tag}[aria-label="${aria}"]`;
    if (!selector) selector = tag + (type ? `[type="${type}"]` : '');
    const key = selector + '|' + text;
    if (seen.has(key)) return null;
    seen.add(key);
    return `${tag}${type ? '['+type+']' : ''} selector=${JSON.stringify(selector)} ${aria ? 'aria='+JSON.stringify(aria)+' ' : ''}${placeholder ? 'placeholder='+JSON.stringify(placeholder)+' ' : ''}text=${JSON.stringify(text)}`;
  };

  const nodes = document.querySelectorAll('a, button, input, textarea, select, [role="button"], [role="link"]');
  parts.push('\nINTERACTIVE:');
  let count = 0;
  for (const el of nodes) {
    if (count > 80) break;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const line = describe(el);
    if (line) { parts.push(line); count++; }
  }
  parts.push('\nHEADINGS:');
  document.querySelectorAll('h1, h2, h3').forEach((h) => {
    const t = (h.innerText || '').trim().slice(0, 100);
    if (t) parts.push(h.tagName + ': ' + t);
  });
  return parts.join('\n');
}

async function executeAction(action, add) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  try {
    if (action.type === 'click') {
      const el = document.querySelector(action.selector);
      if (!el) { add('sys', 'not found: ' + action.selector); return; }
      add('act', '→ click ' + action.selector);
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      await sleep(200);
      el.click();
      await sleep(500);
    } else if (action.type === 'type') {
      const el = document.querySelector(action.selector);
      if (!el) { add('sys', 'not found: ' + action.selector); return; }
      add('act', '→ type "' + action.text + '" into ' + action.selector);
      el.focus();
      const proto = Object.getPrototypeOf(el);
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) setter.call(el, action.text); else el.value = action.text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      if (action.submit) {
        await sleep(150);
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
        const form = el.closest('form');
        if (form) form.requestSubmit ? form.requestSubmit() : form.submit();
      }
      await sleep(400);
    } else if (action.type === 'scroll') {
      add('act', '→ scroll ' + action.y);
      window.scrollBy({ top: action.y, behavior: 'smooth' });
      await sleep(400);
    } else if (action.type === 'navigate') {
      add('act', '→ navigate ' + action.url);
      location.href = action.url;
    } else if (action.type === 'wait') {
      await sleep(action.ms);
    } else if (action.type === 'done') {
      add('ai', '✓ ' + action.message);
    }
  } catch (e) {
    add('sys', 'action failed: ' + (e && e.message ? e.message : String(e)));
  }
}

// Inject on load AND on SPA navigations
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectOverlay);
} else {
  injectOverlay();
}
setInterval(injectOverlay, 2000);
