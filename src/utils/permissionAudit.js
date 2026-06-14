function finding(title, severity, evidence, remediation) {
  return { title, severity, evidence, remediation };
}

function parseMode(mode = "") {
  if (!/^[bcdlps-][rwxStTs-]{9}/.test(mode)) return null;
  return {
    type: mode[0],
    owner: mode.slice(1, 4),
    group: mode.slice(4, 7),
    other: mode.slice(7, 10),
    suid: mode[3] === "s" || mode[3] === "S",
    sgid: mode[6] === "s" || mode[6] === "S",
    sticky: mode[9] === "t" || mode[9] === "T",
    worldWritable: mode[8] === "w",
    worldReadable: mode[7] === "r",
    groupWritable: mode[5] === "w",
  };
}

function pathFromLongListing(line) {
  const parts = line.trim().split(/\s+/);
  return parts.length >= 9 ? parts.slice(8).join(" ") : "";
}

function isSensitivePath(path) {
  return /(?:^|\/)(?:\.env|id_rsa|id_ed25519|authorized_keys|shadow|sudoers|config\.json|credentials|secrets?|wallet\.dat|macaroon|tls\.key)(?:$|\s|\/)/i.test(path);
}

export function auditPermissions(input) {
  const findings = [];
  const text = String(input || "");
  const lines = text.split(/\r?\n/);

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed) return;

    const modeToken = trimmed.match(/^[bcdlps-][rwxStTs-]{9}/)?.[0] || "";
    const mode = parseMode(modeToken);
    const listedPath = pathFromLongListing(trimmed);

    if (mode?.worldWritable) {
      findings.push(finding(
        "World-writable permission detected",
        mode.type === "d" && mode.sticky ? "MEDIUM" : "HIGH",
        trimmed,
        mode.type === "d" && mode.sticky
          ? "Verify the sticky bit is intentional and the directory is not used for sensitive files."
          : "Avoid world-writable permissions. Restrict write access to the required owner or group."
      ));
    }

    if (mode?.worldReadable && isSensitivePath(listedPath)) {
      findings.push(finding(
        "Sensitive file readable by everyone",
        "HIGH",
        trimmed,
        "Restrict sensitive files to the owning user or service account."
      ));
    }

    if (mode?.groupWritable && /(?:^|\/)(?:etc|usr|bin|sbin|opt|var\/www|srv)(?:\/|\s|$)/i.test(listedPath)) {
      findings.push(finding(
        "Group-writable system or service path",
        "MEDIUM",
        trimmed,
        "Confirm the owning group is trusted and remove group-write access where it is not operationally required."
      ));
    }

    if (/\.ssh\b/.test(trimmed) && mode?.type === "d" && modeToken !== "drwx------") {
      findings.push(finding(
        "Weak SSH directory permissions",
        "HIGH",
        trimmed,
        "Set SSH directory permissions to 700."
      ));
    }

    if (/id_rsa|id_ed25519|authorized_keys/.test(trimmed) && mode?.type === "-" && modeToken !== "-rw-------") {
      findings.push(finding(
        "Weak SSH key file permissions",
        "HIGH",
        trimmed,
        "Set private SSH keys to 600 and verify ownership."
      ));
    }

    if (mode?.suid || mode?.sgid) {
      findings.push(finding(
        mode.suid ? "SUID binary detected" : "SGID file detected",
        /(?:nmap|find|bash|sh|python|perl|ruby|vim|less|more|cp|tar|zip|nano|node)\b/i.test(trimmed) ? "HIGH" : "MEDIUM",
        trimmed,
        "Review whether this special permission is expected and required. Remove SUID/SGID from non-system or user-writable paths."
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

    const findPermMatch = trimmed.match(/\b(?:0)?([467][0-7]{3}|777|666)\b/);
    if (findPermMatch && !mode) {
      findings.push(finding(
        "Risky numeric permission detected",
        findPermMatch[1].startsWith("4") || findPermMatch[1].startsWith("6") ? "MEDIUM" : "HIGH",
        trimmed,
        "Validate the path and replace broad numeric modes with least-privilege permissions."
      ));
    }

    if (/^\S+\s+ALL\s*=\s*\(ALL(?::ALL)?\)\s+ALL/i.test(trimmed)) {
      findings.push(finding(
        "Broad sudo privilege detected",
        "MEDIUM",
        trimmed,
        "Prefer least-privilege sudo rules scoped to specific commands and users."
      ));
    }

    if (/^\S+\s+ALL\s*=\s*\(ALL(?::ALL)?\)\s+NOPASSWD:\s*ALL/i.test(trimmed)) {
      findings.push(finding(
        "Passwordless full sudo detected",
        "CRITICAL",
        trimmed,
        "Remove NOPASSWD:ALL or scope passwordless sudo to a narrow command set."
      ));
    }

    if (/NOPASSWD:\s*(?:\/bin\/sh|\/bin\/bash|\/usr\/bin\/vim|\/usr\/bin\/nano|\/usr\/bin\/python|\/usr\/bin\/perl|\/usr\/bin\/find|\/usr\/bin\/less|\/usr\/bin\/more)/i.test(trimmed)) {
      findings.push(finding(
        "Passwordless sudo shell escape risk",
        "HIGH",
        trimmed,
        "Avoid passwordless sudo for editors, interpreters, pagers, shells, or tools with shell escapes."
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
