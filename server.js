const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();

// ============================================================
// CORS SICURO - solo richieste da localhost (Electron renderer)
// ============================================================
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin.startsWith('file://') || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS: origine non consentita'));
    }
  },
  credentials: false,
}));

app.use(express.json({ limit: '10mb' }));

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// ============================================================
// HELPER: gestione errori uniforme
// ============================================================
function handleApiError(res, providerName, error) {
  const message = error.response?.data?.error?.message
    || error.response?.data?.error
    || error.message
    || 'Errore sconosciuto';
  const status = error.response?.status || 500;
  console.error(`[${providerName}] Error ${status}: ${message}`);
  res.status(status).json({ error: message, provider: providerName });
}

// ============================================================
// AI PROXY ENDPOINTS
// ============================================================

// Google Gemini
app.post('/api/gemini', async (req, res) => {
  try {
    const { apiKey, model, prompt } = req.body;
    if (!apiKey || !prompt) return res.status(400).json({ error: 'apiKey e prompt richiesti' });

    const modelName = (model || 'gemini-2.0-flash-exp').replace(/[^a-zA-Z0-9.\-]/g, '');
    console.log(`[Gemini] model: ${modelName}`);

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 16384,
          temperature: 0.7,
        }
      },
      { headers: { 'Content-Type': 'application/json' }, timeout: 120000 }
    );
    const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    res.json({ text });
  } catch (error) {
    handleApiError(res, 'Gemini', error);
  }
});

// OpenAI
app.post('/api/openai', async (req, res) => {
  try {
    const { apiKey, model, prompt } = req.body;
    if (!apiKey || !prompt) return res.status(400).json({ error: 'apiKey e prompt richiesti' });

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: model || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 16384,
      },
      {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 120000,
      }
    );
    const text = response.data.choices?.[0]?.message?.content || '';
    res.json({ text });
  } catch (error) {
    handleApiError(res, 'OpenAI', error);
  }
});

// Anthropic Claude
app.post('/api/claude', async (req, res) => {
  try {
    const { apiKey, model, prompt } = req.body;
    if (!apiKey || !prompt) return res.status(400).json({ error: 'apiKey e prompt richiesti' });

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: model || 'claude-sonnet-4-20250514',
        max_tokens: 16384,
        messages: [{ role: 'user', content: prompt }],
      },
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        timeout: 120000,
      }
    );
    const text = response.data.content?.[0]?.text || '';
    res.json({ text });
  } catch (error) {
    handleApiError(res, 'Claude', error);
  }
});

// DeepSeek
app.post('/api/deepseek', async (req, res) => {
  try {
    const { apiKey, model, prompt } = req.body;
    if (!apiKey || !prompt) return res.status(400).json({ error: 'apiKey e prompt richiesti' });

    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: model || 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 16384,
      },
      {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 120000,
      }
    );
    const text = response.data.choices?.[0]?.message?.content || '';
    res.json({ text });
  } catch (error) {
    handleApiError(res, 'DeepSeek', error);
  }
});

// Mistral
app.post('/api/mistral', async (req, res) => {
  try {
    const { apiKey, model, prompt } = req.body;
    if (!apiKey || !prompt) return res.status(400).json({ error: 'apiKey e prompt richiesti' });

    const response = await axios.post(
      'https://api.mistral.ai/v1/chat/completions',
      {
        model: model || 'mistral-small-latest',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 16384,
      },
      {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 120000,
      }
    );
    const text = response.data.choices?.[0]?.message?.content || '';
    res.json({ text });
  } catch (error) {
    handleApiError(res, 'Mistral', error);
  }
});

// Ollama (locale)
app.post('/api/ollama', async (req, res) => {
  try {
    const { model, prompt, baseURL } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt richiesto' });

    const ollamaURL = baseURL || 'http://localhost:11434';
    const response = await axios.post(
      `${ollamaURL}/api/generate`,
      {
        model: model || 'llama3.2',
        prompt,
        stream: false,
        options: {
          num_predict: 16384,
        }
      },
      { headers: { 'Content-Type': 'application/json' }, timeout: 180000 }
    );
    const text = response.data.response || '';
    res.json({ text });
  } catch (error) {
    handleApiError(res, 'Ollama', error);
  }
});

// ============================================================
// FETCH MODELS ENDPOINTS
// ============================================================
app.post('/api/models/gemini', async (req, res) => {
  try {
    const { apiKey } = req.body;
    const response = await axios.get(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { timeout: 15000 }
    );
    const models = (response.data.models || [])
      .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
      .filter(m => m.name.includes('gemini'))
      .map(m => ({ id: m.name.replace('models/', ''), name: m.displayName || m.name.replace('models/', '') }));
    res.json({ models });
  } catch (error) {
    res.json({ models: [], error: error.message });
  }
});

app.post('/api/models/openai', async (req, res) => {
  try {
    const { apiKey } = req.body;
    const response = await axios.get('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      timeout: 15000,
    });
    const models = (response.data.data || [])
      .filter(m => m.id.includes('gpt'))
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(m => ({ id: m.id, name: m.id }));
    res.json({ models });
  } catch (error) {
    res.json({ models: [], error: error.message });
  }
});

app.post('/api/models/claude', async (req, res) => {
  try {
    const { apiKey } = req.body;
    const response = await axios.get('https://api.anthropic.com/v1/models', {
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      timeout: 15000,
    });
    const models = (response.data.data || [])
      .map(m => ({ id: m.id, name: m.display_name || m.id }));
    res.json({ models });
  } catch (error) {
    res.json({ models: [], error: error.message });
  }
});

app.post('/api/models/mistral', async (req, res) => {
  try {
    const { apiKey } = req.body;
    const response = await axios.get('https://api.mistral.ai/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      timeout: 15000,
    });
    const models = (response.data.data || [])
      .map(m => ({ id: m.id, name: m.name || m.id }));
    res.json({ models });
  } catch (error) {
    res.json({ models: [], error: error.message });
  }
});

app.post('/api/models/ollama', async (req, res) => {
  try {
    const { baseURL } = req.body;
    const ollamaURL = baseURL || 'http://localhost:11434';
    const response = await axios.get(`${ollamaURL}/api/tags`, { timeout: 5000 });
    const models = (response.data.models || [])
      .map(m => ({ id: m.name, name: m.name }));
    res.json({ models });
  } catch (error) {
    res.json({ models: [], error: 'Ollama non raggiungibile. Verifica che sia in esecuzione.' });
  }
});

// ============================================================
// START SERVER
// ============================================================
const PORT = process.env.PORT || 3001;
app.listen(PORT, '127.0.0.1', () => {
  console.log(`[SysAI] Proxy server avviato su http://127.0.0.1:${PORT}`);
});
