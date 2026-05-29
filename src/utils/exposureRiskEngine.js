const clamp = (value) => Math.max(0, Math.min(100, value));

const criticalServices = new Set([
  "redis",
  "docker",
  "lnd-grpc",
  "microsoft-ds"
]);

const highRiskServices = new Set([
  "ftp",
  "telnet",
  "mysql",
  "postgresql",
  "mongodb",
  "elasticsearch",
  "grafana",
  "prometheus",
  "rdp",
  "vnc",
  "ldap",
  "mssql",
  "oracle"
]);

export function calculateServiceRisk(service, context = {}) {
  let score = 100;
  const signals = [];

  if (criticalServices.has(service)) {
    score -= 55;
    signals.push("Critical service exposed");
  }

  if (highRiskServices.has(service)) {
    score -= 35;
    signals.push("High-risk service exposed");
  }

  if (["smtp", "smtps", "submission", "imap", "imaps", "pop3", "pop3s"].includes(service)) {
    score -= 18;
    signals.push("Public mail service exposed");
  }

  if (service === "ftp") {
    score -= 25;
    signals.push("Cleartext FTP protocol");
  }

  if (service === "ssh" && context.sshScore !== undefined) {
    score = Math.min(score, context.sshScore);
    signals.push("SSH crypto posture included");
  }

  if (context.versionDisclosure) {
    score -= 10;
    signals.push("Version disclosure detected");
  }

  if (context.authWeakOrUnknown) {
    score -= 12;
    signals.push("Authentication posture weak or unknown");
  }

  if (context.tlsMissing) {
    score -= 15;
    signals.push("TLS not detected");
  }

  score = clamp(score);

  const level =
    score < 30 ? "CRITICAL" :
    score < 55 ? "HIGH" :
    score < 75 ? "MEDIUM" :
    "LOW";

  return {
    score,
    level,
    signals
  };
}

export function calculateGlobalRisk(serviceMatrix = [], serviceContexts = {}) {
  const serviceRisks = serviceMatrix.map((item) => {
    const context = serviceContexts[String(item.port)] || {};
    return {
      ...item,
      risk: calculateServiceRisk(item.service, context)
    };
  });

  const lowestScore = serviceRisks.length
    ? Math.min(...serviceRisks.map((item) => item.risk.score))
    : 100;

  const globalLevel =
    lowestScore < 30 ? "CRITICAL" :
    lowestScore < 55 ? "HIGH" :
    lowestScore < 75 ? "MEDIUM" :
    "LOW";

  return {
    score: lowestScore,
    level: globalLevel,
    services: serviceRisks
  };
}
