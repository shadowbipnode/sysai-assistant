const ModeCard = ({ mode, isFree, accent, accentDim, surface, border, text1, text2, onClick }) => {
  return (
    <div
      className="sysai-mode-card"
      onClick={onClick}
      style={{
        background: `linear-gradient(145deg, ${surface}, rgba(255,255,255,0.018))`,
        border: `1px solid ${border}`,
        borderRadius: 22,
        padding: 22,
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
        minHeight: 176,
        transition: "transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease, background 180ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-3px)";
        e.currentTarget.style.borderColor = `${accent}70`;
        e.currentTarget.style.boxShadow = `0 24px 70px rgba(0,0,0,.28), 0 0 0 1px ${accent}10`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.borderColor = border;
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div style={{
        position: "absolute", inset: "-55% -35% auto auto", width: 180, height: 180,
        background: `radial-gradient(circle, ${accent}18 0%, transparent 62%)`,
        pointerEvents: "none",
      }} />
      {!isFree && (
        <div style={{
          position: "absolute", top: 14, right: 14,
          padding: "4px 9px", borderRadius: 999, fontSize: 10, fontWeight: 850,
          background: `${accent}1F`, color: accent, border: `1px solid ${accent}2F`,
          letterSpacing: "0.08em",
        }}>PRO</div>
      )}
      <div style={{
        fontSize: 30, marginBottom: 18, width: 58, height: 58, borderRadius: 17,
        background: `linear-gradient(135deg, ${accentDim}, rgba(255,255,255,0.035))`,
        border: `1px solid ${accent}20`,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: `inset 0 1px 0 rgba(255,255,255,.05)`,
      }}>{mode.icon}</div>
      <h3 style={{
        fontSize: 17, fontWeight: 800, margin: "0 0 8px", color: text1 || "inherit",
        letterSpacing: "-0.02em",
      }}>{mode.name}</h3>
      <p style={{ fontSize: 13, color: text2, lineHeight: 1.55, margin: 0 }}>{mode.desc}</p>
      <div style={{
        marginTop: 18, display: "inline-flex", alignItems: "center", gap: 6,
        color: accent, fontSize: 12, fontWeight: 800, opacity: .9,
      }}>
        Open tool <span style={{ transform: "translateY(-1px)" }}>→</span>
      </div>
    </div>
  );
};

export default ModeCard;
