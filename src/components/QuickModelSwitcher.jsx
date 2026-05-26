const QuickModelSwitcher = ({
  open,
  onClose,
  providers,
  defaultProvider,
  selectedModels,
  availableModels,
  loadingModels,
  onSetDefaultProvider,
  onSetSelectedModel,
  onOpenSettings,
}) => {
  if (!open) return null;

  const currentProvider = providers.find((p) => p.id === defaultProvider);

  return (
    <div
      onMouseDown={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "rgba(0,0,0,0.35)",
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          top: 72,
          right: 22,
          width: 420,
          background: "#0F141C",
          border: "1px solid #1E2535",
          borderRadius: 16,
          padding: 16,
          boxShadow: "0 24px 80px rgba(0,0,0,.45)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#E8ECF4" }}>
              Quick Model Switcher
            </div>
            <div style={{ fontSize: 12, color: "#8B95A8", marginTop: 4 }}>
              Change model without leaving the current workflow.
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "1px solid #1E2535",
              color: "#8B95A8",
              borderRadius: 8,
              cursor: "pointer",
              padding: "4px 8px",
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ marginTop: 18 }}>
          <label style={{ fontSize: 12, color: "#8B95A8", fontWeight: 700 }}>
            Provider
          </label>
          <select
            value={defaultProvider}
            onChange={(e) => onSetDefaultProvider(e.target.value)}
            style={{
              width: "100%",
              marginTop: 6,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #1E2535",
              background: "#131720",
              color: "#E8ECF4",
            }}
          >
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginTop: 14 }}>
          <label style={{ fontSize: 12, color: "#8B95A8", fontWeight: 700 }}>
            Model
          </label>
          <select
            value={
              selectedModels[defaultProvider] ||
              availableModels[defaultProvider]?.[0]?.id ||
              ""
            }
            onChange={(e) => onSetSelectedModel(defaultProvider, e.target.value)}
            disabled={loadingModels[defaultProvider]}
            style={{
              width: "100%",
              marginTop: 6,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #1E2535",
              background: "#131720",
              color: "#E8ECF4",
            }}
          >
            {Array.from(
              new Map((availableModels[defaultProvider] || []).map((model) => [model.id, model])).values()
            ).map((model) => (
              <option key={model.id} value={model.id}>
                {model.name || model.id}
              </option>
            ))}
          </select>

          {loadingModels[defaultProvider] && (
            <div style={{ fontSize: 11, color: "#8B95A8", marginTop: 8 }}>
              Loading models...
            </div>
          )}

          {!loadingModels[defaultProvider] &&
            (!availableModels[defaultProvider] ||
              availableModels[defaultProvider].length === 0) && (
              <div style={{ fontSize: 11, color: "#FFB020", marginTop: 8 }}>
                No models loaded. Check API key or open Settings.
              </div>
            )}
        </div>

        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 12,
            background: "#131720",
            border: "1px solid #1E2535",
            fontSize: 12,
            color: "#8B95A8",
            lineHeight: 1.5,
          }}
        >
          Current provider: <strong style={{ color: "#00D4AA" }}>{currentProvider?.name || defaultProvider}</strong>
          <br />
          Selected model:{" "}
          <strong style={{ color: "#E8ECF4" }}>
            {selectedModels[defaultProvider] ||
              availableModels[defaultProvider]?.[0]?.id ||
              "none"}
          </strong>
        </div>

        <button
          onClick={onOpenSettings}
          style={{
            width: "100%",
            marginTop: 14,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #1E2535",
            background: "transparent",
            color: "#8B95A8",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          Advanced provider settings
        </button>
      </div>
    </div>
  );
};

export default QuickModelSwitcher;
