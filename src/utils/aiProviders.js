import { buildOperationalContextBlock } from './operationalContextPrompt';
import { detectOperationalContext, formatOperationalContext } from './environmentDetection';

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


function detectEnvironmentSignals(inputText, selectedContext = '') {
  const text = `${selectedContext}\n${inputText || ''}`;
  const lower = text.toLowerCase();
  const env = [];
  const add = (name, reason) => {
    if (!env.some(e => e.name === name)) env.push({ name, reason });
  };

  if (/docker|compose|container|dockerd|docker ps|docker logs|172\.1[6-9]\.|172\.2\d\.|172\.3[0-1]\./i.test(text)) add('Docker/Compose', 'container, compose, Docker daemon, or Docker network patterns detected');
  if (/kubernetes|kubectl|k8s|pod\b|namespace\b|deployment\b/i.test(text)) add('Kubernetes', 'Kubernetes resource or kubectl patterns detected');
  if (/systemctl|journalctl|\.service|systemd|failed to start|unit .* failed/i.test(text)) add('systemd', 'systemd/journal service patterns detected');
  if (/nginx|upstream|proxy_pass|connect\(\) failed|no live upstreams/i.test(text)) add('nginx/reverse-proxy', 'nginx reverse proxy or upstream patterns detected');
  if (/apache|httpd|mod_ssl/i.test(text)) add('apache/httpd', 'Apache/httpd patterns detected');
  if (/tor|onion|socks|controlport|hiddenservice/i.test(text)) add('Tor', 'Tor/onion networking patterns detected');
  if (/lnd|lncli|macaroon|channel|htlc|lightning/i.test(text)) add('LND/Lightning', 'Lightning node patterns detected');
  if (/bitcoind|bitcoin core|debug\.log|zmq|mempool|rpcuser|rpcpassword|prune=/i.test(text)) add('Bitcoin Core', 'Bitcoin Core node patterns detected');
  if (/postgres|psql|postgresql/i.test(text)) add('PostgreSQL', 'PostgreSQL patterns detected');
  if (/mysql|mariadb|mysqld/i.test(text)) add('MySQL/MariaDB', 'MySQL/MariaDB patterns detected');
  if (/ssh|sshd|authorized_keys|permission denied \(publickey\)/i.test(text)) add('SSH', 'SSH/sshd patterns detected');
  if (/ufw|firewalld|iptables|nftables/i.test(text)) add('Firewall', 'firewall tooling patterns detected');

  return {
    names: env.map(e => e.name),
    text: env.map(e => `- ${e.name}: ${e.reason}`).join('\n') || '- No strong environment signature detected.',
  };
}

function getProfessionalOutputContract(toolName) {
  return `
PROFESSIONAL OUTPUT RULES FOR ${toolName}:
- Return ONLY valid JSON. No markdown outside JSON. No text before or after.
- Be operational, not conversational.
- Always include a risk/severity level calibrated by remediation risk, not business impact.
- Always include confidence: LOW, MEDIUM, or HIGH.
- Always include next_best_action: the single safest first action.
- Always separate evidence from assumptions.
- Always include verification commands when commands or changes are suggested.
- Always include rollback guidance. If no rollback is needed, say exactly: "No rollback needed for read-only checks."
- Use arrays for command blocks: fix_commands, verification_commands, rollback_commands. Each array item must be one complete shell command or one comment line starting with #.
- Do not compress numbered steps into one long paragraph. Keep commands line-by-line.
- next_best_action must be a single short action or a single command, not a chain of commands.
- Prefer read-only discovery commands before restart/change commands.
- Do not invent service names, container names, paths, users, domains, package names, or config filenames not present in the input.
- If a name is unknown, give discovery commands first and explain how to replace placeholders.
- Do not present placeholder commands as copy-paste-ready final actions. Put placeholder commands only after a discovery step, with a clear comment.
- For permission/ownership fixes, record current ownership and permissions before suggesting chmod/chown. Avoid recursive chown unless absolutely necessary.
- If Docker bind-mount permission errors are involved, consider UID/GID mismatch, read-only mounts, SELinux labels, AppArmor, and host path permissions.

RISK CALIBRATION:
- LOW: read-only checks, explanation, status/log/list commands, curl/ss/grep/tail, configuration review with no changes.
- MEDIUM: service reload/restart, container restart, temporary runtime changes.
- HIGH: editing configuration, firewall changes, permissions/ownership changes, package install/upgrade/remove, persistent system changes.
- CRITICAL: destructive deletion, formatting, key/wallet reset, database migration without backup, force-closing Lightning channels, disabling security controls.

CONFIDENCE CALIBRATION:
- HIGH: direct evidence in input supports the conclusion.
- MEDIUM: likely cause is visible but an internal dependency/name is missing.
- LOW: incomplete, mixed, ambiguous, or insufficient input.
`;
}

function getEnvironmentContext(inputText, selectedContext = '') {
  const env = detectEnvironmentSignals(inputText, selectedContext);

  const operationalContext = detectOperationalContext(`
${selectedContext}

${inputText}
`);

  const formattedOperationalContext = formatOperationalContext(operationalContext);

  return `
ENVIRONMENT-AWARE CONTEXT:
Detected environments/stacks: ${env.names.length ? env.names.join(', ') : 'unknown'}

Detection reasons:
${env.text}

ADVANCED OPERATIONAL CONTEXT:
${formattedOperationalContext || 'No additional operational context detected.'}

ENVIRONMENT-SPECIFIC GUIDANCE:
- Prefer read-only diagnostics before service-impacting remediation.
- If ownership/control is uncertain, treat findings as observational.
- Distinguish exposure from exploitability.
- Prefer reversible operations and verification-first workflows.
- Prefer the safest next-best-action before aggressive remediation.

STACK-SPECIFIC GUIDANCE:
- If Docker/Compose is detected, prefer docker ps, docker logs, docker inspect, docker compose ps/logs before systemctl assumptions.
- For Docker bind mounts with permission denied, first inspect ls -ln/stat/id/docker inspect output before chmod/chown.
- If Kubernetes is detected, prefer kubectl get/describe/logs before restart/delete operations.
- If systemd is detected, prefer systemctl status, journalctl -u, systemctl is-active, and unit-specific checks.
- If nginx/reverse-proxy is detected, distinguish proxy failure from backend application failure and verify both upstream and nginx config.
- If Bitcoin Core is detected, consider IBD/sync, RPC auth, pruning, ZMQ, disk, Tor-only networking, and debug.log signals.
- If LND/Lightning is detected, consider wallet unlock, bitcoind RPC, chain sync, peers, channel state, macaroon/TLS, Tor, and liquidity/routing state.
- If Tor is detected, consider socks/control port, hidden service config, onion reachability, and DNS leaks.
`;
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
  const operationalContext = buildOperationalContextBlock();
  const signals = detectLogSignals(logText);

  return `${systemContext}

${operationalContext}

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
- Prefer commands that discover names automatically, e.g. ss/lsof/docker ps/docker inspect/systemctl list-units, before commands containing <service_name> or <container_name>.

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
- fix_commands, verification_commands and rollback_commands must be JSON arrays, not numbered text paragraphs.
- Each command array item must render cleanly as a single line in a terminal-oriented code block.

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
  "fix_commands": ["# Step 1 - read-only discovery", "command 1", "# Step 2 - safe remediation", "command 2"],
  "verification_commands": ["# Verify the service/result", "command"],
  "rollback_commands": ["No rollback needed for read-only checks."],
  "fix": "short human-readable fix summary",
  "verification": "short verification summary",
  "rollback": "short rollback summary",
  "prevention": "How to prevent this in the future, 1-3 practical sentences",
  "additional_logs_optional": true,
  "additional_logs_needed": ["extra log or command output. If confidence is HIGH, these are optional follow-up checks"]
}`;
}

export function buildCommandPrompt(description, systemProfile, lang) {
  const systemContext = getSystemContext(systemProfile, lang);
  const environmentContext = getEnvironmentContext(description, 'command generation');

  return `${systemContext}
${environmentContext}
${getProfessionalOutputContract('Command Crafter')}

TASK: Generate the exact Linux command or command sequence for this request.

REQUEST:
${description}

COMMAND REQUIREMENTS:
- Prefer the safest command that accomplishes the goal.
- If the task is ambiguous, generate discovery/check commands first instead of a dangerous final command.
- Include comments inside multi-line command blocks when helpful.
- If sudo is required, explain why.
- If the command changes state, include verification and rollback.

Respond STRICTLY with this JSON format:
{
  "command": "the exact command or command block to run",
  "explanation": "What the command does and why these flags/options are used",
  "severity": "LOW|MEDIUM|HIGH|CRITICAL",
  "confidence": "LOW|MEDIUM|HIGH",
  "requires_sudo": true,
  "destructive": false,
  "detected_stack": ["systemd", "Docker/Compose", "nginx/reverse-proxy"],
  "next_best_action": "the first safest action to take",
  "evidence": ["facts from the request that influenced the command"],
  "assumptions": ["assumptions made because details were missing"],
  "verification_commands": ["command(s) to verify the result"],
  "rollback_commands": ["rollback command(s) or No rollback needed for read-only checks."],
  "verification": "short verification summary",
  "rollback": "short rollback summary",
  "warning": "risks or side effects, or null",
  "alternatives": "alternative approach if useful, or null"
}`;
}


export function buildExplainPrompt(commandOrScript, systemProfile, lang) {
  const environmentContext = getEnvironmentContext(commandOrScript, 'explain mode');

  return `${getSystemContext(systemProfile, lang)}
${environmentContext}
${getProfessionalOutputContract('Explain Mode')}

TASK: Explain this command or script line by line and assess operational risk.

INPUT:
\`\`\`
${commandOrScript}
\`\`\`

EXPLANATION REQUIREMENTS:
- Explain what each line does.
- Identify whether it reads data, modifies state, restarts services, changes permissions, deletes files, or touches security-sensitive material.
- Highlight hidden risks such as glob expansion, recursive deletion, permission changes, network exposure, credentials in shell history, or irreversible actions.
- Suggest safer alternatives when appropriate.

Response MUST be in this EXACT JSON format:
{
  "summary": "one sentence summary",
  "severity": "LOW|MEDIUM|HIGH|CRITICAL",
  "confidence": "LOW|MEDIUM|HIGH",
  "requires_sudo": true,
  "destructive": false,
  "detected_stack": ["systemd", "Docker/Compose", "nginx/reverse-proxy"],
  "next_best_action": "safe first action before running it, or 'Review the explanation before execution'",
  "lines": [{"line": "exact line", "explanation": "what it does"}],
  "risks": "risks or null",
  "improvements": "safer improvements or null",
  "verification_commands": ["command(s) to verify the command had the intended effect"],
  "rollback_commands": ["rollback command(s) or No rollback needed for read-only checks."],
  "verification": "short verification summary or null",
  "rollback": "short rollback summary",
  "assumptions": ["assumptions made while interpreting the input"]
}`;
}


export function buildConfigPrompt(description, configType, systemProfile, lang) {
  const systemContext = getSystemContext(systemProfile, lang);
  const environmentContext = getEnvironmentContext(description, configType);

  return `${systemContext}
${environmentContext}
${getProfessionalOutputContract('Config Generator')}

TASK: Generate a production-ready configuration file.

CONFIG TYPE: ${configType}
REQUIREMENTS:
${description}

CONFIG REQUIREMENTS:
- Prefer secure defaults.
- Include only settings relevant to the stated requirements.
- Do not invent domains, IPs, usernames, secrets, paths, or service names unless clearly marked as placeholders.
- Include validation commands.
- Include deployment notes and rollback steps.
- For Docker/Compose, include healthchecks when appropriate.
- For nginx/reverse proxy, include config validation and backend reachability checks.
- For Bitcoin/LND/Tor configs, avoid exposing RPC/admin interfaces publicly and warn about secrets.

Respond STRICTLY with this JSON format:
{
  "filename": "suggested filename",
  "config": "the complete configuration file content",
  "explanation": "brief explanation of key settings and why they were chosen",
  "severity": "LOW|MEDIUM|HIGH|CRITICAL",
  "confidence": "LOW|MEDIUM|HIGH",
  "requires_sudo": true,
  "detected_stack": ["systemd", "Docker/Compose", "nginx/reverse-proxy", "Bitcoin Core", "LND/Lightning", "Tor"],
  "next_best_action": "first safe action before deployment",
  "verification_commands": ["commands to validate/test the config"],
  "rollback_commands": ["commands or steps to restore the previous config"],
  "verification": "short validation summary",
  "rollback": "short rollback summary",
  "security_notes": "security considerations for this config",
  "assumptions": ["assumptions made because details were missing"],
  "additional_logs_optional": true,
  "additional_logs_needed": ["optional info that would improve the config"]
}`;
}


export function buildTroubleshootPrompt(problem, previousSteps, systemProfile, lang) {
  const systemContext = getSystemContext(systemProfile, lang);
  const operationalContext = buildOperationalContextBlock();
  const environmentContext = getEnvironmentContext(problem, 'troubleshooting');
  const prevContext = previousSteps?.length
    ? `\nPREVIOUS DIAGNOSTIC STEPS:\n${previousSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
    : '';

  return `${systemContext}

${operationalContext}
${environmentContext}
${getProfessionalOutputContract('Troubleshooter')}

TASK: Guide troubleshooting for this problem as an incident-response runbook.
${prevContext}

PROBLEM:
${problem}

TROUBLESHOOTING REQUIREMENTS:
- Start with the safest read-only check.
- Separate likely causes from assumptions.
- If Docker/Compose and nginx/reverse proxy are both detected, FIRST inspect compose/container state and upstream reachability before checking or restarting system services.
- For Docker/Compose incidents, prefer this order: docker compose ps -a -> docker ps -a -> docker compose logs -> docker inspect -> nginx error logs -> upstream curl -> only then systemctl/journalctl.
- If the environment appears Docker/Compose, include Docker checks before systemd restarts.
- If the environment appears systemd, include systemctl/journalctl checks, but do not make systemctl the first action when container/upstream evidence is stronger.
- If Bitcoin/LND/Tor is involved, use domain-specific checks and avoid dangerous wallet/channel operations.
- Provide a clear stop condition: how the user knows the issue is fixed.
- For Docker permission problems, prioritize: ls -ln/stat -> docker inspect user/mounts -> id/UID mapping -> optional SELinux/AppArmor checks -> only then ownership/permission changes.
- For rollback after ownership/permission changes, instruct the user to capture original ownership/permissions first. Do not claim a reliable rollback exists if original state was not recorded.

Respond STRICTLY with this JSON format:
{
  "diagnosis": "most likely cause based on the description",
  "severity": "LOW|MEDIUM|HIGH|CRITICAL",
  "confidence": "LOW|MEDIUM|HIGH",
  "requires_sudo": true,
  "detected_stack": ["systemd", "Docker/Compose", "nginx/reverse-proxy", "Bitcoin Core", "LND/Lightning", "Tor"],
  "next_best_action": "the single safest first command/action",
  "root_cause": "likely root cause and why",
  "evidence": ["specific facts from the problem"],
  "assumptions": ["assumptions made because details are missing"],
  "check_command": "first command to verify the diagnosis",
  "expected_output": "what the output should look like if this diagnosis is correct",
  "fix_commands": ["# Step 1 - read-only discovery", "command 1", "# Step 2 - safe remediation", "command 2"],
  "verification_commands": ["# Confirm the issue is fixed", "command"],
  "rollback_commands": ["# Restore previous state if recorded", "command or explanation"],
  "fix": "short human-readable fix summary",
  "verification": "short verification summary",
  "rollback": "rollback guidance. For ownership/permission changes, include a pre-change backup command such as stat/ls -ln first, or state that reliable rollback requires the recorded original UID/GID/mode.",
  "prevention": "1-3 practical prevention steps",
  "follow_up_question": "question to ask if the diagnosis is wrong, or null",
  "additional_logs_optional": true,
  "additional_logs_needed": ["optional outputs that would improve confidence"]
}`;
}


export function buildScriptPrompt(description, scriptType, systemProfile, lang) {
  const systemContext = getSystemContext(systemProfile, lang);
  const environmentContext = getEnvironmentContext(description, scriptType || 'bash');

  return `${systemContext}
${environmentContext}
${getProfessionalOutputContract('Script Builder')}

TASK: Generate a complete, production-ready script.

SCRIPT TYPE: ${scriptType || 'bash'}

CRITICAL LANGUAGE RULE:
- You MUST generate the script ONLY in the requested SCRIPT TYPE.
- If SCRIPT TYPE is python, generate Python only. Do not generate Bash.
- If SCRIPT TYPE is powershell, generate PowerShell only. Do not generate Bash.
- If SCRIPT TYPE is bash, generate Bash only.
- The filename extension, syntax, comments, dependencies and usage MUST match the requested SCRIPT TYPE.
- Do not wrap the script inside another language.

REQUIREMENTS:
${description}

The script MUST include:
- A shebang line ONLY when appropriate for the requested script type
- Strict mode where appropriate, e.g. set -euo pipefail for bash, but do not add Bash-specific strict mode to Python or PowerShell
- Input validation
- Logging
- Helpful comments
- Usage information
- A dry-run mode when the script changes system state
- Clear safety checks before destructive or privileged operations

Respond STRICTLY with this JSON format:
{
  "filename": "suggested filename",
  "script": "the complete script content",
  "usage": "how to use this script",
  "dependencies": "required packages or tools, or null",
  "severity": "LOW|MEDIUM|HIGH|CRITICAL",
  "confidence": "LOW|MEDIUM|HIGH",
  "requires_sudo": true,
  "destructive": false,
  "detected_stack": ["systemd", "Docker/Compose", "nginx/reverse-proxy", "Bitcoin Core", "LND/Lightning", "Tor"],
  "next_best_action": "first safe step before running the script",
  "verification_commands": ["commands to verify script result"],
  "rollback_commands": ["rollback commands or No rollback needed for read-only checks."],
  "verification": "short verification summary",
  "rollback": "short rollback summary",
  "safety_notes": "important safety notes",
  "assumptions": ["assumptions made because details were missing"]
}`;
}


export function buildSecurityAuditPrompt(configOrDescription, auditType, scanResults, systemProfile, lang) {
  const systemContext = getSystemContext(systemProfile, lang);
  const environmentContext = getEnvironmentContext(`${auditType}\n${configOrDescription}\n${scanResults || ''}`, 'security audit');
  const scanContext = scanResults ? `\nSCAN RESULTS:\n\`\`\`\n${scanResults}\n\`\`\`` : '';

  return `${systemContext}
${environmentContext}
${getProfessionalOutputContract('Security Auditor')}

TASK: Security audit and hardening recommendations.

AUDIT TYPE: ${auditType || 'general'}
${scanContext}
INPUT:
\`\`\`
${configOrDescription}
\`\`\`

SECURITY REQUIREMENTS:
- Prioritize exploitable/high-impact issues first.
- Separate confirmed findings from assumptions.
- Avoid recommending changes that could lock the user out without rollback.
- For SSH, warn before changing authentication or firewall rules.
- For nginx/TLS, include validation and rollback steps.
- For Docker, include container/network exposure risks.
- For Bitcoin/LND, protect RPC, macaroon/TLS, wallet, channels, and Tor privacy.

Respond STRICTLY with this JSON format:
{
  "risk_level": "LOW|MEDIUM|HIGH|CRITICAL",
  "severity": "LOW|MEDIUM|HIGH|CRITICAL",
  "confidence": "LOW|MEDIUM|HIGH",
  "requires_sudo": true,
  "detected_stack": ["SSH", "nginx/reverse-proxy", "Docker/Compose", "Bitcoin Core", "LND/Lightning", "Tor"],
  "next_best_action": "the single safest first hardening action or validation command",
  "report": "concise security report with confirmed issues and impact",
  "findings": [
    { "issue": "description", "severity": "LOW|MEDIUM|HIGH|CRITICAL", "evidence": "evidence from input", "fix": "safe command or action" }
  ],
  "recommendations": "specific remediation recommendations with commands where appropriate",
  "hardening_commands": ["additional hardening command or comment line"],
  "hardening": "short hardening summary",
  "verification_commands": ["commands to verify the remediation"],
  "rollback_commands": ["rollback commands or No rollback needed for read-only checks."],
  "verification": "short verification summary",
  "rollback": "short rollback summary",
  "compliance_notes": "relevant CIS/NIST recommendations if applicable",
  "assumptions": ["assumptions made because details were missing"]
}`;
}



export const buildSecurityScanAnalysisPrompt = (targetHost, scanType, scanOutput, systemProfile, lang) => {
  const environmentContext = getEnvironmentContext(scanOutput, scanType);

  return `${getSystemContext(systemProfile, lang)}
${environmentContext}
${getProfessionalOutputContract('Security Scan Analyzer')}

TASK: Analyze this remote security scan output for ${targetHost}.

SCAN TYPE: ${scanType}
SCAN OUTPUT:
\`\`\`
${scanOutput}
\`\`\`

SCAN ANALYSIS REQUIREMENTS:
- Identify confirmed security issues from the scan output.
- Do not claim vulnerabilities that are not visible in the scan.
- Distinguish exposure from exploitability.
- Prioritize internet-exposed management ports, weak TLS/SSH algorithms, obsolete protocols, and dangerous services.
- Treat this as a REMOTE OBSERVATION unless the user explicitly states they own/manage the target.
- Do NOT assume administrative control over ${targetHost}.
- Avoid direct remediation commands that modify the target unless ownership/control is explicitly stated.
- Use conditional language such as "If this is your infrastructure..." for remediation guidance.
- For third-party/public targets, focus on observation, risk interpretation, responsible disclosure, and authorized testing boundaries.
- Include safe verification steps that do not require privileged access to the remote system unless ownership is stated.
- Include rollback only for changes the user would make on infrastructure they control; otherwise say "No rollback needed for read-only remote observation."

Respond STRICTLY with this JSON format:
{
  "risk_level": "LOW|MEDIUM|HIGH|CRITICAL",
  "severity": "LOW|MEDIUM|HIGH|CRITICAL",
  "confidence": "LOW|MEDIUM|HIGH",
  "requires_sudo": true,
  "detected_stack": ["SSH", "TLS", "nginx/reverse-proxy", "Docker/Compose"],
  "next_best_action": "the single safest first action",
  "report": "concise analysis of vulnerabilities or exposure found",
  "findings": [
    { "issue": "description", "severity": "LOW|MEDIUM|HIGH|CRITICAL", "evidence": "evidence from scan", "fix": "safe command or action" }
  ],
  "recommendations": "specific recommendations with commands where appropriate",
  "verification_commands": ["commands to verify the remediation"],
  "rollback_commands": ["rollback commands or No rollback needed for read-only checks."],
  "verification": "short verification summary",
  "rollback": "short rollback summary",
  "assumptions": ["assumptions made because scan output is limited"],
  "additional_logs_optional": true,
  "additional_logs_needed": ["optional additional scan/output to improve confidence"]
}`;
};
