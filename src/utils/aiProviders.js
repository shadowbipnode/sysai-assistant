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

// Prompt per generare configurazioni
export const buildConfigPrompt = (configType, description, systemProfile, lang) => {
  const languageMap = { it: "italiano", fr: "français", de: "deutsch", es: "español", en: "english" };
  const targetLang = languageMap[lang] || "english";
  
  let filename = "";
  switch(configType.toLowerCase()) {
    case "nginx": filename = "nginx.conf"; break;
    case "docker-compose": filename = "docker-compose.yml"; break;
    case "systemd service": filename = "/etc/systemd/system/myapp.service"; break;
    case "lnd (lnd.conf)": filename = "lnd.conf"; break;
    case "bitcoin (bitcoin.conf)": filename = "bitcoin.conf"; break;
    default: filename = "config.conf";
  }
  
  return `Sei un esperto sysadmin Linux. Genera un file di configurazione ${configType} professionale e commentato. Rispondi SOLO in ${targetLang}.

CONTESTO SISTEMA: ${systemProfile || "Non specificato"}

REQUISITI: ${description}

Rispondi STRETTAMENTE con questo formato JSON (nessun altro testo prima o dopo):
{
  "filename": "${filename}",
  "config": "il contenuto completo del file di configurazione con commenti in linea",
  "explanation": "spiegazione dei punti chiave della configurazione e come usarla"
}`;
};

// Prompt per troubleshooting (genera domande)
export const buildTroubleshootQuestionsPrompt = (problem, systemProfile, lang) => {
  const languageMap = { it: "italiano", fr: "français", de: "deutsch", es: "español", en: "english" };
  const targetLang = languageMap[lang] || "english";
  
  return `Sei un esperto sysadmin Linux. Fai una diagnosi guidata. Rispondi SOLO in ${targetLang}.

PROBLEMA: ${problem}
CONTESTO: ${systemProfile || "Non specificato"}

Genera 3 domande specifiche CIASCUNA con 3-4 opzioni SEMPLICI (stringhe, non oggetti).

Formato ESATTO della risposta (solo JSON, nient'altro):
{
  "questions": [
    { "text": "Prima domanda?", "options": ["Opzione A", "Opzione B", "Opzione C"] },
    { "text": "Seconda domanda?", "options": ["Opzione X", "Opzione Y", "Opzione Z"] },
    { "text": "Terza domanda?", "options": ["Opzione 1", "Opzione 2", "Opzione 3"] }
  ]
}`;
};

// Prompt per troubleshooting (genera soluzione basata sulle risposte)
export const buildTroubleshootSolutionPrompt = (problem, answers, questions, systemProfile, lang) => {
  const languageMap = { it: "italiano", fr: "français", de: "deutsch", es: "español", en: "english" };
  const targetLang = languageMap[lang] || "english";

  // Costruisce il contesto delle risposte
  let qaContext = "";
  for (let i = 0; i < questions.length; i++) {
    qaContext += `\nQ${i+1}: ${questions[i].text}\nA: ${answers[i]}\n`;
  }

  return `Sei un esperto sysadmin Linux. Basandoti sulle risposte fornite, identifica la soluzione al problema. Rispondi SOLO in ${targetLang}.

CONTESTO SISTEMA: ${systemProfile || "Non specificato"}

PROBLEMA ORIGINALE: ${problem}

DIAGNOSI:
${qaContext}

Rispondi STRETTAMENTE con questo formato JSON:
{
  "explanation": "spiegazione della causa root e dei passaggi per risolverlo",
  "fix": "comandi Linux da eseguire per risolvere (uno per riga)"
}`;
};

// Prompt per generare script
export const buildScriptPrompt = (scriptType, description, systemProfile, lang) => {
  const languageMap = { it: "italiano", fr: "français", de: "deutsch", es: "español", en: "english" };
  const targetLang = languageMap[lang] || "english";
  
  let filename = "";
  switch(scriptType.toLowerCase()) {
    case "bash": filename = "script.sh"; break;
    case "python": filename = "script.py"; break;
    case "powershell": filename = "script.ps1"; break;
    case "node.js": filename = "script.js"; break;
    default: filename = "script.sh";
  }
  
  return `Sei un esperto sysadmin Linux. Genera uno script ${scriptType} professionale, ben commentato e con error handling. Rispondi SOLO in ${targetLang}.

CONTESTO SISTEMA: ${systemProfile || "Non specificato"}

REQUISITI: ${description}

Rispondi STRETTAMENTE con questo formato JSON (nessun altro testo prima o dopo):
{
  "filename": "${filename}",
  "script": "il contenuto completo dello script con commenti in linea e error handling",
  "explanation": "spiegazione di cosa fa lo script e come eseguirlo"
}`;
};

// Prompt per security auditor
export const buildSecurityAuditPrompt = (inputType, sourceText, systemProfile, lang) => {
  const languageMap = { it: "italiano", fr: "français", de: "deutsch", es: "español", en: "english" };
  const targetLang = languageMap[lang] || "english";
  
  return `Sei un esperto di cybersecurity. Analizza la seguente configurazione o descrizione e fornisci un report di sicurezza. Rispondi SOLO in ${targetLang}.

CONTESTO SISTEMA: ${systemProfile || "Non specificato"}

TIPO INPUT: ${inputType}
CONTENUTO: ${sourceText}

Rispondi STRETTAMENTE con questo formato JSON (nessun altro testo prima o dopo):
{
  "report": "Analisi dettagliata dei problemi di sicurezza trovati, con spiegazione dei rischi",
  "recommendations": "Raccomandazioni specifiche per risolvere ogni problema, con comandi dove necessario"
}`;
};
