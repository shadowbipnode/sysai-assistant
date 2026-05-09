import { useState } from "react";
import ProfessionalResult from "./ProfessionalResult";

const ScriptBuilder = ({ t, onGenerate, onBack }) => {
  const [scriptType, setScriptType] = useState(0);
  const [description, setDescription] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);

  const downloadTextFile = (filename, content, mimeType = "text/plain") => {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename || "script.sh";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const normalizeScriptFilename = (filename, selectedType) => {
    const fallbackExt =
      /python/i.test(selectedType) ? "py" :
      /powershell/i.test(selectedType) ? "ps1" :
      /node|javascript/i.test(selectedType) ? "js" :
      "sh";

    const safeName = String(filename || `script.${fallbackExt}`)
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/^_+/, "");

    if (/\.[a-zA-Z0-9]+$/.test(safeName)) return safeName;
    return `${safeName}.${fallbackExt}`;
  };

  const exportScriptFile = () => {
    if (!result?.script) return;
    const selectedType = t.scriptBuilderPage.types[scriptType] || "bash";
    const filename = normalizeScriptFilename(result.filename, selectedType);
    downloadTextFile(filename, result.script, "text/plain");
  };

  const handleGenerate = async () => {
    if (!description.trim()) return;
    setAnalyzing(true);
    const scriptTypeName = t.scriptBuilderPage.types[scriptType];
    const response = await onGenerate(scriptTypeName, description);
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
        📜 {t.scriptBuilderPage.title}
      </h2>
      <p style={{ color: "#8B95A8", fontSize: 14, marginBottom: 20 }}>{t.scriptBuilderPage.subtitle}</p>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#8B95A8", marginBottom: 8, display: "block" }}>
          {t.scriptBuilderPage.typeLabel}
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {t.scriptBuilderPage.types.map((type, i) => (
            <button key={type} onClick={() => setScriptType(i)} style={{
              padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500,
              background: scriptType === i ? "#00D4AA" : "#1A1F2E",
              color: scriptType === i ? "#0B0E14" : "#8B95A8",
              border: `1px solid ${scriptType === i ? "#00D4AA" : "#1E2535"}`,
              cursor: "pointer",
            }}>{type}</button>
          ))}
        </div>
      </div>

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe what you want the script to do..."
        style={{
          width: "100%", height: 120, padding: 16, borderRadius: 12,
          background: "#131720", border: "1px solid #1E2535",
          color: "#E8ECF4", fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
          resize: "vertical",
        }}
      />

      <button onClick={handleGenerate} style={{
        marginTop: 12, padding: "12px 28px", background: "#00D4AA", color: "#0B0E14",
        border: "none", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer",
      }}>
        {analyzing ? t.scriptBuilderPage.generating : t.scriptBuilderPage.generate}
      </button>

      {result && result.script && (
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
                📄 {result.filename || "script.sh"}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={exportScriptFile} style={{
                  background: "none", border: "1px solid #38BDF844", borderRadius: 6,
                  color: "#38BDF8", padding: "4px 12px", fontSize: 11, cursor: "pointer",
                }}>⬇ Export file</button>
                <button onClick={() => navigator.clipboard.writeText(result.script)} style={{
                  background: "none", border: "1px solid #00D4AA44", borderRadius: 6,
                  color: "#00D4AA", padding: "4px 12px", fontSize: 11, cursor: "pointer",
                }}>📋 Copy</button>
              </div>
            </div>
            <pre style={{
              padding: 20, fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
              color: "#E8ECF4", whiteSpace: "pre-wrap", overflowX: "auto",
              maxHeight: 400, overflowY: "auto",
            }}>{result.script}</pre>
          </div>
          <ProfessionalResult result={result} compact />
        </div>
      )}
    </div>
  );
};

export default ScriptBuilder;
