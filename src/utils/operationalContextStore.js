const STORAGE_KEY = "sysai_operational_context_v1";

export const defaultOperationalContext = {
  version: 1,
  updated_at: null,

  profile: {
    name: "",
    environment_type: "",
    os: "",
    platform: "",
    primary_use: "",
    stacks: [],
  },

  preferences: {
    prefer_step_by_step: true,
    prefer_read_only_first: true,
    avoid_destructive_commands: true,
    show_reasoning: false,
    prefer_docker_compose: false,
  },

  recent_patterns: [],

  notes: "",
};

export function loadOperationalContext() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return defaultOperationalContext;
    }

    const parsed = JSON.parse(raw);

    return {
      ...defaultOperationalContext,
      ...parsed,
    };
  } catch (err) {
    console.error("Failed to load operational context:", err);

    return defaultOperationalContext;
  }
}

export function saveOperationalContext(context) {
  try {
    const updated = {
      ...context,
      updated_at: new Date().toISOString(),
    };

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(updated, null, 2)
    );

    return true;
  } catch (err) {
    console.error("Failed to save operational context:", err);

    return false;
  }
}

export function resetOperationalContext() {
  localStorage.removeItem(STORAGE_KEY);

  return defaultOperationalContext;
}
