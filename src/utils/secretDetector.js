const SECRET_PATTERNS = [
  {
    name: "AWS Access Key",
    severity: "CRITICAL",
    regex: /AKIA[0-9A-Z]{16}/g,
  },
  {
    name: "GitHub Token",
    severity: "HIGH",
    regex: /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}/g,
  },
  {
    name: "GitHub Fine-Grained Token",
    severity: "CRITICAL",
    regex: /github_pat_[A-Za-z0-9_]{40,}/g,
  },
  {
    name: "GitLab Token",
    severity: "HIGH",
    regex: /glpat-[A-Za-z0-9_-]{20,}/g,
  },
  {
    name: "Slack Token",
    severity: "HIGH",
    regex: /xox[baprs]-[A-Za-z0-9-]{20,}/g,
  },
  {
    name: "Google API Key",
    severity: "HIGH",
    regex: /AIza[0-9A-Za-z_-]{35}/g,
  },
  {
    name: "Stripe Secret Key",
    severity: "CRITICAL",
    regex: /sk_(?:live|test)_[0-9A-Za-z]{20,}/g,
  },
  {
    name: "JWT Token",
    severity: "MEDIUM",
    regex: /eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/g,
  },
  {
    name: "Private Key",
    severity: "CRITICAL",
    regex: /-----BEGIN (RSA|OPENSSH|EC|DSA)? ?PRIVATE KEY-----/g,
  },
  {
    name: "Generic Password",
    severity: "HIGH",
    regex: /\b(password|passwd|pwd|passphrase|secret|token|api[_-]?key|access[_-]?key|client[_-]?secret|db[_-]?password|database[_-]?url|redis[_-]?url|private[_-]?key)\b\s*[:=]\s*["']?[^"'\s#]{4,}/gi,
  },
  {
    name: "Basic Auth URL",
    severity: "HIGH",
    regex: /[a-z][a-z0-9+.-]*:\/\/[^:\s/@]+:[^@\s]+@[^/\s]+/gi,
  },
  {
    name: "Docker Compose Environment Secret",
    severity: "HIGH",
    regex: /-\s*(?:PASSWORD|PASSWD|TOKEN|SECRET|API_KEY|ACCESS_KEY|DATABASE_URL|REDIS_URL)\s*=\s*[^#\s]{4,}/gi,
  },
  {
    name: "Telegram Bot Token",
    severity: "HIGH",
    regex: /[0-9]{8,10}:[A-Za-z0-9_-]{24,}/g,
  },
];

function calculateEntropy(str) {
  const map = {};

  for (const char of str) {
    map[char] = (map[char] || 0) + 1;
  }

  return Object.values(map).reduce((entropy, count) => {
    const p = count / str.length;
    return entropy - p * Math.log2(p);
  }, 0);
}

function maskSecret(value) {
  if (!value) return "";
  const text = String(value);
  if (text.includes("=")) {
    const [key, ...rest] = text.split("=");
    const secret = rest.join("=");
    return `${key}=${maskSecret(secret)}`;
  }
  if (text.length <= 16) return `${text.slice(0, 4)}...`;
  return `${text.slice(0, 8)}...${text.slice(-4)}`;
}

export function detectSecrets(input) {
  const findings = [];
  const text = String(input || "");

  for (const pattern of SECRET_PATTERNS) {
    const matches = text.match(pattern.regex);

    if (matches) {
      matches.forEach((match) => {
        findings.push({
          type: pattern.name,
          severity: pattern.severity,
          value: maskSecret(match),
          evidence: match,
        });
      });
    }
  }

  const possibleSecrets = text
    .split(/\s+/)
    .map((token) => token.includes("=") ? token.split("=").slice(1).join("=") : token)
    .filter(Boolean)
    .flatMap((token) => token.match(/[A-Za-z0-9_\-/+=]{24,}/g) || []);

  possibleSecrets.forEach((candidate) => {
    if (/^[A-Z0-9_]+$/.test(candidate) && candidate.includes("_")) return;

    const alreadyDetected = findings.some((finding) =>
      finding.evidence && finding.evidence.includes(candidate)
    );

    if (alreadyDetected) return;

    const entropy = calculateEntropy(candidate);

    if (entropy > 4.2) {
      findings.push({
        type: "High Entropy Secret",
        severity: "MEDIUM",
        value: maskSecret(candidate),
        evidence: candidate,
      });
    }
  });

  return findings;
}
