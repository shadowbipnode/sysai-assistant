const clamp = (value) => Math.max(0, Math.min(100, Math.round(value)));

const webServices = new Set(["http", "https", "http-alt", "https-alt"]);
const mailServices = new Set(["smtp", "smtps", "submission", "imap", "imaps", "pop3", "pop3s"]);
const remoteAccessServices = new Set(["ssh", "rdp", "vnc", "telnet", "ftp"]);
const databaseServices = new Set(["mysql", "postgresql", "mongodb", "mssql", "oracle", "redis", "elasticsearch"]);
const adminSurfaceServices = new Set(["grafana", "prometheus", "docker", "http-alt", "https-alt"]);
const legacyServices = new Set(["ftp", "telnet", "pop3", "imap"]);

const baseRiskWeights = {
  http: 8,
  https: 6,
  "http-alt": 12,
  "https-alt": 10,
  smtp: 13,
  smtps: 10,
  submission: 10,
  imap: 12,
  imaps: 8,
  pop3: 14,
  pop3s: 9,
  ssh: 17,
  ftp: 22,
  telnet: 38,
  rdp: 32,
  vnc: 31,
  mysql: 32,
  postgresql: 32,
  mongodb: 35,
  mssql: 35,
  oracle: 35,
  redis: 40,
  elasticsearch: 34,
  docker: 45,
  grafana: 20,
  prometheus: 24,
  ldap: 24,
  ldaps: 18,
  kerberos: 22,
  "microsoft-ds": 34,
  "lnd-grpc": 44,
  lightning: 16,
  dns: 8
};

function levelFromScore(score) {
  if (score < 30) return "CRITICAL";
  if (score < 55) return "HIGH";
  if (score < 75) return "MEDIUM";
  return "LOW";
}

function serviceWeight(service) {
  if (service === "docker") return 3.2;
  if (service === "redis") return 2.8;
  if (databaseServices.has(service)) return 2.4;
  if (["rdp", "vnc", "telnet", "lnd-grpc", "microsoft-ds"].includes(service)) return 2.3;
  if (remoteAccessServices.has(service)) return 1.9;
  if (adminSurfaceServices.has(service)) return 1.7;
  if (mailServices.has(service)) return 1.25;
  if (webServices.has(service)) return 0.85;
  return 1;
}

export function classifyServiceExposure(service = "") {
  return {
    isWeb: webServices.has(service) || ["grafana", "prometheus"].includes(service),
    isMail: mailServices.has(service),
    isRemoteAccess: remoteAccessServices.has(service),
    isDatabase: databaseServices.has(service),
    isAdminSurface: adminSurfaceServices.has(service),
    isLegacy: legacyServices.has(service)
  };
}

export function calculateServiceRisk(service, context = {}) {
  const riskSignals = [];
  const explanationSignals = [];
  const categories = classifyServiceExposure(service);

  let serviceRisk = baseRiskWeights[service] ?? 12;
  let infrastructureRisk = 0;

  if (categories.isDatabase) {
    infrastructureRisk += 18;
    riskSignals.push("Database service reachable from scan target");
  }

  if (service === "docker") {
    infrastructureRisk += 28;
    riskSignals.push("Docker remote administration endpoint reachable");
  }

  if (categories.isRemoteAccess) {
    infrastructureRisk += service === "ssh" ? 8 : 15;
    riskSignals.push("Remote administration or login protocol exposed");
  }

  if (categories.isMail) {
    infrastructureRisk += 5;
    riskSignals.push("Public mail service exposed");
  }

  if (categories.isWeb) {
    infrastructureRisk += categories.isAdminSurface ? 8 : 2;
    riskSignals.push(categories.isAdminSurface ? "Potential operational web interface exposed" : "Public web service exposed");
  }

  if (service === "ftp") {
    serviceRisk += 12;
    riskSignals.push("Cleartext FTP protocol");
  }

  if (service === "telnet") {
    serviceRisk += 22;
    riskSignals.push("Cleartext remote shell protocol");
  }

  if (context.sshScore !== undefined) {
    const sshPenalty = Math.max(0, 100 - Number(context.sshScore)) * 0.45;
    serviceRisk += sshPenalty;
    explanationSignals.push(`SSH crypto score ${context.sshScore}/100`);
  }

  if (context.versionDisclosure) {
    serviceRisk += 6;
    riskSignals.push("Version disclosure detected");
  }

  if (context.authWeakOrUnknown) {
    serviceRisk += categories.isDatabase || categories.isRemoteAccess ? 16 : 8;
    riskSignals.push("Authentication posture weak or unknown");
  }

  if (context.authenticationConfirmed) {
    serviceRisk -= categories.isDatabase ? 6 : 3;
    explanationSignals.push("Authentication requirement indicated");
  }

  if (context.unauthenticatedAccess) {
    serviceRisk += categories.isDatabase || service === "docker" ? 26 : 14;
    riskSignals.push("Unauthenticated access indicator detected");
  }

  if (context.tlsMissing) {
    serviceRisk += categories.isMail || categories.isWeb ? 8 : 5;
    riskSignals.push("TLS not detected or not confirmed");
  }

  if (context.tlsPresent) {
    serviceRisk -= service === "docker" ? 6 : 3;
    explanationSignals.push("TLS detected");
  }

  if (context.securityHeadersMissing) {
    serviceRisk += categories.isWeb ? 5 : 2;
    riskSignals.push("Security headers incomplete");
  }

  if (context.adminPanelDetected) {
    serviceRisk += 12;
    infrastructureRisk += 8;
    riskSignals.push("Login or admin panel indicator detected");
  }

  if (context.databaseExposure) {
    infrastructureRisk += 10;
    riskSignals.push("Database exposure classified");
  }

  if (context.dockerExposure) {
    serviceRisk += 18;
    infrastructureRisk += 22;
    riskSignals.push("High-risk Docker API exposure");
  }

  if (context.metadataLeak) {
    serviceRisk += 5;
    riskSignals.push("Metadata disclosure detected");
  }

  if (context.weakCrypto) {
    serviceRisk += 15;
    riskSignals.push("Weak crypto detected");
  }

  const riskPoints = clamp(serviceRisk + infrastructureRisk);
  const score = clamp(100 - riskPoints);

  return {
    score,
    level: levelFromScore(score),
    serviceRisk: clamp(serviceRisk),
    infrastructureRisk: clamp(infrastructureRisk),
    riskPoints,
    weight: serviceWeight(service),
    categories,
    signals: [...new Set([...riskSignals, ...explanationSignals])],
    explanationSignals: [...new Set(explanationSignals.length ? explanationSignals : riskSignals)]
  };
}

function countAdminPanels(webIntelData = {}, serviceProbeData = {}) {
  const adminPorts = new Set();

  Object.entries(webIntelData || {}).forEach(([port, intel]) => {
    const fingerprint = intel?.advancedProbe?.fingerprint || {};
    const adminHints = intel?.advancedProbe?.adminHints || [];
    const technologies = intel?.fingerprint?.technologies || [];
    const adminPanels = intel?.fingerprint?.metadata?.adminPanels || [];

    if (
      fingerprint.loginPanel ||
      fingerprint.adminPath ||
      fingerprint.phpmyadmin ||
      fingerprint.grafana ||
      fingerprint.prometheus ||
      fingerprint.portainer ||
      fingerprint.nextcloud ||
      fingerprint.lnbits ||
      fingerprint.wordpressAdmin ||
      adminHints.length > 0 ||
      adminPanels.length > 0 ||
      technologies.some((item) => /grafana|prometheus|phpmyadmin|portainer|nextcloud|lnbits/i.test(item))
    ) {
      adminPorts.add(String(port));
    }
  });

  Object.entries(serviceProbeData || {}).forEach(([port, probe]) => {
    if (
      probe?.grafana?.loginPage ||
      probe?.prometheus?.uiReachable ||
      probe?.prometheus?.metricsReachable ||
      probe?.docker?.apiReachable
    ) {
      adminPorts.add(String(port));
    }
  });

  return adminPorts.size;
}

export function buildAttackSurfaceSummary(serviceMatrix = [], webIntelData = {}, exposureRisk = null, serviceProbeData = {}) {
  const counts = serviceMatrix.reduce((acc, item) => {
    const categories = classifyServiceExposure(item.service);
    if (categories.isWeb) acc.webServices += 1;
    if (categories.isMail) acc.mailServices += 1;
    if (categories.isRemoteAccess) acc.remoteAccessServices += 1;
    if (categories.isDatabase) acc.databaseServices += 1;
    return acc;
  }, {
    webServices: 0,
    mailServices: 0,
    remoteAccessServices: 0,
    databaseServices: 0
  });

  return {
    ...counts,
    detectedAdminPanels: countAdminPanels(webIntelData, serviceProbeData),
    exposureClass: exposureRisk?.exposureClass || exposureRisk?.level || "LOW"
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

  if (!serviceRisks.length) {
    return {
      score: 100,
      level: "LOW",
      exposureClass: "LOW",
      serviceScore: 100,
      infrastructureScore: 100,
      weightedRisk: 0,
      signals: ["No open services detected"],
      explanationSignals: ["No open services detected"],
      services: []
    };
  }

  const weightedRisk =
    serviceRisks.reduce((sum, item) => sum + item.risk.riskPoints * item.risk.weight, 0) /
    serviceRisks.reduce((sum, item) => sum + item.risk.weight, 0);

  const categories = serviceRisks.reduce((acc, item) => {
    if (item.risk.categories.isWeb) acc.web += 1;
    if (item.risk.categories.isMail) acc.mail += 1;
    if (item.risk.categories.isRemoteAccess) acc.remoteAccess += 1;
    if (item.risk.categories.isDatabase) acc.database += 1;
    if (item.risk.categories.isAdminSurface) acc.adminSurface += 1;
    return acc;
  }, { web: 0, mail: 0, remoteAccess: 0, database: 0, adminSurface: 0 });

  const diversityRisk =
    Math.max(0, Object.values(categories).filter(Boolean).length - 1) * 5 +
    Math.max(0, serviceRisks.length - 3) * 2;

  const infrastructureRisk = clamp(
    serviceRisks.reduce((sum, item) => sum + item.risk.infrastructureRisk, 0) / serviceRisks.length +
    diversityRisk
  );

  const serviceRisk = clamp(weightedRisk);
  let totalRisk = clamp(serviceRisk * 0.68 + infrastructureRisk * 0.32);

  const onlyWebExposure = serviceRisks.every((item) => item.risk.categories.isWeb);
  const onlyMailExposure = serviceRisks.every((item) => item.risk.categories.isMail);

  if (onlyWebExposure && categories.adminSurface === 0) {
    totalRisk = Math.min(totalRisk, 38);
  }

  if (onlyMailExposure) {
    totalRisk = Math.min(totalRisk, 62);
  }

  const score = clamp(100 - totalRisk);
  const level = levelFromScore(score);
  const signals = [...new Set(serviceRisks.flatMap((item) => item.risk.signals))];

  return {
    score,
    level,
    exposureClass: level,
    serviceScore: clamp(100 - serviceRisk),
    infrastructureScore: clamp(100 - infrastructureRisk),
    weightedRisk: totalRisk,
    serviceCategories: categories,
    signals,
    explanationSignals: signals.slice(0, 8),
    services: serviceRisks
  };
}
