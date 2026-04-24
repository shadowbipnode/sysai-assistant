import { useState, useEffect } from "react";
import { AI_PROVIDERS } from "../utils/aiProviders";
import { fetchModels } from "../utils/aiProviders";
import LicenseSettings from './LicenseSettings';

const Settings = ({ t, lang, theme, accent, accentDim, surface, surface2, border, bg, text1, text2, danger, apiKeys, selectedModels, availableModels, loadingModels, defaultProvider, systemProfile, saved, onSetLang, onSetTheme, onSetApiKey, onSetSelectedModel, onSetDefaultProvider, onSetSystemProfile, onSave, onBack, license }) => {
    // Funzione per ottenere modelli Ollama (locale)
  const fetchOllamaModels = async (baseURL = "http://localhost:11434") => {
    try {
      const response = await fetch(`${baseURL}/api/tags`);
      const data = await response.json();
      return (data.models || []).map(m => ({ id: m.name, name: m.name }));
    } catch (error) {
      console.error("Ollama error:", error);
      return [];
    }
  };
  const [ollamaModels, setOllamaModels] = useState([]);
  const [loadingOllama, setLoadingOllama] = useState(false);
  const [localLoadingModels, setLocalLoadingModels] = useState({});



  // Carica modelli Ollama all'avvio
  useEffect(() => {
    const loadOllama = async () => {
      setLoadingOllama(true);
      try {
        const models = await fetchOllamaModels();
        setOllamaModels(models);
        if (models.length > 0 && !selectedModels.ollama) {
          onSetSelectedModel("ollama", models[0].id);
        }
      } catch (error) {
        console.error("Errore caricamento Ollama:", error);
      } finally {
        setLoadingOllama(false);
      }
    };
    loadOllama();
  }, []);

  // Funzione per caricare modelli quando cambia API key
  const loadModelsForProvider = async (providerId, apiKey) => {
    if (!providerId) return;
    const provider = AI_PROVIDERS.find(p => p.id === providerId);
    if (provider?.requiresApiKey && !apiKey) return;
    
    setLocalLoadingModels(prev => ({ ...prev, [providerId]: true }));
    try {
      const models = await fetchModels(providerId, apiKey);
      if (models.length > 0) {
        // Aggiorna availableModels (passato dal parent)
        onSetSelectedModel(providerId, models[0].id);
      }
    } catch (error) {
      console.error(`Errore fetch modelli per ${providerId}:`, error);
    } finally {
      setLocalLoadingModels(prev => ({ ...prev, [providerId]: false }));
    }
  };

  // Quando cambia apiKeys, carica modelli
  useEffect(() => {
    for (const provider of AI_PROVIDERS) {
      const apiKey = apiKeys[provider.id];
      if (provider.requiresApiKey && apiKey && apiKey.trim() !== "") {
        loadModelsForProvider(provider.id, apiKey);
      }
    }
  }, [apiKeys]);

  const getModelsForProvider = (providerId) => {
    if (providerId === "ollama") return ollamaModels;
    return availableModels[providerId] || [];
  };

  const isLoadingForProvider = (providerId) => {
    if (providerId === "ollama") return loadingOllama;
    return localLoadingModels[providerId] || loadingModels[providerId];
  };

  return (
    <div>
      <button onClick={onBack} style={{
        background: "none", border: "none", color: text2, cursor: "pointer",
        fontSize: 13, marginBottom: 16,
      }}>← {t.home}</button>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>⚙ {t.settingsPage.title}</h2>

      {/* License Section */}
      <LicenseSettings license={license} lang={lang} />

      {/* AI Providers */}
      <div style={{
        background: surface, border: `1px solid ${border}`, borderRadius: 16,
        padding: 24, marginBottom: 16,
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: text2, marginBottom: 16 }}>
          🤖 {t.settingsPage.apiProviders}
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {AI_PROVIDERS.map((provider) => {
            const isOllama = provider.id === "ollama";
            const models = getModelsForProvider(provider.id);
            const isLoading = isLoadingForProvider(provider.id);
            const hasApiKey = apiKeys[provider.id] && apiKeys[provider.id].trim() !== "";
            const shouldShowModels = isOllama || (hasApiKey && models.length > 0);
            
            // Messaggio esplicativo per lingua
            const getHelperText = () => {
              if (isOllama) return "💡 I modelli dipendono da cosa hai installato con 'ollama pull'";
              if (!hasApiKey) return "🔑 Inserisci la tua API key per vedere i modelli disponibili";
              if (isLoading) return "⏳ Caricamento modelli in corso...";
              if (models.length === 0) return "⚠️ Nessun modello trovato. Verifica la tua API key.";
              return null;
            };
            
            const helperText = getHelperText();
            
            return (
              <div key={provider.id} style={{
                display: "flex", flexDirection: "column",
                borderRadius: 12, background: surface2, border: `1px solid ${border}`,
                overflow: "hidden",
              }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                  flexWrap: "wrap",
                }}>
                  <span style={{ color: provider.color, fontSize: 20, minWidth: 24 }}>{provider.icon}</span>
                  <span style={{ fontWeight: 600, fontSize: 14, minWidth: 140 }}>{provider.name}</span>
                  
                  {provider.requiresApiKey && !isOllama ? (
                    <input
                      placeholder={t.settingsPage.apiKey}
                      type="password"
                      value={apiKeys[provider.id] || ""}
                      onChange={(e) => onSetApiKey(provider.id, e.target.value)}
                      style={{
                        flex: 1, minWidth: 200, padding: "8px 12px", borderRadius: 8,
                        background: bg, border: `1px solid ${border}`, color: text1,
                        fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
                      }}
                    />
                  ) : isOllama ? (
                    <span style={{ fontSize: 12, color: text2, flex: 1, minWidth: 200 }}>
                      🔓 Locale - Nessuna API key richiesta
                    </span>
                  ) : null}
                  
                  {/* Menu a tendina per i modelli */}
                  {shouldShowModels && models.length > 0 && (
                    <select
                      value={selectedModels[provider.id] || models[0]?.id || ""}
                      onChange={(e) => onSetSelectedModel(provider.id, e.target.value)}
                      style={{
                        padding: "6px 10px", borderRadius: 8, fontSize: 12,
                        background: bg, border: `1px solid ${border}`, color: text1,
                        cursor: "pointer", minWidth: 220,
                      }}
                    >
                      {models.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  )}
                  
                  <button
                    onClick={() => onSetDefaultProvider(provider.id)}
                    style={{
                      padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                      background: defaultProvider === provider.id ? accent : "transparent",
                      color: defaultProvider === provider.id ? "#0B0E14" : text2,
                      border: `1px solid ${defaultProvider === provider.id ? accent : border}`,
                      cursor: "pointer", whiteSpace: "nowrap",
                    }}
                  >{t.settingsPage.setDefault}</button>
                </div>
                
                {/* Helper text (non invasivo) */}
                {helperText && (
                  <div style={{
                    padding: "6px 16px 10px 52px",
                    fontSize: 11,
                    color: helperText.includes("⚠️") ? danger : text2,
                    borderTop: `1px solid ${border}`,
                    background: accentDim + "22",
                  }}>
                    {helperText}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Language & Theme */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 16, padding: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: text2, marginBottom: 12 }}>{t.settingsPage.language}</h3>
          <select value={lang} onChange={(e) => onSetLang(e.target.value)} style={{
            width: "100%", padding: "10px 12px", borderRadius: 10,
            background: surface2, border: `1px solid ${border}`, color: text1,
            fontSize: 14, cursor: "pointer",
          }}>
            <option value="en">🇬🇧 English</option>
            <option value="it">🇮🇹 Italiano</option>
            <option value="fr">🇫🇷 Français</option>
            <option value="de">🇩🇪 Deutsch</option>
            <option value="es">🇪🇸 Español</option>
          </select>
        </div>
        <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 16, padding: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: text2, marginBottom: 12 }}>{t.settingsPage.theme}</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => onSetTheme("dark")} style={{
              flex: 1, padding: "10px 0", borderRadius: 10,
              background: theme === "dark" ? accent : surface2,
              color: theme === "dark" ? "#0B0E14" : text2,
              border: `1px solid ${theme === "dark" ? accent : border}`,
              cursor: "pointer",
            }}>🌙 Dark</button>
            <button onClick={() => onSetTheme("light")} style={{
              flex: 1, padding: "10px 0", borderRadius: 10,
              background: theme === "light" ? accent : surface2,
              color: theme === "light" ? "#0B0E14" : text2,
              border: `1px solid ${theme === "light" ? accent : border}`,
              cursor: "pointer",
            }}>☀️ Light</button>
          </div>
        </div>
      </div>

      {/* System Profile */}
      <div style={{
        background: surface, border: `1px solid ${border}`, borderRadius: 16,
        padding: 24, marginBottom: 16,
      }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: text2, marginBottom: 12 }}>{t.settingsPage.systemProfile}</h3>
        <textarea
          value={systemProfile}
          onChange={(e) => onSetSystemProfile(e.target.value)}
          placeholder={t.settingsPage.systemProfilePlaceholder}
          style={{
            width: "100%", height: 80, padding: 12, borderRadius: 10,
            background: surface2, border: `1px solid ${border}`, color: text1,
            fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
            resize: "vertical",
          }}
        />
      </div>

      <button onClick={onSave} style={{
        padding: "12px 28px", background: accent, color: "#0B0E14",
        border: "none", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer",
      }}>
        {saved ? "✓ " + t.settingsPage.saved : t.settingsPage.save}
      </button>
    </div>
  );
};

export default Settings;
