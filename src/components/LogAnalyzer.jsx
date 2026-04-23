import { useState } from "react";

const LogAnalyzer = ({ t, onAnalyze, onBack }) => {
  const [logText, setLogText] = useState("");
  const [selectedService, setSelectedService] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);

  const handleAnalyze = async () => {
    if (!logText.trim()) return;
    setAnalyzing(true);
    const response = await onAnalyze(logText, selectedService);
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
        {t.modes.logAnalyzer.icon} {t.logAnalyzerPage.title}
      </h2>
      <p style={{ color: "#8B95A8", fontSize: 14, marginBottom: 20 }}>{t.logAnalyzerPage.subtitle}</p>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#8B95A8", marginBottom: 8, display: "block" }}>
          {t.logAnalyzerPage.serviceLabel}
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {t.logAnalyzerPage.services.map((s, i) => (
            <button key={s} onClick={() => setSelectedService(i)} style={{
              padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500,
              background: selectedService === i ? "#00D4AA" : "#1A1F2E",
              color: selectedService === i ? "#0B0E14" : "#8B95A8",
              border: `1px solid ${selectedService === i ? "#00D4AA" : "#1E2535"}`,
              cursor: "pointer",
            }}>{s}</button>
          ))}
        </div>
      </div>

      <textarea
        value={logText}
        onChange={(e) => setLogText(e.target.value)}
        placeholder="Paste your log here or drag & drop a file..."
        style={{
          width: "100%", height: 180, padding: 16, borderRadius: 12,
          background: "#131720", border: "2px dashed #1E2535",
          color: "#E8ECF4", fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
          resize: "vertical",
        }}
        onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "#00D4AA"; }}
        onDragLeave={(e) => { e.currentTarget.style.borderColor = "#1E2535"; }}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file && (file.name.endsWith(".log") || file.name.endsWith(".txt"))) {
            const reader = new FileReader();
            reader.onload = (event) => setLogText(event.target.result);
            reader.readAsText(file);
          }
          e.currentTarget.style.borderColor = "#1E2535";
        }}
      />

      <button onClick={handleAnalyze} style={{
        marginTop: 12, padding: "12px 28px", background: "#00D4AA", color: "#0B0E14",
        border: "none", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer",
      }}>
        {analyzing ? t.logAnalyzerPage.analyzing : t.logAnalyzerPage.analyze}
      </button>

      {result && (
        <div style={{ marginTop: 24 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px",
            borderRadius: 8, background: result.severity === "HIGH" || result.severity === "CRITICAL" ? "#FF4D6A15" : "#00D4AA22",
            marginBottom: 16,
          }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: result.severity === "HIGH" || result.severity === "CRITICAL" ? "#FF4D6A" : "#00D4AA" }} />
            <span style={{ color: result.severity === "HIGH" || result.severity === "CRITICAL" ? "#FF4D6A" : "#00D4AA", fontWeight: 700, fontSize: 13 }}>
              {result.severity || "INFO"}
            </span>
          </div>
          <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>{result.title}</h3>
          <div style={{
            background: "#131720", border: "1px solid #1E2535", borderRadius: 12,
            padding: 20, marginBottom: 16,
          }}>
            <p style={{ fontSize: 14, color: "#8B95A8", whiteSpace: "pre-wrap" }}>{result.explanation}</p>
          </div>
          {result.fix && result.fix !== "N/A" && (
            <div style={{
              background: "#131720", border: "1px solid #00D4AA33", borderRadius: 12,
              overflow: "hidden",
            }}>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 16px", background: "#00D4AA22",
              }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#00D4AA" }}>FIX</span>
                <button onClick={() => navigator.clipboard.writeText(result.fix)} style={{
                  background: "none", border: "1px solid #00D4AA44", borderRadius: 6,
                  color: "#00D4AA", padding: "4px 12px", fontSize: 11, cursor: "pointer",
                }}>📋 Copy</button>
              </div>
              <pre style={{
                padding: 20, fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
                color: "#E8ECF4", whiteSpace: "pre-wrap",
              }}>{result.fix}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LogAnalyzer;
