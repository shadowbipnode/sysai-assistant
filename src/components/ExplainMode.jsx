import { useState } from "react";

const ExplainMode = ({ t, onExplain, onBack }) => {
  const [command, setCommand] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);

  const handleExplain = async () => {
    if (!command.trim()) return;
    setAnalyzing(true);
    const response = await onExplain(command);
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
        🔍 {t.explainPage.title}
      </h2>
      <p style={{ color: "#8B95A8", fontSize: 14, marginBottom: 20 }}>{t.explainPage.subtitle}</p>

      <textarea
        value={command}
        onChange={(e) => setCommand(e.target.value)}
        placeholder={t.explainPage.placeholder}
        style={{
          width: "100%", height: 150, padding: 16, borderRadius: 12,
          background: "#131720", border: "1px solid #1E2535",
          color: "#E8ECF4", fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
          resize: "vertical",
        }}
      />

      <button onClick={handleExplain} style={{
        marginTop: 12, padding: "12px 28px", background: "#00D4AA", color: "#0B0E14",
        border: "none", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer",
      }}>
        {analyzing ? t.explainPage.analyzing : t.explainPage.analyze}
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
              <span style={{ fontSize: 12, fontWeight: 600, color: "#00D4AA" }}>📖 EXPLANATION</span>
              <button onClick={() => navigator.clipboard.writeText(result.explanation)} style={{
                background: "none", border: "1px solid #00D4AA44", borderRadius: 6,
                color: "#00D4AA", padding: "4px 12px", fontSize: 11, cursor: "pointer",
              }}>📋 Copy</button>
            </div>
            <div style={{ padding: 20 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, color: "#00D4AA", marginBottom: 12 }}>Summary</h4>
              <p style={{ fontSize: 13, color: "#8B95A8", marginBottom: 16, lineHeight: 1.5 }}>{result.summary}</p>
              
              <h4 style={{ fontSize: 14, fontWeight: 600, color: "#00D4AA", marginBottom: 12 }}>Line by Line</h4>
              <div style={{ background: "#0B0E14", borderRadius: 8, overflow: "hidden" }}>
                {result.lines?.map((line, i) => (
                  <div key={i} style={{
                    padding: "10px 16px",
                    borderBottom: i < result.lines.length - 1 ? "1px solid #1E2535" : "none",
                  }}>
                    <code style={{ display: "block", fontSize: 12, color: "#00D4AA", marginBottom: 4 }}>{line.line}</code>
                    <span style={{ fontSize: 12, color: "#8B95A8" }}>{line.explanation}</span>
                  </div>
                ))}
              </div>
              
              {result.risks && (
                <>
                  <h4 style={{ fontSize: 14, fontWeight: 600, color: "#FF4D6A", marginTop: 16, marginBottom: 8 }}>⚠️ Risks</h4>
                  <p style={{ fontSize: 13, color: "#8B95A8", lineHeight: 1.5 }}>{result.risks}</p>
                </>
              )}
              
              {result.improvements && (
                <>
                  <h4 style={{ fontSize: 14, fontWeight: 600, color: "#00D4AA", marginTop: 16, marginBottom: 8 }}>💡 Improvements</h4>
                  <p style={{ fontSize: 13, color: "#8B95A8", lineHeight: 1.5 }}>{result.improvements}</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExplainMode;
