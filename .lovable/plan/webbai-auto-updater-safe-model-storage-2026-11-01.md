# webbai auto-updater + safe model storage

## What you'll get
- On launch, webbai quietly checks your GitHub releases (JCREATE1300/webbai). If there's a newer version, a small banner appears: "Update available (vX.X.X) — Update Now".
- Clicking **Update Now** downloads in the background while you keep chatting, shows progress, then shows "Restart to update".
- AI models live in `%LOCALAPPDATA%\webbai\models`, so updates and reinstalls never touch them. Chats are already kept online with your account.
- The installer supports silent `/S` installs into `%LOCALAPPDATA%\Programs\webbai`, and the program is named `webbai.exe`, which matches what your first-time installer expects.

## Technical details
- `electron/main.cjs`: set `autoUpdater.autoDownload = false`, use `checkForUpdates()` on launch (instead of `checkForUpdatesAndNotify`). Send `update-available` with `{version}`, then `download-progress` with `{percent}` and `update-downloaded`. Add an `update:download` IPC that calls `downloadUpdate()`. Keep `quitAndInstall(true, true)` for restart. Keep the existing quiet handling for 404 or no-release errors.
- `electron/preload.cjs` + `src/lib/electron.ts`: expose `downloadUpdate`, `onDownloadProgress`, and pass the version to `onUpdateAvailable`.
- `src/components/UpdateNotification.tsx`: compact banner in the corner with three states (available → downloading with progress bar → ready to restart). Uses theme colors only, no hardcoded green or blue.
- `electron/ollama.cjs`: spawn Ollama with `OLLAMA_MODELS=%LOCALAPPDATA%\webbai\models` (create the folder if missing). On first run, if `%USERPROFILE%\.ollama\models` exists and the new folder is empty, keep using the old location so already downloaded models aren't lost. Store the settings JSON in `%LOCALAPPDATA%\webbai` as well.
- `electron/installer.nsh`: the uninstall step asks about removing models from the new path. Silent uninstalls during updates (`/S`) never delete models (`/SD IDNO` is already the default).
- `electron/package.json` build config: `executableName: "webbai"`, `nsis.perMachine: false` (installs to `%LOCALAPPDATA%\Programs\webbai` by default), keep `oneClick: false` (NSIS still accepts `/S`). Keep the github publish config so `latest.yml` is used.
- Release requirement: each GitHub release must include `webbai-windows.exe`, `.blockmap`, and `latest.yml`, and the version must be bumped in `electron/package.json`. The existing tag workflow already uploads these. Note: your current release only has a ZIP, so the updater needs at least one release built by the workflow (tag `v1.0.1`) to detect updates.
