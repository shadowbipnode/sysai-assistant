import { useEffect, useState } from "react";


import {
  loadOperationalContext,
  saveOperationalContext,
  resetOperationalContext,
  saveOperationalBaseline,
  detectOperationalDrift,
} from "../utils/operationalContextStore";

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #1E2535",
  background: "#131720",
  color: "#E8ECF4",
  marginTop: 6,
  marginBottom: 14,
};

export default function OperationalContextPanel() {
  const [context, setContext] = useState(loadOperationalContext());
  const drift = detectOperationalDrift(context);

  useEffect(() => {
    saveOperationalContext(context);
  }, [context]);

  return (
    <div
      style={{
        background: "#0F141C",
        border: "1px solid #1E2535",
        borderRadius: 16,
        padding: 20,
        marginTop: 24,
      }}
    >
      <h2 style={{ marginTop: 0 }}>Operational Context</h2>

      <p style={{ color: "#8B95A8", lineHeight: 1.6 }}>
        SysAI stores a minimal local operational context to improve workflow continuity.
        No cloud sync. No telemetry. Fully local.
      </p>

      <div style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 11px",
        borderRadius: 999,
        background: "#00D4AA18",
        border: "1px solid #00D4AA33",
        color: "#00D4AA",
        fontSize: 12,
        fontWeight: 700,
        marginBottom: 18,
      }}>
        ✓ Auto-saved locally
      </div>

      <label>Environment Name</label>
      <input
        style={inputStyle}
        value={context.profile.name}
        onChange={(e) =>
          setContext({
            ...context,
            profile: {
              ...context.profile,
              name: e.target.value,
            },
          })
        }
      />

      <label>Operating System</label>
      <input
        style={inputStyle}
        value={context.profile.os}
        onChange={(e) =>
          setContext({
            ...context,
            profile: {
              ...context.profile,
              os: e.target.value,
            },
          })
        }
      />

      <label>Primary Use</label>
      <input
        style={inputStyle}
        placeholder="homelab, VPS, Bitcoin node..."
        value={context.profile.primary_use}
        onChange={(e) =>
          setContext({
            ...context,
            profile: {
              ...context.profile,
              primary_use: e.target.value,
            },
          })
        }
      />

<label>Operational Notes</label>
      <textarea
        style={{
          ...inputStyle,
          minHeight: 120,
          resize: "vertical",
        }}
        value={context.notes}
        onChange={(e) =>
          setContext({
            ...context,
            notes: e.target.value,
          })
        }
      />

      {context.memory && (
        <div style={{ marginTop: 22, marginBottom: 18 }}>
          <h3 style={{ fontSize: 16, marginBottom: 12 }}>
            Operational Memory
          </h3>

          {Object.entries(context.memory).map(([key, values]) => {
            if (!Array.isArray(values) || values.length === 0) return null;

            return (
              <div key={key} style={{ marginBottom: 14 }}>
                <div
                  style={{
                    color: "#8B95A8",
                    fontSize: 12,
                    fontWeight: 700,
                    marginBottom: 6,
                    textTransform: "uppercase",
                  }}
                >
                  {key.replaceAll("_", " ")}
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {values.map((value, index) => (
                    <span
                      key={`${key}-${index}`}
                      style={{
                        display: "inline-block",
                        padding: "5px 9px",
                        borderRadius: 999,
                        background: "#1A1F2E",
                        border: "1px solid #1E2535",
                        color: "#B8C0D0",
                        fontSize: 12,
                      }}
                    >
                      {value}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
            <div style={{ marginTop: 22, marginBottom: 18 }}>
        <h3 style={{ fontSize: 16, marginBottom: 12 }}>Baseline & Drift</h3>

        <p style={{ color: "#8B95A8", fontSize: 13, lineHeight: 1.6 }}>
          Save the current operational memory as a known-good baseline, then SysAI can highlight future changes.
        </p>

        <button
          onClick={() => setContext(saveOperationalBaseline())}
          style={{
            padding: "9px 14px",
            borderRadius: 10,
            border: "1px solid #00D4AA33",
            background: "#00D4AA18",
            color: "#00D4AA",
            cursor: "pointer",
            fontWeight: 700,
            marginBottom: 12,
          }}
        >
          Save Current Memory as Baseline
        </button>

        {context.baseline?.updated_at && (
          <div style={{ color: "#8B95A8", fontSize: 12, marginBottom: 12 }}>
            Baseline saved: {new Date(context.baseline.updated_at).toLocaleString()}
          </div>
        )}

        <div style={{
          padding: 12,
          borderRadius: 12,
          border: `1px solid ${drift.drift_detected ? "#FBBF24" : "#00D4AA"}33`,
          background: drift.drift_detected ? "#FBBF2414" : "#00D4AA14",
          color: drift.drift_detected ? "#FBBF24" : "#00D4AA",
          fontSize: 13,
          fontWeight: 700,
        }}>
          {drift.baseline_exists
            ? drift.drift_detected
              ? "Drift detected against saved baseline"
              : "No drift detected against saved baseline"
            : "No baseline saved yet"}
        </div>

        {drift.changes.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {drift.changes.map((change) => (
              <div key={change.field} style={{ marginBottom: 12 }}>
                <div style={{
                  color: "#8B95A8",
                  fontSize: 12,
                  fontWeight: 700,
                  marginBottom: 6,
                  textTransform: "uppercase",
                }}>
                  {change.field.replaceAll("_", " ")}
                </div>

                {change.added.length > 0 && (
                  <div style={{ color: "#00D4AA", fontSize: 12, marginBottom: 4 }}>
                    Added: {change.added.join(", ")}
                  </div>
                )}

                {change.missing.length > 0 && (
                  <div style={{ color: "#FF4D6A", fontSize: 12 }}>
                    Missing: {change.missing.join(", ")}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
        <button
          onClick={() => {
            resetOperationalContext();
            setContext(loadOperationalContext());
          }}
          style={{
            padding: "10px 16px",
            borderRadius: 10,
            border: "none",
            background: "#FF4D6A",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Reset Context
        </button>
      </div>
    </div>
  );
}
