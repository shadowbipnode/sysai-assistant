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
- Prefer reversible, least-privilege operations
- When giving commands, include verification steps and rollback notes whenever possible
- Consider the system context when giving recommendations`;
}

// ============================================================
// SPECIALIZED PROMPTS PER TOOL
// ============================================================

function detectLogSignals(logText) {
  const text = String(logText || '');
  const lower = text.toLowerCase();
  const signals = [];

  const add = (name, reason) => {
    if (!signals.some(s => s.name === name)) signals.push({ name, reason });
  };

  if (/nginx|upstream|connect\(\) failed|no live upstreams/i.test(text)) add('nginx/reverse-proxy', 'nginx upstream/reverse proxy patterns detected');
  if (/apache|httpd|mod_ssl/i.test(text)) add('apache/httpd', 'Apache/httpd patterns detected');
  if (/docker|container|compose|dockerd/i.test(text)) add('docker', 'Docker/container patterns detected');
  if (/systemd|journalctl|failed to start|unit .* failed/i.test(text)) add('systemd', 'systemd/service manager patterns detected');
  if (/lnd|lightning|lncli|macaroon|channel|htlc/i.test(text)) add('LND/Lightning', 'Lightning/LND patterns detected');
  if (/bitcoind|bitcoin core|debug\.log|blocks|mempool|rpcuser|rpcpassword/i.test(text)) add('Bitcoin Core', 'Bitcoin Core patterns detected');
  if (/tor|onion|socks|controlport|hiddenservice/i.test(text)) add('Tor', 'Tor/onion networking patterns detected');
  if (/postgres|psql|postgresql/i.test(text)) add('PostgreSQL', 'PostgreSQL patterns detected');
  if (/mysql|mariadb|mysqld/i.test(text)) add('MySQL/MariaDB', 'MySQL/MariaDB patterns detected');
  if (/ssh|sshd|authentication failure|permission denied \(publickey\)/i.test(text)) add('SSH', 'SSH/sshd patterns detected');

  const errorLines = text.split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => /(error|warn|fatal|fail|failed|exception|panic|denied|refused|timeout|unreachable|critical|segfault|traceback)/i.test(line))
    .slice(0, 40);

  const ports = [...new Set((text.match(/(?::|port\s+)(\d{2,5})/gi) || [])
    .map(x => x.match(/\d{2,5}/)?.[0])
    .filter(Boolean))].slice(0, 12);

  return {
    detected: signals.map(s => s.name).join(', ') || 'unknown',
    reasons: signals.map(s => `- ${s.name}: ${s.reason}`).join('\n') || '- No strong stack signature detected.',
    importantLines: errorLines.join('\n') || 'No obvious ERROR/WARN/FATAL lines extracted.',
    ports: ports.join(', ') || 'none detected',
  };
}

export function buildLogAnalysisPrompt(logText, service, systemProfile, lang) {
  const systemContext = getSystemContext(systemProfile, lang);
  const signals = detectLogSignals(logText);

  return `${systemContext}

TASK: Analyze the following system log as a senior production Linux/SRE diagnostic engineer.

IMPORTANT GOAL:
Return a practical diagnosis that is safer and more specific than generic advice.
Do not invent services, paths, package names, systemd unit names, container names, usernames, domains, or file locations that are not present in the log. If a name is unknown, use placeholders such as <service_name>, <container_name>, <config_file>.

SELECTED SERVICE CONTEXT: ${service}
AUTO-DETECTED STACK SIGNALS: ${signals.detected}
DETECTION REASONS:
${signals.reasons}
DETECTED PORTS: ${signals.ports}
IMPORTANT LINES EXTRACTED:
\`\`\`
${signals.importantLines}
\`\`\`

FULL LOG:
\`\`\`
${logText}
\`\`\`

DIAGNOSTIC REQUIREMENTS:
- Identify the most likely root cause and explain why.
- Separate evidence from assumptions.
- Give the safest checks first, then fixes.
- Add one clear next best action: the single first thing the operator should run/do.
- Include verification commands.
- Include rollback guidance. If no rollback is needed, say exactly: "No rollback needed for read-only checks."
- Use a confidence level: LOW, MEDIUM, or HIGH.
- Mark whether sudo is required by the recommended commands.
- Prefer read-only diagnostic commands before restart/change commands.
- Never suggest destructive commands unless absolutely necessary and clearly marked.
- Do not present placeholder commands as final fixes. If a service/container name is unknown, first provide commands to discover it.

RISK CALIBRATION RULES:
- severity means REMEDIATION RISK, not business impact.
- LOW: read-only checks only, log inspection, status commands, curl/ss/grep/tail.
- MEDIUM: restarting/reloading services, restarting containers, changing temporary runtime state.
- HIGH: editing config files, firewall changes, package upgrades/removals, permission/ownership changes, data migration.
- CRITICAL: destructive commands, deleting data, formatting disks, resetting wallets/keys, force-closing channels, disabling security controls.
- If the fix section starts with read-only checks but also includes a restart, use MEDIUM unless it includes config/data/security changes.

CONFIDENCE CALIBRATION RULES:
- HIGH: the log contains direct evidence for the root cause.
- MEDIUM: the log shows the failing component but not the underlying service/process.
- LOW: the log is incomplete, mixed, or ambiguous.
- If confidence is HIGH, additional logs should be optional, not required.

PLACEHOLDER RULES:
- Avoid <service_name> in the first recommended commands when possible.
- For unknown service names on a known port, use commands like: ss -tulpn | grep ':PORT', systemctl list-units --type=service --state=running, docker ps --format, ps aux | grep PORT.
- If a placeholder is unavoidable, explain exactly how to replace it.

Respond STRICTLY with valid JSON only. No markdown outside JSON. No text before or after.
Use this exact JSON schema:
{
  "severity": "LOW|MEDIUM|HIGH|CRITICAL",
  "confidence": "LOW|MEDIUM|HIGH",
  "requires_sudo": true,
  "detected_stack": ["nginx", "docker", "systemd", "LND", "Bitcoin Core", "Tor"],
  "title": "Brief diagnostic title",
  "summary": "One short paragraph with the immediate problem and impact",
  "root_cause": "Most likely root cause with evidence from the log",
  "next_best_action": "The single safest first action to take, preferably a command or short action",
  "evidence": ["specific log line or fact", "specific log line or fact"],
  "assumptions": ["assumption made because the log does not show X"],
  "fix": "Step-by-step safe fix commands, one per line, with # comments. Start with read-only checks and discover unknown names before using placeholders.",
  "verification": "Commands to verify the fix worked, one per line, with # comments",
  "rollback": "Rollback commands or 'No rollback needed for read-only checks.'",
  "prevention": "How to prevent this in the future, 1-3 practical sentences",
  "additional_logs_optional": true,
  "additional_logs_needed": ["extra log or command output. If confidence is HIGH, these are optional follow-up checks"]
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
  "requires_sudo": true,
  "destructive": false,
  "verification": "command to verify the result",
  "rollback": "rollback command or null if not applicable",
  "alternatives": "Alternative approaches if any (null if none)"
}`;
}

export function buildExplainPrompt(commandOrScript, systemProfile, lang) {
  const languageMap = { it: "italiano", fr: "français", de: "deutsch", es: "español", en: "english" };
  const targetLang = languageMap[lang] || "english";

  return `${getSystemContext(systemProfile, lang)}

TASK: Explain this command or script line by line. You MUST respond with ONLY valid JSON.

INPUT:
\`\`\`
${commandOrScript}
\`\`\`

Response MUST be in this EXACT JSON format (no markdown, no extra text):
{"summary": "one sentence summary", "lines": [{"line": "exact line", "explanation": "what it does"}], "risks": "risks or null", "improvements": "improvements or null"}`;
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
