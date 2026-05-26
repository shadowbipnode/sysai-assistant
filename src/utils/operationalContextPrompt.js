import { loadOperationalContext } from "./operationalContextStore";

const MAX_NOTES_CHARS = 360;
const MAX_MEMORY_ITEMS = 8;

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
  const memory = context.memory || {};
  const memoryLines = [
    ["Known services", memory.known_services],
    ["Known containers", memory.known_containers],
    ["Known ports", memory.known_ports],
    ["Known paths", memory.known_paths],
    ["Known domains", memory.known_domains],
    ["Known incidents", memory.known_incidents],
    ["Inferred stack", memory.inferred_stack],
  ]
    .map(([label, values]) => {
      const items = Array.isArray(values)
        ? values.map(clean).filter(Boolean).slice(0, MAX_MEMORY_ITEMS)
        : [];

      return items.length ? `- ${label}: ${items.join(", ")}` : "";
    })
    .filter(Boolean);

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

  if (!uniqueTags.length && !notes && !memoryLines.length) return "";

  return `
Operational context memory:
${uniqueTags.length ? `- Profile: ${uniqueTags.join("; ")}` : ""}
${notes ? `- Notes: ${notes}` : ""}
${memoryLines.join("\n")}
 
Rules:
- Treat this as local operational memory, not direct evidence.
- Current user input and logs override memory.
- Use memory to choose safer discovery commands and avoid generic placeholders when relevant.
- If memory conflicts with current input, state the assumption explicitly.
- If the current input is partial, messy, or incomplete, do not pretend certainty.
- Clearly separate observed evidence from inferred assumptions.
- Prefer targeted discovery commands before remediation when critical context is missing.
- When confidence is LOW or MEDIUM, explain what signal would improve confidence.
`;
}
