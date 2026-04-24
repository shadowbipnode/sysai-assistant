import { useState } from "react";

const Troubleshooter = ({ t, onDiagnose, onBack }) => {
  const [problem, setProblem] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);

  const handleDiagnose = async () => {
    if (!problem.trim()) return;
    setAnalyzing(true);
    const response = await onDiagnose(problem, []);
    setResult(response);
    setAnalyzing(false);
  };

  return (
    <div>
      <button onClick={onBack} style={{
        background: "none", border: "none", color: "#8B95A8", cursor: "pointer",
        fontSize: 13, marginBottom: 16,
      }}>← {t.home}</button>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>🔧 {t.troubleshootPage.title}</h2>
      <p style={{ color: "#8B95A8", fontSize: 14, marginBottom: 20 }}>{t.troubleshootPage.subtitle}</p>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#8B95A8", marginBottom: 8, display: "block" }}>
          {t.troubleshootPage.startLabel}
        </label>
        <textarea
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
          placeholder={t.troubleshootPage.placeholder}
          style={{
            width: "100%", height: 120, padding: 16, borderRadius: 12,
            background: "#131720", border: "1px solid #1E2535",
            color: "#E8ECF4", fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
            resize: "vertical",
          }}
        />
      </div>

      <button onClick={handleDiagnose} style={{
        padding: "12px 28px", background: "#00D4AA", color: "#0B0E14",
        border: "none", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer",
      }}>
        {analyzing ? t.troubleshootPage.diagnosing : t.troubleshootPage.start}
      </button>

      {result && (
        <div style={{ marginTop: 24, animation: "slideInRight 0.3s ease" }}>
          <div style={{
            background: "#131720", border: "1px solid #00D4AA33", borderRadius: 12,
            padding: 20,
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: "#00D4AA" }}>
              🎯 {t.troubleshootPage.solution}
            </h3>
            <p style={{ fontSize: 14, color: "#E8ECF4", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
              {result.diagnosis || result.explanation || "Nessuna diagnosi disponibile"}
            </p>
            {result.check_command && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: "#00D4AA", marginBottom: 4 }}>🔍 Verifica:</div>
                <code style={{ background: "#0B0E14", padding: 8, borderRadius: 6, display: "block", fontSize: 12 }}>{result.check_command}</code>
              </div>
            )}
            {result.fix && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: "#00D4AA", marginBottom: 4 }}>🛠️ Fix:</div>
                <pre style={{ background: "#0B0E14", padding: 12, borderRadius: 6, fontSize: 12, overflowX: "auto" }}>{result.fix}</pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Troubleshooter;
