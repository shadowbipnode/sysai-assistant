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

  memory: {
    known_services: [],
    known_containers: [],
    known_ports: [],
    known_paths: [],
    known_domains: [],
    known_incidents: [],
    inferred_stack: [],
  },

  baseline: {
    known_services: [],
    known_containers: [],
    known_ports: [],
    known_paths: [],
    known_domains: [],
    inferred_stack: [],
    created_at: null,
    updated_at: null,
  },

  notes: "",
};

export function loadOperationalContext() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return defaultOperationalContext;
    }

    const parsed = JSON.parse(raw);

    return normalizeOperationalContext(parsed);

  } catch (err) {
    console.error("Failed to load operational context:", err);

    return defaultOperationalContext;
  }
}

export function saveOperationalContext(context) {
  try {
    const updated = normalizeOperationalContext({
      ...context,
      updated_at: new Date().toISOString(),
    });

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
function uniqueList(values, maxItems = 20) {
  return [...new Set(
    (values || [])
      .map((item) => String(item || "").trim())
      .filter(Boolean)
  )].slice(0, maxItems);
}

export function normalizeOperationalContext(context) {
  const merged = {
    ...defaultOperationalContext,
    ...context,
    profile: {
      ...defaultOperationalContext.profile,
      ...(context?.profile || {}),
    },
    preferences: {
      ...defaultOperationalContext.preferences,
      ...(context?.preferences || {}),
    },
    memory: {
      ...defaultOperationalContext.memory,
      ...(context?.memory || {}),
    },
    baseline: {
      ...defaultOperationalContext.baseline,
      ...(context?.baseline || {}),
    },
  };

  return {
    ...merged,
    profile: {
      ...merged.profile,
      stacks: uniqueList(merged.profile.stacks, 16),
    },
    recent_patterns: uniqueList(merged.recent_patterns, 20),
    memory: {
      known_services: uniqueList(merged.memory.known_services, 30),
      known_containers: uniqueList(merged.memory.known_containers, 30),
      known_ports: uniqueList(merged.memory.known_ports, 30),
      known_paths: uniqueList(merged.memory.known_paths, 30),
      known_domains: uniqueList(merged.memory.known_domains, 30),
      known_incidents: uniqueList(merged.memory.known_incidents, 20),
      inferred_stack: uniqueList(merged.memory.inferred_stack, 20),
    },
    baseline: {
      known_services: uniqueList(merged.baseline.known_services, 30),
      known_containers: uniqueList(merged.baseline.known_containers, 30),
      known_ports: uniqueList(merged.baseline.known_ports, 30),
      known_paths: uniqueList(merged.baseline.known_paths, 30),
      known_domains: uniqueList(merged.baseline.known_domains, 30),
      inferred_stack: uniqueList(merged.baseline.inferred_stack, 20),
      created_at: merged.baseline.created_at || null,
      updated_at: merged.baseline.updated_at || null,
    },
  };
  };


export function updateOperationalMemory(patch = {}) {
  const current = normalizeOperationalContext(loadOperationalContext());

  const next = normalizeOperationalContext({
    ...current,
    memory: {
      ...current.memory,
      known_services: [
        ...current.memory.known_services,
        ...(patch.known_services || []),
      ],
      known_containers: [
        ...current.memory.known_containers,
        ...(patch.known_containers || []),
      ],
      known_ports: [
        ...current.memory.known_ports,
        ...(patch.known_ports || []),
      ],
      known_paths: [
        ...current.memory.known_paths,
        ...(patch.known_paths || []),
      ],
      known_domains: [
        ...current.memory.known_domains,
        ...(patch.known_domains || []),
      ],
      known_incidents: [
        ...current.memory.known_incidents,
        ...(patch.known_incidents || []),
      ],
      inferred_stack: [
        ...current.memory.inferred_stack,
        ...(patch.inferred_stack || []),
      ],
    },
    
  });

  saveOperationalContext(next);

  return next;
}
export function saveOperationalBaseline() {
  const current = normalizeOperationalContext(loadOperationalContext());
  const now = new Date().toISOString();

  const baseline = {
    known_services: current.memory.known_services,
    known_containers: current.memory.known_containers,
    known_ports: current.memory.known_ports,
    known_paths: current.memory.known_paths,
    known_domains: current.memory.known_domains,
    inferred_stack: current.memory.inferred_stack,
    created_at: current.baseline.created_at || now,
    updated_at: now,
  };

  const next = normalizeOperationalContext({
    ...current,
    baseline,
  });

  saveOperationalContext(next);

  return next;
}

function diffList(baselineValues = [], currentValues = []) {
  const baselineSet = new Set(baselineValues);
  const currentSet = new Set(currentValues);

  return {
    added: currentValues.filter((item) => !baselineSet.has(item)),
    missing: baselineValues.filter((item) => !currentSet.has(item)),
  };
}

export function detectOperationalDrift(context = loadOperationalContext()) {
  const normalized = normalizeOperationalContext(context);
  const baseline = normalized.baseline || {};
  const memory = normalized.memory || {};

  const fields = [
    "known_services",
    "known_containers",
    "known_ports",
    "known_paths",
    "known_domains",
    "inferred_stack",
  ];

  const changes = fields
    .map((field) => {
      const diff = diffList(baseline[field] || [], memory[field] || []);

      return {
        field,
        added: diff.added,
        missing: diff.missing,
      };
    })
    .filter((change) => change.added.length > 0 || change.missing.length > 0);

  return {
    drift_detected: changes.length > 0,
    baseline_exists: Boolean(baseline.updated_at),
    baseline_updated_at: baseline.updated_at || null,
    changes,
  };
}
export function resetOperationalContext() {
  localStorage.removeItem(STORAGE_KEY);

  return defaultOperationalContext;
}
