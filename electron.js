const { app, BrowserWindow, shell, ipcMain, safeStorage } = require('electron');
const path = require('path');
const { spawn, exec, execFile } = require('child_process');
const net = require('net');
const tls = require('tls');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');

let mainWindow;
const proxySessionToken = crypto.randomBytes(32).toString('base64url');

function devLog(...args) {
  if (process.env.NODE_ENV === 'development') {
    console.log(...args);
  }
}

function isSafeExternalUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

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
    width: 1600,
    height: 1000,
    minWidth: 900,
    minHeight: 600,
    maximized: true,
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
    mainWindow.maximize();
    mainWindow.show();
  });

  // Link esterni si aprono nel browser di sistema
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) {
      shell.openExternal(url);
    }
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
    env: { ...process.env, PORT: '3001', ELECTRON_RUN_AS_NODE: '1', SYSAI_PROXY_SESSION_TOKEN: proxySessionToken }
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
    465: 'SMTPS', 587: 'Submission', 993: 'IMAPS', 995: 'POP3S', 3306: 'MySQL', 5432: 'PostgreSQL',
    6379: 'Redis', 2375: 'Docker', 2376: 'Docker-TLS', 3000: 'Grafana', 8080: 'HTTP-Alt', 8443: 'HTTPS-Alt', 9090: 'Prometheus', 9200: 'Elasticsearch', 27017: 'MongoDB',
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
      const pythonCandidates = process.platform === 'win32'
        ? ['python', 'py']
        : ['python3', 'python'];

      const tryPythonFallback = (index = 0) => {
        if (index >= pythonCandidates.length) {
          const installHint = process.platform === 'win32'
            ? 'Python is required for SSH Audit on this Windows build. Install Python from python.org or enable the Windows Python launcher, then restart SysAI.'
            : 'Python is required for SSH Audit. Install python3 and restart SysAI.';

          resolve({
            success: false,
            output: installHint,
            error: installHint,
            fallback: true,
            dependencyMissing: 'python',
          });
          return;
        }

        const pythonBin = pythonCandidates[index];
        execFile(pythonBin, [sshAuditBin, ...args], options, (pythonError, pythonStdout, pythonStderr) => {
          const combinedOutput = pythonStdout || pythonStderr;

          if (combinedOutput && !/python was not found|not recognized|no such file|enoent/i.test(combinedOutput)) {
            resolve({ success: true, output: combinedOutput, fallback: true, python: pythonBin });
            return;
          }

          if (pythonError && pythonError.code !== 'ENOENT') {
            const errorOutput = pythonStderr || pythonError.message || '';
            if (errorOutput && !/python was not found|not recognized|no such file|enoent/i.test(errorOutput)) {
              resolve({ success: false, output: errorOutput, error: errorOutput, fallback: true, python: pythonBin });
              return;
            }
          }

          tryPythonFallback(index + 1);
        });
      };

      tryPythonFallback();
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

  if (!['network-stats', 'network-connections'].includes(type)) console.log(`[SysAI] Scan: ${type} → ${safeTarget}`);

  try {
    switch (type) {
      case 'port-scan': {
        const ports = options.ports || '21,22,25,53,80,110,143,443,445,465,587,993,995,2375,2376,3000,3306,5432,6379,8080,8443,8333,9090,9200,9735,10009,27017';
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

      case 'tcp-service-probe': {
        const net = require('net');
        const tls = require('tls');

        const port = Number(options.port);
        const service = options.service || 'unknown';

        const isTlsService = ['smtps', 'imaps', 'pop3s', 'ldaps', 'lnd-grpc'].includes(service);
        const httpProbeServices = ['docker', 'elasticsearch', 'prometheus', 'grafana'];

        if (httpProbeServices.includes(service)) {
          const protocol = service === 'docker' && port === 2376 ? 'https' : 'http';
          const baseUrl = `${protocol}://${safeTarget}:${port}`;
          const fetchText = async (pathName, method = 'GET') => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), Math.min(options.timeout || 5000, 10000));
            try {
              const response = await fetch(`${baseUrl}${pathName}`, {
                method,
                redirect: 'manual',
                signal: controller.signal,
                headers: { 'User-Agent': 'SysAI-Infrastructure-Intelligence/2.0' }
              });
              const text = method === 'HEAD' ? '' : await response.text();
              return {
                ok: true,
                status: response.status,
                url: `${baseUrl}${pathName}`,
                headers: Object.fromEntries(response.headers.entries()),
                text: text.slice(0, 200000),
                size: text.length
              };
            } catch (error) {
              return { ok: false, url: `${baseUrl}${pathName}`, error: error.message };
            } finally {
              clearTimeout(timer);
            }
          };

          const root = await fetchText('/');
          const payload = {
            success: Boolean(root.ok),
            type: 'tcp-service-probe',
            target: safeTarget,
            port,
            service,
            banner: root.text ? root.text.slice(0, 4000) : '',
            bannerLength: root.size || 0,
            http: {
              url: root.url,
              status: root.status,
              headers: root.headers || {},
              responseSize: root.size || 0
            }
          };

          if (service === 'docker') {
            const version = await fetchText('/version');
            const tlsProbe = port === 2376 ? await tlsCheck(safeTarget, port) : null;
            let versionJson = null;
            try { versionJson = JSON.parse(version.text || '{}'); } catch { versionJson = null; }
            payload.docker = {
              apiReachable: Boolean(root.ok || version.ok || tlsProbe?.success),
              publicHttpApi: Boolean((root.status && root.status < 500) || (version.status && version.status < 500)),
              tlsPresent: Boolean(tlsProbe?.success),
              tlsProtocol: tlsProbe?.protocol || '',
              tlsWarnings: tlsProbe?.warnings || [],
              version: versionJson?.Version || versionJson?.ApiVersion || '',
              apiVersion: versionJson?.ApiVersion || '',
              critical: Boolean((root.status && root.status < 500) || (version.status && version.status < 500) || tlsProbe?.success)
            };
          }

          if (service === 'elasticsearch') {
            let json = null;
            try { json = JSON.parse(root.text || '{}'); } catch { json = null; }
            payload.elasticsearch = {
              clusterName: json?.cluster_name || '',
              version: json?.version?.number || '',
              tagline: json?.tagline || '',
              reachable: Boolean(root.ok)
            };
          }

          if (service === 'prometheus') {
            const metrics = await fetchText('/metrics', 'GET');
            const graph = await fetchText('/graph', 'HEAD');
            payload.prometheus = {
              metricsReachable: Boolean(metrics.ok && metrics.status < 400),
              uiReachable: Boolean(root.ok || graph.ok),
              versionHint: (root.text || metrics.text || '').match(/prometheus[_-]?version["\s:=]+([0-9][^"'\s<]+)/i)?.[1] || ''
            };
          }

          if (service === 'grafana') {
            const login = /grafana|login|signin/i.test(root.text || '');
            const version =
              (root.text || '').match(/grafana(?:Version)?["'\s:=]+([0-9]+\.[0-9][^"'\s<]*)/i)?.[1] ||
              (root.headers?.['x-grafana-version'] || '');
            payload.grafana = {
              loginPage: login,
              version,
              reachable: Boolean(root.ok)
            };
          }

          devLog('[SysAI] HTTP service probe', { service, port, success: payload.success });
          return payload;
        }

        const result = await new Promise((resolve) => {
          let socket;
          let data = '';
          const chunks = [];
          let resolved = false;

          const finish = (payload) => {
            if (resolved) return;
            resolved = true;
            try { socket.destroy(); } catch { socket = null; }
            resolve(payload);
          };

          const buildPayload = () => {
            const rawBuffer = Buffer.concat(chunks);
            const banner = data.trim().slice(0, 8000);
            const mail = {
              isMailService: ['smtp', 'smtps', 'submission', 'pop3', 'pop3s', 'imap', 'imaps'].includes(service),
              implicitTls: ['smtps', 'imaps', 'pop3s'].includes(service),
              starttls: /STARTTLS|STLS/i.test(banner),
              auth: [],
              capabilities: [],
              tlsProtocol: isTlsService && socket.getProtocol ? socket.getProtocol() : '',
              tlsCipher: isTlsService && socket.getCipher ? socket.getCipher()?.name || '' : '',
              serverFamily:
                /dovecot/i.test(banner) ? 'Dovecot' :
                /postfix/i.test(banner) ? 'Postfix' :
                /exim/i.test(banner) ? 'Exim' :
                /exchange|microsoft/i.test(banner) ? 'Microsoft Exchange' :
                /courier/i.test(banner) ? 'Courier' :
                '',
              version:
                banner.match(/Exim\s+([0-9.]+)/i)?.[1] ||
                banner.match(/Postfix\s+([0-9.]+)/i)?.[1] ||
                banner.match(/Dovecot\s+([0-9.]+)/i)?.[1] ||
                ''
            };

            banner.split(/\r?\n/).forEach((line) => {
              const authLine = line.match(/AUTH[=\s]+(.+)$/i);
              if (authLine) {
                authLine[1]
                  .replace(/^250[-\s]*/i, '')
                  .trim()
                  .split(/\s+/)
                  .forEach((v) => {
                    const clean = v.replace(/[^A-Z0-9_-]/gi, '');
                    if (clean && !/^250/i.test(clean) && !mail.auth.includes(clean)) {
                      mail.auth.push(clean);
                    }
                  });
              }
            });

            banner.split(/\r?\n/).forEach((line) => {
              if (/(CAPA|CAPABILITY|STARTTLS|STLS|AUTH|PIPELINING|SIZE|UIDL|TOP|IMAP4|SASL)/i.test(line)) {
                mail.capabilities.push(line.trim());
              }
            });

            const mysqlVersion =
              banner.match(/([0-9]+\.[0-9]+\.[0-9]+[-A-Za-z0-9._]*)-MariaDB/i)?.[1] ||
              banner.match(/([0-9]+\.[0-9]+\.[0-9]+)/)?.[1] ||
              '';
            const mysqlAuth =
              banner.match(/(mysql_native_password|caching_sha2_password|sha256_password|auth_socket)/i)?.[1] ||
              rawBuffer.toString('latin1').match(/(mysql_native_password|caching_sha2_password|sha256_password|auth_socket)/i)?.[1] ||
              '';

            const database = {
              isDatabase: ['mysql', 'postgresql', 'redis', 'mongodb', 'mssql', 'oracle'].includes(service),
              vendor:
                service === 'mysql' && /mariadb/i.test(banner) ? 'MariaDB' :
                service === 'mysql' ? 'MySQL/MariaDB' :
                service === 'redis' ? 'Redis' :
                service === 'postgresql' ? 'PostgreSQL' :
                service === 'mongodb' ? 'MongoDB' :
                service,
              version:
                mysqlVersion ||
                banner.match(/redis_version:([^\r\n]+)/i)?.[1]?.trim() ||
                '',
              authPlugin: mysqlAuth,
              handshakeExposed: ['mysql', 'postgresql', 'mongodb'].includes(service) ? true : Boolean(banner),
              auth:
                /NOAUTH|Authentication required/i.test(banner) ? 'required' :
                /\+PONG/i.test(banner) ? 'not-required-or-ping-allowed' :
                service === 'postgresql' && !banner ? 'required-or-filtered-after-connect' :
                service === 'mongodb' && !banner ? 'unknown' :
                'unknown',
              redisNoAuth: /NOAUTH/i.test(banner),
              redisPongWithoutAuth: /\+PONG/i.test(banner),
              redisInfoAvailable: /redis_version:/i.test(banner),
              endpointReachable: true
            };

            const lightning = {
              isLightning: ['lightning', 'lnd-grpc'].includes(service),
              tlsReachable: false,
              grpcLikely: service === 'lnd-grpc',
              operationalNote: service === 'lightning'
                ? 'Lightning peer port reachable; confirm intentional public node exposure.'
                : service === 'lnd-grpc'
                  ? 'LND gRPC endpoint reachable; public exposure should be treated as critical.'
                  : ''
            };

            return {
              success: Boolean(banner),
              type: 'tcp-service-probe',
              target: safeTarget,
              port,
              service,
              banner,
              bannerLength: data.length,
              mail,
              database,
              lightning
            };
          };

          const send = (cmd) => {
            try { socket.write(cmd); } catch { return false; }
            return true;
          };

          const onConnect = () => {
            if (service === 'smtp' || service === 'smtps' || service === 'submission') {
              setTimeout(() => send('EHLO sysai.local\r\n'), 250);
              setTimeout(() => finish(buildPayload()), 1600);
              return;
            }

            if (service === 'pop3' || service === 'pop3s') {
              setTimeout(() => send('CAPA\r\n'), 250);
              setTimeout(() => finish(buildPayload()), 1600);
              return;
            }

            if (service === 'imap' || service === 'imaps') {
              setTimeout(() => send('a001 CAPABILITY\r\n'), 250);
              setTimeout(() => finish(buildPayload()), 1600);
              return;
            }

            if (service === 'redis') {
              send('PING\r\nINFO server\r\n');
              setTimeout(() => finish(buildPayload()), 1400);
              return;
            }

            if (service === 'postgresql') {
              const sslRequest = Buffer.alloc(8);
              sslRequest.writeInt32BE(8, 0);
              sslRequest.writeInt32BE(80877103, 4);
              try { socket.write(sslRequest); } catch { socket = null; }
              setTimeout(() => finish(buildPayload()), 1400);
              return;
            }

            if (service === 'mongodb') {
              setTimeout(() => finish(buildPayload()), 1400);
              return;
            }

            if (service === 'mysql') {
              setTimeout(() => finish(buildPayload()), 1400);
              return;
            }

            if (service === 'lnd-grpc') {
              setTimeout(() => finish({
                ...buildPayload(),
                success: true,
                lightning: {
                  isLightning: true,
                  tlsReachable: Boolean(socket.getProtocol?.()),
                  tlsProtocol: socket.getProtocol?.() || '',
                  grpcLikely: true,
                  publicCritical: true,
                  operationalNote: 'LND gRPC endpoint accepts TCP connections; public exposure should be treated as critical.'
                }
              }), 1400);
              return;
            }

            if (service === 'lightning') {
              setTimeout(() => finish({
                ...buildPayload(),
                success: true,
                lightning: {
                  isLightning: true,
                  tlsReachable: false,
                  grpcLikely: false,
                  operationalNote: 'Lightning peer port accepts TCP connections; confirm this is intentional for node operations.'
                }
              }), 1400);
              return;
            }

            if (['http-alt', 'grafana', 'prometheus'].includes(service)) {
              send(`GET / HTTP/1.1\r\nHost: ${safeTarget}\r\nConnection: close\r\n\r\n`);
              setTimeout(() => finish(buildPayload()), 1600);
              return;
            }

            setTimeout(() => finish(buildPayload()), 1400);
          };

          const socketOptions = {
            host: safeTarget,
            port,
            servername: safeTarget,
            rejectUnauthorized: false
          };

          socket = isTlsService
            ? tls.connect(socketOptions, onConnect)
            : net.connect({ host: safeTarget, port }, onConnect);

          socket.setTimeout(Math.min(options.timeout || 5000, 10000));

          socket.on('data', (chunk) => {
            chunks.push(chunk);
            data += chunk.toString('utf8');

            if (!['smtp', 'smtps', 'submission', 'pop3', 'pop3s', 'imap', 'imaps'].includes(service)) {
              if (data.length > 0) finish(buildPayload());
            }
          });

          socket.on('timeout', () => finish({
            success: false,
            type: 'tcp-service-probe',
            target: safeTarget,
            port,
            service,
            error: 'Connection timeout or no banner'
          }));

          socket.on('error', (error) => finish({
            success: false,
            type: 'tcp-service-probe',
            target: safeTarget,
            port,
            service,
            error: error.message
          }));

          socket.on('close', () => {
            if (!resolved) finish(buildPayload());
          });
        });

        return result;
      }


      case 'ftp-probe': {
        const net = require('net');
        const port = options.port || 21;

        const result = await new Promise((resolve) => {
          const socket = new net.Socket();
          let banner = '';
          let resolved = false;

          const finish = (payload) => {
            if (resolved) return;
            resolved = true;
            socket.destroy();
            resolve(payload);
          };

          socket.setTimeout(Math.min(options.timeout || 7000, 12000));

          socket.connect(port, safeTarget, () => {});

          socket.on('data', (data) => {
            banner += data.toString('utf8');

            if (banner.includes('\n')) {
              const cleanBanner = banner.trim();

              const lower = cleanBanner.toLowerCase();
              const software =
                lower.includes('vsftpd') ? 'vsftpd' :
                lower.includes('proftpd') ? 'ProFTPD' :
                lower.includes('pure-ftpd') ? 'Pure-FTPd' :
                lower.includes('filezilla') ? 'FileZilla Server' :
                lower.includes('microsoft ftp') ? 'Microsoft FTP' :
                '';

              const versionMatch = cleanBanner.match(/(?:vsftpd|proftpd|pure-ftpd|filezilla|microsoft ftp)[^0-9]*([0-9][0-9a-zA-Z._-]*)/i);

              finish({
                success: true,
                type: 'ftp-probe',
                target: safeTarget,
                port,
                banner: cleanBanner,
                software,
                version: versionMatch?.[1] || '',
                cleartext: true,
                anonymousChecked: false
              });
            }
          });

          socket.on('timeout', () => {
            finish({
              success: false,
              type: 'ftp-probe',
              target: safeTarget,
              port,
              error: 'Connection timeout'
            });
          });

          socket.on('error', (error) => {
            finish({
              success: false,
              type: 'ftp-probe',
              target: safeTarget,
              port,
              error: error.message
            });
          });

          socket.on('close', () => {
            if (!resolved && banner.trim()) {
              finish({
                success: true,
                type: 'ftp-probe',
                target: safeTarget,
                port,
                banner: banner.trim(),
                software: '',
                version: '',
                cleartext: true,
                anonymousChecked: false
              });
            }
          });
        });

        return result;
      }

      case 'ssh-banner': {
        const net = require('net');
        const port = options.port || 22;

        const result = await new Promise((resolve) => {
          const socket = new net.Socket();
          let banner = '';

          socket.setTimeout(Math.min(options.timeout || 5000, 10000));

          socket.connect(port, safeTarget, () => {});

          socket.on('data', (data) => {
            banner += data.toString('utf8');
            socket.destroy();
          });

          socket.on('timeout', () => {
            socket.destroy();
            resolve({
              success: false,
              type: 'ssh-banner',
              target: safeTarget,
              port,
              error: 'Connection timeout'
            });
          });

          socket.on('error', (error) => {
            resolve({
              success: false,
              type: 'ssh-banner',
              target: safeTarget,
              port,
              error: error.message
            });
          });

          socket.on('close', () => {
            if (banner.trim()) {
              const cleanBanner = banner.trim();
              const match = cleanBanner.match(/SSH-\d\.\d-([^\s]+)/);

              resolve({
                success: true,
                type: 'ssh-banner',
                target: safeTarget,
                port,
                banner: cleanBanner,
                software: match?.[1] || '',
                metadataLeak: Boolean(match?.[1])
              });
            }
          });
        });

        return result;
      }

      case 'network-connections': {
        const { execFile } = require('child_process');

        const output = await new Promise((resolve) => {
          execFile('ss', ['-tunp'], { timeout: 5000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
              resolve(stderr || error.message || '');
              return;
            }

            resolve(stdout || '');
          });
        });

        const lines = String(output)
          .split('\n')
          .slice(1)
          .map((line) => line.trim())
          .filter(Boolean);

        const connections = lines.slice(0, 100).map((line) => {
          const parts = line.split(/\s+/);

          return {
            netid: parts[0] || '',
            state: parts[1] || '',
            recvQ: parts[2] || '',
            sendQ: parts[3] || '',
            local: parts[4] || '',
            peer: parts[5] || '',
            process: parts.slice(6).join(' ')
          };
        });

        return {
          success: true,
          type: 'network-connections',
          connections,
          timestamp: Date.now()
        };
      }

      case 'network-stats': {
        const fs = require('fs');
        const raw = fs.readFileSync('/proc/net/dev', 'utf8');

        const interfaces = raw
          .split('\n')
          .slice(2)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const [ifacePart, dataPart] = line.split(':');
            const values = dataPart.trim().split(/\s+/).map(Number);

            return {
              interface: ifacePart.trim(),
              rxBytes: values[0],
              rxPackets: values[1],
              txBytes: values[8],
              txPackets: values[9]
            };
          })
          .filter((item) => item.interface !== 'lo');

        return {
          success: true,
          type: 'network-stats',
          interfaces,
          timestamp: Date.now()
        };
      }


      case 'advanced-http-probe': {
        devLog(`[SysAI] Scan: advanced-http-probe → ${safeTarget}`);

        const protocol = options.protocol || 'https';
        const port = options.port || (protocol === 'https' ? 443 : 80);

        const url = `${protocol}://${safeTarget}${port === 80 || port === 443 ? '' : `:${port}`}`;

        try {
          const headers = {
            'User-Agent': 'SysAI-Infrastructure-Intelligence/2.0'
          };

          const redirectChain = [];
          let currentUrl = url;
          let response = null;

          for (let depth = 0; depth < 6; depth += 1) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), Math.min(options.timeout || 10000, 12000));
            response = await fetch(currentUrl, {
              method: 'GET',
              redirect: 'manual',
              signal: controller.signal,
              headers
            });
            clearTimeout(timeout);

            const location = response.headers.get('location');
            if (![301, 302, 303, 307, 308].includes(response.status) || !location) {
              break;
            }

            const nextUrl = new URL(location, currentUrl).toString();
            redirectChain.push({
              status: response.status,
              from: currentUrl,
              to: nextUrl
            });
            currentUrl = nextUrl;
          }

          const html = await response.text();

          const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
          const cleanTitle = titleMatch?.[1]?.replace(/\s+/g, ' ').trim() || '';

          const adminPaths = [
            '/login',
            '/admin',
            '/wp-login.php',
            '/wp-admin/',
            '/grafana/login',
            '/portainer/',
            '/phpmyadmin/',
            '/graph',
            '/metrics'
          ];
          const adminHints = [];

          for (const pathName of adminPaths) {
            try {
              const checkUrl = new URL(pathName, currentUrl).toString();
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 3500);
              const pathResponse = await fetch(checkUrl, {
                method: 'HEAD',
                redirect: 'manual',
                signal: controller.signal,
                headers
              });
              clearTimeout(timeout);

              if (pathResponse.status > 0 && pathResponse.status < 500 && pathResponse.status !== 404) {
                adminHints.push({
                  path: pathName,
                  status: pathResponse.status
                });
              }
            } catch {
              continue;
            }
          }

          const fingerprint = {
            wordpress: /wp-content|wordpress/i.test(html),
            grafana: /grafana-app|grafana/i.test(html),
            prometheus: /prometheus|prometheus_build_info|<title>prometheus/i.test(html),
            nextcloud: /nextcloud/i.test(html),
            phpmyadmin: /phpmyadmin/i.test(html),
            portainer: /portainer/i.test(html),
            lnbits: /lnbits/i.test(html),
            wordpressAdmin: /wp-login\.php|wp-admin/i.test(html),
            joomla: /joomla|\/media\/system\/js/i.test(html),
            drupal: /drupal|\/sites\/default\/|drupal-settings-json/i.test(html),
            laravel: /laravel|laravel_session/i.test(html),
            express: /express/i.test(response.headers.get('x-powered-by') || ''),
            loginPanel: /login|signin|auth/i.test(html),
            adminPath: adminHints.some((item) => /login|admin|wp-login|grafana|portainer|phpmyadmin|metrics|graph/i.test(item.path)),
          };

          devLog('[SysAI] Advanced probe success:', {
            title: cleanTitle,
            status: response.status,
            finalUrl: response.url,
            htmlLength: html.length,
            fingerprint
          });

          return {
            success: true,
            type: 'advanced-http-probe',
            url,
            status: response.status,
            finalUrl: response.url,
            title: cleanTitle,
            htmlLength: html.length,
            responseSize: html.length,
            redirectChain,
            adminHints,
            fingerprint,
            headers: Object.fromEntries(response.headers.entries()),
            htmlSample: html.slice(0, 120000)
          };
        } catch (error) {
          devLog('[SysAI] Advanced probe failed:', error.message);

          return {
            success: false,
            type: 'advanced-http-probe',
            url,
            error: error.message
          };
        }
      }

      case 'http-headers': {
        const protocol = options.protocol || 'https';
        const port = options.port || (protocol === 'https' ? 443 : 80);
        const url = `${protocol}://${safeTarget}${port === 80 || port === 443 ? '' : `:${port}`}`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), Math.min(options.timeout || 5000, 10000));

        try {
          const response = await fetch(url, {
            method: 'GET',
            redirect: 'manual',
            signal: controller.signal,
            headers: {
              'User-Agent': 'SysAI-Infrastructure-Intelligence/1.0'
            }
          });

          clearTimeout(timeout);

          const headers = {};
          response.headers.forEach((value, key) => {
            headers[key] = value;
          });

          return {
            success: true,
            type: 'http-headers',
            target: safeTarget,
            url,
            status: response.status,
            statusText: response.statusText,
            headers
          };
        } catch (error) {
          clearTimeout(timeout);
          return {
            success: false,
            type: 'http-headers',
            target: safeTarget,
            url,
            error: error.message
          };
        }
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

ipcMain.handle('get-proxy-session-token', () => {
  return { success: true, token: proxySessionToken };
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
  if (typeof url === 'string' && isSafeExternalUrl(url)) {
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
