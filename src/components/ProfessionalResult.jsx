const severityColors = {
  LOW: "#00D4AA",
  MEDIUM: "#FBBF24",
  HIGH: "#FF4D6A",
  CRITICAL: "#C084FC",
  INFO: "#8B95A8",
};

const asArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") return value.trim() ? [value] : [];
  return [];
};

const first = (...values) => values.find((v) => v !== undefined && v !== null && v !== "");

const isEmptyText = (value) => {
  if (value === undefined || value === null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "string") return value.trim() === "" || value.trim().toLowerCase() === "null";
  return false;
};

const splitNumberedSteps = (text) => {
  if (typeof text !== "string") return text;
  const trimmed = text.trim();
  if (!trimmed) return "";
  // Convert AI-compressed strings like "1. Do X. 2. Do Y." into readable lines.
  if (/\b1\.\s+/.test(trimmed) && /\b2\.\s+/.test(trimmed)) {
    return trimmed
      .replace(/\s+(?=\d+\.\s+)/g, "\n")
      .replace(/:\s*'/g, ":\n'");
  }
  return trimmed;
};

const normalizeCommandItems = (value) => {
  const arr = asArray(value);
  if (!arr.length) return "";
  return arr.map((item) => {
    if (typeof item === "object") {
      return item.command || item.cmd || item.step || item.action || JSON.stringify(item);
    }
    return String(item);
  }).map(splitNumberedSteps).filter(Boolean).join("\n");
};

const commandText = (value) => Array.isArray(value) ? normalizeCommandItems(value) : splitNumberedSteps(value);

export const ResultPill = ({ label, value, color }) => {
  if (isEmptyText(value)) return null;
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px",
      borderRadius: 8, background: `${color}18`, border: `1px solid ${color}33`,
      marginRight: 8, marginBottom: 8,
    }}>
      <span style={{ color: "#8B95A8", fontSize: 11, fontWeight: 600 }}>{label}</span>
      <span style={{ color, fontSize: 12, fontWeight: 800 }}>{String(value)}</span>
    </div>
  );
};

export const ResultSection = ({ title, children, accent = "#1E2535", copyText }) => {
  if (!children) return null;
  return (
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
};

export const CodeBlock = ({ text }) => {
  if (isEmptyText(text)) return null;
  return (
    <pre style={{
      fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
      color: "#E8ECF4", whiteSpace: "pre-wrap", margin: 0,
      lineHeight: 1.6, overflowX: "auto",
    }}>{text}</pre>
  );
};

export const ResultList = ({ items }) => {
  const list = asArray(items);
  if (!list.length) return null;
  return (
    <ul style={{ margin: 0, paddingLeft: 18, color: "#B8C0D0", fontSize: 13, lineHeight: 1.7 }}>
      {list.map((item, idx) => {
        if (typeof item === "object") {
          const title = item.issue || item.title || item.name || `Item ${idx + 1}`;
          const detail = item.evidence || item.fix || item.description || item.severity || "";
          return <li key={idx}><strong style={{ color: "#E8ECF4" }}>{title}</strong>{detail ? ` — ${detail}` : ""}</li>;
        }
        return <li key={idx}>{item}</li>;
      })}
    </ul>
  );
};

const textSection = (text) => text ? (
  <p style={{ fontSize: 14, color: "#B8C0D0", whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.6 }}>{text}</p>
) : null;

const ProfessionalResult = ({ result, compact = false, hidePrimaryArtifact = false }) => {
  if (!result) return null;

  const severity = first(result.severity, result.risk_level, result.risk, result.destructive ? "HIGH" : null);
  const normalizedSeverity = typeof severity === "string" ? severity.toUpperCase() : severity;
  const severityColor = severityColors[normalizedSeverity] || severityColors.INFO;
  const confidence = result.confidence ? String(result.confidence).toUpperCase() : null;
  const confidenceColor = confidence === "HIGH" ? "#00D4AA" : confidence === "MEDIUM" ? "#FBBF24" : "#FF4D6A";
  const requiresSudo = first(result.requires_sudo, result.sudo_required);
  const destructive = first(result.destructive, result.destructive_level);
  const detectedStack = asArray(result.detected_stack || result.environment || result.detected_environment);
  const nextBestAction = first(result.next_best_action, result.first_step, result.check_command);
  const summary = first(result.summary, result.diagnosis && !result.root_cause ? result.diagnosis : null);
  const rootCause = first(result.root_cause, result.cause);
  const report = first(result.report, result.audit_report);
  const recommendations = first(result.recommendations, result.hardening);
  const hardeningCommands = commandText(result.hardening_commands);
  const fix = commandText(first(result.fix_commands, result.commands, result.fix, result.remediation));
  const verification = commandText(first(result.verification_commands, result.verification, result.verify, result.validation_commands, result.check_command));
  const rollback = commandText(first(result.rollback_commands, result.rollback));
  const safetyNotes = first(result.safety_notes, result.warning, result.security_notes, result.compliance_notes, result.risks);
  const prevention = first(result.prevention, result.improvements);
  const assumptions = asArray(result.assumptions);
  const evidence = asArray(result.evidence);
  const findings = asArray(result.findings);
  const followUps = asArray(result.additional_logs_needed || result.follow_up_checks || result.follow_up_question);

  const hasProfessionalFields = normalizedSeverity || confidence || requiresSudo !== undefined || nextBestAction || summary || rootCause || report || fix || verification || rollback || evidence.length || findings.length || assumptions.length || followUps.length || safetyNotes || prevention || recommendations || hardeningCommands;
  if (!hasProfessionalFields) return null;

  return (
    <div style={{ marginTop: compact ? 12 : 18 }}>
      <div style={{ marginBottom: 12 }}>
        {normalizedSeverity && <ResultPill label="RISK" value={normalizedSeverity} color={severityColor} />}
        {confidence && <ResultPill label="CONFIDENCE" value={confidence} color={confidenceColor} />}
        {requiresSudo !== undefined && <ResultPill label="SUDO" value={requiresSudo ? "YES" : "NO"} color={requiresSudo ? "#FBBF24" : "#00D4AA"} />}
        {destructive !== undefined && <ResultPill label="DESTRUCTIVE" value={destructive === true ? "YES" : destructive === false ? "NO" : destructive} color={destructive ? "#FF4D6A" : "#00D4AA"} />}
      </div>

      {detectedStack.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <span style={{ color: "#8B95A8", fontSize: 12, fontWeight: 700, marginRight: 8 }}>Detected environment:</span>
          {detectedStack.map((s, i) => (
            <span key={i} style={{
              display: "inline-block", padding: "4px 10px", borderRadius: 999,
              background: "#1A1F2E", border: "1px solid #1E2535", color: "#B8C0D0",
              fontSize: 12, marginRight: 6, marginBottom: 6,
            }}>{s}</span>
          ))}
        </div>
      )}

      {result.title && (
        <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>{result.title}</h3>
      )}

      {summary && (
        <ResultSection title="SUMMARY" accent="#8B95A8">
          {textSection(summary)}
        </ResultSection>
      )}

      {nextBestAction && (
        <ResultSection title="NEXT BEST ACTION" accent="#00D4AA" copyText={nextBestAction}>
          <p style={{ fontSize: 14, color: "#B8C0D0", whiteSpace: "pre-wrap", margin: 0, fontWeight: 600 }}>{nextBestAction}</p>
        </ResultSection>
      )}

      {rootCause && (
        <ResultSection title="ROOT CAUSE" accent="#FBBF24">
          {textSection(rootCause)}
        </ResultSection>
      )}

      {report && (
        <ResultSection title="REPORT" accent="#60A5FA" copyText={report}>
          {textSection(report)}
        </ResultSection>
      )}

      {evidence.length > 0 && (
        <ResultSection title="EVIDENCE" accent="#60A5FA">
          <ResultList items={evidence} />
        </ResultSection>
      )}

      {findings.length > 0 && (
        <ResultSection title="FINDINGS" accent="#FF4D6A">
          <ResultList items={findings} />
        </ResultSection>
      )}

      {!hidePrimaryArtifact && fix && (
        <ResultSection title="FIX" accent="#00D4AA" copyText={fix}>
          <CodeBlock text={fix} />
        </ResultSection>
      )}

      {recommendations && (
        <ResultSection title="RECOMMENDATIONS" accent="#FF4D6A" copyText={recommendations}>
          {textSection(recommendations)}
        </ResultSection>
      )}

      {hardeningCommands && (
        <ResultSection title="HARDENING COMMANDS" accent="#FF4D6A" copyText={hardeningCommands}>
          <CodeBlock text={hardeningCommands} />
        </ResultSection>
      )}

      {verification && (
        <ResultSection title="VERIFY" accent="#38BDF8" copyText={verification}>
          <CodeBlock text={verification} />
        </ResultSection>
      )}

      {rollback && (
        <ResultSection title="ROLLBACK" accent="#C084FC" copyText={rollback}>
          <CodeBlock text={rollback} />
        </ResultSection>
      )}

      {safetyNotes && (
        <ResultSection title="SAFETY NOTES" accent="#FBBF24">
          {textSection(safetyNotes)}
        </ResultSection>
      )}

      {prevention && (
        <ResultSection title="PREVENTION" accent="#8B95A8">
          {textSection(prevention)}
        </ResultSection>
      )}

      {assumptions.length > 0 && (
        <ResultSection title="ASSUMPTIONS" accent="#8B95A8">
          <ResultList items={assumptions} />
        </ResultSection>
      )}

      {followUps.length > 0 && (
        <ResultSection title={result.additional_logs_optional || confidence === "HIGH" ? "OPTIONAL FOLLOW-UP CHECKS" : "FOLLOW-UP NEEDED"} accent={result.additional_logs_optional || confidence === "HIGH" ? "#8B95A8" : "#FF4D6A"}>
          <ResultList items={followUps} />
        </ResultSection>
      )}
    </div>
  );
};

export default ProfessionalResult;
