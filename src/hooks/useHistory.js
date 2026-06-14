import { useState, useEffect, useCallback } from 'react';
import { loadOperationalContext } from '../utils/operationalContextStore';

const STORAGE_KEY = 'sysai_history';
const HISTORY_ENABLED_KEY = 'sysai_history_enabled';
const MAX_ENTRIES = 500;
const SENSITIVE_TOOLS = new Set(['securityAuditorLocal', 'csrGenerator']);

export function redactSensitiveText(value) {
  return String(value || '')
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[redacted private key]')
    .replace(/\b(password|passwd|pwd|passphrase|secret|token|api[_-]?key|access[_-]?key|client[_-]?secret|db[_-]?password|database[_-]?url|redis[_-]?url|private[_-]?key)\b\s*[:=]\s*["']?[^"'\s#]+/gi, '$1=[redacted]')
    .replace(/[a-z][a-z0-9+.-]*:\/\/[^:\s/@]+:[^@\s]+@[^/\s]+/gi, '[redacted credential url]');
}

function sanitizeHistoryOutput(value) {
  if (typeof value === 'string') return redactSensitiveText(value);
  if (!value || typeof value !== 'object') return value;
  return JSON.parse(redactSensitiveText(JSON.stringify(value)));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

function createContextSnapshot() {
  try {
    const context = loadOperationalContext();
    const profile = context.profile || {};
    const memory = context.memory || {};

    return {
      os: profile.os || '',
      platform: profile.platform || '',
      environmentType: profile.environment_type || '',
      primaryUse: profile.primary_use || '',
      stacks: Array.isArray(profile.stacks) ? profile.stacks.slice(0, 8) : [],
      knownServices: Array.isArray(memory.known_services) ? memory.known_services.slice(0, 8) : [],
      knownContainers: Array.isArray(memory.known_containers) ? memory.known_containers.slice(0, 8) : [],
      inferredStack: Array.isArray(memory.inferred_stack) ? memory.inferred_stack.slice(0, 8) : [],
      capturedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn('[History] Could not capture operational context snapshot:', err.message);
    return null;
  }
}

function loadHistory() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (err) {
    console.error('[History] Errore caricamento:', err);
    return [];
  }
}

function saveHistory(entries) {
  try {
    // Mantieni solo le ultime MAX_ENTRIES
    const trimmed = entries.slice(0, MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    return true;
  } catch (err) {
    console.error('[History] Errore salvataggio:', err);
    return false;
  }
}

export function useHistory() {
  const [entries, setEntries] = useState([]);
  const [enabled, setEnabledState] = useState(() => localStorage.getItem(HISTORY_ENABLED_KEY) !== 'false');

  // Carica all'avvio
  useEffect(() => {
    setEntries(loadHistory());
  }, []);

  const addEntry = useCallback(({ tool, toolName, toolIcon, input, output, provider, model, sensitive = false, skip = false }) => {
    if (!enabled || skip || sensitive || SENSITIVE_TOOLS.has(tool)) {
      return null;
    }

    const entry = {
      id: generateId(),
      tool,
      toolName,
      toolIcon,
      input: redactSensitiveText(typeof input === 'string' ? input : JSON.stringify(input)).substring(0, 2000),
      output: sanitizeHistoryOutput(output),
      provider,
      model,
      contextSnapshot: createContextSnapshot(),
      timestamp: Date.now(),
      favorite: false,
    };

    setEntries(prev => {
      const updated = [entry, ...prev].slice(0, MAX_ENTRIES);
      saveHistory(updated);
      return updated;
    });

    return entry;
  }, [enabled]);

  const setEnabled = useCallback((nextEnabled) => {
    const value = Boolean(nextEnabled);
    setEnabledState(value);
    localStorage.setItem(HISTORY_ENABLED_KEY, value ? 'true' : 'false');
  }, []);

  // Cerca negli entry
  const searchEntries = useCallback((query, toolFilter = null) => {
    if (!query && !toolFilter) return entries;

    return entries.filter(entry => {
      // Filtro per tool
      if (toolFilter && entry.tool !== toolFilter) return false;

      // Filtro per testo
      if (query) {
        const q = query.toLowerCase();
        const inputMatch = entry.input?.toLowerCase().includes(q);
        const outputStr = typeof entry.output === 'string'
          ? entry.output
          : JSON.stringify(entry.output);
        const outputMatch = outputStr?.toLowerCase().includes(q);
        const toolMatch = entry.toolName?.toLowerCase().includes(q);
        const contextStr = entry.contextSnapshot
          ? JSON.stringify(entry.contextSnapshot)
          : '';
        const contextMatch = contextStr.toLowerCase().includes(q);

        return inputMatch || outputMatch || toolMatch || contextMatch;
      }

      return true;
    });
  }, [entries]);

  // Toggle preferito
  const toggleFavorite = useCallback((id) => {
    setEntries(prev => {
      const updated = prev.map(e =>
        e.id === id ? { ...e, favorite: !e.favorite } : e
      );
      saveHistory(updated);
      return updated;
    });
  }, []);

  // Ottieni solo i preferiti
  const getFavorites = useCallback(() => {
    return entries.filter(e => e.favorite);
  }, [entries]);

  // Cancella un entry
  const deleteEntry = useCallback((id) => {
    setEntries(prev => {
      const updated = prev.filter(e => e.id !== id);
      saveHistory(updated);
      return updated;
    });
  }, []);

  // Cancella tutto
  const clearAll = useCallback(() => {
    setEntries([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    entries,
    addEntry,
    searchEntries,
    toggleFavorite,
    getFavorites,
    deleteEntry,
    clearAll,
    enabled,
    setEnabled,
    count: entries.length,
  };
}
