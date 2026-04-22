import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

// Modelli disponibili per ogni provider
export const MODELS_BY_PROVIDER = {
  gemini: [
    { id: "gemini-2.0-flash-exp", name: "Gemini 2.0 Flash (veloce, consigliato)" },
    { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro (potente)" },
    { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash" },
  ],
  openai: [
    { id: "gpt-4o", name: "GPT-4o (migliore)" },
    { id: "gpt-4o-mini", name: "GPT-4o Mini (veloce)" },
    { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo (economico)" },
  ],
  deepseek: [
    { id: "deepseek-chat", name: "DeepSeek Chat" },
    { id: "deepseek-coder", name: "DeepSeek Coder" },
  ],
  mistral: [
    { id: "mistral-large-latest", name: "Mistral Large" },
    { id: "mistral-medium-latest", name: "Mistral Medium" },
    { id: "mistral-small-latest", name: "Mistral Small" },
    { id: "mistral-tiny", name: "Mistral Tiny" },
  ],
  claude: [
    { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet (migliore)" },
    { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku (veloce)" },
    { id: "claude-3-opus-20240229", name: "Claude 3 Opus (potente)" },
  ],
  ollama: [
    { id: "llama3.2", name: "Llama 3.2" },
    { id: "llama3.1", name: "Llama 3.1" },
    { id: "mistral", name: "Mistral" },
    { id: "codellama", name: "CodeLlama" },
    { id: "phi3", name: "Phi-3" },
  ],
};

// Provider AI disponibili
export const AI_PROVIDERS = [
  { 
    id: "gemini", 
    name: "Google Gemini", 
    color: "#4285F4", 
    icon: "◆",
    requiresApiKey: true,
    defaultModel: "gemini-2.0-flash-exp",
    call: async (apiKey, prompt, model) => {
      const genAI = new GoogleGenerativeAI(apiKey);
      const genModel = genAI.getGenerativeModel({ model });
      const result = await genModel.generateContent(prompt);
      return result.response.text();
    }
  },
  { 
    id: "openai", 
    name: "OpenAI GPT", 
    color: "#10A37F", 
    icon: "◉",
    requiresApiKey: true,
    defaultModel: "gpt-4o-mini",
    call: async (apiKey, prompt, model) => {
      const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
      const completion = await openai.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
      });
      return completion.choices[0].message.content;
    }
  },
  { 
    id: "deepseek", 
    name: "DeepSeek", 
    color: "#5B6CF0", 
    icon: "◎",
    requiresApiKey: true,
    defaultModel: "deepseek-chat",
    call: async (apiKey, prompt, model) => {
      const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await response.json();
      return data.choices[0].message.content;
    }
  },
  { 
    id: "mistral", 
    name: "Mistral AI", 
    color: "#F97316", 
    icon: "◇",
    requiresApiKey: true,
    defaultModel: "mistral-tiny",
    call: async (apiKey, prompt, model) => {
      const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await response.json();
      return data.choices[0].message.content;
    }
  },
  { 
    id: "claude", 
    name: "Anthropic Claude", 
    color: "#D97706", 
    icon: "◈",
    requiresApiKey: true,
    defaultModel: "claude-3-haiku-20240307",
    call: async (apiKey, prompt, model) => {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await response.json();
      return data.content[0].text;
    }
  },
  { 
    id: "ollama", 
    name: "Ollama (Locale)", 
    color: "#6B7280", 
    icon: "○",
    requiresApiKey: false,
    defaultModel: "llama3.2",
    call: async (apiKey, prompt, model, baseURL = "http://localhost:11434") => {
      const response = await fetch(`${baseURL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt, stream: false }),
      });
      const data = await response.json();
      return data.response;
    }
  },
];

// Funzione principale per chiamare qualsiasi AI
export const callAI = async (providerId, apiKey, prompt, model) => {
  const provider = AI_PROVIDERS.find(p => p.id === providerId);
  if (!provider) throw new Error(`Provider ${providerId} non trovato`);
  
  if (provider.requiresApiKey && !apiKey) {
    throw new Error(`API Key mancante per ${provider.name}`);
  }
  
  return await provider.call(apiKey, prompt, model);
};

// Prompt per analisi log
export const buildLogAnalysisPrompt = (logText, service, systemProfile, lang) => {
  const languageMap = {
    it: "italiano", fr: "français", de: "deutsch", es: "español", en: "english"
  };
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
  const languageMap = {
    it: "italiano", fr: "français", de: "deutsch", es: "español", en: "english"
  };
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
