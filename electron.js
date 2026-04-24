const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const { spawn, exec, execFile } = require('child_process');
const net = require('net');
const tls = require('tls');
const fs = require('fs');

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
  const safeHost = host.replace(/[^a-zA-Z0-9.\-:]/g, '');
  const safePort = String(port).replace(/[^0-9]/g, '') || '22';

  // Prova prima il binario incluso
  const sshAuditBin = getBinPath('ssh-audit');

  return new Promise((resolve) => {
    // Prova come binario diretto
    const command = `"${sshAuditBin}" -p ${safePort} ${safeHost}`;

    exec(command, { timeout: 30000, maxBuffer: 5 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error && !stdout && !stderr) {
        // Il binario non funziona, prova come script Python
        const pythonCmd = `python3 "${sshAuditBin}" -p ${safePort} ${safeHost}`;
        exec(pythonCmd, { timeout: 30000, maxBuffer: 5 * 1024 * 1024 }, (err2, stdout2, stderr2) => {
          if (stdout2 || stderr2) {
            resolve({ success: true, output: stdout2 || stderr2 });
          } else {
            resolve({
              success: false,
              output: 'ssh-audit non trovato. Installalo con: pip3 install ssh-audit',
              fallback: true,
            });
          }
        });
      } else {
        // ssh-audit ritorna exit code 3 per vulnerabilità trovate - è OK
        resolve({ success: true, output: stdout || stderr });
      }
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
