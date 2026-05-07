const { app, BrowserWindow, shell, ipcMain, safeStorage } = require('electron');
const path = require('path');
const { spawn, exec, execFile } = require('child_process');
const net = require('net');
const tls = require('tls');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');

let mainWindow;
let proxyProcess;

// ============================================================
// PERCORSI BINARI INCLUSI
// ============================================================
const isPackaged = app.isPackaged;
const resourcesPath = isPackaged
  ? path.join(process.resourcesPath, 'app')
  : __dirname;

const getBinPath = (binName) => {
  // 1. Cerca nella cartella bin/ dell'app
  const localPath = path.join(resourcesPath, 'bin', binName);
  if (fs.existsSync(localPath)) {
    return localPath;
  }
  // 2. Cerca nell'asar.unpacked (per binari nativi)
  const unpackedPath = path.join(resourcesPath, '..', 'app.asar.unpacked', 'bin', binName);
  if (fs.existsSync(unpackedPath)) {
    return unpackedPath;
  }
  // 3. Fallback: cerca nel PATH di sistema
  return binName;
};

// ============================================================
// FINESTRA PRINCIPALE
// ============================================================
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, 'dist', 'icons', 'icon-256.png'),
    titleBarStyle: 'default',
    show: false,
    backgroundColor: '#0B0E14',
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Link esterni si aprono nel browser di sistema
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ============================================================
// PROXY SERVER LOCALE (per le API AI)
// ============================================================
function startProxy() {
  const serverPath = path.join(__dirname, 'server.js');
  if (!fs.existsSync(serverPath)) {
    console.error('[SysAI] server.js non trovato, proxy non avviato');
    return;
  }

  proxyProcess = spawn(process.execPath, [serverPath], {
    stdio: 'pipe',
    detached: false,
    env: { ...process.env, PORT: '3001', ELECTRON_RUN_AS_NODE: '1' }
  });

  proxyProcess.stdout?.on('data', (data) => {
    console.log(`[Proxy] ${data.toString().trim()}`);
  });

  proxyProcess.stderr?.on('data', (data) => {
    console.error(`[Proxy Error] ${data.toString().trim()}`);
  });

  proxyProcess.on('error', (err) => {
    console.error('[SysAI] Errore avvio proxy:', err.message);
  });

  proxyProcess.on('exit', (code) => {
    console.log(`[Proxy] Processo terminato con codice ${code}`);
  });
}

function stopProxy() {
  if (proxyProcess && !proxyProcess.killed) {
    proxyProcess.kill('SIGTERM');
    proxyProcess = null;
  }
}


// ============================================================
// UPDATE CHECKER (GitHub Releases)
// ============================================================
const UPDATE_REPO_OWNER = 'shadowbipnode';
const UPDATE_REPO_NAME = 'sysai-assistant';
const UPDATE_API_URL = `https://api.github.com/repos/${UPDATE_REPO_OWNER}/${UPDATE_REPO_NAME}/releases?per_page=10`;

function normalizeVersionTag(version) {
  return String(version || '')
    .trim()
    .replace(/^v/i, '')
    .replace(/^sysai[-_]?assistant[-_]?/i, '');
}

function parseVersion(version) {
  const clean = normalizeVersionTag(version);
  const [core, pre = ''] = clean.split('-', 2);
  const parts = core.split('.').map((n) => Number.parseInt(n, 10));
  return {
    raw: clean,
    major: Number.isFinite(parts[0]) ? parts[0] : 0,
    minor: Number.isFinite(parts[1]) ? parts[1] : 0,
    patch: Number.isFinite(parts[2]) ? parts[2] : 0,
    prerelease: pre || '',
  };
}

function compareVersions(a, b) {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  for (const key of ['major', 'minor', 'patch']) {
    if (va[key] > vb[key]) return 1;
    if (va[key] < vb[key]) return -1;
  }

  // Same numeric version: stable is newer than prerelease.
  if (!va.prerelease && vb.prerelease) return 1;
  if (va.prerelease && !vb.prerelease) return -1;
  if (va.prerelease === vb.prerelease) return 0;
  return va.prerelease > vb.prerelease ? 1 : -1;
}

function fetchJson(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'User-Agent': `SysAI/${app.getVersion()}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      timeout: timeoutMs,
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`GitHub returned HTTP ${res.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error(`Invalid GitHub response: ${error.message}`));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error('Update check timed out'));
    });
    req.on('error', reject);
  });
}

async function checkForUpdates() {
  const currentVersion = app.getVersion();
  const releases = await fetchJson(UPDATE_API_URL);

  if (!Array.isArray(releases)) {
    return { success: false, currentVersion, updateAvailable: false, error: 'Invalid release list' };
  }

  const newerReleases = releases
    .filter((release) => release && !release.draft && release.tag_name)
    .filter((release) => compareVersions(release.tag_name, currentVersion) > 0)
    .sort((a, b) => compareVersions(b.tag_name, a.tag_name));

  const latest = newerReleases[0];
  if (!latest) {
    return { success: true, currentVersion, updateAvailable: false };
  }

  return {
    success: true,
    currentVersion,
    updateAvailable: true,
    latestVersion: normalizeVersionTag(latest.tag_name),
    tagName: latest.tag_name,
    releaseName: latest.name || latest.tag_name,
    releaseUrl: latest.html_url,
    publishedAt: latest.published_at,
    prerelease: Boolean(latest.prerelease),
    body: String(latest.body || '').slice(0, 1200),
  };
}

// ============================================================
// SCANNER INTEGRATI (Port Scan + TLS Check nativi Node.js)
// ============================================================

/**
 * Port scanner nativo - sostituisce nmap per scansioni base
 * Usa net.connect() per testare le porte
 */
async function portScan(host, ports, timeout = 3000) {
  const portList = ports
    .split(',')
    .map(p => parseInt(p.trim()))
    .filter(p => p > 0 && p < 65536);

  const results = await Promise.allSettled(
    portList.map(port => new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(timeout);

      socket.on('connect', () => {
        // Prova a leggere il banner del servizio
        let banner = '';
        socket.once('data', (data) => {
          banner = data.toString().trim().substring(0, 200);
        });

        setTimeout(() => {
          socket.destroy();
          resolve({
            port,
            status: 'open',
            banner: banner || null,
            service: guessService(port),
          });
        }, 500);
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({ port, status: 'filtered', service: guessService(port) });
      });

      socket.on('error', (err) => {
        socket.destroy();
        resolve({
          port,
          status: err.code === 'ECONNREFUSED' ? 'closed' : 'filtered',
          service: guessService(port),
        });
      });

      socket.connect(port, host);
    }))
  );

  return results.map(r => r.value || r.reason);
}

/**
 * Indovina il servizio dalla porta
 */
function guessService(port) {
  const services = {
    21: 'FTP', 22: 'SSH', 23: 'Telnet', 25: 'SMTP', 53: 'DNS',
    80: 'HTTP', 110: 'POP3', 143: 'IMAP', 443: 'HTTPS', 445: 'SMB',
    993: 'IMAPS', 995: 'POP3S', 3306: 'MySQL', 5432: 'PostgreSQL',
    6379: 'Redis', 8080: 'HTTP-Alt', 8443: 'HTTPS-Alt', 27017: 'MongoDB',
    9735: 'Lightning', 8333: 'Bitcoin', 10009: 'LND-gRPC',
  };
  return services[port] || 'unknown';
}

/**
 * TLS/SSL checker nativo - sostituisce sslscan
 * Controlla certificato, cipher, protocollo
 */
async function tlsCheck(host, port = 443) {
  return new Promise((resolve) => {
    const startTime = Date.now();

    const socket = tls.connect(
      {
        host,
        port: parseInt(port),
        rejectUnauthorized: false,
        servername: host,
      },
      () => {
        const cert = socket.getPeerCertificate(true);
        const cipher = socket.getCipher();
        const protocol = socket.getProtocol();
        const authorized = socket.authorized;
        const elapsed = Date.now() - startTime;

        const result = {
          host,
          port,
          connected: true,
          protocol,
          cipher: {
            name: cipher.name,
            version: cipher.version,
            bits: cipher.bits || null,
          },
          certificate: {
            subject: cert.subject || {},
            issuer: cert.issuer || {},
            valid_from: cert.valid_from,
            valid_to: cert.valid_to,
            serialNumber: cert.serialNumber,
            fingerprint: cert.fingerprint,
            fingerprint256: cert.fingerprint256,
            bits: cert.bits,
            authorized,
            selfSigned: cert.issuer?.CN === cert.subject?.CN,
          },
          elapsed_ms: elapsed,
          warnings: [],
        };

        // Controlla problemi
        if (!authorized) {
          result.warnings.push('Certificate not trusted by system CA');
        }
        if (cert.valid_to) {
          const expiry = new Date(cert.valid_to);
          const daysLeft = Math.floor((expiry - Date.now()) / 86400000);
          result.certificate.days_remaining = daysLeft;
          if (daysLeft < 0) result.warnings.push('Certificate EXPIRED');
          else if (daysLeft < 30) result.warnings.push(`Certificate expires in ${daysLeft} days`);
        }
        if (protocol === 'TLSv1' || protocol === 'TLSv1.1') {
          result.warnings.push(`Deprecated protocol: ${protocol}`);
        }
        if (result.certificate.selfSigned) {
          result.warnings.push('Self-signed certificate');
        }

        socket.end();
        resolve({ success: true, ...result });
      }
    );

    socket.setTimeout(10000);
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ success: false, error: 'Connection timeout' });
    });
    socket.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}

/**
 * Esegue ssh-audit usando il binario incluso o quello di sistema
 */
async function sshAudit(host, port = 22) {
  const safeHost = String(host || '').replace(/[^a-zA-Z0-9.\-:]/g, '');
  const safePort = String(port || 22).replace(/[^0-9]/g, '') || '22';

  if (!safeHost) {
    return { success: false, output: 'Invalid SSH target' };
  }

  const sshAuditBin = getBinPath('ssh-audit');
  const args = ['-p', safePort, safeHost];
  const options = { timeout: 30000, maxBuffer: 5 * 1024 * 1024 };

  return new Promise((resolve) => {
    execFile(sshAuditBin, args, options, (error, stdout, stderr) => {
      if (!error || stdout || stderr) {
        // ssh-audit may return a non-zero exit code when findings are present.
        resolve({ success: true, output: stdout || stderr });
        return;
      }

      // Fallback for environments where ssh-audit is a Python script instead of a native binary.
      execFile('python3', [sshAuditBin, ...args], options, (pythonError, pythonStdout, pythonStderr) => {
        if (pythonStdout || pythonStderr) {
          resolve({ success: true, output: pythonStdout || pythonStderr });
          return;
        }

        resolve({
          success: false,
          output: 'ssh-audit is not available or could not be executed on this system.',
          fallback: true,
        });
      });
    });
  });
}

// ============================================================
// IPC HANDLERS (sicuri, con whitelist)
// ============================================================

// Handler unico per tutti gli scan - NO comandi arbitrari
ipcMain.handle('run-scan', async (event, { type, target, options = {} }) => {
  // Validazione input
  if (!target || typeof target !== 'string') {
    return { success: false, error: 'Target non valido' };
  }

  const safeTarget = target.replace(/[^a-zA-Z0-9.\-:]/g, '');
  if (!safeTarget) {
    return { success: false, error: 'Target contiene caratteri non validi' };
  }

  console.log(`[SysAI] Scan: ${type} → ${safeTarget}`);

  try {
    switch (type) {
      case 'port-scan': {
        const ports = options.ports || '21,22,25,53,80,110,143,443,445,993,995,3306,5432,6379,8080,8443,8333,9735,10009,27017';
        const timeout = Math.min(options.timeout || 3000, 10000); // Max 10s
        const results = await portScan(safeTarget, ports, timeout);
        return { success: true, type: 'port-scan', target: safeTarget, results };
      }

      case 'tls-check': {
        const port = options.port || 443;
        const result = await tlsCheck(safeTarget, port);
        return { success: true, type: 'tls-check', target: safeTarget, ...result };
      }

      case 'ssh-audit': {
        const port = options.port || 22;
        const result = await sshAudit(safeTarget, port);
        return { type: 'ssh-audit', target: safeTarget, ...result };
      }

      default:
        return { success: false, error: `Tipo di scan sconosciuto: ${type}` };
    }
  } catch (error) {
    console.error(`[SysAI] Errore scan ${type}:`, error.message);
    return { success: false, error: error.message };
  }
});

// Secure local storage for secrets (API keys)
const SECURE_STORE_FILE = path.join(app.getPath('userData'), 'secure-store.json');

function readSecureStore() {
  try {
    if (!fs.existsSync(SECURE_STORE_FILE)) return {};
    return JSON.parse(fs.readFileSync(SECURE_STORE_FILE, 'utf8'));
  } catch (error) {
    console.error('[SecureStore] Read error:', error.message);
    return {};
  }
}

function writeSecureStore(store) {
  fs.mkdirSync(path.dirname(SECURE_STORE_FILE), { recursive: true });
  fs.writeFileSync(SECURE_STORE_FILE, JSON.stringify(store, null, 2), { mode: 0o600 });
}

ipcMain.handle('secure-store:set', async (event, { key, value }) => {
  if (typeof key !== 'string' || !key.startsWith('sysai_')) {
    return { success: false, error: 'Invalid secure-store key' };
  }

  try {
    if (!safeStorage.isEncryptionAvailable()) {
      return { success: false, error: 'OS encryption is not available' };
    }

    const store = readSecureStore();
    const encrypted = safeStorage.encryptString(String(value || '')).toString('base64');
    store[key] = encrypted;
    writeSecureStore(store);
    return { success: true };
  } catch (error) {
    console.error('[SecureStore] Set error:', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('secure-store:get', async (event, key) => {
  if (typeof key !== 'string' || !key.startsWith('sysai_')) {
    return { success: false, error: 'Invalid secure-store key' };
  }

  try {
    const store = readSecureStore();
    if (!store[key]) return { success: true, value: null };
    const value = safeStorage.decryptString(Buffer.from(store[key], 'base64'));
    return { success: true, value };
  } catch (error) {
    console.error('[SecureStore] Get error:', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('secure-store:delete', async (event, key) => {
  if (typeof key !== 'string' || !key.startsWith('sysai_')) {
    return { success: false, error: 'Invalid secure-store key' };
  }

  try {
    const store = readSecureStore();
    delete store[key];
    writeSecureStore(store);
    return { success: true };
  } catch (error) {
    console.error('[SecureStore] Delete error:', error.message);
    return { success: false, error: error.message };
  }
});

// Versione app
ipcMain.handle('get-app-version', () => {
  return {
    version: app.getVersion(),
    electron: process.versions.electron,
    node: process.versions.node,
    platform: process.platform,
    arch: process.arch,
  };
});

// Controllo aggiornamenti GitHub Releases. Fallisce in modo silenzioso se offline.
ipcMain.handle('check-for-updates', async () => {
  try {
    return await checkForUpdates();
  } catch (error) {
    console.warn('[UpdateChecker] Check failed:', error.message);
    return {
      success: false,
      currentVersion: app.getVersion(),
      updateAvailable: false,
      offline: true,
      error: error.message,
    };
  }
});

// Apri link esterno
ipcMain.handle('open-external', async (event, url) => {
  if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
    await shell.openExternal(url);
    return { success: true };
  }
  return { success: false, error: 'URL non valido' };
});

// ============================================================
// APP LIFECYCLE
// ============================================================
app.whenReady().then(() => {
  startProxy();
  createWindow();
});

app.on('window-all-closed', () => {
  stopProxy();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  stopProxy();
});
// ============================================================
// LICENSE VERIFICATION (usa Node.js crypto nativo — Ed25519 OK)
// ============================================================

// License verification public key (Ed25519 — this is NOT a secret)
const PUBLIC_KEY_B64 = 'MCowBQYDK2VwAyEA0LlC9XP6ZjVOpu2G0rW02sIetcSKjjk4qOTBLIdJIDM=';
ipcMain.handle('verify-license', async (event, { payloadB64, signatureB64 }) => {
  try {
    // Ricostruisci la chiave pubblica dal formato SPKI/DER/Base64
    const pubKeyDer = Buffer.from(PUBLIC_KEY_B64, 'base64');
    const publicKey = crypto.createPublicKey({
      key: pubKeyDer,
      format: 'der',
      type: 'spki',
    });

    // Converti signatureB64url in Buffer
    const signature = Buffer.from(signatureB64, 'base64url');

    // Dati da verificare
    const data = Buffer.from(payloadB64);

    // Verifica firma Ed25519
    const isValid = crypto.verify(null, data, publicKey, signature);

    return { valid: isValid };
  } catch (err) {
    console.error('[License] Errore verifica:', err.message);
    return { valid: false, error: err.message };
  }
});
