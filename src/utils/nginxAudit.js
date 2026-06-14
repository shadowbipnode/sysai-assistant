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

  if (/\bTLSv1(?:\s|;)|\bTLSv1\.1\b/i.test(text)) {
    findings.push(
      finding(
        "Weak TLS protocol detected",
        "HIGH",
        "Legacy TLS versions appear enabled.",
        "Allow only TLSv1.2 and TLSv1.3."
      )
    );
  }

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

  if (/proxy_pass\s+http:\/\/[^;\s]+/i.test(text) && !/proxy_set_header\s+X-Forwarded-Proto/i.test(text)) {
    findings.push(
      finding(
        "Missing forwarded protocol header",
        "MEDIUM",
        "The proxy forwards to an HTTP upstream without an X-Forwarded-Proto header.",
        "Set X-Forwarded-Proto so upstream applications can enforce secure URL generation and redirects."
      )
    );
  }

  if (/proxy_pass/i.test(text) && !/proxy_read_timeout|proxy_connect_timeout/i.test(text)) {
    findings.push(
      finding(
        "Proxy timeout defaults not visible",
        "LOW",
        "Reverse proxy timeout settings were not found.",
        "Set explicit connect/read/send timeouts that match the upstream service behavior."
      )
    );
  }

  if (/websocket|upgrade/i.test(text) && !/proxy_set_header\s+Upgrade/i.test(text)) {
    findings.push(
      finding(
        "Incomplete websocket proxy headers",
        "MEDIUM",
        "The configuration appears to handle websocket traffic without a visible Upgrade header.",
        "Add Upgrade and Connection headers for websocket locations and test with a read-only client request."
      )
    );
  }

  if (/(traefik\.|api\.insecure|insecure\s*=\s*true)/i.test(text) && /insecure\s*=\s*true|api\.insecure\s*=\s*true/i.test(text)) {
    findings.push(
      finding(
        "Traefik insecure dashboard enabled",
        "HIGH",
        "Traefik dashboard/API insecure mode appears enabled.",
        "Disable insecure dashboard exposure or protect it behind authentication and trusted network restrictions."
      )
    );
  }

  if (/Caddyfile|reverse_proxy|respond|handle_path/i.test(text) && /reverse_proxy/i.test(text) && !/header\s+Strict-Transport-Security/i.test(text)) {
    findings.push(
      finding(
        "Caddy reverse proxy missing visible HSTS",
        "MEDIUM",
        "A Caddy reverse proxy pattern is present without a visible HSTS header.",
        "Add HSTS for HTTPS sites where subdomain policy is understood and safe."
      )
    );
  }

  return findings;
}
