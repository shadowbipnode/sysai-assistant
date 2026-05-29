function finding(title, severity, evidence, remediation) {
  return {
    title,
    severity,
    evidence,
    remediation,
  };
}

export function auditNginxConfig(input) {
  const findings = [];
  const text = String(input || "");

  // HTTP only
  if (/listen\s+80/.test(text) && !/listen\s+443/.test(text)) {
    findings.push(
      finding(
        "HTTP-only virtual host detected",
        "HIGH",
        "The configuration exposes services over HTTP without HTTPS.",
        "Enable HTTPS with TLS certificates and redirect HTTP traffic to HTTPS."
      )
    );
  }

  // Missing HSTS
  if (
    /listen\s+443/.test(text) &&
    !/Strict-Transport-Security/i.test(text)
  ) {
    findings.push(
      finding(
        "Missing HSTS header",
        "MEDIUM",
        "HTTPS is enabled but Strict-Transport-Security header is missing.",
        "Add the Strict-Transport-Security header for HTTPS virtual hosts."
      )
    );
  }

  // Missing security headers
  const securityHeaders = [
    "X-Frame-Options",
    "X-Content-Type-Options",
    "Referrer-Policy",
    "Content-Security-Policy",
  ];

  securityHeaders.forEach((header) => {
    if (!new RegExp(header, "i").test(text)) {
      findings.push(
        finding(
          `Missing security header: ${header}`,
          "MEDIUM",
          `The configuration does not define ${header}.`,
          `Add the ${header} security header.`
        )
      );
    }
  });

  // Missing HTTPS redirect
  if (
    /listen\s+80/.test(text) &&
    !/return\s+301\s+https/i.test(text)
  ) {
    findings.push(
      finding(
        "Missing HTTP to HTTPS redirect",
        "MEDIUM",
        "HTTP traffic is not redirected to HTTPS.",
        "Redirect all HTTP traffic to HTTPS using a 301 redirect."
      )
    );
  }

  // Proxy admin panels
  const riskyPaths = [
    "/admin",
    "/grafana",
    "/prometheus",
    "/lnd",
    "/api",
  ];

  riskyPaths.forEach((path) => {
    if (text.includes(path) && !/auth_basic/i.test(text)) {
      findings.push(
        finding(
          `Potentially exposed admin path: ${path}`,
          "HIGH",
          `The configuration references ${path} without visible auth_basic protection.`,
          "Protect administrative paths with authentication and IP restrictions."
        )
      );
    }
  });

  // Weak TLS
  if (/TLSv1[^.2|.3]/i.test(text)) {
    findings.push(
      finding(
        "Weak TLS protocol detected",
        "HIGH",
        "Legacy TLS versions appear enabled.",
        "Allow only TLSv1.2 and TLSv1.3."
      )
    );
  }

  // Missing rate limiting
  if (/proxy_pass/i.test(text) && !/limit_req/i.test(text)) {
    findings.push(
      finding(
        "Missing rate limiting",
        "LOW",
        "Reverse proxy configuration does not define request rate limiting.",
        "Consider adding rate limiting for login or API endpoints."
      )
    );
  }

  return findings;
}
