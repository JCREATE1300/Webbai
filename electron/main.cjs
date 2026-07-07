const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

const APP_URL = 'https://project--a142bf7b-795a-4689-a8be-791b339532c6.lovable.app';

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    title: 'Nova Assistant',
    autoHideMenuBar: true,
    backgroundColor: '#0b0b0d',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadURL(APP_URL);

  // Open external links in default browser (except in-app iframe navigations)
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
