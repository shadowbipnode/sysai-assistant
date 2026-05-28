export const SERVICE_MAP = {
  21: { service: "ftp", severity: "HIGH" },
  22: { service: "ssh", severity: "LOW" },
  23: { service: "telnet", severity: "CRITICAL" },
  25: { service: "smtp", severity: "MEDIUM" },
  53: { service: "dns", severity: "MEDIUM" },
  80: { service: "http", severity: "LOW" },
  88: { service: "kerberos", severity: "HIGH" },
  110: { service: "pop3", severity: "HIGH" },
  123: { service: "ntp", severity: "LOW" },
  135: { service: "msrpc", severity: "MEDIUM" },
  137: { service: "netbios-ns", severity: "LOW" },
  139: { service: "netbios-ssn", severity: "MEDIUM" },
  143: { service: "imap", severity: "HIGH" },
  389: { service: "ldap", severity: "HIGH" },
  443: { service: "https", severity: "LOW" },
  445: { service: "microsoft-ds", severity: "CRITICAL" },
  514: { service: "syslog", severity: "MEDIUM" },
  636: { service: "ldaps", severity: "MEDIUM" },
  993: { service: "imaps", severity: "LOW" },
  995: { service: "pop3s", severity: "LOW" },
  1433: { service: "mssql", severity: "HIGH" },
  1521: { service: "oracle", severity: "HIGH" },
  2375: { service: "docker", severity: "CRITICAL" },
  3000: { service: "grafana", severity: "HIGH" },
  3306: { service: "mysql", severity: "HIGH" },
  3389: { service: "rdp", severity: "HIGH" },
  5432: { service: "postgresql", severity: "HIGH" },
  5900: { service: "vnc", severity: "HIGH" },
  6379: { service: "redis", severity: "CRITICAL" },
  8080: { service: "http-alt", severity: "MEDIUM" },
  8443: { service: "https-alt", severity: "MEDIUM" },
  9090: { service: "prometheus", severity: "HIGH" },
  9200: { service: "elasticsearch", severity: "HIGH" },
  9735: { service: "lightning", severity: "LOW" },
  10009: { service: "lnd-grpc", severity: "CRITICAL" },
  27017: { service: "mongodb", severity: "HIGH" }
};

export function classifyService(port) {
  return SERVICE_MAP[Number(port)] || {
    service: "unknown",
    severity: "UNKNOWN"
  };
}

export function buildServiceMatrix(openPorts = []) {
  return openPorts.map((port) => {
    const info = classifyService(port);

    return {
      port: Number(port),
      service: info.service,
      severity: info.severity,
      probes: getRecommendedProbes(info.service)
    };
  });
}

export function getRecommendedProbes(service) {
  switch (service) {
    case "ssh":
      return ["ssh-audit"];

    case "http":
    case "https":
    case "http-alt":
    case "https-alt":
    case "grafana":
      return ["http-fingerprint", "tls-check"];

    case "mysql":
    case "postgresql":
    case "redis":
    case "mssql":
    case "oracle":
    case "mongodb":
    case "elasticsearch":
      return ["database-exposure-analysis"];

    case "docker":
      return ["docker-api-exposure-analysis"];

    case "prometheus":
      return ["metrics-exposure-analysis"];

    case "rdp":
    case "vnc":
    case "telnet":
      return ["remote-access-exposure-analysis"];

    case "lnd-grpc":
    case "lightning":
      return ["lightning-exposure-analysis"];

    case "ldap":
    case "ldaps":
    case "kerberos":
    case "microsoft-ds":
    case "netbios-ssn":
    case "msrpc":
      return ["windows-domain-exposure-analysis"];

    case "ftp":
    case "smtp":
    case "imap":
    case "pop3":
      return ["legacy-service-exposure-analysis"];

    default:
      return [];
  }
}
