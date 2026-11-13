const { app, BrowserWindow, ipcMain, shell, session } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const path = require('path');
const ollama = require('./ollama.cjs');
const { setupUpdater } = require('./updater.cjs');

const APP_URL = 'https://webbai.lovable.app';


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
    if (url.startsWith('http')) {
      openAssistantWindow(url);
      return { action: 'deny' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });



  // Setup auto-updater events
  setupUpdater({ autoUpdater, log, ipcMain, getWindow: () => mainWindow });
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
ipcMain.handle('local:versions', async (_e, name) => ollama.modelVersions(name));

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

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.whenReady().then(() => {
    enableEmbeddedWebView();
    createMainWindow();
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

