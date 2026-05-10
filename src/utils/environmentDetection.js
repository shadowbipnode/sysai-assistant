const containsAny = (text, patterns) => {
  const value = String(text || "").toLowerCase();
  return patterns.some((pattern) => value.includes(pattern));
};

const matchAny = (text, patterns) => {
  const value = String(text || "");
  return patterns.some((pattern) => pattern.test(value));
};

export function detectOperationalContext(input = "") {
  const text = String(input || "");
  const lower = text.toLowerCase();

  const signals = [];

  const addSignal = (id, label, confidence, evidence) => {
    signals.push({ id, label, confidence, evidence });
  };

  if (containsAny(lower, ["docker", "docker compose", "compose.yml", "overlay2", "container"])) {
    addSignal("docker", "Docker/Compose", "HIGH", "Docker-related terms detected");
  }

  if (containsAny(lower, ["kubernetes", "kubectl", "k8s", "pod/", "deployment/", "namespace"])) {
    addSignal("kubernetes", "Kubernetes", "HIGH", "Kubernetes-related terms detected");
  }

  if (containsAny(lower, ["nginx", "apache", "reverse proxy", "proxy_pass", "502 bad gateway", "upstream"])) {
    addSignal("reverse_proxy", "Reverse proxy", "HIGH", "Reverse proxy/web server terms detected");
  }

  if (containsAny(lower, ["systemd", "journalctl", "systemctl", "failed with result", ".service"])) {
    addSignal("systemd", "systemd/Linux service", "HIGH", "systemd/service logs detected");
  }

  if (containsAny(lower, ["ufw", "iptables", "nftables", "firewalld", "fail2ban"])) {
    addSignal("firewall", "Firewall/hardening", "MEDIUM", "Firewall/security tooling detected");
  }

  if (containsAny(lower, ["postgres", "postgresql", "mysql", "mariadb", "redis", "mongodb"])) {
    addSignal("database", "Database", "MEDIUM", "Database terms detected");
  }

  if (containsAny(lower, ["bitcoin core", "bitcoind", "lnd", "lightning", "lnbits", "tor hidden service", ".onion"])) {
    addSignal("bitcoin_lightning", "Bitcoin/Lightning/Tor", "HIGH", "Bitcoin/Lightning/Tor stack detected");
  }

  if (containsAny(lower, ["prometheus", "grafana", "node_exporter", "cadvisor", "uptime-kuma"])) {
    addSignal("monitoring", "Monitoring/observability", "MEDIUM", "Monitoring stack detected");
  }

  if (containsAny(lower, ["vps", "hetzner", "contabo", "digitalocean", "aws", "ec2", "gcp", "oracle cloud"])) {
    addSignal("cloud_vps", "Cloud/VPS", "MEDIUM", "Cloud/VPS terms detected");
  }

  if (matchAny(text, [/port\s+22/i, /ssh/i, /openssh/i, /failed password/i])) {
    addSignal("ssh", "SSH", "HIGH", "SSH-related signals detected");
  }

  if (matchAny(text, [/tls/i, /ssl/i, /certificate/i, /cipher/i, /https/i])) {
    addSignal("tls", "TLS/HTTPS", "MEDIUM", "TLS/HTTPS terms detected");
  }

  const remoteObservation =
    containsAny(lower, ["remote scan", "port scan", "tls check", "ssh audit", "scan output"]) ||
    matchAny(text, [/port scan:/i, /tls check/i, /ssh audit/i]);

  const ownershipUnknown =
    remoteObservation &&
    !containsAny(lower, ["my server", "my infrastructure", "owned", "managed by me", "i manage", "i own"]);

  const destructiveRisk =
    containsAny(lower, ["rm -rf", "mkfs", "iptables -f", "nft flush", "systemctl restart", "docker system prune", "delete", "wipe"]);

  const recommendations = [];

  if (ownershipUnknown) {
    recommendations.push("Treat remote scan findings as observation unless infrastructure ownership is confirmed.");
  }

  if (destructiveRisk) {
    recommendations.push("Prefer read-only diagnostics before destructive or service-impacting remediation.");
  }

  if (signals.some((s) => s.id === "docker") && signals.some((s) => s.id === "reverse_proxy")) {
    recommendations.push("For Docker + reverse proxy failures, verify container state and upstream reachability before changing nginx config.");
  }

  if (signals.some((s) => s.id === "bitcoin_lightning")) {
    recommendations.push("Protect RPC, macaroon/TLS material, wallet data and Tor privacy before recommending changes.");
  }

  return {
    signals,
    detected_stack: signals.map((s) => s.label),
    remote_observation: remoteObservation,
    ownership_unknown: ownershipUnknown,
    destructive_risk: destructiveRisk,
    recommendations,
  };
}

export function formatOperationalContext(context) {
  if (!context) return "";

  const lines = [];

  if (context.detected_stack?.length) {
    lines.push(`Detected operational context: ${context.detected_stack.join(", ")}`);
  }

  if (context.remote_observation) {
    lines.push(`Remote observation mode: true`);
  }

  if (context.ownership_unknown) {
    lines.push(`Ownership/control of the target is unknown.`);
  }

  if (context.destructive_risk) {
    lines.push(`Potential destructive/service-impacting action detected.`);
  }

  if (context.recommendations?.length) {
    lines.push(`Operational guidance:`);
    context.recommendations.forEach((item) => lines.push(`- ${item}`));
  }

  return lines.length ? lines.join("\n") : "";
}
