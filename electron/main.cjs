const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const path = require('path');
const ollama = require('./ollama.cjs');

const APP_URL = 'https://webbai.lovable.app';
const API_BASE = 'https://webbai.lovable.app';


let mainWindow = null;

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

// IPC for updates
ipcMain.handle('update:restart', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.handle('update:check', async () => {
  const result = await autoUpdater.checkForUpdates();
  return result;
});

app.whenReady().then(createMainWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});
