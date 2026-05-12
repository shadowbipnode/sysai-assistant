import { useEffect, useState } from "react";

import {
  loadOperationalContext,
  saveOperationalContext,
  resetOperationalContext,
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
