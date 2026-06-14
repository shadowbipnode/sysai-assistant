function finding(title, severity, evidence, remediation) {
  return { title, severity, evidence, remediation };
}

function stack(name, confidence = "MEDIUM") {
  return { name, confidence };
}

const securityHeaderNames = [
  "content-security-policy",
  "x-frame-options",
  "x-content-type-options",
  "strict-transport-security",
  "referrer-policy",
  "permissions-policy"
];

function addUnique(list, value) {
  if (value && !list.includes(value)) list.push(value);
}

function addAdminPanel(list, panel) {
  if (!panel?.platform) return;
  if (!list.some((item) => item.platform === panel.platform)) list.push(panel);
}

function parseServerVersion(server, family) {
  const escaped = family.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return server.match(new RegExp(`${escaped}\\/?([\\d.]+[^\\s]*)`, "i"))?.[1] || "";
}

export function fingerprintHttp(headers = {}, target = "", probe = {}) {
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
  const applicationHints = [];
  const exposureSignals = [];
  const reverseProxyCdnWaf = [];
  const cdnIndicators = [];
  const wafIndicators = [];
  const adminPanels = [];
  const reverseProxy = {
    family: "",
    version: "",
    confidence: "LOW",
    metadataDisclosure: false,
    indicators: [],
    cdn: [],
    waf: [],
    exposureAssessment: "No reverse proxy indicators confirmed",
    hardening: []
  };

  const normalized = {};

  Object.entries(headers || {}).forEach(([k, v]) => {
    normalized[String(k).toLowerCase()] = String(v);
  });

  const server = normalized["server"] || "";
  const poweredBy = normalized["x-powered-by"] || "";
  const html = String(probe.htmlSample || probe.html || "");
  const finalUrl = probe.finalUrl || "";
  const allText = `${server}\n${poweredBy}\n${html}\n${Object.values(normalized).join("\n")}`;

  if (/php\/?([\d.]+)/i.test(poweredBy)) {
    const match = poweredBy.match(/php\/?([\d.]+)/i);

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
    addUnique(technologies, "nginx");
    reverseProxy.family = "nginx";
    reverseProxy.confidence = "HIGH";
    addUnique(reverseProxy.indicators, "Server header");

    const match = server.match(/nginx\/?([\d.]+)/i);

    if (match?.[1]) {
      versions.nginx = match[1];
      reverseProxy.version = match[1];
    }
  }

  if (/apache/i.test(server)) {
    detectedStack.push(stack("Apache", "HIGH"));
    addUnique(technologies, "Apache");
    reverseProxy.family = reverseProxy.family || "Apache";
    reverseProxy.confidence = reverseProxy.family === "Apache" ? "HIGH" : reverseProxy.confidence;
    addUnique(reverseProxy.indicators, "Server header");

    const match = server.match(/apache\/?([\d.]+)/i);

    if (match?.[1]) {
      versions.apache = match[1];
      if (reverseProxy.family === "Apache") reverseProxy.version = match[1];
    }
  }

  if (/cloudflare/i.test(server)) {
    detectedStack.push(stack("Cloudflare", "HIGH"));
    addUnique(reverseProxyCdnWaf, "Cloudflare");
    addUnique(cdnIndicators, "Cloudflare");
    addUnique(wafIndicators, "Cloudflare");
  }

  if (/litespeed/i.test(server)) {
    detectedStack.push(stack("LiteSpeed", "HIGH"));
    addUnique(technologies, "LiteSpeed");
  }

  if (/fastly|x-served-by|x-cache-hits/i.test(allText)) {
    detectedStack.push(stack("Fastly", "MEDIUM"));
    addUnique(reverseProxyCdnWaf, "Fastly");
    addUnique(cdnIndicators, "Fastly");
  }

  if (/akamai|akamai-ghost|x-akamai/i.test(allText)) {
    detectedStack.push(stack("Akamai", "MEDIUM"));
    addUnique(reverseProxyCdnWaf, "Akamai");
    addUnique(cdnIndicators, "Akamai");
  }

  if (/sucuri|x-sucuri/i.test(allText)) {
    detectedStack.push(stack("Sucuri", "MEDIUM"));
    addUnique(reverseProxyCdnWaf, "Sucuri");
    addUnique(wafIndicators, "Sucuri");
  }

  if (/caddy/i.test(server)) {
    detectedStack.push(stack("Caddy", "HIGH"));
    addUnique(technologies, "Caddy");
    reverseProxy.family = reverseProxy.family || "Caddy";
    reverseProxy.confidence = reverseProxy.family === "Caddy" ? "HIGH" : reverseProxy.confidence;
    reverseProxy.version = reverseProxy.version || parseServerVersion(server, "Caddy");
    addUnique(reverseProxy.indicators, "Server header");
  }

  if (/traefik/i.test(server) || /x-forwarded-server|x-real-ip/i.test(allText)) {
    detectedStack.push(stack("Traefik", "HIGH"));
    addUnique(reverseProxyCdnWaf, "Traefik");
    reverseProxy.family = reverseProxy.family || "Traefik";
    reverseProxy.confidence = reverseProxy.family === "Traefik" ? "HIGH" : reverseProxy.confidence;
    reverseProxy.version = reverseProxy.version || parseServerVersion(server, "Traefik");
    addUnique(reverseProxy.indicators, /traefik/i.test(server) ? "Server header" : "Forwarded headers");
  }

  if (/haproxy|x-haproxy|set-cookie:.*haproxy/i.test(allText)) {
    detectedStack.push(stack("HAProxy", "MEDIUM"));
    reverseProxy.family = reverseProxy.family || "HAProxy";
    reverseProxy.confidence = reverseProxy.family === "HAProxy" ? "MEDIUM" : reverseProxy.confidence;
    reverseProxy.version = reverseProxy.version || parseServerVersion(server, "HAProxy");
    addUnique(reverseProxy.indicators, "HAProxy header/cookie indicator");
  }

  if (/x-cache|x-varnish|via|cf-ray|cf-cache-status|x-amz-cf|x-cdn/i.test(allText)) {
    addUnique(reverseProxy.indicators, "Proxy/CDN cache or Via header");
  }

  if (/grafana/i.test(server) || target.includes("grafana")) {
    detectedStack.push(stack("Grafana", "MEDIUM"));
    addUnique(technologies, "Grafana");
  }

  if (/prometheus/i.test(server) || target.includes("prometheus")) {
    detectedStack.push(stack("Prometheus", "MEDIUM"));
    addUnique(technologies, "Prometheus");
  }

  if (/express/i.test(poweredBy) || /x-powered-by:\s*express/i.test(allText)) {
    detectedStack.push(stack("Express", "MEDIUM"));
    addUnique(technologies, "Express");
    addUnique(technologies, "Node.js");
  }

  if (/node\.js|nodejs/i.test(allText)) {
    detectedStack.push(stack("Node.js", "LOW"));
    addUnique(technologies, "Node.js");
  }

  if (/laravel|laravel_session|x-csrf-token/i.test(allText)) {
    detectedStack.push(stack("Laravel", "MEDIUM"));
    addUnique(technologies, "Laravel");
    addUnique(technologies, "PHP");
  }

  if (/wordpress|wp-content|wp-includes|wp-json/i.test(allText)) {
    detectedStack.push(stack("WordPress", "HIGH"));
    addUnique(technologies, "WordPress");
  }

  if (/joomla|\/media\/system\/js|com_content/i.test(allText)) {
    detectedStack.push(stack("Joomla", "MEDIUM"));
    addUnique(technologies, "Joomla");
  }

  if (/drupal|\/sites\/default\/|drupal-settings-json/i.test(allText)) {
    detectedStack.push(stack("Drupal", "MEDIUM"));
    addUnique(technologies, "Drupal");
  }

  if (/grafana-app|grafana/i.test(allText)) {
    detectedStack.push(stack("Grafana", "HIGH"));
    addUnique(technologies, "Grafana");
    addAdminPanel(adminPanels, {
      platform: "Grafana",
      confidence: "HIGH",
      authenticationIndicators: ["login surface likely"],
      exposureAssessment: "Administrative observability interface reachable",
      recommendations: ["Require SSO or MFA", "Disable anonymous access", "Restrict access with VPN or IP allowlists"]
    });
  }

  if (/prometheus|prometheus_build_info|\/graph/i.test(allText)) {
    detectedStack.push(stack("Prometheus", "HIGH"));
    addUnique(technologies, "Prometheus");
    addAdminPanel(adminPanels, {
      platform: "Prometheus",
      confidence: "HIGH",
      authenticationIndicators: ["metrics or graph endpoint indicator"],
      exposureAssessment: "Monitoring interface or metrics endpoint reachable",
      recommendations: ["Keep Prometheus on private networks", "Protect UI and metrics endpoints", "Avoid exposing internal labels and target metadata"]
    });
  }

  if (/portainer/i.test(allText)) {
    detectedStack.push(stack("Portainer", "HIGH"));
    addUnique(technologies, "Portainer");
    addAdminPanel(adminPanels, {
      platform: "Portainer",
      confidence: "HIGH",
      authenticationIndicators: ["container administration UI indicator"],
      exposureAssessment: "Container administration interface reachable",
      recommendations: ["Restrict to a private management network", "Require MFA or SSO", "Avoid direct internet exposure"]
    });
  }

  if (/phpmyadmin/i.test(allText)) {
    detectedStack.push(stack("phpMyAdmin", "HIGH"));
    addUnique(technologies, "phpMyAdmin");
    addAdminPanel(adminPanels, {
      platform: "phpMyAdmin",
      confidence: "HIGH",
      authenticationIndicators: ["database administration login indicator"],
      exposureAssessment: "Database administration portal reachable",
      recommendations: ["Move behind VPN or allowlists", "Use strong authentication", "Remove public route when not required"]
    });
  }

  if (/nextcloud/i.test(allText)) {
    detectedStack.push(stack("Nextcloud", "HIGH"));
    addUnique(technologies, "Nextcloud");
    addAdminPanel(adminPanels, {
      platform: "Nextcloud",
      confidence: "MEDIUM",
      authenticationIndicators: ["login or application shell indicator"],
      exposureAssessment: "Self-hosted collaboration portal reachable",
      recommendations: ["Enforce MFA", "Keep server and apps updated", "Review trusted domains and brute-force protections"]
    });
  }

  if (/lnbits/i.test(allText)) {
    detectedStack.push(stack("LNbits", "HIGH"));
    addUnique(technologies, "LNbits");
    addAdminPanel(adminPanels, {
      platform: "LNbits",
      confidence: "HIGH",
      authenticationIndicators: ["wallet administration application indicator"],
      exposureAssessment: "Lightning wallet administration surface reachable",
      recommendations: ["Restrict administrative access", "Protect wallet credentials", "Use TLS and strong access controls"]
    });
  }

  if (/wp-login\.php|wp-admin|wordpress/i.test(allText)) {
    addAdminPanel(adminPanels, {
      platform: "WordPress Admin",
      confidence: /wp-login\.php|wp-admin/i.test(allText) ? "HIGH" : "MEDIUM",
      authenticationIndicators: ["wp-login or WordPress admin indicator"],
      exposureAssessment: "WordPress administrative authentication surface reachable",
      recommendations: ["Protect wp-admin/wp-login with MFA or access rules", "Keep plugins and themes patched", "Limit login automation"]
    });
  }

  if (probe?.adminHints?.length) {
    addUnique(applicationHints, "Login or admin surface indicated by safe page/path checks");
    addUnique(exposureSignals, "Potential administrative UI reachable");
    addUnique(attackSurface.probableRole, "Administrative web interface");
    addAdminPanel(adminPanels, {
      platform: "Generic admin/login portal",
      confidence: "MEDIUM",
      authenticationIndicators: ["admin or login path responded"],
      exposureAssessment: "Administrative or authentication path appears reachable",
      recommendations: ["Confirm intended public exposure", "Require MFA or SSO where possible", "Apply rate limiting and IP allowlists for administration"]
    });
  } else if (/login|sign in|signin|admin panel|dashboard|wp-login/i.test(html)) {
    addUnique(applicationHints, "Login or administrative wording detected in HTML");
    addUnique(exposureSignals, "Potential authentication surface reachable");
    addUnique(attackSurface.probableRole, "Authentication portal");
    addAdminPanel(adminPanels, {
      platform: "Generic admin/login portal",
      confidence: probe?.adminHints?.length ? "MEDIUM" : "LOW",
      authenticationIndicators: ["login wording or admin path response"],
      exposureAssessment: "Authentication surface reachable",
      recommendations: ["Confirm intended public exposure", "Require MFA or SSO where possible", "Apply rate limiting and IP allowlists for administration"]
    });
  }

  if (finalUrl && finalUrl !== probe.url) {
    addUnique(exposureSignals, "HTTP redirect observed");
  }

  // ============================================================
  // SECURITY HEADERS
  // ============================================================

  const securityHeaders = {
    present: [],
    missing: []
  };

  securityHeaderNames.forEach((header) => {
    if (!normalized[header]) {
      securityHeaders.missing.push(header);
      findings.push(finding(
        `Missing security header: ${header}`,
        "MEDIUM",
        `${header} header was not detected.`,
        `Add the ${header} security header to the reverse proxy or web server configuration.`
      ));
    } else {
      securityHeaders.present.push(header);
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
  metadata.finalUrl = finalUrl;
  metadata.responseSize = probe.responseSize || probe.htmlLength || 0;
  metadata.redirectChain = probe.redirectChain || [];
  metadata.securityHeaders = securityHeaders;
  metadata.webServer =
    /nginx/i.test(server) ? "nginx" :
    /apache/i.test(server) ? "Apache" :
    /litespeed/i.test(server) ? "LiteSpeed" :
    server || "";
  metadata.reverseProxyCdnWaf = reverseProxyCdnWaf;
  reverseProxy.metadataDisclosure = Boolean(
    metadata.serverHeader && /\/[0-9]|ubuntu|debian|centos|fedora|php|openssl/i.test(metadata.serverHeader)
  );
  reverseProxy.cdn = cdnIndicators;
  reverseProxy.waf = wafIndicators;
  reverseProxy.exposureAssessment = reverseProxy.family
    ? `${reverseProxy.family} appears to front the service${reverseProxy.metadataDisclosure ? " with metadata disclosure" : ""}.`
    : (cdnIndicators.length || wafIndicators.length)
      ? "CDN or WAF indicators detected, origin proxy family not confirmed."
      : "No reverse proxy family confirmed from headers.";
  reverseProxy.hardening = [
    "Hide precise server and runtime versions where possible",
    "Normalize forwarded headers at the trusted edge",
    "Apply request size, timeout and rate-limit controls",
    "Keep admin routes behind private access controls"
  ];
  metadata.reverseProxy = reverseProxy;
  metadata.cdnIndicators = cdnIndicators;
  metadata.wafIndicators = wafIndicators;
  metadata.adminPanels = adminPanels;
  metadata.applicationHints = applicationHints;
  metadata.exposureSignals = exposureSignals;

  if (reverseProxy.family || cdnIndicators.length || wafIndicators.length) {
    addUnique(attackSurface.probableRole, "Reverse-proxied web service");
  }

  if (adminPanels.length > 0) {
    addUnique(attackSurface.exposure, "Administrative surface detected");
    attackSurface.confidence = adminPanels.some((panel) => panel.confidence === "HIGH") ? "HIGH" : "MEDIUM";
  } else if (technologies.length || reverseProxy.family || metadata.serverHeader) {
    attackSurface.confidence = "MEDIUM";
  }

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
    exposureSignals.push("Security headers incomplete");
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
    technologies: [...new Set(technologies)],
    versions,
    metadata,
    attackSurface
  };
}
