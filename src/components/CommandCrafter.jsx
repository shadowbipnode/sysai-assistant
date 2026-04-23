import { useState } from "react";

const CommandCrafter = ({ t, onCraft, onBack }) => {
  const [cmdText, setCmdText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);

  const handleCraft = async () => {
    if (!cmdText.trim()) return;
    setAnalyzing(true);
    const response = await onCraft(cmdText);
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
        {t.modes.commandCrafter.icon} {t.commandCrafterPage.title}
      </h2>
      <p style={{ color: "#8B95A8", fontSize: 14, marginBottom: 20 }}>{t.commandCrafterPage.subtitle}</p>

      <div style={{ display: "flex", gap: 10 }}>
        <input
          value={cmdText}
          onChange={(e) => setCmdText(e.target.value)}
          placeholder={t.commandCrafterPage.placeholder}
          style={{
            flex: 1, padding: "14px 16px", borderRadius: 12,
            background: "#131720", border: "1px solid #1E2535", color: "#E8ECF4",
            fontSize: 14,
          }}
        />
        <button onClick={handleCraft} style={{
          padding: "12px 24px", background: "#00D4AA", color: "#0B0E14",
          border: "none", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer",
        }}>
          {analyzing ? t.commandCrafterPage.crafting : t.commandCrafterPage.craft}
        </button>
      </div>

      {result && (
        <div style={{ marginTop: 24 }}>
          <div style={{
            background: "#131720", border: "1px solid #00D4AA33", borderRadius: 12,
            overflow: "hidden", marginBottom: 16,
          }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 16px", background: "#00D4AA22",
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#00D4AA" }}>COMMAND</span>
              <button onClick={() => navigator.clipboard.writeText(result.command)} style={{
                background: "none", border: "1px solid #00D4AA44", borderRadius: 6,
                color: "#00D4AA", padding: "4px 12px", fontSize: 11, cursor: "pointer",
              }}>📋 Copy</button>
            </div>
            <pre style={{
              padding: 20, fontFamily: "'JetBrains Mono', monospace", fontSize: 14,
              color: "#00D4AA", fontWeight: 600, overflowX: "auto",
            }}>{result.command}</pre>
          </div>
          {result.explanation && (
            <div style={{
              background: "#131720", border: "1px solid #1E2535", borderRadius: 12,
              padding: 20,
            }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, color: "#8B95A8", marginBottom: 12 }}>📖 Explanation</h4>
              <p style={{ fontSize: 14, color: "#8B95A8", whiteSpace: "pre-wrap" }}>{result.explanation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CommandCrafter;
