const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { setupUpdater } = require('./updater.cjs');
function fixture() {
  const updater = new EventEmitter();
  const handlers = {};
  const events = [];
  updater.downloadUpdate = async () => { updater.emit('update-downloaded'); };
  updater.quitAndInstall = (...args) => events.push(['restart', args]);
  setupUpdater({ autoUpdater: updater, log: { warn() {} }, ipcMain: { handle: (name, fn) => { handlers[name] = fn; } },
    getWindow: () => ({ isDestroyed: () => false, webContents: { send: (...args) => events.push(args) } }) });
  return { updater, handlers, events };
}
test('available update can download and restart', async () => {
  const { updater, handlers, events } = fixture();
  updater.checkForUpdates = async () => { updater.emit('update-available', { version: '1.0.1' }); return {}; };
  assert.deepEqual(await handlers['update:check'](), { status: 'available', version: '1.0.1' });
  assert.equal(await handlers['update:download'](), true);
  assert.ok(events.some(([name]) => name === 'update-downloaded'));
  handlers['update:restart']();
  assert.deepEqual(events.at(-1), ['restart', [true, true]]);
});
test('only a confirmed up-to-date check reports current', async () => {
  const { updater, handlers } = fixture();
  updater.checkForUpdates = async () => { updater.emit('update-not-available', { version: '1.0.1' }); return {}; };
  assert.equal((await handlers['update:check']()).status, 'current');
});
test('missing metadata is not mistaken for latest version', async () => {
  const { updater, handlers } = fixture();
  updater.checkForUpdates = async () => { throw new Error('latest.yml 404'); };
  assert.equal((await handlers['update:check']()).status, 'error');
  assert.equal(await handlers['update:download'](), false);
});
test('stable updates and explicit downloads are required', () => {
  const { updater } = fixture();
  assert.equal(updater.allowPrerelease, false);
  assert.equal(updater.autoDownload, false);
  assert.equal(updater.autoInstallOnAppQuit, true);
});