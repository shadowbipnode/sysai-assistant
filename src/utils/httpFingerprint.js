function finding(title, severity, evidence, remediation) {
  return { title, severity, evidence, remediation };
}

function stack(name, confidence = "MEDIUM") {
  return { name, confidence };
}

export function fingerprintHttp(headers = {}, target = "") {
  const findings = [];
  const detectedStack = [];

  const attackSurface = {
    probableRole: [],
    metadataLeaks: [],
    exposure: [],
    confidence: "LOW"
  };
  const technologies = [];
  const versions = {};
  const metadata = {};

  const normalized = {};

  Object.entries(headers || {}).forEach(([k, v]) => {
    normalized[String(k).toLowerCase()] = String(v);
  });

  const server = normalized["server"] || "";
  const poweredBy = normalized["x-powered-by"] || "";

  if (/php\/?([\d\.]+)/i.test(poweredBy)) {
    const match = poweredBy.match(/php\/?([\d\.]+)/i);

    technologies.push("PHP");

    if (match?.[1]) {
      versions.php = match[1];
    }
  }

  // ============================================================
  // SERVER DETECTION
  // ============================================================

  if (/nginx/i.test(server)) {
    detectedStack.push(stack("nginx", "HIGH"));
    technologies.push("nginx");

    const match = server.match(/nginx\/?([\d\.]+)/i);

    if (match?.[1]) {
      versions.nginx = match[1];
    }
  }

  if (/apache/i.test(server)) {
    detectedStack.push(stack("Apache", "HIGH"));
    technologies.push("Apache");

    const match = server.match(/apache\/?([\d\.]+)/i);

    if (match?.[1]) {
      versions.apache = match[1];
    }
  }

  if (/cloudflare/i.test(server)) {
    detectedStack.push(stack("Cloudflare", "HIGH"));
  }

  if (/traefik/i.test(server)) {
    detectedStack.push(stack("Traefik", "HIGH"));
  }

  if (/grafana/i.test(server) || target.includes("grafana")) {
    detectedStack.push(stack("Grafana", "MEDIUM"));
  }

  if (/prometheus/i.test(server) || target.includes("prometheus")) {
    detectedStack.push(stack("Prometheus", "MEDIUM"));
  }

  // ============================================================
  // SECURITY HEADERS
  // ============================================================

  const securityHeaders = [
    "content-security-policy",
    "x-frame-options",
    "x-content-type-options",
    "strict-transport-security",
    "referrer-policy"
  ];

  securityHeaders.forEach((header) => {
    if (!normalized[header]) {
      findings.push(finding(
        `Missing security header: ${header}`,
        "MEDIUM",
        `${header} header was not detected.`,
        `Add the ${header} security header to the reverse proxy or web server configuration.`
      ));
    }
  });

  // ============================================================
  // POWERED BY LEAKS
  // ============================================================

  if (poweredBy) {
    findings.push(finding(
      "Technology disclosure via X-Powered-By",
      "LOW",
      `Server exposes technology information: ${poweredBy}`,
      "Remove or obfuscate X-Powered-By headers in production environments."
    ));
  }

  // ============================================================
  // COOKIE FLAGS
  // ============================================================

  const setCookie = normalized["set-cookie"] || "";

  if (setCookie && !/httponly/i.test(setCookie)) {
    findings.push(finding(
      "Cookie missing HttpOnly flag",
      "MEDIUM",
      "A cookie appears to be set without HttpOnly.",
      "Enable HttpOnly for session and authentication cookies."
    ));
  }

  if (setCookie && !/secure/i.test(setCookie)) {
    findings.push(finding(
      "Cookie missing Secure flag",
      "MEDIUM",
      "A cookie appears to be set without Secure.",
      "Enable Secure cookies for HTTPS deployments."
    ));
  }

  metadata.serverHeader = server;
  metadata.poweredBy = poweredBy;

  if (
    metadata.serverHeader &&
    /ubuntu|debian|centos|fedora/i.test(metadata.serverHeader)
  ) {
    attackSurface.metadataLeaks.push(
      "Underlying operating system disclosure"
    );
  }

  if (
    findings.some(f =>
      String(f.title).includes("Missing security header")
    )
  ) {
    attackSurface.exposure.push(
      "Security hardening incomplete"
    );
  }

  if (
    metadata.serverHeader &&
    /nginx|apache/i.test(metadata.serverHeader)
  ) {
    attackSurface.exposure.push(
      "Public web infrastructure detected"
    );
  }

  return {
    findings,
    detectedStack,
    technologies,
    versions,
    metadata,
    attackSurface
  };
}
