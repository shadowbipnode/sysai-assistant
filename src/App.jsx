import { useState } from "react";
import LANGS, { FREE_MODES } from "./i18n";

function App() {
  const [lang, setLang] = useState("en");
  const [theme, setTheme] = useState("dark");
  const [page, setPage] = useState("home");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState({});
  const [showResult, setShowResult] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logText, setLogText] = useState("");
  const [cmdText, setCmdText] = useState("");
  const [selectedService, setSelectedService] = useState(0);
  const [showProBanner, setShowProBanner] = useState(false);
  const [searchText, setSearchText] = useState("");

  const t = LANGS[lang] || LANGS.en;

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAnalyze = () => {
    setAnalyzing(true);
    setShowResult(false);
    setTimeout(() => {
      setAnalyzing(false);
      setShowResult(true);
    }, 1800);
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
            <span style={{ fontWeight: 700, fontSize: 18 }}>
              Sys<span style={{ color: accent }}>AI</span>
            </span>
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

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex" }}>
          <div onClick={() => setSidebarOpen(false)} style={{
            position: "absolute", inset: 0, background: "#00000066",
          }} />
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
        {/* HOME */}
        {page === "home" && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
                {t.tagline}
              </h1>
              <p style={{ color: text2, fontSize: 14 }}>
                {lang === "it" ? "Scegli uno strumento per iniziare" : "Choose a tool to get started"}
              </p>
            </div>

            {/* Search */}
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

            {/* Mode Cards Grid */}
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

            {/* Service Selector */}
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

            {/* Log Input */}
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

            <button onClick={handleAnalyze} style={{
              marginTop: 12, padding: "12px 28px", background: accent, color: "#0B0E14",
              border: "none", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer",
            }}>
              {analyzing ? t.logAnalyzerPage.analyzing : t.logAnalyzerPage.analyze}
            </button>

            {/* Result Demo */}
            {showResult && (
              <div style={{ marginTop: 24 }}>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px",
                  borderRadius: 8, background: `${danger}15`, marginBottom: 16,
                }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: danger }} />
                  <span style={{ color: danger, fontWeight: 700, fontSize: 13 }}>HIGH</span>
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>SSH Brute Force Attack Detected</h3>
                <div style={{
                  background: surface, border: `1px solid ${border}`, borderRadius: 12,
                  padding: 20, marginBottom: 16,
                }}>
                  <p style={{ fontSize: 14, color: text2 }}>Multiple failed SSH login attempts for root user from external IP. This is a brute-force attack pattern.</p>
                </div>
                <div style={{
                  background: surface, border: `1px solid ${accent}33`, borderRadius: 12,
                  overflow: "hidden",
                }}>
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 16px", background: accentDim,
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: accent }}>FIX</span>
                    <button onClick={() => handleCopy("sudo ufw deny from 203.0.113.42")} style={{
                      background: "none", border: `1px solid ${accent}44`, borderRadius: 6,
                      color: accent, padding: "4px 12px", fontSize: 11, cursor: "pointer",
                    }}>{copied ? "✓ Copied!" : "📋 Copy"}</button>
                  </div>
                  <pre style={{
                    padding: 20, fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
                    color: text1, whiteSpace: "pre-wrap",
                  }}>sudo ufw deny from 203.0.113.42
sudo sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart sshd</pre>
                </div>
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
              <button onClick={handleAnalyze} style={{
                padding: "12px 24px", background: accent, color: "#0B0E14",
                border: "none", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer",
              }}>
                {analyzing ? t.commandCrafterPage.crafting : t.commandCrafterPage.craft}
              </button>
            </div>

            {showResult && (
              <div style={{ marginTop: 24 }}>
                <div style={{
                  background: surface, border: `1px solid ${accent}33`, borderRadius: 12,
                  overflow: "hidden",
                }}>
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 16px", background: accentDim,
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: accent }}>COMMAND</span>
                    <button onClick={() => handleCopy("find / -type f -size +100M -mtime -7")} style={{
                      background: "none", border: `1px solid ${accent}44`, borderRadius: 6,
                      color: accent, padding: "4px 12px", fontSize: 11, cursor: "pointer",
                    }}>{copied ? "✓ Copied!" : "📋 Copy"}</button>
                  </div>
                  <pre style={{
                    padding: 20, fontFamily: "'JetBrains Mono', monospace", fontSize: 14,
                    color: accent, fontWeight: 600,
                  }}>find / -type f -size +100M -mtime -7</pre>
                </div>
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

            <button onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }} style={{
              padding: "12px 28px", background: accent, color: "#0B0E14",
              border: "none", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer",
            }}>
              {saved ? "✓ " + t.settingsPage.saved : t.settingsPage.save}
            </button>
          </div>
        )}

        {/* Placeholder for PRO pages */}
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
