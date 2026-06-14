const VALID_SEVERITY = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const VALID_CONFIDENCE = new Set(["LOW", "MEDIUM", "HIGH"]);

const toArray = (value) => {
  if (Array.isArray(value)) return value.filter((item) => item !== null && item !== undefined).map(String);
  if (value === null || value === undefined || value === "") return [];
  return [String(value)];
};

const normalizeEnum = (value, allowed, fallback) => {
  const normalized = String(value || "").toUpperCase();
  return allowed.has(normalized) ? normalized : fallback;
};

export function normalizeProfessionalOutput(result, fallback = {}) {
  const source = result && typeof result === "object" ? result : {};
  const title = source.title || source.diagnosis || source.summary || fallback.title || "Operational result";
  const evidence = toArray(source.evidence);
  const assumptions = toArray(source.assumptions);

  return {
    ...source,
    title,
    severity: normalizeEnum(source.severity || source.risk_level, VALID_SEVERITY, fallback.severity || "LOW"),
    risk_level: normalizeEnum(source.risk_level || source.severity, VALID_SEVERITY, fallback.severity || "LOW"),
    confidence: normalizeEnum(source.confidence, VALID_CONFIDENCE, fallback.confidence || "LOW"),
    evidence,
    assumptions,
    detected_stack: toArray(source.detected_stack),
    fix_commands: toArray(source.fix_commands || source.hardening_commands),
    verification_commands: toArray(source.verification_commands),
    rollback_commands: toArray(source.rollback_commands).length
      ? toArray(source.rollback_commands)
      : ["No rollback needed for read-only checks."],
    remediation_safety: source.remediation_safety || fallback.remediation_safety || "READ_ONLY_SAFE",
    evidence_quality: source.evidence_quality || (evidence.length ? "DIRECT_EVIDENCE" : "PARTIAL_EVIDENCE"),
    rollback_confidence: source.rollback_confidence || "ROLLBACK_NOT_REQUIRED",
    verification_strength: source.verification_strength || "WEAK_VERIFICATION",
    verification_reason: source.verification_reason || "The result was normalized because provider output can be partial or malformed.",
    verification_limitations: toArray(source.verification_limitations),
    next_best_action: source.next_best_action || source.check_command || fallback.next_best_action || "Review the evidence and assumptions before taking action.",
    reasoning_summary: source.reasoning_summary || "Result fields were normalized from the available evidence and assumptions.",
    decision_factors: toArray(source.decision_factors).length ? toArray(source.decision_factors) : evidence.slice(0, 3),
    why_first_action: source.why_first_action || "The first action is read-only or advisory and avoids unverified changes.",
    context_used: Boolean(source.context_used),
    context_signals: toArray(source.context_signals),
    context_risk_notes: toArray(source.context_risk_notes),
  };
}
