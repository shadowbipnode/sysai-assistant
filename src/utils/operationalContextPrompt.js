import { loadOperationalContext } from "./operationalContextStore";

const MAX_NOTES_CHARS = 360;

function clean(value) {
  return String(value || "").trim();
}

function truncate(value, max = MAX_NOTES_CHARS) {
  const text = clean(value).replace(/\s+/g, " ");
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}...`;
}

export function buildOperationalContextBlock() {
  const context = loadOperationalContext();

  const tags = [];

  const os = clean(context.profile?.os);
  const primaryUse = clean(context.profile?.primary_use);
  const notes = truncate(context.notes);

  if (os) tags.push(os);
  if (primaryUse) tags.push(primaryUse);

  if (Array.isArray(context.profile?.stacks)) {
    context.profile.stacks
      .map(clean)
      .filter(Boolean)
      .forEach((stack) => tags.push(stack));
  }

  if (context.preferences?.prefer_read_only_first) tags.push("prefer read-only checks first");
  if (context.preferences?.avoid_destructive_commands) tags.push("avoid destructive remediation");
  if (context.preferences?.prefer_docker_compose) tags.push("prefer Docker Compose workflows");

  const uniqueTags = [...new Set(tags)].slice(0, 12);

  if (!uniqueTags.length && !notes) return "";

  return `
Operational context:
${uniqueTags.length ? `- ${uniqueTags.join("; ")}` : ""}
${notes ? `- Notes: ${notes}` : ""}

Use this only when relevant. Do not override direct evidence from the current input.
`;
}
