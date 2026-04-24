/**
 * SysAI - Scanner Client Utilities
 * 
 * Gestisce le chiamate scan sia via IPC (Electron) che via proxy HTTP.
 * L'app tenta prima IPC, poi fallback al proxy.
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

  // Fallback: proxy HTTP (per dev mode)
  const res = await fetch('http://127.0.0.1:3001/api/port-scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host: target, ports, timeout }),
  });
  return res.json();
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

  const res = await fetch('http://127.0.0.1:3001/api/tls-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host: target, port }),
  });
  return res.json();
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

  const res = await fetch('http://127.0.0.1:3001/api/ssh-audit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host: target, port }),
  });
  return res.json();
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
