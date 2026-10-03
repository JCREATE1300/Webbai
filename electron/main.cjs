const { app, BrowserWindow, ipcMain, shell, session } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const path = require('path');
const ollama = require('./ollama.cjs');

const APP_URL = 'https://webbai.lovable.app';
const API_BASE = 'https://webbai.lovable.app';


const AUTH_HOST_PATTERNS = [
  /(^|\.)accounts\.google\.com$/i,
  /(^|\.)oauth\.lovable\.app$/i,
  /(^|\.)lovable\.dev$/i,
  /(^|\.)supabase\.co$/i,
  /(^|\.)appleid\.apple\.com$/i,
  /(^|\.)login\.microsoftonline\.com$/i,
];

function isAuthUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (u.origin === new URL(APP_URL).origin && u.pathname.startsWith('/~oauth')) return true;
    return AUTH_HOST_PATTERNS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

let mainWindow = null;

// ---- Deep link sign-in (webbai://auth?access_token=...&refresh_token=...) ----
const PROTOCOL = 'webbai';
let pendingTokens = null;

function registerProtocol() {
  try {
    if (process.defaultApp && process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
    } else {
      app.setAsDefaultProtocolClient(PROTOCOL);
    }
  } catch {
    /* ignore */
  }
}

function handleDeepLink(rawUrl) {
  if (!rawUrl || !rawUrl.startsWith(PROTOCOL + '://')) return;
  try {
    const u = new URL(rawUrl);
    const params = new URLSearchParams(u.search || (u.hash || '').replace(/^#/, ''));
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (!access_token || !refresh_token) return;
    pendingTokens = { access_token, refresh_token };
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      mainWindow.webContents.send('webbai:auth-tokens', pendingTokens);
    }
  } catch {
    /* ignore */
  }
}

function deepLinkFromArgv(argv) {
  return (argv || []).find((a) => typeof a === 'string' && a.startsWith(PROTOCOL + '://'));
}

// Websites normally refuse to load inside an <iframe> (X-Frame-Options /
// CSP frame-ancestors). In the desktop app we control the browser, so strip
// those headers to make the in-app web view work like a real browser tab.
function enableEmbeddedWebView() {
  const filter = { urls: ['*://*/*'] };
  session.defaultSession.webRequest.onHeadersReceived(filter, (details, callback) => {
    const headers = details.responseHeaders || {};
    for (const name of Object.keys(headers)) {
      const lower = name.toLowerCase();
      if (lower === 'x-frame-options') {
        delete headers[name];
      } else if (lower === 'content-security-policy' || lower === 'content-security-policy-report-only') {
        const values = Array.isArray(headers[name]) ? headers[name] : [headers[name]];
        headers[name] = values.map((v) =>
          String(v)
            .split(';')
            .filter((d) => !/^\s*frame-ancestors/i.test(d))
            .join(';'),
        );
      }
    }
    callback({ responseHeaders: headers });
  });
}


function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    title: 'webbai v' + app.getVersion(),
    autoHideMenuBar: true,
    backgroundColor: '#0b0b0d',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });
  mainWindow.loadURL(APP_URL);

  // Display version in window
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`
      if (!document.getElementById('__webbai_version')) {
        const versionEl = document.createElement('div');
        versionEl.id = '__webbai_version';
        versionEl.style.cssText = 'position: fixed; bottom: 10px; right: 10px; font-size: 11px; color: #888; z-index: 9999; font-family: monospace;';
        versionEl.textContent = 'v${app.getVersion()}';
        document.body.appendChild(versionEl);
      }
    `);
  });

  // When the web app calls window.open(externalUrl), open it in an assistant window
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Sign-in popups (Google / Lovable OAuth broker / Supabase auth) must stay
    // real popups so window.opener + postMessage work and the session lands
    // back in the app window.
    if (isAuthUrl(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 520,
          height: 720,
          autoHideMenuBar: true,
          webPreferences: { contextIsolation: true, nodeIntegration: false },
        },
      };
    }
    if (url.startsWith('http')) {
      openAssistantWindow(url);
      return { action: 'deny' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });



  // Setup auto-updater events
  setupAutoUpdater();
}

function openAssistantWindow(targetUrl) {
  const win = new BrowserWindow({
    width: 1200,
    height: 820,
    title: targetUrl,
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });
  win.loadURL(targetUrl);
}

function setupAutoUpdater() {
  // Configure auto-updater
  autoUpdater.logger = log;
  autoUpdater.logger.transports.file.level = 'info';

  // Check for updates when app starts
  autoUpdater.checkForUpdatesAndNotify().catch((e) => log.warn('update check failed', e));

  // Listen for update events
  autoUpdater.on('update-available', () => {
    log.info('Update available');
    if (mainWindow) {
      mainWindow.webContents.send('update-available');
    }
  });

  autoUpdater.on('update-downloaded', () => {
    log.info('Update downloaded');
    if (mainWindow) {
      mainWindow.webContents.send('update-downloaded');
    }
  });

  autoUpdater.on('error', (err) => {
    log.error('Update error:', err);
    const msg = String((err && err.message) || err);
    // No release published yet / offline: not worth alarming the user.
    if (/404|latest\.yml|ENOTFOUND|ERR_INTERNET|net::|No published versions/i.test(msg)) return;
    if (mainWindow) {
      mainWindow.webContents.send('update-error', err.message);
    }
  });
}

// ----- IPC: fetch supabase token from mainWindow's localStorage -----
ipcMain.handle('webbai:get-token', async () => {
  if (!mainWindow) return null;
  try {
    const token = await mainWindow.webContents.executeJavaScript(
      `(() => {
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
              const raw = localStorage.getItem(k);
              if (!raw) continue;
              const parsed = JSON.parse(raw);
              return parsed.access_token || null;
            }
          }
        } catch (e) {}
        return null;
      })()`
    );
    return token;
  } catch (e) {
    return null;
  }
});

ipcMain.handle('webbai:api-base', async () => API_BASE);

// Open the sign-in page in the user's real browser; it hands the session back
// through the webbai:// deep link when they're done.
ipcMain.handle('webbai:open-external-signin', async () => {
  await shell.openExternal(`${APP_URL}/auth?desktop=1`);
  return true;
});

// Renderer asks for any session that arrived before it was listening.
ipcMain.handle('webbai:pending-auth', async () => {
  const t = pendingTokens;
  pendingTokens = null;
  return t;
});

// ----- IPC: screenshot of what the user is currently looking at -----
ipcMain.handle('webbai:screenshot', async (event) => {
  try {
    const sender = BrowserWindow.fromWebContents(event.sender);
    const win = sender || mainWindow;
    if (!win) return null;
    const image = await win.webContents.capturePage();
    const resized = image.resize({ width: Math.min(1280, image.getSize().width) });
    return resized.toDataURL();
  } catch (e) {
    return null;
  }
});

// ----- IPC: local Gemma 4 runtime -----
ipcMain.handle('local:status', async () => {
  try {
    await ollama.ensureServer();
  } catch {
    /* ignore */
  }
  return ollama.status();
});

ipcMain.handle('local:catalog', async () => ollama.MODELS);
ipcMain.handle('local:search', async (_e, q) => ollama.searchModels(q));

ipcMain.handle('local:set-model', async (_e, id) => ollama.setModel(id));

ipcMain.handle('local:pull', async (event, id) => {
  try {
    await ollama.pullModel(id, (p) => {
      event.sender.send('local:pull-progress', { id, ...p });
    });
    return { ok: true };
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    event.sender.send('local:pull-progress', { id, status: 'error', error: message });
    return { ok: false, error: message };
  }
});

ipcMain.handle('local:chat', async (event, { requestId, messages, tools }) => {
  try {
    await ollama.chat({ messages, tools }, (chunk) => {
      event.sender.send('local:chat-chunk', { requestId, ...chunk });
    });
    return { ok: true };
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    event.sender.send('local:chat-chunk', { requestId, type: 'error', message });
    return { ok: false, error: message };
  }
});

// IPC for updates
ipcMain.handle('update:restart', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.handle('update:check', async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    return result ? { version: result.updateInfo && result.updateInfo.version } : null;
  } catch (e) {
    return null;
  }
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    handleDeepLink(deepLinkFromArgv(argv));
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
  });

  app.whenReady().then(() => {
    registerProtocol();
    enableEmbeddedWebView();
    createMainWindow();
    handleDeepLink(deepLinkFromArgv(process.argv));
    ollama.ensureServer().catch(() => {});
  });
}

app.on('window-all-closed', () => {
  ollama.stopServer();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => ollama.stopServer());

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});

