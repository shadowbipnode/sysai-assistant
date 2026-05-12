import { loadOperationalContext } from "./operationalContextStore";

export function buildOperationalContextBlock() {
  const context = loadOperationalContext();

  const lines = [];

  if (context.profile?.name) {
    lines.push(`Environment name: ${context.profile.name}`);
  }

  if (context.profile?.os) {
    lines.push(`Operating system: ${context.profile.os}`);
  }

  if (context.profile?.primary_use) {
    lines.push(`Primary use: ${context.profile.primary_use}`);
  }

  if (
    Array.isArray(context.profile?.stacks) &&
    context.profile.stacks.length > 0
  ) {
    lines.push(`Infrastructure stack: ${context.profile.stacks.join(", ")}`);
  }

  if (context.notes?.trim()) {
    lines.push(`Operational notes: ${context.notes.trim()}`);
  }

  if (lines.length === 0) {
    return "";
  }

  return `
Operational context:
${lines.map((l) => `- ${l}`).join("\n")}

Use this context to improve operational relevance, environment awareness and remediation quality.
`;
}
