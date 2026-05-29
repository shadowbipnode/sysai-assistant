const SECRET_PATTERNS = [
  {
    name: "AWS Access Key",
    severity: "CRITICAL",
    regex: /AKIA[0-9A-Z]{16}/g,
  },
  {
    name: "GitHub Token",
    severity: "HIGH",
    regex: /ghp_[A-Za-z0-9]{36,}/g,
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
    regex: /(password|passwd|pwd)\s*[:=]\s*["']?.{4,}/gi,
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
  if (value.length <= 16) return `${value.slice(0, 4)}...`;
  return `${value.slice(0, 12)}...`;
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
