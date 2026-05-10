import { useEffect, useMemo, useState } from "react";

const CommandPalette = ({ open, onClose, onNavigate }) => {
  const [query, setQuery] = useState("");

  const commands = useMemo(() => [
    { id: "home", label: "Home", description: "Return to main workspace", icon: "🏠" },
    { id: "logAnalyzer", label: "Log Analyzer", description: "Analyze logs and failures", icon: "📋" },
    { id: "commandCrafter", label: "Command Crafter", description: "Generate safe Linux commands", icon: "⌨️" },
    { id: "explainMode", label: "Explain Mode", description: "Explain commands and scripts", icon: "🔍" },
    { id: "configGenerator", label: "Config Generator", description: "Generate infrastructure configs", icon: "⚙️" },
    { id: "troubleshooter", label: "Troubleshooter", description: "Guided operational diagnostics", icon: "🔧" },
    { id: "scriptBuilder", label: "Script Builder", description: "Generate scripts with safeguards", icon: "📜" },
    { id: "securityAuditor", label: "Security Auditor", description: "Audit configs and remote exposure", icon: "🛡️" },
    { id: "history", label: "History", description: "Review previous outputs", icon: "🕘" },
    { id: "settings", label: "Settings", description: "Providers, models and preferences", icon: "⚙️" },
  ], []);

  const filtered = commands.filter((cmd) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${cmd.label} ${cmd.description}`.toLowerCase().includes(q);
  });

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }

      if (event.key === "Enter" && filtered[0]) {
        event.preventDefault();
        onNavigate(filtered[0].id);
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, filtered, onClose, onNavigate]);

  if (!open) return null;

  return (
    <div
      onMouseDown={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(8px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "12vh",
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "min(720px, calc(100vw - 32px))",
          background: "#0F131C",
          border: "1px solid #1E2535",
          borderRadius: 18,
          boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: 16, borderBottom: "1px solid #1E2535" }}>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands, tools, settings..."
            style={{
              width: "100%",
              background: "#131720",
              border: "1px solid #1E2535",
              borderRadius: 12,
              color: "#E8ECF4",
              padding: "14px 16px",
              fontSize: 15,
              outline: "none",
            }}
          />
          <div style={{ marginTop: 8, color: "#8B95A8", fontSize: 11 }}>
            Press Enter to open first result · Esc to close
          </div>
        </div>

        <div style={{ maxHeight: 420, overflowY: "auto", padding: 8 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 18, color: "#8B95A8", fontSize: 13 }}>
              No matching command found.
            </div>
          ) : filtered.map((cmd, index) => (
            <button
              key={cmd.id}
              onClick={() => {
                onNavigate(cmd.id);
                onClose();
              }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                background: index === 0 ? "#1A1F2E" : "transparent",
                border: "1px solid transparent",
                borderRadius: 12,
                color: "#E8ECF4",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span style={{ fontSize: 20, width: 28 }}>{cmd.icon}</span>
              <span style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{cmd.label}</div>
                <div style={{ fontSize: 12, color: "#8B95A8", marginTop: 2 }}>{cmd.description}</div>
              </span>
              {index === 0 && (
                <span style={{
                  fontSize: 10,
                  color: "#00D4AA",
                  border: "1px solid #00D4AA44",
                  borderRadius: 6,
                  padding: "3px 6px",
                }}>
                  ENTER
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
