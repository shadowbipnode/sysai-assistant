const asArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") return value.trim() ? value.split(/\n+/).map((item) => item.trim()).filter(Boolean) : [];
  return [JSON.stringify(value)];
};

const commandBlock = (items) => asArray(items)
  .map((item) => typeof item === "object" ? item.command || item.fix || item.remediation || JSON.stringify(item) : String(item))
  .filter(Boolean);

const findingLines = (result) => {
  const findings = asArray(result.findings);
  if (!findings.length) return ["No findings were recorded in the current result."];
  return findings.map((finding) => {
    if (typeof finding === "object") {
      const title = finding.title || finding.issue || "Finding";
      const severity = finding.severity ? ` [${finding.severity}]` : "";
      const evidence = finding.evidence ? ` Evidence: ${finding.evidence}` : "";
      return `${severity} ${title}.${evidence}`.trim();
    }
    return String(finding);
  });
};

export function buildOperationalRunbook(result = {}) {
  const verification = commandBlock(result.verification_commands || result.verification || result.check_command);
  const remediation = commandBlock(result.fix_commands || result.hardening_commands || result.recommendations || result.remediation);
  const rollback = commandBlock(result.rollback_commands || result.rollback);
  const symptoms = [
    result.summary,
    result.report,
    result.title,
  ].filter(Boolean);

  const sections = [
    ["Symptoms", symptoms.length ? symptoms : ["Current findings indicate an operational or exposure condition that should be reviewed."]],
    ["Likely Cause", [result.root_cause || result.next_best_action || "Cause depends on the current evidence and should be verified before changes."]],
    ["Findings", findingLines(result)],
    ["Verification Commands", verification.length ? verification : ["# Re-run the original check and validate the affected service state."]],
    ["Safe Remediation", remediation.length ? remediation : ["# Review the finding and apply the least-privilege or least-exposure change appropriate for your environment."]],
    ["Rollback Notes", rollback.length ? rollback : ["No rollback needed for read-only checks. Record original configuration before making changes."]],
    ["Prevention", asArray(result.prevention || result.recommendations).length ? asArray(result.prevention || result.recommendations) : ["Document intended exposure, restrict administrative paths, and re-check after each infrastructure change."]],
  ];

  let markdown = `# Operational Runbook\n\n`;
  markdown += `Generated: ${new Date().toISOString()}\n\n`;
  if (result.severity || result.risk_level || result.confidence) {
    markdown += `## Metadata\n\n`;
    if (result.severity || result.risk_level) markdown += `- Risk: ${result.severity || result.risk_level}\n`;
    if (result.confidence) markdown += `- Confidence: ${result.confidence}\n`;
    if (result.remediation_safety) markdown += `- Remediation safety: ${result.remediation_safety}\n`;
    markdown += `\n`;
  }

  sections.forEach(([title, values]) => {
    markdown += `## ${title}\n\n`;
    const isCommand = title.includes("Commands") || title.includes("Remediation") || title.includes("Rollback");
    if (isCommand) {
      markdown += `\`\`\`bash\n${values.join("\n")}\n\`\`\`\n\n`;
    } else {
      markdown += values.map((item) => `- ${item}`).join("\n");
      markdown += `\n\n`;
    }
  });

  return markdown;
}

export function exportRunbook(result) {
  const content = buildOperationalRunbook(result);
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `sysai-runbook-${new Date().toISOString().replace(/[:.]/g, "-")}.md`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
