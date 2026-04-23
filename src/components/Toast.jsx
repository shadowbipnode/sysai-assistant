import { useEffect } from "react";

const Toast = ({ message, type = "success", onClose, duration = 3000 }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const colors = {
    success: { bg: "#10A37F", text: "#FFFFFF", icon: "✓" },
    error: { bg: "#FF4D6A", text: "#FFFFFF", icon: "✗" },
    warning: { bg: "#FFAA2C", text: "#1A1D24", icon: "⚠" },
    info: { bg: "#00D4AA", text: "#0B0E14", icon: "ℹ" },
  };

  const style = colors[type] || colors.info;

  return (
    <div style={{
      position: "fixed",
      bottom: 24,
      right: 24,
      zIndex: 1000,
      animation: "slideInRight 0.3s ease, fadeOut 0.3s ease 2.7s",
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "12px 20px",
      background: style.bg,
      color: style.text,
      borderRadius: 12,
      boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
      fontFamily: "'Outfit', sans-serif",
      fontSize: 14,
      fontWeight: 500,
      cursor: "pointer",
    }} onClick={onClose}>
      <span style={{ fontSize: 18 }}>{style.icon}</span>
      <span>{message}</span>
      <button style={{
        background: "none",
        border: "none",
        color: style.text,
        cursor: "pointer",
        fontSize: 16,
        marginLeft: 8,
        opacity: 0.7,
      }}>×</button>
    </div>
  );
};

export default Toast;
