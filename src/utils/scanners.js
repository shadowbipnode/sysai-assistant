/**
 * SysAI - Scanner Client Utilities
 * 
 * Gestisce le chiamate scan via IPC Electron.
 * Gli scanner sono disponibili solo nell'app Electron packaged/dev,
 * non nel browser puro, per ridurre la superficie HTTP locale.
 */

// ============================================================
// DETECT ENVIRONMENT
// ============================================================
const isElectron = () => {
  return window.electron?.ipcRenderer?.invoke !== undefined;
};

// ============================================================
// PORT SCAN
// ============================================================
export async function portScan(target, options = {}) {
  const { ports, timeout } = options;

  if (isElectron()) {
    // Via IPC (più sicuro, scan nativo Node.js)
    return window.electron.ipcRenderer.invoke('run-scan', {
      type: 'port-scan',
      target,
      options: { ports, timeout },
    });
  }

  throw new Error('Port scan is only available in the Electron app.');
}

// ============================================================
// TLS/SSL CHECK
// ============================================================
export async function tlsCheck(target, port = 443) {
  if (isElectron()) {
    return window.electron.ipcRenderer.invoke('run-scan', {
      type: 'tls-check',
      target,
      options: { port },
    });
  }

  throw new Error('TLS check is only available in the Electron app.');
}

// ============================================================
// SSH AUDIT
// ============================================================
export async function sshAudit(target, port = 22) {
  if (isElectron()) {
    return window.electron.ipcRenderer.invoke('run-scan', {
      type: 'ssh-audit',
      target,
      options: { port },
    });
  }

  throw new Error('SSH audit is only available in the Electron app.');
}

// ============================================================
// HTTP HEADERS / FINGERPRINT CHECK
// ============================================================
export async function httpHeadersCheck(target, options = {}) {
  if (isElectron()) {
    return window.electron.ipcRenderer.invoke('run-scan', {
      type: 'http-headers',
      target,
      options,
    });
  }

  throw new Error('HTTP headers check is only available in the Electron app.');
}

// ============================================================
// ALL SCANS (run all 3 in parallel)
// ============================================================
export async function fullScan(target, options = {}) {
  const [ports, tls, ssh] = await Promise.allSettled([
    portScan(target, options),
    tlsCheck(target, options.tlsPort || 443),
    sshAudit(target, options.sshPort || 22),
  ]);

  return {
    portScan: ports.status === 'fulfilled' ? ports.value : { success: false, error: ports.reason?.message },
    tlsCheck: tls.status === 'fulfilled' ? tls.value : { success: false, error: tls.reason?.message },
    sshAudit: ssh.status === 'fulfilled' ? ssh.value : { success: false, error: ssh.reason?.message },
  };
}

// ============================================================
// FORMAT HELPERS (per visualizzare i risultati nella UI)
// ============================================================

export function formatPortResults(results) {
  if (!results?.results) return 'Nessun risultato';

  const open = results.results.filter(r => r.status === 'open');
  const closed = results.results.filter(r => r.status === 'closed');
  const filtered = results.results.filter(r => r.status === 'filtered');

  let output = `Port Scan: ${results.target}\n`;
  output += `═══════════════════════════════════════\n`;
  output += `Open: ${open.length} | Closed: ${closed.length} | Filtered: ${filtered.length}\n\n`;

  if (open.length > 0) {
    output += `PORT      STATE   SERVICE       BANNER\n`;
    output += `────────  ──────  ────────────  ──────────\n`;
    open.forEach(r => {
      const port = String(r.port).padEnd(8);
      const state = 'open'.padEnd(8);
      const service = (r.service || 'unknown').padEnd(14);
      const banner = r.banner || '';
      output += `${port}${state}${service}${banner}\n`;
    });
  }

  return output;
}

export function formatTlsResults(result) {
  if (!result?.success) return `TLS Check failed: ${result?.error || 'unknown error'}`;

  let output = `TLS/SSL Check: ${result.host}:${result.port}\n`;
  output += `═══════════════════════════════════════\n\n`;
  output += `Protocol:    ${result.protocol}\n`;
  output += `Cipher:      ${result.cipher?.name} (${result.cipher?.bits || '?'} bits)\n`;
  output += `Trusted:     ${result.certificate?.authorized ? '✓ Yes' : '✗ No'}\n`;
  output += `Self-signed: ${result.certificate?.selfSigned ? '⚠ Yes' : '✓ No'}\n`;

  if (result.certificate) {
    const cert = result.certificate;
    output += `\nCertificate:\n`;
    output += `  Subject:     ${cert.subject?.CN || 'N/A'}\n`;
    output += `  Issuer:      ${cert.issuer?.O || cert.issuer?.CN || 'N/A'}\n`;
    output += `  Valid from:  ${cert.valid_from}\n`;
    output += `  Valid to:    ${cert.valid_to}\n`;
    output += `  Days left:   ${cert.days_remaining ?? 'N/A'}\n`;
    output += `  Fingerprint: ${cert.fingerprint256?.substring(0, 40)}...\n`;
  }

  if (result.warnings?.length > 0) {
    output += `\n⚠ Warnings:\n`;
    result.warnings.forEach(w => { output += `  - ${w}\n`; });
  }

  output += `\nHandshake time: ${result.elapsed_ms}ms\n`;
  return output;
}

// ============================================================
// NETWORK STATS
// ============================================================
export async function networkStats() {
  if (isElectron()) {
    return window.electron.ipcRenderer.invoke('run-scan', {
      type: 'network-stats',
      target: 'localhost',
      options: {},
    });
  }

  throw new Error('Network stats are only available in the Electron app.');
}

// ============================================================
// NETWORK CONNECTIONS
// ============================================================
export async function networkConnections() {
  if (isElectron()) {
    return window.electron.ipcRenderer.invoke('run-scan', {
      type: 'network-connections',
      target: 'localhost',
      options: {},
    });
  }

  throw new Error('Network connections are only available in the Electron app.');
}

// ADVANCED HTTP PROBE
export async function advancedHttpProbe(target, options = {}) {
  return window.electron.ipcRenderer.invoke('run-scan', {
    type: 'advanced-http-probe',
    target,
    options
  });
}


// SSH AUDIT
export async function sshAuditProbe(target, port = 22) {
  return window.electron.ipcRenderer.invoke('run-scan', {
    type: 'ssh-audit',
    target,
    options: { port }
  });
}

// SSH BANNER
export async function sshBanner(target, port = 22) {
  return window.electron.ipcRenderer.invoke('run-scan', {
    type: 'ssh-banner',
    target,
    options: { port }
  });
}
