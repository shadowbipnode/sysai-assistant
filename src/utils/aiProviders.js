/**
 * SysAI - AI Provider Configuration & Prompt Engineering
 * 
 * Tutte le chiamate passano dal proxy locale (server.js su :3001).
 * Le API key non escono mai dal processo locale.
 */

const PROXY_BASE = 'http://127.0.0.1:3001';

// ============================================================
// PROVIDER DEFINITIONS
// ============================================================
export const AI_PROVIDERS = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    color: '#4285F4',
    icon: '◆',
    requiresApiKey: true,
    defaultModel: 'gemini-2.0-flash',
  },
  {
    id: 'openai',
    name: 'OpenAI GPT',
    color: '#10A37F',
    icon: '◉',
    requiresApiKey: true,
    defaultModel: 'gpt-4o-mini',
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    color: '#D97706',
    icon: '◈',
    requiresApiKey: true,
    defaultModel: 'claude-sonnet-4-20250514',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    color: '#5B6CF0',
    icon: '◎',
    requiresApiKey: true,
    defaultModel: 'deepseek-chat',
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    color: '#F97316',
    icon: '◇',
    requiresApiKey: true,
    defaultModel: 'mistral-small-latest',
  },
  {
    id: 'ollama',
    name: 'Ollama (Locale)',
    color: '#6B7280',
    icon: '○',
    requiresApiKey: false,
    defaultModel: 'llama3.2',
  },
];

// ============================================================
// CALL AI VIA PROXY
// ============================================================
export async function callAI(providerId, apiKey, prompt, model) {
  const provider = AI_PROVIDERS.find(p => p.id === providerId);
  if (!provider) throw new Error(`Provider "${providerId}" non trovato`);
  if (provider.requiresApiKey && !apiKey) throw new Error(`API Key mancante per ${provider.name}`);

  const body = {
    apiKey,
    model: model || provider.defaultModel,
    prompt,
  };

  const response = await fetch(`${PROXY_BASE}/api/${providerId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Errore ${response.status} da ${provider.name}`);
  }

  return data.text;
}

// ============================================================
// FETCH MODELS VIA PROXY
// ============================================================
export async function fetchModels(providerId, apiKey, baseURL) {
  try {
    const body = { apiKey, baseURL };
    const response = await fetch(`${PROXY_BASE}/api/models/${providerId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return data.models || [];
  } catch (error) {
    console.error(`Errore fetch modelli ${providerId}:`, error);
    return [];
  }
}

// ============================================================
// SYSTEM PROMPT BASE (usato da tutti i tool)
// ============================================================
function getSystemContext(systemProfile, lang) {
  const langMap = { it: 'italiano', fr: 'français', de: 'deutsch', es: 'español', en: 'english' };
  const targetLang = langMap[lang] || 'english';

  return `You are an expert Linux system administrator and security specialist.
You have 20+ years of experience with Linux servers, networking, security hardening, and troubleshooting.

LANGUAGE: Respond ONLY in ${targetLang}.
SYSTEM CONTEXT: ${systemProfile || 'Not specified - assume Ubuntu/Debian with standard services.'}

RESPONSE RULES:
- Be precise and actionable
- Always provide exact commands, not generic advice
- Include command explanations with comments
- Flag any destructive commands with warnings
- Consider the system context when giving recommendations`;
}

// ============================================================
// SPECIALIZED PROMPTS PER TOOL
// ============================================================

export function buildLogAnalysisPrompt(logText, service, systemProfile, lang) {
  const systemContext = getSystemContext(systemProfile, lang);

  return `${systemContext}

TASK: Analyze the following system log and identify issues.

SERVICE: ${service}
LOG:
\`\`\`
${logText}
\`\`\`

Respond STRICTLY with this JSON format (no other text before or after):
{
  "severity": "LOW|MEDIUM|HIGH|CRITICAL",
  "title": "Brief title of the issue found",
  "explanation": "Detailed explanation of the problem, root cause analysis, and potential impact",
  "fix": "Step-by-step fix commands (one per line, with # comments explaining each step)",
  "prevention": "How to prevent this in the future (1-2 sentences)"
}`;
}

export function buildCommandPrompt(description, systemProfile, lang) {
  const systemContext = getSystemContext(systemProfile, lang);

  return `${systemContext}

TASK: Generate the exact Linux command for this request.

REQUEST: ${description}

Respond STRICTLY with this JSON format (no other text before or after):
{
  "command": "the exact command to run",
  "explanation": "What each part of the command does, flag by flag",
  "warning": "Any risks or side effects (null if safe)",
  "alternatives": "Alternative approaches if any (null if none)"
}`;
}

export function buildExplainPrompt(commandOrScript, systemProfile, lang) {
  const systemContext = getSystemContext(systemProfile, lang);

  return `${systemContext}

TASK: Explain this command or script line by line.

INPUT:
\`\`\`
${commandOrScript}
\`\`\`

Respond STRICTLY with this JSON format (no other text before or after):
{
  "summary": "One-sentence summary of what this does",
  "lines": [
    { "line": "exact line of code", "explanation": "what this line does" }
  ],
  "risks": "Any security risks or dangerous operations (null if safe)",
  "improvements": "Suggested improvements (null if already good)"
}`;
}

export function buildConfigPrompt(description, configType, systemProfile, lang) {
  const systemContext = getSystemContext(systemProfile, lang);

  return `${systemContext}

TASK: Generate a production-ready configuration file.

CONFIG TYPE: ${configType}
REQUIREMENTS: ${description}

Respond STRICTLY with this JSON format (no other text before or after):
{
  "filename": "suggested filename (e.g., nginx.conf, docker-compose.yml)",
  "config": "the complete configuration file content",
  "explanation": "Brief explanation of key settings and why they were chosen",
  "security_notes": "Security considerations for this config"
}`;
}

export function buildTroubleshootPrompt(problem, previousSteps, systemProfile, lang) {
  const systemContext = getSystemContext(systemProfile, lang);
  const prevContext = previousSteps?.length
    ? `\nPREVIOUS DIAGNOSTIC STEPS:\n${previousSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
    : '';

  return `${systemContext}

TASK: Guide troubleshooting for this problem.
${prevContext}
PROBLEM: ${problem}

Respond STRICTLY with this JSON format (no other text before or after):
{
  "diagnosis": "Most likely cause based on the description",
  "check_command": "Command to run to verify the diagnosis",
  "expected_output": "What the output should look like if this is the cause",
  "fix": "Commands to fix the issue",
  "follow_up_question": "Question to ask if the diagnosis is wrong (null if confident)"
}`;
}

export function buildScriptPrompt(description, scriptType, systemProfile, lang) {
  const systemContext = getSystemContext(systemProfile, lang);

  return `${systemContext}

TASK: Generate a complete, production-ready script.

SCRIPT TYPE: ${scriptType || 'bash'}
REQUIREMENTS: ${description}

The script MUST include:
- Shebang line
- Error handling (set -euo pipefail for bash)
- Input validation
- Logging
- Helpful comments
- Usage information

Respond STRICTLY with this JSON format (no other text before or after):
{
  "filename": "suggested filename",
  "script": "the complete script content",
  "usage": "How to use this script",
  "dependencies": "Required packages or tools (null if none)"
}`;
}

export function buildSecurityAuditPrompt(configOrDescription, auditType, scanResults, systemProfile, lang) {
  const systemContext = getSystemContext(systemProfile, lang);
  const scanContext = scanResults ? `\nSCAN RESULTS:\n\`\`\`\n${scanResults}\n\`\`\`` : '';

  return `${systemContext}

TASK: Security audit and hardening recommendations.

AUDIT TYPE: ${auditType || 'general'}
${scanContext}
INPUT:
\`\`\`
${configOrDescription}
\`\`\`

Respond STRICTLY with this JSON format (no other text before or after):
{
  "risk_level": "LOW|MEDIUM|HIGH|CRITICAL",
  "findings": [
    { "issue": "description", "severity": "LOW|MEDIUM|HIGH|CRITICAL", "fix": "command or action" }
  ],
  "hardening": "Additional hardening commands (one per line)",
  "compliance_notes": "Relevant CIS/NIST recommendations if applicable"
}`;
}

// Prompt per analizzare output di scan (nmap, sslscan, ssh-audit)
export const buildSecurityScanAnalysisPrompt = (targetHost, scanType, scanOutput, systemProfile, lang) => {
  const languageMap = { it: "italiano", fr: "français", de: "deutsch", es: "español", en: "english" };
  const targetLang = languageMap[lang] || "english";

  return `Sei un esperto di cybersecurity. Analizza il seguente output di scan per ${targetHost} (tipo: ${scanType}) e identifica vulnerabilità, porte aperte pericolose, ciphers deboli, configurazioni obsolete. Rispondi SOLO in ${targetLang}.

OUTPUT SCAN:
${scanOutput}

Rispondi STRETTAMENTE con questo formato JSON:
{
  "report": "Analisi dettagliata delle vulnerabilità trovate, con spiegazione dei rischi",
  "recommendations": "Raccomandazioni specifiche per risolvere ogni problema, con comandi dove necessario"
}`;
};
