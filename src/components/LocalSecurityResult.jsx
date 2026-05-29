import React, { useState } from "react";
const severityColor = {
  CRITICAL: "#FF4D6A",
  HIGH: "#F97316",
  MEDIUM: "#FBBF24",
  LOW: "#00D4AA",
  INFO: "#38BDF8",
};

const box = {
  background: "#131720",
  border: "1px solid #1E2535",
  borderRadius: 14,
  padding: 16,
  marginBottom: 14,
};

const LocalSecurityResult = ({ result, onAnalyzeWithAI }) => {
  const [selectedService, setSelectedService] = useState(null);
  if (!result) return null;

  const findings = result.findings || [];
  const stack = result.detectedStack || [];
  const openPorts = result.openPorts || [];
  const serviceMatrix = result.serviceMatrix || [];

  const highestSeverity =
    findings.find((f) => f.severity === "CRITICAL")?.severity ||
    findings.find((f) => f.severity === "HIGH")?.severity ||
    findings.find((f) => f.severity === "MEDIUM")?.severity ||
    findings.find((f) => f.severity === "LOW")?.severity ||
    "INFO";



  const parseMailProbe = (probe) => {
    const banner = probe?.banner || "";

    return {
      starttls: /STARTTLS|STLS/i.test(banner),
      auth: banner.match(/AUTH[=\s]([A-Z0-9\-\s]+)/i)?.[1] || "",
      dovecot: /dovecot/i.test(banner),
      postfix: /postfix/i.test(banner),
      exim: /exim/i.test(banner),
      exchange: /exchange/i.test(banner),
      capabilities: banner
        .split(/\r?\n/)
        .filter(line =>
          /(AUTH|STARTTLS|STLS|CAPA|PIPELINING|SIZE|UIDL|IMAP4)/i.test(line)
        )
        .slice(0, 20)
    };
  };



  const parseDatabaseProbe = (probe, service) => {
    const banner = probe?.banner || "";

    const mysqlVersion =
      banner.match(/([0-9]+\.[0-9]+\.[0-9]+[-A-Za-z0-9._]*)-MariaDB/i)?.[1] ||
      banner.match(/([0-9]+\.[0-9]+\.[0-9]+)/)?.[1] ||
      "";

    const redisVersion =
      banner.match(/redis_version:([^\r\n]+)/i)?.[1]?.trim() || "";

    return {
      family:
        /mariadb/i.test(banner) ? "MariaDB" :
        /mysql/i.test(banner) ? "MySQL" :
        /postgres/i.test(banner) ? "PostgreSQL" :
        /redis/i.test(banner) || /\+PONG/i.test(banner) ? "Redis" :
        /mongodb/i.test(banner) ? "MongoDB" :
        service,
      version: mysqlVersion || redisVersion,
      authentication:
        /mysql_native_password|caching_sha2_password|authentication/i.test(banner)
          ? "Required"
          : /NOAUTH|Authentication required/i.test(banner)
            ? "Required"
            : /\+PONG/i.test(banner)
              ? "Not required or PING allowed"
              : "Unknown",
      exposure: "Network reachable",
      riskHint:
        service === "redis" && /\+PONG/i.test(banner)
          ? "Redis responded to unauthenticated PING"
          : service === "mysql"
            ? "Database handshake exposed"
            : service === "postgresql"
              ? "PostgreSQL endpoint reachable"
              : service === "mongodb"
                ? "MongoDB endpoint reachable"
                : "Database service reachable",
      raw: banner
    };
  };


  const renderServicePanel = (service) => {
    const selectedService = service;
    const panelResult = service.hostScope === "redirected"
      ? {
          ...result,
          httpData: result.redirectedHostData?.httpData,
          tlsData: result.redirectedHostData?.tlsData,
          openPorts: result.redirectedHostData?.openPorts || [],
          serviceMatrix: result.redirectedHostData?.serviceMatrix || []
        }
      : result;

    return (
        <div style={{
          ...box,
          border: "1px solid #00D4AA",
          background: "linear-gradient(180deg, #101826 0%, #0B0E14 100%)"
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14
          }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>
                {selectedService.service} intelligence
              </div>

              <div style={{
                color: "#8B95A8",
                marginTop: 4,
                fontSize: 13
              }}>
                Port {selectedService.port}
              </div>
            </div>

            <div style={{
              color: severityColor[selectedService.severity] || "#8B95A8",
              fontWeight: 900,
              fontSize: 18
            }}>
              {selectedService.severity}
            </div>
          </div>

          <div style={{
            display: "grid",
            gap: 10
          }}>
            <div>
              <strong>Recommended probes:</strong><br />
              <span style={{ color: "#8B95A8" }}>
                {(selectedService.probes || []).join(", ") || "none"}
              </span>
            </div>

            {["http", "https", "http-alt", "https-alt", "grafana"].includes(selectedService.service) && panelResult.httpData?.fingerprint?.technologies?.length > 0 && (
              <div>
                <strong>Detected technologies:</strong><br />
                <span style={{ color: "#8B95A8" }}>
                  {panelResult.httpData.fingerprint.technologies.join(", ")}
                </span>
              </div>
            )}

            {["http", "https", "http-alt", "https-alt", "grafana"].includes(selectedService.service) && Object.keys(panelResult.httpData?.fingerprint?.versions || {}).length > 0 && (
              <div>
                <strong>Detected versions:</strong>

                <div style={{
                  display: "grid",
                  gap: 6,
                  marginTop: 8
                }}>
                  {Object.entries(panelResult.httpData.fingerprint.versions).map(([name, version]) => (
                    <div key={name} style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: "#0F131C",
                      border: "1px solid #1E2535"
                    }}>
                      <span>{name}</span>
                      <strong>{version}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {["http", "https", "http-alt", "https-alt", "grafana"].includes(selectedService.service) && panelResult.httpData?.fingerprint?.metadata?.serverHeader && (
              <div>
                <strong>Server header:</strong><br />
                <span style={{ color: "#8B95A8" }}>
                  {panelResult.httpData.fingerprint.metadata.serverHeader}
                </span>
              </div>
            )}


            {["http", "https", "http-alt", "https-alt", "grafana"].includes(selectedService.service) && panelResult.httpData?.fingerprint?.attackSurface && (
              <div style={{
                padding: 12,
                borderRadius: 10,
                background: "#0F131C",
                border: "1px solid #1E2535"
              }}>
                <strong>Attack surface intelligence</strong>

                <div style={{
                  marginTop: 10,
                  display: "grid",
                  gap: 12
                }}>

                  <div>
                    <strong>Confidence:</strong><br />
                    <span style={{ color: "#00D4AA" }}>
                      {panelResult.httpData.fingerprint.attackSurface.confidence}
                    </span>
                  </div>

                  <div>
                    <strong>Probable role:</strong><br />
                    <span style={{ color: "#8B95A8" }}>
                      {(panelResult.httpData.fingerprint.attackSurface.probableRole || []).join(", ") || "unknown"}
                    </span>
                  </div>

                  <div>
                    <strong>Metadata leaks:</strong><br />
                    <span style={{ color: "#8B95A8" }}>
                      {(panelResult.httpData.fingerprint.attackSurface.metadataLeaks || []).join(", ") || "none"}
                    </span>
                  </div>

                  <div>
                    <strong>Exposure profile:</strong><br />
                    <span style={{ color: "#8B95A8" }}>
                      {(panelResult.httpData.fingerprint.attackSurface.exposure || []).join(", ") || "unknown"}
                    </span>
                  </div>

                </div>
              </div>
            )}

            {["http", "https", "http-alt", "https-alt", "grafana"].includes(selectedService.service) && panelResult.httpData?.advancedProbe?.title && (
              <div>
                <strong>Page title:</strong><br />
                <span style={{ color: "#8B95A8" }}>
                  {panelResult.httpData.advancedProbe.title}
                </span>
              </div>
            )}

            {["http", "https", "http-alt", "https-alt", "grafana"].includes(selectedService.service) && panelResult.httpData?.advancedProbe?.finalUrl && (
              <div>
                <strong>Final URL:</strong><br />
                <span style={{ color: "#8B95A8", wordBreak: "break-all" }}>
                  {panelResult.httpData.advancedProbe.finalUrl}
                </span>
              </div>
            )}

            {["http", "https", "http-alt", "https-alt", "grafana"].includes(selectedService.service) && panelResult.httpData?.advancedProbe?.htmlLength && (
              <div>
                <strong>HTML response size:</strong><br />
                <span style={{ color: "#8B95A8" }}>
                  {panelResult.httpData.advancedProbe.htmlLength} bytes
                </span>
              </div>
            )}

            {["http", "https", "http-alt", "https-alt", "grafana"].includes(selectedService.service) && panelResult.httpData?.advancedProbe?.fingerprint && (
              <div>
                <strong>Application fingerprint:</strong>

                <div style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginTop: 10
                }}>
                  {Object.entries(panelResult.httpData.advancedProbe.fingerprint)
                    .filter(([_, value]) => value)
                    .map(([name]) => (
                      <div key={name} style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        background: "#132033",
                        border: "1px solid #1E3A5F",
                        color: "#7DD3FC",
                        fontSize: 12,
                        fontWeight: 700
                      }}>
                        {name}
                      </div>
                    ))}
                </div>
              </div>
            )}


            {selectedService.service === "ftp" && panelResult.ftpData?.success && (
              <div style={{
                padding: 12,
                borderRadius: 10,
                background: "#0F131C",
                border: "1px solid #1E2535"
              }}>
                <strong>FTP fingerprint</strong>

                <div style={{
                  marginTop: 10,
                  display: "grid",
                  gap: 8
                }}>

                  {panelResult.ftpData.banner && (
                    <div>
                      <strong>Banner:</strong><br />
                      <span style={{ color: "#8B95A8" }}>
                        {panelResult.ftpData.banner}
                      </span>
                    </div>
                  )}

                  {panelResult.ftpData.software && (
                    <div>
                      <strong>Software:</strong><br />
                      <span style={{ color: "#8B95A8" }}>
                        {panelResult.ftpData.software}
                      </span>
                    </div>
                  )}

                  {panelResult.ftpData.version && (
                    <div>
                      <strong>Version:</strong><br />
                      <span style={{ color: "#8B95A8" }}>
                        {panelResult.ftpData.version}
                      </span>
                    </div>
                  )}

                  <div>
                    <strong>Transport:</strong><br />
                    <span style={{ color: "#F97316" }}>
                      FTP transmits credentials in cleartext
                    </span>
                  </div>

                </div>
              </div>
            )}



            {panelResult.serviceProbeData?.[String(selectedService.port)] && !["ssh", "ftp", "http", "https", "http-alt", "https-alt", "grafana"].includes(selectedService.service) && (
              <div style={{
                padding: 12,
                borderRadius: 10,
                background: "#0F131C",
                border: "1px solid #1E2535"
              }}>
                <strong>{selectedService.service} service probe</strong>

                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  <div>
                    <strong>Status:</strong><br />
                    <span style={{ color: panelResult.serviceProbeData[String(selectedService.port)].success ? "#00D4AA" : "#FBBF24" }}>
                      {panelResult.serviceProbeData[String(selectedService.port)].success ? "Responsive" : "No banner / timeout"}
                    </span>
                  </div>

                  {panelResult.serviceProbeData[String(selectedService.port)].banner && (
                    <div>
                      <strong>Banner / response:</strong>
                      <pre style={{
                        marginTop: 8,
                        padding: 10,
                        borderRadius: 10,
                        background: "#0B0E14",
                        border: "1px solid #1E2535",
                        color: "#8B95A8",
                        whiteSpace: "pre-wrap",
                        maxHeight: 220,
                        overflow: "auto"
                      }}>
{panelResult.serviceProbeData[String(selectedService.port)].banner}
                      </pre>
                    </div>
                  )}

                  {!panelResult.serviceProbeData[String(selectedService.port)].success && (
                    <div>
                      <strong>Probe note:</strong><br />
                      <span style={{ color: "#8B95A8" }}>
                        {panelResult.serviceProbeData[String(selectedService.port)].error || "Service did not expose a readable banner."}
                      </span>
                    </div>
                  )}

                  <div>
                    <strong>Exposure note:</strong><br />
                    <span style={{ color: "#8B95A8" }}>
                      This service is reachable on the scanned target. Validate whether it is intentionally exposed and restrict access with firewall rules, VPN, allowlists or service-level authentication.
                    </span>
                  </div>
                </div>
              </div>
            )}



            {["smtp","smtps","submission","pop3","imap","imaps","pop3s"].includes(selectedService.service) &&
              panelResult.serviceProbeData?.[String(selectedService.port)] && (() => {

              const probe = panelResult.serviceProbeData[String(selectedService.port)];
              const mail = probe.mail || parseMailProbe(probe);

              return (
                <div style={{
                  padding: 12,
                  borderRadius: 10,
                  background: "#0F131C",
                  border: "1px solid #1E2535"
                }}>
                  <strong>Mail intelligence</strong>

                  <div style={{
                    display: "grid",
                    gap: 10,
                    marginTop: 10
                  }}>

                    <div>
                      <strong>Server family:</strong><br />
                      <span style={{ color: "#8B95A8" }}>
                        {
                          mail.serverFamily ||
                          (mail.dovecot ? "Dovecot" :
                          mail.postfix ? "Postfix" :
                          mail.exim ? "Exim" :
                          mail.exchange ? "Microsoft Exchange" :
                          "Unknown")
                        }
                      </span>
                    </div>

                    {mail.version && (
                      <div>
                        <strong>Version:</strong><br />
                        <span style={{ color: "#8B95A8" }}>
                          {mail.version}
                        </span>
                      </div>
                    )}

                    <div>
                      <strong>TLS support:</strong><br />
                      <span style={{
                        color: mail.starttls ? "#00D4AA" : "#FBBF24"
                      }}>
                        {mail.implicitTls
                          ? `Implicit TLS${mail.tlsProtocol ? ` (${mail.tlsProtocol})` : ""}`
                          : mail.starttls
                            ? "STARTTLS available"
                            : "Not detected"}
                      </span>
                    </div>

                    {mail.tlsCipher && (
                      <div>
                        <strong>TLS cipher:</strong><br />
                        <span style={{ color: "#8B95A8" }}>
                          {mail.tlsCipher}
                        </span>
                      </div>
                    )}

                    {mail.auth && (
                      <div>
                        <strong>Authentication:</strong><br />
                        <span style={{ color: "#8B95A8" }}>
                          {Array.isArray(mail.auth) ? mail.auth.join(", ") : mail.auth}
                        </span>
                      </div>
                    )}

                    {mail.capabilities.length > 0 && (
                      <div>
                        <strong>Capabilities:</strong>

                        <div style={{
                          marginTop: 8,
                          display: "grid",
                          gap: 4
                        }}>
                          {mail.capabilities.map((cap, idx) => (
                            <div key={idx}
                              style={{
                                color: "#8B95A8",
                                fontFamily: "monospace"
                              }}>
                              {cap}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}



            {["mysql","postgresql","redis","mongodb","mssql","oracle"].includes(selectedService.service) &&
              panelResult.serviceProbeData?.[String(selectedService.port)] && (() => {

              const probe = panelResult.serviceProbeData[String(selectedService.port)];
              const db = parseDatabaseProbe(probe, selectedService.service);

              return (
                <div style={{
                  padding: 12,
                  borderRadius: 10,
                  background: "#0F131C",
                  border: "1px solid #1E2535"
                }}>
                  <strong>Database intelligence</strong>

                  <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                    <div>
                      <strong>Engine:</strong><br />
                      <span style={{ color: "#8B95A8" }}>{db.family}</span>
                    </div>

                    {db.version && (
                      <div>
                        <strong>Version:</strong><br />
                        <span style={{ color: "#8B95A8" }}>{db.version}</span>
                      </div>
                    )}

                    <div>
                      <strong>Authentication:</strong><br />
                      <span style={{ color: db.authentication === "Required" ? "#00D4AA" : "#FBBF24" }}>
                        {db.authentication}
                      </span>
                    </div>

                    <div>
                      <strong>Exposure:</strong><br />
                      <span style={{ color: "#F97316" }}>
                        {db.exposure}
                      </span>
                    </div>

                    <div>
                      <strong>Risk signal:</strong><br />
                      <span style={{ color: selectedService.service === "redis" && db.authentication !== "Required" ? "#FF4D6A" : "#FBBF24" }}>
                        {db.riskHint}
                      </span>
                    </div>

                    <div>
                      <strong>Recommended hardening:</strong>
                      <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                        {[
                          "Restrict access to localhost, VPN or private networks",
                          "Use firewall allowlists for trusted source IPs only",
                          "Disable public exposure unless explicitly required",
                          "Enforce strong authentication and least-privilege users",
                          "Review logs for internet-origin connection attempts"
                        ].map((item, idx) => (
                          <div key={idx} style={{
                            padding: "8px 10px",
                            borderRadius: 8,
                            background: "#1A1710",
                            border: "1px solid #FBBF24",
                            color: "#FDE68A",
                            fontSize: 12
                          }}>
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}


            {selectedService.service === "ssh" && panelResult.sshData?.success && (
              <div style={{
                padding: 12,
                borderRadius: 10,
                background: "#0F131C",
                border: "1px solid #1E2535"
              }}>
                <strong>SSH fingerprint</strong>

                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  <div>
                    <strong>Banner:</strong><br />
                    <span style={{ color: "#8B95A8" }}>
                      {panelResult.sshData.banner}
                    </span>
                  </div>

                  {panelResult.sshData.software && (
                    <div>
                      <strong>Software:</strong><br />
                      <span style={{ color: "#8B95A8" }}>
                        {panelResult.sshData.software}
                      </span>
                    </div>
                  )}

                  <div>
                    <strong>Metadata leak:</strong><br />
                    <span style={{ color: panelResult.sshData.metadataLeak ? "#FBBF24" : "#00D4AA" }}>
                      {panelResult.sshData.metadataLeak ? "SSH software/version is disclosed" : "No SSH banner metadata detected"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {selectedService.service === "ssh" && panelResult.sshAuditData?.parsed && (
              <div style={{
                padding: 12,
                borderRadius: 10,
                background: "#0F131C",
                border: "1px solid #1E2535"
              }}>
                <strong>SSH crypto posture</strong>

                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 10,
                  marginTop: 12
                }}>
                  {[
                    { label: "Score", value: `${panelResult.sshAuditData.parsed.score}/100` },
                    { label: "Failures", value: panelResult.sshAuditData.parsed.failures.length },
                    { label: "Warnings", value: panelResult.sshAuditData.parsed.warnings.length },
                    { label: "Recommendations", value: panelResult.sshAuditData.parsed.recommendations.length }
                  ].map((item) => (
                    <div key={item.label} style={{
                      padding: 10,
                      borderRadius: 10,
                      background: "#131720",
                      border: "1px solid #263149"
                    }}>
                      <div style={{ color: "#8B95A8", fontSize: 11 }}>{item.label}</div>
                      <div style={{
                          fontSize: 20,
                          fontWeight: 900,
                          color:
                            item.label !== "Score"
                              ? "#E8ECF4"
                              : parseInt(item.value) >= 85
                                ? "#00D4AA"
                                : parseInt(item.value) >= 60
                                  ? "#FBBF24"
                                  : "#FF4D6A"
                        }}>
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
                  <div>
                    <strong>Key exchange algorithms:</strong><br />
                    <span style={{ color: "#8B95A8" }}>
                      {panelResult.sshAuditData.parsed.kex.slice(0, 5).join(" | ") || "none detected"}
                    </span>
                  </div>

                  <div>
                    <strong>Ciphers:</strong><br />
                    <span style={{ color: "#8B95A8" }}>
                      {panelResult.sshAuditData.parsed.ciphers.slice(0, 5).join(" | ") || "none detected"}
                    </span>
                  </div>

                  <div>
                    <strong>MAC algorithms:</strong><br />
                    <span style={{ color: "#8B95A8" }}>
                      {panelResult.sshAuditData.parsed.macs.slice(0, 5).join(" | ") || "none detected"}
                    </span>
                  </div>

                  {panelResult.sshAuditData.parsed.failures.length > 0 && (
                    <div>
                      <strong style={{ color: "#FF4D6A" }}>Failures:</strong>
                      <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                        {panelResult.sshAuditData.parsed.failures.slice(0, 6).map((item, index) => (
                          <div key={index} style={{
                            padding: "8px 10px",
                            borderRadius: 8,
                            background: "#1A1118",
                            border: "1px solid #FF4D6A",
                            color: "#FCA5A5",
                            fontSize: 12
                          }}>
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {panelResult.sshAuditData.parsed.recommendations.length > 0 && (
                    <div>
                      <strong style={{ color: "#FBBF24" }}>Recommended removals:</strong>
                      <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                        {panelResult.sshAuditData.parsed.recommendations.slice(0, 8).map((item, index) => (
                          <div key={index} style={{
                            padding: "8px 10px",
                            borderRadius: 8,
                            background: "#1A1710",
                            border: "1px solid #FBBF24",
                            color: "#FDE68A",
                            fontSize: 12
                          }}>
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {panelResult.sshAuditData.parsed.fingerprints.length > 0 && (
                    <div>
                      <strong>Host key fingerprints:</strong>
                      <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                        {panelResult.sshAuditData.parsed.fingerprints.map((item, index) => (
                          <div key={index} style={{
                            padding: "8px 10px",
                            borderRadius: 8,
                            background: "#131720",
                            border: "1px solid #263149",
                            color: "#8B95A8",
                            fontSize: 12
                          }}>
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <strong>Operational assessment:</strong><br />
              <span style={{ color: "#8B95A8" }}>
                This service may expose infrastructure metadata, authentication surfaces or operational interfaces depending on configuration and network exposure.
              </span>
            </div>

            {["http", "https", "http-alt", "https-alt", "grafana"].includes(selectedService.service) && panelResult.httpData?.headers && (
              <div>
                <strong>Raw HTTP headers:</strong>

                <div style={{
                  marginTop: 8,
                  padding: 10,
                  borderRadius: 10,
                  background: "#0F131C",
                  border: "1px solid #1E2535",
                  maxHeight: 220,
                  overflow: "auto",
                  fontSize: 12,
                  fontFamily: "monospace"
                }}>
                  <pre style={{ margin: 0, color: "#8B95A8" }}>
{JSON.stringify(panelResult.httpData.headers, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            <div>
              <strong>Recommended next steps:</strong><br />
              <span style={{ color: "#8B95A8" }}>
                Run chained probes and validate whether this service is intentionally exposed to public networks.
              </span>
            </div>
          </div>
        </div>
    );
  };

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>
            {result.title || "Local security result"}
          </h3>
          <p style={{ margin: "6px 0 0", color: "#8B95A8", fontSize: 13 }}>
            Local-first result. No AI analysis has been run yet.
          </p>
        </div>

        <button
          onClick={onAnalyzeWithAI}
          style={{
            padding: "10px 16px",
            borderRadius: 10,
            border: "1px solid #00D4AA",
            background: "#00D4AA",
            color: "#0B0E14",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          🧠 Analyze with AI
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ ...box, minWidth: 160, marginBottom: 0 }}>
          <div style={{ color: "#8B95A8", fontSize: 11, fontWeight: 700 }}>RISK</div>
          <div style={{ color: severityColor[highestSeverity], fontSize: 18, fontWeight: 800 }}>
            {highestSeverity}
          </div>
        </div>

        <div style={{ ...box, minWidth: 160, marginBottom: 0 }}>
          <div style={{ color: "#8B95A8", fontSize: 11, fontWeight: 700 }}>FINDINGS</div>
          <div style={{ color: "#E8ECF4", fontSize: 18, fontWeight: 800 }}>{findings.length}</div>
        </div>

        <div style={{ ...box, minWidth: 160, marginBottom: 0 }}>
          <div style={{ color: "#8B95A8", fontSize: 11, fontWeight: 700 }}>MODE</div>
          <div style={{ color: "#00D4AA", fontSize: 18, fontWeight: 800 }}>LOCAL</div>
        </div>
      </div>

      {stack.length > 0 && (
        <div style={box}>
          <div style={{ color: "#8B95A8", fontSize: 12, fontWeight: 700, marginBottom: 10 }}>Detected stack</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {stack.map((item) => (
              <span key={item} style={{
                padding: "6px 10px",
                borderRadius: 999,
                background: "#1A1F2E",
                border: "1px solid #2A3246",
                color: "#E8ECF4",
                fontSize: 12,
              }}>
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {openPorts.length > 0 && (
        <div style={box}>
          <div style={{ color: "#8B95A8", fontSize: 12, fontWeight: 700, marginBottom: 10 }}>Open ports</div>
          <div style={{ display: "grid", gap: 8 }}>
            {openPorts.map((port) => (
              <div key={`${port.port}-${port.service}`} style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "10px 12px",
                borderRadius: 10,
                background: "#0F131C",
                border: "1px solid #1E2535",
              }}>
                <strong>{port.port}</strong>
                <span style={{ color: "#8B95A8" }}>{port.service}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.redirectedHostData?.host && (
        <div style={{
          ...box,
          border: "1px solid #38BDF8",
          background: "#101826"
        }}>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>
            Redirected host detected
          </div>

          <div style={{ color: "#8B95A8", marginBottom: 10 }}>
            The original target redirects to <strong>{result.redirectedHostData.host}</strong>.
            This host may expose a different service profile.
          </div>

          <div style={{ marginBottom: 10 }}>
            <button
              onClick={() => {
                navigator.clipboard.writeText(result.redirectedHostData.host);
                alert("Redirected host copied. Paste it into the target field and run X-Ray.");
              }}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #38BDF8",
                background: "#0F172A",
                color: "#38BDF8",
                fontWeight: 800,
                cursor: "pointer"
              }}
            >
              📋 Copy redirected host
            </button>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            {(result.redirectedHostData.results || [])
              .filter((p) => p.status === "open")
              .map((p) => (
                <div key={`${p.port}-${p.service}`} style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "#0F131C",
                  border: "1px solid #1E2535"
                }}>
                  <strong>{p.port}</strong>
                  <span style={{ color: "#8B95A8" }}>{p.service}</span>
                </div>
              ))}
          </div>

          {result.redirectedHostData.serviceMatrix?.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ color: "#38BDF8", fontSize: 12, fontWeight: 800, marginBottom: 8 }}>
                Redirected host service matrix
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                {result.redirectedHostData.serviceMatrix.map((item) => {
                  const scopedItem = {
                    ...item,
                    hostScope: "redirected",
                    host: result.redirectedHostData.host
                  };

                  return (
                    <React.Fragment key={`redirected-${item.port}-${item.service}`}>
                      <div
                        onClick={() => setSelectedService(
                          selectedService?.hostScope === "redirected" && selectedService?.port === item.port
                            ? null
                            : scopedItem
                        )}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "40px 80px 1fr 120px 1.5fr",
                          gap: 10,
                          alignItems: "center",
                          padding: "10px 12px",
                          borderRadius: 10,
                          background: "#0F131C",
                          border: "1px solid #1E2535",
                          cursor: "pointer",
                          boxShadow:
                            selectedService?.hostScope === "redirected" && selectedService?.port === item.port
                              ? "0 0 0 1px #38BDF8"
                              : "none"
                        }}
                      >
                        <span style={{ color: "#38BDF8", fontWeight: 900 }}>
                          {selectedService?.hostScope === "redirected" && selectedService?.port === item.port ? "▼" : "▶"}
                        </span>
                        <strong>{item.port}</strong>
                        <span>{item.service}</span>
                        <span style={{
                          color: severityColor[item.severity] || "#8B95A8",
                          fontWeight: 800
                        }}>
                          {item.severity}
                        </span>
                        <span style={{ color: "#8B95A8", fontSize: 12 }}>
                          redirected host · click for intelligence
                        </span>
                      </div>

                      {selectedService?.hostScope === "redirected" && selectedService?.port === item.port && (
                        <div style={{ marginTop: 8, marginBottom: 8 }}>
                          {renderServicePanel(scopedItem)}
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {serviceMatrix.length > 0 && (
        <div style={box}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ color: "#8B95A8", fontSize: 12, fontWeight: 700 }}>
              Service matrix
            </div>
            <div style={{ color: "#00D4AA", fontSize: 12, fontWeight: 700 }}>
              Click a service row for deep intelligence →
            </div>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            {serviceMatrix.map((item) => (
              <React.Fragment key={`${item.port}-${item.service}`}>
                <div
                  onClick={() => setSelectedService(
                    selectedService?.port === item.port ? null : item
                  )}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "40px 80px 1fr 120px 1.5fr",
                    gap: 10,
                    alignItems: "center",
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "#0F131C",
                    border: "1px solid #1E2535",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    boxShadow: selectedService?.port === item.port ? "0 0 0 1px #00D4AA" : "none"
                  }}>
                  <span style={{ color: "#00D4AA", fontWeight: 900 }}>
                    {selectedService?.port === item.port ? "▼" : "▶"}
                  </span>
                  <strong>{item.port}</strong>
                  <span>{item.service}</span>
                  <span style={{
                    color: severityColor[item.severity] || "#8B95A8",
                    fontWeight: 800
                  }}>
                    {item.severity}
                  </span>
                  <span style={{ color: "#8B95A8", fontSize: 12 }}>
                    {(item.probes || []).join(", ") || "no chained probe"} · click for intelligence
                  </span>
                </div>

                {selectedService?.port === item.port && (
                  <div style={{ marginTop: 8, marginBottom: 8 }}>
                    {renderServicePanel(item)}
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}



      <div style={box}>
        <div style={{ color: "#8B95A8", fontSize: 12, fontWeight: 700, marginBottom: 10 }}>Findings</div>
        {findings.length === 0 ? (
          <p style={{ color: "#8B95A8" }}>No local findings detected.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {findings.map((finding, index) => (
              <div key={`${finding.title}-${index}`} style={{
                padding: 12,
                borderRadius: 10,
                background: "#0F131C",
                border: `1px solid ${severityColor[finding.severity] || "#1E2535"}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <strong>{finding.title}</strong>
                  <span style={{ color: severityColor[finding.severity], fontWeight: 800 }}>
                    {finding.severity}
                  </span>
                </div>
                <p style={{ color: "#B8C0D0", marginBottom: 8 }}>{finding.evidence}</p>
                <p style={{ color: "#8B95A8", margin: 0 }}>{finding.remediation}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LocalSecurityResult;
