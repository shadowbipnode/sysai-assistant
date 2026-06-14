import { useState } from "react";
import ProfessionalResult from "./ProfessionalResult";
import LocalSecurityResult from "./LocalSecurityResult";
import NetworkVisibility from "./NetworkVisibility";
import { portScan, tlsCheck, sshAudit, httpHeadersCheck, advancedHttpProbe, ftpProbe, sshBanner, sshAuditProbe, tcpServiceProbe } from "../utils/scanners";
import { detectSecrets } from "../utils/secretDetector";
import { auditDockerCompose } from "../utils/dockerAudit";
import { auditPermissions } from "../utils/permissionAudit";
import { auditNginxConfig } from "../utils/nginxAudit";
import { auditPrivacyExposure } from "../utils/privacyExposure";
import { buildInfrastructureSummary, COMMON_PORTS } from "../utils/infrastructureIntel";
import { fingerprintHttp } from "../utils/httpFingerprint";
import { buildServiceMatrix } from "../utils/serviceOrchestrator";
import { comparePortExposure, loadWatcherBaselines, saveWatcherBaseline } from "../utils/serviceWatcher";
import { parseSshAudit } from "../utils/sshAuditParser";
import { buildAttackSurfaceSummary, calculateGlobalRisk } from "../utils/exposureRiskEngine";

const localTextScanTypes = ["secrets", "docker", "permissions", "nginx", "privacy"];

const SecurityAuditor = ({ t, onAudit, onScan, onLocalResult, onBack }) => {
  const [mode, setMode] = useState(0);
  const [inputType, setInputType] = useState(0);
  const [sourceText, setSourceText] = useState("");
  const [targetHost, setTargetHost] = useState("");
  const [scanType, setScanType] = useState("ports");
  const [scanPorts, setScanPorts] = useState("22,80,443,3306,5432");
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [localResult, setLocalResult] = useState(null);
  const [showNetworkVisibility, setShowNetworkVisibility] = useState(false);
  const [watcherBaseline, setWatcherBaseline] = useState(null);

  const updateProgress = (percent, label) => {
    setProgress({ percent, label });
  };

  const changeScanType = (nextType) => {
    setScanType(nextType);
    setResult(null);
    setLocalResult(null);
    setProgress(null);
  };

  const changeMode = (nextMode) => {
    setMode(nextMode);
    setScanType(nextMode === 1 ? "ports" : nextMode === 2 ? "secrets" : scanType);
    setResult(null);
    setLocalResult(null);
    setProgress(null);
  };

  const formatTlsCheck = (result) => {
    let output = `TLS Check for ${result.host}:${result.port}\n`;
    output += `Protocol: ${result.protocol || 'N/A'}\n`;
    output += `Cipher: ${result.cipher?.name || 'N/A'} (${result.cipher?.bits || '?'} bits)\n`;
    if (result.certificate) {
      output += `Certificate: ${result.certificate.subject?.CN || 'N/A'}\n`;
      output += `Valid until: ${result.certificate.valid_to || 'N/A'}\n`;
    }
    if (result.warnings?.length) {
      output += `Warnings: ${result.warnings.join(', ')}\n`;
    }
    return output;
  };

  const formatPortResults = (result) => {
    if (!result?.results) return "Nessun risultato";
    
    const open = result.results.filter(r => r.status === 'open');
    const closed = result.results.filter(r => r.status === 'closed');
    const filtered = result.results.filter(r => r.status === 'filtered');
    
    let output = `Port Scan: ${result.target}\n`;
    output += `Open: ${open.length} | Closed: ${closed.length} | Filtered: ${filtered.length}\n\n`;
    
    if (open.length > 0) {
      output += `PORT      STATE   SERVICE       BANNER\n`;
      open.forEach(r => {
        const port = String(r.port).padEnd(8);
        const state = 'open'.padEnd(8);
        const service = (r.service || 'unknown').padEnd(14);
        const banner = r.banner || '';
        output += `${port}${state}${service}${banner}\n`;
      });
    }
    return output;
  };

  const devLog = (...args) => {
    if (import.meta.env.DEV) {
      console.log(...args);
    }
  };

  const normalizeScanTarget = (value = "") => {
    const raw = String(value || "").trim();

    if (!raw) return "";

    try {
      const withProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw)
        ? raw
        : `http://${raw}`;
      const parsed = new URL(withProtocol);
      return parsed.hostname || raw;
    } catch {
      return raw
        .replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, "")
        .split("/")[0]
        .split("?")[0]
        .split("#")[0]
        .trim();
    }
  };

  const sanitizeInfrastructurePayload = (scanResult) => {
    const summarizeWebIntel = (webIntelData = {}) => Object.fromEntries(
      Object.entries(webIntelData).map(([port, intel]) => [port, {
        port: intel?.port,
        service: intel?.service,
        url: intel?.url,
        status: intel?.status,
        title: intel?.advancedProbe?.title || "",
        technologies: intel?.fingerprint?.technologies || [],
        findings: (intel?.fingerprint?.findings || []).map((finding) => ({
          title: finding.title,
          severity: finding.severity,
          evidence: finding.evidence,
          remediation: finding.remediation,
        })),
        securityHeaders: intel?.fingerprint?.metadata?.securityHeaders,
        adminPanels: intel?.fingerprint?.metadata?.adminPanels || [],
        redirectChain: intel?.advancedProbe?.redirectChain || [],
      }])
    );

    return {
      title: scanResult.title,
      target: normalizeScanTarget(targetHost),
      findings: (scanResult.findings || []).map((finding) => ({
        title: finding.title,
        severity: finding.severity,
        evidence: finding.evidence,
        remediation: finding.remediation,
      })),
      detectedStack: scanResult.detectedStack || [],
      openPorts: scanResult.openPorts || [],
      serviceMatrix: scanResult.serviceMatrix || [],
      exposureRisk: scanResult.exposureRisk,
      attackSurfaceSummary: scanResult.attackSurfaceSummary,
      recommendations: (scanResult.findings || []).map((finding) => finding.remediation).filter(Boolean),
      webIntelData: summarizeWebIntel(scanResult.webIntelData),
      redirectedHostData: scanResult.redirectedHostData ? {
        host: scanResult.redirectedHostData.host,
        openPorts: scanResult.redirectedHostData.openPorts || [],
        serviceMatrix: scanResult.redirectedHostData.serviceMatrix || [],
        httpData: scanResult.redirectedHostData.httpData ? {
          url: scanResult.redirectedHostData.httpData.url,
          status: scanResult.redirectedHostData.httpData.status,
          title: scanResult.redirectedHostData.httpData.advancedProbe?.title || "",
          technologies: scanResult.redirectedHostData.httpData.fingerprint?.technologies || [],
        } : null,
      } : null,
    };
  };


  const addFindingOnce = (findings, finding) => {
    const key = String(finding.title || "").toLowerCase();
    if (!key) return;
    if (!findings.some((item) => String(item.title || "").toLowerCase() === key)) {
      findings.push(finding);
    }
  };

  const hasService = (serviceMatrix, services) =>
    serviceMatrix.some((item) => services.includes(item.service));

  const generateInfrastructureFindings = ({
    target,
    serviceMatrix,
    findings,
    webIntelData,
    serviceProbeData,
    sshAuditData,
    tlsData
  }) => {
    const mailServices = ["smtp", "smtps", "submission", "imap", "imaps", "pop3", "pop3s"];
    const databaseServices = ["mysql", "postgresql", "redis", "mongodb", "mssql", "oracle", "elasticsearch"];
    const remoteServices = ["ssh", "rdp", "vnc", "telnet", "ftp"];
    const legacyServices = ["ftp", "telnet", "pop3", "imap"];

    if (hasService(serviceMatrix, mailServices)) {
      addFindingOnce(findings, {
        title: "Public mail infrastructure",
        severity: "MEDIUM",
        evidence: `Mail services are reachable on ${target}: ${serviceMatrix.filter((item) => mailServices.includes(item.service)).map((item) => `${item.service}/${item.port}`).join(", ")}.`,
        remediation: "Confirm this host is intended to receive or relay mail, require TLS where supported, and restrict administrative mail interfaces."
      });
    }

    if (hasService(serviceMatrix, databaseServices)) {
      addFindingOnce(findings, {
        title: "Public database exposure",
        severity: "HIGH",
        evidence: `Database-oriented services are reachable on ${target}: ${serviceMatrix.filter((item) => databaseServices.includes(item.service)).map((item) => `${item.service}/${item.port}`).join(", ")}.`,
        remediation: "Move databases behind private networking, VPN, firewall allowlists, or service mesh controls before accepting production traffic."
      });
    }

    if (hasService(serviceMatrix, remoteServices)) {
      addFindingOnce(findings, {
        title: "Remote administration exposure",
        severity: hasService(serviceMatrix, ["telnet", "rdp", "vnc"]) ? "HIGH" : "MEDIUM",
        evidence: `Remote access services are reachable on ${target}: ${serviceMatrix.filter((item) => remoteServices.includes(item.service)).map((item) => `${item.service}/${item.port}`).join(", ")}.`,
        remediation: "Restrict remote administration to VPN, bastion hosts, allowlisted source IPs, and strong authentication."
      });
    }

    const webIntelValues = Object.values(webIntelData || {});
    const wordpressPorts = webIntelValues
      .filter((intel) =>
        intel?.advancedProbe?.fingerprint?.wordpress ||
        (intel?.fingerprint?.technologies || []).some((item) => /wordpress/i.test(item))
      )
      .map((intel) => intel.port)
      .filter(Boolean);

    if (wordpressPorts.length > 0) {
      addFindingOnce(findings, {
        title: "WordPress detected",
        severity: "MEDIUM",
        evidence: `WordPress indicators were detected on port(s): ${[...new Set(wordpressPorts)].join(", ")}.`,
        remediation: "Keep WordPress core, plugins and themes patched, reduce version disclosure, and protect wp-admin/wp-login with MFA or access restrictions."
      });
    }

    const adminPorts = webIntelValues
      .filter((intel) =>
        intel?.advancedProbe?.fingerprint?.loginPanel ||
        intel?.advancedProbe?.fingerprint?.adminPath ||
        intel?.advancedProbe?.fingerprint?.phpmyadmin ||
        intel?.advancedProbe?.adminHints?.length ||
        (intel?.fingerprint?.metadata?.adminPanels || []).length ||
        (intel?.fingerprint?.technologies || []).some((item) => /grafana|prometheus|phpmyadmin|portainer|nextcloud|lnbits/i.test(item))
      )
      .map((intel) => intel.port)
      .filter(Boolean);

    if (adminPorts.length > 0) {
      addFindingOnce(findings, {
        title: "Admin panel detected",
        severity: "MEDIUM",
        evidence: `Login or administrative panel indicators were detected on port(s): ${[...new Set(adminPorts)].join(", ")}.`,
        remediation: "Place administrative panels behind SSO, MFA, VPN, IP allowlists, or a private management network."
      });
    }

    Object.values(serviceProbeData || {}).forEach((probe) => {
      if (probe?.database?.isDatabase) {
        const vendor = probe.database.vendor || probe.service;
        const auth = probe.database.auth || "unknown";
        const unauthenticated = auth === "not-required-or-ping-allowed" || probe.database.redisPongWithoutAuth || probe.database.redisInfoAvailable;
        addFindingOnce(findings, {
          title: `${vendor} database exposure`,
          severity: unauthenticated ? "CRITICAL" : "HIGH",
          evidence: `${vendor} is reachable on ${target}:${probe.port}${probe.database.version ? ` and discloses version ${probe.database.version}` : ""}. Authentication posture: ${auth}.`,
          remediation: "Keep database listeners on private networks, enforce authentication, and allowlist only trusted application hosts."
        });
      }

      if (probe?.docker?.apiReachable) {
        addFindingOnce(findings, {
          title: "Docker remote administration exposure",
          severity: "CRITICAL",
          evidence: `Docker API is reachable on ${target}:${probe.port}${probe.docker.tlsPresent ? ` with TLS ${probe.docker.tlsProtocol || "enabled"}` : " without confirmed TLS"}.`,
          remediation: "Disable public Docker API exposure. Bind dockerd to localhost or a private management network and require mutual TLS for any remote administration."
        });
      }
    });

    if (hasService(serviceMatrix, legacyServices)) {
      addFindingOnce(findings, {
        title: "Legacy service detected",
        severity: hasService(serviceMatrix, ["telnet", "ftp"]) ? "HIGH" : "MEDIUM",
        evidence: `Legacy services are reachable: ${serviceMatrix.filter((item) => legacyServices.includes(item.service)).map((item) => `${item.service}/${item.port}`).join(", ")}.`,
        remediation: "Replace cleartext or legacy protocols with modern TLS-protected alternatives and disable unused listeners."
      });
    }

    const weakCryptoEvidence = [];
    if (sshAuditData?.parsed?.failures?.length) {
      weakCryptoEvidence.push(`SSH audit reported ${sshAuditData.parsed.failures.length} crypto failure(s).`);
    }
    if (sshAuditData?.parsed?.score !== undefined && sshAuditData.parsed.score < 70) {
      weakCryptoEvidence.push(`SSH crypto score is ${sshAuditData.parsed.score}/100.`);
    }
    if (tlsData?.warnings?.length) {
      weakCryptoEvidence.push(`TLS warnings: ${tlsData.warnings.join(", ")}.`);
    }
    Object.values(serviceProbeData || {}).forEach((probe) => {
      if (probe?.mail?.starttls === false && probe?.mail?.implicitTls === false) {
        weakCryptoEvidence.push(`Mail service on port ${probe.port} did not advertise TLS.`);
      }
    });

    if (weakCryptoEvidence.length > 0) {
      addFindingOnce(findings, {
        title: "Weak crypto detected",
        severity: "MEDIUM",
        evidence: weakCryptoEvidence.join(" "),
        remediation: "Remove legacy algorithms, require TLS for supported protocols, and re-test exposed services after configuration changes."
      });
    }
  };

  const getWebProbeConfig = (service, port) => {
    if (["https", "https-alt"].includes(service)) return { protocol: "https", port };
    if (service === "docker" && Number(port) === 2376) return { protocol: "https", port };
    if (["http", "http-alt", "grafana", "prometheus", "docker", "elasticsearch"].includes(service)) {
      return { protocol: "http", port };
    }
    return null;
  };

  const buildHttpIntel = async (host, service, port) => {
    const config = getWebProbeConfig(service, Number(port));
    if (!config) return null;

    let headersResult = await httpHeadersCheck(host, config);

    if (!headersResult?.success && config.protocol === "https") {
      headersResult = await httpHeadersCheck(host, {
        protocol: "http",
        port
      });
    }

    if (!headersResult?.success || !headersResult.headers) {
      return headersResult || null;
    }

    const advancedProbe = await advancedHttpProbe(host, {
      protocol: headersResult.url?.startsWith("https:") ? "https" : config.protocol,
      port
    });

    const fingerprint = fingerprintHttp(
      {
        ...headersResult.headers,
        ...(advancedProbe?.headers || {})
      },
      host,
      advancedProbe
    );

    const intel = {
      ...headersResult,
      port,
      service,
      advancedProbe,
      fingerprint
    };

    devLog("HTTP intelligence", {
      host,
      port,
      service,
      status: headersResult.status,
      title: advancedProbe?.title || ""
    });

    return intel;
  };

  const handleAudit = async (targetOverride = null) => {
    const effectiveTarget = normalizeScanTarget(
      typeof targetOverride === "string" && targetOverride.trim()
        ? targetOverride
        : targetHost
    );

    if (mode === 0 && !sourceText.trim()) return;
    if (mode === 1 && !effectiveTarget.trim()) return;
    if (mode === 2 && !sourceText.trim()) return;
    
    setAnalyzing(true);
    setResult(null);
    setLocalResult(null);
    updateProgress(5, "Preparing audit workflow...");
    let response;
    
    if (mode === 0) {
      const inputTypeName = t.securityAuditorPage.types[inputType];
      updateProgress(35, "Analyzing configuration...");
      response = await onAudit(inputTypeName, sourceText);
      updateProgress(95, "Preparing operational report...");
    } else {
      try {
        let scanResult;
        if (scanType === "ports") {
          updateProgress(20, "Running port scan...");
          scanResult = await portScan(effectiveTarget, { ports: scanPorts });
          if (scanResult.success) {
            updateProgress(65, "Parsing port scan results...");
            const output = formatPortResults(scanResult);
            updateProgress(85, "AI analysis in progress. Local models may take longer...");
            response = await onScan(effectiveTarget, scanType, output);
          } else {
            response = { report: `Errore scan: ${scanResult.error}`, recommendations: "Verifica che il target sia raggiungibile" };
          }
        } else if (scanType === "ssl") {
          updateProgress(20, "Running TLS handshake check...");
          scanResult = await tlsCheck(effectiveTarget, 443);
          if (scanResult.success) {
            updateProgress(65, "Parsing TLS certificate data...");
            const output = formatTlsCheck(scanResult);
            updateProgress(85, "AI analysis in progress. Local models may take longer...");
            response = await onScan(effectiveTarget, scanType, output);
          } else {
            response = { report: `Errore TLS: ${scanResult.error}`, recommendations: "Verifica che il target supporti HTTPS" };
          }
        } else if (scanType === "ssh") {
          updateProgress(20, "Running SSH audit...");
          scanResult = await sshAudit(effectiveTarget, 22);
          if (scanResult.success) {
            updateProgress(70, "Parsing SSH audit output...");
            updateProgress(85, "AI analysis in progress. Local models may take longer...");
            response = await onScan(effectiveTarget, scanType, scanResult.output);
          } else {
            response = { report: `Errore SSH: ${scanResult.output}`, recommendations: "Verifica che il target abbia SSH sulla porta 22" };
          }
        } else if (scanType === "secrets") {
          updateProgress(20, "Running local secret detection...");

          const findings = detectSecrets(sourceText);

          updateProgress(70, "Preparing operational security report...");

          if (findings.length === 0) {
            response = {
              severity: "LOW",
              confidence: "HIGH",
              requires_sudo: false,
              detected_stack: ["local-analysis", "secret-detection"],
              title: "No obvious secrets detected",
              summary: "No known secrets or high-entropy tokens were detected in the provided input.",
              root_cause: "No direct secret pattern matched the provided content.",
              next_best_action: "Review the input manually if it contains custom or proprietary secret formats.",
              evidence: [],
              assumptions: [
                "Only pattern-based and entropy-based detection was performed.",
                "Unknown custom token formats may not be detected."
              ],
              remediation_safety: "READ_ONLY_SAFE",
              evidence_quality: "DIRECT_EVIDENCE",
              rollback_confidence: "ROLLBACK_NOT_REQUIRED",
              verification_strength: "STRONG_VERIFICATION",
              verification_reason: "The analysis was fully local and directly inspected the provided input.",
              verification_limitations: [
                "Custom internal token formats may not match known patterns.",
                "Entropy detection may miss short secrets."
              ],
              fix_commands: [
                "# No remediation required from this scan result"
              ],
              verification_commands: [
                "# Re-run the scan after adding or changing configuration content"
              ],
              rollback_commands: [
                "No rollback needed for read-only checks."
              ],
              recommendations: [
                "Keep secrets outside source-controlled configuration files.",
                "Use environment-specific secret storage where possible."
              ],
              prevention: "Use pre-commit secret scanning before committing configuration files."
            };
          } else {
            response = {
              severity: findings.some((f) => f.severity === "CRITICAL")
                ? "CRITICAL"
                : findings.some((f) => f.severity === "HIGH")
                  ? "HIGH"
                  : "MEDIUM",
              confidence: "HIGH",
              requires_sudo: false,
              detected_stack: ["local-analysis", "secret-detection"],
              title: "Potential secrets and sensitive credentials detected",
              summary: `Detected ${findings.length} possible secrets or sensitive values inside the provided content.`,
              root_cause: "The provided content appears to contain hardcoded credentials, tokens, private keys, or high-entropy secret-like values.",
              next_best_action: "Remove the exposed secret from the file and rotate the credential if it was committed, shared, or deployed.",
              evidence: findings.map((f) => `${f.type}: ${f.value}`),
              assumptions: [
                "Pattern-based detection may produce false positives.",
                "Manual verification is recommended before rotating production credentials."
              ],
              remediation_safety: "REVERSIBLE_SAFE",
              evidence_quality: "DIRECT_EVIDENCE",
              rollback_confidence: "ROLLBACK_NOT_REQUIRED",
              verification_strength: "STRONG_VERIFICATION",
              verification_reason: "The detector directly analyzed the provided content locally using deterministic matching.",
              verification_limitations: [
                "Unknown custom token formats may not be detected.",
                "Masked or partially redacted secrets may not be classified correctly."
              ],
              fix_commands: [
                "# Move secrets out of plaintext config files",
                "# Rotate any exposed credentials before redeploying",
                "# Replace hardcoded values with environment variables or a secret manager"
              ],
              verification_commands: [
                "# Re-run Secret Detection after removing the exposed value",
                "# Verify the application still starts with the new secret source"
              ],
              rollback_commands: [
                "No rollback needed for read-only checks."
              ],
              recommendations: [
                "Move secrets into environment variables, Docker secrets, or a dedicated secret manager.",
                "Rotate exposed credentials immediately if they were committed, shared, or deployed.",
                "Avoid storing plaintext credentials inside compose files, scripts, or repository-tracked configs."
              ].join("\n"),
              prevention: [
                "Use .gitignore for local secret files.",
                "Add secret scanning to pre-commit or CI workflows.",
                "Prefer short-lived tokens and scoped credentials."
              ].join("\n")
            };
          }

          updateProgress(90, "Secret analysis complete...");
        } else if (scanType === "docker") {
          updateProgress(20, "Running local Docker Compose audit...");

          const findings = auditDockerCompose(sourceText);

          updateProgress(70, "Preparing Docker security report...");

          response = {
            severity: findings.some((f) => f.severity === "CRITICAL")
              ? "CRITICAL"
              : findings.some((f) => f.severity === "HIGH")
                ? "HIGH"
                : findings.some((f) => f.severity === "MEDIUM")
                  ? "MEDIUM"
                  : "LOW",
            confidence: "HIGH",
            requires_sudo: false,
            detected_stack: ["docker", "compose", "local-analysis"],
            title: findings.length > 0
              ? "Docker Compose security exposure detected"
              : "No obvious Docker Compose exposure detected",
            summary: findings.length > 0
              ? `Detected ${findings.length} Docker Compose security or operational hardening findings.`
              : "No obvious high-risk Docker Compose patterns were detected in the provided input.",
            root_cause: findings.length > 0
              ? "The compose file contains one or more risky container runtime, networking, exposure, or hardening patterns."
              : "No direct risky Docker Compose pattern matched the provided content.",
            next_best_action: findings.length > 0
              ? "Review exposed ports, privileged containers and Docker socket mounts before deploying."
              : "Manually review environment-specific requirements and exposed ports before production deployment.",
            evidence: findings.map((f) => `${f.title}: ${f.evidence}`),
            assumptions: [
              "This audit is based on static Docker Compose text analysis.",
              "Runtime container state, firewall rules and reverse proxy exposure were not verified."
            ],
            remediation_safety: "READ_ONLY_SAFE",
            evidence_quality: findings.length > 0 ? "DIRECT_EVIDENCE" : "PARTIAL_EVIDENCE",
            rollback_confidence: "ROLLBACK_NOT_REQUIRED",
            verification_strength: "STRONG_VERIFICATION",
            verification_reason: "The detector directly analyzed the provided Docker Compose content locally.",
            verification_limitations: [
              "This does not prove the services are reachable from the public internet.",
              "Runtime Docker state and firewall rules require separate verification."
            ],
            fix_commands: findings.length > 0
              ? findings.map((f) => `# ${f.remediation}`)
              : ["# No remediation required from this static scan result"],
            verification_commands: [
              "docker compose config",
              "docker ps --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}'",
              "ss -tulpn"
            ],
            rollback_commands: [
              "No rollback needed for read-only checks."
            ],
            recommendations: findings.length > 0
              ? findings.map((f) => f.remediation).join("\n")
              : "Continue using pinned versions, healthchecks and least-privilege container settings.",
            prevention: [
              "Pin image versions instead of using latest tags.",
              "Avoid privileged mode unless strictly required.",
              "Avoid mounting /var/run/docker.sock into containers.",
              "Keep databases on internal Docker networks unless public exposure is intentional."
            ].join("\n")
          };

          updateProgress(90, "Docker audit complete...");
        } else if (scanType === "permissions") {
          updateProgress(20, "Running local permission audit...");

          const findings = auditPermissions(sourceText);

          updateProgress(70, "Preparing permission security report...");

          response = {
            severity: findings.some((f) => f.severity === "CRITICAL")
              ? "CRITICAL"
              : findings.some((f) => f.severity === "HIGH")
                ? "HIGH"
                : findings.some((f) => f.severity === "MEDIUM")
                  ? "MEDIUM"
                  : "LOW",
            confidence: "HIGH",
            requires_sudo: false,
            detected_stack: ["permissions", "filesystem", "local-analysis"],
            title: findings.length > 0
              ? "Filesystem permission risks detected"
              : "No obvious permission risks detected",
            summary: findings.length > 0
              ? `Detected ${findings.length} filesystem permission or ownership risk findings.`
              : "No obvious high-risk permission patterns were detected in the provided input.",
            root_cause: findings.length > 0
              ? "The provided permission output contains risky ownership, world-writable access, SUID exposure, Docker socket access, or sudoers patterns."
              : "No direct risky permission pattern matched the provided content.",
            next_best_action: findings.length > 0
              ? "Review the listed permission findings before applying chmod/chown changes."
              : "Manually verify sensitive files such as SSH keys, sudoers entries and secret files.",
            evidence: findings.map((f) => `${f.title}: ${f.evidence}`),
            assumptions: [
              "This audit is based on pasted filesystem or sudoers output.",
              "Actual ownership and runtime access control were not independently verified."
            ],
            remediation_safety: "READ_ONLY_SAFE",
            evidence_quality: findings.length > 0 ? "DIRECT_EVIDENCE" : "PARTIAL_EVIDENCE",
            rollback_confidence: "ROLLBACK_NOT_REQUIRED",
            verification_strength: "STRONG_VERIFICATION",
            verification_reason: "The detector directly analyzed the provided permission output locally.",
            verification_limitations: [
              "This does not inspect the live filesystem unless the user pasted complete command output.",
              "Some legitimate special permissions may be intentional."
            ],
            fix_commands: findings.length > 0
              ? findings.map((f) => `# ${f.remediation}`)
              : ["# No remediation required from this static scan result"],
            verification_commands: [
              "ls -la",
              "find . -perm -002 -ls",
              "find . -perm -4000 -ls"
            ],
            rollback_commands: [
              "No rollback needed for read-only checks."
            ],
            recommendations: findings.length > 0
              ? findings.map((f) => f.remediation).join("\n")
              : "Continue reviewing sensitive paths, SSH files and sudoers rules before deployment.",
            prevention: [
              "Avoid chmod 777 except in disposable test environments.",
              "Keep private SSH keys restricted to 600.",
              "Keep .ssh directories restricted to 700.",
              "Treat Docker socket access as root-equivalent."
            ].join("\n")
          };

          updateProgress(90, "Permission audit complete...");
        } else if (scanType === "nginx") {
          updateProgress(20, "Running local reverse proxy audit...");

          const findings = auditNginxConfig(sourceText);

          updateProgress(70, "Preparing reverse proxy security report...");

          response = {
            severity: findings.some((f) => f.severity === "CRITICAL")
              ? "CRITICAL"
              : findings.some((f) => f.severity === "HIGH")
                ? "HIGH"
                : findings.some((f) => f.severity === "MEDIUM")
                  ? "MEDIUM"
                  : "LOW",
            confidence: "HIGH",
            requires_sudo: false,
            detected_stack: ["reverse-proxy", "nginx", "local-analysis"],
            title: findings.length > 0
              ? "Reverse proxy security and exposure risks detected"
              : "No obvious reverse proxy risks detected",
            summary: findings.length > 0
              ? `Detected ${findings.length} reverse proxy security or hardening findings.`
              : "No obvious high-risk reverse proxy patterns were detected in the provided input.",
            root_cause: findings.length > 0
              ? "The reverse proxy configuration contains missing hardening headers, exposure patterns, TLS concerns, or access-control gaps."
              : "No direct risky reverse proxy pattern matched the provided content.",
            next_best_action: findings.length > 0
              ? "Review TLS, headers, exposed admin paths and access-control rules before deployment."
              : "Manually verify TLS, headers, upstream behavior and access control before production deployment.",
            evidence: findings.map((f) => `${f.title}: ${f.evidence}`),
            assumptions: [
              "This audit is based on static reverse proxy configuration analysis.",
              "Runtime TLS behavior, DNS routing and upstream reachability were not verified."
            ],
            remediation_safety: "READ_ONLY_SAFE",
            evidence_quality: findings.length > 0 ? "DIRECT_EVIDENCE" : "PARTIAL_EVIDENCE",
            rollback_confidence: "ROLLBACK_NOT_REQUIRED",
            verification_strength: "STRONG_VERIFICATION",
            verification_reason: "The detector directly analyzed the provided reverse proxy configuration locally.",
            verification_limitations: [
              "This does not perform a live HTTP or TLS request.",
              "Some protections may exist in included files not pasted into the input."
            ],
            fix_commands: findings.length > 0
              ? findings.map((f) => `# ${f.remediation}`)
              : ["# No remediation required from this static scan result"],
            verification_commands: [
              "nginx -t",
              "curl -I https://example.com",
              "openssl s_client -connect example.com:443 -servername example.com"
            ],
            rollback_commands: [
              "No rollback needed for read-only checks."
            ],
            recommendations: findings.length > 0
              ? findings.map((f) => f.remediation).join("\n")
              : "Continue reviewing TLS, security headers and access-control rules before deployment.",
            prevention: [
              "Use HTTPS with strong TLS defaults.",
              "Redirect HTTP to HTTPS.",
              "Add security headers for public web services.",
              "Protect administrative paths with authentication and IP restrictions."
            ].join("\n")
          };

          updateProgress(90, "Reverse proxy audit complete...");
        } else if (scanType === "privacy") {
          updateProgress(20, "Running privacy exposure review...");

          const findings = auditPrivacyExposure(sourceText);

          updateProgress(70, "Preparing privacy exposure report...");

          response = {
            severity: findings.some((f) => f.severity === "HIGH")
              ? "HIGH"
              : findings.some((f) => f.severity === "MEDIUM")
                ? "MEDIUM"
                : "LOW",
            confidence: "HIGH",
            requires_sudo: false,
            detected_stack: ["privacy", "metadata", "local-analysis"],
            title: findings.length > 0
              ? "Privacy exposure signals detected"
              : "No obvious privacy exposure signals detected",
            summary: findings.length > 0
              ? `Detected ${findings.length} metadata, telemetry, resolver or fingerprinting signal(s).`
              : "No obvious privacy exposure patterns were detected in the provided input.",
            root_cause: findings.length > 0
              ? "The provided content includes metadata, DNS, WebRTC, telemetry, or fingerprinting signals that may increase privacy exposure."
              : "No direct privacy exposure pattern matched the provided content.",
            next_best_action: findings.length > 0
              ? "Review the listed metadata and resolver signals before sharing or publishing this output."
              : "Continue validating DNS, WebRTC and telemetry paths with local browser/network checks.",
            evidence: findings.map((f) => `${f.title}: ${f.evidence}`),
            assumptions: [
              "This review is based only on pasted text or collected headers.",
              "Network path and browser behavior were not independently verified."
            ],
            remediation_safety: "READ_ONLY_SAFE",
            evidence_quality: findings.length > 0 ? "DIRECT_EVIDENCE" : "PARTIAL_EVIDENCE",
            rollback_confidence: "ROLLBACK_NOT_REQUIRED",
            verification_strength: "WEAK_VERIFICATION",
            verification_reason: "Static privacy indicators are useful triage signals but do not prove live network behavior.",
            verification_limitations: [
              "A local browser leak test or controlled DNS query capture is needed for stronger verification.",
              "Telemetry references may be disabled by runtime configuration not present in the input."
            ],
            fix_commands: findings.length > 0
              ? findings.map((f) => `# ${f.remediation}`)
              : ["# No remediation required from this static review"],
            verification_commands: [
              "# Re-run browser DNS/WebRTC leak checks from the intended network path",
              "# Review response headers with curl -I against the deployed endpoint"
            ],
            rollback_commands: ["No rollback needed for read-only checks."],
            recommendations: findings.length > 0
              ? findings.map((f) => f.remediation).join("\n")
              : "Continue minimizing metadata disclosure and documenting telemetry destinations.",
            prevention: [
              "Reduce unnecessary server and framework headers.",
              "Constrain telemetry destinations and document opt-out behavior.",
              "Validate DNS and WebRTC behavior from the same client profile used in production."
            ].join("\n")
          };

          updateProgress(90, "Privacy review complete...");
        } else if (scanType === "infra") {
          updateProgress(10, "Running infrastructure discovery...");

          const infraScan = await portScan(effectiveTarget, {
            ports: COMMON_PORTS.join(",")
          });

          updateProgress(60, "Correlating exposure signals...");

          const summary = buildInfrastructureSummary(
            effectiveTarget,
            infraScan.results || []
          );

          let findings = [...(summary.findings || [])];
          let detectedStack = ["infrastructure-intelligence", "network-discovery"];

          const hasHttps = summary.openPorts.some((p) => Number(p.port) === 443);
          const hasHttp = summary.openPorts.some((p) => Number(p.port) === 80);

          let httpData = null;
          let tlsData = null;
          let sshData = null;
          let sshAuditData = null;
          let serviceProbeData = {};
          let webIntelData = {};
          let redirectedHostData = null;

          if (hasHttps || hasHttp) {
            updateProgress(75, "Fingerprinting HTTP/TLS exposure...");

            const primaryPort = hasHttps ? 443 : 80;
            const primaryService = hasHttps ? "https" : "http";

            httpData = await buildHttpIntel(
              effectiveTarget,
              primaryService,
              primaryPort
            );

            if (!httpData?.success && hasHttp && primaryPort === 443) {
              httpData = await buildHttpIntel(effectiveTarget, "http", 80);
            }

            if (httpData?.success && httpData.headers) {
              webIntelData[String(httpData.port || primaryPort)] = httpData;

              try {
                const finalHost = httpData.advancedProbe?.finalUrl
                  ? new URL(httpData.advancedProbe.finalUrl).hostname
                  : "";

                if (
                  finalHost &&
                  finalHost !== effectiveTarget
                ) {
                  devLog("Redirected host detected", finalHost);

                  const redirectedScan = await portScan(
                    finalHost,
                    { ports: COMMON_PORTS.join(",") }
                  );

                  const redirectedOpenPorts = redirectedScan?.results?.filter(
                    (p) => p.status === "open"
                  ) || [];

                  const redirectedHasHttps = redirectedOpenPorts.some(
                    (p) => Number(p.port) === 443
                  );

                  const redirectedHasHttp = redirectedOpenPorts.some(
                    (p) => Number(p.port) === 80
                  );

                  let redirectedHttpData = null;
                  let redirectedTlsData = null;

                  if (redirectedHasHttps || redirectedHasHttp) {
                    const redirectedProtocol = redirectedHasHttps ? "https" : "http";

                    redirectedHttpData = await buildHttpIntel(
                      finalHost,
                      redirectedProtocol,
                      redirectedHasHttps ? 443 : 80
                    );

                    if (redirectedHasHttps) {
                      redirectedTlsData = await tlsCheck(finalHost, 443);
                    }
                  }

                  redirectedHostData = {
                    host: finalHost,
                    results: redirectedScan?.results || [],
                    openPorts: redirectedOpenPorts,
                    serviceMatrix: buildServiceMatrix(
                      redirectedOpenPorts.map((p) => p.port)
                    ),
                    httpData: redirectedHttpData,
                    tlsData: redirectedTlsData
                  };
                }
              } catch (redirectError) {
                devLog("Redirect host scan failed", redirectError);
              }

              findings.push(...httpData.fingerprint.findings);

              detectedStack.push(
                ...httpData.fingerprint.detectedStack.map((s) => s.name)
              );
            }
          }

          const hasSsh = summary.openPorts.some((p) => Number(p.port) === 22);


          let ftpData = null;

          if (summary.openPorts.some((p) => Number(p.port) === 21)) {
            updateProgress(72, "Fingerprinting FTP exposure...");

            ftpData = await ftpProbe(effectiveTarget, 21);

            devLog("FTP probe result", ftpData);
          }

          if (hasSsh) {
            updateProgress(82, "Fingerprinting SSH service...");

            sshData = await sshBanner(effectiveTarget, 22);

            if (sshData?.success && sshData.banner) {
              findings.push({
                title: "SSH banner disclosure",
                severity: "LOW",
                evidence: sshData.banner,
                remediation: "Banner disclosure is usually acceptable, but review SSH version exposure and hardening."
              });

              detectedStack.push("SSH");
            }

            sshAuditData = await sshAuditProbe(effectiveTarget, 22);

            if (sshAuditData?.success && sshAuditData.output) {
              sshAuditData.parsed = parseSshAudit(
                sshAuditData.output
              );
            }

            devLog("SSH audit result", sshAuditData);
          }

          if (hasHttps) {
            tlsData = await tlsCheck(effectiveTarget, 443);

            if (
              tlsData?.certificate?.selfSigned
            ) {
              findings.push({
                title: "Self-signed TLS certificate detected",
                severity: "MEDIUM",
                evidence: "The HTTPS endpoint uses a self-signed certificate.",
                remediation: "Use a trusted certificate authority for public-facing services."
              });
            }

            if (
              tlsData?.warnings?.length
            ) {
              findings.push({
                title: "TLS warnings detected",
                severity: "MEDIUM",
                evidence: tlsData.warnings.join(", "),
                remediation: "Review TLS configuration and remove legacy or insecure settings."
              });
            }
          }

          const genericProbeServices = [
            "telnet", "smtp", "smtps", "submission", "dns", "pop3", "pop3s", "imap", "imaps", "ldap", "ldaps",
            "mssql", "oracle", "docker", "mysql", "postgresql", "rdp",
            "vnc", "redis", "prometheus", "elasticsearch", "mongodb",
            "grafana", "http-alt", "https-alt", "lnd-grpc", "lightning"
          ];

          const serviceMatrix = buildServiceMatrix(
            (summary.openPorts || []).map((p) => p.port)
          );

          const webTargets = serviceMatrix.filter((item) =>
            ["http", "https", "http-alt", "https-alt", "grafana", "prometheus", "docker", "elasticsearch"].includes(item.service) &&
            !webIntelData[String(item.port)]
          );

          if (webTargets.length > 0) {
            updateProgress(84, "Collecting per-service web intelligence...");

            const webResults = await Promise.all(
              webTargets.map((item) =>
                buildHttpIntel(effectiveTarget, item.service, item.port)
                  .catch((error) => ({
                    success: false,
                    port: item.port,
                    service: item.service,
                    error: error.message
                  }))
              )
            );

            webIntelData = {
              ...webIntelData,
              ...Object.fromEntries(
                webResults
                  .filter(Boolean)
                  .map((item) => [String(item.port), item])
              )
            };

            webResults.forEach((item) => {
              if (item?.fingerprint?.findings?.length) {
                findings.push(...item.fingerprint.findings.map((finding) => ({
                  ...finding,
                  title: `${item.service}:${item.port} ${finding.title}`
                })));
              }

              if (item?.fingerprint?.detectedStack?.length) {
                detectedStack.push(...item.fingerprint.detectedStack.map((s) => s.name));
              }
            });
          }

          const genericTargets = serviceMatrix.filter((item) =>
            genericProbeServices.includes(item.service)
          );

          if (genericTargets.length > 0) {
            updateProgress(88, "Running chained service probes...");

            const genericResults = await Promise.all(
              genericTargets.map((item) =>
                tcpServiceProbe(effectiveTarget, item.port, item.service)
                  .catch((error) => ({
                    success: false,
                    type: "tcp-service-probe",
                    port: item.port,
                    service: item.service,
                    error: error.message
                  }))
              )
            );

            serviceProbeData = Object.fromEntries(
              genericResults.map((item) => [String(item.port), item])
            );

            devLog("Service probes complete", Object.keys(serviceProbeData));

            genericResults.forEach((probe) => {
              if (probe?.docker?.critical) {
                findings.push({
                  title: "Docker HTTP API exposed",
                  severity: "CRITICAL",
                  evidence: `Docker API responded on ${effectiveTarget}:${probe.port}.`,
                  remediation: "Do not expose Docker API publicly. Bind it to localhost, require TLS client authentication, or place it behind a private control plane only."
                });
              }

              if (probe?.database?.isDatabase) {
                const unauthenticated = probe.database.auth === "not-required-or-ping-allowed" || probe.database.redisPongWithoutAuth || probe.database.redisInfoAvailable;
                addFindingOnce(findings, {
                  title: `${probe.database.vendor || probe.service} database exposure`,
                  severity: unauthenticated ? "CRITICAL" : "HIGH",
                  evidence: `${probe.database.vendor || probe.service} responded on ${effectiveTarget}:${probe.port}${probe.database.version ? ` with version ${probe.database.version}` : ""}. Authentication posture: ${probe.database.auth || "unknown"}.`,
                  remediation: "Restrict database access to private networks or trusted application hosts and enforce service-level authentication."
                });
              }

              if (probe?.elasticsearch?.reachable) {
                findings.push({
                  title: "Elasticsearch endpoint reachable",
                  severity: "HIGH",
                  evidence: `Cluster ${probe.elasticsearch.clusterName || "unknown"} ${probe.elasticsearch.version ? `version ${probe.elasticsearch.version}` : ""} responded on port ${probe.port}.`,
                  remediation: "Restrict Elasticsearch to private networks and enforce authentication before exposing any API endpoint."
                });
              }

              if (probe?.prometheus?.metricsReachable) {
                findings.push({
                  title: "Prometheus metrics endpoint reachable",
                  severity: "HIGH",
                  evidence: `/metrics responded on ${effectiveTarget}:${probe.port}.`,
                  remediation: "Restrict Prometheus UI and metrics endpoints with network allowlists, authentication, or a private VPN."
                });
              }

              if (probe?.grafana?.loginPage) {
                findings.push({
                  title: "Grafana login surface reachable",
                  severity: "MEDIUM",
                  evidence: `Grafana login page appears reachable on ${effectiveTarget}:${probe.port}.`,
                  remediation: "Keep Grafana behind SSO, VPN or IP allowlists, and verify anonymous access is disabled."
                });
              }

              if (probe?.lightning?.publicCritical) {
                findings.push({
                  title: "LND gRPC endpoint publicly reachable",
                  severity: "CRITICAL",
                  evidence: `LND gRPC-like endpoint accepts TCP connections on ${effectiveTarget}:${probe.port}.`,
                  remediation: "Restrict LND gRPC to localhost, VPN or trusted peers only and require TLS/macaroon controls."
                });
              }
            });
          }

          const serviceContexts = {};

          if (sshAuditData?.parsed?.score !== undefined) {
            serviceContexts["22"] = {
              sshScore: sshAuditData.parsed.score,
              versionDisclosure: Boolean(sshData?.software)
            };
          }

          if (ftpData?.success) {
            serviceContexts["21"] = {
              versionDisclosure: Boolean(ftpData.version || ftpData.software),
              tlsMissing: true
            };
          }

          Object.entries(webIntelData || {}).forEach(([port, intel]) => {
            if (!intel?.success) return;
            const missingSecurityHeaders = intel.fingerprint?.metadata?.securityHeaders?.missing?.length > 0;
            const adminPanelDetected = Boolean(
              intel.advancedProbe?.fingerprint?.loginPanel ||
              intel.advancedProbe?.fingerprint?.adminPath ||
              intel.advancedProbe?.fingerprint?.phpmyadmin ||
              intel.advancedProbe?.fingerprint?.grafana ||
              intel.advancedProbe?.fingerprint?.prometheus ||
              intel.advancedProbe?.fingerprint?.portainer ||
              intel.advancedProbe?.fingerprint?.nextcloud ||
              intel.advancedProbe?.fingerprint?.lnbits ||
              intel.advancedProbe?.fingerprint?.wordpressAdmin ||
              intel.advancedProbe?.adminHints?.length ||
              intel.fingerprint?.metadata?.adminPanels?.length
            );
            serviceContexts[port] = {
              ...(serviceContexts[port] || {}),
              versionDisclosure: Boolean(intel?.fingerprint?.versions && Object.keys(intel.fingerprint.versions).length),
              tlsMissing: !String(intel.url || "").startsWith("https:"),
              authWeakOrUnknown: adminPanelDetected,
              adminPanelDetected,
              securityHeadersMissing: missingSecurityHeaders,
              metadataLeak: Boolean(intel.fingerprint?.metadata?.reverseProxy?.metadataDisclosure || intel.fingerprint?.metadata?.poweredBy)
            };
          });

          if (findings?.some((f) => String(f.title || "").includes("Missing security header"))) {
            ["80", "443", "8080", "8443", "3000", "9090", "9200"].forEach((port) => {
              serviceContexts[port] = {
                ...(serviceContexts[port] || {}),
                versionDisclosure: Boolean(webIntelData[port]?.fingerprint?.versions && Object.keys(webIntelData[port].fingerprint.versions).length),
                tlsMissing: port === "80" || port === "8080" || port === "3000" || port === "9090" || port === "9200",
                authWeakOrUnknown: true
              };
            });
          }

          Object.entries(serviceProbeData || {}).forEach(([port, probe]) => {
            serviceContexts[port] = {
              ...(serviceContexts[port] || {}),
              versionDisclosure: Boolean(
                probe?.banner?.match(/[0-9]+\.[0-9]+/) ||
                probe?.database?.version ||
                probe?.elasticsearch?.version ||
                probe?.grafana?.version ||
                probe?.docker?.version
              ),
              authWeakOrUnknown:
                probe?.docker?.critical ||
                (probe?.database?.isDatabase ? probe.database.auth !== "required" : false) ||
                (!probe?.mail?.isMailService ? false : !probe?.mail?.auth?.length),
              tlsMissing:
                (probe?.docker?.apiReachable && !probe?.docker?.tlsPresent) ||
                probe?.mail?.isMailService && !probe?.mail?.starttls && !probe?.mail?.implicitTls,
              tlsPresent: Boolean(probe?.docker?.tlsPresent || probe?.mail?.implicitTls),
              authenticationConfirmed: probe?.database?.auth === "required",
              unauthenticatedAccess: Boolean(
                probe?.database?.auth === "not-required-or-ping-allowed" ||
                probe?.database?.redisPongWithoutAuth ||
                probe?.database?.redisInfoAvailable
              ),
              databaseExposure: Boolean(probe?.database?.isDatabase),
              dockerExposure: Boolean(probe?.docker?.apiReachable || probe?.docker?.critical),
              metadataLeak: Boolean(probe?.database?.version || probe?.docker?.version)
            };
          });

          if (sshAuditData?.parsed?.score !== undefined && sshAuditData.parsed.score < 70) {
            serviceContexts["22"] = {
              ...(serviceContexts["22"] || {}),
              weakCrypto: true
            };
          }

          generateInfrastructureFindings({
            target: effectiveTarget,
            serviceMatrix,
            findings,
            webIntelData,
            serviceProbeData,
            sshAuditData,
            tlsData
          });

          const exposureRisk = calculateGlobalRisk(
            serviceMatrix,
            serviceContexts
          );
          const attackSurfaceSummary = buildAttackSurfaceSummary(
            serviceMatrix,
            webIntelData,
            exposureRisk,
            serviceProbeData
          );

          const localInfraResult = {
            title: "Infrastructure X-Ray Result",
            findings,
            detectedStack: [...new Set(detectedStack)],
            openPorts: summary.openPorts || [],
            scannedPorts: summary.scannedPorts || [],
            serviceMatrix,
            httpData,
            tlsData,
            sshData,
            ftpData,
            sshAuditData,
            serviceProbeData,
            webIntelData,
            redirectedHostData,
            attackSurfaceSummary,
            exposureRisk
          };

          setLocalResult(localInfraResult);

          response = {
            severity: findings.some((f) => f.severity === "CRITICAL")
              ? "CRITICAL"
              : findings.some((f) => f.severity === "HIGH")
                ? "HIGH"
                : findings.some((f) => f.severity === "MEDIUM")
                ? "MEDIUM"
                : "LOW",
            confidence: "HIGH",
            requires_sudo: false,
            detected_stack: [...new Set(detectedStack)],
            title: findings.length > 0
              ? "Infrastructure exposure findings detected"
              : "No major infrastructure exposure findings detected",

            summary: findings.length > 0
              ? `Detected ${findings.length} infrastructure exposure or operational findings.`
              : "No obvious high-risk exposure patterns were detected from the collected scan results.",

            root_cause: findings.length > 0
              ? "One or more publicly reachable services may increase operational exposure or attack surface."
              : "No direct high-risk exposure correlation matched the collected scan results.",

            next_best_action: findings.length > 0
              ? "Review exposed services, administrative interfaces and sensitive ports."
              : "Continue validating firewall segmentation and service exposure.",

            evidence: [
              ...summary.openPorts.map(
                (p) => `Open port ${p.port}: ${p.service}`
              ),
              ...findings.map(
                (f) => `${f.title}: ${f.evidence}`
              )
            ],

            assumptions: [
              "This is an active network scan against the provided target.",
              "Service identification is heuristic-based and may not always be accurate."
            ],

            remediation_safety: "READ_ONLY_SAFE",
            evidence_quality: findings.length > 0
              ? "DIRECT_EVIDENCE"
              : "PARTIAL_EVIDENCE",

            rollback_confidence: "ROLLBACK_NOT_REQUIRED",

            verification_strength: "STRONG_VERIFICATION",

            verification_reason:
              "The system directly scanned reachable ports and correlated service exposure patterns locally.",

            verification_limitations: [
              "Filtered ports may not appear in scan results.",
              "Application fingerprinting is heuristic-based and may not always be accurate."
            ],

            fix_commands: findings.length > 0
              ? findings.map((f) => `# ${f.remediation}`)
              : ["# No remediation required from this scan result"],

            verification_commands: [
              "ss -tulpn",
              "ufw status",
              "docker ps",
              "nmap TARGET"
            ],

            rollback_commands: [
              "No rollback needed for read-only checks."
            ],

            recommendations: findings.length > 0
              ? findings.map((f) => f.remediation).join("\n")
              : "Continue reviewing exposed services and segmentation rules.",

            prevention: [
              "Avoid exposing internal dashboards directly to the internet.",
              "Restrict databases to private networks.",
              "Use reverse proxies and authentication for operational services.",
              "Continuously review infrastructure exposure."
            ].join("\n"),

            infrastructure_summary: {
              scanned_ports: summary.scannedPorts,
              open_ports: summary.openPorts
            }
          };

          updateProgress(90, "Infrastructure analysis complete...");
        } else if (scanType === "watcher") {
          updateProgress(20, "Checking service exposure changes...");

          const scanResult = await portScan(effectiveTarget, {
            ports: COMMON_PORTS.join(",")
          });

          const currentOpenPorts = (scanResult.results || []).filter((item) => item.status === "open");
          const baselines = loadWatcherBaselines();
          const previous = baselines[effectiveTarget]?.openPorts || [];
          const delta = comparePortExposure(previous, currentOpenPorts);
          const baseline = saveWatcherBaseline(effectiveTarget, currentOpenPorts);
          setWatcherBaseline(baseline);

          const findings = [
            ...delta.opened.map((item) => ({
              title: `Newly opened port ${item.port}`,
              severity: ["docker", "redis", "mysql", "postgresql", "mongodb", "elasticsearch", "lnd-grpc"].includes(item.service) ? "HIGH" : "MEDIUM",
              evidence: `${item.service || "unknown"} is now reachable on ${effectiveTarget}:${item.port}.`,
              remediation: "Confirm this exposure is expected and restrict it with firewall, VPN, reverse proxy or private networking if it is not intentional."
            })),
            ...delta.closed.map((item) => ({
              title: `Closed port ${item.port}`,
              severity: "LOW",
              evidence: `${item.service || "unknown"} was present in the previous baseline and is no longer reachable.`,
              remediation: "Confirm whether the service shutdown or firewall change was expected."
            })),
            ...delta.changed.map((item) => ({
              title: `Service changed on port ${item.port}`,
              severity: "MEDIUM",
              evidence: `${item.before.service} changed to ${item.after.service} on ${effectiveTarget}:${item.port}.`,
              remediation: "Review deployment history and validate the service identity from the host or trusted inventory."
            }))
          ];

          response = {
            severity: findings.some((f) => f.severity === "HIGH") ? "HIGH" : findings.some((f) => f.severity === "MEDIUM") ? "MEDIUM" : "LOW",
            confidence: previous.length ? "HIGH" : "MEDIUM",
            requires_sudo: false,
            detected_stack: ["service-watcher", "port-monitoring", "read-only-scan"],
            title: previous.length ? "Service exposure delta" : "Service exposure baseline captured",
            summary: previous.length
              ? `Detected ${delta.opened.length} opened, ${delta.closed.length} closed and ${delta.changed.length} changed service exposure event(s).`
              : `Captured initial baseline with ${currentOpenPorts.length} reachable port(s).`,
            root_cause: previous.length
              ? "Reachable ports or service hints changed compared with the previous local baseline."
              : "No prior baseline existed for this target.",
            next_best_action: findings.length
              ? "Review each exposure delta against an approved change or deployment record."
              : "Re-run the watcher after the next planned service or firewall change.",
            evidence: [
              ...currentOpenPorts.map((p) => `Current open port ${p.port}: ${p.service || "unknown"}`),
              ...findings.map((f) => `${f.title}: ${f.evidence}`)
            ],
            assumptions: [
              "Port state is observed from this workstation and may differ from other network locations.",
              "Service names are heuristic hints based on port and banner information."
            ],
            remediation_safety: "READ_ONLY_SAFE",
            evidence_quality: previous.length ? "DIRECT_EVIDENCE" : "PARTIAL_EVIDENCE",
            rollback_confidence: "ROLLBACK_NOT_REQUIRED",
            verification_strength: "WEAK_VERIFICATION",
            verification_reason: "The watcher compares local read-only observations, but network path and filtering can affect results.",
            verification_limitations: [
              "A different source network may see different exposure.",
              "Port banners may not uniquely identify the running service."
            ],
            fix_commands: findings.length ? findings.map((f) => `# ${f.remediation}`) : ["# No exposure delta detected"],
            verification_commands: [
              "# Re-run the watcher from the same network path",
              `# Confirm intentional exposure for ${effectiveTarget} in firewall, proxy and service inventory`
            ],
            rollback_commands: ["No rollback needed for read-only checks."],
            recommendations: findings.length
              ? findings.map((f) => f.remediation).join("\n")
              : "Keep the baseline and compare again after planned changes.",
            exposure_timeline: {
              target: effectiveTarget,
              captured_at: baseline.capturedAt,
              previous_open_ports: previous,
              current_open_ports: baseline.openPorts,
              opened: delta.opened,
              closed: delta.closed,
              changed: delta.changed,
              service_matrix: delta.serviceMatrix
            }
          };

          updateProgress(90, "Watcher baseline updated...");
        }
      } catch (error) {
        response = { report: `Errore: ${error.message}`, recommendations: "Riprova più tardi" };
      }
    }
    
    updateProgress(100, "Audit complete.");
    setResult(response);
    if (mode === 2 && localTextScanTypes.includes(scanType) && response) {
      onLocalResult?.({
        scanType,
        input: scanType === "secrets"
          ? "[local secret detection input redacted]"
          : `[${scanType}] local pasted input`,
        output: response,
      });
    }
    setAnalyzing(false);
    setTimeout(() => setProgress(null), 700);
  };

  return (
    <div>
      <button onClick={onBack} style={{
        background: "none", border: "none", color: "#8B95A8", cursor: "pointer",
        fontSize: 13, marginBottom: 16,
      }}>← {t.home}</button>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>
        🛡️ {t.securityAuditorPage.title}
      </h2>
      <p style={{ color: "#8B95A8", fontSize: 14, marginBottom: 20 }}>{t.securityAuditorPage.subtitle}</p>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#8B95A8", marginBottom: 8, display: "block" }}>
          {t.securityAuditorPage.modeLabel}
        </label>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={() => changeMode(0)} style={{
            flex: 1, padding: "10px", borderRadius: 8, fontSize: 13, fontWeight: 500,
            background: mode === 0 ? "#00D4AA" : "#1A1F2E",
            color: mode === 0 ? "#0B0E14" : "#8B95A8",
            border: `1px solid ${mode === 0 ? "#00D4AA" : "#1E2535"}`,
            cursor: "pointer",
          }}>📄 {t.securityAuditorPage.configMode}</button>
          <button onClick={() => changeMode(1)} style={{
            flex: 1, padding: "10px", borderRadius: 8, fontSize: 13, fontWeight: 500,
            background: mode === 1 ? "#00D4AA" : "#1A1F2E",
            color: mode === 1 ? "#0B0E14" : "#8B95A8",
            border: `1px solid ${mode === 1 ? "#00D4AA" : "#1E2535"}`,
            cursor: "pointer",
          }}>🌐 {t.securityAuditorPage.remoteMode}</button>
          <button onClick={() => changeMode(2)} style={{
            flex: 1, padding: "10px", borderRadius: 8, fontSize: 13, fontWeight: 500,
            background: mode === 2 ? "#00D4AA" : "#1A1F2E",
            color: mode === 2 ? "#0B0E14" : "#8B95A8",
            border: `1px solid ${mode === 2 ? "#00D4AA" : "#1E2535"}`,
            cursor: "pointer",
          }}>🔐 {t.securityAuditorPage.localMode}</button>
        </div>
      </div>

      {mode === 0 && (
        <>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#8B95A8", marginBottom: 8, display: "block" }}>
              {t.securityAuditorPage.typeLabel}
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {t.securityAuditorPage.types.map((type, i) => (
                <button key={type} onClick={() => setInputType(i)} style={{
                  padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500,
                  background: inputType === i ? "#00D4AA" : "#1A1F2E",
                  color: inputType === i ? "#0B0E14" : "#8B95A8",
                  border: `1px solid ${inputType === i ? "#00D4AA" : "#1E2535"}`,
                  cursor: "pointer",
                }}>{type}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#8B95A8", marginBottom: 8, display: "block" }}>
              {t.securityAuditorPage.sourceLabel}
            </label>
            <textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder={t.securityAuditorPage.placeholder}
              style={{
                width: "100%", height: 180, padding: 16, borderRadius: 12,
                background: "#131720", border: "1px solid #1E2535",
                color: "#E8ECF4", fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
                resize: "vertical",
              }}
            />
          </div>
        </>
      )}

      {mode === 1 && (
        <>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#8B95A8", marginBottom: 8, display: "block" }}>
              🔍 {t.securityAuditorPage.scanTypeLabel}
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => changeScanType("ports")} style={{
                flex: 1, padding: "8px", borderRadius: 8, fontSize: 12,
                background: scanType === "ports" ? "#00D4AA" : "#1A1F2E",
                color: scanType === "ports" ? "#0B0E14" : "#8B95A8",
                border: `1px solid ${scanType === "ports" ? "#00D4AA" : "#1E2535"}`,
                cursor: "pointer",
              }}>🔌 {t.securityAuditorPage.scanTypes.ports}</button>
              <button onClick={() => changeScanType("ssl")} style={{
                flex: 1, padding: "8px", borderRadius: 8, fontSize: 12,
                background: scanType === "ssl" ? "#00D4AA" : "#1A1F2E",
                color: scanType === "ssl" ? "#0B0E14" : "#8B95A8",
                border: `1px solid ${scanType === "ssl" ? "#00D4AA" : "#1E2535"}`,
                cursor: "pointer",
              }}>🔒 {t.securityAuditorPage.scanTypes.ssl}</button>
              <button onClick={() => changeScanType("ssh")} style={{
                flex: 1, padding: "8px", borderRadius: 8, fontSize: 12,
                background: scanType === "ssh" ? "#00D4AA" : "#1A1F2E",
                color: scanType === "ssh" ? "#0B0E14" : "#8B95A8",
                border: `1px solid ${scanType === "ssh" ? "#00D4AA" : "#1E2535"}`,
                cursor: "pointer",
              }}>🖥️ {t.securityAuditorPage.scanTypes.ssh}</button>
              <button onClick={() => changeScanType("infra")} style={{
                flex: 1, padding: "8px", borderRadius: 8, fontSize: 12,
                background: scanType === "infra" ? "#00D4AA" : "#1A1F2E",
                color: scanType === "infra" ? "#0B0E14" : "#8B95A8",
                border: `1px solid ${scanType === "infra" ? "#00D4AA" : "#1E2535"}`,
                cursor: "pointer",
              }}>🧠 {t.securityAuditorPage.scanTypes.infra}</button>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#8B95A8", marginBottom: 8, display: "block" }}>
                🌐 {t.securityAuditorPage.targetLabel}
              </label>
              <input
                value={targetHost}
                onChange={(e) => setTargetHost(e.target.value)}
                placeholder={t.securityAuditorPage.targetPlaceholder}
                style={{
                  width: "100%", padding: "12px 16px", borderRadius: 12,
                  background: "#131720", border: "1px solid #1E2535",
                  color: "#E8ECF4", fontSize: 14,
                }}
              />
            </div>
          

          {scanType === "ports" && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#8B95A8", marginBottom: 8, display: "block" }}>
                🔌 {t.securityAuditorPage.portsLabel}
              </label>
              <input
                value={scanPorts}
                onChange={(e) => setScanPorts(e.target.value)}
                placeholder="22,80,443,3306,5432"
                style={{
                  width: "100%", padding: "12px 16px", borderRadius: 12,
                  background: "#131720", border: "1px solid #1E2535",
                  color: "#E8ECF4", fontSize: 14,
                }}
              />
            </div>
          )}
        </>
      )}

      {mode === 2 && (
        <>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#8B95A8", marginBottom: 8, display: "block" }}>
              🔍 {t.securityAuditorPage.scanTypeLabel}
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              {["secrets", "docker", "permissions", "nginx", "privacy"].map((type) => (
                <button key={type} onClick={() => changeScanType(type)} style={{
                  flex: 1, padding: "8px", borderRadius: 8, fontSize: 12,
                  background: scanType === type ? "#00D4AA" : "#1A1F2E",
                  color: scanType === type ? "#0B0E14" : "#8B95A8",
                  border: `1px solid ${scanType === type ? "#00D4AA" : "#1E2535"}`,
                  cursor: "pointer",
                }}>{type === "secrets" ? "🔑" : type === "docker" ? "🐳" : type === "permissions" ? "🔐" : type === "privacy" ? "🕵️" : "🌐"} {t.securityAuditorPage.scanTypes[type] || type}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#8B95A8", marginBottom: 8, display: "block" }}>
                {scanType === "docker" ? `🐳 ${t.securityAuditorPage.textLabels.docker}` : scanType === "permissions" ? `🔐 ${t.securityAuditorPage.textLabels.permissions}` : scanType === "nginx" ? `🌐 ${t.securityAuditorPage.textLabels.nginx}` : scanType === "privacy" ? `🕵️ ${t.securityAuditorPage.textLabels.privacy || "Browser, DNS, VPN, headers or telemetry output"}` : `🔑 ${t.securityAuditorPage.textLabels.secrets}`}
              </label>
              <textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder={
                  scanType === "docker"
                    ? t.securityAuditorPage.textPlaceholders.docker
                    : scanType === "permissions"
                      ? t.securityAuditorPage.textPlaceholders.permissions
                      : scanType === "nginx"
                        ? t.securityAuditorPage.textPlaceholders.nginx
                        : scanType === "privacy"
                          ? (t.securityAuditorPage.textPlaceholders.privacy || "Paste browser leak-test output, headers, DNS/VPN notes, telemetry config or container metadata...")
                        : t.securityAuditorPage.textPlaceholders.secrets
                }
                style={{
                  width: "100%", height: 220, padding: 16, borderRadius: 12,
                  background: "#131720", border: "1px solid #1E2535",
                  color: "#E8ECF4", fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
                  resize: "vertical",
                }}
              />
            </div>
        </>
      )}

      <button onClick={handleAudit} style={{
        marginTop: 12, padding: "12px 28px", background: "#00D4AA", color: "#0B0E14",
        border: "none", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer",
      }}>
        {analyzing ? t.securityAuditorPage.analyzing : scanType === "secrets" ? t.securityAuditorPage.actions.secrets : scanType === "docker" ? t.securityAuditorPage.actions.docker : scanType === "permissions" ? t.securityAuditorPage.actions.permissions : scanType === "nginx" ? t.securityAuditorPage.actions.nginx : scanType === "privacy" ? (t.securityAuditorPage.actions.privacy || "Analyze Privacy") : scanType === "watcher" ? "Run Watcher" : t.securityAuditorPage.analyze}
      </button>

      {mode === 1 && (
        <button onClick={() => changeScanType("watcher")} style={{
          marginTop: 12,
          marginLeft: 10,
          padding: "12px 18px",
          borderRadius: 10,
          border: "1px solid #38BDF855",
          background: scanType === "watcher" ? "#38BDF8" : "#131720",
          color: scanType === "watcher" ? "#0B0E14" : "#38BDF8",
          fontWeight: 800,
          cursor: "pointer"
        }}>
          🛰️ {t.securityAuditorPage.scanTypes.watcher || "Port Watcher"}
        </button>
      )}

      {watcherBaseline && scanType === "watcher" && (
        <div style={{ marginTop: 12, color: "#8B95A8", fontSize: 12 }}>
          Watcher baseline updated at {watcherBaseline.capturedAt}. Results are local observations and advisory only.
        </div>
      )}

      {analyzing && progress && (
        <div style={{
          marginTop: 16,
          background: "#131720",
          border: "1px solid #1E2535",
          borderRadius: 14,
          padding: 14,
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
            fontSize: 12,
            color: "#8B95A8",
            fontWeight: 600,
          }}>
            <span>⏳ {progress.label}</span>
            <span>{progress.percent}%</span>
          </div>
          <div style={{
            height: 8,
            background: "#0B0E14",
            borderRadius: 999,
            overflow: "hidden",
            border: "1px solid #1E2535",
          }}>
            <div style={{
              width: `${progress.percent}%`,
              height: "100%",
              background: "linear-gradient(90deg, #00D4AA, #22d3ee)",
              borderRadius: 999,
              transition: "width 0.25s ease",
            }} />
          </div>

        </div>
      )}

      {localResult && (
        <LocalSecurityResult
          result={localResult}
          t={t}
          onAnalyzeRedirectedHost={(host) => {
            setTargetHost(host);
            handleAudit(host);
          }}
          onAnalyzeWithAI={async () => {
            if (!localResult) return;

            setAnalyzing(true);
            updateProgress(20, t.securityAuditorPage.progress.aiPayload);

            const aiPayload = JSON.stringify(sanitizeInfrastructurePayload(localResult), null, 2);

            updateProgress(60, t.securityAuditorPage.progress.aiAnalysis);

            const aiResponse = await onScan(
              targetHost || "local-security-audit",
              scanType,
              aiPayload
            );

            updateProgress(95, t.securityAuditorPage.progress.aiReport);

            setResult(aiResponse);
            setLocalResult(null);
            setAnalyzing(false);
            setTimeout(() => setProgress(null), 700);
          }}
        />
      )}

      {result && !localResult && (
        <div style={{ marginTop: 24, animation: "slideInRight 0.3s ease" }}>
          <ProfessionalResult result={result} t={t} />
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <button
          onClick={() => setShowNetworkVisibility((v) => !v)}
          style={{
            padding: "12px 18px",
            borderRadius: 10,
            border: "1px solid #00D4AA",
            background: showNetworkVisibility ? "#00D4AA" : "#131720",
            color: showNetworkVisibility ? "#0B0E14" : "#00D4AA",
            fontWeight: 800,
            cursor: "pointer"
          }}
        >
          🌐 {showNetworkVisibility ? t.securityAuditorPage.networkVisibilityHide : t.securityAuditorPage.networkVisibilityOpen}
        </button>

        {showNetworkVisibility && <NetworkVisibility />}
      </div>
    </div>
  );
};

export default SecurityAuditor;
