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
  autoUpdater.checkForUpdatesAndNotify();

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
  const result = await autoUpdater.checkForUpdates();
  return result;
});

app.whenReady().then(() => {
  createMainWindow();
  ollama.ensureServer().catch(() => {});
});

app.on('window-all-closed', () => {
  ollama.stopServer();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => ollama.stopServer());

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});

