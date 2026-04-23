// Provider AI disponibili
export const AI_PROVIDERS = [
  { id: "gemini", name: "Google Gemini", color: "#4285F4", icon: "◆", requiresApiKey: true, defaultModel: "gemini-2.0-flash-exp" },
  { id: "openai", name: "OpenAI GPT", color: "#10A37F", icon: "◉", requiresApiKey: true, defaultModel: "gpt-4o-mini" },
  { id: "claude", name: "Anthropic Claude", color: "#D97706", icon: "◈", requiresApiKey: true, defaultModel: "claude-3-5-haiku-20241022" },
  { id: "deepseek", name: "DeepSeek", color: "#5B6CF0", icon: "◎", requiresApiKey: true, defaultModel: "deepseek-chat" },
  { id: "mistral", name: "Mistral AI", color: "#F97316", icon: "◇", requiresApiKey: true, defaultModel: "mistral-tiny" },
  { id: "ollama", name: "Ollama (Locale)", color: "#6B7280", icon: "○", requiresApiKey: false, defaultModel: "llama3.2" },
];

// Funzione principale per chiamare qualsiasi AI via proxy
export const callAI = async (providerId, apiKey, prompt, model) => {
  const provider = AI_PROVIDERS.find(p => p.id === providerId);
  if (!provider) throw new Error(`Provider ${providerId} non trovato`);
  if (provider.requiresApiKey && !apiKey) throw new Error(`API Key mancante per ${provider.name}`);

  const response = await fetch(`http://localhost:3001/api/${providerId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey: apiKey || '',
      model: model || provider.defaultModel,
      prompt: prompt
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Errore chiamata API');
  return data.text;
};

// Prompt per analisi log
export const buildLogAnalysisPrompt = (logText, service, systemProfile, lang) => {
  const languageMap = { it: "italiano", fr: "français", de: "deutsch", es: "español", en: "english" };
  const targetLang = languageMap[lang] || "english";
  
  return `Sei un esperto sysadmin Linux. Analizza il seguente log e rispondi SOLO in ${targetLang}.

CONTESTO SISTEMA: ${systemProfile || "Non specificato"}
SERVIZIO: ${service}

LOG DA ANALIZZARE:
${logText}

Rispondi STRETTAMENTE con questo formato JSON (nessun altro testo prima o dopo):
{
  "severity": "LOW|MEDIUM|HIGH|CRITICAL",
  "title": "Breve titolo del problema",
  "explanation": "Spiegazione dettagliata del problema e causa root",
  "fix": "Comandi Linux per risolvere il problema (uno per riga)"
}`;
};

// Prompt per generare comandi
export const buildCommandPrompt = (description, systemProfile, lang) => {
  const languageMap = { it: "italiano", fr: "français", de: "deutsch", es: "español", en: "english" };
  const targetLang = languageMap[lang] || "english";
  
  return `Sei un esperto sysadmin Linux. Genera il comando Linux corretto per la seguente descrizione. Rispondi SOLO in ${targetLang}.

CONTESTO SISTEMA: ${systemProfile || "Non specificato"}

DESCRIZIONE: ${description}

Rispondi STRETTAMENTE con questo formato JSON (nessun altro testo prima o dopo):
{
  "command": "comando Linux esatto",
  "explanation": "Spiegazione di cosa fa il comando"
}`;
};
