import { useState } from "react";

const SecurityAuditor = ({ t, onAudit, onBack }) => {
  const [inputType, setInputType] = useState(0);
  const [sourceText, setSourceText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);

  const handleAudit = async () => {
    if (!sourceText.trim()) return;
    setAnalyzing(true);
    const inputTypeName = t.securityAuditorPage.types[inputType];
    const response = await onAudit(inputTypeName, sourceText);
    setResult(response);
    setAnalyzing(false);
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
              <span style={{ fontSize: 12, fontWeight: 600, color: "#00D4AA" }}>🛡️ AUDIT REPORT</span>
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
