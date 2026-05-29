function finding(title, severity, evidence, remediation) {
  return {
    title,
    severity,
    evidence,
    remediation,
  };
}

export function auditDockerCompose(input) {
  const findings = [];
  const text = String(input || "");

  // docker.sock exposure
  if (
    text.includes("/var/run/docker.sock:/var/run/docker.sock")
  ) {
    findings.push(
      finding(
        "Docker socket exposed to container",
        "CRITICAL",
        "The compose file mounts the Docker daemon socket inside a container.",
        "Avoid mounting docker.sock unless absolutely necessary."
      )
    );
  }

  // privileged container
  if (/privileged\s*:\s*true/i.test(text)) {
    findings.push(
      finding(
        "Privileged container enabled",
        "HIGH",
        "A container is running with privileged=true.",
        "Remove privileged mode and grant only required capabilities."
      )
    );
  }

  // host networking
  if (/network_mode\s*:\s*["']?host["']?/i.test(text)) {
    findings.push(
      finding(
        "Host networking enabled",
        "HIGH",
        "The compose file uses host networking.",
        "Prefer bridge networking unless host mode is strictly required."
      )
    );
  }

  // latest tag
  if (/:latest\b/i.test(text)) {
    findings.push(
      finding(
        "Container uses latest tag",
        "MEDIUM",
        "One or more containers use the latest tag.",
        "Pin container images to explicit versions."
      )
    );
  }

  // missing healthcheck
  if (!/healthcheck\s*:/i.test(text)) {
    findings.push(
      finding(
        "Missing container healthchecks",
        "MEDIUM",
        "No healthcheck configuration detected.",
        "Add healthchecks for operational visibility and restart reliability."
      )
    );
  }

  // public database exposure
  const riskyPorts = [
    "3306",
    "5432",
    "6379",
    "27017",
  ];

  riskyPorts.forEach((port) => {
    const regex = new RegExp(`["']?${port}:${port}["']?`);

    if (regex.test(text)) {
      findings.push(
        finding(
          `Database port ${port} publicly exposed`,
          "HIGH",
          `The compose file exposes database port ${port} to the host.`,
          "Bind database services to localhost or internal Docker networks only."
        )
      );
    }
  });

  // restart policy
  if (!/restart\s*:/i.test(text)) {
    findings.push(
      finding(
        "No restart policy configured",
        "LOW",
        "Containers do not define restart policies.",
        "Use unless-stopped or always for critical infrastructure services."
      )
    );
  }

  return findings;
}
