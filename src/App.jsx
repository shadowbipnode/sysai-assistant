import { useState, useEffect } from "react";
import LANGS, { FREE_MODES } from "./i18n";
import { AI_PROVIDERS, callAI, buildLogAnalysisPrompt, buildCommandPrompt } from "./utils/aiProviders";
import { fetchModelsForProvider } from "./utils/fetchModels";

function App() {
  const [lang, setLang] = useState("en");
  const [theme, setTheme] = useState("dark");
  const [page, setPage] = useState("home");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState({});
  const [selectedModels, setSelectedModels] = useState({});
  const [availableModels, setAvailableModels] = useState({});
  const [loadingModels, setLoadingModels] = useState({});
  const [defaultProvider, setDefaultProvider] = useState("gemini");
  const [systemProfile, setSystemProfile] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logText, setLogText] = useState("");
  const [cmdText, setCmdText] = useState("");
  const [selectedService, setSelectedService] = useState(0);
  const [showProBanner, setShowProBanner] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [analysisResult, setAnalysisResult] = useState(null);
  const [commandResult, setCommandResult] = useState(null);

  // Carica impostazioni salvate
  useEffect(() => {
    const savedApiKeys = localStorage.getItem("sysai_api_keys");
    const savedSelectedModels = localStorage.getItem("sysai_selected_models");
    const savedDefaultProvider = localStorage.getItem("sysai_default_provider");
    const savedSystemProfile = localStorage.getItem("sysai_system_profile");
    const savedLang = localStorage.getItem("sysai_lang");
    const savedTheme = localStorage.getItem("sysai_theme");
    
    if (savedApiKeys) setApiKeys(JSON.parse(savedApiKeys));
    if (savedSelectedModels) setSelectedModels(JSON.parse(savedSelectedModels));
    if (savedDefaultProvider) setDefaultProvider(savedDefaultProvider);
    if (savedSystemProfile) setSystemProfile(savedSystemProfile);
    if (savedLang) setLang(savedLang);
    if (savedTheme) setTheme(savedTheme);
  }, []);

  // Fetch modelli quando cambia una API key
  useEffect(() => {
    const loadModels = async () => {
      for (const provider of AI_PROVIDERS) {
        const apiKey = apiKeys[provider.id];
        if (provider.requiresApiKey && !apiKey) continue;
        
        // Evita di ricaricare se già abbiamo modelli per questo provider
        if (availableModels[provider.id]?.length > 0) continue;
        
        setLoadingModels(prev => ({ ...prev, [provider.id]: true }));
        try {
          const models = await fetchModelsForProvider(provider.id, apiKey);
          setAvailableModels(prev => ({ ...prev, [provider.id]: models }));
          
          // Se non c'è un modello selezionato e ci sono modelli, seleziona il primo
          if (!selectedModels[provider.id] && models.length > 0) {
            setSelectedModels(prev => ({ ...prev, [provider.id]: models[0].id }));
          }
        } catch (error) {
          console.error(`Errore fetch modelli per ${provider.id}:`, error);
        } finally {
          setLoadingModels(prev => ({ ...prev, [provider.id]: false }));
        }
      }
    };
    
    loadModels();
  }, [apiKeys]);

  const t = LANGS[lang] || LANGS.en;

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getSelectedModel = (providerId) => {
    return selectedModels[providerId] || availableModels[providerId]?.[0]?.id || null;
  };

  const handleAnalyzeLog = async () => {
    if (!logText.trim()) {
      alert("Inserisci del testo da analizzare");
      return;
    }
    
    const apiKey = apiKeys[defaultProvider];
    const provider = AI_PROVIDERS.find(p => p.id === defaultProvider);
    if (provider?.requiresApiKey && !apiKey) {
      alert(`Inserisci la API Key per ${provider.name} nelle impostazioni`);
      setPage("settings");
      return;
    }
    
    setAnalyzing(true);
    setShowResult(false);
    setAnalysisResult(null);
    
    try {
      const serviceName = t.logAnalyzerPage.services[selectedService];
      const prompt = buildLogAnalysisPrompt(logText, serviceName, systemProfile, lang);
      const model = getSelectedModel(defaultProvider);
      const response = await callAI(defaultProvider, apiKey, prompt, model);
      
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          setAnalysisResult(result);
        } else {
          setAnalysisResult({ severity: "INFO", title: "Analisi", explanation: response, fix: "N/A" });
        }
      } catch {
        setAnalysisResult({ severity: "INFO", title: "Risultato Analisi", explanation: response, fix: "N/A" });
      }
      setShowResult(true);
    } catch (error) {
      alert(`Errore: ${error.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCraftCommand = async () => {
    if (!cmdText.trim()) {
      alert("Inserisci una descrizione");
      return;
    }
    
    const apiKey = apiKeys[defaultProvider];
    const provider = AI_PROVIDERS.find(p => p.id === defaultProvider);
    if (provider?.requiresApiKey && !apiKey) {
      alert(`Inserisci la API Key per ${provider.name} nelle impostazioni`);
      setPage("settings");
      return;
    }
    
    setAnalyzing(true);
    setShowResult(false);
    setCommandResult(null);
    
    try {
      const prompt = buildCommandPrompt(cmdText, systemProfile, lang);
      const model = getSelectedModel(defaultProvider);
      const response = await callAI(defaultProvider, apiKey, prompt, model);
      
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          setCommandResult(result);
        } else {
          setCommandResult({ command: response, explanation: "Comando generato" });
        }
      } catch {
        setCommandResult({ command: response, explanation: "Comando generato" });
      }
      setShowResult(true);
    } catch (error) {
      alert(`Errore: ${error.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const navigateTo = (p, modeKey) => {
    if (modeKey && !FREE_MODES.includes(modeKey)) {
      setShowProBanner(true);
      setTimeout(() => setShowProBanner(false), 3000);
      return;
    }
    setPage(p);
    setShowResult(false);
    setAnalyzing(false);
    setSidebarOpen(false);
  };

  const saveSettings = () => {
    localStorage.setItem("sysai_api_keys", JSON.stringify(apiKeys));
    localStorage.setItem("sysai_selected_models", JSON.stringify(selectedModels));
    localStorage.setItem("sysai_default_provider", defaultProvider);
    localStorage.setItem("sysai_system_profile", systemProfile);
    localStorage.setItem("sysai_lang", lang);
    localStorage.setItem("sysai_theme", theme);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const bg = theme === "dark" ? "#0B0E14" : "#F5F6F8";
  const surface = theme === "dark" ? "#131720" : "#FFFFFF";
  const surface2 = theme === "dark" ? "#1A1F2E" : "#F0F1F4";
  const border = theme === "dark" ? "#1E2535" : "#E2E4E9";
  const text1 = theme === "dark" ? "#E8ECF4" : "#1A1D24";
  const text2 = theme === "dark" ? "#8B95A8" : "#6B7280";
  const accent = "#00D4AA";
  const accentDim = "#00D4AA22";
  const danger = "#FF4D6A";

  const modeKeys = Object.keys(t.modes);
  const filteredModes = searchText
    ? modeKeys.filter((k) => t.modes[k].name.toLowerCase().includes(searchText.toLowerCase()))
    : modeKeys;

  return (
    <div style={{
      fontFamily: "'Outfit', sans-serif",
      background: bg,
      color: text1,
      minHeight: "100vh",
      position: "relative",
    }}>
      {/* Top Nav */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 20px", background: surface, borderBottom: `1px solid ${border}`,
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{
            background: "none", border: "none", color: text2, cursor: "pointer",
            fontSize: 22, padding: 4,
          }}>☰</button>
          <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => setPage("home")}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
              background: `linear-gradient(135deg, ${accent}, #00A888)`,
              fontWeight: 700, fontSize: 14, color: "#0B0E14",
            }}>S</div>
            <span style={{ fontWeight: 700, fontSize: 18 }}>Sys<span style={{ color: accent }}>AI</span></span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700,
            background: accentDim, color: accent,
          }}>{t.free}</div>
          <button onClick={() => setPage("settings")} style={{
            background: "none", border: `1px solid ${border}`, borderRadius: 8,
            color: text2, cursor: "pointer", padding: "6px 10px", fontSize: 16,
          }}>⚙</button>
        </div>
      </nav>

      {/* Sidebar */}
      {sidebarOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex" }}>
          <div onClick={() => setSidebarOpen(false)} style={{ position: "absolute", inset: 0, background: "#00000066" }} />
          <div style={{
            position: "relative", width: 280, background: surface, borderRight: `1px solid ${border}`,
            padding: "20px 0", display: "flex", flexDirection: "column",
          }}>
            <div style={{ padding: "0 20px 20px", borderBottom: `1px solid ${border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                  background: `linear-gradient(135deg, ${accent}, #00A888)`,
                  fontWeight: 700, fontSize: 16, color: "#0B0E14",
                }}>S</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>Sys<span style={{ color: accent }}>AI</span></div>
                  <div style={{ fontSize: 11, color: text2 }}>v1.0.0</div>
                </div>
              </div>
            </div>
            <div style={{ flex: 1, padding: "12px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
              {[
                { icon: "🏠", label: t.home, key: "home" },
                { icon: "📜", label: t.history, key: "history" },
                { icon: "⭐", label: t.favorites, key: "favorites" },
                { icon: "📎", label: t.snippets, key: "snippets" },
                { icon: "⚙", label: t.settings, key: "settings" },
              ].map((item) => (
                <div key={item.key} onClick={() => navigateTo(item.key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",
                    borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 500,
                    color: page === item.key ? accent : text1,
                    background: page === item.key ? accentDim : "transparent",
                  }}>
                  <span style={{ fontSize: 18 }}>{item.icon}</span>
                  {item.label}
                </div>
              ))}
            </div>
            <div style={{ padding: "16px", borderTop: `1px solid ${border}` }}>
              <div style={{
                background: `linear-gradient(135deg, ${accent}15, ${accent}08)`,
                border: `1px solid ${accent}33`, borderRadius: 12, padding: 16,
              }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{t.upgradePro}</div>
                <div style={{ fontSize: 12, color: text2, marginBottom: 12 }}>{t.proDesc}</div>
                <div style={{ fontSize: 12, color: accent, fontWeight: 600, marginBottom: 12 }}>{t.proPrice}</div>
                <button style={{
                  width: "100%", padding: "8px 0", background: accent, color: "#0B0E14",
                  border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer",
                }}>{t.getStarted}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pro Banner Toast */}
      {showProBanner && (
        <div style={{
          position: "fixed", top: 70, left: "50%", transform: "translateX(-50%)", zIndex: 500,
          background: surface, border: `1px solid ${accent}44`, borderRadius: 12,
          padding: "12px 20px", display: "flex", alignItems: "center", gap: 12,
        }}>
          <span>🔒</span>
          <span style={{ fontSize: 13 }}>{t.proDesc}</span>
          <button style={{
            background: accent, color: "#0B0E14", border: "none", borderRadius: 6,
            padding: "4px 12px", fontWeight: 600, fontSize: 12, cursor: "pointer",
          }}>{t.upgradePro}</button>
        </div>
      )}

      {/* Main Content */}
      <main style={{ padding: "24px 20px", maxWidth: 900, margin: "0 auto", width: "100%" }}>
        {/* HOME uguale */}
        {page === "home" && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>{t.tagline}</h1>
              <p style={{ color: text2, fontSize: 14 }}>
                {lang === "it" ? "Scegli uno strumento per iniziare" : "Choose a tool to get started"}
              </p>
            </div>
            <div style={{ position: "relative", marginBottom: 24 }}>
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: text2 }}>⌕</span>
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder={t.searchPlaceholder}
                style={{
                  width: "100%", padding: "12px 16px 12px 40px", borderRadius: 12,
                  background: surface, border: `1px solid ${border}`, color: text1,
                  fontSize: 14,
                }}
              />
            </div>
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12,
            }}>
              {filteredModes.map((key) => {
                const mode = t.modes[key];
                const isFree = FREE_MODES.includes(key);
                return (
                  <div key={key} onClick={() => navigateTo(key, key)}
                    style={{
                      background: surface, border: `1px solid ${border}`, borderRadius: 16,
                      padding: 20, cursor: "pointer", position: "relative",
                    }}>
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
              })}
            </div>
          </div>
        )}

        {/* LOG ANALYZER */}
        {page === "logAnalyzer" && (
          <div>
            <button onClick={() => setPage("home")} style={{
              background: "none", border: "none", color: text2, cursor: "pointer",
              fontSize: 13, marginBottom: 16,
            }}>← {t.home}</button>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>
              {t.modes.logAnalyzer.icon} {t.logAnalyzerPage.title}
            </h2>
            <p style={{ color: text2, fontSize: 14, marginBottom: 20 }}>{t.logAnalyzerPage.subtitle}</p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: text2, marginBottom: 8, display: "block" }}>
                {t.logAnalyzerPage.serviceLabel}
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {t.logAnalyzerPage.services.map((s, i) => (
                  <button key={s} onClick={() => setSelectedService(i)} style={{
                    padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500,
                    background: selectedService === i ? accent : surface2,
                    color: selectedService === i ? "#0B0E14" : text2,
                    border: `1px solid ${selectedService === i ? accent : border}`,
                    cursor: "pointer",
                  }}>{s}</button>
                ))}
              </div>
            </div>

            <textarea
              value={logText}
              onChange={(e) => setLogText(e.target.value)}
              placeholder="Paste your log here..."
              style={{
                width: "100%", height: 180, padding: 16, borderRadius: 12,
                background: surface, border: `1px solid ${border}`, color: text1,
                fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
                resize: "vertical",
              }}
            />

            <button onClick={handleAnalyzeLog} style={{
              marginTop: 12, padding: "12px 28px", background: accent, color: "#0B0E14",
              border: "none", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer",
            }}>
              {analyzing ? t.logAnalyzerPage.analyzing : t.logAnalyzerPage.analyze}
            </button>

            {showResult && analysisResult && (
              <div style={{ marginTop: 24 }}>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px",
                  borderRadius: 8, background: analysisResult.severity === "HIGH" || analysisResult.severity === "CRITICAL" ? `${danger}15` : `${accent}15`,
                  marginBottom: 16,
                }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: analysisResult.severity === "HIGH" || analysisResult.severity === "CRITICAL" ? danger : accent }} />
                  <span style={{ color: analysisResult.severity === "HIGH" || analysisResult.severity === "CRITICAL" ? danger : accent, fontWeight: 700, fontSize: 13 }}>
                    {analysisResult.severity || "INFO"}
                  </span>
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>{analysisResult.title}</h3>
                <div style={{
                  background: surface, border: `1px solid ${border}`, borderRadius: 12,
                  padding: 20, marginBottom: 16,
                }}>
                  <p style={{ fontSize: 14, color: text2, whiteSpace: "pre-wrap" }}>{analysisResult.explanation}</p>
                </div>
                {analysisResult.fix && analysisResult.fix !== "N/A" && (
                  <div style={{
                    background: surface, border: `1px solid ${accent}33`, borderRadius: 12,
                    overflow: "hidden",
                  }}>
                    <div style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "10px 16px", background: accentDim,
                    }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: accent }}>FIX</span>
                      <button onClick={() => handleCopy(analysisResult.fix)} style={{
                        background: "none", border: `1px solid ${accent}44`, borderRadius: 6,
                        color: accent, padding: "4px 12px", fontSize: 11, cursor: "pointer",
                      }}>{copied ? "✓ Copied!" : "📋 Copy"}</button>
                    </div>
                    <pre style={{
                      padding: 20, fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
                      color: text1, whiteSpace: "pre-wrap",
                    }}>{analysisResult.fix}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* COMMAND CRAFTER */}
        {page === "commandCrafter" && (
          <div>
            <button onClick={() => setPage("home")} style={{
              background: "none", border: "none", color: text2, cursor: "pointer",
              fontSize: 13, marginBottom: 16,
            }}>← {t.home}</button>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>
              {t.modes.commandCrafter.icon} {t.commandCrafterPage.title}
            </h2>
            <p style={{ color: text2, fontSize: 14, marginBottom: 20 }}>{t.commandCrafterPage.subtitle}</p>

            <div style={{ display: "flex", gap: 10 }}>
              <input
                value={cmdText}
                onChange={(e) => setCmdText(e.target.value)}
                placeholder={t.commandCrafterPage.placeholder}
                style={{
                  flex: 1, padding: "14px 16px", borderRadius: 12,
                  background: surface, border: `1px solid ${border}`, color: text1,
                  fontSize: 14,
                }}
              />
              <button onClick={handleCraftCommand} style={{
                padding: "12px 24px", background: accent, color: "#0B0E14",
                border: "none", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer",
              }}>
                {analyzing ? t.commandCrafterPage.crafting : t.commandCrafterPage.craft}
              </button>
            </div>

            {showResult && commandResult && (
              <div style={{ marginTop: 24 }}>
                <div style={{
                  background: surface, border: `1px solid ${accent}33`, borderRadius: 12,
                  overflow: "hidden", marginBottom: 16,
                }}>
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 16px", background: accentDim,
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: accent }}>COMMAND</span>
                    <button onClick={() => handleCopy(commandResult.command)} style={{
                      background: "none", border: `1px solid ${accent}44`, borderRadius: 6,
                      color: accent, padding: "4px 12px", fontSize: 11, cursor: "pointer",
                    }}>{copied ? "✓ Copied!" : "📋 Copy"}</button>
                  </div>
                  <pre style={{
                    padding: 20, fontFamily: "'JetBrains Mono', monospace", fontSize: 14,
                    color: accent, fontWeight: 600, overflowX: "auto",
                  }}>{commandResult.command}</pre>
                </div>
                {commandResult.explanation && (
                  <div style={{
                    background: surface, border: `1px solid ${border}`, borderRadius: 12,
                    padding: 20,
                  }}>
                    <h4 style={{ fontSize: 13, fontWeight: 600, color: text2, marginBottom: 12 }}>📖 Explanation</h4>
                    <p style={{ fontSize: 14, color: text2, whiteSpace: "pre-wrap" }}>{commandResult.explanation}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* SETTINGS */}
        {page === "settings" && (
          <div>
            <button onClick={() => setPage("home")} style={{
              background: "none", border: "none", color: text2, cursor: "pointer",
              fontSize: 13, marginBottom: 16,
            }}>← {t.home}</button>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>⚙ {t.settingsPage.title}</h2>

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
                  const models = availableModels[provider.id] || [];
                  const isLoading = loadingModels[provider.id];
                  return (
                    <div key={provider.id} style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                      borderRadius: 12, background: surface2, border: `1px solid ${border}`,
                      flexWrap: "wrap",
                    }}>
                      <span style={{ color: provider.color, fontSize: 20, minWidth: 24 }}>{provider.icon}</span>
                      <span style={{ fontWeight: 600, fontSize: 14, minWidth: 140 }}>{provider.name}</span>
                      {provider.requiresApiKey ? (
                        <input
                          placeholder={t.settingsPage.apiKey}
                          type="password"
                          value={apiKeys[provider.id] || ""}
                          onChange={(e) => setApiKeys({ ...apiKeys, [provider.id]: e.target.value })}
                          style={{
                            flex: 1, minWidth: 160, padding: "8px 12px", borderRadius: 8,
                            background: bg, border: `1px solid ${border}`, color: text1,
                            fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: 12, color: text2, flex: 1, minWidth: 160 }}>🔓 No API key required (local)</span>
                      )}
                      
                      {/* Modelli a tendina - caricati dinamicamente */}
                      {isLoading ? (
                        <span style={{ fontSize: 12, color: text2, minWidth: 160 }}>⏳ Caricamento modelli...</span>
                      ) : models.length > 0 ? (
                        <select
                          value={selectedModels[provider.id] || models[0]?.id || ""}
                          onChange={(e) => setSelectedModels({ ...selectedModels, [provider.id]: e.target.value })}
                          style={{
                            padding: "6px 10px", borderRadius: 8, fontSize: 12,
                            background: bg, border: `1px solid ${border}`, color: text1,
                            cursor: "pointer", minWidth: 180,
                          }}
                        >
                          {models.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      ) : provider.requiresApiKey && apiKeys[provider.id] ? (
                        <span style={{ fontSize: 12, color: danger, minWidth: 180 }}>⚠️ Nessun modello trovato</span>
                      ) : (
                        <span style={{ fontSize: 12, color: text2, minWidth: 180 }}>🔑 Inserisci API key</span>
                      )}
                      
                      <button
                        onClick={() => setDefaultProvider(provider.id)}
                        style={{
                          padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                          background: defaultProvider === provider.id ? accent : "transparent",
                          color: defaultProvider === provider.id ? "#0B0E14" : text2,
                          border: `1px solid ${defaultProvider === provider.id ? accent : border}`,
                          cursor: "pointer", whiteSpace: "nowrap",
                        }}
                      >{t.settingsPage.setDefault}</button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Language & Theme */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 16, padding: 20 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: text2, marginBottom: 12 }}>{t.settingsPage.language}</h3>
                <select value={lang} onChange={(e) => setLang(e.target.value)} style={{
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
                  <button onClick={() => setTheme("dark")} style={{
                    flex: 1, padding: "10px 0", borderRadius: 10,
                    background: theme === "dark" ? accent : surface2,
                    color: theme === "dark" ? "#0B0E14" : text2,
                    border: `1px solid ${theme === "dark" ? accent : border}`,
                    cursor: "pointer",
                  }}>🌙 Dark</button>
                  <button onClick={() => setTheme("light")} style={{
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
                onChange={(e) => setSystemProfile(e.target.value)}
                placeholder={t.settingsPage.systemProfilePlaceholder}
                style={{
                  width: "100%", height: 80, padding: 12, borderRadius: 10,
                  background: surface2, border: `1px solid ${border}`, color: text1,
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
                  resize: "vertical",
                }}
              />
            </div>

            <button onClick={saveSettings} style={{
              padding: "12px 28px", background: accent, color: "#0B0E14",
              border: "none", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer",
            }}>
              {saved ? "✓ " + t.settingsPage.saved : t.settingsPage.save}
            </button>
          </div>
        )}

        {/* Placeholder for other PRO pages */}
        {["configGenerator", "troubleshooter", "scriptBuilder", "securityAuditor", "history", "favorites", "snippets", "explainMode"].includes(page) && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Pro Feature</h2>
            <p style={{ color: text2 }}>{t.proDesc}</p>
            <button style={{
              marginTop: 20, padding: "10px 24px", background: accent, color: "#0B0E14",
              border: "none", borderRadius: 10, fontWeight: 600, cursor: "pointer",
            }}>{t.upgradePro}</button>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
