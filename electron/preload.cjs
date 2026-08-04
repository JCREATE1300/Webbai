// Preload for assistant windows. Injection of the floating in-page assistant has been disabled.
// The snapshot and action execution helpers remain for other integrations.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('__webbai', {
  getToken: () => ipcRenderer.invoke('webbai:get-token'),
  getApiBase: () => ipcRenderer.invoke('webbai:api-base'),
});

// Expose electron flag to indicate running in Electron
contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
  
  // Update APIs
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', callback),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback),
  onUpdateError: (callback) => ipcRenderer.on('update-error', (_, message) => callback(message)),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  restartAndInstall: () => ipcRenderer.invoke('update:restart'),
});

function injectOverlay() {
  // Floating in-page assistant disabled per project update.
  // This function intentionally no-ops to prevent injecting the assistant UI into pages.
  return;
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

// Injection is disabled, but keep initialization hooks in place.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectOverlay);
} else {
  injectOverlay();
}
setInterval(injectOverlay, 2000);
