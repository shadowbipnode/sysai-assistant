import React, { useState } from "react";
import { buildOperationalRunbook, exportRunbook } from "../utils/runbookGenerator";
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

const webIntelligenceServices = [
  "http",
  "https",
  "http-alt",
  "https-alt",
  "grafana",
  "prometheus",
  "elasticsearch",
  "docker"
];

const serviceGroups = {
  web: ["http", "https", "http-alt", "https-alt", "grafana", "prometheus"],
  mail: ["smtp", "smtps", "submission", "imap", "imaps", "pop3", "pop3s"],
  remoteAccess: ["ssh", "rdp", "vnc", "telnet", "ftp"],
  database: ["mysql", "postgresql", "redis", "mongodb", "mssql", "oracle", "elasticsearch"]
};

const LocalSecurityResult = ({ result, onAnalyzeWithAI, onAnalyzeRedirectedHost, t = null }) => {
  const [selectedService, setSelectedService] = useState(null);
  const [expandedRawSections, setExpandedRawSections] = useState({});
  const [copiedRunbook, setCopiedRunbook] = useState(false);
  if (!result) return null;

  const findings = result.findings || [];
  const stack = result.detectedStack || [];
  const openPorts = result.openPorts || [];
  const serviceMatrix = result.serviceMatrix || [];
  const actionLabels = t?.resultActions || {
    copyRunbook: "Copy runbook",
    copiedRunbook: "Runbook copied",
    exportRunbook: "Export runbook",
  };

  const getServiceRisk = (service) => {
    const port = String(service.port);
    return result.exposureRisk?.services?.find(
      (item) => String(item.port) === port
    )?.risk || null;
  };

  const getWebIntel = (service, panelResult = result) => {
    const byPort = panelResult.webIntelData?.[String(service.port)];
    if (byPort) return byPort;
    if (["http", "https"].includes(service.service)) return panelResult.httpData;
    return null;
  };

  const toggleRawSection = (key) => {
    setExpandedRawSections((current) => ({
      ...current,
      [key]: !current[key]
    }));
  };

  const renderPill = (value, tone = "info") => {
    const colors = {
      critical: ["#2A1118", "#FF4D6A", "#FCA5A5"],
      warning: ["#1A1710", "#FBBF24", "#FDE68A"],
      success: ["#0F1F1B", "#00D4AA", "#99F6E4"],
      info: ["#132033", "#1E3A5F", "#7DD3FC"]
    };
    const [background, border, color] = colors[tone] || colors.info;

    return (
      <span style={{
        display: "inline-flex",
        padding: "5px 9px",
        borderRadius: 999,
        background,
        border: `1px solid ${border}`,
        color,
        fontSize: 12,
        fontWeight: 800,
        marginRight: 6,
        marginBottom: 6
      }}>
        {value}
      </span>
    );
  };

  const attackSurfaceSummary = result.attackSurfaceSummary || {
    webServices: serviceMatrix.filter((item) => serviceGroups.web.includes(item.service)).length,
    mailServices: serviceMatrix.filter((item) => serviceGroups.mail.includes(item.service)).length,
    remoteAccessServices: serviceMatrix.filter((item) => serviceGroups.remoteAccess.includes(item.service)).length,
    databaseServices: serviceMatrix.filter((item) => serviceGroups.database.includes(item.service)).length,
    detectedAdminPanels: Object.values(result.webIntelData || {}).filter((intel) =>
      intel?.advancedProbe?.fingerprint?.loginPanel ||
      intel?.advancedProbe?.fingerprint?.adminPath ||
      intel?.advancedProbe?.fingerprint?.phpmyadmin ||
      intel?.advancedProbe?.fingerprint?.grafana ||
      intel?.advancedProbe?.fingerprint?.prometheus ||
      intel?.advancedProbe?.fingerprint?.portainer ||
      intel?.advancedProbe?.fingerprint?.nextcloud ||
      intel?.advancedProbe?.fingerprint?.lnbits ||
      intel?.advancedProbe?.fingerprint?.wordpressAdmin ||
      intel?.advancedProbe?.adminHints?.length ||
      intel?.fingerprint?.metadata?.adminPanels?.length
    ).length,
    exposureClass: result.exposureRisk?.level || "LOW"
  };

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

  const describeMailRole = (service) => {
    if (["smtp", "smtps"].includes(service)) return "Inbound mail transfer";
    if (service === "submission") return "Authenticated outbound submission";
    if (["imap", "imaps"].includes(service)) return "Mailbox access";
    if (["pop3", "pop3s"].includes(service)) return "Legacy mailbox retrieval";
    return "Mail service";
  };



  const parseDatabaseProbe = (probe, service) => {
    const banner = probe?.banner || "";
    const database = probe?.database || {};
    const elasticsearch = probe?.elasticsearch || {};

    const mysqlVersion =
      banner.match(/([0-9]+\.[0-9]+\.[0-9]+[-A-Za-z0-9._]*)-MariaDB/i)?.[1] ||
      banner.match(/([0-9]+\.[0-9]+\.[0-9]+)/)?.[1] ||
      "";

    const redisVersion =
      banner.match(/redis_version:([^\r\n]+)/i)?.[1]?.trim() || "";

    return {
      family:
        database.vendor ||
        (/mariadb/i.test(banner) ? "MariaDB" :
        /mysql/i.test(banner) ? "MySQL" :
        /postgres/i.test(banner) ? "PostgreSQL" :
        /redis/i.test(banner) || /\+PONG/i.test(banner) ? "Redis" :
        /mongodb/i.test(banner) ? "MongoDB" :
        service === "elasticsearch" ? "Elasticsearch" :
        service),
      version: database.version || elasticsearch.version || mysqlVersion || redisVersion,
      authPlugin: database.authPlugin || "",
      handshakeExposed: database.handshakeExposed,
      authentication:
        service === "elasticsearch"
          ? "Unknown or not visible from root endpoint"
          :
        database.auth === "required"
          ? "Required"
          : database.auth === "not-required-or-ping-allowed"
            ? "PING allowed without auth"
            : database.auth === "required-or-filtered-after-connect"
              ? "Required or filtered after connect"
              :
        /mysql_native_password|caching_sha2_password|authentication/i.test(banner)
          ? "Required"
          : /NOAUTH|Authentication required/i.test(banner)
            ? "Required"
            : /\+PONG/i.test(banner)
              ? "Not required or PING allowed"
              : "Unknown",
      exposure: "Network reachable",
      riskHint:
        service === "elasticsearch" && elasticsearch.reachable
          ? "Elasticsearch API endpoint responded"
          :
        service === "redis" && database.redisInfoAvailable
          ? "Redis INFO server responded"
          : service === "redis" && database.redisNoAuth
            ? "Redis requires authentication"
            : service === "redis" && (database.redisPongWithoutAuth || /\+PONG/i.test(banner))
              ? "Redis responded to unauthenticated PING"
              : service === "mysql"
            ? "Database handshake exposed"
            : service === "postgresql"
              ? "PostgreSQL endpoint reachable"
              : service === "mongodb"
                ? "MongoDB endpoint reachable"
                : service === "elasticsearch"
                  ? "Elasticsearch endpoint reachable"
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
    const webIntel = getWebIntel(selectedService, panelResult);

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

            {webIntelligenceServices.includes(selectedService.service) && webIntel?.fingerprint?.technologies?.length > 0 && (
              <div>
                <strong>Detected technologies:</strong><br />
                <span style={{ color: "#8B95A8" }}>
                  {webIntel.fingerprint.technologies.join(", ")}
                </span>
              </div>
            )}

            {webIntelligenceServices.includes(selectedService.service) && Object.keys(webIntel?.fingerprint?.versions || {}).length > 0 && (
              <div>
                <strong>Detected versions:</strong>

                <div style={{
                  display: "grid",
                  gap: 6,
                  marginTop: 8
                }}>
                  {Object.entries(webIntel.fingerprint.versions).map(([name, version]) => (
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

            {webIntelligenceServices.includes(selectedService.service) && webIntel?.fingerprint?.metadata?.serverHeader && (
              <div>
                <strong>Server header:</strong><br />
                <span style={{ color: "#8B95A8" }}>
                  {webIntel.fingerprint.metadata.serverHeader}
                </span>
              </div>
            )}

            {webIntelligenceServices.includes(selectedService.service) && webIntel && (
              <div>
                <strong>TLS status:</strong><br />
                <span style={{
                  color: String(webIntel.url || "").startsWith("https:") || ["https", "https-alt"].includes(selectedService.service)
                    ? "#00D4AA"
                    : "#FBBF24"
                }}>
                  {String(webIntel.url || "").startsWith("https:") || ["https", "https-alt"].includes(selectedService.service)
                    ? panelResult.tlsData?.certificate?.authorized === false
                      ? "HTTPS detected, certificate trust warning"
                      : "HTTPS detected"
                    : "HTTP or TLS not confirmed"}
                </span>
              </div>
            )}


            {webIntelligenceServices.includes(selectedService.service) && webIntel?.fingerprint?.attackSurface && (
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
                      {webIntel.fingerprint.attackSurface.confidence}
                    </span>
                  </div>

                  <div>
                    <strong>Probable role:</strong><br />
                    <span style={{ color: "#8B95A8" }}>
                      {(webIntel.fingerprint.attackSurface.probableRole || []).join(", ") || "unknown"}
                    </span>
                  </div>

                  <div>
                    <strong>Metadata leaks:</strong><br />
                    <span style={{ color: "#8B95A8" }}>
                      {(webIntel.fingerprint.attackSurface.metadataLeaks || []).join(", ") || "none"}
                    </span>
                  </div>

                  <div>
                    <strong>Exposure profile:</strong><br />
                    <span style={{ color: "#8B95A8" }}>
                      {(webIntel.fingerprint.attackSurface.exposure || []).join(", ") || "unknown"}
                    </span>
                  </div>

                </div>
              </div>
            )}

            {webIntelligenceServices.includes(selectedService.service) && webIntel?.advancedProbe?.title && (
              <div>
                <strong>Page title:</strong><br />
                <span style={{ color: "#8B95A8" }}>
                  {webIntel.advancedProbe.title}
                </span>
              </div>
            )}

            {webIntelligenceServices.includes(selectedService.service) && webIntel?.advancedProbe?.finalUrl && (
              <div>
                <strong>Final URL:</strong><br />
                <span style={{ color: "#8B95A8", wordBreak: "break-all" }}>
                  {webIntel.advancedProbe.finalUrl}
                </span>
              </div>
            )}

            {webIntelligenceServices.includes(selectedService.service) && webIntel?.advancedProbe?.htmlLength && (
              <div>
                <strong>HTML response size:</strong><br />
                <span style={{ color: "#8B95A8" }}>
                  {webIntel.advancedProbe.htmlLength} bytes
                </span>
              </div>
            )}

            {webIntelligenceServices.includes(selectedService.service) && webIntel?.advancedProbe?.fingerprint && (
              <div>
                <strong>Application fingerprint:</strong>

                <div style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginTop: 10
                }}>
                  {Object.entries(webIntel.advancedProbe.fingerprint)
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

            {webIntelligenceServices.includes(selectedService.service) && webIntel?.fingerprint && (
              <div style={{
                padding: 12,
                borderRadius: 10,
                background: "#0F131C",
                border: "1px solid #1E2535"
              }}>
                <strong>Web Technology Intelligence</strong>

                <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                  <div>
                    <strong>Web server:</strong><br />
                    <span style={{ color: "#8B95A8" }}>
                      {webIntel.fingerprint.metadata?.webServer || webIntel.fingerprint.metadata?.serverHeader || "Unknown"}
                    </span>
                  </div>

                  <div>
                    <strong>Framework/CMS:</strong><br />
                    <span style={{ color: "#8B95A8" }}>
                      {(webIntel.fingerprint.technologies || []).filter((item) =>
                        /php|node|express|laravel|wordpress|joomla|drupal|grafana|prometheus/i.test(item)
                      ).join(", ") || "Not detected"}
                    </span>
                  </div>

                  <div>
                    <strong>Reverse proxy/CDN/WAF:</strong><br />
                    <span style={{ color: "#8B95A8" }}>
                      {(webIntel.fingerprint.metadata?.reverseProxyCdnWaf || []).join(", ") || "Not detected"}
                    </span>
                  </div>

                  {webIntel.fingerprint.metadata?.reverseProxy && (
                    <div style={{
                      padding: 10,
                      borderRadius: 10,
                      background: "#101826",
                      border: "1px solid #263149"
                    }}>
                      <strong>Reverse proxy intelligence</strong>
                      <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                        <div>
                          <strong>Family:</strong><br />
                          <span style={{ color: "#8B95A8" }}>
                            {webIntel.fingerprint.metadata.reverseProxy.family || "Not confirmed"}
                          </span>
                        </div>
                        {webIntel.fingerprint.metadata.reverseProxy.version && (
                          <div>
                            <strong>Version:</strong><br />
                            <span style={{ color: "#FBBF24" }}>{webIntel.fingerprint.metadata.reverseProxy.version}</span>
                          </div>
                        )}
                        <div>
                          <strong>Confidence:</strong><br />
                          <span style={{ color: "#00D4AA" }}>{webIntel.fingerprint.metadata.reverseProxy.confidence}</span>
                        </div>
                        <div>
                          <strong>Metadata disclosure:</strong><br />
                          <span style={{ color: webIntel.fingerprint.metadata.reverseProxy.metadataDisclosure ? "#FBBF24" : "#00D4AA" }}>
                            {webIntel.fingerprint.metadata.reverseProxy.metadataDisclosure ? "Server/runtime metadata disclosed" : "No precise proxy metadata confirmed"}
                          </span>
                        </div>
                        <div>
                          <strong>CDN/WAF indicators:</strong><br />
                          <span style={{ color: "#8B95A8" }}>
                            {[
                              ...(webIntel.fingerprint.metadata.reverseProxy.cdn || []),
                              ...(webIntel.fingerprint.metadata.reverseProxy.waf || [])
                            ].join(", ") || "None detected"}
                          </span>
                        </div>
                        <div>
                          <strong>Exposure assessment:</strong><br />
                          <span style={{ color: "#B8C0D0" }}>
                            {webIntel.fingerprint.metadata.reverseProxy.exposureAssessment}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <strong>Security headers posture:</strong><br />
                    <span style={{
                      color: webIntel.fingerprint.metadata?.securityHeaders?.missing?.length ? "#FBBF24" : "#00D4AA"
                    }}>
                      {webIntel.fingerprint.metadata?.securityHeaders?.missing?.length
                        ? `Missing: ${webIntel.fingerprint.metadata.securityHeaders.missing.join(", ")}`
                        : "Baseline headers present"}
                    </span>
                  </div>

                  <div>
                    <strong>Login/admin panel indicators:</strong><br />
                    <span style={{
                      color:
                        webIntel.advancedProbe?.fingerprint?.loginPanel ||
                        webIntel.advancedProbe?.fingerprint?.adminPath ||
                        webIntel.advancedProbe?.adminHints?.length
                          ? "#FBBF24"
                          : "#8B95A8"
                    }}>
                      {[
                        webIntel.advancedProbe?.fingerprint?.loginPanel ? "login wording" : "",
                        webIntel.advancedProbe?.fingerprint?.adminPath ? "admin path response" : "",
                        webIntel.advancedProbe?.fingerprint?.phpmyadmin ? "phpMyAdmin" : "",
                        webIntel.advancedProbe?.adminHints?.length ? `${webIntel.advancedProbe.adminHints.length} admin path hint(s)` : ""
                      ].filter(Boolean).join(", ") || "None detected"}
                    </span>
                  </div>

                  {webIntel.fingerprint.metadata?.adminPanels?.length > 0 && (
                    <div style={{
                      padding: 10,
                      borderRadius: 10,
                      background: "#1A1710",
                      border: "1px solid #FBBF24"
                    }}>
                      <strong>Admin panel intelligence</strong>
                      <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                        {webIntel.fingerprint.metadata.adminPanels.map((panel) => (
                          <div key={panel.platform} style={{
                            padding: 10,
                            borderRadius: 8,
                            background: "#0F131C",
                            border: "1px solid #263149"
                          }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                              <strong>{panel.platform}</strong>
                              <span style={{ color: "#00D4AA", fontWeight: 800 }}>{panel.confidence}</span>
                            </div>
                            <div style={{ color: "#8B95A8", marginTop: 6, fontSize: 12 }}>
                              {(panel.authenticationIndicators || []).join(", ") || "Authentication indicators not visible"}
                            </div>
                            <div style={{ color: "#FDE68A", marginTop: 6, fontSize: 12 }}>
                              {panel.exposureAssessment}
                            </div>
                            <div style={{ marginTop: 8 }}>
                              {(panel.recommendations || []).map((item) => renderPill(item, "warning"))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <strong>Application hints:</strong><br />
                    <span style={{ color: "#8B95A8" }}>
                      {(webIntel.fingerprint.metadata?.applicationHints || []).join(", ") || "None"}
                    </span>
                  </div>

                  <div>
                    <strong>Exposure signals:</strong><br />
                    <span style={{ color: "#8B95A8" }}>
                      {(webIntel.fingerprint.metadata?.exposureSignals || []).join(", ") || "None"}
                    </span>
                  </div>

                  {webIntel.advancedProbe?.redirectChain?.length > 0 && (
                    <div>
                      <strong>Redirect chain:</strong>
                      <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                        {webIntel.advancedProbe.redirectChain.map((redirect, index) => (
                          <div key={`${redirect.from}-${index}`} style={{
                            padding: "8px 10px",
                            borderRadius: 8,
                            background: "#131720",
                            border: "1px solid #263149",
                            color: "#8B95A8",
                            fontSize: 12,
                            wordBreak: "break-all"
                          }}>
                            {redirect.status}: {redirect.from} -&gt; {redirect.to}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <strong>Recommended hardening:</strong>
                    <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                      {[
                        "Terminate HTTPS with trusted certificates and redirect HTTP to HTTPS",
                        "Set CSP, HSTS, X-Frame-Options, X-Content-Type-Options and Referrer-Policy where compatible",
                        "Hide precise framework and runtime versions in production headers",
                        "Protect login and admin paths with SSO, MFA, VPN or IP allowlists"
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


            {["docker", "elasticsearch", "prometheus", "grafana", "lightning", "lnd-grpc"].includes(selectedService.service) &&
              panelResult.serviceProbeData?.[String(selectedService.port)] && (() => {
              const probe = panelResult.serviceProbeData[String(selectedService.port)];
              const rows = [];

              if (probe.docker) {
                rows.push(["Docker API", probe.docker.apiReachable ? "Reachable" : "Not confirmed"]);
                rows.push(["TLS", probe.docker.tlsPresent ? `Detected${probe.docker.tlsProtocol ? ` (${probe.docker.tlsProtocol})` : ""}` : "Not confirmed"]);
                if (probe.docker.version) rows.push(["Version", probe.docker.version]);
                if (probe.docker.apiVersion) rows.push(["API version", probe.docker.apiVersion]);
              }

              if (probe.elasticsearch) {
                rows.push(["Cluster", probe.elasticsearch.clusterName || "Unknown"]);
                rows.push(["Version", probe.elasticsearch.version || "Unknown"]);
                rows.push(["Tagline", probe.elasticsearch.tagline || "Unknown"]);
              }

              if (probe.prometheus) {
                rows.push(["Metrics endpoint", probe.prometheus.metricsReachable ? "Reachable" : "Not confirmed"]);
                rows.push(["UI", probe.prometheus.uiReachable ? "Reachable" : "Not confirmed"]);
                if (probe.prometheus.versionHint) rows.push(["Version hint", probe.prometheus.versionHint]);
              }

              if (probe.grafana) {
                rows.push(["Login page", probe.grafana.loginPage ? "Detected" : "Not confirmed"]);
                rows.push(["Version", probe.grafana.version || "Unknown"]);
              }

              if (probe.lightning) {
                rows.push(["Reachability", probe.success ? "TCP reachable" : "Not confirmed"]);
                rows.push(["Endpoint", probe.lightning.grpcLikely ? "LND gRPC-like" : "Lightning peer port"]);
                if (probe.lightning.grpcLikely) {
                  rows.push(["TLS", probe.lightning.tlsReachable ? `Reachable${probe.lightning.tlsProtocol ? ` (${probe.lightning.tlsProtocol})` : ""}` : "Not confirmed"]);
                }
                rows.push(["Operational note", probe.lightning.operationalNote || "Confirm intended exposure"]);
              }

              return (
                <div style={{
                  padding: 12,
                  borderRadius: 10,
                  background: "#0F131C",
                  border: `1px solid ${probe.docker?.apiReachable ? "#FF4D6A" : "#1E2535"}`
                }}>
                  <strong>{probe.docker ? "Docker exposure intelligence" : "High-value service intelligence"}</strong>
                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    {rows.map(([label, value]) => (
                      <div key={label}>
                        <strong>{label}:</strong><br />
                        <span style={{ color: "#8B95A8" }}>{value}</span>
                      </div>
                    ))}
                    {probe.docker && (
                      <>
                        <div>
                          <strong>Remote administration risk:</strong><br />
                          <span style={{ color: "#FF4D6A" }}>
                            Docker API reachability allows remote container and host-level administration when authorized or unauthenticated access is possible.
                          </span>
                        </div>
                        <div>
                          <strong>Recommended hardening:</strong>
                          <div style={{ marginTop: 8 }}>
                            {[
                              "Do not expose Docker API directly to public networks",
                              "Bind dockerd to localhost or a private management interface",
                              "Require mutual TLS for any remote Docker administration",
                              "Place access behind VPN, bastion or private control plane"
                            ].map((item) => renderPill(item, "critical"))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}



            {panelResult.serviceProbeData?.[String(selectedService.port)] && !["ssh", "ftp", "http", "https", "http-alt", "https-alt", "grafana", "docker", "elasticsearch", "prometheus", "lightning", "lnd-grpc"].includes(selectedService.service) && (
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
                      <button
                        onClick={() => toggleRawSection(`probe-${selectedService.port}`)}
                        style={{
                          padding: "7px 10px",
                          borderRadius: 8,
                          border: "1px solid #263149",
                          background: "#131720",
                          color: "#B8C0D0",
                          cursor: "pointer",
                          fontWeight: 800
                        }}
                      >
                        {expandedRawSections[`probe-${selectedService.port}`] ? "Hide" : "Show"} banner / response
                      </button>
                      {expandedRawSections[`probe-${selectedService.port}`] && (
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
                      )}
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
                      <strong>Mail role summary:</strong><br />
                      <span style={{ color: "#8B95A8" }}>
                        {describeMailRole(selectedService.service)}
                      </span>
                    </div>

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
                      <strong>TLS posture:</strong><br />
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
                        <strong>Authentication posture:</strong><br />
                        <span style={{ color: "#8B95A8" }}>
                          {Array.isArray(mail.auth) ? mail.auth.join(", ") : mail.auth}
                        </span>
                      </div>
                    )}

                    {!mail.auth?.length && (
                      <div>
                        <strong>Authentication posture:</strong><br />
                        <span style={{ color: "#FBBF24" }}>
                          Not advertised or not visible from banner
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



            {["mysql","postgresql","redis","mongodb","mssql","oracle","elasticsearch"].includes(selectedService.service) &&
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

                    {db.authPlugin && (
                      <div>
                        <strong>Auth plugin:</strong><br />
                        <span style={{ color: "#8B95A8" }}>{db.authPlugin}</span>
                      </div>
                    )}

                    {db.handshakeExposed !== undefined && (
                      <div>
                        <strong>Handshake exposed:</strong><br />
                        <span style={{ color: db.handshakeExposed ? "#FBBF24" : "#00D4AA" }}>
                          {db.handshakeExposed ? "Yes" : "No"}
                        </span>
                      </div>
                    )}

                    <div>
                      <strong>Authentication visibility:</strong><br />
                      <span style={{ color: db.authentication === "Required" ? "#00D4AA" : db.authentication.includes("PING") ? "#FF4D6A" : "#FBBF24" }}>
                        {db.authentication}
                      </span>
                    </div>

                    <div>
                      <strong>Exposure summary:</strong><br />
                      <span style={{ color: "#F97316" }}>
                        {db.exposure}
                      </span>
                    </div>

                    <div>
                      <strong>Risk signal:</strong><br />
                      <span style={{ color: (selectedService.service === "redis" && db.authentication !== "Required") || db.authentication.includes("PING") ? "#FF4D6A" : "#FBBF24" }}>
                        {db.riskHint}
                      </span>
                    </div>

                    <div>
                      <strong>Operational assessment:</strong><br />
                      <span style={{ color: "#B8C0D0" }}>
                        {db.family} is reachable on the scanned target. Public database reachability should be considered intentional only when protected by network controls, authentication and monitored access paths.
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
                    <strong>Banner information:</strong><br />
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
                    <strong>Authentication posture:</strong><br />
                    <span style={{ color: "#8B95A8" }}>
                      Authentication methods are not fully visible from banner data. Confirm key-based auth, disabled password login and MFA or bastion controls where applicable.
                    </span>
                  </div>

                  <div>
                    <strong>Banner disclosure:</strong><br />
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

            {webIntelligenceServices.includes(selectedService.service) && webIntel?.headers && (
              <div>
                <button
                  onClick={() => toggleRawSection(`headers-${selectedService.port}`)}
                  style={{
                    padding: "7px 10px",
                    borderRadius: 8,
                    border: "1px solid #263149",
                    background: "#131720",
                    color: "#B8C0D0",
                    cursor: "pointer",
                    fontWeight: 800
                  }}
                >
                  {expandedRawSections[`headers-${selectedService.port}`] ? "Hide" : "Show"} raw HTTP headers
                </button>

                {expandedRawSections[`headers-${selectedService.port}`] && (
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
{JSON.stringify(webIntel.headers, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {getServiceRisk(selectedService)?.signals?.length > 0 && (
              <div>
                <strong>Exposure signals:</strong>
                <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                  {getServiceRisk(selectedService).signals.map((signal, index) => (
                    <div key={index} style={{
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: "#131720",
                      border: "1px solid #263149",
                      color: "#B8C0D0",
                      fontSize: 12
                    }}>
                      {signal}
                    </div>
                  ))}
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

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(buildOperationalRunbook(result));
              setCopiedRunbook(true);
              setTimeout(() => setCopiedRunbook(false), 1600);
            }}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #38BDF855",
              background: "#0F131C",
              color: "#38BDF8",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            📋 {copiedRunbook ? actionLabels.copiedRunbook : actionLabels.copyRunbook}
          </button>
          <button
            onClick={() => exportRunbook(result)}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #00D4AA55",
              background: "#0F131C",
              color: "#00D4AA",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ⬇ {actionLabels.exportRunbook}
          </button>
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
      </div>

      {result.exposureRisk && (
        <div style={{
          ...box,
          border: "1px solid #00D4AA",
          background: "linear-gradient(180deg, #101826 0%, #0B0E14 100%)"
        }}>
          <div style={{ color: "#8B95A8", fontSize: 12, fontWeight: 800 }}>
            UNIVERSAL EXPOSURE SCORE
          </div>

          <div style={{
            marginTop: 8,
            fontSize: 34,
            fontWeight: 900,
            color:
              result.exposureRisk.score < 30 ? "#FF4D6A" :
              result.exposureRisk.score < 55 ? "#F97316" :
              result.exposureRisk.score < 75 ? "#FBBF24" :
              "#00D4AA"
          }}>
            {result.exposureRisk.score}/100
          </div>

          <div style={{
            color: severityColor[result.exposureRisk.level] || "#8B95A8",
            fontWeight: 900
          }}>
            {result.exposureRisk.level}
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 10,
            marginTop: 14
          }}>
            {[
              ["Service risk score", result.exposureRisk.serviceScore],
              ["Infrastructure risk score", result.exposureRisk.infrastructureScore]
            ].map(([label, value]) => (
              <div key={label} style={{
                padding: 10,
                borderRadius: 10,
                background: "#0F131C",
                border: "1px solid #1E2535"
              }}>
                <div style={{ color: "#8B95A8", fontSize: 11, fontWeight: 800 }}>{label}</div>
                <div style={{ color: "#E8ECF4", fontSize: 18, fontWeight: 900 }}>{value ?? "N/A"}</div>
              </div>
            ))}
          </div>

          {result.exposureRisk.explanationSignals?.length > 0 && (
            <div style={{ marginTop: 12, color: "#8B95A8", fontSize: 12 }}>
              {result.exposureRisk.explanationSignals.join(" · ")}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ ...box, minWidth: 160, marginBottom: 0 }}>
          <div style={{ color: "#8B95A8", fontSize: 11, fontWeight: 700 }}>RISK</div>
          <div style={{
            color: severityColor[result.exposureRisk?.level || highestSeverity],
            fontSize: 18,
            fontWeight: 800
          }}>
            {result.exposureRisk?.level || highestSeverity}
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

      {serviceMatrix.length > 0 && (
        <div style={box}>
          <div style={{ color: "#8B95A8", fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
            Attack Surface Summary
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 10
          }}>
            {[
              ["Web services", attackSurfaceSummary.webServices],
              ["Mail services", attackSurfaceSummary.mailServices],
              ["Remote access", attackSurfaceSummary.remoteAccessServices],
              ["Databases", attackSurfaceSummary.databaseServices],
              ["Admin panels", attackSurfaceSummary.detectedAdminPanels],
              ["Exposure class", attackSurfaceSummary.exposureClass]
            ].map(([label, value]) => (
              <div key={label} style={{
                padding: 12,
                borderRadius: 10,
                background: "#0F131C",
                border: "1px solid #1E2535"
              }}>
                <div style={{ color: "#8B95A8", fontSize: 11, fontWeight: 800 }}>{label}</div>
                <div style={{
                  color: label === "Exposure class" ? severityColor[value] || "#E8ECF4" : "#E8ECF4",
                  fontSize: 18,
                  fontWeight: 900,
                  marginTop: 4
                }}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {openPorts.length > 0 && serviceMatrix.length === 0 && (
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

          <div style={{ marginBottom: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => onAnalyzeRedirectedHost?.(result.redirectedHostData.host)}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #00D4AA",
                background: "#00D4AA",
                color: "#081018",
                fontWeight: 900,
                cursor: "pointer"
              }}
            >
              🔍 Analyze redirected host
            </button>

            <button
              onClick={() => {
                navigator.clipboard.writeText(result.redirectedHostData.host);
                alert("Redirected host copied.");
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

          {result.redirectedHostData.serviceMatrix?.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div style={{
                color: "#38BDF8",
                fontSize: 12,
                fontWeight: 800,
                marginBottom: 8
              }}>
                Redirect target exposure
              </div>

              <div style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8
              }}>
                {result.redirectedHostData.serviceMatrix.map((item) => (
                  <div
                    key={`redirect-port-${item.port}`}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 999,
                      background: "#0F131C",
                      border: "1px solid #1E2535",
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#B8C0D0"
                    }}
                  >
                    {item.port}/{item.service}
                  </div>
                ))}
              </div>

              <div style={{
                marginTop: 12,
                color: "#8B95A8",
                fontSize: 12
              }}>
                The redirected host exposes a different service profile.
                Run a dedicated scan against the redirected hostname for full intelligence.
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
                    color:
                      getServiceRisk(item)?.score < 30 ? "#FF4D6A" :
                      getServiceRisk(item)?.score < 55 ? "#F97316" :
                      getServiceRisk(item)?.score < 75 ? "#FBBF24" :
                      "#00D4AA",
                    fontWeight: 800
                  }}>
                    {getServiceRisk(item) ? `${getServiceRisk(item).score}/100` : item.severity}
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
