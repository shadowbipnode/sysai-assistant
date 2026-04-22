import { GoogleGenerativeAI } from "@google/generative-ai";

// Funzione per ottenere i modelli di Gemini (via API)
export const fetchGeminiModels = async (apiKey) => {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Gemini non ha un endpoint list_models nel SDK browser, ma possiamo usare fetch diretto
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    const data = await response.json();
    if (data.models) {
      return data.models
        .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
        .map(m => ({
          id: m.name.replace('models/', ''),
          name: m.displayName || m.name.replace('models/', '')
        }));
    }
    return [];
  } catch (error) {
    console.error("Errore fetch modelli Gemini:", error);
    return [];
  }
};

// Funzione per ottenere i modelli di OpenAI
export const fetchOpenAIModels = async (apiKey) => {
  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: { "Authorization": `Bearer ${apiKey}` }
    });
    const data = await response.json();
    if (data.data) {
      return data.data
        .filter(m => m.id.includes('gpt'))
        .map(m => ({ id: m.id, name: m.id }));
    }
    return [];
  } catch (error) {
    console.error("Errore fetch modelli OpenAI:", error);
    return [];
  }
};

// Funzione per ottenere i modelli di DeepSeek
export const fetchDeepSeekModels = async (apiKey) => {
  // DeepSeek ha solo pochi modelli, non c'è endpoint list
  return [
    { id: "deepseek-chat", name: "DeepSeek Chat" },
    { id: "deepseek-coder", name: "DeepSeek Coder" },
  ];
};

// Funzione per ottenere i modelli di Mistral
export const fetchMistralModels = async (apiKey) => {
  try {
    const response = await fetch("https://api.mistral.ai/v1/models", {
      headers: { "Authorization": `Bearer ${apiKey}` }
    });
    const data = await response.json();
    if (data.data) {
      return data.data.map(m => ({ id: m.id, name: m.name }));
    }
    return [];
  } catch (error) {
    console.error("Errore fetch modelli Mistral:", error);
    return [];
  }
};

// Funzione per ottenere i modelli di Claude
export const fetchClaudeModels = async (apiKey) => {
  // Anthropic ha endpoint per listare modelli
  try {
    const response = await fetch("https://api.anthropic.com/v1/models", {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      }
    });
    const data = await response.json();
    if (data.data) {
      return data.data.map(m => ({ id: m.id, name: m.display_name || m.id }));
    }
    return [];
  } catch (error) {
    console.error("Errore fetch modelli Claude:", error);
    return [];
  }
};

// Funzione per ottenere i modelli di Ollama (locale)
export const fetchOllamaModels = async (baseURL = "http://localhost:11434") => {
  try {
    const response = await fetch(`${baseURL}/api/tags`);
    const data = await response.json();
    if (data.models) {
      return data.models.map(m => ({ id: m.name, name: m.name }));
    }
    return [];
  } catch (error) {
    console.error("Errore fetch modelli Ollama (assicurati che Ollama sia in esecuzione):", error);
    return [];
  }
};

// Funzione generica per fetch modelli in base al provider
export const fetchModelsForProvider = async (providerId, apiKey) => {
  switch (providerId) {
    case "gemini":
      return await fetchGeminiModels(apiKey);
    case "openai":
      return await fetchOpenAIModels(apiKey);
    case "deepseek":
      return await fetchDeepSeekModels(apiKey);
    case "mistral":
      return await fetchMistralModels(apiKey);
    case "claude":
      return await fetchClaudeModels(apiKey);
    case "ollama":
      return await fetchOllamaModels();
    default:
      return [];
  }
};
