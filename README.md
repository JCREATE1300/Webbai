# webbai - Desktop AI Assistant

A desktop application that brings AI-powered assistance directly to your browser. Chat with an AI assistant and let it help you interact with webpages by opening them in an in-app browser and providing guidance.

**Current Version:** v 1.0.0 alpha

![Version](https://img.shields.io/badge/version-1.0.0--alpha-blue)
![Platform](https://img.shields.io/badge/platform-Windows-0078d4)
![License](https://img.shields.io/badge/license-ISC-green)

## Features

- 🤖 **AI Chat** - Chat with an assistant next to an in-app browser
- 🌐 **Open websites in-app** - Load pages inside the desktop app for easier viewing
- 📱 **Desktop App** - Built with Electron for seamless Windows integration
- 🔄 **Auto-Updates** - Get the latest version without reinstalling
- 🔐 **Secure Authentication** - Integrates with Supabase for secure login

> Note: In this alpha desktop build the floating in-page assistant UI is disabled and the app does NOT perform direct DOM actions (clicking, typing or submitting forms) on websites for you. The assistant can open pages and provide instructions or suggestions, but automated clicks/typing are experimental and unavailable in this release.

## Installation

### Download Installer

Get the latest Windows installer from [GitHub Releases](https://github.com/JCREATE1300/webbai/releases):

1. Download `webbai-setup-1.0.0-alpha.exe`
2. Run the installer
3. Launch webbai from your Start Menu or desktop shortcut
4. Sign in with your credentials

### System Requirements

- **OS:** Windows 10 or later (64-bit)
- **Memory:** 4GB RAM minimum
- **Storage:** 500MB free space
- **Internet:** Required for AI features

## Usage

### Starting the App

1. Launch webbai from your Windows Start Menu
2. Open any website in the in-app browser panel and use the chat panel to ask questions or request summaries

### What the assistant can do in this build

- Summarise page content
- Extract key information (headings, links, contact info)
- Suggest navigation steps or fields to fill
- Open and display websites inside the app

### What the assistant cannot do in this build

- Perform direct in-page interactions such as clicking buttons, filling fields, or submitting forms. Those features are experimental and disabled in this alpha desktop release.

## Updates

webbai automatically checks for updates when you launch the app.

### Update Process

1. **Update Available** - You'll see a notification
2. **Download** - Click to download the update (happens in background)
3. **Ready to Install** - Click "Restart & Install" when ready
4. **Restart** - App restarts with the new version

**No need to download and run a new installer!** Updates are applied seamlessly.

## Configuration

### Window Size

The app opens with default dimensions:
- **Width:** 1280px
- **Height:** 820px

### Custom Settings

Settings are stored in `%APPDATA%/webbai/` on your computer.

## Troubleshooting

### App won't start

- Ensure Windows Defender/Antivirus isn't blocking the app
- Try right-clicking the installer and running as administrator
- Restart your computer

### Updates not working

- Check your internet connection
- Verify GitHub is accessible in your region
- Check the app logs in `%APPDATA%/webbai/logs/`

### AI not responding

- Check your internet connection
- Verify your Supabase authentication token is valid
- Try refreshing the page or restarting the app

## Development

### Requirements

- Node.js 22+
- Bun (for package management)
- Electron 43+

### Setup

```bash
# Install dependencies
bun install

# Build the web app
bun run build

# Build Electron installer (requires Windows)
cd electron
npm install
npx electron-builder --win nsis
```

### Project Structure

```
webbai/
├── src/                    # React app source
│   ├── components/         # UI components
│   └── ...
├── electron/               # Electron main process
│   ├── main.cjs           # App entry point
│   ├── preload.cjs        # IPC bridge to renderer
│   └── package.json       # Electron config
├── .github/workflows/      # GitHub Actions CI/CD
└── package.json           # Web app dependencies
```

### Building a Release

1. Ensure `electron/package.json` version is correct (currently 1.0.0-alpha)
2. Commit any changes
3. Create an annotated tag locally and push it (see commands below)

## Architecture

### Components

- **Electron Main Process** - Manages app lifecycle, auto-updates, and IPC
- **React Web App** - UI and AI interaction logic
- **Preload Script** - Secure bridge between web app and Electron APIs
- **Auto-Updater** - Checks GitHub Releases for new versions

### Communication Flow

```
Browser Page
    ↓
Web App (React)
    ↓ (IPC)
Preload (contextBridge)
    ↓ (IPC)
Main Process (Electron)
    ↓
External API / Filesystem
```

## Privacy & Security

- ✅ All authentication handled through Supabase
- ✅ No personal data stored locally beyond auth tokens
- ✅ AI requests sent to secure API endpoints
- ✅ Context isolation enabled in Electron for security

## Support & Issues

Found a bug? Have a feature request?

1. Check [existing issues](https://github.com/JCREATE1300/webbai/issues)
2. Create a [new issue](https://github.com/JCREATE1300/webbai/issues/new)
3. Include your version number (shown in app corner)
4. Describe steps to reproduce

## Version History

### v 1.0.0 alpha (Current)
- 🚀 Initial alpha release
- ⚠️ Experimental: floating in-page assistant and direct DOM actions are disabled in this build

### v1.1.1
- ✨ Auto-update system - Update without reinstalling
- ✨ Version display in window title and corner
- 🐛 Fixed auto-updater configuration
- 📦 Added electron-log for better debugging

---

**Made with ❤️ for web automation**

For more info, visit: https://github.com/JCREATE1300/webbai
