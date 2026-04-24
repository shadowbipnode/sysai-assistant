import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Proxy per Gemini
app.post('/api/gemini', async (req, res) => {
  try {
    const { apiKey, model, prompt } = req.body;
    console.log(`[Gemini] Calling model: ${model}`);
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      { contents: [{ parts: [{ text: prompt }] }] },
      { headers: { 'Content-Type': 'application/json' } }
    );
    const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    res.json({ text });
  } catch (error) {
    console.error('Gemini error:', error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.error?.message || error.message });
  }
});

// Proxy per OpenAI
app.post('/api/openai', async (req, res) => {
  try {
    const { apiKey, model, prompt } = req.body;
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      { model, messages: [{ role: 'user', content: prompt }], temperature: 0.7 },
      { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
    );
    const text = response.data.choices?.[0]?.message?.content || '';
    res.json({ text });
  } catch (error) {
    console.error('OpenAI error:', error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.error?.message || error.message });
  }
});

// Proxy per Claude (Anthropic)
app.post('/api/claude', async (req, res) => {
  try {
    const { apiKey, model, prompt } = req.body;
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      { model, max_tokens: 4096, messages: [{ role: 'user', content: prompt }] },
      { headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' } }
    );
    const text = response.data.content?.[0]?.text || '';
    res.json({ text });
  } catch (error) {
    console.error('Claude error:', error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.error?.message || error.message });
  }
});

// Proxy per DeepSeek
app.post('/api/deepseek', async (req, res) => {
  try {
    const { apiKey, model, prompt } = req.body;
    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      { model: model || 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 0.7 },
      { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
    );
    const text = response.data.choices?.[0]?.message?.content || '';
    res.json({ text });
  } catch (error) {
    console.error('DeepSeek error:', error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.error?.message || error.message });
  }
});

// Proxy per Mistral
app.post('/api/mistral', async (req, res) => {
  try {
    const { apiKey, model, prompt } = req.body;
    const response = await axios.post(
      'https://api.mistral.ai/v1/chat/completions',
      { model: model || 'mistral-tiny', messages: [{ role: 'user', content: prompt }], temperature: 0.7 },
      { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
    );
    const text = response.data.choices?.[0]?.message?.content || '';
    res.json({ text });
  } catch (error) {
    console.error('Mistral error:', error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.error?.message || error.message });
  }
});

// Proxy per Ollama
app.post('/api/ollama', async (req, res) => {
  try {
    const { model, prompt, baseURL = 'http://localhost:11434' } = req.body;
    const response = await axios.post(
      `${baseURL}/api/generate`,
      { model, prompt, stream: false },
      { headers: { 'Content-Type': 'application/json' } }
    );
    const text = response.data.response || '';
    res.json({ text });
  } catch (error) {
    console.error('Ollama error:', error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
});

// ssh-audit
app.post('/api/ssh-audit', async (req, res) => {
  const { host, port = 22 } = req.body;
  
  const safeHost = host.replace(/[^a-zA-Z0-9.-]/g, '');
  const safePort = String(port).replace(/[^0-9]/g, '');
  
  const sshAuditPath = join(__dirname, 'bin', 'ssh-audit');
  const command = `${sshAuditPath} -p ${safePort} ${safeHost}`;
  
  exec(command, { timeout: 30000 }, (error, stdout, stderr) => {
    // ssh-audit restituisce exit code 3 quando trova vulnerabilità
    // Non è un vero errore, restituiamo l'output comunque
    res.json({ output: stdout || stderr });
  });
});
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Proxy server running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
});
