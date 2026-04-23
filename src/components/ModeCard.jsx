const ModeCard = ({ mode, isFree, accent, accentDim, surface, border, text2, onClick }) => {
  return (
    <div onClick={onClick}
      style={{
        background: surface,
        border: `1px solid ${border}`,
        borderRadius: 16,
        padding: 20,
        cursor: "pointer",
        position: "relative",
        transition: "all 0.2s ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = accent; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = border; }}
    >
      {!isFree && (
        <div style={{
          position: "absolute", top: 12, right: 12,
          padding: "3px 8px", borderRadius: 5, fontSize: 10, fontWeight: 700,
          background: `${accent}22`, color: accent,
        }}>PRO</div>
      )}
      <div style={{
        fontSize: 32, marginBottom: 12, width: 52, height: 52, borderRadius: 12,
        background: accentDim, display: "flex", alignItems: "center", justifyContent: "center",
      }}>{mode.icon}</div>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{mode.name}</h3>
      <p style={{ fontSize: 13, color: text2 }}>{mode.desc}</p>
    </div>
  );
};

export default ModeCard;
