function finding(title, severity, evidence, remediation) {
  return { title, severity, evidence, remediation };
}

const COMMON_PORTS = [
  21, 22, 25, 53, 80, 110, 143, 443, 465, 587, 993, 995,
  3000, 3306, 5432, 6379, 8000, 8080, 8443, 9000, 9090, 9200
];

const SERVICE_HINTS = {
  21: "FTP",
  22: "SSH",
  25: "SMTP",
  53: "DNS",
  80: "HTTP",
  443: "HTTPS",
  3000: "Grafana / Node app / dev service",
  3306: "MySQL / MariaDB",
  5432: "PostgreSQL",
  6379: "Redis",
  8080: "HTTP alternate / admin panel",
  8443: "HTTPS alternate",
  9000: "MinIO / Portainer / app service",
  9090: "Prometheus",
  9200: "Elasticsearch"
};

export function buildInfrastructureSummary(target, scanResults = []) {
  const findings = [];
  const openPorts = scanResults.filter((item) => item.status === "open");

  openPorts.forEach((item) => {
    const port = Number(item.port);
    const service = SERVICE_HINTS[port] || item.service || "unknown service";

    if ([3306, 5432, 6379, 9200].includes(port)) {
      findings.push(finding(
        `Sensitive service exposed on port ${port}`,
        "HIGH",
        `${service} appears reachable on ${target}:${port}.`,
        "Restrict this service to localhost, VPN, firewall allowlists or private networks."
      ));
    }

    if ([3000, 8080, 9000, 9090].includes(port)) {
      findings.push(finding(
        `Potential admin or internal web service on port ${port}`,
        "MEDIUM",
        `${service} appears reachable on ${target}:${port}.`,
        "Verify authentication, IP restrictions and reverse proxy hardening."
      ));
    }

    if (port === 22) {
      findings.push(finding(
        "SSH exposed",
        "LOW",
        `SSH appears reachable on ${target}:22.`,
        "Use key-based auth, disable password login and add rate limiting or allowlists."
      ));
    }
  });

  return {
    target,
    scannedPorts: COMMON_PORTS,
    openPorts: openPorts.map((item) => ({
      port: item.port,
      service: SERVICE_HINTS[item.port] || item.service || "unknown",
      banner: item.banner || ""
    })),
    findings
  };
}

export { COMMON_PORTS };
