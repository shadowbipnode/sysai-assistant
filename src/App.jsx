import { useState, useEffect } from "react";
import LANGS, { FREE_MODES } from "./i18n";
import { AI_PROVIDERS, callAI, fetchModels, buildLogAnalysisPrompt, buildCommandPrompt, buildConfigPrompt, buildTroubleshootPrompt, buildScriptPrompt, buildSecurityAuditPrompt, buildSecurityScanAnalysisPrompt } from "./utils/aiProviders";
import Toast from "./components/Toast";
import { useToast } from "./hooks/useToast";
import ModeCard from "./components/ModeCard";
import LogAnalyzer from "./components/LogAnalyzer";
import CommandCrafter from "./components/CommandCrafter";
import Settings from "./components/Settings";
import ConfigGenerator from "./components/ConfigGenerator";
import Troubleshooter from "./components/Troubleshooter";
import ScriptBuilder from "./components/ScriptBuilder";
import SecurityAuditor from "./components/SecurityAuditor";
import ExplainMode from "./components/ExplainMode";
import CsrGenerator from "./components/CsrGenerator";
import { buildExplainPrompt } from "./utils/aiProviders";
import { useLicense } from './hooks/useLicense';
import { PRO_TOOLS } from './utils/license';
import LicenseSettings from './components/LicenseSettings';
import ProGate from './components/ProGate';
import { useHistory } from './hooks/useHistory';
import History from './components/History';
import CommandPalette from "./components/CommandPalette";
import QuickModelSwitcher from "./components/QuickModelSwitcher";
import OperationalContextPanel from "./components/OperationalContextPanel";
import { updateOperationalMemory } from "./utils/operationalContextStore";

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
  const [historyInitialQuery, setHistoryInitialQuery] = useState("");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false);
    // License state
  const license = useLicense();
  const history = useHistory();
  const [showProGate, setShowProGate] = useState(false);
  const [appVersion, setAppVersion] = useState('');
  const [updateInfo, setUpdateInfo] = useState(null);
  
  const { toast, showToast, hideToast } = useToast();




  // Carica impostazioni salvate
  useEffect(() => {
    const loadSettings = async () => {
      const savedSelectedModels = localStorage.getItem("sysai_selected_models");
      const savedDefaultProvider = localStorage.getItem("sysai_default_provider");
      const savedSystemProfile = localStorage.getItem("sysai_system_profile");
      const savedLang = localStorage.getItem("sysai_lang");
      const savedTheme = localStorage.getItem("sysai_theme");

      // Backward compatibility: migrate old localStorage API keys into encrypted Electron storage.
      const legacyApiKeys = localStorage.getItem("sysai_api_keys");
      if (legacyApiKeys && window.electron?.secureStore) {
        await window.electron.secureStore.set("sysai_api_keys", legacyApiKeys);
        localStorage.removeItem("sysai_api_keys");
      }

      if (window.electron?.secureStore) {
        const secureApiKeys = await window.electron.secureStore.get("sysai_api_keys");
        if (secureApiKeys?.success && secureApiKeys.value) {
          setApiKeys(JSON.parse(secureApiKeys.value));
        }
      } else if (legacyApiKeys) {
        setApiKeys(JSON.parse(legacyApiKeys));
      }

      if (savedSelectedModels) setSelectedModels(JSON.parse(savedSelectedModels));
      if (savedDefaultProvider) setDefaultProvider(savedDefaultProvider);
      if (savedSystemProfile) setSystemProfile(savedSystemProfile);
      if (savedLang) setLang(savedLang);
      if (savedTheme) setTheme(savedTheme);
    };

    loadSettings().catch((error) => {
      console.error("Errore caricamento impostazioni:", error);
    });
  }, []);

  // App version + GitHub update checker. Offline/errors are intentionally silent.
  useEffect(() => {
    const loadVersionAndCheckUpdates = async () => {
      if (!window.electron?.ipcRenderer?.invoke) return;

      try {
        const info = await window.electron.ipcRenderer.invoke('get-app-version');
        if (info?.version) setAppVersion(info.version);
      } catch (error) {
        console.warn('Version info unavailable:', error.message);
      }

      try {
        const update = await window.electron.ipcRenderer.invoke('check-for-updates');
        if (update?.success && update.updateAvailable && update.latestVersion) {
          const ignoredVersion = localStorage.getItem('sysai_ignored_update_version');
          if (ignoredVersion !== update.latestVersion) {
            setUpdateInfo(update);
          }
        }
      } catch (error) {
        console.warn('Update check unavailable:', error.message);
      }
    };

    loadVersionAndCheckUpdates();
  }, []);

  const openReleasePage = async () => {
    if (!updateInfo?.releaseUrl) return;
    if (window.electron?.ipcRenderer?.invoke) {
      await window.electron.ipcRenderer.invoke('open-external', updateInfo.releaseUrl);
    } else {
      window.open(updateInfo.releaseUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const dismissUpdate = () => {
    if (updateInfo?.latestVersion) {
      localStorage.setItem('sysai_ignored_update_version', updateInfo.latestVersion);
    }
    setUpdateInfo(null);
  };

  // Fetch modelli
  useEffect(() => {
    const loadModels = async () => {
      for (const provider of AI_PROVIDERS) {
        const apiKey = apiKeys[provider.id];
        if (provider.requiresApiKey && !apiKey) continue;
        if (availableModels[provider.id]?.length > 0) continue;
        
        setLoadingModels(prev => ({ ...prev, [provider.id]: true }));
        try {
          const models = await fetchModels(provider.id, apiKey);
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

  const extractJsonObject = (raw) => {
    if (!raw || typeof raw !== "string") return null;

    let text = raw.trim();

    // Remove markdown fences if the model returns ```json ... ```
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();

    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first === -1 || last === -1 || last <= first) return null;

    let candidate = text.slice(first, last + 1);

    const tryParse = (value) => {
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    };
   
    let parsed = tryParse(candidate);
    if (parsed) return parsed;

    // Common LLM issue on Windows paths: C:\Users\... creates invalid JSON escapes.
    // Escape only backslashes that are not valid JSON escape sequences.
    const escapedBackslashes = candidate.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
    parsed = tryParse(escapedBackslashes);
    if (parsed) return parsed;

    // Common LLM issue: raw control characters inside strings.
    const cleanedControls = escapedBackslashes.replace(/[\u0000-\u001F]+/g, " ");
    parsed = tryParse(cleanedControls);
    if (parsed) return parsed;

    return null;
  };
  const learnFromOperationalResult = (result, incidentLabel = "") => {
    if (!result || typeof result !== "object") return;

    const text = JSON.stringify(result);

    const known_ports = [...text.matchAll(/(?:127\.0\.0\.1|localhost|0\.0\.0\.0|[a-zA-Z0-9.-]+):(\d{2,5})/g)]
      .map((match) => match[1]);

      const known_paths = [...text.matchAll(/(?:\/[a-zA-Z0-9._-]+)+(?:\/)?/g)]
      .map((match) => match[0])
      .filter((path) =>
        path.length > 1 &&
        !path.includes("//") &&
        !/^\/?\d{1,3}(?:\.\d{1,3}){3}/.test(path)
      );
    
    const known_domains = [...text.matchAll(/\b(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}\b/g)]
      .map((match) => match[0])
      .filter((domain) =>
        !domain.includes("localhost") &&
        !domain.endsWith(".yml") &&
        !domain.endsWith(".yaml") &&
        !domain.startsWith("State.")
      );

    const known_containers = [...text.matchAll(/\b[a-zA-Z0-9][a-zA-Z0-9_.-]*-(?:app|web|api|db|nginx|redis|postgres|mysql|tor|lnd|bitcoin|core)-?\d*\b/g)]
      .map((match) => match[0]);

    const inferred_stack = Array.isArray(result.detected_stack)
      ? result.detected_stack
      : [];

    const known_incidents = [
      result.title,
      result.root_cause,
      result.summary,
      incidentLabel,
    ]
      .filter(Boolean)
      .map((item) => String(item).slice(0, 180));

    updateOperationalMemory({
      known_ports,
      known_paths,
      known_domains,
      known_containers,
      inferred_stack,
      known_incidents,
    });
  };

  // ============================================================
  // HANDLERS CON HISTORY
  // ============================================================
  // HANDLERS CON HISTORY
  // ============================================================

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
      
      const result = extractJsonObject(response);
      if (result) {
        const normalizedResult = {
          ...result,
          reasoning_summary: result.reasoning_summary || result.operational_reasoning || (
            result.root_cause
              ? `SysAI prioritizes this diagnosis because the root cause is supported by the extracted evidence and the recommended first action is designed to validate the issue before making changes.`
              : ""
          ),
          decision_factors: result.decision_factors || [
            ...(Array.isArray(result.evidence) ? result.evidence.slice(0, 3) : []),
            result.confidence ? `Confidence level: ${result.confidence}` : null,
          ].filter(Boolean),
          why_first_action: result.why_first_action || result.why_this_action || (
            result.next_best_action
              ? `The first action is prioritized because it is the safest initial validation step before remediation.`
              : ""
          ),
        };
        learnFromOperationalResult(normalizedResult, "Log Analyzer incident");
        showToast("Analisi completata!", "success");

        history.addEntry({
          tool: 'logAnalyzer',
          toolName: t.modes.logAnalyzer.name,
          toolIcon: t.modes.logAnalyzer.icon,
          input: logText,
          output: normalizedResult,
          provider: defaultProvider,
          model: model,
        });

        return normalizedResult;
      }
      return { severity: "INFO", title: "Analisi", explanation: response, fix: "N/A" };
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
      
      const result = extractJsonObject(response);
      if (result) {
        learnFromOperationalResult(result, "Troubleshooter incident");
        showToast("Comando generato!", "success");
        history.addEntry({
          tool: 'commandCrafter',
          toolName: t.modes.commandCrafter.name,
          toolIcon: t.modes.commandCrafter.icon,
          input: cmdText,
          output: result,
          provider: defaultProvider,
          model: model,
        });
        return result;
      }
      return { command: response, explanation: "Comando generato" };
    } catch (error) {
      showToast(`Errore: ${error.message}`, "error");
      return null;
    }
  };

  const handleExplain = async (command) => {
    const apiKey = apiKeys[defaultProvider];
    const provider = AI_PROVIDERS.find(p => p.id === defaultProvider);
    if (provider?.requiresApiKey && !apiKey) {
      showToast(`Inserisci API Key per ${provider.name}`, "error");
      setPage("settings");
      return null;
    }
    
    try {
      const prompt = buildExplainPrompt(command, systemProfile, lang);
      const model = getCurrentModel();
      const response = await callAI(defaultProvider, apiKey, prompt, model);
      
      const result = extractJsonObject(response);
      if (result) {
        showToast("Spiegazione completata!", "success");
        history.addEntry({
          tool: 'explainMode',
          toolName: t.modes.explainMode.name,
          toolIcon: t.modes.explainMode.icon,
          input: command,
          output: result,
          provider: defaultProvider,
          model: model,
        });
        return result;
      }
      return { summary: response, lines: [], risks: null, improvements: null };
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
      const prompt = buildConfigPrompt(description, configType, systemProfile, lang);
      const model = getCurrentModel();
      const response = await callAI(defaultProvider, apiKey, prompt, model);
      
      const result = extractJsonObject(response);
      if (result) {
        showToast("Configurazione generata!", "success");
        history.addEntry({
          tool: 'configGenerator',
          toolName: t.modes.configGenerator.name,
          toolIcon: t.modes.configGenerator.icon,
          input: `[${configType}] ${description}`,
          output: result,
          provider: defaultProvider,
          model: model,
        });
        return result;
      }
      return { filename: "config.conf", config: response, explanation: "Configurazione generata" };
    } catch (error) {
      showToast(`Errore: ${error.message}`, "error");
      return null;
    }
  };

  const handleTroubleshoot = async (problem, previousSteps = []) => {
    const apiKey = apiKeys[defaultProvider];
    const provider = AI_PROVIDERS.find(p => p.id === defaultProvider);
    if (provider?.requiresApiKey && !apiKey) {
      showToast(`Inserisci API Key per ${provider.name}`, "error");
      setPage("settings");
      return null;
    }
    
    try {
      const prompt = buildTroubleshootPrompt(problem, previousSteps, systemProfile, lang);
      const model = getCurrentModel();
      const response = await callAI(defaultProvider, apiKey, prompt, model);
      
      const result = extractJsonObject(response);
      if (result) {
        showToast("Diagnosi completata!", "success");
        history.addEntry({
          tool: 'troubleshooter',
          toolName: t.modes.troubleshooter.name,
          toolIcon: t.modes.troubleshooter.icon,
          input: problem,
          output: result,
          provider: defaultProvider,
          model: model,
        });
        return result;
      }
      return null;
    } catch (error) {
      showToast(`Errore: ${error.message}`, "error");
      return null;
    }
  };

  const handleGenerateScript = async (scriptType, description) => {
    const apiKey = apiKeys[defaultProvider];
    const provider = AI_PROVIDERS.find(p => p.id === defaultProvider);
    if (provider?.requiresApiKey && !apiKey) {
      showToast(`Inserisci API Key per ${provider.name}`, "error");
      setPage("settings");
      return null;
    }
    
    try {
      const prompt = buildScriptPrompt(description, scriptType, systemProfile, lang);
      const model = getCurrentModel();
      const response = await callAI(defaultProvider, apiKey, prompt, model);
      
      const parsedScript = extractJsonObject(response);
      if (parsedScript?.script) {
        const result = {
          filename: parsedScript.filename || `script.${scriptType === 'python' ? 'py' : scriptType === 'powershell' ? 'ps1' : scriptType === 'nodejs' ? 'js' : 'sh'}`,
          script: parsedScript.script,
          usage: parsedScript.usage || "",
          dependencies: parsedScript.dependencies || "",
          severity: parsedScript.severity || parsedScript.risk_level || "MEDIUM",
          confidence: parsedScript.confidence || "MEDIUM",
          requires_sudo: Boolean(parsedScript.requires_sudo),
          destructive: Boolean(parsedScript.destructive),
          detected_stack: parsedScript.detected_stack || [],
          next_best_action: parsedScript.next_best_action || "",
          verification_commands: parsedScript.verification_commands || [],
          rollback_commands: parsedScript.rollback_commands || [],
          verification: parsedScript.verification || "",
          rollback: parsedScript.rollback || "",
          safety_notes: parsedScript.safety_notes || "",
          assumptions: parsedScript.assumptions || [],
        };

        showToast("Script generato!", "success");
        history.addEntry({
          tool: 'scriptBuilder',
          toolName: t.modes.scriptBuilder.name,
          toolIcon: t.modes.scriptBuilder.icon,
          input: `[${scriptType}] ${description}`,
          output: result,
          provider: defaultProvider,
          model: model,
        });
        return result;
      }

      // Fallback: show raw response only if JSON extraction failed.
      let result = {
        filename: `script.${scriptType === 'python' ? 'py' : scriptType === 'powershell' ? 'ps1' : scriptType === 'nodejs' ? 'js' : 'sh'}`,
        script: response.length > 2000 ? response.substring(0, 2000) + "\n# ... (script truncated)" : response,
        usage: "",
        dependencies: ""
      };

      showToast("Script generato (formato semplice)!", "success");
      history.addEntry({
        tool: 'scriptBuilder',
        toolName: t.modes.scriptBuilder.name,
        toolIcon: t.modes.scriptBuilder.icon,
        input: `[${scriptType}] ${description}`,
        output: result,
        provider: defaultProvider,
        model: model,
      });
      return result;
    } catch (error) {
      showToast(`Errore: ${error.message}`, "error");
      return null;
    }
  };

  const handleSecurityAudit = async (inputType, sourceText) => {
    const apiKey = apiKeys[defaultProvider];
    const provider = AI_PROVIDERS.find(p => p.id === defaultProvider);
    if (provider?.requiresApiKey && !apiKey) {
      showToast(`Inserisci API Key per ${provider.name}`, "error");
      setPage("settings");
      return null;
    }
    
    try {
      const prompt = buildSecurityAuditPrompt(sourceText, inputType, null, systemProfile, lang);
      const model = getCurrentModel();
      const response = await callAI(defaultProvider, apiKey, prompt, model);
      
      const result = extractJsonObject(response);
      if (result) {
        showToast("Analisi sicurezza completata!", "success");
        history.addEntry({
          tool: 'securityAuditor',
          toolName: t.modes.securityAuditor.name,
          toolIcon: t.modes.securityAuditor.icon,
          input: sourceText,
          output: result,
          provider: defaultProvider,
          model: model,
        });
        return result;
      }
      return { report: response, recommendations: "Verifica manuale consigliata" };
    } catch (error) {
      showToast(`Errore: ${error.message}`, "error");
      return null;
    }
  };

  const handleSecurityScan = async (targetHost, scanType, scanOutput) => {
    const apiKey = apiKeys[defaultProvider];
    const provider = AI_PROVIDERS.find(p => p.id === defaultProvider);
    if (provider?.requiresApiKey && !apiKey) {
      showToast(`Inserisci API Key per ${provider.name}`, "error");
      setPage("settings");
      return null;
    }
    
    try {
      const prompt = buildSecurityScanAnalysisPrompt(targetHost, scanType, scanOutput, systemProfile, lang);
      const model = getCurrentModel();
      const response = await callAI(defaultProvider, apiKey, prompt, model);
      
      const result = extractJsonObject(response);
      if (result) {
        showToast("Analisi scan completata!", "success");
        history.addEntry({
          tool: 'securityAuditor',
          toolName: t.modes.securityAuditor.name,
          toolIcon: t.modes.securityAuditor.icon,
          input: `[${scanType}] ${targetHost}`,
          output: result,
          provider: defaultProvider,
          model: model,
        });
        return result;
      }
      return { report: response, recommendations: "Verifica manuale consigliata" };
    } catch (error) {
      showToast(`Errore: ${error.message}`, "error");
      return null;
    }
  };

  // ============================================================
  // NAVIGATION & SETTINGS
  // ============================================================

  const navigateTo = (p, modeKey) => {
    // Controllo licenza per tool PRO (che non siano FREE)
    if (modeKey && !FREE_MODES.includes(modeKey)) {
      if (!license.isPro) {
        setShowProGate(true);
        return;
      }
    }
    setPage(p);
    setSidebarOpen(false);
  };

  const saveSettings = async () => {
    try {
      const serializedApiKeys = JSON.stringify(apiKeys);
      if (window.electron?.secureStore) {
        const saved = await window.electron.secureStore.set("sysai_api_keys", serializedApiKeys);
        if (!saved?.success) throw new Error(saved?.error || "Secure storage unavailable");
        localStorage.removeItem("sysai_api_keys");
      } else {
        // Browser/dev fallback only. Electron builds use encrypted safeStorage.
        localStorage.setItem("sysai_api_keys", serializedApiKeys);
      }

      localStorage.setItem("sysai_selected_models", JSON.stringify(selectedModels));
      localStorage.setItem("sysai_default_provider", defaultProvider);
      localStorage.setItem("sysai_system_profile", systemProfile);
      localStorage.setItem("sysai_lang", lang);
      localStorage.setItem("sysai_theme", theme);
      showToast("Impostazioni salvate!", "success");
    } catch (error) {
      showToast(`Errore salvataggio impostazioni: ${error.message}`, "error");
    }
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

  const updateAvailable = Boolean(updateInfo?.updateAvailable);
  const updateStatusText = updateAvailable ? "Update available" : "Up to date";
  const updateStatusColor = updateAvailable ? "#F59E0B" : "#22C55E";
  const productSubtitle = lang === "it"
    ? "AI toolkit locale per sicurezza, infrastruttura e operations"
    : "Local-first AI toolkit for security, infrastructure and operations";

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div
      className="sysai-shell"
      style={{
        fontFamily: "'Outfit', sans-serif",
        background: bg,
        color: text1,
        minHeight: "100vh",
      }}
    >
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
      <QuickModelSwitcher
        open={quickSwitcherOpen}
        onClose={() => setQuickSwitcherOpen(false)}
        providers={AI_PROVIDERS}
        defaultProvider={defaultProvider}
        selectedModels={selectedModels}
        availableModels={availableModels}
        loadingModels={loadingModels}
        onSetDefaultProvider={setDefaultProvider}
        onSetSelectedModel={(providerId, modelId) =>
          setSelectedModels((prev) => ({
            ...prev,
            [providerId]: modelId,
          }))
        }
        onOpenSettings={() => {
          setQuickSwitcherOpen(false);
          setPage("settings");
        }}
      />  

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={(nextPage) => setPage(nextPage)}
        t={t}
      />

      <nav className="sysai-topbar" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 22px", background: "rgba(19, 23, 32, 0.82)", borderBottom: `1px solid ${border}`,
        position: "sticky", top: 0, zIndex: 100,
        backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="sysai-icon-button" style={{
            background: "rgba(255,255,255,0.03)", border: `1px solid ${border}`, borderRadius: 12,
            color: text2, cursor: "pointer", fontSize: 20, width: 40, height: 40,
          }}>☰</button>
          <div style={{ display: "flex", alignItems: "center", gap: 11, cursor: "pointer" }} onClick={() => setPage("home")}>
            <div className="sysai-logo-mark" style={{
              width: 38, height: 38, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
              background: `linear-gradient(135deg, ${accent}, #00A888)`,
              fontWeight: 800, fontSize: 15, color: "#081018",
              boxShadow: `0 0 0 1px ${accent}44, 0 14px 32px ${accent}22`,
            }}>S</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 19, letterSpacing: "-0.03em" }}>Sys<span style={{ color: accent }}>AI</span></div>
              <div style={{ fontSize: 11, color: text2, marginTop: -1 }}>{productSubtitle}</div>
            </div>
          </div>
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            className="sysai-status-widget"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 3,
              background: "linear-gradient(135deg, rgba(0,212,170,0.14), rgba(255,255,255,0.035))",
              border: `1px solid ${accent}26`,
              padding: "7px 13px",
              borderRadius: 16,
              cursor: "pointer",
              minWidth: 215,
            }}
            onClick={() => setQuickSwitcherOpen(true)}
          >
            <div style={{
              display: "flex", alignItems: "center", gap: 7,
              fontSize: 11, fontWeight: 700, color: accent, width: "100%",
            }}>
              <span style={{ opacity: .95 }}>🤖</span>
              <span>{getCurrentProvider()}</span>
              <span style={{ opacity: 0.4 }}>•</span>
              <span style={{
                maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                color: text1, opacity: .9,
              }}>
                {getCurrentModel().split('-').slice(0, 3).join('-')}
              </span>
            </div>

            <div style={{
              display: "flex", alignItems: "center", gap: 7,
              fontSize: 10, color: text2, fontWeight: 700,
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: 999,
                background: updateStatusColor,
                boxShadow: `0 0 14px ${updateStatusColor}88`,
              }} />
              <span style={{ color: text2 }}>v{appVersion || "..."}</span>
              <span style={{ opacity: .35 }}>•</span>
              <span style={{ color: updateStatusColor }}>{updateStatusText}</span>
            </div>
          </div>
          <div className="sysai-license-badge" style={{
            padding: "6px 11px", borderRadius: 999, fontSize: 11, fontWeight: 800,
            background: license.isPro ? '#00D4AA22' : '#FF4D6A15',
            color: license.isPro ? '#00D4AA' : '#FF4D6A',
            letterSpacing: '0.08em', border: `1px solid ${license.isPro ? '#00D4AA33' : '#FF4D6A25'}`,
          }}>
            {license.loading ? '...' : license.isPro ? (license.isBeta ? 'BETA' : 'PRO') : 'FREE'}
          </div>
          <button onClick={() => setPage("settings")} className="sysai-icon-button" style={{
            background: "rgba(255,255,255,0.03)", border: `1px solid ${border}`, borderRadius: 12,
            color: text2, cursor: "pointer", padding: "8px 11px", fontSize: 16,
          }}>⚙</button>
        </div>
      </nav>

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
                  <div style={{ fontSize: 11, color: updateInfo?.updateAvailable ? "#f59e0b" : "#22c55e" }}>v{appVersion || "..."} • {updateInfo?.updateAvailable ? "Update available" : "Up to date"}</div>
                </div>
              </div>
            </div>
            <div style={{ flex: 1, padding: "12px 8px" }}>
              {[
                { icon: "🏠", label: t.home, key: "home" },
                { icon: "📜", label: `${t.history}${history.count > 0 ? ` (${history.count})` : ''}`, key: "history" },
                { icon: "⭐", label: t.favorites, key: "favorites" },
                { icon: "🧠", label: "Operational Context", key: "operationalContext" },
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
            {!license.isPro && (
              <div style={{ padding: "16px", borderTop: `1px solid ${border}` }}>
                <div style={{
                  background: `linear-gradient(135deg, ${accent}15, ${accent}08)`,
                  border: `1px solid ${accent}33`, borderRadius: 12, padding: 16,
                }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{t.upgradePro}</div>
                  <div style={{ fontSize: 12, color: text2, marginTop: 4 }}>{t.proDesc}</div>
                  <button onClick={() => setShowProGate(true)} style={{
                    width: "100%", marginTop: 12, padding: "8px 0", background: accent, color: "#0B0E14",
                    border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer",
                  }}>{t.getStarted}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showProBanner && (
        <div style={{
          position: "fixed", top: 70, left: "50%", transform: "translateX(-50%)", zIndex: 500,
          background: surface, border: `1px solid ${accent}44`, borderRadius: 12, padding: "12px 20px",
        }}>
          <span>{t.proDesc}</span>
          <button style={{ marginLeft: 12, background: accent, border: "none", borderRadius: 6, padding: "4px 12px", cursor: "pointer" }}>{t.upgradePro}</button>
        </div>
      )}


      {updateInfo?.updateAvailable && (
        <div style={{
          position: "sticky", top: 57, zIndex: 90,
          background: "linear-gradient(135deg, #00D4AA20, #1A1F2E)",
          borderBottom: `1px solid ${accent}33`,
          padding: "10px 20px",
        }}>
          <div style={{
            maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 12, flexWrap: "wrap",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
              <span style={{ fontSize: 18 }}>⬆️</span>
              <div>
                <strong style={{ color: accent }}>New SysAI version available</strong>
                <span style={{ color: text2 }}> — v{updateInfo.latestVersion}</span>
                {updateInfo.prerelease && (
                  <span style={{
                    marginLeft: 8, padding: "2px 6px", borderRadius: 6,
                    background: "#FFB02022", color: "#FFB020", fontSize: 10, fontWeight: 700,
                  }}>BETA</span>
                )}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={openReleasePage} style={{
                background: accent, color: "#0B0E14", border: "none", borderRadius: 8,
                padding: "7px 12px", fontWeight: 700, cursor: "pointer", fontSize: 12,
              }}>
                View release
              </button>
              <button onClick={dismissUpdate} style={{
                background: "transparent", color: text2, border: `1px solid ${border}`, borderRadius: 8,
                padding: "7px 10px", cursor: "pointer", fontSize: 12,
              }}>
                Ignore
              </button>
            </div>
          </div>
        </div>
      )}

      <main style={{ padding: "34px 22px 48px", maxWidth: 1280, margin: "0 auto", width: "100%", position: "relative" }}>
        {page === "home" && (
          <div className="sysai-home">
            <div className="sysai-hero" style={{ textAlign: "center", marginBottom: 30, position: "relative" }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "7px 12px", borderRadius: 999,
                background: `linear-gradient(135deg, ${accent}18, rgba(255,255,255,0.035))`,
                border: `1px solid ${accent}24`, color: accent,
                fontSize: 12, fontWeight: 800, marginBottom: 16,
              }}>
                <span style={{ width: 7, height: 7, borderRadius: 999, background: accent, boxShadow: `0 0 18px ${accent}` }} />
                {lang === "it" ? "Operational AI workspace" : "Operational AI workspace"}
              </div>
              <h1 style={{
                fontSize: 42, lineHeight: 1.05, fontWeight: 850, letterSpacing: "-0.055em",
                margin: "0 auto 12px", maxWidth: 760,
              }}>{t.tagline}</h1>
              <p style={{ color: text2, fontSize: 15, lineHeight: 1.65, maxWidth: 620, margin: "0 auto" }}>
                {lang === "it"
                  ? "Diagnosi strutturate, fix sicuri, rollback e verifiche per Linux, security e infrastruttura self-hosted."
                  : "Structured diagnostics, safe fixes, rollback and verification for Linux, security and self-hosted infrastructure."}
              </p>
            </div>

            <div className="sysai-search-shell" style={{
              display: "flex", alignItems: "center", gap: 12,
              width: "100%", maxWidth: 760, margin: "0 auto 28px",
              padding: "12px 16px", borderRadius: 18,
              background: "linear-gradient(135deg, rgba(255,255,255,0.055), rgba(255,255,255,0.025))",
              border: `1px solid ${border}`,
              boxShadow: "0 24px 70px rgba(0,0,0,.20)",
            }}>
              <span style={{ color: accent, fontSize: 18 }}>⌕</span>
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchText.trim()) {
                    setHistoryInitialQuery(searchText.trim());
                    setPage("history");
                  }
                }}
                placeholder={t.historySearchPlaceholder}
                style={{
                  width: "100%", padding: "4px 0", borderRadius: 12,
                  background: "transparent", border: "none", outline: "none", color: text1,
                  fontSize: 14,
                }}
              />
              

              <button
                onClick={() => setCommandPaletteOpen(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 10px",
                  borderRadius: 10,
                  border: `1px solid ${border}`,
                  background: "rgba(255,255,255,0.03)",
                  color: text2,
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                ⌘ Palette
              </button>

              <span style={{
                padding: "4px 8px", borderRadius: 8, border: `1px solid ${border}`,
                color: text2, fontSize: 10, fontWeight: 800,
              }}>TOOLS</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 18 }}>
              {(!searchText || "operational context memory".includes(searchText.toLowerCase())) && (
                <ModeCard
                  mode={{
                    icon: "🧠",
                    name: "Operational Context",
                    description: "Local memory for infrastructure profiles, preferences and operational notes."
                  }}
                  isFree={true}
                  accent={accent}
                  accentDim={accentDim}
                  surface={surface}
                  border={border}
                  text2={text2}
                  text1={text1}
                  onClick={() => setPage("operationalContext")}
                />
              )}
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
                    text1={text1}
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

        {page === "scriptBuilder" && (
          <ScriptBuilder t={t} onGenerate={handleGenerateScript} onBack={() => setPage("home")} />
        )}

        {page === "explainMode" && (
          <ExplainMode t={t} onExplain={handleExplain} onBack={() => setPage("home")} />
        )}

        {page === "securityAuditor" && (
          <SecurityAuditor 
            t={t} 
            onAudit={handleSecurityAudit} 
            onScan={handleSecurityScan} 
            onLocalResult={({ scanType, input, output }) => {
              history.addEntry({
                tool: "securityAuditor",
                toolName: t.modes.securityAuditor.name,
                toolIcon: t.modes.securityAuditor.icon,
                input,
                output,
                provider: "local",
                model: scanType,
              });
            }}
            onBack={() => setPage("home")} 
          />
        )}

        {page === "csrGenerator" && (
          <CsrGenerator t={t} onBack={() => setPage("home")} />
        )}

        {page === "operationalContext" && (
          <OperationalContextPanel />
        )}

        {page === "settings" && (
          <Settings
            t={t}
            lang={lang}
            license={license}
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

        {page === "history" && (
          <History
            entries={history.entries}
            initialQuery={historyInitialQuery}
            onSearch={history.searchEntries}
            onToggleFavorite={history.toggleFavorite}
            onDelete={history.deleteEntry}
            onClearAll={history.clearAll}
            onBack={() => setPage("home")}
            accent={accent}
            accentDim={accentDim}
            surface={surface}
            surface2={surface2}
            border={border}
            bg={bg}
            text1={text1}
            text2={text2}
          />
        )}

        {page === "favorites" && (
          <History
            entries={history.entries}
            onSearch={history.searchEntries}
            onToggleFavorite={history.toggleFavorite}
            onDelete={history.deleteEntry}
            onClearAll={history.clearAll}
            onBack={() => setPage("home")}
            accent={accent}
            accentDim={accentDim}
            surface={surface}
            surface2={surface2}
            border={border}
            bg={bg}
            text1={text1}
            text2={text2}
            showFavoritesOnly={true}
          />
        )}

        {page === "snippets" && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 48 }}>📎</div>
            <h2>Coming soon</h2>
            <p style={{ color: text2 }}>Snippet library will be available in a future update.</p>
          </div>
        )}

        {/* ProGate Modal */}
        <ProGate
          show={showProGate}
          onClose={() => setShowProGate(false)}
          onGoToSettings={() => {
            setShowProGate(false);
            setPage('settings');
          }}
          lang={lang}
        />
      </main>
    </div>
  );
}

export default App;
