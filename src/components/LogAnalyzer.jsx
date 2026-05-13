import { useState } from "react";
import ProfessionalResult from "./ProfessionalResult";

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
      <button
        onClick={onBack}
        style={{
          background: "none",
          border: "none",
          color: "#8B95A8",
          cursor: "pointer",
          fontSize: 13,
          marginBottom: 16,
        }}
      >
        ← {t.home}
      </button>

      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>
        {t.modes.logAnalyzer.icon} {t.logAnalyzerPage.title}
      </h2>

      <p style={{ color: "#8B95A8", fontSize: 14, marginBottom: 20 }}>
        {t.logAnalyzerPage.subtitle}
      </p>

      <div style={{ marginBottom: 16 }}>
        <label
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "#8B95A8",
            marginBottom: 8,
            display: "block",
          }}
        >
          {t.logAnalyzerPage.serviceLabel}
        </label>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {t.logAnalyzerPage.services.map((service, index) => (
            <button
              key={service}
              onClick={() => setSelectedService(index)}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 500,
                background: selectedService === index ? "#00D4AA" : "#1A1F2E",
                color: selectedService === index ? "#0B0E14" : "#8B95A8",
                border: `1px solid ${
                  selectedService === index ? "#00D4AA" : "#1E2535"
                }`,
                cursor: "pointer",
              }}
            >
              {service}
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={logText}
        onChange={(event) => setLogText(event.target.value)}
        placeholder="Paste your log here or drag & drop a file..."
        style={{
          width: "100%",
          height: 180,
          padding: 16,
          borderRadius: 12,
          background: "#131720",
          border: "2px dashed #1E2535",
          color: "#E8ECF4",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 12,
          resize: "vertical",
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.currentTarget.style.borderColor = "#00D4AA";
        }}
        onDragLeave={(event) => {
          event.currentTarget.style.borderColor = "#1E2535";
        }}
        onDrop={(event) => {
          event.preventDefault();

          const file = event.dataTransfer.files[0];

          if (file && (file.name.endsWith(".log") || file.name.endsWith(".txt"))) {
            const reader = new FileReader();
            reader.onload = (readerEvent) => setLogText(readerEvent.target.result);
            reader.readAsText(file);
          }

          event.currentTarget.style.borderColor = "#1E2535";
        }}
      />

      <button
        onClick={handleAnalyze}
        disabled={analyzing}
        style={{
          marginTop: 12,
          padding: "12px 28px",
          background: analyzing ? "#1E2535" : "#00D4AA",
          color: analyzing ? "#8B95A8" : "#0B0E14",
          border: "none",
          borderRadius: 10,
          fontWeight: 600,
          fontSize: 14,
          cursor: analyzing ? "not-allowed" : "pointer",
        }}
      >
        {analyzing ? t.logAnalyzerPage.analyzing : t.logAnalyzerPage.analyze}
      </button>

      {result && <ProfessionalResult result={result} />}
    </div>
  );
};

export default LogAnalyzer;