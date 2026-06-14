function finding(title, severity, evidence, remediation) {
  return { title, severity, evidence, remediation };
}

export function auditPrivacyExposure(input) {
  const text = String(input || "");
  const lower = text.toLowerCase();
  const findings = [];

  if (/x-powered-by|server:\s*(nginx|apache|caddy|traefik|express)|x-aspnet-version/i.test(text)) {
    findings.push(finding(
      "Technology metadata disclosure",
      "MEDIUM",
      "Response headers disclose server or framework metadata.",
      "Reduce version and framework headers where operationally practical."
    ));
  }

  if (/access-control-allow-origin:\s*\*/i.test(text)) {
    findings.push(finding(
      "Wildcard CORS policy",
      "HIGH",
      "CORS allows any origin.",
      "Restrict CORS to known trusted origins and validate credential handling."
    ));
  }

  if (/referrer-policy/i.test(text) === false && /https?:\/\//i.test(text)) {
    findings.push(finding(
      "Missing referrer policy",
      "LOW",
      "No Referrer-Policy header was visible in the provided web output.",
      "Set a Referrer-Policy that limits cross-site path and query leakage."
    ));
  }

  if (/stun:|turn:|webrtc|rtcicecandidate|localcandidate/i.test(text)) {
    findings.push(finding(
      "WebRTC or STUN exposure signal",
      "MEDIUM",
      "The input references WebRTC, STUN, TURN, or ICE candidate data.",
      "Verify browser and VPN settings do not expose local or public IP metadata unexpectedly."
    ));
  }

  if (/dns leak|resolver|nameserver|systemd-resolved|\/etc\/resolv\.conf/i.test(text) && /(8\.8\.8\.8|1\.1\.1\.1|9\.9\.9\.9|isp|public resolver)/i.test(text)) {
    findings.push(finding(
      "DNS resolver privacy review needed",
      "MEDIUM",
      "The input includes DNS resolver or leak-test signals.",
      "Confirm DNS queries use the intended resolver path and do not bypass VPN or local policy."
    ));
  }

  if (/telemetry|analytics|sentry|posthog|google-analytics|segment|mixpanel/i.test(lower)) {
    findings.push(finding(
      "Telemetry endpoint referenced",
      "MEDIUM",
      "Telemetry or analytics tooling is present in the input.",
      "Document telemetry purpose, retention, opt-out controls, and network destinations."
    ));
  }

  if (/fingerprint|canvas|user-agent|accept-language|timezone|font/i.test(lower)) {
    findings.push(finding(
      "Fingerprinting surface signal",
      "LOW",
      "Browser or device fingerprinting attributes were referenced.",
      "Minimize unnecessary fingerprinting attributes and verify privacy controls in the client path."
    ));
  }

  if (/com\.docker|container id|hostname=|HOSTNAME=|kubernetes|pod_name|namespace/i.test(text)) {
    findings.push(finding(
      "Container metadata disclosure",
      "MEDIUM",
      "Container, orchestrator, or host metadata appears in the input.",
      "Avoid exposing runtime metadata in public responses, logs, or diagnostics shared outside trusted operators."
    ));
  }

  return findings;
}
