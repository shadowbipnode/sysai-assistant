<p align="center">
  <img src="build-resources/icons/256x256.png" alt="SysAI" width="120">
</p>

<h1 align="center">SysAI</h1>
<p align="center"><strong>AI-Powered Linux Sysadmin Toolkit</strong></p>
<p align="center">
  <em>Built by a sysadmin, for sysadmins.</em>
</p>

<p align="center">
  <a href="#-why-sysai">Why SysAI</a> •
  <a href="#-features">Features</a> •
  <a href="#-installation">Installation</a> •
  <a href="#-get-an-api-key">API Keys</a> •
  <a href="#-beta-program">Beta Program</a> •
  <a href="#-architecture">Architecture</a>
</p>

---

## ❓ Why SysAI

SysAI is **not** another AI chatbot. It's a toolkit with 7 specialized tools, each designed around a real sysadmin workflow.

| The ChatGPT way | The SysAI way |
|---|---|
| Open browser, navigate to ChatGPT | Open SysAI from your desktop |
| Type a long prompt explaining context | Pick a tool, paste your log/command/config |
| Read a wall of text, find the command | Get the fix command, click copy |
| Copy-paste between browser and terminal | Already formatted and ready to use |
| Your data goes through third-party servers | Your API key, your machine, your data |

**BYOK (Bring Your Own Key):** SysAI never touches a remote server. Your API keys stay on your machine. All AI calls go directly from your app to the provider you choose. Zero telemetry, zero tracking, zero cloud.

---

## ⚡ Features

### 🔓 Free Tools

**📋 Log Analyzer**
Paste logs from syslog, journalctl, nginx, docker, LND, Bitcoin Core, or any service. SysAI identifies the root cause, severity level (LOW/MEDIUM/HIGH/CRITICAL), and gives you copy-paste fix commands.

**⌨️ Command Crafter**
Describe what you need in plain language — *"find files larger than 100MB modified this week"* — and get the exact command with a flag-by-flag explanation.

**🔍 Explain Mode**
Paste a command or script you found online or inherited from a colleague. Get a line-by-line breakdown of what it does, plus security warnings if anything is dangerous.

### 🔐 Pro Tools

**⚙️ Config Generator**
Describe your setup in words and get production-ready, commented, security-hardened configs for nginx, Apache, iptables, Docker Compose, systemd, SSH, fail2ban, and more.

**🔧 Troubleshooter**
Describe a problem and get guided step-by-step diagnosis. SysAI asks targeted questions, suggests diagnostic commands, and narrows down the issue interactively.

**📜 Script Builder**
Describe an automation task and get a complete bash or Python script with error handling, logging, input validation, and usage instructions.

**🛡️ Security Auditor**
Paste a config or describe your setup. Get a security audit with severity ratings, specific vulnerabilities, fix commands, and CIS/NIST compliance notes. Includes three built-in network scanners:

- **Port Scanner** — native Node.js implementation, no nmap required
- **TLS/SSL Checker** — native Node.js implementation, no sslscan required
- **SSH Audit** — bundled standalone binary, analyzes SSH server security

### 🌐 Multi-Provider AI (Bring Your Own Key)

| Provider | Free tier? | Notes |
|---|---|---|
| **Google Gemini** | ✅ Yes | **Recommended to start.** Free key with 15 req/min, 1M tokens/min |
| **OpenAI GPT** | ❌ Paid | GPT-4o-mini is very affordable (~$0.15/1M tokens) |
| **Anthropic Claude** | ❌ Paid | Excellent for complex scripts and configs |
| **DeepSeek** | ✅ Very cheap | Good budget alternative |
| **Mistral** | ✅ Limited free tier | European provider |
| **Ollama** | ✅ Completely free | Runs locally on your machine, fully offline |

You can configure multiple providers simultaneously and set a different default for each tool.

### 🌍 Languages

Full UI and AI responses in: 🇬🇧 English · 🇮🇹 Italiano · 🇫🇷 Français · 🇩🇪 Deutsch · 🇪🇸 Español

### 🎨 Themes

Dark mode and Light mode, following your preference.

---

## 📦 Installation

**Requirements:** Any 64-bit Linux distribution + at least one AI API key.

### RPM (Fedora, RHEL, Rocky Linux, CentOS, AlmaLinux)

```bash
sudo dnf install ./sysai-assistant_1.0.0_x86_64.rpm
```

### DEB (Ubuntu, Debian, Pop!_OS, Linux Mint)

```bash
sudo apt install ./sysai-assistant_1.0.0_amd64.deb
```

If you get a dependency error about `libxss1`:

```bash
sudo apt install libxss1
sudo dpkg -i sysai-assistant_1.0.0_amd64.deb
```

### AppImage (any distribution, no install needed)

```bash
chmod +x SysAI-1.0.0.AppImage
./SysAI-1.0.0.AppImage
```

### First Launch

1. Open SysAI from your application menu
2. Go to **Settings → AI Providers**
3. Paste your API key (Gemini recommended — it's free)
4. Choose a tool and start working

### Uninstall

```bash
sudo rpm -e sysai-assistant      # RPM
sudo dpkg -r sysai-assistant     # DEB
```

---

## 🔑 Get an API Key

You need at least one API key to use SysAI. Here's the easiest way to get started for free:

### Google Gemini (Free — recommended to start)

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Sign in with your Google account
3. Click **"Create API key"**
4. Copy the key
5. In SysAI → Settings → Google Gemini → paste the key

The free tier gives you 15 requests per minute and 1 million tokens per minute — more than enough for daily sysadmin work.

### Ollama (Free — 100% offline, no API key needed)

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.2
```

In SysAI Settings → Ollama, the default URL `http://localhost:11434` works out of the box. No API key needed. Everything stays on your machine.

### Other providers

- **OpenAI:** [platform.openai.com/api-keys](https://platform.openai.com/api-keys) (requires credit)
- **Anthropic Claude:** [console.anthropic.com](https://console.anthropic.com) (requires credit)
- **DeepSeek:** [platform.deepseek.com](https://platform.deepseek.com)
- **Mistral:** [console.mistral.ai](https://console.mistral.ai)

---

## 🧪 Beta Program

**SysAI is currently in open beta!**

We're looking for Linux sysadmins and enthusiasts to test SysAI across different distributions and setups. During the beta period, license keys are generated and sent manually.

### What beta testers get

- **Full Pro access** — all 7 tools unlocked, all providers, all languages
- **Direct feedback channel** — your suggestions shape the product
- **Free permanent Pro license** at launch as a thank-you

### How to join

1. Download the latest release from the [Releases](https://github.com/shadowbipnode/sysai-assistant/releases) page
2. Install it on your Linux machine
3. Request a beta license key through one of these channels:

   📧 **Email:** [shadowbip@proton.me](mailto:shadowbip@proton.me)

   🟣 **Nostr:** `npub1yag9ggwzdrekxput74qq66p88wv8r68r2f3lm3znycqqyh408ufs7htp3e`

   Please include your **distribution** (e.g. Ubuntu 24.04, Rocky 9, Fedora 40) and a brief description of your use case.

4. You'll receive a license key — paste it in **Settings → License → Activate**
5. Use SysAI in your daily workflow and share your feedback

> **Note:** During the beta phase, license keys are sent manually. An automated system is coming soon.

### What we need feedback on

- Does it install and run correctly on your distro?
- Do all 7 tools produce useful, actionable results?
- Do the built-in scanners (port scan, TLS check, SSH audit) work?
- Which AI provider works best for you?
- What feature is missing? What would make you pay for this?
- Any bugs, crashes, or UI issues?

You can share feedback by opening a [GitHub Issue](https://github.com/shadowbipnode/sysai-assistant/issues) or reaching out via the contacts above.

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────┐
│            SysAI (Electron)              │
│                                          │
│  ┌────────────┐    ┌──────────────────┐  │
│  │  React UI  │    │  electron.js     │  │
│  │  (renderer)│    │  (main process)  │  │
│  │            │    │                  │  │
│  │  7 tools   │◄──►│  IPC whitelist   │  │
│  │  Settings  │    │  Port scanner    │  │
│  │  i18n (5)  │    │  TLS checker     │  │
│  │  License   │    │  SSH audit bin   │  │
│  └─────┬──────┘    │  License verify  │  │
│        │           └──────────────────┘  │
│  ┌─────┴──────┐                          │
│  │ server.js  │  Express proxy (:3001)   │
│  │ CORS:local │  API key → provider      │
│  └─────┬──────┘                          │
└────────┼─────────────────────────────────┘
         │ HTTPS (your API key, direct)
    ┌────┴─────┐
    │ Gemini / │
    │ OpenAI / │  No middleman.
    │ Claude / │  Your key, your data.
    │ Ollama   │
    └──────────┘
```

**Security:**
- Electron with `contextIsolation: true` and `sandbox: true`
- IPC channel whitelist — no arbitrary command execution
- CORS restricted to localhost and file:// origins
- API keys stored in browser localStorage, never transmitted elsewhere
- License verification via Ed25519 cryptographic signatures
- Input sanitization on all scan targets

---

## 🗺️ Roadmap

- [x] 7 AI-powered sysadmin tools
- [x] 6 AI providers with BYOK
- [x] 5 languages
- [x] Built-in security scanners (port, TLS, SSH)
- [x] Dark / Light theme
- [x] License system with Ed25519 signatures
- [ ] Command history with search
- [ ] Favorites & snippet library
- [ ] Export to file (.sh, .conf, .md)
- [ ] Keyboard shortcuts
- [ ] Auto-update
- [ ] Android app

---

## 🛠️ Build from Source

```bash
git clone https://github.com/shadowbipnode/sysai-assistant.git
cd sysai-assistant
npm install
npm run electron:dev          # development mode
npm run electron:build:all    # build .deb + .rpm + AppImage
```

Build output will be in the `release/` directory.

---

## 🤝 Contributing

Contributions are welcome! Fork the repo, create a branch, make your changes, and open a Pull Request.

If you find a bug or have a feature request, please open a [GitHub Issue](https://github.com/shadowbipnode/sysai-assistant/issues).

---

## 📄 License

[MIT](LICENSE) — free to use, modify, and distribute.

---

<p align="center">
  Built with ⚡ by a sysadmin, for sysadmins.
</p>
