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
              <div
                key={`${item.port}-${item.service}`}
                onClick={() => setSelectedService(item)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "80px 1fr 120px 1.5fr",
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
            ))}
          </div>
        </div>
      )}


      {selectedService && (
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

            {result.httpData?.fingerprint?.technologies?.length > 0 && (
              <div>
                <strong>Detected technologies:</strong><br />
                <span style={{ color: "#8B95A8" }}>
                  {result.httpData.fingerprint.technologies.join(", ")}
                </span>
              </div>
            )}

            {Object.keys(result.httpData?.fingerprint?.versions || {}).length > 0 && (
              <div>
                <strong>Detected versions:</strong>

                <div style={{
                  display: "grid",
                  gap: 6,
                  marginTop: 8
                }}>
                  {Object.entries(result.httpData.fingerprint.versions).map(([name, version]) => (
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

            {result.httpData?.fingerprint?.metadata?.serverHeader && (
              <div>
                <strong>Server header:</strong><br />
                <span style={{ color: "#8B95A8" }}>
                  {result.httpData.fingerprint.metadata.serverHeader}
                </span>
              </div>
            )}


            {result.httpData?.fingerprint?.attackSurface && (
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
                      {result.httpData.fingerprint.attackSurface.confidence}
                    </span>
                  </div>

                  <div>
                    <strong>Probable role:</strong><br />
                    <span style={{ color: "#8B95A8" }}>
                      {(result.httpData.fingerprint.attackSurface.probableRole || []).join(", ") || "unknown"}
                    </span>
                  </div>

                  <div>
                    <strong>Metadata leaks:</strong><br />
                    <span style={{ color: "#8B95A8" }}>
                      {(result.httpData.fingerprint.attackSurface.metadataLeaks || []).join(", ") || "none"}
                    </span>
                  </div>

                  <div>
                    <strong>Exposure profile:</strong><br />
                    <span style={{ color: "#8B95A8" }}>
                      {(result.httpData.fingerprint.attackSurface.exposure || []).join(", ") || "unknown"}
                    </span>
                  </div>

                </div>
              </div>
            )}

            {result.httpData?.advancedProbe?.title && (
              <div>
                <strong>Page title:</strong><br />
                <span style={{ color: "#8B95A8" }}>
                  {result.httpData.advancedProbe.title}
                </span>
              </div>
            )}

            {result.httpData?.advancedProbe?.finalUrl && (
              <div>
                <strong>Final URL:</strong><br />
                <span style={{ color: "#8B95A8", wordBreak: "break-all" }}>
                  {result.httpData.advancedProbe.finalUrl}
                </span>
              </div>
            )}

            {result.httpData?.advancedProbe?.htmlLength && (
              <div>
                <strong>HTML response size:</strong><br />
                <span style={{ color: "#8B95A8" }}>
                  {result.httpData.advancedProbe.htmlLength} bytes
                </span>
              </div>
            )}

            {result.httpData?.advancedProbe?.fingerprint && (
              <div>
                <strong>Application fingerprint:</strong>

                <div style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginTop: 10
                }}>
                  {Object.entries(result.httpData.advancedProbe.fingerprint)
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

            {selectedService.service === "ssh" && result.sshData?.success && (
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
                      {result.sshData.banner}
                    </span>
                  </div>

                  {result.sshData.software && (
                    <div>
                      <strong>Software:</strong><br />
                      <span style={{ color: "#8B95A8" }}>
                        {result.sshData.software}
                      </span>
                    </div>
                  )}

                  <div>
                    <strong>Metadata leak:</strong><br />
                    <span style={{ color: result.sshData.metadataLeak ? "#FBBF24" : "#00D4AA" }}>
                      {result.sshData.metadataLeak ? "SSH software/version is disclosed" : "No SSH banner metadata detected"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {selectedService.service === "ssh" && result.sshAuditData?.parsed && (
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
                    { label: "Score", value: `${result.sshAuditData.parsed.score}/100` },
                    { label: "Failures", value: result.sshAuditData.parsed.failures.length },
                    { label: "Warnings", value: result.sshAuditData.parsed.warnings.length },
                    { label: "Recommendations", value: result.sshAuditData.parsed.recommendations.length }
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
                      {result.sshAuditData.parsed.kex.slice(0, 5).join(" | ") || "none detected"}
                    </span>
                  </div>

                  <div>
                    <strong>Ciphers:</strong><br />
                    <span style={{ color: "#8B95A8" }}>
                      {result.sshAuditData.parsed.ciphers.slice(0, 5).join(" | ") || "none detected"}
                    </span>
                  </div>

                  <div>
                    <strong>MAC algorithms:</strong><br />
                    <span style={{ color: "#8B95A8" }}>
                      {result.sshAuditData.parsed.macs.slice(0, 5).join(" | ") || "none detected"}
                    </span>
                  </div>

                  {result.sshAuditData.parsed.failures.length > 0 && (
                    <div>
                      <strong style={{ color: "#FF4D6A" }}>Failures:</strong>
                      <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                        {result.sshAuditData.parsed.failures.slice(0, 6).map((item, index) => (
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

                  {result.sshAuditData.parsed.recommendations.length > 0 && (
                    <div>
                      <strong style={{ color: "#FBBF24" }}>Recommended removals:</strong>
                      <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                        {result.sshAuditData.parsed.recommendations.slice(0, 8).map((item, index) => (
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

                  {result.sshAuditData.parsed.fingerprints.length > 0 && (
                    <div>
                      <strong>Host key fingerprints:</strong>
                      <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                        {result.sshAuditData.parsed.fingerprints.map((item, index) => (
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

            {result.httpData?.headers && (
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
{JSON.stringify(result.httpData.headers, null, 2)}
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
