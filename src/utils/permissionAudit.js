function finding(title, severity, evidence, remediation) {
  return { title, severity, evidence, remediation };
}

export function auditPermissions(input) {
  const findings = [];
  const text = String(input || "");
  const lines = text.split(/\r?\n/);

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed) return;

    if (/^-rwxrwxrwx/.test(trimmed) || /^drwxrwxrwx/.test(trimmed)) {
      findings.push(finding(
        "World-writable permission detected",
        "HIGH",
        trimmed,
        "Avoid 777 permissions. Restrict write access to the required owner or group."
      ));
    }

    if (/^-rw-rw-rw-/.test(trimmed)) {
      findings.push(finding(
        "World-writable file detected",
        "HIGH",
        trimmed,
        "Remove world-write permission using chmod o-w."
      ));
    }

    if (/\.ssh\b/.test(trimmed) && !/^drwx------/.test(trimmed) && /^d/.test(trimmed)) {
      findings.push(finding(
        "Weak SSH directory permissions",
        "HIGH",
        trimmed,
        "Set SSH directory permissions to 700."
      ));
    }

    if (/id_rsa|id_ed25519|authorized_keys/.test(trimmed) && !/^-rw-------/.test(trimmed)) {
      findings.push(finding(
        "Weak SSH key file permissions",
        "HIGH",
        trimmed,
        "Set private SSH keys to 600 and verify ownership."
      ));
    }

    if (/^-rws/.test(trimmed) || /^-..s/.test(trimmed)) {
      findings.push(finding(
        "SUID binary detected",
        "MEDIUM",
        trimmed,
        "Review whether this SUID binary is expected and required."
      ));
    }

    if (/docker\.sock/.test(trimmed) && /rw/.test(trimmed)) {
      findings.push(finding(
        "Docker socket permission exposure",
        "CRITICAL",
        trimmed,
        "Restrict Docker socket access. Membership in docker group is root-equivalent."
      ));
    }
  });

  if (/NOPASSWD\s*:/i.test(text)) {
    findings.push(finding(
      "Passwordless sudo rule detected",
      "HIGH",
      "sudoers contains NOPASSWD",
      "Limit passwordless sudo to specific commands or remove it."
    ));
  }

  return findings;
}
