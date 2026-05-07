import { useState } from "react";

const severityColors = {
  LOW: "#00D4AA",
  MEDIUM: "#FBBF24",
  HIGH: "#FF4D6A",
  CRITICAL: "#C084FC",
  INFO: "#8B95A8",
};

const Section = ({ title, children, accent = "#1E2535", copyText }) => (
  <div style={{
    background: "#131720", border: `1px solid ${accent}`, borderRadius: 12,
    overflow: "hidden", marginBottom: 16,
  }}>
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "10px 16px", background: `${accent}33`,
    }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: accent }}>{title}</span>
      {copyText && (
        <button onClick={() => navigator.clipboard.writeText(copyText)} style={{
          background: "none", border: `1px solid ${accent}66`, borderRadius: 6,
          color: accent, padding: "4px 12px", fontSize: 11, cursor: "pointer",
        }}>📋 Copy</button>
      )}
    </div>
    <div style={{ padding: 18 }}>{children}</div>
  </div>
);

const CodeBlock = ({ text }) => (
  <pre style={{
    fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
    color: "#E8ECF4", whiteSpace: "pre-wrap", margin: 0,
    lineHeight: 1.6,
  }}>{text}</pre>
);

const Pill = ({ label, value, color }) => (
  <div style={{
    display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px",
    borderRadius: 8, background: `${color}18`, border: `1px solid ${color}33`,
    marginRight: 8, marginBottom: 8,
  }}>
    <span style={{ color: "#8B95A8", fontSize: 11, fontWeight: 600 }}>{label}</span>
    <span style={{ color, fontSize: 12, fontWeight: 800 }}>{value}</span>
  </div>
);

const renderList = (items) => {
  if (!items || !Array.isArray(items) || items.length === 0) return null;
  return (
    <ul style={{ margin: 0, paddingLeft: 18, color: "#B8C0D0", fontSize: 13, lineHeight: 1.7 }}>
      {items.map((item, idx) => <li key={idx}>{item}</li>)}
    </ul>
  );
};

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

  const severity = result?.severity || "INFO";
  const severityColor = severityColors[severity] || severityColors.INFO;
  const confidence = result?.confidence || null;
  const confidenceColor = confidence === "HIGH" ? "#00D4AA" : confidence === "MEDIUM" ? "#FBBF24" : "#FF4D6A";

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

      <button onClick={handleAnalyze} disabled={analyzing} style={{
        marginTop: 12, padding: "12px 28px", background: analyzing ? "#1E2535" : "#00D4AA",
        color: analyzing ? "#8B95A8" : "#0B0E14", border: "none", borderRadius: 10,
        fontWeight: 600, fontSize: 14, cursor: analyzing ? "not-allowed" : "pointer",
      }}>
        {analyzing ? t.logAnalyzerPage.analyzing : t.logAnalyzerPage.analyze}
      </button>

      {result && (
        <div style={{ marginTop: 24 }}>
          <div style={{ marginBottom: 12 }}>
            <Pill label="RISK" value={severity} color={severityColor} />
            {confidence && <Pill label="CONFIDENCE" value={confidence} color={confidenceColor} />}
            {typeof result.requires_sudo === "boolean" && (
              <Pill label="SUDO" value={result.requires_sudo ? "YES" : "NO"} color={result.requires_sudo ? "#FBBF24" : "#00D4AA"} />
            )}
          </div>

          {Array.isArray(result.detected_stack) && result.detected_stack.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <span style={{ color: "#8B95A8", fontSize: 12, fontWeight: 700, marginRight: 8 }}>Detected stack:</span>
              {result.detected_stack.map((s, i) => (
                <span key={i} style={{
                  display: "inline-block", padding: "4px 10px", borderRadius: 999,
                  background: "#1A1F2E", border: "1px solid #1E2535", color: "#B8C0D0",
                  fontSize: 12, marginRight: 6, marginBottom: 6,
                }}>{s}</span>
              ))}
            </div>
          )}

          <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>{result.title}</h3>

          <Section title="SUMMARY" accent="#8B95A8">
            <p style={{ fontSize: 14, color: "#B8C0D0", whiteSpace: "pre-wrap", margin: 0 }}>
              {result.summary || result.explanation}
            </p>
          </Section>

          {result.next_best_action && (
            <Section title="NEXT BEST ACTION" accent="#00D4AA" copyText={result.next_best_action}>
              <p style={{ fontSize: 14, color: "#B8C0D0", whiteSpace: "pre-wrap", margin: 0, fontWeight: 600 }}>
                {result.next_best_action}
              </p>
            </Section>
          )}

          {result.root_cause && (
            <Section title="ROOT CAUSE" accent="#FBBF24">
              <p style={{ fontSize: 14, color: "#B8C0D0", whiteSpace: "pre-wrap", margin: 0 }}>{result.root_cause}</p>
            </Section>
          )}

          {renderList(result.evidence) && (
            <Section title="EVIDENCE" accent="#60A5FA">
              {renderList(result.evidence)}
            </Section>
          )}

          {result.fix && result.fix !== "N/A" && (
            <Section title="FIX" accent="#00D4AA" copyText={result.fix}>
              <CodeBlock text={result.fix} />
            </Section>
          )}

          {result.verification && (
            <Section title="VERIFY" accent="#38BDF8" copyText={result.verification}>
              <CodeBlock text={result.verification} />
            </Section>
          )}

          {result.rollback && (
            <Section title="ROLLBACK" accent="#C084FC" copyText={result.rollback}>
              <CodeBlock text={result.rollback} />
            </Section>
          )}

          {result.prevention && (
            <Section title="PREVENTION" accent="#8B95A8">
              <p style={{ fontSize: 14, color: "#B8C0D0", whiteSpace: "pre-wrap", margin: 0 }}>{result.prevention}</p>
            </Section>
          )}

          {renderList(result.assumptions) && (
            <Section title="ASSUMPTIONS" accent="#8B95A8">
              {renderList(result.assumptions)}
            </Section>
          )}

          {renderList(result.additional_logs_needed) && (
            <Section
              title={result.additional_logs_optional || result.confidence === "HIGH" ? "OPTIONAL FOLLOW-UP CHECKS" : "ADDITIONAL LOGS NEEDED"}
              accent={result.additional_logs_optional || result.confidence === "HIGH" ? "#8B95A8" : "#FF4D6A"}
            >
              {renderList(result.additional_logs_needed)}
            </Section>
          )}
        </div>
      )}
    </div>
  );
};

export default LogAnalyzer;
