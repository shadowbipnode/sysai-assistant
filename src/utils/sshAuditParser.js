export function parseSshAudit(output = "") {
  const clean = output.replace(/\x1B\[[0-9;]*m/g, "");

  const lines = clean
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const result = {
    software: "",
    banner: "",
    ciphers: [],
    macs: [],
    kex: [],
    hostKeys: [],
    fingerprints: [],
    recommendations: [],
    failures: [],
    warnings: [],
    infos: []
  };

  for (const line of lines) {
    if (line.includes("(gen) banner:")) {
      result.banner = line.split("banner:")[1]?.trim() || "";
    }

    if (line.includes("(gen) software:")) {
      result.software = line.split("software:")[1]?.trim() || "";
    }

    if (line.startsWith("(enc)")) {
      result.ciphers.push(line);
    }

    if (line.startsWith("(mac)")) {
      result.macs.push(line);
    }

    if (line.startsWith("(kex)")) {
      result.kex.push(line);
    }

    if (line.startsWith("(key)")) {
      result.hostKeys.push(line);
    }

    if (line.startsWith("(fin)")) {
      result.fingerprints.push(line);
    }

    if (line.startsWith("(rec)")) {
      result.recommendations.push(line);
    }

    if (line.includes("[fail]")) {
      result.failures.push(line);
    }

    if (line.includes("[warn]")) {
      result.warnings.push(line);
    }

    if (line.includes("[info]")) {
      result.infos.push(line);
    }
  }

  result.score = Math.max(
    15,
    Math.min(
      100,
      100 -
      (result.failures.length * 8) -
      (result.warnings.length * 3) -
      (result.recommendations.length * 1)
    )
  );

  return result;
}
