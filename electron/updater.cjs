function setupUpdater({ autoUpdater, log, ipcMain, getWindow }) {
  autoUpdater.logger = log;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;
  let state = { status: 'unknown' };
  let checking = null;
  const send = (channel, payload) => {
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
  };
  autoUpdater.on('update-available', (info) => {
    state = { status: 'available', version: info?.version };
    send('update-available', { version: info?.version });
  });
  autoUpdater.on('update-not-available', (info) => { state = { status: 'current', version: info?.version }; });
  autoUpdater.on('download-progress', (p) => send('update-progress', { percent: Math.max(0, Math.min(100, p?.percent || 0)) }));
  autoUpdater.on('update-downloaded', () => send('update-downloaded'));
  autoUpdater.on('error', (error) => {
    state = { status: 'error', error: 'Windows updates are unavailable. Please try again later.' };
    log.warn('Update failed', error);
    send('update-error', state.error);
  });
  const check = () => {
    if (checking) return checking;
    checking = (async () => {
      try {
        const result = await autoUpdater.checkForUpdates();
        if (!result) return { status: 'error', error: 'Windows updates are unavailable.' };
        return state.status === 'unknown' ? { status: 'error', error: 'Could not confirm the latest Windows version.' } : state;
      } catch {
        return { status: 'error', error: 'Windows updates are unavailable. The release may be missing update files.' };
      } finally { checking = null; }
    })();
    return checking;
  };
  ipcMain.handle('update:check', check);
  ipcMain.handle('update:download', async () => {
    if (state.status !== 'available') return false;
    try { await autoUpdater.downloadUpdate(); return true; }
    catch { return false; }
  });
  ipcMain.handle('update:restart', () => autoUpdater.quitAndInstall(true, true));
}
module.exports = { setupUpdater };