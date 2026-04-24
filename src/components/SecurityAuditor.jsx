import { useState } from "react";
import { portScan, tlsCheck, sshAudit } from "../utils/scanners";

const SecurityAuditor = ({ t, onAudit, onScan, onBack }) => {
  const [mode, setMode] = useState(0);
  const [inputType, setInputType] = useState(0);
  const [sourceText, setSourceText] = useState("");
  const [targetHost, setTargetHost] = useState("");
  const [scanType, setScanType] = useState("ports");
  const [scanPorts, setScanPorts] = useState("22,80,443,3306,5432");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);

  const handleAudit = async () => {
    if (mode === 0 && !sourceText.trim()) return;
    if (mode === 1 && !targetHost.trim()) return;
    
    setAnalyzing(true);
    let response;
    
    if (mode === 0) {
      const inputTypeName = t.securityAuditorPage.types[inputType];
      response = await onAudit(inputTypeName, sourceText);
    } else {
      try {
        let scanResult;
        if (scanType === "ports") {
          scanResult = await portScan(targetHost, { ports: scanPorts });
          if (scanResult.success) {
            response = await onScan(targetHost, scanType, scanResult.output);
          } else {
            response = { report: `Errore scan: ${scanResult.error}`, recommendations: "Verifica che il target sia raggiungibile" };
          }
        } else if (scanType === "ssl") {
          scanResult = await tlsCheck(targetHost, 443);
          if (scanResult.success) {
            const output = formatTlsCheck(scanResult);
            response = await onScan(targetHost, scanType, output);
          } else {
            response = { report: `Errore TLS: ${scanResult.error}`, recommendations: "Verifica che il target supporti HTTPS" };
          }
        } else if (scanType === "ssh") {
          scanResult = await sshAudit(targetHost, 22);
          if (scanResult.success) {
            response = await onScan(targetHost, scanType, scanResult.output);
          } else {
            response = { report: `Errore SSH: ${scanResult.output}`, recommendations: "Verifica che il target abbia SSH sulla porta 22" };
          }
        }
      } catch (error) {
        response = { report: `Errore: ${error.message}`, recommendations: "Riprova più tardi" };
      }
    }
    
    setResult(response);
    setAnalyzing(false);
  };

  const formatTlsCheck = (result) => {
    let output = `TLS Check for ${result.host}:${result.port}\n`;
    output += `Protocol: ${result.protocol || 'N/A'}\n`;
    output += `Cipher: ${result.cipher?.name || 'N/A'} (${result.cipher?.bits || '?'} bits)\n`;
    if (result.certificate) {
      output += `Certificate: ${result.certificate.subject?.CN || 'N/A'}\n`;
      output += `Valid until: ${result.certificate.valid_to || 'N/A'}\n`;
    }
    if (result.warnings?.length) {
      output += `Warnings: ${result.warnings.join(', ')}\n`;
    }
    return output;
  };

  return (
    <div>
      <button onClick={onBack} style={{
        background: "none", border: "none", color: "#8B95A8", cursor: "pointer",
        fontSize: 13, marginBottom: 16,
      }}>← {t.home}</button>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>
        🛡️ {t.securityAuditorPage.title}
      </h2>
      <p style={{ color: "#8B95A8", fontSize: 14, marginBottom: 20 }}>{t.securityAuditorPage.subtitle}</p>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#8B95A8", marginBottom: 8, display: "block" }}>
          Modalità
        </label>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={() => setMode(0)} style={{
            flex: 1, padding: "10px", borderRadius: 8, fontSize: 13, fontWeight: 500,
            background: mode === 0 ? "#00D4AA" : "#1A1F2E",
            color: mode === 0 ? "#0B0E14" : "#8B95A8",
            border: `1px solid ${mode === 0 ? "#00D4AA" : "#1E2535"}`,
            cursor: "pointer",
          }}>📄 Analisi Configurazione</button>
          <button onClick={() => setMode(1)} style={{
            flex: 1, padding: "10px", borderRadius: 8, fontSize: 13, fontWeight: 500,
            background: mode === 1 ? "#00D4AA" : "#1A1F2E",
            color: mode === 1 ? "#0B0E14" : "#8B95A8",
            border: `1px solid ${mode === 1 ? "#00D4AA" : "#1E2535"}`,
            cursor: "pointer",
          }}>🌐 Scan Remoto</button>
        </div>
      </div>

      {mode === 0 && (
        <>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#8B95A8", marginBottom: 8, display: "block" }}>
              {t.securityAuditorPage.typeLabel}
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {t.securityAuditorPage.types.map((type, i) => (
                <button key={type} onClick={() => setInputType(i)} style={{
                  padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500,
                  background: inputType === i ? "#00D4AA" : "#1A1F2E",
                  color: inputType === i ? "#0B0E14" : "#8B95A8",
                  border: `1px solid ${inputType === i ? "#00D4AA" : "#1E2535"}`,
                  cursor: "pointer",
                }}>{type}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#8B95A8", marginBottom: 8, display: "block" }}>
              {t.securityAuditorPage.sourceLabel}
            </label>
            <textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder={t.securityAuditorPage.placeholder}
              style={{
                width: "100%", height: 180, padding: 16, borderRadius: 12,
                background: "#131720", border: "1px solid #1E2535",
                color: "#E8ECF4", fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
                resize: "vertical",
              }}
            />
          </div>
        </>
      )}

      {mode === 1 && (
        <>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#8B95A8", marginBottom: 8, display: "block" }}>
              🔍 Tipo di Scan
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setScanType("ports")} style={{
                flex: 1, padding: "8px", borderRadius: 8, fontSize: 12,
                background: scanType === "ports" ? "#00D4AA" : "#1A1F2E",
                color: scanType === "ports" ? "#0B0E14" : "#8B95A8",
                border: `1px solid ${scanType === "ports" ? "#00D4AA" : "#1E2535"}`,
                cursor: "pointer",
              }}>🔌 Porte (nmap)</button>
              <button onClick={() => setScanType("ssl")} style={{
                flex: 1, padding: "8px", borderRadius: 8, fontSize: 12,
                background: scanType === "ssl" ? "#00D4AA" : "#1A1F2E",
                color: scanType === "ssl" ? "#0B0E14" : "#8B95A8",
                border: `1px solid ${scanType === "ssl" ? "#00D4AA" : "#1E2535"}`,
                cursor: "pointer",
              }}>🔒 SSL/TLS (sslscan)</button>
              <button onClick={() => setScanType("ssh")} style={{
                flex: 1, padding: "8px", borderRadius: 8, fontSize: 12,
                background: scanType === "ssh" ? "#00D4AA" : "#1A1F2E",
                color: scanType === "ssh" ? "#0B0E14" : "#8B95A8",
                border: `1px solid ${scanType === "ssh" ? "#00D4AA" : "#1E2535"}`,
                cursor: "pointer",
              }}>🖥️ SSH (ssh-audit)</button>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#8B95A8", marginBottom: 8, display: "block" }}>
              🌐 IP o Dominio
            </label>
            <input
              value={targetHost}
              onChange={(e) => setTargetHost(e.target.value)}
              placeholder="es. 192.168.1.1 o example.com"
              style={{
                width: "100%", padding: "12px 16px", borderRadius: 12,
                background: "#131720", border: "1px solid #1E2535",
                color: "#E8ECF4", fontSize: 14,
              }}
            />
          </div>

          {scanType === "ports" && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#8B95A8", marginBottom: 8, display: "block" }}>
                🔌 Porte (separate da virgola)
              </label>
              <input
                value={scanPorts}
                onChange={(e) => setScanPorts(e.target.value)}
                placeholder="22,80,443,3306,5432"
                style={{
                  width: "100%", padding: "12px 16px", borderRadius: 12,
                  background: "#131720", border: "1px solid #1E2535",
                  color: "#E8ECF4", fontSize: 14,
                }}
              />
            </div>
          )}
        </>
      )}

      <button onClick={handleAudit} style={{
        marginTop: 12, padding: "12px 28px", background: "#00D4AA", color: "#0B0E14",
        border: "none", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer",
      }}>
        {analyzing ? t.securityAuditorPage.analyzing : t.securityAuditorPage.analyze}
      </button>

      {result && (
        <div style={{ marginTop: 24, animation: "slideInRight 0.3s ease" }}>
          <div style={{
            background: "#131720", border: "1px solid #00D4AA33", borderRadius: 12,
            overflow: "hidden",
          }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 16px", background: "#00D4AA22",
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#00D4AA" }}>
                {mode === 0 ? "🛡️ AUDIT REPORT" : "📡 SCAN REPORT"}
              </span>
              <button onClick={() => navigator.clipboard.writeText(result.report)} style={{
                background: "none", border: "1px solid #00D4AA44", borderRadius: 6,
                color: "#00D4AA", padding: "4px 12px", fontSize: 11, cursor: "pointer",
              }}>📋 Copy</button>
            </div>
            <pre style={{
              padding: 20, fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
              color: "#E8ECF4", whiteSpace: "pre-wrap", overflowX: "auto",
              maxHeight: 500, overflowY: "auto",
            }}>{result.report}</pre>
          </div>
          {result.recommendations && (
            <div style={{
              background: "#131720", border: "1px solid #FF4D6A33", borderRadius: 12,
              padding: 16, marginTop: 12,
            }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, color: "#FF4D6A", marginBottom: 8 }}>⚠️ RECOMMENDATIONS</h4>
              <p style={{ fontSize: 13, color: "#8B95A8", lineHeight: 1.5 }}>{result.recommendations}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SecurityAuditor;
