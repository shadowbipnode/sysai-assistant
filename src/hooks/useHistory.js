/**
 * ═══════════════════════════════════════════════════════════
 * SysAI — useHistory Hook
 * ═══════════════════════════════════════════════════════════
 * 
 * Gestisce la cronologia delle query AI.
 * Salva in localStorage, supporta ricerca e filtri.
 * 
 * Uso:
 *   const { entries, addEntry, searchEntries, deleteEntry, clearAll } = useHistory();
 */

import { useState, useEffect, useCallback } from 'react';
import { loadOperationalContext } from '../utils/operationalContextStore';

const STORAGE_KEY = 'sysai_history';
const MAX_ENTRIES = 500;

/**
 * Struttura di un entry:
 * {
 *   id: string,           // UUID
 *   tool: string,         // "logAnalyzer" | "commandCrafter" | etc
 *   toolName: string,     // "Log Analyzer" (display name)
 *   toolIcon: string,     // "📋"
 *   input: string,        // cosa ha chiesto l'utente
 *   output: object|string,// risposta dell'AI
 *   provider: string,     // "gemini" | "openai" | etc
 *   model: string,        // "gemini-2.0-flash"
 *   timestamp: number,    // Date.now()
 *   favorite: boolean,    // per i preferiti
 * }
 */

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

  // Carica all'avvio
  useEffect(() => {
    setEntries(loadHistory());
  }, []);

  // Aggiungi un entry
  const addEntry = useCallback(({ tool, toolName, toolIcon, input, output, provider, model }) => {
    const entry = {
      id: generateId(),
      tool,
      toolName,
      toolIcon,
      input: typeof input === 'string' ? input.substring(0, 2000) : JSON.stringify(input).substring(0, 2000),
      output,
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
    count: entries.length,
  };
}
