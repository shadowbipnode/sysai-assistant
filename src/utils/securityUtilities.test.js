import { describe, expect, it, beforeEach, vi } from "vitest";
import { detectSecrets } from "./secretDetector";
import { auditDockerCompose } from "./dockerAudit";
import { auditNginxConfig } from "./nginxAudit";
import { auditPermissions } from "./permissionAudit";
import { calculateServiceRisk } from "./exposureRiskEngine";
import { auditPrivacyExposure } from "./privacyExposure";
import { comparePortExposure, loadWatcherBaselines, saveWatcherBaseline } from "./serviceWatcher";
import { generateCsrBundle, validateCsrForm } from "./csrGenerator";

beforeEach(() => {
  const store = {};
  vi.stubGlobal("localStorage", {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
  });
});

describe("security utility coverage", () => {
  it("masks detected secrets while retaining evidence for local reporting", () => {
    const findings = detectSecrets("DATABASE_URL=postgres://user:secretpass@example.com:5432/app\nAPI_KEY=AIza12345678901234567890123456789012345");
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.some((item) => item.value.includes("..."))).toBe(true);
    expect(findings.some((item) => item.evidence.includes("secretpass"))).toBe(true);
  });

  it("detects Docker exposure and hardening issues", () => {
    const findings = auditDockerCompose(`
services:
  db:
    image: postgres:latest
    privileged: true
    ports:
      - "0.0.0.0:5432:5432"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
`);
    expect(findings.map((item) => item.title)).toContain("Docker socket exposed to container");
    expect(findings.map((item) => item.title)).toContain("Privileged container enabled");
    expect(findings.some((item) => item.title.includes("Database port 5432"))).toBe(true);
  });

  it("detects reverse proxy risks across common proxy config patterns", () => {
    const findings = auditNginxConfig(`
server {
  listen 80;
  location /admin { proxy_pass http://app:3000; }
}
api.insecure=true
`);
    expect(findings.some((item) => item.title === "HTTP-only virtual host detected")).toBe(true);
    expect(findings.some((item) => item.title === "Traefik insecure dashboard enabled")).toBe(true);
    expect(findings.some((item) => item.title.includes("admin path"))).toBe(true);
  });

  it("detects risky permissions and sudoers patterns", () => {
    const findings = auditPermissions(`
-rw-r--r-- 1 root root 120 Jan 1 00:00 /home/app/.env
drwxrwxrwx 2 app app 4096 Jan 1 00:00 /srv/uploads
ops ALL=(ALL) NOPASSWD: ALL
`);
    expect(findings.some((item) => item.title === "Sensitive file readable by everyone")).toBe(true);
    expect(findings.some((item) => item.title === "World-writable permission detected")).toBe(true);
    expect(findings.some((item) => item.title === "Passwordless full sudo detected")).toBe(true);
  });

  it("calculates advisory exposure risk from service context", () => {
    const risk = calculateServiceRisk("redis", { unauthenticatedAccess: true, tlsMissing: true });
    expect(risk.level).toBe("CRITICAL");
    expect(risk.signals).toContain("Unauthenticated access indicator detected");
  });

  it("detects privacy exposure indicators", () => {
    const findings = auditPrivacyExposure("server: nginx\naccess-control-allow-origin: *\nstun:stun.example.net\ntelemetry=sentry");
    expect(findings.some((item) => item.title === "Technology metadata disclosure")).toBe(true);
    expect(findings.some((item) => item.title === "Wildcard CORS policy")).toBe(true);
    expect(findings.some((item) => item.title === "WebRTC or STUN exposure signal")).toBe(true);
  });

  it("tracks service watcher baselines and exposure deltas", () => {
    saveWatcherBaseline("example.com", [{ port: 80, service: "http" }]);
    const baseline = loadWatcherBaselines()["example.com"];
    const delta = comparePortExposure(baseline.openPorts, [
      { port: 80, service: "http" },
      { port: 443, service: "https" },
    ]);
    expect(delta.opened).toEqual([{ port: 443, service: "https", banner: "" }]);
    expect(delta.closed).toEqual([]);
  });

  it("validates CSR fields and generates PEM material locally", async () => {
    const form = {
      keyType: "ecdsa-p256",
      commonName: "example.com",
      organization: "Example",
      organizationalUnit: "",
      city: "",
      state: "",
      country: "US",
      email: "admin@example.com",
      sanDns: "example.com,www.example.com",
      sanIps: "192.0.2.10",
    };
    expect(validateCsrForm(form).errors).toEqual({});
    const bundle = await generateCsrBundle(form);
    expect(bundle.csrPem).toContain("BEGIN CERTIFICATE REQUEST");
    expect(bundle.privateKeyPem).toContain("BEGIN PRIVATE KEY");
    expect(bundle.opensslCommand).toContain("subjectAltName=DNS:example.com,DNS:www.example.com,IP:192.0.2.10");
  });
});
