# webbai - Desktop AI Assistant

A desktop application that brings AI-powered assistance directly to your browser. Chat with an AI assistant and let it help you interact with any webpage.

**Current Version:** v1.1.1

![Version](https://img.shields.io/badge/version-1.1.1-blue)
![Platform](https://img.shields.io/badge/platform-Windows-0078d4)
![License](https://img.shields.io/badge/license-ISC-green)

## Features

- 🤖 **In-Window AI Assistant** - Floating panel with AI chat on any webpage
- 🎯 **Browser Automation** - Let AI click, type, and navigate for you
- 📱 **Desktop App** - Built with Electron for seamless Windows integration
- 🔄 **Auto-Updates** - Get the latest version without reinstalling
- 🔐 **Secure Authentication** - Integrates with Supabase for secure login
- 💬 **Real-time AI** - Powered by DeepSeek V3.1 AI model

## Installation

### Download Installer

Get the latest Windows installer from [GitHub Releases](https://github.com/JCREATE1300/webbai/releases):

1. Download `webbai-setup-1.1.1.exe`
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
2. You'll see the floating AI assistant icon (✦) in the bottom-right corner
3. Click the icon to open the chat panel

### Using the Assistant

**Ask the AI to interact with pages:**
- "Search for cats on this website"
- "Click the sign in button"
- "Fill out this form with my contact info"
- "Scroll down and find the pricing section"

The AI will:
1. Understand your request
2. Perform actions on the webpage
3. Report back with results

### Available Commands

- **Chat** - Type your request and press Enter or click "Go"
- **Clear** - Close the panel and start fresh
- **Navigate** - AI can follow links and navigate between pages

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

1. Update version in `electron/package.json`
2. Commit changes
3. Tag the commit: `git tag v1.1.1`
4. Push tag: `git push origin v1.1.1`
5. GitHub Actions automatically builds and releases the installer

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

## Browser Compatibility

webbai works on any website accessible through the Electron browser. It injects a floating panel that:

- Monitors page structure
- Intercepts user interactions
- Executes AI-directed actions

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

## Roadmap

- [ ] macOS support
- [ ] Linux support
- [ ] Custom AI model selection
- [ ] Advanced task scheduling
- [ ] Team collaboration features

## License

ISC License - See LICENSE file for details

## Version History

### v1.1.1 (Current)
- ✨ Auto-update system - Update without reinstalling
- ✨ Version display in window title and corner
- 🐛 Fixed auto-updater configuration
- 📦 Added electron-log for better debugging

### v1.1.0
- 🎨 Improved UI/UX
- 🔧 Fixed build issues

### v1.0.0
- 🚀 Initial release

---

**Made with ❤️ for web automation**

For more info, visit: https://github.com/JCREATE1300/webbai
