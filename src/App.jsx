import { useState, useEffect } from "react";
import LANGS, { FREE_MODES } from "./i18n";
import { AI_PROVIDERS, callAI, buildLogAnalysisPrompt, buildCommandPrompt, buildConfigPrompt, buildTroubleshootQuestionsPrompt, buildTroubleshootSolutionPrompt } from "./utils/aiProviders";
import { fetchModelsForProvider } from "./utils/fetchModels";
import Toast from "./components/Toast";
import { useToast } from "./hooks/useToast";
import ModeCard from "./components/ModeCard";
import LogAnalyzer from "./components/LogAnalyzer";
import CommandCrafter from "./components/CommandCrafter";
import Settings from "./components/Settings";
import ConfigGenerator from "./components/ConfigGenerator";
import Troubleshooter from "./components/Troubleshooter";
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
  const [showProBanner, setShowProBanner] = useState(false);
  const [searchText, setSearchText] = useState("");
  
  const { toast, showToast, hideToast } = useToast();

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

  // Fetch modelli
  useEffect(() => {
    const loadModels = async () => {
      for (const provider of AI_PROVIDERS) {
        const apiKey = apiKeys[provider.id];
        if (provider.requiresApiKey && !apiKey) continue;
        if (availableModels[provider.id]?.length > 0) continue;
        
        setLoadingModels(prev => ({ ...prev, [provider.id]: true }));
        try {
          const models = await fetchModelsForProvider(provider.id, apiKey);
          setAvailableModels(prev => ({ ...prev, [provider.id]: models }));
          if (!selectedModels[provider.id] && models.length > 0) {
            setSelectedModels(prev => ({ ...prev, [provider.id]: models[0].id }));
          }
        } catch (error) {
          console.error(error);
        } finally {
          setLoadingModels(prev => ({ ...prev, [provider.id]: false }));
        }
      }
    };
    loadModels();
  }, [apiKeys]);

  const t = LANGS[lang] || LANGS.en;

  const getCurrentProvider = () => {
    const provider = AI_PROVIDERS.find(p => p.id === defaultProvider);
    return provider?.name || defaultProvider;
  };

  const getCurrentModel = () => {
    return selectedModels[defaultProvider] || availableModels[defaultProvider]?.[0]?.id || "default";
  };

  const handleAnalyzeLog = async (logText, selectedService) => {
    const apiKey = apiKeys[defaultProvider];
    const provider = AI_PROVIDERS.find(p => p.id === defaultProvider);
    if (provider?.requiresApiKey && !apiKey) {
      showToast(`Inserisci API Key per ${provider.name}`, "error");
      setPage("settings");
      return null;
    }
    
    try {
      const serviceName = t.logAnalyzerPage.services[selectedService];
      const prompt = buildLogAnalysisPrompt(logText, serviceName, systemProfile, lang);
      const model = getCurrentModel();
      const response = await callAI(defaultProvider, apiKey, prompt, model);
      console.log("🤖 AI response:", response.substring(0, 200));
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        showToast("Analisi completata!", "success");
        return result;
      }
      return { severity: "INFO", title: "Analisi", explanation: response, fix: "N/A" };
    } catch (error) {
      showToast(`Errore: ${error.message}`, "error");
      return null;
    }
  };

  const handleGenerateConfig = async (configType, description) => {
    const apiKey = apiKeys[defaultProvider];
    const provider = AI_PROVIDERS.find(p => p.id === defaultProvider);
    if (provider?.requiresApiKey && !apiKey) {
      showToast(`Inserisci API Key per ${provider.name}`, "error");
      setPage("settings");
      return null;
    }
    
    try {
      const prompt = buildConfigPrompt(configType, description, systemProfile, lang);
      const model = getCurrentModel();
      const response = await callAI(defaultProvider, apiKey, prompt, model);
      console.log("🤖 AI response:", response.substring(0, 200));
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        showToast("Configurazione generata!", "success");
        return result;
      }
      return { filename: "config.conf", config: response, explanation: "Configurazione generata" };
    } catch (error) {
      showToast(`Errore: ${error.message}`, "error");
      return null;
    }
  };

  
  const handleTroubleshoot = async (problem, action, answers = [], questions = []) => {
    const apiKey = apiKeys[defaultProvider];
    const provider = AI_PROVIDERS.find(p => p.id === defaultProvider);
    if (provider?.requiresApiKey && !apiKey) {
      showToast(`Inserisci API Key per ${provider.name}`, "error");
      setPage("settings");
      return null;
    }
    
    try {
      let prompt;
      if (action === "start") {
        prompt = buildTroubleshootQuestionsPrompt(problem, systemProfile, lang);
      } else {
        prompt = buildTroubleshootSolutionPrompt(problem, answers, questions, systemProfile, lang);
      }
      const model = getCurrentModel();
      const response = await callAI(defaultProvider, apiKey, prompt, model);
      console.log("🤖 AI response:", response.substring(0, 200));
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        showToast(action === "start" ? "Domande generate!" : "Soluzione trovata!", "success");
        return result;
      }
      return null;
    } catch (error) {
      showToast(`Errore: ${error.message}`, "error");
      return null;
    }
  };

  const handleCraftCommand = async (cmdText) => {
    const apiKey = apiKeys[defaultProvider];
    const provider = AI_PROVIDERS.find(p => p.id === defaultProvider);
    if (provider?.requiresApiKey && !apiKey) {
      showToast(`Inserisci API Key per ${provider.name}`, "error");
      setPage("settings");
      return null;
    }
    
    try {
      const prompt = buildCommandPrompt(cmdText, systemProfile, lang);
      const model = getCurrentModel();
      const response = await callAI(defaultProvider, apiKey, prompt, model);
      console.log("🤖 AI response:", response.substring(0, 200));
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        showToast("Comando generato!", "success");
        return result;
      }
      return { command: response, explanation: "Comando generato" };
    } catch (error) {
      showToast(`Errore: ${error.message}`, "error");
      return null;
    }
  };

  const navigateTo = (p, modeKey) => {
    if (modeKey && !FREE_MODES.includes(modeKey)) {
      setShowProBanner(true);
      setTimeout(() => setShowProBanner(false), 3000);
      return;
    }
    setPage(p);
    setSidebarOpen(false);
  };

  const saveSettings = () => {
    localStorage.setItem("sysai_api_keys", JSON.stringify(apiKeys));
    localStorage.setItem("sysai_selected_models", JSON.stringify(selectedModels));
    localStorage.setItem("sysai_default_provider", defaultProvider);
    localStorage.setItem("sysai_system_profile", systemProfile);
    localStorage.setItem("sysai_lang", lang);
    localStorage.setItem("sysai_theme", theme);
    showToast("Impostazioni salvate!", "success");
  };

  const bg = theme === "dark" ? "#0B0E14" : "#F5F6F8";
  const surface = theme === "dark" ? "#131720" : "#FFFFFF";
  const surface2 = theme === "dark" ? "#1A1F2E" : "#F0F1F4";
  const border = theme === "dark" ? "#1E2535" : "#E2E4E9";
  const text1 = theme === "dark" ? "#E8ECF4" : "#1A1D24";
  const text2 = theme === "dark" ? "#8B95A8" : "#6B7280";
  const accent = "#00D4AA";
  const accentDim = "#00D4AA22";

  const modeKeys = Object.keys(t.modes);
  const filteredModes = searchText
    ? modeKeys.filter((k) => t.modes[k].name.toLowerCase().includes(searchText.toLowerCase()))
    : modeKeys;

  return (
    <div style={{ fontFamily: "'Outfit', sans-serif", background: bg, color: text1, minHeight: "100vh" }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      {/* Navbar */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 20px", background: surface, borderBottom: `1px solid ${border}`,
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{
            background: "none", border: "none", color: text2, cursor: "pointer", fontSize: 22,
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
        
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            background: accentDim, padding: "4px 12px", borderRadius: 20,
            fontSize: 11, fontWeight: 500, color: accent,
          }}>
            <span>🤖</span>
            <span>{getCurrentProvider()}</span>
            <span style={{ opacity: 0.5 }}>•</span>
            <span style={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {getCurrentModel().split('-').slice(0, 3).join('-')}
            </span>
          </div>
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
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
            <div style={{ flex: 1, padding: "12px 8px" }}>
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
                <div style={{ fontWeight: 600, fontSize: 14 }}>{t.upgradePro}</div>
                <div style={{ fontSize: 12, color: text2, marginTop: 4 }}>{t.proDesc}</div>
                <button style={{
                  width: "100%", marginTop: 12, padding: "8px 0", background: accent, color: "#0B0E14",
                  border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer",
                }}>{t.getStarted}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pro Banner */}
      {showProBanner && (
        <div style={{
          position: "fixed", top: 70, left: "50%", transform: "translateX(-50%)", zIndex: 500,
          background: surface, border: `1px solid ${accent}44`, borderRadius: 12, padding: "12px 20px",
        }}>
          <span>{t.proDesc}</span>
          <button style={{ marginLeft: 12, background: accent, border: "none", borderRadius: 6, padding: "4px 12px", cursor: "pointer" }}>{t.upgradePro}</button>
        </div>
      )}

      {/* Main Content */}
      <main style={{ padding: "24px 20px", maxWidth: 900, margin: "0 auto", width: "100%" }}>
        {page === "home" && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <h1 style={{ fontSize: 28, fontWeight: 700 }}>{t.tagline}</h1>
              <p style={{ color: text2, fontSize: 14 }}>{lang === "it" ? "Scegli uno strumento per iniziare" : "Choose a tool"}</p>
            </div>
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder={t.searchPlaceholder}
              style={{
                width: "100%", padding: "12px 16px", borderRadius: 12,
                background: surface, border: `1px solid ${border}`, color: text1,
                marginBottom: 24,
              }}
            />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
              {filteredModes.map((key) => {
                const mode = t.modes[key];
                return (
                  <ModeCard
                    key={key}
                    mode={mode}
                    isFree={FREE_MODES.includes(key)}
                    accent={accent}
                    accentDim={accentDim}
                    surface={surface}
                    border={border}
                    text2={text2}
                    onClick={() => navigateTo(key, key)}
                  />
                );
              })}
            </div>
          </div>
        )}

        {page === "logAnalyzer" && (
          <LogAnalyzer t={t} onAnalyze={handleAnalyzeLog} onBack={() => setPage("home")} />
        )}

        {page === "commandCrafter" && (
          <CommandCrafter t={t} onCraft={handleCraftCommand} onBack={() => setPage("home")} />
        )}

        {page === "configGenerator" && (
          <ConfigGenerator t={t} onGenerate={handleGenerateConfig} onBack={() => setPage("home")} />
        )}
        {page === "troubleshooter" && (
          <Troubleshooter t={t} onDiagnose={handleTroubleshoot} onBack={() => setPage("home")} />
        )}
        {page === "settings" && (
          <Settings
            t={t}
            lang={lang}
            theme={theme}
            accent={accent}
            accentDim={accentDim}
            surface={surface}
            surface2={surface2}
            border={border}
            bg={bg}
            text1={text1}
            text2={text2}
            danger="#FF4D6A"
            apiKeys={apiKeys}
            selectedModels={selectedModels}
            availableModels={availableModels}
            loadingModels={loadingModels}
            defaultProvider={defaultProvider}
            systemProfile={systemProfile}
            saved={false}
            onSetLang={setLang}
            onSetTheme={setTheme}
            onSetApiKey={(id, val) => setApiKeys({ ...apiKeys, [id]: val })}
            onSetSelectedModel={(id, val) => setSelectedModels({ ...selectedModels, [id]: val })}
            onSetDefaultProvider={setDefaultProvider}
            onSetSystemProfile={setSystemProfile}
            onSave={saveSettings}
            onBack={() => setPage("home")}
          />
        )}

        {/* Placeholder per altre pagine Pro */}
        {["scriptBuilder", "securityAuditor", "history", "favorites", "snippets", "explainMode"].includes(page) && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 48 }}>🔒</div>
            <h2>Pro Feature</h2>
            <p>{t.proDesc}</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
