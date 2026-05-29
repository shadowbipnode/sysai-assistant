import { useState } from "react";
import ProfessionalResult from "./ProfessionalResult";
import LocalSecurityResult from "./LocalSecurityResult";
import NetworkVisibility from "./NetworkVisibility";
import { portScan, tlsCheck, sshAudit, httpHeadersCheck, advancedHttpProbe, ftpProbe, sshBanner, sshAuditProbe, tcpServiceProbe } from "../utils/scanners";
import { detectSecrets } from "../utils/secretDetector";
import { auditDockerCompose } from "../utils/dockerAudit";
import { auditPermissions } from "../utils/permissionAudit";
import { auditNginxConfig } from "../utils/nginxAudit";
import { buildInfrastructureSummary, COMMON_PORTS } from "../utils/infrastructureIntel";
import { fingerprintHttp } from "../utils/httpFingerprint";
import { buildServiceMatrix } from "../utils/serviceOrchestrator";
import { parseSshAudit } from "../utils/sshAuditParser";
import { calculateGlobalRisk } from "../utils/exposureRiskEngine";

const SecurityAuditor = ({ t, onAudit, onScan, onBack }) => {
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

  const updateProgress = (percent, label) => {
    setProgress({ percent, label });
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

  const handleAudit = async (targetOverride = null) => {
    const effectiveTarget =
      typeof targetOverride === "string" && targetOverride.trim()
        ? targetOverride
        : targetHost;

    if (mode === 0 && !sourceText.trim()) return;
    if (mode === 1 && !["secrets", "docker", "permissions", "nginx"].includes(scanType) && !effectiveTarget.trim()) return;
    if (mode === 1 && ["secrets", "docker", "permissions", "nginx"].includes(scanType) && !sourceText.trim()) return;
    
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
        } else if (scanType === "infra") {
          updateProgress(10, "Running infrastructure discovery...");

          const infraScan = await portScan(effectiveTarget, COMMON_PORTS);

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
          let redirectedHostData = null;

          if (hasHttps || hasHttp) {
            updateProgress(75, "Fingerprinting HTTP/TLS exposure...");

            const protocol = hasHttps ? "https" : "http";

            httpData = await httpHeadersCheck(effectiveTarget, {
              protocol
            });

            if (!httpData?.success && protocol === 'https') {
              console.log('HTTPS failed, retrying via HTTP...');

              httpData = await httpHeadersCheck(effectiveTarget, {
                protocol: 'http'
              });
            }

            console.log('HTTP DATA DEBUG', httpData);

            if (httpData?.success && httpData.headers) {
              const fingerprint = fingerprintHttp(
                httpData.headers,
                targetHost
              );

              httpData.fingerprint = fingerprint;

              console.log('CALLING ADVANCED PROBE');

              const advancedProbe = await advancedHttpProbe(
                effectiveTarget,
                { protocol }
              );

              console.log('ADVANCED PROBE RAW', advancedProbe);

              httpData.advancedProbe = advancedProbe;

              try {
                const finalHost = advancedProbe?.finalUrl
                  ? new URL(advancedProbe.finalUrl).hostname
                  : "";

                if (
                  finalHost &&
                  finalHost !== targetHost &&
                  finalHost !== targetHost.replace(/^www\./, "")
                ) {
                  console.log("REDIRECTED HOST DETECTED", finalHost);

                  const redirectedScan = await portScan(
                    finalHost,
                    scanPorts
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

                    redirectedHttpData = await httpHeadersCheck(finalHost, {
                      protocol: redirectedProtocol
                    });

                    if (redirectedHttpData?.success && redirectedHttpData.headers) {
                      const redirectedFingerprint = fingerprintHttp(
                        redirectedHttpData.headers,
                        finalHost
                      );

                      redirectedHttpData.fingerprint = redirectedFingerprint;

                      redirectedHttpData.advancedProbe = await advancedHttpProbe(
                        finalHost,
                        { protocol: redirectedProtocol }
                      );
                    }

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
                console.warn("Redirect host scan failed", redirectError);
              }

              console.log('ADVANCED PROBE RESULT', advancedProbe);

              findings.push(...fingerprint.findings);

              detectedStack.push(
                ...fingerprint.detectedStack.map((s) => s.name)
              );
            }
          }

          const hasSsh = summary.openPorts.some((p) => Number(p.port) === 22);


          let ftpData = null;

          if (summary.openPorts.some((p) => Number(p.port) === 21)) {
            updateProgress(72, "Fingerprinting FTP exposure...");

            ftpData = await ftpProbe(effectiveTarget, 21);

            console.log("FTP PROBE RESULT", ftpData);
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

            console.log("SSH AUDIT RESULT", sshAuditData);
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

            console.log("GENERIC SERVICE PROBES", serviceProbeData);
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

          if (findings?.some((f) => String(f.title || "").includes("Missing security header"))) {
            ["80", "443", "8080", "8443"].forEach((port) => {
              serviceContexts[port] = {
                ...(serviceContexts[port] || {}),
                versionDisclosure: Boolean(httpData?.fingerprint?.versions && Object.keys(httpData.fingerprint.versions).length),
                tlsMissing: port === "80",
                authWeakOrUnknown: true
              };
            });
          }

          Object.entries(serviceProbeData || {}).forEach(([port, probe]) => {
            serviceContexts[port] = {
              versionDisclosure: Boolean(
                probe?.banner?.match(/[0-9]+\.[0-9]+/)
              ),
              authWeakOrUnknown: !probe?.mail?.auth?.length,
              tlsMissing: probe?.mail?.isMailService && !probe?.mail?.starttls && !probe?.mail?.implicitTls
            };
          });

          const exposureRisk = calculateGlobalRisk(
            serviceMatrix,
            serviceContexts
          );

          if (findings?.length) {
            const findingPenalty = findings.reduce((sum, finding) => {
              const title = String(finding.title || "").toLowerCase();

              if (title.includes("missing security header")) return sum + 1;

              if (finding.severity === "CRITICAL") return sum + 45;
              if (finding.severity === "HIGH") return sum + 30;
              if (finding.severity === "MEDIUM") return sum + 10;
              if (finding.severity === "LOW") return sum + 4;
              return sum;
            }, 0);

            exposureRisk.score = Math.max(0, exposureRisk.score - findingPenalty);
            const openServiceNames = new Set(
              serviceMatrix.map((item) => item.service)
            );

            const onlyWebExposure = [...openServiceNames].every((service) =>
              ["http", "https", "http-alt", "https-alt"].includes(service)
            );

            if (onlyWebExposure && exposureRisk.score < 60) {
              exposureRisk.score = 60;
            }

            exposureRisk.level =
              exposureRisk.score < 30 ? "CRITICAL" :
              exposureRisk.score < 55 ? "HIGH" :
              exposureRisk.score < 75 ? "MEDIUM" :
              "LOW";
          }

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
            redirectedHostData,
            exposureRisk
          };

          setLocalResult(localInfraResult);

          response = {
            severity: findings.some((f) => f.severity === "HIGH")
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
        }
      } catch (error) {
        response = { report: `Errore: ${error.message}`, recommendations: "Riprova più tardi" };
      }
    }
    
    updateProgress(100, "Audit complete.");
    setResult(response);
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
          Modalità
        </label>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={() => setMode(0)} style={{
            flex: 1, padding: "10px", borderRadius: 8, fontSize: 13, fontWeight: 500,
            background: mode === 0 ? "#00D4AA" : "#1A1F2E",
            color: mode === 0 ? "#0B0E14" : "#8B95A8",
            border: `1px solid ${mode === 0 ? "#00D4AA" : "#1E2535"}`,
            cursor: "pointer",
          }}>📄 Analisi Configurazione</button>
          <button onClick={() => setMode(1)} style={{
            flex: 1, padding: "10px", borderRadius: 8, fontSize: 13, fontWeight: 500,
            background: mode === 1 ? "#00D4AA" : "#1A1F2E",
            color: mode === 1 ? "#0B0E14" : "#8B95A8",
            border: `1px solid ${mode === 1 ? "#00D4AA" : "#1E2535"}`,
            cursor: "pointer",
          }}>🌐 Scan Remoto</button>
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
              🔍 Tipo di Scan
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setScanType("ports")} style={{
                flex: 1, padding: "8px", borderRadius: 8, fontSize: 12,
                background: scanType === "ports" ? "#00D4AA" : "#1A1F2E",
                color: scanType === "ports" ? "#0B0E14" : "#8B95A8",
                border: `1px solid ${scanType === "ports" ? "#00D4AA" : "#1E2535"}`,
                cursor: "pointer",
              }}>🔌 Port Scan</button>
              <button onClick={() => setScanType("ssl")} style={{
                flex: 1, padding: "8px", borderRadius: 8, fontSize: 12,
                background: scanType === "ssl" ? "#00D4AA" : "#1A1F2E",
                color: scanType === "ssl" ? "#0B0E14" : "#8B95A8",
                border: `1px solid ${scanType === "ssl" ? "#00D4AA" : "#1E2535"}`,
                cursor: "pointer",
              }}>🔒 TLS Check</button>
              <button onClick={() => setScanType("ssh")} style={{
                flex: 1, padding: "8px", borderRadius: 8, fontSize: 12,
                background: scanType === "ssh" ? "#00D4AA" : "#1A1F2E",
                color: scanType === "ssh" ? "#0B0E14" : "#8B95A8",
                border: `1px solid ${scanType === "ssh" ? "#00D4AA" : "#1E2535"}`,
                cursor: "pointer",
              }}>🖥️ SSH Audit</button>
              <button onClick={() => setScanType("secrets")} style={{
                flex: 1, padding: "8px", borderRadius: 8, fontSize: 12,
                background: scanType === "secrets" ? "#00D4AA" : "#1A1F2E",
                color: scanType === "secrets" ? "#0B0E14" : "#8B95A8",
                border: `1px solid ${scanType === "secrets" ? "#00D4AA" : "#1E2535"}`,
                cursor: "pointer",
              }}>🔑 Secret Detection</button>
              <button onClick={() => setScanType("docker")} style={{
                flex: 1, padding: "8px", borderRadius: 8, fontSize: 12,
                background: scanType === "docker" ? "#00D4AA" : "#1A1F2E",
                color: scanType === "docker" ? "#0B0E14" : "#8B95A8",
                border: `1px solid ${scanType === "docker" ? "#00D4AA" : "#1E2535"}`,
                cursor: "pointer",
              }}>🐳 Docker Audit</button>
              <button onClick={() => setScanType("permissions")} style={{
                flex: 1, padding: "8px", borderRadius: 8, fontSize: 12,
                background: scanType === "permissions" ? "#00D4AA" : "#1A1F2E",
                color: scanType === "permissions" ? "#0B0E14" : "#8B95A8",
                border: `1px solid ${scanType === "permissions" ? "#00D4AA" : "#1E2535"}`,
                cursor: "pointer",
              }}>🔐 Permission Audit</button>
              <button onClick={() => setScanType("nginx")} style={{
                flex: 1, padding: "8px", borderRadius: 8, fontSize: 12,
                background: scanType === "nginx" ? "#00D4AA" : "#1A1F2E",
                color: scanType === "nginx" ? "#0B0E14" : "#8B95A8",
                border: `1px solid ${scanType === "nginx" ? "#00D4AA" : "#1E2535"}`,
                cursor: "pointer",
              }}>🌐 Proxy Audit</button>
              <button onClick={() => setScanType("infra")} style={{
                flex: 1, padding: "8px", borderRadius: 8, fontSize: 12,
                background: scanType === "infra" ? "#00D4AA" : "#1A1F2E",
                color: scanType === "infra" ? "#0B0E14" : "#8B95A8",
                border: `1px solid ${scanType === "infra" ? "#00D4AA" : "#1E2535"}`,
                cursor: "pointer",
              }}>🧠 Infra Intel</button>
            </div>
          </div>

          {!["secrets", "docker", "permissions", "nginx"].includes(scanType) ? (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#8B95A8", marginBottom: 8, display: "block" }}>
                🌐 IP o Dominio
              </label>
              <input
                value={targetHost}
                onChange={(e) => setTargetHost(e.target.value)}
                placeholder="es. 192.168.1.1 o example.com"
                style={{
                  width: "100%", padding: "12px 16px", borderRadius: 12,
                  background: "#131720", border: "1px solid #1E2535",
                  color: "#E8ECF4", fontSize: 14,
                }}
              />
            </div>
          ) : (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#8B95A8", marginBottom: 8, display: "block" }}>
                {scanType === "docker" ? "🐳 docker-compose.yml" : scanType === "permissions" ? "🔐 ls -la / sudoers / permission output" : scanType === "nginx" ? "🌐 nginx / Caddy / reverse proxy config" : "🔑 Config / .env / docker-compose / script"}
              </label>
              <textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder={
                  scanType === "docker"
                    ? "Paste docker-compose.yml content here..."
                    : scanType === "permissions"
                      ? "Paste ls -la, find output or sudoers snippets here..."
                      : scanType === "nginx"
                        ? "Paste nginx, Caddy or reverse proxy configuration here..."
                        : "Paste configuration content here...\n\nExample:\nDATABASE_URL=postgres://user:password@localhost:5432/app\nAPI_TOKEN=..."
                }
                style={{
                  width: "100%", height: 220, padding: 16, borderRadius: 12,
                  background: "#131720", border: "1px solid #1E2535",
                  color: "#E8ECF4", fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
                  resize: "vertical",
                }}
              />
            </div>
          )}

          {scanType === "ports" && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#8B95A8", marginBottom: 8, display: "block" }}>
                🔌 Porte (separate da virgola)
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

      <button onClick={handleAudit} style={{
        marginTop: 12, padding: "12px 28px", background: "#00D4AA", color: "#0B0E14",
        border: "none", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer",
      }}>
        {analyzing ? t.securityAuditorPage.analyzing : scanType === "secrets" ? "Analyze Secrets" : scanType === "docker" ? "Analyze Docker" : scanType === "permissions" ? "Analyze Permissions" : scanType === "nginx" ? "Analyze Proxy" : t.securityAuditorPage.analyze}
      </button>

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
          onAnalyzeRedirectedHost={(host) => {
            setTargetHost(host);
            handleAudit(host);
          }}
          onAnalyzeWithAI={async () => {
            if (!localResult) return;

            setAnalyzing(true);
            updateProgress(20, "Preparing AI analysis payload...");

            const aiPayload = JSON.stringify(localResult, null, 2);

            updateProgress(60, "AI operational analysis in progress...");

            const aiResponse = await onScan(
              targetHost || "local-security-audit",
              scanType,
              aiPayload
            );

            updateProgress(95, "Preparing AI report...");

            setResult(aiResponse);
            setLocalResult(null);
            setAnalyzing(false);
            setTimeout(() => setProgress(null), 700);
          }}
        />
      )}

      {result && !localResult && (
        <div style={{ marginTop: 24, animation: "slideInRight 0.3s ease" }}>
          <ProfessionalResult result={result} />
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
          🌐 {showNetworkVisibility ? "Hide Live Network Visibility" : "Open Live Network Visibility"}
        </button>

        {showNetworkVisibility && <NetworkVisibility />}
      </div>
    </div>
  );
};

export default SecurityAuditor;
