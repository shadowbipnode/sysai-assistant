/**
 * ═══════════════════════════════════════════════════════════
 * SysAI — History Page Component
 * ═══════════════════════════════════════════════════════════
 */

import { useState, useMemo } from 'react';

const TOOL_ICONS = {
  logAnalyzer: '📋',
  commandCrafter: '⌨️',
  explainMode: '🔍',
  configGenerator: '⚙️',
  troubleshooter: '🔧',
  scriptBuilder: '📜',
  securityAuditor: '🛡️',
};

const TOOL_NAMES = {
  logAnalyzer: 'Log Analyzer',
  commandCrafter: 'Command Crafter',
  explainMode: 'Explain Mode',
  configGenerator: 'Config Generator',
  troubleshooter: 'Troubleshooter',
  scriptBuilder: 'Script Builder',
  securityAuditor: 'Security Auditor',
};

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return date.toLocaleDateString(undefined, {
    month: 'short', day: 'numeric',
    ...(date.getFullYear() !== now.getFullYear() && { year: 'numeric' }),
  });
}

function formatOutput(output) {
  if (!output) return '';
  if (typeof output === 'string') return output;

  // Handle different tool output formats
  if (output.fix) return `${output.title || ''}\n${output.explanation || ''}\n${output.fix}`;
  if (output.command) return `${output.command}\n${output.explanation || ''}`;
  if (output.config) return `${output.filename || ''}\n${output.config}`;
  if (output.script) return `${output.filename || ''}\n${output.script}`;
  if (output.summary) return `${output.summary}\n${(output.lines || []).map(l => `${l.line}: ${l.explanation}`).join('\n')}`;
  if (output.diagnosis) return `${output.diagnosis}\n${output.fix || ''}`;
  if (output.findings) return output.findings.map(f => `[${f.severity}] ${f.issue}: ${f.fix}`).join('\n');
  if (output.report) return output.report;

  return JSON.stringify(output, null, 2);
}

function getCopyableContent(output) {
  if (!output) return '';
  if (typeof output === 'string') return output;
  if (output.fix) return output.fix;
  if (output.command) return output.command;
  if (output.config) return output.config;
  if (output.script) return output.script;
  if (output.diagnosis) return `${output.diagnosis}\n\n${output.check_command || ''}\n\n${output.fix || ''}`;
  return JSON.stringify(output, null, 2);
}

export default function History({
  entries,
  onSearch,
  onToggleFavorite,
  onDelete,
  onClearAll,
  onBack,
  accent = '#00D4AA',
  accentDim = '#00D4AA22',
  surface = '#131720',
  surface2 = '#1A1F2E',
  border = '#1E2535',
  bg = '#0B0E14',
  text1 = '#E8ECF4',
  text2 = '#8B95A8',
  showFavoritesOnly = false,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [toolFilter, setToolFilter] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [copied, setCopied] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Filter entries
  const filteredEntries = useMemo(() => {
    let result = showFavoritesOnly ? entries.filter(e => e.favorite) : entries;

    if (toolFilter) {
      result = result.filter(e => e.tool === toolFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e => {
        const inputMatch = e.input?.toLowerCase().includes(q);
        const outputStr = typeof e.output === 'string' ? e.output : JSON.stringify(e.output);
        const outputMatch = outputStr?.toLowerCase().includes(q);
        const toolMatch = e.toolName?.toLowerCase().includes(q);
        return inputMatch || outputMatch || toolMatch;
      });
    }

    return result;
  }, [entries, searchQuery, toolFilter, showFavoritesOnly]);

  // Get unique tools from entries for filter
  const availableTools = useMemo(() => {
    const tools = new Set(entries.map(e => e.tool));
    return Array.from(tools);
  }, [entries]);

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  // Group entries by date
  const groupedEntries = useMemo(() => {
    const groups = {};
    const now = new Date();
    const today = now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    filteredEntries.forEach(entry => {
      const date = new Date(entry.timestamp);
      let label;
      if (date.toDateString() === today) label = 'Today';
      else if (date.toDateString() === yesterday.toDateString()) label = 'Yesterday';
      else label = date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });

      if (!groups[label]) groups[label] = [];
      groups[label].push(entry);
    });

    return groups;
  }, [filteredEntries]);

  return (
    <div>
      {/* Header */}
      <button onClick={onBack} style={{
        background: 'none', border: 'none', color: text2, cursor: 'pointer',
        fontSize: 13, marginBottom: 16, fontFamily: "'Outfit', sans-serif",
      }}>← Back</button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700 }}>
          {showFavoritesOnly ? '⭐ Favorites' : '📜 History'}
          <span style={{ fontSize: 14, fontWeight: 400, color: text2, marginLeft: 10 }}>
            {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'}
          </span>
        </h2>

        {entries.length > 0 && !showFavoritesOnly && (
          <div>
            {!showClearConfirm ? (
              <button onClick={() => setShowClearConfirm(true)} style={{
                background: 'none', border: `1px solid ${border}`, borderRadius: 8,
                color: text2, padding: '6px 14px', fontSize: 12, cursor: 'pointer',
                fontFamily: "'Outfit', sans-serif",
              }}>🗑️ Clear all</button>
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#FF4D6A' }}>Delete all?</span>
                <button onClick={() => { onClearAll(); setShowClearConfirm(false); }} style={{
                  background: '#FF4D6A', color: '#fff', border: 'none', borderRadius: 6,
                  padding: '4px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600,
                }}>Yes</button>
                <button onClick={() => setShowClearConfirm(false)} style={{
                  background: surface2, color: text2, border: `1px solid ${border}`, borderRadius: 6,
                  padding: '4px 12px', fontSize: 12, cursor: 'pointer',
                }}>No</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Search bar */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: text2 }}>🔍</span>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search history..."
          style={{
            width: '100%', padding: '12px 16px 12px 42px', borderRadius: 12,
            background: surface, border: `1px solid ${border}`, color: text1,
            fontSize: 14, fontFamily: "'Outfit', sans-serif",
          }}
        />
      </div>

      {/* Tool filter pills */}
      {availableTools.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
          <button
            onClick={() => setToolFilter(null)}
            style={{
              padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
              background: !toolFilter ? accent : surface2,
              color: !toolFilter ? bg : text2,
              border: `1px solid ${!toolFilter ? accent : border}`,
              cursor: 'pointer', fontFamily: "'Outfit', sans-serif",
            }}
          >All</button>
          {availableTools.map(tool => (
            <button
              key={tool}
              onClick={() => setToolFilter(toolFilter === tool ? null : tool)}
              style={{
                padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                background: toolFilter === tool ? accent : surface2,
                color: toolFilter === tool ? bg : text2,
                border: `1px solid ${toolFilter === tool ? accent : border}`,
                cursor: 'pointer', fontFamily: "'Outfit', sans-serif",
              }}
            >{TOOL_ICONS[tool] || '📌'} {TOOL_NAMES[tool] || tool}</button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {filteredEntries.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>
            {showFavoritesOnly ? '⭐' : searchQuery ? '🔍' : '📜'}
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
            {showFavoritesOnly
              ? 'No favorites yet'
              : searchQuery
                ? 'No results found'
                : 'No history yet'
            }
          </h3>
          <p style={{ color: text2, fontSize: 14 }}>
            {showFavoritesOnly
              ? 'Star an entry to save it here'
              : searchQuery
                ? 'Try a different search term'
                : 'Your queries and results will appear here'
            }
          </p>
        </div>
      )}

      {/* Entries grouped by date */}
      {Object.entries(groupedEntries).map(([dateLabel, groupEntries]) => (
        <div key={dateLabel} style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 12, fontWeight: 600, color: text2, textTransform: 'uppercase',
            letterSpacing: '0.06em', marginBottom: 10, padding: '0 4px',
          }}>
            {dateLabel}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {groupEntries.map(entry => {
              const isExpanded = expandedId === entry.id;
              const preview = entry.input?.substring(0, 120) + (entry.input?.length > 120 ? '...' : '');

              return (
                <div key={entry.id} style={{
                  background: surface,
                  border: `1px solid ${isExpanded ? accent + '44' : border}`,
                  borderRadius: 12,
                  overflow: 'hidden',
                  transition: 'border-color 0.2s',
                }}>
                  {/* Collapsed view */}
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                    style={{
                      padding: '14px 16px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 12,
                    }}
                  >
                    <span style={{ fontSize: 20, flexShrink: 0 }}>
                      {TOOL_ICONS[entry.tool] || '📌'}
                    </span>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 600, color: text1,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {preview}
                      </div>
                      <div style={{ fontSize: 11, color: text2, marginTop: 3, display: 'flex', gap: 8 }}>
                        <span>{entry.toolName || TOOL_NAMES[entry.tool]}</span>
                        <span>•</span>
                        <span>{entry.provider}</span>
                        <span>•</span>
                        <span>{formatTime(entry.timestamp)}</span>
                      </div>
                    </div>

                    {/* Favorite star */}
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleFavorite(entry.id); }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 18, padding: 4, flexShrink: 0,
                        filter: entry.favorite ? 'none' : 'grayscale(1) opacity(0.3)',
                      }}
                    >⭐</button>

                    <span style={{
                      fontSize: 14, color: text2, flexShrink: 0,
                      transform: isExpanded ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.2s',
                    }}>▼</span>
                  </div>

                  {/* Expanded view */}
                  {isExpanded && (
                    <div style={{ borderTop: `1px solid ${border}`, padding: 16 }}>
                      {/* Input */}
                      <div style={{ marginBottom: 14 }}>
                        <div style={{
                          fontSize: 11, fontWeight: 600, color: text2,
                          textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6,
                        }}>Input</div>
                        <pre style={{
                          background: bg, border: `1px solid ${border}`, borderRadius: 8,
                          padding: 12, fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
                          color: text1, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                          maxHeight: 200, overflow: 'auto',
                        }}>{entry.input}</pre>
                      </div>

                      {/* Output */}
                      <div style={{ marginBottom: 14 }}>
                        <div style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          marginBottom: 6,
                        }}>
                          <div style={{
                            fontSize: 11, fontWeight: 600, color: text2,
                            textTransform: 'uppercase', letterSpacing: '0.06em',
                          }}>Output</div>
                          <button
                            onClick={() => handleCopy(getCopyableContent(entry.output), entry.id)}
                            style={{
                              background: 'none', border: `1px solid ${accent}44`, borderRadius: 6,
                              color: accent, padding: '3px 10px', fontSize: 11, cursor: 'pointer',
                              fontWeight: 600, fontFamily: "'Outfit', sans-serif",
                            }}
                          >{copied === entry.id ? '✓ Copied!' : '📋 Copy'}</button>
                        </div>
                        <pre style={{
                          background: bg, border: `1px solid ${accent}22`, borderRadius: 8,
                          padding: 12, fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
                          color: text1, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                          maxHeight: 400, overflow: 'auto',
                        }}>{formatOutput(entry.output)}</pre>
                      </div>

                      {/* Meta + actions */}
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}>
                        <div style={{ fontSize: 11, color: text2 }}>
                          {new Date(entry.timestamp).toLocaleString()} • {entry.provider} • {entry.model || 'default'}
                        </div>
                        <button
                          onClick={() => onDelete(entry.id)}
                          style={{
                            background: 'none', border: `1px solid #FF4D6A33`, borderRadius: 6,
                            color: '#FF4D6A', padding: '3px 10px', fontSize: 11, cursor: 'pointer',
                            fontFamily: "'Outfit', sans-serif",
                          }}
                        >🗑️ Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
