<p align="center">
  <img src="build-resources/icons/256x256.png" alt="SysAI" width="120">
</p>

<h1 align="center">SysAI</h1>
<p align="center"><strong>Local-first AI toolkit for Linux sysadmins</strong></p>
<p align="center"><em>Built by a sysadmin, for sysadmins.</em></p>

<p align="center">
  <a href="#-why-sysai">Why SysAI</a> •
  <a href="#-features">Features</a> •
  <a href="#-privacy-model">Privacy</a> •
  <a href="#-installation">Installation</a> •
  <a href="#-get-an-api-key">API Keys</a> •
  <a href="#-architecture">Architecture</a>
</p>

---

## ❓ Why SysAI

SysAI is not a generic chatbot. It is a Linux sysadmin toolkit with specialized workflows for logs, commands, configurations, scripts, troubleshooting and security checks.

| Generic AI chat | SysAI |
|---|---|
| Open a browser and write a long prompt | Open the desktop app and choose the right tool |
| Explain your environment every time | Save a system profile once |
| Read a long answer and extract the command | Get structured output ready to copy |
| Manually ask for risks and rollback | Commands are prompted to include warnings, verification and rollback notes |
| Use a single provider | Bring your own Gemini, OpenAI, Claude, DeepSeek, Mistral or Ollama |

**BYOK — Bring Your Own Key.** SysAI does not use a SysAI cloud account and does not send your data to a SysAI server. AI requests go directly from your machine to the provider you configure. With Ollama, requests can run fully locally.

---

## ⚡ Features

### 🔓 Free tools

**📋 Log Analyzer**  
Paste logs from syslog, journalctl, nginx, Docker, LND, Bitcoin Core or any service. SysAI identifies likely root causes, severity and suggested fixes.

**⌨️ Command Crafter**  
Describe what you need in plain language and get an exact Linux command with explanation, warnings, sudo/destructive flags, verification and rollback notes when applicable.

**🔍 Explain Mode**  
Paste a command or script and get a line-by-line explanation with risk notes and possible improvements.

### 🔐 Pro tools

**⚙️ Config Generator**  
Generate production-oriented configs for nginx, Apache, iptables, Docker Compose, systemd, SSH, fail2ban and more.

**🔧 Troubleshooter**  
Describe a problem and get a guided diagnostic path with concrete commands and next steps.

**📜 Script Builder**  
Generate bash or Python scripts with logging, validation, error handling and usage notes.

**🛡️ Security Auditor**  
Audit configs or system descriptions and receive findings with severity, remediation steps and notes. Includes built-in scanners:

- **Port Scanner** — native Node.js implementation, no nmap required
- **TLS/SSL Checker** — native Node.js implementation, no sslscan required
- **SSH Audit** — bundled ssh-audit binary/script support where available

### 🌐 AI providers

| Provider | API key | Notes |
|---|---:|---|
| Google Gemini | Yes | Good default for free/low-cost testing |
| OpenAI | Yes | Good general-purpose models |
| Anthropic Claude | Yes | Strong for complex reasoning and scripts |
| DeepSeek | Yes | Budget-friendly option |
| Mistral AI | Yes | European provider |
| Ollama | No | Local/offline models on your machine |

### 🌍 Languages

UI and AI response language support: English, Italiano, Français, Deutsch, Español.

### 🎨 Themes

Dark and light mode.

---

## 🔒 Privacy model

SysAI is local-first, not cloud-hosted.

- No SysAI account is required.
- No telemetry is intentionally collected by SysAI.
- No request is sent to a SysAI backend.
- API keys are stored locally.
- In Electron builds, API keys are stored through Electron `safeStorage` in the app user data directory.
- In browser/dev fallback mode only, API keys may fall back to browser `localStorage`.
- AI prompts and data are sent to the AI provider you configure, unless you use a local Ollama model.

Important: third-party AI providers have their own privacy and data-retention policies. SysAI avoids being a middleman, but it cannot control the provider selected by the user.

---

## 📦 Installation

**Requirements:** 64-bit Linux and at least one AI provider, unless you use Ollama locally.

### RPM — Fedora, RHEL, Rocky Linux, CentOS, AlmaLinux

```bash
sudo dnf install ./sysai-assistant_1.1.0-beta_x86_64.rpm
```

### DEB — Ubuntu, Debian, Pop!_OS, Linux Mint

```bash
sudo apt install ./sysai-assistant_1.1.0-beta_amd64.deb
```

If your distro reports missing dependencies, install them first, then retry the package install.

### AppImage — most Linux distributions

```bash
chmod +x sysai-assistant_1.1.0-beta_x86_64.AppImage
./sysai-assistant_1.1.0-beta_x86_64.AppImage
```

### First launch

1. Open SysAI from your application menu.
2. Go to **Settings → AI Providers**.
3. Add at least one API key, or install/start Ollama.
4. Select your default provider/model.
5. Add a short system profile, for example: `Ubuntu 24.04 VPS, Docker, nginx, Bitcoin Core, LND`.

---

## 🔑 Get an API key

### Google Gemini

1. Go to Google AI Studio.
2. Create an API key.
3. Paste it in **SysAI → Settings → Google Gemini**.

### Ollama — local/offline

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.2
ollama serve
```

SysAI expects Ollama at:

```text
http://localhost:11434
```

### Other providers

Create a key from the official console of OpenAI, Anthropic, DeepSeek or Mistral and paste it in Settings.

---

## 🧪 Beta program

SysAI is currently in beta. Feedback is especially useful on:

- installation on different Linux distributions;
- quality of generated commands/configs/scripts;
- scanner behavior;
- API provider/model behavior;
- UI/UX issues;
- features worth paying for.

Contact:

- Email: `shadowbip@proton.me`
- Nostr: `npub1yag9ggwzdrekxput74qq66p88wv8r68r2f3lm3znycqqyh408ufs7htp3e`
- GitHub Issues: use the repository issue tracker.

---

## 🏗️ Architecture

```text
┌──────────────────────────────────────────┐
│            SysAI — Electron              │
│                                          │
│  ┌────────────┐    ┌──────────────────┐  │
│  │  React UI  │    │  electron.js     │  │
│  │  renderer  │◄──►│  main process    │  │
│  │            │    │                  │  │
│  │  Tools     │    │  IPC whitelist   │  │
│  │  Settings  │    │  safeStorage     │  │
│  │  i18n      │    │  port scanner    │  │
│  │  License   │    │  TLS checker     │  │
│  └─────┬──────┘    │  ssh-audit       │  │
│        │           └──────────────────┘  │
│        │                                 │
│  ┌─────▼──────┐                          │
│  │ server.js  │  Local Express proxy     │
│  │ 127.0.0.1  │  Provider API calls      │
│  └─────┬──────┘                          │
└────────┼─────────────────────────────────┘
         │ HTTPS / local HTTP
         ▼
   AI provider selected by the user
   Gemini / OpenAI / Claude / DeepSeek / Mistral / Ollama
```

Security choices:

- Electron `contextIsolation: true` and `sandbox: true`
- IPC channel whitelist
- no arbitrary shell command execution from the renderer
- `ssh-audit` executed through `execFile`, not shell string interpolation
- API keys encrypted locally with Electron `safeStorage` where available
- scan targets sanitized before execution
- license verification with Ed25519 signatures

---

## 🛠️ Build from source

```bash
git clone https://github.com/shadowbipnode/sysai-assistant.git
cd sysai-assistant
npm install
npm run electron:dev
```

Build packages:

```bash
npm run electron:build:all
```

Output is generated in `release/`.

### Clean project archive

Do not include local dependencies, build artifacts, git metadata or private licensing tools in a shared archive:

```bash
zip -r sysai-assistant-clean.zip . \
  -x "node_modules/*" \
     ".git/*" \
     "dist/*" \
     "release/*" \
     "tools/*" \
     "src/src.zip"
```

---

## 🗺️ Roadmap

- [x] 7 sysadmin AI tools
- [x] multiple AI providers with BYOK
- [x] multilingual UI and responses
- [x] built-in port/TLS/SSH scanners
- [x] dark/light theme
- [x] license verification
- [x] command history
- [x] safer command-prompt schema with verification/rollback fields
- [x] encrypted local API-key storage in Electron builds
- [ ] export to `.sh`, `.conf`, `.md`
- [ ] favorites/snippet library
- [ ] keyboard shortcuts
- [ ] auto-update
- [ ] dedicated Bitcoin/Lightning node operator profile
- [ ] Bitcoin Core/LND/Tor/nginx log analyzers

---

## 🤝 Contributing

Contributions are welcome. Fork the repository, create a branch and open a pull request. For bugs or feature requests, open a GitHub Issue.

---

## 📄 License

[MIT](LICENSE)

---

<p align="center">Built with ⚡ by a sysadmin, for sysadmins.</p>
